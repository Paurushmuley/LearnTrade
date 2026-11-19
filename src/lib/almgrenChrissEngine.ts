/**
 * TradeCraft AI — Algorithmic Execution & Optimal Order Slicing Engine
 * Almgren-Chriss (2000) Optimal Execution Quantitative Library (Sprint 27)
 *
 * References:
 * 1. Almgren, R., & Chriss, N. (2000). Optimal execution of portfolio transactions.
 *    Journal of Risk, 3, 5-40.
 * 2. Perold, A. F. (1988). The implementation shortfall: Paper versus reality.
 *    Journal of Portfolio Management, 14(3), 4-9.
 * 3. Kissell, R., & Glantz, M. (2003). Optimal Trading Strategies. AMACOM.
 *
 * Implements:
 * 1. Closed-form Hyperbolic Optimal Trajectory Solver (Almgren-Chriss 2000):
 *    x_j = X * sinh(kappa * (N - j) * tau) / sinh(kappa * N * tau)
 *    where cosh(kappa * tau) = 1 + (lambda * sigma^2 * tau^2) / (2 * eta_tilde)
 * 2. Benchmark Uniform TWAP Trajectory:
 *    x_j = X * (1 - j / N), uniform child order slicing
 * 3. Intraday U-shaped VWAP Trajectory:
 *    Calibrated to National Stock Exchange (NSE) 09:15 - 15:30 trading session
 * 4. Perold Implementation Shortfall Decomposition Engine:
 *    Total IS decomposed into Permanent Impact, Temporary Impact, Timing Risk (Market Drift),
 *    Fixed Costs / Half-Spread, and Opportunity Costs (unexecuted inventory).
 * 5. 1-Click Algorithmic Execution Controller:
 *    EXECUTE_TRAJECTORY, ACCELERATE_AGGRESSIVE, PAUSE_EXECUTION, RESET_SCHEDULE.
 * 6. Pre-seeded Instrument Configurations & Market Data Presets for NIFTY, BANKNIFTY, RELIANCE.
 * 7. Complete UI Bridge Helpers (getAlmgrenChrissSummary, TICKER_CONFIGS, AC_TICKER_CONFIGS,
 *    calculateSigmaPerMin, calculateKappa, calculateOptimalHalfLife, generateTrajectoryPoints,
 *    generateSlicedOrderSteps, generateEfficientFrontier, calculateACMetricsStrip).
 */

import {
  AlmgrenChrissParams,
  ExecutionScheduleStep,
  TrajectoryComparison,
  ACTicker,
  AlmgrenChrissTicker,
  ACTickerConfig,
  TickerExecutionConfig,
  ACModelParameters,
  ACTrajectoryPoint,
  ACSlicedOrderStep,
  ACEfficientFrontierPoint,
  ACMetricsStripData,
  VolumeProfileBucket,
  ActualExecutionFill,
  ImplementationShortfallDecomposition,
  AlmgrenChrissAction,
  AlmgrenChrissState,
  AlmgrenChrissSummary,
  ExecutionSide,
} from '../types/almgrenChriss';

// ============================================================================
// 1. INSTRUMENT CONFIGURATIONS & PRE-SEEDED MARKET DATA
// ============================================================================

export const AC_TICKER_CONFIGS: Record<ACTicker, ACTickerConfig> = {
  NIFTY: {
    symbol: 'NIFTY',
    name: 'NIFTY 50 Futures',
    defaultPrice: 24250.0,
    lotSize: 50,
    tickSize: 0.05,
    defaultVolatilityAnnualPct: 13.8,
    defaultTempImpactEta: 3.2e-5,
    defaultPermImpactGamma: 1.2e-5,
    defaultOrderSize: 5000,
    defaultHorizonMin: 60,
  },
  BANKNIFTY: {
    symbol: 'BANKNIFTY',
    name: 'Bank Nifty Futures',
    defaultPrice: 51800.0,
    lotSize: 15,
    tickSize: 0.05,
    defaultVolatilityAnnualPct: 17.5,
    defaultTempImpactEta: 4.5e-5,
    defaultPermImpactGamma: 1.8e-5,
    defaultOrderSize: 2250,
    defaultHorizonMin: 45,
  },
  RELIANCE: {
    symbol: 'RELIANCE',
    name: 'Reliance Industries (Cash)',
    defaultPrice: 1280.0,
    lotSize: 1,
    tickSize: 0.05,
    defaultVolatilityAnnualPct: 21.0,
    defaultTempImpactEta: 1.8e-5,
    defaultPermImpactGamma: 0.8e-5,
    defaultOrderSize: 25000,
    defaultHorizonMin: 120,
  },
};

export const TICKER_CONFIGS: Record<AlmgrenChrissTicker, TickerExecutionConfig> = {
  NIFTY: {
    ticker: 'NIFTY',
    name: 'NIFTY 50 Index Futures',
    defaultPrice: 24250.0,
    lotSize: 50,
    tickSize: 0.05,
    defaultShares: 2500, // 50 lots
    defaultHorizonMin: 60,
    defaultIntervals: 12, // 5-minute slices
    defaultVolatility: 0.14, // 14% annualized volatility
    defaultRiskAversionLambda: 2.5e-6,
    defaultPermanentImpactGamma: 2.5e-6,
    defaultTemporaryImpactEta: 1.8e-5,
    defaultFixedCostEpsilon: 0.5, // ₹0.50 / unit (~0.2 bps)
    side: 'SELL',
  },
  BANKNIFTY: {
    ticker: 'BANKNIFTY',
    name: 'Nifty Bank Index Futures',
    defaultPrice: 51800.0,
    lotSize: 15,
    tickSize: 0.05,
    defaultShares: 1500, // 100 lots
    defaultHorizonMin: 45,
    defaultIntervals: 9, // 5-minute slices
    defaultVolatility: 0.18, // 18% annualized volatility
    defaultRiskAversionLambda: 4.0e-6,
    defaultPermanentImpactGamma: 3.2e-6,
    defaultTemporaryImpactEta: 2.4e-5,
    defaultFixedCostEpsilon: 1.0, // ₹1.00 / unit
    side: 'SELL',
  },
  RELIANCE: {
    ticker: 'RELIANCE',
    name: 'Reliance Industries Ltd (Cash Equity)',
    defaultPrice: 1280.0,
    lotSize: 1, // Cash equity
    tickSize: 0.05,
    defaultShares: 20000,
    defaultHorizonMin: 120,
    defaultIntervals: 24, // 5-minute slices
    defaultVolatility: 0.22, // 22% annualized volatility
    defaultRiskAversionLambda: 1.5e-6,
    defaultPermanentImpactGamma: 1.2e-6,
    defaultTemporaryImpactEta: 1.0e-5,
    defaultFixedCostEpsilon: 0.1, // ₹0.10 / share
    side: 'SELL',
  },
};

// Ergonomic alias for UI imports
export const TICKER_CONFIG = TICKER_CONFIGS;

// ============================================================================
// 2. CANONICAL NSE INTRADAY VOLUME PROFILE (09:15 - 15:30 IST)
// ============================================================================

