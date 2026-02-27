// lib/state.js — Proxy-based reactive store with dual persistence

import { getIDBState, putIDBState } from './storage.js';

const LS_KEY = 'japan-guide-state';

function defaultState() {
  return {
    // Onboarding
    onboardingComplete: false,
    trainerName: '',

    // Quiz / Battle (migrated from v1)
    badges: { fire: false, water: false, grass: false, electric: false },
    highScores: { fire: 0, water: 0, grass: 0, electric: 0 },
    bestCombos: { fire: 0, water: 0, grass: 0, electric: 0 },
    totalCatches: 0,
    totalQuizzes: 0,
    bestComboEver: 0,

    // Catch-a-Spot
    caughtSpots: [],
    catchStreak: { count: 0, lastDate: null },
    totalDistance: 0,

    // Companion
    lastOpenTimestamp: null,
    bulbasaurTapCount: 0,
    buddyMood: 'happy',

    // Achievements
    achievements: {
      foodMaster: false, shrineKeeper: false, nightOwl: false,
      earlyBird: false, explorer: false, kansaiChampion: false,
      naraDeer: false,
      // New achievements (Feature 2)
      firstCatch: false, collector10: false,
      perfectQuiz: false, quizMaster: false, comboKing: false,
      shutterBug: false,
      streak3: false, streak5: false, streak7: false,
      distanceWalker: false, distanceRunner: false,
      factHunter: false, diverseExplorer: false,
    },
    longestStreak: 0,

    // Audio
    audioMuted: false,
    audioVolume: 0.5,

    // Easter eggs
    naraEasterEgg: false,
    caughtFacts: [],
    lastBackupDate: null,
    installBannerDismissed: false,
    tripStartDate: null
  };
}

// --- Subscriptions ---
const listeners = [];

export function onStateChange(pathPrefix, callback) {
  listeners.push({ pathPrefix, callback });
  return () => {
    const idx = listeners.findIndex(l => l.callback === callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners(path) {
  for (const { pathPrefix, callback } of listeners) {
    if (path.startsWith(pathPrefix) || pathPrefix === '*') {
      try { callback(path); } catch (e) { console.error('State listener error:', e); }
    }
  }
}

// --- Persistence ---
let saveTimer = null;

function debouncedSave(raw) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(raw)); } catch { /* quota */ }
    putIDBState(JSON.parse(JSON.stringify(raw))).catch(() => {});
  }, 300);
}

// --- Deep Proxy ---
function createDeepProxy(obj, rootRef, pathPrefix = '') {
  if (obj === null || typeof obj !== 'object') return obj;

  // Wrap arrays and plain objects
  for (const key of Object.keys(obj)) {
    if (obj[key] !== null && typeof obj[key] === 'object') {
      obj[key] = createDeepProxy(obj[key], rootRef, pathPrefix ? `${pathPrefix}.${key}` : key);
    }
  }

  return new Proxy(obj, {
    set(target, prop, value) {
      const fullPath = pathPrefix ? `${pathPrefix}.${prop}` : String(prop);
      if (value !== null && typeof value === 'object') {
        value = createDeepProxy(value, rootRef, fullPath);
      }
      target[prop] = value;
      notifyListeners(fullPath);
      debouncedSave(rootRef.raw);
      return true;
    },
    deleteProperty(target, prop) {
      const fullPath = pathPrefix ? `${pathPrefix}.${prop}` : String(prop);
      delete target[prop];
      notifyListeners(fullPath);
      debouncedSave(rootRef.raw);
      return true;
    }
  });
}

// --- Store singleton ---
let store = null;

export async function loadPersistedState() {
  // Try IDB first (source of truth), then localStorage fallback
  let saved = await getIDBState();
  if (!saved) {
    try {
      const ls = localStorage.getItem(LS_KEY);
      if (ls) saved = JSON.parse(ls);
    } catch { /* corrupt */ }
  }
  return saved ? deepMerge(defaultState(), saved) : defaultState();
}

export function createStore(initial) {
  const raw = initial || defaultState();
  const ref = { raw };
  store = createDeepProxy(raw, ref);
  ref.raw = store;
  return store;
}

export function getState() {
  return store;
}

// Deep merge: defaults ← saved (preserving new default keys)
function deepMerge(defaults, saved) {
  const result = { ...defaults };
  for (const key of Object.keys(saved)) {
    if (
      saved[key] !== null &&
      typeof saved[key] === 'object' &&
      !Array.isArray(saved[key]) &&
      typeof defaults[key] === 'object' &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(defaults[key], saved[key]);
    } else {
      result[key] = saved[key];
    }
  }
  return result;
}
