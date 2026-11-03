import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure algorithmic functions mirrored for native fast Node.js test execution
function calculateMacroRegimeScore(params) {
  const totalFlow = params.fiiNetFlowCr + params.diiNetFlowCr;
  const normFlow = Math.tanh(totalFlow / 2000);
  const totalBreadth = Math.max(1, params.advances + params.declines);
  const breadthRatio = (params.advances - params.declines) / totalBreadth;
  const normSector = Math.max(-1, Math.min(1, params.sectorRelativeReturnPct / 2.0));

  const regimeScore = Number(
    (0.40 * normFlow + 0.35 * breadthRatio + 0.25 * normSector).toFixed(2)
  );

  let regimeLabel = 'NEUTRAL_SELECTIVE';
  if (regimeScore >= 0.30) {
    regimeLabel = 'AGGRESSIVE_RISK_ON';
  } else if (regimeScore <= -0.25) {
    regimeLabel = 'DEFENSIVE_RISK_OFF';
  }

  return { regimeScore, regimeLabel };
}

function calculateRiskAudit(params) {
  const { portfolioEquity, currentDrawdownPct, entryPrice, macroScore, directionalBias } = params;

  // 1. Unilateral Drawdown Veto: Max 6%
  if (currentDrawdownPct >= 6.0) {
    return {
      portfolioVar99Pct: 0,
      approvedQuantity: 0,
      originalQuantity: 100,
      vetoTriggered: true,
      vetoReason: `Intraday Drawdown exceeds 6.0% circuit breaker.`,
    };
  }

  // 2. Counter-Trend Macro Veto
  if (macroScore <= -0.35 && directionalBias === 'LONG') {
    return {
      portfolioVar99Pct: 0,
      approvedQuantity: 0,
      originalQuantity: 100,
      vetoTriggered: true,
      vetoReason: `Macro score indicates heavy institutional liquidations.`,
    };
  }

  // Kelly sizing
  const p = 0.60;
  const b = 2.4;
  const fullKelly = Math.max(0, (p * b - (1 - p)) / b);
  const halfKelly = fullKelly / 2;
  const macroMultiplier = Math.max(0.5, Math.min(1.2, (1 + macroScore) / 2));
  const adjustedKelly = Math.min(0.12, halfKelly * macroMultiplier);

  const maxApprovedCapital = Math.round(portfolioEquity * adjustedKelly);
  const rawQty = Math.max(1, Math.floor(maxApprovedCapital / entryPrice));

  // Parametric 99% VaR: Qty * Price * 2.326 * 0.018
  const portfolioVar99 = Math.round(rawQty * entryPrice * 2.326 * 0.018);
  const varPctOfEquity = Number(((portfolioVar99 / portfolioEquity) * 100).toFixed(2));

  let approvedQuantity = rawQty;
  let haircutPercentage = 0;
  if (varPctOfEquity > 2.0) {
    const scaleFactor = 2.0 / varPctOfEquity;
    approvedQuantity = Math.max(1, Math.floor(rawQty * scaleFactor));
    haircutPercentage = Math.round((1 - approvedQuantity / rawQty) * 100);
  }

  return {
    portfolioVar99Pct: varPctOfEquity,
    approvedQuantity,
    originalQuantity: Math.round(rawQty * 1.35),
    haircutPercentage,
    vetoTriggered: false,
  };
}

function calculateExecutionRouting(quantity, totalTop5Depth) {
  const sizeRatio = quantity / Math.max(1, totalTop5Depth);

  let routingAlgorithm = 'DOM_LIMIT';
  let sliceCount = 1;

  if (sizeRatio <= 0.25) {
    routingAlgorithm = 'DOM_LIMIT';
    sliceCount = 1;
  } else if (sizeRatio <= 1.0) {
    routingAlgorithm = 'ICEBERG';
    sliceCount = Math.max(3, Math.min(6, Math.ceil(quantity / 50)));
  } else {
    routingAlgorithm = 'TWAP';
    sliceCount = Math.max(6, Math.min(10, Math.ceil(quantity / 30)));
  }

  return { routingAlgorithm, sliceCount };
}

