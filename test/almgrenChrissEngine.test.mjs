// Sprint 27 — Algorithmic Execution Almgren-Chriss & Optimal Order Slicing Engine Tests
// Pure JS test suite using Node.js native test runner (node:test, node:assert/strict)
// Zero external flags, zero direct TypeScript imports, runs natively with node --test

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// PURE MATHEMATICAL & ALGORITHMIC MIRROR IMPLEMENTATION FOR NODE.JS TEST RUNNER
// Based on Almgren & Chriss (2000) "Optimal Execution of Portfolio Transactions"
// ============================================================================

/**
 * Liquidation decay velocity parameter (kappa)
 * kappa = sqrt(lambda * sigma^2 / eta)
 * 
 * @param {number} lambda Risk aversion parameter (lambda >= 0)
 * @param {number} sigma Volatility (per minute or annualized scaled)
 * @param {number} eta Temporary market impact coefficient (eta > 0)
 * @returns {number} Decay parameter kappa
 */
function calculateKappa(lambda, sigma, eta) {
  const safeEta = Math.max(eta, 1e-10);
  return Math.sqrt((lambda * sigma * sigma) / safeEta);
}

/**
 * Compute continuous holdings trajectory at discrete intervals:
 * x(t) = X_0 * sinh(kappa * (T - t)) / sinh(kappa * T)
 * 
 * When kappa * T -> 0, x(t) -> X_0 * (1 - t / T) (TWAP limit)
 * 
 * @param {Object} params Execution parameters
 * @param {number} params.totalQty Total shares to liquidate (X_0)
 * @param {number} params.horizonMinutes Total execution time (T)
 * @param {number} params.riskAversion Risk aversion lambda
 * @param {number} params.sigma Volatility per minute
 * @param {number} params.temporaryImpact Temporary impact coefficient eta
 * @param {number} numSlices Number of intervals (N)
 * @returns {number[]} Array of holdings at each interval endpoint t_0 ... t_N
 */
function computeHoldingsTrajectory({ totalQty, horizonMinutes, riskAversion, sigma, temporaryImpact }, numSlices = 20) {
  const kappa = calculateKappa(riskAversion, sigma, temporaryImpact);
  const dt = horizonMinutes / numSlices;
  const holdings = [];

  for (let j = 0; j <= numSlices; j++) {
    const t = j * dt;
    let holding;
    if (kappa * horizonMinutes < 1e-9) {
      // Linear TWAP decay
      holding = totalQty * (1 - j / numSlices);
    } else {
      holding = totalQty * (Math.sinh(kappa * (horizonMinutes - t)) / Math.sinh(kappa * horizonMinutes));
    }
    holdings.push(Math.max(0, holding));
  }
  return holdings;
}

/**
 * Compute discrete Almgren-Chriss order slices:
 * x_k = q_{k-1} - q_k for k = 1..N
 * Includes strict trajectory sum conservation (sum(x_k) == totalQty).
 * 
 * @param {Object} params Execution parameters
 * @param {number} numSlices Number of intervals
 * @param {number} [lotSize=1] Optional exchange lot size (e.g. 25, 50)
 * @returns {number[]} Array of slice quantities
 */
function computeAlmgrenChrissSlices(params, numSlices = 20, lotSize = 1) {
  const holdings = computeHoldingsTrajectory(params, numSlices);
  const rawSlices = [];

  for (let j = 0; j < numSlices; j++) {
    const rawTrade = holdings[j] - holdings[j + 1];
    if (lotSize > 1) {
      rawSlices.push(Math.round(rawTrade / lotSize) * lotSize);
    } else {
      rawSlices.push(Math.round(rawTrade));
    }
  }

  // Trajectory sum conservation reconciliation
  const sumSlices = rawSlices.reduce((acc, q) => acc + q, 0);
  const diff = params.totalQty - sumSlices;
  if (rawSlices.length > 0) {
    rawSlices[rawSlices.length - 1] += diff;
  }

  return rawSlices;
}

/**
 * TWAP uniform schedule generator
 * 
 * @param {number} totalQty Total quantity
 * @param {number} numSlices Number of intervals
 * @returns {number[]} Slices summing to totalQty
 */
function computeTWAPSchedule(totalQty, numSlices) {
  const baseQty = Math.floor(totalQty / numSlices);
  const remainder = totalQty - baseQty * numSlices;
  const slices = Array(numSlices).fill(baseQty);
  slices[0] += remainder;
  return slices;
}

