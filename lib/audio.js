// lib/audio.js -- GBA-style 4-channel chiptune synthesizer
// ========================================================
// Rewritten by Junichi Masuda (guest consultant)
//
// Architecture mirrors the Game Boy Advance sound hardware:
//   Channel 1 (Pulse 1) -- square wave with duty cycle, used for melody
//   Channel 2 (Pulse 2) -- square wave, echo/harmony/counter-melody
//   Channel 3 (Wave)    -- triangle, bass lines and pads
//   Channel 4 (Noise)   -- LFSR noise, percussion (kick, snare, hat)
//
// Key techniques brought from Gen III:
//   - Duty cycle simulation via setPeriodicWave (12.5%, 25%, 50%, 75%)
//   - Echo effect: Pulse2 trails Pulse1 with slight delay + lower gain
//   - Arpeggiated chords from a single channel (rapid note switching)
//   - Noise channel drives rhythm in every loop
//   - ADSR envelopes for expressive dynamics
//   - Volume envelope shaping on every note

import { bus } from './events.js';
import { getState } from './state.js';

// =====================================================================
// AUDIO CONTEXT + UNLOCK
// =====================================================================
let ctx = null;
let masterGain = null;
let unlocked = false;
let hadUserGesture = false;

// Pre-built PeriodicWave objects for GBA duty cycles
let duty125 = null;  // 12.5% pulse -- thin, nasal
let duty250 = null;  // 25% pulse  -- classic chiptune
let duty500 = null;  // 50% pulse  -- hollow square
let duty750 = null;  // 75% pulse  -- same as 25% inverted, slightly different feel

function buildDutyCycleWaves() {
  // GBA pulse channels use 4 duty cycles. We approximate them with
  // Fourier coefficients for a pulse wave of width W:
  //   a_n = (2 / (n * pi)) * sin(n * pi * W)
  // We use 32 harmonics (matching GBA's 32-sample wave table resolution).
  const N = 32;
  function makePulse(width) {
    const real = new Float32Array(N + 1);
    const imag = new Float32Array(N + 1);
    real[0] = 0;
    imag[0] = 0;
    for (let n = 1; n <= N; n++) {
      real[n] = 0;
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * width);
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  duty125 = makePulse(0.125);
  duty250 = makePulse(0.25);
  duty500 = makePulse(0.5);
  duty750 = makePulse(0.75);
}

function getDutyWave(duty) {
  if (duty === 125) return duty125;
  if (duty === 250) return duty250;
  if (duty === 750) return duty750;
  return duty500; // default 50%
}

function ensureCtx() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    const state = getState();
    masterGain.gain.value = state?.audioMuted ? 0 : (state?.audioVolume ?? 0.5);
    buildDutyCycleWaves();
    return true;
  } catch { return false; }
}

function unlock() {
  if (unlocked) return;
  hadUserGesture = true;
  if (!ensureCtx()) return;
  if (ctx.state === 'suspended') ctx.resume();
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  unlocked = true;
}

document.addEventListener('click', unlock, { once: true });
document.addEventListener('touchstart', unlock, { once: true });

// =====================================================================
// ADSR ENVELOPE HELPER
// =====================================================================
// GBA volume envelopes are 4-bit (16 levels). We simulate with smooth
// Web Audio ramps. All times in seconds.
function applyADSR(gainNode, startTime, peak, a, d, s, r, duration) {
  const g = gainNode.gain;
  // Start silent
  g.setValueAtTime(0.001, startTime);
  // Attack
  g.linearRampToValueAtTime(peak, startTime + a);
  // Decay to sustain level
  g.linearRampToValueAtTime(peak * s, startTime + a + d);
  // Hold sustain until release
  const sustainEnd = startTime + duration - r;
  if (sustainEnd > startTime + a + d) {
    g.setValueAtTime(peak * s, sustainEnd);
  }
  // Release
  g.linearRampToValueAtTime(0.001, startTime + duration);
}

// Quick decay envelope for percussive hits
function applyDecay(gainNode, startTime, peak, duration) {
  const g = gainNode.gain;
  g.setValueAtTime(peak, startTime);
  g.exponentialRampToValueAtTime(0.001, startTime + duration);
}

// =====================================================================
// NOISE CHANNEL (Channel 4)
// =====================================================================
// The GBA noise channel uses a linear-feedback shift register.
// We simulate with AudioBuffer filled with random samples.
let noiseBuffer = null;

function getNoiseBuffer() {
  if (noiseBuffer) return noiseBuffer;
  const len = ctx.sampleRate * 2; // 2 seconds of noise
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Play a noise hit (kick, snare, hat) at a given time
// type: 'kick' | 'snare' | 'hat' | 'crash' | 'white'
function scheduleNoise(startTime, type, gain, dest) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer();

  const envGain = ctx.createGain();

  if (type === 'kick') {
    // Kick: sine sub-hit + short noise burst
    // Noise component
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 200;
    src.connect(filt);
    filt.connect(envGain);
    applyDecay(envGain, startTime, gain * 0.5, 0.08);
    envGain.connect(dest);
    src.start(startTime);
    src.stop(startTime + 0.1);

    // Sine sub-hit (the thump)
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(150, startTime);
    kick.frequency.exponentialRampToValueAtTime(40, startTime + 0.07);
    applyDecay(kickGain, startTime, gain * 0.8, 0.1);
    kick.connect(kickGain);
    kickGain.connect(dest);
    kick.start(startTime);
    kick.stop(startTime + 0.12);
    return [src, kick];
  }

  if (type === 'snare') {
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 3000;
    filt.Q.value = 1.5;
    src.connect(filt);
    filt.connect(envGain);
    applyDecay(envGain, startTime, gain * 0.6, 0.1);
    envGain.connect(dest);
    src.start(startTime);
    src.stop(startTime + 0.12);

    // Tonal body (square burst)
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'square';
    body.frequency.value = 180;
    applyDecay(bodyGain, startTime, gain * 0.3, 0.06);
    body.connect(bodyGain);
    bodyGain.connect(dest);
    body.start(startTime);
    body.stop(startTime + 0.08);
    return [src, body];
  }

  if (type === 'hat') {
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 8000;
    src.connect(filt);
    filt.connect(envGain);
    applyDecay(envGain, startTime, gain * 0.25, 0.04);
    envGain.connect(dest);
    src.start(startTime);
    src.stop(startTime + 0.06);
    return [src];
  }

  if (type === 'crash') {
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 5000;
    src.connect(filt);
    filt.connect(envGain);
    applyDecay(envGain, startTime, gain * 0.35, 0.3);
    envGain.connect(dest);
    src.start(startTime);
    src.stop(startTime + 0.35);
    return [src];
  }

  // White noise (raw)
  src.connect(envGain);
  applyDecay(envGain, startTime, gain * 0.3, 0.05);
  envGain.connect(dest);
  src.start(startTime);
  src.stop(startTime + 0.08);
  return [src];
}

// =====================================================================
// NOTE HELPER -- creates a pulse or triangle note with ADSR
// =====================================================================
function scheduleNote(startTime, freq, duration, gainVal, duty, dest, adsr) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  if (duty != null) {
    osc.setPeriodicWave(getDutyWave(duty));
  } else {
    osc.type = 'triangle';
  }

  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(dest);

  if (adsr) {
    applyADSR(g, startTime, gainVal, adsr.a, adsr.d, adsr.s, adsr.r, duration);
  } else {
    // Default: quick attack, sustain, short release
    applyADSR(g, startTime, gainVal, 0.005, 0.02, 0.7, Math.min(0.05, duration * 0.2), duration);
  }

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
  return osc;
}

// =====================================================================
// SOUND EFFECTS (SFX)
// =====================================================================
// Each SFX is a function that schedules oscillators/noise at ctx.currentTime.
// This gives us full control over layering, envelopes, and noise -- far
// beyond the old array-of-tone-specs approach.

// Multi-tone SFX builder: plays an array of specs with the new engine
function playSpecs(specs) {
  const now = ctx.currentTime;
  for (const s of specs) {
    const start = now + (s.dl || 0);
    const dur = s.d;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (typeof s.t === 'number') {
      osc.setPeriodicWave(getDutyWave(s.t));
    } else {
      osc.type = s.t;
    }

    osc.frequency.value = s.f;
    if (s.fEnd) {
      osc.frequency.exponentialRampToValueAtTime(s.fEnd, start + dur);
    }
    osc.connect(gain);
    gain.connect(masterGain);

    if (s.adsr) {
      applyADSR(gain, start, s.g, s.adsr.a, s.adsr.d, s.adsr.s, s.adsr.r, dur);
    } else {
      applyADSR(gain, start, s.g, 0.005, 0.015, 0.6, Math.min(0.04, dur * 0.3), dur);
    }

    osc.start(start);
    osc.stop(start + dur + 0.01);
  }
}

