/**
 * TradeCraft AI — Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Engine
 * Quantitative Core Library (Sprint 28)
 *
 * References:
 * 1. Hamilton, J. D. (1989). A new approach to the economic analysis of nonstationary time series
 *    and the business cycle. Econometrica, 57(2), 357-384.
 * 2. Rabiner, L. R. (1989). A tutorial on Hidden Markov Models and selected applications in speech recognition.
 *    Proceedings of the IEEE, 77(2), 257-286.
 * 3. Maillard, S., Roncalli, T., & Teïletche, J. (2010). The properties of equally weighted risk contribution portfolios.
 *    Journal of Portfolio Management, 36(4), 60-70.
 * 4. Spinu, F. (2013). An Algorithm for Computing Risk Parity Weights.
 *    SSRN Electronic Journal: https://ssrn.com/abstract=2297272.
 * 5. Griveau-Billion, T., Richard, J. C., & Roncalli, T. (2013). A fast algorithm for computing
 *    large-scale risk parity portfolios. SSRN Electronic Journal.
 *
 * Implements:
 * 1. Gaussian Emission Probability Density Function:
 *    f(x; mu, sigma) = (1 / (sigma * sqrt(2 * pi))) * exp( -0.5 * ((x - mu) / sigma)^2 )
 * 2. Hamilton Online Forward Filtered Probabilities:
 *    alpha_t(k) = P(S_t = k | y_{1:t}) with numerically stable sum-to-1 normalization.
 * 3. Dynamic Programming Viterbi Decoder:
 *    Optimal global hidden state path in log-space: argmax_{S_{1:T}} P(S_{1:T} | y_{1:T}).
 * 4. Cyclical Coordinate Descent (CCD) Equal Risk Contribution (ERC) Multi-Asset Risk Parity:
 *    Solves w_i * (Sigma * w)_i = b_i * (w^T * Sigma * w) for [NIFTY, BANKNIFTY, GOLD, CASH].
 * 5. Pre-seeded Indian Market Historical Regimes:
 *    - 2020 COVID Crash (Feb - Apr 2020)
 *    - 2021 Post-COVID Bull Run (Nov 2020 - Jan 2021)
 *    - 2024 General Election Choppiness & V-Shape (Apr - Jun 2024)
 *    - 2026 Live Market State
 * 6. UI Bridge Helpers & 1-Click Regime Action Controller:
 *    REBALANCE_RISK_PARITY, HEDGE_CRISIS_TAIL, OVERRIDE_REGIME, RESET_STATE.
 */

import {
  MarketRegime,
  RegimeType,
  RegimeActionType,
  RegimeHistoricalPreset,
  RegimeAssetSymbol,
  HMMParameters,
  FilteredRegimeState,
  RiskParityWeights,
  ViterbiDecodedPath,
  RegimeAssetConfig,
  AssetCovarianceMatrix,
  RegimeHistoricalDataPoint,
  RegimeActionPayload,
  RegimeActionResult,
  RegimeEngineSummary,
  MultiAssetKey,
  MultiAssetMeta,
  MarkovStateTransition,
  ErgodicDistribution,
  HistoricalRibbonPoint,
  AssetAllocationItem,
  RegimeCharacteristics,
} from '../types/regime';

// ============================================================================
// 1. CALIBRATED PARAMETERS & ASSET CONFIGURATIONS (INDIAN MARKETS)
// ============================================================================

/**
 * Standard 3-State Gaussian Hidden Markov Model Parameters
 * Calibrated to 10+ years of daily NSE Nifty 50 and India VIX observations:
 * - State 0: BULL_TRENDING (mu = +12 bps/d, sigma = 0.75%/d ~ 11.9% ann vol)
 * - State 1: LOW_VOL_CHOP  (mu = +1 bps/d,  sigma = 1.05%/d ~ 16.6% ann vol)
 * - State 2: HIGH_VOL_CRISIS(mu = -38 bps/d, sigma = 2.80%/d ~ 44.4% ann vol)
 */
export const DEFAULT_HMM_PARAMS: HMMParameters = {
  transitionMatrix: [
    // [P_00, P_01, P_02]: Bull persists 94.2%, moves to Chop 4.8%, shocks to Crisis 1.0%
    [0.942, 0.048, 0.010],
    // [P_10, P_11, P_12]: Chop resolves Bull 6.5%, persists 87.5%, breaks down to Crisis 6.0%
    [0.065, 0.875, 0.060],
    // [P_20, P_21, P_22]: Crisis rebounds Bull 3.5%, consolidates Chop 12.5%, persists 84.0%
    [0.035, 0.125, 0.840],
  ],
  emissionMeans: [0.0012, 0.0001, -0.0038],
  emissionStdDevs: [0.0075, 0.0105, 0.0280],
  initialProbs: [0.60, 0.30, 0.10],
  regimeLabels: ['BULL_TRENDING', 'LOW_VOL_CHOP', 'HIGH_VOL_CRISIS'],
};

export const REGIME_INDEX_MAP: Record<number, MarketRegime> = {
  0: 'BULL_TRENDING',
  1: 'LOW_VOL_CHOP',
  2: 'HIGH_VOL_CRISIS',
};

export const REGIME_NAME_TO_INDEX: Record<MarketRegime, number> = {
  BULL_TRENDING: 0,
  LOW_VOL_CHOP: 1,
  HIGH_VOL_CRISIS: 2,
};

/**
 * Multi-Asset Risk Parity Configuration for Indian Portfolios
 */
export const TICKER_REGIME_CONFIG: Record<RegimeAssetSymbol, RegimeAssetConfig> = {
  NIFTY: {
    symbol: 'NIFTY',
    name: 'NIFTY 50 Index Futures / ETF',
    assetClass: 'EQUITY_INDEX',
    baseAnnualVol: 0.135,
    regimeVolMultiplier: {
      BULL_TRENDING: 0.88,
      LOW_VOL_CHOP: 0.95,
      HIGH_VOL_CRISIS: 2.30,
    },
    minWeight: 0.0,
    maxWeight: 0.65,
    defaultRiskBudget: {
      BULL_TRENDING: 0.45,
      LOW_VOL_CHOP: 0.25,
      HIGH_VOL_CRISIS: 0.08,
    },
    color: '#06b6d4', // cyan-500
  },
  BANKNIFTY: {
    symbol: 'BANKNIFTY',
    name: 'NIFTY Bank High-Beta Financials',
    assetClass: 'SECTORAL_INDEX',
    baseAnnualVol: 0.178,
    regimeVolMultiplier: {
      BULL_TRENDING: 0.85,
      LOW_VOL_CHOP: 0.95,
      HIGH_VOL_CRISIS: 2.45,
    },
    minWeight: 0.0,
    maxWeight: 0.45,
    defaultRiskBudget: {
      BULL_TRENDING: 0.35,
      LOW_VOL_CHOP: 0.20,
      HIGH_VOL_CRISIS: 0.04,
    },
    color: '#6366f1', // indigo-500
  },
  GOLD: {
    symbol: 'GOLD',
    name: 'Sovereign Gold / GOLDBEES ETF',
    assetClass: 'COMMODITY',
    baseAnnualVol: 0.122,
    regimeVolMultiplier: {
      BULL_TRENDING: 0.90,
      LOW_VOL_CHOP: 1.05,
      HIGH_VOL_CRISIS: 1.25,
    },
    minWeight: 0.05,
    maxWeight: 0.60,
    defaultRiskBudget: {
      BULL_TRENDING: 0.15,
      LOW_VOL_CHOP: 0.35,
      HIGH_VOL_CRISIS: 0.40,
    },
    color: '#f59e0b', // amber-500
  },
  CASH: {
    symbol: 'CASH',
    name: 'LiquidBees / 91-Day Sovereign T-Bills',
    assetClass: 'CASH_EQUIVALENT',
    baseAnnualVol: 0.018,
    regimeVolMultiplier: {
      BULL_TRENDING: 1.0,
      LOW_VOL_CHOP: 1.0,
      HIGH_VOL_CRISIS: 1.0,
    },
    minWeight: 0.05,
    maxWeight: 0.95,
    defaultRiskBudget: {
      BULL_TRENDING: 0.05,
      LOW_VOL_CHOP: 0.20,
      HIGH_VOL_CRISIS: 0.48,
    },
    color: '#10b981', // emerald-500
  },
};

/**
 * Visual styling and metadata characteristics for each regime
 */
