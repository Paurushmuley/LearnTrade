import test from 'node:test';
import assert from 'node:assert/strict';

function calculateKellyCriterion(winRateDecimal, avgWin, avgLoss) {
  if (avgLoss <= 0 || avgWin <= 0 || winRateDecimal <= 0) {
    return { fullKelly: 0, halfKelly: 0, isEdgePositive: false };
  }
  const p = Math.min(Math.max(winRateDecimal, 0.01), 0.99);
  const q = 1 - p;
  const b = avgWin / avgLoss;
  const rawKelly = (p * b - q) / b;
  const isEdgePositive = rawKelly > 0;
  const fullKelly = isEdgePositive ? Number((Math.min(0.10, rawKelly) * 100).toFixed(2)) : 0;
  const halfKelly = isEdgePositive ? Number((fullKelly / 2).toFixed(2)) : 0;
  return { fullKelly, halfKelly, isEdgePositive };
}

function runMonteCarloSimulation(winRatePercent, avgWin, avgLoss, startingCapital = 1000000, trials = 100, trades = 50) {
  const p = winRatePercent / 100;
  const finalEquities = [];
  let ruinCount = 0;

  for (let m = 0; m < trials; m++) {
    let eq = startingCapital;
    let peak = startingCapital;
    let maxDd = 0;
    const path = [eq];

    for (let t = 0; t < trades; t++) {
      if (Math.random() < p) eq += avgWin;
      else eq -= avgLoss;
      path.push(eq);
      if (eq > peak) peak = eq;
      const dd = (peak - eq) / peak;
      if (dd > maxDd) maxDd = dd;
    }

    if (maxDd >= 0.5) ruinCount += 1;
    finalEquities.push({ path, finalEq: eq });
  }

  finalEquities.sort((a, b) => a.finalEq - b.finalEq);
  return {
    trialsCount: trials,
    worstPath: finalEquities[0].path,
    medianPath: finalEquities[Math.floor(trials * 0.5)].path,
    bestPath: finalEquities[trials - 1].path,
    probabilityOfRuinPercent: (ruinCount / trials) * 100,
  };
}

test('Kelly Criterion Calculator - Positive vs Negative Edge', () => {
  // Positive Edge: 60% win rate, 2:1 payoff (avgWin: 2000, avgLoss: 1000)
  // b = 2, p = 0.6, q = 0.4 -> f* = (0.6 * 2 - 0.4) / 2 = 0.4 (capped to 10%)
  const positive = calculateKellyCriterion(0.60, 2000, 1000);
  assert.equal(positive.isEdgePositive, true);
  assert.equal(positive.fullKelly, 10.00); // Institutional cap
  assert.equal(positive.halfKelly, 5.00);

  // Negative Edge: 30% win rate, 1:1 payoff -> should recommend 0% risk
  const negative = calculateKellyCriterion(0.30, 1000, 1000);
  assert.equal(negative.isEdgePositive, false);
  assert.equal(negative.fullKelly, 0);
  assert.equal(negative.halfKelly, 0);
});

test('Monte Carlo Ruin Simulation - Path Envelope & Monotonicity', () => {
  const sim = runMonteCarloSimulation(60, 3000, 1500, 1000000, 100, 30);

  assert.equal(sim.trialsCount, 100);
  assert.ok(sim.bestPath[sim.bestPath.length - 1] > sim.medianPath[sim.medianPath.length - 1]);
  assert.ok(sim.medianPath[sim.medianPath.length - 1] >= sim.worstPath[sim.worstPath.length - 1]);
  assert.ok(sim.probabilityOfRuinPercent >= 0 && sim.probabilityOfRuinPercent <= 100);
});
