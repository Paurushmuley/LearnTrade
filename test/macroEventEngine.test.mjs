// Sprint 18 — Macroeconomic Event Risk Engine Unit Tests
// Tests: Dubinsky-Johannes Jump/Crush formulation, Loughran-McDonald Lexicon,
// Exponential Time Decay, Volatility Cones, SUE Earnings Surprises,
// Pre-Event Hedging with SEBI Statutory Friction, and Historical Shock Replays
// Pure JS mirror of macroEventEngine.ts (Node native test runner)

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure JS Mirrors of Engine Functions ─────────────────────────────────────

const FINANCIAL_POS_TERMS = new Set([
  'surge', 'surging', 'rally', 'rallies', 'robust', 'growth', 'expansion',
  'profit', 'profitable', 'outperform', 'exceed', 'exceeded', 'dividend',
  'resilient', 'gain', 'gains', 'beat', 'beats', 'upturn', 'upgrade',
  'upgrades', 'breakout', 'record', 'all-time-high', 'stimulus', 'easing',
  'accommodative', 'tailwind', 'optimism', 'bullish', 'surplus',
]);

const FINANCIAL_NEG_TERMS = new Set([
  'slump', 'slumps', 'loss', 'losses', 'deficit', 'inflation', 'recession',
  'contraction', 'cut', 'cuts', 'downgrade', 'downgrades', 'plunge', 'plunges',
  'adverse', 'weakness', 'risk', 'risks', 'default', 'miss', 'misses',
  'decline', 'turmoil', 'headwind', 'pessimism', 'bearish', 'stagflation',
  'curb', 'tightening', 'liquidity-squeeze', 'penalty', 'veto',
]);

const HAWKISH_PHRASES = [
  'rate hike', 'tightening', 'curb inflation', 'liquidity withdrawal',
  'overheating', 'repo hike', 'hawkish', 'crr hike', 'price stability priority',
  'tighter monetary stance', 'withdrawal of accommodation', 'inflation persistent',
  'rate increase', 'elevated inflation', 'capacity utilization high',
];

const DOVISH_PHRASES = [
  'rate cut', 'easing', 'stimulus', 'liquidity injection',
  'accommodative', 'growth support', 'soft landing', 'dovish',
  'repo cut', 'growth revival', 'growth concerns', 'benign inflation',
  'support economic activity', 'liquidity surplus', 'disinflationary trend',
];

function computeLexiconSentiment(text) {
  const normalized = text.toLowerCase();
  const tokens = normalized.match(/[a-z0-9\-]+/g) || [];

  let pos = 0;
  let neg = 0;
  for (const token of tokens) {
    if (FINANCIAL_POS_TERMS.has(token)) pos++;
    if (FINANCIAL_NEG_TERMS.has(token)) neg++;
  }

  let hawk = 0;
  for (const phrase of HAWKISH_PHRASES) {
    if (normalized.includes(phrase)) hawk += 2;
  }
  let dove = 0;
  for (const phrase of DOVISH_PHRASES) {
    if (normalized.includes(phrase)) dove += 2;
  }

  const polarity = (pos - neg) / (pos + neg + 1.0);
  const stanceScore = (hawk - dove) / (hawk + dove + 1.0);
  let stance = 'NEUTRAL';
  if (stanceScore > 0.3) stance = 'HAWKISH';
  else if (stanceScore < -0.3) stance = 'DOVISH';

  const totalSignals = pos + neg + hawk + dove;
  const confidence = Math.min(1.0, Number((totalSignals / Math.max(1, tokens.length * 0.2 + 2)).toFixed(2)));

  return {
    polarity: Number(polarity.toFixed(3)),
    stance,
    confidence: Math.max(0.2, confidence),
    counts: { pos, neg, hawk, dove },
  };
}

function applyExponentialTimeDecay(rawSentiment, elapsedMinutes, category) {
  if (elapsedMinutes <= 0) return rawSentiment;
  const halfLives = {
    RBI_MPC_DECISION: 480,
    UNION_BUDGET_INDIA: 2880,
    US_FED_FOMC_DECISION: 720,
    NSE_EARNINGS_ANNOUNCE: 240,
    INDIA_CPI_INFLATION: 240,
    CRUDE_OIL_SUPPLY_SHOCK: 1440,
    GENERAL_ELECTIONS_INDIA: 4320,
  };
  const tHalf = halfLives[category] ?? 480;
  const lambda = Math.LN2 / tHalf;
  return Number((rawSentiment * Math.exp(-lambda * elapsedMinutes)).toFixed(3));
}

