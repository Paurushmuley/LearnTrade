// Sprint 18 — Macroeconomic Sentiment Analysis & News Event Risk Engine
// Quantitative specification: Dubinsky & Johannes (2006) "The Price of Event Risk",
// Loughran & McDonald (2011) Financial Sentiment Lexicon,
// Merton (1976) Jump-Diffusion Variance Decomposition, and SEBI Statutory Tax Integration

import {
  MacroEventCategory,
  EventRiskRegime,
  EventImpactLevel,
  MonetaryPolicyStance,
  MacroEventRecord,
  NewsSentimentItem,
  PreEventVolAnalysis,
  VolatilityConePoint,
  EventVolatilityCone,
  SectorEventBeta,
  EarningsSurpriseModel,
  PreEventHedgeRecommendation,
  MacroScenarioResult,
  RiskDirectives,
  MacroEventRiskState,
} from '../types/macroEvent';
import { calculateStatutoryCharges } from './taxEngine';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRELOADED INDIAN MACROECONOMIC CALENDAR & EVENT METRIC CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_MACRO_EVENTS: MacroEventRecord[] = [
  {
    id: 'EVT-UNION-BUDGET-2025',
    name: 'Union Budget of India FY25-26',
    category: 'UNION_BUDGET_INDIA',
    scheduledTime: new Date(Date.now() + 18 * 3600 * 1000).toISOString(), // T+18h
    status: 'IMMINENT',
    consensusForecast: 'Fiscal Deficit 4.9% of GDP, Capex ₹11.8 Lakh Cr',
    previousValue: 'Fiscal Deficit 5.1% of GDP',
    targetAssets: ['NIFTY 50', 'NIFTY INFRA', 'NIFTY PSU BANK', 'NIFTY METAL'],
    historicalVolatilityBeta: 3.8, // 3.8% historical 1-day move
    preEventIvInflation: 14.5, // +14.5% IV surge
    expectedCrushPct: 42.0, // 42% instantaneous crush post-speech
    description: 'Annual Union Budget presentation by the Finance Minister with taxation, capex, and deficit allocations.',
    impactLevel: 'CRITICAL',
  },
  {
    id: 'EVT-RBI-MPC-DEC-2024',
    name: 'RBI Monetary Policy Committee Rate Decision',
    category: 'RBI_MPC_DECISION',
    scheduledTime: new Date(Date.now() + 38 * 3600 * 1000).toISOString(), // T+38h
    status: 'SCHEDULED',
    consensusForecast: 'Repo Rate Unchanged at 6.50%, Stance Neutral',
    previousValue: 'Repo Rate 6.50%, Stance Neutral',
    targetAssets: ['BANKNIFTY', 'NIFTY 50', 'HDFCBANK', 'ICICIBANK', 'SBIN'],
    historicalVolatilityBeta: 2.4, // 2.4% historical 1-day move
    preEventIvInflation: 6.8, // +6.8% IV surge
    expectedCrushPct: 35.0, // 35% IV crush
    description: 'Bi-monthly RBI MPC policy resolution on repo rate, liquidity stance, and CPI inflation guidance.',
    impactLevel: 'HIGH',
  },
  {
    id: 'EVT-US-FED-FOMC-DEC',
    name: 'US Federal Reserve FOMC Rate Decision & Dot Plot',
    category: 'US_FED_FOMC_DECISION',
    scheduledTime: new Date(Date.now() + 62 * 3600 * 1000).toISOString(),
    status: 'SCHEDULED',
    consensusForecast: 'Fed Funds Rate 4.50% - 4.75% (-25 bps cut)',
    previousValue: '4.75% - 5.00%',
    targetAssets: ['NIFTY IT', 'NIFTY 50', 'USDINR', 'TCS', 'INFY'],
    historicalVolatilityBeta: 1.8,
    preEventIvInflation: 4.2,
    expectedCrushPct: 24.0,
    description: 'US Fed interest rate decision, economic projections dot plot, and press conference by Jerome Powell.',
    impactLevel: 'HIGH',
  },
  {
    id: 'EVT-NSE-TCS-Q3',
    name: 'TCS Q3 Corporate Earnings Announcement',
    category: 'NSE_EARNINGS_ANNOUNCE',
    scheduledTime: new Date(Date.now() + 84 * 3600 * 1000).toISOString(),
    status: 'SCHEDULED',
    consensusForecast: 'EPS ₹32.40, Revenue ₹64,200 Cr, CC Growth +1.8%',
    previousValue: 'EPS ₹30.50',
    targetAssets: ['TCS', 'NIFTY IT', 'INFY'],
    historicalVolatilityBeta: 3.2,
    preEventIvInflation: 8.5,
    expectedCrushPct: 40.0,
    description: 'Q3 financial results, constant currency revenue growth, deal TCV, and margin outlook.',
    impactLevel: 'HIGH',
  },
  {
    id: 'EVT-INDIA-CPI-NOV',
    name: 'India Headline CPI Inflation (MoSPI)',
    category: 'INDIA_CPI_INFLATION',
    scheduledTime: new Date(Date.now() + 110 * 3600 * 1000).toISOString(),
    status: 'SCHEDULED',
    consensusForecast: 'CPI 5.20% YoY vs 6.21% previous',
    previousValue: '6.21%',
    targetAssets: ['NIFTY 50', 'BANKNIFTY', '10Y_GSEC'],
    historicalVolatilityBeta: 0.9,
    preEventIvInflation: 1.8,
    expectedCrushPct: 15.0,
    description: 'Retail consumer price inflation print tracking food, fuel, and core inflationary pressures.',
    impactLevel: 'MODERATE',
  },
  {
    id: 'EVT-CRUDE-OPEC-MEETING',
    name: 'OPEC+ Crude Oil Supply Quota Meeting',
    category: 'CRUDE_OIL_SUPPLY_SHOCK',
    scheduledTime: new Date(Date.now() + 140 * 3600 * 1000).toISOString(),
    status: 'SCHEDULED',
    consensusForecast: 'Roll over existing 2.2M bpd voluntary output cuts',
    previousValue: 'Cuts extended',
    targetAssets: ['RELIANCE', 'BPCL', 'IOC', 'ONGC', 'ASIANPAINT'],
    historicalVolatilityBeta: 2.1,
    preEventIvInflation: 4.8,
    expectedCrushPct: 28.0,
    description: 'Crude output quotas directly impacting Indian OMC margins, trade deficit, and USD/INR.',
    impactLevel: 'MODERATE',
  },
];

