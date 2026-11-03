/**
 * TradeCraft AI - Options Payoff Optimizer & Implied Volatility Surface Calibrator
 * Types & Data Contracts (Sprint 14 - BRD-014)
 */

export interface SABRParameters {
  alpha: number; // Initial volatility level (ATM Black-Scholes vol when beta=1.0)
  beta: number;  // CEV exponent (1.0 for equity indices, 0.5 for CIR/CEV)
  rho: number;   // Correlation between asset and volatility (-1 to 1)
  nu: number;    // Volatility of volatility (vol-vol)
}

export interface SVIParameters {
  a: number;     // Vertical variance level
  b: number;     // Wing angle / slope
  rho: number;   // Asymmetry / skew
  m: number;     // Horizontal translation (ATM centering)
  sigma: number; // Curvature smoothness at vertex
}

export type MispricingStatus = 'OVERVALUED' | 'FAIR' | 'UNDERVALUED' | 'RICH' | 'CHEAP';

export interface VolStrikeQuote {
  strike: number;
  moneyness: number; // K / F
  logMoneyness: number; // ln(K / F)
  marketIV: number;
  sabrIV: number;
  sviIV: number;
  modelIV?: number;
  mispricingDiff: number; // Market IV - Calibrated IV in %
  mispricingStatus: MispricingStatus;
  rating?: 'RICH' | 'CHEAP' | 'FAIR';
  pricingEdge?: number; // Market Price - Model Fair Price
  callPrice: number;
  putPrice: number;
  openInterest?: number;
  volume?: number;
}

// Interoperability alias matching BRD Section 5.1
export type VolatilityPoint = VolStrikeQuote;

export interface CalibrationMetrics {
  rmse: number;
  rSquared: number;
  maxAbsoluteError: number;
  isArbitrageFree: boolean;
  reason?: string;
}

export interface CalibrationFitResult {
  modelType: 'SABR' | 'SVI';
  sabrParams?: SABRParameters;
  sviParams?: SVIParameters;
  rmse: number;
  rSquared: number;
  maxAbsoluteError: number;
  isArbitrageFree: boolean;
  calibratedAt: string;
}

export interface CalibrationResult extends CalibrationMetrics {
  modelType: 'SABR' | 'SVI';
  sabrParams?: SABRParameters;
  sviParams?: SVIParameters;
  points: VolStrikeQuote[];
  calibratedAt: number;
}

export interface ExpiryVolSurface {
  expiryDays: number;
  expiryDate: string;
  forwardPrice: number;
  atmIV: number;
  sabrParams: SABRParameters;
  sviParams: SVIParameters;
  strikes: VolStrikeQuote[];
  calibration?: CalibrationResult;
}

// Interoperability alias
export type SurfaceSliceData = ExpiryVolSurface;

export type MarketOutlook = 'BULLISH' | 'BEARISH' | 'NEUTRAL_RANGEBOUND' | 'HIGH_VOLATILITY';
export type OptimizationCriterion = 'MAX_POP' | 'MAX_PROFIT_RATIO' | 'MAX_THETA' | 'MIN_MARGIN' | 'MAX_VOL_EDGE';

export type StrategyTemplateType =
  | 'BULL_CALL_SPREAD'
  | 'BEAR_PUT_SPREAD'
  | 'IRON_CONDOR'
  | 'IRON_BUTTERFLY'
  | 'LONG_STRADDLE'
  | 'SHORT_STRANGLE'
  | 'JADE_LIZARD'
  | 'RATIO_CALL_SPREAD';

export interface StrategyLegSpec {
  strike: number;
  optionType: 'CE' | 'PE';
  side: 'BUY' | 'SELL';
  quantity: number;
  premium: number;
  iv: number;
  modelIV?: number;
  volEdge?: number;
}

// Interoperability alias
export type OptimizedStrategyLeg = StrategyLegSpec;

export interface StrategyPayoffPoint {
  spot: number;
  pnl: number;
  probabilityDensity?: number;
}

export type PayoffPoint = StrategyPayoffPoint;

export interface OptimizedStrategyCandidate {
  id: string;
  templateType: StrategyTemplateType;
  name: string;
  outlook: MarketOutlook;
  legs: StrategyLegSpec[];
  maxProfit: number;
  maxLoss: number;
  probabilityOfProfit: number; // 0 - 100%
  netDebitCredit: number; // Positive = Debit, Negative = Credit
  netDelta: number;
  netTheta: number;
  netVega?: number;
  netVolEdge?: number;
  marginRequired: number;
  riskRewardRatio: number;
  compositeScore: number; // 0 - 100
  statutoryCharges: number;
  breakevens: number[];
  rationale: string;
  payoffCurve?: StrategyPayoffPoint[];
}

// Interoperability alias matching BRD Section 5.1
export type OptimizedStrategyPayoff = OptimizedStrategyCandidate;

export interface OptimizerFilterParams {
  underlyingSpot: number;
  outlook: MarketOutlook;
  criterion: OptimizationCriterion;
  maxCapitalBudget: number;
  targetExpiryDays: number;
  minPoPPercent: number;
}
