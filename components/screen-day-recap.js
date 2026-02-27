// components/screen-day-recap.js — Evening summary of today's catches

import sharedStyles from '../lib/shared-styles.js';
import { getState } from '../lib/state.js';
import { bus } from '../lib/events.js';
import { SPOT_TYPES } from '../lib/pokemon-types.js';
import { getBlob } from '../lib/storage.js';
import { sprite } from '../lib/sprites.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: contents; }

  .recap-overlay {
    position: fixed; inset: 0; z-index: 250;
    background: linear-gradient(180deg, rgba(44,44,84,.95), rgba(0,0,0,.95));
    display: none; align-items: center; justify-content: center; padding: 16px;
    overflow-y: auto;
  }
  .recap-overlay.show { display: flex; }

  .recap-card {
    background: #fff; border: 4px solid var(--poke-dark, #2C2C54);
    border-radius: 20px; padding: 24px; width: 100%; max-width: 380px;
    text-align: center; animation: recapIn .5s ease;
    max-height: 85vh; overflow-y: auto;
  }
  @keyframes recapIn { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: scale(1); } }

  .recap-day {
    font-family: 'Press Start 2P', monospace; font-size: 12px;
    color: var(--poke-yellow, #FFCB05);
    text-shadow: 2px 2px 0 var(--poke-dark);
    margin-bottom: 4px; line-height: 1.6;
  }
  .recap-subtitle {
    font-family: 'Press Start 2P', monospace; font-size: 8px;
    color: var(--poke-red, #E3350D); margin-bottom: 16px;
  }

  .recap-catches { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 16px 0; }
  .recap-thumb {
    width: 60px; height: 60px; border-radius: 10px; object-fit: cover;
    border: 2px solid var(--poke-dark);
  }
  .recap-thumb-placeholder {
    width: 60px; height: 60px; border-radius: 10px; background: #eee;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; border: 2px solid var(--poke-dark);
  }

  .recap-stats {
    display: flex; gap: 16px; justify-content: center; margin: 16px 0; flex-wrap: wrap;
  }
  .recap-stat {
    text-align: center;
  }
  .recap-stat-num {
    font-family: 'Press Start 2P', monospace; font-size: 18px;
    color: var(--poke-dark);
  }
  .recap-stat-label { font-size: 10px; color: #666; margin-top: 4px; }

  .recap-types { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin: 8px 0; }
  .recap-type-chip {
    padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700;
  }

  .bulba-comment {
    font-size: 13px; color: var(--grass, #5DAA68); font-weight: 700;
    margin: 16px 0; padding: 12px;
    background: var(--grass-bg, #E8F5E9); border-radius: 12px;
  }
`);

class ScreenDayRecap extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._shown = false;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `<div class="recap-overlay" id="overlay"></div>`;
  }

  async checkAndShow() {
    if (this._shown) return;

    const state = getState();
    const now = new Date();
    const hour = now.getHours();
    if (hour < 20) return; // only show after 8 PM

    const today = now.toISOString().slice(0, 10);
    const todayCatches = (state.caughtSpots || []).filter(s =>
      s.timestamp && s.timestamp.startsWith(today)
    );

    if (todayCatches.length === 0) return;

    this._shown = true;
    await this._renderRecap(state, todayCatches, now);
    this.shadowRoot.getElementById('overlay').classList.add('show');
  }

  async _renderRecap(state, catches, now) {
    // Day number
    let dayNum = 1;
    if (state.tripStartDate) {
      const start = new Date(state.tripStartDate);
      dayNum = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    // Type counts
    const typeCounts = {};
    catches.forEach(s => { typeCounts[s.type] = (typeCounts[s.type] || 0) + 1; });

    // Photo thumbnails
    let thumbsHtml = '';
    for (const spot of catches.slice(0, 8)) {
      const t = SPOT_TYPES[spot.type] || SPOT_TYPES.normal;
      if (spot.hasPhoto) {
        try {
          const blob = await getBlob(spot.id);
          if (blob) {
            const url = URL.createObjectURL(blob);
            thumbsHtml += `<img class="recap-thumb" src="${url}" alt="${spot.nickname}">`;
            continue;
          }
        } catch {}
      }
      thumbsHtml += `<div class="recap-thumb-placeholder">${t.icon}</div>`;
    }

    // Bulbasaur comment
    const comments = [
      "What a day! Bulbasaur is proud of you! 🌱✨",
      "Bulbasaur is tired but happy! Great exploring today! 🌱💤",
      "Bulbasaur can't wait for tomorrow's adventure! 🌱🌟",
      "So many discoveries! Bulbasaur is impressed! 🌱😊",
    ];
    const comment = comments[Math.floor(Math.random() * comments.length)];

    const overlay = this.shadowRoot.getElementById('overlay');
    overlay.innerHTML = `
      <div class="recap-card">
        <div class="recap-day">Day ${dayNum}</div>
        <div class="recap-subtitle">of your Kansai Adventure!</div>

        <div class="recap-catches">${thumbsHtml}</div>

        <div class="recap-stats">
          <div class="recap-stat">
            <div class="recap-stat-num">${catches.length}</div>
            <div class="recap-stat-label">Spots Today</div>
          </div>
          <div class="recap-stat">
            <div class="recap-stat-num">${Object.keys(typeCounts).length}</div>
            <div class="recap-stat-label">Types</div>
          </div>
          <div class="recap-stat">
            <div class="recap-stat-num">${state.caughtSpots?.length || 0}</div>
            <div class="recap-stat-label">Total</div>
          </div>
        </div>

        <div class="recap-types">
          ${Object.entries(typeCounts).map(([type, count]) => {
            const t = SPOT_TYPES[type] || SPOT_TYPES.normal;
            return `<span class="recap-type-chip" style="background:${t.bg};color:${t.color}">${t.icon} ${count}</span>`;
          }).join('')}
        </div>

        <div class="bulba-comment">${comment}</div>

        <button class="btn-primary" id="close-recap">GOOD NIGHT! ${sprite('icon-moon', 14)}</button>
      </div>
    `;

    overlay.querySelector('#close-recap').addEventListener('click', () => {
      overlay.classList.remove('show');
    });
  }
}

customElements.define('screen-day-recap', ScreenDayRecap);
