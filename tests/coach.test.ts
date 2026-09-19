import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, createGame, highlightSet } from "../src/engine/game";
import { barePlayState, give, putAlly, putHero } from "./helpers";

function expectLegalHighlights(state: ReturnType<typeof barePlayState>, highlights: string[]) {
  const legal = highlightSet(state);
  for (const key of highlights) {
    if (key.startsWith("btn:")) continue;
    expect(legal.has(key), `${key} should be a legal highlight`).toBe(true);
  }
}

describe("coach suggestions", () => {
  it("recommends Mermaid Lagoon on the opening move", () => {
    const opening = createGame("normal", 7);
    expect(opening.phase).toBe("move");
    expect(opening.villainLocation).toBe("jollyRoger");
    expect(opening.power).toBe(0);

    const advice = advise(opening);
    expect(advice.do).toMatch(/Mermaid Lagoon/);
    expect(advice.highlights).toContain("loc:mermaidLagoon");
    expect(advice.why).toMatch(/Power|Map|Hangman’s Tree|Hangman's Tree/i);
    expectLegalHighlights(opening, advice.highlights);

    const scripted = barePlayState();
    scripted.phase = "move";
    scripted.villainLocation = "jollyRoger";
    scripted.power = 0;
    scripted.pending = null;
    const again = advise(scripted);
    expect(again.highlights).toContain("loc:mermaidLagoon");
  });

  it("recommends playing the Never Land Map when it is in hand with enough Power", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 4;
    const map = give(state, "neverLandMap");

    const before = advise(state);
    expect(before.do).toMatch(/Play a Card/i);
    expect(before.highlights).toContain("act:sr-play");
    expect(before.why).toMatch(/Map|Hangman’s Tree|Hangman's Tree/i);
    expectLegalHighlights(state, before.highlights);

    const choosing = applyInput(state, { type: "selectAction", actionKey: "sr-play" });
    const pick = advise(choosing);
    expect(pick.do).toMatch(/Never Land Map/);
    expect(pick.highlights).toContain(`card:${map.instanceId}`);
    expectLegalHighlights(choosing, pick.highlights);

    const placing = applyInput(choosing, { type: "selectCard", instanceId: map.instanceId });
    const drop = advise(placing);
    expect(drop.do).toMatch(/Never Land Map/);
    expect(drop.do).toMatch(/Skull Rock|Jolly Roger|Mermaid Lagoon|Hangman/);
    expect(drop.highlights.some((h) => h.startsWith("loc:"))).toBe(true);
    expectLegalHighlights(placing, drop.highlights);
  });

  it("walks Peter from an unlocked Hangman’s Tree toward the ship", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    const peter = putHero(state, "peterPan", "hangmansTree");

    const start = advise(state);
    expect(start.do).toMatch(/Move a Hero/);
    expect(start.highlights).toContain("act:ht-moveHero");
    expect(start.why).toMatch(/Peter|Jolly Roger/i);
    expectLegalHighlights(state, start.highlights);

    const picking = applyInput(state, { type: "selectAction", actionKey: "ht-moveHero" });
    const hero = advise(picking);
    expect(hero.do).toMatch(/Peter Pan/);
    expect(hero.highlights).toContain(`card:${peter.instanceId}`);
    expectLegalHighlights(picking, hero.highlights);

    const dest = applyInput(picking, { type: "selectCard", instanceId: peter.instanceId });
    const step = advise(dest);
    expect(step.do).toMatch(/Mermaid Lagoon/);
    expect(step.highlights).toContain("loc:mermaidLagoon");
    expectLegalHighlights(dest, step.highlights);
  });

  it("during move, sends the captain to Hangman’s Tree when Peter is waiting there", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    putHero(state, "peterPan", "hangmansTree");

    const advice = advise(state);
    expect(advice.do).toMatch(/Hangman’s Tree|Hangman's Tree/);
    expect(advice.highlights).toContain("loc:hangmansTree");
    expectLegalHighlights(state, advice.highlights);
  });

  it("warns about Tick Tock and still highlights a safe opening move", () => {
    const state = barePlayState();
    state.phase = "move";
    state.villainLocation = "jollyRoger";
    state.power = 0;
    putHero(state, "tickTock", "skullRock");

    const advice = advise(state);
    expect(advice.highlights).toContain("loc:mermaidLagoon");
    expect(advice.highlights).not.toContain("loc:skullRock");
    expect(advice.warning ?? "").toMatch(/Tick Tock/);
  });

  it("prefers paying Power so the Map stays in the realm", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "resolving";
    state.power = 2;
    const cannon = give(state, "cannon");
    state.pending = { kind: "playChoosePayment", cardId: cannon.instanceId, locationId: "jollyRoger" };

    const advice = advise(state);
    expect(advice.do).toMatch(/Power/);
    expect(advice.highlights).toContain("btn:pay-power");
  });

  it("does not gold-CTA locked Hangman’s Tree as an Aye Aye destination", () => {
    const state = barePlayState();
    state.hangmansUnlocked = false;
    state.phase = "resolving";
    const ally = putAlly(state, "swashbuckler", "mermaidLagoon");
    state.pending = { kind: "ayeAyeDest", allyId: ally.instanceId };

    const advice = advise(state);
    expect(advice.highlights).not.toContain("loc:hangmansTree");
    expect(advice.highlights).toContain("loc:skullRock");
    expectLegalHighlights(state, advice.highlights);
    expect(highlightSet(state).has("loc:hangmansTree")).toBe(false);
  });

  it("recommends the ship clash when Peter is vanquishable at the Jolly Roger", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    putHero(state, "peterPan", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");

    const advice = advise(state);
    expect(advice.do).toMatch(/Vanquish/);
    expect(advice.highlights).toContain("act:jr-vanquish");
    expectLegalHighlights(state, advice.highlights);
  });
});
