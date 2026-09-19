import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { dropTargets, inputsForDrop, isDraggableCard } from "../src/ui/drag";
import { barePlayState, give, putAlly, putHero } from "./helpers";

describe("card drag targets", () => {
  it("lets a hand Ally slide onto an unlocked location during Play a Card", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 2;
    const smee = give(state, "smee");
    const choosing = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    expect(isDraggableCard(choosing, smee.instanceId)).toBe(true);
    const targets = dropTargets(choosing, smee.instanceId);
    expect(targets.locations).toContain("jollyRoger");
    expect(targets.locations).toContain("skullRock");
    expect(targets.locations).not.toContain("hangmansTree");

    const inputs = inputsForDrop(choosing, smee.instanceId, { locationId: "jollyRoger" });
    expect(inputs).toEqual([
      { type: "selectCard", instanceId: smee.instanceId },
      { type: "selectLocation", locationId: "jollyRoger" },
    ]);
    let next = choosing;
    for (const input of inputs) next = applyInput(next, input);
    expect(next.pending?.kind).toBe("playChoosePayment");
    next = applyInput(next, { type: "payWithPower" });
    expect(next.locations.jollyRoger.allies.some((c) => c.instanceId === smee.instanceId)).toBe(true);
  });

  it("lets a Hero slide to an adjacent unlocked place", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "hangmansTree";
    state.phase = "actions";
    const wendy = putHero(state, "wendy", "hangmansTree");
    const picking = applyInput(state, { type: "selectAction", actionKey: "ht-moveHero" });
    expect(isDraggableCard(picking, wendy.instanceId)).toBe(true);
    expect(dropTargets(picking, wendy.instanceId).locations).toEqual(["mermaidLagoon"]);

    const inputs = inputsForDrop(picking, wendy.instanceId, { locationId: "mermaidLagoon" });
    let next = picking;
    for (const input of inputs) next = applyInput(next, input);
    expect(next.locations.mermaidLagoon.heroes.some((c) => c.instanceId === wendy.instanceId)).toBe(true);
    expect(next.pending).toBeNull();
  });

  it("rejects a drop outside the legal set", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 2;
    const smee = give(state, "smee");
    const picking = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    expect(inputsForDrop(picking, smee.instanceId, { locationId: "hangmansTree" })).toEqual([]);
  });

  it("straps the Cutlass by dropping onto an Ally", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 1;
    const cutlass = give(state, "cutlass");
    const ally = putAlly(state, "swashbuckler", "skullRock");
    const choosing = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    expect(dropTargets(choosing, cutlass.instanceId).cards).toContain(ally.instanceId);
    const inputs = inputsForDrop(choosing, cutlass.instanceId, { cardId: ally.instanceId });
    let next = choosing;
    for (const input of inputs) next = applyInput(next, input);
    expect(next.pending?.kind).toBe("playChoosePayment");
    next = applyInput(next, { type: "payWithPower" });
    expect(next.attachments.some((a) => a.item.defId === "cutlass" && a.attachedTo === ally.instanceId)).toBe(true);
  });
});
