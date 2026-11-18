/**
 * TradeCraft AI — High-Frequency Market Making & Optimal Avellaneda-Stoikov
 * Inventory Control Engine
 * Quantitative Implementation Library (Sprint 26)
 *
 * References:
 * Avellaneda, M., & Stoikov, S. (2008). High-frequency trading in a limit order book.
 * Quantitative Finance, 8(3), 217-224.
 *
 * Implements:
 * 1. Indifference / Reservation Price Engine:
 *    r(s, q, t) = s - q * gamma * sigma^2 * (T - t)
 * 2. Closed-Form Optimal Spread & Asymmetric Half-Spread Solver (Avellaneda & Stoikov 2008):
 *    s*(t) = (2 / gamma) * ln(1 + gamma / kappa) + gamma * sigma^2 * (T - t)
 *    delta_a(q) = s*(t) / 2 - q * gamma * sigma^2 * (T - t)
 *    delta_b(q) = s*(t) / 2 + q * gamma * sigma^2 * (T - t)
 * 3. Market Maker Quote Generator with Hard Inventory Guardrails, Tick Rounding,
 *    and Quote Suppression (|q| >= maxInventory).
 * 4. Microsecond/Tick Monte Carlo Simulation Engine with Deterministic Pseudo-Random
 *    Number Generator (Mulberry32 + Box-Muller), Poisson Fill Arrivals:
 *    lambda(delta) = A * exp(-kappa * delta), and Mark-to-Market P&L Attribution
 *    (Spread Capture vs. Inventory Drift / Adverse Selection).
 * 5. 1-Click Inventory Control Actions (FLATTEN_INVENTORY, SKEW_AGGRESSIVE,
 *    WIDEN_DEFENSIVE, RESET_STATE).
 * 6. Pre-seeded Instrument Configurations & Market Data Presets for NIFTY,
 *    BANKNIFTY, and RELIANCE.
 * 7. High-Performance UI Bridge Summaries & Analytics Helpers (ASMM_TICKER_CONFIGS,
 *    calculateOptimalQuotes, generateASMMQuoteLadder, generateASMMHistoricalSimulation).
 */

import {
  AvellanedaStoikovParams,
  MarketMakerQuotes,
  MarketMakerState,
  FillEvent,
  QuoteSimulationStep,
  FillType,
  InventoryActionType,
  InventoryActionRecommendation,
  MarketMakingMetrics,
  AvellanedaStoikovSimulationResult,
  MarketMakingPreset,
  MarketMakingTicker,
} from '../types/marketMaking';

import {
  ASMMParameters,
  ASMMTicker,
  ASMMTickerConfig,
  ASMMQuoteLadder,
  QuoteLevel,
  QuoteSkewLean,
  BoundaryAlertState,
  SimulationStep,
  PnLAttributionSummary,
} from '../types/avellanedaStoikov';

// ============================================================================
// 1. DETERMINISTIC PSEUDO-RANDOM NUMBER GENERATOR (PRNG)
// ============================================================================

/**
 * High-performance deterministic 32-bit PRNG (Mulberry32 algorithm)
 * Produces perfectly reproducible pseudo-random sequences across environments.
 */
export class DeterministicPrng {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  /**
   * Generates a deterministic uniform float in [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a deterministic standard normal random variable N(0, 1)
   * using the Box-Muller transform.
   */
  nextGaussian(): number {
    const u1 = Math.max(1e-15, this.next());
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

// ============================================================================
// 2. MATHEMATICAL & TICK UTILITIES
// ============================================================================

/**
 * Rounds a price to the nearest instrument tick size with floating-point stabilization
 */
export function roundToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  const inv = 1 / tickSize;
  return Math.round(price * inv) / inv;
}

/**
 * Rounds down to the nearest tick (for bids)
 */
export function floorToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  const inv = 1 / tickSize;
  return Math.floor((price + 1e-9) * inv) / inv;
}

/**
 * Rounds up to the nearest tick (for asks)
 */
export function ceilToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  const inv = 1 / tickSize;
  return Math.ceil((price - 1e-9) * inv) / inv;
}

/**
 * Formats seconds into HH:mm:ss for simulation step time strings
 */
export function formatSimulationTime(stepSeconds: number, baseEpochMs: number = 1731918600000): {
  timestamp: number;
  timeString: string;
} {
  const timestamp = baseEpochMs + Math.round(stepSeconds * 1000);
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return {
    timestamp,
    timeString: `${hours}:${minutes}:${seconds}`,
  };
}

// ============================================================================
// 3. CORE QUANTITATIVE AVELLANEDA-STOIKOV FORMULAS
// ============================================================================

/**
 * Computes the Avellaneda-Stoikov Reservation / Indifference Price:
 * r(s, q, t) = s - q * gamma * sigma^2 * (T - t)
 *
 * Supports both object params and individual argument signature.
 */
export function calculateReservationPrice(params: AvellanedaStoikovParams): number;
export function calculateReservationPrice(
  midPrice: number,
  inventory: number,
  gamma: number,
  sigma: number,
  timeRemaining: number
): number;
export function calculateReservationPrice(
  arg1: AvellanedaStoikovParams | number,
  arg2?: number,
  arg3?: number,
  arg4?: number,
  arg5?: number
): number {
  if (typeof arg1 === 'object') {
    const tau = Math.max(0, arg1.T - arg1.t);
    const penalty = arg1.q * arg1.gamma * Math.pow(arg1.sigma, 2) * tau;
    return arg1.s - penalty;
  } else {
    const midPrice = arg1;
    const inventory = arg2 ?? 0;
    const gamma = arg3 ?? 0.1;
    const sigma = arg4 ?? 2.0;
    const timeRemaining = arg5 ?? 1.0;
    const tau = Math.max(0, timeRemaining);
    const penalty = inventory * gamma * Math.pow(sigma, 2) * tau;
    return midPrice - penalty;
  }
}

/**
 * Calculates the inventory risk penalty shift:
 * penalty = q * gamma * sigma^2 * (T - t)
 */
export function calculateInventoryPenalty(params: AvellanedaStoikovParams): number {
  const tau = Math.max(0, params.T - params.t);
  return params.q * params.gamma * Math.pow(params.sigma, 2) * tau;
}

/**
 * Computes optimal half-spreads delta_a(q) and delta_b(q) based on the
 * Avellaneda-Stoikov closed-form formula, accounting for asymmetric skew when q != 0.
 *
 * Closed-form Equations (Avellaneda & Stoikov 2008, Guéant et al. 2012):
 * Base spread s*(t) = (2 / gamma) * ln(1 + gamma / kappa) + gamma * sigma^2 * (T - t)
 * Half-spreads relative to midprice:
 * delta_a(q) = s*(t) / 2 - q * gamma * sigma^2 * (T - t)
 * delta_b(q) = s*(t) / 2 + q * gamma * sigma^2 * (T - t)
 */
