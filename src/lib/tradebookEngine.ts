// TradeCraft AI — Broker Tradebook Parser & Behavioral Bias Engine
// Supports Zerodha Kite, Groww, and Generic CSV formats with FIFO trade matching

export interface RawBrokerTrade {
  id: string;
  symbol: string;
  tradeDate: string; // YYYY-MM-DD
  executionTime: string; // HH:MM:SS or YYYY-MM-DDTHH:MM:SS
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderId?: string;
  broker: 'ZERODHA' | 'GROWW' | 'GENERIC';
}

export interface ClosedRoundTripTrade {
  id: string;
  symbol: string;
  entryTime: string;
  exitTime: string;
  holdingMinutes: number;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  statutoryFees: number;
  netPnl: number;
  isWinner: boolean;
  tags: string[];
}

export interface BiasClassification {
  name: string;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  scoreDisplay: string;
  description: string;
  recommendation: string;
}

export interface BehavioralAuditReport {
  totalClosedTrades: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  grossPnl: number;
  totalStatutoryFees: number;
  netPnl: number;
  feeErosionRatio: number; // Statutory charges as % of gross profit
  avgWinHoldingMins: number;
  avgLossHoldingMins: number;
  dispositionRatio: number; // Holding duration of losers vs winners
  revengeTradeCount: number;
  revengeTradingIndex: number; // % of trades that are revenge entries
  martingaleCount: number;
  maxConsecutiveLosses: number;
  disciplineScore: number; // 0 to 100
  biases: BiasClassification[];
}

/**
 * Standard CSV line splitter respecting quoted cells with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

/**
 * Parses Zerodha Kite Tradebook CSV format
 * Standard headers: symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,order_id,trade_id,order_execution_time
 */
export function parseZerodhaCSV(content: string): RawBrokerTrade[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const symbolIdx = headers.findIndex(h => h === 'symbol');
  const dateIdx = headers.findIndex(h => h === 'trade_date' || h === 'date');
  const typeIdx = headers.findIndex(h => h === 'trade_type' || h === 'type');
  const qtyIdx = headers.findIndex(h => h === 'quantity' || h === 'qty');
  const priceIdx = headers.findIndex(h => h === 'price');
  const timeIdx = headers.findIndex(h => h === 'order_execution_time' || h === 'time');
  const orderIdIdx = headers.findIndex(h => h === 'order_id');

  const trades: RawBrokerTrade[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= Math.max(symbolIdx, typeIdx, qtyIdx, priceIdx)) continue;

    const rawSymbol = cols[symbolIdx] || '';
    const rawType = (cols[typeIdx] || '').toUpperCase();
    const qty = Math.abs(parseFloat(cols[qtyIdx])) || 0;
    const price = parseFloat(cols[priceIdx]) || 0;
    const date = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().split('T')[0];
    const time = timeIdx >= 0 ? cols[timeIdx] : '09:15:00';
    const orderId = orderIdIdx >= 0 ? cols[orderIdIdx] : `z-${i}`;

    if (!rawSymbol || qty <= 0 || price <= 0 || (rawType !== 'BUY' && rawType !== 'SELL')) {
      continue;
    }

    trades.push({
      id: `z-${i}-${Date.now()}`,
      symbol: rawSymbol.toUpperCase().replace(/^NSE:|^BSE:/, ''),
      tradeDate: date,
      executionTime: time,
      type: rawType as 'BUY' | 'SELL',
      quantity: qty,
      price,
      orderId,
      broker: 'ZERODHA',
    });
  }

  return trades;
}

/**
 * Parses Groww Tradebook CSV format
 * Standard headers: Stock Name, Symbol, Type, Quantity, Average Price, Execution Date & Time
 */
