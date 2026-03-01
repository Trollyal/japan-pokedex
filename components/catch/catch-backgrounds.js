// components/catch/catch-backgrounds.js — Type-themed pixel art environments (pure CSS)

const BACKGROUNDS = {
  fire: {
    label: 'Food',
    gradient: 'linear-gradient(180deg, #1a0a2e 0%, #4a1942 25%, #8b3a3a 50%, #d4722c 75%, #f39c12 100%)',
    accent: '#F08030',
  },
  water: {
    label: 'Onsen',
    gradient: 'linear-gradient(180deg, #0c1445 0%, #1a3a6e 30%, #4a7ab5 60%, #8bbbd4 80%, #b8d4f0 100%)',
    accent: '#6890F0',
  },
  grass: {
    label: 'Nature',
    gradient: 'linear-gradient(180deg, #0a2a0a 0%, #1a4a1a 25%, #3a7a3a 50%, #6ab06a 75%, #a8d8a8 100%)',
    accent: '#78C850',
  },
  psychic: {
    label: 'Culture',
    gradient: 'linear-gradient(180deg, #1a0a30 0%, #3a1a50 25%, #6a3a7a 50%, #c87aaa 75%, #FFB7C5 100%)',
    accent: '#F85888',
  },
  electric: {
    label: 'Nightlife',
    gradient: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3a 20%, #2a2a5a 40%, #5a5a2a 65%, #c8b830 85%, #FFF8E0 100%)',
    accent: '#F8D030',
  },
  normal: {
    label: 'Other',
    gradient: 'linear-gradient(180deg, #2C2C54 0%, #474787 30%, #8a8aad 55%, #c4c4d4 80%, #eceff1 100%)',
    accent: '#A8A878',
  },
};

/**
 * Apply type-themed background to the catch screen element.
 * @param {HTMLElement} screen - The .catch-screen element
 * @param {string} type - Spot type key (fire, water, grass, psychic, electric, normal)
 */
export function applyBackground(screen, type) {
  const bg = BACKGROUNDS[type] || BACKGROUNDS.normal;
  screen.style.background = bg.gradient;
}

/**
 * Get the accent color for a type (used for power ring, etc.)
 * @param {string} type
 * @returns {string} CSS color
 */
export function getAccentColor(type) {
  return (BACKGROUNDS[type] || BACKGROUNDS.normal).accent;
}

export { BACKGROUNDS };
