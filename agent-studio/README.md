# Agent Studio

A visual builder for multi-agent Claude workflows. Drag agents onto a canvas,
wire them together, point them at your knowledge bases and MCP servers, and
watch the run stream token by token.

```
┌──────────┐   ┌───────────┐   ┌────────┐   ┌──────────────┐   ┌────────┐
│  Input   │──▶│ Retrieval │──▶│ Router │──▶│ Agent (Opus) │──▶│ Output │
└──────────┘   └───────────┘   └───┬────┘   └──────────────┘   └────────┘
                                   └──────▶ ┌──────────────┐        ▲
                                            │ Agent (Haiku)│────────┘
                                            └──────────────┘
```

---

## Quick start

```bash
cd agent-studio
npm install
cp .env.example .env          # then put your key in it, or use the Settings page
npm run dev                   # API on :4319, UI on :5319
```

Open <http://localhost:5319>, pick a template, and press **Run**.

To install the managed service lifecycle process — the knowledge bases, the
service owner's tools and three workflows built around them:

```bash
npm run seed
```

See [seed/README.md](seed/README.md) for what that installs and how to replace
the process documents with your own.

For a single-process deployment:

```bash
npm run build                 # builds the UI into web/dist
npm start                     # server serves the API and the UI on :4319
```

Requires Node 20.11+ (developed on Node 22).

---

## What you can build

### Node types

| Node | What it does |
|---|---|
| **Input** | Where a run starts. Declares the fields a caller fills in; they are readable downstream as `{{input.<key>}}`. |
| **Agent** | A Claude agent. Model, system prompt, effort, thinking, plus any combination of knowledge bases, workspace tools, MCP servers and Anthropic server tools. |
| **Retrieval** | Searches knowledge bases and passes the passages downstream with `[S1]`, `[S2]` citation markers. |
| **Router** | Sends the run down exactly one branch, chosen either by a Claude classifier or by a JavaScript expression. |
| **Code** | Reshapes the payload with a sandboxed JavaScript snippet. No network, no filesystem, hard timeout. |
| **HTTP request** | Calls an external API. URL, headers and body are templated. |
| **Human approval** | Pauses the run until a person approves, edits or rejects. The edit becomes the node's output. |
| **Output** | Renders the run's answer from a template. |

Nodes run as soon as every incoming edge resolves, so independent branches
execute concurrently. When a router picks a branch, the others are marked dead
and everything downstream of them is skipped rather than failed.

### Templates

Six general starting points ship with the studio: a blank canvas, a research
brief with web search, support triage with retrieval and routing, a content
pipeline with a human review gate, an MCP operator, and a grounded Q&A workflow
with a groundedness checker.

Three more encode a managed service development and lifecycle process, installed
together with the process documents they read by `npm run seed`:

| Workflow | Shape |
|---|---|
| **Service lifecycle gate review** | A gate submission is routed to the assessor for its stage, checked against the published gate criteria, reviewed for risk and compliance, held for the service owner's decision, then written up as a gate decision record. |
| **Service owner control desk** | The recurring service owner review, run as five specialists in parallel — reliability, change, cost and margin, risk, customer — consolidated by a chief of staff into a RAG status and a prioritised action list. |
| **Service onboarding & readiness** | Readiness review, runbook gap analysis and the customer pack in parallel, consolidated into a dated plan working backwards from go-live, held for sign-off. |

The process itself lives as Markdown under [`seed/knowledge/`](seed/knowledge/):
the lifecycle stages and gate criteria, the service owner's accountabilities and
full task cadence, the operations standards, and the commercial and compliance
controls. Edit those files and re-run the seed and every agent is grounded in
your process rather than the shipped default.

---

## Connecting Claude

Set `ANTHROPIC_API_KEY` in the environment, or paste a key into **Settings**. The
environment always wins, so a deployment can pin a credential the UI cannot
replace. A stored key lives in `data/secrets.json` and is never returned to the
browser — the Settings page only ever sees a masked form.

Models available in the picker, with the pricing used to cost every run:

| Model | Context | $/Mtok in | $/Mtok out |
|---|---|---|---|
| `claude-opus-5` | 1M | $5 | $25 |
| `claude-sonnet-5` | 1M | $2 | $10 |
| `claude-haiku-4-5` | 200K | $1 | $5 |

Agent nodes stream through the Messages API with adaptive thinking on by
default. The tool loop is written out rather than delegated to the SDK's tool
runner, because the studio needs to interleave its own event stream, MCP
connectors and client-side tools in the same loop — including resuming a
`pause_turn` when a server-side tool runs long.

---

## Knowledge sources

Create a knowledge base, then add content by pasting text, uploading files, or
giving it a URL to fetch. Text formats only: `.txt`, `.md`, `.json`, `.csv`,
`.html` and source files. PDFs are rejected with a clear message rather than
indexed as garbage.

Retrieval is **Okapi BM25 over chunked text**, with unigrams and bigrams and a
light stemmer, scored locally. That means no embedding API, no vector database,
no per-query cost, and results you can explain — the trade is that it matches on
words rather than meaning, so a query that shares no vocabulary with the source
will miss. The **Try a query** box on the Knowledge page exists so you can find
that out in two seconds rather than mid-run.

