/**
 * TradeCraft AI - Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine
 * Sprint 21 - Algorithmic Core (BRD-021)
 *
 * Implements:
 * 1. Implied Correlation Solver with strict [0, 1] boundary enforcement & super-hedging violation detection
 * 2. Basket implied volatility calculator vs Index implied volatility to compute implied correlation and dispersion spread (spread = basketIV - indexIV)
 * 3. Dirty dispersion scanner across top Nifty constituents (Reliance, HDFC Bank, ICICI Bank, Infosys, TCS)
 * 4. Vega-Neutral Basket Execution Planner & statutory charges integration
 * 5. Gamma scalping rebalancer solver calculating delta hedging orders when spot breaches rebalance bands (+-0.5% or +-1.0%)
 * 6. Multi-Expiry Term Structure & 25-Delta Skew Hedging Engine
 */

import {
  BasketComponent,
  ImpliedCorrelationResult,
  DispersionSpreadAnalysis,
  DispersionArbitrageType,
  BasketLegAllocation,
  DispersionBasketOrderPlan,
  GammaScalpAction,
  GammaScalpTrigger,
  TermStructureSkewPoint,
  MultiExpirySkewHedgePlan,
  ConstituentOptionQuote,
  IndexOptionQuote,
  BasketIVCalculationResult,
  DirtyConstituentAnalysis,
  DirtyDispersionScanResult,
  DispersionPortfolioAllocation,
  DispersionSignal,
  MarketRegime,
  GammaScalpingConfig,
  GammaScalpingState,
  GammaScalpingOrder,
  GammaScalpingRebalanceResult,
} from '../types/dispersion';
import { calculateBlackScholes } from './optionsEngine';
import { calculateStatutoryCharges } from './taxEngine';

// ==========================================
// 1. TOP NIFTY CONSTITUENTS & DEFAULTS
// ==========================================

export const DEFAULT_NIFTY_CONSTITUENTS: ConstituentOptionQuote[] = [
  {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd',
    spotPrice: 2950,
    strike: 2950,
    expiry: '2026-11-26',
    callIV: 0.218,
    putIV: 0.232,
    atmIV: 0.225,
    historicalVol: 0.192,
    lotSize: 250,
    indexWeight: 0.095, // 9.5%
    callPrice: 84.5,
    putPrice: 72.8,
    straddlePrice: 157.3,
    bidAskSpread: 0.8,
  },
  {
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Ltd',
    spotPrice: 1680,
    strike: 1680,
    expiry: '2026-11-26',
    callIV: 0.188,
    putIV: 0.202,
    atmIV: 0.195,
    historicalVol: 0.168,
    lotSize: 550,
    indexWeight: 0.135, // 13.5%
    callPrice: 42.1,
    putPrice: 36.4,
    straddlePrice: 78.5,
    bidAskSpread: 0.5,
  },
  {
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank Ltd',
    spotPrice: 1240,
    strike: 1240,
    expiry: '2026-11-26',
    callIV: 0.205,
    putIV: 0.221,
    atmIV: 0.213,
    historicalVol: 0.184,
    lotSize: 700,
    indexWeight: 0.078, // 7.8%
    callPrice: 33.6,
    putPrice: 29.2,
    straddlePrice: 62.8,
    bidAskSpread: 0.4,
  },
  {
    symbol: 'INFY',
    companyName: 'Infosys Ltd',
    spotPrice: 1850,
    strike: 1850,
    expiry: '2026-11-26',
    callIV: 0.235,
    putIV: 0.251,
    atmIV: 0.243,
    historicalVol: 0.211,
    lotSize: 400,
    indexWeight: 0.055, // 5.5%
    callPrice: 57.2,
    putPrice: 50.1,
    straddlePrice: 107.3,
    bidAskSpread: 0.6,
  },
  {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services Ltd',
    spotPrice: 4120,
    strike: 4120,
    expiry: '2026-11-26',
    callIV: 0.198,
    putIV: 0.212,
    atmIV: 0.205,
    historicalVol: 0.176,
    lotSize: 175,
    indexWeight: 0.042, // 4.2%
    callPrice: 106.8,
    putPrice: 93.4,
    straddlePrice: 200.2,
    bidAskSpread: 1.2,
  },
];

export const DEFAULT_NIFTY_TOP5_CONSTITUENTS = DEFAULT_NIFTY_CONSTITUENTS;

