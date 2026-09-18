import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { isUnlocked, legalMoveLocations, movableHeroes } from "../src/engine/queries";
import { barePlayState, give, putAlly, putHero, putItem } from "./helpers";

describe("Never Land Map unlocks Hangman's Tree", () => {
  it("unlocks the tree when the Map is played and then allows movement there", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 4;
    const map = give(state, "neverLandMap");

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-play" });
    expect(next.pending?.kind).toBe("playChooseCard");
    next = applyInput(next, { type: "selectCard", instanceId: map.instanceId });
    expect(next.pending?.kind).toBe("playChooseLocation");
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });

    expect(next.hangmansUnlocked).toBe(true);
    expect(isUnlocked(next, "hangmansTree")).toBe(true);
    expect(next.locations.jollyRoger.items.some((c) => c.defId === "neverLandMap")).toBe(true);

    next = applyInput(next, { type: "endTurn" });
    if (next.pending?.kind === "fateReport") {
      next = applyInput(next, { type: "acknowledgeFate" });
    }
    expect(next.phase).toBe("move");
    expect(legalMoveLocations(next)).toContain("hangmansTree");
  });
});

describe("Peter Pan reveal placement", () => {
  it("places Peter Pan at Hangman's Tree even while the location is locked", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.fateDeck = [
      { instanceId: "peter-1", defId: "peterPan" },
      { instanceId: "wendy-1", defId: "wendy" },
    ];

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    expect(next.peterPanRevealed).toBe(true);
    expect(next.peterPanLocation).toBe("hangmansTree");
    expect(next.locations.hangmansTree.heroes.some((h) => h.defId === "peterPan")).toBe(true);
    expect(next.hangmansUnlocked).toBe(false);
    expect(next.fateDiscard.some((c) => c.defId === "wendy")).toBe(true);
  });

  it("cannot move Peter out of the locked tree", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.villainLocation = "hangmansTree";
    putHero(state, "peterPan", "hangmansTree");
    expect(movableHeroes(state).some((c) => c.defId === "peterPan")).toBe(false);
  });
});

describe("move-hero path to the Jolly Roger", () => {
  it("walks Peter from Hangman's Tree to the Jolly Roger after unlock", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    const peter = putHero(state, "peterPan", "hangmansTree");
    state.villainLocation = "hangmansTree";
    state.phase = "actions";

    let next = applyInput(state, { type: "selectAction", actionKey: "ht-moveHero" });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "mermaidLagoon" });
    expect(next.peterPanLocation).toBe("mermaidLagoon");

    next.villainLocation = "mermaidLagoon";
    next.usedActions = [];
    next.phase = "actions";
    const device = putItem(next, "ingeniousDevice", "mermaidLagoon");
    next = applyInput(next, { type: "selectAction", actionKey: `extra:${device.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "skullRock" });
    expect(next.peterPanLocation).toBe("skullRock");

    next.villainLocation = "skullRock";
    next.usedActions = [];
    next.phase = "actions";
    putItem(next, "ingeniousDevice", "skullRock");
    const device2 = next.locations.skullRock.items.find((c) => c.defId === "ingeniousDevice")!;
    next = applyInput(next, { type: "selectAction", actionKey: `extra:${device2.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.peterPanLocation).toBe("jollyRoger");
    expect(next.locations.jollyRoger.heroes.some((h) => h.defId === "peterPan")).toBe(true);
  });
});

describe("vanquish win check", () => {
  it("wins when Peter Pan is vanquished at the Jolly Roger", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const peter = putHero(state, "peterPan", "jollyRoger");
    const brute = putAlly(state, "pirateBrute", "jollyRoger");
    const brute2 = putAlly(state, "pirateBrute", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute2.instanceId });
    next = applyInput(next, { type: "confirm" });

    expect(next.won).toBe(true);
    expect(next.lost).toBe(false);
    expect(next.phase).toBe("over");
  });

  it("loses if Peter Pan is vanquished away from the Jolly Roger", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    const cannon = putItem(state, "cannon", "mermaidLagoon");
    const peter = putHero(state, "peterPan", "mermaidLagoon");
    const brute = putAlly(state, "pirateBrute", "mermaidLagoon");
    const brute2 = putAlly(state, "pirateBrute", "mermaidLagoon");

    let next = applyInput(state, { type: "selectAction", actionKey: `extra:${cannon.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute2.instanceId });
    next = applyInput(next, { type: "confirm" });

    expect(next.won).toBe(false);
    expect(next.lost).toBe(true);
    expect(next.loseReason).toMatch(/away from the Jolly Roger/);
  });
});
