class BingXWsClient {
  constructor({ url, logger, heartbeatMs = 15000, staleMs = 10000 }) {
    this.url = url;
    this.logger = logger;
    this.heartbeatMs = heartbeatMs;
    this.staleMs = staleMs;
    this.ws = null;
    this.handlers = [];
    this.lastMessageTs = 0;
    this.seen = new Set();
    this.reconnectAttempt = 0;
  }

  onMessage(handler) { this.handlers.push(handler); }

  connect(subscriptions = []) {
    const WebSocketImpl = globalThis.WebSocket;
    if (!WebSocketImpl) throw new Error('WebSocket API is unavailable in this runtime');

    this.ws = new WebSocketImpl(this.url);
    this.ws.addEventListener('open', () => {
      this.logger.info('WS connected');
      this.reconnectAttempt = 0;
      subscriptions.forEach((s) => this.ws.send(JSON.stringify(s)));
      this.heartbeatTimer = setInterval(() => {
        if (Date.now() - this.lastMessageTs > this.staleMs) this.logger.warn('WS data stale');
      }, this.heartbeatMs);
    });

    this.ws.addEventListener('message', (event) => {
      this.lastMessageTs = Date.now();
      let data;
      try { data = JSON.parse(String(event.data)); } catch { return; }
      const key = `${data?.eventTime || data?.E || ''}-${data?.s || ''}-${data?.id || ''}`;
      if (this.seen.has(key)) return;
      this.seen.add(key);
      if (this.seen.size > 10000) this.seen.clear();
      this.handlers.forEach((h) => h(this.normalize(data)));
    });

    this.ws.addEventListener('close', () => this.reconnect(subscriptions));
    this.ws.addEventListener('error', (e) => this.logger.error('WS error', { err: e?.message || 'unknown ws error' }));
  }

  normalize(data) {
    return {
      symbol: data.s || data.symbol,
      price: Number(data.p || data.price),
      bid: Number(data.b || data.bidPrice),
      ask: Number(data.a || data.askPrice),
      ts: data.E || Date.now(),
      raw: data
    };
  }

  reconnect(subscriptions) {
    clearInterval(this.heartbeatTimer);
    const delay = Math.min(10000, 500 * (2 ** this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.logger.warn('WS reconnect scheduled', { delay });
    setTimeout(() => this.connect(subscriptions), delay);
  }

  close() {
    clearInterval(this.heartbeatTimer);
    this.ws?.close();
  }

  isHealthy() {
    return Date.now() - this.lastMessageTs <= this.staleMs;
  }
}

module.exports = { BingXWsClient };