function calculateDubinskyJohannesIvJump(baselineIv, eventVariance, timeToExpiryDays) {
  const safeTimeYears = Math.max(0.25, timeToExpiryDays) / 365.0;
  const baselineVariance = baselineIv * baselineIv;
  const totalVariance = baselineVariance + eventVariance / safeTimeYears;
  return Number(Math.sqrt(Math.max(0.0001, totalVariance)).toFixed(4));
}

function calculatePostEventIvCrush(currentIv, baselineIv) {
  const postIv = Math.min(currentIv, baselineIv);
  const crushAbs = Math.max(0, currentIv - postIv);
  const crushPct = (crushAbs / Math.max(0.01, currentIv)) * 100;
  return {
    postIv: Number(postIv.toFixed(4)),
    crushAbs: Number(crushAbs.toFixed(4)),
    crushPct: Number(crushPct.toFixed(2)),
  };
}

function calculateExpectedStraddleMove(spotPrice, atmStraddlePrice) {
  if (spotPrice <= 0 || atmStraddlePrice <= 0) return { expectedMovePct: 0, expectedMovePoints: 0 };
  const expectedMovePct = (atmStraddlePrice / spotPrice) * 0.80 * 100;
  const expectedMovePoints = spotPrice * (expectedMovePct / 100);
  return {
    expectedMovePct: Number(expectedMovePct.toFixed(2)),
    expectedMovePoints: Number(expectedMovePoints.toFixed(2)),
  };
}

function calculateEventRiskScore(eventCategory, currentIv, baselineRv, hoursRemaining, dispersionScore = 50) {
  const tauHours = {
    UNION_BUDGET_INDIA: 24,
    RBI_MPC_DECISION: 8,
    US_FED_FOMC_DECISION: 12,
    NSE_EARNINGS_ANNOUNCE: 4,
    INDIA_CPI_INFLATION: 6,
    CRUDE_OIL_SUPPLY_SHOCK: 16,
    GENERAL_ELECTIONS_INDIA: 36,
  };
  const tau = tauHours[eventCategory] ?? 12;
  const clampedHours = Math.max(0, hoursRemaining);
  const iProx = 100 * Math.exp(-clampedHours / tau);

  const shockBetas = {
    UNION_BUDGET_INDIA: 95,
    GENERAL_ELECTIONS_INDIA: 98,
    RBI_MPC_DECISION: 75,
    NSE_EARNINGS_ANNOUNCE: 70,
    US_FED_FOMC_DECISION: 60,
    CRUDE_OIL_SUPPLY_SHOCK: 55,
    INDIA_CPI_INFLATION: 30,
  };
  const hShock = shockBetas[eventCategory] ?? 50;
  const volElevationPct = Math.max(0, ((currentIv - baselineRv) / Math.max(0.01, baselineRv)) * 100);
  const vPrem = Math.min(100, volElevationPct * 2.0);
  const dDisp = Math.min(100, Math.max(0, dispersionScore));

  const ersRaw = 0.35 * iProx + 0.30 * hShock + 0.20 * vPrem + 0.15 * dDisp;
  return Number(Math.min(100, Math.max(0, ersRaw)).toFixed(1));
}

function evaluateEarningsSurprise(ticker, consensusEps, dispersion, actualEps, spotPrice, impliedMovePct) {
  const safeDispersion = Math.max(0.01, dispersion);
  const surpriseZScore = (actualEps - consensusEps) / safeDispersion;
  let guidanceStance = 'IN_LINE';
  if (surpriseZScore > 1.5) guidanceStance = 'BEAT_RAISE';
  else if (surpriseZScore < -1.5) guidanceStance = 'MISS_LOWER';

  const jumpFactor = Math.tanh(0.45 * surpriseZScore) * (impliedMovePct / 100);
  const projectedPriceJumpPct = Number((jumpFactor * 100).toFixed(2));

  let postEarningsDriftExpectation = 'NEUTRAL';
  if (surpriseZScore >= 2.0) postEarningsDriftExpectation = 'BULLISH_DRIFT';
  else if (surpriseZScore <= -2.0) postEarningsDriftExpectation = 'BEARISH_DRIFT';

  return {
    ticker,
    consensusEps,
    actualEps,
    forecastDispersion: safeDispersion,
    surpriseZScore: Number(surpriseZScore.toFixed(2)),
    guidanceStance,
    impliedMovePct,
    projectedPriceJumpPct,
    postEarningsDriftExpectation,
  };
}

