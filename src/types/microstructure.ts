/**
 * Type definitions for TradeCraft AI - Level-3 Order Book Analytics,
 * Iceberg Detector & Institutional Dark Pool Volume Tracker (Sprint 15)
 */

export interface Level3PriceRung {
  price: number;
  visibleQuantity: number;
  orderCount: number;
  cumulativeTradedVolume: number;
  reloadCount: number;
  hasIceberg: boolean;
  estimatedHiddenVolume: number;
  exhaustionPercent: number; // 0 - 100%
  distanceTicks: number;
}

export type ToxicityStatus = 'CALM' | 'MODERATE' | 'TOXIC_SWEEP';

export interface MicroPriceMetrics {
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  microPrice: number;
  microPriceBiasTicks: number; // microPrice - midPrice in tick units
  spread: number;
  spreadBps: number;
  bookImbalance5: number; // [-1.0, +1.0]
  bookImbalance10: number; // [-1.0, +1.0]
  imbalanceWeighted: number; // [-1.0, +1.0]
  vpinScore: number; // [0.0, 1.0]
  toxicityStatus: ToxicityStatus;
  totalBidDepth: number;
  totalAskDepth: number;
}

export interface IcebergAlert {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  detectedReloads: number;
  cumulativeVolumeTraded: number;
  visibleDisplaySize: number;
  estimatedTotalSize: number;
  estimatedHiddenVolume: number;
  exhaustionPercent: number;
  confidenceScore: number; // 0 - 100%
  severity: 'NOTABLE' | 'HEAVY' | 'INSTITUTIONAL_WHALE';
}

export type BlockDealVenue = 'WINDOW_1_OPEN' | 'WINDOW_2_MIDDAY' | 'CONTINUOUS_MARKET';
export type ParticipantCategory = 'FII' | 'DII' | 'PROP_DESK' | 'PROMOTER_CROSS';

export interface InstitutionalBlockPrint {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  turnoverCrores: number;
  exchange: 'NSE' | 'BSE';
  venue: BlockDealVenue;
  participant: ParticipantCategory;
  isAboveVWAP: boolean;
  premiumOrDiscountPct: number;
}

export interface Level3BookSnapshot {
  timestamp: number;
  symbol: string;
  bids: Level3PriceRung[];
  asks: Level3PriceRung[];
  metrics: MicroPriceMetrics;
  activeIcebergs: IcebergAlert[];
  recentBlockPrints: InstitutionalBlockPrint[];
}

// Aliases for BRD terminology compatibility
export type L2DepthRung = Level3PriceRung;
export type IcebergDetected = IcebergAlert;
export type BlockDealPrint = InstitutionalBlockPrint;