export const DEFAULT_NIFTY_INDEX_QUOTE: IndexOptionQuote = {
  symbol: 'NIFTY 50',
  spotPrice: 24500,
  strike: 24500,
  expiry: '2026-11-26',
  atmIV: 0.138, // 13.8%
  callIV: 0.132,
  putIV: 0.144,
  historicalVol: 0.125,
  lotSize: 25,
  callPrice: 432.0,
  putPrice: 388.0,
  straddlePrice: 820.0,
};

export const DEFAULT_NIFTY_TOP5_COMPONENTS: BasketComponent[] = DEFAULT_NIFTY_CONSTITUENTS.map((c) => ({
  symbol: c.symbol,
  weight: c.indexWeight,
  spotPrice: c.spotPrice,
  impliedVol: c.atmIV,
  realizedVol: c.historicalVol,
  atmStrike: c.strike,
  lotSize: c.lotSize,
  vega: 12.5,
  delta: 0.5,
  gamma: 0.002,
}));

/**
 * Normalizes an array of weights so that they sum to 1.0
 */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + Math.max(0.0001, w), 0);
  if (sum <= 1e-12) {
    const equalWeight = 1.0 / weights.length;
    return weights.map(() => equalWeight);
  }
  return weights.map((w) => w / sum);
}

/**
 * Returns deep-copied default Nifty top 5 constituents
 */
export function getDefaultNiftyTop5Constituents(): ConstituentOptionQuote[] {
  return JSON.parse(JSON.stringify(DEFAULT_NIFTY_CONSTITUENTS));
}

/**
 * Returns deep-copied default Nifty index quote
 */
export function getDefaultNiftyIndexQuote(): IndexOptionQuote {
  return JSON.parse(JSON.stringify(DEFAULT_NIFTY_INDEX_QUOTE));
}

// ==========================================
// 2. IMPLIED CORRELATION & BASKET IV SOLVER
// ==========================================

/**
 * Calculates Implied Correlation from Index IV and Component IVs
 * Formula:
 * sigma_index^2 = sum(w_i^2 * sigma_i^2) + rho * [ (sum(w_i * sigma_i))^2 - sum(w_i^2 * sigma_i^2) ]
 *
 * Solving for rho:
 * rho = (sigma_index^2 - sum(w_i^2 * sigma_i^2)) / [ (sum(w_i * sigma_i))^2 - sum(w_i^2 * sigma_i^2) ]
 */
export function calculateImpliedCorrelation(
  indexImpliedVol: number,
  components: BasketComponent[]
): ImpliedCorrelationResult {
  if (!components || components.length === 0) {
    return {
      impliedCorrelation: 1.0,
      rawImpliedCorrelation: 1.0,
      isClamped: false,
      clampedReason: 'NONE',
      indexImpliedVol,
      weightedComponentVol: indexImpliedVol,
      indexVariance: indexImpliedVol * indexImpliedVol,
      independentVarianceSum: 0,
      crossProductVarianceSum: 0,
    };
  }

  const rawWeights = components.map((c) => c.weight);
  const normWeights = normalizeWeights(rawWeights);

  const sigmaIndex = Math.max(0.0001, indexImpliedVol);
  const indexVariance = sigmaIndex * sigmaIndex;

  let weightedComponentVol = 0;
  let independentVarianceSum = 0;

  for (let i = 0; i < components.length; i++) {
    const w = normWeights[i];
    const vol = Math.max(0.0001, components[i].impliedVol);
    weightedComponentVol += w * vol;
    independentVarianceSum += w * w * vol * vol;
  }

  const weightedVolSquared = weightedComponentVol * weightedComponentVol;
  const crossProductVarianceSum = weightedVolSquared - independentVarianceSum;

  if (components.length === 1 || crossProductVarianceSum <= 1e-10) {
    return {
      impliedCorrelation: 1.0,
      rawImpliedCorrelation: 1.0,
      isClamped: false,
      clampedReason: 'NONE',
      indexImpliedVol: sigmaIndex,
      weightedComponentVol,
      indexVariance,
      independentVarianceSum,
      crossProductVarianceSum: Math.max(0, crossProductVarianceSum),
    };
  }

  const rawRho = (indexVariance - independentVarianceSum) / crossProductVarianceSum;

  let impliedCorrelation = rawRho;
  let isClamped = false;
  let clampedReason: 'SUPER_HEDGING_VIOLATION' | 'ZERO_CORRELATION_CLAMPED' | 'NONE' = 'NONE';

  if (rawRho > 1.0) {
    impliedCorrelation = 1.0;
    isClamped = true;
    clampedReason = 'SUPER_HEDGING_VIOLATION';
  } else if (rawRho < 0.0) {
    impliedCorrelation = 0.0;
    isClamped = true;
    clampedReason = 'ZERO_CORRELATION_CLAMPED';
  }

  return {
    impliedCorrelation: Number(impliedCorrelation.toFixed(4)),
    rawImpliedCorrelation: Number(rawRho.toFixed(4)),
    isClamped,
    clampedReason,
    indexImpliedVol: Number(sigmaIndex.toFixed(4)),
    weightedComponentVol: Number(weightedComponentVol.toFixed(4)),
    indexVariance: Number(indexVariance.toFixed(6)),
    independentVarianceSum: Number(independentVarianceSum.toFixed(6)),
    crossProductVarianceSum: Number(crossProductVarianceSum.toFixed(6)),
  };
}

