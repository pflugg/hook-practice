# Sound

The cues in play are synthesized in the browser with the Web Audio API (`src/ui/sound.ts`). They are original tones: a short figure for playing a card, moving, vanquishing, the computer’s Fate, the rival track entering its warning band, a win, and a loss. No recordings are bundled, and nothing here is sampled from a commercial library.

Playback stays silent until the first click, key press, or card drag. The Sound button on the title screen and in the voyage bar stores the choice in `localStorage` under `nld-sound` (`1` on, `0` muted) so it survives a new visit. Levels sit well under a normal speaking voice.
