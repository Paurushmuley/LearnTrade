/**
 * TradeCraft AI - High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk
 * Type Definitions & Risk Engine Contracts (Sprint 22 - BRD-022)
 *
 * Full TypeScript interfaces for:
 * 1. 16-Scenario SPAN Risk Arrays (-3sigma to +3sigma across 7 price nodes x +-4% IV + 2 extreme wings)
 * 2. Multi-Leg Spread Margin Offsets (Calendar spreads, Bull/Bear spreads, Iron Condors)
 * 3. Extreme Value Theory (EVT) Expected Shortfall (CVaR 99%) via POT GPD
 * 4. SEBI Regulatory Circuit Breakers & MWPL Ban Limits
 * 5. Pre-Trade Gatekeeper Validator & Order Interception
 */

export type InstrumentType = 'EQUITY' | 'FUTURES' | 'OPTION' | 'CE' | 'PE';
export type OrderSide = 'BUY' | 'SELL';
export type OptionType = 'CE' | 'PE';

// ============================================================================
// 1. POSITION LEGS & PORTFOLIO DEFINITIONS
// ============================================================================

export interface PositionLeg {
  id: string;
  symbol: string;
  instrumentType: InstrumentType;
  side: OrderSide;
  quantity: number; // positive contract count (e.g. 50 for 1 lot NIFTY)
  strikePrice?: number;
  expiryDate: string; // ISO date YYYY-MM-DD
  daysToExpiry: number;
  entryPrice: number;
  currentPrice: number;
  underlyingPrice: number;
  impliedVol: number; // Annualized IV (e.g. 0.15 for 15%)
  lotSize: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
}

export interface RiskPosition {
  id: string;
  symbol: string;
  instrumentType: InstrumentType;
  optionType?: OptionType;
  strike?: number;
  daysToExpiry?: number;
  quantity: number; // Positive = Long, Negative = Short
  entryPrice: number;
  currentPrice: number;
  currentIV?: number; // e.g. 0.15 for 15% IV
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  lotSize?: number;
}

// ============================================================================
// 2. 16-SCENARIO SPAN RISK ARRAYS
// ============================================================================

export type SpanVolShiftDirection = 'UP' | 'DOWN' | 'UNCHANGED';

export interface SpanScenario {
  id: number; // 1 to 16
  name: string;
  priceShiftFraction: number; // Fraction of price scan range (-1.0 to +1.0, or ±2.0 for extreme)
  priceShiftSigma: number; // Equivalent sigma move (-3 to +3, or ±6 for extreme)
  volShift: number; // Volatility shift (e.g. -0.04, 0, +0.04)
  lossMultiplier: number; // 1.0 for 1-14, 0.35 for 15-16
  scenarioLoss: number; // Loss under this scenario across the portfolio (positive means loss)
  description: string;
}

export interface SpanScenarioDefinition {
  scenarioId: number; // 1 to 16
  name: string;
  priceShiftMultiplier: number; // Node relative to 1 full scan range (-1.0 to +1.0, or ±2.0 for wings)
  sigmaMultiple: number; // e.g. -3, -2, -1, 0, +1, +2, +3, ±6
  volShiftPct: number; // e.g. +0.04 (+4%), -0.04 (-4%), or 0.0
  isExtremeWing: boolean; // True for Scenarios 15 & 16
  lossWeight: number; // Standard 1.0; 0.35 (35%) fraction for extreme wings per SEBI/SPAN specification
  description: string;
}

export interface PositionScenarioPnL {
  positionId: string;
  symbol: string;
  revaluedPrice: number;
  pnl: number;
}

export interface SpanScenarioResult {
  scenarioId: number;
  name: string;
  priceShiftPct: number;
  volShiftPct: number;
  stressedSpotPrice: number;
  stressedIV: number;
  portfolioPnL: number;
  weightedLoss: number; // If PnL < 0, |PnL| * lossWeight, else 0
  isWorstLoss: boolean;
  positionPnLs: PositionScenarioPnL[];
}

export interface SpanMarginResult {
  scenarios: SpanScenario[];
  worstScenarioId: number;
  worstScenarioName: string;
  worstScenarioLoss: number;
  shortOptionMinimum: number;
  grossSpanMargin: number;
  spreadOffsetBenefit: number;
  calendarSpreadCharge: number;
  netSpanMargin: number;
  exposureMargin: number;
  totalMarginRequired: number;
  marginUtilizationPct: number;
  availableCollateral: number;
  freeMargin: number;
  isMarginDeficit: boolean;
}

