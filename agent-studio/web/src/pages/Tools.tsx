import { useCallback, useEffect, useState } from "react";
import { Play, Plus, Trash2, Wrench } from "lucide-react";
import type { CustomTool } from "@studio/shared";
import { api } from "../lib/api.ts";
import { useWorkspace } from "../lib/workspace.ts";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Select,
  Spinner,
  TextArea,
  TextInput,
  cx,
  useToast,
} from "../components/ui.tsx";

interface Draft {
  name: string;
  description: string;
  kind: "http" | "code";
  inputSchema: string;
  code: string;
  method: string;
  url: string;
  headers: string;
  body: string;
}

const STARTER_SCHEMA = `{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "What to look up" }
  },
  "required": ["query"]
}`;

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  kind: "http",
  inputSchema: STARTER_SCHEMA,
  code: "return { ok: true, echo: input };",
  method: "GET",
  url: "https://api.example.com/search?q={{input.query}}",
  headers: "",
  body: "",
};

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    if (key) headers[key] = line.slice(separator + 1).trim();
  }
  return headers;
}

function stringifyHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export default function ToolsPage() {
  const toast = useToast();
  const refreshTools = useWorkspace((state) => state.refreshTools);
  const [tools, setTools] = useState<CustomTool[] | null>(null);
  const [editing, setEditing] = useState<CustomTool | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testInput, setTestInput] = useState("{}");
  const [testResult, setTestResult] = useState<{ ok: boolean; output: string } | null>(null);

  const load = useCallback(async () => {
    setTools(await api.listTools());
    void refreshTools();
  }, [refreshTools]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setTestResult(null);
    setOpen(true);
  };

  const startEdit = (tool: CustomTool) => {
    setEditing(tool);
    setDraft({
      name: tool.name,
      description: tool.description,
      kind: tool.kind,
      inputSchema: tool.inputSchema,
      code: tool.code,
      method: tool.http.method,
      url: tool.http.url,
      headers: stringifyHeaders(tool.http.headers),
      body: tool.http.body,
    });
    setTestResult(null);
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        kind: draft.kind,
        inputSchema: draft.inputSchema,
        code: draft.code,
        http: {
          method: draft.method,
          url: draft.url,
          headers: parseHeaders(draft.headers),
          body: draft.body,
          timeoutMs: 20_000,
        },
      };
      if (editing) await api.updateTool(editing.id, body);
      else await api.createTool(body);
      setOpen(false);
      await load();
      toast("ok", editing ? "Tool updated." : "Tool created.");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not save the tool.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!editing) {
      toast("info", "Save the tool first, then run a test against it.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.testTool(editing.id, JSON.parse(testInput) as Record<string, unknown>);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        ok: false,
        output: error instanceof Error ? error.message : "Test failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Tools</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
            Tools you define here can be attached to any agent node. An HTTP tool calls an API; a
            code tool runs a sandboxed snippet. Both are executed by this server, not by Claude.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={startCreate}>
          New tool
        </Button>
      </header>

      {tools === null ? (
        <Spinner />
      ) : tools.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No tools yet"
          description="Define a tool once and any agent in any workflow can call it. Templates in the URL and body pull values out of the model's arguments."
          action={
            <Button variant="primary" icon={Plus} onClick={startCreate}>
              Create a tool
            </Button>
          }
        />
      ) : (
        <div className="panel divide-y divide-line-soft">
          {tools.map((tool) => (
            <div key={tool.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-raised">
              <button onClick={() => startEdit(tool)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[13px] text-ink">{tool.name}</code>
                  <Badge tone={tool.kind === "code" ? "warn" : "neutral"}>{tool.kind}</Badge>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-ink-muted">{tool.description}</p>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={async () => {
                  if (!confirm(`Delete "${tool.name}"?`)) return;
                  await api.deleteTool(tool.id);
                  await load();
                }}
                aria-label="Delete tool"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New tool"}
        width="max-w-3xl"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" busy={busy} onClick={() => void submit()}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" hint="lower_snake_case. This is what Claude calls.">
            <TextInput
              autoFocus
              value={draft.name}
              placeholder="search_orders"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="font-mono"
            />
          </Field>
          <Field label="Kind">
            <Select
              value={draft.kind}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value as Draft["kind"] })}
            >
              <option value="http">HTTP request</option>
              <option value="code">Sandboxed code</option>
            </Select>
          </Field>
        </div>

        <Field
          label="Description"
          hint="Claude reads this to decide when to call the tool. Be specific about what it does and when to use it."
        >
          <TextArea
            rows={2}
            value={draft.description}
            placeholder="Look up an order by id and return its status, items and shipping history."
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>

        <Field label="Input schema" hint="JSON Schema. Claude fills these fields in.">
          <TextArea
            rows={8}
            value={draft.inputSchema}
            onChange={(event) => setDraft({ ...draft, inputSchema: event.target.value })}
            className="font-mono text-[11.5px]"
            spellCheck={false}
          />
        </Field>

        {draft.kind === "http" ? (
          <>
            <div className="flex gap-3">
              <Field label="Method" className="w-28">
                <Select
                  value={draft.method}
                  onChange={(event) => setDraft({ ...draft, method: event.target.value })}
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </Select>
              </Field>
              <Field label="URL" className="flex-1" hint="Templated: {{input.field}} and {{env.VAR}}.">
                <TextInput
                  value={draft.url}
                  onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                  className="font-mono text-[12px]"
                />
              </Field>
            </div>
            <Field label="Headers" hint="One per line, `Name: value`. Values are templated.">
              <TextArea
                rows={3}
                value={draft.headers}
                placeholder={"authorization: Bearer {{env.MY_API_TOKEN}}"}
                onChange={(event) => setDraft({ ...draft, headers: event.target.value })}
                className="font-mono text-[11.5px]"
              />
            </Field>
            {draft.method !== "GET" && draft.method !== "DELETE" ? (
              <Field label="Body" hint="Defaults to the model's arguments as JSON.">
                <TextArea
                  rows={4}
                  value={draft.body}
                  placeholder="{{input | compact}}"
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  className="font-mono text-[11.5px]"
                />
              </Field>
            ) : null}
          </>
        ) : (
          <Field
            label="Code"
            hint="Synchronous JavaScript with `input` in scope. No network or filesystem access."
          >
            <TextArea
              rows={10}
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              className="font-mono text-[11.5px]"
              spellCheck={false}
            />
          </Field>
        )}

        {editing ? (
          <div className="mt-4 rounded-lg border border-line bg-ground p-3">
            <h4 className="label-text">Test it</h4>
            <div className="flex gap-2">
              <TextArea
                rows={3}
                value={testInput}
                onChange={(event) => setTestInput(event.target.value)}
                className="font-mono text-[11.5px]"
              />
              <Button icon={Play} busy={busy} onClick={() => void test()}>
                Run
              </Button>
            </div>
            {testResult ? (
              <pre
                className={cx(
                  "mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed",
                  testResult.ok ? "text-ink-muted" : "text-danger",
                )}
              >
                {testResult.output}
              </pre>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
