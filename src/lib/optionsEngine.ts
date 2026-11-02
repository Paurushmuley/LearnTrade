/**
 * Black-Scholes Analytical Pricing, Greeks & Multi-Leg Strategy Engine
 * For Indian Index Options (NIFTY 50 & BANKNIFTY)
 */

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number; // Daily theta decay in ₹
  vega: number;  // Price change per 1% change in IV
}

export interface OptionStrikeData {
  strike: number;
  callPrice: number;
  callIV: number;
  callOI: number;
  callVolume: number;
  callGreeks: OptionGreeks;
  putPrice: number;
  putIV: number;
  putOI: number;
  putVolume: number;
  putGreeks: OptionGreeks;
  isATM: boolean;
  isITMCall: boolean;
  isITMPut: boolean;
}

export interface OptionLeg {
  id: string;
  strike: number;
  optionType: 'CE' | 'PE';
  side: 'BUY' | 'SELL';
  quantity: number;
  premium: number;
  greeks: OptionGreeks;
}

export interface StrategyPayoffPoint {
  spotPrice: number;
  pnl: number;
}

export interface StrategyPayoffResult {
  name: string;
  maxProfit: number | 'Unlimited';
  maxLoss: number | 'Unlimited';
  breakevens: number[];
  netDelta: number;
  netTheta: number; // Daily ₹ decay
  netVega: number;
  netDebitOrCredit: number; // Positive = Debit paid, Negative = Credit received
  totalStatutoryTaxes: number;
  payoffPoints: StrategyPayoffPoint[];
}

/**
 * Standard Normal Cumulative Distribution Function (Abramowitz & Stegun)
 */
export function normalCDF(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * x);
    return c * Math.exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

/**
 * Standard Normal Probability Density Function
 */
