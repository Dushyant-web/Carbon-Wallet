"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Download, FileSpreadsheet, ImagePlus, Leaf, Search, Star, Trash2, Upload, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pager, usePaged } from "@/components/ui/Pager";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { compressImage } from "@/lib/compressImage";
import { CSV_COLUMNS, csvRecords, type CatalogueFacts } from "@/lib/catalogue";
import { inr } from "@/lib/plainWords";

export type CatalogueItemView = {
  id: string;
  sku: string;
  kind: string;
  type: string;
  brand: string;
  model: string;
  title: string;
  description: string | null;
  priceInr: number;
  stars: number | null;
  inverter: boolean;
  capacityTon: number | null;
  ratedPowerW: number | null;
  annualKwh: number | null;
  labelYear: number | null;
  fuel: string | null;
  kmPerUnit: number | null;
  batteryKwh: number | null;
  modelYear: number | null;
  warrantyYears: number | null;
  active: boolean;
  imageUrl: string | null;
  sold: number;
  facts: CatalogueFacts;
};
type ImportResult = { created: number; updated: number; errors: { line: number; message: string }[]; imagesAttached: number; imagesMissing: string[]; imagesRejected: string[] };

/** Upload the shop's products as a CSV with photos; see, hide or remove them. */
export function CatalogueManager() {
  const { t } = useUiPrefs();
  const qc = useQueryClient();
  const [csv, setCsv] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<{ count: number; images: string[] } | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [kind, setKind] = useState<"ALL" | "APPLIANCE" | "VEHICLE">("ALL");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<{ items: CatalogueItemView[] }>({
    queryKey: ["merchant", "catalogue"],
    queryFn: async () => {
      const res = await fetch("/api/merchant/catalogue");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  async function pickCsv(f: File | null) {
    setCsv(f);
    setResult(null);
    if (!f) return setCsvRows(null);
    const rows = csvRecords(await f.text());
    setCsvRows({ count: rows.length, images: rows.map((r) => r.record.image).filter(Boolean) });
  }

  async function upload() {
    if (!csv) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", csv);
      for (const p of photos) {
        // shrink and re-encode on the phone/PC first: smaller uploads, and no camera metadata
        const blob = await compressImage(p, 1200, 0.85).catch(() => p);
        form.append("images", blob, p.name);
      }
      const res = await fetch("/api/merchant/catalogue/import", { method: "POST", body: form });
      const out = await res.json().catch(() => ({}));
      if (res.status === 201 || (res.status === 400 && out.errors)) {
        setResult(out);
        if (out.created + out.updated) toast.success(t(`${out.created} added, ${out.updated} updated`, `${out.created} जोड़े, ${out.updated} अपडेट`));
        else toast.error(t("No rows could be added. See the errors below.", "कोई पंक्ति नहीं जुड़ी। नीचे त्रुटियाँ देखें।"));
        qc.invalidateQueries({ queryKey: ["merchant"] });
      } else toast.error(out.error ?? t("Upload failed", "अपलोड नहीं हुआ"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(i: CatalogueItemView) {
    const res = await fetch(`/api/merchant/catalogue/${i.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !i.active }) });
    if (res.ok) qc.invalidateQueries({ queryKey: ["merchant", "catalogue"] });
  }
  async function remove(i: CatalogueItemView) {
    const res = await fetch(`/api/merchant/catalogue/${i.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t(`Deleted ${i.title}`, `${i.title} हटाया`), {
        description: i.sold ? t(`Its ${i.sold} past sales keep their record.`, `इसकी ${i.sold} पुरानी बिक्री का रिकॉर्ड बना रहेगा।`) : undefined,
      });
      qc.invalidateQueries({ queryKey: ["merchant"] });
    } else toast.error((await res.json().catch(() => ({}))).error ?? t("Couldn't delete", "हटा नहीं पाए"));
  }

  const items = useMemo(
    () =>
      (data?.items ?? []).filter(
        (i) => (kind === "ALL" || i.kind === kind) && (!q || `${i.title} ${i.sku} ${i.brand} ${i.model}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, kind, q],
  );
  const photoNames = new Set(photos.map((p) => p.name.toLowerCase()));
  const productPages = usePaged(items);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <span className="label-caps">{t("Catalogue", "कैटलॉग")}</span>
        <h1 className="mt-1.5 font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">{t("Your products", "आपके उत्पाद")}</h1>
        <p className="mt-2 max-w-3xl text-[15px] text-ink-muted">
          {t(
            "Upload every product once, with its star-label figures, price and photo. At the counter you pick it instead of typing, and the customer sees what it will cost to run and the carbon it adds.",
            "हर उत्पाद एक बार अपलोड करें: स्टार लेबल के आँकड़े, दाम और फ़ोटो। काउंटर पर टाइप करने की जगह चुनें; ग्राहक को चलाने का ख़र्च और कार्बन दिखेगा।",
          )}
        </p>
      </header>

      {/* Upload */}
      <section className="border border-gov-navy/30 bg-canvas-card">
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="p-5">
            <p className="label-caps text-gov-blue">{t("Step 1", "चरण 1")}</p>
            <p className="mt-1 text-[15px] font-semibold">{t("Download the template", "टेम्पलेट डाउनलोड करें")}</p>
            <p className="mt-1 text-[13px] text-ink-muted">{t("One row per product. Put each photo's file name in the image column.", "हर उत्पाद की एक पंक्ति। image कॉलम में फ़ोटो का नाम।")}</p>
            <a href="/api/merchant/catalogue/template" className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-gov-navy px-3 text-[13px] font-semibold text-gov-navy hover:bg-gov-sky">
              <Download className="h-4 w-4" /> carbon-wallet-catalogue-template.csv
            </a>
            <details className="mt-3 text-[12px] text-ink-muted">
              <summary className="cursor-pointer underline">{t("Columns", "कॉलम")}</summary>
              <p className="mt-1 font-mono leading-relaxed">{CSV_COLUMNS.join(", ")}</p>
            </details>
          </div>
          <label className="block cursor-pointer p-5 hover:bg-canvas-subtle">
            <p className="label-caps text-gov-blue">{t("Step 2", "चरण 2")}</p>
            <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
              <FileSpreadsheet className="h-5 w-5" /> {t("Choose your CSV", "अपनी CSV चुनें")}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">{csv ? `${csv.name} · ${csvRows?.count ?? 0} ${t("products", "उत्पाद")}` : t("Excel → Save as → CSV", "Excel → Save as → CSV")}</p>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pickCsv(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block cursor-pointer p-5 hover:bg-canvas-subtle">
            <p className="label-caps text-gov-blue">{t("Step 3", "चरण 3")}</p>
            <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
              <ImagePlus className="h-5 w-5" /> {t("Add the photos", "फ़ोटो जोड़ें")}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {photos.length
                ? t(`${photos.length} photos selected`, `${photos.length} फ़ोटो चुनी`)
                : t("JPEG or PNG, named as in the CSV. Optional.", "JPEG या PNG, CSV वाले नाम से। ज़रूरी नहीं।")}
            </p>
            {csvRows && csvRows.images.length > 0 && photos.length > 0 && (
              <p className="mt-1 text-[12px]">
                {t("Matched", "मिले")}: {csvRows.images.filter((n) => photoNames.has(n.toLowerCase())).length}/{csvRows.images.length}
              </p>
            )}
            <input type="file" accept="image/jpeg,image/png" multiple className="sr-only" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-[12px] text-ink-muted">
            {t("Re-uploading the same SKU updates it. Up to 1,000 products and 200 photos (2 MB each) per upload.", "वही SKU दोबारा अपलोड करने पर अपडेट होगा।")}
          </p>
          <button onClick={upload} disabled={!csv || busy} className="inline-flex h-11 items-center gap-2 rounded-md bg-gov-navy px-5 text-[14px] font-semibold text-white disabled:opacity-40">
            <Upload className="h-4 w-4" /> {busy ? t("Uploading…", "अपलोड हो रहा है…") : t("Upload catalogue", "कैटलॉग अपलोड करें")}
          </button>
        </div>
        {result && (
          <div className="border-t border-border px-5 py-4 text-[14px]">
            <p>
              <strong>{result.created}</strong> {t("added", "जोड़े")} · <strong>{result.updated}</strong> {t("updated", "अपडेट")} · <strong>{result.imagesAttached}</strong> {t("photos attached", "फ़ोटो जुड़ीं")}
            </p>
            {result.imagesMissing.length > 0 && (
              <p className="mt-1 text-warning-text">
                {t("Photos named in the CSV but not uploaded", "CSV में नाम पर फ़ोटो नहीं मिली")}: {result.imagesMissing.join(", ")}
              </p>
            )}
            {result.imagesRejected.length > 0 && (
              <p className="mt-1 text-critical-text">
                {t("Not real JPEG/PNG photos or over 2 MB", "सही JPEG/PNG नहीं या 2 MB से बड़ी")}: {result.imagesRejected.join(", ")}
              </p>
            )}
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto border border-critical-border bg-critical-subtle p-2 font-mono text-[12px] text-critical-text">
                {result.errors.map((e) => (
                  <li key={e.line}>
                    {t("line", "पंक्ति")} {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Products */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="flex gap-1">
            {(["ALL", "APPLIANCE", "VEHICLE"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`h-9 rounded-md px-3 text-[13px] ${kind === k ? "bg-gov-navy font-semibold text-white" : "border border-border bg-canvas-card"}`}>
                {k === "ALL" ? t("All", "सभी") : k === "APPLIANCE" ? t("Appliances", "उपकरण") : t("Vehicles", "वाहन")}
              </button>
            ))}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-canvas-card px-3">
            <Search className="h-4 w-4 text-ink-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search products", "उत्पाद खोजें")} className="w-48 bg-transparent text-[14px] focus:outline-none" />
          </label>
        </div>
        {isLoading ? (
          <Skeleton className="mt-4 h-64 w-full" />
        ) : items.length === 0 ? (
          <p className="mt-4 border border-border bg-canvas-card p-5 text-[14px] text-ink-muted">{t("No products yet. Upload your CSV above.", "अभी कोई उत्पाद नहीं। ऊपर CSV अपलोड करें।")}</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {productPages.slice.map((i) => (
              <ProductCard key={i.id} item={i} onToggle={() => toggle(i)} onRemove={() => remove(i)} />
            ))}
          </div>
        )}
        <Pager page={productPages.page} pages={productPages.pages} total={productPages.total} onPage={productPages.setPage} />
      </section>
    </div>
  );
}

export function StarBadge({ stars, inverter }: { stars: number | null; inverter: boolean }) {
  if (stars === null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-[#0B5394] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#0B5394]" title="BEE star rating">
      {Array.from({ length: 5 }, (_, k) => (
        <Star key={k} className={`h-3 w-3 ${k < stars ? "fill-[#E6A100] text-[#E6A100]" : "text-[#0B5394]/30"}`} />
      ))}
      {inverter ? <span className="ml-0.5">INV</span> : null}
    </span>
  );
}

const EFF: Record<string, [string, string]> = {
  BEST: ["bg-success-subtle text-success-text border-success-border", "Most efficient"],
  GOOD: ["bg-warning-subtle text-warning-text border-warning-border", "Average"],
  POOR: ["bg-critical-subtle text-critical-text border-critical-border", "Costly to run"],
};

export function ProductFacts({ item }: { item: Pick<CatalogueItemView, "facts" | "kind" | "fuel"> }) {
  const { t } = useUiPrefs();
  const f = item.facts;
  return (
    <dl className="grid grid-cols-3 gap-2 text-[12px]">
      <div>
        <dt className="text-ink-muted">{t("Running cost", "चलाने का ख़र्च")}</dt>
        <dd className="font-semibold tabular-nums">{f.yearlyRupees !== null ? `${inr(f.yearlyRupees)}/${t("yr", "वर्ष")}` : "—"}</dd>
      </div>
      <div>
        <dt className="text-ink-muted">{item.kind === "VEHICLE" && item.fuel !== "Electric" ? t("Fuel", "ईंधन") : t("Electricity", "बिजली")}</dt>
        <dd className="font-semibold tabular-nums">{f.yearlyKwh !== null ? `${f.yearlyKwh} kWh` : item.fuel ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-ink-muted">CO₂e</dt>
        <dd className="font-semibold tabular-nums">{f.yearlyKg !== null ? `${f.yearlyKg} kg/${t("yr", "वर्ष")}` : "—"}</dd>
      </div>
    </dl>
  );
}

function ProductCard({ item, onToggle, onRemove }: { item: CatalogueItemView; onToggle: () => void; onRemove: () => void }) {
  const { t } = useUiPrefs();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const eff = item.facts.efficiency ? EFF[item.facts.efficiency] : null;

  async function setPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImage(file, 1200, 0.85); // smaller, and no camera metadata
      const form = new FormData();
      form.set("image", blob, file.name.replace(/\.[a-z0-9]+$/i, ".jpg"));
      const res = await fetch(`/api/merchant/catalogue/${item.id}/image`, { method: "POST", body: form });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(out.error ?? t("Photo upload failed", "फ़ोटो अपलोड नहीं हुई"));
      toast.success(t("Photo saved", "फ़ोटो सेव हुई"));
      qc.invalidateQueries({ queryKey: ["merchant", "catalogue"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <article className={`flex flex-col border bg-canvas-card ${item.active ? "border-border" : "border-dashed border-border opacity-60"}`}>
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-white">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-contain p-2" loading="lazy" />
        ) : (
          <Zap className="h-10 w-10 text-ink-light" />
        )}
        {eff && <span className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${eff[0]}`}>{eff[1]}</span>}
        <label className="absolute bottom-2 right-2 flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white/95 px-2.5 text-[12px] font-semibold shadow-sm hover:border-ink">
          <Camera className="h-4 w-4" />
          {uploading ? t("Uploading…", "अपलोड…") : item.imageUrl ? t("Change photo", "फ़ोटो बदलें") : t("Add photo", "फ़ोटो जोड़ें")}
          <input type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" disabled={uploading} onChange={(e) => setPhoto(e.target.files?.[0])} />
        </label>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
          <span className="shrink-0 font-heading text-lg font-semibold tabular-nums">{inr(item.priceInr)}</span>
        </div>
        <p className="font-mono text-[11px] text-ink-muted">
          {item.sku} · {item.brand} {item.model}
          {item.labelYear ? ` · label ${item.labelYear}` : ""}
          {item.modelYear ? ` · ${item.modelYear}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StarBadge stars={item.stars} inverter={item.inverter} />
          {item.capacityTon ? <span className="text-[12px]">{item.capacityTon} t</span> : null}
          {item.ratedPowerW ? <span className="text-[12px]">{item.ratedPowerW} W</span> : null}
          {item.batteryKwh ? <span className="text-[12px]">{item.batteryKwh} kWh battery</span> : null}
          {item.warrantyYears ? <span className="text-[12px] text-ink-muted">{item.warrantyYears} yr warranty</span> : null}
        </div>
        {item.description && <p className="text-[13px] text-ink-muted">{item.description}</p>}
        <ProductFacts item={item} />
        {item.facts.benefitNote && (
          <p className="flex items-start gap-1.5 text-[12px] text-success-text">
            <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {item.facts.benefitNote}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-2 text-[12px]">
          {confirming ? (
            <span className="flex w-full items-center justify-between gap-2" role="group" aria-label={t("Confirm delete", "हटाने की पुष्टि")}>
              <span className="font-semibold text-critical-text">{t("Delete for good?", "हमेशा के लिए हटाएँ?")}</span>
              <span className="flex gap-1">
                <button onClick={() => setConfirming(false)} className="h-8 rounded-md border border-border px-2 hover:border-ink">
                  {t("No", "नहीं")}
                </button>
                <button onClick={onRemove} className="h-8 rounded-md bg-critical px-3 font-semibold text-white">
                  {t("Delete", "हटाएँ")}
                </button>
              </span>
            </span>
          ) : (
            <>
              <span className="text-ink-muted">{t(`${item.sold} sold`, `${item.sold} बिके`)}</span>
              <span className="flex gap-1">
                <button onClick={onToggle} title={t("Hide from the counter but keep it", "काउंटर से छिपाएँ, हटाएँ नहीं")} className="h-8 rounded-md border border-border px-2 hover:border-ink">
                  {item.active ? t("Hide", "छिपाएँ") : t("Show", "दिखाएँ")}
                </button>
                <button onClick={() => setConfirming(true)} aria-label={t("Delete product", "उत्पाद हटाएँ")} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-critical-subtle hover:text-critical-text">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
