// TradeCraft AI — Multi-Factor Technical Screener & Stock Scanner Engine
// Computes Volume Surge, 20/50 EMA crosses, RSI(14), Day VWAP, and 15-Minute ORB

import { TickerInfo } from '../types/trading';
import { POPULAR_TICKERS, generateHistoricalCandles } from './marketData';

export interface ScreenedStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  volumeSurgeRatio: number;
  rsi14: number;
  vwap: number;
  isAboveVwap: boolean;
  ema20: number;
  ema50: number;
  isGoldenCross: boolean;
  isOrbBullish: boolean;
  isOrbBearish: boolean;
  confluenceScore: number; // 0 to 100
  bias: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  signals: string[];
}

export type ScreenerPreset = 'ALL' | 'BULLISH' | 'BEARISH' | 'VOLUME_SURGE' | 'RSI_EXTREMES' | 'ORB_BREAKOUTS';

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1] ?? 0;

  const k = 2 / (period + 1);
  const initialSlice = prices.slice(0, period);
  let ema = initialSlice.reduce((acc: number, p) => acc + (p ?? 0), 0) / period;

  for (let i = period; i < prices.length; i++) {
    const p = prices[i] ?? 0;
    ema = p * k + ema * (1 - k);
  }

  return Number(ema.toFixed(2));
}

/**
 * Calculates Relative Strength Index (RSI 14)
 */
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const curr = prices[i] ?? 0;
    const prev = prices[i - 1] ?? 0;
    const diff = curr - prev;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const curr = prices[i] ?? 0;
    const prev = prices[i - 1] ?? 0;
    const diff = curr - prev;
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

/**
 * Calculates Day VWAP from candle OHLCV series
 */
export function calculateVWAP(candles: { high: number; low: number; close: number; volume?: number }[]): number {
  if (candles.length === 0) return 0;

  let cumulativePv = 0;
  let cumulativeVol = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume ?? 1000;
    cumulativePv += typicalPrice * vol;
    cumulativeVol += vol;
  }

  if (cumulativeVol === 0) return candles[candles.length - 1]?.close ?? 0;
  return Number((cumulativePv / cumulativeVol).toFixed(2));
}

/**
 * Scans a single stock ticker against multi-factor criteria
 */
export function scanStock(ticker: TickerInfo): ScreenedStock {
  const candles = generateHistoricalCandles(ticker.currentPrice, '5m', 70);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume ?? 100000);

  const currentPrice = ticker.currentPrice;
  const currentVolume = volumes[volumes.length - 1] ?? 100000;
  const recent20Volumes = volumes.slice(-20);
  const sumVol = recent20Volumes.reduce((acc: number, b) => acc + (b ?? 0), 0);
  const avgVolume = Math.round(sumVol / Math.max(1, recent20Volumes.length)) || 100000;
  const volumeSurgeRatio = Number((currentVolume / avgVolume).toFixed(2));

  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const isGoldenCross = ema20 > ema50;

  const rsi14 = calculateRSI(closes, 14);
  const vwap = calculateVWAP(candles);
  const isAboveVwap = currentPrice >= vwap;

  // 15-Minute Opening Range (approx 3 candles in 5m timeframe)
  const orbCandles = candles.slice(0, 3);
  const orbHigh = orbCandles.length > 0 ? Math.max(...orbCandles.map(c => c.high)) : currentPrice;
  const orbLow = orbCandles.length > 0 ? Math.min(...orbCandles.map(c => c.low)) : currentPrice;
  const isOrbBullish = currentPrice > orbHigh;
  const isOrbBearish = currentPrice < orbLow;

  // Composite Confluence Score (0 - 100)
  let score = 50;
  const signals: string[] = [];

  // Volume
  if (volumeSurgeRatio >= 2.0) {
    score += isAboveVwap ? 15 : -10;
    signals.push(`Volume Surge (${volumeSurgeRatio}x)`);
  } else if (volumeSurgeRatio >= 1.3) {
    score += isAboveVwap ? 8 : -5;
  }

  // EMA Trend
  if (isGoldenCross) {
    score += 15;
    signals.push('EMA 20/50 Bullish');
  } else {
    score -= 15;
    signals.push('EMA 20/50 Bearish');
  }

  // VWAP
  if (isAboveVwap) {
    score += 12;
    signals.push('Above VWAP');
  } else {
    score -= 12;
    signals.push('Below VWAP');
  }

  // ORB
  if (isOrbBullish) {
    score += 10;
    signals.push('15m ORB Breakout');
  } else if (isOrbBearish) {
    score -= 10;
    signals.push('15m ORB Breakdown');
  }

  // RSI
  if (rsi14 >= 70) {
    score -= 8; // Mean reversion risk
    signals.push(`RSI Overbought (${rsi14})`);
  } else if (rsi14 <= 30) {
    score += 8; // Oversold potential bounce
    signals.push(`RSI Oversold (${rsi14})`);
  } else if (rsi14 >= 55) {
    score += 5;
  }

  const confluenceScore = Math.max(5, Math.min(95, score));

  let bias: ScreenedStock['bias'] = 'NEUTRAL';
  if (confluenceScore >= 75) bias = 'STRONG_BULLISH';
  else if (confluenceScore >= 60) bias = 'BULLISH';
  else if (confluenceScore <= 25) bias = 'STRONG_BEARISH';
  else if (confluenceScore <= 40) bias = 'BEARISH';

  return {
    symbol: ticker.symbol,
    name: ticker.name,
    sector: ticker.sector,
    price: currentPrice,
    changePercent: ticker.changePercent,
    volume: currentVolume,
    avgVolume,
    volumeSurgeRatio,
    rsi14,
    vwap,
    isAboveVwap,
    ema20,
    ema50,
    isGoldenCross,
    isOrbBullish,
    isOrbBearish,
    confluenceScore,
    bias,
    signals,
  };
}

