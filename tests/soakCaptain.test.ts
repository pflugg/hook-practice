import { mkdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadHammer, playSoakGame } from "../scripts/soak-games";

const stalledDeals: { seed: number; label: string }[] = [
  { seed: 3, label: "Peter on the ship, Power at 0, Allies still in hand" },
  { seed: 4, label: "Pixie Dust pushes Peter past the crew already ashore" },
  { seed: 5, label: "the crew is stranded under a covered Mermaid Lagoon" },
  { seed: 56, label: "no Allies ashore and Peter is Strength 15" },
  { seed: 120, label: "the Map is in hand, the hideout is locked, and gains are covered" },
];

function difficultyFor(seed: number): "easy" | "normal" {
  return seed % 2 === 1 ? "easy" : "normal";
}

describe("soak captain", () => {
  beforeAll(async () => {
    mkdirSync("/tmp/hammer-lib", { recursive: true });
    await loadHammer();
  });

  for (const deal of stalledDeals) {
    it(`wins seed ${deal.seed} before turn 120 (${deal.label})`, () => {
      const played = playSoakGame(deal.seed, difficultyFor(deal.seed));
      expect(played.result).toBe("win");
      expect(played.turns).toBeLessThanOrEqual(120);
    });
  }
});
