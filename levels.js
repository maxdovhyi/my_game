export const TRACKS = {
  nofap: { id: 'nofap', label: '🔞 NoFap (PMO)' },
  caffeine: { id: 'caffeine', label: '☕ Кофеин' },
  strength: { id: 'strength', label: '💪 Силовая' }
};

const MEDIUM_TEMPLATES = {
  nofap: [
    { title: '1 день без P', targetDays: 1, predicateType: 'NO_P' },
    { title: '1 день без PMO', targetDays: 1, predicateType: 'NO_PMO' },
    { title: '2 дня без PMO', targetDays: 2, predicateType: 'NO_PMO' },
    { title: '3 дня без PMO', targetDays: 3, predicateType: 'NO_PMO' },
    { title: '5 дней без PMO', targetDays: 5, predicateType: 'NO_PMO' },
    { title: '7 дней без PMO', targetDays: 7, predicateType: 'NO_PMO' },
    { title: '10 дней без PMO', targetDays: 10, predicateType: 'NO_PMO' },
    { title: '14 дней без PMO', targetDays: 14, predicateType: 'NO_PMO' }
  ],
  caffeine: [
    { title: '1 день: вода перед первой дозой', targetDays: 1, predicateType: 'CAFF_WATER_FIRST' },
    { title: '2 дня: первая доза через 60+ мин', targetDays: 2, predicateType: 'CAFF_FIRST_DELAY', params: { minMinutes: 60 } },
    { title: '3 дня: микродозинг baseline-0.5', targetDays: 3, predicateType: 'CAFF_MICRO_BASELINE' },
    { title: '3 дня: последняя доза до 16:00', targetDays: 3, predicateType: 'CAFF_LAST_BEFORE', params: { time: '16:00' } },
    { title: '4 дня: 1 доза заменена на чай', targetDays: 4, predicateType: 'CAFF_TYPE_INCLUDES', params: { value: 'чай' } },
    { title: '4 дня: последняя стим-доза декаф/травяной', targetDays: 4, predicateType: 'CAFF_TYPE_IN', params: { values: ['декаф', 'травяной'] } },
    { title: '2 дня: 0 кофеина', targetDays: 2, predicateType: 'CAFF_ZERO' },
    { title: '7 дней: ≤1 доза и до 14:00', targetDays: 7, predicateType: 'CAFF_ONE_BEFORE', params: { maxDoses: 1, time: '14:00' } }
  ],
  strength: [
    { title: '30/50/30 (1 день)', targetDays: 1, predicateType: 'STRENGTH_MIN', params: { pushups: 30, squats: 50, abs: 30 } },
    { title: '50/80/40 (1 день)', targetDays: 1, predicateType: 'STRENGTH_MIN', params: { pushups: 50, squats: 80, abs: 40 } },
    { title: '70/100/50 (2 дня)', targetDays: 2, predicateType: 'STRENGTH_MIN', params: { pushups: 70, squats: 100, abs: 50 } },
    { title: '90/120/60 (2 дня)', targetDays: 2, predicateType: 'STRENGTH_MIN', params: { pushups: 90, squats: 120, abs: 60 } },
    { title: '110/130/70 (2 дня)', targetDays: 2, predicateType: 'STRENGTH_MIN', params: { pushups: 110, squats: 130, abs: 70 } },
    { title: '130/140/80 (3 дня)', targetDays: 3, predicateType: 'STRENGTH_MIN', params: { pushups: 130, squats: 140, abs: 80 } },
    { title: '150/150 (+пресс бонус)', targetDays: 1, predicateType: 'STRENGTH_MIN', params: { pushups: 150, squats: 150, abs: 0 } },
    { title: '150/150 (2 дня)', targetDays: 2, predicateType: 'STRENGTH_MIN', params: { pushups: 150, squats: 150, abs: 0 } }
  ]
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function applyDifficulty(trackId, levels, difficulty) {
  const out = clone(levels);
  if (difficulty === 'easy') {
    if (trackId === 'nofap') out[7].targetDays = 10;
    if (trackId === 'caffeine') {
      out[6].targetDays = 1;
      out[7].targetDays = 5;
    }
    if (trackId === 'strength') {
      out[2].targetDays = 1;
      out[3].targetDays = 1;
      out[4].targetDays = 1;
      out[5].targetDays = 2;
    }
  }

  if (difficulty === 'hard') {
    if (trackId === 'nofap') {
      out[0] = { ...out[0], title: '1 день без PMO', predicateType: 'NO_PMO' };
      out[1] = { ...out[1], title: '2 дня без PMO', targetDays: 2, predicateType: 'NO_PMO' };
      out[7].targetDays = 18;
    }
    if (trackId === 'caffeine') {
      out[6].targetDays = 3;
      out[7].targetDays = 10;
    }
    if (trackId === 'strength') {
      out[5].targetDays = 4;
      out[6].targetDays = 2;
      out[7].targetDays = 3;
    }
  }
  return out;
}

export function getTrackLabel(trackId) {
  return TRACKS[trackId]?.label || trackId;
}

export function createCampaign(rankedTracks, difficulty, baseline = {}) {
  const levels = [];
  rankedTracks.forEach((trackId) => {
    const templates = applyDifficulty(trackId, MEDIUM_TEMPLATES[trackId], difficulty);
    templates.forEach((template, i) => {
      levels.push({
        id: `${trackId}_${i + 1}`,
        trackId,
        title: `${getTrackLabel(trackId)} · ${template.title}`,
        targetDays: template.targetDays,
        predicateType: template.predicateType,
        params: { ...(template.params || {}), baseline: baseline[trackId] || {} },
        progressDays: 0,
        completed: false
      });
    });
  });

  levels.push({
    id: 'final_boss_25',
    trackId: 'strength',
    title: '🐉 Финальный босс: 150 отжиманий + 150 приседаний 7 дней',
    targetDays: difficulty === 'easy' ? 5 : difficulty === 'hard' ? 10 : 7,
    predicateType: 'STRENGTH_MIN',
    params: { pushups: 150, squats: 150, abs: 0 },
    progressDays: 0,
    completed: false
  });

  return levels.map((level, index) => ({ ...level, index: index + 1 }));
}

function timeToMinutes(value) {
  if (!value || !value.includes(':')) return null;
  const [h, m] = value.split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function evaluatePredicate(level, checkin) {
  const p = level.params || {};
  switch (level.predicateType) {
    case 'NO_P':
      return checkin.p === false;
    case 'NO_PMO':
      return checkin.p === false && checkin.m === false && checkin.o === false;
    case 'CAFF_WATER_FIRST':
      return !!checkin.waterFirst;
    case 'CAFF_FIRST_DELAY':
      return Number(checkin.firstDoseDelayMin || 0) >= Number(p.minMinutes || 60);
    case 'CAFF_MICRO_BASELINE': {
      const baseline = Number(p.baseline?.doses ?? 2);
      return Number(checkin.caffDoses) <= Math.max(0, baseline - 0.5);
    }
    case 'CAFF_LAST_BEFORE': {
      if (Number(checkin.caffDoses) === 0) return true;
      const last = timeToMinutes(checkin.caffLastTime);
      const cap = timeToMinutes(p.time || '16:00');
      return last !== null && cap !== null && last <= cap;
    }
    case 'CAFF_TYPE_INCLUDES':
      return String(checkin.caffType || '').includes(String(p.value || 'чай'));
    case 'CAFF_TYPE_IN':
      return (p.values || []).includes(checkin.caffType);
    case 'CAFF_ZERO':
      return Number(checkin.caffDoses) === 0;
    case 'CAFF_ONE_BEFORE': {
      const dosesOk = Number(checkin.caffDoses) <= Number(p.maxDoses || 1);
      const last = timeToMinutes(checkin.caffLastTime);
      const cap = timeToMinutes(p.time || '14:00');
      const timeOk = Number(checkin.caffDoses) === 0 || (last !== null && cap !== null && last <= cap);
      return dosesOk && timeOk;
    }
    case 'STRENGTH_MIN':
      return Number(checkin.pushups || 0) >= Number(p.pushups || 0)
        && Number(checkin.squats || 0) >= Number(p.squats || 0)
        && Number(checkin.abs || 0) >= Number(p.abs || 0);
    default:
      return false;
  }
}
