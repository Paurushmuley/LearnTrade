/**
 * TradeCraft AI - Institutional Multi-Asset Cross-Margining & Portfolio VaR Optimization Engine
 * Type Definitions (Sprint 23)
 *
 * Implements:
 * 1. Asset Classes & Cross-Margin Positions (Equity Index, Stock Futures, Commodity Hedges, Currency)
 * 2. Cross-Margin Correlation Matrix & Offset Concession Tiers (SEBI / Clearing Corp Framework)
 * 3. Collateral Asset Types & SEBI Statutory Haircut Schedule (Cash, G-Sec, Liquid MF, SGB, Equities)
 * 4. 50:50 Cash-to-Collateral Regulatory Ratio Compliance Engine
 * 5. Portfolio Historical VaR (99%), Expected Shortfall (CVaR), and Marginal Risk Contribution (MRC)
 * 6. Interactive Cockpit UI Data Types & Bridge Interfaces
 */

export type AssetClass =
  | 'EQUITY_INDEX'     // NIFTY 50, BANKNIFTY, FINNIFTY, MIDCPNIFTY
  | 'STOCK_FUTURES'    // Single Stock Futures (RELIANCE, HDFCBANK, TCS, etc.)
  | 'COMMODITY'        // MCX Crude Oil, Natural Gas, Gold, Silver
  | 'CURRENCY';        // USDINR, EURINR, GBPINR, JPYINR

export type AssetClassType =
  | 'INDEX_DERIVATIVES'
  | 'STOCK_DERIVATIVES'
  | 'COMMODITY_DERIVATIVES'
  | 'CURRENCY_DERIVATIVES';

export type InstrumentType = 'FUT' | 'CE' | 'PE' | 'EQ';

export type PositionDirection = 'LONG' | 'SHORT';

export interface CrossMarginPosition {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  underlying: string;
  instrumentType: InstrumentType;
  quantity: number; // positive for LONG, negative for SHORT
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  notionalValue: number; // Math.abs(quantity) * currentPrice
  delta: number; // directional delta (+1 for long future, -1 for short future, or option delta)
  betaToBenchmark?: number; // e.g. stock beta to Nifty
  isolatedInitialMarginRate: number; // e.g. 0.10 for 10% SPAN requirement
  isolatedExposureMarginRate: number; // e.g. 0.03 for 3% Exposure requirement
  isolatedMarginRequired: number; // isolated total requirement before offset
}

// UI Interactive Position Leg representation
export interface CrossMarginPositionLeg {
  id: string;
  symbol: string;
  assetClass: AssetClassType;
  cluster: string;
  product: 'FUT' | 'OPT' | 'EQ';
  side: 'LONG' | 'SHORT';
  quantity: number;
  lotSize: number;
  marketPrice: number;
  notionalValue: number;
  isolatedMargin: number;
  crossMarginOffset: number;
  effectiveMargin: number;
  betaToNifty: number;
  historicalVol: number;
}

// Cross-Margin Correlation Matrix entry
export interface CrossMarginCorrelationEntry {
  assetClassA: AssetClass;
  symbolA: string;
  assetClassB: AssetClass;
  symbolB: string;
  correlation: number; // -1.0 to +1.0
  lookbackDays: number; // e.g. 252
  pVal?: number;
}

// Cross-Margin Offset Concession Tier definition
export interface CrossMarginOffsetTier {
  tierId: string;
  name: string;
  assetClassA: AssetClass;
  assetClassB: AssetClass;
  symbolsA?: string[]; // e.g. ['NIFTY']
  symbolsB?: string[]; // e.g. ['BANKNIFTY', 'FINNIFTY']
  minCorrelation: number; // minimum correlation threshold (e.g. 0.70)
  offsetConcessionPercent: number; // e.g. 70 for 70% discount on matched spread
  regulatoryBasis: string; // e.g. "SEBI Master Circular on Cross Margining"
  description: string;
}

