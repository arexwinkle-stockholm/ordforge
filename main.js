import { RIVSTART_CHAPTERS } from './data.js';

const ALL_CARDS = RIVSTART_CHAPTERS.flatMap(ch => ch.cards);

const stage = document.querySelector('#stage');
const muteBtn = document.querySelector('#mute-btn');
const brandHome = document.querySelector('#brand-home');
const music = new Audio('assets/audio/guild-workshop-theme.mp3');
const openSound = new Audio('assets/audio/lock-open.mp3');
const strainSound = new Audio('assets/audio/pick-strain.mp3');
music.loop = true; music.volume = .18; openSound.volume = .65; strainSound.volume = .48;
let muted = false, audioStarted = false, audioCtx;

const state = {
  phase: 'chapterSelect', deck: [], deckLabel: '', chapterNum: null,
  assessment: [], assessmentIndex: 0, results: [], weak: [], queue: [], current: null,
  locks: 0, streak: 0, bestStreak: 0, attempts: 0, mastery: new Map(),
  targetAngle: 0, pickAngle: 0, turn: 0, durability: 100, turning: false, raf: 0
};

// ---------- persistence ----------
const PROGRESS_KEY = 'ordforge_progress_v1';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || { wordMastery: {}, chaptersCompleted: {} }; }
  catch { return { wordMastery: {}, chaptersCompleted: {} }; }
}
function saveProgress() { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); }
let progress = loadProgress();

function chapterStats(cards) {
  const total = cards.length;
  const known = cards.filter(c => (progress.wordMastery[c.sv] || 0) >= 2).length;
  return { total, known, pct: total ? Math.round(known / total * 100) : 0 };
}

// ---------- audio ----------
function log(name, data = {}) { /* progress-only game, no external logger */ }
function shuffle(a) { return [...a].sort(() => Math.random() - .5) }
function choicesFor(card, pool) { return shuffle([card.en, ...shuffle(pool.filter(c => c !== card)).slice(0, 3).map(c => c.en)]); }
function procedural(freq = 520, dur = .08, type = 'sine') {
  if (muted) return; audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(.045, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + dur); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
}
function startAudio() { if (audioStarted) return; audioStarted = true; if (!muted) music.play().catch(() => {}); }
document.addEventListener('pointerdown', startAudio, { once: true });
document.addEventListener('keydown', startAudio, { once: true });
muteBtn.addEventListener('click', () => { muted = !muted; muteBtn.textContent = muted ? '×' : '♪'; music.muted = muted; openSound.muted = muted; strainSound.muted = muted; if (!muted && audioStarted) music.play().catch(() => {}); });
function play(audio) { if (!muted) { audio.currentTime = 0; audio.play().catch(() => {}); } }
function toast(msg) { const el = document.querySelector('#toast'); el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1700) }
function setJourney(step) { const order = ['assessment', 'training', 'mastery']; document.querySelectorAll('.journey-step').forEach(el => { const i = order.indexOf(el.dataset.step), s = order.indexOf(step); el.classList.toggle('active', i === s); el.classList.toggle('done', i < s) }); }

brandHome.addEventListener('click', () => { cancelAnimationFrame(state.raf); renderChapterSelect(); });

// ---------- chapter select ----------
function renderChapterSelect() {
  state.phase = 'chapterSelect';
  setJourney('assessment');
  const allStats = chapterStats(ALL_CARDS);
  const tiles = RIVSTART_CHAPTERS.map(ch => {
    const s = chapterStats(ch.cards);
    return `<button class="chapter-tile" data-chapter="${ch.chapter}">
      <span class="chapter-num">Ch. ${ch.chapter}</span>
      <span class="chapter-count">${ch.cards.length} words</span>
      <div class="progress-track mini"><div class="progress-fill" style="width:${s.pct}%"></div></div>
      <span class="chapter-pct">${s.pct}% mastered</span>
    </button>`;
  }).join('');
  stage.innerHTML = `<section class="panel chapter-select">
    <p class="eyebrow">Rivstart A1/A2 • Ordkort</p>
    <h1>Choose your trial</h1>
    <p class="lead">Pick a chapter to forge your practice, or draw from every seal the Guild has cataloged.</p>
    <button class="chapter-tile all-chapters" id="all-chapters">
      <span class="chapter-num">All Chapters</span>
      <span class="chapter-count">${ALL_CARDS.length} words</span>
      <div class="progress-track mini"><div class="progress-fill" style="width:${allStats.pct}%"></div></div>
      <span class="chapter-pct">${allStats.pct}% mastered</span>
    </button>
    <div class="chapter-grid">${tiles}</div>
    <button class="secondary" id="reset-progress">Reset all progress</button>
  </section>`;
  document.querySelectorAll('.chapter-tile[data-chapter]').forEach(b => b.onclick = () => selectDeck(Number(b.dataset.chapter)));
  document.querySelector('#all-chapters').onclick = () => selectDeck('all');
  document.querySelector('#reset-progress').onclick = () => {
    if (confirm('Reset all saved chapter progress? This cannot be undone.')) { progress = { wordMastery: {}, chaptersCompleted: {} }; saveProgress(); renderChapterSelect(); }
  };
}
function selectDeck(chapterNumOrAll) {
  if (chapterNumOrAll === 'all') { state.deck = ALL_CARDS; state.deckLabel = 'All Chapters'; state.chapterNum = 'all'; }
  else { const ch = RIVSTART_CHAPTERS.find(c => c.chapter === chapterNumOrAll); state.deck = ch.cards; state.deckLabel = `Chapter ${ch.chapter}`; state.chapterNum = ch.chapter; }
  renderWelcome();
}

