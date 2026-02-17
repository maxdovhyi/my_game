# Жёсткий Челлендж (MVP)

Одноэкранная PWA-игра на 10 уровней с локальным прогрессом и офлайн-режимом.

## Запуск

```bash
python -m http.server 4173
```

Открыть: `http://localhost:4173`

## Установка PWA (Android / Chrome)

1. Открой приложение в Chrome.
2. Нажми меню браузера → **Установить приложение**.
3. Подтверди установку.
4. После установки приложение запускается как отдельный экран.

## Где лежат уровни

`levels.js` — массив `levels` с 10 объектами уровней.

## Как добавить новый уровень

1. Добавь объект в `levels` с уникальным `id` и `index`.
2. Укажи `type` (`action`, `timer`, `multi_select`, `single_select`, `education_quiz`).
3. Заполни `payload` и `completion`.
4. Добавь ключи в `saveAnswerKeys` при необходимости.
5. Проверь, что `app.js/canComplete` поддерживает правило.

Шаблон:

```js
{
  id: 'lvlX_example',
  index: X,
  title: '...',
  subtitle: '...',
  type: 'single_select',
  payload: { options: ['A', 'B'] },
  completion: { kind: 'selected_one' },
  saveAnswerKeys: ['exampleAnswer']
}
```

## Хранение прогресса

`localStorage` ключ: `challenge_game_v1_progress`

```json
{
  "currentIndex": 0,
  "completed": [],
  "answers": {},
  "startedAt": 0,
  "updatedAt": 0,
  "events": []
}
```

## Метрики MVP (локально)

- `activation` — при прохождении LVL0.
- `completion_lvl5` — при прохождении LVL4 (дошёл до LVL5).
- `time_to_first_complete` — ms до завершения LVL1.
- `level_completed` / `backgrounded` — для drop-off анализа.
