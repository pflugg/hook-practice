# Hook Practice hammer scorecard

Hour-long headless play of the real engine and Coach, then fixes for the Must defects that play proved. The hour ran on unfixed `main`. The confirmation run below is the fixed tree.

## How it ran

Five Node workers, started together, each with a 60-minute wall-clock budget:

`npx vite-node scripts/hammer-worker.ts -- --worker N --ms 3600000 --out /tmp/hammer`

Each worker imports `createGame`, `applyInput`, and `advise` and cycles coach-easy, coach-normal, policy-easy, policy-normal, chaos-normal, and a scripted scene suite. Worker 0 also spawned `scripts/hammer-scenes.ts` (jsdom) at the start, about every 10 minutes, and at the end, booting `?scene=nearwin` and `?scene=tauntdig` through Set Sail.

| Worker | Elapsed | Games | Scene suites | Wins | Resigns |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 3,601,401 ms | 29,111 | 4,851 | 17,283 | 11,828 |
| 1 | 3,600,000 ms | 29,571 | 4,928 | 17,585 | 11,986 |
| 2 | 3,600,000 ms | 28,978 | 4,829 | 17,070 | 11,908 |
| 3 | 3,600,000 ms | 29,792 | 4,965 | 17,651 | 12,141 |
| 4 | 3,600,001 ms | 29,929 | 4,988 | 17,714 | 12,215 |

Finished 2026-09-23 about 01:22:55 UTC. Elapsed time is `Date.now()` against a 3,600,000 ms budget. This was engine and Coach play, plus a jsdom Set Sail probe. It was not a browser session on a Mac.

## Aggregate (unfixed main)

| | |
| --- | ---: |
| Games completed | 147,381 |
| Voyage games (`createGame`) | 122,820 (Easy 49,130, Normal 73,690) |
| Scripted near-win games | 24,561 |
| Scene suites | 24,561 |
| Steps | 49,796,904 |
| Coach calls | 71,772,154 |
| Wins | 87,303 (near-win 24,561, so about 62,742 voyage wins) |
| Losses | 0 |
| Off-ship Peter losses | 0 |
| Resigns at the turn cap | 60,078 |
| Easy Fate seated revealed Peter | 48,913 |
| Normal Fate seated revealed Peter | 105,285 |
| Equal-Strength vanquishes | 70,247 |
| Win recaps | 150,045 |
| Softlock scans | 4,074,603 |
| UI hydrations (near-win + taunt dig) | 14, all passed |

Voyage wins plus resigns equal the 122,820 `createGame` voyages. The resigns are the hammer’s turn cap (64, or 22 in chaos), not an engine that cannot win. Scripted near-win win rate was 24,561 / 24,561.

## Coverage

| Asked for | What the hour did |
| --- | --- |
| Easy Fate | 49,130 Easy voyages. When Peter was revealed he was seated (48,913), never buried. |
| Normal Fate | 73,690 Normal voyages. Same seating check (105,285). |
| `?scene=nearwin` | 24,561 scripted plays, 24,561 wins, plus 14 jsdom Set Sail hydrations (power 2, turn 8, tree unlocked, captain at Skull Rock). |
| `?scene=tauntdig` | 24,561 named Obsession discards at Skull Rock. Coach did not end the turn or walk back to the ship. 14 jsdom Set Sail hydrations. |
| Cutlass affordability | 24,561 scripted checks at 0 Power and with no Ally. No “Play Cutlass” / strap CTA finding. |
| Named Discard digs | 24,561 taunt-dig discards named the card. No bare-Discard finding. |
| Ship ↔ Skull Rock bounce / Obsession dig | 24,561 `bounceLoop` checks asked for Gain, not End. Live games also produced the bounce finding below. |
| Tick Tock walk-on only | 24,561 slides onto the captain did not snap. 24,561 walk-ons did. |
| Vanquish at equal Strength | 70,247 equal-Strength vanquishes, including the hour-equal scene (Tinker Bell 2 vs Swashbuckler 2). |
| Taunt / Fate teaching honesty | No taunt-silence finding. Fate copy that omits the practice self-Fate line did not fire. |
| Win + recap | 87,303 wins, 150,045 recap reads. Headline path “The ship is yours” stayed intact. |

No `advise` / `applyInput` / recap / brief crashes in the hour. No negative Power, duplicate ids beyond the census bug, captain on a locked tree, win off the ship, under-Strength vanquish, or one-Ally Lost Boys finish.

Practice adaptations already documented in `FIDELITY_AUDIT.md` and `RULES_NOTES.md` were treated as rules, not defects: solo always-Fate, practice self-Fate, Cunning and Obsession trigger rewrites, off-ship Peter as an instant loss, Scare with no remove-from-game pile, equal Strength is enough, Lost Boys need two Allies, Tick Tock snaps only when the captain moves onto the crocodile, Pixie Dust does not attach to Peter while Hangman’s Tree is locked.

## Must

### 1. Coach confirmed a Lost Boys clash the engine refuses — fix shipped

Count on the hour: **1,872,643** (`coach-noop`).

Lost Boys need two Allies even when one Ally’s Strength already matches. `vanquishClashMath` and the Confirm button already knew that. Coach’s ally step treated `selected Strength >= need` as ready and highlighted Confirm. Confirm logged “Lost Boys require at least two Allies” and returned the same state.