/**
 * Computes Basket Implied Volatility vs Index Implied Volatility and derives Implied Correlation
 * Computes dispersion spread: spread = basketIV - indexIV
 */
export function calculateBasketImpliedVolatility(
  constituents: ConstituentOptionQuote[],
  indexQuote: IndexOptionQuote,
  realizedCorrelation: number = 0.45
): BasketIVCalculationResult {
  if (!constituents || constituents.length === 0) {
    throw new Error('Basket requires at least one constituent option quote.');
  }

  const normWeights = normalizeWeights(constituents.map((c) => c.indexWeight));

  let basketIV = 0;
  let weightedConstituentVariance = 0;

  for (let i = 0; i < constituents.length; i++) {
    const w = normWeights[i];
    const iv = constituents[i].atmIV;
    basketIV += w * iv;
    weightedConstituentVariance += Math.pow(w * iv, 2);
  }

  const indexIV = indexQuote.atmIV;
  const indexVariance = Math.pow(indexIV, 2);
  const linearBasketVariance = Math.pow(basketIV, 2);
  const crossTermVariance = linearBasketVariance - weightedConstituentVariance;

  let rawImpliedCorrelation = 1.0;
  if (Math.abs(crossTermVariance) > 1e-9) {
    rawImpliedCorrelation = (indexVariance - weightedConstituentVariance) / crossTermVariance;
  }

  const impliedCorrelation = Math.max(0, Math.min(1, Number(rawImpliedCorrelation.toFixed(4))));
  const dispersionSpread = Number((basketIV - indexIV).toFixed(5));
  const dispersionSpreadBps = Math.round(dispersionSpread * 10000);
  const correlationSpread = Number((impliedCorrelation - realizedCorrelation).toFixed(4));
  const varianceBasketIV = Number(Math.sqrt(weightedConstituentVariance).toFixed(5));

  let signal: DispersionSignal = 'NEUTRAL';
  let signalStrength = 50;
  let rationale = '';

  if (impliedCorrelation >= 0.65 || correlationSpread >= 0.15) {
    signal = 'LONG_DISPERSION';
    signalStrength = Math.min(100, Math.round(50 + (impliedCorrelation - 0.5) * 100));
    rationale = `Implied correlation (${(impliedCorrelation * 100).toFixed(1)}%) is heavily elevated above realized benchmark (${(realizedCorrelation * 100).toFixed(1)}%). Index IV is rich vs constituents. Sell Index Options & Buy Basket Options to harvest correlation mean-reversion.`;
  } else if (impliedCorrelation <= 0.35 || correlationSpread <= -0.15) {
    signal = 'SHORT_DISPERSION';
    signalStrength = Math.min(100, Math.round(50 + (0.5 - impliedCorrelation) * 100));
    rationale = `Implied correlation (${(impliedCorrelation * 100).toFixed(1)}%) is underpriced relative to realized benchmark (${(realizedCorrelation * 100).toFixed(1)}%). Index options are cheap relative to individual stock options. Buy Index Options & Sell Basket Options.`;
  } else {
    signal = 'NEUTRAL';
    signalStrength = Math.round(100 - Math.abs(impliedCorrelation - 0.5) * 100);
    rationale = `Implied correlation (${(impliedCorrelation * 100).toFixed(1)}%) is priced within fair-value equilibrium band. Dispersion spread is ${dispersionSpreadBps} bps. No structural mispricing detected.`;
  }

  return {
    indexIV: Number(indexIV.toFixed(4)),
    basketIV: Number(basketIV.toFixed(4)),
    varianceBasketIV,
    dispersionSpread,
    dispersionSpreadBps,
    weightedConstituentVariance: Number(weightedConstituentVariance.toFixed(6)),
    impliedCorrelation,
    rawImpliedCorrelation: Number(rawImpliedCorrelation.toFixed(4)),
    realizedCorrelation: Number(realizedCorrelation.toFixed(4)),
    correlationSpread,
    signal,
    signalStrength,
    rationale,
  };
}

