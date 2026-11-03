/**
 * TradeCraft AI - Multi-Asset Statistical Arbitrage & Cointegration Pairs Trading Engine
 * Sprint 16 - Quantitative Implementation (BRD-016)
 */

import {
  PairDefinition,
  OLSRegressionResult,
  ADFTestResult,
  OrnsteinUhlenbeckResult,
  KalmanState,
  KalmanPoint,
  ZScoreSignal,
  StatutoryHurdleResult,
  PairAnalysisSummary,
  StatArbLeg,
} from '../types/statArb';
import { calculateStatutoryCharges } from './taxEngine';

/**
 * Preloaded Indian Equity & Index Cointegrated Pair Universes (BRD-016 Section 3)
 */
export const PRELOADED_PAIRS: PairDefinition[] = [
  {
    id: 'HDFCBANK_ICICIBANK',
    name: 'HDFCBANK vs ICICIBANK',
    assetY: 'HDFCBANK',
    assetX: 'ICICIBANK',
    sector: 'Private Banking',
    lotSizeY: 250,
    lotSizeX: 350,
    description: 'Premier private sector banking leaders with high balance sheet co-movement.',
  },
  {
    id: 'SBIN_BANKBARODA',
    name: 'SBIN vs BANKBARODA',
    assetY: 'SBIN',
    assetX: 'BANKBARODA',
    sector: 'Public Sector Banking (PSU)',
    lotSizeY: 750,
    lotSizeX: 1250,
    description: 'State-owned banking giants driven by sovereign yields and deposit cycles.',
  },
  {
    id: 'TCS_INFY',
    name: 'TCS vs INFY',
    assetY: 'TCS',
    assetX: 'INFY',
    sector: 'Information Technology',
    lotSizeY: 175,
    lotSizeX: 300,
    description: 'Tier-1 IT exporters exposed to US tech enterprise spending and USD/INR exchange rates.',
  },
  {
    id: 'TATAMOTORS_MM',
    name: 'TATAMOTORS vs M&M',
    assetY: 'TATAMOTORS',
    assetX: 'M&M',
    sector: 'Automobile Manufacturers',
    lotSizeY: 500,
    lotSizeX: 350,
    description: 'Commercial vehicle and passenger SUV co-integration driven by Indian industrial Capex.',
  },
  {
    id: 'BPCL_IOC',
    name: 'BPCL vs IOC',
    assetY: 'BPCL',
    assetX: 'IOC',
    sector: 'Oil & Gas Marketing (OMCs)',
    lotSizeY: 1800,
    lotSizeX: 2500,
    description: 'Refinery and retail fuel marketing companies governed by global crude crack spreads.',
  },
  {
    id: 'NIFTY_BANKNIFTY',
    name: 'NIFTY 50 vs BANKNIFTY',
    assetY: 'NIFTY 50',
    assetX: 'BANKNIFTY',
    sector: 'Exchange Index Ratio',
    lotSizeY: 25,
    lotSizeX: 15,
    description: 'Benchmark Indian headline index vs heavy-weight banking sectoral index.',
  },
];

/**
 * Computes Ordinary Least Squares (OLS) regression between dependent Y and independent X
 * y = alpha + beta * x + epsilon
 */
export function calculateOLSRegression(y: number[], x: number[]): OLSRegressionResult {
  const n = Math.min(y.length, x.length);
  if (n < 2) {
    return { alpha: 0, beta: 1, rSquared: 0, stdError: 0, residuals: [] };
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let covXY = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    covXY += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const beta = varX !== 0 ? covXY / varX : 1.0;
  const alpha = meanY - beta * meanX;

  const residuals: number[] = [];
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const predicted = alpha + beta * x[i];
    const residual = y[i] - predicted;
    residuals.push(residual);
    sse += residual * residual;
  }

  const rSquared = varY > 1e-8 ? Math.max(0, Math.min(1.0, 1.0 - sse / varY)) : 0.85;
  const stdError = Math.sqrt(sse / Math.max(1, n - 2));

  return {
    alpha: Math.round(alpha * 1000) / 1000,
    beta: Math.round(beta * 1000) / 1000,
    rSquared: Math.round(rSquared * 1000) / 1000,
    stdError: Math.round(stdError * 1000) / 1000,
    residuals,
  };
}

