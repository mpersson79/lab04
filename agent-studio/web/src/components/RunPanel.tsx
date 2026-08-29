import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  ChevronRight,
  CircleDot,
  Play,
  Quote,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { InputField, NodeRun, Run, RunEvent } from "@studio/shared";
import { api } from "../lib/api.ts";
import { useBuilder } from "../lib/builder.ts";
import { useWorkspace } from "../lib/workspace.ts";
import {
  NODE_STATUS_LABEL,
  RUN_STATUS_LABEL,
  formatCost,
  formatDuration,
  formatTokens,
  nodeTone,
  runTone,
} from "../lib/format.ts";
import { NODE_KINDS } from "../lib/nodeKinds.ts";
import Markdown from "./Markdown.tsx";
import {
  Badge,
  Button,
  Field,
  Select,
  TextArea,
  TextInput,
  cx,
  useToast,
} from "./ui.tsx";

/**
 * Subscribe to a run's event stream. The server replays the backlog on
 * connect, so mounting this late still renders the whole run.
 */
function useRunStream(runId: string | null, onEvent: (event: RunEvent) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!runId) return;
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = (message) => {
      try {
        handler.current(JSON.parse(message.data) as RunEvent);
      } catch {
        // A malformed frame is not worth tearing the stream down for.
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [runId]);
}

export default function RunPanel({ onClose }: { onClose: () => void }) {
  const workflow = useBuilder((state) => state.workflow);
  const run = useBuilder((state) => state.run);
  const runtime = useBuilder((state) => state.runtime);
  const streaming = useBuilder((state) => state.streaming);
  const { applyRunEvent, resetRun, save } = useBuilder.getState();
  const settings = useWorkspace((state) => state.settings);
  const toast = useToast();

  const [input, setInput] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);

  const inputFields = useMemo<InputField[]>(
    () => workflow?.nodes.flatMap((node) => (node.kind === "input" ? node.config.fields : [])) ?? [],
    [workflow?.nodes],
  );

  // Seed the form from each field's default the first time the fields change.
  useEffect(() => {
    setInput((current) => {
      const next = { ...current };
      for (const field of inputFields) {
        if (next[field.key] === undefined) next[field.key] = field.defaultValue;
      }
      return next;
    });
  }, [inputFields]);

  useRunStream(streaming ? (run?.id ?? null) : null, applyRunEvent);

  const start = async () => {
    if (!workflow) return;
    setStarting(true);
    try {
      await save();
      const payload: Record<string, unknown> = {};
      for (const field of inputFields) {
        const raw = input[field.key] ?? "";
        if (field.type === "number") payload[field.key] = raw === "" ? null : Number(raw);
        else if (field.type === "boolean") payload[field.key] = raw === "true";
        else if (field.type === "json") {
          try {
            payload[field.key] = raw ? JSON.parse(raw) : null;
          } catch {
            throw new Error(`"${field.label}" is not valid JSON.`);
          }
        } else payload[field.key] = raw;
      }
      resetRun();
      const started = await api.startRun(workflow.id, payload);
      useBuilder.setState({ run: started, streaming: true, runtime: {} });
      setOpenNodeId(null);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not start the run.");
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!run) return;
    try {
      await api.cancelRun(run.id);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not cancel.");
    }
  };

  const showCosts = settings?.settings.showCosts ?? true;

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="flex-1 text-[13px] font-semibold text-ink">Run</h2>
        {run ? (
          <span
            className={cx(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              runTone(run.status),
            )}
          >
            {RUN_STATUS_LABEL[run.status]}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close run panel">
          <X size={15} />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Input form ------------------------------------------------ */}
        <section className="border-b border-line px-4 py-3.5">
          {inputFields.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-ink-faint">
              This workflow has no input fields. Add an Input node to collect a request.
            </p>
          ) : (
            inputFields.map((field) => (
              <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>
                {field.type === "longtext" || field.type === "json" ? (
                  <TextArea
                    rows={field.type === "json" ? 5 : 3}
                    value={input[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setInput({ ...input, [field.key]: event.target.value })
                    }
                    className={field.type === "json" ? "font-mono text-[11.5px]" : undefined}
                  />
                ) : field.type === "boolean" ? (
                  <Select
                    value={input[field.key] ?? "false"}
                    onChange={(event) => setInput({ ...input, [field.key]: event.target.value })}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </Select>
                ) : (
                  <TextInput
                    type={field.type === "number" ? "number" : "text"}
                    value={input[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => setInput({ ...input, [field.key]: event.target.value })}
                  />
                )}
              </Field>
            ))
          )}

          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              icon={Play}
              busy={starting}
              disabled={streaming}
              onClick={() => void start()}
              className="flex-1"
            >
              {streaming ? "Running…" : "Run workflow"}
            </Button>
            {streaming ? (
              <Button variant="danger" icon={Ban} onClick={() => void cancel()}>
                Stop
              </Button>
            ) : null}
          </div>
        </section>

        {/* Approval gate --------------------------------------------- */}
        {run?.pendingApproval ? (
          <ApprovalPrompt runId={run.id} approval={run.pendingApproval} />
        ) : null}

        {/* Node trace ------------------------------------------------ */}
        {run ? (
          <section className="px-2 py-2">
            {run.nodeRuns.map((nodeRun) => (
              <NodeTrace
                key={nodeRun.nodeId}
                nodeRun={nodeRun}
                live={runtime[nodeRun.nodeId] ?? null}
                open={openNodeId === nodeRun.nodeId}
                showCosts={showCosts}
                onToggle={() =>
                  setOpenNodeId(openNodeId === nodeRun.nodeId ? null : nodeRun.nodeId)
                }
              />
            ))}
          </section>
        ) : null}

        {/* Result ---------------------------------------------------- */}
        {run && run.status !== "running" && run.output ? (
          <section className="border-t border-line px-4 py-4">
            <h3 className="label-text">Result</h3>
            <Markdown source={run.output} className="text-[13px] text-ink" />
          </section>
        ) : null}

        {run?.error ? (
          <section className="border-t border-line bg-[#2a1418] px-4 py-3">
            <h3 className="label-text text-danger">Run failed</h3>
            <p className="text-[12.5px] leading-relaxed text-danger">{run.error}</p>
          </section>
        ) : null}
      </div>

      {run ? <RunFooter run={run} showCosts={showCosts} /> : null}
    </aside>
  );
}