/**
 * Permanent price impact function:
 * g(v) = gamma * v
 * 
 * @param {number} gamma Permanent impact parameter
 * @param {number} tradeRate Trading rate (shares per minute)
 * @returns {number} Permanent impact in price units
 */
function calculatePermanentImpact(gamma, tradeRate) {
  return gamma * tradeRate;
}

/**
 * Temporary price impact function:
 * h(v) = epsilon * sgn(v) + eta * v
 * 
 * @param {number} epsilon Half bid-ask spread
 * @param {number} eta Temporary impact parameter
 * @param {number} tradeRate Trading rate (shares per minute)
 * @returns {number} Temporary impact in price units
 */
function calculateTemporaryImpact(epsilon, eta, tradeRate) {
  if (tradeRate <= 0) return 0;
  return epsilon + eta * tradeRate;
}

/**
 * Expected Execution Cost E[x] under Almgren-Chriss (2000):
 * E[x] = 0.5 * gamma * X^2 + epsilon * sum(|x_k|) + (eta / tau) * sum(x_k^2)
 * 
 * @param {number[]} slices Slice quantities x_k
 * @param {number} totalQty Initial inventory X
 * @param {number} tau Interval duration dt
 * @param {number} gamma Permanent impact coefficient
 * @param {number} epsilon Bid-ask half spread
 * @param {number} eta Temporary impact coefficient
 * @returns {number} Total expected execution cost in ₹
 */
function calculateExpectedExecutionCost(slices, totalQty, tau, gamma, epsilon, eta) {
  const permCost = 0.5 * gamma * totalQty * totalQty;
  const spreadCost = epsilon * slices.reduce((acc, x) => acc + Math.abs(x), 0);
  const tempCost = (eta / Math.max(tau, 1e-10)) * slices.reduce((acc, x) => acc + x * x, 0);
  return permCost + spreadCost + tempCost;
}

/**
 * Execution Cost Variance V[x] under Almgren-Chriss (2000):
 * V[x] = sigma^2 * tau * sum_{k=1}^N q_k^2
 * 
 * @param {number[]} holdings Holdings q_k at intervals k=1..N
 * @param {number} tau Interval duration dt
 * @param {number} sigma Asset volatility per minute
 * @returns {number} Execution cost variance
 */
function calculateCostVariance(holdings, tau, sigma) {
  // holdings array includes q_0 ... q_N; sum over k=1..N of q_k^2
  let sumQ2 = 0;
  for (let k = 1; k < holdings.length; k++) {
    sumQ2 += holdings[k] * holdings[k];
  }
  return sigma * sigma * tau * sumQ2;
}

/**
 * Objective Utility function to minimize:
 * U(x) = E[x] + lambda * V[x]
 * 
 * @param {number[]} slices Slices x_k
 * @param {number[]} holdings Holdings q_k
 * @param {number} totalQty Total quantity X
 * @param {number} tau Interval duration dt
 * @param {number} lambda Risk aversion parameter
 * @param {number} sigma Volatility per minute
 * @param {number} gamma Permanent impact
 * @param {number} epsilon Spread half
 * @param {number} eta Temporary impact
 * @returns {number} Expected utility score
 */
function calculateExecutionUtility(slices, holdings, totalQty, tau, lambda, sigma, gamma, epsilon, eta) {
  const expectedCost = calculateExpectedExecutionCost(slices, totalQty, tau, gamma, epsilon, eta);
  const variance = calculateCostVariance(holdings, tau, sigma);
  return expectedCost + lambda * variance;
}

/**
 * Realistic Indian NSE Intraday Volume Profile
 * 25 intervals of 15-min buckets from 09:15 to 15:30.
 */
function generateIndianVolumeProfile() {
  const rawWeights = [
    // Morning session (09:15 – 10:30) — opening rush
    8.5, 6.2, 4.8, 3.9, 3.2,
    // Midday lull (10:30 – 13:00)
    2.8, 2.6, 2.5, 2.4, 2.3, 2.2,
    // Pre-close build-up (13:00 – 14:30)
    2.6, 2.9, 3.4, 4.1, 4.8,
    // Closing surge (14:30 – 15:30)
    5.8, 6.9, 8.2, 9.5, 11.5,
    // Final 15-minute close auction buffer
    6.2, 4.3, 3.1, 2.3, 1.9,
  ];
  const total = rawWeights.reduce((s, w) => s + w, 0);
  const times = [
    '09:15', '09:30', '09:45', '10:00', '10:15',
    '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
    '12:00', '12:15', '12:30', '12:45',
    '13:00', '13:15', '13:30', '13:45', '14:00', '14:15',
    '14:30', '14:45', '15:00', '15:15'
  ];

  return rawWeights.map((w, i) => ({
    timeMinutesFromOpen: i * 15,
    timeLabel: times[i] || `T+${i * 15}`,
    volumeFraction: w / total,
  }));
}

