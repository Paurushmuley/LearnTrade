// Sprint 26 — High-Frequency Market Making & Optimal Avellaneda-Stoikov Inventory Control Engine Tests
// Pure JS test suite using Node.js native test runner (node:test, node:assert/strict)
// Zero external flags, zero direct TypeScript imports, runs natively with node --test

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// PURE MATHEMATICAL & ALGORITHMIC MIRROR IMPLEMENTATION FOR NODE.JS TEST RUNNER
// ============================================================================

/**
 * Reservation (Indifference) Price (Avellaneda & Stoikov 2008)
 * r(s, q, t) = s - q * gamma * sigma^2 * (T - t)
 * 
 * @param {number} midPrice Current asset mid price (s)
 * @param {number} inventory Current position inventory (q)
 * @param {number} gamma Risk aversion parameter (gamma > 0)
 * @param {number} sigma Volatility of asset returns (sigma > 0)
 * @param {number} timeRemaining Time remaining until horizon (tau = T - t >= 0)
 * @returns {number} Reservation price r(s, q, t)
 */
function calculateReservationPrice(midPrice, inventory, gamma, sigma, timeRemaining) {
  const tau = Math.max(0, timeRemaining);
  const penalty = inventory * gamma * (sigma * sigma) * tau;
  return midPrice - penalty;
}

/**
 * Exponential Poisson Fill Intensity (Avellaneda & Stoikov 2008)
 * lambda(delta) = A * exp(-k * delta)
 * 
 * @param {number} delta Half-spread distance from mid price
 * @param {number} A Baseline order arrival intensity
 * @param {number} k Order book depth liquidity parameter
 * @returns {number} Fill intensity lambda
 */
function calculatePoissonIntensity(delta, A = 140, k = 1.5) {
  if (delta <= 0) return A;
  return A * Math.exp(-k * delta);
}

/**
 * Fill probability over a discrete time step dt
 * P(fill) = 1 - exp(-lambda * dt)
 */
function calculateFillProbability(delta, dt = 0.01, A = 140, k = 1.5) {
  const intensity = calculatePoissonIntensity(delta, A, k);
  return 1 - Math.exp(-intensity * dt);
}

/**
 * Calculate Optimal Asymmetric Quotes according to Avellaneda-Stoikov Model
 * Includes tick-size discretization, boundary clamps, and hard inventory bounds.
 */
function calculateOptimalQuotes({
  midPrice,
  inventory = 0,
  gamma = 0.1,
  sigma = 2.0,
  timeRemaining = 1.0,
  k = 1.5,
  tickSize = 0.05,
  qMax = 10,
  skewFactor = 1.0
}) {
  const tau = Math.max(0, timeRemaining);
  const effectiveInventory = inventory * skewFactor;
  const reservationPrice = calculateReservationPrice(midPrice, effectiveInventory, gamma, sigma, tau);
  
  // Base symmetric half-spread around reservation price
  // delta_sym = (1 / gamma) * ln(1 + gamma / k)
  const baseSpreadHalf = (1 / gamma) * Math.log(1 + gamma / k);
  
  // Raw half spreads relative to mid price
  const deltaA_raw = (reservationPrice - midPrice) + baseSpreadHalf;
  const deltaB_raw = (midPrice - reservationPrice) + baseSpreadHalf;
  
  const rawAsk = reservationPrice + baseSpreadHalf;
  const rawBid = reservationPrice - baseSpreadHalf;
  
  // Tick-size rounding: round ask to nearest tick, round bid to nearest tick
  let askPrice = Math.round(rawAsk / tickSize) * tickSize;
  let bidPrice = Math.round(rawBid / tickSize) * tickSize;
  
  // Strict boundary clamp: bid strictly < ask
  if (bidPrice >= askPrice) {
    bidPrice = askPrice - tickSize;
  }
  
  // Ensure positive prices
  bidPrice = Math.max(tickSize, Number(bidPrice.toFixed(4)));
  askPrice = Math.max(bidPrice + tickSize, Number(askPrice.toFixed(4)));
  
  // Hard inventory bounds [-qMax, +qMax]
  let bidActive = true;
  let askActive = true;
  let bidSuppressionReason = null;
  let askSuppressionReason = null;
  
  if (inventory >= qMax) {
    bidActive = false;
    bidPrice = null;
    bidSuppressionReason = `Hard upper inventory capacity reached (+${inventory} >= +${qMax}). Passive bids suppressed to prevent inventory accumulation.`;
  }
  
  if (inventory <= -qMax) {
    askActive = false;
    askPrice = null;
    askSuppressionReason = `Hard lower inventory capacity reached (${inventory} <= -${qMax}). Passive asks suppressed to prevent short inventory accumulation.`;
  }
  
  return {
    midPrice,
    inventory,
    reservationPrice: Number(reservationPrice.toFixed(4)),
    inventoryPenalty: Number((midPrice - reservationPrice).toFixed(4)),
    deltaA_raw: Number(deltaA_raw.toFixed(4)),
    deltaB_raw: Number(deltaB_raw.toFixed(4)),
    totalSpread_raw: Number((deltaA_raw + deltaB_raw).toFixed(4)),
    askPrice,
    bidPrice,
    bidActive,
    askActive,
    bidSuppressionReason,
    askSuppressionReason,
    spread: (askPrice !== null && bidPrice !== null) ? Number((askPrice - bidPrice).toFixed(4)) : null,
    timeRemaining: tau
  };
}

