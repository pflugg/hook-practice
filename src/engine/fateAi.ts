import { def } from "./cards";
import { LOCATION_IDS, type CardInstance, type GameState, type LocationId } from "./types";
import { adjacentIds } from "./realm";
import { allAllies, allLocationItems, allyStrength, attachableHeroes, heroStrength, isUnlocked } from "./queries";
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
  const first = spots[0];
  if (!first) throw new Error("No unlocked location for a Hero");
  let best = first;
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
  if (d.id === "taunt") return attachableHeroes(state, "taunt").length > 0 ? 45 : -10;
  if (d.id === "pixieDust") return attachableHeroes(state, "pixieDust").length > 0 ? 40 : -10;
  if (d.id === "john") return 28;
  if (d.id === "michael") return 32;
  return 10;
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
  const peter = cards.find((c) => c.defId === "peterPan");
  if (peter) return { card: peter, rng: state.rng };
  const pool = fatePlayPool(state, cards);
  if (difficulty === "easy") {
    const pick = pickIndex(pool.length, state.rng);
    const card = pool[pick.index];
    if (!card) throw new Error("Fate drew no card");
    return { card, rng: pick.rng };
  }
  const first = pool[0];
  if (!first) throw new Error("Fate drew no card");
  let best = first;
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

export function chooseAttachHero(
  state: GameState,
  preferPeter: boolean,
  itemDefId = "pixieDust",
): CardInstance | null {
  const heroes = attachableHeroes(state, itemDefId);
  if (heroes.length === 0) return null;
  if (preferPeter) {
    const peter = heroes.find((h) => h.defId === "peterPan");
    if (peter) return peter;
  }
  return heroes.slice().sort((a, b) => heroStrength(state, b) - heroStrength(state, a))[0] ?? null;
}

export function chooseHeadacheItem(state: GameState): CardInstance | null {
  const items = allLocationItems(state);
  if (items.length === 0) return null;
  const rank = (id: string) =>
    id === "ingeniousDevice" ? 5 : id === "neverLandMap" ? 4 : id === "cannon" ? 3 : id === "hooksCase" ? 2 : 1;
  return items.slice().sort((a, b) => rank(b.item.defId) - rank(a.item.defId))[0]?.item ?? null;
}

export function chooseTinkerAlly(state: GameState, locationId: LocationId): CardInstance | null {
  const allies = state.locations[locationId].allies;
  if (allies.length === 0) return null;
  return allies.slice().sort((a, b) => allyStrength(state, b) - allyStrength(state, a))[0] ?? null;
}

export function randomUnlocked(state: GameState): { id: LocationId; rng: number } {
  const spots = LOCATION_IDS.filter((id) => isUnlocked(state, id));
  const pick = pickIndex(spots.length, state.rng);
  const id = spots[pick.index];
  if (!id) throw new Error("No unlocked location");
  return { id, rng: pick.rng };
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
  itemDefId = "pixieDust",
): { hero: CardInstance | null; rng: number } {
  const heroes = attachableHeroes(state, itemDefId);
  if (heroes.length === 0) return { hero: null, rng: state.rng };
  if (difficulty === "easy") {
    const pick = pickIndex(heroes.length, state.rng);
    const hero = heroes[pick.index];
    if (!hero) throw new Error("No Hero to attach");
    return { hero, rng: pick.rng };
  }
  return { hero: chooseAttachHero(state, true, itemDefId), rng: state.rng };
}

function fateCardWouldFizzle(state: GameState, card: CardInstance): boolean {
  const d = def(card.defId);
  if (d.id === "pixieDust" || d.id === "taunt") {
    return attachableHeroes(state, d.id).length === 0;
  }
  if (d.id === "splittingHeadache") return allLocationItems(state).length === 0;
  return false;
}

function normalHeuristicClause(state: GameState, played: CardInstance): string {
  const d = def(played.defId);
  if (d.id === "peterPan") return "Normal Fate always plays Peter when he is drawn.";
  if (d.id === "splittingHeadache") {
    return fateCardWouldFizzle(state, played)
      ? "Normal Fate discarded Splitting Headache — no Item was ashore."
      : "Normal Fate played Splitting Headache to strip an Item.";
  }
  if (d.id === "tickTock") return "Normal Fate parked Tick Tock to threaten the hand.";
  if (d.id === "tinkerBell") return "Normal Fate seated Tinker Bell to dismiss crew.";
  if (d.id === "wendy") return "Normal Fate seated Wendy to raise every other Hero's Strength.";
  if (d.id === "lostBoys") return "Normal Fate seated Lost Boys to tax the crew.";
  if (d.id === "taunt") {
    return fateCardWouldFizzle(state, played)
      ? "Normal Fate discarded Taunt — no Hero was ashore to cling to."
      : "Normal Fate attached Taunt so you must clash that Hero first.";
  }
  if (d.id === "pixieDust") {
    return fateCardWouldFizzle(state, played)
      ? "Normal Fate discarded Pixie Dust — no Hero was ashore to cling to."
      : "Normal Fate attached Pixie Dust to raise a Hero's Strength.";
  }
  if (d.type === "hero") return "Normal Fate seated a Hero to cover a useful action.";
  return `Normal Fate played ${d.name}.`;
}

/** One-line lesson for the intervening Fate modal: Easy = random; Normal = short heuristic. */
export function explainFateChoice(
  state: GameState,
  drawn: CardInstance[],
  played: CardInstance,
  difficulty: "easy" | "normal",
): string {
  if (difficulty === "easy") {
    if (played.defId === "peterPan") {
      return "Peter was revealed, so Easy plays him to Hangman’s Tree and discards the other card — same as at a table.";
    }
    const other = drawn.find((c) => c.instanceId !== played.instanceId);
    let line = "Easy Fate picked at random among the legal cards.";
    if (other) line += ` ${def(other.defId).name} stays down.`;
    if (fateCardWouldFizzle(state, played)) {
      const normalPick = chooseFateCard(state, drawn, "normal").card;
      if (normalPick.instanceId !== played.instanceId) {
        line += ` A Normal pick would have played ${def(normalPick.defId).name}.`;
      }
    }
    return line;
  }
  return normalHeuristicClause(state, played);
}