/**
 * Standard 25-bucket 15-minute empirical volume curve for Indian NSE equity session.
 * Reflects empirical intraday U-shape:
 * - 09:15-10:15: Opening rush (~25-30% volume)
 * - 10:15-13:30: Midday low liquidity lull (~30% volume)
 * - 13:30-15:30: Pre-close institutional surge & benchmark MOC (~40-45% volume)
 */
export const NSE_INTRADAY_VOLUME_PROFILE: VolumeProfileBucket[] = [
  { intervalIndex: 1, timeLabel: '09:15', volumeFraction: 0.082, cumulativeFraction: 0.082, description: 'Opening Call Auction & Momentum Surge' },
  { intervalIndex: 2, timeLabel: '09:30', volumeFraction: 0.064, cumulativeFraction: 0.146, description: 'Post-Open Price Discovery' },
  { intervalIndex: 3, timeLabel: '09:45', volumeFraction: 0.052, cumulativeFraction: 0.198, description: 'Early Intraday Positioning' },
  { intervalIndex: 4, timeLabel: '10:00', volumeFraction: 0.045, cumulativeFraction: 0.243, description: 'Morning Trend Establishment' },
  { intervalIndex: 5, timeLabel: '10:15', volumeFraction: 0.038, cumulativeFraction: 0.281, description: 'Morning Settle' },
  { intervalIndex: 6, timeLabel: '10:30', volumeFraction: 0.032, cumulativeFraction: 0.313, description: 'Mid-Morning Transition' },
  { intervalIndex: 7, timeLabel: '10:45', volumeFraction: 0.029, cumulativeFraction: 0.342, description: 'Range Consolidation' },
  { intervalIndex: 8, timeLabel: '11:00', volumeFraction: 0.026, cumulativeFraction: 0.368, description: 'Midday Quiet Period' },
  { intervalIndex: 9, timeLabel: '11:15', volumeFraction: 0.025, cumulativeFraction: 0.393, description: 'Low Volatility Consolidation' },
  { intervalIndex: 10, timeLabel: '11:30', volumeFraction: 0.024, cumulativeFraction: 0.417, description: 'Institutional Discretionary Bids' },
  { intervalIndex: 11, timeLabel: '11:45', volumeFraction: 0.023, cumulativeFraction: 0.440, description: 'Pre-Noon Quiet' },
  { intervalIndex: 12, timeLabel: '12:00', volumeFraction: 0.024, cumulativeFraction: 0.464, description: 'Noon Reset' },
  { intervalIndex: 13, timeLabel: '12:15', volumeFraction: 0.026, cumulativeFraction: 0.490, description: 'European Market Cues' },
  { intervalIndex: 14, timeLabel: '12:30', volumeFraction: 0.029, cumulativeFraction: 0.519, description: 'Post-Noon Flow Pick-up' },
  { intervalIndex: 15, timeLabel: '12:45', volumeFraction: 0.033, cumulativeFraction: 0.552, description: 'London Pre-Open Flow' },
  { intervalIndex: 16, timeLabel: '13:00', volumeFraction: 0.036, cumulativeFraction: 0.588, description: 'European Opening Cross Flow' },
  { intervalIndex: 17, timeLabel: '13:15', volumeFraction: 0.039, cumulativeFraction: 0.627, description: 'Afternoon Institutional Flow' },
  { intervalIndex: 18, timeLabel: '13:30', volumeFraction: 0.044, cumulativeFraction: 0.671, description: 'Pre-Close Trend Acceleration' },
  { intervalIndex: 19, timeLabel: '13:45', volumeFraction: 0.048, cumulativeFraction: 0.719, description: 'Derivatives Expiry Roll Activity' },
  { intervalIndex: 20, timeLabel: '14:00', volumeFraction: 0.054, cumulativeFraction: 0.773, description: 'Afternoon Liquidity Surge' },
  { intervalIndex: 21, timeLabel: '14:15', volumeFraction: 0.059, cumulativeFraction: 0.832, description: 'Institutional Program Slicing' },
  { intervalIndex: 22, timeLabel: '14:30', volumeFraction: 0.065, cumulativeFraction: 0.897, description: 'Closing Roll-over Surge' },
  { intervalIndex: 23, timeLabel: '14:45', volumeFraction: 0.072, cumulativeFraction: 0.969, description: 'Pre-Close Auction Positioning' },
  { intervalIndex: 24, timeLabel: '15:00', volumeFraction: 0.021, cumulativeFraction: 0.990, description: 'Closing Bell Ramp' },
  { intervalIndex: 25, timeLabel: '15:15', volumeFraction: 0.010, cumulativeFraction: 1.000, description: 'MOC (Market on Close) Final Execution' },
];

// ============================================================================
// 3. MATHEMATICAL & TIME HELPERS
// ============================================================================

/**
 * Rounds a price to the nearest instrument tick size with floating-point stabilization
 */
export function roundToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  const factor = 1 / tickSize;
  return Math.round((price + Number.EPSILON) * factor) / factor;
}

/**
 * Converts a start time string "HH:MM" plus minutes offset into formatted "HH:MM:SS"
 */
