/**
 * TradeCraft AI — 0-DTE Expiry Pinning & Dealer Gamma Squeeze Risk Engine
 * Type Definitions & Data Contracts (Sprint 24)
 *
 * Covers:
 * 1. Strike chain option metrics with Greeks and Volume
 * 2. Dealer GEX (Gamma Exposure) metrics, Gamma Flip level, and regimes
 * 3. Max Pain calculation, strike payout distribution, and migration direction
 * 4. Terminal strike pinning probability distribution and magnetic attraction
 * 5. 0-DTE intraday non-linear theta decay schedule and post-13:30 IV crush
 * 6. 1-click Pin Risk Hedger recommendations and execution payload
 */

/**
 * Single strike row representing full options chain data for 0-DTE pinning analysis
 */
export interface PinningStrikeOption {
  strike: number;
  callOI: number;       // Call Open Interest (in contracts / shares)
  putOI: number;        // Put Open Interest (in contracts / shares)
  callIV: number;       // Call Implied Volatility (annualized decimal, e.g. 0.14 for 14%)
  putIV: number;        // Put Implied Volatility (annualized decimal, e.g. 0.15 for 15%)
  callGamma: number;    // Call Gamma (dDelta/dSpot)
  putGamma: number;     // Put Gamma (dDelta/dSpot)
  callDelta: number;    // Call Delta (0.0 to 1.0)
  putDelta: number;     // Put Delta (-1.0 to 0.0)
  callVolume: number;   // Cumulative traded contracts
  putVolume: number;    // Cumulative traded contracts
  callPrice?: number;   // Option LTP in ₹
  putPrice?: number;    // Option LTP in ₹
  callVanna?: number;   // dDelta/dVol
  putVanna?: number;    // dDelta/dVol
  callCharm?: number;   // dDelta/dTime (decay of delta per day)
  putCharm?: number;
  strikeCallGex?: number; // Precomputed/cached Call GEX in ₹ Cr / 1% move
  strikePutGex?: number;  // Precomputed/cached Put GEX in ₹ Cr / 1% move
  netStrikeGex?: number;  // Precomputed/cached Net GEX in ₹ Cr / 1% move
  isAtm?: boolean;
  isITMCall?: boolean;
  isITMPut?: boolean;
}

/**
 * Dealer Gamma Exposure (GEX) Market Regime
 * - LONG_GAMMA: Market makers are net long gamma; they buy dips and sell rips, suppressing realized volatility.
 * - SHORT_GAMMA: Market makers are net short gamma; they sell into drops and buy into rallies, accelerating volatility.
 * - NEUTRAL: Net gamma is close to zero; price transitions easily.
 */
export type GexRegime = 'LONG_GAMMA' | 'SHORT_GAMMA' | 'NEUTRAL';

/**
 * Gamma squeeze vulnerability rating
 */
export type GammaSqueezeVulnerability = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

/**
 * Per-strike GEX breakdown in Crores per 1% underlying movement
 */
export interface StrikeGexDetail {
  strike: number;
  strikeCallGex: number; // ₹ Cr / 1%
  strikePutGex: number;  // ₹ Cr / 1%
  netStrikeGex: number;  // ₹ Cr / 1% (strikeCallGex - strikePutGex)
  callOiPct: number;     // Percentage of total call OI
  putOiPct: number;      // Percentage of total put OI
  straddleOi: number;    // callOI + putOI
}

/**
 * Dealer GEX summary and Gamma Flip level
 */
export interface DealerGEXResult {
  strikeGexList: StrikeGexDetail[];
  totalCallGex: number;              // Total call GEX in ₹ Cr / 1% move
  totalPutGex: number;               // Total put GEX in ₹ Cr / 1% move
  netGex: number;                    // Net GEX in ₹ Cr / 1% move (totalCallGex - totalPutGex)
  gexRegime: GexRegime;              // LONG_GAMMA | SHORT_GAMMA | NEUTRAL
  gammaFlipLevel: number;            // Spot price level where Net GEX equals 0
  distanceToFlipPercent: number;     // ((gammaFlipLevel - spotPrice) / spotPrice) * 100
  distanceToFlipPoints: number;      // gammaFlipLevel - spotPrice
  isSpotAboveFlip: boolean;          // True if spot > gammaFlipLevel
  squeezeVulnerability: GammaSqueezeVulnerability;
  maxCallGexStrike: number;          // Strike acting as ceiling / resistance
  maxPutGexStrike: number;           // Strike acting as floor / support
  absoluteGammaConcentration: number;// % of total gamma concentrated within ±1% of spot
  regimeDescription: string;         // Plain-English market mechanics explanation
}

/**
 * Max Pain migration direction relative to previous reference point
 */
export type PainMigrationDirection = 'UP' | 'DOWN' | 'STABLE';

/**
 * Loss breakdown for a candidate strike if expiry settles at that level
 */
