import type { NextConfig } from "next";

// The FastAPI engine (backend/) serves calibration, decomposition, simulation and statements.
// The browser calls /py/... and Next proxies it, so no CORS setup is needed in the UI.
const PY_API_URL = process.env.PY_API_URL ?? "http://127.0.0.1:8001";

const isProd = process.env.NODE_ENV === "production";
const httpsOnly = isProd && process.env.COOKIE_INSECURE !== "1"; // a local production run over http keeps working
// No third-party scripts at all. 'unsafe-inline' scripts are needed by Next's hydration without nonces; the
// dev server also needs eval and websockets. Map tiles come from OpenStreetMap, CARTO and Esri; product photos from
// Supabase Storage; Google is only a redirect target.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(httpsOnly ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera: the card reader scans barcodes; geolocation: "I am at home now" on the Mohalla page
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  // Separate build folders let a second server (e.g. a verification run) coexist with `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  poweredByHeader: false,
  // Pages renamed to plain words; old links keep working
  async redirects() {
    return [
      { source: "/carbon-twin", destination: "/carbon-id", permanent: false },
      { source: "/compare", destination: "/leaderboard", permanent: false },
      { source: "/verify", destination: "/proof", permanent: false },
      { source: "/plan", destination: "/insights", permanent: false },
      { source: "/reader", destination: "/admin/reader", permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/py/:path*", destination: `${PY_API_URL}/:path*` }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // the service worker must update promptly on phones
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
