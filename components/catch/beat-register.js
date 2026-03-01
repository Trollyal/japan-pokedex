// components/catch/beat-register.js — Beat 4: Registration bottom sheet

import { sprite } from '../../lib/sprites.js';
import { SPOT_TYPES, RARITY } from '../../lib/pokemon-types.js';
import { googleMapsUrl, appleMapsUrl } from '../../lib/gps.js';
import { putBlob } from '../../lib/storage.js';

const BULBA_REACTIONS = {
  fire: `${sprite('bulbasaur-excited', 16)} Bulbasaur is drooling! 🍜`,
  water: `${sprite('bulbasaur-happy', 16)} Bulbasaur loves hot springs! ♨️`,
  grass: `${sprite('bulbasaur-happy', 16)} Bulbasaur feels right at home! 🌸`,
  psychic: `${sprite('bulbasaur-happy', 16)} Bulbasaur is being very respectful! ⛩️`,
  electric: `${sprite('bulbasaur-excited', 16)} Bulbasaur's eyes are sparkling! ✨`,
  normal: `${sprite('bulbasaur-confused', 16)} Bulbasaur is curious! 📍`,
};

/**
 * Render Beat 4: Registration bottom sheet
 * @param {HTMLElement} container - The beat container div (used as backdrop area)
 * @param {object} ctx
 * @param {object|null} ctx.position - { lat, lng, accuracy } or null
 * @param {HTMLElement} ctx.screen - The .catch-screen element
 * @param {function} ctx.announce - ARIA announce
 * @param {function} ctx.onCatch - Callback with spot data { nickname, type, rarity, notes, photoBlob }
 * @param {function} ctx.onClose - Close the flow (RUN)
 * @returns {function} cleanup function
 */
