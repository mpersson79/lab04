import { Router } from "express";
import {
  McpServerDraftSchema,
  McpServerPatchSchema,
  McpServerSchema,
  type McpServer,
} from "@studio/shared";
import { mcp } from "../services/mcp.ts";
import { newId, nowIso } from "../store.ts";

const router = Router();

router.get("/", (_request, response) => {
  response.json(mcp.servers.list().sort((a, b) => a.name.localeCompare(b.name)));
});

router.post("/", async (request, response) => {
  const draft = McpServerDraftSchema.parse(request.body);
  const now = nowIso();
  const server: McpServer = McpServerSchema.parse({
    id: newId("mcp"),
    name: draft.name,
    description: draft.description,
    url: draft.url,
    transport: draft.transport,
    executionMode: draft.executionMode,
    hasAuthToken: Boolean(draft.authToken?.trim()),
    enabled: draft.enabled,
    allowedTools: draft.allowedTools,
    status: "unknown",
    statusMessage: "",
    tools: [],
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  mcp.servers.put(server);
  await mcp.setToken(server.id, draft.authToken);
  await mcp.servers.flush();

  // Probing on create means the card shows a real tool list straight away.
  const refreshed = await mcp.refresh(server.id);
  await mcp.servers.flush();
  response.status(201).json(refreshed);
});

router.put("/:id", async (request, response) => {
  const existing = mcp.require(request.params.id);
  const draft = McpServerPatchSchema.parse(request.body);

  const updated: McpServer = {
    ...existing,
    name: draft.name ?? existing.name,
    description: draft.description ?? existing.description,
    url: draft.url ?? existing.url,
    transport: draft.transport ?? existing.transport,
    executionMode: draft.executionMode ?? existing.executionMode,
    enabled: draft.enabled ?? existing.enabled,
    allowedTools: draft.allowedTools ?? existing.allowedTools,
    updatedAt: nowIso(),
  };

  // An omitted token leaves the stored one alone; an empty string clears it.
  if (draft.authToken !== undefined) {
    await mcp.setToken(updated.id, draft.authToken);
    updated.hasAuthToken = Boolean(draft.authToken.trim());
  }

  mcp.servers.put(updated);
  await mcp.servers.flush();
  response.json(updated);
});

router.post("/:id/test", async (request, response) => {
  const refreshed = await mcp.refresh(request.params.id);
  await mcp.servers.flush();
  response.json(refreshed);
});

router.delete("/:id", async (request, response) => {
  mcp.require(request.params.id);
  mcp.servers.delete(request.params.id);
  await mcp.forgetToken(request.params.id);
  await mcp.servers.flush();
  response.status(204).end();
});

export default router;
