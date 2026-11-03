import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure algorithmic functions mirrored for native fast Node.js test execution
function calculatePortfolioGreeks(positions, underlyingSpot = 24900, underlyingSymbol = 'NIFTY 50') {
  let netDelta = 0;
  let netGamma = 0;
  let netVega = 0;
  let netTheta = 0;
  let totalNotional = 0;

  for (const pos of positions) {
    const sign = pos.side === 'BUY' ? 1 : -1;
    const effectiveQty = pos.quantity * sign;

    if (pos.assetType === 'EQUITY' || pos.assetType === 'FUTURES') {
      netDelta += effectiveQty * 1.0;
      totalNotional += Math.abs(pos.quantity * pos.currentPrice);
    } else if (pos.assetType === 'OPTION') {
      const greeks = pos.greeks;
      netDelta += effectiveQty * greeks.delta;
      netGamma += effectiveQty * greeks.gamma;
      netVega += effectiveQty * greeks.vega;
      netTheta += effectiveQty * greeks.theta;
      totalNotional += Math.abs(pos.quantity * (pos.strike || underlyingSpot));
    }
  }

  let deltaRiskStatus = 'NEUTRAL';
  if (Math.abs(netDelta) <= 15) {
    deltaRiskStatus = 'NEUTRAL';
  } else if (netDelta > 15 && netDelta <= 75) {
    deltaRiskStatus = 'MODERATE_LONG';
  } else if (netDelta > 75) {
    deltaRiskStatus = 'EXTREME_LONG';
  } else if (netDelta < -15 && netDelta >= -75) {
    deltaRiskStatus = 'MODERATE_SHORT';
  } else {
    deltaRiskStatus = 'EXTREME_SHORT';
  }

  let gammaRiskStatus = 'SAFE';
  if (netGamma < -0.05) {
    gammaRiskStatus = 'CRITICAL_SHORT_GAMMA';
  } else if (netGamma < -0.01) {
    gammaRiskStatus = 'ELEVATED';
  } else {
    gammaRiskStatus = 'SAFE';
  }

  return {
    netDelta: Math.round(netDelta * 100) / 100,
    netGamma: Math.round(netGamma * 10000) / 10000,
    netVega: Math.round(netVega * 10) / 10,
    netTheta: Math.round(netTheta * 10) / 10,
    deltaRiskStatus,
    gammaRiskStatus,
    positionCount: positions.length,
    underlyingSpot,
    totalNotional: Math.round(totalNotional),
    underlyingSymbol,
  };
}

