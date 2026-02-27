# Japan Guide PWA — Master Implementation Plan

> **Status**: Approved by Product Council. Ready for implementation.
> **Last updated**: 2026-02-27
> **Origin**: Product Council 3-round debate (PM, UX Designer, Developer, Data Analyst) + UX visual audit + PokeAPI sprite research

---

## Orchestration Instructions

### Claude's Role: Project Manager / Lead

Claude operates as the **PM and project lead** for this implementation. Responsibilities:

1. **Task delegation**: Break each feature into discrete tasks and assign them to specialist agents via the Task tool
2. **Quality gate**: Review each feature's output before moving to the next
3. **Scope enforcement**: Ensure every feature is delivered in full — no partial implementations, no skipped details
4. **Dependency management**: Features must be implemented in the specified order (Feature 0 → 6) because later features depend on earlier ones
5. **Integration testing**: After each feature, verify the app still works end-to-end

### Agent Assignment Strategy

| Agent Type | Use For |
|-----------|---------|
| `SoftwareDeveloper` | All code implementation tasks (JS, CSS, HTML edits) |
| `UxDesigner` | Visual review of sprites, layout checks, accessibility audit |
| `QaTester` | Test strategy, edge case identification after each feature |
| `general-purpose` | Sprite download/conversion, file operations, multi-step tasks |

### Implementation Protocol

For each feature (0 through 6):

1. **Read**: PM reads all files listed in "Files to modify" for that feature
2. **Delegate**: Spawn `SoftwareDeveloper` agent with:
   - Full feature spec from this plan
   - List of files to modify with their current state
   - Explicit instruction to follow existing code patterns (Web Components, Shadow DOM, event bus, sprite() helper, etc.)
3. **Review**: PM reviews the changes against the spec
4. **Test**: Spawn `QaTester` agent to identify edge cases, or manually verify
5. **Commit**: Stage and commit the feature as a single coherent commit
6. **Next**: Move to the next feature

### Critical Constraints

- **Vanilla JS only** — no npm, no build tools, no frameworks, no TypeScript
- **PWA on iOS** — must work as home-screen app in Safari WebKit
- **GitHub Pages deployment** — static files only, no server
- **1st gen retro Pokemon aesthetic** — pixel art, `image-rendering: pixelated`, Press Start 2P font
- **Existing patterns must be followed**:
  - `sprite(name, size)` for all images (from `lib/sprites.js`)
  - `bus.emit()` / `bus.on()` for cross-component events (from `lib/events.js`)
  - `sfx(name)` for sounds (from `lib/audio.js`)
  - `state.xxx` proxy writes for persistence (from `lib/state.js`)
  - Shadow DOM with `adoptedStyleSheets` for component CSS
  - `sharedStyles` from `lib/shared-styles.js` as base stylesheet
  - `navigate(screenName, params)` for routing (from `lib/router.js`)

---

## App Architecture Reference

```
japan-guide/
├── index.html              # Main HTML, CSS layers, all global styles
├── app.js                  # Entry: screen registration, init, greeting, wild facts
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker with manual precache list
├── lib/
│   ├── state.js            # Proxy-based reactive store, dual persistence (IDB + localStorage)
│   ├── events.js           # Custom event bus (bus.emit / bus.on)
│   ├── router.js           # Hash-based routing, lazy screen loading
│   ├── sprites.js          # SPRITE_MAP array + sprite(name, size) helper
│   ├── audio.js            # Web Audio chiptune synth, SOUNDS map, sfx(name)
│   ├── gps.js              # acquirePosition(), haversineDistance()
│   ├── shared-styles.js    # Constructable CSSStyleSheet for Shadow DOM
│   └── pokemon-types.js    # SPOT_TYPES, RARITY, BATTLE_CATS
├── components/
│   ├── app-shell.js        # Light DOM shell: header, nav, dialogue, FAB, toast
│   ├── screen-pokedex.js   # 4-tab reference (phrases/kanji/etiquette/kansai)
│   ├── screen-battle.js    # Quiz engine with combo system + gym badges
│   ├── screen-journal.js   # Caught spots list with photos
│   ├── screen-catch-flow.js # 5-beat GPS spot capture sequence
│   ├── screen-trainer-card.js # Stats modal, achievements, Bulbasaur companion
│   ├── screen-onboarding.js # Prof Oak welcome flow
│   ├── screen-day-recap.js # Evening summary screen
│   └── wild-encounter.js   # Random fact overlay
├── data/
│   ├── phrases.js          # 59 phrases (7 groups), 30 kanji
│   ├── etiquette.js        # 15 rules, 16 Kansai dialect, 21 regional tips
│   └── badges.js           # ACHIEVEMENT_BADGES array + checkAchievements()
└── sprites/                # ~62 WebP pixel art files
```

