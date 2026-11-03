/**
 * TradeCraft AI - Statistical Arbitrage & Cointegration Pairs Trading Engine
 * Type Definitions & Contracts (Sprint 16 - BRD-016)
 */

export interface PairDefinition {
  id: string;
  name: string;
  assetY: string; // Dependent asset
  assetX: string; // Independent asset
  sector: string;
  lotSizeY: number;
  lotSizeX: number;
  description: string;
}

export interface OLSRegressionResult {
  alpha: number; // Intercept
  beta: number;  // Static hedge ratio
  rSquared: number;
  stdError: number;
  residuals: number[];
}

export interface ADFTestResult {
  testStatistic: number; // Tau t-ratio
  criticalValue95: number; // -2.86 standard
  criticalValue99: number; // -3.43 standard
  pValue: number;
  isStationary: boolean;
  isCointegrated: boolean;
  confidenceLevel: '99%' | '95%' | '90%' | 'NONE';
}

export interface OrnsteinUhlenbeckResult {
  theta: number; // Rate of mean reversion
  halfLife: number; // In bars
  mu: number; // Equilibrium spread level
  sigma: number; // Diffusion volatility
  isMeanReverting: boolean;
}

export interface KalmanState {
  alpha: number;
  beta: number; // Dynamic hedge ratio
  covariance: [number, number, number, number]; // 2x2 matrix flattened: [P00, P01, P10, P11]
  innovation: number;
  innovationVariance: number;
  kalmanGain: [number, number];
}

export interface KalmanPoint {
  barIndex: number;
  timestamp?: number;
  priceY: number;
  priceX: number;
  beta: number;
  alpha: number;
  spread: number;
  zScore: number;
}

export type StatArbSignalType =
  | 'LONG_SPREAD'   // z <= -2.0: Buy Y, Sell beta*X
  | 'SHORT_SPREAD'  // z >= +2.0: Sell Y, Buy beta*X
  | 'EXIT'          // |z| <= 0.25: Close positions at mean
  | 'STOP_LOSS'     // |z| >= 3.5: Structural cointegration breakdown
  | 'NO_SIGNAL';

export interface StatArbLeg {
  asset: string;
  side: 'BUY' | 'SELL';
  units: number;
  price: number;
  notional: number;
}

export interface ZScoreSignal {
  zScore: number;
  signalType: StatArbSignalType;
  recommendedAction: string;
  legs: StatArbLeg[];
}

export interface StatutoryHurdleResult {
  roundTripTaxes: number;
  minSpreadReversionPts: number;
  hurdleCleared: boolean;
  netExpectancyINR: number;
}

export interface PairAnalysisSummary {
  pair: PairDefinition;
  ols: OLSRegressionResult;
  adf: ADFTestResult;
  ou: OrnsteinUhlenbeckResult;
  currentBetaOLS: number;
  currentBetaKalman: number;
  currentSpread: number;
  currentZScore: number;
  signal: ZScoreSignal;
  historicalSeries: KalmanPoint[];
  statutoryHurdle: StatutoryHurdleResult;
}
