import { OrderSide, OrderType, ProductType, StatutoryCharges } from '../types/trading';
import { calculateStatutoryCharges } from './taxEngine';

export interface WebhookBot {
  id: string;
  name: string;
  secretToken: string;
  enabled: boolean;
  maxDailyLoss: number; // Circuit breaker limit in ₹
  currentDailyLoss: number;
  totalAlertsReceived: number;
  ordersFilled: number;
  ordersRejected: number;
  netProfitLoss: number;
  createdAt: string;
}

export interface WebhookPayload {
  token: string;
  botName?: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  type?: OrderType;
  product?: ProductType;
  price?: number;
  triggerPrice?: number;
  comment?: string;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  botId: string;
  botName: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  status: 'FILLED' | 'REJECTED';
  reason?: string;
  latencyMs: number;
  statutoryTaxes: number;
}

export const DEFAULT_BOT: WebhookBot = {
  id: 'bot-tradingview-default',
  name: 'TradingView Supertrend & EMA Bot',
  secretToken: 'tc_sec_7a9f82d1b54c8e',
  enabled: true,
  maxDailyLoss: 10000, // ₹10,000 circuit breaker
  currentDailyLoss: 0,
  totalAlertsReceived: 0,
  ordersFilled: 0,
  ordersRejected: 0,
  netProfitLoss: 0,
  createdAt: '2026-11-03T11:00:00.000Z',
};

/**
 * Validates incoming webhook payload structure
 */
export function validateWebhookPayload(payload: any): { valid: boolean; error?: string; cleanPayload?: WebhookPayload } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Malformed JSON payload' };
  }

  const token = payload.token || payload.secret || payload.key;
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing authentication token' };
  }

  const rawSymbol = (payload.symbol || payload.ticker || '').toUpperCase().trim();
  if (!rawSymbol) {
    return { valid: false, error: 'Missing or invalid symbol' };
  }

  const rawSide = (payload.side || payload.action || '').toUpperCase().trim();
  if (rawSide !== 'BUY' && rawSide !== 'SELL') {
    return { valid: false, error: "Side must be either 'BUY' or 'SELL'" };
  }

  const rawQty = parseInt(payload.quantity || payload.qty || payload.contracts || 0, 10);
  if (isNaN(rawQty) || rawQty <= 0) {
    return { valid: false, error: 'Quantity must be a positive integer greater than 0' };
  }

  const rawType: OrderType = ['MARKET', 'LIMIT', 'SL', 'SL_M'].includes((payload.type || '').toUpperCase())
    ? payload.type.toUpperCase()
    : 'MARKET';

  const rawProduct: ProductType = (payload.product || 'MIS').toUpperCase() === 'CNC' ? 'CNC' : 'MIS';

  const cleanPayload: WebhookPayload = {
    token,
    botName: payload.botName || 'TradingView Bot',
    symbol: rawSymbol,
    side: rawSide as OrderSide,
    quantity: rawQty,
    type: rawType,
    product: rawProduct,
    price: payload.price ? parseFloat(payload.price) : undefined,
    triggerPrice: payload.triggerPrice ? parseFloat(payload.triggerPrice) : undefined,
    comment: payload.comment || 'Automated Webhook Order',
  };

  return { valid: true, cleanPayload };
}

/**
 * Checks Bot Circuit Breaker (Max Drawdown / Daily Loss)
 */
export function checkCircuitBreaker(bot: WebhookBot): { allowed: boolean; reason?: string } {
  if (!bot.enabled) {
    return { allowed: false, reason: `Bot '${bot.name}' is currently paused by user` };
  }

  if (bot.currentDailyLoss >= bot.maxDailyLoss) {
    return {
      allowed: false,
      reason: `Safety Circuit Breaker Tripped: Bot daily loss (-₹${bot.currentDailyLoss}) exceeded limit of ₹${bot.maxDailyLoss}. Automated trading halted.`,
    };
  }

  return { allowed: true };
}

/**
 * Generates ready-to-paste PineScript v5 alert template for TradingView
 */
export function generatePineScriptTemplate(webhookUrl: string, secretToken: string, symbol: string = 'RELIANCE'): string {
  return `//@version=5
// TradeCraft AI — Automated TradingView Webhook Bot Template
strategy("TradeCraft AI Webhook Strategy", overlay=true, margin_long=100, margin_short=100)

// 1. Technical Indicators
fastEma = ta.ema(close, 9)
slowEma = ta.ema(close, 21)

// 2. Buy & Sell Conditions
buyCondition = ta.crossover(fastEma, slowEma)
sellCondition = ta.crossunder(fastEma, slowEma)

// 3. Automated Webhook Alert JSON Payloads
buyAlertJson = '{"token": "${secretToken}", "symbol": "${symbol}", "side": "BUY", "quantity": 50, "type": "MARKET", "product": "MIS", "comment": "PineScript 9/21 EMA Bullish Crossover"}'
sellAlertJson = '{"token": "${secretToken}", "symbol": "${symbol}", "side": "SELL", "quantity": 50, "type": "MARKET", "product": "MIS", "comment": "PineScript 9/21 EMA Bearish Crossunder"}'

if (buyCondition)
    strategy.entry("Long", strategy.long, alert_message=buyAlertJson)

if (sellCondition)
    strategy.close("Long", alert_message=sellAlertJson)

// 4. Instructions for TradingView Alert Setup:
// Webhook URL: ${webhookUrl}
// In Alert Creation Dialog -> Check 'Webhook URL' and enter the URL above
// In Alert Message -> Enter: {{strategy.order.alert_message}}
`;
}