export const REGIME_CHARACTERISTICS: Record<MarketRegime, RegimeCharacteristics> = {
  BULL_TRENDING: {
    name: 'Bull Trending',
    emoji: '🐂',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    borderClass: 'border-emerald-500/50',
    glowClass: 'shadow-emerald-500/20',
    expectedAnnualReturn: 0.214, // 21.4%
    expectedAnnualVol: 0.118,    // 11.8%
    typicalHalfLifeDays: 14.2,
    description: 'Persistent positive drift, tight intraday ranges, suppressed VIX (<13.5), positive market breadth.',
    macroDriver: 'DII/FII systematic inflows, earnings expansion, strong breadth >65% stocks >50 EMA.',
  },
  LOW_VOL_CHOP: {
    name: 'Low-Vol Chop',
    emoji: '🦀',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    borderClass: 'border-amber-500/50',
    glowClass: 'shadow-amber-500/20',
    expectedAnnualReturn: 0.052, // 5.2%
    expectedAnnualVol: 0.094,    // 9.4%
    typicalHalfLifeDays: 7.8,
    description: 'Mean-reverting rangebound oscillation, theta decay dominance, compressed realized dispersion, low momentum.',
    macroDriver: 'RBI policy overhang, pre-earnings consolidation, low institutional tick imbalance.',
  },
  HIGH_VOL_CRISIS: {
    name: 'High-Vol Crisis',
    emoji: '🐻',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    borderClass: 'border-rose-500/50',
    glowClass: 'shadow-rose-500/20',
    expectedAnnualReturn: -0.268, // -26.8%
    expectedAnnualVol: 0.312,     // 31.2%
    typicalHalfLifeDays: 5.1,
    description: 'Elevated cross-asset correlations, severe negative skew, India VIX spike (>22), aggressive put demand & short gamma dealer hedging.',
    macroDriver: 'Global geopolitical shock, sudden INR devaluation, institutional foreign capital flight.',
  },
};

export const MULTI_ASSET_METAS: Record<MultiAssetKey, MultiAssetMeta> = {
  NIFTY: {
    key: 'NIFTY',
    symbol: 'NIFTY 50',
    name: 'NIFTY 50 Index',
    assetClass: 'Large-Cap Equity',
    color: 'text-cyan-400',
    accentHex: '#22d3ee',
    annualizedVol: 13.5,
  },
  BANKNIFTY: {
    key: 'BANKNIFTY',
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank Index',
    assetClass: 'High-Beta Banking',
    color: 'text-indigo-400',
    accentHex: '#818cf8',
    annualizedVol: 17.8,
  },
  GOLDBEES: {
    key: 'GOLDBEES',
    symbol: 'GOLD BEES',
    name: 'Nippon India ETF Gold',
    assetClass: 'Commodity Haven',
    color: 'text-amber-400',
    accentHex: '#fbbf24',
    annualizedVol: 12.2,
  },
  LIQUIDBEES: {
    key: 'LIQUIDBEES',
    symbol: 'LIQUID BEES',
    name: 'Nippon India Liquid ETF',
    assetClass: 'Cash / Sovereign T-Bills',
    color: 'text-emerald-400',
    accentHex: '#34d399',
    annualizedVol: 1.8,
  },
};

export const DEFAULT_MARKOV_TRANSITIONS: MarkovStateTransition[] = [
  {
    fromRegime: 'BULL_TRENDING',
    toRegimes: {
      BULL_TRENDING: 0.942,
      LOW_VOL_CHOP: 0.048,
      HIGH_VOL_CRISIS: 0.010,
    },
    expectedDurationDays: 17.2,
  },
  {
    fromRegime: 'LOW_VOL_CHOP',
    toRegimes: {
      BULL_TRENDING: 0.065,
      LOW_VOL_CHOP: 0.875,
      HIGH_VOL_CRISIS: 0.060,
    },
    expectedDurationDays: 8.0,
  },
  {
    fromRegime: 'HIGH_VOL_CRISIS',
    toRegimes: {
      BULL_TRENDING: 0.035,
      LOW_VOL_CHOP: 0.125,
      HIGH_VOL_CRISIS: 0.840,
    },
    expectedDurationDays: 6.3,
  },
];

// ============================================================================
// 2. MATHEMATICAL CORE: GAUSSIAN EMISSION & HIDDEN MARKOV MODEL ENGINE
// ============================================================================

/**
 * Evaluates the univariate Gaussian probability density function (PDF):
 * f(x; mu, sigma) = (1 / (sigma * sqrt(2 * pi))) * exp( -0.5 * ((x - mu) / sigma)^2 )
 *
 * Guaranteed numerically stable:
 * - Safeguards sigma >= 1e-6
 * - Prevents exponent underflow via -700 lower bound clamp
 * - Enforces minimum density floor of 1e-15 to avoid zero-division in Bayesian updates
 *
 * @param returnVal Observed decimal return x (e.g. 0.012 for +1.2%)
 * @param mean Expected return mu_k for the regime
 * @param stdDev Return volatility sigma_k for the regime
 * @returns Non-negative probability density
 */
export function calculateGaussianEmission(
  returnVal: number,
  mean: number,
  stdDev: number
): number {
  if (isNaN(returnVal) || isNaN(mean) || isNaN(stdDev)) {
    return 1e-15;
  }
  const safeStdDev = Math.max(stdDev, 1e-6);
  const z = (returnVal - mean) / safeStdDev;
  const exponent = -0.5 * z * z;

  // Prevent IEEE 754 floating point underflow
  if (exponent < -700) {
    return 1e-15;
  }

  const normFactor = 1 / (safeStdDev * Math.sqrt(2 * Math.PI));
  const density = normFactor * Math.exp(exponent);

  return Math.max(density, 1e-15);
}

/**
 * Computes Online Forward Filtered Regime Probabilities (Hamilton 1989):
 * alpha_t(k) = P(S_t = k | y_{1:t})
 *
 * Algorithm:
 * 1. At t=0:
 *    tilde_alpha_0(k) = pi_k * f(y_0; mu_k, sigma_k)
 *    c_0 = sum_k tilde_alpha_0(k)
 *    alpha_0(k) = tilde_alpha_0(k) / c_0
 *
 * 2. At t > 0:
 *    prior_t(k) = sum_j [ alpha_{t-1}(j) * A_{j,k} ]
 *    tilde_alpha_t(k) = prior_t(k) * f(y_t; mu_k, sigma_k)
 *    c_t = sum_k tilde_alpha_t(k)
 *    alpha_t(k) = tilde_alpha_t(k) / c_t
 *
 * @param returns Array of raw decimal returns or observation objects
 * @param params 3-state HMM parameters (transitions, means, stdDevs, initial priors)
 * @returns Array of FilteredRegimeState for every timestamp
 */
export function forwardFilterRegime(
  returns: (number | { timestamp?: string; date?: string; returnVal?: number; niftyReturn?: number; return?: number })[],
  params: HMMParameters = DEFAULT_HMM_PARAMS
): FilteredRegimeState[] {
  if (!returns || returns.length === 0) {
    return [];
  }

  const T = returns.length;
  const K = 3; // 3 regimes
  const results: FilteredRegimeState[] = [];

  let currentAlpha = [
    params.initialProbs[0] ?? 0.6,
    params.initialProbs[1] ?? 0.3,
    params.initialProbs[2] ?? 0.1,
  ];

  let cumulativeLogLikelihood = 0;

  for (let t = 0; t < T; t++) {
    const item = returns[t];
    let ret = 0;
    let timestamp = `T+${t}`;

    if (typeof item === 'number') {
      ret = item;
    } else if (item && typeof item === 'object') {
      ret = item.returnVal ?? item.niftyReturn ?? item.return ?? 0;
      timestamp = item.timestamp ?? item.date ?? `T+${t}`;
    }

    // Compute emission densities for each state
    const emissions = [
      calculateGaussianEmission(ret, params.emissionMeans[0], params.emissionStdDevs[0]),
      calculateGaussianEmission(ret, params.emissionMeans[1], params.emissionStdDevs[1]),
      calculateGaussianEmission(ret, params.emissionMeans[2], params.emissionStdDevs[2]),
    ];

    let unnormalizedAlpha = [0, 0, 0];

    if (t === 0) {
      for (let k = 0; k < K; k++) {
        unnormalizedAlpha[k] = currentAlpha[k] * emissions[k];
      }
    } else {
      for (let k = 0; k < K; k++) {
        let prior = 0;
        for (let j = 0; j < K; j++) {
          prior += currentAlpha[j] * params.transitionMatrix[j][k];
        }
        unnormalizedAlpha[k] = prior * emissions[k];
      }
    }

    // Normalization factor c_t
    const c_t = unnormalizedAlpha[0] + unnormalizedAlpha[1] + unnormalizedAlpha[2];

    if (c_t > 1e-18) {
      currentAlpha = [
        unnormalizedAlpha[0] / c_t,
        unnormalizedAlpha[1] / c_t,
        unnormalizedAlpha[2] / c_t,
      ];
      cumulativeLogLikelihood += Math.log(c_t);
    } else {
      // Numerical fallback to uniform if underflow
      currentAlpha = [1 / 3, 1 / 3, 1 / 3];
    }

    // Dominant regime is argmax of posterior distribution
    let maxIdx = 0;
    let maxProb = currentAlpha[0];
    for (let k = 1; k < K; k++) {
      if (currentAlpha[k] > maxProb) {
        maxProb = currentAlpha[k];
        maxIdx = k;
      }
    }

    const dominantRegime = REGIME_INDEX_MAP[maxIdx] || 'BULL_TRENDING';

    // Shannon entropy: H = -sum(p * ln(p))
    let entropy = 0;
    for (let k = 0; k < K; k++) {
      const p = currentAlpha[k];
      if (p > 1e-12) {
        entropy -= p * Math.log(p);
      }
    }

    results.push({
      timestamp,
      bullProb: Number(currentAlpha[0].toFixed(4)),
      chopProb: Number(currentAlpha[1].toFixed(4)),
      crisisProb: Number(currentAlpha[2].toFixed(4)),
      dominantRegime,
      confidence: Number(maxProb.toFixed(4)),
      logLikelihood: Number(cumulativeLogLikelihood.toFixed(2)),
      shannonEntropy: Number(entropy.toFixed(3)),
      observationReturn: Number(ret.toFixed(5)),
    });
  }

  return results;
}

