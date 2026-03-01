// components/wild-encounter.js — Reusable encounter overlay for facts + Nara deer

import sharedStyles from '../lib/shared-styles.js';
import { getState } from '../lib/state.js';
import { bus } from '../lib/events.js';
import { FACTS } from '../data/facts.js';
import { sprite } from '../lib/sprites.js';
import { sfx } from '../lib/audio.js';
import { checkAchievements } from '../data/badges.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: contents; }

  .wild-overlay {
    position: fixed; inset: 0; z-index: 250;
    background: rgba(0,0,0,.85);
    display: none; align-items: center; justify-content: center; padding: 20px;
  }
  .wild-overlay.show { display: flex; }

  .wild-card {
    background: #fff; border: 4px solid var(--poke-dark, #2C2C54);
    border-radius: 20px; padding: 28px 24px; width: 100%; max-width: min(360px, 100%);
    max-height: 85vh; overflow-y: auto;
    text-align: center; animation: wildEnter .5s ease;
  }
  @keyframes wildEnter {
    0% { opacity: 0; transform: translateY(40px) scale(.8); }
    60% { transform: translateY(-5px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .wild-emoji { font-size: 64px; margin: 12px 0; }
  .wild-title {
    font-family: 'Press Start 2P', monospace; font-size: 12px;
    color: var(--poke-dark); margin: 12px 0; line-height: 1.8;
  }
  .wild-text {
    font-size: 15px; line-height: 1.7; color: #555; margin: 16px 0;
    font-weight: 600;
  }
  .wild-region {
    font-family: 'Press Start 2P', monospace; font-size: 9px;
    color: #757575; margin-bottom: 8px;
  }

  .wild-btns { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }

  /* Nara deer animation */
  .deer-wander {
    animation: deerWalk 3s ease-in-out;
    display: inline-block;
  }
  @keyframes deerWalk {
    0% { transform: translateX(-100px) scaleX(-1); }
    30% { transform: translateX(0) scaleX(-1); }
    50% { transform: translateX(20px) scaleX(-1); }
    70% { transform: translateX(-10px) scaleX(1); }
    100% { transform: translateX(0) scaleX(1); }
  }
`);

class WildEncounter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `<div class="wild-overlay" id="overlay"></div>`;

    this._unsubs = [
      bus.on('nara-deer', () => this._showNaraDeer()),
      bus.on('location-easter-egg', (e) => this._showLocationEasterEgg(e.detail.location)),
    ];
  }

  disconnectedCallback() {
    if (this._unsubs) this._unsubs.forEach(fn => fn());
  }

  _showFact(fact) {
    sfx('wild-fact');
    const overlay = this.shadowRoot.getElementById('overlay');
    overlay.innerHTML = `
      <div class="wild-card">
        <div class="wild-emoji" style="font-size:0">${sprite('scene-wild-fact', 64)}</div>
        <div class="wild-title">A wild FACT appeared!</div>
        <div class="wild-region">${fact.region} · ${fact.category}</div>
        <div class="wild-text">${fact.text}</div>
        <div class="wild-btns">
          <button class="btn-primary" id="catch-fact">CATCH!</button>
          <button class="btn-secondary" id="run-fact">RUN</button>
        </div>
      </div>
    `;
    overlay.classList.add('show');

    overlay.querySelector('#catch-fact').addEventListener('click', () => {
      const state = getState();
      if (!state.caughtFacts.includes(fact.id)) {
        state.caughtFacts = [...state.caughtFacts, fact.id];
      }
      overlay.classList.remove('show');
      bus.emit('show-toast', { text: `Fact caught! ${state.caughtFacts.length} collected.` });
      // Check fact-hunter achievement
      const newlyEarned = checkAchievements(state);
      for (const key of newlyEarned) {
        bus.emit('badge-earned', { badge: key });
      }
    });

    overlay.querySelector('#run-fact').addEventListener('click', () => {
      overlay.classList.remove('show');
    });
  }

  _showLocationEasterEgg(location) {
    // sfx handled by bus auto-listener in lib/audio.js (bus.on('location-easter-egg'))
    const overlay = this.shadowRoot.getElementById('overlay');
    const sceneSprite = sprite(location.sprite, 64) || sprite('scene-wild-fact', 64);
    overlay.innerHTML = `
      <div class="wild-card">
        <div class="wild-emoji" style="font-size:0">${sceneSprite}</div>
        <div class="wild-title">${location.name} discovered!</div>
        <div class="wild-text">
          ${location.text}<br><br>
          ${sprite('bulbasaur-excited', 24)} Bulbasaur is thrilled!
        </div>
        <div class="wild-btns">
          <button class="btn-primary" id="ok-location">Amazing!</button>
        </div>
      </div>
    `;
    overlay.classList.add('show');

    overlay.querySelector('#ok-location').addEventListener('click', () => {
      overlay.classList.remove('show');
      bus.emit('show-toast', { text: `${location.name} added to your discoveries!` });
    });
  }

  _showNaraDeer() {
    const overlay = this.shadowRoot.getElementById('overlay');
    overlay.innerHTML = `
      <div class="wild-card">
        <div class="wild-emoji"><span class="deer-wander" style="font-size:0;display:inline-block">${sprite('scene-nara-deer', 64)}</span></div>
        <div class="wild-title">Oh? A wild DEER appeared!</div>
        <div class="wild-text">
          A Nara deer wanders up to you and Bulbasaur!<br><br>
          ${sprite('bulbasaur-confused', 24)} Bulbasaur looks confused...
        </div>
        <div class="wild-btns">
          <button class="btn-primary" id="ok-deer">Amazing! ${sprite('scene-nara-deer', 16)}</button>
        </div>
      </div>
    `;
    overlay.classList.add('show');

    overlay.querySelector('#ok-deer').addEventListener('click', () => {
      overlay.classList.remove('show');
      bus.emit('show-toast', { text: '🦌 Nara Deer Encounter badge earned!' });
      bus.emit('badge-earned', { badge: 'naraDeer' });
    });
  }
}

customElements.define('wild-encounter', WildEncounter);

// Export helper for app.js to trigger a random wild fact
export function showWildFact(state) {
  const el = document.querySelector('wild-encounter');
  if (!el) return;

  const caughtIds = new Set(state.caughtFacts || []);
  const uncaught = FACTS.filter(f => !caughtIds.has(f.id));
  if (!uncaught.length) return;

  const fact = uncaught[Math.floor(Math.random() * uncaught.length)];
  el._showFact(fact);
}
