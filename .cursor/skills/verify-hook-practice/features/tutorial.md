# Tutorial first move

Tutorial starts a staged voyage and asks the captain to move from the Jolly Roger to Skull Rock before any other action.

## Sub-features

- `tutorial-open` leaves the title screen on the staged board.
- `tutorial-move` moves the captain to Skull Rock.

## How to get to it (user POV)

- On the title screen, choose **Tutorial**.

## Driving it with verify.mjs

Preconditions:

- `node scripts/verify.mjs doctor` prints `ok: true`.
- The title screen is showing. `[data-tutorial]` is visible.

- **Open the lesson.** Choose **Tutorial**. Run a Playwright click on `[data-tutorial]`. The Jolly Roger location `[data-loc="jollyRoger"]` has class `is-current`. The prompt button is named `Move here: Skull Rock`.
- **Move.** Choose **Move here: Skull Rock** in the prompt, or **Move here** inside `[data-loc="skullRock"]`. The scripted proof clicks `getByRole("button", { name: "Move here: Skull Rock" })`. `[data-loc="skullRock"]` gains `is-current`. `[data-loc="jollyRoger"]` loses it.
- **Proof.** `node scripts/verify.mjs drive tutorial-move` writes `verification-evidence/tutorial-move/before-move.png`, `after-move.png`, and `proof.json`. `proof.json` has `captainAtSkullRock: true` and `leftTheShip: true`.

## Gotchas

- **Set Sail** deals a shuffled game. It is not the tutorial.
- Skull Rock and Mermaid Lagoon both have a shore button named **Move here**. The prompt button names the shore, `Move here: Skull Rock`. `[data-move="skullRock"]` matches both buttons, so it is not a strict locator.
- Hangman's Tree stays locked on this beat. It has no **Move here** button.
