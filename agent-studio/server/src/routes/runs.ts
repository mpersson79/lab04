import { Router } from "express";
import { ApprovalDecisionSchema, RunInputSchema, type Run, type RunSummary } from "@studio/shared";
import { HttpError } from "../errors.ts";
import { getSettings } from "../services/settings.ts";
import { runBus } from "../engine/bus.ts";
import { cancelRun, isRunActive, runs, startRun, submitApproval } from "../engine/executor.ts";
import { requireWorkflow } from "./workflows.ts";

const router = Router();

function summarize(run: Run): RunSummary {
  return {
    id: run.id,
    workflowId: run.workflowId,
    workflowName: run.workflowName,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    costUsd: run.costUsd,
    usage: run.usage,
    nodeCount: run.nodeRuns.length,
    error: run.error,
  };
}

router.get("/", (request, response) => {
  const workflowId = typeof request.query.workflowId === "string" ? request.query.workflowId : null;
  const limit = Math.min(Number(request.query.limit ?? 50) || 50, 200);
  const rows = runs
    .list()
    .filter((run) => !workflowId || run.workflowId === workflowId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
    .map(summarize);
  response.json(rows);
});

router.post("/", async (request, response) => {
  const body = request.body as { workflowId?: string; input?: unknown };
  if (!body.workflowId) throw new HttpError(400, "workflowId is required.");
  const workflow = requireWorkflow(body.workflowId);
  const input = RunInputSchema.parse(body.input ?? {});
  const run = await startRun({ workflow, input, settings: getSettings() });
  response.status(202).json(run);
});

router.get("/:id", (request, response) => {
  const run = runs.get(request.params.id);
  if (!run) throw new HttpError(404, "Run not found");
  response.json({ run, active: isRunActive(run.id) });
});

router.post("/:id/cancel", (request, response) => {
  const cancelled = cancelRun(request.params.id);
  if (!cancelled) throw new HttpError(409, "That run has already finished.");
  response.status(202).json({ ok: true });
});

router.post("/:id/approval", (request, response) => {
  const decision = ApprovalDecisionSchema.parse(request.body);
  submitApproval(request.params.id, decision);
  response.status(202).json({ ok: true });
});

router.delete("/:id", async (request, response) => {
  if (!runs.get(request.params.id)) throw new HttpError(404, "Run not found");
  runs.delete(request.params.id);
  runBus.forget(request.params.id);
  await runs.flush();
  response.status(204).end();
});

/**
 * Server-sent events for one run. The backlog is replayed first so a browser
 * that opens the stream after the run started still renders the full
 * transcript, then live events follow on the same connection.
 */
router.get("/:id/events", (request, response) => {
  const runId = request.params.id;
  if (!runs.get(runId)) throw new HttpError(404, "Run not found");

  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  const send = (event: unknown) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  for (const event of runBus.replay(runId)) send(event);

  const run = runs.get(runId);
  if (run && !isRunActive(runId)) {
    // The run already finished before this client connected.
    send({ type: "run.finished", runId, at: run.finishedAt ?? run.startedAt, run });
    response.end();
    return;
  }

  const unsubscribe = runBus.subscribe(runId, (event) => {
    send(event);
    if (event.type === "run.finished") {
      unsubscribe();
      clearInterval(heartbeat);
      response.end();
    }
  });

  // Proxies drop idle connections; a comment frame every 20s keeps them open.
  const heartbeat = setInterval(() => response.write(": ping\n\n"), 20_000);

  request.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

export default router;