/**
 * Calculates Dispersion Spread and Arbitrage Classification
 */
export function analyzeDispersionSpread(
  indexSymbol: string,
  indexImpliedVol: number,
  components: BasketComponent[],
  realizedCorrelation: number = 0.50,
  hurdleThreshold: number = 0.05
): DispersionSpreadAnalysis {
  const corrResult = calculateImpliedCorrelation(indexImpliedVol, components);
  const dirtySpread = Number((corrResult.weightedComponentVol - indexImpliedVol).toFixed(4));
  const corrSpread = Number((corrResult.impliedCorrelation - realizedCorrelation).toFixed(4));

  let arbitrageType: DispersionArbitrageType = 'NEUTRAL_NO_ARBITRAGE';
  let recommendedAction: 'SELL_INDEX_BUY_COMPONENTS' | 'BUY_INDEX_SELL_COMPONENTS' | 'HOLD_NO_ACTION' = 'HOLD_NO_ACTION';
  let confidenceScore = 50;

  if (corrSpread > hurdleThreshold) {
    arbitrageType = 'LONG_DISPERSION';
    recommendedAction = 'SELL_INDEX_BUY_COMPONENTS';
    confidenceScore = Math.min(99, Math.round(50 + (corrSpread / 0.5) * 50));
  } else if (corrSpread < -hurdleThreshold) {
    arbitrageType = 'SHORT_DISPERSION';
    recommendedAction = 'BUY_INDEX_SELL_COMPONENTS';
    confidenceScore = Math.min(99, Math.round(50 + (Math.abs(corrSpread) / 0.5) * 50));
  } else {
    arbitrageType = 'NEUTRAL_NO_ARBITRAGE';
    recommendedAction = 'HOLD_NO_ACTION';
    confidenceScore = 40;
  }

  const netEstimatedEdgeBps = Number((corrSpread * 1000).toFixed(1));

  return {
    indexSymbol,
    indexImpliedVol,
    weightedComponentVol: corrResult.weightedComponentVol,
    dirtyDispersionSpread: dirtySpread,
    impliedCorrelation: corrResult.impliedCorrelation,
    realizedCorrelation,
    correlationSpread: corrSpread,
    arbitrageType,
    recommendedAction,
    confidenceScore,
    hurdleThreshold,
    netEstimatedEdgeBps,
  };
}

// ==========================================
// 3. DIRTY DISPERSION SCANNER (TOP NIFTY 5)
// ==========================================

/**
 * Scans Dirty Dispersion across Top Nifty Constituents (Reliance, HDFC Bank, ICICI Bank, Infosys, TCS)
 * and generates Vega-neutral multi-leg execution with Indian statutory tax drag
 */
