import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** agent-studio/ */
export const ROOT_DIR = path.resolve(here, "..", "..");
export const DATA_DIR = process.env.STUDIO_DATA_DIR
  ? path.resolve(process.env.STUDIO_DATA_DIR)
  : path.join(ROOT_DIR, "data");
export const WEB_DIST_DIR = path.join(ROOT_DIR, "web", "dist");

export const PORT = Number(process.env.PORT ?? 4319);

/** Load agent-studio/.env into process.env without pulling in a dependency. */
export function loadDotEnv(): void {
  const file = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Guard rails applied to every run regardless of workflow settings. */
export const LIMITS = {
  maxNodesPerWorkflow: 120,
  maxRunHistory: 300,
  maxDocumentBytes: 5 * 1024 * 1024,
  maxChunksPerBase: 20_000,
  /** Longest single tool result we will feed back to the model. */
  maxToolResultChars: 40_000,
  maxNodeOutputChars: 400_000,
} as const;
