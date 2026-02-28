// lib/sprites.js — Sprite library using WebP pixel art files
// All sprites are pre-rendered as WebP images in ./sprites/
// Returns <img> tags for inline use

const SPRITE_MAP = [
  // Pokeballs (16x16)
  'pokeball', 'greatball', 'ultraball', 'masterball', 'premierball',
  // Type icons (16x16)
  'type-fire', 'type-water', 'type-grass', 'type-electric',
  // Spot icons (16x16)
  'spot-food', 'spot-onsen', 'spot-nature', 'spot-culture', 'spot-nightlife', 'spot-other',
  // Rarity icons (16x16)
  'rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-legendary',
  // Nav icons (16x16)
  'nav-pokedex', 'nav-battle', 'nav-journal',
  // Phrase group icons (16x16)
  'grp-greetings', 'grp-restaurant', 'grp-shopping', 'grp-directions',
  'grp-emergency', 'grp-konbini', 'grp-pokemon',
  // UI icons (16x16)
  'icon-search', 'icon-close', 'icon-speaker', 'icon-backpack',
  'icon-gym-badge', 'icon-lock', 'icon-star', 'icon-camera',
  'icon-export', 'icon-import', 'icon-warning', 'icon-moon', 'icon-sun', 'icon-muted',
  // Achievement badges (20x20)
  'badge-food-master', 'badge-shrine-keeper', 'badge-night-owl', 'badge-early-bird',
  'badge-explorer', 'badge-champion', 'badge-nara-deer',
  'badge-first-catch', 'badge-collector-10', 'badge-perfect-quiz', 'badge-quiz-master',
  'badge-combo-king', 'badge-shutter-bug', 'badge-streak-3', 'badge-streak-5',
  'badge-streak-7', 'badge-distance-walker', 'badge-distance-runner',
  'badge-fact-hunter', 'badge-diverse-explorer',
  // Characters (32x32)
  'oak', 'bulbasaur-happy', 'bulbasaur-sleepy', 'bulbasaur-excited',
  'bulbasaur-confused', 'bulbasaur-vinewhip',
  // Scenes (48x48)
  'scene-empty-journal', 'scene-no-results', 'scene-gotcha',
  'scene-wild-fact', 'scene-nara-deer', 'scene-day-recap',
  'scene-fushimi-inari', 'scene-dotonbori', 'scene-osaka-castle',
  'scene-kinkakuji', 'scene-arashiyama',
];

const SPRITE_SET = new Set(SPRITE_MAP);

export function sprite(name, size = 24) {
  if (!SPRITE_SET.has(name)) return '';
  return `<img src="./sprites/${name}.webp" width="${size}" height="${size}" alt="${name}" style="display:inline-block;vertical-align:middle;image-rendering:pixelated" loading="lazy" onerror="this.style.display='none'">`;
}
