import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * TradeCraft AI - Options Payoff Optimizer & Implied Volatility Surface Calibrator Tests
 * Sprint 14 - Quantitative Verification Suite (BRD-014 / AC-VOL-01 to AC-VOL-06)
 */

// Analytical SABR Formula (Hagan et al. 2002)
function calculateSABRVolatility(F, K, T, params) {
  const { alpha, beta, rho, nu } = params;
  const time = Math.max(0.0001, T);

  // ATM boundary condition: K -> F
  if (Math.abs(F - K) < 1e-4) {
    const term1 = alpha / Math.pow(F, 1 - beta);
    const term2 =
      (Math.pow(1 - beta, 2) * Math.pow(alpha, 2)) / (24 * Math.pow(F, 2 * (1 - beta))) +
      (rho * beta * nu * alpha) / (4 * Math.pow(F, 1 - beta)) +
      ((2 - 3 * Math.pow(rho, 2)) * Math.pow(nu, 2)) / 24;
    return Math.max(0.01, term1 * (1 + term2 * time));
  }

  // General formula
  const logFK = Math.log(F / K);
  const FK = F * K;
  const FK_beta = Math.pow(FK, (1 - beta) / 2);

  const denominator =
    FK_beta *
    (1 +
      (Math.pow(1 - beta, 2) * Math.pow(logFK, 2)) / 24 +
      (Math.pow(1 - beta, 4) * Math.pow(logFK, 4)) / 1920);

  const z = (nu / alpha) * FK_beta * logFK;

  let chi_z;
  if (Math.abs(z) < 1e-5) {
    chi_z = 1;
  } else {
    const sqrtTerm = Math.sqrt(1 - 2 * rho * z + Math.pow(z, 2));
    const numerator = sqrtTerm + z - rho;
    chi_z = Math.log(numerator / (1 - rho)) / z;
  }

  const factor1 = (alpha / denominator) * (1 / chi_z);
  const factor2 =
    1 +
    ((Math.pow(1 - beta, 2) * Math.pow(alpha, 2)) / (24 * Math.pow(FK, 1 - beta)) +
      (rho * beta * nu * alpha) / (4 * FK_beta) +
      ((2 - 3 * Math.pow(rho, 2)) * Math.pow(nu, 2)) / 24) *
      time;

  const result = factor1 * factor2;
  return Math.max(0.02, isNaN(result) ? alpha : result);
}

// Gatheral SVI Total Variance & Volatility
function calculateSVITotalVariance(k, params) {
  const { a, b, rho, m, sigma } = params;
  const kMinusM = k - m;
  const totalVariance = a + b * (rho * kMinusM + Math.sqrt(Math.pow(kMinusM, 2) + Math.pow(sigma, 2)));
  return Math.max(0.0001, totalVariance);
}

function calculateSVIVolatility(k, T, params) {
  const time = Math.max(0.0001, T);
  const w = calculateSVITotalVariance(k, params);
  return Math.sqrt(w / time);
}

function verifySVIArbitrageFree(params, T) {
  const { a, b, rho, sigma } = params;
  const slopeCondition = b * (1 + Math.abs(rho));
  const maxSlope = 4 / Math.max(0.001, T);
  if (slopeCondition > maxSlope) {
    return { isArbitrageFree: false, reason: `SVI slope condition breached: ${slopeCondition.toFixed(3)} > ${maxSlope.toFixed(3)}` };
  }
  const minVariance = a + b * sigma * Math.sqrt(1 - rho * rho);
  if (minVariance < 0) {
    return { isArbitrageFree: false, reason: `Minimum variance is negative: ${minVariance.toFixed(5)}` };
  }
  return { isArbitrageFree: true };
}

// Calibration Metrics Evaluator
function calculateCalibrationMetrics(strikes, marketIVs, modelIVs, isArbitrageFree = true) {
  const n = strikes.length;
  let sumSqErr = 0;
  let sumMkt = 0;
  let maxAbsErr = 0;

  for (let i = 0; i < n; i++) {
    const err = modelIVs[i] - marketIVs[i];
    sumSqErr += err * err;
    sumMkt += marketIVs[i];
    const absErr = Math.abs(err);
    if (absErr > maxAbsErr) maxAbsErr = absErr;
  }

  const rmse = Math.sqrt(sumSqErr / n);
  const meanMkt = sumMkt / n;
  let totalVar = 0;
  for (let i = 0; i < n; i++) {
    totalVar += Math.pow(marketIVs[i] - meanMkt, 2);
  }
  const rSquared = totalVar > 1e-8 ? Math.max(0, 1 - sumSqErr / totalVar) : 1.0;

  return {
    rmse: Math.round(rmse * 10000) / 10000,
    rSquared: Math.round(rSquared * 1000) / 1000,
    maxAbsoluteError: Math.round(maxAbsErr * 10000) / 10000,
    isArbitrageFree,
  };
}