/**
 * Compute VWAP schedule matching intraday volume profile
 * 
 * @param {number} totalQty Total quantity
 * @param {Array<{volumeFraction: number}>} profile Volume profile
 * @param {number} numSlices Number of intervals
 * @returns {number[]} Slices summing to totalQty
 */
function computeVWAPSchedule(totalQty, profile, numSlices) {
  const bucketsPerSlice = Math.ceil(profile.length / numSlices);
  const sliceWeights = [];

  for (let s = 0; s < numSlices; s++) {
    let weight = 0;
    for (let b = s * bucketsPerSlice; b < (s + 1) * bucketsPerSlice && b < profile.length; b++) {
      weight += profile[b].volumeFraction;
    }
    sliceWeights.push(weight);
  }

  const totalWeight = sliceWeights.reduce((s, w) => s + w, 0);
  const normalizedWeights = sliceWeights.map(w => w / totalWeight);
  const slices = normalizedWeights.map(w => Math.round(w * totalQty));

  // Reconciliation
  const sumSlices = slices.reduce((s, q) => s + q, 0);
  slices[0] += totalQty - sumSlices;

  return slices;
}

/**
 * 1-Click Execution Control: Accelerate Execution
 * Compresses remaining horizon and intervals by accelerationFactor (> 1.0)
 * 
 * @param {Object} state Current execution state
 * @param {number} state.remainingQty Shares left to execute
 * @param {number} state.remainingMinutes Minutes left
 * @param {number} state.currentInterval Current interval index
 * @param {number} state.totalIntervals Total original intervals
 * @param {number} accelerationFactor Speed multiplier (e.g. 2.0x)
 * @returns {Object} New plan with accelerated intervals
 */
function accelerateExecution(state, accelerationFactor = 2.0) {
  const newHorizon = Math.max(5, Math.round(state.remainingMinutes / accelerationFactor));
  const remainingIntervals = Math.max(1, state.totalIntervals - state.currentInterval);
  const newIntervals = Math.max(1, Math.round(remainingIntervals / accelerationFactor));
  const newRate = state.remainingQty / newHorizon;

  return {
    remainingQty: state.remainingQty,
    newHorizonMinutes: newHorizon,
    newIntervals,
    newTradeRatePerMin: newRate,
    isAccelerated: true,
  };
}

/**
 * 1-Click Execution Control: Pause Execution
 * Locks active trade slice to 0 and suspends decay until unpaused.
 * 
 * @param {Object} state Current execution state
 * @returns {Object} Paused state
 */
function pauseExecution(state) {
  return {
    ...state,
    isPaused: true,
    activeSliceQty: 0,
    lockedInventory: state.remainingQty,
  };
}

/**
 * 1-Click Execution Control: Resume Execution
 * Recomputes optimal liquidation trajectory from current inventory.
 * 
 * @param {number} remainingQty Shares remaining
 * @param {number} remainingMinutes Minutes remaining
 * @param {number} remainingIntervals Slices remaining
 * @param {number} riskAversion Risk aversion
 * @param {number} sigma Volatility
 * @param {number} temporaryImpact Temp impact
 * @returns {number[]} New slice schedule
 */
function resumeExecution(remainingQty, remainingMinutes, remainingIntervals, riskAversion, sigma, temporaryImpact) {
  return computeAlmgrenChrissSlices({
    totalQty: remainingQty,
    horizonMinutes: remainingMinutes,
    riskAversion,
    sigma,
    temporaryImpact,
  }, remainingIntervals);
}

/**
 * Indian Statutory Charges (NSE cash / intraday)
 */
