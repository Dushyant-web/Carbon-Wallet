import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-primary px-12 py-10 text-canvas-card">
        <Link href="/" className="flex items-end gap-2">
          <span className="font-heading text-2xl font-medium leading-none">Carbon Wallet</span>
          <span className="mb-[3px] h-1.5 w-1.5 bg-secondary" aria-hidden />
        </Link>
        <div>
          <p className="font-heading text-4xl leading-tight tracking-tight">
            Two electricity bills tell us
            <br />
            what your AC really draws.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-canvas-card/70">
            Then you get your home&apos;s carbon in kg and ₹, what&apos;s weather and what&apos;s habit, and a monthly record
            anyone can check.
          </p>
        </div>
        <p className="text-[12px] text-canvas-card/50">Built on India&apos;s official electricity and fuel figures.</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">{children}</main>
    </div>
  );
}
