/**
 * TradeCraft AI — Volume-Synchronized Probability of Toxicity (VPIN)
 * & Informed Trading Microstructure Engine
 * Type Definitions & Data Contracts (Sprint 25)
 *
 * Covers:
 * 1. Volume Bucket & Trade Imbalance structures
 * 2. VPIN Rolling Horizon, Thresholds & Toxicity Regimes
 * 3. Kyle's Lambda (λ) & Price Impact Decomposition
 * 4. Glosten-Milgrom / Huang-Stoll Spread Decomposition
 * 5. Market Maker Defensive Actions & Quote Pull Recommendations
 * 6. Flash Crash Early Warning Radar
 * 7. Bulk Volume Classification (BVC) & Raw Tick processing
 * 8. 1-Click Toxicity Protective Action recommendations
 */

export type VpinTicker = 'NIFTY' | 'BANKNIFTY' | 'RELIANCE' | string;

/**
 * Microstructure Toxicity Regime classification
 */
export type ToxicityRegime =
  | 'LOW_TOXICITY'
  | 'LOW'
  | 'MODERATE'
  | 'ELEVATED'
  | 'CRITICAL_TOXIC_FLOW';

/**
 * Real-time Toxicity Alert state
 */
export type ToxicityAlertState = 'NORMAL' | 'WARNING' | 'DANGER' | 'FLASH_CRASH_ALERT';

/**
 * Raw trade tick representation ingested by the Volume Clock
 */
export interface RawMarketTick {
  id: string;
  timestamp: number; // Unix epoch ms
  timeString: string; // HH:mm:ss.SSS
  price: number;
  volume: number; // Contracts or shares
  bidPrice?: number;
  askPrice?: number;
  bidSize?: number;
  askSize?: number;
  aggressorSide?: 'BUY' | 'SELL' | 'UNKNOWN';
}

/**
 * Result of Bulk Volume Classification (BVC) for a single trade or bar
 */
export interface BvcResult {
  buyVolume: number;
  sellVolume: number;
  buyFraction: number; // [0.0, 1.0]
  sellFraction: number; // [0.0, 1.0]
  standardizedReturn: number; // Z-score = ΔP / σ_ΔP
  cdfValue: number; // Φ(Z)
}

/**
 * Standard Volume Bucket for Volume-Clock calculations
 */
export interface VolumeBucket {
  bucketIndex: number;
  totalVolume: number; // Total bucket volume (equals bucketSize when filled)
  buyVolume: number; // Classified buyer-initiated volume
  sellVolume: number; // Classified seller-initiated volume
  volumeImbalance: number; // Absolute imbalance: |V_b - V_s|
  signedImbalance: number; // Net imbalance: V_b - V_s (positive = buyer dominated)
  vpinValue: number; // Rolling VPIN value at completion of this bucket [0.0, 1.0]
  timestamp: number; // Completion timestamp (Unix epoch ms)
  timeString: string; // HH:mm:ss
  durationMs: number; // Elapsed chronological ms to fill this bucket
  startPrice: number; // First execution price in bucket
  endPrice: number; // Last execution price in bucket
  priceChange: number; // endPrice - startPrice
  vwap: number; // Volume-weighted average price inside this bucket
  highPrice: number; // Bucket high
  lowPrice: number; // Bucket low
  tradeCount: number; // Number of constituent trades
  isFilled: boolean; // Whether bucket reached full volume capacity
}

/**
 * Alternate alias/extended interface for UI component compatibility
 */
export interface VpinVolumeBucket {
  bucketIndex: number;
  timestamp: string;
  volumeTotal: number; // In Lots or Contracts (e.g., 2,500 lots)
  buyVolume: number; // V_tau^B
  sellVolume: number; // V_tau^S
  absoluteImbalance: number; // |V_tau^B - V_tau^S|
  imbalanceRatio: number; // (V_tau^B - V_tau^S) / volumeTotal in [-1.0, +1.0]
  endPrice: number; // Price at close of bucket
  priceChange: number; // Delta P across bucket
  isAggressiveSweep: boolean;
}

/**
 * VPIN Horizon Point for time-series charting
 */
export interface VpinHorizonPoint {
  bucketIndex: number;
  timestamp: string;
  vpinScore: number; // Rolling VPIN [0.000, 1.000]
  thresholdAlert: number; // Standard alert line (e.g., 0.45)
  thresholdCritical: number; // Flash crash danger line (e.g., 0.55)
  regime: ToxicityRegime;
  price: number;
}

/**
 * High-level VPIN summary metrics
 */
export interface VpinSummaryMetrics {
  currentVpin: number; // Current rolling VPIN [0.0, 1.0]
  historicalPercentile: number; // Percentile relative to session/historical distribution [0 - 100%]
  toxicityRegime: ToxicityRegime;
  alertState: ToxicityAlertState;
  rollingWindowBuckets: number; // Number of buckets in rolling window (e.g. 50)
  bucketVolumeSize: number; // Constant volume V per bucket
  totalBucketsCalculated: number;
  meanVpin: number; // Historical mean VPIN
  standardDeviationVpin: number; // Historical standard deviation of VPIN
  zScore: number; // Standard score of current VPIN vs session distribution
  fastVpin?: number; // Shorter-window VPIN (e.g. 15 buckets)
  slowVpin?: number; // Longer-window VPIN (e.g. 100 buckets)
  vpinMomentum: number; // fastVpin - slowVpin
}

