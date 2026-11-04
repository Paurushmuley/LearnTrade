// Sprint 18 — Macroeconomic Sentiment Analysis & News Event Risk Engine Types
// Models: Dubinsky-Johannes Pre-Event IV Jump, Instantaneous IV Crush,
// Loughran-McDonald Lexicon & Hawk/Dove Stance, Composite Event Risk Score (ERS),
// Indian Sector Event Betas, and SUE Earnings Surprise Drift

export type MacroEventCategory =
  | 'RBI_MPC_DECISION'
  | 'UNION_BUDGET_INDIA'
  | 'US_FED_FOMC_DECISION'
  | 'NSE_EARNINGS_ANNOUNCE'
  | 'INDIA_CPI_INFLATION'
  | 'CRUDE_OIL_SUPPLY_SHOCK'
  | 'GENERAL_ELECTIONS_INDIA';

export type EventRiskRegime = 'NORMAL' | 'ELEVATED' | 'HIGH_RISK' | 'SEVERE_REGIME';

export type EventImpactLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export type MonetaryPolicyStance = 'HAWKISH' | 'DOVISH' | 'NEUTRAL';

export type NewsUrgency = 'FLASH' | 'HIGH' | 'ROUTINE';

export type EventHedgeType =
  | 'VEGA_NEUTRAL'
  | 'DELTA_NEUTRAL'
  | 'CALENDAR_SPREAD'
  | 'TAIL_RISK_COLLAR'
  | 'POST_EVENT_IRON_FLY';

/** A scheduled or breaking macroeconomic event */
export interface MacroEventRecord {
  id: string;
  name: string;
  category: MacroEventCategory;
  scheduledTime: string; // ISO 8601
  status: 'SCHEDULED' | 'IMMINENT' | 'IN_PROGRESS' | 'RESOLVED';
  consensusForecast?: string;
  previousValue?: string;
  actualValue?: string;
  targetAssets: string[]; // e.g. ['NIFTY', 'BANKNIFTY', 'HDFCBANK']
  historicalVolatilityBeta: number; // e.g. 2.8%
  preEventIvInflation: number; // e.g. +6.5% IV
  expectedCrushPct: number; // e.g. 35% IV crush
  description: string;
  impactLevel: EventImpactLevel;
}

/** Ingested news item scored with financial NLP */
export interface NewsSentimentItem {
  id: string;
  timestamp: string;
  headline: string;
  source: string;
  category: MacroEventCategory;
  relatedTickers: string[];
  sentimentScore: number; // [-1.0, +1.0]
  stance: MonetaryPolicyStance;
  urgency: NewsUrgency;
  confidence: number; // [0.0, 1.0]
  decayedScore: number; // Post half-life decay
  summary: string;
}

/** Pre-Event Implied Volatility and Straddle analysis (Dubinsky-Johannes) */
export interface PreEventVolAnalysis {
  eventId: string;
  symbol: string;
  spotPrice: number;
  timeToEventHours: number;
  timeToExpiryDays: number;
  currentIv: number; // e.g. 22.5%
  baselineDiffusiveIv: number; // e.g. 14.0%
  discreteEventVariance: number; // V_event
  theoreticalPreEventIv: number;
  forecastPostEventIv: number;
  expectedCrushPct: number; // % drop in IV
  impliedStraddleMovePct: number; // Expected spot move %
  impliedMovePoints: number; // In index points
  atmStraddlePrice: number; // Price of ATM Call + Put
  netVegaExposureValue: number; // Total portfolio ₹ / point
  estimatedVegaPnlImpact: number; // In INR
}

/** Quantile point for Implied Volatility Cones */
export interface VolatilityConePoint {
  tenorDays: number; // 1, 7, 14, 30, 60, 90
  p10: number; // Depressed
  p25: number; // Subdued
  p50: number; // Median baseline
  p75: number; // Elevated pre-event
  p90: number; // Extreme panic
  currentIv: number;
  isOverheated: boolean;
}

/** Full Term Structure Volatility Cone */
export interface EventVolatilityCone {
  underlyingSymbol: string;
  baselineIv: number;
  eventIv: number;
  eventVariance: number;
  expectedMovePct: number;
  cones: VolatilityConePoint[];
}

/** Sector-specific sensitivity to a macroeconomic catalyst */
export interface SectorEventBeta {
  sectorName: string;
  beta: number; // Sensitivity relative to NIFTY 50 (e.g. Bank Nifty = 1.85)
  expectedSectorMovePct: number;
  historicalMaxDrawdownPct: number;
  primaryDrivers: string;
}

/** Corporate earnings surprise & Post-Earnings Announcement Drift (PEAD) */
export interface EarningsSurpriseModel {
  ticker: string;
  consensusEps: number;
  actualEps: number;
  whisperEps?: number;
  forecastDispersion: number;
  surpriseZScore: number; // Standardized Unexpected Earnings (SUE)
  guidanceStance: 'BEAT_RAISE' | 'IN_LINE' | 'MISS_LOWER';
  impliedMovePct: number;
  projectedPriceJumpPct: number;
  postEarningsDriftExpectation: 'BULLISH_DRIFT' | 'BEARISH_DRIFT' | 'NEUTRAL';
}

/** Pre-Event Delta/Vega hedge order recommendation */
export interface PreEventHedgeRecommendation {
  id: string;
  hedgeType: EventHedgeType;
  targetInstrument: string;
  side: 'BUY' | 'SELL';
  lots: number;
  quantity: number;
  strike?: number;
  expiryTenor?: string;
  vegaOffset: number;
  deltaOffset: number;
  netCostOrCredit: number; // positive = debit, negative = credit
  statutoryFrictionInr: number; // STT, SEBI, GST, stamp duty
  rationale: string;
}

/** Historical stress scenario outcome for portfolio */
export interface MacroScenarioResult {
  scenarioId: string;
  scenarioName: string;
  historicalDate: string;
  historicalContext: string;
  indexShockPct: number;
  ivShockPoints: number;
  simulatedPnlInr: number;
  pnlDrawdownPct: number;
  deltaPnlInr: number;
  vegaPnlInr: number;
  riskBreached: boolean;
  mitigationPlan: string;
}

/** Risk Directives enforced during heightened ERS */
export interface RiskDirectives {
  maxPermittedLeverage: number; // e.g. 1.0x to 5.0x
  restrictNakedSelling: boolean;
  mandatoryStopLossBps: number;
  recommendedStrategies: string[];
}

/** Real-time Composite Event Risk State of the system */
export interface MacroEventRiskState {
  currentTimestamp: string;
  overallErs: number; // [0 - 100]
  regime: EventRiskRegime;
  activeEvents: MacroEventRecord[];
  imminentEvent?: MacroEventRecord;
  compositeSentiment: number; // [-1.0 to +1.0]
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  recentHeadlines: NewsSentimentItem[];
  riskDirectives: RiskDirectives;
}
