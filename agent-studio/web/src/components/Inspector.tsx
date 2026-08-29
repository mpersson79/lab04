import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  EFFORT_LEVELS,
  INPUT_FIELD_TYPES,
  type InputField,
  type ModelInfo,
  type NodeKind,
  type Route,
  type WorkflowNode,
} from "@studio/shared";
import { useBuilder } from "../lib/builder.ts";
import { useWorkspace } from "../lib/workspace.ts";
import { NODE_KINDS } from "../lib/nodeKinds.ts";
import {
  Badge,
  Button,
  Field,
  Select,
  TextArea,
  TextInput,
  Toggle,
  cx,
} from "./ui.tsx";

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Section({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line-soft last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-raised"
      >
        <ChevronDown
          size={13}
          className={cx("text-ink-faint transition-transform", !open && "-rotate-90")}
        />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {title}
        </span>
        {badge}
      </button>
      {open ? <div className="px-4 pb-4 pt-1">{children}</div> : null}
    </section>
  );
}

function CheckList({
  items,
  selected,
  onChange,
  empty,
}: {
  items: Array<{ id: string; label: string; hint?: string; disabled?: boolean }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: ReactNode;
}) {
  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-faint">
        {empty}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-ground p-1">
      {items.map((item) => {
        const checked = selected.includes(item.id);
        return (
          <label
            key={item.id}
            className={cx(
              "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-hover",
              item.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={item.disabled}
              onChange={() =>
                onChange(
                  checked ? selected.filter((id) => id !== item.id) : [...selected, item.id],
                )
              }
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
            />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] leading-tight text-ink">
                {item.label}
              </span>
              {item.hint ? (
                <span className="block truncate text-[10.5px] text-ink-faint">{item.hint}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-ground p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "flex-1 rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors",
            value === option.value
              ? "bg-hover text-ink"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function KeyValueEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const entries = Object.entries(value);
  const update = (index: number, key: string, entryValue: string) => {
    const next = entries.map((entry, i) => (i === index ? [key, entryValue] : entry));
    onChange(Object.fromEntries(next.filter(([k]) => k)));
  };
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([key, entryValue], index) => (
        <div key={index} className="flex gap-1.5">
          <TextInput
            value={key}
            placeholder="header"
            onChange={(event) => update(index, event.target.value, entryValue)}
            className="flex-1"
          />
          <TextInput
            value={entryValue}
            placeholder="value"
            onChange={(event) => update(index, key, event.target.value)}
            className="flex-[1.4]"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(Object.fromEntries(entries.filter((_, i) => i !== index)))}
            aria-label="Remove header"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        icon={Plus}
        onClick={() => onChange({ ...value, "": "" })}
        className="self-start"
      >
        Add header
      </Button>
    </div>
  );
}

const TEMPLATE_HINT = (
  <>
    Templates support <code className="text-ink-muted">{"{{input}}"}</code>,{" "}
    <code className="text-ink-muted">{"{{input.field}}"}</code> and{" "}
    <code className="text-ink-muted">{"{{nodes.<id>.output}}"}</code>.
  </>
);

/* ------------------------------------------------------------------ */
/* Inspector                                                           */
/* ------------------------------------------------------------------ */

export default function Inspector() {
  const workflow = useBuilder((state) => state.workflow);
  const selectedNodeId = useBuilder((state) => state.selectedNodeId);
  const issues = useBuilder((state) => state.issues);
  const { updateNode, updateNodeConfig, removeNode, select } = useBuilder.getState();

  const node = workflow?.nodes.find((candidate) => candidate.id === selectedNodeId) ?? null;
  const nodeIssues = useMemo(
    () => issues.filter((issue) => issue.nodeId === selectedNodeId),
    [issues, selectedNodeId],
  );

  if (!node) {
    return (
      <aside className="flex w-[330px] shrink-0 flex-col items-center justify-center border-l border-line bg-surface px-8 text-center">
        <p className="text-[13px] text-ink-muted">Select a node to configure it.</p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Drag from the palette to add one, then connect the handles on either side to set the
          order things run in.
        </p>
      </aside>
    );
  }

  const meta = NODE_KINDS[node.kind];
  const Icon = meta.icon;

  return (
    <aside className="flex w-[330px] shrink-0 flex-col border-l border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{
              background: "color-mix(in srgb, currentColor 15%, transparent)",
              color: meta.color,
            }}
          >
            <Icon size={12} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {meta.label}
          </span>
          <code className="ml-auto rounded bg-hover px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
            {node.id}
          </code>
        </div>
        <TextInput
          value={node.name}
          onChange={(event) => updateNode(node.id, { name: event.target.value })}
          className="font-medium"
        />
      </header>

      {nodeIssues.length ? (
        <div className="border-b border-line bg-[#2a1418] px-4 py-2.5">
          {nodeIssues.map((issue, index) => (
            <p
              key={index}
              className={cx(
                "flex items-start gap-1.5 text-[11.5px] leading-snug",
                issue.level === "error" ? "text-danger" : "text-human",
              )}
            >
              <TriangleAlert size={11} className="mt-0.5 shrink-0" />
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <NodeEditor node={node} onConfig={(patch) => updateNodeConfig(node.id, patch)} />

        <Section title="Notes" defaultOpen={false}>
          <TextArea
            rows={3}
            value={node.notes}
            placeholder="Why this node exists, what you tried, what to watch for."
            onChange={(event) => updateNode(node.id, { notes: event.target.value })}
          />
        </Section>
      </div>

      <footer className="border-t border-line px-4 py-3">
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          className="w-full"
          onClick={() => {
            removeNode(node.id);
            select(null);
          }}
        >
          Delete node
        </Button>
      </footer>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Per-kind editors                                                    */
/* ------------------------------------------------------------------ */

function NodeEditor({
  node,
  onConfig,
}: {
  node: WorkflowNode;
  onConfig: (patch: Record<string, unknown>) => void;
}) {
  switch (node.kind) {
    case "input":
      return <InputEditor node={node} onConfig={onConfig} />;
    case "agent":
      return <AgentEditor node={node} onConfig={onConfig} />;
    case "knowledge":
      return <KnowledgeEditor node={node} onConfig={onConfig} />;
    case "router":
      return <RouterEditor node={node} onConfig={onConfig} />;
    case "code":
      return <CodeEditor node={node} onConfig={onConfig} />;
    case "http":
      return <HttpEditor node={node} onConfig={onConfig} />;
    case "approval":
      return <ApprovalEditor node={node} onConfig={onConfig} />;
    case "output":
      return <OutputEditor node={node} onConfig={onConfig} />;
  }
}

type EditorProps<K extends NodeKind> = {
  node: Extract<WorkflowNode, { kind: K }>;
  onConfig: (patch: Record<string, unknown>) => void;
};

function InputEditor({ node, onConfig }: EditorProps<"input">) {
  const fields = node.config.fields;
  const setFields = (next: InputField[]) => onConfig({ fields: next });

  return (
    <Section title="Input fields">
      <p className="mb-3 text-[11.5px] leading-relaxed text-ink-faint">
        These become the form shown when you run the workflow, and are readable downstream as{" "}
        <code className="text-ink-muted">{"{{input.<key>}}"}</code>.
      </p>

      {fields.map((field, index) => (
        <div key={index} className="mb-2 rounded-lg border border-line bg-ground p-2.5">
          <div className="mb-2 flex gap-1.5">
            <TextInput
              value={field.key}
              placeholder="key"
              onChange={(event) =>
                setFields(
                  fields.map((f, i) =>
                    i === index
                      ? { ...f, key: event.target.value.replace(/[^a-z0-9_]/g, "_") }
                      : f,
                  ),
                )
              }
              className="flex-1 font-mono text-[11.5px]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFields(fields.filter((_, i) => i !== index))}
              aria-label="Remove field"
            >
              <Trash2 size={13} />
            </Button>
          </div>
          <TextInput
            value={field.label}
            placeholder="Label shown in the run form"
            onChange={(event) =>
              setFields(fields.map((f, i) => (i === index ? { ...f, label: event.target.value } : f)))
            }
            className="mb-2"
          />
          <div className="mb-2 flex gap-1.5">
            <Select
              value={field.type}
              onChange={(event) =>
                setFields(
                  fields.map((f, i) =>
                    i === index ? { ...f, type: event.target.value as InputField["type"] } : f,
                  ),
                )
              }
            >
              {INPUT_FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <Toggle
            checked={field.required}
            onChange={(required) =>
              setFields(fields.map((f, i) => (i === index ? { ...f, required } : f)))
            }
            label="Required"
          />
          <TextInput
            value={field.defaultValue}
            placeholder="Default value"
            onChange={(event) =>
              setFields(
                fields.map((f, i) => (i === index ? { ...f, defaultValue: event.target.value } : f)),
              )
            }
          />
        </div>
      ))}

      <Button
        size="sm"
        icon={Plus}
        onClick={() =>
          setFields([
            ...fields,
            {
              key: `field_${fields.length + 1}`,
              label: `Field ${fields.length + 1}`,
              type: "text",
              required: false,
              placeholder: "",
              defaultValue: "",
            },
          ])
        }
      >
        Add field
      </Button>
    </Section>
  );
}

function ModelPicker({
  value,
  models,
  onChange,
}: {
  value: string;
  models: ModelInfo[];
  onChange: (id: string) => void;
}) {
  const selected = models.find((model) => model.id === value);
  return (
    <Field label="Model" hint={selected?.blurb}>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label} — ${model.inputPerMTok}/${model.outputPerMTok} per Mtok
          </option>
        ))}
        {selected ? null : <option value={value}>{value} (unknown)</option>}
      </Select>
    </Field>
  );
}

function AgentEditor({ node, onConfig }: EditorProps<"agent">) {
  const config = node.config;
  const { models, knowledgeBases, mcpServers, tools } = useWorkspace();
  const model = models.find((candidate) => candidate.id === config.model);

  return (
    <>
      <Section title="Prompt">
        <Field label="System prompt" hint="Who this agent is and the rules it works under.">
          <TextArea
            rows={5}
            value={config.systemPrompt}
            onChange={(event) => onConfig({ systemPrompt: event.target.value })}
          />
        </Field>
        <Field label="User message" hint={TEMPLATE_HINT}>
          <TextArea
            rows={4}
            value={config.prompt}
            onChange={(event) => onConfig({ prompt: event.target.value })}
          />
        </Field>
      </Section>

      <Section title="Model and reasoning">
        <ModelPicker
          value={config.model}
          models={models}
          onChange={(id) => onConfig({ model: id })}
        />

        {model?.supportsAdaptiveThinking ? (
          <>
            <Field label="Thinking">
              <Segmented
                value={config.thinking}
                onChange={(thinking) => onConfig({ thinking })}
                options={[
                  { value: "adaptive", label: "Adaptive" },
                  { value: "off", label: "Off" },
                ]}
              />
            </Field>
            {config.thinking === "adaptive" ? (
              <Toggle
                checked={config.showThinking}
                onChange={(showThinking) => onConfig({ showThinking })}
                label="Stream a thinking summary"
                hint="Shown in the run panel. Reasoning is billed either way."
              />
            ) : null}
          </>
        ) : (
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-faint">
            {model?.label ?? "This model"} does not support adaptive thinking, so this node runs
            without it.
          </p>
        )}

        {model?.supportsEffort ? (
          <Field
            label="Effort"
            hint="How much thinking and how many tool calls the model spends. Lower is cheaper and faster."
          >
            <Select
              value={config.effort}
              onChange={(event) => onConfig({ effort: event.target.value })}
            >
              {EFFORT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="flex gap-2">
          <Field label="Max tokens" className="flex-1">
            <TextInput
              type="number"
              min={256}
              max={model?.maxOutputTokens ?? 128_000}
              value={config.maxTokens}
              onChange={(event) => onConfig({ maxTokens: Number(event.target.value) || 4_000 })}
            />
          </Field>
          <Field label="Max tool loops" className="flex-1">
            <TextInput
              type="number"
              min={1}
              max={30}
              value={config.maxIterations}
              onChange={(event) => onConfig({ maxIterations: Number(event.target.value) || 8 })}
            />
          </Field>
        </div>

        <Toggle
          checked={config.cachePrompt}
          onChange={(cachePrompt) => onConfig({ cachePrompt })}
          label="Cache the system prompt"
          hint="Cheaper from the second run onward when the prompt is stable."
        />
      </Section>

      <Section
        title="Knowledge"
        badge={
          config.knowledge.mode !== "off" && config.knowledge.baseIds.length ? (
            <Badge tone="accent">{config.knowledge.baseIds.length}</Badge>
          ) : null
        }
      >
        <Field label="Retrieval mode">
          <Segmented
            value={config.knowledge.mode}
            onChange={(mode) => onConfig({ knowledge: { ...config.knowledge, mode } })}
            options={[
              { value: "off", label: "Off" },
              { value: "inject", label: "Inject" },
              { value: "tool", label: "Agentic" },
            ]}
          />
        </Field>
        <p className="mb-3 text-[11.5px] leading-relaxed text-ink-faint">
          {config.knowledge.mode === "inject"
            ? "One search runs before the first turn and the passages go into the system prompt. Predictable and cheap."
            : config.knowledge.mode === "tool"
              ? "The agent gets a search_knowledge tool and decides when and what to look up. Better for multi-hop questions."
              : "This agent will not touch your knowledge bases."}
        </p>

        {config.knowledge.mode !== "off" ? (
          <>
            <Field label="Knowledge bases">
              <CheckList
                items={knowledgeBases.map((base) => ({
                  id: base.id,
                  label: base.name,
                  hint: `${base.documentCount} docs · ${base.chunkCount} chunks`,
                }))}
                selected={config.knowledge.baseIds}
                onChange={(baseIds) => onConfig({ knowledge: { ...config.knowledge, baseIds } })}
                empty="No knowledge bases yet. Create one on the Knowledge page and it will show up here."
              />
            </Field>
            <div className="flex gap-2">
              <Field label="Top K" className="flex-1">
                <TextInput
                  type="number"
                  min={1}
                  max={50}
                  value={config.knowledge.topK}
                  onChange={(event) =>
                    onConfig({
                      knowledge: { ...config.knowledge, topK: Number(event.target.value) || 6 },
                    })
                  }
                />
              </Field>
              <Field label="Min score" className="flex-1">
                <TextInput
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={config.knowledge.minScore}
                  onChange={(event) =>
                    onConfig({
                      knowledge: { ...config.knowledge, minScore: Number(event.target.value) },
                    })
                  }
                />
              </Field>
            </div>
          </>
        ) : null}
      </Section>

      <Section
        title="Tools"
        badge={
          config.toolIds.length + config.mcpServerIds.length ? (
            <Badge tone="accent">{config.toolIds.length + config.mcpServerIds.length}</Badge>
          ) : null
        }
      >
        <Field label="MCP servers">
          <CheckList
            items={mcpServers.map((server) => ({
              id: server.id,
              label: server.name,
              hint:
                server.status === "ok"
                  ? `${server.tools.length} tools · ${server.executionMode}`
                  : server.statusMessage || "not reachable",
              disabled: !server.enabled,
            }))}
            selected={config.mcpServerIds}
            onChange={(mcpServerIds) => onConfig({ mcpServerIds })}
            empty="No MCP servers registered. Add one on the MCP servers page."
          />
        </Field>

        <Field label="Workspace tools">
          <CheckList
            items={tools.map((tool) => ({
              id: tool.id,
              label: tool.name,
              hint: tool.description.slice(0, 60),
            }))}
            selected={config.toolIds}
            onChange={(toolIds) => onConfig({ toolIds })}
            empty="No workspace tools yet. Define HTTP or code tools on the Tools page."
          />
        </Field>

        <div className="mt-3">
          <span className="label-text">Anthropic server tools</span>
          <Toggle
            checked={config.serverTools.webSearch}
            onChange={(webSearch) =>
              onConfig({ serverTools: { ...config.serverTools, webSearch } })
            }
            label="Web search"
            hint="Runs on Anthropic's infrastructure. Billed per search."
          />
          <Toggle
            checked={config.serverTools.webFetch}
            onChange={(webFetch) => onConfig({ serverTools: { ...config.serverTools, webFetch } })}
            label="Web fetch"
            hint="Reads URLs already present in the conversation."
          />
          <Toggle
            checked={config.serverTools.codeExecution}
            onChange={(codeExecution) =>
              onConfig({ serverTools: { ...config.serverTools, codeExecution } })
            }
            label="Code execution"
            hint="A Python sandbox for calculation and data work."
          />
          {config.serverTools.webSearch ? (
            <Field label="Max searches">
              <TextInput
                type="number"
                min={1}
                max={20}
                value={config.serverTools.maxWebSearches}
                onChange={(event) =>
                  onConfig({
                    serverTools: {
                      ...config.serverTools,
                      maxWebSearches: Number(event.target.value) || 5,
                    },
                  })
                }
              />
            </Field>
          ) : null}
        </div>
      </Section>

      <Section title="Output" defaultOpen={false}>
        <Field label="Format">
          <Segmented
            value={config.output.mode}
            onChange={(mode) => onConfig({ output: { ...config.output, mode } })}
            options={[
              { value: "text", label: "Text" },
              { value: "json", label: "JSON schema" },
            ]}
          />
        </Field>
        {config.output.mode === "json" ? (
          <Field
            label="JSON schema"
            hint="Enforced with structured outputs. Downstream nodes can read fields as {{nodes.<id>.data.field}}."
          >
            <TextArea
              rows={8}
              value={config.output.jsonSchema}
              placeholder={'{\n  "type": "object",\n  "properties": {\n    "summary": { "type": "string" }\n  },\n  "required": ["summary"]\n}'}
              onChange={(event) =>
                onConfig({ output: { ...config.output, jsonSchema: event.target.value } })
              }
              className="font-mono text-[11.5px]"
            />
          </Field>
        ) : null}
      </Section>
    </>
  );
}

function KnowledgeEditor({ node, onConfig }: EditorProps<"knowledge">) {
  const { knowledgeBases } = useWorkspace();
  return (
    <Section title="Retrieval">
      <Field label="Knowledge bases">
        <CheckList
          items={knowledgeBases.map((base) => ({
            id: base.id,
            label: base.name,
            hint: `${base.documentCount} docs · ${base.chunkCount} chunks`,
          }))}
          selected={node.config.baseIds}
          onChange={(baseIds) => onConfig({ baseIds })}
          empty="No knowledge bases yet. Create one on the Knowledge page."
        />
      </Field>
      <Field label="Query" hint={TEMPLATE_HINT}>
        <TextArea
          rows={3}
          value={node.config.query}
          onChange={(event) => onConfig({ query: event.target.value })}
        />
      </Field>
      <div className="flex gap-2">
        <Field label="Top K" className="flex-1">
          <TextInput
            type="number"
            min={1}
            max={50}
            value={node.config.topK}
            onChange={(event) => onConfig({ topK: Number(event.target.value) || 8 })}
          />
        </Field>
        <Field label="Min score" className="flex-1">
          <TextInput
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={node.config.minScore}
            onChange={(event) => onConfig({ minScore: Number(event.target.value) })}
          />
        </Field>
      </div>
      <Toggle
        checked={node.config.includeCitations}
        onChange={(includeCitations) => onConfig({ includeCitations })}
        label="Number the passages"
        hint="Emits [S1], [S2] markers a downstream agent can cite."
      />
    </Section>
  );
}

function RouterEditor({ node, onConfig }: EditorProps<"router">) {
  const { models } = useWorkspace();
  const config = node.config;
  const setRoutes = (routes: Route[]) => onConfig({ routes });

  return (
    <>
      <Section title="Decision">
        <Field label="Mode">
          <Segmented
            value={config.mode}
            onChange={(mode) => onConfig({ mode })}
            options={[
              { value: "llm", label: "Classifier" },
              { value: "expression", label: "Expression" },
            ]}
          />
        </Field>

        {config.mode === "llm" ? (
          <>
            <ModelPicker
              value={config.model}
              models={models}
              onChange={(id) => onConfig({ model: id })}
            />
            <Field label="Instructions">
              <TextArea
                rows={3}
                value={config.instructions}
                onChange={(event) => onConfig({ instructions: event.target.value })}
              />
            </Field>
            <Field label="What to classify" hint={TEMPLATE_HINT}>
              <TextArea
                rows={2}
                value={config.prompt}
                onChange={(event) => onConfig({ prompt: event.target.value })}
              />
            </Field>
          </>
        ) : (
          <Field
            label="Expression"
            hint="Sandboxed JavaScript returning a route id. `input`, `text` and `nodes` are in scope."
          >
            <TextArea
              rows={3}
              value={config.expression}
              onChange={(event) => onConfig({ expression: event.target.value })}
              className="font-mono text-[11.5px]"
            />
          </Field>
        )}

        <Field label="Fallback route" hint="Used when nothing matches.">
          <Select
            value={config.fallbackRouteId}
            onChange={(event) => onConfig({ fallbackRouteId: event.target.value })}
          >
            <option value="">First route</option>
            {config.routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Routes" badge={<Badge>{config.routes.length}</Badge>}>
        <p className="mb-3 text-[11.5px] leading-relaxed text-ink-faint">
          Each route gets its own handle on the node. Wire it to whatever should run when the
          router picks it.
        </p>
        {config.routes.map((route, index) => (
          <div key={index} className="mb-2 rounded-lg border border-line bg-ground p-2.5">
            <div className="mb-2 flex gap-1.5">
              <TextInput
                value={route.id}
                placeholder="id"
                onChange={(event) =>
                  setRoutes(
                    config.routes.map((r, i) =>
                      i === index
                        ? { ...r, id: event.target.value.replace(/[^a-z0-9_-]/g, "_") }
                        : r,
                    ),
                  )
                }
                className="flex-1 font-mono text-[11.5px]"
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={config.routes.length <= 2}
                onClick={() => setRoutes(config.routes.filter((_, i) => i !== index))}
                aria-label="Remove route"
              >
                <Trash2 size={13} />
              </Button>
            </div>
            <TextInput
              value={route.label}
              placeholder="Label"
              className="mb-1.5"
              onChange={(event) =>
                setRoutes(
                  config.routes.map((r, i) =>
                    i === index ? { ...r, label: event.target.value } : r,
                  ),
                )
              }
            />
            <TextInput
              value={route.description}
              placeholder="When should the classifier pick this?"
              onChange={(event) =>
                setRoutes(
                  config.routes.map((r, i) =>
                    i === index ? { ...r, description: event.target.value } : r,
                  ),
                )
              }
            />
          </div>
        ))}
        <Button
          size="sm"
          icon={Plus}
          onClick={() =>
            setRoutes([
              ...config.routes,
              {
                id: `route_${config.routes.length + 1}`,
                label: `Route ${config.routes.length + 1}`,
                description: "",
              },
            ])
          }
        >
          Add route
        </Button>
      </Section>
    </>
  );
}

function CodeEditor({ node, onConfig }: EditorProps<"code">) {
  return (
    <Section title="JavaScript">
      <Field
        label="Body"
        hint="Runs in a sandbox with no network or filesystem. `input`, `text` and `nodes` are in scope; return the node's output."
      >
        <TextArea
          rows={14}
          value={node.config.code}
          onChange={(event) => onConfig({ code: event.target.value })}
          className="font-mono text-[11.5px]"
          spellCheck={false}
        />
      </Field>
      <Field label="Timeout (ms)">
        <TextInput
          type="number"
          min={50}
          max={30_000}
          value={node.config.timeoutMs}
          onChange={(event) => onConfig({ timeoutMs: Number(event.target.value) || 3_000 })}
        />
      </Field>
    </Section>
  );
}

function HttpEditor({ node, onConfig }: EditorProps<"http">) {
  const config = node.config;
  const sendsBody = config.method !== "GET" && config.method !== "DELETE";
  return (
    <Section title="Request">
      <div className="flex gap-2">
        <Field label="Method" className="w-24">
          <Select value={config.method} onChange={(event) => onConfig({ method: event.target.value })}>
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
              <option key={method}>{method}</option>
            ))}
          </Select>
        </Field>
        <Field label="URL" className="flex-1">
          <TextInput
            value={config.url}
            onChange={(event) => onConfig({ url: event.target.value })}
            className="font-mono text-[11.5px]"
          />
        </Field>
      </div>
      <Field
        label="Headers"
        hint="Values are templated, so secrets can come from the server environment as {{env.MY_TOKEN}}."
      >
        <KeyValueEditor value={config.headers} onChange={(headers) => onConfig({ headers })} />
      </Field>
      {sendsBody ? (
        <Field label="Body" hint={TEMPLATE_HINT}>
          <TextArea
            rows={6}
            value={config.body}
            onChange={(event) => onConfig({ body: event.target.value })}
            className="font-mono text-[11.5px]"
          />
        </Field>
      ) : null}
      <div className="flex gap-2">
        <Field label="Timeout (ms)" className="flex-1">
          <TextInput
            type="number"
            min={500}
            max={120_000}
            value={config.timeoutMs}
            onChange={(event) => onConfig({ timeoutMs: Number(event.target.value) || 20_000 })}
          />
        </Field>
      </div>
      <Toggle
        checked={config.parseJson}
        onChange={(parseJson) => onConfig({ parseJson })}
        label="Parse the response as JSON"
        hint="Downstream nodes then read fields as {{nodes.<id>.data.field}}."
      />
    </Section>
  );
}

function ApprovalEditor({ node, onConfig }: EditorProps<"approval">) {
  return (
    <Section title="Approval gate">
      <p className="mb-3 text-[11.5px] leading-relaxed text-ink-faint">
        The run pauses here until someone approves it in the run panel. Rejecting fails the run.
      </p>
      <Field label="Title">
        <TextInput
          value={node.config.title}
          onChange={(event) => onConfig({ title: event.target.value })}
        />
      </Field>
      <Field label="Instructions for the reviewer">
        <TextArea
          rows={3}
          value={node.config.instructions}
          onChange={(event) => onConfig({ instructions: event.target.value })}
        />
      </Field>
      <Field label="What to show" hint={TEMPLATE_HINT}>
        <TextArea
          rows={3}
          value={node.config.preview}
          onChange={(event) => onConfig({ preview: event.target.value })}
        />
      </Field>
      <Toggle
        checked={node.config.allowEdit}
        onChange={(allowEdit) => onConfig({ allowEdit })}
        label="Let the reviewer edit before approving"
        hint="The edited text becomes this node's output."
      />
    </Section>
  );
}

function OutputEditor({ node, onConfig }: EditorProps<"output">) {
  return (
    <Section title="Result">
      <Field label="Template" hint={TEMPLATE_HINT}>
        <TextArea
          rows={8}
          value={node.config.template}
          onChange={(event) => onConfig({ template: event.target.value })}
        />
      </Field>
      <Field label="Render as">
        <Segmented
          value={node.config.format}
          onChange={(format) => onConfig({ format })}
          options={[
            { value: "markdown", label: "Markdown" },
            { value: "text", label: "Text" },
            { value: "json", label: "JSON" },
          ]}
        />
      </Field>
    </Section>
  );
}
