import test from 'node:test';
import assert from 'node:assert/strict';

function calculateEMA(prices, period) {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((acc, p) => acc + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Number(ema.toFixed(2));
}

function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(1));
}

function calculateVWAP(candles) {
  if (candles.length === 0) return 0;
  let cumulativePv = 0;
  let cumulativeVol = 0;
  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativePv += typicalPrice * c.volume;
    cumulativeVol += c.volume;
  }
  if (cumulativeVol === 0) return candles[candles.length - 1].close;
  return Number((cumulativePv / cumulativeVol).toFixed(2));
}

test('Screener Engine - EMA Calculation Accuracy', () => {
  const flatPrices = Array(30).fill(100);
  assert.equal(calculateEMA(flatPrices, 10), 100, 'EMA of constant prices must equal constant');

  const rising = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const ema = calculateEMA(rising, 5);
  assert.ok(ema > 15 && ema < 20, 'EMA of strictly rising series should lag close but lead older bars');
});

test('Screener Engine - RSI Calculation Extremes', () => {
  const purelyRising = Array.from({ length: 25 }, (_, i) => 100 + i * 5);
  const rsiHigh = calculateRSI(purelyRising, 14);
  assert.equal(rsiHigh, 100, 'Purely rising prices must yield RSI 100');

  const purelyFalling = Array.from({ length: 25 }, (_, i) => 200 - i * 5);
  const rsiLow = calculateRSI(purelyFalling, 14);
  assert.ok(rsiLow < 10, 'Strictly falling prices should yield RSI near 0');
});

test('Screener Engine - VWAP Calculation Fidelity', () => {
  const candles = [
    { high: 105, low: 95, close: 100, volume: 1000 }, // typical = 100, pv = 100,000
    { high: 115, low: 105, close: 110, volume: 3000 }, // typical = 110, pv = 330,000
  ];
  // total pv = 430,000, total vol = 4000 -> VWAP = 107.5
  const vwap = calculateVWAP(candles);
  assert.equal(vwap, 107.5);
});

test('Screener Presets - Filter Subsets Correctly', () => {
  const mockStocks = [
    { symbol: 'RELIANCE', confluenceScore: 85, volumeSurgeRatio: 2.5, rsi14: 68, isOrbBullish: true },
    { symbol: 'INFY', confluenceScore: 35, volumeSurgeRatio: 1.1, rsi14: 28, isOrbBullish: false },
    { symbol: 'TCS', confluenceScore: 72, volumeSurgeRatio: 1.8, rsi14: 55, isOrbBullish: false },
  ];

  const bullish = mockStocks.filter(s => s.confluenceScore >= 60);
  assert.equal(bullish.length, 2);

  const bearish = mockStocks.filter(s => s.confluenceScore <= 40);
  assert.equal(bearish.length, 1);
  assert.equal(bearish[0].symbol, 'INFY');

  const volumeSurge = mockStocks.filter(s => s.volumeSurgeRatio >= 1.5);
  assert.equal(volumeSurge.length, 2);
});
