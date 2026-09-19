import { describe, expect, it } from "vitest";
import { def } from "../src/engine/cards";
import { chooseFateCard, scoreFateCard } from "../src/engine/fateAi";
import { applyInput, HEADACHE_NO_ITEM_NOTE } from "../src/engine/game";
import { promptText } from "../src/engine/queries";
import { advise } from "../src/engine/coach";
import { renderOverlay } from "../src/ui/app";
import { barePlayState, inst, putAlly, putHero } from "./helpers";

const HEADACHE_TEXT = def("splittingHeadache").text;

function realmWithPeopleNoItems() {
  const state = barePlayState();
  state.villainLocation = "jollyRoger";
  state.phase = "actions";
  putHero(state, "wendy", "skullRock");
  putAlly(state, "smee", "jollyRoger");
  return state;
}

function afterForcedComputerHeadache() {
  const state = realmWithPeopleNoItems();
  state.fateDeck = [inst("splittingHeadache"), inst("splittingHeadache")];
  return applyInput(state, { type: "endTurn" });
}

describe("computer Fate Splitting Headache with zero realm Items", () => {
  it("auto-discards into fateReport, never fateChooseItem", () => {
    const next = afterForcedComputerHeadache();
    expect(next.pending?.kind).toBe("fateReport");
    expect(next.pending?.kind).not.toBe("fateChooseItem");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.phase).toBe("fateAdversary");
    expect(next.pending.resume).toBe("nextTurn");
    expect(next.pending.played?.defId).toBe("splittingHeadache");
    expect(next.pending.note).toBe(HEADACHE_NO_ITEM_NOTE);
    expect(next.pending.note).toMatch(/No Item ashore — discarded/);
    expect(next.pending.abilityText).toContain(HEADACHE_TEXT);
    expect(next.pending.abilityText).toContain("Choose one Item");
    expect(next.log.some((e) => e.text.includes("No Item ashore — discarded"))).toBe(true);
    expect(LOCATION_IDS_HAVE_ITEMS(next)).toBe(false);
    expect(next.locations.skullRock.heroes.some((h) => h.defId === "wendy")).toBe(true);
    expect(next.locations.jollyRoger.allies.some((a) => a.defId === "smee")).toBe(true);
  });

  it("Continue begins a normal move phase; End turn does not immediately re-Fate", () => {
    const report = afterForcedComputerHeadache();
    const after = applyInput(report, { type: "acknowledgeFate" });
    expect(after.pending).toBeNull();
    expect(after.phase).toBe("move");
    expect(after.turn).toBe(report.turn + 1);

    const prematureEnd = applyInput(after, { type: "endTurn" });
    expect(prematureEnd.phase).toBe("move");
    expect(prematureEnd.pending).toBeNull();
    expect(prematureEnd.turn).toBe(after.turn);

    const moved = applyInput(after, { type: "selectLocation", locationId: "skullRock" });
    expect(moved.phase).toBe("actions");
    moved.fateDeck = [inst("wendy"), inst("john")];
    moved.fateDiscard = [];

    const secondFate = applyInput(moved, { type: "endTurn" });
    expect(secondFate.pending?.kind).toBe("fateReport");
    expect(secondFate.pending?.kind).not.toBe("fateChooseItem");
    if (secondFate.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(secondFate.pending.played?.defId).toBe("wendy");
    expect(secondFate.phase).toBe("fateAdversary");
  });

  it("End turn on the no-item report acknowledges once instead of re-Fating Headache", () => {
    const report = afterForcedComputerHeadache();
    const after = applyInput(report, { type: "endTurn" });
    expect(after.pending).toBeNull();
    expect(after.phase).toBe("move");
  });

  it("shows the full card text and Continue — not an item picker", () => {
    const next = afterForcedComputerHeadache();
    const html = renderOverlay(next);
    expect(html).toContain("No Item ashore — discarded");
    expect(html).toContain(HEADACHE_TEXT);
    expect(html).toContain("What it does");
    expect(html).toContain("data-ack");
    expect(html).toContain("Continue");
    expect(html).not.toContain("is-legal");
    expect(html).not.toContain("attach-list");
    expect(promptText(next)).toContain(HEADACHE_TEXT);
    const advice = advise(next);
    expect(advice.do).toMatch(/Continue/);
    expect(advice.highlights).toContain("btn:ack");
  });

  it("recovers a leftover fateChooseItem with zero items into fateReport", () => {
    const state = realmWithPeopleNoItems();
    const headache = inst("splittingHeadache");
    state.heldCard = headache;
    state.phase = "fateAdversary";
    state.pending = { kind: "fateChooseItem", cardId: headache.instanceId, actor: "ai" };

    const recovered = applyInput(state, { type: "acknowledgeFate" });
    expect(recovered.pending).toBeNull();
    expect(recovered.phase).toBe("move");
    expect(recovered.fateDiscard.some((c) => c.instanceId === headache.instanceId)).toBe(true);
  });
});

describe("player Fate Splitting Headache with zero realm Items", () => {
  it("auto-finishes into fateReport instead of an item picker", () => {
    const state = realmWithPeopleNoItems();
    state.villainLocation = "skullRock";
    state.fateDeck = [inst("splittingHeadache"), inst("john")];

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    expect(next.pending?.kind).toBe("fateChooseCard");
    if (next.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const headache = next.pending.cards.find((c) => c.defId === "splittingHeadache")!;

    next = applyInput(next, { type: "selectCard", instanceId: headache.instanceId });
    expect(next.pending?.kind).toBe("fateReport");
    expect(next.pending?.kind).not.toBe("fateChooseItem");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.resume).toBe("actions");
    expect(next.pending.markAction).toBe(true);
    expect(next.pending.note).toBe(HEADACHE_NO_ITEM_NOTE);
    expect(next.pending.abilityText).toContain(HEADACHE_TEXT);

    const after = applyInput(next, { type: "acknowledgeFate" });
    expect(after.pending).toBeNull();
    expect(after.phase).toBe("actions");
    expect(after.usedActions).toContain("sr-fate");
  });
});

describe("Fate AI skips Headache when the shore has no Items", () => {
  it("deprioritizes Headache hard and plays the other card", () => {
    const state = realmWithPeopleNoItems();
    const headache = inst("splittingHeadache");
    const wendy = inst("wendy");
    expect(scoreFateCard(state, headache)).toBeLessThan(-100);
    const pick = chooseFateCard(state, [headache, wendy], "normal");
    expect(pick.card.defId).toBe("wendy");
    const easy = chooseFateCard(state, [headache, wendy], "easy");
    expect(easy.card.defId).toBe("wendy");
  });
});

function LOCATION_IDS_HAVE_ITEMS(state: ReturnType<typeof barePlayState>): boolean {
  return (["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const).some(
    (id) => state.locations[id].items.length > 0,
  );
}