// ---------- welcome / assessment ----------
function renderWelcome() {
  setJourney('assessment');
  stage.innerHTML = `<section class="panel intro"><div><p class="eyebrow">${state.deckLabel} • ${state.deck.length} words</p><h1>The Locksmith's Trial</h1><p class="lead">Every Swedish word sets a tumbler. First, the Guild will test what you already know. Then we'll forge your practice around the words that need it most.</p><div class="rules"><div class="rule"><strong>Reveal your level</strong><span>8 quick vocabulary seals</span></div><div class="rule"><strong>Train by doing</strong><span>Recall words, then work the lock</span></div><div class="rule"><strong>Earn mastery</strong><span>Open 5 locks to complete the trial</span></div></div><button class="primary wide" id="begin">Begin assessment</button> <button class="secondary" id="back-to-chapters">Choose a different chapter</button></div><img class="intro-crest" src="assets/guild-crest.webp" alt="Locksmith guild crest"></section>`;
  document.querySelector('#begin').onclick = startAssessment;
  document.querySelector('#back-to-chapters').onclick = renderChapterSelect;
}
function startAssessment() { state.phase = 'assessment'; state.assessment = shuffle(state.deck).slice(0, Math.min(8, state.deck.length)); state.assessmentIndex = 0; state.results = []; log('assessment_started', { cards: state.assessment.length }); renderAssessment(); }
function renderAssessment() {
  const total = state.assessment.length, card = state.assessment[state.assessmentIndex], n = state.assessmentIndex;
  stage.innerHTML = `<section class="panel"><div class="assessment-head"><div><p class="eyebrow">Guild Evaluation</p><h2>Read the inscription</h2></div><div class="runes">${state.assessment.map((_, i) => `<div class="rune ${i < n ? (state.results[i] ? 'good' : 'bad') : ''}"><span>${i + 1}</span></div>`).join('')}</div></div><div class="progress-track"><div class="progress-fill" style="width:${n / total * 100}%"></div></div><div class="prompt-card"><small>Choose the English meaning</small><div class="swedish">${card.sv}</div><div class="answers">${choicesFor(card, state.deck).map((a, i) => `<button class="answer" data-answer="${a}"><em>${String.fromCharCode(65 + i)}</em>${a}</button>`).join('')}</div><div class="feedback">Trust your first instinct — this sets your training path.</div></div><div class="counter">SEAL ${n + 1} / ${total}</div></section>`;
  document.querySelectorAll('.answer').forEach(b => b.onclick = () => answerAssessment(b, card));
}
function answerAssessment(button, card) {
  const right = button.dataset.answer === card.en; state.results.push(right);
  document.querySelectorAll('.answer').forEach(b => { b.disabled = true; if (b.dataset.answer === card.en) b.classList.add('correct') });
  if (!right) button.classList.add('wrong');
  procedural(right ? 680 : 170, .12, right ? 'sine' : 'sawtooth');
  setTimeout(() => { state.assessmentIndex++; state.assessmentIndex < state.assessment.length ? renderAssessment() : finishAssessment() }, 520);
}
function finishAssessment() {
  const total = state.assessment.length;
  const missed = state.assessment.filter((_, i) => !state.results[i]);
  state.weak = missed.length ? missed : shuffle(state.assessment).slice(0, Math.min(4, total));
  const score = state.results.filter(Boolean).length;
  state.phase = 'result'; log('assessment_completed', { score, total, practiceWords: state.weak.length });
  stage.innerHTML = `<section class="panel assessment-result"><p class="eyebrow">Evaluation Complete</p><h2>${score >= total * .87 ? 'Journeyman instincts' : score >= total * .5 ? 'A promising apprentice' : 'A worthy challenge'}</h2><div class="score-ring"><div><strong>${score}/${total}</strong><br><span>seals aligned</span></div></div><p class="lead" style="margin:auto">The Guild has shaped a rehearsal path from your answers. Missed words will return sooner; known words remain in the rotation.</p><div class="weak-chips">${state.weak.map(c => `<span class="chip">${c.sv} · ${c.en}</span>`).join('')}</div><button id="train" class="primary wide">Enter the lock chamber</button></section>`;
  document.querySelector('#train').onclick = startTraining;
}