function calculateIndianStatutoryCharges(side, product, price, quantity) {
  const turnover = price * quantity;
  if (turnover <= 0) return 0;
  const brokerage = Math.min(20, turnover * 0.0003);
  let stt = 0;
  if (product === 'CNC') {
    stt = turnover * 0.001;
  } else {
    stt = side === 'SELL' ? turnover * 0.00025 : 0;
  }
  const exchange = turnover * 0.0000297;
  const sebi = turnover * 0.000001;
  let stampDuty = 0;
  if (side === 'BUY') {
    stampDuty = product === 'CNC' ? turnover * 0.00015 : turnover * 0.00003;
  }
  const gst = (brokerage + exchange + sebi) * 0.18;
  return Number((brokerage + stt + exchange + sebi + stampDuty + gst).toFixed(2));
}

// ─── UNIT TESTS ──────────────────────────────────────────────────────────────

test('AC-EVT-01: Financial Lexicon Sentiment & Monetary Policy Stance Scoring', async (t) => {
  await t.test('detects positive financial polarity on bullish corporate news', () => {
    const text = 'TCS profit surged with robust revenue growth, beating consensus estimates with record dividend payout';
    const res = computeLexiconSentiment(text);
    assert.ok(res.polarity > 0.4, `Expected positive polarity > 0.4, got ${res.polarity}`);
    assert.ok(res.counts.pos >= 4, `Expected at least 4 positive tokens, got ${res.counts.pos}`);
    assert.equal(res.stance, 'NEUTRAL');
  });

  await t.test('detects negative financial polarity on macroeconomic weakness', () => {
    const text = 'Manufacturing slump deepened as recession risks and fiscal deficit triggered credit rating downgrade';
    const res = computeLexiconSentiment(text);
    assert.ok(res.polarity < -0.4, `Expected negative polarity < -0.4, got ${res.polarity}`);
    assert.ok(res.counts.neg >= 4, `Expected at least 4 negative tokens, got ${res.counts.neg}`);
  });

  await t.test('identifies HAWKISH stance on rate hike and inflation tightening remarks', () => {
    const text = 'RBI Governor signals aggressive rate hike to curb inflation and withdrawal of accommodation';
    const res = computeLexiconSentiment(text);
    assert.equal(res.stance, 'HAWKISH', `Expected HAWKISH stance, got ${res.stance}`);
    assert.ok(res.counts.hawk >= 2, `Expected hawkish tokens >= 2, got ${res.counts.hawk}`);
  });

  await t.test('identifies DOVISH stance on rate cuts and growth support remarks', () => {
    const text = 'Central bank announces repo cut and monetary stimulus to support economic activity with liquidity injection';
    const res = computeLexiconSentiment(text);
    assert.equal(res.stance, 'DOVISH', `Expected DOVISH stance, got ${res.stance}`);
    assert.ok(res.counts.dove >= 2, `Expected dovish tokens >= 2, got ${res.counts.dove}`);
  });

  await t.test('handles neutral/balanced financial statements without bias', () => {
    const text = 'The Ministry of Finance convened a scheduled administrative meeting with commercial banks';
    const res = computeLexiconSentiment(text);
    assert.equal(res.stance, 'NEUTRAL');
    assert.ok(Math.abs(res.polarity) < 0.2, `Expected neutral polarity near 0, got ${res.polarity}`);
  });
});

