import { Router } from "express";
import {
  CustomToolDraftSchema,
  CustomToolPatchSchema,
  CustomToolSchema,
  type CustomTool,
} from "@studio/shared";
import { executeCustomTool, parseToolSchema, tools } from "../services/tools.ts";
import { newId, nowIso } from "../store.ts";
import { HttpError, conflict, messageOf } from "../errors.ts";

const router = Router();

function require_(id: string): CustomTool {
  const tool = tools.get(id);
  if (!tool) throw new HttpError(404, `Tool ${id} not found`);
  return tool;
}

router.get("/", (_request, response) => {
  response.json(tools.list().sort((a, b) => a.name.localeCompare(b.name)));
});

router.post("/", async (request, response) => {
  const draft = CustomToolDraftSchema.parse(request.body);
  if (tools.list().some((tool) => tool.name === draft.name)) {
    throw conflict(`A tool named "${draft.name}" already exists.`);
  }
  const now = nowIso();
  const tool = CustomToolSchema.parse({ ...draft, id: newId("tool"), createdAt: now, updatedAt: now });
  parseToolSchema(tool); // fail fast on an unparseable schema
  tools.put(tool);
  await tools.flush();
  response.status(201).json(tool);
});

router.put("/:id", async (request, response) => {
  const existing = require_(request.params.id);
  const draft = CustomToolPatchSchema.parse(request.body);
  if (draft.name && tools.list().some((tool) => tool.name === draft.name && tool.id !== existing.id)) {
    throw conflict(`A tool named "${draft.name}" already exists.`);
  }
  const updated = CustomToolSchema.parse({
    ...existing,
    ...draft,
    http: { ...existing.http, ...draft.http },
    updatedAt: nowIso(),
  });
  parseToolSchema(updated);
  tools.put(updated);
  await tools.flush();
  response.json(updated);
});

router.delete("/:id", async (request, response) => {
  require_(request.params.id);
  tools.delete(request.params.id);
  await tools.flush();
  response.status(204).end();
});

/** Run a tool by hand with sample input, so you can debug it outside a run. */
router.post("/:id/test", async (request, response) => {
  const tool = require_(request.params.id);
  const input = (request.body as { input?: Record<string, unknown> })?.input ?? {};
  const startedAt = Date.now();
  try {
    const output = await executeCustomTool(tool, input);
    response.json({ ok: true, output, durationMs: Date.now() - startedAt });
  } catch (error) {
    response.json({ ok: false, output: messageOf(error), durationMs: Date.now() - startedAt });
  }
});

export default router;
