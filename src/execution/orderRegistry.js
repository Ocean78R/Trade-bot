/**
 * Реестр для защиты от повторной отправки ордеров.
 */
class OrderRegistry {
  constructor() { this.active = new Set(); }
  makeKey(symbol, side, clientOrderId) { return `${symbol}:${side}:${clientOrderId}`; }
  lock(symbol, side, clientOrderId) {
    const key = this.makeKey(symbol, side, clientOrderId);
    if (this.active.has(key)) return false;
    this.active.add(key);
    return true;
  }
  release(symbol, side, clientOrderId) { this.active.delete(this.makeKey(symbol, side, clientOrderId)); }
}

module.exports = { OrderRegistry };
