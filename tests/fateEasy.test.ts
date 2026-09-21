import { describe, expect, it } from "vitest";
import { chooseFateCard, explainFateChoice } from "../src/engine/fateAi";
import { applyInput } from "../src/engine/game";
import { renderOverlay } from "../src/ui/app";
import { barePlayState, inst, putHero } from "./helpers";

describe("Easy Fate must play a revealed Peter", () => {
  it("Normal still forces Peter from the pair", () => {
    const state = barePlayState();
    const peter = inst("peterPan");
    const wendy = inst("wendy");
    expect(chooseFateCard(state, [wendy, peter], "normal").card.defId).toBe("peterPan");
  });

  it("Easy always plays Peter when he is one of the two revealed cards", () => {
    const peter = inst("peterPan");
    const wendy = inst("wendy");
    for (let rng = 1; rng <= 80; rng++) {
      const state = { ...barePlayState(), rng };
      expect(chooseFateCard(state, [wendy, peter], "easy").card.defId).toBe("peterPan");
    }
  });

  it("computer Easy Fate plays Peter to the hideout and discards the other card", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = barePlayState();
      state.difficulty = "easy";
      state.rng = seed;
      state.villainLocation = "jollyRoger";
      state.phase = "actions";
      state.fateDeck = [inst("peterPan"), inst("wendy")];
      const next = applyInput(state, { type: "endTurn" });
      expect(next.pending?.kind).toBe("fateReport");
      if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
      expect(next.pending.played?.defId).toBe("peterPan");
      expect(next.locations.hangmansTree.heroes.some((h) => h.defId === "peterPan")).toBe(true);
      expect(next.fateDiscard.some((c) => c.defId === "wendy")).toBe(true);
      expect(next.pending.choiceReason).toMatch(/Peter was revealed/i);
    }
  });
});

describe("Fate choice explanation", () => {
  it("Easy fizzle names the random pick and the Normal alternative", () => {
    const state = barePlayState();
    const dust = inst("pixieDust");
    const michael = inst("michael");
    const reason = explainFateChoice(state, [dust, michael], dust, "easy");
    expect(reason).toMatch(/Easy Fate picked at random/);
    expect(reason).toMatch(/Michael stays down/);
    expect(reason).toMatch(/Normal pick would have played Michael/);
  });

  it("Normal explains the heuristic in one clause", () => {
    const state = barePlayState();
    putHero(state, "john", "skullRock");
    const dust = inst("pixieDust");
    const john = inst("john");
    const reason = explainFateChoice(state, [dust, john], dust, "normal");
    expect(reason).toMatch(/Normal Fate attached Pixie Dust/);
  });

  it("puts the reason on the intervening Easy fizzle modal", () => {
    let report = barePlayState();
    for (let seed = 1; seed <= 80; seed++) {
      const state = barePlayState();
      state.difficulty = "easy";
      state.rng = seed;
      state.villainLocation = "jollyRoger";
      state.phase = "actions";
      state.fateDeck = [inst("pixieDust"), inst("michael")];
      const next = applyInput(state, { type: "endTurn" });
      if (next.pending?.kind === "fateReport" && next.pending.played?.defId === "pixieDust") {
        report = next;
        break;
      }
    }
    expect(report.pending?.kind).toBe("fateReport");
    if (report.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(report.pending.choiceReason).toMatch(/Easy Fate picked at random/);
    expect(report.pending.choiceReason).toMatch(/Normal pick would have played Michael/);
    const html = renderOverlay(report);
    expect(html).toContain("data-fate-choice");
    expect(html).toMatch(/Easy Fate picked at random/);
    expect(html).toMatch(/Michael/);
  });
});
