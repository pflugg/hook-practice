/**
 * @vitest-environment jsdom
 *
 * Open Shoulds: Obsession discard copy, revealed Peter, Cunning cancel,
 * Play a Card locality, and a far-side Boarding Party.
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, highlightSet } from "../src/engine/game";
import { explainSelection } from "../src/engine/moveReason";
import { legalPlayLocations, promptText, vanquishableHeroes } from "../src/engine/queries";
import { renderOverlay } from "../src/ui/app";
import { barePlayState, give, inst, putAlly, putHero } from "./helpers";

describe("Obsession discard copy and a revealed Peter", () => {
  it("discards a found Hero to the Fate discard and does not say they leave the realm", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    const obsession = give(state, "obsession");
    state.fateDeck = [inst("tickTock")];

    let next = applyInput(state, { type: "selectCard", instanceId: obsession.instanceId });
    next = applyInput(next, { type: "acceptCondition" });
    expect(next.log.some((entry) => /Obsession is played/.test(entry.text))).toBe(true);
    expect(next.pending?.kind).toBe("obsessionDecide");
    expect(next.villainDiscard.some((card) => card.defId === "obsession")).toBe(true);

    const html = renderOverlay(next);
    expect(html).toContain("data-discard-hero");
    expect(html).toContain(">Discard<");
    expect(html).toMatch(/Fate discard/);
    expect(html).not.toMatch(/Banish|out of the realm/i);

    const advice = advise(next);
    expect(advice.do).toMatch(/Discard Tick Tock/);
    expect(`${advice.do} ${advice.why}`).toMatch(/Fate discard/);
    expect(`${advice.do} ${advice.why}`).toMatch(/can return/);
    expect(`${advice.do} ${advice.why}`).not.toMatch(/banish|out of the realm/i);
    expect(advice.highlights).toContain("btn:discard-hero");
    expect(promptText(next)).toMatch(/Fate discard/);

    const before = next;
    next = applyInput(next, { type: "playOrDiscardHero", play: false });
    expect(next.fateDiscard.some((card) => card.defId === "tickTock")).toBe(true);
    expect(next.log.some((entry) => /Fate discard/.test(entry.text) && /return/.test(entry.text))).toBe(true);
    expect(next.pending).toBeNull();

    const reason = explainSelection(before, { type: "playOrDiscardHero", play: false }, next);
    expect(reason?.chose).toMatch(/Fate discard/);
    expect(`${reason?.why} ${reason?.next}`).not.toMatch(/banish|out of the realm/i);
  });

  it("forces a just-found Peter onto Hangman’s Tree and ignores a discard", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.hangmansUnlocked = false;
    const obsession = give(state, "obsession");
    state.fateDeck = [inst("taunt"), inst("peterPan")];

    let next = applyInput(state, { type: "selectCard", instanceId: obsession.instanceId });
    next = applyInput(next, { type: "acceptCondition" });
    expect(next.pending?.kind).toBe("fateReport");
    expect(next.peterPanLocation).toBe("hangmansTree");
    expect(next.locations.hangmansTree.heroes.some((hero) => hero.defId === "peterPan")).toBe(true);
    expect(next.fateDiscard.some((card) => card.defId === "peterPan")).toBe(false);
    expect(next.fateDiscard.some((card) => card.defId === "taunt")).toBe(true);
    expect(next.hangmansUnlocked).toBe(false);

    const held = barePlayState();
    held.hangmansUnlocked = false;
    held.phase = "resolving";
    const peter = inst("peterPan");
    held.heldCard = peter;
    held.pending = { kind: "obsessionDecide", heroId: peter.instanceId, extras: [] };
    const html = renderOverlay(held);
    expect(html).toContain("must be played");
    expect(html).not.toContain("data-discard-hero");

    const seated = applyInput(held, { type: "playOrDiscardHero", play: false });
    expect(seated.peterPanLocation).toBe("hangmansTree");
    expect(seated.fateDiscard.some((card) => card.instanceId === peter.instanceId)).toBe(false);
    expect(seated.pending?.kind).toBe("fateReport");
    const why = explainSelection(held, { type: "playOrDiscardHero", play: false }, seated);
    expect(why?.chose).toMatch(/Hangman’s Tree|Hangman's Tree/);
    expect(why?.why).toMatch(/must be played/);
  });
});

describe("Cunning Accept, Cancel, and Escape", () => {
  function cunningReady() {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    putHero(state, "tickTock", "skullRock");
    const cunning = give(state, "cunning");
    const brute = give(state, "pirateBrute");
    return { state, cunning, brute };
  }

  it("logs Accept and keeps Cunning spent when the free Ally is declined", () => {
    const { state, cunning, brute } = cunningReady();
    const offered = applyInput(state, { type: "selectCard", instanceId: cunning.instanceId });
    expect(offered.pending?.kind).toBe("conditionOffer");
    const accepted = applyInput(offered, { type: "acceptCondition" });
    expect(accepted.pending?.kind).toBe("cunningAlly");
    expect(accepted.log.some((entry) => /Cunning is played/.test(entry.text))).toBe(true);
    expect(accepted.villainDiscard.some((card) => card.instanceId === cunning.instanceId)).toBe(true);
    expect(accepted.hand.some((card) => card.instanceId === brute.instanceId)).toBe(true);
    expect(promptText(accepted)).toMatch(/already played/);
    expect(advise(accepted).why).toMatch(/does not return the Condition/);

    const declined = applyInput(accepted, { type: "cancel" });
    expect(declined.pending).toBeNull();
    expect(declined.phase).toBe("actions");
    expect(declined.hand.some((card) => card.instanceId === cunning.instanceId)).toBe(false);
    expect(declined.villainDiscard.some((card) => card.instanceId === cunning.instanceId)).toBe(true);
    expect(declined.hand.some((card) => card.instanceId === brute.instanceId)).toBe(true);
    expect(declined.locations.jollyRoger.allies).toHaveLength(0);
    expect(declined.bannerNote).toMatch(/declined the free Ally/);
    expect(declined.log.some((entry) => /stays in the discard/.test(entry.text))).toBe(true);

    const reason = explainSelection(accepted, { type: "cancel" }, declined);
    expect(reason?.chose).toMatch(/declined the free Ally/);
    expect(reason?.why).toMatch(/does not put the Condition back/);
  });

  it("returns to the Ally choice when Cancel happens after the Ally is chosen", () => {
    const { state, cunning, brute } = cunningReady();
    let next = applyInput(state, { type: "selectCard", instanceId: cunning.instanceId });
    next = applyInput(next, { type: "acceptCondition" });
    const placing = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    expect(placing.pending?.kind).toBe("cunningLocation");
    expect([...highlightSet(placing)]).toEqual(["loc:jollyRoger"]);

    const back = applyInput(placing, { type: "cancel" });
    expect(back.pending?.kind).toBe("cunningAlly");
    expect(back.hand.some((card) => card.instanceId === brute.instanceId)).toBe(true);
    expect(back.villainDiscard.some((card) => card.instanceId === cunning.instanceId)).toBe(true);
    expect(back.bannerNote).toMatch(/does not return/);
    const reason = explainSelection(placing, { type: "cancel" }, back);
    expect(reason?.chose).toMatch(/Ally choice/);
    expect(reason?.why).toMatch(/does not return/);
  });

  it("keeps the Condition offer open when End turn arrives early", () => {
    const { state, cunning, brute } = cunningReady();
    const offered = applyInput(state, { type: "selectCard", instanceId: cunning.instanceId });
    expect(offered.pending?.kind).toBe("conditionOffer");
    const ended = applyInput(offered, { type: "endTurn" });
    expect(ended.pending?.kind).toBe("conditionOffer");
    expect(ended.phase).toBe("actions");
    expect(ended.turn).toBe(offered.turn);
    expect(ended.hand.map((card) => card.instanceId)).toEqual(offered.hand.map((card) => card.instanceId));
    expect(ended.hand.some((card) => card.instanceId === cunning.instanceId)).toBe(true);
    expect(ended.hand.some((card) => card.instanceId === brute.instanceId)).toBe(true);
    expect(ended.villainDiscard.some((card) => card.instanceId === cunning.instanceId)).toBe(false);
    expect(explainSelection(offered, { type: "endTurn" }, ended)).toBeNull();
  });

  it("treats Cancel during the offer like Not now and leaves the Condition in hand", () => {
    const { state, cunning } = cunningReady();
    const offered = applyInput(state, { type: "selectCard", instanceId: cunning.instanceId });
    expect(offered.pending?.kind).toBe("conditionOffer");
    const dismissed = applyInput(offered, { type: "cancel" });
    expect(dismissed.pending).toBeNull();
    expect(dismissed.hand.some((card) => card.instanceId === cunning.instanceId)).toBe(true);
    expect(dismissed.villainDiscard.some((card) => card.defId === "cunning")).toBe(false);
    expect(dismissed.log.some((entry) => /stays in hand/.test(entry.text))).toBe(true);
    const reason = explainSelection(offered, { type: "cancel" }, dismissed);
    expect(reason?.why).toMatch(/stays in hand/);
  });
});

describe("Allies and Items play where the captain stands", () => {
  it("rejects another shore for Play a Card and still lets Fate seat a Hero anywhere unlocked", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 2;
    state.hangmansUnlocked = false;
    const smee = give(state, "smee");
    expect(legalPlayLocations(state)).toEqual(["skullRock"]);

    let placing = applyInput(state, { type: "selectAction", actionKey: "sr-play" });
    placing = applyInput(placing, { type: "selectCard", instanceId: smee.instanceId });
    expect(placing.pending?.kind).toBe("playChooseLocation");
    expect(highlightSet(placing).has("loc:skullRock")).toBe(true);
    expect(highlightSet(placing).has("loc:jollyRoger")).toBe(false);
    expect(promptText(placing)).toMatch(/where the captain stands/);

    const ignored = applyInput(placing, { type: "selectLocation", locationId: "jollyRoger" });
    expect(ignored.pending?.kind).toBe("playChooseLocation");
    expect(ignored.hand.some((card) => card.instanceId === smee.instanceId)).toBe(true);

    const fate = barePlayState();
    fate.villainLocation = "skullRock";
    fate.phase = "actions";
    fate.hangmansUnlocked = true;
    fate.fateDeck = [inst("wendy"), inst("john")];
    let heroPick = applyInput(fate, { type: "selectAction", actionKey: "sr-fate" });
    if (heroPick.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const wendy = heroPick.pending.cards.find((card) => card.defId === "wendy")!;
    heroPick = applyInput(heroPick, { type: "selectCard", instanceId: wendy.instanceId });
    expect(heroPick.pending?.kind).toBe("fateChooseLocation");
    expect(highlightSet(heroPick).has("loc:jollyRoger")).toBe(true);
    expect(highlightSet(heroPick).has("loc:mermaidLagoon")).toBe(true);
    expect(highlightSet(heroPick).has("loc:hangmansTree")).toBe(true);
    const seated = applyInput(heroPick, { type: "selectLocation", locationId: "jollyRoger" });
    expect(seated.locations.jollyRoger.heroes.some((hero) => hero.instanceId === wendy.instanceId)).toBe(true);
  });
});

describe("Boarding Party far-side reach", () => {
  it("does not let the Hero’s other neighbor carry the clash", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const john = putHero(state, "john", "skullRock");
    putAlly(state, "boardingParty", "mermaidLagoon");
    putAlly(state, "swashbuckler", "skullRock");
    expect(vanquishableHeroes(state).some((hero) => hero.hero.instanceId === john.instanceId)).toBe(false);

    const withCaptain = barePlayState();
    withCaptain.villainLocation = "jollyRoger";
    withCaptain.phase = "actions";
    const neighbor = putHero(withCaptain, "john", "skullRock");
    putAlly(withCaptain, "boardingParty", "jollyRoger");
    expect(vanquishableHeroes(withCaptain).some((hero) => hero.hero.instanceId === neighbor.instanceId)).toBe(true);
  });
});
