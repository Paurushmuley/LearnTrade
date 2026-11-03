// TradeCraft AI — Portfolio Greeks Aggregator & Delta-Neutral Hedger Types
// Full types supporting multi-asset aggregation, Taylor expansion curvature, and automated hedging

export type HedgeInstrumentType = 'FUTURES' | 'ATM_CALL' | 'ATM_PUT';
export type DeltaRiskStatus = 'NEUTRAL' | 'MODERATE_LONG' | 'MODERATE_SHORT' | 'CRITICAL_LONG' | 'CRITICAL_SHORT' | 'EXTREME_LONG' | 'EXTREME_SHORT';
export type GammaRiskStatus = 'SAFE' | 'ELEVATED' | 'HAZARDOUS' | 'CRITICAL_SHORT_GAMMA';

export interface UnitGreeks {
  delta: number;
  gamma: number;
  theta: number; // Daily decay in ₹
  vega: number;  // ₹ change per 1% IV shift
}

export interface PortfolioPositionGreeks {
  id: string;
  symbol: string;
  assetType: 'EQUITY' | 'FUTURES' | 'OPTION';
  side: 'BUY' | 'SELL';
  quantity: number; // in shares/units
  entryPrice: number;
  currentPrice: number;
  strikePrice?: number;
  strike?: number;
  optionType?: 'CE' | 'PE';
  expiryDate?: string;
  greeks: UnitGreeks;
  lotSize: number;
}

export interface PortfolioGreekSummary {
  spotPrice: number;
  netDelta: number;
  netGamma: number;
  netTheta: number; // Daily portfolio decay (₹)
  netVega: number;  // Portfolio ₹ change per 1% IV shift
  notionalDeltaInr: number; // Rupee Delta: netDelta * spotPrice
  rebalanceBand: number;    // Delta tolerance threshold (e.g. 25 delta)
  deltaRiskStatus: DeltaRiskStatus;
  gammaRiskStatus: GammaRiskStatus;
  positionsCount: number;
  positionCount?: number;
  isRebalanceRequired: boolean;
  underlyingSpot?: number;
  underlyingSymbol?: string;
  totalNotional?: number;
}

export interface HedgeRecommendation {
  instrumentType: HedgeInstrumentType;
  recommendedInstrument?: HedgeInstrumentType;
  symbol: string;
  side: 'BUY' | 'SELL';
  strike?: number;
  lotSize: number;
  recommendedLots: number;
  recommendedQty: number; // in shares
  estimatedPrice: number;
  estimatedMargin: number;
  projectedDeltaChange: number;
  residualDelta: number;
  rationale: string;
}

export interface PriceShockScenario {
  shockPercent: number; // e.g. -2.0, -1.0, 0, 1.0, 2.0
  projectedUnderlying: number;
  projectedDelta: number;
  unhedgedExpectedPnL: number;
  hedgedExpectedPnL: number;
  convexityRisk: number; // Curvature acceleration PnL difference
  severity: 'SAFE' | 'MODERATE' | 'CRITICAL';
}

export interface CurvaturePayoffPoint {
  underlyingPrice?: number;
  percentShift: number; // e.g. -4.0 to +4.0
  unhedgedPnL: number;
  hedgedPnL: number;
}

export type CurvatureCurvePoint = CurvaturePayoffPoint;

export interface AutoRebalanceConfig {
  enabled: boolean;
  toleranceDelta: number;
  preferredInstrument: HedgeInstrumentType;
  maxHedgeLots: number;
  lastRebalancedAt: string | null;
}

export interface HedgeExecutionRecord {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  quantity: number;
  executionPrice: number;
  preDelta: number;
  postDelta: number;
  triggerReason: string;
  status: 'FILLED' | 'CANCELLED';
}

// Aliases for spec nomenclature
export type HedgerAssetClass = 'EQUITY_CASH' | 'INDEX_FUTURES' | 'OPTION_CE' | 'OPTION_PE';
export type PositionGreeks = PortfolioPositionGreeks;
export type PortfolioGreeksSummary = PortfolioGreekSummary;
export type GammaShockScenario = PriceShockScenario;
export type HedgeOrderRecommendation = HedgeRecommendation;
