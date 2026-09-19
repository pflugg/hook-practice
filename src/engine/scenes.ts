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
  return state;
}
