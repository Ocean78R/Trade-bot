class PortfolioManager {
  constructor() {
    this.positions = new Map();
    this.realizedPnl = 0;
    this.fees = 0;
    this.trades = [];
  }

  open({ symbol, side, qty, price, fee }) {
    const pos = this.positions.get(symbol) || { symbol, side, qty: 0, avgPrice: 0, openedAt: Date.now(), averagingCount: 0, hedge: false };
    pos.avgPrice = (pos.avgPrice * pos.qty + price * qty) / (pos.qty + qty);
    pos.qty += qty;
    pos.side = side;
    pos.averagingCount += pos.qty > 0 ? 1 : 0;
    this.positions.set(symbol, pos);
    this.fees += fee;
    return { type: 'OPEN', symbol, qty, price, fee };
  }

  close({ symbol, qty, price, fee }) {
    const pos = this.positions.get(symbol);
    if (!pos) return null;
    const closingQty = Math.min(qty, pos.qty);
    const pnl = (pos.side === 'BUY' ? (price - pos.avgPrice) : (pos.avgPrice - price)) * closingQty;
    pos.qty -= closingQty;
    this.realizedPnl += pnl - fee;
    this.fees += fee;
    const trade = { symbol, qty: closingQty, entry: pos.avgPrice, exit: price, pnl: pnl - fee, fee, durationMs: Date.now() - pos.openedAt };
    this.trades.push(trade);
    if (pos.qty <= 0) this.positions.delete(symbol);
    return trade;
  }

  getOpenPositionsCount() { return this.positions.size; }
}

module.exports = { PortfolioManager };
