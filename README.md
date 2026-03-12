# BingX Perpetual Futures Trade Bot (Node.js)

## Назначение
Production prototype торгового робота для бессрочных фьючерсов BingX с формализованными правилами входа/выхода, риск-менеджментом, режимами simulation/backtest/forward test/live и уведомлениями в Telegram.

## Архитектура
- **API layer**: `src/api/bingxRestClient.js` — REST запросы с подписью, retry, backoff.
- **WebSocket layer**: `src/ws/bingxWsClient.js` — market-stream, heartbeat, reconnect, дедупликация.
- **Strategy layer**: `src/strategies/trendStrategy.js`, `src/strategies/microstructureStrategy.js`.
- **Risk layer**: `src/risk/riskManager.js`, `src/risk/positionSizer.js`.
- **Execution layer**: `src/execution/liveExecutionAdapter.js`, `src/execution/simulatedExecutionAdapter.js`.
- **Portfolio/PNL**: `src/portfolio/portfolioManager.js`.
- **Simulation/Backtest**: `src/simulator/simulationEngine.js`, `src/backtest/backtestEngine.js`.
- **Analytics**: `src/analytics/performanceTracker.js`.
- **Notifications**: `src/notifications/telegramNotifier.js`.

## Требования
- Node.js >= 20
- npm >= 10
- API ключи BingX
- Telegram Bot Token + Chat ID (опционально)

## Установка
```bash
npm install
cp .env.example .env
cp config.json.example config.json
```

## Настройка `.env`
```env
BINGX_API_KEY=...
BINGX_API_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## Настройка `config.json`
- Выберите `defaultMode`.
- Укажите `symbols`, `strategy.type`, `risk`, `telegram`.
- Для live обязательно: `liveMode.enabled=true` и запуск с `--confirm-live`.

## Режимы
- `simulationMode`: локальное исполнение, без реальных ордеров.
- `backtestMode`: прогон исторических свечей из `data/*.json`, отчёт JSON/CSV в `reports/`.
- `forwardTestMode`: рыночные данные реальные, ордера paper.
- `liveMode`: реальные ордера через REST (по умолчанию выключен).

## Запуск
```bash
npm run start
npm run backtest
npm run smoke:simulation
npm run start:forward
npm run start:live
```

## Безопасный запуск
1. Начните с `simulationMode`.
2. Проверьте лимиты риска, minBalance/minMargin/maxDrawdown и stopTradingBalance (порог полной остановки новых сделок).
3. Проверьте Telegram-уведомления.
4. Выполните backtest и forward test.
5. Только после этого активируйте live.

## Логи и отчёты
- Логи: `logs/bot.log` + stdout JSON.
- Отчёты: `reports/*.json`, `reports/*.csv`.

## Telegram
1. Создайте бота через `@BotFather`.
2. Получите token.
3. Узнайте `chat_id` (через `getUpdates`).
4. Укажите переменные в `.env`.
5. Включайте/выключайте типы уведомлений через блок `telegram` в конфиге.

Уведомления: старт/остановка, риск-алерты, ошибки, открытие/закрытие сделок, дневная и периодическая статистика.

## Типовые ошибки
- `Config validation failed`: проверьте обязательные поля.
- `Live mode requires --confirm-live`: защита от случайного live.
- `Telegram unavailable`: бот продолжит работу без падения.
- `WS data stale`: отключение торговли при деградации данных.

## Ограничения
- Некоторые endpoint/поля отмечены `VERIFY_WITH_BINGX_DOCS` и требуют сверки с актуальной документацией BingX.
- В репозитории упрощены формулы для части сигналов (прототип).

