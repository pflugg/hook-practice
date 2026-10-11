export const LOCATION_IDS = [
  "jollyRoger",
  "skullRock",
  "mermaidLagoon",
  "hangmansTree",
] as const;

export type LocationId = (typeof LOCATION_IDS)[number];

export type CardType = "ally" | "item" | "effect" | "condition" | "hero";
export type DeckKind = "villain" | "fate";
export type Difficulty = "easy" | "normal";
export type ActionKind =
  | "gainPower"
  | "discard"
  | "playCard"
  | "fate"
  | "vanquish"
  | "moveItemAlly"
  | "moveHero";

export type Row = "top" | "bottom" | "extra";

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  deck: DeckKind;
  copies: number;
  cost: number;
  strength: number;
  text: string;
}

export interface CardInstance {
  instanceId: string;
  defId: string;
}

export interface PrintedAction {
  key: string;
  kind: ActionKind;
  row: Row;
  amount?: number;
}

export interface ActionSlot {
  key: string;
  kind: ActionKind;
  row: Row;
  amount?: number;
  covered: boolean;
  used: boolean;
  available: boolean;
  label: string;
  source?: string;
}

export interface LocationState {
  id: LocationId;
  heroes: CardInstance[];
  allies: CardInstance[];
  items: CardInstance[];
}

export interface Attachment {
  item: CardInstance;
  attachedTo: string;
}

export type Screen = "title" | "play" | "help";

export type Pending =
  | { kind: "playChooseCard" }
  | { kind: "playChooseLocation"; cardId: string }
  | { kind: "playChooseAllyAttach"; cardId: string }
  | { kind: "playChoosePayment"; cardId: string; locationId?: LocationId; attachTo?: string }
  | { kind: "starkeyHero"; starkeyId: string }
  | { kind: "starkeyDest"; starkeyId: string; heroId: string }
  | { kind: "ayeAyeAlly" }
  | { kind: "ayeAyeDest"; allyId: string }
  | { kind: "discardSelect"; selected: string[] }
  | { kind: "vanquishHero" }
  | { kind: "vanquishConfirmLoss"; heroId: string }
  | { kind: "vanquishAllies"; heroId: string; selected: string[] }
  | { kind: "movePieceSelect" }
  | { kind: "movePieceDest"; pieceId: string }
  | { kind: "moveHeroSelect" }
  | { kind: "moveHeroDest"; heroId: string }
  | { kind: "scarePeek"; cards: CardInstance[] }
  | { kind: "fateChooseCard"; cards: CardInstance[]; actor: "player" | "ai" }
  | { kind: "fateChooseLocation"; cardId: string; actor: "player" | "ai" }
  | { kind: "fateChooseAttach"; cardId: string; actor: "player" | "ai" }
  | { kind: "fateChooseItem"; cardId: string; actor: "player" | "ai" }
  | { kind: "tinkerDiscard"; tinkerId: string; locationId: LocationId; actor: "player" | "ai" }
  | { kind: "worthyLocation"; heroId: string }
  | { kind: "obsessionDecide"; heroId: string; extras: CardInstance[] }
  | { kind: "obsessionLocation"; heroId: string }
  | { kind: "cunningAlly" }
  | { kind: "cunningLocation"; allyId: string }
  | {
      kind: "fateReport";
      drawn: CardInstance[];
      played?: CardInstance;
      discarded: CardInstance[];
      note: string;
      abilityText: string;
      choiceReason?: string;
      resume: "nextTurn" | "actions";
      markAction?: boolean;
    }
  | { kind: "conditionOffer"; conditionId: string; reason: string };

export type Phase = "title" | "move" | "actions" | "resolving" | "fateAdversary" | "over";

export interface LogEntry {
  id: number;
  text: string;
  tone: "info" | "good" | "bad" | "fate";
}

export interface GameState {
  screen: Screen;
  difficulty: Difficulty;
  seed: number;
  rng: number;
  instanceSeq: number;
  logSeq: number;
  turn: number;
  rivalProgress: number;
  coachOn: boolean;
  power: number;
  handSize: number;
  villainLocation: LocationId;
  /** Location the captain left on the previous move. Null before the first move. */
  departedFrom: LocationId | null;
  hangmansUnlocked: boolean;
  peterPanRevealed: boolean;
  peterPanLocation: LocationId | null;
  won: boolean;
  lost: boolean;
  loseReason: string;
  hand: CardInstance[];
  villainDeck: CardInstance[];
  villainDiscard: CardInstance[];
  fateDeck: CardInstance[];
  fateDiscard: CardInstance[];
  locations: Record<LocationId, LocationState>;
  attachments: Attachment[];
  phase: Phase;
  pending: Pending | null;
  usedActions: string[];
  tempStrength: Record<string, number>;
  defeatedHeroStrengthsThisTurn: number[];
  log: LogEntry[];
  lastComputerFateNote: string;
  lastFateShow: FateShow | null;
  voyage: VoyageMemory;
  /** Visible prompt banner for a refused or empty action (e.g. Vanquish with no legal Hero). */
  bannerNote: string;
  actionKey?: string;
  heldCard?: CardInstance;
}

export interface FateShow {
  drawn: CardInstance[];
  played?: CardInstance;
  discarded: CardInstance[];
  note: string;
  abilityText: string;
  choiceReason?: string;
}

/** Facts the end-of-voyage recap can explain without replaying the whole log. */
export interface ClashFact {
  heroName: string;
  place: string;
  locationId: LocationId;
  captainPlace: string;
  allyStrength: number;
  heroStrength: number;
  /** Captain stood with the Hero, or a Boarding Party reached a neighboring unlocked place. */
  reach: "same-place" | "neighbor";
  onShip: boolean;
}

export interface VoyageMemory {
  mapOpened: boolean;
  peterSeated: boolean;
  /** How Peter first arrived, already paraphrased. */
  peterHow: string;
  walkedWest: boolean;
  /** Short Fate lines, oldest first. */
  fateMoments: string[];
  lastClash: ClashFact | null;
}

export type Input =
  | { type: "start"; difficulty: Difficulty; seed?: number }
  | { type: "openHelp" }
  | { type: "closeHelp" }
  | { type: "resign" }
  | { type: "newGame" }
  | { type: "selectLocation"; locationId: LocationId }
  | { type: "selectAction"; actionKey: string }
  | { type: "selectCard"; instanceId: string }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "endTurn" }
  | { type: "scareDiscardBoth" }
  | { type: "scareReturn"; order: [string, string] }
  | { type: "payWithMap" }
  | { type: "payWithPower" }
  | { type: "playOrDiscardHero"; play: boolean }
  | { type: "skipCondition" }
  | { type: "acceptCondition" }
  | { type: "acknowledgeFate" };
