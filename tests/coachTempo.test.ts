/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { highlightSet } from "../src/engine/game";
import { barePlayState, give, putAlly, putHero } from "./helpers";

const RIVAL_CLOSE =
  "The rival villain is at 140 of 154. Finish Peter Pan at the Jolly Roger before that track fills.";

describe("coach tempo", () => {
  it("warns in plain words when the rival track is close and stays quiet when it is empty", () => {
    const state = barePlayState();
    state.power = 12;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.rivalProgress = 0;

    const far = advise(state);
    expect(far.warning ?? "").not.toContain("The rival villain is at");

    state.rivalProgress = 140;
    const close = advise(state);
    expect(close.highlights).toEqual(["btn:end"]);
    expect(close.warning).toBe(RIVAL_CLOSE);
  });

  it("plays ship crew instead of a second Never Land Map once the tree is open", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 6;
    putHero(state, "peterPan", "jollyRoger");
    give(state, "neverLandMap");
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["act:jr-play"]);
    expect(advice.do).toContain("Pirate Brute");
    expect(advice.do).not.toContain("Never Land Map");
    expect(highlightSet(state).has("act:jr-play")).toBe(true);
  });

  it("keeps the ship crew for Peter instead of spending it on John", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 12;
    putHero(state, "peterPan", "jollyRoger");
    putHero(state, "john", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["btn:end"]);
    expect(advice.do).toContain("End the turn");
    expect(advice.do).not.toContain("Vanquish");
  });

  it("sails to the ship to play a payable Ally instead of a discard shore", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "hangmansTree";
    state.departedFrom = "jollyRoger";
    state.power = 4;
    putHero(state, "peterPan", "jollyRoger");
    give(state, "obsession");
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:jollyRoger"]);
    expect(highlightSet(state).has("loc:jollyRoger")).toBe(true);
  });
});
