// lib/audio.js — Web Audio chiptune synthesizer
// Mirrors lib/speech.js pattern: iOS unlock, bus auto-listeners, silent no-op

import { bus } from './events.js';
import { getState } from './state.js';

let ctx = null;
let masterGain = null;
let unlocked = false;
let hadUserGesture = false;

function ensureCtx() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    const state = getState();
    masterGain.gain.value = state?.audioMuted ? 0 : (state?.audioVolume ?? 0.5);
    return true;
  } catch { return false; }
}

function unlock() {
  if (unlocked) return;
  hadUserGesture = true;
  if (!ensureCtx()) return;
  // iOS requires resume() from a user gesture
  if (ctx.state === 'suspended') ctx.resume();
  // Play a silent buffer to fully unlock
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  unlocked = true;
}

document.addEventListener('click', unlock, { once: true });
document.addEventListener('touchstart', unlock, { once: true });

// ===== SOUND DEFINITIONS =====
// Each sound is an array of tone specs: { t:type, f:freq, d:duration(s), g:gain, dl:delay(s) }
// Types: 'square', 'triangle', 'sawtooth', 'sine'

const SOUNDS = {
  // --- UI Sounds ---
  'ui-tap': [
    { t: 'square', f: 800, d: 0.06, g: 0.3 },
  ],
  'ui-nav': [
    { t: 'square', f: 523, d: 0.08, g: 0.25 },
    { t: 'square', f: 659, d: 0.08, g: 0.25, dl: 0.08 },
  ],
  'ui-toast': [
    { t: 'triangle', f: 1200, d: 0.1, g: 0.3 },
  ],
  'ui-close': [
    { t: 'square', f: 659, d: 0.08, g: 0.25 },
    { t: 'square', f: 523, d: 0.08, g: 0.25, dl: 0.08 },
  ],

  // --- Battle Sounds ---
  'battle-encounter': [
    { t: 'square', f: 330, d: 0.1, g: 0.3 },
    { t: 'square', f: 392, d: 0.1, g: 0.3, dl: 0.12 },
    { t: 'square', f: 494, d: 0.1, g: 0.3, dl: 0.24 },
    { t: 'square', f: 659, d: 0.2, g: 0.35, dl: 0.36 },
  ],
  'battle-correct': [
    { t: 'square', f: 880, d: 0.08, g: 0.3 },
    { t: 'square', f: 1047, d: 0.12, g: 0.3, dl: 0.08 },
  ],
  'battle-wrong': [
    { t: 'square', f: 311, d: 0.1, g: 0.3 },
    { t: 'square', f: 247, d: 0.15, g: 0.3, dl: 0.1 },
  ],
  'battle-combo-nice': [
    { t: 'square', f: 523, d: 0.08, g: 0.3 },
    { t: 'square', f: 659, d: 0.08, g: 0.3, dl: 0.08 },
    { t: 'square', f: 784, d: 0.12, g: 0.35, dl: 0.16 },
  ],
  'battle-combo-great': [
    { t: 'square', f: 523, d: 0.07, g: 0.3 },
    { t: 'square', f: 659, d: 0.07, g: 0.3, dl: 0.07 },
    { t: 'square', f: 784, d: 0.07, g: 0.3, dl: 0.14 },
    { t: 'square', f: 1047, d: 0.12, g: 0.35, dl: 0.21 },
  ],
  'battle-combo-excellent': [
    { t: 'square', f: 523, d: 0.06, g: 0.3 },
    { t: 'square', f: 659, d: 0.06, g: 0.3, dl: 0.06 },
    { t: 'square', f: 784, d: 0.06, g: 0.3, dl: 0.12 },
    { t: 'square', f: 1047, d: 0.06, g: 0.3, dl: 0.18 },
    { t: 'square', f: 1319, d: 0.15, g: 0.35, dl: 0.24 },
  ],
  'battle-combo-master': [
    { t: 'square', f: 523, d: 0.05, g: 0.3 },
    { t: 'square', f: 659, d: 0.05, g: 0.3, dl: 0.05 },
    { t: 'square', f: 784, d: 0.05, g: 0.3, dl: 0.1 },
    { t: 'square', f: 1047, d: 0.05, g: 0.3, dl: 0.15 },
    { t: 'square', f: 1319, d: 0.05, g: 0.3, dl: 0.2 },
    { t: 'square', f: 1568, d: 0.2, g: 0.4, dl: 0.25 },
  ],
  'battle-results-master': [
    { t: 'triangle', f: 523, d: 0.12, g: 0.35 },
    { t: 'triangle', f: 659, d: 0.12, g: 0.35, dl: 0.15 },
    { t: 'triangle', f: 784, d: 0.12, g: 0.35, dl: 0.3 },
    { t: 'triangle', f: 1047, d: 0.3, g: 0.4, dl: 0.45 },
    { t: 'square', f: 1047, d: 0.1, g: 0.2, dl: 0.45 },
    { t: 'triangle', f: 1319, d: 0.4, g: 0.4, dl: 0.75 },
  ],
  'battle-results-ace': [
    { t: 'triangle', f: 523, d: 0.12, g: 0.35 },
    { t: 'triangle', f: 659, d: 0.12, g: 0.35, dl: 0.15 },
    { t: 'triangle', f: 784, d: 0.2, g: 0.35, dl: 0.3 },
    { t: 'triangle', f: 1047, d: 0.3, g: 0.4, dl: 0.5 },
  ],
  'battle-results-trainer': [
    { t: 'triangle', f: 440, d: 0.15, g: 0.3 },
    { t: 'triangle', f: 523, d: 0.15, g: 0.3, dl: 0.18 },
    { t: 'triangle', f: 659, d: 0.25, g: 0.35, dl: 0.36 },
  ],
  'battle-results-youngster': [
    { t: 'triangle', f: 392, d: 0.15, g: 0.25 },
    { t: 'triangle', f: 330, d: 0.25, g: 0.25, dl: 0.18 },
  ],

  // --- Catch Sounds ---
  'catch-encounter': [
    { t: 'square', f: 440, d: 0.08, g: 0.3 },
    { t: 'square', f: 554, d: 0.08, g: 0.3, dl: 0.1 },
    { t: 'square', f: 659, d: 0.12, g: 0.35, dl: 0.2 },
  ],
  'catch-throw': [
    { t: 'sine', f: 600, d: 0.05, g: 0.25 },
    { t: 'sine', f: 900, d: 0.1, g: 0.2, dl: 0.05 },
  ],
  'catch-shake': [
    { t: 'square', f: 220, d: 0.05, g: 0.2 },
    { t: 'square', f: 280, d: 0.05, g: 0.2, dl: 0.05 },
  ],
  'catch-success': [
    { t: 'square', f: 784, d: 0.08, g: 0.3 },
    { t: 'square', f: 988, d: 0.08, g: 0.3, dl: 0.1 },
    { t: 'square', f: 1175, d: 0.15, g: 0.35, dl: 0.2 },
  ],
  'catch-breakfree': [
    { t: 'square', f: 440, d: 0.06, g: 0.3 },
    { t: 'square', f: 330, d: 0.1, g: 0.3, dl: 0.06 },
  ],

  // --- Special Sounds ---
  'badge-fanfare': [
    { t: 'square', f: 523, d: 0.1, g: 0.3 },
    { t: 'square', f: 523, d: 0.1, g: 0.3, dl: 0.12 },
    { t: 'square', f: 523, d: 0.1, g: 0.3, dl: 0.24 },
    { t: 'square', f: 523, d: 0.15, g: 0.35, dl: 0.4 },
    { t: 'triangle', f: 415, d: 0.15, g: 0.3, dl: 0.55 },
    { t: 'triangle', f: 466, d: 0.15, g: 0.3, dl: 0.7 },
    { t: 'triangle', f: 523, d: 0.15, g: 0.3, dl: 0.85 },
    { t: 'square', f: 659, d: 0.4, g: 0.4, dl: 1.0 },
  ],
  'wild-fact': [
    { t: 'triangle', f: 659, d: 0.1, g: 0.25 },
    { t: 'triangle', f: 784, d: 0.1, g: 0.3, dl: 0.1 },
  ],
  'nara-deer': [
    { t: 'triangle', f: 880, d: 0.15, g: 0.3 },
    { t: 'triangle', f: 784, d: 0.1, g: 0.25, dl: 0.15 },
    { t: 'triangle', f: 880, d: 0.1, g: 0.25, dl: 0.3 },
    { t: 'sine', f: 1175, d: 0.2, g: 0.2, dl: 0.35 },
  ],
  'bulbasaur-tap': [
    { t: 'square', f: 1047, d: 0.04, g: 0.2 },
  ],
  'bulbasaur-vinewhip': [
    { t: 'sawtooth', f: 220, d: 0.05, g: 0.2 },
    { t: 'sawtooth', f: 330, d: 0.05, g: 0.25, dl: 0.05 },
    { t: 'sawtooth', f: 494, d: 0.05, g: 0.3, dl: 0.1 },
    { t: 'square', f: 659, d: 0.08, g: 0.3, dl: 0.15 },
    { t: 'square', f: 880, d: 0.1, g: 0.35, dl: 0.2 },
  ],
};

