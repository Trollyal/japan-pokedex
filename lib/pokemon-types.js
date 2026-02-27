// lib/pokemon-types.js — Type system config for quiz + catch
import { sprite } from './sprites.js';

// Quiz types (existing categories)
export const QUIZ_TYPES = {
  fire:     { color: '#FF6B35', bg: '#FFF0E8', border: '#FFD4BC', icon: sprite('type-fire', 16), label: 'Phrases' },
  water:    { color: '#4A90D9', bg: '#E8F2FF', border: '#B8D4F0', icon: sprite('type-water', 16), label: 'Kanji' },
  grass:    { color: '#5DAA68', bg: '#E8F5E9', border: '#B8DFB8', icon: sprite('type-grass', 16), label: 'Etiquette' },
  electric: { color: '#F5C842', bg: '#FFFBE8', border: '#F0E0A0', icon: sprite('type-electric', 16), label: 'Kansai' },
};

// Spot types (catch system)
export const SPOT_TYPES = {
  fire:     { color: '#F08030', bg: '#FFF0E8', icon: sprite('spot-food', 16), label: 'Food' },
  water:    { color: '#6890F0', bg: '#E8F2FF', icon: sprite('spot-onsen', 16), label: 'Onsen' },
  grass:    { color: '#78C850', bg: '#E8F5E9', icon: sprite('spot-nature', 16), label: 'Nature' },
  psychic:  { color: '#F85888', bg: '#FFE8EF', icon: sprite('spot-culture', 16), label: 'Culture' },
  electric: { color: '#F8D030', bg: '#FFFBE8', icon: sprite('spot-nightlife', 16), label: 'Nightlife' },
  normal:   { color: '#A8A878', bg: '#F5F5F0', icon: sprite('spot-other', 16), label: 'Other' },
};

// Rarity definitions
export const RARITY = {
  common:    { label: 'Common', color: '#888', icon: sprite('rarity-common', 16), glow: 'none' },
  uncommon:  { label: 'Uncommon', color: '#4A90D9', icon: sprite('rarity-uncommon', 16), glow: '0 0 10px rgba(74,144,217,.4)' },
  rare:      { label: 'Rare', color: '#FFB800', icon: sprite('rarity-rare', 16), glow: '0 0 15px rgba(255,184,0,.5)' },
  legendary: { label: 'Legendary', color: '#9B59B6', icon: sprite('rarity-legendary', 16), glow: '0 0 20px rgba(155,89,182,.6)' },
};

// Battle categories (migrated from BATTLE_CATS)
export const BATTLE_CATS = [
  { type: 'fire',     icon: sprite('type-fire', 36), name: 'PHRASE MATCH',      desc: 'Match English phrases to Japanese',       questionLabel: 'A wild Phrase appeared!' },
  { type: 'water',    icon: sprite('type-water', 36), name: 'KANJI QUIZ',        desc: 'Identify kanji meanings',                  questionLabel: 'A wild Kanji appeared!' },
  { type: 'grass',    icon: sprite('type-grass', 36), name: 'ETIQUETTE CHECK',   desc: 'True or false — do you know the rules?',  questionLabel: 'A wild Rule appeared!' },
  { type: 'electric', icon: sprite('type-electric', 36), name: 'KANSAI CHALLENGE',  desc: 'Kansai dialect and regional knowledge',    questionLabel: 'A wild Kansai-ben appeared!' },
];
