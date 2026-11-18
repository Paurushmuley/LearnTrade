/**
 * TradeCraft AI — High-Frequency Market Making & Optimal Avellaneda-Stoikov
 * Inventory Control Engine
 * Type Definitions & Data Contracts (Sprint 26)
 *
 * References:
 * Avellaneda, M., & Stoikov, S. (2008). High-frequency trading in a limit order book.
 * Quantitative Finance, 8(3), 217-224.
 */

export type ASMMTicker = 'NIFTY' | 'BANKNIFTY' | 'RELIANCE';

export type ASMMWorkspaceView = 'quote_ladder' | 'inventory_path' | 'rebalancing_console';

export type BoundaryAlertState = 'OPTIMAL' | 'WARNING_HIGH_INVENTORY' | 'HARD_LIMIT_BREACH';

export type QuoteSkewLean = 'NEUTRAL' | 'ASYMMETRIC_BID_LEAN' | 'ASYMMETRIC_ASK_LEAN';

export interface ASMMParameters {
  gamma: number;      // Risk aversion parameter (γ) e.g. 0.001 - 0.5
  sigma: number;      // Volatility (σ) in ₹ per time unit
  kappa: number;      // Order book liquidity density / Poisson arrival intensity (κ) e.g. 0.1 - 5.0
  timeHorizon: number; // Normalized remaining session time (T - t), [0.05, 1.0]
  maxInventory: number; // Hard boundary limit Q_max (lots or contracts)
  orderArrivalA: number; // Baseline Poisson intensity multiplier A (orders/sec)
}

export interface ASMMTickerConfig {
  symbol: ASMMTicker;
  name: string;
  defaultPrice: number;
  lotSize: number;
  tickSize: number;
  defaultSigma: number;
  defaultGamma: number;
  defaultKappa: number;
  defaultMaxInventory: number;
}

export interface QuoteLevel {
  level: number;
  price: number;
  size: number;
  isASMMQuote: boolean;
  type: 'BID' | 'ASK';
  distanceFromMid: number; // In ₹
  distanceBps: number;     // In bps
}

export interface ASMMQuoteLadder {
  midPrice: number;
  reservationPrice: number;
  optimalSpread: number;      // δ^a + δ^b in ₹
  optimalSpreadBps: number;   // δ^a + δ^b in bps
  optimalAskQuote: number;    // r^a = r + δ^a
  optimalBidQuote: number;    // r^b = r - δ^b
  askSpread: number;          // δ^a in ₹
  bidSpread: number;          // δ^b in ₹
  inventorySkew: number;      // r - s in ₹
  inventorySkewBps: number;   // In bps
  quoteSkewLean: QuoteSkewLean;
  bids: QuoteLevel[];
  asks: QuoteLevel[];
}

export * from './marketMaking';

export interface SimulationStep {
  stepIndex: number;
  timestamp: string;
  midPrice: number;
  reservationPrice: number;
  inventory: number;           // q lots [-Q_max, +Q_max]
  inventoryUtilizationPct: number; // |q| / Q_max * 100
  optimalAsk: number;
  optimalBid: number;
  event: 'NO_FILL' | 'BID_FILLED' | 'ASK_FILLED' | 'DOUBLE_FILL' | 'INVENTORY_REBALANCED';
  tradedQty: number;
  tradedPrice: number;
  spreadCapturePnL: number;    // Cumulative spread earned from fills
  inventoryDepreciationPnL: number; // Mark-to-market depreciation/drift
  totalPnL: number;            // Net PnL = Spread Capture + Inventory Depreciation
  boundaryState: BoundaryAlertState;
}

export interface PnLAttributionSummary {
  spreadCapturePnL: number;
  inventoryDepreciationPnL: number;
  exchangeFees: number;
  netCumulativePnL: number;
  totalFills: number;
  buyFills: number;
  sellFills: number;
  maxInventoryReached: number;
  minInventoryReached: number;
  sharpeRatio: number;
}

export interface ASMMActionFeedback {
  id: string;
  timestamp: string;
  action: 'FLATTEN' | 'SKEW_LIQUIDATE' | 'WIDEN_DEFENSIVE' | 'RESET';
  title: string;
  description: string;
  impact: string;
}
