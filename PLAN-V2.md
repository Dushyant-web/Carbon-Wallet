# Carbon Wallet v2: product and build plan

Status (26 Oct 2026, evening): **the website is built** (phases 1–5 and 7, see §0). Next: your accounts and keys for
deployment, then the Android apps (phase 6). Updated with your answers (§2); hosting moved from Back4app to **Render**.
The original plan stays in `PLAN.md`. This one covers:
- web apps and real Android apps;
- shops, government schemes, the benefits at purchase and the removal of broken items;
- mohallas, weather, notifications and a simpler UX on the current theme;
- blockchain, security, and hosting on Netlify, Render and Supabase.

---

## 0. Build status

| Phase | Status | What exists now |
|---|---|---|
| 1 Foundations | **built**, waiting for your accounts | Google sign-in (server-side, PKCE, ID-token signature checks; shop sign-up with Google; Android token endpoint) · Postgres schema + migrations for Supabase, tested on a real Postgres, with row level security locking out Supabase's public API · one-off data copy (tested) · encrypted files in a private Supabase bucket · shared rate limits (Upstash) · HMAC-signed website → engine calls with nonce and 5-min window · CSP / HSTS headers · Render blueprint + Dockerfile · Netlify config · CI and scheduled jobs · `DEPLOY.md`, `.env.example` |
| 2 UX | **built** | gov-portal top strip (skip link, A / A+ / A++, 23-language dropdown) · 5-item sidebar, resizable, foldable (Ctrl/⌘ B), remembered · "More pages" · phone: 5 tabs + ☰ menu · footer with helplines · Sonner toasts · new Home (one number, colour vs state average, ₹, AC-days, one action, two graphs, AI forecast) · Devanagari font · notification centre · Partner chat · 20-per-page lists |
| 3 Items | **built** | households can't add or delete · "Ask to remove" with reason, up to 3 photos (compressed, metadata stripped, encrypted, deleted 90 days after the decision) and two lines · "Not ours" disputes in the same queue · admin queue with photos and bills · owner notified |
| 4 Schemes | **built** | 6 schemes with sources and check dates · matching with the reason and ₹ estimate · steps, documents, official link, helpline · "We applied" · "Is this house yours?" · free services · anti-scam notice · shop counter shows colour + benefits, "Explained" / "Helped apply" notify the home · admin schemes page |
| 5 Mohalla | **built** | GPS or pincode + OpenStreetMap pin, H3 cells only · mohallas of ~40 (stable ids) · per-person totals for mohalla / city / state / India, hidden below 20 homes · live weather, 7 days, Indian AQI (Open-Meteo) · heat → extra carbon tomorrow · "Today in your mohalla" (template feed) |
| 6 Android | next | — |
| 7 Blockchain v2 + security | **built** | nightly seal of the day's shop registrations, removal decisions, scheme help and area totals; proofs kept; engine verify endpoint · dependency audit: Next.js critical fixed |

Added 26 Oct, night: public-portal look (bilingual masthead with our own seal, "What's new" ticker, navy menu,
breadcrumbs, portal footer); **Mohalla Samachar** newspaper page with OpenStreetMap; **Knowledge Park II** demo mohalla
(40 example homes on real ground, `npm run seed:kp2`); official figures for India (BUR-4 2020; OWID 2024), Uttar
Pradesh (GHG Platform India 2018) and Noida (Moran et al. 2018); the colour now uses the **measured** state average once
a state has 20 homes; admin **carbon map**; shop **dashboard** and **CSV catalogue with photos** picked at the counter;
**Help & complaints** with ticket numbers; public **Open data** and **Website policies** pages.

Added 27 Oct: language dropdown with all 22 scheduled languages (AI translated, cached); **Partner** AI help chat for
everyone (admins: read-only database); notification centre; 20-per-page lists everywhere; browser cache + page
warm-up + production `npm run demo`; machine-learned **next-month forecast** with reasons; fuel photos read by Claude;
real product delete; "Not ours" without a note.

### 0.1 Checklist (27 Oct)

✅ built · ⬜ not built yet · 🔑 built, switches on when you add the key or account

**Accounts and roles**
- [x] Three account types: household (Owner / Family / View-only), shop, admin
- [x] Family can only view and add bills
- [x] Shops sign up; an admin approves or suspends them
- [x] Google sign-in (PKCE, ID-token checks, shop sign-up with Google, Android token endpoint): keys set; the localhost redirect URIs must be added in Google Cloud
- [ ] Admin TOTP (second factor) and admin email allowlist
- [ ] Rotating refresh tokens for the Android apps

