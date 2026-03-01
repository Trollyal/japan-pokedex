// components/catch/catch-coordinator.js — <screen-catch-flow> orchestration

import sharedStyles from '../../lib/shared-styles.js';
import catchStyles from './catch-styles.js';
import { getState } from '../../lib/state.js';
import { bus } from '../../lib/events.js';
import { acquirePosition, haversineDistance } from '../../lib/gps.js';
import { putBlob } from '../../lib/storage.js';
import { sfx } from '../../lib/audio.js';
import { sprite } from '../../lib/sprites.js';
import { checkAchievements } from '../../data/badges.js';
import { checkLocationEasterEggs } from '../../data/locations.js';
import { localDateStr } from '../../lib/date-utils.js';
import { getCurrentBall } from '../../lib/progression.js';

import * as beatEncounter from './beat-encounter.js';
import * as beatThrow from './beat-throw.js';
import * as beatGotcha from './beat-gotcha.js';
import * as beatRegister from './beat-register.js';

// Beat state machine: idle → encounter → throw → gotcha → register → idle
const BEATS = { idle: null, encounter: beatEncounter, throw: beatThrow, gotcha: beatGotcha, register: beatRegister };

class ScreenCatchFlow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, catchStyles];
    this._beat = 'idle';
    this._beatCleanup = null;
    this._position = null;
    this._historyPushed = false;
    this._gpsAbort = null;
    this._unsubs = [];
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = /*html*/`
      <div class="catch-screen" id="screen" role="dialog" aria-modal="true" aria-label="Catch a spot">
        <button class="run-btn-x" id="run-btn" aria-label="Close">&times;</button>
        <div class="beat-container" id="beat-container"></div>
        <div class="sr-only" aria-live="polite" id="announcer"></div>
      </div>
    `;

    this._screen = this.shadowRoot.getElementById('screen');
    this._container = this.shadowRoot.getElementById('beat-container');
    this._announcer = this.shadowRoot.getElementById('announcer');
    this._runBtn = this.shadowRoot.getElementById('run-btn');

    // Run button
    this._runBtn.addEventListener('click', () => this._close());

    // Event bus
    this._unsubs.push(
      bus.on('start-catch', () => this._startCatch()),
      bus.on('navigate', () => { if (this._beat !== 'idle') this._close(); }),
    );

    // Popstate (back button / iOS swipe-back)
    this._onPopstate = () => {
      if (this._beat !== 'idle' && this._historyPushed) {
        this._historyPushed = false;
        this._close(/* skipHistoryBack */ true);
      }
    };
    window.addEventListener('popstate', this._onPopstate);

    // ESC key
    this._onKeydown = (e) => {
      if (e.key === 'Escape' && this._beat !== 'idle') this._close();
    };
    window.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    window.removeEventListener('popstate', this._onPopstate);
    window.removeEventListener('keydown', this._onKeydown);
    this._cleanupBeat();
  }

  // ===== START CATCH FLOW =====
  async _startCatch() {
    if (this._beat !== 'idle') return;

    this._position = null;

    // Push history state (no hash change — avoids router's hashchange listener)
    history.pushState({ catchFlowOpen: true }, '');
    this._historyPushed = true;

    // Show full-screen
    this._screen.classList.add('show');

    // Hide app shell chrome
    this._toggleShellChrome(false);

    sfx('catch-encounter');

    // Get ball name from progression
    const state = getState();
    const ball = getCurrentBall(state);
    this._ballName = ball?.name || 'pokeball';

    // Transition to encounter beat
    this._transitionTo('encounter');

    // Start GPS acquisition
    this._acquireGPS();
  }

  // ===== GPS LIFECYCLE =====
  async _acquireGPS() {
    // Create abort mechanism
    let cancelled = false;
    this._gpsAbort = () => { cancelled = true; };

    try {
      this._position = await acquirePosition();
      if (cancelled) return;

      // Update encounter beat GPS display if still on it
      if (this._beat === 'encounter' && this._container._updateGps) {
        this._container._updateGps(
          `📍 Locked! (±${Math.round(this._position.accuracy)}m)`,
          false
        );
      }

      this._checkNaraEasterEgg();
      this._checkLocationEasterEggs();
    } catch (err) {
      if (cancelled) return;
      if (this._beat === 'encounter' && this._container._updateGps) {
        this._container._updateGps(err.message, true);
      }
    }

    // Signal GPS ready regardless (encounter shows tap prompt)
    if (!cancelled && this._beat === 'encounter' && this._container._gpsReady) {
      this._container._gpsReady();
    }
  }

  // ===== BEAT STATE MACHINE =====
  _transitionTo(beat) {
    this._cleanupBeat();
    this._beat = beat;
    this._container.innerHTML = '';

    const module = BEATS[beat];
    if (!module) return;

    const state = getState();
    const spotNumber = (state.caughtSpots?.length || 0) + 1;

    const ctx = {
      position: this._position,
      ballName: this._ballName,
      spotType: 'normal',
      spotNumber,
      screen: this._screen,
      announce: (text) => this._announce(text),
      onAdvance: () => this._onBeatAdvance(),
      onClose: () => this._close(),
      onThrown: (data) => this._onThrown(data),
      onCatch: (data) => this._onCatch(data),
    };

    this._beatCleanup = module.render(this._container, ctx);
  }

  _cleanupBeat() {
    if (this._beatCleanup) {
      this._beatCleanup();
      this._beatCleanup = null;
    }
  }

  _onBeatAdvance() {
    switch (this._beat) {
      case 'encounter':
        this._transitionTo('throw');
        break;
      case 'gotcha':
        this._transitionTo('register');
        break;
    }
  }

  _onThrown(data) {
    // Ball reached target — shake, then gotcha
    sfx('catch-heartbeat');
    sfx('catch-shake');

    // Show pokeball shaking at target position
    const ballSprite = sprite(this._ballName || 'pokeball', 40);
    const shakeContainer = document.createElement('div');
    shakeContainer.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;z-index:2;';
    shakeContainer.innerHTML = /*html*/`
      <div style="flex:0 0 33%"></div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">
        <div class="shake-at-target" style="font-size:0;line-height:0">${ballSprite}</div>
      </div>
      <div style="flex:0 0 auto;min-height:120px"></div>
    `;

    this._container.appendChild(shakeContainer);

    // After shake animation, transition to gotcha
    this._shakeTimer = setTimeout(() => {
      shakeContainer.remove();
      this._transitionTo('gotcha');
    }, 1500);
  }

  async _onCatch(formData) {
    const state = getState();
    const spotId = `spot-${Date.now()}`;
    const now = new Date();

    const spot = {
      id: spotId,
      nickname: formData.nickname,
      type: formData.type,
      rarity: formData.rarity,
      notes: formData.notes,
      lat: this._position?.lat || null,
      lng: this._position?.lng || null,
      accuracy: this._position?.accuracy || null,
      hasPhoto: !!formData.photoBlob,
      timestamp: now.toISOString(),
      number: (state.caughtSpots?.length || 0) + 1,
    };

    // Store photo blob in IndexedDB
    if (formData.photoBlob) {
      await putBlob(spotId, formData.photoBlob);
    }

    // Update state
    state.caughtSpots = [...(state.caughtSpots || []), spot];

    // Trip start date
    if (!state.tripStartDate) {
      state.tripStartDate = now.toISOString();
    }

    // Distance calculation
    const spots = state.caughtSpots;
    if (spots.length >= 2 && this._position) {
      const prev = spots[spots.length - 2];
      if (prev.lat && prev.lng) {
        const dist = haversineDistance(prev.lat, prev.lng, this._position.lat, this._position.lng);
        state.totalDistance = (state.totalDistance || 0) + dist;
      }
    }

    // Catch streak
    const today = localDateStr(now);
    const streak = state.catchStreak || { count: 0, lastDate: null };
    if (streak.lastDate !== today) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = localDateStr(yesterday);
      if (streak.lastDate === yesterdayStr) {
        streak.count++;
      } else {
        streak.count = 1;
      }
      streak.lastDate = today;
    }
    state.catchStreak = { ...streak };

    // Time-based achievements
    const hour = now.getHours();
    const prevAch = { ...state.achievements };
    if (hour >= 22 || hour < 5) state.achievements = { ...state.achievements, nightOwl: true };
    if (hour >= 5 && hour < 7) state.achievements = { ...state.achievements, earlyBird: true };
    if (!prevAch.nightOwl && state.achievements.nightOwl) bus.emit('badge-earned', { badge: 'nightOwl' });
    if (!prevAch.earlyBird && state.achievements.earlyBird) bus.emit('badge-earned', { badge: 'earlyBird' });

    // Longest streak
    const currentStreak = state.catchStreak?.count || 0;
    if (currentStreak > (state.longestStreak || 0)) {
      state.longestStreak = currentStreak;
    }

    // Check all achievements (centralized)
    const newlyEarned = checkAchievements(state);
    for (const key of newlyEarned) {
      bus.emit('badge-earned', { badge: key });
    }

    // First type discovery toast
    const typeCount = state.caughtSpots.filter(s => s.type === spot.type).length;
    if (typeCount === 1) bus.emit('show-toast', { text: `First ${spot.type} spot discovered!` });

    // Emit events
    bus.emit('spot-caught', { spot });

    // Close and toast
    this._close();
    const total = state.caughtSpots.length;
    bus.emit('show-toast', { text: `Pokédex updated! ${total}/??? spots catalogued.` });
  }

  // ===== EASTER EGGS =====
  _checkNaraEasterEgg() {
    if (!this._position) return;
    const state = getState();
    if (state.naraEasterEgg) return;
    const { lat, lng } = this._position;
    if (lat >= 34.68 && lat <= 34.69 && lng >= 135.83 && lng <= 135.85) {
      state.naraEasterEgg = true;
      state.achievements = { ...state.achievements, naraDeer: true };
      bus.emit('nara-deer');
    }
  }

  _checkLocationEasterEggs() {
    if (!this._position) return;
    const state = getState();
    const loc = checkLocationEasterEggs(this._position.lat, this._position.lng, state);
    if (loc) {
      state.locationEasterEggs = { ...state.locationEasterEggs, [loc.id]: true };
      bus.emit('location-easter-egg', { location: loc });
    }
  }

  // ===== CLOSE =====
  _close(skipHistoryBack = false) {
    // Cancel GPS
    if (this._gpsAbort) {
      this._gpsAbort();
      this._gpsAbort = null;
    }

    // Cancel shake timer
    clearTimeout(this._shakeTimer);

    // Cleanup beat
    this._cleanupBeat();
    this._beat = 'idle';
    this._container.innerHTML = '';

    // Hide screen
    this._screen.classList.remove('show', 'flash-impact');
    this._screen.style.background = '';

    // Restore app shell chrome
    this._toggleShellChrome(true);

    // History management
    if (this._historyPushed && !skipHistoryBack) {
      this._historyPushed = false;
      history.back();
    }
    this._historyPushed = false;

    this._position = null;
  }

  // ===== HELPERS =====
  _announce(text) {
    if (this._announcer) {
      this._announcer.textContent = '';
      // Force re-announcement by clearing then setting
      requestAnimationFrame(() => {
        this._announcer.textContent = text;
      });
    }
  }

  _toggleShellChrome(show) {
    const shell = document.querySelector('app-shell');
    if (!shell) return;
    const header = shell.querySelector('.header');
    const nav = shell.querySelector('.bottom-nav');
    const fab = shell.querySelector('#pokeball-fab');
    if (header) header.style.display = show ? '' : 'none';
    if (nav) nav.style.display = show ? '' : 'none';
    if (fab) fab.style.display = show ? '' : 'none';
  }
}

customElements.define('screen-catch-flow', ScreenCatchFlow);
