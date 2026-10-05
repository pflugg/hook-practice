import { def } from "./cards";
import { createGame } from "./game";
import { REALM } from "./realm";
import type { CoachAdvice } from "./coach";
import { LOCATION_IDS, type CardInstance, type GameState, type LocationId } from "./types";

/** One action at a time. The opening board is guaranteed; the clash shore is a lesson setup. */
export type LessonStep = "move" | "gain" | "play" | "fate" | "escort" | "clash";

export const LESSON_ORDER: LessonStep[] = ["move", "gain", "play", "fate", "escort", "clash"];

const LESSON_TITLES: Record<LessonStep, string> = {
  move: "Move",
  gain: "Gain",
  play: "Play the Map",
  fate: "Fate",
  escort: "Escort",
  clash: "Clash",
};

export interface LessonView {
  step: LessonStep;
  index: number;
  total: number;
  title: string;
  detail: string;
  advice: CoachAdvice;
}

function card(state: GameState, defId: string): CardInstance {
  return { instanceId: `${defId}-lesson-${state.instanceSeq++}`, defId };
}

function note(state: GameState, text: string): void {
  state.log.unshift({ id: state.logSeq++, text, tone: "info" });
}

function clearTable(state: GameState): void {
  state.hand = [];
  state.villainDeck = [];
  state.villainDiscard = [];
  state.fateDeck = [];
  state.fateDiscard = [];
  state.attachments = [];
  state.usedActions = [];
  state.pending = null;
  state.heldCard = undefined;
  state.won = false;
  state.lost = false;
  state.loseReason = "";
  state.bannerNote = "";
  state.actionKey = undefined;
  state.lastComputerFateNote = "";
  state.lastFateShow = null;
  for (const id of LOCATION_IDS) state.locations[id] = { id, heroes: [], allies: [], items: [] };
}

/** Guaranteed Map in hand, 3 Power, Fate deck is Peter then another Hero. */
export function lessonOpening(): GameState {
  const state = createGame("normal", 1);
  clearTable(state);
  state.screen = "play";
  state.turn = 1;
  state.power = 3;
  state.phase = "move";
  state.villainLocation = "jollyRoger";
  state.departedFrom = null;
  state.hangmansUnlocked = false;
  state.peterPanRevealed = false;
  state.peterPanLocation = null;
  state.hand.push(card(state, "neverLandMap"));
  state.fateDeck.push(card(state, "peterPan"), card(state, "wendy"));
  state.log = [];
  note(
    state,
    "First voyage. One action at a time: move to Skull Rock, Gain 1, play the Never Land Map, read Fate, walk Peter one shore, then practice the clash.",
  );
  return state;
}

/** Lesson jump: Peter is already on the ship with an equal-Strength crew. */
export function lessonClashBoard(from: GameState): GameState {
  const state = createGame("normal", 2);
  clearTable(state);
  state.screen = "play";
  state.turn = Math.max(from.turn, 2);
  state.power = 0;
  state.phase = "actions";
  state.villainLocation = "jollyRoger";
  state.departedFrom = "skullRock";
  state.hangmansUnlocked = true;
  state.peterPanRevealed = true;
  state.peterPanLocation = "jollyRoger";
  const peter = card(state, "peterPan");
  const brute = card(state, "pirateBrute");
  const brute2 = card(state, "pirateBrute");
  state.locations.jollyRoger.heroes.push(peter);
  state.locations.jollyRoger.allies.push(brute, brute2);
  state.voyage = {
    ...from.voyage,
    mapOpened: true,
    peterSeated: true,
    walkedWest: true,
    peterHow: from.voyage.peterHow || "Fate played Peter Pan and seated him at Hangman’s Tree.",
  };
  state.log = [];
  note(
    state,
    "Lesson setup: the long walk is skipped. Peter is on the Jolly Roger at Strength 8, and two Pirate Brutes total 8. Equal Strength is enough.",
  );
  return state;
}

function say(doLine: string, why: string, highlights: string[]): CoachAdvice {
  return { do: doLine, why, highlights };
}

function actionKey(state: GameState, kind: "gainPower" | "playCard" | "moveHero" | "vanquish"): string | null {
  const printed = REALM[state.villainLocation].actions.find(
    (action) => action.kind === kind && !state.usedActions.includes(action.key),
  );
  return printed?.key ?? null;
}

function heroId(state: GameState, defId: string): string | null {
  for (const id of LOCATION_IDS) {
    const found = state.locations[id].heroes.find((hero) => hero.defId === defId);
    if (found) return found.instanceId;
  }
  return state.hand.find((c) => c.defId === defId)?.instanceId ?? null;
}

