"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import type { TafelMode, TafelStroke } from "@/lib/surface-modes/tafel";

interface TafelCanvasProps {
  mode: TafelMode;
  width: number;
  height: number;
  /** Default-Farbe für neue Strokes. */
  color?: string;
  /** Default-Größe für neue Strokes (perfect-freehand `size` Option). */
  size?: number;
}

const PERFECT_FREEHAND_OPTIONS = {
  smoothing: 0.5,
  thinning: 0.5,
  streamline: 0.5,
  easing: (t: number) => t,
  start: { taper: 0, cap: true },
  end: { taper: 0, cap: true },
} as const;

/**
 * Wandelt ein perfect-freehand outline-array in ein SVG-Path-`d`-Attribut.
 *
 * Ref: https://github.com/steveruizok/perfect-freehand#rendering
 */
function getSvgPathFromStroke(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  const d: string[] = [];
  const first = points[0];
  if (!first) return "";
  d.push(`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    d.push(`L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`);
  }
  d.push("Z");
  return d.join(" ");
}

function strokeToPath(stroke: TafelStroke): string {
  const outline = getStroke(stroke.points, {
    ...PERFECT_FREEHAND_OPTIONS,
    size: stroke.size,
  });
  return getSvgPathFromStroke(outline);
}

function makeStrokeId(): string {
  // Kein crypto.randomUUID: in alten Safari/iOS-WebViews nicht garantiert.
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * SVG-basierte Drawing-UI für TafelMode.
 *
 * Konsumiert die TafelMode-Drawing-API (addStroke / clearStrokes / onChange)
 * und liefert pressure-sensitive perfect-freehand Strokes.
 *
 * Pointer-Events liefern `pressure` ∈ [0, 1] (0 = no-pressure / mouse).
 * Wir normalisieren zu `0.5` damit mouse-only Skizzen sichtbar bleiben.
 */
export function TafelCanvas({
  mode,
  width,
  height,
  color = "#f4f4f6",
  size = 6,
}: TafelCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [strokes, setStrokes] = useState<readonly TafelStroke[]>(() =>
    mode.getStrokes(),
  );
  const [pendingPoints, setPendingPoints] = useState<
    Array<[number, number, number]>
  >([]);
  const drawingRef = useRef<{
    pointerId: number | null;
    points: Array<[number, number, number]>;
  }>({ pointerId: null, points: [] });

  // Sync zu Mode-Store (z.B. wenn extern clearStrokes / addStroke aufgerufen wird)
  useEffect(() => {
    const unsub = mode.onChange((next) => {
      setStrokes(next);
    });
    return unsub;
  }, [mode]);

  const getLocalPoint = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): [number, number, number] => {
      const rect = svgRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const y = rect ? e.clientY - rect.top : e.clientY;
      // Pointer-Events ohne Pressure liefern 0 → fallback auf 0.5.
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      return [x, y, pressure];
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.preventDefault();
      svgRef.current?.setPointerCapture?.(e.pointerId);
      const p = getLocalPoint(e);
      drawingRef.current = { pointerId: e.pointerId, points: [p] };
      setPendingPoints([p]);
    },
    [getLocalPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drawingRef.current.pointerId !== e.pointerId) return;
      const p = getLocalPoint(e);
      drawingRef.current.points.push(p);
      // Defensive copy → React state-update
      setPendingPoints(drawingRef.current.points.slice());
    },
    [getLocalPoint],
  );

  const finalizeStroke = useCallback(() => {
    const pts = drawingRef.current.points;
    if (pts.length > 0) {
      mode.addStroke({
        id: makeStrokeId(),
        points: pts.slice(),
        color,
        size,
      });
    }
    drawingRef.current = { pointerId: null, points: [] };
    setPendingPoints([]);
  }, [mode, color, size]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drawingRef.current.pointerId !== e.pointerId) return;
      try {
        svgRef.current?.releasePointerCapture?.(e.pointerId);
      } catch {
        // pointer-capture cleanup ist best-effort
      }
      finalizeStroke();
    },
    [finalizeStroke],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drawingRef.current.pointerId !== e.pointerId) return;
      finalizeStroke();
    },
    [finalizeStroke],
  );

  const handleClear = useCallback(() => {
    mode.clearStrokes();
  }, [mode]);

  // Pending stroke (live-render während Pointer-Drag)
  const pendingPath =
    pendingPoints.length > 0
      ? getSvgPathFromStroke(
          getStroke(pendingPoints, {
            ...PERFECT_FREEHAND_OPTIONS,
            size,
          }),
        )
      : "";

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerUp}
        style={{
          background: "#15151a",
          border: "1px solid var(--cci-hairline)",
          display: "block",
          touchAction: "none",
          cursor: "crosshair",
        }}
        aria-label="Tafel-Zeichenfläche"
        role="img"
      >
        {strokes.map((s) => (
          <path key={s.id} d={strokeToPath(s)} fill={s.color} />
        ))}
        {pendingPath ? <path d={pendingPath} fill={color} /> : null}
      </svg>
      <button
        type="button"
        onClick={handleClear}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          padding: "0.4rem 0.8rem",
          border: "1px solid var(--cci-hairline)",
          background: "var(--overlay-bg)",
          backdropFilter: "var(--overlay-blur)",
          color: "var(--color-heading)",
          fontSize: "0.85rem",
          cursor: "pointer",
        }}
        aria-label="Tafel leeren"
      >
        Clear
      </button>
    </div>
  );
}
