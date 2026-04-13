import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";

// ── Constants ───────────────────────────────────────────────────────────────
export const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

// ── Vertex Icon ─────────────────────────────────────────────────────────────
export const vertexIcon = new L.DivIcon({
  className: "custom-vertex-icon",
  html: `<div style="width:14px;height:14px;background:#0ea5e9;border:2px solid white;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// ── Area Calculation ─────────────────────────────────────────────────────────
export const calculateArea = (polygon: [number, number][]): number => {
  if (polygon.length < 3) return 0;
  const R = 6371000; // Earth radius in metres
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = polygon[i];
    const [lng2, lat2] = polygon[(i + 1) % n];
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    area += (dLng * (2 + Math.sin(phi1) + Math.sin(phi2)));
  }
  return Math.abs((area * R * R) / 2);
};

export const formatArea = (area_m2: number): string => {
  if (area_m2 >= 10_000) return `${(area_m2 / 10_000).toFixed(2)} ha`;
  return `${Math.round(area_m2).toLocaleString()} m²`;
};

type XYPoint = { x: number; y: number };
const EPS = 1e-10;

const toXYFromLatLng = (pt: [number, number]): XYPoint => ({ x: pt[1], y: pt[0] });

const orientation = (a: XYPoint, b: XYPoint, c: XYPoint): number => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < EPS) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (a: XYPoint, b: XYPoint, c: XYPoint): boolean =>
  Math.min(a.x, c.x) - EPS <= b.x &&
  b.x <= Math.max(a.x, c.x) + EPS &&
  Math.min(a.y, c.y) - EPS <= b.y &&
  b.y <= Math.max(a.y, c.y) + EPS;

const segmentsIntersect = (p1: XYPoint, q1: XYPoint, p2: XYPoint, q2: XYPoint): boolean => {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
};

export const wouldSelfIntersectOnAdd = (
  draftPoints: [number, number][],
  candidatePoint: [number, number]
): boolean => {
  if (draftPoints.length < 2) return false;
  const start = toXYFromLatLng(draftPoints[draftPoints.length - 1]);
  const end = toXYFromLatLng(candidatePoint);

  for (let i = 0; i < draftPoints.length - 2; i++) {
    const segA = toXYFromLatLng(draftPoints[i]);
    const segB = toXYFromLatLng(draftPoints[i + 1]);
    if (segmentsIntersect(segA, segB, start, end)) return true;
  }
  return false;
};

export const wouldSelfIntersectOnClose = (draftPoints: [number, number][]): boolean => {
  if (draftPoints.length < 3) return false;
  const start = toXYFromLatLng(draftPoints[draftPoints.length - 1]);
  const end = toXYFromLatLng(draftPoints[0]);
  for (let i = 1; i < draftPoints.length - 2; i++) {
    const segA = toXYFromLatLng(draftPoints[i]);
    const segB = toXYFromLatLng(draftPoints[i + 1]);
    if (segmentsIntersect(segA, segB, start, end)) return true;
  }
  return false;
};

export const isSelfIntersectingPolygon = (polygonLatLng: [number, number][]): boolean => {
  if (polygonLatLng.length < 4) return false;
  const n = polygonLatLng.length;
  for (let i = 0; i < n; i++) {
    const a1 = toXYFromLatLng(polygonLatLng[i]);
    const a2 = toXYFromLatLng(polygonLatLng[(i + 1) % n]);
    for (let j = i + 1; j < n; j++) {
      const areAdjacent =
        i === j ||
        (i + 1) % n === j ||
        i === (j + 1) % n;
      if (areAdjacent) continue;
      const b1 = toXYFromLatLng(polygonLatLng[j]);
      const b2 = toXYFromLatLng(polygonLatLng[(j + 1) % n]);
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
};

// ── FitMapToPoints ───────────────────────────────────────────────────────────
export const FitMapToPoints = ({
  points,
  fallbackZoom = 12,
  maxZoom = 16,
}: {
  points: [number, number][];
  fallbackZoom?: number;
  maxZoom?: number;
}) => {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [36, 36], maxZoom });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], Math.min(maxZoom, 15));
      return;
    }
    map.setView(DUBAI_CENTER, fallbackZoom);
  }, [fallbackZoom, map, maxZoom, points]);
  return null;
};

// ── MapDrawingHandler ────────────────────────────────────────────────────────
interface MapDrawingHandlerProps {
  mapMode: "idle" | "draw" | "edit";
  draftPoints: [number, number][];
  onAddPoint: (latlng: L.LatLng) => void;
  onFinishDrawing: () => void;
  onInvalidDraw?: (message: string) => void;
}

export function MapDrawingHandler({
  mapMode,
  draftPoints,
  onAddPoint,
  onFinishDrawing,
  onInvalidDraw,
}: MapDrawingHandlerProps) {
  const [cursorPoint, setCursorPoint] = useState<[number, number] | null>(null);
  const previewLineRef = useRef<L.Polyline | null>(null);
  const map = useMapEvents({
    click(e) {
      if (mapMode === "draw") {
        if (draftPoints.length >= 2) {
          const firstPt = L.latLng(draftPoints[0][0], draftPoints[0][1]);
          const clickPt = map.latLngToContainerPoint(e.latlng);
          const startPt = map.latLngToContainerPoint(firstPt);
          if (clickPt.distanceTo(startPt) < 25) {
            if (wouldSelfIntersectOnClose(draftPoints)) {
              onInvalidDraw?.("Polygon cannot cross over itself.");
              return;
            }
            onFinishDrawing();
            return;
          }
        }
        if (wouldSelfIntersectOnAdd(draftPoints, [e.latlng.lat, e.latlng.lng])) {
          onInvalidDraw?.("Polygon cannot cross over itself.");
          return;
        }
        onAddPoint(e.latlng);
      }
    },
    mousemove(e) {
      if (mapMode !== "draw" || draftPoints.length === 0) {
        setCursorPoint(null);
        return;
      }
      setCursorPoint([e.latlng.lat, e.latlng.lng]);
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    if (mapMode === "draw") {
      container.style.cursor = "crosshair";
      map.dragging.enable();
    } else if (mapMode === "edit") {
      container.style.cursor = "grab";
      map.dragging.enable();
    } else {
      container.style.cursor = "";
      map.dragging.enable();
      setCursorPoint(null);
    }
    return () => {
      container.style.cursor = "";
      map.dragging.enable();
      setCursorPoint(null);
    };
  }, [mapMode, map]);

  useEffect(() => {
    if (previewLineRef.current) {
      map.removeLayer(previewLineRef.current);
      previewLineRef.current = null;
    }
    if (mapMode !== "draw" || draftPoints.length === 0 || !cursorPoint) return;
    const segment: [number, number][] = [draftPoints[draftPoints.length - 1], cursorPoint];
    previewLineRef.current = L.polyline(segment, {
      color: "#0ea5e9",
      weight: 2,
      dashArray: "6, 6",
      opacity: 0.95,
    }).addTo(map);
    return () => {
      if (previewLineRef.current) {
        map.removeLayer(previewLineRef.current);
        previewLineRef.current = null;
      }
    };
  }, [cursorPoint, draftPoints, map, mapMode]);

  return null;
}
