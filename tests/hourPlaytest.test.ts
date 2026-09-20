/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, highlightSet } from "../src/engine/game";
import { explainSelection, liveMoveReason } from "../src/engine/moveReason";
import {
  availableActions,
  canPlayCunning,
  clashAndCrocLine,
  heroStrength,
  promptText,
  vanquishClashMath,
  vanquishableHeroes,
} from "../src/engine/queries";
import { strategyBrief } from "../src/engine/strategyBrief";
import { hourEqualVanquishScene } from "../src/engine/scenes";
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

describe("hour playtest Must: equal-strength vanquish opens the clash", () => {
  it("opens Tinker Bell 2 vs Swashbuckler 2 at the same place and never burns an empty Vanquish", () => {
    const state = hourEqualVanquishScene();
    const tinker = state.locations.jollyRoger.heroes.find((h) => h.defId === "tinkerBell");
    const swash = state.locations.jollyRoger.allies.find((a) => a.defId === "swashbuckler");
    expect(tinker).toBeTruthy();
    expect(swash).toBeTruthy();
    expect(heroStrength(state, tinker!)).toBe(2);
    expect(vanquishableHeroes(state).map((h) => h.hero.defId)).toEqual(["tinkerBell"]);
    expect(availableActions(state).find((a) => a.key === "jr-vanquish")?.available).toBe(true);

    const opened = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(opened.pending?.kind).toBe("vanquishHero");
    expect(opened.usedActions).not.toContain("jr-vanquish");
    expect(opened.bannerNote).toBe("");
    expect(opened.log.some((e) => e.text === "No Hero can be vanquished right now.")).toBe(false);

    const named = applyInput(opened, { type: "selectCard", instanceId: tinker!.instanceId });
    expect(named.pending?.kind).toBe("vanquishAllies");
    expect(promptText(named)).toMatch(/Clash Strength 0 \/ 2/);

    const picked = applyInput(named, { type: "selectCard", instanceId: swash!.instanceId });
    expect(vanquishClashMath(picked)).toMatchObject({ need: 2, selected: 2, ready: true });
    expect(promptText(picked)).toMatch(/Clash Strength 2 \/ 2/);

    const done = applyInput(picked, { type: "confirm" });
    expect(done.locations.jollyRoger.heroes.some((h) => h.defId === "tinkerBell")).toBe(false);
    expect(done.usedActions).toContain("jr-vanquish");

    const empty = barePlayState();
    empty.villainLocation = "jollyRoger";
    empty.phase = "actions";
    putHero(empty, "tinkerBell", "jollyRoger");
    expect(vanquishableHeroes(empty)).toEqual([]);
    const refused = applyInput(empty, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(refused.pending).toBeNull();
    expect(refused.usedActions).not.toContain("jr-vanquish");
    expect(refused.bannerNote).toMatch(/Tinker Bell is 2 and your Allies here total 0/);
  });
});

describe("hour playtest Must: Cunning stays put without an Ally", () => {
  it("does not offer Play it or a free-Ally coach when the hand has no Ally", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 2;
    putHero(state, "lostBoys", "skullRock");
    const cunning = give(state, "cunning");
    give(state, "hooksCase");
    expect(canPlayCunning(state)).toBe(false);
    expect(highlightSet(state).has(`card:${cunning.instanceId}`)).toBe(false);

    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    expect(html).not.toMatch(/Play it/);
    expect(html).not.toMatch(/A Condition is ready/);
    expect(advise(state).why).not.toMatch(/free Ally now is a gift/);
    expect(advise(state).do).not.toMatch(/Play the Condition|Cunning/);

    const clicked = applyInput(state, { type: "selectCard", instanceId: cunning.instanceId });
    expect(clicked.pending).toBeNull();
    expect(clicked.hand.some((c) => c.instanceId === cunning.instanceId)).toBe(true);
    expect(clicked.bannerNote).toMatch(/Cunning needs an Ally in hand/);
    expect(clicked.villainDiscard.some((c) => c.instanceId === cunning.instanceId)).toBe(false);

    const forced = structuredClone(clicked);
    forced.pending = { kind: "conditionOffer", conditionId: cunning.instanceId, reason: "Play Cunning?" };
    const accepted = applyInput(forced, { type: "acceptCondition" });
    expect(accepted.hand.some((c) => c.instanceId === cunning.instanceId)).toBe(true);
    expect(accepted.pending).toBeNull();
    expect(accepted.bannerNote).toMatch(/Cunning needs an Ally in hand/);
    expect(accepted.villainDiscard.some((c) => c.instanceId === cunning.instanceId)).toBe(false);
    expect(explainSelection(forced, { type: "acceptCondition" }, accepted)?.chose).toMatch(/stays in hand/);
  });
});

describe("hour playtest Must: move-phase actions stay dark", () => {
  it("disables printed and extra actions at the current stop and writes no post-selection", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "move";
    putHero(state, "peterPan", "jollyRoger");
    give(state, "hooksCase");

    const html = renderPlay(state, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    const root = document.createElement("div");
    root.innerHTML = html;
    const here = root.querySelector<HTMLElement>('[data-loc="jollyRoger"]');
    expect(here).toBeTruthy();
    const hereActs = [...here!.querySelectorAll<HTMLButtonElement>("[data-act]")];
    expect(hereActs.map((btn) => btn.dataset.act)).toEqual(
      expect.arrayContaining(["jr-vanquish", "jr-play", "jr-gain"]),
    );
    for (const btn of hereActs) {
      expect(btn.disabled).toBe(true);
      expect(btn.classList.contains("is-inert")).toBe(true);
      expect(btn.classList.contains("is-legal")).toBe(false);
    }

    const after = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    expect(after.phase).toBe("move");
    expect(after.pending).toBeNull();
    expect(explainSelection(state, { type: "selectAction", actionKey: "jr-vanquish" }, after)).toBeNull();
    const stay = applyInput(state, { type: "selectLocation", locationId: "jollyRoger" });
    expect(stay.villainLocation).toBe("jollyRoger");
    expect(explainSelection(state, { type: "selectLocation", locationId: "jollyRoger" }, stay)).toBeNull();

    const moving = barePlayState();
    moving.hangmansUnlocked = true;
    moving.villainLocation = "mermaidLagoon";
    moving.phase = "move";
    moving.power = 2;
    const gainHtml = renderPlay(moving, { coachEnabled: true, briefEnabled: false, reasonsEnabled: true });
    const lagoon = document.createElement("div");
    lagoon.innerHTML = gainHtml;
    const gain = lagoon.querySelector<HTMLButtonElement>('[data-loc="mermaidLagoon"] [data-act="ml-gain"]');
    expect(gain?.disabled).toBe(true);
    expect(gain?.classList.contains("is-inert")).toBe(true);
    const ghostGain = applyInput(moving, { type: "selectAction", actionKey: "ml-gain" });
    expect(ghostGain.phase).toBe("move");
    expect(ghostGain.power).toBe(2);
    expect(ghostGain.usedActions).not.toContain("ml-gain");
    const ghostWhy = explainSelection(moving, { type: "selectAction", actionKey: "ml-gain" }, ghostGain);
    expect(ghostWhy).toBeNull();
    expect(ghostWhy?.chose ?? "").not.toMatch(/You took Gain/);
    const liveGhost = liveMoveReason(ghostGain, ghostWhy);
    expect(liveGhost.chose).not.toMatch(/You took Gain/);
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
