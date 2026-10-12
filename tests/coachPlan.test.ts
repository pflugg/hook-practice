import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { coachPlan } from "../src/engine/coachPlan";
import { nearWinScene } from "../src/engine/scenes";
import { barePlayState, attachTo, give, putAlly, putHero } from "./helpers";

describe("coach plan", () => {
  it("keeps the Hideout current while the Map is the key in hand", () => {
    const state = barePlayState();
    state.phase = "move";
    state.hangmansUnlocked = false;
    give(state, "neverLandMap");
    const advice = advise(state);
    const plan = coachPlan(state, advice);
    expect(plan.stages.find((stage) => stage.id === "hideout")?.mark).toBe("now");
    expect(plan.lines[0]).toBe(advice.why);
    expect(plan.lines.join(" ")).toMatch(/Never Land Map/);
    expect(plan.lines.join(" ")).toMatch(/Hangman’s Tree/);
  });

  it("counts the shores between Peter and the ship", () => {
    const state = nearWinScene();
    state.coachOn = true;
    const advice = advise(state);
    const plan = coachPlan(state, advice);
    expect(plan.stages.find((stage) => stage.id === "ship")?.mark).toBe("now");
    expect(plan.lines.join(" ")).toMatch(/Skull Rock/);
    expect(plan.lines.join(" ")).toMatch(/1 shore from the Jolly Roger/);
    expect(plan.lines[0]).toBe(advice.why);
  });

  it("names a Taunt that blocks the clash order", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "actions";
    const john = putHero(state, "john", "mermaidLagoon");
    attachTo(state, "taunt", john.instanceId);
    putHero(state, "peterPan", "skullRock");
    const plan = coachPlan(state, advise(state));
    expect(plan.lines.join(" ")).toMatch(/Taunt is on John at Mermaid Lagoon/);
    expect(plan.lines.length).toBeLessThanOrEqual(3);
  });

  it("calls out the rival warning band with the live totals", () => {
    const state = barePlayState();
    state.coachOn = false;
    state.difficulty = "easy";
    state.rivalProgress = 60;
    state.hangmansUnlocked = true;
    putAlly(state, "pirateBrute", "jollyRoger");
    const plan = coachPlan(state, advise(state));
    expect(plan.lines.join(" ")).toMatch(/warning band at 60 \/ 74/);
  });

  it("says the ship crew is short when Peter is aboard", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "actions";
    state.villainLocation = "jollyRoger";
    putHero(state, "peterPan", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    const plan = coachPlan(state, advise(state));
    expect(plan.stages.find((stage) => stage.id === "ship")?.mark).toBe("done");
    expect(plan.stages.find((stage) => stage.id === "clash")?.mark).toBe("now");
    expect(plan.lines.join(" ")).toMatch(/Peter is aboard/);
    expect(plan.lines.join(" ")).toMatch(/4 against his 8/);
  });

  it("says the clash can finish when the ship crew meets Peter", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.phase = "actions";
    state.villainLocation = "jollyRoger";
    putHero(state, "peterPan", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    putAlly(state, "pirateBrute", "jollyRoger");
    const plan = coachPlan(state, advise(state));
    expect(plan.lines.join(" ")).toMatch(/can meet his Strength \(8\)/);
    expect(plan.lines.join(" ")).toMatch(/Vanquish him on the Jolly Roger/);
  });
});
