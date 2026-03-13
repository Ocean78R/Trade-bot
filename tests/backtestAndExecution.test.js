const test = require('node:test');
const assert = require('node:assert/strict');

const { BacktestEngine } = require('../src/backtest/backtestEngine');
const { LiveExecutionAdapter } = require('../src/execution/liveExecutionAdapter');
const { OrderRegistry } = require('../src/execution/orderRegistry');

test('backtest engine passes only candle history up to current tick', async () => {
  const snapshots = [];
  const simulationEngine = {
    async onTick(ctx) {
      snapshots.push(ctx.signalInput.candles.map((c) => c.close));
    }
  };
  const analytics = {
    onCandle() {},
    buildReport() { return { metrics: {} }; }
  };

  const backtestEngine = new BacktestEngine({ simulationEngine, analytics, logger: console });
  const candles = [
    { close: 100, volume: 1 },
    { close: 110, volume: 1 },
    { close: 120, volume: 1 }
  ];

  await backtestEngine.run(candles, {
    signalInput: {
      candles,
      currentPrice: 120,
      volume: 1,
      spreadPercent: 0.01,
      slippagePercent: 0.01
    }
  });

  assert.deepEqual(snapshots, [[100], [100, 110], [100, 110, 120]]);
});


test('backtest engine skips strategy execution during configured warm-up bars', async () => {
  const processedHistoryLengths = [];
  const simulationEngine = {
    async onTick(ctx) {
      processedHistoryLengths.push(ctx.signalInput.candles.length);
    }
  };
  let analyticsCandles = 0;
  const analytics = {
    onCandle() { analyticsCandles += 1; },
    buildReport() { return { metrics: {} }; }
  };

  const backtestEngine = new BacktestEngine({ simulationEngine, analytics, logger: console });
  const candles = Array.from({ length: 8 }, (_, i) => ({ close: 100 + i, volume: 1 }));

  await backtestEngine.run(candles, {
    signalInput: {
      candles,
      currentPrice: 107,
      volume: 1,
      spreadPercent: 0.01,
      slippagePercent: 0.01,
      warmupBars: 5
    }
  });

  assert.equal(analyticsCandles, candles.length);
  assert.deepEqual(processedHistoryLengths, [5, 6, 7, 8]);
});

test('live execution adapter blocks duplicate open requests while first is in flight', async () => {
  let resolveFirstOrder;
  const firstOrderPlaced = new Promise((resolve) => {
    resolveFirstOrder = resolve;
  });

  const restClient = {
    placeOrder: async () => {
      await firstOrderPlaced;
      return { ok: true };
    }
  };

  const adapter = new LiveExecutionAdapter({
    restClient,
    orderRegistry: new OrderRegistry(),
    logger: console
  });

  const firstPromise = adapter.openPosition({ symbol: 'BTC-USDT', side: 'BUY', qty: 1, price: 50000 });

  await assert.rejects(
    () => adapter.openPosition({ symbol: 'BTC-USDT', side: 'BUY', qty: 1, price: 50000 }),
    /Duplicate order submission blocked/
  );

  resolveFirstOrder();
  await firstPromise;
});