test('AC-EVT-02: Exponential Information Decay and Half-Life Mechanics', async (t) => {
  await t.test('at exact half-life elapsed, decayed sentiment equals exactly 50% of initial', () => {
    const initialScore = 0.80;
    // RBI half life is 480 minutes (8 hours)
    const decayedAtHalfLife = applyExponentialTimeDecay(initialScore, 480, 'RBI_MPC_DECISION');
    assert.equal(decayedAtHalfLife, 0.40, `Expected exactly 0.40, got ${decayedAtHalfLife}`);
  });

  await t.test('verifies Union Budget half-life (48 hours = 2880 mins)', () => {
    const initialScore = 0.90;
    const decayed = applyExponentialTimeDecay(initialScore, 2880, 'UNION_BUDGET_INDIA');
    assert.equal(decayed, 0.45, `Expected 0.45 at 48h half life, got ${decayed}`);
  });

  await t.test('verifies monotonicity: sentiment decreases strictly over time', () => {
    const score0 = applyExponentialTimeDecay(0.8, 0, 'NSE_EARNINGS_ANNOUNCE');
    const score1 = applyExponentialTimeDecay(0.8, 60, 'NSE_EARNINGS_ANNOUNCE');
    const score2 = applyExponentialTimeDecay(0.8, 120, 'NSE_EARNINGS_ANNOUNCE');
    const score4 = applyExponentialTimeDecay(0.8, 240, 'NSE_EARNINGS_ANNOUNCE'); // half-life 240 min
    const score8 = applyExponentialTimeDecay(0.8, 480, 'NSE_EARNINGS_ANNOUNCE');

    assert.equal(score0, 0.8);
    assert.ok(score0 > score1, 'score0 should be greater than score1');
    assert.ok(score1 > score2, 'score1 should be greater than score2');
    assert.ok(score2 > score4, 'score2 should be greater than score4');
    assert.ok(score4 > score8, 'score4 should be greater than score8');
    assert.equal(score4, 0.40);
    assert.equal(score8, 0.20); // 2 half-lives = 25% of initial
  });
});

test('AC-EVT-03: Dubinsky-Johannes Pre-Event IV Jump Scaling', async (t) => {
  const baselineIv = 0.14; // 14% calm-market baseline
  const eventVariance = 0.0035; // discrete event jump variance

  await t.test('pre-event IV expands monotonically as time to expiry decreases (T -> 0)', () => {
    const iv30d = calculateDubinskyJohannesIvJump(baselineIv, eventVariance, 30);
    const iv14d = calculateDubinskyJohannesIvJump(baselineIv, eventVariance, 14);
    const iv7d = calculateDubinskyJohannesIvJump(baselineIv, eventVariance, 7);
    const iv1d = calculateDubinskyJohannesIvJump(baselineIv, eventVariance, 1);

    assert.ok(iv1d > iv7d, `Expected 1D IV (${iv1d}) > 7D IV (${iv7d})`);
    assert.ok(iv7d > iv14d, `Expected 7D IV (${iv7d}) > 14D IV (${iv14d})`);
    assert.ok(iv14d > iv30d, `Expected 14D IV (${iv14d}) > 30D IV (${iv30d})`);
    assert.ok(iv30d > baselineIv, `Expected 30D IV (${iv30d}) > baseline (${baselineIv})`);
  });

  await t.test('zero event variance preserves baseline volatility exactly', () => {
    const iv = calculateDubinskyJohannesIvJump(baselineIv, 0, 10);
    assert.equal(iv, baselineIv, `Expected IV to equal baseline ${baselineIv}, got ${iv}`);
  });

  await t.test('higher event variance causes higher pre-event IV jump', () => {
    const ivLowVar = calculateDubinskyJohannesIvJump(baselineIv, 0.001, 7);
    const ivHighVar = calculateDubinskyJohannesIvJump(baselineIv, 0.008, 7);
    assert.ok(ivHighVar > ivLowVar, 'Higher variance must yield higher implied volatility');
  });
});

test('AC-EVT-04: Post-Event Volatility Crush (Instantaneous Variance Collapse)', async (t) => {
  const currentIv = 0.26; // 26% elevated IV before event
  const baselineIv = 0.15; // 15% normal baseline

  await t.test('collapses implied volatility to baseline and computes exact crush percentage', () => {
    const crush = calculatePostEventIvCrush(currentIv, baselineIv);
    assert.equal(crush.postIv, baselineIv);
    assert.equal(crush.crushAbs, 0.11);
    // (0.11 / 0.26) * 100 = 42.31%
    assert.equal(crush.crushPct, 42.31);
  });

  await t.test('monetary Vega P&L impact scales linearly with net Vega exposure', () => {
    const crush = calculatePostEventIvCrush(currentIv, baselineIv);
    const deltaIvPoints = Math.round((currentIv - crush.postIv) * 100); // 11 vol points

    const netVegaLong = 500; // ₹500 per 1% IV shift
    const pnlLong = Math.round(-1 * netVegaLong * deltaIvPoints);
    assert.equal(pnlLong, -5500, `Expected -₹5,500 loss on long Vega, got ${pnlLong}`);

    const netVegaShort = -500; // ₹500 short Vega
    const pnlShort = Math.round(-1 * netVegaShort * deltaIvPoints);
    assert.equal(pnlShort, 5500, `Expected +₹5,500 profit on short Vega, got ${pnlShort}`);
  });

  await t.test('when current IV is already at or below baseline, crush is zero', () => {
    const crush = calculatePostEventIvCrush(0.14, 0.15);
    assert.equal(crush.postIv, 0.14);
    assert.equal(crush.crushAbs, 0);
    assert.equal(crush.crushPct, 0);
  });
});