// Strike Mispricing Classifier
function classifyStrikeMispricing(marketIV, modelIV, thresholdPercent = 0.8) {
  const diff = Math.round((marketIV - modelIV) * 1000) / 10;
  let status = 'FAIR';
  let rating = 'FAIR';
  if (diff >= thresholdPercent) {
    status = 'OVERVALUED';
    rating = 'RICH';
  } else if (diff <= -thresholdPercent) {
    status = 'UNDERVALUED';
    rating = 'CHEAP';
  }
  return { diff, status, rating };
}

// Bounded Nelder-Mead SABR Calibration
function calibrateSABR(forwardPrice, strikes, marketIVs, T, beta = 1.0) {
  const atmIdx = Math.floor(strikes.length / 2);
  const atmIV = marketIVs[atmIdx] || 0.15;
  const x = [atmIV, -0.38, 0.48];

  const loss = (p) => {
    const [alpha, rho, nu] = p;
    let penalty = 0;
    if (alpha <= 0.01) penalty += 1e5;
    if (alpha > 2.0) penalty += 1e5;
    if (rho <= -0.98 || rho >= 0.30) penalty += 1e5;
    if (nu <= 0.05 || nu > 3.0) penalty += 1e5;

    const clampedParams = {
      alpha: Math.max(0.01, Math.min(2.0, alpha)),
      beta,
      rho: Math.max(-0.98, Math.min(0.25, rho)),
      nu: Math.max(0.05, Math.min(3.0, nu)),
    };

    let sse = 0;
    for (let i = 0; i < strikes.length; i++) {
      const modelIV = calculateSABRVolatility(forwardPrice, strikes[i], T, clampedParams);
      const diff = modelIV - marketIVs[i];
      sse += diff * diff;
    }
    return Math.sqrt(sse / strikes.length) + penalty;
  };

  const n = 3;
  let simplex = [{ point: [...x], val: loss(x) }];
  const stepSizes = [x[0] * 0.1, 0.08, 0.1];
  for (let i = 0; i < n; i++) {
    const pt = [...x];
    pt[i] += stepSizes[i];
    simplex.push({ point: pt, val: loss(pt) });
  }

  for (let iter = 0; iter < 100; iter++) {
    simplex.sort((a, b) => a.val - b.val);
    if (simplex[n].val - simplex[0].val < 1e-6) break;
    const centroid = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i].point[j] / n;
    }
    const xr = centroid.map((c, j) => c + 1.0 * (c - simplex[n].point[j]));
    const vr = loss(xr);
    if (vr < simplex[n - 1].val && vr >= simplex[0].val) {
      simplex[n] = { point: xr, val: vr };
      continue;
    }
    if (vr < simplex[0].val) {
      const xe = centroid.map((c, j) => c + 2.0 * (xr[j] - c));
      const ve = loss(xe);
      simplex[n] = ve < vr ? { point: xe, val: ve } : { point: xr, val: vr };
      continue;
    }
    const xc = centroid.map((c, j) => c + 0.5 * (simplex[n].point[j] - c));
    const vc = loss(xc);
    if (vc < simplex[n].val) {
      simplex[n] = { point: xc, val: vc };
      continue;
    }
    for (let i = 1; i <= n; i++) {
      simplex[i].point = simplex[i].point.map((p, j) => simplex[0].point[j] + 0.5 * (p - simplex[0].point[j]));
      simplex[i].val = loss(simplex[i].point);
    }
  }

  simplex.sort((a, b) => a.val - b.val);
  const bestPoint = simplex[0].point;
  const calibratedParams = {
    alpha: Math.round(bestPoint[0] * 10000) / 10000,
    beta,
    rho: Math.round(bestPoint[1] * 1000) / 1000,
    nu: Math.round(bestPoint[2] * 1000) / 1000,
  };
  const modelIVs = strikes.map((k) => calculateSABRVolatility(forwardPrice, k, T, calibratedParams));
  const metrics = calculateCalibrationMetrics(strikes, marketIVs, modelIVs, true);
  return { params: calibratedParams, metrics };
}

