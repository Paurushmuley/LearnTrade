import test from 'node:test';
import assert from 'node:assert/strict';

// Normal CDF approximation
function normalCDF(x) {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * x);
    return c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

function calculateBlackScholes(S, K, T, r = 0.065, v = 0.14) {
  const time = Math.max(T, 0.0001);
  const d1 = (Math.log(S / K) + (r + (v * v) / 2.0) * time) / (v * Math.sqrt(time));
  const d2 = d1 - v * Math.sqrt(time);

  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const NminusD1 = normalCDF(-d1);
  const NminusD2 = normalCDF(-d2);

  const callPrice = S * Nd1 - K * Math.exp(-r * time) * Nd2;
  const putPrice = K * Math.exp(-r * time) * NminusD2 - S * NminusD1;

  return {
    callPrice: Number(callPrice.toFixed(2)),
    putPrice: Number(putPrice.toFixed(2)),
    callDelta: Number(Nd1.toFixed(3)),
    putDelta: Number((Nd1 - 1.0).toFixed(3)),
  };
}

test('Black-Scholes Options Pricing - ATM Call & Put', () => {
  // S = 24000, K = 24000, 5 days to expiry (T = 5/365)
  const bs = calculateBlackScholes(24000, 24000, 5 / 365, 0.065, 0.14);

  assert.ok(bs.callPrice > 100 && bs.callPrice < 250);
  assert.ok(bs.putPrice > 80 && bs.putPrice < 230);
  assert.ok(bs.callDelta >= 0.45 && bs.callDelta <= 0.55);
  assert.ok(bs.putDelta >= -0.55 && bs.putDelta <= -0.45);
  // Put-Call parity delta relation: Call Delta - Put Delta = 1
  assert.equal(Math.round(bs.callDelta - bs.putDelta), 1);
});

test('Multi-Leg Options Payoff - Bull Call Spread Defined Risk', () => {
  // Buy 24000 CE @ 150, Sell 24200 CE @ 60
  // Net Debit = 90
  // Max Loss = 90 * lot (e.g. 25) = 2250
  // Max Profit = (200 - 90) * lot = 110 * 25 = 2750
  // Breakeven = 24000 + 90 = 24090
  const strike1 = 24000;
  const strike2 = 24200;
  const buyPrem = 150;
  const sellPrem = 60;
  const netDebit = buyPrem - sellPrem; // 90
  const lot = 25;

  const maxLoss = netDebit * lot;
  const maxProfit = (strike2 - strike1 - netDebit) * lot;
  const breakeven = strike1 + netDebit;

  assert.equal(maxLoss, 2250);
  assert.equal(maxProfit, 2750);
  assert.equal(breakeven, 24090);
});
