// lib/progression.js — Trainer score & Pokeball tier progression

export const BALL_TIERS = [
  { name: 'pokeball',   label: 'Poke Ball',   minScore: 0 },
  { name: 'greatball',  label: 'Great Ball',  minScore: 10 },
  { name: 'ultraball',  label: 'Ultra Ball',  minScore: 25 },
  { name: 'masterball', label: 'Master Ball', minScore: 40 },
];

export function getTrainerScore(state) {
  const spots = state.caughtSpots?.length || 0;
  const badges = Object.values(state.badges || {}).filter(Boolean).length;
  const achievements = Object.values(state.achievements || {}).filter(Boolean).length;
  return spots + (badges * 3) + (achievements * 2);
}

export function getCurrentBall(state) {
  const score = getTrainerScore(state);
  let ball = BALL_TIERS[0];
  for (const tier of BALL_TIERS) {
    if (score >= tier.minScore) ball = tier;
  }
  return ball;
}