/**
 * Kyle's Lambda (λ) Price Impact metrics
 */
export interface KylesLambdaMetrics {
  lambda: number; // Price impact parameter (₹ change per unit of volume imbalance)
  rSquared: number; // R² explanatory power of order flow on price movement [0.0, 1.0]
  permanentImpactPerContract: number; // Permanent price impact in ₹ per contract / lot
  informedVolumeRatio: number; // Estimated fraction of total volume coming from informed traders (α) [0.0, 1.0]
  tStat: number; // Regression t-statistic for significance testing
  standardError: number; // Standard error of λ
  sampleCount: number; // Number of bucket samples in the regression window
  interpretation: string; // Human-readable market microstructure explanation
}

export interface KylesLambdaPoint {
  tradeId: string;
  signedVolume: number; // Lots (positive for buy, negative for sell)
  observedPriceDelta: number; // Delta P in ₹
  predictedPriceDelta: number; // Kyle's Lambda * signedVolume
  permanentImpact: number; // Information component in ₹
  temporaryImpact: number; // Liquidity friction component in ₹
  participantType: 'INFORMED_HFT' | 'RETAIL_FLOW' | 'INSTITUTIONAL_SWEEP' | 'PASSIVE_MM';
  timestamp: string;
}

export interface PriceImpactScenario {
  orderSizeLots: number;
  permanentImpactRupees: number;
  temporaryImpactRupees: number;
  totalSlippageRupees: number;
  totalSlippageBps: number;
  adverseExecutionProbability: number; // 0% to 100%
}

/**
 * Bid-Ask Spread Component Decomposition
 */
export interface SpreadDecompositionMetrics {
  quotedSpread: number; // Current bid-ask spread in ₹
  effectiveSpread: number; // Effective spread in ₹: 2 * |P_trade - MidPrice|
  spreadBps: number; // Spread in basis points: (spread / midPrice) * 10,000
  adverseSelectionComponent: number; // Spread component (₹) compensating for informed toxicity
  adverseSelectionPct: number; // % of effective spread due to adverse selection
  orderProcessingComponent: number; // Spread component (₹) covering clearing, SEBI fees & broker overhead
  orderProcessingPct: number; // % of effective spread due to operational friction
  inventoryRiskComponent: number; // Spread component (₹) covering holding/carrying jump risk
  inventoryRiskPct: number; // % of effective spread due to inventory carrying risk
  realizedSpread: number; // Net revenue earned by passive liquidity providers after adverse selection drift
  realizedSpreadPct: number; // % of effective spread realized as profit
}

export interface SpreadDecomposition {
  quotedSpreadRupees: number;
  quotedSpreadBps: number;
  adverseSelectionPct: number; // Glosten-Milgrom informed trader risk (e.g., 58%)
  adverseSelectionRupees: number;
  inventoryHoldingPct: number; // Ho-Stoll inventory risk (e.g., 24%)
  inventoryHoldingRupees: number;
  orderProcessingPct: number; // Exchange fees, clearing, STT, profit (e.g., 18%)
  orderProcessingRupees: number;
}

/**
 * Market Maker Defensive Widening & Liquidity Provision parameters
 */
export interface MarketMakerDefensiveParameters {
  wideningMultiplier: number; // Dynamic spread multiplier (e.g. 1.0x - 4.5x)
  recommendedBidSpreadTicks: number; // Recommended bid distance from mid in ticks
  recommendedAskSpreadTicks: number; // Recommended ask distance from mid in ticks
  recommendedTotalSpreadInr: number; // Widened quote spread in ₹
  quoteSizeReductionPct: number; // % reduction in passive quote display size (0% - 100%)
  recommendedQuoteSize: number; // Scaled contracts per level
  skewBiasTicks: number; // Directional skew in ticks (e.g. +2 ticks if sell toxic, backing off bids)
  passiveQuoteSafetyStatus: 'SAFE_TO_QUOTE' | 'DEFENSIVE_WIDTH' | 'SHADOW_QUOTING' | 'CANCEL_ALL_QUOTES';
  liquidityFadeWarning: boolean; // True if market makers are pulling book depth
}

/**
 * Flash Crash Early Warning Indicator
 */
export interface FlashCrashWarningIndicator {
  isFlashCrashWarningActive: boolean;
  severityLevel: 'NONE' | 'ELEVATED' | 'HIGH' | 'CRITICAL_IMMINENT';
  crashProbabilityScore: number; // 0 - 100%
  triggers: string[]; // List of fired conditions
  estimatedLiquidityEvaporationMs: number; // Projected time before book depth collapses
  projectedCascadePoints: number; // Downside price vacuum in index / stock points
  recommendedHedgingUrgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE_ACTION_REQUIRED';
}

