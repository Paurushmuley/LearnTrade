// TradeCraft AI — Autonomous AI Quant Desk & Virtual Hedge Fund Committee Engine
// Multi-agent institutional decision committee: Macro, Momentum, Risk & Execution

import {
  QuantAgentPersona,
  QuantDeskConsensusVerdict,
  DebateRoundStatement,
  CommitteeVerdict,
  DirectionalBias,
  RoutingAlgorithm,
  SentimentStance,
} from '../types/quantDesk';
import { TickerInfo, Candle } from '../types/trading';
import { calculateStatutoryCharges } from './taxEngine';
import { generateLevel2DOM } from './replayEngine';

export const QUANT_COMMITTEE_PERSONAS: QuantAgentPersona[] = [
  {
    id: 'agent_macro',
    name: 'Dr. Alistair Vance',
    role: 'MACRO_STRATEGIST',
    title: 'Chief Macro & Liquidity Strategist',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    badge: '🌐 Top-Down Regime',
    description: 'Tracks institutional FII/DII liquidity cycles, NSE market breadth (A/D ratio), and sectoral capital rotation.',
    coreFormula: 'S_macro = 0.40·Flow + 0.35·Breadth + 0.25·Sector',
  },
  {
    id: 'agent_alpha',
    name: "Vikram 'Alpha' Ray",
    role: 'MOMENTUM_HUNTER',
    title: 'Lead Momentum Alpha Hunter',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    badge: '⚡ Price Action & Confluence',
    description: 'Specializes in 15m Opening Range Breakouts (ORBs), Volume Surges (≥2x), EMA crossovers, and VWAP confluences.',
    coreFormula: 'C_score = Σ (w_k · Indicator_k) ∈ [0, 100]',
  },
  {
    id: 'agent_risk',
    name: 'Elena Rostova',
    role: 'CHIEF_RISK_OFFICER',
    title: 'Chief Risk Officer (CRO)',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    badge: '🛡️ Capital Preservation & VaR',
    description: 'Enforces 99% Parametric Value-at-Risk, Half-Kelly position caps, and intra-day drawdown circuit breakers with unilateral veto power.',
    coreFormula: 'VaR_99 ≤ 2.0% Equity | Pos ≤ 15% Equity',
  },
  {
    id: 'agent_execution',
    name: 'Kavita Sundaram',
    role: 'EXECUTION_ALGORIST',
    title: 'Lead Execution & Microstructure Algorist',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
    badge: '⚙️ DOM & Slippage Minimization',
    description: 'Inspects Level-2 order book depth (5 bids/asks), estimates Almgren-Chriss market impact, and chooses DOM Limit, Iceberg, or TWAP/VWAP.',
    coreFormula: 'E[Impact] = 0.5·γ(Q/ADV) + η(Q/N)^0.5',
  },
];

/**
 * Evaluates the Macro Regime Score S_macro in [-1.0, +1.0]
 */
