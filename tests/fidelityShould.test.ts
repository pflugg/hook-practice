import { describe, expect, it } from "vitest";
import { chooseAttachTarget, chooseHeadacheItem, scoreFateCard } from "../src/engine/fateAi";
import { applyInput, highlightSet } from "../src/engine/game";
import { allLocationItems, attachableHeroes } from "../src/engine/queries";
import { renderPlay } from "../src/ui/app";
import { attachTo, barePlayState, inst, putAlly, putHero } from "./helpers";

describe("Splitting Headache can target attached Items", () => {
  it("sees a strapped Cutlass as an Item ashore", () => {
    const state = barePlayState();
    const smee = putAlly(state, "smee", "jollyRoger");
    const cutlass = attachTo(state, "cutlass", smee.instanceId);
    expect(allLocationItems(state).some((i) => i.item.instanceId === cutlass.instanceId)).toBe(true);
    expect(chooseHeadacheItem(state)?.instanceId).toBe(cutlass.instanceId);
    expect(scoreFateCard(state, inst("splittingHeadache"))).toBeGreaterThan(0);
  });

  it("computer Fate strips the Cutlass when it is the only Item", () => {
    const state = barePlayState();
    state.difficulty = "normal";
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const smee = putAlly(state, "smee", "jollyRoger");
    const cutlass = attachTo(state, "cutlass", smee.instanceId);
    state.fateDeck = [inst("splittingHeadache"), inst("john")];

    const next = applyInput(state, { type: "endTurn" });
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.played?.defId).toBe("splittingHeadache");
    expect(next.pending.note).toMatch(/Cutlass/);
    expect(next.attachments.some((a) => a.item.instanceId === cutlass.instanceId)).toBe(false);
    expect(next.villainDiscard.some((c) => c.instanceId === cutlass.instanceId)).toBe(true);
    expect(next.locations.jollyRoger.allies.some((a) => a.instanceId === smee.instanceId)).toBe(true);
  });

  it("player Fate can discard a Fate attachment and it returns to the Fate discard", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    const wendy = putHero(state, "wendy", "skullRock");
    const dust = attachTo(state, "pixieDust", wendy.instanceId);
    state.fateDeck = [inst("splittingHeadache"), inst("john")];

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    if (next.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const headache = next.pending.cards.find((c) => c.defId === "splittingHeadache")!;
    next = applyInput(next, { type: "selectCard", instanceId: headache.instanceId });
    expect(next.pending?.kind).toBe("fateChooseItem");
    expect(highlightSet(next).has(`card:${dust.instanceId}`)).toBe(true);

    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain(`data-card="${dust.instanceId}"`);
    expect(html).toMatch(new RegExp(`is-legal[^>]*data-card="${dust.instanceId}"|data-card="${dust.instanceId}"[^>]*is-legal`));

    next = applyInput(next, { type: "selectCard", instanceId: dust.instanceId });
    expect(next.pending?.kind).toBe("fateReport");
    expect(next.attachments.some((a) => a.item.instanceId === dust.instanceId)).toBe(false);
    expect(next.fateDiscard.some((c) => c.instanceId === dust.instanceId)).toBe(true);
    expect(next.villainDiscard.some((c) => c.instanceId === dust.instanceId)).toBe(false);
  });
});

describe("Pixie Dust does not attach to Peter on the locked hideout", () => {
  it("Normal AI fizzles Pixie Dust when Peter is the only Hero and the tree is locked", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    putHero(state, "peterPan", "hangmansTree");
    expect(attachableHeroes(state, "pixieDust")).toHaveLength(0);
    expect(chooseAttachTarget(state, "normal", "pixieDust").hero).toBeNull();

    state.difficulty = "normal";
    state.phase = "actions";
    state.fateDeck = [inst("pixieDust"), inst("pixieDust")];
    const next = applyInput(state, { type: "endTurn" });
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.played?.defId).toBe("pixieDust");
    expect(next.pending.note).toMatch(/no Hero to attach/i);
    expect(next.attachments).toHaveLength(0);
    expect(next.fateDiscard.some((c) => c.defId === "pixieDust")).toBe(true);
  });

  it("Normal AI attaches Pixie Dust to another Hero while locked-tree Peter is ashore", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.difficulty = "normal";
    putHero(state, "peterPan", "hangmansTree");
    const wendy = putHero(state, "wendy", "skullRock");
    const target = chooseAttachTarget(state, "normal", "pixieDust").hero;
    expect(target?.instanceId).toBe(wendy.instanceId);

    state.phase = "actions";
    state.fateDeck = [inst("pixieDust"), inst("john")];
    const next = applyInput(state, { type: "endTurn" });
    expect(next.attachments.some((a) => a.item.defId === "pixieDust" && a.attachedTo === wendy.instanceId)).toBe(true);
    expect(next.attachments.some((a) => a.attachedTo === next.locations.hangmansTree.heroes[0]?.instanceId)).toBe(false);
  });

  it("player Fate cannot strap Pixie Dust to locked-tree Peter, but Taunt still may", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.villainLocation = "skullRock";
    state.phase = "actions";
    const peter = putHero(state, "peterPan", "hangmansTree");
    const wendy = putHero(state, "wendy", "skullRock");
    state.fateDeck = [inst("pixieDust"), inst("taunt")];

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    if (next.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const dust = next.pending.cards.find((c) => c.defId === "pixieDust")!;
    next = applyInput(next, { type: "selectCard", instanceId: dust.instanceId });
    expect(next.pending?.kind).toBe("fateChooseAttach");
    expect(highlightSet(next).has(`card:${peter.instanceId}`)).toBe(false);
    expect(highlightSet(next).has(`card:${wendy.instanceId}`)).toBe(true);

    const ignored = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    expect(ignored.pending?.kind).toBe("fateChooseAttach");
    expect(ignored.attachments).toHaveLength(0);

    const state2 = barePlayState();
    state2.hangmansUnlocked = false;
    state2.villainLocation = "skullRock";
    state2.phase = "actions";
    const peter2 = putHero(state2, "peterPan", "hangmansTree");
    state2.fateDeck = [inst("taunt"), inst("john")];
    let tauntPlay = applyInput(state2, { type: "selectAction", actionKey: "sr-fate" });
    if (tauntPlay.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const taunt = tauntPlay.pending.cards.find((c) => c.defId === "taunt")!;
    tauntPlay = applyInput(tauntPlay, { type: "selectCard", instanceId: taunt.instanceId });
    expect(highlightSet(tauntPlay).has(`card:${peter2.instanceId}`)).toBe(true);
  });

  it("Pixie Dust may attach to Peter after the tree unlocks", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    const peter = putHero(state, "peterPan", "hangmansTree");
    expect(attachableHeroes(state, "pixieDust").some((h) => h.instanceId === peter.instanceId)).toBe(true);
    expect(chooseAttachTarget(state, "normal", "pixieDust").hero?.instanceId).toBe(peter.instanceId);
  });
});
