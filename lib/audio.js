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
  'catch-heartbeat': [
    { t: 'sine', f: 80, d: 0.15, g: 0.35 },
    { t: 'sine', f: 90, d: 0.15, g: 0.3, dl: 0.5 },
    { t: 'sine', f: 100, d: 0.15, g: 0.25, dl: 1.0 },
  ],
  'catch-success': [
    { t: 'sine', f: 400, d: 0.15, g: 0.3 },
    { t: 'sine', f: 900, d: 0.2, g: 0.25, dl: 0.05 },
    { t: 'square', f: 523, d: 0.08, g: 0.25, dl: 0.1 },
    { t: 'square', f: 659, d: 0.08, g: 0.25, dl: 0.2 },
    { t: 'square', f: 784, d: 0.12, g: 0.3, dl: 0.3 },
    { t: 'triangle', f: 523, d: 0.35, g: 0.2, dl: 0.15 },
    { t: 'triangle', f: 659, d: 0.35, g: 0.2, dl: 0.15 },
    { t: 'triangle', f: 784, d: 0.35, g: 0.2, dl: 0.15 },
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
  'location-discovery': [
    { t: 'triangle', f: 523, d: 0.1, g: 0.3 },
    { t: 'triangle', f: 659, d: 0.1, g: 0.3, dl: 0.12 },
    { t: 'triangle', f: 784, d: 0.1, g: 0.3, dl: 0.24 },
    { t: 'square', f: 1047, d: 0.15, g: 0.35, dl: 0.36 },
    { t: 'square', f: 1319, d: 0.25, g: 0.4, dl: 0.52 },
  ],
  'ball-upgrade': [
    { t: 'triangle', f: 523, d: 0.08, g: 0.3 },
    { t: 'triangle', f: 659, d: 0.08, g: 0.3, dl: 0.08 },
    { t: 'triangle', f: 784, d: 0.08, g: 0.3, dl: 0.16 },
    { t: 'square', f: 1047, d: 0.08, g: 0.35, dl: 0.24 },
    { t: 'square', f: 1319, d: 0.2, g: 0.4, dl: 0.32 },
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
  'onboarding-melody': [
    { t: 'triangle', f: 523, d: 0.2, g: 0.25 },
    { t: 'triangle', f: 659, d: 0.2, g: 0.25, dl: 0.25 },
    { t: 'triangle', f: 784, d: 0.2, g: 0.25, dl: 0.5 },
    { t: 'triangle', f: 659, d: 0.2, g: 0.25, dl: 0.75 },
    { t: 'triangle', f: 784, d: 0.2, g: 0.25, dl: 1.0 },
    { t: 'triangle', f: 1047, d: 0.3, g: 0.3, dl: 1.25 },
    { t: 'triangle', f: 784, d: 0.2, g: 0.25, dl: 1.6 },
    { t: 'triangle', f: 659, d: 0.2, g: 0.25, dl: 1.85 },
    { t: 'triangle', f: 523, d: 0.2, g: 0.25, dl: 2.1 },
    { t: 'triangle', f: 659, d: 0.2, g: 0.25, dl: 2.35 },
    { t: 'triangle', f: 784, d: 0.4, g: 0.3, dl: 2.6 },
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
bus.on('location-easter-egg', () => sfx('location-discovery'));

// ===== LOOP SYSTEM =====
const LOOPS = {
  // ---- BATTLE: Gym battle theme in A minor, 140 BPM, 8 bars ----
  // Driving, energetic feel with syncopation and minor key tension.
  // Each bar = 4 beats. 8 bars = 32 beats total for both lead and bass.
  battle: {
    bpm: 140,
    bars: 8,
    lead: [
      // Bar 1 (4 beats): Opening A-minor arpeggio burst
      { f: 440, d: 0.5 }, { f: 523, d: 0.5 }, { f: 659, d: 0.5 }, { f: 523, d: 0.5 },  // 2
      { f: 440, d: 0.5 }, { f: 523, d: 0.5 }, { f: 659, d: 1.0 },                        // 2
      // Bar 2 (4 beats): Response — descending with syncopation
      { f: 784, d: 0.5 }, { f: 659, d: 0.5 }, { f: 523, d: 0.5 }, { f: 440, d: 0.5 },  // 2
      { f: 392, d: 0.5 }, { f: 440, d: 1.0 }, { f: 523, d: 0.5 },                        // 2
      // Bar 3 (4 beats): Melodic hook — ascending phrase
      { f: 659, d: 0.5 }, { f: 784, d: 0.5 }, { f: 880, d: 1.0 },                        // 2
      { f: 784, d: 0.5 }, { f: 659, d: 0.5 }, { f: 523, d: 0.5 }, { f: 659, d: 0.5 },  // 2
      // Bar 4 (4 beats): Hook continuation — climbs higher
      { f: 784, d: 0.5 }, { f: 880, d: 0.5 }, { f: 1047, d: 0.5 }, { f: 880, d: 0.5 }, // 2
      { f: 784, d: 1.0 }, { f: 659, d: 1.0 },                                            // 2
      // Bar 5 (4 beats): Tension — chromatic run
      { f: 392, d: 0.25 }, { f: 415, d: 0.25 }, { f: 440, d: 0.25 }, { f: 466, d: 0.25 }, // 1
      { f: 494, d: 0.5 }, { f: 523, d: 0.5 },                                              // 1
      { f: 659, d: 0.5 }, { f: 784, d: 0.5 }, { f: 880, d: 1.0 },                          // 2
      // Bar 6 (4 beats): Call-and-response — fast arpeggios
      { f: 880, d: 0.25 }, { f: 784, d: 0.25 }, { f: 659, d: 0.25 }, { f: 523, d: 0.25 }, // 1
      { f: 440, d: 0.5 }, { f: 523, d: 0.5 },                                              // 1
      { f: 659, d: 0.5 }, { f: 784, d: 0.5 }, { f: 659, d: 0.5 }, { f: 523, d: 0.5 },    // 2
      // Bar 7 (4 beats): Restate hook with variation
      { f: 659, d: 0.5 }, { f: 784, d: 0.5 }, { f: 880, d: 0.5 }, { f: 1047, d: 0.5 },  // 2
      { f: 880, d: 0.5 }, { f: 784, d: 0.25 }, { f: 659, d: 0.25 }, { f: 784, d: 1.0 },  // 2
      // Bar 8 (4 beats): Resolution — settle on A for clean loop
      { f: 659, d: 0.5 }, { f: 523, d: 0.5 }, { f: 440, d: 1.0 },                        // 2
      { f: 523, d: 0.25 }, { f: 440, d: 0.25 }, { f: 392, d: 0.5 }, { f: 440, d: 1.0 },  // 2
    ],
    leadType: 'square',
    leadGain: 0.12,
    bass: [
      // Bar 1 (4 beats): Driving root-fifth eighth notes
      { f: 110, d: 0.5 }, { f: 165, d: 0.5 }, { f: 110, d: 0.5 }, { f: 165, d: 0.5 },  // 2
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 }, { f: 165, d: 0.5 }, { f: 131, d: 0.5 },  // 2
      // Bar 2 (4 beats): Descending bass motion
      { f: 147, d: 0.5 }, { f: 131, d: 0.5 }, { f: 110, d: 0.5 }, { f: 131, d: 0.5 },  // 2
      { f: 98, d: 0.5 }, { f: 110, d: 1.0 }, { f: 131, d: 0.5 },                        // 2
      // Bar 3 (4 beats): More melodic bass movement
      { f: 131, d: 1.0 }, { f: 165, d: 1.0 },                                            // 2
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 }, { f: 165, d: 0.5 }, { f: 131, d: 0.5 },  // 2
      // Bar 4 (4 beats): Following the harmony
      { f: 147, d: 0.5 }, { f: 196, d: 0.5 }, { f: 165, d: 0.5 }, { f: 147, d: 0.5 },  // 2
      { f: 131, d: 1.0 }, { f: 110, d: 1.0 },                                            // 2
      // Bar 5 (4 beats): Chromatic tension bass
      { f: 98, d: 0.5 }, { f: 104, d: 0.5 }, { f: 110, d: 0.5 }, { f: 117, d: 0.5 },   // 2
      { f: 131, d: 1.0 }, { f: 165, d: 1.0 },                                            // 2
      // Bar 6 (4 beats): Walking bass
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 }, { f: 147, d: 0.5 }, { f: 165, d: 0.5 },  // 2
      { f: 175, d: 0.5 }, { f: 165, d: 0.5 }, { f: 147, d: 0.5 }, { f: 131, d: 0.5 },  // 2
      // Bar 7 (4 beats): Octave jumps for intensity
      { f: 110, d: 0.5 }, { f: 220, d: 0.5 }, { f: 110, d: 0.5 }, { f: 165, d: 0.5 },  // 2
      { f: 131, d: 0.5 }, { f: 196, d: 0.5 }, { f: 131, d: 1.0 },                        // 2
      // Bar 8 (4 beats): Resolve to A
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 }, { f: 110, d: 1.0 },                        // 2
      { f: 131, d: 0.5 }, { f: 110, d: 0.5 }, { f: 110, d: 1.0 },                        // 2
    ],
    bassType: 'triangle',
    bassGain: 0.1,
  },

  // ---- POKEDEX: Pokemon Center / browsing theme in C major, 90 BPM, 8 bars ----
  // Calm, pleasant, gentle stepwise melody. Think healing music.
  // Each bar = 4 beats. 8 bars = 32 beats total for both lead and bass.
  pokedex: {
    bpm: 90,
    bars: 8,
    lead: [
      // Bar 1 (4 beats): Gentle opening — C major stepwise
      { f: 523, d: 1.0 }, { f: 587, d: 0.5 }, { f: 659, d: 0.5 },  // 2
      { f: 784, d: 1.0 }, { f: 659, d: 0.5 }, { f: 587, d: 0.5 },  // 2
      // Bar 2 (4 beats): Continuing gently
      { f: 523, d: 0.5 }, { f: 587, d: 0.5 }, { f: 659, d: 1.0 },  // 2
      { f: 784, d: 0.5 }, { f: 659, d: 0.5 }, { f: 523, d: 1.0 },  // 2
      // Bar 3 (4 beats): Sweet ascending phrase
      { f: 659, d: 0.5 }, { f: 698, d: 0.5 }, { f: 784, d: 1.0 },  // 2
      { f: 880, d: 0.5 }, { f: 784, d: 0.5 }, { f: 698, d: 1.0 },  // 2
      // Bar 4 (4 beats): Descending resolution
      { f: 659, d: 1.0 }, { f: 587, d: 0.5 }, { f: 523, d: 0.5 },  // 2
      { f: 587, d: 1.0 }, { f: 523, d: 1.0 },                        // 2
      // Bar 5 (4 beats): Gentle variation — higher register
      { f: 784, d: 1.0 }, { f: 880, d: 0.5 }, { f: 784, d: 0.5 },  // 2
      { f: 659, d: 0.5 }, { f: 698, d: 0.5 }, { f: 659, d: 1.0 },  // 2
      // Bar 6 (4 beats): Stepping back down
      { f: 587, d: 0.5 }, { f: 523, d: 0.5 }, { f: 587, d: 1.0 },  // 2
      { f: 659, d: 1.0 }, { f: 523, d: 1.0 },                        // 2
      // Bar 7 (4 beats): Resolution phrase
      { f: 784, d: 0.5 }, { f: 698, d: 0.5 }, { f: 659, d: 0.5 }, { f: 587, d: 0.5 },  // 2
      { f: 523, d: 1.0 }, { f: 587, d: 0.5 }, { f: 523, d: 0.5 },                        // 2
      // Bar 8 (4 beats): Final held note for loop
      { f: 659, d: 0.5 }, { f: 587, d: 0.5 }, { f: 523, d: 1.0 },  // 2
      { f: 523, d: 2.0 },                                              // 2
    ],
    leadType: 'triangle',
    leadGain: 0.07,
    bass: [
      // Bar 1 (4 beats)
      { f: 131, d: 2.0 }, { f: 165, d: 2.0 },
      // Bar 2 (4 beats)
      { f: 131, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 3 (4 beats)
      { f: 175, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 4 (4 beats)
      { f: 165, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 5 (4 beats)
      { f: 196, d: 2.0 }, { f: 175, d: 2.0 },
      // Bar 6 (4 beats)
      { f: 147, d: 2.0 }, { f: 165, d: 2.0 },
      // Bar 7 (4 beats)
      { f: 196, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 8 (4 beats)
      { f: 165, d: 2.0 }, { f: 131, d: 2.0 },
    ],
    bassType: 'triangle',
    bassGain: 0.05,
  },

  // ---- JOURNAL: Town map / journal theme in G major, 80 BPM, 8 bars ----
  // Contemplative, warm, nostalgic. Held notes with gentle movement.
  // Each bar = 4 beats. 8 bars = 32 beats total for both lead and bass.
  journal: {
    bpm: 80,
    bars: 8,
    lead: [
      // Bar 1 (4 beats): Warm opening in G major
      { f: 392, d: 1.5 }, { f: 494, d: 0.5 }, { f: 587, d: 1.0 }, { f: 494, d: 1.0 },  // 4
      // Bar 2 (4 beats): Gentle movement
      { f: 440, d: 1.0 }, { f: 494, d: 0.5 }, { f: 523, d: 0.5 }, { f: 587, d: 2.0 },  // 4
      // Bar 3 (4 beats): Ascending contemplation
      { f: 523, d: 1.0 }, { f: 587, d: 1.0 }, { f: 659, d: 1.5 }, { f: 587, d: 0.5 },  // 4
      // Bar 4 (4 beats): Descend with held note
      { f: 494, d: 1.0 }, { f: 440, d: 0.5 }, { f: 494, d: 0.5 }, { f: 392, d: 2.0 },  // 4
      // Bar 5 (4 beats): Gentle peak
      { f: 587, d: 1.0 }, { f: 659, d: 0.5 }, { f: 587, d: 0.5 }, { f: 494, d: 2.0 },  // 4
      // Bar 6 (4 beats): Settling back
      { f: 523, d: 1.0 }, { f: 494, d: 0.5 }, { f: 440, d: 0.5 }, { f: 392, d: 2.0 },  // 4
      // Bar 7 (4 beats): Nostalgic resolution
      { f: 494, d: 1.0 }, { f: 440, d: 0.5 }, { f: 392, d: 0.5 }, { f: 330, d: 2.0 },  // 4
      // Bar 8 (4 beats): Final rest on G
      { f: 392, d: 1.0 }, { f: 330, d: 0.5 }, { f: 392, d: 0.5 }, { f: 392, d: 2.0 },  // 4
    ],
    leadType: 'triangle',
    leadGain: 0.06,
    bass: [
      // Bar 1 (4 beats)
      { f: 196, d: 2.0 }, { f: 147, d: 2.0 },
      // Bar 2 (4 beats)
      { f: 175, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 3 (4 beats)
      { f: 131, d: 2.0 }, { f: 165, d: 2.0 },
      // Bar 4 (4 beats)
      { f: 147, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 5 (4 beats)
      { f: 147, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 6 (4 beats)
      { f: 131, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 7 (4 beats)
      { f: 165, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 8 (4 beats)
      { f: 98, d: 2.0 }, { f: 196, d: 2.0 },
    ],
    bassType: 'triangle',
    bassGain: 0.04,
  },
};

let loopTimer = null;
let loopNodes = [];
let loopName = null;

function scheduleBar(loop, startTime) {
  const beatDur = 60 / loop.bpm;

  let offset = 0;
  for (const note of loop.lead) {
    const dur = note.d * beatDur;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = loop.leadType;
    osc.frequency.value = note.f;
    gain.gain.setValueAtTime(loop.leadGain, startTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + dur - 0.02);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime + offset);
    osc.stop(startTime + offset + dur);
    loopNodes.push(osc);
    offset += dur;
  }

  if (loop.bass) {
    let bOff = 0;
    for (const note of loop.bass) {
      const dur = note.d * beatDur;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = loop.bassType;
      osc.frequency.value = note.f;
      gain.gain.setValueAtTime(loop.bassGain, startTime + bOff);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + bOff + dur - 0.02);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startTime + bOff);
      osc.stop(startTime + bOff + dur);
      loopNodes.push(osc);
      bOff += dur;
    }
  }

  return offset;
}

function loopTick() {
  if (!loopName || !ctx) return;
  const loop = LOOPS[loopName];
  if (!loop) return;

  const chunkDur = scheduleBar(loop, ctx.currentTime + 0.05);
  loopTimer = setTimeout(loopTick, (chunkDur - 0.1) * 1000);
}

export function startLoop(name) {
  if (!hadUserGesture) return;
  if (!ensureCtx()) return;
  const state = getState();
  if (state?.audioMuted) return;
  if (!LOOPS[name]) return;

  stopLoop();
  loopName = name;
  loopTick();
}

export function stopLoop() {
  loopName = null;
  clearTimeout(loopTimer);
  loopTimer = null;
  for (const node of loopNodes) {
    try { node.stop(); } catch {}
  }
  loopNodes = [];
}

document.addEventListener('visibilitychange', () => {
  if (!loopName) return;
  if (document.hidden) {
    clearTimeout(loopTimer);
    loopTimer = null;
    for (const node of loopNodes) {
      try { node.stop(); } catch {}
    }
    loopNodes = [];
    if (ctx) ctx.suspend();
  } else {
    if (ctx) ctx.resume().then(() => { if (loopName) loopTick(); });
  }
});
