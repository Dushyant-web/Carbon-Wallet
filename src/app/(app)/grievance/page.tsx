"use client";

import { GrievanceDesk } from "@/components/help/GrievanceDesk";
import { useAppStore } from "@/store";

export default function Page() {
  const householdId = useAppStore((s) => s.activeHouseholdId);
  return <GrievanceDesk householdId={householdId || undefined} />;
}
