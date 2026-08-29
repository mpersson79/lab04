import { z } from "zod";
import { DEFAULT_MODEL } from "./models.ts";

/* ------------------------------------------------------------------ */
/* Knowledge                                                           */
/* ------------------------------------------------------------------ */

export const KnowledgeBaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  chunkSize: z.number().int().min(200).max(8_000).default(1_200),
  chunkOverlap: z.number().int().min(0).max(2_000).default(180),
  documentCount: z.number().int().default(0),
  chunkCount: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;

/**
 * Patch schemas are written out field by field rather than derived with
 * `.partial()`. In Zod 4 a `.partial()` field that carries a `.default()` still
 * materializes that default when the key is absent, so patching one field would
 * quietly reset every other one back to its default.
 */
export const KnowledgeBasePatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  chunkSize: z.number().int().min(200).max(8_000).optional(),
  chunkOverlap: z.number().int().min(0).max(2_000).optional(),
});

export const KnowledgeBaseDraftSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  chunkSize: z.number().int().min(200).max(8_000).default(1_200),
  chunkOverlap: z.number().int().min(0).max(2_000).default(180),
});

export const SOURCE_TYPES = ["text", "file", "url"] as const;

export const KnowledgeDocumentSchema = z.object({
  id: z.string(),
  baseId: z.string(),
  title: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
  /** URL for `url` sources, filename for `file`, empty for pasted text. */
  source: z.string().default(""),
  characters: z.number().int().default(0),
  chunkCount: z.number().int().default(0),
  createdAt: z.string(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export interface KnowledgeChunk {
  id: string;
  baseId: string;
  documentId: string;
  documentTitle: string;
  ordinal: number;
  text: string;
  /** Sparse term-frequency vector, keyed by hashed token bucket. */
  vector: Record<string, number>;
  length: number;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  baseId: string;
  baseName: string;
  ordinal: number;
  text: string;
  score: number;
}

/* ------------------------------------------------------------------ */
/* MCP servers                                                         */
/* ------------------------------------------------------------------ */

export const MCP_TRANSPORTS = ["http", "sse"] as const;

/**
 * How an MCP server's tools actually get called.
 *
 * - `connector` hands the server URL to Anthropic, which connects to it
 *   directly. Lowest latency, but the URL must be reachable from the public
 *   internet.
 * - `proxy` connects from this studio process and re-exposes the tools to the
 *   model as ordinary client-side tools. Slower, and it works for servers on
 *   localhost or behind your VPN.
 */
export const MCP_EXECUTION_MODES = ["connector", "proxy"] as const;
export type McpExecutionMode = (typeof MCP_EXECUTION_MODES)[number];

export const McpToolSummarySchema = z.object({
  name: z.string(),
  description: z.string().default(""),
});
export type McpToolSummary = z.infer<typeof McpToolSummarySchema>;

export const McpServerSchema = z.object({
  id: z.string(),
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "letters, digits, dashes and underscores only"),
  description: z.string().default(""),
  url: z.string().min(1),
  transport: z.enum(MCP_TRANSPORTS).default("http"),
  executionMode: z.enum(MCP_EXECUTION_MODES).default("connector"),
  /** Bearer token forwarded to the server. Never returned to the browser. */
  hasAuthToken: z.boolean().default(false),
  enabled: z.boolean().default(true),
  /** Empty means "every tool the server exposes". */
  allowedTools: z.array(z.string()).default([]),
  status: z.enum(["unknown", "ok", "error"]).default("unknown"),
  statusMessage: z.string().default(""),
  tools: z.array(McpToolSummarySchema).default([]),
  lastCheckedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const McpServerDraftSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  url: z.string().min(1),
  transport: z.enum(MCP_TRANSPORTS).default("http"),
  executionMode: z.enum(MCP_EXECUTION_MODES).default("connector"),
  authToken: z.string().optional(),
  enabled: z.boolean().default(true),
  allowedTools: z.array(z.string()).default([]),
});

export const McpServerPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  url: z.string().min(1).optional(),
  transport: z.enum(MCP_TRANSPORTS).optional(),
  executionMode: z.enum(MCP_EXECUTION_MODES).optional(),
  authToken: z.string().optional(),
  enabled: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
});

/* ------------------------------------------------------------------ */
/* Custom tools                                                        */
/* ------------------------------------------------------------------ */

export const TOOL_KINDS = ["http", "code"] as const;

export const CustomToolSchema = z.object({
  id: z.string(),
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "use lower_snake_case, starting with a letter"),
  description: z.string().min(1),
  kind: z.enum(TOOL_KINDS).default("http"),
  /** JSON Schema for the tool input, as text so the editor round-trips it. */
  inputSchema: z.string().default('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}'),
  http: z
    .object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
      url: z.string().default(""),
      headers: z.record(z.string(), z.string()).prefault({}),
      body: z.string().default(""),
      timeoutMs: z.number().int().min(500).max(120_000).default(20_000),
    })
    .prefault({}),
  code: z.string().default("return { ok: true, echo: input };"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomTool = z.infer<typeof CustomToolSchema>;

export const CustomToolDraftSchema = CustomToolSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CustomToolPatchSchema = z.object({
  name: CustomToolSchema.shape.name.optional(),
  description: z.string().min(1).optional(),
  kind: z.enum(TOOL_KINDS).optional(),
  inputSchema: z.string().optional(),
  http: z
    .object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      url: z.string(),
      headers: z.record(z.string(), z.string()),
      body: z.string(),
      timeoutMs: z.number().int().min(500).max(120_000),
    })
    .partial()
    .optional(),
  code: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const SettingsSchema = z.object({
  defaultModel: z.string().default(DEFAULT_MODEL),
  /** Hard ceiling on dollars spent by a single run. 0 disables the check. */
  runCostLimitUsd: z.number().min(0).default(2),
  /** Wall-clock ceiling for a whole run. */
  runTimeoutSeconds: z.number().int().min(10).max(3_600).default(600),
  showCosts: z.boolean().default(true),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsPatchSchema = z.object({
  defaultModel: z.string().optional(),
  runCostLimitUsd: z.number().min(0).optional(),
  runTimeoutSeconds: z.number().int().min(10).max(3_600).optional(),
  showCosts: z.boolean().optional(),
});

/** What `GET /api/settings` returns: settings plus credential status. */
export interface SettingsStatus {
  settings: Settings;
  apiKey: {
    configured: boolean;
    /** e.g. "sk-ant-…7f2a". Never the whole key. */
    masked: string;
    source: "environment" | "stored" | "none";
  };
}
