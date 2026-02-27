// app.js — Entry point: init, SW registration, screen setup, greeting logic

import { loadPersistedState, createStore, getState } from './lib/state.js';
import { registerScreen, navigate, initFromHash, setShell, preloadScreens } from './lib/router.js';
import { bus } from './lib/events.js';
import './lib/speech.js';
import './lib/audio.js';
import { sprite } from './lib/sprites.js';

// Register screens with lazy loaders
registerScreen('pokedex', 'screen-pokedex', () => import('./components/screen-pokedex.js'));
registerScreen('battle', 'screen-battle', () => import('./components/screen-battle.js'));
registerScreen('journal', 'screen-journal', () => import('./components/screen-journal.js'));
registerScreen('onboarding', 'screen-onboarding', () => import('./components/screen-onboarding.js'));

async function init() {
  // Load persisted state and create reactive store
  const saved = await loadPersistedState();
  const state = createStore(saved);

  // Import and register app shell (eagerly)
  await import('./components/app-shell.js');

  // Point router at shell element
  const shell = document.querySelector('app-shell');
  setShell(shell);

  // Load always-present overlay components (catch flow, trainer card, spot detail, wild encounter, day recap, buddy)
  await Promise.all([
    import('./components/screen-catch-flow.js'),
    import('./components/screen-trainer-card.js'),
    import('./components/screen-spot-detail.js'),
    import('./components/wild-encounter.js'),
    import('./components/screen-day-recap.js'),
    import('./components/bulbasaur-buddy.js'),
  ]);

  // Append overlay elements to shell
  shell.insertAdjacentHTML('beforeend', `
    <screen-catch-flow></screen-catch-flow>
    <screen-trainer-card></screen-trainer-card>
    <screen-spot-detail></screen-spot-detail>
    <wild-encounter></wild-encounter>
    <screen-day-recap></screen-day-recap>
    <bulbasaur-buddy></bulbasaur-buddy>
  `);

  // Update last open timestamp
  state.lastOpenTimestamp = Date.now();

  // Determine start screen
  if (!state.onboardingComplete) {
    await navigate('onboarding');
  } else {
    const start = initFromHash('pokedex');
    await navigate(start);

    // Time-based greeting (Asia/Tokyo timezone)
    showGreeting(state);

    // Wild fact encounter (15% chance)
    maybeWildFact(state);

    // Day recap check
    checkDayRecap();

    // Backup reminder
    checkBackupReminder();
  }

  // GPS warmup (silent, fire-and-forget)
  warmupGPS();

  // Preload other screens
  preloadScreens();

  // iOS install banner check
  checkInstallBanner(state, shell);
}

function showGreeting(state) {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours();
  const name = state.trainerName || 'Trainer';
  let msg;

  if (hour >= 5 && hour < 12) {
    msg = `Good morning, ${name}! Ready to explore? ${sprite('icon-sun', 16)}`;
  } else if (hour >= 12 && hour < 18) {
    msg = `The adventure continues, ${name}! 🌸`;
  } else if (hour >= 18 && hour < 23) {
    msg = `Osaka comes alive at night, ${name}! Check out the neon districts. ${sprite('icon-moon', 16)}`;
  } else {
    msg = `Even Bulbasaur is getting sleepy, ${name}... 💤`;
  }

  setTimeout(() => bus.emit('show-dialogue', { text: msg, autoHide: 4000 }), 500);
}

function maybeWildFact(state) {
  if (Math.random() > 0.15) return;
  // Delay to let greeting show first
  setTimeout(() => {
    const el = document.querySelector('wild-encounter');
    if (!el) return;
    import('./data/facts.js').then(mod => {
      const caughtIds = new Set(state.caughtFacts || []);
      const uncaught = mod.FACTS.filter(f => !caughtIds.has(f.id));
      if (!uncaught.length) return;
      const fact = uncaught[Math.floor(Math.random() * uncaught.length)];
      el._showFact(fact);
    }).catch(() => {});
  }, 5000);
}

function checkDayRecap() {
  const el = document.querySelector('screen-day-recap');
  if (el) el.checkAndShow();
}

function checkBackupReminder() {
  import('./lib/backup.js').then(mod => mod.checkBackupReminder()).catch(() => {});
}

function warmupGPS() {
  if (!navigator.geolocation) return;
  try {
    navigator.geolocation.getCurrentPosition(() => {}, () => {}, {
      enableHighAccuracy: false,
      timeout: 2000,
      maximumAge: 60000
    });
  } catch { /* silent */ }
}

function checkInstallBanner(state, shell) {
  if (state.installBannerDismissed) return;
  if (window.navigator.standalone !== false) return; // already installed or not iOS Safari

  const banner = shell.querySelector('#install-banner');
  if (banner) {
    banner.style.display = 'flex';
    shell.querySelector('#install-dismiss').addEventListener('click', () => {
      banner.style.display = 'none';
      state.installBannerDismissed = true;
    });
  }
}

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Boot
init().catch(console.error);
