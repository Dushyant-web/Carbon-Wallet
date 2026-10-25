import React from "react";

/** How every number is worked out, in plain words. Shown in the app and publicly at /methodology. */
export const METHOD_SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Electricity",
    body: (
      <>
        Every unit (kWh) you use from the grid counts as 0.675 kg of CO₂, India&apos;s official grid average for 2025-26 from the
        Central Electricity Authority. When you upload a bill, its units become your electricity for those days, shared across the
        calendar months the bill covers. Anything you logged by hand for the same days stops counting, so nothing is counted twice.
      </>
    ),
  },
  {
    title: "Your AC's real power",
    body: (
      <>
        Star labels assume an AC runs about 1,600 hours a year in lab conditions; real homes are different. With two or more bills
        and the hours your AC ran, we work out how much of each bill was the AC and how much was everything else, which gives your
        AC&apos;s real power. More bills make it more precise.
      </>
    ),
  },
  {
    title: "Heat or habit",
    body: (
      <>
        We look up the actual daily temperatures in your city for each bill period and add up how far each day was above 24 °C. If
        a bill went up, we can then split the rise into the part the weather caused and the part your AC use caused. The two parts
        always add up to the full change.
      </>
    ),
  },
  {
    title: "Cars and fuel",
    body: (
      <>
        Burning a litre of petrol releases 2.31 kg of CO₂, diesel 2.68 kg and a kilo of CNG 2.75 kg (India GHG Program, IPCC). A
        fuel fill-up is counted exactly. Trips logged in km use typical Indian per-km figures; once you log fuel for a car, its
        km-based estimates for that month stop counting.
      </>
    ),
  },
  {
    title: "What changed each month",
    body: (
      <>
        Each month&apos;s total is split into its sources (your bills, each vehicle, flights, food, waste) and compared with your
        average month. Every source gets its fair share of the difference using a standard method from game theory, so the parts
        always add up exactly to the month&apos;s total.
      </>
    ),
  },
  {
    title: "Summaries in plain words",
    body: (
      <>
        Short summaries are written automatically from your numbers. They can only use numbers we calculated: any sentence with a
        number that isn&apos;t in your data is removed before you see it.
      </>
    ),
  },
  {
    title: "Reading bills and photos",
    body: (
      <>
        We read the units, dates and amount from your bill and show you exactly where on the bill each number came from, so you can
        check before saving. Photos of pump screens can be read by a partner service if you allow it; photos aren&apos;t stored.
      </>
    ),
  },
  {
    title: "Heatwave days",
    body: (
      <>
        On days the India Meteorological Department would call a heatwave (a high of 40 °C or more and at least 4.5 °C above
        normal, or 45 °C outright; 37 °C on the coast, 30 °C in the hills), cooling keeps people safe. We find those days in your
        bills from real weather and count that AC use as essential: it is shown, but it never counts against your goal and we
        never suggest cutting it.
      </>
    ),
  },
  {
    title: "AC gas refills",
    body: (
      <>
        An AC only needs gas because gas leaked out, and that gas traps far more heat than CO₂: one kilo of R-32 equals 771 kg
        of CO₂ (IPCC AR6). A refill is counted in the month it happens, as its own line, so it never hides inside electricity.
      </>
    ),
  },
  {
    title: "Flights, cooking gas and public transport",
    body: (
      <>
        Flights use the straight-line distance between airports plus 8% for routing (UK DEFRA method). An LPG cylinder counts
        2.98 kg of CO₂ per kilo of gas. Metro, bus and train trips use published per-passenger-km figures.
      </>
    ),
  },
  {
    title: "Rooftop solar",
    body: (
      <>
        On a net-metering bill we count the units you drew from the grid. Solar you sent back to the grid is shown, but never
        subtracted from your own emissions; that keeps the numbers conservative.
      </>
    ),
  },
  {
    title: "Goals",
    body: (
      <>
        A goal compares each month with the same month last year, so summer is compared with summer. The cut grows a little each
        month. We show where the month is heading, never &ldquo;kg left to spend&rdquo;; a category with nothing recorded yet runs
        at its usual level, so missing data never looks like a saving.
      </>
    ),
  },
  {
    title: "Weekly check-in",
    body: (
      <>
        A one-minute check-in records the week&apos;s car km, metro and bus km and AC hours. If a week is missed, it is filled
        from your usual week and marked as estimated, never as zero. Anything a bill or fuel fill-up already covers is not counted
        twice.
      </>
    ),
  },
  {
    title: "Checking your commitments",
    body: (
      <>
        When you commit to a suggestion, we check it against what happens next. For electricity, your next bill is compared with
        what that home would have used under the new bill&apos;s real weather. For a car, fuel bought the month after is compared
        with the months before. With no bill or fill-up yet, a commitment counts at half, and is labelled as a promise.
      </>
    ),
  },
  {
    title: "Proof",
    body: (
      <>
        When a month is locked, its totals (read from your records, never typed in) become a short fingerprint. Fingerprints from
        many homes are combined into one code and written to a public blockchain that nobody can edit; only that combined code
        is public. Anyone can later check that your month matches, without seeing your name or address. You can share chosen
        months with a bank or employer through a link that expires and that you can turn off.
      </>
    ),
  },
];


export function MethodologySections() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {METHOD_SECTIONS.map((s) => (
        <section key={s.title} className="border-t border-ink pt-3">
          <h2 className="font-heading text-xl font-medium">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
