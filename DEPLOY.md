# Deploying Carbon Wallet

Three free services, region close to India:

| Part | Where | What runs there |
|---|---|---|
| Website + its API (Next.js) | **Netlify** | every page, sign-in, households, shops, schemes, mohalla, admin |
| Engine (FastAPI) | **Render** (Docker, Singapore) | bill reading, AC calibration, what-if, sealing on chain |
| Database + files | **Supabase** (Mumbai, `ap-south-1`) | Postgres for both; a private Storage bucket for encrypted bills and photos |
| Optional | Upstash Redis | rate limits shared across Netlify's function instances |

Secrets go only into each service's environment settings. `.env.example` lists every one; nothing secret is in
the repo, and the Google client secret never reaches the browser or the Android app.

## 1. Supabase

1. New project → region **Mumbai** → note the database password.
2. Connect → connection strings (all are kept in `.env.supabase`, which only the deploy scripts read):
   - **transaction pooler** (port 6543), add `?pgbouncer=true&connection_limit=1`: this is `DATABASE_URL` for Netlify;
   - **session pooler** (port 5432 on the same `pooler.supabase.com` host): this is `DIRECT_URL`, used only for
     migrations. The "direct" `db.<ref>.supabase.co` host is IPv6-only on the free plan, so most laptops and
     Render can't reach it; the session pooler works over IPv4.
3. Storage → New bucket `private-files`, **Public: off** (bills, removal photos; encrypted before upload). Second
   bucket `product-images`, **Public: on** (shop product photos only, shown to everyone anyway). Settings → API →
   copy the `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`, server only) and the project URL (`SUPABASE_URL`).
4. Create the tables (run from your machine once; Netlify's build also runs it on every deploy):
   ```bash
   (set -a; . ./.env.supabase; set +a; npm run db:pg:migrate)
   ```
   The second migration (`lock_down`) turns on row level security for every table and removes all rights from
   Supabase's public API roles (`anon`, `authenticated`). The app never uses that API: only the website's server
   connects, as the table owner.
5. Data:
   - **demo data**: `DATABASE_URL="<direct>" npx tsx prisma/seed/index.ts` after generating the Postgres client
     (`npx prisma generate --schema prisma/postgres/schema.prisma`; run `npx prisma generate` afterwards to go back
     to SQLite locally); or
   - **copy your local database** once: `PG_URL="<session pooler>" npm run db:pg:copy` (sign-in sessions, counter
     tickets and push subscriptions are not copied; people sign in again).
6. The engine keeps its sealing records in the same database under its own schema:
   `create schema engine;` (SQL editor), then use
   the session-pooler URL as `postgresql+psycopg://…:5432/postgres?options=-csearch_path%3Dengine` for the
   engine's `DATABASE_URL` (`ENGINE_DATABASE_URL` in `.env.supabase`).

Free-plan limits: 500 MB database, 1 GB files, and the project **pauses after a week without use**. The
`keepalive` job (step 5) prevents that.

## 2. Render (engine)

1. Dashboard → New → **Blueprint** → this repository. `render.yaml` creates `carbon-wallet-engine` from
   `backend/Dockerfile` in Singapore.
2. Fill the secrets it asks for: `ENGINE_API_KEY` (same value as on Netlify), `ENGINE_SALT_KEY`, `BILL_HASH_SALT`,
   `DATABASE_URL` (step 1.6), `CORS_ORIGINS` (your Netlify URL), `ANTHROPIC_API_KEY` (AI reading of unclear bill
   and fuel photos), optional `NVIDIA_API_KEY` and chain settings.
4. The forecast model (scikit-learn) is trained by the website's nightly `ml` job and kept on the engine's disk;
   after Render restarts a free service, the first forecast simply retrains it (a few seconds).
3. `ENGINE_REQUIRE_SIGNATURE=1` is already set: the engine answers its private routes only to calls signed by the
   website's server (HMAC with a timestamp and nonce, `backend/app/signing.py`).

Free plan: the service **sleeps after 15 minutes without traffic** and the first request after that takes about a
minute; each workspace gets 750 free instance hours a month; the disk is temporary (the engine keeps everything in
Supabase), and Render may restart a free service at any time. Pages don't wait on the engine except bill reading and sealing. For judging days switch the plan to
Starter in the dashboard (no code change).

## 3. Netlify (website)

1. Add new site → import this repository. `netlify.toml` sets the build (`npm run build:netlify`: Postgres
   client, migrations, Next build) and Node 22.
2. Site settings → Environment variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL`, `DIRECT_URL` | from step 1.2 |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`, `SUPABASE_PUBLIC_BUCKET` | from step 1.3 |
   | `ANTHROPIC_API_KEY` | console.anthropic.com → API keys: switches on Partner and the 21 AI-translated languages |
   | `PY_API_URL` | `https://carbon-wallet-engine.onrender.com` |
   | `ENGINE_API_KEY`, `BILL_HASH_SALT` | same as Render |
   | `STORAGE_KEY`, `AUTH_SECRET`, `CRON_SECRET` | `openssl rand -base64 32` each |
   | `APP_URL` | `https://<your-site>.netlify.app` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | step 4 |
   | `ADMIN_INVITE_CODE`, `ADMIN_EMAILS` | your choice |
   | `MOHALLA_MIN_HOMES` | `20` (lower only for a demo) |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npm run vapid` |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional, Upstash console |
   | `NEXT_PUBLIC_SHOW_DEMO` | `1` only for a demo build |

3. Functions region: Site configuration → Functions → choose the region nearest India your plan offers.

Security headers (CSP, HSTS, frame and permission policies) come from `next.config.ts` and apply on Netlify too.

## 4. Google sign-in

Google Cloud Console → APIs & Services:
1. OAuth consent screen: External, app name "Carbon Wallet", scopes `openid email profile` only.
2. Credentials → Create OAuth client ID → **Web application**:
   - Authorised JavaScript origins: `https://<your-site>.netlify.app` (and `http://localhost:3000`,
     `http://localhost:3001` for local work)
   - Authorised redirect URIs: `https://<your-site>.netlify.app/api/auth/google/callback`
     (and `http://localhost:3000/api/auth/google/callback`, `http://localhost:3001/api/auth/google/callback`)