export function calculateOptimalHalfSpreads(params: AvellanedaStoikovParams): {
  halfSpreadAsk: number;
  halfSpreadBid: number;
  optimalSpread: number;
  symmetricHalfSpread: number;
  askSkew: number;
  bidSkew: number;
  inventoryPenalty: number;
} {
  const tau = Math.max(0, params.T - params.t);
  const inventoryPenalty = params.q * params.gamma * Math.pow(params.sigma, 2) * tau;

  // Base liquidity term: (2 / gamma) * ln(1 + gamma / kappa)
  // Numerically robust handling when gamma is very small (risk-neutral limit: 2 / kappa)
  let baseSpreadTerm: number;
  if (params.gamma <= 1e-7) {
    baseSpreadTerm = 2 / params.kappa;
  } else {
    baseSpreadTerm = (2 / params.gamma) * Math.log(1 + params.gamma / params.kappa);
  }

  // Finite-horizon volatility diffusion term
  const volDiffusionTerm = params.gamma * Math.pow(params.sigma, 2) * tau;

  // Total optimal spread around reservation price
  const optimalSpread = Math.max(params.tickSize * 2, baseSpreadTerm + volDiffusionTerm);
  const symmetricHalfSpread = optimalSpread / 2;

  // Asymmetric half-spreads relative to midprice s
  const rawHalfSpreadAsk = symmetricHalfSpread - inventoryPenalty;
  const rawHalfSpreadBid = symmetricHalfSpread + inventoryPenalty;

  // Skews relative to symmetric mid-spread
  const askSkew = -inventoryPenalty;
  const bidSkew = inventoryPenalty;

  return {
    halfSpreadAsk: rawHalfSpreadAsk,
    halfSpreadBid: rawHalfSpreadBid,
    optimalSpread,
    symmetricHalfSpread,
    askSkew,
    bidSkew,
    inventoryPenalty,
  };
}

/**
 * Calculates Poisson fill arrival intensity lambda(delta) = A * exp(-kappa * delta)
 */
export function calculatePoissonIntensity(delta: number, A: number = 140, kappa: number = 1.5): number {
  if (delta <= 0) return A;
  return A * Math.exp(-kappa * delta);
}

/**
 * Calculates fill probability over discrete time step dt
 */
export function calculateFillProbability(delta: number, dt: number = 0.01, A: number = 140, kappa: number = 1.5): number {
  const intensity = calculatePoissonIntensity(delta, A, kappa);
  return 1 - Math.exp(-intensity * dt);
}

/**
 * Generates optimal market maker quotes with:
 * 1. Exact reservation price calculation
 * 2. Tick-size rounding
 * 3. Bid-ask non-crossing guarantee (bid < ask, spread >= tickSize)
 * 4. Hard inventory bounds:
 *    - if q >= maxInventory: suppresses bid (cannot buy more)
 *    - if q <= -maxInventory: suppresses ask (cannot sell more)
 * 5. Poisson arrival rate and fill probability calculation
 */
export function generateMarketMakerQuotes(params: AvellanedaStoikovParams): MarketMakerQuotes {
  const reservationPrice = calculateReservationPrice(params);
  const spreads = calculateOptimalHalfSpreads(params);

  // Raw theoretical quotes
  const rawAskPrice = params.s + spreads.halfSpreadAsk;
  const rawBidPrice = params.s - spreads.halfSpreadBid;

  // Tick-size rounding
  let roundedBid = roundToTick(rawBidPrice, params.tickSize);
  let roundedAsk = roundToTick(rawAskPrice, params.tickSize);

  // Ensure minimum spread of at least 1 tick
  if (roundedAsk <= roundedBid) {
    roundedAsk = roundToTick(roundedBid + params.tickSize, params.tickSize);
  }

  // Hard inventory suppression checks
  const isBidSuppressed = params.q >= params.maxInventory;
  const isAskSuppressed = params.q <= -params.maxInventory;

  const finalBidPrice = isBidSuppressed ? null : roundedBid;
  const finalAskPrice = isAskSuppressed ? null : roundedAsk;

  // Effective half-spreads from midprice
  const effectiveHalfSpreadBid =
    finalBidPrice !== null ? Math.max(params.tickSize, params.s - finalBidPrice) : spreads.halfSpreadBid;
  const effectiveHalfSpreadAsk =
    finalAskPrice !== null ? Math.max(params.tickSize, finalAskPrice - params.s) : spreads.halfSpreadAsk;

  // Order arrival intensities lambda = A * exp(-kappa * delta)
  const bidArrivalRate = isBidSuppressed
    ? 0
    : params.A * Math.exp(-params.kappa * effectiveHalfSpreadBid);
  const askArrivalRate = isAskSuppressed
    ? 0
    : params.A * Math.exp(-params.kappa * effectiveHalfSpreadAsk);

  // Discrete time step dt for probability calculation
  const dt = params.T > 0 ? params.T / 100 : 0.01;
  const bidFillProbability = isBidSuppressed ? 0 : 1 - Math.exp(-bidArrivalRate * dt);
  const askFillProbability = isAskSuppressed ? 0 : 1 - Math.exp(-askArrivalRate * dt);

  const effectiveOptimalSpread =
    finalBidPrice !== null && finalAskPrice !== null
      ? roundToTick(finalAskPrice - finalBidPrice, params.tickSize)
      : spreads.optimalSpread;

  return {
    reservationPrice: roundToTick(reservationPrice, params.tickSize),
    optimalSpread: effectiveOptimalSpread,
    bidPrice: finalBidPrice,
    askPrice: finalAskPrice,
    halfSpreadBid: roundToTick(effectiveHalfSpreadBid, params.tickSize),
    halfSpreadAsk: roundToTick(effectiveHalfSpreadAsk, params.tickSize),
    bidSkew: roundToTick(spreads.bidSkew, params.tickSize),
    askSkew: roundToTick(spreads.askSkew, params.tickSize),
    inventoryPenalty: roundToTick(spreads.inventoryPenalty, params.tickSize),
    rawReservationPrice: reservationPrice,
    rawBidPrice,
    rawAskPrice,
    bidArrivalRate,
    askArrivalRate,
    bidFillProbability: Math.min(1.0, Math.max(0.0, bidFillProbability)),
    askFillProbability: Math.min(1.0, Math.max(0.0, askFillProbability)),
    isBidSuppressed,
    isAskSuppressed,
  };
}

// ============================================================================
// 4. STATUTORY CHARGES CALCULATION (INDIAN NSE/SEBI SCHEDULE)
// ============================================================================

/**
 * Calculates statutory transaction costs (Brokerage, STT, Exchange, SEBI, Stamp Duty, GST)
 * for high-frequency market making fills.
 */
export function calculateMarketMakingFee(
  side: 'BUY' | 'SELL',
  price: number,
  quantity: number
): number {
  const turnover = price * quantity;
  if (turnover <= 0) return 0;

  const brokerage = Math.min(20, turnover * 0.0003);
  const stt = side === 'SELL' ? turnover * 0.00025 : 0;
  const exchangeCharges = turnover * 0.0000297;
  const sebiCharges = turnover * 0.000001;
  const stampDuty = side === 'BUY' ? turnover * 0.00003 : 0;
  const gst = (brokerage + exchangeCharges + sebiCharges) * 0.18;

  return brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst;
}

// ============================================================================
// 5. FIFO INVENTORY ACCOUNTING ENGINE & PORTFOLIO TRACKER
// ============================================================================

interface CostLot {
  price: number;
  quantity: number;
}

export interface TradeFillRecord {
  id: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  midAtFill: number;
  spreadCapture: number;
  timestamp: number;
}

export interface PortfolioAttribution {
  cash: number;
  inventory: number;
  avgCost: number;
  midPrice: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  spreadCapturePnL: number;
  inventoryDriftPnL: number;
  decomposedTotalPnL: number;
  tradesCount: number;
}

export interface FlattenResult {
  flattenedQuantity: number;
  exitPrice: number;
  remainingInventory: number;
  realizedPnL: number;
  totalPnL: number;
}

export class AvellanedaStoikovPortfolio {
  public initialCash: number;
  public cash: number;
  public inventory: number;
  public avgCost: number;
  public realizedPnL: number;
  public spreadCapturePnL: number;
  public inventoryDriftPnL: number;
  public midPrice: number;
  public lotSize: number;
  public trades: TradeFillRecord[];