### Key Patterns

**State writes** (auto-persist via Proxy):
```js
import { state } from '../lib/state.js';
state.totalCatches++;                    // triggers save
state.achievements.firstCatch = true;    // deep proxy, triggers save
```

**Event bus**:
```js
import { bus } from '../lib/events.js';
bus.emit('spot-caught', { spot });       // fire event
bus.on('spot-caught', (e) => { ... });   // listen
```

**Sprites**:
```js
import { sprite } from '../lib/sprites.js';
const html = `${sprite('pokeball', 56)}`;  // returns <img> tag
```

**Sounds**:
```js
import { sfx } from '../lib/audio.js';
sfx('catch-success');                    // plays chiptune
```

---

## Feature 0: Sprite & Visual Overhaul

**Why**: Bulbasaur sprites are generic green blobs (not recognizable as Bulbasaur). Professor Oak is an unrecognizable brown smudge. Pokeball and type icons are good quality.

**Target aesthetic**: Pokemon Gold/Silver/Crystal era — full-color pixel art, 1px dark outlines, `image-rendering: pixelated`.

### Sprite Sources

**Bulbasaur — Gen 3 FireRed/LeafGreen** (chosen for best color + pixel clarity):
```
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen/1.png
```

**Professor Oak** (PokeAPI has NO trainer sprites, use Pokemon Showdown):
```
https://play.pokemonshowdown.com/sprites/trainers/oak.png
https://play.pokemonshowdown.com/sprites/trainers/oak-gen1rb.png
https://play.pokemonshowdown.com/sprites/trainers/oak-gen2.png
https://play.pokemonshowdown.com/sprites/trainers/oak-gen3.png
```

### Sprite Strategy

| Category | Quality | Action |
|----------|---------|--------|
| Bulbasaur (5 variants) | Not recognizable | Replace with PokeAPI Gen 3 FRLG base. Create mood variants by modifying base (zzz for sleepy, sparkles for excited, ? for confused, vines for vinewhip) |
| Professor Oak | Unrecognizable | Replace with Showdown `oak-gen1rb.png` or `oak-gen2.png`, downscale to match pixel density |
| Pokeballs (5) | Good | Keep as-is |
| Type icons (4) | Good | Keep as-is |
| Everything else | Acceptable+ | Keep as-is |
| `scene-wild-fact` | Weak | Improve |

### Steps

1. Download PokeAPI Bulbasaur sprite + Showdown Oak sprites
2. Convert to WebP, resize to match existing tiers (32x32 characters, 48x48 scenes)
3. Create 5 Bulbasaur mood variants from the base sprite
4. Audit all components for emoji used as visual elements → replace with `sprite()` calls
5. Add "(c) The Pokemon Company" attribution in Trainer Card

### Files to modify
- `sprites/bulbasaur-happy.webp` (replace)
- `sprites/bulbasaur-sleepy.webp` (replace)
- `sprites/bulbasaur-excited.webp` (replace)
- `sprites/bulbasaur-confused.webp` (replace)
- `sprites/bulbasaur-vinewhip.webp` (replace)
- `sprites/oak.webp` (replace)
- `sprites/scene-wild-fact.webp` (improve)
- `sw.js` — update precache if filenames change
- Various components — audit/replace emoji with sprite() calls

---

## Feature 1: Pokeball FAB Upgrade System

**What**: The Pokeball FAB evolves based on "Trainer Score" (spots + badges + achievements).

**Trainer Score**:
- Each caught spot = 1 point
- Each quiz badge (4 total) = 3 points
- Each achievement = 2 points

**Thresholds**: Pokeball (0+) → Great Ball (10) → Ultra Ball (25) → Master Ball (40)

**Implementation**:
- NEW `lib/progression.js` (~40 lines): `getTrainerScore(state)` and `getCurrentBall(state)` functions
- `components/app-shell.js`: subscribe to state changes, call `getCurrentBall()`, swap FAB sprite
- On upgrade: CSS sparkle/glow animation + `sfx('ball-upgrade')` fanfare
- `lib/audio.js`: add `ball-upgrade` sound definition
- Sprites already in SPRITE_MAP: `greatball`, `ultraball`, `masterball`

