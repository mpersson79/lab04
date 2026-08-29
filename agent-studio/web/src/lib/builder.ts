import { create } from "zustand";
import type {
  NodeKind,
  NodeStatus,
  Run,
  RunEvent,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "@studio/shared";
import { api, type WorkflowIssue } from "./api.ts";
import { defaultConfigFor } from "./nodeDefaults.ts";

/** Live per-node state while a run is streaming, keyed by node id. */
export interface NodeRuntime {
  status: NodeStatus;
  text: string;
  thinking: string;
  toolNames: string[];
  selectedRoute: string | null;
  costUsd: number;
}

interface BuilderState {
  workflow: Workflow | null;
  issues: WorkflowIssue[];
  selectedNodeId: string | null;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: string | null;

  /* Run overlay ---------------------------------------------------- */
  run: Run | null;
  runtime: Record<string, NodeRuntime>;
  streaming: boolean;

  load: (id: string) => Promise<void>;
  save: () => Promise<void>;
  setMeta: (patch: { name?: string; description?: string; tags?: string[] }) => void;
  select: (nodeId: string | null) => void;

  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  updateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;

  addEdge: (edge: Omit<WorkflowEdge, "label"> & { label?: string }) => void;
  removeEdge: (edgeId: string) => void;

  applyRunEvent: (event: RunEvent) => void;
  resetRun: () => void;
  setRun: (run: Run | null) => void;
  setStreaming: (streaming: boolean) => void;
}

const blankRuntime = (): NodeRuntime => ({
  status: "pending",
  text: "",
  thinking: "",
  toolNames: [],
  selectedRoute: null,
  costUsd: 0,
});

/** Node ids double as template handles (`{{nodes.<id>.output}}`), so keep them readable. */
function nodeIdFor(kind: NodeKind, existing: WorkflowNode[]): string {
  const base = kind === "agent" ? "agent" : kind;
  let index = 1;
  let candidate = base;
  const taken = new Set(existing.map((node) => node.id));
  while (taken.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  return candidate;
}

function nextName(kind: NodeKind, existing: WorkflowNode[]): string {
  const labels: Record<NodeKind, string> = {
    input: "Input",
    agent: "Agent",
    knowledge: "Retrieval",
    router: "Router",
    code: "Code",
    http: "HTTP request",
    approval: "Human approval",
    output: "Output",
  };
  const base = labels[kind];
  const sameKind = existing.filter((node) => node.kind === kind).length;
  return sameKind ? `${base} ${sameKind + 1}` : base;
}

export const useBuilder = create<BuilderState>((set, get) => ({
  workflow: null,
  issues: [],
  selectedNodeId: null,
  dirty: false,
  saving: false,
  lastSavedAt: null,
  run: null,
  runtime: {},
  streaming: false,

  load: async (id) => {
    const { workflow, issues } = await api.getWorkflow(id);
    set({
      workflow,
      issues,
      dirty: false,
      selectedNodeId: null,
      run: null,
      runtime: {},
      streaming: false,
    });
  },

  save: async () => {
    const { workflow, dirty, saving } = get();
    if (!workflow || !dirty || saving) return;
    set({ saving: true });
    try {
      const result = await api.saveWorkflow(workflow.id, {
        name: workflow.name,
        description: workflow.description,
        tags: workflow.tags,
        nodes: workflow.nodes,
        edges: workflow.edges,
      });
      set({
        workflow: result.workflow,
        issues: result.issues,
        dirty: false,
        lastSavedAt: new Date().toISOString(),
      });
    } finally {
      set({ saving: false });
    }
  },

  setMeta: (patch) =>
    set((state) =>
      state.workflow ? { workflow: { ...state.workflow, ...patch }, dirty: true } : state,
    ),

  select: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: (kind, position) => {
    const state = get();
    if (!state.workflow) return "";
    const id = nodeIdFor(kind, state.workflow.nodes);
    const node = {
      id,
      kind,
      name: nextName(kind, state.workflow.nodes),
      notes: "",
      position,
      config: defaultConfigFor(kind),
    } as WorkflowNode;
    set({
      workflow: { ...state.workflow, nodes: [...state.workflow.nodes, node] },
      selectedNodeId: id,
      dirty: true,
    });
    return id;
  },

  updateNode: (nodeId, patch) =>
    set((state) =>
      state.workflow
        ? {
            workflow: {
              ...state.workflow,
              nodes: state.workflow.nodes.map((node) =>
                node.id === nodeId ? ({ ...node, ...patch } as WorkflowNode) : node,
              ),
            },
            dirty: true,
          }
        : state,
    ),

  updateNodeConfig: (nodeId, patch) =>
    set((state) =>
      state.workflow
        ? {
            workflow: {
              ...state.workflow,
              nodes: state.workflow.nodes.map((node) =>
                node.id === nodeId
                  ? ({ ...node, config: { ...node.config, ...patch } } as WorkflowNode)
                  : node,
              ),
            },
            dirty: true,
          }
        : state,
    ),

  // Dragging fires constantly, so it updates positions without touching the
  // rest of the node and without re-running validation.
  moveNode: (nodeId, position) =>
    set((state) =>
      state.workflow
        ? {
            workflow: {
              ...state.workflow,
              nodes: state.workflow.nodes.map((node) =>
                node.id === nodeId ? { ...node, position } : node,
              ),
            },
            dirty: true,
          }
        : state,
    ),

  removeNode: (nodeId) =>
    set((state) =>
      state.workflow
        ? {
            workflow: {
              ...state.workflow,
              nodes: state.workflow.nodes.filter((node) => node.id !== nodeId),
              edges: state.workflow.edges.filter(
                (edge) => edge.source !== nodeId && edge.target !== nodeId,
              ),
            },
            selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
            dirty: true,
          }
        : state,
    ),

  addEdge: (edge) =>
    set((state) => {
      if (!state.workflow) return state;
      const exists = state.workflow.edges.some(
        (existing) =>
          existing.source === edge.source &&
          existing.target === edge.target &&
          (existing.sourceHandle ?? null) === (edge.sourceHandle ?? null),
      );
      if (exists) return state;
      return {
        workflow: {
          ...state.workflow,
          edges: [...state.workflow.edges, { label: "", ...edge }],
        },
        dirty: true,
      };
    }),

  removeEdge: (edgeId) =>
    set((state) =>
      state.workflow
        ? {
            workflow: {
              ...state.workflow,
              edges: state.workflow.edges.filter((edge) => edge.id !== edgeId),
            },
            dirty: true,
          }
        : state,
    ),

  applyRunEvent: (event) =>
    set((state) => {
      const runtime = { ...state.runtime };
      const touch = (nodeId: string): NodeRuntime => {
        const current = runtime[nodeId] ?? blankRuntime();
        runtime[nodeId] = current;
        return current;
      };

      switch (event.type) {
        case "run.started":
          return {
            run: event.run,
            streaming: true,
            runtime: Object.fromEntries(
              event.run.nodeRuns.map((nodeRun) => [nodeRun.nodeId, blankRuntime()]),
            ),
          };
        case "node.started":
          runtime[event.nodeId] = { ...touch(event.nodeId), status: "running" };
          return { runtime };
        case "node.text":
          runtime[event.nodeId] = {
            ...touch(event.nodeId),
            text: touch(event.nodeId).text + event.delta,
          };
          return { runtime };
        case "node.thinking":
          runtime[event.nodeId] = {
            ...touch(event.nodeId),
            thinking: touch(event.nodeId).thinking + event.delta,
          };
          return { runtime };
        case "node.tool":
          runtime[event.nodeId] = {
            ...touch(event.nodeId),
            toolNames: [...touch(event.nodeId).toolNames, event.call.name],
          };
          return { runtime };
        case "node.finished": {
          runtime[event.nodeId] = {
            ...touch(event.nodeId),
            status: event.nodeRun.status,
            text: event.nodeRun.output || touch(event.nodeId).text,
            thinking: event.nodeRun.thinking || touch(event.nodeId).thinking,
            selectedRoute: event.nodeRun.selectedRoute,
            costUsd: event.nodeRun.costUsd,
          };
          const run = state.run
            ? {
                ...state.run,
                nodeRuns: state.run.nodeRuns.map((nodeRun) =>
                  nodeRun.nodeId === event.nodeId ? event.nodeRun : nodeRun,
                ),
              }
            : state.run;
          return { runtime, run };
        }
        case "run.approval":
          return state.run
            ? { run: { ...state.run, pendingApproval: event.approval, status: "awaiting_approval" } }
            : state;
        case "run.finished":
          return { run: event.run, streaming: false };
        default:
          return state;
      }
    }),

  resetRun: () => set({ run: null, runtime: {}, streaming: false }),
  setRun: (run) => set({ run }),
  setStreaming: (streaming) => set({ streaming }),
}));
