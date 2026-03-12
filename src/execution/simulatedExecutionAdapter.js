class SimulatedExecutionAdapter {
  constructor({ portfolio, logger }) {
    this.portfolio = portfolio;
    this.logger = logger;
  }

  async openPosition({ symbol, side, qty, price, feeRate, slippagePercent }) {
    const slipPrice = side === 'BUY' ? price * (1 + slippagePercent / 100) : price * (1 - slippagePercent / 100);
    const fee = qty * slipPrice * feeRate;
    return this.portfolio.open({ symbol, side, qty, price: slipPrice, fee });
  }

  async closePosition({ symbol, side, qty, price, feeRate, slippagePercent }) {
    const slipPrice = side === 'SELL' ? price * (1 - slippagePercent / 100) : price * (1 + slippagePercent / 100);
    const fee = qty * slipPrice * feeRate;
    return this.portfolio.close({ symbol, side, qty, price: slipPrice, fee });
  }
}

module.exports = { SimulatedExecutionAdapter };
