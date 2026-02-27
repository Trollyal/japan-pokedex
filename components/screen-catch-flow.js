// components/screen-catch-flow.js — 5-beat catch experience

import sharedStyles from '../lib/shared-styles.js';
import { getState } from '../lib/state.js';
import { bus } from '../lib/events.js';
import { acquirePosition, haversineDistance, googleMapsUrl, appleMapsUrl } from '../lib/gps.js';
import { SPOT_TYPES, RARITY } from '../lib/pokemon-types.js';
import { putBlob } from '../lib/storage.js';
import { sprite } from '../lib/sprites.js';
import { sfx } from '../lib/audio.js';
import { checkAchievements } from '../data/badges.js';
import { checkLocationEasterEggs } from '../data/locations.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: contents; }

  .catch-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,.95);
    display: none; align-items: center; justify-content: center;
    padding: 16px; overflow-y: auto;
  }
  .catch-overlay.show { display: flex; }

  .catch-panel {
    background: #fff; border: 4px solid var(--poke-dark, #2C2C54);
    border-radius: 20px; padding: 24px; width: 100%; max-width: 400px;
    text-align: center; position: relative;
    max-height: 90vh; overflow-y: auto;
  }

  .beat { display: none; animation: beatIn .4s ease; }
  .beat.active { display: block; }
  @keyframes beatIn { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: scale(1); } }

  /* Beat 1: Encounter */
  .encounter-flash {
    animation: flash .3s ease;
  }
  @keyframes flash { 0% { background: #fff; } 50% { background: var(--poke-yellow); } 100% { background: #fff; } }
  .wild-text {
    font-family: 'Press Start 2P', monospace; font-size: 14px; line-height: 1.8;
    margin: 20px 0; color: var(--poke-dark);
  }
  .silhouette { line-height: 0; filter: brightness(0); margin: 16px 0; }
  .gps-status {
    font-size: 12px; color: #666; margin: 12px 0;
  }
  .gps-status.error { color: var(--poke-red, #E3350D); }

  /* Beat 2: Throw */
  .pokeball-throw { font-size: 0; line-height: 0; margin: 20px 0; }
  .shake-anim { animation: pokeShake3 1.5s ease; }
  @keyframes pokeShake3 {
    0% { transform: translateY(-40px); }
    15% { transform: translateY(0); }
    25% { transform: rotate(-20deg); }
    35% { transform: rotate(20deg); }
    45% { transform: rotate(-12deg); }
    55% { transform: rotate(12deg); }
    65% { transform: rotate(-5deg); }
    75% { transform: rotate(0); }
    100% { transform: scale(1); }
  }

  /* Beat 3: Gotcha */
  .gotcha-text {
    font-family: 'Press Start 2P', monospace; font-size: 24px;
    color: var(--poke-yellow); text-shadow: 3px 3px 0 var(--poke-dark);
    animation: gotchaScale .6s ease;
    margin: 20px 0;
  }
  @keyframes gotchaScale { 0% { transform: scale(0) rotate(-30deg); } 60% { transform: scale(1.2) rotate(5deg); } 100% { transform: scale(1) rotate(0); } }
  .star-burst { font-size: 0; line-height: 0; margin: 10px 0; }
  .spot-number { font-family: 'Press Start 2P', monospace; font-size: 10px; color: #888; }

  /* Beat 4: Registration */
  .reg-form { text-align: left; }
  .reg-field { margin: 12px 0; }
  .reg-label { font-family: 'Press Start 2P', monospace; font-size: 9px; color: #666; margin-bottom: 6px; display: block; }
  .reg-input {
    width: 100%; border: 2px solid #ddd; border-radius: 10px; padding: 12px;
    font-family: 'Quicksand', sans-serif; font-size: 15px; font-weight: 600;
    outline: none; transition: border-color .2s;
  }
  .reg-input:focus { border-color: var(--poke-blue, #3B4CCA); }
  .reg-textarea {
    width: 100%; border: 2px solid #ddd; border-radius: 10px; padding: 12px;
    font-family: 'Quicksand', sans-serif; font-size: 14px;
    outline: none; resize: vertical; min-height: 60px;
  }

  .type-selector { display: flex; gap: 6px; flex-wrap: wrap; }
  .type-btn {
    padding: 8px 12px; border-radius: 10px; border: 2px solid #ddd;
    font-size: 12px; cursor: pointer; transition: all .15s;
    background: #fff; font-weight: 600;
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

  .btn-row { display: flex; gap: 8px; margin-top: 16px; justify-content: center; }

  /* Beat 2: Swipe-to-throw */
  .throw-zone {
    touch-action: none; user-select: none; -webkit-user-select: none;
    height: 200px; display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .throw-ball {
    font-size: 0; line-height: 0; transition: transform .15s ease-out;
    cursor: grab;
  }
  .throw-ball.spring-back { transition: transform .3s cubic-bezier(.34,1.56,.64,1); }
  .throw-hint {
    font-family: 'Press Start 2P', monospace; font-size: 9px; color: #888;
    text-align: center; margin: 8px 0; animation: hintBob 1.5s ease-in-out infinite;
  }
  @keyframes hintBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .throw-fallback { margin-top: 12px; font-size: 11px; opacity: .6; }
`);

const BULBA_REACTIONS = {
  fire: `${sprite('bulbasaur-excited', 16)} Bulbasaur is drooling! 🍜`,
  water: `${sprite('bulbasaur-happy', 16)} Bulbasaur loves hot springs! ♨️`,
  grass: `${sprite('bulbasaur-happy', 16)} Bulbasaur feels right at home! 🌸`,
  psychic: `${sprite('bulbasaur-happy', 16)} Bulbasaur is being very respectful! ⛩️`,
  electric: `${sprite('bulbasaur-excited', 16)} Bulbasaur's eyes are sparkling! ✨`,
  normal: `${sprite('bulbasaur-confused', 16)} Bulbasaur is curious! 📍`,
};

class ScreenCatchFlow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._position = null;
    this._selectedType = 'normal';
    this._selectedRarity = 'common';
    this._photoBlob = null;
  }

  connectedCallback() {
    this._render();
    this._bindStartCatch();
  }

  _render() {
    this.shadowRoot.innerHTML = /*html*/`
      <div class="catch-overlay" id="overlay">
        <div class="catch-panel" id="panel">
          <!-- Beat 1: Encounter -->
          <div class="beat" data-beat="1" id="beat1">
            <div class="silhouette" style="filter:none;font-size:0">${sprite('pokeball', 80)}</div>
            <div class="wild-text">A wild SPOT<br>appeared!</div>
            <div class="gps-status" id="gps-status">📡 Searching for GPS signal...</div>
          </div>

          <!-- Beat 2: Throw (swipe gesture + click fallback) -->
          <div class="beat" data-beat="2" id="beat2">
            <div class="throw-hint">Swipe up to throw!</div>
            <div class="throw-zone" id="throw-zone">
              <div class="throw-ball" id="throw-ball">${sprite('pokeball', 80)}</div>
            </div>
            <button class="btn-secondary throw-fallback" id="throw-btn">THROW!</button>
          </div>

          <!-- Beat 3: Gotcha -->
          <div class="beat" data-beat="3" id="beat3">
            <div class="star-burst" style="font-size:0">${sprite('scene-gotcha', 80)}</div>
            <div class="gotcha-text">Gotcha!</div>
            <div class="spot-number" id="spot-number"></div>
          </div>

          <!-- Beat 4: Registration -->
          <div class="beat" data-beat="4" id="beat4">
            <div class="reg-form">
              <div class="reg-field">
                <label class="reg-label">NICKNAME</label>
                <input class="reg-input" id="spot-name" type="text" placeholder="What's this spot called?" maxlength="60">
              </div>

              <div class="reg-field">
                <label class="reg-label">TYPE</label>
                <div class="type-selector" id="type-selector"></div>
              </div>

              <div class="reg-field">
                <label class="reg-label">RARITY</label>
                <div class="rarity-selector" id="rarity-selector"></div>
              </div>

              <div class="reg-field">
                <label class="reg-label">FIELD NOTES</label>
                <textarea class="reg-textarea" id="spot-notes" placeholder="What makes this spot special?" maxlength="200"></textarea>
              </div>

              <div class="reg-field">
                <label class="reg-label">PHOTO</label>
                <label class="photo-upload-btn">${sprite('icon-camera', 16)} Add Photo
                  <input type="file" accept="image/*" capture="environment" id="photo-input" style="display:none">
                </label>
                <img class="photo-preview" id="photo-preview" alt="Photo preview">
              </div>

              <div class="map-links" id="map-links"></div>

              <div class="bulba-reaction" id="bulba-reaction"></div>

              <div class="btn-row">
                <button class="btn-primary" id="catch-btn">CATCH!</button>
                <button class="btn-secondary" id="run-btn">RUN</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Populate type selector
    const typeSel = this.shadowRoot.getElementById('type-selector');
    Object.entries(SPOT_TYPES).forEach(([key, t]) => {
      const btn = document.createElement('button');
      btn.className = 'type-btn';
      btn.dataset.type = key;
      btn.innerHTML = `${t.icon} ${t.label}`;
      btn.style.borderColor = t.color;
      if (key === 'normal') {
        btn.classList.add('selected');
        btn.style.background = t.color;
        btn.style.color = '#fff';
      }
      typeSel.appendChild(btn);
    });

    // Populate rarity selector
    const rarSel = this.shadowRoot.getElementById('rarity-selector');
    Object.entries(RARITY).forEach(([key, r]) => {
      const btn = document.createElement('button');
      btn.className = `rarity-btn ${key === 'common' ? 'selected' : ''}`;
      btn.dataset.rarity = key;
      btn.innerHTML = r.icon;
      btn.title = r.label;
      rarSel.appendChild(btn);
    });
  }

  _bindStartCatch() {
    bus.on('start-catch', () => this._startCatch());

    // Type selection
    this.shadowRoot.getElementById('type-selector').addEventListener('click', (e) => {
      const btn = e.target.closest('.type-btn');
      if (!btn) return;
      this._selectedType = btn.dataset.type;
      this.shadowRoot.querySelectorAll('.type-btn').forEach(b => {
        b.classList.remove('selected');
        b.style.background = '#fff';
        b.style.color = '';
      });
      btn.classList.add('selected');
      btn.style.background = SPOT_TYPES[this._selectedType].color;
      btn.style.color = '#fff';
      this.shadowRoot.getElementById('bulba-reaction').innerHTML = BULBA_REACTIONS[this._selectedType] || '';
    });

    // Rarity selection
    this.shadowRoot.getElementById('rarity-selector').addEventListener('click', (e) => {
      const btn = e.target.closest('.rarity-btn');
      if (!btn) return;
      this._selectedRarity = btn.dataset.rarity;
      this.shadowRoot.querySelectorAll('.rarity-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });

    // Photo input
    this.shadowRoot.getElementById('photo-input').addEventListener('change', (e) => {
      this._handlePhoto(e.target.files[0]);
    });

    // Throw button (click fallback)
    this.shadowRoot.getElementById('throw-btn').addEventListener('click', () => this._beat2Throw());

    // Swipe gesture
    this._bindThrowGesture();

    // Catch button
    this.shadowRoot.getElementById('catch-btn').addEventListener('click', () => this._beat4Catch());

    // Run button
    this.shadowRoot.getElementById('run-btn').addEventListener('click', () => this._close());
  }

  async _startCatch() {
    this._position = null;
    this._photoBlob = null;
    this._selectedType = 'normal';
    this._selectedRarity = 'common';
    this._throwFired = false;

    // Reset throw ball visual
    const throwBall = this.shadowRoot.getElementById('throw-ball');
    if (throwBall) {
      throwBall.innerHTML = sprite('pokeball', 80);
      throwBall.style.transform = '';
      throwBall.classList.remove('shake-anim', 'spring-back');
    }

    const overlay = this.shadowRoot.getElementById('overlay');
    overlay.classList.add('show');
    sfx('catch-encounter');

    // Show Beat 1
    this._showBeat(1);
    const gpsStatus = this.shadowRoot.getElementById('gps-status');

    // Acquire GPS
    try {
      this._position = await acquirePosition();
      gpsStatus.textContent = `📍 Locked! (±${Math.round(this._position.accuracy)}m)`;
      gpsStatus.classList.remove('error');

      // Check Nara bounding box for easter egg
      this._checkNaraEasterEgg();

      // Check location easter eggs
      this._checkLocationEasterEggs();

      // Auto-advance to beat 2
      setTimeout(() => this._showBeat(2), 800);
    } catch (err) {
      gpsStatus.textContent = err.message;
      gpsStatus.classList.add('error');
      // Still allow catching without GPS
      setTimeout(() => this._showBeat(2), 1500);
    }
  }

  _bindThrowGesture() {
    const zone = this.shadowRoot.getElementById('throw-zone');
    const ball = this.shadowRoot.getElementById('throw-ball');
    let startY = 0, startTime = 0, dragging = false;

    const onStart = (e) => {
      if (this._throwFired) return;
      const point = e.touches ? e.touches[0] : e;
      startY = point.clientY;
      startTime = Date.now();
      dragging = true;
      ball.classList.remove('spring-back');
    };

    const onMove = (e) => {
      if (!dragging || this._throwFired) return;
      const point = e.touches ? e.touches[0] : e;
      const deltaY = Math.min(0, point.clientY - startY); // only up
      ball.style.transform = `translateY(${deltaY}px)`;
    };

    const onEnd = (e) => {
      if (!dragging || this._throwFired) return;
      dragging = false;
      const point = e.changedTouches ? e.changedTouches[0] : e;
      const deltaY = startY - point.clientY; // positive = up
      const duration = Date.now() - startTime;

      if (deltaY > 80 && duration < 300) {
        // Successful swipe — throw!
        this._throwFired = true;
        ball.style.transform = `translateY(-200px)`;
        navigator.vibrate?.(50);
        this._beat2Throw();
      } else {
        // Spring back
        ball.classList.add('spring-back');
        ball.style.transform = '';
      }
    };

    zone.addEventListener('touchstart', onStart, { passive: true });
    zone.addEventListener('touchmove', onMove, { passive: true });
    zone.addEventListener('touchend', onEnd);
    zone.addEventListener('mousedown', onStart);
    zone.addEventListener('mousemove', onMove);
    zone.addEventListener('mouseup', onEnd);
  }

  _beat2Throw() {
    sfx('catch-throw');
    const ball = this.shadowRoot.getElementById('throw-ball');
    ball.classList.add('shake-anim');

    // 5% break-free first attempt
    if (Math.random() < 0.05) {
      setTimeout(() => {
        sfx('catch-breakfree');
        ball.innerHTML = '<span style="font-size:24px;line-height:80px">Poof!</span>';
        this.shadowRoot.querySelector('#beat2 .throw-hint').textContent = 'Oh! It broke free!';
        setTimeout(() => {
          ball.innerHTML = sprite('pokeball', 80);
          ball.classList.remove('shake-anim');
          ball.style.transform = '';
          this._throwFired = false;
          this.shadowRoot.querySelector('#beat2 .throw-hint').textContent = 'Swipe up to throw!';
        }, 1000);
      }, 1500);
      return;
    }

    setTimeout(() => {
      // Beat 3: Gotcha!
      const state = getState();
      const spotNum = (state.caughtSpots?.length || 0) + 1;
      this.shadowRoot.getElementById('spot-number').textContent = `Spot #${String(spotNum).padStart(3, '0')}`;
      sfx('catch-success');
      navigator.vibrate?.(50);
      this._showBeat(3);

      // Auto to registration after delay
      setTimeout(() => {
        this._showBeat(4);
        this._setupRegistration();
      }, 1500);
    }, 1800);
  }

  _setupRegistration() {
    // Map links
    const links = this.shadowRoot.getElementById('map-links');
    if (this._position) {
      const { lat, lng } = this._position;
      links.innerHTML = `
        <a class="map-link" href="${googleMapsUrl(lat, lng)}" target="_blank" rel="noopener">📍 Google Maps</a>
        <a class="map-link" href="${appleMapsUrl(lat, lng)}" target="_blank" rel="noopener">🗺️ Apple Maps</a>
      `;
    } else {
      links.innerHTML = '<div style="font-size:11px;color:#aaa">No GPS — map links unavailable</div>';
    }

    // Default bulba reaction
    this.shadowRoot.getElementById('bulba-reaction').innerHTML = BULBA_REACTIONS[this._selectedType] || '';

    // Reset form
    this.shadowRoot.getElementById('spot-name').value = '';
    this.shadowRoot.getElementById('spot-notes').value = '';
    this.shadowRoot.getElementById('photo-preview').classList.remove('show');

    // Focus name input
    setTimeout(() => this.shadowRoot.getElementById('spot-name').focus(), 300);
  }

  async _handlePhoto(file) {
    if (!file) return;

    // Compress: 800px wide, JPEG 0.7
    const bitmap = await createImageBitmap(file);
    const maxW = 800;
    const scale = Math.min(1, maxW / bitmap.width);
    const canvas = new OffscreenCanvas(bitmap.width * scale, bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    this._photoBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });

    // Preview
    const preview = this.shadowRoot.getElementById('photo-preview');
    preview.src = URL.createObjectURL(this._photoBlob);
    preview.classList.add('show');
  }

  async _beat4Catch() {
    const name = this.shadowRoot.getElementById('spot-name').value.trim();
    if (!name) {
      const input = this.shadowRoot.getElementById('spot-name');
      input.style.borderColor = 'var(--poke-red)';
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      return;
    }

    const state = getState();
    const spotId = `spot-${Date.now()}`;
    const now = new Date();

    const spot = {
      id: spotId,
      nickname: name,
      type: this._selectedType,
      rarity: this._selectedRarity,
      notes: this.shadowRoot.getElementById('spot-notes').value.trim(),
      lat: this._position?.lat || null,
      lng: this._position?.lng || null,
      accuracy: this._position?.accuracy || null,
      hasPhoto: !!this._photoBlob,
      timestamp: now.toISOString(),
      number: (state.caughtSpots?.length || 0) + 1,
    };

    // Store photo blob in IndexedDB
    if (this._photoBlob) {
      await putBlob(spotId, this._photoBlob);
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
    const today = now.toISOString().slice(0, 10);
    const streak = state.catchStreak || { count: 0, lastDate: null };
    if (streak.lastDate === today) {
      // same day, no change
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      if (streak.lastDate === yesterdayStr) {
        streak.count++;
      } else {
        streak.count = 1;
      }
      streak.lastDate = today;
    }
    state.catchStreak = { ...streak };

    // Check time-based achievements
    const hour = now.getHours();
    const prevAch = { ...state.achievements };
    if (hour >= 22 || hour < 5) state.achievements = { ...state.achievements, nightOwl: true };
    if (hour >= 5 && hour < 7) state.achievements = { ...state.achievements, earlyBird: true };
    if (!prevAch.nightOwl && state.achievements.nightOwl) bus.emit('badge-earned', { badge: 'nightOwl' });
    if (!prevAch.earlyBird && state.achievements.earlyBird) bus.emit('badge-earned', { badge: 'earlyBird' });

    // Update longestStreak
    const currentStreak = state.catchStreak?.count || 0;
    if (currentStreak > (state.longestStreak || 0)) {
      state.longestStreak = currentStreak;
    }

    // Check all achievements (centralized)
    const newlyEarned = checkAchievements(state);
    for (const key of newlyEarned) {
      bus.emit('badge-earned', { badge: key });
    }

    // Emit events
    bus.emit('spot-caught', { spot });

    // Close and toast
    this._close();
    const total = state.caughtSpots.length;
    bus.emit('show-toast', { text: `Pokédex updated! ${total}/??? spots catalogued.` });
  }

  _checkNaraEasterEgg() {
    if (!this._position) return;
    const state = getState();
    if (state.naraEasterEgg) return;

    const { lat, lng } = this._position;
    // Nara Park bounding box
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

  _showBeat(n) {
    this.shadowRoot.querySelectorAll('.beat').forEach(b => b.classList.remove('active'));
    const beat = this.shadowRoot.querySelector(`[data-beat="${n}"]`);
    if (beat) beat.classList.add('active');
  }

  _close() {
    this.shadowRoot.getElementById('overlay').classList.remove('show');
    this._showBeat(1);
    this._position = null;
    this._photoBlob = null;
    // Reset form fields
    const nameInput = this.shadowRoot.getElementById('spot-name');
    if (nameInput) nameInput.style.borderColor = '';
  }
}

customElements.define('screen-catch-flow', ScreenCatchFlow);