Hour sample: coach-easy, seed 1005985 (worker 0). Turn 3, Jolly Roger, pending `vanquishAllies`, Lost Boys plus one Pirate Brute. Coach: “Confirm the clash (click Confirm)” / “That is enough Strength.” Three Confirms in a row did nothing. A second sample used Smee (Strength 4 at the ship) the same way.

Deterministic repro is `tests/hammerMust.test.ts`: Lost Boys, Smee selected, Pirate Brute still available. Advice names the second Ally and does not say Confirm. Confirm itself leaves the boys on the ship. Two Allies then Confirm.

### 2. Cancel deleted a Hero or item that had already left its deck — fix shipped

Count on the hour: **2,795,198** (`card-census`).

Worthy Opponent, Fate attach, Fate location, Obsession, and Aye Aye Sir pull a card out of a deck and hold it on `heldCard` (Aye Aye has already discarded the effect and spent Power). Cancel cleared `pending` and left the card only on `heldCard`. The next Fate assignment overwrote `heldCard`, so the instance was in no zone. Aye Aye was worse: the same Cancel also cleared `actionKey`, refunding a Play that had already milled the effect.

Hour sample: chaos-normal, seed 1045865. Pending `fateChooseAttach`, missing `john-40` after `playOrDiscardHero`, Cancel, then another Fate. A second sample lost `tickTock-43` the same way.

Fix: those committed steps ignore Cancel. Aye Aye’s destination step goes back to ally choice and does not refund the action. The Cancel button is hidden for those prompts. Tests cover Worthy seating, Pixie Dust attach, and a paid Aye Aye Sir.

### 3. Live Cunning was skipped, then the free Ally step was told to End — fix shipped

Count on the hour: **227,840** (`coach-bounce-loop`).

With a Strength 4+ Hero ashore, Cunning and an Ally in hand, and nothing else payable, Coach ended the turn and said a Play was uncovered. The hand never changed, so the captain paced Jolly Roger ↔ Skull Rock. Replay of `createGame("easy", 2023934)` following Coach: by turn 8 at the Jolly Roger, Power 0, hand Never Land Map, Cunning, Boarding Party, Mr. Starkey, actions Play and Move a Hero. Coach: “End the turn” / “No Discard, Gain, or Play is left uncovered.”

The first fix offers Cunning before other actions, and still vanquishes Peter first when that clash is ready. Obsession is offered only when the stretch would otherwise end, so a named Discard of a dead card still wins when Peter is hidden and Cunning is not live.

A 45-second confirmation then showed the follow-through bug: after Accept, Coach said “Play Pirate Brute for free” while Power could not pay the Brute. The affordability guard rewrote that into “End the turn.” End Turn during `cunningAlly` does not change the board (808 no-ops and 2,566 bounce marks in that 45-second pass). The Ally line is now “Slip {Ally} ashore for free,” and the affordability guard does not treat a Cunning drop as an unpaid Power play.

The hour’s bounce counter also marked a Discard as “took nothing” when the action was spent on Confirm rather than on the action click. The confirmation detector counts any action that actually gets used. After both fixes, bounce, noop, and census were **0**. See Confirmation.

## Should

### Banish copy says the Hero leaves the realm — not fixed

Count on the hour: **2,721** (`banish-means-discard`). Confirmation added 53 more.

Obsession on Tick Tock: “Banish Tick Tock” / “Send him out of the realm.” The engine discards him into the Fate discard, so he can return. `FIDELITY_AUDIT.md` already grades this Should. Copy was left alone.

Sample: policy-normal, seed 1014958, pending `obsessionDecide`.

### Hour-equal scene strapped Pixie Dust to a locked-tree Peter — fix shipped

`hourEqualVanquishScene` (`?scene=hourequal`) attached Pixie Dust to Peter while `hangmansUnlocked` was false. Live Fate already refuses that attach (`canAttachFateItem`). The fixture now puts the dust in the Fate discard. The equal-Strength clash in that scene is unchanged (Tinker Bell 2 vs Swashbuckler 2).

## Nice

None.

## Confirmation (fixed tree)

Five workers, 25-second budget, same script, after the three Must fixes:

| | |
| --- | ---: |
| Elapsed | 25,000–25,917 ms each |
| Games | 1,444 |
| Steps | 415,782 |
| Wins | 921 |
| Must findings | none |
| Should | banish copy, 53 |

An earlier 45-second pass on the half-fixed tree (Cunning suggested, free Ally step still rewritten to End) still recorded `coach-noop` 808 and `coach-bounce-loop` 2,566, and already recorded **zero** `card-census`. That is why the Ally wording and the affordability exception shipped before this clean pass.

## Checks

`npm test`: 30 files, 195 tests, passed. `npm run build`: `tsc --noEmit` and Vite build passed.

Cancel visibility was checked by rendering the play view in jsdom (`renderPlay` has no `data-cancel` on Worthy seating, Fate attach, and Aye Aye). A live browser walk of those mid-resolution prompts was not run.

No teaching-font floor was changed. No new card art or IP-heavy copy was added. “Slip ashore for free” names the practice Cunning trigger that `RULES_NOTES.md` already describes.