export function scanDirtyDispersion(
  quotes: ConstituentOptionQuote[] = DEFAULT_NIFTY_CONSTITUENTS,
  indexQuote: IndexOptionQuote = DEFAULT_NIFTY_INDEX_QUOTE,
  options?: {
    targetIndexLots?: number;
    realizedCorrelation?: number;
  }
): DirtyDispersionScanResult {
  const targetIndexLots = options?.targetIndexLots || 10;
  const realizedCorr = options?.realizedCorrelation ?? 0.45;

  const normWeights = normalizeWeights(quotes.map((q) => q.indexWeight));
  const basketCalc = calculateBasketImpliedVolatility(quotes, indexQuote, realizedCorr);

  const T = 30 / 365;
  const r = 0.065;

  const indexBS = calculateBlackScholes(
    indexQuote.spotPrice,
    indexQuote.strike,
    T,
    r,
    indexQuote.atmIV
  );
  const indexStraddlePrice = indexQuote.straddlePrice || (indexBS.callPrice + indexBS.putPrice);
  const indexStraddleVega = indexBS.callGreeks.vega + indexBS.putGreeks.vega;

  const totalIndexContracts = targetIndexLots * indexQuote.lotSize;
  const totalIndexVega = totalIndexContracts * indexStraddleVega;

  const isLongDispersion = basketCalc.signal === 'LONG_DISPERSION';
  const isShortDispersion = basketCalc.signal === 'SHORT_DISPERSION';
  const indexSide = isLongDispersion ? 'SELL' : isShortDispersion ? 'BUY' : 'SELL';
  const constituentSide = indexSide === 'SELL' ? 'BUY' : 'SELL';

  const constituentsAnalysis: DirtyConstituentAnalysis[] = [];
  const constituentLegsAllocation: DispersionPortfolioAllocation['constituentLegs'] = [];

  let totalConstituentVega = 0;
  let totalConstituentCapital = 0;
  let totalGrossConstituentPremium = 0;
  let totalStatutoryTaxes = 0;

  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    const normW = normWeights[i];

    const bs = calculateBlackScholes(q.spotPrice, q.strike, T, r, q.atmIV);
    const straddlePrice = q.straddlePrice || (bs.callPrice + bs.putPrice);
    const straddleVega = bs.callGreeks.vega + bs.putGreeks.vega;

    const targetLegVega = normW * totalIndexVega;
    const vegaPerLot = straddleVega * q.lotSize;
    const recommendedLots = Math.max(1, Math.round(targetLegVega / Math.max(0.01, vegaPerLot)));
    const contracts = recommendedLots * q.lotSize;
    const actualLegVega = contracts * straddleVega;

    totalConstituentVega += actualLegVega;

    const allocatedCapital = contracts * straddlePrice;
    totalGrossConstituentPremium += allocatedCapital;
    totalConstituentCapital += allocatedCapital;

    const componentVariance = Math.pow(normW * q.atmIV, 2);
    const basketVariance = Math.pow(basketCalc.basketIV, 2);
    const varianceContributionPct = Number(((componentVariance / Math.max(1e-6, basketVariance)) * 100).toFixed(2));

    const volatilityPremium = Number((q.atmIV - q.historicalVol).toFixed(4));
    const strikeSkew = Number((q.putIV - q.callIV).toFixed(4));

    const legTax = calculateStatutoryCharges(constituentSide, 'MIS', straddlePrice, contracts);
    totalStatutoryTaxes += legTax.totalCharges;

    const analysis: DirtyConstituentAnalysis = {
      symbol: q.symbol,
      companyName: q.companyName || q.symbol,
      weight: q.indexWeight,
      normalizedWeight: Number(normW.toFixed(4)),
      spotPrice: q.spotPrice,
      atmIV: q.atmIV,
      historicalVol: q.historicalVol,
      volatilityPremium,
      varianceContribution: Number(componentVariance.toFixed(6)),
      varianceContributionPct,
      strikeSkew,
      lotSize: q.lotSize,
      straddlePrice: Number(straddlePrice.toFixed(2)),
      vegaPerLot: Number(vegaPerLot.toFixed(2)),
      recommendedLegs: {
        action: constituentSide,
        side: constituentSide,
        lots: recommendedLots,
        contracts,
        targetVega: Number(targetLegVega.toFixed(2)),
        estimatedPremium: Number(allocatedCapital.toFixed(2)),
      },
    };

    constituentsAnalysis.push(analysis);

    constituentLegsAllocation.push({
      symbol: q.symbol,
      side: constituentSide,
      lots: recommendedLots,
      contracts,
      weight: Number(normW.toFixed(4)),
      straddlePrice: Number(straddlePrice.toFixed(2)),
      allocatedCapital: Number(allocatedCapital.toFixed(2)),
      legVega: Number(actualLegVega.toFixed(2)),
    });
  }

  const indexGrossPremium = totalIndexContracts * indexStraddlePrice;
  const indexTax = calculateStatutoryCharges(indexSide, 'MIS', indexStraddlePrice, totalIndexContracts);
  totalStatutoryTaxes += indexTax.totalCharges;

  const signedIndexVega = indexSide === 'BUY' ? totalIndexVega : -totalIndexVega;
  const signedConstituentVega = constituentSide === 'BUY' ? totalConstituentVega : -totalConstituentVega;
  const netPortfolioVega = Number((signedConstituentVega + signedIndexVega).toFixed(2));
  const netPortfolioDelta = 0.0;

  const totalEstimatedCapital = Number((totalConstituentCapital + indexGrossPremium).toFixed(2));
  const totalGrossPremium = Number((totalGrossConstituentPremium + indexGrossPremium).toFixed(2));
  const netCapitalRequired = Number(
    (indexSide === 'SELL' ? totalConstituentCapital - indexGrossPremium : totalConstituentCapital + indexGrossPremium).toFixed(2)
  );

  let marketRegime: MarketRegime = 'FAIR_VALUE';
  if (basketCalc.impliedCorrelation >= 0.65) marketRegime = 'HIGH_IMPLIED_CORRELATION';
  else if (basketCalc.impliedCorrelation <= 0.35) marketRegime = 'LOW_IMPLIED_CORRELATION';

  const recommendedAllocation: DispersionPortfolioAllocation = {
    indexLots: targetIndexLots,
    indexSide,
    indexVega: Number(totalIndexVega.toFixed(2)),
    indexGrossPremium: Number(indexGrossPremium.toFixed(2)),
    constituentLegs: constituentLegsAllocation,
    netPortfolioVega,
    netPortfolioDelta,
    totalEstimatedCapital,
    totalGrossPremium,
    statutoryCharges: Number(totalStatutoryTaxes.toFixed(2)),
    netCapitalRequired,
    breakevenCorrelationMove: Number(Math.abs(basketCalc.correlationSpread * 0.35).toFixed(4)),
  };

  return {
    timestamp: new Date().toISOString(),
    indexSymbol: indexQuote.symbol,
    indexQuote,
    constituents: constituentsAnalysis,
    basketCalculation: basketCalc,
    dirtyBasketIV: basketCalc.basketIV,
    indexIV: basketCalc.indexIV,
    dispersionSpread: basketCalc.dispersionSpread,
    impliedCorrelation: basketCalc.impliedCorrelation,
    marketRegime,
    tradeSignal: basketCalc.signal,
    confidence: basketCalc.signalStrength,
    recommendedAllocation,
  };
}

