/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, createGame, highlightSet } from "../src/engine/game";
import { availableActions } from "../src/engine/queries";
import { explainSelection } from "../src/engine/moveReason";
import { bounceLoopScene, tauntDigScene } from "../src/engine/scenes";
import type { LocationId } from "../src/engine/types";
import { renderPlay } from "../src/ui/app";
import { barePlayState, give, putAlly, putHero, putItem } from "./helpers";

function expectLegalHighlights(state: ReturnType<typeof barePlayState>, highlights: string[]) {
  const legal = highlightSet(state);
  for (const key of highlights) {
    if (key.startsWith("btn:")) continue;
    expect(legal.has(key), `${key} should be a legal highlight`).toBe(true);
  }
}

describe("coach suggestions", () => {
  it("recommends Mermaid Lagoon on the opening move", () => {
    const opening = createGame("normal", 7);
    expect(opening.phase).toBe("move");
    expect(opening.villainLocation).toBe("jollyRoger");
    expect(opening.power).toBe(0);

    const advice = advise(opening);
    expect(advice.do).toMatch(/Mermaid Lagoon/);
    expect(advice.highlights).toContain("loc:mermaidLagoon");
    expect(advice.why).toMatch(/Power|Map|Hangman’s Tree|Hangman's Tree/i);
    expectLegalHighlights(opening, advice.highlights);

    const scripted = barePlayState();
    scripted.phase = "move";
    scripted.villainLocation = "jollyRoger";
    scripted.power = 0;
    scripted.pending = null;
    const again = advise(scripted);
    expect(again.highlights).toContain("loc:mermaidLagoon");
  });

  it("recommends playing the Never Land Map when it is in hand with enough Power", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 4;
    const map = give(state, "neverLandMap");

    const before = advise(state);
    expect(before.do).toMatch(/Play a Card/i);
    expect(before.do).toMatch(/Never Land Map/);
    expect(before.do).toMatch(/click/i);
    expect(before.highlights).toContain("act:sr-play");
    expect(before.why).toMatch(/Map|Hangman’s Tree|Hangman's Tree/i);
    expectLegalHighlights(state, before.highlights);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "sr-play" });
    const pick = advise(choosing);
    expect(pick.do).toMatch(/Never Land Map/);
    expect(pick.do).toMatch(/click/i);
    expect(pick.do).toMatch(/Choose this place/i);
    expect(pick.highlights).toContain(`card:${map.instanceId}`);
    expectLegalHighlights(choosing, pick.highlights);

    const placing = applyInput(choosing, { type: "selectCard", instanceId: map.instanceId });
    const drop = advise(placing);
    expect(drop.do).toMatch(/Never Land Map/);
    expect(drop.do).toMatch(/Skull Rock|Jolly Roger|Mermaid Lagoon|Hangman/);
    expect(drop.do).toMatch(/Choose this place/i);
    expect(drop.highlights.some((h) => h.startsWith("loc:"))).toBe(true);
    expectLegalHighlights(placing, drop.highlights);
  });

  it("gives full play-card directions naming the card, place, and next clicks", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 2;
    state.hangmansUnlocked = true;
    give(state, "boardingParty");

    const advice = advise(state);
    expect(advice.do).toMatch(/Boarding Party/);
    expect(advice.do).toMatch(/Jolly Roger/);
    expect(advice.do).toMatch(/Play a Card/);
    expect(advice.do).toMatch(/click/i);
    expect(advice.do).toMatch(/Choose this place/i);
    expect(advice.do).not.toMatch(/where it would help|if it helps/i);
    expect(advice.highlights).toContain("act:ml-play1");
    expectLegalHighlights(state, advice.highlights);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "ml-play1" });
    const pick = advise(choosing);
    expect(pick.do).toMatch(/Boarding Party/);
    expect(pick.do).toMatch(/Jolly Roger/);
    expect(pick.do).toMatch(/click/i);
    expect(pick.do).toMatch(/Choose this place/i);
    expectLegalHighlights(choosing, pick.highlights);
  });

  it("gives full move-then-act directions when Peter waits at the tree", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    putHero(state, "peterPan", "hangmansTree");

    const advice = advise(state);
    expect(advice.do).toMatch(/Move to Hangman’s Tree|Hangman's Tree/);
    expect(advice.do).toMatch(/Move here/i);
    expect(advice.do).toMatch(/Move a Hero/);
    expect(advice.do).toMatch(/Peter/);
    expect(advice.highlights).toContain("loc:hangmansTree");
    expectLegalHighlights(state, advice.highlights);
  });

  it("walks Peter from an unlocked Hangman’s Tree toward the ship", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    const peter = putHero(state, "peterPan", "hangmansTree");

    const start = advise(state);
    expect(start.do).toMatch(/Move a Hero/);
    expect(start.highlights).toContain("act:ht-moveHero");
    expect(start.why).toMatch(/Peter|Jolly Roger/i);
    expectLegalHighlights(state, start.highlights);

    const picking = applyInput(state, { type: "selectAction", actionKey: "ht-moveHero" });
    const hero = advise(picking);
    expect(hero.do).toMatch(/Peter Pan/);
    expect(hero.highlights).toContain(`card:${peter.instanceId}`);
    expectLegalHighlights(picking, hero.highlights);

    const dest = applyInput(picking, { type: "selectCard", instanceId: peter.instanceId });
    const step = advise(dest);
    expect(step.do).toMatch(/Mermaid Lagoon/);
    expect(step.highlights).toContain("loc:mermaidLagoon");
    expectLegalHighlights(dest, step.highlights);
  });

  it("during move, sends the captain to Hangman’s Tree when Peter is waiting there", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    putHero(state, "peterPan", "hangmansTree");

    const advice = advise(state);
    expect(advice.do).toMatch(/Hangman’s Tree|Hangman's Tree/);
    expect(advice.highlights).toContain("loc:hangmansTree");
    expectLegalHighlights(state, advice.highlights);
  });

  it("warns about Tick Tock and still highlights a safe opening move", () => {
    const state = barePlayState();
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    state.power = 0;
    putHero(state, "tickTock", "skullRock");

    const advice = advise(state);
    expect(advice.highlights).toContain("loc:mermaidLagoon");
    expect(advice.highlights).not.toContain("loc:skullRock");
    expect(advice.warning ?? "").toMatch(/Tick Tock/);
  });

  it("does not warn that sliding Tick Tock onto the captain empties the hand", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    putHero(state, "tickTock", "mermaidLagoon");
    putHero(state, "peterPan", "hangmansTree");

    const advice = advise(state);
    expect(advice.do).toMatch(/Move a Hero/);
    expect(advice.warning ?? "").not.toMatch(/slide Tick Tock onto the captain/i);
    expect(advice.warning ?? "").not.toMatch(/empties the hand/i);
  });

  it("does not gold-CTA sliding Tick Tock onto the captain", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "resolving";
    const tick = putHero(state, "tickTock", "skullRock");
    state.pending = { kind: "moveHeroDest", heroId: tick.instanceId };

    const advice = advise(state);
    expect(advice.highlights).not.toContain("loc:jollyRoger");
    expect(advice.highlights.some((h) => h.startsWith("loc:"))).toBe(true);
    expect(advice.warning ?? "").not.toMatch(/empties the hand/i);
    expect(advice.warning ?? "").not.toMatch(/slide Tick Tock onto the captain/i);
  });

  it("does not say the Map is affordable when it is absent from hand and realm", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 1;
    state.hangmansUnlocked = false;
    expect(state.hand.some((c) => c.defId === "neverLandMap")).toBe(false);

    const advice = advise(state);
    expect(advice.do).toMatch(/Gain 1/);
    expect(advice.why).not.toMatch(/Map is affordable/i);
    expect(advice.why).toMatch(/reserve|Item|Ally/i);
  });

  it("does say the Map is affordable when it is in hand and Power is short", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 2;
    state.hangmansUnlocked = false;
    give(state, "neverLandMap");

    const advice = advise(state);
    expect(advice.do).toMatch(/Gain 1/);
    expect(advice.why).toMatch(/Map is affordable/);
  });

  it("prefers paying Power so the Map stays in the realm", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "resolving";
    state.power = 2;
    const cannon = give(state, "cannon");
    state.pending = { kind: "playChoosePayment", cardId: cannon.instanceId, locationId: "jollyRoger" };

    const advice = advise(state);
    expect(advice.do).toMatch(/Power/);
    expect(advice.highlights).toContain("btn:pay-power");
  });

  it("does not gold-CTA locked Hangman’s Tree as an Aye Aye destination", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.phase = "resolving";
    const ally = putAlly(state, "swashbuckler", "mermaidLagoon");
    state.pending = { kind: "ayeAyeDest", allyId: ally.instanceId };

    const advice = advise(state);
    expect(advice.highlights).not.toContain("loc:hangmansTree");
    expect(advice.highlights).toContain("loc:skullRock");
    expectLegalHighlights(state, advice.highlights);
    expect(highlightSet(state).has("loc:hangmansTree")).toBe(false);
  });

  it("never suggests Move a Hero unless that action is available at the captain's place", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 4;
    putHero(state, "peterPan", "skullRock");
    putHero(state, "michael", "mermaidLagoon");
    putItem(state, "hooksCase", "mermaidLagoon");
    putItem(state, "hooksCase", "mermaidLagoon");

    const acts = availableActions(state).filter((a) => a.available);
    expect(acts.some((a) => a.kind === "moveHero")).toBe(false);

    const advice = advise(state);
    expect(advice.do).not.toMatch(/Move a Hero|Move Peter/i);
    expect(advice.highlights.some((h) => h.includes("moveHero"))).toBe(false);
    expectLegalHighlights(state, advice.highlights);

    const atTree = structuredClone(state);
    atTree.villainLocation = "hangmansTree";
    const treeAdvice = advise(atTree);
    expect(treeAdvice.do).toMatch(/Move a Hero/);
    expect(treeAdvice.highlights).toContain("act:ht-moveHero");
    expectLegalHighlights(atTree, treeAdvice.highlights);
  });

  it("names real Gain tokens and never invents a fused Gain 3", () => {
    const onlyCases = barePlayState();
    onlyCases.hangmansUnlocked = true;
    onlyCases.villainLocation = "mermaidLagoon";
    onlyCases.phase = "actions";
    onlyCases.power = 2;
    putHero(onlyCases, "peterPan", "skullRock");
    putItem(onlyCases, "hooksCase", "mermaidLagoon");
    putItem(onlyCases, "hooksCase", "mermaidLagoon");
    onlyCases.usedActions = ["ml-gain"];

    const leftover = availableActions(onlyCases).filter((a) => a.available && a.kind === "gainPower");
    expect(leftover.every((a) => (a.amount ?? 1) === 1)).toBe(true);
    expect(leftover.some((a) => a.amount === 3)).toBe(false);

    const caseAdvice = advise(onlyCases);
    expect(caseAdvice.do).toMatch(/Gain 1 \(Case\)/);
    expect(caseAdvice.do).not.toMatch(/Gain 3/);
    expect(caseAdvice.why).toMatch(/Gain 1 \(Case\)/);
    expect(caseAdvice.why).not.toMatch(/fused|Gain 3/);
    expectLegalHighlights(onlyCases, caseAdvice.highlights);

    const skull = barePlayState();
    skull.villainLocation = "skullRock";
    skull.phase = "actions";
    skull.power = 1;
    skull.hangmansUnlocked = false;
    putItem(skull, "hooksCase", "skullRock");
    putItem(skull, "hooksCase", "skullRock");

    const skullGains = availableActions(skull).filter((a) => a.available && a.kind === "gainPower");
    expect(skullGains.some((a) => (a.amount ?? 1) === 3)).toBe(false);
    const skullAdvice = advise(skull);
    expect(skullAdvice.do).toMatch(/Gain 1/);
    expect(skullAdvice.do).not.toMatch(/Gain 3/);
    expectLegalHighlights(skull, skullAdvice.highlights);

    const lagoon = barePlayState();
    lagoon.villainLocation = "mermaidLagoon";
    lagoon.phase = "actions";
    lagoon.power = 0;
    lagoon.hangmansUnlocked = false;
    const printed = availableActions(lagoon).find((a) => a.key === "ml-gain");
    expect(printed?.available).toBe(true);
    expect(printed?.amount).toBe(3);
    const lagoonAdvice = advise(lagoon);
    if (lagoonAdvice.do.includes("Gain")) {
      expect(lagoonAdvice.do).toMatch(/Gain 3/);
      expect(lagoonAdvice.highlights).toContain("act:ml-gain");
    }
    expectLegalHighlights(lagoon, lagoonAdvice.highlights);
  });

  it("names a real Ally and place for Cutlass, never “best place”", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 1;
    const cutlass = give(state, "cutlass");
    putAlly(state, "boardingParty", "jollyRoger");
    putAlly(state, "swashbuckler", "skullRock");

    const open = advise(state);
    expect(open.do).toMatch(/Cutlass/);
    expect(open.do).toMatch(/Boarding Party/);
    expect(open.do).toMatch(/Jolly Roger/);
    expect(open.do).not.toMatch(/best place/i);
    expect(open.do).not.toMatch(/strap it to an Ally/i);
    expectLegalHighlights(state, open.highlights);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    const pick = advise(choosing);
    expect(pick.do).toMatch(/Boarding Party/);
    expect(pick.do).toMatch(/Jolly Roger/);
    expect(pick.do).not.toMatch(/best place/i);
    expectLegalHighlights(choosing, pick.highlights);

    const attaching = applyInput(choosing, { type: "selectCard", instanceId: cutlass.instanceId });
    expect(attaching.pending?.kind).toBe("playChooseAllyAttach");
    const strap = advise(attaching);
    expect(strap.do).toMatch(/Strap the Cutlass to Boarding Party at the Jolly Roger/);
    expect(strap.do).toMatch(/click Boarding Party in the ally picker \/ drag Cutlass onto Boarding Party/);
    expect(strap.do).not.toMatch(/best place/i);
    expect(strap.why).toMatch(/Boarding Party at the Jolly Roger/);
    expect(strap.why).not.toMatch(/best place|somewhere useful/i);
    expectLegalHighlights(attaching, strap.highlights);
  });

  it("does not say Play a costly card when Power cannot cover it", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    state.peterPanRevealed = false;
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.do).not.toMatch(/Play Pirate Brute/i);
    expect(advice.do).not.toMatch(/Take Fate/i);
    expect(advice.do).toMatch(/Gain/);
    expect(advice.why).toMatch(/3 Power/);
    expect(advice.why).toMatch(/Save Pirate Brute/);
    expectLegalHighlights(state, advice.highlights);

    state.usedActions = ["sr-gain"];
    const dig = advise(state);
    expect(dig.do).not.toMatch(/Play Pirate Brute/i);
    expect(dig.do).toMatch(/Discard Pirate Brute at Skull Rock/);
    expect(dig.do).toMatch(/click Pirate Brute/i);
    expect(dig.do).toMatch(/Confirm/);
    expect(dig.why).toMatch(/0 Power/);
    expect(dig.why).toMatch(/Pirate Brute costs 3/);
    expect(dig.why).toMatch(/Discard Pirate Brute/);
    expect(dig.do).not.toMatch(/something/i);
    expect(dig.why).not.toMatch(/something/i);
    expectLegalHighlights(state, dig.highlights);
  });

  it("names a concrete Discard when a low-Power hand holds a costly Ally", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 1;
    state.hangmansUnlocked = false;
    state.peterPanRevealed = false;
    state.usedActions = ["sr-gain"];
    give(state, "boardingParty");
    give(state, "obsession");

    const advice = advise(state);
    expect(advice.do).not.toMatch(/Play Boarding Party/i);
    expect(advice.do).not.toMatch(/Take Fate/i);
    expect(advice.do).toMatch(/Discard Obsession at Skull Rock/);
    expect(advice.do).toMatch(/click Obsession/);
    expect(advice.do).toMatch(/Confirm/);
    expect(advice.do).not.toMatch(/click Boarding Party/i);
    expect(advice.do).not.toMatch(/something/i);
    expect(advice.why).toMatch(/1 Power/);
    expect(advice.why).toMatch(/Boarding Party costs 2/);
    expect(advice.why).toMatch(/Discard Obsession/);
    expect(advice.why).toMatch(/Map|crew/i);
    expect(advice.why).not.toMatch(/something/i);
    expect(advice.highlights).toContain("act:sr-discard");
    expectLegalHighlights(state, advice.highlights);
  });

  it("moves toward Power instead of naming an unaffordable Play", () => {
    const state = barePlayState();
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    state.power = 0;
    state.hangmansUnlocked = true;
    state.peterPanRevealed = false;
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.do).toMatch(/Move to Mermaid Lagoon/);
    expect(advice.do).toMatch(/Gain/);
    expect(advice.do).not.toMatch(/Play Pirate Brute/i);
    expect(advice.why).toMatch(/Save Pirate Brute for when you have 3 Power/);
    expectLegalHighlights(state, advice.highlights);
  });

  it("does not start a Cutlass strap when Power cannot pay and the Map cannot substitute", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    give(state, "cutlass");
    putAlly(state, "boardingParty", "jollyRoger");

    const advice = advise(state);
    expect(advice.do).not.toMatch(/Play Cutlass/i);
    expect(advice.do).not.toMatch(/strap/i);
    expect(advice.do).toMatch(/Gain|Discard/);
    expectLegalHighlights(state, advice.highlights);
  });

  it("does not CTA Cutlass when the Map could pay but Power is still short", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    give(state, "cutlass");
    putAlly(state, "boardingParty", "jollyRoger");
    putItem(state, "neverLandMap", "skullRock");

    const advice = advise(state);
    expect(advice.do).not.toMatch(/Play Cutlass/i);
    expect(advice.do).not.toMatch(/strap/i);
    expect(advice.do).toMatch(/Gain/);
    expect(advice.why).toMatch(/Cutlass/);
    expect(advice.why).toMatch(/0 Power/);
    expectLegalHighlights(state, advice.highlights);
  });

  it("plays an Ally instead of Cutlass when no Ally is ashore", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 1;
    state.hangmansUnlocked = true;
    give(state, "cutlass");
    give(state, "swashbuckler");

    const advice = advise(state);
    expect(advice.do).toMatch(/Play Swashbuckler/);
    expect(advice.do).not.toMatch(/Play Cutlass/i);
    expect(advice.do).not.toMatch(/strap/i);
    expectLegalHighlights(state, advice.highlights);
  });

  it("names a Cutlass dig when Power cannot pay and no Ally is ashore", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    state.usedActions = ["jr-gain"];
    give(state, "cutlass");

    const advice = advise(state);
    expect(advice.do).not.toMatch(/Play Cutlass/i);
    expect(advice.do).not.toMatch(/strap/i);
    expect(advice.do).toMatch(/Discard Cutlass at (the )?Jolly Roger/);
    expect(advice.do).toMatch(/click Cutlass/);
    expect(advice.do).toMatch(/0 Power|Ally already ashore/);
    expect(advice.why).toMatch(/Cutlass/);
    expect(advice.why).toMatch(/0 Power/);
    expect(advice.why).toMatch(/Ally already ashore/);
    expect(advice.do).not.toMatch(/Take Discard at .+ \(click that action\), then Confirm/);
    expectLegalHighlights(state, advice.highlights);
  });

  it("names the card and the reason whenever the headline says Discard", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    state.usedActions = ["sr-gain"];
    give(state, "cunning");
    give(state, "obsession");
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.do).toMatch(/\bDiscard\b/);
    const named = ["Cunning", "Obsession", "Pirate Brute"].filter((name) => advice.do.includes(name));
    expect(named.length).toBeGreaterThan(0);
    expect(advice.why).toMatch(new RegExp(named[0]!));
    expect(advice.do).not.toMatch(/^Discard\.?$/);
    expect(advice.do).not.toMatch(/Take Discard at .+ \(click that action\), then Confirm\./);
    expectLegalHighlights(state, advice.highlights);
  });

  it("still plays the card the captain can pay when a costlier card is also in hand", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 1;
    state.hangmansUnlocked = true;
    give(state, "pirateBrute");
    give(state, "swashbuckler");

    const advice = advise(state);
    expect(advice.do).toMatch(/Play Swashbuckler/);
    expect(advice.do).not.toMatch(/Play Pirate Brute/i);
    expectLegalHighlights(state, advice.highlights);
  });

  it("treats Fate as a hunt once Gain and Discard cannot fix an unaffordable hand", () => {
    const state = barePlayState();
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    state.power = 0;
    state.hangmansUnlocked = true;
    state.peterPanRevealed = false;
    state.usedActions = ["ht-gain"];
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.do).toMatch(/Fate/);
    expect(advice.do).not.toMatch(/Play Pirate Brute/i);
    expect(advice.why).toMatch(/Peter is still hidden/);
    expect(advice.why).toMatch(/does not pay for a card/);
    expect(advice.why).not.toMatch(/Fate pays|pay for Pirate Brute/i);
    expectLegalHighlights(state, advice.highlights);
  });

  it("names Tick Tock’s walk-on in the move why, and still avoids that square", () => {
    const state = barePlayState();
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    state.power = 0;
    putHero(state, "tickTock", "skullRock");

    const advice = advise(state);
    expect(advice.highlights).not.toContain("loc:skullRock");
    expect(advice.why).toMatch(/walk-on/i);
    expect(advice.why).toMatch(/moves onto/i);
    expect(advice.why).toMatch(/Seating or sliding/i);
    expectLegalHighlights(state, advice.highlights);
  });

  it("names Boarding Party neighboring reach when the Hero is one step away", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "resolving";
    state.pending = { kind: "vanquishHero" };
    const john = putHero(state, "john", "skullRock");
    putAlly(state, "boardingParty", "jollyRoger");

    const advice = advise(state);
    expect(advice.highlights).toContain(`card:${john.instanceId}`);
    expect(advice.why).toMatch(/neighboring reach/i);
    expect(advice.why).toMatch(/one unlocked step/i);
    expectLegalHighlights(state, advice.highlights);
  });

  it("recommends the ship clash when Peter is vanquishable at the Jolly Roger", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    putHero(state, "peterPan", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");

    const advice = advise(state);
    expect(advice.do).toMatch(/Vanquish/);
    expect(advice.highlights).toContain("act:jr-vanquish");
    expectLegalHighlights(state, advice.highlights);
  });
});

