# Animalia

A charming 2D animal platformer set in a colorful meadow. Play as a hamster, learn agile movement, collect food, and bring it home. The current version (1.5) features an introductory adventure, expressive emotes, Shaman mode, and free practice.

## Play

Download or clone this repository and open `index.html` in your browser. For a standalone version, run `python build-standalone.py Animalia_Play.html` and open the generated file.

1. Click Next on the welcome panel.
2. Walk left for 2 seconds (A), right for 2 seconds (D), and land after jumping at both glowing markers (W). The first marker is on the ground, the second on the block. Walking time counts actual grounded movement, and each marker counts once. Hold W for a higher jump.
3. After all tasks, the game temporarily locks movement and performs a 5.4-second camera reveal: golden acorn, hamster hole, then back to the player. Both objects are hidden until their reveal.
4. Collect the golden acorn and carry it to the hamster hole. A completion panel and confetti appear; Click Next to enter Tutorial 02: Meadow Discovery. Jump to catch the vine, swing with A/D, and jump off with W, then try grass, ice, the purple trampoline, chocolate and wood. Finish all six tasks and continue to Tutorial 03: watch a ghost demonstrate wall jumping, climb to the acorn at the top of the shaft, then return to your starting hole. Complete the lesson to unlock free practice. Press R to restart the current lesson.

## Controls

A/D or Left/Right: walk. W: jump (Space and Up no longer jump). Shift: roll. Tab: Shaman mode; 1–4 select magic and click to place. 1–0: hamster emotes in Hamster mode. /: chat; Enter sends and Esc cancels. R: restart. Esc: pause. F1: movement lab. F2: debug. Mobile movement and W jump buttons remain available. Jump near a vine to catch it automatically; use A/D to swing and press W again to jump off. Chat and mode changes are temporarily disabled during the welcome and camera reveal; normal play restores them.

## Level and implementation

`levels/tutorial-01.json` defines an 1800 × 540 map with the original grass block and a longer floor so two-second walks fit comfortably. `jumpTargets` describes the two landing areas; `acorn` and `hole` define the delayed quest. `src/tutorial.js` implements the fixed-step tutorial state and camera interpolation. `src/main.js` integrates the state, objective collision, effects and camera; `src/ui.js` renders task progress. The existing character art, physics, backgrounds, chat, emotes, Shaman objects, and tuning values remain available. Tutorial completion does not award adventure medals or timed records.

## GitHub Pages

1. Open this repository’s Settings → Pages.
2. Select Deploy from a branch, `main`, `/ (root)`, and Save.
3. Open the published URL GitHub displays.

No build step is needed for the supplied project. After editing code or JSON, run `python build-offline.py` to regenerate the offline bundle; run `python build-standalone.py Animalia_Play.html` to regenerate a single-file version.

## Tests

Run `npm test` with Node.js (no dependencies). Both Classic and Snappy movement presets complete the tutorial, including the two marked landings, reveal sequence, acorn and home. Existing physics and asset tests also run. Optional: install Python Playwright and Chromium, then run `python browser-test.py /path/to/Animalia_Play.html`. This uses an instrumented in-memory copy with fixed-step advancement; the shipped game has no test hooks. Mobile-sized layout was checked, but real phone performance and touch playtesting remain unverified.

## Tutorial 04 — Little Farmer
After wall jumping, the guided shop opens. Character selection is a placeholder; cosmetics and fur options can be purchased with coins. Buy five free carrot seeds individually, choose garden plots, wait five real minutes per plant, harvest and sell for ten coins each. After the starter lesson, additional seeds cost three coins. Farm progress is stored in the browser; no account or server sync is included.

## Woodland UI and inventory
The Canvas game retains all four lessons. The market uses a striped canopy, custom SVG icons, a CSS-spinning coin, progress bars and a responsive 20-slot backpack. Seeds, carrots, cosmetics, fur and three optional meadow resources share the existing local save. Stacks hold 99; legacy overflow remains visible and new items are blocked when full. Characters remain a placeholder. No multiplayer server is included.

Click empty soil (world or Garden) to open the seed-filtered backpack. Select carrot seed, Equip, then Plant 1 seed in the chosen plot. The five starter crops can use Free skip in Garden; subsequent crops require the full five minutes. Existing in-progress starter crops are migrated automatically.

## Home and Gamemodes
After selling the five tutorial carrots, players enter their own initially empty meadow. Completed saves start at Home. Decorations cost coins, can be placed on grass or returned to the bag, and persist locally. Garden travel remains available. Racing and Utility (Hotel, House, Restaurant) are placeholders; Hide and Seek and Guess the Impostor are coming soon. No maps or multiplayer services are added for these modes.

### Continuous onboarding
New players start at Tutorial 01. Only the current lesson is accessible until all four are completed; completing a lesson saves the next checkpoint. The fifth carrot sale unlocks Home automatically, and future sessions start there. Previously completed farming saves migrate to Home without losing items. Tutorial replay and garden travel are available after onboarding.
