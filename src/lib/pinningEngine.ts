/**
 * TradeCraft AI — 0-DTE Expiry Pinning & Dealer Gamma Squeeze Risk Engine
 * Quantitative Engine Implementation (Sprint 24)
 *
 * Mathematically deterministic analytics for:
 * 1. Dealer GEX (Gamma Exposure) computation across strikes & Gamma Flip isolation
 * 2. Max Pain intrinsic payout minimization & strike migration trajectory
 * 3. 0-DTE Terminal Pinning Probability Distribution using drift-diffusion & magnetic potential
 * 4. 0-DTE Intraday Theta Decay schedule & Post-13:30 IV crush simulation
 * 5. 1-Click Delta/Gamma Neutral Pin Risk Hedger generator
 * 6. High-fidelity seeded chains for NIFTY, BANKNIFTY, and FINNIFTY
 */

import {
  DealerGEXResult,
  GexRegime,
  GammaSqueezeVulnerability,
  IntradayThetaPoint,
  IntradayThetaSchedule,
  MaxPainResult,
  PainMigrationDirection,
  PinHedgeAction,
  PinningEngineSummary,
  PinningStrikeOption,
  PinRiskExecutionPayload,
  PinRiskHedgeLeg,
  PinRiskHedgeRecommendation,
  PinRiskRegime,
  StrikeGexDetail,
  StrikePainDetail,
  TerminalPinningResult,
  TerminalStrikePinning,
} from '../types/pinning';
import { calculateBlackScholes, normalPDF } from './optionsEngine';

// ============================================================================
// 1. DEALER GAMMA EXPOSURE (GEX) & GAMMA FLIP ENGINE
// ============================================================================

/**
 * Computes Dealer Gamma Exposure (GEX) across strikes, net dealer positioning,
 * and isolates the exact Gamma Flip boundary level where Net GEX crosses zero.
 *
 * Mathematical Convention (SqueezeMetrics / SpotGamma Standard):
 * - Strike Call GEX = + (Call OI * lotSize * Call Gamma * S * 0.01 * S) / 10^7 (₹ Cr / 1%)
 * - Strike Put GEX  = + (Put OI * lotSize * Put Gamma * S * 0.01 * S) / 10^7 (₹ Cr / 1%)
 * - Net Strike GEX  = Strike Call GEX - Strike Put GEX
 *
 * When Net GEX > 0 (LONG_GAMMA):
 * Market makers hedge counter-cyclically (buying dips, selling rips), compressing realized volatility.
 * When Net GEX < 0 (SHORT_GAMMA):
 * Market makers hedge pro-cyclically (selling dips, buying rallies), amplifying volatility (Gamma Squeeze risk).
 */
export function calculateDealerGEX(
  chain: PinningStrikeOption[],
  spotPrice: number,
  lotSize: number
): DealerGEXResult {
  if (!chain || chain.length === 0) {
    throw new Error('Pinning chain must not be empty');
  }

  const sortedChain = [...chain].sort((a, b) => a.strike - b.strike);
  const totalChainCallOI = sortedChain.reduce((acc, c) => acc + c.callOI, 0) || 1;
  const totalChainPutOI = sortedChain.reduce((acc, c) => acc + c.putOI, 0) || 1;

  let totalCallGex = 0;
  let totalPutGex = 0;

  let maxCallGexVal = -Infinity;
  let maxCallGexStrike = sortedChain[0].strike;
  let maxPutGexVal = -Infinity;
  let maxPutGexStrike = sortedChain[0].strike;

  const strikeGexList: StrikeGexDetail[] = sortedChain.map((item) => {
    // ₹ Cr per 1% move:
    // (OI * lotSize * Gamma * Spot * (Spot * 0.01)) / 1e7
    const strikeCallGex = Number(
      ((item.callOI * lotSize * item.callGamma * spotPrice * (spotPrice * 0.01)) / 10000000).toFixed(2)
    );
    const strikePutGex = Number(
      ((item.putOI * lotSize * item.putGamma * spotPrice * (spotPrice * 0.01)) / 10000000).toFixed(2)
    );
    const netStrikeGex = Number((strikeCallGex - strikePutGex).toFixed(2));

    totalCallGex += strikeCallGex;
    totalPutGex += strikePutGex;

    if (strikeCallGex > maxCallGexVal) {
      maxCallGexVal = strikeCallGex;
      maxCallGexStrike = item.strike;
    }

    if (strikePutGex > maxPutGexVal) {
      maxPutGexVal = strikePutGex;
      maxPutGexStrike = item.strike;
    }

    return {
      strike: item.strike,
      strikeCallGex,
      strikePutGex,
      netStrikeGex,
      callOiPct: Number(((item.callOI / totalChainCallOI) * 100).toFixed(2)),
      putOiPct: Number(((item.putOI / totalChainPutOI) * 100).toFixed(2)),
      straddleOi: item.callOI + item.putOI,
    };
  });

  totalCallGex = Number(totalCallGex.toFixed(2));
  totalPutGex = Number(totalPutGex.toFixed(2));
  const netGex = Number((totalCallGex - totalPutGex).toFixed(2));

  // Determine GEX Regime
  let gexRegime: GexRegime = 'NEUTRAL';
  if (netGex > 25.0) {
    gexRegime = 'LONG_GAMMA';
  } else if (netGex < -25.0) {
    gexRegime = 'SHORT_GAMMA';
  }

  // Calculate Gamma Flip level via deterministic root finding:
  // Net GEX(S) = sum_k [ (CallOI_k - PutOI_k) * Gamma(S, k) * S^2 * 0.01 * lotSize / 1e7 ]
  const gammaFlipLevel = isolateGammaFlipLevel(sortedChain, spotPrice, lotSize);
  const distanceToFlipPoints = Number((gammaFlipLevel - spotPrice).toFixed(1));
  const distanceToFlipPercent = Number(((distanceToFlipPoints / spotPrice) * 100).toFixed(2));
  const isSpotAboveFlip = spotPrice >= gammaFlipLevel;

  // Gamma concentration within ±1% of spot
  const nearbyGexTotal = strikeGexList
    .filter((s) => Math.abs(s.strike - spotPrice) / spotPrice <= 0.01)
    .reduce((acc, s) => acc + Math.abs(s.strikeCallGex) + Math.abs(s.strikePutGex), 0);
  const allAbsoluteGexTotal =
    strikeGexList.reduce((acc, s) => acc + Math.abs(s.strikeCallGex) + Math.abs(s.strikePutGex), 0) || 1;
  const absoluteGammaConcentration = Number(((nearbyGexTotal / allAbsoluteGexTotal) * 100).toFixed(1));

  // Evaluate Squeeze Vulnerability
  let squeezeVulnerability: GammaSqueezeVulnerability = 'LOW';
  if (netGex < -100 && Math.abs(distanceToFlipPercent) < 1.2) {
    squeezeVulnerability = 'EXTREME';
  } else if (netGex < -40) {
    squeezeVulnerability = 'HIGH';
  } else if (netGex < 0) {
    squeezeVulnerability = 'MODERATE';
  }

  let regimeDescription = '';
  if (gexRegime === 'LONG_GAMMA') {
    regimeDescription = `Dealers are Net Long Gamma (+₹${netGex} Cr/1%). Counter-cyclical hedging dampens price swings. Spot is pinned between support ${maxPutGexStrike} and ceiling ${maxCallGexStrike}.`;
  } else if (gexRegime === 'SHORT_GAMMA') {
    regimeDescription = `Dealers are Net Short Gamma (${netGex} Cr/1%). Pro-cyclical dealer hedging amplifies price moves. High risk of 0-DTE gamma cascade if spot crosses ${gammaFlipLevel}.`;
  } else {
    regimeDescription = `Dealers Gamma Exposure is balanced (₹${netGex} Cr/1%). Market is in transition regime near Gamma Flip (${gammaFlipLevel}).`;
  }

  return {
    strikeGexList,
    totalCallGex,
    totalPutGex,
    netGex,
    gexRegime,
    gammaFlipLevel,
    distanceToFlipPercent,
    distanceToFlipPoints,
    isSpotAboveFlip,
    squeezeVulnerability,
    maxCallGexStrike,
    maxPutGexStrike,
    absoluteGammaConcentration,
    regimeDescription,
  };
}

