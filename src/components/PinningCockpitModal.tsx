'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crosshair,
  HelpCircle,
  Info,
  Layers,
  Magnet,
  Percent,
  RefreshCw,
  Scale,
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
  GexRegime,
  IntradayThetaPoint,
  PinningEngineSummary,
  PinRiskHedgeLeg,
  PinRiskHedgeRecommendation,
  StrikeGexDetail,
  StrikePainDetail,
  TerminalStrikePinning,
} from '../types/pinning';
import {
  formatGexRegimeBadge,
  formatRupeeCr,
  formatStrike,
  getPinningEngineSummary,
} from '../lib/pinningEngine';

export type SupportedPinningTicker = 'NIFTY 50' | 'BANKNIFTY' | 'FINNIFTY';

interface PinningCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice?: number;
  onExecuteHedge?: (rec: PinRiskHedgeRecommendation) => void;
}

type ActiveWorkspaceView = 'dealer_gex' | 'max_pain_tracker' | 'pinning_simulator';

export const PinningCockpitModal: React.FC<PinningCockpitModalProps> = ({
  isOpen,
  onClose,
  spotPrice: externalSpotPrice,
  onExecuteHedge,
}) => {
  // Navigation & Workspace View
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('dealer_gex');

  // Selected Ticker
  const [selectedTicker, setSelectedTicker] = useState<SupportedPinningTicker>('NIFTY 50');

  // Intraday minutes remaining slider (375 at 09:15 down to 0 at 15:30)
  // Default to ~105 min remaining (~13:45 IST)
  const [minutesRemaining, setMinutesRemaining] = useState<number>(105);

  // Hovered Strike for Deep Dive
  const [hoveredStrike, setHoveredStrike] = useState<number | null>(null);

  // Hedge Armed State Feedback
  const [hedgeExecutionStatus, setHedgeExecutionStatus] = useState<string | null>(null);

  // Refresh Trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Convert minutes remaining to IST Time string (09:15 to 15:30 is 375 minutes)
  const timeSliderString = useMemo(() => {
    const minutesElapsed = Math.max(0, Math.min(375, 375 - minutesRemaining));
    const startTotalMinutes = 9 * 60 + 15;
    const currentTotalMinutes = startTotalMinutes + minutesElapsed;
    const hours = Math.floor(currentTotalMinutes / 60);
    const mins = currentTotalMinutes % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    return `${hh}:${mm} IST`;
  }, [minutesRemaining]);

  // Aggregate quantitative summary
  const summary: PinningEngineSummary = useMemo(() => {
    const defaultSpot =
      selectedTicker === 'BANKNIFTY'
        ? 52150
        : selectedTicker === 'FINNIFTY'
        ? 23820
        : 24520;
    const spot =
      selectedTicker === 'NIFTY 50' && externalSpotPrice
        ? externalSpotPrice
        : defaultSpot;
    const lotSize = selectedTicker === 'BANKNIFTY' ? 15 : 25;
    const baseIv = selectedTicker === 'BANKNIFTY' ? 0.172 : selectedTicker === 'FINNIFTY' ? 0.145 : 0.138;

    return getPinningEngineSummary(
      selectedTicker,
      undefined,
      spot,
      lotSize,
      undefined,
      minutesRemaining,
      baseIv
    );
  }, [selectedTicker, externalSpotPrice, minutesRemaining, refreshKey]);

  // Handle 1-Click Pin Risk Hedge Execution
  const handleArmHedge = useCallback(() => {
    if (onExecuteHedge) {
      onExecuteHedge(summary.hedgeRecommendation);
    }
    setHedgeExecutionStatus(
      `ARMED: ${summary.hedgeRecommendation.strategyName} deployed on ${summary.symbol}`
    );
    setTimeout(() => {
      setHedgeExecutionStatus(null);
    }, 4500);
  }, [onExecuteHedge, summary]);

  if (!isOpen) return null;

  const regimeBadge = formatGexRegimeBadge(summary.gex.gexRegime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl max-h-[92vh] flex flex-col bg-[#0B0E17] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* MODAL HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-600 via-rose-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Magnet className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Options Gamma Squeeze & 0-DTE Pinning Risk Engine</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-semibold">
                    Sprint 24
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Real-Time Institutional Market-Maker Gamma Exposure & Terminal Strike Magnet</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-mono">{timeSliderString}</span>
              </p>
            </div>
          </div>

          {/* Ticker Selector & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
              {(['NIFTY 50', 'BANKNIFTY', 'FINNIFTY'] as SupportedPinningTicker[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTicker(t)}
                  className={`px-3 py-1 rounded-lg transition ${
                    selectedTicker === t
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.replace(' 50', '')}
                </button>
              ))}
            </div>

            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Refresh Gamma Feed"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Close Modal (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* QUICK METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-4 border-b border-slate-800/80 bg-slate-900/30 text-xs">
          {/* 1. Spot Price */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>{summary.symbol} Spot</span>
              <Target className="h-3 w-3 text-cyan-400" />
            </div>
            <div className="text-sm font-extrabold text-slate-100 mt-1 font-mono">
              ₹{formatStrike(summary.spotPrice)}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Lot: {summary.lotSize}</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-mono">1% Move: ₹{Math.round(summary.spotPrice * 0.01)}</span>
            </div>
          </div>

          {/* 2. Aggregate Net GEX */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Aggregate Net GEX</span>
              <BarChart3 className="h-3 w-3 text-purple-400" />
            </div>
            <div
              className={`text-sm font-extrabold mt-1 font-mono ${
                summary.gex.netGex >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatRupeeCr(summary.gex.netGex)}/1%
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              Calls: ₹{summary.gex.totalCallGex.toFixed(0)} | Puts: ₹{summary.gex.totalPutGex.toFixed(0)} Cr
            </div>
          </div>

          {/* 3. Current Gamma Regime Badge */}
          <div
            className={`border rounded-xl p-2.5 ${
              summary.gex.gexRegime === 'LONG_GAMMA'
                ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-300'
                : summary.gex.gexRegime === 'SHORT_GAMMA'
                ? 'bg-rose-950/20 border-rose-800/50 text-rose-300'
                : 'bg-amber-950/20 border-amber-800/50 text-amber-300'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Gamma Regime</span>
              {summary.gex.gexRegime === 'LONG_GAMMA' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Zap className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              )}
            </div>
            <div className="text-xs font-black mt-1 uppercase tracking-tight flex items-center gap-1">
              <span>{regimeBadge.label}</span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
              {summary.gex.gexRegime === 'LONG_GAMMA'
                ? 'Volatility Dampening'
                : 'Squeeze Vulnerability ' + summary.gex.squeezeVulnerability}
            </span>
          </div>

          {/* 4. Gamma Flip Level */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Gamma Flip Level</span>
              <Scale className="h-3 w-3 text-amber-400" />
            </div>
            <div className="text-sm font-extrabold text-amber-300 mt-1 font-mono">
              ₹{formatStrike(summary.gex.gammaFlipLevel)}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
              <span>Distance:</span>
              <span className={summary.gex.isSpotAboveFlip ? 'text-emerald-400' : 'text-rose-400'}>
                {summary.gex.distanceToFlipPoints >= 0 ? '+' : ''}
                {summary.gex.distanceToFlipPoints} pts ({summary.gex.distanceToFlipPercent}%)
              </span>
            </div>
          </div>

          {/* 5. Current Max Pain Strike */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Max Pain Strike</span>
              <Activity className="h-3 w-3 text-rose-400" />
            </div>
            <div className="text-sm font-extrabold text-slate-100 mt-1 font-mono">
              ₹{formatStrike(summary.maxPain.currentMaxPainStrike)}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
              <span>Dist:</span>
              <span className={summary.maxPain.spotDistancePoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {summary.maxPain.spotDistancePoints >= 0 ? '+' : ''}
                {summary.maxPain.spotDistancePoints} pts
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-purple-300">{summary.maxPain.migrationDirection}</span>
            </div>
          </div>

          {/* 6. Highest Pinning Probability Strike */}
          <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>Pin Magnet Strike</span>
              <Magnet className="h-3 w-3 text-amber-400" />
            </div>
            <div className="text-sm font-extrabold text-amber-300 mt-1 font-mono flex items-baseline justify-between">
              <span>₹{formatStrike(summary.pinning.mostLikelyPinnedStrike)}</span>
              <span className="text-xs font-bold text-amber-400">
                {summary.pinning.pinningProbability}%
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Confidence:</span>
              <span className="text-emerald-400 font-mono font-bold">
                {summary.pinning.pinningConfidence}
              </span>
            </div>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="border-b border-slate-800 bg-slate-950/50 px-5 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('dealer_gex')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeView === 'dealer_gex'
                  ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Dealer GEX & Gamma Flip Profile</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 font-mono">
                {summary.gex.strikeGexList.length} Strikes
              </span>
            </button>

            <button
              onClick={() => setActiveView('max_pain_tracker')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeView === 'max_pain_tracker'
                  ? 'border-purple-500 text-purple-300 bg-purple-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Dynamic Max Pain Migration</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono border bg-purple-950/60 text-purple-300 border-purple-800/60">
                ₹{summary.maxPain.totalBuyerLossCr} Cr Loss
              </span>
            </button>

            <button
              onClick={() => setActiveView('pinning_simulator')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeView === 'pinning_simulator'
                  ? 'border-amber-500 text-amber-300 bg-amber-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Magnet className="h-4 w-4" />
              <span>0-DTE Expiry Pinning & Theta Simulator</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-900/40 text-amber-300 border border-amber-700/50 font-mono">
                Decay {summary.thetaSchedule.currentPoint.thetaDecayPercent}%
              </span>
            </button>
          </div>

          {/* Intraday Time Slider Quick Control */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl my-1 text-xs">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Expiry Clock:
            </span>
            <input
              type="range"
              min="0"
              max="375"
              step="5"
              value={375 - minutesRemaining}
              onChange={(e) => setMinutesRemaining(375 - parseInt(e.target.value, 10))}
              className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="font-mono text-amber-300 font-bold text-xs">{timeSliderString}</span>
          </div>
        </div>

        {/* WORKSPACE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0A0D14]">
          {hedgeExecutionStatus && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-500/50 rounded-xl flex items-center justify-between text-emerald-300 text-xs animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>{hedgeExecutionStatus}</span>
              </div>
              <span className="text-[10px] text-emerald-400/80 uppercase font-mono">
                Order Ticket Populated
              </span>
            </div>
          )}

          {/* VIEW 1: DEALER GEX & GAMMA FLIP PROFILE */}
          {activeView === 'dealer_gex' && (
            <div className="space-y-5">
              {/* Top Explainer Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Long Gamma Regime (&gt; Flip Level)</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Dealer hedging is counter-cyclical (selling rallies, buying dips). This damps realized market volatility and creates a strong gravitational pull anchoring price toward high-OI strikes.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                  <div className="font-bold text-rose-400 flex items-center gap-1.5 mb-1">
                    <Zap className="h-4 w-4" />
                    <span>Short Gamma Regime (&lt; Flip Level)</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Dealer hedging is pro-cyclical (selling into declines, buying into spikes). This accelerates market momentum and can trigger explosive gamma squeeze cascades.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                    <Scale className="h-4 w-4" />
                    <span>Gamma Flip Level: ₹{formatStrike(summary.gex.gammaFlipLevel)}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Zero-crossing boundary where aggregate dealer gamma exposure changes sign. Spot is currently{' '}
                    <strong className={summary.gex.isSpotAboveFlip ? 'text-emerald-400' : 'text-rose-400'}>
                      {summary.gex.isSpotAboveFlip ? 'Above' : 'Below'} Flip
                    </strong>{' '}
                    by {Math.abs(summary.gex.distanceToFlipPoints)} pts.
                  </p>
                </div>
              </div>

              {/* Strike-by-Strike Dual Bar Chart */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-400" />
                      <span>Strike-by-Strike Dealer GEX Profile (Call GEX vs Put GEX)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Visualizing ₹ Crores exposure per 1% move across active option chain strikes.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-emerald-500" />
                      <span className="text-slate-300">Call GEX (Emerald)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-rose-500" />
                      <span className="text-slate-300">Put GEX (Rose)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="text-amber-400 font-bold">
                        Flip ({formatStrike(summary.gex.gammaFlipLevel)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Horizontal Bar Chart Representation */}
                <div className="space-y-1.5">
                  {summary.gex.strikeGexList.map((s: StrikeGexDetail) => {
                    const maxGex = Math.max(
                      ...summary.gex.strikeGexList.map((d: StrikeGexDetail) =>
                        Math.max(d.strikeCallGex, d.strikePutGex)
                      ),
                      1
                    );
                    const callWidthPct = Math.min(100, (s.strikeCallGex / maxGex) * 100);
                    const putWidthPct = Math.min(100, (s.strikePutGex / maxGex) * 100);
                    const isAtSpot = Math.abs(s.strike - summary.spotPrice) <= 30;
                    const isFlipStrike = Math.abs(s.strike - summary.gex.gammaFlipLevel) <= 30;
                    const isMaxPain = s.strike === summary.maxPain.currentMaxPainStrike;

                    return (
                      <div
                        key={s.strike}
                        onMouseEnter={() => setHoveredStrike(s.strike)}
                        onMouseLeave={() => setHoveredStrike(null)}
                        className={`grid grid-cols-12 items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition ${
                          hoveredStrike === s.strike
                            ? 'bg-slate-900 border-blue-500/80 shadow-md'
                            : isAtSpot
                            ? 'bg-slate-900/60 border-cyan-500/50'
                            : isFlipStrike
                            ? 'bg-amber-950/20 border-amber-500/50'
                            : 'bg-slate-950/40 border-slate-800 hover:bg-slate-900/30'
                        }`}
                      >
                        {/* Put GEX bar (grows leftwards) */}
                        <div className="col-span-4 flex items-center justify-end gap-2">
                          <span className="text-[10px] font-mono text-rose-400 font-semibold">
                            ₹{s.strikePutGex.toFixed(1)} Cr
                          </span>
                          <div className="flex-1 h-3.5 bg-slate-900 rounded-sm overflow-hidden flex justify-end">
                            <div
                              style={{ width: `${putWidthPct}%` }}
                              className="h-full bg-gradient-to-l from-rose-500 to-rose-700 rounded-sm transition-all duration-300"
                            />
                          </div>
                        </div>

                        {/* Strike Badge */}
                        <div className="col-span-4 flex items-center justify-center gap-1.5 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              isAtSpot
                                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                : isFlipStrike
                                ? 'bg-amber-500 text-slate-950'
                                : isMaxPain
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'text-slate-200'
                            }`}
                          >
                            {formatStrike(s.strike)}
                          </span>
                          {isAtSpot && (
                            <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              SPOT
                            </span>
                          )}
                          {isFlipStrike && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              FLIP
                            </span>
                          )}
                          {isMaxPain && (
                            <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              PAIN
                            </span>
                          )}
                        </div>

                        {/* Call GEX bar (grows rightwards) */}
                        <div className="col-span-4 flex items-center justify-start gap-2">
                          <div className="flex-1 h-3.5 bg-slate-900 rounded-sm overflow-hidden flex justify-start">
                            <div
                              style={{ width: `${callWidthPct}%` }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-sm transition-all duration-300"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                            ₹{s.strikeCallGex.toFixed(1)} Cr
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabular Strike Inspection Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden shadow-lg">
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Strike-Level Gamma Exposure & Net Imbalance Matrix
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Values normalized in ₹ Crores per 1% underlying shift
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Strike</th>
                        <th className="py-2.5 px-3 text-right">Call GEX (₹ Cr)</th>
                        <th className="py-2.5 px-3 text-right">Call OI %</th>
                        <th className="py-2.5 px-3 text-center">Net GEX (₹ Cr)</th>
                        <th className="py-2.5 px-3 text-right">Put OI %</th>
                        <th className="py-2.5 px-3 text-right">Put GEX (₹ Cr)</th>
                        <th className="py-2.5 px-3 text-center">Straddle OI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                      {summary.gex.strikeGexList.map((s: StrikeGexDetail) => (
                        <tr
                          key={s.strike}
                          className={`hover:bg-slate-900/60 transition ${
                            s.strike === summary.maxPain.currentMaxPainStrike ? 'bg-purple-950/15' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{formatStrike(s.strike)}</span>
                            {s.strike === summary.pinning.mostLikelyPinnedStrike && (
                              <Magnet className="h-3 w-3 text-amber-400" />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-300">
                            ₹{s.strikeCallGex} Cr
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-400">{s.callOiPct}%</td>
                          <td className="py-2 px-3 text-center font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                s.netStrikeGex >= 0
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                  : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                              }`}
                            >
                              {s.netStrikeGex >= 0 ? '+' : ''}
                              {s.netStrikeGex} Cr
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-rose-400">{s.putOiPct}%</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-300">
                            ₹{s.strikePutGex} Cr
                          </td>
                          <td className="py-2 px-3 text-center text-slate-300">
                            {s.straddleOi.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: DYNAMIC MAX PAIN MIGRATION TRACKER */}
          {activeView === 'max_pain_tracker' && (
            <div className="space-y-5">
              {/* Max Pain Top Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Benchmark Reference Strike
                  </span>
                  <div className="text-xl font-black text-slate-200 mt-1 font-mono">
                    ₹{formatStrike(summary.maxPain.previousMaxPainStrike)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Institutional morning baseline anchor
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-purple-800/50 bg-purple-950/20">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-purple-300">
                    Current Max Pain Strike
                  </span>
                  <div className="text-xl font-black text-purple-300 mt-1 font-mono flex items-baseline justify-between">
                    <span>₹{formatStrike(summary.maxPain.currentMaxPainStrike)}</span>
                    <span className="text-xs font-bold text-purple-400">
                      Drift: {summary.maxPain.spotDistancePoints >= 0 ? '+' : ''}
                      {summary.maxPain.spotDistancePoints} pts
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Minimal option buyer intrinsic payout
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Drift Migration Trajectory
                  </span>
                  <div
                    className={`text-xl font-black mt-1 font-mono flex items-center gap-1.5 ${
                      summary.maxPain.migrationDirection === 'UP'
                        ? 'text-emerald-400'
                        : summary.maxPain.migrationDirection === 'DOWN'
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {summary.maxPain.migrationDirection === 'UP' ? (
                      <ArrowUpRight className="h-5 w-5" />
                    ) : summary.maxPain.migrationDirection === 'DOWN' ? (
                      <ArrowDownRight className="h-5 w-5" />
                    ) : (
                      <Scale className="h-5 w-5" />
                    )}
                    <span>
                      {summary.maxPain.migrationDirection === 'UP'
                        ? 'Migrating Higher'
                        : summary.maxPain.migrationDirection === 'DOWN'
                        ? 'Migrating Lower'
                        : 'Stationary Anchor'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Cluster Range: ₹{formatStrike(summary.maxPain.painRangeLower)} – ₹
                    {formatStrike(summary.maxPain.painRangeUpper)}
                  </span>
                </div>
              </div>

              {/* Cumulative Buyer Loss Curve (Max Pain Chart) */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-400" />
                      <span>Cumulative Option Buyer Payout Curve (Max Pain Minimizer)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      The Max Pain strike represents the exact settlement price where total buyer payout is lowest (writers retain maximal premium).
                    </p>
                  </div>
                  <span className="text-xs font-mono text-purple-300 font-bold bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-800/50">
                    Optimal Settlement Strike: ₹{formatStrike(summary.maxPain.currentMaxPainStrike)}
                  </span>
                </div>

                {/* Vertical Bar Visualization of Buyer Loss / Payout */}
                <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-17 gap-1.5 items-end h-52 pt-6 pb-2 px-2 border-b border-slate-800">
                  {summary.maxPain.strikePainTable.map((s: StrikePainDetail) => {
                    const maxLoss = Math.max(
                      ...summary.maxPain.strikePainTable.map((d: StrikePainDetail) => d.totalLossCr),
                      1
                    );
                    const heightPct = Math.max(12, (s.totalLossCr / maxLoss) * 100);
                    const isMinPain = s.strike === summary.maxPain.currentMaxPainStrike;
                    const isSpot = Math.abs(s.strike - summary.spotPrice) <= 30;

                    return (
                      <div key={s.strike} className="flex flex-col items-center h-full justify-end group">
                        <span className="text-[9px] font-mono text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                          ₹{s.totalLossCr} Cr
                        </span>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            isMinPain
                              ? 'bg-purple-500 shadow-lg shadow-purple-500/50 ring-2 ring-purple-400'
                              : isSpot
                              ? 'bg-cyan-500/70'
                              : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        />
                        <span
                          className={`text-[9px] font-mono mt-1 font-bold ${
                            isMinPain
                              ? 'text-purple-300 underline'
                              : isSpot
                              ? 'text-cyan-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatStrike(s.strike)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pain Breakdown Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden shadow-lg">
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Call / Put Buyer Payout & Writer Retention Matrix
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Variance Ratio: {summary.maxPain.payoutVarianceRatio}x
                  </span>
                </div>
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Candidate Strike</th>
                      <th className="py-2.5 px-4 text-right">Call Buyer Loss (₹ Cr)</th>
                      <th className="py-2.5 px-4 text-right">Put Buyer Loss (₹ Cr)</th>
                      <th className="py-2.5 px-4 text-right">Combined Buyer Loss (₹ Cr)</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {summary.maxPain.strikePainTable.map((point: StrikePainDetail) => {
                      const isMax = point.strike === summary.maxPain.currentMaxPainStrike;
                      return (
                        <tr
                          key={point.strike}
                          className={`hover:bg-slate-900/40 transition ${
                            isMax ? 'bg-purple-950/20 font-bold' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 text-slate-200">₹{formatStrike(point.strike)}</td>
                          <td className="py-2.5 px-4 text-right text-emerald-400">
                            ₹{point.callLossCr} Cr
                          </td>
                          <td className="py-2.5 px-4 text-right text-rose-400">
                            ₹{point.putLossCr} Cr
                          </td>
                          <td className="py-2.5 px-4 text-right text-purple-300 font-bold">
                            ₹{point.totalLossCr} Cr
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {isMax ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                                MAX PAIN PIN
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Regular</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: 0-DTE EXPIRY PINNING & THETA SIMULATOR */}
          {activeView === 'pinning_simulator' && (
            <div className="space-y-5">
              {/* Top Banner: Magnetic Pinning Probability & Theta Acceleration */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/50 text-xs">
                  <div className="flex items-center justify-between font-bold text-amber-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Magnet className="h-4 w-4" />
                      <span>Gravitational Pin Well</span>
                    </span>
                    <span className="text-base font-mono font-black">
                      {summary.pinning.pinningProbability}%
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Strike <strong>₹{formatStrike(summary.pinning.mostLikelyPinnedStrike)}</strong>{' '}
                    exhibits the dominant gravitational pull force. Expected boundary:{' '}
                    <strong>
                      ₹{formatStrike(summary.pinning.pinningRange[0])} – ₹
                      {formatStrike(summary.pinning.pinningRange[1])}
                    </strong>
                    .
                  </p>
                  <div className="mt-3 pt-2 border-t border-amber-800/40 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Pinning Confidence:</span>
                    <span className="font-bold text-amber-300">
                      {summary.pinning.pinningConfidence}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between font-bold text-cyan-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>0-DTE Theta Decay Curve</span>
                    </span>
                    <span className="text-base font-mono font-black">
                      {summary.thetaSchedule.currentPoint.thetaDecayPercent}% Burnt
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Hyperbolic non-linear time decay active. Remaining ATM straddle premium estimate:
                    <strong className="text-cyan-300">
                      {' '}
                      ₹{summary.thetaSchedule.currentPoint.expectedAtmStraddlePremium}
                    </strong>
                    . Post-13:30 IV crush is{' '}
                    <strong className="text-amber-400">
                      {summary.thetaSchedule.post1330CrushActive ? 'Active' : 'Pending'}
                    </strong>
                    .
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Gamma Acceleration Factor:</span>
                    <span className="font-bold text-cyan-300">
                      {summary.thetaSchedule.currentPoint.gammaAccelerationFactor}x
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Intraday Time Decay Slider (09:15 to 15:30)
                    </span>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="375"
                        step="5"
                        value={375 - minutesRemaining}
                        onChange={(e) => setMinutesRemaining(375 - parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="font-mono text-amber-300 font-bold text-xs whitespace-nowrap">
                        {timeSliderString}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                    <span>09:15 (Open)</span>
                    <span>12:22 (Midday)</span>
                    <span>15:30 (Close)</span>
                  </div>
                </div>
              </div>

              {/* Pinning Bell Curve Distribution Chart */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Crosshair className="h-4 w-4 text-amber-400" />
                      <span>0-DTE Terminal Strike Pinning Probability Distribution</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Probability density narrows dynamically into expiry as dealer gamma hedging enforces strike pinning.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Pin Target: ₹{formatStrike(summary.pinning.mostLikelyPinnedStrike)}
                    </span>
                  </div>
                </div>

                {/* Bell Curve Bars */}
                <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-17 gap-1.5 items-end h-56 pt-6 pb-2 px-2 border-b border-slate-800">
                  {summary.pinning.strikes.map((p: TerminalStrikePinning) => {
                    const maxProb = Math.max(
                      ...summary.pinning.strikes.map((d: TerminalStrikePinning) => d.probabilityPercent),
                      1
                    );
                    const heightPct = Math.max(8, (p.probabilityPercent / maxProb) * 100);
                    const isPin = p.strike === summary.pinning.mostLikelyPinnedStrike;
                    const isSpot = p.isAtm;

                    return (
                      <div key={p.strike} className="flex flex-col items-center h-full justify-end group">
                        <span className="text-[9px] font-mono text-slate-300 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                          {p.probabilityPercent}%
                        </span>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            isPin
                              ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-lg shadow-amber-500/50 ring-2 ring-amber-300'
                              : isSpot
                              ? 'bg-cyan-500/80'
                              : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        />
                        <span
                          className={`text-[9px] font-mono mt-1 font-bold ${
                            isPin
                              ? 'text-amber-300 underline'
                              : isSpot
                              ? 'text-cyan-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatStrike(p.strike)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1-Click Pin Risk Hedger Action Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-[#0E131F] to-[#121829] border border-amber-500/30 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                        1-Click Pin Risk Hedger
                      </span>
                      <span className="text-xs text-slate-400">
                        Urgency: {summary.hedgeRecommendation.urgency}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-100 mt-1 flex items-center gap-2">
                      <span>{summary.hedgeRecommendation.strategyName}</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Pin Prob</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        {summary.hedgeRecommendation.pinningProbability}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Max Profit / Risk</span>
                      <span className="text-slate-200 font-bold text-sm">
                        ₹{typeof summary.hedgeRecommendation.maxProfit === 'number' ? summary.hedgeRecommendation.maxProfit.toLocaleString('en-IN') : summary.hedgeRecommendation.maxProfit} / ₹{typeof summary.hedgeRecommendation.maxRisk === 'number' ? summary.hedgeRecommendation.maxRisk.toLocaleString('en-IN') : summary.hedgeRecommendation.maxRisk}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Net Flow</span>
                      <span
                        className={`font-bold text-sm ${
                          summary.hedgeRecommendation.totalPremiumInflowOutflow <= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {summary.hedgeRecommendation.totalPremiumInflowOutflow <= 0 ? 'Credit ' : 'Debit '}₹
                        {Math.abs(summary.hedgeRecommendation.totalPremiumInflowOutflow).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Strategy Legs Table */}
                <div className="my-4 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/60 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Contract Strike</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Action</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Premium</th>
                        <th className="py-2 px-3 text-right">Delta</th>
                        <th className="py-2 px-3 text-right">Gamma</th>
                        <th className="py-2 px-3 text-right">Theta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-[11px]">
                      {summary.hedgeRecommendation.legs.map((leg: PinRiskHedgeLeg) => (
                        <tr key={leg.id} className="hover:bg-slate-900/30">
                          <td className="py-2 px-3 font-bold text-slate-200">
                            ₹{formatStrike(leg.strike)}
                          </td>
                          <td className="py-2 px-3 text-cyan-300 font-bold">{leg.optionType}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                leg.side === 'BUY'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {leg.side}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">{leg.quantity}</td>
                          <td className="py-2 px-3 text-right text-slate-200">₹{leg.price.toFixed(1)}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{leg.delta}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{leg.gamma}</td>
                          <td className="py-2 px-3 text-right font-semibold text-emerald-400">
                            {leg.theta > 0 ? '+' : ''}
                            {leg.theta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Rationale and Execution Button */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800">
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    <strong>Algorithmic Rationale:</strong> {summary.hedgeRecommendation.rationale}
                  </p>

                  <button
                    onClick={handleArmHedge}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition transform hover:-translate-y-0.5"
                  >
                    <Zap className="h-4 w-4 fill-current" />
                    <span>Arm & Deploy Pin Risk Hedger</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-2.5 border-t border-slate-800/80 bg-slate-950/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>GEX Refresh Stream: Real-Time</span>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:inline">Black-Scholes 0-DTE Drift-Diffusion Curvature Engine</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Active Ticker:</span>
            <span className="text-amber-300 font-bold">{summary.symbol}</span>
            <span className="text-slate-600">•</span>
            <span>Pin Prob:</span>
            <span className="text-emerald-400 font-bold">
              {summary.pinning.pinningProbability}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
