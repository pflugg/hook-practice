import type { LocationId, PrintedAction } from "./types";
import { LOCATION_IDS } from "./types";

export interface LocationMeta {
  id: LocationId;
  name: string;
  subtitle: string;
  startsLocked: boolean;
  actions: PrintedAction[];
}

export const REALM: Record<LocationId, LocationMeta> = {
  jollyRoger: {
    id: "jollyRoger",
    name: "Jolly Roger",
    subtitle: "The captain's ship",
    startsLocked: false,
    actions: [
      { key: "jr-gain", kind: "gainPower", row: "top", amount: 1 },
      { key: "jr-discard", kind: "discard", row: "top" },
      { key: "jr-vanquish", kind: "vanquish", row: "bottom" },
      { key: "jr-play", kind: "playCard", row: "bottom" },
    ],
  },
  skullRock: {
    id: "skullRock",
    name: "Skull Rock",
    subtitle: "A hollow lookout",
    startsLocked: false,
    actions: [
      { key: "sr-gain", kind: "gainPower", row: "top", amount: 1 },
      { key: "sr-play", kind: "playCard", row: "top" },
      { key: "sr-fate", kind: "fate", row: "bottom" },
      { key: "sr-discard", kind: "discard", row: "bottom" },
    ],
  },
  mermaidLagoon: {
    id: "mermaidLagoon",
    name: "Mermaid Lagoon",
    subtitle: "Tide and treasure",
    startsLocked: false,
    actions: [
      { key: "ml-play1", kind: "playCard", row: "top" },
      { key: "ml-move", kind: "moveItemAlly", row: "top" },
      { key: "ml-gain", kind: "gainPower", row: "bottom", amount: 3 },
      { key: "ml-play2", kind: "playCard", row: "bottom" },
    ],
  },
  hangmansTree: {
    id: "hangmansTree",
    name: "Hangman's Tree",
    subtitle: "The hidden hideout",
    startsLocked: true,
    actions: [
      { key: "ht-fate", kind: "fate", row: "top" },
      { key: "ht-gain", kind: "gainPower", row: "top", amount: 2 },
      { key: "ht-moveHero", kind: "moveHero", row: "bottom" },
      { key: "ht-play", kind: "playCard", row: "bottom" },
    ],
  },
};

/** Player-facing place name. Use this in logs, prompts, and coach copy — never interpolate a location id. */
export function locName(id: LocationId): string {
  return REALM[id].name;
}

export function locationIndex(id: LocationId): number {
  return LOCATION_IDS.indexOf(id);
}

export function adjacentIds(id: LocationId): LocationId[] {
  const i = locationIndex(id);
  const next: LocationId[] = [];
  if (i > 0) next.push(LOCATION_IDS[i - 1]);
  if (i < LOCATION_IDS.length - 1) next.push(LOCATION_IDS[i + 1]);
  return next;
}

export function actionLabel(kind: PrintedAction["kind"], amount?: number): string {
  switch (kind) {
    case "gainPower":
      return `Gain ${amount ?? 1}`;
    case "discard":
      return "Discard";
    case "playCard":
      return "Play a Card";
    case "fate":
      return "Fate";
    case "vanquish":
      return "Vanquish";
    case "moveItemAlly":
      return "Move Ally/Item";
    case "moveHero":
      return "Move a Hero";
  }
}
