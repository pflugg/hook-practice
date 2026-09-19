import { describe, expect, it } from "vitest";
import { fateCardIds, villainCardIds } from "../src/engine/cards";
import { createGame } from "../src/engine/game";
import { chooseFateCard } from "../src/engine/fateAi";
import { barePlayState } from "./helpers";

describe("deck construction", () => {
  it("builds a 30-card villain deck and a 15-card Fate deck", () => {
    expect(villainCardIds()).toHaveLength(30);
    expect(fateCardIds()).toHaveLength(15);
    const game = createGame("normal", 7);
    expect(game.hand).toHaveLength(4);
    expect(game.villainDeck).toHaveLength(26);
    expect(game.fateDeck).toHaveLength(15);
  });

  it("Normal Fate prefers Peter Pan when he is one of the revealed cards", () => {
    const state = barePlayState();
    const peter = { instanceId: "p", defId: "peterPan" };
    const dust = { instanceId: "d", defId: "pixieDust" };
    const choice = chooseFateCard(state, [dust, peter], "normal");
    expect(choice.card.defId).toBe("peterPan");
  });
});