### Files to modify
- NEW: `lib/progression.js`
- `components/app-shell.js` — FAB swap + upgrade animation
- `lib/audio.js` — `ball-upgrade` sound

---

## Feature 2: Expanded Achievement System

**What**: Expand from 7 → ~20 achievements, all earnable within a week-long Kansai trip.

### New achievements (13 additions)

| Key | Label | Condition | Sprite |
|-----|-------|-----------|--------|
| `firstCatch` | First Catch | Catch 1 spot | `badge-first-catch` |
| `collector10` | Collector | Catch 10 spots | `badge-collector` |
| `perfectQuiz` | Perfect Score | 10/10 on any quiz | `badge-perfect` |
| `quizMaster` | Quiz Master | All 4 gym badges | `badge-quiz-master` |
| `comboKing` | Combo King | 7+ combo streak | `badge-combo-king` |
| `shutterBug` | Shutter Bug | Photos on 5 spots | `badge-shutter-bug` |
| `streak3` | 3-Day Streak | 3 day catch streak | `badge-streak-3` |
| `streak5` | 5-Day Streak | 5 day catch streak | `badge-streak-5` |
| `streak7` | Week Warrior | 7 day catch streak | `badge-streak-7` |
| `distanceWalker` | Distance Walker | Walk 5km | `badge-distance` |
| `distanceRunner` | Marathon Runner | Walk 15km | `badge-marathon` |
| `factHunter` | Fact Hunter | 10 wild facts | `badge-fact-hunter` |
| `diverseExplorer` | Type Expert | 3+ of every spot type | `badge-type-expert` |

### Implementation
- `lib/state.js` — add `longestStreak` field + new achievement keys to `defaultState()`
- `data/badges.js` — add to `ACHIEVEMENT_BADGES`, expand `checkAchievements()`
- `components/screen-trainer-card.js` — expand `ACHIEVEMENTS_DEF` array (line ~133)
- `lib/sprites.js` — add 13 new sprite names to `SPRITE_MAP`
- `sw.js` — add new sprite paths to precache
- `components/screen-catch-flow.js` — update `longestStreak` in `_beat4Catch()`
- NEW: 13 WebP sprite files in `sprites/`

---

## Feature 3: Persistent Bulbasaur Companion

**What**: `<bulbasaur-buddy>` Web Component floating beside the FAB, showing mood reactions.

**Moods**: `bulbasaur-happy` (default), `bulbasaur-excited` (catch/badge), `bulbasaur-sleepy` (idle >30min), `bulbasaur-confused` (wrong answer)

**Event reactions**:
- `spot-caught` → excited bounce (3s)
- `badge-earned` → excited + sparkle
- `battle-correct` (new event) → happy wiggle
- `battle-wrong` (new event) → confused head-tilt
- `navigate` → idle bounce
- Idle 30min → sleepy
- Pokeball upgrade → big celebratory jump
- Tap → random reaction + `sfx('bulbasaur-tap')`

**Hidden during onboarding**: `app-shell.onboarding-active .bulbasaur-buddy { display: none }`

### Files to modify
- NEW: `components/bulbasaur-buddy.js` (~100 lines)
- `app.js` — import + append element
- `index.html` — positioning CSS
- `components/screen-battle.js` — emit `battle-correct` / `battle-wrong` events

---

## Feature 4: Swipe-to-Throw Gesture

**What**: Replace "THROW!" button in catch flow Beat 2 with swipe-up gesture on Pokeball.

**Behavior**:
- Touch pokeball → follows finger (`transform: translateY()`)
- Flick up (deltaY >80px in <300ms) → throw animation
- Release without flick → spring back (CSS transition)
- `navigator.vibrate?.(50)` on catch (iOS silently no-ops)
- Click fallback for desktop testing
- `touch-action: none` to prevent iOS swipe-back conflict

### Files to modify
- `components/screen-catch-flow.js` — Beat 2 gesture handling (~40 lines)

---

## Feature 5: Kansai Location Easter Eggs

**What**: GPS-triggered encounters at 5 real Kansai locations during catch flow.

### Locations

