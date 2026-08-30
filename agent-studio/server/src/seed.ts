/**
 * `npm run seed` — install the managed service process into a workspace.
 *
 * Creates the knowledge bases from the Markdown under `seed/knowledge/`,
 * creates the service owner's tools, and instantiates the managed service
 * workflows with their retrieval wired to the bases that were just created.
 *
 * Idempotent: anything already present by name is left alone, so re-running
 * after editing a process document only indexes what is new. Pass `--reindex`
 * to drop and rebuild the seeded knowledge bases from disk.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  CustomToolSchema,
  WorkflowNodeSchema,
  WorkflowSchema,
  findTemplate,
  type CustomTool,
  type Workflow,
  type WorkflowNode,
} from "@studio/shared";

import { ROOT_DIR, loadDotEnv } from "./config.ts";
import { initDataDir, newId, nowIso } from "./store.ts";
import { loadSecrets } from "./services/secrets.ts";
import { loadSettings } from "./services/settings.ts";
import { knowledge } from "./services/knowledge.ts";
import { tools as toolStore } from "./services/tools.ts";
import { mcp } from "./services/mcp.ts";
import { runs } from "./engine/executor.ts";
import { workflows } from "./routes/workflows.ts";

const SEED_DIR = path.join(ROOT_DIR, "seed");

/* ------------------------------------------------------------------ */
/* What gets installed                                                 */
/* ------------------------------------------------------------------ */

interface BaseSpec {
  dir: string;
  name: string;
  description: string;
}

const BASES: BaseSpec[] = [
  {
    dir: "service-lifecycle-handbook",
    name: "Service lifecycle handbook",
    description:
      "The eight lifecycle stages, the exit criteria for each gate, the artifact register and the gate decision record format.",
  },
  {
    dir: "service-owner-playbook",
    name: "Service owner playbook",
    description:
      "What the service owner is accountable for, their decision rights, the full recurring task cadence, the RACI and the escalation path.",
  },
  {
    dir: "operations-standards",
    name: "Operations standards",
    description:
      "SLA and SLO tiers, error budget policy, incident severities and response targets, problem management, the runbook standard, change classes and release practice.",
  },
  {
    dir: "commercial-and-compliance",
    name: "Commercial & compliance",
    description:
      "Charge models, cost to serve, margin targets, pricing and discounting, the risk register, vulnerability remediation SLAs, access, data handling and compliance evidence.",
  },
];

interface ToolSpec {
  name: string;
  description: string;
  kind: "http" | "code";
  inputSchema: Record<string, unknown>;
  code?: string;
  http?: { method: "GET" | "POST"; url: string; headers: Record<string, string> };
}

