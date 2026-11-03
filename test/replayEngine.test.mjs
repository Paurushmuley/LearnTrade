import test from 'node:test';
import assert from 'node:assert/strict';

function sliceCandlesForReplay(allCandles, playheadIndex) {
  if (!allCandles || allCandles.length === 0) return [];
  const safeIndex = Math.min(Math.max(1, playheadIndex), allCandles.length - 1);
  return allCandles.slice(0, safeIndex + 1);
}

function generateLevel2DOM(currentPrice, tickSize = 0.05) {
  const p = Number(currentPrice.toFixed(2));
  const bids = [];
  const asks = [];
  let totalBidQty = 0;
  let totalAskQty = 0;

  for (let i = 1; i <= 5; i++) {
    const askPrice = Number((p + i * tickSize).toFixed(2));
    const qty = 5000 + i * 200;
    totalAskQty += qty;
    asks.push({ price: askPrice, quantity: qty });
  }

  for (let i = 1; i <= 5; i++) {
    const bidPrice = Number((p - i * tickSize).toFixed(2));
    const qty = 6000 + i * 300;
    totalBidQty += qty;
    bids.push({ price: bidPrice, quantity: qty });
  }

  const spread = Number((asks[0].price - bids[0].price).toFixed(2));
  const totalVolume = totalBidQty + totalAskQty;
  const imbalancePercent = Number((((totalBidQty - totalAskQty) / totalVolume) * 100).toFixed(1));

  return { bids, asks, spread, totalBidQty, totalAskQty, imbalancePercent };
}

test('Bar Replay Engine - Slices Candles strictly up to Playhead', () => {
  const mockCandles = Array.from({ length: 100 }, (_, i) => ({
    time: 1000 + i * 300,
    open: 2800 + i,
    high: 2805 + i,
    low: 2795 + i,
    close: 2802 + i,
  }));

  const sliced30 = sliceCandlesForReplay(mockCandles, 30);
  assert.equal(sliced30.length, 31); // indices 0 to 30
  assert.equal(sliced30[30].time, 1000 + 30 * 300);

  // Clamp out of bounds
  const slicedOver = sliceCandlesForReplay(mockCandles, 150);
  assert.equal(slicedOver.length, 100);
});

test('Level-2 Market Depth DOM - 5 Bids and 5 Asks with positive spread', () => {
  const dom = generateLevel2DOM(2840.50, 0.05);

  assert.equal(dom.bids.length, 5);
  assert.equal(dom.asks.length, 5);

  // Asks must be increasing
  for (let i = 1; i < dom.asks.length; i++) {
    assert.ok(dom.asks[i].price > dom.asks[i - 1].price);
  }

  // Bids must be decreasing
  for (let i = 1; i < dom.bids.length; i++) {
    assert.ok(dom.bids[i].price < dom.bids[i - 1].price);
  }

  // Spread check: Ask 1 > Bid 1
  assert.ok(dom.asks[0].price > dom.bids[0].price);
  assert.equal(dom.spread, 0.10); // (2840.55 - 2840.45)
  assert.ok(typeof dom.imbalancePercent === 'number');
});
