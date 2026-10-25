import Link from "next/link";
import { PageIntro } from "@/components/ui/PageIntro";
import { MethodologySections } from "@/components/methodology/Methodology";

export const metadata = { title: "How we calculate" };

export default function HowWeCalculatePage() {
  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        section="About"
        title="How we calculate"
        what="Every number in Carbon Wallet comes from your own bills, appliances, vehicles and logs, using published Indian figures. Here is how, in plain words."
      />
      <MethodologySections />
      <p className="text-sm text-ink-muted">
        Questions about a number? Every page has a “How is this worked out?” link next to it. <Link href="/dashboard" className="underline">Back home</Link>
      </p>
    </div>
  );
}