const TOOLS: ToolSpec[] = [
  {
    name: "error_budget_status",
    description:
      "Given an SLO target, the measured attainment and how far through the window you are, work out how much error budget has been consumed, the burn rate, and which step of the error budget policy applies (normal, informed, partial freeze, full freeze or exhausted). Use this before asserting that a freeze is or is not required.",
    kind: "code",
    inputSchema: {
      type: "object",
      properties: {
        slo_percent: { type: "number", description: "The internal SLO target, e.g. 99.95" },
        attainment_percent: {
          type: "number",
          description: "Measured attainment so far in the window, e.g. 99.91",
        },
        window_days: { type: "number", description: "Length of the window in days, normally 28" },
        elapsed_days: { type: "number", description: "Days elapsed in the window so far" },
      },
      required: ["slo_percent", "attainment_percent", "window_days", "elapsed_days"],
    },
    code: `const slo = Number(input.slo_percent);
const attained = Number(input.attainment_percent);
const windowDays = Number(input.window_days);
const elapsed = Math.max(Number(input.elapsed_days), 0.01);

const budgetMinutes = ((100 - slo) / 100) * windowDays * 24 * 60;
const usedMinutes = ((slo - attained) / 100) * windowDays * 24 * 60;
const consumed = budgetMinutes > 0 ? Math.max(usedMinutes, 0) / budgetMinutes : 0;

// Projected consumption if the current burn rate holds to the end of the window.
const projected = consumed * (windowDays / elapsed);

let policy;
if (consumed >= 1) policy = "EXHAUSTED - feature work stops until the budget recovers over a full window";
else if (consumed >= 0.9) policy = "FULL FREEZE - fixes and security only; service owner reports to portfolio lead";
else if (consumed >= 0.75) policy = "PARTIAL FREEZE - non-essential changes held; reliability work takes priority over features";
else if (consumed >= 0.5) policy = "INFORMED - service owner notified; review the top contributor at the weekly";
else policy = "NORMAL - feature work proceeds";

return {
  budget_minutes: Math.round(budgetMinutes * 100) / 100,
  used_minutes: Math.round(Math.max(usedMinutes, 0) * 100) / 100,
  remaining_minutes: Math.round(Math.max(budgetMinutes - usedMinutes, 0) * 100) / 100,
  consumed_percent: Math.round(consumed * 1000) / 10,
  projected_consumption_percent_at_window_end: Math.round(projected * 1000) / 10,
  will_exhaust_before_window_end: projected > 1,
  policy_action: policy
};`,
  },
  {
    name: "sla_credit",
    description:
      "Work out the service credit owed for a period, from the service tier and the measured SLA attainment. Use this rather than estimating a credit; the customer should be told the number before they ask for it.",
    kind: "code",
    inputSchema: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["platinum", "gold", "silver", "bronze"],
          description: "Contracted service tier",
        },
        attainment_percent: { type: "number", description: "Measured SLA attainment, e.g. 99.42" },
        monthly_fee: { type: "number", description: "Monthly fee for the service in the billing currency" },
      },
      required: ["tier", "attainment_percent", "monthly_fee"],
    },
    code: `const tiers = {
  platinum: { sla: 99.95, bands: [[99.95, 0], [99.9, 10], [99.5, 25], [0, 50]] },
  gold:     { sla: 99.9,  bands: [[99.9, 0],  [99.5, 10], [99.0, 25], [0, 50]] },
  silver:   { sla: 99.5,  bands: [[99.5, 0],  [99.0, 10], [98.0, 20], [0, 30]] },
  bronze:   { sla: 99.0,  bands: [[99.0, 0],  [98.0, 5],  [95.0, 10], [0, 20]] }
};

const tier = tiers[String(input.tier).toLowerCase()];
if (!tier) return { error: "Unknown tier. Expected platinum, gold, silver or bronze." };

const attained = Number(input.attainment_percent);
const fee = Number(input.monthly_fee);

let creditPercent = 0;
for (const [threshold, percent] of tier.bands) {
  if (attained >= threshold) { creditPercent = percent; break; }
}

return {
  tier: input.tier,
  sla_target: tier.sla,
  attainment: attained,
  breached: attained < tier.sla,
  credit_percent: creditPercent,
  credit_amount: Math.round(fee * creditPercent) / 100,
  note: attained < tier.sla
    ? "Breach. Communicate the credit before the customer asks, and record the cause against the incident or problem record."
    : "Within SLA. No credit due."
};`,
  },
  {
    name: "service_desk_search",
    description:
      "Search the service desk for incidents, problems, changes and requests for a service over a date range. Returns the raw records. NEEDS CONFIGURATION: set SERVICE_DESK_URL and SERVICE_DESK_TOKEN in the server environment before attaching this to an agent.",
    kind: "http",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name as it appears in the catalogue" },
        record_type: {
          type: "string",
          enum: ["incident", "problem", "change", "request"],
          description: "Which record type to search",
        },
        since: { type: "string", description: "ISO date, inclusive" },
        query: { type: "string", description: "Free text filter, optional" },
      },
      required: ["service", "record_type", "since"],
    },
    http: {
      method: "GET",
      url: "{{env.SERVICE_DESK_URL}}/api/records?service={{input.service}}&type={{input.record_type}}&since={{input.since}}&q={{input.query}}",
      headers: { authorization: "Bearer {{env.SERVICE_DESK_TOKEN}}" },
    },
  },
  {
    name: "cost_report",
    description:
      "Fetch the cost and margin report for a service and period: spend by category, unit cost, and revenue. NEEDS CONFIGURATION: set FINOPS_URL and FINOPS_TOKEN in the server environment before attaching this to an agent.",
    kind: "http",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name as it appears in the catalogue" },
        period: { type: "string", description: "Period, e.g. 2026-03 or 2026-Q1" },
      },
      required: ["service", "period"],
    },
    http: {
      method: "GET",
      url: "{{env.FINOPS_URL}}/api/services/{{input.service}}/cost?period={{input.period}}",
      headers: { authorization: "Bearer {{env.FINOPS_TOKEN}}" },
    },
  },
];

/** Which seeded tools get attached to which node of which workflow. */
const TOOL_ATTACHMENTS: Record<string, Record<string, string[]>> = {
  "service-owner-desk": {
    reliability: ["error_budget_status", "sla_credit"],
  },
};

const WORKFLOW_TEMPLATE_IDS = [
  "service-gate-review",
  "service-owner-desk",
  "service-onboarding",
];

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

const log = (message: string) => console.log(message);

/** First `# heading` in the document, falling back to the filename. */
function titleOf(markdown: string, filename: string): string {
  const heading = /^#\s+(.+)$/m.exec(markdown);
  if (heading?.[1]) return heading[1].trim();
  return filename.replace(/^\d+[-_]/, "").replace(/\.md$/, "").replace(/[-_]/g, " ");
}

