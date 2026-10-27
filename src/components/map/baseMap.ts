import type * as Leaflet from "leaflet";

/*
 * One look and one set of controls for every map in the app:
 *   - three base maps to switch between: Map (OpenStreetMap), Light (CARTO) and Satellite (Esri World Imagery);
 *   - zoom, a metric scale bar, "back to the area" and full-screen buttons, and an optional legend;
 *   - the mouse wheel zooms only after the map is clicked, so scrolling the page never gets stuck in a map.
 * All three tile services are free for non-commercial use with the attribution shown on the map.
 */

type L = typeof Leaflet;

export function baseLayers(L: L) {
  return {
    Map: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
    Light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }),
    Satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    }),
  };
}

const ICON = {
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  full: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};

function button(L: L, html: string, title: string, onClick: () => void) {
  const b = L.DomUtil.create("button", "cw-map-btn") as HTMLButtonElement;
  b.type = "button";
  b.innerHTML = html;
  b.title = title;
  b.setAttribute("aria-label", title);
  L.DomEvent.disableClickPropagation(b);
  L.DomEvent.on(b, "click", (e) => {
    L.DomEvent.stop(e);
    onClick();
  });
  return b;
}

export type MapLabels = { recentre: string; fullscreen: string; legend?: [string, string][] };

/** Creates a map in `el` with the shared base maps and controls. `fit` is called now and by the recentre button. */
export function createMap(L: L, el: HTMLElement, opts: { fit: (m: Leaflet.Map) => void; labels: MapLabels; minZoom?: number; base?: "Map" | "Light" | "Satellite" }) {
  const map = L.map(el, { zoomControl: true, minZoom: opts.minZoom ?? 11, maxZoom: 19, scrollWheelZoom: false });
  const layers = baseLayers(L);
  layers[opts.base ?? "Map"].addTo(map);
  L.control.layers(layers, undefined, { position: "topright", collapsed: true }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  const Tools = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create("div", "leaflet-bar cw-map-tools");
      box.appendChild(button(L, ICON.home, opts.labels.recentre, () => opts.fit(map)));
      box.appendChild(
        button(L, ICON.full, opts.labels.fullscreen, () => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void el.requestFullscreen?.();
        }),
      );
      return box;
    },
  });
  new Tools({ position: "topleft" }).addTo(map);

  if (opts.labels.legend?.length) {
    const Legend = L.Control.extend({
      onAdd() {
        const box = L.DomUtil.create("div", "cw-map-legend");
        box.innerHTML = opts.labels.legend!.map(([color, text]) => `<span><i style="background:${color}"></i>${text}</span>`).join("");
        return box;
      },
    });
    new Legend({ position: "bottomright" }).addTo(map);
  }

  // the wheel zooms only once the map has been clicked; leaving the map gives the page its scroll back
  map.on("click focus", () => map.scrollWheelZoom.enable());
  map.on("mouseout blur", () => map.scrollWheelZoom.disable());
  document.addEventListener("fullscreenchange", () => setTimeout(() => map.invalidateSize(), 50));

  opts.fit(map);
  return map;
}
