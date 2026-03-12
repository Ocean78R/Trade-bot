const { withRetry } = require('../utils/retry');

class TelegramNotifier {
  constructor(config, logger) {
    this.enabled = Boolean(config.enabled);
    this.botToken = process.env[config.botTokenEnvName || 'TELEGRAM_BOT_TOKEN'];
    this.chatId = process.env[config.chatIdEnvName || 'TELEGRAM_CHAT_ID'];
    this.logger = logger;
    this.rateLimit = config.maxMessageRatePerMinute || 20;
    this.sentAt = [];
    this.lastHash = '';
  }

  async send(text) {
    if (!this.enabled || !this.botToken || !this.chatId) return;
    const hash = `${text.length}:${text.slice(0, 40)}`;
    if (hash === this.lastHash) return;
    this.lastHash = hash;
    const now = Date.now();
    this.sentAt = this.sentAt.filter((t) => now - t < 60_000);
    if (this.sentAt.length >= this.rateLimit) return;
    this.sentAt.push(now);

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
      await withRetry(
        async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: 'Markdown' })
          });
          if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
        },
        { retries: 2, baseDelayMs: 500 }
      );
    } catch (e) {
      this.logger.warn('Telegram unavailable', { err: e.message });
    }
  }

  sendStartupNotification() { return this.send('🚀 Бот запущен.'); }
  sendShutdownNotification() { return this.send('🛑 Бот остановлен.'); }
  sendTradeOpenedNotification(t) { return this.send(`📈 Открыта сделка ${t.symbol} ${t.side} qty=${t.qty}`); }
  sendTradeClosedNotification(t) { return this.send(`📉 Закрыта сделка ${t.symbol} pnl=${t.pnl}`); }
  sendRiskAlertNotification(msg) { return this.send(`⚠️ Risk alert: ${msg}`); }
  sendDailySummaryNotification(stats) { return this.send(`📊 Daily summary: pnl=${stats.realizedPnl}`); }
  sendPeriodicStatusNotification(stats) { return this.send(`ℹ️ Status: balance=${stats.balance}, positions=${stats.openPositions}`); }
  sendErrorNotification(err) { return this.send(`❌ Ошибка: ${err.message || err}`); }
}

module.exports = { TelegramNotifier };