export interface SpanScanningRiskResult {
  underlyingSymbol: string;
  spotPrice: number;
  priceScanRangePct: number; // Standard 3-sigma range (e.g., 0.07 = 7%)
  volScanRangePct: number; // Standard SEBI IV shift (e.g., 0.04 = 4%)
  scenarios: SpanScenarioResult[];
  worstScenarioId: number;
  worstScenarioName: string;
  worstLoss: number;
  spanScanningMargin: number; // Maximum loss across scenarios (or worst weighted loss)
  extremeLossScenarioId?: number;
  extremeScenarioLoss?: number;
  netPortfolioDelta: number;
  netPortfolioGamma: number;
  netPortfolioVega: number;
  evaluatedAt: string;
}

// ============================================================================
// 3. MULTI-LEG SPREAD MARGIN OFFSET MODELS
// ============================================================================

export type SpreadStrategyType =
  | 'BULL_CALL_SPREAD'
  | 'BEAR_CALL_SPREAD'
  | 'BULL_PUT_SPREAD'
  | 'BEAR_PUT_SPREAD'
  | 'IRON_CONDOR'
  | 'IRON_BUTTERFLY'
  | 'CALENDAR_SPREAD'
  | 'BOX_SPREAD'
  | 'RATIO_SPREAD'
  | 'STRADDLE_STRANGLE_HEDGE';

export interface RecognizedSpreadLeg {
  positionId: string;
  symbol: string;
  optionType?: OptionType;
  strike?: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  premium: number;
  daysToExpiry: number;
}

export interface RecognizedSpread {
  id: string;
  name: string;
  type: SpreadStrategyType;
  legs: RecognizedSpreadLeg[];
  pairedQuantity: number;
  nakedMarginRequired: number; // Raw unhedged margin requirement
  spreadMarginRequired: number; // Net capped margin with SEBI hedge offset
  marginBenefit: number; // Relief granted: nakedMarginRequired - spreadMarginRequired
  offsetDiscountPct: number; // Margin reduction % (typically 70% to 90%)
  maxRisk: number; // Maximum downside of the hedged structure
  maxReward: number; // Maximum upside of the hedged structure
  description: string;
}

export interface SpreadMarginAnalysis {
  totalUnhedgedMargin: number;
  totalHedgedMargin: number;
  totalMarginOffsetBenefit: number;
  marginSavingsPct: number;
  marginEfficiencyRatio: number; // totalUnhedgedMargin / totalHedgedMargin
  recognizedSpreads: RecognizedSpread[];
  residualUnhedgedPositions: RiskPosition[];
  analyzedAt: string;
}

export interface SpreadOffsetAnalysis {
  hasCalendarSpread: boolean;
  hasCreditSpread: boolean;
  calendarSpreadCount: number;
  creditSpreadCount: number;
  totalMarginReduction: number;
  reductionPercentage: number;
  details: string[];
}

// ============================================================================
// 4. EXTREME VALUE THEORY (EVT) EXPECTED SHORTFALL (CVaR 99%)
// ============================================================================

export type TailFatnessDomain = 'FRECHET_HEAVY' | 'GUMBEL_LIGHT' | 'WEIBULL_SHORT';

export type TailRiskClassification =
  | 'THIN_TAIL' // xi <= 0 (Gumbel / Weibull bounded tails)
  | 'MODERATE_HEAVY' // 0 < xi <= 0.2 (Sub-exponential / moderate tail)
  | 'FAT_TAILED' // 0.2 < xi <= 0.5 (Fréchet / Pareto fat tail typical for Indian indices)
  | 'SUPER_CRITICAL'; // xi > 0.5 (Infinite variance / extreme crisis regime)

export interface EVTParameters {
  threshold: number; // u: Loss threshold above which excesses are modeled
  thresholdPercentile: number; // e.g. 0.95 or 0.975
  totalSamples: number; // N: Total sample size of historical loss returns
  exceedanceCount: number; // Nu: Number of observations exceeding threshold u
  exceedanceRatio: number; // Nu / N
  shapeXi: number; // ξ: GPD Tail Index / Shape parameter
  scaleBeta: number; // β: GPD Scale parameter (β > 0)
  logLikelihood: number;
  standardErrorXi: number;
  standardErrorBeta: number;
}

