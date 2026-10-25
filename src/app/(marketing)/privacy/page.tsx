import Link from "next/link";
import { CONSENT_VERSION } from "@/server/services/privacy.service";

export const metadata = { title: "Privacy notice", description: "What Carbon Wallet keeps, why, and how to download or delete it." };

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "What we keep",
    body: (
      <>
        Your name, email and password (stored only as a one-way hash). For your household: its name, city and state, size, the
        appliances and vehicles you add, the numbers from your electricity bills and fuel fill-ups, what you log, your weekly
        check-ins, goals and the suggestions you commit to. We keep the city, never your street address.
      </>
    ),
  },
  {
    title: "Bills and photos",
    body: (
      <>
        A bill you upload is read for its units, dates and amount. The original file is stored encrypted only until you confirm the
        numbers, then deleted, unless you choose to keep it. The consumer number is kept only as a masked code. Pump-screen photos
        are not stored. If you allow it, a hard-to-read bill or photo is sent to a partner AI service to be read; otherwise nothing
        leaves our servers.
      </>
    ),
  },
  {
    title: "Why",
    body: (
      <>
        Only to work out your home&apos;s emissions, show you where they come from, suggest changes and check them against your next
        bills. We don&apos;t sell data, show ads or use your data to train AI.
      </>
    ),
  },
  {
    title: "Who sees what",
    body: (
      <>
        Members of your household see its record; the owner decides who joins and what role they have. Carbon Wallet admins can
        look at a household, read-only, to help with problems. The leaderboard shows other homes without names. A bank or employer
        sees your sealed months only through a link you create, which expires and which you can turn off.
      </>
    ),
  },
  {
    title: "The public seal",
    body: (
      <>
        When you seal a month, only a combined fingerprint of many homes&apos; months is written to a public blockchain. It contains no
        names, numbers or ids, and it can&apos;t be traced back to you without a secret code that we keep encrypted.
      </>
    ),
  },
  {
    title: "Reminders",
    body: <>Notifications are off until you turn them on for a device, and you can choose which ones and quiet hours.</>,
  },
  {
    title: "How long",
    body: (
      <>
        As long as you have an account. When you delete it, you&apos;re signed out everywhere at once and everything is erased 30
        days later: your account, households you delete with it, stored files, and the secret codes behind your sealed months.
        Only a count of erasures is kept.
      </>
    ),
  },
  {
    title: "Your rights",
    body: (
      <>
        Under India&apos;s Digital Personal Data Protection Act you can see, correct, download and erase your data, and withdraw
        consent. Download and delete are one tap in{" "}
        <Link href="/settings" className="underline underline-offset-2">
          Settings &amp; privacy
        </Link>
        ; correct anything by editing it in the app. Withdrawing consent means deleting your account.
      </>
    ),
  },
  {
    title: "Questions or complaints",
    body: <>Grievance officer: to be named by the organisation running this service before it is offered to the public.</>,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[820px] items-center justify-between px-5">
          <Link href="/" className="flex items-end gap-1.5">
            <span className="font-heading text-lg font-medium leading-none">Carbon Wallet</span>
            <span className="mb-[2px] h-1.5 w-1.5 bg-secondary" aria-hidden />
          </Link>
          <span className="label-caps text-ink-muted">Privacy notice · {CONSENT_VERSION}</span>
        </div>
      </header>
      <main className="mx-auto flex max-w-[820px] flex-col gap-8 px-5 py-10">
        <div>
          <h1 className="font-heading text-4xl md:text-5xl">Your data, in plain words</h1>
          <p className="mt-3 text-ink-muted">What Carbon Wallet keeps, why, who sees it, and how to download or delete it.</p>
        </div>
        {SECTIONS.map((s) => (
          <section key={s.title} className="border-t border-ink pt-3">
            <h2 className="font-heading text-xl font-medium">{s.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{s.body}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
