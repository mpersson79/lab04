import { create } from "zustand";
import type {
  CustomTool,
  KnowledgeBase,
  McpServer,
  ModelInfo,
  SettingsStatus,
} from "@studio/shared";
import { api } from "./api.ts";

/**
 * Workspace-level resources the builder needs everywhere: which models exist,
 * what knowledge bases and MCP servers can be attached to an agent, and
 * whether an API key is configured at all. Loaded once, refreshed on demand.
 */
interface WorkspaceState {
  models: ModelInfo[];
  knowledgeBases: KnowledgeBase[];
  mcpServers: McpServer[];
  tools: CustomTool[];
  settings: SettingsStatus | null;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshKnowledge: () => Promise<void>;
  refreshMcp: () => Promise<void>;
  refreshTools: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  models: [],
  knowledgeBases: [],
  mcpServers: [],
  tools: [],
  settings: null,
  loaded: false,
  error: null,

  refresh: async () => {
    try {
      const [models, knowledgeBases, mcpServers, tools, settings] = await Promise.all([
        api.listModels(),
        api.listKnowledgeBases(),
        api.listMcpServers(),
        api.listTools(),
        api.getSettings(),
      ]);
      set({ models, knowledgeBases, mcpServers, tools, settings, loaded: true, error: null });
    } catch (error) {
      set({ loaded: true, error: error instanceof Error ? error.message : String(error) });
    }
  },

  refreshKnowledge: async () => set({ knowledgeBases: await api.listKnowledgeBases() }),
  refreshMcp: async () => set({ mcpServers: await api.listMcpServers() }),
  refreshTools: async () => set({ tools: await api.listTools() }),
  refreshSettings: async () => set({ settings: await api.getSettings() }),
}));
