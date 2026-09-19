import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { tickTockReportScene } from "../src/engine/scenes";
import { CAPTAIN_TOKEN } from "../src/ui/decor";
import { renderOverlay } from "../src/ui/app";
import { barePlayState, inst } from "./helpers";

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

describe("captain pawn", () => {
  it("is an original silhouette with a You label hook, not a crest-only token", () => {
    expect(CAPTAIN_TOKEN).toContain("captain-figure");
    expect(CAPTAIN_TOKEN).toMatch(/viewBox="0 0 64 80"/);
    expect(CAPTAIN_TOKEN.toLowerCase()).not.toMatch(/disney|hook crest/);
  });
});
