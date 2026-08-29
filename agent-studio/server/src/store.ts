import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "./config.ts";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("base64url")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Write a file without ever leaving a half-written document behind: write to a
 * sibling temp file, then rename over the target.
 */
async function writeAtomic(file: string, contents: string): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, file);
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

/**
 * A JSON-file backed collection kept fully in memory. Writes are coalesced so a
 * burst of edits costs one flush. Small-scale on purpose: the whole studio is a
 * single-user workspace, and a file you can read in an editor beats a database
 * you cannot inspect.
 */
export class Collection<T extends { id: string }> {
  private items = new Map<string, T>();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly options: { flushMs?: number } = {},
  ) {}

  async load(): Promise<void> {
    const rows = await readJson<T[]>(this.file, []);
    this.items = new Map(rows.map((row) => [row.id, row]));
  }

  list(): T[] {
    return [...this.items.values()];
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  put(item: T): T {
    this.items.set(item.id, item);
    this.scheduleFlush();
    return item;
  }

  delete(id: string): boolean {
    const existed = this.items.delete(id);
    if (existed) this.scheduleFlush();
    return existed;
  }

  /** Drop everything matching `predicate`. Returns the number removed. */
  deleteWhere(predicate: (item: T) => boolean): number {
    let removed = 0;
    for (const [id, item] of this.items) {
      if (predicate(item)) {
        this.items.delete(id);
        removed += 1;
      }
    }
    if (removed) this.scheduleFlush();
    return removed;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.options.flushMs ?? 120);
  }

  /** Await this when a caller needs the data on disk before replying. */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const snapshot = JSON.stringify([...this.items.values()], null, 2);
    this.flushing = this.flushing.then(() => writeAtomic(this.file, snapshot));
    await this.flushing;
  }
}

/**
 * Chunks are stored one file per knowledge base so a large corpus never forces
 * a rewrite of unrelated bases.
 */
export class PartitionedStore<T> {
  private cache = new Map<string, T[]>();

  constructor(private readonly dir: string) {}

  private fileFor(partition: string): string {
    return path.join(this.dir, `${partition}.json`);
  }

  async read(partition: string): Promise<T[]> {
    const cached = this.cache.get(partition);
    if (cached) return cached;
    const rows = await readJson<T[]>(this.fileFor(partition), []);
    this.cache.set(partition, rows);
    return rows;
  }

  async write(partition: string, rows: T[]): Promise<void> {
    this.cache.set(partition, rows);
    await writeAtomic(this.fileFor(partition), JSON.stringify(rows));
  }

  async drop(partition: string): Promise<void> {
    this.cache.delete(partition);
    await fs.rm(this.fileFor(partition), { force: true });
  }
}

export const paths = {
  workflows: path.join(DATA_DIR, "workflows.json"),
  runs: path.join(DATA_DIR, "runs.json"),
  knowledgeBases: path.join(DATA_DIR, "knowledge-bases.json"),
  documents: path.join(DATA_DIR, "documents.json"),
  mcpServers: path.join(DATA_DIR, "mcp-servers.json"),
  tools: path.join(DATA_DIR, "tools.json"),
  chunksDir: path.join(DATA_DIR, "chunks"),
  secrets: path.join(DATA_DIR, "secrets.json"),
  settings: path.join(DATA_DIR, "settings.json"),
};

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  return readJson(file, fallback);
}

export async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await writeAtomic(file, JSON.stringify(value, null, 2));
}

export async function initDataDir(): Promise<void> {
  await ensureDir(DATA_DIR);
  await ensureDir(paths.chunksDir);
}
