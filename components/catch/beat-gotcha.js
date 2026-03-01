// components/catch/beat-gotcha.js — Beat 3: Gotcha celebration

import { sprite } from '../../lib/sprites.js';
import { sfx } from '../../lib/audio.js';
import { SPOT_TYPES } from '../../lib/pokemon-types.js';

const PARTICLE_COLORS = ['#FFCB05', '#E3350D', '#3B4CCA', '#5DAA68', '#FF6B35', '#FFB7C5', '#F5C842', '#4A90D9'];

/**
 * Render Beat 3: Gotcha celebration
 * @param {HTMLElement} container - The beat container div
 * @param {object} ctx
 * @param {number} ctx.spotNumber - e.g. 7
 * @param {string} ctx.spotType - Spot type for sprite
 * @param {HTMLElement} ctx.screen - The .catch-screen element (for flash)
 * @param {function} ctx.announce - ARIA announce
 * @param {function} ctx.onAdvance - Callback when user taps to continue
 * @returns {function} cleanup function
 */
export function render(container, ctx) {
  const spotNum = String(ctx.spotNumber).padStart(3, '0');
  const spotInfo = SPOT_TYPES[ctx.spotType] || SPOT_TYPES.normal;
  const spriteKey = _spotSpriteKey(ctx.spotType);

  // Impact flash on the catch screen
  ctx.screen.classList.add('flash-impact');
  const flashTimer = setTimeout(() => ctx.screen.classList.remove('flash-impact'), 250);

  // Haptic
  navigator.vibrate?.([80, 30, 120]);

  // SFX
  sfx('catch-success');

  container.innerHTML = /*html*/`
    <div class="zone-sky" style="justify-content:flex-end;padding-bottom:16px;">
      <div class="gotcha-text">Gotcha!</div>
      <div class="spot-number">Spot #${spotNum}</div>
    </div>
    <div class="zone-target" id="gotcha-target">
      <div class="target-sprite revealed idle-bounce" style="font-size:0">
        ${sprite(spriteKey, 64)}
      </div>
    </div>
    <div class="zone-throw" style="min-height:120px;">
      <div class="bulba-celebrate">${sprite('bulbasaur-excited', 48)}</div>
      <div class="tap-prompt" id="gotcha-tap" style="display:none">Tap to continue</div>
    </div>
  `;
  container.classList.add('beat-enter');

  ctx.announce(`Gotcha! Spot number ${ctx.spotNumber} caught!`);

  // Spawn particles around the target
  const target = container.querySelector('#gotcha-target');
  _spawnParticles(target);

  // Show tap prompt after delay
  const tapTimer = setTimeout(() => {
    const tapPrompt = container.querySelector('#gotcha-tap');
    if (tapPrompt) tapPrompt.style.display = '';
  }, 800);

  // Tap to advance — delayed to prevent accidental skip
  let canAdvance = false;
  const advanceTimer = setTimeout(() => { canAdvance = true; }, 800);

  const onTap = () => {
    if (!canAdvance) return;
    container.removeEventListener('click', onTap);
    ctx.onAdvance();
  };
  container.addEventListener('click', onTap);

  return () => {
    clearTimeout(flashTimer);
    clearTimeout(tapTimer);
    clearTimeout(advanceTimer);
    container.removeEventListener('click', onTap);
    ctx.screen.classList.remove('flash-impact');
  };
}

function _spawnParticles(parentEl) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 40 + Math.random() * 40;
    const span = document.createElement('span');
    span.className = 'particle';
    span.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    span.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    span.style.left = '50%';
    span.style.top = '50%';
    span.style.background = PARTICLE_COLORS[i];
    span.addEventListener('animationend', () => span.remove());
    parentEl.appendChild(span);
  }
}

function _spotSpriteKey(type) {
  const map = {
    fire: 'spot-food',
    water: 'spot-onsen',
    grass: 'spot-nature',
    psychic: 'spot-culture',
    electric: 'spot-nightlife',
    normal: 'spot-other',
  };
  return map[type] || 'spot-other';
}
