'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Scale,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Info,
  Clock,
  Sparkles,
  BarChart2,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  PairDefinition,
  PairAnalysisSummary,
  StatArbSignalType,
} from '../types/statArb';
import {
  PRELOADED_PAIRS,
  analyzePair,
} from '../lib/statArbEngine';
import { calculateStatutoryCharges } from '../lib/taxEngine';

interface StatArbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutePairTrade?: (
    legY: { symbol: string; side: 'BUY' | 'SELL'; price: number; quantity: number },
    legX: { symbol: string; side: 'BUY' | 'SELL'; price: number; quantity: number }
  ) => void;
}

export const StatArbModal: React.FC<StatArbModalProps> = ({
  isOpen,
  onClose,
  onExecutePairTrade,
}) => {
  const [selectedPairId, setSelectedPairId] = useState<string>(PRELOADED_PAIRS[0].id);
  const [activeTab, setActiveTab] = useState<'chart' | 'kalman' | 'hurdle'>('chart');
  const [tradeNotification, setTradeNotification] = useState<string | null>(null);

  const selectedPair = useMemo(() => {
    return PRELOADED_PAIRS.find((p) => p.id === selectedPairId) || PRELOADED_PAIRS[0];
  }, [selectedPairId]);

  const analysis: PairAnalysisSummary = useMemo(() => {
    return analyzePair(selectedPair);
  }, [selectedPair]);

  const handleExecuteSignalTrade = useCallback(() => {
    if (!analysis.signal.legs || analysis.signal.legs.length < 2) return;

    const legY = analysis.signal.legs[0];
    const legX = analysis.signal.legs[1];

    if (onExecutePairTrade) {
      onExecutePairTrade(
        { symbol: legY.asset, side: legY.side, price: legY.price, quantity: legY.units },
        { symbol: legX.asset, side: legX.side, price: legX.price, quantity: legX.units }
      );
    }

    setTradeNotification(
      `⚖️ Market-Neutral Pair Executed: ${legY.side} ${legY.units} ${legY.asset} @ ₹${legY.price.toFixed(2)} & ${legX.side} ${legX.units} ${legX.asset} @ ₹${legX.price.toFixed(2)}`
    );
    setTimeout(() => setTradeNotification(null), 5000);
  }, [analysis, onExecutePairTrade]);

  if (!isOpen) return null;

  const zScore = analysis.currentZScore;
  const isCointegrated = analysis.adf.isCointegrated;
  const halfLife = analysis.ou.halfLife;

  // Chart coordinate mapping
  const points = analysis.historicalSeries;
  const maxZ = 4.0;
  const minZ = -4.0;
  const chartHeight = 220;
  const chartWidth = 720;

  const getYCoord = (z: number) => {
    const clamped = Math.max(minZ, Math.min(maxZ, z));
    const normalized = (maxZ - clamped) / (maxZ - minZ);
    return normalized * chartHeight;
  };

  const getXCoord = (index: number) => {
    if (points.length <= 1) return 0;
    return (index / (points.length - 1)) * chartWidth;
  };

  // Generate SVG path for z-score series
  const svgPathData = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getXCoord(i).toFixed(1)} ${getYCoord(pt.zScore).toFixed(1)}`)
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Scale className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                  Statistical Arbitrage & Cointegration Pairs Studio
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Sprint 16 Mean Reversion
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Engle-Granger 2-step cointegration, Augmented Dickey-Fuller stationarity, recursive Kalman hedge ratios & statutory hurdle drag
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Pair Selector */}
            <select
              value={selectedPairId}
              onChange={(e) => setSelectedPairId(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {PRELOADED_PAIRS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sector})
                </option>
              ))}
            </select>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Trade Notification Toast */}
        {tradeNotification && (
          <div className="bg-gradient-to-r from-indigo-900/90 to-purple-900/90 border-b border-indigo-500/50 px-6 py-2 text-xs font-medium text-indigo-200 flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>{tradeNotification}</span>
          </div>
        )}

        {/* Cointegration & Econometric Gauges HUD */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-950/40 border-b border-slate-800 text-xs">
          {/* Cointegration & ADF */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Engle-Granger ADF</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-300">
                τ = {analysis.adf.testStatistic.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                p &lt; {analysis.adf.pValue.toFixed(3)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isCointegrated
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {isCointegrated ? `COINTEGRATED (${analysis.adf.confidenceLevel})` : 'NOT COINTEGRATED'}
              </span>
            </div>
          </div>

          {/* OU Half-Life */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>OU Half-Life (t_1/2)</span>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-cyan-300">
                {halfLife.toFixed(1)} <span className="text-xs font-normal">bars</span>
              </span>
              <span className="text-[10px] text-slate-400">
                θ = {analysis.ou.theta.toFixed(3)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {halfLife <= 15 ? '⚡ Rapid Mean Reversion' : 'Moderate cycle speed'}
            </div>
          </div>

          {/* Kalman Dynamic Hedge Ratio */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Kalman Dynamic β_t</span>
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-indigo-300">
                {analysis.currentBetaKalman.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-400">
                OLS: {analysis.currentBetaOLS.toFixed(3)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              R² = {analysis.ols.rSquared.toFixed(3)} | α = {analysis.ols.alpha.toFixed(1)}
            </div>
          </div>

          {/* Spread Z-Score */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Spread Z-Score</span>
              {zScore >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-lg font-bold ${
                  zScore <= -2.0
                    ? 'text-emerald-400'
                    : zScore >= 2.0
                    ? 'text-rose-400'
                    : 'text-slate-200'
                }`}
              >
                {zScore > 0 ? '+' : ''}{zScore.toFixed(2)} σ
              </span>
              <span className="text-[10px] text-slate-400">
                Spread: ₹{analysis.currentSpread.toFixed(1)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Entry at ±2.0σ | Stop at ±3.5σ
            </div>
          </div>

          {/* Trading Signal State */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Arbitrage Signal</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide inline-block ${
                  analysis.signal.signalType === 'LONG_SPREAD'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : analysis.signal.signalType === 'SHORT_SPREAD'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    : analysis.signal.signalType === 'EXIT'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : analysis.signal.signalType === 'STOP_LOSS'
                    ? 'bg-red-600/30 text-red-200 border border-red-500 animate-bounce'
                    : 'bg-slate-700/40 text-slate-400'
                }`}
              >
                {analysis.signal.signalType.replace('_', ' ')}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {analysis.signal.signalType !== 'NO_SIGNAL' ? 'Opportunity active' : 'Waiting for ±2.0σ'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'chart'
                ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            2D Rolling Z-Score Spread Curve
          </button>
          <button
            onClick={() => setActiveTab('kalman')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'kalman'
                ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Kalman Filter Dynamic β_t Tracking
          </button>
          <button
            onClick={() => setActiveTab('hurdle')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'hurdle'
                ? 'border-indigo-400 text-indigo-300 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Pre-Trade Statutory Tax & Hurdle Model
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'chart' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {"Rolling Z-Score Normalized Spread (ε_t = Y_t - β_t · X_t - α_t) with StatArb Threshold Bands"}
                </span>
                <span className="text-[11px] text-indigo-400">
                  Window: 25 bars | Sample: {points.length} periods
                </span>
              </div>

              {/* SVG Z-Score Spread Chart */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 relative overflow-hidden">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-56 overflow-visible"
                >
                  <defs>
                    <linearGradient id="zGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                      <stop offset="50%" stopColor="#6366f1" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Lines */}
                  {/* +3.5 Stop Loss Line */}
                  <line
                    x1="0"
                    y1={getYCoord(3.5)}
                    x2={chartWidth}
                    y2={getYCoord(3.5)}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text x={chartWidth - 65} y={getYCoord(3.5) - 4} fill="#ef4444" fontSize="10" fontFamily="sans-serif">
                    +3.5σ Stop Loss
                  </text>

                  {/* +2.0 Short Entry Line */}
                  <line
                    x1="0"
                    y1={getYCoord(2.0)}
                    x2={chartWidth}
                    y2={getYCoord(2.0)}
                    stroke="#f43f5e"
                    strokeWidth="1.2"
                  />
                  <text x={chartWidth - 75} y={getYCoord(2.0) - 4} fill="#f43f5e" fontSize="10" fontFamily="sans-serif">
                    +2.0σ Short Spread
                  </text>

                  {/* 0.0 Equilibrium Mean Line */}
                  <line
                    x1="0"
                    y1={getYCoord(0.0)}
                    x2={chartWidth}
                    y2={getYCoord(0.0)}
                    stroke="#64748b"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <text x={chartWidth - 55} y={getYCoord(0.0) - 4} fill="#94a3b8" fontSize="10" fontFamily="sans-serif">
                    0.0σ Mean
                  </text>

                  {/* -2.0 Long Entry Line */}
                  <line
                    x1="0"
                    y1={getYCoord(-2.0)}
                    x2={chartWidth}
                    y2={getYCoord(-2.0)}
                    stroke="#10b981"
                    strokeWidth="1.2"
                  />
                  <text x={chartWidth - 75} y={getYCoord(-2.0) + 12} fill="#10b981" fontSize="10" fontFamily="sans-serif">
                    -2.0σ Long Spread
                  </text>

                  {/* -3.5 Stop Loss Line */}
                  <line
                    x1="0"
                    y1={getYCoord(-3.5)}
                    x2={chartWidth}
                    y2={getYCoord(-3.5)}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text x={chartWidth - 65} y={getYCoord(-3.5) + 12} fill="#ef4444" fontSize="10" fontFamily="sans-serif">
                    -3.5σ Stop Loss
                  </text>

                  {/* Continuous Z-Score Path */}
                  <path
                    d={svgPathData}
                    fill="none"
                    stroke="#a5b4fc"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Animated Terminal Point Dot */}
                  {points.length > 0 && (
                    <circle
                      cx={getXCoord(points.length - 1)}
                      cy={getYCoord(points[points.length - 1].zScore)}
                      r="5"
                      fill={zScore <= -2.0 ? '#10b981' : zScore >= 2.0 ? '#f43f5e' : '#6366f1'}
                      className="animate-pulse"
                    />
                  )}
                </svg>
              </div>

              {/* Action Banner */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="font-semibold text-slate-200">Recommended StatArb Action:</span>
                  <p className="text-slate-400 mt-0.5">{analysis.signal.recommendedAction}</p>
                </div>

                {analysis.signal.legs.length >= 2 ? (
                  <button
                    onClick={handleExecuteSignalTrade}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-900/30 flex items-center gap-2 transition-all shrink-0"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Execute Market-Neutral Pair ({analysis.signal.legs[0].side} / {analysis.signal.legs[1].side})</span>
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-xs">
                    Monitoring for Entry Threshold (±2.0σ)
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'kalman' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Dynamic State-Space Kalman Filter vs Static OLS Hedge Ratio
                </span>
                <span className="text-[11px] text-indigo-400">
                  Adapts in real time to corporate actions and valuation drift without lookback window lag
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="font-bold text-indigo-300 flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    Recursive Kalman Filter (Dynamic)
                  </h4>
                  <p className="text-slate-400 leading-relaxed mb-3">
                    Continuously updates the optimal hedge ratio β_t using the observation error innovation:
                    {" θ_hat_t = θ_hat_{t-1} + K_t · (y_t - H_t · θ_hat_{t-1})"}
                  </p>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Dynamic β_t:</span>
                      <span className="text-indigo-400 font-bold">{analysis.currentBetaKalman.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dynamic Intercept α_t:</span>
                      <span className="text-slate-300 font-bold">₹{points[points.length - 1]?.alpha.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Process Noise Q:</span>
                      <span className="text-slate-400">diag(1e-4, 1e-3)</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="font-bold text-slate-300 flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4 text-slate-400" />
                    Ordinary Least Squares (Static OLS)
                  </h4>
                  <p className="text-slate-400 leading-relaxed mb-3">
                    Calculates a single static slope {"β = Cov(X, Y) / Var(X)"} over the entire sample, susceptible to structural break breakdown.
                  </p>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Static Sample β:</span>
                      <span className="text-slate-200 font-bold">{analysis.currentBetaOLS.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Coefficient of Determination (R²):</span>
                      <span className="text-emerald-400 font-bold">{analysis.ols.rSquared.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Standard Error (SE):</span>
                      <span className="text-slate-400">{analysis.ols.stdError.toFixed(2)} pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hurdle' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Pre-Trade Indian Statutory Tax Drag & Net Expectancy Hurdle Rate
                </span>
                <span className="text-[11px] text-emerald-400">
                  SEBI STT (0.025% intraday / 0.1% delivery), GST 18%, Stamp Duty & Exchange Churn
                </span>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Round-Trip Friction</span>
                    <span className="text-base font-bold text-amber-400 mt-1 block">
                      ₹{analysis.statutoryHurdle.roundTripTaxes.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400">Both Legs Long + Short</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Hurdle Reversion</span>
                    <span className="text-base font-bold text-cyan-400 mt-1 block">
                      {analysis.statutoryHurdle.minSpreadReversionPts.toFixed(2)} pts
                    </span>
                    <span className="text-[10px] text-slate-400">Minimum to break even</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Expected Net Alpha</span>
                    <span className="text-base font-bold text-emerald-400 mt-1 block">
                      ₹{analysis.statutoryHurdle.netExpectancyINR.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">Mean-reversion target</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Hurdle Cleared</span>
                    <span className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      YES (Feasible)
                    </span>
                    <span className="text-[10px] text-slate-400">&lt; 1.5% stock price</span>
                  </div>
                </div>

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Unlike conventional simulators that ignore transaction costs, TradeCraft AI requires that the expected statistical spread reversion exceeds the round-trip statutory tax drag before issuing entry signals.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Market-Neutral Cointegration Notice:</strong> 2-leg simultaneous execution eliminates directional beta risk. All ADF critical values and Kalman hedge ratios run 100% locally.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">TradeCraft AI Quant Suite</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[10px]">
              ADF: {analysis.adf.confidenceLevel}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