function solveDeltaNeutralHedge(summary, preferredInstrument = 'FUTURES', targetDelta = 0, lotSize = 25) {
  const deltaImbalance = targetDelta - summary.netDelta;
  const spot = summary.underlyingSpot;
  const atmStrike = Math.round(spot / 50) * 50;

  if (Math.abs(deltaImbalance) < 2) {
    return {
      recommendedInstrument: preferredInstrument,
      symbol: `${summary.underlyingSymbol} FUT`,
      side: 'BUY',
      lotSize,
      recommendedLots: 0,
      recommendedQty: 0,
      estimatedPrice: spot,
      estimatedMargin: 0,
      projectedDeltaChange: 0,
      residualDelta: summary.netDelta,
      rationale: 'Portfolio is already within optimal delta-neutral bounds (|Δ| < 2). No hedge needed.',
    };
  }

  if (preferredInstrument === 'FUTURES') {
    const exactQtyNeeded = deltaImbalance;
    let lots = Math.round(Math.abs(exactQtyNeeded) / lotSize);
    if (lots === 0 && Math.abs(exactQtyNeeded) >= lotSize * 0.35) {
      lots = 1;
    }

    const side = exactQtyNeeded > 0 ? 'BUY' : 'SELL';
    const recommendedQty = lots * lotSize;
    const projectedDeltaChange = (side === 'BUY' ? 1 : -1) * recommendedQty;
    const residualDelta = Math.round((summary.netDelta + projectedDeltaChange) * 100) / 100;
    const estimatedMargin = Math.round(recommendedQty * spot * 0.12);

    return {
      recommendedInstrument: 'FUTURES',
      symbol: `${summary.underlyingSymbol} FUT`,
      side,
      lotSize,
      recommendedLots: lots,
      recommendedQty,
      estimatedPrice: spot,
      estimatedMargin,
      projectedDeltaChange,
      residualDelta,
      rationale: `${side} ${lots} lot(s) (${recommendedQty} qty) of ${summary.underlyingSymbol} Futures.`,
    };
  }

  if (preferredInstrument === 'ATM_CALL') {
    const callDeltaPerUnit = 0.50;
    const exactQtyNeeded = deltaImbalance / callDeltaPerUnit;
    let lots = Math.round(Math.abs(exactQtyNeeded) / lotSize);
    if (lots === 0 && Math.abs(exactQtyNeeded) >= lotSize * 0.35) {
      lots = 1;
    }
    const side = exactQtyNeeded > 0 ? 'BUY' : 'SELL';
    const recommendedQty = lots * lotSize;
    const projectedDeltaChange = (side === 'BUY' ? 1 : -1) * recommendedQty * callDeltaPerUnit;
    const residualDelta = Math.round((summary.netDelta + projectedDeltaChange) * 100) / 100;
    const estimatedPrem = Math.round(spot * 0.012);

    return {
      recommendedInstrument: 'ATM_CALL',
      symbol: `${summary.underlyingSymbol} ${atmStrike} CE`,
      side,
      lotSize,
      recommendedLots: lots,
      recommendedQty,
      estimatedPrice: estimatedPrem,
      estimatedMargin: side === 'BUY' ? recommendedQty * estimatedPrem : Math.round(recommendedQty * spot * 0.12),
      projectedDeltaChange: Math.round(projectedDeltaChange * 100) / 100,
      residualDelta,
      rationale: `${side} ${lots} lot(s) of ${atmStrike} CE.`,
    };
  }

  const putDeltaPerUnit = -0.50;
  const exactQtyNeeded = deltaImbalance / putDeltaPerUnit;
  let lots = Math.round(Math.abs(exactQtyNeeded) / lotSize);
  if (lots === 0 && Math.abs(exactQtyNeeded) >= lotSize * 0.35) {
    lots = 1;
  }
  const side = exactQtyNeeded > 0 ? 'BUY' : 'SELL';
  const recommendedQty = lots * lotSize;
  const projectedDeltaChange = (side === 'BUY' ? 1 : -1) * recommendedQty * putDeltaPerUnit;
  const residualDelta = Math.round((summary.netDelta + projectedDeltaChange) * 100) / 100;
  const estimatedPrem = Math.round(spot * 0.011);

  return {
    recommendedInstrument: 'ATM_PUT',
    symbol: `${summary.underlyingSymbol} ${atmStrike} PE`,
    side,
    lotSize,
    recommendedLots: lots,
    recommendedQty,
    estimatedPrice: estimatedPrem,
    estimatedMargin: side === 'BUY' ? recommendedQty * estimatedPrem : Math.round(recommendedQty * spot * 0.12),
    projectedDeltaChange: Math.round(projectedDeltaChange * 100) / 100,
    residualDelta,
    rationale: `${side} ${lots} lot(s) of ${atmStrike} PE.`,
  };
}

function simulatePriceShockScenarios(summary, shocks = [-2.0, -1.0, -0.5, 0.5, 1.0, 2.0], hedge = null) {
  const spot = summary.underlyingSpot;
  const residualDelta = hedge ? hedge.residualDelta : summary.netDelta;

  return shocks.map((shockPercent) => {
    const deltaS = spot * (shockPercent / 100);
    const projectedUnderlying = Math.round((spot + deltaS) * 10) / 10;
    const projectedDelta = Math.round((summary.netDelta + summary.netGamma * deltaS) * 10) / 10;

    const linearPnL = summary.netDelta * deltaS;
    const convexityRisk = 0.5 * summary.netGamma * Math.pow(deltaS, 2);
    const unhedgedExpectedPnL = Math.round(linearPnL + convexityRisk);

    const hedgedLinearPnL = residualDelta * deltaS;
    const hedgedExpectedPnL = Math.round(hedgedLinearPnL + convexityRisk);

    return {
      shockPercent,
      projectedUnderlying,
      projectedDelta,
      unhedgedExpectedPnL,
      hedgedExpectedPnL,
      convexityRisk: Math.round(convexityRisk),
    };
  });
}

function generateCurvaturePayoffCurve(summary, hedge, steps = 21, rangePercent = 4.0) {
  const spot = summary.underlyingSpot;
  const points = [];
  const residualDelta = hedge ? hedge.residualDelta : summary.netDelta;

  const minPercent = -rangePercent;
  const maxPercent = rangePercent;
  const stepSize = (maxPercent - minPercent) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const pShift = minPercent + i * stepSize;
    const underlyingPrice = Math.round((spot * (1 + pShift / 100)) * 10) / 10;
    const deltaS = underlyingPrice - spot;

    const unhedgedPnL = Math.round(summary.netDelta * deltaS + 0.5 * summary.netGamma * Math.pow(deltaS, 2));
    const hedgedPnL = Math.round(residualDelta * deltaS + 0.5 * summary.netGamma * Math.pow(deltaS, 2));

    points.push({
      underlyingPrice,
      percentShift: Math.round(pShift * 10) / 10,
      unhedgedPnL,
      hedgedPnL,
    });
  }

  return points;
}