export interface FlashCrashRadarMetrics {
  compositeToxicityScore: number; // 0 - 100
  cancelToFillRatio: number; // e.g. 34.2:1 (high indicates phantom liquidity)
  bookDepletionVelocityPct: number; // % depth vaporized per sec
  quoteFadeLatencyMs: number; // ms taken by MMs to retreat quotes
  earlyWarningStatus: 'NORMAL' | 'ELEVATED_RISK' | 'IMMINENT_CRASH_WARNING';
  recommendedQuoteAction: 'NORMAL_SPREAD' | 'WIDEN_DEFENSIVE' | 'EMERGENCY_PULL_QUOTES';
}

/**
 * Defensive actions for hedgers and MMs
 */
export interface DefensiveHedgerAction {
  id: string;
  timestamp: string;
  actionType: 'WIDEN_SPREADS' | 'PULL_BIDS' | 'CANCEL_ALL_RESTING' | 'DELTA_IMMUNIZING_HEDGE';
  multiplier: number;
  hedgeContracts: number;
  status: 'PENDING' | 'EXECUTED' | 'ACTIVE';
  details: string;
}

/**
 * 1-Click Toxicity Protective Action recommendation types
 */
export type ToxicityProtectiveActionType =
  | 'WIDEN_QUOTES_DEFENSIVELY'
  | 'CANCEL_PASSIVE_BIDS'
  | 'CANCEL_PASSIVE_ASKS'
  | 'ASYMMETRIC_SKEW_AWAY'
  | 'HALT_MARKET_MAKING'
  | 'SWITCH_TO_PEGGED_DARK_CROSS'
  | 'TIGHTEN_INVENTORY_LIMITS'
  | 'TAKE_VOLATILITY_BREAKOUT';

/**
 * 1-Click Toxicity Protective Action Recommendation
 */
export interface ToxicityProtectiveAction {
  actionId: string;
  actionType: ToxicityProtectiveActionType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  subtitle: string;
  rationale: string;
  expectedLossAvoidanceInr: number; // Estimated savings by dodging toxic fill
  recommendedAtTime: string;
  parameters: {
    recommendedSpreadMultiplier?: number;
    recommendedQuoteReductionPct?: number;
    targetInventoryReductionPct?: number;
    cancelSide?: 'BUY' | 'SELL' | 'BOTH';
    pegOffsetTicks?: number;
    stopLossAdjustmentPoints?: number;
  };
  executionPayload: {
    symbol: string;
    command: 'ADJUST_SPREAD' | 'CANCEL_ORDERS' | 'FLATTEN_INVENTORY' | 'UPDATE_RISK_PARAMS';
    side?: 'BUY' | 'SELL' | 'ALL';
    newSpreadMultiplier?: number;
    urgency: 'HIGH' | 'URGENT' | 'IMMEDIATE';
  };
}

/**
 * Full VPIN Microstructure Engine State Snapshot
 */
export interface VpinEngineSnapshot {
  symbol: string;
  timestamp: number;
  lastPrice: number;
  midPrice: number;
  totalVolumeSession: number;
  bucketConfig: {
    bucketSize: number;
    windowSize: number;
  };
  currentBucketProgress: {
    accumulatedVolume: number;
    fillPercentage: number;
    partialBuyVolume: number;
    partialSellVolume: number;
  };
  completedBuckets: VolumeBucket[];
  vpinMetrics: VpinSummaryMetrics;
  kylesLambda: KylesLambdaMetrics;
  spreadDecomposition: SpreadDecompositionMetrics;
  marketMakerDefensive: MarketMakerDefensiveParameters;
  flashCrashWarning: FlashCrashWarningIndicator;
  protectiveAction: ToxicityProtectiveAction;
}

/**
 * High-level Summary object matching UI requirements
 */
export interface VpinEngineSummary {
  ticker: VpinTicker;
  spotPrice: number;
  currentVpin: number; // [0.00, 1.00]
  regime: ToxicityRegime;
  toxicityPercentile: number; // 0 - 100
  kylesLambda: number; // ₹ per Lot price impact
  defensiveSpreadMultiplier: number; // e.g. 1.85x
  bucketSizeLots: number; // Volume per bucket (e.g. 2,000 lots)
  rollingBucketWindow: number; // N buckets (e.g. 30)
  buckets: VpinVolumeBucket[];
  horizonSeries: VpinHorizonPoint[];
  lambdaScatterPoints: KylesLambdaPoint[];
  spreadDecomposition: SpreadDecomposition;
  flashCrashRadar: FlashCrashRadarMetrics;
  defensiveRecommendations: DefensiveHedgerAction[];
}

/**
 * Symbol-specific microstructure preset for Indian markets
 */
export interface MicrostructurePreset {
  symbol: string;
  exchange: 'NSE' | 'BSE';
  instrumentType: 'INDEX_FUT' | 'STOCK_FUT' | 'EQUITY';
  lotSize: number;
  tickSize: number;
  defaultBucketVolume: number; // Recommended volume V for bucket size
  defaultRollingWindow: number; // Recommended bucket count N (typically 50)
  normalVpinRange: [number, number]; // Expected baseline range e.g. [0.15, 0.28]
  toxicThreshold: number; // e.g. 0.45
  description: string;
}