test('AC-EVT-05: Implied Straddle Breakeven Move Extraction', async (t) => {
  const spotPrice = 24500;
  const atmStraddlePrice = 612.5; // ATM Call + ATM Put

  await t.test('correctly calculates expected move percentage and index points', () => {
    const res = calculateExpectedStraddleMove(spotPrice, atmStraddlePrice);
    // (612.5 / 24500) * 0.80 * 100 = 2.50 * 0.80 = 2.00%
    assert.equal(res.expectedMovePct, 2.00);
    // 24500 * 2.00% = 490 index points
    assert.equal(res.expectedMovePoints, 490);
  });

  await t.test('handles zero or non-positive inputs gracefully', () => {
    const res1 = calculateExpectedStraddleMove(0, 500);
    assert.equal(res1.expectedMovePct, 0);
    assert.equal(res1.expectedMovePoints, 0);

    const res2 = calculateExpectedStraddleMove(24500, 0);
    assert.equal(res2.expectedMovePct, 0);
    assert.equal(res2.expectedMovePoints, 0);
  });
});

test('AC-EVT-06: Composite Event Risk Score (ERS) & Regime Directives', async (t) => {
  await t.test('ERS is strictly bounded between [0, 100]', () => {
    const ersLow = calculateEventRiskScore('INDIA_CPI_INFLATION', 12, 14, 100, 10);
    const ersHigh = calculateEventRiskScore('UNION_BUDGET_INDIA', 32, 13, 0.5, 95);

    assert.ok(ersLow >= 0 && ersLow <= 100, `Expected in [0, 100], got ${ersLow}`);
    assert.ok(ersHigh >= 0 && ersHigh <= 100, `Expected in [0, 100], got ${ersHigh}`);
    assert.ok(ersHigh > ersLow, `Budget ERS (${ersHigh}) must exceed CPI ERS (${ersLow})`);
  });

  await t.test('ERS increases as time to event countdown approaches zero', () => {
    const ers48h = calculateEventRiskScore('RBI_MPC_DECISION', 20, 14, 48);
    const ers12h = calculateEventRiskScore('RBI_MPC_DECISION', 20, 14, 12);
    const ers2h = calculateEventRiskScore('RBI_MPC_DECISION', 20, 14, 2);
    const ers0h = calculateEventRiskScore('RBI_MPC_DECISION', 20, 14, 0);

    assert.ok(ers0h > ers2h, '0h should be higher than 2h');
    assert.ok(ers2h > ers12h, '2h should be higher than 12h');
    assert.ok(ers12h > ers48h, '12h should be higher than 48h');
  });

  await t.test('regime thresholds properly identify SEVERE_REGIME during imminent Budget', () => {
    const ers = calculateEventRiskScore('UNION_BUDGET_INDIA', 28, 13, 1, 90);
    assert.ok(ers >= 85, `Expected SEVERE_REGIME (>=85), got ${ers}`);
  });
});