// Offset match calculation detail
export interface OffsetConcessionPair {
  id: string;
  tierId: string;
  tierName: string;
  primaryPositionId: string;
  primarySymbol: string;
  primaryAssetClass: AssetClass;
  offsetPositionId: string;
  offsetSymbol: string;
  offsetAssetClass: AssetClass;
  matchedNotional: number;
  offsetConcessionPercent: number;
  grossIsolatedMargin: number;
  concessionDiscountAmount: number;
  netHedgedMargin: number;
  rationale: string;
}

// UI Correlation Offset Pair
export interface CorrelationOffsetPair {
  id: string;
  legA: string;
  legB: string;
  assetClassA: string;
  assetClassB: string;
  correlation: number;
  hedgeRatio: number;
  grossIsolatedMargin: number;
  crossMarginedRequirement: number;
  capitalReliefAmount: number;
  capitalReliefPct: number;
  offsetEligibilityPct: number;
  rationale: string;
}

// SEBI Statutory Haircut & Collateral Types
export type CollateralAssetType =
  | 'CASH'
  | 'GSEC'
  | 'LIQUID_MF'
  | 'SGB'
  | 'EQUITY';

export type CollateralCategory = 'CASH' | 'CASH_EQUIVALENT' | 'NON_CASH';

export interface CollateralHaircutScheduleEntry {
  assetType: CollateralAssetType;
  category: CollateralCategory;
  haircutPercent: number; // Cash 0%, G-Sec 2%, Liquid MF 10%, SGB 15%, Equities 20%
  regulatoryAuthority: 'SEBI' | 'RBI';
  description: string;
}

export interface PledgedCollateralItem {
  id: string;
  symbol: string;
  assetType: CollateralAssetType;
  category: CollateralCategory;
  quantity: number;
  marketPrice: number;
  grossValue: number;
  haircutPercent: number;
  postHaircutValue: number;
  pledgeStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  isin?: string;
}

// UI Interactive Collateral Pledge item
export interface CollateralPledgeItem {
  id: string;
  symbol: string;
  name: string;
  category: string;
  isCashEquivalent: boolean;
  units: number;
  unitPrice: number;
  grossValue: number;
  sebiHaircutPct: number;
  postHaircutValue: number;
  pledged: boolean;
}

// 50:50 Cash-to-Collateral regulatory ratio compliance evaluation
export type CashCollateralComplianceStatus =
  | 'HEALTHY'
  | 'MARGIN_CALL'
  | 'CASH_DEFICIT_WARNING'
  | 'CRITICAL_SHORTFALL';

export interface CashCollateralComplianceReport {
  totalMarginRequirement: number;
  minimumCashRequired: number; // 50% of totalMarginRequirement
  maximumNonCashAllowable: number; // 50% of totalMarginRequirement
  availableCashEquivalentMargin: number; // Cash + G-Sec + Liquid MF (post-haircut)
  availableNonCashMargin: number; // Equities + SGB (post-haircut)
  totalAvailableMargin: number; // availableCashEquivalentMargin + availableNonCashMargin
  eligibleNonCashMargin: number; // min(availableNonCashMargin, availableCashEquivalentMargin) per 50:50 rule
  effectiveTotalCollateral: number; // availableCashEquivalentMargin + eligibleNonCashMargin
  cashRatioPercent: number; // (availableCashEquivalentMargin / effectiveTotalCollateral) * 100
  nonCashRatioPercent: number;
  isCompliant5050: boolean;
  cashDeficit: number; // max(0, minimumCashRequired - availableCashEquivalentMargin)
  annualizedPenaltyRatePercent: number; // e.g. 18% p.a.
  dailyDeficitPenaltyEstimate: number; // cashDeficit * (18% / 365)
  collateralUtilizationPercent: number; // (totalMarginRequirement / effectiveTotalCollateral) * 100
  freeCollateralMargin: number; // max(0, effectiveTotalCollateral - totalMarginRequirement)
  status: CashCollateralComplianceStatus;
  breachSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
}

export interface CashCollateral5050Result {
  isCompliant: boolean;
  cashRatioPct: number;
  annualizedPenaltyCharge: number;
  effectiveCollateralUsable: number;
  totalRequiredMargin: number;
  cashEquivalentAvailable: number;
  nonCashCollateralAvailable: number;
  totalPledgedPostHaircut: number;
  allowableNonCashMargin: number;
  cashDeficitOrSurplus: number;
  utilizationPct: number;
}

