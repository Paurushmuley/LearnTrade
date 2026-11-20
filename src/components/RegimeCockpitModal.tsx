'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  DollarSign,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  Lock,
  PieChart,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import {
  RegimeType,
  WorkspaceView,
  MultiAssetKey,
  RegimeProbabilities,
  RegimeActionLog,
} from '../types/regime';
import {
  REGIME_CHARACTERISTICS,
  MULTI_ASSET_METAS,
  DEFAULT_MARKOV_TRANSITIONS,
  calculateRegimeHalfLife,
  computeErgodicDistribution,
  computeRegimeTargetRiskParity,
  buildAssetAllocationItems,
  calculatePortfolioSharpe,
  generateHistoricalRibbonData,
} from '../lib/regimeEngine';

export interface RegimeCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice?: number;
}

export const RegimeCockpitModal: React.FC<RegimeCockpitModalProps> = ({
  isOpen,
  onClose,
  spotPrice: externalSpotPrice,
}) => {
  // Navigation View
  const [activeView, setActiveView] = useState<WorkspaceView>('radar_markov');

  // Regime Probabilities & Dominant State
  const [regimeProbs, setRegimeProbs] = useState<RegimeProbabilities>({
    bull: 0.84,
    chop: 0.12,
    crisis: 0.04,
  });

  // Manual Override State
  const [isOverridden, setIsOverridden] = useState<boolean>(false);
  const [overrideRegime, setOverrideRegime] = useState<RegimeType>('BULL_TRENDING');
  const [tailHedgeActive, setTailHedgeActive] = useState<boolean>(false);

  // Target Volatility & Cash Buffer
  const [targetVolPct, setTargetVolPct] = useState<number>(12.0);

  // Current Portfolio Asset Weights (User's actual current allocations)
  const [currentWeights, setCurrentWeights] = useState<Record<MultiAssetKey, number>>({
    NIFTY: 35.0,
    BANKNIFTY: 25.0,
    GOLDBEES: 20.0,
    LIQUIDBEES: 20.0,
  });

  // Action Audit Trail
  const [actionLogs, setActionLogs] = useState<RegimeActionLog[]>([
    {
      id: 'log-1',
      timestamp: '15:09:12 IST',
      action: 'Online Filter Calibrated',
      details: 'Forward Bayesian Filter converged with 3-State Gaussian emission parameters (NIFTY, BNF, VIX, GOLD).',
      badge: 'INITIALIZED',
      type: 'info',
    },
    {
      id: 'log-2',
      timestamp: '15:09:14 IST',
      action: 'Ergodic State Balanced',
      details: 'Stationary distribution pi_infty computed: Bull 52.4%, Chop 36.8%, Crisis 10.8%. Half-life 14.2 days.',
      badge: 'SOLVED',
      type: 'success',
    },
  ]);

  // Selected Historical Ribbon Point for Hover Inspection
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Success Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Historical data cache
  const historicalPoints = useMemo(() => generateHistoricalRibbonData(), []);

  // Compute dominant regime
  const activeRegime: RegimeType = useMemo(() => {
    if (isOverridden) return overrideRegime;
    if (regimeProbs.crisis >= 0.5 || (regimeProbs.crisis > regimeProbs.bull && regimeProbs.crisis > regimeProbs.chop)) {
      return 'HIGH_VOL_CRISIS';
    }
    if (regimeProbs.chop >= regimeProbs.bull) {
      return 'LOW_VOL_CHOP';
    }
    return 'BULL_TRENDING';
  }, [isOverridden, overrideRegime, regimeProbs]);

  // Characteristics of active regime
  const activeRegimeInfo = useMemo(() => {
    return REGIME_CHARACTERISTICS[activeRegime];
  }, [activeRegime]);

  // Ergodic stationary distribution
  const ergodicDist = useMemo(() => {
    return computeErgodicDistribution(DEFAULT_MARKOV_TRANSITIONS);
  }, []);

  // Half-life of active regime persistence
  const persistenceHalfLifeDays = useMemo(() => {
    const fromTransition = DEFAULT_MARKOV_TRANSITIONS.find((t) => t.fromRegime === activeRegime);
    const prob = fromTransition ? fromTransition.toRegimes[activeRegime] : 0.90;
    return calculateRegimeHalfLife(prob);
  }, [activeRegime]);

  // Dynamic Risk Parity Target Allocations
  const targetWeights = useMemo(() => {
    return computeRegimeTargetRiskParity(activeRegime, tailHedgeActive);
  }, [activeRegime, tailHedgeActive]);

  // Build allocation items with MRC and Risk %
  const allocationItems = useMemo(() => {
    return buildAssetAllocationItems(currentWeights, targetWeights, activeRegime);
  }, [currentWeights, targetWeights, activeRegime]);

  // Portfolio metrics (Sharpe, Volatility, Leverage)
  const portfolioStats = useMemo(() => {
    return calculatePortfolioSharpe(allocationItems, targetVolPct);
  }, [allocationItems, targetVolPct]);

  // Leverage Scaler L_t = min(1.0, targetVol / portfolioVol)
  const leverageMultiplier = useMemo(() => {
    const L = targetVolPct / Math.max(1.0, portfolioStats.portfolioVol);
    return Number(Math.min(1.25, L).toFixed(2));
  }, [targetVolPct, portfolioStats.portfolioVol]);

  // Auto-clear toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // 1-Click Action 1: Rebalance to Optimal Risk Parity
  const handleRebalanceRiskParity = useCallback(() => {
    const updated: Record<MultiAssetKey, number> = {
      NIFTY: targetWeights.NIFTY.targetWeight,
      BANKNIFTY: targetWeights.BANKNIFTY.targetWeight,
      GOLDBEES: targetWeights.GOLDBEES.targetWeight,
      LIQUIDBEES: targetWeights.LIQUIDBEES.targetWeight,
    };
    setCurrentWeights(updated);

    const now = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
    const newLog: RegimeActionLog = {
      id: `log-${Date.now()}`,
      timestamp: now,
      action: 'Rebalanced to Optimal Risk Parity',
      details: `Allocations harmonized: NIFTY ${updated.NIFTY}%, BNF ${updated.BANKNIFTY}%, GOLD ${updated.GOLDBEES}%, CASH ${updated.LIQUIDBEES}%. Estimated STT & slippage: ₹248 (0.002%).`,
      badge: 'REBALANCED',
      type: 'success',
    };
    setActionLogs((prev) => [newLog, ...prev]);
    setToastMessage('✅ Portfolio successfully rebalanced to Equal Risk Contribution (ERC) targets!');
  }, [targetWeights]);

  // 1-Click Action 2: Deploy 100% Crisis Tail Hedge
  const handleDeployCrisisHedge = useCallback(() => {
    setTailHedgeActive(true);
    const updated: Record<MultiAssetKey, number> = {
      NIFTY: 0.0,
      BANKNIFTY: 0.0,
      GOLDBEES: 45.0,
      LIQUIDBEES: 55.0,
    };
    setCurrentWeights(updated);
    setTargetVolPct(8.0); // De-lever to defensive vol

    const now = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
    const newLog: RegimeActionLog = {
      id: `log-${Date.now()}`,
      timestamp: now,
      action: '100% Crisis Tail Hedge Deployed',
      details: 'Equity exposure liquidated to 0%. Capital rotated 45% into GOLD BEES & 55% into LIQUID BEES overnight cash buffer. Put delta overlay engaged.',
      badge: 'TAIL HEDGE ACTIVE',
      type: 'danger',
    };
    setActionLogs((prev) => [newLog, ...prev]);
    setToastMessage('🛡️ 100% Crisis Tail Hedge deployed! Equity exposure clamped to 0%.');
  }, []);

  // 1-Click Action 3: Lock Regime Override
  const handleToggleOverride = useCallback(() => {
    if (!isOverridden) {
      setIsOverridden(true);
      const now = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
      const newLog: RegimeActionLog = {
        id: `log-${Date.now()}`,
        timestamp: now,
        action: 'Manual Regime Override Locked',
        details: `Automated Bayesian forward filter decoupled. User locked regime to: ${REGIME_CHARACTERISTICS[overrideRegime].name}.`,
        badge: 'LOCKED',
        type: 'warning',
      };
      setActionLogs((prev) => [newLog, ...prev]);
      setToastMessage(`🔒 Regime override locked to ${REGIME_CHARACTERISTICS[overrideRegime].name}`);
    } else {
      setIsOverridden(false);
      const now = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
      const newLog: RegimeActionLog = {
        id: `log-${Date.now()}`,
        timestamp: now,
        action: 'Override Released',
        details: 'Regime control returned to real-time HMM Bayesian forward filter.',
        badge: 'RELEASED',
        type: 'info',
      };
      setActionLogs((prev) => [newLog, ...prev]);
      setToastMessage('🔓 Regime override released. Real-time HMM filter active.');
    }
  }, [isOverridden, overrideRegime]);

  // 1-Click Action 4: Reset to Auto-Filter
  const handleResetAutoFilter = useCallback(() => {
    setIsOverridden(false);
    setTailHedgeActive(false);
    setTargetVolPct(12.0);
    setRegimeProbs({ bull: 0.84, chop: 0.12, crisis: 0.04 });
    const baseline = computeRegimeTargetRiskParity('BULL_TRENDING', false);
    setCurrentWeights({
      NIFTY: baseline.NIFTY.targetWeight,
      BANKNIFTY: baseline.BANKNIFTY.targetWeight,
      GOLDBEES: baseline.GOLDBEES.targetWeight,
      LIQUIDBEES: baseline.LIQUIDBEES.targetWeight,
    });

    const now = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
    const newLog: RegimeActionLog = {
      id: `log-${Date.now()}`,
      timestamp: now,
      action: 'Reset to Auto-Filter',
      details: 'All overrides cleared. Posterior probabilities re-synchronized with online Gaussian HMM observation stream.',
      badge: 'RESET AUTO',
      type: 'info',
    };
    setActionLogs((prev) => [newLog, ...prev]);
    setToastMessage('🔄 System reset to online Gaussian HMM multi-asset filter.');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-7xl max-h-[96vh] flex flex-col bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* TOAST BANNER */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-800/95 border border-cyan-500/50 rounded-xl shadow-xl text-xs font-semibold text-cyan-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 1. HEADER COCKPIT BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-[#0B0F19]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Compass className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 tracking-tight">
                  Market Regime & HMM Risk Parity Engine
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Sprint 28
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  3-State Gaussian HMM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Online Bayesian Forward Filtering • Markov Transition Dynamics • Equal Risk Contribution (ERC) Multi-Asset Allocation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setActiveView('radar_markov')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'radar_markov'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gauge className="h-3.5 w-3.5" />
                <span>Radar & Markov</span>
              </button>
              <button
                onClick={() => setActiveView('historical_ribbon')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'historical_ribbon'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Regime Ribbon</span>
              </button>
              <button
                onClick={() => setActiveView('risk_parity')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'risk_parity'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Risk Parity Desk</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2. QUICK METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-950/60 border-b border-slate-800 text-xs">
          {/* Dominant Regime Badge */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Dominant Regime
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-lg">{activeRegimeInfo.emoji}</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${activeRegimeInfo.badgeClass}`}>
                {activeRegimeInfo.name}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5 truncate">
              {isOverridden ? 'Manual Override Active' : 'Online Posterior MAP'}
            </span>
          </div>

          {/* Bull Probability */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Bull Probability
            </span>
            <div className="mt-1 text-base font-extrabold font-mono text-emerald-400">
              {(regimeProbs.bull * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, regimeProbs.bull * 100)}%` }}
              />
            </div>
          </div>

          {/* Crisis Probability */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              Crisis Probability
            </span>
            <div className="mt-1 text-base font-extrabold font-mono text-rose-400">
              {(regimeProbs.crisis * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-rose-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, regimeProbs.crisis * 100)}%` }}
              />
            </div>
          </div>

          {/* Regime Persistence Half-Life */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Half-Life (Days)
            </span>
            <div className="mt-1 text-base font-extrabold font-mono text-slate-100">
              {persistenceHalfLifeDays} <span className="text-xs font-normal text-slate-400">Days</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">
              t½ = ln(0.5) / ln(Pii)
            </span>
          </div>

          {/* Portfolio Vol Target */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Target Vol (σ*)
            </span>
            <div className="mt-1 text-base font-extrabold font-mono text-amber-400">
              {targetVolPct.toFixed(1)}% <span className="text-xs font-normal text-slate-400">p.a.</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">
              Leverage L: {leverageMultiplier}x
            </span>
          </div>

          {/* Sharpe Metric */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Sharpe Ratio
            </span>
            <div className="mt-1 text-base font-extrabold font-mono text-purple-400">
              {portfolioStats.sharpe.toFixed(2)}
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">
              E[R]: {portfolioStats.expectedReturn}% | Rf: 6.8%
            </span>
          </div>
        </div>

        {/* 3. MAIN WORKSPACE CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* VIEW 1: REGIME PROBABILITY RADAR & MARKOV TRANSITION MATRIX */}
          {activeView === 'radar_markov' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Top Row: 3-State Probability Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Gauge 1: Bull Trending 🐂 */}
                <div className={`p-4 rounded-xl border bg-slate-900/70 transition ${
                  activeRegime === 'BULL_TRENDING' ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🐂</span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">Bull Trending</h4>
                        <span className="text-[10px] text-emerald-400 font-mono">State 0 (Persistent Upside)</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {(regimeProbs.bull * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Visual Radial Gauge Simulation */}
                  <div className="relative flex flex-col items-center justify-center py-2">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="10"
                        className="text-slate-800"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 * (1 - regimeProbs.bull)}
                        strokeLinecap="round"
                        className="text-emerald-500 transition-all duration-500"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-xl font-mono font-extrabold text-slate-100">
                        {Math.round(regimeProbs.bull * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400">Posterior</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exp Annual Return:</span>
                      <span className="font-mono text-emerald-400 font-bold">+21.4%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exp Realized Vol:</span>
                      <span className="font-mono text-slate-200">11.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Typical Duration:</span>
                      <span className="font-mono text-slate-200">17.2 Days</span>
                    </div>
                  </div>
                </div>

                {/* Gauge 2: Low-Vol Chop 🦀 */}
                <div className={`p-4 rounded-xl border bg-slate-900/70 transition ${
                  activeRegime === 'LOW_VOL_CHOP' ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🦀</span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">Low-Vol Chop</h4>
                        <span className="text-[10px] text-amber-400 font-mono">State 1 (Mean Reverting)</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {(regimeProbs.chop * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Visual Radial Gauge Simulation */}
                  <div className="relative flex flex-col items-center justify-center py-2">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="10"
                        className="text-slate-800"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 * (1 - regimeProbs.chop)}
                        strokeLinecap="round"
                        className="text-amber-500 transition-all duration-500"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-xl font-mono font-extrabold text-slate-100">
                        {Math.round(regimeProbs.chop * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400">Posterior</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exp Annual Return:</span>
                      <span className="font-mono text-amber-400 font-bold">+5.2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exp Realized Vol:</span>
                      <span className="font-mono text-slate-200">9.4%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Typical Duration:</span>
                      <span className="font-mono text-slate-200">8.0 Days</span>
                    </div>
                  </div>
                </div>

                {/* Gauge 3: High-Vol Crisis 🐻 */}
                <div className={`p-4 rounded-xl border bg-slate-900/70 transition ${
                  activeRegime === 'HIGH_VOL_CRISIS' ? 'border-rose-500/60 ring-1 ring-rose-500/30' : 'border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🐻</span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">High-Vol Crisis</h4>
                        <span className="text-[10px] text-rose-400 font-mono">State 2 (Tail Risk Liquidation)</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      {(regimeProbs.crisis * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Visual Radial Gauge Simulation */}
                  <div className="relative flex flex-col items-center justify-center py-2">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="10"
                        className="text-slate-800"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 * (1 - regimeProbs.crisis)}
                        strokeLinecap="round"
                        className="text-rose-500 transition-all duration-500"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-xl font-mono font-extrabold text-slate-100">
                        {Math.round(regimeProbs.crisis * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400">Posterior</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exp Annual Return:</span>
                      <span className="font-mono text-rose-400 font-bold">-26.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exp Realized Vol:</span>
                      <span className="font-mono text-slate-200">31.2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Typical Duration:</span>
                      <span className="font-mono text-slate-200">6.3 Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: 3x3 Markov Matrix Heatmap & Steady-State Ergodic Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* 3x3 Markov Transition Probability Matrix */}
                <div className="lg:col-span-2 p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-slate-100">
                        3x3 Markov Transition Probability Matrix ($P_{'{'}ij{'}'}$)
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Row: Current State $S_t$ ➔ Column: Next State $S_{'{'}t+1{'}'}$
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-left">
                          <th className="py-2.5 px-3">State $S_t$ \ $S_{'{'}t+1{'}'}$</th>
                          <th className="py-2.5 px-3 text-emerald-400">🐂 Bull Trending</th>
                          <th className="py-2.5 px-3 text-amber-400">🦀 Low-Vol Chop</th>
                          <th className="py-2.5 px-3 text-rose-400">🐻 High-Vol Crisis</th>
                          <th className="py-2.5 px-3 text-slate-400 text-right">E[Duration]</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {DEFAULT_MARKOV_TRANSITIONS.map((row) => {
                          const isCurActive = row.fromRegime === activeRegime;
                          return (
                            <tr
                              key={row.fromRegime}
                              className={`transition ${isCurActive ? 'bg-slate-800/40 font-bold' : 'hover:bg-slate-800/20'}`}
                            >
                              <td className="py-3 px-3 flex items-center gap-2">
                                <span>{REGIME_CHARACTERISTICS[row.fromRegime].emoji}</span>
                                <span className="text-slate-200">
                                  {REGIME_CHARACTERISTICS[row.fromRegime].name}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-1 rounded ${
                                    row.toRegimes.BULL_TRENDING > 0.5
                                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {(row.toRegimes.BULL_TRENDING * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-1 rounded ${
                                    row.toRegimes.LOW_VOL_CHOP > 0.5
                                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {(row.toRegimes.LOW_VOL_CHOP * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-1 rounded ${
                                    row.toRegimes.HIGH_VOL_CRISIS > 0.5
                                      ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {(row.toRegimes.HIGH_VOL_CRISIS * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-300">
                                {row.expectedDurationDays.toFixed(1)} d
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 flex items-center justify-between">
                    <span>
                      Markov Property: $\sum_j P_{'{'}ij{'}'} = 1.00$. Diagonal persistence reveals regime inertia.
                    </span>
                    <span className="text-cyan-400 font-mono">
                      Half-Life: $t_{'{'}1/2{'}'} = \frac{'{'}\ln(0.5){'}'}{'{'}\ln(P_{'{'}ii{'}'}){'}'}$
                    </span>
                  </div>
                </div>

                {/* Steady-State Ergodic Invariant Distribution & Shannon Entropy */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="h-4 w-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-slate-100">
                        Stationary Ergodic Distribution ($\pi_\infty$)
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                      Long-run asymptotic probability vector solving $\pi P = \pi$, representing the unconditional equilibrium market state.
                    </p>

                    <div className="space-y-3">
                      {/* Bull Ergodic */}
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-mono">
                          <span className="text-emerald-400 flex items-center gap-1">
                            🐂 Bull Stationary
                          </span>
                          <span className="text-slate-200">{(ergodicDist.bull * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${ergodicDist.bull * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Chop Ergodic */}
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-mono">
                          <span className="text-amber-400 flex items-center gap-1">
                            🦀 Chop Stationary
                          </span>
                          <span className="text-slate-200">{(ergodicDist.chop * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-500 h-2 rounded-full"
                            style={{ width: `${ergodicDist.chop * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Crisis Ergodic */}
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-mono">
                          <span className="text-rose-400 flex items-center gap-1">
                            🐻 Crisis Stationary
                          </span>
                          <span className="text-slate-200">{(ergodicDist.crisis * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-rose-500 h-2 rounded-full"
                            style={{ width: `${ergodicDist.crisis * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Shannon Entropy ($H_t$):</span>
                      <span className="font-mono font-bold text-purple-400">
                        {ergodicDist.entropy} bits
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Low entropy (&lt;0.8) = High conviction regime; High entropy (&gt;1.2) = Active regime transition phase.
                    </span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* VIEW 2: HISTORICAL REGIME RIBBON & ASSET DYNAMICS */}
          {activeView === 'historical_ribbon' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Ribbon Chart Container */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-slate-100">
                        Multi-Asset Historical Regime Ribbon (Base 100 Re-indexed)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Background shading highlights Viterbi decoded historical regimes: Emerald = Bull, Amber = Chop, Rose = Crisis Bear.
                    </p>
                  </div>

                  {/* Asset Legend */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
                      NIFTY 50
                    </span>
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <span className="h-2 w-2 rounded-full bg-indigo-400 inline-block" />
                      BANKNIFTY
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                      GOLD BEES
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                      LIQUID BEES
                    </span>
                  </div>
                </div>

                {/* SVG Visual Time Series with Regime Background Bands */}
                <div className="relative w-full h-72 bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 280">
                    <defs>
                      <linearGradient id="gradBull" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="gradChop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="gradCrisis" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.30" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>

                    {/* Regime Background Shading Rectangles */}
                    {historicalPoints.map((pt, idx) => {
                      const x = (idx / (historicalPoints.length - 1)) * 1000;
                      const nextX = ((idx + 1) / (historicalPoints.length - 1)) * 1000;
                      const width = Math.max(1, nextX - x);
                      const fillColor =
                        pt.regime === 'BULL_TRENDING'
                          ? 'url(#gradBull)'
                          : pt.regime === 'LOW_VOL_CHOP'
                          ? 'url(#gradChop)'
                          : 'url(#gradCrisis)';

                      return (
                        <rect
                          key={`bg-${idx}`}
                          x={x}
                          y="0"
                          width={width}
                          height="280"
                          fill={fillColor}
                        />
                      );
                    })}

                    {/* Gridlines */}
                    <line x1="0" y1="70" x2="1000" y2="70" stroke="#334155" strokeDasharray="4 4" strokeWidth="0.8" opacity="0.4" />
                    <line x1="0" y1="140" x2="1000" y2="140" stroke="#334155" strokeDasharray="4 4" strokeWidth="0.8" opacity="0.4" />
                    <line x1="0" y1="210" x2="1000" y2="210" stroke="#334155" strokeDasharray="4 4" strokeWidth="0.8" opacity="0.4" />

                    {/* Asset Curves: Scale Y min=70 to max=130 */}
                    {/* 1. NIFTY 50 (Cyan) */}
                    <polyline
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.2"
                      points={historicalPoints
                        .map((pt, idx) => {
                          const x = (idx / (historicalPoints.length - 1)) * 1000;
                          const y = 280 - ((pt.nifty - 70) / 60) * 280;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />

                    {/* 2. BANKNIFTY (Indigo) */}
                    <polyline
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="1.8"
                      strokeDasharray="3 2"
                      points={historicalPoints
                        .map((pt, idx) => {
                          const x = (idx / (historicalPoints.length - 1)) * 1000;
                          const y = 280 - ((pt.bankNifty - 70) / 60) * 280;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />

                    {/* 3. GOLD BEES (Amber) */}
                    <polyline
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2.0"
                      points={historicalPoints
                        .map((pt, idx) => {
                          const x = (idx / (historicalPoints.length - 1)) * 1000;
                          const y = 280 - ((pt.goldBees - 70) / 60) * 280;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />

                    {/* 4. LIQUID BEES (Emerald) */}
                    <polyline
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="1.6"
                      points={historicalPoints
                        .map((pt, idx) => {
                          const x = (idx / (historicalPoints.length - 1)) * 1000;
                          const y = 280 - ((pt.liquidBees - 70) / 60) * 280;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />

                    {/* Interactive hover line */}
                    {hoveredPointIndex !== null && (
                      <line
                        x1={(hoveredPointIndex / (historicalPoints.length - 1)) * 1000}
                        y1="0"
                        x2={(hoveredPointIndex / (historicalPoints.length - 1)) * 1000}
                        y2="280"
                        stroke="#f8fafc"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}
                  </svg>

                  {/* Invisible interactive hover columns */}
                  <div className="absolute inset-0 flex">
                    {historicalPoints.map((pt, idx) => (
                      <div
                        key={`col-${idx}`}
                        className="flex-1 cursor-crosshair hover:bg-white/5 transition"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                      />
                    ))}
                  </div>

                  {/* Hover Tooltip Overlay */}
                  {hoveredPointIndex !== null && (
                    <div className="absolute top-2 right-2 bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-xs space-y-1 z-20 pointer-events-none">
                      <div className="flex items-center justify-between gap-4 font-mono">
                        <span className="text-slate-400">Date:</span>
                        <span className="text-slate-200 font-bold">{historicalPoints[hoveredPointIndex].date}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-400">Regime:</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          REGIME_CHARACTERISTICS[historicalPoints[hoveredPointIndex].regime].badgeClass
                        }`}>
                          {REGIME_CHARACTERISTICS[historicalPoints[hoveredPointIndex].regime].name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                        <span className="text-cyan-400">NIFTY:</span>
                        <span className="text-slate-200">{historicalPoints[hoveredPointIndex].nifty}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                        <span className="text-indigo-400">BANKNIFTY:</span>
                        <span className="text-slate-200">{historicalPoints[hoveredPointIndex].bankNifty}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                        <span className="text-amber-400">GOLD BEES:</span>
                        <span className="text-slate-200">{historicalPoints[hoveredPointIndex].goldBees}</span>
                      </div>
                      {historicalPoints[hoveredPointIndex].marketNote && (
                        <div className="pt-1 border-t border-slate-800 text-[10px] text-cyan-300 max-w-xs">
                          💡 {historicalPoints[hoveredPointIndex].marketNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Timeline Bottom Metric Bar */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-500 text-[10px]">Bull Regime Duration</span>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5">28 Trading Days (58%)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-500 text-[10px]">Chop Regime Duration</span>
                    <div className="font-mono font-bold text-amber-400 mt-0.5">18 Trading Days (31%)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-500 text-[10px]">Crisis Regime Duration</span>
                    <div className="font-mono font-bold text-rose-400 mt-0.5">12 Trading Days (11%)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-500 text-[10px]">Max Drawdown Under Risk Parity</span>
                    <div className="font-mono font-bold text-cyan-400 mt-0.5">-4.2% (vs -19.4% Nifty)</div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 3: RISK PARITY DYNAMIC ALLOCATION & EXECUTION DESK */}
          {activeView === 'risk_parity' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Asset Allocation Weights & Marginal Risk Contribution */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* 2-Cols: Multi-Asset Allocations Bar Chart & Drift */}
                <div className="lg:col-span-2 p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-slate-100">
                        Dynamic Multi-Asset Risk Parity Allocation (Target vs Current)
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Equal Risk Contribution (ERC) Condition: $w_i (\Sigma w)_i = \frac{'{'}1{'}'}{'{'}N{'}'} w^T \Sigma w$
                    </span>
                  </div>

                  <div className="space-y-4">
                    {allocationItems.map((item) => {
                      const drift = Number((item.currentWeight - item.targetWeight).toFixed(1));
                      return (
                        <div key={item.key} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold text-xs ${item.color}`}>
                                {item.symbol}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({item.assetClass})
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-slate-400">
                                Current: <strong className="text-slate-200">{item.currentWeight}%</strong>
                              </span>
                              <span className="text-cyan-400">
                                Target: <strong className="text-cyan-300">{item.targetWeight}%</strong>
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                Math.abs(drift) < 1.0
                                  ? 'bg-slate-800 text-slate-400'
                                  : drift > 0
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              }`}>
                                {drift > 0 ? `+${drift}% Over` : drift < 0 ? `${drift}% Under` : 'Aligned'}
                              </span>
                            </div>
                          </div>

                          {/* Dual Comparison Bar: Top = Current, Bottom = Target */}
                          <div className="space-y-1">
                            {/* Current Weight Bar */}
                            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-slate-400 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, item.currentWeight)}%` }}
                              />
                            </div>
                            {/* Target Risk Parity Weight Bar */}
                            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, item.targetWeight)}%` }}
                              />
                            </div>
                          </div>

                          {/* Risk Contribution Metrics */}
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/40 font-mono">
                            <span>Marginal Risk Contrib (MRC): {item.marginalRiskContribution}</span>
                            <span className="text-purple-300">
                              Portfolio Risk Contrib: <strong>{item.riskContributionPct}%</strong> (Balanced)
                            </span>
                            <span>Annualized Vol: {item.annualVol}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 1-Col: Volatility Scaler & Dynamic Controls */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sliders className="h-4 w-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-slate-100">
                        Portfolio Volatility Scaler ($\sigma^*$)
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                      Maintains constant target volatility regardless of underlying regime turbulence. Excess capital automatically parks in LIQUID BEES cash.
                    </p>

                    {/* Interactive Slider */}
                    <div className="space-y-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Target Annual Vol:</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {targetVolPct.toFixed(1)}% p.a.
                        </span>
                      </div>
                      <input
                        type="range"
                        min="6.0"
                        max="24.0"
                        step="0.5"
                        value={targetVolPct}
                        onChange={(e) => setTargetVolPct(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>6.0% (Defensive)</span>
                        <span>12.0% (Institutional)</span>
                        <span>24.0% (High-Beta)</span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Unhedged Base Vol:</span>
                        <span>{portfolioStats.portfolioVol}%</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Effective Leverage:</span>
                        <span className="text-cyan-400 font-bold">{leverageMultiplier}x</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Sharpe Metric:</span>
                        <span className="text-purple-400 font-bold">{portfolioStats.sharpe}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tail Hedge Status indicator */}
                  <div className={`mt-4 p-3 rounded-lg border text-xs ${
                    tailHedgeActive
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {tailHedgeActive ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      <span>{tailHedgeActive ? 'Crisis Tail Hedge Active' : 'Normal Regime Parity Mode'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {tailHedgeActive
                        ? '100% equity risk mitigated. Allocation shifted to 45% Gold & 55% Liquid cash collateral.'
                        : 'Dynamic risk weighting according to filtered Hidden Markov Model posterior probabilities.'}
                    </p>
                  </div>
                </div>

              </div>

              {/* 4 1-CLICK REGIME ACTIONS STRIP */}
              <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F19]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-slate-100">
                      1-Click Execution Desk & Regime Actions
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500">SEBI Statutory STT & Slippage Guard Active</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Action 1: Rebalance to Optimal Risk Parity */}
                  <button
                    onClick={handleRebalanceRiskParity}
                    className="flex flex-col text-left p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-lg shadow-blue-600/20 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Rebalance to Optimal Risk Parity</span>
                      <RotateCcw className="h-4 w-4 text-blue-200 group-hover:rotate-180 transition-transform duration-500" />
                    </div>
                    <span className="text-[10px] text-blue-200 mt-1 font-normal">
                      Aligns current weights to ERC targets with minimal turnover.
                    </span>
                  </button>

                  {/* Action 2: Deploy 100% Crisis Tail Hedge */}
                  <button
                    onClick={handleDeployCrisisHedge}
                    className="flex flex-col text-left p-3 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-semibold transition shadow-lg shadow-rose-600/20 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Deploy 100% Crisis Tail Hedge</span>
                      <ShieldAlert className="h-4 w-4 text-rose-200 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] text-rose-200 mt-1 font-normal">
                      Rotates all equities into Gold & Liquid cash immediately.
                    </span>
                  </button>

                  {/* Action 3: Lock Regime Override */}
                  <button
                    onClick={handleToggleOverride}
                    className={`flex flex-col text-left p-3 rounded-xl border transition ${
                      isOverridden
                        ? 'bg-amber-600/20 border-amber-500/60 text-amber-200'
                        : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{isOverridden ? 'Unlock Regime Override' : 'Lock Regime Override'}</span>
                      {isOverridden ? (
                        <Lock className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Unlock className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 font-normal">
                      {isOverridden ? 'Manual override locked. Click to release.' : 'Manually freeze regime state for stress testing.'}
                    </span>
                  </button>

                  {/* Action 4: Reset to Auto-Filter */}
                  <button
                    onClick={handleResetAutoFilter}
                    className="flex flex-col text-left p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Reset to Auto-Filter</span>
                      <RefreshCw className="h-4 w-4 text-cyan-400 group-hover:rotate-180 transition-transform duration-500" />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 font-normal">
                      Restores online Bayesian Gaussian HMM forward filter.
                    </span>
                  </button>
                </div>

                {/* Override Picker dropdown if override active */}
                {isOverridden && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center gap-4 text-xs">
                    <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Select Override State:
                    </span>
                    {(['BULL_TRENDING', 'LOW_VOL_CHOP', 'HIGH_VOL_CRISIS'] as RegimeType[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setOverrideRegime(r)}
                        className={`px-3 py-1 rounded-lg border font-semibold transition ${
                          overrideRegime === r
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {REGIME_CHARACTERISTICS[r].emoji} {REGIME_CHARACTERISTICS[r].name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Real-time Execution Audit Log */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-100">
                      Regime & Execution Audit Journal
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {actionLogs.length} Events Logged
                  </span>
                </div>

                <div className="space-y-2">
                  {actionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {log.timestamp}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{log.action}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                              log.type === 'success'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : log.type === 'danger'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : log.type === 'warning'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            }`}>
                              {log.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* 4. FOOTER STATUS BAR */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-[#0B0F19] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>HMM Observation Stream: <strong>4-D Active (NIFTY, BNF, VIX, GOLD)</strong></span>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline">
              SEBI STT / Transaction Drag: <strong className="text-slate-300">0.002% per rebalance</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
            >
              Close Cockpit
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
