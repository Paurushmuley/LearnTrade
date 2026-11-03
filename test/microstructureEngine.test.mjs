import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure algorithmic functions for Level-3 microstructure verification
function calculateMicroPrice(bestBidPrice, bestBidQty, bestAskPrice, bestAskQty, tickSize = 0.05) {
  const midPrice = (bestBidPrice + bestAskPrice) / 2;
  const spread = Math.max(0, bestAskPrice - bestBidPrice);
  const totalTopQty = bestBidQty + bestAskQty;

  if (totalTopQty <= 0) {
    return {
      microPrice: Number(midPrice.toFixed(2)),
      midPrice: Number(midPrice.toFixed(2)),
      microPriceBiasTicks: 0,
      spread: Number(spread.toFixed(2))
    };
  }

  const microPrice = (bestBidQty * bestAskPrice + bestAskQty * bestBidPrice) / totalTopQty;
  const diff = microPrice - midPrice;
  const microPriceBiasTicks = tickSize > 0 ? Number((diff / tickSize).toFixed(2)) : 0;

  return {
    microPrice: Number(microPrice.toFixed(2)),
    midPrice: Number(midPrice.toFixed(2)),
    microPriceBiasTicks,
    spread: Number(spread.toFixed(2))
  };
}

function calculateOrderBookImbalance(bids, asks, depth = 5) {
  const k = Math.max(1, depth);
  const sumBid = bids.slice(0, k).reduce((acc, r) => acc + r.visibleQuantity, 0);
  const sumAsk = asks.slice(0, k).reduce((acc, r) => acc + r.visibleQuantity, 0);
  const total = sumBid + sumAsk;

  if (total <= 0) return 0;
  return Number(Math.max(-1, Math.min(1, (sumBid - sumAsk) / total)).toFixed(4));
}

function calculateWeightedImbalance(bids, asks, depth = 10) {
  const k = Math.max(1, depth);
  let weightedBid = 0;
  let weightedAsk = 0;

  for (let i = 0; i < k; i++) {
    const weight = 1 / (i + 1);
    if (bids[i]) weightedBid += bids[i].visibleQuantity * weight;
    if (asks[i]) weightedAsk += asks[i].visibleQuantity * weight;
  }

  const total = weightedBid + weightedAsk;
  if (total <= 0) return 0;
  return Number(Math.max(-1, Math.min(1, (weightedBid - weightedAsk) / total)).toFixed(4));
}

function analyzeRungForIceberg(rung, symbol, side) {
  if (rung.visibleQuantity <= 0) return null;

  const reloadFactor = rung.cumulativeTradedVolume / rung.visibleQuantity;
  if (reloadFactor < 2.0 && rung.reloadCount < 2) {
    return null;
  }

  const effectiveReloads = Math.max(reloadFactor, rung.reloadCount);
  const expansionFactor = 1 + 1 / Math.log(effectiveReloads + 1);
  const estimatedTotalSize = Math.round(rung.cumulativeTradedVolume * expansionFactor);
  const estimatedHiddenVolume = Math.max(0, estimatedTotalSize - rung.cumulativeTradedVolume);
  const exhaustionPercent = Math.min(
    100,
    Number(((rung.cumulativeTradedVolume / estimatedTotalSize) * 100).toFixed(1))
  );

  const confidenceScore = Math.min(100, Math.round(50 + effectiveReloads * 10));

  let severity = 'NOTABLE';
  if (effectiveReloads >= 5.0 || estimatedTotalSize >= 25000) {
    severity = 'INSTITUTIONAL_WHALE';
  } else if (effectiveReloads >= 3.0 || estimatedTotalSize >= 10000) {
    severity = 'HEAVY';
  }

  return {
    id: `ICEBERG-${symbol}-${side}-${rung.price.toFixed(2)}`,
    symbol,
    side,
    price: rung.price,
    detectedReloads: Math.round(effectiveReloads),
    cumulativeVolumeTraded: rung.cumulativeTradedVolume,
    visibleDisplaySize: rung.visibleQuantity,
    estimatedTotalSize,
    estimatedHiddenVolume,
    exhaustionPercent,
    confidenceScore,
    severity
  };
}