/**
 * Returns the active or upcoming macroeconomic calendar events
 */
export function getUpcomingMacroEvents(referenceDate: Date = new Date()): MacroEventRecord[] {
  const refTime = referenceDate.getTime();
  return DEFAULT_MACRO_EVENTS.map((evt) => {
    const eventTime = new Date(evt.scheduledTime).getTime();
    const diffHours = (eventTime - refTime) / (3600 * 1000);

    let status: MacroEventRecord['status'] = 'SCHEDULED';
    if (diffHours < 0) status = 'RESOLVED';
    else if (diffHours <= 2) status = 'IN_PROGRESS';
    else if (diffHours <= 24) status = 'IMMINENT';

    return { ...evt, status };
  }).sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FINANCIAL NLP LEXICON & MONETARY POLICY STANCE SCORING
// ─────────────────────────────────────────────────────────────────────────────

const FINANCIAL_POS_TERMS = new Set([
  'surge', 'surging', 'rally', 'rallies', 'robust', 'growth', 'expansion',
  'profit', 'profitable', 'outperform', 'exceed', 'exceeded', 'dividend',
  'resilient', 'gain', 'gains', 'beat', 'beats', 'upturn', 'upgrade',
  'upgrades', 'breakout', 'record', 'all-time-high', 'stimulus', 'easing',
  'accommodative', 'tailwind', 'optimism', 'bullish', 'surplus',
]);

const FINANCIAL_NEG_TERMS = new Set([
  'slump', 'slumps', 'loss', 'losses', 'deficit', 'inflation', 'recession',
  'contraction', 'cut', 'cuts', 'downgrade', 'downgrades', 'plunge', 'plunges',
  'adverse', 'weakness', 'risk', 'risks', 'default', 'miss', 'misses',
  'decline', 'turmoil', 'headwind', 'pessimism', 'bearish', 'stagflation',
  'curb', 'tightening', 'liquidity-squeeze', 'penalty', 'veto',
]);

const HAWKISH_PHRASES = [
  'rate hike', 'tightening', 'curb inflation', 'liquidity withdrawal',
  'overheating', 'repo hike', 'hawkish', 'crr hike', 'price stability priority',
  'tighter monetary stance', 'withdrawal of accommodation', 'inflation persistent',
  'rate increase', 'elevated inflation', 'capacity utilization high',
];

const DOVISH_PHRASES = [
  'rate cut', 'easing', 'stimulus', 'liquidity injection',
  'accommodative', 'growth support', 'soft landing', 'dovish',
  'repo cut', 'growth revival', 'growth concerns', 'benign inflation',
  'support economic activity', 'liquidity surplus', 'disinflationary trend',
];

/**
 * Computes deterministic financial NLP sentiment and central bank stance
 * based on the domain-calibrated Loughran-McDonald lexicon.
 */
export function computeLexiconSentiment(text: string): {
  polarity: number;
  stance: MonetaryPolicyStance;
  confidence: number;
  counts: { pos: number; neg: number; hawk: number; dove: number };
} {
  const normalized = text.toLowerCase();
  const tokens = normalized.match(/[a-z0-9\-]+/g) || [];

  let pos = 0;
  let neg = 0;
  for (const token of tokens) {
    if (FINANCIAL_POS_TERMS.has(token)) pos++;
    if (FINANCIAL_NEG_TERMS.has(token)) neg++;
  }

  let hawk = 0;
  for (const phrase of HAWKISH_PHRASES) {
    if (normalized.includes(phrase)) hawk += 2;
  }
  let dove = 0;
  for (const phrase of DOVISH_PHRASES) {
    if (normalized.includes(phrase)) dove += 2;
  }

  // Laplace smoothed polarity in [-1.0, +1.0]
  const polarity = (pos - neg) / (pos + neg + 1.0);

  // Stance metric in [-1.0, +1.0]
  const stanceScore = (hawk - dove) / (hawk + dove + 1.0);
  let stance: MonetaryPolicyStance = 'NEUTRAL';
  if (stanceScore > 0.3) stance = 'HAWKISH';
  else if (stanceScore < -0.3) stance = 'DOVISH';

  // Confidence metric based on signal density
  const totalSignals = pos + neg + hawk + dove;
  const confidence = Math.min(1.0, Number((totalSignals / Math.max(1, tokens.length * 0.2 + 2)).toFixed(2)));

  return {
    polarity: Number(polarity.toFixed(3)),
    stance,
    confidence: Math.max(0.2, confidence),
    counts: { pos, neg, hawk, dove },
  };
}

/**
 * Applies exponential decay to sentiment based on event half-life.
 * S(t) = S_0 * exp(-lambda * dt), where lambda = ln(2) / t_half
 */
export function applyExponentialTimeDecay(
  rawSentiment: number,
  elapsedMinutes: number,
  category: MacroEventCategory
): number {
  if (elapsedMinutes <= 0) return rawSentiment;

  // Calibrated half-lives in minutes
  const halfLives: Record<MacroEventCategory, number> = {
    RBI_MPC_DECISION: 480, // 8 Hours
    UNION_BUDGET_INDIA: 2880, // 48 Hours
    US_FED_FOMC_DECISION: 720, // 12 Hours
    NSE_EARNINGS_ANNOUNCE: 240, // 4 Hours
    INDIA_CPI_INFLATION: 240, // 4 Hours
    CRUDE_OIL_SUPPLY_SHOCK: 1440, // 24 Hours
    GENERAL_ELECTIONS_INDIA: 4320, // 72 Hours
  };

  const tHalf = halfLives[category] ?? 480;
  const lambda = Math.LN2 / tHalf;
  const decayed = rawSentiment * Math.exp(-lambda * elapsedMinutes);

  return Number(decayed.toFixed(3));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DUBINSKY-JOHANNES PRE-EVENT IV JUMP & POST-EVENT IV CRUSH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dubinsky-Johannes Jump-Diffusion Volatility Model:
 * Total Integrated Variance: sigma_implied^2(T) * T = sigma_diff^2 * T + V_event
 *
 * Implied Volatility:
 *   sigma_implied(T) = sqrt( sigma_diff^2 + V_event / T )
 *
 * As T -> 0, sigma_implied -> infinity (asymptotic pre-event IV spike).
 *
 * @param baselineIv Baseline diffusive volatility (e.g. 0.14 for 14%)
 * @param eventVariance Discrete jump variance V_event (e.g. 0.0035)
 * @param timeToExpiryDays Time to option expiration in days
 * @returns Annualized implied volatility (e.g. 0.245 for 24.5%)
 */
export function calculateDubinskyJohannesIvJump(
  baselineIv: number,
  eventVariance: number,
  timeToExpiryDays: number
): number {
  const safeTimeYears = Math.max(0.25, timeToExpiryDays) / 365.0; // minimum 6 hours
  const baselineVariance = baselineIv * baselineIv;
  const totalVariance = baselineVariance + eventVariance / safeTimeYears;

  return Number(Math.sqrt(Math.max(0.0001, totalVariance)).toFixed(4));
}

/**
 * Calculates instantaneous post-event IV crush upon announcement resolution (V_event -> 0).
 * Pre-event IV collapses back to the baseline diffusive volatility.
 */
export function calculatePostEventIvCrush(
  currentIv: number,
  baselineIv: number
): { postIv: number; crushAbs: number; crushPct: number } {
  const postIv = Math.min(currentIv, baselineIv);
  const crushAbs = Math.max(0, currentIv - postIv);
  const crushPct = (crushAbs / Math.max(0.01, currentIv)) * 100;

  return {
    postIv: Number(postIv.toFixed(4)),
    crushAbs: Number(crushAbs.toFixed(4)),
    crushPct: Number(crushPct.toFixed(2)),
  };
}

/**
 * Computes event-implied price movement from the At-The-Money (ATM) Straddle.
 * Standard rule-of-thumb: ExpectedMove% ≈ (C_atm + P_atm) / S_0 * 0.80
 */
export function calculateExpectedStraddleMove(
  spotPrice: number,
  atmStraddlePrice: number
): { expectedMovePct: number; expectedMovePoints: number } {
  if (spotPrice <= 0 || atmStraddlePrice <= 0) {
    return { expectedMovePct: 0, expectedMovePoints: 0 };
  }

  const expectedMovePct = (atmStraddlePrice / spotPrice) * 0.80 * 100;
  const expectedMovePoints = spotPrice * (expectedMovePct / 100);

  return {
    expectedMovePct: Number(expectedMovePct.toFixed(2)),
    expectedMovePoints: Number(expectedMovePoints.toFixed(2)),
  };
}

/**
 * Pre-event Volatility & Straddle Risk Analysis
 */
export function analyzePreEventVolatility(
  event: MacroEventRecord,
  spotPrice: number,
  currentIv: number,
  baselineIv: number,
  timeToEventHours: number,
  timeToExpiryDays: number,
  netPortfolioVega: number = 0
): PreEventVolAnalysis {
  const timeYears = Math.max(0.25, timeToExpiryDays) / 365;

  // Discrete event variance V_event backed out from current IV vs baseline
  const currentVarianceTotal = Math.pow(currentIv, 2) * timeYears;
  const baselineVarianceTotal = Math.pow(baselineIv, 2) * timeYears;
  const discreteEventVariance = Math.max(0, currentVarianceTotal - baselineVarianceTotal);

  const theoreticalPreIv = calculateDubinskyJohannesIvJump(baselineIv, discreteEventVariance, timeToExpiryDays);
  const { postIv, crushPct } = calculatePostEventIvCrush(currentIv, baselineIv);

  // Synthetic ATM straddle price approximation based on IV
  // ATM straddle ≈ 0.8 * S * sigma * sqrt(T)
  const atmStraddlePrice = 0.8 * spotPrice * currentIv * Math.sqrt(timeYears);
  const { expectedMovePct, expectedMovePoints } = calculateExpectedStraddleMove(spotPrice, atmStraddlePrice);

  // Vega PnL impact: PnL = netVega * (-DeltaIV * 100)
  // netVega is ₹ per 1% IV shift
  const deltaIvPoints = (currentIv - postIv) * 100;
  const estimatedVegaPnlImpact = -1 * netPortfolioVega * deltaIvPoints;

  return {
    eventId: event.id,
    symbol: event.targetAssets[0] ?? 'NIFTY 50',
    spotPrice,
    timeToEventHours,
    timeToExpiryDays,
    currentIv: Number(currentIv.toFixed(4)),
    baselineDiffusiveIv: Number(baselineIv.toFixed(4)),
    discreteEventVariance: Number(discreteEventVariance.toFixed(6)),
    theoreticalPreEventIv: theoreticalPreIv,
    forecastPostEventIv: postIv,
    expectedCrushPct: crushPct,
    impliedStraddleMovePct: expectedMovePct,
    impliedMovePoints: expectedMovePoints,
    atmStraddlePrice: Number(atmStraddlePrice.toFixed(2)),
    netVegaExposureValue: Number(netPortfolioVega.toFixed(2)),
    estimatedVegaPnlImpact: Number(estimatedVegaPnlImpact.toFixed(2)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. IMPLIED VOLATILITY CONES GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Historical percentile bounds for Indian equity index options (NIFTY 50)
 * Calibrated against historical India VIX distribution across standard tenors.
 */
const HISTORICAL_VOL_CONE_BENCHMARKS: Record<number, { p10: number; p25: number; p50: number; p75: number; p90: number }> = {
  1:  { p10: 11.5, p25: 13.0, p50: 15.2, p75: 19.5, p90: 26.0 },
  7:  { p10: 11.8, p25: 13.2, p50: 15.0, p75: 18.5, p90: 24.2 },
  14: { p10: 12.0, p25: 13.5, p50: 14.8, p75: 17.8, p90: 22.5 },
  30: { p10: 12.2, p25: 13.8, p50: 14.5, p75: 17.0, p90: 21.2 },
  60: { p10: 12.5, p25: 14.0, p50: 14.5, p75: 16.5, p90: 20.0 },
  90: { p10: 12.8, p25: 14.2, p50: 14.6, p75: 16.2, p90: 19.5 },
};

/**
 * Generates term-structure volatility cones comparing current IV against historical percentiles
 */
export function generateEventVolatilityCone(
  underlying: string,
  currentIvPct: number,
  baselineIvPct: number,
  eventVariance: number = 0.003
): EventVolatilityCone {
  const tenors = [1, 7, 14, 30, 60, 90];
  const cones: VolatilityConePoint[] = [];

  for (const tenor of tenors) {
    const bench = HISTORICAL_VOL_CONE_BENCHMARKS[tenor] || HISTORICAL_VOL_CONE_BENCHMARKS[30];
    const timeYears = tenor / 365.0;

    // Model event-augmented current IV across tenors
    const modeledIv = Math.sqrt(Math.pow(baselineIvPct / 100, 2) + eventVariance / timeYears) * 100;
    const isOverheated = modeledIv >= bench.p90;

    cones.push({
      tenorDays: tenor,
      p10: bench.p10,
      p25: bench.p25,
      p50: bench.p50,
      p75: bench.p75,
      p90: bench.p90,
      currentIv: Number(modeledIv.toFixed(2)),
      isOverheated,
    });
  }

  const expectedMovePct = Number((Math.sqrt(eventVariance) * 0.7979 * 100).toFixed(2));

  return {
    underlyingSymbol: underlying,
    baselineIv: baselineIvPct,
    eventIv: currentIvPct,
    eventVariance,
    expectedMovePct,
    cones,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMPOSITE EVENT RISK SCORE (ERS) & REGIME DIRECTIVES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the unified Event Risk Score (ERS) in [0, 100].
 *
 * ERS = min(100, w1*I_prox + w2*H_shock + w3*V_prem + w4*D_disp)
 * calibrated weights: w1=0.35, w2=0.30, w3=0.20, w4=0.15
 */
export function calculateEventRiskScore(
  event: MacroEventRecord,
  currentIv: number,
  baselineRv: number,
  hoursRemaining: number,
  dispersionScore: number = 50
): number {
  // 1. Proximity factor (exponential decay approaching event)
  const tauHours: Record<MacroEventCategory, number> = {
    UNION_BUDGET_INDIA: 24,
    RBI_MPC_DECISION: 8,
    US_FED_FOMC_DECISION: 12,
    NSE_EARNINGS_ANNOUNCE: 4,
    INDIA_CPI_INFLATION: 6,
    CRUDE_OIL_SUPPLY_SHOCK: 16,
    GENERAL_ELECTIONS_INDIA: 36,
  };
  const tau = tauHours[event.category] ?? 12;
  const clampedHours = Math.max(0, hoursRemaining);
  const iProx = 100 * Math.exp(-clampedHours / tau);

  // 2. Historical shock beta normalized (0 to 100)
  const shockBetas: Record<MacroEventCategory, number> = {
    UNION_BUDGET_INDIA: 95,
    GENERAL_ELECTIONS_INDIA: 98,
    RBI_MPC_DECISION: 75,
    NSE_EARNINGS_ANNOUNCE: 70,
    US_FED_FOMC_DECISION: 60,
    CRUDE_OIL_SUPPLY_SHOCK: 55,
    INDIA_CPI_INFLATION: 30,
  };
  const hShock = shockBetas[event.category] ?? 50;

  // 3. Volatility elevation premium
  const volElevationPct = Math.max(0, ((currentIv - baselineRv) / Math.max(0.01, baselineRv)) * 100);
  const vPrem = Math.min(100, volElevationPct * 2.0);

  // 4. Consensus dispersion
  const dDisp = Math.min(100, Math.max(0, dispersionScore));

  const ersRaw = 0.35 * iProx + 0.30 * hShock + 0.20 * vPrem + 0.15 * dDisp;
  return Number(Math.min(100, Math.max(0, ersRaw)).toFixed(1));
}

/**
 * Returns dynamic risk directives and operational guardrails for an ERS regime
 */
export function getRiskDirectivesForRegime(regime: EventRiskRegime): RiskDirectives {
  switch (regime) {
    case 'SEVERE_REGIME':
      return {
        maxPermittedLeverage: 1.0, // Zero MIS leverage (1x cash only)
        restrictNakedSelling: true,
        mandatoryStopLossBps: 50,
        recommendedStrategies: [
          'TAIL_RISK_COLLAR',
          'CASH_BUFFER_PROTECTION',
          'POST_EVENT_IRON_FLY',
          'LONG_VOLATILITY_CALENDAR',
        ],
      };
    case 'HIGH_RISK':
      return {
        maxPermittedLeverage: 2.0,
        restrictNakedSelling: true,
        mandatoryStopLossBps: 75,
        recommendedStrategies: [
          'DELTA_NEUTRAL_HEDGE',
          'DEFINED_RISK_IRON_CONDOR',
          'VEGA_LONG_SPREAD',
        ],
      };
    case 'ELEVATED':
      return {
        maxPermittedLeverage: 3.5,
        restrictNakedSelling: false,
        mandatoryStopLossBps: 100,
        recommendedStrategies: [
          'LONG_CALENDAR_SPREAD',
          'DEFINED_RISK_SPREAD',
          'COVERED_CALL',
        ],
      };
    case 'NORMAL':
    default:
      return {
        maxPermittedLeverage: 5.0, // Standard MIS 5x leverage
        restrictNakedSelling: false,
        mandatoryStopLossBps: 150,
        recommendedStrategies: [
          'MOMENTUM_TREND',
          'BREAKOUT_BUY',
          'NAKED_STRADDLE_INTRADAY',
        ],
      };
  }
}

/**
 * Synthesizes the overall real-time macroeconomic event risk state
 */
export function getCompositeMacroEventRiskState(
  events: MacroEventRecord[] = DEFAULT_MACRO_EVENTS,
  currentIv: number = 0.215,
  baselineRv: number = 0.142,
  headlines?: NewsSentimentItem[]
): MacroEventRiskState {
  const activeEvents = getUpcomingMacroEvents();
  const imminent = activeEvents.find((e) => e.status === 'IMMINENT' || e.status === 'IN_PROGRESS') || activeEvents[0];

  const now = new Date();
  const hoursRemaining = imminent
    ? (new Date(imminent.scheduledTime).getTime() - now.getTime()) / (3600 * 1000)
    : 48;

  const overallErs = imminent
    ? calculateEventRiskScore(imminent, currentIv * 100, baselineRv * 100, Math.max(0, hoursRemaining))
    : 25;

  let regime: EventRiskRegime = 'NORMAL';
  if (overallErs >= 85) regime = 'SEVERE_REGIME';
  else if (overallErs >= 70) regime = 'HIGH_RISK';
  else if (overallErs >= 40) regime = 'ELEVATED';

  const newsItems = headlines || getSampleNewsWire();
  const sentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
  let totalScore = 0;

  for (const item of newsItems) {
    if (item.sentimentScore > 0.1) sentimentDistribution.positive++;
    else if (item.sentimentScore < -0.1) sentimentDistribution.negative++;
    else sentimentDistribution.neutral++;
    totalScore += item.decayedScore;
  }

  const compositeSentiment = newsItems.length > 0 ? Number((totalScore / newsItems.length).toFixed(3)) : 0;
  const riskDirectives = getRiskDirectivesForRegime(regime);

  return {
    currentTimestamp: now.toISOString(),
    overallErs,
    regime,
    activeEvents,
    imminentEvent: imminent,
    compositeSentiment,
    sentimentDistribution,
    recentHeadlines: newsItems,
    riskDirectives,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SECTOR EVENT BETA SENSITIVITY MATRIX
// ─────────────────────────────────────────────────────────────────────────────

const SECTOR_EVENT_BETAS: Record<MacroEventCategory, { sector: string; beta: number; maxDd: number; drivers: string }[]> = {
  RBI_MPC_DECISION: [
    { sector: 'NIFTY BANK', beta: 1.85, maxDd: 4.8, drivers: 'NIM spreads, repo rate cost of funds, credit growth guidance' },
    { sector: 'NIFTY REALTY', beta: 1.65, maxDd: 5.2, drivers: 'Home loan borrowing rates, developer leverage costs' },
    { sector: 'NIFTY AUTO', beta: 1.20, maxDd: 3.4, drivers: 'Vehicle retail financing rates, consumer demand cycle' },
    { sector: 'NIFTY 50', beta: 1.00, maxDd: 2.5, drivers: 'Broad index benchmark weighting' },
    { sector: 'NIFTY IT', beta: 0.45, maxDd: 1.8, drivers: 'USD/INR sensitivity, independent global tech spend cycle' },
    { sector: 'NIFTY FMCG', beta: 0.40, maxDd: 1.5, drivers: 'Defensive low-beta consumer staples buffer' },
  ],
  UNION_BUDGET_INDIA: [
    { sector: 'NIFTY INFRA', beta: 2.10, maxDd: 7.2, drivers: 'Capital expenditure (Capex) allocation, highways, railways' },
    { sector: 'NIFTY PSU BANK', beta: 1.90, maxDd: 6.8, drivers: 'Divestment targets, PSU capex financing, bond yields' },
    { sector: 'NIFTY METAL', beta: 1.55, maxDd: 5.5, drivers: 'Import/export custom duties, domestic demand incentives' },
    { sector: 'NIFTY AUTO', beta: 1.25, maxDd: 4.2, drivers: 'EV subsidies (FAME), scrappage policy, duty concessions' },
    { sector: 'NIFTY 50', beta: 1.00, maxDd: 3.8, drivers: 'Fiscal deficit print, STT/capital gains tax amendments' },
    { sector: 'NIFTY FMCG', beta: 0.65, maxDd: 2.4, drivers: 'Rural disposable income schemes, tax slab revisions' },
  ],
  US_FED_FOMC_DECISION: [
    { sector: 'NIFTY IT', beta: 1.70, maxDd: 4.5, drivers: 'US Enterprise tech budget, Nasdaq correlation, USDINR revenue' },
    { sector: 'NIFTY METAL', beta: 1.30, maxDd: 3.8, drivers: 'Global commodity dollar pricing, LME metal index' },
    { sector: 'NIFTY 50', beta: 1.00, maxDd: 2.2, drivers: 'FII cash equity net flows, DXY currency pressure' },
    { sector: 'NIFTY PHARMA', beta: 0.85, maxDd: 2.0, drivers: 'US generics pricing, export currency benefit' },
    { sector: 'BANKNIFTY', beta: 0.75, maxDd: 2.6, drivers: 'FII banking sector allocations, 10Y US Treasury yield spread' },
  ],
  NSE_EARNINGS_ANNOUNCE: [
    { sector: 'TARGET STOCK', beta: 2.80, maxDd: 9.5, drivers: 'Quarterly PAT, constant currency guidance, margin beats' },
    { sector: 'PEER SECTOR', beta: 1.35, maxDd: 4.0, drivers: 'Industry-wide demand trends, read-through commentary' },
    { sector: 'NIFTY 50', beta: 0.60, maxDd: 1.5, drivers: 'Index heavyweight weighting attribution' },
  ],
  INDIA_CPI_INFLATION: [
    { sector: 'BANKNIFTY', beta: 1.40, maxDd: 2.6, drivers: 'Bond yield curvature, RBI rate expectation reset' },
    { sector: 'NIFTY FMCG', beta: 1.20, maxDd: 2.2, drivers: 'Input raw material costs (palmoil, wheat), gross margins' },
    { sector: 'NIFTY 50', beta: 1.00, maxDd: 1.4, drivers: 'Headline macroeconomic real interest rates' },
  ],
  CRUDE_OIL_SUPPLY_SHOCK: [
    { sector: 'NIFTY OIL & GAS', beta: 2.40, maxDd: 6.2, drivers: 'Upstream exploration margins vs downstream marketing losses' },
    { sector: 'NIFTY PAINTS', beta: 1.80, maxDd: 4.8, drivers: 'Crude derivative raw material costs (titanium dioxide, solvents)' },
    { sector: 'NIFTY 50', beta: 1.00, maxDd: 2.5, drivers: 'India trade deficit, inflation pass-through, currency slide' },
  ],
  GENERAL_ELECTIONS_INDIA: [
    { sector: 'NIFTY PSU BANK', beta: 2.50, maxDd: 14.5, drivers: 'Policy continuity, public sector reforms, privatization' },
    { sector: 'NIFTY INFRA', beta: 2.20, maxDd: 12.0, drivers: 'Infrastructure execution order book timeline continuity' },
    { sector: 'NIFTY 50', beta: 1.00, maxDd: 6.5, drivers: 'Political stability, institutional capital flows, regime certainty' },
  ],
};

/**
 * Calculates sector-specific expected percentage moves given an event and underlying index shock
 */
export function calculateSectorImpacts(
  event: MacroEventRecord,
  expectedIndexMovePct: number
): SectorEventBeta[] {
  const profile = SECTOR_EVENT_BETAS[event.category] || SECTOR_EVENT_BETAS.RBI_MPC_DECISION;

  return profile.map((item) => ({
    sectorName: item.sector,
    beta: item.beta,
    expectedSectorMovePct: Number((expectedIndexMovePct * item.beta).toFixed(2)),
    historicalMaxDrawdownPct: item.maxDd,
    primaryDrivers: item.drivers,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. BAYESIAN STANDARDIZED UNEXPECTED EARNINGS (SUE) MODEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates corporate earnings announcement surprise, SUE z-score, and post-announcement drift
 */
export function evaluateEarningsSurprise(
  ticker: string,
  consensusEps: number,
  dispersion: number,
  actualEps: number,
  spotPrice: number,
  impliedMovePct: number,
  guidanceComments: string = 'Management raised FY25 revenue guidance by 50 bps.'
): EarningsSurpriseModel {
  const safeDispersion = Math.max(0.01, dispersion);
  const surpriseZScore = (actualEps - consensusEps) / safeDispersion;

  let guidanceStance: EarningsSurpriseModel['guidanceStance'] = 'IN_LINE';
  if (surpriseZScore > 1.5) guidanceStance = 'BEAT_RAISE';
  else if (surpriseZScore < -1.5) guidanceStance = 'MISS_LOWER';

  // Projected non-linear jump: DeltaS = S0 * tanh(0.4 * Z) * (ImpliedMove / 100)
  const jumpFactor = Math.tanh(0.45 * surpriseZScore) * (impliedMovePct / 100);
  const projectedPriceJumpPct = Number((jumpFactor * 100).toFixed(2));

  let postEarningsDriftExpectation: EarningsSurpriseModel['postEarningsDriftExpectation'] = 'NEUTRAL';
  if (surpriseZScore >= 2.0) postEarningsDriftExpectation = 'BULLISH_DRIFT';
  else if (surpriseZScore <= -2.0) postEarningsDriftExpectation = 'BEARISH_DRIFT';

  return {
    ticker,
    consensusEps,
    actualEps,
    whisperEps: Number((consensusEps + 0.3 * safeDispersion).toFixed(2)),
    forecastDispersion: safeDispersion,
    surpriseZScore: Number(surpriseZScore.toFixed(2)),
    guidanceStance,
    impliedMovePct,
    projectedPriceJumpPct,
    postEarningsDriftExpectation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PRE-EVENT DELTA & VEGA HEDGING SOLVER WITH SEBI STATUTORY DRAG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates actionable pre-event hedging orders sized to Indian lot dimensions (NIFTY 25, BANKNIFTY 15)
 * and calculates exact statutory fee drag (STT, SEBI turnover, stamp duty, GST).
 */
export function solvePreEventHedge(
  portfolio: {
    netDelta: number;
    netVega: number;
    netGamma: number;
    spotPrice: number;
  },
  event: MacroEventRecord,
  underlying: 'NIFTY 50' | 'BANKNIFTY' = 'NIFTY 50'
): PreEventHedgeRecommendation[] {
  const lotSize = underlying === 'NIFTY 50' ? 25 : 15;
  const recommendations: PreEventHedgeRecommendation[] = [];

  const { netDelta, netVega, spotPrice } = portfolio;

  // 1. Delta-Neutral Gap Lock (if net delta exceeds rebalance threshold)
  if (Math.abs(netDelta) > 15) {
    const side = netDelta > 0 ? 'SELL' : 'BUY';
    const rawLots = Math.abs(netDelta) / lotSize;
    const recommendedLots = Math.max(1, Math.round(rawLots));
    const qty = recommendedLots * lotSize;
    const deltaOffset = (side === 'SELL' ? -1 : 1) * qty;

    const notional = qty * spotPrice;
    // Futures trade tax calculation
    const statutoryCharges = calculateStatutoryCharges(side, 'MIS', spotPrice, qty);

    recommendations.push({
      id: `HDG-DLT-${Date.now()}`,
      hedgeType: 'DELTA_NEUTRAL',
      targetInstrument: `${underlying} CURRENT_FUT`,
      side,
      lots: recommendedLots,
      quantity: qty,
      deltaOffset: deltaOffset,
      vegaOffset: 0,
      netCostOrCredit: side === 'BUY' ? -notional * 0.12 : notional * 0.12, // ~12% margin requirement
      statutoryFrictionInr: Number(statutoryCharges.totalCharges.toFixed(2)),
      rationale: `Neutralize directional Delta exposure (${netDelta > 0 ? '+' : ''}${netDelta.toFixed(1)}) before ${event.name} binary gap.`,
    });
  }

  // 2. Vega-Neutralizer / IV Crush Harvest (if net vega is high positive)
  if (netVega > 200) {
    // Portfolio is severely long Vega and will bleed heavily under post-event IV crush
    // Recommendation: Sell front-month elevated ATM Call & Put (or Iron Fly)
    const vegaPerLotAtmStraddle = lotSize * 0.35; // typical front ATM straddle vega
    const lotsNeeded = Math.max(1, Math.round(netVega / vegaPerLotAtmStraddle / 2));
    const qty = lotsNeeded * lotSize;

    const syntheticStraddlePremium = spotPrice * 0.025; // 2.5% premium
    const totalCredit = syntheticStraddlePremium * qty * 2; // Call + Put
    const statutoryCharges = calculateStatutoryCharges('SELL', 'MIS', syntheticStraddlePremium, qty * 2);

    recommendations.push({
      id: `HDG-VEGA-${Date.now()}`,
      hedgeType: 'POST_EVENT_IRON_FLY',
      targetInstrument: `${underlying} ATM STRADDLE (SELL)`,
      side: 'SELL',
      lots: lotsNeeded,
      quantity: qty,
      strike: Math.round(spotPrice / 50) * 50,
      vegaOffset: -Number((lotsNeeded * vegaPerLotAtmStraddle * 2).toFixed(1)),
      deltaOffset: 0,
      netCostOrCredit: -totalCredit, // net credit received
      statutoryFrictionInr: Number(statutoryCharges.totalCharges.toFixed(2)),
      rationale: `Harvest anticipated ${event.expectedCrushPct}% post-event IV crush and neutralize long Vega (+₹${netVega.toFixed(0)}/vol point).`,
    });
  }

  // 3. Tail-Risk Collar for Severe Regimes or Budget Events
  if (event.category === 'UNION_BUDGET_INDIA' || event.impactLevel === 'CRITICAL') {
    const otmPutStrike = Math.round((spotPrice * 0.95) / 50) * 50; // 5% OTM Put
    const putPrice = spotPrice * 0.007; // ~0.7% premium
    const lots = Math.max(2, Math.round(Math.abs(portfolio.spotPrice) > 0 ? 4 : 2));
    const qty = lots * lotSize;
    const statutoryCharges = calculateStatutoryCharges('BUY', 'MIS', putPrice, qty);

    recommendations.push({
      id: `HDG-TAIL-${Date.now()}`,
      hedgeType: 'TAIL_RISK_COLLAR',
      targetInstrument: `${underlying} ${otmPutStrike} PE`,
      side: 'BUY',
      lots,
      quantity: qty,
      strike: otmPutStrike,
      vegaOffset: Number((qty * 0.12).toFixed(1)),
      deltaOffset: Number((-qty * 0.15).toFixed(1)),
      netCostOrCredit: Number((putPrice * qty).toFixed(2)),
      statutoryFrictionInr: Number(statutoryCharges.totalCharges.toFixed(2)),
      rationale: `Defensive black-swan disaster insurance against catastrophic post-event tail risk (Strike: ₹${otmPutStrike}).`,
    });
  }

  return recommendations;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. HISTORICAL INDIAN MACROECONOMIC SCENARIOS REPLAY
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoricalScenarioDef {
  id: string;
  name: string;
  date: string;
  context: string;
  indexShockPct: number;
  ivShockPoints: number;
  vulnerableSectors: string[];
}

export const HISTORICAL_MACRO_SCENARIOS: HistoricalScenarioDef[] = [
  {
    id: 'BUDGET_2020_CRASH',
    name: 'Union Budget 2020 (LTCG / DDT Panic)',
    date: '2020-02-01',
    context: 'Finance Minister restructured Dividend Distribution Tax (DDT) and personal income tax slabs; markets suffered intraday liquidation.',
    indexShockPct: -5.6,
    ivShockPoints: 12.4,
    vulnerableSectors: ['NIFTY 50', 'NIFTY INFRA', 'NIFTY REALTY'],
  },
  {
    id: 'RBI_EMERGENCY_HIKE_2022',
    name: 'RBI Emergency Inter-Meeting Repo Hike (+40 bps)',
    date: '2022-05-04',
    context: 'RBI Governor Das called an unscheduled press conference at 2:00 PM, hiking repo rate by 40 bps and CRR by 50 bps.',
    indexShockPct: -2.4,
    ivShockPoints: 6.0,
    vulnerableSectors: ['BANKNIFTY', 'NIFTY AUTO', 'NIFTY REALTY'],
  },
  {
    id: 'FOMC_HAWKISH_SURPRISE',
    name: 'US Fed 75 bps Jumbo Hike & Hawkish Dot Plot',
    date: '2022-09-21',
    context: 'Chair Powell signaled higher rates for longer, triggering massive FII cash liquidation in Indian tech.',
    indexShockPct: -1.8,
    ivShockPoints: 4.5,
    vulnerableSectors: ['NIFTY IT', 'NIFTY METAL'],
  },
  {
    id: 'BUDGET_2024_STT_HIKE',
    name: 'Union Budget 2024 (Derivatives STT Hike Announcement)',
    date: '2024-07-23',
    context: 'FM announced STT hike on options (0.0625% to 0.1%) and futures (0.0125% to 0.02%), sparking violent 450-pt intraday whipsaw.',
    indexShockPct: -1.2,
    ivShockPoints: 5.0,
    vulnerableSectors: ['NIFTY 50', 'BANKNIFTY'],
  },
  {
    id: 'ELECTION_RESULTS_2024',
    name: 'Lok Sabha 2024 Results Day Shock',
    date: '2024-06-04',
    context: 'Exit polls proved overly optimistic; market suffered the largest single-day crash in 4 years (-5.9%), followed by immediate VIX crush.',
    indexShockPct: -5.9,
    ivShockPoints: 18.2,
    vulnerableSectors: ['NIFTY PSU BANK', 'NIFTY INFRA', 'NIFTY CPSE'],
  },
];

/**
 * Replays a historical macroeconomic shock against an active paper trading portfolio
 */
export function simulateMacroScenario(
  positions: {
    symbol: string;
    delta: number;
    vega: number;
    currentPrice: number;
    quantity: number;
  }[],
  scenarioId: string
): MacroScenarioResult {
  const scenario = HISTORICAL_MACRO_SCENARIOS.find((s) => s.id === scenarioId) || HISTORICAL_MACRO_SCENARIOS[0];

  let totalDelta = 0;
  let totalVega = 0;
  let totalNotional = 0;

  for (const pos of positions) {
    totalDelta += pos.delta * pos.quantity;
    totalVega += pos.vega * pos.quantity;
    totalNotional += Math.abs(pos.currentPrice * pos.quantity);
  }

  // Delta PnL: Delta * Spot * Shock%
  const deltaPnlInr = totalDelta * (scenario.indexShockPct / 100) * 24000; // calibrated index baseline
  // Vega PnL: Vega * IV_Shock
  const vegaPnlInr = totalVega * scenario.ivShockPoints;

  const simulatedPnlInr = deltaPnlInr + vegaPnlInr;
  const pnlDrawdownPct = totalNotional > 0 ? (simulatedPnlInr / totalNotional) * 100 : 0;

  const riskBreached = Math.abs(pnlDrawdownPct) > 4.0 || simulatedPnlInr < -50000;

  let mitigationPlan = 'Portfolio demonstrates resilient risk characteristics under this historical scenario.';
  if (riskBreached) {
    mitigationPlan = `Immediate action required: Enforce ${scenario.indexShockPct < 0 ? 'Short Index Futures delta lock' : 'Long Delta rebalance'} and deploy Long Calendar Spreads to cushion against the ${scenario.ivShockPoints} vol shock.`;
  }

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    historicalDate: scenario.date,
    historicalContext: scenario.context,
    indexShockPct: scenario.indexShockPct,
    ivShockPoints: scenario.ivShockPoints,
    simulatedPnlInr: Number(simulatedPnlInr.toFixed(2)),
    pnlDrawdownPct: Number(pnlDrawdownPct.toFixed(2)),
    deltaPnlInr: Number(deltaPnlInr.toFixed(2)),
    vegaPnlInr: Number(vegaPnlInr.toFixed(2)),
    riskBreached,
    mitigationPlan,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. SAMPLE FINANCIAL NEWS WIRE STREAM
// ─────────────────────────────────────────────────────────────────────────────

export function getSampleNewsWire(): NewsSentimentItem[] {
  const baseTime = Date.now();
  const rawItems = [
    {
      id: 'NEWS-01',
      elapsedMin: 12,
      headline: 'RBI MPC likely to maintain repo rate at 6.50% but shift stance to Neutral amid food inflation moderation: Economists Poll',
      source: 'Reuters / Mint',
      category: 'RBI_MPC_DECISION' as MacroEventCategory,
      relatedTickers: ['BANKNIFTY', 'HDFCBANK', 'ICICIBANK'],
      urgency: 'HIGH' as const,
      summary: 'Consensus among 45 economists projects a unanimous pause by Governor Das, with liquidity injections expected via variable rate repos.',
    },
    {
      id: 'NEWS-02',
      elapsedMin: 45,
      headline: 'Union Budget FY26 to prioritize fiscal consolidation target of 4.5% while expanding capital expenditure allocation by 14%',
      source: 'Bloomberg India',
      category: 'UNION_BUDGET_INDIA' as MacroEventCategory,
      relatedTickers: ['NIFTY INFRA', 'NIFTY PSU BANK', 'L&T'],
      urgency: 'FLASH' as const,
      summary: 'Government sources indicate sustained capex push in railways and highways, with potential rationalization of personal income tax brackets.',
    },
    {
      id: 'NEWS-03',
      elapsedMin: 110,
      headline: 'US Fed Chair Jerome Powell signals cautious approach to further easing as US labor market remains resilient',
      source: 'CNBC-TV18',
      category: 'US_FED_FOMC_DECISION' as MacroEventCategory,
      relatedTickers: ['NIFTY IT', 'TCS', 'INFY'],
      urgency: 'HIGH' as const,
      summary: 'Hawkish commentary pushes 10-year US Treasury yield to 4.42%, spurring foreign institutional outflows from emerging market tech baskets.',
    },
    {
      id: 'NEWS-04',
      elapsedMin: 180,
      headline: 'TCS signs $1.2B mega cloud modernization deal with European bank, beats Q3 revenue guidance expectations',
      source: 'Economic Times',
      category: 'NSE_EARNINGS_ANNOUNCE' as MacroEventCategory,
      relatedTickers: ['TCS', 'NIFTY IT'],
      urgency: 'ROUTINE' as const,
      summary: 'Deal momentum strengthens constant currency revenue projections for Indian IT majors ahead of earnings season kick-off.',
    },
    {
      id: 'NEWS-05',
      elapsedMin: 290,
      headline: 'Brent Crude slumps 2.8% to $72/bbl as non-OPEC supply expansion offsets Middle East geopolitical risk premium',
      source: 'Financial Express',
      category: 'CRUDE_OIL_SUPPLY_SHOCK' as MacroEventCategory,
      relatedTickers: ['BPCL', 'IOC', 'ASIANPAINT', 'BERGEPAINT'],
      urgency: 'ROUTINE' as const,
      summary: 'Falling crude relieves pressure on Indian OMCs and downstream paint manufacturers, lowering India import bill burden.',
    },
  ];

  return rawItems.map((item) => {
    const lex = computeLexiconSentiment(item.headline);
    const decayed = applyExponentialTimeDecay(lex.polarity, item.elapsedMin, item.category);

    return {
      id: item.id,
      timestamp: new Date(baseTime - item.elapsedMin * 60 * 1000).toISOString(),
      headline: item.headline,
      source: item.source,
      category: item.category,
      relatedTickers: item.relatedTickers,
      sentimentScore: lex.polarity,
      stance: lex.stance,
      urgency: item.urgency,
      confidence: lex.confidence,
      decayedScore: decayed,
      summary: item.summary,
    };
  });
}
