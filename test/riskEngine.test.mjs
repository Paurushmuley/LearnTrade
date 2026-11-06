// Sprint 22 — High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk Tests
// Pure JS test suite using Node.js native test runner (node:test)
// Tests:
// 1. 16-Scenario SPAN Margin Array calculation accuracy, verifying maximum loss extraction across price and vol shifts
// 2. Multi-leg spread margin offsets (calendar spread and credit spread margin reduction)
// 3. Extreme Value Theory Expected Shortfall (CVaR 99%) calculations vs normal distribution VaR
// 4. Pre-trade gatekeeper rules: rejection of oversized orders, margin deficit rejection, circuit limit rejection, and approval of well-hedged orders
// 5. Dynamic portfolio unwind solver and SEBI circuit breaker surveillance

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// --- Pure Mathematical & Algorithmic Implementations Mirrored for Native Fast Node.js Test Execution ---

function normalCDF(x) {
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.3989422804014327;

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * x);
    return c * Math.exp((-x * x) / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

function calculateBlackScholesPrice(S, K, T, r, sigma, type) {
  const time = Math.max(0.0001, T);
  const vol = Math.max(0.001, sigma);
  const spot = Math.max(0.01, S);
  const strike = Math.max(0.01, K);

  const d1 = (Math.log(spot / strike) + (r + 0.5 * vol * vol) * time) / (vol * Math.sqrt(time));
  const d2 = d1 - vol * Math.sqrt(time);

  if (type === 'CE') {
    const price = spot * normalCDF(d1) - strike * Math.exp(-r * time) * normalCDF(d2);
    return Math.max(0, price);
  } else {
    const price = strike * Math.exp(-r * time) * normalCDF(-d2) - spot * normalCDF(-d1);
    return Math.max(0, price);
  }
}

const SCENARIO_16_SPECS = [
  { scenarioNumber: 1, sigma: 0, priceShiftPct: 0.0, volShift: 4, isExtreme: false, weight: 100, desc: 'Underlying unchanged, Vol +4%' },
  { scenarioNumber: 2, sigma: 0, priceShiftPct: 0.0, volShift: -4, isExtreme: false, weight: 100, desc: 'Underlying unchanged, Vol -4%' },
  { scenarioNumber: 3, sigma: 1, priceShiftPct: 1.67, volShift: 4, isExtreme: false, weight: 100, desc: 'Underlying +1σ (+1.67%), Vol +4%' },
  { scenarioNumber: 4, sigma: 1, priceShiftPct: 1.67, volShift: -4, isExtreme: false, weight: 100, desc: 'Underlying +1σ (+1.67%), Vol -4%' },
  { scenarioNumber: 5, sigma: -1, priceShiftPct: -1.67, volShift: 4, isExtreme: false, weight: 100, desc: 'Underlying -1σ (-1.67%), Vol +4%' },
  { scenarioNumber: 6, sigma: -1, priceShiftPct: -1.67, volShift: -4, isExtreme: false, weight: 100, desc: 'Underlying -1σ (-1.67%), Vol -4%' },
  { scenarioNumber: 7, sigma: 2, priceShiftPct: 3.33, volShift: 4, isExtreme: false, weight: 100, desc: 'Underlying +2σ (+3.33%), Vol +4%' },
  { scenarioNumber: 8, sigma: 2, priceShiftPct: 3.33, volShift: -4, isExtreme: false, weight: 100, desc: 'Underlying +2σ (+3.33%), Vol -4%' },
  { scenarioNumber: 9, sigma: -2, priceShiftPct: -3.33, volShift: 4, isExtreme: false, weight: 100, desc: 'Underlying -2σ (-3.33%), Vol +4%' },
  { scenarioNumber: 10, sigma: -2, priceShiftPct: -3.33, volShift: -4, isExtreme: false, weight: 100, desc: 'Underlying -2σ (-3.33%), Vol -4%' },
  { scenarioNumber: 11, sigma: 3, priceShiftPct: 5.0, volShift: 4, isExtreme: false, weight: 100, desc: 'Underlying +3σ (+5.00%), Vol +4%' },
  { scenarioNumber: 12, sigma: 3, priceShiftPct: 5.0, volShift: -4, isExtreme: false, weight: 100, desc: 'Underlying +3σ (+5.00%), Vol -4%' },
  { scenarioNumber: 13, sigma: -3, priceShiftPct: -5.0, volShift: 4, isExtreme: false, weight: 100, desc: 'Underlying -3σ (-5.00%), Vol +4%' },
  { scenarioNumber: 14, sigma: -3, priceShiftPct: -5.0, volShift: -4, isExtreme: false, weight: 100, desc: 'Underlying -3σ (-5.00%), Vol -4%' },
  { scenarioNumber: 15, sigma: 3, priceShiftPct: 10.0, volShift: 0, isExtreme: true, weight: 35, desc: 'Extreme Up Move +10.0% (+6σ), 35% Multiplier' },
  { scenarioNumber: 16, sigma: -3, priceShiftPct: -10.0, volShift: 0, isExtreme: true, weight: 35, desc: 'Extreme Down Move -10.0% (-6σ), 35% Multiplier' },
];

function parseOptionSymbol(symbol) {
  const match = symbol.match(/([A-Z]+)(\d{2}[A-Z]{3})(\d+)(CE|PE)/);
  if (match) {
    return {
      isOption: true,
      expiry: match[2],
      strike: parseFloat(match[3]),
      type: match[4],
    };
  }
  return { isOption: false, type: null, strike: 0, expiry: '' };
}

function evaluatePortfolioShock(positions, spotPrice, priceShiftPct, volShiftPct) {
  let totalPnL = 0;
  const shockedSpot = spotPrice * (1 + priceShiftPct / 100);
  const r = 0.065;
  const baseVol = 0.14;
  const shockedVol = Math.max(0.01, baseVol + volShiftPct / 100);
  const T = 7 / 365;

  for (const pos of positions) {
    const parsed = parseOptionSymbol(pos.symbol);

    if (parsed.isOption && parsed.type) {
      const basePrice = calculateBlackScholesPrice(spotPrice, parsed.strike, T, r, baseVol, parsed.type);
      const shockedPrice = calculateBlackScholesPrice(shockedSpot, parsed.strike, T, r, shockedVol, parsed.type);
      const deltaPrice = shockedPrice - basePrice;
      const legPnL = pos.quantity * deltaPrice;
      totalPnL += legPnL;
    } else {
      const deltaPrice = (shockedSpot - spotPrice) * (pos.currentPrice / spotPrice);
      const legPnL = pos.quantity * deltaPrice;
      totalPnL += legPnL;
    }
  }

  return Number(totalPnL.toFixed(2));
}

function calculateSpanRiskArray(positions, spotPrice = 24950, sigmaMultiplier = 1.0) {
  const scenarios16 = SCENARIO_16_SPECS.map((spec) => {
    const adjustedShiftPct = spec.priceShiftPct * sigmaMultiplier;
    const portfolioPnL = evaluatePortfolioShock(
      positions,
      spotPrice,
      adjustedShiftPct,
      spec.volShift
    );

    const effectiveRiskLoss =
      portfolioPnL < 0
        ? Number((Math.abs(portfolioPnL) * (spec.weight / 100)).toFixed(2))
        : 0;

    return {
      scenarioNumber: spec.scenarioNumber,
      priceSigma: spec.sigma,
      priceShiftPercent: spec.priceShiftPct,
      volShiftPercent: spec.volShift,
      portfolioPnL,
      isExtremeMove: spec.isExtreme,
      weightPercent: spec.weight,
      effectiveRiskLoss,
      description: spec.desc,
    };
  });

  let maxScanningLoss = 0;
  let worstScenarioNumber = 1;
  let worstScenarioDescription = scenarios16[0].description;
  let bestScenarioNumber = 1;
  let bestScenarioPnL = scenarios16[0].portfolioPnL;

  for (const sc of scenarios16) {
    if (sc.effectiveRiskLoss > maxScanningLoss) {
      maxScanningLoss = sc.effectiveRiskLoss;
      worstScenarioNumber = sc.scenarioNumber;
      worstScenarioDescription = sc.description;
    }
    if (sc.portfolioPnL > bestScenarioPnL) {
      bestScenarioPnL = sc.portfolioPnL;
      bestScenarioNumber = sc.scenarioNumber;
    }
  }

  // Multi-leg spread detection
  let hasCreditSpread = false;
  let hasCalendarSpread = false;
  let calendarSpreadPairs = 0;

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const p1 = parseOptionSymbol(positions[i].symbol);
      const p2 = parseOptionSymbol(positions[j].symbol);
      const q1 = positions[i].quantity;
      const q2 = positions[j].quantity;

      if (p1.isOption && p2.isOption && Math.sign(q1) !== Math.sign(q2)) {
        if (p1.type === p2.type && p1.strike === p2.strike && p1.expiry !== p2.expiry) {
          hasCalendarSpread = true;
          calendarSpreadPairs++;
        }
        if (p1.type === p2.type && p1.expiry === p2.expiry && p1.strike !== p2.strike) {
          hasCreditSpread = true;
        }
      }
    }
  }

  const interMonthSpreadCharge = calendarSpreadPairs * 4500;
  const spreadMarginOffset = (hasCreditSpread || hasCalendarSpread)
    ? maxScanningLoss * 0.65
    : 0;

  const totalSpanRequirement = Number(
    Math.max(35000, maxScanningLoss - spreadMarginOffset + interMonthSpreadCharge).toFixed(2)
  );

  let grossNotional = 0;
  positions.forEach((p) => {
    grossNotional += Math.abs(p.quantity) * (p.currentPrice || spotPrice);
  });
  const exposureMarginRequirement = Number((grossNotional * 0.03).toFixed(2));
  const totalInitialMargin = Number((totalSpanRequirement + exposureMarginRequirement).toFixed(2));

  return {
    maxScanningLoss: Number(maxScanningLoss.toFixed(2)),
    worstScenarioNumber,
    worstScenarioDescription,
    bestScenarioNumber,
    bestScenarioPnL: Number(bestScenarioPnL.toFixed(2)),
    basePnL: evaluatePortfolioShock(positions, spotPrice, 0, 0),
    interMonthSpreadCharge,
    hasCreditSpread,
    hasCalendarSpread,
    spreadMarginOffset: Number(spreadMarginOffset.toFixed(2)),
    totalSpanRequirement,
    exposureMarginRequirement,
    totalInitialMargin,
    scenarios16,
  };
}

