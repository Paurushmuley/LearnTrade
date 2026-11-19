'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  FastForward,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  Pause,
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
  X,
  Zap,
} from 'lucide-react';
import {
  ACTicker,
  ACWorkspaceView,
  OrderSide,
  ACModelParameters,
  ACTrajectoryPoint,
  ACSlicedOrderStep,
  ACEfficientFrontierPoint,
  ACMetricsStripData,
} from '../types/almgrenChriss';
import {
  AC_TICKER_CONFIGS,
  calculateSigmaPerMin,
  calculateKappa,
  calculateOptimalHalfLife,
  generateTrajectoryPoints,
  generateSlicedOrderSteps,
  generateEfficientFrontier,
  calculateACMetricsStrip,
} from '../lib/almgrenChrissEngine';

export interface AlmgrenChrissCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice?: number;
}

export const AlmgrenChrissCockpitModal: React.FC<AlmgrenChrissCockpitModalProps> = ({
  isOpen,
  onClose,
  spotPrice: externalSpotPrice,
}) => {
  // Navigation & Workspace View
  const [activeView, setActiveView] = useState<ACWorkspaceView>('trajectory');

  // Selected Ticker & Order Side
  const [selectedTicker, setSelectedTicker] = useState<ACTicker>('NIFTY');
  const [orderSide, setOrderSide] = useState<OrderSide>('SELL');

  // Interactive Model Parameters
  const [orderSize, setOrderSize] = useState<number>(5000);
  const [horizonMinutes, setHorizonMinutes] = useState<number>(60);
  const [riskAversionLambda, setRiskAversionLambda] = useState<number>(1.5e-6); // λ
  const [tempImpactEta, setTempImpactEta] = useState<number>(3.2e-5);           // η
  const [permImpactGamma, setPermImpactGamma] = useState<number>(1.2e-5);       // γ
  const [volatilityAnnualPct, setVolatilityAnnualPct] = useState<number>(13.8); // σ %
  const [numSlices, setNumSlices] = useState<number>(12);                       // N slices

  // Chart View Toggle (Holdings vs Trade Rate)
  const [chartMode, setChartMode] = useState<'holdings' | 'tradeRate'>('holdings');

  // Hover states for interactive SVG charts
  const [hoveredTrajectoryPoint, setHoveredTrajectoryPoint] = useState<ACTrajectoryPoint | null>(null);
  const [hoveredFrontierPoint, setHoveredFrontierPoint] = useState<ACEfficientFrontierPoint | null>(null);

  // Live Slicing Execution State
  const [currentExecutionStep, setCurrentExecutionStep] = useState<number>(0);
  const [isAutoExecuting, setIsAutoExecuting] = useState<boolean>(false);
  const [executionSpeedMs, setExecutionSpeedMs] = useState<number>(1200);
  const [executionLogs, setExecutionLogs] = useState<Array<{ timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'action' }>>([]);

  const executionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active configuration based on ticker
  const tickerConfig = useMemo(() => {
    return AC_TICKER_CONFIGS[selectedTicker];
  }, [selectedTicker]);

  // Spot price: external prop or ticker default
  const effectiveMidPrice = useMemo(() => {
    if (externalSpotPrice && externalSpotPrice > 0 && selectedTicker === 'NIFTY') {
      return externalSpotPrice;
    }
    return tickerConfig.defaultPrice;
  }, [externalSpotPrice, selectedTicker, tickerConfig]);

  // Synchronize ticker defaults when ticker changes
  const handleSelectTicker = (ticker: ACTicker) => {
    setSelectedTicker(ticker);
    const cfg = AC_TICKER_CONFIGS[ticker];
    setOrderSize(cfg.defaultOrderSize);
    setHorizonMinutes(cfg.defaultHorizonMin);
    setVolatilityAnnualPct(cfg.defaultVolatilityAnnualPct);
    setTempImpactEta(cfg.defaultTempImpactEta);
    setPermImpactGamma(cfg.defaultPermImpactGamma);
    setCurrentExecutionStep(0);
    setIsAutoExecuting(false);
    addLog(`Switched asset to ${cfg.name} (${ticker}). Parameters recalibrated.`, 'info');
  };

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warn' | 'action' = 'info') => {
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setExecutionLogs((prev) => [{ timestamp: timeStr, message, type }, ...prev.slice(0, 40)]);
  }, []);

  // Combined parameters object
  const currentParams: ACModelParameters = useMemo(() => ({
    ticker: selectedTicker,
    orderSide,
    orderSize,
    horizonMinutes,
    riskAversionLambda,
    tempImpactEta,
    permImpactGamma,
    volatilityAnnualPct,
    arrivalPrice: effectiveMidPrice,
    numSlices,
  }), [
    selectedTicker,
    orderSide,
    orderSize,
    horizonMinutes,
    riskAversionLambda,
    tempImpactEta,
    permImpactGamma,
    volatilityAnnualPct,
    effectiveMidPrice,
    numSlices,
  ]);

  // Derived Calculations
  const metricsStrip: ACMetricsStripData = useMemo(() => {
    return calculateACMetricsStrip(currentParams);
  }, [currentParams]);

  const trajectoryPoints: ACTrajectoryPoint[] = useMemo(() => {
    return generateTrajectoryPoints(currentParams);
  }, [currentParams]);

  const slicedOrderSteps: ACSlicedOrderStep[] = useMemo(() => {
    return generateSlicedOrderSteps(currentParams, currentExecutionStep, !isAutoExecuting && currentExecutionStep > 0 && currentExecutionStep < numSlices);
  }, [currentParams, currentExecutionStep, isAutoExecuting, numSlices]);

  const efficientFrontier: ACEfficientFrontierPoint[] = useMemo(() => {
    return generateEfficientFrontier(currentParams);
  }, [currentParams]);

  // Auto-execution interval simulation
  useEffect(() => {
    if (!isAutoExecuting) {
      if (executionTimerRef.current) clearInterval(executionTimerRef.current);
      return;
    }

    executionTimerRef.current = setInterval(() => {
      setCurrentExecutionStep((prev) => {
        if (prev >= numSlices) {
          setIsAutoExecuting(false);
          addLog(`✓ All ${numSlices} child order slices filled. Order execution cycle complete.`, 'success');
          return prev;
        }
        const nextStep = prev + 1;
        const sliceData = slicedOrderSteps[nextStep - 1];
        if (sliceData) {
          addLog(
            `Slice #${nextStep}/${numSlices} Filled: ${sliceData.targetQty.toLocaleString('en-IN')} shares @ ₹${sliceData.fillPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Impact: ${sliceData.totalImpactBps.toFixed(1)} bps)`,
            'success'
          );
        }
        return nextStep;
      });
    }, executionSpeedMs);

    return () => {
      if (executionTimerRef.current) clearInterval(executionTimerRef.current);
    };
  }, [isAutoExecuting, numSlices, executionSpeedMs, slicedOrderSteps, addLog]);

  // 1-Click Control Handlers
  const handleToggleAutoExecute = () => {
    if (currentExecutionStep >= numSlices) {
      setCurrentExecutionStep(0);
    }
    setIsAutoExecuting((prev) => {
      const next = !prev;
      addLog(next ? `Auto-execution initiated across ${numSlices} slices.` : `Execution paused by operator.`, next ? 'action' : 'warn');
      return next;
    });
  };

  const handleAccelerateLiquidation = () => {
    const newLambda = Math.min(1e-3, riskAversionLambda * 4.5);
    setRiskAversionLambda(newLambda);
    addLog(`⚡ Aggressive Liquidation triggered: Risk aversion λ scaled 4.5x to ${newLambda.toExponential(2)}. Slices front-loaded.`, 'action');
  };

  const handlePauseTrajectory = () => {
    setIsAutoExecuting(false);
    addLog(`Trajectory paused at slice #${currentExecutionStep}/${numSlices}. Market impact stabilized.`, 'warn');
  };

  const handleResetSchedule = () => {
    setIsAutoExecuting(false);
    setCurrentExecutionStep(0);
    addLog(`Trajectory schedule reset to t = 0. All tranches reset to SCHEDULED.`, 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-7xl h-[94vh] rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl text-slate-100 overflow-hidden font-sans">
        
        {/* ─────────────────────────────────────────────────────────────────────────────
            HEADER STRIP
        ───────────────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Almgren-Chriss Optimal Execution Cockpit
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Sprint 27 · Institutional Model
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Optimal order slicing $x(t) = X \cdot \frac{'{'}\sinh(\kappa(T-t)){'}'}{'{'}\sinh(\kappa T){'}'}$ · Efficient frontier $E[x]$ vs $V[x]$ · Perold IS Attribution
              </p>
            </div>
          </div>

          {/* Ticker Selector & Side Switch */}
          <div className="flex items-center gap-2.5">
            {/* Side Toggle */}
            <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800">
              <button
                onClick={() => { setOrderSide('SELL'); addLog('Order direction set to SELL (Liquidation).', 'info'); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  orderSide === 'SELL'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SELL (Liquidate)
              </button>
              <button
                onClick={() => { setOrderSide('BUY'); addLog('Order direction set to BUY (Accumulation).', 'info'); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                BUY (Accumulate)
              </button>
            </div>

            {/* Ticker Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
              {(['NIFTY', 'BANKNIFTY', 'RELIANCE'] as ACTicker[]).map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => handleSelectTicker(ticker)}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-md transition ${
                    selectedTicker === ticker
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ticker}
                </button>
              ))}
            </div>

            {/* Mid Price Pill */}
            <div className="hidden sm:flex flex-col items-end px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400">Benchmark S₀</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                ₹{effectiveMidPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Close modal (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            QUICK METRICS STRIP (6 Metrics)
        ───────────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-950/60 border-b border-slate-800/80 shrink-0">
          {/* 1. Total Order Size */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Total Order Size</span>
              <Scale className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-bold font-mono text-cyan-300">
                {metricsStrip.totalOrderSize.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ({metricsStrip.totalOrderLots} lots)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              ₹{(metricsStrip.orderNotionalInr / 100000).toFixed(2)} Lakh notional
            </div>
          </div>

          {/* 2. Total Execution Horizon */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Execution Horizon (T)</span>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-bold font-mono text-amber-300">
                {metricsStrip.horizonMinutes} min
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ({numSlices} slices)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {(metricsStrip.horizonMinutes / numSlices).toFixed(1)} min per interval
            </div>
          </div>

          {/* 3. Risk Aversion λ */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Risk Aversion (λ)</span>
              <Flame className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-bold font-mono text-rose-300">
                {metricsStrip.riskAversionLambda.toExponential(2)}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                κ = {metricsStrip.kappa}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {metricsStrip.riskAversionLambda >= 5e-5 ? 'Aggressive' : metricsStrip.riskAversionLambda <= 5e-7 ? 'Passive' : 'Balanced'}
            </div>
          </div>

          {/* 4. Implementation Shortfall */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Expected Shortfall E[x]</span>
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-bold font-mono text-emerald-300">
                ₹{metricsStrip.expectedCostInr.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                {metricsStrip.expectedCostBps} bps
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              Temp: ₹{metricsStrip.temporaryImpactInr} · Perm: ₹{metricsStrip.permanentImpactInr}
            </div>
          </div>

          {/* 5. Execution Savings vs TWAP */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Utility Advantage vs TWAP</span>
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-bold font-mono text-cyan-300">
                ₹{metricsStrip.executionSavingsVsTwapInr.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                +{metricsStrip.executionSavingsVsTwapBps} bps
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              Risk Variance cut by {metricsStrip.riskReductionPct}%
            </div>
          </div>

          {/* 6. Optimal Half-Life */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Optimal Half-Life (τ½)</span>
              <FastForward className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-base font-bold font-mono text-purple-300">
                {metricsStrip.halfLifeMinutes} min
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ({((metricsStrip.halfLifeMinutes / metricsStrip.horizonMinutes) * 100).toFixed(0)}% T)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              50% liquidated by {metricsStrip.halfLifeMinutes} min
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            WORKSPACE NAVIGATION TABS
        ───────────────────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/40 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveView('trajectory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeView === 'trajectory'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Optimal Trajectory & Multi-Model Horizon</span>
            </button>
            <button
              onClick={() => setActiveView('frontier')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeView === 'frontier'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Cost vs Risk Efficient Frontier</span>
            </button>
            <button
              onClick={() => setActiveView('monitor')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeView === 'monitor'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Live Order Slicing & Execution Monitor</span>
              {currentExecutionStep > 0 && currentExecutionStep < numSlices && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span> Almgren-Chriss
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400 ml-2">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span> TWAP
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400 ml-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span> VWAP
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            MAIN WORKSPACE BODY
        ───────────────────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* VIEW 1: OPTIMAL TRAJECTORY & MULTI-MODEL HORIZON */}
          {activeView === 'trajectory' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 h-full">
              {/* Left 3 Columns: Interactive Trajectory Chart */}
              <div className="lg:col-span-3 flex flex-col rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                {/* Chart Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {chartMode === 'holdings' ? 'Remaining Holdings Trajectory x(t)' : 'Trade Rate & Tranche Volumes n_j'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (N = {numSlices} intervals · Δt = {(horizonMinutes / numSlices).toFixed(1)}m)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Mode Toggle */}
                    <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                      <button
                        onClick={() => setChartMode('holdings')}
                        className={`px-2.5 py-1 rounded-md font-medium transition ${
                          chartMode === 'holdings'
                            ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Holdings Curve x(t)
                      </button>
                      <button
                        onClick={() => setChartMode('tradeRate')}
                        className={`px-2.5 py-1 rounded-md font-medium transition ${
                          chartMode === 'tradeRate'
                            ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Tranche Volume n_j
                      </button>
                    </div>
                  </div>
                </div>

                {/* SVG Visual Chart */}
                <div className="flex-1 min-h-[340px] relative flex flex-col justify-center">
                  <TrajectorySvgChart
                    points={trajectoryPoints}
                    orderSize={orderSize}
                    horizonMin={horizonMinutes}
                    chartMode={chartMode}
                    onHoverPoint={setHoveredTrajectoryPoint}
                    hoveredPoint={hoveredTrajectoryPoint}
                  />

                  {/* Hover Details Floating Banner */}
                  {hoveredTrajectoryPoint && (
                    <div className="absolute top-2 right-2 bg-slate-900/95 border border-cyan-500/30 p-2.5 rounded-xl text-xs font-mono shadow-xl z-20 pointer-events-none">
                      <div className="text-cyan-400 font-bold mb-1 flex items-center justify-between gap-4">
                        <span>Time: {hoveredTrajectoryPoint.timeLabel} ({hoveredTrajectoryPoint.timeMin}m)</span>
                        <span className="text-slate-400 text-[10px]">Slice #{hoveredTrajectoryPoint.sliceIndex}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px]">Almgren-Chriss</span>
                          <span className="text-cyan-300 font-bold">
                            {chartMode === 'holdings' ? hoveredTrajectoryPoint.acHoldings.toLocaleString('en-IN') : hoveredTrajectoryPoint.acTradeQty.toLocaleString('en-IN')} sh
                          </span>
                          <span className="text-slate-500 block text-[9px]">{hoveredTrajectoryPoint.acHoldingsPct}% left</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">TWAP (Uniform)</span>
                          <span className="text-amber-300 font-bold">
                            {chartMode === 'holdings' ? hoveredTrajectoryPoint.twapHoldings.toLocaleString('en-IN') : hoveredTrajectoryPoint.twapTradeQty.toLocaleString('en-IN')} sh
                          </span>
                          <span className="text-slate-500 block text-[9px]">{hoveredTrajectoryPoint.twapHoldingsPct}% left</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">VWAP (U-Curve)</span>
                          <span className="text-emerald-300 font-bold">
                            {chartMode === 'holdings' ? hoveredTrajectoryPoint.vwapHoldings.toLocaleString('en-IN') : hoveredTrajectoryPoint.vwapTradeQty.toLocaleString('en-IN')} sh
                          </span>
                          <span className="text-slate-500 block text-[9px]">{hoveredTrajectoryPoint.vwapHoldingsPct}% left</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mathematical Insight Footnote */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>
                      {riskAversionLambda >= 2e-5 ? (
                        <span className="text-cyan-300 font-medium">Aggressive Front-Loading: Higher λ suppresses price variance risk at the expense of higher initial temporary impact.</span>
                      ) : riskAversionLambda <= 2e-7 ? (
                        <span className="text-amber-300 font-medium">Passive / TWAP Approximation: Lower λ minimizes market impact cost by distributing execution evenly across time.</span>
                      ) : (
                        <span className="text-slate-300 font-medium">Optimal Balance: Trajectory achieves optimal tradeoff between temporary impact and volatility variance risk.</span>
                      )}
                    </span>
                  </div>
                  <div className="font-mono text-cyan-400 text-[10px] shrink-0">
                    Half-Life: {metricsStrip.halfLifeMinutes} min ({((metricsStrip.halfLifeMinutes / horizonMinutes) * 100).toFixed(0)}% of T)
                  </div>
                </div>
              </div>

              {/* Right 1 Column: Interactive Parameters Sliders & Presets */}
              <div className="flex flex-col gap-4 rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" /> Model Parameters
                  </h3>
                  <button
                    onClick={() => {
                      const cfg = tickerConfig;
                      setOrderSize(cfg.defaultOrderSize);
                      setHorizonMinutes(cfg.defaultHorizonMin);
                      setRiskAversionLambda(1.5e-6);
                      setTempImpactEta(cfg.defaultTempImpactEta);
                      setPermImpactGamma(cfg.defaultPermImpactGamma);
                      setNumSlices(12);
                      addLog('Model parameters reset to benchmark defaults.', 'info');
                    }}
                    className="text-[10px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                </div>

                {/* 1. Order Size Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Order Size (X)</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {orderSize.toLocaleString('en-IN')} sh
                    </span>
                  </div>
                  <input
                    type="range"
                    min={tickerConfig.lotSize * 10}
                    max={tickerConfig.lotSize * 400}
                    step={tickerConfig.lotSize}
                    value={orderSize}
                    onChange={(e) => setOrderSize(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>{(tickerConfig.lotSize * 10).toLocaleString('en-IN')}</span>
                    <span>{(orderSize / tickerConfig.lotSize).toFixed(0)} lots</span>
                    <span>{(tickerConfig.lotSize * 400).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* 2. Horizon T Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Execution Horizon (T)</span>
                    <span className="font-mono font-bold text-amber-300">
                      {horizonMinutes} min
                    </span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={360}
                    step={15}
                    value={horizonMinutes}
                    onChange={(e) => setHorizonMinutes(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>15 min</span>
                    <span>{(horizonMinutes / 60).toFixed(1)} hrs</span>
                    <span>360 min (Full Session)</span>
                  </div>
                </div>

                {/* 3. Risk Aversion Presets & Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Risk Aversion (λ)</span>
                    <span className="font-mono font-bold text-rose-300">
                      {riskAversionLambda.toExponential(1)}
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {[
                      { label: 'Passive', val: 1e-7 },
                      { label: 'Balanced', val: 1.5e-6 },
                      { label: 'Aggressive', val: 1.2e-5 },
                      { label: 'Extreme', val: 8e-5 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={() => {
                          setRiskAversionLambda(p.val);
                          addLog(`Risk aversion preset: ${p.label} (λ = ${p.val.toExponential(1)})`, 'info');
                        }}
                        className={`py-1 text-[10px] font-semibold rounded-md border text-center transition ${
                          Math.abs(Math.log10(riskAversionLambda) - Math.log10(p.val)) < 0.2
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={-7.5}
                    max={-3.5}
                    step={0.1}
                    value={Math.log10(riskAversionLambda)}
                    onChange={(e) => setRiskAversionLambda(Math.pow(10, Number(e.target.value)))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>Passive (TWAP)</span>
                    <span>10⁻⁵</span>
                    <span>Ultra Aggressive</span>
                  </div>
                </div>

                {/* 4. Temporary Impact Parameter Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Temporary Impact (η)</span>
                    <span className="font-mono font-bold text-purple-300">
                      {tempImpactEta.toExponential(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-5.5}
                    max={-3.8}
                    step={0.05}
                    value={Math.log10(tempImpactEta)}
                    onChange={(e) => setTempImpactEta(Math.pow(10, Number(e.target.value)))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>Liquid (Low η)</span>
                    <span>Illiquid (High η)</span>
                  </div>
                </div>

                {/* 5. Slices Count (N) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Order Slices (N)</span>
                    <span className="font-mono font-bold text-emerald-300">
                      {numSlices} intervals
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[6, 8, 12, 16, 24].map((slices) => (
                      <button
                        key={slices}
                        onClick={() => setNumSlices(slices)}
                        className={`flex-1 py-1 text-xs font-mono font-semibold rounded-md border text-center transition ${
                          numSlices === slices
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {slices}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1-Click Launch Button into Execution Monitor */}
                <button
                  onClick={() => setActiveView('monitor')}
                  className="mt-auto w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 font-semibold text-xs text-white shadow-lg shadow-cyan-600/20 transition flex items-center justify-center gap-2"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Send to Execution Monitor</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: COST VS RISK EFFICIENT FRONTIER */}
          {activeView === 'frontier' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
              {/* Left 2 Columns: Parabolic/Hyperbolic Frontier Plot */}
              <div className="lg:col-span-2 flex flex-col rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <Compass className="h-4 w-4 text-purple-400" />
                      Cost vs Risk Efficient Frontier (Almgren-Chriss Locus)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Plotting Expected Execution Cost $E[x]$ vs Timing Variance Risk $\sqrt{'{'}V[x]{'}'}$ across all risk aversion coefficients $\lambda$.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-cyan-300">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-400/40"></span> Active (λ = {riskAversionLambda.toExponential(1)})
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 ml-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span> TWAP
                    </span>
                  </div>
                </div>

                {/* SVG Efficient Frontier Chart */}
                <div className="flex-1 min-h-[360px] relative flex flex-col justify-center">
                  <EfficientFrontierSvgChart
                    frontier={efficientFrontier}
                    currentParams={currentParams}
                    onHoverPoint={setHoveredFrontierPoint}
                    hoveredPoint={hoveredFrontierPoint}
                  />

                  {/* Hover Point Tooltip */}
                  {hoveredFrontierPoint && (
                    <div className="absolute top-2 left-2 bg-slate-900/95 border border-purple-500/40 p-3 rounded-xl text-xs font-mono shadow-2xl z-20 pointer-events-none">
                      <div className="text-purple-300 font-bold mb-1 flex items-center gap-2">
                        <span>Risk Aversion λ: {hoveredFrontierPoint.lambda.toExponential(2)}</span>
                        {hoveredFrontierPoint.isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            Current
                          </span>
                        )}
                        {hoveredFrontierPoint.isTWAP && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            TWAP Limit
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Expected Impact Cost E[x]:</span>
                          <span className="text-emerald-300 font-bold">₹{hoveredFrontierPoint.expectedCostInr.toLocaleString('en-IN')} ({hoveredFrontierPoint.expectedCostBps} bps)</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Timing Risk Std Dev:</span>
                          <span className="text-amber-300 font-bold">₹{hoveredFrontierPoint.stdDevRiskInr.toLocaleString('en-IN')} ({hoveredFrontierPoint.stdDevRiskBps} bps)</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Optimal Half-Life:</span>
                          <span className="text-purple-300 font-bold">{hoveredFrontierPoint.halfLifeMin} min</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Velocity κ:</span>
                          <span className="text-slate-300 font-mono">{hoveredFrontierPoint.kappa.toFixed(4)} min⁻¹</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Quantitative Attribution & Frontier Theory */}
              <div className="flex flex-col gap-4 rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800/80 pb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Frontier Tradeoff Analysis
                </h3>

                {/* Indifference / Utility Function Card */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300">Objective Utility Function</div>
                  <div className="p-2 rounded-lg bg-black/40 font-mono text-center text-xs text-cyan-300">
                    U[x] = E[x] + λ · V[x]
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Almgren-Chriss guarantees that no other execution schedule can achieve lower expected cost for the same variance, or lower variance for the same cost.
                  </p>
                </div>

                {/* Comparative Breakdown Table */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Execution Strategy Comparison</div>
                  <div className="rounded-xl border border-slate-800 overflow-hidden text-[11px]">
                    <table className="w-full text-left font-mono">
                      <thead className="bg-slate-900/80 text-slate-400 text-[10px]">
                        <tr>
                          <th className="p-2">Model</th>
                          <th className="p-2">Cost E[x]</th>
                          <th className="p-2">Risk √V[x]</th>
                          <th className="p-2">Half-Life</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        <tr className="bg-cyan-500/10">
                          <td className="p-2 font-bold text-cyan-300">Almgren-Chriss</td>
                          <td className="p-2 text-emerald-400">₹{metricsStrip.expectedCostInr.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-cyan-300">₹{metricsStrip.stdDevRiskACInr.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-purple-300">{metricsStrip.halfLifeMinutes}m</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold text-amber-300">TWAP (Uniform)</td>
                          <td className="p-2 text-emerald-400">₹{metricsStrip.twapCostInr.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-amber-400">₹{metricsStrip.stdDevRiskTWAPInr.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-slate-400">{(metricsStrip.horizonMinutes / 2).toFixed(1)}m</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold text-emerald-300">VWAP (Intraday)</td>
                          <td className="p-2 text-emerald-400">₹{metricsStrip.vwapCostInr.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-slate-400">~₹{(metricsStrip.stdDevRiskTWAPInr * 0.94).toFixed(0)}</td>
                          <td className="p-2 text-slate-400">~{(metricsStrip.horizonMinutes * 0.48).toFixed(1)}m</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Risk Variance Reduction Highlight */}
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-cyan-300 block">Variance Risk Reduced by {metricsStrip.riskReductionPct}%</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      By executing more heavily in the earlier slices, the unhedged inventory at risk decays exponentially, saving ₹{metricsStrip.executionSavingsVsTwapInr.toLocaleString('en-IN')} in risk-adjusted utility.
                    </p>
                  </div>
                </div>

                {/* Quick Action: Apply Preset */}
                <div className="mt-auto space-y-2">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Operational Stance</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setRiskAversionLambda(1e-7);
                        addLog('Frontier point set to TWAP minimal impact boundary.', 'info');
                      }}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-xs text-amber-300 font-semibold text-center transition"
                    >
                      Min Impact (TWAP)
                    </button>
                    <button
                      onClick={() => {
                        setRiskAversionLambda(4e-5);
                        addLog('Frontier point set to Fast Risk-Reduction boundary.', 'action');
                      }}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-xs text-rose-300 font-semibold text-center transition"
                    >
                      Min Variance Risk
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: LIVE ORDER SLICING & EXECUTION MONITOR */}
          {activeView === 'monitor' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 h-full">
              {/* Left 3 Columns: Sliced Order Step Table */}
              <div className="lg:col-span-3 flex flex-col rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                {/* Monitor Header with Progress Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Optimal Execution Schedule & Child Slice Tracker
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isAutoExecuting
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                          : currentExecutionStep === numSlices
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {isAutoExecuting ? '● EXECUTING LIVE' : currentExecutionStep === numSlices ? '✓ COMPLETE' : 'IDLE / READY'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Step {currentExecutionStep} of {numSlices} filled · {(slicedOrderSteps.filter(s => s.status === 'FILLED').reduce((acc, s) => acc + s.targetQty, 0)).toLocaleString('en-IN')} / {orderSize.toLocaleString('en-IN')} shares executed
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full sm:w-60">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span>Execution Progress</span>
                      <span className="text-cyan-300 font-bold">
                        {((currentExecutionStep / numSlices) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${(currentExecutionStep / numSlices) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Sliced Order Step Table */}
                <div className="flex-1 overflow-x-auto min-h-[300px]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="p-2.5">Tranche #</th>
                        <th className="p-2.5">Time</th>
                        <th className="p-2.5">Target (Sh)</th>
                        <th className="p-2.5">Fill Price (₹)</th>
                        <th className="p-2.5">Perm Impact</th>
                        <th className="p-2.5">Temp Impact</th>
                        <th className="p-2.5">Total Slippage</th>
                        <th className="p-2.5">Remaining</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {slicedOrderSteps.map((step) => {
                        const isExecuting = step.status === 'EXECUTING';
                        const isFilled = step.status === 'FILLED';
                        return (
                          <tr
                            key={step.sliceIndex}
                            className={`transition hover:bg-slate-800/40 ${
                              isExecuting ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : isFilled ? 'bg-slate-900/30' : ''
                            }`}
                          >
                            <td className="p-2.5 font-bold">
                              <span className="flex items-center gap-1.5">
                                {isFilled ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                ) : isExecuting ? (
                                  <Activity className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                                )}
                                #{step.sliceIndex}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300">{step.timeLabel}</td>
                            <td className="p-2.5 font-bold text-white">
                              {step.targetQty.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 font-bold text-cyan-300">
                              ₹{step.fillPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-slate-400">
                              +₹{step.permanentImpactInr}
                            </td>
                            <td className="p-2.5 text-slate-400">
                              +₹{step.temporaryImpactInr}
                            </td>
                            <td className="p-2.5">
                              <span className="text-amber-300 font-semibold">
                                {step.totalImpactBps.toFixed(1)} bps
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                (₹{step.slippageInr.toFixed(0)})
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-400">
                              {step.remainingQty.toLocaleString('en-IN')} ({step.cumulativePct}%)
                            </td>
                            <td className="p-2.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                step.status === 'FILLED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : step.status === 'EXECUTING'
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                                  : step.status === 'PAUSED'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-800 text-slate-500 border-slate-700'
                              }`}>
                                {step.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: 4 1-Click Execution Controls & Live Log Terminal */}
              <div className="flex flex-col gap-4 rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800/80 pb-2 flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-cyan-400" /> 1-Click Execution Controls
                </h3>

                {/* Control 1: Execute Slices Automatically */}
                <button
                  onClick={handleToggleAutoExecute}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
                    isAutoExecuting
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  }`}
                >
                  {isAutoExecuting ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{isAutoExecuting ? 'Pause Automatic Slicing' : 'Execute Slices Automatically'}</span>
                </button>

                {/* Control 2: Accelerate Aggressive Liquidation */}
                <button
                  onClick={handleAccelerateLiquidation}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-rose-600/20"
                >
                  <Zap className="h-4 w-4" />
                  <span>Accelerate Aggressive Liquidation</span>
                </button>

                {/* Control 3: Pause Trajectory */}
                <button
                  onClick={handlePauseTrajectory}
                  disabled={!isAutoExecuting && currentExecutionStep === 0}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition border border-slate-700"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause Trajectory</span>
                </button>

                {/* Control 4: Reset Schedule */}
                <button
                  onClick={handleResetSchedule}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition border border-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Schedule</span>
                </button>

                {/* Execution Speed Selector */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Simulation Tick Pace</span>
                    <span className="font-mono text-cyan-300">{(executionSpeedMs / 1000).toFixed(1)}s / slice</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: '0.6s (Fast)', val: 600 },
                      { label: '1.2s (Norm)', val: 1200 },
                      { label: '2.5s (Slow)', val: 2500 },
                    ].map((s) => (
                      <button
                        key={s.label}
                        onClick={() => setExecutionSpeedMs(s.val)}
                        className={`py-1 text-[10px] font-mono rounded border transition ${
                          executionSpeedMs === s.val
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Terminal Output / Execution Audit Trail */}
                <div className="flex-1 flex flex-col rounded-xl bg-black/60 border border-slate-800 p-2.5 min-h-[160px] overflow-hidden">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Engine Audit Journal</span>
                    <span className="text-cyan-400 font-mono">{executionLogs.length} events</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 text-[10px] font-mono pr-1">
                    {executionLogs.length === 0 ? (
                      <div className="text-slate-600 italic py-4 text-center">
                        No events logged yet. Click &apos;Execute Slices Automatically&apos; to begin.
                      </div>
                    ) : (
                      executionLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 leading-tight">
                          <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                          <span className={`${
                            log.type === 'success' ? 'text-emerald-400' :
                            log.type === 'warn' ? 'text-amber-400' :
                            log.type === 'action' ? 'text-cyan-300 font-bold' :
                            'text-slate-300'
                          }`}>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            MODAL FOOTER STATUS STRIP
        ───────────────────────────────────────────────────────────────────────────── */}
        <div className="px-5 py-2 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px]">
              <Cpu className="h-3.5 w-3.5" /> AC Optimal Slicer: Ready
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-[11px]">
              Engine: Almgren & Chriss (2000) Continuous Sinh Trajectory with Perold (1988) Attribution
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="text-slate-400">
              Arrival S₀: <strong className="text-slate-200">₹{effectiveMidPrice.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">
              Eff. Fill: <strong className="text-cyan-300">₹{metricsStrip.effectiveAvgPrice.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">
              Total IS: <strong className="text-emerald-400">{metricsStrip.expectedCostBps} bps</strong>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: TRAJECTORY SVG CHART
// ─────────────────────────────────────────────────────────────────────────────

interface TrajectorySvgChartProps {
  points: ACTrajectoryPoint[];
  orderSize: number;
  horizonMin: number;
  chartMode: 'holdings' | 'tradeRate';
  onHoverPoint: (pt: ACTrajectoryPoint | null) => void;
  hoveredPoint: ACTrajectoryPoint | null;
}

const TrajectorySvgChart: React.FC<TrajectorySvgChartProps> = ({
  points,
  orderSize,
  horizonMin,
  chartMode,
  onHoverPoint,
  hoveredPoint,
}) => {
  const width = 800;
  const height = 320;
  const padding = { top: 25, right: 35, bottom: 40, left: 65 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Maximum value for scaling
  const maxY = useMemo(() => {
    if (chartMode === 'holdings') {
      return orderSize;
    }
    const maxAC = Math.max(...points.map((p) => p.acTradeQty));
    const maxTWAP = Math.max(...points.map((p) => p.twapTradeQty));
    const maxVWAP = Math.max(...points.map((p) => p.vwapTradeQty));
    return Math.max(maxAC, maxTWAP, maxVWAP, 1) * 1.15;
  }, [points, chartMode, orderSize]);

  // Coordinate mappers
  const getX = useCallback((t: number) => {
    return padding.left + (t / Math.max(1, horizonMin)) * chartW;
  }, [padding.left, horizonMin, chartW]);

  const getY = useCallback((val: number) => {
    return padding.top + chartH - (val / Math.max(1, maxY)) * chartH;
  }, [padding.top, chartH, maxY]);

  // Path generators for Holdings Mode
  const acPath = useMemo(() => {
    return points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.timeMin)} ${getY(p.acHoldings)}`)
      .join(' ');
  }, [points, getX, getY]);

  const acAreaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = getX(points[0].timeMin);
    const lastX = getX(points[points.length - 1].timeMin);
    const bottomY = getY(0);
    return `${acPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [acPath, points, getX, getY]);

  const twapPath = useMemo(() => {
    return points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.timeMin)} ${getY(p.twapHoldings)}`)
      .join(' ');
  }, [points, getX, getY]);

  const vwapPath = useMemo(() => {
    return points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.timeMin)} ${getY(p.vwapHoldings)}`)
      .join(' ');
  }, [points, getX, getY]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full select-none"
      onMouseLeave={() => onHoverPoint(null)}
    >
      <defs>
        {/* Cyan Area Gradient for Almgren-Chriss */}
        <linearGradient id="acGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
        </linearGradient>

        <linearGradient id="barAC" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.6" />
        </linearGradient>

        <linearGradient id="barTWAP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.5" />
        </linearGradient>

        <linearGradient id="barVWAP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
        const yVal = frac * maxY;
        const yPos = getY(yVal);
        return (
          <g key={frac}>
            <line
              x1={padding.left}
              y1={yPos}
              x2={width - padding.right}
              y2={yPos}
              stroke="#1e293b"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={yPos + 3}
              textAnchor="end"
              className="text-[10px] font-mono fill-slate-500"
            >
              {Math.round(yVal).toLocaleString('en-IN')}
            </text>
          </g>
        );
      })}

      {/* X Axis Ticks */}
      {points.map((p) => {
        const xPos = getX(p.timeMin);
        return (
          <g key={p.sliceIndex}>
            <line
              x1={xPos}
              y1={padding.top}
              x2={xPos}
              y2={height - padding.bottom}
              stroke="#1e293b"
              strokeDasharray="2 4"
            />
            <text
              x={xPos}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="text-[10px] font-mono fill-slate-500"
            >
              {p.timeLabel}
            </text>
          </g>
        );
      })}

      {/* RENDER MODE 1: HOLDINGS CURVE */}
      {chartMode === 'holdings' && (
        <>
          {/* Almgren-Chriss Filled Area */}
          <path d={acAreaPath} fill="url(#acGradient)" />

          {/* TWAP Uniform Line (Amber Dashed) */}
          <path
            d={twapPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="6 4"
          />

          {/* VWAP U-Curve Line (Emerald) */}
          <path
            d={vwapPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="3 3"
          />

          {/* Almgren-Chriss Optimal Line (Glowing Cyan Solid) */}
          <path
            d={acPath}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Interactive Data Points on AC Curve */}
          {points.map((p) => {
            const cx = getX(p.timeMin);
            const cy = getY(p.acHoldings);
            const isHovered = hoveredPoint?.sliceIndex === p.sliceIndex;
            return (
              <g
                key={p.sliceIndex}
                className="cursor-pointer"
                onMouseEnter={() => onHoverPoint(p)}
              >
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 3.5}
                  fill={isHovered ? '#22d3ee' : '#0891b2'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </>
      )}

      {/* RENDER MODE 2: TRANCHE TRADE RATE / VOLUMES */}
      {chartMode === 'tradeRate' && (
        <g>
          {points.slice(1).map((p) => {
            const cx = getX(p.timeMin);
            const barW = Math.max(6, (chartW / points.length) * 0.25);
            const yBottom = getY(0);

            const acH = Math.max(0, yBottom - getY(p.acTradeQty));
            const twapH = Math.max(0, yBottom - getY(p.twapTradeQty));
            const vwapH = Math.max(0, yBottom - getY(p.vwapTradeQty));

            const isHovered = hoveredPoint?.sliceIndex === p.sliceIndex;

            return (
              <g
                key={p.sliceIndex}
                className="cursor-pointer"
                onMouseEnter={() => onHoverPoint(p)}
              >
                {/* AC Bar (Cyan) */}
                <rect
                  x={cx - barW * 1.5 - 2}
                  y={yBottom - acH}
                  width={barW}
                  height={acH}
                  fill="url(#barAC)"
                  rx="2"
                  className={isHovered ? 'filter drop-shadow-md brightness-125' : ''}
                />
                {/* TWAP Bar (Amber) */}
                <rect
                  x={cx - barW * 0.5}
                  y={yBottom - twapH}
                  width={barW}
                  height={twapH}
                  fill="url(#barTWAP)"
                  rx="2"
                  className={isHovered ? 'filter drop-shadow-md brightness-125' : ''}
                />
                {/* VWAP Bar (Emerald) */}
                <rect
                  x={cx + barW * 0.5 + 2}
                  y={yBottom - vwapH}
                  width={barW}
                  height={vwapH}
                  fill="url(#barVWAP)"
                  rx="2"
                  className={isHovered ? 'filter drop-shadow-md brightness-125' : ''}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* Hover Cursor Vertical Line */}
      {hoveredPoint && (
        <line
          x1={getX(hoveredPoint.timeMin)}
          y1={padding.top}
          x2={getX(hoveredPoint.timeMin)}
          y2={height - padding.bottom}
          stroke="#22d3ee"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />
      )}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: EFFICIENT FRONTIER SVG CHART
// ─────────────────────────────────────────────────────────────────────────────

interface EfficientFrontierSvgChartProps {
  frontier: ACEfficientFrontierPoint[];
  currentParams: ACModelParameters;
  onHoverPoint: (pt: ACEfficientFrontierPoint | null) => void;
  hoveredPoint: ACEfficientFrontierPoint | null;
}

const EfficientFrontierSvgChart: React.FC<EfficientFrontierSvgChartProps> = ({
  frontier,
  onHoverPoint,
  hoveredPoint,
}) => {
  const width = 760;
  const height = 340;
  const padding = { top: 30, right: 40, bottom: 45, left: 75 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Extents
  const minX = useMemo(() => Math.min(...frontier.map((p) => p.stdDevRiskInr)) * 0.8, [frontier]);
  const maxX = useMemo(() => Math.max(...frontier.map((p) => p.stdDevRiskInr)) * 1.1, [frontier]);
  const minY = useMemo(() => Math.min(...frontier.map((p) => p.expectedCostInr)) * 0.8, [frontier]);
  const maxY = useMemo(() => Math.max(...frontier.map((p) => p.expectedCostInr)) * 1.15, [frontier]);

  const getX = useCallback((risk: number) => {
    return padding.left + ((risk - minX) / Math.max(1, maxX - minX)) * chartW;
  }, [padding.left, minX, maxX, chartW]);

  const getY = useCallback((cost: number) => {
    return padding.top + chartH - ((cost - minY) / Math.max(1, maxY - minY)) * chartH;
  }, [padding.top, chartH, minY, maxY]);

  // Construct smooth curve path
  const curvePath = useMemo(() => {
    return frontier
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.stdDevRiskInr)} ${getY(p.expectedCostInr)}`)
      .join(' ');
  }, [frontier, getX, getY]);

  const currentPt = frontier.find((p) => p.isCurrent) || frontier[Math.floor(frontier.length / 2)];
  const twapPt = frontier.find((p) => p.isTWAP) || frontier[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full select-none"
      onMouseLeave={() => onHoverPoint(null)}
    >
      <defs>
        <linearGradient id="frontierGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Grid Lines (Cost / Y-Axis) */}
      {[0, 0.33, 0.66, 1.0].map((frac) => {
        const costVal = minY + frac * (maxY - minY);
        const yPos = getY(costVal);
        return (
          <g key={frac}>
            <line
              x1={padding.left}
              y1={yPos}
              x2={width - padding.right}
              y2={yPos}
              stroke="#1e293b"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={yPos + 3}
              textAnchor="end"
              className="text-[10px] font-mono fill-slate-500"
            >
              ₹{Math.round(costVal).toLocaleString('en-IN')}
            </text>
          </g>
        );
      })}

      {/* Grid Lines (Variance / X-Axis) */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
        const riskVal = minX + frac * (maxX - minX);
        const xPos = getX(riskVal);
        return (
          <g key={frac}>
            <line
              x1={xPos}
              y1={padding.top}
              x2={xPos}
              y2={height - padding.bottom}
              stroke="#1e293b"
              strokeDasharray="3 3"
            />
            <text
              x={xPos}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              className="text-[10px] font-mono fill-slate-500"
            >
              ₹{Math.round(riskVal).toLocaleString('en-IN')}
            </text>
          </g>
        );
      })}

      {/* Axis Labels */}
      <text
        x={width / 2}
        y={height - 8}
        textAnchor="middle"
        className="text-[11px] font-sans font-semibold fill-slate-400"
      >
        Timing Variance Risk √V[x] (₹ Standard Deviation of Execution Shortfall) →
      </text>

      <text
        x={18}
        y={height / 2}
        textAnchor="middle"
        transform={`rotate(-90 18 ${height / 2})`}
        className="text-[11px] font-sans font-semibold fill-slate-400"
      >
        Expected Execution Cost E[x] (₹ Impact) →
      </text>

      {/* The Smooth Frontier Curve */}
      <path
        d={curvePath}
        fill="none"
        stroke="url(#frontierGlow)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* All Points along the Frontier */}
      {frontier.map((p, idx) => {
        const cx = getX(p.stdDevRiskInr);
        const cy = getY(p.expectedCostInr);
        return (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={p.isCurrent ? 6 : p.isTWAP ? 5 : 3}
            fill={p.isCurrent ? '#06b6d4' : p.isTWAP ? '#f59e0b' : '#a855f7'}
            stroke="#ffffff"
            strokeWidth="1.5"
            className="cursor-pointer hover:scale-150 transition"
            onMouseEnter={() => onHoverPoint(p)}
          />
        );
      })}

      {/* Pulsing Highlight on Current Operational Point */}
      {currentPt && (
        <g>
          <circle
            cx={getX(currentPt.stdDevRiskInr)}
            cy={getY(currentPt.expectedCostInr)}
            r="12"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2"
            className="animate-ping"
          />
          <text
            x={getX(currentPt.stdDevRiskInr) + 12}
            y={getY(currentPt.expectedCostInr) - 10}
            className="text-[10px] font-mono font-bold fill-cyan-300"
          >
            ★ Active Operational Point
          </text>
        </g>
      )}

      {/* TWAP Reference Benchmark Point Annotation */}
      {twapPt && (
        <g>
          <text
            x={getX(twapPt.stdDevRiskInr) - 10}
            y={getY(twapPt.expectedCostInr) + 16}
            textAnchor="end"
            className="text-[10px] font-mono font-bold fill-amber-300"
          >
            TWAP Benchmark (Min Impact, Max Risk)
          </text>
        </g>
      )}
    </svg>
  );
};
