import { DEFAULT_MODEL, type NodeKind, type WorkflowNode } from "@studio/shared";

/**
 * Client-side mirrors of the server's schema defaults. The server re-validates
 * everything on save, so this only needs to produce a config a person would
 * actually want to start editing.
 */
export function defaultConfigFor(kind: NodeKind): WorkflowNode["config"] {
  switch (kind) {
    case "input":
      return {
        fields: [
          {
            key: "request",
            label: "Request",
            type: "longtext",
            required: true,
            placeholder: "What should the workflow do?",
            defaultValue: "",
          },
        ],
      };
    case "agent":
      return {
        model: DEFAULT_MODEL,
        systemPrompt: "You are a precise, helpful assistant.",
        prompt: "{{input}}",
        effort: "high",
        thinking: "adaptive",
        showThinking: true,
        maxTokens: 8_000,
        maxIterations: 8,
        cachePrompt: true,
        knowledge: { mode: "off", baseIds: [], topK: 6, minScore: 0.05, query: "{{input}}" },
        toolIds: [],
        mcpServerIds: [],
        serverTools: {
          webSearch: false,
          webFetch: false,
          codeExecution: false,
          maxWebSearches: 5,
        },
        output: { mode: "text", jsonSchema: "" },
      };
    case "knowledge":
      return {
        baseIds: [],
        query: "{{input}}",
        topK: 8,
        minScore: 0.05,
        includeCitations: true,
      };
    case "router":
      return {
        mode: "llm",
        model: "claude-haiku-4-5",
        prompt: "{{input}}",
        instructions: "Pick the single route that best matches the request.",
        routes: [
          { id: "a", label: "Route A", description: "" },
          { id: "b", label: "Route B", description: "" },
        ],
        expression: "input.length > 200 ? 'a' : 'b'",
        fallbackRouteId: "a",
      };
    case "code":
      return { code: "return input;", timeoutMs: 3_000 };
    case "http":
      return {
        method: "GET",
        url: "https://api.example.com/things",
        headers: {},
        body: "",
        timeoutMs: 20_000,
        parseJson: true,
      };
    case "approval":
      return {
        title: "Review before continuing",
        instructions: "Check the draft below and approve or reject.",
        preview: "{{input}}",
        allowEdit: true,
      };
    case "output":
      return { template: "{{input}}", format: "markdown" };
  }
}