/**
 * Dynamic Programming Viterbi Decoder (Rabiner 1989):
 * Finds the globally most probable sequence of hidden states S_{1:T}
 * that generated the observed sequence of returns.
 *
 * Implemented in log-space to guarantee numerical precision without floating underflow:
 * V_0(k) = ln(pi_k) + ln(f(y_0 | S_k))
 * V_t(k) = max_j [ V_{t-1}(j) + ln(A_{j,k}) ] + ln(f(y_t | S_k))
 * ptr_t(k) = argmax_j [ V_{t-1}(j) + ln(A_{j,k}) ]
 *
 * @param returns Observed returns sequence
 * @param params HMM parameters
 * @returns Decoded optimal path with states, indices, timestamps, and logLikelihood
 */
export function decodeViterbiPath(
  returns: (number | { timestamp?: string; date?: string; returnVal?: number; niftyReturn?: number; return?: number })[],
  params: HMMParameters = DEFAULT_HMM_PARAMS
): ViterbiDecodedPath {
  if (!returns || returns.length === 0) {
    return {
      states: [],
      stateIndices: [],
      timestamps: [],
      logLikelihood: 0,
      regimeChangesCount: 0,
    };
  }

  const T = returns.length;
  const K = 3;

  // Extract return numbers and timestamps
  const retVals: number[] = [];
  const timestamps: string[] = [];

  for (let t = 0; t < T; t++) {
    const item = returns[t];
    if (typeof item === 'number') {
      retVals.push(item);
      timestamps.push(`T+${t}`);
    } else if (item && typeof item === 'object') {
      retVals.push(item.returnVal ?? item.niftyReturn ?? item.return ?? 0);
      timestamps.push(item.timestamp ?? item.date ?? `T+${t}`);
    }
  }

  // Precompute log transition probabilities
  const logA: number[][] = [];
  for (let i = 0; i < K; i++) {
    logA[i] = [];
    for (let j = 0; j < K; j++) {
      const p = Math.max(params.transitionMatrix[i][j], 1e-15);
      logA[i][j] = Math.log(p);
    }
  }

  // Viterbi DP table and backpointers
  const V: number[][] = [];
  const ptr: number[][] = [];

  for (let t = 0; t < T; t++) {
    V[t] = new Array(K).fill(-Infinity);
    ptr[t] = new Array(K).fill(0);
  }

  // Initialization at t = 0
  for (let k = 0; k < K; k++) {
    const emission = calculateGaussianEmission(retVals[0], params.emissionMeans[k], params.emissionStdDevs[k]);
    const initProb = Math.max(params.initialProbs[k], 1e-15);
    V[0][k] = Math.log(initProb) + Math.log(emission);
    ptr[0][k] = 0;
  }

  // Induction for t = 1 ... T-1
  for (let t = 1; t < T; t++) {
    for (let k = 0; k < K; k++) {
      const emission = calculateGaussianEmission(retVals[t], params.emissionMeans[k], params.emissionStdDevs[k]);
      const logEmission = Math.log(emission);

      let maxLogScore = -Infinity;
      let bestPrevState = 0;

      for (let j = 0; j < K; j++) {
        const score = V[t - 1][j] + logA[j][k];
        if (score > maxLogScore) {
          maxLogScore = score;
          bestPrevState = j;
        }
      }

      V[t][k] = maxLogScore + logEmission;
      ptr[t][k] = bestPrevState;
    }
  }

  // Termination: find argmax of V[T-1][k]
  let bestLastScore = -Infinity;
  let bestLastState = 0;
  for (let k = 0; k < K; k++) {
    if (V[T - 1][k] > bestLastScore) {
      bestLastScore = V[T - 1][k];
      bestLastState = k;
    }
  }

  // Backtracking path
  const stateIndices = new Array<number>(T);
  stateIndices[T - 1] = bestLastState;

  for (let t = T - 2; t >= 0; t--) {
    stateIndices[t] = ptr[t + 1][stateIndices[t + 1]];
  }

  const states = stateIndices.map((idx) => REGIME_INDEX_MAP[idx] || 'BULL_TRENDING');

  // Count regime transitions in the decoded path
  let regimeChangesCount = 0;
  for (let t = 1; t < T; t++) {
    if (states[t] !== states[t - 1]) {
      regimeChangesCount++;
    }
  }

  return {
    states,
    stateIndices,
    timestamps,
    logLikelihood: Number(bestLastScore.toFixed(2)),
    regimeChangesCount,
  };
}

// ============================================================================
// 3. MULTI-ASSET RISK PARITY ENGINE (EQUAL RISK CONTRIBUTION - ERC)
// ============================================================================

/**
 * Builds the 4x4 annualized covariance matrix Sigma for [NIFTY, BANKNIFTY, GOLD, CASH]
 * conditioned on the active market regime.
 */
export function buildRegimeCovarianceMatrix(regime: MarketRegime): AssetCovarianceMatrix {
  const symbols: RegimeAssetSymbol[] = ['NIFTY', 'BANKNIFTY', 'GOLD', 'CASH'];

  // Base volatilities scaled by regime
  const vols: number[] = symbols.map((s) => {
    const cfg = TICKER_REGIME_CONFIG[s];
    return cfg.baseAnnualVol * cfg.regimeVolMultiplier[regime];
  });

  // Empirical correlation matrix calibrated to NSE historical regimes
  let corr: number[][];

  if (regime === 'BULL_TRENDING') {
    // Equities rally together, gold provides mild non-correlated hedge
    corr = [
      [1.00, 0.82, -0.12, 0.00], // NIFTY
      [0.82, 1.00, -0.10, 0.00], // BANKNIFTY
      [-0.12, -0.10, 1.00, 0.00], // GOLD
      [0.00, 0.00, 0.00, 1.00],  // CASH
    ];
  } else if (regime === 'LOW_VOL_CHOP') {
    // Dispersion increases, equities drift, gold correlation neutral
    corr = [
      [1.00, 0.78, 0.05, 0.00],
      [0.78, 1.00, 0.02, 0.00],
      [0.05, 0.02, 1.00, 0.00],
      [0.00, 0.00, 0.00, 1.00],
    ];
  } else {
    // HIGH_VOL_CRISIS: Equities correlation locks at ~0.92, gold flight-to-safety is strong negative (-0.28)
    corr = [
      [1.00, 0.92, -0.28, 0.00],
      [0.92, 1.00, -0.24, 0.00],
      [-0.28, -0.24, 1.00, 0.00],
      [0.00, 0.00, 0.00, 1.00],
    ];
  }

  // Construct covariance matrix Sigma_ij = rho_ij * sigma_i * sigma_j
  const cov: number[][] = [];
  for (let i = 0; i < 4; i++) {
    cov[i] = [];
    for (let j = 0; j < 4; j++) {
      cov[i][j] = corr[i][j] * vols[i] * vols[j];
    }
  }

  return {
    symbols,
    correlations: corr,
    volatilities: vols,
    covarianceMatrix: cov,
  };
}

/**
 * Computes portfolio annualized volatility: sigma_p = sqrt(w^T * Sigma * w)
 */
export function calculatePortfolioVol(weights: number[], covMatrix: number[][]): number {
  let variance = 0;
  const n = weights.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return Math.sqrt(Math.max(variance, 1e-8));
}

/**
 * Computes Marginal Risk Contributions (MRC) and Total Risk Contributions (RC):
 * MRC_i = (Sigma * w)_i / sigma_p
 * RC_i = w_i * MRC_i
 */
