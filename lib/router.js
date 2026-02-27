// lib/router.js — Hash-based screen switching + tab bar management

import { bus } from './events.js';

const screens = new Map();
let currentScreen = null;
let shellEl = null;

export function setShell(el) {
  shellEl = el;
}

export function registerScreen(name, tagName, loader) {
  screens.set(name, { tagName, loader, loaded: false });
}

export async function navigate(screenName, params = {}) {
  const entry = screens.get(screenName);
  if (!entry) return;

  // Lazy-load component if needed
  if (!entry.loaded && entry.loader) {
    await entry.loader();
    entry.loaded = true;
  }

  currentScreen = screenName;
  location.hash = screenName;

  bus.emit('navigate', { screen: screenName, params });

  // Update screen container
  if (shellEl) {
    const container = shellEl.querySelector('#screen-container');
    if (container) {
      container.innerHTML = '';
      const el = document.createElement(entry.tagName);
      if (params) {
        for (const [k, v] of Object.entries(params)) el.setAttribute(k, v);
      }
      container.appendChild(el);
    }
  }

  // Update tab bar
  updateTabBar(screenName);
}

function updateTabBar(screenName) {
  if (!shellEl) return;
  const tabs = shellEl.querySelectorAll('.nav-btn');
  tabs.forEach(btn => {
    const isActive = btn.dataset.screen === screenName;
    btn.classList.toggle('active', isActive);
  });
}

export function getCurrentScreen() {
  return currentScreen;
}

// Restore from hash on load
export function initFromHash(fallback = 'pokedex') {
  const hash = location.hash.slice(1);
  return screens.has(hash) ? hash : fallback;
}

// Preload screens via requestIdleCallback
export function preloadScreens() {
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
  for (const [name, entry] of screens) {
    if (!entry.loaded && entry.loader) {
      idle(() => {
        entry.loader().then(() => { entry.loaded = true; });
      });
    }
  }
}

// Listen for hash changes
window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
  if (hash && screens.has(hash) && hash !== currentScreen) {
    navigate(hash);
  }
});
