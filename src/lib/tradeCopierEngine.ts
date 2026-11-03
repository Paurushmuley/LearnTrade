// TradeCraft AI — Institutional Trade Copier & Cross-Account Multi-Broker Engine
// Multi-broker execution bridge simulating Zerodha Kite, Groww & Upstox with realistic latency and slippage

import {
  BrokerPlatform,
  SlaveAccountConfig,
  MasterTradeEvent,
  SlaveExecutionReceipt,
  CopierBridgeSummary,
} from '../types/tradeCopier';
import { calculateStatutoryCharges } from './taxEngine';
import { Position } from '../types/trading';

export const PRELOADED_SLAVE_ACCOUNTS: SlaveAccountConfig[] = [
  {
    id: 'slave_zerodha_funded',
    name: 'Zerodha Kite Funded Prop Desk',
    broker: 'ZERODHA_KITE',
    accountNumber: 'ZER-KITE-88219',
    startingCapital: 1000000,
    availableCash: 1000000,
    usedMargin: 0,
    riskMultiplier: 1.0,
    sizingMode: 'EQUITY_PROPORTIONAL',
    enabled: true,
    maxSlippagePct: 0.35,
    openPositions: [],
    realizedPnL: 0,
    unrealizedPnL: 0,
    totalStatutoryTaxesPaid: 0,
  },
  {
    id: 'slave_groww_swing',
    name: 'Groww Positional Swing Sub-Account',
    broker: 'GROWW',
    accountNumber: 'GRW-SWING-44012',
    startingCapital: 500000,
    availableCash: 500000,
    usedMargin: 0,
    riskMultiplier: 0.5,
    sizingMode: 'EQUITY_PROPORTIONAL',
    enabled: true,
    maxSlippagePct: 0.40,
    openPositions: [],
    realizedPnL: 0,
    unrealizedPnL: 0,
    totalStatutoryTaxesPaid: 0,
  },
  {
    id: 'slave_upstox_scalp',
    name: 'Upstox Pro Velocity Scalper',
    broker: 'UPSTOX',
    accountNumber: 'UPX-SCALP-99130',
    startingCapital: 250000,
    availableCash: 250000,
    usedMargin: 0,
    riskMultiplier: 1.5,
    sizingMode: 'FIXED_MULTIPLIER',
    enabled: true,
    maxSlippagePct: 0.30,
    openPositions: [],
    realizedPnL: 0,
    unrealizedPnL: 0,
    totalStatutoryTaxesPaid: 0,
  },
];

const STORAGE_KEY_SLAVES = 'tradecraft_copier_slaves';
const STORAGE_KEY_RECEIPTS = 'tradecraft_copier_receipts';

/**
 * Returns exchange lot size for Indian equities & derivatives
 */
export function getLotSizeForSymbol(symbol: string): number {
  const upper = symbol.toUpperCase();
  if (upper.includes('BANKNIFTY')) return 15;
  if (upper.includes('NIFTY')) return 25;
  if (upper.includes('FINNIFTY')) return 40;
  return 1; // Standard cash equity lot size
}

/**
 * Calculates allowable executable quantity for a slave account
 */
