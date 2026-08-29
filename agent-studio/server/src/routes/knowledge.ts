import { Router } from "express";
import {
  KnowledgeBaseDraftSchema,
  KnowledgeBasePatchSchema,
  KnowledgeBaseSchema,
  type KnowledgeBase,
} from "@studio/shared";
import { knowledge } from "../services/knowledge.ts";
import { decodeDocument, fetchAsText } from "../services/text.ts";
import { newId, nowIso } from "../store.ts";
import { HttpError, badRequest } from "../errors.ts";
import { LIMITS } from "../config.ts";

const router = Router();

router.get("/", (_request, response) => {
  response.json(knowledge.bases.list().sort((a, b) => a.name.localeCompare(b.name)));
});

router.post("/", async (request, response) => {
  const draft = KnowledgeBaseDraftSchema.parse(request.body);
  const now = nowIso();
  const base: KnowledgeBase = KnowledgeBaseSchema.parse({
    ...draft,
    id: newId("kb"),
    documentCount: 0,
    chunkCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  knowledge.bases.put(base);
  await knowledge.bases.flush();
  response.status(201).json(base);
});

router.put("/:id", async (request, response) => {
  const base = knowledge.requireBase(request.params.id);
  const draft = KnowledgeBasePatchSchema.parse(request.body);
  const updated = { ...base, ...draft, updatedAt: nowIso() };
  knowledge.bases.put(updated);
  await knowledge.bases.flush();
  response.json(updated);
});

router.delete("/:id", async (request, response) => {
  await knowledge.removeBase(request.params.id);
  response.status(204).end();
});

router.get("/:id/documents", (request, response) => {
  knowledge.requireBase(request.params.id);
  response.json(
    knowledge.documents
      .list()
      .filter((document) => document.baseId === request.params.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
});

/** Paste text, or point at a URL and let the server fetch it. */
router.post("/:id/documents", async (request, response) => {
  const base = knowledge.requireBase(request.params.id);
  const body = request.body as { title?: string; text?: string; url?: string };

  if (body.url) {
    const fetched = await fetchAsText(body.url);
    const document = await knowledge.addDocument({
      baseId: base.id,
      title: body.title?.trim() || fetched.title || body.url,
      sourceType: "url",
      source: body.url,
      text: fetched.text,
    });
    response.status(201).json(document);
    return;
  }

  if (!body.text?.trim()) throw badRequest("Provide either `text` or `url`.");
  const document = await knowledge.addDocument({
    baseId: base.id,
    title: body.title?.trim() || "Pasted text",
    sourceType: "text",
    source: "",
    text: body.text,
  });
  response.status(201).json(document);
});

/**
 * File upload as a raw body, so the studio needs no multipart dependency.
 * The browser sends the File object directly with `?filename=`.
 */
router.post("/:id/documents/upload", async (request, response) => {
  const base = knowledge.requireBase(request.params.id);
  const filename =
    typeof request.query.filename === "string" ? request.query.filename : "upload.txt";
  const bytes = request.body as Buffer;

  if (!Buffer.isBuffer(bytes) || !bytes.length) throw badRequest("The upload was empty.");
  if (bytes.length > LIMITS.maxDocumentBytes) {
    throw new HttpError(
      413,
      `${filename} is larger than ${Math.round(LIMITS.maxDocumentBytes / 1024 / 1024)} MB.`,
    );
  }

  const decoded = decodeDocument(bytes, filename, request.get("content-type") ?? "");
  const document = await knowledge.addDocument({
    baseId: base.id,
    title: decoded.title || filename,
    sourceType: "file",
    source: filename,
    text: decoded.text,
  });
  response.status(201).json(document);
});

router.delete("/:id/documents/:documentId", async (request, response) => {
  knowledge.requireBase(request.params.id);
  await knowledge.removeDocument(request.params.documentId);
  response.status(204).end();
});

/** Try a query against one or more bases without running a workflow. */
router.post("/search", async (request, response) => {
  const body = request.body as {
    baseIds?: string[];
    query?: string;
    topK?: number;
    minScore?: number;
  };
  if (!body.query?.trim()) throw badRequest("`query` is required.");
  const baseIds = body.baseIds?.length
    ? body.baseIds
    : knowledge.bases.list().map((base) => base.id);

  const results = await knowledge.search({
    baseIds,
    query: body.query,
    topK: Math.min(body.topK ?? 8, 50),
    minScore: body.minScore ?? 0,
  });
  response.json(results);
});

export default router;