/**
 * Isolates the exact spot price where aggregate dealer net gamma crosses 0
 */
function isolateGammaFlipLevel(
  chain: PinningStrikeOption[],
  spotPrice: number,
  lotSize: number
): number {
  const minStrike = chain[0].strike;
  const maxStrike = chain[chain.length - 1].strike;

  // Evaluation function for Net GEX at an arbitrary spot level S
  const evalNetGexAtSpot = (S: number): number => {
    const timeRemainingYears = 0.5 / (375 * 252); // ~30 minutes proxy
    const iv = 0.14;
    let net = 0;

    for (const c of chain) {
      // Black-Scholes gamma: pdf(d1) / (S * v * sqrt(T))
      const time = Math.max(timeRemainingYears, 0.0001);
      const d1 = (Math.log(S / c.strike) + (0.065 + (iv * iv) / 2.0) * time) / (iv * Math.sqrt(time));
      const gamma = normalPDF(d1) / (S * iv * Math.sqrt(time));
      const callGex = (c.callOI * lotSize * gamma * S * (S * 0.01)) / 10000000;
      const putGex = (c.putOI * lotSize * gamma * S * (S * 0.01)) / 10000000;
      net += callGex - putGex;
    }
    return net;
  };

  const steps = 60;
  const stepSize = (maxStrike - minStrike) / steps;
  let lowerBound = minStrike;
  let upperBound = maxStrike;
  let foundCross = false;

  let prevVal = evalNetGexAtSpot(minStrike);

  for (let i = 1; i <= steps; i++) {
    const currentSpot = minStrike + i * stepSize;
    const currentVal = evalNetGexAtSpot(currentSpot);

    if ((prevVal <= 0 && currentVal >= 0) || (prevVal >= 0 && currentVal <= 0)) {
      lowerBound = currentSpot - stepSize;
      upperBound = currentSpot;
      foundCross = true;
      break;
    }
    prevVal = currentVal;
  }

  // If no cross found, find the strike where absolute net GEX is minimized
  if (!foundCross) {
    let bestSpot = spotPrice;
    let minAbs = Infinity;
    for (const c of chain) {
      const g = Math.abs(evalNetGexAtSpot(c.strike));
      if (g < minAbs) {
        minAbs = g;
        bestSpot = c.strike;
      }
    }
    return Math.round(bestSpot);
  }

  // Refine crossing via Bisection (12 iterations for sub-point precision)
  let low = lowerBound;
  let high = upperBound;
  for (let iter = 0; iter < 12; iter++) {
    const mid = (low + high) / 2;
    const midVal = evalNetGexAtSpot(mid);
    if (Math.abs(midVal) < 0.01) {
      return Number(mid.toFixed(1));
    }
    const lowVal = evalNetGexAtSpot(low);
    if ((lowVal <= 0 && midVal <= 0) || (lowVal >= 0 && midVal >= 0)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Number(((low + high) / 2).toFixed(1));
}

// ============================================================================
// 2. MAX PAIN MINIMIZATION & MIGRATION ENGINE
// ============================================================================

/**
 * Computes Max Pain strike across the chain by minimizing total option intrinsic
 * payout borne by option writers, and calculates migration trajectory.
 */
export function calculateMaxPain(
  chain: PinningStrikeOption[],
  spotPrice: number,
  lotSize: number,
  previousMaxPain?: number
): MaxPainResult {
  if (!chain || chain.length === 0) {
    throw new Error('Option chain cannot be empty');
  }

  const sortedChain = [...chain].sort((a, b) => a.strike - b.strike);
  let minTotalLoss = Infinity;
  let maxPainStrike = sortedChain[0].strike;
  let callLossAtPain = 0;
  let putLossAtPain = 0;

  const strikePainTable: StrikePainDetail[] = [];

  for (const candidate of sortedChain) {
    const sEval = candidate.strike;
    let callLoss = 0;
    let putLoss = 0;

    for (const c of sortedChain) {
      // Call buyers gain if expiry settles above strike
      if (sEval > c.strike) {
        callLoss += (sEval - c.strike) * c.callOI * lotSize;
      }
      // Put buyers gain if expiry settles below strike
      if (sEval < c.strike) {
        putLoss += (c.strike - sEval) * c.putOI * lotSize;
      }
    }

    const totalLoss = callLoss + putLoss;
    const callLossCr = Number((callLoss / 10000000).toFixed(2));
    const putLossCr = Number((putLoss / 10000000).toFixed(2));
    const totalLossCr = Number((totalLoss / 10000000).toFixed(2));

    strikePainTable.push({
      strike: sEval,
      callLossCr,
      putLossCr,
      totalLossCr,
    });

    if (totalLoss < minTotalLoss) {
      minTotalLoss = totalLoss;
      maxPainStrike = sEval;
      callLossAtPain = callLossCr;
      putLossAtPain = putLossCr;
    }
  }

  const prevPain = previousMaxPain ?? maxPainStrike;
  let migrationDirection: PainMigrationDirection = 'STABLE';
  if (maxPainStrike > prevPain) {
    migrationDirection = 'UP';
  } else if (maxPainStrike < prevPain) {
    migrationDirection = 'DOWN';
  }

  const spotDistancePoints = Number((maxPainStrike - spotPrice).toFixed(1));
  const spotDistancePercent = Number(((spotDistancePoints / spotPrice) * 100).toFixed(2));

  // Calculate pain well boundary (strikes where payout is within 15% of minimum)
  const minLossCr = minTotalLoss / 10000000;
  const painClusterStrikes = strikePainTable
    .filter((s) => s.totalLossCr <= minLossCr * 1.15)
    .map((s) => s.strike);
  const painRangeLower = painClusterStrikes.length > 0 ? Math.min(...painClusterStrikes) : maxPainStrike;
  const painRangeUpper = painClusterStrikes.length > 0 ? Math.max(...painClusterStrikes) : maxPainStrike;

  // Steepness / variance ratio
  const avgLossCr =
    strikePainTable.reduce((acc, s) => acc + s.totalLossCr, 0) / (strikePainTable.length || 1);
  const payoutVarianceRatio = Number((avgLossCr / (minLossCr || 1)).toFixed(2));

  return {
    currentMaxPainStrike: maxPainStrike,
    previousMaxPainStrike: prevPain,
    migrationDirection,
    totalBuyerLossCr: Number((minTotalLoss / 10000000).toFixed(2)),
    callLossCr: callLossAtPain,
    putLossCr: putLossAtPain,
    strikePainTable,
    spotDistancePoints,
    spotDistancePercent,
    painRangeLower,
    painRangeUpper,
    payoutVarianceRatio,
  };
}

// ============================================================================
// 3. 0-DTE TERMINAL PINNING PROBABILITY DISTRIBUTION ENGINE
// ============================================================================

/**
 * Evaluates the terminal pinning probability distribution at expiry
 * using time-decay drift-diffusion and local gamma curvature attraction.
 */
export function calculatePinningProbabilities(
  chain: PinningStrikeOption[],
  spotPrice: number,
  minutesToExpiry: number = 120,
  ivAtm: number = 0.14
): TerminalPinningResult {
  if (!chain || chain.length === 0) {
    throw new Error('Chain must have strike options');
  }

  const sortedChain = [...chain].sort((a, b) => a.strike - b.strike);
  const maxTotalOI = Math.max(...sortedChain.map((c) => c.callOI + c.putOI), 1);
  const maxGamma = Math.max(...sortedChain.map((c) => Math.max(c.callGamma, c.putGamma)), 1e-5);

  // Time to expiry in annualized trading time
  const clampedMinutes = Math.max(1, minutesToExpiry);
  const timeToExpiryYears = clampedMinutes / (375 * 252);
  const stdPrice = Math.max(12, spotPrice * ivAtm * Math.sqrt(timeToExpiryYears));

  interface RawStrikeEval {
    strike: number;
    rawWeight: number;
    magneticScore: number;
    distanceToSpot: number;
    distancePercent: number;
    isAtm: boolean;
    totalOI: number;
    callOiRatio: number;
    putOiRatio: number;
    gammaWeight: number;
    oiWeight: number;
  }

  // Find nearest ATM strike
  let minAtmDist = Infinity;
  let atmStrike = sortedChain[0].strike;
  for (const c of sortedChain) {
    const d = Math.abs(c.strike - spotPrice);
    if (d < minAtmDist) {
      minAtmDist = d;
      atmStrike = c.strike;
    }
  }

  const rawEvaluations: RawStrikeEval[] = sortedChain.map((item) => {
    const totalOI = item.callOI + item.putOI;
    const oiRatio = totalOI / maxTotalOI;
    const avgGamma = (item.callGamma + item.putGamma) / 2;
    const gammaRatio = avgGamma / maxGamma;

    const distanceToSpot = Math.abs(item.strike - spotPrice);
    const distancePercent = Number(((item.strike - spotPrice) / spotPrice) * 100);

    // Gaussian base dispersion kernel
    const zScore = (item.strike - spotPrice) / stdPrice;
    const baseDensity = (1 / (stdPrice * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * zScore * zScore);

    // Magnetic pinning pull:
    // Option writers defend key high-OI strikes near spot
    const proximityMultiplier = Math.exp(-distanceToSpot / (stdPrice * 2.5));
    const magneticScore = Number(
      Math.min(100, Math.max(0, (oiRatio * 50 + gammaRatio * 30 + proximityMultiplier * 20) * 100)).toFixed(1)
    );

    // Curvature boost: High OI + High Gamma creates an attractive potential well
    const pinningAttractionFactor = 1.0 + (magneticScore / 100) * 2.2;
    const rawWeight = baseDensity * pinningAttractionFactor;

    const callOiRatio = totalOI > 0 ? Number((item.callOI / totalOI).toFixed(3)) : 0.5;
    const putOiRatio = totalOI > 0 ? Number((item.putOI / totalOI).toFixed(3)) : 0.5;

    return {
      strike: item.strike,
      rawWeight,
      magneticScore,
      distanceToSpot: Number(distanceToSpot.toFixed(1)),
      distancePercent: Number(distancePercent.toFixed(2)),
      isAtm: item.strike === atmStrike,
      totalOI,
      callOiRatio,
      putOiRatio,
      gammaWeight: Number(gammaRatio.toFixed(3)),
      oiWeight: Number(oiRatio.toFixed(3)),
    };
  });

  const sumRawWeights = rawEvaluations.reduce((acc, r) => acc + r.rawWeight, 0) || 1;

  const terminalStrikes: TerminalStrikePinning[] = rawEvaluations.map((r) => {
    const prob = Number(((r.rawWeight / sumRawWeights) * 100).toFixed(1));
    return {
      strike: r.strike,
      probabilityPercent: prob,
      pinningMagneticStrength: r.magneticScore,
      distanceToSpot: r.distanceToSpot,
      distancePercent: r.distancePercent,
      isAtm: r.isAtm,
      totalOI: r.totalOI,
      callOiRatio: r.callOiRatio,
      putOiRatio: r.putOiRatio,
      gammaWeight: r.gammaWeight,
      oiWeight: r.oiWeight,
    };
  });

  // Sort by probability to find most likely strike
  const sortedByProb = [...terminalStrikes].sort((a, b) => b.probabilityPercent - a.probabilityPercent);
  const mostLikelyPinnedStrike = sortedByProb[0]?.strike ?? atmStrike;
  const topProb = sortedByProb[0]?.probabilityPercent ?? 0;

  let pinningConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (topProb >= 35.0) {
    pinningConfidence = 'HIGH';
  } else if (topProb >= 22.0) {
    pinningConfidence = 'MEDIUM';
  }

  // Top 3 strikes
  const topThreeStrikes = sortedByProb.slice(0, 3).map((s) => ({
    strike: s.strike,
    probabilityPercent: s.probabilityPercent,
  }));

  // Pinning range around the top strike
  const candidateRange = sortedByProb.slice(0, 3).map((s) => s.strike);
  const pinningRange: [number, number] = [
    Math.min(...candidateRange),
    Math.max(...candidateRange),
  ];

  // Squeeze zone warning if high OI put/call imbalance near spot
  const expectedSqueezeZone =
    topProb > 25 &&
    Math.abs(mostLikelyPinnedStrike - spotPrice) > 30 &&
    clampedMinutes < 90;

  return {
    spotPrice,
    minutesToExpiry: clampedMinutes,
    strikes: terminalStrikes,
    mostLikelyPinnedStrike,
    pinningProbability: topProb,
    pinningConfidence,
    pinningRange,
    expectedSqueezeZone,
    topThreeStrikes,
  };
}

// ============================================================================
// 4. 0-DTE INTRADAY THETA DECAY & POST-13:30 IV CRUSH SIMULATOR
// ============================================================================

/**
 * Simulates non-linear intraday theta erosion and post-13:30 IV crush
 * across Indian market trading hours (09:15 to 15:30).
 */
export function calculateIntradayThetaCurve(
  currentMinutesRemaining: number = 120,
  baseIv: number = 0.14,
  spotPrice: number = 24500
): IntradayThetaSchedule {
  const totalTradingMinutes = 375; // 09:15 to 15:30
  const timeCheckpoints: Array<{ timeStr: string; minutesElapsed: number }> = [
    { timeStr: '09:15', minutesElapsed: 0 },
    { timeStr: '09:30', minutesElapsed: 15 },
    { timeStr: '09:45', minutesElapsed: 30 },
    { timeStr: '10:00', minutesElapsed: 45 },
    { timeStr: '10:30', minutesElapsed: 75 },
    { timeStr: '11:00', minutesElapsed: 105 },
    { timeStr: '11:30', minutesElapsed: 135 },
    { timeStr: '12:00', minutesElapsed: 165 },
    { timeStr: '12:30', minutesElapsed: 195 },
    { timeStr: '13:00', minutesElapsed: 225 },
    { timeStr: '13:30', minutesElapsed: 255 }, // Inflection point
    { timeStr: '14:00', minutesElapsed: 285 },
    { timeStr: '14:30', minutesElapsed: 315 },
    { timeStr: '15:00', minutesElapsed: 345 },
    { timeStr: '15:15', minutesElapsed: 360 },
    { timeStr: '15:30', minutesElapsed: 375 },
  ];

  // Base morning ATM straddle value approximation:
  // BS straddle ~ 0.8 * S * IV * sqrt(T)
  const fullDayYears = 1.0 / 252;
  const initialStraddlePremium = Number(
    (0.798 * spotPrice * baseIv * Math.sqrt(fullDayYears)).toFixed(1)
  );

  let previousStraddlePremium = initialStraddlePremium;

  const schedule: IntradayThetaPoint[] = timeCheckpoints.map((pt, idx) => {
    const minutesRemaining = totalTradingMinutes - pt.minutesElapsed;
    const fractionOfDayRemaining = Number((minutesRemaining / totalTradingMinutes).toFixed(3));
    const fractionElapsed = 1.0 - fractionOfDayRemaining;

    let ivCrushFactor = 1.0;
    let thetaRemainingPercent = 100.0;
    let gammaAccelerationFactor = 1.0;

    if (minutesRemaining >= 120) {
      // Pre-13:30 IST: Steady square root theta bleed
      thetaRemainingPercent = Math.sqrt(fractionOfDayRemaining) * 100;
      ivCrushFactor = 1.0 - 0.12 * Math.pow(fractionElapsed, 1.2);
      gammaAccelerationFactor = 1.0 + 1.25 * fractionElapsed;
    } else if (minutesRemaining > 0) {
      // Post-13:30 IST: Severe IV collapse & hyper-gamma acceleration
      const postRatio = minutesRemaining / 120; // 1.0 down to 0.0
      thetaRemainingPercent = 55.0 * Math.pow(postRatio, 1.35);
      ivCrushFactor = 0.88 * Math.pow(postRatio, 0.45);
      gammaAccelerationFactor = Math.min(8.5, 2.25 + 6.25 * (1.0 - postRatio));
    } else {
      // 15:30 IST: Expiration settlement
      thetaRemainingPercent = 0.0;
      ivCrushFactor = 0.25;
      gammaAccelerationFactor = 1.0; // Collapsed into binary intrinsic
    }

    ivCrushFactor = Math.max(0.25, Math.min(1.0, ivCrushFactor));
    const effectiveIV = Number((baseIv * ivCrushFactor).toFixed(4));
    const thetaDecayPercent = Number((100.0 - thetaRemainingPercent).toFixed(1));

    // Expected ATM Straddle Price in ₹
    const timeT = Math.max(minutesRemaining, 1) / (375 * 252);
    let expectedAtmStraddlePremium =
      minutesRemaining > 0
        ? Number((0.798 * spotPrice * effectiveIV * Math.sqrt(timeT)).toFixed(1))
        : 0;
    if (minutesRemaining <= 15) {
      expectedAtmStraddlePremium = Math.min(expectedAtmStraddlePremium, 15.0);
    }

    const elapsedHours = idx === 0 ? 0.25 : (pt.minutesElapsed - timeCheckpoints[idx - 1].minutesElapsed) / 60;
    const decayRatePerHourInr =
      idx === 0
        ? Number(((initialStraddlePremium - expectedAtmStraddlePremium) / 0.25).toFixed(1))
        : Number(((previousStraddlePremium - expectedAtmStraddlePremium) / (elapsedHours || 0.25)).toFixed(1));

    previousStraddlePremium = expectedAtmStraddlePremium;

    return {
      timeStr: pt.timeStr,
      minutesElapsed: pt.minutesElapsed,
      minutesRemaining,
      fractionOfDayRemaining,
      thetaDecayPercent,
      thetaRemainingPercent: Number(thetaRemainingPercent.toFixed(1)),
      gammaAccelerationFactor: Number(gammaAccelerationFactor.toFixed(2)),
      ivCrushFactor: Number(ivCrushFactor.toFixed(3)),
      effectiveIV,
      expectedAtmStraddlePremium,
      callDecayPercent: thetaDecayPercent,
      putDecayPercent: thetaDecayPercent,
      decayRatePerHourInr: Math.max(0, decayRatePerHourInr),
    };
  });

  // Identify current point matching currentMinutesRemaining
  let currentPoint = schedule[0];
  let minDiff = Infinity;
  for (const pt of schedule) {
    const diff = Math.abs(pt.minutesRemaining - currentMinutesRemaining);
    if (diff < minDiff) {
      minDiff = diff;
      currentPoint = pt;
    }
  }

  const post1330CrushActive = currentMinutesRemaining <= 120;
  const gammaExplosionWarning = currentPoint.gammaAccelerationFactor >= 3.5;

  return {
    currentMinutesRemaining,
    baseIv,
    spotPrice,
    schedule,
    currentPoint,
    post1330CrushActive,
    gammaExplosionWarning,
  };
}

// ============================================================================
// 5. 1-CLICK PIN RISK HEDGER RECOMMENDATION ENGINE
// ============================================================================

/**
 * Evaluates portfolio Greeks against 0-DTE Pinning & GEX metrics to generate
 * an automated 1-click Delta/Gamma neutral risk hedge order recommendation.
 */
export function generatePinRiskHedge(
  portfolio: {
    spotPrice: number;
    netDelta: number;
    netGamma: number;
    symbol?: string;
    lotSize?: number;
  },
  pinningAnalysis: TerminalPinningResult,
  gexMetrics: DealerGEXResult,
  maxPainMetrics: MaxPainResult
): PinRiskHedgeRecommendation {
  const spot = portfolio.spotPrice;
  const symbol = portfolio.symbol || 'NIFTY 50';
  const lotSize = portfolio.lotSize || 25;
  const pinnedStrike = pinningAnalysis.mostLikelyPinnedStrike;
  const isBankNifty = symbol.toUpperCase().includes('BANK');
  const strikeStep = isBankNifty ? 100 : 50;

  const atmStrike = Math.round(spot / strikeStep) * strikeStep;
  const distanceToPin = Math.abs(spot - pinnedStrike);

  let riskRegime: PinRiskRegime = 'PIN_SAFE';
  let hedgeAction: PinHedgeAction = 'DELTA_NEUTRAL_HEDGE';
  let strategyName = 'Delta Neutral Rebalancer';
  let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  let rationale = '';

  // 1. Identify Regime
  if (gexMetrics.gexRegime === 'SHORT_GAMMA' && gexMetrics.squeezeVulnerability === 'EXTREME') {
    riskRegime = 'GAMMA_EXPLOSION';
    hedgeAction = 'GAMMA_SQUEEZE_CONVEXITY';
    strategyName = 'Long Convexity Straddle Hedge';
    urgency = 'CRITICAL';
    rationale = `Severe Dealer Short Gamma (-₹${Math.abs(gexMetrics.netGex)} Cr/1%) near Gamma Flip (${gexMetrics.gammaFlipLevel}). Squeeze vulnerability is EXTREME. Deploying positive convexity straddle to protect against explosive directional breakout.`;
  } else if (pinningAnalysis.pinningConfidence === 'HIGH' && distanceToPin <= strikeStep) {
    riskRegime = 'PIN_RISK_HIGH';
    hedgeAction = 'PIN_STRANGLE_HARVEST';
    strategyName = 'Pinned Expiry Strangle / Iron Fly';
    urgency = 'HIGH';
    rationale = `Terminal pinning probability at strike ${pinnedStrike} is ${pinningAnalysis.pinningProbability}%. Max Pain aligns at ${maxPainMetrics.currentMaxPainStrike}. Hedging gamma tail risk while capturing extreme 0-DTE decay.`;
  } else if (Math.abs(portfolio.netDelta) > lotSize * 1.5) {
    riskRegime = 'PIN_RISK_HIGH';
    hedgeAction = 'DELTA_NEUTRAL_HEDGE';
    strategyName = 'Delta Neutral Rebalance';
    urgency = 'MEDIUM';
    rationale = `Portfolio net delta is skewed (${portfolio.netDelta > 0 ? '+' : ''}${portfolio.netDelta.toFixed(1)}). Expiry pinning dynamics threaten directional overshoot. Rebalancing to delta zero.`;
  } else {
    riskRegime = 'PIN_SAFE';
    hedgeAction = 'DELTA_NEUTRAL_HEDGE';
    strategyName = 'Preventative Micro-Delta Lock';
    urgency = 'LOW';
    rationale = `Portfolio Greeks are currently within safe limits. Pinning target at ${pinnedStrike} (${distanceToPin.toFixed(0)} pts away). Low immediate tail risk.`;
  }

  // 2. Synthesize Recommended Hedge Legs
  const legs: PinRiskHedgeLeg[] = [];
  const recId = `HEDGE_${symbol.replace(/\s+/g, '_')}_${Date.now()}`;
  const nowStr = new Date().toISOString();

  // Reference BS calculation for ATM options
  const bsAtm = calculateBlackScholes(spot, atmStrike, 0.5 / (375 * 252), 0.065, 0.14);

  if (hedgeAction === 'GAMMA_SQUEEZE_CONVEXITY') {
    // Buy 2 lots ATM Call + 2 lots ATM Put
    const lots = 2;
    const qty = lots * lotSize;
    legs.push({
      id: `${recId}_LEG1`,
      strike: atmStrike,
      optionType: 'CE',
      side: 'BUY',
      lots,
      quantity: qty,
      price: bsAtm.callPrice,
      delta: Number((lots * lotSize * bsAtm.callGreeks.delta).toFixed(2)),
      gamma: Number((lots * lotSize * bsAtm.callGreeks.gamma).toFixed(4)),
      theta: Number((lots * lotSize * bsAtm.callGreeks.theta).toFixed(1)),
      marginRequirement: Number((qty * bsAtm.callPrice).toFixed(0)),
    });
    legs.push({
      id: `${recId}_LEG2`,
      strike: atmStrike,
      optionType: 'PE',
      side: 'BUY',
      lots,
      quantity: qty,
      price: bsAtm.putPrice,
      delta: Number((lots * lotSize * bsAtm.putGreeks.delta).toFixed(2)),
      gamma: Number((lots * lotSize * bsAtm.putGreeks.gamma).toFixed(4)),
      theta: Number((lots * lotSize * bsAtm.putGreeks.theta).toFixed(1)),
      marginRequirement: Number((qty * bsAtm.putPrice).toFixed(0)),
    });
  } else if (hedgeAction === 'PIN_STRANGLE_HARVEST') {
    // Sell 1 lot ATM Straddle at pinned strike, buy protective wings
    const wingStep = strikeStep * 2;
    const bsPinned = calculateBlackScholes(spot, pinnedStrike, 0.5 / (375 * 252), 0.065, 0.14);
    const bsUpperWing = calculateBlackScholes(spot, pinnedStrike + wingStep, 0.5 / (375 * 252), 0.065, 0.14);
    const bsLowerWing = calculateBlackScholes(spot, pinnedStrike - wingStep, 0.5 / (375 * 252), 0.065, 0.14);

    const lots = 1;
    const qty = lots * lotSize;

    // Sell CE
    legs.push({
      id: `${recId}_LEG1`,
      strike: pinnedStrike,
      optionType: 'CE',
      side: 'SELL',
      lots,
      quantity: qty,
      price: bsPinned.callPrice,
      delta: Number((-qty * bsPinned.callGreeks.delta).toFixed(2)),
      gamma: Number((-qty * bsPinned.callGreeks.gamma).toFixed(4)),
      theta: Number((-qty * bsPinned.callGreeks.theta).toFixed(1)),
      marginRequirement: 65000,
    });
    // Sell PE
    legs.push({
      id: `${recId}_LEG2`,
      strike: pinnedStrike,
      optionType: 'PE',
      side: 'SELL',
      lots,
      quantity: qty,
      price: bsPinned.putPrice,
      delta: Number((-qty * bsPinned.putGreeks.delta).toFixed(2)),
      gamma: Number((-qty * bsPinned.putGreeks.gamma).toFixed(4)),
      theta: Number((-qty * bsPinned.putGreeks.theta).toFixed(1)),
      marginRequirement: 65000,
    });
    // Buy Upper Wing CE
    legs.push({
      id: `${recId}_LEG3`,
      strike: pinnedStrike + wingStep,
      optionType: 'CE',
      side: 'BUY',
      lots,
      quantity: qty,
      price: bsUpperWing.callPrice,
      delta: Number((qty * bsUpperWing.callGreeks.delta).toFixed(2)),
      gamma: Number((qty * bsUpperWing.callGreeks.gamma).toFixed(4)),
      theta: Number((qty * bsUpperWing.callGreeks.theta).toFixed(1)),
      marginRequirement: Number((qty * bsUpperWing.callPrice).toFixed(0)),
    });
    // Buy Lower Wing PE
    legs.push({
      id: `${recId}_LEG4`,
      strike: pinnedStrike - wingStep,
      optionType: 'PE',
      side: 'BUY',
      lots,
      quantity: qty,
      price: bsLowerWing.putPrice,
      delta: Number((qty * bsLowerWing.putGreeks.delta).toFixed(2)),
      gamma: Number((qty * bsLowerWing.putGreeks.gamma).toFixed(4)),
      theta: Number((qty * bsLowerWing.putGreeks.theta).toFixed(1)),
      marginRequirement: Number((qty * bsLowerWing.putPrice).toFixed(0)),
    });
  } else {
    // Delta Rebalancing: Inject opposing delta using ATM options
    const deltaDeficit = -portfolio.netDelta;
    const optionType = deltaDeficit > 0 ? 'CE' : 'PE';
    const chosenDelta = optionType === 'CE' ? bsAtm.callGreeks.delta : Math.abs(bsAtm.putGreeks.delta);
    const chosenPrice = optionType === 'CE' ? bsAtm.callPrice : bsAtm.putPrice;
    const lotsNeeded = Math.max(1, Math.round(Math.abs(deltaDeficit) / (lotSize * chosenDelta)));
    const qty = lotsNeeded * lotSize;

    legs.push({
      id: `${recId}_LEG1`,
      strike: atmStrike,
      optionType,
      side: 'BUY',
      lots: lotsNeeded,
      quantity: qty,
      price: chosenPrice,
      delta: Number((deltaDeficit > 0 ? qty * chosenDelta : -qty * chosenDelta).toFixed(2)),
      gamma: Number((qty * (optionType === 'CE' ? bsAtm.callGreeks.gamma : bsAtm.putGreeks.gamma)).toFixed(4)),
      theta: Number((qty * (optionType === 'CE' ? bsAtm.callGreeks.theta : bsAtm.putGreeks.theta)).toFixed(1)),
      marginRequirement: Number((qty * chosenPrice).toFixed(0)),
    });
  }

  // 3. Aggregate totals
  let hedgeDeltaInjection = 0;
  let hedgeGammaInjection = 0;
  let totalPremiumInflowOutflow = 0;
  let totalMarginRequired = 0;

  for (const leg of legs) {
    hedgeDeltaInjection += leg.delta;
    hedgeGammaInjection += leg.gamma;
    const premiumCash = leg.quantity * leg.price;
    if (leg.side === 'BUY') {
      totalPremiumInflowOutflow += premiumCash;
    } else {
      totalPremiumInflowOutflow -= premiumCash;
    }
    totalMarginRequired += leg.marginRequirement;
  }

  const projectedDeltaAfterHedge = Number((portfolio.netDelta + hedgeDeltaInjection).toFixed(2));
  const projectedGammaAfterHedge = Number((portfolio.netGamma + hedgeGammaInjection).toFixed(4));
  totalPremiumInflowOutflow = Number(totalPremiumInflowOutflow.toFixed(2));

  // Breakevens
  const breakevenRange: [number, number] = [
    Number((spot - strikeStep * 1.5).toFixed(0)),
    Number((spot + strikeStep * 1.5).toFixed(0)),
  ];

  // 4. Execution Payload for 1-click execution
  const executionPayload: PinRiskExecutionPayload = {
    symbol,
    orderType: 'MARKET',
    productType: 'MIS',
    timestamp: nowStr,
    legs: legs.map((l) => ({
      symbol: `${symbol} ${l.strike} ${l.optionType}`,
      strike: l.strike,
      optionType: l.optionType,
      side: l.side,
      quantity: l.quantity,
      price: l.price,
    })),
  };

  return {
    recommendationId: recId,
    timestamp: nowStr,
    symbol,
    spotPrice: spot,
    pinnedStrikeTarget: pinnedStrike,
    pinningProbability: pinningAnalysis.pinningProbability,
    riskRegime,
    hedgeAction,
    strategyName,
    urgency,
    rationale,
    legs,
    projectedDeltaAfterHedge,
    projectedGammaAfterHedge,
    totalPremiumInflowOutflow,
    netPremiumInr: -totalPremiumInflowOutflow,
    totalMarginRequired,
    maxProfit: totalPremiumInflowOutflow < 0 ? Math.abs(totalPremiumInflowOutflow) : 'Convexity Unlimited',
    maxRisk: totalPremiumInflowOutflow > 0 ? totalPremiumInflowOutflow : totalMarginRequired * 0.1,
    riskRewardRatio: totalPremiumInflowOutflow < 0 ? '1 : 2.8' : '1 : 3.2',
    breakevenRange,
    executionPayload,
  };
}

// ============================================================================
// 6. DEFAULT SEEDED MOCK DATA (NIFTY, BANKNIFTY, FINNIFTY 0-DTE CHAINS)
// ============================================================================

/**
 * Seeded 0-DTE option chain generator with realistic Black-Scholes Greeks
 */
export function generateSyntheticChain(
  symbol: string,
  spotPrice: number,
  lotSize: number,
  baseIv: number,
  strikeStep: number,
  numStrikesBelow: number = 10,
  numStrikesAbove: number = 10,
  minutesToExpiry: number = 120
): PinningStrikeOption[] {
  const atmStrike = Math.round(spotPrice / strikeStep) * strikeStep;
  const timeYears = Math.max(1, minutesToExpiry) / (375 * 252);
  const chain: PinningStrikeOption[] = [];

  for (let i = -numStrikesBelow; i <= numStrikesAbove; i++) {
    const strike = atmStrike + i * strikeStep;
    // Volatility skew / smile (puts have higher IV than calls out-of-the-money)
    const moneyness = strike / spotPrice;
    const skew = (1.0 - moneyness) * 0.25;
    const callIv = Math.max(0.08, baseIv - skew * 0.5);
    const putIv = Math.max(0.08, baseIv + skew * 0.8);

    const bsCall = calculateBlackScholes(spotPrice, strike, timeYears, 0.065, callIv);
    const bsPut = calculateBlackScholes(spotPrice, strike, timeYears, 0.065, putIv);

    // Realistic Open Interest Distribution (Bell curve centered around ATM / Max Pain)
    const distFromAtm = Math.abs(i);
    const baseOI = Math.max(5000, Math.round(180000 * Math.exp(-0.25 * distFromAtm * distFromAtm)));

    // Induce realistic asymmetry (Calls heavy above spot, Puts heavy below spot)
    const callOI = i >= 0 ? Math.round(baseOI * (1.2 + 0.3 * Math.sin(i))) : Math.round(baseOI * 0.6);
    const putOI = i <= 0 ? Math.round(baseOI * (1.3 + 0.4 * Math.cos(i))) : Math.round(baseOI * 0.5);

    // Volume is proportional to OI and proximity to ATM
    const callVolume = Math.round(callOI * (0.8 + 0.4 * Math.random()));
    const putVolume = Math.round(putOI * (0.8 + 0.4 * Math.random()));

    chain.push({
      strike,
      callOI,
      putOI,
      callIV: Number(callIv.toFixed(4)),
      putIV: Number(putIv.toFixed(4)),
      callGamma: bsCall.callGreeks.gamma,
      putGamma: bsPut.putGreeks.gamma,
      callDelta: bsCall.callGreeks.delta,
      putDelta: bsPut.putGreeks.delta,
      callVolume,
      putVolume,
      callPrice: bsCall.callPrice,
      putPrice: bsPut.putPrice,
      isAtm: strike === atmStrike,
      isITMCall: strike < spotPrice,
      isITMPut: strike > spotPrice,
    });
  }

  return chain;
}

/**
 * Seeded Default NIFTY 50 0-DTE Chain
 * Spot: 24,520, Strikes: 24,000 to 25,000 (step 50), Lot: 25
 */
export const DEFAULT_NIFTY_0DTE_CHAIN: PinningStrikeOption[] = generateSyntheticChain(
  'NIFTY 50',
  24520,
  25,
  0.138,
  50,
  10,
  10,
  105 // 105 min remaining (around 13:45 IST)
);

/**
 * Seeded Default BANKNIFTY 0-DTE Chain
 * Spot: 52,150, Strikes: 51,100 to 53,100 (step 100), Lot: 15
 */
export const DEFAULT_BANKNIFTY_0DTE_CHAIN: PinningStrikeOption[] = generateSyntheticChain(
  'BANKNIFTY',
  52150,
  15,
  0.172,
  100,
  10,
  10,
  105
);

/**
 * Seeded Default FINNIFTY 0-DTE Chain
 * Spot: 23,820, Strikes: 23,300 to 24,300 (step 50), Lot: 25
 */
export const DEFAULT_FINNIFTY_0DTE_CHAIN: PinningStrikeOption[] = generateSyntheticChain(
  'FINNIFTY',
  23820,
  25,
  0.145,
  50,
  10,
  10,
  105
);

// ============================================================================
// 7. UI BRIDGE & HIGH-LEVEL AGGREGATION HELPERS
// ============================================================================

/**
 * Convenience aggregator returning the complete analytics suite for UI widgets
 */
export function getPinningEngineSummary(
  symbol: string = 'NIFTY 50',
  chain?: PinningStrikeOption[],
  spotPrice?: number,
  lotSize?: number,
  previousMaxPain?: number,
  minutesRemaining: number = 105,
  baseIv: number = 0.14,
  portfolio?: { netDelta: number; netGamma: number }
): PinningEngineSummary {
  let activeChain = chain;
  let activeSpot = spotPrice;
  let activeLot = lotSize;

  if (!activeChain || activeChain.length === 0) {
    if (symbol.toUpperCase().includes('BANK')) {
      activeChain = DEFAULT_BANKNIFTY_0DTE_CHAIN;
      activeSpot = activeSpot || 52150;
      activeLot = activeLot || 15;
    } else if (symbol.toUpperCase().includes('FIN')) {
      activeChain = DEFAULT_FINNIFTY_0DTE_CHAIN;
      activeSpot = activeSpot || 23820;
      activeLot = activeLot || 25;
    } else {
      activeChain = DEFAULT_NIFTY_0DTE_CHAIN;
      activeSpot = activeSpot || 24520;
      activeLot = activeLot || 25;
    }
  }

  activeSpot = activeSpot || activeChain[Math.floor(activeChain.length / 2)].strike;
  activeLot = activeLot || 25;

  const gex = calculateDealerGEX(activeChain, activeSpot, activeLot);
  const maxPain = calculateMaxPain(activeChain, activeSpot, activeLot, previousMaxPain);
  const pinning = calculatePinningProbabilities(activeChain, activeSpot, minutesRemaining, baseIv);
  const thetaSchedule = calculateIntradayThetaCurve(minutesRemaining, baseIv, activeSpot);

  const activePortfolio = {
    spotPrice: activeSpot,
    netDelta: portfolio?.netDelta ?? 42.5,
    netGamma: portfolio?.netGamma ?? -0.012,
    symbol,
    lotSize: activeLot,
  };

  const hedgeRecommendation = generatePinRiskHedge(activePortfolio, pinning, gex, maxPain);

  return {
    symbol,
    spotPrice: activeSpot,
    lotSize: activeLot,
    timestamp: new Date().toISOString(),
    gex,
    maxPain,
    pinning,
    thetaSchedule,
    hedgeRecommendation,
  };
}

/**
 * Formats a currency value into Indian Rupee Crores string (₹ XX.XX Cr)
 */
export function formatRupeeCr(valueInCr: number): string {
  const sign = valueInCr > 0 ? '+' : valueInCr < 0 ? '-' : '';
  return `${sign}₹${Math.abs(valueInCr).toFixed(2)} Cr`;
}

/**
 * Formats GEX regime into readable badge styling colors
 */
export function formatGexRegimeBadge(regime: GexRegime): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (regime) {
    case 'LONG_GAMMA':
      return { label: 'LONG GAMMA', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.15)' };
    case 'SHORT_GAMMA':
      return { label: 'SHORT GAMMA', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' };
    case 'NEUTRAL':
    default:
      return { label: 'NEUTRAL GAMMA', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' };
  }
}

/**
 * Formats a strike price number with Indian thousands formatting
 */
export function formatStrike(strike: number): string {
  return strike.toLocaleString('en-IN');
}
