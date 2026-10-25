"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CreditCard, Users } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { Skeleton } from "@/components/ui/Skeleton";
import { HouseholdCard } from "@/components/household/HouseholdCard";
import { CarbonPassbook } from "@/components/passbook/CarbonPassbook";
import { CardStudio } from "@/components/card/CardStudio";
import { stateCode } from "@/lib/carbonId";
import type { MemberPassbook } from "@/server/services/passbook.service";

const TABS = [
  { id: "passbook", label: "Passbook", icon: BookOpen, blurb: "Your record, month by month" },
  { id: "card", label: "Physical card", icon: CreditCard, blurb: "Print it, tap it with a phone" },
  { id: "household", label: "Household", icon: Users, blurb: "Family, join code, what you own" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function CarbonIdPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "passbook") as Tab;
  const { activeHouseholdId } = useAppStore();
  const { data, isLoading } = useHouseholdOverview(activeHouseholdId);
  const { can } = usePermissions();
  const passbook = useQuery<MemberPassbook>({
    queryKey: ["household", activeHouseholdId, "passbook"],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/passbook`);
      if (!res.ok) throw new Error("passbook failed");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const { household } = data;

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        section="Your Carbon ID"
        title="Carbon ID & card"
        what="Your home gets one permanent Carbon ID, like a DigiLocker number for carbon. The passbook keeps every month, and the card carries a private barcode only Carbon Wallet can read."
        doThis="Open the passbook, print the card, or share the join code so family can join."
        get="A record you can show anyone: a landlord, a society, a green-loan bank or a competition judge."
        actions={
          passbook.data && (
            <div className="text-right">
              <span className="label-caps">Carbon ID</span>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.08em]">{passbook.data.carbonId}</p>
              <Link href={`/p/${passbook.data.publicToken}`} className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
                Open the public page →
              </Link>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="Carbon ID sections">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => router.replace(`/carbon-id?tab=${t.id}`, { scroll: false })}
              className={`flex items-center gap-3 border px-4 py-3 text-left transition-colors ${
                active ? "border-ink bg-canvas-card" : "border-border hover:border-border-hover"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-secondary" : "text-ink-light"}`} />
              <span className="flex flex-col">
                <span className={`text-sm ${active ? "font-semibold" : ""}`}>{t.label}</span>
                <span className="text-[11px] text-ink-muted">{t.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === "passbook" &&
        (passbook.data ? (
          <section>
            <p className="mb-6 max-w-2xl text-sm text-ink-muted">
              Click the passbook to open it. Each month is one entry; months that have been{" "}
              <Link href="/proof" className="underline underline-offset-2">locked on the public ledger</Link> get a stamp, so
              nobody can quietly change them later.
            </p>
            <CarbonPassbook data={passbook.data} publicPath={`/p/${passbook.data.publicToken}`} cardCode={passbook.data.cardCode} />
          </section>
        ) : passbook.isError ? (
          <p className="text-sm text-critical-text">Couldn&apos;t load the passbook.</p>
        ) : (
          <Skeleton className="mx-auto h-[440px] w-full max-w-[780px]" />
        ))}

      {tab === "card" &&
        (passbook.data ? (
          <section>
            <p className="mb-6 max-w-2xl text-sm text-ink-muted">
              The same Carbon ID as a real plastic card with a tap chip and a private barcode on the back. Download the print files,
              then write your private code to the chip.
            </p>
            <CardStudio
              householdId={household.id}
              carbonId={passbook.data.carbonId}
              householdName={household.name}
              stateCode={stateCode(household.state)}
              issuedOn={passbook.data.household.issuedOn}
              publicToken={passbook.data.publicToken}
              cardCode={passbook.data.cardCode}
              canManage={can("household:update")}
            />
          </section>
        ) : (
          <Skeleton className="h-96 w-full" />
        ))}

      {tab === "household" && <HouseholdCard data={data} />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CarbonIdPage />
    </Suspense>
  );
}
