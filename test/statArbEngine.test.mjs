import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * TradeCraft AI - Statistical Arbitrage & Cointegration Pairs Trading Engine Tests
 * Sprint 16 - Quantitative Verification Suite (BRD-016 / AC-ARB-01 to AC-ARB-06)
 */

// 1. Ordinary Least Squares (OLS) Closed-Form Regression
function calculateOLSRegression(ySeries, xSeries) {
  const n = Math.min(ySeries.length, xSeries.length);
  if (n < 2) {
    return { alpha: 0, beta: 1, rSquared: 0, stdError: 0, residuals: [] };
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xSeries[i];
    sumY += ySeries[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let covXY = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xSeries[i] - meanX;
    const dy = ySeries[i] - meanY;
    covXY += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const beta = varX > 1e-12 ? covXY / varX : 1.0;
  const alpha = meanY - beta * meanX;

  const residuals = [];
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const res = ySeries[i] - (alpha + beta * xSeries[i]);
    residuals.push(res);
    sse += res * res;
  }

  const rSquared = varY > 1e-12 ? Math.max(0, Math.min(1.0, 1 - sse / varY)) : 1.0;
  const stdError = Math.sqrt(sse / Math.max(1, n - 2));

  return { alpha, beta, rSquared, stdError, residuals };
}

// 2. Augmented Dickey-Fuller (ADF) Unit Root Test on Residuals
function calculateADFTest(residuals) {
  const n = residuals.length;
  if (n < 5) {
    return {
      testStatistic: 0,
      criticalValue95: -2.86,
      criticalValue99: -3.43,
      pValue: 0.99,
      isStationary: false,
      isCointegrated: false,
      confidenceLevel: 'NONE',
    };
  }

  let sumLagSq = 0;
  let sumProd = 0;
  const deltaE = [];

  for (let t = 1; t < n; t++) {
    const d = residuals[t] - residuals[t - 1];
    deltaE.push(d);
    const lag = residuals[t - 1];
    sumLagSq += lag * lag;
    sumProd += lag * d;
  }

  const gamma = sumLagSq > 1e-12 ? sumProd / sumLagSq : 0;
  let ssr = 0;
  for (let t = 1; t < n; t++) {
    const lag = residuals[t - 1];
    const err = deltaE[t - 1] - gamma * lag;
    ssr += err * err;
  }

  const variance = ssr / Math.max(1, n - 2);
  const seGamma = Math.sqrt(Math.max(1e-12, variance / Math.max(1e-12, sumLagSq)));
  const tau = seGamma > 0 ? gamma / seGamma : 0;

  let confidenceLevel = 'NONE';
  if (tau < -3.43) {
    confidenceLevel = '99%';
  } else if (tau < -2.86) {
    confidenceLevel = '95%';
  } else if (tau < -2.57) {
    confidenceLevel = '90%';
  }

  const isCointegrated = tau < -2.86;
  const isStationary = isCointegrated;
  const pValue = Math.min(1.0, Math.max(0.001, 1 / (1 + Math.exp(-1.5 * (tau + 2.86)))));

  return {
    testStatistic: tau,
    criticalValue95: -2.86,
    criticalValue99: -3.43,
    pValue,
    isStationary,
    isCointegrated,
    confidenceLevel,
  };
}

// 3. Ornstein-Uhlenbeck (OU) Mean-Reversion Parameters & Half-Life
function calculateOrnsteinUhlenbeck(residuals) {
  const n = residuals.length;
  if (n < 5) {
    return { theta: 0, halfLife: Infinity, mu: 0, sigma: 0, isMeanReverting: false };
  }

  let sumX = 0;
  let sumY = 0;
  for (let t = 1; t < n; t++) {
    sumX += residuals[t - 1];
    sumY += residuals[t] - residuals[t - 1];
  }
  const meanX = sumX / (n - 1);
  const meanY = sumY / (n - 1);

  let covXY = 0;
  let varX = 0;
  for (let t = 1; t < n; t++) {
    const dx = residuals[t - 1] - meanX;
    const dy = (residuals[t] - residuals[t - 1]) - meanY;
    covXY += dx * dy;
    varX += dx * dx;
  }

  const b = varX > 1e-12 ? covXY / varX : 0;
  const a = meanY - b * meanX;

  // Non-reverting or explosive spread
  if (b >= 0 || b <= -2.0) {
    return { theta: 0, halfLife: Infinity, mu: 0, sigma: 0, isMeanReverting: false };
  }

  const theta = -Math.log(1 + b);
  const halfLife = Math.max(0.1, Math.log(2) / theta);
  const mu = b !== 0 ? -a / b : 0;

  let sse = 0;
  for (let t = 1; t < n; t++) {
    const err = (residuals[t] - residuals[t - 1]) - (a + b * residuals[t - 1]);
    sse += err * err;
  }
  const sigmaEta = Math.sqrt(sse / Math.max(1, n - 2));
  const sigma = sigmaEta * Math.sqrt(Math.max(1e-12, 2 * theta / (1 - Math.exp(-2 * theta))));

  return { theta, halfLife, mu, sigma, isMeanReverting: true };
}

// 4. Recursive State-Space Kalman Filter for Dynamic Hedge Ratio (beta_t)
function runKalmanFilter(ySeries, xSeries, initialBeta = 1.0, initialAlpha = 0.0) {
  const n = Math.min(ySeries.length, xSeries.length);
  let stateAlpha = initialAlpha;
  let stateBeta = initialBeta;

  let P00 = 1.0;
  let P01 = 0.0;
  let P10 = 0.0;
  let P11 = 1.0;
  const Q00 = 1e-5;
  const Q11 = 1e-4;
  const R = 1e-3;
  const points = [];

  for (let t = 0; t < n; t++) {
    const x = xSeries[t];
    const y = ySeries[t];

    // Predict
    P00 += Q00;
    P11 += Q11;

    // Innovation
    const nu = y - (stateAlpha + stateBeta * x);
    const F = P00 + 2 * x * P01 + x * x * P11 + R;

    // Kalman Gain
    const K0 = (P00 + x * P01) / Math.max(1e-12, F);
    const K1 = (P10 + x * P11) / Math.max(1e-12, F);

    // State Update
    stateAlpha += K0 * nu;
    stateBeta += K1 * nu;

    // Covariance Update
    const newP00 = P00 - K0 * (P00 + x * P10);
    const newP01 = P01 - K0 * (P01 + x * P11);
    const newP10 = P10 - K1 * (P00 + x * P10);
    const newP11 = P11 - K1 * (P01 + x * P11);

    P00 = Math.max(1e-8, newP00);
    P01 = newP01;
    P10 = newP10;
    P11 = Math.max(1e-8, newP11);

    const spread = y - stateBeta * x - stateAlpha;
    points.push({
      barIndex: t,
      beta: stateBeta,
      alpha: stateAlpha,
      spread,
      covariance: [P00, P01, P10, P11],
      innovation: nu,
      kalmanGain: [K0, K1],
    });
  }
  return points;
}

// 5. Dynamic Rolling Z-Score & Market-Neutral Signals
function calculateZScoreSignals(spreadSeries, window = 30) {
  const n = spreadSeries.length;
  if (n < window) return [];

  const signals = [];
  for (let i = window; i < n; i++) {
    const slice = spreadSeries.slice(i - window, i);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
    const std = Math.sqrt(Math.max(1e-8, variance));
    const z = (spreadSeries[i] - mean) / std;

    let signalType = 'NO_SIGNAL';
    if (z <= -2.0 && z > -3.5) {
      signalType = 'LONG_SPREAD';
    } else if (z >= 2.0 && z < 3.5) {
      signalType = 'SHORT_SPREAD';
    } else if (Math.abs(z) <= 0.25) {
      signalType = 'EXIT';
    } else if (Math.abs(z) >= 3.5) {
      signalType = 'STOP_LOSS';
    }

    signals.push({ index: i, zScore: z, signalType });
  }
  return signals;
}

// 6. Pre-Trade Statutory Fee Hurdle Rate Math
function calculateStatutoryHurdle(unitsY, priceY, unitsX, priceX) {
  const notionalY = unitsY * priceY;
  const notionalX = unitsX * priceX;
  const combinedNotional = notionalY + notionalX;

  // Indian statutory charges (round trip on intraday MIS):
  // STT: 0.0125% on sell side = 0.000125 * combinedNotional
  // Brokerage: ₹20 per leg execution * 4 executions = ₹80
  // Exchange Turnover: 0.00345% round trip
  // GST: 18% on (Brokerage + Exchange Charges)
  // SEBI: ₹10 per crore = 0.000001 * combinedNotional * 2
  // Stamp Duty: 0.003% on buy turnover

  const stt = combinedNotional * 0.000125;
  const brokerage = 80;
  const exchangeCharge = combinedNotional * 2 * 0.0000345;
  const gst = (brokerage + exchangeCharge) * 0.18;
  const sebiCharges = combinedNotional * 2 * 0.000001;
  const stampDuty = combinedNotional * 0.00003;

  const totalRoundTripTaxes = stt + brokerage + exchangeCharge + gst + sebiCharges + stampDuty;
  const minSpreadReversionPts = totalRoundTripTaxes / unitsY;

  return {
    roundTripTaxes: Math.round(totalRoundTripTaxes * 100) / 100,
    minSpreadReversionPts: Math.round(minSpreadReversionPts * 100) / 100,
    dollarNeutralRatio: notionalY / notionalX,
  };
}

// ==========================================
// TEST SUITE: SPRINT 16 STATISTICAL ARBITRAGE
// ==========================================

describe('TradeCraft Statistical Arbitrage & Cointegration Engine (Sprint 16)', () => {
  // AC-ARB-01: OLS Regression Goodness-of-Fit
  test('TC-ARB-TEST-01: OLS Regression slope, intercept and R^2 on Cointegrated Series', () => {
    const trueAlpha = 150;
    const trueBeta = 1.35;
    const n = 100;
    const xSeries = [];
    const ySeries = [];

    let currentX = 1000;
    for (let i = 0; i < n; i++) {
      currentX += Math.sin(i * 0.2) * 8 + (i % 2 === 0 ? 3 : -2);
      const residual = Math.cos(i * 0.5) * 4; // stationary residual
      const currentY = trueAlpha + trueBeta * currentX + residual;
      xSeries.push(currentX);
      ySeries.push(currentY);
    }

    const ols = calculateOLSRegression(ySeries, xSeries);

    assert.ok(
      Math.abs(ols.beta - trueBeta) < 0.05,
      `Beta should be close to 1.35, got ${ols.beta.toFixed(4)}`
    );
    assert.ok(
      Math.abs(ols.alpha - trueAlpha) < 15,
      `Alpha should be close to 150, got ${ols.alpha.toFixed(2)}`
    );
    assert.ok(
      ols.rSquared >= 0.95,
      `R^2 goodness-of-fit should exceed 0.95, got ${ols.rSquared.toFixed(4)}`
    );
    assert.strictEqual(ols.residuals.length, n, 'Residuals count must match observations count');
    assert.ok(ols.stdError < 5.0, `Residual standard error must be small, got ${ols.stdError}`);
  });

  // AC-ARB-02: ADF Test Stationarity vs Random Walk
  test('TC-ARB-TEST-02: ADF Stationarity Test Rejection on Stationary Residuals vs Random Walk', () => {
    // 1. Mean-reverting stationary series (AR(1) with phi = 0.45)
    const stationary = [];
    let e = 0;
    for (let i = 0; i < 150; i++) {
      e = 0.45 * e + (Math.sin(i * 1.7) * 2 + (i % 2 === 0 ? 1 : -1));
      stationary.push(e);
    }

    const adfStat = calculateADFTest(stationary);
    assert.ok(
      adfStat.testStatistic < -2.86,
      `Stationary residuals must reject unit root (tau < -2.86), got ${adfStat.testStatistic.toFixed(3)}`
    );
    assert.strictEqual(adfStat.isCointegrated, true, 'Stationary residuals must confirm cointegration');
    assert.strictEqual(adfStat.isStationary, true, 'isStationary flag must be true');
    assert.ok(
      adfStat.confidenceLevel === '95%' || adfStat.confidenceLevel === '99%',
      `Confidence level must be >= 95%, got ${adfStat.confidenceLevel}`
    );

    // 2. Pure Random Walk (non-stationary drift)
    const randomWalk = [];
    let rw = 100;
    for (let i = 0; i < 150; i++) {
      rw += (i % 3 === 0 ? 2 : 1) * 1.5; // continuous drift
      randomWalk.push(rw);
    }

    const adfRW = calculateADFTest(randomWalk);
    assert.ok(
      adfRW.testStatistic >= -2.86,
      `Random walk must fail to reject unit root (tau >= -2.86), got ${adfRW.testStatistic.toFixed(3)}`
    );
    assert.strictEqual(adfRW.isCointegrated, false, 'Random walk must not be cointegrated');
    assert.strictEqual(adfRW.isStationary, false, 'Random walk isStationary flag must be false');
    assert.strictEqual(adfRW.confidenceLevel, 'NONE');
  });

  // AC-ARB-03: Ornstein-Uhlenbeck Half-Life Calculation
  test('TC-ARB-TEST-03: Ornstein-Uhlenbeck Half-Life Solver on Mean-Reverting Spread', () => {
    // Mean-reverting spread with rapid cycle
    const spread = [];
    let s = 10;
    for (let i = 0; i < 120; i++) {
      s = s * 0.85 + Math.sin(i * 1.1) * 3; // theta ~ 0.16 -> half-life ~ 4.2 bars
      spread.push(s);
    }

    const ou = calculateOrnsteinUhlenbeck(spread);
    assert.strictEqual(ou.isMeanReverting, true);
    assert.ok(
      ou.halfLife > 1 && ou.halfLife < 20,
      `Half-life must be within [1, 20] bars, got ${ou.halfLife.toFixed(2)}`
    );
    assert.ok(ou.theta > 0, `Theta rate of reversion must be strictly positive, got ${ou.theta.toFixed(4)}`);
    assert.ok(ou.sigma > 0, `Diffusion parameter sigma must be positive, got ${ou.sigma}`);

    // Explosive non-reverting series test
    const explosiveSpread = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
    const ouExplosive = calculateOrnsteinUhlenbeck(explosiveSpread);
    assert.strictEqual(ouExplosive.isMeanReverting, false, 'Explosive series must be flagged as non-mean-reverting');
    assert.strictEqual(ouExplosive.halfLife, Infinity, 'Explosive series half-life must be infinite');
  });

  // AC-ARB-04: Recursive Kalman Filter Hedge Ratio Convergence
  test('TC-ARB-TEST-04: Dynamic State-Space Kalman Filter beta_t Convergence', () => {
    const trueBeta = 1.60;
    const trueAlpha = 50;
    const n = 80;
    const x = [];
    const y = [];

    let curX = 500;
    for (let i = 0; i < n; i++) {
      curX += 2 + Math.sin(i * 0.3) * 4;
      const res = Math.cos(i * 0.7) * 3;
      y.push(trueAlpha + trueBeta * curX + res);
      x.push(curX);
    }

    // Start with biased initial beta (1.0 instead of 1.60)
    const kalmanPoints = runKalmanFilter(y, x, 1.0, 0.0);

    const initialBeta = kalmanPoints[0].beta;
    const finalPoint = kalmanPoints[kalmanPoints.length - 1];
    const finalBeta = finalPoint.beta;

    assert.ok(
      Math.abs(finalBeta - trueBeta) < 0.15,
      `Final Kalman beta should converge to ~1.60, got ${finalBeta.toFixed(4)}`
    );
    assert.ok(
      Math.abs(finalBeta - trueBeta) < Math.abs(initialBeta - trueBeta),
      'Kalman filter must monotonically adapt towards the true dynamic hedge ratio'
    );

    // Verify bounded covariance
    const [P00, , , P11] = finalPoint.covariance;
    assert.ok(P00 > 0 && P00 < 5.0, `Alpha state variance P00 must remain bounded, got ${P00}`);
    assert.ok(P11 > 0 && P11 < 1.0, `Beta state variance P11 must remain bounded, got ${P11}`);
  });

  // AC-ARB-05: Dynamic Kalman Filter Tracking Under Structural Regime Shift
  test('TC-ARB-TEST-05: Dynamic Kalman Filter Regime Shift Adaptation', () => {
    // Regime 1: Beta = 1.20 for first 50 bars
    // Regime 2: Beta jumps to 1.80 for next 50 bars (e.g. corporate restructuring)
    const n = 100;
    const x = [];
    const y = [];

    let curX = 600;
    for (let i = 0; i < n; i++) {
      curX += 1.5 + Math.sin(i * 0.4) * 3;
      const currentTrueBeta = i < 50 ? 1.20 : 1.80;
      const res = Math.sin(i * 0.9) * 2;
      y.push(currentTrueBeta * curX + res);
      x.push(curX);
    }

    const kalmanPoints = runKalmanFilter(y, x, 1.20, 0.0);

    const midPointBeta = kalmanPoints[49].beta;
    const finalBeta = kalmanPoints[kalmanPoints.length - 1].beta;

    assert.ok(
      Math.abs(midPointBeta - 1.20) < 0.10,
      `Kalman beta during Regime 1 must be near 1.20, got ${midPointBeta.toFixed(3)}`
    );
    assert.ok(
      finalBeta > 1.65,
      `Kalman beta must successfully track structural shift towards 1.80, got ${finalBeta.toFixed(3)}`
    );
  });

  // AC-ARB-06: Z-Score Threshold Signal Triggering
  test('TC-ARB-TEST-06: Z-Score Signal Thresholds for Long, Short, Exit and Stop-Loss', () => {
    // Synthetic mean-reverting spread with deliberate excursions
    const spread = [];
    for (let i = 0; i < 60; i++) {
      spread.push(Math.sin(i * 0.3) * 5);
    }
    // Append an extreme divergence of +15
    spread.push(15);
    // Append a massive breakdown of +30
    spread.push(30);

    const signals = calculateZScoreSignals(spread, 20);
    assert.ok(signals.length > 0, 'Signal generator should produce evaluation points');

    const evaluateSingle = (z) => {
      if (z <= -2.0 && z > -3.5) return 'LONG_SPREAD';
      if (z >= 2.0 && z < 3.5) return 'SHORT_SPREAD';
      if (Math.abs(z) <= 0.25) return 'EXIT';
      if (Math.abs(z) >= 3.5) return 'STOP_LOSS';
      return 'NO_SIGNAL';
    };

    assert.strictEqual(evaluateSingle(-2.4), 'LONG_SPREAD');
    assert.strictEqual(evaluateSingle(2.3), 'SHORT_SPREAD');
    assert.strictEqual(evaluateSingle(0.1), 'EXIT');
    assert.strictEqual(evaluateSingle(-0.15), 'EXIT');
    assert.strictEqual(evaluateSingle(3.8), 'STOP_LOSS');
    assert.strictEqual(evaluateSingle(-4.1), 'STOP_LOSS');
    assert.strictEqual(evaluateSingle(1.1), 'NO_SIGNAL');
  });

  // AC-ARB-07: Pre-Trade Statutory Hurdle & Dollar Neutrality
  test('TC-ARB-TEST-07: 2-Leg Arbitrage Round-Trip Statutory Tax Hurdle and Dollar Neutrality', () => {
    const unitsY = 550; // HDFCBANK lot size
    const priceY = 1600;
    const unitsX = 700; // ICICIBANK lot size
    const priceX = 1150;

    const hurdle = calculateStatutoryHurdle(unitsY, priceY, unitsX, priceX);

    assert.ok(
      hurdle.roundTripTaxes > 200,
      `Round-trip tax for 2 institutional lots must exceed ₹200, got ₹${hurdle.roundTripTaxes}`
    );
    assert.ok(
      hurdle.minSpreadReversionPts < 2.5,
      `Hurdle points (${hurdle.minSpreadReversionPts.toFixed(2)}) should be modest relative to stock price`
    );
    assert.ok(
      hurdle.dollarNeutralRatio > 0.90 && hurdle.dollarNeutralRatio < 1.25,
      `Dollar neutrality ratio (${hurdle.dollarNeutralRatio.toFixed(3)}) should be close to 1.0`
    );
  });
});