/**
 * Generates a Vega-Neutral Basket Order Allocation Plan
 */
export function buildDispersionOrderPlan(
  indexSymbol: string,
  indexImpliedVol: number,
  components: BasketComponent[],
  indexLotSize: number = 25,
  indexVegaPerContract: number = 18.5,
  indexContracts: number = 100,
  realizedCorrelation: number = 0.50,
  hurdleThreshold: number = 0.05
): DispersionBasketOrderPlan {
  const analysis = analyzeDispersionSpread(indexSymbol, indexImpliedVol, components, realizedCorrelation, hurdleThreshold);
  const totalIndexVega = indexContracts * indexVegaPerContract;

  const isLongDispersion = analysis.arbitrageType === 'LONG_DISPERSION';
  const indexAction = isLongDispersion ? 'SELL' : 'BUY';
  const componentAction = isLongDispersion ? 'BUY' : 'SELL';

  const indexLeg: BasketLegAllocation = {
    symbol: indexSymbol,
    isIndex: true,
    action: indexAction,
    contracts: indexContracts,
    lots: Math.ceil(indexContracts / indexLotSize),
    lotSize: indexLotSize,
    perContractVega: indexVegaPerContract,
    totalLegVega: totalIndexVega * (indexAction === 'BUY' ? 1 : -1),
    totalLegDelta: 0,
    estimatedMarginRequired: indexContracts * 1250,
  };

  const normWeights = normalizeWeights(components.map((c) => c.weight));
  const componentLegs: BasketLegAllocation[] = [];
  let totalComponentVega = 0;
  let totalEstimatedCapital = indexLeg.estimatedMarginRequired;

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const w = normWeights[i];
    const targetLegVega = totalIndexVega * w;
    const rawContracts = targetLegVega / Math.max(0.01, comp.vega);
    const lots = Math.max(1, Math.round(rawContracts / comp.lotSize));
    const contracts = lots * comp.lotSize;
    const actualLegVega = contracts * comp.vega * (componentAction === 'BUY' ? 1 : -1);

    const legMargin = contracts * (comp.spotPrice * 0.05);
    totalEstimatedCapital += legMargin;
    totalComponentVega += actualLegVega;

    componentLegs.push({
      symbol: comp.symbol,
      isIndex: false,
      action: componentAction,
      contracts,
      lots,
      lotSize: comp.lotSize,
      perContractVega: comp.vega,
      totalLegVega: Number(actualLegVega.toFixed(2)),
      totalLegDelta: 0,
      estimatedMarginRequired: Number(legMargin.toFixed(2)),
    });
  }

  const netPortfolioVega = Number((indexLeg.totalLegVega + totalComponentVega).toFixed(2));

  return {
    id: `disp-plan-${Date.now()}`,
    indexSymbol,
    arbitrageType: analysis.arbitrageType,
    indexLeg,
    componentLegs,
    netPortfolioVega,
    netPortfolioDelta: 0,
    targetImpliedCorrelation: analysis.impliedCorrelation,
    currentRealizedCorrelation: realizedCorrelation,
    totalEstimatedCapital: Number(totalEstimatedCapital.toFixed(2)),
  };
}

// ==========================================
// 4. GAMMA SCALPING REBALANCER SOLVERS
// ==========================================

/**
 * Gamma Scalping Dynamic Delta Band Rebalancing Trigger Solver
 */
