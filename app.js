import { levels } from './levels.js';

const STORAGE_KEY = 'challenge_game_v1_progress';
const META_KEY = 'challenge_game_v1_meta';
const APP_VERSION = '1.0.1';
const app = document.getElementById('app');
const LEVEL1_MOTIVATION = 'Сейчас люди стали гиперстимулированы — и просто посидеть без стимула уже достижение. Ты понимаешь, что это только разминка. Но то, что ты можешь сделать это и не сорваться на что-то — уже шаг в правильном направлении.';

const now = () => Date.now();
const createEmpty = () => ({
  currentIndex: 0,
  completed: [],
  answers: {},
  startedAt: now(),
  updatedAt: now(),
  events: []
});
const createMeta = () => ({ devPanelOpen: false, headerTapCount: 0 });

let state = loadState();
let meta = loadMeta();
let timerHandle;
let celebration = null;
let swUpdateAvailable = false;
let waitingWorker = null;

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadMeta() {
  return { ...createMeta(), ...safeParse(localStorage.getItem(META_KEY), {}) };
}

function saveMeta() {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function sanitizeState(input) {
  const base = createEmpty();
  const value = typeof input === 'object' && input ? input : {};
  const currentIndex = Number.isInteger(value.currentIndex) ? Math.max(0, Math.min(value.currentIndex, levels.length)) : 0;
  const completed = Array.isArray(value.completed) ? value.completed.filter((id) => levels.some((lvl) => lvl.id === id)) : [];
  const answers = value.answers && typeof value.answers === 'object' ? value.answers : {};
  const events = Array.isArray(value.events) ? value.events.slice(-500) : [];
  const startedAt = Number.isFinite(value.startedAt) ? value.startedAt : base.startedAt;
  const updatedAt = Number.isFinite(value.updatedAt) ? value.updatedAt : base.updatedAt;
  return { ...base, currentIndex, completed, answers, events, startedAt, updatedAt };
}

function loadState() {
  return sanitizeState(safeParse(localStorage.getItem(STORAGE_KEY), createEmpty()));
}

function saveState() {
  state.updatedAt = now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function track(type, extra = {}) {
  state.events.push({ type, at: now(), level: state.currentIndex, ...extra });
  saveState();
}

function canComplete(level, answer) {
  switch (level.type) {
    case 'action': return !!answer?.pressed;
    case 'timer': return !!answer?.done;
    case 'multi_select': return (answer?.selected?.length || 0) >= level.completion.min;
    case 'single_select': return !!answer?.selected;
    case 'education_quiz': return answer?.selected === level.payload.correct;
    default: return false;
  }
}

function getValidationError(level, answer) {
  if (level.type === 'multi_select' && (answer?.selected?.length || 0) < level.completion.min) {
    return `Нужно выбрать минимум ${level.completion.min}. Сейчас: ${answer?.selected?.length || 0}.`;
  }
  if (level.id === 'lvl3_main_problem' && !answer?.selected) {
    return 'Выбери одну главную проблему, иначе не пойдём дальше.';
  }
  if (level.type === 'education_quiz') {
    if (!answer?.selected) return 'Ответ обязателен: выбери один вариант.';
    if (answer.selected !== level.payload.correct) return 'Неверно. Правильный ответ нужен для прохождения.';
  }
  return '';
}

function getLevelAnswer(level) {
  return state.answers[level.id] || {};
}

function setLevelAnswer(level, answer) {
  state.answers[level.id] = answer;
  saveState();
  render();
}

function showCelebration(level) {
  celebration = {
    id: `${level.id}_${now()}`,
    text: `🔥 ${level.title} пройден`
  };
  if (navigator.vibrate) navigator.vibrate([50, 80, 50]);
  setTimeout(() => {
    celebration = null;
    render();
  }, 1400);
}

function completeLevel(level) {
  if (!state.completed.includes(level.id)) state.completed.push(level.id);
  if (level.index < levels.length - 1) state.currentIndex = level.index + 1;
  else state.currentIndex = levels.length;

  if (level.index === 0) track('activation');
  if (level.index === 1) track('time_to_first_complete', { ms: now() - (state.startedAt || now()) });
  if (level.index === 4) track('completion_lvl5');
  track('level_completed', { id: level.id });

  saveState();
  showCelebration(level);
  render();
}

function resetProgress() {
  const ok = window.confirm('Сбросить весь прогресс и метрики?');
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(META_KEY);
  state = createEmpty();
  meta = createMeta();
  celebration = null;
  render();
}

function exportJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderProgress() {
  const completedCount = state.completed.length;
  const mainProblem = state.answers.lvl3_main_problem?.selected || '—';
  const selectedProblems = state.answers.lvl2_problems?.selected?.length || 0;
  const pct = Math.min(100, Math.round((Math.min(state.currentIndex, 10) / 10) * 100));
  return `
  <section class="panel">
    <div class="row spread">
      <strong data-action="toggle-dev">Level ${Math.min(state.currentIndex, 9)} / 10 · v${APP_VERSION}</strong>
      <button class="ghost" data-action="reset">Сбросить прогресс</button>
    </div>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <small>Главная проблема: ${mainProblem} · Выбрано проблем: ${selectedProblems} · Уровней пройдено: ${completedCount}</small>
    ${swUpdateAvailable ? '<div class="update">Доступно обновление <button data-action="apply-update" class="ghost">Обновить</button></div>' : ''}
  </section>`;
}

function renderDevPanel() {
  if (!meta.devPanelOpen) return '';
  return `<section class="panel"><h3>Dev panel</h3><p>Событий: ${state.events.length}</p><div class="row"><button class="ghost" data-action="export-progress">Export progress</button><button class="ghost" data-action="export-events">Export events</button></div></section>`;
}

function buildFinalSummary() {
  const answers = state.answers;
  const selected = answers.lvl2_problems?.selected || [];
  return `<ul class="summary"><li>Проблемы: ${selected.join(', ') || '—'}</li><li>Главная проблема: ${answers.lvl3_main_problem?.selected || '—'}</li><li>Обязательство 24ч: ${answers.lvl6_commit?.selected || '—'}</li><li>План спасения: ${(answers.lvl7_rescue?.selected || []).join(', ') || '—'}</li><li>Убранный триггер: ${answers.lvl8_trigger?.selected || '—'}</li></ul>`;
}

function renderCompletion() {
  const allDone = state.currentIndex >= levels.length;
  return `<section class="panel center"><h1>${allDone ? 'Забег завершён' : 'Уровень пройден'}</h1><p>${allDone ? 'Финал пройден. Ниже твой summary.' : 'Дави дальше.'}</p>${allDone ? buildFinalSummary() : ''}${allDone ? '<button data-action="reset" class="primary">Сбросить и начать заново</button>' : ''}</section>`;
}

function renderIntroBlock(level) {
  if (level.index !== 0) return '';
  return '<div class="intro-box"><strong>Привет! Ты попал в Моя игра.</strong><p>Это приложение создано, чтобы ты стал лучше. Жми «ПОГНАЛИ» и начинай свою игру!</p></div>';
}

function renderTimerArea(level, answer) {
  const durationSec = level.payload.durationSec;
  const startedAt = answer.startedAt || null;
  const elapsedSec = startedAt ? Math.floor((now() - startedAt) / 1000) : 0;
  const remaining = startedAt ? Math.max(0, durationSec - elapsedSec) : durationSec;
  const running = !!startedAt && !answer.done;

  if (running) {
    clearTimeout(timerHandle);
    timerHandle = setTimeout(render, 250);
  }

  if (running && remaining <= 0) {
    setLevelAnswer(level, { ...answer, done: true, finishedAt: now() });
    return { html: '', message: '', completeLabel: 'ЗАВЕРШИТЬ УРОВЕНЬ' };
  }

  const progress = Math.min(100, Math.floor((elapsedSec / durationSec) * 100));
  const motivationalText = level.index === 1 ? LEVEL1_MOTIVATION.slice(0, Math.floor((LEVEL1_MOTIVATION.length * progress) / 100)) : '';

  return {
    html: `<div class="timer-block"><button class="primary ${running ? 'disabled' : ''}" data-action="start-timer" ${running ? 'disabled' : ''}>${running ? `ОСТАЛОСЬ ${remaining} сек` : level.payload.startLabel}</button><div class="bar"><span style="width:${progress}%"></span></div>${level.index === 1 ? `<p class="timer-text">${motivationalText || '...'}</p>` : ''}</div>`,
    message: running ? 'Таймер идёт. Паузы нет.' : '',
    completeLabel: 'ЗАВЕРШИТЬ УРОВЕНЬ'
  };
}

function renderLevel(level) {
  const answer = getLevelAnswer(level);
  let content = '';
  let message = getValidationError(level, answer);
  let completeLabel = 'Следующий';

  if (level.type === 'action') content = `<button class="primary pulse" data-action="press">${level.payload.buttonLabel}</button>`;
  if (level.type === 'timer') {
    const timerData = renderTimerArea(level, answer);
    content = timerData.html;
    if (!message) message = timerData.message;
    completeLabel = timerData.completeLabel;
  }
  if (level.type === 'multi_select') {
    content = `<div class="options">${level.payload.options.map((o) => `<label class="option"><input type="checkbox" data-value="${o}" ${answer.selected?.includes(o) ? 'checked' : ''}/> ${o}</label>`).join('')}</div>`;
  }
  if (level.type === 'single_select') {
    const opts = level.id === 'lvl3_main_problem' ? (state.answers.lvl2_problems?.selected?.length ? state.answers.lvl2_problems.selected : level.payload.fallback) : level.payload.options;
    content = `<div class="options">${opts.map((o) => `<label class="option"><input type="radio" name="single" data-value="${o}" ${answer.selected === o ? 'checked' : ''}/> ${o}</label>`).join('')}</div>`;
  }
  if (level.type === 'education_quiz') {
    content = `<ul>${level.payload.bullets.map((b) => `<li>${b}</li>`).join('')}</ul><h3>${level.payload.question}</h3><div class="options">${level.payload.options.map((o) => `<label class="option"><input type="radio" name="quiz" data-value="${o}" ${answer.selected === o ? 'checked' : ''}/> ${o}</label>`).join('')}</div>`;
  }

  return `<section class="panel">${renderIntroBlock(level)}<h1>${level.title}</h1><p>${level.subtitle}</p><div class="content">${content}</div>${message ? `<div class="error">${message}</div>` : ''}${canComplete(level, answer) ? `<button class="primary" data-action="complete">${completeLabel}</button>` : ''}</section>`;
}

function renderCelebration() {
  if (!celebration) return '';
  return `<div class="celebration"><div class="flame">🔥</div><div class="cele-text">Уровень пройден</div></div>`;
}

function maybeToggleDevPanel() {
  meta.headerTapCount += 1;
  if (meta.headerTapCount >= 5) {
    meta.devPanelOpen = !meta.devPanelOpen;
    meta.headerTapCount = 0;
    saveMeta();
    render();
  }
}

function wireSwUpdates() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`);
    if (reg.waiting) {
      swUpdateAvailable = true;
      waitingWorker = reg.waiting;
      render();
    }
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          swUpdateAvailable = true;
          waitingWorker = newWorker;
          render();
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  });
}

function render() {
  const level = levels[state.currentIndex];
  app.innerHTML = `<div class="shell">${renderProgress()}${renderDevPanel()}${level ? renderLevel(level) : renderCompletion()}${renderCelebration()}</div>`;

  app.querySelector('[data-action="reset"]')?.addEventListener('click', resetProgress);
  app.querySelector('[data-action="toggle-dev"]')?.addEventListener('click', maybeToggleDevPanel);
  app.querySelector('[data-action="export-progress"]')?.addEventListener('click', () => exportJson('progress', state));
  app.querySelector('[data-action="export-events"]')?.addEventListener('click', () => exportJson('events', state.events));
  app.querySelector('[data-action="apply-update"]')?.addEventListener('click', () => waitingWorker?.postMessage('SKIP_WAITING'));

  if (!level) return;

  app.querySelector('[data-action="press"]')?.addEventListener('click', () => setLevelAnswer(level, { pressed: true, at: now() }));
  app.querySelector('[data-action="start-timer"]')?.addEventListener('click', () => {
    if (getLevelAnswer(level).startedAt) return;
    track('timer_started', { id: level.id, duration: level.payload.durationSec });
    setLevelAnswer(level, { startedAt: now(), done: false });
  });

  app.querySelectorAll('input[type="checkbox"]').forEach((el) => el.addEventListener('change', () => {
    const selected = [...app.querySelectorAll('input[type="checkbox"]:checked')].map((n) => n.dataset.value);
    setLevelAnswer(level, { selected });
  }));
  app.querySelectorAll('input[type="radio"]').forEach((el) => el.addEventListener('change', (e) => setLevelAnswer(level, { selected: e.target.dataset.value })));
  app.querySelector('[data-action="complete"]')?.addEventListener('click', () => canComplete(level, getLevelAnswer(level)) && completeLevel(level));
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') track('backgrounded');
});

wireSwUpdates();
render();
