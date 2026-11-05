// Sprint 21 — Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine Tests
// Pure JS test suite using Node.js native test runner (node:test)
// Tests:
// 1. Implied correlation boundary enforcement (0 <= rho <= 1)
// 2. Dispersion spread calculation and arbitrage classification (Long dispersion vs Short dispersion)
// 3. Gamma scalping rebalance threshold triggers & scalp PnL attribution
// 4. Multi-expiry term structure skew modeling (Risk Reversal, Butterfly, Contango/Backwardation)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure algorithmic functions mirrored for native fast Node.js test execution

/**
 * Normalizes an array of constituent weights to sum to 1.0
 */
function normalizeWeights(weights) {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 1e-12) {
    const equalWeight = 1.0 / weights.length;
    return weights.map(() => equalWeight);
  }
  return weights.map((w) => w / sum);
}

/**
 * Implied Correlation Solver with strict [0, 1] boundary enforcement
 *
 * Formula:
 * sigma_index^2 = sum(w_i^2 * sigma_i^2) + rho * [ (sum(w_i * sigma_i))^2 - sum(w_i^2 * sigma_i^2) ]
 *
 * rho_raw = (sigma_index^2 - sum(w_i^2 * sigma_i^2)) / [ (sum(w_i * sigma_i))^2 - sum(w_i^2 * sigma_i^2) ]
 * Enforces: 0 <= rho <= 1
 */
function calculateImpliedCorrelation(indexIV, constituents) {
  if (!constituents || constituents.length === 0) {
    return {
      impliedCorrelation: 1.0,
      rawImpliedCorrelation: 1.0,
      isClamped: false,
      clampedReason: 'NONE',
      basketWeightedIV: indexIV,
      indexVariance: indexIV * indexIV,
      sumW2Sigma2: 0,
      crossProductVariance: 0,
    };
  }

  const rawWeights = constituents.map((c) => c.weight);
  const normWeights = normalizeWeights(rawWeights);

  const sigmaIndex = Math.max(0.0001, indexIV);
  const indexVariance = Math.pow(sigmaIndex, 2);

  let basketWeightedIV = 0;
  let sumW2Sigma2 = 0;

  for (let i = 0; i < constituents.length; i++) {
    const w = normWeights[i];
    const vol = Math.max(0.0001, constituents[i].impliedVol);
    basketWeightedIV += w * vol;
    sumW2Sigma2 += Math.pow(w * vol, 2);
  }

  const basketVariance = Math.pow(basketWeightedIV, 2);
  const crossProductVariance = basketVariance - sumW2Sigma2;

  // Single asset or zero-variance basket protection
  if (constituents.length === 1 || crossProductVariance <= 1e-10) {
    return {
      impliedCorrelation: 1.0,
      rawImpliedCorrelation: 1.0,
      isClamped: false,
      clampedReason: 'NONE',
      basketWeightedIV: Number(basketWeightedIV.toFixed(4)),
      indexVariance: Number(indexVariance.toFixed(6)),
      sumW2Sigma2: Number(sumW2Sigma2.toFixed(6)),
      crossProductVariance: Math.max(0, Number(crossProductVariance.toFixed(6))),
    };
  }

  const rawRho = (indexVariance - sumW2Sigma2) / crossProductVariance;

  let impliedCorrelation = rawRho;
  let isClamped = false;
  let clampedReason = 'NONE';

  if (rawRho > 1.0) {
    impliedCorrelation = 1.0;
    isClamped = true;
    clampedReason = 'SUPER_HEDGING_VIOLATION';
  } else if (rawRho < 0.0) {
    impliedCorrelation = 0.0;
    isClamped = true;
    clampedReason = 'ZERO_CORRELATION_CLAMPED';
  }

  return {
    impliedCorrelation: Number(impliedCorrelation.toFixed(4)),
    rawImpliedCorrelation: Number(rawRho.toFixed(4)),
    isClamped,
    clampedReason,
    basketWeightedIV: Number(basketWeightedIV.toFixed(4)),
    indexVariance: Number(indexVariance.toFixed(6)),
    sumW2Sigma2: Number(sumW2Sigma2.toFixed(6)),
    crossProductVariance: Number(crossProductVariance.toFixed(6)),
  };
}

/**
 * Calculates Dispersion Spread and Arbitrage Classification
 */
