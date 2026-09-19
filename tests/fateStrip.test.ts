import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { fateShowStillInPlay } from "../src/engine/queries";
import { tickTockReportScene } from "../src/engine/scenes";
import { CAPTAIN_TOKEN } from "../src/ui/decor";
import { renderOverlay, renderPlay } from "../src/ui/app";
import { barePlayState, inst, putAlly, putHero } from "./helpers";

describe("Fate adversary memory", () => {
  it("keeps the last computer Fate reveal after Continue", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("wendy")];
    const report = applyInput(state, { type: "endTurn" });
    expect(report.lastFateShow?.played?.defId).toBe("tickTock");
    expect(report.lastFateShow?.abilityText).toMatch(/discard every card in hand/);
    expect(report.lastFateShow?.drawn).toHaveLength(2);

    const after = applyInput(report, { type: "acknowledgeFate" });
    expect(after.pending).toBeNull();
    expect(after.lastFateShow?.played?.defId).toBe("tickTock");
    expect(after.lastFateShow?.note).toMatch(/Tick Tock/);
  });

  it("does not expose the face-down Fate deck on the strip memory", () => {
    const state = barePlayState();
    state.fateDeck = [inst("tickTock"), inst("wendy"), inst("john")];
    state.phase = "actions";
    const report = applyInput(state, { type: "endTurn" });
    const shown = new Set((report.lastFateShow?.drawn ?? []).map((c) => c.defId));
    expect(shown.has("john")).toBe(false);
    expect(report.fateDeck.some((c) => c.defId === "john")).toBe(true);
  });

  it("still shows full Tick Tock text on the intervening modal", () => {
    const html = renderOverlay(tickTockReportScene());
    expect(html).toContain("discard every card in hand");
    expect(html).toContain("Continue");
  });
});

describe("Fate strip clears when the subject leaves", () => {
  it("rewrites Across the table after a clinging attachment's Hero is vanquished", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const tinker = putHero(state, "tinkerBell", "jollyRoger");
    const taunt = inst("taunt");
    state.attachments.push({ item: taunt, attachedTo: tinker.instanceId });
    state.lastFateShow = {
      drawn: [taunt, inst("michael")],
      played: taunt,
      discarded: [],
      note: "Taunt clings to Tinker Bell.",
      abilityText: "Taunt: You must vanquish this Hero before other Heroes here.",
    };
    putAlly(state, "boardingParty", "jollyRoger");

    const live = renderPlay(state, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(live).toContain("Taunt clings to Tinker Bell");
    expect(fateShowStillInPlay(state, state.lastFateShow)).toBe(true);

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: tinker.instanceId });
    const ally = next.locations.jollyRoger.allies[0];
    next = applyInput(next, { type: "selectCard", instanceId: ally.instanceId });
    next = applyInput(next, { type: "confirm" });

    expect(fateShowStillInPlay(next, next.lastFateShow)).toBe(false);
    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("That Fate is over");
    expect(html).not.toContain("Taunt clings to Tinker Bell");
    expect(html).not.toContain("is-focus");
  });

  it("rewrites the strip after a fizzled Fate is acknowledged", () => {
    const state = barePlayState();
    state.difficulty = "easy";
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const dust = inst("pixieDust");
    const michael = inst("michael");
    state.fateDeck = [dust, michael];
    let report = applyInput(state, { type: "endTurn" });
    for (let seed = 1; seed <= 80 && report.pending?.kind === "fateReport" && report.pending.played?.defId !== "pixieDust"; seed++) {
      const retry = barePlayState();
      retry.difficulty = "easy";
      retry.rng = seed;
      retry.villainLocation = "jollyRoger";
      retry.phase = "actions";
      retry.fateDeck = [inst("pixieDust"), inst("michael")];
      report = applyInput(retry, { type: "endTurn" });
    }
    expect(report.pending?.kind).toBe("fateReport");
    if (report.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(report.pending.played?.defId).toBe("pixieDust");
    expect(report.pending.note).toMatch(/no Hero/);

    const after = applyInput(report, { type: "acknowledgeFate" });
    expect(fateShowStillInPlay(after, after.lastFateShow)).toBe(false);
    const html = renderPlay(after, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("That Fate is over");
    expect(html).not.toMatch(/Pixie Dust clings|is-focus/);
  });
});

describe("captain pawn", () => {
  it("is an original silhouette with a You label hook, not a crest-only token", () => {
    expect(CAPTAIN_TOKEN).toContain("captain-figure");
    expect(CAPTAIN_TOKEN).toMatch(/viewBox="0 0 72 92"/);
    expect(CAPTAIN_TOKEN.toLowerCase()).not.toMatch(/disney|hook crest/);
  });
});
