// components/app-shell.js — Light DOM app shell: header, nav, dialogue, FAB

import { bus } from '../lib/events.js';
import { navigate, getCurrentScreen } from '../lib/router.js';
import { sprite } from '../lib/sprites.js';
import { sfx, toggleMute } from '../lib/audio.js';
import { getCurrentBall, BALL_TIERS } from '../lib/progression.js';
import { getState, onStateChange } from '../lib/state.js';

class AppShell extends HTMLElement {
  constructor() {
    super();
    this._dialogueTimeout = null;
  }

  connectedCallback() {
    this.innerHTML = /*html*/`
      <!-- HEADER -->
      <header class="header">
        <h1>Japan Guide<span>Pokédex Edition ⛩️</span></h1>
        <button class="mute-btn" aria-label="Toggle Sound">${sprite('icon-speaker', 24)}</button>
        <button class="trainer-btn" aria-label="Trainer Card">${sprite('icon-backpack', 24)}</button>
      </header>

      <!-- SCREEN CONTAINER -->
      <main id="screen-container"></main>

      <!-- POKEBALL FAB -->
      <button class="pokeball-fab" id="pokeball-fab" aria-label="Catch a Spot">
${sprite('pokeball', 56)}
      </button>

      <!-- DIALOGUE BOX -->
      <div class="dialogue-box" id="dialogue-box">
        <div class="dialogue-text" id="dialogue-text"></div>
        <div class="dialogue-continue" id="dialogue-continue">▼ TAP</div>
      </div>

      <!-- TOAST -->
      <div class="toast" id="toast"></div>

      <!-- BOTTOM NAV -->
      <nav class="bottom-nav">
        <button class="nav-btn active" data-screen="pokedex">
${sprite('nav-pokedex', 28)}
          POKÉDEX
        </button>
        <button class="nav-btn" data-screen="battle">
${sprite('nav-battle', 28)}
          BATTLE
        </button>
        <button class="nav-btn" data-screen="journal">
${sprite('nav-journal', 28)}
          JOURNAL
        </button>
      </nav>

      <!-- TRAINER CARD MODAL -->
      <div class="modal-overlay" id="trainer-modal"></div>

      <!-- iOS INSTALL BANNER -->
      <div class="install-banner" id="install-banner" style="display:none">
        <span>Add to Home Screen for the full experience!</span>
        <button class="install-dismiss" id="install-dismiss">${sprite('icon-close', 14)}</button>
      </div>
    `;

    this._bindEvents();

    // Set initial FAB ball based on progression
    this._currentBall = null;
    this._updateFABBall();

    // Watch state changes to detect ball upgrades
    onStateChange('*', () => this._updateFABBall());
  }

  _updateFABBall() {
    const state = getState();
    if (!state) return;
    const ball = getCurrentBall(state);
    const fab = this.querySelector('#pokeball-fab');
    if (!fab) return;
    if (this._currentBall && this._currentBall !== ball.name) {
      // Only animate if upgrading (higher tier index)
      const oldIdx = BALL_TIERS.findIndex(t => t.name === this._currentBall);
      const newIdx = BALL_TIERS.findIndex(t => t.name === ball.name);
      if (newIdx > oldIdx) {
        fab.innerHTML = sprite(ball.name, 56);
        fab.classList.add('ball-upgrading');
        sfx('ball-upgrade');
        setTimeout(() => fab.classList.remove('ball-upgrading'), 800);
      } else {
        fab.innerHTML = sprite(ball.name, 56);
      }
    } else if (!this._currentBall) {
      fab.innerHTML = sprite(ball.name, 56);
    }
    this._currentBall = ball.name;
  }

