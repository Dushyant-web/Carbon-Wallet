/**
 * Published emission figures for India, Uttar Pradesh and Noida, with where each comes from. They cover the whole
 * economy (power plants, industry, farming, transport…), so they are context for a home's numbers, never mixed in.
 * Carbon Wallet's own totals cover only what a home burns directly: its electricity, cooking gas and vehicles.
 * Checked 26 Oct 2026.
 */
export type OfficialFigure = {
  key: "INDIA" | "UP" | "NOIDA" | "GHAZIABAD";
  name: string;
  nameHi: string;
  perCapitaT: number; // tonnes CO₂(e) per person per year
  year: number;
  scope: string;
  totalMt?: number;
  source: string;
  url: string;
  caveat?: string;
};

export const OFFICIAL: Record<OfficialFigure["key"], OfficialFigure> = {
  INDIA: {
    key: "INDIA",
    name: "India",
    nameHi: "भारत",
    perCapitaT: 2.2,
    year: 2024,
    scope: "fossil CO₂ emitted inside India, per person",
    totalMt: 3190,
    source: "Our World in Data, from the Global Carbon Budget",
    url: "https://ourworldindata.org/co2/country/india",
  },
  UP: {
    key: "UP",
    name: "Uttar Pradesh",
    nameHi: "उत्तर प्रदेश",
    perCapitaT: 1.32,
    year: 2018,
    scope: "all greenhouse gases, whole state economy, per person",
    totalMt: 292.5,
    source: "GHG Platform India, state trend analysis 2005–2018 (Sept 2022)",
    url: "https://www.ghgplatform-india.org/wp-content/uploads/2022/09/GHGPI_Trend-Analysis_2005-to-2018_Uttar-Pradesh_Sept22.pdf",
    caveat: "Uttar Pradesh was 9.91% of India's emissions; India's per-person figure on the same basis was 2.24 t.",
  },
  NOIDA: {
    key: "NOIDA",
    name: "Noida",
    nameHi: "नोएडा",
    perCapitaT: 2.21,
    year: 2013,
    scope: "carbon footprint of what residents consume, per person",
    source: "Moran et al. (2018), “Carbon footprints of 13,000 cities”, Environmental Research Letters",
    url: "https://doi.org/10.1088/1748-9326/aac72a",
    caveat: "Taken from a listing of the study's city data; the study models consumption, so it isn't a city inventory.",
  },
  GHAZIABAD: {
    key: "GHAZIABAD",
    name: "Ghaziabad",
    nameHi: "गाज़ियाबाद",
    perCapitaT: 1.83,
    year: 2013,
    scope: "carbon footprint of what residents consume, per person",
    source: "Moran et al. (2018), “Carbon footprints of 13,000 cities”, Environmental Research Letters",
    url: "https://doi.org/10.1088/1748-9326/aac72a",
  },
};

/** India's national inventory: the total and where it comes from (BUR-4, year 2020). */
export const INDIA_INVENTORY = {
  year: 2020,
  totalMt: 2959,
  netWithForestsMt: 2437,
  sectorsPct: [
    { en: "Energy (power, transport, buildings, industry fuel)", hi: "ऊर्जा (बिजली, परिवहन, भवन, उद्योग ईंधन)", pct: 75.66 },
    { en: "Agriculture", hi: "कृषि", pct: 13.72 },
    { en: "Industrial processes", hi: "औद्योगिक प्रक्रियाएँ", pct: 8.06 },
    { en: "Waste", hi: "कचरा", pct: 2.56 },
  ],
  source: "India's Fourth Biennial Update Report to the UNFCCC (submitted 30 Dec 2024)",
  url: "https://www.outlookbusiness.com/economy-and-policy/india-cut-gdp-emission-intensity-by-36-during-2005-2020-govt-report",
};

/** kg per person per month, to sit next to the app's monthly numbers */
export const monthlyKg = (tonnesPerYear: number) => Math.round((tonnesPerYear * 1000) / 12);

/** The official figure most relevant to a place: its city if we have one, else its state, else India. */
export function officialFor(city: string, state: string): OfficialFigure[] {
  const c = city.toLowerCase();
  const out: OfficialFigure[] = [];
  if (c.includes("noida")) out.push(OFFICIAL.NOIDA);
  if (c.includes("ghaziabad")) out.push(OFFICIAL.GHAZIABAD);
  if (state === "UP" || /uttar/i.test(state)) out.push(OFFICIAL.UP);
  out.push(OFFICIAL.INDIA);
  return out;
}
