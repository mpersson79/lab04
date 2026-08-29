/**
 * Catalogue of Claude models the studio can target, with the pricing used to
 * cost a run. Prices are US dollars per million tokens on the first-party
 * Anthropic API.
 */
export interface ModelInfo {
  id: string;
  label: string;
  /** Short blurb shown in the model picker. */
  blurb: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
  /** Models that accept `output_config.effort`. */
  supportsEffort: boolean;
  /** Models on which `thinking: {type: "adaptive"}` is available. */
  supportsAdaptiveThinking: boolean;
  tier: "frontier" | "balanced" | "fast";
}

export const MODELS: ModelInfo[] = [
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    blurb: "Best default. Deep reasoning and long-horizon agentic work.",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.5,
    supportsEffort: true,
    supportsAdaptiveThinking: true,
    tier: "frontier",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    blurb: "Strong quality at roughly half the price of Opus.",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPerMTok: 2,
    outputPerMTok: 10,
    cacheWritePerMTok: 2.5,
    cacheReadPerMTok: 0.2,
    supportsEffort: true,
    supportsAdaptiveThinking: true,
    tier: "balanced",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    blurb: "Cheapest and fastest. Good for routers, extraction and cleanup.",
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.1,
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    tier: "fast",
  },
];

export const DEFAULT_MODEL = "claude-opus-5";

export function findModel(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/** Dollar cost of `usage` on `modelId`. Unknown models cost 0. */
export function costOf(modelId: string, usage: TokenUsage): number {
  const model = findModel(modelId);
  if (!model) return 0;
  const perToken = (perMTok: number, tokens: number) => (perMTok * tokens) / 1_000_000;
  return (
    perToken(model.inputPerMTok, usage.inputTokens) +
    perToken(model.outputPerMTok, usage.outputTokens) +
    perToken(model.cacheReadPerMTok, usage.cacheReadTokens) +
    perToken(model.cacheWritePerMTok, usage.cacheWriteTokens)
  );
}

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];
