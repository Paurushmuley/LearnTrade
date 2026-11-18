// Sprint 25 — Real-Time Order Flow Toxicity, Volume-Synchronized Probability of Toxicity (VPIN)
// & Informed Trading Microstructure Engine Tests
// Pure JS test suite using Node.js native test runner (node:test, node:assert/strict)
// Zero external flags, zero direct TypeScript imports, runs natively with node --test

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// PURE MATHEMATICAL & ALGORITHMIC MIRROR IMPLEMENTATION FOR NODE.JS TEST RUNNER
// ============================================================================

/**
 * High-precision Abramowitz & Stegun approximation of Standard Normal CDF Φ(z)
 */
function normalCDF(z) {
  if (isNaN(z)) return 0.5;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.3989422804014327; // 1 / sqrt(2*pi)

  if (z >= 0.0) {
    const t = 1.0 / (1.0 + p * z);
    return 1.0 - c * Math.exp(-z * z / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * z);
    return c * Math.exp(-z * z / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

/**
 * Bulk Volume Classification (BVC) (Easley, López de Prado, O'Hara, 2012)
 * Partitions bar volume into buy and sell portions via Φ(ΔP / σ_ΔP).
 * Guarantees buyVolume + sellVolume === totalVolume.
 */
function calculateBVC(priceChange, sigmaDeltaP, totalVolume) {
  if (totalVolume <= 0) {
    return {
      priceChange,
      sigmaDeltaP: Math.max(sigmaDeltaP, 1e-6),
      zScore: 0,
      buyFraction: 0.5,
      buyVolume: 0,
      sellVolume: 0,
      totalVolume: 0
    };
  }

  const sigma = Math.max(sigmaDeltaP, 1e-6);
  const zScore = priceChange / sigma;
  const buyFraction = normalCDF(zScore);
  const buyVolume = Math.round(totalVolume * buyFraction);
  const sellVolume = totalVolume - buyVolume; // Strict conservation: buy + sell == total

  return {
    priceChange,
    sigmaDeltaP: sigma,
    zScore: Number(zScore.toFixed(4)),
    buyFraction: Number(buyFraction.toFixed(4)),
    buyVolume,
    sellVolume,
    totalVolume
  };
}

/**
 * Volume-Clock Bucket Aggregator
 * Partitions sequential incoming trade bars into buckets of constant size V.
 * Handles split fills across bucket boundaries with exact volume preservation.
 */
function aggregateVolumeBuckets(bars, bucketSize = 10000) {
  if (!bars || bars.length === 0 || bucketSize <= 0) {
    return { completedBuckets: [], partialBucket: null };
  }

  const completedBuckets = [];
  let currentBucket = {
    bucketId: 1,
    bucketSize,
    volume: 0,
    buyVolume: 0,
    sellVolume: 0,
    imbalance: 0,
    vwap: 0,
    weightedPriceSum: 0
  };

  for (const bar of bars) {
    let remainingBarVol = bar.volume;
    const buyRatio = bar.volume > 0 ? bar.buyVolume / bar.volume : 0.5;
    const barPrice = bar.close || bar.price || 0;

    while (remainingBarVol > 0) {
      const spaceInBucket = bucketSize - currentBucket.volume;
      const fillVol = Math.min(remainingBarVol, spaceInBucket);

      const fillBuy = fillVol * buyRatio;
      const fillSell = fillVol * (1 - buyRatio);

      currentBucket.volume += fillVol;
      currentBucket.buyVolume += fillBuy;
      currentBucket.sellVolume += fillSell;
      currentBucket.weightedPriceSum += barPrice * fillVol;
      remainingBarVol -= fillVol;

      if (currentBucket.volume >= bucketSize) {
        currentBucket.buyVolume = Math.round(currentBucket.buyVolume);
        currentBucket.sellVolume = bucketSize - currentBucket.buyVolume;
        currentBucket.imbalance = Math.abs(currentBucket.buyVolume - currentBucket.sellVolume);
        currentBucket.vwap = currentBucket.volume > 0
          ? Number((currentBucket.weightedPriceSum / currentBucket.volume).toFixed(2))
          : barPrice;

        completedBuckets.push({
          bucketId: currentBucket.bucketId,
          bucketSize: currentBucket.bucketSize,
          volume: currentBucket.volume,
          buyVolume: currentBucket.buyVolume,
          sellVolume: currentBucket.sellVolume,
          imbalance: currentBucket.imbalance,
          vwap: currentBucket.vwap
        });

        currentBucket = {
          bucketId: completedBuckets.length + 1,
          bucketSize,
          volume: 0,
          buyVolume: 0,
          sellVolume: 0,
          imbalance: 0,
          vwap: 0,
          weightedPriceSum: 0
        };
      }
    }
  }

  return { completedBuckets, partialBucket: currentBucket };
}

/**
 * Toxicity Regime Classification
 * Thresholds:
 *   LOW < 0.25
 *   MODERATE 0.25 - 0.35
 *   ELEVATED 0.35 - 0.45
 *   CRITICAL > 0.45
 */
function classifyToxicityRegime(vpin) {
  if (vpin > 0.45) return 'CRITICAL';
  if (vpin >= 0.35) return 'ELEVATED';
  if (vpin >= 0.25) return 'MODERATE';
  return 'LOW';
}

/**
 * VPIN Formula Computation
 * VPIN = sum(|V_tau^B - V_tau^S|) / (N * V)
 * Bounded strictly within [0.0, 1.0].
 */
function calculateVPINScore(buckets, windowN = 50, bucketSize = 10000) {
  if (!buckets || buckets.length === 0) {
    return {
      vpin: 0.0,
      toxicityRegime: 'LOW',
      windowSize: 0,
      totalImbalance: 0,
      totalVolume: 0
    };
  }

  const windowBuckets = buckets.slice(-windowN);
  const effectiveN = windowBuckets.length;
  let totalImbalance = 0;
  let totalVolume = 0;

  for (const b of windowBuckets) {
    const bSize = b.volume || bucketSize;
    const buy = b.buyVolume !== undefined ? b.buyVolume : bSize / 2;
    const sell = b.sellVolume !== undefined ? b.sellVolume : bSize - buy;
    const imb = Math.abs(buy - sell);
    totalImbalance += imb;
    totalVolume += bSize;
  }

  if (totalVolume <= 0) {
    return {
      vpin: 0.0,
      toxicityRegime: 'LOW',
      windowSize: effectiveN,
      totalImbalance: 0,
      totalVolume: 0
    };
  }

  const rawVPIN = totalImbalance / totalVolume;
  const boundedVPIN = Number(Math.min(1.0, Math.max(0.0, rawVPIN)).toFixed(4));
  const toxicityRegime = classifyToxicityRegime(boundedVPIN);

  return {
    vpin: boundedVPIN,
    toxicityRegime,
    windowSize: effectiveN,
    totalImbalance: Math.round(totalImbalance),
    totalVolume: Math.round(totalVolume)
  };
}

/**
 * Kyle's Lambda (λ) Price Impact Linear Regression
 * ΔP_t = α + λ * Q_t + ε_t
 * Where Q_t = Net Order Imbalance (V^B - V^S)
 * λ = Cov(ΔP, Q) / Var(Q)
 */
function calculateKyleLambda(priceChanges, orderImbalances) {
  if (
    !priceChanges ||
    !orderImbalances ||
    priceChanges.length < 2 ||
    priceChanges.length !== orderImbalances.length
  ) {
    return {
      lambda: 0,
      alpha: 0,
      rSquared: 0,
      tStatistic: 0,
      sampleCount: 0,
      standardError: 0
    };
  }

  const n = priceChanges.length;
  let meanDP = 0;
  let meanQ = 0;

  for (let i = 0; i < n; i++) {
    meanDP += priceChanges[i];
    meanQ += orderImbalances[i];
  }
  meanDP /= n;
  meanQ /= n;

  let cov = 0;
  let varQ = 0;
  let varDP = 0;

  for (let i = 0; i < n; i++) {
    const diffQ = orderImbalances[i] - meanQ;
    const diffDP = priceChanges[i] - meanDP;
    cov += diffQ * diffDP;
    varQ += diffQ * diffQ;
    varDP += diffDP * diffDP;
  }

  if (varQ <= 1e-12) {
    return {
      lambda: 0,
      alpha: Number(meanDP.toFixed(6)),
      rSquared: 0,
      tStatistic: 0,
      sampleCount: n,
      standardError: 0
    };
  }

  const lambda = cov / varQ;
  const alpha = meanDP - lambda * meanQ;

  let ssRes = 0;
  let ssTot = varDP;

  for (let i = 0; i < n; i++) {
    const predicted = alpha + lambda * orderImbalances[i];
    const residual = priceChanges[i] - predicted;
    ssRes += residual * residual;
  }

  const rSquared = ssTot > 1e-12 ? Math.max(0.0, Math.min(1.0, 1.0 - ssRes / ssTot)) : 0.0;
  const degreesOfFreedom = n - 2;
  const residualVariance = degreesOfFreedom > 0 ? ssRes / degreesOfFreedom : 0;
  const standardError = varQ > 0 && residualVariance > 0 ? Math.sqrt(residualVariance / varQ) : 0;
  const tStatistic = standardError > 1e-12 ? lambda / standardError : 0;

  return {
    lambda: Number(lambda.toFixed(8)),
    alpha: Number(alpha.toFixed(6)),
    rSquared: Number(rSquared.toFixed(4)),
    standardError: Number(standardError.toFixed(8)),
    tStatistic: Number(tStatistic.toFixed(2)),
    sampleCount: n
  };
}

/**
 * Glosten-Milgrom / Roll Bid-Ask Spread Decomposition
 * Spread = Adverse Selection (Adverse) + Inventory Holding (Inv) + Order Processing (Proc)
 * Sum of components strictly equals totalSpread.
 */
function decomposeSpread(totalSpread, vpin, inventoryRatio = 0.5) {
  if (totalSpread <= 0) {
    return {
      totalSpread: 0,
      adverseSelectionSpread: 0,
      inventorySpread: 0,
      processingSpread: 0,
      adverseSharePct: 0,
      inventorySharePct: 0,
      processingSharePct: 0
    };
  }

  // Adverse selection fraction scales dynamically with VPIN
  const adverseFraction = Math.max(0.10, Math.min(0.85, vpin * 1.2));
  const remainingFraction = 1.0 - adverseFraction;

  const invFrac = Math.max(0.1, Math.min(0.9, inventoryRatio));
  const inventoryFraction = remainingFraction * invFrac;

  const adverseSelectionSpread = Number((totalSpread * adverseFraction).toFixed(4));
  const inventorySpread = Number((totalSpread * inventoryFraction).toFixed(4));
  // Exact conservation: order processing absorbs rounding remainder
  const processingSpread = Number((totalSpread - adverseSelectionSpread - inventorySpread).toFixed(4));

  return {
    totalSpread: Number(totalSpread.toFixed(4)),
    adverseSelectionSpread,
    inventorySpread,
    processingSpread,
    adverseSharePct: Number((adverseFraction * 100).toFixed(2)),
    inventorySharePct: Number((inventoryFraction * 100).toFixed(2)),
    processingSharePct: Number(((processingSpread / totalSpread) * 100).toFixed(2))
  };
}

/**
 * Market Maker Defensive Widening Factor Scaling with VPIN Percentile
 */
function calculateDefensiveWideningFactor(vpin, vpinPercentile = null) {
  const pct = vpinPercentile !== null
    ? Math.max(0, Math.min(100, vpinPercentile))
    : Math.min(100, Math.max(0, vpin * 100));

  let wideningFactor = 1.0;
  let status = 'NORMAL_TIGHT';

  if (vpin > 0.45 || pct >= 90) {
    const excess = Math.max(vpin - 0.45, (pct - 90) / 100);
    wideningFactor = Number((2.0 + excess * 4.0).toFixed(2));
    status = 'CRITICAL_DEFENSIVE';
  } else if (vpin >= 0.35 || pct >= 75) {
    const progress = (vpin - 0.35) / 0.10;
    wideningFactor = Number((1.35 + progress * 0.55).toFixed(2));
    status = 'ELEVATED_WIDENING';
  } else if (vpin >= 0.25 || pct >= 50) {
    const progress = (vpin - 0.25) / 0.10;
    wideningFactor = Number((1.10 + progress * 0.20).toFixed(2));
    status = 'MODERATE_MONITOR';
  } else {
    wideningFactor = 1.0;
    status = 'NORMAL_TIGHT';
  }

  return {
    vpin,
    vpinPercentile: pct,
    wideningFactor,
    status
  };
}

/**
 * 1-Click Defensive Hedger Order Sizing & Quote Cancellation Trigger
 */
function solveDefensiveHedger({
  currentInventory,
  vpinScore,
  orderFlowImbalance,
  spotPrice = 24500,
  lotSize = 25,
  quoteCancellationThreshold = 0.35,
  hedgingThreshold = 0.45
}) {
  const regime = classifyToxicityRegime(vpinScore);
  const isExtremePanic = vpinScore > 0.50;

  let action = 'HOLD';
  let cancelQuotes = false;
  let cancelScope = 'NONE';
  let cancellationReason = 'Normal flow, quotes remain active.';

  // Quote cancellation logic
  if (vpinScore >= quoteCancellationThreshold) {
    cancelQuotes = true;
    if (isExtremePanic) {
      cancelScope = 'CANCEL_ALL';
      cancellationReason = `VPIN (${vpinScore}) in extreme toxic runaway. Immediate withdrawal of all passive quotes.`;
    } else if (orderFlowImbalance > 0) {
      cancelScope = 'CANCEL_ASKS_ONLY';
      cancellationReason = `Informed toxic buy pressure (+${orderFlowImbalance}). Cancel passive asks to prevent adverse selection.`;
    } else if (orderFlowImbalance < 0) {
      cancelScope = 'CANCEL_BIDS_ONLY';
      cancellationReason = `Informed toxic sell pressure (${orderFlowImbalance}). Cancel passive bids to avoid toxic fills.`;
    } else {
      cancelScope = 'CANCEL_ALL';
      cancellationReason = `High toxicity (${vpinScore}) without clear directional bias. Pulling all two-sided quotes.`;
    }
  }

  // Defensive hedge execution logic
  let executeHedge = false;
  let hedgeSide = 'NONE';
  let hedgeQuantity = 0;
  let lots = 0;
  let residualInventory = currentInventory;
  let urgency = 'NONE';
  let estimatedMarginINR = 0;

  if (vpinScore >= hedgingThreshold && Math.abs(currentInventory) > 0) {
    executeHedge = true;
    if (currentInventory > 0) {
      hedgeSide = 'SELL';
      lots = Math.ceil(currentInventory / lotSize);
      hedgeQuantity = lots * lotSize;
      residualInventory = currentInventory - hedgeQuantity;
    } else {
      hedgeSide = 'BUY';
      lots = Math.ceil(Math.abs(currentInventory) / lotSize);
      hedgeQuantity = lots * lotSize;
      residualInventory = currentInventory + hedgeQuantity;
    }

    urgency = isExtremePanic ? 'IOC_EMERGENCY' : 'IMMEDIATE_CROSS';
    // NSE F&O margin estimate: ~12% of notional
    estimatedMarginINR = Math.round(hedgeQuantity * spotPrice * 0.12);
  }

  if (cancelQuotes && executeHedge) {
    action = 'CANCEL_AND_HEDGE';
  } else if (cancelQuotes) {
    action = 'CANCEL_QUOTES_ONLY';
  } else if (executeHedge) {
    action = 'HEDGE_INVENTORY_ONLY';
  } else {
    action = 'HOLD';
  }

  return {
    action,
    toxicityRegime: regime,
    quoteCancellation: {
      trigger: cancelQuotes,
      scope: cancelScope,
      reason: cancellationReason
    },
    defensiveHedge: {
      trigger: executeHedge,
      hedgeSide,
      hedgeQuantity,
      lots,
      residualInventory,
      urgency,
      estimatedMarginINR,
      slippageToleranceTicks: isExtremePanic ? 10 : 3
    }
  };
}

// ============================================================================
// TEST SUITE: SPRINT 25 VPIN & INFORMED TRADING MICROSTRUCTURE ENGINE
// ============================================================================

describe('TradeCraft VPIN & Informed Trading Microstructure Engine (Sprint 25)', () => {

  // Test 1: Bulk Volume Classification (BVC) Standard Normal CDF Partitioning
  test('TC-VPIN-01: Bulk Volume Classification (BVC) Standard Normal CDF Bar Partitioning', () => {
    const totalVolume = 10000;
    const sigma = 10.0;

    // Positive price move (+10 pts = +1.0 sigma) -> Φ(1.0) ≈ 0.8413
    const buyMove = calculateBVC(10.0, sigma, totalVolume);
    assert.equal(buyMove.zScore, 1.0);
    assert.ok(buyMove.buyFraction > 0.84 && buyMove.buyFraction < 0.85);
    assert.equal(buyMove.buyVolume + buyMove.sellVolume, totalVolume);
    assert.ok(buyMove.buyVolume > buyMove.sellVolume);

    // Negative price move (-10 pts = -1.0 sigma) -> Φ(-1.0) ≈ 0.1587
    const sellMove = calculateBVC(-10.0, sigma, totalVolume);
    assert.equal(sellMove.zScore, -1.0);
    assert.ok(sellMove.buyFraction > 0.15 && sellMove.buyFraction < 0.16);
    assert.equal(sellMove.buyVolume + sellMove.sellVolume, totalVolume);
    assert.ok(sellMove.sellVolume > buyMove.buyVolume - 50); // Symmetric
  });

  // Test 2: Bulk Volume Classification Symmetric and Boundary Constraints
  test('TC-VPIN-02: Bulk Volume Classification Symmetric and Boundary Constraints', () => {
    const totalVolume = 50000;
    const sigma = 5.0;

    // Zero price move (ΔP = 0) -> Φ(0) = 0.50 exactly
    const neutralMove = calculateBVC(0.0, sigma, totalVolume);
    assert.equal(neutralMove.zScore, 0);
    assert.equal(neutralMove.buyFraction, 0.5);
    assert.equal(neutralMove.buyVolume, 25000);
    assert.equal(neutralMove.sellVolume, 25000);
    assert.equal(neutralMove.buyVolume + neutralMove.sellVolume, totalVolume);

    // Extreme positive shock (+5 sigma) -> buyFraction approaches 1.0
    const extremeBuy = calculateBVC(25.0, sigma, totalVolume);
    assert.ok(extremeBuy.buyFraction > 0.999);
    assert.equal(extremeBuy.buyVolume + extremeBuy.sellVolume, totalVolume);

    // Extreme negative shock (-5 sigma) -> buyFraction approaches 0.0
    const extremeSell = calculateBVC(-25.0, sigma, totalVolume);
    assert.ok(extremeSell.buyFraction < 0.001);
    assert.equal(extremeSell.buyVolume + extremeSell.sellVolume, totalVolume);

    // Zero total volume guard
    const zeroVol = calculateBVC(5.0, sigma, 0);
    assert.equal(zeroVol.buyVolume, 0);
    assert.equal(zeroVol.sellVolume, 0);
    assert.equal(zeroVol.totalVolume, 0);
  });

  // Test 3: Volume-Clock Aggregation into Constant-Volume Buckets (V)
  test('TC-VPIN-03: Volume-Clock Aggregation into Constant-Volume Buckets (V)', () => {
    const bucketSize = 10000;
    // Sequential bars of varying volume
    const bars = [
      { volume: 4000, buyVolume: 2500, price: 24500 },
      { volume: 6000, buyVolume: 3500, price: 24510 }, // Completes bucket 1 (4k + 6k = 10k)
      { volume: 7000, buyVolume: 4000, price: 24520 },
      { volume: 8000, buyVolume: 6000, price: 24530 }, // Completes bucket 2 and spills 5k into partial
    ];

    const { completedBuckets, partialBucket } = aggregateVolumeBuckets(bars, bucketSize);
    assert.equal(completedBuckets.length, 2);

    // Bucket 1
    assert.equal(completedBuckets[0].bucketId, 1);
    assert.equal(completedBuckets[0].volume, 10000);
    assert.equal(completedBuckets[0].buyVolume, 6000);
    assert.equal(completedBuckets[0].sellVolume, 4000);
    assert.equal(completedBuckets[0].imbalance, 2000);

    // Bucket 2
    assert.equal(completedBuckets[1].bucketId, 2);
    assert.equal(completedBuckets[1].volume, 10000);
    assert.equal(completedBuckets[1].buyVolume + completedBuckets[1].sellVolume, 10000);

    // Partial bucket
    assert.ok(partialBucket !== null);
    assert.equal(partialBucket.volume, 5000);
  });

  // Test 4: Multi-Bucket Spillover and Exact Volume Conservation
  test('TC-VPIN-04: Multi-Bucket Spillover and Exact Volume Conservation', () => {
    const bucketSize = 10000;
    // Single massive block trade bar of 25,000 contracts
    const massiveBar = [
      { volume: 25000, buyVolume: 20000, price: 24600 }
    ];

    const { completedBuckets, partialBucket } = aggregateVolumeBuckets(massiveBar, bucketSize);
    assert.equal(completedBuckets.length, 2);
    assert.equal(completedBuckets[0].volume, 10000);
    assert.equal(completedBuckets[1].volume, 10000);
    assert.equal(partialBucket.volume, 5000);

    // Total volume across completed + partial must exactly equal 25,000
    const totalAggregated = completedBuckets.reduce((acc, b) => acc + b.volume, 0) + partialBucket.volume;
    assert.equal(totalAggregated, 25000);
  });

  // Test 5: Rolling-Window VPIN Computation Formula Bounds [0.0, 1.0]
  test('TC-VPIN-05: Rolling-Window VPIN Computation Formula Bounds [0.0, 1.0]', () => {
    const bucketSize = 10000;
    const windowN = 10;
    const buckets = [];

    for (let i = 1; i <= 20; i++) {
      const buyVol = 6500; // Imbalance = |6500 - 3500| = 3000 per bucket
      buckets.push({
        bucketId: i,
        volume: bucketSize,
        buyVolume: buyVol,
        sellVolume: bucketSize - buyVol
      });
    }

    const res = calculateVPINScore(buckets, windowN, bucketSize);
    // 10 buckets * 3000 imbalance = 30000 / (10 * 10000) = 0.3000
    assert.equal(res.vpin, 0.3000);
    assert.equal(res.windowSize, windowN);
    assert.equal(res.totalImbalance, 30000);
    assert.equal(res.totalVolume, 100000);
    assert.ok(res.vpin >= 0.0 && res.vpin <= 1.0);
  });

  // Test 6: Theoretical Extremes: Zero Toxicity (0.0) vs Full Informed Toxicity (1.0)
  test('TC-VPIN-06: Theoretical Extremes: Zero Toxicity (0.0) vs Full Informed Toxicity (1.0)', () => {
    const bucketSize = 10000;
    const n = 5;

    // Perfectly balanced flow: buy = 5000, sell = 5000
    const calmBuckets = Array.from({ length: n }, (_, i) => ({
      bucketId: i + 1,
      volume: bucketSize,
      buyVolume: 5000,
      sellVolume: 5000
    }));
    const zeroToxicity = calculateVPINScore(calmBuckets, n, bucketSize);
    assert.equal(zeroToxicity.vpin, 0.0);
    assert.equal(zeroToxicity.toxicityRegime, 'LOW');

    // 100% one-sided toxic sweep: all buys
    const pureToxicBuckets = Array.from({ length: n }, (_, i) => ({
      bucketId: i + 1,
      volume: bucketSize,
      buyVolume: 10000,
      sellVolume: 0
    }));
    const fullToxicity = calculateVPINScore(pureToxicBuckets, n, bucketSize);
    assert.equal(fullToxicity.vpin, 1.0);
    assert.equal(fullToxicity.toxicityRegime, 'CRITICAL');
  });

  // Test 7: Toxicity Regime Classification Thresholds
  test('TC-VPIN-07: Toxicity Regime Classification Thresholds', () => {
    // LOW < 0.25
    assert.equal(classifyToxicityRegime(0.12), 'LOW');
    assert.equal(classifyToxicityRegime(0.2499), 'LOW');

    // MODERATE 0.25 - 0.35
    assert.equal(classifyToxicityRegime(0.25), 'MODERATE');
    assert.equal(classifyToxicityRegime(0.30), 'MODERATE');
    assert.equal(classifyToxicityRegime(0.3499), 'MODERATE');

    // ELEVATED 0.35 - 0.45
    assert.equal(classifyToxicityRegime(0.35), 'ELEVATED');
    assert.equal(classifyToxicityRegime(0.40), 'ELEVATED');
    assert.equal(classifyToxicityRegime(0.45), 'ELEVATED');

    // CRITICAL > 0.45
    assert.equal(classifyToxicityRegime(0.4501), 'CRITICAL');
    assert.equal(classifyToxicityRegime(0.65), 'CRITICAL');
    assert.equal(classifyToxicityRegime(1.0), 'CRITICAL');
  });

  // Test 8: Flash Crash / Toxic Runaway Microstructure Simulation
  test('TC-VPIN-08: Flash Crash / Toxic Runaway Microstructure Simulation', () => {
    const bucketSize = 10000;
    const sequence = [
      // 3 calm buckets
      { buyVolume: 5200, sellVolume: 4800 },
      { buyVolume: 4900, sellVolume: 5100 },
      { buyVolume: 5100, sellVolume: 4900 },
      // Sudden institutional dump cascade
      { buyVolume: 2000, sellVolume: 8000 },
      { buyVolume: 1500, sellVolume: 8500 },
      { buyVolume: 1000, sellVolume: 9000 },
    ].map((b, i) => ({ bucketId: i + 1, volume: bucketSize, ...b }));

    const initialVPIN = calculateVPINScore(sequence.slice(0, 3), 3, bucketSize);
    assert.equal(initialVPIN.toxicityRegime, 'LOW');
    assert.ok(initialVPIN.vpin < 0.10);

    const postCrashVPIN = calculateVPINScore(sequence.slice(3, 6), 3, bucketSize);
    assert.equal(postCrashVPIN.toxicityRegime, 'CRITICAL');
    assert.ok(postCrashVPIN.vpin > 0.65);
    assert.ok(postCrashVPIN.vpin > initialVPIN.vpin);
  });

  // Test 9: Kyle's Lambda (λ) Price Impact Linear Regression
  test('TC-VPIN-09: Kyle\'s Lambda (λ) Price Impact Linear Regression', () => {
    // 5 buckets of net order imbalance (contracts) and observed price changes (₹)
    const imbalances = [1000, 2000, 3000, 4000, 5000]; // Increasing buy pressure
    const priceChanges = [0.50, 1.00, 1.50, 2.00, 2.50]; // Linear price impact: ΔP = 0.0005 * Q

    const res = calculateKyleLambda(priceChanges, imbalances);
    assert.equal(res.lambda, 0.0005);
    assert.equal(res.alpha, 0);
    assert.equal(res.rSquared, 1.0); // Perfect linear relationship
    assert.ok(res.lambda > 0, 'Kyle\'s lambda must be positive for net buying impact');
    assert.equal(res.sampleCount, 5);
  });

  // Test 10: Kyle's Lambda Goodness-of-Fit (R²) and T-Statistic
  test('TC-VPIN-10: Kyle\'s Lambda Goodness-of-Fit (R²) and T-Statistic', () => {
    // Noisy order flow with realistic variance
    const imbalances = [500, -800, 1200, -300, 2200, -1500, 900, -1100];
    const priceChanges = [0.25, -0.40, 0.65, -0.15, 1.10, -0.80, 0.45, -0.55];

    const res = calculateKyleLambda(priceChanges, imbalances);
    assert.ok(res.lambda > 0, 'Positive price impact slope expected');
    assert.ok(res.rSquared > 0.90, `R-squared goodness of fit (${res.rSquared}) should be high`);
    assert.ok(res.tStatistic > 2.0, `t-statistic (${res.tStatistic}) should indicate statistical significance`);
  });

  // Test 11: Glosten-Milgrom / Roll Spread Decomposition Additive Exactness
  test('TC-VPIN-11: Glosten-Milgrom / Roll Spread Decomposition Additive Exactness', () => {
    const totalSpread = 2.50; // Quoted ₹2.50 spread
    const vpin = 0.35; // Elevated toxicity

    const decomp = decomposeSpread(totalSpread, vpin, 0.5);

    // Additive sum check
    const sumComponents = Number(
      (decomp.adverseSelectionSpread + decomp.inventorySpread + decomp.processingSpread).toFixed(4)
    );
    assert.equal(sumComponents, totalSpread);

    // Non-negative components
    assert.ok(decomp.adverseSelectionSpread > 0);
    assert.ok(decomp.inventorySpread > 0);
    assert.ok(decomp.processingSpread > 0);
  });

  // Test 12: Spread Component Dynamics Under Toxic vs Calm Conditions
  test('TC-VPIN-12: Spread Component Dynamics Under Toxic vs Calm Conditions', () => {
    const spread = 2.00;

    // Calm market (VPIN = 0.15)
    const calmDecomp = decomposeSpread(spread, 0.15);
    // Toxic market (VPIN = 0.60)
    const toxicDecomp = decomposeSpread(spread, 0.60);

    // Adverse selection spread must be substantially larger in toxic regime
    assert.ok(
      toxicDecomp.adverseSelectionSpread > calmDecomp.adverseSelectionSpread * 3,
      `Adverse selection spread (${toxicDecomp.adverseSelectionSpread}) must be > 3x calm (${calmDecomp.adverseSelectionSpread})`
    );
    assert.ok(toxicDecomp.adverseSharePct > 65.0);
    assert.ok(calmDecomp.adverseSharePct < 25.0);
  });

  // Test 13: Market Maker Defensive Widening Factor Scaling with VPIN
  test('TC-VPIN-13: Market Maker Defensive Widening Factor Scaling with VPIN', () => {
    // LOW regime -> 1.0x baseline
    const low = calculateDefensiveWideningFactor(0.18);
    assert.equal(low.wideningFactor, 1.0);
    assert.equal(low.status, 'NORMAL_TIGHT');

    // MODERATE regime -> ~1.2x
    const mod = calculateDefensiveWideningFactor(0.30);
    assert.ok(mod.wideningFactor >= 1.10 && mod.wideningFactor <= 1.30);
    assert.equal(mod.status, 'MODERATE_MONITOR');

    // ELEVATED regime -> ~1.6x
    const elev = calculateDefensiveWideningFactor(0.40);
    assert.ok(elev.wideningFactor >= 1.35 && elev.wideningFactor <= 1.90);
    assert.equal(elev.status, 'ELEVATED_WIDENING');

    // CRITICAL regime -> >= 2.0x
    const crit = calculateDefensiveWideningFactor(0.55);
    assert.ok(crit.wideningFactor >= 2.40);
    assert.equal(crit.status, 'CRITICAL_DEFENSIVE');
  });

  // Test 14: 1-Click Defensive Hedger Quote Cancellation Triggers
  test('TC-VPIN-14: 1-Click Defensive Hedger Quote Cancellation Triggers', () => {
    // Scenario A: Toxic BUY sweep in ELEVATED regime -> Cancel passive ASKS
    const buySweep = solveDefensiveHedger({
      currentInventory: 0,
      vpinScore: 0.38,
      orderFlowImbalance: 15000, // Strong buy imbalance
    });
    assert.equal(buySweep.quoteCancellation.trigger, true);
    assert.equal(buySweep.quoteCancellation.scope, 'CANCEL_ASKS_ONLY');
    assert.equal(buySweep.action, 'CANCEL_QUOTES_ONLY');

    // Scenario B: Toxic SELL dump in ELEVATED regime -> Cancel passive BIDS
    const sellDump = solveDefensiveHedger({
      currentInventory: 0,
      vpinScore: 0.42,
      orderFlowImbalance: -18000, // Strong sell imbalance
    });
    assert.equal(sellDump.quoteCancellation.trigger, true);
    assert.equal(sellDump.quoteCancellation.scope, 'CANCEL_BIDS_ONLY');

    // Scenario C: Extreme CRITICAL runaway (VPIN > 0.50) -> Cancel ALL quotes
    const panicSweep = solveDefensiveHedger({
      currentInventory: 0,
      vpinScore: 0.58,
      orderFlowImbalance: -25000
    });
    assert.equal(panicSweep.quoteCancellation.trigger, true);
    assert.equal(panicSweep.quoteCancellation.scope, 'CANCEL_ALL');

    // Scenario D: Calm regime -> NO cancellation
    const calmFlow = solveDefensiveHedger({
      currentInventory: 0,
      vpinScore: 0.15,
      orderFlowImbalance: 1000
    });
    assert.equal(calmFlow.quoteCancellation.trigger, false);
    assert.equal(calmFlow.action, 'HOLD');
  });

  // Test 15: 1-Click Defensive Hedger Order Sizing, Lot Rounding, and Delta Neutralization
  test('TC-VPIN-15: 1-Click Defensive Hedger Order Sizing, Lot Rounding, and Delta Neutralization', () => {
    const lotSize = 25; // NIFTY standard lot size
    const spot = 24500;

    // MM is Long +120 contracts during CRITICAL toxicity dump
    const hedgeLong = solveDefensiveHedger({
      currentInventory: 120,
      vpinScore: 0.48,
      orderFlowImbalance: -20000,
      spotPrice: spot,
      lotSize
    });

    assert.equal(hedgeLong.action, 'CANCEL_AND_HEDGE');
    assert.equal(hedgeLong.defensiveHedge.trigger, true);
    assert.equal(hedgeLong.defensiveHedge.hedgeSide, 'SELL');
    // 120 / 25 = 4.8 -> ceil to 5 lots (125 contracts)
    assert.equal(hedgeLong.defensiveHedge.lots, 5);
    assert.equal(hedgeLong.defensiveHedge.hedgeQuantity, 125);
    // Residual inventory: 120 - 125 = -5
    assert.equal(hedgeLong.defensiveHedge.residualInventory, -5);
    assert.ok(hedgeLong.defensiveHedge.estimatedMarginINR > 0);

    // MM is Short -70 contracts during CRITICAL toxicity pump
    const hedgeShort = solveDefensiveHedger({
      currentInventory: -70,
      vpinScore: 0.46,
      orderFlowImbalance: 25000,
      spotPrice: spot,
      lotSize
    });

    assert.equal(hedgeShort.defensiveHedge.trigger, true);
    assert.equal(hedgeShort.defensiveHedge.hedgeSide, 'BUY');
    // 70 / 25 = 2.8 -> ceil to 3 lots (75 contracts)
    assert.equal(hedgeShort.defensiveHedge.lots, 3);
    assert.equal(hedgeShort.defensiveHedge.hedgeQuantity, 75);
    // Residual inventory: -70 + 75 = +5
    assert.equal(hedgeShort.defensiveHedge.residualInventory, 5);
  });

  // Test 16: End-to-End Microstructure Pipeline Integration
  test('TC-VPIN-16: End-to-End Microstructure Pipeline Integration', () => {
    const sigma = 8.0;
    const bucketSize = 10000;

    // Simulate sequence of raw trading bars during opening institutional surge
    const rawBars = [
      { priceChange: 12.0, volume: 5000, close: 24512 },
      { priceChange: 14.0, volume: 8000, close: 24526 },
      { priceChange: 16.0, volume: 12000, close: 24542 },
      { priceChange: 10.0, volume: 9000, close: 24552 },
    ];

    // 1. Bulk Volume Classification for each bar
    const classifiedBars = rawBars.map((b) => {
      const bvc = calculateBVC(b.priceChange, sigma, b.volume);
      return {
        ...b,
        buyVolume: bvc.buyVolume,
        sellVolume: bvc.sellVolume
      };
    });

    // 2. Volume-clock bucket aggregation
    const { completedBuckets } = aggregateVolumeBuckets(classifiedBars, bucketSize);
    assert.ok(completedBuckets.length >= 3);

    // 3. VPIN computation
    const vpinRes = calculateVPINScore(completedBuckets, 5, bucketSize);
    assert.ok(vpinRes.vpin > 0.45, `VPIN should reflect aggressive buying, got ${vpinRes.vpin}`);
    assert.equal(vpinRes.toxicityRegime, 'CRITICAL');

    // 4. Spread decomposition
    const spreadRes = decomposeSpread(3.00, vpinRes.vpin);
    assert.equal(spreadRes.totalSpread, 3.00);
    assert.ok(spreadRes.adverseSharePct > 50);

    // 5. Market maker defensive hedging decision
    const hedgeDecision = solveDefensiveHedger({
      currentInventory: -100, // MM caught short
      vpinScore: vpinRes.vpin,
      orderFlowImbalance: 20000,
      spotPrice: 24550,
      lotSize: 25
    });

    assert.equal(hedgeDecision.action, 'CANCEL_AND_HEDGE');
    assert.equal(hedgeDecision.quoteCancellation.scope, 'CANCEL_ALL');
    assert.equal(hedgeDecision.defensiveHedge.hedgeSide, 'BUY');
    assert.equal(hedgeDecision.defensiveHedge.lots, 4);
    assert.equal(hedgeDecision.defensiveHedge.hedgeQuantity, 100);
    assert.equal(hedgeDecision.defensiveHedge.residualInventory, 0); // Perfectly neutralized
  });

});