export function formatTimeFromStart(startTime: string = '09:15', minutesOffset: number = 0): string {
  const parts = startTime.split(':').map((p) => parseInt(p, 10));
  const baseHours = isNaN(parts[0]) ? 9 : parts[0];
  const baseMinutes = isNaN(parts[1]) ? 15 : parts[1];

  const totalMinutes = baseHours * 60 + baseMinutes + minutesOffset;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = Math.floor(totalMinutes % 60);
  const secs = Math.floor((minutesOffset % 1) * 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

/**
 * Calculates per-minute ₹ standard deviation sigma_min from annualized percentage volatility
 */
export function calculateSigmaPerMin(annualizedVolPct: number, spotPrice: number): number {
  if (annualizedVolPct <= 0 || spotPrice <= 0) return 1e-4;
  const annualVol = annualizedVolPct / 100;
  const dailyVol = annualVol / Math.sqrt(252);
  const minVolPct = dailyVol / Math.sqrt(375);
  return Math.max(1e-5, spotPrice * minVolPct);
}

/**
 * Solves discrete Almgren-Chriss velocity kappa (min^-1)
 */
export function calculateKappa(lambda: number, sigmaMin: number, eta: number, tau: number = 5): number {
  if (lambda <= 0 || sigmaMin <= 0 || eta <= 0 || tau <= 0) return 0;
  const argDelta = (lambda * sigmaMin * sigmaMin * tau * tau) / (2 * eta);
  if (argDelta > 1e-12) {
    return Math.acosh(1 + argDelta) / tau;
  }
  return Math.sqrt((lambda * sigmaMin * sigmaMin) / eta);
}

/**
 * Calculates liquidation half-life in minutes t_1/2 = ln(2) / kappa
 */
export function calculateOptimalHalfLife(kappa: number, horizonMin?: number): number {
  if (kappa <= 1e-8) return horizonMin ? horizonMin / 2.0 : 999.0;
  return Math.round((Math.LN2 / kappa) * 10) / 10;
}

/**
 * Calculates holdings at continuous time t in [0, T]
 */
export function calculateHoldingsAtTime(t: number, X: number, T: number, kappa: number): number {
  if (t <= 0) return X;
  if (t >= T) return 0;
  const kT = kappa * T;
  if (kT < 1e-4) return X * (1 - t / T);
  if (kT > 50) return X * Math.exp(-kappa * t);
  return X * (Math.sinh(kappa * (T - t)) / Math.sinh(kT));
}

/**
 * Normalizes input volatility to per-minute ₹ standard deviation sigma_min
 * If volatility < 1.0, assumes annualized percentage volatility (e.g. 0.14 = 14%)
 * Annual trading days = 252, trading minutes per day = 375 (09:15 - 15:30)
 */
export function normalizePerMinuteSigma(volatility: number, initialPrice: number): number {
  if (volatility <= 0) return 1e-4;
  if (volatility < 1.0) {
    return calculateSigmaPerMin(volatility * 100, initialPrice);
  }
  return volatility;
}

/**
 * Allocates integer shares rounded to lotSize so that sum(slices) === totalShares
 * Preserves the relative shape of ideal continuous shares using the Hamilton-Hare largest remainder method.
 */
export function allocateLots(idealSlices: number[], totalShares: number, lotSize: number): number[] {
  const N = idealSlices.length;
  if (N === 0) return [];
  if (lotSize <= 0) lotSize = 1;

  const totalLots = Math.round(totalShares / lotSize);
  const idealSum = idealSlices.reduce((a, b) => a + b, 0);

  if (idealSum <= 0 || totalLots <= 0) {
    const res = new Array(N).fill(0);
    res[0] = totalShares;
    return res;
  }

  // Convert each slice to raw lots
  const rawLots = idealSlices.map((s) => (s / idealSum) * totalLots);
  const floorLots = rawLots.map((r) => Math.floor(r));
  let allocatedLots = floorLots.reduce((a, b) => a + b, 0);
  let remainderLots = totalLots - allocatedLots;

  // Rank by largest fractional remainder
  const remainders = rawLots.map((r, idx) => ({
    idx,
    fraction: r - floorLots[idx],
  }));
  remainders.sort((a, b) => b.fraction - a.fraction);

  const finalLots = [...floorLots];
  for (let i = 0; i < remainderLots && i < remainders.length; i++) {
    finalLots[remainders[i].idx] += 1;
  }

  // Handle any over-allocation or under-allocation edge cases
  let netAssigned = finalLots.reduce((a, b) => a + b, 0);
  if (netAssigned < totalLots) {
    finalLots[0] += totalLots - netAssigned;
  } else if (netAssigned > totalLots) {
    const excess = netAssigned - totalLots;
    for (let i = finalLots.length - 1; i >= 0 && netAssigned > totalLots; i--) {
      const take = Math.min(finalLots[i], excess);
      finalLots[i] -= take;
      netAssigned -= take;
    }
  }

  return finalLots.map((l) => l * lotSize);
}

/**
 * Evaluates continuous U-curve volume density at given minutes from open t in [0, 375]
 */
function getIntradayVolumeDensity(tMinutesFromOpen: number): number {
  const t = Math.max(0, Math.min(375, tMinutesFromOpen));
  const x = (t - 165) / 165;
  const baseCurve = 1.0 + 1.8 * (x * x);
  const openSurge = t < 60 ? 1.6 * Math.exp(-t / 20) : 0;
  const closeSurge = t > 300 ? 1.4 * Math.exp((t - 375) / 25) : 0;
  return baseCurve + openSurge + closeSurge;
}

/**
 * Resamples the NSE volume curve for an arbitrary start time, horizon, and interval count
 */
export function resampleIntradayVolumeWeights(
  startTime: string = '09:15',
  timeHorizonMin: number,
  numIntervals: number
): number[] {
  if (numIntervals <= 0) return [];
  const parts = startTime.split(':').map((p) => parseInt(p, 10));
  const baseH = isNaN(parts[0]) ? 9 : parts[0];
  const baseM = isNaN(parts[1]) ? 15 : parts[1];
  const startMinutesFromOpen = (baseH - 9) * 60 + (baseM - 15);

  const tau = timeHorizonMin / numIntervals;
  const rawDensities: number[] = [];

  for (let i = 0; i < numIntervals; i++) {
    const midPoint = startMinutesFromOpen + (i + 0.5) * tau;
    rawDensities.push(getIntradayVolumeDensity(midPoint));
  }

  const sum = rawDensities.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return new Array(numIntervals).fill(1 / numIntervals);
  }
  return rawDensities.map((d) => d / sum);
}

// ============================================================================
// 4. CORE ALMGREN-CHRISS TRAJECTORY SOLVER
// ============================================================================

/**
 * Solves the discrete Almgren-Chriss (2000) optimal trajectory
 * Minimizes expected execution cost E[x] + lambda * V[x]
 *
 * Closed form:
 * cosh(kappa * tau) = 1 + (lambda * sigma^2 * tau^2) / (2 * eta_tilde)
 * x_j = X * sinh(kappa * (N - j) * tau) / sinh(kappa * N * tau)
 */
export function calculateAlmgrenChrissTrajectory(params: AlmgrenChrissParams): TrajectoryComparison {
  const {
    totalShares,
    timeHorizonMin,
    numIntervals,
    volatility,
    riskAversionLambda,
    permanentImpactGamma,
    temporaryImpactEta,
    fixedCostEpsilon,
    initialPrice,
    tickSize,
    lotSize,
    side = 'SELL',
    startTime = '09:15',
  } = params;

  if (totalShares <= 0 || numIntervals <= 0 || timeHorizonMin <= 0) {
    return {
      strategy: 'ALMGREN_CHRISS',
      totalCost: 0,
      implementationShortfallBps: 0,
      timingRiskVariance: 0,
      utilityLoss: 0,
      steps: [],
    };
  }

  const N = Math.max(1, Math.round(numIntervals));
  const T = Math.max(1, timeHorizonMin);
  const tau = T / N;
  const sigmaMin = normalizePerMinuteSigma(volatility, initialPrice);

  const etaTildeRaw = temporaryImpactEta - 0.5 * permanentImpactGamma * tau;
  const etaTilde = Math.max(1e-9, etaTildeRaw > 0 ? etaTildeRaw : temporaryImpactEta);

  const kappa = calculateKappa(riskAversionLambda, sigmaMin, etaTilde, tau);

  // Generate ideal continuous inventory trajectory x_j
  const idealX: number[] = new Array(N + 1);
  idealX[0] = totalShares;
  idealX[N] = 0;

  if (kappa < 1e-7 || Math.abs(kappa * T) < 1e-7) {
    for (let j = 1; j < N; j++) {
      idealX[j] = totalShares * (1 - j / N);
    }
  } else {
    const sinhDenom = Math.sinh(kappa * T);
    for (let j = 1; j < N; j++) {
      const remainingTime = T - j * tau;
      idealX[j] = totalShares * (Math.sinh(kappa * remainingTime) / sinhDenom);
    }
  }

  // Derive ideal trade sizes n_j = x_{j-1} - x_j
  const idealTrades: number[] = [];
  for (let j = 1; j <= N; j++) {
    idealTrades.push(Math.max(0, idealX[j - 1] - idealX[j]));
  }

  const tradeShares = allocateLots(idealTrades, totalShares, lotSize);

  const steps: ExecutionScheduleStep[] = [];
  let currentInventory = totalShares;
  let currentPrevPrice = initialPrice;
  let cumulativePermImpact = 0;
  let totalCost = 0;
  let totalVariance = 0;

  const isBuy = side === 'BUY';
  const priceSign = isBuy ? 1 : -1;

  for (let k = 1; k <= N; k++) {
    const sliceQty = tradeShares[k - 1];
    const tradeRate = tau > 0 ? sliceQty / tau : 0;
    currentInventory -= sliceQty;

    const stepPermImpact = permanentImpactGamma * sliceQty;
    cumulativePermImpact += stepPermImpact;

    const stepTempImpact = temporaryImpactEta * tradeRate;

    const effectivePriceRaw =
      currentPrevPrice + priceSign * (0.5 * stepPermImpact + stepTempImpact + fixedCostEpsilon);
    const executionPrice = roundToTick(effectivePriceRaw, tickSize);

    const stepImpactCost = isBuy
      ? (executionPrice - initialPrice) * sliceQty
      : (initialPrice - executionPrice) * sliceQty;

    const stepVariance = sigmaMin * sigmaMin * tau * currentInventory * currentInventory;

    totalCost += stepImpactCost;
    totalVariance += stepVariance;

    const timestamp = formatTimeFromStart(startTime, k * tau);

    steps.push({
      intervalIndex: k,
      timestamp,
      tradeShares: sliceQty,
      remainingShares: Math.max(0, currentInventory),
      tradeRate: Math.round(tradeRate * 100) / 100,
      priceBeforeTrade: roundToTick(currentPrevPrice, tickSize),
      executionPrice,
      permanentImpact: Math.round(cumulativePermImpact * 1000) / 1000,
      temporaryImpact: Math.round(stepTempImpact * 1000) / 1000,
      expectedCost: Math.round(stepImpactCost * 100) / 100,
      varianceRisk: Math.round(stepVariance * 100) / 100,
    });

    currentPrevPrice += priceSign * stepPermImpact;
  }

  const notional = totalShares * initialPrice;
  const isBps = notional > 0 ? (totalCost / notional) * 10000 : 0;
  const utilityLoss = totalCost + riskAversionLambda * totalVariance;

  return {
    strategy: 'ALMGREN_CHRISS',
    totalCost: Math.round(totalCost * 100) / 100,
    implementationShortfallBps: Math.round(isBps * 100) / 100,
    timingRiskVariance: Math.round(totalVariance * 100) / 100,
    utilityLoss: Math.round(utilityLoss * 100) / 100,
    steps,
  };
}

// ============================================================================
// 5. BENCHMARK TWAP TRAJECTORY
// ============================================================================

/**
 * Calculates uniform Time-Weighted Average Price (TWAP) execution schedule
 */
export function calculateTWAPTrajectory(params: AlmgrenChrissParams): TrajectoryComparison {
  const {
    totalShares,
    timeHorizonMin,
    numIntervals,
    volatility,
    riskAversionLambda,
    permanentImpactGamma,
    temporaryImpactEta,
    fixedCostEpsilon,
    initialPrice,
    tickSize,
    lotSize,
    side = 'SELL',
    startTime = '09:15',
  } = params;

  if (totalShares <= 0 || numIntervals <= 0 || timeHorizonMin <= 0) {
    return {
      strategy: 'TWAP',
      totalCost: 0,
      implementationShortfallBps: 0,
      timingRiskVariance: 0,
      utilityLoss: 0,
      steps: [],
    };
  }

  const N = Math.max(1, Math.round(numIntervals));
  const T = Math.max(1, timeHorizonMin);
  const tau = T / N;
  const sigmaMin = normalizePerMinuteSigma(volatility, initialPrice);

  const idealTrades = new Array(N).fill(totalShares / N);
  const tradeShares = allocateLots(idealTrades, totalShares, lotSize);

  const steps: ExecutionScheduleStep[] = [];
  let currentInventory = totalShares;
  let currentPrevPrice = initialPrice;
  let cumulativePermImpact = 0;
  let totalCost = 0;
  let totalVariance = 0;

  const isBuy = side === 'BUY';
  const priceSign = isBuy ? 1 : -1;

  for (let k = 1; k <= N; k++) {
    const sliceQty = tradeShares[k - 1];
    const tradeRate = tau > 0 ? sliceQty / tau : 0;
    currentInventory -= sliceQty;

    const stepPermImpact = permanentImpactGamma * sliceQty;
    cumulativePermImpact += stepPermImpact;
    const stepTempImpact = temporaryImpactEta * tradeRate;

    const effectivePriceRaw =
      currentPrevPrice + priceSign * (0.5 * stepPermImpact + stepTempImpact + fixedCostEpsilon);
    const executionPrice = roundToTick(effectivePriceRaw, tickSize);

    const stepImpactCost = isBuy
      ? (executionPrice - initialPrice) * sliceQty
      : (initialPrice - executionPrice) * sliceQty;

    const stepVariance = sigmaMin * sigmaMin * tau * currentInventory * currentInventory;

    totalCost += stepImpactCost;
    totalVariance += stepVariance;

    const timestamp = formatTimeFromStart(startTime, k * tau);

    steps.push({
      intervalIndex: k,
      timestamp,
      tradeShares: sliceQty,
      remainingShares: Math.max(0, currentInventory),
      tradeRate: Math.round(tradeRate * 100) / 100,
      priceBeforeTrade: roundToTick(currentPrevPrice, tickSize),
      executionPrice,
      permanentImpact: Math.round(cumulativePermImpact * 1000) / 1000,
      temporaryImpact: Math.round(stepTempImpact * 1000) / 1000,
      expectedCost: Math.round(stepImpactCost * 100) / 100,
      varianceRisk: Math.round(stepVariance * 100) / 100,
    });

    currentPrevPrice += priceSign * stepPermImpact;
  }

  const notional = totalShares * initialPrice;
  const isBps = notional > 0 ? (totalCost / notional) * 10000 : 0;
  const utilityLoss = totalCost + riskAversionLambda * totalVariance;

  return {
    strategy: 'TWAP',
    totalCost: Math.round(totalCost * 100) / 100,
    implementationShortfallBps: Math.round(isBps * 100) / 100,
    timingRiskVariance: Math.round(totalVariance * 100) / 100,
    utilityLoss: Math.round(utilityLoss * 100) / 100,
    steps,
  };
}

// ============================================================================
// 6. BENCHMARK VWAP TRAJECTORY
// ============================================================================

/**
 * Calculates Volume-Weighted Average Price (VWAP) execution schedule
 */
export function calculateVWAPTrajectory(
  params: AlmgrenChrissParams,
  volumeProfile?: VolumeProfileBucket[]
): TrajectoryComparison {
  const {
    totalShares,
    timeHorizonMin,
    numIntervals,
    volatility,
    riskAversionLambda,
    permanentImpactGamma,
    temporaryImpactEta,
    fixedCostEpsilon,
    initialPrice,
    tickSize,
    lotSize,
    side = 'SELL',
    startTime = '09:15',
  } = params;

  if (totalShares <= 0 || numIntervals <= 0 || timeHorizonMin <= 0) {
    return {
      strategy: 'VWAP',
      totalCost: 0,
      implementationShortfallBps: 0,
      timingRiskVariance: 0,
      utilityLoss: 0,
      steps: [],
    };
  }

  const N = Math.max(1, Math.round(numIntervals));
  const T = Math.max(1, timeHorizonMin);
  const tau = T / N;
  const sigmaMin = normalizePerMinuteSigma(volatility, initialPrice);

  let weights: number[];
  if (volumeProfile && volumeProfile.length === N) {
    const sum = volumeProfile.reduce((acc, p) => acc + p.volumeFraction, 0);
    weights = volumeProfile.map((p) => (sum > 0 ? p.volumeFraction / sum : 1 / N));
  } else {
    weights = resampleIntradayVolumeWeights(startTime, T, N);
  }

  const idealTrades = weights.map((w) => totalShares * w);
  const tradeShares = allocateLots(idealTrades, totalShares, lotSize);

  const steps: ExecutionScheduleStep[] = [];
  let currentInventory = totalShares;
  let currentPrevPrice = initialPrice;
  let cumulativePermImpact = 0;
  let totalCost = 0;
  let totalVariance = 0;

  const isBuy = side === 'BUY';
  const priceSign = isBuy ? 1 : -1;

  for (let k = 1; k <= N; k++) {
    const sliceQty = tradeShares[k - 1];
    const tradeRate = tau > 0 ? sliceQty / tau : 0;
    currentInventory -= sliceQty;

    const stepPermImpact = permanentImpactGamma * sliceQty;
    cumulativePermImpact += stepPermImpact;
    const stepTempImpact = temporaryImpactEta * tradeRate;

    const effectivePriceRaw =
      currentPrevPrice + priceSign * (0.5 * stepPermImpact + stepTempImpact + fixedCostEpsilon);
    const executionPrice = roundToTick(effectivePriceRaw, tickSize);

    const stepImpactCost = isBuy
      ? (executionPrice - initialPrice) * sliceQty
      : (initialPrice - executionPrice) * sliceQty;

    const stepVariance = sigmaMin * sigmaMin * tau * currentInventory * currentInventory;

    totalCost += stepImpactCost;
    totalVariance += stepVariance;

    const timestamp = formatTimeFromStart(startTime, k * tau);

    steps.push({
      intervalIndex: k,
      timestamp,
      tradeShares: sliceQty,
      remainingShares: Math.max(0, currentInventory),
      tradeRate: Math.round(tradeRate * 100) / 100,
      priceBeforeTrade: roundToTick(currentPrevPrice, tickSize),
      executionPrice,
      permanentImpact: Math.round(cumulativePermImpact * 1000) / 1000,
      temporaryImpact: Math.round(stepTempImpact * 1000) / 1000,
      expectedCost: Math.round(stepImpactCost * 100) / 100,
      varianceRisk: Math.round(stepVariance * 100) / 100,
    });

    currentPrevPrice += priceSign * stepPermImpact;
  }

  const notional = totalShares * initialPrice;
  const isBps = notional > 0 ? (totalCost / notional) * 10000 : 0;
  const utilityLoss = totalCost + riskAversionLambda * totalVariance;

  return {
    strategy: 'VWAP',
    totalCost: Math.round(totalCost * 100) / 100,
    implementationShortfallBps: Math.round(isBps * 100) / 100,
    timingRiskVariance: Math.round(totalVariance * 100) / 100,
    utilityLoss: Math.round(utilityLoss * 100) / 100,
    steps,
  };
}

// ============================================================================
// 7. PEROLD IMPLEMENTATION SHORTFALL DECOMPOSITION
// ============================================================================

/**
 * Calculates Perold (1988) Implementation Shortfall decomposed into:
 * 1. Permanent Price Impact (adverse drift caused by trade footprint)
 * 2. Temporary Price Impact (instantaneous liquidity concession)
 * 3. Timing Risk / Market Drift (exogenous price movement while unexecuted)
 * 4. Fixed Cost / Spread Friction (half-spread epsilon)
 * 5. Opportunity Cost (unexecuted shares)
 */
export function calculateImplementationShortfall(
  initialPrice: number,
  actualFills: ActualExecutionFill[],
  totalShares: number,
  options?: {
    side?: ExecutionSide;
    gamma?: number;
    eta?: number;
    epsilon?: number;
    tauMin?: number;
    sigma?: number;
  }
): ImplementationShortfallDecomposition {
  const side = options?.side ?? 'SELL';
  const gamma = options?.gamma ?? 2.5e-6;
  const eta = options?.eta ?? 1.8e-5;
  const epsilon = options?.epsilon ?? 0.5;
  const tauMin = options?.tauMin ?? 5;
  const isBuy = side === 'BUY';

  const totalNotional = totalShares * initialPrice;

  if (!actualFills || actualFills.length === 0 || totalShares <= 0) {
    return {
      arrivalPrice: initialPrice,
      averageExecutionPrice: 0,
      totalShares,
      executedShares: 0,
      unexecutedShares: totalShares,
      totalNotional,
      executedNotional: 0,
      totalShortfall: 0,
      shortfallBps: 0,
      permanentImpactCost: 0,
      permanentImpactBps: 0,
      temporaryImpactCost: 0,
      temporaryImpactBps: 0,
      timingRiskCost: 0,
      timingRiskBps: 0,
      fixedCost: 0,
      fixedCostBps: 0,
      opportunityCost: 0,
      opportunityCostBps: 0,
    };
  }

  let totalExecutedShares = 0;
  let totalGrossExecutedCash = 0;

  for (const fill of actualFills) {
    totalExecutedShares += fill.shares;
    totalGrossExecutedCash += fill.shares * fill.executionPrice;
  }

  const unexecutedShares = Math.max(0, totalShares - totalExecutedShares);
  const averageExecutionPrice =
    totalExecutedShares > 0 ? totalGrossExecutedCash / totalExecutedShares : 0;
  const executedNotional = totalExecutedShares * initialPrice;

  const executionShortfall = isBuy
    ? totalGrossExecutedCash - executedNotional
    : executedNotional - totalGrossExecutedCash;

  const permanentImpactCost = 0.5 * gamma * totalExecutedShares * totalExecutedShares;

  let temporaryImpactCost = 0;
  for (const fill of actualFills) {
    const rate = tauMin > 0 ? fill.shares / tauMin : fill.shares;
    temporaryImpactCost += eta * fill.shares * rate;
  }

  const fixedCost = epsilon * totalExecutedShares;

  const modeledImpact = permanentImpactCost + temporaryImpactCost + fixedCost;
  const timingRiskCost = Math.max(0, executionShortfall - modeledImpact);

  const lastFillPrice = actualFills[actualFills.length - 1]?.executionPrice ?? initialPrice;
  const opportunityPriceDiff = isBuy
    ? Math.max(0, lastFillPrice - initialPrice)
    : Math.max(0, initialPrice - lastFillPrice);
  const opportunityCost = unexecutedShares * opportunityPriceDiff;

  const grossShortfall = executionShortfall + opportunityCost;
  const toBps = (cost: number) => (totalNotional > 0 ? (cost / totalNotional) * 10000 : 0);

  return {
    arrivalPrice: initialPrice,
    averageExecutionPrice: Math.round(averageExecutionPrice * 100) / 100,
    totalShares,
    executedShares: totalExecutedShares,
    unexecutedShares,
    totalNotional: Math.round(totalNotional * 100) / 100,
    executedNotional: Math.round(executedNotional * 100) / 100,
    totalShortfall: Math.round(grossShortfall * 100) / 100,
    shortfallBps: Math.round(toBps(grossShortfall) * 100) / 100,
    permanentImpactCost: Math.round(permanentImpactCost * 100) / 100,
    permanentImpactBps: Math.round(toBps(permanentImpactCost) * 100) / 100,
    temporaryImpactCost: Math.round(temporaryImpactCost * 100) / 100,
    temporaryImpactBps: Math.round(toBps(temporaryImpactCost) * 100) / 100,
    timingRiskCost: Math.round(timingRiskCost * 100) / 100,
    timingRiskBps: Math.round(toBps(timingRiskCost) * 100) / 100,
    fixedCost: Math.round(fixedCost * 100) / 100,
    fixedCostBps: Math.round(toBps(fixedCost) * 100) / 100,
    opportunityCost: Math.round(opportunityCost * 100) / 100,
    opportunityCostBps: Math.round(toBps(opportunityCost) * 100) / 100,
  };
}

// ============================================================================
// 8. 1-CLICK EXECUTION ACTIONS & STATE MACHINE
// ============================================================================

/**
 * Initializes a clean execution tracking state machine
 */
export function createInitialExecutionState(params: AlmgrenChrissParams): AlmgrenChrissState {
  return {
    status: 'IDLE',
    params,
    currentInterval: 0,
    totalIntervals: params.numIntervals,
    executedShares: 0,
    remainingShares: params.totalShares,
    executedNotional: 0,
    averageExecutionPrice: 0,
    currentShortfallBps: 0,
    isAccelerated: false,
    activeStrategy: 'ALMGREN_CHRISS',
    activityLog: [
      `[${formatTimeFromStart(params.startTime, 0)}] Engine initialized for ${params.ticker ?? 'ASSET'} (${params.totalShares.toLocaleString()} shares, ${params.numIntervals} slices).`,
    ],
  };
}

/**
 * Applies 1-Click execution actions to the active state machine:
 * - EXECUTE_TRAJECTORY: Launches or unpauses scheduled slice execution
 * - ACCELERATE_AGGRESSIVE: Front-loads remaining inventory via 3.5x risk aversion multiplier
 * - PAUSE_EXECUTION: Suspends scheduled child order routing
 * - RESET_SCHEDULE: Resets progress back to interval 0 and full initial shares
 */
export function applyExecutionAction(
  currentState: AlmgrenChrissState,
  action: AlmgrenChrissAction,
  params: AlmgrenChrissParams
): AlmgrenChrissState {
  const timestamp = formatTimeFromStart(params.startTime, currentState.currentInterval * (params.timeHorizonMin / params.numIntervals));
  const newLogs = [...currentState.activityLog];

  switch (action) {
    case 'EXECUTE_TRAJECTORY': {
      newLogs.push(`[${timestamp}] 1-Click Action: EXECUTE_TRAJECTORY triggered. Active order routing engaged.`);
      return {
        ...currentState,
        status: 'EXECUTING',
        params,
        lastAction: 'EXECUTE_TRAJECTORY',
        lastActionTimestamp: timestamp,
        activityLog: newLogs,
      };
    }

    case 'ACCELERATE_AGGRESSIVE': {
      const acceleratedLambda = params.riskAversionLambda * 3.5;
      newLogs.push(
        `[${timestamp}] 1-Click Action: ACCELERATE_AGGRESSIVE triggered! Risk aversion lambda boosted from ${params.riskAversionLambda.toExponential(2)} to ${acceleratedLambda.toExponential(2)}. Slicing front-loaded.`
      );
      return {
        ...currentState,
        status: 'ACCELERATED',
        isAccelerated: true,
        params: {
          ...params,
          riskAversionLambda: acceleratedLambda,
        },
        lastAction: 'ACCELERATE_AGGRESSIVE',
        lastActionTimestamp: timestamp,
        activityLog: newLogs,
      };
    }

    case 'PAUSE_EXECUTION': {
      newLogs.push(`[${timestamp}] 1-Click Action: PAUSE_EXECUTION triggered. Order slicing suspended at interval ${currentState.currentInterval}/${currentState.totalIntervals}.`);
      return {
        ...currentState,
        status: 'PAUSED',
        lastAction: 'PAUSE_EXECUTION',
        lastActionTimestamp: timestamp,
        activityLog: newLogs,
      };
    }

    case 'RESET_SCHEDULE': {
      newLogs.push(`[${timestamp}] 1-Click Action: RESET_SCHEDULE triggered. State reset to interval 0.`);
      return {
        ...createInitialExecutionState(params),
        lastAction: 'RESET_SCHEDULE',
        lastActionTimestamp: timestamp,
        activityLog: newLogs,
      };
    }

    default:
      return currentState;
  }
}

// ============================================================================
// 9. TOP-LEVEL ANALYTICS SUMMARY BRIDGE
// ============================================================================

/**
 * Top-level dashboard summary engine
 */
export function getAlmgrenChrissSummary(params: AlmgrenChrissParams): AlmgrenChrissSummary {
  const acTraj = calculateAlmgrenChrissTrajectory(params);
  const twapTraj = calculateTWAPTrajectory(params);
  const vwapTraj = calculateVWAPTrajectory(params);

  const T = Math.max(1, params.timeHorizonMin);
  const N = Math.max(1, params.numIntervals);
  const tau = T / N;
  const sigmaMin = normalizePerMinuteSigma(params.volatility, params.initialPrice);
  const etaTilde = Math.max(1e-9, params.temporaryImpactEta - 0.5 * params.permanentImpactGamma * tau);
  const optimalKappa = calculateKappa(params.riskAversionLambda, sigmaMin, etaTilde, tau);
  const halfLifeMin = calculateOptimalHalfLife(optimalKappa);

  const costSavingsVsTwap = Math.round((twapTraj.totalCost - acTraj.totalCost) * 100) / 100;
  const costSavingsVsTwapBps =
    Math.round((twapTraj.implementationShortfallBps - acTraj.implementationShortfallBps) * 100) / 100;

  const riskReductionVsTwapPct =
    twapTraj.timingRiskVariance > 0
      ? Math.round(
          ((twapTraj.timingRiskVariance - acTraj.timingRiskVariance) /
            twapTraj.timingRiskVariance) *
            10000
        ) / 100
      : 0;

  const simulatedFills: ActualExecutionFill[] = acTraj.steps.map((s: ExecutionScheduleStep) => ({
    intervalIndex: s.intervalIndex,
    timestamp: s.timestamp,
    shares: s.tradeShares,
    executionPrice: s.executionPrice,
    benchmarkPrice: s.priceBeforeTrade,
  }));

  const isDecomposition = calculateImplementationShortfall(
    params.initialPrice,
    simulatedFills,
    params.totalShares,
    {
      side: params.side,
      gamma: params.permanentImpactGamma,
      eta: params.temporaryImpactEta,
      epsilon: params.fixedCostEpsilon,
      tauMin: tau,
      sigma: sigmaMin,
    }
  );

  return {
    params,
    optimalKappa: Math.round(optimalKappa * 10000) / 10000,
    halfLifeMin: Math.round(halfLifeMin * 10) / 10,
    almgrenChrissTrajectory: acTraj,
    twapTrajectory: twapTraj,
    vwapTrajectory: vwapTraj,
    costSavingsVsTwap,
    costSavingsVsTwapBps,
    riskReductionVsTwapPct,
    isDecomposition,
  };
}

/**
 * Generates simulated fills with optional stochastic price noise
 */
export function generateSimulatedFills(
  steps: ExecutionScheduleStep[],
  noiseTickMultiplier: number = 0
): ActualExecutionFill[] {
  return steps.map((step: ExecutionScheduleStep, idx: number) => {
    const noiseTicks =
      noiseTickMultiplier !== 0 ? Math.sin((idx + 1) * 1.618) * noiseTickMultiplier * 0.05 : 0;
    const executionPrice = Math.round((step.executionPrice + noiseTicks) * 100) / 100;

    return {
      intervalIndex: step.intervalIndex,
      timestamp: step.timestamp,
      shares: step.tradeShares,
      executionPrice,
      benchmarkPrice: step.priceBeforeTrade,
    };
  });
}

// ============================================================================
// 10. UI COCKPIT BRIDGES & DATA ADAPTERS
// ============================================================================

/**
 * Converts ACModelParameters to AlmgrenChrissParams
 */
export function convertModelParams(params: ACModelParameters): AlmgrenChrissParams {
  const cfg = AC_TICKER_CONFIGS[params.ticker];
  return {
    totalShares: params.orderSize,
    timeHorizonMin: params.horizonMinutes,
    numIntervals: params.numSlices,
    volatility: params.volatilityAnnualPct / 100,
    riskAversionLambda: params.riskAversionLambda,
    permanentImpactGamma: params.permImpactGamma,
    temporaryImpactEta: params.tempImpactEta,
    fixedCostEpsilon: 0.1,
    initialPrice: params.arrivalPrice,
    tickSize: cfg?.tickSize ?? 0.05,
    lotSize: cfg?.lotSize ?? 1,
    side: params.orderSide,
    ticker: params.ticker,
    startTime: '09:15',
  };
}

/**
 * Generates trajectory points for UI multi-model SVG comparison chart
 */
export function generateTrajectoryPoints(params: ACModelParameters): ACTrajectoryPoint[] {
  const acParams = convertModelParams(params);
  const acTraj = calculateAlmgrenChrissTrajectory(acParams);
  const twapTraj = calculateTWAPTrajectory(acParams);
  const vwapTraj = calculateVWAPTrajectory(acParams);

  const N = params.numSlices;
  const tau = params.horizonMinutes / N;
  const points: ACTrajectoryPoint[] = [];

  // Initial Point at t = 0
  points.push({
    sliceIndex: 0,
    timeMin: 0,
    timeLabel: '09:15',
    acHoldings: params.orderSize,
    twapHoldings: params.orderSize,
    vwapHoldings: params.orderSize,
    acTradeQty: 0,
    twapTradeQty: 0,
    vwapTradeQty: 0,
    acHoldingsPct: 100,
    twapHoldingsPct: 100,
    vwapHoldingsPct: 100,
  });

  for (let k = 1; k <= N; k++) {
    const acStep = acTraj.steps[k - 1];
    const twapStep = twapTraj.steps[k - 1];
    const vwapStep = vwapTraj.steps[k - 1];

    const acHoldings = acStep ? acStep.remainingShares : 0;
    const twapHoldings = twapStep ? twapStep.remainingShares : 0;
    const vwapHoldings = vwapStep ? vwapStep.remainingShares : 0;

    points.push({
      sliceIndex: k,
      timeMin: Math.round(k * tau * 10) / 10,
      timeLabel: acStep ? acStep.timestamp.slice(0, 5) : formatTimeFromStart('09:15', k * tau).slice(0, 5),
      acHoldings,
      twapHoldings,
      vwapHoldings,
      acTradeQty: acStep ? acStep.tradeShares : 0,
      twapTradeQty: twapStep ? twapStep.tradeShares : 0,
      vwapTradeQty: vwapStep ? vwapStep.tradeShares : 0,
      acHoldingsPct: Math.round((acHoldings / params.orderSize) * 100),
      twapHoldingsPct: Math.round((twapHoldings / params.orderSize) * 100),
      vwapHoldingsPct: Math.round((vwapHoldings / params.orderSize) * 100),
    });
  }

  return points;
}

/**
 * Generates sliced order step rows for interactive execution monitor table
 */
export function generateSlicedOrderSteps(
  params: ACModelParameters,
  currentExecutionStep: number = 0,
  isPaused: boolean = false
): ACSlicedOrderStep[] {
  const acParams = convertModelParams(params);
  const acTraj = calculateAlmgrenChrissTrajectory(acParams);
  const tau = params.horizonMinutes / params.numSlices;

  let cumulativeQty = 0;

  return acTraj.steps.map((step: ExecutionScheduleStep, idx: number) => {
    const sliceIndex = idx + 1;
    const isFilled = sliceIndex <= currentExecutionStep;
    const isCurrent = sliceIndex === currentExecutionStep + 1;

    const targetQty = step.tradeShares;
    const executedQty = isFilled ? targetQty : 0;
    cumulativeQty += executedQty;

    const remainingQty = Math.max(0, params.orderSize - cumulativeQty);
    const cumulativePct = Math.round((cumulativeQty / params.orderSize) * 100);

    const priceDiff = Math.abs(step.executionPrice - step.priceBeforeTrade);
    const totalImpactBps =
      step.priceBeforeTrade > 0 ? (priceDiff / step.priceBeforeTrade) * 10000 : 0;

    let status: ACSlicedOrderStep['status'] = 'SCHEDULED';
    if (isFilled) {
      status = 'FILLED';
    } else if (isCurrent) {
      status = isPaused ? 'PAUSED' : 'EXECUTING';
    }

    return {
      sliceIndex,
      scheduledTimeMin: Math.round(sliceIndex * tau * 10) / 10,
      timeLabel: step.timestamp.slice(0, 5),
      targetQty,
      executedQty,
      remainingQty,
      cumulativeQty,
      cumulativePct,
      benchmarkPrice: step.priceBeforeTrade,
      fillPrice: step.executionPrice,
      permanentImpactInr: step.permanentImpact,
      temporaryImpactInr: step.temporaryImpact,
      totalImpactBps: Math.round(totalImpactBps * 10) / 10,
      slippageInr: Math.round(priceDiff * 100) / 100,
      status,
    };
  });
}

/**
 * Generates efficient frontier points (cost E[x] vs timing risk standard deviation)
 */
export function generateEfficientFrontier(
  params: ACModelParameters,
  numPoints: number = 25
): ACEfficientFrontierPoint[] {
  const cfg = AC_TICKER_CONFIGS[params.ticker];
  const lotSize = cfg?.lotSize ?? 1;
  const tickSize = cfg?.tickSize ?? 0.05;
  const tau = params.horizonMinutes / params.numSlices;
  const sigmaMin = calculateSigmaPerMin(params.volatilityAnnualPct, params.arrivalPrice);
  const notional = params.orderSize * params.arrivalPrice;

  // Logarithmic grid of risk aversion lambdas from 1e-8 to 5e-4
  const minLog = Math.log10(1e-8);
  const maxLog = Math.log10(5e-4);
  const stepLog = (maxLog - minLog) / (numPoints - 1);

  const points: ACEfficientFrontierPoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const lambdaVal = Math.pow(10, minLog + i * stepLog);

    const stepParams: AlmgrenChrissParams = {
      totalShares: params.orderSize,
      timeHorizonMin: params.horizonMinutes,
      numIntervals: params.numSlices,
      volatility: params.volatilityAnnualPct / 100,
      riskAversionLambda: lambdaVal,
      permanentImpactGamma: params.permImpactGamma,
      temporaryImpactEta: params.tempImpactEta,
      fixedCostEpsilon: 0.1,
      initialPrice: params.arrivalPrice,
      tickSize,
      lotSize,
      side: params.orderSide,
      startTime: '09:15',
    };

    const traj = calculateAlmgrenChrissTrajectory(stepParams);
    const kappa = calculateKappa(lambdaVal, sigmaMin, params.tempImpactEta, tau);
    const halfLifeMin = calculateOptimalHalfLife(kappa);
    const stdDevRiskInr = Math.sqrt(traj.timingRiskVariance);
    const stdDevRiskBps = notional > 0 ? (stdDevRiskInr / notional) * 10000 : 0;

    const isCurrent = Math.abs(Math.log10(lambdaVal) - Math.log10(params.riskAversionLambda)) < 0.12;

    points.push({
      lambda: lambdaVal,
      kappa: Math.round(kappa * 10000) / 10000,
      halfLifeMin: Math.round(halfLifeMin * 10) / 10,
      expectedCostInr: Math.round(traj.totalCost),
      expectedCostBps: Math.round(traj.implementationShortfallBps * 10) / 10,
      varianceRisk: Math.round(traj.timingRiskVariance),
      stdDevRiskInr: Math.round(stdDevRiskInr),
      stdDevRiskBps: Math.round(stdDevRiskBps * 10) / 10,
      utilityScore: Math.round(traj.utilityLoss),
      isCurrent,
      isTWAP: i === 0,
      isAggressive: i === numPoints - 1,
    });
  }

  return points;
}

