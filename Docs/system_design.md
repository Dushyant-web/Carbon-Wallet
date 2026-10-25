# Carbon Wallet — System Design

> A personal, household-level carbon accounting and reduction platform for urban India.
> It turns everyday activities into **source-tagged, ranged kg CO₂e**, compares them against
> the household's **own weather-normalized baseline**, finds the biggest drivers, and gives a
> **computed, verifiable reduction plan** in both kg and ₹.

| | |
|---|---|
| Status | Design v1.0 (pre-implementation) |
| Date | 2026-10-08 |
| Stack | FastAPI (Python) · PostgreSQL · React + TypeScript |
| Companion docs | [architecture.md](architecture.md) · [workflow.md](workflow.md) · [flaws.md](flaws.md) · [blockchain.md](blockchain.md) |

---

## 1. What changed from the original idea

| Original idea | Refined idea (previous draft) | This design |
|---|---|---|
| "AC ON → +10 points" | 1 point = 1 kg CO₂e | **No points.** Kg CO₂e with a range and a data-quality tier. Points reward logging, not reducing |
| Fixed 100 kg/month budget | Baseline + glide path | Baseline is **weather-normalized** (cooling degree days), so a cool month doesn't count as improvement |
| AC = tonnage × hours | AC = BEE label kWh ÷ 1,600 h | AC power **calibrated from the household's own bills**. Field data shows ~2.6× the label figure (§5.3) |
| — | — | **Refrigerant leakage** tracked as its own activity. In India it is about a third of all AC emissions (§5.4) |
| Grid factor 0.727 | 0.727 (FY 2023-24) | **0.675 (FY 2025-26, CEA v22, Aug 2026)**, versioned per fiscal year |
| Individual user | Individual user | **Household** is the accounting unit, with a per-capita view. Electricity bills are household-level |
| "Veg vs non-veg meal" | Same | Food is computed **by ingredient**, using India-specific factors where they exist. Rice and dairy dominate Indian vegetarian diets |
| Recovery: "18 h less AC" | Same | Every equivalent is computed from **this household's** calibrated kW. A generic "1 hour of AC" ranges from 0.4 to 1.3 kWh |
| Carbon only | Carbon only | Shows **₹ alongside kg**. Bill savings motivate more than carbon does |

---

## 2. Design principles

1. **Deterministic math, explainable output.** Emissions come only from formulas and a versioned factor table. An LLM may paraphrase results but never produces a number.
2. **Every number carries provenance.** Each value has a central value, a low–high range, a data tier (Measured / Bill-calibrated / Declared / Default), the factor version, and a source citation.
3. **Household first.** Bills, ACs, LPG and cars belong to households. Users belong to households. Per-capita figures are derived by dividing the household total.
4. **Self-referenced, not moralized.** Users are compared to their own past, adjusted for weather, and not to strangers with different incomes or climates. Cooling during heatwaves is tagged *essential*.
5. **Reductions ≠ offsets.** Offsets never reduce the wallet total. If they are ever added, they appear on a separate line.
6. **Inventory math ≠ intervention math.** The footprint uses the grid *average* factor. Savings use the same factor by default, and a *marginal* view is shown only as a labelled alternative (§5.1).
7. **Same scope, same benchmark.** The app never compares a partial-scope personal total with a whole-economy per-capita number.
8. **Verifiable without trusting us.** Closed monthly statements and factor-set versions are anchored on a public chain as salted Merkle roots, never as personal data ([blockchain.md](blockchain.md)).
9. **Minimal data.** City, not address. Bill kWh and ₹, not consumer number. No bank data in the MVP.

---

## 3. Scope and boundaries

### 3.1 Domains

| Domain | MVP | Method | GHG-Protocol analogue* |
|---|:---:|---|---|
| Grid electricity (whole home) | ✅ | Bill kWh × grid factor | Scope 2 (location-based) |
| └ AC (sub-meter of electricity) | ✅ | Calibrated kW × hours | Scope 2 (part of the bill, not added on top) |
| └ T&D losses | ✅ (shown separately) | kWh × EF × L/(1−L) | Scope 3 Cat. 3 |
| AC refrigerant leakage | ✅ | kg refrigerant × GWP | Scope 1 (fugitive) |
| Cooking fuel (LPG) | ✅ | Cylinders × 14.2 kg × EF | Scope 1 |
| Personal vehicles (petrol/diesel/CNG) | ✅ | km × g/km | Scope 1 |
| Public transport, cabs, autos | ✅ | passenger-km × g/pkm | Scope 3 |
| Food | ✅ (coarse, weekly) | servings × kg/serving × EF | Scope 3 |
| Flights | One-off calculator | great-circle km × factor (± RF) | Scope 3 |
| Shopping / services / spend-based | ❌ (v3) | — | Scope 3 |
| Rooftop solar / green tariff | v1.1 | Market-based line beside the location-based line | Scope 2 (market-based) |