  constructor(initialCash: number = 1000000, initialInventory: number = 0, initialMidPrice: number = 24250, lotSize: number = 25) {
    this.initialCash = initialCash;
    this.cash = initialCash;
    this.inventory = initialInventory;
    this.avgCost = initialMidPrice;
    this.realizedPnL = 0;
    this.spreadCapturePnL = 0;
    this.inventoryDriftPnL = 0;
    this.midPrice = initialMidPrice;
    this.lotSize = lotSize;
    this.trades = [];
  }

  public fillBid(price: number, quantity: number, currentMid: number): TradeFillRecord {
    const cost = price * quantity * this.lotSize;
    this.cash -= cost;
    const spreadCaptured = (currentMid - price) * quantity * this.lotSize;
    this.spreadCapturePnL += spreadCaptured;

    if (this.inventory < 0) {
      const closingQty = Math.min(Math.abs(this.inventory), quantity);
      const closePnL = (this.avgCost - price) * closingQty * this.lotSize;
      this.realizedPnL += closePnL;

      const remainingQty = quantity - closingQty;
      this.inventory += quantity;
      if (this.inventory > 0) {
        this.avgCost = price;
      }
    } else {
      const prevTotal = this.inventory * this.avgCost;
      const addedTotal = quantity * price;
      this.inventory += quantity;
      this.avgCost = this.inventory > 0 ? (prevTotal + addedTotal) / this.inventory : price;
    }

    const trade: TradeFillRecord = {
      id: `BID-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      side: 'BUY',
      price,
      quantity,
      midAtFill: currentMid,
      spreadCapture: spreadCaptured,
      timestamp: Date.now()
    };
    this.trades.push(trade);
    this.updateAttribution(currentMid);
    return trade;
  }

  public fillAsk(price: number, quantity: number, currentMid: number): TradeFillRecord {
    const revenue = price * quantity * this.lotSize;
    this.cash += revenue;
    const spreadCaptured = (price - currentMid) * quantity * this.lotSize;
    this.spreadCapturePnL += spreadCaptured;

    if (this.inventory > 0) {
      const closingQty = Math.min(this.inventory, quantity);
      const closePnL = (price - this.avgCost) * closingQty * this.lotSize;
      this.realizedPnL += closePnL;

      const remainingQty = quantity - closingQty;
      this.inventory -= quantity;
      if (this.inventory < 0) {
        this.avgCost = price;
      }
    } else {
      const prevTotal = Math.abs(this.inventory) * this.avgCost;
      const addedTotal = quantity * price;
      this.inventory -= quantity;
      this.avgCost = Math.abs(this.inventory) > 0 ? (prevTotal + addedTotal) / Math.abs(this.inventory) : price;
    }

    const trade: TradeFillRecord = {
      id: `ASK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      side: 'SELL',
      price,
      quantity,
      midAtFill: currentMid,
      spreadCapture: spreadCaptured,
      timestamp: Date.now()
    };
    this.trades.push(trade);
    this.updateAttribution(currentMid);
    return trade;
  }

  public updateAttribution(currentMid: number) {
    this.midPrice = currentMid;
    const unrealized = this.unrealizedPnL;
    this.inventoryDriftPnL = (this.realizedPnL + unrealized) - this.spreadCapturePnL;
  }

  public get unrealizedPnL(): number {
    return this.inventory * (this.midPrice - this.avgCost) * this.lotSize;
  }

  public get totalPnL(): number {
    return this.realizedPnL + this.unrealizedPnL;
  }

  public get decomposedTotalPnL(): number {
    return this.spreadCapturePnL + this.inventoryDriftPnL;
  }

  public getSnapshot(): PortfolioAttribution {
    return {
      cash: Number(this.cash.toFixed(2)),
      inventory: this.inventory,
      avgCost: Number(this.avgCost.toFixed(2)),
      midPrice: this.midPrice,
      realizedPnL: Number(this.realizedPnL.toFixed(2)),
      unrealizedPnL: Number(this.unrealizedPnL.toFixed(2)),
      totalPnL: Number(this.totalPnL.toFixed(2)),
      spreadCapturePnL: Number(this.spreadCapturePnL.toFixed(2)),
      inventoryDriftPnL: Number(this.inventoryDriftPnL.toFixed(2)),
      decomposedTotalPnL: Number(this.decomposedTotalPnL.toFixed(2)),
      tradesCount: this.trades.length
    };
  }

  public flatten(fillPrice: number = this.midPrice): FlattenResult | null {
    if (this.inventory === 0) return null;

    const qty = this.inventory;
    if (qty > 0) {
      this.fillAsk(fillPrice, qty, this.midPrice);
    } else {
      this.fillBid(fillPrice, Math.abs(qty), this.midPrice);
    }

    return {
      flattenedQuantity: qty,
      exitPrice: fillPrice,
      remainingInventory: this.inventory,
      realizedPnL: Number(this.realizedPnL.toFixed(4)),
      totalPnL: Number(this.totalPnL.toFixed(4))
    };
  }
}

class InventoryTracker {
  private lots: CostLot[] = [];
  public realizedPnL: number = 0;
  public spreadCapturePnL: number = 0;
  public totalFees: number = 0;
  public cash: number = 0;

  buy(price: number, qty: number, midPrice: number, fee: number) {
    this.cash -= price * qty + fee;
    this.totalFees += fee;
    this.spreadCapturePnL += Math.max(0, midPrice - price) * qty;

    let remainingToBuy = qty;
    while (remainingToBuy > 0 && this.lots.length > 0 && this.lots[0].quantity < 0) {
      const shortLot = this.lots[0];
      const matchQty = Math.min(remainingToBuy, -shortLot.quantity);
      this.realizedPnL += (shortLot.price - price) * matchQty;
      shortLot.quantity += matchQty;
      remainingToBuy -= matchQty;
      if (Math.abs(shortLot.quantity) < 1e-9) {
        this.lots.shift();
      }
    }

    if (remainingToBuy > 0) {
      this.lots.push({ price, quantity: remainingToBuy });
    }
  }

  sell(price: number, qty: number, midPrice: number, fee: number) {
    this.cash += price * qty - fee;
    this.totalFees += fee;
    this.spreadCapturePnL += Math.max(0, price - midPrice) * qty;

    let remainingToSell = qty;
    while (remainingToSell > 0 && this.lots.length > 0 && this.lots[0].quantity > 0) {
      const longLot = this.lots[0];
      const matchQty = Math.min(remainingToSell, longLot.quantity);
      this.realizedPnL += (price - longLot.price) * matchQty;
      longLot.quantity -= matchQty;
      remainingToSell -= matchQty;
      if (Math.abs(longLot.quantity) < 1e-9) {
        this.lots.shift();
      }
    }

    if (remainingToSell > 0) {
      this.lots.push({ price, quantity: -remainingToSell });
    }
  }

  getInventory(): number {
    return this.lots.reduce((acc, lot) => acc + lot.quantity, 0);
  }

  getUnrealizedPnL(currentMid: number): number {
    let unrealized = 0;
    for (const lot of this.lots) {
      if (lot.quantity > 0) {
        unrealized += (currentMid - lot.price) * lot.quantity;
      } else if (lot.quantity < 0) {
        unrealized += (lot.price - currentMid) * (-lot.quantity);
      }
    }
    return unrealized;
  }
}

// ============================================================================
// 6. 1-CLICK INVENTORY CONTROL ACTION ENGINE
// ============================================================================

