/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { strategyBrief } from "../src/engine/strategyBrief";
import { lagoonCoverScene } from "../src/engine/scenes";
import { TOPBAR_MAP } from "../src/ui/decor";
import { renderPlay } from "../src/ui/app";

describe("play chrome rescue", () => {
  it("pins topbar and prompt outside the board scrollport", () => {
    const html = renderPlay(lagoonCoverScene());
    const root = document.createElement("div");
    root.innerHTML = html;
    const chrome = root.querySelector(".play-chrome");
    const scroll = root.querySelector("[data-play-scroll]");
    const topbar = chrome?.querySelector(".topbar");
    const prompt = chrome?.querySelector("[data-prompt]");
    expect(chrome).toBeTruthy();
    expect(scroll).toBeTruthy();
    expect(topbar).toBeTruthy();
    expect(prompt).toBeTruthy();
    expect(scroll?.contains(topbar!)).toBe(false);
    expect(scroll?.contains(prompt!)).toBe(false);
    expect(scroll?.querySelector(".board")).toBeTruthy();
    expect(scroll?.querySelector(".fate-rail")).toBeTruthy();
    expect(scroll?.querySelector(".dock")).toBeTruthy();

    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    expect(css).toMatch(/\.play-chrome\s*\{[^}]*flex:\s*0 0 auto/);
    expect(css).toMatch(/\.play-main\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.play\s*\{[^}]*100dvh/);
    expect(css).toMatch(/overflow-y:\s*hidden/);
  });

  it("keeps Across the table as a short mini-card strip", () => {
    const html = renderPlay(lagoonCoverScene(), { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    const root = document.createElement("div");
    root.innerHTML = html;
    const rail = root.querySelector(".fate-rail");
    expect(rail).toBeTruthy();
    expect(rail?.textContent).toMatch(/Tinker Bell/);
    expect(rail?.querySelector(".card.hand-card")).toBeNull();
    expect(rail?.querySelector(".card.reveal")).toBeNull();
    expect(rail?.querySelectorAll(".card.mini").length).toBeGreaterThanOrEqual(2);
    expect(rail?.querySelector(".is-focus .card.mini")).toBeTruthy();

    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    expect(css).toMatch(/\.fate-rail\s*\{[^}]*align-items:\s*center/);
    expect(css).not.toMatch(/\.fate-rail\s*\{[^}]*min-height:\s*[3-9]\d{2}/);
    expect(css).toMatch(/\.fate-rail \.card\.mini \{[^}]*min-height:\s*92px/);
    expect(css).toMatch(/\.fate-fine \{ display: none; \}/);
    expect(css).not.toMatch(/\.fate-rail \.card\.mini \{[^}]*min-height:\s*1[0-9]{2}px/);
  });

  it("scrolls only the board column inside a 100dvh shell and leaves teaching floors alone", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    const play = css.slice(css.indexOf(".play {"), css.indexOf(".play.has-teach"));
    const scroll = css.slice(css.indexOf(".play-scroll {"), css.indexOf(".stage {"));
    expect(play).toMatch(/100dvh/);
    expect(play).toMatch(/overflow:\s*hidden/);
    expect(scroll).toMatch(/overflow:\s*auto/);
    expect(css).toMatch(/\.play-chrome\s*\{[^}]*flex:\s*0 0 auto/);
    expect(css).toMatch(/\.coach-do\s*\{[^}]*font-size:\s*18px/);
    expect(css).toMatch(/\.coach-why\s*\{[^}]*font-size:\s*14px/);
    expect(css).toMatch(/\.brief-block p\s*\{[^}]*font-size:\s*14\.5px/);
    expect(css).toMatch(/\.reason-block p\s*\{[^}]*font-size:\s*14px/);
    expect(css).toMatch(/\.location\s*\{[^}]*min-height:\s*380px/);
    expect(css).toMatch(/\.hand-row\s*\{[^}]*min-height:\s*226px/);
    expect(css).toMatch(/\.fate-rail\.is-spent \.fate-rail-copy p\s*\{[^}]*white-space:\s*nowrap/);
    const prompt = css.slice(css.indexOf(".prompt {"), css.indexOf(".prompt.is-clash"));
    expect(prompt).toMatch(/padding:\s*4px 12px/);
    expect(prompt).toMatch(/min-height:\s*36px/);
    expect(css).toMatch(/\.power\.is-loud\s*\{[^}]*min-height:\s*36px/);
  });

  it("lets voyage meters wrap so Coach and Reasons are not clipped beside the rail", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    const topbar = css.slice(css.indexOf(".topbar {"), css.indexOf(".topbar-map"));
    expect(topbar).toMatch(/minmax\(0,\s*max-content\)/);
    expect(css).toMatch(/\.meters \{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.hud-core,\s*\.hud-toggles \{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.hud-core,\s*\.hud-toggles \{[^}]*min-width:\s*0/);
  });

  it("paints an inline chart in the logo-to-Power gap at a whisper opacity", () => {
    expect(TOPBAR_MAP).toContain('class="topbar-map"');
    expect(TOPBAR_MAP).toContain('viewBox="0 0 1600 56"');
    expect(TOPBAR_MAP).not.toMatch(/Never Land|Peter|Disney|Hangman|Mermaid|Skull|Jolly/);

    const html = renderPlay(lagoonCoverScene());
    const root = document.createElement("div");
    root.innerHTML = html;
    const topbar = root.querySelector(".topbar");
    const map = topbar?.querySelector("svg.topbar-map");
    const power = topbar?.querySelector(".power");
    expect(map).toBeTruthy();
    expect(power).toBeTruthy();
    const brand = topbar?.querySelector(".brand");
    expect(brand).toBeTruthy();
    expect(map).toBeTruthy();
    expect(power).toBeTruthy();
    expect(brand!.compareDocumentPosition(map!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(map!.compareDocumentPosition(power!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("tightens vertical button and chrome spacing without dropping laptop taps under 32px", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    const topbar = css.slice(css.indexOf(".topbar {"), css.indexOf(".topbar-map"));
    expect(topbar).toMatch(/padding:\s*2px 12px/);
    expect(topbar).toMatch(/min-height:\s*40px/);

    const prompt = css.slice(css.indexOf(".prompt {"), css.indexOf(".prompt.is-clash"));
    expect(prompt).toMatch(/padding:\s*4px 12px/);
    expect(prompt).toMatch(/gap:\s*8px/);
    expect(prompt).toMatch(/min-height:\s*36px/);
    expect(css).toMatch(/\.prompt-actions\s*\{[^}]*gap:\s*6px/);
    expect(css).toMatch(/\.prompt-actions \.btn\s*\{[^}]*padding:\s*4px 14px/);
    expect(css).toMatch(/\.prompt-actions \.btn\s*\{[^}]*min-height:\s*32px/);

    expect(css).toMatch(/\.action\s*\{[^}]*min-height:\s*32px/);
    expect(css).toMatch(/\.action\s*\{[^}]*padding:\s*3px 6px/);
    expect(css).toMatch(/\.row\s*\{[^}]*gap:\s*3px/);
    expect(css).toMatch(/\.row\s*\{[^}]*margin-bottom:\s*2px/);
    expect(css).toMatch(/\.chip\s*\{[^}]*min-height:\s*32px/);
    expect(css).toMatch(/\.ctrl\s*\{[^}]*min-height:\s*32px/);
    expect(css).toMatch(/\.meters \{[^}]*row-gap:\s*2px/);
    expect(css).toMatch(/\.voyage-progress\s*\{[^}]*padding:\s*3px 12px/);
    expect(css).toMatch(/\.location-choice \{[^}]*min-height:\s*32px/);
    expect(css).toMatch(/\.location-choice \.drop-hint \{[^}]*min-height:\s*32px/);
    expect(css).toMatch(/\.placement-choices \{[^}]*gap:\s*6px/);
    expect(css).toMatch(/\.placement-choices \.btn \{[^}]*min-height:\s*36px/);
    expect(css).toMatch(/\.dock\s*\{[^}]*padding:\s*2px 12px 4px/);

    const phone = css.slice(css.lastIndexOf("@media (max-width: 760px)"));
    expect(phone).toMatch(/\.prompt-actions \.btn\s*\{[^}]*min-height:\s*44px/);
    expect(phone).toMatch(/\.action\s*\{[^}]*min-height:\s*44px/);
    expect(phone).toMatch(/\.chip\s*\{[^}]*min-height:\s*44px/);
    expect(phone).toMatch(/\.ctrl\s*\{[^}]*min-height:\s*44px/);
    expect(phone).toMatch(/\.location-choice \.drop-hint\s*\{[^}]*min-height:\s*44px/);
    expect(phone).toMatch(/\.placement-choices \.btn\s*\{[^}]*min-height:\s*44px/);
  });

  it("treats an open tree with Peter still hidden as honest brief and End-turn coach", () => {
    const state = lagoonCoverScene();
    const brief = strategyBrief(state);
    expect(brief.objective.find((o) => o.key === "map")?.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "peter")?.done).toBe(false);
    expect(state.locations.mermaidLagoon.heroes.some((h) => h.defId === "tinkerBell")).toBe(true);

    const html = renderPlay(state);
    const root = document.createElement("div");
    root.innerHTML = html;
    const lagoon = root.querySelector('[data-loc="mermaidLagoon"]');
    expect(lagoon?.querySelector(".action.is-covered")).toBeTruthy();
    expect(advise(state).do).toMatch(/End the turn/i);
  });
});
