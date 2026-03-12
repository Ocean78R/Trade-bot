const test = require('node:test');
const assert = require('node:assert/strict');
const { PositionSizer } = require('../src/risk/positionSizer');

test('risk based sizing returns positive quantity', () => {
  const sizer = new PositionSizer({
    positionSizingMode: 'riskBased',
    maxRiskPerTradePercent: 1,
    feeBufferPercent: 0.05,
    slippageBufferPercent: 0.05
  });

  const res = sizer.calculate({ equity: 10000, entryPrice: 50000, stopLossPercent: 1, leverage: 5 });
  assert.ok(res.qty > 0);
  assert.ok(res.notional > 0);
});
