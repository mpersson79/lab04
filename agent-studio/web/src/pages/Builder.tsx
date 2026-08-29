import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Loader2,
  Play,
  Save,
  TriangleAlert,
} from "lucide-react";
import { useBuilder } from "../lib/builder.ts";
import { useWorkspace } from "../lib/workspace.ts";
import Canvas from "../canvas/Canvas.tsx";
import Palette from "../canvas/Palette.tsx";
import Inspector from "../components/Inspector.tsx";
import RunPanel from "../components/RunPanel.tsx";
import { Button, Spinner, TextInput, cx, useDebounced, useToast } from "../components/ui.tsx";

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const workflow = useBuilder((state) => state.workflow);
  const issues = useBuilder((state) => state.issues);
  const dirty = useBuilder((state) => state.dirty);
  const saving = useBuilder((state) => state.saving);
  const streaming = useBuilder((state) => state.streaming);
  const { load, save, setMeta } = useBuilder.getState();
  const settings = useWorkspace((state) => state.settings);

  const [error, setError] = useState<string | null>(null);
  const [showRun, setShowRun] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError(null);
    load(id).catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : "Could not load this workflow."),
    );
  }, [id, load]);

  // Autosave: the canvas is a document, and losing an edit to a stray refresh
  // is the fastest way to make a builder feel untrustworthy.
  const debouncedDirty = useDebounced(dirty, 900);
  useEffect(() => {
    if (debouncedDirty && !streaming) {
      save().catch((saveError: unknown) =>
        toast("error", saveError instanceof Error ? saveError.message : "Autosave failed."),
      );
    }
  }, [debouncedDirty, streaming, save, toast]);

  // Ctrl/Cmd+S saves immediately, because muscle memory wins.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <CircleAlert size={22} className="text-danger" />
        <p className="text-[13px] text-ink">{error}</p>
        <Link to="/workflows" className="text-[13px] text-accent underline underline-offset-2">
          Back to workflows
        </Link>
      </div>
    );
  }

  if (!workflow) return <Spinner label="Loading workflow…" />;

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const warningCount = issues.length - errorCount;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2">
        <Link
          to="/workflows"
          className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
          aria-label="Back to workflows"
        >
          <ArrowLeft size={16} />
        </Link>

        <TextInput
          value={workflow.name}
          onChange={(event) => setMeta({ name: event.target.value })}
          className="max-w-[280px] border-transparent bg-transparent text-[14px] font-semibold hover:border-line"
        />

        <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          {saving ? (
            <>
              <Loader2 size={11} className="animate-spin" />
              Saving
            </>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            <>
              <Check size={11} className="text-ok" />
              Saved
            </>
          )}
        </span>

        {issues.length ? (
          <span
            title={issues.map((issue) => issue.message).join("\n")}
            className={cx(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
              errorCount ? "bg-[#3a1218] text-danger" : "bg-[#3a3210] text-human",
            )}
          >
            <TriangleAlert size={11} />
            {errorCount ? `${errorCount} error${errorCount === 1 ? "" : "s"}` : null}
            {errorCount && warningCount ? ", " : null}
            {warningCount ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : null}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" icon={Save} onClick={() => void save()} disabled={!dirty}>
            Save
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Play}
            onClick={() => setShowRun(true)}
            disabled={showRun && streaming}
          >
            Run
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette />
        <div className="min-w-0 flex-1">
          <Canvas showCosts={settings?.settings.showCosts ?? true} />
        </div>
        <Inspector />
        {showRun ? <RunPanel onClose={() => setShowRun(false)} /> : null}
      </div>
    </div>
  );
}
