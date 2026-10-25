import type { MetadataRoute } from "next";

/** Lets phones install Carbon Wallet to the home screen; it opens straight to Home, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Carbon Wallet",
    short_name: "Carbon Wallet",
    description: "Your home's carbon, from the bills you already pay.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#1F3327",
    orientation: "portrait",
    categories: ["lifestyle", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Weekly check-in", url: "/check-in", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Add a bill", url: "/bills/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
