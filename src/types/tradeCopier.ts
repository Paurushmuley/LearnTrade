// TradeCraft AI — Institutional Trade Copier & Cross-Account Multi-Broker Bridge Types

import { OrderSide, ProductType, OrderType, Position } from './trading';

export type BrokerPlatform = 'ZERODHA_KITE' | 'GROWW' | 'UPSTOX';

export type SizingMode = 'EQUITY_PROPORTIONAL' | 'FIXED_MULTIPLIER' | 'RISK_PARITY';

export type SlaveExecutionStatus =
  | 'FILLED'
  | 'REJECTED_INSUFFICIENT_MARGIN'
  | 'ABORTED_SLIPPAGE_BREACH'
  | 'FAILED_NETWORK';

export interface SlaveAccountConfig {
  id: string;
  name: string;
  broker: BrokerPlatform;
  accountNumber: string;
  startingCapital: number;
  availableCash: number;
  usedMargin: number;
  riskMultiplier: number; // e.g. 0.5x, 1.0x, 2.0x
  sizingMode: SizingMode;
  enabled: boolean;
  maxSlippagePct: number; // default 0.35%
  openPositions: Position[];
  realizedPnL: number;
  unrealizedPnL: number;
  totalStatutoryTaxesPaid: number;
}

export interface MasterTradeEvent {
  eventId: string;
  masterAccountId: string;
  timestamp: string; // ISO 8601
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  productType: ProductType;
  quantity: number;
  fillPrice: number;
  stopLossPrice?: number;
  targetPrice?: number;
}

export interface SlaveExecutionReceipt {
  receiptId: string;
  masterEventId: string;
  slaveAccountId: string;
  slaveAccountName: string;
  broker: BrokerPlatform;
  status: SlaveExecutionStatus;
  requestedQty: number;
  filledQty: number;
  masterPrice: number;
  slaveFillPrice: number;
  slippageBps: number;
  latencyMs: number;
  statutoryTaxes: number;
  executedAt: string;
  errorMessage?: string;
}

export interface CopierBridgeSummary {
  masterAccountId: string;
  masterEquity: number;
  activeSlavesCount: number;
  totalSyncedTrades: number;
  totalCopiedVolume: number;
  globalSlippageAvgBps: number;
}