\*Scopes are defined for organizations. They appear here only to keep categories clean and avoid double counting, not as compliance claims.

### 3.2 Explicit non-goals

- Not a carbon-credit, offset, or trading product. The word "wallet" is used for accounting only, and the UI says so (see the CCTS and greenwashing notes in [flaws.md](flaws.md)).
- Not an exact meter. All figures are estimates with ranges.
- Not a judgment tool. There are no leaderboards that shame high emitters. Cohort comparison is opt-in and arrives in v2.

---

## 4. Emission-factor registry (seed set `IN-2026.1`)

All factors live in the database (`emission_factors`) with `valid_from/valid_to`, `region`, `low/central/high`, `unit`, `source`, and `method_notes`. Each month's emissions use the factor that was valid *in that period*. FY 2023-24 months use 0.727, and FY 2025-26 months use 0.675.

### 4.1 Electricity

| Key | Central | Range | Unit | Source / notes |
|---|---:|---|---|---|
| `grid.in.avg` FY 2025-26 | **0.675** | 0.64–0.71 | kg CO₂/kWh | CEA CO₂ Baseline Database **v22.0 (Aug 2026)**, weighted average incl. RE + captive injection. Range covers provisional captive data and year-to-year drift (0.675–0.727 over the last 3 FYs) |
| `grid.in.avg` FY 2024-25 | 0.710 | — | kg CO₂/kWh | CEA v21.0 / v22 Annexure I |
| `grid.in.avg` FY 2023-24 | 0.727 | — | kg CO₂/kWh | CEA v20.0 / v22 Annexure I |
| `grid.in.om` FY 2025-26 | 0.963 | — | kg CO₂/kWh | CEA v22 simple operating margin. **Marginal view only** |
| `grid.in.cm` FY 2025-26 | 0.705 | — | kg CO₂/kWh | CEA v22 combined margin (50:50 OM:BM). Not used by default |
| `grid.td_loss.in` | 0.15 | 0.08–0.20 | fraction | National AT&C loss 15.04% (FY 2024-25, MoP 14th Integrated Rating). Delhi 8.36%. Per-state override |

> **Basis check (resolved):** CEA factors are computed on **net generation injected into the grid**
> (CEA v22 §5). They are *not* grossed up for distribution losses. The design therefore reports
> `kWh × EF` as Scope 2 and shows `kWh × EF × L/(1−L)` as a separate T&D line, following GHG
> Protocol treatment of losses as upstream (Scope 3 Cat. 3). This avoids silent double counting.

### 4.2 Cooling

| Key | Central | Range | Unit | Source / notes |
|---|---:|---|---|---|
| `ac.kw.label` | label kWh/yr ÷ 1,600 | — | kW | BEE label convention: annual kWh at **1,600 h** of operation. User types the number from the sticker. **BEE revised the star bands from Jan 2026**, so stickers from different years aren't directly comparable |
| `ac.kw.default.1_5t` | 1.00 | 0.45–1.40 | kW | Low end: 5★ inverter label-derived (~700 kWh ÷ 1,600 h ≈ 0.44 kW). High end: field stock average from Prayas 5-city survey (1,250 kWh ÷ 1,077 h ≈ **1.16 kW**). Replaced by calibration as soon as bills exist |
| `ac.setpoint.saving_per_c` | 0.06 | 0.03–0.07 | fraction/°C | BEE/MoP claim (~6% per °C). 24 °C has been the default since the 2020 BEE mandate. Treat as a claim and verify on the next bill |
| `ac.hours.delhi.peak` | 5.4 | 3–6 | h/day | Khosla et al., *ERL* 2021, n = 2,092 Delhi households |
| `refrigerant.gwp.R32` | 771 | 677–771 | kg CO₂e/kg | IPCC AR6 GWP100 (AR5 = 677). The GWP set version is stored |
| `refrigerant.gwp.R410A` | 2,256 | 1,924–2,256 | kg CO₂e/kg | AR6 (AR5 = 1,924) |
| `refrigerant.gwp.R22` | 1,960 | 1,760–1,960 | kg CO₂e/kg | AR6 (AR5 = 1,760) |
| `refrigerant.charge.1_5t` | 1.0 | 0.7–1.4 | kg | **Derived assumption.** Prefer the outdoor-unit nameplate value |

