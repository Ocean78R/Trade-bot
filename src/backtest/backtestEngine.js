const fs = require('fs');

class BacktestEngine {
  constructor({ simulationEngine, analytics, logger }) {
    this.simulationEngine = simulationEngine;
    this.analytics = analytics;
    this.logger = logger;
  }

  async run(candles, baseCtx) {
    const warmupBars = Math.max(0, Number(baseCtx?.signalInput?.warmupBars) || 0);

    for (const [index, candle] of candles.entries()) {
      const historicalCandles = candles.slice(0, index + 1);
      if (historicalCandles.length < warmupBars) {
        this.analytics.onCandle(candle);
        continue;
      }

      await this.simulationEngine.onTick({
        ...baseCtx,
        signalInput: {
          ...baseCtx.signalInput,
          candles: historicalCandles,
          currentPrice: candle.close
        }
      });
      this.analytics.onCandle(candle);
    }
    return this.analytics.buildReport();
  }

  saveReport(report, basename = 'backtest-report') {
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(`reports/${basename}.json`, JSON.stringify(report, null, 2));
    const lines = ['metric,value', ...Object.entries(report.metrics).map(([k, v]) => `${k},${v}`)];
    fs.writeFileSync(`reports/${basename}.csv`, `${lines.join('\n')}\n`);
  }
}

module.exports = { BacktestEngine };
