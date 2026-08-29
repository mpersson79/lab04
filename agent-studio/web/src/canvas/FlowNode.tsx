import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { AlertTriangle, BookOpen, Check, Globe, Loader2, Plug, Wrench } from "lucide-react";
import type { WorkflowNode } from "@studio/shared";
import { NODE_KINDS } from "../lib/nodeKinds.ts";
import { cx } from "../components/ui.tsx";
import { formatCost } from "../lib/format.ts";
import type { NodeRuntime } from "../lib/builder.ts";

export interface StudioNodeData extends Record<string, unknown> {
  node: WorkflowNode;
  runtime: NodeRuntime | null;
  hasError: boolean;
  showCosts: boolean;
}

export type StudioNode = Node<StudioNodeData, "studio">;

/** One-line summary under the title: the thing you most want to see at a glance. */
function subtitleFor(node: WorkflowNode): string {
  switch (node.kind) {
    case "agent":
      return node.config.model;
    case "knowledge":
      return `top ${node.config.topK} · ${node.config.baseIds.length} base${node.config.baseIds.length === 1 ? "" : "s"}`;
    case "router":
      return node.config.mode === "llm" ? `${node.config.model} · ${node.config.routes.length} routes` : "expression";
    case "http":
      return `${node.config.method} ${node.config.url.replace(/^https?:\/\//, "").slice(0, 34)}`;
    case "input":
      return `${node.config.fields.length} field${node.config.fields.length === 1 ? "" : "s"}`;
    case "code":
      return "sandboxed JavaScript";
    case "approval":
      return "waits for a person";
    case "output":
      return node.config.format;
  }
}

/** Capability pills so an agent's attachments are visible without opening it. */
function capabilitiesFor(node: WorkflowNode) {
  if (node.kind !== "agent") return [];
  const pills: Array<{ icon: typeof Wrench; label: string; title: string }> = [];
  const { knowledge, toolIds, mcpServerIds, serverTools } = node.config;
  if (knowledge.mode !== "off" && knowledge.baseIds.length) {
    pills.push({
      icon: BookOpen,
      label: `${knowledge.baseIds.length}`,
      title: `${knowledge.baseIds.length} knowledge base(s), ${knowledge.mode} mode`,
    });
  }
  if (mcpServerIds.length) {
    pills.push({ icon: Plug, label: `${mcpServerIds.length}`, title: "MCP servers attached" });
  }
  if (toolIds.length) {
    pills.push({ icon: Wrench, label: `${toolIds.length}`, title: "Workspace tools attached" });
  }
  if (serverTools.webSearch || serverTools.webFetch) {
    pills.push({ icon: Globe, label: "web", title: "Anthropic web search / fetch enabled" });
  }
  return pills;
}

function FlowNodeInner({ data, selected }: NodeProps<StudioNode>) {
  const { node, runtime, hasError, showCosts } = data;
  const meta = NODE_KINDS[node.kind];
  const Icon = meta.icon;
  const status = runtime?.status ?? "pending";
  const isRunning = status === "running";

  const statusRing =
    status === "succeeded"
      ? "border-[#1e5c40]"
      : status === "failed"
        ? "border-[#5a2029]"
        : status === "skipped"
          ? "border-line-soft opacity-55"
          : status === "awaiting_approval"
            ? "border-[#5a4520]"
            : isRunning
              ? "border-accent"
              : hasError
                ? "border-[#5a2029]"
                : "border-line";

  return (
    <div
      className={cx(
        "w-[230px] rounded-xl border bg-surface shadow-lg transition-colors",
        statusRing,
        selected && "ring-2 ring-accent/60",
        isRunning && "node-running",
      )}
    >
      {meta.hasInput ? (
        <Handle type="target" position={Position.Left} className="!left-[-5px]" />
      ) : null}

      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div
          className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "color-mix(in srgb, currentColor 14%, transparent)", color: meta.color }}
        >
          <Icon size={13} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold leading-tight text-ink">
              {node.name}
            </span>
            {isRunning ? <Loader2 size={11} className="shrink-0 animate-spin text-accent" /> : null}
            {status === "succeeded" ? <Check size={11} className="shrink-0 text-ok" /> : null}
            {status === "failed" ? (
              <AlertTriangle size={11} className="shrink-0 text-danger" />
            ) : null}
          </div>
          <div className="truncate text-[10.5px] leading-tight text-ink-faint">
            {subtitleFor(node)}
          </div>
        </div>
      </div>

      {capabilitiesFor(node).length ? (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {capabilitiesFor(node).map((pill) => (
            <span
              key={pill.title}
              title={pill.title}
              className="inline-flex items-center gap-1 rounded-md bg-hover px-1.5 py-0.5 text-[9.5px] font-medium text-ink-muted"
            >
              <pill.icon size={9} />
              {pill.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* While an agent streams, show the tail of its output right on the node
          so you can read progress without opening the run panel. */}
      {isRunning && runtime?.text ? (
        <div className="mx-3 mb-2.5 max-h-16 overflow-hidden rounded-md bg-ground px-2 py-1.5 font-mono text-[10px] leading-[1.45] text-ink-muted">
          <span className="stream-caret">{runtime.text.slice(-170)}</span>
        </div>
      ) : null}

      {runtime && status === "succeeded" && showCosts && runtime.costUsd > 0 ? (
        <div className="border-t border-line-soft px-3 py-1 text-[10px] text-ink-faint">
          {formatCost(runtime.costUsd)}
        </div>
      ) : null}

      {/* Routers expose one handle per branch, labelled, so wiring is obvious. */}
      {node.kind === "router" ? (
        <div className="border-t border-line-soft">
          {node.config.routes.map((route, index) => (
            <div
              key={route.id}
              className={cx(
                "relative px-3 py-1.5 text-[10.5px]",
                index > 0 && "border-t border-line-soft",
                runtime?.selectedRoute === route.id ? "text-accent" : "text-ink-muted",
              )}
            >
              {route.label}
              <Handle
                id={route.id}
                type="source"
                position={Position.Right}
                className="!right-[-5px]"
                style={{ top: "50%" }}
              />
            </div>
          ))}
        </div>
      ) : meta.hasOutput ? (
        <Handle type="source" position={Position.Right} className="!right-[-5px]" />
      ) : null}
    </div>
  );
}

export const FlowNode = memo(FlowNodeInner);
