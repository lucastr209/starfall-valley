# Project: Thung Lũng Sao Rơi — Comprehensive 2D Pixel Graphics Upgrade

## Architecture
- **Rendering Engine**: Self-contained HTML5 Canvas 2D procedural pixel-art system without external images or fonts.
- **World Rendering**: `terrain(map)` renders ground and water onto offscreen `terrainCache` ($1600 \times 1100$). Road networks generated and rendered by `public/js/world-paths.js`.
- **Lighting & Weather**: Multi-pass compositing in `public/js/game.js` (`drawLighting()` via `destination-out` and `screen` operations) and particle effects in `public/js/world-effects.js`.
- **Actors & Entities**: 2D chibi top-down sprites in `public/js/world-actors.js`, 4 directions (down, up, left, right), 8-pose cyclic distance gait, 11 distinct NPCs, monsters and bosses in `public/js/combat-data.js` and `game.js`.
- **UI & HUD**: Procedural title screen (`#titleCanvas`), CSS responsive layout for desktop (1280x720) and mobile landscape (390x844), minimap in `public/js/minimap.js`.
- **Testing & Verification**: Node test runner (`node --test tests/*.test.js`), sprite sheet generator (`tests/render-actors.cjs`), CDP Chrome capture (`scratch/capture.cjs`).

## Code Layout
- `public/js/game.js`: Core canvas rendering loop, terrain, buildings, lighting, monsters, title screen.
- `public/js/world-paths.js`: Road network generation, bitmask layout, path rendering.
- `public/js/world-effects.js`: Weather particles, ripples, ambient effects.
- `public/js/world-actors.js`: Player & 11 NPC sprite rendering, gait calculation, `artMetrics`.
- `public/js/exploration-scene.js`: Interiors (10 rooms) and Caves (3 rooms) rendering and collision.
- `public/js/minimap.js`: Minimap canvas projection and icons.
- `public/css/styles.css`: HUD, dialogs, buttons, mobile controls, responsive layouts.
- `public/index.html`: DOM structure for HUD and modals.
- `tests/*.test.js`: 21 test files, 471 unit tests.
- `tests/render-actors.cjs`: Actor sprite sheet generator.
- `scratch/capture.cjs`: CDP browser capture automation tool.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Organic Terrain Dithering | Eliminate 24px square tile grid checkerboard with multi-octave deterministic dithering and grass tufts | M1 | Survey / R1 |
| 2 | Organic Road Borders | Natural pebble/dirt fringe along road edges without altering 8px cell bitmask | M1 | Survey / R1 |
| 3 | Water & Shorelines | Multi-depth pond gradient, stone embankment clusters, organic sand-to-grass beach transition | M1 | Survey / R1 |
| 4 | Distinct Architecture | Unique roof shingles, timber frames, chimneys, signage for 7 village houses + 3 wilderness huts | M1 | Survey / R1 |
| 5 | Rich Cave & Interior Scenes | Cavern walls, stalactites, glowing moss for 3 caves; cozy interior woodwork for 10 rooms | M1 | Survey / R1 |
| 6 | Soft Dithered Shadows | Layered soft pixel drop shadows for trees, buildings, and props replacing flat ellipses | M1 | Survey / R1 |
| 7 | Multi-tier Darkness & Glow | Deep atmospheric night mask with warm amber lantern cores and smooth outer glow falloff | M2 | Survey / R2 |
| 8 | Window Light Casting | Illuminated windows project trapezoidal light beams onto ground at night | M2 | Survey / R2 |
| 9 | High-Visibility Rain System | Dual-layer rain streaks (foreground bright, background soft) visible against night sky | M2 | Survey / R2 |
| 10 | Rain Splashes & Ripples | Particle pool (<=32) for ground impact splashes and concentric circular ripples on pond | M2 | Survey / R2 |
| 11 | Puddle Reflections & Camp Glow | Reflective wet ground patches and micro-flicker breathing light for campfires | M2 | Survey / R2 |
| 12 | High-Contrast Actor Labels | 4-direction outline or dark pill backplate for `label()` ensuring legibility on all backgrounds | M2 | Survey / R2 |
| 13 | Player & 11 NPC Sprites | Refined pixel shading, detailed garments/accessories within 48x60 silhouette and grounded soles | M3 | Survey / R3 |
| 14 | Monster & Boss Sprites | Detailed slimes, sprouts, wardens, and 4 bosses preserving test compatibility calls | M3 | Survey / R3 |
| 15 | Actor Sprite Sheet Tooling | Update and verify `tests/render-actors.cjs` output sheets for all characters across 4 directions | M3 | Survey / R3 |
| 16 | Sunrise Title Screen | Rich mountain dithering, drifting cloud layers, animated water reflections on `#titleCanvas` | M4 | Survey / R4 |
| 17 | Textured HUD & Dialogs | Pixel-art border trims, paper parchment textures for dialog boxes, polished meters | M4 | Survey / R4 |
| 18 | Crisp Minimap Styling | Polished minimap border frame, distinct biome color keys, clear camera frustum | M4 | Survey / R4 |
| 19 | Responsive Mobile Controls | Enhanced touch D-pad, action buttons (>=44px), smooth fullscreen toggle | M4 | Survey / R4 |
| 20 | E2E Visual Test Infrastructure | Automated CDP capture of all 16 QA scenes on desktop (1280x720) and mobile (390x844) | M-TEST | Survey / AC |
| 21 | Frame Time & Motion Verification | Performance benchmarking (median <= 16.7ms) and reduced motion zero-pixel-delta verification | M-TEST | Survey / AC |
| 22 | Visual Rubric & Final Audit | Independent 7-criteria 1-5 scoring (avg >= 4, min >= 3) and forensic integrity audit | M5 | Survey / AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Visual Test Infrastructure | Automated CDP capture for 16 scenes, baseline capture, benchmark & reduced-motion harness | None | DONE |
| M1 | World & Biomes Overhaul | Features 1-6: Terrain, roads, water, architecture, caves, shadows (R1) | M-TEST (baseline) | DONE |
| M2 | Lighting, Weather & Effects | Features 7-12: Night mask, window beams, rain, splashes, ripples, label contrast (R2) | M1 | DONE |
| M3 | Characters & Monsters Overhaul | Features 13-15: Player, 11 NPCs, monsters, boss sprites, sprite sheets (R3) | M1 | DONE |
| M4 | UI, HUD & Minimap | Features 16-19: Title canvas, HUD frames, dialogs, minimap, mobile controls (R4) | M2, M3 | DONE |
| M5 | E2E Verification, Rubric & Signoff | Features 20-22: Full test suite, after-capture, rubric scoring, forensic audit (R5) | M1, M2, M3, M4 | DONE |

