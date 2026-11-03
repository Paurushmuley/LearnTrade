// TradeCraft AI — Portfolio Greeks Aggregator & Delta-Neutral Hedging Engine
// Computes multi-asset net Greeks, dynamic delta-neutral lot sizing, and Gamma curvature under market shocks

import {
  AutoRebalanceConfig,
  CurvaturePayoffPoint,
  HedgeExecutionRecord,
  HedgeInstrumentType,
  HedgeRecommendation,
  PortfolioGreekSummary,
  PortfolioPositionGreeks,
  PriceShockScenario,
} from '../types/greeksHedger';
import { calculateBlackScholes } from './optionsEngine';
import { calculateStatutoryCharges } from './taxEngine';

/**
 * Aggregates net portfolio Greeks across all open cash, futures, and options positions
 */
export function calculatePortfolioGreeks(
  positions: PortfolioPositionGreeks[],
  spotPrice: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _indexSymbol: string = 'NIFTY 50'
): PortfolioGreekSummary {
  let netDelta = 0;
  let netGamma = 0;
  let netTheta = 0;
  let netVega = 0;

  for (const pos of positions) {
    const isBuy = pos.side === 'BUY';
    const sign = isBuy ? 1 : -1;
    const qty = pos.quantity; // in shares/units

    let posDelta = 0;
    let posGamma = 0;
    let posTheta = 0;
    let posVega = 0;

    if (pos.assetType === 'EQUITY' || pos.assetType === 'FUTURES') {
      posDelta = sign * qty * (pos.greeks.delta || 1.0);
      posGamma = sign * qty * (pos.greeks.gamma || 0);
      posTheta = sign * qty * (pos.greeks.theta || 0);
      posVega = sign * qty * (pos.greeks.vega || 0);
    } else {
      // Options
      posDelta = sign * qty * pos.greeks.delta;
      posGamma = sign * qty * pos.greeks.gamma;
      posTheta = sign * qty * pos.greeks.theta;
      posVega = sign * qty * pos.greeks.vega;
    }

    netDelta += posDelta;
    netGamma += posGamma;
    netTheta += posTheta;
    netVega += posVega;
  }

  netDelta = Number(netDelta.toFixed(2));
  netGamma = Number(netGamma.toFixed(4));
  netTheta = Number(netTheta.toFixed(2));
  netVega = Number(netVega.toFixed(2));

  const notionalDeltaInr = Number((netDelta * spotPrice).toFixed(2));
  const rebalanceBand = 25;
  const isRebalanceRequired = Math.abs(netDelta) > rebalanceBand;

  let deltaRiskStatus: PortfolioGreekSummary['deltaRiskStatus'] = 'NEUTRAL';
  if (netDelta > 75) deltaRiskStatus = 'CRITICAL_LONG';
  else if (netDelta > rebalanceBand) deltaRiskStatus = 'MODERATE_LONG';
  else if (netDelta < -75) deltaRiskStatus = 'CRITICAL_SHORT';
  else if (netDelta < -rebalanceBand) deltaRiskStatus = 'MODERATE_SHORT';

  let gammaRiskStatus: PortfolioGreekSummary['gammaRiskStatus'] = 'SAFE';
  if (netGamma < -0.05) gammaRiskStatus = 'HAZARDOUS';
  else if (netGamma < -0.01) gammaRiskStatus = 'ELEVATED';

  return {
    spotPrice,
    netDelta,
    netGamma,
    netTheta,
    netVega,
    notionalDeltaInr,
    rebalanceBand,
    deltaRiskStatus,
    gammaRiskStatus,
    positionsCount: positions.length,
    isRebalanceRequired,
  };
}

/**
 * Solves the exact lot size and order direction needed to neutralize portfolio Delta
 */
