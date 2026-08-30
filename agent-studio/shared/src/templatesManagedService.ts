import { edge, type WorkflowTemplate } from "./templateTypes.ts";

/**
 * Workflows that encode the managed service development and lifecycle process,
 * and the recurring work a service owner does.
 *
 * They are wired to knowledge bases by `npm run seed`, which indexes the
 * process documents under `seed/knowledge/` and then fills in the base ids on
 * every retrieval node and agent. Created by hand instead, the knowledge
 * selectors start empty and the workflow lints with a warning until you pick
 * bases in the inspector.
 */

/** Shared rules every assessor in the gate review works under. */
const ASSESSOR_RULES = `You assess a managed service against the published gate criteria. You are strict and you are specific.

Rules:
- Judge only against the criteria retrieved from the handbook. Do not invent criteria and do not soften the ones that exist.
- A criterion with no evidence is a gap, not a pass. Absent evidence and stale evidence are treated the same way.
- Grade every gap as blocking, material or minor, and say which criterion it fails.
- Name the artifact and the owner that would close each gap.
- Where the submission is ambiguous, say what you would need to see rather than guessing.
- Be brief. One line per criterion, not a paragraph.`;

export const MANAGED_SERVICE_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "service-gate-review",
    name: "Service lifecycle gate review",
    description:
      "Routes a gate submission to the right stage assessor, checks it against the published gate criteria, adds a risk and compliance review, then holds for the service owner's decision and writes the gate decision record.",
    tags: ["managed service", "lifecycle", "governance"],
    icon: "🚦",
    requires: ["knowledge"],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Gate submission",
        position: { x: 40, y: 330 },
        config: {
          fields: [
            {
              key: "service_name",
              label: "Service",
              type: "text",
              required: true,
              placeholder: "Managed Postgres",
              defaultValue: "",
            },
            {
              key: "stage",
              label: "Gate being requested",
              type: "text",
              required: true,
              placeholder: "design | build | validate | launch | operate | retire",
              defaultValue: "design",
            },
            {
              key: "summary",
              label: "What is being submitted",
              type: "longtext",
              required: true,
              placeholder:
                "What has been done since the last gate, and what you are asking to be allowed to do next.",
              defaultValue: "",
            },
            {
              key: "evidence",
              label: "Evidence",
              type: "longtext",
              required: false,
              placeholder:
                "One line per artifact: name, where it lives, and when it was last updated.",
              defaultValue: "",
            },
          ],
        },
      },
      {
        id: "criteria",
        kind: "knowledge",
        name: "Gate criteria",
        position: { x: 330, y: 330 },
        config: {
          query:
            "Gate criteria and required artifacts for the {{input.stage}} stage of the managed service lifecycle. {{input.summary}}",
          topK: 10,
          minScore: 0.03,
          includeCitations: true,
        },
      },
      {
        id: "lane",
        kind: "router",
        name: "Stage lane",
        position: { x: 620, y: 330 },
        config: {
          mode: "llm",
          model: "claude-haiku-4-5",
          instructions:
            "Pick the lane for this gate submission. The submitter states a stage, but trust the description of the work over the stated label when they disagree — a submission that describes readiness testing is a build_validate submission even if it says 'design'.",
          prompt:
            "Stated stage: {{input.stage}}\n\nSubmission:\n{{input.summary}}\n\nEvidence:\n{{input.evidence}}",
          routes: [
            {
              id: "concept_design",
              label: "Intake / Design",
              description:
                "Service concept, business case, architecture, SLA and SLO definition, cost model, support model. Nothing built yet.",
            },
            {
              id: "build_validate",
              label: "Build / Validate",
              description:
                "Implementation, IaC, pipelines, observability, runbooks, DR, operational readiness review, penetration test, load test.",
            },
            {
              id: "launch",
              label: "Launch",
              description:
                "Catalogue entry, pricing, first customer onboarding, hypercare and its exit criteria.",
            },
            {
              id: "operate_retire",
              label: "Operate / Retire",
              description:
                "Steady state performance against SLOs, continual improvement, or withdrawal of the service.",
            },
          ],
          fallbackRouteId: "concept_design",
        },
      },
      {
        id: "design_assessor",
        kind: "agent",
        name: "Design assessor",
        position: { x: 920, y: 40 },
        config: {
          model: "claude-opus-5",
          systemPrompt: `${ASSESSOR_RULES}\n\nYou cover the Intake and Design gates. You care most about the promises being made: an SLO agreed here is one the operate team lives with for years. Check that the internal SLO is strictly tighter than the SLA, that every external dependency is listed with its failure behaviour, and that the unit cost model counts operate effort and not only infrastructure.`,
          prompt:
            "Service: {{input.service_name}}\nGate requested: {{input.stage}}\n\nSubmission:\n{{input.summary}}\n\nEvidence offered:\n{{input.evidence}}\n\nCriteria and standards retrieved from the handbook:\n{{nodes.criteria.output}}\n\nAssess it. Give: criteria met, gaps with grades, missing artifacts, and a recommended decision of Pass, Pass with conditions, or Hold.",
          knowledge: { mode: "tool", baseIds: [], topK: 8, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 8000,
          maxIterations: 8,
        },
      },
      {
        id: "build_assessor",
        kind: "agent",
        name: "Build & readiness assessor",
        position: { x: 920, y: 220 },
        config: {
          model: "claude-opus-5",
          systemPrompt: `${ASSESSOR_RULES}\n\nYou cover the Build and Validate gates. You care most about the difference between configured and proven: a backup that has never been restored is not a backup, a rollback that has never been executed is not a rollback, and a runbook nobody else has walked through is not a runbook. Check that alerts are bound to SLOs rather than raw resource metrics, and that the DR rehearsal produced a measured RTO and RPO rather than a plan.`,
          prompt:
            "Service: {{input.service_name}}\nGate requested: {{input.stage}}\n\nSubmission:\n{{input.summary}}\n\nEvidence offered:\n{{input.evidence}}\n\nCriteria and standards retrieved from the handbook:\n{{nodes.criteria.output}}\n\nAssess it. Give: criteria met, gaps with grades, missing artifacts, and a recommended decision of Pass, Pass with conditions, or Hold.",
          knowledge: { mode: "tool", baseIds: [], topK: 8, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 8000,
          maxIterations: 8,
        },
      },
      {
        id: "launch_assessor",
        kind: "agent",
        name: "Launch assessor",
        position: { x: 920, y: 400 },
        config: {
          model: "claude-opus-5",
          systemPrompt: `${ASSESSOR_RULES}\n\nYou cover the Launch gate. You care most about whether the service can actually be bought, supported and billed — not whether it works in a demo. Check that a real customer has been onboarded end to end including billing, that support routing has been proven with a real ticket, and that the hypercare exit criteria were agreed in advance rather than declared met afterwards.`,
          prompt:
            "Service: {{input.service_name}}\nGate requested: {{input.stage}}\n\nSubmission:\n{{input.summary}}\n\nEvidence offered:\n{{input.evidence}}\n\nCriteria and standards retrieved from the handbook:\n{{nodes.criteria.output}}\n\nAssess it. Give: criteria met, gaps with grades, missing artifacts, and a recommended decision of Pass, Pass with conditions, or Hold.",
          knowledge: { mode: "tool", baseIds: [], topK: 8, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 8000,
          maxIterations: 8,
        },
      },
      {
        id: "operate_assessor",
        kind: "agent",
        name: "Operate & retire assessor",
        position: { x: 920, y: 580 },
        config: {
          model: "claude-opus-5",
          systemPrompt: `${ASSESSOR_RULES}\n\nYou cover the Operate and Retire gates, where the continuous criteria apply: SLO attainment and error budget consumed, open severity 1 and 2 incidents, problems without a root cause, change success rate and emergency change ratio, patch currency, gross margin against target, runbook staleness, and expiring compliance evidence. For a retirement, check the notice period, the tested migration path, contract exit, and certified data disposal.`,
          prompt:
            "Service: {{input.service_name}}\nGate requested: {{input.stage}}\n\nSubmission:\n{{input.summary}}\n\nEvidence offered:\n{{input.evidence}}\n\nCriteria and standards retrieved from the handbook:\n{{nodes.criteria.output}}\n\nAssess it. Give: criteria met, gaps with grades, missing artifacts, and a recommended decision of Pass, Pass with conditions, or Hold.",
          knowledge: { mode: "tool", baseIds: [], topK: 8, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 8000,
          maxIterations: 8,
        },
      },
      {
        id: "risk_review",
        kind: "agent",
        name: "Risk & compliance review",
        position: { x: 1250, y: 330 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You are the risk and compliance reviewer on a gate panel. You do not re-do the stage assessment; you look for what it could not see.\n\nCheck: which gaps translate into risk register entries and at what score; whether any risk needs acceptance above the service owner's delegation; whether any compliance evidence is expired or expires within 90 days; whether vulnerability remediation SLAs are being met; and whether a critical third-party dependency lacks a contingency. Say plainly which items block the gate under policy and which are the service owner's call.",
          prompt:
            "Service: {{input.service_name}}\nGate: {{input.stage}}\n\nStage assessment:\n{{input}}\n\nOriginal submission:\n{{input.summary}}\n\nEvidence:\n{{input.evidence}}\n\nProduce: risk register entries to raise or update with scores, who must accept each, compliance evidence concerns, and any policy-blocking item.",
          knowledge: { mode: "inject", baseIds: [], topK: 8, minScore: 0.03, query: "risk scoring, vulnerability remediation SLA, compliance evidence expiry, risk acceptance delegation" },
          effort: "high",
          maxTokens: 6000,
        },
      },
      {
        id: "owner_decision",
        kind: "approval",
        name: "Service owner decision",
        position: { x: 1560, y: 330 },
        config: {
          title: "Gate decision — service owner sign-off",
          instructions:
            "This is the accountable decision, not a rubber stamp. Edit the recommendation into the decision you are actually making, including any conditions with owners and dates, and any risk you are accepting with its review date. Reject to hold the service at this gate.",
          preview:
            "RECOMMENDATION FROM THE PANEL\n\n{{nodes.risk_review.output}}\n\n---\n\nSTAGE ASSESSMENT\n\n{{input}}",
          allowEdit: true,
        },
      },
      {
        id: "record",
        kind: "agent",
        name: "Decision record",
        position: { x: 1870, y: 330 },
        config: {
          model: "claude-sonnet-5",
          systemPrompt:
            "You write the gate decision record in the house format. You transcribe the service owner's decision faithfully — you never upgrade a Hold into a Pass, never drop a condition, and never add a criterion nobody assessed. If the owner's decision differs from the panel recommendation, the rationale must say so explicitly. Keep it to one page.",
          prompt:
            "Service: {{input.service_name}}\nGate: {{input.stage}}\nDate: today\n\nThe service owner's decision, as they edited it:\n{{nodes.owner_decision.output}}\n\nWrite the gate decision record using the format from the handbook: Service, Gate, Date, Service owner, Decision, Evidence reviewed, Criteria met, Gaps, Conditions, Risks accepted, Rationale.",
          knowledge: { mode: "inject", baseIds: [], topK: 4, minScore: 0.03, query: "gate decision record format" },
          effort: "medium",
          maxTokens: 5000,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Gate decision record",
        position: { x: 2180, y: 330 },
        config: { template: "{{nodes.record.output}}", format: "markdown" },
      },
    ],
    edges: [
      edge("input", "criteria"),
      edge("criteria", "lane"),
      edge("lane", "design_assessor", "concept_design", "Intake / Design"),
      edge("lane", "build_assessor", "build_validate", "Build / Validate"),
      edge("lane", "launch_assessor", "launch", "Launch"),
      edge("lane", "operate_assessor", "operate_retire", "Operate / Retire"),
      edge("design_assessor", "risk_review"),
      edge("build_assessor", "risk_review"),
      edge("launch_assessor", "risk_review"),
      edge("operate_assessor", "risk_review"),
      edge("risk_review", "owner_decision"),
      edge("owner_decision", "record"),
      edge("record", "output"),
    ],
  },

  {
    id: "service-owner-desk",
    name: "Service owner control desk",
    description:
      "The recurring service owner review, run as five specialists in parallel — reliability, change, commercial, risk and customer — consolidated by a chief of staff into a RAG status and a prioritised action list.",
    tags: ["managed service", "service owner", "operations"],
    icon: "🎛️",
    requires: ["knowledge"],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Review inputs",
        position: { x: 40, y: 370 },
        config: {
          fields: [
            {
              key: "service_name",
              label: "Service",
              type: "text",
              required: true,
              placeholder: "Managed Postgres",
              defaultValue: "",
            },
            {
              key: "period",
              label: "Period",
              type: "text",
              required: true,
              placeholder: "Week of 3 March, or March 2026",
              defaultValue: "",
            },
            {
              key: "signals",
              label: "Signals",
              type: "longtext",
              required: true,
              placeholder:
                "Paste what you have: incidents, SLO attainment, change records, cost report, vulnerability counts, customer feedback, onboarding pipeline. Rough notes are fine.",
              defaultValue: "",
            },
            {
              key: "focus",
              label: "Anything to focus on",
              type: "text",
              required: false,
              placeholder: "Renewal at risk, error budget nearly gone, audit next month",
              defaultValue: "",
            },
          ],
        },
      },
      {
        id: "standards",
        kind: "knowledge",
        name: "Standards & cadence",
        position: { x: 330, y: 370 },
        config: {
          query:
            "Service owner cadence, error budget policy, change metrics, margin targets, vulnerability remediation SLA, compliance evidence expiry. {{input.focus}}",
          topK: 12,
          minScore: 0.03,
          includeCitations: true,
        },
      },
      {
        id: "reliability",
        kind: "agent",
        name: "Reliability",
        position: { x: 640, y: 40 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You cover the service owner's reliability lane: SLO attainment, error budget burn and what the policy requires at that level of consumption, open severity 1 and 2 incidents, problems without a root cause, repeat pages, runbook coverage for anything that paged, and on-call load and fairness.\n\nState what the error budget policy mandates right now — informed, freeze, or full freeze — and say it plainly rather than hedging. Where the signals are missing a number you need, say which number and why it matters. Do not pad; a short answer with three real findings beats a long one with ten observations.",
          prompt:
            "Service: {{input.service_name}}\nPeriod: {{input.period}}\nFocus: {{input.focus}}\n\nSignals:\n{{input.signals}}\n\nStandards:\n{{nodes.standards.output}}\n\nReport: status (green, amber or red) with a one-line reason, findings, what the error budget policy requires, and actions with owners.",
          knowledge: { mode: "tool", baseIds: [], topK: 6, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 5000,
          maxIterations: 6,
        },
      },
      {
        id: "change",
        kind: "agent",
        name: "Change & release",
        position: { x: 640, y: 205 },
        config: {
          model: "claude-sonnet-5",
          systemPrompt:
            "You cover the service owner's change lane: change success rate, emergency change ratio and whether each emergency was genuinely unforeseeable, failed or backed-out changes, any change that caused a severity 1 or 2, lead times, and whether the standard-change catalogue is growing.\n\nA high normal-change count is usually a weak automation and rollback story rather than an unusually risky service — say so when the evidence supports it.",
          prompt:
            "Service: {{input.service_name}}\nPeriod: {{input.period}}\nFocus: {{input.focus}}\n\nSignals:\n{{input.signals}}\n\nStandards:\n{{nodes.standards.output}}\n\nReport: status, metrics against target, findings, and actions with owners.",
          knowledge: { mode: "tool", baseIds: [], topK: 6, minScore: 0.03, query: "{{input}}" },
          effort: "medium",
          maxTokens: 4000,
          maxIterations: 5,
        },
      },
      {
        id: "commercial",
        kind: "agent",
        name: "Cost & margin",
        position: { x: 640, y: 370 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You cover the service owner's commercial lane: revenue against forecast, cost to serve split into infrastructure, licences and operate effort, gross margin against the target for this service's maturity, and above all the unit cost trend — the earliest reliable indicator that a service is going wrong.\n\nAlso look for waste: idle resources, over-provisioning against measured peak, non-production running out of hours, wrong storage tier, weak commitment coverage, avoidable egress. Flag any individual customer whose consumption pattern makes them unprofitable.",
          prompt:
            "Service: {{input.service_name}}\nPeriod: {{input.period}}\nFocus: {{input.focus}}\n\nSignals:\n{{input.signals}}\n\nStandards:\n{{nodes.standards.output}}\n\nReport: status, margin against target, unit cost trend, waste found, and actions with owners and rough value.",
          knowledge: { mode: "tool", baseIds: [], topK: 6, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 5000,
          maxIterations: 6,
        },
      },
      {
        id: "risk",
        kind: "agent",
        name: "Risk & compliance",
        position: { x: 640, y: 535 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You cover the service owner's risk lane: open critical and high vulnerabilities against the remediation SLA and the age of the oldest, risk register entries past their review date, risks scored above the service owner's delegation, compliance evidence expiring within 90 days, standing production access without justification, and third-party dependencies without a contingency.\n\nBe precise about who must accept what. A risk the service owner cannot accept alone is an escalation, not an action.",
          prompt:
            "Service: {{input.service_name}}\nPeriod: {{input.period}}\nFocus: {{input.focus}}\n\nSignals:\n{{input.signals}}\n\nStandards:\n{{nodes.standards.output}}\n\nReport: status, breaches of remediation SLA, risks needing acceptance and by whom, evidence expiring, and actions with owners and dates.",
          knowledge: { mode: "tool", baseIds: [], topK: 6, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 5000,
          maxIterations: 6,
        },
      },
      {
        id: "customer",
        kind: "agent",
        name: "Customer & demand",
        position: { x: 640, y: 700 },
        config: {
          model: "claude-sonnet-5",
          systemPrompt:
            "You cover the service owner's customer lane: escalations and their state, feedback themes, the onboarding pipeline and any date at risk, churn and renewal signals, roadmap asks and how often each has been requested, and what needs to be said at the next service review.\n\nSeparate what customers asked for from what they actually need — and say when those differ.",
          prompt:
            "Service: {{input.service_name}}\nPeriod: {{input.period}}\nFocus: {{input.focus}}\n\nSignals:\n{{input.signals}}\n\nStandards:\n{{nodes.standards.output}}\n\nReport: status, escalations, feedback themes, pipeline risks, roadmap asks ranked by demand, and what to raise at the service review.",
          knowledge: { mode: "tool", baseIds: [], topK: 6, minScore: 0.03, query: "{{input}}" },
          effort: "medium",
          maxTokens: 4000,
          maxIterations: 5,
        },
      },
      {
        id: "brief",
        kind: "agent",
        name: "Owner briefing",
        position: { x: 970, y: 370 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You are chief of staff to the service owner. Five specialists have reported. Your job is to give the owner one page they can act on before their first meeting.\n\nRules:\n- Open with the overall RAG status and the single sentence that justifies it.\n- Then the three things that matter most this period. Not five, not ten.\n- Then a prioritised action list: action, owner, due date, and which lane raised it. Order by consequence of not doing it, not by which lane shouted loudest.\n- Then anything requiring escalation above the service owner's delegation, named explicitly.\n- Then, briefly, what is fine and needs no attention — so the owner knows it was checked.\n- Where the lanes disagree or a number is missing, say so rather than papering over it.\n- No preamble, no restating the inputs.",
          prompt:
            "Service: {{input.service_name}}\nPeriod: {{input.period}}\n\nRELIABILITY\n{{nodes.reliability.output}}\n\nCHANGE & RELEASE\n{{nodes.change.output}}\n\nCOST & MARGIN\n{{nodes.commercial.output}}\n\nRISK & COMPLIANCE\n{{nodes.risk.output}}\n\nCUSTOMER & DEMAND\n{{nodes.customer.output}}\n\nWrite the service owner's briefing.",
          effort: "high",
          maxTokens: 8000,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Owner briefing",
        position: { x: 1290, y: 370 },
        config: {
          template:
            "# {{input.service_name}} — service owner briefing\n**Period:** {{input.period}}\n\n{{nodes.brief.output}}",
          format: "markdown",
        },
      },
    ],
    edges: [
      edge("input", "standards"),
      edge("standards", "reliability"),
      edge("standards", "change"),
      edge("standards", "commercial"),
      edge("standards", "risk"),
      edge("standards", "customer"),
      edge("reliability", "brief"),
      edge("change", "brief"),
      edge("commercial", "brief"),
      edge("risk", "brief"),
      edge("customer", "brief"),
      edge("brief", "output"),
    ],
  },

  {
    id: "service-onboarding",
    name: "Service onboarding & readiness",
    description:
      "Checks a service against the operational readiness criteria, finds the runbook gaps, drafts the customer onboarding and comms pack, then holds for the service owner before issuing a dated onboarding plan.",
    tags: ["managed service", "onboarding", "readiness"],
    icon: "🛫",
    requires: ["knowledge"],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Onboarding request",
        position: { x: 40, y: 300 },
        config: {
          fields: [
            {
              key: "service_name",
              label: "Service",
              type: "text",
              required: true,
              placeholder: "Managed Postgres",
              defaultValue: "",
            },
            {
              key: "customer",
              label: "Customer",
              type: "text",
              required: true,
              placeholder: "Northwind Retail",
              defaultValue: "",
            },
            {
              key: "tier",
              label: "Service tier",
              type: "text",
              required: true,
              placeholder: "Platinum | Gold | Silver | Bronze",
              defaultValue: "Gold",
            },
            {
              key: "target_date",
              label: "Target go-live",
              type: "text",
              required: true,
              placeholder: "2026-04-15",
              defaultValue: "",
            },
            {
              key: "scope",
              label: "Scope and current state",
              type: "longtext",
              required: true,
              placeholder:
                "What the customer is buying, what is already in place, what is known to be missing.",
              defaultValue: "",
            },
          ],
        },
      },
      {
        id: "standards",
        kind: "knowledge",
        name: "Readiness standards",
        position: { x: 330, y: 300 },
        config: {
          query:
            "Operational readiness review criteria, launch gate, runbook standard, incident severities and response targets, SLA tiers, customer onboarding. {{input.scope}}",
          topK: 12,
          minScore: 0.03,
          includeCitations: true,
        },
      },
      {
        id: "orr",
        kind: "agent",
        name: "Readiness review",
        position: { x: 630, y: 90 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You run the operational readiness review. The operate team has a veto at this gate, so you assess as they would: what will page us at 3am, and will the person who answers have what they need?\n\nCheck the Validate and Launch gate criteria. Insist on the distinction between configured and proven — a restore that has never been performed, a rollback never executed, a DR plan never rehearsed, and an on-call rota not yet staffed for two full rotations are all gaps regardless of how complete the documentation looks.",
          prompt:
            "Service: {{input.service_name}}\nCustomer: {{input.customer}}\nTier: {{input.tier}}\nTarget go-live: {{input.target_date}}\n\nScope and current state:\n{{input.scope}}\n\nStandards:\n{{nodes.standards.output}}\n\nAssess readiness. Give: criteria met, gaps graded blocking / material / minor, and for each blocking gap what would have to happen and how long it realistically takes.",
          knowledge: { mode: "tool", baseIds: [], topK: 8, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 7000,
          maxIterations: 8,
        },
      },
      {
        id: "runbooks",
        kind: "agent",
        name: "Runbook gaps",
        position: { x: 630, y: 300 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You find the gap between the alerts a service will raise and the runbooks that exist for them, then you write the missing ones.\n\nEvery runbook you draft follows the house standard: what the alert means in one sentence, customer impact if real, how to confirm it is real with the exact query or command, mitigation steps in order with the expected effect of each, and when to escalate and to whom. Where you do not know a command for this specific service, say so and mark it as a placeholder for the operate team rather than inventing a plausible-looking one.",
          prompt:
            "Service: {{input.service_name}}\nTier: {{input.tier}}\n\nScope and current state:\n{{input.scope}}\n\nStandards:\n{{nodes.standards.output}}\n\nList the alerts this service should have given its tier and architecture, say which lack runbooks, then draft the two or three most important missing runbooks in full.",
          knowledge: { mode: "tool", baseIds: [], topK: 8, minScore: 0.03, query: "{{input}}" },
          effort: "high",
          maxTokens: 8000,
          maxIterations: 8,
        },
      },
      {
        id: "comms",
        kind: "agent",
        name: "Customer pack",
        position: { x: 630, y: 510 },
        config: {
          model: "claude-sonnet-5",
          systemPrompt:
            "You prepare what the customer receives and hears during onboarding: the welcome and expectation-setting note, what they must provide and by when, the support model in plain terms — how to raise an incident, what each severity means for them, response targets for their tier — the escalation path with roles rather than names, the hypercare arrangement and its end date, and the agenda for the first service review.\n\nWrite for the customer, not for us. No internal jargon and no acronym the customer has not been given.",
          prompt:
            "Service: {{input.service_name}}\nCustomer: {{input.customer}}\nTier: {{input.tier}}\nTarget go-live: {{input.target_date}}\n\nScope:\n{{input.scope}}\n\nStandards:\n{{nodes.standards.output}}\n\nProduce the customer onboarding pack and the comms plan.",
          knowledge: { mode: "tool", baseIds: [], topK: 6, minScore: 0.03, query: "{{input}}" },
          effort: "medium",
          maxTokens: 6000,
          maxIterations: 5,
        },
      },
      {
        id: "plan",
        kind: "agent",
        name: "Onboarding plan",
        position: { x: 950, y: 300 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You turn a readiness assessment, a runbook gap analysis and a customer pack into one dated plan that works backwards from the go-live date.\n\nRules:\n- Every task has an owner role, a start and a due date, and the thing it unblocks.\n- Blocking readiness gaps come first and gate the go-live. If they cannot fit before the target date, say the date is at risk and give the earliest realistic one.\n- Mark the critical path explicitly.\n- Separate what must be done before go-live from what can follow during hypercare.\n- End with the go / no-go criteria the service owner will judge on the day.",
          prompt:
            "Service: {{input.service_name}}\nCustomer: {{input.customer}}\nTier: {{input.tier}}\nTarget go-live: {{input.target_date}}\n\nREADINESS REVIEW\n{{nodes.orr.output}}\n\nRUNBOOK GAPS\n{{nodes.runbooks.output}}\n\nCUSTOMER PACK\n{{nodes.comms.output}}\n\nWrite the onboarding plan.",
          effort: "high",
          maxTokens: 8000,
        },
      },
      {
        id: "signoff",
        kind: "approval",
        name: "Service owner sign-off",
        position: { x: 1270, y: 300 },
        config: {
          title: "Approve the onboarding plan",
          instructions:
            "Check the dates against what the teams can actually absorb, and check that nothing blocking has been quietly moved into hypercare. Edit freely, then approve to issue.",
          preview: "{{nodes.plan.output}}",
          allowEdit: true,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Onboarding pack",
        position: { x: 1590, y: 300 },
        config: {
          template:
            "# {{input.service_name}} → {{input.customer}}\n**Tier:** {{input.tier}} · **Target go-live:** {{input.target_date}}\n\n{{input}}\n\n---\n\n## Customer-facing pack\n\n{{nodes.comms.output}}",
          format: "markdown",
        },
      },
    ],
    edges: [
      edge("input", "standards"),
      edge("standards", "orr"),
      edge("standards", "runbooks"),
      edge("standards", "comms"),
      edge("orr", "plan"),
      edge("runbooks", "plan"),
      edge("comms", "plan"),
      edge("plan", "signoff"),
      edge("signoff", "output"),
    ],
  },
];
