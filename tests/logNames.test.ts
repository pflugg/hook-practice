import { describe, expect, it } from "vitest";
import { LOCATION_IDS } from "../src/engine/types";
import { locName } from "../src/engine/realm";
import { applyInput } from "../src/engine/game";
import { barePlayState, putAlly, putHero } from "./helpers";

describe("player-facing log place names", () => {
  it("uses one helper that never returns a raw location id", () => {
    for (const id of LOCATION_IDS) {
      const name = locName(id);
      expect(name).not.toBe(id);
      expect(name).not.toMatch(/jollyRoger|skullRock|mermaidLagoon|hangmansTree/);
      expect(name.length).toBeGreaterThan(4);
    }
    expect(locName("jollyRoger")).toBe("Jolly Roger");
  });

  it("logs a human place name after a local vanquish", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const tinker = putHero(state, "tinkerBell", "jollyRoger");
    const party = putAlly(state, "boardingParty", "jollyRoger");

    let next = applyInput(state, { type: "selectAction", actionKey: "jr-vanquish" });
    next = applyInput(next, { type: "selectCard", instanceId: tinker.instanceId });
    next = applyInput(next, { type: "selectCard", instanceId: party.instanceId });
    next = applyInput(next, { type: "confirm" });

    const line = next.log.find((e) => /vanquished/.test(e.text));
    expect(line?.text).toMatch(/Tinker Bell is vanquished at Jolly Roger/);
    expect(next.log.some((e) => /jollyRoger/.test(e.text))).toBe(false);
  });

  it("logs a human place name when the captain moves", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "move";
    const next = applyInput(state, { type: "selectLocation", locationId: "skullRock" });
    expect(next.log.some((e) => /arrives at Skull Rock/.test(e.text))).toBe(true);
    expect(next.log.some((e) => /skullRock/.test(e.text))).toBe(false);
  });
});