export function render(container, ctx) {
  let selectedType = 'normal';
  let selectedRarity = 'common';
  let photoBlob = null;

  // The sheet is appended to the container (which is absolutely positioned over the screen)
  container.innerHTML = /*html*/`
    <div class="zone-sky"></div>
    <div class="zone-target" style="flex:1"></div>
    <div class="zone-throw" style="min-height:0"></div>
    <div class="reg-sheet" id="reg-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div class="sheet-title">REGISTER SPOT</div>
        <button class="sheet-run-btn" id="sheet-run">RUN</button>
      </div>
      <div class="sheet-body">
        <div class="reg-field">
          <label class="reg-label">NICKNAME</label>
          <input class="reg-input" id="spot-name" type="text" placeholder="What's this spot called?" maxlength="60" autocomplete="off">
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
      </div>
      <div class="sheet-catch-btn">
        <button class="btn-primary" id="catch-btn">CATCH!</button>
      </div>
    </div>
  `;
  container.classList.add('beat-enter');

  const sheet = container.querySelector('#reg-sheet');
  const typeSel = container.querySelector('#type-selector');
  const rarSel = container.querySelector('#rarity-selector');
  const nameInput = container.querySelector('#spot-name');
  const notesInput = container.querySelector('#spot-notes');
  const photoInput = container.querySelector('#photo-input');
  const photoPreview = container.querySelector('#photo-preview');
  const mapLinks = container.querySelector('#map-links');
  const bulbaReaction = container.querySelector('#bulba-reaction');
  const catchBtn = container.querySelector('#catch-btn');
  const runBtn = container.querySelector('#sheet-run');

  ctx.announce('Register your spot');

  // Populate type selector
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
  Object.entries(RARITY).forEach(([key, r]) => {
    const btn = document.createElement('button');
    btn.className = `rarity-btn ${key === 'common' ? 'selected' : ''}`;
    btn.dataset.rarity = key;
    btn.innerHTML = r.icon;
    btn.title = r.label;
    rarSel.appendChild(btn);
  });

  // Map links
  if (ctx.position) {
    const { lat, lng } = ctx.position;
    mapLinks.innerHTML = `
      <a class="map-link" href="${googleMapsUrl(lat, lng)}" target="_blank" rel="noopener">📍 Google Maps</a>
      <a class="map-link" href="${appleMapsUrl(lat, lng)}" target="_blank" rel="noopener">🗺️ Apple Maps</a>
    `;
  } else {
    mapLinks.innerHTML = '<div style="font-size:11px;color:#aaa">No GPS — map links unavailable</div>';
  }

  // Default bulba reaction
  bulbaReaction.innerHTML = BULBA_REACTIONS[selectedType] || '';

  // Slide up the sheet
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sheet.classList.add('show');
      // Focus nickname after transition
      setTimeout(() => nameInput.focus({ preventScroll: true }), 400);
    });
  });

  // ===== EVENT HANDLERS =====

  // Type selection
  typeSel.addEventListener('click', (e) => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    selectedType = btn.dataset.type;
    typeSel.querySelectorAll('.type-btn').forEach(b => {
      b.classList.remove('selected');
      b.style.background = '#fff';
      b.style.color = '';
    });
    btn.classList.add('selected');
    btn.style.background = SPOT_TYPES[selectedType].color;
    btn.style.color = '#fff';
    bulbaReaction.innerHTML = BULBA_REACTIONS[selectedType] || '';
  });

  // Rarity selection
  rarSel.addEventListener('click', (e) => {
    const btn = e.target.closest('.rarity-btn');
    if (!btn) return;
    selectedRarity = btn.dataset.rarity;
    rarSel.querySelectorAll('.rarity-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Photo input — OffscreenCanvas with iOS <16.4 fallback
  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const bitmap = await createImageBitmap(file);
      const maxW = 800;
      const scale = Math.min(1, maxW / bitmap.width);

      try {
        // Try OffscreenCanvas (may crash on iOS <16.4)
        const canvas = new OffscreenCanvas(bitmap.width * scale, bitmap.height * scale);
        const octx = canvas.getContext('2d');
        octx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        photoBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      } catch {
        // Fallback to regular canvas
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width * scale;
        canvas.height = bitmap.height * scale;
        const octx = canvas.getContext('2d');
        octx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        photoBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
      }

      photoPreview.src = URL.createObjectURL(photoBlob);
      photoPreview.classList.add('show');
    } catch {
      // Silently fail if image processing fails
    }
  });

  // Catch button
  catchBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.style.borderColor = 'var(--poke-red)';
      nameInput.classList.remove('shake');
      void nameInput.offsetWidth;
      nameInput.classList.add('shake');
      return;
    }

    ctx.onCatch({
      nickname: name,
      type: selectedType,
      rarity: selectedRarity,
      notes: notesInput.value.trim(),
      photoBlob,
    });
  });

  // Run button
  runBtn.addEventListener('click', () => ctx.onClose());

  // ===== iOS KEYBOARD HANDLING =====
  let vvCleanup = null;
  if (window.visualViewport) {
    const onResize = () => {
      const vvHeight = window.visualViewport.height;
      const fullHeight = window.innerHeight;
      const kbHeight = fullHeight - vvHeight;
      if (kbHeight > 100) {
        // Keyboard is open — constrain sheet
        sheet.style.maxHeight = `${vvHeight - 20}px`;
        sheet.style.bottom = `${kbHeight}px`;
      } else {
        sheet.style.maxHeight = '';
        sheet.style.bottom = '';
      }
    };
    window.visualViewport.addEventListener('resize', onResize);
    vvCleanup = () => window.visualViewport.removeEventListener('resize', onResize);
  } else {
    // Fallback: window resize
    let prevHeight = window.innerHeight;
    const onResize = () => {
      const diff = prevHeight - window.innerHeight;
      if (diff > 100) {
        sheet.style.maxHeight = `${window.innerHeight - 20}px`;
      } else {
        sheet.style.maxHeight = '';
      }
      prevHeight = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    vvCleanup = () => window.removeEventListener('resize', onResize);
  }

  return () => {
    if (vvCleanup) vvCleanup();
    // Revoke any object URLs
    if (photoPreview.src && photoPreview.src.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview.src);
    }
  };
}
