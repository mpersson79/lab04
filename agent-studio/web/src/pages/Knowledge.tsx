import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, FileText, Link2, Plus, Search, Trash2, Upload } from "lucide-react";
import type { KnowledgeBase, KnowledgeDocument, RetrievedChunk } from "@studio/shared";
import { api } from "../lib/api.ts";
import { useWorkspace } from "../lib/workspace.ts";
import { formatBytes, formatRelative } from "../lib/format.ts";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Spinner,
  TextArea,
  TextInput,
  cx,
  useToast,
} from "../components/ui.tsx";

const SOURCE_ICON = { text: FileText, file: Upload, url: Link2 } as const;

export default function KnowledgePage() {
  const toast = useToast();
  const refreshKnowledge = useWorkspace((state) => state.refreshKnowledge);
  const [bases, setBases] = useState<KnowledgeBase[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const selected = bases?.find((base) => base.id === selectedId) ?? null;

  const loadBases = useCallback(async () => {
    const list = await api.listKnowledgeBases();
    setBases(list);
    setSelectedId((current) => current ?? list[0]?.id ?? null);
    void refreshKnowledge();
  }, [refreshKnowledge]);

  useEffect(() => {
    void loadBases();
  }, [loadBases]);

  useEffect(() => {
    if (!selectedId) {
      setDocuments([]);
      return;
    }
    api.listDocuments(selectedId).then(setDocuments).catch(() => setDocuments([]));
  }, [selectedId]);

  const reloadDocuments = async () => {
    if (!selectedId) return;
    setDocuments(await api.listDocuments(selectedId));
    await loadBases();
  };

  const createBase = async () => {
    if (!newName.trim()) return;
    const base = await api.createKnowledgeBase({ name: newName.trim() });
    setCreating(false);
    setNewName("");
    setSelectedId(base.id);
    await loadBases();
  };

  const deleteBase = async (base: KnowledgeBase) => {
    if (!confirm(`Delete "${base.name}" and everything indexed in it?`)) return;
    await api.deleteKnowledgeBase(base.id);
    setSelectedId(null);
    await loadBases();
    toast("ok", `Deleted "${base.name}".`);
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Knowledge</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
            Text you index here is searchable from any agent, either injected into its prompt or
            offered as a tool it can call. Retrieval is BM25 over chunked text - local, fast, and
            no embedding bill.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
          New base
        </Button>
      </header>

      {bases === null ? (
        <Spinner />
      ) : bases.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No knowledge bases"
          description="Create one, then paste text, upload files or point it at a URL. Agents can search it during a run."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New knowledge base
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="panel h-fit p-1.5">
            {bases.map((base) => (
              <button
                key={base.id}
                onClick={() => setSelectedId(base.id)}
                className={cx(
                  "flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors",
                  base.id === selectedId ? "bg-hover" : "hover:bg-raised",
                )}
              >
                <span className="truncate text-[13px] font-medium text-ink">{base.name}</span>
                <span className="text-[11px] text-ink-faint">
                  {base.documentCount} docs · {base.chunkCount} chunks
                </span>
              </button>
            ))}
          </nav>

          {selected ? (
            <div>
              <div className="panel mb-4 flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-semibold text-ink">{selected.name}</h2>
                  <p className="text-[11.5px] text-ink-faint">
                    chunk size {selected.chunkSize} · overlap {selected.chunkOverlap}
                  </p>
                </div>
                <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
                  Add content
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void deleteBase(selected)}
                  aria-label="Delete base"
                >
                  <Trash2 size={14} />
                </Button>
              </div>

              <SearchTester baseId={selected.id} />

              <div className="panel divide-y divide-line-soft">
                {documents.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-ink-faint">
                    Nothing indexed yet.
                  </p>
                ) : (
                  documents.map((document) => {
                    const Icon = SOURCE_ICON[document.sourceType];
                    return (
                      <div
                        key={document.id}
                        className="group flex items-center gap-3 px-4 py-2.5 hover:bg-raised"
                      >
                        <Icon size={13} className="shrink-0 text-ink-faint" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-ink">{document.title}</p>
                          <p className="truncate text-[11px] text-ink-faint">
                            {document.source || "pasted"} · {formatBytes(document.characters)} ·{" "}
                            {formatRelative(document.createdAt)}
                          </p>
                        </div>
                        <Badge>{document.chunkCount} chunks</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={async () => {
                            await api.deleteDocument(selected.id, document.id);
                            await reloadDocuments();
                          }}
                          aria-label="Remove document"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New knowledge base"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void createBase()}>
              Create
            </Button>
          </>
        }
      >
        <Field label="Name">
          <TextInput
            autoFocus
            value={newName}
            placeholder="Support handbook"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createBase();
            }}
          />
        </Field>
      </Modal>

      {selected ? (
        <AddContentModal
          open={adding}
          baseId={selected.id}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void reloadDocuments();
          }}
        />
      ) : null}
    </div>
  );
}

function AddContentModal({
  open,
  baseId,
  onClose,
  onAdded,
}: {
  open: boolean;
  baseId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"text" | "url" | "file">("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setBusy(true);
    try {
      if (tab === "file") {
        const files = fileInput.current?.files;
        if (!files?.length) throw new Error("Choose a file first.");
        for (const file of Array.from(files)) await api.uploadDocument(baseId, file);
        toast("ok", `Indexed ${files.length} file${files.length === 1 ? "" : "s"}.`);
      } else if (tab === "url") {
        await api.addDocument(baseId, { url: url.trim(), title: title.trim() || undefined });
        toast("ok", "Fetched and indexed.");
      } else {
        await api.addDocument(baseId, { text, title: title.trim() || undefined });
        toast("ok", "Indexed.");
      }
      setTitle("");
      setText("");
      setUrl("");
      onAdded();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not index that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add content"
      description="Text formats only: .txt, .md, .json, .csv, .html and source files."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={() => void submit()}>
            Index it
          </Button>
        </>
      }
    >
      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-ground p-1">
        {(["text", "file", "url"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTab(option)}
            className={cx(
              "flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
              tab === option ? "bg-hover text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {option === "text" ? "Paste text" : option === "file" ? "Upload files" : "From URL"}
          </button>
        ))}
      </div>

      <Field label="Title" hint="Optional. Shown next to every passage retrieved from this source.">
        <TextInput
          value={title}
          placeholder="Refund policy"
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      {tab === "text" ? (
        <Field label="Text">
          <TextArea
            rows={14}
            value={text}
            placeholder="Paste the document here…"
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
      ) : tab === "url" ? (
        <Field label="URL" hint="The server fetches the page and strips it down to readable text.">
          <TextInput
            value={url}
            placeholder="https://docs.example.com/policies"
            onChange={(event) => setUrl(event.target.value)}
          />
        </Field>
      ) : (
        <Field label="Files">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.json,.csv,.tsv,.html,.htm,.log,.yaml,.yml,.ts,.js,.py,.go,.java,.sql"
            className="field cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-hover file:px-2 file:py-1 file:text-[12px] file:text-ink"
          />
        </Field>
      )}
    </Modal>
  );
}

function SearchTester({ baseId }: { baseId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievedChunk[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      setResults(await api.searchKnowledge({ baseIds: [baseId], query, topK: 5 }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mb-4 p-4">
      <h3 className="label-text">Try a query</h3>
      <div className="flex gap-2">
        <TextInput
          value={query}
          placeholder="What would an agent ask this base?"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void search();
          }}
        />
        <Button icon={Search} busy={busy} onClick={() => void search()}>
          Search
        </Button>
      </div>

      {results ? (
        results.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-ink-faint">
            Nothing matched. Retrieval is lexical, so try the words the document itself uses.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {results.map((result, index) => (
              <div key={result.chunkId} className="rounded-lg border border-line-soft bg-ground p-2.5">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-ink-faint">
                  <Badge>S{index + 1}</Badge>
                  <span className="truncate">{result.documentTitle}</span>
                  <span className="ml-auto">{result.score.toFixed(3)}</span>
                </div>
                <p className="line-clamp-4 text-[12px] leading-relaxed text-ink-muted">
                  {result.text}
                </p>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
