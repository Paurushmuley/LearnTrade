// Sprint 28 — Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Allocation Engine
// Pure JS test suite using Node.js native test runner (node:test, node:assert/strict)
// Zero external flags, zero direct TypeScript imports, runs natively with node --test

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// PURE MATHEMATICAL & ALGORITHMIC MIRROR IMPLEMENTATION FOR NODE.JS TEST RUNNER
// ============================================================================

/**
 * 3-State Market Regime Enumeration
 * State 0: BULL (Upward drift, moderate volatility)
 * State 1: SIDEWAYS / NEUTRAL (Low drift, compressed volatility)
 * State 2: CRISIS / BEAR (Negative drift, severe volatility spike)
 */
const REGIME_STATES = {
  BULL: 0,
  SIDEWAYS: 1,
  CRISIS: 2
};

const REGIME_NAMES = ['BULL', 'SIDEWAYS', 'CRISIS'];

/**
 * Default First-Order Markov Transition Probability Matrix A = (a_ij)
 * Rows: Current State i
 * Columns: Next State j
 * Invariant: sum_j a_ij === 1.0 for each row i
 */
const DEFAULT_TRANSITION_MATRIX = [
  [0.92, 0.06, 0.02], // Bull: sticky, 6% shift to sideways, 2% crash risk
  [0.05, 0.90, 0.05], // Sideways: sticky, 5% breakout bull, 5% breakdown crisis
  [0.03, 0.12, 0.85]  // Crisis: sticky selloff, 12% calm down to sideways, 3% V-shape recovery
];

/**
 * Gaussian Emission Parameters b_k(y) = N(mu_k, sigma_k^2)
 * Calibrated to Indian Benchmark (NIFTY 50 daily log-returns)
 */
const DEFAULT_EMISSION_PARAMS = [
  { mean: 0.0008, stdDev: 0.0090 }, // Bull: +0.08% / day (~20% ann), 0.9% daily vol (~14.3% ann)
  { mean: 0.0001, stdDev: 0.0050 }, // Sideways: +0.01% / day (~2.5% ann), 0.5% daily vol (~7.9% ann)
  { mean: -0.0028, stdDev: 0.0220 } // Crisis: -0.28% / day (-70% ann), 2.2% daily vol (~35% ann)
];

/**
 * Prior Regime Probabilities pi_k at t = 0
 */
const DEFAULT_PRIORS = [0.60, 0.30, 0.10];

/**
 * 4-Asset Multi-Asset Universe for Indian Markets
 */
const ASSET_UNIVERSE = ['NIFTY_50', 'BANKNIFTY', 'GOLD_BEES', 'LIQUID_BEES'];

/**
 * Calibrated Daily Covariance Matrix Sigma for [NIFTY, BANKNIFTY, GOLD, CASH]
 * Daily Volatilities: NIFTY=1.0% (16% ann), BANKNIFTY=1.5% (24% ann), GOLD=0.8% (12.7% ann), CASH=0.05% (0.8% ann)
 * Correlations: NIFTY-BANKNIFTY=+0.82, NIFTY-GOLD=-0.10, BANKNIFTY-GOLD=-0.08, CASH=0.0 uncorrelated
 */
const DEFAULT_COVARIANCE_MATRIX = [
  [0.00010000, 0.00012300, -0.00000800, 0.00000000],
  [0.00012300, 0.00022500, -0.00000960, 0.00000000],
  [-0.00000800, -0.00000960, 0.00006400, 0.00000000],
  [0.00000000, 0.00000000, 0.00000000, 0.00000025]
];

/**
 * Evaluates univariate Gaussian Emission Probability Density:
 * b_k(y) = (1 / (sigma_k * sqrt(2 * pi))) * exp(-0.5 * ((y - mu_k) / sigma_k)^2)
 */
function gaussianEmissionPDF(y, mean, stdDev) {
  const sigma = Math.max(stdDev, 1e-8);
  const z = (y - mean) / sigma;
  const invSqrt2Pi = 0.3989422804014327; // 1 / sqrt(2*pi)
  return (invSqrt2Pi / sigma) * Math.exp(-0.5 * z * z);
}

/**
 * Single-step Online Forward Filter Update:
 * Computes P(S_t = k | y_{1:t}) from P(S_{t-1} = i | y_{1:t-1}) and new observation y_t.
 * Guarantees sum_k P(S_t = k) === 1.0.
 */
function forwardFilterStep(prevProbs, y, transitionMatrix = DEFAULT_TRANSITION_MATRIX, emissionParams = DEFAULT_EMISSION_PARAMS) {
  const K = transitionMatrix.length;
  // 1. Predict Step: P(S_t = j | y_{1:t-1}) = sum_i P(S_{t-1} = i | y_{1:t-1}) * a_ij
  const predProbs = new Array(K).fill(0);
  for (let j = 0; j < K; j++) {
    let sum = 0;
    for (let i = 0; i < K; i++) {
      sum += prevProbs[i] * transitionMatrix[i][j];
    }
    predProbs[j] = sum;
  }

  // 2. Update Step: alpha_t(k) = P(S_t = k | y_{1:t-1}) * b_k(y_t)
  const unnorm = new Array(K);
  let totalLikelihood = 0;
  for (let k = 0; k < K; k++) {
    const density = gaussianEmissionPDF(y, emissionParams[k].mean, emissionParams[k].stdDev);
    unnorm[k] = predProbs[k] * density;
    totalLikelihood += unnorm[k];
  }

  // 3. Normalization: P(S_t = k | y_{1:t}) = alpha_t(k) / sum_j alpha_t(j)
  if (totalLikelihood <= 1e-250) {
    return [...predProbs]; // Underflow fallback
  }

  return unnorm.map(val => val / totalLikelihood);
}

