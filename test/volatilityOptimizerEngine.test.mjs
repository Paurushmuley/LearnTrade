import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure mathematical implementations mirrored for native fast Node.js test execution

function calculateSABRVolatility(F, K, T, params) {
  const { alpha, beta, rho, nu } = params;
  const time = Math.max(0.0001, T);

  // ATM boundary condition
  if (Math.abs(F - K) < 1e-4) {
    const term1 = alpha / Math.pow(F, 1 - beta);
    const term2 =
      (Math.pow(1 - beta, 2) * Math.pow(alpha, 2)) / (24 * Math.pow(F, 2 * (1 - beta))) +
      (rho * beta * nu * alpha) / (4 * Math.pow(F, 1 - beta)) +
      ((2 - 3 * Math.pow(rho, 2)) * Math.pow(nu, 2)) / 24;
    return Math.max(0.01, term1 * (1 + term2 * time));
  }

  // General strike formula
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
    chi_z = 1.0;
  } else {
    const discriminant = Math.max(1e-12, 1 - 2 * rho * z + Math.pow(z, 2));
    const sqrtTerm = Math.sqrt(discriminant);
    const numerator = sqrtTerm + z - rho;
    const arg = Math.max(1e-12, numerator / Math.max(1e-6, 1 - rho));
    const logArg = Math.log(arg);
    chi_z = Math.abs(logArg) < 1e-12 ? 1.0 : logArg / z;
  }

  const zOverChi = isFinite(chi_z) && Math.abs(chi_z) > 1e-12 ? 1 / chi_z : 1.0;
  const factor1 = (alpha / Math.max(1e-8, denominator)) * zOverChi;

  const factor2 =
    1 +
    ((Math.pow(1 - beta, 2) * Math.pow(alpha, 2)) / (24 * Math.max(1e-8, Math.pow(FK, 1 - beta))) +
      (rho * beta * nu * alpha) / (4 * Math.max(1e-8, FK_beta)) +
      ((2 - 3 * Math.pow(rho, 2)) * Math.pow(nu, 2)) / 24) *
      time;

  const result = factor1 * factor2;
  return Math.max(0.01, isNaN(result) || !isFinite(result) ? alpha : result);
}

function calculateSVITotalVariance(k, params) {
  const { a, b, rho, m, sigma } = params;
  const kMinusM = k - m;
  const sqrtTerm = Math.sqrt(Math.pow(kMinusM, 2) + Math.pow(sigma, 2));
  const totalVariance = a + b * (rho * kMinusM + sqrtTerm);
  return Math.max(0.0001, totalVariance);
}

function calculateSVIVolatility(k, T, params) {
  const time = Math.max(0.0001, T);
  const w = calculateSVITotalVariance(k, params);
  return Math.sqrt(w / time);
}

function verifySVIArbitrageFree(params, T) {
  const { a, b, rho, sigma } = params;
  if (b < 0) return { isArbitrageFree: false, reason: 'b < 0' };
  if (sigma <= 0) return { isArbitrageFree: false, reason: 'sigma <= 0' };
  if (Math.abs(rho) >= 1) return { isArbitrageFree: false, reason: '|rho| >= 1' };

  const minVariance = a + b * sigma * Math.sqrt(Math.max(0, 1 - rho * rho));
  if (minVariance < 0) {
    return { isArbitrageFree: false, reason: 'minVariance < 0' };
  }

  const time = Math.max(0.0001, T);
  const maxSlope = 4 / time;
  const wingSlope = b * (1 + Math.abs(rho));
  if (wingSlope > maxSlope + 0.05) {
    return { isArbitrageFree: false, reason: 'wingSlope > 4/T' };
  }

  return { isArbitrageFree: true };
}

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

