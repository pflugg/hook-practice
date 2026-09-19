import { describe, expect, it } from "vitest";
import { def } from "../src/engine/cards";
import { applyInput } from "../src/engine/game";
import { promptText } from "../src/engine/queries";
import { advise } from "../src/engine/coach";
import { strategyBrief } from "../src/engine/strategyBrief";
import { barePlayState, give, inst, putHero } from "./helpers";

const TICK_TEXT = def("tickTock").text;

describe("computer Fate Tick Tock report", () => {
  function afterComputerTickTock() {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("wendy")];
    return applyInput(state, { type: "endTurn" });
  }

  it("seats Tick Tock then keeps a full-text report until Continue", () => {
    const next = afterComputerTickTock();
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.phase).toBe("fateAdversary");
    expect(next.pending.resume).toBe("nextTurn");
    expect(next.pending.played?.defId).toBe("tickTock");
    expect(next.pending.abilityText).toContain(TICK_TEXT);
    expect(next.pending.note).toMatch(/Tick Tock/);
    expect(LOCATION_HAS_TICK(next)).toBe(true);
    expect(next.phase).not.toBe("move");

    const still = applyInput(next, { type: "selectLocation", locationId: "skullRock" });
    expect(still.pending?.kind).toBe("fateReport");
    expect(still.phase).toBe("fateAdversary");
    expect(still.villainLocation).toBe("jollyRoger");

    const cancelled = applyInput(next, { type: "cancel" });
    expect(cancelled.pending?.kind).toBe("fateReport");

    const after = applyInput(next, { type: "acknowledgeFate" });
    expect(after.pending).toBeNull();
    expect(after.phase).toBe("move");
    expect(LOCATION_HAS_TICK(after)).toBe(true);
  });

  it("puts the paraphrased Tick Tock text on the prompt, Coach, and brief", () => {
    const next = afterComputerTickTock();
    expect(promptText(next)).toContain(TICK_TEXT);
    const advice = advise(next);
    expect(advice.do).toMatch(/Continue/);
    expect(advice.highlights).toContain("btn:ack");
    expect(strategyBrief(next).moment).toMatch(/Continue|full paraphrased/i);
  });
});

describe("player Fate Tick Tock report", () => {
  it("requires Continue after seating before returning to actions", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("john")];

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    expect(next.pending?.kind).toBe("fateChooseCard");
    if (next.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const tick = next.pending.cards.find((c) => c.defId === "tickTock")!;

    next = applyInput(next, { type: "selectCard", instanceId: tick.instanceId });
    expect(next.pending?.kind).toBe("fateChooseLocation");
    next = applyInput(next, { type: "selectLocation", locationId: "skullRock" });

    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.resume).toBe("actions");
    expect(next.pending.markAction).toBe(true);
    expect(next.pending.abilityText).toContain(TICK_TEXT);
    expect(next.locations.skullRock.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(next.phase).not.toBe("actions");

    const again = applyInput(next, { type: "selectAction", actionKey: "sr-gain" });
    expect(again.pending?.kind).toBe("fateReport");
    expect(again.power).toBe(next.power);

    const after = applyInput(next, { type: "acknowledgeFate" });
    expect(after.pending).toBeNull();
    expect(after.phase).toBe("actions");
    expect(after.usedActions).toContain("sr-fate");
  });
});

describe("player Fate Peter still reports", () => {
  it("reveals Peter then waits for Continue", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.fateDeck = [inst("peterPan"), inst("wendy")];

    const next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    expect(next.peterPanRevealed).toBe(true);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.abilityText).toContain(def("peterPan").text);
    expect(next.phase).not.toBe("actions");

    const after = applyInput(next, { type: "acknowledgeFate" });
    expect(after.phase).toBe("actions");
    expect(after.usedActions).toContain("sr-fate");
  });
});

describe("Tick Tock step trap", () => {
  it("wipes the hand then keeps the full-text modal until Continue", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "move";
    putHero(state, "tickTock", "skullRock");
    const kept = give(state, "cannon");
    give(state, "smee");

    const next = applyInput(state, { type: "selectLocation", locationId: "skullRock" });
    expect(next.villainLocation).toBe("skullRock");
    expect(next.hand).toHaveLength(0);
    expect(next.villainDiscard.some((c) => c.instanceId === kept.instanceId)).toBe(true);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.abilityText).toContain(TICK_TEXT);
    expect(next.pending.note).toMatch(/snaps/i);
    expect(next.pending.resume).toBe("actions");
    expect(next.pending.markAction).toBeFalsy();
    expect(next.phase).not.toBe("actions");

    const after = applyInput(next, { type: "acknowledgeFate" });
    expect(after.pending).toBeNull();
    expect(after.phase).toBe("actions");
    expect(after.hand).toHaveLength(0);
  });
});

function LOCATION_HAS_TICK(state: ReturnType<typeof barePlayState>): boolean {
  return (["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const).some((id) =>
    state.locations[id].heroes.some((h) => h.defId === "tickTock"),
  );
}
