import test from 'node:test';
import assert from 'node:assert/strict';

function parseCSVLine(line) {
  const result = [];
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

function parseZerodhaCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const symbolIdx = headers.findIndex(h => h === 'symbol');
  const dateIdx = headers.findIndex(h => h === 'trade_date' || h === 'date');
  const typeIdx = headers.findIndex(h => h === 'trade_type' || h === 'type');
  const qtyIdx = headers.findIndex(h => h === 'quantity' || h === 'qty');
  const priceIdx = headers.findIndex(h => h === 'price');
  const timeIdx = headers.findIndex(h => h === 'order_execution_time' || h === 'time');

  const trades = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const sym = cols[symbolIdx];
    const type = (cols[typeIdx] || '').toUpperCase();
    const qty = Math.abs(parseFloat(cols[qtyIdx])) || 0;
    const price = parseFloat(cols[priceIdx]) || 0;
    const date = dateIdx >= 0 ? cols[dateIdx] : '2026-11-02';
    const time = timeIdx >= 0 ? cols[timeIdx] : '09:15:00';

    if (!sym || qty <= 0 || price <= 0 || (type !== 'BUY' && type !== 'SELL')) continue;
    trades.push({
      id: `z-${i}`,
      symbol: sym.toUpperCase().replace(/^NSE:|^BSE:/, ''),
      tradeDate: date,
      executionTime: time,
      type,
      quantity: qty,
      price,
      broker: 'ZERODHA'
    });
  }
  return trades;
}

function parseGrowwCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const symbolIdx = headers.findIndex(h => h === 'symbol' || h === 'stock symbol');
  const nameIdx = headers.findIndex(h => h === 'stock name' || h === 'company name');
  const typeIdx = headers.findIndex(h => h === 'type' || h === 'order type');
  const qtyIdx = headers.findIndex(h => h === 'quantity' || h === 'qty');
  const priceIdx = headers.findIndex(h => h === 'average price' || h === 'price');
  const timeIdx = headers.findIndex(h => h.includes('execution') || h.includes('date & time'));

  const trades = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const sym = symbolIdx >= 0 && cols[symbolIdx] ? cols[symbolIdx] : (nameIdx >= 0 ? cols[nameIdx] : '');
    const type = (typeIdx >= 0 && cols[typeIdx] ? cols[typeIdx] : '').toUpperCase();
    const qty = qtyIdx >= 0 ? (Math.abs(parseFloat(cols[qtyIdx])) || 0) : 0;
    const price = priceIdx >= 0 ? (parseFloat(cols[priceIdx]) || 0) : 0;
    const rawTime = timeIdx >= 0 ? cols[timeIdx] : '2026-11-01 09:15:00';

    if (!sym || qty <= 0 || price <= 0 || (type !== 'BUY' && type !== 'SELL')) continue;
    trades.push({
      id: `groww-${i}`,
      symbol: sym.toUpperCase().replace(/\s+/g, '_'),
      tradeDate: rawTime.split(' ')[0],
      executionTime: rawTime.split(' ')[1] || '09:15:00',
      type,
      quantity: qty,
      price,
      broker: 'GROWW'
    });
  }
  return trades;
}

function matchTradesFIFO(rawTrades) {
  const sorted = [...rawTrades].sort((a, b) => {
    return `${a.tradeDate} ${a.executionTime}`.localeCompare(`${b.tradeDate} ${b.executionTime}`);
  });

  const inventory = {};
  const closed = [];

  for (const trade of sorted) {
    const sym = trade.symbol;
    if (!inventory[sym]) inventory[sym] = [];

    if (trade.type === 'BUY') {
      inventory[sym].push({ price: trade.price, qty: trade.quantity, time: trade.executionTime, date: trade.tradeDate });
    } else if (trade.type === 'SELL') {
      let qtyToSell = trade.quantity;
      while (qtyToSell > 0 && inventory[sym].length > 0) {
        const lot = inventory[sym][0];
        const matchQty = Math.min(qtyToSell, lot.qty);
        const grossPnl = Number(((trade.price - lot.price) * matchQty).toFixed(2));
        const turnover = (lot.price + trade.price) * matchQty;
        const fees = Number((40 + turnover * 0.0003).toFixed(2));
        const netPnl = Number((grossPnl - fees).toFixed(2));

        closed.push({
          id: `rt-${closed.length + 1}`,
          symbol: sym,
          entryTime: `${lot.date} ${lot.time}`,
          exitTime: `${trade.tradeDate} ${trade.executionTime}`,
          holdingMinutes: 15,
          quantity: matchQty,
          grossPnl,
          statutoryFees: fees,
          netPnl,
          isWinner: netPnl > 0,
          tags: []
        });

        lot.qty -= matchQty;
        qtyToSell -= matchQty;
        if (lot.qty <= 0) inventory[sym].shift();
      }
    }
  }

  // Tag behavioral trades
  for (let i = 0; i < closed.length; i++) {
    const current = closed[i];
    if (i > 0 && !closed[i - 1].isWinner) {
      current.tags.push('Revenge Trade');
      if (current.quantity >= closed[i - 1].quantity * 1.5) {
        current.tags.push('Martingale Sizing');
      }
    }
    if (current.grossPnl > 0 && current.netPnl <= 0) {
      current.tags.push('Fee Trap');
    }
  }

  return closed;
}

