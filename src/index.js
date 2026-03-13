const fs = require('fs');
const { loadEnvFile } = require('./utils/env');
const { Logger } = require('./utils/logger');
const { parseArgs, loadConfig, validateConfig } = require('./config/configLoader');
const { BingXRestClient } = require('./api/bingxRestClient');
const { BingXWsClient } = require('./ws/bingxWsClient');
const { TrendStrategy } = require('./strategies/trendStrategy');
const { MicrostructureStrategy } = require('./strategies/microstructureStrategy');
const { PositionSizer } = require('./risk/positionSizer');
const { RiskManager } = require('./risk/riskManager');
const { PortfolioManager } = require('./portfolio/portfolioManager');
const { SimulatedExecutionAdapter } = require('./execution/simulatedExecutionAdapter');
const { LiveExecutionAdapter } = require('./execution/liveExecutionAdapter');
const { OrderRegistry } = require('./execution/orderRegistry');
const { SimulationEngine } = require('./simulator/simulationEngine');
const { PerformanceTracker } = require('./analytics/performanceTracker');
const { BacktestEngine } = require('./backtest/backtestEngine');
const { TelegramNotifier } = require('./notifications/telegramNotifier');

function buildTick(symbol, basePrice, i) {
  const price = basePrice * (1 + (i % 2 === 0 ? 0.001 : -0.0005));
  return { symbol, price, bid: price * 0.9999, ask: price * 1.0001 };
}