/**
 * Augmented Dickey-Fuller (ADF) Test for Stationarity on Residuals (Engle-Granger Step 2)
 * Delta e_t = gamma * e_{t-1} + u_t
 */
export function calculateADFTest(residuals: number[]): ADFTestResult {
  const n = residuals.length;
  if (n < 5) {
    return {
      testStatistic: -1.5,
      criticalValue95: -2.86,
      criticalValue99: -3.43,
      pValue: 0.50,
      isStationary: false,
      isCointegrated: false,
      confidenceLevel: 'NONE',
    };
  }

  // Regression of Delta e_t on e_{t-1}
  let sumProd = 0;
  let sumSqLag = 0;
  const deltaE: number[] = [];
  const lagE: number[] = [];

  for (let t = 1; t < n; t++) {
    const diff = residuals[t] - residuals[t - 1];
    const lag = residuals[t - 1];
    deltaE.push(diff);
    lagE.push(lag);
    sumProd += diff * lag;
    sumSqLag += lag * lag;
  }

  const gamma = sumSqLag !== 0 ? sumProd / sumSqLag : -0.1;

  // Residual variance of ADF regression
  let sse = 0;
  const T = deltaE.length;
  for (let t = 0; t < T; t++) {
    const error = deltaE[t] - gamma * lagE[t];
    sse += error * error;
  }

  const seGamma = Math.sqrt(Math.max(1e-8, sse / Math.max(1, T - 1)) / Math.max(1e-8, sumSqLag));
  const testStatistic = Math.round((gamma / seGamma) * 100) / 100;

  const criticalValue95 = -2.86;
  const criticalValue99 = -3.43;

  let isStationary = false;
  let isCointegrated = false;
  let confidenceLevel: '99%' | '95%' | '90%' | 'NONE' = 'NONE';
  let pValue = 0.50;

  if (testStatistic <= criticalValue99) {
    isStationary = true;
    isCointegrated = true;
    confidenceLevel = '99%';
    pValue = 0.005;
  } else if (testStatistic <= criticalValue95) {
    isStationary = true;
    isCointegrated = true;
    confidenceLevel = '95%';
    pValue = 0.035;
  } else if (testStatistic <= -2.57) {
    isStationary = true;
    isCointegrated = true;
    confidenceLevel = '90%';
    pValue = 0.085;
  } else {
    pValue = Math.min(0.99, Math.round((0.50 + (testStatistic + 2.5) * 0.2) * 100) / 100);
  }

  return {
    testStatistic,
    criticalValue95,
    criticalValue99,
    pValue,
    isStationary,
    isCointegrated,
    confidenceLevel,
  };
}

/**
 * Fits continuous-time Ornstein-Uhlenbeck (OU) Mean-Reverting Process
 * d e_t = theta * (mu - e_t) dt + sigma dW_t
 * Discrete-time AR(1): Delta e_t = a + b * e_{t-1} + eta_t
 * Half-Life: t_{1/2} = ln(2) / theta = -ln(2) / ln(1 + b)
 */
