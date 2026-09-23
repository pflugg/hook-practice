/**
 * @vitest-environment jsdom
 *
 * Locks the three Must defects the hour hammer proved on unfixed main:
 * Lost Boys confirm no-op, cancel deleting a held Fate/Worthy card, and
 * live Cunning ignored so the captain ended turns and paced the ship.
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, highlightSet } from "../src/engine/game";
import { hourEqualVanquishScene } from "../src/engine/scenes";
import { renderPlay } from "../src/ui/app";
import { barePlayState, give, inst, putAlly, putHero } from "./helpers";

function expectLegalHighlights(state: ReturnType<typeof barePlayState>, highlights: string[]) {
  const legal = highlightSet(state);
  for (const key of highlights) {
    if (key.startsWith("btn:")) continue;
    expect(legal.has(key), `${key} should be a legal highlight`).toBe(true);
  }
}

describe("hammer Must: Lost Boys confirm", () => {
  it("does not tell the captain to Confirm when one Ally already meets Strength", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const boys = putHero(state, "lostBoys", "jollyRoger");
    const smee = putAlly(state, "smee", "jollyRoger");
    const brute = putAlly(state, "pirateBrute", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: boys.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: smee.instanceId });

    const advice = advise(next);
    expect(advice.do).not.toMatch(/Confirm the clash/);
    expect(advice.do).toMatch(/Lost Boys need two Allies \(1\/2\)/);
    expect(advice.highlights).not.toContain("btn:confirm");
    expect(advice.highlights).toContain(`card:${brute.instanceId}`);
    expectLegalHighlights(next, advice.highlights);

    const clicked = applyInput(next, { type: "confirm" });
    expect(clicked.pending?.kind).toBe("vanquishAllies");
    expect(clicked.locations.jollyRoger.heroes.some((h) => h.instanceId === boys.instanceId)).toBe(true);

    const both = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    const ready = advise(both);
    expect(ready.do).toMatch(/Confirm the clash/);
    expect(ready.highlights).toContain("btn:confirm");
  });
});

describe("hammer Must: cancel keeps a committed held card", () => {
  it("ignores Cancel while Worthy Opponent is seating a drawn Hero", () => {
    const state = barePlayState();
    state.phase = "resolving";
    const hero = inst("john");
    state.heldCard = hero;
    state.pending = { kind: "worthyLocation", heroId: hero.instanceId };

    const cancelled = applyInput(state, { type: "cancel" });
    expect(cancelled.pending?.kind).toBe("worthyLocation");
    expect(cancelled.heldCard?.instanceId).toBe(hero.instanceId);
    expect(cancelled.fateDiscard.some((c) => c.instanceId === hero.instanceId)).toBe(false);
    expect(renderPlay(cancelled, { briefEnabled: false, reasonsEnabled: false })).not.toContain("data-cancel");
  });

  it("ignores Cancel while Pixie Dust is waiting for a Hero", () => {
    const state = barePlayState();
    state.phase = "resolving";
    putHero(state, "wendy", "skullRock");
    const dust = inst("pixieDust");
    state.heldCard = dust;
    state.pending = { kind: "fateChooseAttach", cardId: dust.instanceId, actor: "player" };

    const cancelled = applyInput(state, { type: "cancel" });
    expect(cancelled.pending?.kind).toBe("fateChooseAttach");
    expect(cancelled.heldCard?.instanceId).toBe(dust.instanceId);
    expect(cancelled.fateDiscard.some((c) => c.instanceId === dust.instanceId)).toBe(false);
    expect(renderPlay(cancelled, { briefEnabled: false, reasonsEnabled: false })).not.toContain("data-cancel");
  });

  it("does not refund Aye Aye Sir when Cancel is pressed mid-move", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 2;
    const aye = give(state, "ayeAyeSir");
    const smee = putAlly(state, "smee", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: aye.instanceId });
    expect(next.pending?.kind).toBe("playChoosePayment");
    next = applyInput(next, { type: "payWithPower" });
    expect(next.pending?.kind).toBe("ayeAyeAlly");
    expect(next.power).toBe(1);
    expect(next.usedActions).not.toContain("jr-play");
    expect(next.villainDiscard.filter((c) => c.instanceId === aye.instanceId)).toHaveLength(1);

    const cancelled = applyInput(next, { type: "cancel" });
    expect(cancelled.pending?.kind).toBe("ayeAyeAlly");
    expect(cancelled.actionKey).toBe("jr-play");
    expect(cancelled.usedActions).not.toContain("jr-play");
    expect(cancelled.villainDiscard.filter((c) => c.instanceId === aye.instanceId)).toHaveLength(1);
    expect(renderPlay(cancelled, { briefEnabled: false, reasonsEnabled: false })).not.toContain("data-cancel");

    const stepping = applyInput(cancelled, { type: "selectCard", instanceId: smee.instanceId });
    expect(stepping.pending?.kind).toBe("ayeAyeDest");
    const back = applyInput(stepping, { type: "cancel" });
    expect(back.pending?.kind).toBe("ayeAyeAlly");
    expect(back.usedActions).not.toContain("jr-play");
    expect(back.power).toBe(1);
  });
});

describe("hammer Must: live Cunning and end-turn honesty", () => {
  it("plays Cunning before ending a turn that cannot pay the rest of the hand", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    state.usedActions = ["jr-gain", "jr-discard"];
    putHero(state, "lostBoys", "skullRock");
    const cunning = give(state, "cunning");
    give(state, "boardingParty");

    const advice = advise(state);
    expect(advice.do).toMatch(/Play Cunning/);
    expect(advice.do).toMatch(/Boarding Party/);
    expect(advice.do).not.toMatch(/End the turn/);
    expect(advice.highlights).toContain(`card:${cunning.instanceId}`);
    expectLegalHighlights(state, advice.highlights);

    const brute = give(state, "pirateBrute");
    state.power = 0;
    const offered = applyInput(state, { type: "selectCard", instanceId: cunning.instanceId });
    expect(offered.pending?.kind).toBe("conditionOffer");
    const slipping = applyInput(offered, { type: "acceptCondition" });
    expect(slipping.pending?.kind).toBe("cunningAlly");
    const follow = advise(slipping);
    expect(follow.do).toMatch(/Slip Pirate Brute ashore for free/);
    expect(follow.do).not.toMatch(/End the turn/);
    expect(follow.highlights).toContain(`card:${brute.instanceId}`);
    expectLegalHighlights(slipping, follow.highlights);
    const placed = applyInput(slipping, { type: "selectCard", instanceId: brute.instanceId });
    expect(placed.pending?.kind).toBe("cunningLocation");
  });

  it("still vanquishes Peter before suggesting Cunning", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    putHero(state, "peterPan", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    give(state, "cunning");
    give(state, "boardingParty");

    const advice = advise(state);
    expect(advice.do).toMatch(/Vanquish/);
    expect(advice.do).not.toMatch(/Play Cunning/);
    expect(advice.highlights).toContain("act:jr-vanquish");
  });

  it("offers Obsession only when the action stretch would otherwise end", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 8;
    state.peterPanRevealed = false;
    state.usedActions = ["jr-gain", "jr-discard", "jr-play"];
    const obsession = give(state, "obsession");

    const advice = advise(state);
    expect(advice.do).toMatch(/Play Obsession/);
    expect(advice.do).not.toMatch(/End the turn/);
    expect(advice.highlights).toContain(`card:${obsession.instanceId}`);
    expectLegalHighlights(state, advice.highlights);
  });

  it("says Play is uncovered when the hand cannot be paid and the turn is over", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    state.peterPanRevealed = true;
    state.peterPanLocation = "hangmansTree";
    state.usedActions = ["jr-gain", "jr-discard"];
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.do).toMatch(/End the turn/);
    expect(advice.why).toMatch(/Play is uncovered/);
    expect(advice.why).not.toMatch(/No Discard, Gain, or Play is left uncovered/);
  });
});

describe("hammer Should: hour equal scene stays legal", () => {
  it("does not strap Pixie Dust to Peter while Hangman’s Tree is locked", () => {
    const state = hourEqualVanquishScene();
    expect(state.hangmansUnlocked).toBe(false);
    expect(state.attachments.some((a) => a.item.defId === "pixieDust")).toBe(false);
    expect(state.fateDiscard.some((c) => c.defId === "pixieDust")).toBe(true);
    const peter = state.locations.hangmansTree.heroes.find((h) => h.defId === "peterPan");
    expect(peter).toBeTruthy();
    expect(state.attachments.some((a) => a.attachedTo === peter!.instanceId)).toBe(false);
  });
});
