/**
 * TradeCraft AI — Algorithmic Execution Almgren-Chriss & Optimal Order Slicing Engine
 * Type Definitions & Mathematical Contracts (Sprint 27)
 *
 * References:
 * 1. Almgren, R., & Chriss, N. (2000). Optimal execution of portfolio transactions.
 *    Journal of Risk, 3, 5-40.
 * 2. Perold, A. F. (1988). The implementation shortfall: Paper versus reality.
 *    Journal of Portfolio Management, 14(3), 4-9.
 */

// ============================================================================
// 1. TICKER & IDENTIFIER UNIONS
// ============================================================================

export type ACTicker = 'NIFTY' | 'BANKNIFTY' | 'RELIANCE';
export type AlmgrenChrissTicker = ACTicker;

export type ACWorkspaceView = 'trajectory' | 'frontier' | 'monitor';

export type OrderSide = 'SELL' | 'BUY';
export type ExecutionSide = OrderSide;

export type ExecutionStrategyType = 'ALMGREN_CHRISS' | 'TWAP' | 'VWAP';

export type SliceExecutionStatus = 'FILLED' | 'EXECUTING' | 'SCHEDULED' | 'PAUSED';
export type ExecutionEngineStatus = 'IDLE' | 'EXECUTING' | 'ACCELERATED' | 'PAUSED' | 'COMPLETED';

/**
 * 1-Click Execution Actions
 */
export type AlmgrenChrissAction =
  | 'EXECUTE_TRAJECTORY'
  | 'ACCELERATE_AGGRESSIVE'
  | 'PAUSE_EXECUTION'
  | 'RESET_SCHEDULE';

// ============================================================================
// 2. CORE QUANTITATIVE MODEL PARAMETERS
// ============================================================================

/**
 * Canonical Almgren-Chriss (2000) Parameter Specification
 */
export interface AlmgrenChrissParams {
  totalShares: number;            // Total shares/contracts X to execute (positive number)
  timeHorizonMin: number;         // Total execution time horizon T in minutes (e.g. 60)
  numIntervals: number;           // Total number of discrete execution slices N (e.g. 12)
  volatility: number;             // Volatility sigma (annualized % or per-minute ₹ volatility)
  riskAversionLambda: number;     // Trader's risk aversion coefficient lambda (lambda >= 0)
  permanentImpactGamma: number;   // Permanent price impact coefficient gamma (₹ / share)
  temporaryImpactEta: number;     // Temporary price impact coefficient eta (₹ / (share/min))
  fixedCostEpsilon: number;       // Fixed execution cost / half-spread epsilon (₹ / share)
  initialPrice: number;           // Initial arrival/decision price S_0 in ₹
  tickSize: number;               // Instrument tick size (e.g. 0.05 for NSE)
  lotSize: number;                // Instrument minimum contract lot size (e.g. 50, 15, 1)
  side?: ExecutionSide;           // 'BUY' | 'SELL' (default 'SELL' for liquidation)
  ticker?: string;                // Instrument symbol (e.g. 'NIFTY')
  startTime?: string;             // Starting market time string (e.g. "09:15")
}

/**
 * UI-friendly parameter structure for component property binding
 */
export interface ACModelParameters {
  ticker: ACTicker;
  orderSide: OrderSide;
  orderSize: number;           // Total quantity X (shares)
  horizonMinutes: number;      // Horizon T (minutes)
  riskAversionLambda: number;  // λ risk aversion parameter
  tempImpactEta: number;       // η temporary impact parameter
  permImpactGamma: number;     // γ permanent impact parameter
  volatilityAnnualPct: number; // σ annualized volatility %
  arrivalPrice: number;        // S₀ benchmark decision price
  numSlices: number;           // Discrete intervals N
}

// ============================================================================
// 3. SCHEDULE STEP & TRAJECTORY STRUCTURES
// ============================================================================

/**
 * A discrete step in an execution schedule (optimal or benchmark)
 */
export interface ExecutionScheduleStep {
  intervalIndex: number;          // 1-based index (1, 2, ..., N)
  timestamp: string;              // Wall clock timestamp (e.g. "09:15", "09:20")
  tradeShares: number;            // n_k: shares sliced to be executed in this interval
  remainingShares: number;        // x_k: shares remaining in inventory after this trade
  tradeRate: number;              // v_k = n_k / tau (shares traded per minute)
  priceBeforeTrade: number;       // S_{k-1}: price prevailing before this slice
  executionPrice: number;         // S_tilde_k: effective fill price after temporary & permanent impact
  permanentImpact: number;        // Cumulative permanent price depression/appreciation (₹)
  temporaryImpact: number;        // Instantaneous temporary liquidity concession (₹)
  expectedCost: number;           // Expected monetary impact cost for this slice (₹)
  varianceRisk: number;           // Step contribution to timing risk variance (₹^2)
}

/**
 * Comparative evaluation metrics for an execution schedule
 */
export interface TrajectoryComparison {
  strategy: 'ALMGREN_CHRISS' | 'TWAP' | 'VWAP';
  totalCost: number;                    // Total expected impact cost E[x] in ₹
  implementationShortfallBps: number;  // Expected cost expressed in basis points of notional
  timingRiskVariance: number;           // Timing risk variance V[x] in ₹^2
  utilityLoss: number;                  // Mean-variance objective U(x) = E[x] + lambda * V[x]
  steps: ExecutionScheduleStep[];       // Ordered schedule of execution steps
}

/**
 * Multi-trajectory chart comparison point (AC vs TWAP vs VWAP)
 */