An agent can use a base two ways:

- **Inject** — one search runs before the first turn and the passages go into the
  cached system prompt. Predictable, cheap, one round trip.
- **Agentic** — the agent gets a `search_knowledge` tool and decides when and
  what to look up. Better for multi-hop questions, costs more turns.

---

## MCP servers

Register a Model Context Protocol server once and attach it to any agent node.
The studio probes it on save and shows the tool list on the card.

Two execution modes:

- **Anthropic connector** — the server URL is handed to Anthropic, which connects
  to it directly (`mcp_servers` + `mcp_toolset`, beta `mcp-client-2025-11-20`).
  Lowest latency, but the URL must be reachable from the public internet.
- **Proxy through studio** — this process holds the MCP connection and re-exposes
  each tool to the model as an ordinary client-side tool. Slower, and it works
  for servers on `localhost` or behind your VPN.

Auth tokens are stored server-side in `data/mcp-servers-secrets.json` and are
never sent to the browser. An allowlist restricts which of a server's tools an
agent may call.

---

## Workspace tools

Define a tool once on the **Tools** page and attach it to any agent:

- **HTTP tools** call an API. The URL, headers and body are templated, so the
  model's arguments arrive as `{{input.field}}` and secrets come from the server
  environment as `{{env.MY_TOKEN}}` — the model never sees the credential.
- **Code tools** run a synchronous JavaScript snippet in the same sandbox the
  Code node uses.

Both execute in this server process, not on Anthropic's infrastructure. Each
tool has a **Test it** box so you can debug the tool separately from the agent
that calls it.

---

## Runs

Every execution is recorded in full: the rendered prompt for each node, streamed
text and thinking, every tool call with its arguments and result, the retrieved
passages with their scores, per-node token usage and cost, and the final output.
The run panel streams live over server-sent events, and the server replays the
backlog on connect — so opening a run halfway through still shows the whole
transcript.

Two guard rails apply to every run, both configurable in Settings: a dollar
ceiling checked after each wave of nodes, and a wall-clock timeout for the whole
graph.

---

## Architecture

```
agent-studio/
├── shared/src/          Zod schemas and types shared by both sides
│   ├── models.ts        Model catalogue, pricing, usage arithmetic
│   ├── workflow.ts      Node/edge/workflow schemas
│   ├── resources.ts     Knowledge, MCP, tools, settings
│   ├── runs.ts          Run, node run and streaming event types
│   └── templates.ts     The starter workflow gallery
├── server/src/
│   ├── engine/          The interesting part
│   │   ├── executor.ts  DAG scheduling, branching, skips, approvals
│   │   ├── agent.ts     Toolset assembly and the streaming agent loop
│   │   └── bus.ts       Per-run event fan-out with replay
│   ├── services/        Knowledge (BM25), MCP client, tools, secrets
│   ├── routes/          REST API
│   └── util/            Template renderer, vm sandbox
└── web/src/
    ├── canvas/          React Flow canvas, node renderer, palette
    ├── components/      Inspector, run panel, UI primitives
    └── pages/           Workflows, Builder, Runs, Knowledge, MCP, Tools, Settings
```

State lives in JSON files under `data/`, one per collection, with chunk indexes
partitioned per knowledge base. That is a deliberate choice for a single-user
workspace: a file you can open in an editor beats a database you cannot inspect,
and the repository layer is small enough to swap if this ever needs to be
multi-tenant.

### Things worth knowing before you rely on this

- **The Code node sandbox is `node:vm`.** That is an isolation boundary, not a
  security boundary — it stops a snippet from touching the network or filesystem
  by accident, but it is not a defence against someone who already has write
  access to your workflows. The studio is single-user by design; anything
  multi-tenant needs a real sandbox.
- **There is no authentication.** Bind it to localhost, or put it behind
  something that does authenticate.
- **Costs are estimates**, computed from returned token counts and published list
  prices. Treat them as a meter, not an invoice.

---

## API

Everything the UI does is available over HTTP.

| Method | Path | |
|---|---|---|
| `GET` | `/api/workflows` | list |
| `POST` | `/api/workflows` | create from a template |
| `GET` | `/api/workflows/:id` | workflow plus lint issues |
| `PUT` | `/api/workflows/:id` | update (all fields optional) |
| `POST` | `/api/runs` | start a run |
| `GET` | `/api/runs/:id/events` | SSE event stream, with backlog replay |
| `POST` | `/api/runs/:id/approval` | approve or reject a parked run |
| `POST` | `/api/runs/:id/cancel` | cancel |
| `POST` | `/api/knowledge/:id/documents` | index text or a URL |
| `POST` | `/api/knowledge/:id/documents/upload` | index a file (raw body) |
| `POST` | `/api/knowledge/search` | try a query |
| `POST` | `/api/mcp-servers/:id/test` | reconnect and refresh the tool list |
| `POST` | `/api/tools/:id/test` | run a tool with sample input |

---

## Scripts

| Command | |
|---|---|
| `npm run dev` | API and UI with hot reload |
| `npm run build` | build the UI into `web/dist` |
| `npm start` | serve API and built UI from one process |
| `npm run typecheck` | typecheck all three packages |
