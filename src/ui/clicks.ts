import { highlightSet } from "../engine/game";
import type { GameState, Input, LocationId } from "../engine/types";

/**
 * Route a click on the play board.
 * Legal location targets win over disabled/inert inner controls so move
 * (and drop-a-card) clicks work even when the pointer is over a dead action button.
 * During the required move, current-location action clicks are ignored — they
 * must not become selectAction or a stay-put location pick that rewrites Why.
 */
export function resolveBoardClick(target: EventTarget | null, state: GameState): Input | null {
  if (!(target instanceof Element)) return null;
  const el = target as HTMLElement;
  const hi = highlightSet(state);

  const move = el.closest<HTMLElement>("[data-move]");
  if (move?.dataset.move) {
    return { type: "selectLocation", locationId: move.dataset.move as LocationId };
  }

  const requiredMove = state.phase === "move" && !state.pending;
  if (requiredMove) {
    if (el.closest<HTMLElement>("[data-card]")) return null;
    const dest = el.closest<HTMLElement>("[data-loc]");
    if (dest && hi.has(`loc:${dest.dataset.loc}`)) {
      return { type: "selectLocation", locationId: dest.dataset.loc as LocationId };
    }
    return null;
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
  // A disabled action only falls through when the location is already a legal target.
  // An illegal place must not become a move/play/slide the engine will reject.
  if (act) return null;
  return null;
}