export function normalPDF(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Black-Scholes Pricing & Greeks Calculator
 * @param S Current Spot Price
 * @param K Strike Price
 * @param T Time to expiration in years (e.g., 5 days = 5/365)
 * @param r Risk-free interest rate (e.g., 0.065 for RBI 6.5% repo rate)
 * @param v Implied Volatility (e.g., 0.14 for 14% IV)
 */
export function calculateBlackScholes(
  S: number,
  K: number,
  T: number,
  r: number = 0.065,
  v: number = 0.14
): {
  callPrice: number;
  putPrice: number;
  callGreeks: OptionGreeks;
  putGreeks: OptionGreeks;
} {
  const time = Math.max(T, 0.0001); // Prevent division by zero
  const d1 = (Math.log(S / K) + (r + (v * v) / 2.0) * time) / (v * Math.sqrt(time));
  const d2 = d1 - v * Math.sqrt(time);

  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const NminusD1 = normalCDF(-d1);
  const NminusD2 = normalCDF(-d2);
  const pdfD1 = normalPDF(d1);

  // Prices
  const callPrice = S * Nd1 - K * Math.exp(-r * time) * Nd2;
  const putPrice = K * Math.exp(-r * time) * NminusD2 - S * NminusD1;

  // Common Greeks
  const gamma = pdfD1 / (S * v * Math.sqrt(time));
  const vega = (S * pdfD1 * Math.sqrt(time)) / 100; // per 1% change

  // Call Greeks
  const callDelta = Nd1;
  const callThetaDaily = (-(S * pdfD1 * v) / (2 * Math.sqrt(time)) - r * K * Math.exp(-r * time) * Nd2) / 365;

  // Put Greeks
  const putDelta = Nd1 - 1.0;
  const putThetaDaily = (-(S * pdfD1 * v) / (2 * Math.sqrt(time)) + r * K * Math.exp(-r * time) * NminusD2) / 365;

  return {
    callPrice: Number(Math.max(0.05, callPrice).toFixed(2)),
    putPrice: Number(Math.max(0.05, putPrice).toFixed(2)),
    callGreeks: {
      delta: Number(callDelta.toFixed(3)),
      gamma: Number(gamma.toFixed(5)),
      theta: Number(callThetaDaily.toFixed(2)),
      vega: Number(vega.toFixed(2)),
    },
    putGreeks: {
      delta: Number(putDelta.toFixed(3)),
      gamma: Number(gamma.toFixed(5)),
      theta: Number(putThetaDaily.toFixed(2)),
      vega: Number(vega.toFixed(2)),
    },
  };
}

/**
 * Generates an Option Chain for an index around the current spot price
 */
export function generateOptionChain(
  symbol: string,
  spotPrice: number,
  daysToExpiry: number = 4
): OptionStrikeData[] {
  const step = symbol === 'BANKNIFTY' ? 100 : 50;
  const numStrikes = 15; // 7 below ATM, ATM, 7 above ATM
  const atmStrike = Math.round(spotPrice / step) * step;
  const startStrike = atmStrike - Math.floor(numStrikes / 2) * step;

  const T = daysToExpiry / 365;
  const chain: OptionStrikeData[] = [];

  for (let i = 0; i < numStrikes; i++) {
    const strike = startStrike + i * step;
    const isATM = strike === atmStrike;
    const isITMCall = strike < spotPrice;
    const isITMPut = strike > spotPrice;

    // IV skew: OTM Puts have slightly higher IV (Volatility smile)
    const distancePct = (strike - spotPrice) / spotPrice;
    const callIV = Number((0.13 + (distancePct < 0 ? Math.abs(distancePct) * 0.15 : distancePct * 0.08)).toFixed(3));
    const putIV = Number((0.13 + (distancePct > 0 ? distancePct * 0.18 : Math.abs(distancePct) * 0.09)).toFixed(3));

    const bs = calculateBlackScholes(spotPrice, strike, T, 0.065, callIV);

    const callOI = Math.floor(Math.random() * 4000000 + 800000);
    const putOI = Math.floor(Math.random() * 4000000 + 800000);
    const callVolume = Math.floor(callOI * 0.35);
    const putVolume = Math.floor(putOI * 0.35);

    chain.push({
      strike,
      callPrice: bs.callPrice,
      callIV: Number((callIV * 100).toFixed(1)),
      callOI,
      callVolume,
      callGreeks: bs.callGreeks,
      putPrice: bs.putPrice,
      putIV: Number((putIV * 100).toFixed(1)),
      putOI,
      putVolume,
      putGreeks: bs.putGreeks,
      isATM,
      isITMCall,
      isITMPut,
    });
  }

  return chain;
}

/**
 * Computes Payoff Profile for a Multi-Leg Option Strategy
 */
export function calculateStrategyPayoff(
  name: string,
  legs: OptionLeg[],
  spotPrice: number,
  lotSize: number = 25
): StrategyPayoffResult {
  if (legs.length === 0) {
    return {
      name,
      maxProfit: 0,
      maxLoss: 0,
      breakevens: [],
      netDelta: 0,
      netTheta: 0,
      netVega: 0,
      netDebitOrCredit: 0,
      totalStatutoryTaxes: 0,
      payoffPoints: [],
    };
  }

  // Calculate net debit / credit
  let netDebitOrCredit = 0;
  let totalPremiumSellTurnover = 0;
  let netDelta = 0;
  let netTheta = 0;
  let netVega = 0;

  legs.forEach((leg) => {
    const totalLegValue = leg.premium * leg.quantity * lotSize;
    if (leg.side === 'BUY') {
      netDebitOrCredit += totalLegValue;
      netDelta += leg.greeks.delta * leg.quantity * lotSize;
      netTheta += leg.greeks.theta * leg.quantity * lotSize;
      netVega += leg.greeks.vega * leg.quantity * lotSize;
    } else {
      netDebitOrCredit -= totalLegValue;
      totalPremiumSellTurnover += totalLegValue;
      netDelta -= leg.greeks.delta * leg.quantity * lotSize;
      netTheta -= leg.greeks.theta * leg.quantity * lotSize;
      netVega -= leg.greeks.vega * leg.quantity * lotSize;
    }
  });

  // Calculate Indian Options Statutory Taxes:
  // Brokerage: ₹20 per leg
  // STT: 0.1% on Sell turnover
  // Exchange Turnover: 0.05% of turnover
  // GST: 18% on (Brokerage + Exchange)
  const brokerage = legs.length * 20;
  const stt = totalPremiumSellTurnover * 0.001;
  const exchangeCharges = Math.abs(netDebitOrCredit) * 0.0005;
  const gst = (brokerage + exchangeCharges) * 0.18;
  const totalStatutoryTaxes = Number((brokerage + stt + exchangeCharges + gst).toFixed(2));

  // Generate Payoff curve across a range from -10% to +10% of spot
  const minRange = spotPrice * 0.90;
  const maxRange = spotPrice * 1.10;
  const numSteps = 50;
  const stepSize = (maxRange - minRange) / numSteps;

  const payoffPoints: StrategyPayoffPoint[] = [];
  let maxProfit = -Infinity;
  let maxLoss = Infinity;

  for (let i = 0; i <= numSteps; i++) {
    const s = Number((minRange + i * stepSize).toFixed(1));
    let totalLegPnL = 0;

    legs.forEach((leg) => {
      let intrinsicAtExpiry = 0;
      if (leg.optionType === 'CE') {
        intrinsicAtExpiry = Math.max(0, s - leg.strike);
      } else {
        intrinsicAtExpiry = Math.max(0, leg.strike - s);
      }

      if (leg.side === 'BUY') {
        totalLegPnL += (intrinsicAtExpiry - leg.premium) * leg.quantity * lotSize;
      } else {
        totalLegPnL += (leg.premium - intrinsicAtExpiry) * leg.quantity * lotSize;
      }
    });

    const netPnL = Number((totalLegPnL - totalStatutoryTaxes).toFixed(2));
    payoffPoints.push({ spotPrice: s, pnl: netPnL });

    if (netPnL > maxProfit) maxProfit = netPnL;
    if (netPnL < maxLoss) maxLoss = netPnL;
  }

  // Find Breakevens (where P&L crosses 0)
  const breakevens: number[] = [];
  for (let i = 1; i < payoffPoints.length; i++) {
    const prev = payoffPoints[i - 1];
    const curr = payoffPoints[i];
    if ((prev.pnl <= 0 && curr.pnl > 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
      // Linear interpolation
      const fraction = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
      const bePrice = Number((prev.spotPrice + fraction * (curr.spotPrice - prev.spotPrice)).toFixed(1));
      breakevens.push(bePrice);
    }
  }

  // Detect uncapped / unlimited risk
  const hasNakedShort = legs.some(l => l.side === 'SELL') &&
    legs.filter(l => l.side === 'SELL').length > legs.filter(l => l.side === 'BUY').length;

  return {
    name,
    maxProfit: maxProfit > 500000 && hasNakedShort ? 'Unlimited' : Number(maxProfit.toFixed(2)),
    maxLoss: maxLoss < -500000 || hasNakedShort ? 'Unlimited' : Number(Math.abs(maxLoss).toFixed(2)),
    breakevens,
    netDelta: Number(netDelta.toFixed(2)),
    netTheta: Number(netTheta.toFixed(2)),
    netVega: Number(netVega.toFixed(2)),
    netDebitOrCredit: Number(netDebitOrCredit.toFixed(2)),
    totalStatutoryTaxes,
    payoffPoints,
  };
}

/**
 * Pre-Packaged Option Strategy Templates
 */
export function getStrategyTemplates(spotPrice: number, step: number = 50): {
  id: string;
  name: string;
  description: string;
  generateLegs: () => OptionLeg[];
}[] {
  const atm = Math.round(spotPrice / step) * step;

  return [
    {
      id: 'bull-call-spread',
      name: 'Bull Call Spread (Defined Risk)',
      description: 'Moderately bullish play. Buy ATM Call and Sell OTM Call to fund the premium and cap risk.',
      generateLegs: () => [
        {
          id: 'leg-1',
          strike: atm,
          optionType: 'CE',
          side: 'BUY',
          quantity: 1,
          premium: 160,
          greeks: { delta: 0.52, gamma: 0.001, theta: -24, vega: 14 },
        },
        {
          id: 'leg-2',
          strike: atm + step * 2,
          optionType: 'CE',
          side: 'SELL',
          quantity: 1,
          premium: 75,
          greeks: { delta: 0.31, gamma: 0.0008, theta: -15, vega: 10 },
        },
      ],
    },
    {
      id: 'iron-condor',
      name: 'Iron Condor (Delta-Neutral Theta Harvester)',
      description: 'Rangebound institutional setup. Sells OTM Call & Put spreads to profit from sideways action and time decay.',
      generateLegs: () => [
        {
          id: 'leg-1',
          strike: atm - step * 3,
          optionType: 'PE',
          side: 'BUY',
          quantity: 1,
          premium: 35,
          greeks: { delta: -0.15, gamma: 0.0005, theta: -8, vega: 6 },
        },
        {
          id: 'leg-2',
          strike: atm - step,
          optionType: 'PE',
          side: 'SELL',
          quantity: 1,
          premium: 95,
          greeks: { delta: -0.38, gamma: 0.0009, theta: -18, vega: 12 },
        },
        {
          id: 'leg-3',
          strike: atm + step,
          optionType: 'CE',
          side: 'SELL',
          quantity: 1,
          premium: 95,
          greeks: { delta: 0.38, gamma: 0.0009, theta: -18, vega: 12 },
        },
        {
          id: 'leg-4',
          strike: atm + step * 3,
          optionType: 'CE',
          side: 'BUY',
          quantity: 1,
          premium: 35,
          greeks: { delta: 0.15, gamma: 0.0005, theta: -8, vega: 6 },
        },
      ],
    },
    {
      id: 'long-straddle',
      name: 'Long Straddle (High Volatility Breakout)',
      description: 'Event-driven setup (Budget, Elections). Buy ATM Call & ATM Put to profit from massive moves in either direction.',
      generateLegs: () => [
        {
          id: 'leg-1',
          strike: atm,
          optionType: 'CE',
          side: 'BUY',
          quantity: 1,
          premium: 160,
          greeks: { delta: 0.52, gamma: 0.001, theta: -24, vega: 14 },
        },
        {
          id: 'leg-2',
          strike: atm,
          optionType: 'PE',
          side: 'BUY',
          quantity: 1,
          premium: 155,
          greeks: { delta: -0.48, gamma: 0.001, theta: -23, vega: 14 },
        },
      ],
    },
  ];
}
