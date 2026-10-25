import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/providers/QueryProvider";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable}`}>
      <body className="bg-canvas min-h-screen text-ink antialiased font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
