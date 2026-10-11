import { describe, expect, it } from "vitest";
import { advise } from "../src/engine/coach";
import { applyInput, createGame, titleState } from "../src/engine/game";
import { coachChoice } from "../scripts/tutor-policy";

describe("tutor policy", () => {
  it("clicks the Coach location on the opening move", () => {
    const state = createGame("easy", 1);
    const advice = advise(state);
    const loc = advice.highlights.find((key) => key.startsWith("loc:"));
    expect(loc).toBe("loc:mermaidLagoon");
    const choice = coachChoice(state);
    expect(choice.issue).toBe("ok");
    expect(choice.input).toEqual({ type: "selectLocation", locationId: "mermaidLagoon" });
    if (choice.input?.type !== "selectLocation") throw new Error("Coach did not name a shore");
    const next = applyInput(state, choice.input);
    expect(next.phase).toBe("actions");
    expect(next.villainLocation).toBe("mermaidLagoon");
  });

  it("reports missing advice when the Coach has no highlight", () => {
    const choice = coachChoice(titleState());
    expect(choice.issue).toBe("missing");
    expect(choice.input).toBeNull();
  });
});
