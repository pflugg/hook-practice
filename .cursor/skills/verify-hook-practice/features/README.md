# Hook Practice verification map

This directory is the source for verifying what a player can do in Never Land Duel. Read this index, then use the feature file as the recipe.

## Baseline preconditions

- Launch with `node scripts/verify.mjs launch` so the app has its own port.
- Run `node scripts/verify.mjs doctor` and require `ok: true` before any click.
- Never drive a Vite server this run did not start.
- The page starts on the title screen. `Tutorial` and `Set Sail` are both visible.

## Driving conventions

- Start every recipe from the title screen unless its preconditions say otherwise.
- Prefer `data-tutorial`, `data-start`, `data-move`, `data-loc`, `data-act`, `data-card`, `data-end`, `data-ack`, and `data-pay-power`.
- The accessible name `Move here` is shared by every legal shore. Click the prompt button `Move here: Skull Rock`, or `[data-loc="skullRock"] [data-move="skullRock"]`. A bare `[data-move="skullRock"]` matches both buttons.
- Treat every command as literal.

## Proof and skip reporting

- Capture the click and the resulting board state, not only the last screen.
- UI proof includes `proof.json` plus the before and after screenshots.
- Record the feature id with every artifact.
- Report an unreachable path with the command you ran and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph. It then uses these four H2 sections in order.

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with verify.mjs`
4. `Gotchas`

## Features

- [Tutorial first move](./tutorial.md) moves the captain from the Jolly Roger to Skull Rock on the staged first voyage.
- [Set sail](./set-sail.md) deals a normal voyage and requires a move before any action.
- [End the turn](./end-turn.md) refills the hand and makes the computer play Fate.
- [Pay for the Map](./pay-map.md) spends Power to play the Never Land Map during the tutorial.
- [Vanquish on the ship](./vanquish.md) wins the tutorial clash when Ally Strength meets Peter.
