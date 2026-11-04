// Sprint 17 — Execution Engine: VWAP, TWAP, Almgren-Chriss Optimal Liquidation
// Mathematical specification: Almgren & Chriss (2000) "Optimal Execution of Portfolio Transactions"
// Indian market volume profile: NSE intraday U-shape (opening rush + closing surge)

import {
  ExecutionAlgoType,
  OrderSide,
  ChildOrderSlice,
  VolumeProfilePoint,
  AlmgrenChrissParams,
  ImplementationShortfallBreakdown,
  ExecutionSummary,
  AlgoComparison,
} from '../types/execution';

// ─────────────────────────────────────────────────────────────────────────────
// 1. INDIAN NSE INTRADAY VOLUME PROFILE (25 intervals, 15-min buckets)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a realistic U-shaped intraday volume profile for NSE equities.
 * Based on empirical NSE cash segment patterns:
 *   - Opening rush: 9:15–10:00 AM (~30% of daily volume)
 *   - Midday lull:  10:00–13:00 PM (~25%)
 *   - Pre-close:   13:00–15:30 PM (~45%)
 */
export function generateIndianVolumeProfile(): VolumeProfilePoint[] {
  // Raw weights for 25 × 15-min buckets from 9:15 to 15:30
  const rawWeights = [
    // Morning session (9:15 – 10:30) — opening rush
    8.5, 6.2, 4.8, 3.9, 3.2,
    // Midday lull (10:30 – 13:00)
    2.8, 2.6, 2.5, 2.4, 2.3, 2.2,
    // Pre-close build-up (13:00 – 14:30)
    2.6, 2.9, 3.4, 4.1, 4.8,
    // Closing surge (14:30 – 15:30)
    5.8, 6.9, 8.2, 9.5, 11.5,
    // Final 15-minute close (15:15 – 15:30 — high institutional activity)
    6.2, 4.3, 3.1, 2.3,
    // Closing auction buffer
    1.9,
  ];

  const total = rawWeights.reduce((s, w) => s + w, 0);
  const labels: { label: string; desc: string }[] = [
    { label: '09:15', desc: 'Opening Auction Rush' },
    { label: '09:30', desc: 'Post-Open Momentum' },
    { label: '09:45', desc: 'Early Price Discovery' },
    { label: '10:00', desc: 'Trend Establishment' },
    { label: '10:15', desc: 'Morning Continuation' },
    { label: '10:30', desc: 'Midday Transition' },
    { label: '10:45', desc: 'Midday Lull' },
    { label: '11:00', desc: 'Low Volatility Zone' },
    { label: '11:15', desc: 'Institutional Accumulation' },
    { label: '11:30', desc: 'Range Trading' },
    { label: '11:45', desc: 'Pre-Noon Quiet' },
    { label: '12:00', desc: 'Noon Reset' },
    { label: '12:15', desc: 'Post-Noon Activity' },
    { label: '12:30', desc: 'Afternoon Build-up' },
    { label: '12:45', desc: 'Smart Money Entry' },
    { label: '13:00', desc: 'Pre-Close Ramp' },
    { label: '13:15', desc: 'Institutional Positioning' },
    { label: '13:30', desc: 'Closing Surge Begins' },
    { label: '13:45', desc: 'High-Volume Closing' },
    { label: '14:00', desc: 'Peak Closing Volume' },
    { label: '14:15', desc: 'Closing Auction Approach' },
    { label: '14:30', desc: 'Pre-Auction Surge' },
    { label: '14:45', desc: 'Portfolio Rebalancing' },
    { label: '15:00', desc: 'Block Trade Flurry' },
    { label: '15:15', desc: 'Closing Auction Buffer' },
  ];

  return rawWeights.map((w, i) => ({
    timeMinutesFromOpen: i * 15,
    timeLabel: labels[i]?.label ?? `T+${i * 15}`,
    volumeFraction: w / total,
    description: labels[i]?.desc ?? 'Trading',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ALMGREN-CHRISS OPTIMAL LIQUIDATION TRAJECTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute Almgren-Chriss optimal liquidation trajectory.
 *
 * The optimal holdings schedule (continuous form):
 *   x(t) = X₀ · sinh(κ(T − t)) / sinh(κT)
 *
 * where: κ = sqrt(λσ²/η)  [risk-aversion × variance / temp-impact]
 *
 * Trade rates (discrete, N slices):
 *   n_j = x(t_{j-1}) − x(t_j)  for j = 1..N
 *
 * @param params AlmgrenChrissParams
 * @param numSlices Number of discrete execution intervals
 * @returns Array of target quantities per slice (sums to totalQty)
 */
export function computeAlmgrenChrissTrajectory(
  params: AlmgrenChrissParams,
  numSlices: number = 20
): number[] {
  const { totalQty, horizonMinutes, riskAversion, sigma, permanentImpact, temporaryImpact } = params;

  // Convert to per-minute σ (sigma given as daily)
  const sigmaPerMin = sigma / Math.sqrt(375); // NSE trading minutes

  // κ = sqrt(λσ²/η)
  const kappa = Math.sqrt(
    (riskAversion * sigmaPerMin * sigmaPerMin) / Math.max(temporaryImpact, 1e-10)
  );

  // Trajectory at discrete time points
  const dt = horizonMinutes / numSlices;
  const holdings: number[] = [];

  for (let j = 0; j <= numSlices; j++) {
    const t = j * dt;
    let holding: number;
    if (kappa * horizonMinutes < 1e-10) {
      // Near-zero kappa → uniform liquidation (TWAP limit)
      holding = totalQty * (1 - j / numSlices);
    } else {
      holding =
        totalQty *
        (Math.sinh(kappa * (horizonMinutes - t)) / Math.sinh(kappa * horizonMinutes));
    }
    holdings.push(Math.max(0, holding));
  }

  // Trade quantities per interval = difference between consecutive holdings
  const tradeQtys: number[] = [];
  for (let j = 0; j < numSlices; j++) {
    tradeQtys.push(Math.round(holdings[j] - holdings[j + 1]));
  }

  // Ensure exact total (rounding correction)
  const sumQ = tradeQtys.reduce((s, q) => s + q, 0);
  const diff = totalQty - sumQ;
  if (tradeQtys.length > 0) tradeQtys[tradeQtys.length - 1] += diff;

  return tradeQtys;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TWAP SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute TWAP (Time-Weighted Average Price) schedule.
 * Uniform slice allocation: each slice = totalQty / numSlices
 */
export function computeTWAPSchedule(totalQty: number, numSlices: number): number[] {
  const baseQty = Math.floor(totalQty / numSlices);
  const remainder = totalQty - baseQty * numSlices;
  const slices = Array(numSlices).fill(baseQty);
  slices[0] += remainder; // put remainder in first slice
  return slices;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. VWAP SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute VWAP schedule by proportionally allocating quantity to
 * time buckets based on the intraday volume profile.
 */
export function computeVWAPSchedule(
  totalQty: number,
  profile: VolumeProfilePoint[],
  numSlices: number
): number[] {
  // If numSlices < profile length, aggregate profile buckets
  const bucketsPerSlice = Math.ceil(profile.length / numSlices);
  const sliceWeights: number[] = [];

  for (let s = 0; s < numSlices; s++) {
    let weight = 0;
    for (let b = s * bucketsPerSlice; b < (s + 1) * bucketsPerSlice && b < profile.length; b++) {
      weight += profile[b].volumeFraction;
    }
    sliceWeights.push(weight);
  }

  // Normalize weights
  const totalWeight = sliceWeights.reduce((s, w) => s + w, 0);
  const normalizedWeights = sliceWeights.map((w) => w / totalWeight);

  // Allocate quantities
  const slices = normalizedWeights.map((w) => Math.round(w * totalQty));

  // Rounding correction
  const sumQ = slices.reduce((s, q) => s + q, 0);
  slices[0] += totalQty - sumQ;

  return slices;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MARKET IMPACT SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate fill price for a child slice including:
 *  - Temporary market impact (proportional to trade rate)
 *  - Random noise (Brownian motion)
 *  - Permanent price drift accumulated from prior slices
 */
export function simulateFillPrice(
  benchmarkPrice: number,
  targetQty: number,
  side: OrderSide,
  temporaryImpact: number,
  permanentImpact: number,
  cumulativePermImpact: number,
  sigma: number,
  dt: number
): number {
  const direction = side === 'BUY' ? 1 : -1;
  const sigmaPerSlice = sigma * Math.sqrt(dt / 375); // dt in minutes

  // Gaussian noise
  const noise = gaussianRandom() * sigmaPerSlice * benchmarkPrice;

  // Temporary impact (adverse): cost proportional to trade rate
  const tradeRate = targetQty / Math.max(dt, 1);
  const tempImpact = direction * temporaryImpact * tradeRate;

  // Permanent drift accumulated
  const permDrift = direction * cumulativePermImpact;

  return benchmarkPrice + tempImpact + permDrift + noise;
}

/** Box-Muller Gaussian random number */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. IMPLEMENTATION SHORTFALL (PEROLD ATTRIBUTION)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Perold Implementation Shortfall decomposition.
 * IS = (Avg Fill Price − Arrival Price) × Direction × 10000 / Arrival Price  [bps]
 *
 * Decomposed into:
 *   - Delay cost (opportunity cost of not executing at arrival)
 *   - Temporary market impact
 *   - Permanent price drift
 *   - Statutory fee drag (Indian SEBI taxes)
 *   - Opportunity cost (unfilled slices)
 */
export function calculateImplementationShortfall(
  arrivalPrice: number,
  avgFillPrice: number,
  side: OrderSide,
  totalQty: number,
  executedQty: number,
  temporaryImpactTotal: number,
  permanentImpactTotal: number,
  statutoryChargesPerShare: number
): ImplementationShortfallBreakdown {
  const direction = side === 'BUY' ? 1 : -1;

  const totalBps =
    direction * ((avgFillPrice - arrivalPrice) / arrivalPrice) * 10000;

  // Approximate decomposition
  const tempImpactBps = (temporaryImpactTotal / arrivalPrice) * 10000;
  const permImpactBps = (permanentImpactTotal / arrivalPrice) * 10000;
  const statutoryBps = (statutoryChargesPerShare / arrivalPrice) * 10000;
  const delayBps = Math.max(0, totalBps - tempImpactBps - permImpactBps - statutoryBps) * 0.3;
  const opportunityCostBps =
    executedQty < totalQty
      ? ((totalQty - executedQty) / totalQty) * Math.abs(totalBps) * 0.5
      : 0;

  return {
    totalBps: parseFloat(totalBps.toFixed(2)),
    delayBps: parseFloat(delayBps.toFixed(2)),
    temporaryImpactBps: parseFloat(tempImpactBps.toFixed(2)),
    permanentImpactBps: parseFloat(permImpactBps.toFixed(2)),
    statutoryFeeDragBps: parseFloat(statutoryBps.toFixed(2)),
    opportunityCostBps: parseFloat(opportunityCostBps.toFixed(2)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. STATUTORY CHARGES CALCULATOR (Indian NSE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Indian statutory charges per trade
 * STT (intraday delivery BUY = 0.025%, SELL = 0.025%, F&O = 0.0125%)
 * Exchange txn charges: NSE = 0.00345% + stamp 0.015% + SEBI 0.0001%
 */
export function calculateStatutoryCharges(
  notional: number,
  side: OrderSide,
  isDelivery: boolean = false
): number {
  const sttRate = isDelivery ? (side === 'BUY' ? 0.001 : 0.001) : 0.00025;
  const exchangeRate = 0.0000345;
  const stampRate = 0.00015;
  const sebiRate = 0.000001;
  const brokerageRate = 0.0003; // flat ₹20 simulated as 0.03%

  const stt = notional * sttRate;
  const exchange = notional * exchangeRate;
  const stamp = notional * stampRate;
  const sebi = notional * sebiRate;
  const brokerage = Math.min(20, notional * brokerageRate); // ₹20 max

  return parseFloat((stt + exchange + stamp + sebi + brokerage).toFixed(2));
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SYNTHETIC EXECUTION GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a full synthetic execution simulation for a given algorithm.
 * This is the main entry point for the ExecutionAlgoModal.
 */
export function generateSyntheticExecution(
  ticker: string,
  side: OrderSide,
  algo: ExecutionAlgoType,
  totalQty: number,
  horizonMinutes: number,
  arrivalPrice: number,
  riskAversion: number = 1e-6,
  sigma: number = 0.25,
  permanentImpact: number = 0.1,
  temporaryImpact: number = 0.05
): ExecutionSummary {
  const profile = generateIndianVolumeProfile();
  const numSlices = Math.min(20, Math.max(5, Math.floor(horizonMinutes / 15)));
  const dt = horizonMinutes / numSlices;

  let sliceQtys: number[];

  if (algo === 'ALMGREN_CHRISS') {
    const acParams: AlmgrenChrissParams = {
      totalQty,
      horizonMinutes,
      riskAversion,
      sigma,
      permanentImpact,
      temporaryImpact,
      arrivalPrice,
    };
    sliceQtys = computeAlmgrenChrissTrajectory(acParams, numSlices);
  } else if (algo === 'TWAP') {
    sliceQtys = computeTWAPSchedule(totalQty, numSlices);
  } else {
    // VWAP (default) and ICEBERG_PEGGED
    sliceQtys = computeVWAPSchedule(totalQty, profile, numSlices);
  }

  // Simulate fills
  const slices: ChildOrderSlice[] = [];
  let cumulativeQty = 0;
  let runningNotional = 0;
  let cumulativePermImpact = 0;
  let totalTempImpact = 0;
  let totalPermImpactAccum = 0;
  let totalStatutoryCharges = 0;

  for (let i = 0; i < numSlices; i++) {
    const targetQty = sliceQtys[i];
    const scheduledTime = i * dt;

    // Drift the benchmark price with Brownian motion
    const sigmaPerSlice = sigma * Math.sqrt(dt / 375);
    const benchmarkPrice = arrivalPrice * (1 + gaussianRandom() * sigmaPerSlice * i * 0.1);

    // Simulate fill
    const fillPrice = simulateFillPrice(
      benchmarkPrice,
      targetQty,
      side,
      temporaryImpact,
      permanentImpact,
      cumulativePermImpact,
      sigma,
      dt
    );

    // Accumulate permanent impact
    const direction = side === 'BUY' ? 1 : -1;
    const permImpactThisSlice = direction * permanentImpact * (targetQty / Math.max(totalQty, 1));
    cumulativePermImpact += permImpactThisSlice;
    totalPermImpactAccum += Math.abs(permImpactThisSlice);

    const tempImpactThisSlice =
      Math.abs(temporaryImpact * (targetQty / Math.max(dt, 1)));
    totalTempImpact += tempImpactThisSlice;

    cumulativeQty += targetQty;
    runningNotional += targetQty * fillPrice;
    const runningVwap = cumulativeQty > 0 ? runningNotional / cumulativeQty : fillPrice;

    const slippageBps =
      direction * ((fillPrice - benchmarkPrice) / benchmarkPrice) * 10000;

    const sliceNotional = targetQty * fillPrice;
    totalStatutoryCharges += calculateStatutoryCharges(sliceNotional, side, false);

    slices.push({
      sliceIndex: i,
      scheduledTime,
      targetQty,
      executedQty: targetQty, // full fill assumed in simulation
      benchmarkPrice: parseFloat(benchmarkPrice.toFixed(2)),
      fillPrice: parseFloat(fillPrice.toFixed(2)),
      slippageBps: parseFloat(slippageBps.toFixed(2)),
      cumulativeQty,
      runningVwap: parseFloat(runningVwap.toFixed(2)),
    });
  }

  const avgExecutedPrice = runningNotional / Math.max(cumulativeQty, 1);
  const marketVwap = arrivalPrice * (1 + gaussianRandom() * 0.001); // simulated market VWAP

  const statutoryChargesPerShare = totalStatutoryCharges / Math.max(totalQty, 1);

  const isBreakdown = calculateImplementationShortfall(
    arrivalPrice,
    avgExecutedPrice,
    side,
    totalQty,
    cumulativeQty,
    totalTempImpact,
    totalPermImpactAccum,
    statutoryChargesPerShare
  );

  const direction = side === 'BUY' ? 1 : -1;
  const vsMarketVwapBps = direction * ((avgExecutedPrice - marketVwap) / marketVwap) * 10000;

  const now = new Date();
  const endTime = new Date(now.getTime() + horizonMinutes * 60000);

  const acParams: AlmgrenChrissParams | undefined =
    algo === 'ALMGREN_CHRISS'
      ? {
          totalQty,
          horizonMinutes,
          riskAversion,
          sigma,
          permanentImpact,
          temporaryImpact,
          arrivalPrice,
        }
      : undefined;

  return {
    parentOrderId: `PO-${Date.now()}-${ticker}`,
    ticker,
    side,
    algo,
    slices,
    avgExecutedPrice: parseFloat(avgExecutedPrice.toFixed(2)),
    arrivalPrice,
    marketVwap: parseFloat(marketVwap.toFixed(2)),
    implementationShortfallBps: parseFloat(isBreakdown.totalBps.toFixed(2)),
    vsMarketVwapBps: parseFloat(vsMarketVwapBps.toFixed(2)),
    isBreakdown,
    totalStatutoryCharges: parseFloat(totalStatutoryCharges.toFixed(2)),
    executedNotional: parseFloat(runningNotional.toFixed(2)),
    almgrenChrissParams: acParams,
    startTime: now.toISOString(),
    endTime: endTime.toISOString(),
  };
}

/**
 * Run all three algorithms on the same order and return a comparison.
 */
export function compareExecutionAlgos(
  ticker: string,
  side: OrderSide,
  totalQty: number,
  horizonMinutes: number,
  arrivalPrice: number,
  riskAversion: number = 1e-6
): AlgoComparison {
  return {
    vwap: generateSyntheticExecution(ticker, side, 'VWAP', totalQty, horizonMinutes, arrivalPrice, riskAversion),
    twap: generateSyntheticExecution(ticker, side, 'TWAP', totalQty, horizonMinutes, arrivalPrice, riskAversion),
    almgrenChriss: generateSyntheticExecution(ticker, side, 'ALMGREN_CHRISS', totalQty, horizonMinutes, arrivalPrice, riskAversion),
  };
}
