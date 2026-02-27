// lib/shared-styles.js — Constructable CSSStyleSheet shared across Shadow DOM components

const sheet = new CSSStyleSheet();
sheet.replaceSync(/*css*/`
  /* ===== SHADOW DOM RESET ===== */
  *, *::before, *::after { box-sizing: border-box; }

  /* ===== SHARED CARD STYLES ===== */
  .dex-card {
    background: #fff; border-radius: var(--radius, 16px); padding: 14px 16px; margin: 8px 0;
    border-left: 4px solid; box-shadow: var(--shadow, 0 4px 20px rgba(0,0,0,.12));
    transition: transform .15s;
  }
  .dex-card:active { transform: scale(.98); }
  .dex-card.fire { border-left-color: var(--fire); }
  .dex-card.water { border-left-color: var(--water); }
  .dex-card.grass { border-left-color: var(--grass); }
  .dex-card.electric { border-left-color: var(--electric); }
  .dex-card .dex-num {
    font-family: 'Press Start 2P', monospace; font-size: 8px; color: #757575; margin-bottom: 6px;
  }
  .dex-card .en { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
  .dex-card .jp { font-size: 20px; color: var(--poke-dark); margin-bottom: 2px; }
  .dex-card .romaji { font-size: 13px; color: #666; font-style: italic; }

  /* ===== SHARED BUTTON STYLES ===== */
  .btn-primary {
    background: var(--poke-red); color: #fff; border: 3px solid var(--poke-dark);
    border-radius: 12px; padding: 14px 28px; font-family: 'Press Start 2P', monospace;
    font-size: 9px; cursor: pointer; box-shadow: 0 4px 0 #a02808;
    transition: all .1s; margin: 6px;
  }
  .btn-primary:active { transform: translateY(2px); box-shadow: 0 2px 0 #a02808; }
  .btn-secondary {
    background: #fff; color: var(--poke-dark); border: 3px solid var(--poke-dark);
    border-radius: 12px; padding: 14px 28px; font-family: 'Press Start 2P', monospace;
    font-size: 9px; cursor: pointer; box-shadow: 0 4px 0 #ccc;
    transition: all .1s; margin: 6px;
  }
  .btn-secondary:active { transform: translateY(2px); box-shadow: 0 2px 0 #ccc; }

  /* ===== BADGE STYLES ===== */
  .badge-slot {
    width: 60px; height: 60px; border-radius: 50%;
    background: rgba(255,255,255,.08); border: 2px dashed rgba(255,255,255,.2);
    display: flex; align-items: center; justify-content: center;
    transition: all .3s; position: relative;
  }
  .badge-slot.earned {
    border: 2px solid var(--poke-yellow); background: rgba(245,200,66,.15);
    box-shadow: 0 0 20px rgba(245,200,66,.3); animation: badgeGlow 2s infinite;
  }
  .badge-slot .badge-icon { filter: grayscale(1) opacity(.3); display: flex; align-items: center; justify-content: center; }
  .badge-slot .badge-icon img { image-rendering: pixelated; }
  .badge-slot.earned .badge-icon { filter: none; animation: badgePop .5s ease; }
  .badge-slot .badge-label {
    position: absolute; bottom: -18px; font-family: 'Press Start 2P', monospace;
    font-size: 8px; color: rgba(255,255,255,.8); white-space: nowrap;
  }
  .badge-slot.earned .badge-label { color: var(--poke-yellow); }

  @keyframes badgeGlow {
    0%, 100% { box-shadow: 0 0 10px rgba(245,200,66,.2); }
    50% { box-shadow: 0 0 25px rgba(245,200,66,.5); }
  }
  @keyframes badgePop {
    0% { transform: scale(0) rotate(-180deg); }
    60% { transform: scale(1.3) rotate(10deg); }
    100% { transform: scale(1) rotate(0); }
  }

  /* ===== SHARED ANIMATIONS ===== */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ===== INPUT SHAKE ===== */
  @keyframes inputShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
  .shake { animation: inputShake .4s ease; }

  /* ===== UTILITY ===== */
  .pixel { font-family: 'Press Start 2P', monospace; }
  .no-results { text-align: center; padding: 40px 20px; color: #aaa; }
  .no-results .pixel { font-size: 9px; margin-top: 8px; }
`);

export default sheet;
