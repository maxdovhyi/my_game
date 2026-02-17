export const BASE_PROBLEMS = [
  'Кофеин',
  'Сахар',
  'Переедание',
  'Скролл',
  'Порно',
  'Сон',
  'Стресс',
  'Фокус',
  'Энергия',
  'Активность',
  'Хаос'
];

export const levels = [
  {
    id: 'lvl0_start',
    index: 0,
    title: 'LVL0 — Вход',
    subtitle: 'Ты уже в игре. Нажми ПОГНАЛИ',
    type: 'action',
    payload: { buttonLabel: 'ПОГНАЛИ' },
    completion: { kind: 'button_press' },
    saveAnswerKeys: []
  },
  {
    id: 'lvl1_timer60',
    index: 1,
    title: 'LVL1 — 60 секунд тишины',
    subtitle: 'Нажми СТАРТ. Без паузы. Без побега.',
    type: 'timer',
    payload: { durationSec: 60, startLabel: 'СТАРТ' },
    completion: { kind: 'timer_finished', durationSec: 60 },
    saveAnswerKeys: ['lvl1FinishedAt']
  },
  {
    id: 'lvl2_problems',
    index: 2,
    title: 'LVL2 — Признай проблемы',
    subtitle: 'Выбери минимум 3 пункта.',
    type: 'multi_select',
    payload: { options: BASE_PROBLEMS, minSelected: 3 },
    completion: { kind: 'min_selected', min: 3 },
    saveAnswerKeys: ['selectedProblems']
  },
  {
    id: 'lvl3_main_problem',
    index: 3,
    title: 'LVL3 — Главная проблема №1',
    subtitle: 'Выбери один главный триггер.',
    type: 'single_select',
    payload: { fallback: BASE_PROBLEMS.slice(0, 5) },
    completion: { kind: 'selected_one' },
    saveAnswerKeys: ['mainProblem']
  },
  {
    id: 'lvl4_edu_quiz',
    index: 4,
    title: 'LVL4 — Мини-обучение',
    subtitle: 'Прочитай и ответь правильно.',
    type: 'education_quiz',
    payload: {
      bullets: [
        'Привычка = триггер → действие → награда.',
        'Среда сильнее мотивации.',
        'Желание — это сигнал системы, а не приказ.',
        'Убери триггер — ослабишь импульс.'
      ],
      question: 'Что сильнее влияет на привычку?',
      options: ['Мотивация', 'Триггер и среда'],
      correct: 'Триггер и среда'
    },
    completion: { kind: 'quiz_correct' },
    saveAnswerKeys: ['quizAnswerLvl4']
  },
  {
    id: 'lvl5_timer300',
    index: 5,
    title: 'LVL5 — 5 минут в стену',
    subtitle: 'Сиди спокойно 5 минут. Без паузы.',
    type: 'timer',
    payload: { durationSec: 300, startLabel: 'НАЧАТЬ 5 МИН' },
    completion: { kind: 'timer_finished', durationSec: 300 },
    saveAnswerKeys: ['lvl5FinishedAt']
  },
  {
    id: 'lvl6_commit',
    index: 6,
    title: 'LVL6 — Обязательство 24 часа',
    subtitle: 'От чего откажешься на сутки?',
    type: 'single_select',
    payload: { options: ['Кофеин', 'Сладкое', 'Порно', 'Скролл'] },
    completion: { kind: 'selected_one' },
    saveAnswerKeys: ['dayCommitment']
  },
  {
    id: 'lvl7_rescue',
    index: 7,
    title: 'LVL7 — План спасения',
    subtitle: 'Если сорвался — выбери минимум 2 действия.',
    type: 'multi_select',
    payload: { options: ['Вода', 'Прогулка', 'Дыхание', 'Холодный душ', '10 приседаний'], minSelected: 2 },
    completion: { kind: 'min_selected', min: 2 },
    saveAnswerKeys: ['rescuePlan']
  },
  {
    id: 'lvl8_trigger',
    index: 8,
    title: 'LVL8 — Удали триггер',
    subtitle: 'Что уберёшь из среды прямо сейчас?',
    type: 'single_select',
    payload: { options: ['Удалить приложение', 'Убрать сладкое', 'Выключить уведомления', 'Поставить блокер'] },
    completion: { kind: 'selected_one' },
    saveAnswerKeys: ['removedTrigger']
  },
  {
    id: 'lvl9_final',
    index: 9,
    title: 'LVL9 — Финал',
    subtitle: 'Клятва честности и старт забега.',
    type: 'action',
    payload: { buttonLabel: 'Я НАЧИНАЮ' },
    completion: { kind: 'button_press' },
    saveAnswerKeys: ['finalStarted']
  }
];