export function calculateOrnsteinUhlenbeck(residuals: number[], dt: number = 1): OrnsteinUhlenbeckResult {
  const n = residuals.length;
  if (n < 4) {
    return { theta: 0.1, halfLife: 7, mu: 0, sigma: 1.0, isMeanReverting: true };
  }

  const deltaE: number[] = [];
  const lagE: number[] = [];
  for (let t = 1; t < n; t++) {
    deltaE.push(residuals[t] - residuals[t - 1]);
    lagE.push(residuals[t - 1]);
  }

  const T = deltaE.length;
  let meanLag = 0;
  let meanDelta = 0;
  for (let i = 0; i < T; i++) {
    meanLag += lagE[i];
    meanDelta += deltaE[i];
  }
  meanLag /= T;
  meanDelta /= T;

  let covLagDelta = 0;
  let varLag = 0;
  for (let i = 0; i < T; i++) {
    const dLag = lagE[i] - meanLag;
    const dDelta = deltaE[i] - meanDelta;
    covLagDelta += dLag * dDelta;
    varLag += dLag * dLag;
  }

  const b = varLag !== 0 ? covLagDelta / varLag : -0.15;
  const a = meanDelta - b * meanLag;

  let theta = 0;
  let halfLife = 0;
  let isMeanReverting = false;

  if (b < 0 && b > -1.0) {
    theta = -Math.log(1 + b) / dt;
    halfLife = Math.log(2) / theta;
    isMeanReverting = true;
  } else if (b <= -1.0) {
    theta = 1.0;
    halfLife = 1.0;
    isMeanReverting = true;
  } else {
    // Non-reverting or explosive series
    theta = 0.001;
    halfLife = 999;
    isMeanReverting = false;
  }

  const mu = b !== 0 ? -a / b : 0;

  // Diffusion volatility sigma
  let sse = 0;
  for (let i = 0; i < T; i++) {
    const err = deltaE[i] - (a + b * lagE[i]);
    sse += err * err;
  }
  const varianceEta = sse / Math.max(1, T - 2);
  const sigma = Math.sqrt(Math.max(1e-8, (varianceEta * 2 * Math.max(0.01, theta)) / (1 - Math.exp(-2 * Math.max(0.01, theta) * dt))));

  return {
    theta: Math.round(theta * 1000) / 1000,
    halfLife: Math.round(halfLife * 10) / 10,
    mu: Math.round(mu * 100) / 100,
    sigma: Math.round(sigma * 100) / 100,
    isMeanReverting,
  };
}

/**
 * Recursive State-Space Kalman Filter for Dynamic Time-Varying Hedge Ratio (beta_t)
 * Observation: y_t = alpha_t + beta_t * x_t + v_t
 * State transition: theta_t = theta_{t-1} + w_t
 */
export function runKalmanFilter(
  pricesY: number[],
  pricesX: number[],
  initialBeta: number = 1.0,
  initialAlpha: number = 0.0
): { states: KalmanState[]; points: KalmanPoint[] } {
  const n = Math.min(pricesY.length, pricesX.length);
  const states: KalmanState[] = [];
  const points: KalmanPoint[] = [];

  let alpha = initialAlpha;
  let beta = initialBeta;

  // State covariance 2x2: [P00, P01, P10, P11]
  let P: [number, number, number, number] = [1.0, 0.0, 0.0, 1.0];

  // Process noise Q and measurement noise R
  const qAlpha = 1e-4;
  const qBeta = 1e-3;
  const R = 0.5;

  const rollingSpreads: number[] = [];
  const windowSize = 25;

  for (let t = 0; t < n; t++) {
    const y = pricesY[t];
    const x = pricesX[t];

    // 1. Time Update (Predict)
    // theta_{t|t-1} = theta_{t-1}
    P[0] += qAlpha;
    P[3] += qBeta;

    // 2. Innovation
    const yPred = alpha + beta * x;
    const innovation = y - yPred;

    // Innovation variance: F_t = H * P * H^T + R
    // H = [1, x]
    const F = P[0] + x * P[1] + x * P[2] + x * x * P[3] + R;

    // 3. Kalman Gain: K = P * H^T / F
    const k0 = (P[0] + x * P[1]) / F;
    const k1 = (P[2] + x * P[3]) / F;

    // 4. State Update: theta = theta + K * innovation
    alpha += k0 * innovation;
    beta += k1 * innovation;

    // 5. Covariance Update: P = (I - K*H) * P
    const p00_new = P[0] - k0 * (P[0] + x * P[2]);
    const p01_new = P[1] - k0 * (P[1] + x * P[3]);
    const p10_new = P[2] - k1 * (P[0] + x * P[2]);
    const p11_new = P[3] - k1 * (P[1] + x * P[3]);
    P = [p00_new, p01_new, p10_new, p11_new];

    const currentSpread = y - (alpha + beta * x);
    rollingSpreads.push(currentSpread);

    // Compute rolling window Z-score
    let zScore = 0;
    if (rollingSpreads.length >= 5) {
      const wSlice = rollingSpreads.slice(-windowSize);
      const wMean = wSlice.reduce((sum, v) => sum + v, 0) / wSlice.length;
      const wVar = wSlice.reduce((sum, v) => sum + (v - wMean) * (v - wMean), 0) / wSlice.length;
      const wStd = Math.sqrt(Math.max(1e-6, wVar));
      zScore = Math.round(((currentSpread - wMean) / wStd) * 100) / 100;
    }

    const stateRecord: KalmanState = {
      alpha: Math.round(alpha * 100) / 100,
      beta: Math.round(beta * 1000) / 1000,
      covariance: [...P],
      innovation: Math.round(innovation * 100) / 100,
      innovationVariance: Math.round(F * 100) / 100,
      kalmanGain: [Math.round(k0 * 1000) / 1000, Math.round(k1 * 1000) / 1000],
    };
    states.push(stateRecord);

    points.push({
      barIndex: t,
      priceY: y,
      priceX: x,
      beta: stateRecord.beta,
      alpha: stateRecord.alpha,
      spread: Math.round(currentSpread * 100) / 100,
      zScore,
    });
  }

  return { states, points };
}

