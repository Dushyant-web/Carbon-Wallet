import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { claudeClient, CLAUDE_MODEL, FALLBACK_BETA } from "@/server/ai/claude";
import { languageInfo, type Lang } from "@/lib/languages";

/*
 * Interface text → another Indian language. Strings arrive with numbers swapped for ⟦0⟧, ⟦1⟧… (so "Page 3 of 9"
 * and "Page 4 of 9" share one translation) and are cached forever per language: each English string is sent to
 * Claude once, ever.
 */

export const MAX_TEXTS = 60;
export const MAX_TEXT_CHARS = 1000;
export const MAX_BATCH_CHARS = 20_000;

const hashOf = (s: string) => createHash("sha256").update(s).digest("hex");
const placeholders = (s: string) => (s.match(/⟦\d+⟧/g) ?? []).sort().join(",");

const SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: { i: { type: "integer" }, text: { type: "string" } },
        required: ["i", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["translations"],
  additionalProperties: false,
} as const;

function systemPrompt(lang: Lang) {
  const l = languageInfo(lang);
  return [
    `You translate the interface text of Carbon Wallet, a citizen service in India that helps households understand the electricity, fuel and carbon (CO₂) of their home, from English into ${l.name} (${l.native}${l.script ? `, written in ${l.script} script` : ""}).`,
    "Readers include people with little schooling: use the plain, everyday words people actually say, not formal or Sanskritised vocabulary, and keep sentences short. Keep the tone polite and helpful, like a good government help desk.",
    "Rules:",
    "- Keep every placeholder like ⟦0⟧ or ⟦1⟧ exactly as written; they stand for numbers.",
    "- Keep these names as they are: Carbon Wallet, Carbon Card, Carbon ID, Partner, Mohalla Samachar, and scheme names such as PM Surya Ghar.",
    "- Keep units and symbols as they are: kg, kWh, CO₂, ₹, %, km, kW, t.",
    "- A string may be a button label, a heading or a single word: translate it as that kind of text, not as a sentence.",
    "- If a string is a person's name, a place name, a code or an email address, return it unchanged.",
    "Return one translation for every input, with the same index i.",
  ].join("\n");
}

export type TranslateResult = { translations: Record<string, string>; unavailable?: boolean };

export async function translate(lang: Lang, texts: string[]): Promise<TranslateResult> {
  const unique = [...new Set(texts.map((t) => t.trim()).filter((t) => t && t.length <= MAX_TEXT_CHARS))].slice(0, MAX_TEXTS);
  if (!unique.length) return { translations: {} };
  const byHash = new Map(unique.map((t) => [hashOf(t), t]));
  const cached = await db.translation.findMany({ where: { lang, hash: { in: [...byHash.keys()] } }, select: { hash: true, text: true } });
  const out: Record<string, string> = {};
  for (const c of cached) out[byHash.get(c.hash)!] = c.text;
  const missing = unique.filter((t) => out[t] === undefined);
  if (!missing.length) return { translations: out };

  const client = claudeClient();
  if (!client) return { translations: out, unavailable: true };

  const response = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: systemPrompt(lang),
    messages: [{ role: "user", content: JSON.stringify(missing.map((text, i) => ({ i, text }))) }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return { translations: out };
  const block = response.content.find((b) => b.type === "text");
  let parsed: { translations?: { i: number; text: string }[] } = {};
  try {
    parsed = JSON.parse(block && block.type === "text" ? block.text : "{}");
  } catch {
    return { translations: out };
  }

  const rows: { lang: string; hash: string; source: string; text: string }[] = [];
  for (const tr of parsed.translations ?? []) {
    const source = missing[tr.i];
    const text = typeof tr.text === "string" ? tr.text.trim() : "";
    // a translation that lost or invented a number placeholder would show wrong numbers: drop it
    if (!source || !text || text.length > MAX_TEXT_CHARS * 3 || placeholders(text) !== placeholders(source)) continue;
    out[source] = text;
    rows.push({ lang, hash: hashOf(source), source, text });
  }
  if (rows.length) {
    await db.$transaction(
      rows.map((r) => db.translation.upsert({ where: { lang_hash: { lang: r.lang, hash: r.hash } }, create: r, update: { text: r.text } })),
    );
  }
  return { translations: out };
}
