/**
 * @vitest-environment jsdom
 *
 * Play pass 2 Must: during the required move, actions at the captain's
 * current place must stay inert, and Why must never credit a ignored click.
 */
import { describe, expect, it } from "vitest";
import { applyInput, highlightSet } from "../src/engine/game";
import { actionsAreLive, availableActions, promptText } from "../src/engine/queries";
import { explainSelection, IDLE_MOVE_REASON, liveMoveReason, type MoveReason } from "../src/engine/moveReason";
import type { GameState, Input, LocationId } from "../src/engine/types";
import { renderPlay } from "../src/ui/app";
import { resolveBoardClick } from "../src/ui/clicks";
import { barePlayState, putHero } from "./helpers";

function requiredMoveAt(location: LocationId, extras?: Partial<GameState>): GameState {
  const state = barePlayState();
  state.hangmansUnlocked = true;
  state.villainLocation = location;
  state.phase = "move";
  state.pending = null;
  state.power = extras?.power ?? 5;
  state.usedActions = [];
  Object.assign(state, extras);
  return state;
}

function currentLocationButtons(html: string, location: LocationId): HTMLButtonElement[] {
  const root = document.createElement("div");
  root.innerHTML = html;
  const loc = root.querySelector<HTMLElement>(`[data-loc="${location}"]`);
  expect(loc).toBeTruthy();
  return [...loc!.querySelectorAll<HTMLButtonElement>("[data-act]")];
}

function postSelection(before: GameState, input: Input, last: MoveReason | null = IDLE_MOVE_REASON) {
  const after = applyInput(before, input);
  const explained = explainSelection(before, input, after);
  const nextLast = explained ?? last;
  return { after, explained, live: liveMoveReason(after, nextLast) };
}

describe("play-pass-2 Must: current-location actions stay dark during required move", () => {
  it("marks every printed action unavailable while the captain still must move", () => {
    const state = requiredMoveAt("mermaidLagoon", { power: 5 });
    expect(actionsAreLive(state)).toBe(false);
    expect(promptText(state)).toMatch(/Move the captain to a different unlocked location/);
    expect(availableActions(state).every((a) => !a.available)).toBe(true);
    expect(availableActions(state, { asIfOnActionStretch: true }).some((a) => a.key === "ml-gain" && a.available)).toBe(
      true,
    );
    expect([...highlightSet(state)]).not.toContain("act:ml-gain");
  });

  it("disables Gain 3 at Mermaid Lagoon and writes no Why credit (Easy Turn 6 repro)", () => {
    const state = requiredMoveAt("mermaidLagoon", { power: 5 });
    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    const buttons = currentLocationButtons(html, "mermaidLagoon");
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((btn) => btn.disabled)).toBe(true);
    expect(buttons.every((btn) => btn.classList.contains("is-inert"))).toBe(true);
    expect(buttons.every((btn) => !btn.classList.contains("is-legal"))).toBe(true);

    const gain = buttons.find((btn) => btn.dataset.act === "ml-gain");
    expect(gain).toBeTruthy();
    expect(gain!.textContent).toMatch(/Gain 3/);

    const click = resolveBoardClick(gain!, state);
    expect(click).toBeNull();

    const forced = postSelection(state, { type: "selectAction", actionKey: "ml-gain" });
    expect(forced.after.phase).toBe("move");
    expect(forced.after.power).toBe(5);
    expect(forced.after.usedActions).not.toContain("ml-gain");
    expect(forced.explained).toBeNull();
    expect(forced.live.chose).not.toMatch(/You took Gain/);
    expect(`${forced.live.chose} ${forced.live.why}`).not.toMatch(/You took Gain 3 at Mermaid Lagoon/);
  });

  it("disables Gain 1 at Skull Rock and writes no Why credit (Easy Turn 6 earlier stop)", () => {
    const state = requiredMoveAt("skullRock", { power: 3 });
    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    const gain = currentLocationButtons(html, "skullRock").find((btn) => btn.dataset.act === "sr-gain");
    expect(gain?.disabled).toBe(true);
    expect(gain?.classList.contains("is-inert")).toBe(true);
    expect(resolveBoardClick(gain!, state)).toBeNull();

    const forced = postSelection(state, { type: "selectAction", actionKey: "sr-gain" });
    expect(forced.after.power).toBe(3);
    expect(forced.explained).toBeNull();
    expect(forced.live.chose).not.toMatch(/You took Gain/);
  });

  it("disables Vanquish at the Jolly Roger and writes no Why credit (Normal Turn 1 repro)", () => {
    const state = requiredMoveAt("jollyRoger", { power: 0, hangmansUnlocked: false });
    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    const vanquish = currentLocationButtons(html, "jollyRoger").find((btn) => btn.dataset.act === "jr-vanquish");
    expect(vanquish?.disabled).toBe(true);
    expect(vanquish?.classList.contains("is-inert")).toBe(true);
    expect(vanquish?.classList.contains("is-legal")).toBe(false);
    expect(resolveBoardClick(vanquish!, state)).toBeNull();

    const forced = postSelection(state, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(forced.after.phase).toBe("move");
    expect(forced.after.pending).toBeNull();
    expect(forced.after.usedActions).not.toContain("jr-vanquish");
    expect(forced.explained).toBeNull();
    expect(forced.live.chose).not.toMatch(/You opened Vanquish/);
    expect(`${forced.live.chose} ${forced.live.why}`).not.toMatch(/You opened Vanquish at Jolly Roger/);
  });

  it("still treats a disabled off-location action as a legal move", () => {
    const state = requiredMoveAt("jollyRoger", { power: 0, hangmansUnlocked: false });
    const html = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    const root = document.createElement("div");
    root.innerHTML = html;
    const skullGain = root.querySelector<HTMLButtonElement>('[data-act="sr-gain"]');
    expect(skullGain?.disabled).toBe(true);
    expect(resolveBoardClick(skullGain!, state)).toEqual({ type: "selectLocation", locationId: "skullRock" });
  });

  it("does not rewrite Why when a current-location click falls through as stay-put", () => {
    const state = requiredMoveAt("mermaidLagoon", { power: 5 });
    putHero(state, "lostBoys", "mermaidLagoon");
    const last: MoveReason = {
      chose: "You set sail on Easy Fate.",
      why: "This is a practice table for the captain’s chain.",
      next: "Make the required first move.",
    };
    const stay = postSelection(state, { type: "selectLocation", locationId: "mermaidLagoon" }, last);
    expect(stay.after.villainLocation).toBe("mermaidLagoon");
    expect(stay.after.phase).toBe("move");
    expect(stay.explained).toBeNull();
    expect(stay.live.chose).toBe(last.chose);
    expect(stay.live.chose).not.toMatch(/You took Gain|You opened Vanquish|You moved the captain/);
  });
});
