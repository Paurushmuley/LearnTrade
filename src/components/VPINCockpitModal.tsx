'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  DefensiveHedgerAction,
  KylesLambdaPoint,
  ToxicityRegime,
  VpinEngineSummary,
  VpinTicker,
  VpinVolumeBucket,
} from '../types/vpin';
import {
  computePriceImpactScenario,
  formatToxicityRegimeBadge,
  getVpinEngineSummary,
  TICKER_CONFIG,
} from '../lib/vpinEngine';

export interface VPINCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice?: number;
  onExecuteDefense?: (action: DefensiveHedgerAction) => void;
}

type ActiveWorkspaceView = 'vpin_horizon' | 'kyles_lambda' | 'spread_radar';

export const VPINCockpitModal: React.FC<VPINCockpitModalProps> = ({
  isOpen,
  onClose,
  spotPrice: externalSpotPrice,
  onExecuteDefense,
}) => {
  // Navigation & Workspace View
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('vpin_horizon');

  // Selected Ticker
  const [selectedTicker, setSelectedTicker] = useState<VpinTicker>('NIFTY');

  // Interactive Selected Bucket for Deep Dive
  const [selectedBucketIndex, setSelectedBucketIndex] = useState<number | null>(null);

  // Interactive Lot Size Slider for Kyle's Lambda Price Impact Simulator
  const [simulatedLots, setSimulatedLots] = useState<number>(450);

  // Refresh Trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Defensive Action Executed Feedback State
  const [activeActions, setActiveActions] = useState<Record<string, string>>({});
  const [actionFeedbackNotice, setActionFeedbackNotice] = useState<string | null>(null);

  // Generate quantitative summary
  const summary: VpinEngineSummary = useMemo(() => {
    return getVpinEngineSummary(selectedTicker, externalSpotPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicker, externalSpotPrice, refreshKey]);

  // Selected bucket details
  const activeBucket: VpinVolumeBucket = useMemo(() => {
    if (selectedBucketIndex !== null) {
      const found = summary.buckets.find((b) => b.bucketIndex === selectedBucketIndex);
      if (found) return found;
    }
    return summary.buckets[summary.buckets.length - 1];
  }, [summary.buckets, selectedBucketIndex]);

  // Regime styling
  const regimeBadge = useMemo(() => {
    return formatToxicityRegimeBadge(summary.regime);
  }, [summary.regime]);

  // Simulated price impact metrics
  const impactScenario = useMemo(() => {
    return computePriceImpactScenario(simulatedLots, summary.kylesLambda, summary.spotPrice);
  }, [simulatedLots, summary.kylesLambda, summary.spotPrice]);

  // Handle defense execution
  const handleExecuteDefense = useCallback(
    (rec: DefensiveHedgerAction) => {
      setActiveActions((prev) => ({
        ...prev,
        [rec.id]: 'EXECUTED',
      }));

      setActionFeedbackNotice(
        `Defense Armed: [${rec.actionType}] - ${rec.details.slice(0, 65)}... (Simulated Fill OK)`
      );

      if (onExecuteDefense) {
        onExecuteDefense(rec);
      }

      setTimeout(() => {
        setActionFeedbackNotice(null);
      }, 5000);
    },
    [onExecuteDefense]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col bg-[#0B0E14] border border-slate-800 rounded-2xl shadow-2xl shadow-cyan-950/30 overflow-hidden text-slate-100 font-sans">
        {/* MODAL HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-amber-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>VPIN & Informed Order Flow Microstructure Cockpit</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-semibold">
                    Sprint 25
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>Volume-Synchronized Probability of Toxicity (VPIN) • Kyle&apos;s Lambda • Glosten-Milgrom Spread</span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-slate-400 font-mono hidden sm:inline">{TICKER_CONFIG[selectedTicker].name}</span>
              </p>
            </div>
          </div>

          {/* Ticker Selector, Refresh & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
              {(['NIFTY', 'BANKNIFTY', 'RELIANCE'] as VpinTicker[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setSelectedTicker(t);
                    setSelectedBucketIndex(null);
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    selectedTicker === t
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Recalculate Microstructure Feed"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Close Cockpit (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* FEEDBACK NOTICE BANNER (IF ACTIVE) */}
        {actionFeedbackNotice && (
          <div className="px-5 py-2.5 bg-cyan-950/70 border-b border-cyan-800/80 flex items-center justify-between text-xs text-cyan-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span>{actionFeedbackNotice}</span>
            </div>
            <button
              onClick={() => setActionFeedbackNotice(null)}
              className="text-cyan-400 hover:text-cyan-200 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* QUICK METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-4 border-b border-slate-800/80 bg-slate-900/30 text-xs">
          {/* 1. Spot Price */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>{selectedTicker} Spot</span>
              <Target className="h-3 w-3 text-cyan-400" />
            </div>
            <div className="text-sm font-extrabold text-slate-100 mt-1 font-mono">
              ₹{summary.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
              <span>Bucket:</span>
              <span className="text-cyan-300 font-bold">{summary.bucketSizeLots} Lots</span>
            </div>
          </div>

          {/* 2. Current VPIN Score */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Current VPIN</span>
              <Flame className="h-3 w-3 text-amber-400" />
            </div>
            <div className="text-sm font-extrabold text-amber-300 mt-1 font-mono flex items-baseline gap-1">
              <span>{summary.currentVpin.toFixed(4)}</span>
              <span className="text-[10px] text-slate-400">/ 1.0000</span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  summary.currentVpin >= 0.7
                    ? 'bg-rose-500'
                    : summary.currentVpin >= 0.55
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, summary.currentVpin * 100)}%` }}
              />
            </div>
          </div>

          {/* 3. Toxicity Regime Badge */}
          <div className={`border rounded-xl p-2.5 ${regimeBadge.bg} ${regimeBadge.border}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between">
              <span className={regimeBadge.text}>Toxicity Regime</span>
              <span className={`h-2 w-2 rounded-full ${regimeBadge.badgeDot}`} />
            </div>
            <div className={`text-xs font-black mt-1 uppercase tracking-tight ${regimeBadge.text}`}>
              {regimeBadge.label}
            </div>
            <span className="text-[9px] text-slate-300 block truncate mt-0.5">
              {summary.regime === 'CRITICAL_TOXIC_FLOW'
                ? 'High Flash Crash Risk'
                : summary.regime === 'ELEVATED'
                ? 'Informed Flow Sweep'
                : 'Balanced Liquidity'}
            </span>
          </div>

          {/* 4. Toxicity Percentile */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Toxicity Percentile</span>
              <Percent className="h-3 w-3 text-purple-400" />
            </div>
            <div className="text-sm font-extrabold text-purple-300 mt-1 font-mono">
              {summary.toxicityPercentile}th %ile
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>vs 30-Day Median</span>
              <span className="text-slate-600">•</span>
              <span className={summary.toxicityPercentile > 75 ? 'text-rose-400' : 'text-emerald-400'}>
                {summary.toxicityPercentile > 75 ? 'Top Quartile' : 'Normal'}
              </span>
            </div>
          </div>

          {/* 5. Kyle's Lambda Impact */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Kyle&apos;s Lambda (λ)</span>
              <Scale className="h-3 w-3 text-blue-400" />
            </div>
            <div className="text-sm font-extrabold text-blue-300 mt-1 font-mono">
              ₹{summary.kylesLambda.toFixed(4)}
              <span className="text-[10px] text-slate-400 font-normal"> / Lot</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Price impact slope</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-300 font-mono">ΔP/ΔQ</span>
            </div>
          </div>

          {/* 6. Defensive Spread Multiplier */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Defensive Spread</span>
              <ShieldAlert className="h-3 w-3 text-rose-400" />
            </div>
            <div className="text-sm font-extrabold text-amber-300 mt-1 font-mono">
              {summary.defensiveSpreadMultiplier}x
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Quoted:</span>
              <span className="text-slate-200 font-mono font-bold">
                ₹{summary.spreadDecomposition.quotedSpreadRupees} ({summary.spreadDecomposition.quotedSpreadBps} bps)
              </span>
            </div>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="border-b border-slate-800 bg-slate-950/50 px-5 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('vpin_horizon')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeView === 'vpin_horizon'
                  ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>VPIN Volume-Clock Horizon</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-900/40 text-cyan-300 border border-cyan-700/50 font-mono">
                {summary.buckets.length} Buckets
              </span>
            </button>

            <button
              onClick={() => setActiveView('kyles_lambda')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeView === 'kyles_lambda'
                  ? 'border-blue-500 text-blue-300 bg-blue-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Kyle&apos;s Lambda & Price Impact Curve</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700/50 font-mono">
                Hasbrouck Split
              </span>
            </button>

            <button
              onClick={() => setActiveView('spread_radar')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeView === 'spread_radar'
                  ? 'border-rose-500 text-rose-300 bg-rose-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Gauge className="h-4 w-4" />
              <span>Spread Decomposition & MM Radar</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-900/40 text-rose-300 border border-rose-700/50 font-mono">
                {summary.flashCrashRadar.earlyWarningStatus}
              </span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Low &lt;0.35
            </span>
            <span className="flex items-center gap-1 font-mono">
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Alert 0.55
            </span>
            <span className="flex items-center gap-1 font-mono">
              <span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Critical &gt;0.70
            </span>
          </div>
        </div>

        {/* WORKSPACE CONTENT BODY */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto">
          {/* VIEW 1: VPIN VOLUME-CLOCK HORIZON */}
          {activeView === 'vpin_horizon' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Top Horizon Chart Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-cyan-400" />
                      <span>Volume-Synchronized Rolling VPIN Time Horizon (Easley et al. Model)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Information toxicity sampled across uniform volume buckets of {summary.bucketSizeLots} contracts.
                      Threshold alerts trigger automated quote widening.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                      Window: N = {summary.rollingBucketWindow} Buckets
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-950/50 border border-cyan-800/60 text-cyan-300 font-bold">
                      Current: {summary.currentVpin.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* SVG Horizon Chart */}
                <div className="w-full h-64 sm:h-72 bg-slate-900/40 border border-slate-800/80 rounded-xl relative overflow-hidden flex flex-col justify-end p-2 sm:p-4">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 240">
                    <defs>
                      <linearGradient id="vpinGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                        <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#f43f5e" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1="0" y1="40" x2="800" y2="40" stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="90" x2="800" y2="90" stroke="#e11d48" strokeDasharray="5 5" strokeWidth="1.2" opacity="0.7" />
                    <line x1="0" y1="135" x2="800" y2="135" stroke="#d97706" strokeDasharray="5 5" strokeWidth="1.2" opacity="0.7" />
                    <line x1="0" y1="190" x2="800" y2="190" stroke="#10b981" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />

                    {/* Threshold Labels */}
                    <text x="12" y="85" fill="#f43f5e" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      CRITICAL FLASH CRASH THRESHOLD (0.70)
                    </text>
                    <text x="12" y="130" fill="#f59e0b" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      ELEVATED TOXICITY ALERT (0.55)
                    </text>
                    <text x="12" y="185" fill="#10b981" fontSize="10" fontFamily="monospace">
                      CALM TWO-SIDED FLOW (&lt;0.35)
                    </text>

                    {/* Area fill path */}
                    {(() => {
                      const points = summary.horizonSeries;
                      if (!points.length) return null;
                      const stepX = 800 / (points.length - 1);
                      const coords = points.map((pt, i) => {
                        const x = i * stepX;
                        // Map VPIN [0.0, 1.0] to y [230, 10]
                        const y = 230 - pt.vpinScore * 210;
                        return { x, y, pt };
                      });

                      const pathD = `M 0 230 L ${coords.map((c) => `${c.x} ${c.y}`).join(' L ')} L 800 230 Z`;
                      const strokeD = `M ${coords.map((c) => `${c.x} ${c.y}`).join(' L ')}`;

                      return (
                        <>
                          <path d={pathD} fill="url(#vpinGradient)" />
                          <path d={strokeD} fill="none" stroke="url(#lineGlow)" strokeWidth="3" strokeLinecap="round" />
                          {coords.map((c, i) => (
                            <circle
                              key={i}
                              cx={c.x}
                              cy={c.y}
                              r={i === coords.length - 1 ? 5 : 3}
                              fill={c.pt.vpinScore >= 0.7 ? '#f43f5e' : c.pt.vpinScore >= 0.55 ? '#f59e0b' : '#06b6d4'}
                              stroke="#0B0E14"
                              strokeWidth="2"
                              className="cursor-pointer hover:scale-150 transition"
                              onClick={() => setSelectedBucketIndex(c.pt.bucketIndex)}
                            />
                          ))}
                        </>
                      );
                    })()}
                  </svg>

                  {/* Horizontal Time Labels */}
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800">
                    <span>{summary.horizonSeries[0]?.timestamp || '09:15'} (Open)</span>
                    <span>11:30 (Midday)</span>
                    <span>13:45 (European Cross)</span>
                    <span>{summary.horizonSeries[summary.horizonSeries.length - 1]?.timestamp || '15:30'} (Current)</span>
                  </div>
                </div>
              </div>

              {/* Volume Bucket Ladder & Bucket Inspector */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Volume Bucket Bar Ladder (2 cols) */}
                <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-emerald-400" />
                        <span>Volume Bucket Asymmetry Ladder (Buy vs Sell Imbalance)</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Each bar displays buy vs sell composition in the {summary.bucketSizeLots} lot volume bucket.
                        Click any bucket to inspect micro-price metrics.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Buy Vol
                      </span>
                      <span className="flex items-center gap-1 text-rose-400">
                        <span className="h-2 w-2 rounded-sm bg-rose-500" /> Sell Vol
                      </span>
                    </div>
                  </div>

                  {/* Ladder Scrollable Container */}
                  <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                    {summary.buckets.map((b) => {
                      const buyPct = Math.round((b.buyVolume / b.volumeTotal) * 100);
                      const sellPct = 100 - buyPct;
                      const isSelected = activeBucket.bucketIndex === b.bucketIndex;

                      return (
                        <div
                          key={b.bucketIndex}
                          onClick={() => setSelectedBucketIndex(b.bucketIndex)}
                          className={`p-2 rounded-xl border text-xs cursor-pointer transition flex items-center gap-3 ${
                            isSelected
                              ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-950/30'
                              : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                          }`}
                        >
                          {/* Bucket Index & Time */}
                          <div className="w-20 font-mono text-[11px] text-slate-400 flex flex-col flex-shrink-0">
                            <span className="text-slate-200 font-bold">Bucket #{b.bucketIndex}</span>
                            <span className="text-[10px]">{b.timestamp}</span>
                          </div>

                          {/* Split Bar */}
                          <div className="flex-1 flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className="text-emerald-400">{b.buyVolume.toLocaleString()} lots ({buyPct}%)</span>
                              <span className="text-rose-400">{sellPct}% ({b.sellVolume.toLocaleString()} lots)</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${buyPct}%` }}
                                className="bg-emerald-500 h-full transition-all"
                              />
                              <div
                                style={{ width: `${sellPct}%` }}
                                className="bg-rose-500 h-full transition-all"
                              />
                            </div>
                          </div>

                          {/* Imbalance & Tag */}
                          <div className="w-28 text-right flex flex-col flex-shrink-0 font-mono">
                            <span className="text-xs font-bold text-slate-100">
                              |Δ| {b.absoluteImbalance.toLocaleString()}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                b.isAggressiveSweep
                                  ? 'text-rose-400 flex items-center justify-end gap-1'
                                  : 'text-slate-400'
                              }`}
                            >
                              {b.isAggressiveSweep && <Flame className="h-3 w-3 text-rose-500" />}
                              {b.isAggressiveSweep ? 'TOXIC SWEEP' : 'BALANCED'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Single Bucket Inspector Card (1 col) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Bucket Deep Dive</span>
                        <h4 className="text-sm font-bold text-slate-100">
                          Bucket #{activeBucket.bucketIndex} ({activeBucket.timestamp})
                        </h4>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                          activeBucket.isAggressiveSweep
                            ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                            : 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                        }`}
                      >
                        {activeBucket.isAggressiveSweep ? 'SWEEP ALERT' : 'NORMAL'}
                      </span>
                    </div>

                    <div className="space-y-3 mt-4 text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                        <span className="text-slate-400">Bucket Volume</span>
                        <span className="font-mono font-bold text-slate-200">
                          {activeBucket.volumeTotal.toLocaleString()} lots
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                        <span className="text-slate-400">Buy / Sell Partition</span>
                        <span className="font-mono text-slate-200">
                          <span className="text-emerald-400 font-bold">{activeBucket.buyVolume}</span> /{' '}
                          <span className="text-rose-400 font-bold">{activeBucket.sellVolume}</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                        <span className="text-slate-400">Order Flow Imbalance (|V_B - V_S|)</span>
                        <span className="font-mono font-bold text-amber-300">
                          {activeBucket.absoluteImbalance.toLocaleString()} lots
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                        <span className="text-slate-400">Signed Imbalance Ratio</span>
                        <span
                          className={`font-mono font-bold ${
                            activeBucket.imbalanceRatio > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {activeBucket.imbalanceRatio > 0 ? '+' : ''}
                          {(activeBucket.imbalanceRatio * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                        <span className="text-slate-400">Price at Bucket Close</span>
                        <span className="font-mono font-bold text-cyan-300">
                          ₹{activeBucket.endPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                        <span className="text-slate-400">Intra-Bucket Price Delta</span>
                        <span
                          className={`font-mono font-bold flex items-center gap-1 ${
                            activeBucket.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {activeBucket.priceChange >= 0 ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          ₹{Math.abs(activeBucket.priceChange).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                    <span className="font-bold text-slate-300 block mb-1">Microstructure Insight:</span>
                    {activeBucket.isAggressiveSweep
                      ? 'High imbalance ratio indicates rapid liquidity depletion by institutional execution algorithms. Recommend widening quotation spread.'
                      : 'Order flow matches continuous two-sided liquidity equilibrium with noise trader participation.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: KYLE'S LAMBDA & PRICE IMPACT CURVE */}
          {activeView === 'kyles_lambda' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Scatter Plot & Regression Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                      <span>Kyle&apos;s Lambda Regression & Signed Volume Price Impact (Kyle 1985)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Empirical linear relationship ΔP = λ · Q + ε. Slope λ measures price sensitivity per lot traded.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-800 text-blue-300 font-bold">
                      λ = ₹{summary.kylesLambda.toFixed(4)} / Lot
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                      R² = 0.842
                    </span>
                  </div>
                </div>

                {/* SVG Scatter & Regression Line */}
                <div className="w-full h-64 sm:h-72 bg-slate-900/40 border border-slate-800/80 rounded-xl relative p-3 flex flex-col justify-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 800 240">
                    <defs>
                      <linearGradient id="scatterGrid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#0f172a" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>

                    {/* Coordinate axes centered at X=400, Y=120 */}
                    <line x1="0" y1="120" x2="800" y2="120" stroke="#475569" strokeWidth="1.2" />
                    <line x1="400" y1="0" x2="400" y2="240" stroke="#475569" strokeWidth="1.2" />

                    {/* Axis Labels */}
                    <text x="730" y="115" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                      + Buy Lots
                    </text>
                    <text x="15" y="115" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                      - Sell Lots
                    </text>
                    <text x="410" y="20" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                      + ΔP (₹)
                    </text>
                    <text x="410" y="230" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                      - ΔP (₹)
                    </text>

                    {/* Kyle Regression Slope Line: from (-2500 lots, -2500*lambda) to (+2500 lots, +2500*lambda) */}
                    {/* Scale: X: 400 + (signedVol / 3000) * 380, Y: 120 - (priceDelta / 200) * 100 */}
                    <line
                      x1="40"
                      y1="210"
                      x2="760"
                      y2="30"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                    />

                    {/* Scatter Points */}
                    {summary.lambdaScatterPoints.map((pt, i) => {
                      const cx = 400 + (pt.signedVolume / 2800) * 360;
                      const cy = 120 - (pt.observedPriceDelta / 150) * 100;
                      const color =
                        pt.participantType === 'INSTITUTIONAL_SWEEP'
                          ? '#f43f5e'
                          : pt.participantType === 'INFORMED_HFT'
                          ? '#f59e0b'
                          : pt.participantType === 'RETAIL_FLOW'
                          ? '#38bdf8'
                          : '#10b981';

                      return (
                        <g key={i} className="cursor-pointer">
                          <circle
                            cx={cx}
                            cy={cy}
                            r={pt.participantType === 'INSTITUTIONAL_SWEEP' ? 5 : 3.5}
                            fill={color}
                            opacity={0.85}
                            stroke="#0B0E14"
                            strokeWidth="1.5"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Scatter Legend */}
                  <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-500" /> Institutional Sweep
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Informed HFT
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-400" /> Retail Flow
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Passive MM
                      </span>
                    </div>
                    <span className="text-cyan-400 font-bold">Regression: ΔP = {summary.kylesLambda} · Q</span>
                  </div>
                </div>
              </div>

              {/* Hasbrouck Permanent vs Temporary Split & Interactive Impact Simulator */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Hasbrouck Decomposition (1991) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-purple-400" />
                        <span>Hasbrouck Impact Decomposition (Permanent vs Temporary)</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Permanent impact represents new information learned by the market; temporary impact is transitory inventory liquidity friction.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mt-4">
                    {/* Visual Bar Comparison */}
                    <div>
                      <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                        <span className="text-purple-300 font-bold">Permanent Impact (68%)</span>
                        <span className="text-blue-300 font-bold">Temporary Concession (32%)</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                        <div style={{ width: '68%' }} className="bg-purple-500 h-full" />
                        <div style={{ width: '32%' }} className="bg-blue-500 h-full" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40">
                        <span className="text-[10px] font-semibold text-purple-300 uppercase block">
                          Permanent Information
                        </span>
                        <span className="text-base font-extrabold text-purple-200 font-mono mt-1 block">
                          ₹{(summary.kylesLambda * 0.68).toFixed(4)} / lot
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          Unreversed price displacement. Reflects private alpha embedded into the central limit order book.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40">
                        <span className="text-[10px] font-semibold text-blue-300 uppercase block">
                          Temporary Concession
                        </span>
                        <span className="text-base font-extrabold text-blue-200 font-mono mt-1 block">
                          ₹{(summary.kylesLambda * 0.32).toFixed(4)} / lot
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          Reversible bid-ask bounce and inventory risk premium demanded by risk-averse liquidity providers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Order Size Impact Simulator */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-cyan-400" />
                        <span>Instantaneous Price Impact Simulator</span>
                      </h4>
                      <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                        {simulatedLots} Lots
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                      Simulate market impact and adverse selection slippage for executing meta-orders of varying sizes.
                    </p>

                    {/* Slider */}
                    <div className="space-y-1.5 mb-5">
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>50 Lots</span>
                        <span>2,500 Lots</span>
                        <span>5,000 Lots</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="5000"
                        step="50"
                        value={simulatedLots}
                        onChange={(e) => setSimulatedLots(Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                      />
                    </div>

                    {/* Impact Breakdown Cards */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Total Slippage</span>
                        <span className="text-sm font-extrabold text-rose-300 font-mono mt-0.5 block">
                          ₹{impactScenario.totalSlippageRupees}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {impactScenario.totalSlippageBps} bps
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Permanent ΔP</span>
                        <span className="text-sm font-extrabold text-purple-300 font-mono mt-0.5 block">
                          ₹{impactScenario.permanentImpactRupees}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Kyle linear</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Adverse Fill Prob</span>
                        <span className="text-sm font-extrabold text-amber-300 font-mono mt-0.5 block">
                          {impactScenario.adverseExecutionProbability}%
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Queue Sweep</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      Recommended Routing: Almgren-Chriss TWAP (slicing into {Math.max(4, Math.round(simulatedLots / 80))} child slices)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: SPREAD DECOMPOSITION & MM RADAR */}
          {activeView === 'spread_radar' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Spread Decomposition Card (Glosten-Milgrom 1985 & Stoll 1989) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-emerald-400" />
                      <span>Glosten-Milgrom & Stoll Bid-Ask Spread Microstructure Decomposition</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Decomposing quoted spread of ₹{summary.spreadDecomposition.quotedSpreadRupees} ({summary.spreadDecomposition.quotedSpreadBps} bps)
                      into Informed Adverse Selection, Inventory Holding Risk, and Order Processing costs.
                    </p>
                  </div>
                  <div className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
                    Defensive Spread: {summary.defensiveSpreadMultiplier}x Base
                  </div>
                </div>

                {/* 3-Part Stacked Bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-rose-400">
                      Adverse Selection ({summary.spreadDecomposition.adverseSelectionPct}%)
                    </span>
                    <span className="text-amber-400">
                      Inventory Holding ({summary.spreadDecomposition.inventoryHoldingPct}%)
                    </span>
                    <span className="text-cyan-400">
                      Order Processing ({summary.spreadDecomposition.orderProcessingPct}%)
                    </span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${summary.spreadDecomposition.adverseSelectionPct}%` }}
                      className="bg-rose-500 h-full transition-all"
                    />
                    <div
                      style={{ width: `${summary.spreadDecomposition.inventoryHoldingPct}%` }}
                      className="bg-amber-500 h-full transition-all"
                    />
                    <div
                      style={{ width: `${summary.spreadDecomposition.orderProcessingPct}%` }}
                      className="bg-cyan-500 h-full transition-all"
                    />
                  </div>
                </div>

                {/* Metric Columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-300 uppercase">
                        1. Adverse Selection (α)
                      </span>
                      <ShieldAlert className="h-4 w-4 text-rose-400" />
                    </div>
                    <span className="text-lg font-black text-rose-200 font-mono mt-1 block">
                      ₹{summary.spreadDecomposition.adverseSelectionRupees}
                    </span>
                    <span className="text-[10px] text-rose-300/80 font-mono">
                      {summary.spreadDecomposition.adverseSelectionPct}% of quoted spread
                    </span>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                      Compensation demanded by market makers to absorb toxic flow from informed counter-parties (Glosten-Milgrom 1985).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 uppercase">
                        2. Inventory Holding Risk
                      </span>
                      <Activity className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-lg font-black text-amber-200 font-mono mt-1 block">
                      ₹{summary.spreadDecomposition.inventoryHoldingRupees}
                    </span>
                    <span className="text-[10px] text-amber-300/80 font-mono">
                      {summary.spreadDecomposition.inventoryHoldingPct}% of quoted spread
                    </span>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                      Ho-Stoll inventory penalty for carrying non-zero overnight positioning and overnight gap risk.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-cyan-300 uppercase">
                        3. Order Processing & Fees
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                    </div>
                    <span className="text-lg font-black text-cyan-200 font-mono mt-1 block">
                      ₹{summary.spreadDecomposition.orderProcessingRupees}
                    </span>
                    <span className="text-[10px] text-cyan-300/80 font-mono">
                      {summary.spreadDecomposition.orderProcessingPct}% of quoted spread
                    </span>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                      Co-location server hosting, exchange turnover fees, SEBI clearing tariffs, STT, and baseline profit margin.
                    </p>
                  </div>
                </div>
              </div>

              {/* Flash Crash Early Warning Radar & 1-Click Defensive Hedger Card */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Flash Crash Early Warning Gauge */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-rose-400" />
                          <span>Real-Time Flash Crash Early Warning Radar</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Multi-metric microstructure monitor detecting liquidity black holes and quote fade.
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold font-mono border ${
                          summary.flashCrashRadar.earlyWarningStatus === 'IMMINENT_CRASH_WARNING'
                            ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                            : summary.flashCrashRadar.earlyWarningStatus === 'ELEVATED_RISK'
                            ? 'bg-amber-950 text-amber-300 border-amber-600'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        }`}
                      >
                        {summary.flashCrashRadar.earlyWarningStatus}
                      </span>
                    </div>

                    {/* Gauge Metrics */}
                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Cancel-to-Fill Ratio</span>
                        <span className="text-base font-extrabold text-slate-100 font-mono mt-0.5 block">
                          {summary.flashCrashRadar.cancelToFillRatio}:1
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {summary.flashCrashRadar.cancelToFillRatio > 30 ? 'Phantom Liquidity' : 'Normal'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Book Depletion Velocity</span>
                        <span className="text-base font-extrabold text-rose-300 font-mono mt-0.5 block">
                          {summary.flashCrashRadar.bookDepletionVelocityPct}% / sec
                        </span>
                        <span className="text-[10px] text-slate-500">Queue Drain Rate</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Quote Fade Latency</span>
                        <span className="text-base font-extrabold text-cyan-300 font-mono mt-0.5 block">
                          {summary.flashCrashRadar.quoteFadeLatencyMs} ms
                        </span>
                        <span className="text-[10px] text-slate-500">MM Reaction Time</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Composite Toxicity</span>
                        <span className="text-base font-extrabold text-amber-300 font-mono mt-0.5 block">
                          {summary.flashCrashRadar.compositeToxicityScore} / 100
                        </span>
                        <span className="text-[10px] text-slate-500">Easley Risk Score</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-[11px] text-rose-300/90 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                    <span>
                      Action Recommended: {summary.flashCrashRadar.recommendedQuoteAction}. Auto-defense protocol stands ready.
                    </span>
                  </div>
                </div>

                {/* 1-Click Defensive Hedger / Quote Pull Action Card */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-cyan-400" />
                        <span>Market Maker Defensive Hedger & Quote Pull</span>
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-950 border border-cyan-800 text-cyan-300">
                        1-Click Action
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                      Direct algorithm instructions to immunize market-making books against adverse selection during toxic sweeps.
                    </p>

                    {/* Action Items List */}
                    <div className="space-y-2.5">
                      {summary.defensiveRecommendations.map((rec) => {
                        const isExecuted = activeActions[rec.id] === 'EXECUTED';

                        return (
                          <div
                            key={rec.id}
                            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-100 font-mono">{rec.actionType}</span>
                                {rec.hedgeContracts > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 border border-blue-800 text-blue-300 font-mono">
                                    {rec.hedgeContracts} Lots
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{rec.details}</p>
                            </div>

                            <button
                              onClick={() => handleExecuteDefense(rec)}
                              disabled={isExecuted}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                isExecuted
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60 cursor-default'
                                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold shadow-md shadow-cyan-500/20 active:scale-95'
                              }`}
                            >
                              {isExecuted ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>ARMED</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>EXECUTE</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Audit Trail: Sub-12ms synthetic FIX drop copy verified</span>
                    <span className="text-cyan-400">Zero Real Capital Risk</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            <span>
              Microstructure Engine: Easley-López de Prado VPIN (2012) • Kyle&apos;s Lambda (1985) • Glosten-Milgrom (1985)
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Active Ticker: <strong className="text-slate-200">{selectedTicker}</strong></span>
            <span className="text-slate-600">•</span>
            <span>Status: <strong className="text-emerald-400">FEED_ONLINE</strong></span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-semibold ml-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