### 4.3 Transport

India GHG Program (2015) road-transport factors, **including the program's 10% real-world uplift**. These are tank-to-wheel CO₂ only, and many vehicles in the table are pre-BS-VI. See [flaws.md](flaws.md) §B7.

| Key | Central | Range | Unit |
|---|---:|---|---|
| `veh.2w.scooter.lt110` | 0.0368 | −10% / +25% | kg CO₂/vkm |
| `veh.2w.moto.lt125` | 0.0319 | −10% / +25% | kg CO₂/vkm |
| `veh.2w.moto.lt200` | 0.0458 | −10% / +25% | kg CO₂/vkm |
| `veh.car.petrol.hatch.lt1000` | 0.127 | −10% / +25% | kg CO₂/vkm |
| `veh.car.petrol.hatch.lt1400` | 0.140 | −10% / +25% | kg CO₂/vkm |
| `veh.car.petrol.sedan.lt1600` | 0.153 | −10% / +25% | kg CO₂/vkm |
| `veh.car.diesel.suv.lt2500` | 0.210 | −10% / +25% | kg CO₂/vkm |
| `veh.car.cng.small` | 0.068 | −10% / +25% | kg CO₂/vkm |
| `veh.3w.cng` | 0.1077 | ±20% | kg CO₂/vkm (÷ occupancy) |
| `pt.bus.intracity` | 0.0152 | ±30% | kg CO₂/pkm |
| `pt.metro.delhi` | 0.025 | 0.020–0.030 | kg CO₂/pkm. **Unverified**: TERI 2019-20 via secondary sources. The primary PDF is offline. TERI's public headline is "32.38 g CO₂ saved per pkm vs road average" |
| `pt.cab.deadhead` | 0.30 | 0.15–0.45 | fraction of empty km (**assumption**) |
| `air.domestic.no_rf` | 0.1355 | — | kg CO₂e/pkm (DEFRA 2025) |
| `air.domestic.rf` | 0.2293 | — | kg CO₂e/pkm (DEFRA 2025, with radiative forcing) |

The asymmetric +25% high bound on road vehicles reflects urban congestion, where real-world emissions exceed test-cycle values.

### 4.4 Food and cooking

| Key | Central | Unit | Source |
|---|---:|---|---|
| `food.rice.in` | 5.65 | kg CO₂e/kg | Vetter et al. 2017 (India, Cool Farm Tool). Paddy methane makes rice higher in India than the global mean (4.45) |
| `food.milk.in` | 2.4 | kg CO₂e/kg | Vetter et al. 2017 |
| `food.mutton.in` | 45.54 | kg CO₂e/kg | Vetter et al. 2017 |
| `food.wheat` | 1.57 | kg CO₂e/kg | Poore & Nemecek 2018 (global mean, via OWID) |
| `food.pulses` | 1.79 | kg CO₂e/kg | Poore & Nemecek 2018 ("other pulses") |
| `food.poultry` | 9.87 | kg CO₂e/kg | Poore & Nemecek 2018 |
| `food.eggs` | 4.67 | kg CO₂e/kg | Poore & Nemecek 2018 |
| `food.paneer` | ~13 (10–16) | kg CO₂e/kg | **Derived**: ~5.5 L milk/kg × 2.4. Ignores whey co-product allocation |
| `fuel.lpg` | 2.985 | kg CO₂/kg | IPCC 2006: 63.1 kg/GJ × NCV 47.3 MJ/kg. One 14.2-kg cylinder ≈ **42.4 kg** |

Per-serving defaults (editable): rice 75 g dry ≈ 0.42 kg · 2 rotis (60 g flour) ≈ 0.09 kg · dal 40 g dry ≈ 0.07 kg · milk 250 ml ≈ 0.60 kg · paneer 100 g ≈ 1.3 kg · chicken 100 g ≈ 1.0 kg · mutton 100 g ≈ 4.6 kg · 2 eggs ≈ 0.47 kg.

