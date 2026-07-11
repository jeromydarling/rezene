import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * The shared map. Mapbox GL with the house style, markers with popups, and
 * bounds that fit whatever you hand it. The library itself (~1.9MB) is
 * dynamically imported so pages without a visible map never pay for it.
 */
import { MAPBOX_TOKEN, MAPBOX_STYLE } from "../lib/mapboxToken";

export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  /** Dot colour; defaults to the house navy. */
  color?: string;
  /** Popup title (plain text). */
  label: string;
  /** Popup second line (plain text). */
  sublabel?: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function MapboxMap({
  markers,
  className = "h-96",
  onMarkerClick,
}: {
  markers: MapMarker[];
  className?: string;
  onMarkerClick?: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRefs = useRef<any[]>([]);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !container.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: container.current,
        style: MAPBOX_STYLE,
        center: [0, 25],
        zoom: 1.4,
        attributionControl: false,
        cooperativeGestures: true,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }));
      mapRef.current = map;
      syncMarkers(mapboxgl, map);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncMarkers = (mapboxgl: any, map: any) => {
    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];
    const pts = markers.filter((m) => Number.isFinite(m.lng) && Number.isFinite(m.lat));
    for (const m of pts) {
      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="font:500 13px/1.35 system-ui"><div>${esc(m.label)}</div>${
          m.sublabel ? `<div style="font-weight:400;opacity:.65">${esc(m.sublabel)}</div>` : ""
        }</div>`,
      );
      const marker = new mapboxgl.Marker({ color: m.color ?? "#1f2a44", scale: 0.85 })
        .setLngLat([m.lng, m.lat])
        .setPopup(popup)
        .addTo(map);
      marker.getElement().style.cursor = "pointer";
      marker.getElement().addEventListener("click", () => clickRef.current?.(m.id));
      markerRefs.current.push(marker);
    }
    if (pts.length > 0) {
      const b = new mapboxgl.LngLatBounds();
      pts.forEach((m) => b.extend([m.lng, m.lat]));
      map.fitBounds(b, { padding: 60, maxZoom: 9, duration: 0 });
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (mapRef.current) syncMarkers(mapboxgl, mapRef.current);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return <div ref={container} className={`w-full overflow-hidden rounded-xl ${className}`} />;
}

/** A map over records that carry TEXT locations (city/country strings):
 *  geocodes each query client-side (cached per browser) and pins what
 *  resolves. Renders nothing while resolving an empty set. */
export function GeoTextMap({
  points,
  className = "h-96",
  onMarkerClick,
}: {
  points: { id: string; query: string; label: string; sublabel?: string; color?: string }[];
  className?: string;
  onMarkerClick?: (id: string) => void;
}) {
  const [markers, setMarkers] = useState<MapMarker[] | null>(null);
  const key = points.map((p) => `${p.id}:${p.query}`).join("|");
  useEffect(() => {
    let live = true;
    (async () => {
      const { geocodeAll } = await import("../lib/geocode");
      const coords = await geocodeAll(points.map((p) => p.query));
      if (!live) return;
      setMarkers(
        points.flatMap((p) => {
          const co = coords.get(p.query.trim());
          if (!co) return [];
          return [{ id: p.id, lng: co[0], lat: co[1], label: p.label, sublabel: p.sublabel, color: p.color }];
        }),
      );
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!markers || markers.length === 0) return null;
  return <MapboxMap markers={markers} className={className} onMarkerClick={onMarkerClick} />;
}