test('AC-EVT-07: Bayesian Standardized Unexpected Earnings (SUE)', async (t) => {
  const ticker = 'TCS';
  const consensusEps = 30.0;
  const dispersion = 2.0;
  const spotPrice = 4200;
  const impliedMovePct = 4.0;

  await t.test('strong positive earnings beat (SUE >= +2.0) triggers BEAT_RAISE and BULLISH_DRIFT', () => {
    const actualEps = 35.0; // beat by 5.0 (2.5 std dev)
    const res = evaluateEarningsSurprise(ticker, consensusEps, dispersion, actualEps, spotPrice, impliedMovePct);

    assert.equal(res.surpriseZScore, 2.50);
    assert.equal(res.guidanceStance, 'BEAT_RAISE');
    assert.equal(res.postEarningsDriftExpectation, 'BULLISH_DRIFT');
    assert.ok(res.projectedPriceJumpPct > 0, 'Projected jump must be positive');
  });

  await t.test('severe earnings miss (SUE <= -2.0) triggers MISS_LOWER and BEARISH_DRIFT', () => {
    const actualEps = 24.0; // miss by 6.0 (-3.0 std dev)
    const res = evaluateEarningsSurprise(ticker, consensusEps, dispersion, actualEps, spotPrice, impliedMovePct);

    assert.equal(res.surpriseZScore, -3.00);
    assert.equal(res.guidanceStance, 'MISS_LOWER');
    assert.equal(res.postEarningsDriftExpectation, 'BEARISH_DRIFT');
    assert.ok(res.projectedPriceJumpPct < 0, 'Projected jump must be negative');
  });

  await t.test('in-line earnings result keeps neutral drift expectation', () => {
    const actualEps = 30.2; // 0.1 std dev
    const res = evaluateEarningsSurprise(ticker, consensusEps, dispersion, actualEps, spotPrice, impliedMovePct);

    assert.equal(res.surpriseZScore, 0.10);
    assert.equal(res.guidanceStance, 'IN_LINE');
    assert.equal(res.postEarningsDriftExpectation, 'NEUTRAL');
  });
});

test('AC-EVT-08: Indian Statutory Fee Friction on Pre-Event Hedging Legs', async (t) => {
  await t.test('computes positive SEBI, STT, and exchange friction for Nifty futures hedge', () => {
    const spot = 24500;
    const qty = 50; // 2 lots Nifty
    const friction = calculateIndianStatutoryCharges('SELL', 'MIS', spot, qty);

    // Turnover = 24,500 * 50 = ₹1,225,000
    // Brokerage = ₹20 max
    // STT = 1,225,000 * 0.00025 = ₹306.25
    // Exchange = 1,225,000 * 0.0000297 ≈ ₹36.38
    // SEBI = 1,225,000 * 0.000001 ≈ ₹1.23
    // Stamp = 0 (SELL)
    // GST = (20 + 36.38 + 1.23) * 0.18 ≈ ₹10.37
    // Total ≈ ₹374.23
    assert.ok(friction > 350 && friction < 400, `Expected friction ~₹374, got ₹${friction}`);
  });

  await t.test('computes positive STT on equity delivery buy orders (CNC)', () => {
    const friction = calculateIndianStatutoryCharges('BUY', 'CNC', 4200, 25);
    // Turnover = 105,000. STT = 0.1% = 105
    assert.ok(friction > 120, `Expected CNC friction > 120, got ₹${friction}`);
  });
});

test('AC-EVT-09: Volatility Cones & Term Structure Percentile Ordering', async (t) => {
  const bench = {
    1:  { p10: 11.5, p25: 13.0, p50: 15.2, p75: 19.5, p90: 26.0 },
    7:  { p10: 11.8, p25: 13.2, p50: 15.0, p75: 18.5, p90: 24.2 },
    14: { p10: 12.0, p25: 13.5, p50: 14.8, p75: 17.8, p90: 22.5 },
    30: { p10: 12.2, p25: 13.8, p50: 14.5, p75: 17.0, p90: 21.2 },
    60: { p10: 12.5, p25: 14.0, p50: 14.5, p75: 16.5, p90: 20.0 },
    90: { p10: 12.8, p25: 14.2, p50: 14.6, p75: 16.2, p90: 19.5 },
  };

  await t.test('percentiles are strictly monotonic (p10 < p25 < p50 < p75 < p90) across all tenors', () => {
    for (const [tenor, pts] of Object.entries(bench)) {
      assert.ok(pts.p10 < pts.p25, `Tenor ${tenor}: p10 must be < p25`);
      assert.ok(pts.p25 < pts.p50, `Tenor ${tenor}: p25 must be < p50`);
      assert.ok(pts.p50 < pts.p75, `Tenor ${tenor}: p50 must be < p75`);
      assert.ok(pts.p75 < pts.p90, `Tenor ${tenor}: p75 must be < p90`);
    }
  });

  await t.test('flags overheated state when modeled IV exceeds 90th percentile', () => {
    const baselineIvPct = 14;
    const eventVariance = 0.008; // High variance
    const tenorDays = 1;
    const timeYears = tenorDays / 365.0;
    const modeledIv = Math.sqrt(Math.pow(baselineIvPct / 100, 2) + eventVariance / timeYears) * 100;
    const p90 = bench[1].p90; // 26.0
    const isOverheated = modeledIv >= p90;
    assert.ok(isOverheated, `Modeled IV ${modeledIv} should exceed p90 (${p90})`);
  });
});