> Insight to surface in the UI: **a paneer-heavy vegetarian meal can exceed a chicken meal.** "Veg vs non-veg" is the wrong axis.

---

## 5. Calculation engine

A pure Python package (`engine/`) with no I/O. Inputs are activities, asset profiles, factors, and weather. Outputs are `EmissionLine`s. Every line records `calc_version`, the factor IDs used, and the inputs, so it can be reproduced exactly later.

### 5.1 Electricity

```
scope2_kg   = kWh × EF_avg(period)
td_loss_kg  = kWh × EF_avg(period) × L/(1−L)          # shown separately
marginal_kg = kWh × EF_om(period)                     # only in "marginal view" toggle
```

- **Bill period ≠ calendar month.** Prorate by day. Several discoms (e.g., Tamil Nadu, Kerala) bill bi-monthly. Bills flagged *estimated reading* get a wider range.
- **Rooftop solar (v1.1).** The bill shows net import. If the user declares solar generation, `consumption = import + self-consumed`, and the solar share has zero Scope 2.
- **Green tariff (v1.1).** Shown as a separate *market-based* line. The location-based line is never zeroed. This mirrors GHG Protocol dual reporting; the Scope 2 revision under consultation since Oct 2025 keeps both methods.
- **EV home charging.** The kWh is already in the bill, so it is *moved* from "residual home" to "transport". It is never added twice.

### 5.2 Uncertainty propagation

Factors and inputs carry relative uncertainty `u_i`, derived from their low/high bounds as a log-normal with the bounds treated as the 5th–95th percentiles.

- **Products** (kW × h × EF): combine in log space with `u = √Σu_i²`.
- **Sums** across categories: add variances in absolute kg.
- **Displayed range:** 90% interval, e.g. **"162 kg (≈ 140–190)"**.
- **Upgrade path:** if ranges must reflect correlated assumptions, switch to a 1,000-sample Monte Carlo at month close. That is cheap at this scale.

### 5.3 AC model and bill calibration (core differentiator)

The effective power `k` (kW) of each AC is resolved in this order of priority:

| Tier | Source of `k` | Shown as |
|---|---|---|
| Measured | Smart plug / CT clamp (v2) | "Measured" |
| Bill-calibrated | Regression over the household's bills | "Bill-calibrated" |
| Declared | Label kWh/yr ÷ 1,600 from the sticker | "Declared" |
| Default | 1.0 kW (0.45–1.40) for a 1.5 T unit | "Estimate" |

**Why calibration matters:** the 5★ inverter label implies ~0.44 kW. The Prayas field survey of 1,500 AC-owning households measured a stock average of 1,250 kWh over 1,077 h, which is **~1.16 kW**. That is a 2.6× gap. Pure label models systematically under-count AC.

**Calibration algorithm (per household, recomputed on each new bill):**

```
For each bill m:  kWh_m = b · days_m + k · H_m + ε_m
   b   = baseload kWh/day (fridge, fans, lights, geyser…)
   H_m = Σ_units hours_unit,m × tonnage_weight_unit
         (declared routine, scaled by the month's cooling-degree-day index when not logged)

≥ 2 bills with different AC hours (e.g., Jan and May) → least squares, constraints b ≥ 0, 0.3 ≤ k ≤ 2.5
1 bill only → b from the appliance inventory (fridge label kWh/365 + fans + lights); k = (kWh − b·days)/H, clamped
No bill     → k from the label or the default tier
```

**Worked example (the "Sharma household", Delhi, 4 people, one 1.5 T 3★ split AC):**

| | Jan bill | May bill |
|---|---:|---:|
| kWh (31 days) | 180 | 420 |
| AC hours | 0 | 6 h/day → 186 h |
| → baseload `b` | 5.8 kWh/day | — |
| → AC kWh | — | 420 − 5.8×31 = **240 kWh** |
| → calibrated `k` | — | 240 ÷ 186 = **1.29 kW** |
| → May AC emissions | — | 240 × 0.675 = **162 kg CO₂e** (57% of the 283 kg electricity total) |

Known weakness: `hours × kW` cannot be identified separately from bills alone. If the declared hours are wrong, `k` absorbs the error. Ranges stay wide until a smart plug or a second season of bills is available ([flaws.md](flaws.md) §B2).

### 5.4 Refrigerant leakage (new)

