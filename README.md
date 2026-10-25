# Carbon Wallet

Household carbon accounting for India, built around one Carbon Card per home. Bills, fuel, appliances and a weekly
check-in become a monthly record that a household can seal on a public blockchain and share with a bank or employer.

## Quick start (two terminals)

```bash
# 1. Engine (FastAPI): bill reading, AC calibration, weather, insights, statements and anchoring
cd backend
uv sync
uv run uvicorn app.main:app --port 8001      # API docs at http://127.0.0.1:8001/docs
uv run pytest -q                             # 130 tests

# 2. App (Next.js 15); proxies /py/* to the engine
cp .env.example .env                         # then fill in the change-me values
npm install
npm run prisma:generate && npx prisma migrate deploy && npm run prisma:seed
npm run dev                                  # http://localhost:3000
npm test                                     # 139 tests, on their own prisma/test.db
```

For demos run production mode: `npm run build && npm start`. Demo logins and passwords: [ACCOUNTS.md](ACCOUNTS.md).

## What it does

| Area | Pages |
|---|---|
| Your home | Home (goal, weekly check-in, reminders) · Weekly check-in · Electricity bills · Activity log · Appliances & vehicles |
| Understand | Insights · AC & heat (measured AC power, heat vs habit, heatwave days) · What if · Leaderboard |
| Improve | Suggestions (commit, then verified from your next bill or fill-ups) · Challenges · Monthly report |
| Carbon ID | Carbon ID & card (passbook, printable card with a private barcode and NFC chip) · Proof check (lock, seal, share) |
| Account | Settings & privacy (reminders, download your data, delete) |
| Public | `/` landing · `/methodology` · `/privacy` · `/p/<token>` shared record · `/verify/<token>` sealed months for a bank or employer |
| Admin | `/admin` (users, pending deletions, audit log) · `/admin/households` · `/admin/reader` (card kiosk) |

How every number is worked out is at [/methodology](src/components/methodology/Methodology.tsx), in plain words.
Grid factor everywhere: CEA CO₂ Baseline Database v22.0, FY 2025-26, 0.675 kg CO₂/kWh. Design notes are in `Docs/`.

## Background jobs

```bash
npm run reminders            # push reminders (run hourly, or `npm run reminders -- --loop`); needs VAPID keys
npm run purge                # erase accounts/households 30 days after deletion was asked (run daily)
npm run vapid                # make a VAPID key pair for .env
```

Both jobs are safe to run as often as you like. Without VAPID keys, reminders still show inside the app.

## Sealing on a public chain

Months are sealed as salted Merkle roots by `contracts/CarbonAnchor.sol` (OpenZeppelin `Ownable` + `MerkleProof`).
Without chain settings, sealing runs on a local devnet that is labelled as such everywhere.

```bash
node scripts/compile-contract.mjs            # → contracts/build/CarbonAnchor.json (committed; no network needed)
cd backend && CHAIN_RPC_URL=https://rpc-amoy.polygon.technology ANCHOR_PRIVATE_KEY=0x… uv run python ../contracts/deploy.py
```

The deploy script prints the `.env` lines to add (`CHAIN_*`, `ANCHOR_CONTRACT_ADDRESS`). Use a fresh test wallet
funded from the Polygon Amoy faucet; the key is read from the environment only. Only the app's server can issue or seal
statements (engine key); anyone can verify them.

## Stack

Next.js 15 (App Router), Prisma 6 + SQLite, TanStack Query, Zustand, Tailwind, Zod, Vitest. Engine: FastAPI,
SQLAlchemy, NumPy, SHAP, web3.py, pytest. Bills are encrypted at rest (AES-256-GCM, `STORAGE_KEY`).