// ===== PLAY ENGINE =====
export function sfx(name) {
  // Don't create AudioContext before user gesture (avoids console warning)
  if (!hadUserGesture) return;
  if (!ensureCtx()) return;
  const state = getState();
  if (state?.audioMuted) return;

  const tones = SOUNDS[name];
  if (!tones) return;

  const now = ctx.currentTime;
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.t;
    osc.frequency.value = tone.f;
    gain.gain.setValueAtTime(tone.g, now + (tone.dl || 0));
    gain.gain.exponentialRampToValueAtTime(0.001, now + (tone.dl || 0) + tone.d);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + (tone.dl || 0));
    osc.stop(now + (tone.dl || 0) + tone.d + 0.02);
  }
}

// ===== MUTE / VOLUME API =====
export function toggleMute() {
  const state = getState();
  state.audioMuted = !state.audioMuted;
  if (masterGain) masterGain.gain.value = state.audioMuted ? 0 : (state.audioVolume ?? 0.5);
  return state.audioMuted;
}

export function setVolume(v) {
  const state = getState();
  state.audioVolume = Math.max(0, Math.min(1, v));
  if (masterGain && !state.audioMuted) masterGain.gain.value = state.audioVolume;
}

// ===== BUS AUTO-LISTENERS =====
// These call sfx() which lazily initializes AudioContext on first actual playback,
// avoiding the console warning about creating AudioContext before user gesture.
bus.on('show-toast', () => sfx('ui-toast'));
bus.on('badge-earned', () => sfx('badge-fanfare'));
bus.on('spot-caught', () => sfx('catch-success'));
bus.on('nara-deer', () => sfx('nara-deer'));
bus.on('navigate', () => sfx('ui-nav'));
