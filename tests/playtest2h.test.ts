/**
 * @vitest-environment jsdom
 *
 * Playtest Musts: Map pays only for another Item, a one-card Scare peek
 * does not duplicate that Fate card, and Cunning's gold outline is the Ally in hand.
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, highlightSet } from "../src/engine/game";
import { playableHandCards, promptText } from "../src/engine/queries";
import { explainSelection } from "../src/engine/moveReason";
import { renderOverlay } from "../src/ui/app";
import { dropTargets } from "../src/ui/drag";
import { barePlayState, give, inst, putAlly, putHero, putItem } from "./helpers";

describe("Map payment is Item-only", () => {
  it("does not discard the Map to play an Ally", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.power = 4;
    const smee = give(state, "smee");
    const map = putItem(state, "neverLandMap", "skullRock");
    let choosing = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    choosing = applyInput(choosing, { type: "selectCard", instanceId: smee.instanceId });
    const next = applyInput(choosing, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.pending?.kind).toBe("playChoosePayment");
    expect(promptText(next)).not.toMatch(/discard the Never Land Map/i);
    expect(renderOverlay(next)).not.toContain("data-pay-map");
    expect(advise(next).highlights).not.toContain("btn:pay-map");
    expect(advise(next).highlights).toContain("btn:pay-power");

    const refused = applyInput(next, { type: "payWithMap" });
    expect(refused.power).toBe(4);
    expect(refused.pending?.kind).toBe("playChoosePayment");
    expect(refused.hand.some((c) => c.instanceId === smee.instanceId)).toBe(true);
    expect(refused.locations.skullRock.items.some((c) => c.instanceId === map.instanceId)).toBe(true);

    const reason = explainSelection(choosing, { type: "selectLocation", locationId: "jollyRoger" }, next);
    expect(`${reason?.why ?? ""} ${reason?.next ?? ""}`).not.toMatch(/discard the Never Land Map/i);
  });

  it("does not discard the Map to play an Effect", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.power = 2;
    const scare = give(state, "giveThemAScare");
    const map = putItem(state, "neverLandMap", "skullRock");
    state.fateDeck = [inst("taunt"), inst("pixieDust")];
    let next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: scare.instanceId });
    expect(next.pending?.kind).toBe("playChoosePayment");
    expect(renderOverlay(next)).not.toContain("data-pay-map");
    const refused = applyInput(next, { type: "payWithMap" });
    expect(refused.pending?.kind).toBe("playChoosePayment");
    expect(refused.locations.skullRock.items.some((c) => c.instanceId === map.instanceId)).toBe(true);
    expect(refused.power).toBe(2);
  });

  it("still lets the Map cover another Item when Power is short", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.power = 0;
    const cannon = give(state, "cannon");
    putItem(state, "neverLandMap", "skullRock");
    let next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: cannon.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.pending?.kind).toBe("playChoosePayment");
    expect(promptText(next)).toMatch(/discard the Never Land Map instead of paying for this Item/i);
    expect(renderOverlay(next)).toContain("data-pay-map");
    expect(advise(next).highlights).toContain("btn:pay-map");
    const paid = applyInput(next, { type: "payWithMap" });
    expect(paid.power).toBe(0);
    expect(paid.locations.jollyRoger.items.some((c) => c.instanceId === cannon.instanceId)).toBe(true);
    expect(paid.locations.skullRock.items.some((c) => c.defId === "neverLandMap")).toBe(false);
    expect(paid.villainDiscard.some((c) => c.defId === "neverLandMap")).toBe(true);
  });

  it("does not treat Cutlass as playable via the Map when no Ally is ashore", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.power = 0;
    const cutlass = give(state, "cutlass");
    putItem(state, "neverLandMap", "skullRock");
    expect(playableHandCards(state).some((c) => c.instanceId === cutlass.instanceId)).toBe(false);
    const opened = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    expect(opened.pending).toBeNull();
    expect(opened.bannerNote).toMatch(/Ally already ashore/i);
  });
});

describe("Give Them a Scare with one Fate card left", () => {
  it("puts that card back once when the return control repeats its id", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.power = 3;
    const scare = give(state, "giveThemAScare");
    const only = inst("peterPan");
    state.fateDeck = [only];
    let next = applyInput(state, { type: "selectAction", actionKey: "ml-play2" });
    next = applyInput(next, { type: "selectCard", instanceId: scare.instanceId });
    next = applyInput(next, { type: "payWithPower" });
    expect(next.pending?.kind).toBe("scarePeek");
    if (next.pending?.kind !== "scarePeek") return;
    expect(next.pending.cards).toHaveLength(1);

    const html = renderOverlay(next);
    expect(html).toContain("Put Peter Pan back on top");
    expect(html).toContain("Discard it");
    expect(html).not.toContain("Discard both");

    const returned = applyInput(next, { type: "scareReturn", order: [only.instanceId, only.instanceId] });
    expect(returned.fateDeck.map((c) => c.instanceId)).toEqual([only.instanceId]);
    expect(returned.pending).toBeNull();
    expect(returned.phase).toBe("actions");
  });

  it("does not eat the peeked cards when the return order does not match", () => {
    const state = barePlayState();
    state.phase = "resolving";
    state.actionKey = "ml-play2";
    const a = inst("wendy");
    const b = inst("john");
    state.pending = { kind: "scarePeek", cards: [a, b] };
    const refused = applyInput(state, { type: "scareReturn", order: [a.instanceId, a.instanceId] });
    expect(refused.pending?.kind).toBe("scarePeek");
    expect(refused.fateDeck).toHaveLength(0);
    expect(refused.fateDiscard).toHaveLength(0);
  });

  it("still stacks a two-card peek with the first named card on top", () => {
    const state = barePlayState();
    state.phase = "resolving";
    state.actionKey = "ml-play2";
    const wendy = inst("wendy");
    const john = inst("john");
    state.pending = { kind: "scarePeek", cards: [wendy, john] };
    const returned = applyInput(state, { type: "scareReturn", order: [john.instanceId, wendy.instanceId] });
    expect(returned.fateDeck.map((c) => c.defId)).toEqual(["john", "wendy"]);
    expect(returned.pending).toBeNull();
  });
});

describe("Cunning gold outline", () => {
  it("highlights the Ally in hand and ignores Allies already ashore", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.power = 0;
    const cunning = give(state, "cunning");
    const brute = give(state, "pirateBrute");
    const ashore = putAlly(state, "swashbuckler", "jollyRoger");
    putHero(state, "lostBoys", "skullRock");
    let next = applyInput(state, { type: "selectCard", instanceId: cunning.instanceId });
    next = applyInput(next, { type: "acceptCondition" });
    expect(next.pending?.kind).toBe("cunningAlly");
    const hi = highlightSet(next);
    expect(hi.has(`card:${brute.instanceId}`)).toBe(true);
    expect(hi.has(`card:${ashore.instanceId}`)).toBe(false);
    expect(dropTargets(next, ashore.instanceId).locations).toHaveLength(0);
    const clicked = applyInput(next, { type: "selectCard", instanceId: ashore.instanceId });
    expect(clicked.pending?.kind).toBe("cunningAlly");
    expect(clicked.hand.some((c) => c.instanceId === brute.instanceId)).toBe(true);
  });
});
