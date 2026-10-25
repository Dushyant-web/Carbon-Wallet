# Carbon Wallet — Flaws, Risks & Verdict

> An adversarial review of the idea: the original concept, the refined draft, and the design in
> [system_design.md](system_design.md). Each flaw lists its **evidence**, **severity**, the **mitigation**
> already built into the design, and the **residual risk** that remains.
>
> Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## 0. Verdict and rating

### 0.1 Scorecard (out of 10)

| Dimension | Original "AC = points" | Refined draft | This design | Why |
|---|:---:|:---:|:---:|---|
| Problem importance (India) | 8 | 8 | 8 | Indian ACs emitted ~156 Mt CO₂e in 2024, about equal to all passenger cars. The stock is projected to grow 62M → 245M by 2035 (iFOREST 2025) |
| Methodological soundness | 2 | 6 | 8 | The draft used an outdated grid factor, label-only AC, no refrigerant, and a veg/non-veg food axis (§A) |
| Differentiation | 3 | 6 | 7.5 | Bill-calibrated AC + refrigerant ledger + weather-vs-behaviour decomposition isn't offered by CarbonWatch (static 0–10 score), Meri LiFE (pledges), or Commons (spend-based) |
| MVP feasibility on the stack | 9 | 8 | 8 | Small data, CPU-light math. The hard parts are product and trust, not engineering |
| Behaviour-change potential | 2 | 5 | 6 | Best evidence (home energy reports) shows ~2% average and more for heavy users. Opt-in apps reach fewer people (§C2) |
| Retention outlook | 2 | 3 | 5 | The category typically loses users in 1–2 weeks. The bill-first, 60-s/week design helps but isn't proven |
| B2C business viability | 2 | 3 | 4 | Low willingness to pay; free government apps; failed or pivoted peers (§E1) |
| B2B2C viability (discom / RWA / campus / employer) | — | — | 6.5 | The data arrives without user effort, and there is a proven intervention format |
| Hackathon / demo strength | 4 | 7.5 | 9 | Two bills → "your AC is 57%" → heat-vs-habit split → 771-kg refrigerant reveal is a strong 3-minute story |
| **Overall** | **3** | **6** | **7.5 as a product/project · 5 as a standalone B2C startup** | |

### 0.2 What's genuinely strong

1. **AC-first is the right wedge for urban India.** AC can exceed a car commute (117 vs 63 kg/month in system_design §5.7), and AC demand is the fastest-growing household load.
2. **Bill calibration** turns guesses into household-specific numbers. No competitor in India does this.
3. **Weather-normalized feedback** ("two-thirds is the heat, one-third is habit") is fair to users and analytically defensible (LMDI).
4. **Refrigerant leakage** is an under-recognized lever, roughly a third of AC emissions, and fixing it is cheap: get a leak test before a refill.
5. **Honest numbers** (ranges, tiers, sources) are a real trust differentiator, given that calculators routinely disagree by tonnes (Padgett et al. 2008).

### 0.3 What would make it a 9

- A **data partner** (discom or smart-meter feed, campus or RWA) so users don't have to enter data at all.
- **Measured AC data** from a 10–20 unit smart-plug study, to validate calibration error.
- A **pilot showing bill-verified reductions** against a weather-normalized counterfactual.

---

## A. Corrections to the refined draft (factual issues found during research)