export function solveDeltaNeutralHedge(
  summary: PortfolioGreekSummary,
  preferredInstrument: HedgeInstrumentType = 'FUTURES',
  targetDelta: number = 0,
  lotSize: number = 25
): HedgeRecommendation {
  const deltaDeficit = targetDelta - summary.netDelta; // Delta we need to inject
  const atmStrike = Math.round(summary.spotPrice / 50) * 50;

  let instrumentDeltaPerLot = lotSize * 1.0;
  let estimatedPrice = summary.spotPrice;
  let symbol = 'NIFTY FUT';

  if (preferredInstrument === 'FUTURES') {
    symbol = 'NIFTY FUT';
    instrumentDeltaPerLot = lotSize * 1.0; // 25 delta per long lot
    estimatedPrice = summary.spotPrice;
  } else {
    const bs = calculateBlackScholes(summary.spotPrice, atmStrike, 5 / 365, 0.065, 0.14);
    if (preferredInstrument === 'ATM_CALL') {
      symbol = `NIFTY ${atmStrike} CE`;
      instrumentDeltaPerLot = lotSize * bs.callGreeks.delta; // ~13 delta per lot
      estimatedPrice = bs.callPrice;
    } else {
      symbol = `NIFTY ${atmStrike} PE`;
      instrumentDeltaPerLot = lotSize * bs.putGreeks.delta; // ~ -12 delta per lot
      estimatedPrice = bs.putPrice;
    }
  }

  // Determine side:
  // If we need positive delta (deltaDeficit > 0):
  // - Futures: BUY
  // - Call: BUY
  // - Put: SELL (since Put delta is negative, selling put adds positive delta)
  let side: 'BUY' | 'SELL' = 'BUY';
  let effectiveDeltaChangePerLot = instrumentDeltaPerLot;

  if (deltaDeficit > 0) {
    if (preferredInstrument === 'ATM_PUT') {
      side = 'SELL';
      effectiveDeltaChangePerLot = Math.abs(instrumentDeltaPerLot);
    } else {
      side = 'BUY';
      effectiveDeltaChangePerLot = instrumentDeltaPerLot;
    }
  } else {
    if (preferredInstrument === 'ATM_PUT') {
      side = 'BUY';
      effectiveDeltaChangePerLot = -Math.abs(instrumentDeltaPerLot);
    } else {
      side = 'SELL';
      effectiveDeltaChangePerLot = -Math.abs(instrumentDeltaPerLot);
    }
  }

  const rawLots = Math.abs(deltaDeficit) / Math.abs(effectiveDeltaChangePerLot);
  const recommendedLots = Math.abs(summary.netDelta) <= summary.rebalanceBand ? 0 : Math.max(1, Math.round(rawLots));
  const recommendedQty = recommendedLots * lotSize;

  const totalDeltaInjection = recommendedLots === 0 ? 0 : (side === 'BUY' ? 1 : -1) * (preferredInstrument === 'ATM_PUT' ? -1 : 1) * Math.abs(effectiveDeltaChangePerLot) * recommendedLots;
  const residualDelta = Number((summary.netDelta + (side === 'BUY' ? 1 : -1) * instrumentDeltaPerLot * recommendedLots).toFixed(2));

  // Required margin for MIS: 20% for futures, 100% premium for option buys
  let estimatedMargin = 0;
  if (preferredInstrument === 'FUTURES') {
    estimatedMargin = Math.round(recommendedQty * estimatedPrice * 0.20);
  } else {
    estimatedMargin = side === 'BUY' ? Math.round(recommendedQty * estimatedPrice) : Math.round(recommendedQty * summary.spotPrice * 0.20);
  }

  let rationale = `Portfolio Net Delta (${summary.netDelta > 0 ? '+' : ''}${summary.netDelta} Δ) is balanced within the ±${summary.rebalanceBand} Δ neutral zone.`;
  if (recommendedLots > 0) {
    rationale = `Neutralize ${summary.netDelta > 0 ? 'long' : 'short'} exposure of ${summary.netDelta > 0 ? '+' : ''}${summary.netDelta} Δ by placing ${side} ${recommendedLots} Lot${recommendedLots > 1 ? 's' : ''} (${recommendedQty} Qty) of ${symbol}.`;
  }

  return {
    instrumentType: preferredInstrument,
    symbol,
    side,
    strike: preferredInstrument !== 'FUTURES' ? atmStrike : undefined,
    lotSize,
    recommendedLots,
    recommendedQty,
    estimatedPrice,
    estimatedMargin,
    projectedDeltaChange: Number(totalDeltaInjection.toFixed(2)),
    residualDelta: recommendedLots === 0 ? summary.netDelta : residualDelta,
    rationale,
  };
}

/**
 * Simulates second-order Taylor expansion price shocks on unhedged vs hedged portfolio
 * PnL ≈ Delta * ΔS + 0.5 * Gamma * (ΔS)^2
 */