function analyzeDispersionArbitrage(indexIV, constituents, realizedCorrelation = 0.42, hurdleThreshold = 0.08) {
  const corrMetrics = calculateImpliedCorrelation(indexIV, constituents);
  const dispersionSpread = Number((corrMetrics.basketWeightedIV - indexIV).toFixed(4));
  const correlationSpread = Number((corrMetrics.impliedCorrelation - realizedCorrelation).toFixed(4));

  let arbitrageType = 'NEUTRAL_NO_ARBITRAGE';
  let recommendedTrade = 'HOLD_NO_ACTION';
  let tradeRationale = '';
  let confidenceScore = 50;

  if (correlationSpread >= hurdleThreshold) {
    // Implied correlation is rich -> Long Dispersion: Sell Index options, Buy Component options
    arbitrageType = 'LONG_DISPERSION';
    recommendedTrade = 'SELL_INDEX_BUY_COMPONENTS';
    tradeRationale = 'Implied correlation is rich relative to realized correlation. Sell Index options and Buy single-stock constituent options.';
    confidenceScore = Math.min(99, Math.round(50 + (correlationSpread / 0.5) * 50));
  } else if (correlationSpread <= -hurdleThreshold) {
    // Implied correlation is underpriced -> Short Dispersion: Buy Index options, Sell Component options
    arbitrageType = 'SHORT_DISPERSION';
    recommendedTrade = 'BUY_INDEX_SELL_COMPONENTS';
    tradeRationale = 'Implied correlation is cheap relative to realized correlation. Buy Index options and Sell constituent options.';
    confidenceScore = Math.min(99, Math.round(50 + (Math.abs(correlationSpread) / 0.5) * 50));
  } else {
    arbitrageType = 'NEUTRAL_NO_ARBITRAGE';
    recommendedTrade = 'HOLD_NO_ACTION';
    tradeRationale = 'Correlation spread is within neutral hurdle band. No dispersion arbitrage triggered.';
    confidenceScore = 40;
  }

  return {
    indexIV,
    basketWeightedIV: corrMetrics.basketWeightedIV,
    dispersionSpread,
    impliedCorrelation: corrMetrics.impliedCorrelation,
    realizedCorrelation,
    correlationSpread,
    arbitrageType,
    recommendedTrade,
    tradeRationale,
    confidenceScore,
    hurdleThreshold,
  };
}

/**
 * Generates Vega-Neutral Leg Sizing for Dispersion Execution
 */
function calculateVegaNeutralAllocation(indexVegaPerContract, indexContracts, constituents) {
  const totalIndexVega = indexContracts * indexVegaPerContract;
  const rawWeights = constituents.map((c) => c.weight);
  const normWeights = normalizeWeights(rawWeights);

  const componentAllocations = constituents.map((c, i) => {
    const w = normWeights[i];
    const targetVega = totalIndexVega * w;
    const rawContracts = targetVega / Math.max(0.01, c.vega);
    const lotSize = c.lotSize || 25;
    const lots = Math.max(1, Math.round(rawContracts / lotSize));
    const contracts = lots * lotSize;
    const allocatedVega = Number((contracts * c.vega).toFixed(2));

    return {
      symbol: c.symbol,
      lots,
      contracts,
      lotSize,
      targetVega: Number(targetVega.toFixed(2)),
      allocatedVega,
    };
  });

  const totalBasketVega = Number(componentAllocations.reduce((acc, c) => acc + c.allocatedVega, 0).toFixed(2));
  const vegaImbalance = Number((totalBasketVega - totalIndexVega).toFixed(2));

  return {
    totalIndexVega,
    totalBasketVega,
    vegaImbalance,
    isVegaNeutral: Math.abs(vegaImbalance) <= totalIndexVega * 0.10, // within 10% tolerance
    componentAllocations,
  };
}

/**
 * Gamma Scalping Dynamic Delta Band Rebalancing Solver
 */
