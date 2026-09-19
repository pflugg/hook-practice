/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { resolveBoardClick } from "../src/ui/clicks";
import { barePlayState } from "./helpers";

function boardMarkup(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <section class="location is-legal" data-loc="skullRock">
      <button type="button" class="drop-hint" data-move="skullRock">Move here</button>
      <button class="action" data-act="sr-gain" disabled>Gain 1</button>
      <button class="action" data-act="sr-play" disabled>Play a Card</button>
    </section>
    <section class="location is-current" data-loc="jollyRoger">
      <button class="action is-legal" data-act="jr-gain">Gain 1</button>
      <button class="action is-legal" data-act="jr-play">Play a Card</button>
    </section>
  `;
  return root;
}

describe("location click routing", () => {
  it("treats a click on a disabled action as a move onto that legal location", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "move";
    state.pending = null;

    const root = boardMarkup();
    const dead = root.querySelector<HTMLButtonElement>('[data-act="sr-gain"]')!;
    expect(dead.disabled).toBe(true);

    const input = resolveBoardClick(dead, state);
    expect(input).toEqual({ type: "selectLocation", locationId: "skullRock" });

    const next = applyInput(state, input!);
    expect(next.villainLocation).toBe("skullRock");
    expect(next.phase).toBe("actions");
  });

  it("moves via the explicit Move here button", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "move";

    const root = boardMarkup();
    const btn = root.querySelector<HTMLButtonElement>("[data-move]")!;
    const input = resolveBoardClick(btn, state);
    expect(input).toEqual({ type: "selectLocation", locationId: "skullRock" });
  });

  it("still fires selectAction on an enabled current-location action after moving", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.pending = null;
    state.usedActions = [];

    const root = boardMarkup();
    const gain = root.querySelector<HTMLButtonElement>('[data-act="jr-gain"]')!;
    const input = resolveBoardClick(gain, state);
    expect(input).toEqual({ type: "selectAction", actionKey: "jr-gain" });

    const next = applyInput(state, input!);
    expect(next.power).toBe(state.power + 1);
    expect(next.usedActions).toContain("jr-gain");
  });
});
