import { Router } from "express";
import {
  TEMPLATES,
  WorkflowDraftSchema,
  WorkflowNodeSchema,
  WorkflowSchema,
  findTemplate,
  type Workflow,
} from "@studio/shared";
import { Collection, newId, nowIso, paths } from "../store.ts";
import { HttpError, badRequest } from "../errors.ts";
import { LIMITS } from "../config.ts";
import { templateReferences } from "../util/template.ts";
import { knowledge } from "../services/knowledge.ts";
import { mcp } from "../services/mcp.ts";
import { tools } from "../services/tools.ts";

export const workflows = new Collection<Workflow>(paths.workflows);

export function requireWorkflow(id: string): Workflow {
  const workflow = workflows.get(id);
  if (!workflow) throw new HttpError(404, `Workflow ${id} not found`);
  return workflow;
}

/**
 * Non-fatal problems worth surfacing before someone spends money on a run:
 * dangling references, unreachable nodes, empty prompts.
 */
export interface WorkflowIssue {
  level: "error" | "warning";
  nodeId: string | null;
  message: string;
}

export function lintWorkflow(workflow: Workflow): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  const push = (level: WorkflowIssue["level"], nodeId: string | null, message: string) =>
    issues.push({ level, nodeId, message });

  if (!workflow.nodes.some((node) => node.kind === "input")) {
    push("warning", null, "No input node, so the workflow cannot take a request.");
  }
  if (!workflow.nodes.some((node) => node.kind === "output")) {
    push("warning", null, "No output node, so the run result will be the last node that ran.");
  }

  const reachable = new Set<string>();
  const roots = workflow.nodes.filter(
    (node) => !workflow.edges.some((edge) => edge.target === node.id),
  );
  const queue = roots.map((node) => node.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of workflow.edges) {
      if (edge.source === id) queue.push(edge.target);
    }
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      push("error", null, `Edge ${edge.id} points at a node that no longer exists.`);
    }
  }

  for (const node of workflow.nodes) {
    if (!reachable.has(node.id)) {
      push("warning", node.id, `"${node.name}" is never reached.`);
    }

    if (node.kind === "agent") {
      if (!node.config.prompt.trim()) push("error", node.id, `"${node.name}" has an empty prompt.`);
      for (const toolId of node.config.toolIds) {
        if (!tools.has(toolId)) push("error", node.id, `"${node.name}" references a deleted tool.`);
      }
      for (const serverId of node.config.mcpServerIds) {
        if (!mcp.servers.has(serverId)) {
          push("error", node.id, `"${node.name}" references a deleted MCP server.`);
        }
      }
      for (const baseId of node.config.knowledge.baseIds) {
        if (!knowledge.bases.has(baseId)) {
          push("error", node.id, `"${node.name}" references a deleted knowledge base.`);
        }
      }
      if (node.config.knowledge.mode !== "off" && !node.config.knowledge.baseIds.length) {
        push("warning", node.id, `"${node.name}" has retrieval on but no knowledge base selected.`);
      }
      if (node.config.output.mode === "json") {
        try {
          JSON.parse(node.config.output.jsonSchema || "{}");
        } catch {
          push("error", node.id, `"${node.name}" has an invalid JSON output schema.`);
        }
      }
      for (const reference of templateReferences(node.config.prompt)) {
        const match = /^nodes\.([^.]+)/.exec(reference);
        if (match?.[1] && !nodeIds.has(match[1])) {
          push("error", node.id, `"${node.name}" references unknown node "${match[1]}".`);
        }
      }
    }

    if (node.kind === "knowledge" && !node.config.baseIds.length) {
      push("error", node.id, `"${node.name}" has no knowledge base selected.`);
    }

    if (node.kind === "router") {
      const outgoing = workflow.edges.filter((edge) => edge.source === node.id);
      for (const route of node.config.routes) {
        if (!outgoing.some((edge) => edge.sourceHandle === route.id)) {
          push("warning", node.id, `Route "${route.label}" is not wired to anything.`);
        }
      }
    }
  }

  return issues;
}

const router = Router();

router.get("/templates", (_request, response) => {
  response.json(
    TEMPLATES.map(({ id, name, description, tags, icon, requires, nodes }) => ({
      id,
      name,
      description,
      tags,
      icon,
      requires,
      nodeCount: nodes.length,
    })),
  );
});

router.get("/", (_request, response) => {
  const rows = workflows
    .list()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      tags: workflow.tags,
      nodeCount: workflow.nodes.length,
      agentCount: workflow.nodes.filter((node) => node.kind === "agent").length,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    }));
  response.json(rows);
});

router.post("/", async (request, response) => {
  const body = request.body as { templateId?: string; name?: string };
  const template = findTemplate(body.templateId ?? "blank");
  if (!template) throw badRequest(`Unknown template "${body.templateId}"`);

  const now = nowIso();
  const workflow: Workflow = WorkflowSchema.parse({
    id: newId("wf"),
    name: body.name?.trim() || template.name,
    description: template.description,
    tags: template.tags,
    nodes: template.nodes.map((node) => WorkflowNodeSchema.parse(node)),
    edges: template.edges,
    createdAt: now,
    updatedAt: now,
  });

  workflows.put(workflow);
  await workflows.flush();
  response.status(201).json(workflow);
});

router.get("/:id", (request, response) => {
  const workflow = requireWorkflow(request.params.id);
  response.json({ workflow, issues: lintWorkflow(workflow) });
});

router.put("/:id", async (request, response) => {
  const existing = requireWorkflow(request.params.id);
  const draft = WorkflowDraftSchema.parse(request.body);

  if ((draft.nodes?.length ?? 0) > LIMITS.maxNodesPerWorkflow) {
    throw badRequest(`Workflows are capped at ${LIMITS.maxNodesPerWorkflow} nodes.`);
  }

  const updated: Workflow = {
    ...existing,
    ...draft,
    nodes: draft.nodes ?? existing.nodes,
    edges: draft.edges ?? existing.edges,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };

  workflows.put(updated);
  await workflows.flush();
  response.json({ workflow: updated, issues: lintWorkflow(updated) });
});

router.post("/:id/duplicate", async (request, response) => {
  const source = requireWorkflow(request.params.id);
  const now = nowIso();
  const copy: Workflow = {
    ...structuredClone(source),
    id: newId("wf"),
    name: `${source.name} copy`,
    createdAt: now,
    updatedAt: now,
  };
  workflows.put(copy);
  await workflows.flush();
  response.status(201).json(copy);
});

router.delete("/:id", async (request, response) => {
  requireWorkflow(request.params.id);
  workflows.delete(request.params.id);
  await workflows.flush();
  response.status(204).end();
});

export default router;