async function seedKnowledge(reindex: boolean): Promise<string[]> {
  const baseIds: string[] = [];

  for (const spec of BASES) {
    let base = knowledge.bases.list().find((candidate) => candidate.name === spec.name);

    if (base && reindex) {
      log(`  rebuilding "${spec.name}"`);
      await knowledge.removeBase(base.id);
      base = undefined;
    }

    if (!base) {
      const now = nowIso();
      base = knowledge.bases.put({
        id: newId("kb"),
        name: spec.name,
        description: spec.description,
        chunkSize: 1_400,
        chunkOverlap: 220,
        documentCount: 0,
        chunkCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      await knowledge.bases.flush();
      log(`  created knowledge base "${spec.name}"`);
    }

    const dir = path.join(SEED_DIR, "knowledge", spec.dir);
    const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".md")).sort();
    const existingTitles = new Set(
      knowledge.documents
        .list()
        .filter((document) => document.baseId === base!.id)
        .map((document) => document.title),
    );

    for (const file of files) {
      const text = await fs.readFile(path.join(dir, file), "utf8");
      const title = titleOf(text, file);
      if (existingTitles.has(title)) {
        log(`    · ${title} (already indexed)`);
        continue;
      }
      await knowledge.addDocument({
        baseId: base.id,
        title,
        sourceType: "file",
        source: `seed/knowledge/${spec.dir}/${file}`,
        text,
      });
      log(`    + ${title}`);
    }

    baseIds.push(base.id);
  }

  return baseIds;
}

async function seedTools(): Promise<Map<string, string>> {
  const byName = new Map<string, string>();

  for (const spec of TOOLS) {
    const existing = toolStore.list().find((tool) => tool.name === spec.name);
    if (existing) {
      byName.set(spec.name, existing.id);
      log(`  · ${spec.name} (already present)`);
      continue;
    }

    const now = nowIso();
    const tool: CustomTool = CustomToolSchema.parse({
      id: newId("tool"),
      name: spec.name,
      description: spec.description,
      kind: spec.kind,
      inputSchema: JSON.stringify(spec.inputSchema, null, 2),
      code: spec.code ?? "return input;",
      http: spec.http
        ? { ...spec.http, body: "", timeoutMs: 20_000 }
        : undefined,
      createdAt: now,
      updatedAt: now,
    });
    toolStore.put(tool);
    byName.set(spec.name, tool.id);
    log(`  + ${spec.name} (${spec.kind})`);
  }

  await toolStore.flush();
  return byName;
}

/** Point every retrieval node and knowledge-using agent at the seeded bases. */
function wireNode(
  node: WorkflowNode,
  baseIds: string[],
  toolIds: string[],
): WorkflowNode {
  if (node.kind === "knowledge") {
    return { ...node, config: { ...node.config, baseIds } };
  }
  if (node.kind === "agent") {
    const config = { ...node.config };
    if (config.knowledge.mode !== "off") {
      config.knowledge = { ...config.knowledge, baseIds };
    }
    if (toolIds.length) config.toolIds = toolIds;
    return { ...node, config };
  }
  return node;
}

async function seedWorkflows(baseIds: string[], toolIds: Map<string, string>): Promise<Workflow[]> {
  const created: Workflow[] = [];

  for (const templateId of WORKFLOW_TEMPLATE_IDS) {
    const template = findTemplate(templateId);
    if (!template) {
      log(`  ! template "${templateId}" not found - skipping`);
      continue;
    }

    const existing = workflows.list().find((workflow) => workflow.name === template.name);
    if (existing) {
      log(`  · ${template.name} (already present)`);
      created.push(existing);
      continue;
    }

    const attachments = TOOL_ATTACHMENTS[templateId] ?? {};
    const now = nowIso();
    const workflow = WorkflowSchema.parse({
      id: newId("wf"),
      name: template.name,
      description: template.description,
      tags: template.tags,
      nodes: template.nodes.map((raw) => {
        const node = WorkflowNodeSchema.parse(raw);
        const names = attachments[node.id] ?? [];
        const attached = names
          .map((name) => toolIds.get(name))
          .filter((id): id is string => Boolean(id));
        return wireNode(node, baseIds, attached);
      }),
      edges: template.edges,
      createdAt: now,
      updatedAt: now,
    });

    workflows.put(workflow);
    created.push(workflow);
    log(`  + ${template.name} (${workflow.nodes.length} nodes)`);
  }

  await workflows.flush();
  return created;
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const reindex = process.argv.includes("--reindex");

  loadDotEnv();
  await initDataDir();
  await Promise.all([
    loadSecrets(),
    loadSettings(),
    workflows.load(),
    runs.load(),
    knowledge.load(),
    mcp.load(),
    toolStore.load(),
  ]);

  log("\nKnowledge bases");
  const baseIds = await seedKnowledge(reindex);

  log("\nTools");
  const toolIds = await seedTools();

  log("\nWorkflows");
  const created = await seedWorkflows(baseIds, toolIds);

  const totalChunks = knowledge.bases
    .list()
    .filter((base) => baseIds.includes(base.id))
    .reduce((total, base) => total + base.chunkCount, 0);

  log(
    `\nDone. ${baseIds.length} knowledge bases (${totalChunks} chunks), ` +
      `${toolIds.size} tools, ${created.length} workflows.`,
  );
  log("Start the studio with `npm run dev` and open the Workflows page.\n");

  const unconfigured = TOOLS.filter((tool) => tool.kind === "http");
  if (unconfigured.length) {
    log(
      `Note: ${unconfigured
        .map((tool) => tool.name)
        .join(" and ")} call your own systems and need base URLs and tokens in ` +
        "the server environment before you attach them to an agent. See seed/README.md.\n",
    );
  }
}

main().catch((error: unknown) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