export function parseGrowwCSV(content: string): RawBrokerTrade[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const symbolIdx = headers.findIndex(h => h === 'symbol' || h === 'stock symbol');
  const nameIdx = headers.findIndex(h => h === 'stock name' || h === 'company name');
  const typeIdx = headers.findIndex(h => h === 'type' || h === 'order type');
  const qtyIdx = headers.findIndex(h => h === 'quantity' || h === 'qty');
  const priceIdx = headers.findIndex(h => h === 'average price' || h === 'price' || h === 'avg price');
  const timeIdx = headers.findIndex(h => h.includes('execution') || h.includes('date & time') || h === 'time');

  const trades: RawBrokerTrade[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const symCol = symbolIdx >= 0 && cols[symbolIdx] ? cols[symbolIdx] : (nameIdx >= 0 ? cols[nameIdx] : '');
    const rawType = (typeIdx >= 0 && cols[typeIdx] ? cols[typeIdx] : '').toUpperCase();
    const qty = qtyIdx >= 0 ? (Math.abs(parseFloat(cols[qtyIdx])) || 0) : 0;
    const price = priceIdx >= 0 ? (parseFloat(cols[priceIdx]) || 0) : 0;
    const rawTime = timeIdx >= 0 ? cols[timeIdx] : '09:15:00';

    if (!symCol || qty <= 0 || price <= 0 || (rawType !== 'BUY' && rawType !== 'SELL')) {
      continue;
    }

    let date = new Date().toISOString().split('T')[0];
    let time = rawTime;
    if (rawTime.includes(' ') || rawTime.includes('T')) {
      const parts = rawTime.split(/[ T]/);
      date = parts[0];
      time = parts[1] || '09:15:00';
    }

    trades.push({
      id: `groww-${i}-${Date.now()}`,
      symbol: symCol.toUpperCase().replace(/\s+/g, '_'),
      tradeDate: date,
      executionTime: time,
      type: rawType as 'BUY' | 'SELL',
      quantity: qty,
      price,
      broker: 'GROWW',
    });
  }

  return trades;
}

/**
 * Auto-detects broker format and parses trade lines
 */
export function detectAndParseTradebookCSV(content: string): {
  trades: RawBrokerTrade[];
  brokerDetected: 'ZERODHA' | 'GROWW' | 'GENERIC';
  totalLinesRead: number;
} {
  const firstLines = content.slice(0, 500).toLowerCase();

  let broker: 'ZERODHA' | 'GROWW' | 'GENERIC' = 'GENERIC';
  let trades: RawBrokerTrade[] = [];

  if (firstLines.includes('trade_type') || firstLines.includes('order_execution_time') || firstLines.includes('trade_date')) {
    broker = 'ZERODHA';
    trades = parseZerodhaCSV(content);
  } else if (firstLines.includes('stock name') || firstLines.includes('average price')) {
    broker = 'GROWW';
    trades = parseGrowwCSV(content);
  } else {
    // Attempt Zerodha first, if empty try Groww
    trades = parseZerodhaCSV(content);
    if (trades.length === 0) {
      trades = parseGrowwCSV(content);
      if (trades.length > 0) broker = 'GROWW';
    } else {
      broker = 'ZERODHA';
    }
  }

  return {
    trades,
    brokerDetected: broker,
    totalLinesRead: trades.length,
  };
}

/**
 * Standard Indian market statutory fee calculator per trade leg
 * (Brokerage ₹20, STT 0.025% on intraday sell, Exchange 0.00297%, SEBI fee, GST 18%, Stamp Duty)
 */
function estimateTradeStatutoryFees(turnover: number, isSell: boolean): number {
  const brokerage = 20;
  const stt = isSell ? turnover * 0.00025 : 0;
  const exchangeTurnover = turnover * 0.0000297;
  const sebiCharges = turnover * 0.000001;
  const stampDuty = !isSell ? turnover * 0.00003 : 0;
  const gst = (brokerage + exchangeTurnover + sebiCharges) * 0.18;
  return brokerage + stt + exchangeTurnover + sebiCharges + stampDuty + gst;
}

/**
 * Matches raw buy and sell fills into closed round-trip trades using FIFO
 */
