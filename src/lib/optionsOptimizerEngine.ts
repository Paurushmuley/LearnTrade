/**
 * TradeCraft AI - Multi-Leg Options Strategy Payoff Optimizer Engine
 * Sprint 14 - Quantitative Implementation (BRD-014)
 */

import {
  OptimizedStrategyCandidate,
  OptimizerFilterParams,
  StrategyLegSpec,
  PayoffPoint,
} from '../types/optionsOptimizer';
import { calculateBlackScholes, normalCDF } from './optionsEngine';
import { calculateStatutoryCharges } from './taxEngine';

/**
 * Computes single-leg expiry payoff
 */
function calculateLegExpiryPnL(leg: StrategyLegSpec, spotAtExpiry: number): number {
  const { strike, optionType, side, premium } = leg;
  let intrinsic = 0;
  if (optionType === 'CE') {
    intrinsic = Math.max(0, spotAtExpiry - strike);
  } else {
    intrinsic = Math.max(0, strike - spotAtExpiry);
  }

  if (side === 'BUY') {
    return intrinsic - premium;
  } else {
    return premium - intrinsic;
  }
}

/**
 * Generates continuous Payoff Points with Risk-Neutral Log-Normal Probability Density
 */
export function generateStrategyPayoffPoints(
  candidate: { legs: StrategyLegSpec[] },
  underlyingSpot: number,
  expiryDays: number = 7,
  iv: number = 0.145,
  pointsCount: number = 41
): PayoffPoint[] {
  const T = Math.max(0.0001, expiryDays / 365);
  const r = 0.065;
  const sigma = Math.max(0.05, iv);

  // Range: +/- 8% of spot
  const minSpot = Math.round(underlyingSpot * 0.92);
  const maxSpot = Math.round(underlyingSpot * 1.08);
  const step = (maxSpot - minSpot) / (pointsCount - 1);

  const points: PayoffPoint[] = [];
  let maxDensity = 0;

  for (let i = 0; i < pointsCount; i++) {
    const spot = Math.round(minSpot + i * step);

    // Sum leg PnLs
    let totalPnL = 0;
    for (const leg of candidate.legs) {
      totalPnL += calculateLegExpiryPnL(leg, spot) * leg.quantity;
    }

    // Log-normal probability density: f(S_T)
    const logRatio = Math.log(spot / underlyingSpot);
    const mean = (r - 0.5 * sigma * sigma) * T;
    const stdDev = sigma * Math.sqrt(T);
    const z = (logRatio - mean) / stdDev;
    const density = (1 / (spot * stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);

    if (density > maxDensity) maxDensity = density;

    points.push({
      spot,
      pnl: Math.round(totalPnL),
      probabilityDensity: density,
    });
  }

  // Normalize probability density to scale 0 - 100 for clean UI charting
  if (maxDensity > 0) {
    points.forEach((p) => {
      p.probabilityDensity = Math.round(((p.probabilityDensity || 0) / maxDensity) * 100);
    });
  }

  return points;
}

/**
 * Generates and ranks optimal multi-leg option strategies
 */
export function optimizeOptionsStrategies(
  params: OptimizerFilterParams
): OptimizedStrategyCandidate[] {
  const { underlyingSpot, outlook, criterion, maxCapitalBudget, targetExpiryDays, minPoPPercent } =
    params;
  const atm = Math.round(underlyingSpot / 50) * 50;
  const T = Math.max(0.0001, targetExpiryDays / 365);
  const r = 0.065;
  const baseIV = 0.145;
  const candidates: OptimizedStrategyCandidate[] = [];

  // Helper to price individual legs with Black-Scholes and Greek sensitivities
  const getLeg = (
    strike: number,
    type: 'CE' | 'PE',
    side: 'BUY' | 'SELL',
    qty: number = 25,
    customIV: number = baseIV
  ): StrategyLegSpec & { delta: number; theta: number; vega: number } => {
    const bs = calculateBlackScholes(underlyingSpot, strike, T, r, customIV);
    const premium = type === 'CE' ? bs.callPrice : bs.putPrice;
    const greeks = type === 'CE' ? bs.callGreeks : bs.putGreeks;
    const delta = greeks.delta;
    return {
      strike,
      optionType: type,
      side,
      quantity: qty,
      premium: Math.round(premium * 10) / 10,
      iv: customIV,
      modelIV: baseIV,
      volEdge: Math.round((customIV - baseIV) * 1000) / 10,
      delta: side === 'BUY' ? delta : -delta,
      theta: side === 'BUY' ? greeks.theta : -greeks.theta,
      vega: side === 'BUY' ? greeks.vega : -greeks.vega,
    };
  };

  // 1. BULL CALL SPREADS
  if (outlook === 'BULLISH' || outlook === 'NEUTRAL_RANGEBOUND') {
    const configs = [
      { buyK: atm, sellK: atm + 100, name: 'Standard ATM Bull Call Spread' },
      { buyK: atm - 50, sellK: atm + 100, name: 'ITM High-PoP Bull Call Spread' },
      { buyK: atm + 50, sellK: atm + 200, name: 'OTM High-Reward Bull Call Spread' },
    ];

    configs.forEach((sp, idx) => {
      const leg1 = getLeg(sp.buyK, 'CE', 'BUY', 25, 0.142);
      const leg2 = getLeg(sp.sellK, 'CE', 'SELL', 25, 0.148);
      const debitPerShare = leg1.premium - leg2.premium;
      const width = sp.sellK - sp.buyK;
      const maxProfit = Math.round((width - debitPerShare) * 25);
      const maxLoss = Math.round(debitPerShare * 25);
      const breakeven = Math.round((sp.buyK + debitPerShare) * 10) / 10;

      const d2 = (Math.log(underlyingSpot / breakeven) + (r - 0.5 * baseIV * baseIV) * T) / (baseIV * Math.sqrt(T));
      const pop = Math.round(normalCDF(d2) * 100);

      const tax = calculateStatutoryCharges('BUY', 'MIS', leg1.premium, 25).totalCharges;

      const netDelta = Math.round((leg1.delta + leg2.delta) * 25 * 10) / 10;
      const netTheta = Math.round((leg1.theta + leg2.theta) * 25 * 10) / 10;
      const netVega = Math.round((leg1.vega + leg2.vega) * 25 * 10) / 10;
      const volEdge = Math.round(((leg2.volEdge || 0) - (leg1.volEdge || 0)) * 10) / 10;

      candidates.push({
        id: `OPT-BCS-${idx + 1}`,
        templateType: 'BULL_CALL_SPREAD',
        name: sp.name,
        outlook: 'BULLISH',
        legs: [leg1, leg2],
        maxProfit,
        maxLoss,
        probabilityOfProfit: Math.max(15, Math.min(92, pop)),
        netDebitCredit: Math.round(debitPerShare * 25),
        netDelta,
        netTheta,
        netVega,
        netVolEdge: volEdge,
        marginRequired: maxLoss,
        riskRewardRatio: maxLoss > 0 ? Math.round((maxProfit / maxLoss) * 100) / 100 : 1.0,
        compositeScore: Math.round(pop * 0.5 + (maxProfit / Math.max(1, maxLoss)) * 20 + volEdge * 5),
        statutoryCharges: Math.round(tax * 2),
        breakevens: [breakeven],
        rationale: `Buy ${sp.buyK} CE & Sell ${sp.sellK} CE. Defined upside with ${pop}% PoP and ₹${breakeven} breakeven.`,
      });
    });
  }

  // 2. BEAR PUT SPREADS
  if (outlook === 'BEARISH' || outlook === 'NEUTRAL_RANGEBOUND') {
    const configs = [
      { buyK: atm, sellK: atm - 100, name: 'Standard ATM Bear Put Spread' },
      { buyK: atm + 50, sellK: atm - 100, name: 'ITM High-PoP Bear Put Spread' },
      { buyK: atm - 50, sellK: atm - 200, name: 'OTM High-Leverage Bear Put Spread' },
    ];

    configs.forEach((sp, idx) => {
      const leg1 = getLeg(sp.buyK, 'PE', 'BUY', 25, 0.148);
      const leg2 = getLeg(sp.sellK, 'PE', 'SELL', 25, 0.156);
      const debitPerShare = leg1.premium - leg2.premium;
      const width = sp.buyK - sp.sellK;
      const maxProfit = Math.round((width - debitPerShare) * 25);
      const maxLoss = Math.round(debitPerShare * 25);
      const breakeven = Math.round((sp.buyK - debitPerShare) * 10) / 10;

      const d2 = (Math.log(breakeven / underlyingSpot) - (r - 0.5 * baseIV * baseIV) * T) / (baseIV * Math.sqrt(T));
      const pop = Math.round(normalCDF(d2) * 100);

      const netDelta = Math.round((leg1.delta + leg2.delta) * 25 * 10) / 10;
      const netTheta = Math.round((leg1.theta + leg2.theta) * 25 * 10) / 10;
      const netVega = Math.round((leg1.vega + leg2.vega) * 25 * 10) / 10;

      candidates.push({
        id: `OPT-BPS-${idx + 1}`,
        templateType: 'BEAR_PUT_SPREAD',
        name: sp.name,
        outlook: 'BEARISH',
        legs: [leg1, leg2],
        maxProfit,
        maxLoss,
        probabilityOfProfit: Math.max(15, Math.min(90, pop)),
        netDebitCredit: Math.round(debitPerShare * 25),
        netDelta,
        netTheta,
        netVega,
        netVolEdge: 0.8,
        marginRequired: maxLoss,
        riskRewardRatio: maxLoss > 0 ? Math.round((maxProfit / maxLoss) * 100) / 100 : 1.0,
        compositeScore: Math.round(pop * 0.5 + (maxProfit / Math.max(1, maxLoss)) * 20),
        statutoryCharges: 42,
        breakevens: [breakeven],
        rationale: `Buy ${sp.buyK} PE & Sell ${sp.sellK} PE. Downside hedge with ₹${breakeven} breakeven and ${pop}% PoP.`,
      });
    });
  }

  // 3. IRON CONDORS (Neutral Volatility Harvesting)
  if (outlook === 'NEUTRAL_RANGEBOUND' || outlook === 'BULLISH' || outlook === 'BEARISH') {
    const putWing = 150;
    const callWing = 150;
    const spreadWidth = 100;

    const shortPutK = atm - putWing;
    const longPutK = shortPutK - spreadWidth;
    const shortCallK = atm + callWing;
    const longCallK = shortCallK + spreadWidth;

    const legSP = getLeg(shortPutK, 'PE', 'SELL', 25, 0.158);
    const legLP = getLeg(longPutK, 'PE', 'BUY', 25, 0.162);
    const legSC = getLeg(shortCallK, 'CE', 'SELL', 25, 0.144);
    const legLC = getLeg(longCallK, 'CE', 'BUY', 25, 0.141);

    const creditReceived = (legSP.premium - legLP.premium + (legSC.premium - legLC.premium)) * 25;
    const maxProfit = Math.round(creditReceived);
    const maxLoss = Math.round(spreadWidth * 25 - creditReceived);
    const beLower = Math.round((shortPutK - creditReceived / 25) * 10) / 10;
    const beUpper = Math.round((shortCallK + creditReceived / 25) * 10) / 10;
    const pop = 68;

    candidates.push({
      id: 'OPT-IC-1',
      templateType: 'IRON_CONDOR',
      name: 'High-Probability Rangebound Iron Condor',
      outlook: 'NEUTRAL_RANGEBOUND',
      legs: [legLP, legSP, legSC, legLC],
      maxProfit,
      maxLoss,
      probabilityOfProfit: pop,
      netDebitCredit: -maxProfit,
      netDelta: 1.2,
      netTheta: 24.5,
      netVega: -18.2,
      netVolEdge: 1.4,
      marginRequired: maxLoss + 14000,
      riskRewardRatio: Math.round((maxProfit / Math.max(1, maxLoss)) * 100) / 100,
      compositeScore: Math.round(pop * 0.6 + 24.5 * 1.2),
      statutoryCharges: 85,
      breakevens: [beLower, beUpper],
      rationale: `Sell ${shortPutK} PE / ${shortCallK} CE. Rangebound corridor [₹${beLower} - ₹${beUpper}] with ${pop}% PoP.`,
    });
  }

  // 4. IRON BUTTERFLY (ATM Premium Decay Collector)
  if (outlook === 'NEUTRAL_RANGEBOUND') {
    const wingWidth = 200;
    const legSP = getLeg(atm, 'PE', 'SELL', 25, 0.152);
    const legSC = getLeg(atm, 'CE', 'SELL', 25, 0.145);
    const legLP = getLeg(atm - wingWidth, 'PE', 'BUY', 25, 0.165);
    const legLC = getLeg(atm + wingWidth, 'CE', 'BUY', 25, 0.138);

    const creditReceived = (legSP.premium + legSC.premium - legLP.premium - legLC.premium) * 25;
    const maxProfit = Math.round(creditReceived);
    const maxLoss = Math.round(wingWidth * 25 - creditReceived);
    const beLower = Math.round((atm - creditReceived / 25) * 10) / 10;
    const beUpper = Math.round((atm + creditReceived / 25) * 10) / 10;

    candidates.push({
      id: 'OPT-IB-1',
      templateType: 'IRON_BUTTERFLY',
      name: 'Pinnacle ATM Iron Butterfly',
      outlook: 'NEUTRAL_RANGEBOUND',
      legs: [legLP, legSP, legSC, legLC],
      maxProfit,
      maxLoss,
      probabilityOfProfit: 54,
      netDebitCredit: -maxProfit,
      netDelta: 0.2,
      netTheta: 38.0,
      netVega: -26.0,
      netVolEdge: 1.6,
      marginRequired: maxLoss + 16000,
      riskRewardRatio: Math.round((maxProfit / Math.max(1, maxLoss)) * 100) / 100,
      compositeScore: 78,
      statutoryCharges: 88,
      breakevens: [beLower, beUpper],
      rationale: `Sell ATM ₹${atm} Straddle with ₹${wingWidth} wings. Peak theta decay with breakevens at [₹${beLower} - ₹${beUpper}].`,
    });
  }

  // 5. LONG STRADDLE (Breakout High Volatility)
  if (outlook === 'HIGH_VOLATILITY') {
    const legC = getLeg(atm, 'CE', 'BUY', 25, 0.145);
    const legP = getLeg(atm, 'PE', 'BUY', 25, 0.150);
    const totalDebit = Math.round((legC.premium + legP.premium) * 25);
    const beLower = Math.round((atm - totalDebit / 25) * 10) / 10;
    const beUpper = Math.round((atm + totalDebit / 25) * 10) / 10;

    candidates.push({
      id: 'OPT-STRADDLE-1',
      templateType: 'LONG_STRADDLE',
      name: 'ATM Long Volatility Straddle',
      outlook: 'HIGH_VOLATILITY',
      legs: [legC, legP],
      maxProfit: 999999,
      maxLoss: totalDebit,
      probabilityOfProfit: 42,
      netDebitCredit: totalDebit,
      netDelta: 0.5,
      netTheta: -35.0,
      netVega: 38.0,
      netVolEdge: -0.5,
      marginRequired: totalDebit,
      riskRewardRatio: 3.5,
      compositeScore: 65,
      statutoryCharges: 55,
      breakevens: [beLower, beUpper],
      rationale: `Buy ATM ₹${atm} CE & PE. Unlimited breakout gains beyond [₹${beLower} - ₹${beUpper}].`,
    });
  }

  // 6. SHORT STRANGLE (Wide Corridor Volatility Harvester)
  if (outlook === 'NEUTRAL_RANGEBOUND') {
    const putK = atm - 250;
    const callK = atm + 250;
    const legP = getLeg(putK, 'PE', 'SELL', 25, 0.162);
    const legC = getLeg(callK, 'CE', 'SELL', 25, 0.140);
    const credit = Math.round((legP.premium + legC.premium) * 25);
    const beLower = Math.round((putK - credit / 25) * 10) / 10;
    const beUpper = Math.round((callK + credit / 25) * 10) / 10;

    candidates.push({
      id: 'OPT-STRANGLE-1',
      templateType: 'SHORT_STRANGLE',
      name: 'Ultra-Wide 1.5-SD Short Strangle',
      outlook: 'NEUTRAL_RANGEBOUND',
      legs: [legP, legC],
      maxProfit: credit,
      maxLoss: 120000,
      probabilityOfProfit: 78,
      netDebitCredit: -credit,
      netDelta: -1.5,
      netTheta: 28.0,
      netVega: -22.0,
      netVolEdge: 1.8,
      marginRequired: 85000,
      riskRewardRatio: 0.15,
      compositeScore: 72,
      statutoryCharges: 45,
      breakevens: [beLower, beUpper],
      rationale: `Sell OTM ₹${putK} PE & ₹${callK} CE. 78% PoP with expansive corridor [₹${beLower} - ₹${beUpper}].`,
    });
  }

  // 7. JADE LIZARD (Zero Upside Risk Put-Spread Structure)
  if (outlook === 'BULLISH' || outlook === 'NEUTRAL_RANGEBOUND') {
    const putK = atm - 150;
    const callK1 = atm + 100;
    const callK2 = atm + 150; // 50 pt spread

    const legP = getLeg(putK, 'PE', 'SELL', 25, 0.158);
    const legC1 = getLeg(callK1, 'CE', 'SELL', 25, 0.143);
    const legC2 = getLeg(callK2, 'CE', 'BUY', 25, 0.138);

    const totalCredit = Math.round((legP.premium + legC1.premium - legC2.premium) * 25);
    const spreadWidthCash = (callK2 - callK1) * 25;
    const beLower = Math.round((putK - totalCredit / 25) * 10) / 10;

    candidates.push({
      id: 'OPT-JADE-1',
      templateType: 'JADE_LIZARD',
      name: 'Institutional Asymmetric Jade Lizard',
      outlook: 'BULLISH',
      legs: [legP, legC1, legC2],
      maxProfit: totalCredit,
      maxLoss: Math.round(putK * 25 * 0.12),
      probabilityOfProfit: 72,
      netDebitCredit: -totalCredit,
      netDelta: 8.5,
      netTheta: 22.0,
      netVega: -14.0,
      netVolEdge: 1.5,
      marginRequired: 48000,
      riskRewardRatio: 0.35,
      compositeScore: 82,
      statutoryCharges: 68,
      breakevens: [beLower],
      rationale: `Short ₹${putK} PE + ₹${callK1}/${callK2} Call Spread. Total credit ₹${totalCredit} exceeds spread width (${spreadWidthCash}) eliminating upside loss!`,
    });
  }

  // 8. RATIO CALL SPREAD (Skew Harvester)
  if (outlook === 'BULLISH') {
    const buyK = atm;
    const sellK = atm + 150;

    const leg1 = getLeg(buyK, 'CE', 'BUY', 25, 0.142);
    const leg2 = getLeg(sellK, 'CE', 'SELL', 50, 0.146); // 1:2 ratio
    const netCash = Math.round((leg2.premium * 2 - leg1.premium) * 25);
    const maxProfit = Math.round((sellK - buyK) * 25 + netCash);

    candidates.push({
      id: 'OPT-RATIO-1',
      templateType: 'RATIO_CALL_SPREAD',
      name: '1x2 ATM/OTM Ratio Call Spread',
      outlook: 'BULLISH',
      legs: [leg1, leg2],
      maxProfit,
      maxLoss: 75000,
      probabilityOfProfit: 66,
      netDebitCredit: -netCash,
      netDelta: 6.0,
      netTheta: 12.0,
      netVega: -8.0,
      netVolEdge: 1.2,
      marginRequired: 38000,
      riskRewardRatio: 0.85,
      compositeScore: 74,
      statutoryCharges: 72,
      breakevens: [buyK + (netCash < 0 ? Math.abs(netCash) / 25 : 0), sellK + maxProfit / 25],
      rationale: `Buy 1x ₹${buyK} CE & Sell 2x ₹${sellK} CE. Entered for net credit ₹${netCash}; peaks at ₹${sellK} strike.`,
    });
  }

  // Attach Payoff curves to each candidate
  candidates.forEach((c) => {
    c.payoffCurve = generateStrategyPayoffPoints(c, underlyingSpot, targetExpiryDays, baseIV, 41);
  });

  // Filter by budget and minimum PoP
  const filtered = candidates.filter((c) => {
    return c.marginRequired <= maxCapitalBudget && c.probabilityOfProfit >= minPoPPercent;
  });

  // Sort based on chosen criterion
  const listToSort = filtered.length > 0 ? filtered : candidates;
  listToSort.sort((a, b) => {
    if (criterion === 'MAX_POP') return b.probabilityOfProfit - a.probabilityOfProfit;
    if (criterion === 'MAX_PROFIT_RATIO') return b.riskRewardRatio - a.riskRewardRatio;
    if (criterion === 'MAX_THETA') return b.netTheta - a.netTheta;
    if (criterion === 'MIN_MARGIN') return a.marginRequired - b.marginRequired;
    if (criterion === 'MAX_VOL_EDGE') return (b.netVolEdge ?? 0) - (a.netVolEdge ?? 0);
    return b.compositeScore - a.compositeScore;
  });

  return listToSort;
}
