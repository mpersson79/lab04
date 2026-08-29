import { z } from "zod";
import type { TokenUsage } from "./models.ts";
import type { NodeKind } from "./workflow.ts";
import type { RetrievedChunk } from "./resources.ts";

export const RUN_STATUSES = [
  "queued",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const NODE_STATUSES = [
  "pending",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "skipped",
] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export interface ToolCallRecord {
  id: string;
  /** `custom`, `mcp`, `knowledge` or an Anthropic server tool name. */
  source: "custom" | "mcp" | "knowledge" | "server";
  name: string;
  input: unknown;
  output: string;
  isError: boolean;
  durationMs: number;
  startedAt: string;
}

export interface LogEntry {
  at: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface NodeRun {
  nodeId: string;
  name: string;
  kind: NodeKind;
  status: NodeStatus;
  startedAt: string | null;
  finishedAt: string | null;
  /** Rendered prompt / request that went in, for the trace viewer. */
  input: string;
  output: string;
  /** Parsed output when the node produced structured data. */
  data: unknown;
  thinking: string;
  error: string | null;
  model: string | null;
  usage: TokenUsage;
  costUsd: number;
  iterations: number;
  toolCalls: ToolCallRecord[];
  citations: RetrievedChunk[];
  logs: LogEntry[];
  /** Route id chosen by a router node. */
  selectedRoute: string | null;
}

export interface PendingApproval {
  nodeId: string;
  title: string;
  instructions: string;
  preview: string;
  allowEdit: boolean;
  requestedAt: string;
}

export interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output: string;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  usage: TokenUsage;
  costUsd: number;
  nodeRuns: NodeRun[];
  pendingApproval: PendingApproval | null;
}

/** Compact row for the run list. */
export interface RunSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  costUsd: number;
  usage: TokenUsage;
  nodeCount: number;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Streaming events                                                    */
/* ------------------------------------------------------------------ */

export type RunEvent =
  | { type: "run.started"; runId: string; at: string; run: Run }
  | { type: "node.started"; runId: string; at: string; nodeId: string; name: string; kind: NodeKind }
  | { type: "node.text"; runId: string; at: string; nodeId: string; delta: string }
  | { type: "node.thinking"; runId: string; at: string; nodeId: string; delta: string }
  | { type: "node.log"; runId: string; at: string; nodeId: string; entry: LogEntry }
  | { type: "node.tool"; runId: string; at: string; nodeId: string; call: ToolCallRecord }
  | { type: "node.finished"; runId: string; at: string; nodeId: string; nodeRun: NodeRun }
  | { type: "run.approval"; runId: string; at: string; approval: PendingApproval }
  | { type: "run.finished"; runId: string; at: string; run: Run }
  | { type: "ping"; runId: string; at: string };

export const RunInputSchema = z.record(z.string(), z.unknown());

export const ApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  /** Replacement payload when the reviewer edited the draft. */
  payload: z.string().optional(),
  comment: z.string().default(""),
});
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
