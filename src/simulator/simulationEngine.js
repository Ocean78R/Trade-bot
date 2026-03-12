class SimulationEngine {
  constructor({ strategy, execution, riskManager, logger }) {
    this.strategy = strategy;
    this.execution = execution;
    this.riskManager = riskManager;
    this.logger = logger;
  }

  async onTick(ctx) {
    const signal = this.strategy.generateEntrySignal(ctx.signalInput);
    const checks = this.riskManager.evaluatePreTrade(ctx.riskInput);
    const decision = this.strategy.validateEntry({ signal, riskChecks: checks });
    if (!decision.allowed) return { skipped: true, decision };
    return this.execution.openPosition(ctx.executionInput);
  }
}

module.exports = { SimulationEngine };
