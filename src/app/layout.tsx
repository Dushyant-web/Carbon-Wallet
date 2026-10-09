import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/components/providers/QueryProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { CreateHouseholdModal } from "@/components/dashboard/CreateHouseholdModal";

export const metadata: Metadata = {
  title: "CarbonOS - Household Intelligence Core",
  description: "Enterprise multi-tenant household carbon accounting and digital twin simulation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-canvas min-h-screen text-ink antialiased">
        <QueryProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 pl-0 lg:pl-64">
              <TopBar />
              <main className="pt-16 min-h-screen p-4 md:p-8 pb-24 lg:pb-8 bg-canvas">
                {children}
              </main>
            </div>
          </div>
          <BottomNav />
          <CreateHouseholdModal />
        </QueryProvider>
      </body>
    </html>
  );
}
