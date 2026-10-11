/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPlay } from "../src/ui/app";
import { travelDelta } from "../src/ui/motion";
import { barePlayState, give, putHero } from "./helpers";

describe("board hero", () => {
  it("packs menu, status, shore tabs, and an expandable board rule into one chrome", () => {
    const state = barePlayState();
    const hero = putHero(state, "wendy", "skullRock");
    const html = renderPlay(state, { expandedIds: new Set([hero.instanceId]) });
    expect(html).toContain("hud-menu");
    expect(html).toContain('data-shore-tab="skullRock"');
    expect(html).toContain(`data-rule-toggle="${hero.instanceId}"`);
    expect(html).toContain("is-expanded");
    expect(html).toContain(">Less<");
    const collapsed = renderPlay(state);
    expect(collapsed).toContain(">More<");
    expect(collapsed).not.toContain("is-expanded");
    expect(html).toContain(
      `Hand ${state.hand.length} · Deck ${state.villainDeck.length} · Discard ${state.villainDiscard.length}`,
    );
    const prompt = html.indexOf("data-prompt");
    const voyage = html.indexOf("voyage-progress");
    const stage = html.indexOf('class="stage"');
    expect(prompt).toBeGreaterThan(-1);
    expect(voyage).toBeGreaterThan(prompt);
    expect(voyage).toBeLessThan(stage);

    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    const motion = readFileSync(join(process.cwd(), "src/ui/motion.ts"), "utf8");
    expect(css).toContain("scroll-snap-type");
    expect(css).toContain(".card.mini.is-expanded .text");
    expect(css).toContain("hud-menu");
    expect(motion).toContain("prefers-reduced-motion");
  });

  it("shows the plan, a rival token, and a hand rule when the ability is long", () => {
    const state = barePlayState();
    const long = give(state, "obsession");
    const html = renderPlay(state, {
      handRuleId: long.instanceId,
      briefEnabled: false,
      reasonsEnabled: false,
    });
    expect(html).toContain("data-coach-plan");
    expect(html).toContain('data-plan-stage="hideout"');
    expect(html).toContain('data-plan-mark="now"');
    expect(html).toContain("plan-line");
    expect(html).toContain("rival-token");
    expect(html).toContain(`data-hand-rule="${long.instanceId}"`);
    expect(html).toContain("data-hand-popover");
    expect(html).toContain("Hangman’s Tree");
    const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");
    expect(css).toContain(".prompt .prompt-place { display: none; }");
  });

  it("skips a travel that did not move and a box with no size", () => {
    const box = { left: 10, top: 20, width: 40, height: 30 };
    expect(travelDelta(box, box)).toBeNull();
    expect(travelDelta(box, { ...box, left: 20 })).toEqual({ dx: -10, dy: 0 });
    expect(travelDelta({ ...box, width: 0 }, { ...box, left: 40 })).toBeNull();
  });
});
