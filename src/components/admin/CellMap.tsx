"use client";

import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { createMap } from "@/components/map/baseMap";

export type Cell = {
  cell: string;
  ring: [number, number][];
  status: "GREEN" | "AMBER" | "RED" | "NONE";
  name: string;
  carbonId: string | null;
  people: number;
  kgPerPerson: number | null;
};
const FILL = { GREEN: "#3F6B4E", AMBER: "#B7862B", RED: "#A3362A", NONE: "#8F897D" } as const;
const WORD = { GREEN: "Green", AMBER: "Amber", RED: "Red", NONE: "No data" } as const;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Admin view of one mohalla: each home as its own ~120 m hexagon, coloured by status; click opens the home. */
export function CellMap({ cells, outline, center }: { cells: Cell[]; outline: [number, number][][]; center: [number, number] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitRef = useRef<(m: LeafletMap) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current) return;
      const g = L.featureGroup();
      for (const ring of outline) L.polygon(ring, { color: "#12284C", weight: 2, dashArray: "6 4", fill: false }).addTo(g);
      for (const c of cells) {
        const html = `<strong>${esc(c.name)}</strong><br/>${c.carbonId ? `${esc(c.carbonId)} · ` : ""}${c.people} people<br/>${WORD[c.status]}${c.kgPerPerson !== null ? ` · ${c.kgPerPerson} kg/person` : ""}`;
        L.polygon(c.ring, { color: FILL[c.status], weight: 1, fillColor: FILL[c.status], fillOpacity: 0.65 })
          .bindTooltip(html, { sticky: true })
          .on("click", () => {
            window.location.href = `/admin/households?q=${encodeURIComponent(c.name)}`;
          })
          .addTo(g);
      }
      fitRef.current = (m) => (cells.length ? m.fitBounds(g.getBounds().pad(0.2)) : m.setView(center, 14));
      if (!map.current) {
        map.current = createMap(L, box.current, {
          fit: (m) => fitRef.current(m),
          labels: {
            recentre: "Back to the mohalla",
            fullscreen: "Full screen",
            legend: [
              [FILL.GREEN, "Green: below 90% of state average"],
              [FILL.AMBER, "Amber: 90–110%"],
              [FILL.RED, "Red: above 110%"],
              [FILL.NONE, "No data this month"],
            ],
          },
        });
      } else {
        fitRef.current(map.current);
      }
      layer.current?.remove();
      g.addTo(map.current);
      layer.current = g;
    })();
    return () => {
      cancelled = true;
    };
  }, [cells, outline, center]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={box} className="relative isolate z-0 h-[460px] w-full border border-border" role="img" aria-label="Map of the mohalla's homes, coloured by carbon status" />;
}
