import React from "react";

/**
 * The same header on every page, so a first-time user always knows:
 * what this page is, what they do here, and what they get out of it.
 */
export function PageIntro({
  section,
  title,
  what,
  doThis,
  get,
  actions,
}: {
  section: string;
  title: string;
  what: React.ReactNode;
  doThis?: React.ReactNode;
  get?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <span className="label-caps">{section}</span>
          <h1 className="mt-1.5 font-heading text-4xl font-medium tracking-tight text-ink md:text-[2.75rem]">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{what}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {(doThis || get) && (
        <dl className="grid grid-cols-1 gap-3 border-y border-border py-3 text-[13px] sm:grid-cols-2">
          {doThis && (
            <div className="flex gap-2.5">
              <dt className="label-caps w-20 shrink-0 pt-0.5 text-secondary">You do</dt>
              <dd className="text-ink">{doThis}</dd>
            </div>
          )}
          {get && (
            <div className="flex gap-2.5">
              <dt className="label-caps w-20 shrink-0 pt-0.5 text-tertiary">You get</dt>
              <dd className="text-ink">{get}</dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}
