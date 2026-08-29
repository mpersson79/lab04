import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "../errors.ts";
import { getApiKey } from "./secrets.ts";

let client: Anthropic | null = null;
let clientKey: string | null = null;

/** A client bound to the currently configured key, rebuilt when the key changes. */
export function getAnthropic(): Anthropic {
  const key = getApiKey();
  if (!key) {
    throw new HttpError(
      400,
      "No Anthropic API key configured. Add one in Settings, or set ANTHROPIC_API_KEY.",
    );
  }
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key, maxRetries: 3, timeout: 15 * 60 * 1000 });
    clientKey = key;
  }
  return client;
}

/** Cheap credential check used by the Settings page. */
export async function verifyApiKey(): Promise<{ ok: boolean; message: string }> {
  try {
    const models = await getAnthropic().models.list({ limit: 1 });
    const first = models.data[0];
    return {
      ok: true,
      message: first ? `Key works. Newest model visible: ${first.id}` : "Key works.",
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, message: "Anthropic rejected the key." };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, message: `Anthropic error ${error.status}: ${error.message}` };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
