class PerformanceTracker {
  constructor(portfolio) {
    this.portfolio = portfolio;
    this.equityCurve = [];
  }

  onCandle(candle) {
    this.equityCurve.push({ ts: candle.closeTime || Date.now(), equity: this.portfolio.realizedPnl });
  }

  buildReport() {
    const trades = this.portfolio.trades;
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl <= 0);
    const grossProfit = wins.reduce((a, b) => a + b.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b.pnl, 0));
    return {
      metrics: {
        totalTrades: trades.length,
        winRate: trades.length ? wins.length / trades.length : 0,
        averageWin: wins.length ? grossProfit / wins.length : 0,
        averageLoss: losses.length ? -grossLoss / losses.length : 0,
        profitFactor: grossLoss ? grossProfit / grossLoss : 0,
        realizedPnl: this.portfolio.realizedPnl,
        totalFees: this.portfolio.fees
      },
      trades
    };
  }
}

module.exports = { PerformanceTracker };
