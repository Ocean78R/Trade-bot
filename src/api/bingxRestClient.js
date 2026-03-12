const crypto = require('crypto');
const { withRetry } = require('../utils/retry');

class BingXRestClient {
  constructor({ apiKey, apiSecret, baseUrl, logger }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  sign(query) {
    return crypto.createHmac('sha256', this.apiSecret).update(query).digest('hex');
  }

  async request(method, endpoint, params = {}, signed = false) {
    return withRetry(async () => {
      const timestamp = Date.now();
      const query = new URLSearchParams({ ...params, timestamp }).toString();
      const signedQuery = signed ? `${query}&signature=${this.sign(query)}` : query;
      const url = `${this.baseUrl}${endpoint}?${signedQuery}`;
      const headers = { 'X-BX-APIKEY': this.apiKey, 'Content-Type': 'application/json' };
      const res = await fetch(url, { method, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res.json();
    }, { retries: 4, baseDelayMs: 300 });
  }

  // VERIFY_WITH_BINGX_DOCS: пути и поля могут отличаться в актуальной версии API.
  getAccountBalance() { return this.request('GET', '/openApi/swap/v2/user/balance', {}, true); }
  getOpenPositions(symbol) { return this.request('GET', '/openApi/swap/v2/user/positions', { symbol }, true); }
  getOpenOrders(symbol) { return this.request('GET', '/openApi/swap/v2/trade/openOrders', { symbol }, true); }
  cancelOrder(symbol, orderId) { return this.request('POST', '/openApi/swap/v2/trade/cancel', { symbol, orderId }, true); }
  placeOrder(payload) { return this.request('POST', '/openApi/swap/v2/trade/order', payload, true); }
  getKlines(symbol, interval, limit = 300) { return this.request('GET', '/openApi/swap/v3/quote/klines', { symbol, interval, limit }); }
  getExchangeInfo() { return this.request('GET', '/openApi/swap/v2/quote/contracts'); }
}

module.exports = { BingXRestClient };
