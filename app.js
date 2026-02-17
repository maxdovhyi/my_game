import { createCampaign, evaluatePredicate, getTrackLabel } from './levels.js';

const STORAGE_KEY = 'challenge_game_v2_state';
const APP_VERSION = '2.0.0';
const app = document.getElementById('app');

const now = () => Date.now();
const kievToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kiev' }).format(new Date());

function createState() {
  return {
    version: 2,
    onboarding: {
      step: 'intro',
      assessment: { nofap: null, caffeine: null, strength: null },
      ranking: [],
      difficulty: null
    },
    campaign: {
      levels: [],
      currentIndex: 0,
      pendingCompletion: false,
      completionDate: null,
      awaitingRiskChoice: false,
      riskMood: null,
      status: 'idle'
    },
    checkins: {},
    events: [],
    ui: { devOpen: false, taps: 0 },
    startedAt: null
  };
}

let state = loadState();
let toast = '';
let swUpdateAvailable = false;
let waitingWorker = null;

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function sanitizeState(input) {
  const base = createState();
  const s = typeof input === 'object' && input ? input : {};
  const out = { ...base, ...s };
  out.onboarding = { ...base.onboarding, ...(s.onboarding || {}) };
  out.onboarding.assessment = { ...base.onboarding.assessment, ...(s.onboarding?.assessment || {}) };
  out.campaign = { ...base.campaign, ...(s.campaign || {}) };
  out.campaign.levels = Array.isArray(s.campaign?.levels) ? s.campaign.levels : [];
  out.checkins = typeof s.checkins === 'object' && s.checkins ? s.checkins : {};
  out.events = Array.isArray(s.events) ? s.events.slice(-1000) : [];
  out.ui = { ...base.ui, ...(s.ui || {}) };
  return out;
}