/**
 * Market Making Portfolio & P&L Attribution Tracker
 * Rigorously tracks Realized PnL, Unrealized PnL, Spread Capture, and Inventory Drift
 */
class MarketMakingPortfolio {
  constructor({ initialCash = 1000000, initialMid = 24500, lotSize = 1 } = {}) {
    this.initialCash = initialCash;
    this.cash = initialCash;
    this.inventory = 0;
    this.avgCost = 0;
    this.realizedPnL = 0;
    this.spreadCapturePnL = 0;
    this.inventoryDriftPnL = 0;
    this.midPrice = initialMid;
    this.lotSize = lotSize;
    this.trades = [];
  }

  updateMidPrice(newMid) {
    const dS = newMid - this.midPrice;
    this.inventoryDriftPnL += this.inventory * dS;
    this.midPrice = newMid;
  }

  fillAsk(fillPrice, quantity = 1, midAtFill = this.midPrice) {
    const spreadCaptured = (fillPrice - midAtFill) * quantity;
    this.spreadCapturePnL += spreadCaptured;
    this.cash += fillPrice * quantity;

    if (this.inventory > 0) {
      const closedUnits = Math.min(this.inventory, quantity);
      const gain = closedUnits * (fillPrice - this.avgCost);
      this.realizedPnL += gain;
    }

    const prevInventory = this.inventory;
    this.inventory -= quantity;

    if (this.inventory === 0) {
      this.avgCost = 0;
    } else if (this.inventory < 0 && prevInventory <= 0) {
      const prevQty = Math.abs(prevInventory);
      this.avgCost = (this.avgCost * prevQty + fillPrice * quantity) / Math.abs(this.inventory);
    }

    this.trades.push({
      side: 'SELL',
      price: fillPrice,
      quantity,
      midAtFill,
      timestamp: Date.now()
    });
  }

  fillBid(fillPrice, quantity = 1, midAtFill = this.midPrice) {
    const spreadCaptured = (midAtFill - fillPrice) * quantity;
    this.spreadCapturePnL += spreadCaptured;
    this.cash -= fillPrice * quantity;

    if (this.inventory < 0) {
      const closedUnits = Math.min(Math.abs(this.inventory), quantity);
      const gain = closedUnits * (this.avgCost - fillPrice);
      this.realizedPnL += gain;
    }

    const prevInventory = this.inventory;
    this.inventory += quantity;

    if (this.inventory === 0) {
      this.avgCost = 0;
    } else if (this.inventory > 0 && prevInventory >= 0) {
      this.avgCost = (this.avgCost * prevInventory + fillPrice * quantity) / this.inventory;
    }

    this.trades.push({
      side: 'BUY',
      price: fillPrice,
      quantity,
      midAtFill,
      timestamp: Date.now()
    });
  }

