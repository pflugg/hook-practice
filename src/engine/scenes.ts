import { def } from "./cards";
import { createGame } from "./game";
import type { CardInstance, GameState } from "./types";

function inst(state: GameState, defId: string): CardInstance {
  return { instanceId: `${defId}-scene-${state.instanceSeq++}`, defId };
}

/** Scripted table for verifying Cutlass attach across locations. */
export function cutlassAttachScene(): GameState {
  const state = createGame("normal", 1);
  state.hand = [];
  state.villainDeck = [];
  state.villainDiscard = [];
  state.fateDeck = [];
  state.fateDiscard = [];
  state.power = 1;
  state.phase = "actions";
  state.pending = null;
  state.usedActions = [];
  state.villainLocation = "jollyRoger";
  state.hangmansUnlocked = false;
  state.attachments = [];
  for (const id of ["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const) {
    state.locations[id] = { id, heroes: [], allies: [], items: [] };
  }
  const cutlass = inst(state, "cutlass");
  const ally = inst(state, "swashbuckler");
  state.hand.push(cutlass);
  state.locations.skullRock.allies.push(ally);
  state.pending = { kind: "playChooseAllyAttach", cardId: cutlass.instanceId };
  state.phase = "resolving";
  state.actionKey = "jr-play";
  return state;
}

/** Scripted Fate intervening modal with Tick Tock already seated. */
export function tickTockReportScene(): GameState {
  const state = createGame("normal", 1);
  state.hand = [];
  state.villainDeck = [];
  state.villainDiscard = [];
  state.fateDeck = [];
  state.fateDiscard = [];
  state.power = 2;
  state.usedActions = [];
  state.villainLocation = "jollyRoger";
  state.hangmansUnlocked = false;
  state.attachments = [];
  for (const id of ["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const) {
    state.locations[id] = { id, heroes: [], allies: [], items: [] };
  }
  const tick = inst(state, "tickTock");
  const wendy = inst(state, "wendy");
  state.locations.mermaidLagoon.heroes.push(tick);
  state.fateDiscard.push(wendy);
  state.pending = {
    kind: "fateReport",
    drawn: [tick, wendy],
    played: tick,
    discarded: [wendy],
    note: "Fate seats Tick Tock at Mermaid Lagoon.",
    abilityText: `${def(tick.defId).name}: ${def(tick.defId).text}`,
    resume: "nextTurn",
  };
  state.phase = "fateAdversary";
  state.lastComputerFateNote = "Fate seats Tick Tock at Mermaid Lagoon.";
  state.lastFateShow = {
    drawn: [tick, wendy],
    played: tick,
    discarded: [wendy],
    note: "Fate seats Tick Tock at Mermaid Lagoon.",
    abilityText: `${def(tick.defId).name}: ${def(tick.defId).text}`,
  };
  return state;
}

/** Scripted Move a Hero so drag-and-drop can be verified. */
export function dragHeroScene(): GameState {
  const state = createGame("normal", 1);
  state.hand = [];
  state.villainDeck = [];
  state.villainDiscard = [];
  state.fateDeck = [];
  state.fateDiscard = [];
  state.power = 3;
  state.usedActions = [];
  state.villainLocation = "hangmansTree";
  state.hangmansUnlocked = true;
  state.attachments = [];
  for (const id of ["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const) {
    state.locations[id] = { id, heroes: [], allies: [], items: [] };
  }
  const wendy = inst(state, "wendy");
  state.locations.hangmansTree.heroes.push(wendy);
  state.pending = { kind: "moveHeroSelect" };
  state.phase = "resolving";
  state.actionKey = "ht-moveHero";
  return state;
}

function emptyRealm(state: GameState): void {
  state.hand = [];
  state.villainDeck = [];
  state.villainDiscard = [];
  state.fateDeck = [];
  state.fateDiscard = [];
  state.attachments = [];
  state.usedActions = [];
  for (const id of ["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const) {
    state.locations[id] = { id, heroes: [], allies: [], items: [] };
  }
}

/** Scripted clash so the live Strength meter can be verified. */
export function vanquishClashScene(): GameState {
  const state = createGame("normal", 1);
  emptyRealm(state);
  state.power = 3;
  state.hangmansUnlocked = true;
  state.villainLocation = "jollyRoger";
  const peter = inst(state, "peterPan");
  const brute = inst(state, "pirateBrute");
  const brute2 = inst(state, "pirateBrute");
  state.locations.jollyRoger.heroes.push(peter);
  state.locations.jollyRoger.allies.push(brute, brute2);
  state.peterPanRevealed = true;
  state.peterPanLocation = "jollyRoger";
  state.pending = { kind: "vanquishAllies", heroId: peter.instanceId, selected: [brute.instanceId] };
  state.phase = "resolving";
  state.actionKey = "jr-vanquish";
  return state;
}

/** Scripted Obsession decide so the found Hero face is visible. */
export function obsessionDecideScene(): GameState {
  const state = createGame("normal", 1);
  emptyRealm(state);
  state.power = 2;
  state.villainLocation = "skullRock";
  const hero = inst(state, "tickTock");
  state.heldCard = hero;
  state.pending = { kind: "obsessionDecide", heroId: hero.instanceId, extras: [] };
  state.phase = "resolving";
  return state;
}

/** Scripted Vanquish pick: local Hero legal, remote Hero with Allies is not. */
export function vanquishLocalScene(): GameState {
  const state = createGame("normal", 1);
  emptyRealm(state);
  state.power = 4;
  state.hangmansUnlocked = true;
  state.villainLocation = "jollyRoger";
  const john = inst(state, "john");
  const smee = inst(state, "smee");
  const wendy = inst(state, "wendy");
  const brute = inst(state, "pirateBrute");
  const brute2 = inst(state, "pirateBrute");
  state.locations.jollyRoger.heroes.push(john);
  state.locations.jollyRoger.allies.push(smee);
  state.locations.mermaidLagoon.heroes.push(wendy);
  state.locations.mermaidLagoon.allies.push(brute, brute2);
  state.pending = { kind: "vanquishHero" };
  state.phase = "resolving";
  state.actionKey = "jr-vanquish";
  return state;
}
