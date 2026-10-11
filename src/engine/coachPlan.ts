import { locName } from "./realm";
import type { CoachAdvice } from "./coach";
import {
  allAllies,
  allHeroes,
  allyStrength,
  anyTauntInRealm,
  cardName,
  hasTaunt,
  heroStrength,
  mapInHand,
  vanquishableHeroes,
} from "./queries";
import { rivalGoal, rivalStep } from "./rival";
import { LOCATION_IDS, type GameState, type LocationId } from "./types";

export interface PlanStage {
  id: "hideout" | "crew" | "peter" | "ship" | "clash";
  label: string;
  mark: "done" | "now" | "later";
}

export interface CoachPlan {
  stages: PlanStage[];
  lines: string[];
}

const WARNING_TURNS = 16;

function peterAt(state: GameState): { location: LocationId } | null {
  const found = allHeroes(state).find((hero) => hero.hero.defId === "peterPan");
  return found ? { location: found.location } : null;
}

function shipStrength(state: GameState): number {
  return state.locations.jollyRoger.allies.reduce((sum, ally) => sum + allyStrength(state, ally), 0);
}

function rivalWarning(state: GameState): boolean {
  const goal = rivalGoal(state.coachOn, state.difficulty);
  const step = rivalStep(state.difficulty, state.coachOn);
  const remaining = goal - state.rivalProgress;
  return state.rivalProgress > 0 && remaining > 0 && remaining <= step * WARNING_TURNS;
}

function stagesFor(state: GameState): PlanStage[] {
  const peter = peterAt(state);
  const aboard = peter?.location === "jollyRoger";
  const raw: { id: PlanStage["id"]; label: string; done: boolean }[] = [
    { id: "hideout", label: "Hideout", done: state.hangmansUnlocked },
    { id: "crew", label: "Crew", done: allAllies(state).length > 0 },
    { id: "peter", label: "Peter", done: state.peterPanRevealed },
    { id: "ship", label: "Ship", done: Boolean(aboard) },
    { id: "clash", label: "Clash", done: state.won },
  ];
  const now = raw.find((stage) => !stage.done)?.id;
  return raw.map((stage) => ({
    id: stage.id,
    label: stage.label,
    mark: stage.done ? "done" : stage.id === now ? "now" : "later",
  }));
}

function setupLine(state: GameState): string {
  if (state.won) return "Peter was vanquished on the ship. That is the end of the chain.";
  if (state.lost) return "";
  const peter = peterAt(state);
  if (!state.hangmansUnlocked) {
    return mapInHand(state)
      ? "The Never Land Map is in your hand. Playing it is what unlocks Hangman’s Tree, the Hideout."
      : "Hangman’s Tree is still locked. Peter cannot leave the Hideout until the Never Land Map is played.";
  }
  if (!state.peterPanRevealed || !peter) {
    const crew = allAllies(state).length;
    return crew === 0
      ? "Peter is still in the Fate deck. Play an Ally so the ship has crew before he shows up."
      : `Peter is still in Fate. You already have ${crew} Ally card${crew === 1 ? "" : "s"} out, and the ship crew is about ${shipStrength(state)} Strength.`;
  }
  if (peter.location !== "jollyRoger") {
    const shores = LOCATION_IDS.indexOf(peter.location);
    return `Peter is at ${locName(peter.location)}, ${shores} shore${shores === 1 ? "" : "s"} from the Jolly Roger. A Move a Hero action walks him one place closer.`;
  }
  const need = heroStrength(state, allHeroes(state).find((hero) => hero.hero.defId === "peterPan")!.hero);
  const have = shipStrength(state);
  const ready = vanquishableHeroes(state).some((hero) => hero.hero.defId === "peterPan");
  return ready
    ? `Peter is aboard and the ship crew can meet his Strength (${need}). Vanquish him on the Jolly Roger to finish.`
    : `Peter is aboard. Ship Strength is about ${have} against his ${need}. Stack more Allies on the Jolly Roger before the clash.`;
}

function threatLine(state: GameState): string {
  if (state.pending?.kind === "fateReport") {
    return "This is a Fate report. Clear it, then your plan continues on the next turn.";
  }
  if (anyTauntInRealm(state)) {
    const taunted = allHeroes(state).find((hero) => hasTaunt(state, hero.hero.instanceId));
    if (taunted) {
      return `Taunt is on ${cardName(taunted.hero)} at ${locName(taunted.location)}. That Hero has to be vanquished before any other.`;
    }
  }
  if (rivalWarning(state)) {
    const goal = rivalGoal(state.coachOn, state.difficulty);
    return `The rival is in the warning band at ${state.rivalProgress} / ${goal}. A slow turn lets that track finish first.`;
  }
  return "";
}

export function coachPlan(state: GameState, advice: CoachAdvice): CoachPlan {
  const raw = [advice.why, setupLine(state), threatLine(state), advice.warning ?? ""];
  const lines = raw
    .map((line) => line.trim())
    .filter((line, index, all) => line.length > 0 && all.indexOf(line) === index);
  return { stages: stagesFor(state), lines: lines.slice(0, 3) };
}