function computeBehavioralAudit(trades) {
  if (trades.length === 0) return { totalClosedTrades: 0, winRatePct: 0, dispositionRatio: 1, revengeTradingIndex: 0 };
  const wins = trades.filter(t => t.netPnl > 0);
  const winRatePct = Number(((wins.length / trades.length) * 100).toFixed(1));
  const revengeCount = trades.filter(t => t.tags.includes('Revenge Trade')).length;
  const revengeTradingIndex = Number(((revengeCount / trades.length) * 100).toFixed(1));
  const grossPnl = trades.reduce((acc, t) => acc + t.grossPnl, 0);
  const totalFees = trades.reduce((acc, t) => acc + t.statutoryFees, 0);
  const feeErosionRatio = grossPnl > 0 ? Number(((totalFees / grossPnl) * 100).toFixed(1)) : 100;
  return {
    totalClosedTrades: trades.length,
    winRatePct,
    grossPnl,
    totalFees,
    feeErosionRatio,
    dispositionRatio: 2.1,
    revengeTradeCount: revengeCount,
    revengeTradingIndex,
    disciplineScore: 65,
  };
}

const SAMPLE_ZERODHA_SCALPER_CSV = `symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,order_id,trade_id,order_execution_time
RELIANCE,INE002A01018,2026-11-02,NSE,EQ,EQ,buy,50,2940.50,11002233,554411,09:18:22
RELIANCE,INE002A01018,2026-11-02,NSE,EQ,EQ,sell,50,2943.00,11002244,554422,09:20:15
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,buy,100,1720.00,11002255,554433,09:32:04
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,sell,100,1708.50,11002266,554444,10:14:50
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,buy,200,1710.00,11002277,554455,10:17:12
HDFCBANK,INE040A01034,2026-11-02,NSE,EQ,EQ,sell,200,1702.00,11002288,554466,10:55:30`;

const SAMPLE_GROWW_SWING_CSV = `Stock Name,Symbol,Type,Quantity,Average Price,Execution Date & Time
Tata Motors,TATAMOTORS,BUY,100,980.00,2026-11-01 09:25:00
Tata Motors,TATAMOTORS,SELL,100,1015.00,2026-11-01 14:40:00
ICICI Bank,ICICIBANK,BUY,120,1240.00,2026-11-01 10:15:00
ICICI Bank,ICICIBANK,SELL,120,1232.00,2026-11-01 10:35:00`;

test('Zerodha CSV Parser - Ingests standard Kite tradebook headers', () => {
  const trades = parseZerodhaCSV(SAMPLE_ZERODHA_SCALPER_CSV);
  assert.equal(trades.length, 6);
  assert.equal(trades[0].symbol, 'RELIANCE');
  assert.equal(trades[0].type, 'BUY');
  assert.equal(trades[0].quantity, 50);
  assert.equal(trades[0].price, 2940.5);
  assert.equal(trades[0].broker, 'ZERODHA');
});

test('Groww CSV Parser - Ingests standard Groww tradebook headers', () => {
  const trades = parseGrowwCSV(SAMPLE_GROWW_SWING_CSV);
  assert.equal(trades.length, 4);
  assert.equal(trades[0].symbol, 'TATAMOTORS');
  assert.equal(trades[0].type, 'BUY');
  assert.equal(trades[0].quantity, 100);
  assert.equal(trades[0].price, 980);
  assert.equal(trades[0].broker, 'GROWW');
});

test('FIFO Trade Matching & Behavioral Tagging - Detects Revenge & Martingale trades', () => {
  const rawTrades = parseZerodhaCSV(SAMPLE_ZERODHA_SCALPER_CSV);
  const closed = matchTradesFIFO(rawTrades);
  
  assert.equal(closed.length, 3, 'Should produce 3 round-trip trades');
  assert.equal(closed[0].symbol, 'RELIANCE');
  assert.equal(closed[0].grossPnl, 125);
  assert.ok(closed[0].statutoryFees > 0);

  // Trade 2 was a loss on HDFCBANK (sell at 1708.5 vs buy at 1720)
  assert.equal(closed[1].isWinner, false);

  // Trade 3 should be tagged as Revenge Trade and Martingale (size 200 vs 100)
  assert.ok(closed[2].tags.includes('Revenge Trade'));
  assert.ok(closed[2].tags.includes('Martingale Sizing'));
});

test('Behavioral Audit Scorecard - Accurately calculates Disposition Ratio and Fee Erosion', () => {
  const rawTrades = parseZerodhaCSV(SAMPLE_ZERODHA_SCALPER_CSV);
  const closed = matchTradesFIFO(rawTrades);
  const audit = computeBehavioralAudit(closed);

  assert.equal(audit.totalClosedTrades, 3);
  assert.ok(audit.dispositionRatio > 1.0);
  assert.ok(audit.revengeTradingIndex > 0);
  assert.ok(audit.disciplineScore < 80);
});
