import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/server/auth/session";
import { clientIp, rateLimit } from "@/server/auth/rateLimit";
import { isLang } from "@/lib/languages";
import { MAX_BATCH_CHARS, MAX_TEXT_CHARS, MAX_TEXTS, translate } from "@/server/services/translate.service";

const Body = z.object({
  lang: z.string().refine(isLang, "Unknown language").refine((l) => l !== "en", "English needs no translation"),
  texts: z.array(z.string().max(MAX_TEXT_CHARS)).min(1).max(MAX_TEXTS),
});

/**
 * Translations of interface text. Anyone may ask (the public pages are translated too), but each browser is
 * rate-limited, signed-out visitors more tightly, and every string is translated once and then served from the cache.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request" }, { status: 400 });
  if (parsed.data.texts.reduce((a, t) => a + t.length, 0) > MAX_BATCH_CHARS) return NextResponse.json({ error: "Too much text at once" }, { status: 413 });

  const user = await getRequestUser(req).catch(() => null);
  const limit = await rateLimit(user ? `i18n:u:${user.id}` : `i18n:ip:${clientIp(req)}`, user ? 120 : 30, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });

  try {
    const result = await translate(parsed.data.lang as Parameters<typeof translate>[0], parsed.data.texts);
    return NextResponse.json(result);
  } catch (err) {
    console.error("translate failed", (err as Error).message);
    return NextResponse.json({ translations: {}, error: "Translation is busy. Showing English for now." }, { status: 503 });
  }
}
