/**
 * TradeCraft AI — Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Engine
 * Type Definitions & Mathematical Contracts (Sprint 28)
 *
 * References:
 * 1. Hamilton, J. D. (1989). A new approach to the economic analysis of nonstationary time series
 *    and the business cycle. Econometrica, 57(2), 357-384.
 * 2. Rabiner, L. R. (1989). A tutorial on Hidden Markov Models and selected applications in speech recognition.
 *    Proceedings of the IEEE, 77(2), 257-286.
 * 3. Maillard, S., Roncalli, T., & Teïletche, J. (2010). The properties of equally weighted risk contribution portfolios.
 *    Journal of Portfolio Management, 36(4), 60-70.
 * 4. Spinu, F. (2013). An Algorithm for Computing Risk Parity Weights.
 *    Available at SSRN: https://ssrn.com/abstract=2297272.
 */

// ============================================================================
// 1. REGIME DEFINITIONS & IDENTIFIERS
// ============================================================================

/**
 * Discrete Hidden Markov Model Market Regimes
 * - BULL_TRENDING: Strong upward momentum, low-to-moderate volatility, positive drift (mu > 0, sigma low).
 * - LOW_VOL_CHOP: Range-bound consolidation, mean-reverting, muted returns, low realized vol.
 * - HIGH_VOL_CRISIS: Tail risk events, steep drawdowns, volatility spikes, fat-tailed negative returns (mu << 0, sigma high).
 */
export type MarketRegime = 'BULL_TRENDING' | 'LOW_VOL_CHOP' | 'HIGH_VOL_CRISIS';

/**
 * 1-Click Regime Management Actions
 * - REBALANCE_RISK_PARITY: Re-solves Equal Risk Contribution (ERC) multi-asset weights for current filtered regime.
 * - HEDGE_CRISIS_TAIL: Shifts equity exposure heavily into cash & gold, activates tail-risk delta hedge.
 * - OVERRIDE_REGIME: Overrides automatic HMM detector with user-specified regime.
 * - RESET_STATE: Clears online filter state and resets to prior stationary distribution.
 */
export type RegimeActionType =
  | 'REBALANCE_RISK_PARITY'
  | 'HEDGE_CRISIS_TAIL'
  | 'OVERRIDE_REGIME'
  | 'RESET_STATE';

/**
 * Preset Historical Macro/Market Regimes for Backtesting & Demonstration
 */
export type RegimeHistoricalPreset =
  | 'COVID_2020_CRASH'
  | 'BULL_2021_RUN'
  | 'ELECTION_2024_CHOP'
  | 'LIVE_2026_MARKET';

/**
 * Asset Identifiers for Multi-Asset Risk Parity Allocation
 */
export type RegimeAssetSymbol = 'NIFTY' | 'BANKNIFTY' | 'GOLD' | 'CASH';

// ============================================================================
// 2. QUANTITATIVE MODEL PARAMETERS
// ============================================================================

/**
 * Hidden Markov Model (HMM) Parameters
 * 3-State First-Order Markov Chain with Gaussian Emission Densities
 */
export interface HMMParameters {
  /**
   * 3x3 Transition probability matrix A:
   * A[i][j] = P(State_t = j | State_{t-1} = i)
   * Row sum must equal 1.0.
   * State 0: BULL_TRENDING, State 1: LOW_VOL_CHOP, State 2: HIGH_VOL_CRISIS
   */
  transitionMatrix: number[][];

  /**
   * Emission distribution mean returns (mu_k) for each state [mu_bull, mu_chop, mu_crisis]
   * Expressed as decimal per period (e.g. +0.0012 for +0.12% daily).
   */
  emissionMeans: number[];

  /**
   * Emission distribution standard deviations (sigma_k) for each state [sigma_bull, sigma_chop, sigma_crisis]
   * Expressed as decimal per period (e.g. 0.008 for 0.8% daily). Must be > 0.
   */
  emissionStdDevs: number[];

  /**
   * Initial state probability distribution pi_k [pi_bull, pi_chop, pi_crisis]
   * Sum must equal 1.0.
   */
  initialProbs: number[];

  /**
   * Optional human-readable regime labels matching state indices [0, 1, 2]
   */
  regimeLabels?: MarketRegime[];
}

/**
 * Online Forward Filtered Regime State at time t
 * Computes posterior probabilities: P(S_t = k | returns_{1:t})
 */