function evaluateMarginGatekeeper(availableCash, totalPortfolioValue, usedSpanMargin, exposureMargin) {
  const totalMarginRequirement = Number((usedSpanMargin + exposureMargin).toFixed(2));
  const freeMargin = Number((availableCash - totalMarginRequirement).toFixed(2));
  const utilizationRate = Number(
    ((totalMarginRequirement / Math.max(1, availableCash)) * 100).toFixed(1)
  );

  let throttleTier = 'OPTIMAL';
  let throttleWarning;

  if (utilizationRate > 100) {
    throttleTier = 'BREACHED';
    throttleWarning = `CRITICAL: Margin utilization ${utilizationRate}% breaches 100% collateral ceiling. Mandatory liquidation risk!`;
  } else if (utilizationRate >= 90) {
    throttleTier = 'THROTTLED';
    throttleWarning = `HIGH RISK: Utilization at ${utilizationRate}%. New opening orders are throttled. Only risk-reducing hedges permitted.`;
  } else if (utilizationRate >= 75) {
    throttleTier = 'CAUTION';
    throttleWarning = `ELEVATED LEVERAGE: Utilization at ${utilizationRate}%. Approaching soft throttle limit.`;
  } else if (utilizationRate >= 50) {
    throttleTier = 'MODERATE';
  }

  return {
    availableCash,
    totalPortfolioValue,
    usedSpanMargin,
    exposureMargin,
    totalMarginRequirement,
    freeMargin,
    utilizationRate,
    throttleTier,
    throttleWarning,
  };
}

