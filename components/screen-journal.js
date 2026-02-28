// components/screen-journal.js — Spot list with type filters, search, photo thumbnails

import sharedStyles from '../lib/shared-styles.js';
import { getState, onStateChange } from '../lib/state.js';
import { bus } from '../lib/events.js';
import { SPOT_TYPES, RARITY } from '../lib/pokemon-types.js';
import { getBlob, deleteBlob } from '../lib/storage.js';
import { sprite } from '../lib/sprites.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: block; padding: 20px 28px; animation: fadeIn .3s ease; }

  .journal-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }
  .journal-header h2 {
    font-family: 'Press Start 2P', monospace; font-size: 10px;
    color: var(--poke-dark);
  }
  .streak-badge {
    font-family: 'Press Start 2P', monospace; font-size: 9px;
    background: var(--electric-bg); color: #7D5E00;
    padding: 4px 10px; border-radius: 10px;
  }

  .search-bar {
    background: #fff; border: 2px solid #e0d8cc; border-radius: 12px;
    padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
  }
  .search-bar input {
    border: none; outline: none; font-family: 'Quicksand', sans-serif; font-size: 14px;
    flex: 1; background: transparent;
  }
  .search-bar svg { width: 18px; height: 18px; color: #aaa; flex-shrink: 0; }
  .search-bar img { flex-shrink: 0; opacity: .5; }

  .type-filters {
    display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;
  }
  .filter-chip {
    padding: 10px 16px; border-radius: 16px; border: 2px solid;
    font-size: 11px; font-weight: 700; cursor: pointer;
    transition: all .15s; background: #fff; min-height: 44px;
  }
  .filter-chip.active { color: #fff; }

  /* Spot cards */
  .spot-card {
    background: #fff; border-radius: var(--radius, 16px); padding: 14px;
    margin: 10px 0; border-left: 4px solid; box-shadow: var(--shadow);
    display: flex; gap: 12px; cursor: pointer; transition: transform .15s;
  }
  .spot-card:active { transform: scale(.98); }
  .spot-thumb {
    width: 64px; height: 64px; border-radius: 10px; object-fit: cover;
    background: #eee; flex-shrink: 0;
  }
  .spot-thumb-placeholder {
    width: 64px; height: 64px; border-radius: 10px; background: #eee;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; flex-shrink: 0;
  }
  .spot-info { flex: 1; min-width: 0; }
  .spot-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .spot-num { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #757575; }
  .spot-rarity { font-size: 14px; }
  .spot-name { font-weight: 700; font-size: 15px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .spot-type-badge {
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 8px;
    display: inline-block; margin-bottom: 4px;
  }
  .spot-notes { font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .spot-meta { font-size: 10px; color: #888; margin-top: 4px; display: flex; gap: 8px; }
  .spot-actions { display: flex; gap: 6px; margin-top: 6px; }
  .spot-map-btn {
    font-size: 10px; padding: 4px 8px; border-radius: 6px; border: 1px solid #ddd;
    text-decoration: none; color: var(--poke-dark); background: #fff;
    min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
  }
  .release-btn {
    font-size: 10px; padding: 4px 8px; border-radius: 6px; border: 1px solid #fbb;
    color: var(--poke-red, #E3350D); background: #fff; cursor: pointer;
    min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
  }

  /* Empty state */
  .empty-state {
    text-align: center; padding: 60px 20px; color: #757575;
  }
  .empty-emoji { font-size: 60px; margin-bottom: 16px; }
  .empty-title { font-family: 'Press Start 2P', monospace; font-size: 10px; margin-bottom: 8px; }
  .empty-text { font-size: 14px; line-height: 1.6; }

  /* Confirm dialog */
  .confirm-overlay {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(0,0,0,.6);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .confirm-card {
    background: #fff; border: 4px solid var(--poke-dark, #2C2C54);
    border-radius: 16px; padding: 24px; max-width: 320px; width: 100%;
    text-align: center; animation: fadeIn .2s ease;
  }
  .confirm-card .confirm-icon { font-size: 48px; margin-bottom: 12px; }
  .confirm-card .confirm-text {
    font-size: 14px; line-height: 1.6; color: var(--poke-dark);
    font-weight: 600; margin-bottom: 20px;
  }
  .confirm-card .confirm-btns { display: flex; gap: 8px; justify-content: center; }
`);

class ScreenJournal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._activeFilters = new Set();
    this._thumbnailCache = new Map();
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
    this._unsub = onStateChange('caughtSpots', () => this._renderSpots());
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
    // Revoke thumbnail URLs
    for (const url of this._thumbnailCache.values()) URL.revokeObjectURL(url);
  }

  _render() {
    const state = getState();
    const spots = state.caughtSpots || [];
    const streak = state.catchStreak?.count || 0;

    this.shadowRoot.innerHTML = /*html*/`
      <div class="journal-header">
        <h2>${sprite('spot-other', 14)} ${spots.length} SPOTS</h2>
        ${streak >= 2 ? `<span class="streak-badge">${sprite('type-fire', 10)} ${streak}-day streak!</span>` : ''}
      </div>

      <div class="search-bar">
        ${sprite('icon-search', 20)}
        <input type="text" id="journal-search" placeholder="Search spots...">
      </div>

      <div class="type-filters" id="type-filters">
        <button class="filter-chip filter-all active" id="filter-all" style="border-color:var(--poke-dark);color:#fff;background:var(--poke-dark)">All</button>
        ${Object.entries(SPOT_TYPES).map(([key, t]) =>
          `<button class="filter-chip" data-type="${key}" style="border-color:${t.color};color:${t.color}">${t.icon} ${t.label}</button>`
        ).join('')}
      </div>

      <div id="spot-list"></div>
    `;

    this._renderSpots();
  }

  _bindEvents() {
    this.shadowRoot.getElementById('journal-search').addEventListener('input', () => this._renderSpots());

    this.shadowRoot.getElementById('type-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;

      const allChip = this.shadowRoot.getElementById('filter-all');

      // "All" chip — clear all filters
      if (chip.id === 'filter-all') {
        this._activeFilters.clear();
        this.shadowRoot.querySelectorAll('.filter-chip[data-type]').forEach(c => {
          c.classList.remove('active');
          c.style.background = '#fff';
          c.style.color = SPOT_TYPES[c.dataset.type].color;
        });
        allChip.classList.add('active');
        allChip.style.background = 'var(--poke-dark)';
        allChip.style.color = '#fff';
        this._renderSpots();
        return;
      }

      const type = chip.dataset.type;
      if (this._activeFilters.has(type)) {
        this._activeFilters.delete(type);
        chip.classList.remove('active');
        chip.style.background = '#fff';
        chip.style.color = SPOT_TYPES[type].color;
      } else {
        this._activeFilters.add(type);
        chip.classList.add('active');
        chip.style.background = SPOT_TYPES[type].color;
        chip.style.color = '#fff';
      }

      // Update "All" chip state
      if (this._activeFilters.size === 0) {
        allChip.classList.add('active');
        allChip.style.background = 'var(--poke-dark)';
        allChip.style.color = '#fff';
      } else {
        allChip.classList.remove('active');
        allChip.style.background = '#fff';
        allChip.style.color = 'var(--poke-dark)';
      }

      this._renderSpots();
    });
  }

  async _renderSpots() {
    const state = getState();
    const spots = [...(state.caughtSpots || [])].reverse();
    const query = (this.shadowRoot.getElementById('journal-search')?.value || '').toLowerCase().trim();
    const list = this.shadowRoot.getElementById('spot-list');

    let filtered = spots;
    if (query) {
      filtered = filtered.filter(s =>
        s.nickname.toLowerCase().includes(query) ||
        (s.notes || '').toLowerCase().includes(query)
      );
    }
    if (this._activeFilters.size > 0) {
      filtered = filtered.filter(s => this._activeFilters.has(s.type));
    }

    if (!filtered.length) {
      if (!spots.length) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-emoji" style="font-size:0">${sprite('scene-empty-journal', 60)}</div>
            <div class="empty-title">No spots caught yet!</div>
            <div class="empty-text">Tap the Pokéball to catch<br>your first spot!</div>
            <button class="btn-primary" id="empty-catch-btn" style="margin-top:16px">CATCH YOUR FIRST SPOT!</button>
          </div>`;
        list.querySelector('#empty-catch-btn')?.addEventListener('click', () => bus.emit('start-catch'));
      } else {
        list.innerHTML = `<div class="empty-state"><div class="empty-title">No matches</div></div>`;
      }
      return;
    }

    let html = '';
    for (const spot of filtered) {
      const t = SPOT_TYPES[spot.type] || SPOT_TYPES.normal;
      const r = RARITY[spot.rarity] || RARITY.common;
      const date = new Date(spot.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      let thumbHtml;
      if (spot.hasPhoto) {
        let url = this._thumbnailCache.get(spot.id);
        if (!url) {
          try {
            const blob = await getBlob(spot.id);
            if (blob) {
              url = URL.createObjectURL(blob);
              this._thumbnailCache.set(spot.id, url);
            }
          } catch {}
        }
        thumbHtml = url
          ? `<img class="spot-thumb" src="${url}" alt="${spot.nickname}" loading="lazy">`
          : `<div class="spot-thumb-placeholder">${t.icon}</div>`;
      } else {
        thumbHtml = `<div class="spot-thumb-placeholder">${t.icon}</div>`;
      }

      const mapLinks = spot.lat
        ? `<a class="spot-map-btn" href="https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}" target="_blank">${sprite('spot-other', 10)} Map</a>`
        : '';

      html += `
        <div class="spot-card" style="border-left-color:${t.color}" data-id="${spot.id}">
          ${thumbHtml}
          <div class="spot-info">
            <div class="spot-top">
              <span class="spot-num">#${String(spot.number).padStart(3, '0')}</span>
              <span class="spot-rarity">${r.icon}</span>
            </div>
            <div class="spot-name">${spot.nickname}</div>
            <span class="spot-type-badge" style="background:${t.bg};color:${t.color}">${t.icon} ${t.label}</span>
            ${spot.notes ? `<div class="spot-notes">${spot.notes}</div>` : ''}
            <div class="spot-meta"><span>${dateStr}</span></div>
            <div class="spot-actions">
              ${mapLinks}
              <button class="release-btn" data-release="${spot.id}">Release</button>
            </div>
          </div>
        </div>`;
    }

    list.innerHTML = html;

    // Bind release buttons
    list.querySelectorAll('.release-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._releaseSpot(btn.dataset.release);
      });
    });

    // Bind card clicks for detail
    list.querySelectorAll('.spot-card').forEach(card => {
      card.addEventListener('click', () => {
        bus.emit('open-spot-detail', { spotId: card.dataset.id });
      });
    });
  }

  _showConfirmDialog(msg) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-card">
          <div class="confirm-icon" style="font-size:0">${sprite('icon-warning', 48)}</div>
          <div class="confirm-text">${msg}</div>
          <div class="confirm-btns">
            <button class="btn-primary" id="confirm-yes">YES</button>
            <button class="btn-secondary" id="confirm-no">NO</button>
          </div>
        </div>`;
      this.shadowRoot.appendChild(overlay);
      overlay.querySelector('#confirm-yes').addEventListener('click', () => { overlay.remove(); resolve(true); });
      overlay.querySelector('#confirm-no').addEventListener('click', () => { overlay.remove(); resolve(false); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  }

  async _releaseSpot(spotId) {
    const confirmed = await this._showConfirmDialog('Release this spot? This cannot be undone!');
    if (!confirmed) return;

    const state = getState();
    state.caughtSpots = state.caughtSpots.filter(s => s.id !== spotId);

    // Delete photo blob
    deleteBlob(spotId).catch(() => {});

    // Revoke thumbnail
    const url = this._thumbnailCache.get(spotId);
    if (url) {
      URL.revokeObjectURL(url);
      this._thumbnailCache.delete(spotId);
    }

    this._renderSpots();
    bus.emit('show-toast', { text: 'Spot released.' });
  }
}

customElements.define('screen-journal', ScreenJournal);