function calculateIndianStatutoryCharges(notional, side = 'BUY', isDelivery = false) {
  const sttRate = isDelivery ? 0.001 : 0.00025;
  const exchangeRate = 0.0000345;
  const stampRate = 0.00015;
  const sebiRate = 0.000001;
  const brokerage = Math.min(20, notional * 0.0003);

  const stt = notional * sttRate;
  const exchange = notional * exchangeRate;
  const stamp = notional * stampRate;
  const sebi = notional * sebiRate;

  return {
    stt: Number(stt.toFixed(2)),
    exchange: Number(exchange.toFixed(2)),
    stamp: Number(stamp.toFixed(2)),
    sebi: Number(sebi.toFixed(2)),
    brokerage: Number(brokerage.toFixed(2)),
    total: Number((stt + exchange + stamp + sebi + brokerage).toFixed(2)),
  };
}

// ============================================================================
// TEST SUITE: ALMGREN-CHRISS & OPTIMAL ORDER SLICING VERIFICATION
// ============================================================================

describe('TradeCraft AI — Algorithmic Execution Almgren-Chriss & Optimal Slicing Engine (Sprint 27)', () => {

  // TC-AC-01: Trajectory Sum Conservation
  test('TC-AC-01: Trajectory Sum Conservation: sum_{k=1}^N x_k == X without rounding drift', () => {
    const testCases = [
      { totalQty: 10000, horizonMinutes: 120, numSlices: 20, lambda: 1e-6 },
      { totalQty: 50000, horizonMinutes: 60, numSlices: 12, lambda: 1e-4 },
      { totalQty: 13337, horizonMinutes: 75, numSlices: 15, lambda: 1e-5 }, // Prime / odd quantity
      { totalQty: 100, horizonMinutes: 30, numSlices: 5, lambda: 1e-7 },
      { totalQty: 1000000, horizonMinutes: 375, numSlices: 25, lambda: 1e-6 }, // Full trading day
    ];

    for (const tc of testCases) {
      const params = {
        totalQty: tc.totalQty,
        horizonMinutes: tc.horizonMinutes,
        riskAversion: tc.lambda,
        sigma: 0.25 / Math.sqrt(375),
        temporaryImpact: 0.05,
      };
      const slices = computeAlmgrenChrissSlices(params, tc.numSlices);
      assert.strictEqual(slices.length, tc.numSlices, `Slices count mismatch for X=${tc.totalQty}`);
      const sumSlices = slices.reduce((acc, q) => acc + q, 0);
      assert.strictEqual(sumSlices, tc.totalQty, `Sum of slices (${sumSlices}) must strictly equal initial order X (${tc.totalQty})`);
    }
  });

  // TC-AC-02: Monotonicity of Inventory Decay
  test('TC-AC-02: Monotonicity of Inventory Decay: q_k decreases monotonically from X down to 0 at interval N', () => {
    const params = {
      totalQty: 20000,
      horizonMinutes: 100,
      riskAversion: 2e-5,
      sigma: 0.20 / Math.sqrt(375),
      temporaryImpact: 0.04,
    };
    const numSlices = 20;
    const holdings = computeHoldingsTrajectory(params, numSlices);

    assert.strictEqual(holdings.length, numSlices + 1, 'Holdings array should have N + 1 elements');
    assert.strictEqual(holdings[0], params.totalQty, `Initial holding q_0 (${holdings[0]}) must equal X (${params.totalQty})`);
    assert.ok(Math.abs(holdings[numSlices]) < 1e-6, `Terminal holding q_N (${holdings[numSlices]}) must reach 0 at interval N`);

    // Verify strict monotonic decrease: q_0 >= q_1 >= q_2 ... >= q_N
    for (let k = 0; k < numSlices; k++) {
      assert.ok(
        holdings[k] >= holdings[k + 1],
        `Monotonicity violated at interval ${k}: q_${k} (${holdings[k]}) < q_${k+1} (${holdings[k+1]})`
      );
    }
  });

  // TC-AC-03: Risk Aversion (lambda) Sensitivity & Front-Loading Dynamics
  test('TC-AC-03: Risk Aversion (lambda) Sensitivity: Higher lambda leads to faster liquidation earlier in horizon', () => {
    const baseParams = {
      totalQty: 10000,
      horizonMinutes: 120,
      sigma: 0.25 / Math.sqrt(375),
      temporaryImpact: 0.05,
    };
    const numSlices = 20;

    const lowLambdaSlices = computeAlmgrenChrissSlices({ ...baseParams, riskAversion: 1e-8 }, numSlices);
    const midLambdaSlices = computeAlmgrenChrissSlices({ ...baseParams, riskAversion: 1e-5 }, numSlices);
    const highLambdaSlices = computeAlmgrenChrissSlices({ ...baseParams, riskAversion: 1e-3 }, numSlices);

    // Initial slice x_1 must increase strictly with higher risk aversion (aggressive front-loading)
    assert.ok(
      midLambdaSlices[0] >= lowLambdaSlices[0],
      `Mid-lambda initial slice (${midLambdaSlices[0]}) must be >= low-lambda (${lowLambdaSlices[0]})`
    );
    assert.ok(
      highLambdaSlices[0] > midLambdaSlices[0],
      `High-lambda initial slice (${highLambdaSlices[0]}) must be > mid-lambda (${midLambdaSlices[0]})`
    );

    // First half cumulative liquidation must be strictly greater for higher lambda
    const halfIndex = Math.floor(numSlices / 2);
    const lowFirstHalf = lowLambdaSlices.slice(0, halfIndex).reduce((s, q) => s + q, 0);
    const highFirstHalf = highLambdaSlices.slice(0, halfIndex).reduce((s, q) => s + q, 0);

    assert.ok(
      highFirstHalf > lowFirstHalf,
      `High lambda first half executed (${highFirstHalf}) must exceed low lambda (${lowFirstHalf})`
    );
  });

  // TC-AC-04: Convergence to Linear TWAP as lambda -> 0
  test('TC-AC-04: Convergence to Linear TWAP: lambda -> 0 converges to uniform linear TWAP trajectory', () => {
    const totalQty = 10000;
    const numSlices = 10;
    const params = {
      totalQty,
      horizonMinutes: 60,
      riskAversion: 1e-25, // Infinitesimal lambda -> 0
      sigma: 0.25 / Math.sqrt(375),
      temporaryImpact: 0.05,
    };

    const acSlices = computeAlmgrenChrissSlices(params, numSlices);
    const twapSlices = computeTWAPSchedule(totalQty, numSlices);

    assert.strictEqual(acSlices.length, twapSlices.length);
    for (let i = 0; i < numSlices; i++) {
      // In TWAP, each slice is ~1000; difference with AC under lambda->0 should be <= 1 share due to rounding
      const diff = Math.abs(acSlices[i] - twapSlices[i]);
      assert.ok(diff <= 1, `Slice ${i} differs between AC limit (${acSlices[i]}) and TWAP (${twapSlices[i]}) by ${diff}`);
    }
  });

  // TC-AC-05: Market Impact Decomposition: Permanent Impact g(v) = gamma * v Linear Scaling
  test('TC-AC-05: Market Impact Decomposition: Permanent impact g(v) = gamma * v scales linearly with trading speed', () => {
    const gamma = 0.002; // ₹ per share per unit speed
    const v1 = 50;  // 50 shares/min
    const v2 = 100; // 100 shares/min
    const v3 = 250; // 250 shares/min

    const g1 = calculatePermanentImpact(gamma, v1);
    const g2 = calculatePermanentImpact(gamma, v2);
    const g3 = calculatePermanentImpact(gamma, v3);

    // g(0) == 0
    assert.strictEqual(calculatePermanentImpact(gamma, 0), 0);

    // Linear scaling: g(2 * v1) == 2 * g(v1)
    assert.ok(Math.abs(g2 - 2 * g1) < 1e-9, `Linear scaling failed: g(2v)=${g2}, 2*g(v)=${2*g1}`);
    assert.ok(Math.abs(g3 - 5 * g1) < 1e-9, `Linear scaling failed: g(5v)=${g3}, 5*g(v)=${5*g1}`);
  });

  // TC-AC-06: Market Impact Decomposition: Temporary Impact h(v) = epsilon + eta * v
  test('TC-AC-06: Market Impact Decomposition: Temporary impact h(v) = epsilon + eta * v increases with trading speed', () => {
    const epsilon = 0.05; // half spread ₹0.05
    const eta = 0.001;    // temporary impact coeff
    const vSlow = 20;
    const vFast = 100;

    const hSlow = calculateTemporaryImpact(epsilon, eta, vSlow);
    const hFast = calculateTemporaryImpact(epsilon, eta, vFast);

    assert.ok(hSlow > epsilon, 'Temporary impact must exceed base spread');
    assert.ok(hFast > hSlow, 'Temporary impact must strictly increase with velocity');

    // Test velocity difference: h(vFast) - h(vSlow) == eta * (vFast - vSlow)
    const expectedDiff = eta * (vFast - vSlow);
    const actualDiff = hFast - hSlow;
    assert.ok(Math.abs(actualDiff - expectedDiff) < 1e-9, 'Temporary impact variable term must scale by eta');
  });

  // TC-AC-07: Implementation Shortfall Positivity & Scaling with Order Size
  test('TC-AC-07: Implementation Shortfall Positivity: Expected execution cost is strictly positive and increases with larger order size X', () => {
    const tau = 5; // 5-minute intervals
    const gamma = 0.0001;
    const epsilon = 0.02;
    const eta = 0.0005;

    const size1 = 5000;
    const size2 = 15000;

    const slices1 = computeAlmgrenChrissSlices({
      totalQty: size1,
      horizonMinutes: 60,
      riskAversion: 1e-6,
      sigma: 0.01,
      temporaryImpact: eta,
    }, 12);

    const slices2 = computeAlmgrenChrissSlices({
      totalQty: size2,
      horizonMinutes: 60,
      riskAversion: 1e-6,
      sigma: 0.01,
      temporaryImpact: eta,
    }, 12);

    const cost1 = calculateExpectedExecutionCost(slices1, size1, tau, gamma, epsilon, eta);
    const cost2 = calculateExpectedExecutionCost(slices2, size2, tau, gamma, epsilon, eta);

    assert.ok(cost1 > 0, `Expected cost for X=${size1} must be strictly positive (got ${cost1})`);
    assert.ok(cost2 > cost1, `Expected cost for X=${size2} (${cost2}) must be strictly greater than for X=${size1} (${cost1})`);

    // Due to quadratic impact terms (0.5 * gamma * X^2 and sum(x_k^2)), 3x size should have > 3x cost
    assert.ok(cost2 > 3 * cost1, `Cost scaling must be strictly convex due to quadratic market impact: cost2=${cost2}, 3*cost1=${3*cost1}`);
  });

  // TC-AC-08: Execution Cost Variance Decreases with Faster Liquidation
  test('TC-AC-08: Implementation Shortfall Variance V[x] decreases monotonically with higher risk aversion (faster liquidation)', () => {
    const totalQty = 10000;
    const horizonMinutes = 60;
    const numSlices = 12;
    const tau = horizonMinutes / numSlices;
    const sigma = 0.20 / Math.sqrt(375);
    const eta = 0.05;

    const holdingsLow = computeHoldingsTrajectory({
      totalQty,
      horizonMinutes,
      riskAversion: 1e-8, // passive
      sigma,
      temporaryImpact: eta,
    }, numSlices);

    const holdingsHigh = computeHoldingsTrajectory({
      totalQty,
      horizonMinutes,
      riskAversion: 1e-4, // aggressive
      sigma,
      temporaryImpact: eta,
    }, numSlices);

    const varLow = calculateCostVariance(holdingsLow, tau, sigma);
    const varHigh = calculateCostVariance(holdingsHigh, tau, sigma);

    assert.ok(
      varHigh < varLow,
      `Cost variance for aggressive liquidation (${varHigh}) must be strictly less than passive (${varLow})`
    );
  });

  // TC-AC-09: Benchmarks Comparison: Almgren-Chriss Expected Utility <= TWAP Utility
  test('TC-AC-09: Benchmarks Comparison: Almgren-Chriss expected utility E[x] + lambda * V[x] is strictly <= TWAP utility for any lambda > 0', () => {
    const totalQty = 10000;
    const horizonMinutes = 60;
    const numSlices = 12;
    const tau = horizonMinutes / numSlices;
    const lambda = 1e-5;
    const sigma = 0.02;
    const gamma = 0.0001;
    const epsilon = 0.02;
    const eta = 0.001;

    // AC Trajectory
    const acParams = { totalQty, horizonMinutes, riskAversion: lambda, sigma, temporaryImpact: eta };
    const acHoldings = computeHoldingsTrajectory(acParams, numSlices);
    const acSlices = computeAlmgrenChrissSlices(acParams, numSlices);
    const acUtility = calculateExecutionUtility(acSlices, acHoldings, totalQty, tau, lambda, sigma, gamma, epsilon, eta);

    // TWAP Trajectory
    const twapHoldings = computeHoldingsTrajectory({ ...acParams, riskAversion: 1e-25 }, numSlices);
    const twapSlices = computeTWAPSchedule(totalQty, numSlices);
    const twapUtility = calculateExecutionUtility(twapSlices, twapHoldings, totalQty, tau, lambda, sigma, gamma, epsilon, eta);

    assert.ok(
      acUtility <= twapUtility,
      `Almgren-Chriss utility (${acUtility}) must be <= TWAP utility (${twapUtility}) for lambda=${lambda}`
    );
  });

  // TC-AC-10: Decay Velocity Parameter (Kappa) Analytical Formula
  test('TC-AC-10: Analytical Decay Velocity Parameter kappa = sqrt(lambda * sigma^2 / eta)', () => {
    const lambda = 4e-6;
    const sigma = 0.01;
    const eta = 0.0001;

    const expectedKappa = Math.sqrt((lambda * sigma * sigma) / eta);
    const calculatedKappa = calculateKappa(lambda, sigma, eta);

    assert.ok(Math.abs(calculatedKappa - expectedKappa) < 1e-12, 'Kappa formula evaluation exactness');
    assert.strictEqual(calculateKappa(0, sigma, eta), 0, 'Kappa must be 0 when lambda is 0');
  });

  // TC-AC-11: VWAP U-Shaped Profile: Intraday Distribution Verification
  test('TC-AC-11: VWAP U-Shaped Profile: NSE volume profile displays higher volume at open (09:15) and close (15:00-15:30), lower at midday', () => {
    const profile = generateIndianVolumeProfile();
    assert.strictEqual(profile.length, 26, 'Profile must contain exactly 26 intraday buckets matching executionEngine');

    // Morning open bucket (09:15, index 0: 8.5%)
    const morningBucketWeight = profile[0].volumeFraction;
    // Midday lull bucket (11:45, index 10: 2.2%)
    const middayBucketWeight = profile[10].volumeFraction;
    // Closing peak surge bucket (14:15, index 20: 11.5%)
    const closingBucketWeight = profile[20].volumeFraction;

    assert.ok(morningBucketWeight > middayBucketWeight, `Morning volume (${morningBucketWeight.toFixed(4)}) must exceed midday lull (${middayBucketWeight.toFixed(4)})`);
    assert.ok(closingBucketWeight > middayBucketWeight, `Closing volume (${closingBucketWeight.toFixed(4)}) must exceed midday lull (${middayBucketWeight.toFixed(4)})`);
    assert.ok(closingBucketWeight > morningBucketWeight, `Peak closing volume (${closingBucketWeight.toFixed(4)}) exceeds open (${morningBucketWeight.toFixed(4)})`);

    // Total fraction must sum to exactly 1.0 (within 1e-6)
    const totalFraction = profile.reduce((s, p) => s + p.volumeFraction, 0);
    assert.ok(Math.abs(totalFraction - 1.0) < 1e-6, `Volume profile fractions must sum to 1.0 (got ${totalFraction})`);
  });

  // TC-AC-12: VWAP Order Slices Follow U-Shaped Profile
  test('TC-AC-12: VWAP Order Slices: Allocates larger quantities to high-volume market open and close intervals', () => {
    const profile = generateIndianVolumeProfile();
    const totalQty = 26000;
    const numSlices = 26; // 1:1 slice per bucket

    const vwapSlices = computeVWAPSchedule(totalQty, profile, numSlices);

    assert.strictEqual(vwapSlices.length, numSlices);
    const sumQty = vwapSlices.reduce((s, q) => s + q, 0);
    assert.strictEqual(sumQty, totalQty, `VWAP slices sum (${sumQty}) must strictly equal total order (${totalQty})`);

    // Slice 0 (Morning 09:15) and Slice 20 (Closing surge) should be larger than Slice 10 (Midday lull)
    assert.ok(
      vwapSlices[0] > vwapSlices[10],
      `Morning slice (${vwapSlices[0]}) must exceed midday slice (${vwapSlices[10]})`
    );
    assert.ok(
      vwapSlices[20] > vwapSlices[10],
      `Closing slice (${vwapSlices[20]}) must exceed midday slice (${vwapSlices[10]})`
    );
  });

  // TC-AC-13: Discrete Dynamic Re-Slicing with Lot Size Discretization
  test('TC-AC-13: Lot Size Discretization: Order slices align with exchange lot size constraints (e.g. 25, 50)', () => {
    const totalQty = 5000; // multiple of 25 and 50
    const lotSize = 25;
    const params = {
      totalQty,
      horizonMinutes: 60,
      riskAversion: 5e-6,
      sigma: 0.20 / Math.sqrt(375),
      temporaryImpact: 0.05,
    };

    const slices = computeAlmgrenChrissSlices(params, 10, lotSize);
    assert.strictEqual(slices.reduce((s, q) => s + q, 0), totalQty);

    for (let i = 0; i < slices.length; i++) {
      assert.strictEqual(
        slices[i] % lotSize,
        0,
        `Slice ${i} quantity (${slices[i]}) must be a multiple of lot size ${lotSize}`
      );
    }
  });

  // TC-AC-14: 1-Click Execution Controls - Accelerate Liquidation
  test('TC-AC-14: 1-Click Execution Controls: Accelerate decreases remaining intervals and increases execution speed', () => {
    const state = {
      remainingQty: 6000,
      remainingMinutes: 60,
      currentInterval: 4,
      totalIntervals: 10,
    };

    const accelerated = accelerateExecution(state, 2.0);

    assert.ok(accelerated.isAccelerated, 'Acceleration flag must be set');
    assert.ok(accelerated.newHorizonMinutes < state.remainingMinutes, 'Horizon must be shortened');
    assert.strictEqual(accelerated.newHorizonMinutes, 30, 'Horizon should be compressed by factor 2.0');
    assert.strictEqual(accelerated.newIntervals, 3, 'Remaining intervals should be halved from 6 to 3');
    assert.strictEqual(accelerated.newTradeRatePerMin, 6000 / 30, 'Trade rate should double to 200 shares/min');
  });

  // TC-AC-15: 1-Click Execution Controls - Pause Mode
  test('TC-AC-15: 1-Click Execution Controls: Pause locks active trade slices to 0 and holds inventory', () => {
    const state = {
      remainingQty: 4500,
      remainingMinutes: 45,
      currentInterval: 5,
      totalIntervals: 10,
    };

    const paused = pauseExecution(state);

    assert.strictEqual(paused.isPaused, true, 'Execution must enter paused state');
    assert.strictEqual(paused.activeSliceQty, 0, 'Active slice quantity must be locked to 0');
    assert.strictEqual(paused.lockedInventory, 4500, 'Remaining inventory must be locked without decay');
  });

  // TC-AC-16: 1-Click Execution Controls - Resume & Rebalance
  test('TC-AC-16: 1-Click Execution Controls: Resume re-optimizes remaining inventory over remaining intervals', () => {
    const remainingQty = 4500;
    const remainingMinutes = 45;
    const remainingIntervals = 5;
    const riskAversion = 1e-5;
    const sigma = 0.01;
    const temporaryImpact = 0.05;

    const resumedSlices = resumeExecution(
      remainingQty,
      remainingMinutes,
      remainingIntervals,
      riskAversion,
      sigma,
      temporaryImpact
    );

    assert.strictEqual(resumedSlices.length, remainingIntervals, 'Must generate exactly remainingIntervals slices');
    const totalResumed = resumedSlices.reduce((s, q) => s + q, 0);
    assert.strictEqual(totalResumed, remainingQty, `Resumed slices must conserve remaining inventory (${remainingQty})`);
    assert.ok(resumedSlices[0] > 0, 'First resumed slice must be positive');
  });

  // TC-AC-17: Indian Statutory Fee Drag & Slippage Integration
  test('TC-AC-17: Indian Statutory Fee Drag: Accurately decomposes STT, Stamp Duty, and SEBI charges on executed notional', () => {
    const notional = 1000000; // ₹10 Lakhs notional trade
    const intradayCharges = calculateIndianStatutoryCharges(notional, 'BUY', false);
    const deliveryCharges = calculateIndianStatutoryCharges(notional, 'BUY', true);

    // Intraday STT = 0.025% = ₹250
    assert.strictEqual(intradayCharges.stt, 250);
    // Delivery STT = 0.1% = ₹1000
    assert.strictEqual(deliveryCharges.stt, 1000);

    // Exchange turnover = 0.00345% = ₹34.50
    assert.strictEqual(intradayCharges.exchange, 34.5);
    // Stamp duty = 0.015% = ₹150
    assert.strictEqual(intradayCharges.stamp, 150);
    // SEBI fee = 0.0001% = ₹1
    assert.strictEqual(intradayCharges.sebi, 1);
    // Brokerage capped at ₹20
    assert.strictEqual(intradayCharges.brokerage, 20);

    // Total must be positive and sum correctly
    assert.strictEqual(intradayCharges.total, 250 + 34.5 + 150 + 1 + 20);
    assert.ok(deliveryCharges.total > intradayCharges.total, 'Delivery statutory fees must exceed intraday due to higher STT');
  });

});
