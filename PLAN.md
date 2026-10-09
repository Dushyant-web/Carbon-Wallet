# CarbonOS: understanding, cleanup, and build plan

## 1. The idea in one paragraph

CarbonOS is a multi-tenant carbon tracker where the tenant is the household. Everything flows one way:

```text
Activity → Emission factor → Emission event → Monthly total → Score / Forecast / Recommendations
```

If you build that pipeline properly, the dashboard, Carbon Twin, forecast, benchmarks and reports are all just different views of the same data. Switching households then changes everything automatically, which is the demo you want.

## 2. Problems in the spec to fix first

| Issue | Fix |
|---|---|
| Sharma's top contributors (AC 48 + car 42 + electricity 34 + flights 29 = 153 kg) don't match "Electricity = 45% of 286 = 128 kg". AC *is* electricity. | Contributors must be a drill-down of categories. AC and electricity should not be separate line items. |
| Sharma is "↓ 8.4% vs last month" but the forecast says next month goes *up* to 294 kg. | Compute the forecast from the real trend and seasonality. Never hardcode it. |
| The spec wants totals like 286 kg *and* "derived from underlying data". | Use a **calibrated seed generator**. It generates activities, then scales them so each household's current month lands on the target (286, 342, 148...). |
| "Carbon Score" has no formula. | Define it as a weighted formula and label it "CarbonOS Index (prototype metric)". |
| Mock API first, real DB later. | Skip the mock. Build a thin real backend. It's the same effort and removes a rewrite. |

## 3. What to remove or defer

Cut these from v1:
- **QR codes and email invitations.** Keep invite link and household code only.
- **Billing and "manage billing" for owners.** Keep a simple monthly carbon/₹ budget.
- **Quarterly and annual report variants.** Build one monthly report with a print/PDF view.
- **Separate tablet design.** Do mobile and desktop only.
- **100k-household optimisation.** Design for it (UUIDs, indexes, pagination, household-scoped queries) but don't build caching or sharding.
- **Separate "Household Directory" and "My Households" pages.** Merge them: a card view and a table view, with search, filter and sort.
- **Separate Emissions and Carbon Twin pages.** Carbon Twin is the hero; Emissions is its drill-down.
- **Separate Appliances and Vehicles pages.** Merge into one **Assets** page with tabs.
- **Separate Forecast and Budget pages.** Merge into one **Plan** page, since forecast, budget and savings belong together.
- **The 15-step switching checklist.** One rule covers it: all data comes from queries keyed by `householdId`, so switching just changes the key.

## 4. Features worth adding

1. **What-if simulator** in Carbon Twin: sliders like "AC −1 h/day" or "swap petrol car for EV" update the forecast live. This is your strongest demo feature.
2. **Versioned emission-factor registry.** Each factor has a value, unit, source, region and valid-from date. Use a state-level grid factor (Rajasthan with solar differs from Maharashtra).
3. **Recurring activities.** "AC 6 h daily, May–Sep" generates events automatically, so users don't log everything by hand.
4. **Quick-log and bulk import.** One-tap templates plus CSV import for electricity bills.
5. **Score explainer.** Show what raised or lowered the score, as "+4 from falling emissions, −3 from no solar".
6. **Data-quality badge.** Label figures as measured, estimated or default.
7. **Household goals.** For example "cut 15% by December", tracked against the forecast.
8. **Audit log.** Who added, edited or removed what. It makes role permissions visible in the demo.
9. **Solar offset handling.** Gupta's rooftop solar should visibly reduce net electricity emissions.
10. **Demo user switcher.** A dropdown to act as Owner, Admin, Member or Viewer on the same household, so you can show permissions working.

## 5. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js + TypeScript** | One repo with both API route handlers and UI |
| Database | **PostgreSQL** (Docker) | Matches the target architecture |
| ORM | **Prisma** | Typed models, migrations, seeding |
| Validation | **Zod** | Shared request and response schemas |
| Data fetching | **TanStack Query** | Query keys per household make switching and cache clearing automatic |
| UI state | **Zustand** | Holds only `activeHouseholdId` and UI flags |
| Styling | **Tailwind + shadcn/ui** | Fast, accessible components |
| Charts | **Recharts** | Enough for trend, donut and comparison |
| Auth | Demo auth (cookie session) with real role checks | Real auth can come later |
| Tests | **Vitest** | Emission engine and score formula |