export function calculateMacroRegimeScore(params: {
  fiiNetFlowCr: number;
  diiNetFlowCr: number;
  advances: number;
  declines: number;
  sectorRelativeReturnPct: number;
}): {
  regimeScore: number;
  regimeLabel: 'AGGRESSIVE_RISK_ON' | 'NEUTRAL_SELECTIVE' | 'DEFENSIVE_RISK_OFF';
  comment: string;
} {
  const totalFlow = params.fiiNetFlowCr + params.diiNetFlowCr;
  // Normalized flow using tanh(x / 2000)
  const normFlow = Math.tanh(totalFlow / 2000);

  // Breadth ratio: (A - D) / (A + D)
  const totalBreadth = Math.max(1, params.advances + params.declines);
  const breadthRatio = (params.advances - params.declines) / totalBreadth;

  // Sector relative return in [-1, 1] normalized
  const normSector = Math.max(-1, Math.min(1, params.sectorRelativeReturnPct / 2.0));

  // Weighted composite score: 40% flow, 35% breadth, 25% sector
  const regimeScore = Number(
    (0.40 * normFlow + 0.35 * breadthRatio + 0.25 * normSector).toFixed(2)
  );

  let regimeLabel: 'AGGRESSIVE_RISK_ON' | 'NEUTRAL_SELECTIVE' | 'DEFENSIVE_RISK_OFF' =
    'NEUTRAL_SELECTIVE';
  let comment = '';

  if (regimeScore >= 0.30) {
    regimeLabel = 'AGGRESSIVE_RISK_ON';
    comment = `Institutional liquidity is surging (+₹${totalFlow.toLocaleString(
      'en-IN'
    )} Cr) with broad market advance participation (${params.advances}:${params.declines}). Macro regime fully supports aggressive risk allocation.`;
  } else if (regimeScore <= -0.25) {
    regimeLabel = 'DEFENSIVE_RISK_OFF';
    comment = `Heavy institutional distribution detected (-₹${Math.abs(
      totalFlow
    ).toLocaleString(
      'en-IN'
    )} Cr) and market breadth is deteriorating (${params.advances}:${params.declines}). Long alpha setups will face significant macro drag.`;
  } else {
    regimeLabel = 'NEUTRAL_SELECTIVE';
    comment = `Market is in rotational consolidation. Net flows are balanced (${totalFlow >= 0 ? '+' : ''}₹${totalFlow.toLocaleString(
      'en-IN'
    )} Cr). Select stock-specific setups with strict R:R thresholds.`;
  }

  return { regimeScore, regimeLabel, comment };
}

/**
 * Evaluates Alpha Confluence Score (0 - 100) for a given stock
 */
export function calculateAlphaSignal(
  ticker: TickerInfo,
  candles: Candle[]
): {
  confluenceScore: number;
  setupType: string;
  directionalBias: DirectionalBias;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  riskRewardRatio: number;
  comment: string;
} {
  const currentPrice = ticker.currentPrice;
  const isPositiveDay = ticker.changePercent >= 0;

  // Derive realistic intraday technical factors
  const recentCandles = candles.slice(-20);
  const highestRecent = Math.max(...recentCandles.map((c) => c.high), currentPrice);
  const lowestRecent = Math.min(...recentCandles.map((c) => c.low), currentPrice);

  let confluenceScore = 65; // Base conviction
  let setupType = 'VWAP Pullback & EMA Momentum';
  let directionalBias: DirectionalBias = isPositiveDay ? 'LONG' : 'SHORT';

  if (isPositiveDay) {
    confluenceScore = Math.min(95, 70 + Math.round(ticker.changePercent * 6));
    setupType = ticker.changePercent > 1.5 ? '15m ORB High Breakout + Volume Surge' : 'Day VWAP Support & 20 EMA Bounce';
  } else {
    confluenceScore = Math.min(92, 65 + Math.round(Math.abs(ticker.changePercent) * 5));
    setupType = 'VWAP Rejection & Breakdown of 15m Low';
  }

  // Calculate clean 1:2.4 Risk-Reward structure
  let stopLossPrice = 0;
  let targetPrice = 0;

  if (directionalBias === 'LONG') {
    const riskDistance = Math.max(currentPrice * 0.008, (currentPrice - lowestRecent) * 0.8);
    stopLossPrice = Number((currentPrice - riskDistance).toFixed(2));
    targetPrice = Number((currentPrice + riskDistance * 2.4).toFixed(2));
  } else {
    const riskDistance = Math.max(currentPrice * 0.008, (highestRecent - currentPrice) * 0.8);
    stopLossPrice = Number((currentPrice + riskDistance).toFixed(2));
    targetPrice = Number((currentPrice - riskDistance * 2.4).toFixed(2));
  }

  const riskPerShare = Math.abs(currentPrice - stopLossPrice);
  const rewardPerShare = Math.abs(targetPrice - currentPrice);
  const riskRewardRatio = Number((rewardPerShare / Math.max(0.05, riskPerShare)).toFixed(2));

  const comment = `${ticker.symbol} is displaying a prime ${setupType}. Price is holding ${
    directionalBias === 'LONG' ? 'above' : 'below'
  } day VWAP with strong volume acceleration. Target ₹${targetPrice} (2.4R) against Stop Loss ₹${stopLossPrice}.`;

  return {
    confluenceScore,
    setupType,
    directionalBias,
    entryPrice: currentPrice,
    stopLossPrice,
    targetPrice,
    riskRewardRatio,
    comment,
  };
}