function calculateVPIN(volumeBuckets) {
  if (!volumeBuckets || volumeBuckets.length === 0) {
    return { vpinScore: 0.2, toxicityStatus: 'CALM' };
  }

  let totalImbalance = 0;
  let totalVolume = 0;

  for (const bucket of volumeBuckets) {
    totalImbalance += Math.abs(bucket.buyVolume - bucket.sellVolume);
    totalVolume += bucket.buyVolume + bucket.sellVolume;
  }

  if (totalVolume <= 0) {
    return { vpinScore: 0.2, toxicityStatus: 'CALM' };
  }

  const vpinScore = Number(Math.min(1.0, Math.max(0.0, totalImbalance / totalVolume)).toFixed(4));

  let toxicityStatus = 'CALM';
  if (vpinScore > 0.6) {
    toxicityStatus = 'TOXIC_SWEEP';
  } else if (vpinScore > 0.35) {
    toxicityStatus = 'MODERATE';
  }

  return { vpinScore, toxicityStatus };
}

function filterInstitutionalBlockDeals(trades, vwapPrice) {
  const blocks = [];

  for (const trade of trades) {
    const turnover = trade.price * trade.quantity;
    const turnoverCrores = Number((turnover / 10_000_000).toFixed(2));

    const isSebiBlock = turnoverCrores >= 10.0;
    const isLargeBulkSweep = turnoverCrores >= 2.0 && trade.quantity >= 10000;

    if (isSebiBlock || isLargeBulkSweep) {
      const vwap = vwapPrice || trade.price;
      const isAboveVWAP = trade.price >= vwap;
      const premiumOrDiscountPct = Number((((trade.price - vwap) / vwap) * 100).toFixed(2));

      let venue = 'CONTINUOUS_MARKET';
      if (isSebiBlock) {
        venue = 'WINDOW_1_OPEN';
      }

      let participant = 'FII';
      if (turnoverCrores > 50) participant = 'FII';
      else if (turnoverCrores > 20) participant = 'DII';
      else if (turnoverCrores > 10) participant = 'PROP_DESK';
      else participant = 'PROMOTER_CROSS';

      blocks.push({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        turnoverCrores,
        exchange: trade.exchange || 'NSE',
        venue,
        participant,
        isAboveVWAP,
        premiumOrDiscountPct
      });
    }
  }

  return blocks;
}

