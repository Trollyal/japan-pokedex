# Japan Pokedex PWA -- Comprehensive UX/UI Review Report

**Reviewer:** UX/UI Consultant (Pixel Art & Mobile Game Design)
**Date:** 2026-02-27
**App URL:** http://localhost:8080
**Viewport:** 390x844 (iPhone 14 Pro)
**Review Method:** Playwright MCP automated testing + visual inspection

---

## 1. Executive Summary

The Japan Pokedex PWA is a charming and creative concept that successfully marries Pokemon nostalgia with a practical Japan travel guide. The SVG-based pixel art sprite system is technically clever and the chiptune audio synthesizer adds genuine delight. However, the app suffers from **pervasive WCAG contrast failures across every color pairing tested**, a **critically undersized mute button** (24px, well below the 44px minimum), **zero side padding on the Pokedex content area causing edge-to-edge card bleed**, and a **show-stopping SVG rendering bug in the catch flow** where type selector buttons display raw SVG markup as text. These issues must be addressed before the app is usable as a real travel companion.

---

## 2. Screenshots Reference

| # | File | Description |
|---|------|-------------|
| 01 | `screenshots/01-onboarding-welcome.png` | Onboarding welcome screen with Professor Oak |
| 02 | `screenshots/02-onboarding-name.png` | Name entry step |
| 03 | `screenshots/03-onboarding-starter-picker.png` | Starter Bulbasaur selection (3 variants) |
| 04 | `screenshots/04-onboarding-starter-selected.png` | Adventure Bulba selected, confirmation |
| 05 | `screenshots/05-pokedex-main-phrases.png` | Pokedex main screen, Phrases tab active |
| 05b | `screenshots/05b-pokedex-full-page.png` | Full-page capture of all phrase cards |
| 06 | `screenshots/06-pokedex-kanji-tab.png` | Kanji tab with grid layout |
| 07 | `screenshots/07-pokedex-etiquette-tab.png` | Etiquette tab with rule cards |
| 08 | `screenshots/08-pokedex-kansai-tab.png` | Kansai tab with dialect cards |
| 09 | `screenshots/09-battle-screen.png` | Battle menu with badge case + 4 categories |
| 10 | `screenshots/10-battle-encounter.png` | Battle encounter intro ("A wild Phrase appeared!") |
| 11 | `screenshots/11-battle-question.png` | Battle quiz question with 4 answer options |
| 12 | `screenshots/12-journal-empty.png` | Journal empty state |
| 13 | `screenshots/13-trainer-card.png` | Trainer Card modal (top half) |
| 14 | `screenshots/14-trainer-card-bottom.png` | Trainer Card modal (bottom: Oak, export/import) |
| 15 | `screenshots/15-catch-overlay.png` | Catch flow Beat 1: "A wild SPOT appeared!" |
| 16 | `screenshots/16-catch-throw.png` | Catch flow Beat 2: "Ready to throw!" |
| 17 | `screenshots/17-catch-registration.png` | Catch flow Beat 4: Registration form -- SVG BUG VISIBLE |
| 18 | `screenshots/18-header-close-up.png` | Header close-up showing tiny mute button |
| 19 | `screenshots/19-search-results.png` | Search results filtering |
| 20 | `screenshots/20-mute-toggled.png` | Header with muted icon (barely visible) |

---

## 3. Critical Issues (Must Fix)

### 3.1 SVG Rendering Bug in Catch Flow Type Selector

**Location:** `components/screen-catch-flow.js` lines 236-246
**Severity:** Show-stopping
**Screenshot:** `17-catch-registration.png`

The type selector buttons in the catch registration form display raw SVG markup as escaped text instead of rendering the pixel art sprites. The root cause is that buttons are created via `document.createElement('button')` and their content is set via `btn.textContent` (which escapes HTML), when it should use `btn.innerHTML`.

The code on line 239:
```js
btn.textContent = `${t.icon} ${t.label}`;
```
`t.icon` contains SVG sprite strings (from the `sprite()` function in `pokemon-types.js`), but `textContent` escapes all HTML entities, rendering the SVG as literal text.