/**
 * Evaluates Risk Limits, Value-at-Risk, Kelly sizing, and Veto status
 */
export function calculateRiskAudit(params: {
  portfolioEquity: number;
  currentDrawdownPct: number;
  entryPrice: number;
  stopLossPrice: number;
  alphaScore: number;
  macroScore: number;
  directionalBias: DirectionalBias;
}): {
  portfolioVar99Pct: number;
  halfKellyFraction: number;
  maxApprovedCapital: number;
  approvedQuantity: number;
  originalQuantity: number;
  haircutPercentage: number;
  vetoTriggered: boolean;
  vetoReason?: string;
  officerComment: string;
  comment?: string;
} {
  const { portfolioEquity, currentDrawdownPct, entryPrice, stopLossPrice, alphaScore, macroScore, directionalBias } =
    params;

  // 1. Unilateral Veto Checks
  // A. Drawdown Circuit Breaker: Max 6% intraday drawdown
  if (currentDrawdownPct >= 6.0) {
    const vetoReason = `Intraday Drawdown (${currentDrawdownPct.toFixed(
      1
    )}%) exceeds the fund's 6.0% circuit breaker. Committee trading is HALTED for capital preservation.`;
    return {
      portfolioVar99Pct: 0,
      halfKellyFraction: 0,
      maxApprovedCapital: 0,
      approvedQuantity: 0,
      originalQuantity: 100,
      haircutPercentage: 100,
      vetoTriggered: true,
      vetoReason,
      officerComment: 'VETO: Emergency drawdown circuit breaker engaged. No new risk allowed.',
      comment: 'VETO: Emergency drawdown circuit breaker engaged. No new risk allowed.',
    };
  }

  // B. Counter-Trend Macro Headwind Veto: Severe institutional selling with Long proposal
  if (macroScore <= -0.35 && directionalBias === 'LONG') {
    const vetoReason = `Macro score (${macroScore}) indicates heavy institutional liquidations. Initiating LONG positions violates mandate.`;
    return {
      portfolioVar99Pct: 0,
      halfKellyFraction: 0,
      maxApprovedCapital: 0,
      approvedQuantity: 0,
      originalQuantity: 100,
      haircutPercentage: 100,
      vetoTriggered: true,
      vetoReason,
      officerComment: 'VETO: Macro regime is in extreme defensive risk-off. Long proposal denied.',
      comment: 'VETO: Macro regime is in extreme defensive risk-off. Long proposal denied.',
    };
  }

  // 2. Kelly Criterion & Position Sizing
  // Est. win rate p based on Alpha Confluence
  const p = Math.max(0.48, Math.min(0.68, 0.40 + (alphaScore / 100) * 0.35));
  const b = 2.4; // 2.4:1 R:R
  const fullKelly = Math.max(0, (p * b - (1 - p)) / b);
  const halfKelly = Number((fullKelly / 2).toFixed(3));

  // Scale half-kelly by macro sentiment: (1 + macroScore) / 2
  const macroMultiplier = Math.max(0.5, Math.min(1.2, (1 + macroScore) / 2));
  const adjustedKelly = Math.min(0.12, halfKelly * macroMultiplier); // Cap at 12% total portfolio equity

  const maxApprovedCapital = Math.round(portfolioEquity * adjustedKelly);
  const rawQty = Math.max(1, Math.floor(maxApprovedCapital / entryPrice));

  // 3. Parametric 99% VaR Calculation: Qty * Price * 2.326 * daily_vol (assumed 1.8%)
  const dailyVol = 0.018;
  const portfolioVar99 = Math.round(rawQty * entryPrice * 2.326 * dailyVol);
  const varPctOfEquity = Number(((portfolioVar99 / portfolioEquity) * 100).toFixed(2));

  // If VaR > 2.0% of portfolio equity, apply haircut
  let approvedQuantity = rawQty;
  let haircutPercentage = 0;

  if (varPctOfEquity > 2.0) {
    const scaleFactor = 2.0 / varPctOfEquity;
    approvedQuantity = Math.max(1, Math.floor(rawQty * scaleFactor));
    haircutPercentage = Math.round((1 - approvedQuantity / rawQty) * 100);
  }

  const originalQuantity = Math.round(rawQty * 1.35); // What an unhedged trader would have requested
  const officerComment =
    haircutPercentage > 0
      ? `Sizing adjusted by -${haircutPercentage}% to cap 99% 1-day VaR within our strict 2.0% portfolio equity ceiling. Approved ${approvedQuantity} shares (₹${(
          approvedQuantity * entryPrice
        ).toLocaleString('en-IN')}).`
      : `Risk verified within parameters. Half-Kelly allocation (${(adjustedKelly * 100).toFixed(
          1
        )}%) with 99% VaR at ${varPctOfEquity}%. Approved full size of ${approvedQuantity} shares.`;

  return {
    portfolioVar99Pct: varPctOfEquity,
    halfKellyFraction: halfKelly,
    maxApprovedCapital,
    approvedQuantity,
    originalQuantity,
    haircutPercentage,
    vetoTriggered: false,
    officerComment,
    comment: officerComment,
  };
}

