// components/screen-battle.js — Quiz/battle screen with badge case

import sharedStyles from '../lib/shared-styles.js';
import { getState, onStateChange } from '../lib/state.js';
import { BATTLE_CATS } from '../lib/pokemon-types.js';
import { shuffle, buildPhraseQuestions, buildKanjiQuestions, buildEtiquetteQuestions, buildKansaiQuestions } from '../data/quiz-builders.js';
import { bus } from '../lib/events.js';
import { sprite } from '../lib/sprites.js';
import { sfx } from '../lib/audio.js';
import { checkAchievements } from '../data/badges.js';

const localSheet = new CSSStyleSheet();
localSheet.replaceSync(/*css*/`
  :host { display: block; padding: 20px 28px; animation: fadeIn .3s ease; position: relative; }

  .flee-btn {
    margin-left: auto;
    background: none; border: 2px solid #ddd; border-radius: 8px;
    padding: 6px 12px; font-family: 'Press Start 2P', monospace;
    font-size: 9px; color: #757575; cursor: pointer;
  }
  .flee-btn:active { color: var(--poke-red); border-color: var(--poke-red); }

  .battle-menu { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; }
  .battle-category {
    background: #fff; border-radius: var(--radius, 16px); padding: 20px;
    border: 3px solid; cursor: pointer; box-shadow: var(--shadow);
    display: flex; align-items: center; gap: 16px;
    transition: transform .15s, box-shadow .15s;
  }
  .battle-category:active { transform: scale(.97); }
  .battle-category[data-type="fire"] { border-color: var(--fire); }
  .battle-category[data-type="water"] { border-color: var(--water); }
  .battle-category[data-type="grass"] { border-color: var(--grass); }
  .battle-category[data-type="electric"] { border-color: var(--electric); }
  .battle-cat-icon { flex-shrink: 0; line-height: 0; display: flex; align-items: center; justify-content: center; width: 40px; }
  .battle-cat-icon img { image-rendering: pixelated; }
  .battle-cat-info { flex: 1; }
  .battle-cat-info h3 { font-family: 'Press Start 2P', monospace; font-size: 9px; margin-bottom: 6px; }
  .battle-cat-info p { font-size: 12px; color: #666; }
  .battle-cat-badge {
    width: 40px; height: 40px; border-radius: 50%; background: #eee;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    line-height: 0;
  }
  .battle-cat-badge img { image-rendering: pixelated; }
  .battle-cat-badge.earned { background: var(--poke-yellow); box-shadow: 0 0 12px rgba(245,200,66,.5); }

  /* Badge Case */
  .badge-case {
    background: linear-gradient(135deg, #3a3a6e, var(--poke-dark, #2C2C54));
    border-radius: var(--radius, 16px); padding: 20px 20px 40px; margin-bottom: 20px; box-shadow: var(--shadow);
  }
  .badge-case h3 {
    font-family: 'Press Start 2P', monospace; font-size: 9px;
    color: var(--poke-yellow); margin-bottom: 16px; text-align: center;
  }
  .badge-slots { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }

  /* Battle Active */
  .battle-screen { display: none; animation: fadeIn .3s ease; }
  .battle-screen.active { display: block; }

  .battle-encounter { text-align: center; padding: 30px 20px; }
  .encounter-title {
    font-family: 'Press Start 2P', monospace; font-size: 12px;
    margin-bottom: 16px; line-height: 1.6;
  }

  .progress-info {
    display: flex; align-items: center; gap: 12px;
    font-family: 'Press Start 2P', monospace; font-size: 9px; color: #666; margin-bottom: 6px;
  }
  .battle-hp {
    background: #333; border-radius: 20px; height: 10px; margin: 12px 0; overflow: hidden;
    border: 2px solid var(--poke-dark, #2C2C54);
  }
  .battle-hp-fill {
    height: 100%; border-radius: 20px; transition: width .4s ease;
    background: linear-gradient(90deg, var(--poke-red, #E3350D), #ff6b6b);
  }
  .battle-hp-fill.high { background: linear-gradient(90deg, var(--matcha, #8DB580), #6dd670); }
  .battle-hp-fill.mid { background: linear-gradient(90deg, var(--poke-yellow, #FFCB05), #ffe066); }

  .streak-indicator {
    font-family: 'Press Start 2P', monospace; font-size: 8px; text-align: center;
    color: var(--poke-yellow); margin: 8px 0; min-height: 16px;
  }
  .streak-indicator.on { text-shadow: 0 0 10px rgba(245,200,66,.5); }

  .battle-question {
    background: #fff; border-radius: var(--radius, 16px); padding: 24px 20px; margin: 16px 0;
    box-shadow: var(--shadow); border: 3px solid var(--poke-dark, #2C2C54);
    min-height: 100px; display: flex; align-items: center; justify-content: center; flex-direction: column;
  }
  .question-label { font-family: 'Press Start 2P', monospace; font-size: 9px; color: #757575; margin-bottom: 12px; }
  .question-text { font-size: 18px; font-weight: 700; text-align: center; line-height: 1.4; }
  .question-kanji { font-size: 64px; margin: 8px 0; }
  .question-sub { font-size: 13px; color: #666; margin-top: 4px; }

  .battle-options { display: flex; flex-direction: column; gap: 10px; margin: 12px 0; }
  .battle-opt {
    background: #fff; border: 3px solid #ddd; border-radius: 12px; padding: 14px 18px;
    font-size: 15px; font-weight: 600; cursor: pointer; transition: all .15s;
    text-align: left; font-family: 'Quicksand', sans-serif;
  }
  .battle-opt:active { transform: scale(.97); }
  .battle-opt.correct { border-color: var(--matcha, #8DB580); background: #e8f5e9; }
  .battle-opt.wrong { border-color: var(--poke-red, #E3350D); background: #ffebee; }

  .tf-options { display: flex; gap: 12px; margin: 12px 0; }
  .tf-btn {
    flex: 1; padding: 18px; border-radius: 12px; border: 3px solid;
    font-family: 'Press Start 2P', monospace; font-size: 11px; cursor: pointer; transition: all .15s;
  }
  .tf-btn.true-btn { border-color: var(--matcha, #8DB580); background: var(--grass-bg); color: var(--grass); }
  .tf-btn.false-btn { border-color: var(--poke-red, #E3350D); background: #ffebee; color: var(--poke-red, #E3350D); }
  .tf-btn:active { transform: scale(.95); }
  .tf-btn.correct { border-width: 4px; }
  .tf-btn.wrong { opacity: .5; }

  /* Results */
  .results-screen { text-align: center; padding: 20px; }
  .results-pokeball { font-size: 60px; margin: 10px 0; }
  .results-title { font-family: 'Press Start 2P', monospace; font-size: 14px; margin: 12px 0; line-height: 1.6; }
  .results-stats {
    background: #fff; border-radius: var(--radius, 16px); padding: 20px; margin: 16px 0;
    border: 3px solid var(--poke-dark, #2C2C54); box-shadow: var(--shadow); text-align: left;
  }
  .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
  .stat-row:last-child { border: none; }
  .stat-label { color: #666; }
  .stat-value { font-weight: 700; }
  .results-rank {
    font-family: 'Press Start 2P', monospace; font-size: 10px;
    padding: 12px 20px; border-radius: 12px; display: inline-block; margin: 12px 0; line-height: 1.6;
  }
  .results-rank.master { background: linear-gradient(135deg, var(--poke-yellow), #FFE066); color: var(--poke-dark); }
  .results-rank.ace { background: linear-gradient(135deg, var(--sakura, #FFB7C5), #FFD4E0); color: var(--poke-dark); }
  .results-rank.trainer { background: linear-gradient(135deg, var(--water-bg), #d0e8ff); color: var(--water); }
  .results-rank.youngster { background: var(--cream-dark, #F5E6D3); color: #666; }
  .new-badge-text { font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--poke-yellow); margin: 8px 0; }

  /* Combo */
  .combo-display {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 200; pointer-events: none; font-family: 'Press Start 2P', monospace;
    text-shadow: 3px 3px 0 rgba(0,0,0,.2);
    animation: comboFlash .8s ease forwards;
  }
  @keyframes comboFlash {
    0% { opacity: 0; transform: translate(-50%,-50%) scale(.5); }
    30% { opacity: 1; transform: translate(-50%,-50%) scale(1.3); }
    70% { opacity: 1; transform: translate(-50%,-50%) scale(1.1); }
    100% { opacity: 0; transform: translate(-50%,-60%) scale(1); }
  }

  /* Pokeball anim */
  .pokeball-anim {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 200; pointer-events: none;
  }
  .pokeball-svg { width: 80px; height: 80px; }
  .pokeball-anim.catching .pokeball-svg { animation: pokeShake 1.8s ease forwards; }
  .pokeball-anim.caught .pokeball-svg { animation: pokeCatch .4s ease forwards; }
  .pokeball-anim.fled { animation: pokeFlee .6s ease forwards; }
  @keyframes pokeShake {
    0% { transform: translateY(-60px); }
    15% { transform: translateY(0); }
    25% { transform: rotate(-20deg); }
    35% { transform: rotate(20deg); }
    45% { transform: rotate(-15deg); }
    55% { transform: rotate(15deg); }
    65% { transform: rotate(-8deg); }
    75% { transform: rotate(0deg); }
    100% { transform: rotate(0deg) scale(1); }
  }
  @keyframes pokeCatch {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(0); opacity: 0; }
  }
  @keyframes pokeFlee {
    0% { opacity: 1; transform: translate(-50%,-50%); }
    100% { opacity: 0; transform: translate(-50%,-100%) scale(0.3); }
  }
`);

