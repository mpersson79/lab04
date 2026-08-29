import type {
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDocument,
  RetrievedChunk,
} from "@studio/shared";
import { Collection, PartitionedStore, newId, nowIso, paths } from "../store.ts";
import { LIMITS } from "../config.ts";
import { HttpError } from "../errors.ts";

/* ------------------------------------------------------------------ */
/* Tokenising                                                          */
/* ------------------------------------------------------------------ */

/**
 * Words that carry no retrieval signal. Kept short on purpose - an aggressive
 * stop list hurts phrase queries more than it helps.
 */
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have",
  "he", "in", "is", "it", "its", "of", "on", "or", "that", "the", "their", "them",
  "there", "these", "they", "this", "to", "was", "were", "will", "with", "you", "your",
]);

/** Crude but predictable suffix stripping, so "policies" matches "policy". */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s") && !word.endsWith("us")) return word.slice(0, -1);
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  return word;
}

export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);

  // Bigrams let an exact phrase outrank a bag of the same words scattered
  // across a chunk, which is most of what "semantic" retrieval buys here.
  const bigrams: string[] = [];
  for (let i = 0; i + 1 < words.length; i += 1) {
    bigrams.push(`${words[i]}~${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

function termFrequencies(tokens: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokens) counts[token] = (counts[token] ?? 0) + 1;
  return counts;
}

/* ------------------------------------------------------------------ */
/* Chunking                                                            */
/* ------------------------------------------------------------------ */

/**
 * Split on blank lines first and only fall back to hard slicing for
 * paragraphs that are themselves oversized, so chunks stay readable.
 */
export function chunkText(text: string, size: number, overlap: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).flatMap((paragraph) => {
    const trimmed = paragraph.trim();
    if (trimmed.length <= size) return trimmed ? [trimmed] : [];
    const pieces: string[] = [];
    for (let i = 0; i < trimmed.length; i += size) pieces.push(trimmed.slice(i, i + size));
    return pieces;
  });

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > size) {
      chunks.push(current);
      const tail = overlap > 0 ? current.slice(-overlap) : "";
      // Resume at a word boundary so the overlap does not start mid-word.
      const boundary = tail.indexOf(" ");
      current = boundary > 0 ? `${tail.slice(boundary + 1)}\n\n` : "";
    }
    current += (current ? "\n\n" : "") + paragraph;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

interface BaseIndex {
  /** Document frequency per term across the base. */
  df: Map<string, number>;
  chunkCount: number;
  averageLength: number;
}

export class KnowledgeService {
  readonly bases = new Collection<KnowledgeBase>(paths.knowledgeBases);
  readonly documents = new Collection<KnowledgeDocument>(paths.documents);
  private readonly chunks = new PartitionedStore<KnowledgeChunk>(paths.chunksDir);
  private readonly indexes = new Map<string, BaseIndex>();

  async load(): Promise<void> {
    await this.bases.load();
    await this.documents.load();
  }

  requireBase(baseId: string): KnowledgeBase {
    const base = this.bases.get(baseId);
    if (!base) throw new HttpError(404, `Knowledge base ${baseId} not found`);
    return base;
  }

  async chunksFor(baseId: string): Promise<KnowledgeChunk[]> {
    return this.chunks.read(baseId);
  }

  /** Index one document into a base, replacing nothing. */
  async addDocument(input: {
    baseId: string;
    title: string;
    sourceType: KnowledgeDocument["sourceType"];
    source: string;
    text: string;
  }): Promise<KnowledgeDocument> {
    const base = this.requireBase(input.baseId);
    const text = input.text.trim();
    if (!text) throw new HttpError(400, "Nothing to index - the document is empty.");

    const existing = await this.chunks.read(base.id);
    const pieces = chunkText(text, base.chunkSize, base.chunkOverlap);
    if (existing.length + pieces.length > LIMITS.maxChunksPerBase) {
      throw new HttpError(
        400,
        `That would push "${base.name}" past ${LIMITS.maxChunksPerBase} chunks. Split it across bases.`,
      );
    }

    const document: KnowledgeDocument = {
      id: newId("doc"),
      baseId: base.id,
      title: input.title.trim() || "Untitled",
      sourceType: input.sourceType,
      source: input.source,
      characters: text.length,
      chunkCount: pieces.length,
      createdAt: nowIso(),
    };

    const newChunks: KnowledgeChunk[] = pieces.map((piece, ordinal) => {
      const tokens = tokenize(piece);
      return {
        id: newId("chk"),
        baseId: base.id,
        documentId: document.id,
        documentTitle: document.title,
        ordinal,
        text: piece,
        vector: termFrequencies(tokens),
        length: tokens.length,
      };
    });

    await this.chunks.write(base.id, [...existing, ...newChunks]);
    this.indexes.delete(base.id);
    this.documents.put(document);
    await this.refreshCounts(base.id);
    return document;
  }

  async removeDocument(documentId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) throw new HttpError(404, "Document not found");
    const remaining = (await this.chunks.read(document.baseId)).filter(
      (chunk) => chunk.documentId !== documentId,
    );
    await this.chunks.write(document.baseId, remaining);
    this.indexes.delete(document.baseId);
    this.documents.delete(documentId);
    await this.refreshCounts(document.baseId);
  }

  async removeBase(baseId: string): Promise<void> {
    this.requireBase(baseId);
    this.documents.deleteWhere((document) => document.baseId === baseId);
    this.bases.delete(baseId);
    this.indexes.delete(baseId);
    await this.chunks.drop(baseId);
    await Promise.all([this.bases.flush(), this.documents.flush()]);
  }

  private async refreshCounts(baseId: string): Promise<void> {
    const base = this.bases.get(baseId);
    if (!base) return;
    const chunks = await this.chunks.read(baseId);
    this.bases.put({
      ...base,
      documentCount: this.documents.list().filter((d) => d.baseId === baseId).length,
      chunkCount: chunks.length,
      updatedAt: nowIso(),
    });
    await Promise.all([this.bases.flush(), this.documents.flush()]);
  }

  private async indexFor(baseId: string): Promise<BaseIndex> {
    const cached = this.indexes.get(baseId);
    if (cached) return cached;

    const chunks = await this.chunks.read(baseId);
    const df = new Map<string, number>();
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
      for (const term of Object.keys(chunk.vector)) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const index: BaseIndex = {
      df,
      chunkCount: chunks.length,
      averageLength: chunks.length ? totalLength / chunks.length : 1,
    };
    this.indexes.set(baseId, index);
    return index;
  }

  /**
   * Okapi BM25 across the selected bases.
   *
   * Scores are squashed into 0-1 with `s / (s + 8)` so `minScore` means the
   * same thing whatever the corpus size; the constant is tuned so a chunk that
   * genuinely answers a short query lands around 0.4-0.7.
   */
  async search(options: {
    baseIds: string[];
    query: string;
    topK: number;
    minScore: number;
  }): Promise<RetrievedChunk[]> {
    const queryTokens = [...new Set(tokenize(options.query))];
    if (!queryTokens.length) return [];

    const k1 = 1.4;
    const b = 0.72;
    const results: RetrievedChunk[] = [];

    for (const baseId of options.baseIds) {
      const base = this.bases.get(baseId);
      if (!base) continue;
      const [chunks, index] = await Promise.all([
        this.chunks.read(baseId),
        this.indexFor(baseId),
      ]);
      if (!chunks.length) continue;

      for (const chunk of chunks) {
        let score = 0;
        for (const term of queryTokens) {
          const frequency = chunk.vector[term];
          if (!frequency) continue;
          const documentFrequency = index.df.get(term) ?? 0;
          const idf = Math.log(
            1 + (index.chunkCount - documentFrequency + 0.5) / (documentFrequency + 0.5),
          );
          const norm =
            frequency + k1 * (1 - b + (b * chunk.length) / (index.averageLength || 1));
          score += idf * ((frequency * (k1 + 1)) / norm);
        }
        if (score <= 0) continue;
        results.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          baseId,
          baseName: base.name,
          ordinal: chunk.ordinal,
          text: chunk.text,
          score: score / (score + 8),
        });
      }
    }

    return results
      .filter((result) => result.score >= options.minScore)
      .sort((a, b2) => b2.score - a.score)
      .slice(0, options.topK);
  }
}

/** Format retrieved chunks as the context block an agent sees. */
export function formatContext(chunks: RetrievedChunk[], withCitations = true): string {
  if (!chunks.length) return "No matching sources were found in the selected knowledge bases.";
  return chunks
    .map((chunk, i) => {
      const marker = withCitations ? `[S${i + 1}] ` : "";
      const where = `${chunk.documentTitle} · ${chunk.baseName} · chunk ${chunk.ordinal + 1}`;
      return `${marker}${where}\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
}

export const knowledge = new KnowledgeService();
