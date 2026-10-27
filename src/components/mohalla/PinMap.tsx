"use client";

import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { createMap } from "@/components/map/baseMap";

/**
 * OpenStreetMap with one draggable pin. Tap the map or drag the pin onto your home.
 * Leaflet loads only in the browser, only when this map is shown.
 */
export function PinMap({ center, onMove, label }: { center: { lat: number; lng: number }; onMove: (p: { lat: number; lng: number }) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current) return;
      const m = createMap(L, box.current, {
        fit: (mm) => mm.setView([centerRef.current.lat, centerRef.current.lng], 16),
        labels: { recentre: "Back to the pin", fullscreen: "Full screen" },
        minZoom: 5,
      });
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#B4532F;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const p = L.marker([center.lat, center.lng], { draggable: true, icon, keyboard: true, title: label }).addTo(m);
      p.on("dragend", () => {
        const ll = p.getLatLng();
        moveRef.current({ lat: ll.lat, lng: ll.lng });
      });
      m.on("click", (e) => {
        p.setLatLng(e.latlng);
        moveRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.current = m;
      pin.current = p;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // the map is created once; later centre changes are applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current && pin.current) {
      map.current.setView([center.lat, center.lng], 16);
      pin.current.setLatLng([center.lat, center.lng]);
    }
  }, [center.lat, center.lng]);

  return <div ref={box} className="relative isolate z-0 h-[320px] w-full border border-border" role="application" aria-label={label} />;
}