/**
 * Scans the entire active NSE Universe
 */
export function scanUniverse(tickers: TickerInfo[] = POPULAR_TICKERS): ScreenedStock[] {
  return tickers.map(scanStock).sort((a, b) => b.confluenceScore - a.confluenceScore);
}

/**
 * Filters screened results by preset
 */
export function filterScreenedStocks(stocks: ScreenedStock[], preset: ScreenerPreset): ScreenedStock[] {
  switch (preset) {
    case 'BULLISH':
      return stocks.filter(s => s.confluenceScore >= 60);
    case 'BEARISH':
      return stocks.filter(s => s.confluenceScore <= 40);
    case 'VOLUME_SURGE':
      return stocks.filter(s => s.volumeSurgeRatio >= 1.5);
    case 'RSI_EXTREMES':
      return stocks.filter(s => s.rsi14 <= 35 || s.rsi14 >= 65);
    case 'ORB_BREAKOUTS':
      return stocks.filter(s => s.isOrbBullish || s.isOrbBearish);
    case 'ALL':
    default:
      return stocks;
  }
}

/**
 * Generates an institutional AI prompt for the Stock Scanner
 */
export function generateScreenerAIPrompt(stocks: ScreenedStock[], activePreset: string): string {
  const topStocks = stocks.slice(0, 6).map(s => 
    `- [${s.symbol} - ${s.sector}] ₹${s.price} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent}%) | Confluence: ${s.confluenceScore}/100 [${s.bias}] | VolSurge: ${s.volumeSurgeRatio}x | RSI: ${s.rsi14} | VWAP: ₹${s.vwap} | Signals: ${s.signals.join(', ')}`
  ).join('\n');

  return `You are a chief technical analyst and quantitative strategist at an Indian institutional prop desk.
Analyze these real-time scanner signals across the NSE universe under the filter "${activePreset}":

### Top Screened Stocks:
${topStocks}

### Required Output:
Provide a crisp, actionable 3-point morning tactical briefing:
1. **Dominant Market Theme**: Are setups concentrated in specific sectors or broad-based?
2. **Top 2 High-Confluence Plays**: Select the 2 highest-probability stock setups with specific entry criteria and risk invalidation (stop-loss) levels relative to VWAP or EMA.
3. **Traps to Avoid**: Warn against any overextended or false breakout candidates based on RSI or volume exhaustion.`;
}