export function simulatePriceShockScenarios(
  summary: PortfolioGreekSummary,
  shockPercentages: number[] = [-2.0, -1.0, -0.5, 0.5, 1.0, 2.0],
  hedge?: HedgeRecommendation
): PriceShockScenario[] {
  return shockPercentages.map((shockPct) => {
    const shockDec = shockPct / 100;
    const priceChange = summary.spotPrice * shockDec;
    const projectedUnderlying = Math.round(summary.spotPrice + priceChange);

    // Unhedged: Delta * ΔS + 0.5 * Gamma * (ΔS)^2
    const unhedgedDeltaPnL = summary.netDelta * priceChange;
    const unhedgedGammaPnL = 0.5 * summary.netGamma * Math.pow(priceChange, 2);
    const unhedgedExpectedPnL = Math.round(unhedgedDeltaPnL + unhedgedGammaPnL);

    // Hedged effective Greeks:
    const hedgeDeltaImpact = hedge && hedge.recommendedLots > 0
      ? (hedge.side === 'BUY' ? 1 : -1) * (hedge.instrumentType === 'ATM_PUT' ? -0.5 : hedge.instrumentType === 'ATM_CALL' ? 0.5 : 1.0) * hedge.recommendedQty
      : 0;

    const postHedgeDelta = summary.netDelta + hedgeDeltaImpact;
    const hedgedDeltaPnL = postHedgeDelta * priceChange;
    const hedgedExpectedPnL = Math.round(hedgedDeltaPnL + unhedgedGammaPnL);

    const projectedDelta = Number((summary.netDelta + summary.netGamma * priceChange).toFixed(2));
    const convexityRisk = Math.round(unhedgedGammaPnL);

    let severity: PriceShockScenario['severity'] = 'SAFE';
    if (unhedgedExpectedPnL < -20000 || unhedgedGammaPnL < -10000) severity = 'CRITICAL';
    else if (unhedgedExpectedPnL < -5000 || unhedgedGammaPnL < -3000) severity = 'MODERATE';

    return {
      shockPercent: shockPct,
      projectedUnderlying,
      projectedDelta,
      unhedgedExpectedPnL,
      hedgedExpectedPnL,
      convexityRisk,
      severity,
    };
  });
}

/**
 * Generates continuous 2D curvature points for SVG charting
 */
export function generateCurvaturePayoffCurve(
  summary: PortfolioGreekSummary,
  hedge?: HedgeRecommendation,
  numPoints: number = 25,
  maxShiftPct: number = 4.0
): CurvaturePayoffPoint[] {
  const points: CurvaturePayoffPoint[] = [];
  const step = (maxShiftPct * 2) / (numPoints - 1);

  const hedgeDeltaImpact = hedge && hedge.recommendedLots > 0
    ? (hedge.side === 'BUY' ? 1 : -1) * (hedge.instrumentType === 'ATM_PUT' ? -0.5 : hedge.instrumentType === 'ATM_CALL' ? 0.5 : 1.0) * hedge.recommendedQty
    : 0;
  const postHedgeDelta = summary.netDelta + hedgeDeltaImpact;

  for (let i = 0; i < numPoints; i++) {
    const shiftPct = -maxShiftPct + i * step;
    const dS = summary.spotPrice * (shiftPct / 100);

    const unhedgedPnL = summary.netDelta * dS + 0.5 * summary.netGamma * Math.pow(dS, 2);
    const hedgedPnL = postHedgeDelta * dS + 0.5 * summary.netGamma * Math.pow(dS, 2);

    points.push({
      percentShift: Number(shiftPct.toFixed(2)),
      unhedgedPnL: Math.round(unhedgedPnL),
      hedgedPnL: Math.round(hedgedPnL),
    });
  }

  return points;
}

/**
 * Checks auto-rebalance condition against trader tolerance threshold
 */
export function checkAutoRebalanceCondition(
  summary: PortfolioGreekSummary,
  config: AutoRebalanceConfig
): {
  triggered: boolean;
  reason: string;
  recommendedAction?: string;
} {
  if (!config.enabled) {
    return {
      triggered: false,
      reason: 'Auto-rebalance daemon is disabled.',
    };
  }

  const absDelta = Math.abs(summary.netDelta);
  if (absDelta > config.toleranceDelta) {
    const direction = summary.netDelta > 0 ? 'Long' : 'Short';
    return {
      triggered: true,
      reason: `Portfolio Delta (${summary.netDelta > 0 ? '+' : ''}${summary.netDelta} Δ) breached the ±${config.toleranceDelta} Δ boundary.`,
      recommendedAction: `Execute ${direction === 'Long' ? 'Short' : 'Long'} hedge to neutralize directional risk.`,
    };
  }

  return {
    triggered: false,
    reason: `Portfolio Delta (${summary.netDelta > 0 ? '+' : ''}${summary.netDelta} Δ) is within safe boundary (±${config.toleranceDelta} Δ).`,
  };
}

