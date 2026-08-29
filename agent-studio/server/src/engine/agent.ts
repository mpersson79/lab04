import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentConfig,
  RetrievedChunk,
  TokenUsage,
  ToolCallRecord,
} from "@studio/shared";
import { EMPTY_USAGE, addUsage, findModel } from "@studio/shared";
import { getAnthropic } from "../services/anthropic.ts";
import { knowledge, formatContext } from "../services/knowledge.ts";
import { mcp } from "../services/mcp.ts";
import { executeCustomTool, parseToolSchema, tools as toolStore } from "../services/tools.ts";
import { LIMITS } from "../config.ts";
import { messageOf } from "../errors.ts";
import { nowIso } from "../store.ts";

type BetaTool = Anthropic.Beta.BetaToolUnion;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;

export interface AgentHooks {
  onText(delta: string): void;
  onThinking(delta: string): void;
  onToolCall(call: ToolCallRecord): void;
  log(level: "info" | "warn" | "error", message: string): void;
  signal: AbortSignal;
}

export interface AgentResult {
  text: string;
  /** Parsed object when the agent is in JSON output mode. */
  data: unknown;
  thinking: string;
  usage: TokenUsage;
  iterations: number;
  citations: RetrievedChunk[];
  model: string;
  toolCalls: ToolCallRecord[];
}

/** A tool this process executes itself, as opposed to one Anthropic runs. */
interface LocalTool {
  definition: Anthropic.Beta.BetaTool;
  source: ToolCallRecord["source"];
  run(input: Record<string, unknown>): Promise<string>;
}

const KNOWLEDGE_TOOL_NAME = "search_knowledge";

function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

/** Both the beta and stable usage objects carry these fields. */
type UsageLike = Pick<Anthropic.Usage, "input_tokens" | "output_tokens"> & {
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function usageFrom(usage: UsageLike | undefined): TokenUsage {
  if (!usage) return EMPTY_USAGE;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Assemble the tools an agent node can reach: workspace tools, retrieval,
 * MCP (proxied through this process or handed to Anthropic as a connector),
 * and Anthropic's own server-side tools.
 */
async function buildToolset(
  config: AgentConfig,
  hooks: AgentHooks,
): Promise<{
  tools: BetaTool[];
  local: Map<string, LocalTool>;
  mcpServers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[];
  betas: string[];
  citations: RetrievedChunk[];
}> {
  const tools: BetaTool[] = [];
  const local = new Map<string, LocalTool>();
  const mcpServers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[] = [];
  const betas: string[] = [];
  const citations: RetrievedChunk[] = [];

  /* Workspace tools ------------------------------------------------- */
  for (const toolId of config.toolIds) {
    const tool = toolStore.get(toolId);
    if (!tool) {
      hooks.log("warn", `Tool ${toolId} is attached but no longer exists - skipping.`);
      continue;
    }
    const definition: Anthropic.Beta.BetaTool = {
      name: tool.name,
      description: tool.description,
      input_schema: parseToolSchema(tool) as Anthropic.Beta.BetaTool["input_schema"],
    };
    tools.push(definition);
    local.set(tool.name, {
      definition,
      source: "custom",
      run: (input) => executeCustomTool(tool, input),
    });
  }

  /* Retrieval as a tool --------------------------------------------- */
  if (config.knowledge.mode === "tool" && config.knowledge.baseIds.length) {
    const names = config.knowledge.baseIds
      .map((id) => knowledge.bases.get(id)?.name)
      .filter(Boolean)
      .join(", ");
    const definition: Anthropic.Beta.BetaTool = {
      name: KNOWLEDGE_TOOL_NAME,
      description:
        `Search the connected knowledge bases (${names || "none configured"}) and return the ` +
        "most relevant passages. Call it more than once with different phrasings when the " +
        "first search is thin.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for, in natural language." },
        },
        required: ["query"],
      },
    };
    tools.push(definition);
    local.set(KNOWLEDGE_TOOL_NAME, {
      definition,
      source: "knowledge",
      run: async (input) => {
        const results = await knowledge.search({
          baseIds: config.knowledge.baseIds,
          query: String(input.query ?? ""),
          topK: config.knowledge.topK,
          minScore: config.knowledge.minScore,
        });
        for (const result of results) {
          if (!citations.some((c) => c.chunkId === result.chunkId)) citations.push(result);
        }
        return formatContext(results);
      },
    });
  }

  /* MCP -------------------------------------------------------------- */
  for (const serverId of config.mcpServerIds) {
    const server = mcp.servers.get(serverId);
    if (!server) {
      hooks.log("warn", `MCP server ${serverId} is attached but no longer exists - skipping.`);
      continue;
    }
    if (!server.enabled) {
      hooks.log("warn", `MCP server "${server.name}" is disabled - skipping.`);
      continue;
    }

    if (server.executionMode === "connector") {
      const token = mcp.tokenFor(server.id);
      mcpServers.push({
        type: "url",
        name: server.name,
        url: server.url,
        ...(token ? { authorization_token: token } : {}),
      });
      const toolset: Anthropic.Beta.BetaMCPToolset = {
        type: "mcp_toolset",
        mcp_server_name: server.name,
      };
      if (server.allowedTools.length) {
        // Allowlist mode: everything off by default, then re-enable by name.
        toolset.default_config = { enabled: false };
        toolset.configs = Object.fromEntries(
          server.allowedTools.map((name) => [name, { enabled: true }]),
        );
      }
      tools.push(toolset);
      if (!betas.includes("mcp-client-2025-11-20")) betas.push("mcp-client-2025-11-20");
      continue;
    }

    // Proxy mode: this process holds the MCP connection and re-exposes the
    // tools, so servers on localhost or behind a VPN still work.
    try {
      const definitions = await mcp.listToolDefinitions(server.id);
      for (const definition of definitions) {
        const exposedName = sanitizeToolName(`mcp_${server.name}_${definition.name}`);
        const tool: Anthropic.Beta.BetaTool = {
          name: exposedName,
          description: `[${server.name}] ${definition.description}`,
          input_schema: definition.inputSchema as Anthropic.Beta.BetaTool["input_schema"],
        };
        tools.push(tool);
        local.set(exposedName, {
          definition: tool,
          source: "mcp",
          run: (input) => mcp.callTool(server.id, definition.name, input),
        });
      }
      hooks.log("info", `Proxying ${definitions.length} tool(s) from MCP server "${server.name}".`);
    } catch (error) {
      hooks.log("error", `Could not reach MCP server "${server.name}": ${messageOf(error)}`);
    }
  }

  /* Anthropic server-side tools -------------------------------------- */
  if (config.serverTools.webSearch) {
    tools.push({
      type: "web_search_20260209",
      name: "web_search",
      max_uses: config.serverTools.maxWebSearches,
    });
  }
  if (config.serverTools.webFetch) {
    tools.push({ type: "web_fetch_20260209", name: "web_fetch" });
  }
  if (config.serverTools.codeExecution) {
    tools.push({ type: "code_execution_20260521", name: "code_execution" });
  }

  return { tools, local, mcpServers, betas, citations };
}

