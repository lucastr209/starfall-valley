# Project: Thung Lũng Sao Rơi — Phased Gameplay Expansion

## Architecture
- Client/Server Architecture: Vanilla JS, HTML5 Canvas, WebSocket (no external heavy libraries).
- Module boundaries:
  - `public/js/game-data.js`: Catalog data, items, NPCs, dialogues, recipes, upgrades, quests.
  - `public/js/game-core.js`: Deterministic game state rules, event tracking, progression, createState, restoreState, nextDay.
  - `public/js/game.js`: Canvas rendering, interactive loop, HUD, input handling, dialogs, world objects.
  - `public/index.html` & `public/css/styles.css`: HUD markup, dialogs, styles.
  - `tests/`: Automated unit & gameplay tests with Node test runner.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Watered Soil & Weather Mechanics | Soil watering status, rain day auto-watering, accelerated growth/bonus yield | M1 | ORIGINAL_REQUEST §R1 |
| 2 | New Crops & Seeds | At least 2 new crops (Carrot, Wheat) and seeds, seed selection UI/keys | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Pet Companion Movement & AI | Star Pup companion following player, idle behaviors, depth sorting, non-intrusive tag | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Pet Interaction & Foraging | Petting interaction (E key, heart burst, stamina recovery), periodic foraging assist | M1 | ORIGINAL_REQUEST §R1 |
| 5 | NPC Friendship Points (Heart System) | 0-500 FP (5 hearts) scale, daily conversation bonus (+10 FP), daily gift limit | M2 | ORIGINAL_REQUEST §R1 |
| 6 | NPC Gift Preferences & Dialogue Reactions | Loved (+80 FP), Liked (+45 FP), Neutral (+20 FP), Disliked (-15 FP) matrix for all 11 NPCs with custom reaction lines | M2 | ORIGINAL_REQUEST §R1 |
| 7 | Friendship Progression & Milestones | Unlockable dialogues and milestone rewards at Hearts 2, 4, 5 for all 11 NPCs | M2 | ORIGINAL_REQUEST §R1 |
| 8 | NPC Friendship UI & Gifting Interface | Heart meters on residents list and dialogue modal, gift giving action menu | M2 | ORIGINAL_REQUEST §R1 |
| 9 | Interactive Fishing Minigame | Rhythmic bobber tension/balancing bar while maintaining timing window compatibility | M3 | ORIGINAL_REQUEST §R1 |
| 10 | Cloud Ruins Puzzle (Ancient Stele Sequence) | 3 Star Steles (West -> North -> East sequence) with resonance effects | M3 | ORIGINAL_REQUEST §R1 |
| 11 | Cloud Ruins Secret Chest | Unlocked secret treasure chest upon puzzle completion (+coins, crystals, stars, XP, quest event) | M3 | ORIGINAL_REQUEST §R1 |
| 12 | Backward Compatibility (Old Saves) | 100% backward compatible restoreState handling missing fields gracefully | M1, M2, M3 | ORIGINAL_REQUEST §R3 |
| 13 | Full Test Suite & Report Verification | node --check, 100% passing tests, TEST_REPORT.md per AGENTS.md | M4 | ORIGINAL_REQUEST §R3 & AGENTS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Phase 1: Nông nghiệp mở rộng & Thú cưng đồng hành | Watered soil, rain effect, 2 new crops/seeds, Pet companion following & petting/foraging, tests | None | DONE |
| M2 | Phase 2: Hệ thống thân thiết NPC & Cốt truyện phụ | 11 NPCs gift preferences, heart points, dialogue progression, milestone rewards, UI/HUD integration, tests | M1 | DONE |
| M3 | Phase 3: Cải tiến minigame Câu cá & Giải đố Tàn Tích Mây | Interactive bobber tension/balancing minigame, 3 steles resonance puzzle, secret chest, tests | M2 | DONE |
| M4 | Final Verification & Delivery | Comprehensive verification, node --check, full test suite pass, TEST_REPORT.md | M3 | DONE |

## Interface Contracts
### Agriculture & Crops ↔ Game Core
- `s.crops`: array of 4 timestamps (ms) or null (preserves backwards-compatibility & test assertions).
- `s.cropTypes`: array of 4 crop item IDs (e.g. `'berry'`, `'carrot'`, `'wheat'`).
- `s.watered`: array of 4 booleans indicating whether each plot is watered.
- `s.selectedSeed`: string ID of currently selected seed.
- `C.event(state, 'plant', cropId, 1, D)` & `C.event(state, 'harvest', cropId, 1, D)`.

### Pet Companion ↔ Game Loop
- `pet`: runtime object `{ x, y, dir, moving, gait, tailWag, name, lastForage }`.
- Depth sorted into `drawables` via `drawables.push({ y: pet.y, draw: () => drawPet(c, pet) })`.
- Excluded from `actorLabels()` to preserve `assert.equal(tags.length, 10)` in `tests/gameplay.test.js`.

### NPC Friendship ↔ Game Core & Dialog
- `s.friendship`: `{ [npcId]: { points: number, talkedToday: boolean, giftedToday: boolean, unlockedRewards: number[] } }`.
- `giveGift(s, npcId, itemId, D)`: validates inventory, updates points (clamp 0..500), consumes item, sets `giftedToday = true`, triggers milestone rewards if crossed.
- `nextDay(s, D)`: resets `talkedToday = false`, `giftedToday = false` for all NPCs.

### Fishing & Cloud Ruins Puzzle ↔ Game Core
- Fishing retains `fishing.position = (Math.sin(fishing.elapsed * 3.8 - Math.PI / 2) + 1) / 2` with interactive tension bar; `success = (position >= 0.38 && position <= 0.62) || tension >= 1.0`.
- Steles: `stele-ruins-west` (180, 430), `stele-ruins-north` (740, 240), `stele-ruins-east` (920, 460).
- Secret chest: `chest-ruins-secret` (860, 240), recorded in `s.chests`.

## Code Layout
- `public/js/game-data.js`: Item catalog, NPC friendship metadata, gift preferences, milestone dialogues/rewards.
- `public/js/game-core.js`: State lifecycle (`createState`, `restoreState`, `nextDay`, `giveGift`, `event`).
- `public/js/game.js`: Canvas drawing, pet logic, farm plot interaction, NPC dialog & gift UI, fishing minigame, puzzle interaction.
- `public/index.html` & `public/css/styles.css`: HUD & modal styling.
- `tests/gameplay.test.js` & `tests/core.test.js`: Regression and expansion tests.
