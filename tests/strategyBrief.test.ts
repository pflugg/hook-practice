import { describe, expect, it } from "vitest";
import { createGame } from "../src/engine/game";
import { strategyBrief } from "../src/engine/strategyBrief";
import { barePlayState, putAlly, putHero } from "./helpers";

describe("strategy brief", () => {
  it("teaches the early-game Map-and-Power problem on the opening move", () => {
    const opening = createGame("normal", 11);
    const brief = strategyBrief(opening);

    const map = brief.objective.find((o) => o.key === "map")!;
    const peter = brief.objective.find((o) => o.key === "peter")!;
    expect(map.done).toBe(false);
    expect(map.status).toMatch(/locked|Map|Hangman’s Tree|Hangman's Tree/i);
    expect(peter.done).toBe(false);
    expect(peter.status).toMatch(/hidden|Fate/i);

    expect(brief.where).toMatch(/Jolly Roger/);
    expect(brief.where).toMatch(/Power/);
    expect(brief.where).toMatch(/locked/i);

    expect(brief.moment).toMatch(/required move/i);
    expect(brief.moment).toMatch(/cannot stay put|leave/i);

    expect(brief.setup).toMatch(/Power|dig|Map/i);
    expect(brief.setup.length).toBeGreaterThan(180);
    expect(brief.moment.length).toBeGreaterThan(160);
  });

  it("explains the escort once the tree is open and Peter is at Hangman’s Tree", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    state.power = 3;
    putHero(state, "peterPan", "hangmansTree");

    const brief = strategyBrief(state);
    expect(brief.objective.find((o) => o.key === "map")!.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "peter")!.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "walk")!.done).toBe(false);

    expect(brief.where).toMatch(/Hangman/);
    expect(brief.where).toMatch(/unlocked/i);
    expect(brief.moment).toMatch(/action/i);
    expect(brief.setup).toMatch(/escort|walk|Move a Hero/i);
    expect(brief.setup).toMatch(/Jolly Roger/);
    expect(brief.setup).toMatch(/vanquish/i);
    expect(brief.objective.find((o) => o.key === "walk")!.status).toMatch(/step/);
  });

  it("says the ship clash is ready when Peter can be vanquished at the Jolly Roger", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    putHero(state, "peterPan", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");

    const brief = strategyBrief(state);
    expect(brief.objective.find((o) => o.key === "walk")!.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "clash")!.done).toBe(true);
    expect(brief.objective.find((o) => o.key === "clash")!.status).toMatch(/Ready|Vanquish/i);
    expect(brief.where).toMatch(/Jolly Roger/);
    expect(brief.setup).toMatch(/last gate|Vanquish|win/i);
    expect(brief.moment).toMatch(/action stretch|Vanquish/i);
  });
});