**UX and look**
- [x] Government-portal look: tricolour strip, masthead with our own seal (not the national emblem), ticker with pause, navy menu, breadcrumbs, footer with helplines
- [x] 5-item sidebar: resizable, foldable (Ctrl/⌘ B), remembered; "More pages"; phone: 5 tabs + ☰ menu
- [x] Text size A / A+ / A++
- [x] Language dropdown: English, Hindi and all 22 Eighth-Schedule languages in their own scripts
- [x] 🔑 The 21 other languages (and any English left on Hindi pages) translated by AI on screen and cached: needs `ANTHROPIC_API_KEY`
- [x] Modern toasts (Sonner)
- [x] Home: one number, colour vs state average, ₹, AC-days, one action, 6-month bars, "where it went", AI forecast card
- [x] Every list 20 per page with page numbers
- [x] Faster pages: loading skeletons, top progress bar, data cached in the browser for a day, menu pages warmed up, `npm run demo` (production: 3–35 ms per request)
- [x] Notification centre: bell with unread count, dropdown, full page for homes, shops and admins, pop-up for new ones
- [x] 🔑 Phone / desktop push notifications: needs VAPID keys (I can generate them)
- [x] 🔑 **Partner** AI help chat on every page, knows the rules per account type, looks up your own data; admins get read-only database access: needs `ANTHROPIC_API_KEY` (answers from the help pages without it)

**Items**
- [x] Households can't add or delete items; shops register them at the counter
- [x] "Ask to remove": reason, up to 3 photos (compressed, location stripped, encrypted, deleted 90 days after the decision), two lines
- [x] "Not ours" / "We never had it": no photo, note optional
- [x] Admin removals queue with photos; owner notified either way

**Shops**
- [x] Scan the card (barcode gun, camera, phone NFC, typed code); 15-minute ticket, up to 10 items
- [x] Shop dashboard (items, customers, efficient share = green seller score, rejections, scheme help, revenue)
- [x] CSV catalogue import with photos; template only has rows the shop can sell; add / change a product photo; hide or delete for good
- [x] Product photos in the public Supabase bucket, bills and removal photos encrypted in the private one
- [x] Counter shows the buyer's colour and benefits; "Explained" / "Helped apply" notify the home
- [ ] Exchange / take-back of the old item at the counter
- [ ] Auto-fill from the BEE label QR code

**Schemes**
- [x] 6 schemes with sources and check dates; matching with the reason and ₹ estimate; steps, documents, official link, helpline
- [x] "We applied"; admin schemes page; anti-scam notice
- [ ] Reminders before scheme deadlines
- [ ] Automatic bill-check alerts (sudden jump, wrong slab, estimated reading)
- [ ] Automatic AC-health alert (real power vs label)

**Mohalla, maps and weather**
- [x] Location by GPS or pincode + map pin; only the H3 cell is stored
- [x] Mohallas by locality; numbers hidden below 20 homes
- [x] Knowledge Park II demo mohalla: 78 named homes covering 90% of the sector
- [x] Mohalla Samachar newspaper page; 7-day weather, heat and Indian AQI
- [x] Maps: Map / Light / Satellite, scale, recentre, full screen, legend; no overlap with the menu
- [x] Admin carbon map: India → state → city → mohalla → homes
- [ ] "Aaj ka Mohalla" written by an LLM (template feed now)
- [ ] IMD's own API (Open-Meteo used now)

**Allowance**
- [x] Measured state average per person once a state has 20 homes; labelled estimate before that
- [ ] Admin-editable state averages
- [ ] Heat-safety rule (homes with elderly, infants or illness never red on heatwave days)

**Open data and help**
- [x] Official figures for India, Uttar Pradesh and Noida with sources
- [x] Public Open data page with CSV; Website policies page
- [x] Help & complaints with ticket numbers and admin replies

**Greenhouse gases**
- [x] All greenhouse gases, not only CO₂: CO₂, CH₄, N₂O and HFCs (AC refrigerants), each in CO₂e with IPCC AR6 GWP100; fuel and electricity factors include CH₄ and N₂O (IPCC 2006 defaults); food and travel as published CO₂e
- [x] Every month stores its split by gas; home page shows "Which gases"; method page, open data and Partner explain it

**Demo data on real numbers**
- [x] All 10 mohallas filled: 1,823 simulated homes sized by each locality's area (OpenStreetMap), named owners, 24 months of bills and totals, ACs and vehicles
- [x] Each state's real home electricity ÷ its homes (Delhi, Karnataka, West Bengal, Maharashtra; national figure elsewhere, labelled), real ERA5 weather month by month, LPG, vehicle ownership (NFHS-5), waste (CPCB)

**AI / ML**
- [x] Bill reading (OCR + AI fallback)
- [x] Real AC power from bills; IMD-rule heatwave days
- [x] Fuel pump / receipt photo reading: NVIDIA vision model (working), Claude when its key is added
- [x] Next-month CO₂e forecast: gradient-boosted trees + real ERA5 weather + SHAP reasons in kg, likely range, scored against simple guesses (5.2 kg vs 7.7 kg average error on unseen months, 40,206 home-months), retrained nightly in the background, admin page
- [ ] Hours-of-use model (needs real bills with AC hours)
- [ ] "Undeclared load" detection (bills far above the registered items)
- [ ] Removal-photo checker for admins
- [ ] Voice in Indian languages (Bhashini)

**Blockchain**
- [x] Nightly seal of shop registrations, removal decisions, scheme help and area totals; proofs kept; anyone can verify
- [ ] Each shop registration signed with the shop's own key
- [ ] Verified reductions as non-transferable certificates

