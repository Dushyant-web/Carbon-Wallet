# Carbon Wallet

Household carbon accounting for India, built around one Carbon Card per home. Households upload electricity bills;
shops register what a home buys when it shows its card, so the list of what a home owns is complete. Homes are
compared with their state's average, grouped into mohallas of about 40, and shown the government schemes they can
claim. Records are sealed on a public blockchain.

Three kinds of account: platform **admins**, **households** (the Owner changes things; Family view and add electricity
bills; View-only look) and **shops**, which scan a customer's card at the counter to register what they bought and
tell them about the benefits that fit. Sign in with Google or a password. English and Hindi; text size A / A+ / A++.

## Quick start (two terminals)

```bash
# 1. Engine (FastAPI): bill reading, AC calibration, weather, insights, statements and anchoring
cd backend
uv sync
uv run uvicorn app.main:app --port 8001      # API docs at http://127.0.0.1:8001/docs
uv run pytest -q                             # 134 tests

# 2. App (Next.js 15); proxies /py/* to the engine
cp .env.example .env                         # then fill in the change-me values
npm install
npm run prisma:generate && npx prisma migrate deploy && npm run prisma:seed
npm run seed:kp2                             # demo mohalla: 40 example homes in Knowledge Park II, Greater Noida
npm run dev                                  # http://localhost:3000
npm test                                     # 167 tests, on their own prisma/test.db
```

For demos run production mode: `npm run build && npm start`. Demo logins and passwords: [ACCOUNTS.md](ACCOUNTS.md).
Hosting (Netlify + Render + Supabase), Google sign-in and scheduled jobs: [DEPLOY.md](DEPLOY.md). Product plan: [PLAN-V2.md](PLAN-V2.md).

## What it does

The menu has five places; everything else is under **More pages**.

| Menu | What's there |
|---|---|
| My home | One number, green / amber / red against the state average for the home, ₹ and plain sentences, one thing to do, 6-month and "where it went" graphs |
| Electricity bill | Photo of the bill → read automatically → confirmed by the family |
| My mohalla | **Mohalla Samachar**, a daily newspaper for ~40 homes: top story, OpenStreetMap map of the mohalla (outline from groups of homes, your own ~120 m hexagon), weather and Indian AQI, green-home count, shop and scheme activity, home vs mohalla vs city vs state vs India (shown from 20 homes) next to the official figures for India, Uttar Pradesh and Noida |
| Card & items | What the home owns (added by shops only) · ask to remove an old or broken item with photos and two lines; an admin decides · "Not ours" disputes · Carbon Card |
| Govt schemes | PM Surya Ghar, PM E-DRIVE, vehicle scrappage, discom AC exchange, EESL, Ujjwala: which fit this home and why, steps, documents, official link · free services |
| More pages | What caused it · Ways to save · Monthly report · AC & heat · Try a change · Weekly check-in · Activity log · Challenges · Leaderboard · Proof check · How we calculate |
| Public | `/` landing · `/methodology` · `/privacy` · `/p/<token>` shared record · `/verify/<token>` sealed months for a bank or employer |
| Admin | `/admin` · **carbon map** (each home as a coloured hexagon, India state tile grid, official inventory) · households · shops · removals · complaints · schemes · card reader |
| Shops | `/merchant` dashboard (items, homes served, efficient share, scheme help) · counter: scan the card → colour + benefits → pick the product from the catalogue → register · **catalogue** uploaded as CSV + photos (price, stars, kWh, running cost, CO₂) · registered items · help |
| Everyone | `/open-data` area totals (CSV), daily seal register, official sources · `/policies` terms, accessibility, hyperlinking, copyright · Help & complaints with ticket numbers |

How every number is worked out is at [/methodology](src/components/methodology/Methodology.tsx), in plain words.
Grid factor everywhere: CEA CO₂ Baseline Database v22.0, FY 2025-26, 0.675 kg CO₂/kWh. Design notes are in `Docs/`.

## Background jobs

```bash
npm run reminders            # push reminders (run hourly, or `npm run reminders -- --loop`); needs VAPID keys
npm run areas                # group homes into mohallas, recompute area totals (nightly)
npm run purge                # erase accounts 30 days after deletion was asked, removal photos 90 days after a decision
npm run vapid                # make a VAPID key pair for .env
```

All are safe to run as often as you like. Without VAPID keys, reminders still show inside the app. When hosted,
the same jobs (plus the nightly chain seal and a database keep-alive) are called on `/api/jobs/<name>` by
`.github/workflows/jobs.yml`.

## Sealing on a public chain

Months are sealed as salted Merkle roots by `contracts/CarbonAnchor.sol` (OpenZeppelin `Ownable` + `MerkleProof`).
Without chain settings, sealing runs on a local devnet that is labelled as such everywhere. Every night the day's
platform events (shop registrations, removal decisions, scheme help, area totals) are also sealed as one Merkle root
(`src/server/services/chain.service.ts` → engine `/api/v1/events/anchor`); only hashes go on chain.

```bash
node scripts/compile-contract.mjs            # → contracts/build/CarbonAnchor.json (committed; no network needed)
cd backend && CHAIN_RPC_URL=https://rpc-amoy.polygon.technology ANCHOR_PRIVATE_KEY=0x… uv run python ../contracts/deploy.py
```

The deploy script prints the `.env` lines to add (`CHAIN_*`, `ANCHOR_CONTRACT_ADDRESS`). Use a fresh test wallet
funded from the Polygon Amoy faucet; the key is read from the environment only. Only the app's server can issue or seal
statements (engine key); anyone can verify them.

## Stack

Next.js 15 (App Router), Prisma 6 (SQLite locally, Postgres on Supabase), TanStack Query, Zustand, Tailwind, Zod,
Sonner, Leaflet + OpenStreetMap, h3-js, Vitest. Engine: FastAPI, SQLAlchemy, NumPy, SHAP, web3.py, pytest.
Bills and photos are encrypted at rest (AES-256-GCM, `STORAGE_KEY`); website → engine calls are HMAC-signed.
