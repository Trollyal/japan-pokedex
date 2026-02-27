// components/screen-onboarding.js — Professor Oak welcome + starter selection

import sharedStyles from '../lib/shared-styles.js';
import { getState } from '../lib/state.js';
import { navigate } from '../lib/router.js';
import { bus } from '../lib/events.js';
import { sprite } from '../lib/sprites.js';
import { sfx } from '../lib/audio.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host {
    display: flex; align-items: flex-start; justify-content: center;
    min-height: 100dvh; padding: 24px; padding-top: 8vh;
  }

  .onboarding {
    background: #fff; border: 4px solid var(--poke-dark, #2C2C54);
    border-radius: 20px; padding: 32px 24px; max-width: 380px; width: 100%;
    box-shadow: 0 10px 40px rgba(0,0,0,.2); text-align: center;
    position: relative; overflow: hidden;
  }
  .onboarding::before {
    content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px;
    border: 2px solid var(--poke-yellow, #FFCB05); border-radius: 14px; pointer-events: none;
  }

  .step { display: none; animation: stepIn .4s ease; }
  .step.active { display: block; }
  @keyframes stepIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

  /* Oak portrait */
  .oak-portrait {
    width: 80px; height: 80px; margin: 0 auto 16px;
    background: var(--grass-bg, #E8F5E9); border: 3px solid var(--grass, #5DAA68);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
  }

  .oak-text {
    font-size: 15px; line-height: 1.7; color: var(--poke-dark, #2C2C54);
    font-weight: 600; margin: 16px 0; min-height: 80px;
  }

  .name-input {
    width: 100%; border: 3px solid #ddd; border-radius: 12px;
    padding: 14px 16px; font-family: 'Quicksand', sans-serif;
    font-size: 18px; font-weight: 700; text-align: center;
    outline: none; transition: border-color .2s; margin: 12px 0;
  }
  .name-input:focus { border-color: var(--poke-blue, #3B4CCA); }

  /* Starter cards */
  .starter-row { display: flex; gap: 12px; justify-content: center; margin: 20px 0; }
  .starter-card {
    flex: 1; max-width: 100px; background: var(--grass-bg, #E8F5E9);
    border: 3px solid var(--grass, #5DAA68); border-radius: 16px;
    padding: 16px 8px; cursor: pointer; transition: all .2s;
    text-align: center;
  }
  .starter-card:active { transform: scale(.95); }
  .starter-card.selected {
    border-color: var(--poke-yellow, #FFCB05);
    box-shadow: 0 0 20px rgba(245,200,66,.4);
    animation: starterBounce .5s ease;
  }
  @keyframes starterBounce {
    0% { transform: scale(1); }
    30% { transform: scale(1.1) rotate(-5deg); }
    60% { transform: scale(1.05) rotate(3deg); }
    100% { transform: scale(1) rotate(0); }
  }
  .starter-emoji { margin-bottom: 8px; line-height: 0; }
  .starter-label { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #2E7D32; }

  .pixel-title {
    font-family: 'Press Start 2P', monospace; font-size: 12px;
    color: var(--poke-dark); margin-bottom: 4px; line-height: 1.6;
  }
  .pixel-sub {
    font-family: 'Press Start 2P', monospace; font-size: 8px;
    color: var(--poke-red, #E3350D); margin-bottom: 16px;
  }

  .oak-reaction {
    font-size: 14px; color: var(--grass, #5DAA68); font-weight: 700;
    margin: 12px 0; min-height: 20px;
  }
`);

class ScreenOnboarding extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._step = 0;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = /*html*/`
      <div class="onboarding">
        <!-- Step 0: Welcome -->
        <div class="step active" data-step="0">
          <div class="oak-portrait">${sprite('oak', 48)}</div>
          <div class="pixel-title">PROFESSOR OAK</div>
          <div class="oak-text" id="welcome-text"></div>
          <button class="btn-primary" id="next-0">NEXT</button>
        </div>

        <!-- Step 1: Name -->
        <div class="step" data-step="1">
          <div class="oak-portrait">${sprite('oak', 48)}</div>
          <div class="oak-text">First, tell me — what's your name, Trainer?</div>
          <input class="name-input" id="name-input" type="text" placeholder="Your name..." maxlength="16" autocomplete="off">
          <br>
          <button class="btn-primary" id="next-1">NEXT</button>
        </div>

        <!-- Step 2: Starter -->
        <div class="step" data-step="2">
          <div class="pixel-title">Choose your partner!</div>
          <div class="pixel-sub">for your Kansai adventure</div>
          <div class="starter-row">
            <div class="starter-card" data-starter="adventure">
              <div class="starter-emoji">${sprite('bulbasaur-happy', 40)}</div>
              <div class="starter-label">ADVENTURE BULBA</div>
            </div>
            <div class="starter-card" data-starter="foodie">
              <div class="starter-emoji">${sprite('bulbasaur-excited', 40)}</div>
              <div class="starter-label">FOODIE BULBA</div>
            </div>
            <div class="starter-card" data-starter="sleepy">
              <div class="starter-emoji">${sprite('bulbasaur-sleepy', 40)}</div>
              <div class="starter-label">SLEEPY BULBA</div>
            </div>
          </div>
          <div class="oak-reaction" id="oak-reaction"></div>
          <button class="btn-primary" id="next-2" style="display:none">LET'S GO!</button>
        </div>
      </div>
    `;

    this._bindEvents();
    this._typewriterWelcome();
  }

  _typewriterWelcome() {
    const el = this.shadowRoot.getElementById('welcome-text');
    const text = "Hello there! Welcome to the world of Kansai! My name is Oak. I'm here to help guide you on your very first adventure in Japan!";
    let i = 0;
    el.textContent = '';
    const interval = setInterval(() => {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 30);
  }

  _bindEvents() {
    // Step 0 → 1
    this.shadowRoot.getElementById('next-0').addEventListener('click', () => {
      sfx('ui-tap');
      this._goToStep(1);
      setTimeout(() => this.shadowRoot.getElementById('name-input').focus(), 300);
    });

    // Step 1 → 2
    this.shadowRoot.getElementById('next-1').addEventListener('click', () => {
      sfx('ui-tap');
      const name = this.shadowRoot.getElementById('name-input').value.trim();
      if (!name) {
        const input = this.shadowRoot.getElementById('name-input');
        input.style.borderColor = 'var(--poke-red)';
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
        return;
      }
      getState().trainerName = name;
      this._goToStep(2);
    });

    // Starter selection
    this.shadowRoot.querySelectorAll('.starter-card').forEach(card => {
      card.addEventListener('click', () => {
        sfx('ui-tap');
        this.shadowRoot.querySelectorAll('.starter-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.shadowRoot.getElementById('oak-reaction').innerHTML =
          `Ah, Bulbasaur! An excellent choice! ${sprite('bulbasaur-happy', 20)}`;
        this.shadowRoot.getElementById('next-2').style.display = '';
      });
    });

    // Step 2 → Done
    this.shadowRoot.getElementById('next-2').addEventListener('click', () => {
      sfx('ui-tap');
      const state = getState();
      state.onboardingComplete = true;
      navigate('pokedex');

      setTimeout(() => {
        bus.emit('show-dialogue', {
          text: `Welcome, ${state.trainerName}! Your Kansai Pokédex is ready. Tap around to explore! 🌸`,
          autoHide: 5000
        });
      }, 500);
    });

    // Enter key on name input
    this.shadowRoot.getElementById('name-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.shadowRoot.getElementById('next-1').click();
    });
  }

  _goToStep(n) {
    this.shadowRoot.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    this.shadowRoot.querySelector(`[data-step="${n}"]`).classList.add('active');
    this._step = n;
  }
}

customElements.define('screen-onboarding', ScreenOnboarding);
