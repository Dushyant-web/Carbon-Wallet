/*
 * The real numbers the simulated homes are built from. Each state's (or India's) home electricity in a year,
 * divided by its homes, gives the average a simulated home in that state uses; the homes then vary around it, and
 * across the year with the real weather at their city. "basis" says how solid each number is.
 */

export type Anchor = { kwhPerHomeMonth: number; basis: "measured" | "derived" | "national proxy"; source: string };

const NATIONAL: Anchor = {
  kwhPerHomeMonth: 110,
  basis: "national proxy",
  source:
    "India: 408,515 GWh of residential electricity in FY2024-25 (provisional; MoSPI Energy Statistics India 2026, Table 6.8, from CEA) ÷ about 31 crore households (Census 2011's 24.9 crore grown to 2025; estimate) ≈ 110 kWh a home a month. No state figure was found for this state.",
};

export const ANCHORS: Record<string, Anchor> = {
  DL: {
    kwhPerHomeMonth: 247,
    basis: "derived",
    source:
      "Delhi: 32,319 MU consumed in FY2024, 56% by homes = 18,099 MU (IEEFA 2026, from the India Climate & Energy Dashboard) ÷ about 6.1 million domestic consumers (7.36 million consumers in 2024-25, ~83% domestic per Delhi's Power Department) ≈ 247 kWh a home a month.",
  },
  KA: {
    kwhPerHomeMonth: 68,
    basis: "measured",
    source: "Karnataka: 16,089 MU of household electricity in 2023-24 ÷ 1.98 crore households served by the ESCOMs (Deccan Herald, Aug 2024) ≈ 68 kWh a home a month.",
  },
  WB: {
    kwhPerHomeMonth: 63,
    basis: "derived",
    source:
      "West Bengal (WBSEDCL, which serves Salt Lake): 35,697 MU sold in 2022-23, 41.5% to homes = 14,815 MU ÷ about 19.7 million domestic consumers (22.29 million consumers in Mar 2023 × the 88% domestic share of 2020-21) ≈ 63 kWh a home a month.",
  },
  MH: {
    kwhPerHomeMonth: 95,
    basis: "derived",
    source:
      "Maharashtra (MSEDCL): 24,522 MU of residential sales in FY2023-24 (MSEDCL reply to MERC data gaps, Jan 2025) ÷ about 21.4 million residential consumers outside Mumbai's own utilities (CEIC: 25.7 million domestic consumers in the state, minus an estimated 4.3 million served by AEML, BEST and Tata Power) ≈ 95 kWh a home a month.",
  },
  UP: NATIONAL,
  HR: NATIONAL,
  RJ: NATIONAL,
  TN: NATIONAL,
};

/** Every second year is scaled down by India's residential growth that year (FY2024-25: +10.69%, same table). */
export const YEARLY_GROWTH = 1.1069;

export const LPG_KG_PER_HOME_MONTH = {
  value: 5.9,
  source:
    "25.90 MMT of LPG used in India in Apr 2024 – Mar 2025 (PPAC), ~90% for household cooking (CareEdge 2025), over ~33 crore domestic connections (PPAC / CareEdge) ≈ 70 kg a year ≈ 5.9 kg a month per home.",
};

export const VEHICLES = {
  carShare: { value: 0.08, source: "NFHS-5 (2019-21): about 8% of Indian households own a car." },
  twoWheelerShare: {
    byState: { DL: 0.531, KA: 0.611, MH: 0.539 } as Record<string, number>,
    national: 0.497,
    source: "NFHS-5 (2019-21) via Rushlane: households with a scooter or motorcycle — Delhi 53.1%, Karnataka 61.1%, Maharashtra 53.9%, India 49.7%.",
  },
  // no source found: typical use, kept modest and labelled as an assumption
  carKmPerMonth: 830,
  twoWheelerKmPerMonth: 500,
  usageNote: "Assumption (no national survey found): a private car runs about 10,000 km a year, a scooter or motorcycle about 6,000 km.",
};

export const WASTE = {
  kgPerPersonDay: 0.35,
  source: "CPCB Annual Report 2020-21: 1,60,038.9 tonnes of municipal solid waste a day, over roughly 46 crore urban residents (estimate) ≈ 0.35 kg a person a day.",
};

export const SOURCES_NOTE =
  "Simulated homes on real ground. Their electricity averages each state's real home electricity ÷ its homes, and varies month by month with the real ERA5 weather at the city. Names are made up.";