**Security**
- [x] Hashed session tokens in httpOnly cookies; role checks on every route; Zod / Pydantic validation
- [x] Rate limits (in memory, 🔑 Upstash when added); HMAC-signed website → engine calls
- [x] CSP, HSTS, COOP, CSRF origin check; upload checks, EXIF stripping, encrypted files
- [x] Supabase row-level security locks out the public API
- [x] Partner is read-only: one SELECT at a time inside a read-only transaction; secret columns refused
- [ ] Dependabot / CodeQL, OWASP ASVS checklist, short pentest

**Hosting**
- [x] Render blueprint + Dockerfile, Netlify config, Postgres migrations for Supabase, data copy script, CI and nightly jobs, `DEPLOY.md`
- [x] Supabase set up: 46 tables with row-level security, data copied, storage buckets created
- [ ] 🔑 Website and engine deployed: needs your Netlify and Render accounts

**Android**
- [ ] Ghar (household) and Dukaan (shop) native apps (Kotlin + Compose)

---

## 1. The idea in one paragraph

Every home gets a Carbon Card. The household only uploads electricity bills; everything it buys (AC, fridge, car,
scooter) is registered by the shop that sells it, so the list of what a home owns is complete and honest. From bills
and registered items we know each home's real carbon. Homes are grouped into **mohallas** of about 40 houses, then
into city, state and India, giving a daily carbon picture of the country next to the weather of each mohalla.
At the shop counter, the card also works as a **bridge to government schemes**: the shop sees which benefits the buyer
qualifies for (rooftop solar subsidy, e-scooter subsidy, AC exchange, vehicle scrappage rebate) and helps claim them,
benefits most families never hear about. Records are sealed on a public blockchain so nobody can quietly change them.

---

## 2. Your decisions (26 Oct)