export interface ACTrajectoryPoint {
  sliceIndex: number;
  timeMin: number;
  timeLabel: string;
  // Holdings x(t) remaining
  acHoldings: number;
  twapHoldings: number;
  vwapHoldings: number;
  // Slice sizes n_j
  acTradeQty: number;
  twapTradeQty: number;
  vwapTradeQty: number;
  // Percentage remaining
  acHoldingsPct: number;
  twapHoldingsPct: number;
  vwapHoldingsPct: number;
}

/**
 * Detailed sliced order monitor row
 */
export interface ACSlicedOrderStep {
  sliceIndex: number;
  scheduledTimeMin: number;
  timeLabel: string;
  targetQty: number;
  executedQty: number;
  remainingQty: number;
  cumulativeQty: number;
  cumulativePct: number;
  benchmarkPrice: number;
  fillPrice: number;
  permanentImpactInr: number;
  temporaryImpactInr: number;
  totalImpactBps: number;
  slippageInr: number;
  status: SliceExecutionStatus;
}

// ============================================================================
// 4. EFFICIENT FRONTIER & METRICS STRIP
// ============================================================================

export interface ACEfficientFrontierPoint {
  lambda: number;
  kappa: number;
  halfLifeMin: number;
  expectedCostInr: number;       // E[x] expected execution cost
  expectedCostBps: number;       // E[x] in bps of order notional
  varianceRisk: number;          // V[x] variance of shortfall
  stdDevRiskInr: number;         // sqrt(V[x]) risk in ₹
  stdDevRiskBps: number;         // sqrt(V[x]) risk in bps
  utilityScore: number;          // U[x] = E[x] + λ * V[x]
  isCurrent?: boolean;
  isTWAP?: boolean;
  isAggressive?: boolean;
}

export interface ACMetricsStripData {
  totalOrderSize: number;
  totalOrderLots: number;
  lotSize: number;
  horizonMinutes: number;
  riskAversionLambda: number;
  kappa: number;
  halfLifeMinutes: number;
  expectedCostInr: number;
  expectedCostBps: number;
  twapCostInr: number;
  twapCostBps: number;
  vwapCostInr: number;
  executionSavingsVsTwapInr: number;
  executionSavingsVsTwapBps: number;
  varianceRiskAC: number;
  varianceRiskTWAP: number;
  stdDevRiskACInr: number;
  stdDevRiskTWAPInr: number;
  riskReductionPct: number;
  permanentImpactInr: number;
  temporaryImpactInr: number;
  orderNotionalInr: number;
  effectiveAvgPrice: number;
}

// ============================================================================
// 5. IMPLEMENTATION SHORTFALL & VOLUME PROFILES
// ============================================================================

export interface VolumeProfileBucket {
  intervalIndex: number;
  timeLabel: string;
  volumeFraction: number;
  cumulativeFraction: number;
  description: string;
}

export interface ActualExecutionFill {
  intervalIndex: number;
  timestamp: string;
  shares: number;
  executionPrice: number;
  benchmarkPrice?: number;
}

export interface ImplementationShortfallDecomposition {
  arrivalPrice: number;
  averageExecutionPrice: number;
  totalShares: number;
  executedShares: number;
  unexecutedShares: number;
  totalNotional: number;
  executedNotional: number;
  totalShortfall: number;
  shortfallBps: number;
  permanentImpactCost: number;
  permanentImpactBps: number;
  temporaryImpactCost: number;
  temporaryImpactBps: number;
  timingRiskCost: number;
  timingRiskBps: number;
  fixedCost: number;
  fixedCostBps: number;
  opportunityCost: number;
  opportunityCostBps: number;
}

// ============================================================================
// 6. INSTRUMENT CONFIGURATIONS & STATE MACHINE
// ============================================================================

export interface ACTickerConfig {
  symbol: ACTicker;
  name: string;
  defaultPrice: number;
  lotSize: number;
  tickSize: number;
  defaultVolatilityAnnualPct: number; // e.g. 14.5%
  defaultTempImpactEta: number;       // ₹/(share^2/min) or relative impact coefficient
  defaultPermImpactGamma: number;     // ₹/share^2
  defaultOrderSize: number;          // shares
  defaultHorizonMin: number;         // minutes
}

export interface TickerExecutionConfig {
  ticker: AlmgrenChrissTicker;
  name: string;
  defaultPrice: number;
  lotSize: number;
  tickSize: number;
  defaultShares: number;
  defaultHorizonMin: number;
  defaultIntervals: number;
  defaultVolatility: number;
  defaultRiskAversionLambda: number;
  defaultPermanentImpactGamma: number;
  defaultTemporaryImpactEta: number;
  defaultFixedCostEpsilon: number;
  side: ExecutionSide;
}

export interface AlmgrenChrissState {
  status: ExecutionEngineStatus;
  params: AlmgrenChrissParams;
  currentInterval: number;
  totalIntervals: number;
  executedShares: number;
  remainingShares: number;
  executedNotional: number;
  averageExecutionPrice: number;
  currentShortfallBps: number;
  isAccelerated: boolean;
  activeStrategy: ExecutionStrategyType;
  lastAction?: AlmgrenChrissAction;
  lastActionTimestamp?: string;
  activityLog: string[];
}

export interface AlmgrenChrissSummary {
  params: AlmgrenChrissParams;
  optimalKappa: number;
  halfLifeMin: number;
  almgrenChrissTrajectory: TrajectoryComparison;
  twapTrajectory: TrajectoryComparison;
  vwapTrajectory: TrajectoryComparison;
  costSavingsVsTwap: number;
  costSavingsVsTwapBps: number;
  riskReductionVsTwapPct: number;
  isDecomposition: ImplementationShortfallDecomposition;
}