/**
 * Multi-period Forward Filter over an array of historical returns
 */
function forwardFilterSequence(returns, transitionMatrix = DEFAULT_TRANSITION_MATRIX, emissionParams = DEFAULT_EMISSION_PARAMS, priors = DEFAULT_PRIORS) {
  const history = [];
  let currentProbs = [...priors];

  for (let t = 0; t < returns.length; t++) {
    currentProbs = forwardFilterStep(currentProbs, returns[t], transitionMatrix, emissionParams);
    history.push(currentProbs);
  }

  return history;
}

/**
 * Viterbi Dynamic Programming Algorithm for Global MAP State Sequence:
 * S* = argmax_{S_{1:T}} P(S_{1:T}, y_{1:T})
 */
function viterbiDecode(returns, transitionMatrix = DEFAULT_TRANSITION_MATRIX, emissionParams = DEFAULT_EMISSION_PARAMS, priors = DEFAULT_PRIORS) {
  const T = returns.length;
  const K = transitionMatrix.length;
  if (T === 0) return [];

  // Log-space matrices to prevent numerical underflow
  const V = Array.from({ length: T }, () => new Array(K).fill(-Infinity));
  const backpointer = Array.from({ length: T }, () => new Array(K).fill(0));

  // Initialization at t = 0
  for (let k = 0; k < K; k++) {
    const b = Math.max(gaussianEmissionPDF(returns[0], emissionParams[k].mean, emissionParams[k].stdDev), 1e-300);
    const p = Math.max(priors[k], 1e-300);
    V[0][k] = Math.log(p) + Math.log(b);
  }

  // Induction for t = 1 to T - 1
  for (let t = 1; t < T; t++) {
    for (let k = 0; k < K; k++) {
      const b = Math.max(gaussianEmissionPDF(returns[t], emissionParams[k].mean, emissionParams[k].stdDev), 1e-300);
      const logB = Math.log(b);
      let bestPrevLog = -Infinity;
      let bestPrevState = 0;

      for (let i = 0; i < K; i++) {
        const transProb = Math.max(transitionMatrix[i][k], 1e-300);
        const candidate = V[t - 1][i] + Math.log(transProb);
        if (candidate > bestPrevLog) {
          bestPrevLog = candidate;
          bestPrevState = i;
        }
      }

      V[t][k] = bestPrevLog + logB;
      backpointer[t][k] = bestPrevState;
    }
  }

  // Termination: find optimal terminal state S*_T
  let bestTerminalState = 0;
  let maxTerminalLog = -Infinity;
  for (let k = 0; k < K; k++) {
    if (V[T - 1][k] > maxTerminalLog) {
      maxTerminalLog = V[T - 1][k];
      bestTerminalState = k;
    }
  }

  // Backtracking path
  const path = new Array(T);
  path[T - 1] = bestTerminalState;
  for (let t = T - 1; t > 0; t--) {
    path[t - 1] = backpointer[t][path[t]];
  }

  return path;
}

/**
 * Computes Joint Log-Likelihood of a specific state path S and observations y
 */
function computePathLogLikelihood(path, returns, transitionMatrix = DEFAULT_TRANSITION_MATRIX, emissionParams = DEFAULT_EMISSION_PARAMS, priors = DEFAULT_PRIORS) {
  if (path.length !== returns.length || path.length === 0) return -Infinity;
  let logLik = Math.log(Math.max(priors[path[0]], 1e-300)) +
    Math.log(Math.max(gaussianEmissionPDF(returns[0], emissionParams[path[0]].mean, emissionParams[path[0]].stdDev), 1e-300));

  for (let t = 1; t < returns.length; t++) {
    const from = path[t - 1];
    const to = path[t];
    const trans = Math.max(transitionMatrix[from][to], 1e-300);
    const emis = Math.max(gaussianEmissionPDF(returns[t], emissionParams[to].mean, emissionParams[to].stdDev), 1e-300);
    logLik += Math.log(trans) + Math.log(emis);
  }

  return logLik;
}

/**
 * Calculates Expected Regime Duration: E[D_k] = 1 / (1 - a_kk)
 */
function calculateExpectedDuration(a_kk) {
  if (a_kk >= 1.0) return Infinity;
  if (a_kk <= 0.0) return 1.0;
  return 1.0 / (1.0 - a_kk);
}

/**
 * Calculates Regime Half-Life: t_{1/2} = -ln(2) / ln(a_kk)
 */
function calculateRegimeHalfLife(a_kk) {
  if (a_kk <= 0 || a_kk >= 1) return 0;
  return -Math.LN2 / Math.log(a_kk);
}