| Topic | Decision |
|---|---|
| Theme | **Keep the current look** (moss green, terracotta, paper; Newsreader + IBM Plex). Rework the UX: simpler sidebar, easier words, more graphs |
| Who it's for | Design for someone with little schooling using a cheap Android phone |
| Login | **Google sign-in** (you'll provide the Google OAuth client ID and secret). No SMS OTP: it costs money |
| Toasts | Modern toasts (stacked, swipe to dismiss, matching the theme), replacing today's plain inline messages |
| Notifications | **Real phone notifications**: web push for the website, Firebase Cloud Messaging for the Android apps |
| Location | GPS when at home; otherwise **set it by hand** (pincode or locality search, then a pin on the map) |
| Limit at purchase | Not a block. The shop sees the carbon status **and the government benefits the buyer can get**; we act as the bridge between government and household |
| Government page | A "Sarkari Yojana" page on the website and in the apps, plus free services for using the system (§6) |
| Old / broken items | The household **can't remove** items. The owner sends a removal request (photos + what broke, in about 2 lines); an admin checks it and removes the item if it's true |
| Mohalla | Name approved |
| Starting allowance | **Each state's current average** per person, then × people in the home |
| Weather data | Hackathon, not commercial: the free tiers of IMD and Open-Meteo are fine |
| Hosting | **Netlify** (website), **Render** (engine; replaces Back4app), **Supabase** (database + file storage) |
| Security | Top priority, see §14 |
| Android | **Real native apps** (Kotlin + Jetpack Compose), not a website wrapped in an app, see §12 |

---

## 3. Apps and roles

| App | Platform | Who |
|---|---|---|
| **Ghar** (household) | Website (Netlify) **and** native Android app | Owner, Family, View-only |
| **Dukaan** (shop) | Website **and** native Android app (phone camera + NFC at the counter) | Approved shops |
| **Admin** | Website only (desk work) | Carbon Wallet staff |

### Who can do what

| Action | Owner | Family | View-only | Shop | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| See the home's numbers, bills, items, mohalla, weather, schemes | ✓ | ✓ | ✓ | – | read-only (support) |
| Upload / confirm an electricity bill | ✓ | ✓ | – | – | – |
| Delete a confirmed bill | ✓ | – | – | – | – |
| Add an appliance or vehicle | – | – | – | ✓ (counter) | – |
| Change how much an item is used (hours, km) | ✓ | – | – | – | – |
| **Remove an old or broken item** | request (photos + reason) | – | – | – | approve / reject |
| Dispute a shop's item ("Not ours") | ✓ (item paused until admin decides) | – | – | – | decides |
| Family, card, sealing months, sharing with a bank | ✓ | – | – | – | – |
| Check-in, fill-ups, goals, challenges | ✓ | – | – | – | – |
| See the buyer's carbon status + eligible schemes | – | – | – | ✓ (colour + scheme list) | – |
| Approve shops, schemes list, removal requests | – | – | – | – | ✓ |

Server rules for Owner / Family / View-only and shop registration are **(done)**. v2 changes:
- the owner can no longer add or delete items directly;
- "Not ours" becomes a dispute that an admin decides;
- removal requests are added.

---

## 4. UX on the current theme

### 4.1 Rules for every screen
- **Same colours, fonts and components as today.** Only layout, words and flow change.
- **Words a Class-5 reader understands**, Hindi first, with English and the major Indian languages to choose from.
  A 🔊 button reads the screen aloud.
- **One big number + one colour + one action per screen.** Traffic-light colours (green / amber / red), always paired
  with an icon and a word, never colour alone.
- Every number in **₹ and kg**, plus an everyday comparison ("= 3 din ka AC chalana").
- No technical words in the household apps ("Scope", "Merkle", "calibration", "factor"); those move to
  "Kaise nikala?" links.
- Big touch targets (≥ 48 px), an icon with every label, works on a ₹8,000 phone over weak 4G, keeps the last screens
  offline.

### 4.2 Sidebar (website) and bottom bar (Android)
Today's 15 items become 5, each with an icon and a two-word label:

| Item | Hindi label | Holds |
|---|---|---|
| 🏠 Home | Mera Ghar | Big carbon meter, this month vs last, one tip, 6-month bar graph |
| 🧾 Bills | Bijli Bill | Upload by photo (camera opens at once), past bills with graphs |
| 🏘 Mohalla | Mohalla | My mohalla vs city vs state, weather + air, "Aaj ka Mohalla" feed |
| 💳 Card & items | Card aur Saman | Carbon Card to show at shops, registered items, removal requests |
| 🏛 Schemes | Sarkari Yojana | Schemes the home qualifies for, how to claim, free services |

- Owners also get **⚙ Settings** (family, privacy, notifications).
- The detailed pages (Insights, AC & heat, What if, Leaderboard, Suggestions, Challenges, Monthly report, Proof check)
  move under **"Aur dekhein"** inside Home.
- Family sees the same five items; any button they can't use simply isn't there.

### 4.3 Graphs (more of them, all simple)
- Home: a meter for this month vs the home's allowance, 6 monthly bars, and a "where it went" bar
  (electricity / cooking / travel).
- Bills: units per bill over time, ₹ per bill, with hot days highlighted.
- Mohalla: three bars (my home / mohalla average / city average); a 7-day line of mohalla carbon vs temperature.
- Every chart has a one-line plain sentence above it saying what it shows. No legends, just direct labels.
  Colour-blind safe, readable in light and dark.

### 4.4 Toasts and notifications
- **Toasts:** one library across all web apps (Sonner-style, styled with the theme). Success, error and "undo" on
  reversible actions, read out to screen readers. The Android apps use Material snackbars in the same tone.
- **Notifications** (these show on the phone like any other app's):
  - website: Web Push with VAPID keys, already working for reminders **(done)**;
  - Android: Firebase Cloud Messaging.
- Notification types:
  - bill due;
  - your bill was read;
  - heatwave tomorrow;
  - a shop registered an item to your home (with "Not ours");
  - removal request approved or rejected;
  - a new scheme you qualify for;
  - the mohalla daily update (opt-in).
- Quiet hours and per-type switches already exist **(done)**.

### 4.5 Location (for the mohalla and weather)
- First time: "Abhi ghar par ho?" (Are you at home now?)
  - **Yes:** use the phone's GPS.
  - **No:** set it by hand. Type a pincode (India Post's free pincode API) or a locality, then drag a pin on an
    OpenStreetMap map.
- We store only an H3 hexagon (about 120 m across) and the official place codes, never the exact point (§8).
- The owner can change it later in Settings. Moving house moves the home to a new mohalla.

---

## 5. Shop counter: carbon status + benefits

Built on what exists **(done)**: signup, admin approval, scan by barcode, camera, NFC or typed code, a 15-minute
ticket, register an appliance or vehicle, sales history, owner notification.

After the scan the shop sees, never the home's private numbers:
1. **Carbon status:** green, amber or red, with one sentence, e.g. "A 5-star inverter AC keeps this home green and
   saves ₹2,900 a year".
2. **Benefits this buyer can get for this purchase**, matched from the scheme catalogue (§6) using the item, the
   home's state, its discom and what it already owns. Examples:
   - an electric scooter → PM E-DRIVE incentive;
   - a rooftop solar enquiry → PM Surya Ghar subsidy;
   - exchanging an old AC → the discom AC-replacement offer, where one exists;
   - a new car after scrapping an old one → road-tax rebate and maker's discount.
3. **Help to claim:** the shop marks "Explained to customer" or "Applied", and the household gets a notification with
   the official link and steps.

Also new:
- **Exchange / take back:** retire the old item when a new one is sold. The net change counts.
- **Product catalogue:** BEE models with stars, rated power, yearly kWh and label year, so shops pick a model instead
  of typing it.
- **Green seller score:** the share of efficient items a shop sold.

"Not eligible" never blocks a sale; the status is advice and the benefits are the reason to choose well.

---

## 6. Sarkari Yojana page + free services

### 6.1 Scheme catalogue
Admins maintain it: name, who qualifies, benefit, documents, official link and helpline, states, and the date it was
last checked. Entries to start with:

| Scheme | Benefit (as of Oct 2026) | Who / where | Claim |
|---|---|---|---|
| **PM Surya Ghar: Muft Bijli Yojana** (rooftop solar) | ₹30,000 per kW for the first 2 kW, ₹18,000 for the 3rd; max **₹78,000**; some states add top-ups | Owner of the house with an electricity connection in their name; one subsidy per house | pmsuryaghar.gov.in, helpline 15555; paid to an Aadhaar-linked bank account after installation and discom inspection |
| **PM E-DRIVE** (electric two-wheelers) | ₹2,500 per kWh of battery, max **₹5,000** per vehicle; till 31 Mar 2028 or until funds run out | E-2W with ex-factory price ≤ ₹1.5 lakh | Applied at the dealer at purchase |
| **Vehicle scrappage** | Certificate of Deposit → up to **25%** road-tax rebate on a new private vehicle, up to 5% maker's discount, registration fee waived | Same category as the scrapped vehicle; state rules differ | Registered scrapping facility; Vahan portal |
| **AC replacement (discom offers)** | E.g. Tata Power-DDL (Delhi): up to 53% off MRP on efficient ACs, ₹4,000 for the old AC (Apr 2026 catalogue) | That discom's domestic customers | Discom portal |
| **EESL efficient fans / induction cooking** | Efficient BLDC fans and induction cookstoves through EESL | All households | EESL / partner outlets |
| **PM Ujjwala** (LPG) | Free LPG connection for eligible poor households | Eligible women heads of household | Oil company distributors |

The ones still to check are flagged "check" in the catalogue until an admin confirms the current terms on the official
site. We never pay money ourselves; we point people to the official scheme and help them apply.

### 6.2 Matching
Each home sees "Aapke liye yojana" (schemes for you): only schemes it may qualify for. The match uses its state,
discom (from its bills), whether it owns the house (asked once), and its items (an old AC, an old petrol scooter, no
solar yet).

### 6.3 Free services (reasons to use the app)
- **Free bill check:** reads every bill and flags a sudden jump, a wrong tariff slab or an estimated (unread) meter.
- **Free AC health check:** compares the AC's real power, measured from bills, with its label: "Service your AC, it
  uses 30% more than it should".
- **Free scheme finder** (above), with reminders before deadlines.
- **Free Carbon Card** and a **free certificate** to show a bank for green loans (sealed months + verify page,
  **(done)**).
- **Partner offers:** shops can offer card holders a discount; mohalla winners each month get a certificate.

---

## 7. Carbon allowance (for the colour and the tips)

```
Home's yearly allowance = people in the home × state average per person (this year)
Status                  = (carbon so far this year + expected rest of year) ÷ allowance
                          ≤ 90% green · 90–110% amber · > 110% red
```

- **State average per person:** for what we track (home electricity, cooking fuel, private vehicles), built from:
  - CEA state per-capita electricity × grid factor;
  - state LPG and vehicle fuel use per person (PPAC and MoSPI HCES);
  - updated yearly. Admins can edit the table.
- **What a purchase adds** (used for the amber and red sentences and the "efficient option" tip):
  - appliances: rated kW × predicted hours a year × grid factor, plus refrigerant leakage for ACs;
  - vehicles: expected km ÷ mileage × fuel factor.
  - Predicted hours come from a small model trained on our own bill-measured homes (§11).
- **Heat safety:** cooling in homes with elderly people, infants or illness is never shown as red on heatwave days.

---

## 8. Mohalla → city → state → India

- **Forming mohallas:**
  - location from GPS or set by hand (§4.5), stored as an H3 hexagon (resolution 10) plus the official
    locality / ward / district / state codes;
  - a nightly job groups neighbouring hexagons into mohallas of 30–60 homes (target 40), splitting above 80 and
    merging below 20;
  - IDs stay stable, and names come from the locality, e.g. "Faridabad · Sector 22 · Mohalla 3".
- **Privacy:**
  - only totals, and only for 20+ homes;
  - no single home on any map;
  - ranking inside the mohalla is opt-in;
  - location is listed in the consent notice;
  - anyone can leave.
- **Totals:** daily and monthly per mohalla, then city, state and India: kg per person, change from last month, share
  from electricity / cooking / travel, homes counted. Labelled "from N Carbon Wallet homes". Published figures from
  outside (Climate TRACE, Carbon Monitor) are shown next to ours, never mixed in.
- **"Aaj ka Mohalla"** daily feed: short stories from the day's numbers, written by an LLM from the facts with a
  template fallback, in the user's language. Every number links to its source, and admins can hide a story.

## 9. Weather and air quality

- **Sources:** IMD API (official forecasts and heatwave warnings; free for non-commercial use), Open-Meteo (hourly
  forecast; free for non-commercial use), CPCB AQI. Pulled hourly per H3 resolution-7 cell (about 5 km², shared by
  many mohallas) and cached, never fetched while a user waits.
- **Shown per mohalla:** today and tomorrow (temperature, feels-like, rain, heat alert, air quality), plus a
  heat → carbon forecast: "Kal 44°C — expect +x kg for your home".
- **Truth rules:**
  - never claim a mohalla's CO₂ changes its own weather;
  - what we can say: heat drives AC use and carbon (we measure it), AC exhaust **can** warm nights about 1 °C in
    crowded areas, burning fuel worsens local air, and everyone's CO₂ adds up to more heatwaves over the years.

---

## 10. Removing old or broken items (admin approval)

1. Owner opens the item → **"Hata do"** (remove it).
2. Picks a reason (broken / sold / given away / scrapped / never had it), adds **2–3 photos** (the item, its label,
   and the damage), and writes **what happened in about 2 lines**. Photos are compressed on the phone, stored
   encrypted, and deleted 90 days after the decision.
3. The item stays counted, marked "removal requested", until an admin decides.
4. **Admin queue:** photos, the item's history (which shop, when), the home's bills (did use drop?), and other requests
   from the same home.
   - **Approve:** the item is retired (kept in history, no longer counted) and the shop's sale is marked removed.
   - **Reject:** the owner gets the reason.
   - Either way the owner gets a notification and the decision is anchored on chain (§13).
5. Scrapped vehicles with a Certificate of Deposit link to the scrappage benefit (§6).

The same queue handles "Not ours" disputes against shops.

---

## 11. AI / ML, always explained in one plain line

| Part | Where | Status |
|---|---|---|
| Bill reading (OCR + AI), Hindi and English bills | engine | **done** |
| Real AC power from bills, heatwave days | engine | **done** |
| Hours-of-use model for the purchase tip | trained offline, small model file served by the engine | new |
| "Undeclared load" (bills ≫ registered items) | engine | new |
| Next month's forecast using the weather | engine (gradient boosting + SHAP) | **done** |
| "Aaj ka Mohalla" writer + translation | backend + LLM + Bhashini | translation **done** (Claude); writer new |
| Removal-request helper (does the photo show that item? did bills drop?) | backend + vision model, advises the admin only | new |
| Voice: "Is mahine kitna hua?" | Bhashini speech ↔ text | new |

---

## 12. Android apps: real, native

**Kotlin + Jetpack Compose**, one codebase producing two apps from build flavours: **Ghar** and **Dukaan** (admin
stays on the web). It uses the same backend API as the website, with no webview screens.

| Need | Android pieces |
|---|---|
| Look | Material 3 themed with the **same colours and fonts** as the website (Newsreader + IBM Plex, OFL licensed, bundled) |
| Sign-in | Google sign-in through **Credential Manager** → Google ID token → our backend verifies it → our tokens |
| Card scan (Dukaan) | **CameraX + ML Kit barcode scanning** (on the phone, free, works offline), **NFC** (reads the card's text record or chip serial), plus a USB scanner if one is plugged in |
| Bill photo (Ghar) | CameraX with edge detection and compression; upload retries in the background (WorkManager) on bad networks |
| Notifications | Firebase Cloud Messaging, with channels per type (bills, heat, items, schemes, mohalla) |
| Offline | Room database cache of the last data; screens open without a network |
| Graphs | Vico (Compose charts), styled like the website |
| Maps (manual location) | MapLibre / osmdroid with OpenStreetMap (no Google Maps billing) |
| Voice | Android text-to-speech + Bhashini for Indian languages |
| Speed | Baseline profiles, R8 shrinking, app under about 15 MB, cold start under 1.5 s on a budget phone |
| Security | Tokens in Android Keystore, Play Integrity check on sign-in, no secrets in the app, HTTPS only (network security config) |

Screens follow §4: the same five sections as a bottom bar. The Dukaan app opens straight to "Scan card".

---

## 13. Blockchain

Today **(done)**: each home's monthly totals are sealed as salted Merkle roots in `CarbonAnchor.sol` on Polygon
(Amoy testnet), with a public verify page.

v2 adds daily Merkle batches for:
1. shop registrations, each signed with the shop's key;
2. removal-request decisions and "Not ours" disputes;
3. mohalla, city and state daily totals;
4. scheme help given at the counter ("explained" / "applied");
5. verified reductions (e.g. "2-star → 5-star AC: −650 kg/yr"), non-transferable, to feed government programmes
   later.

Only hashes go on chain, never names, locations, photos or bills. No coin of our own.

---

## 14. Security (top priority)

**Sign-in and sessions**
- Google sign-in for everyone:
  - web: OAuth code flow with PKCE and state, handled on the server;
  - Android: Credential Manager ID token;
  - the backend checks the token's signature against Google's keys, plus audience (our web + Android client IDs),
    issuer, expiry and `email_verified`.
- Web sessions: random token in an httpOnly, Secure, SameSite cookie; only the hash is stored (**done**). 7-day expiry,
  rotated on sign-in.
- Android: short-lived access token (15 min) plus a rotating refresh token, kept in the Keystore; refresh-token reuse
  revokes every session.
- Admins: Google sign-in **plus** a TOTP code, on an email allowlist. Shops: Google sign-in plus admin approval
  (**approval done**).
- Seeded demo accounts keep passwords for the hackathon demo only, behind the demo switch.

**API protection**
- Every route checks who you are and your role on the server (**done**); inputs validated with Zod / Pydantic
  (**done**).
- Rate limits in Redis per user, IP and action (login, scan, upload, removal request). The current in-memory limiter
  moves to Upstash Redis (free tier).
- Calls between the website and the backend are signed with HMAC (key, timestamp, body hash, 5-minute window),
  replacing the static engine key. CORS is an allowlist of our domains only.
- CSRF origin check (**done**); security headers on Netlify: CSP, HSTS, X-Frame-Options, Referrer-Policy,
  Permissions-Policy.
- Uploads (bills, removal photos): size limits, file-type sniffing (**done**), EXIF/GPS stripped from photos,
  encrypted at rest with AES-256-GCM (**done**), served only to the household.
- Database:
  - apps never talk to Supabase directly; only the backend holds the service key;
  - Row Level Security is still switched on for every table as a second wall;
  - least-privilege database roles;
  - daily backups.

**Supply chain and monitoring**
- GitHub: Dependabot, CodeQL, secret scanning, `npm audit`, `pip-audit`, signed release builds of the Android apps.
- Secrets only in Netlify, Render and Supabase environment settings. The Google OAuth secret never goes in the repo
  or the app.
- Audit log of every sensitive action (**done** for households; extend to admin actions). Alerts on unusual scan or
  sign-in patterns.
- DPDP Act + Rules (notified Nov 2025): consent notice per data item (incl. approximate location and photos), export
  and delete (**done**), breach process, data kept in India (Supabase Mumbai).
- Before launch: an OWASP ASVS level 2 checklist, OWASP Mobile Top 10 for the apps, and a short pentest of the API.

---

## 15. Hosting and speed (Netlify + Render + Supabase)

```
Android apps ─┐
              ├──► Render (Docker, Singapore): FastAPI ──► Supabase (Postgres, Storage), region Mumbai
Website ──────┘        (auth, households, shops,           ▲
(Netlify: Next.js)      bills, schemes, admin, jobs)       │
                        ▲                                  │
       Upstash Redis ───┘ (rate limits, cache, queues)     │
       Polygon (anchoring), FCM + Web Push, IMD / Open-Meteo, Bhashini, LLM
```

**One backend API for both clients.** The website (Next.js on Netlify) renders pages and calls the same API as the
Android apps. Today's Next.js API routes move into the FastAPI service, or are proxied to it, so the rules live in
one place.

**Free-tier limits to plan around**
- **Render free web service: sleeps after 15 minutes without traffic** (the first request after that takes about a
  minute), 750 free instance hours a month per workspace (enough for the whole month), temporary disk, and it may be
  restarted at any time, so the engine keeps its state in Supabase. Pages never wait on the engine except bill reading and
  sealing; switch to the Starter plan for judging days (dashboard only, no code change).
- **Supabase free: 500 MB database, 1 GB file storage, paused after 1 week without use.**
  - A scheduled ping every few days keeps it awake (`keepalive` job, **done**).
  - Bills are stored compressed, and originals deleted after confirmation (**done**).
  - Pick the **Mumbai** region.
- **Netlify:** Next.js App Router, server actions and middleware are supported. Its serverless functions run in one
  region, so set it nearest India if the plan allows, and keep pages mostly static or cached so few requests go far.

**Speed targets**
- Website home screen: first load under 2.5 s on a budget Android over 4G, under 150 KB of JavaScript per page.
- API: 95% of calls under 300 ms from India.
- How:
  - mohalla, city and state totals and scheme matches are precomputed by jobs;
  - weather and AI are never called while a user waits;
  - responses are cached in Redis and at Netlify's edge;
  - the database lives in Mumbai.

**Deployment-ready**
- GitHub Actions on every push:
  - checks: type check, lint, Vitest, pytest, Playwright for the web apps, Android unit + UI tests;
  - deploys: preview deploys on Netlify, a Render deploy from the Dockerfile, Prisma migrations against Supabase.
- The SQLite → Postgres move happens once, with a script that copies today's data.

---

## 16. New data (database tables)

| Table | Holds |
|---|---|
| `household_locations` | H3 cell, official place codes, source (GPS / manual), consent time, no raw coordinates |
| `mohallas`, `area_daily` | Mohalla membership; daily totals per mohalla / city / state / India |
| `weather_cells` | Hourly forecast + AQI per H3 resolution-7 cell |
| `state_allowances` | Per state and year: average kg per person for what we track |
| `schemes`, `scheme_matches`, `scheme_help` | Scheme catalogue; which homes qualify; help given at the counter |
| `removal_requests` | Item, reason, 2-line note, photos, status, admin, decision time, anchor batch |
| `devices` | FCM / web-push tokens per user and device |
| `oauth_identities` | Google subject ID ↔ user |
| `refresh_tokens` | Hashed, rotating, per device |
| `product_catalogue` | BEE models: brand, model, stars, label year, rated W, yearly kWh, capacity |
| `feed_items` | Daily stories per area, facts used, language, hidden flag |

---

## 17. Build order

| Phase | Weeks | What |
|---|---|---|
| 0 | done | Roles; shops + approval + counter; Carbon Card; monthly sealing; web push |
| 1 | 1 | **Foundations:** Supabase (Mumbai) + Postgres migration, Google sign-in (web), Upstash rate limits, HMAC between services, Netlify + Render deploys, CI |
| 2 | 1–2 | **UX on the current theme:** 5-item sidebar, simple words, Hindi, toasts, more graphs, family view check |
| 3 | 1 | **Items:** owner can't add or delete; removal requests with photos + admin queue; "Not ours" as a dispute |
| 4 | 1–2 | **Schemes:** catalogue + Sarkari Yojana page + matching + benefits at the shop counter; free bill and AC checks |
| 5 | 2 | **Mohalla:** GPS / manual location, nightly grouping, totals, "Aaj ka Mohalla", weather + AQI |
| 6 | 3–4 | **Android:** Ghar + Dukaan apps (Kotlin / Compose), Google sign-in, FCM, camera + NFC scanning, offline |
| 7 | 1 | **Blockchain v2** batches; security pass (ASVS / Mobile Top 10), load test, demo data, pitch |

---

## 18. Data sources (context and baselines)

| What | Source | Notes |
|---|---|---|
| Grid emission factor | CEA CO₂ Baseline Database v22, 0.675 kg/kWh | **in use** |
| State electricity per person | CEA via RBI HSIS Table 138 (2024-25) | Basis of the state allowance |
| Household fuel use | MoSPI HCES 2023-24 microdata | State LPG / fuel baseline |
| City CO₂ (daily) | Carbon Monitor Cities | 1,500 cities incl. India; check for updates after 2021 |
| City / source CO₂ (monthly) | Climate TRACE | CC BY 4.0; top-100 urban areas tables |
| Indian cities, high resolution | CHETNA (LSCE + IIT Bombay) | No public portal yet; worth contacting |
| State GHG inventory | GHG Platform India | 2005–2018 |
| Weather / heat warnings | IMD API, Open-Meteo | Free for non-commercial use (fits the hackathon) |
| Air quality | CPCB via data.gov.in | Open Government Licence |
| Languages | Bhashini | Check current speech coverage |
| Schemes | pmsuryaghar.gov.in, MHI (PM E-DRIVE), MoRTH / Vahan (scrappage), discoms, EESL | Each entry stores the date it was last checked |

---

## Sources
- [PM Surya Ghar subsidy 2026 (The Wire / PTI)](https://m.thewire.in/article/ptiprnews/pm-surya-ghar-yojana-2026-how-to-get-rs-78000-solar-subsidy-cut-your-electricity-bill)
- [PM Surya Ghar FAQ (eligibility)](https://quickestimate.co/blog/pm-surya-ghar-faq)
- [PM E-DRIVE extended to 2028 (electrive, Aug 2026)](https://electrive.com/2026/08/14/india-extends-e-2w-incentives-under-pm-e-drive-scheme-increases-total-outlay)
- [PM E-DRIVE rate ₹2,500/kWh, max ₹5,000 (Angel One)](https://www.angelone.in/news/economy/government-reduces-electric-2-wheeler-subsidy-to-5-000-extends-pm-e-drive-to-march-2028)
- [Vehicle scrappage rebate (Tribune)](https://www.tribuneindia.com/news/chandigarh/scrap-save-25-road-tax-rebate-on-new-private-vehicles-in-chandigarh-498697)
- [Tata Power-DDL product catalogue, Apr 2026](https://www.tatapower-ddl.com/Editor_UploadedDocuments/Content/Product_Catalogue_-_20.04.2026.pdf)
- [EESL efficient fans and induction cooking (Outlook Planet)](https://planet2.outlookindia.com/news/eesl-to-distribute-1-cr-energy-efficient-fans-20-lakh-induction-cookstoves-news-416254)
- [Back4app container pricing](https://back4app.com/pricing/container-as-a-service) (replaced by Render)
- [Render free instances](https://render.com/docs/free)
- [Next.js on Netlify (OpenNext)](https://opennext.js.org/netlify)
- [Supabase free tier limits 2026](https://www.cloudzero.com/blog/supabase-pricing/)
- [Carbon Monitor Cities](https://www.cdp.net/en/cities/ghg-emissions-tools-and-datasets-guide-for-cities/carbon-monitor-cities)
- [Climate TRACE data](https://climatetrace.org/data)
- [CHETNA](https://www.lsce.ipsl.fr/city-wise-high-resolution-carbon-emissions-tracking-and-nationwide-analysis-chetna/)
- [GHG Platform India](https://ghgplatform-india.org/who-we-are/)
- [RBI HSIS Table 138](https://website.rbi.org.in/documents/d/rbi/HSIS202425_T138)
- [MoSPI HCES 2023-24](https://microdata.gov.in/NADA/index.php/catalog/237/variable/V92)
- [IMD API](https://api.imd.gov.in/)
- [Open-Meteo pricing](https://open-meteo.com/en/pricing)
- [CPCB AQI on data.gov.in](https://data.gov.in/resource/real-time-air-quality-index-various-locations)
- [H3 resolution table](https://h3geo.org/docs/core-library/restable/)
- [AC waste heat study (ASU)](https://news.asu.edu/content/excess-heat-air-conditioners-causes-higher-nighttime-temperatures)
- [DPDP Rules 2025 (Mondaq)](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified)
- [India carbon market (ICAP)](https://icapcarbonaction.com/en/news/compliance-obligations-under-indias-carbon-credit-trading-scheme-enter-force-seven-sectors)
