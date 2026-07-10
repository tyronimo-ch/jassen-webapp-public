"use client";
import { useEffect, useState } from "react";

export interface Layout {
  w: number;
  h: number;
  isMobile: boolean;
  cardW: number; // main hand card width
  smallCardW: number; // opponent card width
  trickCardW: number;
}

function compute(w: number, h: number): Layout {
  const vmin = Math.min(w, h);
  const isMobile = w < 640;
  const cardW = Math.max(72, Math.min(132, vmin * 0.2));
  return {
    w,
    h,
    isMobile,
    cardW,
    smallCardW: Math.max(46, Math.min(78, vmin * 0.12)),
    trickCardW: Math.max(58, Math.min(104, vmin * 0.16)),
  };
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(() =>
    compute(
      typeof window === "undefined" ? 1024 : window.innerWidth,
      typeof window === "undefined" ? 768 : window.innerHeight
    )
  );

  useEffect(() => {
    const onResize = () => setLayout(compute(window.innerWidth, window.innerHeight));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return layout;
}

/**
 * Positions for `n` seats around an ellipse, as {x,y} in percentages of the table.
 * Seat 0 is the local player at the bottom-center; the rest go clockwise.
 */
export function ellipsePositions(n: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    // Start at the bottom (90deg) and walk clockwise.
    const angle = Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = 50 + 42 * Math.cos(angle);
    const y = 50 + 40 * Math.sin(angle);
    positions.push({ x, y });
  }
  return positions;
}
