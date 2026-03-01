// components/catch/catch-styles.js — Full-screen catch flow CSS

const sheet = new CSSStyleSheet();
sheet.replaceSync(/*css*/`
  :host { display: contents; }

  /* ===== FULL-SCREEN LAYOUT ===== */
  .catch-screen {
    position: fixed; inset: 0; z-index: 200;
    display: none; flex-direction: column;
    overflow: hidden;
    font-family: 'Quicksand', sans-serif;
  }
  .catch-screen.show { display: flex; }

  .zone-sky {
    flex: 0 0 33%;
    padding-top: env(safe-area-inset-top);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative;
  }

  .zone-target {
    flex: 1;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }

  .zone-throw {
    flex: 0 0 auto;
    min-height: 200px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative;
  }

  /* ===== SCANLINE OVERLAY (GBA feel) ===== */
  .catch-screen::before {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 3px,
      rgba(0,0,0,.06) 3px,
      rgba(0,0,0,.06) 4px
    );
    pointer-events: none;
    z-index: 1;
  }

  /* ===== RUN BUTTON (X) — always accessible ===== */
  .run-btn-x {
    position: fixed;
    top: calc(12px + env(safe-area-inset-top));
    right: 12px;
    z-index: 210;
    width: 44px; height: 44px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,.6);
    background: rgba(0,0,0,.35);
    color: #fff;
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    transition: all .15s;
  }
  .run-btn-x:active { transform: scale(.92); }

  /* ===== BEAT CONTAINER ===== */
  .beat-container {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    z-index: 2;
  }

  /* ===== BEAT TRANSITIONS ===== */
  .beat-enter {
    animation: beatFadeIn .4s ease both;
  }
  @keyframes beatFadeIn {
    from { opacity: 0; transform: scale(.95); }
    to { opacity: 1; transform: scale(1); }
  }

  /* ===== WILD TEXT (typewriter) ===== */
  .wild-text {
    font-family: 'Press Start 2P', monospace;
    font-size: 14px; line-height: 1.8;
    color: #fff;
    text-shadow: 2px 2px 0 rgba(0,0,0,.5);
    text-align: center;
    padding: 0 20px;
  }

  /* ===== SILHOUETTE + REVEAL ===== */
  .target-sprite {
    font-size: 0; line-height: 0;
    transition: filter .6s ease;
  }
  .target-sprite.silhouette { filter: brightness(0); }
  .target-sprite.revealed { filter: brightness(1); }

  /* ===== GPS STATUS ===== */
  .gps-status {
    font-size: 12px; color: rgba(255,255,255,.7);
    text-align: center; margin: 12px 0;
    text-shadow: 1px 1px 0 rgba(0,0,0,.3);
  }
  .gps-status.error { color: #FF6B6B; }

  /* ===== TAP PROMPT ===== */
  .tap-prompt {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: rgba(255,255,255,.7);
    text-align: center;
    margin-top: 16px;
    animation: tapPulse 1.5s ease-in-out infinite;
  }
  @keyframes tapPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  /* ===== POWER RING ===== */
  .power-ring {
    position: absolute;
    width: 120px; height: 120px;
    border: 4px solid rgba(255,255,255,.6);
    border-radius: 50%;
    pointer-events: none;
    animation: ringPulse 1.8s ease-in-out infinite;
  }
  @keyframes ringPulse {
    0%   { transform: scale(2.5); opacity: .3; }
    50%  { transform: scale(1.0); opacity: .9; }
    100% { transform: scale(2.5); opacity: .3; }
  }

  /* ===== IDLE BOUNCE ===== */
  .idle-bounce {
    animation: idleBounce 1.5s ease-in-out infinite;
  }
  @keyframes idleBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  /* ===== THROW ZONE ===== */
  .throw-zone {
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }

  .throw-ball {
    font-size: 0; line-height: 0;
    transition: transform .15s ease-out;
    cursor: grab;
    z-index: 5;
  }
  .throw-ball.spring-back {
    transition: transform .3s cubic-bezier(.34,1.56,.64,1);
  }
  .throw-ball.animating {
    transition: none;
    will-change: transform;
  }

  .throw-hint {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: rgba(255,255,255,.7);
    text-align: center;
    text-shadow: 1px 1px 0 rgba(0,0,0,.3);
    margin-bottom: 8px;
  }

  .swipe-arrow {
    display: block; margin: 0 auto 4px;
    width: 0; height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-bottom: 14px solid rgba(255,255,255,.7);
    animation: arrowBounce 1.2s ease-in-out infinite;
  }
  @keyframes arrowBounce {
    0%, 100% { transform: translateY(0); opacity: .6; }
    50% { transform: translateY(-10px); opacity: 1; }
  }

  .throw-fallback {
    margin-top: 12px;
    font-size: 14px;
    opacity: 0;
    pointer-events: none;
    transition: opacity .3s;
  }
  .throw-fallback.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* ===== TIMING FEEDBACK ===== */
  .timing-label {
    position: absolute;
    font-family: 'Press Start 2P', monospace;
    font-size: 16px;
    color: #fff;
    text-shadow: 2px 2px 0 rgba(0,0,0,.5);
    animation: timingPop .6s ease-out forwards;
    pointer-events: none;
    z-index: 10;
  }
  .timing-label.great { color: var(--poke-yellow, #FFCB05); font-size: 20px; }
  .timing-label.nice { color: #5DAA68; }
  @keyframes timingPop {
    0% { transform: scale(0) translateY(0); opacity: 1; }
    40% { transform: scale(1.3) translateY(-10px); opacity: 1; }
    100% { transform: scale(1) translateY(-30px); opacity: 0; }
  }

  /* ===== SHAKE ANIMATION (at target position) ===== */
  .shake-at-target {
    animation: pokeShake3 1.5s ease;
  }
  @keyframes pokeShake3 {
    0% { transform: rotate(0); }
    15% { transform: rotate(-18deg); }
    30% { transform: rotate(18deg); }
    45% { transform: rotate(-10deg); }
    60% { transform: rotate(10deg); }
    75% { transform: rotate(-4deg); }
    100% { transform: rotate(0); }
  }

  /* ===== IMPACT FLASH ===== */
  .catch-screen.flash-impact::after {
    content: '';
    position: absolute; inset: 0;
    background: #fff;
    opacity: 0;
    animation: impactFlash 200ms ease-out forwards;
    pointer-events: none;
    z-index: 100;
  }
  @keyframes impactFlash {
    0%   { opacity: 0.8; }
    100% { opacity: 0; }
  }

  /* ===== PARTICLES ===== */
  .particle {
    position: absolute;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--poke-yellow, #FFCB05);
    animation: particleBurst 0.6s ease-out forwards;
    pointer-events: none;
    z-index: 50;
  }
  @keyframes particleBurst {
    0%   { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
  }

  /* ===== GOTCHA TEXT ===== */
  .gotcha-text {
    font-family: 'Press Start 2P', monospace;
    font-size: 24px;
    color: var(--poke-yellow, #FFCB05);
    text-shadow: 3px 3px 0 rgba(0,0,0,.5);
    animation: gotchaScale .6s ease;
    text-align: center;
    margin: 20px 0;
  }
  @keyframes gotchaScale {
    0% { transform: scale(0) rotate(-30deg); }
    60% { transform: scale(1.2) rotate(5deg); }
    100% { transform: scale(1) rotate(0); }
  }

  .spot-number {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: rgba(255,255,255,.6);
    text-align: center;
  }

  /* ===== BULBASAUR CELEBRATE ===== */
  .bulba-celebrate {
    text-align: center;
    margin-top: 12px;
    font-size: 0; line-height: 0;
    animation: bulbaCelebrate 1s ease 0.3s both;
  }
  @keyframes bulbaCelebrate {
    0%   { transform: translateY(40px) scale(0); opacity: 0; }
    30%  { transform: translateY(-8px) scale(1.1); opacity: 1; }
    50%  { transform: translateY(4px) scale(0.95); }
    70%  { transform: translateY(-2px) scale(1.02); }
    100% { transform: translateY(0) scale(1); }
  }

  /* ===== REGISTRATION BOTTOM SHEET ===== */
  .reg-sheet {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    max-height: 85vh;
    background: #fff;
    border-radius: 20px 20px 0 0;
    z-index: 205;
    transform: translateY(100%);
    transition: transform .4s cubic-bezier(.32,.72,.24,1);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: env(safe-area-inset-bottom);
    box-shadow: 0 -4px 30px rgba(0,0,0,.3);
  }
  .reg-sheet.show {
    transform: translateY(0);
  }

  .sheet-handle {
    width: 36px; height: 4px;
    background: #ddd; border-radius: 2px;
    margin: 12px auto;
  }

  .sheet-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px 12px;
    border-bottom: 2px solid #f0f0f0;
  }
  .sheet-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 11px; color: var(--poke-dark, #2C2C54);
  }
  .sheet-run-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px; color: #888;
    background: none; border: 2px solid #ddd;
    border-radius: 8px; padding: 8px 12px;
    cursor: pointer;
  }
  .sheet-run-btn:active { transform: scale(.97); }

  .sheet-body {
    padding: 16px 20px;
  }

  /* ===== REGISTRATION FORM ===== */
  .reg-field { margin: 12px 0; }
  .reg-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px; color: #666;
    margin-bottom: 6px; display: block;
  }
  .reg-input {
    width: 100%; border: 2px solid #ddd; border-radius: 10px; padding: 12px;
    font-family: 'Quicksand', sans-serif; font-size: 15px; font-weight: 600;
    outline: none; transition: border-color .2s;
    box-sizing: border-box;
  }
  .reg-input:focus { border-color: var(--poke-blue, #3B4CCA); }
  .reg-textarea {
    width: 100%; border: 2px solid #ddd; border-radius: 10px; padding: 12px;
    font-family: 'Quicksand', sans-serif; font-size: 14px;
    outline: none; resize: vertical; min-height: 60px;
    box-sizing: border-box;
  }

  .type-selector { display: flex; gap: 6px; flex-wrap: wrap; }
  .type-btn {
    padding: 8px 12px; border-radius: 10px; border: 2px solid #ddd;
    font-size: 12px; cursor: pointer; transition: all .15s;
    background: #fff; font-weight: 600; min-height: 44px;
  }
  .type-btn.selected { border-width: 3px; color: #fff; }

  .rarity-selector { display: flex; gap: 10px; }
  .rarity-btn {
    padding: 8px 14px; border-radius: 10px; border: 2px solid #ddd;
    font-size: 16px; cursor: pointer; transition: all .15s; background: #fff;
  }
  .rarity-btn.selected { border-color: var(--poke-yellow); background: var(--electric-bg); }

  .photo-preview {
    width: 100%; max-height: 200px; object-fit: cover; border-radius: 10px;
    margin-top: 8px; display: none;
  }
  .photo-preview.show { display: block; }

  .map-links { display: flex; gap: 8px; margin: 12px 0; }
  .map-link {
    flex: 1; padding: 8px; border: 2px solid #ddd; border-radius: 8px;
    text-decoration: none; text-align: center; font-size: 11px;
    font-weight: 700; color: var(--poke-dark); transition: all .15s;
  }
  .map-link:active { transform: scale(.97); }

  .photo-upload-btn {
    display: block; width: 100%; padding: 14px; text-align: center;
    border: 2px dashed var(--water-border, #B8D4F0); border-radius: 10px;
    background: var(--water-bg, #E8F2FF); color: var(--water, #4A90D9);
    font-family: 'Quicksand', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; transition: all .15s;
  }
  .photo-upload-btn:active { transform: scale(.98); }

  .bulba-reaction {
    font-size: 13px; color: var(--grass, #5DAA68); font-weight: 700;
    margin: 12px 0; padding: 10px; background: var(--grass-bg); border-radius: 10px;
  }

  .sheet-catch-btn {
    position: sticky; bottom: 0;
    width: 100%; padding: 16px;
    background: #fff;
    border-top: 2px solid #f0f0f0;
    display: flex; justify-content: center;
  }

  /* ===== SCANLINE WIPE TRANSITION ===== */
  .wipe-transition {
    position: absolute; inset: 0;
    background: #000;
    z-index: 50;
    animation: scanlineWipe .4s ease-in-out;
    pointer-events: none;
  }
  @keyframes scanlineWipe {
    0%   { clip-path: inset(0 0 100% 0); }
    50%  { clip-path: inset(0 0 0 0); }
    100% { clip-path: inset(100% 0 0 0); }
  }

  /* ===== ARIA LIVE REGION ===== */
  .sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0,0,0,0); white-space: nowrap; border: 0;
  }

  /* ===== REDUCED MOTION ===== */
  @media (prefers-reduced-motion: reduce) {
    .beat-enter, .tap-prompt, .power-ring, .idle-bounce,
    .swipe-arrow, .throw-ball, .shake-at-target,
    .gotcha-text, .bulba-celebrate, .particle,
    .timing-label, .wipe-transition {
      animation: none !important;
      transition: none !important;
    }
    .catch-screen.flash-impact::after {
      animation: none !important;
    }
    .reg-sheet {
      transition: none !important;
    }
    .target-sprite {
      transition: none !important;
    }
  }
`);

export default sheet;
