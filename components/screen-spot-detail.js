// components/screen-spot-detail.js — Full Pokédex-style entry for a single spot

import sharedStyles from '../lib/shared-styles.js';
import { getState } from '../lib/state.js';
import { bus } from '../lib/events.js';
import { SPOT_TYPES, RARITY } from '../lib/pokemon-types.js';
import { getBlob } from '../lib/storage.js';
import { googleMapsUrl, appleMapsUrl } from '../lib/gps.js';
import { sprite } from '../lib/sprites.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: contents; }

  .detail-overlay {
    position: fixed; inset: 0; z-index: 250;
    background: rgba(0,0,0,.7);
    display: none; align-items: center; justify-content: center; padding: 16px;
  }
  .detail-overlay.show { display: flex; }

  .detail-card {
    background: #fff; border: 4px solid var(--poke-dark, #2C2C54);
    border-radius: 20px; padding: 24px; width: 100%; max-width: 400px;
    max-height: 85vh; overflow-y: auto; position: relative;
  }

  .detail-close {
    position: absolute; top: 12px; right: 12px; background: none;
    border: none; font-size: 22px; cursor: pointer; color: #aaa; z-index: 10;
  }

  .detail-photo {
    width: 100%; max-height: 250px; object-fit: cover;
    border-radius: 12px; margin-bottom: 16px;
  }
  .detail-no-photo {
    width: 100%; height: 120px; background: #eee; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 48px; margin-bottom: 16px;
  }

  .detail-name {
    font-family: 'Press Start 2P', monospace; font-size: 14px;
    color: var(--poke-dark); margin-bottom: 4px; line-height: 1.6;
  }
  .detail-num {
    font-family: 'Press Start 2P', monospace; font-size: 9px; color: #757575;
    margin-bottom: 12px;
  }

  .detail-badges { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .detail-type-badge {
    padding: 4px 12px; border-radius: 10px; font-size: 12px; font-weight: 700;
  }
  .detail-rarity-badge {
    padding: 4px 12px; border-radius: 10px; font-size: 12px; font-weight: 700;
    background: #f5f5f0;
  }

  .detail-notes {
    font-size: 14px; line-height: 1.6; color: #555; margin: 12px 0;
    padding: 12px; background: var(--cream, #FFF8EE); border-radius: 10px;
  }

  .detail-meta {
    font-size: 12px; color: #757575; margin: 8px 0;
  }

  .detail-map-row { display: flex; gap: 8px; margin: 12px 0; }
  .detail-map-btn {
    flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 10px;
    text-decoration: none; text-align: center; font-size: 12px;
    font-weight: 700; color: var(--poke-dark);
  }

  .detail-share {
    width: 100%; margin-top: 12px;
  }
`);

class ScreenSpotDetail extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `<div class="detail-overlay" id="overlay"><div class="detail-card" id="card"></div></div>`;

    this._unsub = bus.on('open-spot-detail', (e) => this._open(e.detail.spotId));

    this.shadowRoot.getElementById('overlay').addEventListener('click', (e) => {
      if (e.target.id === 'overlay') this._close();
    });
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }

  async _open(spotId) {
    const state = getState();
    const spot = (state.caughtSpots || []).find(s => s.id === spotId);
    if (!spot) return;

    const t = SPOT_TYPES[spot.type] || SPOT_TYPES.normal;
    const r = RARITY[spot.rarity] || RARITY.common;
    const date = new Date(spot.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let photoHtml;
    if (spot.hasPhoto) {
      try {
        const blob = await getBlob(spot.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          photoHtml = `<img class="detail-photo" src="${url}" alt="${spot.nickname}">`;
        }
      } catch {}
    }
    if (!photoHtml) {
      photoHtml = `<div class="detail-no-photo">${t.icon}</div>`;
    }

    const card = this.shadowRoot.getElementById('card');
    card.innerHTML = `
      <button class="detail-close" id="close-btn">${sprite('icon-close', 18)}</button>
      ${photoHtml}
      <div class="detail-num">#${String(spot.number).padStart(3, '0')}</div>
      <div class="detail-name">${spot.nickname}</div>
      <div class="detail-badges">
        <span class="detail-type-badge" style="background:${t.bg};color:${t.color}">${t.icon} ${t.label}</span>
        <span class="detail-rarity-badge" style="box-shadow:${r.glow}">${r.icon} ${r.label}</span>
      </div>
      ${spot.notes ? `<div class="detail-notes">${spot.notes}</div>` : ''}
      <div class="detail-meta">Caught: ${dateStr}</div>
      ${spot.lat ? `
        <div class="detail-meta">${sprite('spot-other', 10)} ${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)} (±${Math.round(spot.accuracy || 0)}m)</div>
        <div class="detail-map-row">
          <a class="detail-map-btn" href="${googleMapsUrl(spot.lat, spot.lng)}" target="_blank">${sprite('spot-other', 12)} Google Maps</a>
          <a class="detail-map-btn" href="${appleMapsUrl(spot.lat, spot.lng, spot.nickname)}" target="_blank">${sprite('badge-explorer', 12)} Apple Maps</a>
        </div>
      ` : ''}
      ${navigator.share ? `<button class="btn-secondary detail-share" id="share-btn">${sprite('icon-export', 14)} Share this Spot</button>` : ''}
    `;

    card.querySelector('#close-btn').addEventListener('click', () => this._close());

    const shareBtn = card.querySelector('#share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        navigator.share({
          title: `${spot.nickname} — Japan Pokédex`,
          text: `I caught ${spot.nickname} (${t.label}) on my Kansai adventure!${spot.notes ? ' ' + spot.notes : ''}`,
          url: spot.lat ? googleMapsUrl(spot.lat, spot.lng) : undefined,
        }).catch(() => {});
      });
    }

    this.shadowRoot.getElementById('overlay').classList.add('show');
  }

  _close() {
    this.shadowRoot.getElementById('overlay').classList.remove('show');
  }
}

customElements.define('screen-spot-detail', ScreenSpotDetail);