```
refrigerant_kg_CO2e = kg_refrigerant_added × GWP(refrigerant_type)
   default kg added = nameplate charge (assumes full loss), range 0.5–1.0 × charge
```

The activity is an **"AC gas refill / service" event**, logged in one tap from the asset page.

Why it matters: iFOREST (Sept 2025) estimates Indian ACs emitted 156 Mt CO₂e in 2024, roughly equal to all passenger cars. **52 Mt of that came from refrigerant leaks.** 40% of surveyed ACs were refilled annually; good practice is about once every 5 years.

**One 1 kg R-32 top-up ≈ 771 kg CO₂e ≈ 4.8 months of the Sharma household's peak-season AC electricity.** The resulting action, "leak-test and repair instead of top-up", is one of the highest-impact, lowest-effort recommendations in the catalog.

### 5.5 Transport

```
private vehicle:  km × EF_vehicle ÷ occupants_counted
                  (household attribution: all km go to the household; per-capita splits evenly)
public transport: pkm × EF_mode
cab/ride-hail:    km × EF_car × (1 + deadhead) ÷ passengers
auto (shared):    km × EF_3w ÷ passengers
flight:           GC_km × EF_air (show no-RF and with-RF; default display: with-RF, labelled)
                  DEL–BOM: 1,137 km → ~154 kg (no RF) / ~261 kg (with RF) per passenger
```

### 5.6 Food and cooking

```
food:    Σ servings × kg_per_serving × EF_item          (weekly check-in, pattern-based)
LPG:     cylinders × 14.2 × 2.985                       (household; refill date logged)
```

### 5.7 Worked reference table (0.675 kg/kWh, 30-day month)

| Activity | Assumption | kg CO₂e / month |
|---|---|---:|
| AC 1.5 T 5★ inverter, 5 h/day | label-derived 0.44 kW | ~44 |
| AC 1.5 T 3★, 5 h/day | label-derived 0.69 kW | ~70 |
| Same AC, field-average draw | 1.16 kW | ~117 |
| Petrol hatchback (<1,400 cc), solo, 15 km/day | 0.140 kg/km | ~63 |
| Motorcycle (<125 cc), 20 km/day | 0.0319 kg/km | ~19 |
| Bus, 20 km/day | 0.0152 kg/pkm | ~9 |
| Metro, 20 km/day | 0.020–0.030 kg/pkm | ~12–18 |
| LPG, 1 cylinder | 14.2 kg × 2.985 | ~42 |
| 1 kg R-32 refrigerant top-up (one-off) | GWP 771 | **~771** |
| Delhi–Mumbai one-way flight (one-off) | 1,137 km | ~154 / ~261 (RF) |

---

## 6. Budget system

Users get a **target trajectory** built from their own history, not a moral "limit".

### 6.1 Baseline

```
seasonal_index[city][month] = CDD_normal[month] / mean(CDD_normal)    # climate normals per city
baseline_month = (if same month last year exists) that month, weather-adjusted
                 else mean(last 3 complete months, each de-seasonalized) × seasonal_index[month]
cold start      = asset-based estimate (AC routine, vehicles, LPG, diet) → tier "Estimate"
```

Cooling degree days (CDD) use a base temperature of 24 °C, configurable per city and aligned with the BEE default setpoint.

### 6.2 Target and glide path

```
target_month = baseline_month × (1 − r × min(1, months_elapsed / glide_months))
default r = 10%, glide = 6 months (user-adjustable 0–30%)
heat_allowance = extra AC kWh on IMD heat-alert days × EF  → tagged "essential", excluded from overage
```

### 6.3 Forecast-based alerts (instead of "70% used")

A "% used" figure on day 20 says nothing without pacing, so alerts are driven by an end-of-month forecast:

```
forecast = MTD + Σ_remaining_days [ w · recent_daily + (1−w) · baseline_daily × weather_adj ]
w = days_logged / (days_logged + 7)          # shrink toward baseline early in the month
```

| State | Rule | Message tone |
|---|---|---|
| On track | forecast ≤ 90% of target | "On track — ~X kg under." |
| Watch | 90–110% | "Close to target. Biggest lever this week: …" |
| Likely over | > 110% | "At this pace ≈ 449 kg vs 420 kg target. Here's a 3-step plan to close ~29 kg." |

