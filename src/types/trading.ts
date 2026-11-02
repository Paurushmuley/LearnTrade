export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
export type OrderSide = 'BUY' | 'SELL';
export type ProductType = 'MIS' | 'CNC'; // MIS: Intraday (5x margin), CNC: Cash & Carry (Delivery 1x)
export type OrderStatus = 'PENDING' | 'TRIGGER_PENDING' | 'FILLED' | 'REJECTED' | 'CANCELLED';

export interface StatutoryCharges {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  sebiCharges: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
  breakevenPerShare: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  product: ProductType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  executedPrice?: number;
  status: OrderStatus;
  charges: StatutoryCharges;
  placedAt: string;
  executedAt?: string;
  rejectReason?: string;
}

export interface Position {
  symbol: string;
  product: ProductType;
  quantity: number; // positive = long, negative = short
  averagePrice: number;
  currentPrice: number;
  investedAmount: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  totalChargesPaid: number;
  netPnL: number; // realizedPnL - totalChargesPaid
}

export interface PortfolioSummary {
  startingCapital: number;
  availableCash: number;
  usedMargin: number;
  totalPortfolioValue: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalChargesDeducted: number;
  netPnL: number;
  winRate: number;
  disciplineScore: number; // 0 - 100 Psychological Quotient (PQ)
}

export interface TickerInfo {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  previousClose: number;
  volume: number;
  lotSize: number;
}

export interface Candle {
  time: number; // UNIX timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type AIProviderType = 'gemini' | 'openai' | 'ollama';

export interface AIConfig {
  provider: AIProviderType;
  geminiKey?: string;
  openaiKey?: string;
  ollamaUrl?: string;
  model?: string;
}

export interface TradeAudit {
  tradeId: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnL: number;
  netPnL: number;
  charges: number;
  durationMinutes: number;
  riskRewardRatio: number;
  behavioralFlags: {
    fomoEntry: boolean;
    revengeTrade: boolean;
    overleveraged: boolean;
    poorRiskReward: boolean;
    stopLossTampered: boolean;
  };
  coachFeedback: string;
  suggestedAction: string;
  disciplineScoreDelta: number; // e.g. -5 for revenge trade, +3 for disciplined exit
}

export interface StrategyRule {
  id: string;
  name: string;
  timeframe: string;
  entryConditions: string[];
  exitConditions: string[];
  stopLossPercent: number;
  targetPercent: number;
}

export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  grossPnL: number;
  netPnL: number;
  charges: number;
  returnPercent: number;
  reason: 'TARGET' | 'STOP_LOSS' | 'SIGNAL_EXIT';
}

export interface BacktestResult {
  strategyName: string;
  symbol: string;
  timeframe: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossProfit: number;
  totalCharges: number;
  netProfit: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  pythonCode: string;
}
