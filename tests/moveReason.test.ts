import { describe, expect, it } from "vitest";
import { applyInput, createGame } from "../src/engine/game";
import { explainSelection, liveMoveReason } from "../src/engine/moveReason";
import { barePlayState, give, inst, putHero, putItem } from "./helpers";

describe("move reasons after selection", () => {
  it("explains a legal opening move to Mermaid Lagoon", () => {
    const before = createGame("normal", 7);
    expect(before.phase).toBe("move");
    const after = applyInput(before, { type: "selectLocation", locationId: "mermaidLagoon" });
    const reason = explainSelection(before, { type: "selectLocation", locationId: "mermaidLagoon" }, after);
    expect(reason).not.toBeNull();
    expect(reason!.soft).toBeFalsy();
    expect(reason!.chose).toMatch(/Mermaid Lagoon/);
    expect(reason!.why).toMatch(/Power|Never Land Map|Hangman’s Tree|Hangman's Tree/i);
    expect(reason!.why.length).toBeGreaterThan(120);
    expect(reason!.next).toMatch(/Fate|Tick Tock|action/i);
  });

  it("explains playing the Never Land Map as the unlock", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 4;
    const map = give(state, "neverLandMap");

    let mid = applyInput(state, { type: "selectAction", actionKey: "sr-play" });
    const opened = explainSelection(state, { type: "selectAction", actionKey: "sr-play" }, mid);
    expect(opened?.chose).toMatch(/Play a Card/);
    expect(opened?.why).toMatch(/Map|Ally|hunt/i);

    mid = applyInput(mid, { type: "selectCard", instanceId: map.instanceId });
    const picked = explainSelection(
      applyInput(state, { type: "selectAction", actionKey: "sr-play" }),
      { type: "selectCard", instanceId: map.instanceId },
      mid,
    );
    expect(picked?.chose).toMatch(/Never Land Map/);
    expect(picked?.why).toMatch(/unlock|Hangman’s Tree|Hangman's Tree/i);

    const paying = applyInput(mid, { type: "selectLocation", locationId: "jollyRoger" });
    expect(paying.pending?.kind).toBe("playChoosePayment");
    const chosePlace = explainSelection(mid, { type: "selectLocation", locationId: "jollyRoger" }, paying);
    expect(chosePlace?.chose).toMatch(/Never Land Map/);
    expect(chosePlace?.why).toMatch(/cost|Power/i);

    const placed = applyInput(paying, { type: "payWithPower" });
    const reason = explainSelection(paying, { type: "payWithPower" }, placed);
    expect(reason?.chose).toMatch(/Power/);
    expect(placed.hangmansUnlocked).toBe(true);
  });

  it("softens the panel when a Play choice is cancelled", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.power = 2;
    give(state, "smee");

    const choosing = applyInput(state, { type: "selectAction", actionKey: "jr-play" });
    const cancelled = applyInput(choosing, { type: "cancel" });
    const reason = explainSelection(choosing, { type: "cancel" }, cancelled);
    expect(reason?.soft).toBe(true);
    expect(reason?.chose).toMatch(/cancelled/i);
    expect(reason?.why).toMatch(/Jolly Roger|chain|Map/i);
    expect(cancelled.phase).toBe("actions");
  });

  it("explains a computer Fate Tick Tock seat when Continue is pressed", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("wendy")];

    const report = applyInput(state, { type: "endTurn" });
    expect(report.pending?.kind).toBe("fateReport");
    const ended = explainSelection(state, { type: "endTurn" }, report);
    expect(ended?.chose).toMatch(/ended the turn/i);
    expect(ended?.next).toMatch(/Tick Tock/);

    const after = applyInput(report, { type: "acknowledgeFate" });
    const reason = explainSelection(report, { type: "acknowledgeFate" }, after);
    expect(reason?.soft).toBeFalsy();
    expect(reason?.chose).toMatch(/Tick Tock/);
    expect(reason?.why).toMatch(/discard|hand|crocodile/i);
    expect(reason?.why).toMatch(/If the captain moves to this Hero's place/);
    expect(reason?.next).toMatch(/berth|Vanquish|hand/i);
  });

  it("explains Gain 3 as Power for the Map", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 0;
    const after = applyInput(state, { type: "selectAction", actionKey: "ml-gain" });
    const reason = explainSelection(state, { type: "selectAction", actionKey: "ml-gain" }, after);
    expect(reason?.chose).toMatch(/Gain 3/);
    expect(reason?.why).toMatch(/Power|Map/i);
    expect(after.power).toBe(3);
  });
});

