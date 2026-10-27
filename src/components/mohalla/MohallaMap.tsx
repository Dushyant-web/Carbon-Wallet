"use client";

import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { createMap } from "@/components/map/baseMap";

export type MohallaMapData = { home: [number, number][]; center: [number, number]; outline: [number, number][][]; weatherPoint: [number, number] };

/**
 * The mohalla on the map: its outline (drawn from groups of homes, never single houses), your own small
 * hexagon, and the point the weather is read for. Street level only, so no national borders are drawn.
 */
export function MohallaMap({
  data,
  labels,
}: {
  data: MohallaMapData;
  labels: { home: string; mohalla: string; weather: string; aria: string; recentre: string; fullscreen: string };
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current) return;
      const layers: L.Layer[] = [];
      for (const ring of data.outline) {
        layers.push(L.polygon(ring, { color: "#12284C", weight: 2, fillColor: "#1F4E8C", fillOpacity: 0.12, dashArray: "6 4" }).bindTooltip(labels.mohalla, { sticky: true }));
      }
      layers.push(L.polygon(data.home, { color: "#F28C28", weight: 3, fillColor: "#F28C28", fillOpacity: 0.45 }).bindTooltip(labels.home, { permanent: true, direction: "top", className: "cw-map-label" }));
      layers.push(L.circleMarker(data.weatherPoint, { radius: 6, color: "#138808", weight: 2, fillColor: "#FFFFFF", fillOpacity: 1 }).bindTooltip(labels.weather));
      const group = L.featureGroup(layers);
      map.current = createMap(L, box.current, {
        fit: (m) => m.fitBounds(group.getBounds().pad(0.15)),
        labels: {
          recentre: labels.recentre,
          fullscreen: labels.fullscreen,
          legend: [
            ["#F28C28", labels.home],
            ["#1F4E8C", labels.mohalla],
            ["#138808", labels.weather],
          ],
        },
      });
      group.addTo(map.current);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // drawn once per page view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={box} className="relative isolate z-0 h-[380px] w-full border border-ink/20" role="img" aria-label={labels.aria} />;
}
