/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { createGame } from "../src/engine/game";
import {
  hourEqualVanquishScene,
  nearWinScene,
  rivalLossScene,
  tickTockReportScene,
} from "../src/engine/scenes";
import type { GameState } from "../src/engine/types";
import { planPanelCopy, renderPlay } from "../src/ui/app";
import { barePlayState } from "./helpers";

function panelOf(state: GameState): { click: string; panel: string; stages: string } {
  const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: false });
  const root = document.createElement("div");
  root.innerHTML = html;
  const click = root.querySelector(".coach-do")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const panel = [...root.querySelectorAll(".plan-lines p")]
    .map((line) => line.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter((line) => line.length > 0)
    .join(" ");
  const stages = root.querySelector(".plan-stages")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return { click, panel, stages };
}

describe("Why / Plan panel", () => {
  it("never repeats the Next-click sentence", () => {
    const states = [
      hourEqualVanquishScene(),
      nearWinScene(),
      createGame("easy", 1),
      createGame("normal", 7),
      rivalLossScene(),
      tickTockReportScene(),
      barePlayState(),
    ];
    for (const state of states) {
      const { click, panel, stages } = panelOf(state);
      expect(click.length).toBeGreaterThan(0);
      expect(panel.includes(click)).toBe(false);
      expect(panel).not.toMatch(/\bclick\b/i);
      expect(panel.length).toBeGreaterThan(0);
      expect(stages).toMatch(/Hideout/);
      expect(stages).toMatch(/Clash/);
    }
  });

  it("keeps the strategy sentences on the crowded shores", () => {
    const equal = panelOf(hourEqualVanquishScene());
    expect(equal.panel).toMatch(/Hangman’s Tree/);
    expect(equal.panel).toMatch(/Tinker Bell/);
    expect(equal.panel).not.toMatch(/Play Hook's Case/);

    const ship = panelOf(nearWinScene());
    expect(ship.panel).toMatch(/loses the duel/);
    expect(ship.panel).toMatch(/1 shore from the Jolly Roger/);
    expect(ship.panel).toMatch(/Peter Pan is covering/);
    expect(ship.panel).not.toMatch(/Click Move a Hero/);
  });

  it("uses one plan-stage sentence when every line is the click", () => {
    const state = barePlayState();
    state.lost = true;
    const lines = planPanelCopy(state, {
      do: "Click End turn.",
      why: "Click End turn.",
      highlights: [],
    });
    expect(lines).toEqual(["Hideout is the step in front of you: open Hangman’s Tree with the Never Land Map."]);
    expect(lines.join(" ")).not.toContain("Click End turn");
  });
});
