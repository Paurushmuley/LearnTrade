/**
 * TradeCraft AI - Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine
 * Type Definitions & Contracts (Sprint 21 - BRD-021)
 */

export interface BasketComponent {
  symbol: string;
  weight: number; // e.g. 0.25 (25%)
  spotPrice: number;
  impliedVol: number; // Annualized IV (e.g. 0.22 for 22%)
  realizedVol?: number;
  atmStrike: number;
  lotSize: number;
  vega: number; // Vega per contract
  delta?: number;
  gamma?: number;
}

export interface ImpliedCorrelationResult {
  impliedCorrelation: number; // Clamped to [0, 1]
  rawImpliedCorrelation: number; // Unclamped theoretical value
  isClamped: boolean;
  clampedReason?: 'SUPER_HEDGING_VIOLATION' | 'ZERO_CORRELATION_CLAMPED' | 'NONE';
  indexImpliedVol: number;
  weightedComponentVol: number;
  indexVariance: number;
  independentVarianceSum: number;
  crossProductVarianceSum: number;
}

export type DispersionArbitrageType = 'LONG_DISPERSION' | 'SHORT_DISPERSION' | 'NEUTRAL_NO_ARBITRAGE';
export type DispersionSignal = 'LONG_DISPERSION' | 'SHORT_DISPERSION' | 'NEUTRAL';
export type MarketRegime = 'HIGH_IMPLIED_CORRELATION' | 'LOW_IMPLIED_CORRELATION' | 'FAIR_VALUE';
export type TermStructureRegime = 'CONTANGO' | 'BACKWARDATION' | 'FLAT';
export type RebalanceTriggerStatus = 'TRIGGERED_UPPER' | 'TRIGGERED_LOWER' | 'WITHIN_BANDS';
export type HedgeInstrumentType = 'FUTURES' | 'EQUITY' | 'OPTION';

export interface DispersionSpreadAnalysis {
  indexSymbol: string;
  indexImpliedVol: number;
  weightedComponentVol: number;
  dirtyDispersionSpread: number; // Component IV - Index IV
  impliedCorrelation: number;
  realizedCorrelation: number;
  correlationSpread: number; // Implied Rho - Realized Rho
  arbitrageType: DispersionArbitrageType;
  recommendedAction: 'SELL_INDEX_BUY_COMPONENTS' | 'BUY_INDEX_SELL_COMPONENTS' | 'HOLD_NO_ACTION';
  confidenceScore: number; // 0 to 100
  hurdleThreshold: number;
  netEstimatedEdgeBps: number;
}

export interface BasketLegAllocation {
  symbol: string;
  isIndex: boolean;
  action: 'BUY' | 'SELL';
  contracts: number;
  lots: number;
  lotSize: number;
  perContractVega: number;
  totalLegVega: number;
  totalLegDelta: number;
  estimatedMarginRequired: number;
}

export interface DispersionBasketOrderPlan {
  id: string;
  indexSymbol: string;
  arbitrageType: DispersionArbitrageType;
  indexLeg: BasketLegAllocation;
  componentLegs: BasketLegAllocation[];
  netPortfolioVega: number;
  netPortfolioDelta: number;
  targetImpliedCorrelation: number;
  currentRealizedCorrelation: number;
  totalEstimatedCapital: number;
}

export type GammaScalpAction = 'HOLD_WITHIN_BAND' | 'REBALANCE_SELL_UNDERLYING' | 'REBALANCE_BUY_UNDERLYING';

export interface GammaScalpTrigger {
  timestamp: number;
  underlyingPrice: number;
  netDelta: number;
  deltaThreshold: number;
  action: GammaScalpAction;
  rebalanceContracts: number;
  portfolioGamma: number;
  estimatedScalpPnL: number;
  thetaDecayCost: number;
  netScalpYield: number;
}

export interface TermStructureSkewPoint {
  expiryDate: string;
  daysToExpiry: number;
  atmIV: number;
  put25DeltaIV: number;
  call25DeltaIV: number;
  riskReversal25: number; // Put IV - Call IV
  butterfly25: number; // (Put IV + Call IV)/2 - ATM IV
  skewSlope: number; // dIV / dK approx
}

export interface MultiExpirySkewHedgePlan {
  symbol: string;
  nearExpiry: TermStructureSkewPoint;
  farExpiry: TermStructureSkewPoint;
  termStructureSlope: number; // (Far IV - Near IV) / (Far DTE - Near DTE)
  regime: 'CONTANGO' | 'BACKWARDATION' | 'FLAT';
  calendarVegaHedgeRatio: number; // Vega Near / Vega Far
  recommendedSkewStructure: 'CALENDAR_SPREAD' | 'DIAGONAL_SKEW_REVERSAL' | 'RATIO_BACKSPREAD' | 'NEUTRAL';
}

/**
 * Constituent Option Quote for Dirty Dispersion Scanner
 */
export interface ConstituentOptionQuote {
  symbol: string;
  companyName?: string;
  spotPrice: number;
  strike: number;
  expiry: string;
  callIV: number;       // In decimal, e.g. 0.22 for 22%
  putIV: number;        // In decimal, e.g. 0.24 for 24%
  atmIV: number;        // Composite or ATM IV
  historicalVol: number;// 20d/30d Realized Volatility
  lotSize: number;      // Exchange lot size (e.g. 250 for RELIANCE)
  indexWeight: number;  // Raw weight in Nifty (e.g. 0.095 for 9.5%)
  normalizedWeight?: number; // Weight within the dirty basket (sum = 1.0)
  callPrice?: number;
  putPrice?: number;
  straddlePrice?: number;
  bidAskSpread?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
}

/**
 * Index Option Quote for NIFTY 50
 */
