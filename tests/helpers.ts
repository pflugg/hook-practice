import { createGame } from "../src/engine/game";
import type { CardInstance, GameState, LocationId } from "../src/engine/types";

let seq = 9000;

export function pick<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`missing ${label}`);
  return value;
}

export function inst(defId: string): CardInstance {
  return { instanceId: `${defId}-t${seq++}`, defId };
}

export function barePlayState(): GameState {
  const state = createGame("normal", 42);
  state.hand = [];
  state.villainDeck = [];
  state.villainDiscard = [];
  state.fateDeck = [];
  state.fateDiscard = [];
  state.power = 10;
  state.phase = "actions";
  state.usedActions = [];
  state.pending = null;
  state.hangmansUnlocked = false;
  state.peterPanRevealed = false;
  state.peterPanLocation = null;
  state.won = false;
  state.lost = false;
  state.attachments = [];
  for (const id of ["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const) {
    state.locations[id] = { id, heroes: [], allies: [], items: [] };
  }
  return state;
}

export function putHero(state: GameState, defId: string, location: LocationId): CardInstance {
  const card = inst(defId);
  state.locations[location].heroes.push(card);
  if (defId === "peterPan") {
    state.peterPanRevealed = true;
    state.peterPanLocation = location;
  }
  return card;
}

export function putAlly(state: GameState, defId: string, location: LocationId): CardInstance {
  const card = inst(defId);
  state.locations[location].allies.push(card);
  return card;
}

export function putItem(state: GameState, defId: string, location: LocationId): CardInstance {
  const card = inst(defId);
  state.locations[location].items.push(card);
  return card;
}

export function give(state: GameState, defId: string): CardInstance {
  const card = inst(defId);
  state.hand.push(card);
  return card;
}

export function attachTo(state: GameState, defId: string, heroId: string): CardInstance {
  const card = inst(defId);
  state.attachments.push({ item: card, attachedTo: heroId });
  return card;
}
