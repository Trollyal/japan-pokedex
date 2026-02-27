// components/app-shell.js — Light DOM app shell: header, nav, dialogue, FAB

import { bus } from '../lib/events.js';
import { navigate, getCurrentScreen } from '../lib/router.js';
import { sprite } from '../lib/sprites.js';
import { sfx, toggleMute } from '../lib/audio.js';

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

    // Pokeball FAB
    this.querySelector('#pokeball-fab').addEventListener('click', () => {
      bus.emit('start-catch');
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

  showDialogue(text, autoHide = 0) {
    const box = this.querySelector('#dialogue-box');
    const textEl = this.querySelector('#dialogue-text');
    const continueEl = this.querySelector('#dialogue-continue');

    box.classList.add('show');
    continueEl.style.display = 'none';

    // Typewriter effect
    let i = 0;
    textEl.innerHTML = '';
    clearInterval(this._dialogueTimeout);
    this._dialogueTimeout = setInterval(() => {
      if (i < text.length) {
        textEl.innerHTML += text.charAt(i);
        i++;
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