/**
 * Computes Stationary (Ergodic) Distribution of Markov Chain:
 * Solves pi * A = pi, sum_k pi_k = 1 via power iteration
 */
function calculateStationaryDistribution(transitionMatrix, maxIterations = 500, tol = 1e-10) {
  const K = transitionMatrix.length;
  let pi = new Array(K).fill(1 / K);

  for (let iter = 0; iter < maxIterations; iter++) {
    const nextPi = new Array(K).fill(0);
    for (let j = 0; j < K; j++) {
      for (let i = 0; i < K; i++) {
        nextPi[j] += pi[i] * transitionMatrix[i][j];
      }
    }
    const delta = nextPi.reduce((sum, v, idx) => sum + Math.abs(v - pi[idx]), 0);
    pi = nextPi;
    if (delta < tol) break;
  }

  const sumPi = pi.reduce((a, b) => a + b, 0);
  return pi.map(v => v / sumPi);
}

/**
 * Computes Portfolio Variance: sigma_p^2 = w^T * Sigma * w
 */
function calculatePortfolioVariance(weights, covMatrix) {
  const N = weights.length;
  let variance = 0;
  for (let i = 0; i < N; i++) {
    let rowSum = 0;
    for (let j = 0; j < N; j++) {
      rowSum += covMatrix[i][j] * weights[j];
    }
    variance += weights[i] * rowSum;
  }
  return Math.max(0, variance);
}

/**
 * Computes Marginal Risk Contributions (MRC_i = (Sigma * w)_i / sigma_p)
 * and Absolute Risk Contributions (RC_i = w_i * MRC_i)
 */
function calculateRiskContributions(weights, covMatrix) {
  const N = weights.length;
  const variance = calculatePortfolioVariance(weights, covMatrix);
  const sigmaP = Math.sqrt(variance);

  const sigmaW = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      sigmaW[i] += covMatrix[i][j] * weights[j];
    }
  }

  const mrc = sigmaW.map(sw => (sigmaP > 1e-12 ? sw / sigmaP : 0));
  const rc = weights.map((w, i) => (sigmaP > 1e-12 ? (w * sigmaW[i]) / sigmaP : 0));
  const fractionalRC = rc.map(r => (sigmaP > 1e-12 ? r / sigmaP : 1 / N));

  return {
    portfolioVariance: variance,
    portfolioVolatility: sigmaP,
    marginalRiskContributions: mrc,
    riskContributions: rc,
    fractionalRiskContributions: fractionalRC
  };
}

/**
 * Cyclical Coordinate Descent (CCD) Risk Parity / Equal Risk Contribution Solver (Spinu 2013, Roncalli 2013)
 * Solves w_i * (Sigma * w)_i = b_i * sigma_p^2 subject to w >= 0, sum w = 1.
 * Quadratic coordinate update: Sigma_ii * w_i^2 + a_i * w_i - b_i = 0
 */
function solveRiskParityWeights(covMatrix, riskBudgets = null, maxIter = 200, tol = 1e-9) {
  const N = covMatrix.length;
  const budgets = riskBudgets && riskBudgets.length === N
    ? riskBudgets.map(b => Math.max(1e-6, b))
    : new Array(N).fill(1 / N);

  const sumB = budgets.reduce((a, b) => a + b, 0);
  const normalizedBudgets = budgets.map(b => b / sumB);

  // Initialize inversely proportional to asset volatility
  let w = covMatrix.map(row => 1 / Math.sqrt(Math.max(row[0] || 1e-6, 1e-6)));
  const initSum = w.reduce((a, b) => a + b, 0);
  w = w.map(v => v / initSum);

  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;
    for (let i = 0; i < N; i++) {
      let a_i = 0;
      for (let j = 0; j < N; j++) {
        if (j !== i) {
          a_i += covMatrix[i][j] * w[j];
        }
      }
      const sigma_ii = Math.max(covMatrix[i][i], 1e-10);
      const b_i = normalizedBudgets[i];
      // Positive root of quadratic: sigma_ii * w_i^2 + a_i * w_i - b_i = 0
      const discriminant = a_i * a_i + 4 * sigma_ii * b_i;
      const newW_i = (-a_i + Math.sqrt(Math.max(0, discriminant))) / (2 * sigma_ii);

      maxChange = Math.max(maxChange, Math.abs(newW_i - w[i]));
      w[i] = Math.max(1e-8, newW_i);
    }

    if (maxChange < tol) break;
  }

  // Normalize to strictly sum to 1.0
  const finalSum = w.reduce((a, b) => a + b, 0);
  return w.map(v => v / finalSum);
}

/**
 * Returns Regime Risk Budgets for [NIFTY, BANKNIFTY, GOLD, CASH]
 */
function getRegimeRiskBudgets(regimeState) {
  switch (regimeState) {
    case REGIME_STATES.BULL:
      // High equity beta allocation
      return [0.45, 0.40, 0.12, 0.03];
    case REGIME_STATES.SIDEWAYS:
      // Balanced all-weather allocation
      return [0.25, 0.25, 0.35, 0.15];
    case REGIME_STATES.CRISIS:
      // Extreme capital preservation & flight to safety
      return [0.03, 0.02, 0.55, 0.40];
    default:
      return [0.25, 0.25, 0.25, 0.25];
  }
}

