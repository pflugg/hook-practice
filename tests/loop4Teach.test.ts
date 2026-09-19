import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput } from "../src/engine/game";
import { clashAndCrocLine, fateEmptyLine, promptText } from "../src/engine/queries";
import { strategyBrief } from "../src/engine/strategyBrief";
import { renderOverlay, renderPlay } from "../src/ui/app";
import { barePlayState, give, inst, putAlly, putHero } from "./helpers";

describe("loop-4 Should teaching", () => {
  it("relabels the pay meter as pay / have / left, not a ratio", () => {
    const state = barePlayState();
    state.phase = "resolving";
    state.power = 4;
    const cannon = give(state, "cannon");
    state.pending = { kind: "playChoosePayment", cardId: cannon.instanceId, locationId: "jollyRoger" };
    const html = renderOverlay(state);
    expect(html).toContain("Pay 2 · you have 4 · 2 left");
    expect(html).not.toMatch(/Power 4 \/ cost 2/);
  });

  it("names a cheap clash and the Tick Tock wipe in one prompt, coach, and snap log", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "move";
    putHero(state, "tickTock", "jollyRoger");
    putHero(state, "tinkerBell", "jollyRoger");
    putAlly(state, "smee", "jollyRoger");
    give(state, "cannon");

    const line = clashAndCrocLine(state);
    expect(line).toMatch(/Tinker Bell is 2 and Smee is 4/);
    expect(line).toMatch(/discards your hand/);
    expect(promptText(state)).toContain(line);

    const advice = advise(state);
    expect(advice.warning ?? "").toBe(line);

    const snapped = applyInput(state, { type: "selectLocation", locationId: "jollyRoger" });
    expect(snapped.log.some((e) => /Tick Tock snaps/.test(e.text) && /Tinker Bell is 2/.test(e.text))).toBe(true);
    if (snapped.pending?.kind !== "fateReport") throw new Error("expected snap report");
    expect(snapped.pending.note).toMatch(/Tick Tock snaps/);
    expect(snapped.pending.note).toMatch(/Tinker Bell is 2 and Smee is 4/);
  });

  it("says when the Fate deck hits 0 in the log, brief, and log header", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.fateDeck = [];
    state.fateDiscard = [];
    expect(fateEmptyLine(state)).toMatch(/computer will not answer/);

    const ended = applyInput(state, { type: "endTurn" });
    expect(ended.log.some((e) => /Fate has no cards left, so the computer will not answer/.test(e.text))).toBe(true);
    expect(strategyBrief(ended).where).toMatch(/computer will not answer/);

    const html = renderPlay(ended, { coachEnabled: false, briefEnabled: true, reasonsEnabled: false });
    expect(html).toContain("Log · Fate 0 · empty");
    expect(html).toMatch(/computer will not answer/);
  });

  it("cues a Fate reshuffle when the deck is empty but the discard can return", () => {
    const state = barePlayState();
    state.phase = "actions";
    state.fateDeck = [inst("wendy"), inst("john")];
    state.fateDiscard = [inst("pixieDust")];
    state.villainLocation = "jollyRoger";
    const ended = applyInput(state, { type: "endTurn" });
    expect(ended.log.some((e) => /Fate deck is empty/.test(e.text) && /reshuffle/.test(e.text))).toBe(true);
    expect(strategyBrief(ended).where).toMatch(/reshuffle/);
  });

  it("marks Obsession spent once Peter is already ashore", () => {
    const state = barePlayState();
    state.phase = "actions";
    putHero(state, "peterPan", "hangmansTree");
    give(state, "obsession");
    const html = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain('data-spent="obsession"');
    expect(html).toContain("Spent");
    expect(html).toMatch(/Peter is already in the realm/);
    const chunk = html.slice(html.indexOf('data-spent="obsession"') - 80, html.indexOf('data-spent="obsession"') + 40);
    expect(chunk).not.toMatch(/is-legal/);
  });
});