/**
 * Generates StatArb Trading Signals from Z-Score and dynamic hedge ratio
 */
export function generateZScoreSignal(
  currentZScore: number,
  pair: PairDefinition,
  beta: number,
  priceY: number,
  priceX: number
): ZScoreSignal {
  const unitsY = pair.lotSizeY;
  const rawUnitsX = Math.round(unitsY * beta);
  // Round to nearest lot size of asset X
  const lotsX = Math.max(1, Math.round(rawUnitsX / pair.lotSizeX));
  const unitsX = lotsX * pair.lotSizeX;

  let signalType: ZScoreSignal['signalType'] = 'NO_SIGNAL';
  let recommendedAction = 'Spread in neutral equilibrium band. No trade active.';
  const legs: StatArbLeg[] = [];

  if (currentZScore <= -2.0 && currentZScore > -3.5) {
    signalType = 'LONG_SPREAD';
    recommendedAction = `Bullish Spread Divergence (z = ${currentZScore.toFixed(2)}): BUY ${pair.assetY} / SELL ${pair.assetX}`;
    legs.push(
      { asset: pair.assetY, side: 'BUY', units: unitsY, price: priceY, notional: unitsY * priceY },
      { asset: pair.assetX, side: 'SELL', units: unitsX, price: priceX, notional: unitsX * priceX }
    );
  } else if (currentZScore >= 2.0 && currentZScore < 3.5) {
    signalType = 'SHORT_SPREAD';
    recommendedAction = `Bearish Spread Divergence (z = +${currentZScore.toFixed(2)}): SELL ${pair.assetY} / BUY ${pair.assetX}`;
    legs.push(
      { asset: pair.assetY, side: 'SELL', units: unitsY, price: priceY, notional: unitsY * priceY },
      { asset: pair.assetX, side: 'BUY', units: unitsX, price: priceX, notional: unitsX * priceX }
    );
  } else if (Math.abs(currentZScore) >= 3.5) {
    signalType = 'STOP_LOSS';
    recommendedAction = `Emergency Stop-Loss Triggered (|z| = ${Math.abs(currentZScore).toFixed(2)} >= 3.5): Structural cointegration breakdown risk. Liquidate legs immediately.`;
  } else if (Math.abs(currentZScore) <= 0.25) {
    signalType = 'EXIT';
    recommendedAction = `Equilibrium Target Reached (|z| = ${Math.abs(currentZScore).toFixed(2)} <= 0.25): Close open pair legs and lock in mean-reversion alpha.`;
  }

  return {
    zScore: currentZScore,
    signalType,
    recommendedAction,
    legs,
  };
}

/**
 * Computes Indian Statutory Tax Drag on 2-leg arbitrage and minimum expected reversion hurdle
 */
export function calculateStatutoryHurdle(
  pair: PairDefinition,
  priceY: number,
  priceX: number,
  unitsY: number,
  unitsX: number
): StatutoryHurdleResult {
  const taxY = calculateStatutoryCharges('BUY', 'MIS', priceY, unitsY);
  const taxX = calculateStatutoryCharges('SELL', 'MIS', priceX, unitsX);

  // Round-trip doubles charges
  const roundTripTaxes = Math.round((taxY.totalCharges + taxX.totalCharges) * 2 * 100) / 100;
  const minSpreadReversionPts = Math.round((roundTripTaxes / Math.max(1, unitsY)) * 100) / 100;
  const grossProfitScenario = unitsY * (minSpreadReversionPts * 2.5);
  const netExpectancyINR = Math.round(grossProfitScenario - roundTripTaxes);

  return {
    roundTripTaxes,
    minSpreadReversionPts,
    hurdleCleared: minSpreadReversionPts < priceY * 0.015,
    netExpectancyINR,
  };
}