const SFX_FUNCS = {
  // --- UI Sounds ---
  // Crisp, satisfying clicks. Duty 250 (classic GBA menu sound).
  'ui-tap': () => {
    playSpecs([
      { t: 250, f: 880, d: 0.04, g: 0.22 },
      { t: 250, f: 1320, d: 0.03, g: 0.12, dl: 0.01 },
    ]);
  },

  'ui-nav': () => {
    playSpecs([
      { t: 250, f: 587, d: 0.06, g: 0.2 },
      { t: 250, f: 740, d: 0.06, g: 0.2, dl: 0.06 },
      { t: 'triangle', f: 294, d: 0.08, g: 0.1, dl: 0.0 },
    ]);
  },

  'ui-toast': () => {
    playSpecs([
      { t: 250, f: 1047, d: 0.06, g: 0.2 },
      { t: 250, f: 1319, d: 0.08, g: 0.22, dl: 0.06 },
      { t: 'triangle', f: 523, d: 0.1, g: 0.1 },
    ]);
  },

  'ui-close': () => {
    playSpecs([
      { t: 250, f: 740, d: 0.06, g: 0.2 },
      { t: 250, f: 587, d: 0.06, g: 0.18, dl: 0.06 },
      { t: 'triangle', f: 294, d: 0.1, g: 0.08, dl: 0.06 },
    ]);
  },

  // --- Battle Sounds ---
  // Wild encounter: dramatic ascending phrase with noise hit
  'battle-encounter': () => {
    playSpecs([
      { t: 250, f: 330, d: 0.08, g: 0.25 },
      { t: 250, f: 392, d: 0.08, g: 0.25, dl: 0.1 },
      { t: 250, f: 494, d: 0.08, g: 0.28, dl: 0.2 },
      { t: 250, f: 659, d: 0.18, g: 0.3, dl: 0.3 },
      // Echo on pulse2
      { t: 500, f: 330, d: 0.06, g: 0.1, dl: 0.03 },
      { t: 500, f: 392, d: 0.06, g: 0.1, dl: 0.13 },
      { t: 500, f: 494, d: 0.06, g: 0.1, dl: 0.23 },
      { t: 500, f: 659, d: 0.12, g: 0.12, dl: 0.33 },
      // Bass hit
      { t: 'triangle', f: 110, d: 0.15, g: 0.2 },
    ]);
    scheduleNoise(ctx.currentTime, 'crash', 0.15, masterGain);
  },

  'battle-correct': () => {
    playSpecs([
      { t: 250, f: 880, d: 0.06, g: 0.25 },
      { t: 250, f: 1175, d: 0.1, g: 0.28, dl: 0.06 },
      // Harmony
      { t: 500, f: 659, d: 0.06, g: 0.1 },
      { t: 500, f: 880, d: 0.08, g: 0.1, dl: 0.06 },
    ]);
  },

  'battle-wrong': () => {
    playSpecs([
      { t: 125, f: 311, d: 0.1, g: 0.22 },
      { t: 125, f: 233, d: 0.15, g: 0.2, dl: 0.1 },
      { t: 'triangle', f: 82, d: 0.12, g: 0.15 },
    ]);
    scheduleNoise(ctx.currentTime, 'snare', 0.08, masterGain);
  },

  'battle-combo-nice': () => {
    playSpecs([
      { t: 250, f: 523, d: 0.06, g: 0.25 },
      { t: 250, f: 659, d: 0.06, g: 0.25, dl: 0.06 },
      { t: 250, f: 784, d: 0.1, g: 0.3, dl: 0.12 },
      // Echo
      { t: 500, f: 523, d: 0.05, g: 0.1, dl: 0.02 },
      { t: 500, f: 659, d: 0.05, g: 0.1, dl: 0.08 },
      { t: 500, f: 784, d: 0.08, g: 0.12, dl: 0.14 },
      { t: 'triangle', f: 262, d: 0.12, g: 0.1 },
    ]);
  },

  'battle-combo-great': () => {
    playSpecs([
      { t: 250, f: 523, d: 0.05, g: 0.25 },
      { t: 250, f: 659, d: 0.05, g: 0.25, dl: 0.05 },
      { t: 250, f: 784, d: 0.05, g: 0.28, dl: 0.1 },
      { t: 250, f: 1047, d: 0.1, g: 0.32, dl: 0.15 },
      { t: 500, f: 523, d: 0.04, g: 0.1, dl: 0.02 },
      { t: 500, f: 659, d: 0.04, g: 0.1, dl: 0.07 },
      { t: 500, f: 784, d: 0.04, g: 0.1, dl: 0.12 },
      { t: 500, f: 1047, d: 0.08, g: 0.12, dl: 0.17 },
      { t: 'triangle', f: 262, d: 0.15, g: 0.12 },
    ]);
    scheduleNoise(ctx.currentTime + 0.15, 'hat', 0.1, masterGain);
  },

  'battle-combo-excellent': () => {
    playSpecs([
      { t: 250, f: 523, d: 0.04, g: 0.25 },
      { t: 250, f: 659, d: 0.04, g: 0.25, dl: 0.04 },
      { t: 250, f: 784, d: 0.04, g: 0.28, dl: 0.08 },
      { t: 250, f: 1047, d: 0.04, g: 0.3, dl: 0.12 },
      { t: 250, f: 1319, d: 0.12, g: 0.35, dl: 0.16 },
      // Harmony thirds
      { t: 500, f: 659, d: 0.04, g: 0.12, dl: 0.08 },
      { t: 500, f: 880, d: 0.04, g: 0.12, dl: 0.12 },
      { t: 500, f: 1047, d: 0.1, g: 0.14, dl: 0.16 },
      { t: 'triangle', f: 262, d: 0.18, g: 0.12 },
    ]);
    scheduleNoise(ctx.currentTime, 'hat', 0.08, masterGain);
    scheduleNoise(ctx.currentTime + 0.16, 'crash', 0.1, masterGain);
  },

  'battle-combo-master': () => {
    playSpecs([
      { t: 250, f: 523, d: 0.04, g: 0.28 },
      { t: 250, f: 659, d: 0.04, g: 0.28, dl: 0.04 },
      { t: 250, f: 784, d: 0.04, g: 0.3, dl: 0.08 },
      { t: 250, f: 1047, d: 0.04, g: 0.32, dl: 0.12 },
      { t: 250, f: 1319, d: 0.04, g: 0.34, dl: 0.16 },
      { t: 250, f: 1568, d: 0.15, g: 0.38, dl: 0.2 },
      // Full harmony
      { t: 500, f: 659, d: 0.04, g: 0.12, dl: 0.04 },
      { t: 500, f: 784, d: 0.04, g: 0.12, dl: 0.08 },
      { t: 500, f: 1047, d: 0.04, g: 0.14, dl: 0.12 },
      { t: 500, f: 1319, d: 0.04, g: 0.14, dl: 0.16 },
      { t: 500, f: 1568, d: 0.12, g: 0.16, dl: 0.22 },
      { t: 'triangle', f: 262, d: 0.2, g: 0.15 },
      { t: 'triangle', f: 131, d: 0.2, g: 0.12 },
    ]);
    scheduleNoise(ctx.currentTime, 'crash', 0.15, masterGain);
    scheduleNoise(ctx.currentTime + 0.2, 'crash', 0.12, masterGain);
  },

  // Results fanfares -- layered with harmony and bass
  'battle-results-master': () => {
    playSpecs([
      // Melody (Pulse 1, duty 250)
      { t: 250, f: 523, d: 0.1, g: 0.28 },
      { t: 250, f: 659, d: 0.1, g: 0.28, dl: 0.12 },
      { t: 250, f: 784, d: 0.1, g: 0.3, dl: 0.24 },
      { t: 250, f: 1047, d: 0.25, g: 0.35, dl: 0.36 },
      { t: 250, f: 1319, d: 0.35, g: 0.38, dl: 0.65 },
      // Harmony (Pulse 2, duty 500)
      { t: 500, f: 392, d: 0.1, g: 0.12, dl: 0.0 },
      { t: 500, f: 523, d: 0.1, g: 0.12, dl: 0.12 },
      { t: 500, f: 659, d: 0.1, g: 0.14, dl: 0.24 },
      { t: 500, f: 784, d: 0.25, g: 0.16, dl: 0.36 },
      { t: 500, f: 1047, d: 0.35, g: 0.18, dl: 0.65 },
      // Bass
      { t: 'triangle', f: 131, d: 0.3, g: 0.15 },
      { t: 'triangle', f: 165, d: 0.3, g: 0.15, dl: 0.36 },
      { t: 'triangle', f: 131, d: 0.35, g: 0.18, dl: 0.65 },
    ]);
    scheduleNoise(ctx.currentTime, 'kick', 0.12, masterGain);
    scheduleNoise(ctx.currentTime + 0.36, 'snare', 0.1, masterGain);
    scheduleNoise(ctx.currentTime + 0.65, 'crash', 0.15, masterGain);
  },

  'battle-results-ace': () => {
    playSpecs([
      { t: 250, f: 523, d: 0.1, g: 0.25 },
      { t: 250, f: 659, d: 0.1, g: 0.25, dl: 0.12 },
      { t: 250, f: 784, d: 0.18, g: 0.3, dl: 0.24 },
      { t: 250, f: 1047, d: 0.25, g: 0.32, dl: 0.44 },
      { t: 500, f: 392, d: 0.1, g: 0.1 },
      { t: 500, f: 523, d: 0.1, g: 0.1, dl: 0.12 },
      { t: 500, f: 659, d: 0.18, g: 0.12, dl: 0.24 },
      { t: 'triangle', f: 131, d: 0.25, g: 0.12 },
      { t: 'triangle', f: 165, d: 0.25, g: 0.12, dl: 0.24 },
    ]);
    scheduleNoise(ctx.currentTime, 'kick', 0.1, masterGain);
    scheduleNoise(ctx.currentTime + 0.44, 'crash', 0.1, masterGain);
  },

  'battle-results-trainer': () => {
    playSpecs([
      { t: 250, f: 440, d: 0.12, g: 0.22 },
      { t: 250, f: 523, d: 0.12, g: 0.22, dl: 0.14 },
      { t: 250, f: 659, d: 0.2, g: 0.28, dl: 0.28 },
      { t: 'triangle', f: 220, d: 0.15, g: 0.1 },
      { t: 'triangle', f: 131, d: 0.2, g: 0.1, dl: 0.28 },
    ]);
  },

  'battle-results-youngster': () => {
    playSpecs([
      { t: 250, f: 392, d: 0.12, g: 0.18 },
      { t: 250, f: 330, d: 0.2, g: 0.16, dl: 0.14 },
      { t: 'triangle', f: 196, d: 0.2, g: 0.08 },
    ]);
  },

  // --- Catch Sounds ---
  'catch-encounter': () => {
    playSpecs([
      { t: 250, f: 440, d: 0.06, g: 0.25 },
      { t: 250, f: 554, d: 0.06, g: 0.28, dl: 0.08 },
      { t: 250, f: 659, d: 0.1, g: 0.3, dl: 0.16 },
      { t: 500, f: 440, d: 0.05, g: 0.1, dl: 0.02 },
      { t: 500, f: 554, d: 0.05, g: 0.1, dl: 0.1 },
      { t: 'triangle', f: 110, d: 0.12, g: 0.15 },
    ]);
    scheduleNoise(ctx.currentTime, 'hat', 0.08, masterGain);
  },

  'catch-throw': () => {
    // Whoosh: frequency sweep up with noise
    playSpecs([
      { t: 'sine', f: 300, fEnd: 1200, d: 0.12, g: 0.18 },
      { t: 250, f: 800, d: 0.04, g: 0.12, dl: 0.08 },
    ]);
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 4000;
    filt.Q.value = 2;
    const g = ctx.createGain();
    applyDecay(g, now, 0.08, 0.1);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start(now);
    src.stop(now + 0.12);
  },

  'catch-shake': () => {
    playSpecs([
      { t: 125, f: 220, d: 0.04, g: 0.2 },
      { t: 125, f: 294, d: 0.04, g: 0.2, dl: 0.04 },
      { t: 'triangle', f: 110, d: 0.06, g: 0.12 },
    ]);
    scheduleNoise(ctx.currentTime, 'snare', 0.06, masterGain);
  },

  'catch-heartbeat': () => {
    // Low thumps with increasing urgency
    playSpecs([
      { t: 'sine', f: 60, d: 0.12, g: 0.3, adsr: { a: 0.005, d: 0.04, s: 0.3, r: 0.06 } },
      { t: 'sine', f: 70, d: 0.1, g: 0.2, dl: 0.15 },
      { t: 'sine', f: 80, d: 0.12, g: 0.28, dl: 0.5 },
      { t: 'sine', f: 90, d: 0.1, g: 0.18, dl: 0.65 },
      { t: 'sine', f: 100, d: 0.12, g: 0.25, dl: 1.0 },
      { t: 'sine', f: 110, d: 0.1, g: 0.15, dl: 1.15 },
    ]);
    scheduleNoise(ctx.currentTime, 'kick', 0.06, masterGain);
    scheduleNoise(ctx.currentTime + 0.5, 'kick', 0.07, masterGain);
    scheduleNoise(ctx.currentTime + 1.0, 'kick', 0.08, masterGain);
  },

  'catch-success': () => {
    // The "gotcha" moment. Layered fanfare with all 4 channels.
    playSpecs([
      // Pulse 1: melody arpeggio up
      { t: 250, f: 523, d: 0.08, g: 0.28, dl: 0.0 },
      { t: 250, f: 659, d: 0.08, g: 0.28, dl: 0.08 },
      { t: 250, f: 784, d: 0.08, g: 0.3, dl: 0.16 },
      { t: 250, f: 1047, d: 0.25, g: 0.35, dl: 0.24 },
      // Pulse 2: harmony
      { t: 500, f: 392, d: 0.08, g: 0.12 },
      { t: 500, f: 523, d: 0.08, g: 0.12, dl: 0.08 },
      { t: 500, f: 659, d: 0.08, g: 0.14, dl: 0.16 },
      { t: 500, f: 784, d: 0.25, g: 0.16, dl: 0.24 },
      // Wave: bass chord
      { t: 'triangle', f: 262, d: 0.3, g: 0.15, dl: 0.0 },
      { t: 'triangle', f: 131, d: 0.3, g: 0.15, dl: 0.24 },
    ]);
    scheduleNoise(ctx.currentTime, 'kick', 0.1, masterGain);
    scheduleNoise(ctx.currentTime + 0.24, 'crash', 0.15, masterGain);
  },

  // --- Special Sounds ---
  // Badge fanfare: the EPIC item-get jingle. All 4 channels, proper
  // GBA-style ascending resolution with harmony.
  'badge-fanfare': () => {
    const t = ctx.currentTime;
    playSpecs([
      // Pulse 1: iconic ascending melody (duty 250)
      { t: 250, f: 523, d: 0.08, g: 0.28 },
      { t: 250, f: 523, d: 0.08, g: 0.28, dl: 0.1 },
      { t: 250, f: 523, d: 0.08, g: 0.28, dl: 0.2 },
      { t: 250, f: 523, d: 0.12, g: 0.3, dl: 0.35 },
      { t: 250, f: 440, d: 0.12, g: 0.28, dl: 0.5 },
      { t: 250, f: 494, d: 0.12, g: 0.3, dl: 0.65 },
      { t: 250, f: 523, d: 0.12, g: 0.3, dl: 0.8 },
      { t: 250, f: 659, d: 0.12, g: 0.32, dl: 0.95 },
      { t: 250, f: 784, d: 0.35, g: 0.38, dl: 1.1 },

      // Pulse 2: harmony line (duty 500)
      { t: 500, f: 330, d: 0.08, g: 0.12 },
      { t: 500, f: 330, d: 0.08, g: 0.12, dl: 0.1 },
      { t: 500, f: 330, d: 0.08, g: 0.12, dl: 0.2 },
      { t: 500, f: 392, d: 0.12, g: 0.14, dl: 0.35 },
      { t: 500, f: 330, d: 0.12, g: 0.12, dl: 0.5 },
      { t: 500, f: 392, d: 0.12, g: 0.14, dl: 0.65 },
      { t: 500, f: 392, d: 0.12, g: 0.14, dl: 0.8 },
      { t: 500, f: 523, d: 0.12, g: 0.16, dl: 0.95 },
      { t: 500, f: 659, d: 0.35, g: 0.18, dl: 1.1 },

      // Wave: bass foundation
      { t: 'triangle', f: 131, d: 0.3, g: 0.15 },
      { t: 'triangle', f: 131, d: 0.12, g: 0.12, dl: 0.35 },
      { t: 'triangle', f: 110, d: 0.12, g: 0.12, dl: 0.5 },
      { t: 'triangle', f: 131, d: 0.12, g: 0.14, dl: 0.65 },
      { t: 'triangle', f: 131, d: 0.12, g: 0.14, dl: 0.8 },
      { t: 'triangle', f: 165, d: 0.12, g: 0.15, dl: 0.95 },
      { t: 'triangle', f: 196, d: 0.35, g: 0.18, dl: 1.1 },
    ]);
    // Noise: rhythmic hits
    scheduleNoise(t, 'snare', 0.08, masterGain);
    scheduleNoise(t + 0.1, 'hat', 0.06, masterGain);
    scheduleNoise(t + 0.2, 'hat', 0.06, masterGain);
    scheduleNoise(t + 0.35, 'kick', 0.08, masterGain);
    scheduleNoise(t + 0.65, 'snare', 0.08, masterGain);
    scheduleNoise(t + 0.95, 'kick', 0.1, masterGain);
    scheduleNoise(t + 1.1, 'crash', 0.18, masterGain);
  },

  'wild-fact': () => {
    playSpecs([
      { t: 250, f: 659, d: 0.08, g: 0.2 },
      { t: 250, f: 880, d: 0.1, g: 0.24, dl: 0.08 },
      { t: 500, f: 523, d: 0.06, g: 0.1 },
      { t: 'triangle', f: 330, d: 0.12, g: 0.08 },
    ]);
  },

  'nara-deer': () => {
    // Playful three-note call with a shimmer
    playSpecs([
      { t: 250, f: 880, d: 0.12, g: 0.22 },
      { t: 250, f: 784, d: 0.08, g: 0.2, dl: 0.12 },
      { t: 250, f: 880, d: 0.08, g: 0.2, dl: 0.22 },
      { t: 250, f: 1175, d: 0.18, g: 0.25, dl: 0.32 },
      // Echo
      { t: 500, f: 880, d: 0.08, g: 0.08, dl: 0.04 },
      { t: 500, f: 784, d: 0.06, g: 0.08, dl: 0.14 },
      { t: 500, f: 1175, d: 0.12, g: 0.1, dl: 0.34 },
      { t: 'triangle', f: 440, d: 0.2, g: 0.08 },
    ]);
  },

  'location-discovery': () => {
    playSpecs([
      { t: 250, f: 523, d: 0.08, g: 0.25 },
      { t: 250, f: 659, d: 0.08, g: 0.25, dl: 0.1 },
      { t: 250, f: 784, d: 0.08, g: 0.28, dl: 0.2 },
      { t: 250, f: 1047, d: 0.12, g: 0.3, dl: 0.3 },
      { t: 250, f: 1319, d: 0.2, g: 0.35, dl: 0.44 },
      // Harmony
      { t: 500, f: 392, d: 0.08, g: 0.1 },
      { t: 500, f: 523, d: 0.08, g: 0.1, dl: 0.1 },
      { t: 500, f: 659, d: 0.08, g: 0.12, dl: 0.2 },
      { t: 500, f: 784, d: 0.12, g: 0.14, dl: 0.3 },
      { t: 500, f: 1047, d: 0.2, g: 0.16, dl: 0.44 },
      // Bass
      { t: 'triangle', f: 262, d: 0.2, g: 0.12 },
      { t: 'triangle', f: 165, d: 0.25, g: 0.12, dl: 0.3 },
    ]);
    scheduleNoise(ctx.currentTime + 0.44, 'crash', 0.1, masterGain);
  },

  'ball-upgrade': () => {
    playSpecs([
      { t: 250, f: 523, d: 0.06, g: 0.25 },
      { t: 250, f: 659, d: 0.06, g: 0.25, dl: 0.06 },
      { t: 250, f: 784, d: 0.06, g: 0.28, dl: 0.12 },
      { t: 250, f: 1047, d: 0.06, g: 0.3, dl: 0.18 },
      { t: 250, f: 1319, d: 0.15, g: 0.35, dl: 0.24 },
      { t: 500, f: 659, d: 0.06, g: 0.12, dl: 0.12 },
      { t: 500, f: 784, d: 0.06, g: 0.12, dl: 0.18 },
      { t: 500, f: 1047, d: 0.12, g: 0.14, dl: 0.24 },
      { t: 'triangle', f: 262, d: 0.15, g: 0.1 },
      { t: 'triangle', f: 131, d: 0.15, g: 0.12, dl: 0.18 },
    ]);
    scheduleNoise(ctx.currentTime + 0.24, 'hat', 0.08, masterGain);
  },

  'bulbasaur-tap': () => {
    playSpecs([
      { t: 250, f: 1047, d: 0.03, g: 0.18 },
      { t: 125, f: 1320, d: 0.02, g: 0.08, dl: 0.01 },
    ]);
  },

  'bulbasaur-vinewhip': () => {
    playSpecs([
      { t: 125, f: 220, d: 0.04, g: 0.18 },
      { t: 125, f: 330, d: 0.04, g: 0.2, dl: 0.04 },
      { t: 250, f: 494, d: 0.04, g: 0.22, dl: 0.08 },
      { t: 250, f: 659, d: 0.06, g: 0.25, dl: 0.12 },
      { t: 250, f: 880, d: 0.08, g: 0.28, dl: 0.18 },
      { t: 'triangle', f: 110, d: 0.1, g: 0.1 },
    ]);
    // Whip noise
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 5000;
    filt.Q.value = 3;
    const g = ctx.createGain();
    applyDecay(g, now + 0.12, 0.06, 0.06);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start(now + 0.12);
    src.stop(now + 0.2);
  },

  'onboarding-melody': () => {
    // Bright, adventurous opening phrase. Like starting a new journey.
    // C major, with a sense of wonder and possibility.
    playSpecs([
      // Pulse 1: main melody
      { t: 250, f: 523, d: 0.18, g: 0.22 },
      { t: 250, f: 659, d: 0.18, g: 0.22, dl: 0.22 },
      { t: 250, f: 784, d: 0.18, g: 0.24, dl: 0.44 },
      { t: 250, f: 659, d: 0.18, g: 0.22, dl: 0.66 },
      { t: 250, f: 784, d: 0.18, g: 0.24, dl: 0.88 },
      { t: 250, f: 1047, d: 0.28, g: 0.28, dl: 1.1 },
      { t: 250, f: 784, d: 0.18, g: 0.24, dl: 1.42 },
      { t: 250, f: 659, d: 0.18, g: 0.22, dl: 1.64 },
      { t: 250, f: 523, d: 0.18, g: 0.22, dl: 1.86 },
      { t: 250, f: 659, d: 0.18, g: 0.22, dl: 2.08 },
      { t: 250, f: 784, d: 0.35, g: 0.26, dl: 2.3 },
      // Pulse 2: gentle harmony (thirds above/below)
      { t: 500, f: 392, d: 0.18, g: 0.08 },
      { t: 500, f: 523, d: 0.18, g: 0.08, dl: 0.22 },
      { t: 500, f: 659, d: 0.18, g: 0.1, dl: 0.44 },
      { t: 500, f: 523, d: 0.18, g: 0.08, dl: 0.66 },
      { t: 500, f: 659, d: 0.18, g: 0.1, dl: 0.88 },
      { t: 500, f: 784, d: 0.28, g: 0.12, dl: 1.1 },
      { t: 500, f: 659, d: 0.18, g: 0.1, dl: 1.42 },
      { t: 500, f: 523, d: 0.18, g: 0.08, dl: 1.64 },
      { t: 500, f: 392, d: 0.18, g: 0.08, dl: 1.86 },
      { t: 500, f: 523, d: 0.18, g: 0.08, dl: 2.08 },
      { t: 500, f: 659, d: 0.35, g: 0.12, dl: 2.3 },
      // Wave: bass notes
      { t: 'triangle', f: 131, d: 0.4, g: 0.1 },
      { t: 'triangle', f: 165, d: 0.4, g: 0.1, dl: 0.44 },
      { t: 'triangle', f: 131, d: 0.4, g: 0.1, dl: 0.88 },
      { t: 'triangle', f: 196, d: 0.4, g: 0.12, dl: 1.42 },
      { t: 'triangle', f: 131, d: 0.6, g: 0.12, dl: 1.86 },
    ]);
    // Noise: light rhythm
    const t = ctx.currentTime;
    scheduleNoise(t, 'hat', 0.06, masterGain);
    scheduleNoise(t + 0.44, 'hat', 0.06, masterGain);
    scheduleNoise(t + 0.88, 'hat', 0.06, masterGain);
    scheduleNoise(t + 1.1, 'kick', 0.06, masterGain);
    scheduleNoise(t + 1.42, 'hat', 0.06, masterGain);
    scheduleNoise(t + 2.3, 'crash', 0.08, masterGain);
  },
};