function lessonAdvice(state: GameState, step: LessonStep): CoachAdvice {
  const pending = state.pending;
  if (pending?.kind === "fateReport") {
    return say(
      "Read the Fate card, then click Continue.",
      "Fate waits until you acknowledge it. The lesson resumes after Continue.",
      ["btn:ack"],
    );
  }
  if (step === "move") {
    if (state.phase === "move") {
      return say(
        "Move to Skull Rock (click Move here: Skull Rock).",
        "Every turn starts by leaving the current shore. Skull Rock’s Gain 1 is the one action this lesson needs.",
        ["loc:skullRock"],
      );
    }
    return say(
      "End the turn (click End turn), then move to Skull Rock.",
      "This lesson’s Gain is at Skull Rock. Other shores can wait.",
      ["btn:end"],
    );
  }
  if (step === "gain") {
    if (state.phase === "move") {
      return say(
        "Move to Skull Rock (click Move here: Skull Rock), then take Gain 1.",
        "The Never Land Map costs 4 Power. You still need that Gain before the Map can be paid.",
        ["loc:skullRock"],
      );
    }
    const gain = actionKey(state, "gainPower");
    if (gain && state.villainLocation === "skullRock") {
      return say(
        "Take Gain 1 (click Gain 1).",
        "This is the only action for this beat. The Map stays in hand until you have 4 Power.",
        [`act:${gain}`],
      );
    }
    if (gain) {
      return say(
        "Take the Gain on this shore.",
        "Bank Power until the held Never Land Map costs 4 or less than what you have. Skip purchases.",
        [`act:${gain}`],
      );
    }
    return say(
      "End the turn (click End turn), then Gain at Skull Rock.",
      "This shore has no open Gain. The Map’s 4 Power is still the goal.",
      ["btn:end"],
    );
  }
  if (step === "play") {
    if (pending?.kind === "playChoosePayment") {
      return say(
        "Pay 4 Power (click Pay 4 Power).",
        "That button is the Map’s cost. Paying it opens Hangman’s Tree.",
        ["btn:pay-power"],
      );
    }
    if (pending?.kind === "playChooseLocation") {
      const here = state.villainLocation;
      return say(
        `Choose this place: ${REALM[here].name}.`,
        "The Map lands where the captain stands. Playing it is what opens the tree.",
        [`loc:${here}`],
      );
    }
    if (pending?.kind === "playChooseCard") {
      const map = state.hand.find((c) => c.defId === "neverLandMap");
      return say(
        "Click Never Land Map in your hand.",
        "This Play is only the Map. Other cards would spend the Power you just banked.",
        map ? [`card:${map.instanceId}`] : [],
      );
    }
    if (state.phase === "move") {
      return say(
        "Move to a shore with Play a Card, then play the Never Land Map.",
        "You have the 4 Power. The next click is the shore, then Play a Card, then the Map, then Pay 4 Power.",
        ["loc:skullRock"],
      );
    }
    const play = actionKey(state, "playCard");
    if (play) {
      return say(
        "Play the Never Land Map (click Play a Card, then the Map, then Pay 4 Power).",
        "The Map is the key. This lesson does not buy crew or Items.",
        [`act:${play}`],
      );
    }
    return say(
      "End the turn (click End turn). The Map is still in hand.",
      "Play was already used here. The next stop should be one where Play a Card is open.",
      ["btn:end"],
    );
  }
  if (step === "fate") {
    return say(
      "End the turn (click End turn).",
      "Ending refills the hand and the computer Fates you. Continue is required before the next move.",
      ["btn:end"],
    );
  }
  if (step === "escort") {
    if (pending?.kind === "moveHeroSelect" || pending?.kind === "starkeyHero") {
      const peter = heroId(state, "peterPan");
      return say(
        "Click Peter Pan.",
        "Move a Hero walks one neighboring unlocked shore. Peter’s step from the tree is Mermaid Lagoon.",
        peter ? [`card:${peter}`] : [],
      );
    }
    if (pending?.kind === "moveHeroDest" || pending?.kind === "starkeyDest") {
      return say(
        "Choose this place: Mermaid Lagoon.",
        "That is the neighboring shore toward the Jolly Roger. Do not vanquish him on the path.",
        ["loc:mermaidLagoon"],
      );
    }
    if (state.phase === "move") {
      return say(
        "Move to Hangman’s Tree (click Move here: Hangman’s Tree).",
        "Peter is at the open tree. The escort action is printed there.",
        ["loc:hangmansTree"],
      );
    }
    if (state.villainLocation !== "hangmansTree") {
      return say(
        "End the turn (click End turn), then move to Hangman’s Tree.",
        "Peter can be walked only from a shore with Move a Hero. The tree has that action.",
        ["btn:end"],
      );
    }
    const moveHero = actionKey(state, "moveHero");
    if (moveHero) {
      return say(
        "Walk Peter one shore (click Move a Hero, then Peter Pan, then Mermaid Lagoon).",
        "One neighboring step is the whole escort lesson. A normal voyage repeats that walk until the ship.",
        [`act:${moveHero}`],
      );
    }
    return say(
      "End the turn (click End turn).",
      "Move a Hero was already used. Peter still needs to leave the tree.",
      ["btn:end"],
    );
  }
  if (pending?.kind === "vanquishConfirmLoss") {
    return say(
      "Cancel. Vanquishing Peter away from the ship loses the duel.",
      "This lesson’s clash is only legal on the Jolly Roger.",
      ["btn:cancel"],
    );
  }
  if (pending?.kind === "vanquishHero") {
    const peter = heroId(state, "peterPan");
    return say(
      "Click Peter Pan.",
      "He is on the Jolly Roger. That is the only place this clash wins.",
      peter ? [`card:${peter}`] : [],
    );
  }
  if (pending?.kind === "vanquishAllies") {
    const selected = pending.selected;
    const missing = state.locations.jollyRoger.allies.find((ally) => !selected.includes(ally.instanceId));
    if (missing) {
      return say(
        `Click ${def(missing.defId).name}.`,
        "Two Pirate Brutes are Strength 4 each. Peter is Strength 8. Equal Strength is enough — add both, then Confirm.",
        [`card:${missing.instanceId}`],
      );
    }
    return say(
      "Confirm the clash (click Confirm).",
      "Strength 8 meets Peter’s 8. The button stays disabled until the meter is ready.",
      ["btn:confirm"],
    );
  }
  const vanquish = actionKey(state, "vanquish");
  if (vanquish) {
    return say(
      "Vanquish Peter Pan (click Vanquish, then Peter Pan, then both Pirate Brutes, then Confirm).",
      "The crew totals 8 against his 8. The win counts only on the Jolly Roger.",
      [`act:${vanquish}`],
    );
  }
  return say(
    "End the turn (click End turn).",
    "Vanquish is printed on the Jolly Roger. Stand there to finish the clash.",
    state.phase === "move" ? ["loc:jollyRoger"] : ["btn:end"],
  );
}