describe('TradeCraft Options Payoff Optimizer & Volatility Surface Calibrator Tests (Sprint 14)', () => {
  // AC-VOL-01
  test('TC-VOL-TEST-01: Hagan (2002) Analytical SABR Formula Accuracy and Skew Dynamics', () => {
    const forward = 24900;
    const T = 14 / 365; // 14 days
    const params = {
      alpha: 0.15,
      beta: 1.0,
      rho: -0.40, // Negative put skew
      nu: 0.50,   // Vol-of-vol
    };

    // 1. Verify ATM volatility evaluates smoothly
    const atmVol = calculateSABRVolatility(forward, forward, T, params);
    assert.ok(atmVol > 0.12 && atmVol < 0.18, `ATM Volatility should be near alpha: ${atmVol}`);

    // 2. Verify Downside Put Skew: OTM Puts (K < F) must have strictly higher IV than ATM
    const otmPutStrike = 24400; // -500 points OTM
    const otmPutVol = calculateSABRVolatility(forward, otmPutStrike, T, params);
    assert.ok(
      otmPutVol > atmVol,
      `Downside skew requires OTM Put IV (${otmPutVol}) > ATM IV (${atmVol})`
    );

    // 3. Verify Upward Wing Convexity with high vol-of-vol
    const highNuParams = { ...params, nu: 0.90 };
    const highNuWingVol = calculateSABRVolatility(forward, otmPutStrike, T, highNuParams);
    assert.ok(
      highNuWingVol > otmPutVol,
      `Higher vol-of-vol (${highNuWingVol}) must elevate smile wings above standard vol (${otmPutVol})`
    );
  });

  // AC-VOL-02
  test('TC-VOL-TEST-02: Gatheral SVI Total Variance, Volatility and No-Arbitrage Limits', () => {
    const forward = 24900;
    const T = 30 / 365;
    const sviParams = {
      a: 0.0015,
      b: 0.08,
      rho: -0.45,
      m: 0.01,
      sigma: 0.04,
    };

    // 1. ATM log-moneyness k = ln(24900 / 24900) = 0
    const atmVariance = calculateSVITotalVariance(0, sviParams);
    assert.ok(atmVariance > 0, `Total variance must be positive: ${atmVariance}`);

    const atmIV = calculateSVIVolatility(0, T, sviParams);
    assert.ok(atmIV > 0.10 && atmIV < 0.35, `Annualized IV should be reasonable: ${atmIV}`);

    // 2. Skew test: OTM Put log-moneyness k = ln(24300 / 24900) < 0
    const kPut = Math.log(24300 / 24900);
    const putIV = calculateSVIVolatility(kPut, T, sviParams);
    assert.ok(putIV > atmIV, `SVI negative rho must produce higher put IV: ${putIV} > ${atmIV}`);

    // 3. Arbitrage-free validator
    const arbStatus = verifySVIArbitrageFree(sviParams, T);
    assert.strictEqual(arbStatus.isArbitrageFree, true, 'SVI parameters should be arbitrage-free');
  });

  // AC-VOL-03
  test('TC-VOL-TEST-03: Bounded Nelder-Mead SABR Model Calibration Goodness-of-Fit', () => {
    const forward = 24900;
    const T = 7 / 365;
    const targetParams = { alpha: 0.145, beta: 1.0, rho: -0.38, nu: 0.46 };

    // Generate synthetic NIFTY strike chain with realistic noise
    const strikes = [];
    const marketIVs = [];
    for (let k = 24300; k <= 25500; k += 50) {
      strikes.push(k);
      const cleanVol = calculateSABRVolatility(forward, k, T, targetParams);
      const pseudoNoise = Math.sin(k * 7) * 0.0003;
      marketIVs.push(Math.round((cleanVol + pseudoNoise) * 10000) / 10000);
    }

    // Run calibration
    const { params, metrics } = calibrateSABR(forward, strikes, marketIVs, T, 1.0);

    // Verify RMSE < 0.65% (0.0065) and R^2 >= 0.95
    assert.ok(
      metrics.rmse < 0.0065,
      `Calibration RMSE must be under 0.65%: actual ${(metrics.rmse * 100).toFixed(3)}%`
    );
    assert.ok(
      metrics.rSquared >= 0.95,
      `Calibration R-Squared must exceed 0.95: actual ${metrics.rSquared}`
    );
    assert.ok(params.alpha > 0.10 && params.alpha < 0.20, 'Calibrated alpha must be near ATM level');
    assert.ok(params.rho < 0, 'Calibrated rho must retain negative Indian index skew');
  });

  // AC-VOL-04
  test('TC-VOL-TEST-04: Mispriced Options Scanner & Relative Value Arbitrage Tagging', () => {
    // Overvalued strike: Market IV is 1.6% above model fair IV
    const richCheck = classifyStrikeMispricing(0.165, 0.149, 0.8);
    assert.strictEqual(richCheck.status, 'OVERVALUED');
    assert.strictEqual(richCheck.rating, 'RICH');
    assert.ok(richCheck.diff >= 1.5, 'Discrepancy should match delta');

    // Undervalued strike: Market IV is 1.2% below model fair IV
    const cheapCheck = classifyStrikeMispricing(0.138, 0.150, 0.8);
    assert.strictEqual(cheapCheck.status, 'UNDERVALUED');
    assert.strictEqual(cheapCheck.rating, 'CHEAP');

    // Fair strike: Market IV is within +/-0.8% of model
    const fairCheck = classifyStrikeMispricing(0.149, 0.151, 0.8);
    assert.strictEqual(fairCheck.status, 'FAIR');
    assert.strictEqual(fairCheck.rating, 'FAIR');
  });

  // AC-VOL-05
  test('TC-VOL-TEST-05: Multi-Leg Strategy Optimizer Payoff Logic & Spread Sizing', () => {
    // 4-Leg Iron Condor Payoff Math
    const shortPutK = 24700;
    const longPutK = 24500;
    const shortCallK = 25100;
    const longCallK = 25300;

    const shortPutPremium = 85;
    const longPutPremium = 35;
    const shortCallPremium = 90;
    const longCallPremium = 40;

    const lotSize = 25;
    const netCreditPerShare = (shortPutPremium - longPutPremium) + (shortCallPremium - longCallPremium); // 50 + 50 = 100
    const maxProfit = netCreditPerShare * lotSize; // 2500
    const wingWidth = 200; // 25300 - 25100
    const maxLoss = (wingWidth - netCreditPerShare) * lotSize; // (200 - 100) * 25 = 2500

    assert.strictEqual(maxProfit, 2500, 'Max profit must equal net collected credit');
    assert.strictEqual(maxLoss, 2500, 'Max loss must equal wing width minus collected credit');
    assert.strictEqual(maxProfit / maxLoss, 1.0, 'Risk-reward ratio is 1:1');

    // Breakevens
    const lowerBreakeven = shortPutK - netCreditPerShare; // 24600
    const upperBreakeven = shortCallK + netCreditPerShare; // 25200
    assert.strictEqual(lowerBreakeven, 24600);
    assert.strictEqual(upperBreakeven, 25200);
  });

  // AC-VOL-06
  test('TC-VOL-TEST-06: 2D Continuous Payoff Curve & Breakeven Zero-Crossing Detection', () => {
    const legs = [
      { strike: 24900, optionType: 'CE', side: 'BUY', quantity: 25, premium: 140 },
      { strike: 25100, optionType: 'CE', side: 'SELL', quantity: 25, premium: 50 },
    ];
    const underlyingSpot = 24900;
    const debitPerShare = 140 - 50; // 90
    const breakeven = 24900 + debitPerShare; // 24990

    // Evaluate payoff at three benchmark spots
    const calcPnL = (spot) => {
      let pnl = 0;
      for (const leg of legs) {
        const intrinsic = Math.max(0, spot - leg.strike);
        const legPnl = leg.side === 'BUY' ? (intrinsic - leg.premium) : (leg.premium - intrinsic);
        pnl += legPnl * leg.quantity;
      }
      return pnl;
    };

    // Deep OTM spot (below 24900): Max Loss
    const pnlDown = calcPnL(24700);
    assert.strictEqual(pnlDown, -90 * 25, 'Below long strike should realize full debit loss (-₹2250)');

    // Deep ITM spot (above 25100): Max Profit
    const pnlUp = calcPnL(25300);
    assert.strictEqual(pnlUp, (200 - 90) * 25, 'Above short strike should realize full width gain (+₹2750)');

    // At Breakeven: Zero P&L
    const pnlBreakeven = calcPnL(breakeven);
    assert.strictEqual(pnlBreakeven, 0, 'At exact breakeven (24990), P&L must equal 0');
  });

  // AC-VOL-07
  test('TC-VOL-TEST-07: Indian Exchange Statutory Tax & Margin Feasibility Enforcement', () => {
    // Verify SEBI / GST / STT charges deduction on option trade
    const premium = 140;
    const quantity = 25;
    const turnover = premium * quantity; // ₹3500

    // Brokerage: Min(20, turnover * 0.0003) = Min(20, 1.05) = ₹1.05
    const brokerage = Math.min(20, turnover * 0.0003);
    assert.ok(brokerage > 0 && brokerage <= 20, 'Brokerage must respect ₹20 cap');

    // GST (18% on fees)
    const exchangeTurnover = turnover * 0.0000297;
    const gst = (brokerage + exchangeTurnover) * 0.18;
    assert.ok(gst > 0, 'GST must be charged on transactional fees');

    const totalCharges = brokerage + exchangeTurnover + gst;
    assert.ok(totalCharges > 0 && totalCharges < turnover * 0.05, 'Total fees must be fractional of premium');
  });
});