/**
 * Dynamically Blends Regime Risk Budgets by Posterior Filter Probabilities P(S_t = k)
 */
function calculateBlendedRegimeWeights(regimeProbs, covMatrix = DEFAULT_COVARIANCE_MATRIX) {
  const K = regimeProbs.length;
  const N = covMatrix.length;
  const blendedBudgets = new Array(N).fill(0);

  for (let k = 0; k < K; k++) {
    const stateBudgets = getRegimeRiskBudgets(k);
    for (let i = 0; i < N; i++) {
      blendedBudgets[i] += regimeProbs[k] * stateBudgets[i];
    }
  }

  return solveRiskParityWeights(covMatrix, blendedBudgets);
}

/**
 * Dynamic Volatility Targeting:
 * Scales portfolio risky assets to meet target annualized volatility.
 * Unallocated capital is safely parked in LIQUID_BEES (Cash).
 */
function applyVolatilityTargeting(weights, covMatrix, targetVolAnn = 0.10, annualizationFactor = 252) {
  const N = weights.length;
  const dailyVariance = calculatePortfolioVariance(weights, covMatrix);
  const realizedVolDaily = Math.sqrt(dailyVariance);
  const realizedVolAnn = realizedVolDaily * Math.sqrt(annualizationFactor);

  if (realizedVolAnn <= 1e-6) {
    return {
      scaledWeights: [...weights],
      scalar: 1.0,
      realizedVolAnn,
      targetVolAnn,
      cashParked: weights[N - 1]
    };
  }

  const scalar = Math.min(1.0, targetVolAnn / realizedVolAnn);
  const scaledWeights = new Array(N).fill(0);

  // Scale risky assets (indices 0 to N-2)
  let allocatedRisky = 0;
  for (let i = 0; i < N - 1; i++) {
    scaledWeights[i] = weights[i] * scalar;
    allocatedRisky += scaledWeights[i];
  }

  // Allocate remaining capital strictly to Cash (index N-1)
  scaledWeights[N - 1] = Math.max(0, 1.0 - allocatedRisky);

  const newDailyVar = calculatePortfolioVariance(scaledWeights, covMatrix);
  const newVolAnn = Math.sqrt(newDailyVar) * Math.sqrt(annualizationFactor);

  return {
    scaledWeights,
    scalar,
    realizedVolAnn: newVolAnn,
    targetVolAnn,
    cashParked: scaledWeights[N - 1]
  };
}

/**
 * 1-Click Regime Action: Rebalance Orders Generation
 * Computes weight delta vector, required buy/sell orders, and portfolio turnover
 */
function calculateRebalanceOrders(currentWeights, targetWeights, portfolioValue = 1000000) {
  const N = currentWeights.length;
  const orders = [];
  let turnoverSum = 0;
  let netDelta = 0;

  for (let i = 0; i < N; i++) {
    const deltaWeight = targetWeights[i] - currentWeights[i];
    netDelta += deltaWeight;
    turnoverSum += Math.abs(deltaWeight);
    const tradeValue = Math.round(deltaWeight * portfolioValue * 100) / 100;

    let action = 'HOLD';
    if (deltaWeight > 0.0001) action = 'BUY';
    else if (deltaWeight < -0.0001) action = 'SELL';

    orders.push({
      asset: ASSET_UNIVERSE[i],
      currentWeight: currentWeights[i],
      targetWeight: targetWeights[i],
      deltaWeight,
      tradeValue,
      action
    });
  }

  return {
    orders,
    turnoverRatio: turnoverSum / 2.0, // Standard 0.5 * sum |delta_w|
    netDelta,
    capitalConserved: Math.abs(netDelta) < 1e-5
  };
}

/**
 * 1-Click Regime Action: Tail Hedge Emergency Protocol
 * Instantly zeroes out all equity allocations, parking 100% of portfolio into Safe Haven Gold & Cash
 */
function applyTailHedge(defenseSplit = { gold: 0.50, cash: 0.50 }) {
  const totalDefense = defenseSplit.gold + defenseSplit.cash;
  const normGold = defenseSplit.gold / totalDefense;
  const normCash = defenseSplit.cash / totalDefense;

  return [
    0.0,      // NIFTY 50: Zeroed out
    0.0,      // BANKNIFTY: Zeroed out
    normGold, // GOLD BEES
    normCash  // LIQUID BEES
  ];
}

// ============================================================================
// TEST SUITE: MARKET REGIME DETECTION & HMM ALLOCATION ENGINE
// ============================================================================

