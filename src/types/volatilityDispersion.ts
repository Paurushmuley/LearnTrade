/**
 * TradeCraft AI - Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine
 * Types & Data Contracts (Sprint 21)
 */

export type ExpiryTermType = 'WEEKLY_NEAR' | 'WEEKLY_NEXT' | 'MONTHLY_NEAR' | 'MONTHLY_NEXT' | 'QUARTERLY';

export type DispersionTradeType = 'LONG_DISPERSION' | 'SHORT_DISPERSION';

export type CorrelationRegime = 'RICH_CORRELATION' | 'CHEAP_CORRELATION' | 'NEUTRAL';

export type BasketPresetType = 'NIFTY_TOP5' | 'NIFTY_TOP10' | 'BANK_HEAVY' | 'EQUAL_WEIGHT';

export interface TermStructurePoint {
  id: string;
  label: string;
  expiryDate: string;
  daysToExpiry: number;
  atmIV: number; // In percentage, e.g. 13.8
  forwardPrice: number;
  slope: number; // IV slope vs previous term
  termRegime: 'CONTANGO' | 'BACKWARDATION' | 'FLAT';
  skewSteepness: number; // 25d Put IV - 25d Call IV
  openInterest: number;
  volume: number;
}

export interface SmileComparisonPoint {
  strike: number;
  moneyness: number; // Strike / Spot (e.g. 0.95 = 95%)
  deltaApprox: number; // e.g. -0.25, 0.50
  nearIV: number; // Near Month IV %
  nextIV: number; // Next Month IV %
  ivSpread: number; // nearIV - nextIV
  nearCallPrice: number;
  nearPutPrice: number;
  nextCallPrice: number;
  nextPutPrice: number;
  edge: 'CALENDAR_SPREAD' | 'SKEW_ARBITRAGE' | 'FAIR' | 'WING_RICH';
}

export interface SmileSkewMetrics {
  nearExpiryLabel: string;
  nextExpiryLabel: string;
  nearAtmIV: number;
  nextAtmIV: number;
  near25dPutIV: number;
  near25dCallIV: number;
  nearRiskReversal: number; // 25d Call IV - 25d Put IV
  nearButterfly: number; // (25d Call + 25d Put)/2 - ATM IV
  next25dPutIV: number;
  next25dCallIV: number;
  nextRiskReversal: number;
  nextButterfly: number;
  skewDifferential: number; // Near RR - Next RR
  termSlopeSpread: number; // Next ATM - Near ATM
}

export interface BasketConstituent {
  symbol: string;
  name: string;
  sector: string;
  weight: number; // e.g. 0.12 (12%)
  spotPrice: number;
  changePct: number;
  realizedVol30D: number; // e.g. 18.4%
  impliedVolATM: number; // e.g. 22.8%
  volRiskPremium: number; // IV - RV (e.g. +4.4%)
  beta: number; // e.g. 1.18
  delta: number; // Unit delta
  gamma: number; // Unit gamma
  straddlePrice: number; // ATM straddle premium
  notionalAllocation: number; // ₹ notional allocated
  status: 'RICH_IV' | 'CHEAP_IV' | 'NEUTRAL';
}

export interface DispersionRadarMetrics {
  indexSymbol: string;
  indexSpot: number;
  indexIV: number; // e.g. 13.8%
  indexRV: number; // e.g. 11.2%
  basketWeightedIV: number; // e.g. 21.6%
  basketWeightedRV: number; // e.g. 16.8%
  dispersionSpread: number; // basketWeightedIV - indexIV (e.g. +7.8%)
  impliedCorrelation: number; // e.g. 0.62 (0 to 1)
  realizedCorrelation: number; // e.g. 0.41 (0 to 1)
  correlationSpread: number; // impliedCorrelation - realizedCorrelation
  correlationRegime: CorrelationRegime;
  recommendedTrade: DispersionTradeType;
  tradeRationale: string;
  portfolioNetVega: number; // ₹ change per 1% vol shock
  portfolioNetTheta: number; // Daily decay in ₹
  portfolioNetGamma: number; // Curvature per index pt
  activeNetDelta: number; // Current delta drift
  estDailyCarry: number; // Net cash flow / carry in ₹
  estimatedSharpeRatio: number;
}

export interface GammaScalpAlert {
  id: string;
  timestamp: string;
  urgency: 'CRITICAL' | 'WARNING' | 'INFO';
  triggerReason: string;
  netDelta: number;
  driftThreshold: number;
  hedgeAction: 'SELL_FUTURES' | 'BUY_FUTURES' | 'ROLL_STRIKE' | 'TRIM_BASKET';
  recommendedQty: number; // Shares / Contracts
  spotAtTrigger: number;
  projectedScalpPnl: number;
  status: 'PENDING' | 'EXECUTED' | 'DISMISSED';
}

export interface ExecutedRebalanceLog {
  id: string;
  timestamp: string;
  instrument: string;
  action: 'SELL_FUTURES' | 'BUY_FUTURES' | 'AUTO_DELTA_HEDGE';
  quantity: number;
  executionPrice: number;
  lockedScalpPnl: number;
  resultingNetDelta: number;
}

export interface VolatilityDispersionState {
  selectedIndex: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY';
  selectedBasketPreset: BasketPresetType;
  tradeType: DispersionTradeType;
  notionalCapital: number;
  rebalanceThresholdDelta: number;
  autoRebalance: boolean;
  cumulativeScalpPnl: number;
  lastHedgeTimestamp: string | null;
}