/**
 * Generates synthetic cointegrated price series for historical charting and testing
 */
export function generateSyntheticPairPrices(
  pairId: string,
  count: number = 80
): { pricesY: number[]; pricesX: number[]; currentPriceY: number; currentPriceX: number } {
  let baseY = 1750;
  let baseX = 1250;
  let targetBeta = 1.35;

  if (pairId === 'SBIN_BANKBARODA') {
    baseY = 820;
    baseX = 260;
    targetBeta = 3.10;
  } else if (pairId === 'TCS_INFY') {
    baseY = 4120;
    baseX = 1880;
    targetBeta = 2.18;
  } else if (pairId === 'TATAMOTORS_MM') {
    baseY = 990;
    baseX = 2950;
    targetBeta = 0.33;
  } else if (pairId === 'BPCL_IOC') {
    baseY = 320;
    baseX = 175;
    targetBeta = 1.82;
  } else if (pairId === 'NIFTY_BANKNIFTY') {
    baseY = 24900;
    baseX = 52400;
    targetBeta = 0.475;
  }

  const pricesY: number[] = [];
  const pricesX: number[] = [];

  let curX = baseX;
  let curSpread = 0;

  for (let i = 0; i < count; i++) {
    // Shared common random walk driver W_t
    const drift = (Math.sin(i / 8) * 0.004) + (Math.cos(i * 1.5) * 0.002);
    curX = Math.round(curX * (1 + drift) * 100) / 100;

    // Mean-reverting Ornstein-Uhlenbeck spread component
    const ouReversion = -0.18 * curSpread + (Math.sin(i * 2.3) * (baseY * 0.006));
    curSpread += ouReversion;

    // On final bars, introduce an entry-triggering divergence
    if (i >= count - 8) {
      curSpread -= (baseY * 0.008);
    }

    const curY = Math.round((curX * targetBeta + curSpread) * 100) / 100;
    pricesX.push(curX);
    pricesY.push(curY);
  }

  return {
    pricesY,
    pricesX,
    currentPriceY: pricesY[pricesY.length - 1],
    currentPriceX: pricesX[pricesX.length - 1],
  };
}

/**
 * Unified Orchestrator: Analyzes a Pair and returns complete analysis summary
 */
export function analyzePair(
  pair: PairDefinition,
  customY?: number[],
  customX?: number[]
): PairAnalysisSummary {
  let y = customY;
  let x = customX;

  if (!y || !x || y.length < 10) {
    const syn = generateSyntheticPairPrices(pair.id, 80);
    y = syn.pricesY;
    x = syn.pricesX;
  }

  const ols = calculateOLSRegression(y, x);
  const adf = calculateADFTest(ols.residuals);
  const ou = calculateOrnsteinUhlenbeck(ols.residuals);
  const kalman = runKalmanFilter(y, x, ols.beta, ols.alpha);

  const lastPoint = kalman.points[kalman.points.length - 1] || {
    beta: ols.beta,
    alpha: ols.alpha,
    spread: 0,
    zScore: 0,
    priceY: y[y.length - 1],
    priceX: x[x.length - 1],
    barIndex: y.length - 1,
  };

  const signal = generateZScoreSignal(
    lastPoint.zScore,
    pair,
    lastPoint.beta,
    lastPoint.priceY,
    lastPoint.priceX
  );

  const unitsY = pair.lotSizeY;
  const unitsX = Math.max(1, Math.round((unitsY * lastPoint.beta) / pair.lotSizeX)) * pair.lotSizeX;
  const statutoryHurdle = calculateStatutoryHurdle(
    pair,
    lastPoint.priceY,
    lastPoint.priceX,
    unitsY,
    unitsX
  );

  return {
    pair,
    ols,
    adf,
    ou,
    currentBetaOLS: ols.beta,
    currentBetaKalman: lastPoint.beta,
    currentSpread: lastPoint.spread,
    currentZScore: lastPoint.zScore,
    signal,
    historicalSeries: kalman.points,
    statutoryHurdle,
  };
}