**Never show "remaining budget" as spendable allowance.** "You have 13.6 kg left" invites moral licensing ("I can drive today"). The UI shows *trajectory vs target* instead ([flaws.md](flaws.md) §C3).

---

## 7. Carbon Leak Detector

### 7.1 Decomposition (LMDI)

For each category modelled as a product of drivers, e.g. AC: `E = CDD × (hours/CDD) × k × EF`, the change between two periods is split with the **Log-Mean Divisia Index** (Ang, 2004). This is a standard, residual-free index decomposition:

```
L(a,b) = (a − b) / (ln a − ln b)          (L(a,a) = a)
ΔE_driver = L(E1, E0) × ln(driver1 / driver0)        Σ ΔE_driver = E1 − E0 exactly
```

**Example (Sharma household, Apr → May):** AC hours 3.2 → 5.1 h/day (+59%), CDD 150 → 210, k = 1.29 kW:

| Driver | Δ kg CO₂e |
|---|---:|
| Hotter weather (CDD +40%) | +36.5 |
| Behaviour (more hours per degree-day) | **+17.6** |
| Equipment efficiency (k) | 0 |
| Grid factor | 0 |
| **Total** | **+54.1** |

Message: *"AC emissions rose 54 kg. About two-thirds is the heat. **17.6 kg is extra usage beyond what the weather explains.** That's your controllable leak."* This avoids blaming users for weather.

### 7.2 Other detectors

| Detector | Rule (MVP) | Example output |
|---|---|---|
| Concentration | One sub-activity > 30% of its category | "Weekend car trips = 31% of transport emissions." |
| Anomaly | Weather-normalized category > baseline + max(3 kg, 10%) | "Residual home use up 22% with no AC change. Check the geyser or fridge." |
| Refrigerant | > 1 refill in 24 months | "2 gas top-ups in 18 months ≈ 1.5 t CO₂e. Likely a leak. Ask for a leak test." |
| Data gap | No transport check-in for 14 days | "We're estimating transport from your routine. Confirm in 30 s?" |

Materiality filter: insights below `max(3 kg, 10% of category)` are suppressed to avoid noise.

---

## 8. What-if simulator

A scenario is a **patch on the household profile**, run through the *same* engine:

```json
{ "patches": [
  { "asset": "ac_1", "field": "setpoint_c", "from": 22, "to": 25 },
  { "asset": "ac_1", "field": "hours_per_day", "delta": -2 },
  { "routine": "commute_car", "field": "days_per_week", "delta": -2, "replace_with": "metro" }
]}
```

