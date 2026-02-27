# Japan Pokedex PWA -- Comprehensive UX/UI Review

**Reviewer:** UX/UI & Game Design Specialist
**Date:** 2026-02-27
**Device Target:** iPhone (390x844 viewport)
**Screenshots Reviewed:** 36

---

## Executive Summary

This is a remarkably ambitious and charming personal project. The theming is consistent, the gamification loops are well-considered, and the content quality is genuinely useful for a first trip to Kansai. The visual identity is strong and immediately recognizable.

**Overall Score: 7.5/10**

---

## Prioritized Action Items

### Critical (Fix Before Trip)

1. **Hide app chrome during onboarding** -- Header, nav, and FAB should not be visible during onboarding. This is the first thing she'll see.

### High Priority

2. **Fix #undefined spot numbers** -- Add fallback: `spot.number ?? (filteredIndex + 1)`
3. **Add bottom padding so FAB doesn't occlude content** -- or reposition FAB
4. **Replace native `confirm()` with themed dialog** for spot release
5. **Add escape/flee option during active battle** -- don't trap users in a 10-question quiz
6. **Increase minimum pixel font size to 8px** -- 5-6px text is unreadable

### Medium Priority

7. Increase battle answer feedback timing from 1.8s to 3s (or tap-to-advance)
8. Fix Pokedex search number reset bug
9. Differentiate starter Bulbasaur cards visually
10. Increase catch overlay opacity to 0.95
11. Improve name input validation UX (shake + error message)
12. Style the photo file input to match app theme
13. Move toast to bottom of screen to avoid header crowding

### Low Priority

14. Stop FAB pulse animation after 3 cycles
15. Store starter selection in state and use for companion personality
16. Move Pokemon phrases to a separate "fun" section
17. Add badge-earned celebration animation on results screen
18. Replace trainer button emoji with SVG icon
19. Center/resize kanji cards
20. Add ARIA labels and live regions for screen readers

---

## Detailed Findings

### 1. Visual Design & Theming

**What Works Well:**
- Strong Pokemon identity with red/yellow/dark blue palette
- Pokeball background pattern at 3% opacity is masterful
- Consistent card system with type-coded left borders
- Type color coding runs consistently through tabs, battles, badges, journal

**Issues:**
- [Medium] Starter selection cards lack visual differentiation -- all 3 look nearly identical
- [Low] Onboarding card has excessive empty space above it
- [Low] Trainer Card button emoji (backpack) renders inconsistently across platforms

### 2. Layout & Spacing

**What Works Well:**
- Card spacing consistency (8-12px vertical gaps)
- Tab pill horizontal scroll with hint affordance
- Catch registration form layout is well-organized

**Issues:**
- [High] **Pokeball FAB occludes content** on every scrollable screen -- covers text in Etiquette, Kansai, Journal
  - Recommendation: Move FAB to center of bottom nav (Pokemon game menu ball position), or add 80px bottom padding to all scroll containers
- [Medium] Bottom content cutoff on phrase cards -- not enough clearance
- [Medium] Kanji cards only use half the width (could be centered)
- [Low] Battle encounter screen has excess vertical space

### 3. Navigation & Information Architecture

**What Works Well:**
- Three-tab structure (POKEDEX/BATTLE/JOURNAL) maps perfectly to learn/practice/explore
- Sub-tab navigation in Pokedex is logical
- Section headers with emoji provide good wayfinding

**Issues:**
- [High] **No back/exit from active battle** -- users are trapped in 10 questions
- [Medium] Dialogue auto-dismiss at 1.8s is too fast for learning feedback
- [Medium] Search resets entry numbers to #001 instead of keeping originals
- [Low] Kansai tab name truncated to "Kansa..."

### 4. Gamification & Game Feel

**What Works Well:**
- Battle encounter flow faithfully mirrors Pokemon
- Gym badge system is a strong motivational hook
- Trainer Card is comprehensive (Bulbasaur, 6 stats, badges, Oak commentary)
- Combo system adds skill ceiling
- Catch flow makes spot-logging feel like a game event

**Issues:**
- [High] #undefined bug on spots added outside catch flow
- [Medium] Starter selection has no visible gameplay impact
- [Medium] Results screen misses badge-earned celebration moment
- [Low] Wrong answers don't show correct answer long enough for learning

### 5. Usability & Interaction Design

**What Works Well:**
- Touch targets well-sized (exceed 44x44pt minimum)
- Active state feedback on all interactive elements
- Speaker buttons for TTS pronunciation
- Keyboard Enter support on name input

**Issues:**
- [High] **Release uses native `confirm()` dialog** -- breaks immersion, unreliable in PWA mode
- [Medium] No input validation feedback on name step (just subtle border color change)
- [Medium] Catch form validation is similarly subtle
- [Low] Photo input uses unstyled native file picker

### 6. Mobile-Specific Concerns

**What Works Well:**
- Safe area handling is thorough (`env(safe-area-inset-*)` everywhere)
- Viewport config correct (`viewport-fit=cover`, `user-scalable=no`)
- PWA configuration complete

**Issues:**
- [Critical] **Header/nav/FAB visible during onboarding** -- completely undermines Professor Oak immersion. Should be full-screen.
- [High] FAB pulse animation never stops -- drains battery, blocks testing, creates visual noise
- [Medium] Catch overlay semi-transparent -- journal content visible behind it
- [Medium] Toast positioning may crowd header area
- [Low] Battle question text and answer buttons have large visual travel distance

### 7. Content & Copy

**What Works Well:**
- Phrase content is genuinely useful for real-world travel
- Kansai-specific content (dialect, regional tips) is a standout feature
- Etiquette rules are concise and practical
- Bulbasaur type-aware reactions add personality
- Oak commentary is progression-aware and encouraging

**Issues:**
- [Medium] Pokemon phrases group mixed with practical phrases may confuse during actual travel
- [Low] Minor romanization inconsistencies
- [Low] Onboarding copy could be warmer (it's a gift)

### 8. Accessibility

**Issues:**
- [High] **Pixel font at 5-6px is illegible** -- badge labels, starter card labels. Minimum should be 8px.
- [Medium] Color contrast on some type badges may fail WCAG AA
- [Medium] No ARIA labels or live regions on dynamic battle content
- [Low] Speaker buttons lack visible labels for screen readers

---

## Bugs Summary

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| B1 | Fixed | `structuredClone` error on Proxy | FIXED |
| B2 | Fixed | `parentElement` null for ShadowRoot | FIXED |
| B3 | High | Spots without catch flow show "#undefined" | OPEN |
| B4 | Medium | Search resets entry numbers | OPEN |
| B5 | Medium | Native `confirm()` for Release | OPEN |
| B6 | Low | FAB pulse never stops | OPEN |
| B7 | Low | Catch overlay semi-transparent | OPEN |
| B8 | **Critical** | Header/nav/FAB visible during onboarding | OPEN |
| B9 | Medium | No exit button during active quiz | OPEN |
| B10 | Medium | 1.8s feedback auto-dismiss too fast | OPEN |
| B11 | Low | Starter selection not stored in state | OPEN |
| B12 | Low | Journal spot counter not live-updated | OPEN |
