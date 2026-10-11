/** Mulberry32 — tiny deterministic PRNG for seeds and tests. */
export function nextRng(state: number): { value: number; rng: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: t >>> 0 };
}

export function shuffle<T>(items: T[], rng: number): { items: T[]; rng: number } {
  const next = items.slice();
  let state = rng;
  for (let i = next.length - 1; i > 0; i--) {
    const roll = nextRng(state);
    state = roll.rng;
    const j = Math.floor(roll.value * (i + 1));
    const left = next[i];
    const right = next[j];
    if (left === undefined || right === undefined) {
      throw new Error("shuffle index out of range");
    }
    next[i] = right;
    next[j] = left;
  }
  return { items: next, rng: state };
}

export function pickIndex(length: number, rng: number): { index: number; rng: number } {
  const roll = nextRng(rng);
  return { index: Math.floor(roll.value * length), rng: roll.rng };
}
