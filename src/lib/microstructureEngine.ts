/**
 * Level-3 Order Book Analytics, Iceberg Detector & Institutional Dark Pool Volume Tracker Engine
 * TradeCraft AI — Sprint 15
 * 
 * Implements:
 * 1. Volume-Weighted Micro-Price (P_micro) & Micro-Price Spread Bias
 * 2. Multi-Depth (5, 10-rung) and Decay-Weighted Order Book Imbalance (OBI)
 * 3. Statistical Iceberg Order Detection with geometric sequence total volume inference
 * 4. Volume-Synchronized Probability of Toxicity (VPIN) based on Easley-López de Prado model
 * 5. SEBI Institutional Block Deal Filter (>= ₹10 Crore) and Bulk Sweep Classifier
 * 6. Synthetic L3 Order Book generator for real-time market simulation
 */

import {
  Level3PriceRung,
  MicroPriceMetrics,
  IcebergAlert,
  InstitutionalBlockPrint,
  Level3BookSnapshot,
  ToxicityStatus,
  BlockDealVenue,
  ParticipantCategory
} from '../types/microstructure';

/**
 * Calculates Volume-Weighted Micro-Price (P_micro)
 * Micro-price incorporates top-of-book queue pressure:
 * P_micro = (Q_bid * P_ask + Q_ask * P_bid) / (Q_bid + Q_ask)
 */
export function calculateMicroPrice(
  bestBidPrice: number,
  bestBidQty: number,
  bestAskPrice: number,
  bestAskQty: number,
  tickSize: number = 0.05
): { microPrice: number; midPrice: number; microPriceBiasTicks: number; spread: number } {
  const midPrice = (bestBidPrice + bestAskPrice) / 2;
  const spread = Math.max(0, bestAskPrice - bestBidPrice);
  const totalTopQty = bestBidQty + bestAskQty;

  if (totalTopQty <= 0) {
    return {
      microPrice: Number(midPrice.toFixed(2)),
      midPrice: Number(midPrice.toFixed(2)),
      microPriceBiasTicks: 0,
      spread: Number(spread.toFixed(2))
    };
  }

  // When bid queue is heavy (Q_bid >> Q_ask), P_micro approaches P_ask (bullish upward pressure)
  const microPrice = (bestBidQty * bestAskPrice + bestAskQty * bestBidPrice) / totalTopQty;
  const diff = microPrice - midPrice;
  const microPriceBiasTicks = tickSize > 0 ? Number((diff / tickSize).toFixed(2)) : 0;

  return {
    microPrice: Number(microPrice.toFixed(2)),
    midPrice: Number(midPrice.toFixed(2)),
    microPriceBiasTicks,
    spread: Number(spread.toFixed(2))
  };
}

/**
 * Calculates Multi-Depth Order Book Imbalance (OBI) across top K levels:
 * OBI(K) = (sum(BidQty_1..K) - sum(AskQty_1..K)) / (sum(BidQty_1..K) + sum(AskQty_1..K))
 * Range: [-1.0, +1.0]
 */
export function calculateOrderBookImbalance(
  bids: Level3PriceRung[],
  asks: Level3PriceRung[],
  depth: number = 5
): number {
  const k = Math.max(1, depth);
  const bidSlice = bids.slice(0, k);
  const askSlice = asks.slice(0, k);

  const sumBid = bidSlice.reduce((acc, rung) => acc + rung.visibleQuantity, 0);
  const sumAsk = askSlice.reduce((acc, rung) => acc + rung.visibleQuantity, 0);
  const total = sumBid + sumAsk;

  if (total <= 0) return 0;
  const imbalance = (sumBid - sumAsk) / total;
  return Number(Math.max(-1, Math.min(1, imbalance)).toFixed(4));
}

/**
 * Calculates Distance-Decay Weighted Order Book Imbalance
 * Prioritizes near-touch rungs over far rungs to filter out spoofed passive orders:
 * I_weighted = sum(Q_bid / k) - sum(Q_ask / k) / sum(Q_bid / k + Q_ask / k)
 */
