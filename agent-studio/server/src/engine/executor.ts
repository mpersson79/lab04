import type {
  ApprovalDecision,
  LogEntry,
  NodeRun,
  Run,
  RunEvent,
  Settings,
  ToolCallRecord,
  Workflow,
  WorkflowNode,
} from "@studio/shared";
import { EMPTY_USAGE, addUsage, costOf } from "@studio/shared";
import { LIMITS } from "../config.ts";
import { HttpError, messageOf } from "../errors.ts";
import { Collection, newId, nowIso, paths } from "../store.ts";
import { render, renderTemplate } from "../util/template.ts";
import { runSandboxed } from "../util/sandbox.ts";
import { knowledge, formatContext } from "../services/knowledge.ts";
import { runBus } from "./bus.ts";
import { classify, runAgent } from "./agent.ts";

export const runs = new Collection<Run>(paths.runs, { flushMs: 400 });

/** What one node hands to the next. */
interface Payload {
  /** Human-readable text: what a downstream prompt template will interpolate. */
  text: string;
  /** Structured value when the node produced one, otherwise the text. */
  value: unknown;
}

interface ActiveRun {
  run: Run;
  controller: AbortController;
  /** Set while a run is parked on an approval node. */
  resolveApproval: ((decision: ApprovalDecision) => void) | null;
  /** True only for an explicit cancel, so a timeout still reads as a failure. */
  cancelled: boolean;
}

const active = new Map<string, ActiveRun>();

export function isRunActive(runId: string): boolean {
  return active.has(runId);
}

export function cancelRun(runId: string): boolean {
  const handle = active.get(runId);
  if (!handle) return false;
  handle.cancelled = true;
  handle.controller.abort(new Error("Run cancelled"));
  handle.resolveApproval?.({ approved: false, comment: "Run cancelled" });
  return true;
}

export function submitApproval(runId: string, decision: ApprovalDecision): void {
  const handle = active.get(runId);
  if (!handle?.resolveApproval) {
    throw new HttpError(409, "That run is not waiting for an approval.");
  }
  handle.resolveApproval(decision);
}

function emit(event: RunEvent): void {
  runBus.publish(event);
}

function blankNodeRun(node: WorkflowNode): NodeRun {
  return {
    nodeId: node.id,
    name: node.name,
    kind: node.kind,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    input: "",
    output: "",
    data: null,
    thinking: "",
    error: null,
    model: null,
    usage: EMPTY_USAGE,
    costUsd: 0,
    iterations: 0,
    toolCalls: [],
    citations: [],
    logs: [],
    selectedRoute: null,
  };
}

function truncateOutput(text: string): string {
  return text.length > LIMITS.maxNodeOutputChars
    ? `${text.slice(0, LIMITS.maxNodeOutputChars)}\n\n[output truncated]`
    : text;
}

function payloadOf(nodeRun: NodeRun): Payload {
  return { text: nodeRun.output, value: nodeRun.data ?? nodeRun.output };
}

/** Merge several upstream payloads into the one a node receives. */
function mergePayloads(payloads: Payload[]): Payload {
  if (!payloads.length) return { text: "", value: "" };
  if (payloads.length === 1) return payloads[0]!;
  return {
    text: payloads.map((p) => p.text).join("\n\n"),
    value: payloads.map((p) => p.value),
  };
}

export interface StartRunOptions {
  workflow: Workflow;
  input: Record<string, unknown>;
  settings: Settings;
}

/**
 * Execute a workflow.
 *
 * Nodes run as soon as every incoming edge has resolved, so independent
 * branches proceed together. A router marks one outgoing edge live and the
 * rest dead; a node whose incoming edges are all dead is skipped, and that
 * skip propagates forward without failing the run.
 */
