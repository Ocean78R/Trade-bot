class MicrostructureStrategy {
  constructor(config) { this.config = config; }

  generateEntrySignal({ metrics }) {
    const m = metrics;
    const longChecks = [
      m.priceChangePercent >= this.config.minLongPriceImpulsePercent,
      m.orderBookImbalance >= this.config.minLongOrderBookImbalance,
      m.volumeDelta >= this.config.minLongVolumeDelta,
      m.buySellTradeRatio >= this.config.minLongBuySellRatio,
      m.bidAskSpreadPercent <= this.config.maxSpreadPercent,
      m.breakoutDistancePercent <= this.config.maxBreakoutChasePercent
    ];
    const shortChecks = [
      m.priceChangePercent <= -this.config.minShortPriceImpulsePercent,
      m.orderBookImbalance <= -this.config.minShortOrderBookImbalance,
      m.volumeDelta <= -this.config.minShortVolumeDelta,
      m.buySellTradeRatio <= this.config.maxShortBuySellRatio,
      m.bidAskSpreadPercent <= this.config.maxSpreadPercent,
      m.breakoutDistancePercent <= this.config.maxBreakoutChasePercent
    ];

    const longScore = longChecks.filter(Boolean).length / longChecks.length;
    const shortScore = shortChecks.filter(Boolean).length / shortChecks.length;
    const direction = longScore >= this.config.requiredSignalScore ? 'LONG' : shortScore >= this.config.requiredSignalScore ? 'SHORT' : 'NONE';

    return {
      allowed: direction !== 'NONE',
      direction,
      score: Math.max(longScore, shortScore),
      reasons: ['microstructure signal computed'],
      metrics: m
    };
  }

  validateEntry({ signal, riskChecks }) {
    const allowed = signal.allowed && riskChecks.every((r) => r.allowed);
    return { allowed, score: signal.score, reasons: [...signal.reasons], metrics: signal.metrics };
  }

  calculatePositionSize(ctx) { return ctx.positionSizer.calculate(ctx); }
  shouldOpenHedge({ volatilityScore }) { return { allowed: volatilityScore > this.config.hedgeVolatilityThreshold, score: volatilityScore, reasons: ['hedge by volatility'], metrics: { volatilityScore } }; }
  shouldAveragePosition({ adverseMovePercent, count }) { return { allowed: this.config.averagingEnabled && count < this.config.maxAveragingCount && adverseMovePercent >= this.config.averagingTriggerPercent, score: 0.6, reasons: ['average by threshold'], metrics: { adverseMovePercent } }; }
  shouldPartiallyClose({ pnlPercent }) { return { allowed: pnlPercent >= this.config.partialTakeProfitLevels[0], score: 0.7, reasons: ['partial tp'], metrics: { pnlPercent } }; }
  shouldFullyClose({ pnlPercent, volatilityScore }) { return { allowed: pnlPercent <= -this.config.stopLossPercent || pnlPercent >= this.config.takeProfitPercent || volatilityScore > this.config.emergencyVolatilityScore, score: 0.85, reasons: ['full close'], metrics: { pnlPercent, volatilityScore } }; }
  shouldActivateRiskOffMode({ wsHealthy, dataFresh }) { return { allowed: !wsHealthy || !dataFresh, score: 1, reasons: ['riskOff by data degradation'], metrics: { wsHealthy, dataFresh } }; }
}

module.exports = { MicrostructureStrategy };