export function calculateSlaveQuantity(params: {
  masterQuantity: number;
  masterEquity: number;
  slaveAccount: SlaveAccountConfig;
  symbol: string;
  fillPrice: number;
  productType: 'MIS' | 'CNC';
  stopLossDistance?: number;
}): { quantity: number; error?: string } {
  const { masterQuantity, masterEquity, slaveAccount, symbol, fillPrice, productType, stopLossDistance } = params;

  if (masterQuantity <= 0) return { quantity: 0 };

  const lotSize = getLotSizeForSymbol(symbol);
  let rawQty = masterQuantity;

  // 1. Sizing Mode
  if (slaveAccount.sizingMode === 'EQUITY_PROPORTIONAL') {
    const slaveEquity = slaveAccount.availableCash + slaveAccount.usedMargin;
    const equityRatio = slaveEquity / Math.max(1000, masterEquity);
    rawQty = masterQuantity * equityRatio * slaveAccount.riskMultiplier;
  } else if (slaveAccount.sizingMode === 'FIXED_MULTIPLIER') {
    rawQty = masterQuantity * slaveAccount.riskMultiplier;
  } else if (slaveAccount.sizingMode === 'RISK_PARITY') {
    const riskDistance = stopLossDistance && stopLossDistance > 0 ? stopLossDistance : fillPrice * 0.015;
    const riskCapital = (slaveAccount.availableCash + slaveAccount.usedMargin) * 0.015; // 1.5% risk
    rawQty = riskCapital / riskDistance;
  }

  // 2. Lot Size Clamping
  let roundedQty = 1;
  if (lotSize > 1) {
    roundedQty = Math.max(lotSize, Math.round(rawQty / lotSize) * lotSize);
  } else {
    roundedQty = Math.max(1, Math.round(rawQty));
  }

  // 3. Margin Sufficiency Verification
  const marginFactor = productType === 'MIS' ? 0.20 : 1.0; // 5x leverage for MIS
  const requiredMargin = roundedQty * fillPrice * marginFactor;

  if (requiredMargin > slaveAccount.availableCash) {
    // Attempt to scale down to affordable lots
    const affordableLots = Math.floor(slaveAccount.availableCash / (fillPrice * marginFactor * lotSize));
    if (affordableLots <= 0) {
      return {
        quantity: 0,
        error: `Insufficient margin. Required ₹${requiredMargin.toLocaleString(
          'en-IN'
        )}, Available ₹${slaveAccount.availableCash.toLocaleString('en-IN')}`,
      };
    }
    roundedQty = affordableLots * lotSize;
  }

  return { quantity: roundedQty };
}

/**
 * Simulates broker network latency, stochastic slippage, and price deviation filters
 */
export function simulateBrokerExecution(params: {
  masterPrice: number;
  side: 'BUY' | 'SELL';
  broker: BrokerPlatform;
  maxSlippagePct: number;
}): {
  status: 'FILLED' | 'ABORTED_SLIPPAGE_BREACH' | 'FAILED_NETWORK';
  slaveFillPrice: number;
  slippageBps: number;
  latencyMs: number;
  errorMessage?: string;
} {
  const { masterPrice, side, broker, maxSlippagePct } = params;

  // Broker latency profiles
  let meanLatency = 60;
  let jitter = 15;
  let baseSlipRate = 0.0002; // 2 bps

  if (broker === 'GROWW') {
    meanLatency = 135;
    jitter = 35;
    baseSlipRate = 0.0005; // 5 bps
  } else if (broker === 'UPSTOX') {
    meanLatency = 80;
    jitter = 20;
    baseSlipRate = 0.0003; // 3 bps
  }

  // Gaussian-approximated latency
  const z = (Math.random() + Math.random() + Math.random() - 1.5) * 1.5;
  const latencyMs = Math.max(25, Math.round(meanLatency + z * jitter));

  // Stochastic slippage with adverse selection
  const slipMultiplier = Math.sqrt(latencyMs / 50) * (0.8 + Math.random() * 0.6);
  const slippageFraction = baseSlipRate * slipMultiplier;
  const slippageBps = Number((slippageFraction * 10000).toFixed(1));

  // Adverse slippage: BUY fills higher, SELL fills lower
  const priceDelta = masterPrice * slippageFraction;
  const slaveFillPrice = Number(
    (side === 'BUY' ? masterPrice + priceDelta : masterPrice - priceDelta).toFixed(2)
  );

  // Maximum Allowable Slippage Deviation Filter (e.g. 0.35%)
  const priceDeviationPct = Math.abs(slaveFillPrice - masterPrice) / masterPrice;
  if (priceDeviationPct > maxSlippagePct / 100) {
    return {
      status: 'ABORTED_SLIPPAGE_BREACH',
      slaveFillPrice: masterPrice,
      slippageBps,
      latencyMs,
      errorMessage: `Slippage deviation ${(priceDeviationPct * 100).toFixed(
        2
      )}% exceeded maximum allowable ceiling (${maxSlippagePct}%). Execution aborted by Slippage Guard.`,
    };
  }

  return {
    status: 'FILLED',
    slaveFillPrice,
    slippageBps,
    latencyMs,
  };
}