describe("coach bounce loop", () => {
  it("gains or explains, and does not pace Jolly Roger then Skull Rock", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.power = 10;
    state.hand = [];
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.departedFrom = "skullRock";
    putHero(state, "peterPan", "hangmansTree");

    const here = advise(state);
    const took =
      /Gain|Discard|Play|Vanquish/i.test(here.do) && !/End the turn/i.test(here.do);
    const endedClean = /End the turn/i.test(here.do) && /No Discard, Gain, or Play/i.test(here.why);
    expect(took || endedClean).toBe(true);
    expect(here.do).toMatch(/Gain/);

    const moving = structuredClone(state);
    moving.phase = "move";
    const moves: string[] = [];
    let acted = false;
    let current = moving;
    for (let step = 0; step < 8; step++) {
      if (current.pending) break;
      const advice = advise(current);
      if (current.phase === "move") {
        const loc = advice.highlights.find((h) => h.startsWith("loc:"))?.slice(4);
        expect(loc, advice.do).toBeTruthy();
        moves.push(loc!);
        current = applyInput(current, { type: "selectLocation", locationId: loc as LocationId });
        continue;
      }
      if (current.phase === "actions") {
        const act = advice.highlights.find((h) => h.startsWith("act:"))?.slice(4);
        if (act) {
          acted = true;
          current = applyInput(current, { type: "selectAction", actionKey: act });
          continue;
        }
        expect(advice.do).toMatch(/End the turn/i);
        expect(advice.why).toMatch(/No Discard, Gain, or Play/);
        current = applyInput(current, { type: "endTurn" });
        continue;
      }
      break;
    }

    expect(acted).toBe(true);
    expect(moves[0]).toBe("mermaidLagoon");
    expect(moves[0]).not.toBe("skullRock");
    expect(moves[1]).not.toBe("jollyRoger");
    expect(moves.slice(0, 2)).not.toEqual(["skullRock", "jollyRoger"]);
    expect(moves.slice(0, 2)).not.toEqual(["jollyRoger", "skullRock"]);
  });

  it("explains a forced return when the other step is Tick Tock", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.peterPanRevealed = true;
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    state.departedFrom = "skullRock";
    state.power = 10;
    state.hand = [];
    putHero(state, "tickTock", "mermaidLagoon");

    const advice = advise(state);
    expect(advice.highlights).toContain("loc:skullRock");
    expect(advice.highlights).not.toContain("loc:mermaidLagoon");
    expect(advice.why).toMatch(/Mermaid Lagoon has Tick Tock — stay one turn to Gain, don’t bounce/);
    expectLegalHighlights(state, advice.highlights);
  });

  it("still returns to Peter when Move a Hero is the reason to go back", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    state.departedFrom = "hangmansTree";
    putHero(state, "peterPan", "hangmansTree");

    const advice = advise(state);
    expect(advice.highlights).toContain("loc:hangmansTree");
    expect(advice.do).toMatch(/Move a Hero/);
    expectLegalHighlights(state, advice.highlights);
  });

  it("bounceloop scene banks Power and names the crocodile instead of ending", () => {
    const state = bounceLoopScene();
    expect(state.departedFrom).toBe("skullRock");
    expect(state.locations.skullRock.heroes.some((h) => h.defId === "tickTock")).toBe(true);

    const advice = advise(state);
    expect(advice.do).toMatch(/Gain/);
    expect(advice.do).not.toMatch(/End the turn/i);
    expect(advice.why).toMatch(/Skull Rock has Tick Tock — stay one turn to Gain, don’t bounce/);
    expectLegalHighlights(state, advice.highlights);

    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("Skull Rock has Tick Tock — stay one turn to Gain, don’t bounce");
    expect(html).toMatch(/Gain 1/);
    expect(html).not.toMatch(/End the turn \(click End turn\)/);
  });

  it("discards spent Obsession at covered Skull Rock instead of ending or returning to the ship", () => {
    const state = tauntDigScene();
    expect(state.locations.skullRock.heroes[0]?.defId).toBe("tinkerBell");
    expect(state.locations.jollyRoger.allies).toHaveLength(0);
    expect(state.hand.filter((card) => card.defId === "obsession")).toHaveLength(2);

    const advice = advise(state);
    expect(advice.do).toMatch(/Discard Obsession at Skull Rock/);
    expect(advice.do).toMatch(/click Obsession/);
    expect(advice.do).toMatch(/Confirm/);
    expect(advice.do).not.toMatch(/End the turn/i);
    expect(advice.do).not.toMatch(/Move to (the )?Jolly Roger/);
    expect(advice.do).not.toMatch(/click Cunning/);
    expect(advice.why).toMatch(/Obsession is spent/);
    expect(advice.why).toMatch(/Taunt/);
    expect(advice.why).toMatch(/dig for Allies/i);
    expect(advice.why).toMatch(/crew the ship/i);
    expect(advice.highlights).toContain("act:sr-discard");
    expectLegalHighlights(state, advice.highlights);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "sr-discard" });
    const named = advise(choosing);
    expect(named.do).toMatch(/Obsession/);
    expect(named.highlights.some((key) => key.startsWith("card:"))).toBe(true);
    expectLegalHighlights(choosing, named.highlights);

    const obsession = state.hand.find((card) => card.defId === "obsession");
    expect(obsession).toBeTruthy();
    const marked = applyInput(choosing, { type: "selectCard", instanceId: obsession!.instanceId });
    const markedWhy = explainSelection(choosing, { type: "selectCard", instanceId: obsession!.instanceId }, marked);
    expect(markedWhy?.why).toMatch(/dig for Allies/);
    expect(markedWhy?.why).not.toMatch(/dig for the Map/);

    const moving = structuredClone(state);
    moving.phase = "move";
    const move = advise(moving);
    expect(move.highlights).not.toContain("loc:jollyRoger");
    expect(move.highlights).not.toContain("loc:mermaidLagoon");
    expect(move.why).toMatch(/Don’t walk back to the ship|cannot start/);
    expectLegalHighlights(moving, move.highlights);

    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    expect(html).toContain("click Obsession");
    expect(html).toContain("dig for Allies");
    expect(html).not.toContain("End the turn (click End turn)");

    const before = structuredClone(state);
    before.phase = "move";
    before.villainLocation = "jollyRoger";
    const after = applyInput(before, { type: "selectLocation", locationId: "skullRock" });
    const reason = explainSelection(before, { type: "selectLocation", locationId: "skullRock" }, after);
    expect(reason?.why).toMatch(/crew about 0/);
    expect(reason?.why).toMatch(/dig or gain for Allies first/);
    expect(reason?.why).not.toMatch(/Vanquish him there to finish/);
    expect(state.log[0]?.text).toMatch(/Skull Rock/);
  });
});
