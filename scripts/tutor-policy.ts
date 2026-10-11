import { advise } from "../src/engine/coach";
import { highlightSet } from "../src/engine/game";
import { LOCATION_IDS, type Input, type LocationId } from "../src/engine/types";
import type { GameState } from "../src/engine/types";

export interface CoachPick {
  input: Input | null;
  issue: "ok" | "missing" | "illegal";
  note: string;
}

const BUTTONS: Record<string, Input> = {
  "btn:end": { type: "endTurn" },
  "btn:ack": { type: "acknowledgeFate" },
  "btn:confirm": { type: "confirm" },
  "btn:cancel": { type: "cancel" },
  "btn:skip-cond": { type: "skipCondition" },
  "btn:accept-cond": { type: "acceptCondition" },
  "btn:scare-discard": { type: "scareDiscardBoth" },
  "btn:play-hero": { type: "playOrDiscardHero", play: true },
  "btn:discard-hero": { type: "playOrDiscardHero", play: false },
  "btn:pay-power": { type: "payWithPower" },
  "btn:pay-map": { type: "payWithMap" },
};

function boardKey(input: Input): string | null {
  if (input.type === "selectLocation") return `loc:${input.locationId}`;
  if (input.type === "selectAction") return `act:${input.actionKey}`;
  if (input.type === "selectCard") return `card:${input.instanceId}`;
  return null;
}

export function inputFromCoachKey(key: string): Input | null {
  const button = BUTTONS[key];
  if (button) return button;
  if (key.startsWith("loc:")) {
    const locationId = key.slice(4);
    if (!(LOCATION_IDS as readonly string[]).includes(locationId)) return null;
    return { type: "selectLocation", locationId: locationId as LocationId };
  }
  if (key.startsWith("act:")) return { type: "selectAction", actionKey: key.slice(4) };
  if (key.startsWith("card:")) return { type: "selectCard", instanceId: key.slice(5) };
  if (key.startsWith("btn:attach:")) return { type: "selectCard", instanceId: key.slice("btn:attach:".length) };
  if (key.startsWith("btn:scare-order:")) {
    const [a, b] = key.slice("btn:scare-order:".length).split(",");
    if (!a || !b) return null;
    return { type: "scareReturn", order: [a, b] };
  }
  return null;
}

export function coachChoice(state: GameState): CoachPick {
  const advice = advise(state);
  const keys = advice.highlights.filter((key) => key !== "btn:again");
  if (keys.length === 0) return { input: null, issue: "missing", note: advice.do };
  const legal = highlightSet(state);
  for (const key of keys) {
    const input = inputFromCoachKey(key);
    if (!input) continue;
    const marked = boardKey(input);
    if (marked && !legal.has(marked)) continue;
    return { input, issue: "ok", note: advice.do };
  }
  const firstKey = keys[0];
  return { input: firstKey ? inputFromCoachKey(firstKey) : null, issue: "illegal", note: advice.do };
}