3. Put the client ID and secret into Netlify's environment (and your local `.env`). The "Continue with Google"
   button appears as soon as both are set.
4. Android (later): create an **Android** client per app (package name + signing SHA-1) and list their client IDs
   in `GOOGLE_ANDROID_CLIENT_IDS`; the apps send Google's ID token to `/api/auth/google/idtoken`.

## 5. Scheduled jobs

Netlify functions don't run on a timer, so `.github/workflows/jobs.yml` calls `POST /api/jobs/<name>` with
`Authorization: Bearer $CRON_SECRET`. Add repository secrets `SITE_URL` and `CRON_SECRET`.

| Job | When | Does |
|---|---|---|
| `areas` | 02:00 IST | groups homes into mohallas, recomputes mohalla / city / state / India totals |
| `seal` | after `areas` | anchors yesterday's events (shop registrations, removal decisions, scheme help, area totals) on chain |
| `ml` | after `seal` | retrains the next-month forecast on the latest monthly totals (engine, scikit-learn) |
| `purge` | daily | erases accounts past their 30 days and removal photos 90 days after the decision |
| `reminders` | hourly | push reminders |
| `keepalive` | every 3 days | keeps the free Supabase project awake |

## 6. Showing it on a laptop (demo)

`npm run dev` compiles each page on its first visit and adds about 250 ms to every request. For a demo run the
production build instead: `npm run demo` (builds into `.next-prod`, then serves on port 3000; stop the dev server
first). Pages then answer in 3–35 ms.

## 7. Before going live

- `NEXT_PUBLIC_SHOW_DEMO=0`, `MOHALLA_MIN_HOMES=20`, no `COOKIE_INSECURE`, no `DEMO_AUTH`.
- Rotate every `change-me` value; never reuse local keys.
- `npm audit --omit=dev`: as of 26 Oct 2026 the remaining advisories are build-time (Prisma's config loader)
  and zod 3 (fixed only in zod 4, a breaking upgrade worth doing before launch).
- Run CI (`.github/workflows/ci.yml`): type check, lint, Vitest, pytest, Postgres schema check.

## 8. Food and waste removed

Food and waste no longer count towards a home's carbon, and LPG now sits under "Cooking". New months are already
worked out this way; months saved before the change still carry the old food and waste numbers. Run this once
against Supabase after deploying (it takes seconds, and running it again changes nothing):

```sh
npx prisma generate --schema prisma/postgres/schema.prisma
(set -a; . ./.env.supabase; set +a; DATABASE_URL="$DIRECT_URL" npx tsx scripts/drop-food-waste.ts)
npx prisma generate   # back to the local SQLite client
```

It takes food and waste out of each stored month's total and categories, then recomputes the mohalla, city,
state and India totals. On this laptop the same thing is `npm run db:drop-food-waste`.
