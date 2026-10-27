# Carbon Wallet: features we can add next

Written 27 Oct 2026, after going through the website, the engine and the three apps. Each idea builds on what
already exists, so the "Uses" line says which part of the project it reuses.

**Effort:** S = 1–2 days · M = about a week · L = needs a partner, an approval or a pilot

**Ground rules kept:** home electricity, cooking gas and private vehicles only (food and waste stay out); allowance
is 100 kg per person a month; no tokens, no offsets, no selling personal data.

---

## Top 10 to build first

| # | Feature | Why it's worth it | Effort |
|---|---|---|---|
| 1 | Same-region hosting | The live home screen takes 25–27 s and sometimes fails; nothing else matters if it doesn't load | S |
| 2 | Read the screen aloud | One tap reads the home screen in Hindi, for people who can't read well | S |
| 3 | WhatsApp share card | "Our home is Green this month" image, shared in family and mohalla groups: free reach | S |
| 4 | Bill shock alert | "This bill is 40% higher than this weather explains: check the AC or the fridge" | M |
| 5 | Best time to run it | Washing machine, geyser and EV charging moved into cheaper solar hours | M |
| 6 | Rooftop solar estimate from your own bill | Panel size, PM Surya Ghar subsidy, bill after solar, payback years | M |
| 7 | Mohalla team challenge + "12 of 20 homes joined" | Neighbours pull neighbours in; mohalla news unlocks at 20 homes | M |
| 8 | Product compare sheet at the counter | 3★ vs 5★: ten-year cost and CO₂, sent to the buyer on WhatsApp | S |
| 9 | Heat map v2 | Month slider, electricity vs vehicles, tap an area for its details | M |
| 10 | Android home-screen widget | The colour and this month's kg without opening the app | S |

---

## A. Less effort for families (zero logging)

1. **WhatsApp bot for bills** (M)
   - Send a bill photo to a WhatsApp number; get back the colour, the kg and one thing to do.
   - Uses: the bill reader in `backend/app/bills/`, the overview, the WhatsApp Business Cloud API.
   - Families already live on WhatsApp, so there's no app to install.
2. **Fetch the bill from the consumer number** (L)
   - The Consumer ID card becomes real: fetch each month's bill automatically through Bharat Connect (BBPS).
   - BBPS bill fetch takes the biller's consumer number, but access runs through an onboarded operating unit
     (a bank or fintech partner).
   - Uses: `ConsumerIdCard`, `bill.service.ts`.
3. **Smart meter data** (L)
   - About 7.24 crore smart meters were installed in India by June 2026.
   - Start with uploading the discom app's daily or hourly export (CSV or screenshot). Add a discom API later.
   - Daily data shows AC hours directly, which removes the biggest uncertainty in AC calibration.
4. **Read the screen aloud** (S)
   - Android's built-in text-to-speech already speaks Hindi offline.
   - A speaker button on Mera Ghar reads "Is mahine 229 kilo, aapki seema ke andar, hara".
5. **Ask by voice** (M)
   - "Is mahine kitna hua?" in any Indian language: speech-to-text through Bhashini, the answer from Partner,
     spoken back.
   - Uses: `api/partner`, the 22-language list in `src/lib/languages.ts`.
6. **Missed-call or SMS summary for basic phones** (M)
   - Give a missed call, get an SMS with this month's kg and colour. Works for homes without a smartphone.
7. **Home-screen widget** (S): an Android Glance widget showing colour, kg and % of allowance, refreshed daily.

## B. Smarter numbers

8. **Bill shock alert** (M)
   - Compare each new bill with what the weather and the home's AC calibration predict.
   - Over by much → "AC gas may be low / fridge door seal / meter check", with a grievance shortcut.
   - Uses: `engine/calibration.py`, `engine/decomposition.py`, weather cells.
9. **Best time to run it (ToD advisor)** (M)
   - The 2023 Time-of-Day rules make solar hours 10–20% cheaper and peak hours 10–20% dearer.
   - A 2026 draft may push the dates for homes to 2028; the state regulator sets the actual hours.
   - Show "run the washing machine at 1 pm, not 8 pm", with ₹ and kg saved.
10. **Weather-fair colour** (M)
    - A heat wave shouldn't alone turn a careful home Red.
    - Show "Red, but 70% of the jump is the heat" next to the colour.
    - Uses: the existing "heat vs habit" split on the AC & heat page.
11. **Scan the star label** (M)
    - Point the camera at an appliance's BEE star label or model number; we fill in yearly kWh, stars and type.
    - Uses: ML Kit text recognition (already bundled for barcodes in Dukaan) and the appliance list.
12. **Rooftop solar estimate from your own bill** (M)
    - Panel size from yearly units, roof area check, PM Surya Ghar subsidy, net-metered bill after solar, payback.
    - Uses: `Bill.exportKwh`, the scheme catalogue, What-if.
13. **EV or petrol, for your own trips** (S)
    - From the home's fuel logs: running cost and CO₂ of an e-scooter or EV, minus PM E-DRIVE support.
14. **Geyser and water pump insight** (S): winter geyser and motor-pump use, picked out of the bill and weather.
    It stays part of electricity, not a new category.

## C. Community and motivation

15. **Mohalla team challenge** (M)
    - Mohalla vs mohalla, or society vs society, for a month: per-person kg against the 100 kg allowance.
    - An RWA admin view to run it.
    - Uses: `challenge.service.ts`, `mohalla.service.ts`, the leaderboard.
