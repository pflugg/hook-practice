/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, highlightSet } from "../src/engine/game";
import { explainSelection, liveMoveReason } from "../src/engine/moveReason";
import {
  availableActions,
  clashAndCrocLine,
  heroStrength,
  promptText,
  vanquishableHeroes,
} from "../src/engine/queries";
import { strategyBrief } from "../src/engine/strategyBrief";
import { renderPlay } from "../src/ui/app";
import { attachTo, barePlayState, give, putAlly, putHero } from "./helpers";

function tauntShipState() {
  const state = barePlayState();
  state.hangmansUnlocked = true;
  state.villainLocation = "jollyRoger";
  state.phase = "actions";
  const peter = putHero(state, "peterPan", "jollyRoger");
  putAlly(state, "boardingParty", "jollyRoger");
  putAlly(state, "pirateBrute", "jollyRoger");
  putAlly(state, "swashbuckler", "jollyRoger");
  putAlly(state, "swashbuckler", "jollyRoger");
  const michael = putHero(state, "michael", "skullRock");
  putHero(state, "wendy", "skullRock");
  putHero(state, "tickTock", "skullRock");
  putHero(state, "john", "skullRock");
  attachTo(state, "taunt", michael.instanceId);
  return { state, peter, michael };
}

describe("hour playtest Must: Vanquish honesty when no legal hero", () => {
  it("disables Vanquish when the pool is empty and banners Taunt with live Strength", () => {
    const { state, peter, michael } = tauntShipState();
    expect(heroStrength(state, peter)).toBe(9);
    expect(vanquishableHeroes(state)).toEqual([]);
    expect(availableActions(state).find((a) => a.key === "jr-vanquish")?.available).toBe(false);
    expect(highlightSet(state).has("act:jr-vanquish")).toBe(false);

    const html = renderPlay(state, { coachEnabled: true, briefEnabled: true, reasonsEnabled: true });
    expect(html).toMatch(/data-act="jr-vanquish"[^>]*disabled|disabled[^>]*data-act="jr-vanquish"/);
    expect(promptText(state)).toMatch(/Taunt: Michael must be vanquished first/);
    expect(promptText(state)).toMatch(/Allies here total 2 vs his \d+/);
    expect(advise(state).warning ?? "").toMatch(/Taunt: Michael must be vanquished first/);

    const after = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(after.pending).toBeNull();
    expect(after.usedActions).not.toContain("jr-vanquish");
    expect(after.bannerNote).toMatch(/Taunt: Michael must be vanquished first/);
    expect(after.bannerNote).toMatch(new RegExp(`Allies here total 2 vs his ${heroStrength(state, michael)}`));
    expect(promptText(after)).toBe(after.bannerNote);
    expect(after.log.some((e) => /Taunt: Michael/.test(e.text))).toBe(true);
    expect(after.log.some((e) => e.text === "No Hero can be vanquished right now.")).toBe(false);

    const reason = explainSelection(state, { type: "selectAction", actionKey: "jr-vanquish" }, after);
    expect(reason?.chose).toMatch(/cannot name a Hero/i);
    expect(reason?.why).toMatch(/Taunt: Michael/);
    expect(reason?.chose).not.toMatch(/You opened Vanquish/);
  });
});

