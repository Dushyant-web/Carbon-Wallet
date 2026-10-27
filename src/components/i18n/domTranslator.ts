import { languageInfo, type Lang } from "@/lib/languages";

/*
 * Translates whatever English is on screen into the chosen language, in place: text nodes plus the placeholder,
 * aria-label and title attributes. React keeps owning the DOM: we only change the text of nodes it already made,
 * remember the English, and when React writes new English into a node we see it (MutationObserver) and translate
 * that instead. Switching back restores every original string.
 *
 * Unknown strings are batched to /api/i18n/translate; answers are kept in localStorage per language, so a page
 * seen once translates instantly next time, even offline.
 */

const SKIP = "script,style,noscript,code,pre,textarea,svg,[translate='no'],.notranslate";
const LATIN = /[A-Za-z]{2,}/;
const NUMBER = /\d+(?:[.,:/]\d+)*/g;
const ATTRS = ["placeholder", "aria-label", "title"] as const;
const STORE_PREFIX = "cw-i18n:";
const BATCH = 50;

export type TranslatorStatus = "idle" | "working" | "done" | "unavailable";

/** "Page 3 of 9" → key "Page ⟦0⟧ of ⟦1⟧" and the numbers ["3", "9"]. */
function template(text: string) {
  const nums: string[] = [];
  const key = text.replace(NUMBER, (m) => `⟦${nums.push(m) - 1}⟧`);
  return { key, nums };
}
const fill = (tr: string, nums: string[]) => tr.replace(/⟦(\d+)⟧/g, (_, i) => nums[Number(i)] ?? "");

function loadDict(lang: Lang): Map<string, string> {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(STORE_PREFIX + lang) ?? "{}") as Record<string, string>));
  } catch {
    return new Map();
  }
}
function saveDict(lang: Lang, dict: Map<string, string>) {
  try {
    localStorage.setItem(STORE_PREFIX + lang, JSON.stringify(Object.fromEntries(dict)));
  } catch {
    // storage full or blocked: the in-memory copy still works for this visit
  }
}

export function startDomTranslator(lang: Lang, onStatus: (s: TranslatorStatus) => void): () => void {
  const rtl = !!languageInfo(lang).rtl;
  const dict = loadDict(lang);
  const texts = new Map<Text, { src: string; out: string }>();
  const attrs = new Map<Element, Map<string, { src: string; out: string }>>();
  const pending = new Set<string>();
  const failed = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = 0;
  let unavailable = false;
  let stopped = false;

  const translated = (src: string): string | null => {
    const trimmed = src.trim();
    if (!trimmed || !LATIN.test(trimmed) || trimmed.length > 1000) return src;
    const { key, nums } = template(trimmed);
    const tr = dict.get(key);
    if (tr === undefined) {
      if (!failed.has(key)) pending.add(key);
      return null;
    }
    return src.replace(trimmed, fill(tr, nums));
  };

  function doText(node: Text) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const now = node.nodeValue ?? "";
    const rec = texts.get(node);
    const src = rec && now === rec.out ? rec.src : now; // still showing our text → the English is the remembered one
    const out = translated(src) ?? src;
    texts.set(node, { src, out });
    if (out !== now) node.nodeValue = out;
    if (rtl && out !== src && !parent.hasAttribute("dir")) parent.setAttribute("dir", "auto");
  }

  function doAttr(el: Element, name: string) {
    if (el.closest(SKIP)) return;
    const now = el.getAttribute(name);
    if (now === null) return;
    let recs = attrs.get(el);
    const rec = recs?.get(name);
    const src = rec && now === rec.out ? rec.src : now;
    const out = translated(src) ?? src;
    if (!recs) attrs.set(el, (recs = new Map()));
    recs.set(name, { src, out });
    if (out !== now) el.setAttribute(name, out);
  }

  function walk(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
    if (!(root instanceof Element) || root.closest(SKIP)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) doText(n as Text);
    const els = [root, ...root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))];
    for (const el of els) for (const a of ATTRS) if (el.hasAttribute(a)) doAttr(el, a);
  }

  function prune() {
    for (const node of texts.keys()) if (!node.isConnected) texts.delete(node);
    for (const el of attrs.keys()) if (!el.isConnected) attrs.delete(el);
  }

  function schedule() {
    if (stopped || unavailable || !pending.size || timer) return;
    timer = setTimeout(flush, 250);
  }

  async function flush() {
    timer = null;
    const batch = [...pending].slice(0, BATCH);
    batch.forEach((k) => pending.delete(k));
    if (!batch.length) return;
    inflight++;
    onStatus("working");
    try {
      const res = await fetch("/api/i18n/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang, texts: batch }),
      });
      const body = (await res.json().catch(() => ({}))) as { translations?: Record<string, string>; unavailable?: boolean };
      const got = Object.entries(body.translations ?? {});
      for (const [k, v] of got) dict.set(k, v);
      for (const k of batch) if (!dict.has(k)) failed.add(k); // don't ask again during this visit
      if (got.length) saveDict(lang, dict);
      if (body.unavailable) {
        // no AI key on the server: stop asking, show English for what isn't cached
        unavailable = true;
        pending.clear();
      }
      if (!stopped && got.length) {
        observer.disconnect();
        prune();
        walk(document.body);
        observe();
      }
    } catch {
      batch.forEach((k) => failed.add(k));
    } finally {
      inflight--;
      if (!stopped) {
        if (pending.size) schedule();
        else if (!inflight) onStatus(unavailable ? "unavailable" : "done");
      }
    }
  }

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") doText(r.target as Text);
      else if (r.type === "attributes" && r.attributeName) doAttr(r.target as Element, r.attributeName);
      else r.addedNodes.forEach((n) => walk(n));
    }
    schedule();
  });
  const observe = () =>
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

  document.documentElement.lang = lang;
  walk(document.body);
  observe();
  if (pending.size) schedule();
  else onStatus("done");

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    observer.disconnect();
    for (const [node, rec] of texts) if (node.isConnected && node.nodeValue === rec.out) node.nodeValue = rec.src;
    for (const [el, recs] of attrs) for (const [name, rec] of recs) if (el.getAttribute(name) === rec.out) el.setAttribute(name, rec.src);
    document.documentElement.lang = "en";
  };
}
