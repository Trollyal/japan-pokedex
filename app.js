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

    // Audio opt-in prompt (once only)
    showAudioPrompt(state);
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

function showAudioPrompt(state) {
  if (state.audioPromptShown) return;
  setTimeout(() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
    el.innerHTML = `
      <div style="background:#fff;border:4px solid #2C2C54;border-radius:20px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3);">
        <div style="font-family:'Press Start 2P',monospace;font-size:11px;color:#2C2C54;margin-bottom:16px;line-height:1.6;">Enable retro sounds?</div>
        <p style="font-family:'Quicksand',sans-serif;font-size:14px;color:#555;margin-bottom:20px;line-height:1.5;">Chiptune SFX &amp; music for the full experience.</p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="audio-yes" style="font-family:'Press Start 2P',monospace;font-size:10px;padding:12px 20px;border-radius:12px;border:3px solid #5DAA68;background:#E8F5E9;color:#2E7D32;cursor:pointer;">YES!</button>
          <button id="audio-no" style="font-family:'Press Start 2P',monospace;font-size:10px;padding:12px 20px;border-radius:12px;border:3px solid #ddd;background:#fff;color:#757575;cursor:pointer;">No thanks</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('#audio-yes').addEventListener('click', () => {
      state.audioMuted = false;
      state.audioPromptShown = true;
      el.remove();
    });
    el.querySelector('#audio-no').addEventListener('click', () => {
      state.audioMuted = true;
      state.audioPromptShown = true;
      el.remove();
    });
  }, 5000);
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
