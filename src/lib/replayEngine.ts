import { Candle } from '../types/trading';

export interface ReplayState {
  isReplayActive: boolean;
  isPlaying: boolean;
  speed: 1 | 2 | 5 | 10;
  playheadIndex: number;
  totalCandles: number;
}

export interface DOMRung {
  price: number;
  quantity: number;
  orders: number;
  percent: number; // For visual depth bar (0-100)
}

export interface Level2OrderBook {
  bids: DOMRung[];
  asks: DOMRung[];
  spread: number;
  totalBidQty: number;
  totalAskQty: number;
  imbalancePercent: number; // Positive = Bullish bid pressure, Negative = Bearish ask pressure
}

/**
 * Returns the speed interval in milliseconds for the replay playhead
 */
export function getReplaySpeedIntervalMs(speed: 1 | 2 | 5 | 10): number {
  switch (speed) {
    case 1: return 1200; // 1x = 1.2s per bar
    case 2: return 600;  // 2x = 0.6s per bar
    case 5: return 250;  // 5x = 0.25s per bar
    case 10: return 100; // 10x = 0.1s per bar
    default: return 1000;
  }
}

/**
 * Slices the full candle history buffer up to the current playhead index
 * (Eliminating future lookahead bias)
 */
export function sliceCandlesForReplay(allCandles: Candle[], playheadIndex: number): Candle[] {
  if (!allCandles || allCandles.length === 0) return [];
  const safeIndex = Math.min(Math.max(1, playheadIndex), allCandles.length - 1);
  return allCandles.slice(0, safeIndex + 1);
}

/**
 * Generates institutional Level-2 Market Depth (Best 5 Bids & Best 5 Asks)
 * with dynamic bid-ask volume imbalance.
 */
export function generateLevel2DOM(currentPrice: number, tickSize: number = 0.05): Level2OrderBook {
  const p = Number(currentPrice.toFixed(2));
  const bids: DOMRung[] = [];
  const asks: DOMRung[] = [];

  let totalBidQty = 0;
  let totalAskQty = 0;

  // Generate 5 Ask levels above current price (increasing)
  for (let i = 1; i <= 5; i++) {
    const askPrice = Number((p + i * tickSize).toFixed(2));
    const qty = Math.floor(Math.random() * 8500 + 1200);
    const orders = Math.floor(qty / (Math.random() * 80 + 20)) + 1;
    totalAskQty += qty;
    asks.push({
      price: askPrice,
      quantity: qty,
      orders,
      percent: 0,
    });
  }

  // Generate 5 Bid levels below current price (decreasing)
  for (let i = 1; i <= 5; i++) {
    const bidPrice = Number((p - i * tickSize).toFixed(2));
    const qty = Math.floor(Math.random() * 8500 + 1200);
    const orders = Math.floor(qty / (Math.random() * 80 + 20)) + 1;
    totalBidQty += qty;
    bids.push({
      price: bidPrice,
      quantity: qty,
      orders,
      percent: 0,
    });
  }

  // Calculate percentages relative to max rung quantity for depth visualization
  const maxRungQty = Math.max(...bids.map(b => b.quantity), ...asks.map(a => a.quantity), 1);
  bids.forEach(b => { b.percent = Number(((b.quantity / maxRungQty) * 100).toFixed(1)); });
  asks.forEach(a => { a.percent = Number(((a.quantity / maxRungQty) * 100).toFixed(1)); });

  const spread = Number((asks[0].price - bids[0].price).toFixed(2));
  const totalVolume = totalBidQty + totalAskQty;
  const imbalancePercent = totalVolume > 0
    ? Number((((totalBidQty - totalAskQty) / totalVolume) * 100).toFixed(1))
    : 0;

  return {
    bids,
    asks,
    spread,
    totalBidQty,
    totalAskQty,
    imbalancePercent,
  };
}