/** Build the request shape once; the loop only appends messages. */
function baseRequest(
  config: AgentConfig,
  system: string,
  tools: BetaTool[],
  mcpServers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[],
): Omit<Anthropic.Beta.MessageCreateParamsStreaming, "messages" | "stream"> {
  const model = findModel(config.model);
  const maxTokens = Math.min(config.maxTokens, model?.maxOutputTokens ?? config.maxTokens);

  const request: Omit<Anthropic.Beta.MessageCreateParamsStreaming, "messages" | "stream"> = {
    model: config.model,
    max_tokens: maxTokens,
    // A cache breakpoint on the system prompt pays for itself the moment a
    // workflow runs twice, and agent system prompts are stable by design.
    system: config.cachePrompt
      ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
      : system,
  };

  if (tools.length) request.tools = tools;
  if (mcpServers.length) request.mcp_servers = mcpServers;

  const outputConfig: Anthropic.Beta.BetaOutputConfig = {};

  if (config.thinking === "adaptive" && model?.supportsAdaptiveThinking !== false) {
    request.thinking = {
      type: "adaptive",
      display: config.showThinking ? "summarized" : "omitted",
    };
    if (model?.supportsEffort) outputConfig.effort = config.effort;
  } else if (model?.supportsAdaptiveThinking) {
    request.thinking = { type: "disabled" };
    // Disabled thinking is rejected above `high`, so clamp rather than fail.
    if (model.supportsEffort) {
      outputConfig.effort =
        config.effort === "xhigh" || config.effort === "max" ? "high" : config.effort;
    }
  }

  if (config.output.mode === "json" && config.output.jsonSchema.trim()) {
    try {
      outputConfig.format = {
        type: "json_schema",
        schema: JSON.parse(config.output.jsonSchema) as Record<string, unknown>,
      };
    } catch (error) {
      throw new Error(`The agent's JSON output schema is not valid JSON: ${messageOf(error)}`);
    }
  }

  if (Object.keys(outputConfig).length) request.output_config = outputConfig;
  return request;
}

/**
 * Drive one agent node to completion: stream each turn, execute whatever tools
 * the model asks for, and stop when it stops asking.
 */
