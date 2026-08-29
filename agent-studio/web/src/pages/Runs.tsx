import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExternalLink, History, Trash2 } from "lucide-react";
import type { Run, RunSummary } from "@studio/shared";
import { api } from "../lib/api.ts";
import {
  NODE_STATUS_LABEL,
  RUN_STATUS_LABEL,
  formatCost,
  formatDuration,
  formatRelative,
  formatTokens,
  nodeTone,
  runTone,
} from "../lib/format.ts";
import { NODE_KINDS } from "../lib/nodeKinds.ts";
import Markdown from "../components/Markdown.tsx";
import { Button, EmptyState, Spinner, cx, useToast } from "../components/ui.tsx";

export default function RunsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [detail, setDetail] = useState<Run | null>(null);

  const load = useCallback(async () => {
    setRuns(await api.listRuns());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id) {
      setDetail(null);
      return;
    }
    api
      .getRun(id)
      .then(({ run }) => setDetail(run))
      .catch(() => toast("error", "That run no longer exists."));
  }, [id, toast]);

  const remove = async (runId: string) => {
    await api.deleteRun(runId);
    if (id === runId) navigate("/runs");
    void load();
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Runs</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Every execution, with the full trace: prompts, tool calls, sources, tokens and cost.
        </p>
      </header>

      {detail ? (
        <RunDetail run={detail} onBack={() => navigate("/runs")} />
      ) : runs === null ? (
        <Spinner />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No runs yet"
          description="Open a workflow and hit Run. Everything that happens gets recorded here."
          action={
            <Link to="/workflows">
              <Button variant="primary">Go to workflows</Button>
            </Link>
          }
        />
      ) : (
        <div className="panel divide-y divide-line-soft">
          {runs.map((run) => (
            <div key={run.id} className="group flex items-center gap-4 px-4 py-2.5 hover:bg-raised">
              <button
                onClick={() => navigate(`/runs/${run.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={cx(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    runTone(run.status),
                  )}
                >
                  {RUN_STATUS_LABEL[run.status]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{run.workflowName}</span>
                  {run.error ? (
                    <span className="block truncate text-[11.5px] text-danger">{run.error}</span>
                  ) : (
                    <span className="block text-[11.5px] text-ink-faint">
                      {run.nodeCount} nodes · {formatRelative(run.startedAt)}
                    </span>
                  )}
                </span>
              </button>

              <div className="hidden shrink-0 gap-5 text-right text-[11px] text-ink-faint sm:flex">
                <span className="w-16">{formatDuration(run.startedAt, run.finishedAt)}</span>
                <span className="w-16">{formatTokens(run.usage)} tok</span>
                <span className="w-16 text-ink-muted">{formatCost(run.costUsd)}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => void remove(run.id)}
                aria-label="Delete run"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunDetail({ run, onBack }: { run: Run; onBack: () => void }) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Button size="sm" onClick={onBack}>
          All runs
        </Button>
        <span
          className={cx(
            "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            runTone(run.status),
          )}
        >
          {RUN_STATUS_LABEL[run.status]}
        </span>
        <h2 className="text-[15px] font-semibold text-ink">{run.workflowName}</h2>
        <Link
          to={`/workflows/${run.workflowId}`}
          className="flex items-center gap-1 text-[12px] text-accent hover:underline"
        >
          Open workflow <ExternalLink size={11} />
        </Link>
        <div className="ml-auto flex gap-5 text-[12px] text-ink-faint">
          <span>{formatDuration(run.startedAt, run.finishedAt)}</span>
          <span>{formatTokens(run.usage)} tokens</span>
          <span className="text-ink-muted">{formatCost(run.costUsd)}</span>
        </div>
      </div>

      {run.error ? (
        <div className="mb-5 rounded-lg border border-[#5a2029] bg-[#2a1418] px-4 py-3 text-[13px] text-danger">
          {run.error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel p-5">
          <h3 className="label-text">Result</h3>
          {run.output ? (
            <Markdown source={run.output} className="text-[13px] text-ink" />
          ) : (
            <p className="text-[13px] text-ink-faint">This run produced no output.</p>
          )}
        </div>

        <div>
          <div className="panel mb-4 p-4">
            <h3 className="label-text">Input</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-muted">
              {JSON.stringify(run.input, null, 2)}
            </pre>
          </div>

          <div className="panel divide-y divide-line-soft">
            {run.nodeRuns.map((nodeRun) => {
              const meta = NODE_KINDS[nodeRun.kind];
              const Icon = meta.icon;
              return (
                <details key={nodeRun.nodeId} className="px-3 py-2">
                  <summary className="flex cursor-pointer items-center gap-2">
                    <Icon size={12} style={{ color: meta.color }} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {nodeRun.name}
                    </span>
                    {nodeRun.costUsd > 0 ? (
                      <span className="text-[10px] text-ink-faint">
                        {formatCost(nodeRun.costUsd)}
                      </span>
                    ) : null}
                    <span
                      className={cx(
                        "rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase",
                        nodeTone(nodeRun.status),
                      )}
                    >
                      {NODE_STATUS_LABEL[nodeRun.status]}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    {nodeRun.error ? (
                      <p className="text-[12px] text-danger">{nodeRun.error}</p>
                    ) : null}
                    {nodeRun.input ? (
                      <div>
                        <p className="label-text">Sent</p>
                        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-faint">
                          {nodeRun.input}
                        </pre>
                      </div>
                    ) : null}
                    {nodeRun.toolCalls.length ? (
                      <div>
                        <p className="label-text">{nodeRun.toolCalls.length} tool calls</p>
                        {nodeRun.toolCalls.map((call) => (
                          <p key={call.id} className="font-mono text-[11px] text-ink-muted">
                            {call.isError ? "✗" : "✓"} {call.name} · {call.durationMs}ms
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {nodeRun.output ? (
                      <div>
                        <p className="label-text">Output</p>
                        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-muted">
                          {nodeRun.output}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