## 6. Architecture

```text
UI (pages, components)
   ↓ hooks (useHousehold, useEmissions...)
API client (typed fetch)
   ↓
Route handlers (/api/...)   ← auth + role guard + Zod validation
   ↓
Services (business logic)   ← emission, score, forecast, recommendation, benchmark
   ↓
Repositories (Prisma)       ← every query requires householdId
   ↓
PostgreSQL
```

**Safety rule for data isolation:** repository functions take `householdId` as a required first argument, and the route guard checks membership before any service runs. A query that forgets the household shouldn't compile.

## 7. Project structure

```text
carbonos/
├── prisma/
│   ├── schema.prisma
│   └── seed/
│       ├── index.ts
│       ├── households.config.ts    # profiles + target totals only
│       └── generator.ts            # builds activities from a profile
│       └── calibrate.ts            # scales to hit target kg
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── overview/
│   │   │   ├── carbon-twin/
│   │   │   ├── emissions/
│   │   │   ├── activities/
│   │   │   ├── assets/
│   │   │   ├── members/
│   │   │   ├── actions/            # recommendations + challenges
│   │   │   ├── plan/               # forecast + budget
│   │   │   ├── reports/
│   │   │   ├── compare/
│   │   │   ├── households/         # cards/table + create flow
│   │   │   └── settings/
│   │   ├── join/[code]/
│   │   └── api/
│   │       └── households/[id]/(activities|emissions|members|assets|...)/route.ts
│   ├── server/
│   │   ├── services/               # emission, score, forecast, recommendation, benchmark, ...
│   │   ├── repositories/
│   │   ├── auth/                   # session + permissions.ts (role → capabilities)
│   │   └── factors/                # emission factor registry
│   ├── components/
│   │   ├── ui/                     # shadcn primitives
│   │   ├── layout/                 # Sidebar, TopBar, HouseholdSwitcher, BottomNav
│   │   ├── charts/                 # TrendChart, CategoryDonut, ComparisonBars
│   │   ├── household/ dashboard/ twin/ activities/ assets/
│   │   └── states/                 # Skeleton, Empty, ErrorState
│   ├── hooks/                      # useActiveHousehold, usePermissions, query hooks
│   ├── store/                      # activeHousehold, ui
│   ├── lib/                        # api client, formatters, constants
│   └── types/                      # shared Zod schemas + inferred types
└── tests/
```

Demo data lives only in `prisma/seed`. No UI file imports it.

## 8. Data model (PostgreSQL)

```text
users(id, name, email)
households(id, name, city, state, country, size, home_type, floor_area_m2,
           monthly_budget_inr, join_code, status, created_at)
memberships(id, household_id, user_id, role, status, joined_at)

emission_factors(id, category, type, unit, kg_co2e_per_unit, region, source, valid_from)
activities(id, household_id, member_id, category, type, quantity, unit,
           occurred_on, source, recurring_rule_id, created_at)
emission_events(id, household_id, activity_id, factor_id, kg_co2e, occurred_on)
recurring_rules(id, household_id, template, schedule, start, end)

appliances(id, household_id, type, rating, power_kw, avg_hours_per_day)
vehicles(id, household_id, type, fuel, km_per_unit, monthly_km)

monthly_summaries(household_id, month, total_kg, by_category jsonb, score)  -- cached rollup
recommendations(id, household_id, action, kg_saved, inr_saved, difficulty, status)
challenges(id, household_id, template, progress, kg_saved, inr_saved, streak)
goals(id, household_id, target_pct, deadline)
budgets(id, household_id, month, carbon_cap_kg, spend_cap_inr)
audit_log(id, household_id, user_id, action, entity, at)
```