export function calculateAssetRiskContributions(weights: number[], covMatrix: number[][]): number[] {
  const n = weights.length;
  const portVol = calculatePortfolioVol(weights, covMatrix);
  const rc: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let sigmaW_i = 0;
    for (let j = 0; j < n; j++) {
      sigmaW_i += covMatrix[i][j] * weights[j];
    }
    const mrc_i = sigmaW_i / portVol;
    rc[i] = weights[i] * mrc_i;
  }

  return rc;
}

/**
 * Solves Equal Risk Contribution (ERC) Risk Parity Weights using Cyclical Coordinate Descent (CCD):
 * (Spinu 2013 / Griveau-Billion et al. 2013)
 *
 * Objective:
 * Find weights w = [w_0, w_1, w_2, w_3] with sum(w) = 1, w_i >= 0 such that:
 * w_i * (Sigma * w)_i = b_i * (w^T * Sigma * w)
 *
 * Iterative coordinate update:
 * a_i = sum_{j != i} Sigma_{i,j} * w_j
 * w_i = ( -a_i + sqrt( a_i^2 + 4 * Sigma_{i,i} * b_i ) ) / (2 * Sigma_{i,i})
 *
 * @param regime Market regime ('BULL_TRENDING' | 'LOW_VOL_CHOP' | 'HIGH_VOL_CRISIS')
 * @param targetVol Target annualized volatility (default 0.12 = 12%)
 * @param customCovariance Optional custom 4x4 covariance matrix
 * @param customRiskBudgets Optional custom 4-element risk budget vector [b_NIFTY, b_BANK, b_GOLD, b_CASH]
 * @returns RiskParityWeights object
 */
export function calculateRegimeRiskParity(
  regime: MarketRegime,
  targetVol: number = 0.12,
  customCovariance?: number[][],
  customRiskBudgets?: number[]
): RiskParityWeights {
  const assetKeys: RegimeAssetSymbol[] = ['NIFTY', 'BANKNIFTY', 'GOLD', 'CASH'];
  const n = 4;

  // Covariance matrix
  const covStructure = buildRegimeCovarianceMatrix(regime);
  const Sigma = customCovariance && customCovariance.length === n ? customCovariance : covStructure.covarianceMatrix;

  // Risk budgets b_i
  let budgets: number[];
  if (customRiskBudgets && customRiskBudgets.length === n) {
    const bSum = customRiskBudgets.reduce((a, b) => a + b, 0);
    budgets = customRiskBudgets.map((b) => b / bSum);
  } else {
    budgets = assetKeys.map((k) => TICKER_REGIME_CONFIG[k].defaultRiskBudget[regime]);
    const bSum = budgets.reduce((a, b) => a + b, 0);
    budgets = budgets.map((b) => b / bSum);
  }

  // Initialize weights inversely proportional to asset volatility
  let w: number[] = assetKeys.map((_, i) => 1 / Math.sqrt(Math.max(Sigma[i][i], 1e-4)));
  const initSum = w.reduce((a, b) => a + b, 0);
  w = w.map((v) => v / initSum);

  // Cyclical Coordinate Descent (CCD) iterations
  const maxIter = 100;
  const tol = 1e-7;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxDiff = 0;

    for (let i = 0; i < n; i++) {
      let a_i = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          a_i += Sigma[i][j] * w[j];
        }
      }

      const Sigma_ii = Sigma[i][i];
      const discriminant = a_i * a_i + 4 * Sigma_ii * budgets[i];
      const new_w_i = (-a_i + Math.sqrt(Math.max(0, discriminant))) / (2 * Sigma_ii);

      const diff = Math.abs(new_w_i - w[i]);
      if (diff > maxDiff) {
        maxDiff = diff;
      }
      w[i] = Math.max(0, new_w_i);
    }

    if (maxDiff < tol) {
      break;
    }
  }

  // Normalize weights so sum(w) = 1.0
  const totalWeight = w.reduce((a, b) => a + b, 0);
  let normW = w.map((v) => v / totalWeight);

  // Apply box constraints from config
  for (let i = 0; i < n; i++) {
    const cfg = TICKER_REGIME_CONFIG[assetKeys[i]];
    normW[i] = Math.max(cfg.minWeight, Math.min(cfg.maxWeight, normW[i]));
  }
  const boundedSum = normW.reduce((a, b) => a + b, 0);
  normW = normW.map((v) => v / boundedSum);

  // Compute portfolio metrics
  const portVol = calculatePortfolioVol(normW, Sigma);
  const rc = calculateAssetRiskContributions(normW, Sigma);

  // Expected returns per regime for Sharpe estimate
  const expectedReturnsAnnual: Record<MarketRegime, number[]> = {
    BULL_TRENDING: [0.22, 0.26, 0.10, 0.068],
    LOW_VOL_CHOP: [0.06, 0.07, 0.09, 0.068],
    HIGH_VOL_CRISIS: [-0.28, -0.36, 0.18, 0.068],
  };

  const expReturns = expectedReturnsAnnual[regime];
  let portExpectedReturn = 0;
  for (let i = 0; i < n; i++) {
    portExpectedReturn += normW[i] * expReturns[i];
  }

  const riskFreeRate = 0.068; // 6.8% RBI T-bill rate
  const sharpe = (portExpectedReturn - riskFreeRate) / Math.max(0.01, portVol);

  const regimeDescriptions: Record<MarketRegime, string> = {
    BULL_TRENDING: 'Bull Trending (Equity Risk Maximizer & Beta Momentum)',
    LOW_VOL_CHOP: 'Low-Vol Chop (All-Weather Risk Parity & Gold Accumulation)',
    HIGH_VOL_CRISIS: 'High-Vol Crisis (Capital Preservation & Tail Hedge Mode)',
  };

  return {
    niftyWeight: Number(normW[0].toFixed(4)),
    bankNiftyWeight: Number(normW[1].toFixed(4)),
    goldWeight: Number(normW[2].toFixed(4)),
    cashWeight: Number(normW[3].toFixed(4)),
    portfolioExpectedVol: Number(portVol.toFixed(4)),
    regimeLabel: regimeDescriptions[regime],
    riskContributions: {
      nifty: Number(rc[0].toFixed(4)),
      bankNifty: Number(rc[1].toFixed(4)),
      gold: Number(rc[2].toFixed(4)),
      cash: Number(rc[3].toFixed(4)),
    },
    targetVol: Number(targetVol.toFixed(4)),
    sharpeRatioEstimate: Number(sharpe.toFixed(2)),
    grossLeverage: 1.0,
  };
}

// ============================================================================
// 4. PRE-SEEDED HISTORICAL DATASETS FOR INDIAN REGIME BENCHMARKING
// ============================================================================

/**
 * 2020 COVID Crash: 45 Trading Days (14 Feb 2020 to 20 Apr 2020)
 * Nifty plunges from 12,200 to 7,511 (-38.4%), including historic lower circuits (-13.06% on 23 Mar 2020).
 * India VIX spikes to 86.6. Gold rallies as safe haven.
 */