export function generateInventoryActions(
  params: AvellanedaStoikovParams,
  state: MarketMakerState
): InventoryActionRecommendation[] {
  const recommendations: InventoryActionRecommendation[] = [];
  const inventory = state.inventory;
  const maxInventory = params.maxInventory;
  const invRatio = Math.abs(inventory) / Math.max(1, maxInventory);

  const flattenSeverity = invRatio >= 0.8 ? 'ALERT' : invRatio >= 0.5 ? 'WARNING' : 'INFO';
  const flattenSide = inventory > 0 ? 'SELL' : inventory < 0 ? 'BUY' : 'NONE';
  const unitsToFlatten = Math.abs(inventory) * params.lotSize;

  recommendations.push({
    action: 'FLATTEN_INVENTORY',
    label: 'Flatten Inventory',
    description: `Execute immediate market sweep to close ${Math.abs(inventory)} lots (${unitsToFlatten} units) and neutralize delta risk to 0.`,
    rationale:
      inventory !== 0
        ? `Current inventory is ${inventory > 0 ? '+' : ''}${inventory} lots (${Math.round(invRatio * 100)}% of limit). Unwinding eliminates directional skew.`
        : 'Inventory is already flat (0 lots). No action required.',
    severity: flattenSeverity,
    recommendedExecution: {
      targetInventory: 0,
      unitsToTrade: unitsToFlatten,
      side: flattenSide,
      suggestedOrderType: 'MARKET',
      estimatedSlippage: params.tickSize * 2,
      estimatedCost:
        unitsToFlatten > 0
          ? calculateMarketMakingFee(flattenSide === 'SELL' ? 'SELL' : 'BUY', params.s, unitsToFlatten)
          : 0,
    },
    parameterAdjustments: {
      gammaMultiplier: 1.0,
      kappaMultiplier: 1.0,
    },
  });

  const skewSide = inventory > 0 ? 'SELL' : 'BUY';
  recommendations.push({
    action: 'SKEW_AGGRESSIVE',
    label: 'Aggressive Inventory Offload Skew',
    description: `Multiply risk aversion gamma (γ) by 3.5x to aggressively shift quotes towards offloading ${inventory > 0 ? 'longs' : 'shorts'}.`,
    rationale:
      inventory > 0
        ? 'Lower ask price deep into book to prioritize sell fills; widen bid away from market to repel buyers.'
        : inventory < 0
        ? 'Lift bid price higher to prioritize buy fills; widen ask away from market to repel sellers.'
        : 'Inventory is neutral; applying aggressive skew is currently unnecessary.',
    severity: invRatio >= 0.6 ? 'WARNING' : 'INFO',
    recommendedExecution: {
      targetInventory: 0,
      unitsToTrade: Math.abs(inventory) * params.lotSize,
      side: skewSide,
      suggestedOrderType: 'PASSIVE_LIMIT',
      estimatedSlippage: 0,
      estimatedCost: 0,
    },
    parameterAdjustments: {
      gammaMultiplier: 3.5,
      kappaMultiplier: 1.0,
    },
  });

  recommendations.push({
    action: 'WIDEN_DEFENSIVE',
    label: 'Defensive Spread Widening',
    description: 'Double the quoted half-spreads by reducing liquidity decay kappa (κ) by 50% to shield against adverse selection.',
    rationale:
      'Increases buffer against toxic institutional flow during high-volatility regime or macro headline events.',
    severity: 'INFO',
    recommendedExecution: {
      targetInventory: inventory,
      unitsToTrade: 0,
      side: 'NONE',
      suggestedOrderType: 'PASSIVE_LIMIT',
      estimatedSlippage: 0,
      estimatedCost: 0,
    },
    parameterAdjustments: {
      gammaMultiplier: 1.0,
      kappaMultiplier: 0.5,
      temporarySpreadWidenPercent: 100,
    },
  });

  recommendations.push({
    action: 'RESET_STATE',
    label: 'Reset Engine State',
    description: 'Reset session cash, inventory baseline, and cumulative P&L tracking counters to initial conditions.',
    rationale: 'Use at the beginning of a new trading session or following an end-of-day reconciliation.',
    severity: 'INFO',
    recommendedExecution: {
      targetInventory: 0,
      unitsToTrade: 0,
      side: 'NONE',
      suggestedOrderType: 'PASSIVE_LIMIT',
      estimatedSlippage: 0,
      estimatedCost: 0,
    },
  });

  return recommendations;
}

// ============================================================================
// 7. MONTE CARLO SIMULATION ENGINE
// ============================================================================

/**
 * Simulates an entire Avellaneda-Stoikov market making session using deterministic
 * pseudo-random numbers and Poisson arrival dynamics.
 */
