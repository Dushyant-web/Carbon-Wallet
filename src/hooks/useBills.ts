"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import type { BillDocumentView, BillView, CalibrationView } from "@/lib/bills";

export type BillsResponse = { bills: BillView[]; pending: BillDocumentView[]; calibration: CalibrationView | null };

export type ConfirmBillInput = {
  documentId?: string | null;
  periodStart: string;
  periodEnd: string;
  kwh: number;
  amountInr?: number | null;
  importKwh?: number | null;
  exportKwh?: number | null;
  acHoursPerDay?: number;
  deleteOriginal?: boolean;
};

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function useBills(householdId: string) {
  const demoRole = useAppStore((s) => s.demoRole);
  return useQuery({
    queryKey: ["household", householdId, "bills", demoRole],
    queryFn: async () => json<BillsResponse>(await fetch(`/api/households/${householdId}/bills`, { headers: { "x-demo-role": demoRole } })),
    enabled: !!householdId,
  });
}

export function useBillDocument(householdId: string, documentId: string | null) {
  return useQuery({
    queryKey: ["household", householdId, "document", documentId],
    queryFn: async () =>
      (await json<{ document: BillDocumentView }>(await fetch(`/api/households/${householdId}/documents/${documentId}`))).document,
    enabled: !!householdId && !!documentId,
  });
}

/** Every bill change moves totals, scores, calibration and the passbook, so refresh the whole household. */
function useInvalidateHousehold(householdId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["household", householdId] });
    qc.invalidateQueries({ queryKey: ["households"] });
  };
}

export function useUploadBill(householdId: string) {
  const demoRole = useAppStore((s) => s.demoRole);
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: async ({ file, allowAi }: { file: File; allowAi: boolean }) => {
      const form = new FormData();
      form.set("file", file);
      if (allowAi) form.set("allowAi", "1");
      const res = await fetch(`/api/households/${householdId}/bills/upload`, {
        method: "POST",
        body: form,
        headers: { "x-demo-role": demoRole },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.documentId) return { duplicateOf: body.documentId as string, document: null };
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      return { duplicateOf: null, document: body.document as BillDocumentView };
    },
    onSuccess: invalidate,
  });
}

export function useAiReread(householdId: string) {
  const demoRole = useAppStore((s) => s.demoRole);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) =>
      (
        await json<{ document: BillDocumentView }>(
          await fetch(`/api/households/${householdId}/documents/${documentId}/ai`, {
            method: "POST",
            headers: { "x-demo-role": demoRole },
          }),
        )
      ).document,
    onSuccess: (doc) => qc.setQueryData(["household", householdId, "document", doc.id], doc),
  });
}

export function useConfirmBill(householdId: string) {
  const demoRole = useAppStore((s) => s.demoRole);
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: async (input: ConfirmBillInput) =>
      json<{ bill: { id: string } }>(
        await fetch(`/api/households/${householdId}/bills`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-demo-role": demoRole },
          body: JSON.stringify(input),
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteBill(householdId: string) {
  const demoRole = useAppStore((s) => s.demoRole);
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: async (billId: string) =>
      json(await fetch(`/api/households/${householdId}/bills/${billId}`, { method: "DELETE", headers: { "x-demo-role": demoRole } })),
    onSuccess: invalidate,
  });
}

export function useDiscardDocument(householdId: string) {
  const demoRole = useAppStore((s) => s.demoRole);
  const invalidate = useInvalidateHousehold(householdId);
  return useMutation({
    mutationFn: async (documentId: string) =>
      json(await fetch(`/api/households/${householdId}/documents/${documentId}`, { method: "DELETE", headers: { "x-demo-role": demoRole } })),
    onSuccess: invalidate,
  });
}