function checkAutoRebalanceCondition(summary, config) {
  if (!config.enabled) {
    return {
      triggered: false,
      recommendation: null,
      reason: 'Auto-rebalancer daemon is disabled.',
    };
  }

  const absDelta = Math.abs(summary.netDelta);
  if (absDelta >= config.toleranceDelta) {
    const recommendation = solveDeltaNeutralHedge(summary, config.preferredInstrument, 0, 25);
    return {
      triggered: true,
      recommendation,
      reason: `Net Delta (${summary.netDelta > 0 ? '+' : ''}${summary.netDelta}) breached rebalance band of ±${config.toleranceDelta}.`,
    };
  }

  return {
    triggered: false,
    recommendation: null,
    reason: `Net Delta (${summary.netDelta > 0 ? '+' : ''}${summary.netDelta}) is within safe band of ±${config.toleranceDelta}.`,
  };
}

function createHedgeExecution(recommendation, preDelta) {
  return {
    id: `HDG-TEST-${Date.now()}`,
    timestamp: '10:00:00 AM',
    symbol: recommendation.symbol,
    side: recommendation.side,
    lots: recommendation.recommendedLots,
    quantity: recommendation.recommendedQty,
    executionPrice: recommendation.estimatedPrice,
    preDelta,
    postDelta: recommendation.residualDelta,
    triggerReason: recommendation.rationale,
    status: 'FILLED',
  };
}

