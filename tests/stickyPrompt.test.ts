/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { mount, renderPlay } from "../src/ui/app";
import { barePlayState, give } from "./helpers";

describe("sticky command / prompt bar", () => {
  it("pins every prompt, not only the clash meter", () => {
    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    const promptBlock = css.slice(css.indexOf(".prompt {"), css.indexOf(".prompt.is-clash"));
    expect(promptBlock).toMatch(/position:\s*sticky/);
    expect(promptBlock).toMatch(/top:\s*0/);
    expect(promptBlock).toMatch(/z-index:\s*12/);
    expect(css).toContain(".play-main");
    expect(css).toContain(".play-chrome");
    expect(css).toContain(".play-scroll");
    expect(css).toMatch(/\.play-scroll\s*\{[^}]*overflow:\s*auto/);
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(css).toMatch(/100dvh/);
    expect(css).not.toMatch(/\.prompt\.is-clash\s*\{[^}]*position:\s*sticky/);
  });

  it("keeps Confirm and Choose this place inside the sticky prompt", () => {
    const play = barePlayState();
    play.villainLocation = "jollyRoger";
    play.phase = "actions";
    play.power = 4;
    const cannon = give(play, "cannon");
    let next = applyInput(play, { type: "selectAction", actionKey: "jr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: cannon.instanceId });
    expect(next.pending?.kind).toBe("playChooseLocation");

    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    const root = document.createElement("div");
    root.innerHTML = html;
    const prompt = root.querySelector("[data-prompt]");
    const main = root.querySelector("[data-play-main]");
    expect(prompt).toBeTruthy();
    expect(main?.contains(prompt!)).toBe(true);
    expect(main?.querySelector(".dock")).toBeTruthy();
    expect(prompt?.querySelector("[data-cancel]")).toBeTruthy();
    const places = [...prompt!.querySelectorAll<HTMLButtonElement>("[data-move]")].map((el) => el.textContent);
    expect(places.some((t) => t?.includes("Choose this place") && t.includes("Jolly Roger"))).toBe(true);
    expect(places.some((t) => t?.includes("Skull Rock"))).toBe(false);
    expect(root.querySelectorAll(".location .drop-hint").length).toBeGreaterThan(0);
  });

  it("puts discard Confirm on the sticky prompt so a lower action cannot hide it", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    give(state, "cannon");
    const next = applyInput(state, { type: "selectAction", actionKey: "sr-discard" });
    expect(next.pending?.kind).toBe("discardSelect");

    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    const root = document.createElement("div");
    root.innerHTML = html;
    const prompt = root.querySelector("[data-prompt]");
    expect(prompt?.querySelector("[data-confirm]")?.textContent).toMatch(/Confirm/);
    expect(prompt?.querySelector("[data-cancel]")).toBeTruthy();
  });

  it("keeps play-main scroll when the board remounts after a hand click", () => {
    window.history.replaceState({}, "", "/?scene=clash");
    const root = document.createElement("div");
    document.body.appendChild(root);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
    mount(root);

    const scroller = root.querySelector<HTMLElement>("[data-play-scroll]");
    expect(scroller).toBeTruthy();
    scroller!.scrollTop = 220;
    const prompt = root.querySelector("[data-prompt]");
    expect(prompt).toBeTruthy();
    expect(root.querySelector(".play-chrome")?.contains(prompt!)).toBe(true);

    const hide = root.querySelector<HTMLButtonElement>("[data-coach-toggle]");
    hide?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(root.querySelector<HTMLElement>("[data-play-scroll]")?.scrollTop).toBe(220);
    root.remove();
  });
});