export async function runAgent(
  config: AgentConfig,
  userPrompt: string,
  hooks: AgentHooks,
): Promise<AgentResult> {
  const client = getAnthropic();
  const { tools, local, mcpServers, betas, citations } = await buildToolset(config, hooks);

  let system = config.systemPrompt;

  // Inject-mode retrieval happens once, before the first turn, so the context
  // is part of the cached prefix rather than a tool round trip.
  if (config.knowledge.mode === "inject" && config.knowledge.baseIds.length) {
    const results = await knowledge.search({
      baseIds: config.knowledge.baseIds,
      query: userPrompt,
      topK: config.knowledge.topK,
      minScore: config.knowledge.minScore,
    });
    citations.push(...results);
    hooks.log("info", `Retrieved ${results.length} passage(s) from the knowledge bases.`);
    system = `${system}\n\n# Retrieved context\nAnswer from these sources and cite them as [S1], [S2]. If they do not cover the question, say so.\n\n${formatContext(results)}`;
  }

  const request = baseRequest(config, system, tools, mcpServers);
  const messages: BetaMessageParam[] = [{ role: "user", content: userPrompt }];

  let usage = EMPTY_USAGE;
  let iterations = 0;
  let finalText = "";
  let thinkingText = "";
  const toolCalls: ToolCallRecord[] = [];

  while (iterations < config.maxIterations) {
    hooks.signal.throwIfAborted();
    iterations += 1;

    const stream = client.beta.messages.stream(
      { ...request, messages, ...(betas.length ? { betas } : {}) },
      { signal: hooks.signal },
    );

    let turnText = "";
    for await (const event of stream) {
      if (event.type !== "content_block_delta") continue;
      if (event.delta.type === "text_delta") {
        turnText += event.delta.text;
        hooks.onText(event.delta.text);
      } else if (event.delta.type === "thinking_delta") {
        thinkingText += event.delta.thinking;
        hooks.onThinking(event.delta.thinking);
      }
    }

    const message = await stream.finalMessage();
    usage = addUsage(usage, usageFrom(message.usage));
    if (turnText.trim()) finalText = turnText;

    if (message.stop_reason === "refusal") {
      const details = message.stop_details;
      throw new Error(
        `Claude declined this request${
          details && "category" in details && details.category ? ` (${details.category})` : ""
        }.`,
      );
    }

    if (message.stop_reason === "pause_turn") {
      // A server-side tool ran long. Hand the paused turn back to continue it.
      messages.push({ role: "assistant", content: message.content });
      hooks.log("info", "Server-side tool paused the turn; resuming.");
      continue;
    }

    if (message.stop_reason === "max_tokens") {
      hooks.log("warn", "The reply hit max_tokens and was cut short. Raise the limit on this node.");
    }

    const toolUses = message.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use",
    );
    if (!toolUses.length) break;

    messages.push({ role: "assistant", content: message.content });

    // Parallel tool calls come back in one assistant turn and every result
    // must go back in a single user turn, or the model stops parallelising.
    const results = await Promise.all(
      toolUses.map(async (toolUse): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const startedAt = Date.now();
        const handler = local.get(toolUse.name);
        const input = (toolUse.input ?? {}) as Record<string, unknown>;

        let output: string;
        let isError = false;
        if (!handler) {
          output = `No handler is registered for tool "${toolUse.name}".`;
          isError = true;
        } else {
          try {
            output = await handler.run(input);
          } catch (error) {
            output = `Tool failed: ${messageOf(error)}`;
            isError = true;
          }
        }

        const record: ToolCallRecord = {
          id: toolUse.id,
          source: handler?.source ?? "custom",
          name: toolUse.name,
          input,
          output: output.slice(0, LIMITS.maxToolResultChars),
          isError,
          durationMs: Date.now() - startedAt,
          startedAt: nowIso(),
        };
        toolCalls.push(record);
        hooks.onToolCall(record);

        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: record.output || "(empty result)",
          is_error: isError,
        };
      }),
    );

    messages.push({ role: "user", content: results });
  }

  if (iterations >= config.maxIterations) {
    hooks.log(
      "warn",
      `Stopped after ${config.maxIterations} tool iterations. Raise "max iterations" if the agent needs more room.`,
    );
  }

  let data: unknown = null;
  if (config.output.mode === "json") {
    try {
      data = JSON.parse(finalText);
    } catch {
      hooks.log("warn", "The agent was asked for JSON but the reply did not parse.");
    }
  }

  return {
    text: finalText.trim(),
    data,
    thinking: thinkingText,
    usage,
    iterations,
    citations,
    model: config.model,
    toolCalls,
  };
}

/** A single non-streaming call, used by the router node's classifier. */
export async function classify(options: {
  model: string;
  system: string;
  prompt: string;
  routeIds: string[];
  signal: AbortSignal;
}): Promise<{ routeId: string | null; usage: TokenUsage; raw: string }> {
  const client = getAnthropic();
  const message = await client.messages.create(
    {
      model: options.model,
      max_tokens: 1_000,
      system: options.system,
      messages: [{ role: "user", content: options.prompt }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              route: { type: "string", enum: options.routeIds },
              reason: { type: "string" },
            },
            required: ["route", "reason"],
            additionalProperties: false,
          },
        },
      },
    },
    { signal: options.signal },
  );

  const raw = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  let routeId: string | null = null;
  try {
    const parsed = JSON.parse(raw) as { route?: string };
    if (parsed.route && options.routeIds.includes(parsed.route)) routeId = parsed.route;
  } catch {
    // Fall back to a plain substring match, which covers a model that answered
    // with prose despite the schema.
    routeId = options.routeIds.find((id) => raw.toLowerCase().includes(id.toLowerCase())) ?? null;
  }

  return { routeId, usage: usageFrom(message.usage), raw };
}