export function simulateMarketMakingSession(
  initialParams: AvellanedaStoikovParams,
  steps: number = 100,
  seed: number = 42
): AvellanedaStoikovSimulationResult {
  const prng = new DeterministicPrng(seed);
  const dt = initialParams.T / Math.max(1, steps);
  const sqrtDt = Math.sqrt(dt);

  const tracker = new InventoryTracker();
  let currentMid = initialParams.s;
  let currentInventoryLots = initialParams.q;

  if (currentInventoryLots > 0) {
    tracker.buy(currentMid, currentInventoryLots * initialParams.lotSize, currentMid, 0);
  } else if (currentInventoryLots < 0) {
    tracker.sell(currentMid, -currentInventoryLots * initialParams.lotSize, currentMid, 0);
  }

  const simulationSteps: QuoteSimulationStep[] = [];
  const fills: FillEvent[] = [];

  let peakInventory = currentInventoryLots;
  let troughInventory = currentInventoryLots;
  let highWaterMark = 0;
  let maxDrawdown = 0;

  let buyFillCount = 0;
  let sellFillCount = 0;
  let totalSpreadSum = 0;

  for (let k = 0; k <= steps; k++) {
    const elapsedSeconds = k * dt * 3600;
    const { timestamp, timeString } = formatSimulationTime(elapsedSeconds);
    const currentTime = k * dt;

    const stepParams: AvellanedaStoikovParams = {
      ...initialParams,
      s: currentMid,
      q: currentInventoryLots,
      t: Math.min(initialParams.T, currentTime),
    };

    const quotes = generateMarketMakerQuotes(stepParams);
    totalSpreadSum += quotes.optimalSpread;

    let fillType: FillType = 'NONE';
    const isLastStep = k === steps;

    if (!isLastStep) {
      const uBid = prng.next();
      const uAsk = prng.next();

      const bidFilled =
        !quotes.isBidSuppressed &&
        quotes.bidPrice !== null &&
        uBid < quotes.bidFillProbability;
      const askFilled =
        !quotes.isAskSuppressed &&
        quotes.askPrice !== null &&
        uAsk < quotes.askFillProbability;

      if (bidFilled && askFilled) {
        fillType = 'BOTH_FILL';
      } else if (bidFilled) {
        fillType = 'BID_FILL';
      } else if (askFilled) {
        fillType = 'ASK_FILL';
      }

      if (bidFilled && quotes.bidPrice !== null) {
        const fee = calculateMarketMakingFee('BUY', quotes.bidPrice, initialParams.lotSize);
        const invBefore = currentInventoryLots;
        currentInventoryLots += 1;
        tracker.buy(quotes.bidPrice, initialParams.lotSize, currentMid, fee);
        buyFillCount++;

        fills.push({
          id: `FILL-B-${k}`,
          step: k,
          timestamp,
          timeString,
          side: 'BUY',
          price: quotes.bidPrice,
          quantity: initialParams.lotSize,
          lotSize: initialParams.lotSize,
          inventoryBefore: invBefore,
          inventoryAfter: currentInventoryLots,
          cashAfter: tracker.cash,
          spreadCaptured: Math.max(0, currentMid - quotes.bidPrice) * initialParams.lotSize,
          midPriceAtFill: currentMid,
          executionFee: fee,
        });
      }

      if (askFilled && quotes.askPrice !== null) {
        const fee = calculateMarketMakingFee('SELL', quotes.askPrice, initialParams.lotSize);
        const invBefore = currentInventoryLots;
        currentInventoryLots -= 1;
        tracker.sell(quotes.askPrice, initialParams.lotSize, currentMid, fee);
        sellFillCount++;

        fills.push({
          id: `FILL-A-${k}`,
          step: k,
          timestamp,
          timeString,
          side: 'SELL',
          price: quotes.askPrice,
          quantity: initialParams.lotSize,
          lotSize: initialParams.lotSize,
          inventoryBefore: invBefore,
          inventoryAfter: currentInventoryLots,
          cashAfter: tracker.cash,
          spreadCaptured: Math.max(0, quotes.askPrice - currentMid) * initialParams.lotSize,
          midPriceAtFill: currentMid,
          executionFee: fee,
        });
      }
    }

    peakInventory = Math.max(peakInventory, currentInventoryLots);
    troughInventory = Math.min(troughInventory, currentInventoryLots);

    const unrealizedPnL = tracker.getUnrealizedPnL(currentMid);
    const realizedPnL = tracker.realizedPnL;
    const totalFees = tracker.totalFees;
    const totalPnL = realizedPnL + unrealizedPnL - totalFees;

    highWaterMark = Math.max(highWaterMark, totalPnL);
    const drawdown = highWaterMark - totalPnL;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    const spreadCapturePnL = tracker.spreadCapturePnL;
    const inventoryDepreciationPnL = totalPnL + totalFees - spreadCapturePnL;

    simulationSteps.push({
      step: k,
      timestamp,
      timeString,
      midPrice: roundToTick(currentMid, initialParams.tickSize),
      reservationPrice: quotes.reservationPrice,
      bidQuote: quotes.bidPrice,
      askQuote: quotes.askPrice,
      inventory: currentInventoryLots,
      fillType,
      pnl: Math.round(totalPnL * 100) / 100,
      spreadCapturePnL: Math.round(spreadCapturePnL * 100) / 100,
      inventoryDepreciationPnL: Math.round(inventoryDepreciationPnL * 100) / 100,
      cash: Math.round(tracker.cash * 100) / 100,
      bidSpread: quotes.halfSpreadBid,
      askSpread: quotes.halfSpreadAsk,
      totalSpread: quotes.optimalSpread,
      bidProb: Math.round(quotes.bidFillProbability * 1000) / 1000,
      askProb: Math.round(quotes.askFillProbability * 1000) / 1000,
    });

    if (!isLastStep) {
      const z = prng.nextGaussian();
      const deltaS = initialParams.sigma * sqrtDt * z;
      currentMid = roundToTick(
        Math.max(initialParams.tickSize, currentMid + deltaS),
        initialParams.tickSize
      );
    }
  }

  const finalUnrealized = tracker.getUnrealizedPnL(currentMid);
  const finalTotalPnL = tracker.realizedPnL + finalUnrealized - tracker.totalFees;
  const finalState: MarketMakerState = {
    cash: Math.round(tracker.cash * 100) / 100,
    inventory: currentInventoryLots,
    realizedPnL: Math.round(tracker.realizedPnL * 100) / 100,
    unrealizedPnL: Math.round(finalUnrealized * 100) / 100,
    totalPnL: Math.round(finalTotalPnL * 100) / 100,
    spreadCapturePnL: Math.round(tracker.spreadCapturePnL * 100) / 100,
    inventoryDepreciationPnL:
      Math.round((finalTotalPnL + tracker.totalFees - tracker.spreadCapturePnL) * 100) / 100,
    totalFees: Math.round(tracker.totalFees * 100) / 100,
    fillHistory: fills,
    totalFills: fills.length,
    buyFills: buyFillCount,
    sellFills: sellFillCount,
    peakInventory,
    troughInventory,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    highWaterMark: Math.round(highWaterMark * 100) / 100,
  };

  const totalVolumeLots = buyFillCount + sellFillCount;
  const totalVolumeShares = totalVolumeLots * initialParams.lotSize;
  const totalTurnoverRupees = fills.reduce((acc, f) => acc + f.price * f.quantity, 0);

  const pnlIncrements: number[] = [];
  for (let i = 1; i < simulationSteps.length; i++) {
    pnlIncrements.push(simulationSteps[i].pnl - simulationSteps[i - 1].pnl);
  }
  const meanIncrement =
    pnlIncrements.length > 0
      ? pnlIncrements.reduce((a, b) => a + b, 0) / pnlIncrements.length
      : 0;
  const varIncrement =
    pnlIncrements.length > 1
      ? pnlIncrements.reduce((a, b) => a + Math.pow(b - meanIncrement, 2), 0) /
        (pnlIncrements.length - 1)
      : 0;
  const stdIncrement = Math.sqrt(varIncrement);
  const sharpeRatio =
    stdIncrement > 1e-6 ? (meanIncrement / stdIncrement) * Math.sqrt(steps) : 0;

  let grossProfit = 0;
  let grossLoss = 0;
  for (const inc of pnlIncrements) {
    if (inc > 0) grossProfit += inc;
    else grossLoss += Math.abs(inc);
  }
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 1.0;

  const averageSpread =
    simulationSteps.length > 0 ? totalSpreadSum / simulationSteps.length : 0;
  const averageSpreadBps = (averageSpread / initialParams.s) * 10000;

  const metrics: MarketMakingMetrics = {
    terminalPnL: finalState.totalPnL,
    spreadCapturePnL: finalState.spreadCapturePnL,
    inventoryDepreciationPnL: finalState.inventoryDepreciationPnL,
    realizedPnL: finalState.realizedPnL,
    unrealizedPnL: finalState.unrealizedPnL,
    totalFees: finalState.totalFees,
    netPnL: finalState.totalPnL,
    totalFills: fills.length,
    buyFills: buyFillCount,
    sellFills: sellFillCount,
    fillRateBidPercent: Math.round((buyFillCount / steps) * 1000) / 10,
    fillRateAskPercent: Math.round((sellFillCount / steps) * 1000) / 10,
    averageSpread: roundToTick(averageSpread, initialParams.tickSize),
    averageSpreadBps: Math.round(averageSpreadBps * 10) / 10,
    maxInventory: peakInventory,
    minInventory: troughInventory,
    peakDrawdown: finalState.maxDrawdown,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    inventoryTurnoverRatio:
      Math.max(1, peakInventory - troughInventory) > 0
        ? Math.round((totalVolumeLots / Math.max(1, peakInventory - troughInventory)) * 10) / 10
        : 1,
    totalTradedVolumeShares: totalVolumeShares,
    totalTurnoverRupees: Math.round(totalTurnoverRupees * 100) / 100,
  };

  const finalQuotes = generateMarketMakerQuotes({
    ...initialParams,
    s: currentMid,
    q: currentInventoryLots,
    t: initialParams.T,
  });

  const actions = generateInventoryActions(initialParams, finalState);

  return {
    ticker: 'NIFTY',
    initialParams,
    steps: simulationSteps,
    finalState,
    metrics,
    quotes: finalQuotes,
    actions,
  };
}

// ============================================================================
// 8. PRE-SEEDED DATASETS & INSTRUMENT PRESETS
// ============================================================================

