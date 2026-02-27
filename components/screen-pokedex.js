// components/screen-pokedex.js — Pokédex screen with phrase/kanji/etiquette/kansai tabs

import sharedStyles from '../lib/shared-styles.js';
import { PHRASES, KANJI } from '../data/phrases.js';
import { ETIQUETTE, KANSAI_DIALECT, KANSAI_TIPS } from '../data/etiquette.js';
import { bus } from '../lib/events.js';
import { sprite } from '../lib/sprites.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: block; padding: 20px 28px; animation: fadeIn .3s ease; }

  .search-bar {
    background: #fff; border: 2px solid #e0d8cc; border-radius: 12px;
    padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
    line-height: 0;
  }
  .search-bar input {
    border: none; outline: none; font-family: 'Quicksand', sans-serif; font-size: 14px;
    flex: 1; background: transparent; line-height: normal;
  }
  .search-bar svg { width: 18px; height: 18px; color: #aaa; flex-shrink: 0; }
  .search-bar img { flex-shrink: 0; opacity: .45; }
  .clear-search {
    background: none; border: none; font-size: 18px; color: #aaa; cursor: pointer;
    display: none; padding: 0 4px;
  }
  .clear-search.show { display: block; }

  .category-tabs {
    display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 12px;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .category-tabs::-webkit-scrollbar { display: none; }
  .type-tab {
    flex-shrink: 0; padding: 10px 16px; border-radius: 20px; border: 2px solid;
    font-family: 'Press Start 2P', monospace; font-size: 9px; cursor: pointer;
    transition: all .2s; white-space: nowrap; background: transparent;
    min-height: 44px; display: inline-flex; align-items: center; gap: 4px;
  }
  .type-tab[data-type="fire"] { border-color: var(--fire); color: #C43E10; background: var(--fire-bg); }
  .type-tab[data-type="water"] { border-color: var(--water); color: #1565C0; background: var(--water-bg); }
  .type-tab[data-type="grass"] { border-color: var(--grass); color: #2E7D32; background: var(--grass-bg); }
  .type-tab[data-type="electric"] { border-color: var(--electric); color: #7D5E00; background: var(--electric-bg); }
  .type-tab.active[data-type="fire"] { background: #D84315; color: #fff; border-color: #D84315; }
  .type-tab.active[data-type="water"] { background: #1565C0; color: #fff; border-color: #1565C0; }
  .type-tab.active[data-type="grass"] { background: #2E7D32; color: #fff; border-color: #2E7D32; }
  .type-tab.active[data-type="electric"] { background: var(--electric); color: var(--poke-dark); }

  .dex-section { animation: fadeIn .25s ease; }
  .dex-group-title {
    font-family: 'Press Start 2P', monospace; font-size: 9px;
    margin: 16px 0 10px; padding: 8px 14px; border-radius: 8px;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .dex-group-title.fire { background: var(--fire-bg); color: #C43E10; }
  .dex-group-title.water { background: var(--water-bg); color: #1565C0; }
  .dex-group-title.grass { background: var(--grass-bg); color: #2E7D32; }
  .dex-group-title.electric { background: var(--electric-bg); color: #7D5E00; }

  /* Kanji */
  .kanji-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .kanji-card {
    background: #fff; border-radius: var(--radius, 16px); padding: 20px;
    border: 2px solid var(--water-border); box-shadow: var(--shadow);
    text-align: center; flex: 1 1 calc(50% - 4px); min-width: 140px;
  }
  .kanji-card .kanji-big { font-size: 48px; line-height: 1.2; margin-bottom: 8px; }
  .kanji-card .kanji-reading { font-size: 12px; color: #1565C0; font-weight: 600; margin-bottom: 4px; }
  .kanji-card .kanji-meaning { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #555; }

  /* Etiquette */
  .rule-card {
    background: #fff; border-radius: var(--radius, 16px); padding: 16px; margin: 8px 0;
    border-left: 4px solid var(--grass); box-shadow: var(--shadow);
    display: flex; gap: 12px; align-items: flex-start;
  }
  .rule-icon {
    font-size: 22px; flex-shrink: 0; line-height: 1;
    width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
    background: var(--grass-bg); border: 2px solid var(--grass-border);
    border-radius: 8px; image-rendering: pixelated;
  }
  .rule-card .rule-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .rule-card .rule-desc { font-size: 13px; color: #555; line-height: 1.5; }

  /* Kansai */
  .kansai-card {
    background: #fff; border-radius: var(--radius, 16px); padding: 16px; margin: 8px 0;
    border-left: 4px solid var(--electric); box-shadow: var(--shadow);
  }
  .kansai-card .dialect { font-size: 22px; font-weight: 700; color: #7D5E00; margin-bottom: 2px; }
  .kansai-card .romaji { font-size: 13px; color: #7D5E00; font-style: italic; margin-bottom: 4px; opacity: .8; }
  .kansai-card .standard { font-size: 13px; color: #666; margin-bottom: 4px; }
  .kansai-card .meaning { font-size: 14px; font-weight: 600; }

  .kansai-tip {
    background: var(--electric-bg); border: 2px dashed var(--electric-border);
    border-radius: var(--radius, 16px); padding: 16px; margin: 8px 0;
  }
  .kansai-tip .tip-region { font-family: 'Press Start 2P', monospace; font-size: 9px; color: #7D5E00; margin-bottom: 8px; }
  .kansai-tip .tip-text { font-size: 14px; line-height: 1.6; color: #444; }

  /* Speaker button */
  .speak-btn {
    background: none; border: 1px solid #ddd; border-radius: 10px; padding: 8px;
    cursor: pointer; transition: background .15s; min-width: 44px; min-height: 44px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    margin-left: auto;
  }
  .speak-btn:active { background: #eee; }
  .speak-btn img { opacity: .8; }

  /* JP text row: flex to push speak button right */
  .jp-row {
    display: flex; align-items: center; gap: 8px;
  }
`);

const GROUP_EMOJI = {
  Greetings: sprite('grp-greetings', 14), Restaurant: sprite('grp-restaurant', 14),
  Shopping: sprite('grp-shopping', 14), Directions: sprite('grp-directions', 14),
  Emergency: sprite('grp-emergency', 14), Konbini: sprite('grp-konbini', 14),
  Pokemon: sprite('grp-pokemon', 14)
};

class ScreenPokedex extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._currentTab = 'fire';
  }

  connectedCallback() {
    this._render();
    this._bindEvents();
  }

  _render() {
    this.shadowRoot.innerHTML = /*html*/`
      <div class="search-bar">
        ${sprite('icon-search', 20)}
        <input type="text" id="dex-search" placeholder="Search phrases, kanji, rules...">
        <button class="clear-search" id="clear-btn">×</button>
      </div>
      <div class="category-tabs">
        <button class="type-tab active" data-type="fire">${sprite('type-fire', 12)} Phrases</button>
        <button class="type-tab" data-type="water">${sprite('type-water', 12)} Kanji</button>
        <button class="type-tab" data-type="grass">${sprite('type-grass', 12)} Etiquette</button>
        <button class="type-tab" data-type="electric">${sprite('type-electric', 12)} Kansai</button>
      </div>
      <div id="dex-content"></div>
    `;
    this._renderContent();
  }

  _bindEvents() {
    const search = this.shadowRoot.getElementById('dex-search');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');

    search.addEventListener('input', () => {
      clearBtn.classList.toggle('show', search.value.length > 0);
      this._renderContent();
    });

    clearBtn.addEventListener('click', () => {
      search.value = '';
      clearBtn.classList.remove('show');
      this._renderContent();
    });

    this.shadowRoot.querySelectorAll('.type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._currentTab = tab.dataset.type;
        this.shadowRoot.querySelectorAll('.type-tab').forEach(t =>
          t.classList.toggle('active', t.dataset.type === this._currentTab)
        );
        this._renderContent();
      });
    });

    // Delegate speaker button clicks
    this.shadowRoot.getElementById('dex-content').addEventListener('click', (e) => {
      const btn = e.target.closest('.speak-btn');
      if (btn) {
        const text = btn.dataset.text;
        if (text) bus.emit('speak', { text, lang: 'ja-JP' });
      }
    });
  }

  _renderContent() {
    const q = (this.shadowRoot.getElementById('dex-search')?.value || '').toLowerCase().trim();
    const container = this.shadowRoot.getElementById('dex-content');

    if (this._currentTab === 'fire') this._renderPhrases(container, q);
    else if (this._currentTab === 'water') this._renderKanji(container, q);
    else if (this._currentTab === 'grass') this._renderEtiquette(container, q);
    else this._renderKansai(container, q);
  }

  _renderPhrases(container, q) {
    const groups = {};
    const indexed = PHRASES.map((p, i) => ({ ...p, idx: i + 1 }));
    indexed.forEach(p => {
      if (q && !`${p.en} ${p.jp} ${p.romaji} ${p.group}`.toLowerCase().includes(q)) return;
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    if (!Object.keys(groups).length) {
      container.innerHTML = `<div class="no-results">${sprite('scene-no-results', 48)}<div style="margin-top:8px">No phrases found</div><div class="pixel">Try another search!</div></div>`;
      return;
    }

    let html = '';
    for (const [group, items] of Object.entries(groups)) {
      html += `<div class="dex-group-title fire">${GROUP_EMOJI[group] || '📝'} ${group}</div>`;
      items.forEach(p => {
        html += `<div class="dex-card fire">
          <div class="dex-num">#${String(p.idx).padStart(3, '0')}</div>
          <div class="en">${p.en}</div>
          <div class="jp-row">
            <div class="jp">${p.jp}</div>
            <button class="speak-btn" data-text="${p.jp}" aria-label="Listen">${sprite('icon-speaker', 20)}</button>
          </div>
          <div class="romaji">${p.romaji}</div>
        </div>`;
      });
    }
    container.innerHTML = html;
  }

  _renderKanji(container, q) {
    const filtered = KANJI.filter(k => !q || `${k.kanji} ${k.reading} ${k.meaning}`.toLowerCase().includes(q));
    if (!filtered.length) {
      container.innerHTML = `<div class="no-results">${sprite('scene-no-results', 48)}<div style="margin-top:8px">No kanji found</div><div class="pixel">Try another search!</div></div>`;
      return;
    }
    container.innerHTML = '<div class="kanji-grid">' + filtered.map(k =>
      `<div class="kanji-card">
        <div class="kanji-big">${k.kanji}</div>
        <div class="kanji-reading">${k.reading}</div>
        <div class="kanji-meaning">${k.meaning}</div>
      </div>`
    ).join('') + '</div>';
  }

  _renderEtiquette(container, q) {
    const filtered = ETIQUETTE.filter(e => !q || `${e.title} ${e.desc}`.toLowerCase().includes(q));
    if (!filtered.length) {
      container.innerHTML = `<div class="no-results">${sprite('scene-no-results', 48)}<div style="margin-top:8px">No rules found</div><div class="pixel">Try another search!</div></div>`;
      return;
    }
    container.innerHTML = filtered.map(e =>
      `<div class="rule-card">
        <div class="rule-icon">${e.icon}</div>
        <div><div class="rule-title">${e.title}</div><div class="rule-desc">${e.desc}</div></div>
      </div>`
    ).join('');
  }

  _renderKansai(container, q) {
    const filteredDialect = KANSAI_DIALECT.filter(d => !q || `${d.dialect} ${d.romaji} ${d.standard} ${d.meaning}`.toLowerCase().includes(q));
    const filteredTips = KANSAI_TIPS.filter(t => !q || `${t.region} ${t.text}`.toLowerCase().includes(q));

    if (!filteredDialect.length && !filteredTips.length) {
      container.innerHTML = `<div class="no-results">${sprite('scene-no-results', 48)}<div style="margin-top:8px">No Kansai content found</div><div class="pixel">Try another search!</div></div>`;
      return;
    }

    let html = '';
    if (filteredDialect.length) {
      html += `<div class="dex-group-title electric">🗣️ Kansai-ben Phrases</div>`;
      filteredDialect.forEach(d => {
        html += `<div class="kansai-card">
          <div class="jp-row">
            <div class="dialect">${d.dialect}</div>
            <button class="speak-btn" data-text="${d.dialect}" aria-label="Listen">${sprite('icon-speaker', 20)}</button>
          </div>
          <div class="romaji">${d.romaji}</div>
          <div class="standard">Standard: ${d.standard}</div>
          <div class="meaning">${d.meaning}</div>
        </div>`;
      });
    }
    if (filteredTips.length) {
      html += `<div class="dex-group-title electric">📍 Regional Tips</div>`;
      filteredTips.forEach(t => {
        html += `<div class="kansai-tip">
          <div class="tip-region">${t.region}</div>
          <div class="tip-text">${t.text}</div>
        </div>`;
      });
    }
    container.innerHTML = html;
  }
}

customElements.define('screen-pokedex', ScreenPokedex);