export function matchTradesFIFO(rawTrades: RawBrokerTrade[]): ClosedRoundTripTrade[] {
  // Sort chronologically by date and execution time
  const sorted = [...rawTrades].sort((a, b) => {
    const timeA = `${a.tradeDate} ${a.executionTime}`;
    const timeB = `${b.tradeDate} ${b.executionTime}`;
    return timeA.localeCompare(timeB);
  });

  const inventory: Record<string, { price: number; qty: number; time: string; date: string }[]> = {};
  const closedTrades: ClosedRoundTripTrade[] = [];

  for (const trade of sorted) {
    const sym = trade.symbol;
    if (!inventory[sym]) inventory[sym] = [];

    if (trade.type === 'BUY') {
      inventory[sym].push({
        price: trade.price,
        qty: trade.quantity,
        time: trade.executionTime,
        date: trade.tradeDate,
      });
    } else if (trade.type === 'SELL') {
      let qtyToSell = trade.quantity;

      while (qtyToSell > 0 && inventory[sym].length > 0) {
        const lot = inventory[sym][0];
        const matchQty = Math.min(qtyToSell, lot.qty);

        // Approximate duration
        const entryTs = new Date(`${lot.date}T${lot.time.includes('T') ? lot.time.split('T')[1] : lot.time}`).getTime() || Date.now() - 3600000;
        const exitTs = new Date(`${trade.tradeDate}T${trade.executionTime.includes('T') ? trade.executionTime.split('T')[1] : trade.executionTime}`).getTime() || Date.now();
        const durationMins = Math.max(1, Math.round((exitTs - entryTs) / (1000 * 60)));

        const grossPnl = Number(((trade.price - lot.price) * matchQty).toFixed(2));
        const entryTurnover = lot.price * matchQty;
        const exitTurnover = trade.price * matchQty;
        const fees = Number((estimateTradeStatutoryFees(entryTurnover, false) + estimateTradeStatutoryFees(exitTurnover, true)).toFixed(2));
        const netPnl = Number((grossPnl - fees).toFixed(2));

        closedTrades.push({
          id: `rt-${closedTrades.length + 1}-${trade.symbol}`,
          symbol: trade.symbol,
          entryTime: `${lot.date} ${lot.time}`,
          exitTime: `${trade.tradeDate} ${trade.executionTime}`,
          holdingMinutes: durationMins > 0 ? durationMins : 5,
          side: 'LONG',
          quantity: matchQty,
          entryPrice: lot.price,
          exitPrice: trade.price,
          grossPnl,
          statutoryFees: fees,
          netPnl,
          isWinner: netPnl > 0,
          tags: [],
        });

        lot.qty -= matchQty;
        qtyToSell -= matchQty;

        if (lot.qty <= 0) {
          inventory[sym].shift();
        }
      }
    }
  }

  return tagBehavioralTrades(closedTrades);
}

/**
 * Evaluates behavioral patterns: Revenge Trading, Martingale, Quick Scalp vs Bag Holding
 */
function tagBehavioralTrades(trades: ClosedRoundTripTrade[]): ClosedRoundTripTrade[] {
  for (let i = 0; i < trades.length; i++) {
    const current = trades[i];
    const tags: string[] = [];

    // Check revenge trading: entered within 10 minutes after a losing trade
    if (i > 0) {
      const prev = trades[i - 1];
      if (!prev.isWinner) {
        const prevExit = new Date(prev.exitTime.replace(' ', 'T')).getTime();
        const currentEntry = new Date(current.entryTime.replace(' ', 'T')).getTime();
        const diffMins = (currentEntry - prevExit) / (1000 * 60);

        if (diffMins >= 0 && diffMins <= 10) {
          tags.push('Revenge Trade');
          if (current.quantity >= prev.quantity * 1.5) {
            tags.push('Martingale Sizing');
          }
        }
      }
    }

    // Fee trap: Gross profitable but net negative after statutory fees
    if (current.grossPnl > 0 && current.netPnl <= 0) {
      tags.push('Fee Trap');
    }

    // Quick profit taking vs Bag holding
    if (current.isWinner && current.holdingMinutes <= 3) {
      tags.push('Premature Cut');
    } else if (!current.isWinner && current.holdingMinutes >= 45) {
      tags.push('Bag Holding');
    }

    current.tags = tags;
  }

  return trades;
}

/**
 * Computes psychological audit metrics & institutional bias scores
 */