// ---------- training / locks ----------
function startTraining() {
  setJourney('training'); state.phase = 'question'; state.queue = [];
  const assessedKnown = shuffle(state.assessment.filter(c => !state.weak.includes(c)));
  const focus = [...state.weak, ...assessedKnown];
  focus.forEach(c => { state.mastery.set(c.sv, progress.wordMastery[c.sv] >= 2 ? 2 : 0); state.queue.push(c) });
  state.locks = 0; state.streak = 0; state.attempts = 0; state.bestStreak = 0;
  nextTrainingCard(); log('training_started', { focusWords: focus.length });
}
function nextTrainingCard() {
  if (state.locks >= 5) { finishGame(); return; }
  state.current = state.queue.shift() || shuffle([...state.mastery.keys()].map(sv => state.deck.find(c => c.sv === sv)))[0];
  state.phase = 'question'; renderTraining();
}
function sidePanel() {
  const overall = state.locks / 5 * 100;
  return `<aside class="side-panel"><p class="eyebrow">${state.deckLabel}</p><h2>Word Ledger</h2><div class="mastery-label"><span>Trial progress</span><strong>${state.locks} / 5 locks</strong></div><div class="progress-track"><div class="progress-fill" style="width:${overall}%"></div></div><div class="word-list">${[...state.mastery.entries()].map(([sv, n]) => `<div class="word-row ${sv === state.current?.sv ? 'active' : ''} ${n >= 2 ? 'mastered' : ''}"><span>${sv}</span><b>${n >= 2 ? '◆' : n === 1 ? '◇' : '·'}</b></div>`).join('')}</div><div class="tip"><strong>INCREMENTAL REHEARSAL</strong><br>Words you miss return after a short interval. Each successful recall strengthens its seal.</div></aside>`;
}
function renderTraining() {
  const card = state.current;
  stage.innerHTML = `<section class="training-layout">${sidePanel()}<div class="lock-panel"><div class="lock-hud"><span>Lock ${state.locks + 1} of 5</span><span>Recall streak <strong>${state.streak}</strong></span></div><div class="training-question"><p class="eyebrow" style="margin-top:56px">Set the first tumbler</p><h2>What does this mean?</h2><div class="prompt-card"><div class="swedish">${card.sv}</div><div class="answers">${choicesFor(card, state.deck).map((a, i) => `<button class="answer" data-answer="${a}"><em>${String.fromCharCode(65 + i)}</em>${a}</button>`).join('')}</div><div class="feedback">A correct recall grants access to the mechanism.</div></div></div></div></section>`;
  document.querySelectorAll('.answer').forEach(b => b.onclick = () => answerTraining(b, card));
}
function answerTraining(button, card) {
  state.attempts++; const right = button.dataset.answer === card.en;
  document.querySelectorAll('.answer').forEach(b => { b.disabled = true; if (b.dataset.answer === card.en) b.classList.add('correct') });
  const feedback = document.querySelector('.feedback');
  if (right) { button.classList.add('correct'); feedback.textContent = 'Tumbler set. The mechanism is exposed.'; feedback.className = 'feedback good'; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak); procedural(740, .1); setTimeout(beginLock, 600); }
  else { button.classList.add('wrong'); feedback.textContent = `Not quite — "${card.sv}" means "${card.en}". It will return soon.`; feedback.className = 'feedback bad'; state.streak = 0; state.queue.splice(Math.min(2, state.queue.length), 0, card); procedural(150, .18, 'sawtooth'); setTimeout(nextTrainingCard, 1500); }
}
function beginLock() {
  state.phase = 'lock'; state.pickAngle = 0; state.targetAngle = -58 + Math.random() * 116; state.turn = 0; state.durability = 100;
  const mastery = state.mastery.get(state.current.sv) || 0;
  stage.innerHTML = `<section class="training-layout">${sidePanel()}<div class="lock-panel"><div class="lock-hud"><span>Lock ${state.locks + 1} of 5</span><span>Pick integrity <strong id="integrity">100%</strong></span></div><div class="mini-card revealed"><small>Recalled inscription</small><strong>${state.current.sv}</strong><div class="translation">${state.current.en}</div></div><div class="lock-wrap" id="lock"><img class="lock-image" src="assets/mastery-lock-face.webp" alt="Ornate practice lock"><div class="core" id="core"><div class="keyway"></div></div><div class="pick" id="pick"></div><div class="torque" id="torque"></div></div><div class="durability"><span>Pick</span><div class="durability-track"><div class="durability-fill" id="durability" style="width:100%"></div></div></div><p class="lock-instruction">Move the <strong>mouse</strong> to angle the pick · Hold <kbd>SPACE</kbd> to turn</p></div></section>`;
  const lock = document.querySelector('#lock');
  lock.addEventListener('pointermove', e => { if (state.turning) return; const r = lock.getBoundingClientRect(); state.pickAngle = Math.max(-72, Math.min(72, ((e.clientX - r.left) / r.width - .5) * 144)); updateLockVisual(); });
  const tolerance = 18 + mastery * 4; state.lockTolerance = tolerance; cancelAnimationFrame(state.raf); state.raf = requestAnimationFrame(lockLoop);
}
function updateLockVisual() { const pick = document.querySelector('#pick'), core = document.querySelector('#core'), torque = document.querySelector('#torque'); if (pick) pick.style.transform = `rotate(${state.pickAngle}deg)`; if (core) core.style.transform = `rotate(${state.turn}deg)`; if (torque) torque.style.transform = `rotate(${-35 + state.turn * .85}deg)`; }
function lockLoop() {
  if (state.phase !== 'lock') return;
  const diff = Math.abs(state.pickAngle - state.targetAngle), quality = Math.max(0, 1 - diff / state.lockTolerance);
  const lock = document.querySelector('#lock');
  if (state.turning) {
    const maxTurn = quality * 96; state.turn = Math.min(maxTurn, state.turn + 1.65);
    if (quality < .72 && state.turn >= maxTurn - 1) { state.durability = Math.max(0, state.durability - .48); lock?.classList.add('shake'); if (Math.random() < .025) procedural(110 + quality * 100, .04, 'square'); }
    else lock?.classList.remove('shake');
    if (state.turn >= 89) { openLock(); return; }
    if (state.durability <= 0) { breakPick(); return; }
  } else { state.turn = Math.max(0, state.turn - 3); lock?.classList.remove('shake'); }
  const d = document.querySelector('#durability'), i = document.querySelector('#integrity');
  if (d) d.style.width = `${state.durability}%`; if (i) i.textContent = `${Math.ceil(state.durability)}%`;
  updateLockVisual(); state.raf = requestAnimationFrame(lockLoop);
}
function openLock() {
  state.phase = 'opening'; state.turning = false; cancelAnimationFrame(state.raf);
  const lock = document.querySelector('#lock'); lock?.classList.remove('shake'); lock?.classList.add('success'); play(openSound);
  const n = (state.mastery.get(state.current.sv) || 0) + 1; state.mastery.set(state.current.sv, n);
  progress.wordMastery[state.current.sv] = Math.max(progress.wordMastery[state.current.sv] || 0, n); saveProgress();
  state.locks++; if (n < 2) state.queue.push(state.current);
  toast(`Seal opened · ${state.current.sv}`); log('lock_opened', { word: state.current.sv, locks: state.locks });
  setTimeout(nextTrainingCard, 1250);
}
function breakPick() {
  state.phase = 'broken'; state.turning = false; cancelAnimationFrame(state.raf); play(strainSound);
  state.streak = 0; state.queue.splice(1, 0, state.current);
  toast('Pick strained — study the angle and try again'); setTimeout(nextTrainingCard, 1400);
}
function finishGame() {
  setJourney('mastery'); state.phase = 'mastery';
  if (state.chapterNum !== null && state.chapterNum !== 'all') { progress.chaptersCompleted[state.chapterNum] = true; saveProgress(); }
  log('trial_completed', { locks: state.locks, bestStreak: state.bestStreak, attempts: state.attempts });
  const known = [...state.mastery.values()].filter(v => v > 0).length;
  stage.innerHTML = `<section class="panel mastery-panel"><p class="eyebrow">Trial Complete • ${state.deckLabel}</p><img class="intro-crest" src="assets/guild-crest.webp" alt="Guild crest"><h1>Locksmith Initiate</h1><p class="lead" style="margin:8px auto">Five seals answered your hand. Your rehearsal path is now tuned, and these words will return at widening intervals.</p><div class="stats"><div class="stat"><strong>5</strong><span>Locks opened</span></div><div class="stat"><strong>${known}</strong><span>Words strengthened</span></div><div class="stat"><strong>${state.bestStreak}</strong><span>Best recall streak</span></div></div><button class="primary wide" id="again">Try this chapter again</button> <button class="secondary" id="pick-another">Choose another chapter</button></section>`;
  document.querySelector('#again').onclick = () => { Object.assign(state, { locks: 0, attempts: 0, bestStreak: 0 }); renderWelcome() };
  document.querySelector('#pick-another').onclick = renderChapterSelect;
}

document.addEventListener('keydown', e => { if (e.code === 'Space' && state.phase === 'lock') { e.preventDefault(); state.turning = true } });
document.addEventListener('keyup', e => { if (e.code === 'Space') { state.turning = false } });

renderChapterSelect();