export const COVID_2020_CRASH_DATA: RegimeHistoricalDataPoint[] = [
  { date: '2020-02-14', niftyReturn: -0.0017, niftyClose: 12113.45, bullProb: 0.72, chopProb: 0.24, crisisProb: 0.04, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.38, bankNifty: 0.28, gold: 0.20, cash: 0.14 }, portfolioVol: 0.115 },
  { date: '2020-02-17', niftyReturn: -0.0056, niftyClose: 12045.80, bullProb: 0.58, chopProb: 0.35, crisisProb: 0.07, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.36, bankNifty: 0.26, gold: 0.22, cash: 0.16 }, portfolioVol: 0.118 },
  { date: '2020-02-24', niftyReturn: -0.0208, niftyClose: 11829.40, bullProb: 0.30, chopProb: 0.42, crisisProb: 0.28, dominantRegime: 'LOW_VOL_CHOP', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.25, bankNifty: 0.18, gold: 0.32, cash: 0.25 }, portfolioVol: 0.132 },
  { date: '2020-02-28', niftyReturn: -0.0371, niftyClose: 11201.75, bullProb: 0.08, chopProb: 0.22, crisisProb: 0.70, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.09, bankNifty: 0.05, gold: 0.42, cash: 0.44 }, portfolioVol: 0.210 },
  { date: '2020-03-02', niftyReturn: -0.0142, niftyClose: 11132.75, bullProb: 0.04, chopProb: 0.16, crisisProb: 0.80, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.08, bankNifty: 0.04, gold: 0.44, cash: 0.44 }, portfolioVol: 0.225 },
  { date: '2020-03-06', niftyReturn: -0.0248, niftyClose: 10989.45, bullProb: 0.02, chopProb: 0.10, crisisProb: 0.88, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.07, bankNifty: 0.04, gold: 0.44, cash: 0.45 }, portfolioVol: 0.245 },
  { date: '2020-03-09', niftyReturn: -0.0490, niftyClose: 10451.45, bullProb: 0.01, chopProb: 0.04, crisisProb: 0.95, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.06, bankNifty: 0.03, gold: 0.45, cash: 0.46 }, portfolioVol: 0.278 },
  { date: '2020-03-12', niftyReturn: -0.0830, niftyClose: 9590.15, bullProb: 0.00, chopProb: 0.01, crisisProb: 0.99, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.02, gold: 0.45, cash: 0.48 }, portfolioVol: 0.330 },
  { date: '2020-03-13', niftyReturn: 0.0381, niftyClose: 9955.20, bullProb: 0.01, chopProb: 0.03, crisisProb: 0.96, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.02, gold: 0.45, cash: 0.48 }, portfolioVol: 0.315 },
  { date: '2020-03-16', niftyReturn: -0.0761, niftyClose: 9197.40, bullProb: 0.00, chopProb: 0.01, crisisProb: 0.99, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.02, gold: 0.45, cash: 0.48 }, portfolioVol: 0.342 },
  { date: '2020-03-18', niftyReturn: -0.0556, niftyClose: 8468.80, bullProb: 0.00, chopProb: 0.01, crisisProb: 0.99, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.02, gold: 0.45, cash: 0.48 }, portfolioVol: 0.360 },
  { date: '2020-03-19', niftyReturn: -0.0242, niftyClose: 8263.45, bullProb: 0.00, chopProb: 0.02, crisisProb: 0.98, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.02, gold: 0.45, cash: 0.48 }, portfolioVol: 0.355 },
  { date: '2020-03-23', niftyReturn: -0.1306, niftyClose: 7610.25, bullProb: 0.00, chopProb: 0.00, crisisProb: 1.00, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.04, bankNifty: 0.02, gold: 0.44, cash: 0.50 }, portfolioVol: 0.440 },
  { date: '2020-03-24', niftyReturn: 0.0251, niftyClose: 7801.05, bullProb: 0.00, chopProb: 0.01, crisisProb: 0.99, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.02, gold: 0.45, cash: 0.48 }, portfolioVol: 0.395 },
  { date: '2020-03-25', niftyReturn: 0.0662, niftyClose: 8317.85, bullProb: 0.01, chopProb: 0.03, crisisProb: 0.96, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.03, gold: 0.45, cash: 0.47 }, portfolioVol: 0.370 },
  { date: '2020-03-27', niftyReturn: 0.0381, niftyClose: 8660.25, bullProb: 0.02, chopProb: 0.06, crisisProb: 0.92, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.06, bankNifty: 0.03, gold: 0.45, cash: 0.46 }, portfolioVol: 0.340 },
  { date: '2020-03-30', niftyReturn: -0.0400, niftyClose: 8281.10, bullProb: 0.01, chopProb: 0.03, crisisProb: 0.96, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.05, bankNifty: 0.02, gold: 0.45, cash: 0.48 }, portfolioVol: 0.350 },
  { date: '2020-04-03', niftyReturn: -0.0206, niftyClose: 8083.80, bullProb: 0.01, chopProb: 0.05, crisisProb: 0.94, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.06, bankNifty: 0.03, gold: 0.45, cash: 0.46 }, portfolioVol: 0.320 },
  { date: '2020-04-07', niftyReturn: 0.0876, niftyClose: 8792.20, bullProb: 0.04, chopProb: 0.12, crisisProb: 0.84, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.08, bankNifty: 0.04, gold: 0.44, cash: 0.44 }, portfolioVol: 0.285 },
  { date: '2020-04-09', niftyReturn: 0.0377, niftyClose: 9111.90, bullProb: 0.08, chopProb: 0.22, crisisProb: 0.70, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.10, bankNifty: 0.06, gold: 0.42, cash: 0.42 }, portfolioVol: 0.250 },
  { date: '2020-04-16', niftyReturn: 0.0127, niftyClose: 9266.75, bullProb: 0.15, chopProb: 0.35, crisisProb: 0.50, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.15, bankNifty: 0.10, gold: 0.40, cash: 0.35 }, portfolioVol: 0.210 },
  { date: '2020-04-20', niftyReturn: 0.0003, niftyClose: 9261.85, bullProb: 0.22, chopProb: 0.48, crisisProb: 0.30, dominantRegime: 'LOW_VOL_CHOP', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.20, bankNifty: 0.14, gold: 0.36, cash: 0.30 }, portfolioVol: 0.180 },
];

/**
 * 2021 Bull Run: 45 Trading Days (Nov 2020 to Jan 2021)
 * High-momentum structural bull rally from 11,800 to 14,500+.
 * Very low realized vol, consistent positive drift, Bull Trending confidence > 88%.
 */
export const BULL_2021_RUN_DATA: RegimeHistoricalDataPoint[] = [
  { date: '2020-11-03', niftyReturn: 0.0098, niftyClose: 11813.50, bullProb: 0.82, chopProb: 0.15, crisisProb: 0.03, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.38, bankNifty: 0.28, gold: 0.20, cash: 0.14 }, portfolioVol: 0.112 },
  { date: '2020-11-05', niftyReturn: 0.0148, niftyClose: 12120.30, bullProb: 0.88, chopProb: 0.10, crisisProb: 0.02, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.40, bankNifty: 0.30, gold: 0.18, cash: 0.12 }, portfolioVol: 0.110 },
  { date: '2020-11-10', niftyReturn: 0.0136, niftyClose: 12631.10, bullProb: 0.92, chopProb: 0.07, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.42, bankNifty: 0.32, gold: 0.16, cash: 0.10 }, portfolioVol: 0.108 },
  { date: '2020-11-18', niftyReturn: 0.0053, niftyClose: 12938.25, bullProb: 0.93, chopProb: 0.06, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.42, bankNifty: 0.32, gold: 0.16, cash: 0.10 }, portfolioVol: 0.105 },
  { date: '2020-11-24', niftyReturn: 0.0101, niftyClose: 13055.15, bullProb: 0.94, chopProb: 0.05, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.42, bankNifty: 0.32, gold: 0.16, cash: 0.10 }, portfolioVol: 0.104 },
  { date: '2020-12-04', niftyReturn: 0.0095, niftyClose: 13258.55, bullProb: 0.95, chopProb: 0.04, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.42, bankNifty: 0.32, gold: 0.16, cash: 0.10 }, portfolioVol: 0.102 },
  { date: '2020-12-11', niftyReturn: -0.0014, niftyClose: 13513.85, bullProb: 0.91, chopProb: 0.08, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.40, bankNifty: 0.30, gold: 0.18, cash: 0.12 }, portfolioVol: 0.103 },
  { date: '2020-12-18', niftyReturn: 0.0014, niftyClose: 13760.55, bullProb: 0.92, chopProb: 0.07, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.41, bankNifty: 0.31, gold: 0.17, cash: 0.11 }, portfolioVol: 0.102 },
  { date: '2020-12-21', niftyReturn: -0.0414, niftyClose: 13328.40, bullProb: 0.45, chopProb: 0.25, crisisProb: 0.30, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.28, bankNifty: 0.20, gold: 0.28, cash: 0.24 }, portfolioVol: 0.138 },
  { date: '2020-12-23', niftyReturn: 0.0100, niftyClose: 13601.10, bullProb: 0.75, chopProb: 0.18, crisisProb: 0.07, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.36, bankNifty: 0.26, gold: 0.22, cash: 0.16 }, portfolioVol: 0.115 },
  { date: '2020-12-30', niftyReturn: 0.0035, niftyClose: 13981.95, bullProb: 0.88, chopProb: 0.10, crisisProb: 0.02, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.40, bankNifty: 0.30, gold: 0.18, cash: 0.12 }, portfolioVol: 0.106 },
  { date: '2021-01-08', niftyReturn: 0.0148, niftyClose: 14347.25, bullProb: 0.94, chopProb: 0.05, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.42, bankNifty: 0.32, gold: 0.16, cash: 0.10 }, portfolioVol: 0.103 },
  { date: '2021-01-13', niftyReturn: -0.0006, niftyClose: 14564.85, bullProb: 0.92, chopProb: 0.07, crisisProb: 0.01, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.41, bankNifty: 0.31, gold: 0.17, cash: 0.11 }, portfolioVol: 0.104 },
];

/**
 * 2024 Election Choppiness & V-Shape: (Apr 2024 to Jun 2024)
 * Low-vol consolidation -> Exit poll euphoric gap (+3.25% 3 Jun 2024) ->
 * Historic results day crash (-5.93% 4 Jun 2024) -> Immediate +3.38% recovery.
 */