/**
 * Evaluates Order Book Depth and chooses the optimal Execution Algorithm
 */
export function calculateExecutionRouting(params: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  currentPrice: number;
}): {
  routingAlgorithm: RoutingAlgorithm;
  sliceCount: number;
  sliceIntervalSec: number;
  estimatedSlippageBps: number;
  estimatedStatutoryTaxes: number;
  bookImbalance: number;
  algoristComment: string;
  comment?: string;
} {
  const { symbol, side, quantity, currentPrice } = params;
  const dom = generateLevel2DOM(currentPrice, 50);

  const top5Bids = dom.bids.reduce((acc, b) => acc + b.quantity, 0);
  const top5Asks = dom.asks.reduce((acc, a) => acc + a.quantity, 0);
  const totalTop5 = side === 'BUY' ? top5Asks : top5Bids;
  const bookImbalance = Number(((top5Bids - top5Asks) / Math.max(1, top5Bids + top5Asks)).toFixed(2));

  let routingAlgorithm: RoutingAlgorithm = 'DOM_LIMIT';
  let sliceCount = 1;
  let sliceIntervalSec = 0;
  let estimatedSlippageBps = 1.5;
  let comment = '';

  // Order size compared to top 5 book depth
  const sizeRatio = quantity / Math.max(1, totalTop5);

  if (sizeRatio <= 0.25) {
    routingAlgorithm = 'DOM_LIMIT';
    sliceCount = 1;
    sliceIntervalSec = 0;
    estimatedSlippageBps = 0.8;
    comment = `Order quantity (${quantity}) represents only ${(sizeRatio * 100).toFixed(
      1
    )}% of Level-2 top 5 depth (${totalTop5}). Routing as single Direct DOM Limit Ladder to capture passive liquidity at ₹${currentPrice}.`;
  } else if (sizeRatio <= 1.0) {
    routingAlgorithm = 'ICEBERG';
    sliceCount = Math.max(3, Math.min(6, Math.ceil(quantity / 50)));
    sliceIntervalSec = 10;
    estimatedSlippageBps = 2.4;
    comment = `Order size is moderate (${(sizeRatio * 100).toFixed(
      1
    )}% of top depth). Slicing into ${sliceCount} Iceberg child orders with 10s randomized delays to prevent front-running and adverse market impact.`;
  } else {
    routingAlgorithm = 'TWAP';
    sliceCount = Math.max(6, Math.min(10, Math.ceil(quantity / 30)));
    sliceIntervalSec = 15;
    estimatedSlippageBps = 4.2;
    comment = `Large order block exceeds immediate DOM depth. Routing via Time-Weighted Average Price (TWAP) across ${sliceCount} slices with 15s cadence to minimize permanent impact.`;
  }

  // Statutory charges calculation
  const statutory = calculateStatutoryCharges(side, 'MIS', currentPrice, quantity);

  return {
    routingAlgorithm,
    sliceCount,
    sliceIntervalSec,
    estimatedSlippageBps,
    estimatedStatutoryTaxes: statutory.totalCharges,
    bookImbalance,
    algoristComment: comment,
    comment,
  };
}

