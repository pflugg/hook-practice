import { describe, expect, it } from "vitest";
import { applyInput, highlightSet, type Input } from "../src/engine";
import { allyStrength, heroStrength } from "../src/engine/queries";
import { drillAdvice } from "../src/ui/drillCoach";
import { PRACTICE_DRILLS, startDrill } from "../src/ui/learning";
import { parseLocationId } from "../src/ui/parse";

function inputFor(key: string): Input {
  if (key.startsWith("act:")) return { type: "selectAction", actionKey: key.slice(4) };
  if (key.startsWith("card:")) return { type: "selectCard", instanceId: key.slice(5) };
  if (key.startsWith("loc:")) {
    const locationId = parseLocationId(key.slice(4));
    if (locationId) return { type: "selectLocation", locationId };
  }
  if (key === "btn:confirm") return { type: "confirm" };
  if (key === "btn:pay-power") return { type: "payWithPower" };
  if (key === "btn:ack") return { type: "acknowledgeFate" };
  throw new Error(`Unexpected drill click ${key}`);
}

describe("varied practice setups", () => {
  for (const drill of PRACTICE_DRILLS) {
    for (const setup of drill.setups) {
      it(`${setup.id}: guidance names legal clicks and finishes the real objective`, () => {
        const run = startDrill(drill, setup.id, true, true);
        let state = setup.open();
        expect(setup.plans.filter((p) => p.works)).toHaveLength(1);
        for (let i = 0; i < 20 && !setup.complete(state); i++) {
          const advice = drillAdvice(run, state);
          expect(advice.highlights.length, advice.do).toBeGreaterThan(0);
          const key = advice.highlights[0]!;
          if (!key.startsWith("btn:")) expect(highlightSet(state).has(key), `${advice.do}: ${key}`).toBe(true);
          const next = applyInput(state, inputFor(key));
          expect(next, `${advice.do} made no progress`).not.toEqual(state);
          state = next;
        }
        expect(setup.complete(state)).toBe(true);
        if (setup.id === "combat-wendy") {
          expect(state.voyage.lastClash?.heroStrength).toBe(3);
          expect(state.voyage.lastClash?.allyStrength).toBe(4);
          expect(state.locations.jollyRoger.allies.map((a) => a.defId)).toContain("swashbuckler");
        }
        if (setup.id === "clash-dust") {
          expect(state.voyage.lastClash?.heroStrength).toBe(10);
          expect(state.voyage.lastClash?.allyStrength).toBe(10);
          expect(state.power).toBe(0);
        }
      });
    }
  }

  it("changes the actual decision across setups, while restart keeps the same board", () => {
    const combat = PRACTICE_DRILLS[0]!;
    const a = startDrill(combat);
    const b = startDrill(combat, a.setup.id);
    const replay = startDrill(combat, b.setup.id, true);
    expect(a.setup.id).not.toBe(b.setup.id);
    expect(b.setup.id).toBe(replay.setup.id);
    const state = b.setup.open();
    expect(heroStrength(state, state.locations.jollyRoger.heroes[0]!)).toBe(3);
    expect(state.locations.jollyRoger.allies.map((a) => allyStrength(state, a))).toEqual([2, 4]);
    expect(b.attempts).toEqual([]);
    expect(b.hintsShown).toBe(0);
    expect(b.started).toBe(false);
    expect(b.plans.map((p) => p.id).sort()).toEqual(b.setup.plans.map((p) => p.id).sort());
  });
});