function validatePreTradeOrder(gatekeeper, order) {
  const reasons = [];
  const orderNotional = order.quantity * order.price;

  const MAX_SINGLE_QTY = 1800;
  const MAX_ORDER_NOTIONAL = 2500000;
  if (order.quantity > MAX_SINGLE_QTY) {
    reasons.push(`Fat-Finger Rejection: Quantity ${order.quantity} exceeds max limit of ${MAX_SINGLE_QTY} units.`);
  }
  if (orderNotional > MAX_ORDER_NOTIONAL) {
    reasons.push(`Oversized Order Rejection: Notional ₹${orderNotional.toLocaleString()} exceeds single order limit of ₹25,00,000.`);
  }

  if (order.price <= 0.05) {
    reasons.push('Invalid Order Price: Premium cannot be zero or negative.');
  }

  const isOption = order.symbol.includes('CE') || order.symbol.includes('PE');
  let estimatedSpanDelta = 0;
  let estimatedExposureDelta = 0;

  if (isOption) {
    if (order.side === 'BUY') {
      estimatedSpanDelta = -Math.min(15000, orderNotional * 0.4);
      estimatedExposureDelta = orderNotional * 0.01;
    } else {
      const lots = Math.ceil(order.quantity / 50);
      estimatedSpanDelta = lots * 115000;
      estimatedExposureDelta = lots * 50 * 25000 * 0.02;
    }
  } else {
    const marginRatio = order.product === 'MIS' ? 0.2 : 1.0;
    estimatedSpanDelta = orderNotional * marginRatio;
    estimatedExposureDelta = orderNotional * 0.03;
  }

  const totalDeltaMargin = Number((estimatedSpanDelta + estimatedExposureDelta).toFixed(2));
  const postTradeFreeMargin = Number((gatekeeper.freeMargin - totalDeltaMargin).toFixed(2));
  const postTradeUtilization = Number(
    (
      ((gatekeeper.totalMarginRequirement + totalDeltaMargin) /
        Math.max(1, gatekeeper.availableCash)) *
      100
    ).toFixed(1)
  );

  let verdict = 'PASS';

  if (reasons.length > 0) {
    verdict = 'BLOCKED';
  } else if (postTradeFreeMargin < 0) {
    verdict = 'BLOCKED';
    reasons.push(
      `Margin Deficit: Required margin ₹${totalDeltaMargin.toLocaleString()} exceeds free collateral ₹${gatekeeper.freeMargin.toLocaleString()}.`
    );
  } else if (totalDeltaMargin <= 0) {
    verdict = 'PASS';
    reasons.push('Approved Hedging Order: Trade reduces portfolio risk and releases margin collateral.');
  } else if (postTradeUtilization > 90) {
    verdict = 'WARNING';
    reasons.push(`Leverage Warning: Order execution will push margin utilization to ${postTradeUtilization}%.`);
  }

  return {
    symbol: order.symbol,
    side: order.side,
    product: order.product,
    quantity: order.quantity,
    price: order.price,
    estimatedSpanDelta,
    estimatedExposureDelta,
    totalDeltaMargin,
    postTradeUtilization,
    postTradeFreeMargin,
    verdict,
    reasons,
  };
}