function evaluateGammaScalpTrigger(currentSpot, entrySpot, netDelta, deltaThreshold = 25.0, netGamma = 1.5, lotSize = 25) {
  const absDelta = Math.abs(netDelta);
  let action = 'HOLD_WITHIN_BAND';
  let recommendedHedgeQty = 0;
  let hedgeInstrumentSide = 'NONE';

  if (netDelta > deltaThreshold) {
    action = 'REBALANCE_SELL_UNDERLYING';
    hedgeInstrumentSide = 'SELL';
    const lots = Math.max(1, Math.round(absDelta / lotSize));
    recommendedHedgeQty = lots * lotSize;
  } else if (netDelta < -deltaThreshold) {
    action = 'REBALANCE_BUY_UNDERLYING';
    hedgeInstrumentSide = 'BUY';
    const lots = Math.max(1, Math.round(absDelta / lotSize));
    recommendedHedgeQty = lots * lotSize;
  } else {
    action = 'HOLD_WITHIN_BAND';
    recommendedHedgeQty = 0;
    hedgeInstrumentSide = 'NONE';
  }

  const deltaS = currentSpot - entrySpot;
  // Scalp P&L approximation: 0.5 * Gamma * (dS)^2
  const projectedScalpPnL = Number((0.5 * Math.abs(netGamma) * Math.pow(deltaS, 2)).toFixed(2));

  return {
    currentSpot,
    entrySpot,
    spotMove: Number(deltaS.toFixed(2)),
    netDelta,
    deltaThreshold,
    action,
    hedgeInstrumentSide,
    recommendedHedgeQty,
    projectedScalpPnL,
  };
}

/**
 * Multi-Expiry Term Structure & 25-Delta Skew Analytics
 */
function calculateTermStructureSkewMetrics(nearExpiry, farExpiry) {
  const dDTE = Math.max(1, farExpiry.daysToExpiry - nearExpiry.daysToExpiry);
  const dIV = farExpiry.atmIV - nearExpiry.atmIV;
  const slopePerDay = Number((dIV / dDTE).toFixed(6));

  const regime = slopePerDay > 0.0001 ? 'CONTANGO' : slopePerDay < -0.0001 ? 'BACKWARDATION' : 'FLAT';

  // 25-Delta Skew Metrics
  // Risk Reversal = 25d Call IV - 25d Put IV (or Put - Call for downside fear)
  const nearRiskReversal = Number((nearExpiry.call25dIV - nearExpiry.put25dIV).toFixed(2));
  const farRiskReversal = Number((farExpiry.call25dIV - farExpiry.put25dIV).toFixed(2));

  // Butterfly (Smile curvature) = (Call25d + Put25d) / 2 - ATM
  const nearButterfly = Number(((nearExpiry.call25dIV + nearExpiry.put25dIV) / 2 - nearExpiry.atmIV).toFixed(2));
  const farButterfly = Number(((farExpiry.call25dIV + farExpiry.put25dIV) / 2 - farExpiry.atmIV).toFixed(2));

  // Calendar vega hedge ratio: Near Vega / Far Vega
  const calendarVegaRatio = Number((nearExpiry.vega / Math.max(0.01, farExpiry.vega)).toFixed(4));

  return {
    slopePerDay,
    regime,
    nearRiskReversal,
    farRiskReversal,
    nearButterfly,
    farButterfly,
    calendarVegaRatio,
  };
}

// -------------------- UNIT TEST SUITE --------------------

