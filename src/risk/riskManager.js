class RiskManager {
  constructor(config) {
    this.config = config;
    this.riskOffMode = false;
  }

  evaluatePreTrade({ account, portfolio, order, market, wsHealthy }) {
    const checks = [];
    // Критический порог баланса: при достижении торговля прекращается.
    const stopTradingBalance = this.config.stopTradingBalance ?? this.config.minAccountBalance;
    if (account.balance <= stopTradingBalance) this.riskOffMode = true;
    checks.push(this.rule(account.balance >= this.config.minAccountBalance, 'balance below minimum'));
    checks.push(this.rule(account.balance > stopTradingBalance, 'balance reached stop-trading threshold'));
    checks.push(this.rule(account.freeMargin >= this.config.minFreeMargin, 'free margin too low'));
    checks.push(this.rule(portfolio.openPositions < this.config.maxConcurrentPositions, 'max concurrent positions reached'));
    checks.push(this.rule(order.rewardRiskRatio >= this.config.minRewardRiskRatio, 'reward/risk too low'));
    checks.push(this.rule(order.expectedNetProfitPercent >= this.config.minExpectedProfitPercent, 'expected net profit too low'));
    checks.push(this.rule(market.spreadPercent <= this.config.maxSpreadPercent, 'spread too high'));
    checks.push(this.rule(market.slippagePercent <= this.config.maxSlippagePercent, 'slippage too high'));
    checks.push(this.rule(wsHealthy, 'websocket degraded'));
    checks.push(this.rule(!this.riskOffMode, 'riskOffMode enabled'));

    return checks;
  }

  shouldActivateRiskOff({ drawdownPercent, marginUsagePercent, wsHealthy }) {
    const activate = drawdownPercent >= this.config.maxDrawdownPercent || marginUsagePercent >= this.config.maxMarginUsagePercent || !wsHealthy;
    if (activate) this.riskOffMode = true;
    return activate;
  }

  rule(allowed, reason) {
    return { allowed, reason: allowed ? '' : reason };
  }
}

module.exports = { RiskManager };
