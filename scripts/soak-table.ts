/**
 * Print per-mode, per-difficulty totals from soak JSON files.
 *
 *   npx vite-node scripts/soak-table.ts -- /tmp/hook-soak/captain.json /tmp/hook-soak/tutor.json
 */
import { readFileSync } from "node:fs";
import { RIVAL_GOAL, RIVAL_STEP } from "../src/engine/rival";
import type { Difficulty } from "../src/engine/types";

interface Row {
  seed: number;
  difficulty: Difficulty;
  result: string;
  finish: string;
  turns: number;
  rivalProgress: number;
  deadTurns: number;
  forcedMoves: number;
  coachMissing: number;
  coachIllegal: number;
  coachFollowed: number;
  coachFallback: number;
  detail: string;
}

interface Summary {
  mode?: string;
  rows: Row[];
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function pack(rows: Row[], difficulty: Difficulty) {
  const group = rows.filter((row) => row.difficulty === difficulty);
  const turns = group.map((row) => row.turns).sort((a, b) => a - b);
  const finished = group.filter((row) => row.result === "win" || row.result === "loss");
  const wins = group.filter((row) => row.result === "win");
  const rival = group.filter((row) => row.finish === "rival");
  const close = wins.filter((row) => RIVAL_GOAL - row.rivalProgress <= RIVAL_STEP[difficulty] * 2);
  const blowout = wins.filter((row) => row.rivalProgress * 2 <= RIVAL_GOAL);
  const deadGames = group.filter((row) => row.deadTurns > 0);
  const pure = group.filter((row) => row.coachFallback === 0 && row.result !== "crash");
  const pureWins = pure.filter((row) => row.result === "win");
  return {
    games: group.length,
    wins: wins.length,
    losses: group.filter((row) => row.result === "loss").length,
    rival: rival.length,
    offship: group.filter((row) => row.finish === "offship").length,
    stalls: group.filter((row) => row.result === "stall").length,
    crashes: group.filter((row) => row.result === "crash").length,
    invariant: group.filter((row) => row.result === "invariant").length,
    medianTurns: quantile(turns, 0.5),
    p25: quantile(turns, 0.25),
    p75: quantile(turns, 0.75),
    minTurns: turns[0] ?? 0,
    maxTurns: turns[turns.length - 1] ?? 0,
    avgRivalOnWin: wins.length ? Math.round(wins.reduce((sum, row) => sum + row.rivalProgress, 0) / wins.length) : 0,
    closeWins: close.length,
    blowoutWins: blowout.length,
    deadGames: deadGames.length,
    deadTurns: group.reduce((sum, row) => sum + row.deadTurns, 0),
    forcedMoves: group.reduce((sum, row) => sum + (row.forcedMoves ?? 0), 0),
    coachMissing: group.reduce((sum, row) => sum + row.coachMissing, 0),
    coachIllegal: group.reduce((sum, row) => sum + row.coachIllegal, 0),
    coachFollowed: group.reduce((sum, row) => sum + row.coachFollowed, 0),
    coachFallback: group.reduce((sum, row) => sum + row.coachFallback, 0),
    gamesWithMissing: group.filter((row) => row.coachMissing > 0).length,
    gamesWithIllegal: group.filter((row) => row.coachIllegal > 0).length,
    pureGames: pure.length,
    pureWins: pureWins.length,
    finished: finished.length,
  };
}

const paths = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (paths.length === 0) throw new Error("pass soak JSON paths");
for (const path of paths) {
  const summary = JSON.parse(readFileSync(path, "utf8")) as Summary;
  console.log(`\n${path} mode=${summary.mode ?? "?"}`);
  for (const difficulty of ["easy", "normal"] as const) {
    console.log(difficulty, JSON.stringify(pack(summary.rows, difficulty)));
  }
}
