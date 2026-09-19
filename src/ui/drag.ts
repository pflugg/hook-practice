import { def } from "../engine/cards";
import {
  adjacentUnlocked,
  allAllies,
  findCard,
  findCardLocation,
  legalPlayLocations,
} from "../engine/queries";
import { highlightSet } from "../engine/game";
import type { GameState, Input, LocationId } from "../engine/types";

const PICK_KINDS = new Set([
  "playChooseCard",
  "playChooseLocation",
  "playChooseAllyAttach",
  "cunningAlly",
  "cunningLocation",
  "ayeAyeAlly",
  "ayeAyeDest",
  "movePieceSelect",
  "movePieceDest",
  "moveHeroSelect",
  "moveHeroDest",
  "starkeyHero",
  "starkeyDest",
  "fateChooseLocation",
  "worthyLocation",
  "obsessionLocation",
]);

export interface DropTargets {
  locations: LocationId[];
  cards: string[];
}

export function isDraggableCard(state: GameState, instanceId: string): boolean {
  const p = state.pending;
  if (!p || !PICK_KINDS.has(p.kind)) return false;
  const targets = dropTargets(state, instanceId);
  return targets.locations.length > 0 || targets.cards.length > 0;
}

export function dropTargets(state: GameState, instanceId: string): DropTargets {
  const empty: DropTargets = { locations: [], cards: [] };
  const p = state.pending;
  if (!p) return empty;
  const hi = highlightSet(state);
  const card = findCard(state, instanceId);

  if (p.kind === "playChooseCard") {
    if (!card || !hi.has(`card:${instanceId}`)) return empty;
    const d = def(card.defId);
    if (d.id === "cutlass") {
      return { locations: [], cards: allAllies(state).map((a) => a.ally.instanceId) };
    }
    if (d.type === "effect" || d.type === "condition") return empty;
    return { locations: legalPlayLocations(state), cards: [] };
  }
  if (p.kind === "playChooseLocation" && p.cardId === instanceId) {
    return { locations: legalPlayLocations(state), cards: [] };
  }
  if (p.kind === "cunningAlly") {
    if (!card || def(card.defId).type !== "ally") return empty;
    return { locations: legalPlayLocations(state), cards: [] };
  }
  if (p.kind === "cunningLocation" && p.allyId === instanceId) {
    return { locations: legalPlayLocations(state), cards: [] };
  }
  if (p.kind === "playChooseAllyAttach") {
    return { locations: [], cards: allAllies(state).map((a) => a.ally.instanceId) };
  }
  if (p.kind === "moveHeroSelect" || p.kind === "movePieceSelect" || p.kind === "ayeAyeAlly") {
    if (!hi.has(`card:${instanceId}`)) return empty;
    const from = findCardLocation(state, instanceId);
    return { locations: from ? adjacentUnlocked(state, from) : [], cards: [] };
  }
  if (p.kind === "moveHeroDest" && p.heroId === instanceId) {
    const from = findCardLocation(state, instanceId);
    return { locations: from ? adjacentUnlocked(state, from) : [], cards: [] };
  }
  if (p.kind === "movePieceDest" && p.pieceId === instanceId) {
    const from = findCardLocation(state, instanceId);
    return { locations: from ? adjacentUnlocked(state, from) : [], cards: [] };
  }
  if (p.kind === "ayeAyeDest" && p.allyId === instanceId) {
    const from = findCardLocation(state, instanceId);
    return { locations: from ? adjacentUnlocked(state, from) : [], cards: [] };
  }
  if (p.kind === "starkeyHero" && hi.has(`card:${instanceId}`)) {
    const from = findCardLocation(state, instanceId);
    return { locations: from ? adjacentUnlocked(state, from) : [], cards: [] };
  }
  if (p.kind === "starkeyDest" && p.heroId === instanceId) {
    const from = findCardLocation(state, instanceId);
    return { locations: from ? adjacentUnlocked(state, from) : [], cards: [] };
  }
  if (
    (p.kind === "fateChooseLocation" && p.cardId === instanceId) ||
    (p.kind === "worthyLocation" && p.heroId === instanceId) ||
    (p.kind === "obsessionLocation" && p.heroId === instanceId)
  ) {
    return { locations: legalPlayLocations(state), cards: [] };
  }
  return empty;
}

/** Inputs to apply a successful drop. Click-to-select remains the fallback. */
export function inputsForDrop(state: GameState, fromId: string, dest: { locationId?: LocationId; cardId?: string }): Input[] {
  const p = state.pending;
  if (!p) return [];
  const targets = dropTargets(state, fromId);
  if (dest.locationId && !targets.locations.includes(dest.locationId)) return [];
  if (dest.cardId && !targets.cards.includes(dest.cardId)) return [];

  if (p.kind === "playChooseCard") {
    const out: Input[] = [{ type: "selectCard", instanceId: fromId }];
    if (dest.locationId) out.push({ type: "selectLocation", locationId: dest.locationId });
    if (dest.cardId) out.push({ type: "selectCard", instanceId: dest.cardId });
    return out;
  }
  if (p.kind === "cunningAlly" && dest.locationId) {
    return [
      { type: "selectCard", instanceId: fromId },
      { type: "selectLocation", locationId: dest.locationId },
    ];
  }
  if (
    (p.kind === "moveHeroSelect" || p.kind === "movePieceSelect" || p.kind === "ayeAyeAlly" || p.kind === "starkeyHero") &&
    dest.locationId
  ) {
    return [
      { type: "selectCard", instanceId: fromId },
      { type: "selectLocation", locationId: dest.locationId },
    ];
  }
  if (p.kind === "playChooseAllyAttach" && dest.cardId) {
    return [{ type: "selectCard", instanceId: dest.cardId }];
  }
  if (dest.locationId) {
    return [{ type: "selectLocation", locationId: dest.locationId }];
  }
  if (dest.cardId) {
    return [{ type: "selectCard", instanceId: dest.cardId }];
  }
  return [];
}
