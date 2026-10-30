/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInput } from "../src/engine/game";
import { advanceLesson, lessonOpening, lessonView, type LessonStep } from "../src/engine/lesson";
import type { GameState, Input, LocationId } from "../src/engine/types";
import { mount, renderPlay } from "../src/ui/app";

function follow(step: LessonStep, state: GameState, limit = 40) {
  const seen: LessonStep[] = [step];
  for (let i = 0; i < limit && !state.won; i++) {
    const view = lessonView(state, step);
    const key = view.advice.highlights[0];
    if (!key) throw new Error(`Lesson ${step} has no highlight`);
    let input: Input;
    if (key.startsWith("loc:")) input = { type: "selectLocation", locationId: key.slice(4) as LocationId };
    else if (key.startsWith("act:")) input = { type: "selectAction", actionKey: key.slice(4) };
    else if (key.startsWith("card:")) input = { type: "selectCard", instanceId: key.slice(5) };
    else if (key === "btn:end") input = { type: "endTurn" };
    else if (key === "btn:pay-power") input = { type: "payWithPower" };
    else if (key === "btn:ack") input = { type: "acknowledgeFate" };
    else if (key === "btn:confirm") input = { type: "confirm" };
    else if (key === "btn:cancel") input = { type: "cancel" };
    else throw new Error(`Unexpected lesson highlight ${key} during ${step}`);
    const before = state;
    const next = applyInput(before, input);
    const stamp = (s: GameState) => {
      const selected = s.pending && "selected" in s.pending ? s.pending.selected.join(",") : "";
      return `${s.phase}|${s.pending?.kind ?? ""}|${selected}|${s.power}|${s.villainLocation}|${s.peterPanLocation}|${s.hangmansUnlocked}|${s.won}|${s.usedActions.join(",")}|${s.hand.map((c) => c.defId).join(",")}`;
    };
    if (stamp(next) === stamp(before)) throw new Error(`Lesson input did nothing: ${step} ${key}`);
    const advanced = advanceLesson(step, before, next);
    step = advanced.step;
    state = advanced.state;
    if (seen[seen.length - 1] !== step) seen.push(step);
  }
  return { state, step, seen };
}

describe("staged first voyage", () => {
  it("teaches move, Gain, the Map, Fate, one escort step, and an equal clash", () => {
    const opened = lessonOpening();
    expect(opened.hand.map((card) => card.defId)).toEqual(["neverLandMap"]);
    expect(opened.power).toBe(3);
    expect(opened.fateDeck.map((card) => card.defId)).toEqual(["peterPan", "wendy"]);

    const played = follow("move", opened);
    expect(played.seen).toEqual(["move", "gain", "play", "fate", "escort", "clash"]);
    expect(played.state.won).toBe(true);
    expect(played.state.voyage.lastClash?.onShip).toBe(true);
    expect(played.state.voyage.lastClash?.allyStrength).toBe(8);
    expect(played.state.voyage.lastClash?.heroStrength).toBe(8);
    expect(played.state.voyage.walkedWest).toBe(true);

    const html = renderPlay(played.state, { lesson: lessonView(played.state, "clash") });
    expect(html).toContain("data-lesson-handoff");
    expect(html).toContain(">Tutorial complete<");
    expect(html).toContain("complete every escort step yourself");
    expect(html).not.toContain("until he stood on the Jolly Roger");
    expect(html).toContain("Begin a normal voyage");
    expect(html).toContain(">Return to title &amp; drills<");
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain("data-lesson-banner");
  });

  it("starts from Tutorial and keeps the saved coach flags", () => {
    const source = readFileSync(join(process.cwd(), "src/ui/app.ts"), "utf8");
    expect(source).toContain('readFlag("nld-coach")');
    expect(source).toContain('readFlag("nld-brief", false)');
    expect(source).toContain('readFlag("nld-reasons", false)');
    expect(source).not.toContain("localStorage");

    window.history.replaceState({}, "", "/");
    const root = document.createElement("div");
    document.body.appendChild(root);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
    mount(root);
    root.querySelector<HTMLButtonElement>("[data-tutorial]")!.click();
    const banner = root.querySelector("[data-lesson-banner]");
    expect(banner?.textContent).toMatch(/Lesson 1 of 6/);
    expect(banner?.textContent).toMatch(/Move/);
    expect(root.querySelector(".coach-do")?.textContent).toMatch(/Skull Rock/);
    expect(root.querySelector("[data-start]")).toBeNull();
    root.remove();
  });
});
