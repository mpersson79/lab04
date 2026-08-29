import { paths, readJsonFile, writeJsonFile } from "../store.ts";

interface SecretsFile {
  anthropicApiKey?: string;
}

let cached: SecretsFile = {};

export async function loadSecrets(): Promise<void> {
  cached = await readJsonFile<SecretsFile>(paths.secrets, {});
}

export type ApiKeySource = "environment" | "stored" | "none";

export function apiKeySource(): ApiKeySource {
  if (process.env.ANTHROPIC_API_KEY) return "environment";
  if (cached.anthropicApiKey) return "stored";
  return "none";
}

/**
 * The environment wins over the stored key so that a deployment can pin a
 * credential the UI cannot silently replace.
 */
export function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || cached.anthropicApiKey || null;
}

export function maskApiKey(): string {
  const key = getApiKey();
  if (!key) return "";
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export async function storeApiKey(key: string): Promise<void> {
  cached = { ...cached, anthropicApiKey: key.trim() };
  await writeJsonFile(paths.secrets, cached);
}

export async function clearStoredApiKey(): Promise<void> {
  cached = { ...cached, anthropicApiKey: undefined };
  await writeJsonFile(paths.secrets, cached);
}
