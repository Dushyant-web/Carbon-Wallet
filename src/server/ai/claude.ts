import Anthropic from "@anthropic-ai/sdk";

/*
 * One Claude client for the website's AI features (Partner and translations). Every feature checks
 * claudeClient() and falls back to a non-AI path when ANTHROPIC_API_KEY isn't set.
 */

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

/**
 * Server-side refusal fallback: if the model declines, the API re-runs the request on a fallback model inside the
 * same call. The scalar "default" form goes with this exact beta header.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null | undefined;

export function claudeClient(): Anthropic | null {
  if (client === undefined) client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ maxRetries: 2 }) : null;
  return client;
}

/** For tests. */
export function resetClaudeClient() {
  client = undefined;
}
