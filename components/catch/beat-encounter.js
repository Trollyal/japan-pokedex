// components/catch/beat-encounter.js — Beat 1: Encounter (silhouette reveal + GPS)

import { sprite } from '../../lib/sprites.js';
import { SPOT_TYPES } from '../../lib/pokemon-types.js';
import { applyBackground } from './catch-backgrounds.js';

/**
 * Render Beat 1: Encounter
 * @param {HTMLElement} container - The beat container div
 * @param {object} ctx - Context from coordinator
 * @param {string} ctx.spotType - The default spot type
 * @param {HTMLElement} ctx.screen - The .catch-screen element (for background)
 * @param {function} ctx.announce - Announce text to ARIA live region
 * @param {function} ctx.onAdvance - Callback when beat is done
 * @returns {function} cleanup function
 */
export function render(container, ctx) {
  const type = ctx.spotType || 'normal';
  const spotInfo = SPOT_TYPES[type] || SPOT_TYPES.normal;

  // Apply type-themed background to full screen
  applyBackground(ctx.screen, type);

  // Build layout
  container.innerHTML = /*html*/`
    <div class="zone-sky" style="justify-content:flex-end;padding-bottom:16px;">
      <div class="wild-text" id="wild-text"></div>
    </div>
    <div class="zone-target">
      <div class="target-sprite silhouette" id="target-sprite">
        ${sprite(spotInfo.icon ? _spotSpriteKey(type) : 'pokeball', 64)}
      </div>
    </div>
    <div class="zone-throw" style="min-height:120px;">
      <div class="gps-status" id="gps-status">📡 Searching for GPS signal...</div>
      <div class="tap-prompt" id="tap-prompt" style="display:none">Tap to continue</div>
    </div>
  `;
  container.classList.add('beat-enter');

  const wildText = container.querySelector('#wild-text');
  const targetSprite = container.querySelector('#target-sprite');
  const gpsStatus = container.querySelector('#gps-status');
  const tapPrompt = container.querySelector('#tap-prompt');

  // Typewriter effect for "A wild SPOT appeared!"
  const fullText = 'A wild SPOT\nappeared!';
  let charIdx = 0;
  const typewriterTimer = setInterval(() => {
    if (charIdx < fullText.length) {
      const ch = fullText[charIdx];
      if (ch === '\n') {
        wildText.innerHTML += '<br>';
      } else {
        wildText.textContent += ch;
      }
      charIdx++;
    } else {
      clearInterval(typewriterTimer);
    }
  }, 60);

  ctx.announce('A wild spot appeared!');

  // GPS acquisition is handled by coordinator — we just get updates
  let gpsLocked = false;
  const gpsReady = () => {
    gpsLocked = true;
    tapPrompt.style.display = '';
  };

  // Expose GPS update methods for coordinator
  container._updateGps = (text, isError) => {
    gpsStatus.textContent = text;
    gpsStatus.classList.toggle('error', !!isError);
    if (!isError && !gpsLocked) gpsReady();
  };

  container._gpsReady = () => {
    if (!gpsLocked) gpsReady();
  };

  // Fallback: show tap prompt after 3s even without GPS
  const gpsTimeout = setTimeout(() => {
    if (!gpsLocked) gpsReady();
  }, 3000);

  // Tap handler — scanline wipe, then reveal, then advance
  let tapped = false;
  const onTap = () => {
    if (tapped) return;
    tapped = true;

    // Scanline wipe transition
    const wipe = document.createElement('div');
    wipe.className = 'wipe-transition';
    container.appendChild(wipe);

    // At midpoint of wipe, reveal the sprite
    setTimeout(() => {
      targetSprite.classList.remove('silhouette');
      targetSprite.classList.add('revealed');
    }, 200);

    // After wipe completes, advance
    wipe.addEventListener('animationend', () => {
      wipe.remove();
      ctx.onAdvance();
    });

    // Fallback if animationend doesn't fire (reduced motion)
    setTimeout(() => {
      if (wipe.parentNode) {
        wipe.remove();
        ctx.onAdvance();
      }
    }, 500);
  };

  container.addEventListener('click', onTap);

  return () => {
    clearInterval(typewriterTimer);
    clearTimeout(gpsTimeout);
    container.removeEventListener('click', onTap);
    container._updateGps = null;
    container._gpsReady = null;
  };
}

/** Map spot type to the sprite key used for the spot icon */
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