| Location | Trigger | Encounter | Lat | Lng |
|----------|---------|-----------|-----|-----|
| Fushimi Inari | Fox Spirit | Kitsune encounter | 34.966-34.970 | 135.771-135.775 |
| Dotonbori | Magikarp Splash | Magikarp in canal | 34.668-34.670 | 135.500-135.503 |
| Osaka Castle | Gym Leader | "Gym Leader's Domain" | 34.686-34.689 | 135.524-135.528 |
| Kinkaku-ji | Golden Scale | Golden temple event | 35.038-35.041 | 135.728-135.730 |
| Arashiyama | Bamboo Sanctuary | Grass-type haven | 35.009-35.012 | 135.670-135.673 |
| Nara Park | Nara Deer | Already exists | 34.68-34.69 | 135.83-135.85 |

**Pattern**: Same as existing Nara deer check in `screen-catch-flow.js:522-534`.
Each triggers once → `state.locationEasterEggs.{key}: true`

### Files to modify
- NEW: `data/locations.js` (~60 lines) — location definitions
- `components/screen-catch-flow.js` — expand `_checkNaraEasterEgg()` → `_checkLocationEasterEggs()`
- `components/wild-encounter.js` — `_showLocationEncounter(location)` method
- `lib/state.js` — add `locationEasterEggs: {}` to defaults
- `data/badges.js` — location achievement entries
- `lib/audio.js` — location encounter sounds
- `lib/sprites.js` + `sw.js` — register new sprites
- NEW: 5 WebP sprite files

---

## Feature 6: Quick Phrase Situation Mode (Bonus)

**What**: Long-press FAB → quick-action menu with situation shortcuts → pre-filtered Pokedex.

**Situations**: Restaurant, Shopping, Konbini, Directions, Emergency (maps to phrase `group` values in `data/phrases.js`).

**Behavior**:
- Long-press FAB (500ms) → vertical mini-menu above FAB with 5 icons
- Tap situation → `navigate('pokedex', { filter: 'Restaurant' })`
- Pokedex reads `filter` attribute, pre-sets search/tab
- Short tap still triggers catch flow

### Files to modify
- `components/app-shell.js` — long-press detection + situation menu overlay
- `components/screen-pokedex.js` — read `filter` attribute in `connectedCallback()`
- `lib/router.js` — already supports params (line 39)

---

## Implementation Order (STRICT)

| Order | Feature | Dependencies | Est. Scope |
|-------|---------|-------------|------------|
| 0 | Sprite & Visual Overhaul | None — foundation | Sprites + audit |
| 1 | Pokeball FAB Upgrade | Feature 0 (sprites) | ~40 lines new + edits |
| 2 | Achievement Expansion | Feature 1 (feeds upgrade) | ~100 lines new + edits |
| 3 | Bulbasaur Companion | Features 0+1+2 (sprites, events) | ~100 lines new |
| 4 | Swipe-to-Throw | None (but benefits from 3 for buddy reaction) | ~40 lines changed |
| 5 | Location Easter Eggs | Feature 2 (achievements) | ~60 lines new + edits |
| 6 | Situation Mode | None | ~50 lines changed |

## New Files Summary

| File | Purpose | ~Lines |
|------|---------|--------|
| `lib/progression.js` | Trainer score + ball tier | ~40 |
| `components/bulbasaur-buddy.js` | Persistent companion | ~100 |
| `data/locations.js` | Kansai GPS locations | ~60 |
| `sprites/*.webp` (~18 files) | Achievement + location sprites | pixel art |

## Verification Checklist

- [ ] Sprite overhaul: Bulbasaur looks like actual Bulbasaur, Oak is recognizable
- [ ] FAB upgrade: manually set state to verify sprite swaps at 10/25/40 thresholds
- [ ] Achievements: trigger each of the 13 new conditions, verify badge in Trainer Card
- [ ] Bulbasaur buddy: catch spot → excited, wrong quiz → confused, idle 30min → sleepy
- [ ] Swipe gesture: iPhone Safari PWA — swipe-up throws, no iOS swipe-back conflict
- [ ] Location eggs: widen bounding boxes for local testing, verify triggers, restore
- [ ] Situation mode: long-press FAB, select situation, verify Pokedex filters
- [ ] Full flow: onboarding → quiz → catch → journal → Trainer Card reflects all progress
- [ ] Service worker: `sw.js` precache includes all new sprite files
- [ ] No regressions: all existing features still work after all changes

---

## Licensing Note

Sprites sourced from PokeAPI (CC0 repo organization) and Pokemon Showdown (open source).
Original artwork (c) The Pokemon Company / Nintendo / Game Freak.
This is a personal non-commercial PWA — add attribution notice in Trainer Card.