export interface StrikePainDetail {
  strike: number;
  callLossCr: number;   // Total rupee loss borne by call buyers (₹ Cr)
  putLossCr: number;    // Total rupee loss borne by put buyers (₹ Cr)
  totalLossCr: number;  // Combined buyer loss / seller minimum payout (₹ Cr)
}

/**
 * Max Pain calculation result
 */
export interface MaxPainResult {
  currentMaxPainStrike: number;         // Settlement strike minimizing option buyer intrinsic value
  previousMaxPainStrike: number;        // Benchmark strike from morning open or previous interval
  migrationDirection: PainMigrationDirection; // UP | DOWN | STABLE
  totalBuyerLossCr: number;             // Total buyer loss at Max Pain strike in ₹ Cr
  callLossCr: number;                   // Call buyer loss at Max Pain in ₹ Cr
  putLossCr: number;                    // Put buyer loss at Max Pain in ₹ Cr
  strikePainTable: StrikePainDetail[];  // Intrinsic loss curve across strikes
  spotDistancePoints: number;           // currentMaxPainStrike - spotPrice
  spotDistancePercent: number;          // ((currentMaxPainStrike - spotPrice) / spotPrice) * 100
  painRangeLower: number;               // Lower boundary of the pain cluster
  painRangeUpper: number;               // Upper boundary of the pain cluster
  payoutVarianceRatio: number;          // Steepness of the pain well (magnetic pull metric)
}

/**
 * Terminal strike pinning probability and magnetic attraction metrics
 */
export interface TerminalStrikePinning {
  strike: number;
  probabilityPercent: number;       // Probability (0% - 100%) that underlying expires at/near this strike
  pinningMagneticStrength: number;  // 0 - 100 normalized score based on OI concentration & local gamma
  distanceToSpot: number;           // Absolute point distance |strike - spot|
  distancePercent: number;          // ((strike - spot) / spot) * 100
  isAtm: boolean;
  totalOI: number;                  // Combined Call + Put OI
  callOiRatio: number;              // callOI / (callOI + putOI)
  putOiRatio: number;               // putOI / (callOI + putOI)
  gammaWeight: number;              // Normalized local gamma weight
  oiWeight: number;                 // Normalized open interest weight
}

/**
 * Aggregated terminal pinning distribution result
 */
export interface TerminalPinningResult {
  spotPrice: number;
  minutesToExpiry: number;
  strikes: TerminalStrikePinning[];
  mostLikelyPinnedStrike: number;
  pinningProbability: number;       // Probability % of the top pinned strike
  pinningConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  pinningRange: [number, number];   // Expected pinning boundary [lowStrike, highStrike]
  expectedSqueezeZone: boolean;     // True if high short-gamma cluster threatens violent breakout
  topThreeStrikes: Array<{ strike: number; probabilityPercent: number }>;
}

/**
 * Single interval point in the 0-DTE intraday decay schedule
 */
export interface IntradayThetaPoint {
  timeStr: string;                    // Time of day (e.g. "09:15", "11:30", "13:30", "15:15")
  minutesElapsed: number;             // Minutes since 09:15 open (0 to 375)
  minutesRemaining: number;           // Minutes until 15:30 close (375 down to 0)
  fractionOfDayRemaining: number;     // minutesRemaining / 375
  thetaDecayPercent: number;          // Cumulative % of daily theta eroded (0% -> 100%)
  thetaRemainingPercent: number;      // % of daily theta still intact (100% -> 0%)
  gammaAccelerationFactor: number;    // Multiplier of base morning gamma (1.0x -> 8.5x at 15:15)
  ivCrushFactor: number;              // Volatility deflation multiplier (1.00 down to ~0.35)
  effectiveIV: number;                // Base IV * ivCrushFactor
  expectedAtmStraddlePremium: number; // Approximate ATM straddle price in ₹
  callDecayPercent: number;           // Cumulative decay for ATM Call
  putDecayPercent: number;            // Cumulative decay for ATM Put
  decayRatePerHourInr: number;        // Straddle decay speed in ₹/hour
}

/**
 * Full 0-DTE Intraday Theta Decay Schedule & Gamma Acceleration Curves
 */
export interface IntradayThetaSchedule {
  currentMinutesRemaining: number;
  baseIv: number;
  spotPrice: number;
  schedule: IntradayThetaPoint[];
  currentPoint: IntradayThetaPoint;
  post1330CrushActive: boolean;       // True if current time is post 13:30 IST
  gammaExplosionWarning: boolean;     // True if gamma acceleration factor exceeds 3.5x
}

/**
 * Pin risk regime classification
 */
export type PinRiskRegime = 'PIN_RISK_HIGH' | 'GAMMA_EXPLOSION' | 'PIN_SAFE' | 'SHORT_GAMMA_SQUEEZE';

/**
 * Recommended hedging action type
 */