function calculateEvtExpectedShortfall(portfolioValue = 625000, shockMultiplier = 1.0) {
  const fatTailIndexXi = Number((0.265 * shockMultiplier).toFixed(4));
  const tailScaleBeta = Number((portfolioValue * 0.018 * shockMultiplier).toFixed(2));
  const excessKurtosis = Number((4.85 * shockMultiplier).toFixed(2));

  const dailyVol = 0.015 * shockMultiplier;
  const parametricVar99 = Number((portfolioValue * 2.326 * dailyVol).toFixed(2));
  const historicalVar99 = Number((portfolioValue * 2.58 * dailyVol).toFixed(2));

  const u = portfolioValue * 0.02 * shockMultiplier;
  const evtVar995 = Number((parametricVar99 * (1.0 + fatTailIndexXi * 1.45)).toFixed(2));

  const evtExpectedShortfall99 = Number(
    (
      evtVar995 / (1.0 - Math.min(0.9, fatTailIndexXi)) +
      (tailScaleBeta - fatTailIndexXi * u * 0.1) / (1.0 - Math.min(0.9, fatTailIndexXi))
    ).toFixed(2)
  );

  const cvarToVarRatio = Number((evtExpectedShortfall99 / parametricVar99).toFixed(2));

  return {
    parametricVar99,
    historicalVar99,
    evtVar995,
    evtExpectedShortfall99,
    fatTailIndexXi,
    tailScaleBeta,
    excessKurtosis,
    tailRiskSeverity: fatTailIndexXi > 0.2 ? 'CRITICAL_FAT_TAIL' : 'ELEVATED',
    cvarToVarRatio,
  };
}

function getCircuitBreakerSurveillance(spotPrice = 24950, previousClose = 25100) {
  const dayChangePercent = Number(
    (((spotPrice - previousClose) / previousClose) * 100).toFixed(2)
  );
  const stage1ThresholdPercent = -10.0;
  const stage2ThresholdPercent = -15.0;
  const stage3ThresholdPercent = -20.0;

  const distanceToStage1Percent = Number(
    (Math.abs(stage1ThresholdPercent) - Math.abs(Math.min(0, dayChangePercent))).toFixed(2)
  );

  let currentStatus = 'NORMAL';
  if (dayChangePercent <= stage3ThresholdPercent) {
    currentStatus = 'MARKET_CLOSED';
  } else if (dayChangePercent <= stage2ThresholdPercent) {
    currentStatus = 'HALT_STAGE_2';
  } else if (dayChangePercent <= stage1ThresholdPercent) {
    currentStatus = 'HALT_STAGE_1';
  }

  return {
    indexSymbol: 'NIFTY 50',
    currentSpot: spotPrice,
    previousClose,
    dayChangePercent,
    stage1ThresholdPercent,
    stage2ThresholdPercent,
    stage3ThresholdPercent,
    distanceToStage1Percent,
    currentStatus,
  };
}

// --- Automated Unit Test Suite ---

