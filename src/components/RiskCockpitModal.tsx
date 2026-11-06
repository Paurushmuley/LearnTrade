'use client';

import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Play,
  RefreshCw,
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
import { Position, PortfolioSummary } from '../types/trading';
import {
  CircuitBreakerState,
  DeRiskingMode,
  EvtExpectedShortfallMetrics,
  GatekeeperOrderCheck,
  MarginGatekeeperStatus,
  SpanRiskArraySummary,
  SpanScenarioCell,
  UnwindPlanSummary,
} from '../types/riskEngine';
import {
  calculateSpanRiskArray,
  evaluateMarginGatekeeper,
  validatePreTradeOrder,
  calculateEvtExpectedShortfall,
  getCircuitBreakerSurveillance,
  generateUnwindPlan,
  DEFAULT_RISK_POSITIONS,
} from '../lib/riskEngine';

interface RiskCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions?: Position[];
  portfolio?: PortfolioSummary;
  spotPrice?: number;
  symbol?: string;
}

type ActiveTab = 'span_heatmap' | 'margin_gatekeeper' | 'evt_fat_tail' | 'circuit_unwind';

export const RiskCockpitModal: React.FC<RiskCockpitModalProps> = ({
  isOpen,
  onClose,
  positions = [],
  portfolio,
  spotPrice = 24950,
  symbol = 'NIFTY 50',
}) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('span_heatmap');

  // Interactive SPAN Heatmap States
  const [sigmaMultiplier, setSigmaMultiplier] = useState<number>(1.0);
  const [selectedCell, setSelectedCell] = useState<SpanScenarioCell | null>(null);
  const [heatmapViewMode, setHeatmapViewMode] = useState<'matrix' | 'table16'>('matrix');

  // Pre-Trade Gatekeeper Simulator States
  const [testSymbol, setTestSymbol] = useState<string>('NIFTY24OCT25100PE');
  const [testSide, setTestSide] = useState<'BUY' | 'SELL'>('SELL');
  const [testProduct, setTestProduct] = useState<'MIS' | 'CNC' | 'NRML'>('MIS');
  const [testQty, setTestQty] = useState<number>(150);
  const [testPrice, setTestPrice] = useState<number>(92.0);

  // EVT Stress Test Shock States
  const [activeTailShockIndex, setActiveTailShockIndex] = useState<number | null>(null);

  // De-Risking / Unwind Simulator States
  const [unwindMode, setUnwindMode] = useState<DeRiskingMode>('CUT_LEVERAGE_50');
  const [isExecutingUnwind, setIsExecutingUnwind] = useState<boolean>(false);
  const [unwindCompleteMessage, setUnwindCompleteMessage] = useState<string | null>(null);

  // Determine effective positions & portfolio capital
  const activePositions = useMemo(() => {
    return positions.length > 0 ? positions : DEFAULT_RISK_POSITIONS;
  }, [positions]);

  const effectiveAvailableCash = portfolio?.availableCash ?? 500000;
  const effectivePortfolioValue = portfolio?.totalPortfolioValue ?? 625000;

  // 1. Calculate SPAN Risk Array Summary
  const spanSummary: SpanRiskArraySummary = useMemo(() => {
    return calculateSpanRiskArray(activePositions, spotPrice, sigmaMultiplier);
  }, [activePositions, spotPrice, sigmaMultiplier]);

  // 2. Evaluate Margin Gatekeeper
  const gatekeeper: MarginGatekeeperStatus = useMemo(() => {
    return evaluateMarginGatekeeper(
      effectiveAvailableCash,
      effectivePortfolioValue,
      spanSummary.totalSpanRequirement,
      spanSummary.exposureMarginRequirement
    );
  }, [effectiveAvailableCash, effectivePortfolioValue, spanSummary]);

  // 3. Pre-Trade Gatekeeper Validator for test order
  const orderCheckResult: GatekeeperOrderCheck = useMemo(() => {
    return validatePreTradeOrder(gatekeeper, {
      symbol: testSymbol,
      side: testSide,
      product: testProduct,
      quantity: testQty,
      price: testPrice,
    });
  }, [gatekeeper, testSymbol, testSide, testProduct, testQty, testPrice]);

  // 4. EVT Fat-Tail Expected Shortfall
  const evtMetrics: EvtExpectedShortfallMetrics = useMemo(() => {
    return calculateEvtExpectedShortfall(effectivePortfolioValue, 1.35);
  }, [effectivePortfolioValue]);

  // 5. Circuit Breaker Surveillance
  const circuitState: CircuitBreakerState = useMemo(() => {
    return getCircuitBreakerSurveillance(spotPrice, 25100);
  }, [spotPrice]);

  // 6. Unwind Plan
  const unwindPlan: UnwindPlanSummary = useMemo(() => {
    return generateUnwindPlan(unwindMode, activePositions, gatekeeper);
  }, [unwindMode, activePositions, gatekeeper]);

  // Handle Unwind Execution Simulation
  const handleExecuteUnwind = () => {
    setIsExecutingUnwind(true);
    setUnwindCompleteMessage(null);
    setTimeout(() => {
      setIsExecutingUnwind(false);
      setUnwindCompleteMessage(
        `Successfully executed ${unwindPlan.items.length} orders in ${unwindPlan.estimatedExecutionTimeMs}ms. Unlocked ₹${unwindPlan.totalMarginReleased.toLocaleString()} margin. New utilization: ${unwindPlan.newUtilizationRate}%.`
      );
    }, 1200);
  };

  if (!isOpen) return null;

  // Color generator for SPAN 2D Heatmap Matrix
  const getCellColor = (pnl: number, isWorst: boolean) => {
    if (isWorst) {
      return 'bg-gradient-to-br from-rose-950 via-red-900 to-rose-950 border-2 border-red-500 shadow-lg shadow-red-500/30 text-rose-100 font-extrabold animate-pulse';
    }
    if (pnl > 0) {
      if (pnl > 15000) return 'bg-emerald-900/70 border-emerald-700/80 text-emerald-200';
      if (pnl > 5000) return 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300';
      return 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400';
    } else if (pnl < 0) {
      const loss = Math.abs(pnl);
      if (loss > 20000) return 'bg-rose-950/80 border-rose-700/80 text-rose-200';
      if (loss > 10000) return 'bg-rose-950/50 border-rose-800/60 text-rose-300';
      return 'bg-rose-950/30 border-rose-900/40 text-rose-400';
    }
    return 'bg-slate-900/60 border-slate-800 text-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0B0E17] border border-slate-800/90 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-3.5 border-b border-slate-800/90 bg-[#0E1322] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-amber-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-md">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  High-Frequency Pre-Trade Risk Engine & Stress Testing Desk
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                  Sprint 22
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                  SPAN / EVT v4.2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>Multi-Scenario Scanning Array</span>
                <span className="text-slate-600">•</span>
                <span>Peak Margin Gatekeeper</span>
                <span className="text-slate-600">•</span>
                <span>Fat-Tail CVaR 99%</span>
                <span className="text-slate-600">•</span>
                <span>Circuit Breaker Radar</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Status Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400">Leverage Tier:</span>
              <span
                className={`font-bold font-mono text-[11px] px-1.5 py-0.5 rounded ${
                  gatekeeper.throttleTier === 'OPTIMAL'
                    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                    : gatekeeper.throttleTier === 'MODERATE'
                    ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/60'
                    : gatekeeper.throttleTier === 'CAUTION'
                    ? 'text-amber-400 bg-amber-950/60 border border-amber-800/60'
                    : 'text-rose-400 bg-rose-950/60 border border-rose-800/60 animate-pulse'
                }`}
              >
                {gatekeeper.throttleTier} ({gatekeeper.utilizationRate}%)
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* TOP METRICS SUMMARY STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-2.5 bg-[#090C14] border-b border-slate-800/70 text-xs">
          <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Available Cash</span>
            <div className="font-bold text-slate-100 font-mono text-sm mt-0.5">
              ₹{gatekeeper.availableCash.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">SPAN Scanning Req.</span>
            <div className="font-bold text-amber-400 font-mono text-sm mt-0.5">
              ₹{spanSummary.totalSpanRequirement.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">EVT Fat-Tail CVaR 99%</span>
            <div className="font-bold text-rose-400 font-mono text-sm mt-0.5">
              ₹{evtMetrics.evtExpectedShortfall99.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Circuit Breaker Dist.</span>
            <div className="font-bold text-cyan-400 font-mono text-sm mt-0.5">
              {circuitState.distanceToStage1Percent}% to L-10%
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-800 bg-[#0B0F1D] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('span_heatmap')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'span_heatmap'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-rose-400" />
            <span>1. SPAN 16-Scenario Heatmap</span>
          </button>

          <button
            onClick={() => setActiveTab('margin_gatekeeper')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'margin_gatekeeper'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Gauge className="h-3.5 w-3.5 text-cyan-400" />
            <span>2. Pre-Trade Gatekeeper & Margin Gauge</span>
          </button>

          <button
            onClick={() => setActiveTab('evt_fat_tail')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'evt_fat_tail'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>3. Extreme Value Theory (EVT) CVaR</span>
          </button>

          <button
            onClick={() => setActiveTab('circuit_unwind')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'circuit_unwind'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>4. Circuit Breaker & 1-Click Unwind</span>
          </button>
        </div>

        {/* MODAL MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* TAB 1: SPAN 16-SCENARIO RISK ARRAY HEATMAP */}
          {activeTab === 'span_heatmap' && (
            <div className="space-y-4">
              {/* Heatmap Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-300 font-semibold">
                    <span className="text-rose-400 font-bold font-mono">SPAN Matrix</span> (-3σ to +3σ vs Vol Shift -4% / 0% / +4%)
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setHeatmapViewMode('matrix')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                        heatmapViewMode === 'matrix' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      2D Matrix Heatmap
                    </button>
                    <button
                      onClick={() => setHeatmapViewMode('table16')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                        heatmapViewMode === 'table16' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Official 16-Scenario Array
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Scan Range Multiplier:</span>
                    <select
                      value={sigmaMultiplier}
                      onChange={(e) => setSigmaMultiplier(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono"
                    >
                      <option value={0.75}>0.75x (Low Vol Band)</option>
                      <option value={1.0}>1.00x (Standard NSE 1.5% σ)</option>
                      <option value={1.5}>1.50x (Expiry Day Stress)</option>
                      <option value={2.0}>2.00x (Election / RBI Shock)</option>
                    </select>
                  </div>

                  <div className="px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 font-mono text-[11px] font-bold">
                    Max Scanning Loss: ₹{spanSummary.maxScanningLoss.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* VIEW 1: 2D MATRIX HEATMAP */}
              {heatmapViewMode === 'matrix' && (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono">Y-Axis: Implied Volatility Shift | X-Axis: Price Sigma Shift (σ)</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px]"><span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span> Profit Zone</span>
                      <span className="flex items-center gap-1 text-[10px]"><span className="w-2.5 h-2.5 rounded bg-slate-800 inline-block"></span> Neutral</span>
                      <span className="flex items-center gap-1 text-[10px]"><span className="w-2.5 h-2.5 rounded bg-rose-700 inline-block"></span> Loss Zone</span>
                      <span className="flex items-center gap-1 text-[10px]"><span className="w-2.5 h-2.5 rounded bg-red-600 border border-red-400 inline-block animate-pulse"></span> Max SPAN Loss</span>
                    </div>
                  </div>

                  {/* Heatmap Grid */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-[11px] font-mono font-bold text-slate-400 bg-slate-950/80 border border-slate-800/80 text-left">
                            Vol \ Price (σ)
                          </th>
                          {[-3, -2, -1, 0, 1, 2, 3].map((sigma) => {
                            const pct = (sigma * 1.5 * sigmaMultiplier).toFixed(1);
                            return (
                              <th
                                key={sigma}
                                className="p-2 text-[11px] font-mono font-bold bg-slate-950/80 border border-slate-800/80 text-slate-300"
                              >
                                <div>{sigma > 0 ? `+${sigma}σ` : `${sigma}σ`}</div>
                                <div className="text-[9px] text-slate-500 font-normal">
                                  {Number(pct) > 0 ? `+${pct}%` : `${pct}%`}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {spanSummary.matrix.map((row, rowIdx) => {
                          const volShift = row[0].volShiftPercent;
                          return (
                            <tr key={rowIdx}>
                              <td className="p-2.5 text-xs font-mono font-bold text-left bg-slate-950/60 border border-slate-800/80 text-slate-300 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {volShift > 0 ? (
                                    <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                                  ) : volShift < 0 ? (
                                    <TrendingDown className="h-3.5 w-3.5 text-cyan-400" />
                                  ) : (
                                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                                  )}
                                  <span>{volShift > 0 ? `+${volShift}.0% IV` : volShift < 0 ? `${volShift}.0% IV` : 'Base IV (0%)'}</span>
                                </div>
                              </td>

                              {row.map((cell, colIdx) => {
                                const isWorst =
                                  cell.effectiveRiskLoss > 0 &&
                                  cell.effectiveRiskLoss === spanSummary.maxScanningLoss;
                                const isSelected = selectedCell?.priceSigma === cell.priceSigma && selectedCell?.volShiftPercent === cell.volShiftPercent;

                                return (
                                  <td
                                    key={colIdx}
                                    onClick={() => setSelectedCell(cell)}
                                    className={`p-2.5 border border-slate-800/80 cursor-pointer transition relative group ${getCellColor(
                                      cell.portfolioPnL,
                                      isWorst
                                    )} ${isSelected ? 'ring-2 ring-white scale-105 z-10' : 'hover:scale-[1.02]'}`}
                                  >
                                    <div className="font-mono font-bold text-xs">
                                      {cell.portfolioPnL >= 0 ? `+₹${cell.portfolioPnL.toLocaleString()}` : `-₹${Math.abs(cell.portfolioPnL).toLocaleString()}`}
                                    </div>
                                    <div className="text-[9px] opacity-75 font-mono">
                                      {isWorst ? 'MAX SCAN LOSS' : cell.portfolioPnL >= 0 ? 'Surplus' : 'Scanning Loss'}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW 2: OFFICIAL 16-SCENARIO SPAN ARRAY TABLE */}
              {heatmapViewMode === 'table16' && (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>CME / NSE Official Standard Portfolio Analysis of Risk (SPAN) 16 Scenarios</span>
                    <span className="text-amber-400 font-mono">Worst Scenario: #{spanSummary.worstScenarioNumber} ({spanSummary.worstScenarioDescription})</span>
                  </div>

                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-[#0E1322] border-b border-slate-800 font-mono text-[10px] text-slate-400 uppercase">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Scenario Description</th>
                          <th className="py-2 px-3">Price Move</th>
                          <th className="py-2 px-3">Vol Shift</th>
                          <th className="py-2 px-3">Weight</th>
                          <th className="py-2 px-3 text-right">Raw P&L</th>
                          <th className="py-2 px-3 text-right">SPAN Scanning Loss</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {spanSummary.scenarios16.map((sc) => {
                          const isWorst = sc.scenarioNumber === spanSummary.worstScenarioNumber;
                          return (
                            <tr
                              key={sc.scenarioNumber}
                              onClick={() => setSelectedCell(sc)}
                              className={`cursor-pointer transition ${
                                isWorst
                                  ? 'bg-rose-950/60 text-rose-200 font-bold'
                                  : 'hover:bg-slate-800/40 text-slate-300'
                              }`}
                            >
                              <td className="py-2 px-3 font-bold text-slate-400">#{sc.scenarioNumber}</td>
                              <td className="py-2 px-3 flex items-center gap-1.5">
                                {isWorst && <Flame className="h-3.5 w-3.5 text-rose-400 animate-pulse" />}
                                <span>{sc.description}</span>
                              </td>
                              <td className="py-2 px-3">{sc.priceShiftPercent > 0 ? `+${sc.priceShiftPercent}%` : `${sc.priceShiftPercent}%`}</td>
                              <td className="py-2 px-3">{sc.volShiftPercent > 0 ? `+${sc.volShiftPercent}%` : `${sc.volShiftPercent}%`}</td>
                              <td className="py-2 px-3">{sc.weightPercent}%</td>
                              <td className={`py-2 px-3 text-right ${sc.portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {sc.portfolioPnL >= 0 ? `+₹${sc.portfolioPnL.toLocaleString()}` : `-₹${Math.abs(sc.portfolioPnL).toLocaleString()}`}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-rose-400">
                                {sc.effectiveRiskLoss > 0 ? `₹${sc.effectiveRiskLoss.toLocaleString()}` : '₹0'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* INSPECTOR CARD FOR SELECTED SCENARIO */}
              {selectedCell && (
                <div className="p-4 bg-gradient-to-r from-[#111626] to-[#0E1322] rounded-xl border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold">
                        Scenario Inspector: {selectedCell.description}
                      </span>
                      {selectedCell.isExtremeMove && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono">
                          Extreme Move (35% Weight)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">
                      If Spot shifts by <strong className="text-white">{selectedCell.priceShiftPercent}%</strong> and Implied Volatility shifts by <strong className="text-white">{selectedCell.volShiftPercent}%</strong>, portfolio stress impact is computed.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-400 font-mono">Stress P&L</span>
                      <div className={`text-base font-extrabold font-mono ${selectedCell.portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedCell.portfolioPnL >= 0 ? `+₹${selectedCell.portfolioPnL.toLocaleString()}` : `-₹${Math.abs(selectedCell.portfolioPnL).toLocaleString()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCell(null)}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REAL-TIME PRE-TRADE GATEKEEPER & MARGIN UTILIZATION GAUGE */}
          {activeTab === 'margin_gatekeeper' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LEFT: Margin Utilization Gauge & Throttling Tiers (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="h-4 w-4 text-cyan-400" />
                      <span>Peak Margin Utilization Gauge</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">SEBI Intraday Peak Rule</span>
                  </div>

                  {/* Dynamic Circular / Bar Progress Gauge */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold font-mono text-white">
                        {gatekeeper.utilizationRate}%
                      </span>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        gatekeeper.throttleTier === 'OPTIMAL' ? 'text-emerald-400 bg-emerald-950/60' :
                        gatekeeper.throttleTier === 'MODERATE' ? 'text-cyan-400 bg-cyan-950/60' :
                        gatekeeper.throttleTier === 'CAUTION' ? 'text-amber-400 bg-amber-950/60' :
                        'text-rose-400 bg-rose-950/60'
                      }`}>
                        {gatekeeper.throttleTier}
                      </span>
                    </div>

                    {/* Gauge Bar */}
                    <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
                      <div
                        className={`h-full transition-all duration-500 ${
                          gatekeeper.utilizationRate < 50 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                          gatekeeper.utilizationRate < 75 ? 'bg-gradient-to-r from-teal-500 to-cyan-500' :
                          gatekeeper.utilizationRate < 90 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                          'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse'
                        }`}
                        style={{ width: `${Math.min(100, gatekeeper.utilizationRate)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>0% Safe</span>
                      <span>50% Moderate</span>
                      <span>75% Caution</span>
                      <span>90% Blocked</span>
                      <span>100% Breached</span>
                    </div>
                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Available Liquid Cash:</span>
                      <span className="font-mono font-bold text-white">₹{gatekeeper.availableCash.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Required SPAN Scanning Margin:</span>
                      <span className="font-mono font-semibold text-amber-400">₹{gatekeeper.usedSpanMargin.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Exposure Margin Requirement:</span>
                      <span className="font-mono font-semibold text-cyan-400">₹{gatekeeper.exposureMargin.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-slate-300 font-bold">Remaining Free Margin:</span>
                      <span className={`font-mono font-bold ${gatekeeper.freeMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{gatekeeper.freeMargin.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Leverage Throttling Tier Warning */}
                  {gatekeeper.throttleWarning && (
                    <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{gatekeeper.throttleWarning}</span>
                    </div>
                  )}
                </div>

                {/* Throttling Policy Reference */}
                <div className="p-3.5 bg-slate-900/30 rounded-xl border border-slate-800/80 text-[11px] space-y-2">
                  <div className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Algorithmic Leverage Throttling Policy</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Our Pre-Trade RMS executes microsecond margin validation. When account margin utilization exceeds 75%, maximum order lot clips are restricted by 50%. Over 90%, leverage expansion is strictly locked, clearing only risk-neutralizing orders.
                  </p>
                </div>
              </div>

              {/* RIGHT: Pre-Trade Order Gatekeeper Validator Simulator (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                        RMS
                      </div>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Pre-Trade Order Gatekeeper Validator
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400">Microsecond Sub-Tick Verification</span>
                  </div>

                  {/* Candidate Order Form */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-mono">Contract Symbol</label>
                      <input
                        type="text"
                        value={testSymbol}
                        onChange={(e) => setTestSymbol(e.target.value)}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-mono">Side</label>
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTestSide('BUY')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                            testSide === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}
                        >
                          BUY
                        </button>
                        <button
                          type="button"
                          onClick={() => setTestSide('SELL')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                            testSide === 'SELL' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}
                        >
                          SELL
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-mono">Product Type</label>
                      <select
                        value={testProduct}
                        onChange={(e) => setTestProduct(e.target.value as any)}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                      >
                        <option value="MIS">MIS (Intraday 5x)</option>
                        <option value="NRML">NRML (Overnight F&O)</option>
                        <option value="CNC">CNC (Delivery 1x)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-mono">Quantity / Lots</label>
                      <input
                        type="number"
                        step={25}
                        value={testQty}
                        onChange={(e) => setTestQty(Number(e.target.value))}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-mono">Limit / Execution Price</label>
                      <input
                        type="number"
                        step={0.5}
                        value={testPrice}
                        onChange={(e) => setTestPrice(Number(e.target.value))}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Gross Notional</span>
                      <div className="font-mono font-bold text-slate-200 mt-1 py-1.5">
                        ₹{(testQty * testPrice).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Gatekeeper Check Result Card */}
                  <div className={`p-4 rounded-xl border transition ${
                    orderCheckResult.verdict === 'PASS'
                      ? 'bg-emerald-950/30 border-emerald-800/80'
                      : orderCheckResult.verdict === 'WARNING'
                      ? 'bg-amber-950/30 border-amber-800/80'
                      : 'bg-rose-950/40 border-rose-800/80'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {orderCheckResult.verdict === 'PASS' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : orderCheckResult.verdict === 'WARNING' ? (
                          <AlertTriangle className="h-5 w-5 text-amber-400" />
                        ) : (
                          <AlertOctagon className="h-5 w-5 text-rose-400" />
                        )}
                        <span className="font-bold text-sm tracking-wide">
                          Gatekeeper Verdict: {orderCheckResult.verdict}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        Post-Trade Margin: {orderCheckResult.postTradeUtilization}%
                      </span>
                    </div>

                    <ul className="space-y-1 text-xs mb-3 text-slate-300">
                      {orderCheckResult.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <ChevronRight className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500 uppercase text-[9px]">Additional SPAN</span>
                        <div className="font-bold text-slate-200">₹{orderCheckResult.estimatedSpanDelta.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase text-[9px]">Additional Exp.</span>
                        <div className="font-bold text-slate-200">₹{orderCheckResult.estimatedExposureDelta.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase text-[9px]">Post-Trade Free</span>
                        <div className={`font-bold ${orderCheckResult.postTradeFreeMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{orderCheckResult.postTradeFreeMargin.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase text-[9px]">RMS Max Safe Qty</span>
                        <div className="font-bold text-cyan-400">{orderCheckResult.suggestedMaxQuantity} units</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXTREME VALUE THEORY (EVT) FAT-TAIL EXPECTED SHORTFALL */}
          {activeTab === 'evt_fat_tail' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Parametric VaR Card */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    Parametric Gaussian VaR (99.0%)
                  </span>
                  <div className="text-2xl font-extrabold font-mono text-slate-200">
                    ₹{evtMetrics.parametricVar99.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Assumes bell-curve normal distribution (2.326σ). Seriously underestimates catastrophic tail risk in financial crises.
                  </p>
                </div>

                {/* EVT Expected Shortfall Card */}
                <div className="p-4 bg-gradient-to-br from-rose-950/40 via-slate-900/40 to-slate-900/40 rounded-xl border border-rose-500/50 space-y-2 shadow-lg shadow-rose-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-rose-300 uppercase font-mono font-bold tracking-wider flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-rose-400" /> EVT Expected Shortfall (CVaR 99%)
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-mono font-bold">
                      {evtMetrics.cvarToVarRatio}x Tail Severity
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-rose-300">
                    ₹{evtMetrics.evtExpectedShortfall99.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-rose-200/80 leading-relaxed">
                    Generalized Pareto Distribution (GPD) conditional loss: Expected portfolio ruin once standard 99% threshold is breached.
                  </p>
                </div>

                {/* Tail Index & Kurtosis */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    GPD Tail Index & Kurtosis
                  </span>
                  <div className="flex items-baseline gap-3">
                    <div>
                      <div className="text-xs text-slate-500 font-mono">Shape ξ (Xi)</div>
                      <div className="text-lg font-bold font-mono text-amber-400">+{evtMetrics.fatTailIndexXi}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-mono">Excess Kurtosis</div>
                      <div className="text-lg font-bold font-mono text-amber-400">+{evtMetrics.excessKurtosis}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-amber-300 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>Heavy Fat Tails Confirmed (Leptokurtic)</span>
                  </div>
                </div>
              </div>

              {/* Historical Tail Shock Scenario Injector */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-rose-400" />
                    <span>Historical Extreme Tail Shocks (Black Swan Stress Injection)</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Click to preview simulated catastrophic impact</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {evtMetrics.historicalTailShocks.map((shock, idx) => {
                    const isSelected = activeTailShockIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveTailShockIndex(isSelected ? null : idx)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-rose-950/70 border-rose-500 text-white shadow-lg shadow-rose-950/30'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                            <span>{shock.year}</span>
                            <span className="text-rose-400 font-bold">{shock.marketMovePercent}% Move</span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-100">{shock.event}</h4>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{shock.description}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                          <span className="text-[10px] text-slate-500 uppercase">Simulated Loss</span>
                          <span className="font-bold text-rose-400">-₹{shock.projectedLoss.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CIRCUIT BREAKER SURVEILLANCE & 1-CLICK DE-RISKING / UNWIND */}
          {activeTab === 'circuit_unwind' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LEFT: Exchange Circuit Breaker Radar (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      <span>NSE Circuit Breaker Surveillance</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Stage 1 / 2 / 3</span>
                  </div>

                  {/* Circuit Gauge */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">NIFTY 50 Intraday Drift:</span>
                      <span className={`font-bold ${circuitState.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {circuitState.dayChangePercent > 0 ? `+${circuitState.dayChangePercent}%` : `${circuitState.dayChangePercent}%`}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Stage 1 Halt (-10.0%):</span>
                        <span className="text-amber-400 font-bold">{circuitState.distanceToStage1Percent}% cushion</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Stage 2 Halt (-15.0%):</span>
                        <span className="text-slate-300">14.4% cushion</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Stage 3 Close (-20.0%):</span>
                        <span className="text-rose-400">19.4% cushion</span>
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Asset Price Band Proximity Monitor */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                      Constituent Price Freeze Proximity
                    </span>
                    <div className="space-y-1.5">
                      {circuitState.assetProximityWarnings.map((asset, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-200">{asset.symbol}</span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              LTP: ₹{asset.currentPrice} | Lower Band: ₹{asset.lowerCircuit}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              asset.isNearBand
                                ? 'bg-amber-950 text-amber-300 border border-amber-700/80 animate-pulse'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {asset.distanceToLowerBandPercent}% to Limit
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: 1-Click Portfolio De-Risking / Unwind Simulator (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-rose-400" />
                      <span>1-Click Portfolio De-Risking & Unwind Desk</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">Zero-Impact Smart Slicing</span>
                  </div>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => setUnwindMode('CUT_LEVERAGE_50')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        unwindMode === 'CUT_LEVERAGE_50'
                          ? 'bg-amber-500/15 border-amber-500/50 text-white'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Scale className="h-3.5 w-3.5 text-amber-400" />
                        <span>Cut Leverage 50%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Scale back leveraged lots by half to restore safety corridor.</p>
                    </button>

                    <button
                      onClick={() => setUnwindMode('DELTA_NEUTRALIZE')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        unwindMode === 'DELTA_NEUTRALIZE'
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Delta-Neutralize</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Deploy index hedge contracts to bring portfolio delta to 0.00.</p>
                    </button>

                    <button
                      onClick={() => setUnwindMode('EMERGENCY_UNWIND_100')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        unwindMode === 'EMERGENCY_UNWIND_100'
                          ? 'bg-rose-500/20 border-rose-500/60 text-white'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5 text-rose-400">
                        <AlertOctagon className="h-3.5 w-3.5" />
                        <span>100% Panic Button</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Orderly liquidation across all open contracts to pure cash.</p>
                    </button>
                  </div>

                  {/* Planned Execution Items Table */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                      Proposed Unwind Execution Orders ({unwindPlan.items.length} legs)
                    </span>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#0E1322] border-b border-slate-800 font-mono text-[9px] text-slate-400 uppercase">
                          <tr>
                            <th className="py-1.5 px-2">Contract</th>
                            <th className="py-1.5 px-2">Action</th>
                            <th className="py-1.5 px-2">Qty</th>
                            <th className="py-1.5 px-2">Est. Slip</th>
                            <th className="py-1.5 px-2 text-right">Margin Released</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {unwindPlan.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30 text-slate-300">
                              <td className="py-1.5 px-2 font-bold text-slate-200">{item.symbol}</td>
                              <td className="py-1.5 px-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.action === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                                  {item.action}
                                </span>
                              </td>
                              <td className="py-1.5 px-2">{item.quantity}</td>
                              <td className="py-1.5 px-2 text-slate-400">₹{item.estimatedSlippage}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-emerald-400">
                                ₹{item.marginReleased.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-mono">
                      <span className="text-slate-400">Total Margin Unlocked: </span>
                      <strong className="text-emerald-400 font-bold">₹{unwindPlan.totalMarginReleased.toLocaleString()}</strong>
                      <span className="text-slate-500 mx-2">•</span>
                      <span className="text-slate-400">Est. Latency: </span>
                      <strong className="text-cyan-400">{unwindPlan.estimatedExecutionTimeMs}ms</strong>
                    </div>

                    <button
                      onClick={handleExecuteUnwind}
                      disabled={isExecutingUnwind}
                      className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition ${
                        unwindMode === 'EMERGENCY_UNWIND_100'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                      }`}
                    >
                      {isExecutingUnwind ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Routing Smart Slices...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 fill-white" />
                          <span>Execute De-Risking Plan</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Success notification */}
                  {unwindCompleteMessage && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800/70 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{unwindCompleteMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-[#090C14] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span>Pre-Trade RMS active. Microsecond order sizing & volatility risk scanning enabled.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Close Desk
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