export function computeBehavioralAudit(trades: ClosedRoundTripTrade[]): BehavioralAuditReport {
  if (trades.length === 0) {
    return {
      totalClosedTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRatePct: 0,
      grossPnl: 0,
      totalStatutoryFees: 0,
      netPnl: 0,
      feeErosionRatio: 0,
      avgWinHoldingMins: 0,
      avgLossHoldingMins: 0,
      dispositionRatio: 1,
      revengeTradeCount: 0,
      revengeTradingIndex: 0,
      martingaleCount: 0,
      maxConsecutiveLosses: 0,
      disciplineScore: 100,
      biases: [],
    };
  }

  const winTrades = trades.filter(t => t.netPnl > 0);
  const lossTrades = trades.filter(t => t.netPnl <= 0);

  const grossPnl = Number(trades.reduce((acc, t) => acc + t.grossPnl, 0).toFixed(2));
  const totalFees = Number(trades.reduce((acc, t) => acc + t.statutoryFees, 0).toFixed(2));
  const netPnl = Number((grossPnl - totalFees).toFixed(2));

  const totalGrossProfits = trades.filter(t => t.grossPnl > 0).reduce((acc, t) => acc + t.grossPnl, 0);
  const feeErosionRatio = totalGrossProfits > 0 
    ? Number(((totalFees / totalGrossProfits) * 100).toFixed(1))
    : (totalFees > 0 ? 100 : 0);

  const totalWinMins = winTrades.reduce((acc, t) => acc + t.holdingMinutes, 0);
  const totalLossMins = lossTrades.reduce((acc, t) => acc + t.holdingMinutes, 0);

  const avgWinHoldingMins = winTrades.length > 0 ? Number((totalWinMins / winTrades.length).toFixed(1)) : 0;
  const avgLossHoldingMins = lossTrades.length > 0 ? Number((totalLossMins / lossTrades.length).toFixed(1)) : 0;

  // Disposition Ratio: how much longer losers are held relative to winners
  const dispositionRatio = avgWinHoldingMins > 0 
    ? Number((avgLossHoldingMins / avgWinHoldingMins).toFixed(2)) 
    : (avgLossHoldingMins > 0 ? 3.0 : 1.0);

  const revengeTradeCount = trades.filter(t => t.tags.includes('Revenge Trade')).length;
  const revengeTradingIndex = Number(((revengeTradeCount / trades.length) * 100).toFixed(1));

  const martingaleCount = trades.filter(t => t.tags.includes('Martingale Sizing')).length;

  // Consecutive losses
  let maxConsecutiveLosses = 0;
  let currentLossStreak = 0;
  for (const t of trades) {
    if (!t.isWinner) {
      currentLossStreak++;
      if (currentLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = currentLossStreak;
    } else {
      currentLossStreak = 0;
    }
  }

  // Calculate composite Discipline Score (100 max)
  let disciplineScore = 100;
  if (dispositionRatio > 2.0) disciplineScore -= 25;
  else if (dispositionRatio > 1.4) disciplineScore -= 12;

  if (revengeTradingIndex > 20) disciplineScore -= 30;
  else if (revengeTradingIndex > 10) disciplineScore -= 15;

  if (feeErosionRatio > 50) disciplineScore -= 20;
  else if (feeErosionRatio > 30) disciplineScore -= 10;

  if (martingaleCount > 0) disciplineScore -= 15;

  disciplineScore = Math.max(10, Math.min(98, disciplineScore));

  // Determine Primary Biases
  const biases: BiasClassification[] = [];

  // 1. Disposition Effect
  if (dispositionRatio > 1.8) {
    biases.push({
      name: 'Severe Disposition Effect (Loss Bag-Holding)',
      severity: 'CRITICAL',
      scoreDisplay: `${dispositionRatio}x Holding Ratio`,
      description: `You hold losing trades ${dispositionRatio}x longer (${avgLossHoldingMins} min avg) than winning trades (${avgWinHoldingMins} min avg), hoping for breakeven instead of respecting stop-losses.`,
      recommendation: 'Enforce pre-determined hard Stop-Loss orders immediately upon order entry. Never cancel or widen a protective stop.',
    });
  } else if (dispositionRatio > 1.3) {
    biases.push({
      name: 'Mild Disposition Effect',
      severity: 'WARNING',
      scoreDisplay: `${dispositionRatio}x Holding Ratio`,
      description: `Tendency to exit winners slightly early while giving losing trades extra leeway.`,
      recommendation: 'Use trailing stop-losses based on ATR or swing pivots to let winning runners breathe.',
    });
  } else {
    biases.push({
      name: 'Disposition Discipline',
      severity: 'HEALTHY',
      scoreDisplay: `${dispositionRatio}x Holding Ratio`,
      description: 'Well-balanced exit duration between winning and losing trades.',
      recommendation: 'Maintain your disciplined loss cutting criteria.',
    });
  }

  // 2. Revenge Trading
  if (revengeTradingIndex > 15) {
    biases.push({
      name: 'High Revenge Trading Vulnerability',
      severity: 'CRITICAL',
      scoreDisplay: `${revengeTradingIndex}% of Trades`,
      description: `${revengeTradeCount} trades were initiated within 10 minutes of taking a loss, indicating emotional retaliation against the market.`,
      recommendation: 'Implement a mandatory 15-minute cool-off terminal lockout after any stop-out before scanning for new setups.',
    });
  } else if (revengeTradingIndex > 5) {
    biases.push({
      name: 'Occasional Impatience / Quick Re-entry',
      severity: 'WARNING',
      scoreDisplay: `${revengeTradingIndex}% of Trades`,
      description: 'Minor tendency to re-enter trades immediately after being stopped out.',
      recommendation: 'Wait for next candlestick bar confirmation rather than jumping in on immediate ticks.',
    });
  } else {
    biases.push({
      name: 'Emotional Composure',
      severity: 'HEALTHY',
      scoreDisplay: `${revengeTradingIndex}% Revenge Rate`,
      description: 'Zero or minimal impulsive entries following stopped-out trades.',
      recommendation: 'Excellent emotional equilibrium; preserve this consistency.',
    });
  }

  // 3. Fee Erosion (Statutory Taxes & Brokerage)
  if (feeErosionRatio > 40) {
    biases.push({
      name: 'Statutory Fee Leakage (Overtrading Trap)',
      severity: 'CRITICAL',
      scoreDisplay: `${feeErosionRatio}% of Profits`,
      description: `₹${totalFees.toLocaleString('en-IN')} paid in STT, brokerage, exchange turnover, and GST, consuming ${feeErosionRatio}% of gross gains.`,
      recommendation: 'Reduce daily trade frequency by 50%. Focus exclusively on high-reward swing or trend setups where expected gain is >5x statutory charges.',
    });
  } else {
    biases.push({
      name: 'Fee Efficiency',
      severity: 'HEALTHY',
      scoreDisplay: `${feeErosionRatio}% of Profits`,
      description: 'Reasonable tax and brokerage overhead relative to total trade profits.',
      recommendation: 'Execution costs are well-contained within acceptable statistical bounds.',
    });
  }

  // 4. Martingale Sizing
  if (martingaleCount > 0) {
    biases.push({
      name: 'Martingale Position Sizing Hazard',
      severity: 'CRITICAL',
      scoreDisplay: `${martingaleCount} Instances`,
      description: 'Detected size escalation following consecutive losses — an exponential mathematical path to account ruin.',
      recommendation: 'Fixed fractional risk only (e.g. strict 1% of total equity per trade regardless of previous outcome).',
    });
  }

  return {
    totalClosedTrades: trades.length,
    winCount: winTrades.length,
    lossCount: lossTrades.length,
    winRatePct: Number(((winTrades.length / trades.length) * 100).toFixed(1)),
    grossPnl,
    totalStatutoryFees: totalFees,
    netPnl,
    feeErosionRatio,
    avgWinHoldingMins,
    avgLossHoldingMins,
    dispositionRatio,
    revengeTradeCount,
    revengeTradingIndex,
    martingaleCount,
    maxConsecutiveLosses,
    disciplineScore,
    biases,
  };
}

/**
 * Built-in Sample Statement 1: Zerodha High-Churn Scalper
 * Demonstrates revenge trading, heavy fee erosion, and disposition effect
 */
export const SAMPLE_ZERODHA_SCALPER_CSV = `symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,order_id,trade_id,order_execution_time
RELIANCE,INE002A01018,2026-11-02,NSE,EQ,EQ,buy,50,2940.50,11002233,554411,09:18:22
RELIANCE,INE002A01018,2026-11-02,NSE,EQ,EQ,sell,50,2943.00,11002244,554422,09:20:15
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,buy,100,1720.00,11002255,554433,09:32:04
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,sell,100,1708.50,11002266,554444,10:14:50
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,buy,200,1710.00,11002277,554455,10:17:12
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,sell,200,1702.00,11002288,554466,10:55:30
INFY,INE009A01021,2026-11-02,NSE,EQ,EQ,buy,80,1850.00,11002299,554477,11:02:10
INFY,INE009A01021,2026-11-02,NSE,EQ,EQ,sell,80,1844.00,11002300,554488,11:48:40
TCS,INE467B01029,2026-11-02,NSE,EQ,EQ,buy,40,4120.00,11002311,554499,13:10:05
TCS,INE467B01029,2026-11-02,NSE,EQ,EQ,sell,40,4124.50,11002322,554500,13:12:15
SBIN,INE062A01020,2026-11-02,NSE,EQ,EQ,buy,150,815.00,11002333,554511,13:40:20
SBIN,INE062A01020,2026-11-02,NSE,EQ,EQ,sell,150,811.50,11002344,554522,14:22:10
SBIN,INE062A01020,2026-11-02,NSE,EQ,EQ,buy,300,812.00,11002355,554533,14:25:05
SBIN,INE062A01020,2026-11-02,NSE,EQ,EQ,sell,300,808.50,11002366,554544,15:10:00`;

/**
 * Built-in Sample Statement 2: Groww Disciplined Swing Trader
 * Demonstrates controlled holding, tight stop-loss, and high discipline score
 */
export const SAMPLE_GROWW_SWING_CSV = `Stock Name,Symbol,Type,Quantity,Average Price,Execution Date & Time
Tata Motors,TATAMOTORS,BUY,100,980.00,2026-11-01 09:25:00
Tata Motors,TATAMOTORS,SELL,100,1015.00,2026-11-01 14:40:00
ICICI Bank,ICICIBANK,BUY,120,1240.00,2026-11-01 10:15:00
ICICI Bank,ICICIBANK,SELL,120,1232.00,2026-11-01 10:35:00
Larsen & Toubro,LT,BUY,50,3580.00,2026-11-02 09:30:00
Larsen & Toubro,LT,SELL,50,3660.00,2026-11-02 15:05:00
Bharti Airtel,BHARTIARTL,BUY,80,1620.00,2026-11-02 11:00:00
Bharti Airtel,BHARTIARTL,SELL,80,1612.00,2026-11-02 11:20:00`;

/**
 * Generates an institutional AI Post-Mortem Audit prompt for the user's BYOK LLM
 */
export function generateTradebookAIPrompt(report: BehavioralAuditReport, trades: ClosedRoundTripTrade[]): string {
  const tradeSummaries = trades.slice(0, 8).map(t => 
    `- [${t.symbol}] ${t.side} Qty:${t.quantity} Entry:₹${t.entryPrice} Exit:₹${t.exitPrice} Hold:${t.holdingMinutes}m Gross:₹${t.grossPnl} Net:₹${t.netPnl} Tags:[${t.tags.join(', ')}]`
  ).join('\n');

  return `You are an elite institutional trading psychologist and quantitative risk manager for Indian equity markets.
Analyze this trader's imported broker statement and psychological behavioral audit:

### Quantitative Behavioral Scorecard:
- Total Closed Trades: ${report.totalClosedTrades}
- Win Rate: ${report.winRatePct}% (${report.winCount} Wins / ${report.lossCount} Losses)
- Gross P&L: ₹${report.grossPnl.toLocaleString('en-IN')}
- Total Statutory Charges (STT, Exchange, Brokerage, GST): ₹${report.totalStatutoryFees.toLocaleString('en-IN')}
- Net Realized P&L: ₹${report.netPnl.toLocaleString('en-IN')}
- Fee Erosion Ratio: ${report.feeErosionRatio}% of profits lost to taxes & fees
- Average Win Holding Time: ${report.avgWinHoldingMins} minutes
- Average Loss Holding Time: ${report.avgLossHoldingMins} minutes
- Disposition Effect Ratio: ${report.dispositionRatio}x (Ratio of time spent holding losers vs winners)
- Revenge Trading Index: ${report.revengeTradingIndex}% (${report.revengeTradeCount} revenge trades detected)
- Martingale Escalations: ${report.martingaleCount} instances
- Overall Psychological Discipline Score: ${report.disciplineScore}/100

### Key Trade Sequence Sample:
${tradeSummaries}

### Required Deliverable:
Provide a concise, direct, and constructive diagnostic report with 3 sections:
1. **Psychological Profile & Identified Biases**: Diagnoses specific cognitive traps (Disposition effect, Revenge trading, Fee churn).
2. **Mathematical Capital Leak**: Explains how statutory taxes and oversized losing trades degraded their expectancy.
3. **Actionable 3-Rule Prescription**: 3 non-negotiable execution rules tailored to fix their specific flaws in the Indian market.`;
}
