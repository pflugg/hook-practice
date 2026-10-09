import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, createGame, highlightSet } from "../src/engine/game";
import { lessonOpening } from "../src/engine/lesson";
import { LOCATION_IDS, type Difficulty, type GameState, type Input, type LocationId } from "../src/engine/types";

function locationFromHighlight(value: string): LocationId | null {
  return (LOCATION_IDS as readonly string[]).includes(value) ? (value as LocationId) : null;
}

function inputForHighlight(key: string): Input | null {
  if (key.startsWith("act:")) return { type: "selectAction", actionKey: key.slice(4) };
  if (key.startsWith("loc:")) {
    const locationId = locationFromHighlight(key.slice(4));
    return locationId ? { type: "selectLocation", locationId } : null;
  }
  if (key.startsWith("card:")) return { type: "selectCard", instanceId: key.slice(5) };
  if (key === "btn:end") return { type: "endTurn" };
  if (key === "btn:ack") return { type: "acknowledgeFate" };
  if (key === "btn:cancel") return { type: "cancel" };
  if (key === "btn:confirm") return { type: "confirm" };
  if (key === "btn:pay-power") return { type: "payWithPower" };
  if (key === "btn:pay-map") return { type: "payWithMap" };
  if (key === "btn:accept-cond") return { type: "acceptCondition" };
  if (key === "btn:skip-cond") return { type: "skipCondition" };
  if (key === "btn:play-hero") return { type: "playOrDiscardHero", play: true };
  if (key === "btn:discard-hero") return { type: "playOrDiscardHero", play: false };
  if (key === "btn:scare-discard") return { type: "scareDiscardBoth" };
  if (key.startsWith("btn:scare-order:")) {
    const parts = key.slice("btn:scare-order:".length).split(",");
    const top = parts[0];
    const bottom = parts[1];
    if (!top || !bottom) return null;
    return { type: "scareReturn", order: [top, bottom] };
  }
  return null;
}

function expectBoardHighlightsLegal(state: GameState): void {
  const legal = highlightSet(state);
  const advice = advise(state);
  for (const key of advice.highlights) {
    if (key.startsWith("btn:")) continue;
    expect(legal.has(key), `${advice.do} named ${key}, which is not a legal target`).toBe(true);
  }
}

function followCoach(seed: number, difficulty: Difficulty, steps: number): void {
  let state = createGame(difficulty, seed);
  for (let i = 0; i < steps; i++) {
    if (state.phase === "over" || state.won || state.lost) return;
    expectBoardHighlightsLegal(state);
    const key = advise(state).highlights[0];
    if (!key) return;
    const input = inputForHighlight(key);
    if (!input) return;
    const next = applyInput(state, input);
    if (next === state || (next.phase === state.phase && next.pending === state.pending && next.turn === state.turn && next.log.length === state.log.length)) {
      return;
    }
    state = next;
  }
}

describe("coach targets stay on legal board clicks", () => {
  it("keeps dealt voyages on highlighted locations, actions, and cards", () => {
    for (const difficulty of ["easy", "normal"] as const) {
      for (const seed of [1, 7, 42, 99]) {
        followCoach(seed, difficulty, 24);
      }
    }
  });

  it("keeps the staged first voyage opening legal", () => {
    expectBoardHighlightsLegal(lessonOpening());
  });
});
