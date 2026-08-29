import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { McpServer, McpToolSummary } from "@studio/shared";
import { Collection, nowIso, paths, readJsonFile, writeJsonFile } from "../store.ts";
import { HttpError, messageOf } from "../errors.ts";

/** Auth tokens live beside the server records, never in the API responses. */
interface McpSecretsFile {
  [serverId: string]: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class McpService {
  readonly servers = new Collection<McpServer>(paths.mcpServers);
  private tokens: McpSecretsFile = {};
  private readonly tokensFile = paths.mcpServers.replace(/\.json$/, "-secrets.json");

  async load(): Promise<void> {
    await this.servers.load();
    this.tokens = await readJsonFile<McpSecretsFile>(this.tokensFile, {});
  }

  require(id: string): McpServer {
    const server = this.servers.get(id);
    if (!server) throw new HttpError(404, `MCP server ${id} not found`);
    return server;
  }

  tokenFor(id: string): string | undefined {
    return this.tokens[id];
  }

  async setToken(id: string, token: string | undefined): Promise<void> {
    if (token && token.trim()) this.tokens[id] = token.trim();
    else delete this.tokens[id];
    await writeJsonFile(this.tokensFile, this.tokens);
  }

  async forgetToken(id: string): Promise<void> {
    delete this.tokens[id];
    await writeJsonFile(this.tokensFile, this.tokens);
  }

  /** Open a short-lived client connection, run `work`, then always close. */
  private async withClient<T>(
    server: McpServer,
    work: (client: Client) => Promise<T>,
  ): Promise<T> {
    let url: URL;
    try {
      url = new URL(server.url);
    } catch {
      throw new HttpError(400, `"${server.url}" is not a valid URL.`);
    }

    const token = this.tokenFor(server.id);
    const requestInit: RequestInit = token
      ? { headers: { authorization: `Bearer ${token}` } }
      : {};

    const transport =
      server.transport === "sse"
        ? new SSEClientTransport(url, { requestInit })
        : new StreamableHTTPClientTransport(url, { requestInit });

    const client = new Client({ name: "agent-studio", version: "1.0.0" });
    try {
      await client.connect(transport);
      return await work(client);
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  /** Connect, list tools, and record the outcome on the server record. */
  async refresh(id: string): Promise<McpServer> {
    const server = this.require(id);
    try {
      const tools = await this.withClient(server, async (client) => {
        const listed = await client.listTools();
        return listed.tools.map<McpToolSummary>((tool) => ({
          name: tool.name,
          description: (tool.description ?? "").slice(0, 500),
        }));
      });
      return this.servers.put({
        ...server,
        tools,
        status: "ok",
        statusMessage: `${tools.length} tool${tools.length === 1 ? "" : "s"} available`,
        lastCheckedAt: nowIso(),
        updatedAt: nowIso(),
      });
    } catch (error) {
      return this.servers.put({
        ...server,
        status: "error",
        statusMessage: messageOf(error),
        lastCheckedAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  }

  /** Full tool definitions, including input schemas, for proxy-mode agents. */
  async listToolDefinitions(id: string): Promise<McpToolDefinition[]> {
    const server = this.require(id);
    return this.withClient(server, async (client) => {
      const listed = await client.listTools();
      return listed.tools
        .filter((tool) => !server.allowedTools.length || server.allowedTools.includes(tool.name))
        .map((tool) => ({
          name: tool.name,
          description: tool.description ?? `Tool ${tool.name} on MCP server ${server.name}`,
          inputSchema: (tool.inputSchema ?? {
            type: "object",
            properties: {},
          }) as Record<string, unknown>,
        }));
    });
  }

  /** Call one tool through this process. Used by proxy-mode agent nodes. */
  async callTool(id: string, name: string, args: Record<string, unknown>): Promise<string> {
    const server = this.require(id);
    return this.withClient(server, async (client) => {
      const result = await client.callTool({ name, arguments: args });
      return renderToolResult(result);
    });
  }
}

/** Flatten an MCP tool result into the text we hand back to the model. */
function renderToolResult(result: unknown): string {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return JSON.stringify(result ?? null, null, 2);

  const parts: string[] = [];
  for (const block of content) {
    const typed = block as { type?: string; text?: string; resource?: { text?: string } };
    if (typed.type === "text" && typeof typed.text === "string") parts.push(typed.text);
    else if (typed.type === "resource" && typeof typed.resource?.text === "string") {
      parts.push(typed.resource.text);
    } else parts.push(JSON.stringify(block));
  }
  return parts.join("\n") || "(the tool returned no content)";
}

export const mcp = new McpService();