export function evaluateGammaScalpTrigger(
  underlyingPrice: number,
  basePrice: number,
  netDelta: number,
  deltaThreshold: number = 25.0,
  portfolioGamma: number = 1.5,
  thetaDailyDecay: number = 450.0,
  lotSize: number = 25
): GammaScalpTrigger {
  let action: GammaScalpAction = 'HOLD_WITHIN_BAND';
  let rebalanceContracts = 0;

  if (netDelta > deltaThreshold) {
    action = 'REBALANCE_SELL_UNDERLYING';
    const lots = Math.max(1, Math.round(netDelta / lotSize));
    rebalanceContracts = lots * lotSize;
  } else if (netDelta < -deltaThreshold) {
    action = 'REBALANCE_BUY_UNDERLYING';
    const lots = Math.max(1, Math.round(Math.abs(netDelta) / lotSize));
    rebalanceContracts = lots * lotSize;
  } else {
    action = 'HOLD_WITHIN_BAND';
    rebalanceContracts = 0;
  }

  const deltaS = underlyingPrice - basePrice;
  const estimatedScalpPnL = Number((0.5 * portfolioGamma * (deltaS * deltaS)).toFixed(2));
  const thetaDecayCost = Number((thetaDailyDecay * (1 / 24)).toFixed(2));
  const netScalpYield = Number((estimatedScalpPnL - thetaDecayCost).toFixed(2));

  return {
    timestamp: Date.now(),
    underlyingPrice,
    netDelta: Number(netDelta.toFixed(2)),
    deltaThreshold,
    action,
    rebalanceContracts,
    portfolioGamma,
    estimatedScalpPnL,
    thetaDecayCost,
    netScalpYield,
  };
}

/**
 * Gamma Scalping Dynamic Rebalancer Solver
 * Calculates delta-neutral rebalancing orders when underlying spot price breaches preset rebalance bands (+-0.5% or +-1.0%).
 * Evaluates discrete gamma scalping profit, market slippage, and Indian statutory tax drag.
 */
export function solveGammaScalpingRebalance(
  state: GammaScalpingState,
  config: GammaScalpingConfig
): GammaScalpingRebalanceResult {
  const { anchorSpotPrice, currentSpotPrice, currentNetDelta, currentNetGamma } = state;
  const targetDelta = config.targetDelta ?? 0.0;
  const bandThresholdPct = Math.abs(config.bandThresholdPct); // e.g. 0.005 (+-0.5%) or 0.01 (+-1.0%)
  const lotSize = Math.max(1, config.lotSize);
  const slippageBps = config.slippageBps ?? 2;

  const priceChange = Number((currentSpotPrice - anchorSpotPrice).toFixed(2));
  const priceBreachPct = anchorSpotPrice > 0 ? (currentSpotPrice - anchorSpotPrice) / anchorSpotPrice : 0;
  const absBreachPct = Math.abs(priceBreachPct);

  const isUpperTriggered = priceBreachPct >= bandThresholdPct;
  const isLowerTriggered = priceBreachPct <= -bandThresholdPct;
  const rebalanceTriggered = isUpperTriggered || isLowerTriggered;

  if (!rebalanceTriggered) {
    const defaultOrder: GammaScalpingOrder = {
      side: 'NONE',
      instrument: config.instrumentType,
      symbol: config.symbol,
      quantity: 0,
      lots: 0,
      executionPrice: currentSpotPrice,
      notionalValue: 0,
      estimatedSlippage: 0,
      statutoryCharges: 0,
    };

    return {
      rebalanceTriggered: false,
      status: 'WITHIN_BANDS',
      anchorSpotPrice,
      currentSpotPrice,
      priceChange,
      priceBreachPct: Number(priceBreachPct.toFixed(6)),
      thresholdPct: bandThresholdPct,
      netDeltaBefore: currentNetDelta,
      deltaDrift: Number((currentNetGamma * priceChange).toFixed(2)),
      orderRequired: defaultOrder,
      executedDelta: 0,
      netDeltaAfter: currentNetDelta,
      grossScalpProfit: 0,
      totalFrictions: 0,
      netScalpProfit: 0,
      newAnchorSpotPrice: anchorSpotPrice,
      message: `Spot price ${currentSpotPrice} is within +/-${(bandThresholdPct * 100).toFixed(2)}% band (${(absBreachPct * 100).toFixed(2)}% moved). No rebalancing required.`,
    };
  }

  const status = isUpperTriggered ? 'TRIGGERED_UPPER' : 'TRIGGERED_LOWER';
  const deltaDrift = Number((currentNetGamma * priceChange).toFixed(2));
  const desiredHedgeDelta = targetDelta - currentNetDelta;

  const orderSide: 'BUY' | 'SELL' = desiredHedgeDelta > 0 ? 'BUY' : 'SELL';
  const rawUnits = Math.abs(desiredHedgeDelta);
  const roundedLots = Math.max(1, Math.round(rawUnits / lotSize));
  const orderQuantity = roundedLots * lotSize;

  const executedDelta = orderSide === 'BUY' ? orderQuantity : -orderQuantity;
  const netDeltaAfter = Number((currentNetDelta + executedDelta).toFixed(2));

  const notionalValue = Number((orderQuantity * currentSpotPrice).toFixed(2));
  const estimatedSlippage = Number((notionalValue * (slippageBps / 10000)).toFixed(2));

  const statutoryChargesCalc = calculateStatutoryCharges(
    orderSide,
    'MIS',
    currentSpotPrice,
    orderQuantity
  );
  const statutoryCharges = statutoryChargesCalc.totalCharges;

  const grossScalpProfit = Number((0.5 * Math.abs(currentNetGamma) * Math.pow(priceChange, 2)).toFixed(2));
  const totalFrictions = Number((statutoryCharges + estimatedSlippage).toFixed(2));
  const netScalpProfit = Number((grossScalpProfit - totalFrictions).toFixed(2));

  const orderRequired: GammaScalpingOrder = {
    side: orderSide,
    instrument: config.instrumentType,
    symbol: config.symbol,
    quantity: orderQuantity,
    lots: roundedLots,
    executionPrice: currentSpotPrice,
    notionalValue,
    estimatedSlippage,
    statutoryCharges,
  };

  const breachPercentStr = (priceBreachPct * 100).toFixed(2);
  const message = `REBALANCE TRIGGERED (${status}): Spot moved ${breachPercentStr}% (Threshold: +/-${(bandThresholdPct * 100).toFixed(1)}%). Rebalance order: ${orderSide} ${roundedLots} lots (${orderQuantity} units) of ${config.symbol} ${config.instrumentType} @ ₹${currentSpotPrice}. Gross Scalp P&L: ₹${grossScalpProfit}, Net Scalp P&L after ₹${totalFrictions} frictions: ₹${netScalpProfit}.`;

  return {
    rebalanceTriggered: true,
    status,
    anchorSpotPrice,
    currentSpotPrice,
    priceChange,
    priceBreachPct: Number(priceBreachPct.toFixed(6)),
    thresholdPct: bandThresholdPct,
    netDeltaBefore: currentNetDelta,
    deltaDrift,
    orderRequired,
    executedDelta,
    netDeltaAfter,
    grossScalpProfit,
    totalFrictions,
    netScalpProfit,
    newAnchorSpotPrice: currentSpotPrice,
    message,
  };
}