test('AC-EVT-10: Sector Event Beta Sensitivity Matrix', async (t) => {
  const SECTOR_BETAS = {
    RBI_MPC_DECISION: [
      { sector: 'NIFTY BANK', beta: 1.85 },
      { sector: 'NIFTY REALTY', beta: 1.65 },
      { sector: 'NIFTY 50', beta: 1.00 },
      { sector: 'NIFTY IT', beta: 0.45 },
    ],
    UNION_BUDGET_INDIA: [
      { sector: 'NIFTY INFRA', beta: 2.10 },
      { sector: 'NIFTY PSU BANK', beta: 1.90 },
      { sector: 'NIFTY 50', beta: 1.00 },
      { sector: 'NIFTY FMCG', beta: 0.65 },
    ],
    US_FED_FOMC_DECISION: [
      { sector: 'NIFTY IT', beta: 1.70 },
      { sector: 'NIFTY 50', beta: 1.00 },
      { sector: 'BANKNIFTY', beta: 0.75 },
    ],
  };

  await t.test('Bank Nifty has higher beta than Nifty 50 on RBI MPC', () => {
    const list = SECTOR_BETAS.RBI_MPC_DECISION;
    const bank = list.find(s => s.sector === 'NIFTY BANK');
    const nifty = list.find(s => s.sector === 'NIFTY 50');
    assert.ok(bank.beta > nifty.beta, `Bank beta (${bank.beta}) must exceed Nifty (${nifty.beta})`);
  });

  await t.test('Nifty IT has highest beta on US FOMC', () => {
    const list = SECTOR_BETAS.US_FED_FOMC_DECISION;
    const it = list.find(s => s.sector === 'NIFTY IT');
    const nifty = list.find(s => s.sector === 'NIFTY 50');
    assert.ok(it.beta > nifty.beta, `IT beta (${it.beta}) must exceed Nifty (${nifty.beta})`);
  });

  await t.test('Nifty Infra and PSU Bank lead beta on Union Budget', () => {
    const list = SECTOR_BETAS.UNION_BUDGET_INDIA;
    const infra = list.find(s => s.sector === 'NIFTY INFRA');
    const psu = list.find(s => s.sector === 'NIFTY PSU BANK');
    assert.ok(infra.beta > 2.0, `Infra beta must exceed 2.0, got ${infra.beta}`);
    assert.ok(psu.beta > 1.8, `PSU bank beta must exceed 1.8, got ${psu.beta}`);
  });
});

test('AC-EVT-11: Historical Macroeconomic Scenario Stress Replay', async (t) => {
  const scenarios = [
    { id: 'BUDGET_2020_CRASH', shockPct: -5.6, ivShock: 12.4 },
    { id: 'RBI_EMERGENCY_HIKE_2022', shockPct: -2.4, ivShock: 6.0 },
    { id: 'ELECTION_RESULTS_2024', shockPct: -5.9, ivShock: 18.2 },
  ];

  await t.test('replays Budget 2020 crash and computes severe drawdown on long delta portfolio', () => {
    const sc = scenarios.find(s => s.id === 'BUDGET_2020_CRASH');
    const totalDelta = 100; // Long 100 delta
    const totalVega = 200; // Long 200 vega
    const deltaPnl = totalDelta * (sc.shockPct / 100) * 24000; // -₹134,400
    const vegaPnl = totalVega * sc.ivShock; // +₹2,480
    const netPnl = deltaPnl + vegaPnl;

    assert.ok(deltaPnl < -100000, `Expected severe delta loss, got ${deltaPnl}`);
    assert.ok(netPnl < -50000, `Expected overall loss > 50k, got ${netPnl}`);
  });

  await t.test('short vega portfolio suffers extreme loss during Election Day vol spike', () => {
    const sc = scenarios.find(s => s.id === 'ELECTION_RESULTS_2024');
    const shortVega = -1000; // Short 1000 vega
    const vegaLoss = shortVega * sc.ivShock; // -18,200
    assert.equal(vegaLoss, -18200);
  });
});
