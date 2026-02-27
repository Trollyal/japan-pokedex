// data/badges.js — Achievement + quiz badge definitions + consolidated checker
// Single source of truth for all achievement logic

import { sprite } from '../lib/sprites.js';
import { SPOT_TYPES } from '../lib/pokemon-types.js';

export const QUIZ_BADGES = [
  { key: 'fire', icon: sprite('type-fire', 16), label: 'Phrases', condition: (s) => s.badges.fire },
  { key: 'water', icon: sprite('type-water', 16), label: 'Kanji', condition: (s) => s.badges.water },
  { key: 'grass', icon: sprite('type-grass', 16), label: 'Etiquette', condition: (s) => s.badges.grass },
  { key: 'electric', icon: sprite('type-electric', 16), label: 'Kansai', condition: (s) => s.badges.electric },
];

export const ACHIEVEMENT_BADGES = [
  // Original 7
  { key: 'foodMaster', icon: sprite('badge-food-master', 20), label: 'Food Master', desc: 'Catch 5 Food-type spots' },
  { key: 'shrineKeeper', icon: sprite('badge-shrine-keeper', 20), label: 'Shrine Keeper', desc: 'Catch 3 Culture-type spots' },
  { key: 'nightOwl', icon: sprite('badge-night-owl', 20), label: 'Night Owl', desc: 'Catch a spot after 10 PM' },
  { key: 'earlyBird', icon: sprite('badge-early-bird', 20), label: 'Early Bird', desc: 'Catch a spot before 7 AM' },
  { key: 'explorer', icon: sprite('badge-explorer', 20), label: 'Explorer', desc: 'Catch one of every type' },
  { key: 'kansaiChampion', icon: sprite('badge-champion', 20), label: 'Kansai Champion', desc: 'Catch 20+ total spots' },
  { key: 'naraDeer', icon: sprite('badge-nara-deer', 20), label: 'Nara Deer', desc: 'Encounter the Nara deer!' },
  // New 13
  { key: 'firstCatch', icon: sprite('badge-first-catch', 20), label: 'First Catch', desc: 'Catch your first spot' },
  { key: 'collector10', icon: sprite('badge-collector-10', 20), label: 'Collector', desc: 'Catch 10 spots' },
  { key: 'perfectQuiz', icon: sprite('badge-perfect-quiz', 20), label: 'Perfect Quiz', desc: 'Score 10/10 on a quiz' },
  { key: 'quizMaster', icon: sprite('badge-quiz-master', 20), label: 'Quiz Master', desc: 'Earn all 4 gym badges' },
  { key: 'comboKing', icon: sprite('badge-combo-king', 20), label: 'Combo King', desc: 'Get a 7+ combo in battle' },
  { key: 'shutterBug', icon: sprite('badge-shutter-bug', 20), label: 'Shutter Bug', desc: 'Catch 5 spots with photos' },
  { key: 'streak3', icon: sprite('badge-streak-3', 20), label: 'Streak 3', desc: '3-day catch streak' },
  { key: 'streak5', icon: sprite('badge-streak-5', 20), label: 'Streak 5', desc: '5-day catch streak' },
  { key: 'streak7', icon: sprite('badge-streak-7', 20), label: 'Streak 7', desc: '7-day catch streak' },
  { key: 'distanceWalker', icon: sprite('badge-distance-walker', 20), label: 'Walker', desc: 'Walk 2+ km between spots' },
  { key: 'distanceRunner', icon: sprite('badge-distance-runner', 20), label: 'Runner', desc: 'Walk 10+ km total' },
  { key: 'factHunter', icon: sprite('badge-fact-hunter', 20), label: 'Fact Hunter', desc: 'Collect 10 wild facts' },
  { key: 'diverseExplorer', icon: sprite('badge-diverse-explorer', 20), label: 'Diverse Explorer', desc: 'Catch 3+ of 4 different types' },
];

/**
 * Consolidated achievement checker — single source of truth.
 * Checks all 20 achievement conditions against current state.
 * Returns array of newly earned achievement keys.
 */
export function checkAchievements(state) {
  const spots = state.caughtSpots || [];
  const typeCounts = {};
  spots.forEach(s => { typeCounts[s.type] = (typeCounts[s.type] || 0) + 1; });

  const newlyEarned = [];
  const ach = { ...state.achievements };

  function earn(key) {
    if (!ach[key]) { ach[key] = true; newlyEarned.push(key); }
  }

  // --- Spot-based ---
  if (spots.length >= 1) earn('firstCatch');
  if (spots.length >= 10) earn('collector10');
  if (spots.length >= 20) earn('kansaiChampion');
  if ((typeCounts.fire || 0) >= 5) earn('foodMaster');
  if ((typeCounts.psychic || 0) >= 3) earn('shrineKeeper');

  const allTypes = Object.keys(SPOT_TYPES);
  if (allTypes.every(t => (typeCounts[t] || 0) >= 1)) earn('explorer');

  // Diverse Explorer: 3+ spots in at least 4 different types
  const typesWithThree = Object.values(typeCounts).filter(c => c >= 3).length;
  if (typesWithThree >= 4) earn('diverseExplorer');

  // Shutter Bug: 5+ spots with photos
  const photoCount = spots.filter(s => s.hasPhoto).length;
  if (photoCount >= 5) earn('shutterBug');

  // --- Streak-based ---
  const streak = state.longestStreak || state.catchStreak?.count || 0;
  if (streak >= 3) earn('streak3');
  if (streak >= 5) earn('streak5');
  if (streak >= 7) earn('streak7');

  // --- Distance-based ---
  const dist = state.totalDistance || 0;
  if (dist >= 2) earn('distanceWalker');
  if (dist >= 10) earn('distanceRunner');

  // --- Quiz-based (checked externally but also check state here) ---
  const badges = state.badges || {};
  if (Object.values(badges).every(Boolean)) earn('quizMaster');

  // --- Fact-based ---
  if ((state.caughtFacts?.length || 0) >= 10) earn('factHunter');

  // Note: perfectQuiz, comboKing, nightOwl, earlyBird, naraDeer are triggered
  // from their respective flows and may already be set. We preserve them here.

  state.achievements = ach;
  return newlyEarned;
}
