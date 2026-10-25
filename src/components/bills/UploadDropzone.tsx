"use client";

import React, { useRef, useState } from "react";
import { FileUp, Camera } from "lucide-react";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif";
const MAX = 10 * 1024 * 1024;

export function UploadDropzone({
  onFile,
  busy,
  disabled,
}: {
  onFile: (file: File) => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX) {
      setError("That file is over 10 MB. Export the bill as a PDF or take a smaller photo.");
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled || busy}
        onClick={() => !busy && !disabled && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && !disabled && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy && !disabled) pick(e.dataTransfer.files?.[0]);
        }}
        className={`relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed px-6 py-10 text-center transition-colors ${
          over ? "border-ink bg-canvas-card" : "border-border bg-canvas-subtle/60 hover:border-border-hover"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        {busy ? (
          <>
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-secondary" aria-hidden />
            <div>
              <p className="font-heading text-xl font-medium">Reading your bill…</p>
              <p className="mt-1 text-[13px] text-ink-muted">PDFs take a second or two. Phone photos take up to ~15 s while we straighten and read them.</p>
            </div>
          </>
        ) : (
          <>
            <FileUp className="h-9 w-9 text-ink-light" aria-hidden />
            <div>
              <p className="font-heading text-xl font-medium">Drop your electricity bill here</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                PDF from your discom&apos;s app or email, or a clear photo of the paper bill · JPG, PNG, HEIC · up to 10 MB
              </p>
            </div>
            <span className="border border-ink px-4 py-2 text-sm font-medium">Choose a file</span>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => camera.current?.click()}
          className="inline-flex items-center gap-2 text-[13px] text-ink-muted underline-offset-4 hover:text-ink hover:underline md:hidden"
        >
          <Camera className="h-4 w-4" aria-hidden /> Take a photo of the bill
        </button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-2 text-[13px] text-critical-text">{error}</p>}
    </div>
  );
}
