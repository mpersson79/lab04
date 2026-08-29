import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plug, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { MCP_EXECUTION_MODES, MCP_TRANSPORTS, type McpServer } from "@studio/shared";
import { api } from "../lib/api.ts";
import { useWorkspace } from "../lib/workspace.ts";
import { formatRelative } from "../lib/format.ts";
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
  Toggle,
  cx,
  useToast,
} from "../components/ui.tsx";

interface Draft {
  name: string;
  description: string;
  url: string;
  transport: (typeof MCP_TRANSPORTS)[number];
  executionMode: (typeof MCP_EXECUTION_MODES)[number];
  authToken: string;
  enabled: boolean;
  allowedTools: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  url: "",
  transport: "http",
  executionMode: "connector",
  authToken: "",
  enabled: true,
  allowedTools: "",
};

export default function McpServersPage() {
  const toast = useToast();
  const refreshMcp = useWorkspace((state) => state.refreshMcp);
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setServers(await api.listMcpServers());
    void refreshMcp();
  }, [refreshMcp]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setOpen(true);
  };

  const startEdit = (server: McpServer) => {
    setEditing(server);
    setDraft({
      name: server.name,
      description: server.description,
      url: server.url,
      transport: server.transport,
      executionMode: server.executionMode,
      authToken: "",
      enabled: server.enabled,
      allowedTools: server.allowedTools.join(", "),
    });
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        url: draft.url.trim(),
        transport: draft.transport,
        executionMode: draft.executionMode,
        enabled: draft.enabled,
        allowedTools: draft.allowedTools
          .split(",")
          .map((tool) => tool.trim())
          .filter(Boolean),
      };
      // An untouched token field must not wipe a stored credential.
      if (draft.authToken.trim() || (editing && draft.authToken === "")) {
        if (draft.authToken.trim()) body.authToken = draft.authToken.trim();
      }

      if (editing) await api.updateMcpServer(editing.id, body);
      else await api.createMcpServer(body);

      setOpen(false);
      await load();
      toast("ok", editing ? "Server updated." : "Server added and probed.");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not save the server.");
    } finally {
      setBusy(false);
    }
  };

  const test = async (server: McpServer) => {
    setTestingId(server.id);
    try {
      const result = await api.testMcpServer(server.id);
      toast(result.status === "ok" ? "ok" : "error", `${server.name}: ${result.statusMessage}`);
      await load();
    } finally {
      setTestingId(null);
    }
  };

  const remove = async (server: McpServer) => {
    if (!confirm(`Remove "${server.name}"? Agents referencing it will warn on their next run.`)) {
      return;
    }
    await api.deleteMcpServer(server.id);
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">MCP servers</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
            Connect Model Context Protocol servers and attach them to agent nodes. Their tools then
            show up in the agent's toolset during a run.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={startCreate}>
          Add server
        </Button>
      </header>

      {servers === null ? (
        <Spinner />
      ) : servers.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No MCP servers yet"
          description="Point the studio at an MCP endpoint and every agent can use its tools. Remote servers go through Anthropic's connector; local ones are proxied through this process."
          action={
            <Button variant="primary" icon={Plus} onClick={startCreate}>
              Add your first server
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {servers.map((server) => (
            <div key={server.id} className="panel p-4">
              <div className="mb-2 flex items-start gap-2">
                <button onClick={() => startEdit(server)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold text-ink">
                      {server.name}
                    </span>
                    {server.status === "ok" ? (
                      <CheckCircle2 size={12} className="shrink-0 text-ok" />
                    ) : server.status === "error" ? (
                      <XCircle size={12} className="shrink-0 text-danger" />
                    ) : null}
                    {!server.enabled ? <Badge>disabled</Badge> : null}
                  </div>
                  <p className="truncate font-mono text-[11px] text-ink-faint">{server.url}</p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  busy={testingId === server.id}
                  onClick={() => void test(server)}
                  aria-label="Test connection"
                >
                  <RefreshCw size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(server)}
                  aria-label="Remove server"
                >
                  <Trash2 size={13} />
                </Button>
              </div>

              {server.description ? (
                <p className="mb-2 text-[12px] leading-relaxed text-ink-muted">
                  {server.description}
                </p>
              ) : null}

              <div className="mb-2 flex flex-wrap gap-1">
                <Badge>{server.transport}</Badge>
                <Badge tone={server.executionMode === "proxy" ? "warn" : "neutral"}>
                  {server.executionMode}
                </Badge>
                {server.hasAuthToken ? <Badge tone="accent">auth</Badge> : null}
                {server.allowedTools.length ? (
                  <Badge tone="accent">{server.allowedTools.length} allowed</Badge>
                ) : null}
              </div>

              <p
                className={cx(
                  "text-[11.5px] leading-snug",
                  server.status === "error" ? "text-danger" : "text-ink-faint",
                )}
              >
                {server.statusMessage || "Not tested yet."}
                {server.lastCheckedAt ? ` · ${formatRelative(server.lastCheckedAt)}` : ""}
              </p>

              {server.tools.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11.5px] text-ink-muted">
                    {server.tools.length} tools
                  </summary>
                  <div className="mt-1.5 space-y-1">
                    {server.tools.map((tool) => (
                      <div key={tool.name} className="rounded-md bg-ground px-2 py-1.5">
                        <p className="font-mono text-[11px] text-ink">{tool.name}</p>
                        {tool.description ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-faint">
                            {tool.description}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add MCP server"}
        width="max-w-xl"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" busy={busy} onClick={() => void submit()}>
              {editing ? "Save" : "Add and test"}
            </Button>
          </>
        }
      >
        <Field label="Name" hint="Letters, digits, dashes and underscores. Claude sees this name.">
          <TextInput
            autoFocus
            value={draft.name}
            placeholder="github"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field label="URL">
          <TextInput
            value={draft.url}
            placeholder="https://mcp.example.com/mcp"
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            className="font-mono text-[12px]"
          />
        </Field>
        <Field label="Description">
          <TextArea
            rows={2}
            value={draft.description}
            placeholder="What this server is for."
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Transport" className="flex-1">
            <Select
              value={draft.transport}
              onChange={(event) =>
                setDraft({ ...draft, transport: event.target.value as Draft["transport"] })
              }
            >
              <option value="http">Streamable HTTP</option>
              <option value="sse">SSE</option>
            </Select>
          </Field>
          <Field
            label="Execution"
            className="flex-1"
            hint={
              draft.executionMode === "connector"
                ? "Anthropic connects to the URL directly. It must be reachable from the internet."
                : "This server connects and re-exposes the tools. Works for localhost and private networks."
            }
          >
            <Select
              value={draft.executionMode}
              onChange={(event) =>
                setDraft({ ...draft, executionMode: event.target.value as Draft["executionMode"] })
              }
            >
              <option value="connector">Anthropic connector</option>
              <option value="proxy">Proxy through studio</option>
            </Select>
          </Field>
        </div>

        <Field
          label="Auth token"
          hint={
            editing?.hasAuthToken
              ? "A token is stored. Leave blank to keep it."
              : "Sent as a bearer token. Stored server-side and never returned to the browser."
          }
        >
          <TextInput
            type="password"
            value={draft.authToken}
            placeholder={editing?.hasAuthToken ? "••••••••" : "optional"}
            onChange={(event) => setDraft({ ...draft, authToken: event.target.value })}
          />
        </Field>

        <Field
          label="Allowed tools"
          hint="Comma-separated. Leave blank to allow every tool the server exposes."
        >
          <TextInput
            value={draft.allowedTools}
            placeholder="search_issues, create_issue"
            onChange={(event) => setDraft({ ...draft, allowedTools: event.target.value })}
          />
        </Field>

        <Toggle
          checked={draft.enabled}
          onChange={(enabled) => setDraft({ ...draft, enabled })}
          label="Enabled"
          hint="Disabled servers are skipped, with a warning in the run log."
        />
      </Modal>
    </div>
  );
}