describe('Level-3 Order Book Analytics & Microstructure Engine', () => {
  test('AC-L3-01: Micro-Price weights queue imbalance and correctly deviates from Mid-Price', () => {
    // Symmetrical queues: P_micro must equal Mid-Price
    const symm = calculateMicroPrice(24500.0, 5000, 24500.5, 5000, 0.05);
    assert.equal(symm.midPrice, 24500.25);
    assert.equal(symm.microPrice, 24500.25);
    assert.equal(symm.microPriceBiasTicks, 0);

    // Heavy Bid Queue (10,000 vs 1,000): Micro-Price should skew toward Best Ask (bullish pressure)
    const bullish = calculateMicroPrice(24500.0, 10000, 24500.5, 1000, 0.05);
    assert.ok(
      bullish.microPrice > bullish.midPrice,
      `Micro-price (${bullish.microPrice}) must exceed mid-price (${bullish.midPrice}) on heavy bid queue`
    );
    assert.ok(bullish.microPriceBiasTicks > 0, 'Bias ticks must be positive');

    // Heavy Ask Queue (1,000 vs 10,000): Micro-Price should skew toward Best Bid (bearish pressure)
    const bearish = calculateMicroPrice(24500.0, 1000, 24500.5, 10000, 0.05);
    assert.ok(
      bearish.microPrice < bearish.midPrice,
      `Micro-price (${bearish.microPrice}) must be below mid-price (${bearish.midPrice}) on heavy ask queue`
    );
    assert.ok(bearish.microPriceBiasTicks < 0, 'Bias ticks must be negative');
  });

  test('AC-L3-02: Multi-Depth Order Book Imbalance (OBI) respects [-1.0, +1.0] bounds', () => {
    const bids = [
      { visibleQuantity: 2000 },
      { visibleQuantity: 3000 },
      { visibleQuantity: 1500 },
      { visibleQuantity: 2500 },
      { visibleQuantity: 1000 }
    ];
    const asks = [
      { visibleQuantity: 1000 },
      { visibleQuantity: 1000 },
      { visibleQuantity: 1000 },
      { visibleQuantity: 1000 },
      { visibleQuantity: 1000 }
    ];

    const obi5 = calculateOrderBookImbalance(bids, asks, 5);
    // sumBid = 10000, sumAsk = 5000 -> OBI = (10000 - 5000)/15000 = 5000/15000 = +0.3333
    assert.ok(obi5 > 0.33 && obi5 < 0.34, `OBI5 should be approx 0.3333, got ${obi5}`);
    assert.ok(obi5 >= -1.0 && obi5 <= 1.0, 'OBI must be bounded in [-1.0, 1.0]');

    // Weighted imbalance with top-level weight priority
    const weightedOBI = calculateWeightedImbalance(bids, asks, 5);
    assert.ok(weightedOBI >= -1.0 && weightedOBI <= 1.0);
    assert.ok(weightedOBI > 0, 'Weighted OBI should be positive for heavier bid ladder');
  });

  test('AC-L3-03: Statistical Iceberg Detection identifies repetitive fills (Reload Factor >= 2.0)', () => {
    // Normal retail rung: 2,000 visible, only 800 executed (Reload factor 0.4)
    const normalRung = {
      price: 2450.0,
      visibleQuantity: 2000,
      cumulativeTradedVolume: 800,
      reloadCount: 0
    };
    const noAlert = analyzeRungForIceberg(normalRung, 'RELIANCE', 'BUY');
    assert.equal(noAlert, null, 'Normal retail order must not be flagged as iceberg');

    // Institutional Iceberg rung: 1,500 visible, but 6,500 cumulative volume executed (Reload factor 4.33)
    const icebergRung = {
      price: 2450.0,
      visibleQuantity: 1500,
      cumulativeTradedVolume: 6500,
      reloadCount: 4
    };
    const alert = analyzeRungForIceberg(icebergRung, 'RELIANCE', 'BUY');
    assert.ok(alert !== null, 'Should detect iceberg when reload factor >= 2.0');
    assert.equal(alert.symbol, 'RELIANCE');
    assert.equal(alert.side, 'BUY');
    assert.equal(alert.price, 2450.0);
    assert.ok(alert.estimatedTotalSize > alert.cumulativeVolumeTraded, 'Total inferred size must exceed executed volume');
    assert.ok(alert.estimatedHiddenVolume > 0, 'Hidden volume must be positive');
    assert.ok(alert.exhaustionPercent > 0 && alert.exhaustionPercent <= 100, 'Exhaustion % must be valid');
    assert.ok(['NOTABLE', 'HEAVY', 'INSTITUTIONAL_WHALE'].includes(alert.severity));
  });

  test('AC-L3-04: VPIN Flow Toxicity model detects toxic aggressive sweeps', () => {
    // Balanced calm trading
    const calmBuckets = [
      { buyVolume: 10000, sellVolume: 9500 },
      { buyVolume: 10200, sellVolume: 10100 },
      { buyVolume: 9800, sellVolume: 10300 }
    ];
    const calmResult = calculateVPIN(calmBuckets);
    assert.ok(calmResult.vpinScore < 0.35, `VPIN score should be calm, got ${calmResult.vpinScore}`);
    assert.equal(calmResult.toxicityStatus, 'CALM');

    // Predatory aggressive sweep (huge unilateral buying)
    const toxicBuckets = [
      { buyVolume: 50000, sellVolume: 2000 },
      { buyVolume: 65000, sellVolume: 3500 },
      { buyVolume: 48000, sellVolume: 1500 }
    ];
    const toxicResult = calculateVPIN(toxicBuckets);
    assert.ok(toxicResult.vpinScore > 0.60, `VPIN score should exceed 0.60 on toxic sweep, got ${toxicResult.vpinScore}`);
    assert.equal(toxicResult.toxicityStatus, 'TOXIC_SWEEP');
  });

  test('AC-L3-05: SEBI Institutional Block Deal Filter captures trades >= ₹10 Crore', () => {
    const trades = [
      // 5,000 shares @ ₹2,500 = ₹1.25 Crore (below SEBI Block Window threshold)
      { id: 'T-1', symbol: 'RELIANCE', side: 'BUY', price: 2500, quantity: 5000 },
      // 50,000 shares @ ₹2,500 = ₹12.50 Crore (EXCEEDS SEBI Block Window threshold >= ₹10 Cr)
      { id: 'T-2', symbol: 'RELIANCE', side: 'BUY', price: 2500, quantity: 50000 },
      // 2,50,000 shares @ ₹1,500 = ₹37.50 Crore (Large Institutional Block Deal)
      { id: 'T-3', symbol: 'INFY', side: 'SELL', price: 1500, quantity: 250000 }
    ];

    const blocks = filterInstitutionalBlockDeals(trades, 2500);
    assert.equal(blocks.length, 2, 'Should capture exactly 2 trades exceeding institutional thresholds');
    assert.equal(blocks[0].turnoverCrores, 12.5);
    assert.equal(blocks[0].symbol, 'RELIANCE');
    assert.equal(blocks[1].turnoverCrores, 37.5);
    assert.equal(blocks[1].symbol, 'INFY');
    assert.ok(blocks[0].turnoverCrores >= 10.0);
    assert.ok(['FII', 'DII', 'PROP_DESK'].includes(blocks[0].participant));
  });
});
