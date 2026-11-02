import { Candle, TickerInfo } from '../types/trading';

export const POPULAR_TICKERS: TickerInfo[] = [
  {
    symbol: 'NIFTY 50',
    name: 'NIFTY 50 Benchmark Index',
    sector: 'Indices',
    currentPrice: 24200.50,
    change: 145.20,
    changePercent: 0.60,
    dayHigh: 24280.00,
    dayLow: 24050.20,
    dayOpen: 24065.00,
    previousClose: 24055.30,
    volume: 12500000,
    lotSize: 25,
  },
  {
    symbol: 'BANKNIFTY',
    name: 'NIFTY Bank Index',
    sector: 'Indices',
    currentPrice: 51850.00,
    change: -210.40,
    changePercent: -0.40,
    dayHigh: 52120.00,
    dayLow: 51680.00,
    dayOpen: 52050.00,
    previousClose: 52060.40,
    volume: 8400000,
    lotSize: 15,
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy & Petrochemicals',
    currentPrice: 2840.75,
    change: 32.50,
    changePercent: 1.16,
    dayHigh: 2855.00,
    dayLow: 2810.00,
    dayOpen: 2812.00,
    previousClose: 2808.25,
    volume: 4200000,
    lotSize: 250,
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    sector: 'Information Technology',
    currentPrice: 4120.30,
    change: -18.60,
    changePercent: -0.45,
    dayHigh: 4160.00,
    dayLow: 4105.00,
    dayOpen: 4145.00,
    previousClose: 4138.90,
    volume: 1800000,
    lotSize: 175,
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Banking & Financials',
    currentPrice: 1785.40,
    change: 12.80,
    changePercent: 0.72,
    dayHigh: 1794.00,
    dayLow: 1770.00,
    dayOpen: 1774.50,
    previousClose: 1772.60,
    volume: 6500000,
    lotSize: 550,
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    sector: 'Information Technology',
    currentPrice: 1890.20,
    change: 24.10,
    changePercent: 1.29,
    dayHigh: 1902.00,
    dayLow: 1865.00,
    dayOpen: 1870.00,
    previousClose: 1866.10,
    volume: 3800000,
    lotSize: 400,
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    sector: 'Automobile',
    currentPrice: 875.60,
    change: 15.20,
    changePercent: 1.77,
    dayHigh: 882.00,
    dayLow: 860.00,
    dayOpen: 862.00,
    previousClose: 860.40,
    volume: 9200000,
    lotSize: 1425,
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'Public Sector Banking',
    currentPrice: 815.30,
    change: -6.40,
    changePercent: -0.78,
    dayHigh: 826.00,
    dayLow: 812.00,
    dayOpen: 824.00,
    previousClose: 821.70,
    volume: 7800000,
    lotSize: 750,
  },
];

/**
 * Generates synthetic realistic historical candlestick data
 */
export function generateHistoricalCandles(
  basePrice: number,
  timeframe: string = '5m',
  numCandles: number = 100
): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  
  let intervalSeconds = 300; // 5m default
  if (timeframe === '1m') intervalSeconds = 60;
  if (timeframe === '5m') intervalSeconds = 300;
  if (timeframe === '15m') intervalSeconds = 900;
  if (timeframe === '1H') intervalSeconds = 3600;
  if (timeframe === '1D') intervalSeconds = 86400;

  let currentPrice = basePrice * 0.95; // start slightly lower for trend
  const volatility = basePrice * 0.003;

  for (let i = numCandles; i >= 0; i--) {
    const time = now - i * intervalSeconds;
    const change = (Math.random() - 0.49) * volatility * (intervalSeconds / 300);
    const open = currentPrice;
    const close = Number((open + change).toFixed(2));
    const high = Number((Math.max(open, close) + Math.random() * volatility * 0.6).toFixed(2));
    const low = Number((Math.min(open, close) - Math.random() * volatility * 0.6).toFixed(2));
    const volume = Math.floor(Math.random() * 50000 + 10000);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

/**
 * Pre-packaged Historical Crisis Scenarios
 */
export interface CrisisScenario {
  id: string;
  title: string;
  description: string;
  symbol: string;
  historicalDate: string;
  challengePrompt: string;
  candles: Candle[];
}

export function getCrisisScenarios(): CrisisScenario[] {
  const baseTime = 1584921600; // March 23, 2020 (COVID Circuit Breaker)
  const covidCandles: Candle[] = [];
  let p = 11200;
  for (let i = 0; i < 40; i++) {
    const time = baseTime + i * 900;
    const drop = i < 15 ? (Math.random() * 120 + 80) : (Math.random() * 80 - 40);
    const open = p;
    const close = p - drop;
    const high = Math.max(open, close) + Math.random() * 30;
    const low = Math.min(open, close) - Math.random() * 40;
    covidCandles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 200000 + 50000),
    });
    p = close;
  }

  return [
    {
      id: 'covid-crash-2020',
      title: 'The March 2020 COVID Circuit Drop',
      description: 'NIFTY 50 plummets 10% in the opening 45 minutes, hitting lower circuit limits. Extreme implied volatility and wide bid-ask spreads.',
      symbol: 'NIFTY 50',
      historicalDate: '2020-03-23',
      challengePrompt: 'Navigate extreme downside volatility. Can you execute a hedged short or discipline-stop without blowing up your virtual margin?',
      candles: covidCandles,
    },
    {
      id: 'budget-day-2024',
      title: 'Union Budget Day Rollercoaster',
      description: 'Surprise changes in STT rates and capital gains taxes create a 600-point intraday swing in NIFTY 50 within two 15-minute candles.',
      symbol: 'BANKNIFTY',
      historicalDate: '2024-07-23',
      challengePrompt: 'Whipsaws are taking out both bulls and bears. Manage risk by reducing position sizing and honoring wide stop-losses.',
      candles: generateHistoricalCandles(51500, '5m', 35),
    },
    {
      id: 'adani-hindenburg-gap',
      title: 'The Short-Seller Gap Down',
      description: 'Overnight research report triggers an 18% gap-down at the 9:15 AM opening bell. Panic selling dominates the order book.',
      symbol: 'RELIANCE',
      historicalDate: '2023-01-25',
      challengePrompt: 'Test your emotional control: avoid averaging down on a falling knife and practice defined-risk mean-reversion setups.',
      candles: generateHistoricalCandles(2650, '15m', 35),
    },
  ];
}
