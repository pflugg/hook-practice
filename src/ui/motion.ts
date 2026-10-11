export type Box = { left: number; top: number; width: number; height: number };

export function motionReduced(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function travelDelta(prev: Box, next: Box): { dx: number; dy: number } | null {
  if (prev.width <= 0 || prev.height <= 0 || next.width <= 0 || next.height <= 0) return null;
  const dx = prev.left - next.left;
  const dy = prev.top - next.top;
  if (Math.hypot(dx, dy) < 4) return null;
  return { dx, dy };
}