class ScreenBattle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [sharedStyles, localSheet];
    this._quiz = null;
  }

  connectedCallback() {
    this._renderMenu();
  }

  _renderMenu() {
    const state = getState();
    this.shadowRoot.innerHTML = /*html*/`
      <div class="badge-case">
        <h3>${sprite('icon-gym-badge', 14)} GYM BADGES</h3>
        <div class="badge-slots">
          ${['fire', 'water', 'grass', 'electric'].map(t => `
            <div class="badge-slot ${state.badges[t] ? 'earned' : ''}" data-badge="${t}">
              <span class="badge-icon">${sprite('type-' + t, 28)}</span>
              <span class="badge-label">${{ fire: 'PHRASES', water: 'KANJI', grass: 'ETIQUETTE', electric: 'KANSAI' }[t]}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="battle-menu" id="battle-categories">
        ${BATTLE_CATS.map(c => `
          <div class="battle-category" data-type="${c.type}">
            <div class="battle-cat-icon">${c.icon}</div>
            <div class="battle-cat-info">
              <h3>${c.name}</h3>
              <p>${c.desc}${state.highScores[c.type] ? ` — Best: ${state.highScores[c.type]}/10` : ''}</p>
            </div>
            <div class="battle-cat-badge ${state.badges[c.type] ? 'earned' : ''}">${state.badges[c.type] ? sprite('icon-star', 28) : sprite('icon-lock', 28)}</div>
          </div>
        `).join('')}
      </div>
      <div class="battle-screen" id="battle-active"></div>
      <div class="battle-screen" id="battle-results"></div>
    `;

    // Bind category clicks
    this.shadowRoot.querySelectorAll('.battle-category').forEach(el => {
      el.addEventListener('click', () => this._startBattle(el.dataset.type));
    });
  }

  _startBattle(type) {
    const cat = BATTLE_CATS.find(c => c.type === type);
    let questions;
    if (type === 'fire') questions = shuffle(buildPhraseQuestions()).slice(0, 10);
    else if (type === 'water') questions = shuffle(buildKanjiQuestions()).slice(0, 10);
    else if (type === 'grass') questions = shuffle(buildEtiquetteQuestions()).slice(0, 10);
    else questions = shuffle(buildKansaiQuestions()).slice(0, 10);

    this._quiz = { type, cat, questions, current: 0, score: 0, combo: 0, bestCombo: 0, answered: false };

    // Hide menu, show battle
    this.shadowRoot.querySelector('.badge-case').style.display = 'none';
    this.shadowRoot.getElementById('battle-categories').style.display = 'none';
    this.shadowRoot.getElementById('battle-results').classList.remove('active');

    const screen = this.shadowRoot.getElementById('battle-active');
    screen.classList.add('active');

    this._showEncounterIntro(screen);
  }

  _showEncounterIntro(screen) {
    sfx('battle-encounter');
    screen.innerHTML = `
      <div class="battle-encounter">
        <div style="margin-bottom:16px">${sprite('type-' + this._quiz.type, 80)}</div>
        <div class="encounter-title">${this._quiz.cat.questionLabel}</div>
        <button class="btn-primary" id="fight-btn">FIGHT!</button>
      </div>
    `;
    screen.querySelector('#fight-btn').addEventListener('click', () => this._renderQuestion());
  }

  _renderQuestion() {
    if (!this._quiz || this._quiz.current >= this._quiz.questions.length) { this._showResults(); return; }

    const q = this._quiz.questions[this._quiz.current];
    const screen = this.shadowRoot.getElementById('battle-active');
    const progress = (this._quiz.current / this._quiz.questions.length) * 100;
    const hpClass = progress < 40 ? 'high' : progress < 70 ? 'mid' : '';

    this._quiz.answered = false;

    let html = `
      <div class="progress-info">
        <span>${this._quiz.current + 1} / ${this._quiz.questions.length}</span>
        <span>Score: ${this._quiz.score}</span>
        <button class="flee-btn" id="flee-btn">RUN 💨</button>
      </div>
      <div class="battle-hp"><div class="battle-hp-fill ${hpClass}" style="width:${100 - progress}%"></div></div>
      <div class="streak-indicator ${this._quiz.combo >= 3 ? 'on' : ''}">
        ${this._quiz.combo >= 3 ? `${sprite('type-fire', 10)} Catch Combo x${this._quiz.combo}!` : ''}
      </div>
    `;

    if (q.type === 'tf') {
      html += `
        <div class="battle-question">
          <div class="question-label">TRUE OR FALSE?</div>
          <div class="question-text">${q.statement}</div>
        </div>
        <div class="tf-options">
          <button class="tf-btn true-btn" data-answer="true">TRUE</button>
          <button class="tf-btn false-btn" data-answer="false">FALSE</button>
        </div>
      `;
    } else if (q.type === 'kanji') {
      const options = this._generateOptions(q.answer, q.pool, 4);
      html += `
        <div class="battle-question">
          <div class="question-label">WHAT DOES THIS MEAN?</div>
          <div class="question-kanji">${q.question}</div>
          <div class="question-sub">${q.questionSub || ''}</div>
        </div>
        <div class="battle-options">
          ${options.map(o => `<button class="battle-opt" data-answer="${this._escapeAttr(o)}" data-correct="${this._escapeAttr(q.answer)}">${o}</button>`).join('')}
        </div>
      `;
    } else {
      const options = this._generateOptions(q.answer, q.pool, 4);
      html += `
        <div class="battle-question">
          <div class="question-label">CHOOSE THE CORRECT ANSWER</div>
          <div class="question-text">${q.question}</div>
          ${q.questionSub ? `<div class="question-sub">${q.questionSub}</div>` : ''}
        </div>
        <div class="battle-options">
          ${options.map(o => `<button class="battle-opt" data-answer="${this._escapeAttr(o)}" data-correct="${this._escapeAttr(q.answer)}">${o}</button>`).join('')}
        </div>
      `;
    }

    screen.innerHTML = html;

    // Bind flee button
    screen.querySelector('#flee-btn')?.addEventListener('click', () => {
      bus.emit('hide-dialogue');
      this._renderMenu();
    });

    // Bind answer handlers
    screen.querySelectorAll('.battle-opt').forEach(btn => {
      btn.addEventListener('click', () => this._answerChoice(btn));
    });
    screen.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => this._answerTF(btn.dataset.answer === 'true'));
    });
  }

  _answerChoice(btn) {
    if (this._quiz.answered) return;
    this._quiz.answered = true;

    const selected = btn.dataset.answer;
    const correct = btn.dataset.correct;
    const isCorrect = selected === correct;

    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) {
      this.shadowRoot.querySelectorAll('.battle-opt').forEach(b => {
        if (b.dataset.answer === correct) b.classList.add('correct');
      });
    }
    this._handleAnswer(isCorrect);
  }

  _answerTF(answer) {
    if (this._quiz.answered) return;
    this._quiz.answered = true;

    const q = this._quiz.questions[this._quiz.current];
    const isCorrect = answer === q.correct;

    const trueBtn = this.shadowRoot.querySelector('.true-btn');
    const falseBtn = this.shadowRoot.querySelector('.false-btn');

    if (answer) {
      trueBtn.classList.add(isCorrect ? 'correct' : 'wrong');
      if (!isCorrect) falseBtn.classList.add('correct');
    } else {
      falseBtn.classList.add(isCorrect ? 'correct' : 'wrong');
      if (!isCorrect) trueBtn.classList.add('correct');
    }
    this._handleAnswer(isCorrect, q.explanation);
  }

  _handleAnswer(isCorrect, explanation) {
    const state = getState();

    if (isCorrect) {
      sfx('battle-correct');
      this._quiz.score++;
      this._quiz.combo++;
      if (this._quiz.combo > this._quiz.bestCombo) this._quiz.bestCombo = this._quiz.combo;
      state.totalCatches++;

      this._showPokeballCatch();

      if (this._quiz.combo === 3) { sfx('battle-combo-nice'); this._showCombo('Nice!', 'var(--poke-yellow)', '18px'); }
      else if (this._quiz.combo === 5) { sfx('battle-combo-great'); this._showCombo('Great!', 'var(--fire)', '22px'); }
      else if (this._quiz.combo === 7) { sfx('battle-combo-excellent'); this._showCombo('Excellent!', 'var(--poke-red)', '26px'); }
      else if (this._quiz.combo >= 10) { sfx('battle-combo-master'); this._showCombo('MASTER!', 'var(--poke-yellow)', '30px'); }

      bus.emit('show-dialogue', { text: explanation || 'Gotcha! ⭐ Caught successfully!', autoHide: 3000 });
    } else {
      sfx('battle-wrong');
      this._quiz.combo = 0;
      this._showFlee();
      bus.emit('show-dialogue', { text: explanation || 'Oh no, it fled! 💨', autoHide: 3000 });
    }

    setTimeout(() => {
      this._quiz.current++;
      bus.emit('hide-dialogue');
      this._renderQuestion();
    }, 3500);
  }

  _showPokeballCatch() {
    const el = document.createElement('div');
    el.className = 'pokeball-anim catching';
    el.innerHTML = `<svg class="pokeball-svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#333" stroke-width="4"/>
      <path d="M4 50 H96" stroke="#333" stroke-width="4"/>
      <path d="M4 50 A46 46 0 0 0 96 50" fill="#E3350D"/>
      <circle cx="50" cy="50" r="12" fill="#fff" stroke="#333" stroke-width="4"/>
      <circle cx="50" cy="50" r="6" fill="#fff" stroke="#333" stroke-width="2"/>
    </svg>`;
    this.shadowRoot.appendChild(el);
    setTimeout(() => { el.classList.remove('catching'); el.classList.add('caught'); }, 1600);
    setTimeout(() => el.remove(), 2200);
  }

  _showFlee() {
    const el = document.createElement('div');
    el.className = 'pokeball-anim fled';
    el.innerHTML = '<div style="font-size:60px">💨</div>';
    this.shadowRoot.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  _showCombo(text, color, size) {
    const el = document.createElement('div');
    el.className = 'combo-display';
    el.style.color = color;
    el.style.fontSize = size;
    el.textContent = text;
    this.shadowRoot.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  _showResults() {
    const state = getState();
    const screen = this.shadowRoot.getElementById('battle-active');
    screen.classList.remove('active');
    const results = this.shadowRoot.getElementById('battle-results');
    results.classList.add('active');

    const s = this._quiz.score;
    const total = this._quiz.questions.length;
    const type = this._quiz.type;

    // Update state
    const earnedNewBadge = s >= 7 && !state.badges[type];
    if (s > state.highScores[type]) state.highScores[type] = s;
    if (this._quiz.bestCombo > state.bestCombos[type]) state.bestCombos[type] = this._quiz.bestCombo;
    if (this._quiz.bestCombo > state.bestComboEver) state.bestComboEver = this._quiz.bestCombo;
    if (s >= 7) state.badges[type] = true;
    state.totalQuizzes++;

    let rank, rankClass, emoji;
    if (s === 10) { rank = "Pokémon Master!"; rankClass = "master"; emoji = sprite('badge-champion', 60); }
    else if (s >= 7) { rank = "Ace Trainer!"; rankClass = "ace"; emoji = sprite('icon-star', 60); }
    else if (s >= 4) { rank = "Pokémon Trainer!"; rankClass = "trainer"; emoji = "💪"; }
    else { rank = "Youngster — Ganbatte!"; rankClass = "youngster"; emoji = "📖"; }

    if (s === 10) sfx('battle-results-master');
    else if (s >= 7) sfx('battle-results-ace');
    else if (s >= 4) sfx('battle-results-trainer');
    else sfx('battle-results-youngster');

    results.innerHTML = `
      <div class="results-screen">
        <div class="results-pokeball">${emoji}</div>
        <div class="results-title">${rank}</div>
        ${earnedNewBadge ? `<div class="new-badge-text">${sprite('icon-gym-badge', 12)} NEW BADGE EARNED!</div>` : ''}
        <div class="results-rank ${rankClass}">
          ${s === 10 ? "You're ready for Japan! 🌸" : s >= 7 ? "Almost there, keep it up!" : s >= 4 ? "Keep practicing! You got this!" : "Study more and try again!"}
        </div>
        <div class="results-stats">
          <div class="stat-row"><span class="stat-label">Caught</span><span class="stat-value">${s} / ${total}</span></div>
          <div class="stat-row"><span class="stat-label">Catch Rate</span><span class="stat-value">${Math.round(s / total * 100)}%</span></div>
          <div class="stat-row"><span class="stat-label">Best Combo</span><span class="stat-value">x${this._quiz.bestCombo}</span></div>
          <div class="stat-row"><span class="stat-label">High Score</span><span class="stat-value">${state.highScores[type]} / ${total}</span></div>
        </div>
        <div style="margin-top:16px">
          <button class="btn-primary" id="retry-btn">RETRY</button>
          <button class="btn-secondary" id="back-btn">BACK</button>
        </div>
      </div>
    `;

    results.querySelector('#retry-btn').addEventListener('click', () => this._startBattle(type));
    results.querySelector('#back-btn').addEventListener('click', () => this._renderMenu());

    if (earnedNewBadge) {
      bus.emit('badge-earned', { badge: type });
    }

    // Quiz-specific achievements
    const ach = { ...state.achievements };
    let achChanged = false;
    if (s === 10 && !ach.perfectQuiz) {
      ach.perfectQuiz = true; achChanged = true;
      bus.emit('badge-earned', { badge: 'perfectQuiz' });
    }
    if (this._quiz.bestCombo >= 7 && !ach.comboKing) {
      ach.comboKing = true; achChanged = true;
      bus.emit('badge-earned', { badge: 'comboKing' });
    }
    if (achChanged) state.achievements = ach;

    // Run centralized check (catches quizMaster if all 4 badges now earned)
    const newlyEarned = checkAchievements(state);
    for (const key of newlyEarned) {
      bus.emit('badge-earned', { badge: key });
    }
  }

  _generateOptions(correct, pool, count) {
    const options = new Set([correct]);
    const available = pool.filter(x => x !== correct);
    const shuffled = shuffle([...available]);
    while (options.size < count && shuffled.length) {
      options.add(shuffled.pop());
    }
    return shuffle([...options]);
  }

  _escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('screen-battle', ScreenBattle);
