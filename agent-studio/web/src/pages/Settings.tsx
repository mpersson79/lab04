import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { api } from "../lib/api.ts";
import { useWorkspace } from "../lib/workspace.ts";
import {
  Badge,
  Button,
  Field,
  Select,
  Spinner,
  TextInput,
  Toggle,
  cx,
  useToast,
} from "../components/ui.tsx";

export default function SettingsPage() {
  const toast = useToast();
  const { models, settings, refreshSettings, refresh } = useWorkspace();
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  if (!settings) return <Spinner />;

  const patch = async (change: Parameters<typeof api.updateSettings>[0]) => {
    await api.updateSettings(change);
    await refreshSettings();
  };

  const saveKey = async () => {
    setBusy(true);
    try {
      await api.setApiKey(apiKey.trim());
      setApiKey("");
      await refresh();
      setTestResult(await api.testApiKey());
      toast("ok", "API key saved.");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Could not save the key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <header className="mb-7">
        <h1 className="text-xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Credentials and the guard rails applied to every run.
        </p>
      </header>

      <section className="panel mb-5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound size={15} className="text-ink-muted" />
          <h2 className="text-[14px] font-semibold text-ink">Anthropic API key</h2>
          {settings.apiKey.configured ? (
            <Badge tone="ok">{settings.apiKey.source}</Badge>
          ) : (
            <Badge tone="danger">missing</Badge>
          )}
        </div>

        {settings.apiKey.source === "environment" ? (
          <p className="mb-3 rounded-lg border border-line bg-ground px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <code className="text-ink">ANTHROPIC_API_KEY</code> is set in the server environment
            ({settings.apiKey.masked}). The environment always wins, so anything stored here is
            ignored until you unset it.
          </p>
        ) : settings.apiKey.configured ? (
          <p className="mb-3 text-[12.5px] text-ink-muted">
            Stored key: <code className="text-ink">{settings.apiKey.masked}</code>. It lives in{" "}
            <code>data/secrets.json</code> on the server and is never sent to the browser.
          </p>
        ) : (
          <p className="mb-3 text-[12.5px] leading-relaxed text-human">
            Without a key, agent and router nodes fail immediately. Everything else - retrieval,
            code, HTTP, approvals - still runs.
          </p>
        )}

        <div className="flex gap-2">
          <TextInput
            type="password"
            value={apiKey}
            placeholder="sk-ant-…"
            onChange={(event) => setApiKey(event.target.value)}
            className="font-mono"
          />
          <Button variant="primary" busy={busy} disabled={!apiKey.trim()} onClick={() => void saveKey()}>
            Save
          </Button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            busy={busy}
            disabled={!settings.apiKey.configured}
            onClick={async () => {
              setBusy(true);
              try {
                setTestResult(await api.testApiKey());
              } finally {
                setBusy(false);
              }
            }}
          >
            Test connection
          </Button>
          {settings.apiKey.source === "stored" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await api.clearApiKey();
                await refresh();
                setTestResult(null);
              }}
            >
              Remove stored key
            </Button>
          ) : null}
          {testResult ? (
            <span
              className={cx(
                "flex items-center gap-1.5 text-[12px]",
                testResult.ok ? "text-ok" : "text-danger",
              )}
            >
              {testResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {testResult.message}
            </span>
          ) : null}
        </div>
      </section>

      <section className="panel mb-5 p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">Defaults and limits</h2>

        <Field label="Default model" hint="Used for new agent nodes.">
          <Select
            value={settings.settings.defaultModel}
            onChange={(event) => void patch({ defaultModel: event.target.value })}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Cost limit per run (USD)"
          hint="A run that crosses this stops with an error. Set 0 to disable it - and then watch the meter yourself."
        >
          <TextInput
            type="number"
            step="0.5"
            min={0}
            value={settings.settings.runCostLimitUsd}
            onChange={(event) => void patch({ runCostLimitUsd: Number(event.target.value) })}
          />
        </Field>

        <Field label="Run timeout (seconds)" hint="Wall clock for the whole graph, not per node.">
          <TextInput
            type="number"
            min={10}
            max={3_600}
            value={settings.settings.runTimeoutSeconds}
            onChange={(event) => void patch({ runTimeoutSeconds: Number(event.target.value) })}
          />
        </Field>

        <Toggle
          checked={settings.settings.showCosts}
          onChange={(showCosts) => void patch({ showCosts })}
          label="Show costs on nodes and runs"
          hint="Estimated from token counts and published list prices."
        />
      </section>

      <section className="panel p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">Models</h2>
        <div className="space-y-2">
          {models.map((model) => (
            <div key={model.id} className="rounded-lg border border-line-soft bg-ground p-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-ink">{model.label}</span>
                <code className="font-mono text-[10.5px] text-ink-faint">{model.id}</code>
                <span className="ml-auto text-[11.5px] text-ink-muted">
                  ${model.inputPerMTok} in / ${model.outputPerMTok} out per Mtok
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{model.blurb}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
