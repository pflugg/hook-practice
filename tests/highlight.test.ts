import { describe, expect, it } from "vitest";
import { applyInput, highlightSet } from "../src/engine/game";
import { barePlayState, give } from "./helpers";

describe("legal-target highlighting", () => {
  it("marks affordable hand cards after Play a Card", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 1;
    const worthy = give(state, "worthyOpponent");
    const brute = give(state, "pirateBrute");
    give(state, "cutlass");

    const next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    expect(next.pending?.kind).toBe("playChooseCard");
    const hi = highlightSet(next);
    expect(hi.has(`card:${worthy.instanceId}`)).toBe(true);
    expect(hi.has(`card:${brute.instanceId}`)).toBe(false);
  });
});
