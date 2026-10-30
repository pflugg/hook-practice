import { advise, type CoachAdvice } from "./coach";
import { def } from "./cards";
import { promptText, allyStrength, heroStrength, attachmentsOn, vanquishClashMath, availableActions, locationsWithHeroes } from "./queries";
import { locName } from "./realm";
import { rivalGoal } from "./rival";
import { LOCATION_IDS, type GameState } from "./types";
import type { MoveReason } from "./moveReason";

export interface TutorFact { id: string; title: string; text: string }
export interface TutorContext { position: string; facts: TutorFact[] }
export interface TutorSelection { answerable: boolean; factIds: string[] }

export const TUTOR_QUESTIONS = [
  "Why does the next move help?",
  "What should I watch out for?",
  "How do I finish the objective?",
] as const;

/** Only visible facts go to the tutor. Hidden decks, seed, RNG, and logs stay local. */
export function tutorContext(state: GameState, guidance: CoachAdvice = advise(state), lastReason?: MoveReason): TutorContext {
  const facts: TutorFact[] = [];
  const add = (id: string, title: string, text: string) => {
    if (text.trim()) facts.push({ id, title, text });
  };
  add("next", "A legal next step", guidance.do);
  add("reason", "Why that step helps", guidance.why);
  if (lastReason && !lastReason.soft) add("last-choice", "Your last choice", `${lastReason.chose} ${lastReason.why} ${lastReason.next}`);
  add("warning", "Watch out", guidance.warning ?? "");
  add("phase", "What the game needs now", promptText(state));
  add("objective", "The objective", "Play the Never Land Map to unlock Hangman’s Tree, reveal Peter Pan, move him along adjacent unlocked shores to the Jolly Roger, and Vanquish him there. In this trainer, vanquishing Peter anywhere else loses the voyage.");
  add("turn", "The turn rule", "Move the captain to a different unlocked location before using its uncovered actions, once each in any order. Heroes cover only the printed top row. End turn refills toward four cards, then computer Fate acts. Read the Fate report and choose Continue.");
  add("resources", "Your resources", `You have ${state.power} Power. The captain is at ${locName(state.villainLocation)} on turn ${state.turn}. The rival is at ${state.rivalProgress} of ${rivalGoal(state.coachOn, state.difficulty)}. The rival advances after your turn; a Gain action itself does not advance it.`);
  add("map", "The Map and the tree", state.hangmansUnlocked
    ? "Hangman’s Tree is unlocked. The unlock is permanent, even if the Map leaves play."
    : "Hangman’s Tree is locked. The Never Land Map costs 4 Power; its play and payment unlock the tree. Peter can be revealed at the locked tree but cannot leave until it is unlocked.");
  const clash = vanquishClashMath(state);
  if (clash) add("clash", "This clash", `Selected Ally Strength is ${clash.selected} against ${clash.need}. ${clash.lostBoys ? `Lost Boys requires at least two Allies; ${clash.selectedAllies} are selected. ` : ""}${clash.ready ? "The selected crew meets the requirement." : "Confirm is unavailable until the selected crew meets the requirement."} Equal Strength is enough; the defeated Hero and committed Allies are discarded.`);
  add("combat", "Choosing crew", "Use current Strength after buffs and attachments. Equal or greater Ally Strength is enough. A clash against Lost Boys requires at least two Allies. Save unneeded crew for later clashes. While any Taunt remains, only taunted Heroes can be vanquished in this trainer.");
  add("fate", "Fate and solo practice", "Computer Fate acts after each turn in this solo trainer. Your own Fate action is practice self-Fate; at a human table it targets another villain. A revealed Peter Pan must be placed at Hangman’s Tree, even while locked. A Give Them a Scare peek is not a reveal.");
  add("locality", "Placement in this trainer", "Ordinary Allies and Items played from hand land where the captain stands. Attached Items use their own targets. Move Ally/Item or Move a Hero moves the selected piece one adjacent unlocked shore; moving the captain does not move other cards. Some of these restrictions differ from the published tabletop game.");
  if (LOCATION_IDS.some((id) => state.locations[id].heroes.some((hero) => hero.defId === "tickTock"))) {
    add("ticktock", "Tick Tock’s exact trigger", "Your hand is discarded only when the captain moves onto Tick Tock’s location. Seating Tick Tock on the captain, or moving Tick Tock onto the captain, does not discard the hand.");
  }
  if (state.pending?.kind === "fateReport") {
    add("report", "What Fate actually did", `${state.pending.note} ${state.pending.abilityText ?? ""}`);
  }
  for (const card of state.hand) {
    const d = def(card.defId);
    add(`hand:${card.instanceId}`, `In hand: ${d.name}`, `${d.name} is a ${d.type} costing ${d.cost} Power. ${d.text}`);
  }
  for (const id of LOCATION_IDS) {
    const location = state.locations[id];
    for (const hero of location.heroes) {
      const d = def(hero.defId);
      const attachments = attachmentsOn(state, hero.instanceId);
      const attached = attachments.map((card) => def(card.defId).name);
      const changes: string[] = [];
      const dust = attachments.filter((card) => card.defId === "pixieDust").length;
      if (dust) changes.push(`+${dust * 2} from Pixie Dust`);
      if (hero.defId === "john" && attachments.length) changes.push("+1 from John’s attached-Item ability");
      if (hero.defId === "michael") changes.push(`+${locationsWithHeroes(state)} from shores containing Heroes`);
      if (hero.defId !== "wendy" && LOCATION_IDS.some((shore) => state.locations[shore].heroes.some((card) => card.defId === "wendy"))) changes.push("+1 because Wendy is in the realm");
      add(`hero:${hero.instanceId}`, `${d.name} at ${locName(id)}`, `Current Strength: ${heroStrength(state, hero)}. Printed Strength: ${d.strength}.${changes.length ? ` Changes: ${changes.join("; ")}.` : ""} ${d.text}${attached.length ? ` Attachments: ${attached.join(", ")}.` : ""}`);
    }
    for (const ally of location.allies) {
      const d = def(ally.defId);
      const attachments = attachmentsOn(state, ally.instanceId);
      const attached = attachments.map((card) => def(card.defId).name);
      const changes: string[] = [];
      if (ally.defId === "smee" && id === "jollyRoger") changes.push("+2 because Smee is at the Jolly Roger");
      const cutlasses = attachments.filter((card) => card.defId === "cutlass").length;
      if (cutlasses) changes.push(`+${cutlasses * 2} from Cutlass`);
      const temporary = state.tempStrength[ally.instanceId] ?? 0;
      if (temporary) changes.push(`${temporary >= 0 ? "+" : ""}${temporary} temporary Strength this turn`);
      add(`ally:${ally.instanceId}`, `${d.name} at ${locName(id)}`, `Current Strength: ${allyStrength(state, ally)}. Printed Strength: ${d.strength}.${changes.length ? ` Changes: ${changes.join("; ")}.` : ""} ${d.text}${attached.length ? ` Attachments: ${attached.join(", ")}.` : ""}`);
    }
    for (const item of location.items) {
      const d = def(item.defId);
      add(`item:${item.instanceId}`, `${d.name} at ${locName(id)}`, d.text);
    }
  }
  const actions = availableActions(state).filter((action) => action.available).map((action) => action.label);
  if (actions.length) add("actions", "Open actions here", `Available now: ${actions.join(", ")}. An open action is still subject to its legal targets, costs, and confirmation.`);
  const kept = facts.slice(0, 64);
  // The public position signature changes whenever any offered fact changes.
  const serialized = JSON.stringify(kept);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index++) hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
  return { position: `${state.turn}-${state.phase}-${hash >>> 0}`, facts: kept };
}

/** Model text is never displayed. Only exact, current engine facts may be selected. */
export function checkedTutorSelection(value: unknown, context: TutorContext): TutorSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "answerable" && key !== "factIds")) return null;
  if (typeof record.answerable !== "boolean" || !Array.isArray(record.factIds)) return null;
  const ids: unknown[] = record.factIds;
  if (ids.length > 3 || (record.answerable && ids.length === 0) || (!record.answerable && ids.length !== 0)) return null;
  const allowed = new Set(context.facts.map((fact) => fact.id));
  if (!ids.every((id): id is string => typeof id === "string" && allowed.has(id))) return null;
  if (new Set(ids).size !== ids.length) return null;
  return { answerable: record.answerable, factIds: ids };
}
