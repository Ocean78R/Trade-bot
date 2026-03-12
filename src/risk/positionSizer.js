/**
 * Расчет размера позиции с учетом режима и комиссий.
 */
class PositionSizer {
  constructor(config) { this.config = config; }

  calculate({ equity, entryPrice, stopLossPercent, leverage }) {
    const mode = this.config.positionSizingMode;
    let notional = 0;
    if (mode === 'fixedMargin') notional = this.config.baseMarginPerTrade * leverage;
    if (mode === 'fixedNotional') notional = this.config.baseNotionalPerTrade;
    if (mode === 'balancePercent') notional = equity * (this.config.balanceAllocationPercent / 100) * leverage;
    if (mode === 'riskBased') {
      const allowedLoss = equity * (this.config.maxRiskPerTradePercent / 100);
      const lossPerUnit = entryPrice * (stopLossPercent / 100);
      const qty = allowedLoss / lossPerUnit;
      notional = qty * entryPrice;
    }

    const feePct = this.config.feeBufferPercent / 100;
    const slipPct = this.config.slippageBufferPercent / 100;
    const adjustedNotional = notional * (1 - feePct - slipPct);
    const qty = adjustedNotional / entryPrice;

    return {
      notional: Math.max(0, adjustedNotional),
      qty: Math.max(0, qty),
      expectedFee: adjustedNotional * feePct,
      expectedSlippage: adjustedNotional * slipPct
    };
  }
}

module.exports = { PositionSizer };
