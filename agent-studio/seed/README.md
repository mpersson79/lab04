# Managed service process seed

`npm run seed` installs the managed service development and lifecycle process
into a workspace: four knowledge bases built from the Markdown in this
directory, the service owner's tools, and three workflows wired to them.

```bash
npm run seed              # install; skips anything already present
npm run seed -- --reindex # rebuild the seeded knowledge bases from disk
```

Seed with the server stopped, or restart it afterwards. The server keeps the
collections in memory and writes them back on change, so it will not see what
the seed wrote underneath it — and could overwrite it.

## Read this first

**The process documents here are a starting point, not your process.** They are
written from standard managed-service and SRE practice — an eight-stage
lifecycle with gates, a service owner accountability model, SLO and error budget
policy, incident and change standards, and commercial and compliance controls.
They are specific and opinionated so the agents have something concrete to
assess against, but the numbers are invented: our margin targets, our
remediation SLAs, our severity definitions, our tier table.

Replace them with yours. Edit the files, run `npm run seed -- --reindex`, and
every agent in every workflow is grounded in the real thing. That is the whole
point of keeping the process in Markdown in the repository rather than pasted
into prompts — it is diffable, reviewable, and one file per topic.

## What gets installed

### Knowledge bases

| Base | From | Covers |
|---|---|---|
| Service lifecycle handbook | `knowledge/service-lifecycle-handbook/` | The eight stages, exit criteria for each gate, the artifact register, the gate decision record format |
| Service owner playbook | `knowledge/service-owner-playbook/` | Accountabilities, decision rights, the full daily/weekly/monthly/quarterly task cadence, RACI, escalation |
| Operations standards | `knowledge/operations-standards/` | SLA and SLO tiers, error budget policy, incident severities, problem management, the runbook standard, change classes |
| Commercial & compliance | `knowledge/commercial-and-compliance/` | Charge models, cost to serve, margin targets, risk scoring, vulnerability SLAs, access, data, evidence |

Every retrieval node and every knowledge-using agent in the seeded workflows is
pointed at all four, so an assessor looking at a design gate can still reach the
margin target and the remediation SLA.

### Tools

| Tool | Kind | Status |
|---|---|---|
| `error_budget_status` | code | Works immediately. Computes budget consumed, burn rate and the policy step that applies. |
| `sla_credit` | code | Works immediately. Computes the credit owed from tier and attainment. |
| `service_desk_search` | http | **Needs configuration** — set `SERVICE_DESK_URL` and `SERVICE_DESK_TOKEN`. |
| `cost_report` | http | **Needs configuration** — set `FINOPS_URL` and `FINOPS_TOKEN`. |

The two code tools are attached to the reliability agent in the control desk
workflow, so the error budget policy step is computed rather than estimated.

The two HTTP tools are shipped unattached because they call systems only you
have. Put the base URL and token in the server environment, adjust the paths in
the tool editor to match your API, test it with the **Test it** box on the Tools
page, then attach it to whichever agents should use it. The credentials are
interpolated server-side from `{{env.*}}`, so the model never sees them.

### Workflows

**Service lifecycle gate review** — a gate submission is checked against the
retrieved criteria by the assessor for its stage, then reviewed for risk and
compliance, then held for the service owner's decision, then written up as a
gate decision record.

```
Gate submission → Gate criteria → Stage lane ─┬→ Intake / Design assessor ──┐
                                              ├→ Build / Validate assessor ─┤
                                              ├→ Launch assessor ───────────┼→ Risk & compliance
                                              └→ Operate / Retire assessor ─┘         │
                                                                                      ▼
        Gate decision record ← Decision record ← ★ Service owner decision ────────────┘
```

The router reads the work described rather than trusting the stage label, so a
submission that says "design" but describes readiness testing is routed to the
build and validate assessor.

**Service owner control desk** — the recurring review, run as five specialists
in parallel and consolidated into one page.

```
                    ┌→ Reliability ──┐
                    ├→ Change ───────┤
Inputs → Standards ─┼→ Cost & margin ┼→ Owner briefing → Output
                    ├→ Risk ─────────┤
                    └→ Customer ─────┘
```

The five lanes map onto the cadence in the service owner playbook. Paste
whatever signals you have — incidents, SLO numbers, change records, a cost
export, feedback — and the lanes each say what their part of the policy
requires. The briefing agent orders actions by consequence, names what needs
escalating above the owner's delegation, and says what it checked and found
fine.

**Service onboarding & readiness** — readiness review, runbook gap analysis and
the customer pack in parallel, consolidated into a dated plan working backwards
from go-live, held for sign-off.

★ marks a human approval gate: the run pauses there until someone approves,
edits or rejects it in the run panel.

## Wiring in your own systems

The workflows are deliberately fed by pasted signals so they work on day one.
To connect them to live systems, either:

- **Workspace tools** — configure `service_desk_search` and `cost_report`
  against your service desk and FinOps APIs, then attach them to the relevant
  agents. Best when you have a plain REST API and want tight control over what
  the agent can call.
- **MCP servers** — register your ServiceNow, Jira, GitHub, Datadog or
  PagerDuty MCP server on the **MCP servers** page and attach it to the agents.
  Best when a server already exists, since you get its whole tool surface. Use
  proxy mode for anything on a private network.

Either way, once an agent can fetch its own signals you can drop the pasted
`signals` input field and run the control desk on a schedule.

## Editing the process

- One topic per file. The chunker splits on blank lines, so keep paragraphs and
  table rows intact and they will stay together in retrieval.
- Start each file with a `# Heading` — it becomes the document title shown next
  to every retrieved passage, so make it descriptive.
- After editing, run `npm run seed -- --reindex`. Adding a new file only needs a
  plain `npm run seed`.
- Retrieval is lexical (BM25), so the words matter: if your team says "ORR",
  write "operational readiness review (ORR)" once so both hit.
