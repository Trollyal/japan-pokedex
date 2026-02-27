// data/badges.js — Achievement + quiz badge definitions + checker

import { sprite } from '../lib/sprites.js';
import { SPOT_TYPES } from '../lib/pokemon-types.js';

export const QUIZ_BADGES = [
  { key: 'fire', icon: sprite('type-fire', 16), label: 'Phrases', condition: (s) => s.badges.fire },
  { key: 'water', icon: sprite('type-water', 16), label: 'Kanji', condition: (s) => s.badges.water },
  { key: 'grass', icon: sprite('type-grass', 16), label: 'Etiquette', condition: (s) => s.badges.grass },
  { key: 'electric', icon: sprite('type-electric', 16), label: 'Kansai', condition: (s) => s.badges.electric },
];

export const ACHIEVEMENT_BADGES = [
  { key: 'foodMaster', icon: sprite('badge-food-master', 20), label: 'Food Master', desc: 'Catch 5 Food-type spots' },
  { key: 'shrineKeeper', icon: sprite('badge-shrine-keeper', 20), label: 'Shrine Keeper', desc: 'Catch 3 Culture-type spots' },
  { key: 'nightOwl', icon: sprite('badge-night-owl', 20), label: 'Night Owl', desc: 'Catch a spot after 10 PM' },
  { key: 'earlyBird', icon: sprite('badge-early-bird', 20), label: 'Early Bird', desc: 'Catch a spot before 7 AM' },
  { key: 'explorer', icon: sprite('badge-explorer', 20), label: 'Explorer', desc: 'Catch at least one of every type' },
  { key: 'kansaiChampion', icon: sprite('badge-champion', 20), label: 'Kansai Champion', desc: 'Catch 20+ total spots' },
  { key: 'naraDeer', icon: sprite('badge-nara-deer', 20), label: 'Nara Deer', desc: 'Encounter the Nara deer!' },
];

export function checkAchievements(state) {
  const spots = state.caughtSpots || [];
  const typeCounts = {};
  spots.forEach(s => { typeCounts[s.type] = (typeCounts[s.type] || 0) + 1; });

  const newlyEarned = [];
  const ach = { ...state.achievements };

  if ((typeCounts.fire || 0) >= 5 && !ach.foodMaster) {
    ach.foodMaster = true;
    newlyEarned.push('foodMaster');
  }
  if ((typeCounts.psychic || 0) >= 3 && !ach.shrineKeeper) {
    ach.shrineKeeper = true;
    newlyEarned.push('shrineKeeper');
  }
  if (spots.length >= 20 && !ach.kansaiChampion) {
    ach.kansaiChampion = true;
    newlyEarned.push('kansaiChampion');
  }

  const allTypes = Object.keys(SPOT_TYPES);
  if (allTypes.every(t => (typeCounts[t] || 0) >= 1) && !ach.explorer) {
    ach.explorer = true;
    newlyEarned.push('explorer');
  }

  state.achievements = ach;
  return newlyEarned;
}