export interface FilteredRegimeState {
  timestamp: string;
  bullProb: number;            // Posterior probability for BULL_TRENDING (0.0 to 1.0)
  chopProb: number;            // Posterior probability for LOW_VOL_CHOP (0.0 to 1.0)
  crisisProb: number;          // Posterior probability for HIGH_VOL_CRISIS (0.0 to 1.0)
  dominantRegime: MarketRegime; // Argmax of posterior probabilities
  confidence: number;          // Highest posterior probability (0.33 to 1.0)
  logLikelihood?: number;      // Online forward log-likelihood sum
  shannonEntropy?: number;     // Information entropy in nats/bits (-sum p * log p)
  observationReturn?: number;  // Realized return at this timestamp
}

/**
 * Risk Parity / Equal Risk Contribution (ERC) Allocation Result
 */
export interface RiskParityWeights {
  niftyWeight: number;         // Decimal weight for NIFTY 50 (e.g. 0.40 = 40%)
  bankNiftyWeight: number;     // Decimal weight for BANK NIFTY (e.g. 0.25 = 25%)
  goldWeight: number;          // Decimal weight for Multi-Commodity Sovereign Gold / GOLDBEES (e.g. 0.20 = 20%)
  cashWeight: number;          // Decimal weight for LiquidBees / Cash Collateral (e.g. 0.15 = 15%)
  portfolioExpectedVol: number;// Annualized portfolio volatility (decimal, e.g. 0.112 = 11.2%)
  regimeLabel: string;         // Human-readable regime description
  riskContributions?: {
    nifty: number;
    bankNifty: number;
    gold: number;
    cash: number;
  };
  targetVol?: number;          // Target volatility configured for allocation
  sharpeRatioEstimate?: number;// Estimated portfolio Sharpe ratio under current regime
  grossLeverage?: number;      // Total sum of weights (typically 1.0)
}

/**
 * Viterbi Decoded Path Result (Global Maximum A Posteriori sequence)
 */
export interface ViterbiDecodedPath {
  states: MarketRegime[];      // Optimal state sequence decoded by dynamic programming
  stateIndices: number[];      // [0, 1, 2] state indices
  timestamps: string[];        // Corresponding timeline dates/timestamps
  logLikelihood: number;       // Joint log-likelihood of optimal path log P(S_1:T, Y_1:T)
  regimeChangesCount: number;  // Number of regime transitions in decoded path
}

// ============================================================================
// 3. ASSET & PORTFOLIO SPECIFICATIONS
// ============================================================================

/**
 * Multi-Asset Configuration for Risk Parity Engine
 */
export interface RegimeAssetConfig {
  symbol: RegimeAssetSymbol;
  name: string;
  assetClass: 'EQUITY_INDEX' | 'SECTORAL_INDEX' | 'COMMODITY' | 'CASH_EQUIVALENT';
  baseAnnualVol: number;       // Base annualized volatility
  regimeVolMultiplier: Record<MarketRegime, number>; // Volatility scaler under each regime
  minWeight: number;           // Box constraint: minimum allocation (e.g. 0.0)
  maxWeight: number;           // Box constraint: maximum allocation (e.g. 0.70)
  defaultRiskBudget: Record<MarketRegime, number>; // Risk budget fraction under each regime
  color: string;               // Display hex color for charts/UI
}

/**
 * Covariance & Correlation Matrix Structure
 */
export interface AssetCovarianceMatrix {
  symbols: RegimeAssetSymbol[];
  correlations: number[][];    // 4x4 correlation matrix
  volatilities: number[];      // 4-element annualized volatility vector
  covarianceMatrix: number[][];// 4x4 annualized covariance matrix Sigma
}

/**
 * Historical Data Point for HMM Backtesting & Visualizations
 */
export interface RegimeHistoricalDataPoint {
  date: string;
  niftyReturn: number;         // Daily decimal return (e.g. 0.012 for +1.2%)
  niftyClose: number;          // Index closing level in ₹
  bullProb: number;            // Filtered probability of Bull
  chopProb: number;            // Filtered probability of Chop
  crisisProb: number;          // Filtered probability of Crisis
  dominantRegime: MarketRegime;
  viterbiRegime: MarketRegime; // Globally decoded Viterbi state
  riskParityWeights: {
    nifty: number;
    bankNifty: number;
    gold: number;
    cash: number;
  };
  portfolioVol: number;
}

// ============================================================================
// 4. ACTIONS & ENGINE SUMMARY CONTRACTS
// ============================================================================

/**
 * Payload for 1-Click Regime Action Execution
 */
export interface RegimeActionPayload {
  action: RegimeActionType;
  targetVol?: number;          // Desired target annualized volatility (e.g. 0.12)
  overrideRegime?: MarketRegime; // Required when action is 'OVERRIDE_REGIME'
  customNotes?: string;
}

