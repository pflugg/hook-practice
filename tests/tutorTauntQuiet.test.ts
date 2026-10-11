import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import type { GameState } from "../src/engine/types";
import { attachTo, barePlayState, inst, putAlly, putHero } from "./helpers";

function playedDef(state: GameState): string | undefined {
  return state.pending?.kind === "fateReport" ? state.pending.played?.defId : undefined;
}

function boardAfterTauntClear(coachOn: boolean): GameState {
  const state = barePlayState();
  state.difficulty = "normal";
  state.coachOn = coachOn;
  state.villainLocation = "jollyRoger";
  state.phase = "actions";
  const john = putHero(state, "john", "jollyRoger");
  attachTo(state, "taunt", john.instanceId);
  putHero(state, "peterPan", "jollyRoger");
  putHero(state, "wendy", "skullRock");
  const brute = putAlly(state, "pirateBrute", "jollyRoger");
  let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
  next = applyInput(next, { type: "selectCard", instanceId: john.instanceId });
  next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
  next = applyInput(next, { type: "confirm" });
  expect(next.locations.jollyRoger.heroes.some((hero) => hero.defId === "john")).toBe(false);
  expect(next.phase).toBe("actions");
  return next;
}

function fatePair(): GameState["fateDeck"] {
  return [inst("taunt"), inst("michael")];
}

describe("tutor Fate holds Taunt once after a taunted Hero falls with Peter aboard", () => {
  it("plays the other legal card while the Coach is on", () => {
    const state = boardAfterTauntClear(true);
    state.fateDeck = fatePair();
    const fated = applyInput(state, { type: "endTurn" });
    expect(playedDef(fated)).toBe("michael");
    expect(fated.attachments.some((attachment) => attachment.item.defId === "taunt")).toBe(false);
  });

  it("still plays Taunt while the Coach is off", () => {
    const state = boardAfterTauntClear(false);
    state.fateDeck = fatePair();
    const fated = applyInput(state, { type: "endTurn" });
    expect(playedDef(fated)).toBe("taunt");
  });

  it("still plays Taunt when Peter is not aboard", () => {
    const state = barePlayState();
    state.coachOn = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const john = putHero(state, "john", "jollyRoger");
    attachTo(state, "taunt", john.instanceId);
    putHero(state, "wendy", "skullRock");
    const brute = putAlly(state, "pirateBrute", "jollyRoger");
    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: john.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    next = applyInput(next, { type: "confirm" });
    next.fateDeck = fatePair();
    const fated = applyInput(next, { type: "endTurn" });
    expect(playedDef(fated)).toBe("taunt");
  });

  it("plays Taunt again on the following computer Fate", () => {
    const state = boardAfterTauntClear(true);
    state.fateDeck = fatePair();
    let next = applyInput(state, { type: "endTurn" });
    expect(playedDef(next)).toBe("michael");
    next = applyInput(next, { type: "acknowledgeFate" });
    expect(next.phase).toBe("move");
    next = applyInput(next, { type: "selectLocation", locationId: "skullRock" });
    expect(next.phase).toBe("actions");
    next.fateDeck = fatePair();
    next = applyInput(next, { type: "endTurn" });
    expect(playedDef(next)).toBe("taunt");
  });

  it("does not hold Taunt after a later clear", () => {
    const state = boardAfterTauntClear(true);
    state.fateDeck = fatePair();
    let next = applyInput(state, { type: "endTurn" });
    expect(playedDef(next)).toBe("michael");
    next = applyInput(next, { type: "acknowledgeFate" });
    next = applyInput(next, { type: "selectLocation", locationId: "skullRock" });
    next = applyInput(next, { type: "endTurn" });
    next = applyInput(next, { type: "acknowledgeFate" });
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.phase).toBe("actions");
    expect(next.peterPanLocation).toBe("jollyRoger");
    const again = putHero(next, "john", "jollyRoger");
    attachTo(next, "taunt", again.instanceId);
    const brute = putAlly(next, "pirateBrute", "jollyRoger");
    next = applyInput(next, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: again.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    next = applyInput(next, { type: "confirm" });
    expect(next.locations.jollyRoger.heroes.some((hero) => hero.instanceId === again.instanceId)).toBe(false);
    next.fateDeck = fatePair();
    next = applyInput(next, { type: "endTurn" });
    expect(playedDef(next)).toBe("taunt");
  });

  it("still plays Peter, and still plays Taunt when it is the only card", () => {
    const peter = boardAfterTauntClear(true);
    peter.fateDeck = [inst("peterPan"), inst("taunt")];
    const peterFate = applyInput(peter, { type: "endTurn" });
    expect(playedDef(peterFate)).toBe("peterPan");

    const only = boardAfterTauntClear(true);
    only.fateDiscard = [];
    only.fateDeck = [inst("taunt")];
    const onlyFate = applyInput(only, { type: "endTurn" });
    expect(playedDef(onlyFate)).toBe("taunt");
  });

  it("keeps Easy from replaying Taunt on that Fate, and only while the Coach is on", () => {
    let tutorTaunts = 0;
    let gameTaunts = 0;
    for (let rng = 1; rng <= 40; rng++) {
      const tutor = boardAfterTauntClear(true);
      tutor.difficulty = "easy";
      tutor.rng = rng;
      tutor.fateDeck = fatePair();
      if (playedDef(applyInput(tutor, { type: "endTurn" })) === "taunt") tutorTaunts += 1;

      const game = boardAfterTauntClear(false);
      game.difficulty = "easy";
      game.rng = rng;
      game.fateDeck = fatePair();
      if (playedDef(applyInput(game, { type: "endTurn" })) === "taunt") gameTaunts += 1;
    }
    expect(tutorTaunts).toBe(0);
    expect(gameTaunts).toBeGreaterThan(0);
  });
});