**Fix:**
```js
btn.innerHTML = `${t.icon} ${t.label}`;
```

This also affects the rarity selector buttons (lines 252-256) if they use icon SVGs.

### 3.2 Mute Button is 24x24px -- Far Below 44px Minimum Touch Target

**Location:** `components/app-shell.js` line 19; `index.html` lines 81-88
**Severity:** Critical (accessibility violation, WCAG 2.5.8 Target Size)
**Screenshot:** `18-header-close-up.png`, `20-mute-toggled.png`

The mute button (`.mute-btn`) measures only **24x24.5px** including 4px padding. The WCAG 2.5.8 (Level AAA) minimum is 44x44px, and even the Level AA minimum is 24px (but requires 44px spacing). The button sprite is rendered at 16x16px with only 4px of padding.

Additionally, the muted state icon (`icon-muted` sprite) is extremely difficult to see against the red gradient header background -- it uses dark gray/black pixels on a #E3350D-to-#C42D0B gradient.

**Fix in `index.html`:**
```css
.mute-btn {
  /* Current */
  /* background:none;border:none;cursor:pointer;padding:4px;margin-right:8px */

  /* Recommended */
  background: rgba(255,255,255,0.15);
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  cursor: pointer;
  padding: 10px;
  margin-right: 8px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 3.3 Pervasive WCAG Contrast Failures

**Severity:** Critical (accessibility violation, WCAG 1.4.3)

Every single color pairing tested fails WCAG AA contrast ratio (minimum 4.5:1 for normal text, 3:1 for large text):

| Element | Foreground | Background | Ratio | Required | Pass? |
|---------|-----------|------------|-------|----------|-------|
| Header title (white on red) | `#FFFFFF` | `#E3350D` | **4.39:1** | 4.5:1 | FAIL (barely) |
| Header subtitle (yellow on red) | `#FFCB05` | `#E3350D` | **2.89:1** | 4.5:1 | FAIL |
| Active Fire tab (white on orange) | `#FFFFFF` | `#FF6B35` | **2.84:1** | 4.5:1 | FAIL |
| Romaji text (#888 on white) | `#888888` | `#FFFFFF` | **3.54:1** | 4.5:1 | FAIL |
| Dex number (#aaa on white) | `#AAAAAA` | `#FFFFFF` | **2.32:1** | 4.5:1 | FAIL |
| Electric tab text | `#B8860B` | `#FFFBE8` | **3.13:1** | 4.5:1 | FAIL |
| Grass group title | `#5DAA68` | `#E8F5E9` | **2.52:1** | 4.5:1 | FAIL |
| Water tab text | `#4A90D9` | `#E8F2FF` | **2.96:1** | 4.5:1 | FAIL |
| Nav inactive text (#888 on white) | `#888888` | `#FFFFFF` | **3.54:1** | 4.5:1 | FAIL |

**Recommended replacements:**

| Element | Current Color | Recommended Color | New Ratio |
|---------|-------------|-------------------|-----------|
| Header title | `#FFFFFF` on `#E3350D` | Keep (passes as large text at 11px Press Start 2P) or darken BG to `#C62828` | ~5.0:1 |
| Header subtitle | `#FFCB05` on `#E3350D` | `#FFF8E1` (light cream) | ~5.5:1 |
| Fire tab active | `#FFFFFF` on `#FF6B35` | Darken fire to `#D84315` | ~5.3:1 |
| Romaji | `#888888` on `#FFFFFF` | `#666666` | 5.74:1 |
| Dex number | `#AAAAAA` on `#FFFFFF` | `#757575` | 4.60:1 |
| Electric tab | `#B8860B` on `#FFFBE8` | `#8D6E00` | ~5.0:1 |
| Grass group title | `#5DAA68` on `#E8F5E9` | `#2E7D32` | ~4.8:1 |
| Water tab | `#4A90D9` on `#E8F2FF` | `#1565C0` | ~5.5:1 |
| Nav inactive | `#888888` on `#FFFFFF` | `#666666` | 5.74:1 |

---

## 4. Major Issues (Should Fix)

### 4.1 Zero Side Padding on Screen Content Areas

**Location:** `index.html` line 132; `components/screen-pokedex.js` line 11
**Screenshot:** `05-pokedex-main-phrases.png`

While `screen-pokedex` has `:host { padding: 16px; }` in its Shadow DOM styles, the main `#screen-container` has `padding-bottom: 80px` but **0px left/right/top padding**. The `<main>` element also has 0px padding on all sides.

The Pokedex cards (`.dex-card`) extend to the **full 390px viewport width** with 0px left and 0px right margin from the screen edge. The 16px padding comes from the shadow host, which works for the Pokedex screen but not for the `<main>` container itself.

**However**, the search bar and tabs scroll to full width within the padding, looking correct. The real issue is that the card content text inside `.dex-card` has only 16px padding internally, but the cards themselves touch the 16px host padding edges, which creates a cramped feeling.

**Recommendation:** Add 4px more horizontal padding to the host:
```css
/* In screen-pokedex.js */
:host { display: block; padding: 16px 20px; animation: fadeIn .3s ease; }
```

For the Battle screen, the same improvement applies:
```css
/* In screen-battle.js */
:host { display: block; padding: 16px 20px; animation: fadeIn .3s ease; position: relative; }
```

### 4.2 Content Clips Behind Sticky Header on Battle Screen

**Location:** `components/screen-battle.js`
**Screenshot:** `11-battle-question.png`

When a battle quiz is active, the "1 / 10" progress text and "Score: 0" text appear immediately below the header with no gap. The progress info (.progress-info) starts at the very top of the screen-battle component, which sits directly under the sticky header. Combined with the 16px host padding, the top content is very tight against the header.

The `.flee-btn` (positioned `top: 12px; right: 12px` relative to the component) overlaps with the header area.

**Fix:** Add `padding-top: 8px` to `.battle-screen.active` or increase the host top padding to 24px.

### 4.3 Speaker/Listen Button Too Small

**Location:** `components/screen-pokedex.js` lines 102-107
**Measured:** 28x22px (padding: 2px 6px)

The speaker buttons next to Japanese text measure only 28x22px -- well below the 44px minimum touch target. On a phone, users will frequently mis-tap these.

**Fix:**
```css
.speak-btn {
  background: none; border: 1px solid #ddd; border-radius: 8px;
  padding: 8px 12px; /* was 2px 6px */
  cursor: pointer; font-size: 14px; margin-left: 6px; vertical-align: middle;
  transition: background .15s;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

### 4.4 Type Tabs Too Short for Touch

**Location:** `components/screen-pokedex.js` line 34
**Measured:** 104x32px

The category tabs (Phrases, Kanji, Etiquette, Kansai) are 32px tall. While the width (104px) is fine, the height should be at least 44px.

**Fix:**
```css
.type-tab {
  /* Add: */
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

### 4.5 Pokeball FAB Overlaps Content in Bottom-Right Corner

**Location:** `index.html` lines 113-123
**Screenshot:** `05-pokedex-main-phrases.png`, `08-pokedex-kansai-tab.png`

The Pokeball FAB (56x56px) is positioned fixed at `bottom: 92px; right: 16px`. It permanently overlaps the bottom-right corner of scrollable content. When scrolling through phrase cards, the last visible card is always partially obscured by the FAB.

**Recommendation:** Either:
1. Add a `padding-right: 72px` zone at the bottom of the content area
2. Move the FAB to center-bottom above the nav bar
3. Hide the FAB when scrolling down, show on scroll-up

---

## 5. Minor Issues (Nice to Fix)

### 5.1 Press Start 2P Font at 7px is Barely Legible

**Locations:** Tab buttons (7px), nav buttons (7px), dex numbers (7px), badge labels (7-8px), reg labels (7px)

The "Press Start 2P" pixel font was designed to be rendered at multiples of its native grid size. At 7px, individual characters become difficult to distinguish, especially on lower-DPI screens. The minimum recommended size for Press Start 2P is 10px.

**Recommendation:** Increase all instances of 7px to at least 9px, or switch to Quicksand for text that small.

### 5.2 Onboarding Dialogue Box Vertically Centered -- Wasted Top Space

**Screenshot:** `01-onboarding-welcome.png`

The onboarding dialogue card sits in the vertical center of the screen, leaving a large empty salmon-colored space above. This makes the app look unfinished during first impression.

**Recommendation:** Align the dialogue box slightly above center (perhaps 35% from top) or add a decorative element to the top area.

### 5.3 Missing "No Search" Indicator on Clear

When clearing the search field, the `x` clear button appears correctly, but there is no visual transition -- content just re-renders. A subtle fade would feel more polished.

### 5.4 Journal Filter Chip Touch Targets

The filter chips (Food, Onsen, Nature, etc.) are rendered with `padding: 6px 12px` which makes them approximately 30px tall. Increase to `padding: 10px 16px` for better touch targets.

### 5.5 Badge Labels in Battle Screen Badge Case

The badge labels (`PHRASES`, `KANJI`, etc.) use `color: rgba(255,255,255,.5)` on the dark `#2C2C54` background. At 8px Press Start 2P, these are extremely hard to read. Increase opacity to 0.8 or use a solid light color.

### 5.6 Trainer Card Stats Show "0" Without Context

When all stats are zero, the Trainer Card grid shows `0` six times with tiny labels underneath. Consider showing a motivational empty state instead, e.g., "Start your adventure!" with a directional prompt.

### 5.7 Deprecated Meta Tag

```
<meta name="apple-mobile-web-app-capable" content="yes">
```
Should also include the modern equivalent:
```html
<meta name="mobile-web-app-capable" content="yes">
```

### 5.8 AudioContext Warning on Load

The AudioContext is created before user interaction, causing a console warning. The `unlock()` function on line 37 of `audio.js` handles this correctly via click/touchstart listeners, but `ensureCtx()` is called during module initialization (line 222-226 via bus listeners). Consider lazily initializing the context.

---

## 6. Positive Notes

### 6.1 SVG Sprite System is Excellent
The hybrid SVG pixel-art and vector-art sprite system (`lib/sprites.js`) is a genuinely clever approach. Zero image files, instant loading, infinitely scalable. The palette system (`P` object) ensures color consistency. This is a technical highlight.

### 6.2 Bulbasaur Vector Art is Charming
The Bulbasaur variants (happy, sleepy, excited, confused, vine-whip) are well-crafted SVG vector art with personality. They feel authentically Pokemon while being original. The vine-whip easter egg (10 rapid taps) is delightful.

### 6.3 Professor Oak is Recognizable
The Oak SVG at 48x48 view box manages to communicate "friendly professor with glasses and lab coat" effectively.

### 6.4 Chiptune Audio Design is Thoughtful
The Web Audio synthesizer (`lib/audio.js`) has well-designed sound effects with proper escalation patterns (Nice -> Great -> Excellent -> MASTER combos), appropriate use of waveform types (square for retro UI, triangle for mellower results), and correct iOS unlock handling.

### 6.5 Onboarding Flow is Smooth
The 3-step onboarding (welcome -> name -> starter pick) is well-paced and thematic. The starter selection mechanic adds personality without being annoying.

### 6.6 Content Quality is High
The phrase database, kanji selection, etiquette rules, and Kansai dialect content are all practical and well-curated for actual Japan travelers. The Pokemon-themed phrases section is a fun bonus.

### 6.7 Card Hierarchy is Clear
The dex cards have a clear visual hierarchy: colored left border (type) -> #number (subdued) -> English name (bold) -> Japanese (large) -> romaji (italic). This progression makes scanning easy.

### 6.8 Quiz System is Engaging
The battle/quiz system with HP bars, combo tracking, pokeball catch animations, and badge rewards creates genuine gamification motivation.

### 6.9 Bottom Navigation is Well-Implemented
The bottom nav at 72px height with 130x69px buttons is well-sized for touch. The active state indicator (red line + color) is clear. The 7px font is the only issue.

---

## 7. Prioritized Recommendations

### Priority 1: Critical Fixes (Day 1)

1. **Fix catch flow SVG rendering bug** -- Change `btn.textContent` to `btn.innerHTML` in `screen-catch-flow.js` line 239. This makes the catch flow completely unusable.

2. **Enlarge mute button to 44x44px** -- Add visible background, increase padding to `10px`, set explicit `width: 44px; height: 44px`. Add `border-radius: 8px; background: rgba(255,255,255,0.15)`.

3. **Fix header contrast** -- Darken the header gradient start from `#E3350D` to `#C62828`. Change subtitle color from `#FFCB05` (yellow) to `#FFF8E1` (light cream). This single change fixes the two most visible contrast failures.

### Priority 2: Accessibility Fixes (Day 2-3)

4. **Fix all text contrast ratios** -- Apply the color corrections from section 3.3 table. Key changes:
   - `.dex-card .romaji` color: `#888` -> `#666`
   - `.dex-card .dex-num` color: `#aaa` -> `#757575`
   - `.type-tab.active[data-type="fire"]` background: `#FF6B35` -> `#D84315`
   - Grass/Water/Electric tab text colors need darkening per table above
   - `.nav-btn` inactive color: `#888` -> `#666`

5. **Enlarge speaker buttons** -- Change `.speak-btn` padding from `2px 6px` to `8px 12px`, add `min-width: 44px; min-height: 44px`.

6. **Increase type tab height** -- Add `min-height: 44px` to `.type-tab`.

### Priority 3: Layout Polish (Day 4-5)

7. **Add breathing room** -- Increase host padding on all screen components from `16px` to `20px` horizontal. Specifically:
   - `screen-pokedex.js` `:host` padding: `16px` -> `16px 20px`
   - `screen-battle.js` `:host` padding: `16px` -> `16px 20px`
   - `screen-journal.js` `:host` padding: `16px 16px 80px` -> `16px 20px 80px`

8. **Fix battle screen header overlap** -- Add `padding-top: 8px` to the battle active screen content, or increase host top padding to 24px.

9. **Address Pokeball FAB content overlap** -- Add `scroll-padding-bottom: 80px` to the content area, or add a transparent spacer div at the bottom of long content lists.

### Priority 4: Typography & Polish (Week 2)

10. **Increase minimum pixel font size** -- Change all `7px` Press Start 2P instances to `9px`. Affected:
    - `.type-tab` font-size: `7px` -> `9px`
    - `.nav-btn` font-size: `7px` -> `9px`
    - `.dex-card .dex-num` font-size: `7px` -> `8px`
    - `.reg-label` font-size: `7px` -> `9px`
    - Badge labels: `8px` is borderline acceptable

11. **Improve badge case label legibility** -- Change `.badge-slot .badge-label` color from `rgba(255,255,255,.5)` to `rgba(255,255,255,.8)`.

12. **Add deprecated meta tag equivalent** -- Add `<meta name="mobile-web-app-capable" content="yes">` alongside the existing apple tag.

13. **Lazy-init AudioContext** -- Move `ensureCtx()` calls to be triggered only on first user interaction rather than module load.

14. **Increase journal filter chip padding** -- `.filter-chip` padding: `6px 12px` -> `10px 16px`.

---

## Appendix: Measured Element Dimensions

| Element | Measured Size | Minimum Required | Status |
|---------|-------------|-----------------|--------|
| Mute button | 24x24.5px | 44x44px | FAIL |
| Speaker/Listen button | 28x22px | 44x44px | FAIL |
| Trainer Card button | 42x42px | 44x44px | Near-pass |
| Type tabs | 104x32px | 44x44px (height) | FAIL (height) |
| Nav buttons | 130x69px | 44x44px | PASS |
| Pokeball FAB | 56x56px | 44x44px | PASS |
| Filter chips | ~70x30px | 44x44px (height) | FAIL (height) |
| Battle option buttons | ~358x50px | 44x44px | PASS |
| Header | 390x66px | N/A | OK |
| Bottom nav | 390x72px | N/A | OK |

---

*Report generated via Playwright MCP automated testing with 20 screenshots captured across all screens and interaction states.*
