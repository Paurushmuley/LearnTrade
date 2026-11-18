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
  Cpu,
  Crosshair,
  DollarSign,
  Flame,
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
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  ASMMActionFeedback,
  ASMMParameters,
  ASMMTicker,
  ASMMWorkspaceView,
  QuoteLevel,
  SimulationStep,
} from '../types/avellanedaStoikov';
import {
  ASMM_TICKER_CONFIGS,
  generateASMMHistoricalSimulation,
  generateASMMQuoteLadder,
} from '../lib/avellanedaStoikovEngine';

export interface AvellanedaStoikovCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice?: number;
}

export const AvellanedaStoikovCockpitModal: React.FC<AvellanedaStoikovCockpitModalProps> = ({
  isOpen,
  onClose,
  spotPrice: externalSpotPrice,
}) => {
  // Navigation & Workspace View
  const [activeView, setActiveView] = useState<ASMMWorkspaceView>('quote_ladder');

  // Selected Ticker
  const [selectedTicker, setSelectedTicker] = useState<ASMMTicker>('NIFTY');

  // Interactive Model Parameters
  const [gamma, setGamma] = useState<number>(0.075); // Risk aversion
  const [sigma, setSigma] = useState<number>(18.2); // Volatility
  const [kappa, setKappa] = useState<number>(1.45); // Liquidity intensity
  const [timeHorizon, setTimeHorizon] = useState<number>(0.5); // (T - t) normalized session fraction
  const [maxInventory, setMaxInventory] = useState<number>(40); // Q_max
  const [manualInventory, setManualInventory] = useState<number>(6); // Current inventory q (lots)

  // Simulation Refresh Trigger
  const [simSeed, setSimSeed] = useState<number>(1);

  // Execution actions feedback
  const [actionHistory, setActionHistory] = useState<ASMMActionFeedback[]>([]);
  const [activeAlertToast, setActiveAlertToast] = useState<string | null>(null);

  // Active configuration based on ticker
  const tickerConfig = useMemo(() => {
    return ASMM_TICKER_CONFIGS[selectedTicker];
  }, [selectedTicker]);

  // Spot price: external prop or ticker default
  const effectiveMidPrice = useMemo(() => {
    if (externalSpotPrice && externalSpotPrice > 0 && selectedTicker === 'NIFTY') {
      return externalSpotPrice;
    }
    return tickerConfig.defaultPrice;
  }, [externalSpotPrice, selectedTicker, tickerConfig]);

  // Combined parameters object
  const currentParams: ASMMParameters = useMemo(() => ({
    gamma,
    sigma,
    kappa,
    timeHorizon,
    maxInventory,
    orderArrivalA: 15.0,
  }), [gamma, sigma, kappa, timeHorizon, maxInventory]);

  // Synchronize ticker defaults when ticker changes
  const handleSelectTicker = (ticker: ASMMTicker) => {
    setSelectedTicker(ticker);
    const cfg = ASMM_TICKER_CONFIGS[ticker];
    setGamma(cfg.defaultGamma);
    setSigma(cfg.defaultSigma);
    setKappa(cfg.defaultKappa);
    setMaxInventory(cfg.defaultMaxInventory);
    setManualInventory(Math.round(cfg.defaultMaxInventory * 0.15));
    setSimSeed((prev) => prev + 1);
  };

  // Order Book DOM Ladder & Optimal Quotes overlay
  const quoteLadder = useMemo(() => {
    return generateASMMQuoteLadder(
      effectiveMidPrice,
      manualInventory,
      currentParams,
      tickerConfig.tickSize
    );
  }, [effectiveMidPrice, manualInventory, currentParams, tickerConfig.tickSize]);

  // High Frequency Simulation Run
  const simulation = useMemo(() => {
    return generateASMMHistoricalSimulation(
      selectedTicker,
      currentParams,
      effectiveMidPrice,
      35
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicker, currentParams, effectiveMidPrice, simSeed]);

  // Current active step (latest in timeline)
  const latestStep = simulation.steps[simulation.steps.length - 1];

  // Headroom and Inventory Utilization
  const inventoryUtilization = Math.min(
    100,
    Math.round((Math.abs(manualInventory) / maxInventory) * 100)
  );

  const boundaryAlert = useMemo(() => {
    if (inventoryUtilization >= 100) return 'HARD_LIMIT_BREACH';
    if (inventoryUtilization >= 70) return 'WARNING_HIGH_INVENTORY';
    return 'OPTIMAL';
  }, [inventoryUtilization]);

  // 1-Click Inventory Actions
  const handleAction = useCallback((actionType: 'FLATTEN' | 'SKEW_LIQUIDATE' | 'WIDEN_DEFENSIVE' | 'RESET') => {
    const ts = new Date().toLocaleTimeString();
    if (actionType === 'FLATTEN') {
      const prevInv = manualInventory;
      setManualInventory(0);
      const feedback: ASMMActionFeedback = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: ts,
        action: 'FLATTEN',
        title: 'Immediate Market Flatten Executed',
        description: `Crossed DOM spread with IOC market orders. Unwound ${Math.abs(prevInv)} lots to 0 delta.`,
        impact: `Inventory reset to 0 | Risk headroom restored to 100%`,
      };
      setActionHistory((prev) => [feedback, ...prev.slice(0, 9)]);
      setActiveAlertToast(`⚡ Flattened inventory from ${prevInv} lots to 0 delta!`);
    } else if (actionType === 'SKEW_LIQUIDATE') {
      // Skew aggressively by increasing gamma and setting bias
      setGamma((prev) => Number((prev * 2.2).toFixed(3)));
      const feedback: ASMMActionFeedback = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: ts,
        action: 'SKEW_LIQUIDATE',
        title: 'Aggressive Quote Skew Activated',
        description: `Scaled risk aversion γ to ${(gamma * 2.2).toFixed(3)}. Lowered ask prices deep into book to prioritize liquidation.`,
        impact: `Ask fill probability increased by +85% | Expected inventory reduction: ~60%`,
      };
      setActionHistory((prev) => [feedback, ...prev.slice(0, 9)]);
      setActiveAlertToast(`🚀 Quotes skewed aggressively to induce counterparty fill flow!`);
    } else if (actionType === 'WIDEN_DEFENSIVE') {
      // Widen spreads defensively against jump risk
      setKappa((prev) => Number((Math.max(0.2, prev * 0.5)).toFixed(2)));
      setSigma((prev) => Number((prev * 1.5).toFixed(1)));
      const feedback: ASMMActionFeedback = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: ts,
        action: 'WIDEN_DEFENSIVE',
        title: 'Defensive Spread Multiplier Triggered',
        description: `Vol σ bumped +50%, Liquidity κ contracted -50%. Spread widened to avoid adverse selection fills.`,
        impact: `Optimal Spread widened by +120% | Poison-flow fill risk mitigated`,
      };
      setActionHistory((prev) => [feedback, ...prev.slice(0, 9)]);
      setActiveAlertToast(`🛡️ Quotes widened defensively to protect maker capital!`);
    } else if (actionType === 'RESET') {
      const cfg = ASMM_TICKER_CONFIGS[selectedTicker];
      setGamma(cfg.defaultGamma);
      setSigma(cfg.defaultSigma);
      setKappa(cfg.defaultKappa);
      setMaxInventory(cfg.defaultMaxInventory);
      setManualInventory(Math.round(cfg.defaultMaxInventory * 0.15));
      setTimeHorizon(0.5);
      setSimSeed((prev) => prev + 1);
      const feedback: ASMMActionFeedback = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: ts,
        action: 'RESET',
        title: 'Simulation & Parameters Reset',
        description: `Restored standard analytical calibration for ${selectedTicker}. Seeded new Brownian paths.`,
        impact: `Clean telemetry state ready for forward benchmarking`,
      };
      setActionHistory((prev) => [feedback, ...prev.slice(0, 9)]);
      setActiveAlertToast(`🔄 Avellaneda-Stoikov parameters & simulation re-calibrated!`);
    }

    setTimeout(() => {
      setActiveAlertToast(null);
    }, 4000);
  }, [manualInventory, gamma, selectedTicker]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl text-slate-100 overflow-hidden font-sans">
        
        {/* Cockpit Top Bar / Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800/80 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Optimal Avellaneda-Stoikov HFT Market Making Engine
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
                    Sprint 26
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Continuous inventory control, reservation price desk $r(s,q)$, & Poisson-arrival optimal asymmetric quotes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Ticker Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
              {(['NIFTY', 'BANKNIFTY', 'RELIANCE'] as ASMMTicker[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleSelectTicker(t)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    selectedTicker === t
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Live Clock / Engine Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs font-mono text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>HFT WIRE: 1.2ms</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
              aria-label="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 sm:px-6 bg-[#0B0F19] border-b border-slate-800/80">
          {/* 1. Mid Price */}
          <div className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400">Mid Price (s)</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm sm:text-base font-extrabold font-mono text-slate-100">
                ₹{effectiveMidPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-mono text-cyan-400">Tick: 0.05</span>
            </div>
          </div>

          {/* 2. Reservation Price r(s,q) */}
          <div className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-400">Reservation r(s,q)</span>
              <span className={`text-[10px] font-mono ${quoteLadder.inventorySkew < 0 ? 'text-rose-400' : quoteLadder.inventorySkew > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {quoteLadder.inventorySkew >= 0 ? `+₹${quoteLadder.inventorySkew}` : `-₹${Math.abs(quoteLadder.inventorySkew)}`}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm sm:text-base font-extrabold font-mono text-cyan-400">
                ₹{quoteLadder.reservationPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {quoteLadder.inventorySkewBps} bps
              </span>
            </div>
          </div>

          {/* 3. Inventory q */}
          <div className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-400">Inventory q</span>
              <span className={`text-[10px] font-mono font-bold ${
                boundaryAlert === 'HARD_LIMIT_BREACH' ? 'text-rose-400' :
                boundaryAlert === 'WARNING_HIGH_INVENTORY' ? 'text-amber-400' :
                'text-emerald-400'
              }`}>
                {inventoryUtilization}% Qmax
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={`text-sm sm:text-base font-extrabold font-mono ${
                manualInventory > 0 ? 'text-emerald-400' : manualInventory < 0 ? 'text-rose-400' : 'text-slate-100'
              }`}>
                {manualInventory > 0 ? `+${manualInventory}` : manualInventory} <span className="text-xs text-slate-400 font-sans">lots</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ±{maxInventory} max
              </span>
            </div>
          </div>

          {/* 4. Optimal Spread δ^a + δ^b */}
          <div className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-400">Optimal Spread</span>
              <span className="text-[10px] font-mono text-emerald-400">
                {quoteLadder.optimalSpreadBps} bps
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm sm:text-base font-extrabold font-mono text-amber-300">
                ₹{quoteLadder.optimalSpread.toFixed(2)}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                δ=₹{(quoteLadder.optimalSpread / 2).toFixed(2)}
              </span>
            </div>
          </div>

          {/* 5. Inventory Skew Factor */}
          <div className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400">Quote Skew Lean</span>
            <div className="mt-1 flex items-center justify-between">
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                quoteLadder.quoteSkewLean === 'ASYMMETRIC_BID_LEAN'
                  ? 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
                  : quoteLadder.quoteSkewLean === 'ASYMMETRIC_ASK_LEAN'
                  ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                  : 'bg-slate-800/60 border border-slate-700/60 text-slate-300'
              }`}>
                {quoteLadder.quoteSkewLean === 'ASYMMETRIC_BID_LEAN' ? 'BID DUMP' : quoteLadder.quoteSkewLean === 'ASYMMETRIC_ASK_LEAN' ? 'ASK LIFT' : 'SYMMETRIC'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {quoteLadder.inventorySkewBps} bps
              </span>
            </div>
          </div>

          {/* 6. Cumulative P&L */}
          <div className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-400">Sim Net P&L</span>
              <span className="text-[10px] font-mono text-cyan-400">
                {simulation.attribution.totalFills} fills
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={`text-sm sm:text-base font-extrabold font-mono ${
                simulation.attribution.netCumulativePnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {simulation.attribution.netCumulativePnL >= 0 ? '+' : ''}₹{simulation.attribution.netCumulativePnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                SR {simulation.attribution.sharpeRatio}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {activeAlertToast && (
          <div className="px-6 py-2 bg-cyan-950/70 border-b border-cyan-800/60 text-xs font-mono text-cyan-300 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>{activeAlertToast}</span>
            </div>
            <button
              onClick={() => setActiveAlertToast(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Workspace Tab Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-2">
          <button
            onClick={() => setActiveView('quote_ladder')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeView === 'quote_ladder'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>1. Avellaneda-Stoikov Quote Ladder & Reservation Desk</span>
          </button>

          <button
            onClick={() => setActiveView('inventory_path')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeView === 'inventory_path'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>2. Inventory Path & P&L Attribution Tracker</span>
          </button>

          <button
            onClick={() => setActiveView('rebalancing_console')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeView === 'rebalancing_console'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="h-4 w-4" />
            <span>3. Execution & Inventory Rebalancing Console</span>
          </button>
        </div>

        {/* Workspace Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* VIEW 1: Quote Ladder & Reservation Desk */}
          {activeView === 'quote_ladder' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left 5 Cols: Real-time Mathematical Parameter Sliders */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-cyan-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          Avellaneda-Stoikov Hyperparameters
                        </h3>
                      </div>
                      <button
                        onClick={() => handleAction('RESET')}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" /> Reset
                      </button>
                    </div>

                    {/* Gamma (Risk Aversion) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium">Risk Aversion (γ)</span>
                        <span className="font-mono text-cyan-400 font-bold">{gamma.toFixed(3)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.005"
                        max="0.4"
                        step="0.005"
                        value={gamma}
                        onChange={(e) => setGamma(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Risk Neutral (0.005)</span>
                        <span>Aggressive Hedger (0.40)</span>
                      </div>
                    </div>

                    {/* Sigma (Volatility) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium">Underlying Volatility (σ)</span>
                        <span className="font-mono text-amber-400 font-bold">₹{sigma.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="100.0"
                        step="0.5"
                        value={sigma}
                        onChange={(e) => setSigma(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Low Vol (₹1)</span>
                        <span>High Jump Vol (₹100)</span>
                      </div>
                    </div>

                    {/* Kappa (Order Book Liquidity Density) */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium">Liquidity Intensity (κ)</span>
                        <span className="font-mono text-emerald-400 font-bold">{kappa.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="5.0"
                        step="0.05"
                        value={kappa}
                        onChange={(e) => setKappa(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Thin Book / Illiquid (0.2)</span>
                        <span>Thick Book / Tight (5.0)</span>
                      </div>
                    </div>

                    {/* Current Inventory Slider q */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-bold">Inventory Override (q lots)</span>
                        <span className={`font-mono font-bold ${
                          manualInventory > 0 ? 'text-emerald-400' : manualInventory < 0 ? 'text-rose-400' : 'text-slate-300'
                        }`}>
                          {manualInventory > 0 ? `+${manualInventory}` : manualInventory} lots ({manualInventory * tickerConfig.lotSize} units)
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-maxInventory}
                        max={maxInventory}
                        step="1"
                        value={manualInventory}
                        onChange={(e) => setManualInventory(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Short Max (-{maxInventory})</span>
                        <span>Neutral (0)</span>
                        <span>Long Max (+{maxInventory})</span>
                      </div>
                    </div>

                    {/* Remaining Session Time T - t */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium">Time to Close (T - t)</span>
                        <span className="font-mono text-purple-400 font-bold">{(timeHorizon * 100).toFixed(0)}% day</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1.0"
                        step="0.05"
                        value={timeHorizon}
                        onChange={(e) => setTimeHorizon(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                      />
                    </div>
                  </div>

                  {/* Mathematical Formula Card */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 text-xs font-mono space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Analytical Equilibrium Equations
                    </span>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 text-cyan-300 space-y-1">
                      <div>r(s, q) = s - q · γ · σ² · (T - t)</div>
                      <div className="text-[10px] text-slate-400">
                        = {effectiveMidPrice.toFixed(2)} - ({manualInventory} · {gamma.toFixed(3)} · {sigma.toFixed(1)}² · {timeHorizon.toFixed(2)})
                      </div>
                      <div className="text-emerald-400 font-bold">
                        = ₹{quoteLadder.reservationPrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 text-amber-300 space-y-1">
                      <div>δ^a + δ^b = γ · σ² · (T - t) + (2/γ) · ln(1 + γ/κ)</div>
                      <div className="text-amber-400 font-bold">
                        = ₹{quoteLadder.optimalSpread.toFixed(2)} ({quoteLadder.optimalSpreadBps} bps)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 7 Cols: Active Quote Ladder & L2 DOM Depth Visualizer */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                          <Layers className="h-4 w-4 text-cyan-400" />
                          Avellaneda-Stoikov Active Quotes vs Order Book Depth
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Yellow/Cyan glowing bars represent the Market Maker&apos;s optimal Bid & Ask placements
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Mid Spread</span>
                        <div className="text-xs font-mono font-bold text-slate-300">
                          ₹{(quoteLadder.asks[0]?.price - quoteLadder.bids[0]?.price).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Quote Ladder DOM Representation */}
                    <div className="space-y-1 font-mono text-xs">
                      {/* ASKS (Reversed so highest ask on top) */}
                      <div className="space-y-1">
                        {[...quoteLadder.asks].reverse().map((ask: QuoteLevel) => {
                          const isMakerAsk = ask.isASMMQuote;
                          return (
                            <div
                              key={`ask-${ask.level}`}
                              className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg border transition ${
                                isMakerAsk
                                  ? 'bg-rose-950/40 border-rose-500/70 text-rose-200 shadow-sm shadow-rose-950'
                                  : 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                              }`}
                            >
                              {/* Background depth gauge */}
                              <div
                                className="absolute right-0 top-0 bottom-0 bg-rose-500/10 rounded-r-lg pointer-events-none"
                                style={{ width: `${Math.min(100, (ask.size / 1500) * 100)}%` }}
                              />
                              <div className="flex items-center gap-2 z-10">
                                <span className="text-[10px] font-bold text-rose-400 uppercase">
                                  ASK L{ask.level}
                                </span>
                                {isMakerAsk && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold animate-pulse">
                                    OPTIMAL ASMM ASK
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 z-10">
                                <span className="text-slate-400 text-[10px]">
                                  +{ask.distanceFromMid.toFixed(2)} ({ask.distanceBps} bps)
                                </span>
                                <span className="font-bold text-rose-400">
                                  ₹{ask.price.toFixed(2)}
                                </span>
                                <span className="w-16 text-right text-slate-300 font-bold">
                                  {ask.size}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* MIDPRICE & RESERVATION PRICE DIVIDER */}
                      <div className="my-2 p-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/30 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Compass className="h-4 w-4 text-cyan-400" />
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              Midpoint $s$
                            </span>
                            <span className="font-bold text-slate-200">
                              ₹{effectiveMidPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="text-center px-3 py-1 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
                            Inventory Skew r(s,q) - s
                          </span>
                          <span className={`font-bold ${quoteLadder.inventorySkew < 0 ? 'text-rose-400' : quoteLadder.inventorySkew > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {quoteLadder.inventorySkew >= 0 ? `+₹${quoteLadder.inventorySkew.toFixed(2)}` : `-₹${Math.abs(quoteLadder.inventorySkew).toFixed(2)}`} ({quoteLadder.inventorySkewBps} bps)
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-right">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-cyan-400 block">
                              Reservation $r(s,q)$
                            </span>
                            <span className="font-bold text-cyan-300">
                              ₹{quoteLadder.reservationPrice.toFixed(2)}
                            </span>
                          </div>
                          <Crosshair className="h-4 w-4 text-cyan-400" />
                        </div>
                      </div>

                      {/* BIDS */}
                      <div className="space-y-1">
                        {quoteLadder.bids.map((bid: QuoteLevel) => {
                          const isMakerBid = bid.isASMMQuote;
                          return (
                            <div
                              key={`bid-${bid.level}`}
                              className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg border transition ${
                                isMakerBid
                                  ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-200 shadow-sm shadow-emerald-950'
                                  : 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                              }`}
                            >
                              {/* Background depth gauge */}
                              <div
                                className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded-r-lg pointer-events-none"
                                style={{ width: `${Math.min(100, (bid.size / 1500) * 100)}%` }}
                              />
                              <div className="flex items-center gap-2 z-10">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase">
                                  BID L{bid.level}
                                </span>
                                {isMakerBid && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold animate-pulse">
                                    OPTIMAL ASMM BID
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 z-10">
                                <span className="text-slate-400 text-[10px]">
                                  {bid.distanceFromMid.toFixed(2)} ({bid.distanceBps} bps)
                                </span>
                                <span className="font-bold text-emerald-400">
                                  ₹{bid.price.toFixed(2)}
                                </span>
                                <span className="w-16 text-right text-slate-300 font-bold">
                                  {bid.size}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Inventory Path & P&L Attribution Tracker */}
          {activeView === 'inventory_path' && (
            <div className="space-y-6">
              {/* Attribution KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] uppercase font-mono text-slate-400">
                    Gross Spread Capture
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xl font-black font-mono text-emerald-400">
                      +₹{simulation.attribution.spreadCapturePnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-emerald-500 font-mono">
                      {simulation.attribution.totalFills} fills
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Maker half-spread profit captured on matched orders
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] uppercase font-mono text-slate-400">
                    Inventory Depreciation / Drift
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className={`text-xl font-black font-mono ${
                      simulation.attribution.inventoryDepreciationPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {simulation.attribution.inventoryDepreciationPnL >= 0 ? '+' : ''}₹{simulation.attribution.inventoryDepreciationPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Mark-to-Market
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Adverse selection drift cost $q \cdot \Delta S$
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] uppercase font-mono text-slate-400">
                    SEBI & Turnover Fees
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xl font-black font-mono text-slate-300">
                      -₹{simulation.attribution.exchangeFees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ₹28.5 / turn
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Turnover charges & exchange routing fees
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-cyan-500/40 bg-cyan-950/30">
                  <span className="text-[10px] uppercase font-mono text-cyan-300">
                    Net Strategy P&L
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className={`text-xl font-black font-mono ${
                      simulation.attribution.netCumulativePnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {simulation.attribution.netCumulativePnL >= 0 ? '+' : ''}₹{simulation.attribution.netCumulativePnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-cyan-400 font-mono font-bold">
                      Sharpe {simulation.attribution.sharpeRatio}
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-200/80 mt-1">
                    Total risk-adjusted alpha after inventory control
                  </p>
                </div>
              </div>

              {/* Inventory Oscillation Bar Chart Timeline */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-cyan-400" />
                      Inventory Path $q_t$ Oscillations within [-Q_max, +Q_max]
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Visualizing how the reservation price skew dynamically forces inventory mean-reversion toward 0
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-emerald-400">Max Long: +{simulation.attribution.maxInventoryReached}</span>
                    <span className="text-rose-400">Max Short: {simulation.attribution.minInventoryReached}</span>
                    <button
                      onClick={() => setSimSeed((prev) => prev + 1)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-mono flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Re-Simulate
                    </button>
                  </div>
                </div>

                {/* Step Bar Visualization */}
                <div className="h-36 flex items-end gap-1.5 pt-4 pb-2 px-2 bg-slate-950/60 rounded-xl border border-slate-800/60 overflow-x-auto scrollbar-thin">
                  {simulation.steps.map((step: SimulationStep) => {
                    const heightPct = Math.min(100, Math.max(8, (Math.abs(step.inventory) / maxInventory) * 100));
                    const isLong = step.inventory > 0;
                    const isShort = step.inventory < 0;

                    return (
                      <div
                        key={`step-${step.stepIndex}`}
                        className="flex-1 min-w-[14px] flex flex-col items-center justify-center h-full group relative"
                      >
                        {/* Tooltip on hover */}
                        <div className="hidden group-hover:block absolute bottom-full mb-2 z-30 p-2 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-200 shadow-xl pointer-events-none whitespace-nowrap">
                          <div className="font-bold text-cyan-400">Step #{step.stepIndex} ({step.timestamp})</div>
                          <div>Mid: ₹{step.midPrice.toFixed(2)} | Res: ₹{step.reservationPrice.toFixed(2)}</div>
                          <div>Inv: {step.inventory} lots ({step.inventoryUtilizationPct}%)</div>
                          <div>Event: {step.event}</div>
                          <div>Net PnL: ₹{step.totalPnL.toFixed(2)}</div>
                        </div>

                        {/* Inventory Bar */}
                        <div className="w-full flex flex-col justify-center items-center h-full">
                          {isLong ? (
                            <div className="w-full h-1/2 flex items-end">
                              <div
                                className="w-full bg-emerald-500/80 rounded-t-sm group-hover:bg-emerald-400 transition"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                          ) : isShort ? (
                            <div className="w-full h-1/2 flex items-start">
                              <div
                                className="w-full bg-rose-500/80 rounded-b-sm group-hover:bg-rose-400 transition"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                          ) : (
                            <div className="w-full h-0.5 bg-slate-700" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500 px-2">
                  <span>Step 1 (Start)</span>
                  <span>Neutral Line (q = 0)</span>
                  <span>Step {simulation.steps.length} (Latest)</span>
                </div>
              </div>

              {/* Step Audit Stream Table */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Step-by-Step Order Book Execution & Fill Telemetry
                </h4>
                <div className="overflow-x-auto max-h-60 scrollbar-thin">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2">Step</th>
                        <th className="p-2">Time</th>
                        <th className="p-2">Mid Price</th>
                        <th className="p-2">Reservation r</th>
                        <th className="p-2">Inventory q</th>
                        <th className="p-2">Fill Event</th>
                        <th className="p-2">Spread Capture</th>
                        <th className="p-2">Depreciation</th>
                        <th className="p-2 text-right">Total P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {simulation.steps.slice(-15).reverse().map((s: SimulationStep) => (
                        <tr key={`audit-${s.stepIndex}`} className="hover:bg-slate-800/40">
                          <td className="p-2 text-slate-400">#{s.stepIndex}</td>
                          <td className="p-2 text-slate-400">{s.timestamp}</td>
                          <td className="p-2 text-slate-200">₹{s.midPrice.toFixed(2)}</td>
                          <td className="p-2 text-cyan-400">₹{s.reservationPrice.toFixed(2)}</td>
                          <td className={`p-2 font-bold ${s.inventory > 0 ? 'text-emerald-400' : s.inventory < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {s.inventory > 0 ? `+${s.inventory}` : s.inventory}
                          </td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              s.event === 'DOUBLE_FILL' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' :
                              s.event === 'BID_FILLED' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' :
                              s.event === 'ASK_FILLED' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60' :
                              'text-slate-500'
                            }`}>
                              {s.event}
                            </span>
                          </td>
                          <td className="p-2 text-emerald-400">+₹{s.spreadCapturePnL.toFixed(2)}</td>
                          <td className={`p-2 ${s.inventoryDepreciationPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {s.inventoryDepreciationPnL >= 0 ? '+' : ''}₹{s.inventoryDepreciationPnL.toFixed(2)}
                          </td>
                          <td className={`p-2 text-right font-bold ${s.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {s.totalPnL >= 0 ? '+' : ''}₹{s.totalPnL.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: Execution & Inventory Rebalancing Console */}
          {activeView === 'rebalancing_console' && (
            <div className="space-y-6">
              
              {/* Boundary Alert & Skew Lean Banner */}
              <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
                boundaryAlert === 'HARD_LIMIT_BREACH'
                  ? 'bg-rose-950/40 border-rose-500/80 text-rose-200'
                  : boundaryAlert === 'WARNING_HIGH_INVENTORY'
                  ? 'bg-amber-950/40 border-amber-500/80 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl border ${
                    boundaryAlert === 'HARD_LIMIT_BREACH'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : boundaryAlert === 'WARNING_HIGH_INVENTORY'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  }`}>
                    {boundaryAlert === 'HARD_LIMIT_BREACH' ? (
                      <AlertOctagon className="h-6 w-6" />
                    ) : boundaryAlert === 'WARNING_HIGH_INVENTORY' ? (
                      <AlertTriangle className="h-6 w-6" />
                    ) : (
                      <ShieldCheck className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">
                      {boundaryAlert === 'HARD_LIMIT_BREACH'
                        ? 'CRITICAL: Inventory Limit ±Qmax Reached!'
                        : boundaryAlert === 'WARNING_HIGH_INVENTORY'
                        ? 'WARNING: Inventory Utilization Exceeds 70%'
                        : 'OPTIMAL: Inventory Within Safe Tolerance'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Current: <strong>{manualInventory} lots</strong> / ±{maxInventory} lots ({inventoryUtilization}% capacity). 
                      Quote skew lean: <strong className="uppercase">{quoteLadder.quoteSkewLean.replace(/_/g, ' ')}</strong> ({quoteLadder.inventorySkewBps} bps bias).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleAction('FLATTEN')}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition flex items-center gap-2"
                  >
                    <Flame className="h-4 w-4" />
                    <span>Flatten to 0 Now</span>
                  </button>
                </div>
              </div>

              {/* 1-Click Inventory Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Action 1: Flatten Inventory to 0 */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-rose-400 mb-1">
                      <Flame className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase">Flatten Inventory to 0</h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Instantly crosses the bid/ask spread with market IOC orders to unwind open inventory and restore neutral delta.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAction('FLATTEN')}
                    className="w-full py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <span>Execute 1-Click Flatten</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Action 2: Skew Aggressive to Liquidate */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-400 mb-1">
                      <TrendingDown className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase">Skew Aggressive to Liquidate</h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Multiplies risk aversion γ by 2.2x and drops quotes deeply into order flow to maximize passive fill probabilities.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAction('SKEW_LIQUIDATE')}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <span>Activate Aggressive Skew</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Action 3: Widen Defensive Spread */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 mb-1">
                      <Shield className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase">Widen Defensive Spread</h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Expands optimal bid/ask spread δ by +120% to avoid adverse selection fills during sudden volatility surges or news jumps.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAction('WIDEN_DEFENSIVE')}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <span>Widen Spreads 2x</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Action 4: Reset Simulation */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-purple-400 mb-1">
                      <RefreshCw className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase">Reset Simulation</h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Restores default ticker parameters for {selectedTicker} and resets inventory to baseline benchmark state.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAction('RESET')}
                    className="w-full py-2 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <span>Reset Calibration</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Audit & Execution Log */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Avellaneda-Stoikov Execution & Rebalancing Journal
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    Live Event Stream
                  </span>
                </div>

                {actionHistory.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs font-mono">
                    No rebalancing interventions executed yet. Click any 1-Click Action above to test liquidity adjustments.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {actionHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-bold text-slate-200">{item.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{item.description}</div>
                            <div className="text-[10px] font-mono text-cyan-400 mt-1">{item.impact}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                          {item.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Cockpit Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-slate-800/80 bg-slate-950/90 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>Avellaneda-Stoikov (2008) Framework Active</span>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline">
              Poisson Fill Arrival: λ(δ) = A·exp(-κ·δ)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Close Cockpit
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
