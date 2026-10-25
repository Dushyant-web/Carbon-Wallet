"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, PencilLine } from "lucide-react";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { useBillDocument, useDiscardDocument, useUploadBill } from "@/hooks/useBills";
import { UploadDropzone } from "@/components/bills/UploadDropzone";
import { BillReview } from "@/components/bills/BillReview";
import { Skeleton } from "@/components/ui/Skeleton";

function NewBill() {
  const router = useRouter();
  const params = useSearchParams();
  const docId = params.get("doc");
  const manual = params.get("manual") === "1";
  const { activeHouseholdId } = useAppStore();
  const { can } = usePermissions();
  const [allowAi, setAllowAi] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const upload = useUploadBill(activeHouseholdId);
  const doc = useBillDocument(activeHouseholdId, docId);
  const discard = useDiscardDocument(activeHouseholdId);

  const done = (billId: string) => router.push(`/bills?added=${billId}`);

  if (!can("bill:create")) {
    return <p className="text-sm text-ink-muted">View-only members can see bills but not add them. Ask the household owner.</p>;
  }

  const step = docId || manual ? 2 : 1;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Link href="/bills" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Bills
        </Link>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-mono text-[11px] text-ink-muted">Step {step} of 2</span>
          <span className="label-caps">{step === 1 ? "Upload" : "Check & confirm"}</span>
        </div>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">
          {step === 1 ? "Add an electricity bill" : manual ? "Type in a bill" : "Check what we read"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {step === 1
            ? "We read the units (kWh), billing period and amount straight off your bill. You check them against the highlighted bill, then confirm. Nothing is counted until you do."
            : manual
              ? "Copy the units and dates from your bill. Uploaded bills are marked as document-backed, typed bills as self-reported."
              : "Each number is boxed on the bill where we found it. Fix anything that's wrong; the chips show how sure we are."}
        </p>
      </header>

      {step === 1 && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <UploadDropzone
              busy={upload.isPending}
              onFile={(file) => {
                setNotice(null);
                upload.mutate(
                  { file, allowAi },
                  {
                    onSuccess: (r) => {
                      if (r.duplicateOf) {
                        setNotice("You've uploaded this exact file before. Opening it.");
                        router.replace(`/bills/new?doc=${r.duplicateOf}`);
                      } else if (r.document) {
                        router.replace(`/bills/new?doc=${r.document.id}`);
                      }
                    },
                  },
                )
              }}
            />
            <label className="mt-5 flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" className="mt-0.5 accent-[#1D1C18]" checked={allowAi} onChange={(e) => setAllowAi(e.target.checked)} />
              <span>
                If a number isn&apos;t clear, let our partner service read the bill once more
                <span className="block text-ink-muted">Off by default. You can also decide after seeing the result.</span>
              </span>
            </label>
            {upload.error && <p className="mt-4 text-[13px] text-critical-text">{(upload.error as Error).message}</p>}
            {notice && <p className="mt-4 text-[13px] text-ink-muted">{notice}</p>}
          </div>

          <aside className="flex flex-col gap-6 text-[13px] leading-relaxed">
            <div className="border-t border-ink pt-3">
              <span className="label-caps">Works with</span>
              <p className="mt-2 text-ink-muted">
                BSES Rajdhani & Yamuna, Tata Power-DDL, NDMC · UPPCL (PVVNL, MVVNL, DVVNL, PuVVNL, KESCo), NPCL · DHBVN, UHBVN ·
                MSEDCL, Adani, Tata Power Mumbai, BEST · Torrent, Gujarat DISCOMs · BESCOM & Karnataka ESCOMs, TANGEDCO, KSEB,
                TGSPDCL, AP DISCOMs. Other bills fall back to a generic reader.
              </p>
            </div>
            <div className="border-t border-ink pt-3">
              <span className="label-caps">For a good photo</span>
              <ul className="mt-2 list-disc pl-4 text-ink-muted">
                <li>Flat on a table, whole bill in frame</li>
                <li>Daylight, no flash glare on the numbers</li>
                <li>Hindi + English bills are both fine</li>
              </ul>
            </div>
            <div className="border-t border-ink pt-3">
              <span className="label-caps">Privacy</span>
              <p className="mt-2 text-ink-muted">
                Files are encrypted on our server and only your household can open them. Your consumer number is stored masked
                (••••1234). After you confirm, the file is deleted unless you choose to keep it.
              </p>
            </div>
            <Link
              href="/bills/new?manual=1"
              className="inline-flex items-center gap-2 self-start text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              <PencilLine className="h-4 w-4" /> No file? Type the bill in instead
            </Link>
          </aside>
        </div>
      )}

      {step === 2 && manual && <BillReview householdId={activeHouseholdId} document={null} onConfirmed={done} onDiscard={() => router.push("/bills")} />}

      {step === 2 && docId && (
        <>
          {doc.isLoading && (
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <Skeleton className="aspect-[1/1.3] w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          )}
          {doc.error && <p className="text-[13px] text-critical-text">{(doc.error as Error).message}</p>}
          {doc.data && doc.data.status === "CONFIRMED" && (
            <p className="text-sm">
              This bill is already confirmed. <Link href="/bills" className="underline">See your bills</Link>.
            </p>
          )}
          {doc.data && doc.data.status !== "CONFIRMED" && (
            <BillReview
              key={`${doc.data.id}-${doc.data.extraction.ai_used}`}
              householdId={activeHouseholdId}
              document={doc.data}
              onConfirmed={done}
              onDiscard={() => discard.mutate(doc.data!.id, { onSuccess: () => router.push("/bills/new") })}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function NewBillPage() {
  return (
    <Suspense fallback={null}>
      <NewBill />
    </Suspense>
  );
}
