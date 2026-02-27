// lib/speech.js — SpeechSynthesis wrapper with iOS unlock

import { bus } from './events.js';

let unlocked = false;

function unlockTTS() {
  if (unlocked || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  speechSynthesis.speak(u);
  unlocked = true;
}

export function speak(text, lang = 'ja-JP') {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.8;
  speechSynthesis.speak(u);
}

// Unlock on first user interaction
document.addEventListener('click', unlockTTS, { once: true });
document.addEventListener('touchstart', unlockTTS, { once: true });

// Listen for speak events
bus.on('speak', (e) => {
  speak(e.detail.text, e.detail.lang);
});
