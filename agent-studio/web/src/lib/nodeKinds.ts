import type { NodeKind } from "@studio/shared";
import {
  Bot,
  BookOpen,
  Braces,
  GitBranch,
  Globe,
  LogIn,
  Send,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export interface NodeKindMeta {
  kind: NodeKind;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** CSS colour token driving the node's accent stripe and icon. */
  color: string;
  /** Nodes that end a branch have no source handle. */
  hasOutput: boolean;
  hasInput: boolean;
}

export const NODE_KINDS: Record<NodeKind, NodeKindMeta> = {
  input: {
    kind: "input",
    label: "Input",
    blurb: "Where the run starts. Defines the fields a caller fills in.",
    icon: LogIn,
    color: "var(--color-ink-muted)",
    hasOutput: true,
    hasInput: false,
  },
  agent: {
    kind: "agent",
    label: "Agent",
    blurb: "A Claude agent with tools, retrieval and MCP servers attached.",
    icon: Bot,
    color: "var(--color-agent)",
    hasOutput: true,
    hasInput: true,
  },
  knowledge: {
    kind: "knowledge",
    label: "Retrieval",
    blurb: "Search knowledge bases and pass the passages downstream.",
    icon: BookOpen,
    color: "var(--color-knowledge)",
    hasOutput: true,
    hasInput: true,
  },
  router: {
    kind: "router",
    label: "Router",
    blurb: "Send the run down one branch, chosen by Claude or an expression.",
    icon: GitBranch,
    color: "var(--color-router)",
    hasOutput: false,
    hasInput: true,
  },
  code: {
    kind: "code",
    label: "Code",
    blurb: "Reshape the payload with a short sandboxed JavaScript snippet.",
    icon: Braces,
    color: "var(--color-tool)",
    hasOutput: true,
    hasInput: true,
  },
  http: {
    kind: "http",
    label: "HTTP request",
    blurb: "Call an external API and pass the response on.",
    icon: Globe,
    color: "var(--color-tool)",
    hasOutput: true,
    hasInput: true,
  },
  approval: {
    kind: "approval",
    label: "Human approval",
    blurb: "Pause the run until a person approves, edits or rejects.",
    icon: UserCheck,
    color: "var(--color-human)",
    hasOutput: true,
    hasInput: true,
  },
  output: {
    kind: "output",
    label: "Output",
    blurb: "The run's answer, rendered from a template.",
    icon: Send,
    color: "var(--color-ink-muted)",
    hasOutput: false,
    hasInput: true,
  },
};

/** Order shown in the palette: start, think, branch, transform, finish. */
export const PALETTE_ORDER: NodeKind[] = [
  "agent",
  "knowledge",
  "router",
  "code",
  "http",
  "approval",
  "input",
  "output",
];