// ==========================================
// 5. MULTI-EXPIRY SKEW HEDGING
// ==========================================

/**
 * Multi-Expiry Term Structure & 25-Delta Skew Hedging Engine
 */
export function calculateTermStructureSkew(
  symbol: string,
  nearExpiry: TermStructureSkewPoint,
  farExpiry: TermStructureSkewPoint,
  nearVega: number = 15.0,
  farVega: number = 25.0
): MultiExpirySkewHedgePlan {
  const dDTE = Math.max(1, farExpiry.daysToExpiry - nearExpiry.daysToExpiry);
  const dIV = farExpiry.atmIV - nearExpiry.atmIV;
  const termStructureSlope = Number((dIV / dDTE).toFixed(6));

  let regime: 'CONTANGO' | 'BACKWARDATION' | 'FLAT' = 'FLAT';
  if (termStructureSlope > 0.0002) {
    regime = 'CONTANGO';
  } else if (termStructureSlope < -0.0002) {
    regime = 'BACKWARDATION';
  } else {
    regime = 'FLAT';
  }

  const calendarVegaHedgeRatio = Number((nearVega / Math.max(0.01, farVega)).toFixed(4));

  let recommendedSkewStructure: 'CALENDAR_SPREAD' | 'DIAGONAL_SKEW_REVERSAL' | 'RATIO_BACKSPREAD' | 'NEUTRAL' = 'NEUTRAL';
  if (regime === 'CONTANGO' && nearExpiry.riskReversal25 > 0.03) {
    recommendedSkewStructure = 'DIAGONAL_SKEW_REVERSAL';
  } else if (regime === 'CONTANGO') {
    recommendedSkewStructure = 'CALENDAR_SPREAD';
  } else if (regime === 'BACKWARDATION') {
    recommendedSkewStructure = 'RATIO_BACKSPREAD';
  }

  return {
    symbol,
    nearExpiry,
    farExpiry,
    termStructureSlope,
    regime,
    calendarVegaHedgeRatio,
    recommendedSkewStructure,
  };
}