async function main() {
  loadEnvFile('.env');
  const args = parseArgs(process.argv.slice(2));
  const logger = new Logger({ level: process.env.LOG_LEVEL || 'info', logDir: 'logs' });
  const profile = args.profile || 'balanced';
  const config = loadConfig({ configPath: args.config || 'config.json', profile });
  config.mode = args.mode || config.defaultMode;
  validateConfig(config);

  if (config.mode === 'liveMode' && !args['confirm-live']) {
    throw new Error('Live mode requires --confirm-live');
  }

  const notifier = new TelegramNotifier(config.telegram, logger);
  await notifier.sendStartupNotification();

  const restClient = new BingXRestClient({ apiKey: process.env.BINGX_API_KEY, apiSecret: process.env.BINGX_API_SECRET, baseUrl: config.api.restBaseUrl, logger });
  const wsClient = new BingXWsClient({ url: config.api.wsBaseUrl, logger });
  const portfolio = new PortfolioManager();
  const positionSizer = new PositionSizer(config.risk);
  const riskManager = new RiskManager(config.risk);
  const strategy = config.strategy.type === 'trendA' ? new TrendStrategy(config.strategy) : new MicrostructureStrategy(config.strategy);

  const execution = config.mode === 'liveMode'
    ? new LiveExecutionAdapter({ restClient, orderRegistry: new OrderRegistry(), logger })
    : new SimulatedExecutionAdapter({ portfolio, logger });

  const simulationEngine = new SimulationEngine({ strategy, execution, riskManager, logger });
  const analytics = new PerformanceTracker(portfolio);

  if (config.mode === 'backtestMode') {
    const candles = JSON.parse(fs.readFileSync(config.backtest.dataFile, 'utf8'));
    const indicatorPeriods = Object.values(config.strategy?.indicators || {}).filter((v) => Number.isFinite(v));
    const warmupBars = Math.max(20, ...indicatorPeriods);
    const backtest = new BacktestEngine({ simulationEngine, analytics, logger });
    const report = await backtest.run(candles, {
      signalInput: { candles, currentPrice: candles.at(-1).close, volume: candles.at(-1).volume, spreadPercent: 0.03, slippagePercent: 0.04, warmupBars },
      riskInput: {
        account: { balance: config.simulation.initialBalance, freeMargin: config.simulation.initialBalance },
        portfolio: { openPositions: portfolio.getOpenPositionsCount() },
        order: { rewardRiskRatio: 1.8, expectedNetProfitPercent: 0.4 },
        market: { spreadPercent: 0.03, slippagePercent: 0.04 },
        wsHealthy: true
      },
      executionInput: { symbol: config.symbols[0], side: 'BUY', qty: 0.001, price: candles.at(-1).close, feeRate: config.fees.takerFeeRate, slippagePercent: config.risk.maxSlippagePercent }
    });
    backtest.saveReport(report, `backtest-${profile}`);
    logger.info('Backtest completed', report.metrics);
  } else if (config.mode === 'simulationMode' && args.smoke) {
    const ticks = Number(args.ticks || 3);
    for (let i = 0; i < ticks; i += 1) {
      const tick = buildTick(config.symbols[0], 100, i);
      const candles = [{ close: tick.price, high: tick.price, low: tick.price, volume: 30 }];
      const signalInput = { candles, currentPrice: tick.price, volume: 30, spreadPercent: ((tick.ask - tick.bid) / tick.price) * 100, slippagePercent: 0.05, metrics: { priceChangePercent: 0.2, orderBookImbalance: 0.1, volumeDelta: 12, buySellTradeRatio: 1.3, bidAskSpreadPercent: 0.02, breakoutDistancePercent: 0.1 } };
      const riskInput = {
        account: { balance: config.simulation.initialBalance, freeMargin: config.simulation.initialBalance },
        portfolio: { openPositions: portfolio.getOpenPositionsCount() },
        order: { rewardRiskRatio: 2, expectedNetProfitPercent: 0.5 },
        market: { spreadPercent: signalInput.spreadPercent, slippagePercent: 0.05 },
        wsHealthy: true
      };
      const size = positionSizer.calculate({ equity: config.simulation.initialBalance, entryPrice: tick.price || 1, stopLossPercent: config.risk.stopLossPercent, leverage: config.leverage });
      const executionInput = { symbol: tick.symbol || config.symbols[0], side: 'BUY', qty: size.qty, price: tick.price, feeRate: config.fees.takerFeeRate, slippagePercent: config.risk.maxSlippagePercent };
      const res = await simulationEngine.onTick({ signalInput, riskInput, executionInput });
      logger.info('Smoke tick processed', { i, skipped: Boolean(res?.skipped), qty: executionInput.qty });
    }
    logger.info('Simulation smoke test completed');
  } else {
    wsClient.connect(config.api.wsSubscriptions);
    wsClient.onMessage(async (tick) => {
      const candles = [{ close: tick.price, high: tick.price, low: tick.price, volume: 1 }];
      const signalInput = { candles, currentPrice: tick.price, volume: 1, spreadPercent: ((tick.ask - tick.bid) / tick.price) * 100, slippagePercent: 0.05, metrics: { priceChangePercent: 0.2, orderBookImbalance: 0.1, volumeDelta: 12, buySellTradeRatio: 1.3, bidAskSpreadPercent: 0.02, breakoutDistancePercent: 0.1 } };
      const riskInput = {
        account: { balance: config.simulation.initialBalance, freeMargin: config.simulation.initialBalance },
        portfolio: { openPositions: portfolio.getOpenPositionsCount() },
        order: { rewardRiskRatio: 2, expectedNetProfitPercent: 0.5 },
        market: { spreadPercent: signalInput.spreadPercent, slippagePercent: 0.05 },
        wsHealthy: wsClient.isHealthy()
      };
      const size = positionSizer.calculate({ equity: config.simulation.initialBalance, entryPrice: tick.price || 1, stopLossPercent: config.risk.stopLossPercent, leverage: config.leverage });
      const executionInput = { symbol: tick.symbol || config.symbols[0], side: 'BUY', qty: size.qty, price: tick.price, feeRate: config.fees.takerFeeRate, slippagePercent: config.risk.maxSlippagePercent };
      const res = await simulationEngine.onTick({ signalInput, riskInput, executionInput });
      if (!res?.skipped) await notifier.sendTradeOpenedNotification({ symbol: executionInput.symbol, side: executionInput.side, qty: executionInput.qty });
    });
  }

  process.on('SIGINT', async () => {
    wsClient.close();
    await notifier.sendShutdownNotification();
    process.exit(0);
  });
}

main().catch((err) => {
  // Централизованный обработчик ошибок для безопасного завершения.
  console.error(err);
  process.exit(1);
});
