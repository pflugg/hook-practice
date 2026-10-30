/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, highlightSet } from "../src/engine/game";
import { availableActions } from "../src/engine/queries";
import type { GameState, LocationId } from "../src/engine/types";
import { attachTo, barePlayState, give, inst, putAlly, putHero, putItem } from "./helpers";

function landed(state: GameState, locationId: LocationId): GameState {
  let next = applyInput(state, { type: "selectLocation", locationId });
  if (next.pending?.kind === "fateReport") next = applyInput(next, { type: "acknowledgeFate" });
  return next;
}

function hasLiveAction(state: GameState): boolean {
  return availableActions(state).some((action) => action.available);
}

const RIVAL_CLOSE =
  "The rival villain is at 140 of 154. Finish Peter Pan at the Jolly Roger before that track fills.";

describe("coach tempo", () => {
  it("takes free Power before ending even when the rival is close", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "mermaidLagoon";
    state.power = 9;
    state.rivalProgress = 140;

    const advice = advise(state);
    expect(advice.highlights).toEqual(["act:ml-gain"]);
    expect(advice.do).toMatch(/Gain 3/);
    const gained = applyInput(state, { type: "selectAction", actionKey: "ml-gain" });
    expect(gained.power).toBe(12);
    expect(gained.rivalProgress).toBe(state.rivalProgress);
    expect(gained.turn).toBe(state.turn);
  });

  it("finishes a ready ship clash before collecting optional Power", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.power = 9;
    state.rivalProgress = 140;
    putHero(state, "peterPan", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");

    expect(advise(state).highlights).toEqual(["act:jr-vanquish"]);
  });

  it("warns in plain words when the rival track is close and stays quiet when it is empty", () => {
    const state = barePlayState();
    state.power = 12;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.rivalProgress = 0;

    const far = advise(state);
    expect(far.warning ?? "").not.toContain("The rival villain is at");

    state.rivalProgress = 140;
    const close = advise(state);
    expect(close.highlights).toEqual(["btn:end"]);
    expect(close.warning).toBe(RIVAL_CLOSE);
  });

  it("plays ship crew instead of a second Never Land Map once the tree is open", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 6;
    putHero(state, "peterPan", "jollyRoger");
    give(state, "neverLandMap");
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["act:jr-play"]);
    expect(advice.do).toContain("Pirate Brute");
    expect(advice.do).not.toContain("Never Land Map");
    expect(highlightSet(state).has("act:jr-play")).toBe(true);
  });

  it("keeps the ship crew for Peter instead of spending it on John", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 12;
    putHero(state, "peterPan", "jollyRoger");
    putHero(state, "john", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["btn:end"]);
    expect(advice.do).toContain("End the turn");
    expect(advice.do).not.toContain("Vanquish");
  });

  it("sails to the ship to play a payable Ally instead of a discard shore", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "hangmansTree";
    state.departedFrom = "jollyRoger";
    state.power = 4;
    putHero(state, "peterPan", "jollyRoger");
    give(state, "obsession");
    give(state, "pirateBrute");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:jollyRoger"]);
    expect(highlightSet(state).has("loc:jollyRoger")).toBe(true);
  });

  it("slides Tick Tock off the ship before boarding to play crew", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "mermaidLagoon";
    state.power = 4;
    putHero(state, "peterPan", "jollyRoger");
    const tick = putHero(state, "tickTock", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    give(state, "swashbuckler");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:hangmansTree"]);
    expect(advice.why).toContain("Tick Tock is on the Jolly Roger");
    expect(highlightSet(state).has("loc:hangmansTree")).toBe(true);

    state.phase = "actions";
    state.villainLocation = "hangmansTree";
    const slide = advise(state);
    expect(slide.highlights).toEqual(["act:ht-moveHero"]);
    expect(highlightSet(state).has("act:ht-moveHero")).toBe(true);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "ht-moveHero" });
    const hero = advise(choosing);
    expect(hero.highlights).toEqual([`card:${tick.instanceId}`]);
    expect(highlightSet(choosing).has(`card:${tick.instanceId}`)).toBe(true);
  });

  it("walks a taunted Tick Tock toward the ship before playing another Item", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "mermaidLagoon";
    state.power = 9;
    putHero(state, "peterPan", "jollyRoger");
    const tick = putHero(state, "tickTock", "hangmansTree");
    attachTo(state, "taunt", tick.instanceId);
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    give(state, "neverLandMap");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:hangmansTree"]);
    expect(advice.why).toContain("Taunt is on Tick Tock");
    expect(highlightSet(state).has("loc:hangmansTree")).toBe(true);

    state.phase = "actions";
    state.villainLocation = "hangmansTree";
    const walk = advise(state);
    expect(walk.highlights).toEqual(["act:ht-moveHero"]);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "ht-moveHero" });
    const hero = advise(choosing);
    expect(hero.highlights).toEqual([`card:${tick.instanceId}`]);
  });

  it("returns to a shore that still has an action instead of an empty ship", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "hangmansTree";
    state.departedFrom = "mermaidLagoon";
    state.power = 0;
    putHero(state, "peterPan", "jollyRoger");
    putHero(state, "tickTock", "skullRock");
    give(state, "pirateBrute");

    expect(hasLiveAction(landed(state, "jollyRoger"))).toBe(false);
    expect(hasLiveAction(landed(state, "mermaidLagoon"))).toBe(true);

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:mermaidLagoon"]);
    expect(highlightSet(state).has("loc:mermaidLagoon")).toBe(true);
    expect(advice.why).toBe(
      "Jolly Roger has no action you can take this turn. Mermaid Lagoon still has one. Tick Tock’s walk-on: skip Skull Rock. The hand empties only if the captain moves onto that place. Seating or sliding the crocodile onto the captain does not.",
    );
  });

  it("steps onto Tick Tock when that is the only shore with an action", () => {
    const state = barePlayState();
    state.phase = "move";
    state.villainLocation = "skullRock";
    state.departedFrom = "jollyRoger";
    state.power = 0;
    putHero(state, "john", "jollyRoger");
    putHero(state, "tickTock", "mermaidLagoon");
    give(state, "pirateBrute");

    expect(hasLiveAction(landed(state, "jollyRoger"))).toBe(false);
    expect(hasLiveAction(landed(state, "mermaidLagoon"))).toBe(true);

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:mermaidLagoon"]);
    expect(highlightSet(state).has("loc:mermaidLagoon")).toBe(true);
    expect(advice.why).toBe(
      "Jolly Roger has no action you can take this turn. Mermaid Lagoon still has one. Tick Tock’s walk-on is this step: moving the captain onto Mermaid Lagoon discards every card in hand. The hand empties only when the captain moves onto that place — seating or sliding the crocodile onto the captain does not.",
    );
    expect(advice.warning).toBe(
      "Every other shore has no action you can take this turn. This step lands on Tick Tock and discards the hand.",
    );
  });

  it("keeps a held Never Land Map off Tick Tock when the ship has no action", () => {
    const state = barePlayState();
    state.phase = "move";
    state.villainLocation = "skullRock";
    state.departedFrom = "jollyRoger";
    state.power = 0;
    putHero(state, "john", "jollyRoger");
    putHero(state, "tickTock", "mermaidLagoon");
    give(state, "pirateBrute");
    give(state, "neverLandMap");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:jollyRoger"]);
    expect(highlightSet(state).has("loc:jollyRoger")).toBe(true);
    expect(advice.why).toBe(
      "Jolly Roger has no action you can take this turn. Mermaid Lagoon still has one, but Tick Tock’s walk-on would discard the held Never Land Map with the whole hand. The Map stays in hand until Hangman’s Tree is open.",
    );
    expect(advice.warning).toBe(
      "Moving onto Tick Tock at Mermaid Lagoon discards your held Never Land Map with the whole hand. Seating or sliding the crocodile onto the captain does not empty the hand.",
    );
  });

  it("discards an Ally to dig for the Map when Peter is on the locked tree", () => {
    const state = barePlayState();
    state.phase = "actions";
    state.villainLocation = "skullRock";
    state.power = 12;
    state.peterPanRevealed = true;
    state.peterPanLocation = "hangmansTree";
    state.villainDeck = [inst("neverLandMap")];
    putHero(state, "peterPan", "hangmansTree");
    give(state, "boardingParty");
    give(state, "smee");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["act:sr-discard"]);
    expect(highlightSet(state).has("act:sr-discard")).toBe(true);
    expect(advice.do).toContain("Boarding Party");
    expect(advice.why).toBe(
      "The Never Land Map is still in the deck, and Peter is sitting on the locked tree. Discard Boarding Party to dig for the Map. The tree stays shut until the Map is played.",
    );
  });

  it("vanquishes a taunted Tick Tock on the ship before playing another Ally", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "actions";
    state.villainLocation = "jollyRoger";
    state.power = 4;
    state.rivalProgress = 140;
    putHero(state, "peterPan", "jollyRoger");
    const tick = putHero(state, "tickTock", "jollyRoger");
    attachTo(state, "taunt", tick.instanceId);
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    give(state, "swashbuckler");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["act:jr-vanquish"]);
    expect(highlightSet(state).has("act:jr-vanquish")).toBe(true);
    expect(advice.do).toContain("Tick Tock");
    expect(advice.why).toBe(
      "The rival track is close. Taunt is on Tick Tock at the Jolly Roger. Vanquish that Hero before Peter Pan. The clash spends Allies, and Peter cannot be finished while Taunt remains.",
    );
    expect(advice.warning).toContain("The rival villain is at 140 of 154.");
  });

  it("boards the ship to vanquish a taunted Tick Tock instead of sliding him away", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "skullRock";
    state.power = 4;
    state.rivalProgress = 140;
    putHero(state, "peterPan", "jollyRoger");
    const tick = putHero(state, "tickTock", "jollyRoger");
    attachTo(state, "taunt", tick.instanceId);
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putItem(state, "ingeniousDevice", "mermaidLagoon");
    give(state, "swashbuckler");

    const advice = advise(state);
    expect(advice.highlights).toEqual(["loc:jollyRoger"]);
    expect(highlightSet(state).has("loc:jollyRoger")).toBe(true);
    expect(advice.why).toBe(
      "The rival track is close. Taunt is on Tick Tock at the Jolly Roger. After you land, click Vanquish, then Tick Tock. Peter Pan cannot be finished while Taunt remains, so this clash comes before another Ally or another Gain. Tick Tock’s walk-on is this step: moving the captain onto the Jolly Roger discards every card in hand. The hand empties only when the captain moves onto that place — seating or sliding the crocodile onto the captain does not.",
    );
  });
});
