// Shapes returned by the bill-extraction engine (backend/app/bills/pipeline.py), shared by server and UI.

export type FieldConfidence = "high" | "medium" | "low";

export type ExtractedField<T = number | string | null> = {
  value: T;
  confidence: FieldConfidence;
  score: number;
  source: "pdf_text" | "ocr" | "ai";
  page: number | null;
  bbox: [number, number, number, number] | null; // normalised 0..1 on that page's preview
  snippet: string | null;
  reason: string | null;
  alternates: Array<number | string>;
};

export type BillExtraction = {
  status: "ok" | "review";
  needs_ai: boolean;
  ai_used: boolean;
  ai_provider?: string | null; // e.g. "NVIDIA"; null when the server has no AI configured
  file_kind: "pdf" | "jpeg" | "png" | "heic";
  text_source: "pdf_text" | "ocr";
  ocr_mean_conf: number;
  discom: { id: string; name: string; state: string; region: string; cycle: "monthly" | "bimonthly" };
  fields: {
    units_kwh: ExtractedField<number | null>;
    amount_inr: ExtractedField<number | null>;
    period_start: ExtractedField<string | null>;
    period_end: ExtractedField<string | null>;
    previous_reading: ExtractedField<number | null>;
    present_reading: ExtractedField<number | null>;
    multiplying_factor: ExtractedField<number | null>;
    import_kwh: ExtractedField<number | null>;
    export_kwh: ExtractedField<number | null>;
    bill_date: ExtractedField<string | null>;
    due_date: ExtractedField<string | null>;
  };
  derived: { units_from_readings?: number; net_kwh?: number; days?: number; inr_per_kwh?: number };
  consumer: { masked: string; hash: string } | null;
  warnings: string[];
  pages: number;
  previews?: string[]; // base64 PNG, stripped before storing
  elapsed_ms: number;
};

export type BillDocumentView = {
  id: string;
  status: "EXTRACTED" | "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED";
  fileName: string;
  previewCount: number;
  createdAt: string;
  extraction: Omit<BillExtraction, "previews" | "consumer"> & { consumer: { masked: string } | null };
};

export type BillView = {
  id: string;
  periodStart: string;
  periodEnd: string;
  days: number;
  kwh: number;
  importKwh: number | null;
  exportKwh: number | null;
  amountInr: number | null;
  acHoursPerDay: number;
  discom: string | null;
  consumerMasked: string | null;
  source: "UPLOAD" | "MANUAL";
  verified: boolean;
  kgCo2e: number;
  documentId: string | null;
};

export type CalibrationView = {
  acKw: number;
  acKwLow: number;
  acKwHigh: number;
  baseloadKwhDay: number;
  method: string;
  nBills: number;
  createdAt: string;
};