describe("idle vs coach/brief roles", () => {
  it("does not credit Gain or Vanquish when applyInput only cleared a banner", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 2;
    state.bannerNote = "A leftover prompt.";
    const after = applyInput(state, { type: "selectAction", actionKey: "ml-gain" });
    expect(after.power).toBe(5);
    expect(explainSelection(state, { type: "selectAction", actionKey: "ml-gain" }, after)?.chose).toMatch(/Gain 3/);

    const moving = barePlayState();
    moving.villainLocation = "mermaidLagoon";
    moving.phase = "move";
    moving.power = 2;
    moving.bannerNote = "Move the captain to a different unlocked location.";
    const ignored = applyInput(moving, { type: "selectAction", actionKey: "ml-gain" });
    expect(ignored.power).toBe(2);
    expect(ignored.phase).toBe("move");
    expect(explainSelection(moving, { type: "selectAction", actionKey: "ml-gain" }, ignored)).toBeNull();
  });

  it("does not treat a no-op location click as a new reason", () => {
    const state = barePlayState();
    state.phase = "actions";
    state.villainLocation = "jollyRoger";
    const after = applyInput(state, { type: "selectLocation", locationId: "skullRock" });
    expect(after.villainLocation).toBe("jollyRoger");
    expect(explainSelection(state, { type: "selectLocation", locationId: "skullRock" }, after)).toBeNull();
  });

  it("teaches Hook's Case as extra Gain 1, not discard or Play", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.power = 2;
    const pack = give(state, "hooksCase");

    const choosing = applyInput(state, { type: "selectAction", actionKey: "sr-play" });
    const picked = applyInput(choosing, { type: "selectCard", instanceId: pack.instanceId });
    const reason = explainSelection(choosing, { type: "selectCard", instanceId: pack.instanceId }, picked);
    expect(reason?.chose).toMatch(/Hook's Case/);
    expect(reason?.why).toMatch(/Gain 1/i);
    expect(reason?.why).not.toMatch(/discard and play/i);
    expect(reason?.next).toMatch(/Gain 1/);
  });

  it("says Scare discards to the Fate pile rather than banishing forever", () => {
    const state = barePlayState();
    state.phase = "resolving";
    const a = inst("tickTock");
    const b = inst("splittingHeadache");
    state.pending = { kind: "scarePeek", cards: [a, b] };
    const after = applyInput(state, { type: "scareDiscardBoth" });
    const reason = explainSelection(state, { type: "scareDiscardBoth" }, after);
    expect(reason?.chose).toMatch(/discarded both/i);
    expect(reason?.why).toMatch(/Fate discard/);
    expect(reason?.why).not.toMatch(/banish/i);
    expect(after.fateDiscard.map((c) => c.defId)).toEqual(expect.arrayContaining(["tickTock", "splittingHeadache"]));
  });

  it("keeps Why this move click-by-click while a Play selection is active", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 2;
    const party = give(state, "boardingParty");

    const choosing = applyInput(state, { type: "selectAction", actionKey: "ml-play1" });
    const opened = explainSelection(state, { type: "selectAction", actionKey: "ml-play1" }, choosing);
    const liveOpen = liveMoveReason(choosing, opened);
    expect(liveOpen.chose).toMatch(/Play a Card/);
    expect(liveOpen.why.length).toBeGreaterThan(80);
    expect(`${liveOpen.why} ${liveOpen.next}`).toMatch(/click|Choose this place|hand/i);

    const placing = applyInput(choosing, { type: "selectCard", instanceId: party.instanceId });
    const picked = explainSelection(choosing, { type: "selectCard", instanceId: party.instanceId }, placing);
    const livePick = liveMoveReason(placing, picked);
    expect(livePick.chose).toMatch(/Boarding Party/);
    expect(livePick.why.length).toBeGreaterThan(80);
    expect(`${livePick.why} ${livePick.next}`).toMatch(/Jolly Roger|Choose this place|click/i);
  });

  it("drops Worthy Opponent card-pick copy once the action stretch is current", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 4;
    state.hangmansUnlocked = true;
    putHero(state, "peterPan", "skullRock");
    putHero(state, "michael", "mermaidLagoon");
    putItem(state, "hooksCase", "mermaidLagoon");

    const stale = {
      chose: "You chose Worthy Opponent from hand.",
      why: "Worthy Opponent is a hunt: +2 Power and you reveal Fate cards until a Hero appears. That is how you find Peter without waiting for a Fate action or the computer’s turn.",
      next: "If the Hero is Peter, he still lands at Hangman’s Tree. If it is Tick Tock, park him off the lagoon and the tree.",
    };
    const live = liveMoveReason(state, stale);
    expect(live.chose).not.toMatch(/Worthy Opponent/);
    expect(live.why).not.toMatch(/Worthy Opponent is a hunt/i);
    expect(live.chose).toMatch(/action stretch|Mermaid Lagoon/i);
    expect(live.why).toMatch(/available actions|Gain|End/i);
  });

  it("rewrites a Worthy Opponent pick that already resolved into seating or the action stretch", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.power = 2;
    const worthy = give(state, "worthyOpponent");
    state.fateDeck = [inst("wendy"), inst("john")];

    const choosing = applyInput(state, { type: "selectAction", actionKey: "ml-play2" });
    const afterPick = applyInput(choosing, { type: "selectCard", instanceId: worthy.instanceId });
    const pickReason = explainSelection(choosing, { type: "selectCard", instanceId: worthy.instanceId }, afterPick);
    const live = liveMoveReason(afterPick, pickReason);

    expect(live.chose).not.toMatch(/from hand/i);
    if (afterPick.pending?.kind === "worthyLocation") {
      expect(live.chose).toMatch(/Worthy Opponent found|Wendy/i);
      const seated = applyInput(afterPick, { type: "selectLocation", locationId: "jollyRoger" });
      const seatReason = explainSelection(afterPick, { type: "selectLocation", locationId: "jollyRoger" }, seated);
      const afterSeat = seated.pending?.kind === "fateReport" ? applyInput(seated, { type: "acknowledgeFate" }) : seated;
      const last =
        seated.pending?.kind === "fateReport"
          ? explainSelection(seated, { type: "acknowledgeFate" }, afterSeat)
          : seatReason;
      const actionLive = liveMoveReason(afterSeat, last);
      expect(afterSeat.phase).toBe("actions");
      expect(actionLive.chose).not.toMatch(/from hand/i);
      expect(actionLive.why).not.toMatch(/Worthy Opponent is a hunt/i);
    } else {
      expect(afterPick.phase).toBe("actions");
      expect(live.chose).toMatch(/played Worthy Opponent|action stretch/i);
    }
  });

  it("names Peter on the tree as a helpful Fate find", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    putHero(state, "tickTock", "jollyRoger");
    state.fateDeck = [inst("peterPan"), inst("john")];
    const report = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    expect(report.pending?.kind).toBe("fateReport");
    const after = applyInput(report, { type: "acknowledgeFate" });
    const reason = explainSelection(report, { type: "acknowledgeFate" }, after);
    expect(reason?.chose).toMatch(/Peter Pan/);
    expect(reason?.why).toMatch(/Hangman’s Tree|Hangman's Tree|chain|not a setback/i);
  });
});
