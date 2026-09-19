/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { createGame } from "../src/engine/game";
import { IDLE_MOVE_REASON } from "../src/engine/moveReason";
import { renderPlay } from "../src/ui/app";
import { barePlayState, give } from "./helpers";

describe("game graphics UI pass", () => {
  it("docks Coach and Why this move in a shared teach-dock, not a floating overlay", () => {
    const html = renderPlay(createGame("normal", 7), {
      coachEnabled: true,
      briefEnabled: true,
      reasonsEnabled: true,
      reason: IDLE_MOVE_REASON,
    });

    expect(html).toContain('class="teach-dock"');
    expect(html).toContain("teach-strip");
    expect(html).toContain("coach-panel");
    expect(html).toContain("reason-dock");
    expect(html).toContain("What you chose");
    expect(html).toContain("Why it helps the plan");
    expect(html).toContain("What it sets up");
    expect(html).toContain("strategy-brief");
    expect(html).not.toContain("reason-float");
    expect(html).not.toContain("data-reason-float");
    expect(html).not.toContain("data-reason-drag");

    const dockStart = html.indexOf('class="teach-dock"');
    const boardStart = html.indexOf('class="board"');
    const reasonStart = html.indexOf("reason-dock");
    const briefStart = html.indexOf("strategy-brief");
    expect(dockStart).toBeGreaterThan(-1);
    expect(reasonStart).toBeGreaterThan(dockStart);
    expect(reasonStart).toBeLessThan(boardStart);
    expect(briefStart).toBeGreaterThan(boardStart);
  });

  it("keeps Power, Turn, and Hand/Deck/Discard as loud HUD chips", () => {
    const state = createGame("normal", 7);
    const html = renderPlay(state);
    expect(html).toContain("power is-loud");
    expect(html).toContain(`<span>Power</span><b>${state.power}</b>`);
    expect(html).toContain(`Turn ${state.turn}`);
    expect(html).toContain(
      `Hand ${state.hand.length} · Deck ${state.villainDeck.length} · Discard ${state.villainDiscard.length}`,
    );
    expect(html).not.toMatch(/class="chip[^"]*"[^>]*>Power/);
  });

  it("prints full action labels and gold-CTA marks the coach suggestion", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 4;
    give(state, "neverLandMap");

    const html = renderPlay(state);
    const root = document.createElement("div");
    root.innerHTML = html;
    const labels = [...root.querySelectorAll<HTMLButtonElement>(".action")].map((el) => el.textContent?.trim());
    expect(labels).toContain("Play a Card");
    expect(labels).toContain("Move Ally/Item");
    expect(labels).toContain("Gain 3");
    expect(labels.every((label) => label && !label.includes("…") && !/\w\.\.\.$/.test(label))).toBe(true);

    const advice = advise(state);
    const suggested = advice.highlights.find((h) => h.startsWith("act:"));
    expect(suggested).toBeTruthy();
    const key = suggested!.slice(4);
    expect(html).toMatch(new RegExp(`class="action[^"]*is-coached[^"]*"[^>]*data-act="${key}"`));
  });

  it("puts a colored TYPE · COST bar on each hand card", () => {
    const state = barePlayState();
    give(state, "neverLandMap");
    give(state, "pirateBrute");
    give(state, "cunning");
    const html = renderPlay(state, { coachEnabled: false, reasonsEnabled: false });
    expect(html).toContain('class="type-bar"');
    expect(html).toContain("ITEM");
    expect(html).toContain("ALLY");
    expect(html).toContain("CONDITION");
    expect(html).toMatch(/type-bar[\s\S]*ITEM[\s\S]*·[\s\S]*4/);
    expect(html).toMatch(/type-bar[\s\S]*ALLY[\s\S]*·[\s\S]*3/);
    expect(html).toMatch(/type-bar[\s\S]*data-type="condition"[\s\S]*CONDITION/);
  });

  it("veils locked Hangman's Tree with LOCKED and Need: Never Land Map", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    const html = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("hangmansTree");
    expect(html).toContain("is-locked");
    expect(html).toContain("lock-veil");
    expect(html).toContain(">LOCKED<");
    expect(html).toContain("Need: Never Land Map");

    const tree = html.slice(html.indexOf('data-loc="hangmansTree"'));
    const treeChunk = tree.slice(0, tree.indexOf("</section>") + 10);
    expect(treeChunk).toContain("disabled");
    expect(treeChunk).toMatch(/data-act="ht-play"[^>]*disabled|disabled[^>]*data-act="ht-play"/);
  });
});