export interface EvtRiskMetrics {
  thresholdU: number; // Loss threshold u
  sampleSize: number; // Total loss sample size N
  exceedancesCount: number; // Count of losses > u (N_u)
  xi: number; // GPD shape parameter (xi > 0 indicates fat tail)
  beta: number; // GPD scale parameter (beta > 0)
  tailFatness: TailFatnessDomain;
  fatTailWarning: boolean;
  evtVaR99: number; // EVT Value at Risk at 99.0%
  evtVaR999: number; // EVT Value at Risk at 99.9%
  evtCVaR99: number; // EVT Expected Shortfall at 99.0%
  evtCVaR999: number; // EVT Expected Shortfall at 99.9%
  normalVaR99: number; // Normal distribution VaR at 99.0%
  normalVaR999: number; // Normal distribution VaR at 99.9%
  normalCVaR99: number; // Normal distribution Expected Shortfall at 99.0%
  normalCVaR999: number; // Normal distribution Expected Shortfall at 99.9%
  tailRiskRatio: number; // evtCVaR99 / normalCVaR99
}

export interface EVTRiskMetrics {
  confidenceLevel: number; // e.g. 0.99 (99%)
  timeHorizonDays: number; // e.g. 1-day or 10-day
  portfolioCapital: number;
  parametricVaR: number; // Gaussian normal distribution benchmark VaR (₹)
  historicalVaR: number; // Empirical non-parametric quantile VaR (₹)
  evtVaR: number; // Peak-Over-Threshold GPD VaR (₹)
  evtExpectedShortfall: number; // EVT CVaR 99% - Expected Shortfall beyond VaR (₹)
  shortfallToVaRRatio: number; // CVaR / VaR (> 1.0, illustrates tail fatness)
  tailFatnessIndex: number; // xi shape parameter
  tailClassification: TailRiskClassification;
  ruinProbabilityPct: number; // Analytical probability of suffering catastrophic loss >= totalCapital
  recommendedTailBufferCapital: number; // Prudential safety capital buffer (₹)
  stressLoss1in1000Days: number; // 99.9% 1-in-4 year extreme tail event loss
  fittedParameters: EVTParameters;
  calculatedAt: string;
}

// ============================================================================
// 5. SEBI CIRCUIT BREAKERS & MARKET WIDE POSITION LIMITS (MWPL)
// ============================================================================

export type SebiCircuitBreakerLevel =
  | 'NONE'
  | 'LEVEL_1_10PCT'
  | 'LEVEL_2_15PCT'
  | 'LEVEL_3_20PCT';

export type SebiTradingSessionWindow =
  | 'PRE_1_00_PM'
  | 'BETWEEN_1_00_PM_AND_2_30_PM'
  | 'POST_2_30_PM';

export interface SebiCircuitBreakerStatus {
  isTriggered: boolean;
  level: SebiCircuitBreakerLevel;
  indexMovementPct: number;
  sessionWindow: SebiTradingSessionWindow;
  marketHaltMinutes: number;
  preOpenSessionMinutes: number;
  tradingResumesAt?: string;
  remainderOfDayHalted: boolean;
  ruleCitation: string;
  operationalGuidelines: string;
}

export interface StockCircuitBand {
  symbol: string;
  ltp: number;
  basePrice: number;
  lowerBand: number;
  upperBand: number;
  bandPct: number; // 2, 5, 10, or 20%
  isFOSecurity: boolean; // F&O stocks don't have hard freeze; dynamic bands flex after 15 min cooling
  isBreached: boolean;
  breachType?: 'UPPER_CIRCUIT' | 'LOWER_CIRCUIT';
  flexedBandPct?: number; // Next operating band after flexing (e.g. from 10% to 15%)
}

export interface MwplStatus {
  symbol: string;
  totalMarketOI: number; // Total open interest across all strikes and expiries
  mwplLimit: number; // Market Wide Position Limit mandated by SEBI / NSE
  utilizationPct: number; // (totalMarketOI / mwplLimit) * 100
  isInBanPeriod: boolean; // True when utilizationPct >= 95%, remains in ban until drops < 80%
  isWarningZone: boolean; // True when utilizationPct >= 90%
  allowedActions: 'ALL' | 'SQUARE_OFF_ONLY';
  penaltyPerFreshLot: number; // Penalty applicable if a broker allows fresh positions in ban (₹1,00,000)
}

// ============================================================================
// 6. PRE-TRADE GATEKEEPER VALIDATION & ORDER CHECKS
// ============================================================================

export type PreTradeValidationRule =
  | 'FREE_MARGIN_ADEQUACY'
  | 'SINGLE_ORDER_QUANTITY_LIMIT'
  | 'SINGLE_ORDER_VALUE_LIMIT'
  | 'PORTFOLIO_MAX_DRAWDOWN'
  | 'SEBI_MWPL_BAN_RESTRICTION'
  | 'PRICE_BAND_COLLAR'
  | 'SELF_TRADE_PREVENTION';

