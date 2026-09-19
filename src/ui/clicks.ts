import { highlightSet } from "../engine/game";
import type { GameState, Input, LocationId } from "../engine/types";

/**
 * Route a click on the play board.
 * Legal location targets win over disabled/inert inner controls so move
 * (and drop-a-card) clicks work even when the pointer is over a dead action button.
 */
export function resolveBoardClick(target: EventTarget | null, state: GameState): Input | null {
  if (!(target instanceof Element)) return null;
  const el = target as HTMLElement;
  const hi = highlightSet(state);

  const move = el.closest<HTMLElement>("[data-move]");
  if (move?.dataset.move) {
    return { type: "selectLocation", locationId: move.dataset.move as LocationId };
  }

  const card = el.closest<HTMLElement>("[data-card]");
  const act = el.closest<HTMLElement>("[data-act]");
  const loc = el.closest<HTMLElement>("[data-loc]");
  const pickingCard = Boolean(
    state.pending &&
      [
        "playChooseAllyAttach",
        "playChooseCard",
        "cunningAlly",
        "ayeAyeAlly",
        "movePieceSelect",
        "moveHeroSelect",
        "vanquishHero",
        "vanquishAllies",
        "discardSelect",
        "starkeyHero",
      ].includes(state.pending.kind),
  );

  if (card && hi.has(`card:${card.dataset.card}`)) {
    return { type: "selectCard", instanceId: card.dataset.card! };
  }

  if (card && !pickingCard) {
    return null;
  }

  const actionEnabled = Boolean(act && !act.hasAttribute("disabled"));
  if (actionEnabled && hi.has(`act:${act!.dataset.act}`)) {
    return { type: "selectAction", actionKey: act!.dataset.act! };
  }

  if (loc && hi.has(`loc:${loc.dataset.loc}`)) {
    return { type: "selectLocation", locationId: loc.dataset.loc as LocationId };
  }

  if (pickingCard && card) {
    return { type: "selectCard", instanceId: card.dataset.card! };
  }
  if (pickingCard) return null;

  if (card) {
    return null;
  }
  if (actionEnabled) {
    return { type: "selectAction", actionKey: act!.dataset.act! };
  }
  if (loc) {
    return { type: "selectLocation", locationId: loc.dataset.loc as LocationId };
  }
  return null;
}
