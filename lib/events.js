// lib/events.js — Singleton EventTarget bus for cross-component messages

class EventBus extends EventTarget {
  emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  on(name, callback) {
    this.addEventListener(name, callback);
    return () => this.removeEventListener(name, callback);
  }
}

export const bus = new EventBus();

// Named events:
// 'show-dialogue'  { text, autoHide? }
// 'hide-dialogue'
// 'show-toast'     { text, duration? }
// 'start-catch'
// 'spot-caught'    { spot }
// 'badge-earned'   { badge }
// 'navigate'       { screen, params? }