Output: monthly and annual Δ kg (with range), Δ kWh, Δ ₹ (at the household's marginal tariff slab), and a "weather-typical year" projection.

| Scenario (Sharma household) | Δ per month (May) | Δ per season (Apr–Sep) |
|---|---:|---:|
| Setpoint 22 → 25 °C (~18%) | −43 kWh · −29 kg | — |
| AC 2 h/day less | −80 kWh · −54 kg · ≈ −₹560* | −472 kWh · **−319 kg** |
| Car → metro 2 days/week (10 km each way) | −20 kg | — |

\*At an assumed ₹7/kWh marginal slab. The real value comes from the household's discom tariff. Slab cliffs, such as subsidy thresholds, can make ₹ savings non-linear.

---

## 9. Action engine and recovery plan

### 9.1 Action template

```yaml
key: ac_setpoint_plus_2
category: cooling
scenario_patch: { asset_kind: ac, field: setpoint_c, delta: +2 }
applicability: { requires_asset: ac, season: [Mar..Oct], setpoint_c_lt: 26 }
effort: 1            # 1 = trivial … 5 = major
upfront_cost_inr: 0
evidence: "BEE/MoP ~6%/°C claim; verify on next bill"
verification: bill   # bill | device | declared
```

### 9.2 Ranking

```
priority = E[kg saved/month] × p_adopt(effort, past behaviour) / effort
         × essential_penalty (0.3 if it would cut cooling on heat-alert days)
```

The expected savings come from the simulator, so savings are always consistent with the footprint math.

### 9.3 Recovery plan

When the forecast exceeds the target, the gap is covered with a greedy knapsack over applicable actions, ordered by kg/effort, stopping once the cumulative saving reaches the gap. The plan shows at most 3 actions.

> *"Likely over by ~29 kg with 11 days left. Close it with: ① AC 2 h less/day (−19 kg) ② 25 °C instead of 22 °C for the hours it runs (−7 kg) ③ two metro days instead of the car (−5 kg)."*
> (11 × 2 h × 1.29 kW × 0.675 = 19.2; 11 × 4 h × 1.29 × 18% × 0.675 = 6.9; 2 × 20 km × 0.115 = 4.6)

### 9.4 Commitment → verification loop

```
commit(action, period) → expected_kg (range)
end of period → realized_kg =
    bill-verified:  weather-normalized Δ of the relevant category vs counterfactual baseline
    declared:       expected_kg × 0.5 credit (self-report discount)
```

---

## 10. Carbon Health Score (0–100)

| Component | Weight | Definition |
|---|---:|---|
| Target adherence | 30% | 100 if month ≤ target; falls linearly to 0 at 130% of target. Heat allowance excluded |
| Improvement | 30% | `clip(50 + 250 × (baseline_norm − actual)/baseline_norm, 0, 100)`. A 20% weather-normalized cut gives 100, flat gives 50, a 20% rise gives 0 |
| Follow-through | 25% | realized_kg ÷ committed_kg (bill-verified at full weight, declared at half) |
| Data quality | 15% | Emission-weighted tier mix: Measured 1.0, Bill-calibrated 0.8, Declared 0.5, Default 0.2 |

**Anti-gaming gates:**

- No score is shown if fewer than 50% of emissions are Declared or better, or if no bill exists in the last 60 days. The UI shows "Not enough data" instead of a misleadingly good number.
- Improvement uses **weather-normalized** values, so a cool month doesn't count as progress.
- Logging *less* never raises the score. Gaps are filled from the routine estimate, not zero.

**Example (Sharma, May):** adherence 77.8 · improvement 61.7 · follow-through 66.7 · data quality 66.2 → **68 / 100**.

---

## 11. Feedback cadence and messaging

- **Weekly 60-second check-in** (transport days by mode, food pattern, AC hours slider). Evidence: home-energy-report effects decay 10–20% per year after reports stop, and households that kept receiving them saved 50–60% more (Allcott & Rogers, *AER* 2014).
- **Monthly report** at month close: wallet, decomposition, top 3 actions, score.
- **Lead with ₹, follow with kg:** "₹560 and 54 kg less this month".
- High emitters get the most targeted feedback. Opower effects were 6.3% in the top decile vs 0.3% in the bottom (Allcott 2011).
- Copy rules: "reduce", never "bad". Never moralize LPG cooking, medical cooling, or heatwave cooling.

---

## 12. LLM coach (optional, off the critical path)

- Input: a JSON payload of already-computed results. Output: plain-language explanation in English or Hindi.
- **Guardrail:** every number in the LLM output must match a number in the payload, checked with a regex extraction diff. On mismatch, fall back to templated copy.
- No user PII in prompts beyond city and household size. Provider sits behind an adapter interface.

---

## 13. Privacy and compliance by design

| Data | Collected? | Notes |
|---|---|---|
| Email, display name | Yes | Login |
| City, state, discom | Yes | Weather, grid factor, tariff. **No street address** |
| Household size | Yes (count) | Non-user members stored as a count only, which avoids minors' data |
| Bills | kWh, ₹, period | **Not** the consumer/CA number. If OCR'd, the image is discarded after extraction |
| Location / GPS | No | Transport comes from check-ins, not tracking |
| Bank / UPI | No (MVP) | Account Aggregator requires a regulated FIU, and a CSV import would be processed client-side only (v3) |

DPDP Act 2023 and Rules (notified 13–14 Nov 2025): the core obligations (notice, security safeguards, breach reporting, erasure, data-principal rights) apply from **13 May 2027**. Build for them now: purpose-specific consent records, export, hard delete within 30 days, breach runbook.

---

## 14. Non-functional requirements

| Area | Target |
|---|---|
| Correctness | Golden tests for every calculator. Factor-table validation (`low ≤ central ≤ high`, source URL present) |
| Reproducibility | Any past number can be recomputed from `(inputs, factor IDs, calc_version)` |
| Latency | Wallet API p95 < 300 ms (served from period snapshots); simulator p95 < 500 ms |
| Availability | 99.5% for MVP (single region) |
| Localization | English + Hindi; Indian number formatting (₹1,23,456) |
| Accessibility | WCAG 2.1 AA; charts have table fallbacks |
| Offline | PWA. Check-ins queue offline and sync with idempotency keys |

---

## 15. MVP scope and demo

**In:** household onboarding · electricity bills with AC calibration · refrigerant events · LPG · transport check-ins · coarse food check-ins · wallet with ranges and tiers · forecast and alerts · LMDI leak detector · what-if simulator · action plan and commitments · score · methodology page.

**Out (later):** smart plugs, bill OCR, hourly grid factors, cohorts, spend-based shopping, B2B dashboards.

**Demo (≈ 3 min):**

1. Onboard the Sharma household: Delhi, 4 people, 1.5 T 3★ AC, hatchback (45 s).
2. Enter Jan and May bills (180 and 420 kWh). The app calibrates the AC to 1.29 kW: *"AC is 57% of your electricity, 162 kg in May."*
3. Leak detector: *"+54 kg vs April. 36.5 kg is the heat, 17.6 kg is extra usage."*
4. What-if: 2 h less per day gives −54 kg and ≈ −₹560 this month, −319 kg this season.
5. Log an AC gas top-up. A refrigerant spike of 771 kg appears, along with the action "Ask for a leak test before the next refill."
6. Commit to 25 °C. Next month the bill verifies the result, and the score rises.

---

## 16. Roadmap

| Phase | Adds |
|---|---|
| v1.1 | Rooftop solar and green-tariff (market-based) lines · PNG cooking · bill photo OCR · Hindi |
| v2 | Smart plug / CT clamp integration (Measured tier) · hourly/regional grid intensity for load-shifting tips · opt-in cohorts ("similar homes in Delhi") |
| v3 | B2B2C: RWA/campus/employer dashboards (employee commuting = Scope 3 Cat. 7) · discom home-energy-report partnership · optional client-side bank-CSV parsing |

---

## 17. References

- CEA, *CO₂ Baseline Database for the Indian Power Sector*, User Guide **v22.0 (Aug 2026)**, Table S, Annexure I. https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf
- CEA User Guide v21.0 (Nov 2025). https://cea.nic.in/wp-content/uploads/baseline/2025/12/User_Guide_V_21.0.pdf
- India GHG Program, *India Specific Road Transport Emission Factors* v1.0 (2015). https://indiaghgp.org/sites/default/files/Road%20Transport%20Technical%20Paper.pdf
- Prayas (Energy Group), *Conditioning behaviour: insights on use of ACs in 5 Indian cities* (n = 1,500). https://energy.prayaspune.org/images/pdf/conditioning-behaviour-insights-on-use-of-acs-in-5-indian-cities.pdf
- Khosla et al. 2021, *Environmental Research Letters* (Delhi cooling survey, n = 2,092), summarized at https://www.carbonbrief.org/guest-post-how-energy-demand-for-cooling-in-indias-cities-is-changing
- iFOREST (Sept 2025) AC emissions report, via https://www.dtnext.in/news/national/indias-emissions-from-acs-equal-to-that-of-cars-now-set-to-double-by-2035-report-846670
- Vetter et al. 2017, *Agriculture, Ecosystems & Environment* (GHG of Indian diets). https://pmc.ncbi.nlm.nih.gov/articles/PMC5268357
- Poore & Nemecek 2018, via Our World in Data. https://ourworldindata.org/grapher/ghg-per-kg-poore
- DEFRA 2025 conversion factors (domestic flight), via https://www.climatiq.io/data/emission-factor/b5102b68-83c2-451c-8c77-d196cd5b4b68
- MoP 14th Integrated Rating (AT&C 15.04% FY25). https://www.tndindia.com/overall-atc-losses-of-distribution-utilities-improve-to-15-04-per-cent-in-fy25/
- BEE AC default 24 °C; ~6%/°C claim. https://www.business-standard.com/india-news/india-standardise-air-conditioner-temperature-20-28-degree-celsius-125061001221_1.html
- Allcott 2011, *J. Public Economics*; Allcott & Rogers 2014, *AER*. https://www.nber.org/papers/18492
- Ang, B.W. 2004/2005, LMDI decomposition (*Energy Policy*).
- GHG Protocol Scope 2 revision consultation (Oct 2025). https://ghgprotocol.org/blog/upcoming-scope-2-public-consultation-overview-revisions
- DPDP Rules 2025 timeline. https://www.deccanherald.com/india/centre-notifies-dpdp-rules-implementation-planned-in-phases-spread-over-12-18-months-3798465
