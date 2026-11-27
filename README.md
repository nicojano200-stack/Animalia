# Animalia

A charming 2D animal platformer set in a colorful meadow. Play as a hamster, learn agile movement, collect food, and bring it home. The current version (1.5) features an introductory adventure, expressive emotes, Shaman mode, and free practice.

## Play

Download or clone this repository and open `index.html` in your browser. For a standalone version, run `python build-standalone.py Animalia_Play.html` and open the generated file.

1. Click Next on the welcome panel.
2. Walk left for 2 seconds (A), right for 2 seconds (D), and land after jumping at both glowing markers (W). The first marker is on the ground, the second on the block. Walking time counts actual grounded movement, and each marker counts once. Hold W for a higher jump.
3. After all tasks, the game temporarily locks movement and performs a 5.4-second camera reveal: golden acorn, hamster hole, then back to the player. Both objects are hidden until their reveal.
4. Collect the golden acorn and carry it to the hamster hole. A completion panel and confetti appear; Click Next to enter Tutorial 02: Meadow Discovery. Grab and release the vine, then try grass, ice, the purple trampoline, chocolate and wood. Finish all six tasks to unlock free practice. Press R to restart the current lesson.

## Controls

A/D or Left/Right: walk. W: jump (Space and Up no longer jump). Shift: roll. Tab: Shaman mode; 1–4 select magic and click to place. 1–0: hamster emotes in Hamster mode. /: chat; Enter sends and Esc cancels. R: restart. Esc: pause. F1: movement lab. F2: debug. Mobile movement and W jump buttons remain available. E is retained for future vine maps. Chat and mode changes are temporarily disabled during the welcome and camera reveal; normal play restores them.

## Level and implementation

`levels/tutorial-01.json` defines an 1800 × 540 map with the original grass block and a longer floor so two-second walks fit comfortably. `jumpTargets` describes the two landing areas; `acorn` and `hole` define the delayed quest. `src/tutorial.js` implements the fixed-step tutorial state and camera interpolation. `src/main.js` integrates the state, objective collision, effects and camera; `src/ui.js` renders task progress. The existing character art, physics, backgrounds, chat, emotes, Shaman objects, and tuning values remain available. Tutorial completion does not award adventure medals or timed records.

## GitHub Pages

1. Open this repository’s Settings → Pages.
2. Select Deploy from a branch, `main`, `/ (root)`, and Save.
3. Open the published URL GitHub displays.

No build step is needed for the supplied project. After editing code or JSON, run `python build-offline.py` to regenerate the offline bundle; run `python build-standalone.py Animalia_Play.html` to regenerate a single-file version.

## Tests

Run `npm test` with Node.js (no dependencies). Both Classic and Snappy movement presets complete the tutorial, including the two marked landings, reveal sequence, acorn and home. Existing physics and asset tests also run. Optional: install Python Playwright and Chromium, then run `python browser-test.py /path/to/Animalia_Play.html`. This uses an instrumented in-memory copy with fixed-step advancement; the shipped game has no test hooks. Mobile-sized layout was checked, but real phone performance and touch playtesting remain unverified.