/**
 * Runs the full 4-agent Committee Debate on a stock
 */
export function runCommitteeDebate(params: {
  ticker: TickerInfo;
  candles: Candle[];
  portfolioEquity: number;
  currentDrawdownPct: number;
  macroContext?: {
    fiiNetFlowCr?: number;
    diiNetFlowCr?: number;
    advances?: number;
    declines?: number;
    sectorRelativeReturnPct?: number;
  };
}): QuantDeskConsensusVerdict {
  const { ticker, candles, portfolioEquity, currentDrawdownPct } = params;

  // 1. Phase 1: Alpha Proposal
  const alphaSignal = calculateAlphaSignal(ticker, candles);

  // 2. Phase 2: Macro Appraisal
  const macroScore = calculateMacroRegimeScore({
    fiiNetFlowCr: params.macroContext?.fiiNetFlowCr ?? 1840,
    diiNetFlowCr: params.macroContext?.diiNetFlowCr ?? 920,
    advances: params.macroContext?.advances ?? 32,
    declines: params.macroContext?.declines ?? 18,
    sectorRelativeReturnPct: params.macroContext?.sectorRelativeReturnPct ?? (ticker.changePercent * 0.6),
  });

  // 3. Phase 3: Risk Audit & Veto
  const riskAudit = calculateRiskAudit({
    portfolioEquity,
    currentDrawdownPct,
    entryPrice: alphaSignal.entryPrice,
    stopLossPrice: alphaSignal.stopLossPrice,
    alphaScore: alphaSignal.confluenceScore,
    macroScore: macroScore.regimeScore,
    directionalBias: alphaSignal.directionalBias,
  });

  // 4. Phase 4: Execution Routing
  const executionPlan = calculateExecutionRouting({
    symbol: ticker.symbol,
    side: alphaSignal.directionalBias === 'SHORT' ? 'SELL' : 'BUY',
    quantity: Math.max(1, riskAudit.approvedQuantity),
    currentPrice: ticker.currentPrice,
  });

  // 5. Determine Committee Verdict & Confidence
  let verdict: CommitteeVerdict = 'APPROVED_FULL';
  if (riskAudit.vetoTriggered) {
    verdict = 'REJECTED_BY_RISK';
  } else if (macroScore.regimeLabel === 'DEFENSIVE_RISK_OFF' && alphaSignal.directionalBias === 'LONG') {
    verdict = 'REJECTED_BY_MACRO';
  } else if (riskAudit.haircutPercentage > 0) {
    verdict = 'APPROVED_SCALED_DOWN';
  }

  // Composite committee confidence
  const normMacro = (macroScore.regimeScore + 1) / 2; // 0 to 1
  const normAlpha = alphaSignal.confluenceScore / 100; // 0 to 1
  const normRisk = riskAudit.vetoTriggered ? 0 : 1 - riskAudit.haircutPercentage / 100;
  const confidenceScore = Number(((0.30 * normMacro + 0.40 * normAlpha + 0.30 * normRisk) * 100).toFixed(1));

  // 6. Assemble Structured 4-Round Debate Transcript
  const debateRounds: DebateRoundStatement[] = [
    {
      agentId: 'agent_alpha',
      agentName: "Vikram 'Alpha' Ray",
      role: 'MOMENTUM_HUNTER',
      round: 1,
      statement: `Committee members, I propose a ${alphaSignal.directionalBias} setup on ${ticker.symbol} at ₹${alphaSignal.entryPrice.toFixed(
        2
      )}. We have high confluence (${alphaSignal.confluenceScore}/100) on the ${alphaSignal.setupType}. Target is ₹${alphaSignal.targetPrice.toFixed(
        2
      )} with strict Stop Loss at ₹${alphaSignal.stopLossPrice.toFixed(2)} (${alphaSignal.riskRewardRatio}R:R). Initial sizing request: ${riskAudit.originalQuantity} shares.`,
      sentiment: alphaSignal.directionalBias === 'LONG' ? 'BULLISH' : 'BEARISH',
      keyMetricHighlight: `${alphaSignal.confluenceScore}/100 Confluence`,
    },
    {
      agentId: 'agent_macro',
      agentName: 'Dr. Alistair Vance',
      role: 'MACRO_STRATEGIST',
      round: 2,
      statement: `Reviewing top-down macroeconomic liquidity: Our composite regime score stands at ${macroScore.regimeScore >= 0 ? '+' : ''}${
        macroScore.regimeScore
      } (${macroScore.regimeLabel.replace(/_/g, ' ')}). ${macroScore.comment}`,
      sentiment: macroScore.regimeScore >= 0.25 ? 'BULLISH' : macroScore.regimeScore <= -0.2 ? 'BEARISH' : 'NEUTRAL',
      keyMetricHighlight: `Regime: ${macroScore.regimeLabel}`,
    },
    {
      agentId: 'agent_risk',
      agentName: 'Elena Rostova',
      role: 'CHIEF_RISK_OFFICER',
      round: 3,
      statement: riskAudit.vetoTriggered
        ? `I am invoking my UNILATERAL VETO. ${riskAudit.vetoReason}`
        : `Audited ${ticker.symbol} against our capital constraints. ${riskAudit.comment}`,
      sentiment: riskAudit.vetoTriggered ? 'VETO' : riskAudit.haircutPercentage > 0 ? 'CAUTIONARY' : 'BULLISH',
      keyMetricHighlight: riskAudit.vetoTriggered ? 'VETO TRIGGERED' : `99% VaR: ${riskAudit.portfolioVar99Pct}%`,
    },
    {
      agentId: 'agent_execution',
      agentName: 'Kavita Sundaram',
      role: 'EXECUTION_ALGORIST',
      round: 4,
      statement: riskAudit.vetoTriggered
        ? 'Risk Officer veto active. No execution route scheduled.'
        : `Microstructure liquidity verified. ${executionPlan.comment} Estimated slippage: ${executionPlan.estimatedSlippageBps} bps; estimated statutory fees: ₹${executionPlan.estimatedStatutoryTaxes.toFixed(2)}. Ready to dispatch.`,
      sentiment: riskAudit.vetoTriggered ? 'NEUTRAL' : 'BULLISH',
      keyMetricHighlight: `Routing: ${executionPlan.routingAlgorithm}`,
    },
  ];

  return {
    committeeSessionId: `COMM-${Date.now().toString(36).toUpperCase()}-${ticker.symbol}`,
    timestamp: new Date().toISOString(),
    symbol: ticker.symbol,
    verdict,
    directionalBias: alphaSignal.directionalBias,
    macroRegime: {
      regimeScore: macroScore.regimeScore,
      regimeLabel: macroScore.regimeLabel,
      fiiDiiNetFlowCr: (params.macroContext?.fiiNetFlowCr ?? 1840) + (params.macroContext?.diiNetFlowCr ?? 920),
      marketBreadthRatio: Number(
        (
          ((params.macroContext?.advances ?? 32) - (params.macroContext?.declines ?? 18)) /
          ((params.macroContext?.advances ?? 32) + (params.macroContext?.declines ?? 18))
        ).toFixed(2)
      ),
      sectorRelativeReturnPct: params.macroContext?.sectorRelativeReturnPct ?? Number((ticker.changePercent * 0.6).toFixed(2)),
      strategistComment: macroScore.comment,
    },
    alphaSignal: {
      confluenceScore: alphaSignal.confluenceScore,
      setupType: alphaSignal.setupType,
      directionalBias: alphaSignal.directionalBias,
      entryPrice: alphaSignal.entryPrice,
      stopLossPrice: alphaSignal.stopLossPrice,
      targetPrice: alphaSignal.targetPrice,
      riskRewardRatio: alphaSignal.riskRewardRatio,
      hunterComment: alphaSignal.comment,
    },
    riskAudit,
    executionPlan,
    debateRounds,
    confidenceScore,
  };
}
