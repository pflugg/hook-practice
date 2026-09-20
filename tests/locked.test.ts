import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { adjacentUnlocked, isUnlocked, legalMoveLocations, legalPlayLocations } from "../src/engine/queries";
import { barePlayState, give, putAlly, putHero } from "./helpers";

describe("locked-location restrictions", () => {
  it("blocks villain movement onto Hangman's Tree until unlocked", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.hangmansUnlocked = false;
    state.phase = "move";
    expect(legalMoveLocations(state)).not.toContain("hangmansTree");

    const blocked = applyInput(state, { type: "selectLocation", locationId: "hangmansTree" });
    expect(blocked.villainLocation).toBe("mermaidLagoon");
    expect(blocked.phase).toBe("move");
  });

  it("forbids playing cards onto the locked tree", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    expect(legalPlayLocations(state)).not.toContain("hangmansTree");
    expect(isUnlocked(state, "hangmansTree")).toBe(false);
  });

  it("forbids moving allies to or from the locked tree", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    putAlly(state, "smee", "mermaidLagoon");
    expect(adjacentUnlocked(state, "mermaidLagoon")).not.toContain("hangmansTree");
    expect(adjacentUnlocked(state, "hangmansTree")).toEqual([]);
  });

  it("still allows Peter Pan to enter the locked tree when revealed", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.power = 0;
    state.villainLocation = "skullRock";
    const worthy = give(state, "worthyOpponent");
    state.fateDeck = [{ instanceId: "peter-lock", defId: "peterPan" }];

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: worthy.instanceId });
    expect(next.peterPanLocation).toBe("hangmansTree");
    expect(next.hangmansUnlocked).toBe(false);
  });

  it("allows movement onto the tree after the Map unlocks it", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "mermaidLagoon";
    state.phase = "move";
    expect(legalMoveLocations(state)).toContain("hangmansTree");
    const next = applyInput(state, { type: "selectLocation", locationId: "hangmansTree" });
    expect(next.villainLocation).toBe("hangmansTree");
    expect(next.phase).toBe("actions");
  });
});

describe("hero coverage", () => {
  it("covers top-row actions while a Hero is present", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    putHero(state, "wendy", "jollyRoger");
    const next = applyInput(state, { type: "selectAction", actionKey: "jr-gain" });
    expect(next.power).toBe(state.power);
    const vanquish = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(vanquish.pending?.kind).not.toBe("vanquishHero");
    expect(vanquish.usedActions.includes("jr-vanquish")).toBe(false);
    expect(vanquish.bannerNote).toMatch(/Allies here total|No Hero/i);
  });
});
