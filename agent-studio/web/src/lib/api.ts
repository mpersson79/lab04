import type {
  ApprovalDecision,
  CustomTool,
  KnowledgeBase,
  KnowledgeDocument,
  McpServer,
  ModelInfo,
  RetrievedChunk,
  Run,
  RunSummary,
  Settings,
  SettingsStatus,
  Workflow,
  WorkflowDraft,
} from "@studio/shared";

export interface WorkflowIssue {
  level: "error" | "warning";
  nodeId: string | null;
  message: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodeCount: number;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  icon: string;
  requires: Array<"knowledge" | "mcp" | "web">;
  nodeCount: number;
}

/** An error the UI can show verbatim - the server writes them for humans. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers:
      init.body instanceof Blob
        ? init.headers
        : { "content-type": "application/json", ...init.headers },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const body = payload as { error?: string; details?: unknown } | null;
    throw new ApiError(
      response.status,
      body?.error ?? `${response.status} ${response.statusText}`,
      body?.details,
    );
  }
  return payload as T;
}

const json = (body: unknown): RequestInit["body"] => JSON.stringify(body);

export const api = {
  health: () => request<{ ok: boolean; apiKey: string }>("/health"),

  /* Workflows ------------------------------------------------------- */
  listWorkflows: () => request<WorkflowSummary[]>("/workflows"),
  listTemplates: () => request<TemplateSummary[]>("/workflows/templates"),
  createWorkflow: (templateId: string, name?: string) =>
    request<Workflow>("/workflows", { method: "POST", body: json({ templateId, name }) }),
  getWorkflow: (id: string) =>
    request<{ workflow: Workflow; issues: WorkflowIssue[] }>(`/workflows/${id}`),
  saveWorkflow: (id: string, draft: WorkflowDraft) =>
    request<{ workflow: Workflow; issues: WorkflowIssue[] }>(`/workflows/${id}`, {
      method: "PUT",
      body: json(draft),
    }),
  duplicateWorkflow: (id: string) =>
    request<Workflow>(`/workflows/${id}/duplicate`, { method: "POST" }),
  deleteWorkflow: (id: string) => request<void>(`/workflows/${id}`, { method: "DELETE" }),

  /* Runs ------------------------------------------------------------ */
  listRuns: (workflowId?: string) =>
    request<RunSummary[]>(`/runs${workflowId ? `?workflowId=${workflowId}` : ""}`),
  startRun: (workflowId: string, input: Record<string, unknown>) =>
    request<Run>("/runs", { method: "POST", body: json({ workflowId, input }) }),
  getRun: (id: string) => request<{ run: Run; active: boolean }>(`/runs/${id}`),
  cancelRun: (id: string) => request<{ ok: boolean }>(`/runs/${id}/cancel`, { method: "POST" }),
  decideApproval: (id: string, decision: ApprovalDecision) =>
    request<{ ok: boolean }>(`/runs/${id}/approval`, { method: "POST", body: json(decision) }),
  deleteRun: (id: string) => request<void>(`/runs/${id}`, { method: "DELETE" }),

  /* Knowledge ------------------------------------------------------- */
  listKnowledgeBases: () => request<KnowledgeBase[]>("/knowledge"),
  createKnowledgeBase: (body: { name: string; description?: string }) =>
    request<KnowledgeBase>("/knowledge", { method: "POST", body: json(body) }),
  updateKnowledgeBase: (id: string, body: Partial<KnowledgeBase>) =>
    request<KnowledgeBase>(`/knowledge/${id}`, { method: "PUT", body: json(body) }),
  deleteKnowledgeBase: (id: string) => request<void>(`/knowledge/${id}`, { method: "DELETE" }),
  listDocuments: (baseId: string) =>
    request<KnowledgeDocument[]>(`/knowledge/${baseId}/documents`),
  addDocument: (baseId: string, body: { title?: string; text?: string; url?: string }) =>
    request<KnowledgeDocument>(`/knowledge/${baseId}/documents`, {
      method: "POST",
      body: json(body),
    }),
  uploadDocument: async (baseId: string, file: File) =>
    request<KnowledgeDocument>(
      `/knowledge/${baseId}/documents/upload?filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        body: file,
        headers: { "content-type": file.type || "text/plain" },
      },
    ),
  deleteDocument: (baseId: string, documentId: string) =>
    request<void>(`/knowledge/${baseId}/documents/${documentId}`, { method: "DELETE" }),
  searchKnowledge: (body: { baseIds?: string[]; query: string; topK?: number }) =>
    request<RetrievedChunk[]>("/knowledge/search", { method: "POST", body: json(body) }),

  /* MCP ------------------------------------------------------------- */
  listMcpServers: () => request<McpServer[]>("/mcp-servers"),
  createMcpServer: (body: Record<string, unknown>) =>
    request<McpServer>("/mcp-servers", { method: "POST", body: json(body) }),
  updateMcpServer: (id: string, body: Record<string, unknown>) =>
    request<McpServer>(`/mcp-servers/${id}`, { method: "PUT", body: json(body) }),
  testMcpServer: (id: string) =>
    request<McpServer>(`/mcp-servers/${id}/test`, { method: "POST" }),
  deleteMcpServer: (id: string) => request<void>(`/mcp-servers/${id}`, { method: "DELETE" }),

  /* Tools ----------------------------------------------------------- */
  listTools: () => request<CustomTool[]>("/tools"),
  createTool: (body: Record<string, unknown>) =>
    request<CustomTool>("/tools", { method: "POST", body: json(body) }),
  updateTool: (id: string, body: Record<string, unknown>) =>
    request<CustomTool>(`/tools/${id}`, { method: "PUT", body: json(body) }),
  deleteTool: (id: string) => request<void>(`/tools/${id}`, { method: "DELETE" }),
  testTool: (id: string, input: Record<string, unknown>) =>
    request<{ ok: boolean; output: string; durationMs: number }>(`/tools/${id}/test`, {
      method: "POST",
      body: json({ input }),
    }),

  /* Settings -------------------------------------------------------- */
  getSettings: () => request<SettingsStatus>("/settings"),
  listModels: () => request<ModelInfo[]>("/settings/models"),
  updateSettings: (patch: Partial<Settings>) =>
    request<SettingsStatus>("/settings", { method: "PUT", body: json(patch) }),
  setApiKey: (apiKey: string) =>
    request<SettingsStatus>("/settings/api-key", { method: "PUT", body: json({ apiKey }) }),
  clearApiKey: () => request<SettingsStatus>("/settings/api-key", { method: "DELETE" }),
  testApiKey: () =>
    request<{ ok: boolean; message: string }>("/settings/api-key/test", { method: "POST" }),
};