// Historical Scenario Shock for VaR/CVaR
export interface HistoricalScenarioShock {
  scenarioId: string;
  date: string;
  eventName: string;
  assetReturnsPercent: Record<string, number>; // symbol -> daily return %
  portfolioPnL: number;
  portfolioReturnPercent: number;
}

// Component Risk Allocation (Marginal Risk Contribution & Component VaR)
export interface ComponentRiskAllocation {
  positionId: string;
  symbol: string;
  assetClass: AssetClass;
  notional: number;
  weight: number; // relative notional weight in portfolio
  marginalVaR: number; // dVaR / dw_i
  componentVaR: number; // weight * marginalVaR (additive decomposition)
  percentContribution: number; // (componentVaR / portfolioVaR) * 100%
  expectedShortfallContribution: number;
}

// Portfolio Historical VaR (99%), Expected Shortfall (CVaR)
export interface PortfolioHVaRResult {
  confidenceLevel: number; // 0.99
  horizonDays: number; // 1
  sampleObservations: number;
  portfolioNotional: number;
  historicalVaR99: number; // Rupee loss at 99%
  historicalVaR99Percent: number;
  expectedShortfall99: number; // CVaR (mean loss of worst 1% tail)
  expectedShortfall99Percent: number;
  parametricVaR99: number;
  worstScenarioLoss: number;
  worstScenarioDate: string;
  worstScenarioEvent: string;
  componentRiskAllocations: ComponentRiskAllocation[];
  tailLossScenarios: HistoricalScenarioShock[];
  pnlDistributionBins: {
    binStart: number;
    binEnd: number;
    binMid: number;
    frequency: number;
    isTailLoss: boolean;
  }[];
}

// UI Risk Decomposition Types
export interface PortfolioRiskDecompositionMetrics {
  totalPortfolioValue: number;
  grossIsolatedMargin: number;
  crossMarginedRequirement: number;
  netCapitalRelief: number;
  netCapitalReliefPct: number;
  var99_1Day: number;
  cvar99_ExpectedShortfall: number;
  parametricVaR: number;
  diversificationIndex: number;
}

export interface MarginalRiskContributionItem {
  id: string;
  symbol: string;
  assetClass: string;
  notional: number;
  portfolioWeightPct: number;
  standaloneVaR: number;
  marginalRiskContributionINR: number;
  marginalRiskContributionPct: number;
  diversificationBenefitINR: number;
}

export interface OptimalHedgeRecommendation {
  action: 'BUY' | 'SELL';
  contracts: number;
  instrument: string;
  rationale: string;
  efficiencyScore: number;
  varReductionPct: number;
  marginSavingsINR: number;
  postHedgeVaR99: number;
}

export interface PortfolioRiskDecompositionResult {
  metrics: PortfolioRiskDecompositionMetrics;
  mrcList: MarginalRiskContributionItem[];
  optimalHedge: OptimalHedgeRecommendation;
}

// Cross Margin Calculation Result
export interface CrossMarginResult {
  positions: CrossMarginPosition[];
  isolatedTotalMargin: number;
  crossMarginedTotalMargin: number;
  netMarginSavings: number;
  savingsPercentage: number;
  offsetConcessions: OffsetConcessionPair[];
  unhedgedPositionsMargin: number;
  assetClassBreakdown: Record<
    AssetClass,
    {
      isolated: number;
      crossMargined: number;
      savings: number;
      savingsPercent: number;
      positionCount: number;
    }
  >;
  timestamp: string;
}

// Complete Institutional Audit Bridge Result
export interface InstitutionalCrossMarginAudit {
  auditTimestamp: string;
  crossMargin: CrossMarginResult;
  collateralCompliance: CashCollateralComplianceReport;
  historicalVaR: PortfolioHVaRResult;
  capitalEfficiencyScore: number; // 0 - 100 metric
  overallRiskSummary: string;
}
