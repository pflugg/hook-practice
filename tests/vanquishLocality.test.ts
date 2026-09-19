import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { promptText, vanquishClashMath, vanquishableHeroes } from "../src/engine/queries";
import { advise } from "../src/engine/coach";
import { barePlayState, putAlly, putHero, putItem } from "./helpers";

describe("Vanquish is location-local", () => {
  it("cannot name a Hero at another place just because Allies sit with them", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const wendy = putHero(state, "wendy", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");
    const john = putHero(state, "john", "jollyRoger");
    putAlly(state, "smee", "jollyRoger");

    expect(vanquishableHeroes(state).map((h) => h.hero.defId)).toEqual(["john"]);

    const opened = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(opened.pending?.kind).toBe("vanquishHero");
    const afterRemote = applyInput(opened, { type: "selectCard", instanceId: wendy.instanceId });
    expect(afterRemote.pending?.kind).toBe("vanquishHero");
    const afterLocal = applyInput(opened, { type: "selectCard", instanceId: john.instanceId });
    expect(afterLocal.pending?.kind).toBe("vanquishAllies");
  });

  it("can name a Hero at the captain’s current location", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const wendy = putHero(state, "wendy", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "smee", "jollyRoger");

    expect(vanquishableHeroes(state).some((h) => h.hero.instanceId === wendy.instanceId)).toBe(true);
  });

  it("lets a Boarding Party reach a neighboring unlocked Hero", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const john = putHero(state, "john", "skullRock");
    putAlly(state, "boardingParty", "jollyRoger");
    putAlly(state, "swashbuckler", "skullRock");

    expect(vanquishableHeroes(state).some((h) => h.hero.instanceId === john.instanceId)).toBe(true);
  });

  it("does not let Boarding Party reach locked Hangman’s Tree", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    putHero(state, "john", "hangmansTree");
    putAlly(state, "boardingParty", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");

    expect(vanquishableHeroes(state).some((h) => h.location === "hangmansTree")).toBe(false);
  });
});

describe("Vanquish Strength meter", () => {
  it("tracks selected Strength vs needed while Allies are chosen", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const peter = putHero(state, "peterPan", "jollyRoger");
    const brute = putAlly(state, "pirateBrute", "jollyRoger");
    const brute2 = putAlly(state, "pirateBrute", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    expect(next.pending?.kind).toBe("vanquishAllies");

    let math = vanquishClashMath(next);
    expect(math).toMatchObject({ need: 8, selected: 0, ready: false });
    expect(promptText(next)).toMatch(/Clash Strength 0 \/ 8/);

    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    math = vanquishClashMath(next);
    expect(math?.selected).toBe(4);
    expect(math?.ready).toBe(false);
    expect(promptText(next)).toMatch(/Clash Strength 4 \/ 8/);

    next = applyInput(next, { type: "selectCard", instanceId: brute2.instanceId });
    math = vanquishClashMath(next);
    expect(math).toMatchObject({ selected: 8, need: 8, ready: true });
    expect(promptText(next)).toMatch(/Clash Strength 8 \/ 8/);
  });

  it("requires two Allies for Lost Boys even when Strength is already met", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const boys = putHero(state, "lostBoys", "jollyRoger");
    const smee = putAlly(state, "smee", "jollyRoger");
    const brute = putAlly(state, "pirateBrute", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: boys.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: smee.instanceId });
    const math = vanquishClashMath(next);
    expect(math?.lostBoys).toBe(true);
    expect(math?.selected).toBeGreaterThanOrEqual(math?.need ?? 99);
    expect(math?.ready).toBe(false);
    expect(promptText(next)).toMatch(/Lost Boys need two Allies \(1\/2\)/);

    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    expect(vanquishClashMath(next)?.ready).toBe(true);
  });
});

describe("off-ship Peter confirm gate", () => {
  it("asks before naming Peter away from the Jolly Roger and cancel returns to hero pick", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    const cannon = putItem(state, "cannon", "mermaidLagoon");
    const peter = putHero(state, "peterPan", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");
    putAlly(state, "pirateBrute", "mermaidLagoon");

    let next = applyInput(state, { type: "selectAction", actionKey: `extra:${cannon.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    expect(next.pending?.kind).toBe("vanquishConfirmLoss");
    expect(promptText(next)).toMatch(/loses this practice duel/);

    const advice = advise(next);
    expect(advice.highlights).toContain("btn:cancel");

    next = applyInput(next, { type: "cancel" });
    expect(next.pending?.kind).toBe("vanquishHero");
    expect(next.lost).toBe(false);
  });
});