function RunFooter({ run, showCosts }: { run: Run; showCosts: boolean }) {
  return (
    <footer className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-ink-faint">
      <span>{formatDuration(run.startedAt, run.finishedAt)}</span>
      <span>{formatTokens(run.usage)} tokens</span>
      {showCosts ? <span className="ml-auto text-ink-muted">{formatCost(run.costUsd)}</span> : null}
    </footer>
  );
}

function ApprovalPrompt({
  runId,
  approval,
}: {
  runId: string;
  approval: NonNullable<Run["pendingApproval"]>;
}) {
  const [draft, setDraft] = useState(approval.preview);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => setDraft(approval.preview), [approval.preview]);

  const decide = async (approved: boolean) => {
    setBusy(true);
    try {
      await api.decideApproval(runId, {
        approved,
        payload: approval.allowEdit ? draft : undefined,
        comment: approved ? "" : "Rejected by reviewer",
      });
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not submit the decision.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-b border-line bg-[#241d10] px-4 py-3.5">
      <h3 className="mb-1 text-[13px] font-semibold text-human">{approval.title}</h3>
      <p className="mb-2.5 text-[12px] leading-relaxed text-ink-muted">{approval.instructions}</p>
      {approval.allowEdit ? (
        <TextArea
          rows={10}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mb-2.5"
        />
      ) : (
        <div className="mb-2.5 max-h-64 overflow-y-auto rounded-lg border border-line bg-ground p-3 text-[12.5px] leading-relaxed text-ink">
          <Markdown source={approval.preview} />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="primary" busy={busy} onClick={() => void decide(true)} className="flex-1">
          Approve and continue
        </Button>
        <Button variant="danger" busy={busy} onClick={() => void decide(false)}>
          Reject
        </Button>
      </div>
    </section>
  );
}

function NodeTrace({
  nodeRun,
  live,
  open,
  showCosts,
  onToggle,
}: {
  nodeRun: NodeRun;
  live: { text: string; thinking: string; toolNames: string[] } | null;
  open: boolean;
  showCosts: boolean;
  onToggle: () => void;
}) {
  const meta = NODE_KINDS[nodeRun.kind];
  const Icon = meta.icon;
  const text = nodeRun.output || live?.text || "";
  const thinking = nodeRun.thinking || live?.thinking || "";
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep the newest tokens in view while a node streams.
  const isStreaming = nodeRun.status === "running";
  useEffect(() => {
    if (open && isStreaming && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [open, isStreaming, text, thinking]);

  const toolNames = nodeRun.toolCalls.length
    ? nodeRun.toolCalls.map((call) => call.name)
    : (live?.toolNames ?? []);

  return (
    <div className="mb-1 rounded-lg border border-line-soft">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-raised"
      >
        <ChevronRight
          size={12}
          className={cx("shrink-0 text-ink-faint transition-transform", open && "rotate-90")}
        />
        <Icon size={12} className="shrink-0" style={{ color: meta.color }} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{nodeRun.name}</span>
        {toolNames.length ? (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-faint">
            <Wrench size={9} />
            {toolNames.length}
          </span>
        ) : null}
        {showCosts && nodeRun.costUsd > 0 ? (
          <span className="shrink-0 text-[10px] text-ink-faint">{formatCost(nodeRun.costUsd)}</span>
        ) : null}
        <span
          className={cx(
            "shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase",
            nodeTone(nodeRun.status),
          )}
        >
          {NODE_STATUS_LABEL[nodeRun.status]}
        </span>
      </button>

      {open ? (
        <div ref={bodyRef} className="max-h-[420px] overflow-y-auto border-t border-line-soft px-3 py-2.5">
          {nodeRun.error ? (
            <p className="mb-2 rounded-md bg-[#2a1418] px-2.5 py-2 text-[12px] leading-relaxed text-danger">
              {nodeRun.error}
            </p>
          ) : null}

          {nodeRun.logs.length ? (
            <div className="mb-2.5">
              {nodeRun.logs.map((entry, index) => (
                <p
                  key={index}
                  className={cx(
                    "font-mono text-[10.5px] leading-relaxed",
                    entry.level === "error"
                      ? "text-danger"
                      : entry.level === "warn"
                        ? "text-human"
                        : "text-ink-faint",
                  )}
                >
                  {entry.message}
                </p>
              ))}
            </div>
          ) : null}

          {thinking ? (
            <details className="mb-2.5 rounded-md border border-line-soft bg-ground p-2">
              <summary className="cursor-pointer text-[11px] text-ink-faint">
                <Sparkles size={10} className="mr-1 inline" />
                Thinking
              </summary>
              <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-muted">
                {thinking}
              </p>
            </details>
          ) : null}

          {nodeRun.toolCalls.map((call) => (
            <details key={call.id} className="mb-1.5 rounded-md border border-line-soft bg-ground p-2">
              <summary className="cursor-pointer text-[11px]">
                <CircleDot
                  size={9}
                  className={cx("mr-1 inline", call.isError ? "text-danger" : "text-ok")}
                />
                <span className="font-mono text-ink">{call.name}</span>
                <span className="ml-1.5 text-ink-faint">
                  {call.source} · {call.durationMs}ms
                </span>
              </summary>
              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-ink-muted">
                {JSON.stringify(call.input, null, 2)}
              </pre>
              <pre className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap break-words border-t border-line-soft pt-1.5 font-mono text-[10.5px] leading-relaxed text-ink-muted">
                {call.output}
              </pre>
            </details>
          ))}

          {nodeRun.citations.length ? (
            <div className="mb-2.5">
              <p className="label-text">
                <Quote size={9} className="mr-1 inline" />
                Sources
              </p>
              {nodeRun.citations.map((citation, index) => (
                <div
                  key={citation.chunkId}
                  className="mb-1 rounded-md border border-line-soft bg-ground px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 text-[10.5px] text-ink-faint">
                    <Badge>S{index + 1}</Badge>
                    <span className="truncate">{citation.documentTitle}</span>
                    <span className="ml-auto shrink-0">{citation.score.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-muted">
                    {citation.text}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {text ? (
            <div className="text-[12.5px] text-ink">
              <Markdown source={text} />
              {isStreaming ? <span className="stream-caret" /> : null}
            </div>
          ) : isStreaming ? (
            <p className="text-[12px] text-ink-faint">Waiting for the first token…</p>
          ) : nodeRun.status === "skipped" ? (
            <p className="text-[12px] text-ink-faint">
              Skipped - the router sent the run down another branch.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Load an existing run into the builder overlay, e.g. from the Runs page. */
export function useLoadRun() {
  return useCallback(async (runId: string) => {
    const { run, active } = await api.getRun(runId);
    useBuilder.setState({
      run,
      streaming: active,
      runtime: Object.fromEntries(
        run.nodeRuns.map((nodeRun) => [
          nodeRun.nodeId,
          {
            status: nodeRun.status,
            text: nodeRun.output,
            thinking: nodeRun.thinking,
            toolNames: nodeRun.toolCalls.map((call) => call.name),
            selectedRoute: nodeRun.selectedRoute,
            costUsd: nodeRun.costUsd,
          },
        ]),
      ),
    });
  }, []);
}
