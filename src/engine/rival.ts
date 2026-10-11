import type { Difficulty } from "./types";

export const RIVAL_GOAL = 154;

export const RIVAL_STEP: Record<Difficulty, number> = {
  easy: 1,
  normal: 2,
};

export const RIVAL_FATE_PUSH = {
  taunt: 1,
  splittingHeadache: 1,
  pixieDust: 1,
} as const;

export function fatePush(defId: string | undefined): number {
  if (defId === "taunt" || defId === "splittingHeadache" || defId === "pixieDust") {
    return RIVAL_FATE_PUSH[defId];
  }
  return 0;
}

export const RIVAL_LOSE_REASON =
  "The rival villain reached their objective before Captain Hook vanquished Peter Pan at the Jolly Roger.";

export function rivalGain(difficulty: Difficulty, playedDefId: string | undefined): number {
  return RIVAL_STEP[difficulty] + fatePush(playedDefId);
}
