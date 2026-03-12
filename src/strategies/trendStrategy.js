const { ema, rsi, atr } = require('../utils/indicators');

class TrendStrategy {
  constructor(config) {
    this.config = config;
  }

  generateEntrySignal({ candles, currentPrice, volume, spreadPercent, slippagePercent }) {
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const fast = ema(closes, this.config.indicators.fastEmaPeriod);
    const slow = ema(closes, this.config.indicators.slowEmaPeriod);
    const trend = ema(closes, this.config.indicators.trendEmaPeriod);
    const rsiVal = rsi(closes, this.config.indicators.rsiPeriod);
    const atrVal = atr(candles, this.config.indicators.atrPeriod);
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    const checksLong = [
      fast > slow,
      slow > trend,
      currentPrice > fast,
      rsiVal >= this.config.long.rsiMin && rsiVal <= this.config.long.rsiMax,
      volume >= avgVolume * this.config.volumeConfirmationMultiplier,
      spreadPercent <= this.config.maxSpreadPercent,
      slippagePercent <= this.config.maxSlippagePercent
    ];
    const checksShort = [
      fast < slow,
      slow < trend,
      currentPrice < fast,
      rsiVal >= this.config.short.rsiMin && rsiVal <= this.config.short.rsiMax,
      volume >= avgVolume * this.config.volumeConfirmationMultiplier,
      spreadPercent <= this.config.maxSpreadPercent,
      slippagePercent <= this.config.maxSlippagePercent
    ];

    const longCount = checksLong.filter(Boolean).length;
    const shortCount = checksShort.filter(Boolean).length;
    const direction = longCount >= this.config.requiredConfirmationsCount ? 'LONG'
      : shortCount >= this.config.requiredConfirmationsCount ? 'SHORT' : 'NONE';
    const score = Math.max(longCount, shortCount) / checksLong.length;

    return {
      allowed: direction !== 'NONE',
      direction,
      score,
      reasons: [`trend confirmations ${Math.max(longCount, shortCount)}/${checksLong.length}`],
      metrics: { fastEma: fast, slowEma: slow, trendEma: trend, rsi: rsiVal, atr: atrVal, spreadPercent }
    };
  }

  validateEntry({ signal, riskChecks }) {
    const allowed = signal.allowed && riskChecks.every((r) => r.allowed);
    return { allowed, score: signal.score, reasons: [...signal.reasons, ...riskChecks.filter((r) => !r.allowed).map((r) => r.reason)], metrics: signal.metrics };
  }

  calculatePositionSize(ctx) { return ctx.positionSizer.calculate(ctx); }
  shouldOpenHedge({ drawdownPercent, atrSpike, signalWeakening }) {
    if (!this.config.enableHedge) return { allowed: false, score: 0, reasons: ['hedge disabled'], metrics: {} };
    const allowed = drawdownPercent >= this.config.hedgeTriggerDrawdownPercent || atrSpike || signalWeakening;
    return { allowed, score: allowed ? 0.8 : 0.2, reasons: ['hedge rules check'], metrics: { drawdownPercent, atrSpike, signalWeakening } };
  }
  shouldAveragePosition({ adverseMovePercent, count, signalScore }) {
    const allowed = this.config.averagingEnabled && count < this.config.maxAveragingCount && adverseMovePercent >= this.config.averagingTriggerPercent && signalScore >= this.config.minSignalStrengthToAverage;
    return { allowed, score: signalScore, reasons: ['averaging rules check'], metrics: { adverseMovePercent, count } };
  }
  shouldPartiallyClose({ pnlPercent }) {
    const levels = this.config.partialTakeProfitLevels || [];
    const hit = levels.find((l) => pnlPercent >= l);
    return { allowed: Boolean(hit), score: hit ? 0.7 : 0.1, reasons: ['partial close check'], metrics: { pnlPercent } };
  }
  shouldFullyClose({ pnlPercent, signalReverse, holdingMinutes }) {
    const allowed = pnlPercent >= this.config.takeProfitPercent || pnlPercent <= -this.config.stopLossPercent || signalReverse || holdingMinutes >= this.config.maxHoldingTimeMinutes;
    return { allowed, score: allowed ? 0.9 : 0.2, reasons: ['full close check'], metrics: { pnlPercent, signalReverse, holdingMinutes } };
  }
  shouldActivateRiskOffMode({ wsHealthy, drawdownPercent }) {
    const allowed = !wsHealthy || drawdownPercent >= this.config.riskOffDrawdownPercent;
    return { allowed, score: allowed ? 1 : 0, reasons: ['riskOff check'], metrics: { wsHealthy, drawdownPercent } };
  }
}

module.exports = { TrendStrategy };
