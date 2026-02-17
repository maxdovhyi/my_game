# Жёсткий Челлендж (MVP v1.0.1)

Одноэкранная PWA-игра на 10 уровней с локальным прогрессом, офлайн-режимом и встроенными локальными метриками.

## Запуск

```bash
python -m http.server 4173
```

Открыть: `http://localhost:4173`

## Что добавлено в Sprint Next (P0+P1)

- SW versioning + удаление старых кэшей (`challenge-game-v1.0.1`).
- Обновление приложения: плашка "Доступно обновление" + кнопка обновить.
- Безопасное восстановление прогресса + защита от битого `localStorage`.
- Метрики: `activation`, `time_to_first_complete`, `completion_lvl5`, `backgrounded`, `level_completed`.
- Скрытая Dev panel (5 тапов по заголовку Level) + экспорт `progress/events` в JSON.
- Строгие валидации LVL2/LVL3/LVL4 и понятные ошибки.
- Финальный экран после LVL9 с summary ответов.
- Сброс прогресса с confirm и очисткой всех связанных storage ключей.

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

`localStorage` ключ: `challenge_game_v1_meta`

```json
{
  "devPanelOpen": false,
  "headerTapCount": 0
}
```

## Мини-чеклист тестов

- Fresh install → LVL0 → LVL1.
- LVL1: по окончании таймера всегда появляется `ЗАВЕРШИТЬ УРОВЕНЬ`.
- LVL2: 2 выбора не пускает; 3 выбора пускает.
- LVL4: неверный ответ не пускает; правильный пускает.
- Перезапуск страницы восстанавливает прогресс.
- После LVL9 показывается финальный summary + reset.
- Оффлайн (после первого визита) открывает приложение.
- Dev panel экспортирует JSON.
