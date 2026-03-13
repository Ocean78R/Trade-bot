const crypto = require('crypto');

class LiveExecutionAdapter {
  constructor({ restClient, orderRegistry, logger }) {
    this.restClient = restClient;
    this.orderRegistry = orderRegistry;
    this.logger = logger;
  }

  async openPosition({ symbol, side, qty, price }) {
    const lockKey = `${symbol}:${side}:open`;
    const clientOrderId = crypto.randomUUID();
    if (!this.orderRegistry.lock(symbol, side, lockKey)) {
      throw new Error('Duplicate order submission blocked');
    }
    try {
      return await this.restClient.placeOrder({
        symbol,
        side,
        type: 'MARKET',
        quantity: qty,
        clientOrderId
      });
    } finally {
      this.orderRegistry.release(symbol, side, lockKey);
    }
  }

  async closePosition({ symbol, side, qty }) {
    return this.restClient.placeOrder({ symbol, side, type: 'MARKET', quantity: qty, reduceOnly: true });
  }
}

module.exports = { LiveExecutionAdapter };
