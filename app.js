import { levels } from './levels.js';

const STORAGE_KEY = 'challenge_game_v1_progress';
const app = document.getElementById('app');

const now = () => Date.now();
const createEmpty = () => ({
  currentIndex: 0,
  completed: [],
  answers: {},
  startedAt: now(),
  updatedAt: now(),
  events: []
});

let state = loadState();
let timerHandle;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmpty();
    const parsed = JSON.parse(raw);
    return { ...createEmpty(), ...parsed };
  } catch {
    return createEmpty();
  }
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

function getLevelAnswer(level) {
  return state.answers[level.id] || {};
}

function setLevelAnswer(level, answer) {
  state.answers[level.id] = answer;
  saveState();
  render();
}

function completeLevel(level) {
  if (!state.completed.includes(level.id)) state.completed.push(level.id);
  if (level.index < levels.length - 1) state.currentIndex = level.index + 1;
  else state.currentIndex = levels.length;

  if (level.index === 0) track('activation');
  if (level.index === 1) {
    const started = state.startedAt || now();
    track('time_to_first_complete', { ms: now() - started });
  }
  if (level.index === 4) track('completion_lvl5');

  track('level_completed', { id: level.id });
  if (navigator.vibrate) navigator.vibrate(60);
  saveState();
  render();
}

function resetProgress() {
  const ok = window.confirm('Сбросить весь прогресс?');
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = createEmpty();
  render();
}

function renderProgress() {
  const completedCount = state.completed.length;
  const mainProblem = state.answers.lvl3_main_problem?.selected || '—';
  const selectedProblems = state.answers.lvl2_problems?.selected?.length || 0;
  const pct = Math.min(100, Math.round((Math.min(state.currentIndex, 10) / 10) * 100));
  return `
  <section class="panel">
    <div class="row spread"><strong>Level ${Math.min(state.currentIndex, 9)} / 10</strong><button class="ghost" data-action="reset">Сбросить прогресс</button></div>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <small>Главная проблема: ${mainProblem} · Выбрано проблем: ${selectedProblems} · Уровней пройдено: ${completedCount}</small>
  </section>`;
}

function renderCompletion() {
  const allDone = state.currentIndex >= levels.length;
  return `<section class="panel center"><h1>${allDone ? 'Забег завершён' : 'Уровень пройден'}</h1><p>${allDone ? 'Ожидай новых уровней.' : 'Дави дальше.'}</p>${allDone ? '<button data-action="reset" class="primary">Сбросить и начать заново</button>' : ''}</section>`;
}

function renderLevel(level) {
  const answer = getLevelAnswer(level);
  let content = '';
  let message = '';
  if (level.type === 'action') {
    content = `<button class="primary pulse" data-action="press">${level.payload.buttonLabel}</button>`;
  }
  if (level.type === 'timer') {
    const remaining = answer.endAt ? Math.max(0, Math.ceil((answer.endAt - now()) / 1000)) : level.payload.durationSec;
    const running = !!answer.endAt && remaining > 0;
    if (running) {
      clearTimeout(timerHandle);
      timerHandle = setTimeout(render, 250);
    }
    if (answer.endAt && remaining <= 0 && !answer.done) {
      setLevelAnswer(level, { ...answer, done: true });
      return '';
    }
    content = `<button class="primary ${running ? 'disabled' : ''}" data-action="start-timer" ${running ? 'disabled' : ''}>${running ? `ОСТАЛОСЬ ${remaining} сек` : level.payload.startLabel}</button>`;
  }
  if (level.type === 'multi_select') {
    const opts = level.payload.options;
    content = `<div class="options">${opts.map((o) => `<label class="option"><input type="checkbox" data-value="${o}" ${answer.selected?.includes(o) ? 'checked' : ''}/> ${o}</label>`).join('')}</div>`;
    if (!canComplete(level, answer)) message = `Выбери минимум ${level.completion.min}`;
  }
  if (level.type === 'single_select') {
    const opts = level.id === 'lvl3_main_problem'
      ? (state.answers.lvl2_problems?.selected?.length ? state.answers.lvl2_problems.selected : level.payload.fallback)
      : level.payload.options;
    content = `<div class="options">${opts.map((o) => `<label class="option"><input type="radio" name="single" data-value="${o}" ${answer.selected === o ? 'checked' : ''}/> ${o}</label>`).join('')}</div>`;
    if (!canComplete(level, answer)) message = 'Выбери один вариант';
  }
  if (level.type === 'education_quiz') {
    content = `<ul>${level.payload.bullets.map((b) => `<li>${b}</li>`).join('')}</ul><h3>${level.payload.question}</h3><div class="options">${level.payload.options.map((o) => `<label class="option"><input type="radio" name="quiz" data-value="${o}" ${answer.selected === o ? 'checked' : ''}/> ${o}</label>`).join('')}</div>`;
    if (answer.selected && answer.selected !== level.payload.correct) message = 'Неверно. Игра честная: попробуй ещё.';
  }

  const completeReady = canComplete(level, answer);

  return `
  <section class="panel">
    <h1>${level.title}</h1>
    <p>${level.subtitle}</p>
    <div class="content">${content}</div>
    ${message ? `<div class="error">${message}</div>` : ''}
    ${completeReady ? '<button class="primary" data-action="complete">Следующий</button>' : ''}
  </section>`;
}

function render() {
  const level = levels[state.currentIndex];
  app.innerHTML = `
    <div class="shell">
      ${renderProgress()}
      ${level ? renderLevel(level) : renderCompletion()}
    </div>
  `;

  app.querySelector('[data-action="reset"]')?.addEventListener('click', resetProgress);

  if (!level) return;

  app.querySelector('[data-action="press"]')?.addEventListener('click', () => {
    setLevelAnswer(level, { pressed: true, at: now() });
  });

  app.querySelector('[data-action="start-timer"]')?.addEventListener('click', () => {
    if (getLevelAnswer(level).endAt) return;
    const endAt = now() + level.payload.durationSec * 1000;
    track('timer_started', { id: level.id, duration: level.payload.durationSec });
    setLevelAnswer(level, { endAt, done: false });
  });

  app.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    el.addEventListener('change', () => {
      const selected = [...app.querySelectorAll('input[type="checkbox"]:checked')].map((n) => n.dataset.value);
      setLevelAnswer(level, { selected });
    });
  });

  app.querySelectorAll('input[type="radio"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      setLevelAnswer(level, { selected: e.target.dataset.value });
    });
  });

  app.querySelector('[data-action="complete"]')?.addEventListener('click', () => {
    if (!canComplete(level, getLevelAnswer(level))) return;
    completeLevel(level);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') track('backgrounded');
});

render();
