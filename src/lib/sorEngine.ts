// Sprint 19 — Cross-Exchange Arbitrage & Smart Order Router (SOR) Engine
// Mathematical models: Indian NBBO (INBBO) Aggregation, Inter-Market Fee Netting (NSE vs BSE),
// Latency Fill Probability Decay, and Atomic Split-Sweep Routing

import {
  ExchangeVenue,
  SORRoutingPolicy,
  LeggingBailoutAction,
  DepthRung,
  VenueOrderBook,
  DualExchangeDepthSnapshot,
  INBBOQuote,
  CrossExchangeArbitrageOpp,
  SORLatencyParams,
  SORChildOrder,
  SORRoutingExecutionResult,
} from '../types/sor';
import { calculateStatutoryCharges } from './taxEngine';

// Exchange transaction fee rates
export const EXCHANGE_TARIFFS = {
  NSE: 0.0000297, // 0.00297%
  BSE: 0.0000375, // 0.00375%
  SEBI_TURNOVER: 0.000001, // ₹10 per crore (0.0001%)
  STAMP_DUTY_BUY: 0.00015, // 0.015% on buy turnover
  STT_EQUITY_INTRADAY_SELL: 0.00025, // 0.025% on sell turnover
  GST_RATE: 0.18, // 18% on exchange + SEBI + brokerage
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. INBBO (INDIAN NATIONAL BEST BID AND OFFER) AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

export function calculateINBBO(nse: VenueOrderBook, bse: VenueOrderBook): INBBOQuote {
  const nseBestBid = nse.bids[0] ?? { price: 0, quantity: 0, orders: 0 };
  const bseBestBid = bse.bids[0] ?? { price: 0, quantity: 0, orders: 0 };
  const nseBestAsk = nse.asks[0] ?? { price: Infinity, quantity: 0, orders: 0 };
  const bseBestAsk = bse.asks[0] ?? { price: Infinity, quantity: 0, orders: 0 };

  const bestBidVenue: ExchangeVenue = bseBestBid.price > nseBestBid.price ? 'BSE' : 'NSE';
  const bestBidPrice = bestBidVenue === 'BSE' ? bseBestBid.price : nseBestBid.price;
  const bestBidQty = bestBidVenue === 'BSE' ? bseBestBid.quantity : nseBestBid.quantity;

  const bestAskVenue: ExchangeVenue = bseBestAsk.price < nseBestAsk.price ? 'BSE' : 'NSE';
  const bestAskPrice = bestAskVenue === 'BSE' ? bseBestAsk.price : nseBestAsk.price;
  const bestAskQty = bestAskVenue === 'BSE' ? bseBestAsk.quantity : nseBestAsk.quantity;

  const isCrossed = bestBidPrice >= bestAskPrice && bestBidPrice > 0 && bestAskPrice < Infinity;
  const grossCrossedSpread = isCrossed ? parseFloat((bestBidPrice - bestAskPrice).toFixed(2)) : 0;
  const grossSpreadBps = isCrossed && bestAskPrice > 0
    ? parseFloat(((grossCrossedSpread / bestAskPrice) * 10000).toFixed(2))
    : 0;

  return {
    symbol: nse.symbol,
    bestBidPrice,
    bestBidVenue,
    bestBidQty,
    bestAskPrice,
    bestAskVenue,
    bestAskQty,
    isCrossed,
    grossCrossedSpread,
    grossSpreadBps,
    inbboTimestamp: Math.max(nse.timestamp, bse.timestamp),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CROSS-EXCHANGE ARBITRAGE DETECTION & STATUTORY FEE NETTING
// ─────────────────────────────────────────────────────────────────────────────

export function calculateInterMarketStatutoryFees(
  buyVenue: ExchangeVenue,
  buyPrice: number,
  sellVenue: ExchangeVenue,
  sellPrice: number,
  qty: number
): { totalFeeInr: number; feeBps: number } {
  const buyNotional = buyPrice * qty;
  const sellNotional = sellPrice * qty;

  // Buy leg: Exchange tariff + Stamp Duty + SEBI + GST
  const buyExchTariff = buyNotional * EXCHANGE_TARIFFS[buyVenue];
  const stampDuty = buyNotional * EXCHANGE_TARIFFS.STAMP_DUTY_BUY;
  const buySebi = buyNotional * EXCHANGE_TARIFFS.SEBI_TURNOVER;
  const buyGst = (buyExchTariff + buySebi) * EXCHANGE_TARIFFS.GST_RATE;
  const buyLegCost = buyExchTariff + stampDuty + buySebi + buyGst;

  // Sell leg: Exchange tariff + STT + SEBI + GST
  const sellExchTariff = sellNotional * EXCHANGE_TARIFFS[sellVenue];
  const stt = sellNotional * EXCHANGE_TARIFFS.STT_EQUITY_INTRADAY_SELL;
  const sellSebi = sellNotional * EXCHANGE_TARIFFS.SEBI_TURNOVER;
  const sellGst = (sellExchTariff + sellSebi) * EXCHANGE_TARIFFS.GST_RATE;
  const sellLegCost = sellExchTariff + stt + sellSebi + sellGst;

  const totalFeeInr = parseFloat((buyLegCost + sellLegCost).toFixed(2));
  const feeBps = buyNotional > 0 ? parseFloat(((totalFeeInr / buyNotional) * 10000).toFixed(2)) : 0;

  return { totalFeeInr, feeBps };
}

export function detectCrossExchangeArbitrage(
  snapshot: DualExchangeDepthSnapshot,
  latencyParams?: SORLatencyParams
): CrossExchangeArbitrageOpp | null {
  const { nse, bse, symbol } = snapshot;
  const inbbo = calculateINBBO(nse, bse);

  if (!inbbo.isCrossed) return null;

  // Case 1: Buy on NSE Ask, Sell on BSE Bid
  let buyVenue: ExchangeVenue = 'NSE';
  let buyPrice = nse.asks[0]?.price ?? Infinity;
  let buyAvailableQty = nse.asks[0]?.quantity ?? 0;

  let sellVenue: ExchangeVenue = 'BSE';
  let sellPrice = bse.bids[0]?.price ?? 0;
  let sellAvailableQty = bse.bids[0]?.quantity ?? 0;

  // Check if reversed (Buy on BSE Ask, Sell on NSE Bid)
  if (bse.asks[0]?.price < nse.bids[0]?.price) {
    buyVenue = 'BSE';
    buyPrice = bse.asks[0]?.price ?? Infinity;
    buyAvailableQty = bse.asks[0]?.quantity ?? 0;

    sellVenue = 'NSE';
    sellPrice = nse.bids[0]?.price ?? 0;
    sellAvailableQty = nse.bids[0]?.quantity ?? 0;
  }

  const grossSpreadInr = parseFloat((sellPrice - buyPrice).toFixed(2));
  if (grossSpreadInr <= 0) return null;

  const executableQty = Math.min(buyAvailableQty, sellAvailableQty);
  if (executableQty <= 0) return null;

  const grossSpreadBps = parseFloat(((grossSpreadInr / buyPrice) * 10000).toFixed(2));
  const fees = calculateInterMarketStatutoryFees(buyVenue, buyPrice, sellVenue, sellPrice, executableQty);
  const netSpreadBps = parseFloat((grossSpreadBps - fees.feeBps).toFixed(2));
  const grossProfitInr = grossSpreadInr * executableQty;
  const netProfitInr = parseFloat((grossProfitInr - fees.totalFeeInr).toFixed(2));

  // Minimum net spread hurdle is 1.5 bps
  const isProfitable = netSpreadBps >= 1.5 && netProfitInr > 0;

  // Latency fill probability
  const jointFillProb = latencyParams ? latencyParams.fillProbability : 0.85;

  return {
    id: `ARB-${Date.now()}-${symbol}`,
    symbol,
    timestamp: Date.now(),
    buyVenue,
    buyPrice,
    buyAvailableQty,
    sellVenue,
    sellPrice,
    sellAvailableQty,
    executableQty,
    grossSpreadInr,
    grossSpreadBps,
    totalStatutoryFrictionInr: fees.totalFeeInr,
    netSpreadBps,
    netProfitInr,
    isProfitable,
    jointFillProbability: jointFillProb,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LATENCY MODELING & QUEUE JITTER FILL PROBABILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes execution latency and fill probability:
 *   tau = tau_transit + tau_colo + tau_broker + tau_jitter
 *   P(Fill | tau) = exp(-lambda_sweep * tau)
 */
export function calculateLatencyParams(
  networkTransitMs: number = 0.8,
  colocationLinkMs: number = 0.25,
  brokerApiOverheadMs: number = 1.2,
  competingHftIntensity: number = 0.15 // 0.15 ms^-1 sweep intensity
): SORLatencyParams {
  // Heavy-tailed log-normal queue jitter
  const meanJitter = 0.35;
  const matchingEngineJitterMs = parseFloat((meanJitter * (0.8 + 0.4 * Math.random())).toFixed(3));

  const totalLatencyMs = parseFloat(
    (networkTransitMs + colocationLinkMs + brokerApiOverheadMs + matchingEngineJitterMs).toFixed(3)
  );

  const fillProbability = parseFloat(
    Math.max(0.05, Math.min(0.99, Math.exp(-competingHftIntensity * totalLatencyMs))).toFixed(3)
  );

  return {
    networkTransitMs,
    colocationLinkMs,
    brokerApiOverheadMs,
    matchingEngineJitterMs,
    totalLatencyMs,
    competingHftIntensity,
    fillProbability,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SMART ORDER ROUTER (SOR) EXECUTION SOLVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Routes an institutional parent order across NSE and BSE
 * using the specified routing policy (BEST_PRICE_NBBO, SPLIT_LIQUIDITY_SWEEP, etc.)
 */
export function routeSmartOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  totalQty: number,
  snapshot: DualExchangeDepthSnapshot,
  policy: SORRoutingPolicy = 'SPLIT_LIQUIDITY_SWEEP',
  latencyParams: SORLatencyParams = calculateLatencyParams()
): SORRoutingExecutionResult {
  const { nse, bse } = snapshot;
  const childOrders: SORChildOrder[] = [];

  let remainingQty = totalQty;
  let runningNotional = 0;
  let totalStatutoryTaxes = 0;

  // Single-venue benchmark (if order was routed 100% to NSE)
  const nseBookSide = side === 'BUY' ? nse.asks : nse.bids;
  let nseBenchmarkNotional = 0;
  let nseBenchQtyRem = totalQty;
  for (const rung of nseBookSide) {
    const take = Math.min(nseBenchQtyRem, rung.quantity);
    nseBenchmarkNotional += take * rung.price;
    nseBenchQtyRem -= take;
    if (nseBenchQtyRem <= 0) break;
  }
  const singleVenueBenchmarkPrice = totalQty > 0 ? parseFloat((nseBenchmarkNotional / totalQty).toFixed(2)) : 0;

  if (policy === 'BEST_PRICE_NBBO') {
    // Route entire quantity to venue with current best price
    const inbbo = calculateINBBO(nse, bse);
    const targetVenue = side === 'BUY' ? inbbo.bestAskVenue : inbbo.bestBidVenue;
    const targetPrice = side === 'BUY' ? inbbo.bestAskPrice : inbbo.bestBidPrice;
    const taxes = calculateStatutoryCharges(side, 'MIS', targetPrice, totalQty).totalCharges;

    childOrders.push({
      childId: `CHILD-NBBO-1`,
      venue: targetVenue,
      side,
      targetPrice,
      fillPrice: targetPrice,
      requestedQty: totalQty,
      executedQty: totalQty,
      latencyMs: latencyParams.totalLatencyMs,
      status: 'FILLED',
      statutoryChargesInr: taxes,
    });
    runningNotional = totalQty * targetPrice;
    totalStatutoryTaxes = taxes;
  } else {
    // SPLIT_LIQUIDITY_SWEEP: Combine all rungs from both venues and sort greedily
    interface AggregatedRung {
      venue: ExchangeVenue;
      price: number;
      quantity: number;
    }

    const allRungs: AggregatedRung[] = [];
    if (side === 'BUY') {
      nse.asks.forEach((r) => allRungs.push({ venue: 'NSE', price: r.price, quantity: r.quantity }));
      bse.asks.forEach((r) => allRungs.push({ venue: 'BSE', price: r.price, quantity: r.quantity }));
      // For buy: cheapest first
      allRungs.sort((a, b) => a.price - b.price);
    } else {
      nse.bids.forEach((r) => allRungs.push({ venue: 'NSE', price: r.price, quantity: r.quantity }));
      bse.bids.forEach((r) => allRungs.push({ venue: 'BSE', price: r.price, quantity: r.quantity }));
      // For sell: highest first
      allRungs.sort((a, b) => b.price - a.price);
    }

    let childIdx = 1;
    for (const rung of allRungs) {
      if (remainingQty <= 0) break;
      const takeQty = Math.min(remainingQty, rung.quantity);
      const childNotional = takeQty * rung.price;
      const childTaxes = calculateStatutoryCharges(side, 'MIS', rung.price, takeQty).totalCharges;

      childOrders.push({
        childId: `CHILD-SWEEP-${childIdx++}`,
        venue: rung.venue,
        side,
        targetPrice: rung.price,
        fillPrice: rung.price,
        requestedQty: takeQty,
        executedQty: takeQty,
        latencyMs: parseFloat((latencyParams.totalLatencyMs + (childIdx * 0.15)).toFixed(3)),
        status: 'FILLED',
        statutoryChargesInr: childTaxes,
      });

      runningNotional += childNotional;
      totalStatutoryTaxes += childTaxes;
      remainingQty -= takeQty;
    }
  }

  const totalExecuted = totalQty - remainingQty;
  const effectiveAvgPrice = totalExecuted > 0 ? parseFloat((runningNotional / totalExecuted).toFixed(2)) : 0;

  // Price improvement vs single-venue NSE
  const priceImprovementBps = side === 'BUY'
    ? parseFloat((((singleVenueBenchmarkPrice - effectiveAvgPrice) / singleVenueBenchmarkPrice) * 10000).toFixed(2))
    : parseFloat((((effectiveAvgPrice - singleVenueBenchmarkPrice) / singleVenueBenchmarkPrice) * 10000).toFixed(2));

  const totalSavingsInr = side === 'BUY'
    ? parseFloat(((singleVenueBenchmarkPrice - effectiveAvgPrice) * totalExecuted).toFixed(2))
    : parseFloat(((effectiveAvgPrice - singleVenueBenchmarkPrice) * totalExecuted).toFixed(2));

  return {
    parentOrderId: `SOR-${Date.now()}-${symbol}`,
    symbol,
    side,
    totalRequestedQty: totalQty,
    totalExecutedQty: totalExecuted,
    routingPolicy: policy,
    childOrders,
    effectiveAvgPrice,
    singleVenueBenchmarkPrice,
    priceImprovementBps: Math.max(0, priceImprovementBps),
    totalSavingsInr: Math.max(0, totalSavingsInr),
    totalStatutoryTaxesInr: parseFloat(totalStatutoryTaxes.toFixed(2)),
    executionDurationMs: latencyParams.totalLatencyMs,
    leggingBailoutEngaged: 'NONE',
    adverseLeggingCostInr: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ATOMIC ARBITRAGE EXECUTOR WITH LEGGING BAILOUT
// ─────────────────────────────────────────────────────────────────────────────

export function executeAtomicArbitrage(
  opp: CrossExchangeArbitrageOpp,
  latencyParams: SORLatencyParams = calculateLatencyParams()
): SORRoutingExecutionResult {
  const childOrders: SORChildOrder[] = [];
  const qty = opp.executableQty;

  // Roll fill dice for Leg 1 (Buy) based on latency fill probability
  const leg1Filled = Math.random() <= latencyParams.fillProbability;
  // Leg 2 faces slightly higher adverse selection
  const leg2Filled = leg1Filled && (Math.random() <= (latencyParams.fillProbability * 0.95));

  let bailoutAction: LeggingBailoutAction = 'NONE';
  let adverseLeggingCostInr = 0;

  // Leg 1: Buy
  childOrders.push({
    childId: `ARB-LEG1-BUY`,
    venue: opp.buyVenue,
    side: 'BUY',
    targetPrice: opp.buyPrice,
    fillPrice: opp.buyPrice,
    requestedQty: qty,
    executedQty: leg1Filled ? qty : 0,
    latencyMs: latencyParams.totalLatencyMs,
    status: leg1Filled ? 'FILLED' : 'REJECTED',
    statutoryChargesInr: leg1Filled ? calculateStatutoryCharges('BUY', 'MIS', opp.buyPrice, qty).totalCharges : 0,
  });

  if (leg1Filled && leg2Filled) {
    // Both legs filled: Clean complete arbitrage
    childOrders.push({
      childId: `ARB-LEG2-SELL`,
      venue: opp.sellVenue,
      side: 'SELL',
      targetPrice: opp.sellPrice,
      fillPrice: opp.sellPrice,
      requestedQty: qty,
      executedQty: qty,
      latencyMs: parseFloat((latencyParams.totalLatencyMs + 0.35).toFixed(3)),
      status: 'FILLED',
      statutoryChargesInr: calculateStatutoryCharges('SELL', 'MIS', opp.sellPrice, qty).totalCharges,
    });
  } else if (leg1Filled && !leg2Filled) {
    // Leg 1 filled, Leg 2 missed: LEGGING RISK!
    // Engage Bailout: aggressive market sweep on alternate exchange
    bailoutAction = 'AGGRESSIVE_MARKET_SWEEP';
    // Bailout fill price suffers 0.04% adverse slippage
    const bailoutPrice = parseFloat((opp.sellPrice * 0.9996).toFixed(2));
    adverseLeggingCostInr = parseFloat(((opp.sellPrice - bailoutPrice) * qty).toFixed(2));

    childOrders.push({
      childId: `ARB-LEG2-BAILOUT`,
      venue: opp.sellVenue,
      side: 'SELL',
      targetPrice: opp.sellPrice,
      fillPrice: bailoutPrice,
      requestedQty: qty,
      executedQty: qty,
      latencyMs: parseFloat((latencyParams.totalLatencyMs + 1.2).toFixed(3)),
      status: 'BAILED_OUT',
      statutoryChargesInr: calculateStatutoryCharges('SELL', 'MIS', bailoutPrice, qty).totalCharges,
    });
  }

  const effectivePrice = leg1Filled && leg2Filled ? opp.sellPrice : opp.buyPrice;
  const netProfit = leg1Filled && leg2Filled ? opp.netProfitInr : -adverseLeggingCostInr;

  return {
    parentOrderId: `ARB-EXEC-${Date.now()}`,
    symbol: opp.symbol,
    side: 'BUY',
    totalRequestedQty: qty,
    totalExecutedQty: leg1Filled ? qty : 0,
    routingPolicy: 'ATOMIC_ARBITRAGE',
    childOrders,
    effectiveAvgPrice: effectivePrice,
    singleVenueBenchmarkPrice: opp.buyPrice,
    priceImprovementBps: opp.netSpreadBps,
    totalSavingsInr: Math.max(0, netProfit),
    totalStatutoryTaxesInr: opp.totalStatutoryFrictionInr,
    executionDurationMs: latencyParams.totalLatencyMs,
    leggingBailoutEngaged: bailoutAction,
    adverseLeggingCostInr,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SYNTHETIC DUAL-EXCHANGE ORDER BOOK GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateSyntheticCrossExchangeBooks(
  symbol: string = 'RELIANCE',
  basePrice: number = 2850
): DualExchangeDepthSnapshot {
  const now = Date.now();
  // Introduce occasional cross-exchange pricing discrepancy (e.g. 0.03% to 0.08%)
  const crossBias = (Math.random() - 0.45) * (basePrice * 0.0006);

  const nsePrice = parseFloat((basePrice + crossBias * 0.5).toFixed(2));
  const bsePrice = parseFloat((basePrice - crossBias * 0.5).toFixed(2));

  const nseBids: DepthRung[] = [
    { price: parseFloat((nsePrice - 0.05).toFixed(2)), quantity: 850, orders: 12 },
    { price: parseFloat((nsePrice - 0.10).toFixed(2)), quantity: 1400, orders: 18 },
    { price: parseFloat((nsePrice - 0.15).toFixed(2)), quantity: 2200, orders: 25 },
    { price: parseFloat((nsePrice - 0.20).toFixed(2)), quantity: 3100, orders: 32 },
    { price: parseFloat((nsePrice - 0.25).toFixed(2)), quantity: 4500, orders: 40 },
  ];

  const nseAsks: DepthRung[] = [
    { price: parseFloat((nsePrice + 0.05).toFixed(2)), quantity: 920, orders: 14 },
    { price: parseFloat((nsePrice + 0.10).toFixed(2)), quantity: 1650, orders: 20 },
    { price: parseFloat((nsePrice + 0.15).toFixed(2)), quantity: 2400, orders: 28 },
    { price: parseFloat((nsePrice + 0.20).toFixed(2)), quantity: 3300, orders: 35 },
    { price: parseFloat((nsePrice + 0.25).toFixed(2)), quantity: 4800, orders: 45 },
  ];

  const bseBids: DepthRung[] = [
    { price: parseFloat((bsePrice - 0.05).toFixed(2)), quantity: 620, orders: 8 },
    { price: parseFloat((bsePrice - 0.10).toFixed(2)), quantity: 1100, orders: 14 },
    { price: parseFloat((bsePrice - 0.15).toFixed(2)), quantity: 1800, orders: 19 },
    { price: parseFloat((bsePrice - 0.20).toFixed(2)), quantity: 2600, orders: 24 },
    { price: parseFloat((bsePrice - 0.25).toFixed(2)), quantity: 3700, orders: 30 },
  ];

  const bseAsks: DepthRung[] = [
    { price: parseFloat((bsePrice + 0.05).toFixed(2)), quantity: 710, orders: 9 },
    { price: parseFloat((bsePrice + 0.10).toFixed(2)), quantity: 1250, orders: 15 },
    { price: parseFloat((bsePrice + 0.15).toFixed(2)), quantity: 1950, orders: 22 },
    { price: parseFloat((bsePrice + 0.20).toFixed(2)), quantity: 2800, orders: 29 },
    { price: parseFloat((bsePrice + 0.25).toFixed(2)), quantity: 4000, orders: 38 },
  ];

  return {
    symbol,
    timestamp: now,
    nse: {
      venue: 'NSE',
      symbol,
      timestamp: now,
      bids: nseBids,
      asks: nseAsks,
    },
    bse: {
      venue: 'BSE',
      symbol,
      timestamp: now,
      bids: bseBids,
      asks: bseAsks,
    },
  };
}
