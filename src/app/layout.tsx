import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Devanagari, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/Toaster";
import { NavProgress } from "@/components/layout/NavProgress";
import { Suspense } from "react";
import { createHash } from "node:crypto";
import { getCurrentUser } from "@/server/auth/session";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

// Hindi labels, in the same family as the Latin text
const plexDeva = IBM_Plex_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-deva",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const viewport: Viewport = { themeColor: "#1F3327" };

export const metadata: Metadata = {
  title: { default: "Carbon Wallet", template: "%s · Carbon Wallet" },
  // installed on a phone's home screen, it opens like an app (manifest.ts)
  appleWebApp: { capable: true, title: "Carbon Wallet", statusBarStyle: "default" },
  description:
    "Your home's carbon, measured from the bills you already pay: what your AC really burns, heat versus habit, and a record anyone can check.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // the browser cache of API data is tied to who is signed in (a short hash, not the id itself)
  const user = await getCurrentUser().catch(() => null);
  const cacheKey = user ? createHash("sha256").update(`cw:${user.id}`).digest("hex").slice(0, 16) : "guest";
  return (
    <html lang="en" className={`${plexSans.variable} ${plexDeva.variable} ${plexMono.variable} ${newsreader.variable}`}>
      {/* browser extensions (e.g. colour pickers) add attributes to <body> before React loads */}
      <body className="bg-canvas min-h-screen text-ink antialiased font-sans" suppressHydrationWarning>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <QueryProvider cacheKey={cacheKey}>{children}</QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
