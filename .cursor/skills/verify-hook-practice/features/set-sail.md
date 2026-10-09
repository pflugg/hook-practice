# Set sail

Set Sail deals a shuffled voyage. The captain starts at the Jolly Roger and must move before using a location action.

## Sub-features

- `sail-deal` leaves the title screen on a dealt board.
- `sail-must-move` rejects End turn until the captain moves.

## How to get to it (user POV)

- On the title screen, choose **Set Sail**.
- Choose **Easy** or **Normal** before **Set Sail** to set the computer Fate policy.

## Driving it with verify.mjs

Preconditions:

- Doctor is ok and the browser is on the title screen.

- **Deal.** Choose **Set Sail**. Click `[data-start]`. `[data-loc="jollyRoger"]` has `is-current`. The hand shows four cards.
- **Stay put.** `[data-end]` is absent during the required move. That absence is the proof. Do not invent a click.
- **Move.** Click the prompt button named `Move here: Skull Rock`, or `[data-loc="skullRock"] [data-move="skullRock"]`. That shore gains `is-current` and the Jolly Roger loses it. `[data-end]` is then visible.

There is no `drive` subcommand for this feature yet. Follow the clicks above with the same Playwright page `launch` served. Save screenshots under `verification-evidence/set-sail/`.

## Gotchas

- A `?scene=` query loads a fixture instead of a shuffled deal. Open the bare dev URL.
- Hangman's Tree is locked until the Never Land Map is played. It is not a legal first move.
