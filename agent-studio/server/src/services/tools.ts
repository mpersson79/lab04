import type { CustomTool } from "@studio/shared";
import { Collection, paths } from "../store.ts";
import { HttpError } from "../errors.ts";
import { render } from "../util/template.ts";
import { runSandboxed } from "../util/sandbox.ts";
import { LIMITS } from "../config.ts";

export const tools = new Collection<CustomTool>(paths.tools);

export function parseToolSchema(tool: CustomTool): Record<string, unknown> {
  try {
    const parsed = JSON.parse(tool.inputSchema || "{}") as Record<string, unknown>;
    if (parsed.type !== "object") {
      return { type: "object", properties: {}, ...parsed };
    }
    return parsed;
  } catch (error) {
    throw new HttpError(
      400,
      `Tool "${tool.name}" has an invalid input schema: ${(error as Error).message}`,
    );
  }
}

function truncate(text: string): string {
  return text.length > LIMITS.maxToolResultChars
    ? `${text.slice(0, LIMITS.maxToolResultChars)}\n\n[truncated at ${LIMITS.maxToolResultChars} characters]`
    : text;
}

/**
 * Run a workspace tool. `input` is whatever the model produced for the tool's
 * schema; templates in the tool's URL, headers and body can reference it as
 * `{{input.field}}`, and environment variables as `{{env.NAME}}`.
 */
export async function executeCustomTool(
  tool: CustomTool,
  input: Record<string, unknown>,
): Promise<string> {
  if (tool.kind === "code") {
    const { value, logs } = runSandboxed(tool.code, { input }, 5_000);
    const rendered = typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
    return truncate(logs.length ? `${rendered}\n\n--- logs ---\n${logs.join("\n")}` : rendered);
  }

  const context = { input, env: process.env as Record<string, string | undefined> };
  const url = render(tool.http.url, context).trim();
  if (!url) throw new HttpError(400, `Tool "${tool.name}" has no URL configured.`);

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(tool.http.headers)) {
    headers[key] = render(value, context);
  }

  const hasBody = tool.http.method !== "GET" && tool.http.method !== "DELETE";
  const body = hasBody ? render(tool.http.body || "{{input | compact}}", context) : undefined;
  if (body && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(url, {
    method: tool.http.method,
    headers,
    body,
    signal: AbortSignal.timeout(tool.http.timeoutMs),
  });
  const text = await response.text();
  const status = `HTTP ${response.status} ${response.statusText}`;
  return truncate(response.ok ? text || status : `${status}\n${text}`);
}