describe('TradeCraft Options Greeks Hedger & Autobalancer Tests (Sprint 13)', () => {
  const mockPositions = [
    {
      id: 'POS-CE-1',
      symbol: 'NIFTY 25000 CE',
      assetType: 'OPTION',
      side: 'BUY',
      quantity: 50,
      entryPrice: 120,
      currentPrice: 125,
      greeks: { delta: 0.52, gamma: 0.0018, theta: -14.2, vega: 18.5 },
      lotSize: 25,
    },
    {
      id: 'POS-PE-1',
      symbol: 'NIFTY 24800 PE',
      assetType: 'OPTION',
      side: 'SELL',
      quantity: 50,
      entryPrice: 85,
      currentPrice: 78,
      greeks: { delta: -0.35, gamma: 0.0015, theta: -10.5, vega: 14.0 },
      lotSize: 25,
    },
    {
      id: 'POS-EQ-1',
      symbol: 'RELIANCE',
      assetType: 'EQUITY',
      side: 'BUY',
      quantity: 10,
      entryPrice: 2980,
      currentPrice: 3000,
      greeks: { delta: 1.0, gamma: 0, theta: 0, vega: 0 },
      lotSize: 1,
    },
  ];

  test('TC-GRK-TEST-01: Multi-Leg Portfolio Greeks Aggregation Accuracy', () => {
    const summary = calculatePortfolioGreeks(mockPositions, 24900, 'NIFTY 50');

    // CE: 50 * 0.52 = +26.0
    // PE Short: -50 * (-0.35) = +17.5
    // EQ: 10 * 1.0 = +10.0
    // Total = 53.5
    assert.equal(summary.netDelta, 53.5);

    // CE: 50 * 0.0018 = +0.09
    // PE Short: -50 * 0.0015 = -0.075
    // Total = 0.015
    assert.equal(summary.netGamma, 0.015);
    assert.equal(summary.deltaRiskStatus, 'MODERATE_LONG');
    assert.equal(summary.gammaRiskStatus, 'SAFE');
    assert.equal(summary.positionCount, 3);
  });

  test('TC-GRK-TEST-02: Delta-Neutral Futures Solver Precision & Lot Clamping', () => {
    const summary = calculatePortfolioGreeks(mockPositions, 24900, 'NIFTY 50');
    const hedge = solveDeltaNeutralHedge(summary, 'FUTURES', 0, 25);

    assert.equal(hedge.recommendedInstrument, 'FUTURES');
    assert.equal(hedge.side, 'SELL');
    // 53.5 / 25 = 2.14 -> 2 lots (50 Qty)
    assert.equal(hedge.recommendedLots, 2);
    assert.equal(hedge.recommendedQty, 50);
    assert.equal(hedge.projectedDeltaChange, -50);
    assert.equal(hedge.residualDelta, 3.5);
    assert.ok(Math.abs(hedge.residualDelta) < 10);
  });

  test('TC-GRK-TEST-03: Negative Delta Portfolio Hedging (Short Exposure)', () => {
    const shortPositions = [
      {
        id: 'POS-CE-SHORT',
        symbol: 'NIFTY 25000 CE',
        assetType: 'OPTION',
        side: 'SELL',
        quantity: 100,
        entryPrice: 130,
        currentPrice: 135,
        greeks: { delta: 0.55, gamma: 0.002, theta: -12, vega: 16 },
        lotSize: 25,
      },
    ];

    const summary = calculatePortfolioGreeks(shortPositions, 24900, 'NIFTY 50');
    assert.equal(summary.netDelta, -55);
    assert.equal(summary.deltaRiskStatus, 'MODERATE_SHORT');

    const hedge = solveDeltaNeutralHedge(summary, 'FUTURES', 0, 25);
    assert.equal(hedge.side, 'BUY');
    assert.equal(hedge.recommendedLots, 2);
    assert.equal(hedge.recommendedQty, 50);
    assert.equal(hedge.residualDelta, -5);
  });

  test('TC-GRK-TEST-04: ATM Options Hedging Solvers (CE and PE)', () => {
    const summary = calculatePortfolioGreeks(mockPositions, 24900, 'NIFTY 50');

    const ceHedge = solveDeltaNeutralHedge(summary, 'ATM_CALL', 0, 25);
    assert.equal(ceHedge.side, 'SELL');
    assert.ok(ceHedge.recommendedLots >= 4);

    const peHedge = solveDeltaNeutralHedge(summary, 'ATM_PUT', 0, 25);
    assert.equal(peHedge.side, 'BUY');
    assert.ok(peHedge.recommendedLots >= 4);
  });

  test('TC-GRK-TEST-05: Non-Linear Price Shock & Taylor Curvature Stress Model', () => {
    const summary = calculatePortfolioGreeks(mockPositions, 24900, 'NIFTY 50');
    const hedge = solveDeltaNeutralHedge(summary, 'FUTURES', 0, 25);
    const scenarios = simulatePriceShockScenarios(summary, [-2.0, -1.0, 1.0, 2.0], hedge);

    assert.equal(scenarios.length, 4);

    const plus1Scenario = scenarios.find((s) => s.shockPercent === 1.0);
    assert.ok(plus1Scenario);
    assert.ok(plus1Scenario.projectedUnderlying > 24900);
    assert.ok(plus1Scenario.unhedgedExpectedPnL > 0);
    assert.ok(Math.abs(plus1Scenario.hedgedExpectedPnL) < Math.abs(plus1Scenario.unhedgedExpectedPnL));
  });

  test('TC-GRK-TEST-06: 2D Curvature Curve Generation & Neutral Center Anchor', () => {
    const summary = calculatePortfolioGreeks(mockPositions, 24900, 'NIFTY 50');
    const hedge = solveDeltaNeutralHedge(summary, 'FUTURES', 0, 25);
    const curve = generateCurvaturePayoffCurve(summary, hedge, 21, 4.0);

    assert.equal(curve.length, 21);
    const centerPoint = curve.find((p) => p.percentShift === 0);
    assert.ok(centerPoint);
    assert.equal(centerPoint.unhedgedPnL, 0);
    assert.equal(centerPoint.hedgedPnL, 0);
  });

  test('TC-GRK-TEST-07: Auto-Rebalance Daemon Breach Detection & Execution Audit', () => {
    const summary = calculatePortfolioGreeks(mockPositions, 24900, 'NIFTY 50');

    const triggerResult = checkAutoRebalanceCondition(summary, {
      enabled: true,
      toleranceDelta: 25,
      preferredInstrument: 'FUTURES',
      maxHedgeLots: 4,
      lastRebalancedAt: null,
    });

    assert.equal(triggerResult.triggered, true);
    assert.ok(triggerResult.recommendation !== null);
    assert.equal(triggerResult.recommendation.side, 'SELL');

    const record = createHedgeExecution(triggerResult.recommendation, summary.netDelta);
    assert.ok(record.id.startsWith('HDG-'));
    assert.equal(record.status, 'FILLED');
    assert.equal(record.preDelta, 53.5);
    assert.equal(record.postDelta, 3.5);

    const noTriggerResult = checkAutoRebalanceCondition(summary, {
      enabled: true,
      toleranceDelta: 75,
      preferredInstrument: 'FUTURES',
      maxHedgeLots: 4,
      lastRebalancedAt: null,
    });

    assert.equal(noTriggerResult.triggered, false);
    assert.equal(noTriggerResult.recommendation, null);
  });
});