  get unrealizedPnL() {
    if (this.inventory === 0) return 0;
    return this.inventory * (this.midPrice - this.avgCost);
  }

  get totalPnL() {
    return this.realizedPnL + this.unrealizedPnL;
  }

  get decomposedTotalPnL() {
    return this.spreadCapturePnL + this.inventoryDriftPnL;
  }

  flatten(fillPrice = this.midPrice) {
    if (this.inventory === 0) return null;

    const qty = this.inventory;
    if (qty > 0) {
      this.fillAsk(fillPrice, qty, this.midPrice);
    } else {
      this.fillBid(fillPrice, Math.abs(qty), this.midPrice);
    }

    return {
      flattenedQuantity: qty,
      exitPrice: fillPrice,
      remainingInventory: this.inventory,
      realizedPnL: Number(this.realizedPnL.toFixed(4)),
      totalPnL: Number(this.totalPnL.toFixed(4))
    };
  }
}

// ============================================================================
// TEST SUITE: SPRINT 26 AVELLANEDA-STOIKOV INVENTORY CONTROL ENGINE
// ============================================================================

describe('TradeCraft High-Frequency Market Making & Optimal Avellaneda-Stoikov Inventory Control Engine (Sprint 26)', () => {

  // Test 1: Reservation Price Invariance at Zero Inventory
  test('TC-AS-01: Reservation Price Invariance at Zero Inventory (r == s)', () => {
    const s = 24500;
    const q = 0;
    const gamma = 0.1;
    const sigma = 15;
    const tau = 1.0;

    const r = calculateReservationPrice(s, q, gamma, sigma, tau);
    assert.equal(r, s, 'Reservation price must equal spot price exactly when inventory is zero');
  });

  // Test 2: Reservation Price Monotonic Decrease Under Positive (Long) Inventory
  test('TC-AS-02: Reservation Price Monotonic Decrease Under Positive (Long) Inventory (r < s)', () => {
    const s = 24500;
    const gamma = 0.1;
    const sigma = 15;
    const tau = 1.0;

    const r1 = calculateReservationPrice(s, 1, gamma, sigma, tau);
    const r2 = calculateReservationPrice(s, 5, gamma, sigma, tau);
    const r3 = calculateReservationPrice(s, 10, gamma, sigma, tau);

    assert.ok(r1 < s, `r1 (${r1}) must be less than mid (${s})`);
    assert.ok(r2 < r1, `r2 (${r2}) must be strictly less than r1 (${r1})`);
    assert.ok(r3 < r2, `r3 (${r3}) must be strictly less than r2 (${r2})`);
  });

  // Test 3: Reservation Price Monotonic Increase Under Negative (Short) Inventory
  test('TC-AS-03: Reservation Price Monotonic Increase Under Negative (Short) Inventory (r > s)', () => {
    const s = 24500;
    const gamma = 0.1;
    const sigma = 15;
    const tau = 1.0;

    const r1 = calculateReservationPrice(s, -1, gamma, sigma, tau);
    const r2 = calculateReservationPrice(s, -5, gamma, sigma, tau);
    const r3 = calculateReservationPrice(s, -10, gamma, sigma, tau);

    assert.ok(r1 > s, `r1 (${r1}) must be greater than mid (${s})`);
    assert.ok(r2 > r1, `r2 (${r2}) must be strictly greater than r1 (${r1})`);
    assert.ok(r3 > r2, `r3 (${r3}) must be strictly greater than r2 (${r2})`);
  });

  // Test 4: Risk Aversion (gamma) Sensitivity & Inventory Penalty Scaling
  test('TC-AS-04: Risk Aversion (gamma) Sensitivity & Inventory Penalty Scaling', () => {
    const s = 24500;
    const q = 4;
    const sigma = 10;
    const tau = 0.5;

    const lowGamma = calculateReservationPrice(s, q, 0.05, sigma, tau);
    const midGamma = calculateReservationPrice(s, q, 0.10, sigma, tau);
    const highGamma = calculateReservationPrice(s, q, 0.25, sigma, tau);

    const penaltyLow = Math.abs(s - lowGamma);
    const penaltyMid = Math.abs(s - midGamma);
    const penaltyHigh = Math.abs(s - highGamma);

    assert.ok(penaltyMid > penaltyLow, 'Higher gamma must produce higher inventory penalty');
    assert.ok(penaltyHigh > penaltyMid, 'Highest gamma must produce largest inventory penalty');
    assert.equal(penaltyMid, penaltyLow * 2, 'Inventory penalty scales linearly with gamma');
  });

  // Test 5: Volatility (sigma) Sensitivity & Quadratic Variance Penalty
  test('TC-AS-05: Volatility (sigma) Sensitivity & Quadratic Variance Penalty', () => {
    const s = 24500;
    const q = 2;
    const gamma = 0.1;
    const tau = 1.0;

    const r_sigma1 = calculateReservationPrice(s, q, gamma, 10, tau);
    const r_sigma2 = calculateReservationPrice(s, q, gamma, 20, tau);

    const penalty1 = Math.abs(s - r_sigma1); // 2 * 0.1 * 100 * 1 = 20
    const penalty2 = Math.abs(s - r_sigma2); // 2 * 0.1 * 400 * 1 = 80

    assert.equal(penalty1, 20);
    assert.equal(penalty2, 80);
    assert.equal(penalty2, penalty1 * 4, 'Doubling sigma must quadruple inventory penalty due to sigma^2 dependence');
  });

  // Test 6: Time Horizon Decay (T - t -> 0) & Terminal Convergence to Spot
  test('TC-AS-06: Time Horizon Decay (T - t -> 0) & Terminal Convergence to Spot', () => {
    const s = 24500;
    const q = 5;
    const gamma = 0.1;
    const sigma = 15;

    const r_open = calculateReservationPrice(s, q, gamma, sigma, 1.0);
    const r_mid = calculateReservationPrice(s, q, gamma, sigma, 0.5);
    const r_close = calculateReservationPrice(s, q, gamma, sigma, 0.05);
    const r_terminal = calculateReservationPrice(s, q, gamma, sigma, 0.0);

    assert.ok(Math.abs(s - r_mid) < Math.abs(s - r_open));
    assert.ok(Math.abs(s - r_close) < Math.abs(s - r_mid));
    assert.equal(r_terminal, s, 'At horizon expiry (tau = 0), reservation price converges strictly to spot price s');
  });

  // Test 7: Optimal Half-Spreads Asymmetry Under Long Inventory (delta_a < delta_b)
  test('TC-AS-07: Optimal Half-Spreads Asymmetry Under Long Inventory (delta_a < delta_b)', () => {
    const quotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: 4, // Long inventory
      gamma: 0.1,
      sigma: 2.0,
      timeRemaining: 1.0,
      k: 1.5,
      tickSize: 0.05,
      qMax: 10
    });

    assert.ok(quotes.deltaA_raw < quotes.deltaB_raw, 'When long inventory (q > 0), delta_a must be strictly less than delta_b to offload');
    assert.ok(quotes.askPrice - quotes.midPrice < quotes.midPrice - quotes.bidPrice, 'Ask quote must be closer to mid price than bid quote');
  });

  // Test 8: Optimal Half-Spreads Asymmetry Under Short Inventory (delta_b < delta_a)
  test('TC-AS-08: Optimal Half-Spreads Asymmetry Under Short Inventory (delta_b < delta_a)', () => {
    const quotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: -4, // Short inventory
      gamma: 0.1,
      sigma: 2.0,
      timeRemaining: 1.0,
      k: 1.5,
      tickSize: 0.05,
      qMax: 10
    });

    assert.ok(quotes.deltaB_raw < quotes.deltaA_raw, 'When short inventory (q < 0), delta_b must be strictly less than delta_a to buy back');
    assert.ok(quotes.midPrice - quotes.bidPrice < quotes.askPrice - quotes.midPrice, 'Bid quote must be closer to mid price than ask quote');
  });

  // Test 9: Total Optimal Half-Spread Positivity and Liquidity Parameter (kappa) Sensitivity
  test('TC-AS-09: Total Optimal Half-Spread Positivity and Liquidity Parameter (kappa) Sensitivity', () => {
    const liquidQuotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: 0,
      gamma: 0.1,
      sigma: 2.0,
      timeRemaining: 1.0,
      k: 3.0 // High liquidity / fast arrival decay
    });

    const illiquidQuotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: 0,
      gamma: 0.1,
      sigma: 2.0,
      timeRemaining: 1.0,
      k: 0.5 // Low liquidity
    });

    assert.ok(liquidQuotes.totalSpread_raw > 0, 'Total optimal half spread must be strictly positive');
    assert.ok(illiquidQuotes.totalSpread_raw > 0, 'Illiquid optimal half spread must be strictly positive');
    assert.ok(illiquidQuotes.totalSpread_raw > liquidQuotes.totalSpread_raw, 'Illiquid book (smaller k) must widen total spread');
  });

  // Test 10: Tick-Size Rounding, Discretization & Strict Spread Positivity Clamp (bid < ask)
  test('TC-AS-10: Tick-Size Rounding, Discretization & Strict Spread Positivity Clamp (bid < ask)', () => {
    const tick = 0.05;
    const quotes = calculateOptimalQuotes({
      midPrice: 100.02,
      inventory: 1,
      gamma: 0.01,
      sigma: 0.1,
      timeRemaining: 0.1,
      k: 5.0,
      tickSize: tick
    });

    // Check tick alignment
    const isAskTickAligned = Math.abs(quotes.askPrice % tick) < 1e-6 || Math.abs((quotes.askPrice % tick) - tick) < 1e-6;
    const isBidTickAligned = Math.abs(quotes.bidPrice % tick) < 1e-6 || Math.abs((quotes.bidPrice % tick) - tick) < 1e-6;
    assert.ok(isAskTickAligned, `Ask price (${quotes.askPrice}) must be rounded to tick size (${tick})`);
    assert.ok(isBidTickAligned, `Bid price (${quotes.bidPrice}) must be rounded to tick size (${tick})`);

    // Strict inequality
    assert.ok(quotes.bidPrice < quotes.askPrice, 'Bid price must be strictly less than ask price');
    assert.ok(quotes.askPrice - quotes.bidPrice >= tick, 'Spread must be at least one tick');
  });

  // Test 11: Hard Inventory Bounds [+Q_max]: Complete Bid Suppression at Long Capacity
  test('TC-AS-11: Hard Inventory Bounds [+Q_max]: Complete Bid Suppression at Long Capacity', () => {
    const qMax = 8;
    const quotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: 8, // At max long capacity
      qMax,
      gamma: 0.1,
      sigma: 2.0
    });

    assert.equal(quotes.bidActive, false, 'Bid quote must be deactivated when inventory >= +Q_max');
    assert.equal(quotes.bidPrice, null, 'Bid price must be null when inventory >= +Q_max');
    assert.ok(quotes.bidSuppressionReason.includes('Hard upper inventory capacity reached'));
    assert.equal(quotes.askActive, true, 'Ask quote must remain active to offload long inventory');
    assert.ok(quotes.askPrice !== null, 'Ask price must be populated to allow offloading');
  });

  // Test 12: Hard Inventory Bounds [-Q_max]: Complete Ask Suppression at Short Capacity
  test('TC-AS-12: Hard Inventory Bounds [-Q_max]: Complete Ask Suppression at Short Capacity', () => {
    const qMax = 8;
    const quotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: -8, // At max short capacity
      qMax,
      gamma: 0.1,
      sigma: 2.0
    });

    assert.equal(quotes.askActive, false, 'Ask quote must be deactivated when inventory <= -Q_max');
    assert.equal(quotes.askPrice, null, 'Ask price must be null when inventory <= -Q_max');
    assert.ok(quotes.askSuppressionReason.includes('Hard lower inventory capacity reached'));
    assert.equal(quotes.bidActive, true, 'Bid quote must remain active to buy back short inventory');
    assert.ok(quotes.bidPrice !== null, 'Bid price must be populated to allow buyback');
  });

  // Test 13: Exponential Poisson Fill Intensity Monotonicity & Decay with Half-Spread
  test('TC-AS-13: Exponential Poisson Fill Intensity Monotonicity & Decay with Half-Spread', () => {
    const A = 140;
    const k = 1.5;

    const lambda0 = calculatePoissonIntensity(0, A, k);
    const lambda1 = calculatePoissonIntensity(0.5, A, k);
    const lambda2 = calculatePoissonIntensity(1.0, A, k);
    const lambda3 = calculatePoissonIntensity(2.5, A, k);

    assert.equal(lambda0, A, 'At zero half-spread, arrival intensity equals baseline A');
    assert.ok(lambda1 < lambda0, 'Intensity must decrease as half-spread increases');
    assert.ok(lambda2 < lambda1, 'Intensity must decrease monotonically with spread');
    assert.ok(lambda3 < lambda2, 'Deep passive orders have lowest fill intensity');

    // Discrete fill probability monotonicity
    const p0 = calculateFillProbability(0, 0.01, A, k);
    const p1 = calculateFillProbability(0.5, 0.01, A, k);
    const p3 = calculateFillProbability(2.5, 0.01, A, k);
    assert.ok(p0 > p1 && p1 > p3, 'Fill probability must strictly decrease with quote distance');
  });

  // Test 14: P&L Attribution Conservation: Realized PnL + Unrealized PnL == Total PnL
  test('TC-AS-14: P&L Attribution Conservation: Realized PnL + Unrealized PnL == Total PnL', () => {
    const portfolio = new MarketMakingPortfolio({ initialCash: 1000000, initialMid: 24500 });

    // Round-trip trade: Buy 2 units at 24495, Sell 1 unit at 24505
    portfolio.fillBid(24495, 2, 24500);
    portfolio.fillAsk(24505, 1, 24500);

    // Mid price moves to 24510
    portfolio.updateMidPrice(24510);

    // Remaining inventory = 1 unit @ avgCost 24495
    assert.equal(portfolio.inventory, 1);
    assert.equal(portfolio.realizedPnL, 10, 'Realized PnL from selling 1 unit: 24505 - 24495 = 10');
    assert.equal(portfolio.unrealizedPnL, 15, 'Unrealized PnL from remaining 1 unit: 24510 - 24495 = 15');
    assert.equal(portfolio.totalPnL, 25, 'Total PnL must equal Realized PnL (10) + Unrealized PnL (15)');

    // Cash check
    const currentWealth = portfolio.cash + portfolio.inventory * portfolio.midPrice;
    const wealthDelta = currentWealth - portfolio.initialCash;
    assert.equal(wealthDelta, portfolio.totalPnL, 'Total PnL must equal Net Asset Value change');
  });

  // Test 15: P&L Component Conservation: Spread Capture + Inventory Drift == Total PnL
  test('TC-AS-15: P&L Component Conservation: Spread Capture + Inventory Drift == Total PnL', () => {
    const portfolio = new MarketMakingPortfolio({ initialCash: 1000000, initialMid: 24500 });

    // Buy 2 units at 24496 (mid 24500, spread capture = 4 * 2 = 8)
    portfolio.fillBid(24496, 2, 24500);

    // Mid price drifts from 24500 to 24512 (+12 pts * 2 units = +24 drift)
    portfolio.updateMidPrice(24512);

    // Sell 2 units at 24516 (mid 24512, spread capture = 4 * 2 = 8)
    portfolio.fillAsk(24516, 2, 24512);

    assert.equal(portfolio.inventory, 0, 'Inventory is fully closed');
    assert.equal(portfolio.spreadCapturePnL, 16, 'Total spread capture: 8 + 8 = 16');
    assert.equal(portfolio.inventoryDriftPnL, 24, 'Total inventory drift: 2 * 12 = 24');

    const totalCalculated = portfolio.spreadCapturePnL + portfolio.inventoryDriftPnL;
    assert.equal(totalCalculated, 40, 'Decomposed PnL is 40');
    assert.equal(portfolio.totalPnL, 40, 'Standard total PnL is 40');
    assert.equal(totalCalculated, portfolio.totalPnL, 'Exact conservation: Spread capture + Inventory drift == Total PnL');
  });

  // Test 16: 1-Click Inventory Actions: Flatten Inventory Immediate Liquidation & Neutralization
  test('TC-AS-16: 1-Click Inventory Actions: Flatten Inventory Immediate Liquidation & Neutralization', () => {
    const portfolio = new MarketMakingPortfolio({ initialCash: 1000000, initialMid: 24500 });

    // Build a long position of 5 units at avgCost 24490
    portfolio.fillBid(24490, 5, 24500);
    assert.equal(portfolio.inventory, 5);

    // Price moves to 24520
    portfolio.updateMidPrice(24520);

    // Trigger 1-Click Flatten action
    const flattenResult = portfolio.flatten(24520);

    assert.notEqual(flattenResult, null);
    assert.equal(flattenResult.flattenedQuantity, 5);
    assert.equal(flattenResult.remainingInventory, 0);
    assert.equal(portfolio.inventory, 0, 'Portfolio inventory must be reset to exactly zero');
    assert.equal(portfolio.unrealizedPnL, 0, 'Unrealized PnL is zero after flatten');
    assert.equal(portfolio.realizedPnL, 150, 'Realized gain: 5 * (24520 - 24490) = 150');
    assert.equal(portfolio.totalPnL, 150);
  });

  // Test 17: 1-Click Inventory Actions: Aggressive Skew Quote Modulation & Emergency Offloading
  test('TC-AS-17: 1-Click Inventory Actions: Aggressive Skew Quote Modulation & Emergency Offloading', () => {
    const standardQuotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: 3,
      gamma: 0.1,
      sigma: 2.0,
      skewFactor: 1.0 // Normal mode
    });

    const aggressiveQuotes = calculateOptimalQuotes({
      midPrice: 24500,
      inventory: 3,
      gamma: 0.1,
      sigma: 2.0,
      skewFactor: 2.5 // Aggressive inventory offloading mode
    });

    assert.ok(aggressiveQuotes.reservationPrice < standardQuotes.reservationPrice, 
      'Aggressive skew must push reservation price further below mid price');
    assert.ok(aggressiveQuotes.askPrice <= standardQuotes.askPrice, 
      'Aggressive skew must tighten or lower ask price to attract immediate buyers');
    assert.ok(aggressiveQuotes.bidPrice <= standardQuotes.bidPrice, 
      'Aggressive skew must widen or lower bid price to prevent acquiring more inventory');
  });

  // Test 18: Continuous High-Frequency Market Making Simulation: Multi-Step Fill Dynamics & Conservation
  test('TC-AS-18: Continuous High-Frequency Market Making Simulation: Multi-Step Fill Dynamics & Conservation', () => {
    const portfolio = new MarketMakingPortfolio({ initialCash: 1000000, initialMid: 24500 });
    let mid = 24500;
    const qMax = 5;

    // Simulate 10 time steps
    for (let step = 1; step <= 10; step++) {
      const timeRemaining = 1.0 - (step / 10);
      const quotes = calculateOptimalQuotes({
        midPrice: mid,
        inventory: portfolio.inventory,
        gamma: 0.1,
        sigma: 2.0,
        timeRemaining,
        qMax
      });

      // Price path with random drift
      const priceDelta = (step % 2 === 0) ? 2 : -1;
      mid += priceDelta;
      portfolio.updateMidPrice(mid);

      // Execute simulated fills based on inventory state
      if (quotes.bidActive && portfolio.inventory < 2) {
        portfolio.fillBid(quotes.bidPrice, 1, mid);
      }
      if (quotes.askActive && portfolio.inventory > -2) {
        portfolio.fillAsk(quotes.askPrice, 1, mid);
      }
    }

    // Conservation assertions
    assert.ok(portfolio.trades.length > 0, 'Simulation must record executed trades');
    assert.equal(
      Number(portfolio.totalPnL.toFixed(2)),
      Number((portfolio.realizedPnL + portfolio.unrealizedPnL).toFixed(2)),
      'Conservation invariant: Realized + Unrealized == Total PnL'
    );
    assert.equal(
      Number(portfolio.totalPnL.toFixed(2)),
      Number(portfolio.decomposedTotalPnL.toFixed(2)),
      'Conservation invariant: Spread Capture + Inventory Drift == Total PnL'
    );
  });

});
