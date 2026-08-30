import type { z } from "zod";
import type { WorkflowEdgeSchema, WorkflowNodeSchema } from "./workflow.ts";

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

export const edge = (
  source: string,
  target: string,
  sourceHandle?: string,
  label = "",
): TemplateEdge => ({
  id: `e_${source}_${target}${sourceHandle ? `_${sourceHandle}` : ""}`,
  source,
  target,
  sourceHandle: sourceHandle ?? null,
  label,
});