16. **"12 of 20 homes joined" invite** (S)
    - Mohalla news and area numbers unlock at 20 homes for privacy.
    - Show the progress and a WhatsApp invite link.
17. **WhatsApp share card** (S)
    - An image card: colour, kg, "% of allowance", the mohalla's rank.
    - No personal details on it; the Carbon ID link opens the public passbook.
18. **Family jobs** (S)
    - Give the "one thing to do" to a family member, they tick it done, and the family keeps a shared streak.
19. **School eco-club mode** (M)
    - Students check their own home's bill each month; the class sees the total (never single homes).
    - Fits Mission LiFE and school eco clubs.
20. **Green home certificate** (S)
    - A monthly PDF certificate for Green months, with the verify QR that already exists (`/verify/[token]`).

## D. Money and government

21. **Scheme application tracker** (M)
    - Track applied → inspection → approved → subsidy received, with reminders and documents.
    - Uses: `SchemeHelp`, notifications.
22. **More schemes, state by state** (M)
    - Today there are 6 schemes. Add each state's discom AC-exchange, star-rated fan and LED programmes, and
      state EV subsidies.
    - Admin already keeps them "checked today".
23. **Green loan through a partner bank** (L)
    - The home shares its sealed months (already built) with a bank to get a lower rate on solar or a 5★ AC.
    - Next step: an Account Aggregator consent flow.
24. **Old appliance exchange** (M)
    - The shop takes the old AC or fridge at a discount; the item leaves the home's list with the removal flow
      that already exists.
25. **Mohalla tree drive, done honestly** (M)
    - Photos and a count of trees planted by the RWA.
    - Green Credit Programme credits come only after ICFRE checks two years later, and buyers are mostly
      companies. So this is a CSR-partner route, not household credits.

## E. Shop counter (Dukaan)

26. **Product compare sheet** (S): two models side by side (ten-year cost, CO₂, subsidy), sent to the buyer on
    WhatsApp or printed.
27. **Price after subsidy and EMI** (S): "₹42,000 − ₹X subsidy = ₹Y, or ₹Z a month".
28. **Green shops near me** (M): a map of shops with a high efficient-sales share, inside the Ghar app.
29. **Offline counter queue** (M): scans and registrations saved on the phone when the network drops, sent later.

## F. Admin and government desk

30. **Heat map v2** (M): month slider, electricity vs vehicles toggle, tap an area to open its trend.
31. **Area spike alerts** (S): tell the admin when a mohalla jumps much more than the weather explains.
32. **Bill photo checks** (M): catch the same bill uploaded twice, edited photos and impossible readings.
33. **Ward or district report** (M): a one-page PDF for municipal meetings (trend, top areas, scheme reach), built
    from the open data that already exists.

## G. Trust, speed and reliability

34. **Same-region hosting** (S)
    - Website functions run in Ohio, the database in Singapore, so every query crosses the world.
    - Move the website to Vercel Singapore (`sin1`), or the database to a Supabase project in Ohio.
    - Then add a 10-minute ping so the Render engine doesn't sleep.
35. **Play Store release + phone notifications (FCM)** (M): already on the roadmap slide.
36. **Error and uptime monitoring** (S): crash reports from the apps and a status check on the website and engine.
37. **Monthly statement in DigiLocker** (L): the sealed statement issued as a DigiLocker document. Needs issuer
    onboarding.
38. **Accessibility pass** (S): TalkBack labels on every button, tested at A++ text size, checked in Hindi.

---

## Already in the project (so not listed above)

- **Website for homes:** bill reading with AI fallback, AC calibration, forecast, What-if, insights, challenges,
  leaderboard, goals and check-ins.
- **Cards and identity:** Carbon ID and Carbon Card, sealed statements on chain, sharing with banks and RWAs.
- **Area and help:** mohalla, weather and AQI, scheme finder, grievances with ticket numbers, open data, the
  Partner AI helper, 22 languages.
- **Shops and admin:** shop counter with barcode scan, catalogue and sales; admin desk.
- **This week:** heat map, Consumer ID card, three native apps.

## Sources

- Smart meters: [T&D India, 7.24 crore installed (June 2026)](https://www.tndindia.com/indias-smart-meter-population-at-7-24-crore-parliament/amp/),
  [Energetica India, RDSS progress](https://www.energetica-india.net/news/indias-smart-meter-deployment-touches-528-crore-under-rdss),
  [Prayas, Smart metering in India](https://energy.prayaspune.org/power-perspectives/smart-metering-in-india-a-work-in-progress)
- Time-of-Day tariff: [Business Standard, 2023 rules](https://www.business-standard.com/india-news/consumers-can-save-upto-20-in-electricity-bills-with-new-power-tariff-rule-123062400201_1.html),
  [Energetica India, ToD amendment](https://www.energetica-india.net/news/government-amends-electricity-rules-and-introduces-tod-tariff),
  [Zerodha Daily Brief, 2026 draft dates](https://thedailybrief.zerodha.com/p/the-new-rules-of-paying-for-electricity)
- Bill fetch: [EnKash developer portal (BBPS / Bharat Connect)](https://docs.enkash.com/folder-2203030),
  [BBPS bill fetch guide](https://dev.to/munisekhar_udavapati/bbps-bill-fetch-api-a-complete-guide-3m8f)
- Voice: [Bhashini overview, eGov (2026)](https://egov.eletsonline.com/2026/03/bhashini-bridging-1-4-billion-citizens-to-services-and-opportunities-via-language-ai/)
- Green Credit Programme: [CEEW explainer](https://www.ceew.in/gfc/quick-reads/explains/gcp)
