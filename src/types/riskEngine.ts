export type SpanVolShift = -4 | 0 | 4; // percentage vol shift: -4%, 0%, +4%

export type SpanPriceSigma = -3 | -2 | -1 | 0 | 1 | 2 | 3; // sigma price shifts

export interface SpanScenarioCell {
  scenarioNumber: number;
  priceSigma: SpanPriceSigma;
  priceShiftPercent: number;
  volShiftPercent: SpanVolShift;
  portfolioPnL: number;
  isExtremeMove: boolean;
  weightPercent: number; // 100% or 35% for extreme moves
  effectiveRiskLoss: number; // loss amount accounted in SPAN requirement
  description: string;
}

export interface SpanRiskArraySummary {
  maxScanningLoss: number;
  worstScenarioNumber: number;
  worstScenarioDescription: string;
  bestScenarioNumber: number;
  bestScenarioPnL: number;
  basePnL: number;
  interMonthSpreadCharge: number;
  deliveryCharge: number;
  totalSpanRequirement: number;
  exposureMarginRequirement: number;
  totalInitialMargin: number;
  matrix: SpanScenarioCell[][]; // rows: Vol shifts (-4, 0, +4), cols: Sigma (-3 to +3)
  scenarios16: SpanScenarioCell[]; // standard 16 CME/NSE SPAN scenarios
}

export type LeverageThrottleTier = 'OPTIMAL' | 'MODERATE' | 'CAUTION' | 'THROTTLED' | 'BREACHED';

export interface MarginGatekeeperStatus {
  availableCash: number;
  totalPortfolioValue: number;
  usedSpanMargin: number;
  exposureMargin: number;
  totalMarginRequirement: number;
  freeMargin: number;
  utilizationRate: number; // percentage (0 - 150%)
  throttleTier: LeverageThrottleTier;
  maxLeverageAllowed: number; // e.g. 5x
  currentEffectiveLeverage: number;
  throttleWarning?: string;
}

export interface GatekeeperOrderCheck {
  symbol: string;
  side: 'BUY' | 'SELL';
  product: 'MIS' | 'CNC' | 'NRML';
  quantity: number;
  price: number;
  estimatedSpanDelta: number;
  estimatedExposureDelta: number;
  totalDeltaMargin: number;
  postTradeUtilization: number;
  postTradeFreeMargin: number;
  verdict: 'PASS' | 'WARNING' | 'BLOCKED';
  reasons: string[];
  suggestedMaxQuantity?: number;
}

export interface EvtExpectedShortfallMetrics {
  parametricVar99: number; // Gaussian assumption (loss in currency)
  historicalVar99: number;
  evtVar995: number; // Extreme Value Theory VaR at 99.5% confidence
  evtExpectedShortfall99: number; // CVaR 99% (Expected Shortfall)
  fatTailIndexXi: number; // Tail shape parameter xi (GPD)
  tailScaleBeta: number; // Scale parameter
  excessKurtosis: number; // Kurtosis > 3 indicating heavy tails
  tailRiskSeverity: 'LOW' | 'ELEVATED' | 'SEVERE' | 'CRITICAL_FAT_TAIL';
  cvarToVarRatio: number; // Tail heaviness multiplier
  historicalTailShocks: {
    event: string;
    year: string;
    marketMovePercent: number;
    projectedLoss: number;
    description: string;
  }[];
}

export interface CircuitBreakerState {
  indexSymbol: string;
  currentSpot: number;
  previousClose: number;
  dayChangePercent: number;
  stage1ThresholdPercent: number; // -10%
  stage2ThresholdPercent: number; // -15%
  stage3ThresholdPercent: number; // -20%
  distanceToStage1Percent: number;
  currentStatus: 'NORMAL' | 'HALT_STAGE_1' | 'HALT_STAGE_2' | 'MARKET_CLOSED';
  cooldownRemainingSeconds: number;
  assetProximityWarnings: {
    symbol: string;
    currentPrice: number;
    lowerCircuit: number;
    upperCircuit: number;
    distanceToLowerBandPercent: number;
    isNearBand: boolean;
  }[];
}

export type DeRiskingMode = 'CUT_LEVERAGE_50' | 'DELTA_NEUTRALIZE' | 'EMERGENCY_UNWIND_100';

export interface UnwindPlanItem {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  currentPrice: number;
  estimatedSlippage: number;
  marginReleased: number;
  reason: string;
}

export interface UnwindPlanSummary {
  mode: DeRiskingMode;
  targetDelta: number;
  currentDelta: number;
  items: UnwindPlanItem[];
  totalMarginReleased: number;
  estimatedTotalSlippage: number;
  estimatedExecutionTimeMs: number;
  newUtilizationRate: number;
}
