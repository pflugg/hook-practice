# Vanquish on the ship

The tutorial's last beat places Peter Pan on the Jolly Roger with two Pirate Brutes. Vanquishing him there wins. Vanquishing him anywhere else loses.

## Sub-features

- `clash-open` names Peter as the Hero.
- `clash-allies` spends both Pirate Brutes.
- `clash-win` ends the voyage as a win when Strength is equal.

## How to get to it (user POV)

- Finish the tutorial beats until the lesson places the clash on the Jolly Roger.
- Choose **Vanquish**.
- Choose Peter Pan, then each Pirate Brute, then **Confirm**.

## Driving it with verify.mjs

Preconditions:

- Doctor is ok.
- The board is the lesson clash. Peter and two Pirate Brutes are at `[data-loc="jollyRoger"]`, and that shore is `is-current`.

- **Open Vanquish.** Click the `[data-act]` whose text is `Vanquish`.
- **Name Peter.** Click the Peter Pan card at the Jolly Roger.
- **Spend the crew.** Click each Pirate Brute card, then `[data-confirm]`.
- **Proof.** A dialog `[data-recap]` is visible and its heading states the win. `[data-lesson-sail]` offers **Begin a normal voyage**.

There is no `drive` subcommand for this feature yet. Save the clash and the recap under `verification-evidence/vanquish/`.

## Gotchas

- Equal Strength wins. The lesson uses 8 against 8. Do not add a third Ally.
- Confirming a Peter clash away from the Jolly Roger loses on purpose. This recipe stays on the ship.
- The recap is the proof. A Strength meter that says ready is not the win.