export interface PreTradeOrder {
  orderId: string;
  symbol: string;
  instrumentType: InstrumentType;
  side: OrderSide;
  quantity: number;
  price: number;
  strikePrice?: number;
  expiryDate?: string;
  daysToExpiry?: number;
  lotSize: number;
  isHedgeOrder?: boolean;
}

export interface PreTradeOrderRequest {
  orderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
  product: 'MIS' | 'CNC';
  quantity: number;
  price?: number;
  triggerPrice?: number;
  instrumentType: InstrumentType;
  optionType?: OptionType;
  strike?: number;
  daysToExpiry?: number;
  isSquareOff?: boolean; // If true, this order reduces an existing position
}

export interface AccountRiskState {
  userId: string;
  totalCapital: number;
  availableCash: number;
  usedMargin: number;
  freeMargin: number;
  dailyRealizedPnL: number;
  dailyUnrealizedPnL: number;
  netDailyPnL: number;
  maxDailyLossLimit: number; // ₹ limit (e.g. 5% of capital)
  maxSingleOrderNotional: number; // e.g. ₹2,00,00,000 (₹2 Cr)
  maxSingleOrderQuantity: number; // e.g. 1,800 for NIFTY, 900 for BANKNIFTY
  currentOpenPositions: RiskPosition[];
  activePendingOrdersCount: number;
}

export interface PreTradeCheckResult {
  rule: PreTradeValidationRule;
  passed: boolean;
  currentValue: number | string;
  thresholdLimit: number | string;
  message: string;
}

export type GatekeeperStatus =
  | 'APPROVED'
  | 'APPROVED_HEDGE_REDUCTION'
  | 'REJECTED_OVERSIZED'
  | 'REJECTED_MARGIN_DEFICIT'
  | 'REJECTED_CIRCUIT_BREAKER'
  | 'REJECTED_EXPOSURE_LIMIT';

export interface GatekeeperDecision {
  approved: boolean;
  status: GatekeeperStatus;
  rejectionReason?: string;
  orderNotional: number;
  incrementalMargin: number;
  projectedMarginUtilization: number;
  circuitBandLower: number;
  circuitBandUpper: number;
  latencyMs: number;
}

export interface PreTradeGatekeeperDecision {
  isApproved: boolean;
  orderId?: string;
  orderRequest: PreTradeOrderRequest;
  rejectionReasons: string[];
  checks: PreTradeCheckResult[];
  estimatedRequiredMargin: number;
  postTradeFreeMargin: number;
  postTradeMarginUtilizationPct: number;
  recommendedAction: 'PROCEED' | 'SCALE_DOWN' | 'REJECT';
  suggestedMaxQuantity?: number;
  auditLatencyMicros: number; // High-frequency pre-trade audit latency in microseconds
  validatedAt: string;
}

export interface RiskEngineConfig {
  accountCollateral: number;
  priceScanRangePercent: number; // e.g. 0.05 for 5% price scan range (3 sigma)
  volScanRangePoints: number; // e.g. 0.10 for 10% IV shift
  shortOptionMinimumPercent: number; // e.g. 0.015 (1.5% of spot)
  exposureMarginPercent: number; // e.g. 0.03 (3% of gross notional)
  maxSingleOrderNotional: number; // e.g. 25,00,000 INR
  maxSingleOrderQty: number; // e.g. 1800 units (36 lots)
  maxGrossLeverage: number; // e.g. 5x collateral
  circuitLimitPercent: number; // e.g. 0.10 (10% circuit band)
  underlyingSpot: number; // Reference index spot price (e.g. 24000)
  referenceVol: number; // Reference IV (e.g. 0.14)
}

// ============================================================================
// 7. PORTFOLIO STRESS TESTING AGGREGATE SUMMARY
// ============================================================================

export interface PortfolioStressTestDeskReport {
  timestamp: string;
  totalPortfolioValue: number;
  positionsCount: number;
  spanScanningRisk: SpanScanningRiskResult;
  spreadMarginAnalysis: SpreadMarginAnalysis;
  evtExpectedShortfall: EVTRiskMetrics;
  sebiCircuitBreakerStatus: SebiCircuitBreakerStatus;
  mwplBanWarnings: MwplStatus[];
  gatekeeperHealthStatus: {
    engineOperational: boolean;
    avgLatencyMicros: number;
    totalOrdersIntercepted: number;
    rejectionRatePct: number;
  };
}

// Re-export types from riskEngine for unified import access
export * from './riskEngine';
