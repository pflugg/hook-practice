import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { endgameRecap } from "../src/engine/recap";
import { RIVAL_FATE_PUSH, RIVAL_GOAL, RIVAL_LOSE_REASON, RIVAL_STEP } from "../src/engine/rival";
import { renderPlay } from "../src/ui/app";
import { barePlayState, inst, putAlly, putHero } from "./helpers";
import type { GameState } from "../src/engine/types";

function acknowledge(state: GameState): GameState {
  if (state.pending?.kind === "fateReport") return applyInput(state, { type: "acknowledgeFate" });
  return state;
}

function endComputerTurn(state: GameState): GameState {
  return acknowledge(applyInput(state, { type: "endTurn" }));
}

function quietFate(state: GameState): void {
  state.fateDeck = [];
  state.fateDiscard = [];
}

describe("rival villain clock", () => {
  it("advances one Easy step when the turn ends and Fate has no cards", () => {
    const state = barePlayState();
    state.difficulty = "easy";
    quietFate(state);
    const next = endComputerTurn(state);
    expect(next.rivalProgress).toBe(RIVAL_STEP.easy);
    expect(next.lost).toBe(false);
    expect(next.won).toBe(false);
    expect(next.phase).toBe("move");
    expect(next.turn).toBe(state.turn + 1);
    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("data-rival-meter");
    expect(html).toContain(`${RIVAL_STEP.easy} / ${RIVAL_GOAL}`);
  });

  it("advances Normal more slowly while the Coach is on and keeps the game pace while it is off", () => {
    const off = barePlayState();
    off.difficulty = "normal";
    off.coachOn = false;
    quietFate(off);
    const on = barePlayState();
    on.difficulty = "normal";
    on.coachOn = true;
    quietFate(on);

    const offNext = endComputerTurn(off);
    const onNext = endComputerTurn(on);
    expect(offNext.rivalProgress).toBe(2);
    expect(onNext.rivalProgress).toBe(1);
    expect(onNext.lost).toBe(false);

    off.rivalProgress = 152;
    on.rivalProgress = 152;
    const offLate = endComputerTurn(off);
    const onLate = endComputerTurn(on);
    expect(offLate.lost).toBe(true);
    expect(offLate.rivalProgress).toBe(154);
    expect(offLate.loseReason).toBe(RIVAL_LOSE_REASON);
    expect(onLate.lost).toBe(false);
    expect(onLate.rivalProgress).toBe(153);
    const html = renderPlay(onLate, { coachEnabled: true, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("153 / 222");

    on.rivalProgress = 221;
    const onEdge = endComputerTurn(on);
    expect(onEdge.lost).toBe(true);
    expect(onEdge.rivalProgress).toBe(222);
    expect(onEdge.loseReason).toBe(RIVAL_LOSE_REASON);
  });

  it("advances farther on Normal than on Easy", () => {
    const easy = barePlayState();
    easy.difficulty = "easy";
    quietFate(easy);
    const normal = barePlayState();
    normal.difficulty = "normal";
    quietFate(normal);
    expect(endComputerTurn(easy).rivalProgress).toBe(RIVAL_STEP.easy);
    expect(endComputerTurn(normal).rivalProgress).toBe(RIVAL_STEP.normal);
    expect(RIVAL_STEP.normal).toBeGreaterThan(RIVAL_STEP.easy);
  });

  it("adds the Taunt push when the computer plays Taunt, and not when it seats Wendy", () => {
    const taunted = barePlayState();
    taunted.difficulty = "easy";
    const hero = putHero(taunted, "john", "skullRock");
    taunted.fateDeck = [inst("taunt")];
    taunted.fateDiscard = [];
    const afterTaunt = endComputerTurn(taunted);
    expect(afterTaunt.rivalProgress).toBe(RIVAL_STEP.easy + RIVAL_FATE_PUSH.taunt);
    expect(afterTaunt.attachments.some((row) => row.attachedTo === hero.instanceId && row.item.defId === "taunt")).toBe(
      true,
    );

    const seated = barePlayState();
    seated.difficulty = "easy";
    seated.fateDeck = [inst("wendy")];
    seated.fateDiscard = [];
    const afterWendy = endComputerTurn(seated);
    expect(afterWendy.rivalProgress).toBe(RIVAL_STEP.easy);
    expect(afterWendy.locations.skullRock.heroes.some((card) => card.defId === "wendy") ||
      afterWendy.locations.mermaidLagoon.heroes.some((card) => card.defId === "wendy") ||
      afterWendy.locations.jollyRoger.heroes.some((card) => card.defId === "wendy") ||
      afterWendy.locations.hangmansTree.heroes.some((card) => card.defId === "wendy")).toBe(true);
  });

  it("does not advance when Hook plays Taunt, then advances only the difficulty step on the later end turn", () => {
    const state = barePlayState();
    state.difficulty = "easy";
    state.villainLocation = "skullRock";
    state.phase = "actions";
    const hero = putHero(state, "john", "skullRock");
    state.fateDeck = [inst("taunt")];
    state.fateDiscard = [];

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    expect(next.pending?.kind).toBe("fateChooseCard");
    const drawn = next.pending?.kind === "fateChooseCard" ? next.pending.cards[0] : undefined;
    if (!drawn) throw new Error("missing taunt");
    next = applyInput(next, { type: "selectCard", instanceId: drawn.instanceId });
    expect(next.pending?.kind).toBe("fateChooseAttach");
    next = applyInput(next, { type: "selectCard", instanceId: hero.instanceId });
    next = acknowledge(next);
    expect(next.rivalProgress).toBe(0);
    expect(next.attachments.some((row) => row.item.defId === "taunt")).toBe(true);
    expect(next.turn).toBe(state.turn);

    next = endComputerTurn(next);
    expect(next.rivalProgress).toBe(RIVAL_STEP.easy);
    expect(next.lost).toBe(false);
  });

  it("loses when the rival reaches the goal, and the loss screen says why", () => {
    const state = barePlayState();
    state.difficulty = "normal";
    quietFate(state);
    state.rivalProgress = RIVAL_GOAL - 1;
    const next = endComputerTurn(state);
    expect(next.lost).toBe(true);
    expect(next.won).toBe(false);
    expect(next.phase).toBe("over");
    expect(next.turn).toBe(state.turn);
    expect(next.rivalProgress).toBe(RIVAL_GOAL);
    expect(next.loseReason).toBe(RIVAL_LOSE_REASON);

    const recap = endgameRecap(next);
    expect(recap.headline).toBe("The rival finishes first");
    expect(recap.lead).toBe(RIVAL_LOSE_REASON);

    const html = renderPlay(next, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(html).toContain("data-recap");
    expect(html).toContain("data-rival-meter");
    expect(html).toContain("The rival finishes first");
    expect(html).toContain(RIVAL_LOSE_REASON);
    expect(html).toContain(`${RIVAL_GOAL} / ${RIVAL_GOAL}`);
  });

  it("still wins a legal ship clash when the rival is one step from the goal", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.rivalProgress = RIVAL_GOAL - 1;
    const peter = putHero(state, "peterPan", "jollyRoger");
    const brute = putAlly(state, "pirateBrute", "jollyRoger");
    const brute2 = putAlly(state, "pirateBrute", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: peter.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: brute2.instanceId });
    next = applyInput(next, { type: "confirm" });

    expect(next.won).toBe(true);
    expect(next.lost).toBe(false);
    expect(next.phase).toBe("over");
    expect(next.rivalProgress).toBe(RIVAL_GOAL - 1);
    expect(endgameRecap(next).headline).toBe("The ship is yours");
  });
});
