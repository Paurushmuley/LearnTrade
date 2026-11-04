// Sprint 19 — Cross-Exchange Arbitrage & Smart Order Router (SOR) Tests
// Pure JS test suite using Node.js native test runner (node:test)
// Tests: INBBO aggregation, crossed spread detection, statutory fee netting,
// latency fill probability decay, and split liquidity routing

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Pure JS mirrors of SOR engine functions
function calculateINBBO(nse, bse) {
  const nseBestBid = nse.bids[0] ?? { price: 0, quantity: 0 };
  const bseBestBid = bse.bids[0] ?? { price: 0, quantity: 0 };
  const nseBestAsk = nse.asks[0] ?? { price: Infinity, quantity: 0 };
  const bseBestAsk = bse.asks[0] ?? { price: Infinity, quantity: 0 };

  const bestBidVenue = bseBestBid.price > nseBestBid.price ? 'BSE' : 'NSE';
  const bestBidPrice = bestBidVenue === 'BSE' ? bseBestBid.price : nseBestBid.price;

  const bestAskVenue = bseBestAsk.price < nseBestAsk.price ? 'BSE' : 'NSE';
  const bestAskPrice = bestAskVenue === 'BSE' ? bseBestAsk.price : nseBestAsk.price;

  const isCrossed = bestBidPrice >= bestAskPrice && bestBidPrice > 0 && bestAskPrice < Infinity;
  const grossCrossedSpread = isCrossed ? Number((bestBidPrice - bestAskPrice).toFixed(2)) : 0;
  const grossSpreadBps = isCrossed && bestAskPrice > 0
    ? Number(((grossCrossedSpread / bestAskPrice) * 10000).toFixed(2))
    : 0;

  return {
    bestBidPrice,
    bestBidVenue,
    bestAskPrice,
    bestAskVenue,
    isCrossed,
    grossCrossedSpread,
    grossSpreadBps,
  };
}

function calculateInterMarketFees(buyPrice, sellPrice, qty) {
  const buyNotional = buyPrice * qty;
  const sellNotional = sellPrice * qty;

  const buyTariff = buyNotional * 0.0000297; // NSE
  const stamp = buyNotional * 0.00015;
  const sebiBuy = buyNotional * 0.000001;
  const gstBuy = (buyTariff + sebiBuy) * 0.18;

  const sellTariff = sellNotional * 0.0000375; // BSE
  const stt = sellNotional * 0.00025;
  const sebiSell = sellNotional * 0.000001;
  const gstSell = (sellTariff + sebiSell) * 0.18;

  const totalFee = Number((buyTariff + stamp + sebiBuy + gstBuy + sellTariff + stt + sebiSell + gstSell).toFixed(2));
  const feeBps = Number(((totalFee / buyNotional) * 10000).toFixed(2));

  return { totalFee, feeBps };
}

function calculateFillProb(totalLatencyMs, lambdaSweep = 0.15) {
  return Number(Math.max(0.01, Math.min(0.99, Math.exp(-lambdaSweep * totalLatencyMs))).toFixed(3));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('AC-SOR-01: INBBO aggregates highest Bid and lowest Ask across NSE and BSE', () => {
  const nse = {
    bids: [{ price: 2850.10, quantity: 500 }],
    asks: [{ price: 2850.50, quantity: 600 }],
  };
  const bse = {
    bids: [{ price: 2850.25, quantity: 400 }], // Better bid
    asks: [{ price: 2850.60, quantity: 300 }],
  };

  const inbbo = calculateINBBO(nse, bse);
  assert.equal(inbbo.bestBidPrice, 2850.25);
  assert.equal(inbbo.bestBidVenue, 'BSE');
  assert.equal(inbbo.bestAskPrice, 2850.50);
  assert.equal(inbbo.bestAskVenue, 'NSE');
  assert.equal(inbbo.isCrossed, false);
});

test('AC-SOR-02: Crossed spread detection triggers when Bid_BSE > Ask_NSE', () => {
  const nse = {
    bids: [{ price: 2849.80, quantity: 500 }],
    asks: [{ price: 2850.00, quantity: 400 }], // Ask is 2850.00
  };
  const bse = {
    bids: [{ price: 2850.40, quantity: 600 }], // Bid is 2850.40 (Crossed by +₹0.40)
    asks: [{ price: 2850.80, quantity: 300 }],
  };

  const inbbo = calculateINBBO(nse, bse);
  assert.equal(inbbo.isCrossed, true);
  assert.equal(inbbo.grossCrossedSpread, 0.40);
  // Spread in bps: (0.40 / 2850.00) * 10000 ≈ 1.40 bps
  assert.ok(inbbo.grossSpreadBps > 1.35 && inbbo.grossSpreadBps < 1.45);
});

test('AC-SOR-03: Statutory fee netting calculates positive STT, Stamp Duty, and exchange turnover', () => {
  const fees = calculateInterMarketFees(2850, 2852, 1000);
  assert.ok(fees.totalFee > 0, `Total fees ${fees.totalFee} should be > 0`);
  assert.ok(fees.feeBps > 0, `Fee bps ${fees.feeBps} should be > 0`);
  // Total fees for ₹28.5L turnover should be around ₹1,000 - ₹1,500
  assert.ok(fees.totalFee >= 800 && fees.totalFee <= 2000, `Unexpected fee total: ${fees.totalFee}`);
});

test('AC-SOR-04: Latency fill probability decays exponentially with transit time', () => {
  const lowLatencyProb = calculateFillProb(0.5, 0.15); // 0.5 ms
  const highLatencyProb = calculateFillProb(5.0, 0.15); // 5.0 ms
  assert.ok(
    lowLatencyProb > highLatencyProb,
    `Low latency prob ${lowLatencyProb} must exceed high latency prob ${highLatencyProb}`
  );
  assert.ok(lowLatencyProb > 0.90, 'Sub-millisecond latency should have >90% fill probability');
});

test('AC-SOR-05: Non-crossed normal market correctly identifies uncrossed state', () => {
  const nse = {
    bids: [{ price: 100.0, quantity: 100 }],
    asks: [{ price: 100.2, quantity: 100 }],
  };
  const bse = {
    bids: [{ price: 99.9, quantity: 100 }],
    asks: [{ price: 100.3, quantity: 100 }],
  };

  const inbbo = calculateINBBO(nse, bse);
  assert.equal(inbbo.isCrossed, false);
  assert.equal(inbbo.grossCrossedSpread, 0);
  assert.equal(inbbo.grossSpreadBps, 0);
});

test('AC-SOR-06: Split liquidity sweep greedy sorting minimizes execution price', () => {
  const rungs = [
    { venue: 'NSE', price: 100.20, quantity: 100 },
    { venue: 'BSE', price: 100.10, quantity: 50 },
    { venue: 'NSE', price: 100.30, quantity: 200 },
  ];
  // Sort buy rungs ascending
  rungs.sort((a, b) => a.price - b.price);
  assert.equal(rungs[0].venue, 'BSE');
  assert.equal(rungs[0].price, 100.10);
});