export function lessonView(state: GameState, step: LessonStep): LessonView {
  const index = LESSON_ORDER.indexOf(step) + 1;
  const advice = lessonAdvice(state, step);
  const detail =
    step === "clash"
      ? "Last lesson: clash Peter on the ship at equal Strength. The walk here was set up so this beat stays short."
      : advice.why;
  return {
    step,
    index,
    total: LESSON_ORDER.length,
    title: LESSON_TITLES[step],
    detail,
    advice,
  };
}

function peterLoc(state: GameState): LocationId | null {
  if (state.peterPanLocation) return state.peterPanLocation;
  for (const id of LOCATION_IDS) {
    if (state.locations[id].heroes.some((hero) => hero.defId === "peterPan")) return id;
  }
  return null;
}

export function advanceLesson(
  step: LessonStep,
  before: GameState,
  after: GameState,
): { step: LessonStep; state: GameState } {
  if (after.won || after.lost || after.phase === "over") return { step: "clash", state: after };
  if (step === "clash") return { step: "clash", state: after };
  if (step === "escort") {
    const loc = peterLoc(after);
    if (loc && loc !== "hangmansTree") return { step: "clash", state: lessonClashBoard(after) };
    return { step: "escort", state: after };
  }
  if (step === "fate") {
    const acked = before.pending?.kind === "fateReport" && after.pending?.kind !== "fateReport";
    if (after.pending?.kind === "fateReport") return { step: "fate", state: after };
    if ((acked || after.phase === "move") && after.peterPanRevealed && after.hangmansUnlocked) {
      return { step: "escort", state: after };
    }
    if (acked || (after.phase === "move" && after.hangmansUnlocked)) {
      const seated = structuredClone(after);
      const peter = card(seated, "peterPan");
      seated.locations.hangmansTree.heroes.push(peter);
      seated.peterPanRevealed = true;
      seated.peterPanLocation = "hangmansTree";
      seated.hangmansUnlocked = true;
      seated.voyage.peterSeated = true;
      seated.voyage.peterHow = "The lesson seats Peter Pan at Hangman’s Tree so the escort can be practiced.";
      note(seated, "Peter was not in that Fate flip. The lesson seats him at the open tree.");
      return { step: "escort", state: seated };
    }
    return { step: "fate", state: after };
  }
  if (after.hangmansUnlocked) return { step: "fate", state: after };
  if (after.power >= def("neverLandMap").cost && step !== "play" && after.phase !== "move") {
    return { step: "play", state: after };
  }
  if (step === "move" && after.phase !== "move" && after.phase !== "title") return { step: "gain", state: after };
  return { step, state: after };
}
