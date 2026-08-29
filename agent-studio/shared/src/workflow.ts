import { z } from "zod";
import { DEFAULT_MODEL, EFFORT_LEVELS } from "./models.ts";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const PositionSchema = z.object({ x: z.number(), y: z.number() });

const identifier = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "use lower_snake_case, starting with a letter");

/* ------------------------------------------------------------------ */
/* Node configs                                                        */
/* ------------------------------------------------------------------ */

export const INPUT_FIELD_TYPES = ["text", "longtext", "number", "boolean", "json"] as const;

export const InputFieldSchema = z.object({
  key: identifier,
  label: z.string().min(1),
  type: z.enum(INPUT_FIELD_TYPES).default("text"),
  required: z.boolean().default(true),
  placeholder: z.string().default(""),
  defaultValue: z.string().default(""),
});
export type InputField = z.infer<typeof InputFieldSchema>;

export const InputConfigSchema = z.object({
  fields: z.array(InputFieldSchema).default([
    {
      key: "request",
      label: "Request",
      type: "longtext",
      required: true,
      placeholder: "What should the workflow do?",
      defaultValue: "",
    },
  ]),
});

export const KNOWLEDGE_MODES = ["inject", "tool", "off"] as const;

export const AgentKnowledgeSchema = z.object({
  /** How retrieved context reaches the agent. */
  mode: z.enum(KNOWLEDGE_MODES).default("off"),
  baseIds: z.array(z.string()).default([]),
  topK: z.number().int().min(1).max(50).default(6),
  minScore: z.number().min(0).max(1).default(0.05),
  /** Only used when mode === "inject". Supports {{ }} templating. */
  query: z.string().default("{{input}}"),
});

export const ServerToolsSchema = z.object({
  webSearch: z.boolean().default(false),
  webFetch: z.boolean().default(false),
  codeExecution: z.boolean().default(false),
  maxWebSearches: z.number().int().min(1).max(20).default(5),
});

export const AgentOutputSchema = z.object({
  mode: z.enum(["text", "json"]).default("text"),
  /** JSON Schema (as text) enforced with structured outputs when mode is json. */
  jsonSchema: z.string().default(""),
});

export const AgentConfigSchema = z.object({
  model: z.string().default(DEFAULT_MODEL),
  systemPrompt: z.string().default("You are a precise, helpful assistant."),
  prompt: z.string().default("{{input}}"),
  effort: z.enum(EFFORT_LEVELS).default("high"),
  thinking: z.enum(["adaptive", "off"]).default("adaptive"),
  showThinking: z.boolean().default(true),
  maxTokens: z.number().int().min(256).max(128_000).default(8_000),
  /** Safety valve on the agentic tool loop. */
  maxIterations: z.number().int().min(1).max(30).default(8),
  cachePrompt: z.boolean().default(true),
  knowledge: AgentKnowledgeSchema.prefault({}),
  toolIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
  serverTools: ServerToolsSchema.prefault({}),
  output: AgentOutputSchema.prefault({}),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const KnowledgeConfigSchema = z.object({
  baseIds: z.array(z.string()).default([]),
  query: z.string().default("{{input}}"),
  topK: z.number().int().min(1).max(50).default(8),
  minScore: z.number().min(0).max(1).default(0.05),
  /** Emit numbered source markers so downstream agents can cite. */
  includeCitations: z.boolean().default(true),
});

export const RouteSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(""),
});
export type Route = z.infer<typeof RouteSchema>;

export const RouterConfigSchema = z.object({
  mode: z.enum(["llm", "expression"]).default("llm"),
  model: z.string().default("claude-haiku-4-5"),
  prompt: z.string().default("{{input}}"),
  instructions: z.string().default(
    "Pick the single route that best matches the request.",
  ),
  routes: z.array(RouteSchema).default([
    { id: "a", label: "Route A", description: "" },
    { id: "b", label: "Route B", description: "" },
  ]),
  /** Expression mode: JS returning a route id. `input`, `nodes` are in scope. */
  expression: z.string().default("input.length > 200 ? 'a' : 'b'"),
  /** Route taken when nothing matches or the model returns an unknown id. */
  fallbackRouteId: z.string().default(""),
});

export const CodeConfigSchema = z.object({
  /** Sandboxed JS. Receives `input`, `nodes`, `vars`; returns the node output. */
  code: z.string().default("return input;"),
  timeoutMs: z.number().int().min(50).max(30_000).default(3_000),
});

export const HttpConfigSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  url: z.string().default("https://api.example.com/things"),
  headers: z.record(z.string(), z.string()).prefault({}),
  body: z.string().default(""),
  timeoutMs: z.number().int().min(500).max(120_000).default(20_000),
  /** Parse the response as JSON when the content type allows it. */
  parseJson: z.boolean().default(true),
});

export const ApprovalConfigSchema = z.object({
  title: z.string().default("Review before continuing"),
  instructions: z.string().default("Check the draft below and approve or reject."),
  /** What the reviewer sees. */
  preview: z.string().default("{{input}}"),
  /** Allow the reviewer to replace the payload before continuing. */
  allowEdit: z.boolean().default(true),
});

export const OutputConfigSchema = z.object({
  template: z.string().default("{{input}}"),
  format: z.enum(["text", "json", "markdown"]).default("markdown"),
});

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

export const NODE_KINDS = [
  "input",
  "agent",
  "knowledge",
  "router",
  "code",
  "http",
  "approval",
  "output",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

const baseNode = {
  id: z.string().min(1),
  name: z.string().min(1),
  notes: z.string().default(""),
  position: PositionSchema,
};

export const WorkflowNodeSchema = z.discriminatedUnion("kind", [
  z.object({ ...baseNode, kind: z.literal("input"), config: InputConfigSchema.prefault({}) }),
  z.object({ ...baseNode, kind: z.literal("agent"), config: AgentConfigSchema.prefault({}) }),
  z.object({ ...baseNode, kind: z.literal("knowledge"), config: KnowledgeConfigSchema.prefault({}) }),
  z.object({ ...baseNode, kind: z.literal("router"), config: RouterConfigSchema.prefault({}) }),
  z.object({ ...baseNode, kind: z.literal("code"), config: CodeConfigSchema.prefault({}) }),
  z.object({ ...baseNode, kind: z.literal("http"), config: HttpConfigSchema.prefault({}) }),
  z.object({ ...baseNode, kind: z.literal("approval"), config: ApprovalConfigSchema.prefault({}) }),
  z.object({ ...baseNode, kind: z.literal("output"), config: OutputConfigSchema.prefault({}) }),
]);
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export type NodeOfKind<K extends NodeKind> = Extract<WorkflowNode, { kind: K }>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /** Router branch id, when the source is a router. */
  sourceHandle: z.string().nullable().default(null),
  label: z.string().default(""),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export const WorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  nodes: z.array(WorkflowNodeSchema).default([]),
  edges: z.array(WorkflowEdgeSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

/**
 * The subset a client may send when updating a workflow. Every field is
 * genuinely optional: an omitted `nodes` means "leave the graph alone", not
 * "replace it with an empty one", which is what a `.partial()` of a
 * defaulted field would have meant.
 */
export const WorkflowDraftSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nodes: z.array(WorkflowNodeSchema).optional(),
  edges: z.array(WorkflowEdgeSchema).optional(),
});
export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;