export interface IndexOptionQuote {
  symbol: string;
  spotPrice: number;
  strike: number;
  expiry: string;
  atmIV: number;
  callIV: number;
  putIV: number;
  historicalVol: number;
  lotSize: number;
  callPrice?: number;
  putPrice?: number;
  straddlePrice?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
}

/**
 * Basket IV vs Index IV analytical computation output
 */
export interface BasketIVCalculationResult {
  indexIV: number;
  basketIV: number;                   // Linear weighted basket IV: sum(w_i * sigma_i)
  varianceBasketIV: number;           // Quadratic basket IV: sqrt(sum(w_i^2 * sigma_i^2))
  dispersionSpread: number;           // basketIV - indexIV
  dispersionSpreadBps: number;        // spread in basis points
  weightedConstituentVariance: number;// sum(w_i^2 * sigma_i^2)
  impliedCorrelation: number;         // Bounded in [0, 1]
  rawImpliedCorrelation: number;      // Unclamped mathematical correlation
  realizedCorrelation: number;        // Historical correlation benchmark
  correlationSpread: number;          // impliedCorrelation - realizedCorrelation
  signal: DispersionSignal;
  signalStrength: number;             // Confidence score 0 to 100
  rationale: string;
}

/**
 * Constituent breakdown in dirty dispersion basket
 */
export interface DirtyConstituentAnalysis {
  symbol: string;
  companyName: string;
  weight: number;                     // Raw index weight
  normalizedWeight: number;           // Normalized weight in dirty basket
  spotPrice: number;
  atmIV: number;
  historicalVol: number;
  volatilityPremium: number;          // atmIV - historicalVol
  varianceContribution: number;       // normalizedWeight^2 * atmIV^2
  varianceContributionPct: number;    // % contribution to dirty basket variance
  strikeSkew: number;                 // putIV - callIV
  lotSize: number;
  straddlePrice: number;
  vegaPerLot: number;
  recommendedLegs: {
    action: 'BUY' | 'SELL' | 'HOLD';
    side: 'BUY' | 'SELL';
    lots: number;
    contracts: number;
    targetVega: number;
    estimatedPremium: number;
  };
}

/**
 * Recommended multi-leg allocation for dispersion execution
 */
export interface DispersionPortfolioAllocation {
  indexLots: number;
  indexSide: 'BUY' | 'SELL';
  indexVega: number;
  indexGrossPremium: number;
  constituentLegs: {
    symbol: string;
    side: 'BUY' | 'SELL';
    lots: number;
    contracts: number;
    weight: number;
    straddlePrice: number;
    allocatedCapital: number;
    legVega: number;
  }[];
  netPortfolioVega: number;
  netPortfolioDelta: number;
  totalEstimatedCapital: number;
  totalGrossPremium: number;
  statutoryCharges: number;
  netCapitalRequired: number;
  breakevenCorrelationMove: number;
}

/**
 * Complete Dirty Dispersion Scan Result
 */
export interface DirtyDispersionScanResult {
  timestamp: string;
  indexSymbol: string;
  indexQuote: IndexOptionQuote;
  constituents: DirtyConstituentAnalysis[];
  basketCalculation: BasketIVCalculationResult;
  dirtyBasketIV: number;
  indexIV: number;
  dispersionSpread: number;
  impliedCorrelation: number;
  marketRegime: MarketRegime;
  tradeSignal: DispersionSignal;
  confidence: number;
  recommendedAllocation: DispersionPortfolioAllocation;
}

/**
 * Gamma Scalping Rebalancer Configuration
 */
export interface GammaScalpingConfig {
  symbol: string;
  instrumentType: HedgeInstrumentType;
  bandThresholdPct: number;           // e.g. 0.005 (+-0.5%) or 0.01 (+-1.0%)
  lotSize: number;                    // e.g. 25 for NIFTY, 250 for RELIANCE
  targetDelta?: number;               // Default 0.0 (Delta neutral)
  slippageBps?: number;               // Default 2 bps (0.0002)
  brokeragePerOrder?: number;         // Default ₹20
}

/**
 * Gamma Scalping Current State
 */
export interface GammaScalpingState {
  anchorSpotPrice: number;            // Spot price at last rebalance / entry
  currentSpotPrice: number;           // Current live spot price
  currentNetDelta: number;            // Net delta in units
  currentNetGamma: number;            // Net gamma in units per pt move
  currentNetVega?: number;
  currentNetTheta?: number;
}

/**
 * Gamma Scalping Order
 */
export interface GammaScalpingOrder {
  side: 'BUY' | 'SELL' | 'NONE';
  instrument: HedgeInstrumentType;
  symbol: string;
  quantity: number;
  lots: number;
  executionPrice: number;
  notionalValue: number;
  estimatedSlippage: number;
  statutoryCharges: number;
}

/**
 * Result of Gamma Scalping Rebalancer evaluation
 */
export interface GammaScalpingRebalanceResult {
  rebalanceTriggered: boolean;
  status: RebalanceTriggerStatus;
  anchorSpotPrice: number;
  currentSpotPrice: number;
  priceChange: number;                // currentSpot - anchorSpot
  priceBreachPct: number;             // (currentSpot - anchorSpot) / anchorSpot
  thresholdPct: number;
  netDeltaBefore: number;
  deltaDrift: number;                 // Expected delta change due to gamma
  orderRequired: GammaScalpingOrder;
  executedDelta: number;              // Sign-adjusted delta delivered by order
  netDeltaAfter: number;              // Residual delta post-hedge
  grossScalpProfit: number;           // 0.5 * Gamma * (dS)^2
  totalFrictions: number;             // Statutory charges + slippage
  netScalpProfit: number;             // grossScalpProfit - totalFrictions
  newAnchorSpotPrice: number;         // Updated anchor price
  message: string;
}
