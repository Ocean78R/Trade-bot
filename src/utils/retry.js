/**
 * Повторяет асинхронную операцию с экспоненциальной задержкой.
 */
async function withRetry(fn, opts = {}) {
  const retries = opts.retries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const maxDelayMs = opts.maxDelayMs ?? 5000;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt));
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

module.exports = { withRetry };
