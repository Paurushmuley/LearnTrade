import test from 'node:test';
import assert from 'node:assert/strict';

function validateWebhookPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Malformed JSON payload' };
  }

  const token = payload.token || payload.secret || payload.key;
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing authentication token' };
  }

  const rawSymbol = (payload.symbol || payload.ticker || '').toUpperCase().trim();
  if (!rawSymbol) {
    return { valid: false, error: 'Missing or invalid symbol' };
  }

  const rawSide = (payload.side || payload.action || '').toUpperCase().trim();
  if (rawSide !== 'BUY' && rawSide !== 'SELL') {
    return { valid: false, error: "Side must be either 'BUY' or 'SELL'" };
  }

  const rawQty = parseInt(payload.quantity || payload.qty || 0, 10);
  if (isNaN(rawQty) || rawQty <= 0) {
    return { valid: false, error: 'Quantity must be a positive integer greater than 0' };
  }

  return {
    valid: true,
    cleanPayload: {
      token,
      symbol: rawSymbol,
      side: rawSide,
      quantity: rawQty,
      type: (payload.type || 'MARKET').toUpperCase(),
      product: (payload.product || 'MIS').toUpperCase(),
    },
  };
}

function checkCircuitBreaker(bot) {
  if (!bot.enabled) {
    return { allowed: false, reason: `Bot '${bot.name}' is paused` };
  }
  if (bot.currentDailyLoss >= bot.maxDailyLoss) {
    return { allowed: false, reason: 'Circuit Breaker Tripped' };
  }
  return { allowed: true };
}

test('Webhook Ingestion - Valid TradingView Alert Payload', () => {
  const payload = {
    token: 'tc_sec_7a9f82d1b54c8e',
    symbol: 'reliance',
    side: 'buy',
    quantity: '50',
    type: 'market',
    product: 'mis',
  };

  const res = validateWebhookPayload(payload);
  assert.equal(res.valid, true);
  assert.equal(res.cleanPayload.symbol, 'RELIANCE');
  assert.equal(res.cleanPayload.side, 'BUY');
  assert.equal(res.cleanPayload.quantity, 50);
});

test('Webhook Ingestion - Rejects Invalid Token or Missing Fields', () => {
  const missingToken = { symbol: 'NIFTY 50', side: 'BUY', quantity: 25 };
  const res1 = validateWebhookPayload(missingToken);
  assert.equal(res1.valid, false);
  assert.equal(res1.error, 'Missing authentication token');

  const invalidSide = { token: 'tc_123', symbol: 'NIFTY 50', side: 'HOLD', quantity: 25 };
  const res2 = validateWebhookPayload(invalidSide);
  assert.equal(res2.valid, false);
});

test('Webhook Circuit Breaker - Trips when Max Loss Exceeded', () => {
  const botSafe = {
    name: 'Supertrend Bot',
    enabled: true,
    maxDailyLoss: 5000,
    currentDailyLoss: 2100,
  };
  assert.equal(checkCircuitBreaker(botSafe).allowed, true);

  const botTripped = {
    name: 'Supertrend Bot',
    enabled: true,
    maxDailyLoss: 5000,
    currentDailyLoss: 5200,
  };
  const res = checkCircuitBreaker(botTripped);
  assert.equal(res.allowed, false);
  assert.equal(res.reason, 'Circuit Breaker Tripped');
});
