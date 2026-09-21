import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { endgameRecap } from "../src/engine/recap";
import { nearWinScene } from "../src/engine/scenes";
import { availableActions } from "../src/engine/queries";
import type { GameState, LocationId } from "../src/engine/types";
import { renderPlay } from "../src/ui/app";
import { barePlayState, give, putAlly, putHero, putItem } from "./helpers";

function acknowledge(state: GameState): GameState {
  if (state.pending?.kind === "fateReport") return applyInput(state, { type: "acknowledgeFate" });
  return state;
}

function silenceFate(state: GameState): void {
  state.fateDeck = [];
  state.fateDiscard = [];
}

function endAndMove(state: GameState, dest: LocationId): GameState {
  let next = applyInput(state, { type: "endTurn" });
  next = acknowledge(next);
  expect(next.phase).toBe("move");
  next = applyInput(next, { type: "selectLocation", locationId: dest });
  return acknowledge(next);
}

function finishNearWin(start: GameState): GameState {
  let next = start;
  const device = next.locations.skullRock.items.find((card) => card.defId === "ingeniousDevice");
  const peter = next.locations.skullRock.heroes.find((card) => card.defId === "peterPan");
  expect(device).toBeTruthy();
  expect(peter).toBeTruthy();
  expect(availableActions(next).some((action) => action.kind === "vanquish" && action.available)).toBe(false);

  next = applyInput(next, { type: "selectAction", actionKey: `extra:${device!.instanceId}` });
  next = applyInput(next, { type: "selectCard", instanceId: peter!.instanceId });
  next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });
  expect(next.peterPanLocation).toBe("jollyRoger");
  expect(next.won).toBe(false);
  expect(next.voyage.walkedWest).toBe(true);
  expect(availableActions(next).some((action) => action.kind === "vanquish" && action.available)).toBe(false);

  next = endAndMove(next, "jollyRoger");
  expect(next.phase).toBe("actions");
  const hero = next.locations.jollyRoger.heroes.find((card) => card.defId === "peterPan");
  const brutes = next.locations.jollyRoger.allies.filter((card) => card.defId === "pirateBrute");
  expect(hero).toBeTruthy();
  expect(brutes).toHaveLength(2);

  next = applyInput(next, { type: "selectAction", actionKey: "jr-vanquish" });
  next = applyInput(next, { type: "selectCard", instanceId: hero!.instanceId });
  next = applyInput(next, { type: "selectCard", instanceId: brutes[0].instanceId });
  next = applyInput(next, { type: "confirm" });
  expect(next.won).toBe(false);
  expect(next.phase).not.toBe("over");

  next = applyInput(next, { type: "selectCard", instanceId: brutes[1].instanceId });
  next = applyInput(next, { type: "confirm" });
  return next;
}

