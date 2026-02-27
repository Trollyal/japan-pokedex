// components/screen-trainer-card.js — Modal with stats, Bulbasaur companion, Oak commentary, backup

import sharedStyles from '../lib/shared-styles.js';
import { getState, onStateChange } from '../lib/state.js';
import { bus } from '../lib/events.js';
import { sprite } from '../lib/sprites.js';
import { sfx } from '../lib/audio.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: contents; }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 300;
    display: none; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-overlay.show { display: flex; animation: fadeIn .2s ease; }

  .trainer-card {
    background: linear-gradient(145deg, #fff8ee, #fff);
    border: 4px solid var(--poke-dark, #2C2C54);
    border-radius: 20px; width: 100%; max-width: 380px;
    box-shadow: 0 10px 40px rgba(0,0,0,.3); position: relative;
    max-height: 85vh; overflow: hidden;
  }
  .trainer-inner {
    padding: 24px 24px 32px; max-height: 85vh; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .trainer-card::before {
    content: ''; position: absolute; inset: 8px; z-index: 1;
    border: 2px solid var(--poke-yellow, #FFCB05); border-radius: 14px; pointer-events: none;
  }

  .tc-close {
    position: sticky; top: 0; float: right; background: #fff; border: 1px solid #eee;
    border-radius: 50%; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 10; color: #aaa; margin: -8px -8px 0 0;
  }
  .tc-close:hover { color: var(--poke-dark); }

  .tc-header { text-align: center; margin-bottom: 16px; }
  .tc-header h2 { font-family: 'Press Start 2P', monospace; font-size: 11px; color: var(--poke-red, #E3350D); margin-bottom: 4px; }
  .tc-header p { font-size: 11px; color: #757575; }

  /* Bulbasaur companion */
  .companion {
    text-align: center; margin: 12px 0; padding: 16px;
    background: var(--grass-bg, #E8F5E9); border-radius: 16px;
    cursor: pointer; user-select: none; -webkit-user-select: none;
  }
  .companion-emoji { font-size: 0; line-height: 0; transition: transform .2s; display: inline-block; }
  .companion-emoji.bounce { animation: buddyBounce .4s ease; }
  @keyframes buddyBounce { 0% { transform: translateY(0); } 40% { transform: translateY(-12px); } 100% { transform: translateY(0); } }
  .companion-mood { font-size: 11px; color: var(--grass); font-weight: 700; margin-top: 4px; }

  /* Vine Whip easter egg */
  .vine-whip {
    position: fixed; inset: 0; z-index: 400; pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(93,170,104,.6), rgba(93,170,104,.2));
    animation: vineAnim .8s ease forwards;
  }
  @keyframes vineAnim {
    0% { opacity: 0; transform: scale(0.3); }
    30% { opacity: 1; transform: scale(1.1); }
    70% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.5); }
  }

  .tc-stats {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    margin-bottom: 16px;
  }
  .tc-stat {
    background: var(--cream, #FFF8EE); border-radius: 10px; padding: 12px; text-align: center;
  }
  .tc-stat .stat-num { font-family: 'Press Start 2P', monospace; font-size: 14px; color: var(--poke-dark); }
  .tc-stat .stat-lbl { font-size: 9px; color: #666; margin-top: 4px; }

  .tc-badges { margin-bottom: 16px; }
  .tc-badges h4 { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #666; margin-bottom: 10px; }
  .tc-badge-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .tc-badge-item { text-align: center; }
  .tc-badge-item .badge-circle {
    width: 48px; height: 48px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center;
    background: #eee; margin: 0 auto 6px;
  }
  .tc-badge-item .badge-circle img { image-rendering: pixelated; }
  .tc-badge-item .badge-circle.earned { background: var(--poke-yellow); }
  .tc-badge-item .badge-name { font-size: 8px; color: #757575; font-family: 'Press Start 2P', monospace; }

  /* Achievements */
  .achievements { margin-bottom: 16px; }
  .achievements h4 { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #666; margin-bottom: 10px; }
  .ach-grid { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .ach-item {
    text-align: center; width: 60px;
  }
  .ach-icon {
    width: 44px; height: 44px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center;
    background: #eee; margin: 0 auto 6px; filter: grayscale(1) opacity(.3);
  }
  .ach-icon img { image-rendering: pixelated; }
  .ach-icon.earned { background: var(--poke-yellow); filter: none; }
  .ach-label { font-size: 7px; color: #757575; font-family: 'Press Start 2P', monospace; line-height: 1.3; }

  /* Oak commentary */
  .oak-commentary {
    background: var(--cream, #FFF8EE); border: 2px dashed #ddd;
    border-radius: 12px; padding: 14px 16px; margin: 12px 0;
    font-size: 13px; line-height: 1.5; color: #666;
  }
  .oak-commentary .oak-label {
    font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--grass);
    margin-bottom: 6px;
  }

  /* Backup buttons */
  .backup-row {
    display: flex; gap: 8px; margin-top: 12px;
  }
  .backup-btn {
    flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 10px;
    background: #fff; font-family: 'Press Start 2P', monospace; font-size: 9px;
    cursor: pointer; text-align: center; transition: all .15s;
  }
  .backup-btn:active { transform: scale(.97); }

  .copyright {
    text-align: center; font-size: 9px; color: #aaa; margin-top: 16px;
    font-family: 'Press Start 2P', monospace;
  }
`);

const ACHIEVEMENTS_DEF = [
  { key: 'foodMaster', icon: 'badge-food-master', label: 'FOOD MASTER' },
  { key: 'shrineKeeper', icon: 'badge-shrine-keeper', label: 'SHRINE KEEPER' },
  { key: 'nightOwl', icon: 'badge-night-owl', label: 'NIGHT OWL' },
  { key: 'earlyBird', icon: 'badge-early-bird', label: 'EARLY BIRD' },
  { key: 'explorer', icon: 'badge-explorer', label: 'EXPLORER' },
  { key: 'kansaiChampion', icon: 'badge-champion', label: 'CHAMPION' },
  { key: 'naraDeer', icon: 'badge-nara-deer', label: 'NARA DEER' },
];

const QUIZ_BADGES = [
  { type: 'fire', icon: 'type-fire', name: 'PHRASES' },
  { type: 'water', icon: 'type-water', name: 'KANJI' },
  { type: 'grass', icon: 'type-grass', name: 'ETIQUETTE' },
  { type: 'electric', icon: 'type-electric', name: 'KANSAI' },
];

class ScreenTrainerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._tapTimes = [];
  }

  connectedCallback() {
    this._render();
    this._bindEvents();

    // Listen for open event
    this._unsub = bus.on('open-trainer-card', () => this._open());
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }

  _render() {
    this.shadowRoot.innerHTML = /*html*/`
      <div class="modal-overlay" id="modal">
        <div class="trainer-card">
          <div class="trainer-inner">
            <button class="tc-close" id="close-btn">${sprite('icon-close', 18)}</button>
            <div class="tc-header">
              <h2>TRAINER CARD</h2>
              <p>Japan Pokédex Edition</p>
            </div>

            <!-- Bulbasaur companion -->
            <div class="companion" id="companion">
              <div class="companion-emoji" id="buddy-emoji">${sprite('bulbasaur-happy', 60)}</div>
              <div class="companion-mood" id="buddy-mood"></div>
            </div>

            <div class="tc-stats" id="stats"></div>

            <div class="tc-badges">
              <h4>GYM BADGES</h4>
              <div class="tc-badge-row" id="badge-row"></div>
            </div>

            <div class="achievements">
              <h4>ACHIEVEMENTS</h4>
              <div class="ach-grid" id="ach-grid"></div>
            </div>

            <div class="oak-commentary" id="oak-commentary">
              <div class="oak-label">${sprite('oak', 14)} PROF. OAK</div>
              <div id="oak-text"></div>
            </div>

            <div class="backup-row">
              <button class="backup-btn" id="export-btn">${sprite('icon-export', 14)} EXPORT</button>
              <button class="backup-btn" id="import-btn">${sprite('icon-import', 14)} IMPORT</button>
            </div>

            <div class="copyright">&copy; The Pok&eacute;mon Company</div>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const modal = this.shadowRoot.getElementById('modal');

    this.shadowRoot.getElementById('close-btn').addEventListener('click', () => { sfx('ui-close'); this._close(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) this._close(); });

    // Bulbasaur taps
    this.shadowRoot.getElementById('companion').addEventListener('click', () => {
      this._handleBuddyTap();
    });

    // Backup buttons
    this.shadowRoot.getElementById('export-btn').addEventListener('click', async () => {
      try {
        const { exportBackup } = await import('../lib/backup.js');
        await exportBackup();
        bus.emit('show-toast', { text: 'Backup exported!' });
      } catch (e) { bus.emit('show-toast', { text: 'Export failed' }); }
    });

    this.shadowRoot.getElementById('import-btn').addEventListener('click', async () => {
      try {
        const { importBackup } = await import('../lib/backup.js');
        await importBackup();
        bus.emit('show-toast', { text: 'Backup restored!' });
        this._refreshData();
      } catch (e) { bus.emit('show-toast', { text: 'Import failed' }); }
    });
  }

  _open() {
    this._refreshData();
    this.shadowRoot.getElementById('modal').classList.add('show');
  }

  _close() {
    this.shadowRoot.getElementById('modal').classList.remove('show');
  }

  _refreshData() {
    const state = getState();
    const badgeCount = Object.values(state.badges).filter(Boolean).length;

    // Stats
    const stats = [
      { num: state.totalCatches, label: 'Quiz Catches' },
      { num: badgeCount, label: 'Gym Badges' },
      { num: state.bestComboEver, label: 'Best Combo' },
      { num: state.totalQuizzes, label: 'Quizzes' },
      { num: state.caughtSpots?.length || 0, label: 'Spots' },
      { num: (state.totalDistance || 0).toFixed(1), label: 'Buddy km' },
    ];
    const allZero = stats.every(s => !s.num || Number(s.num) === 0);
    const statsEl = this.shadowRoot.getElementById('stats');
    if (allZero) {
      statsEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:8px 0">
        <div style="font-family:'Press Start 2P',monospace;font-size:9px;color:var(--poke-dark);margin-bottom:6px">Your adventure awaits!</div>
        <div style="font-size:13px;color:#666">Try a Battle quiz or catch a spot to start filling your stats.</div>
      </div>`;
    } else {
      statsEl.innerHTML = stats.map(s => `<div class="tc-stat"><div class="stat-num">${s.num}</div><div class="stat-lbl">${s.label}</div></div>`).join('');
    }

    // Quiz badges
    this.shadowRoot.getElementById('badge-row').innerHTML = QUIZ_BADGES.map(b =>
      `<div class="tc-badge-item">
        <div class="badge-circle ${state.badges[b.type] ? 'earned' : ''}">${sprite(b.icon, 28)}</div>
        <div class="badge-name">${b.name}</div>
      </div>`
    ).join('');

    // Achievements
    this.shadowRoot.getElementById('ach-grid').innerHTML = ACHIEVEMENTS_DEF.map(a =>
      `<div class="ach-item">
        <div class="ach-icon ${state.achievements?.[a.key] ? 'earned' : ''}">${sprite(a.icon, 26)}</div>
        <div class="ach-label">${a.label}</div>
      </div>`
    ).join('');

    // Bulbasaur mood
    this._updateBuddyMood(state);

    // Oak commentary
    this._updateOakCommentary(state);
  }

  _updateBuddyMood(state) {
    const emoji = this.shadowRoot.getElementById('buddy-emoji');
    const mood = this.shadowRoot.getElementById('buddy-mood');

    const hoursSinceOpen = state.lastOpenTimestamp
      ? (Date.now() - state.lastOpenTimestamp) / (1000 * 60 * 60)
      : 0;

    let moodText, expression;
    if (hoursSinceOpen > 12) {
      moodText = 'Bulbasaur is sleepy... 💤';
      expression = sprite('bulbasaur-sleepy', 60);
    } else if (state.catchStreak?.count >= 3) {
      moodText = 'Bulbasaur is EXCITED! 🎉';
      expression = sprite('bulbasaur-excited', 60);
    } else {
      moodText = 'Bulbasaur is happy! 🌸';
      expression = sprite('bulbasaur-happy', 60);
    }

    emoji.innerHTML = expression;
    mood.textContent = moodText;
  }

  _handleBuddyTap() {
    sfx('bulbasaur-tap');
    const emoji = this.shadowRoot.getElementById('buddy-emoji');
    emoji.classList.remove('bounce');
    void emoji.offsetWidth; // force reflow
    emoji.classList.add('bounce');

    const now = Date.now();
    this._tapTimes.push(now);
    // Keep only taps within last 3 seconds
    this._tapTimes = this._tapTimes.filter(t => now - t < 3000);

    if (this._tapTimes.length >= 10) {
      this._vineWhip();
      this._tapTimes = [];
    }
  }

  _vineWhip() {
    sfx('bulbasaur-vinewhip');
    const vine = document.createElement('div');
    vine.className = 'vine-whip';
    this.shadowRoot.appendChild(vine);
    setTimeout(() => vine.remove(), 900);

    const mood = this.shadowRoot.getElementById('buddy-mood');
    mood.innerHTML = `Bulbasaur used Vine Whip! ${sprite('bulbasaur-vinewhip', 20)}`;
    setTimeout(() => this._updateBuddyMood(getState()), 2000);
  }

  _updateOakCommentary(state) {
    const spots = state.caughtSpots?.length || 0;
    const text = this.shadowRoot.getElementById('oak-text');
    let msg;

    if (spots === 0 && state.totalQuizzes === 0) {
      msg = "Your adventure is just beginning! Start with the Pokédex to learn useful phrases, then try a Battle quiz!";
    } else if (spots === 0) {
      msg = "You're learning fast! When you're out exploring Kansai, tap the Pokéball to catch real spots!";
    } else if (spots <= 5) {
      msg = `${spots} spot${spots > 1 ? 's' : ''} caught! You're off to a great start. Keep exploring — Kansai has so much to discover!`;
    } else if (spots <= 15) {
      msg = `${spots} spots! Impressive, ${state.trainerName || 'Trainer'}! Bulbasaur loves adventuring with you.`;
    } else if (spots <= 30) {
      msg = `${spots} spots catalogued! You're becoming a true Kansai expert. Bulbasaur couldn't be prouder!`;
    } else if (spots <= 50) {
      msg = `${spots} spots?! Outstanding! You know Kansai better than most locals!`;
    } else {
      msg = `${spots} spots!! You are a Kansai LEGEND! Bulbasaur is in awe. 🌟`;
    }

    text.textContent = msg;
  }
}

customElements.define('screen-trainer-card', ScreenTrainerCard);