// =====================================================================
// SFX PLAY ENGINE
// =====================================================================
export function sfx(name) {
  if (!hadUserGesture) return;
  if (!ensureCtx()) return;
  const state = getState();
  if (state?.audioMuted) return;

  const fn = SFX_FUNCS[name];
  if (fn) { fn(); return; }
}

// =====================================================================
// MUTE / VOLUME API
// =====================================================================
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

// =====================================================================
// BUS AUTO-LISTENERS
// =====================================================================
bus.on('show-toast', () => sfx('ui-toast'));
bus.on('badge-earned', () => sfx('badge-fanfare'));
bus.on('spot-caught', () => sfx('catch-success'));
bus.on('nara-deer', () => sfx('nara-deer'));
bus.on('navigate', () => sfx('ui-nav'));
bus.on('location-easter-egg', () => sfx('location-discovery'));

// =====================================================================
// LOOP SYSTEM -- Full 4-channel GBA-style compositions
// =====================================================================
//
// Loop format:
//   bpm: tempo
//   beatsPerBar: time signature numerator
//   bars: total bars in the loop
//
//   pulse1: [{ f, d, duty }]  -- melody (d in beats)
//   pulse1Gain: base gain
//
//   pulse2: [{ f, d, duty }]  -- harmony/echo/counter-melody
//   pulse2Gain: base gain
//
//   wave: [{ f, d }]          -- bass (triangle)
//   waveGain: base gain
//
//   drums: [{ hit, beat }]    -- noise channel hits at specific beat positions
//   drumGain: base gain
//
// All note frequencies in Hz. Duration d is in beats.
// A rest is encoded as f: 0 (we skip scheduling for f=0).