describe("hour playtest Must: stale coach / Tick Tock banner", () => {
  it("drops the standing-here crocodile warning when Tick Tock is not colocated", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    state.power = 2;
    putHero(state, "tickTock", "skullRock");
    putHero(state, "john", "skullRock");
    putAlly(state, "boardingParty", "skullRock");
    give(state, "hooksCase");

    expect(clashAndCrocLine(state)).toBe("");
    expect(promptText(state)).not.toMatch(/standing here/);
    expect(advise(state).warning ?? "").not.toMatch(/standing here/);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "ht-play" });
    expect(advise(choosing).do).toMatch(/Hook's Case/);
    const cancelled = applyInput(choosing, { type: "cancel" });
    const gained = applyInput(cancelled, { type: "selectAction", actionKey: "ht-gain" });
    expect(gained.power).toBe(4);
    expect(gained.usedActions).toContain("ht-gain");

    expect(clashAndCrocLine(gained)).toBe("");
    expect(promptText(gained)).not.toMatch(/standing here|John is 2 and Boarding Party/);
    const advice = advise(gained);
    expect(advice.warning ?? "").not.toMatch(/standing here/);
    expect(gained.pending).toBeNull();
    expect(advice.do).not.toMatch(/Move to /);
    if (/Hook's Case/.test(advice.do)) {
      expect(advice.do).toMatch(/click Play a Card/);
    }

    const opened = explainSelection(state, { type: "selectAction", actionKey: "ht-play" }, choosing);
    const liveAfterGain = liveMoveReason(gained, opened);
    expect(liveAfterGain.chose).not.toMatch(/You opened Play a Card/);
  });
});

describe("hour playtest Must: Why-text uses the live board", () => {
  it("names Peter’s live Strength and only Allies that exist", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    state.power = 2;
    const peter = putHero(state, "peterPan", "jollyRoger");
    putHero(state, "wendy", "skullRock");
    putAlly(state, "pirateBrute", "jollyRoger");
    const swash = give(state, "swashbuckler");
    expect(heroStrength(state, peter)).toBe(9);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "ht-play" });
    const picked = applyInput(choosing, { type: "selectCard", instanceId: swash.instanceId });
    const reason = explainSelection(choosing, { type: "selectCard", instanceId: swash.instanceId }, picked);
    expect(reason?.why).toMatch(/Strength 9/);
    expect(reason?.why).toMatch(/Wendy/);
    expect(reason?.why).not.toMatch(/8 unbuffed/);
    expect(reason?.why).not.toMatch(/two Pirate Brutes/i);
    expect(reason?.why).not.toMatch(/Smee/);
    expect(reason?.why).toMatch(/Pirate Brute/);
    expect(reason?.why).toMatch(/Swashbuckler/);
  });
});

describe("hour playtest Should: move-phase actions stay dark", () => {
  it("disables printed and extra actions during the required move and writes no post-selection", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "move";
    putHero(state, "peterPan", "jollyRoger");
    give(state, "hooksCase");

    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    expect(html).toMatch(/data-act="jr-vanquish"[^>]*disabled|disabled[^>]*data-act="jr-vanquish"/);
    expect(html).toMatch(/data-act="jr-play"[^>]*disabled|disabled[^>]*data-act="jr-play"/);
    expect(html).toMatch(/data-act="jr-gain"[^>]*disabled|disabled[^>]*data-act="jr-gain"/);
    expect(html).not.toMatch(/class="action[^"]*is-legal[^"]*"[^>]*data-act="jr-vanquish"/);

    const after = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(after.phase).toBe("move");
    expect(after.pending).toBeNull();
    expect(explainSelection(state, { type: "selectAction", actionKey: "jr-vanquish" }, after)).toBeNull();
  });
});

describe("hour playtest Should: objective progress past the tree", () => {
  it("shows Peter found, on the ship, and Taunt in the way", () => {
    const { state } = tauntShipState();
    const brief = strategyBrief(state);
    expect(brief.objective.find((o) => o.key === "map")?.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "peter")?.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "peter")?.label).toMatch(/Peter found/);
    expect(brief.objective.find((o) => o.key === "walk")?.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "walk")?.label).toMatch(/on the ship/);
    expect(brief.objective.find((o) => o.key === "clash")?.done).toBe(false);
    expect(brief.objective.find((o) => o.key === "clash")?.label).toMatch(/Taunt is in the way/);
    expect(brief.objective.find((o) => o.key === "clash")?.current).toBe(true);
    expect(brief.objective.find((o) => o.key === "clash")?.status).toMatch(/Taunt is in the way/);

    const html = renderPlay(state, { coachEnabled: false, briefEnabled: true, reasonsEnabled: false });
    expect(html).toMatch(/Peter found/);
    expect(html).toMatch(/Peter is on the ship/);
    expect(html).toMatch(/Taunt is in the way/);
  });
});