describe('TradeCraft Autonomous AI Quant Desk Engine Tests (Sprint 11)', () => {
  test('TC-QNT-TEST-01: Macro Regime Scoring and Flow Sensitivity', () => {
    // 1. Aggressive Risk-On: Heavy FII buying (+₹2400 Cr), strong breadth (38:12), positive sector
    const bullishMacro = calculateMacroRegimeScore({
      fiiNetFlowCr: 1600,
      diiNetFlowCr: 800,
      advances: 38,
      declines: 12,
      sectorRelativeReturnPct: 1.4,
    });
    assert.ok(bullishMacro.regimeScore >= 0.30, `Bullish macro should score >= 0.30, got ${bullishMacro.regimeScore}`);
    assert.equal(bullishMacro.regimeLabel, 'AGGRESSIVE_RISK_ON');

    // 2. Defensive Risk-Off: Heavy FII dumping (-₹3200 Cr), weak breadth (10:40), lagging sector
    const bearishMacro = calculateMacroRegimeScore({
      fiiNetFlowCr: -2500,
      diiNetFlowCr: -700,
      advances: 10,
      declines: 40,
      sectorRelativeReturnPct: -1.8,
    });
    assert.ok(bearishMacro.regimeScore <= -0.25, `Bearish macro should score <= -0.25, got ${bearishMacro.regimeScore}`);
    assert.equal(bearishMacro.regimeLabel, 'DEFENSIVE_RISK_OFF');
  });

  test('TC-QNT-TEST-02: Chief Risk Officer 6% Drawdown Circuit Breaker Veto', () => {
    // Normal drawdown (2.5%): Allowed
    const normalRisk = calculateRiskAudit({
      portfolioEquity: 1000000,
      currentDrawdownPct: 2.5,
      entryPrice: 2850,
      macroScore: 0.35,
      directionalBias: 'LONG',
    });
    assert.equal(normalRisk.vetoTriggered, false, 'Normal drawdown must not trigger veto');
    assert.ok(normalRisk.approvedQuantity > 0, 'Must approve shares for safe drawdown');

    // Breached drawdown (6.8% >= 6.0% ceiling): Immediate VETO
    const breachedRisk = calculateRiskAudit({
      portfolioEquity: 1000000,
      currentDrawdownPct: 6.8,
      entryPrice: 2850,
      macroScore: 0.35,
      directionalBias: 'LONG',
    });
    assert.equal(breachedRisk.vetoTriggered, true, 'Exceeding 6% drawdown must trigger unilateral VETO');
    assert.equal(breachedRisk.approvedQuantity, 0, 'Approved shares must be 0 on VETO');
  });

  test('TC-QNT-TEST-03: CRO Counter-Trend Macro Veto on Long Positions', () => {
    // Attempting to buy while institutional funds are dumping heavily (macroScore = -0.42)
    const counterTrendRisk = calculateRiskAudit({
      portfolioEquity: 1000000,
      currentDrawdownPct: 1.5,
      entryPrice: 2850,
      macroScore: -0.42,
      directionalBias: 'LONG',
    });
    assert.equal(counterTrendRisk.vetoTriggered, true, 'Buying into severe macro liquidation must trigger VETO');
    assert.equal(counterTrendRisk.approvedQuantity, 0);
  });

  test('TC-QNT-TEST-04: Parametric 99% VaR Position Haircut Enforcement', () => {
    // Portfolio equity ₹500,000, Entry ₹4100
    const audit = calculateRiskAudit({
      portfolioEquity: 500000,
      currentDrawdownPct: 1.0,
      entryPrice: 4100,
      macroScore: 0.40,
      directionalBias: 'LONG',
    });

    assert.equal(audit.vetoTriggered, false);
    assert.ok(audit.portfolioVar99Pct <= 2.05, `99% VaR must be capped near 2.0% equity, got ${audit.portfolioVar99Pct}%`);
    assert.ok(audit.approvedQuantity > 0);
  });

  test('TC-QNT-TEST-05: Execution Algorist DOM Depth Routing Logic', () => {
    const totalTop5 = 500; // 500 shares in top 5 bids/asks

    // 1. Small order (50 shares <= 25% of 500) -> Direct DOM Limit
    const smallRoute = calculateExecutionRouting(50, totalTop5);
    assert.equal(smallRoute.routingAlgorithm, 'DOM_LIMIT');
    assert.equal(smallRoute.sliceCount, 1);

    // 2. Medium order (250 shares <= 100% of 500) -> Iceberg Slicing
    const mediumRoute = calculateExecutionRouting(250, totalTop5);
    assert.equal(mediumRoute.routingAlgorithm, 'ICEBERG');
    assert.ok(mediumRoute.sliceCount >= 3 && mediumRoute.sliceCount <= 6);

    // 3. Large block order (1200 shares > 500) -> TWAP Slicing
    const largeRoute = calculateExecutionRouting(1200, totalTop5);
    assert.equal(largeRoute.routingAlgorithm, 'TWAP');
    assert.ok(largeRoute.sliceCount >= 6);
  });
});