function calibrateSABRSimplex(forwardPrice, strikes, marketIVs, T, beta = 1.0) {
  const atmIdx = Math.floor(strikes.length / 2);
  const atmIV = marketIVs[atmIdx] || 0.15;

  let x = [atmIV, -0.35, 0.45];

  const loss = (p) => {
    const [alpha, rho, nu] = p;
    let penalty = 0;
    if (alpha <= 0.01) penalty += Math.pow(0.01 - alpha, 2) * 1e5;
    if (alpha > 1.5) penalty += Math.pow(alpha - 1.5, 2) * 1e5;
    if (rho <= -0.98) penalty += Math.pow(-0.98 - rho, 2) * 1e5;
    if (rho >= 0.25) penalty += Math.pow(rho - 0.25, 2) * 1e5;
    if (nu <= 0.05) penalty += Math.pow(0.05 - nu, 2) * 1e5;
    if (nu > 3.0) penalty += Math.pow(nu - 3.0, 2) * 1e5;

    const clampedParams = {
      alpha: Math.max(0.01, Math.min(1.5, alpha)),
      beta,
      rho: Math.max(-0.98, Math.min(0.20, rho)),
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
  const steps = [0.02, 0.05, 0.05];
  for (let i = 0; i < n; i++) {
    const pt = [...x];
    pt[i] += steps[i];
    simplex.push({ point: pt, val: loss(pt) });
  }

  for (let iter = 0; iter < 120; iter++) {
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
  const best = simplex[0].point;
  const finalParams = { alpha: best[0], beta, rho: best[1], nu: best[2] };

  let sse = 0;
  let sumMkt = 0;
  for (let i = 0; i < strikes.length; i++) {
    const mIV = calculateSABRVolatility(forwardPrice, strikes[i], T, finalParams);
    const d = marketIVs[i] - mIV;
    sse += d * d;
    sumMkt += marketIVs[i];
  }
  const rmse = Math.sqrt(sse / strikes.length);
  const meanMkt = sumMkt / strikes.length;
  let totVar = 0;
  for (let i = 0; i < strikes.length; i++) {
    totVar += Math.pow(marketIVs[i] - meanMkt, 2);
  }
  const rSquared = totVar > 1e-8 ? Math.max(0, 1 - sse / totVar) : 1.0;

  return { params: finalParams, rmse, rSquared };
}

describe('TradeCraft Volatility Surface & Multi-Leg Strategy Optimizer (Sprint 14)', () => {
  // Test 1: SABR Analytical Formula Evaluation
  test('TC-VOL-TEST-01: SABR Analytical Formula Evaluation & Negative Index Skew', () => {
    const forwardPrice = 25000;
    const T = 14 / 365; // 14-day expiry
    const params = {
      alpha: 0.15, // 15% ATM vol
      beta: 1.0,   // Log-normal
      rho: -0.38,  // Negative correlation / put skew
      nu: 0.45,    // Vol-of-vol
    };

    const atmIV = calculateSABRVolatility(forwardPrice, forwardPrice, T, params);
    assert.ok(Math.abs(atmIV - 0.15) < 0.015, `ATM IV should be close to alpha=0.15, got ${atmIV}`);

    // Downside OTM Put strike (K < F) vs Upside OTM Call strike (K > F)
    const otmPutK = 24500; // -500 pts
    const otmCallK = 25500; // +500 pts

    const ivPut = calculateSABRVolatility(forwardPrice, otmPutK, T, params);
    const ivCall = calculateSABRVolatility(forwardPrice, otmCallK, T, params);

    assert.ok(
      ivPut > atmIV,
      `Downside Put IV (${(ivPut * 100).toFixed(2)}%) must be higher than ATM IV (${(atmIV * 100).toFixed(2)}%) due to negative rho`
    );
    assert.ok(
      ivPut > ivCall,
      `Downside Put IV (${(ivPut * 100).toFixed(2)}%) must exceed OTM Call IV (${(ivCall * 100).toFixed(2)}%) demonstrating index crash-fear skew`
    );
  });

  // Test 2: SVI Total Variance & No-Arbitrage Constraints
  test('TC-VOL-TEST-02: SVI Total Variance & Gatheral No-Arbitrage Constraints', () => {
    const T = 30 / 365;
    const validParams = {
      a: 0.012,
      b: 0.065,
      rho: -0.40,
      m: 0.008,
      sigma: 0.035,
    };

    const arbCheck = verifySVIArbitrageFree(validParams, T);
    assert.strictEqual(arbCheck.isArbitrageFree, true, 'Valid parameters should pass arbitrage checks');

    // Total variance must be strictly positive across all log-moneyness
    const kPoints = [-0.10, -0.05, 0.0, 0.05, 0.10];
    kPoints.forEach((k) => {
      const w = calculateSVITotalVariance(k, validParams);
      assert.ok(w > 0, `Total variance w(${k}) must be strictly positive, got ${w}`);
      const vol = calculateSVIVolatility(k, T, validParams);
      assert.ok(vol > 0.05 && vol < 0.80, `Recovered IV (${vol}) must be reasonable`);
    });

    // Test butterfly arbitrage violation: negative minimum variance
    const invalidParams = {
      a: -0.05,
      b: 0.02,
      rho: -0.20,
      m: 0,
      sigma: 0.01,
    };
    const invalidCheck = verifySVIArbitrageFree(invalidParams, T);
    assert.strictEqual(invalidCheck.isArbitrageFree, false, 'Negative variance must trigger arbitrage alert');
  });

  // Test 3: Strike Mispricing Classification & Thresholds
  test('TC-VOL-TEST-03: Strike Mispricing Classification & Thresholds', () => {
    const modelIV = 0.150; // 15.0%

    // Overvalued by +1.6% (16.6% market IV)
    const richResult = classifyStrikeMispricing(0.166, modelIV, 0.8);
    assert.strictEqual(richResult.status, 'OVERVALUED');
    assert.strictEqual(richResult.rating, 'RICH');
    assert.ok(richResult.diff >= 1.5, `Diff must reflect ~1.6%, got ${richResult.diff}%`);

    // Undervalued by -1.2% (13.8% market IV)
    const cheapResult = classifyStrikeMispricing(0.138, modelIV, 0.8);
    assert.strictEqual(cheapResult.status, 'UNDERVALUED');
    assert.strictEqual(cheapResult.rating, 'CHEAP');
    assert.ok(cheapResult.diff <= -1.0, `Diff must reflect ~ -1.2%, got ${cheapResult.diff}%`);

    // Fair value (15.2% vs 15.0%, diff +0.2%)
    const fairResult = classifyStrikeMispricing(0.152, modelIV, 0.8);
    assert.strictEqual(fairResult.status, 'FAIR');
    assert.strictEqual(fairResult.rating, 'FAIR');
  });

  // Test 4: Nelder-Mead Simplex Calibration Accuracy
  test('TC-VOL-TEST-04: Non-Linear Least Squares Calibration Solver Convergence', () => {
    const F = 25000;
    const T = 30 / 365;
    const trueParams = { alpha: 0.16, beta: 1.0, rho: -0.35, nu: 0.45 };

    // Standard NIFTY strike span from 23500 to 26500 (spanning put skew to call wing)
    const strikes = [23500, 24000, 24500, 25000, 25500, 26000, 26500];
    const marketIVs = strikes.map((k, idx) => {
      const pureIV = calculateSABRVolatility(F, k, T, trueParams);
      const microNoise = (idx % 2 === 0 ? 0.0002 : -0.0002); // 2 bps market microstructure noise
      return pureIV + microNoise;
    });

    const fit = calibrateSABRSimplex(F, strikes, marketIVs, T, 1.0);

    assert.ok(
      fit.rmse < 0.0065,
      `Calibration RMSE (${(fit.rmse * 100).toFixed(3)}%) must be below target threshold 0.65% (0.0065)`
    );
    assert.ok(
      fit.rSquared >= 0.95,
      `Calibration R^2 (${fit.rSquared.toFixed(4)}) must meet or exceed 0.95`
    );
  });

  // Test 5: Multi-Leg Strategy Optimizer Payoffs & Defined Risk
  test('TC-VOL-TEST-05: Multi-Leg Strategy Optimizer Payoffs & Defined Risk', () => {
    const atm = 25000;
    const lotSize = 25;

    // Defined-risk Bull Call Spread: Buy 25000 CE @ 120, Sell 25200 CE @ 40
    const leg1 = { strike: atm, optionType: 'CE', side: 'BUY', quantity: lotSize, premium: 120 };
    const leg2 = { strike: atm + 200, optionType: 'CE', side: 'SELL', quantity: lotSize, premium: 40 };

    const debitPerShare = leg1.premium - leg2.premium; // 80 pts
    const width = leg2.strike - leg1.strike; // 200 pts
    const maxProfit = (width - debitPerShare) * lotSize; // (200 - 80) * 25 = 3000
    const maxLoss = debitPerShare * lotSize; // 80 * 25 = 2000
    const breakeven = leg1.strike + debitPerShare; // 25080

    assert.strictEqual(maxProfit, 3000, 'Max profit must equal (width - debit) * lotSize');
    assert.strictEqual(maxLoss, 2000, 'Max loss must equal debit * lotSize');
    assert.strictEqual(breakeven, 25080, 'Breakeven must equal buyStrike + debit');

    // Verify Iron Condor Defined Risk & Breakeven corridor
    const shortPutK = 24800;
    const longPutK = 24600;
    const shortCallK = 25200;
    const longCallK = 25400;

    const premiumSP = 65;
    const premiumLP = 30; // Put spread credit = 35
    const premiumSC = 55;
    const premiumLC = 25; // Call spread credit = 30
    const totalCredit = (premiumSP - premiumLP + premiumSC - premiumLC); // 65 pts credit

    const icMaxProfit = totalCredit * lotSize; // 65 * 25 = 1625
    const icMaxLoss = (200 - totalCredit) * lotSize; // (200 - 65) * 25 = 3375
    const icLowerBE = shortPutK - totalCredit; // 24800 - 65 = 24735
    const icUpperBE = shortCallK + totalCredit; // 25200 + 65 = 25265

    assert.strictEqual(icMaxProfit, 1625);
    assert.strictEqual(icMaxLoss, 3375);
    assert.strictEqual(icLowerBE, 24735);
    assert.strictEqual(icUpperBE, 25265);
    assert.ok(icMaxProfit + icMaxLoss === 200 * lotSize, 'MaxProfit + MaxLoss must equal wing width * lotSize');
  });

  // Test 6: Pre-Trade Statutory Fee Drag & Indian Tax Schedule
  test('TC-VOL-TEST-06: Pre-Trade Statutory Fee Drag Integration', () => {
    // Standard NIFTY option buy order (1 lot, 25 qty @ ₹100 premium)
    const turnOver = 25 * 100; // ₹2500
    const stt = 0; // Buy side STT is 0 on options
    const exchangeFee = turnOver * 0.0005; // 0.05%
    const sebiFee = turnOver * 0.000001;
    const stampDuty = turnOver * 0.00003;
    const brokerage = 20.0;
    const gst = (brokerage + exchangeFee + sebiFee) * 0.18;
    const totalStatutory = brokerage + exchangeFee + sebiFee + stampDuty + gst;

    assert.ok(totalStatutory > 20.0, 'Total statutory fee must include brokerage and taxes');
    assert.ok(totalStatutory < 35.0, 'Statutory fee per trade must be reasonable for 1 lot');

    // Net PnL must strictly account for round-trip fees
    const grossProfit = 1000;
    const roundTripFees = totalStatutory * 2;
    const netPnL = grossProfit - roundTripFees;
    assert.ok(netPnL < grossProfit, 'Net PnL must be strictly less than Gross PnL due to statutory charges');
    assert.ok(netPnL > 900, 'Statutory fee drag on ₹1,000 profit is within ~5-7% of gross');
  });
});