| # | Draft said | Research shows | Severity | Fix in design |
|---|---|---|:---:|---|
| A1 | Grid factor 0.727 kg/kWh (CM 0.757) | **CEA v22.0 (Aug 2026), FY 2025-26: average 0.675, OM 0.963, BM 0.446, CM 0.705.** 0.727 is FY 2023-24 | 🟠 | Versioned per-FY factors. 0.727 still applies to FY 2023-24 months |
| A2 | "Check if the factor is generated or delivered basis" | **Resolved:** CEA computes on *net generation injected into the grid* (v22 §5); T&D losses are not included. National AT&C loss was 15.04% in FY25 | 🟡 | T&D reported as a separate Scope 3 line, excluded from the target by default |
| A3 | AC kW = BEE label kWh ÷ 1,600 h (~0.45 kW) | Prayas 5-city survey (n = 1,500): stock average **1,250 kWh over 1,077 h ≈ 1.16 kW**, which is **2.6×** the 5★ label-derived figure | 🔴 | Bill calibration. The label value is only the "Declared" tier |
| A4 | AC = electricity only | **52 of 156 Mt CO₂e** (about a third) of AC emissions come from refrigerant leaks. 40% of ACs are refilled annually (iFOREST 2025). One 1 kg R-32 top-up ≈ 771 kg CO₂e | 🔴 | Refrigerant events (system_design §5.4) |
| A5 | "Vegetarian meal vs meat-heavy meal" | Indian rice is **5.65 kg CO₂e/kg** (paddy methane; higher than the 4.45 global mean) and milk is 2.4 (Vetter 2017). 100 g paneer (~1.3 kg) > 100 g chicken (~1.0 kg) | 🟠 | Ingredient-level food model |
| A6 | Benchmark "2.19 t/person ≈ 180 kg/month" | That is *territorial* fossil CO₂ for the whole economy (industry, freight, government). The *lifestyle* footprint is ~2.0 t (Hot or Cool, 2017), already below the 2.5 t 2030 1.5 °C-compatible level. Comparing a partial personal scope to either is apples-to-oranges | 🟠 | Same-scope references only; self-baseline first |
| A7 | "8.4 kg = 18 h less AC or 25 kWh renewable" | 8.4 kg = 12.4 kWh. That is **10.7 AC-hours at 1.16 kW or 28 at 0.44 kW**, so a generic equivalent can be wrong by 2.6× | 🟡 | Equivalents computed from the household's own calibrated k |
| A8 | Flight ≈ 0.23 kg/pkm (DEFRA, with RF) | DEFRA 2025 domestic: 0.1355 without RF, 0.2293 with RF. "Domestic" is calibrated to short UK routes, so it likely **overstates** per-km emissions for 1,100+ km Indian routes. RF inclusion is a choice, not a fact | 🟡 | Show both; distance-banded factors in v1.1 |
| A9 | Metro 21–29 g/pkm, bus 29, 2W 41, car 88… (TERI) | Couldn't be verified from the primary source (the TERI PDF now returns 404). Only the 32.38 g/pkm "saved vs road average" headline is public. The India GHG Program gives bus = **15.2 g/pkm** (2015) | 🟡 | Metro marked `verified=false`; bus uses India GHG Program |
| A10 | "AC 2 h/day less ≈ 100–220 kg/season" | **89–319 kg**, depending on k (0.44–1.29 kW) and season length (150–183 days) | 🟢 | Simulator per household |
| A11 | Opower 2% as evidence the app will work | Opower was **opt-out** (households enrolled by default) in the US. An opt-in app draws already-motivated users, so the marginal effect is smaller (§C2). The Bangalore "7%" (WRI) is a **pre-post comparison**, not an RCT | 🟠 | Pilot with a proper counterfactual (§H) |
| A12 | "1 Carbon Point = 1 kg" | Even when pegged to kg, "points" invite gamified *accumulation*. Emissions should go down, not up | 🟡 | No points; kg plus a self-referenced score |

---

## B. Methodological flaws

