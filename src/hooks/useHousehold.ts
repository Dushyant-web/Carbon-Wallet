"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { CreateActivityInput } from "@/types";

export function useHouseholds() {
  return useQuery({
    queryKey: ["households"],
    queryFn: async () => {
      const res = await fetch("/api/households");
      if (!res.ok) throw new Error("Failed to fetch households");
      return res.json();
    },
  });
}

export function useHouseholdOverview(householdId: string) {
  const demoRole = useAppStore((s) => s.demoRole);

  return useQuery({
    queryKey: ["household", householdId, "overview", demoRole],
    queryFn: async () => {
      const res = await fetch(`/api/households/${householdId}/overview`, {
        headers: {
          "x-demo-role": demoRole,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch household overview");
      return res.json();
    },
    enabled: !!householdId,
  });
}

export function useHouseholdActivities(
  householdId: string,
  category?: string,
  page: number = 1,
  limit: number = 15
) {
  const demoRole = useAppStore((s) => s.demoRole);

  return useQuery({
    queryKey: ["household", householdId, "activities", category, page, limit, demoRole],
    queryFn: async () => {
      const url = new URL(`/api/households/${householdId}/activities`, window.location.origin);
      if (category && category !== "all") {
        url.searchParams.set("category", category);
      }
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), {
        headers: {
          "x-demo-role": demoRole,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!householdId,
  });
}

export function useCreateActivity(householdId: string) {
  const queryClient = useQueryClient();
  const demoRole = useAppStore((s) => s.demoRole);

  return useMutation({
    mutationFn: async (input: CreateActivityInput) => {
      const res = await fetch(`/api/households/${householdId}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": demoRole,
        },
        body: JSON.stringify(input),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log activity");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household", householdId] });
      queryClient.invalidateQueries({ queryKey: ["households"] });
    },
  });
}