function loadState() {
  return sanitizeState(safeParse(localStorage.getItem(STORAGE_KEY), createState()));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function track(type, extra = {}) {
  state.events.push({ type, at: now(), ...extra });
  saveState();
}

function currentLevel() {
  return state.campaign.levels[state.campaign.currentIndex] || null;
}

function checkinFor(date) {
  return state.checkins[date] || null;
}

function updateLevelProgressFromCheckin(date) {
  const level = currentLevel();
  if (!level || state.campaign.pendingCompletion || state.campaign.awaitingRiskChoice) return;
  const checkin = checkinFor(date);
  if (!checkin) return;

  const passed = evaluatePredicate(level, checkin);
  level.progressDays = passed ? Math.min(level.targetDays, level.progressDays + 1) : 0;
  track('level_progress_updated', { levelId: level.id, passed, progress: level.progressDays, target: level.targetDays, date });

  if (level.progressDays === level.targetDays) {
    state.campaign.pendingCompletion = true;
    state.campaign.completionDate = date;
    track('level_completed', { levelId: level.id });
    if (level.index === 1) track('time_to_first_complete', { ms: state.startedAt ? now() - state.startedAt : 0 });
    if (level.index === 5) track('completion_lvl5');
  }
}

function finishLevel() {
  const level = currentLevel();
  if (!level || !state.campaign.pendingCompletion) return;

  const cDate = state.campaign.completionDate;
  if (cDate && state.checkins[cDate]) state.checkins[cDate].locked = true;
  state.campaign.awaitingRiskChoice = true;
  saveState();
  render();
}

function applySafeFast(mode) {
  const level = currentLevel();
  if (!level || !state.campaign.awaitingRiskChoice || !state.campaign.riskMood) return;
  level.completed = true;

  const nextIndex = state.campaign.currentIndex + 1;
  const next = state.campaign.levels[nextIndex] || null;
  const date = state.campaign.completionDate;

  state.campaign.pendingCompletion = false;
  state.campaign.awaitingRiskChoice = false;
  state.campaign.completionDate = null;

  if (!next) {
    state.campaign.status = 'finished';
    saveState();
    render();
    return;
  }

  state.campaign.currentIndex = nextIndex;
  next.progressDays = 0;

  if (mode === 'fast') {
    const todayCheckin = checkinFor(date);
    const passNext = !!todayCheckin && evaluatePredicate(next, todayCheckin);
    const carry = passNext ? 1 : 0;
    next.progressDays = Math.min(carry, Math.max(0, next.targetDays - 1));
  }

  track('safe_fast_selected', { mode, mood: state.campaign.riskMood, nextLevel: next.id, carried: next.progressDays });
  state.campaign.riskMood = null;
  saveState();
  render();
}

function resetCampaign() {
  if (!window.confirm('Сбросить кампанию и все чек-ины?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = createState();
  render();
}

function buildRanking(assessment) {
  return Object.entries(assessment)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

function buildBaseline() {
  const entries = Object.values(state.checkins || {});
  const lastThree = entries.slice(-3);
  const doses = lastThree.length ? lastThree.reduce((s, c) => s + Number(c.caffDoses || 0), 0) / lastThree.length : 2;
  return { caffeine: { doses } };
}

function startCampaign() {
  const ranking = buildRanking(state.onboarding.assessment);
  state.onboarding.ranking = ranking;
  state.campaign.levels = createCampaign(ranking, state.onboarding.difficulty, buildBaseline());
  state.campaign.currentIndex = 0;
  state.campaign.status = 'active';
  state.onboarding.step = 'home';
  state.startedAt = state.startedAt || now();
  track('activation');
  saveState();
  render();
}

function validateCheckin(form) {
  const required = ['p', 'm', 'o', 'caffDoses', 'caffType', 'pushups', 'squats', 'abs'];
  return required.every((key) => form[key] !== '' && form[key] !== null && form[key] !== undefined);
}

function saveCheckin() {
  const date = kievToday();
  const existing = checkinFor(date);
  if (existing?.locked) {
    toast = 'Чек-ин уже заблокирован после завершения уровня.';
    render();
    return;
  }

  const get = (sel) => app.querySelector(sel);
  const data = {
    date,
    p: get('[name="p"]:checked')?.value === 'true',
    m: get('[name="m"]:checked')?.value === 'true',
    o: get('[name="o"]:checked')?.value === 'true',
    urge: Number(get('#urge')?.value || 0),
    waterFirst: get('#waterFirst')?.checked || false,
    firstDoseDelayMin: Number(get('#firstDoseDelayMin')?.value || 0),
    caffDoses: Number(get('#caffDoses')?.value || 0),
    caffFirstTime: get('#caffFirstTime')?.value || '',
    caffLastTime: get('#caffLastTime')?.value || '',
    caffType: get('#caffType')?.value || '',
    pushups: Number(get('#pushups')?.value || 0),
    squats: Number(get('#squats')?.value || 0),
    abs: Number(get('#abs')?.value || 0),
    locked: false,
    updatedAt: now()
  };

  if (!validateCheckin(data)) {
    toast = 'Заполни обязательные поля по всем 3 секциям.';
    render();
    return;
  }

  state.checkins[date] = data;
  track('checkin_saved', { date });
  updateLevelProgressFromCheckin(date);
  toast = 'Сохранено ✅';
  saveState();
  render();
}

function renderIntro() {
  return `<section class="panel"><h1>🚀 Моя игра v2</h1><ul><li>Уровень апается только по цели текущего уровня.</li><li>Чек-ин честно фиксирует факты по 3 дорожкам.</li><li>После уровня выбираешь Safe/Fast.</li></ul><button class="primary" data-action="go-assessment">Start</button></section>`;
}

function renderAssessment() {
  const a = state.onboarding.assessment;
  const card = (id, title, hint) => `<div class="panel"><h3>${title}</h3><p>${hint}</p><div class="row">${[0,1,2,3,4].map((v)=>`<button class="chip ${a[id]===v?'active':''}" data-action="score" data-id="${id}" data-value="${v}">${v}</button>`).join('')}</div></div>`;
  const can = Object.values(a).every((v) => v !== null);
  return `<section class="panel"><h2>Assessment 0–4</h2>${card('nofap','🔞 NoFap','0=нет, 4=часто')}${card('caffeine','☕ Кофеин','0=редко, 4=много и поздно')}${card('strength','💪 Силовая','0=ничего, 4=стабильно')}<button class="primary" data-action="to-difficulty" ${can?'':'disabled'}>Продолжить</button></section>`;
}

function renderDifficulty() {
  const d = state.onboarding.difficulty;
  return `<section class="panel"><h2>Сложность</h2><div class="row">${['easy','medium','hard'].map((x)=>`<button class="chip ${d===x?'active':''}" data-action="difficulty" data-value="${x}">${x}</button>`).join('')}</div><button class="primary" data-action="start-campaign" ${d?'':'disabled'}>Начать кампанию</button></section>`;
}

function renderHistory(level) {
  const days = [];
  const base = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kiev' }).format(d);
    const c = checkinFor(date);
    const ok = c ? evaluatePredicate(level, c) : false;
    days.push(`<span class="hist ${!c ? 'miss' : ok ? 'ok' : 'fail'}" title="${date}">${!c ? '·' : ok ? '✅' : '❌'}</span>`);
  }
  return days.join(' ');
}

function renderHome() {
  const level = currentLevel();
  if (!level) return renderFinal();
  const today = kievToday();
  const todayCheckin = checkinFor(today);
  const status = todayCheckin ? (todayCheckin.locked ? 'Заполнен и заблокирован' : 'Заполнен') : 'Не заполнен';
  const pct = Math.round((level.progressDays / level.targetDays) * 100);

  return `<section class="panel">
    <h2 data-action="dev-tap">Сегодня · Level ${level.index}/25</h2>
    <div class="panel"><strong>${level.title}</strong><small>${getTrackLabel(level.trackId)}</small><div>${level.progressDays}/${level.targetDays}</div><div class="bar"><span style="width:${pct}%"></span></div></div>
    <div class="panel"><strong>Сегодняшний чек-ин:</strong> <span>${status}</span><button class="primary" data-action="open-checkin">Заполнить чек-ин</button></div>
    <div class="panel"><strong>История 7 дней:</strong><div>${renderHistory(level)}</div></div>
    <div class="row"><button class="ghost" data-action="reset">Сброс кампании</button></div>
  </section>`;
}

function renderCheckin() {
  const today = kievToday();
  const c = checkinFor(today) || {};
  const disabled = c.locked ? 'disabled' : '';
  return `<section class="panel"><h2>Daily Check-in (${today})</h2>
    <div class="panel"><h3>🔞 NoFap</h3>${['p','m','o'].map((k)=>`<div class="row">${k.toUpperCase()}: <label><input type="radio" name="${k}" value="false" ${(c[k]===false)?'checked':''} ${disabled}/> Нет</label><label><input type="radio" name="${k}" value="true" ${(c[k]===true)?'checked':''} ${disabled}/> Да</label></div>`).join('')}<label>Urge 0-3 <input id="urge" type="number" min="0" max="3" value="${c.urge ?? 0}" ${disabled}/></label></div>
    <div class="panel"><h3>☕ Кофеин</h3><label><input id="waterFirst" type="checkbox" ${c.waterFirst?'checked':''} ${disabled}/> Вода перед первой дозой</label><label>Задержка первой дозы (мин) <input id="firstDoseDelayMin" type="number" value="${c.firstDoseDelayMin ?? 0}" ${disabled}/></label><label>Дозы <select id="caffDoses" ${disabled}>${['0','0.5','1','2','3'].map(v=>`<option ${Number(c.caffDoses)==Number(v)?'selected':''}>${v}</option>`).join('')}</select></label><label>Первая доза <input id="caffFirstTime" type="time" value="${c.caffFirstTime||''}" ${disabled}/></label><label>Последняя доза <input id="caffLastTime" type="time" value="${c.caffLastTime||''}" ${disabled}/></label><label>Тип <select id="caffType" ${disabled}>${['кофе','чай','энергетик','декаф','травяной'].map(t=>`<option ${c.caffType===t?'selected':''}>${t}</option>`).join('')}</select></label></div>
    <div class="panel"><h3>💪 Силовая</h3><label>Отжимания <input id="pushups" type="number" value="${c.pushups ?? 0}" ${disabled}/></label><label>Приседания <input id="squats" type="number" value="${c.squats ?? 0}" ${disabled}/></label><label>Пресс <input id="abs" type="number" value="${c.abs ?? 0}" ${disabled}/></label></div>
    <div class="row"><button class="primary" data-action="save-checkin" ${disabled}>Сохранить</button><button class="ghost" data-action="back-home">Отмена</button></div>
  </section>`;
}

function renderLevelComplete() {
  return `<section class="panel center"><h2>🏁 Уровень пройден</h2><p>Цель выполнена. Теперь зафиксируй завершение уровня.</p><button class="primary" data-action="finish-level">Завершить уровень</button></section>`;
}

function renderRisk() {
  const mood = state.campaign.riskMood;
  return `<section class="panel center"><h2>😬 Как ты? можешь слить?</h2><div class="row">${[['easy','😎 Легко'],['ok','😐 Норм'],['edge','😵 На грани']].map(([id,t])=>`<button class="chip ${mood===id?'active':''}" data-action="mood" data-value="${id}">${t}</button>`).join('')}</div><p>Выбери режим перехода:</p><div class="row"><button class="primary" data-action="safe" ${mood?'':'disabled'}>🏦 Safe</button><button class="primary" data-action="fast" ${mood?'':'disabled'}>⚡ Fast</button></div></section>`;
}

function renderFinal() {
  const completed = state.campaign.levels.filter((l) => l.completed).length;
  return `<section class="panel center"><h1>🎉 Кампания завершена</h1><p>Пройдено уровней: ${completed}/25</p><button class="primary" data-action="reset">Сбросить и начать заново</button></section>`;
}

function renderDevPanel() {
  if (!state.ui.devOpen) return '';
  return `<section class="panel"><h3>Dev panel</h3><p>Events: ${state.events.length}</p><div class="row"><button class="ghost" data-action="export-state">Export state</button><button class="ghost" data-action="export-events">Export events</button></div></section>`;
}

function renderUpdateBanner() {
  if (!swUpdateAvailable) return '';
  return `<div class="update">Доступно обновление <button class="ghost" data-action="apply-update">Обновить</button></div>`;
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

function currentScreen() {
  if (state.onboarding.step === 'intro') return renderIntro();
  if (state.onboarding.step === 'assessment') return renderAssessment();
  if (state.onboarding.step === 'difficulty') return renderDifficulty();
  if (state.onboarding.step === 'checkin') return renderCheckin();
  if (state.campaign.awaitingRiskChoice) return renderRisk();
  if (state.campaign.pendingCompletion) return renderLevelComplete();
  if (state.campaign.status === 'finished') return renderFinal();
  return renderHome();
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
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          swUpdateAvailable = true;
          waitingWorker = nw;
          render();
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  });
}

function wireCheckinFormValidation() {
  const saveBtn = app.querySelector('[data-action="save-checkin"]');
  if (!saveBtn) return;
  const evalReady = () => {
    const required = [
      app.querySelector('[name="p"]:checked'),
      app.querySelector('[name="m"]:checked'),
      app.querySelector('[name="o"]:checked'),
      app.querySelector('#caffDoses')?.value,
      app.querySelector('#caffType')?.value,
      app.querySelector('#pushups')?.value,
      app.querySelector('#squats')?.value,
      app.querySelector('#abs')?.value
    ];
    saveBtn.disabled = !required.every((v) => v !== null && v !== undefined && v !== '');
  };
  app.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', evalReady));
  evalReady();
}

function render() {
  app.innerHTML = `<div class="shell"><div class="panel"><strong>Challenge v2</strong></div>${renderUpdateBanner()}${renderDevPanel()}${currentScreen()}${toast?`<div class="toast">${toast}</div>`:''}</div>`;

  app.querySelector('[data-action="go-assessment"]')?.addEventListener('click', () => { state.onboarding.step = 'assessment'; saveState(); render(); });
  app.querySelectorAll('[data-action="score"]').forEach((el) => el.addEventListener('click', () => {
    state.onboarding.assessment[el.dataset.id] = Number(el.dataset.value);
    saveState(); render();
  }));
  app.querySelector('[data-action="to-difficulty"]')?.addEventListener('click', () => { state.onboarding.step = 'difficulty'; saveState(); render(); });
  app.querySelectorAll('[data-action="difficulty"]').forEach((el) => el.addEventListener('click', () => {
    state.onboarding.difficulty = el.dataset.value;
    saveState(); render();
  }));
  app.querySelector('[data-action="start-campaign"]')?.addEventListener('click', startCampaign);

  app.querySelector('[data-action="open-checkin"]')?.addEventListener('click', () => { state.onboarding.step = 'checkin'; saveState(); render(); });
  app.querySelector('[data-action="back-home"]')?.addEventListener('click', () => { state.onboarding.step = 'home'; saveState(); render(); });
  app.querySelector('[data-action="save-checkin"]')?.addEventListener('click', () => { saveCheckin(); state.onboarding.step = 'home'; saveState(); render(); });
  wireCheckinFormValidation();

  app.querySelector('[data-action="finish-level"]')?.addEventListener('click', finishLevel);
  app.querySelectorAll('[data-action="mood"]').forEach((el) => el.addEventListener('click', () => { state.campaign.riskMood = el.dataset.value; saveState(); render(); }));
  app.querySelector('[data-action="safe"]')?.addEventListener('click', () => applySafeFast('safe'));
  app.querySelector('[data-action="fast"]')?.addEventListener('click', () => applySafeFast('fast'));

  app.querySelector('[data-action="reset"]')?.addEventListener('click', resetCampaign);
  app.querySelector('[data-action="dev-tap"]')?.addEventListener('click', () => {
    state.ui.taps += 1;
    if (state.ui.taps >= 5) { state.ui.devOpen = !state.ui.devOpen; state.ui.taps = 0; }
    saveState(); render();
  });
  app.querySelector('[data-action="export-state"]')?.addEventListener('click', () => exportJson('campaign-state', state));
  app.querySelector('[data-action="export-events"]')?.addEventListener('click', () => exportJson('campaign-events', state.events));
  app.querySelector('[data-action="apply-update"]')?.addEventListener('click', () => waitingWorker?.postMessage('SKIP_WAITING'));

  setTimeout(() => {
    if (toast) {
      toast = '';
      render();
    }
  }, 1400);
}


document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') track('backgrounded');
});

wireSwUpdates();
render();
