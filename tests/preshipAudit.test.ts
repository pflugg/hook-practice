/**
 * @vitest-environment jsdom
 *
 * Pre-ship Must/Should (HP-01–HP-26). Nice items HP-27–HP-38 stay out of this pass.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInput, highlightSet, resignBlocked } from "../src/engine/game";
import { explainSelection, liveMoveReason, IDLE_MOVE_REASON } from "../src/engine/moveReason";
import { availableActions, emptyHandCopy, promptText } from "../src/engine/queries";
import { renderOverlay, renderPlay } from "../src/ui/app";
import { resolveBoardClick } from "../src/ui/clicks";
import { barePlayState, give, putAlly, putHero } from "./helpers";

const css = readFileSync(join(process.cwd(), "src/ui/styles.css"), "utf8");

describe("pre-ship must", () => {
  it("HP-01 lets the narrow shell scroll and does not pin the HUD", () => {
    const narrow = css.slice(css.indexOf("@media (max-width: 1100px)"));
    expect(narrow).toMatch(/html, body, #app[\s\S]*overflow-y:\s*auto/);
    expect(narrow).toMatch(/max-height:\s*none/);
    expect(narrow).toMatch(/\.play-chrome,\s*\.prompt\s*\{[^}]*position:\s*static/);
    expect(css).toMatch(/\.coach-do\s*\{[^}]*font-size:\s*18px/);
    expect(css).toMatch(/\.coach-why\s*\{[^}]*font-size:\s*14px/);
    expect(css).toMatch(/\.brief-block p\s*\{[^}]*font-size:\s*14\.5px/);
    expect(css).toMatch(/\.reason-block p\s*\{[^}]*font-size:\s*14px/);
  });

  it("HP-02 gives the board a scroll width and a phone column break, and the hand can shrink", () => {
    expect(css).toMatch(/\.board\s*\{[^}]*width:\s*max\(100%, 752px\)/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.hand-row\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.hand-row\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.hand \{[^}]*min-width:\s*0/);
  });

  it("HP-03 puts Cancel on an unaffordable payment modal and cancel returns safely", () => {
    const state = barePlayState();
    state.phase = "resolving";
    state.power = 0;
    const brute = give(state, "pirateBrute");
    state.pending = { kind: "playChoosePayment", cardId: brute.instanceId, locationId: "jollyRoger" };
    const html = renderOverlay(state);
    expect(html).toContain("data-cancel");
    expect(html).toContain(">Cancel<");
    expect(html).toMatch(/data-pay-power[^>]*disabled|disabled[^>]*data-pay-power/);
    expect(html).toContain('aria-modal="true"');
    expect(html).not.toContain("pass-through");

    const back = applyInput(state, { type: "cancel" });
    expect(back.pending?.kind).toBe("playChooseLocation");
    expect(back.hand.some((c) => c.instanceId === brute.instanceId)).toBe(true);
    expect(back.power).toBe(0);
    expect(back.phase).not.toBe("over");
  });

  it("HP-04 does not credit a rejected play or slide", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "resolving";
    state.power = 3;
    state.hangmansUnlocked = false;
    const smee = give(state, "smee");
    state.pending = { kind: "playChooseLocation", cardId: smee.instanceId };

    const root = document.createElement("div");
    root.innerHTML = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    const locked = root.querySelector<HTMLButtonElement>('[data-loc="hangmansTree"] [data-act]');
    expect(locked?.disabled).toBe(true);
    expect(resolveBoardClick(locked!, state)).toBeNull();

    const rejected = applyInput(state, { type: "selectLocation", locationId: "hangmansTree" });
    expect(rejected.pending?.kind).toBe("playChooseLocation");
    expect(explainSelection(state, { type: "selectLocation", locationId: "hangmansTree" }, rejected)).toBeNull();
    const last = {
      chose: "You played Smee to Hangman’s Tree.",
      why: "A false line from a click the engine refused.",
      next: "This must not linger.",
    };
    const live = liveMoveReason(rejected, last);
    expect(live.chose).not.toMatch(/You played Smee/);
    expect(`${live.chose} ${live.why}`).not.toMatch(/You moved|You slid|You strapped/);
  });
});

describe("pre-ship should", () => {
  it("HP-05–HP-07 HP-11 raise contrast and neighbor floors without shrinking locked type", () => {
    expect(css).toMatch(/\.card\.item \.meta,\s*\.card\.item \.badge\s*\{[^}]*color:\s*#3d260c/);
    expect(css).toMatch(/\.spent-tag\s*\{[^}]*background:\s*#2a1810/);
    expect(css).toMatch(/\.spent-tag\s*\{[^}]*color:\s*#fff8e8/);
    expect(css).toMatch(/\.brief-obj-title\s*\{[^}]*font-size:\s*14\.5px/);
    expect(css).toMatch(/\.coach-warn\s*\{[^}]*font-size:\s*14px/);
    expect(css).toMatch(/\.reason-foot\s*\{[^}]*font-size:\s*14px/);
    expect(css).toMatch(/\.reason-block h3\s*\{[^}]*font-size:\s*14px/);
    expect(css).not.toMatch(/\.location\.is-locked \.action[\s\S]*?#f4e8c8/);
    expect(css).toMatch(/\.location\.is-locked \.action[\s\S]*?background:\s*rgba\(8, 8, 10, 0\.28\)/);
  });

  it("HP-13–HP-14 HP-16–HP-18 HP-24 keep the how-to scrollable and add hit, hover, and focus rules", () => {
    expect(css).toMatch(/\.modal\s*\{[^}]*max-height:\s*min\(92dvh, 920px\)/);
    expect(css).toMatch(/\.modal\s*\{[^}]*overflow:\s*auto/);
    expect(css).toMatch(/\.chip\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.drop-hint,\s*\.prompt-place\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.action:hover:not\(:disabled\)/);
    expect(css).toMatch(/\.action:active:not\(:disabled\)/);
    expect(css).toMatch(/\.ctrl:disabled/);
    expect(css).toMatch(/\.drop-hint:active/);
    expect(css).toMatch(/\.location\.is-legal:hover/);
    expect(css).toMatch(/button:focus-visible/);
  });

  it("HP-15 disables Play and Move when they cannot resolve and does not burn them", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 0;
    state.hand = [];
    expect(availableActions(state).find((a) => a.key === "jr-play")?.available).toBe(false);
    expect(promptText(state)).toMatch(/Play a Card is dark/);

    const html = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toMatch(/data-act="jr-play"[^>]*disabled|disabled[^>]*data-act="jr-play"/);

    const after = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    expect(after.usedActions).not.toContain("jr-play");
    expect(after.pending).toBeNull();
    expect(after.bannerNote).toMatch(/hand is empty/);
    expect(explainSelection(state, { type: "selectAction", actionKey: "jr-play" }, after)?.chose).toMatch(/did not spend/);

    const lagoon = barePlayState();
    lagoon.villainLocation = "mermaidLagoon";
    lagoon.phase = "actions";
    lagoon.hand = [];
    expect(availableActions(lagoon).find((a) => a.kind === "moveItemAlly")?.available).toBe(false);
    expect(promptText(lagoon)).toMatch(/Move Ally\/Item is dark/);
    const slid = applyInput(lagoon, { type: "selectAction", actionKey: "ml-move" });
    expect(slid.usedActions).not.toContain("ml-move");
    expect(slid.pending).toBeNull();

    const tree = barePlayState();
    tree.villainLocation = "hangmansTree";
    tree.hangmansUnlocked = true;
    tree.phase = "actions";
    expect(availableActions(tree).find((a) => a.kind === "moveHero")?.available).toBe(false);
    expect(promptText(tree)).toMatch(/Move a Hero is dark/);
    const walked = applyInput(tree, { type: "selectAction", actionKey: "ht-moveHero" });
    expect(walked.usedActions).not.toContain("ht-moveHero");
    expect(walked.pending).toBeNull();
  });

  it("HP-19 matches empty-hand copy to the live control", () => {
    const discarding = barePlayState();
    discarding.phase = "resolving";
    discarding.hand = [];
    discarding.pending = { kind: "discardSelect", selected: [] };
    expect(emptyHandCopy(discarding)).toMatch(/Confirm/);
    expect(emptyHandCopy(discarding)).not.toMatch(/End the turn to draw/);

    const moving = barePlayState();
    moving.phase = "move";
    moving.hand = [];
    expect(emptyHandCopy(moving)).toMatch(/Move/);
    expect(emptyHandCopy(moving)).not.toMatch(/^Your hand is empty\. End the turn/);

    const html = renderPlay(discarding, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("Confirm still spends this Discard");
    expect(html).not.toContain("End the turn to draw back up — unless Tick Tock");
  });

  it("HP-20 changes the Fate strip when the Fate deck is empty", () => {
    const state = barePlayState();
    state.phase = "actions";
    state.fateDeck = [];
    state.fateDiscard = [];
    const html = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("Fate deck empty");
    expect(html).toContain("Fate has no cards left");
    expect(html).toContain("Log · Fate 0 · empty");
  });

  it("HP-21 refuses a Cutlass with no Ally instead of staying silent", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "resolving";
    state.power = 2;
    const cutlass = give(state, "cutlass");
    state.pending = { kind: "playChooseCard" };
    const refused = applyInput(state, { type: "selectCard", instanceId: cutlass.instanceId });
    expect(refused.pending?.kind).toBe("playChooseCard");
    expect(refused.bannerNote).toMatch(/needs an Ally already ashore/);
    expect(refused.hand.some((c) => c.instanceId === cutlass.instanceId)).toBe(true);
    const reason = explainSelection(state, { type: "selectCard", instanceId: cutlass.instanceId }, refused);
    expect(reason?.why).toMatch(/Ally already ashore/);
    expect(reason?.chose).not.toMatch(/strapped/i);
  });

  it("HP-22 dims illegal Allies during a clash and a bad click is a refuse, not only Inspect", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const hero = putHero(state, "lostBoys", "jollyRoger");
    const legal = putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    const remote = putAlly(state, "smee", "skullRock");
    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: hero.instanceId });
    expect(next.pending?.kind).toBe("vanquishAllies");
    expect(highlightSet(next).has(`card:${legal.instanceId}`)).toBe(true);
    expect(highlightSet(next).has(`card:${remote.instanceId}`)).toBe(false);

    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    const remoteAt = html.indexOf(`data-card="${remote.instanceId}"`);
    const remoteChunk = html.slice(Math.max(0, remoteAt - 80), remoteAt + 40);
    expect(remoteChunk).toContain("is-dimmed");

    const refused = applyInput(next, { type: "selectCard", instanceId: remote.instanceId });
    expect(refused.pending?.kind).toBe("vanquishAllies");
    expect(refused.bannerNote).toMatch(/cannot join this clash/);
    expect(explainSelection(next, { type: "selectCard", instanceId: remote.instanceId }, refused)?.chose).toMatch(
      /stayed out/,
    );
  });

  it("HP-23 disables resign under Fate, payment, and game over", () => {
    const fate = barePlayState();
    fate.phase = "actions";
    fate.fateDeck = [];
    fate.pending = {
      kind: "fateReport",
      drawn: [],
      discarded: [],
      note: "Fate intervening.",
      abilityText: "Fate already acted.",
      resume: "nextTurn",
      markAction: false,
    };
    expect(resignBlocked(fate)).toBe(true);
    const fateHtml = renderPlay(fate, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(fateHtml).toMatch(/data-resign[^>]*disabled|disabled[^>]*data-resign/);
    expect(applyInput(fate, { type: "resign" })).toBe(fate);

    const paying = barePlayState();
    paying.phase = "resolving";
    const card = give(paying, "hooksCase");
    paying.pending = { kind: "playChoosePayment", cardId: card.instanceId, locationId: "jollyRoger" };
    expect(resignBlocked(paying)).toBe(true);
    expect(applyInput(paying, { type: "resign" }).phase).not.toBe("over");

    const over = applyInput(barePlayState(), { type: "resign" });
    expect(over.phase).toBe("over");
    expect(resignBlocked(over)).toBe(true);
    expect(applyInput(over, { type: "resign" })).toBe(over);
  });

  it("HP-25 does not say the Cutlass is strapped before payment", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "resolving";
    state.power = 1;
    const cutlass = give(state, "cutlass");
    const ally = putAlly(state, "swashbuckler", "skullRock");
    state.pending = { kind: "playChooseAllyAttach", cardId: cutlass.instanceId };
    const paying = applyInput(state, { type: "selectCard", instanceId: ally.instanceId });
    expect(paying.pending?.kind).toBe("playChoosePayment");
    const reason = explainSelection(state, { type: "selectCard", instanceId: ally.instanceId }, paying);
    expect(reason?.chose).not.toMatch(/strapped/i);
    expect(reason?.why).toMatch(/not strapped yet/);
    expect(paying.attachments.some((a) => a.item.defId === "cutlass")).toBe(false);
  });

  it("HP-26 gives Set Sail the only gold start and keeps Tutorial secondary", () => {
    const html = renderPlay(barePlayState());
    expect(html).not.toContain("data-start");
    const title = readFileSync(join(process.cwd(), "src/ui/app.ts"), "utf8");
    const starts = title.slice(title.indexOf("title-starts"), title.indexOf("title-tutorial-note"));
    expect(starts).toMatch(/class="btn primary"[^>]*data-start/);
    expect(starts).toMatch(/class="btn"[^>]*data-tutorial/);
    expect(starts).not.toMatch(/class="btn primary"[^>]*data-tutorial/);
    expect(IDLE_MOVE_REASON.why.length).toBeGreaterThan(40);
  });
});
