const CACHE_NAME = 'japan-guide-v11';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './app.js',
  './lib/state.js',
  './lib/router.js',
  './lib/storage.js',
  './lib/events.js',
  './lib/shared-styles.js',
  './lib/pokemon-types.js',
  './lib/gps.js',
  './lib/speech.js',
  './lib/backup.js',
  './lib/sprites.js',
  './lib/audio.js',
  './lib/progression.js',
  './components/app-shell.js',
  './components/screen-onboarding.js',
  './components/screen-pokedex.js',
  './components/screen-battle.js',
  './components/screen-journal.js',
  './components/screen-catch-flow.js',
  './components/screen-trainer-card.js',
  './components/screen-spot-detail.js',
  './components/screen-day-recap.js',
  './components/wild-encounter.js',
  './data/phrases.js',
  './data/etiquette.js',
  './data/quiz-builders.js',
  './data/facts.js',
  './data/badges.js',
  // Sprite WebP files
  './sprites/pokeball.webp',
  './sprites/greatball.webp',
  './sprites/ultraball.webp',
  './sprites/masterball.webp',
  './sprites/premierball.webp',
  './sprites/type-fire.webp',
  './sprites/type-water.webp',
  './sprites/type-grass.webp',
  './sprites/type-electric.webp',
  './sprites/spot-food.webp',
  './sprites/spot-onsen.webp',
  './sprites/spot-nature.webp',
  './sprites/spot-culture.webp',
  './sprites/spot-nightlife.webp',
  './sprites/spot-other.webp',
  './sprites/rarity-common.webp',
  './sprites/rarity-uncommon.webp',
  './sprites/rarity-rare.webp',
  './sprites/rarity-legendary.webp',
  './sprites/nav-pokedex.webp',
  './sprites/nav-battle.webp',
  './sprites/nav-journal.webp',
  './sprites/grp-greetings.webp',
  './sprites/grp-restaurant.webp',
  './sprites/grp-shopping.webp',
  './sprites/grp-directions.webp',
  './sprites/grp-emergency.webp',
  './sprites/grp-konbini.webp',
  './sprites/grp-pokemon.webp',
  './sprites/icon-search.webp',
  './sprites/icon-close.webp',
  './sprites/icon-speaker.webp',
  './sprites/icon-backpack.webp',
  './sprites/icon-gym-badge.webp',
  './sprites/icon-lock.webp',
  './sprites/icon-star.webp',
  './sprites/icon-camera.webp',
  './sprites/icon-export.webp',
  './sprites/icon-import.webp',
  './sprites/icon-warning.webp',
  './sprites/icon-moon.webp',
  './sprites/icon-sun.webp',
  './sprites/icon-muted.webp',
  './sprites/badge-food-master.webp',
  './sprites/badge-shrine-keeper.webp',
  './sprites/badge-night-owl.webp',
  './sprites/badge-early-bird.webp',
  './sprites/badge-explorer.webp',
  './sprites/badge-champion.webp',
  './sprites/badge-nara-deer.webp',
  './sprites/oak.webp',
  './sprites/bulbasaur-happy.webp',
  './sprites/bulbasaur-sleepy.webp',
  './sprites/bulbasaur-excited.webp',
  './sprites/bulbasaur-confused.webp',
  './sprites/bulbasaur-vinewhip.webp',
  './sprites/scene-empty-journal.webp',
  './sprites/scene-no-results.webp',
  './sprites/scene-gotcha.webp',
  './sprites/scene-wild-fact.webp',
  './sprites/scene-nara-deer.webp',
  './sprites/scene-day-recap.webp',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Quicksand:wght@400;500;600;700&display=swap'
];

// Install — cache all core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(PRECACHE_URLS).catch(err => {
        // Some files may not exist yet; cache what we can
        return Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)));
      })
    )
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for navigation, cache-first for modules
self.addEventListener('fetch', event => {
  // Navigation: network-first (always get latest shell)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // JS modules: cache-first (versioned by cache name)
  if (event.request.url.endsWith('.js')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
