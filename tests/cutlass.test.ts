/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { applyInput, highlightSet } from "../src/engine/game";
import { resolveBoardClick } from "../src/ui/clicks";
import { barePlayState, give, putAlly } from "./helpers";

function startCutlassAttach() {
  const state = barePlayState();
  state.villainLocation = "jollyRoger";
  state.phase = "actions";
  state.power = 1;
  const cutlass = give(state, "cutlass");
  const ally = putAlly(state, "swashbuckler", "skullRock");
  let next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
  expect(next.pending?.kind).toBe("playChooseCard");
  next = applyInput(next, { type: "selectCard", instanceId: cutlass.instanceId });
  expect(next.pending?.kind).toBe("playChooseAllyAttach");
  return { next, cutlass, ally };
}

describe("Cutlass attach", () => {
  it("straps Cutlass to an Ally at a different location via selectCard", () => {
    const { next, cutlass, ally } = startCutlassAttach();
    expect(next.villainLocation).toBe("jollyRoger");
    expect(next.locations.skullRock.allies.some((c) => c.instanceId === ally.instanceId)).toBe(true);

    let done = applyInput(next, { type: "selectCard", instanceId: ally.instanceId });
    expect(done.pending?.kind).toBe("playChoosePayment");
    done = applyInput(done, { type: "payWithPower" });
    expect(done.attachments.some((a) => a.item.defId === "cutlass" && a.attachedTo === ally.instanceId)).toBe(true);
    expect(done.power).toBe(0);
    expect(done.pending).toBeNull();
    expect(done.phase).toBe("actions");
    expect(done.hand.some((c) => c.instanceId === cutlass.instanceId)).toBe(false);
    expect(done.usedActions).toContain("jr-play");
  });

  it("resolveBoardClick on a highlighted Ally card selects that Ally", () => {
    const { next, ally } = startCutlassAttach();
    expect(highlightSet(next).has(`card:${ally.instanceId}`)).toBe(true);

    const root = document.createElement("div");
    root.innerHTML = `
      <section class="location" data-loc="skullRock">
        <button class="action" data-act="sr-gain" disabled>Gain 1</button>
        <button class="card is-legal" data-card="${ally.instanceId}">Swashbuckler</button>
      </section>
    `;
    const card = root.querySelector<HTMLButtonElement>("[data-card]")!;
    const input = resolveBoardClick(card, next);
    expect(input).toEqual({ type: "selectCard", instanceId: ally.instanceId });

    let done = applyInput(next, input!);
    expect(done.pending?.kind).toBe("playChoosePayment");
    done = applyInput(done, { type: "payWithPower" });
    expect(done.attachments.some((a) => a.attachedTo === ally.instanceId && a.item.defId === "cutlass")).toBe(true);
  });

  it("cancel from attach returns to playChooseCard, then to actions", () => {
    const { next, cutlass } = startCutlassAttach();
    const back = applyInput(next, { type: "cancel" });
    expect(back.pending?.kind).toBe("playChooseCard");
    expect(back.phase).toBe("resolving");
    expect(back.hand.some((c) => c.instanceId === cutlass.instanceId)).toBe(true);
    expect(back.power).toBe(1);

    const cleared = applyInput(back, { type: "cancel" });
    expect(cleared.pending).toBeNull();
    expect(cleared.phase).toBe("actions");
    expect(cleared.usedActions).not.toContain("jr-play");
  });

  it("cancel from playChooseLocation returns to playChooseCard", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 2;
    const smee = give(state, "smee");
    let next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    next = applyInput(next, { type: "selectCard", instanceId: smee.instanceId });
    expect(next.pending?.kind).toBe("playChooseLocation");
    next = applyInput(next, { type: "cancel" });
    expect(next.pending?.kind).toBe("playChooseCard");
    expect(next.hand.some((c) => c.instanceId === smee.instanceId)).toBe(true);
  });

  it("does not enter attach pending when no Ally is ashore", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 1;
    give(state, "worthyOpponent");
    const cutlass = give(state, "cutlass");
    let next = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    expect(next.pending?.kind).toBe("playChooseCard");
    next = applyInput(next, { type: "selectCard", instanceId: cutlass.instanceId });
    expect(next.pending?.kind).toBe("playChooseCard");
    expect(next.hand.some((c) => c.instanceId === cutlass.instanceId)).toBe(true);
  });
});
