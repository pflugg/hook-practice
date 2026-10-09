# Pay for the Map

The tutorial puts the Never Land Map in hand. Playing it at Skull Rock costs 4 Power and unlocks Hangman's Tree.

## Sub-features

- `map-gain` takes the Gain action so Power can cover the Map.
- `map-play` selects the Map and pays with Power.
- `map-unlock` removes the lock from Hangman's Tree.

## How to get to it (user POV)

- Choose **Tutorial**.
- Move to Skull Rock.
- Choose the Gain action on Skull Rock.
- Choose **Play a Card**, then the Never Land Map, then **Pay 4 Power**.

## Driving it with verify.mjs

Preconditions:

- Doctor is ok.
- The tutorial move in [Tutorial first move](./tutorial.md) is already done, and the Gain action has been taken. Power shows 4.

- **Start the play.** Click the legal `[data-act]` whose text is `Play a Card`.
- **Choose the Map.** Click the hand card whose accessible name starts with `Never Land Map`. The next step asks for a place. Payment is not open yet.
- **Choose the shore.** Click the prompt button named `Choose this place: Skull Rock`, or `[data-loc="skullRock"] [data-move="skullRock"]`.
- **Pay.** Click `[data-pay-power]`. The button text is `Pay 4 Power`.
- **Proof.** The Map card is inside `[data-loc="skullRock"]`. `[data-loc="hangmansTree"]` no longer has class `is-locked`. The Map is not played onto the tree.

There is no `drive` subcommand for this feature yet. Save the locked tree and the unlocked tree under `verification-evidence/pay-map/`.

## Gotchas

- The Map costs 4. The lesson starts at 3 Power, so Gain 1 comes before the payment.
- **Discard the Map** is a different button, `[data-pay-map]`. This recipe uses `[data-pay-power]`.
- Playing the Map does not move the captain to Hangman's Tree.