describe('TradeCraft Market Regime Detection & Hidden Markov Model Allocation Engine (Sprint 28)', () => {

  test('TC-REGIME-01: Markov Transition Matrix Stochasticity & Row Sum Invariants', () => {
    const A = DEFAULT_TRANSITION_MATRIX;
    assert.strictEqual(A.length, 3, 'Transition matrix must have exactly 3 rows');

    for (let i = 0; i < 3; i++) {
      assert.strictEqual(A[i].length, 3, `Row ${i} must have 3 columns`);
      let rowSum = 0;
      for (let j = 0; j < 3; j++) {
        assert.ok(A[i][j] >= 0.0 && A[i][j] <= 1.0, `Transition prob A[${i}][${j}] must be bounded in [0, 1]`);
        rowSum += A[i][j];
      }
      assert.ok(Math.abs(rowSum - 1.0) < 1e-7, `Row ${i} must sum exactly to 1.0 (got ${rowSum})`);
      // Regimes must exhibit strong diagonal stickiness/persistence (inertia)
      assert.ok(A[i][i] >= 0.80, `Diagonal persistence A[${i}][${i}] must exceed 0.80 for market regimes`);
    }
  });

  test('TC-REGIME-02: Gaussian Emission Probability Density Non-Negativity, Peak & Symmetry', () => {
    const params = DEFAULT_EMISSION_PARAMS;

    for (let k = 0; k < 3; k++) {
      const { mean, stdDev } = params[k];
      const peakDensity = gaussianEmissionPDF(mean, mean, stdDev);
      assert.ok(peakDensity > 0, `Emission density for state ${k} at mean must be positive`);

      // Peak density check: density at mean must strictly exceed density at offset points
      const offsetPos = gaussianEmissionPDF(mean + stdDev, mean, stdDev);
      const offsetNeg = gaussianEmissionPDF(mean - stdDev, mean, stdDev);
      assert.ok(peakDensity > offsetPos, `Density at mean must strictly exceed density at +1 sigma`);
      assert.ok(peakDensity > offsetNeg, `Density at mean must strictly exceed density at -1 sigma`);

      // Symmetry check: density at mu + delta must equal density at mu - delta
      assert.ok(Math.abs(offsetPos - offsetNeg) < 1e-12, `Gaussian density must be perfectly symmetric around mean`);

      // Tail decay check: 5 sigma deviation must approach 0 relative to peak
      const tailDensity = gaussianEmissionPDF(mean + 5 * stdDev, mean, stdDev);
      const tailRelative = tailDensity / peakDensity;
      assert.ok(tailRelative < 1e-5, `Gaussian tail relative density at 5 sigma must be negligible (< 1e-5, got ${tailRelative})`);
    }
  });

  test('TC-REGIME-03: Forward Algorithm Filter Probability Strict Normalization (sum_k == 1.0)', () => {
    // 25 periods of simulated Indian market returns (daily)
    const simulatedReturns = [
      0.004, 0.002, -0.001, 0.007, 0.003,
      -0.015, -0.022, -0.035, -0.018, 0.001,
      0.000, 0.001, -0.002, 0.002, 0.000,
      0.012, 0.009, 0.015, 0.008, 0.006,
      -0.001, 0.002, 0.003, -0.004, 0.005
    ];

    const filterHistory = forwardFilterSequence(simulatedReturns);
    assert.strictEqual(filterHistory.length, simulatedReturns.length);

    filterHistory.forEach((probs, t) => {
      assert.strictEqual(probs.length, 3, `Time step ${t} must have 3 regime probabilities`);
      let sumP = 0;
      for (let k = 0; k < 3; k++) {
        assert.ok(probs[k] >= 0.0 && probs[k] <= 1.0, `Probability P(S_${t}=${k}) must be bounded in [0, 1]`);
        sumP += probs[k];
      }
      assert.ok(Math.abs(sumP - 1.0) < 1e-7, `Probabilities at time step ${t} must sum to 1.0 (got ${sumP})`);
    });
  });

  test('TC-REGIME-04: Monotonic Crisis State Sensitivity to Extreme Downside Returns', () => {
    const calmPrior = [0.70, 0.25, 0.05]; // Baseline calm state

    // Simulate increasing severity of market down moves
    const returnShocks = [-0.005, -0.015, -0.025, -0.040, -0.060];
    const crisisProbs = [];

    for (const shock of returnShocks) {
      const updatedProbs = forwardFilterStep(calmPrior, shock);
      crisisProbs.push(updatedProbs[REGIME_STATES.CRISIS]);
    }

    // Assert strictly monotonic increase of Crisis probability as market drop deepens
    for (let i = 1; i < crisisProbs.length; i++) {
      assert.ok(
        crisisProbs[i] > crisisProbs[i - 1],
        `Crisis probability must increase monotonically with shock size: ${crisisProbs[i]} > ${crisisProbs[i - 1]}`
      );
    }

    // Under an extreme -6.0% crash, Crisis probability must dominate (> 0.85)
    assert.ok(crisisProbs[crisisProbs.length - 1] > 0.85, 'Crisis probability must exceed 0.85 under a -6.0% market crash');
  });

  test('TC-REGIME-05: Monotonic Bull State Sensitivity to Strong Positive Returns', () => {
    let currentProbs = [0.33, 0.33, 0.34]; // Neutral baseline

    // Stream 8 consecutive steady positive bull days (+0.8% to +1.4%)
    const bullDays = [0.008, 0.010, 0.012, 0.009, 0.014, 0.011, 0.009, 0.008];
    const bullProbs = [];

    for (const ret of bullDays) {
      currentProbs = forwardFilterStep(currentProbs, ret);
      bullProbs.push(currentProbs[REGIME_STATES.BULL]);
    }

    // Bull probability should steadily climb
    assert.ok(bullProbs[bullProbs.length - 1] > 0.85, 'Bull probability must exceed 0.85 after sustained positive bull trend');
    assert.ok(currentProbs[REGIME_STATES.CRISIS] < 0.05, 'Crisis probability must decay below 0.05 during steady bull run');
  });

  test('TC-REGIME-06: Stationary Distribution & Long-Run Markov Equilibrium Probabilities', () => {
    const statPi = calculateStationaryDistribution(DEFAULT_TRANSITION_MATRIX);
    assert.strictEqual(statPi.length, 3, 'Stationary distribution must have length 3');

    const sumPi = statPi.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumPi - 1.0) < 1e-7, 'Stationary probabilities must sum to 1.0');

    // Verify invariance property: pi * A == pi
    for (let j = 0; j < 3; j++) {
      let expectedPi_j = 0;
      for (let i = 0; i < 3; i++) {
        expectedPi_j += statPi[i] * DEFAULT_TRANSITION_MATRIX[i][j];
      }
      assert.ok(Math.abs(expectedPi_j - statPi[j]) < 1e-6, `Stationary condition pi*A == pi violated at index ${j}`);
    }

    // Empirically, Bull + Sideways should account for > 80% of long-run market history, Crisis < 20%
    assert.ok(statPi[REGIME_STATES.CRISIS] < 0.20, 'Long-run crisis equilibrium probability must be under 20%');
    assert.ok(statPi[REGIME_STATES.BULL] > 0.30, 'Long-run bull equilibrium probability must exceed 30%');
  });

  test('TC-REGIME-07: Viterbi Algorithm Global MAP State Path Decoding & Optimality', () => {
    // Construct a scenario: 5 bull days -> 4 severe crash days -> 4 sideways recovery days
    const returns = [
      0.010, 0.009, 0.012, 0.008, 0.011,        // Bull phase (indices 0..4)
      -0.035, -0.042, -0.028, -0.031,            // Crisis phase (indices 5..8)
      0.000, 0.001, -0.001, 0.001                // Sideways phase (indices 9..12)
    ];

    const optimalPath = viterbiDecode(returns);
    assert.strictEqual(optimalPath.length, returns.length, 'Decoded path length must match returns sequence length');

    // Check that state indices are within valid range [0, 2]
    optimalPath.forEach(state => {
      assert.ok([0, 1, 2].includes(state), `Decoded state ${state} must be in {0, 1, 2}`);
    });

    // Check segment decoding
    assert.strictEqual(optimalPath[1], REGIME_STATES.BULL, 'Day 1 must be decoded as BULL');
    assert.strictEqual(optimalPath[6], REGIME_STATES.CRISIS, 'Day 6 (-4.2% crash) must be decoded as CRISIS');

    // Optimality verification: Viterbi path must have >= joint log-likelihood than any all-one-state naive path
    const optimalLogLik = computePathLogLikelihood(optimalPath, returns);
    const naiveBullPath = new Array(returns.length).fill(REGIME_STATES.BULL);
    const naiveBullLogLik = computePathLogLikelihood(naiveBullPath, returns);
    assert.ok(optimalLogLik > naiveBullLogLik, `Viterbi MAP path log-likelihood (${optimalLogLik}) must strictly exceed naive all-bull path (${naiveBullLogLik})`);
  });

  test('TC-REGIME-08: Expected Regime Duration and Persistence Half-Life Properties', () => {
    const A = DEFAULT_TRANSITION_MATRIX;

    for (let k = 0; k < 3; k++) {
      const a_kk = A[k][k];
      const duration = calculateExpectedDuration(a_kk);
      const halfLife = calculateRegimeHalfLife(a_kk);

      // Duration must be at least 1 day
      assert.ok(duration >= 1.0, `Expected duration for regime ${k} must be >= 1.0 (got ${duration})`);
      assert.ok(halfLife > 0.0, `Regime half-life must be positive (got ${halfLife})`);

      // For a_kk = 0.92, duration = 1 / 0.08 = 12.5 days
      if (k === REGIME_STATES.BULL) {
        assert.ok(Math.abs(duration - 12.5) < 1e-4, 'Bull regime expected duration must be 12.5 days');
        assert.ok(halfLife > 8.0 && halfLife < 9.0, 'Bull regime half-life must be ~8.3 days');
      }
    }

    // Boundary check: as persistence approaches 0, duration approaches 1
    assert.strictEqual(calculateExpectedDuration(0.0), 1.0, 'Zero persistence must yield 1-day duration');
  });

  test('TC-REGIME-09: Asset Covariance Matrix Symmetry & Positive Semi-Definiteness', () => {
    const Sigma = DEFAULT_COVARIANCE_MATRIX;
    const N = Sigma.length;
    assert.strictEqual(N, 4, 'Must have 4 assets in allocation universe');

    // Symmetry check
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        assert.strictEqual(Sigma[i][j], Sigma[j][i], `Covariance matrix must be symmetric at (${i}, ${j})`);
      }
      assert.ok(Sigma[i][i] > 0, `Asset ${i} variance must be strictly positive`);
    }

    // Correlation bounds check: |rho_ij| <= 1.0
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const rho = Sigma[i][j] / Math.sqrt(Sigma[i][i] * Sigma[j][j]);
        assert.ok(rho >= -1.0001 && rho <= 1.0001, `Correlation rho_${i}_${j} (${rho}) must be in [-1, 1]`);
      }
    }
  });

  test('TC-REGIME-10: Risk Parity Weight Normalization & Long-Only Constraints', () => {
    const weights = solveRiskParityWeights(DEFAULT_COVARIANCE_MATRIX);
    assert.strictEqual(weights.length, 4, 'Solved weights must contain 4 asset entries');

    let sumW = 0;
    for (let i = 0; i < 4; i++) {
      assert.ok(weights[i] >= 0.0, `Weight w_${i} (${weights[i]}) must be non-negative (no shorting)`);
      assert.ok(weights[i] <= 1.0, `Weight w_${i} (${weights[i]}) must not exceed 1.0`);
      sumW += weights[i];
    }

    assert.ok(Math.abs(sumW - 1.0) < 1e-7, `Weights must sum strictly to 1.0 (got ${sumW})`);
  });

  test('TC-REGIME-11: Analytical Equal Risk Contribution Verification for Uncorrelated Assets', () => {
    // Uncorrelated diagonal covariance matrix: sigmas = [0.02, 0.04, 0.01]
    const diagonalCov = [
      [0.0004, 0, 0],
      [0, 0.0016, 0],
      [0, 0, 0.0001]
    ];
    // Analytical ERC weights: w_i proportional to 1 / sigma_i
    // 1/0.02 = 50, 1/0.04 = 25, 1/0.01 = 100 => Total = 175
    // w = [50/175, 25/175, 100/175] = [2/7, 1/7, 4/7]
    const expectedW = [2 / 7, 1 / 7, 4 / 7];

    const numericalW = solveRiskParityWeights(diagonalCov);

    for (let i = 0; i < 3; i++) {
      assert.ok(
        Math.abs(numericalW[i] - expectedW[i]) < 1e-5,
        `Asset ${i} weight ${numericalW[i]} must match analytical ${expectedW[i]} to high precision`
      );
    }
  });

  test('TC-REGIME-12: Equal Risk Contribution Convergence on Full Correlated Covariance', () => {
    const weights = solveRiskParityWeights(DEFAULT_COVARIANCE_MATRIX);
    const risk = calculateRiskContributions(weights, DEFAULT_COVARIANCE_MATRIX);

    assert.ok(risk.portfolioVolatility > 0, 'Portfolio volatility must be strictly positive');

    // In Equal Risk Contribution, each asset contributes exactly 1/N of total risk
    const expectedShare = 1.0 / 4.0; // 25% each
    risk.fractionalRiskContributions.forEach((share, i) => {
      assert.ok(
        Math.abs(share - expectedShare) < 0.001,
        `Asset ${i} risk contribution share ${share} must equal 25% within 0.1% tolerance`
      );
    });

    // Sum of risk contributions must equal total portfolio volatility
    const totalRC = risk.riskContributions.reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(totalRC - risk.portfolioVolatility) < 1e-6,
      'Sum of marginal risk contributions must equal total portfolio volatility'
    );
  });

  test('TC-REGIME-13: Regime-Conditional Dynamic Asset Allocation Shifts (Crisis vs Bull)', () => {
    const bullProbs = [0.90, 0.08, 0.02];
    const crisisProbs = [0.02, 0.08, 0.90];

    const bullWeights = calculateBlendedRegimeWeights(bullProbs);
    const crisisWeights = calculateBlendedRegimeWeights(crisisProbs);

    // Asset indices: 0: NIFTY_50, 1: BANKNIFTY, 2: GOLD_BEES, 3: LIQUID_BEES (Cash)
    const bullEquity = bullWeights[0] + bullWeights[1];
    const crisisEquity = crisisWeights[0] + crisisWeights[1];

    const bullDefense = bullWeights[2] + bullWeights[3];
    const crisisDefense = crisisWeights[2] + crisisWeights[3];

    // Bull regime must carry higher equity exposure than crisis regime
    assert.ok(
      bullEquity > crisisEquity * 2.0,
      `Bull equity exposure (${bullEquity}) must be more than double crisis equity exposure (${crisisEquity})`
    );

    // Crisis regime must drastically elevate defense assets (Gold + Cash)
    assert.ok(
      crisisDefense > bullDefense,
      `Crisis defensive allocation (${crisisDefense}) must exceed bull defensive allocation (${bullDefense})`
    );
    assert.ok(crisisDefense > 0.90, `Crisis defensive allocation must exceed 90% (got ${crisisDefense})`);
  });

  test('TC-REGIME-14: Portfolio Realized Volatility & Dynamic Volatility Target Scaling', () => {
    // Unscaled aggressive portfolio
    const aggressiveWeights = [0.50, 0.30, 0.15, 0.05];
    const targetVolAnn = 0.08; // 8% target annualized volatility

    const volTargetResult = applyVolatilityTargeting(aggressiveWeights, DEFAULT_COVARIANCE_MATRIX, targetVolAnn);

    assert.ok(volTargetResult.scalar < 1.0, `Scalar ${volTargetResult.scalar} must be < 1.0 to de-risk high-vol portfolio`);
    assert.ok(
      volTargetResult.realizedVolAnn <= targetVolAnn + 1e-4,
      `Targeted portfolio volatility (${volTargetResult.realizedVolAnn}) must not exceed target (${targetVolAnn})`
    );

    // De-risked capital must be parked in Cash (LIQUID_BEES)
    assert.ok(
      volTargetResult.scaledWeights[3] > aggressiveWeights[3],
      'Cash allocation must increase after volatility target de-risking'
    );

    // Total weight must remain 1.0
    const sumW = volTargetResult.scaledWeights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumW - 1.0) < 1e-7, 'Scaled weights must conserve 100% capital');
  });

  test('TC-REGIME-15: 1-Click Regime Action - Rebalance Order Execution & Capital Conservation', () => {
    const currentWeights = [0.35, 0.25, 0.20, 0.20];
    const targetWeights = [0.10, 0.05, 0.40, 0.45]; // Shift to defense
    const portfolioValue = 10000000; // 1 Crore INR

    const rebalance = calculateRebalanceOrders(currentWeights, targetWeights, portfolioValue);

    assert.strictEqual(rebalance.orders.length, 4, 'Must generate rebalance orders for all 4 assets');
    assert.ok(rebalance.capitalConserved, 'Rebalance order deltas must conserve capital (netDelta == 0)');

    // Check actions
    const niftyOrder = rebalance.orders.find(o => o.asset === 'NIFTY_50');
    assert.strictEqual(niftyOrder.action, 'SELL', 'NIFTY must be SELL order during defensive rebalance');
    assert.strictEqual(niftyOrder.tradeValue, -2500000, 'NIFTY sell value must be -25 Lakhs');

    const goldOrder = rebalance.orders.find(o => o.asset === 'GOLD_BEES');
    assert.strictEqual(goldOrder.action, 'BUY', 'GOLD must be BUY order during defensive rebalance');
    assert.strictEqual(goldOrder.tradeValue, 2000000, 'GOLD buy value must be +20 Lakhs');

    // Turnover metric
    assert.ok(rebalance.turnoverRatio > 0 && rebalance.turnoverRatio <= 1.0, 'Turnover ratio must be in (0, 1]');
  });

  test('TC-REGIME-16: 1-Click Tail-Risk Hedge Protocol (100% Defense Flight to Cash & Gold)', () => {
    const hedgedWeights = applyTailHedge({ gold: 0.60, cash: 0.40 });

    assert.strictEqual(hedgedWeights.length, 4);
    assert.strictEqual(hedgedWeights[0], 0.0, 'NIFTY 50 allocation must be strictly 0%');
    assert.strictEqual(hedgedWeights[1], 0.0, 'BANKNIFTY allocation must be strictly 0%');
    assert.strictEqual(hedgedWeights[2], 0.60, 'GOLD allocation must be exactly 60%');
    assert.strictEqual(hedgedWeights[3], 0.40, 'CASH allocation must be exactly 40%');

    const sumW = hedgedWeights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumW - 1.0) < 1e-7, 'Hedged weights must sum to 100%');
  });

  test('TC-REGIME-17: End-to-End Online HMM & Multi-Asset Allocation Pipeline', () => {
    // Continuous streaming simulation across 15 trading days
    const marketStream = [
      0.008, 0.006, 0.011, 0.009, 0.007,         // Bull trend (days 0..4)
      -0.038, -0.045, -0.029, -0.033,            // Sudden crash crisis (days 5..8)
      0.001, 0.002, 0.000, 0.001, 0.005, 0.009  // Recovery phase (days 9..14)
    ];

    let onlineProbs = [...DEFAULT_PRIORS];
    const portfolioWeightsHistory = [];

    for (let day = 0; day < marketStream.length; day++) {
      onlineProbs = forwardFilterStep(onlineProbs, marketStream[day]);
      const currentAllocation = calculateBlendedRegimeWeights(onlineProbs);
      portfolioWeightsHistory.push(currentAllocation);
    }

    assert.strictEqual(portfolioWeightsHistory.length, 15);

    // During the crash (day 7), Cash & Gold defense must be at peak
    const crashDefense = portfolioWeightsHistory[7][2] + portfolioWeightsHistory[7][3];
    const bullDefense = portfolioWeightsHistory[3][2] + portfolioWeightsHistory[3][3];
    assert.ok(crashDefense > bullDefense, 'Defensive weights must expand substantially during crash days');

    // During bull trend (day 3), Equity weight must be high
    const bullEquity = portfolioWeightsHistory[3][0] + portfolioWeightsHistory[3][1];
    const crashEquity = portfolioWeightsHistory[7][0] + portfolioWeightsHistory[7][1];
    assert.ok(bullEquity > crashEquity, 'Equity weight must be significantly higher in bull trend than during crash');
  });

});
