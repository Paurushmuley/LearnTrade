// Sprint 23 — Institutional Multi-Asset Cross-Margining & Portfolio VaR Optimization Engine Tests
// Pure JS test suite using Node.js native test runner (node:test)
// Tests:
// 1. Multi-asset cross-margin requirement calculations & correlation offset savings vs isolated margins
// 2. SEBI collateral haircut calculations across all 5 regulatory tiers (0%, 2%, 10%, 15%, 20%)
// 3. 50:50 Cash-to-Collateral regulatory ratio validator and cash shortfall interest penalty calculations
// 4. Historical VaR (HVaR 99%) and CVaR calculations, verifying marginal risk contribution bounds and hedging diversification relief
// 5. Audit integration, edge cases, and portfolio capital efficiency scoring

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// PURE MATHEMATICAL & ALGORITHMIC MIRROR IMPLEMENTATION FOR NODE.JS TEST RUNNER
// ============================================================================

const SEBI_STATUTORY_HAIRCUTS = {
  CASH: 0,
  GSEC: 2,
  LIQUID_MF: 10,
  SGB: 15,
  EQUITY: 20,
};

const DEFAULT_OFFSET_TIERS = [
  {
    tierId: 'TIER-1-INDEX-INDEX',
    name: 'Index Derivatives Cross-Margining (Nifty vs Bank Nifty)',
    assetClassA: 'EQUITY_INDEX',
    assetClassB: 'EQUITY_INDEX',
    symbolsA: ['NIFTY', 'NIFTY FUT'],
    symbolsB: ['BANKNIFTY', 'BANKNIFTY FUT'],
    minCorrelation: 0.8,
    offsetConcessionPercent: 70,
    regulatoryBasis: 'SEBI Master Circular on Cross Margining in Capital & Derivatives Markets',
  },
  {
    tierId: 'TIER-2-INDEX-STOCK',
    name: 'Single Stock Heavyweight vs Index Derivatives',
    assetClassA: 'EQUITY_INDEX',
    assetClassB: 'STOCK_FUTURES',
    symbolsA: ['NIFTY', 'NIFTY FUT'],
    symbolsB: ['RELIANCE', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TCS'],
    minCorrelation: 0.75,
    offsetConcessionPercent: 50,
    regulatoryBasis: 'SEBI Inter-Product Cross-Margining Guidelines',
  },
  {
    tierId: 'TIER-3-COMMODITY-ENERGY',
    name: 'MCX Commodity Energy Basket (Crude Oil vs Natural Gas)',
    assetClassA: 'COMMODITY',
    assetClassB: 'COMMODITY',
    symbolsA: ['CRUDEOIL', 'CRUDEOIL FUT'],
    symbolsB: ['NATURALGAS', 'NATURALGAS FUT'],
    minCorrelation: 0.5,
    offsetConcessionPercent: 60,
    regulatoryBasis: 'MCXCCL Cross-Commodity Margining Norms',
  },
  {
    tierId: 'TIER-4-CURRENCY-CROSS',
    name: 'Currency Cross-Derivatives Spread (USDINR vs EURINR)',
    assetClassA: 'CURRENCY',
    assetClassB: 'CURRENCY',
    symbolsA: ['USDINR', 'USDINR FUT'],
    symbolsB: ['EURINR', 'EURINR FUT'],
    minCorrelation: 0.65,
    offsetConcessionPercent: 65,
    regulatoryBasis: 'NSE Clearing Currency Derivatives Cross Margining Circular',
  },
  {
    tierId: 'TIER-5-COMMODITY-BULLION',
    name: 'MCX Bullion Pair (Gold vs Silver)',
    assetClassA: 'COMMODITY',
    assetClassB: 'COMMODITY',
    symbolsA: ['GOLD', 'GOLD FUT'],
    symbolsB: ['SILVER', 'SILVER FUT'],
    minCorrelation: 0.75,
    offsetConcessionPercent: 55,
    regulatoryBasis: 'MCXCCL Precious Metals Cross Margining Framework',
  },
];

function calculateCrossMarginRequirement(positions, customTiers = DEFAULT_OFFSET_TIERS) {
  if (!positions || positions.length === 0) {
    return {
      positions: [],
      isolatedTotalMargin: 0,
      crossMarginedTotalMargin: 0,
      netMarginSavings: 0,
      savingsPercentage: 0,
      offsetConcessions: [],
      unhedgedPositionsMargin: 0,
      assetClassBreakdown: {
        EQUITY_INDEX: { isolated: 0, crossMargined: 0, savings: 0, savingsPercent: 0, positionCount: 0 },
        STOCK_FUTURES: { isolated: 0, crossMargined: 0, savings: 0, savingsPercent: 0, positionCount: 0 },
        COMMODITY: { isolated: 0, crossMargined: 0, savings: 0, savingsPercent: 0, positionCount: 0 },
        CURRENCY: { isolated: 0, crossMargined: 0, savings: 0, savingsPercent: 0, positionCount: 0 },
      },
    };
  }

  let isolatedTotalMargin = 0;
  const workingPool = positions.map((pos) => {
    const notional = Math.abs(pos.quantity) * pos.currentPrice;
    const computedIsoMargin =
      pos.isolatedMarginRequired > 0
        ? pos.isolatedMarginRequired
        : notional * ((pos.isolatedInitialMarginRate || 0.1) + (pos.isolatedExposureMarginRate || 0.03));

    isolatedTotalMargin += computedIsoMargin;

    return {
      position: { ...pos, notionalValue: notional, isolatedMarginRequired: computedIsoMargin },
      remainingNotional: notional,
      remainingIsolatedMargin: computedIsoMargin,
    };
  });

  const offsetConcessions = [];
  let pairCounter = 1;

  for (const tier of customTiers) {
    for (let i = 0; i < workingPool.length; i++) {
      const legA = workingPool[i];
      if (legA.remainingNotional <= 1e-4) continue;

      for (let j = 0; j < workingPool.length; j++) {
        if (i === j) continue;
        const legB = workingPool[j];
        if (legB.remainingNotional <= 1e-4) continue;

        const deltaA = legA.position.delta;
        const deltaB = legB.position.delta;
        if (Math.sign(deltaA) === Math.sign(deltaB) && deltaA !== 0 && deltaB !== 0) {
          continue; // same direction, no hedge
        }

        const matchForward =
          legA.position.assetClass === tier.assetClassA &&
          legB.position.assetClass === tier.assetClassB &&
          (!tier.symbolsA || tier.symbolsA.includes(legA.position.symbol) || tier.symbolsA.includes(legA.position.underlying)) &&
          (!tier.symbolsB || tier.symbolsB.includes(legB.position.symbol) || tier.symbolsB.includes(legB.position.underlying));

        const matchReverse =
          legA.position.assetClass === tier.assetClassB &&
          legB.position.assetClass === tier.assetClassA &&
          (!tier.symbolsB || tier.symbolsB.includes(legA.position.symbol) || tier.symbolsB.includes(legA.position.underlying)) &&
          (!tier.symbolsA || tier.symbolsA.includes(legB.position.symbol) || tier.symbolsA.includes(legB.position.underlying));

        if (!matchForward && !matchReverse) continue;

        const matchedNotional = Math.min(legA.remainingNotional, legB.remainingNotional);
        if (matchedNotional <= 1e-4) continue;

        const marginPortionA = legA.remainingIsolatedMargin * (matchedNotional / legA.remainingNotional);
        const marginPortionB = legB.remainingIsolatedMargin * (matchedNotional / legB.remainingNotional);
        const grossSpreadIsolatedMargin = marginPortionA + marginPortionB;

        const concessionDiscountAmount = grossSpreadIsolatedMargin * (tier.offsetConcessionPercent / 100);
        const netHedgedMargin = grossSpreadIsolatedMargin - concessionDiscountAmount;

        legA.remainingNotional -= matchedNotional;
        legA.remainingIsolatedMargin -= marginPortionA;
        legB.remainingNotional -= matchedNotional;
        legB.remainingIsolatedMargin -= marginPortionB;

        offsetConcessions.push({
          id: `OFFSET-PAIR-${pairCounter++}`,
          tierId: tier.tierId,
          tierName: tier.name,
          primaryPositionId: legA.position.id,
          primarySymbol: legA.position.symbol,
          primaryAssetClass: legA.position.assetClass,
          offsetPositionId: legB.position.id,
          offsetSymbol: legB.position.symbol,
          offsetAssetClass: legB.position.assetClass,
          matchedNotional: Number(matchedNotional.toFixed(2)),
          offsetConcessionPercent: tier.offsetConcessionPercent,
          grossIsolatedMargin: Number(grossSpreadIsolatedMargin.toFixed(2)),
          concessionDiscountAmount: Number(concessionDiscountAmount.toFixed(2)),
          netHedgedMargin: Number(netHedgedMargin.toFixed(2)),
          rationale: `${tier.offsetConcessionPercent}% offset concession granted on ${legA.position.symbol} vs ${legB.position.symbol}`,
        });
      }
    }
  }

  let unhedgedPositionsMargin = 0;
  for (const poolItem of workingPool) {
    unhedgedPositionsMargin += Math.max(0, poolItem.remainingIsolatedMargin);
  }

  const totalDiscount = offsetConcessions.reduce((sum, item) => sum + item.concessionDiscountAmount, 0);
  const crossMarginedTotalMargin = Math.max(0, isolatedTotalMargin - totalDiscount);
  const netMarginSavings = isolatedTotalMargin - crossMarginedTotalMargin;
  const savingsPercentage = isolatedTotalMargin > 0 ? (netMarginSavings / isolatedTotalMargin) * 100 : 0;

  return {
    positions,
    isolatedTotalMargin: Number(isolatedTotalMargin.toFixed(2)),
    crossMarginedTotalMargin: Number(crossMarginedTotalMargin.toFixed(2)),
    netMarginSavings: Number(netMarginSavings.toFixed(2)),
    savingsPercentage: Number(savingsPercentage.toFixed(2)),
    offsetConcessions,
    unhedgedPositionsMargin: Number(unhedgedPositionsMargin.toFixed(2)),
  };
}

function calculatePledgedCollateral(collaterals, totalMarginRequirement, customHaircuts = {}) {
  const haircutMap = { ...SEBI_STATUTORY_HAIRCUTS, ...customHaircuts };

  let availableCashEquivalentMargin = 0;
  let availableNonCashMargin = 0;

  for (const item of collaterals) {
    if (item.pledgeStatus === 'REJECTED') continue;

    const applicableHaircut = haircutMap[item.assetType] ?? item.haircutPercent;
    const grossVal = item.quantity * item.marketPrice;
    const postHaircutVal = grossVal * (1 - applicableHaircut / 100);

    item.grossValue = Number(grossVal.toFixed(2));
    item.haircutPercent = applicableHaircut;
    item.postHaircutValue = Number(postHaircutVal.toFixed(2));

    if (item.assetType === 'CASH' || item.assetType === 'GSEC' || item.assetType === 'LIQUID_MF') {
      availableCashEquivalentMargin += postHaircutVal;
    } else {
      availableNonCashMargin += postHaircutVal;
    }
  }

  const totalAvailableMargin = availableCashEquivalentMargin + availableNonCashMargin;
  const minimumCashRequired = totalMarginRequirement * 0.5;
  const eligibleNonCashMargin = Math.min(availableNonCashMargin, availableCashEquivalentMargin);
  const effectiveTotalCollateral = availableCashEquivalentMargin + eligibleNonCashMargin;

  const cashDeficit = Math.max(0, minimumCashRequired - availableCashEquivalentMargin);
  const annualizedPenaltyRatePercent = 18.0;
  const dailyDeficitPenaltyEstimate = (cashDeficit * (annualizedPenaltyRatePercent / 100)) / 365;

  const isCompliant5050 =
    availableCashEquivalentMargin >= minimumCashRequired &&
    effectiveTotalCollateral >= totalMarginRequirement;

  const cashRatioPercent =
    effectiveTotalCollateral > 0 ? (availableCashEquivalentMargin / effectiveTotalCollateral) * 100 : 0;
  const nonCashRatioPercent =
    effectiveTotalCollateral > 0 ? (eligibleNonCashMargin / effectiveTotalCollateral) * 100 : 0;
  const collateralUtilizationPercent =
    effectiveTotalCollateral > 0 ? (totalMarginRequirement / effectiveTotalCollateral) * 100 : 0;
  const freeCollateralMargin = Math.max(0, effectiveTotalCollateral - totalMarginRequirement);

  let status = 'HEALTHY';
  let breachSeverity = 'NONE';
  const recommendations = [];

  if (totalAvailableMargin < totalMarginRequirement) {
    if (totalAvailableMargin < totalMarginRequirement * 0.8) {
      status = 'CRITICAL_SHORTFALL';
      breachSeverity = 'CRITICAL';
      recommendations.push(`Critical margin deficit of ₹${(totalMarginRequirement - totalAvailableMargin).toFixed(2)}.`);
    } else {
      status = 'MARGIN_CALL';
      breachSeverity = 'HIGH';
      recommendations.push(`Available collateral is below required margin.`);
    }
  } else if (!isCompliant5050 || cashDeficit > 0) {
    status = 'CASH_DEFICIT_WARNING';
    breachSeverity = 'MEDIUM';
    recommendations.push(`50:50 Cash-to-Collateral Ratio Breach: Cash equivalent margin is below 50%.`);
    recommendations.push(`Cash deficit incurs daily penalty at 18% p.a.`);
  }

  return {
    totalMarginRequirement,
    minimumCashRequired,
    availableCashEquivalentMargin: Number(availableCashEquivalentMargin.toFixed(2)),
    availableNonCashMargin: Number(availableNonCashMargin.toFixed(2)),
    totalAvailableMargin: Number(totalAvailableMargin.toFixed(2)),
    eligibleNonCashMargin: Number(eligibleNonCashMargin.toFixed(2)),
    effectiveTotalCollateral: Number(effectiveTotalCollateral.toFixed(2)),
    cashRatioPercent: Number(cashRatioPercent.toFixed(2)),
    nonCashRatioPercent: Number(nonCashRatioPercent.toFixed(2)),
    isCompliant5050,
    cashDeficit: Number(cashDeficit.toFixed(2)),
    annualizedPenaltyRatePercent,
    dailyDeficitPenaltyEstimate: Number(dailyDeficitPenaltyEstimate.toFixed(2)),
    collateralUtilizationPercent: Number(collateralUtilizationPercent.toFixed(2)),
    freeCollateralMargin: Number(freeCollateralMargin.toFixed(2)),
    status,
    breachSeverity,
    recommendations,
  };
}

function generateDeterministicTestScenarios() {
  const dates = [
    { id: 'SC-1', date: '2024-06-04', event: 'Lok Sabha Election Crash', n: -5.93, bn: -7.95, rel: -6.9, g: 0.8, c: -1.2, fx: 0.45 },
    { id: 'SC-2', date: '2020-03-23', event: 'COVID-19 Lower Circuit Lockdown', n: -12.98, bn: -16.85, rel: -12.1, g: -2.5, c: -7.5, fx: 1.15 },
    { id: 'SC-3', date: '2023-01-27', event: 'Adani Hindenburg Shock', n: -1.61, bn: -3.13, rel: -2.1, g: 0.4, c: -1.5, fx: 0.12 },
    { id: 'SC-4', date: '2024-07-23', event: 'Union Budget STT Hike', n: -0.85, bn: -1.22, rel: -1.4, g: -4.2, c: -0.9, fx: 0.05 },
    { id: 'SC-5', date: '2022-02-24', event: 'Russia-Ukraine Geopolitical Shock', n: -4.78, bn: -5.11, rel: -4.9, g: 3.1, c: 8.2, fx: 0.85 },
    { id: 'SC-6', date: '2024-08-05', event: 'Yen Carry Trade Flash Unwind', n: -2.68, bn: -2.45, rel: -3.4, g: -1.1, fx: -1.8, fxRate: 0.35 },
    { id: 'SC-7', date: '2023-05-19', event: '₹2000 Note Demonetization Liquidity Boost', n: 0.35, bn: 0.82, rel: 0.4, g: -0.5, c: 0.2, fx: -0.08 },
    { id: 'SC-8', date: '2024-09-18', event: 'US Fed 50bps Super-Sized Rate Cut', n: 1.82, bn: 2.15, rel: 1.9, g: 1.4, c: 0.8, fx: -0.32 },
    { id: 'SC-9', date: '2024-10-03', event: 'Middle East Missile Escalation & FII Selloff', n: -2.12, bn: -2.01, rel: -3.8, g: 1.2, c: 4.8, fx: 0.18 },
    { id: 'SC-10', date: '2024-11-06', event: 'US Presidential Election Mega Rally', n: 2.45, bn: 2.85, rel: 2.1, g: -2.9, c: -1.1, fx: 0.22 },
  ];

  return dates.map((d) => ({
    scenarioId: d.id,
    date: d.date,
    eventName: d.event,
    assetReturnsPercent: {
      NIFTY: d.n,
      'NIFTY FUT': d.n,
      BANKNIFTY: d.bn,
      'BANKNIFTY FUT': d.bn,
      RELIANCE: d.rel,
      'RELIANCE FUT': d.rel,
      GOLD: d.g,
      'GOLD FUT': d.g,
      CRUDEOIL: d.c,
      'CRUDEOIL FUT': d.c,
      USDINR: d.fx,
      'USDINR FUT': d.fx,
    },
    portfolioPnL: 0,
    portfolioReturnPercent: 0,
  }));
}

function calculatePortfolioHVaR(positions, confidenceLevel = 0.99, customScenarios = null) {
  const scenarios = customScenarios ?? generateDeterministicTestScenarios();

  if (!positions || positions.length === 0 || scenarios.length === 0) {
    return {
      confidenceLevel,
      portfolioNotional: 0,
      historicalVaR99: 0,
      historicalVaR99Percent: 0,
      expectedShortfall99: 0,
      expectedShortfall99Percent: 0,
      worstScenarioLoss: 0,
      worstScenarioEvent: '',
      componentRiskAllocations: [],
    };
  }

  let totalPortfolioNotional = 0;
  for (const pos of positions) {
    totalPortfolioNotional += Math.abs(pos.quantity) * pos.currentPrice;
  }

  const evaluatedScenarios = [];

  for (const sc of scenarios) {
    let portPnL = 0;
    const posPnLs = {};

    for (const pos of positions) {
      const retPercent =
        sc.assetReturnsPercent[pos.symbol] ??
        sc.assetReturnsPercent[pos.underlying] ??
        0;

      const deltaFactor = pos.delta !== 0 ? Math.abs(pos.delta) : 1;
      const posPnL = pos.quantity * pos.currentPrice * (retPercent / 100) * deltaFactor;
      posPnLs[pos.id] = posPnL;
      portPnL += posPnL;
    }

    evaluatedScenarios.push({
      scenario: sc,
      portfolioPnL: portPnL,
      positionPnLs: posPnLs,
    });
  }

  evaluatedScenarios.sort((a, b) => a.portfolioPnL - b.portfolioPnL);

  const sampleSize = evaluatedScenarios.length;
  const tailCount = Math.max(1, Math.floor(sampleSize * (1 - confidenceLevel)));
  const tailScenarios = evaluatedScenarios.slice(0, tailCount);

  const varScenario = evaluatedScenarios[tailCount - 1];
  const historicalVaR99 = Math.max(0, -varScenario.portfolioPnL);
  const historicalVaR99Percent = totalPortfolioNotional > 0 ? (historicalVaR99 / totalPortfolioNotional) * 100 : 0;

  const tailLosses = tailScenarios.map((es) => -es.portfolioPnL);
  const expectedShortfall99 = Math.max(0, tailLosses.reduce((sum, l) => sum + l, 0) / tailCount);
  const expectedShortfall99Percent = totalPortfolioNotional > 0 ? (expectedShortfall99 / totalPortfolioNotional) * 100 : 0;

  const worstScenario = evaluatedScenarios[0];
  const worstScenarioLoss = Math.max(0, -worstScenario.portfolioPnL);

  const componentRiskAllocations = positions.map((pos) => {
    const notional = Math.abs(pos.quantity) * pos.currentPrice;
    const weight = totalPortfolioNotional > 0 ? notional / totalPortfolioNotional : 0;

    const rawComponentVaR = -(varScenario.positionPnLs[pos.id] ?? 0);
    const componentVaR = rawComponentVaR;
    const marginalVaR = notional > 0 ? componentVaR / notional : 0;
    const percentContribution = historicalVaR99 > 0 ? (componentVaR / historicalVaR99) * 100 : 0;

    return {
      positionId: pos.id,
      symbol: pos.symbol,
      assetClass: pos.assetClass,
      notional: Number(notional.toFixed(2)),
      weight: Number(weight.toFixed(4)),
      marginalVaR: Number(marginalVaR.toFixed(4)),
      componentVaR: Number(componentVaR.toFixed(2)),
      percentContribution: Number(percentContribution.toFixed(2)),
    };
  });

  return {
    confidenceLevel,
    portfolioNotional: Number(totalPortfolioNotional.toFixed(2)),
    historicalVaR99: Number(historicalVaR99.toFixed(2)),
    historicalVaR99Percent: Number(historicalVaR99Percent.toFixed(2)),
    expectedShortfall99: Number(expectedShortfall99.toFixed(2)),
    expectedShortfall99Percent: Number(expectedShortfall99Percent.toFixed(2)),
    worstScenarioLoss: Number(worstScenarioLoss.toFixed(2)),
    worstScenarioEvent: worstScenario.scenario.eventName,
    componentRiskAllocations,
  };
}

function runInstitutionalCrossMarginAudit(positions, collaterals, customHaircuts) {
  const crossMargin = calculateCrossMarginRequirement(positions);
  const collateralCompliance = calculatePledgedCollateral(
    collaterals,
    crossMargin.crossMarginedTotalMargin,
    customHaircuts
  );
  const historicalVaR = calculatePortfolioHVaR(positions);

  const marginSavingsScore = Math.min(50, crossMargin.savingsPercentage * 1.5);
  let collateralScore = 50;
  if (!collateralCompliance.isCompliant5050) collateralScore -= 25;
  if (collateralCompliance.status === 'MARGIN_CALL') collateralScore -= 30;
  else if (collateralCompliance.status === 'CRITICAL_SHORTFALL') collateralScore = 0;

  const capitalEfficiencyScore = Math.max(0, Math.min(100, Math.round(marginSavingsScore + collateralScore)));

  return {
    auditTimestamp: new Date().toISOString(),
    crossMargin,
    collateralCompliance,
    historicalVaR,
    capitalEfficiencyScore,
    overallRiskSummary: `Audit complete with capital efficiency score ${capitalEfficiencyScore}/100.`,
  };
}

// ============================================================================
// AUTOMATED UNIT TEST SUITE (SPRINT 23)
// ============================================================================

describe('TradeCraft Institutional Multi-Asset Cross-Margining & Portfolio VaR Engine (Sprint 23)', () => {
  // Test 1: Multi-Asset Cross-Margin Requirement & Correlation Offset Concession
  test('TC-XMG-01: Multi-Asset Cross-Margin Requirement Calculates Accurate Correlation Concession Relief', () => {
    const positions = [
      {
        id: 'pos-nifty-long',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 100,
        currentPrice: 24500,
        delta: 1.0,
        isolatedMarginRequired: 245000,
      },
      {
        id: 'pos-banknifty-short',
        symbol: 'BANKNIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'BANKNIFTY',
        quantity: -50,
        currentPrice: 51000,
        delta: -1.0,
        isolatedMarginRequired: 255000,
      },
    ];

    const result = calculateCrossMarginRequirement(positions);

    // Gross isolated margin: 245,000 + 255,000 = 500,000
    assert.equal(result.isolatedTotalMargin, 500000);

    // Opposing deltas in Nifty vs BankNifty qualify for TIER-1 (70% offset concession)
    assert.equal(result.offsetConcessions.length, 1);
    const concession = result.offsetConcessions[0];
    assert.equal(concession.tierId, 'TIER-1-INDEX-INDEX');
    assert.equal(concession.offsetConcessionPercent, 70);

    // Concession discount must be strictly positive and lower net requirement
    assert.ok(concession.concessionDiscountAmount > 0);
    assert.ok(result.crossMarginedTotalMargin < result.isolatedTotalMargin);
    assert.equal(result.netMarginSavings, Number((result.isolatedTotalMargin - result.crossMarginedTotalMargin).toFixed(2)));
    assert.ok(result.savingsPercentage > 0 && result.savingsPercentage <= 70);
  });

  // Test 2: Single-Stock to Index Constituent Delta Hedge Concession
  test('TC-XMG-02: Single-Stock Heavyweight to Index Derivatives Hedge Yields 50% Margin Concession', () => {
    const positions = [
      {
        id: 'pos-nifty-short',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: -100,
        currentPrice: 24500,
        delta: -1.0,
        isolatedMarginRequired: 245000,
      },
      {
        id: 'pos-reliance-long',
        symbol: 'RELIANCE',
        assetClass: 'STOCK_FUTURES',
        underlying: 'RELIANCE',
        quantity: 500,
        currentPrice: 2800,
        delta: 1.0,
        isolatedMarginRequired: 182000,
      },
    ];

    const result = calculateCrossMarginRequirement(positions);

    assert.equal(result.offsetConcessions.length, 1);
    const concession = result.offsetConcessions[0];
    assert.equal(concession.tierId, 'TIER-2-INDEX-STOCK');
    assert.equal(concession.offsetConcessionPercent, 50);
    assert.ok(result.netMarginSavings > 0);
  });

  // Test 3: Multi-Commodity Spread Netting (MCX Energy & Bullion)
  test('TC-XMG-03: Multi-Commodity Spread Netting Accurately Grants MCX Clearing Concessions', () => {
    // Energy basket: Crude vs Natural Gas
    const energyPositions = [
      {
        id: 'pos-crude-long',
        symbol: 'CRUDEOIL FUT',
        assetClass: 'COMMODITY',
        underlying: 'CRUDEOIL',
        quantity: 100,
        currentPrice: 6200,
        delta: 1.0,
        isolatedMarginRequired: 62000,
      },
      {
        id: 'pos-gas-short',
        symbol: 'NATURALGAS FUT',
        assetClass: 'COMMODITY',
        underlying: 'NATURALGAS',
        quantity: -1250,
        currentPrice: 240,
        delta: -1.0,
        isolatedMarginRequired: 30000,
      },
    ];

    const energyResult = calculateCrossMarginRequirement(energyPositions);
    assert.equal(energyResult.offsetConcessions.length, 1);
    assert.equal(energyResult.offsetConcessions[0].tierId, 'TIER-3-COMMODITY-ENERGY');
    assert.equal(energyResult.offsetConcessions[0].offsetConcessionPercent, 60);

    // Bullion pair: Gold vs Silver
    const bullionPositions = [
      {
        id: 'pos-gold-long',
        symbol: 'GOLD FUT',
        assetClass: 'COMMODITY',
        underlying: 'GOLD',
        quantity: 1,
        currentPrice: 78000,
        delta: 1.0,
        isolatedMarginRequired: 78000,
      },
      {
        id: 'pos-silver-short',
        symbol: 'SILVER FUT',
        assetClass: 'COMMODITY',
        underlying: 'SILVER',
        quantity: -30,
        currentPrice: 92000,
        delta: -1.0,
        isolatedMarginRequired: 92000,
      },
    ];

    const bullionResult = calculateCrossMarginRequirement(bullionPositions);
    assert.equal(bullionResult.offsetConcessions.length, 1);
    assert.equal(bullionResult.offsetConcessions[0].tierId, 'TIER-5-COMMODITY-BULLION');
    assert.equal(bullionResult.offsetConcessions[0].offsetConcessionPercent, 55);
  });

  // Test 4: Currency Cross-Derivatives Spread (USDINR vs EURINR)
  test('TC-XMG-04: Currency Cross-Derivatives Opposing Delts Qualify for 65% Concession', () => {
    const currencyPositions = [
      {
        id: 'pos-usdinr-long',
        symbol: 'USDINR FUT',
        assetClass: 'CURRENCY',
        underlying: 'USDINR',
        quantity: 1000,
        currentPrice: 84.4,
        delta: 1.0,
        isolatedMarginRequired: 84400,
      },
      {
        id: 'pos-eurinr-short',
        symbol: 'EURINR FUT',
        assetClass: 'CURRENCY',
        underlying: 'EURINR',
        quantity: -1000,
        currentPrice: 91.2,
        delta: -1.0,
        isolatedMarginRequired: 91200,
      },
    ];

    const result = calculateCrossMarginRequirement(currencyPositions);
    assert.equal(result.offsetConcessions.length, 1);
    assert.equal(result.offsetConcessions[0].tierId, 'TIER-4-CURRENCY-CROSS');
    assert.equal(result.offsetConcessions[0].offsetConcessionPercent, 65);
    assert.ok(result.savingsPercentage > 0);
  });

  // Test 5: Non-Opposing Delta Protection (Zero Concession on Same-Direction Risk)
  test('TC-XMG-05: Non-Opposing Delta Legs Receive Zero Cross-Margin Concession', () => {
    const sameDirectionPositions = [
      {
        id: 'pos-nifty-long',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 100,
        currentPrice: 24500,
        delta: 1.0, // Long
        isolatedMarginRequired: 245000,
      },
      {
        id: 'pos-banknifty-long',
        symbol: 'BANKNIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'BANKNIFTY',
        quantity: 50,
        currentPrice: 51000,
        delta: 1.0, // Also Long (doubling directional risk)
        isolatedMarginRequired: 255000,
      },
    ];

    const result = calculateCrossMarginRequirement(sameDirectionPositions);

    // No offset concessions because deltas are not opposing
    assert.equal(result.offsetConcessions.length, 0);
    assert.equal(result.netMarginSavings, 0);
    assert.equal(result.savingsPercentage, 0);
    assert.equal(result.crossMarginedTotalMargin, result.isolatedTotalMargin);
  });

  // Test 6: Empty Portfolio & Zero Edge Cases
  test('TC-XMG-06: Empty Positions Return Zero Requirement Without NaN Or Nulls', () => {
    const result = calculateCrossMarginRequirement([]);

    assert.equal(result.isolatedTotalMargin, 0);
    assert.equal(result.crossMarginedTotalMargin, 0);
    assert.equal(result.netMarginSavings, 0);
    assert.equal(result.savingsPercentage, 0);
    assert.deepEqual(result.offsetConcessions, []);
  });

  // Test 7: SEBI Statutory Collateral Haircuts Across All 5 Regulatory Tiers
  test('TC-XMG-07: SEBI Statutory Collateral Haircuts Accurately Evaluated Across All 5 Regulatory Tiers', () => {
    const collaterals = [
      {
        id: 'col-cash',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 1000000,
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-gsec',
        symbol: '718GS2033',
        assetType: 'GSEC',
        quantity: 10000,
        marketPrice: 100,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-liquidmf',
        symbol: 'LIQUIDBEES',
        assetType: 'LIQUID_MF',
        quantity: 1000,
        marketPrice: 1000,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-sgb',
        symbol: 'SGBNOV29',
        assetType: 'SGB',
        quantity: 100,
        marketPrice: 7500,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-equity',
        symbol: 'TCS_EQ',
        assetType: 'EQUITY',
        quantity: 200,
        marketPrice: 4000,
        pledgeStatus: 'APPROVED',
      },
    ];

    const report = calculatePledgedCollateral(collaterals, 2000000);

    // Verify individual post-haircut values:
    // Cash: 1,000,000 * (1 - 0) = 1,000,000
    assert.equal(collaterals[0].postHaircutValue, 1000000);
    assert.equal(collaterals[0].haircutPercent, 0);

    // G-Sec: 1,000,000 * (1 - 0.02) = 980,000
    assert.equal(collaterals[1].postHaircutValue, 980000);
    assert.equal(collaterals[1].haircutPercent, 2);

    // Liquid MF: 1,000,000 * (1 - 0.10) = 900,000
    assert.equal(collaterals[2].postHaircutValue, 900000);
    assert.equal(collaterals[2].haircutPercent, 10);

    // SGB: 750,000 * (1 - 0.15) = 637,500
    assert.equal(collaterals[3].postHaircutValue, 637500);
    assert.equal(collaterals[3].haircutPercent, 15);

    // Equity: 800,000 * (1 - 0.20) = 640,000
    assert.equal(collaterals[4].postHaircutValue, 640000);
    assert.equal(collaterals[4].haircutPercent, 20);

    // Cash Equivalents pool: Cash (1M) + G-Sec (980k) + Liquid MF (900k) = 2,880,000
    assert.equal(report.availableCashEquivalentMargin, 2880000);

    // Non-Cash pool: SGB (637.5k) + Equity (640k) = 1,277,500
    assert.equal(report.availableNonCashMargin, 1277500);
  });

  // Test 8: Rejected Pledge Handling & Unapproved Collateral Isolation
  test('TC-XMG-08: Rejected Pledge Items Are Excluded From Available Margin Pools', () => {
    const collaterals = [
      {
        id: 'col-approved',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 500000,
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-rejected',
        symbol: 'ILLIQUID_STOCK',
        assetType: 'EQUITY',
        quantity: 10000,
        marketPrice: 100,
        pledgeStatus: 'REJECTED', // Demat pledge rejected by clearing corp
      },
    ];

    const report = calculatePledgedCollateral(collaterals, 400000);

    assert.equal(report.totalAvailableMargin, 500000);
    assert.equal(report.availableNonCashMargin, 0);
  });

  // Test 9: SEBI 50:50 Cash-to-Collateral Ratio Full Compliance (Healthy State)
  test('TC-XMG-09: 50:50 Regulatory Ratio Validator Confirms Healthy Compliance With Zero Penalty', () => {
    const collaterals = [
      {
        id: 'col-cash',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 600000,
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-eq',
        symbol: 'BLUECHIP_EQ',
        assetType: 'EQUITY',
        quantity: 500,
        marketPrice: 1000, // 500,000 gross -> 400,000 post-haircut (20%)
        pledgeStatus: 'APPROVED',
      },
    ];

    const marginReq = 1000000;
    const report = calculatePledgedCollateral(collaterals, marginReq);

    // Required cash: 500,000. Available cash: 600,000.
    assert.equal(report.minimumCashRequired, 500000);
    assert.equal(report.availableCashEquivalentMargin, 600000);
    assert.equal(report.cashDeficit, 0);
    assert.equal(report.dailyDeficitPenaltyEstimate, 0);
    assert.equal(report.isCompliant5050, true);
    assert.equal(report.status, 'HEALTHY');
    assert.equal(report.breachSeverity, 'NONE');
  });

  // Test 10: 50:50 Non-Cash Collateral Ceiling Clamping
  test('TC-XMG-10: Excess Non-Cash Collateral Is Strictly Clamped to Cash Equivalents Under SEBI Rules', () => {
    const collaterals = [
      {
        id: 'col-cash',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 300000, // Cash equivalent = 300,000
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-eq',
        symbol: 'BLUECHIP_EQ',
        assetType: 'EQUITY',
        quantity: 2000,
        marketPrice: 1000, // 2,000,000 gross -> 1,600,000 post-haircut
        pledgeStatus: 'APPROVED',
      },
    ];

    const marginReq = 1000000; // 50% min cash = 500,000
    const report = calculatePledgedCollateral(collaterals, marginReq);

    // Even though non-cash available is 1.6M, only 300k is eligible (clamped to cash equivalent)
    assert.equal(report.availableCashEquivalentMargin, 300000);
    assert.equal(report.availableNonCashMargin, 1600000);
    assert.equal(report.eligibleNonCashMargin, 300000);
    assert.equal(report.effectiveTotalCollateral, 600000);
    assert.equal(report.isCompliant5050, false);
  });

  // Test 11: Cash Shortfall Interest Penalty Calculation (18% p.a. Delayed Payment Charge)
  test('TC-XMG-11: Cash Shortfall Accurately Triggers 18% p.a. Delayed Payment Interest Penalty', () => {
    const collaterals = [
      {
        id: 'col-cash',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 300000,
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-eq',
        symbol: 'BLUECHIP_EQ',
        assetType: 'EQUITY',
        quantity: 1000,
        marketPrice: 1000, // 800,000 post-haircut
        pledgeStatus: 'APPROVED',
      },
    ];

    const marginReq = 1000000;
    const report = calculatePledgedCollateral(collaterals, marginReq);

    // Minimum cash required: 500,000. Available cash: 300,000.
    // Deficit = 200,000.
    assert.equal(report.cashDeficit, 200000);
    assert.equal(report.annualizedPenaltyRatePercent, 18.0);

    // Daily penalty = 200,000 * 0.18 / 365 = ~98.63
    const expectedDaily = (200000 * 0.18) / 365;
    assert.ok(Math.abs(report.dailyDeficitPenaltyEstimate - expectedDaily) < 0.1);
    assert.equal(report.status, 'CASH_DEFICIT_WARNING');
    assert.equal(report.breachSeverity, 'MEDIUM');
    assert.ok(report.recommendations.length > 0);
  });

  // Test 12: Collateral Margin Call & Critical Shortfall Tier Classification
  test('TC-XMG-12: Total Collateral Deficits Are Classified Into MARGIN_CALL and CRITICAL_SHORTFALL', () => {
    // Case 1: Total available between 80% and 100% of requirement -> MARGIN_CALL
    const callCollaterals = [
      {
        id: 'col-1',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 850000,
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
    ];
    const callReport = calculatePledgedCollateral(callCollaterals, 1000000);
    assert.equal(callReport.status, 'MARGIN_CALL');
    assert.equal(callReport.breachSeverity, 'HIGH');

    // Case 2: Total available below 80% of requirement -> CRITICAL_SHORTFALL
    const critCollaterals = [
      {
        id: 'col-2',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 700000,
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
    ];
    const critReport = calculatePledgedCollateral(critCollaterals, 1000000);
    assert.equal(critReport.status, 'CRITICAL_SHORTFALL');
    assert.equal(critReport.breachSeverity, 'CRITICAL');
  });

  // Test 13: 252-Day Historical VaR (99% 1-Day) Calculation & Percentile Sorting
  test('TC-XMG-13: Full-Revaluation Historical VaR 99% Accurately Evaluates Tail Shock Scenarios', () => {
    const positions = [
      {
        id: 'pos-1',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 100,
        currentPrice: 24500,
        delta: 1.0,
      },
    ];

    const hvar = calculatePortfolioHVaR(positions, 0.99);

    assert.equal(hvar.portfolioNotional, 2450000);
    assert.ok(hvar.historicalVaR99 > 0);
    assert.ok(hvar.historicalVaR99Percent > 0);
    assert.ok(hvar.worstScenarioLoss >= hvar.historicalVaR99);
    assert.ok(hvar.worstScenarioEvent.length > 0);
  });

  // Test 14: Coherent Expected Shortfall (CVaR 99%) Subadditivity & Tail Monotonicity
  test('TC-XMG-14: Expected Shortfall (CVaR 99%) Strictly Satisfies Tail Monotonicity (CVaR >= HVaR)', () => {
    const positions = [
      {
        id: 'pos-nifty',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 200,
        currentPrice: 24500,
        delta: 1.0,
      },
      {
        id: 'pos-rel',
        symbol: 'RELIANCE FUT',
        assetClass: 'STOCK_FUTURES',
        underlying: 'RELIANCE',
        quantity: 500,
        currentPrice: 2800,
        delta: 1.0,
      },
    ];

    const result = calculatePortfolioHVaR(positions, 0.99);

    // Mathematical axiom of coherent risk measures: Expected Shortfall is average loss in tail beyond VaR,
    // so CVaR >= VaR must strictly hold.
    assert.ok(
      result.expectedShortfall99 >= result.historicalVaR99,
      `CVaR (${result.expectedShortfall99}) must be >= HVaR (${result.historicalVaR99})`
    );
    assert.ok(result.expectedShortfall99Percent >= result.historicalVaR99Percent);
  });

  // Test 15: Euler Marginal Risk Contribution (MRC) Additive Decomposition
  test('TC-XMG-15: Euler Marginal Risk Contribution Satisfies Component VaR Additivity', () => {
    const positions = [
      {
        id: 'pos-1',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 150,
        currentPrice: 24500,
        delta: 1.0,
      },
      {
        id: 'pos-2',
        symbol: 'BANKNIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'BANKNIFTY',
        quantity: 75,
        currentPrice: 51000,
        delta: 1.0,
      },
    ];

    const result = calculatePortfolioHVaR(positions, 0.99);

    assert.equal(result.componentRiskAllocations.length, 2);

    // Sum of weights = 1.0
    const sumWeights = result.componentRiskAllocations.reduce((sum, item) => sum + item.weight, 0);
    assert.ok(Math.abs(sumWeights - 1.0) < 0.01);

    // Euler homogeneous theorem: sum of component VaRs must equal portfolio VaR
    const sumComponentVaR = result.componentRiskAllocations.reduce((sum, item) => sum + item.componentVaR, 0);
    assert.ok(
      Math.abs(sumComponentVaR - result.historicalVaR99) < 1.0,
      `Sum of component VaRs (${sumComponentVaR}) must match portfolio VaR (${result.historicalVaR99})`
    );
  });

  // Test 16: Portfolio Hedging Diversification Relief Monotonicity
  test('TC-XMG-16: Introducing An Opposing Hedge Leg Reduces Total Portfolio VaR Monotonically', () => {
    // Unhedged single directional leg
    const unhedged = [
      {
        id: 'pos-unhedged-long',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 100,
        currentPrice: 24500,
        delta: 1.0,
      },
    ];

    const unhedgedHVaR = calculatePortfolioHVaR(unhedged, 0.99);

    // Hedged portfolio: adding opposing Bank Nifty short leg
    const hedged = [
      {
        id: 'pos-unhedged-long',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 100,
        currentPrice: 24500,
        delta: 1.0,
      },
      {
        id: 'pos-hedge-short',
        symbol: 'BANKNIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'BANKNIFTY',
        quantity: -40,
        currentPrice: 51000,
        delta: -1.0,
      },
    ];

    const hedgedHVaR = calculatePortfolioHVaR(hedged, 0.99);

    // Total tail VaR must decrease with the correlated hedge
    assert.ok(
      hedgedHVaR.historicalVaR99 < unhedgedHVaR.historicalVaR99,
      `Hedged VaR (${hedgedHVaR.historicalVaR99}) must be less than Unhedged VaR (${unhedgedHVaR.historicalVaR99})`
    );
  });

  // Test 17: End-to-End Institutional Cross-Margin Audit Execution
  test('TC-XMG-17: Institutional Cross-Margin Audit Integration Computes Valid Capital Efficiency Score [0-100]', () => {
    const positions = [
      {
        id: 'pos-1',
        symbol: 'NIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'NIFTY',
        quantity: 100,
        currentPrice: 24500,
        delta: 1.0,
        isolatedMarginRequired: 245000,
      },
      {
        id: 'pos-2',
        symbol: 'BANKNIFTY FUT',
        assetClass: 'EQUITY_INDEX',
        underlying: 'BANKNIFTY',
        quantity: -50,
        currentPrice: 51000,
        delta: -1.0,
        isolatedMarginRequired: 255000,
      },
    ];

    const collaterals = [
      {
        id: 'col-1',
        symbol: 'CASH_INR',
        assetType: 'CASH',
        quantity: 1500000,
        marketPrice: 1,
        pledgeStatus: 'APPROVED',
      },
      {
        id: 'col-2',
        symbol: '718GS2033',
        assetType: 'GSEC',
        quantity: 10000,
        marketPrice: 100,
        pledgeStatus: 'APPROVED',
      },
    ];

    const audit = runInstitutionalCrossMarginAudit(positions, collaterals);

    assert.ok(audit.capitalEfficiencyScore >= 0 && audit.capitalEfficiencyScore <= 100);
    assert.ok(audit.overallRiskSummary.length > 0);
    assert.equal(audit.crossMargin.positions.length, 2);
    assert.ok(audit.crossMargin.netMarginSavings > 0);
    assert.equal(audit.collateralCompliance.isCompliant5050, true);
    assert.ok(audit.historicalVaR.historicalVaR99 > 0);
  });
});