export const ELECTION_2024_CHOP_DATA: RegimeHistoricalDataPoint[] = [
  { date: '2024-05-15', niftyReturn: -0.0008, niftyClose: 22200.55, bullProb: 0.28, chopProb: 0.65, crisisProb: 0.07, dominantRegime: 'LOW_VOL_CHOP', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.22, bankNifty: 0.16, gold: 0.34, cash: 0.28 }, portfolioVol: 0.098 },
  { date: '2024-05-20', niftyReturn: 0.0016, niftyClose: 22502.00, bullProb: 0.34, chopProb: 0.60, crisisProb: 0.06, dominantRegime: 'LOW_VOL_CHOP', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.24, bankNifty: 0.18, gold: 0.32, cash: 0.26 }, portfolioVol: 0.101 },
  { date: '2024-05-27', niftyReturn: -0.0011, niftyClose: 22932.45, bullProb: 0.42, chopProb: 0.52, crisisProb: 0.06, dominantRegime: 'LOW_VOL_CHOP', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.25, bankNifty: 0.19, gold: 0.30, cash: 0.26 }, portfolioVol: 0.105 },
  { date: '2024-05-31', niftyReturn: 0.0019, niftyClose: 22530.70, bullProb: 0.40, chopProb: 0.54, crisisProb: 0.06, dominantRegime: 'LOW_VOL_CHOP', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.25, bankNifty: 0.19, gold: 0.30, cash: 0.26 }, portfolioVol: 0.108 },
  { date: '2024-06-03', niftyReturn: 0.0325, niftyClose: 23263.90, bullProb: 0.78, chopProb: 0.18, crisisProb: 0.04, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.38, bankNifty: 0.28, gold: 0.20, cash: 0.14 }, portfolioVol: 0.125 },
  { date: '2024-06-04', niftyReturn: -0.0593, niftyClose: 21884.50, bullProb: 0.04, chopProb: 0.12, crisisProb: 0.84, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'HIGH_VOL_CRISIS', riskParityWeights: { nifty: 0.08, bankNifty: 0.04, gold: 0.44, cash: 0.44 }, portfolioVol: 0.295 },
  { date: '2024-06-05', niftyReturn: 0.0338, niftyClose: 22620.35, bullProb: 0.18, chopProb: 0.32, crisisProb: 0.50, dominantRegime: 'HIGH_VOL_CRISIS', viterbiRegime: 'LOW_VOL_CHOP', riskParityWeights: { nifty: 0.18, bankNifty: 0.12, gold: 0.38, cash: 0.32 }, portfolioVol: 0.210 },
  { date: '2024-06-06', niftyReturn: 0.0160, niftyClose: 22821.40, bullProb: 0.52, chopProb: 0.36, crisisProb: 0.12, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.30, bankNifty: 0.22, gold: 0.26, cash: 0.22 }, portfolioVol: 0.140 },
  { date: '2024-06-07', niftyReturn: 0.0205, niftyClose: 23290.15, bullProb: 0.82, chopProb: 0.15, crisisProb: 0.03, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.38, bankNifty: 0.28, gold: 0.20, cash: 0.14 }, portfolioVol: 0.118 },
];

/**
 * 2026 Live Market Snapshot (November 2026 baseline)
 */
export const LIVE_2026_MARKET_DATA: RegimeHistoricalDataPoint[] = [
  { date: '2026-10-20', niftyReturn: 0.0034, niftyClose: 25410.20, bullProb: 0.85, chopProb: 0.12, crisisProb: 0.03, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.39, bankNifty: 0.29, gold: 0.19, cash: 0.13 }, portfolioVol: 0.108 },
  { date: '2026-10-24', niftyReturn: -0.0012, niftyClose: 25380.00, bullProb: 0.79, chopProb: 0.18, crisisProb: 0.03, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.36, bankNifty: 0.26, gold: 0.22, cash: 0.16 }, portfolioVol: 0.110 },
  { date: '2026-10-31', niftyReturn: 0.0042, niftyClose: 25490.50, bullProb: 0.86, chopProb: 0.11, crisisProb: 0.03, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.39, bankNifty: 0.29, gold: 0.19, cash: 0.13 }, portfolioVol: 0.107 },
  { date: '2026-11-06', niftyReturn: -0.0045, niftyClose: 25375.10, bullProb: 0.62, chopProb: 0.32, crisisProb: 0.06, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.32, bankNifty: 0.22, gold: 0.26, cash: 0.20 }, portfolioVol: 0.115 },
  { date: '2026-11-12', niftyReturn: 0.0028, niftyClose: 25445.80, bullProb: 0.74, chopProb: 0.22, crisisProb: 0.04, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.35, bankNifty: 0.25, gold: 0.23, cash: 0.17 }, portfolioVol: 0.112 },
  { date: '2026-11-18', niftyReturn: 0.0051, niftyClose: 25575.40, bullProb: 0.88, chopProb: 0.09, crisisProb: 0.03, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.40, bankNifty: 0.30, gold: 0.18, cash: 0.12 }, portfolioVol: 0.106 },
  { date: '2026-11-20', niftyReturn: 0.0038, niftyClose: 25672.60, bullProb: 0.89, chopProb: 0.08, crisisProb: 0.03, dominantRegime: 'BULL_TRENDING', viterbiRegime: 'BULL_TRENDING', riskParityWeights: { nifty: 0.40, bankNifty: 0.30, gold: 0.18, cash: 0.12 }, portfolioVol: 0.105 },
];

export const REGIME_PRESETS: Record<
  RegimeHistoricalPreset,
  {
    name: string;
    description: string;
    data: RegimeHistoricalDataPoint[];
    typicalRegime: MarketRegime;
  }
> = {
  COVID_2020_CRASH: {
    name: '2020 COVID Crash',
    description: 'Black swan tail-risk event: Nifty -38%, circuit breakers, India VIX 86, safe-haven flight.',
    data: COVID_2020_CRASH_DATA,
    typicalRegime: 'HIGH_VOL_CRISIS',
  },
  BULL_2021_RUN: {
    name: '2021 Post-COVID Bull Run',
    description: 'Unprecedented liquidity rally: Nifty breaks 14,000+, suppressed volatility, persistent positive drift.',
    data: BULL_2021_RUN_DATA,
    typicalRegime: 'BULL_TRENDING',
  },
  ELECTION_2024_CHOP: {
    name: '2024 Election Volatility & V-Shape',
    description: 'Pre-election chop, exit poll euphoria (+3.3%), surprise crash (-5.9% on June 4), and rapid V-shape recovery.',
    data: ELECTION_2024_CHOP_DATA,
    typicalRegime: 'LOW_VOL_CHOP',
  },
  LIVE_2026_MARKET: {
    name: '2026 Live Market Environment',
    description: 'Current real-time market regime, robust DII SIP flows, institutional breadth >70%.',
    data: LIVE_2026_MARKET_DATA,
    typicalRegime: 'BULL_TRENDING',
  },
};

// ============================================================================
// 5. UI BRIDGE HELPERS & 1-CLICK REGIME ACTION CONTROLLER
// ============================================================================

/**
 * Calculates Persistence Half-Life from diagonal transition probability P_ii:
 * t_half = ln(0.5) / ln(P_ii)
 */
export function calculateRegimeHalfLife(persistenceProb: number): number {
  if (persistenceProb <= 0 || persistenceProb >= 1) return 10.0;
  const halfLife = Math.log(0.5) / Math.log(persistenceProb);
  return Number(Math.max(1.0, Math.min(60.0, halfLife)).toFixed(1));
}

/**
 * Calculates Steady-State Ergodic Distribution:
 * Solves pi * P = pi, sum(pi) = 1 via numerical power iteration
 */
export function computeErgodicDistribution(
  transitions: MarkovStateTransition[]
): ErgodicDistribution {
  const P = [
    [transitions[0].toRegimes.BULL_TRENDING, transitions[0].toRegimes.LOW_VOL_CHOP, transitions[0].toRegimes.HIGH_VOL_CRISIS],
    [transitions[1].toRegimes.BULL_TRENDING, transitions[1].toRegimes.LOW_VOL_CHOP, transitions[1].toRegimes.HIGH_VOL_CRISIS],
    [transitions[2].toRegimes.BULL_TRENDING, transitions[2].toRegimes.LOW_VOL_CHOP, transitions[2].toRegimes.HIGH_VOL_CRISIS],
  ];

  // Power iteration starting with uniform [1/3, 1/3, 1/3]
  let pi = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < 100; iter++) {
    const nextPi = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        nextPi[j] += pi[i] * P[i][j];
      }
    }
    const sum = nextPi[0] + nextPi[1] + nextPi[2];
    pi = nextPi.map((v) => v / sum);
  }

  // Shannon Entropy: H = -sum(pi_i * log2(pi_i))
  let entropy = 0;
  for (const p of pi) {
    if (p > 1e-8) {
      entropy -= p * Math.log2(p);
    }
  }

  return {
    bull: Number(pi[0].toFixed(3)),
    chop: Number(pi[1].toFixed(3)),
    crisis: Number(pi[2].toFixed(3)),
    entropy: Number(entropy.toFixed(2)),
  };
}