## Interface Contracts
### `public/js/world-paths.js` ↔ `public/js/game.js`
- `P.draw(ctx, layout)`: Must continue to accept standard canvas 2D context and layout object.
- Must preserve `CELL_SIZE = 8`, `WIDTH = 1600`, `HEIGHT = 1100`, and `layout.cells` Uint8Array indices.
- Road rendering passes: base color fills $\to$ edge dithering & pebble scatter $\to$ border highlights.

### `public/js/world-effects.js` ↔ `public/js/game.js`
- `C.weather(state)`: Returns `'clear'`, `'rain'`, or `'rain-night'`.
- Particle updates must respect `reducedMotion` flag: if true, delta is 0, animations frozen.
- Maximum particle budget: Rain splash pool $\le 32$, ambient particles $\le 48$.

### `public/js/world-actors.js` ↔ `public/js/game.js`
- `artMetrics`: Freeze dimensions (`bodyWidth: 48, bodyHeight: 60, nameOffset: 66, headHeight: 32, baseHeight: 54, gaitFrames: 8`).
- Grounded sole anchor: `anchor + 2` at all times.
- Four directions: `down`, `up`, `left`, `right` (left mirrors right).
- 11 NPC profile keys: `mira`, `huy`, `linh`, `thao`, `bao`, `nam`, `yen`, `son`, `sen`, `kiet`, `ly`.

### Collision & State Safety Invariants (Ponytail Principle)
- `blockedAt(map, x, y)` in `game.js`: DO NOT MODIFY ANY NUMERIC HITBOX OR THRESHOLD.
- `InteriorScene.blocked(scene, x, y, solved)`: DO NOT MODIFY BOUNDS OR FURNITURE CHECKS.
- `pickNearest(list, x, y, range)`: DO NOT MODIFY INTERACTION RADIUS ($85$px world, $78$px NPC).
- Player save key `starfall-valley-save-v1`: NEVER READ/WRITE/CLEAR REAL PLAYER SAVE.
