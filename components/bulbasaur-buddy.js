// components/bulbasaur-buddy.js — Persistent floating Bulbasaur companion

import sharedStyles from '../lib/shared-styles.js';
import { bus } from '../lib/events.js';
import { sprite } from '../lib/sprites.js';
import { sfx } from '../lib/audio.js';

const MOODS = {
  happy:    { sprite: 'bulbasaur-happy' },
  excited:  { sprite: 'bulbasaur-excited' },
  sleepy:   { sprite: 'bulbasaur-sleepy' },
  confused: { sprite: 'bulbasaur-confused' },
  sparkle:  { sprite: 'bulbasaur-excited' },
};

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: block; position: fixed; bottom: 160px; right: 12px; z-index: 98; pointer-events: none; }

  .buddy {
    width: 48px; height: 48px; cursor: pointer; pointer-events: auto;
    display: flex; align-items: center; justify-content: center;
    transition: transform .2s;
  }
  .buddy img { image-rendering: pixelated; }

  .buddyBounce   { animation: buddyBounce .5s ease; }
  .buddyExcited  { animation: buddyExcited .6s ease; }
  .buddySparkle  { animation: buddySparkle .7s ease; }
  .buddyConfused { animation: buddyConfused .5s ease; }
  .buddySleepy   { animation: buddySleepy 2s ease-in-out infinite; }
  .buddyWiggle   { animation: buddyWiggle .4s ease; }

  @keyframes buddyBounce {
    0%, 100% { transform: translateY(0); }
    40% { transform: translateY(-14px); }
  }
  @keyframes buddyExcited {
    0% { transform: translateY(0) scale(1); }
    25% { transform: translateY(-16px) scale(1.1); }
    50% { transform: translateY(-4px) scale(1); }
    75% { transform: translateY(-10px) scale(1.05); }
    100% { transform: translateY(0) scale(1); }
  }
  @keyframes buddySparkle {
    0% { transform: scale(1); filter: brightness(1); }
    30% { transform: scale(1.2); filter: brightness(1.5) drop-shadow(0 0 6px rgba(255,203,5,.8)); }
    60% { transform: scale(1.1); filter: brightness(1.2) drop-shadow(0 0 3px rgba(255,203,5,.4)); }
    100% { transform: scale(1); filter: brightness(1); }
  }
  @keyframes buddyConfused {
    0% { transform: rotate(0); }
    20% { transform: rotate(-12deg); }
    40% { transform: rotate(12deg); }
    60% { transform: rotate(-8deg); }
    80% { transform: rotate(4deg); }
    100% { transform: rotate(0); }
  }
  @keyframes buddySleepy {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(3px); }
  }
  @keyframes buddyWiggle {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    50% { transform: translateX(6px); }
    75% { transform: translateX(-3px); }
  }
`);

class BulbasaurBuddy extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._idleTimer = null;
    this._moodTimer = null;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `<div class="buddy" id="buddy">${sprite('bulbasaur-happy', 40)}</div>`;

    // Tap handler
    this.shadowRoot.getElementById('buddy').addEventListener('click', () => {
      sfx('bulbasaur-tap');
      const randomMoods = ['happy', 'excited', 'confused'];
      const mood = randomMoods[Math.floor(Math.random() * randomMoods.length)];
      this._setMood(mood, 'buddyBounce', 1500);
    });

    // Bus listeners for mood reactions
    this._unsubs = [
      bus.on('spot-caught', () => this._setMood('excited', 'buddyExcited', 2000)),
      bus.on('badge-earned', () => this._setMood('sparkle', 'buddySparkle', 2500)),
      bus.on('battle-correct', () => this._setMood('happy', 'buddyWiggle', 1200)),
      bus.on('battle-wrong', () => this._setMood('confused', 'buddyConfused', 1500)),
      bus.on('navigate', () => this._setMood('happy', 'buddyBounce', 800)),
    ];

    // Start idle timer
    this._resetIdleTimer();
  }

  disconnectedCallback() {
    if (this._unsubs) this._unsubs.forEach(fn => fn());
    clearTimeout(this._idleTimer);
    clearTimeout(this._moodTimer);
  }

  _setMood(moodName, animClass, duration) {
    const buddy = this.shadowRoot.getElementById('buddy');
    if (!buddy) return;

    const mood = MOODS[moodName] || MOODS.happy;
    buddy.innerHTML = sprite(mood.sprite, 40);

    // Apply animation
    buddy.className = 'buddy';
    void buddy.offsetWidth; // force reflow
    buddy.classList.add(animClass);

    // Reset idle timer
    this._resetIdleTimer();

    // Revert to happy after duration
    clearTimeout(this._moodTimer);
    this._moodTimer = setTimeout(() => {
      buddy.className = 'buddy';
      buddy.innerHTML = sprite('bulbasaur-happy', 40);
    }, duration);
  }

  _resetIdleTimer() {
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      clearTimeout(this._moodTimer);
      const buddy = this.shadowRoot.getElementById('buddy');
      if (!buddy) return;
      buddy.innerHTML = sprite('bulbasaur-sleepy', 40);
      buddy.className = 'buddy buddySleepy';
    }, 30 * 60 * 1000); // 30 minutes
  }
}

customElements.define('bulbasaur-buddy', BulbasaurBuddy);