  _bindEvents() {
    // Nav buttons
    this.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx('ui-tap');
        navigate(btn.dataset.screen);
      });
    });

    // Trainer card button
    this.querySelector('.trainer-btn').addEventListener('click', () => {
      bus.emit('open-trainer-card');
    });

    // Mute toggle button
    this.querySelector('.mute-btn').addEventListener('click', () => {
      const muted = toggleMute();
      this.querySelector('.mute-btn').innerHTML = sprite(muted ? 'icon-muted' : 'icon-speaker', 24);
      sfx('ui-tap');
    });

    // Pokeball FAB — short tap = catch, long-press (500ms) = situation menu
    const fab = this.querySelector('#pokeball-fab');
    let fabTimer = null;
    let fabFired = false;

    fab.addEventListener('pointerdown', (e) => {
      fabFired = false;
      fabTimer = setTimeout(() => {
        fabFired = true;
        this._showSituationMenu();
      }, 500);
    });

    fab.addEventListener('pointerup', () => {
      clearTimeout(fabTimer);
      if (!fabFired) {
        bus.emit('start-catch');
      }
    });

    fab.addEventListener('pointerleave', () => {
      clearTimeout(fabTimer);
    });

    fab.addEventListener('pointercancel', () => {
      clearTimeout(fabTimer);
    });

    // Dialogue box tap to dismiss
    this.querySelector('#dialogue-box').addEventListener('click', () => {
      this.hideDialogue();
    });

    // Event bus listeners
    bus.on('show-dialogue', (e) => this.showDialogue(e.detail.text, e.detail.autoHide));
    bus.on('hide-dialogue', () => this.hideDialogue());
    bus.on('show-toast', (e) => this.showToast(e.detail.text, e.detail.duration));
    bus.on('navigate', (e) => {
      this.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.screen === e.detail.screen);
      });
      const isOnboarding = e.detail.screen === 'onboarding';
      this.classList.toggle('onboarding-active', isOnboarding);
    });
  }

  _showSituationMenu() {
    // Remove existing menu if any
    this._hideSituationMenu();
    sfx('ui-tap');

    const situations = [
      { label: 'Restaurant', icon: sprite('grp-restaurant', 20), filter: 'Restaurant' },
      { label: 'Shopping', icon: sprite('grp-shopping', 20), filter: 'Shopping' },
      { label: 'Konbini', icon: sprite('grp-konbini', 20), filter: 'Konbini' },
      { label: 'Directions', icon: sprite('grp-directions', 20), filter: 'Directions' },
      { label: 'Emergency', icon: sprite('grp-emergency', 20), filter: 'Emergency' },
    ];

    const menu = document.createElement('div');
    menu.className = 'situation-menu show';
    menu.id = 'situation-menu';
    menu.innerHTML = situations.map((s, i) =>
      `<button class="situation-btn" data-filter="${s.filter}" style="animation-delay:${i * 0.05}s">
        ${s.icon} <span>${s.label}</span>
      </button>`
    ).join('');

    this.appendChild(menu);

    // Bind button clicks
    menu.querySelectorAll('.situation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx('ui-tap');
        this._hideSituationMenu();
        navigate('pokedex', { filter: btn.dataset.filter });
      });
    });

    // Dismiss on tap outside or scroll
    const dismiss = (e) => {
      if (!menu.contains(e.target) && !e.target.closest('#pokeball-fab')) {
        this._hideSituationMenu();
      }
    };
    const scrollDismiss = () => this._hideSituationMenu();
    this._menuDismissCleanup = () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('scroll', scrollDismiss);
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, { once: true });
      window.addEventListener('scroll', scrollDismiss, { once: true });
    }, 50);
  }

  _hideSituationMenu() {
    const menu = this.querySelector('#situation-menu');
    if (menu) menu.remove();
    if (this._menuDismissCleanup) {
      this._menuDismissCleanup();
      this._menuDismissCleanup = null;
    }
  }

  showDialogue(text, autoHide = 0) {
    const box = this.querySelector('#dialogue-box');
    const textEl = this.querySelector('#dialogue-text');
    const continueEl = this.querySelector('#dialogue-continue');

    box.classList.add('show');
    continueEl.style.display = 'none';

    // Typewriter effect (fast-forwards through HTML tags to avoid breaking them)
    let i = 0;
    textEl.innerHTML = '';
    clearInterval(this._dialogueTimeout);
    this._dialogueTimeout = setInterval(() => {
      if (i < text.length) {
        if (text.charAt(i) === '<') {
          const closeIdx = text.indexOf('>', i);
          if (closeIdx !== -1) {
            textEl.innerHTML += text.substring(i, closeIdx + 1);
            i = closeIdx + 1;
          } else {
            textEl.innerHTML += text.charAt(i);
            i++;
          }
        } else {
          textEl.innerHTML += text.charAt(i);
          i++;
        }
      } else {
        clearInterval(this._dialogueTimeout);
        continueEl.style.display = 'block';
        if (autoHide > 0) {
          setTimeout(() => this.hideDialogue(), autoHide);
        }
      }
    }, 25);
  }

  hideDialogue() {
    this.querySelector('#dialogue-box').classList.remove('show');
    clearInterval(this._dialogueTimeout);
  }

  showToast(text, duration = 3000) {
    const toast = this.querySelector('#toast');
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }
}

customElements.define('app-shell', AppShell);
