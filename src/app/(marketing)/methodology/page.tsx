import Link from "next/link";
import { MethodologySections } from "@/components/methodology/Methodology";

export const metadata = { title: "How Carbon Wallet calculates", description: "Every number, its source, in plain words." };

/** Public: anyone checking a shared record (or a claim on the landing page) can see how it was worked out. */
export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[960px] items-center justify-between px-5">
          <Link href="/" className="flex items-end gap-1.5">
            <span className="font-heading text-lg font-medium leading-none">Carbon Wallet</span>
            <span className="mb-[2px] h-1.5 w-1.5 bg-secondary" aria-hidden />
          </Link>
          <span className="label-caps text-ink-muted">Methodology</span>
        </div>
      </header>
      <main className="mx-auto flex max-w-[960px] flex-col gap-8 px-5 py-10">
        <div>
          <h1 className="font-heading text-4xl md:text-5xl">How we calculate</h1>
          <p className="mt-3 max-w-2xl text-ink-muted">
            Every number in Carbon Wallet comes from a household&apos;s own bills, appliances, vehicles and logs, using published Indian
            figures. Here is how, in plain words.
          </p>
        </div>
        <MethodologySections />
      </main>
    </div>
  );
}
