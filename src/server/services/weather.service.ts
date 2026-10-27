import { cellToLatLng } from "h3-js";
import { db } from "@/server/db";

/*
 * Weather and air quality per H3 resolution-7 cell (about 5 km², shared by many mohallas), from Open-Meteo
 * (free for non-commercial use; this is a hackathon project). Cached for an hour in `weather_cells`, so pages
 * read the cache and the outside API is called at most once an hour per area. WEATHER_DISABLED=1 turns it off (tests).
 */

const FRESH_MS = 60 * 60_000;
const TIMEOUT_MS = 4000;

export type AqiBand = "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very poor" | "Severe";
export type Weather = {
  fetchedAt: string;
  now: { tempC: number; feelsC: number; humidity: number; code: number } | null;
  days: { date: string; maxC: number; minC: number; feelsMaxC: number; rainPct: number | null; code: number }[];
  air: { pm25: number | null; pm10: number | null; aqi: number | null; band: AqiBand | null } | null;
  source: string;
};

// CPCB National AQI breakpoints (sub-index ranges), for PM2.5 and PM10 in µg/m³
const PM25: [number, number, number, number][] = [
  [0, 30, 0, 50], [31, 60, 51, 100], [61, 90, 101, 200], [91, 120, 201, 300], [121, 250, 301, 400], [251, 500, 401, 500],
];
const PM10: [number, number, number, number][] = [
  [0, 50, 0, 50], [51, 100, 51, 100], [101, 250, 101, 200], [251, 350, 201, 300], [351, 430, 301, 400], [431, 600, 401, 500],
];
function subIndex(c: number, table: [number, number, number, number][]) {
  const v = Math.round(c);
  const row = table.find(([lo, hi]) => v >= lo && v <= hi) ?? table[table.length - 1];
  const [lo, hi, ilo, ihi] = row;
  return Math.min(500, Math.round(((ihi - ilo) / (hi - lo)) * (Math.min(v, hi) - lo) + ilo));
}
export function indianAqi(pm25: number | null, pm10: number | null): { aqi: number | null; band: AqiBand | null } {
  const subs = [pm25 !== null ? subIndex(pm25, PM25) : null, pm10 !== null ? subIndex(pm10, PM10) : null].filter((x): x is number => x !== null);
  if (!subs.length) return { aqi: null, band: null };
  const aqi = Math.max(...subs);
  const band: AqiBand = aqi <= 50 ? "Good" : aqi <= 100 ? "Satisfactory" : aqi <= 200 ? "Moderate" : aqi <= 300 ? "Poor" : aqi <= 400 ? "Very poor" : "Severe";
  return { aqi, band };
}

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return res.json();
}

async function fetchCell(h3Area: string): Promise<Weather> {
  const [lat, lng] = cellToLatLng(h3Area);
  const q = `latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&timezone=Asia%2FKolkata`;
  const [fc, aq] = await Promise.all([
    getJson(
      `https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code` +
        `&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,weather_code&forecast_days=7`,
    ),
    getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm2_5,pm10`).catch(() => null),
  ]);
  const d = fc.daily ?? {};
  const days = (d.time ?? []).map((date: string, i: number) => ({
    date,
    maxC: d.temperature_2m_max?.[i],
    minC: d.temperature_2m_min?.[i],
    feelsMaxC: d.apparent_temperature_max?.[i],
    rainPct: d.precipitation_probability_max?.[i] ?? null,
    code: d.weather_code?.[i] ?? 0,
  }));
  const pm25 = aq?.current?.pm2_5 ?? null;
  const pm10 = aq?.current?.pm10 ?? null;
  return {
    fetchedAt: new Date().toISOString(),
    now: fc.current
      ? { tempC: fc.current.temperature_2m, feelsC: fc.current.apparent_temperature, humidity: fc.current.relative_humidity_2m, code: fc.current.weather_code }
      : null,
    days,
    air: aq ? { pm25, pm10, ...indianAqi(pm25, pm10) } : null,
    source: "Open-Meteo forecast and air quality (CAMS); Indian AQI worked out from PM2.5 and PM10 with CPCB breakpoints",
  };
}

/** Cached weather for an area: fresh from the cache, refreshed when older than an hour, stale if the API is down. */
export async function weatherFor(h3Area: string): Promise<Weather | null> {
  const cached = await db.weatherCell.findUnique({ where: { h3Area } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < FRESH_MS) return JSON.parse(cached.payload) as Weather;
  if (process.env.WEATHER_DISABLED === "1") return cached ? (JSON.parse(cached.payload) as Weather) : null;
  try {
    const w = await fetchCell(h3Area);
    await db.weatherCell.upsert({
      where: { h3Area },
      create: { h3Area, payload: JSON.stringify(w), fetchedAt: new Date() },
      update: { payload: JSON.stringify(w), fetchedAt: new Date() },
    });
    return w;
  } catch {
    return cached ? (JSON.parse(cached.payload) as Weather) : null;
  }
}

/** IMD calls it a heatwave in the plains from 40 °C (with a big jump over normal), and always from 45 °C. */
export function heatLevel(maxC: number): "NONE" | "HOT" | "SEVERE" {
  return maxC >= 45 ? "SEVERE" : maxC >= 40 ? "HOT" : "NONE";
}
