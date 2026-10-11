import type { Difficulty } from "./types";

/** Practice clock. One integer, not a second villain board. */
export const RIVAL_GOAL = 112;

export const RIVAL_STEP: Record<Difficulty, number> = {
  easy: 1,
  normal: 2,
};

/** Extra steps when the computer plays this Fate card at the end of Hook's turn. */
export const RIVAL_FATE_PUSH: Record<string, number> = {
  taunt: 1,
  splittingHeadache: 1,
  pixieDust: 1,
};

export const RIVAL_LOSE_REASON =
  "The rival villain reached their objective before Captain Hook vanquished Peter Pan at the Jolly Roger.";

export function rivalGain(difficulty: Difficulty, playedDefId: string | undefined): number {
  const push = playedDefId ? (RIVAL_FATE_PUSH[playedDefId] ?? 0) : 0;
  return RIVAL_STEP[difficulty] + push;
}