export function calculateWeightedImbalance(
  bids: Level3PriceRung[],
  asks: Level3PriceRung[],
  depth: number = 10
): number {
  const k = Math.max(1, depth);
  let weightedBid = 0;
  let weightedAsk = 0;

  for (let i = 0; i < k; i++) {
    const weight = 1 / (i + 1);
    if (bids[i]) weightedBid += bids[i].visibleQuantity * weight;
    if (asks[i]) weightedAsk += asks[i].visibleQuantity * weight;
  }

  const total = weightedBid + weightedAsk;
  if (total <= 0) return 0;
  const imbalance = (weightedBid - weightedAsk) / total;
  return Number(Math.max(-1, Math.min(1, imbalance)).toFixed(4));
}

/**
 * Statistical Iceberg Detection Algorithm
 * Evaluates execution volume vs visible resting depth:
 * Reload Factor = CumulativeTradedVolume / VisibleQuantity
 * If Reload Factor >= 2.0 -> Iceberg Order detected.
 * Total quantity is inferred via: Q_tot = V_cum * (1 + 1 / ln(N_reload + 1))
 */
export function analyzeRungForIceberg(
  rung: Level3PriceRung,
  symbol: string,
  side: 'BUY' | 'SELL'
): IcebergAlert | null {
  if (rung.visibleQuantity <= 0) return null;

  const reloadFactor = rung.cumulativeTradedVolume / rung.visibleQuantity;
  if (reloadFactor < 2.0 && rung.reloadCount < 2) {
    return null;
  }

  // Estimate total hidden quantity using parametric logarithmic regression
  const effectiveReloads = Math.max(reloadFactor, rung.reloadCount);
  const expansionFactor = 1 + 1 / Math.log(effectiveReloads + 1);
  const estimatedTotalSize = Math.round(rung.cumulativeTradedVolume * expansionFactor);
  const estimatedHiddenVolume = Math.max(0, estimatedTotalSize - rung.cumulativeTradedVolume);
  const exhaustionPercent = Math.min(
    100,
    Number(((rung.cumulativeTradedVolume / estimatedTotalSize) * 100).toFixed(1))
  );

  const confidenceScore = Math.min(100, Math.round(50 + effectiveReloads * 10));

  let severity: 'NOTABLE' | 'HEAVY' | 'INSTITUTIONAL_WHALE' = 'NOTABLE';
  if (effectiveReloads >= 5.0 || estimatedTotalSize >= 25000) {
    severity = 'INSTITUTIONAL_WHALE';
  } else if (effectiveReloads >= 3.0 || estimatedTotalSize >= 10000) {
    severity = 'HEAVY';
  }

  return {
    id: `ICEBERG-${symbol}-${side}-${rung.price.toFixed(2)}-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
    symbol,
    side,
    price: rung.price,
    detectedReloads: Math.round(effectiveReloads),
    cumulativeVolumeTraded: rung.cumulativeTradedVolume,
    visibleDisplaySize: rung.visibleQuantity,
    estimatedTotalSize,
    estimatedHiddenVolume,
    exhaustionPercent,
    confidenceScore,
    severity
  };
}

/**
 * Volume-Synchronized Probability of Toxicity (VPIN)
 * VPIN = sum(|V_buy - V_sell|) / (N * V_bucket)
 * Measures high-frequency informed trading toxicity.
 */
export function calculateVPIN(
  volumeBuckets: Array<{ buyVolume: number; sellVolume: number }>
): { vpinScore: number; toxicityStatus: ToxicityStatus } {
  if (!volumeBuckets || volumeBuckets.length === 0) {
    return { vpinScore: 0.2, toxicityStatus: 'CALM' };
  }

  let totalImbalance = 0;
  let totalVolume = 0;

  for (const bucket of volumeBuckets) {
    totalImbalance += Math.abs(bucket.buyVolume - bucket.sellVolume);
    totalVolume += bucket.buyVolume + bucket.sellVolume;
  }

  if (totalVolume <= 0) {
    return { vpinScore: 0.2, toxicityStatus: 'CALM' };
  }

  const vpinScore = Number(Math.min(1.0, Math.max(0.0, totalImbalance / totalVolume)).toFixed(4));

  let toxicityStatus: ToxicityStatus = 'CALM';
  if (vpinScore > 0.6) {
    toxicityStatus = 'TOXIC_SWEEP';
  } else if (vpinScore > 0.35) {
    toxicityStatus = 'MODERATE';
  }

  return { vpinScore, toxicityStatus };
}

/**
 * Filter and categorize Institutional Block Deals (SEBI >= ₹10 Crore threshold)
 * and High-Impact Dark Liquidity Sweeps
 */
export function filterInstitutionalBlockDeals(
  trades: Array<{
    id?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    timestamp?: string;
    exchange?: 'NSE' | 'BSE';
  }>,
  vwapPrice?: number
): InstitutionalBlockPrint[] {
  const blocks: InstitutionalBlockPrint[] = [];

  for (const trade of trades) {
    const turnover = trade.price * trade.quantity;
    const turnoverCrores = Number((turnover / 10_000_000).toFixed(2));

    // Under SEBI guidelines, Block Window trades must be at least ₹10 Crore
    const isSebiBlock = turnoverCrores >= 10.0;
    const isLargeBulkSweep = turnoverCrores >= 2.0 && trade.quantity >= 10000;

    if (isSebiBlock || isLargeBulkSweep) {
      const vwap = vwapPrice || trade.price;
      const isAboveVWAP = trade.price >= vwap;
      const premiumOrDiscountPct = Number((((trade.price - vwap) / vwap) * 100).toFixed(2));

      // Deterministic venue & participant simulation based on turnover
      let venue: BlockDealVenue = 'CONTINUOUS_MARKET';
      if (isSebiBlock) {
        venue = Math.random() > 0.5 ? 'WINDOW_1_OPEN' : 'WINDOW_2_MIDDAY';
      }

      let participant: ParticipantCategory = 'FII';
      if (turnoverCrores > 50) participant = 'FII';
      else if (turnoverCrores > 20) participant = 'DII';
      else if (turnoverCrores > 10) participant = 'PROP_DESK';
      else participant = 'PROMOTER_CROSS';

      blocks.push({
        id: trade.id || `BLK-${trade.symbol}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: trade.timestamp || new Date().toLocaleTimeString('en-IN', { hour12: false }),
        symbol: trade.symbol,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        turnoverCrores,
        exchange: trade.exchange || 'NSE',
        venue,
        participant,
        isAboveVWAP,
        premiumOrDiscountPct
      });
    }
  }

  return blocks;
}

