import { describe, expect, it } from "vitest";
import { applyInput, createGame } from "../src/engine/game";
import { legalMoveLocations } from "../src/engine/queries";

describe("a dealt voyage", () => {
  it("starts at the Jolly Roger and makes the captain move before any action", () => {
    const dealt = createGame("normal", 11);
    expect(dealt.phase).toBe("move");
    expect(dealt.villainLocation).toBe("jollyRoger");
    expect(dealt.power).toBe(0);
    expect(dealt.turn).toBe(1);
    expect(dealt.hand).toHaveLength(4);
    expect(dealt.hangmansUnlocked).toBe(false);
    expect([...legalMoveLocations(dealt)].sort()).toEqual(["mermaidLagoon", "skullRock"]);

    const stayed = applyInput(dealt, { type: "endTurn" });
    expect(stayed.phase).toBe("move");
    expect(stayed.turn).toBe(1);
    expect(stayed.pending).toBeNull();
    const acted = applyInput(dealt, { type: "selectAction", actionKey: "jr-gain" });
    expect(acted.phase).toBe("move");
    expect(acted.power).toBe(0);
    expect(acted.villainLocation).toBe("jollyRoger");
  });

  it("lets the computer Fate the captain after the turn ends", () => {
    const dealt = createGame("normal", 11);
    const moved = applyInput(dealt, { type: "selectLocation", locationId: "skullRock" });
    expect(moved.phase).toBe("actions");
    expect(moved.villainLocation).toBe("skullRock");

    const fated = applyInput(moved, { type: "endTurn" });
    expect(fated.hand).toHaveLength(4);
    expect(fated.pending?.kind).toBe("fateReport");
    if (fated.pending?.kind !== "fateReport") throw new Error("expected a Fate report");
    expect(fated.pending.drawn.length).toBeGreaterThan(0);
    expect(fated.pending.note.length).toBeGreaterThan(0);
    const played = fated.pending.played;
    expect(played, "the computer played one of the drawn Fate cards").toBeTruthy();
    if (played) {
      const seated = (["jollyRoger", "skullRock", "mermaidLagoon", "hangmansTree"] as const).some((id) =>
        fated.locations[id].heroes.some((card) => card.instanceId === played.instanceId),
      );
      const attached = fated.attachments.some((row) => row.item.instanceId === played.instanceId);
      const dropped = fated.fateDiscard.some((card) => card.instanceId === played.instanceId);
      expect(seated || attached || dropped).toBe(true);
    }

    const next = applyInput(fated, { type: "acknowledgeFate" });
    expect(next.pending).toBeNull();
    expect(next.phase).toBe("move");
    expect(next.turn).toBe(2);
    expect(next.won).toBe(false);
    expect(next.lost).toBe(false);
    expect([...legalMoveLocations(next)].sort()).toEqual(["jollyRoger", "mermaidLagoon"]);
  });
});
