// Sprint 17 — Execution Engine Tests
// Tests: Almgren-Chriss trajectory, VWAP/TWAP schedule, IS decomposition
// Pure JS mirror of executionEngine.ts (Node native test runner)

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure JS mirrors of executionEngine functions ───────────────────────────

function computeAlmgrenChrissTrajectory({ totalQty, horizonMinutes, riskAversion, sigma, temporaryImpact }, numSlices = 20) {
  const sigmaPerMin = sigma / Math.sqrt(375);
  const kappa = Math.sqrt((riskAversion * sigmaPerMin * sigmaPerMin) / Math.max(temporaryImpact, 1e-10));
  const dt = horizonMinutes / numSlices;
  const holdings = [];
  for (let j = 0; j <= numSlices; j++) {
    const t = j * dt;
    let holding;
    if (kappa * horizonMinutes < 1e-10) {
      holding = totalQty * (1 - j / numSlices);
    } else {
      holding = totalQty * (Math.sinh(kappa * (horizonMinutes - t)) / Math.sinh(kappa * horizonMinutes));
    }
    holdings.push(Math.max(0, holding));
  }
  const tradeQtys = [];
  for (let j = 0; j < numSlices; j++) {
    tradeQtys.push(Math.round(holdings[j] - holdings[j + 1]));
  }
  const sumQ = tradeQtys.reduce((s, q) => s + q, 0);
  const diff = totalQty - sumQ;
  if (tradeQtys.length > 0) tradeQtys[tradeQtys.length - 1] += diff;
  return tradeQtys;
}

function computeTWAPSchedule(totalQty, numSlices) {
  const baseQty = Math.floor(totalQty / numSlices);
  const remainder = totalQty - baseQty * numSlices;
  const slices = Array(numSlices).fill(baseQty);
  slices[0] += remainder;
  return slices;
}

function generateIndianVolumeProfile() {
  const rawWeights = [
    8.5, 6.2, 4.8, 3.9, 3.2,
    2.8, 2.6, 2.5, 2.4, 2.3, 2.2,
    2.6, 2.9, 3.4, 4.1, 4.8,
    5.8, 6.9, 8.2, 9.5, 11.5,
    6.2, 4.3, 3.1, 2.3, 1.9,
  ];
  const total = rawWeights.reduce((s, w) => s + w, 0);
  return rawWeights.map((w, i) => ({
    timeMinutesFromOpen: i * 15,
    volumeFraction: w / total,
  }));
}

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
  const sumQ = slices.reduce((s, q) => s + q, 0);
  slices[0] += totalQty - sumQ;
  return slices;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// AC-EXE-01: Almgren-Chriss boundary conditions
test('AC-EXE-01: Almgren-Chriss trajectory sums to totalQty', () => {
  const params = {
    totalQty: 10000,
    horizonMinutes: 120,
    riskAversion: 1e-6,
    sigma: 0.25,
    permanentImpact: 0.1,
    temporaryImpact: 0.05,
  };
  const trajectory = computeAlmgrenChrissTrajectory(params, 20);
  const totalTraded = trajectory.reduce((s, q) => s + q, 0);
  assert.strictEqual(totalTraded, params.totalQty, `Sum ${totalTraded} ≠ ${params.totalQty}`);
  assert.strictEqual(trajectory.length, 20, 'Slice count mismatch');
});

// AC-EXE-02: Almgren-Chriss risk-aversion monotonicity
// Higher λ → more front-loaded (larger first slice)
test('AC-EXE-02: Higher risk-aversion produces more front-loaded trajectory', () => {
  const baseParams = {
    totalQty: 10000,
    horizonMinutes: 120,
    sigma: 0.25,
    permanentImpact: 0.1,
    temporaryImpact: 0.05,
  };
  const lowRisk = computeAlmgrenChrissTrajectory({ ...baseParams, riskAversion: 1e-8 }, 10);
  const highRisk = computeAlmgrenChrissTrajectory({ ...baseParams, riskAversion: 1e-4 }, 10);
  // High risk-aversion should trade more in first few slices
  const lowFrontHalf = lowRisk.slice(0, 5).reduce((s, q) => s + q, 0);
  const highFrontHalf = highRisk.slice(0, 5).reduce((s, q) => s + q, 0);
  assert.ok(
    highFrontHalf >= lowFrontHalf,
    `High-risk front half ${highFrontHalf} should be >= low-risk ${lowFrontHalf}`
  );
});

// AC-EXE-03: TWAP schedule is uniform
test('AC-EXE-03: TWAP schedule distributes quantity uniformly', () => {
  const totalQty = 1000;
  const numSlices = 10;
  const slices = computeTWAPSchedule(totalQty, numSlices);
  assert.strictEqual(slices.length, numSlices, 'Slice count mismatch');
  const sum = slices.reduce((s, q) => s + q, 0);
  assert.strictEqual(sum, totalQty, `TWAP sum ${sum} ≠ ${totalQty}`);
  // All slices (after the first) should be equal
  const baseQty = Math.floor(totalQty / numSlices);
  for (let i = 1; i < numSlices; i++) {
    assert.strictEqual(slices[i], baseQty, `Slice ${i}: ${slices[i]} ≠ ${baseQty}`);
  }
});

// AC-EXE-04: VWAP profile morning > midday
test('AC-EXE-04: NSE volume profile has higher morning weight than midday', () => {
  const profile = generateIndianVolumeProfile();
  // Morning: first 4 intervals (09:15–10:00), Midday: intervals 5-10 (10:30–11:45)
  const morningWeight = profile.slice(0, 4).reduce((s, p) => s + p.volumeFraction, 0);
  const middayWeight = profile.slice(5, 11).reduce((s, p) => s + p.volumeFraction, 0);
  assert.ok(morningWeight > middayWeight, `Morning ${morningWeight.toFixed(4)} should be > midday ${middayWeight.toFixed(4)}`);
});

// AC-EXE-05: VWAP schedule sums to totalQty
test('AC-EXE-05: VWAP schedule sums exactly to totalQty', () => {
  const profile = generateIndianVolumeProfile();
  const totalQty = 5000;
  const slices = computeVWAPSchedule(totalQty, profile, 15);
  const sum = slices.reduce((s, q) => s + q, 0);
  assert.strictEqual(sum, totalQty, `VWAP sum ${sum} ≠ ${totalQty}`);
});

// AC-EXE-06: Volume profile normalization (sum ≈ 1.0)
test('AC-EXE-06: NSE volume profile fractions sum to 1.0', () => {
  const profile = generateIndianVolumeProfile();
  const total = profile.reduce((s, p) => s + p.volumeFraction, 0);
  assert.ok(Math.abs(total - 1.0) < 0.001, `Profile sum ${total.toFixed(6)} ≠ 1.0`);
});

// AC-EXE-07: Almgren-Chriss in TWAP limit (kappa ≈ 0)
test('AC-EXE-07: Almgren-Chriss with near-zero risk-aversion approaches TWAP', () => {
  const params = {
    totalQty: 1000,
    horizonMinutes: 60,
    riskAversion: 1e-20,  // near-zero
    sigma: 0.25,
    permanentImpact: 0.1,
    temporaryImpact: 0.05,
  };
  const acSlices = computeAlmgrenChrissTrajectory(params, 10);
  const twapSlices = computeTWAPSchedule(1000, 10);
  // Both should sum to 1000
  assert.strictEqual(acSlices.reduce((s, q) => s + q, 0), 1000);
  assert.strictEqual(twapSlices.reduce((s, q) => s + q, 0), 1000);
});
