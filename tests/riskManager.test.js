const test = require('node:test');
const assert = require('node:assert/strict');
const { RiskManager } = require('../src/risk/riskManager');

test('risk manager blocks low margin', () => {
  const rm = new RiskManager({
    minAccountBalance: 100,
    stopTradingBalance: 80,
    minFreeMargin: 50,
    maxConcurrentPositions: 2,
    minRewardRiskRatio: 1.5,
    minExpectedProfitPercent: 0.2,
    maxSpreadPercent: 0.1,
    maxSlippagePercent: 0.1,
    maxDrawdownPercent: 10,
    maxMarginUsagePercent: 70
  });

  const checks = rm.evaluatePreTrade({
    account: { balance: 1000, freeMargin: 10 },
    portfolio: { openPositions: 0 },
    order: { rewardRiskRatio: 2, expectedNetProfitPercent: 0.3 },
    market: { spreadPercent: 0.02, slippagePercent: 0.02 },
    wsHealthy: true
  });

  assert.equal(checks.some((c) => c.allowed === false), true);
});

test('risk manager activates stop-trading threshold by balance', () => {
  const rm = new RiskManager({
    minAccountBalance: 100,
    stopTradingBalance: 80,
    minFreeMargin: 50,
    maxConcurrentPositions: 2,
    minRewardRiskRatio: 1.5,
    minExpectedProfitPercent: 0.2,
    maxSpreadPercent: 0.1,
    maxSlippagePercent: 0.1,
    maxDrawdownPercent: 10,
    maxMarginUsagePercent: 70
  });

  const checks = rm.evaluatePreTrade({
    account: { balance: 80, freeMargin: 100 },
    portfolio: { openPositions: 0 },
    order: { rewardRiskRatio: 2, expectedNetProfitPercent: 0.3 },
    market: { spreadPercent: 0.02, slippagePercent: 0.02 },
    wsHealthy: true
  });

  assert.equal(rm.riskOffMode, true);
  assert.equal(checks.some((c) => c.reason === 'balance reached stop-trading threshold'), true);
});
