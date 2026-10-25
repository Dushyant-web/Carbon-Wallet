import type { NextConfig } from "next";

// The FastAPI engine (backend/) serves calibration, decomposition, simulation and statements.
// The browser calls /py/... and Next proxies it, so no CORS setup is needed in the UI.
const PY_API_URL = process.env.PY_API_URL ?? "http://127.0.0.1:8001";

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera=(self): the card reader scans barcodes with the device camera
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
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
