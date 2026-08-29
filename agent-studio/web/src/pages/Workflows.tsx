import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Copy, Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { api, type TemplateSummary, type WorkflowSummary } from "../lib/api.ts";
import { formatRelative } from "../lib/format.ts";
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  SectionTitle,
  Spinner,
  TextInput,
  useToast,
} from "../components/ui.tsx";

const REQUIREMENT_LABEL = {
  knowledge: "Needs a knowledge base",
  mcp: "Needs an MCP server",
  web: "Uses web search",
} as const;

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [creating, setCreating] = useState<TemplateSummary | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [list, gallery] = await Promise.all([api.listWorkflows(), api.listTemplates()]);
    setWorkflows(list);
    setTemplates(gallery);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!creating) return;
    setBusy(true);
    try {
      const workflow = await api.createWorkflow(creating.id, name.trim() || undefined);
      navigate(`/workflows/${workflow.id}`);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not create the workflow.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (workflow: WorkflowSummary) => {
    if (!confirm(`Delete "${workflow.name}"? Its run history stays.`)) return;
    await api.deleteWorkflow(workflow.id);
    toast("ok", `Deleted "${workflow.name}".`);
    void load();
  };

  const duplicate = async (workflow: WorkflowSummary) => {
    const copy = await api.duplicateWorkflow(workflow.id);
    navigate(`/workflows/${copy.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-ink">Workflows</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Wire Claude agents together with retrieval, routing, tools and human review.
        </p>
      </header>

      <section className="mb-10">
        <SectionTitle>Start from a template</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                setCreating(template);
                setName(template.name);
              }}
              className="panel group flex flex-col items-start p-4 text-left transition-colors hover:border-[#3a4152] hover:bg-raised"
            >
              <span className="mb-2 text-xl">{template.icon}</span>
              <span className="text-[13px] font-semibold text-ink">{template.name}</span>
              <span className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink-muted">
                {template.description}
              </span>
              <span className="mt-3 flex flex-wrap gap-1">
                <Badge>{template.nodeCount} nodes</Badge>
                {template.requires.map((requirement) => (
                  <Badge key={requirement} tone="warn">
                    {REQUIREMENT_LABEL[requirement]}
                  </Badge>
                ))}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                const blank = templates.find((template) => template.id === "blank") ?? templates[0];
                if (blank) {
                  setCreating(blank);
                  setName("Untitled workflow");
                }
              }}
            >
              New workflow
            </Button>
          }
        >
          Your workflows
        </SectionTitle>

        {workflows === null ? (
          <Spinner />
        ) : workflows.length === 0 ? (
          <EmptyState
            icon={WorkflowIcon}
            title="No workflows yet"
            description="Pick a template above, or start from a blank canvas and drop in your first agent."
          />
        ) : (
          <div className="panel divide-y divide-line-soft">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-raised"
              >
                <button
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium text-ink">
                      {workflow.name}
                    </span>
                    {workflow.agentCount > 0 ? (
                      <Badge tone="accent">
                        <Bot size={10} />
                        {workflow.agentCount}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                    {workflow.description || "No description"}
                  </p>
                </button>

                <div className="hidden shrink-0 text-right text-[11px] text-ink-faint sm:block">
                  <div>{workflow.nodeCount} nodes</div>
                  <div>edited {formatRelative(workflow.updatedAt)}</div>
                </div>

                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void duplicate(workflow)}
                    aria-label="Duplicate"
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void remove(workflow)}
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(creating)}
        onClose={() => setCreating(null)}
        title={`New workflow from "${creating?.name ?? ""}"`}
        description={creating?.description}
        footer={
          <>
            <Button onClick={() => setCreating(null)}>Cancel</Button>
            <Button variant="primary" busy={busy} onClick={() => void create()}>
              Create and open
            </Button>
          </>
        }
      >
        <label className="label-text">Name</label>
        <TextInput
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void create();
          }}
        />
        {creating?.requires.length ? (
          <p className="mt-3 rounded-lg border border-[#5a4520] bg-[#241d10] px-3 py-2 text-[12px] leading-relaxed text-human">
            This template expects{" "}
            {creating.requires.map((requirement) => REQUIREMENT_LABEL[requirement]).join(" and ")}.
            You can create the workflow now and attach resources on the agent nodes afterwards.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
