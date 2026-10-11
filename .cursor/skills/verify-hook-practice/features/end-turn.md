# End the turn

Ending the turn refills the hand to four cards and lets the computer play one Fate card. The reveal stays up until the player chooses Continue.

## Sub-features

- `end-refill` draws back to four cards.
- `end-fate` opens the Fate dialog.
- `end-continue` returns the board to the next required move.

## How to get to it (user POV)

- During the action stretch, choose **End turn** in the prompt bar.
- On the Fate dialog, choose **Continue**.

## Driving it with verify.mjs

Preconditions:

- Doctor is ok.
- The captain has already moved, so the phase is actions. On the tutorial, that is after the Skull Rock move and the Gain.

- **End the turn.** Click `[data-end]`. A dialog `[data-dialog="fate-title"]` appears and its heading is visible.
- **Read it.** The dialog text names the Fate card. Do not treat the board underneath as the result yet.
- **Continue.** Click `[data-ack]`. The dialog closes. The prompt asks for a move, and the current shore is no longer the only thing that changed. Turn text in the top bar advances.

There is no `drive` subcommand for this feature yet. Save screenshots of the open dialog and the board after Continue under `verification-evidence/end-turn/`.

## Gotchas

- **End turn** during the required move does nothing. Move first.
- The Fate dialog does not dismiss itself. A screenshot of the board taken while the dialog is open is not the post-Fate state.
- Easy and Normal both play Peter Pan when he is one of the two revealed cards.
