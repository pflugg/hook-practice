import { describe, expect, it } from "vitest";
import { chooseFateCard } from "../src/engine/fateAi";
import { applyInput } from "../src/engine/game";
import { barePlayState, inst } from "./helpers";

describe("Easy Fate does not always play Peter when drawn", () => {
  it("Normal still forces Peter from the pair", () => {
    const state = barePlayState();
    const peter = inst("peterPan");
    const wendy = inst("wendy");
    expect(chooseFateCard(state, [wendy, peter], "normal").card.defId).toBe("peterPan");
  });

  it("Easy picks randomly among the playable pair, including the non-Peter card", () => {
    const peter = inst("peterPan");
    const wendy = inst("wendy");
    const seen = new Set<string>();
    for (let rng = 1; rng <= 80; rng++) {
      const state = { ...barePlayState(), rng };
      seen.add(chooseFateCard(state, [wendy, peter], "easy").card.defId);
    }
    expect(seen.has("wendy")).toBe(true);
    expect(seen.has("peterPan")).toBe(true);
  });

  it("computer Easy Fate can seat Wendy instead of forcing Peter from the same draw", () => {
    const played: string[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const state = barePlayState();
      state.difficulty = "easy";
      state.rng = seed;
      state.villainLocation = "jollyRoger";
      state.phase = "actions";
      state.fateDeck = [inst("peterPan"), inst("wendy")];
      const next = applyInput(state, { type: "endTurn" });
      if (next.pending?.kind === "fateReport" && next.pending.played) {
        played.push(next.pending.played.defId);
      }
    }
    expect(played).toContain("wendy");
    expect(played).toContain("peterPan");
    expect(played.some((id) => id === "wendy")).toBe(true);
  });
});
