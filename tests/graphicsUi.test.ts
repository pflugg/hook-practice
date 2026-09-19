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
  it("stacks Strategy brief, Coach, and Why this move in a right teaching rail", () => {
    const html = renderPlay(createGame("normal", 7), {
      coachEnabled: true,
      briefEnabled: true,
      reasonsEnabled: true,
      reason: IDLE_MOVE_REASON,
    });

    expect(html).toContain("has-teach");
    expect(html).toContain("data-teach-rail");
    expect(html).toContain("teach-pane coach-panel");
    expect(html).toContain("teach-pane strategy-brief");
    expect(html).toContain("reason-dock");
    expect(html).toContain("What you chose");
    expect(html).toContain("Why it helps the plan");
    expect(html).toContain("What it sets up");
    expect(html).toContain("data-teach-tab=\"brief\"");
    expect(html).toContain("data-teach-tab=\"coach\"");
    expect(html).toContain("data-teach-tab=\"reasons\"");
    expect(html).not.toContain("teach-dock");
    expect(html).not.toContain("teach-strip");
    expect(html).not.toContain("reason-float");
    expect(html).not.toContain("data-reason-float");
    expect(html).not.toContain("data-reason-drag");

    const topbarStart = html.indexOf('class="topbar"');
    const stageStart = html.indexOf('class="stage"');
    const boardStart = html.indexOf('class="board"');
    const railStart = html.indexOf("data-teach-rail");
    const briefStart = html.indexOf("strategy-brief");
    const coachStart = html.indexOf("coach-panel");
    const reasonStart = html.indexOf("reason-dock");
    expect(topbarStart).toBeGreaterThan(-1);
    expect(stageStart).toBeGreaterThan(topbarStart);
    expect(boardStart).toBeGreaterThan(stageStart);
    expect(railStart).toBeGreaterThan(boardStart);
    expect(briefStart).toBeGreaterThan(railStart);
    expect(coachStart).toBeGreaterThan(briefStart);
    expect(reasonStart).toBeGreaterThan(coachStart);

    const chrome = html.slice(topbarStart, stageStart);
    expect(chrome).not.toContain("coach-do");
    expect(chrome).not.toContain("reason-dock");
    expect(chrome).not.toContain("strategy-brief");
    expect(chrome).toContain("power is-loud");

    const root = document.createElement("div");
    root.innerHTML = html;
    const rail = root.querySelector("[data-teach-rail]");
    expect(rail?.querySelectorAll(":scope > .teach-pane").length).toBe(3);
    expect(rail?.querySelector(":scope > .strategy-brief")).toBeTruthy();
    expect(rail?.querySelector(":scope > .coach-panel")).toBeTruthy();
    expect(rail?.querySelector(":scope > .reason-dock")).toBeTruthy();
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

  it("lays a silent original chart under the topbar without crowding the HUD", () => {
    const html = renderPlay(createGame("normal", 7));
    const root = document.createElement("div");
    root.innerHTML = html;

    const topbar = root.querySelector(".topbar");
    const map = topbar?.querySelector("[data-topbar-map]");
    expect(map).toBeTruthy();
    expect(map?.getAttribute("aria-hidden")).toBe("true");
    expect(map?.textContent?.trim()).toBe("");
    expect(map?.querySelector(".topbar-chart")).toBeTruthy();
    expect(map?.querySelector(".chart-coast")).toBeTruthy();
    expect(map?.querySelector(".chart-path")).toBeTruthy();
    expect(map?.querySelector(".chart-compass")).toBeTruthy();
    expect(map?.innerHTML).not.toMatch(/Never Land|Peter|Disney|Hangman|Mermaid|Skull|Jolly|Peter Pan/i);

    const chrome = html.slice(html.indexOf('class="topbar"'), html.indexOf('class="stage"'));
    expect(chrome).toContain("data-topbar-map");
    expect(chrome).toContain("power is-loud");
    expect(chrome).toContain("Turn ");
    expect(chrome).toContain("Hand ");
    expect(chrome.indexOf("data-topbar-map")).toBeLessThan(chrome.indexOf("power is-loud"));
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
    expect(html).not.toContain("has-teach");
    expect(html).not.toContain("data-teach-rail");

    const tree = html.slice(html.indexOf('data-loc="hangmansTree"'));
    const treeChunk = tree.slice(0, tree.indexOf("</section>") + 10);
    expect(treeChunk).toContain("disabled");
    expect(treeChunk).toMatch(/data-act="ht-play"[^>]*disabled|disabled[^>]*data-act="ht-play"/);
  });
});
