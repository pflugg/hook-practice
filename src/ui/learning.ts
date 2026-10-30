import type { GameState } from "../engine/types";
import type { LessonStep } from "../engine/lesson";
import { lessonClashBoard, lessonOpening } from "../engine/lesson";
import { hourEqualVanquishScene, nearWinScene } from "../engine/scenes";

/** Learning activities use existing starting boards and the unchanged game reducer. */
export interface PracticeDrill {
  id: string;
  title: string;
  skill: string;
  task: string;
  takeaway: string;
  open: () => GameState;
  complete: (state: GameState) => boolean;
}

export const PRACTICE_DRILLS: readonly PracticeDrill[] = [
  {
    id: "equal-strength",
    title: "Make the numbers work",
    skill: "Combat · one decision",
    task: "Defeat Tinker Bell at the Jolly Roger using the Swashbuckler. Is equal Strength enough?",
    takeaway: "Equal Strength is enough to vanquish. The Hero and the Allies you use are discarded; you do not need to overpay with extra crew.",
    open: hourEqualVanquishScene,
    complete: (state) => state.voyage.lastClash?.heroName === "Tinker Bell",
  },
  {
    id: "escort",
    title: "Bring Peter aboard",
    skill: "Planning · one escort step",
    task: "Peter is at Skull Rock. Use the Ingenious Device’s Move a Hero action to bring him to the Jolly Roger. Leave the waiting crew in place.",
    takeaway: "Moving Hook and moving a Hero are different actions. An Item can add the escort action you need. Peter must reach the ship before the winning clash.",
    open: nearWinScene,
    complete: (state) => state.peterPanLocation === "jollyRoger" && !state.lost,
  },
  {
    id: "ship-clash",
    title: "Finish the voyage",
    skill: "Objective · assemble the clash",
    task: "Peter is aboard at Strength 8. Choose Vanquish, select Peter, commit the crew you need, and confirm the winning clash.",
    takeaway: "Check the location, the Hero’s current Strength, and your selected Allies before confirming. Two Pirate Brutes total 8: enough for an unbuffed Peter.",
    open: () => lessonClashBoard(lessonOpening()),
    complete: (state) => state.won,
  },
];

export const LESSON_INSIGHTS: Record<LessonStep, string> = {
  move: "Choose your toolbox: Hook must move to a different unlocked shore before using its actions.",
  gain: "Power pays for cards. Your 3 Power plus Gain 1 covers the Map’s cost of 4.",
  play: "An action lets you play one card; paying its cost completes the play. The Map permanently opens the tree.",
  fate: "Read what changed before continuing. This solo adversary Fates you every turn; humans choose whether to Fate.",
  escort: "Move a Hero shifts Peter one adjacent shore. It does not move Hook. You are bringing Peter toward the ship.",
  clash: "Lesson setup: we skipped the remaining walk and placed two Brutes on the ship. Choose both: 4 + 4 meets Peter’s 8.",
};

export const TABLE_HABITS = [
  ["Fate another villain", "At a human table your Fate action targets an opponent. Here it is practice self-Fate, and the computer Fates you after every turn."],
  ["Place cards across your realm", "The published rules generally let you play Allies and Items to any unlocked location. This trainer restricts them to Hook’s location; attached Items follow their own targeting rules."],
  ["Watch other players’ turns", "Printed Cunning and Obsession use opponents’ turns and their printed triggers. This solo trainer rewrites those triggers for your own turn."],
  ["Race people, not a meter", "The rival track is a solo practice clock. In a human game, watch each opponent’s objective and decide when to interfere."],
  ["Keep Peter’s destination in mind", "Only defeating Peter at the Jolly Roger wins. This trainer ends the voyage if you defeat him elsewhere; the table game does not impose that instant loss."],
] as const;
