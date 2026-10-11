import type { Difficulty } from "./types";

export const RIVAL_GOAL = 154;

export const EASY_RIVAL_GOAL = 74;

export const TUTOR_RIVAL_GOAL = 222;

export const RIVAL_STEP: Record<Difficulty, number> = {
  easy: 1,
  normal: 2,
};

export const TUTOR_RIVAL_STEP: Record<Difficulty, number> = {
  easy: 1,
  normal: 1,
};

export function rivalStep(difficulty: Difficulty, coachOn: boolean): number {
  return coachOn ? TUTOR_RIVAL_STEP[difficulty] : RIVAL_STEP[difficulty];
}

export function rivalGoal(coachOn: boolean, difficulty: Difficulty): number {
  if (coachOn) return TUTOR_RIVAL_GOAL;
  return difficulty === "easy" ? EASY_RIVAL_GOAL : RIVAL_GOAL;
}

export const RIVAL_FATE_PUSH = {
  taunt: 1,
  splittingHeadache: 0,
  pixieDust: 3,
} as const;

export const TUTOR_FATE_PUSH = {
  taunt: 1,
  splittingHeadache: 1,
  pixieDust: 1,
} as const;

export function fatePush(defId: string | undefined, coachOn = false): number {
  const table = coachOn ? TUTOR_FATE_PUSH : RIVAL_FATE_PUSH;
  if (defId === "taunt" || defId === "splittingHeadache" || defId === "pixieDust") {
    return table[defId];
  }
  return 0;
}

export const RIVAL_LOSE_REASON =
  "The rival villain reached their objective before Captain Hook vanquished Peter Pan at the Jolly Roger.";

export function rivalGain(difficulty: Difficulty, playedDefId: string | undefined, coachOn = false): number {
  return rivalStep(difficulty, coachOn) + fatePush(playedDefId, coachOn);
}