export async function startRun(options: StartRunOptions): Promise<Run> {
  const { workflow, input, settings } = options;

  if (!workflow.nodes.length) {
    throw new HttpError(400, "This workflow has no nodes yet.");
  }
  const cycle = findCycle(workflow);
  if (cycle) {
    throw new HttpError(400, `This workflow has a cycle: ${cycle.join(" → ")}.`);
  }

  const run: Run = {
    id: newId("run"),
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: "running",
    input,
    output: "",
    error: null,
    startedAt: nowIso(),
    finishedAt: null,
    usage: EMPTY_USAGE,
    costUsd: 0,
    nodeRuns: workflow.nodes.map(blankNodeRun),
    pendingApproval: null,
  };

  const handle: ActiveRun = {
    run,
    controller: new AbortController(),
    resolveApproval: null,
    cancelled: false,
  };
  active.set(run.id, handle);
  runs.put(run);
  emit({ type: "run.started", runId: run.id, at: nowIso(), run: structuredClone(run) });

  // Fire and forget: the HTTP caller gets the run id immediately and follows
  // the rest over the event stream.
  void execute(workflow, handle, settings).finally(() => {
    active.delete(run.id);
    trimHistory();
    void runs.flush();
  });

  return run;
}

async function execute(
  workflow: Workflow,
  handle: ActiveRun,
  settings: Settings,
): Promise<void> {
  const { run, controller } = handle;
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const nodeRunsById = new Map(run.nodeRuns.map((nodeRun) => [nodeRun.nodeId, nodeRun]));
  const incoming = new Map<string, typeof workflow.edges>();
  const outgoing = new Map<string, typeof workflow.edges>();
  for (const edge of workflow.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
    (incoming.get(edge.target) ?? incoming.set(edge.target, []).get(edge.target)!).push(edge);
    (outgoing.get(edge.source) ?? outgoing.set(edge.source, []).get(edge.source)!).push(edge);
  }

  /** Edge ids that will never carry a payload (a router chose otherwise). */
  const deadEdges = new Set<string>();
  const resolved = new Set<string>();
  const payloads = new Map<string, Payload>();

  const timeout = setTimeout(
    () => controller.abort(new Error(`Run exceeded ${settings.runTimeoutSeconds}s`)),
    settings.runTimeoutSeconds * 1_000,
  );

  try {
    let guard = 0;
    while (resolved.size < workflow.nodes.length) {
      if (guard++ > workflow.nodes.length * 4) {
        throw new Error("The scheduler made no progress - the graph is not executable.");
      }

      const ready = workflow.nodes.filter((node) => {
        if (resolved.has(node.id)) return false;
        const edges = incoming.get(node.id) ?? [];
        return edges.every((edge) => resolved.has(edge.source));
      });

      if (!ready.length) break;

      // Independent branches run concurrently; that is the whole point of a
      // graph rather than a list.
      await Promise.all(
        ready.map(async (node) => {
          const nodeRun = nodeRunsById.get(node.id)!;
          const edges = incoming.get(node.id) ?? [];
          const liveEdges = edges.filter((edge) => !deadEdges.has(edge.id));

          if (edges.length && !liveEdges.length) {
            nodeRun.status = "skipped";
            nodeRun.finishedAt = nowIso();
            resolved.add(node.id);
            for (const edge of outgoing.get(node.id) ?? []) deadEdges.add(edge.id);
            emit({
              type: "node.finished",
              runId: run.id,
              at: nowIso(),
              nodeId: node.id,
              nodeRun: structuredClone(nodeRun),
            });
            return;
          }

          const incomingPayload = mergePayloads(
            liveEdges
              .map((edge) => payloads.get(edge.source))
              .filter((payload): payload is Payload => Boolean(payload)),
          );

          await runNode({
            node,
            nodeRun,
            run,
            handle,
            workflow,
            settings,
            payload: incomingPayload,
            nodeRunsById,
            onRoute: (routeId) => {
              for (const edge of outgoing.get(node.id) ?? []) {
                if ((edge.sourceHandle ?? "") !== routeId) deadEdges.add(edge.id);
              }
            },
          });

          resolved.add(node.id);
          if (nodeRun.status === "succeeded") {
            payloads.set(node.id, payloadOf(nodeRun));
          } else {
            for (const edge of outgoing.get(node.id) ?? []) deadEdges.add(edge.id);
          }
        }),
      );

      // Recompute totals after every wave so the UI's cost meter is live.
      run.usage = run.nodeRuns.reduce((total, nodeRun) => addUsage(total, nodeRun.usage), EMPTY_USAGE);
      run.costUsd = run.nodeRuns.reduce((total, nodeRun) => total + nodeRun.costUsd, 0);
      runs.put(run);

      if (settings.runCostLimitUsd > 0 && run.costUsd > settings.runCostLimitUsd) {
        throw new Error(
          `Run stopped at $${run.costUsd.toFixed(4)}, over the $${settings.runCostLimitUsd} limit set in Settings.`,
        );
      }
      if (run.nodeRuns.some((nodeRun) => nodeRun.status === "failed")) {
        const failed = run.nodeRuns.find((nodeRun) => nodeRun.status === "failed")!;
        throw new Error(`"${failed.name}" failed: ${failed.error}`);
      }
    }

    run.output = finalOutput(run, workflow);
    run.status = "succeeded";
  } catch (error) {
    run.status = handle.cancelled ? "cancelled" : "failed";
    run.error = messageOf(controller.signal.reason ?? error) || messageOf(error);
    for (const nodeRun of run.nodeRuns) {
      if (nodeRun.status === "running" || nodeRun.status === "awaiting_approval") {
        nodeRun.status = "failed";
        nodeRun.error = nodeRun.error ?? run.error;
        nodeRun.finishedAt = nowIso();
      }
    }
  } finally {
    clearTimeout(timeout);
    run.finishedAt = nowIso();
    run.pendingApproval = null;
    run.usage = run.nodeRuns.reduce((total, nodeRun) => addUsage(total, nodeRun.usage), EMPTY_USAGE);
    run.costUsd = run.nodeRuns.reduce((total, nodeRun) => total + nodeRun.costUsd, 0);
    runs.put(run);
    emit({ type: "run.finished", runId: run.id, at: nowIso(), run: structuredClone(run) });
  }
}

