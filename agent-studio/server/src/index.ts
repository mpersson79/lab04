import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { LIMITS, PORT, WEB_DIST_DIR, loadDotEnv } from "./config.ts";
import { HttpError } from "./errors.ts";
import { initDataDir } from "./store.ts";
import { loadSecrets, apiKeySource } from "./services/secrets.ts";
import { loadSettings } from "./services/settings.ts";
import { knowledge } from "./services/knowledge.ts";
import { mcp } from "./services/mcp.ts";
import { tools } from "./services/tools.ts";
import { runs } from "./engine/executor.ts";
import workflowRoutes, { workflows } from "./routes/workflows.ts";
import runRoutes from "./routes/runs.ts";
import knowledgeRoutes from "./routes/knowledge.ts";
import mcpRoutes from "./routes/mcp.ts";
import toolRoutes from "./routes/tools.ts";
import settingsRoutes from "./routes/settings.ts";

loadDotEnv();

const app = express();
app.disable("x-powered-by");
app.use(cors());

// The upload endpoint takes a raw body; everything else is JSON.
app.use(
  "/api/knowledge/:id/documents/upload",
  express.raw({ type: "*/*", limit: LIMITS.maxDocumentBytes }),
);
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    apiKey: apiKeySource(),
    counts: {
      workflows: workflows.list().length,
      runs: runs.list().length,
      knowledgeBases: knowledge.bases.list().length,
      mcpServers: mcp.servers.list().length,
      tools: tools.list().length,
    },
  });
});

app.use("/api/workflows", workflowRoutes);
app.use("/api/runs", runRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/mcp-servers", mcpRoutes);
app.use("/api/tools", toolRoutes);
app.use("/api/settings", settingsRoutes);

// Serve the built SPA when it exists, so `npm run build && npm start` gives a
// single-process deployment. In development Vite serves the UI instead.
if (fs.existsSync(WEB_DIST_DIR)) {
  app.use(express.static(WEB_DIST_DIR));
  app.get(/^(?!\/api\/).*/, (_request, response) => {
    response.sendFile(path.join(WEB_DIST_DIR, "index.html"));
  });
}

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "That request did not match the expected shape.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message, details: error.details });
      return;
    }
    if (error instanceof Anthropic.APIError) {
      response.status(502).json({ error: `Anthropic API error ${error.status}: ${error.message}` });
      return;
    }
    console.error("[studio] unhandled error", error);
    response.status(500).json({ error: error instanceof Error ? error.message : "Server error" });
  },
);

async function main(): Promise<void> {
  await initDataDir();
  await Promise.all([
    loadSecrets(),
    loadSettings(),
    workflows.load(),
    runs.load(),
    knowledge.load(),
    mcp.load(),
    tools.load(),
  ]);

  // A run that was mid-flight when the process stopped can never resume.
  for (const run of runs.list()) {
    if (run.status === "running" || run.status === "queued" || run.status === "awaiting_approval") {
      runs.put({
        ...run,
        status: "failed",
        error: "The server restarted while this run was in progress.",
        finishedAt: run.finishedAt ?? new Date().toISOString(),
        pendingApproval: null,
      });
    }
  }
  await runs.flush();

  app.listen(PORT, () => {
    console.log(`[studio] API listening on http://localhost:${PORT}`);
    if (apiKeySource() === "none") {
      console.log("[studio] No Anthropic API key yet - add one in Settings or set ANTHROPIC_API_KEY.");
    }
    if (!fs.existsSync(WEB_DIST_DIR)) {
      console.log("[studio] UI not built; run `npm run dev` for the Vite dev server.");
    }
  });
}

main().catch((error: unknown) => {
  console.error("[studio] failed to start", error);
  process.exit(1);
});