Indexes: `(household_id, occurred_on)` on `activities` and `emission_events`, `(household_id, month)` on `monthly_summaries`, and unique `join_code`.

## 9. Core logic (where the quality is)

**Emission service.** `calculate(activity)` looks up the factor, multiplies, and writes the event in one transaction, then refreshes the month's summary. Examples: AC kWh × state grid factor; petrol litres × factor; flight km × class factor.

**Score formula** (weights are tunable, all normalised 0–100):
```text
35% per-person emissions vs. national reference
20% trend (last 3 months)
15% energy efficiency (appliance ratings)
10% transport efficiency
10% renewable share
10% completed actions
```
Bands: 0–39 Critical, 40–59 Poor, 60–74 Average, 75–89 Good, 90–100 Excellent.

**Benchmark service.** Find similar households by size band, city or state, home type and transport pattern. Normalise to per-person, then report median, percentile and difference. Include a "How is this calculated?" modal that lists the filters used and the number of households compared.

**Recommendation service.** Rule templates run against the household's own breakdown. Rank by `impact × relevance ÷ (cost × difficulty)`. Every recommendation returns kg, ₹ and difficulty.

**Forecast service.** Use the last 6–12 months with a simple seasonal trend (a linear fit plus month-of-year factors). The "with actions" scenario subtracts accepted recommendations.

**Permissions.** One `permissions.ts` maps role to capabilities such as `activity.create`, `member.invite` and `household.archive`. The API guard and the UI hook `usePermissions()` both read it, so hidden buttons and blocked endpoints always agree.

## 10. API surface

```text
GET/POST   /api/households                    (user's households, create)
GET/PATCH  /api/households/:id
POST       /api/households/:id/archive | restore
GET        /api/households/:id/overview       (one call for the dashboard)
GET/POST   /api/households/:id/activities
GET        /api/households/:id/emissions?from&to&groupBy
GET/POST/PATCH/DELETE  .../appliances | vehicles | members
GET        .../recommendations   POST .../recommendations/:rid/apply
GET        .../forecast          POST .../forecast/simulate
GET/POST   .../challenges        GET .../reports/:month
GET        /api/benchmark?householdId&filters
POST       /api/join  { code }
```

All list endpoints support `page`, `limit`, `sort` and `filter`.

## 11. Seed strategy for the 10 households

`households.config.ts` holds only a profile for each household: size, city, appliances, vehicles, food pattern, flights per year, solar yes/no, and the **target monthly kg**. The generator creates 12 months of activities with seasonal variation (AC peaks in May–June). `calibrate.ts` then scales the current month to the target and adjusts the earlier months to produce the trend (for example Sharma down 8.4%). Run it with a fixed random seed so the demo is identical every time.

## 12. Build order

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Repo, Docker Postgres, Prisma schema, lint | `prisma migrate` runs |
| 1 | Factor registry, emission service, tests | AC 6 h gives the expected kg |
| 2 | Seed generator and calibration | All 10 households hit target totals |
| 3 | Auth, memberships, permission guard | Viewer gets 403 on POST |
| 4 | App shell, sidebar, **household switcher**, skeleton states | Switching changes the active household |
| 5 | Overview, charts, benchmark | Overview matches the spec for all 10 |
| 6 | Add activity, assets, members, create-household flow | Adding an activity updates total and score live |
| 7 | Carbon Twin and what-if simulator, recommendations, forecast | Applying an action changes the forecast |
| 8 | Compare, households table, challenges, reports | Filters and pagination work |
| 9 | Accessibility, mobile pass, empty and error states, demo script | The 286 → 148 → 398 switch demo runs cleanly |

## 13. Demo script (the proof of concept)

1. Open Sharma: 286 kg, electricity-heavy, AC recommendation.
2. Switch to Khan: 148 kg, EV, score 91, and the page visibly changes.
3. Switch to Kapoor: 398 kg, transport-heavy, a different top recommendation.
4. Add an AC activity in Sharma: total, score and recommendation update.
5. Switch to Viewer role: the action buttons disappear and the API rejects edits.