/**
 * Result of executing a 1-Click Regime Action
 */
export interface RegimeActionResult {
  success: boolean;
  action: RegimeActionType;
  timestamp: string;
  previousRegime: MarketRegime;
  activeRegime: MarketRegime;
  updatedWeights: RiskParityWeights;
  message: string;
  executionShortfallBps?: number;
}

/**
 * High-Level Regime Engine Summary Contract for UI Cockpit / Modals
 */
export interface RegimeEngineSummary {
  activePreset: RegimeHistoricalPreset;
  currentRegime: MarketRegime;
  regimeDisplayName: string;
  confidence: number;          // 0.0 - 1.0
  bullProbability: number;     // 0.0 - 1.0
  chopProbability: number;     // 0.0 - 1.0
  crisisProbability: number;   // 0.0 - 1.0
  entropy: number;             // Shannon entropy (uncertainty metric)
  latestReturn: number;        // Latest observed return
  targetAnnualVol: number;     // Configured target vol (e.g. 0.12)
  portfolioExpectedVol: number;// Realized expected vol with current weights
  weights: RiskParityWeights;
  recommendedAction: RegimeActionType;
  recommendedActionLabel: string;
  transitionAlert: boolean;    // True if regime transitioned within last 3 periods
  historyLength: number;       // Number of observation bars processed
  viterbiPath: MarketRegime[]; // Last decoded sequence
  assets: RegimeAssetConfig[];
}

// ============================================================================
// 5. EXTENDED COCKPIT & WORKSPACE CONTRACTS
// ============================================================================

export type RegimeType = MarketRegime;

export type WorkspaceView = 'radar_markov' | 'historical_ribbon' | 'risk_parity';

export interface RegimeProbabilities {
  bull: number;   // 0.0 - 1.0
  chop: number;   // 0.0 - 1.0
  crisis: number; // 0.0 - 1.0
}

export interface RegimeCharacteristics {
  name: string;
  emoji: string;
  badgeClass: string;
  borderClass: string;
  glowClass: string;
  expectedAnnualReturn: number;
  expectedAnnualVol: number;
  typicalHalfLifeDays: number;
  description: string;
  macroDriver: string;
}

export type MultiAssetKey = 'NIFTY' | 'BANKNIFTY' | 'GOLDBEES' | 'LIQUIDBEES';

export interface MultiAssetMeta {
  key: MultiAssetKey;
  symbol: string;
  name: string;
  assetClass: 'Large-Cap Equity' | 'High-Beta Banking' | 'Commodity Haven' | 'Cash / Sovereign T-Bills';
  color: string;
  accentHex: string;
  annualizedVol: number;
}

export interface MarkovStateTransition {
  fromRegime: RegimeType;
  toRegimes: {
    BULL_TRENDING: number;
    LOW_VOL_CHOP: number;
    HIGH_VOL_CRISIS: number;
  };
  expectedDurationDays: number;
}

export interface ErgodicDistribution {
  bull: number;
  chop: number;
  crisis: number;
  entropy: number;
}

export interface HistoricalRibbonPoint {
  index: number;
  date: string;
  regime: RegimeType;
  nifty: number;       // normalized to 100 base
  bankNifty: number;   // normalized to 100 base
  goldBees: number;    // normalized to 100 base
  liquidBees: number;  // normalized to 100 base
  probBull: number;
  probChop: number;
  probCrisis: number;
  dailyReturnNifty: number;
  marketNote?: string;
}

export interface AssetAllocationItem {
  key: MultiAssetKey;
  symbol: string;
  name: string;
  assetClass: string;
  currentWeight: number; // 0 - 100%
  targetWeight: number;  // 0 - 100%
  marginalRiskContribution: number; // MRC_i
  riskContributionPct: number;      // % of total portfolio risk
  annualVol: number;                // %
  expectedReturn: number;           // %
  color: string;
}

export interface RegimeCockpitMetrics {
  dominantRegime: RegimeType;
  dominantProb: number;
  bullProb: number;
  chopProb: number;
  crisisProb: number;
  persistenceHalfLifeDays: number;
  currentPortfolioVolTarget: number; // % e.g. 12.0%
  realizedVol: number;               // % e.g. 10.4%
  sharpeMetric: number;              // e.g. 2.14
  leverageMultiplier: number;        // e.g. 1.15x
  isOverridden: boolean;
  activeFilterModel: '2-Order Gaussian HMM' | 'Hamilton Filter' | 'Manual Override';
}

export interface RegimeActionLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  badge: string;
  type: 'success' | 'warning' | 'info' | 'danger';
}