export type PinHedgeAction =
  | 'DELTA_NEUTRAL_HEDGE'
  | 'GAMMA_SQUEEZE_CONVEXITY'
  | 'PIN_STRANGLE_HARVEST'
  | 'LONG_CALENDAR_HEDGE'
  | 'COLLAR_PIN_PROTECT';

/**
 * Individual leg of a 1-click Pin Risk hedge recommendation
 */
export interface PinRiskHedgeLeg {
  id: string;
  strike: number;
  optionType: 'CE' | 'PE' | 'FUT';
  side: 'BUY' | 'SELL';
  lots: number;
  quantity: number;
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  marginRequirement: number;
}

/**
 * Standardized order execution payload for automated 1-click execution
 */
export interface PinRiskExecutionPayload {
  symbol: string;
  orderType: 'MARKET' | 'LIMIT';
  productType: 'MIS' | 'NRML';
  timestamp: string;
  legs: Array<{
    symbol: string;
    strike: number;
    optionType: 'CE' | 'PE' | 'FUT';
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
  }>;
}

/**
 * 1-click Pin Risk Hedger recommendation structure
 */
export interface PinRiskHedgeRecommendation {
  recommendationId: string;
  timestamp: string;
  symbol: string;
  spotPrice: number;
  pinnedStrikeTarget: number;
  pinningProbability: number;
  riskRegime: PinRiskRegime;
  hedgeAction: PinHedgeAction;
  strategyName: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
  legs: PinRiskHedgeLeg[];
  projectedDeltaAfterHedge: number;
  projectedGammaAfterHedge: number;
  totalPremiumInflowOutflow: number; // Positive = debit paid, Negative = credit collected
  netPremiumInr?: number;            // Net credit/debit INR
  totalMarginRequired: number;       // Estimated margin requirement in ₹
  maxProfit: number | string;        // Max profit in ₹ or 'Unlimited'
  maxRisk: number | string;          // Max loss in ₹ or 'Unlimited'
  riskRewardRatio?: string;          // Ratio string e.g. "1 : 2.5"
  breakevenRange: [number, number];  // Lower and upper breakeven spot prices
  executionPayload: PinRiskExecutionPayload;
}

/**
 * High-level engine summary aggregation for direct consumption by React UI components
 */
export interface PinningEngineSummary {
  symbol: string;
  spotPrice: number;
  lotSize: number;
  timestamp: string;
  gex: DealerGEXResult;
  maxPain: MaxPainResult;
  pinning: TerminalPinningResult;
  thetaSchedule: IntradayThetaSchedule;
  hedgeRecommendation: PinRiskHedgeRecommendation;
}

// ==========================================
// Quant Engine Integration & Model Types (Sprint 24)
// ==========================================

export type SupportedPinningTicker = 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY';

export type GammaRegimeType = 'LONG_GAMMA' | 'SHORT_GAMMA' | 'GAMMA_NEUTRAL';

export interface StrikeGexProfile {
  strike: number;
  callOi: number;
  putOi: number;
  callOiChange: number;
  putOiChange: number;
  callGamma: number;
  putGamma: number;
  callGexCr: number;
  putGexCr: number;
  netGexCr: number;
  pinningScore: number;
  totalPainPayoutCr: number;
}

export interface MaxPainDriftPoint {
  time: string;
  maxPainStrike: number;
  spotPrice: number;
  netGexCr: number;
  pcrRatio: number;
}

export interface ExpiryPinningDistribution {
  strike: number;
  probabilityPct: number;
  dealerGammaPullForce: number;
  isCurrentSpot: boolean;
  isMaxPain: boolean;
  isGammaFlip: boolean;
  isHighestPin: boolean;
}

export interface PinRiskHedgeOrderLeg {
  symbol: string;
  strike: number;
  optionType: 'CE' | 'PE' | 'FUT';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  delta: number;
  gamma: number;
  theta: number;
}

export interface PinRiskHedgeOrder {
  id: string;
  name: string;
  ticker: SupportedPinningTicker;
  regime: GammaRegimeType;
  action: 'BUY' | 'SELL';
  targetPinStrike: number;
  expectedPinWinRate: number;
  riskRewardRatio: string;
  netPremium: number;
  rationale: string;
  legs: PinRiskHedgeOrderLeg[];
}

export interface PinningEngineMetrics {
  ticker: SupportedPinningTicker;
  spotPrice: number;
  aggregateNetGexCr: number;
  callGexTotalCr: number;
  putGexTotalCr: number;
  gammaRegime: GammaRegimeType;
  gammaFlipLevel: number;
  currentMaxPainStrike: number;
  openingMaxPainStrike: number;
  maxPainDriftPts: number;
  highestPinningStrike: number;
  pinningProbabilityPct: number;
  magneticPullIndex: number;
  intradayThetaDecayPct: number;
  pcrTotal: number;
  strikesData: StrikeGexProfile[];
  migrationHistory: MaxPainDriftPoint[];
  pinningDistribution: ExpiryPinningDistribution[];
  recommendedHedge: PinRiskHedgeOrder;
}

