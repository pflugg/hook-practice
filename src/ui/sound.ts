import { rivalGoal, rivalStep } from "../engine/rival";
import { LOCATION_IDS, type GameState } from "../engine/types";

export type Cue = "play" | "move" | "vanquish" | "fate" | "rival" | "win" | "loss";

const SOUND_KEY = "nld-sound";

/** Same 16-turn window the coach uses for a rival warning. */
export const RIVAL_WARNING_TURNS = 16;

type Tone = {
  type: OscillatorType;
  freq: number;
  at: number;
  dur: number;
  gain: number;
};

const VOICES: Record<Cue, Tone[]> = {
  move: [{ type: "sine", freq: 196, at: 0, dur: 0.09, gain: 0.05 }],
  play: [
    { type: "triangle", freq: 523, at: 0, dur: 0.08, gain: 0.045 },
    { type: "triangle", freq: 784, at: 0.07, dur: 0.1, gain: 0.04 },
  ],
  vanquish: [
    { type: "triangle", freq: 392, at: 0, dur: 0.08, gain: 0.05 },
    { type: "triangle", freq: 311, at: 0.07, dur: 0.08, gain: 0.045 },
    { type: "triangle", freq: 247, at: 0.14, dur: 0.12, gain: 0.04 },
  ],
  fate: [
    { type: "sine", freq: 466, at: 0, dur: 0.28, gain: 0.04 },
    { type: "sine", freq: 349, at: 0, dur: 0.28, gain: 0.03 },
  ],
  rival: [
    { type: "sine", freq: 880, at: 0, dur: 0.05, gain: 0.03 },
    { type: "sine", freq: 988, at: 0.12, dur: 0.06, gain: 0.028 },
  ],
  win: [
    { type: "triangle", freq: 523, at: 0, dur: 0.16, gain: 0.045 },
    { type: "triangle", freq: 659, at: 0.12, dur: 0.16, gain: 0.045 },
    { type: "triangle", freq: 784, at: 0.24, dur: 0.22, gain: 0.04 },
  ],
  loss: [
    { type: "sine", freq: 392, at: 0, dur: 0.18, gain: 0.04 },
    { type: "sine", freq: 330, at: 0.16, dur: 0.18, gain: 0.038 },
    { type: "sine", freq: 262, at: 0.32, dur: 0.24, gain: 0.035 },
  ],
};

let armed = false;
let ctx: AudioContext | null = null;

export function soundMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "0";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, muted ? "0" : "1");
  } catch {
    /* storage can be unavailable */
  }
}

export function soundArmed(): boolean {
  return armed;
}

export function resetSoundForTests(): void {
  armed = false;
  ctx = null;
}

function audioConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (typeof window.AudioContext === "function") return window.AudioContext;
  const legacy = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return typeof legacy === "function" ? legacy : undefined;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = audioConstructor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

export function armSound(): void {
  armed = true;
  if (soundMuted()) return;
  const context = ensureContext();
  if (context && context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
}

function playVoice(context: AudioContext, cue: Cue): void {
  const now = context.currentTime;
  for (const tone of VOICES[cue]) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, now + tone.at);
    gain.gain.setValueAtTime(0.0001, now + tone.at);
    gain.gain.exponentialRampToValueAtTime(tone.gain, now + tone.at + 0.012);
    const end = now + tone.at + tone.dur;
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, now + tone.at + 0.02));
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now + tone.at);
    osc.stop(end + 0.02);
  }
}

export function playCue(cue: Cue): void {
  if (!armed || soundMuted()) return;
  const context = ensureContext();
  if (!context) return;
  const run = () => {
    if (context.state !== "running") return;
    playVoice(context, cue);
  };
  if (context.state === "running") run();
  else void context.resume().then(run).catch(() => undefined);
}

function heroCount(state: GameState): number {
  return LOCATION_IDS.reduce((n, id) => n + state.locations[id].heroes.length, 0);
}

function realmPieces(state: GameState): number {
  return LOCATION_IDS.reduce((n, id) => n + state.locations[id].allies.length + state.locations[id].items.length, 0);
}

export function rivalInWarningBand(state: GameState): boolean {
  const goal = rivalGoal(state.coachOn, state.difficulty);
  const step = rivalStep(state.difficulty, state.coachOn);
  const remaining = goal - state.rivalProgress;
  return state.rivalProgress > 0 && remaining > 0 && remaining <= step * RIVAL_WARNING_TURNS;
}

function computerFateOpened(before: GameState, after: GameState): boolean {
  const next = after.pending;
  if (next?.kind !== "fateReport" || next.resume !== "nextTurn") return false;
  const prev = before.pending;
  return !(prev?.kind === "fateReport" && prev.resume === "nextTurn");
}

function cardPlayed(before: GameState, after: GameState): boolean {
  if (after.hand.length >= before.hand.length) return false;
  return realmPieces(after) > realmPieces(before) || after.villainDiscard.length > before.villainDiscard.length;
}

export function cueFromTransition(before: GameState, after: GameState): Cue | null {
  if (before === after) return null;
  if (after.phase === "over" && before.phase !== "over") return after.won ? "win" : "loss";
  if (computerFateOpened(before, after)) return "fate";
  if (heroCount(after) < heroCount(before)) return "vanquish";
  if (cardPlayed(before, after)) return "play";
  if (after.villainLocation !== before.villainLocation) return "move";
  if (!rivalInWarningBand(before) && rivalInWarningBand(after)) return "rival";
  return null;
}