// -- NOTE FREQUENCY REFERENCE --
// Using standard tuning. Named for readability in composition comments.
// (Not all are used, but having the table helps when composing.)
//
// C3=131  D3=147  E3=165  F3=175  G3=196  A3=220  B3=247
// C4=262  D4=294  E4=330  F4=349  G4=392  A4=440  B4=494
// C5=523  D5=587  E5=659  F5=698  G5=784  A5=880  B5=988
// C6=1047 D6=1175 E6=1319 F6=1397 G6=1568 A6=1760
//
// Sharps/flats:
// C#3=139 Eb3=156 F#3=185 Ab3=208 Bb3=233
// C#4=277 Eb4=311 F#4=370 Ab4=415 Bb4=466
// C#5=554 Eb5=622 F#5=740 Ab5=831 Bb5=932
// C#6=1109 Eb6=1245

const LOOPS = {

  // ==================================================================
  // BATTLE THEME -- "Rival's Challenge"
  // ==================================================================
  // Key: A minor (natural + harmonic)
  // Tempo: 152 BPM -- aggressive, driving
  // Feel: Think Gym Leader or Rival battle. Chromatic tension,
  //   driving bass octaves, relentless hi-hat eighth notes,
  //   kick on 1 and 3, snare on 2 and 4. The pulse channels
  //   trade melodic responsibility -- Pulse1 carries the hook,
  //   Pulse2 provides rhythmic counter-melody and echo.
  //
  // Structure: 8 bars, AABA form (bars 1-2 theme, 3-4 repeat,
  //   5-6 bridge/tension, 7-8 return to theme with variation).
  // ==================================================================
  battle: {
    bpm: 152,
    beatsPerBar: 4,
    bars: 8,
    pulse1Gain: 0.12,
    pulse2Gain: 0.06,
    waveGain: 0.1,
    drumGain: 0.12,

    pulse1: [
      // Bar 1: Opening hook -- A minor arpeggio burst (duty 250 for bite)
      { f: 440, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      { f: 659, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      { f: 440, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      { f: 659, d: 0.75, duty: 250 }, { f: 784, d: 0.25, duty: 125 },
      // Bar 2: Descending response with chromatic neighbor
      { f: 784, d: 0.5, duty: 250 }, { f: 659, d: 0.5, duty: 250 },
      { f: 622, d: 0.25, duty: 125 }, { f: 659, d: 0.25, duty: 250 },
      { f: 523, d: 0.5, duty: 250 }, { f: 440, d: 0.5, duty: 250 },
      { f: 392, d: 0.5, duty: 250 }, { f: 440, d: 0.5, duty: 250 },
      // Bar 3: Hook restated, higher energy (duty 125 for edge)
      { f: 440, d: 0.5, duty: 125 }, { f: 523, d: 0.5, duty: 125 },
      { f: 659, d: 0.5, duty: 125 }, { f: 784, d: 0.5, duty: 125 },
      { f: 880, d: 0.5, duty: 250 }, { f: 784, d: 0.25, duty: 250 },
      { f: 659, d: 0.25, duty: 250 }, { f: 784, d: 1.0, duty: 250 },
      // Bar 4: Climactic phrase pushing to high A
      { f: 659, d: 0.5, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 880, d: 0.5, duty: 250 }, { f: 1047, d: 0.5, duty: 250 },
      { f: 880, d: 0.5, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 659, d: 1.0, duty: 250 },
      // Bar 5: Bridge -- chromatic tension (duty 125 for thin, tense sound)
      { f: 392, d: 0.25, duty: 125 }, { f: 415, d: 0.25, duty: 125 },
      { f: 440, d: 0.25, duty: 125 }, { f: 466, d: 0.25, duty: 125 },
      { f: 494, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      { f: 659, d: 0.5, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 880, d: 1.0, duty: 250 },
      // Bar 6: Bridge peak -- rapid arpeggios
      { f: 880, d: 0.25, duty: 250 }, { f: 784, d: 0.25, duty: 250 },
      { f: 659, d: 0.25, duty: 250 }, { f: 523, d: 0.25, duty: 250 },
      { f: 440, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      { f: 659, d: 0.5, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 659, d: 0.5, duty: 125 }, { f: 523, d: 0.5, duty: 125 },
      // Bar 7: Return -- hook with octave jump variation
      { f: 880, d: 0.5, duty: 250 }, { f: 1047, d: 0.5, duty: 250 },
      { f: 880, d: 0.5, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 880, d: 0.5, duty: 250 }, { f: 784, d: 0.25, duty: 250 },
      { f: 659, d: 0.25, duty: 250 }, { f: 784, d: 1.0, duty: 250 },
      // Bar 8: Resolution for clean loop-back
      { f: 659, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      { f: 440, d: 1.0, duty: 250 },
      { f: 523, d: 0.25, duty: 125 }, { f: 440, d: 0.25, duty: 125 },
      { f: 392, d: 0.5, duty: 250 }, { f: 440, d: 1.0, duty: 250 },
    ],

    pulse2: [
      // Bar 1: Rhythmic stabs on off-beats (counter-rhythm)
      { f: 0, d: 0.25 }, { f: 330, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 392, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 330, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 392, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 330, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 392, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 330, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 523, d: 0.25, duty: 500 },
      // Bar 2: Continue counter-rhythm
      { f: 0, d: 0.25 }, { f: 440, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 392, d: 0.25, duty: 500 },
      { f: 0, d: 0.5 },
      { f: 330, d: 0.25, duty: 500 }, { f: 0, d: 0.25 },
      { f: 0, d: 0.25 }, { f: 330, d: 0.25, duty: 500 },
      { f: 0, d: 0.25 }, { f: 330, d: 0.25, duty: 500 },
      // Bar 3: Echo of the melody, trailing by an eighth note
      { f: 0, d: 0.5 },
      { f: 440, d: 0.5, duty: 500 }, { f: 523, d: 0.5, duty: 500 },
      { f: 659, d: 0.5, duty: 500 }, { f: 784, d: 0.5, duty: 500 },
      { f: 659, d: 0.5, duty: 500 },
      { f: 0, d: 0.5 },
      // Bar 4: Sustain harmony
      { f: 523, d: 1.0, duty: 500 }, { f: 659, d: 1.0, duty: 500 },
      { f: 523, d: 1.0, duty: 500 }, { f: 440, d: 1.0, duty: 500 },
      // Bar 5: Chromatic echo (thin duty)
      { f: 0, d: 0.25 },
      { f: 392, d: 0.25, duty: 125 }, { f: 415, d: 0.25, duty: 125 },
      { f: 440, d: 0.25, duty: 125 }, { f: 466, d: 0.25, duty: 125 },
      { f: 494, d: 0.5, duty: 500 }, { f: 0, d: 0.5 },
      { f: 523, d: 0.5, duty: 500 }, { f: 659, d: 0.5, duty: 500 },
      { f: 0, d: 0.5 },
      // Bar 6: Arpeggiated chords
      { f: 440, d: 0.25, duty: 500 }, { f: 523, d: 0.25, duty: 500 },
      { f: 659, d: 0.25, duty: 500 }, { f: 523, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 440, d: 0.25, duty: 500 },
      { f: 523, d: 0.25, duty: 500 }, { f: 440, d: 0.25, duty: 500 },
      { f: 392, d: 0.5, duty: 500 }, { f: 330, d: 0.5, duty: 500 },
      { f: 0, d: 1.0 },
      // Bar 7: Harmony -- parallel thirds below melody
      { f: 659, d: 0.5, duty: 500 }, { f: 784, d: 0.5, duty: 500 },
      { f: 659, d: 0.5, duty: 500 }, { f: 523, d: 0.5, duty: 500 },
      { f: 659, d: 0.5, duty: 500 }, { f: 523, d: 0.25, duty: 500 },
      { f: 440, d: 0.25, duty: 500 }, { f: 523, d: 1.0, duty: 500 },
      // Bar 8: Resolve with melody
      { f: 440, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      { f: 330, d: 1.0, duty: 500 },
      { f: 392, d: 0.5, duty: 500 }, { f: 330, d: 0.5, duty: 500 },
      { f: 0, d: 0.5 }, { f: 330, d: 0.5, duty: 500 },
    ],

    wave: [
      // Bar 1: Driving root-fifth eighths (A minor)
      { f: 110, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 110, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 },
      { f: 165, d: 0.5 }, { f: 131, d: 0.5 },
      // Bar 2: Descending bass
      { f: 147, d: 0.5 }, { f: 131, d: 0.5 },
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 },
      { f: 98, d: 0.5 }, { f: 110, d: 1.0 },
      { f: 131, d: 0.5 },
      // Bar 3: Aggressive octave leaps
      { f: 110, d: 0.5 }, { f: 220, d: 0.5 },
      { f: 110, d: 0.5 }, { f: 220, d: 0.5 },
      { f: 131, d: 0.5 }, { f: 262, d: 0.5 },
      { f: 131, d: 0.5 }, { f: 196, d: 0.5 },
      // Bar 4: Climbing with the melody
      { f: 131, d: 0.5 }, { f: 147, d: 0.5 },
      { f: 165, d: 0.5 }, { f: 196, d: 0.5 },
      { f: 165, d: 0.5 }, { f: 147, d: 0.5 },
      { f: 131, d: 1.0 },
      // Bar 5: Chromatic tension in bass
      { f: 98, d: 0.5 }, { f: 104, d: 0.5 },
      { f: 110, d: 0.5 }, { f: 117, d: 0.5 },
      { f: 123, d: 0.5 }, { f: 131, d: 0.5 },
      { f: 165, d: 1.0 },
      // Bar 6: Walking bass
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 },
      { f: 147, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 175, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 147, d: 0.5 }, { f: 131, d: 0.5 },
      // Bar 7: Octave pumps for intensity
      { f: 110, d: 0.5 }, { f: 220, d: 0.5 },
      { f: 110, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 131, d: 0.5 }, { f: 196, d: 0.5 },
      { f: 131, d: 1.0 },
      // Bar 8: Resolve to A root
      { f: 110, d: 0.5 }, { f: 131, d: 0.5 },
      { f: 110, d: 1.0 },
      { f: 131, d: 0.5 }, { f: 110, d: 0.5 },
      { f: 98, d: 0.5 }, { f: 110, d: 0.5 },
    ],

    // Drums: kick on 1+3, snare on 2+4, hi-hat on every eighth note
    // Format: [hit_type, beat_position] for each bar, repeated 8 times
    drums: (() => {
      const d = [];
      for (let bar = 0; bar < 8; bar++) {
        const off = bar * 4;
        // Hi-hats on every eighth note (8 per bar)
        for (let i = 0; i < 8; i++) d.push({ hit: 'hat', beat: off + i * 0.5 });
        // Kick on beats 1 and 3
        d.push({ hit: 'kick', beat: off + 0 });
        d.push({ hit: 'kick', beat: off + 2 });
        // Snare on beats 2 and 4
        d.push({ hit: 'snare', beat: off + 1 });
        d.push({ hit: 'snare', beat: off + 3 });
      }
      return d;
    })(),
  },

  // ==================================================================
  // POKEDEX / CENTER THEME -- "Safe Harbor"
  // ==================================================================
  // Key: C major
  // Tempo: 92 BPM -- gentle, healing
  // Feel: The Pokmon Center. Warm, safe, inviting. You know that
  //   feeling when Nurse Joy takes your Pokemon? That relief.
  //   Gentle stepwise melody on Pulse1 (duty 500 for warmth),
  //   soft arpeggiated accompaniment on Pulse2,
  //   whole/half note bass on Wave, brushed hat pattern on Noise.
  //
  // Structure: 8 bars, through-composed with gentle arc.
  // ==================================================================
  pokedex: {
    bpm: 92,
    beatsPerBar: 4,
    bars: 8,
    pulse1Gain: 0.07,
    pulse2Gain: 0.035,
    waveGain: 0.05,
    drumGain: 0.06,

    pulse1: [
      // Bar 1: Gentle opening -- stepwise C major
      { f: 523, d: 1.0, duty: 500 }, { f: 587, d: 0.5, duty: 500 },
      { f: 659, d: 0.5, duty: 500 },
      { f: 784, d: 1.0, duty: 500 }, { f: 659, d: 0.5, duty: 500 },
      { f: 587, d: 0.5, duty: 500 },
      // Bar 2: Continuing gently
      { f: 523, d: 0.5, duty: 500 }, { f: 587, d: 0.5, duty: 500 },
      { f: 659, d: 1.0, duty: 500 },
      { f: 784, d: 0.5, duty: 500 }, { f: 659, d: 0.5, duty: 500 },
      { f: 523, d: 1.0, duty: 500 },
      // Bar 3: Sweet ascending phrase
      { f: 659, d: 0.5, duty: 500 }, { f: 698, d: 0.5, duty: 500 },
      { f: 784, d: 1.0, duty: 500 },
      { f: 880, d: 0.5, duty: 500 }, { f: 784, d: 0.5, duty: 500 },
      { f: 698, d: 1.0, duty: 500 },
      // Bar 4: Descending resolution
      { f: 659, d: 1.0, duty: 500 }, { f: 587, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 },
      { f: 587, d: 1.0, duty: 500 }, { f: 523, d: 1.0, duty: 500 },
      // Bar 5: Higher register variation
      { f: 784, d: 1.0, duty: 500 }, { f: 880, d: 0.5, duty: 500 },
      { f: 784, d: 0.5, duty: 500 },
      { f: 659, d: 0.5, duty: 500 }, { f: 698, d: 0.5, duty: 500 },
      { f: 659, d: 1.0, duty: 500 },
      // Bar 6: Stepping back down
      { f: 587, d: 0.5, duty: 500 }, { f: 523, d: 0.5, duty: 500 },
      { f: 587, d: 1.0, duty: 500 },
      { f: 659, d: 1.0, duty: 500 }, { f: 523, d: 1.0, duty: 500 },
      // Bar 7: Resolution phrase
      { f: 784, d: 0.5, duty: 500 }, { f: 698, d: 0.5, duty: 500 },
      { f: 659, d: 0.5, duty: 500 }, { f: 587, d: 0.5, duty: 500 },
      { f: 523, d: 1.0, duty: 500 }, { f: 587, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 },
      // Bar 8: Final held note for loop
      { f: 659, d: 0.5, duty: 500 }, { f: 587, d: 0.5, duty: 500 },
      { f: 523, d: 1.0, duty: 500 },
      { f: 523, d: 2.0, duty: 500 },
    ],

    pulse2: [
      // Soft arpeggiated accompaniment -- simulating a gentle pad
      // Bar 1: C major arp
      { f: 262, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 262, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      // Bar 2: Am -> G
      { f: 262, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 247, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      // Bar 3: F -> G
      { f: 262, d: 0.5, duty: 750 }, { f: 349, d: 0.5, duty: 750 },
      { f: 440, d: 0.5, duty: 750 }, { f: 349, d: 0.5, duty: 750 },
      { f: 247, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      // Bar 4: Em -> C
      { f: 247, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 262, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      // Bar 5: G -> F
      { f: 247, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 262, d: 0.5, duty: 750 }, { f: 349, d: 0.5, duty: 750 },
      { f: 440, d: 0.5, duty: 750 }, { f: 349, d: 0.5, duty: 750 },
      // Bar 6: Dm -> Em
      { f: 220, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 349, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 247, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      // Bar 7: G -> C
      { f: 247, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 294, d: 0.5, duty: 750 },
      { f: 262, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      // Bar 8: Em -> C (resolve)
      { f: 247, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 262, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
      { f: 392, d: 0.5, duty: 750 }, { f: 330, d: 0.5, duty: 750 },
    ],

    wave: [
      // Whole note bass -- simple harmonic foundation
      // Bar 1
      { f: 131, d: 2.0 }, { f: 165, d: 2.0 },
      // Bar 2
      { f: 131, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 3
      { f: 175, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 4
      { f: 165, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 5
      { f: 196, d: 2.0 }, { f: 175, d: 2.0 },
      // Bar 6
      { f: 147, d: 2.0 }, { f: 165, d: 2.0 },
      // Bar 7
      { f: 196, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 8
      { f: 165, d: 2.0 }, { f: 131, d: 2.0 },
    ],

    // Light brushed percussion: soft hat on quarters, kick on 1, light snare on 3
    drums: (() => {
      const d = [];
      for (let bar = 0; bar < 8; bar++) {
        const off = bar * 4;
        // Soft hats on quarter notes
        for (let i = 0; i < 4; i++) d.push({ hit: 'hat', beat: off + i });
        // Gentle kick on beat 1
        d.push({ hit: 'kick', beat: off + 0 });
        // Light snare on beat 3
        d.push({ hit: 'snare', beat: off + 2 });
      }
      return d;
    })(),
  },

  // ==================================================================
  // JOURNAL / TOWN THEME -- "Morning in Littleroot"
  // ==================================================================
  // Key: G major
  // Tempo: 84 BPM -- walking pace, contemplative
  // Feel: Nostalgic hometown theme. The kind of melody that makes
  //   you feel warm and safe. Gentle, pastoral, with space to breathe.
  //   Pulse1 carries a lyrical melody (duty 500 for warmth),
  //   Pulse2 has gentle sustained harmony notes,
  //   Wave provides warm bass movement,
  //   Noise is very sparse -- just gentle taps.
  //
  // Structure: 8 bars, ABA'B' form.
  // ==================================================================
  journal: {
    bpm: 84,
    beatsPerBar: 4,
    bars: 8,
    pulse1Gain: 0.06,
    pulse2Gain: 0.03,
    waveGain: 0.045,
    drumGain: 0.04,

    pulse1: [
      // Bar 1: Warm G major opening -- lyrical, spacious
      { f: 392, d: 1.5, duty: 500 }, { f: 494, d: 0.5, duty: 500 },
      { f: 587, d: 1.0, duty: 500 }, { f: 494, d: 1.0, duty: 500 },
      // Bar 2: Gentle continuation
      { f: 440, d: 1.0, duty: 500 }, { f: 494, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 587, d: 2.0, duty: 500 },
      // Bar 3: Ascending contemplation
      { f: 523, d: 1.0, duty: 500 }, { f: 587, d: 1.0, duty: 500 },
      { f: 659, d: 1.5, duty: 500 }, { f: 587, d: 0.5, duty: 500 },
      // Bar 4: Descending with held note
      { f: 494, d: 1.0, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 494, d: 0.5, duty: 500 }, { f: 392, d: 2.0, duty: 500 },
      // Bar 5: Gentle peak
      { f: 587, d: 1.0, duty: 500 }, { f: 659, d: 0.5, duty: 500 },
      { f: 587, d: 0.5, duty: 500 }, { f: 494, d: 2.0, duty: 500 },
      // Bar 6: Settling back
      { f: 523, d: 1.0, duty: 500 }, { f: 494, d: 0.5, duty: 500 },
      { f: 440, d: 0.5, duty: 500 }, { f: 392, d: 2.0, duty: 500 },
      // Bar 7: Nostalgic resolution
      { f: 494, d: 1.0, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 392, d: 0.5, duty: 500 }, { f: 330, d: 2.0, duty: 500 },
      // Bar 8: Final rest on G
      { f: 392, d: 1.0, duty: 500 }, { f: 330, d: 0.5, duty: 500 },
      { f: 392, d: 0.5, duty: 500 }, { f: 392, d: 2.0, duty: 500 },
    ],

    pulse2: [
      // Sustained harmony -- long notes that blend with the melody
      // Bar 1: G major chord tones
      { f: 294, d: 2.0, duty: 750 }, { f: 392, d: 2.0, duty: 750 },
      // Bar 2: C -> D
      { f: 330, d: 2.0, duty: 750 }, { f: 370, d: 2.0, duty: 750 },
      // Bar 3: Em -> D
      { f: 392, d: 2.0, duty: 750 }, { f: 440, d: 2.0, duty: 750 },
      // Bar 4: C -> G
      { f: 330, d: 2.0, duty: 750 }, { f: 294, d: 2.0, duty: 750 },
      // Bar 5: D -> Em
      { f: 370, d: 2.0, duty: 750 }, { f: 330, d: 2.0, duty: 750 },
      // Bar 6: C -> D
      { f: 330, d: 2.0, duty: 750 }, { f: 294, d: 2.0, duty: 750 },
      // Bar 7: Em -> C
      { f: 330, d: 2.0, duty: 750 }, { f: 262, d: 2.0, duty: 750 },
      // Bar 8: D -> G
      { f: 294, d: 2.0, duty: 750 }, { f: 247, d: 2.0, duty: 750 },
    ],

    wave: [
      // Bar 1
      { f: 196, d: 2.0 }, { f: 147, d: 2.0 },
      // Bar 2
      { f: 175, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 3
      { f: 131, d: 2.0 }, { f: 165, d: 2.0 },
      // Bar 4
      { f: 147, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 5
      { f: 147, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 6
      { f: 131, d: 2.0 }, { f: 196, d: 2.0 },
      // Bar 7
      { f: 165, d: 2.0 }, { f: 131, d: 2.0 },
      // Bar 8
      { f: 98, d: 2.0 }, { f: 196, d: 2.0 },
    ],

    // Very sparse percussion: just gentle hat taps on beats 1 and 3
    drums: (() => {
      const d = [];
      for (let bar = 0; bar < 8; bar++) {
        const off = bar * 4;
        d.push({ hit: 'hat', beat: off + 0 });
        d.push({ hit: 'hat', beat: off + 2 });
        // Very subtle kick on beat 1 only
        d.push({ hit: 'kick', beat: off + 0 });
      }
      return d;
    })(),
  },

  // ==================================================================
  // CATCH THEME -- "Wild Encounter"
  // ==================================================================
  // Key: E minor
  // Tempo: 132 BPM -- tense, anticipatory
  // Feel: The ball is shaking. Will it catch? Tense ostinato pattern
  //   with chromatic elements that build anticipation. Used during
  //   the 5-beat catch flow sequence.
  //   Pulse1 plays an anxious repeating melodic figure,
  //   Pulse2 has tremolo-like rapid notes for tension,
  //   Wave provides a pulsing bass pedal,
  //   Noise drives urgency with eighth note hats and accented beats.
  //
  // Structure: 4 bars (shorter loop for the catch sequence).
  // ==================================================================
  catch: {
    bpm: 132,
    beatsPerBar: 4,
    bars: 4,
    pulse1Gain: 0.09,
    pulse2Gain: 0.05,
    waveGain: 0.07,
    drumGain: 0.1,

    pulse1: [
      // Bar 1: Tense E minor ostinato with chromatic neighbor
      { f: 659, d: 0.5, duty: 250 }, { f: 622, d: 0.25, duty: 125 },
      { f: 659, d: 0.25, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 659, d: 0.5, duty: 250 },
      { f: 587, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      { f: 494, d: 0.5, duty: 250 }, { f: 523, d: 0.5, duty: 250 },
      // Bar 2: Ascending tension
      { f: 587, d: 0.5, duty: 250 }, { f: 659, d: 0.5, duty: 250 },
      { f: 784, d: 0.5, duty: 250 }, { f: 880, d: 0.5, duty: 250 },
      { f: 784, d: 0.5, duty: 250 }, { f: 659, d: 0.5, duty: 250 },
      { f: 587, d: 0.5, duty: 250 }, { f: 494, d: 0.5, duty: 250 },
      // Bar 3: Chromatic creep upward (peak tension)
      { f: 494, d: 0.5, duty: 125 }, { f: 523, d: 0.5, duty: 125 },
      { f: 554, d: 0.5, duty: 125 }, { f: 587, d: 0.5, duty: 125 },
      { f: 622, d: 0.5, duty: 125 }, { f: 659, d: 0.5, duty: 125 },
      { f: 698, d: 0.5, duty: 125 }, { f: 784, d: 0.5, duty: 250 },
      // Bar 4: Release and loop reset
      { f: 880, d: 0.5, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 659, d: 0.5, duty: 250 }, { f: 587, d: 0.5, duty: 250 },
      { f: 494, d: 0.5, duty: 250 }, { f: 440, d: 0.5, duty: 250 },
      { f: 494, d: 1.0, duty: 250 },
    ],

    pulse2: [
      // Tremolo-style rapid alternation for tension
      // Bar 1
      { f: 330, d: 0.25, duty: 500 }, { f: 494, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 494, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 494, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 494, d: 0.25, duty: 500 },
      { f: 294, d: 0.25, duty: 500 }, { f: 440, d: 0.25, duty: 500 },
      { f: 294, d: 0.25, duty: 500 }, { f: 440, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 392, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 392, d: 0.25, duty: 500 },
      // Bar 2
      { f: 294, d: 0.25, duty: 500 }, { f: 440, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 494, d: 0.25, duty: 500 },
      { f: 392, d: 0.25, duty: 500 }, { f: 523, d: 0.25, duty: 500 },
      { f: 440, d: 0.25, duty: 500 }, { f: 587, d: 0.25, duty: 500 },
      { f: 392, d: 0.25, duty: 500 }, { f: 523, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 494, d: 0.25, duty: 500 },
      { f: 294, d: 0.25, duty: 500 }, { f: 440, d: 0.25, duty: 500 },
      { f: 247, d: 0.25, duty: 500 }, { f: 392, d: 0.25, duty: 500 },
      // Bar 3: Chromatic tremolo
      { f: 330, d: 0.25, duty: 125 }, { f: 392, d: 0.25, duty: 125 },
      { f: 349, d: 0.25, duty: 125 }, { f: 415, d: 0.25, duty: 125 },
      { f: 370, d: 0.25, duty: 125 }, { f: 440, d: 0.25, duty: 125 },
      { f: 392, d: 0.25, duty: 125 }, { f: 466, d: 0.25, duty: 125 },
      { f: 415, d: 0.25, duty: 125 }, { f: 494, d: 0.25, duty: 125 },
      { f: 440, d: 0.25, duty: 125 }, { f: 523, d: 0.25, duty: 125 },
      { f: 466, d: 0.25, duty: 125 }, { f: 554, d: 0.25, duty: 125 },
      { f: 494, d: 0.25, duty: 500 }, { f: 587, d: 0.25, duty: 500 },
      // Bar 4
      { f: 440, d: 0.25, duty: 500 }, { f: 523, d: 0.25, duty: 500 },
      { f: 392, d: 0.25, duty: 500 }, { f: 494, d: 0.25, duty: 500 },
      { f: 330, d: 0.25, duty: 500 }, { f: 440, d: 0.25, duty: 500 },
      { f: 294, d: 0.25, duty: 500 }, { f: 392, d: 0.25, duty: 500 },
      { f: 247, d: 0.25, duty: 500 }, { f: 330, d: 0.25, duty: 500 },
      { f: 220, d: 0.25, duty: 500 }, { f: 294, d: 0.25, duty: 500 },
      { f: 247, d: 0.5, duty: 500 }, { f: 330, d: 0.5, duty: 500 },
    ],

    wave: [
      // Pulsing bass pedal on E, with movement
      // Bar 1
      { f: 165, d: 0.5 }, { f: 82, d: 0.5 },
      { f: 165, d: 0.5 }, { f: 82, d: 0.5 },
      { f: 147, d: 0.5 }, { f: 73, d: 0.5 },
      { f: 131, d: 0.5 }, { f: 165, d: 0.5 },
      // Bar 2
      { f: 147, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 196, d: 0.5 }, { f: 220, d: 0.5 },
      { f: 196, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 147, d: 0.5 }, { f: 123, d: 0.5 },
      // Bar 3: Chromatic bass climb
      { f: 123, d: 0.5 }, { f: 131, d: 0.5 },
      { f: 139, d: 0.5 }, { f: 147, d: 0.5 },
      { f: 156, d: 0.5 }, { f: 165, d: 0.5 },
      { f: 175, d: 0.5 }, { f: 196, d: 0.5 },
      // Bar 4: Descend back to E
      { f: 220, d: 0.5 }, { f: 196, d: 0.5 },
      { f: 165, d: 0.5 }, { f: 147, d: 0.5 },
      { f: 123, d: 0.5 }, { f: 110, d: 0.5 },
      { f: 123, d: 0.5 }, { f: 165, d: 0.5 },
    ],

    drums: (() => {
      const d = [];
      for (let bar = 0; bar < 4; bar++) {
        const off = bar * 4;
        // Driving eighth note hats
        for (let i = 0; i < 8; i++) d.push({ hit: 'hat', beat: off + i * 0.5 });
        // Kick on every beat for driving urgency
        for (let i = 0; i < 4; i++) d.push({ hit: 'kick', beat: off + i });
        // Snare on 2 and 4
        d.push({ hit: 'snare', beat: off + 1 });
        d.push({ hit: 'snare', beat: off + 3 });
      }
      return d;
    })(),
  },

  // ==================================================================
  // ONBOARDING THEME -- "A New Journey Begins"
  // ==================================================================
  // Key: F major
  // Tempo: 108 BPM -- bright, adventurous but not rushed
  // Feel: The moment Professor Birch hands you your first Pokemon.
  //   Full of hope, wonder, and excitement. Bright and welcoming.
  //   Pulse1 has a memorable, singable melody (duty 250 for clarity),
  //   Pulse2 provides bouncing accompaniment,
  //   Wave has confident bass movement,
  //   Noise has a peppy but not overwhelming pattern.
  //
  // Structure: 8 bars, verse-like through-composed.
  // ==================================================================
  onboarding: {
    bpm: 108,
    beatsPerBar: 4,
    bars: 8,
    pulse1Gain: 0.08,
    pulse2Gain: 0.04,
    waveGain: 0.06,
    drumGain: 0.07,

    pulse1: [
      // Bar 1: Bright opening -- F major fanfare feel
      { f: 698, d: 0.5, duty: 250 }, { f: 698, d: 0.25, duty: 250 },
      { f: 784, d: 0.25, duty: 250 }, { f: 880, d: 1.0, duty: 250 },
      { f: 784, d: 0.5, duty: 250 }, { f: 698, d: 0.5, duty: 250 },
      { f: 587, d: 1.0, duty: 250 },
      // Bar 2: Answering phrase
      { f: 523, d: 0.5, duty: 250 }, { f: 587, d: 0.5, duty: 250 },
      { f: 698, d: 0.5, duty: 250 }, { f: 587, d: 0.5, duty: 250 },
      { f: 523, d: 1.0, duty: 250 }, { f: 466, d: 0.5, duty: 250 },
      { f: 523, d: 0.5, duty: 250 },
      // Bar 3: Building upward
      { f: 587, d: 0.5, duty: 250 }, { f: 698, d: 0.5, duty: 250 },
      { f: 784, d: 0.5, duty: 250 }, { f: 880, d: 0.5, duty: 250 },
      { f: 1047, d: 1.0, duty: 250 }, { f: 880, d: 0.5, duty: 250 },
      { f: 784, d: 0.5, duty: 250 },
      // Bar 4: Graceful descent
      { f: 698, d: 1.0, duty: 250 }, { f: 587, d: 0.5, duty: 250 },
      { f: 523, d: 0.5, duty: 250 },
      { f: 587, d: 1.0, duty: 250 }, { f: 698, d: 1.0, duty: 250 },
      // Bar 5: Playful variation
      { f: 880, d: 0.5, duty: 250 }, { f: 784, d: 0.25, duty: 250 },
      { f: 698, d: 0.25, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 880, d: 0.5, duty: 250 },
      { f: 1047, d: 0.5, duty: 250 }, { f: 880, d: 0.5, duty: 250 },
      { f: 784, d: 0.5, duty: 250 }, { f: 698, d: 0.5, duty: 250 },
      // Bar 6: Echo phrase
      { f: 587, d: 0.5, duty: 250 }, { f: 698, d: 0.5, duty: 250 },
      { f: 784, d: 1.0, duty: 250 },
      { f: 698, d: 0.5, duty: 250 }, { f: 587, d: 0.5, duty: 250 },
      { f: 523, d: 1.0, duty: 250 },
      // Bar 7: Climactic phrase
      { f: 698, d: 0.5, duty: 250 }, { f: 784, d: 0.5, duty: 250 },
      { f: 880, d: 0.5, duty: 250 }, { f: 1047, d: 0.5, duty: 250 },
      { f: 1175, d: 1.0, duty: 250 }, { f: 1047, d: 0.5, duty: 250 },
      { f: 880, d: 0.5, duty: 250 },
      // Bar 8: Resolution for loop
      { f: 784, d: 0.5, duty: 250 }, { f: 698, d: 0.5, duty: 250 },
      { f: 587, d: 1.0, duty: 250 },
      { f: 698, d: 2.0, duty: 500 },
    ],

    pulse2: [
      // Bouncing chord-tone accompaniment
      // Bar 1: F major
      { f: 349, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 349, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      // Bar 2: C major -> Bb
      { f: 330, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      { f: 294, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      { f: 466, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      // Bar 3: Dm -> C
      { f: 294, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      { f: 440, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      { f: 330, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      // Bar 4: F -> C
      { f: 349, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 349, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      // Bar 5: F -> C
      { f: 349, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 330, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      // Bar 6: Dm -> C
      { f: 294, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      { f: 440, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      { f: 330, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      // Bar 7: Bb -> C
      { f: 294, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      { f: 466, d: 0.5, duty: 500 }, { f: 349, d: 0.5, duty: 500 },
      { f: 330, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 392, d: 0.5, duty: 500 },
      // Bar 8: F resolve
      { f: 349, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 523, d: 0.5, duty: 500 }, { f: 440, d: 0.5, duty: 500 },
      { f: 349, d: 1.0, duty: 750 }, { f: 440, d: 1.0, duty: 750 },
    ],

    wave: [
      // Confident bass with some eighth note movement
      // Bar 1
      { f: 175, d: 1.0 }, { f: 175, d: 0.5 }, { f: 220, d: 0.5 },
      { f: 175, d: 1.0 }, { f: 131, d: 1.0 },
      // Bar 2
      { f: 131, d: 1.0 }, { f: 165, d: 1.0 },
      { f: 117, d: 1.0 }, { f: 131, d: 1.0 },
      // Bar 3
      { f: 147, d: 1.0 }, { f: 175, d: 1.0 },
      { f: 131, d: 1.0 }, { f: 165, d: 1.0 },
      // Bar 4
      { f: 175, d: 1.0 }, { f: 131, d: 1.0 },
      { f: 147, d: 1.0 }, { f: 175, d: 1.0 },
      // Bar 5
      { f: 175, d: 1.0 }, { f: 220, d: 1.0 },
      { f: 131, d: 1.0 }, { f: 165, d: 1.0 },
      // Bar 6
      { f: 147, d: 1.0 }, { f: 175, d: 1.0 },
      { f: 131, d: 1.0 }, { f: 165, d: 1.0 },
      // Bar 7
      { f: 117, d: 1.0 }, { f: 131, d: 1.0 },
      { f: 131, d: 1.0 }, { f: 165, d: 1.0 },
      // Bar 8
      { f: 175, d: 1.0 }, { f: 131, d: 1.0 },
      { f: 175, d: 2.0 },
    ],

    drums: (() => {
      const d = [];
      for (let bar = 0; bar < 8; bar++) {
        const off = bar * 4;
        // Quarter note hats
        for (let i = 0; i < 4; i++) d.push({ hit: 'hat', beat: off + i });
        // Peppy kick-snare pattern
        d.push({ hit: 'kick', beat: off + 0 });
        d.push({ hit: 'kick', beat: off + 2 });
        d.push({ hit: 'snare', beat: off + 1 });
        d.push({ hit: 'snare', beat: off + 3 });
        // Extra hat on the "and" of 2 and 4 for bounce
        d.push({ hit: 'hat', beat: off + 1.5 });
        d.push({ hit: 'hat', beat: off + 3.5 });
      }
      return d;
    })(),
  },
};

// =====================================================================
// LOOP SCHEDULER
// =====================================================================
// Uses a look-ahead scheduling pattern for gapless looping.
// We schedule the entire loop at once, then set a timer to schedule
// the next iteration before the current one ends.

let loopTimer = null;
let loopNodes = [];
let loopName = null;

function scheduleLoop(loop, startTime) {
  const beatDur = 60 / loop.bpm;
  const totalBeats = loop.beatsPerBar * loop.bars;
  const loopDuration = totalBeats * beatDur;

  // --- PULSE 1 (Lead melody) ---
  if (loop.pulse1) {
    let offset = 0;
    for (const note of loop.pulse1) {
      const dur = note.d * beatDur;
      if (note.f > 0) {
        const osc = scheduleNote(
          startTime + offset, note.f, dur,
          loop.pulse1Gain, note.duty || 500, masterGain
        );
        loopNodes.push(osc);
      }
      offset += dur;
    }
  }

  // --- PULSE 2 (Harmony / echo / counter-melody) ---
  if (loop.pulse2) {
    let offset = 0;
    for (const note of loop.pulse2) {
      const dur = note.d * beatDur;
      if (note.f > 0) {
        const osc = scheduleNote(
          startTime + offset, note.f, dur,
          loop.pulse2Gain, note.duty || 500, masterGain
        );
        loopNodes.push(osc);
      }
      offset += dur;
    }
  }

  // --- WAVE (Bass -- triangle) ---
  if (loop.wave) {
    let offset = 0;
    for (const note of loop.wave) {
      const dur = note.d * beatDur;
      if (note.f > 0) {
        const osc = scheduleNote(
          startTime + offset, note.f, dur,
          loop.waveGain, null, masterGain // null duty = triangle
        );
        loopNodes.push(osc);
      }
      offset += dur;
    }
  }

  // --- NOISE (Drums) ---
  if (loop.drums) {
    for (const drum of loop.drums) {
      const t = startTime + drum.beat * beatDur;
      const nodes = scheduleNoise(t, drum.hit, loop.drumGain, masterGain);
      for (const n of nodes) loopNodes.push(n);
    }
  }

  return loopDuration;
}

function loopTick() {
  if (!loopName || !ctx) return;
  const loop = LOOPS[loopName];
  if (!loop) return;

  const chunkDur = scheduleLoop(loop, ctx.currentTime + 0.05);
  // Schedule next iteration slightly before this one ends
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

// =====================================================================
// VISIBILITY CHANGE HANDLING
// =====================================================================
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