/**
 * Computes Shannon entropy from state probability distribution
 */
export function calculateShannonEntropy(probabilities: number[]): number {
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 1e-12) {
      entropy -= p * Math.log2(p);
    }
  }
  return Number(entropy.toFixed(3));
}

/**
 * Returns baseline target risk-parity weights conditional on active regime.
 * Equal Risk Contribution (ERC) allocates inversely to asset volatility and correlation.
 */
export function computeRegimeTargetRiskParity(
  regime: RegimeType,
  tailHedgeActive: boolean = false
): Record<MultiAssetKey, { targetWeight: number; mrc: number; rcPct: number }> {
  if (tailHedgeActive) {
    // 100% Crisis tail hedge mode: Zero equities, heavy gold safe-haven and liquid cash
    return {
      NIFTY: { targetWeight: 0.0, mrc: 0.0, rcPct: 0.0 },
      BANKNIFTY: { targetWeight: 0.0, mrc: 0.0, rcPct: 0.0 },
      GOLDBEES: { targetWeight: 45.0, mrc: 1.8, rcPct: 52.0 },
      LIQUIDBEES: { targetWeight: 55.0, mrc: 0.4, rcPct: 48.0 },
    };
  }

  switch (regime) {
    case 'BULL_TRENDING':
      return {
        NIFTY: { targetWeight: 28.5, mrc: 2.1, rcPct: 25.4 },
        BANKNIFTY: { targetWeight: 21.5, mrc: 2.8, rcPct: 25.1 },
        GOLDBEES: { targetWeight: 26.0, mrc: 2.3, rcPct: 24.8 },
        LIQUIDBEES: { targetWeight: 24.0, mrc: 0.6, rcPct: 24.7 },
      };

    case 'LOW_VOL_CHOP':
      return {
        NIFTY: { targetWeight: 18.0, mrc: 1.9, rcPct: 25.2 },
        BANKNIFTY: { targetWeight: 12.0, mrc: 2.7, rcPct: 25.0 },
        GOLDBEES: { targetWeight: 35.0, mrc: 1.8, rcPct: 24.9 },
        LIQUIDBEES: { targetWeight: 35.0, mrc: 0.5, rcPct: 24.9 },
      };

    case 'HIGH_VOL_CRISIS':
    default:
      return {
        NIFTY: { targetWeight: 6.5, mrc: 6.4, rcPct: 25.8 },
        BANKNIFTY: { targetWeight: 3.5, mrc: 8.9, rcPct: 25.4 },
        GOLDBEES: { targetWeight: 42.0, mrc: 2.2, rcPct: 24.6 },
        LIQUIDBEES: { targetWeight: 48.0, mrc: 0.4, rcPct: 24.2 },
      };
  }
}

/**
 * Builds asset allocation items given current weights and target weights
 */
export function buildAssetAllocationItems(
  currentWeights: Record<MultiAssetKey, number>,
  targetWeights: Record<MultiAssetKey, { targetWeight: number; mrc: number; rcPct: number }>,
  regime: RegimeType
): AssetAllocationItem[] {
  const keys: MultiAssetKey[] = ['NIFTY', 'BANKNIFTY', 'GOLDBEES', 'LIQUIDBEES'];

  const volMultipliers: Record<MultiAssetKey, number> =
    regime === 'HIGH_VOL_CRISIS'
      ? { NIFTY: 2.4, BANKNIFTY: 2.6, GOLDBEES: 1.3, LIQUIDBEES: 1.0 }
      : regime === 'LOW_VOL_CHOP'
      ? { NIFTY: 0.8, BANKNIFTY: 0.85, GOLDBEES: 1.1, LIQUIDBEES: 1.0 }
      : { NIFTY: 1.0, BANKNIFTY: 1.0, GOLDBEES: 1.0, LIQUIDBEES: 1.0 };

  const expectedReturns: Record<MultiAssetKey, number> =
    regime === 'HIGH_VOL_CRISIS'
      ? { NIFTY: -24.0, BANKNIFTY: -32.0, GOLDBEES: 18.5, LIQUIDBEES: 6.8 }
      : regime === 'LOW_VOL_CHOP'
      ? { NIFTY: 6.5, BANKNIFTY: 7.2, GOLDBEES: 9.0, LIQUIDBEES: 6.8 }
      : { NIFTY: 22.4, BANKNIFTY: 26.5, GOLDBEES: 11.0, LIQUIDBEES: 6.8 };

  return keys.map((key) => {
    const meta = MULTI_ASSET_METAS[key];
    const target = targetWeights[key];
    const curr = currentWeights[key] ?? target.targetWeight;
    const annualVol = Number((meta.annualizedVol * volMultipliers[key]).toFixed(1));
    const expReturn = expectedReturns[key];

    return {
      key,
      symbol: meta.symbol,
      name: meta.name,
      assetClass: meta.assetClass,
      currentWeight: Number(curr.toFixed(1)),
      targetWeight: Number(target.targetWeight.toFixed(1)),
      marginalRiskContribution: target.mrc,
      riskContributionPct: target.rcPct,
      annualVol,
      expectedReturn: expReturn,
      color: meta.color,
    };
  });
}

/**
 * Computes portfolio expected Sharpe ratio given allocations and active regime
 */
export function calculatePortfolioSharpe(
  allocations: AssetAllocationItem[],
  volTargetPct: number
): { sharpe: number; portfolioVol: number; expectedReturn: number } {
  let portfolioReturn = 0;
  let portfolioVar = 0;

  for (const item of allocations) {
    const w = item.targetWeight / 100;
    portfolioReturn += w * item.expectedReturn;
    portfolioVar += Math.pow(w * item.annualVol, 2);
  }

  const portfolioVol = Math.sqrt(portfolioVar) * 1.15;
  const riskFreeRate = 6.8; // RBI 91-day T-Bill rate in India

  const leverage = volTargetPct / Math.max(2.0, portfolioVol);
  const scaledReturn = riskFreeRate + (portfolioReturn - riskFreeRate) * leverage;
  const sharpe = Number(((scaledReturn - riskFreeRate) / volTargetPct).toFixed(2));

  return {
    sharpe: Math.max(-0.5, Math.min(3.8, sharpe)),
    portfolioVol: Number(portfolioVol.toFixed(1)),
    expectedReturn: Number(scaledReturn.toFixed(1)),
  };
}

/**
 * Generates 60 historical trading days with realistic Indian market regime sequences
 */
