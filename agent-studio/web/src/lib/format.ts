import type { NodeStatus, RunStatus, TokenUsage } from "@studio/shared";

export function formatCost(usd: number): string {
  if (!usd) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(usage: TokenUsage): string {
  const total =
    usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  if (total < 1_000) return `${total}`;
  if (total < 1_000_000) return `${(total / 1_000).toFixed(1)}k`;
  return `${(total / 1_000_000).toFixed(2)}M`;
}

export function formatDuration(fromIso: string | null, toIso: string | null): string {
  if (!fromIso) return "—";
  const end = toIso ? Date.parse(toIso) : Date.now();
  const ms = end - Date.parse(fromIso);
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m ${Math.round((ms % 60_000) / 1_000)}s`;
}

export function formatRelative(iso: string): string {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1_000);
  if (seconds < 45) return "just now";
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)}h ago`;
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatBytes(characters: number): string {
  if (characters < 1_000) return `${characters} chars`;
  if (characters < 1_000_000) return `${(characters / 1_000).toFixed(1)}k chars`;
  return `${(characters / 1_000_000).toFixed(1)}M chars`;
}

const RUN_TONE: Record<RunStatus, string> = {
  queued: "text-ink-muted bg-hover",
  running: "text-accent bg-accent-soft",
  awaiting_approval: "text-human bg-[#3a3210]",
  succeeded: "text-ok bg-[#123024]",
  failed: "text-danger bg-[#3a1218]",
  cancelled: "text-ink-muted bg-hover",
};

const NODE_TONE: Record<NodeStatus, string> = {
  pending: "text-ink-faint bg-hover",
  running: "text-accent bg-accent-soft",
  awaiting_approval: "text-human bg-[#3a3210]",
  succeeded: "text-ok bg-[#123024]",
  failed: "text-danger bg-[#3a1218]",
  skipped: "text-ink-faint bg-hover",
};

export const runTone = (status: RunStatus): string => RUN_TONE[status];
export const nodeTone = (status: NodeStatus): string => NODE_TONE[status];

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  awaiting_approval: "Needs approval",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  pending: "Pending",
  running: "Running",
  awaiting_approval: "Needs approval",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
};