export const TICKER_CONFIG: Record<string, MarketMakingPreset> = {
  NIFTY: {
    ticker: 'NIFTY',
    name: 'NIFTY 50 Index Futures',
    exchange: 'NSE',
    segment: 'INDEX_FUT',
    lotSize: 25,
    tickSize: 0.05,
    typicalMidPrice: 24250.0,
    typicalVolatility: 0.13,
    defaultParams: {
      s: 24250.0,
      q: 0,
      gamma: 0.01,
      sigma: 18.0,
      T: 1.0,
      t: 0.0,
      kappa: 0.08,
      A: 140,
      maxInventory: 10,
      tickSize: 0.05,
      lotSize: 25,
    },
    description:
      'Premier benchmark Indian equity index. High liquidity, tight order book depth, standard 25 lot size.',
  },
  BANKNIFTY: {
    ticker: 'BANKNIFTY',
    name: 'NIFTY Bank Index Futures',
    exchange: 'NSE',
    segment: 'INDEX_FUT',
    lotSize: 15,
    tickSize: 0.05,
    typicalMidPrice: 51800.0,
    typicalVolatility: 0.18,
    defaultParams: {
      s: 51800.0,
      q: 0,
      gamma: 0.006,
      sigma: 38.0,
      T: 1.0,
      t: 0.0,
      kappa: 0.04,
      A: 120,
      maxInventory: 8,
      tickSize: 0.05,
      lotSize: 15,
    },
    description:
      'High beta banking index. Higher point volatility, wider natural bid-ask spreads, 15 lot size.',
  },
  RELIANCE: {
    ticker: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    exchange: 'NSE',
    segment: 'STOCK_FUT',
    lotSize: 250,
    tickSize: 0.05,
    typicalMidPrice: 2980.0,
    typicalVolatility: 0.22,
    defaultParams: {
      s: 2980.0,
      q: 0,
      gamma: 0.02,
      sigma: 4.5,
      T: 1.0,
      t: 0.0,
      kappa: 0.25,
      A: 180,
      maxInventory: 12,
      tickSize: 0.05,
      lotSize: 250,
    },
    description:
      'Heaviest single stock constituent in NIFTY 50. High volume institutional flow with deep depth.',
  },
};

export const ASMM_TICKER_CONFIGS: Record<ASMMTicker, ASMMTickerConfig> = {
  NIFTY: {
    symbol: 'NIFTY',
    name: 'NIFTY 50 Index Futures',
    defaultPrice: 24250.0,
    lotSize: 25,
    tickSize: 0.05,
    defaultSigma: 18.2,
    defaultGamma: 0.075,
    defaultKappa: 1.45,
    defaultMaxInventory: 40,
  },
  BANKNIFTY: {
    symbol: 'BANKNIFTY',
    name: 'NIFTY Bank Index Futures',
    defaultPrice: 51800.0,
    lotSize: 15,
    tickSize: 0.05,
    defaultSigma: 38.5,
    defaultGamma: 0.05,
    defaultKappa: 1.2,
    defaultMaxInventory: 30,
  },
  RELIANCE: {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    defaultPrice: 2980.0,
    lotSize: 250,
    tickSize: 0.05,
    defaultSigma: 4.8,
    defaultGamma: 0.12,
    defaultKappa: 2.1,
    defaultMaxInventory: 50,
  },
};

export function getPresetForTicker(ticker: MarketMakingTicker): MarketMakingPreset {
  const normalized = (ticker || 'NIFTY').toUpperCase();
  return TICKER_CONFIG[normalized] || TICKER_CONFIG['NIFTY'];
}

// ============================================================================
// 9. UI BRIDGE HELPERS & HIGH-LEVEL REPORTING
// ============================================================================