/**
 * Records an executed hedge order
 */
export function createHedgeExecution(
  recommendation: HedgeRecommendation,
  preDelta: number
): HedgeExecutionRecord {
  const postDelta = recommendation.residualDelta;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    id: `HDG-${now.getTime().toString(36).toUpperCase()}`,
    timestamp: timeStr,
    symbol: recommendation.symbol,
    side: recommendation.side,
    lots: recommendation.recommendedLots,
    quantity: recommendation.recommendedQty,
    executionPrice: recommendation.estimatedPrice,
    preDelta,
    postDelta,
    triggerReason: `Delta auto-rebalance: ${recommendation.side} ${recommendation.recommendedLots}L ${recommendation.symbol} to neutralize ${preDelta > 0 ? '+' : ''}${preDelta} Δ.`,
    status: 'FILLED',
  };
}

/**
 * Generates realistic mock portfolio positions for testing & demonstration
 */
export function getMockPortfolioPositions(spotPrice: number = 24900): PortfolioPositionGreeks[] {
  const atm = Math.round(spotPrice / 50) * 50;

  return [
    {
      id: 'pos_long_calls_atm',
      symbol: `NIFTY ${atm} CE`,
      assetType: 'OPTION',
      side: 'BUY',
      quantity: 50, // 2 lots
      entryPrice: 165.0,
      currentPrice: 172.5,
      strikePrice: atm,
      expiryDate: 'Weekly',
      lotSize: 25,
      greeks: {
        delta: 0.52,
        gamma: 0.0009,
        theta: -24.5,
        vega: 16.0,
      },
    },
    {
      id: 'pos_long_calls_otm',
      symbol: `NIFTY ${atm + 100} CE`,
      assetType: 'OPTION',
      side: 'BUY',
      quantity: 50, // 2 lots
      entryPrice: 85.0,
      currentPrice: 88.0,
      strikePrice: atm + 100,
      expiryDate: 'Weekly',
      lotSize: 25,
      greeks: {
        delta: 0.32,
        gamma: 0.0007,
        theta: -18.0,
        vega: 12.0,
      },
    },
    {
      id: 'pos_short_puts_atm',
      symbol: `NIFTY ${atm} PE`,
      assetType: 'OPTION',
      side: 'SELL',
      quantity: 25, // 1 lot short put (+delta)
      entryPrice: 155.0,
      currentPrice: 148.0,
      strikePrice: atm,
      expiryDate: 'Weekly',
      lotSize: 25,
      greeks: {
        delta: -0.48, // Sell put adds +0.48 delta
        gamma: 0.0009,
        theta: -22.0,
        vega: 15.0,
      },
    },
  ];
}

// Aliases for specification nomenclature
export const aggregatePortfolioGreeks = calculatePortfolioGreeks;
export const simulateGammaCurvature = simulatePriceShockScenarios;
export const calculateDeltaHedgeRequirement = (
  netDelta: number,
  spotPrice: number,
  lotSize: number = 25,
  rebalanceBand: number = 25
) => {
  const summary: PortfolioGreekSummary = {
    spotPrice,
    netDelta,
    netGamma: 0,
    netTheta: 0,
    netVega: 0,
    notionalDeltaInr: netDelta * spotPrice,
    rebalanceBand,
    deltaRiskStatus: 'NEUTRAL',
    gammaRiskStatus: 'SAFE',
    positionsCount: 1,
    isRebalanceRequired: Math.abs(netDelta) > rebalanceBand,
  };
  const fut = solveDeltaNeutralHedge(summary, 'FUTURES', 0, lotSize);
  const opt = solveDeltaNeutralHedge(summary, netDelta > 0 ? 'ATM_PUT' : 'ATM_CALL', 0, lotSize);
  return { underlyingHedge: fut, optionsHedge: opt };
};
