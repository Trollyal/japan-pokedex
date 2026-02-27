// data/locations.js — Kansai location easter eggs (GPS-triggered encounters)

import { sprite } from '../lib/sprites.js';

export const LOCATION_EASTER_EGGS = [
  {
    id: 'fushimi-inari',
    name: 'Fushimi Inari',
    sprite: 'scene-fushimi-inari',
    text: 'Thousands of vermillion torii gates stretch before you! Bulbasaur peeks through them curiously.',
    // Fushimi Inari Taisha bounding box
    latMin: 34.965, latMax: 34.972,
    lngMin: 135.771, lngMax: 135.778,
  },
  {
    id: 'dotonbori',
    name: 'Dotonbori',
    sprite: 'scene-dotonbori',
    text: 'Neon lights reflect off the canal! Bulbasaur is mesmerized by the giant Glico Running Man sign.',
    // Dotonbori canal area
    latMin: 34.667, latMax: 34.672,
    lngMin: 135.499, lngMax: 135.506,
  },
  {
    id: 'osaka-castle',
    name: 'Osaka Castle',
    sprite: 'scene-osaka-castle',
    text: 'The magnificent castle towers above the cherry trees! Bulbasaur feels like a samurai.',
    // Osaka Castle park
    latMin: 34.685, latMax: 34.690,
    lngMin: 135.524, lngMax: 135.530,
  },
  {
    id: 'kinkakuji',
    name: 'Kinkaku-ji',
    sprite: 'scene-kinkakuji',
    text: 'The Golden Pavilion gleams in the sunlight! Bulbasaur\'s bulb is shimmering in response.',
    // Kinkaku-ji temple
    latMin: 35.038, latMax: 35.041,
    lngMin: 135.727, lngMax: 135.731,
  },
  {
    id: 'arashiyama',
    name: 'Arashiyama',
    sprite: 'scene-arashiyama',
    text: 'Towering bamboo stalks surround you and Bulbasaur. The rustling sounds are magical!',
    // Arashiyama bamboo grove
    latMin: 35.015, latMax: 35.020,
    lngMin: 135.669, lngMax: 135.675,
  },
];

/**
 * Check if current GPS position triggers a location easter egg.
 * Returns the first matching untriggered location, or null.
 */
export function checkLocationEasterEggs(lat, lng, state) {
  const triggered = state.locationEasterEggs || {};
  for (const loc of LOCATION_EASTER_EGGS) {
    if (triggered[loc.id]) continue;
    if (lat >= loc.latMin && lat <= loc.latMax && lng >= loc.lngMin && lng <= loc.lngMax) {
      return loc;
    }
  }
  return null;
}
