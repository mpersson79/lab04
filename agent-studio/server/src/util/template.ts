/**
 * A deliberately small template language: `{{ path.to.value }}` with a few
 * pipe filters. There are no conditionals or loops - a workflow that needs
 * logic should use a Code node, where the logic is visible and testable.
 */

export type TemplateContext = Record<string, unknown>;

const EXPRESSION = /\{\{\s*([^{}]+?)\s*\}\}/g;

function resolvePath(context: TemplateContext, path: string): unknown {
  if (path === "." || path === "") return context;
  let current: unknown = context;
  for (const rawSegment of path.split(".")) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function applyFilter(value: unknown, filter: string): unknown {
  switch (filter.trim().toLowerCase()) {
    case "json":
      return JSON.stringify(value, null, 2) ?? "";
    case "compact":
      return JSON.stringify(value) ?? "";
    case "trim":
      return stringify(value).trim();
    case "upper":
      return stringify(value).toUpperCase();
    case "lower":
      return stringify(value).toLowerCase();
    default:
      return value;
  }
}

/** Names referenced by a template, for the "unresolved variable" warning. */
export function templateReferences(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(EXPRESSION)) {
    const path = match[1]?.split("|")[0]?.trim();
    if (path) found.add(path);
  }
  return [...found];
}

export interface RenderResult {
  text: string;
  /** Paths that resolved to nothing, so a node can warn instead of guessing. */
  missing: string[];
}

export function renderTemplate(template: string, context: TemplateContext): RenderResult {
  const missing: string[] = [];
  const text = template.replace(EXPRESSION, (_whole, expression: string) => {
    const [rawPath, ...filters] = expression.split("|");
    const path = (rawPath ?? "").trim();
    let value = resolvePath(context, path);
    if (value === undefined || value === null || value === "") missing.push(path);
    for (const filter of filters) value = applyFilter(value, filter);
    return stringify(value);
  });
  return { text, missing };
}

/** Convenience wrapper when the caller does not care about missing paths. */
export function render(template: string, context: TemplateContext): string {
  return renderTemplate(template, context).text;
}