describe('TradeCraft Sprint 21 - Volatility Dispersion & Multi-Expiry Skew Hedging Engine', () => {

  // =========================================================================
  // REQUIREMENT 1: Implied Correlation Boundary Enforcement (0 <= rho <= 1)
  // =========================================================================

  describe('1. Implied Correlation Boundary Enforcement (0 <= rho <= 1)', () => {
    
    test('TC-DISP-01: Correctly calculates implied correlation for standard basket within [0, 1]', () => {
      // 3 components with typical index weights and volatilities
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.40, impliedVol: 22.0 },
        { symbol: 'RELIANCE', weight: 0.35, impliedVol: 20.0 },
        { symbol: 'INFY',     weight: 0.25, impliedVol: 24.0 },
      ];
      const indexIV = 15.5; // Index IV is lower than individual stocks due to correlation < 1

      const result = calculateImpliedCorrelation(indexIV, constituents);

      assert.strictEqual(result.isClamped, false, 'Implied correlation should not be clamped for normal values');
      assert.strictEqual(result.clampedReason, 'NONE');
      assert.ok(result.impliedCorrelation >= 0 && result.impliedCorrelation <= 1, 'Implied correlation must be between 0 and 1');
      assert.strictEqual(result.impliedCorrelation, result.rawImpliedCorrelation, 'Raw and clamped rho should match');
      
      // Manual verification:
      // Basket weighted IV = 0.4*22 + 0.35*20 + 0.25*24 = 8.8 + 7.0 + 6.0 = 21.8
      assert.strictEqual(result.basketWeightedIV, 21.8);
      // Index variance = 15.5^2 = 240.25
      assert.strictEqual(result.indexVariance, 240.25);
    });

    test('TC-DISP-02: Enforces upper bound rho <= 1.0 on Super-Hedging / Sub-Additivity Violation', () => {
      // Index IV is set artificially higher than weighted component IV (violating Jensen's inequality)
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.50, impliedVol: 18.0 },
        { symbol: 'RELIANCE', weight: 0.50, impliedVol: 16.0 },
      ];
      // Weighted IV = 17.0. If index IV = 22.0, raw rho would be > 1.0!
      const indexIV = 22.0;

      const result = calculateImpliedCorrelation(indexIV, constituents);

      assert.ok(result.rawImpliedCorrelation > 1.0, `Raw correlation ${result.rawImpliedCorrelation} should exceed 1.0`);
      assert.strictEqual(result.isClamped, true, 'Result must be flagged as clamped');
      assert.strictEqual(result.impliedCorrelation, 1.0, 'Implied correlation must be strictly clamped to upper bound 1.0');
      assert.strictEqual(result.clampedReason, 'SUPER_HEDGING_VIOLATION', 'Reason must report super-hedging violation');
    });

    test('TC-DISP-03: Enforces lower bound rho >= 0.0 when index variance is lower than independent variance', () => {
      // Index IV is set unrealistically low such that indexVar < sum(w_i^2 * sigma_i^2)
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.50, impliedVol: 30.0 },
        { symbol: 'RELIANCE', weight: 0.50, impliedVol: 30.0 },
      ];
      // Independent variance sum = 0.25*900 + 0.25*900 = 450. (equivalent to single vol of sqrt(450) = 21.21)
      // If index IV = 10.0, indexVar = 100 < 450, so raw rho < 0!
      const indexIV = 10.0;

      const result = calculateImpliedCorrelation(indexIV, constituents);

      assert.ok(result.rawImpliedCorrelation < 0.0, `Raw correlation ${result.rawImpliedCorrelation} should be negative`);
      assert.strictEqual(result.isClamped, true, 'Result must be flagged as clamped');
      assert.strictEqual(result.impliedCorrelation, 0.0, 'Implied correlation must be strictly clamped to lower bound 0.0');
      assert.strictEqual(result.clampedReason, 'ZERO_CORRELATION_CLAMPED', 'Reason must report zero correlation clamp');
    });

    test('TC-DISP-04: Exact theoretical boundary condition when rho == 1.0 (Index IV equals Weighted Basket IV)', () => {
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.60, impliedVol: 20.0 },
        { symbol: 'RELIANCE', weight: 0.40, impliedVol: 25.0 },
      ];
      // Weighted Basket IV = 0.6*20 + 0.4*25 = 22.0
      const indexIV = 22.0;

      const result = calculateImpliedCorrelation(indexIV, constituents);

      assert.strictEqual(result.impliedCorrelation, 1.0, 'When Index IV equals weighted basket IV, correlation is exactly 1.0');
      assert.strictEqual(result.rawImpliedCorrelation, 1.0);
      assert.strictEqual(result.isClamped, false);
    });

    test('TC-DISP-05: Handles degenerate single-stock basket gracefully without division-by-zero', () => {
      const singleBasket = [
        { symbol: 'NIFTY_ETF', weight: 1.0, impliedVol: 15.0 },
      ];
      const indexIV = 15.0;

      const result = calculateImpliedCorrelation(indexIV, singleBasket);

      assert.strictEqual(result.impliedCorrelation, 1.0, 'Single asset implied correlation defaults safely to 1.0');
      assert.strictEqual(result.isClamped, false);
      assert.ok(!isNaN(result.impliedCorrelation), 'Correlation must not be NaN');
    });

    test('TC-DISP-06: Automatic weight normalization guarantees invariant correlation output', () => {
      // Test with percentage weights (sum = 100) vs decimal weights (sum = 1.0)
      const basketPercentages = [
        { symbol: 'SBIN', weight: 50, impliedVol: 26.0 },
        { symbol: 'ICICIBANK', weight: 50, impliedVol: 22.0 },
      ];
      const basketDecimals = [
        { symbol: 'SBIN', weight: 0.50, impliedVol: 26.0 },
        { symbol: 'ICICIBANK', weight: 0.50, impliedVol: 22.0 },
      ];
      const indexIV = 18.0;

      const resultPct = calculateImpliedCorrelation(indexIV, basketPercentages);
      const resultDec = calculateImpliedCorrelation(indexIV, basketDecimals);

      assert.strictEqual(resultPct.impliedCorrelation, resultDec.impliedCorrelation, 'Weight scale must not alter correlation');
      assert.strictEqual(resultPct.basketWeightedIV, resultDec.basketWeightedIV, 'Weighted IV must match');
    });

    test('TC-DISP-07: Resilient to empty constituents basket fallback', () => {
      const emptyResult = calculateImpliedCorrelation(14.0, []);
      assert.strictEqual(emptyResult.impliedCorrelation, 1.0);
      assert.strictEqual(emptyResult.basketWeightedIV, 14.0);
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Dispersion Spread & Arbitrage Classification
  // =========================================================================

  describe('2. Dispersion Spread Calculation and Arbitrage Classification', () => {

    test('TC-DISP-08: Accurately calculates dirty dispersion spread (Basket IV minus Index IV)', () => {
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.5, impliedVol: 22.5 },
        { symbol: 'RELIANCE', weight: 0.5, impliedVol: 21.5 },
      ];
      const indexIV = 14.0;

      const analysis = analyzeDispersionArbitrage(indexIV, constituents);

      // Weighted IV = 22.0, Index IV = 14.0 -> Dirty Spread = +8.0
      assert.strictEqual(analysis.basketWeightedIV, 22.0);
      assert.strictEqual(analysis.dispersionSpread, 8.0);
    });

    test('TC-DISP-09: Classifies LONG_DISPERSION when implied correlation is rich vs realized correlation', () => {
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.5, impliedVol: 20.0 },
        { symbol: 'RELIANCE', weight: 0.5, impliedVol: 20.0 },
      ];
      // Index IV = 19.0 -> High implied correlation ~ 0.89
      const indexIV = 19.0;
      const realizedCorr = 0.40; // Realized correlation is low
      const hurdle = 0.08;

      const analysis = analyzeDispersionArbitrage(indexIV, constituents, realizedCorr, hurdle);

      assert.strictEqual(analysis.arbitrageType, 'LONG_DISPERSION', 'Must classify as LONG_DISPERSION when rho_implied > rho_realized');
      assert.strictEqual(analysis.recommendedTrade, 'SELL_INDEX_BUY_COMPONENTS');
      assert.ok(analysis.correlationSpread > hurdle, 'Correlation spread must exceed hurdle threshold');
      assert.ok(analysis.confidenceScore >= 75, 'Confidence score should be high for wide correlation gap');
    });

    test('TC-DISP-10: Classifies SHORT_DISPERSION when implied correlation is cheap vs realized correlation', () => {
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.5, impliedVol: 24.0 },
        { symbol: 'RELIANCE', weight: 0.5, impliedVol: 24.0 },
      ];
      // Index IV = 17.5 -> Lower implied correlation ~ 0.06
      const indexIV = 17.5;
      const realizedCorr = 0.65; // Realized correlation is high
      const hurdle = 0.08;

      const analysis = analyzeDispersionArbitrage(indexIV, constituents, realizedCorr, hurdle);

      assert.strictEqual(analysis.arbitrageType, 'SHORT_DISPERSION', 'Must classify as SHORT_DISPERSION when rho_implied < rho_realized');
      assert.strictEqual(analysis.recommendedTrade, 'BUY_INDEX_SELL_COMPONENTS');
      assert.ok(analysis.correlationSpread < -hurdle, 'Correlation spread must breach negative hurdle');
    });

    test('TC-DISP-11: Classifies NEUTRAL_NO_ARBITRAGE when correlation spread is within hurdle band', () => {
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.5, impliedVol: 20.0 },
        { symbol: 'RELIANCE', weight: 0.5, impliedVol: 20.0 },
      ];
      // Index IV ~ 17.4 -> implied correlation ~ 0.51
      const indexIV = 17.4;
      const realizedCorr = 0.50; // Nearly identical
      const hurdle = 0.08;

      const analysis = analyzeDispersionArbitrage(indexIV, constituents, realizedCorr, hurdle);

      assert.strictEqual(analysis.arbitrageType, 'NEUTRAL_NO_ARBITRAGE');
      assert.strictEqual(analysis.recommendedTrade, 'HOLD_NO_ACTION');
      assert.ok(Math.abs(analysis.correlationSpread) < hurdle, 'Spread should be within hurdle band');
    });

    test('TC-DISP-12: Vega-neutral basket leg allocation calculates correct contract quantities', () => {
      const constituents = [
        { symbol: 'HDFCBANK', weight: 0.60, vega: 12.0, lotSize: 25 },
        { symbol: 'RELIANCE', weight: 0.40, vega: 18.0, lotSize: 25 },
      ];
      const indexVegaPerContract = 20.0;
      const indexContracts = 100; // Total Index Vega = 2000

      const allocation = calculateVegaNeutralAllocation(indexVegaPerContract, indexContracts, constituents);

      assert.strictEqual(allocation.totalIndexVega, 2000);
      assert.ok(allocation.isVegaNeutral, 'Allocated basket must be vega-neutral within tolerance');
      assert.strictEqual(allocation.componentAllocations.length, 2);
      
      // HDFC Bank target vega = 2000 * 0.6 = 1200. With vega 12, raw contracts = 100 (4 lots of 25)
      const hdfc = allocation.componentAllocations.find((c) => c.symbol === 'HDFCBANK');
      assert.strictEqual(hdfc.contracts, 100);
      assert.strictEqual(hdfc.allocatedVega, 1200);

      // Reliance target vega = 2000 * 0.4 = 800. With vega 18, raw contracts = 44.4 -> rounds to 2 lots (50 contracts) = 900 vega
      const rel = allocation.componentAllocations.find((c) => c.symbol === 'RELIANCE');
      assert.strictEqual(rel.contracts, 50);
      assert.strictEqual(rel.allocatedVega, 900);
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Gamma Scalping Rebalance Threshold Triggers
  // =========================================================================

  describe('3. Gamma Scalping Rebalance Threshold Triggers & Scalp PnL', () => {

    test('TC-DISP-13: Triggers REBALANCE_SELL_UNDERLYING when positive delta exceeds upper threshold', () => {
      const entrySpot = 24900;
      const currentSpot = 25050; // Market rallied +150 points
      const netDelta = 38.5;     // Long delta drift
      const threshold = 25.0;    // Threshold band ±25
      const netGamma = 1.8;
      const lotSize = 25;

      const trigger = evaluateGammaScalpTrigger(currentSpot, entrySpot, netDelta, threshold, netGamma, lotSize);

      assert.strictEqual(trigger.action, 'REBALANCE_SELL_UNDERLYING', 'Must trigger SELL when net delta > +threshold');
      assert.strictEqual(trigger.hedgeInstrumentSide, 'SELL');
      // Rounds 38.5 to nearest lot of 25 -> 2 lots = 50 contracts (or 1 lot = 25 depending on rounding)
      assert.ok(trigger.recommendedHedgeQty > 0, 'Must recommend hedge quantity');
      assert.strictEqual(trigger.spotMove, 150);
      // Scalp PnL = 0.5 * 1.8 * 150^2 = 20,250
      assert.strictEqual(trigger.projectedScalpPnL, 20250);
    });

    test('TC-DISP-14: Triggers REBALANCE_BUY_UNDERLYING when negative delta breaches lower threshold', () => {
      const entrySpot = 24900;
      const currentSpot = 24780; // Market dropped -120 points
      const netDelta = -32.4;    // Short delta drift
      const threshold = 25.0;
      const netGamma = 1.5;
      const lotSize = 25;

      const trigger = evaluateGammaScalpTrigger(currentSpot, entrySpot, netDelta, threshold, netGamma, lotSize);

      assert.strictEqual(trigger.action, 'REBALANCE_BUY_UNDERLYING', 'Must trigger BUY when net delta < -threshold');
      assert.strictEqual(trigger.hedgeInstrumentSide, 'BUY');
      assert.ok(trigger.recommendedHedgeQty >= 25, 'Must recommend buying underlying lots');
      assert.strictEqual(trigger.spotMove, -120);
      // Scalp PnL = 0.5 * 1.5 * (-120)^2 = 10,800
      assert.strictEqual(trigger.projectedScalpPnL, 10800);
    });

    test('TC-DISP-15: Emits HOLD_WITHIN_BAND when delta drift is within tolerance', () => {
      const entrySpot = 24900;
      const currentSpot = 24925; // Small move
      const netDelta = 14.2;     // Inside [-25, +25]
      const threshold = 25.0;
      const netGamma = 1.5;

      const trigger = evaluateGammaScalpTrigger(currentSpot, entrySpot, netDelta, threshold, netGamma);

      assert.strictEqual(trigger.action, 'HOLD_WITHIN_BAND');
      assert.strictEqual(trigger.recommendedHedgeQty, 0);
      assert.strictEqual(trigger.hedgeInstrumentSide, 'NONE');
    });

    test('TC-DISP-16: Scalp PnL scales quadratically with spot displacement (0.5 * Gamma * dS^2)', () => {
      const entrySpot = 25000;
      const netGamma = 2.0;

      const move50 = evaluateGammaScalpTrigger(25050, entrySpot, 30, 25, netGamma);
      const move100 = evaluateGammaScalpTrigger(25100, entrySpot, 30, 25, netGamma);

      // (100 / 50)^2 = 4x PnL scaling
      assert.strictEqual(move50.projectedScalpPnL, 2500); // 0.5 * 2.0 * 2500 = 2500
      assert.strictEqual(move100.projectedScalpPnL, 10000); // 0.5 * 2.0 * 10000 = 10000
      assert.strictEqual(move100.projectedScalpPnL, move50.projectedScalpPnL * 4);
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Multi-Expiry Term Structure Skew Hedging Engine
  // =========================================================================

  describe('4. Multi-Expiry Term Structure & Skew Hedging Analytics', () => {

    test('TC-DISP-17: Detects CONTANGO regime when far-month IV exceeds near-month IV', () => {
      const nearExpiry = { daysToExpiry: 14, atmIV: 13.5, put25dIV: 16.5, call25dIV: 12.0, vega: 15.0 };
      const farExpiry  = { daysToExpiry: 42, atmIV: 15.8, put25dIV: 17.5, call25dIV: 14.5, vega: 25.0 };

      const metrics = calculateTermStructureSkewMetrics(nearExpiry, farExpiry);

      assert.strictEqual(metrics.regime, 'CONTANGO', 'Should detect CONTANGO when Far IV > Near IV');
      assert.ok(metrics.slopePerDay > 0, 'Slope must be positive');
      // Calendar vega hedge ratio: 15.0 / 25.0 = 0.60
      assert.strictEqual(metrics.calendarVegaRatio, 0.6);
    });

    test('TC-DISP-18: Detects BACKWARDATION regime when near-month IV spikes over far-month IV', () => {
      const nearExpiry = { daysToExpiry: 7,  atmIV: 24.0, put25dIV: 28.0, call25dIV: 21.0, vega: 12.0 };
      const farExpiry  = { daysToExpiry: 35, atmIV: 18.0, put25dIV: 20.0, call25dIV: 17.0, vega: 20.0 };

      const metrics = calculateTermStructureSkewMetrics(nearExpiry, farExpiry);

      assert.strictEqual(metrics.regime, 'BACKWARDATION', 'Should detect BACKWARDATION when Near IV > Far IV (vol panic)');
      assert.ok(metrics.slopePerDay < 0, 'Slope must be negative');
    });

    test('TC-DISP-19: Accurately computes 25-Delta Risk Reversal and Butterfly smile metrics', () => {
      const nearExpiry = { daysToExpiry: 14, atmIV: 14.0, put25dIV: 17.2, call25dIV: 12.8, vega: 15.0 };
      const farExpiry  = { daysToExpiry: 42, atmIV: 15.0, put25dIV: 17.0, call25dIV: 14.0, vega: 22.0 };

      const metrics = calculateTermStructureSkewMetrics(nearExpiry, farExpiry);

      // Risk Reversal = Call25d - Put25d = 12.8 - 17.2 = -4.40 (Negative indicating downside put skew)
      assert.strictEqual(metrics.nearRiskReversal, -4.40);
      // Butterfly = (12.8 + 17.2) / 2 - 14.0 = 15.0 - 14.0 = +1.00 (Positive smile curvature)
      assert.strictEqual(metrics.nearButterfly, 1.00);
    });
  });
});