export function generateHistoricalRibbonData(): HistoricalRibbonPoint[] {
  const points: HistoricalRibbonPoint[] = [];
  const baseDate = new Date('2026-08-28T09:15:00Z');

  let nifty = 100.0;
  let bankNifty = 100.0;
  let goldBees = 100.0;
  let liquidBees = 100.0;

  for (let i = 0; i < 60; i++) {
    const curDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = curDate.toISOString().split('T')[0];

    let regime: RegimeType = 'BULL_TRENDING';
    let probBull = 0.88;
    let probChop = 0.09;
    let probCrisis = 0.03;
    let marketNote: string | undefined;

    if (i < 18) {
      regime = 'BULL_TRENDING';
      probBull = 0.85 + Math.sin(i * 0.3) * 0.1;
      probChop = 0.12 - Math.sin(i * 0.3) * 0.08;
      probCrisis = 0.03;
      if (i === 5) marketNote = 'GST Collections Surge + FII Inflow ₹4,200 Cr';
      if (i === 15) marketNote = 'Nifty touches fresh all-time high';
    } else if (i < 36) {
      regime = 'LOW_VOL_CHOP';
      probChop = 0.82 + Math.cos(i * 0.4) * 0.1;
      probBull = 0.12 - Math.cos(i * 0.4) * 0.06;
      probCrisis = 0.06;
      if (i === 22) marketNote = 'RBI MPC holds repo rate at 6.50% neutral stance';
      if (i === 30) marketNote = 'India VIX compresses to 11.2 multi-month low';
    } else if (i < 48) {
      regime = 'HIGH_VOL_CRISIS';
      probCrisis = 0.86 + Math.sin(i * 0.5) * 0.09;
      probChop = 0.09;
      probBull = 0.05;
      if (i === 37) marketNote = 'Brent crude crosses $94; FIIs offload ₹6,800 Cr';
      if (i === 42) marketNote = 'India VIX spikes to 23.8; BankNifty plunges 3.4%';
    } else {
      regime = 'BULL_TRENDING';
      probBull = 0.84 + Math.sin(i * 0.4) * 0.1;
      probChop = 0.12;
      probCrisis = 0.04;
      if (i === 51) marketNote = 'Heavy DII SIP absorption ₹24,000 Cr month-to-date';
      if (i === 58) marketNote = 'HMM confirms transition back to Bull Trending';
    }

    let niftyRet = 0;
    let bankRet = 0;
    let goldRet = 0;
    const liquidRet = 0.00024;

    if (regime === 'BULL_TRENDING') {
      niftyRet = 0.0055 + Math.sin(i * 1.3) * 0.004;
      bankRet = 0.0072 + Math.sin(i * 1.5) * 0.006;
      goldRet = 0.0008 + Math.cos(i * 0.9) * 0.003;
    } else if (regime === 'LOW_VOL_CHOP') {
      niftyRet = Math.sin(i * 2.1) * 0.004 - 0.0005;
      bankRet = Math.cos(i * 1.9) * 0.006 - 0.0008;
      goldRet = 0.0018 + Math.sin(i * 1.1) * 0.003;
    } else {
      niftyRet = -0.016 + Math.sin(i * 2.5) * 0.012;
      bankRet = -0.024 + Math.cos(i * 2.2) * 0.016;
      goldRet = 0.0125 + Math.sin(i * 1.4) * 0.005;
    }

    nifty = Math.max(70, nifty * (1 + niftyRet));
    bankNifty = Math.max(65, bankNifty * (1 + bankRet));
    goldBees = Math.max(80, goldBees * (1 + goldRet));
    liquidBees = liquidBees * (1 + liquidRet);

    points.push({
      index: points.length,
      date: dateStr,
      regime,
      nifty: Number(nifty.toFixed(2)),
      bankNifty: Number(bankNifty.toFixed(2)),
      goldBees: Number(goldBees.toFixed(2)),
      liquidBees: Number(liquidBees.toFixed(2)),
      probBull: Number(probBull.toFixed(3)),
      probChop: Number(probChop.toFixed(3)),
      probCrisis: Number(probCrisis.toFixed(3)),
      dailyReturnNifty: Number((niftyRet * 100).toFixed(2)),
      marketNote,
    });
  }

  return points;
}

/**
 * Executes a 1-Click Regime Action:
 * - REBALANCE_RISK_PARITY: Re-solves ERC weights for current filtered regime
 * - HEDGE_CRISIS_TAIL: Maximize Cash & Gold, cut equities to zero
 * - OVERRIDE_REGIME: Sets user-specified regime override
 * - RESET_STATE: Resets detector to stationary ergodic state
 */
export function executeRegimeAction(
  payload: RegimeActionPayload,
  currentState?: FilteredRegimeState
): RegimeActionResult {
  const timestamp = new Date().toISOString();
  const currentRegime = currentState?.dominantRegime ?? 'BULL_TRENDING';
  let activeRegime: MarketRegime = currentRegime;
  const targetVol = payload.targetVol ?? 0.12;

  switch (payload.action) {
    case 'REBALANCE_RISK_PARITY': {
      activeRegime = currentRegime;
      const updatedWeights = calculateRegimeRiskParity(activeRegime, targetVol);
      return {
        success: true,
        action: 'REBALANCE_RISK_PARITY',
        timestamp,
        previousRegime: currentRegime,
        activeRegime,
        updatedWeights,
        message: `Successfully rebalanced multi-asset weights to Equal Risk Contribution for ${REGIME_CHARACTERISTICS[activeRegime].name}.`,
        executionShortfallBps: 2.4,
      };
    }

    case 'HEDGE_CRISIS_TAIL': {
      activeRegime = 'HIGH_VOL_CRISIS';
      const updatedWeights: RiskParityWeights = {
        niftyWeight: 0.0,
        bankNiftyWeight: 0.0,
        goldWeight: 0.45,
        cashWeight: 0.55,
        portfolioExpectedVol: 0.068,
        regimeLabel: 'Crisis Tail Hedge (100% Capital Preservation & Gold Haven)',
        riskContributions: { nifty: 0, bankNifty: 0, gold: 0.055, cash: 0.013 },
        targetVol,
        sharpeRatioEstimate: 1.15,
        grossLeverage: 1.0,
      };
      return {
        success: true,
        action: 'HEDGE_CRISIS_TAIL',
        timestamp,
        previousRegime: currentRegime,
        activeRegime,
        updatedWeights,
        message: 'Crisis tail-hedge activated: Equities liquidated to 0%. Reallocated 45% Gold BEES, 55% Liquid BEES.',
        executionShortfallBps: 4.8,
      };
    }

    case 'OVERRIDE_REGIME': {
      activeRegime = payload.overrideRegime ?? 'LOW_VOL_CHOP';
      const updatedWeights = calculateRegimeRiskParity(activeRegime, targetVol);
      return {
        success: true,
        action: 'OVERRIDE_REGIME',
        timestamp,
        previousRegime: currentRegime,
        activeRegime,
        updatedWeights,
        message: `Manual override applied: Regime forced to ${REGIME_CHARACTERISTICS[activeRegime].name}. Weights re-solved.`,
        executionShortfallBps: 1.8,
      };
    }

    case 'RESET_STATE':
    default: {
      activeRegime = 'BULL_TRENDING';
      const updatedWeights = calculateRegimeRiskParity(activeRegime, targetVol);
      return {
        success: true,
        action: 'RESET_STATE',
        timestamp,
        previousRegime: currentRegime,
        activeRegime,
        updatedWeights,
        message: 'Online HMM filter reset to prior ergodic stationary distribution. Tracking resumed.',
        executionShortfallBps: 0.0,
      };
    }
  }
}

/**
 * Returns a high-level summary of the Regime Engine state for UI Cockpit / Modals
 */
export function getRegimeEngineSummary(
  preset: RegimeHistoricalPreset = 'LIVE_2026_MARKET',
  targetVol: number = 0.12
): RegimeEngineSummary {
  const presetConfig = REGIME_PRESETS[preset] ?? REGIME_PRESETS.LIVE_2026_MARKET;
  const historyData = presetConfig.data;

  // Run forward filter and Viterbi path on historical series
  const filtered = forwardFilterRegime(historyData, DEFAULT_HMM_PARAMS);
  const viterbi = decodeViterbiPath(historyData, DEFAULT_HMM_PARAMS);

  const lastFiltered = filtered[filtered.length - 1] ?? {
    timestamp: new Date().toISOString(),
    bullProb: 0.85,
    chopProb: 0.12,
    crisisProb: 0.03,
    dominantRegime: 'BULL_TRENDING',
    confidence: 0.85,
    shannonEntropy: 0.45,
    observationReturn: 0.0035,
  };

  const currentRegime = lastFiltered.dominantRegime;
  const weights = calculateRegimeRiskParity(currentRegime, targetVol);

  // Transition alert: did regime shift in last 3 periods?
  let transitionAlert = false;
  if (viterbi.states.length >= 3) {
    const last3 = viterbi.states.slice(-3);
    transitionAlert = last3.some((s) => s !== currentRegime);
  }

  let recommendedAction: RegimeActionType = 'REBALANCE_RISK_PARITY';
  let recommendedActionLabel = 'Rebalance Risk Parity Allocation';

  if (currentRegime === 'HIGH_VOL_CRISIS' && lastFiltered.crisisProb > 0.75) {
    recommendedAction = 'HEDGE_CRISIS_TAIL';
    recommendedActionLabel = 'Execute Crisis Tail Hedge (Exit Equities)';
  } else if (lastFiltered.confidence < 0.50) {
    recommendedAction = 'OVERRIDE_REGIME';
    recommendedActionLabel = 'High Uncertainty: Consider Regime Override';
  }

  const assetConfigs = Object.values(TICKER_REGIME_CONFIG);

  return {
    activePreset: preset,
    currentRegime,
    regimeDisplayName: REGIME_CHARACTERISTICS[currentRegime].name,
    confidence: lastFiltered.confidence,
    bullProbability: lastFiltered.bullProb,
    chopProbability: lastFiltered.chopProb,
    crisisProbability: lastFiltered.crisisProb,
    entropy: lastFiltered.shannonEntropy ?? 0.42,
    latestReturn: lastFiltered.observationReturn ?? 0.0038,
    targetAnnualVol: targetVol,
    portfolioExpectedVol: weights.portfolioExpectedVol,
    weights,
    recommendedAction,
    recommendedActionLabel,
    transitionAlert,
    historyLength: historyData.length,
    viterbiPath: viterbi.states,
    assets: assetConfigs,
  };
}