/** The run's answer: the last output node that ran, else the last node that did. */
function finalOutput(run: Run, workflow: Workflow): string {
  const outputNodes = workflow.nodes.filter((node) => node.kind === "output");
  const candidates = outputNodes.length ? outputNodes : workflow.nodes;
  const succeeded = candidates
    .map((node) => run.nodeRuns.find((nodeRun) => nodeRun.nodeId === node.id))
    .filter((nodeRun): nodeRun is NodeRun => nodeRun?.status === "succeeded");
  return succeeded.at(-1)?.output ?? "";
}

interface RunNodeArgs {
  node: WorkflowNode;
  nodeRun: NodeRun;
  run: Run;
  handle: ActiveRun;
  workflow: Workflow;
  settings: Settings;
  payload: Payload;
  nodeRunsById: Map<string, NodeRun>;
  onRoute: (routeId: string) => void;
}

async function runNode(args: RunNodeArgs): Promise<void> {
  const { node, nodeRun, run, handle, payload, nodeRunsById, onRoute } = args;

  nodeRun.status = "running";
  nodeRun.startedAt = nowIso();
  emit({
    type: "node.started",
    runId: run.id,
    at: nodeRun.startedAt,
    nodeId: node.id,
    name: node.name,
    kind: node.kind,
  });

  const log = (level: LogEntry["level"], message: string) => {
    const entry: LogEntry = { at: nowIso(), level, message };
    nodeRun.logs.push(entry);
    emit({ type: "node.log", runId: run.id, at: entry.at, nodeId: node.id, entry });
  };

  // Templates in this node can see the run input, every finished node, and the
  // payload arriving on its own edges.
  const context = {
    input: payload.value,
    text: payload.text,
    run: { id: run.id, workflow: run.workflowName },
    nodes: Object.fromEntries(
      [...nodeRunsById.values()].map((other) => [
        other.nodeId,
        { output: other.output, data: other.data, status: other.status },
      ]),
    ),
  };

  try {
    switch (node.kind) {
      case "input": {
        nodeRun.input = JSON.stringify(run.input, null, 2);
        for (const field of node.config.fields) {
          const value = run.input[field.key];
          if (field.required && (value === undefined || value === null || value === "")) {
            throw new Error(`Required input "${field.label}" was not provided.`);
          }
        }
        nodeRun.data = run.input;
        nodeRun.output = JSON.stringify(run.input, null, 2);
        break;
      }

      case "agent": {
        const rendered = renderTemplate(node.config.prompt, context);
        if (rendered.missing.length) {
          log("warn", `Unresolved template values: ${[...new Set(rendered.missing)].join(", ")}`);
        }
        nodeRun.input = rendered.text;
        nodeRun.model = node.config.model;

        const result = await runAgent(node.config, rendered.text || payload.text, {
          onText: (delta) =>
            emit({ type: "node.text", runId: run.id, at: nowIso(), nodeId: node.id, delta }),
          onThinking: (delta) =>
            emit({ type: "node.thinking", runId: run.id, at: nowIso(), nodeId: node.id, delta }),
          onToolCall: (call: ToolCallRecord) =>
            emit({ type: "node.tool", runId: run.id, at: nowIso(), nodeId: node.id, call }),
          log,
          signal: handle.controller.signal,
        });

        nodeRun.output = truncateOutput(result.text);
        nodeRun.data = result.data;
        nodeRun.thinking = result.thinking;
        nodeRun.usage = result.usage;
        nodeRun.costUsd = costOf(result.model, result.usage);
        nodeRun.iterations = result.iterations;
        nodeRun.citations = result.citations;
        nodeRun.toolCalls = result.toolCalls;
        break;
      }

      case "knowledge": {
        const query = render(node.config.query, context) || payload.text;
        nodeRun.input = query;
        if (!node.config.baseIds.length) {
          throw new Error("This retrieval node has no knowledge bases selected.");
        }
        const results = await knowledge.search({
          baseIds: node.config.baseIds,
          query,
          topK: node.config.topK,
          minScore: node.config.minScore,
        });
        nodeRun.citations = results;
        nodeRun.output = formatContext(results, node.config.includeCitations);
        nodeRun.data = results;
        log("info", `${results.length} passage(s) matched.`);
        break;
      }

      case "router": {
        const routeIds = node.config.routes.map((route) => route.id);
        if (!routeIds.length) throw new Error("This router has no routes defined.");

        let routeId: string | null;
        if (node.config.mode === "expression") {
          nodeRun.input = node.config.expression;
          const { value, logs } = runSandboxed(
            `return (${node.config.expression});`,
            { input: payload.value, text: payload.text, nodes: context.nodes },
            2_000,
          );
          for (const line of logs) log("info", line);
          routeId = typeof value === "string" && routeIds.includes(value) ? value : null;
        } else {
          const prompt = render(node.config.prompt, context) || payload.text;
          nodeRun.input = prompt;
          nodeRun.model = node.config.model;
          const catalogue = node.config.routes
            .map((route) => `- ${route.id}: ${route.label}${route.description ? ` — ${route.description}` : ""}`)
            .join("\n");
          const decision = await classify({
            model: node.config.model,
            system: `${node.config.instructions}\n\nRoutes:\n${catalogue}\n\nReply with the route id and a one-line reason.`,
            prompt,
            routeIds,
            signal: handle.controller.signal,
          });
          nodeRun.usage = decision.usage;
          nodeRun.costUsd = costOf(node.config.model, decision.usage);
          routeId = decision.routeId;
          if (decision.raw) log("info", `Classifier said: ${decision.raw.slice(0, 400)}`);
        }

        if (!routeId) {
          routeId = node.config.fallbackRouteId || routeIds[0]!;
          log("warn", `No route matched; falling back to "${routeId}".`);
        }

        const chosen = node.config.routes.find((route) => route.id === routeId);
        nodeRun.selectedRoute = routeId;
        nodeRun.output = payload.text;
        nodeRun.data = payload.value;
        log("info", `Routed to "${chosen?.label ?? routeId}".`);
        onRoute(routeId);
        break;
      }

      case "code": {
        nodeRun.input = node.config.code;
        const { value, logs } = runSandboxed(
          node.config.code,
          { input: payload.value, text: payload.text, nodes: context.nodes },
          node.config.timeoutMs,
        );
        for (const line of logs) log("info", line);
        nodeRun.data = value ?? null;
        nodeRun.output = truncateOutput(
          typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2),
        );
        break;
      }

      case "http": {
        const url = render(node.config.url, {
          ...context,
          env: process.env as Record<string, string | undefined>,
        }).trim();
        if (!url) throw new Error("This request node has no URL.");
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(node.config.headers)) {
          headers[key] = render(value, context);
        }
        const sendsBody = node.config.method !== "GET" && node.config.method !== "DELETE";
        const body = sendsBody && node.config.body ? render(node.config.body, context) : undefined;
        if (body && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
          headers["content-type"] = "application/json";
        }

        nodeRun.input = `${node.config.method} ${url}${body ? `\n\n${body}` : ""}`;
        const response = await fetch(url, {
          method: node.config.method,
          headers,
          body,
          signal: AbortSignal.any([
            handle.controller.signal,
            AbortSignal.timeout(node.config.timeoutMs),
          ]),
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`${url} returned ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
        }
        nodeRun.output = truncateOutput(text);
        if (node.config.parseJson) {
          try {
            nodeRun.data = JSON.parse(text);
          } catch {
            nodeRun.data = text;
          }
        } else {
          nodeRun.data = text;
        }
        log("info", `${response.status} ${response.statusText}, ${text.length} characters.`);
        break;
      }

      case "approval": {
        const preview = render(node.config.preview, context) || payload.text;
        nodeRun.input = preview;
        nodeRun.status = "awaiting_approval";
        const approval = {
          nodeId: node.id,
          title: node.config.title,
          instructions: node.config.instructions,
          preview,
          allowEdit: node.config.allowEdit,
          requestedAt: nowIso(),
        };
        run.pendingApproval = approval;
        run.status = "awaiting_approval";
        runs.put(run);
        emit({ type: "run.approval", runId: run.id, at: approval.requestedAt, approval });

        const decision = await new Promise<ApprovalDecision>((resolve) => {
          handle.resolveApproval = resolve;
          handle.controller.signal.addEventListener("abort", () =>
            resolve({ approved: false, comment: "Run cancelled" }),
          );
        });
        handle.resolveApproval = null;
        run.pendingApproval = null;
        run.status = "running";

        if (!decision.approved) {
          throw new Error(decision.comment || "A reviewer rejected this step.");
        }
        const finalText = decision.payload ?? preview;
        nodeRun.output = finalText;
        nodeRun.data = finalText;
        log("info", decision.comment ? `Approved: ${decision.comment}` : "Approved.");
        break;
      }

      case "output": {
        const rendered = render(node.config.template, context) || payload.text;
        nodeRun.input = node.config.template;
        nodeRun.output = truncateOutput(rendered);
        nodeRun.data = payload.value;
        break;
      }
    }

    nodeRun.status = "succeeded";
  } catch (error) {
    nodeRun.status = "failed";
    nodeRun.error = messageOf(error);
    log("error", nodeRun.error);
  } finally {
    nodeRun.finishedAt = nowIso();
    emit({
      type: "node.finished",
      runId: run.id,
      at: nodeRun.finishedAt,
      nodeId: node.id,
      nodeRun: structuredClone(nodeRun),
    });
  }
}

/** Depth-first cycle detection; returns the offending node names if any. */
function findCycle(workflow: Workflow): string[] | null {
  const nameOf = new Map(workflow.nodes.map((node) => [node.id, node.name]));
  const adjacency = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    (adjacency.get(edge.source) ?? adjacency.set(edge.source, []).get(edge.source)!).push(edge.target);
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    const current = state.get(id);
    if (current === "done") return null;
    if (current === "visiting") {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id].map((nodeId) => nameOf.get(nodeId) ?? nodeId);
    }
    state.set(id, "visiting");
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const found = visit(next);
      if (found) return found;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };

  for (const node of workflow.nodes) {
    const found = visit(node.id);
    if (found) return found;
  }
  return null;
}

/** Keep the run log from growing without bound. */
function trimHistory(): void {
  const all = runs.list().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const run of all.slice(LIMITS.maxRunHistory)) {
    runs.delete(run.id);
    runBus.forget(run.id);
  }
}
