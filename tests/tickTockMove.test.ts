import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput } from "../src/engine/game";
import { explainSelection } from "../src/engine/moveReason";
import { tickTockOntoCaptainScene } from "../src/engine/scenes";
import { renderOverlay, renderPlay } from "../src/ui/app";
import { barePlayState, give, inst, putAlly, putHero, putItem } from "./helpers";

describe("Tick Tock snaps when the crocodile is moved onto the captain", () => {
  it("wipes the hand after Move a Hero slides Tick Tock onto the captain", () => {
    const state = barePlayState();
    state.hangmansUnlocked = true;
    state.villainLocation = "jollyRoger";
    state.phase = "actions";
    const tick = putHero(state, "tickTock", "skullRock");
    const device = putItem(state, "ingeniousDevice", "jollyRoger");
    const map = give(state, "neverLandMap");
    give(state, "smee");

    let next = applyInput(state, { type: "selectAction", actionKey: `extra:${device.instanceId}` });
    next = applyInput(next, { type: "selectCard", instanceId: tick.instanceId });
    const beforeSnap = next;
    next = applyInput(next, { type: "selectLocation", locationId: "jollyRoger" });

    expect(next.locations.jollyRoger.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(next.hand).toHaveLength(0);
    expect(next.villainDiscard.some((c) => c.instanceId === map.instanceId)).toBe(true);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.note).toMatch(/snaps/i);
    expect(next.pending.note).toMatch(/sharing this place/i);
    expect(next.log.some((e) => /jollyRoger|skullRock/.test(e.text))).toBe(false);
    expect(next.log.some((e) => /Tick Tock is moved to Jolly Roger/.test(e.text))).toBe(true);

    const reason = explainSelection(beforeSnap, { type: "selectLocation", locationId: "jollyRoger" }, next);
    expect(reason?.why).toMatch(/slid Tick Tock onto the captain/i);

    const after = applyInput(next, { type: "acknowledgeFate" });
    expect(after.pending).toBeNull();
    expect(after.phase).toBe("actions");
    expect(after.hand).toHaveLength(0);
  });

  it("wipes the hand after Starkey slides Tick Tock onto the captain", () => {
    const state = barePlayState();
    state.villainLocation = "jollyRoger";
    state.phase = "resolving";
    const tick = putHero(state, "tickTock", "skullRock");
    const starkey = putAlly(state, "mrStarkey", "skullRock");
    give(state, "cannon");
    state.pending = { kind: "starkeyDest", starkeyId: starkey.instanceId, heroId: tick.instanceId };

    const next = applyInput(state, { type: "selectLocation", locationId: "jollyRoger" });
    expect(next.hand).toHaveLength(0);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.note).toMatch(/snaps/i);
  });

  it("snaps when player Fate seats Tick Tock on the captain", () => {
    const state = barePlayState();
    state.villainLocation = "skullRock";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("john")];
    give(state, "smee");

    let next = applyInput(state, { type: "selectAction", actionKey: "sr-fate" });
    if (next.pending?.kind !== "fateChooseCard") throw new Error("expected fateChooseCard");
    const tick = next.pending.cards.find((c) => c.defId === "tickTock")!;
    next = applyInput(next, { type: "selectCard", instanceId: tick.instanceId });
    next = applyInput(next, { type: "selectLocation", locationId: "skullRock" });

    expect(next.hand).toHaveLength(0);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.note).toMatch(/snaps/i);
    expect(next.pending.markAction).toBe(true);
  });

  it("snaps when computer Fate seats Tick Tock on the captain", () => {
    const state = barePlayState();
    state.villainLocation = "mermaidLagoon";
    state.phase = "actions";
    state.fateDeck = [inst("tickTock"), inst("wendy")];
    give(state, "hooksCase");

    const next = applyInput(state, { type: "endTurn" });
    expect(next.locations.mermaidLagoon.heroes.some((h) => h.defId === "tickTock")).toBe(true);
    expect(next.hand).toHaveLength(0);
    expect(next.pending?.kind).toBe("fateReport");
    if (next.pending?.kind !== "fateReport") throw new Error("expected fateReport");
    expect(next.pending.note).toMatch(/snaps/i);
    expect(next.pending.note).toMatch(/Mermaid Lagoon/);
    expect(next.pending.note).not.toMatch(/mermaidLagoon/);
  });

  it("DEV crocmove scene is one click from the snap, with a coach warning first", () => {
    const scene = tickTockOntoCaptainScene();
    expect(scene.pending?.kind).toBe("moveHeroDest");
    expect(scene.hand.length).toBeGreaterThan(0);

    const advice = advise(scene);
    expect(advice.highlights).not.toContain("loc:jollyRoger");
    expect(advice.warning ?? "").toMatch(/slide Tick Tock onto the captain/i);

    const html = renderPlay(scene);
    expect(html).toContain("Tick Tock");
    expect(html).toMatch(/Jolly Roger/);
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/jollyRoger|skullRock|mermaidLagoon|hangmansTree/);

    const snapped = applyInput(scene, { type: "selectLocation", locationId: "jollyRoger" });
    expect(snapped.hand).toHaveLength(0);
    expect(renderOverlay(snapped)).toMatch(/Tick Tock snaps/);
  });
});
