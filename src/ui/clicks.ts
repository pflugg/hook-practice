import { highlightSet } from "../engine/game";
import type { GameState, Input } from "../engine/types";
import { parseLocationId } from "./parse";

export function resolveBoardClick(target: EventTarget | null, state: GameState): Input | null {
  if (!(target instanceof Element)) return null;
  const el = target as HTMLElement;
  const hi = highlightSet(state);

  const move = el.closest<HTMLElement>("[data-move]");
  const moveId = parseLocationId(move?.dataset.move);
  if (moveId) {
    return { type: "selectLocation", locationId: moveId };
  }

  const requiredMove = state.phase === "move" && !state.pending;
  if (requiredMove) {
    if (el.closest<HTMLElement>("[data-card]")) return null;
    const dest = el.closest<HTMLElement>("[data-loc]");
    const destId = parseLocationId(dest?.dataset.loc);
    if (destId && hi.has(`loc:${destId}`)) {
      return { type: "selectLocation", locationId: destId };
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

  const locId = parseLocationId(loc?.dataset.loc);
  if (locId && hi.has(`loc:${locId}`)) {
    return { type: "selectLocation", locationId: locId };
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