### B1. Household vs individual attribution — 🟠 High
- **Problem:** Electricity, LPG, and car use are shared. If 3 family members each sign up and enter the same bill, the household is counted 3×. Per-person "budgets" on shared resources are arbitrary.
- **Mitigation:** The household is the accounting unit (ADR-002). Members join households, and per-capita = household ÷ members.
- **Residual:** Allocation inside a household (one person's long drives) is approximate. Shared flats and PGs (paying-guest housing) need a "split bill" mode.

### B2. AC calibration identifiability — 🟠 High
- **Problem:** A bill measures `hours × kW` jointly. If declared hours are wrong by 30%, calibrated k is wrong by 30% in the opposite direction, and "you can save X by cutting 1 h" inherits the error.
- **Evidence:** Self-reported appliance hours are notoriously noisy, and Prayas found large city-to-city usage differences (668–1,593 h/yr).
- **Mitigation:** Two-season regression (winter isolates baseload); k bounded to 0.3–2.5 kW; wide ranges until there is more data; smart-plug "Measured" tier in v2.
- **Residual:** Most users will never buy a plug. Validate the error in a 10–20 AC smart-plug study before claiming precision.

### B3. Weather normalization is imperfect — 🟡 Medium
- **Problem:** CDD ignores humidity. Comfort cooling in Mumbai, Chennai, or Kochi is driven by humid heat, not just dry-bulb temperature. Kochi averaged 668 AC hours/yr vs Patna's 1,427 (Prayas).
- **Mitigation:** City-specific seasonal indices learned from the household's own bills over time.
- **Residual:** First-year normalization is rough. Consider a heat-index or wet-bulb CDD variant per climate zone.

### B4. Average vs marginal grid factor — 🟡 Medium
- **Problem:** Cutting demand mostly avoids *marginal* (coal-heavy) generation. CEA's FY 2025-26 operating margin (0.963) is **43% higher** than the average (0.675), so average-based savings understate the real effect.
- **Choice:** Use the average for both inventory and savings, so savings can never exceed the footprint and numbers stay internally consistent and conservative. Conservatism also helps under the greenwashing rules (§G1). The marginal view is a labelled toggle.
- **Residual:** Experts may object either way, so disclose the choice on the Methodology page.

### B5. Partial scope → false reassurance — 🟠 High
- **Problem:** "Within budget" covers only electricity, transport, food, and LPG. For affluent urban users, flights and consumption can dominate. **One Delhi–Mumbai return flight ≈ 308–522 kg**, more than the Sharma household's entire monthly electricity footprint (283 kg).
- **Mitigation:** A "coverage" disclosure on the wallet, an annual big-ticket view (flights, refrigerant, purchases), and never "you're sustainable" language.
- **Residual:** Spend-based shopping estimates (v3) are themselves very uncertain.

### B6. Calculator disagreement erodes trust — 🟡 Medium
- **Evidence:** Padgett et al. (2008): ten US calculators gave results differing by "several metric tons per annum" for the same inputs, with electricity the most inconsistent. A later comparison found an SD of 2.3 t CO₂/capita across calculators.
- **Mitigation:** Public methodology, ranges, sources, and factor versions. Explain the gap whenever a user compares with another app.

### B7. Stale and partial transport factors — 🟡 Medium
- **Problem:** The India GHG Program factors date from **2015**, before BS-VI and newer CAFE norms. They are tank-to-wheel CO₂ only (no CH₄/N₂O, no well-to-tank), and their 10% "real-world uplift" is an assumption. Delhi congestion likely pushes emissions higher.
- **Mitigation:** Asymmetric +25% high bound; flagged for replacement; EV km derived from kWh to avoid double counting.
- **Residual:** Needs an updated India-specific source.

### B8. Food data is thin — 🟡 Medium
- **Problem:** Only a handful of items have India-specific LCA values (Vetter 2017). The rest are global means from Poore & Nemecek, whose ranges are huge (beef herd: mean 99 vs median ~60 kg/kg). Serving sizes are self-reported. Diets vary by region, religion, and season.
- **Mitigation:** Coarse weekly *pattern* input and wide ranges. Food has low weight in nudges, and the app never moralizes religious or cultural diets.
- **Residual:** Food numbers are the least reliable in the product; say so.

### B9. National grid factor for every state — 🟢 Low
- **Problem:** India has operated as one synchronized grid since Dec 2013, and CEA publishes one all-India factor. A user in a hydro-heavy state and one in a coal-heavy state get the same factor.
- **Position:** This is the standard location-based method. State-level or hourly factors are v2 (and need paid data).

### B10. BEE label comparability — 🟢 Low
- **Problem:** BEE tightened star bands from **Jan 2026**, so a 2024 "5★" and a 2026 "5★" differ.
- **Mitigation:** Ask for the **kWh/year** printed on the label and the label year, not the star count.

### B11. Bill data quality — 🟡 Medium
- **Problem:** Estimated readings, bi-monthly cycles (e.g., Tamil Nadu, Kerala), arrears, net metering, and shared meters in rented flats.
- **Mitigation:** Day-prorating, an `estimated_reading` flag (widens the range), solar-export field, and a "shared meter" option with a manual share.

---

## C. Behavioural flaws

### C1. Logging fatigue kills the category — 🔴 Critical
- **Evidence:**
  - Sustainability apps typically lose most active users within the first month, with drop-off at 1–2 weeks when manual logging fatigue sets in.
  - **Lahti CitiCAP** (Finland, city of 120,000, automatic tracking plus rewards): ~3,000 downloads, **at best ~350 weekly active users**.
  - **Meri LiFE**: ~110,000 app downloads against 23M pledges. Pledges are not measured reductions.
- **Mitigation:** Bill-first (1 min/month); pre-filled weekly check-in (1 tap if unchanged); gaps filled from the routine, never as zero; no daily logging is required anywhere.
- **Residual:** Still the #1 risk. This is why B2B2C data feeds matter (§E3).

### C2. Selection bias and small effects — 🟠 High
- **Evidence:** Home-energy-report effects (~2% average; 6.3% top decile vs 0.3% bottom; Allcott 2011) came from **opt-out** programmes covering everyone. Opt-in users are already motivated, which makes for lower headroom and inflated before/after claims.
- **Mitigation:** Measure against a weather-normalized counterfactual, not "before vs after". Target high-consumption households in outreach.
- **Residual:** Pilot results will look better than reality unless there is a control group.

### C3. Moral licensing: the budget becomes an allowance — 🟠 High
- **Evidence:** A lab study estimated a **32% behavioural rebound**, amplified by moral licensing and strongest among the most pro-environmental people. "You have 13.6 kg left" reads as permission to spend it.
- **Mitigation:** Show trajectory vs target, never "remaining kg". Celebrate *verified* reductions, not "staying under". Under-target months don't unlock anything.

### C4. Effects decay without continued feedback — 🟡 Medium
- **Evidence:** After home energy reports stopped, effects decayed 10–20% per year. Households that kept receiving them saved 50–60% more (Allcott & Rogers 2014).
- **Mitigation:** Weekly check-in and monthly report are the product's core rhythm, not add-ons.

### C5. Self-report and social-desirability bias — 🟡 Medium
- **Problem:** Users under-report car km and over-report metro or veg days, especially once a score exists.
- **Mitigation:** Bills anchor the largest category. Declared commitments get half credit. Bill-verified results count fully.

### C6. Shaming cooling during extreme heat — 🔴 Critical (ethical)
- **Problem:** Delhi summers routinely exceed 45 °C, and heat stress is a health risk. Nudging "less AC" on those days is harmful and will cause backlash.
- **Mitigation:** Heat-alert days are tagged *essential* and excluded from overage, and AC-hour cuts are de-prioritized on those days. Recommendations focus on efficiency at the same comfort level (26 °C + fan, servicing, leak repair).

### C7. Carbon is a weak motivator on its own — 🟡 Medium
- **Problem:** Few households act on kg alone.
- **Mitigation:** Lead with **₹** ("₹560 and 54 kg less this month") and with comfort and appliance health ("leak repair saves future refill costs").

### C8. Goodhart's law on the score — 🟡 Medium
- **Mitigation:** Score gating (no score without data), weather normalization, logging-less-never-helps rule, half credit for declared actions.

---

## D. Product and UX flaws

| # | Flaw | Severity | Mitigation |
|---|---|:---:|---|
| D1 | **Feature sprawl.** Wallet, leak detector, simulator, actions, score, budget, and coach all in v1 risks shallow everything | 🟠 | Build order: bill → AC calibration → simulator → commitment/verify. The score ships last and can be cut |
| D2 | Users don't have bills handy (paid through UPI or the discom app) | 🟡 | Bills are skippable, with a reminder later. Bill email-forward or OCR in v1.1 |
| D3 | A web app isn't a habit tool. iOS web push needs an *installed* PWA | 🟡 | PWA install prompt after the first insight; email fallback; native only if D30 < 15% (ADR-010) |
| D4 | Ranges and tiers confuse lay users | 🟡 | One visual pattern (`162 kg ≈140–190` + chip); usability-test that 4 of 5 users can explain it |
| D5 | Narrow audience: AC ownership is still a minority nationally (Prayas), though 43% of surveyed Delhi households own at least one AC (Khosla 2021) | 🟡 | Position as *urban, AC-owning households*, and avoid moralizing at lower-income users |
| D6 | Household invites add friction | 🟢 | Single-user households by default; invites optional |

---

## E. Business and market flaws

### E1. B2C willingness to pay is low, and peers struggled — 🟠 High
- **Evidence:**
  - **Doconomy "DO Black"**, a carbon-limit credit card with Mastercard (2019), got huge press and was reportedly discontinued in 2022.
  - **Joro** rebranded to **Commons** (spend-based tracking; last raised in 2022).
  - **Earth Hero** reports ~150k users.
  - Government apps are free (CarbonWatch, Meri LiFE).
- **Implication:** A paid consumer app is unlikely to work.

### E2. Monetization traps that destroy trust — 🟠 High
- **Selling offsets:** The 2023 Guardian/Zeit/SourceMaterial investigation found that **>90% of Verra rainforest offsets** analysed were likely "phantom credits". Offsets would contradict "reductions ≠ offsets".
- **AC affiliate links:** This creates a conflict of interest, because the app would profit from recommending replacements. Premature replacement also wastes embodied carbon.
- **Rule:** No revenue tied to the user emitting or buying more.

### E3. Distribution is the real problem → B2B2C — 🟠 High
| Channel | Why it fits | Evidence / hook |
|---|---|---|
| Discoms | Already send bills, and could replace manual entry with smart-meter data | Home energy reports: ~2% savings in US RCTs; Bangalore pilot (2,000+ households) reported 7% (pre-post) |
| Campuses / hostels | Captive cohorts, shared meters, competitions | Fits the student-builder origin |
| RWAs / housing societies | Common-area + household dashboards; collective rooftop solar | |
| Employers | Employee commuting is Scope 3 Category 7 in corporate inventories | Commute check-ins have direct value |
| Fintech PFM | Spend-based layer later | Account Aggregator served 7.69M PFM customers in FY25, but access needs a regulated FIU partner |

### E4. No data moat yet — 🟡 Medium
- **Evidence:** 5.28 crore smart meters were installed by Dec 2025, far below the RDSS target of 25 crore by March 2026. There is no standardized consumer data-portability API (no "Green Button" equivalent).
- **Implication:** Defensibility has to come from **trust, methodology, and partnerships**, not proprietary data, at least at first.

### E5. Easy to copy — 🟢 Low
The formulas are public, and the design intends them to be. The moat is execution, calibration data across many households, and distribution.

### E6. Hidden running costs — 🟢 Low
Open-Meteo's historical/climate APIs need the commercial Professional plan, unless IMD data is used instead. LLM costs scale with usage, so keep the coach optional.

---

## F. Technical flaws and risks (stack-specific)

| # | Risk | Severity | Mitigation |
|---|---|:---:|---|
| F1 | Recompute storm when a factor set is published | 🟡 | Chunked, rate-limited jobs; snapshots served meanwhile |
| F2 | An append-only ledger is heavier than a hackathon needs | 🟢 | Hackathon cut uses delete + insert; the ledger lands in the MVP |
| F3 | JSONB payload schema drift | 🟡 | `payload.v` version field; Pydantic discriminated unions; migration scripts for payload upgrades |
| F4 | No ground truth to test against | 🟠 | Golden tests check *arithmetic*, not *reality*. A smart-plug validation study is required before claiming accuracy |
| F5 | LLM invents numbers | 🟠 | Number guard (every number must appear in the payload) with templated fallback |
| F6 | **Occupancy leakage.** AC hours and travel days reveal when a home is empty | 🟠 | Never expose daily patterns outside the household; no social sharing of raw data; aggregate before any research use; short session lifetimes |
| F7 | Bill OCR brittleness across ~60 discom formats | 🟢 | Postponed to v1.1; manual entry first |
| F8 | Float vs NUMERIC rounding mismatch between API and UI | 🟢 | Compute in float, store NUMERIC(14,4), one display-rounding helper (3 significant figures) |
| F9 | Weather API outage | 🟢 | Fall back to climate normals; flag "weather estimated" |

---

## G. Legal, ethical, and reputational flaws

### G1. Greenwashing rules apply to the app's own claims — 🟠 High
The CCPA *Guidelines for Prevention and Regulation of Greenwashing or Misleading Environmental Claims, 2024* require environmental claims to be truthful and substantiated, with the substantiation disclosed through a QR code, URL, or similar link. Terms like "carbon neutral" need credible certification.
- **Design response:** No "carbon neutral" or "eco-friendly user" badges. Every "you saved X kg" links to `/methodology`. Conservative average-factor savings (§B4).

### G2. DPDP Act compliance — 🟠 High
The Rules were notified in Nov 2025. Consent-manager provisions apply from Nov 2026, and the main obligations (notice, security, breach reporting, erasure, rights) from **13 May 2027**.
- **Design response:** Consent ledger, export, 30-day hard delete, non-user members stored as counts only (avoids minors' data), city-level location only.

### G3. "Wallet" implies money or tradeable credits — 🟡 Medium
Users may confuse it with India's **Carbon Credit Trading Scheme** or the **Green Credit Programme**, and assume their "kg" can be redeemed or traded.
- **Design response:** An in-app explainer. Consider renaming to **"Carbon Account"** or **"Carbon Ledger"**.

### G4. The individual-blame critique — 🟡 Medium
The personal "carbon footprint" calculator was popularized by **BP's 2004 "Beyond Petroleum" campaign**. Critics argue it shifts responsibility from producers to individuals.
- **Design response:** Show the system context (India's grid factor fell 0.774 → 0.675 from FY 2013-14 to FY 2025-26). Include civic and collective actions (RWA rooftop solar, green tariff) and avoid guilt framing.

### G5. Equity and cultural sensitivity — 🟠 High
Never target essential consumption of low-income users. Never moralize religious or regional diets; a rice→roti swap is a regional identity issue, not just a number. Use opt-in cohorts only, with no public leaderboards.

### G7. Blockchain as a mandatory add-on — 🟡 Medium
The hackathon requires blockchain. Done badly, through carbon tokens, on-chain personal data, or "earn crypto for saving carbon", it brings greenwashing optics (the 2021–22 tokenized-offset episode, after which Verra banned tokenizing retired credits), DPDP erasure conflicts, and judge scepticism.
- **Design response:** [blockchain.md](blockchain.md). The chain only anchors **salted Merkle roots** of monthly statements and **factor-set hashes**: no personal data, no tokens, no user wallets, one transaction per batch. Erasure works by deleting salts (crypto-shredding).
- **Residual:** A sceptical judge may still ask "why not a database?". The answer is third-party verifiability without trusting the operator. It is only truly valuable once employers or housing societies consume the statements, so say that honestly.

### G6. Health adjacency — 🟢 Low
Heat guidance must not read as medical advice. Link to official heat-action-plan advisories instead.

---

## H. Riskiest assumptions → experiments → kill criteria

| # | Assumption | Experiment | Pass threshold |
|---|---|---|---|
| H1 | Users will enter ≥ 2 bills | 30–50 household pilot | ≥ 60% within 14 days |
| H2 | Bill calibration is accurate enough | 10–20 ACs with smart plugs for 30 days, compared with calibrated k | Median absolute error ≤ 25% |
| H3 | Weekly check-ins persist | Pilot | ≥ 40% completion at week 8 |
| H4 | Commitments produce real reductions | Committers vs matched non-committers, weather-normalized cooling kWh | ≥ 5% reduction, CI excluding 0 |
| H5 | ₹ framing beats kg framing | A/B test on notification copy | ≥ +20% action adoption |
| H6 | Users understand ranges and tiers | 5-user usability test | ≥ 4 of 5 explain correctly |
| H7 | The refrigerant insight changes behaviour | Track "asked for leak test" self-reports plus refill frequency over 12 months | Fewer refills vs prior history |

**Kill / pivot rules:**

- **D30 retention < 15% and bill coverage < 40%** → stop B2C. Pivot to B2B2C (discom, RWA, or campus dashboards) where data arrives without user effort.
- **Calibration error > 40% (H2 fails)** → reposition as a smart-plug companion app. Label-based numbers alone are not good enough.
- **H4 fails** (no verified reduction) → the product is a calculator, not a reduction platform. Narrow it to the refrigerant and AC-servicing niche, which has the clearest single action.

---

## I. Open questions

1. Should the T&D loss line count toward the household's target? (Default: no; shown separately.)
2. Should refrigerant events be amortized over the refill interval or booked in the month they happen? (Default: booked in the month, shown in a separate "one-off" band.)
3. What is the right default reduction target? 10% over 6 months is arbitrary, and a pilot should tune it.
4. Should the default flight display include radiative forcing? (Default: show both; headline with RF, labelled.)
5. How should rented flats with landlord-controlled meters or sub-meters be handled?
6. Which discom is the first partnership target, and what data format can it share?

---

## References

- CEA CO₂ Baseline Database User Guide **v22.0 (Aug 2026)**: https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf · v21.0: https://cea.nic.in/wp-content/uploads/baseline/2025/12/User_Guide_V_21.0.pdf
- Prayas (Energy Group), AC use in 5 Indian cities: https://energy.prayaspune.org/images/pdf/conditioning-behaviour-insights-on-use-of-acs-in-5-indian-cities.pdf
- Khosla et al. 2021 (Delhi, n = 2,092), via Carbon Brief: https://www.carbonbrief.org/guest-post-how-energy-demand-for-cooling-in-indias-cities-is-changing
- iFOREST 2025 AC emissions: https://www.dtnext.in/news/national/indias-emissions-from-acs-equal-to-that-of-cars-now-set-to-double-by-2035-report-846670
- Vetter et al. 2017, Indian diets: https://pmc.ncbi.nlm.nih.gov/articles/PMC5268357 · Poore & Nemecek 2018 via OWID: https://ourworldindata.org/grapher/ghg-per-kg-poore
- India GHG Program road transport factors (2015): https://indiaghgp.org/sites/default/files/Road%20Transport%20Technical%20Paper.pdf
- DEFRA 2025 domestic flight factor, via Climatiq: https://www.climatiq.io/data/emission-factor/b5102b68-83c2-451c-8c77-d196cd5b4b68
- Hot or Cool Institute, 1.5-degree lifestyles: https://onepointfivelifestyles.eu/news/new-research-from-the-hot-or-cool-institute-analyses-lifestyle-carbon-footprints-from-nine-g20
- Allcott & Rogers 2014: https://www.nber.org/papers/18492 · WRI Bangalore HER: https://www.wri.org/research/shifting-household-energy-use-bangalore-india-using-behaviorally-informed-energy-reports
- Padgett et al. 2008, comparison of carbon calculators: https://serc.carleton.edu/54861
- Behavioural rebound (lab): https://watersensitivecities.org.au/content/a-behavioural-rebound-effect-results-from-a-laboratory-experiment/
- Lahti CitiCAP results: https://www.lahti.fi/en/news/personal-carbon-trading-scheme-made-lahti-people-question-their-mobility-choices-and-reduce-their-emissions/
- Norfolk Island NICHE trial (218 households, −18.1%): https://www.atlantis-press.com/article/24092.pdf
- Meri LiFE: https://www.unicef.org/digitalimpact/meri-life · CarbonWatch: https://www.verdict.co.uk/carbonwatch-launches-mobile-app-to-calculate-individuals-carbon-footprint/
- Doconomy DO Black: https://politifact.com/factchecks/2023/mar/31/facebook-posts/no-credit-card-measuring-peoples-carbon-footprint/
- Earth Hero / Klima (Boston Globe 2025): https://www.bostonglobe.com/2025/09/09/science/climate-tracking-apps-measure-carbon-footprint/
- Verra offsets investigation (2023): https://www.carbonbrief.org/cropped-25-january-2023-carbon-offsets-controversy-trade-wars-methane-round-up
- BP and the carbon footprint: https://grist.org/energy/footprint-fantasy/
- CCPA greenwashing guidelines 2024: https://admin.mondaq.com/india/environmental-law/1564230/guidelines-for-prevention-and-regulation-of-greenwashing-or-misleading-environmental-claims-2024
- DPDP Rules timeline: https://www.deccanherald.com/india/centre-notifies-dpdp-rules-implementation-planned-in-phases-spread-over-12-18-months-3798465
- Smart meters (RDSS): https://solarquarter.com/2026/02/03/india-installs-over-5-28-crore-smart-meters-under-rdss-to-boost-power-sector-efficiency/
- Account Aggregator FY25: https://www.business-standard.com/finance/news/nbfcs-lead-account-aggregator-consents-in-fy25-with-60-share-125100600872_1.html
- AT&C losses FY25: https://www.tndindia.com/overall-atc-losses-of-distribution-utilities-improve-to-15-04-per-cent-in-fy25/
- Open-Meteo pricing: https://open-meteo.com/en/pricing
