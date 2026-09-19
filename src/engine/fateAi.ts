import { def } from "./cards";
import { LOCATION_IDS, type CardInstance, type GameState, type LocationId } from "./types";
import { adjacentIds } from "./realm";
import { allAllies, allLocationItems, allyStrength, heroStrength, isUnlocked } from "./queries";
import { pickIndex } from "./rng";

export function blockValue(state: GameState, id: LocationId): number {
  let score = 0;
  if (id === "mermaidLagoon") score += 40;
  if (id === "skullRock") score += 28;
  if (id === "hangmansTree" && state.hangmansUnlocked) score += 24;
  if (id === "jollyRoger") score += 12;
  if (state.locations[id].heroes.length === 0) score += 10;
  if (state.peterPanLocation && adjacentIds(state.peterPanLocation).includes(id)) score += 8;
  return score;
}

export function scoreHeroPlacement(state: GameState, hero: CardInstance, id: LocationId): number {
  let score = blockValue(state, id);
  if (hero.defId === "tickTock") {
    if (id === "mermaidLagoon") score += 35;
    if (id === "jollyRoger") score += 22;
  }
  if (hero.defId === "tinkerBell") {
    const allies = state.locations[id].allies;
    score += allies.reduce((n, a) => n + allyStrength(state, a), 0) * 4;
  }
  if (hero.defId === "wendy" && LOCATION_IDS.some((loc) => state.locations[loc].heroes.length > 0)) {
    score += 15;
  }
  return score;
}

export function bestHeroLocation(state: GameState, hero: CardInstance): LocationId {
  const spots = LOCATION_IDS.filter((id) => isUnlocked(state, id));
  let best = spots[0];
  let bestScore = -Infinity;
  for (const id of spots) {
    const s = scoreHeroPlacement(state, hero, id);
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  return best;
}

export function scoreFateCard(state: GameState, card: CardInstance): number {
  const d = def(card.defId);
  if (d.id === "peterPan") return 1000;
  if (d.id === "splittingHeadache") {
    const items = allLocationItems(state);
    if (items.length === 0) return -1000;
    const ids = items.map((i) => i.item.defId);
    if (ids.includes("ingeniousDevice")) return 90;
    if (ids.includes("neverLandMap")) return 80;
    if (ids.includes("cannon")) return 55;
    return 30;
  }
  if (d.id === "tickTock") return 70;
  if (d.id === "tinkerBell") return allAllies(state).length > 0 ? 65 : 25;
  if (d.id === "wendy") return 50;
  if (d.id === "lostBoys") return 48;
  if (d.id === "taunt") return allHeroesSafe(state) ? 45 : -10;
  if (d.id === "pixieDust") return allHeroesSafe(state) ? 40 : -10;
  if (d.id === "john") return 28;
  if (d.id === "michael") return 32;
  return 10;
}

function allHeroesSafe(state: GameState): boolean {
  return LOCATION_IDS.some((id) => state.locations[id].heroes.length > 0);
}

function fatePlayPool(state: GameState, cards: CardInstance[]): CardInstance[] {
  if (allLocationItems(state).length > 0) return cards;
  const withoutHeadache = cards.filter((c) => c.defId !== "splittingHeadache");
  return withoutHeadache.length > 0 ? withoutHeadache : cards;
}

export function chooseFateCard(
  state: GameState,
  cards: CardInstance[],
  difficulty: "easy" | "normal",
): { card: CardInstance; rng: number } {
  if (cards.some((c) => c.defId === "peterPan")) {
    return { card: cards.find((c) => c.defId === "peterPan")!, rng: state.rng };
  }
  const pool = fatePlayPool(state, cards);
  if (difficulty === "easy") {
    const pick = pickIndex(pool.length, state.rng);
    return { card: pool[pick.index], rng: pick.rng };
  }
  let best = pool[0];
  let bestScore = -Infinity;
  for (const card of pool) {
    const s = scoreFateCard(state, card);
    if (s > bestScore) {
      best = card;
      bestScore = s;
    }
  }
  return { card: best, rng: state.rng };
}

export function chooseAttachHero(state: GameState, preferPeter: boolean): CardInstance | null {
  const heroes = LOCATION_IDS.flatMap((id) => state.locations[id].heroes);
  if (heroes.length === 0) return null;
  if (preferPeter) {
    const peter = heroes.find((h) => h.defId === "peterPan");
    if (peter) return peter;
  }
  return heroes.slice().sort((a, b) => heroStrength(state, b) - heroStrength(state, a))[0];
}

export function chooseHeadacheItem(state: GameState): CardInstance | null {
  const items = allLocationItems(state);
  if (items.length === 0) return null;
  const rank = (id: string) =>
    id === "ingeniousDevice" ? 5 : id === "neverLandMap" ? 4 : id === "cannon" ? 3 : id === "hooksCase" ? 2 : 1;
  return items.slice().sort((a, b) => rank(b.item.defId) - rank(a.item.defId))[0].item;
}

export function chooseTinkerAlly(state: GameState, locationId: LocationId): CardInstance | null {
  const allies = state.locations[locationId].allies;
  if (allies.length === 0) return null;
  return allies.slice().sort((a, b) => allyStrength(state, b) - allyStrength(state, a))[0];
}

export function randomUnlocked(state: GameState): { id: LocationId; rng: number } {
  const spots = LOCATION_IDS.filter((id) => isUnlocked(state, id));
  const pick = pickIndex(spots.length, state.rng);
  return { id: spots[pick.index], rng: pick.rng };
}

export function chooseHeroLocation(
  state: GameState,
  hero: CardInstance,
  difficulty: "easy" | "normal",
): { id: LocationId; rng: number } {
  if (difficulty === "easy") return randomUnlocked(state);
  return { id: bestHeroLocation(state, hero), rng: state.rng };
}

export function chooseAttachTarget(
  state: GameState,
  difficulty: "easy" | "normal",
): { hero: CardInstance | null; rng: number } {
  const heroes = LOCATION_IDS.flatMap((id) => state.locations[id].heroes);
  if (heroes.length === 0) return { hero: null, rng: state.rng };
  if (difficulty === "easy") {
    const pick = pickIndex(heroes.length, state.rng);
    return { hero: heroes[pick.index], rng: pick.rng };
  }
  return { hero: chooseAttachHero(state, true), rng: state.rng };
}