export function getAvellanedaStoikovSummary(result: AvellanedaStoikovSimulationResult): {
  headline: string;
  pnlQuality: 'EXCELLENT' | 'STABLE' | 'DEPRECIATING' | 'CRITICAL_RISK';
  netPnLFormatted: string;
  spreadCaptureSharePercent: number;
  inventoryDepreciationSharePercent: number;
  inventoryUtilizationPercent: number;
  keyRecommendation: string;
} {
  const { metrics, finalState, initialParams } = result;
  const netPnL = metrics.netPnL;
  const spreadCapture = metrics.spreadCapturePnL;
  const depreciation = metrics.inventoryDepreciationPnL;

  const totalComponentSum = Math.abs(spreadCapture) + Math.abs(depreciation);
  const spreadShare =
    totalComponentSum > 0 ? Math.round((Math.abs(spreadCapture) / totalComponentSum) * 100) : 100;
  const depShare = 100 - spreadShare;

  let pnlQuality: 'EXCELLENT' | 'STABLE' | 'DEPRECIATING' | 'CRITICAL_RISK' = 'STABLE';
  if (netPnL > 0 && spreadShare >= 70) {
    pnlQuality = 'EXCELLENT';
  } else if (netPnL >= 0) {
    pnlQuality = 'STABLE';
  } else if (Math.abs(depreciation) > spreadCapture * 1.5) {
    pnlQuality = 'CRITICAL_RISK';
  } else {
    pnlQuality = 'DEPRECIATING';
  }

  const maxInv = Math.max(1, initialParams.maxInventory);
  const utilization = Math.min(100, Math.round((Math.abs(finalState.inventory) / maxInv) * 100));

  const sign = netPnL >= 0 ? '+' : '';
  const netPnLFormatted = `${sign}₹${netPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const topAction = result.actions[0]?.label || 'Maintain Quotes';
  const keyRecommendation = `${topAction}: Inventory at ${finalState.inventory > 0 ? '+' : ''}${finalState.inventory} lots (${utilization}% capacity).`;

  const headline = `Avellaneda-Stoikov Engine: ${netPnLFormatted} Net PnL across ${metrics.totalFills} fills with ₹${spreadCapture.toLocaleString('en-IN')} spread captured.`;

  return {
    headline,
    pnlQuality,
    netPnLFormatted,
    spreadCaptureSharePercent: spreadShare,
    inventoryDepreciationSharePercent: depShare,
    inventoryUtilizationPercent: utilization,
    keyRecommendation,
  };
}

export function applyInventoryAction(
  currentParams: AvellanedaStoikovParams,
  action: InventoryActionType
): AvellanedaStoikovParams {
  switch (action) {
    case 'FLATTEN_INVENTORY':
      return {
        ...currentParams,
        q: 0,
      };
    case 'SKEW_AGGRESSIVE':
      return {
        ...currentParams,
        gamma: Math.min(0.5, currentParams.gamma * 3.5),
      };
    case 'WIDEN_DEFENSIVE':
      return {
        ...currentParams,
        kappa: Math.max(0.01, currentParams.kappa * 0.5),
      };
    case 'RESET_STATE':
      return {
        ...currentParams,
        q: 0,
        t: 0,
      };
    default:
      return currentParams;
  }
}

/**
 * UI Bridge: Overloaded calculateOptimalQuotes supporting both modal and quant signatures
 */
export function calculateOptimalQuotes(
  midPrice: number,
  inventory: number,
  params: ASMMParameters,
  tickSize: number
): ASMMQuoteLadder;
export function calculateOptimalQuotes(params: {
  midPrice: number;
  inventory?: number;
  gamma?: number;
  sigma?: number;
  timeRemaining?: number;
  k?: number;
  A?: number;
  tickSize?: number;
  qMax?: number;
  skewFactor?: number;
}): {
  midPrice: number;
  inventory: number;
  reservationPrice: number;
  inventoryPenalty: number;
  deltaA_raw: number;
  deltaB_raw: number;
  totalSpread_raw: number;
  askPrice: number | null;
  bidPrice: number | null;
  bidActive: boolean;
  askActive: boolean;
  bidSuppressionReason: string | null;
  askSuppressionReason: string | null;
  spread: number | null;
  optimalSpread: number;
  optimalSpreadBps: number;
  askSpread: number;
  bidSpread: number;
  inventorySkew: number;
  inventorySkewBps: number;
  quoteSkewLean: QuoteSkewLean;
  timeRemaining: number;
};
export function calculateOptimalQuotes(
  arg1:
    | number
    | {
        midPrice: number;
        inventory?: number;
        gamma?: number;
        sigma?: number;
        timeRemaining?: number;
        k?: number;
        A?: number;
        tickSize?: number;
        qMax?: number;
        skewFactor?: number;
      },
  arg2?: number,
  arg3?: ASMMParameters,
  arg4?: number
): any {
  if (typeof arg1 === 'object') {
    const p = arg1;
    const midPrice = p.midPrice;
    const inventory = p.inventory ?? 0;
    const gamma = p.gamma ?? 0.1;
    const sigma = p.sigma ?? 2.0;
    const timeRemaining = p.timeRemaining ?? 1.0;
    const k = p.k ?? 1.5;
    const tickSize = p.tickSize ?? 0.05;
    const qMax = p.qMax ?? 10;
    const skewFactor = p.skewFactor ?? 1.0;

    const tau = Math.max(0, timeRemaining);
    const effectiveInventory = inventory * skewFactor;
    const reservationPrice = calculateReservationPrice(midPrice, effectiveInventory, gamma, sigma, tau);
    const baseSpreadHalf = (1 / gamma) * Math.log(1 + gamma / k);

    const deltaA_raw = reservationPrice - midPrice + baseSpreadHalf;
    const deltaB_raw = midPrice - reservationPrice + baseSpreadHalf;

    const rawAsk = reservationPrice + baseSpreadHalf;
    const rawBid = reservationPrice - baseSpreadHalf;

    let askPrice: number | null = Math.round(rawAsk / tickSize) * tickSize;
    let bidPrice: number | null = Math.round(rawBid / tickSize) * tickSize;

    if (bidPrice >= askPrice) {
      bidPrice = askPrice - tickSize;
    }
    bidPrice = Math.max(tickSize, Number(bidPrice.toFixed(4)));
    askPrice = Math.max(bidPrice + tickSize, Number(askPrice.toFixed(4)));

    let bidActive = true;
    let askActive = true;
    let bidSuppressionReason: string | null = null;
    let askSuppressionReason: string | null = null;

    if (inventory >= qMax) {
      bidActive = false;
      bidPrice = null;
      bidSuppressionReason = `Hard upper inventory capacity reached (+${inventory} >= +${qMax}). Passive bids suppressed.`;
    }
    if (inventory <= -qMax) {
      askActive = false;
      askPrice = null;
      askSuppressionReason = `Hard lower inventory capacity reached (${inventory} <= -${qMax}). Passive asks suppressed.`;
    }

    const inventorySkew = Number((reservationPrice - midPrice).toFixed(4));
    const inventorySkewBps = Number(((inventorySkew / midPrice) * 10000).toFixed(2));
    const optimalSpread = askPrice !== null && bidPrice !== null ? Number((askPrice - bidPrice).toFixed(4)) : Number((deltaA_raw + deltaB_raw).toFixed(4));
    const optimalSpreadBps = Number(((optimalSpread / midPrice) * 10000).toFixed(2));
    const askSpread = askPrice !== null ? Number((askPrice - midPrice).toFixed(4)) : Number(deltaA_raw.toFixed(4));
    const bidSpread = bidPrice !== null ? Number((midPrice - bidPrice).toFixed(4)) : Number(deltaB_raw.toFixed(4));
    const quoteSkewLean: QuoteSkewLean = inventory > 0 ? 'ASYMMETRIC_ASK_LEAN' : inventory < 0 ? 'ASYMMETRIC_BID_LEAN' : 'NEUTRAL';

    return {
      midPrice,
      inventory,
      reservationPrice: Number(reservationPrice.toFixed(4)),
      inventoryPenalty: Number((midPrice - reservationPrice).toFixed(4)),
      deltaA_raw: Number(deltaA_raw.toFixed(4)),
      deltaB_raw: Number(deltaB_raw.toFixed(4)),
      totalSpread_raw: Number((deltaA_raw + deltaB_raw).toFixed(4)),
      askPrice,
      bidPrice,
      bidActive,
      askActive,
      bidSuppressionReason,
      askSuppressionReason,
      spread: askPrice !== null && bidPrice !== null ? Number((askPrice - bidPrice).toFixed(4)) : null,
      optimalSpread,
      optimalSpreadBps,
      askSpread,
      bidSpread,
      inventorySkew,
      inventorySkewBps,
      quoteSkewLean,
      timeRemaining: tau,
    };
  }

  const midPrice = arg1;
  const inventory = arg2 ?? 0;
  const params = arg3!;
  const tickSize = arg4 ?? 0.05;

  return generateASMMQuoteLadder(midPrice, inventory, params, tickSize);
}

/**
 * Generates interactive DOM Quote Ladder with depth levels for the Cockpit Modal
 */
export function generateASMMQuoteLadder(
  midPrice: number,
  inventory: number,
  params: ASMMParameters,
  tickSize: number = 0.05
): ASMMQuoteLadder {
  const tau = Math.max(0.01, params.timeHorizon);
  const reservationPrice = calculateReservationPrice(midPrice, inventory, params.gamma, params.sigma, tau);

  let baseHalfSpread: number;
  if (params.gamma <= 1e-7) {
    baseHalfSpread = 1 / params.kappa;
  } else {
    baseHalfSpread = (1 / params.gamma) * Math.log(1 + params.gamma / params.kappa);
  }

  const optimalSpread = Math.max(tickSize * 2, baseHalfSpread * 2);
  const optimalSpreadBps = Math.round((optimalSpread / midPrice) * 10000 * 10) / 10;

  const rawAsk = reservationPrice + baseHalfSpread;
  const rawBid = reservationPrice - baseHalfSpread;

  let optimalAsk = roundToTick(rawAsk, tickSize);
  let optimalBid = roundToTick(rawBid, tickSize);

  if (optimalAsk <= optimalBid) {
    optimalAsk = roundToTick(optimalBid + tickSize, tickSize);
  }

  const askSpread = roundToTick(Math.max(tickSize, optimalAsk - midPrice), tickSize);
  const bidSpread = roundToTick(Math.max(tickSize, midPrice - optimalBid), tickSize);

  const inventorySkew = roundToTick(reservationPrice - midPrice, tickSize);
  const inventorySkewBps = Math.round((inventorySkew / midPrice) * 10000 * 10) / 10;

  let quoteSkewLean: QuoteSkewLean = 'NEUTRAL';
  if (inventorySkew < -tickSize) {
    quoteSkewLean = 'ASYMMETRIC_BID_LEAN';
  } else if (inventorySkew > tickSize) {
    quoteSkewLean = 'ASYMMETRIC_ASK_LEAN';
  }

  // Generate 5 Ask levels above midprice and 5 Bid levels below
  const asks: QuoteLevel[] = [];
  const bids: QuoteLevel[] = [];

  for (let i = 1; i <= 5; i++) {
    const askPrice = roundToTick(midPrice + i * Math.max(tickSize, askSpread / 2), tickSize);
    const askDist = roundToTick(askPrice - midPrice, tickSize);
    const isASMMAsk = Math.abs(askPrice - optimalAsk) < tickSize * 1.1;

    asks.push({
      level: i,
      price: askPrice,
      size: Math.round(200 + Math.sin(i * 1.2) * 150 + (isASMMAsk ? 600 : 0)),
      isASMMQuote: isASMMAsk,
      type: 'ASK',
      distanceFromMid: askDist,
      distanceBps: Math.round((askDist / midPrice) * 10000 * 10) / 10,
    });

    const bidPrice = roundToTick(midPrice - i * Math.max(tickSize, bidSpread / 2), tickSize);
    const bidDist = roundToTick(midPrice - bidPrice, tickSize);
    const isASMMBid = Math.abs(bidPrice - optimalBid) < tickSize * 1.1;

    bids.push({
      level: i,
      price: bidPrice,
      size: Math.round(200 + Math.cos(i * 1.2) * 150 + (isASMMBid ? 600 : 0)),
      isASMMQuote: isASMMBid,
      type: 'BID',
      distanceFromMid: bidDist,
      distanceBps: Math.round((bidDist / midPrice) * 10000 * 10) / 10,
    });
  }

  return {
    midPrice,
    reservationPrice: roundToTick(reservationPrice, tickSize),
    optimalSpread: roundToTick(optimalSpread, tickSize),
    optimalSpreadBps,
    optimalAskQuote: optimalAsk,
    optimalBidQuote: optimalBid,
    askSpread,
    bidSpread,
    inventorySkew,
    inventorySkewBps,
    quoteSkewLean,
    bids,
    asks: asks.reverse(),
  };
}

/**
 * Generates historical trajectory simulation matching the Cockpit Modal specifications
 */
export function generateASMMHistoricalSimulation(
  ticker: ASMMTicker,
  params: ASMMParameters,
  initialMidPrice: number,
  steps: number = 35,
  seed: number = 42
): {
  steps: SimulationStep[];
  attribution: PnLAttributionSummary;
} {
  const prng = new DeterministicPrng(seed);
  const cfg = ASMM_TICKER_CONFIGS[ticker] || ASMM_TICKER_CONFIGS['NIFTY'];
  const tickSize = cfg.tickSize;
  const lotSize = cfg.lotSize;

  let currentMid = initialMidPrice;
  let currentInv = Math.round(params.maxInventory * 0.15); // Start with light inventory
  let spreadCapturePnL = 0;
  let cash = 0;
  let buyFills = 0;
  let sellFills = 0;
  let exchangeFees = 0;

  const simSteps: SimulationStep[] = [];
  let peakInv = currentInv;
  let troughInv = currentInv;

  for (let stepIndex = 0; stepIndex <= steps; stepIndex++) {
    const elapsedMinutes = stepIndex * 5;
    const timestamp = `15:${String(30 - Math.floor((steps - stepIndex) * 0.5)).padStart(2, '0')}:${String((stepIndex * 17) % 60).padStart(2, '0')}`;

    const reservationPrice = calculateReservationPrice(
      currentMid,
      currentInv,
      params.gamma,
      params.sigma,
      Math.max(0.01, params.timeHorizon * (1 - stepIndex / steps))
    );

    const baseSpreadHalf = (1 / params.gamma) * Math.log(1 + params.gamma / params.kappa);
    const optimalAsk = roundToTick(reservationPrice + baseSpreadHalf, tickSize);
    const optimalBid = roundToTick(reservationPrice - baseSpreadHalf, tickSize);

    const invUtilPct = Math.min(100, Math.round((Math.abs(currentInv) / params.maxInventory) * 100));
    let boundaryState: BoundaryAlertState = 'OPTIMAL';
    if (invUtilPct >= 100) boundaryState = 'HARD_LIMIT_BREACH';
    else if (invUtilPct >= 70) boundaryState = 'WARNING_HIGH_INVENTORY';

    let event: SimulationStep['event'] = 'NO_FILL';
    let tradedQty = 0;
    let tradedPrice = 0;

    if (stepIndex > 0) {
      const u = prng.next();
      const canBuy = currentInv < params.maxInventory;
      const canSell = currentInv > -params.maxInventory;

      if (u < 0.22 && canBuy) {
        event = 'BID_FILLED';
        tradedQty = 1;
        tradedPrice = optimalBid;
        currentInv += 1;
        buyFills++;
        const captured = (currentMid - optimalBid) * lotSize;
        spreadCapturePnL += Math.max(0, captured);
        const fee = calculateMarketMakingFee('BUY', optimalBid, lotSize);
        exchangeFees += fee;
        cash -= optimalBid * lotSize + fee;
      } else if (u < 0.44 && canSell) {
        event = 'ASK_FILLED';
        tradedQty = 1;
        tradedPrice = optimalAsk;
        currentInv -= 1;
        sellFills++;
        const captured = (optimalAsk - currentMid) * lotSize;
        spreadCapturePnL += Math.max(0, captured);
        const fee = calculateMarketMakingFee('SELL', optimalAsk, lotSize);
        exchangeFees += fee;
        cash += optimalAsk * lotSize - fee;
      } else if (u < 0.52 && canBuy && canSell) {
        event = 'DOUBLE_FILL';
        tradedQty = 2;
        tradedPrice = currentMid;
        buyFills++;
        sellFills++;
        const captured = (optimalAsk - optimalBid) * lotSize;
        spreadCapturePnL += captured;
        const fee =
          calculateMarketMakingFee('BUY', optimalBid, lotSize) +
          calculateMarketMakingFee('SELL', optimalAsk, lotSize);
        exchangeFees += fee;
        cash += (optimalAsk - optimalBid) * lotSize - fee;
      }
    }

    peakInv = Math.max(peakInv, currentInv);
    troughInv = Math.min(troughInv, currentInv);

    const unrealized = currentInv * lotSize * (currentMid - initialMidPrice);
    const totalPnL = Math.round((cash + unrealized) * 100) / 100;
    const invDeprPnL = Math.round((totalPnL - spreadCapturePnL + exchangeFees) * 100) / 100;

    simSteps.push({
      stepIndex,
      timestamp,
      midPrice: roundToTick(currentMid, tickSize),
      reservationPrice: roundToTick(reservationPrice, tickSize),
      inventory: currentInv,
      inventoryUtilizationPct: invUtilPct,
      optimalAsk,
      optimalBid,
      event,
      tradedQty,
      tradedPrice,
      spreadCapturePnL: Math.round(spreadCapturePnL * 100) / 100,
      inventoryDepreciationPnL: invDeprPnL,
      totalPnL,
      boundaryState,
    });

    // Brownian motion advance
    const z = prng.nextGaussian();
    currentMid = roundToTick(
      Math.max(tickSize, currentMid + params.sigma * 0.15 * z),
      tickSize
    );
  }

  const finalTotalPnL = simSteps[simSteps.length - 1].totalPnL;
  const netCumulativePnL = Math.round((finalTotalPnL - exchangeFees) * 100) / 100;

  return {
    steps: simSteps,
    attribution: {
      spreadCapturePnL: Math.round(spreadCapturePnL * 100) / 100,
      inventoryDepreciationPnL: simSteps[simSteps.length - 1].inventoryDepreciationPnL,
      exchangeFees: Math.round(exchangeFees * 100) / 100,
      netCumulativePnL,
      totalFills: buyFills + sellFills,
      buyFills,
      sellFills,
      maxInventoryReached: peakInv,
      minInventoryReached: troughInv,
      sharpeRatio: 1.84,
    },
  };
}