/**
 * Generates a realistic synthetic 10-level L3 Order Book snapshot with active icebergs,
 * Micro-price, multi-depth imbalances, and institutional block prints
 */
export function generateSyntheticLevel3Book(
  symbol: string,
  spotPrice: number,
  tickSize: number = 0.05
): Level3BookSnapshot {
  const bids: Level3PriceRung[] = [];
  const asks: Level3PriceRung[] = [];
  const activeIcebergs: IcebergAlert[] = [];

  // Generate 10 Bids (descending from spotPrice - tickSize)
  for (let i = 1; i <= 10; i++) {
    const price = Number((spotPrice - i * tickSize).toFixed(2));
    const baseQty = Math.round(1000 + Math.random() * 4000);
    const orderCount = Math.round(5 + Math.random() * 25);

    // Inject an iceberg on rung 2 or 4
    const isIcebergRung = i === 2 || i === 4;
    const reloadCount = isIcebergRung ? Math.round(3 + Math.random() * 4) : 0;
    const cumulativeTradedVolume = isIcebergRung
      ? Math.round(baseQty * (reloadCount + 0.5))
      : Math.round(baseQty * 0.3);

    const rung: Level3PriceRung = {
      price,
      visibleQuantity: baseQty,
      orderCount,
      cumulativeTradedVolume,
      reloadCount,
      hasIceberg: isIcebergRung,
      estimatedHiddenVolume: 0,
      exhaustionPercent: 0,
      distanceTicks: i
    };

    if (isIcebergRung) {
      const alert = analyzeRungForIceberg(rung, symbol, 'BUY');
      if (alert) {
        rung.estimatedHiddenVolume = alert.estimatedHiddenVolume;
        rung.exhaustionPercent = alert.exhaustionPercent;
        activeIcebergs.push(alert);
      }
    }

    bids.push(rung);
  }

  // Generate 10 Asks (ascending from spotPrice + tickSize)
  for (let i = 1; i <= 10; i++) {
    const price = Number((spotPrice + i * tickSize).toFixed(2));
    const baseQty = Math.round(1000 + Math.random() * 4000);
    const orderCount = Math.round(5 + Math.random() * 25);

    // Inject an iceberg on rung 3
    const isIcebergRung = i === 3;
    const reloadCount = isIcebergRung ? Math.round(3 + Math.random() * 3) : 0;
    const cumulativeTradedVolume = isIcebergRung
      ? Math.round(baseQty * (reloadCount + 0.4))
      : Math.round(baseQty * 0.25);

    const rung: Level3PriceRung = {
      price,
      visibleQuantity: baseQty,
      orderCount,
      cumulativeTradedVolume,
      reloadCount,
      hasIceberg: isIcebergRung,
      estimatedHiddenVolume: 0,
      exhaustionPercent: 0,
      distanceTicks: i
    };

    if (isIcebergRung) {
      const alert = analyzeRungForIceberg(rung, symbol, 'SELL');
      if (alert) {
        rung.estimatedHiddenVolume = alert.estimatedHiddenVolume;
        rung.exhaustionPercent = alert.exhaustionPercent;
        activeIcebergs.push(alert);
      }
    }

    asks.push(rung);
  }

  // Micro-price metrics
  const microCalc = calculateMicroPrice(
    bids[0].price,
    bids[0].visibleQuantity,
    asks[0].price,
    asks[0].visibleQuantity,
    tickSize
  );

  const bookImbalance5 = calculateOrderBookImbalance(bids, asks, 5);
  const bookImbalance10 = calculateOrderBookImbalance(bids, asks, 10);
  const imbalanceWeighted = calculateWeightedImbalance(bids, asks, 10);

  // Synthetic VPIN volume buckets
  const syntheticBuckets = [
    { buyVolume: 50000, sellVolume: 35000 },
    { buyVolume: 42000, sellVolume: 28000 },
    { buyVolume: 61000, sellVolume: 54000 },
    { buyVolume: 39000, sellVolume: 25000 },
    { buyVolume: 48000, sellVolume: 40000 }
  ];
  const { vpinScore, toxicityStatus } = calculateVPIN(syntheticBuckets);

  const totalBidDepth = bids.reduce((acc, r) => acc + r.visibleQuantity, 0);
  const totalAskDepth = asks.reduce((acc, r) => acc + r.visibleQuantity, 0);
  const spreadBps = Number(((microCalc.spread / microCalc.midPrice) * 10000).toFixed(1));

  const metrics: MicroPriceMetrics = {
    bestBid: bids[0].price,
    bestAsk: asks[0].price,
    midPrice: microCalc.midPrice,
    microPrice: microCalc.microPrice,
    microPriceBiasTicks: microCalc.microPriceBiasTicks,
    spread: microCalc.spread,
    spreadBps,
    bookImbalance5,
    bookImbalance10,
    imbalanceWeighted,
    vpinScore,
    toxicityStatus,
    totalBidDepth,
    totalAskDepth
  };

  // Generate synthetic institutional block prints
  const syntheticTrades = [
    {
      id: `BLK-1-${symbol}`,
      symbol,
      side: 'BUY' as const,
      price: Number((spotPrice + 0.1).toFixed(2)),
      quantity: 150000,
      timestamp: '14:12:05',
      exchange: 'NSE' as const
    },
    {
      id: `BLK-2-${symbol}`,
      symbol,
      side: 'BUY' as const,
      price: spotPrice,
      quantity: 65000,
      timestamp: '11:45:20',
      exchange: 'NSE' as const
    },
    {
      id: `BLK-3-${symbol}`,
      symbol,
      side: 'SELL' as const,
      price: Number((spotPrice - 0.25).toFixed(2)),
      quantity: 85000,
      timestamp: '09:02:14',
      exchange: 'BSE' as const
    }
  ];

  const recentBlockPrints = filterInstitutionalBlockDeals(syntheticTrades, spotPrice);

  return {
    timestamp: Date.now(),
    symbol,
    bids,
    asks,
    metrics,
    activeIcebergs,
    recentBlockPrints
  };
}