/**
 * Broadcasts a Master Trade Event to all enabled Slave Accounts
 */
export function dispatchMasterTradeToSlaves(params: {
  masterEvent: MasterTradeEvent;
  masterEquity: number;
  slaves: SlaveAccountConfig[];
}): {
  updatedSlaves: SlaveAccountConfig[];
  receipts: SlaveExecutionReceipt[];
} {
  const { masterEvent, masterEquity, slaves } = params;
  const receipts: SlaveExecutionReceipt[] = [];

  const updatedSlaves = slaves.map((slave) => {
    if (!slave.enabled) {
      return slave;
    }

    // 1. Calculate allocated quantity
    const sizing = calculateSlaveQuantity({
      masterQuantity: masterEvent.quantity,
      masterEquity,
      slaveAccount: slave,
      symbol: masterEvent.symbol,
      fillPrice: masterEvent.fillPrice,
      productType: masterEvent.productType as 'MIS' | 'CNC',
      stopLossDistance: masterEvent.stopLossPrice
        ? Math.abs(masterEvent.fillPrice - masterEvent.stopLossPrice)
        : undefined,
    });

    if (sizing.quantity <= 0) {
      receipts.push({
        receiptId: `REC-${Date.now().toString(36).toUpperCase()}-${slave.id.slice(0, 4)}`,
        masterEventId: masterEvent.eventId,
        slaveAccountId: slave.id,
        slaveAccountName: slave.name,
        broker: slave.broker,
        status: 'REJECTED_INSUFFICIENT_MARGIN',
        requestedQty: masterEvent.quantity,
        filledQty: 0,
        masterPrice: masterEvent.fillPrice,
        slaveFillPrice: masterEvent.fillPrice,
        slippageBps: 0,
        latencyMs: 30,
        statutoryTaxes: 0,
        executedAt: new Date().toISOString(),
        errorMessage: sizing.error,
      });
      return slave;
    }

    // 2. Simulate broker latency & slippage
    const sim = simulateBrokerExecution({
      masterPrice: masterEvent.fillPrice,
      side: masterEvent.side,
      broker: slave.broker,
      maxSlippagePct: slave.maxSlippagePct,
    });

    if (sim.status !== 'FILLED') {
      receipts.push({
        receiptId: `REC-${Date.now().toString(36).toUpperCase()}-${slave.id.slice(0, 4)}`,
        masterEventId: masterEvent.eventId,
        slaveAccountId: slave.id,
        slaveAccountName: slave.name,
        broker: slave.broker,
        status: sim.status,
        requestedQty: sizing.quantity,
        filledQty: 0,
        masterPrice: masterEvent.fillPrice,
        slaveFillPrice: masterEvent.fillPrice,
        slippageBps: sim.slippageBps,
        latencyMs: sim.latencyMs,
        statutoryTaxes: 0,
        executedAt: new Date().toISOString(),
        errorMessage: sim.errorMessage,
      });
      return slave;
    }

    // 3. Calculate Indian statutory charges
    const taxes = calculateStatutoryCharges(
      masterEvent.side,
      masterEvent.productType as 'MIS' | 'CNC',
      sim.slaveFillPrice,
      sizing.quantity
    );

    // 4. Update Slave Account Balances & Position Book
    const marginFactor = masterEvent.productType === 'MIS' ? 0.20 : 1.0;
    const requiredMargin = sizing.quantity * sim.slaveFillPrice * marginFactor;
    const newAvailableCash = Math.max(0, slave.availableCash - requiredMargin - taxes.totalCharges);
    const newUsedMargin = slave.usedMargin + requiredMargin;

    // Position handling
    const positions = [...slave.openPositions];
    const existingIndex = positions.findIndex(
      (p) => p.symbol === masterEvent.symbol && p.product === masterEvent.productType
    );

    const signedQty = masterEvent.side === 'BUY' ? sizing.quantity : -sizing.quantity;

    if (existingIndex === -1) {
      positions.push({
        symbol: masterEvent.symbol,
        product: masterEvent.productType as 'MIS' | 'CNC',
        quantity: signedQty,
        averagePrice: sim.slaveFillPrice,
        currentPrice: sim.slaveFillPrice,
        investedAmount: sim.slaveFillPrice * sizing.quantity,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: taxes.totalCharges,
        netPnL: -taxes.totalCharges,
      });
    } else {
      const pos = { ...positions[existingIndex] };
      pos.quantity += signedQty;
      pos.totalChargesPaid += taxes.totalCharges;
      pos.netPnL -= taxes.totalCharges;
      positions[existingIndex] = pos;
    }

    receipts.push({
      receiptId: `REC-${Date.now().toString(36).toUpperCase()}-${slave.id.slice(0, 4)}`,
      masterEventId: masterEvent.eventId,
      slaveAccountId: slave.id,
      slaveAccountName: slave.name,
      broker: slave.broker,
      status: 'FILLED',
      requestedQty: sizing.quantity,
      filledQty: sizing.quantity,
      masterPrice: masterEvent.fillPrice,
      slaveFillPrice: sim.slaveFillPrice,
      slippageBps: sim.slippageBps,
      latencyMs: sim.latencyMs,
      statutoryTaxes: taxes.totalCharges,
      executedAt: new Date().toISOString(),
    });

    return {
      ...slave,
      availableCash: Number(newAvailableCash.toFixed(2)),
      usedMargin: Number(newUsedMargin.toFixed(2)),
      totalStatutoryTaxesPaid: Number((slave.totalStatutoryTaxesPaid + taxes.totalCharges).toFixed(2)),
      openPositions: positions.filter((p) => p.quantity !== 0),
    };
  });

  return { updatedSlaves, receipts };
}

