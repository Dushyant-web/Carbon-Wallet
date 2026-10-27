"use client";

import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { createMap } from "@/components/map/baseMap";
import type { HeatArea } from "@/server/services/heatmap.service";

/** Light to dark terracotta: more carbon per person, darker area. */
export const HEAT_COLOURS = ["#F3E3D6", "#E9C3A6", "#D9946E", "#C06B47", "#933A21"];

/** The colour step for a value, spread evenly between the lowest and highest area shown. */
export function heatStep(kg: number, min: number, max: number) {
  if (max <= min) return 2;
  return Math.min(HEAT_COLOURS.length - 1, Math.floor(((kg - min) / (max - min)) * HEAT_COLOURS.length));
}

export function HeatMapView({
  areas,
  labels,
}: {
  areas: HeatArea[];
  labels: { aria: string; recentre: string; fullscreen: string; low: string; high: string; perPerson: string; homes: string };
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current || !areas.length) return;
      const values = areas.map((a) => a.kgPerPerson);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const layers = areas.flatMap((a) => {
        const fill = HEAT_COLOURS[heatStep(a.kgPerPerson, min, max)];
        const tip = `<strong>${a.name}</strong><br/>${Math.round(a.kgPerPerson * 10) / 10} kg ${labels.perPerson} · ${a.homes} ${labels.homes}`;
        const points = a.outline.flat();
        const centre: [number, number] = [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
        return [
          // a mohalla is about a kilometre across: the outline shows when zoomed in, the dot at every zoom
          ...a.outline.map((ring) => L.polygon(ring, { color: "#5F594E", weight: 1, fillColor: fill, fillOpacity: 0.85 }).bindTooltip(tip, { sticky: true })),
          L.circleMarker(centre, { radius: 9, color: "#2F2C26", weight: 1, fillColor: fill, fillOpacity: 0.95 }).bindTooltip(tip),
        ];
      });
      const group = L.featureGroup(layers);
      map.current = createMap(L, box.current, {
        minZoom: 4,
        fit: (m) => m.fitBounds(group.getBounds().pad(0.1)),
        labels: {
          recentre: labels.recentre,
          fullscreen: labels.fullscreen,
          legend: [
            [HEAT_COLOURS[0], labels.low],
            [HEAT_COLOURS[HEAT_COLOURS.length - 1], labels.high],
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
  }, [areas]);

  return <div ref={box} className="relative isolate z-0 h-[460px] w-full border border-ink/20" role="img" aria-label={labels.aria} />;
}
