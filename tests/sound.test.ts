/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from "vitest";
import type { GameState } from "../src/engine/types";
import { barePlayState, inst, putHero } from "./helpers";
import { armSound, cueFromTransition, playCue, resetSoundForTests, setSoundMuted, soundMuted } from "../src/ui/sound";

function copy(state: GameState): GameState {
  return structuredClone(state);
}

class FakeParam {
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeNode {
  type: OscillatorType = "sine";
  frequency = new FakeParam();
  gain = new FakeParam();
  connect(): void {}
  start(): void {
    starts += 1;
  }
  stop(): void {}
}

let constructed = 0;
let starts = 0;

class FakeAudio {
  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = new FakeNode();
  constructor() {
    constructed += 1;
  }
  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }
  createOscillator(): FakeNode {
    return new FakeNode();
  }
  createGain(): FakeNode {
    return new FakeNode();
  }
}

describe("original WebAudio cues", () => {
  beforeEach(() => {
    constructed = 0;
    starts = 0;
    localStorage.clear();
    resetSoundForTests();
    Object.defineProperty(window, "AudioContext", { configurable: true, writable: true, value: FakeAudio });
  });

  it("does not construct an audio context until the first gesture arms it", () => {
    playCue("move");
    expect(constructed).toBe(0);
    armSound();
    expect(constructed).toBe(1);
    playCue("play");
    expect(starts).toBeGreaterThan(0);
  });

  it("remembers mute and stays silent while muted", () => {
    armSound();
    playCue("move");
    const heard = starts;
    expect(heard).toBeGreaterThan(0);
    setSoundMuted(true);
    expect(localStorage.getItem("nld-sound")).toBe("0");
    expect(soundMuted()).toBe(true);
    playCue("win");
    expect(starts).toBe(heard);
  });

  it("names the cue for a move, a play, a vanquish, and a computer Fate", () => {
    const base = barePlayState();
    const moved = copy(base);
    moved.villainLocation = "skullRock";
    expect(cueFromTransition(base, moved)).toBe("move");

    const played = copy(base);
    played.hand = [inst("cutlass"), inst("cunning")];
    const afterPlay = copy(played);
    afterPlay.hand = [played.hand[0]!];
    afterPlay.villainDiscard = [played.hand[1]!];
    expect(cueFromTransition(played, afterPlay)).toBe("play");

    const stocked = copy(base);
    putHero(stocked, "wendy", "skullRock");
    const felled = copy(stocked);
    felled.locations.skullRock.heroes = [];
    expect(cueFromTransition(stocked, felled)).toBe("vanquish");

    const fated = copy(base);
    fated.pending = {
      kind: "fateReport",
      drawn: [],
      discarded: [],
      note: "Fate",
      abilityText: "",
      resume: "nextTurn",
    };
    expect(cueFromTransition(base, fated)).toBe("fate");

    const self = copy(base);
    self.pending = { ...fated.pending, resume: "actions" };
    expect(cueFromTransition(base, self)).toBeNull();
    expect(cueFromTransition(fated, copy(fated))).toBeNull();
  });

  it("lets the voyage end outrank a vanquish, and the rival sting only on entering the band", () => {
    const base = barePlayState();
    base.coachOn = false;
    base.difficulty = "normal";
    putHero(base, "peterPan", "jollyRoger");
    const won = copy(base);
    won.phase = "over";
    won.won = true;
    won.locations.jollyRoger.heroes = [];
    expect(cueFromTransition(base, won)).toBe("win");

    const near = copy(base);
    near.rivalProgress = 120;
    const lost = copy(near);
    lost.phase = "over";
    lost.lost = true;
    lost.rivalProgress = 154;
    expect(cueFromTransition(near, lost)).toBe("loss");

    const entering = copy(base);
    entering.rivalProgress = 124;
    const beforeBand = copy(base);
    beforeBand.rivalProgress = 120;
    expect(cueFromTransition(beforeBand, entering)).toBe("rival");
    const deeper = copy(entering);
    deeper.rivalProgress = 126;
    expect(cueFromTransition(entering, deeper)).toBeNull();

    const dealt = copy(base);
    dealt.hand = [inst("smee")];
    expect(cueFromTransition(base, dealt)).toBeNull();
  });
});