/**
 * Emergency Global Kill Switch: Closes all positions across all slave accounts
 */
export function executeEmergencyKillSwitch(
  slaves: SlaveAccountConfig[],
  currentPrices: Record<string, number>
): {
  updatedSlaves: SlaveAccountConfig[];
  liquidatedCount: number;
} {
  let liquidatedCount = 0;

  const updatedSlaves = slaves.map((slave) => {
    let releasedCash = slave.usedMargin;
    let incrementalRealized = 0;
    let incrementalTaxes = 0;

    slave.openPositions.forEach((pos) => {
      liquidatedCount++;
      const currentPrice = currentPrices[pos.symbol] || pos.averagePrice;
      const grossPnL =
        pos.quantity > 0
          ? (currentPrice - pos.averagePrice) * pos.quantity
          : (pos.averagePrice - currentPrice) * Math.abs(pos.quantity);

      const closingSide = pos.quantity > 0 ? 'SELL' : 'BUY';
      const taxes = calculateStatutoryCharges(closingSide, pos.product, currentPrice, Math.abs(pos.quantity));

      incrementalRealized += grossPnL;
      incrementalTaxes += taxes.totalCharges;
    });

    return {
      ...slave,
      availableCash: Number(
        (slave.availableCash + releasedCash + incrementalRealized - incrementalTaxes).toFixed(2)
      ),
      usedMargin: 0,
      realizedPnL: Number((slave.realizedPnL + incrementalRealized - incrementalTaxes).toFixed(2)),
      totalStatutoryTaxesPaid: Number((slave.totalStatutoryTaxesPaid + incrementalTaxes).toFixed(2)),
      openPositions: [],
    };
  });

  return { updatedSlaves, liquidatedCount };
}

/**
 * LocalStorage Helpers
 */
export function loadSavedSlaveAccounts(): SlaveAccountConfig[] {
  if (typeof window === 'undefined') return PRELOADED_SLAVE_ACCOUNTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SLAVES);
    return saved ? JSON.parse(saved) : PRELOADED_SLAVE_ACCOUNTS;
  } catch {
    return PRELOADED_SLAVE_ACCOUNTS;
  }
}

export function saveSlaveAccounts(slaves: SlaveAccountConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SLAVES, JSON.stringify(slaves));
  } catch {
    // ignore quota
  }
}

export function loadSavedReceipts(): SlaveExecutionReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_RECEIPTS);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveReceipts(receipts: SlaveExecutionReceipt[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(receipts.slice(0, 100)));
  } catch {
    // ignore quota
  }
}