/**
 * Calculates top metrics strip data for the UI cockpit header
 */
export function calculateACMetricsStrip(params: ACModelParameters): ACMetricsStripData {
  const cfg = AC_TICKER_CONFIGS[params.ticker];
  const lotSize = cfg?.lotSize ?? 1;
  const totalOrderLots = Math.round(params.orderSize / lotSize);
  const tau = params.horizonMinutes / params.numSlices;

  const acParams = convertModelParams(params);
  const acTraj = calculateAlmgrenChrissTrajectory(acParams);
  const twapTraj = calculateTWAPTrajectory(acParams);
  const vwapTraj = calculateVWAPTrajectory(acParams);

  const sigmaMin = calculateSigmaPerMin(params.volatilityAnnualPct, params.arrivalPrice);
  const kappa = calculateKappa(params.riskAversionLambda, sigmaMin, params.tempImpactEta, tau);
  const halfLifeMinutes = calculateOptimalHalfLife(kappa);

  const orderNotionalInr = params.orderSize * params.arrivalPrice;
  const expectedCostInr = Math.round(acTraj.totalCost);
  const expectedCostBps = Math.round(acTraj.implementationShortfallBps * 10) / 10;
  const twapCostInr = Math.round(twapTraj.totalCost);
  const twapCostBps = Math.round(twapTraj.implementationShortfallBps * 10) / 10;
  const vwapCostInr = Math.round(vwapTraj.totalCost);

  const executionSavingsVsTwapInr = Math.max(0, twapCostInr - expectedCostInr);
  const executionSavingsVsTwapBps = Math.max(0, Math.round((twapCostBps - expectedCostBps) * 10) / 10);

  const varianceRiskAC = acTraj.timingRiskVariance;
  const varianceRiskTWAP = twapTraj.timingRiskVariance;
  const stdDevRiskACInr = Math.round(Math.sqrt(varianceRiskAC));
  const stdDevRiskTWAPInr = Math.round(Math.sqrt(varianceRiskTWAP));

  const riskReductionPct =
    varianceRiskTWAP > 0
      ? Math.round(((varianceRiskTWAP - varianceRiskAC) / varianceRiskTWAP) * 1000) / 10
      : 0;

  const permanentImpactInr = Math.round(0.5 * params.permImpactGamma * params.orderSize * params.orderSize);
  const temporaryImpactInr = Math.max(0, expectedCostInr - permanentImpactInr);

  const priceImpactPerShare = params.orderSize > 0 ? expectedCostInr / params.orderSize : 0;
  const effectiveAvgPrice =
    params.orderSide === 'SELL'
      ? Math.round((params.arrivalPrice - priceImpactPerShare) * 100) / 100
      : Math.round((params.arrivalPrice + priceImpactPerShare) * 100) / 100;

  return {
    totalOrderSize: params.orderSize,
    totalOrderLots,
    lotSize,
    horizonMinutes: params.horizonMinutes,
    riskAversionLambda: params.riskAversionLambda,
    kappa: Math.round(kappa * 10000) / 10000,
    halfLifeMinutes,
    expectedCostInr,
    expectedCostBps,
    twapCostInr,
    twapCostBps,
    vwapCostInr,
    executionSavingsVsTwapInr,
    executionSavingsVsTwapBps,
    varianceRiskAC: Math.round(varianceRiskAC),
    varianceRiskTWAP: Math.round(varianceRiskTWAP),
    stdDevRiskACInr,
    stdDevRiskTWAPInr,
    riskReductionPct,
    permanentImpactInr,
    temporaryImpactInr,
    orderNotionalInr: Math.round(orderNotionalInr),
    effectiveAvgPrice,
  };
}