describe("full objective win", () => {
  it("plays the Map, seats Peter at the tree, walks him west, and vanquishes him on the ship", () => {
    let next = barePlayState();
    next.difficulty = "easy";
    next.villainLocation = "skullRock";
    next.phase = "actions";
    next.power = 6;
    const map = give(next, "neverLandMap");
    next.fateDeck = [
      { instanceId: "peter-win", defId: "peterPan" },
      { instanceId: "wendy-win", defId: "wendy" },
    ];
    next.fateDiscard = [];

    next = applyInput(next, { type: "selectAction", actionKey: "sr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: map.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });
    next = applyInput(next, { type: "payWithPower" });
    expect(next.hangmansUnlocked).toBe(true);
    expect(next.voyage.mapOpened).toBe(true);
    expect(next.locations.jollyRoger.items.some((card) => card.defId === "neverLandMap")).toBe(true);

    next = applyInput(next, { type: "selectAction", actionKey: "sr-fate" });
    expect(next.peterPanRevealed).toBe(true);
    expect(next.peterPanLocation).toBe("hangmansTree");
    expect(next.locations.hangmansTree.heroes.some((hero) => hero.defId === "peterPan")).toBe(true);
    expect(next.voyage.peterHow).toMatch(/Hangman's Tree/);
    next = acknowledge(next);
    silenceFate(next);

    const lagoonDevice = putItem(next, "ingeniousDevice", "mermaidLagoon");
    const skullDevice = putItem(next, "ingeniousDevice", "skullRock");
    putAlly(next, "pirateBrute", "jollyRoger");
    putAlly(next, "pirateBrute", "jollyRoger");

    next = endAndMove(next, "hangmansTree");
    const peter = next.locations.hangmansTree.heroes.find((hero) => hero.defId === "peterPan");
    expect(peter).toBeTruthy();
    next = applyInput(next, { type: "selectAction", actionKey: "ht-moveHero" });
    next = applyInput(next, { type: "selectCard", instanceId: peter!.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "mermaidLagoon" });
    expect(next.peterPanLocation).toBe("mermaidLagoon");
    expect(next.voyage.walkedWest).toBe(true);

    next = endAndMove(next, "mermaidLagoon");
    next = applyInput(next, { type: "selectAction", actionKey: `extra:${lagoonDevice.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: peter!.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "skullRock" });
    expect(next.peterPanLocation).toBe("skullRock");

    next = endAndMove(next, "skullRock");
    next = applyInput(next, { type: "selectAction", actionKey: `extra:${skullDevice.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: peter!.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.peterPanLocation).toBe("jollyRoger");
    expect(next.won).toBe(false);
    expect(availableActions(next).some((action) => action.kind === "vanquish" && action.available)).toBe(false);

    next = endAndMove(next, "jollyRoger");
    const hero = next.locations.jollyRoger.heroes.find((card) => card.defId === "peterPan");
    const brutes = next.locations.jollyRoger.allies.filter((card) => card.defId === "pirateBrute");
    next = applyInput(next, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: hero!.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brutes[0].instanceId });
    next = applyInput(next, { type: "confirm" });
    expect(next.won).toBe(false);
    expect(next.log.some((entry) => /Not enough Strength/i.test(entry.text))).toBe(true);

    next = applyInput(next, { type: "selectCard", instanceId: brutes[1].instanceId });
    next = applyInput(next, { type: "confirm" });

    expect(next.won).toBe(true);
    expect(next.lost).toBe(false);
    expect(next.phase).toBe("over");
    expect(next.voyage.lastClash?.reach).toBe("same-place");
    expect(next.voyage.lastClash?.allyStrength).toBe(8);
    expect(next.voyage.lastClash?.heroStrength).toBe(8);
    expect(next.voyage.lastClash?.onShip).toBe(true);

    const recap = endgameRecap(next);
    expect(recap.lead).toMatch(/Captain Hook wins/);
    expect(recap.steps).toMatch(/Never Land Map/);
    expect(recap.steps).toMatch(/Hangman’s Tree/);
    expect(recap.steps).toMatch(/walked him west/);
    expect(recap.clash).toMatch(/local/);
    expect(recap.clash).toMatch(/8/);
    expect(recap.fate).toMatch(/Fate|revealed/i);

    const html = renderPlay(next, { coachEnabled: true, briefEnabled: true, reasonsEnabled: false });
    expect(html).toContain("data-recap");
    expect(html).toContain("Captain Hook wins");
    expect(html).toContain("Why the clash was legal");
    expect(html).toContain("What Fate did");
    expect(html).toMatch(/Ally Strength was 8/);
  });

  it("finishes ?scene=nearwin with a legal ship clash and a celebration recap", () => {
    const scene = nearWinScene();
    expect(scene.difficulty).toBe("easy");
    expect(scene.hangmansUnlocked).toBe(true);
    expect(scene.peterPanLocation).toBe("skullRock");
    expect(scene.voyage.mapOpened).toBe(true);

    const won = finishNearWin(scene);
    expect(won.won).toBe(true);
    expect(won.phase).toBe("over");

    const recap = endgameRecap(won);
    expect(recap.headline).toBe("The ship is yours");
    expect(recap.steps).toMatch(/Map/);
    expect(recap.steps).toMatch(/walked him west/);
    expect(recap.clash).toMatch(/at the Jolly Roger/);
    expect(recap.clash).toMatch(/8/);
    expect(recap.fate).toMatch(/Fate played Peter Pan/);
    expect(recap.fate.match(/seated him at Hangman’s Tree/g)?.length).toBe(1);

    const html = renderPlay(won);
    expect(html).toContain("data-recap-steps");
    expect(html).toContain("data-recap-clash");
    expect(html).toContain("data-recap-fate");
    expect(html).not.toMatch(/You win\./);
  });
});

describe("loss recap", () => {
  it("explains an off-ship Peter clash as a legal fight in the wrong place", () => {
    let next = barePlayState();
    next.villainLocation = "mermaidLagoon";
    next.phase = "actions";
    next.hangmansUnlocked = true;
    next.voyage.mapOpened = true;
    next.voyage.peterSeated = true;
    next.voyage.peterHow = "Fate played Peter Pan and seated him at Hangman’s Tree.";
    next.voyage.fateMoments = [next.voyage.peterHow];
    const cannon = putItem(next, "cannon", "mermaidLagoon");
    const seated = putHero(next, "peterPan", "mermaidLagoon");
    const brute = putAlly(next, "pirateBrute", "mermaidLagoon");
    const brute2 = putAlly(next, "pirateBrute", "mermaidLagoon");

    next = applyInput(next, { type: "selectAction", actionKey: `extra:${cannon.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: seated.instanceId });
    expect(next.pending?.kind).toBe("vanquishConfirmLoss");
    next = applyInput(next, { type: "confirm" });
    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute2.instanceId });
    next = applyInput(next, { type: "confirm" });

    expect(next.lost).toBe(true);
    const recap = endgameRecap(next);
    expect(recap.headline).toBe("The tide turns");
    expect(recap.lead).toMatch(/away from the Jolly Roger/);
    expect(recap.steps).toMatch(/Never Land Map/);
    expect(recap.clash).toMatch(/Mermaid Lagoon/);
    expect(recap.clash).toMatch(/8/);
    expect(recap.clash).toMatch(/only wins on the ship/);
    expect(recap.fate).toMatch(/Fate played Peter Pan/);

    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("Why that clash did not win");
    expect(html).toContain("data-recap");
  });

  it("recaps a resignation with the steps already finished", () => {
    const scene = nearWinScene();
    const next = applyInput(scene, { type: "resign" });
    expect(next.lost).toBe(true);
    const recap = endgameRecap(next);
    expect(recap.lead).toMatch(/struck the colors/);
    expect(recap.steps).toMatch(/Never Land Map/);
    expect(recap.steps).toMatch(/walked him west|started walking/i);
    expect(recap.clash).toMatch(/no finished clash/i);
    expect(recap.fate).toMatch(/Fate played Peter Pan/);
    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("What Fate did");
    expect(html).toContain("struck the colors");
  });
});
