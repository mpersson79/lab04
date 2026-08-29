import type { z } from "zod";
import { WorkflowEdgeSchema, WorkflowNodeSchema } from "./workflow.ts";

/** Template nodes may omit anything with a schema default. */
export type TemplateNode = z.input<typeof WorkflowNodeSchema>;
export type TemplateEdge = z.input<typeof WorkflowEdgeSchema>;

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Emoji shown on the gallery card. */
  icon: string;
  /** Capabilities the template needs before it will do anything useful. */
  requires: Array<"knowledge" | "mcp" | "web">;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

const edge = (source: string, target: string, sourceHandle?: string, label = ""): TemplateEdge => ({
  id: `e_${source}_${target}${sourceHandle ? `_${sourceHandle}` : ""}`,
  source,
  target,
  sourceHandle: sourceHandle ?? null,
  label,
});

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "An input and an output node. Build the middle yourself.",
    tags: ["starter"],
    icon: "⬜",
    requires: [],
    nodes: [
      { id: "input", kind: "input", name: "Input", position: { x: 40, y: 200 }, config: {} },
      {
        id: "output",
        kind: "output",
        name: "Output",
        position: { x: 560, y: 200 },
        config: { template: "{{input}}" },
      },
    ],
    edges: [edge("input", "output")],
  },
  {
    id: "research-brief",
    name: "Research brief",
    description:
      "A researcher agent with web search gathers sources, then an editor turns the findings into a tight brief with citations.",
    tags: ["research", "web search"],
    icon: "🔎",
    requires: ["web"],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Topic",
        position: { x: 40, y: 200 },
        config: {
          fields: [
            {
              key: "topic",
              label: "Topic",
              type: "longtext",
              required: true,
              placeholder: "Impact of EU AI Act on SaaS vendors",
              defaultValue: "",
            },
          ],
        },
      },
      {
        id: "researcher",
        kind: "agent",
        name: "Researcher",
        position: { x: 360, y: 120 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You are a research analyst. Search the web, read the strongest sources, and report only what the sources support. Always keep the URL next to each claim.",
          prompt:
            "Research this topic and produce structured notes with sources:\n\n{{input.topic}}",
          serverTools: { webSearch: true, webFetch: true, codeExecution: false, maxWebSearches: 6 },
          maxTokens: 12000,
          maxIterations: 12,
        },
      },
      {
        id: "editor",
        kind: "agent",
        name: "Editor",
        position: { x: 700, y: 200 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You are a ruthless editor. You compress without losing meaning and you never invent a fact that is not in the notes.",
          prompt:
            "Turn these research notes into a one-page brief: a two-sentence summary, 4-6 key findings as bullets, open questions, and a source list.\n\nNOTES:\n{{nodes.researcher.output}}",
          effort: "high",
          maxTokens: 6000,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Brief",
        position: { x: 1040, y: 200 },
        config: { template: "{{nodes.editor.output}}", format: "markdown" },
      },
    ],
    edges: [edge("input", "researcher"), edge("researcher", "editor"), edge("editor", "output")],
  },
  {
    id: "support-triage",
    name: "Support triage",
    description:
      "Retrieves policy context from a knowledge base, routes the ticket by category, and drafts a reply in the right voice for each lane.",
    tags: ["support", "routing", "rag"],
    icon: "🎫",
    requires: ["knowledge"],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Ticket",
        position: { x: 40, y: 260 },
        config: {
          fields: [
            {
              key: "ticket",
              label: "Ticket body",
              type: "longtext",
              required: true,
              placeholder: "Customer message",
              defaultValue: "",
            },
            {
              key: "customer_tier",
              label: "Customer tier",
              type: "text",
              required: false,
              placeholder: "free / pro / enterprise",
              defaultValue: "pro",
            },
          ],
        },
      },
      {
        id: "policy",
        kind: "knowledge",
        name: "Policy lookup",
        position: { x: 330, y: 260 },
        config: { query: "{{input.ticket}}", topK: 6, includeCitations: true },
      },
      {
        id: "router",
        kind: "router",
        name: "Triage",
        position: { x: 620, y: 260 },
        config: {
          mode: "llm",
          model: "claude-haiku-4-5",
          instructions:
            "Classify the support ticket into exactly one lane. Prefer 'billing' when money is mentioned.",
          prompt: "{{input.ticket}}",
          routes: [
            { id: "billing", label: "Billing", description: "Invoices, refunds, plan changes, payment failures." },
            { id: "technical", label: "Technical", description: "Bugs, errors, outages, integration problems." },
            { id: "other", label: "Other", description: "Anything else, including feature requests." },
          ],
          fallbackRouteId: "other",
        },
      },
      {
        id: "billing_reply",
        kind: "agent",
        name: "Billing reply",
        position: { x: 940, y: 80 },
        config: {
          model: "claude-sonnet-5",
          systemPrompt:
            "You write billing support replies. Be exact about amounts and dates. Never promise a refund the policy does not allow.",
          prompt:
            "Ticket ({{input.customer_tier}} customer):\n{{input.ticket}}\n\nPolicy context:\n{{nodes.policy.output}}\n\nDraft the reply.",
          maxTokens: 3000,
        },
      },
      {
        id: "tech_reply",
        kind: "agent",
        name: "Technical reply",
        position: { x: 940, y: 300 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You are a support engineer. Diagnose before you reassure. Ask for the one piece of missing evidence that would settle the diagnosis.",
          prompt:
            "Ticket ({{input.customer_tier}} customer):\n{{input.ticket}}\n\nDocs context:\n{{nodes.policy.output}}\n\nDraft the reply.",
          maxTokens: 4000,
        },
      },
      {
        id: "other_reply",
        kind: "agent",
        name: "General reply",
        position: { x: 940, y: 520 },
        config: {
          model: "claude-haiku-4-5",
          systemPrompt: "You write short, warm, useful support replies.",
          prompt: "Ticket:\n{{input.ticket}}\n\nContext:\n{{nodes.policy.output}}\n\nDraft the reply.",
          thinking: "off",
          maxTokens: 2000,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Draft reply",
        position: { x: 1280, y: 300 },
        config: { template: "{{input}}", format: "markdown" },
      },
    ],
    edges: [
      edge("input", "policy"),
      edge("policy", "router"),
      edge("router", "billing_reply", "billing", "Billing"),
      edge("router", "tech_reply", "technical", "Technical"),
      edge("router", "other_reply", "other", "Other"),
      edge("billing_reply", "output"),
      edge("tech_reply", "output"),
      edge("other_reply", "output"),
    ],
  },
  {
    id: "content-pipeline",
    name: "Content pipeline with review",
    description:
      "Outline, draft, then a human approval gate before the polish pass. Shows how to put a person inside an agent workflow.",
    tags: ["content", "human-in-the-loop"],
    icon: "✍️",
    requires: [],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Assignment",
        position: { x: 40, y: 220 },
        config: {
          fields: [
            {
              key: "brief",
              label: "Brief",
              type: "longtext",
              required: true,
              placeholder: "Write a 600-word post about ...",
              defaultValue: "",
            },
            {
              key: "audience",
              label: "Audience",
              type: "text",
              required: false,
              placeholder: "Platform engineers",
              defaultValue: "Technical decision makers",
            },
          ],
        },
      },
      {
        id: "outline",
        kind: "agent",
        name: "Outline",
        position: { x: 330, y: 220 },
        config: {
          model: "claude-sonnet-5",
          systemPrompt: "You plan articles. Structure first, prose never.",
          prompt:
            "Audience: {{input.audience}}\n\nBrief: {{input.brief}}\n\nProduce a tight outline: working title, thesis, 4-6 sections with one line each.",
          maxTokens: 2000,
        },
      },
      {
        id: "draft",
        kind: "agent",
        name: "Draft",
        position: { x: 620, y: 220 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You write clear technical prose. Short sentences. No filler, no throat-clearing, no marketing adjectives.",
          prompt: "Write the full piece from this outline.\n\n{{nodes.outline.output}}",
          maxTokens: 8000,
        },
      },
      {
        id: "review",
        kind: "approval",
        name: "Human review",
        position: { x: 920, y: 220 },
        config: {
          title: "Approve the draft",
          instructions: "Edit anything you want changed, then approve to run the polish pass.",
          preview: "{{nodes.draft.output}}",
          allowEdit: true,
        },
      },
      {
        id: "polish",
        kind: "agent",
        name: "Polish",
        position: { x: 1200, y: 220 },
        config: {
          model: "claude-opus-5",
          systemPrompt: "You are a copy editor. Fix rhythm, cut redundancy, keep the author's voice.",
          prompt: "Final pass on this approved draft:\n\n{{input}}",
          effort: "medium",
          maxTokens: 8000,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Published copy",
        position: { x: 1500, y: 220 },
        config: { template: "{{nodes.polish.output}}", format: "markdown" },
      },
    ],
    edges: [
      edge("input", "outline"),
      edge("outline", "draft"),
      edge("draft", "review"),
      edge("review", "polish"),
      edge("polish", "output"),
    ],
  },
  {
    id: "mcp-operator",
    name: "MCP operator",
    description:
      "An agent that plans against your connected MCP servers, calls their tools, and reports what it changed. Attach a server on the agent node first.",
    tags: ["mcp", "tools", "ops"],
    icon: "🔌",
    requires: ["mcp"],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Task",
        position: { x: 40, y: 200 },
        config: {
          fields: [
            {
              key: "task",
              label: "Task",
              type: "longtext",
              required: true,
              placeholder: "Find every open issue labelled 'bug' and summarise the themes",
              defaultValue: "",
            },
          ],
        },
      },
      {
        id: "operator",
        kind: "agent",
        name: "Operator",
        position: { x: 360, y: 200 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "You operate connected systems through MCP tools. Read before you write. State what you are about to change before you change it, and report exactly what happened afterwards.",
          prompt: "{{input.task}}",
          maxIterations: 15,
          maxTokens: 12000,
        },
      },
      {
        id: "report",
        kind: "agent",
        name: "Report",
        position: { x: 700, y: 200 },
        config: {
          model: "claude-sonnet-5",
          systemPrompt: "You summarise operational runs for someone who was not watching.",
          prompt:
            "Summarise what the operator did and what it found:\n\n{{nodes.operator.output}}",
          maxTokens: 3000,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Run report",
        position: { x: 1040, y: 200 },
        config: { template: "{{nodes.report.output}}", format: "markdown" },
      },
    ],
    edges: [edge("input", "operator"), edge("operator", "report"), edge("report", "output")],
  },
  {
    id: "doc-qa",
    name: "Grounded Q&A",
    description:
      "A retrieval agent that answers only from your knowledge bases, with a checker that flags any claim the sources do not support.",
    tags: ["rag", "knowledge"],
    icon: "📚",
    requires: ["knowledge"],
    nodes: [
      {
        id: "input",
        kind: "input",
        name: "Question",
        position: { x: 40, y: 200 },
        config: {
          fields: [
            {
              key: "question",
              label: "Question",
              type: "longtext",
              required: true,
              placeholder: "What is our data retention policy for EU customers?",
              defaultValue: "",
            },
          ],
        },
      },
      {
        id: "answer",
        kind: "agent",
        name: "Answerer",
        position: { x: 360, y: 200 },
        config: {
          model: "claude-opus-5",
          systemPrompt:
            "Answer only from the retrieved sources. Cite them as [S1], [S2]. If the sources do not answer the question, say exactly that and stop.",
          prompt: "{{input.question}}",
          knowledge: { mode: "tool", baseIds: [], topK: 8, minScore: 0.05, query: "{{input}}" },
          maxIterations: 8,
          maxTokens: 6000,
        },
      },
      {
        id: "check",
        kind: "agent",
        name: "Groundedness check",
        position: { x: 700, y: 200 },
        config: {
          model: "claude-haiku-4-5",
          systemPrompt: "You verify that every claim carries a citation. You are terse.",
          prompt:
            "Question: {{input.question}}\n\nAnswer:\n{{nodes.answer.output}}\n\nList any claim without a [S#] citation. If everything is cited, reply exactly: OK.",
          thinking: "off",
          maxTokens: 1500,
        },
      },
      {
        id: "output",
        kind: "output",
        name: "Answer",
        position: { x: 1040, y: 200 },
        config: {
          template:
            "{{nodes.answer.output}}\n\n---\n**Groundedness check:** {{nodes.check.output}}",
          format: "markdown",
        },
      },
    ],
    edges: [edge("input", "answer"), edge("answer", "check"), edge("check", "output")],
  },
];

export function findTemplate(id: string): WorkflowTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