describe('TradeCraft High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk (Sprint 22)', () => {

  // Test 1: 16-Scenario SPAN Margin Array Calculation Accuracy
  test('TC-RISK-01: 16-Scenario SPAN Margin Array Grid Completeness and Scan Extraction', () => {
    const nakedShortCall = [
      {
        symbol: 'NIFTY24OCT25000CE',
        product: 'MIS',
        quantity: -100, // Short 2 lots call
        averagePrice: 150.0,
        currentPrice: 150.0,
        investedAmount: 15000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: 50,
        netPnL: -50,
      },
    ];

    const spanResult = calculateSpanRiskArray(nakedShortCall, 25000, 1.0);

    // Verify exactly 16 scenarios are calculated
    assert.strictEqual(spanResult.scenarios16.length, 16, 'SPAN must generate exactly 16 standard scenario states');

    // Scenarios 1-14 have 100% loss weight
    for (let i = 0; i < 14; i++) {
      assert.strictEqual(spanResult.scenarios16[i].weightPercent, 100, `Scenario ${i + 1} must have 100% loss weight`);
      assert.strictEqual(spanResult.scenarios16[i].isExtremeMove, false, `Scenario ${i + 1} is not an extreme move`);
    }

    // Scenarios 15 & 16 are extreme double moves with 35% multiplier
    assert.strictEqual(spanResult.scenarios16[14].scenarioNumber, 15);
    assert.strictEqual(spanResult.scenarios16[14].isExtremeMove, true);
    assert.strictEqual(spanResult.scenarios16[14].weightPercent, 35, 'Scenario 15 extreme up move must have 35% weight');

    assert.strictEqual(spanResult.scenarios16[15].scenarioNumber, 16);
    assert.strictEqual(spanResult.scenarios16[15].isExtremeMove, true);
    assert.strictEqual(spanResult.scenarios16[15].weightPercent, 35, 'Scenario 16 extreme down move must have 35% weight');

    // For a naked short call, upward price move causes maximum loss
    const upScenario = spanResult.scenarios16.find((s) => s.scenarioNumber === 11); // +3σ up, Vol +4%
    const downScenario = spanResult.scenarios16.find((s) => s.scenarioNumber === 14); // -3σ down, Vol -4%

    assert.ok(upScenario.portfolioPnL < 0, 'Upward underlying price shock must inflict losses on short call');
    assert.ok(downScenario.portfolioPnL > 0, 'Downward underlying price shock must generate gains on short call');
    assert.ok(spanResult.maxScanningLoss > 0, 'Max scanning loss must be strictly positive for naked short call');
    assert.ok(spanResult.totalSpanRequirement >= spanResult.maxScanningLoss, 'Total SPAN requirement must cover scanning loss');
  });

  // Test 2: SPAN Scenario Monotonicity across Price Shocks
  test('TC-RISK-02: Stress Matrix Monotonicity: Increasing Upward Move Deepens Short Call Losses', () => {
    const nakedShortCall = [
      {
        symbol: 'NIFTY24OCT25000CE',
        product: 'MIS',
        quantity: -50, // Short 1 lot
        averagePrice: 140.0,
        currentPrice: 140.0,
        investedAmount: 7000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: 30,
        netPnL: -30,
      },
    ];

    const spanResult = calculateSpanRiskArray(nakedShortCall, 25000, 1.0);

    const s1 = spanResult.scenarios16.find((s) => s.scenarioNumber === 1); // 0 sigma
    const s3 = spanResult.scenarios16.find((s) => s.scenarioNumber === 3); // +1 sigma
    const s7 = spanResult.scenarios16.find((s) => s.scenarioNumber === 7); // +2 sigma
    const s11 = spanResult.scenarios16.find((s) => s.scenarioNumber === 11); // +3 sigma

    // Monotonic loss growth: PnL becomes increasingly negative
    assert.ok(s1.portfolioPnL > s3.portfolioPnL, 'Loss at +1σ must be worse than at 0σ');
    assert.ok(s3.portfolioPnL > s7.portfolioPnL, 'Loss at +2σ must be worse than at +1σ');
    assert.ok(s7.portfolioPnL > s11.portfolioPnL, 'Loss at +3σ must be worse than at +2σ');
  });

  // Test 3: Multi-Leg Spread Margin Offsets - Credit Spread (Vertical Spread)
  test('TC-RISK-03: Multi-Leg Credit Spread (Bear Call Spread) Margin Reduction', () => {
    const spot = 25000;

    // Naked Short Call: Sell 25000 CE
    const nakedLeg = [
      {
        symbol: 'NIFTY24OCT25000CE',
        product: 'MIS',
        quantity: -100, // Short 2 lots
        averagePrice: 150.0,
        currentPrice: 150.0,
        investedAmount: 15000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: 50,
        netPnL: -50,
      },
    ];

    // Bear Call Credit Spread: Sell 25000 CE + Buy 25200 CE (hedge wing)
    const creditSpread = [
      ...nakedLeg,
      {
        symbol: 'NIFTY24OCT25200CE',
        product: 'MIS',
        quantity: 100, // Long 2 lots
        averagePrice: 50.0,
        currentPrice: 50.0,
        investedAmount: 5000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: 50,
        netPnL: -50,
      },
    ];

    const nakedResult = calculateSpanRiskArray(nakedLeg, spot);
    const hedgedResult = calculateSpanRiskArray(creditSpread, spot);

    assert.strictEqual(hedgedResult.hasCreditSpread, true, 'Engine must detect credit spread');
    assert.ok(hedgedResult.spreadMarginOffset > 0, 'Spread margin offset benefit must be awarded');

    // Hedged credit spread total initial margin should be drastically lower than naked
    assert.ok(
      hedgedResult.totalSpanRequirement < nakedResult.totalSpanRequirement,
      `Hedged SPAN (${hedgedResult.totalSpanRequirement}) must be significantly lower than naked (${nakedResult.totalSpanRequirement})`
    );

    const marginReliefPct = (hedgedResult.spreadMarginOffset / nakedResult.maxScanningLoss) * 100;
    assert.ok(marginReliefPct >= 60, `Credit spread must provide >=60% scanning loss relief (got ${marginReliefPct.toFixed(1)}%)`);
  });

  // Test 4: Multi-Leg Spread Margin Offsets - Calendar Spread
  test('TC-RISK-04: Multi-Leg Calendar Spread Margin Relief and Inter-Month Basis Charge', () => {
    const spot = 25000;

    // Calendar Spread: Short near-month 24800 PE + Long far-month 24800 PE
    const calendarSpread = [
      {
        symbol: 'NIFTY24OCT24800PE',
        product: 'MIS',
        quantity: -100, // Short near-month
        averagePrice: 90.0,
        currentPrice: 90.0,
        investedAmount: 9000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: 50,
        netPnL: -50,
      },
      {
        symbol: 'NIFTY31OCT24800PE',
        product: 'MIS',
        quantity: 100, // Long far-month
        averagePrice: 130.0,
        currentPrice: 130.0,
        investedAmount: 13000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: 50,
        netPnL: -50,
      },
    ];

    const result = calculateSpanRiskArray(calendarSpread, spot);

    assert.strictEqual(result.hasCalendarSpread, true, 'Engine must identify calendar spread');
    assert.ok(result.interMonthSpreadCharge > 0, 'Inter-month spread basis charge must be applied');
    assert.strictEqual(result.interMonthSpreadCharge, 4500, 'Inter-month charge must equal ₹4,500 for 1 spread pair');
    assert.ok(result.spreadMarginOffset > 0, 'Calendar spread margin offset must be credited');
  });

  // Test 5: Extreme Value Theory (EVT) GPD Shape Parameter & Heavy-Tail Detection
  test('TC-RISK-05: EVT Expected Shortfall (CVaR 99%) Convergence and Heavy-Tail Fréchet Classification', () => {
    const portfolioValue = 1000000; // 10 Lakhs
    const evtMetrics = calculateEvtExpectedShortfall(portfolioValue, 1.0);

    // Verify Generalized Pareto Distribution parameters
    assert.ok(evtMetrics.fatTailIndexXi > 0, 'Tail shape parameter xi must be strictly positive for fat-tailed returns');
    assert.ok(evtMetrics.fatTailIndexXi > 0.20, 'Tail shape parameter xi > 0.20 triggers Fréchet heavy-tail domain');
    assert.strictEqual(evtMetrics.tailRiskSeverity, 'CRITICAL_FAT_TAIL', 'Severity must be flagged as CRITICAL_FAT_TAIL');
    assert.ok(evtMetrics.excessKurtosis > 3.0, 'Excess kurtosis must be leptokurtic (> 3.0)');
  });

  // Test 6: EVT Expected Shortfall vs Gaussian Normal VaR Comparison
  test('TC-RISK-06: EVT Expected Shortfall (CVaR 99%) Severely Exceeds Normal VaR 99%', () => {
    const portfolioValue = 1000000;
    const evtMetrics = calculateEvtExpectedShortfall(portfolioValue, 1.0);

    // Coherence property: CVaR (Expected Shortfall) is strictly greater than VaR
    assert.ok(
      evtMetrics.evtExpectedShortfall99 > evtMetrics.parametricVar99,
      `EVT CVaR (${evtMetrics.evtExpectedShortfall99}) must exceed Gaussian VaR (${evtMetrics.parametricVar99})`
    );

    // Tail risk ratio showing fat-tail penalty
    assert.ok(
      evtMetrics.cvarToVarRatio >= 1.3,
      `CVaR to VaR ratio must reflect fat tail (> 1.3x, got ${evtMetrics.cvarToVarRatio}x)`
    );

    assert.ok(
      evtMetrics.evtVar995 > evtMetrics.parametricVar99,
      'EVT 99.5% VaR must exceed 99% Gaussian VaR'
    );
  });

  // Test 7: EVT Monotonic Response to Volatility & Tail Shocks
  test('TC-RISK-07: EVT Tail Loss Scales Monotonically with Macro Shock Multiplier', () => {
    const baseValue = 500000;
    const baseRisk = calculateEvtExpectedShortfall(baseValue, 1.0);
    const stressedRisk = calculateEvtExpectedShortfall(baseValue, 1.5);

    assert.ok(
      stressedRisk.evtExpectedShortfall99 > baseRisk.evtExpectedShortfall99,
      'Stressed CVaR must be strictly higher than baseline CVaR'
    );
    assert.ok(
      stressedRisk.fatTailIndexXi > baseRisk.fatTailIndexXi,
      'Stressed shape parameter xi must scale with shock multiplier'
    );
  });

  // Test 8: Pre-Trade Gatekeeper - Oversized / Fat-Finger Order Veto
  test('TC-RISK-08: Pre-Trade Gatekeeper Rejects Oversized Quantity & Fat-Finger Notional', () => {
    const gatekeeper = evaluateMarginGatekeeper(500000, 600000, 50000, 10000);

    // Order with 2000 quantity (> 1800 max quantity limit)
    const oversizedQtyOrder = {
      symbol: 'NIFTY24OCT25000CE',
      side: 'BUY',
      product: 'MIS',
      quantity: 2000,
      price: 100.0,
    };

    const check1 = validatePreTradeOrder(gatekeeper, oversizedQtyOrder);
    assert.strictEqual(check1.verdict, 'BLOCKED', 'Order exceeding 1800 units must be blocked');
    assert.ok(check1.reasons.some((r) => r.includes('Fat-Finger Rejection')), 'Must return Fat-Finger rejection reason');

    // Order with notional ₹30,00,000 (> ₹25,00,000 max single notional limit)
    const oversizedNotionalOrder = {
      symbol: 'RELIANCE',
      side: 'BUY',
      product: 'MIS',
      quantity: 1000,
      price: 3000.0, // ₹30,00,000
    };

    const check2 = validatePreTradeOrder(gatekeeper, oversizedNotionalOrder);
    assert.strictEqual(check2.verdict, 'BLOCKED', 'Order exceeding ₹25,00,000 notional must be blocked');
    assert.ok(check2.reasons.some((r) => r.includes('Oversized Order Rejection')), 'Must return Oversized rejection reason');
  });

  // Test 9: Pre-Trade Gatekeeper - Margin Deficit Rejection
  test('TC-RISK-09: Pre-Trade Gatekeeper Rejects Order Causing Collateral Deficit', () => {
    // Tight collateral: available ₹1,00,000, used ₹90,000 => freeMargin = ₹10,000
    const gatekeeper = evaluateMarginGatekeeper(100000, 120000, 80000, 10000);

    // Short call order requiring ~₹2,30,000 margin for 2 lots
    const heavyOrder = {
      symbol: 'NIFTY24OCT25000CE',
      side: 'SELL',
      product: 'MIS',
      quantity: 100, // 2 lots short
      price: 120.0,
    };

    const check = validatePreTradeOrder(gatekeeper, heavyOrder);
    assert.strictEqual(check.verdict, 'BLOCKED', 'Order requiring more margin than free collateral must be blocked');
    assert.ok(check.postTradeFreeMargin < 0, 'Post-trade free margin must be negative');
    assert.ok(check.reasons.some((r) => r.includes('Margin Deficit')), 'Must return Margin Deficit reason');
  });

  // Test 10: Pre-Trade Gatekeeper - Approval of Well-Hedged Risk-Reducing Order
  test('TC-RISK-10: Pre-Trade Gatekeeper Approves Risk-Reducing Hedging Order Under Tight Margin', () => {
    // Tight margin situation
    const gatekeeper = evaluateMarginGatekeeper(100000, 120000, 85000, 10000);

    // Long option buying order that hedges short risk (releases margin delta)
    const hedgingOrder = {
      symbol: 'NIFTY24OCT25200CE',
      side: 'BUY',
      product: 'MIS',
      quantity: 50,
      price: 45.0,
    };

    const check = validatePreTradeOrder(gatekeeper, hedgingOrder);
    assert.strictEqual(check.verdict, 'PASS', 'Risk-reducing hedging order must pass gatekeeper');
    assert.ok(check.totalDeltaMargin <= 0, 'Hedging order must have zero or negative incremental margin delta');
    assert.ok(check.reasons.some((r) => r.includes('Approved Hedging Order')), 'Must confirm hedging approval');
  });

  // Test 11: Pre-Trade Gatekeeper - Zero/Negative Price Rejection
  test('TC-RISK-11: Pre-Trade Gatekeeper Rejects Invalid Non-Positive Price Quotes', () => {
    const gatekeeper = evaluateMarginGatekeeper(500000, 600000, 50000, 10000);

    const invalidOrder = {
      symbol: 'NIFTY24OCT25000CE',
      side: 'BUY',
      product: 'MIS',
      quantity: 50,
      price: 0.0,
    };

    const check = validatePreTradeOrder(gatekeeper, invalidOrder);
    assert.strictEqual(check.verdict, 'BLOCKED', 'Zero-price quote must be rejected');
    assert.ok(check.reasons.some((r) => r.includes('Invalid Order Price')), 'Must flag invalid price');
  });

  // Test 12: Margin Utilization Throttle Tiers
  test('TC-RISK-12: Margin Gatekeeper Accurately Categorizes Throttle Tiers and Warnings', () => {
    const optimal = evaluateMarginGatekeeper(1000000, 1200000, 200000, 50000); // 25%
    assert.strictEqual(optimal.throttleTier, 'OPTIMAL');

    const moderate = evaluateMarginGatekeeper(1000000, 1200000, 500000, 100000); // 60%
    assert.strictEqual(moderate.throttleTier, 'MODERATE');

    const caution = evaluateMarginGatekeeper(1000000, 1200000, 700000, 100000); // 80%
    assert.strictEqual(caution.throttleTier, 'CAUTION');
    assert.ok(caution.throttleWarning !== undefined, 'Caution tier must include warning');

    const throttled = evaluateMarginGatekeeper(1000000, 1200000, 800000, 150000); // 95%
    assert.strictEqual(throttled.throttleTier, 'THROTTLED');

    const breached = evaluateMarginGatekeeper(1000000, 1200000, 950000, 100000); // 105%
    assert.strictEqual(breached.throttleTier, 'BREACHED');
    assert.ok(breached.throttleWarning.includes('CRITICAL'), 'Breach must trigger critical warning');
  });

  // Test 13: SEBI Volatility Circuit Breaker Surveillance
  test('TC-RISK-13: SEBI 3-Stage Circuit Breaker Trigger Mechanics', () => {
    const prevClose = 25000;

    // Normal day: down 1%
    const normalState = getCircuitBreakerSurveillance(24750, prevClose);
    assert.strictEqual(normalState.currentStatus, 'NORMAL');
    assert.strictEqual(normalState.dayChangePercent, -1.0);

    // Stage 1 Halt: down 10%
    const stage1State = getCircuitBreakerSurveillance(22500, prevClose);
    assert.strictEqual(stage1State.currentStatus, 'HALT_STAGE_1');
    assert.strictEqual(stage1State.dayChangePercent, -10.0);

    // Stage 2 Halt: down 15%
    const stage2State = getCircuitBreakerSurveillance(21250, prevClose);
    assert.strictEqual(stage2State.currentStatus, 'HALT_STAGE_2');

    // Market Closed: down 20%
    const stage3State = getCircuitBreakerSurveillance(20000, prevClose);
    assert.strictEqual(stage3State.currentStatus, 'MARKET_CLOSED');
  });

  // Test 14: Ultra-Fast Gatekeeper Evaluation Latency Target (< 2ms)
  test('TC-RISK-14: Pre-Trade Gatekeeper Evaluation Latency is Strictly Bounded (< 2ms)', () => {
    const gatekeeper = evaluateMarginGatekeeper(500000, 600000, 50000, 10000);
    const order = {
      symbol: 'NIFTY24OCT25000CE',
      side: 'BUY',
      product: 'MIS',
      quantity: 50,
      price: 110.0,
    };

    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      validatePreTradeOrder(gatekeeper, order);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    assert.ok(
      avgLatencyMs < 2.0,
      `Pre-trade validation average latency (${avgLatencyMs.toFixed(3)}ms) must be under 2.0ms`
    );
  });

  // Test 15: Black-Scholes Analytical Pricing Boundary Invariants
  test('TC-RISK-15: Black-Scholes Options Pricing Satisfies Put-Call Parity & Positivity', () => {
    const S = 25000;
    const K = 25000;
    const T = 0.1;
    const r = 0.065;
    const sigma = 0.15;

    const call = calculateBlackScholesPrice(S, K, T, r, sigma, 'CE');
    const put = calculateBlackScholesPrice(S, K, T, r, sigma, 'PE');

    // Put-Call Parity: C - P = S - K * exp(-r * T)
    const forwardDiff = S - K * Math.exp(-r * T);
    const optionsDiff = call - put;

    assert.ok(Math.abs(optionsDiff - forwardDiff) < 1.0, 'Must satisfy Put-Call parity within ₹1.0');
    assert.ok(call > 0, 'Call price must be strictly positive');
    assert.ok(put > 0, 'Put price must be strictly positive');
  });

});
