---
name: verify-hook-practice
description: Drive the Never Land Duel Hook Practice web app in a browser and prove a user path. Use when changing play, the tutorial, Fate, or the board UI, or when asked to verify Hook Practice.
---

# Verify Hook Practice

Hook Practice is a Vite browser app. The player clicks the board. This skill starts one dev server, drives it with Playwright, and writes proof under `verification-evidence/`. That directory is gitignored. Cleanup stops the server this run started. It does not delete the proof.

Two runs must not share a server. `launch` refuses to start a second process while its pid is still alive.

## Launch

From the repo root:

```bash
node scripts/verify.mjs launch
```

The command prints JSON with `url`, `pid`, and `port`. Ready means `GET` of that URL returns HTTP 200 and the HTML contains `id="app"` and `/src/main.ts`.

The dev server is `npx vite --host 127.0.0.1 --port <free> --strictPort`. State lives in `/tmp/hook-practice-verify/server.json`. The Vite log is `/tmp/hook-practice-verify/vite.log`.

## Doctor

```bash
node scripts/verify.mjs doctor
```

Doctor checks that the recorded pid is alive, the URL returns HTTP 200, and the body is the Vite page. If doctor fails, read `vite.log` and run `cleanup` before launching again. Do not drive a URL you did not launch.

## Drive

Stable handles are `data-*` attributes in `src/ui/app.ts`. A shore button and the prompt button can share `data-move`. Click the prompt button by its accessible name, `Move here: Skull Rock`, or scope the shore button as `[data-loc="skullRock"] [data-move="skullRock"]`. Do not use a bare `[data-move="skullRock"]`. Location ids are `jollyRoger`, `skullRock`, `mermaidLagoon`, and `hangmansTree`.

```bash
node scripts/verify.mjs drive tutorial-move
```

That command opens the recorded URL, clicks `[data-tutorial]`, clicks the button named `Move here: Skull Rock`, and checks that `[data-loc="jollyRoger"]` lost `is-current` and `[data-loc="skullRock"]` gained it. Proof is written to `verification-evidence/tutorial-move/`.

```text
verification-evidence/tutorial-move/before-move.png
verification-evidence/tutorial-move/after-move.png
verification-evidence/tutorial-move/proof.json
```

`proof.json` records the title, both class strings, and the prompt text after the move. A green exit code with `captainAtSkullRock: false` does not happen. The script exits 1.

Read `features/` before driving any other path. One convenient button is not proof of a path the map lists separately.

## Evidence

Exercise the click the player makes. Capture the screen before the click and after the resulting state. Do not call `applyInput` or other engine setters from this skill. The computer Fate deck and the villain deck are part of the app. Do not mock them.

## Cleanup

```bash
node scripts/verify.mjs cleanup
```

Cleanup sends `SIGTERM` to the process group of the pid in `server.json`, waits until that pid is gone, and fails if the URL still answers. It does not remove `verification-evidence/`. The dev server is `node node_modules/vite/bin/vite.js`, so the recorded pid is Vite.

One command runs the whole check:

```bash
node scripts/verify.mjs prove
```

`prove` cleans a stale server, launches, runs doctor, drives `tutorial-move`, cleans up, and checks that `proof.json` is still on disk.

## Helpers

`scripts/verify.mjs` is the only helper. Invoke it as `node scripts/verify.mjs <launch|doctor|drive|cleanup|prove>`. `drive` takes the feature id `tutorial-move`.
