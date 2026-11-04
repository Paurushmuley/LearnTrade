// Sprint 19 — Cross-Exchange Arbitrage & Smart Order Router (SOR) Types
// Models: Indian NBBO (INBBO) Aggregation, Inter-Market Fee Netting (NSE vs BSE),
// Latency Fill Probability Decay, and Atomic Split-Sweep Routing

export type ExchangeVenue = 'NSE' | 'BSE';

export type SORRoutingPolicy =
  | 'BEST_PRICE_NBBO'
  | 'FEE_ADJUSTED_NET_YIELD'
  | 'SPLIT_LIQUIDITY_SWEEP'
  | 'ATOMIC_ARBITRAGE';

export type LeggingBailoutAction = 'NONE' | 'PASSIVE_PEG' | 'AGGRESSIVE_MARKET_SWEEP' | 'CIRCUIT_BREAKER_HALT';

/** Single price rung in an order book */
export interface DepthRung {
  price: number;
  quantity: number;
  orders: number;
}

/** Level-2 order book snapshot for an exchange venue */
export interface VenueOrderBook {
  venue: ExchangeVenue;
  symbol: string;
  timestamp: number; // ms
  bids: DepthRung[];
  asks: DepthRung[];
}

/** Dual-Exchange synchronized Level-2 order book */
export interface DualExchangeDepthSnapshot {
  symbol: string;
  timestamp: number;
  nse: VenueOrderBook;
  bse: VenueOrderBook;
}

/** Indian National Best Bid & Offer (INBBO) */
export interface INBBOQuote {
  symbol: string;
  bestBidPrice: number;
  bestBidVenue: ExchangeVenue;
  bestBidQty: number;
  bestAskPrice: number;
  bestAskVenue: ExchangeVenue;
  bestAskQty: number;
  isCrossed: boolean; // Bid >= Ask across exchanges
  grossCrossedSpread: number; // in ₹
  grossSpreadBps: number;
  inbboTimestamp: number;
}

/** Arbitrage Opportunity between NSE and BSE */
export interface CrossExchangeArbitrageOpp {
  id: string;
  symbol: string;
  timestamp: number;
  buyVenue: ExchangeVenue;
  buyPrice: number;
  buyAvailableQty: number;
  sellVenue: ExchangeVenue;
  sellPrice: number;
  sellAvailableQty: number;
  executableQty: number;
  grossSpreadInr: number;
  grossSpreadBps: number;
  totalStatutoryFrictionInr: number;
  netSpreadBps: number;
  netProfitInr: number;
  isProfitable: boolean; // Net spread >= 1.5 bps hurdle
  jointFillProbability: number; // e.g. 84.5% based on latency
}

/** Execution Latency & Queue Jitter Parameterization */
export interface SORLatencyParams {
  networkTransitMs: number; // RTT / 2 (e.g. 0.8 ms)
  colocationLinkMs: number; // 0.25 ms (BKC to Fort link)
  brokerApiOverheadMs: number; // 1.2 ms
  matchingEngineJitterMs: number; // Random log-normal jitter
  totalLatencyMs: number;
  competingHftIntensity: number; // lambda_sweep (0.05 to 0.40 ms^-1)
  fillProbability: number; // P(Fill | tau) = exp(-lambda * tau)
}

/** Individual child leg order routed by the SOR */
export interface SORChildOrder {
  childId: string;
  venue: ExchangeVenue;
  side: 'BUY' | 'SELL';
  targetPrice: number;
  fillPrice: number;
  requestedQty: number;
  executedQty: number;
  latencyMs: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'BAILED_OUT';
  statutoryChargesInr: number;
}

/** Result of a parent order routed through the SOR */
export interface SORRoutingExecutionResult {
  parentOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  totalRequestedQty: number;
  totalExecutedQty: number;
  routingPolicy: SORRoutingPolicy;
  childOrders: SORChildOrder[];
  effectiveAvgPrice: number;
  singleVenueBenchmarkPrice: number; // Price if routed 100% to NSE
  priceImprovementBps: number;
  totalSavingsInr: number;
  totalStatutoryTaxesInr: number;
  executionDurationMs: number;
  leggingBailoutEngaged: LeggingBailoutAction;
  adverseLeggingCostInr: number;
}

/** Aggregated cross-exchange trading session telemetry */
export interface CrossExchangeSessionTelemetry {
  symbol: string;
  opportunitiesDetected: number;
  profitableCrossedSpreads: number;
  totalSavingsCapturedInr: number;
  averagePriceImprovementBps: number;
  averageExecutionLatencyMs: number;
  circuitBreakerTripped: boolean;
  consecutiveLeggingFailures: number;
}
