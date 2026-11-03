'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  PortfolioPositionGreeks,
  PortfolioGreekSummary,
  HedgeInstrumentType,
  HedgeRecommendation,
  AutoRebalanceConfig,
  HedgeExecutionRecord,
} from '../types/greeksHedger';
import {
  calculatePortfolioGreeks,
  solveDeltaNeutralHedge,
  simulatePriceShockScenarios,
  generateCurvaturePayoffCurve,
  checkAutoRebalanceCondition,
  createHedgeExecution,
  getMockPortfolioPositions,
} from '../lib/greeksHedgerEngine';

interface GreeksHedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpotPrice?: number;
}

export function GreeksHedgerModal({
  isOpen,
  onClose,
  currentSpotPrice = 24900,
}: GreeksHedgerModalProps) {
  // State
  const [spotPrice, setSpotPrice] = useState<number>(currentSpotPrice);
  const [positions, setPositions] = useState<PortfolioPositionGreeks[]>(() =>
    getMockPortfolioPositions(currentSpotPrice)
  );
  const [preferredInstrument, setPreferredInstrument] = useState<HedgeInstrumentType>('FUTURES');
  const [toleranceDelta, setToleranceDelta] = useState<number>(25);
  const [autoRebalanceEnabled, setAutoRebalanceEnabled] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'payoff' | 'positions' | 'history'>('payoff');
  const [executionHistory, setExecutionHistory] = useState<HedgeExecutionRecord[]>([
    {
      id: 'HDG-INIT-001',
      timestamp: '09:45:12 AM',
      symbol: 'NIFTY FUT',
      side: 'SELL',
      lots: 1,
      quantity: 25,
      executionPrice: 24890,
      preDelta: 48.5,
      postDelta: 23.5,
      triggerReason: 'Morning open rebalance: reduced net long delta within ±25 band.',
      status: 'FILLED',
    },
  ]);
  const [notification, setNotification] = useState<string | null>(null);

  // Sync spot price if prop updates
  useEffect(() => {
    if (currentSpotPrice && currentSpotPrice !== spotPrice) {
      setSpotPrice(currentSpotPrice);
    }
  }, [currentSpotPrice]);

  // Derived Greeks Summary
  const summary: PortfolioGreekSummary = useMemo(() => {
    return calculatePortfolioGreeks(positions, spotPrice, 'NIFTY 50');
  }, [positions, spotPrice]);

  // Derived Hedge Recommendation
  const recommendation: HedgeRecommendation = useMemo(() => {
    return solveDeltaNeutralHedge(summary, preferredInstrument, 0, 25);
  }, [summary, preferredInstrument]);

  // Derived Price Shock Stress Scenarios
  const scenarios = useMemo(() => {
    return simulatePriceShockScenarios(summary, [-2.0, -1.0, -0.5, 0.5, 1.0, 2.0], recommendation);
  }, [summary, recommendation]);

  // Derived Curvature Payoff Curve Points
  const curvePoints = useMemo(() => {
    return generateCurvaturePayoffCurve(summary, recommendation, 25, 4.0);
  }, [summary, recommendation]);

  // Auto-Rebalance Daemon Check
  const rebalanceCheck = useMemo(() => {
    const config: AutoRebalanceConfig = {
      enabled: autoRebalanceEnabled,
      toleranceDelta,
      preferredInstrument,
      maxHedgeLots: 4,
      lastRebalancedAt: null,
    };
    return checkAutoRebalanceCondition(summary, config);
  }, [summary, autoRebalanceEnabled, toleranceDelta, preferredInstrument]);

  // Dismiss notification after 4s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!isOpen) return null;

  // Execute Hedge Handler
  const handleExecuteHedge = () => {
    if (recommendation.recommendedLots === 0) return;

    const record = createHedgeExecution(recommendation, summary.netDelta);
    setExecutionHistory((prev) => [record, ...prev]);

    // Create counter position to adjust portfolio Greeks
    const newHedgePosition: PortfolioPositionGreeks = {
      id: `HEDGE-${Date.now()}`,
      symbol: recommendation.symbol,
      assetType: preferredInstrument === 'FUTURES' ? 'FUTURES' : 'OPTION',
      side: recommendation.side,
      quantity: recommendation.recommendedQty,
      entryPrice: recommendation.estimatedPrice,
      currentPrice: recommendation.estimatedPrice,
      greeks: {
        delta: preferredInstrument === 'FUTURES' ? 1.0 : preferredInstrument === 'ATM_CALL' ? 0.5 : -0.5,
        gamma: 0,
        theta: 0,
        vega: 0,
      },
      lotSize: recommendation.lotSize,
    };

    setPositions((prev) => [...prev, newHedgePosition]);
    setNotification(
      `✅ Executed ${recommendation.side} ${recommendation.recommendedLots} Lot(s) ${recommendation.symbol} @ ₹${recommendation.estimatedPrice.toLocaleString('en-IN')}. Portfolio Delta neutralized!`
    );
  };

  // Reset Mock Positions
  const handleResetPositions = () => {
    setPositions(getMockPortfolioPositions(spotPrice));
    setNotification('🔄 Portfolio positions reset to default multi-leg options configuration.');
  };

  // Add random Delta drift for interactive testing
  const handleInjectDrift = (amount: number) => {
    const driftPosition: PortfolioPositionGreeks = {
      id: `DRIFT-${Date.now()}`,
      symbol: `NIFTY DRIFT ${amount > 0 ? 'CE' : 'PE'}`,
      assetType: 'OPTION',
      side: amount > 0 ? 'BUY' : 'SELL',
      quantity: Math.abs(amount),
      entryPrice: 120,
      currentPrice: 125,
      greeks: {
        delta: 1.0,
        gamma: 0.001,
        theta: -15,
        vega: 20,
      },
      lotSize: 25,
    };
    setPositions((prev) => [...prev, driftPosition]);
    setNotification(`⚡ Injected delta shock of ${amount > 0 ? '+' : ''}${amount} Δ into portfolio.`);
  };

  // SVG Chart Dimensions
  const chartWidth = 620;
  const chartHeight = 220;
  const padding = 35;

  // Compute SVG Scaling
  const minShift = -4.0;
  const maxShift = 4.0;
  const allPnLs = curvePoints.flatMap((p) => [p.unhedgedPnL, p.hedgedPnL]);
  const minPnL = Math.min(...allPnLs, -5000);
  const maxPnL = Math.max(...allPnLs, 5000);

  const getSvgX = (shift: number) =>
    padding + ((shift - minShift) / (maxShift - minShift)) * (chartWidth - padding * 2);
  const getSvgY = (pnl: number) =>
    chartHeight - padding - ((pnl - minPnL) / (maxPnL - minPnL)) * (chartHeight - padding * 2);

  // SVG Path Data
  const unhedgedPath = curvePoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(p.percentShift)} ${getSvgY(p.unhedgedPnL)}`)
    .join(' ');

  const hedgedPath = curvePoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(p.percentShift)} ${getSvgY(p.hedgedPnL)}`)
    .join(' ');

  const zeroY = getSvgY(0);
  const zeroX = getSvgX(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-xl shadow-inner">
              🛡️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Real-Time Options Greeks Hedger
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Sprint 13
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center space-x-1 ${
                    autoRebalanceEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      autoRebalanceEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                    }`}
                  ></span>
                  <span>AUTOBALANCER: {autoRebalanceEnabled ? 'ACTIVE' : 'STANDBY'}</span>
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Institutional Delta-Gamma Neutral Autobalancer & Taylor Curvature Stress Modeler
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Spot Price Display */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center space-x-2 text-xs">
              <span className="text-neutral-400 font-medium">NIFTY SPOT:</span>
              <span className="font-mono font-bold text-white">₹{spotPrice.toLocaleString('en-IN')}</span>
            </div>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {notification && (
          <div className="px-6 py-2 bg-indigo-950/80 border-b border-indigo-800/40 text-xs font-mono text-indigo-300 flex items-center justify-between animate-fadeIn">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="text-indigo-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Top Section: Greeks Risk Radar Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Net Delta Gauge */}
            <div
              className={`p-4 rounded-xl border transition ${
                summary.deltaRiskStatus === 'NEUTRAL'
                  ? 'bg-emerald-950/20 border-emerald-800/30'
                  : summary.deltaRiskStatus === 'MODERATE_LONG' || summary.deltaRiskStatus === 'MODERATE_SHORT'
                  ? 'bg-amber-950/20 border-amber-800/30'
                  : 'bg-rose-950/20 border-rose-800/30'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400 font-semibold uppercase tracking-wider">Net Delta (Δ)</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    summary.deltaRiskStatus === 'NEUTRAL'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : summary.deltaRiskStatus === 'MODERATE_LONG' || summary.deltaRiskStatus === 'MODERATE_SHORT'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {summary.deltaRiskStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span
                  className={`text-2xl font-mono font-extrabold ${
                    summary.netDelta > 0
                      ? 'text-emerald-400'
                      : summary.netDelta < 0
                      ? 'text-rose-400'
                      : 'text-neutral-200'
                  }`}
                >
                  {summary.netDelta > 0 ? '+' : ''}
                  {summary.netDelta}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">shares eq.</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-300 ${
                    summary.netDelta > 0 ? 'bg-emerald-500 ml-auto' : 'bg-rose-500 mr-auto'
                  }`}
                  style={{ width: `${Math.min(100, (Math.abs(summary.netDelta) / 100) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">Band: ±{toleranceDelta} Δ</p>
            </div>

            {/* Net Gamma Gauge */}
            <div
              className={`p-4 rounded-xl border transition ${
                summary.gammaRiskStatus === 'SAFE'
                  ? 'bg-emerald-950/20 border-emerald-800/30'
                  : summary.gammaRiskStatus === 'ELEVATED'
                  ? 'bg-amber-950/20 border-amber-800/30'
                  : 'bg-rose-950/20 border-rose-800/30'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400 font-semibold uppercase tracking-wider">Net Gamma (Γ)</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    summary.gammaRiskStatus === 'SAFE'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : summary.gammaRiskStatus === 'ELEVATED'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {summary.gammaRiskStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span
                  className={`text-2xl font-mono font-extrabold ${
                    summary.netGamma < -0.01 ? 'text-rose-400' : 'text-neutral-200'
                  }`}
                >
                  {summary.netGamma > 0 ? '+' : ''}
                  {summary.netGamma}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">Δ / ₹</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    summary.netGamma < -0.05 ? 'bg-rose-500' : summary.netGamma < -0.01 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.abs(summary.netGamma * 1000))}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">Curvature acceleration</p>
            </div>

            {/* Net Theta Gauge */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400 font-semibold uppercase tracking-wider">Daily Theta (Θ)</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    summary.netTheta >= 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {summary.netTheta >= 0 ? 'DECAY BENEFIT' : 'DECAY DRAG'}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span
                  className={`text-2xl font-mono font-extrabold ${
                    summary.netTheta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {summary.netTheta > 0 ? '+' : ''}₹{Math.abs(summary.netTheta).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">/ day</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-cyan-500"
                  style={{ width: `${Math.min(100, (Math.abs(summary.netTheta) / 3000) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">Time decay velocity</p>
            </div>

            {/* Net Vega Gauge */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400 font-semibold uppercase tracking-wider">Net Vega (ν)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400">
                  VOLATILITY
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-mono font-extrabold text-neutral-200">
                  {summary.netVega > 0 ? '+' : ''}₹{summary.netVega.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">per 1% IV</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: `${Math.min(100, (Math.abs(summary.netVega) / 2500) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">Sensitivity to India VIX</p>
            </div>
          </div>

          {/* Middle Section: 1-Click Delta-Neutral Action Cockpit */}
          <div className="p-5 rounded-xl border border-indigo-800/30 bg-gradient-to-r from-indigo-950/20 via-neutral-900 to-neutral-900 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex-1 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  RECOMMENDED REBALANCING HEDGE
                </span>
                {rebalanceCheck.triggered && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30">
                    BAND BREACH DETECTED
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-white">
                {recommendation.rationale}
              </div>
              <div className="flex items-center space-x-4 text-xs text-neutral-400 font-mono">
                <span>Est. Price: ₹{recommendation.estimatedPrice.toLocaleString('en-IN')}</span>
                <span>•</span>
                <span>Margin Req: ₹{recommendation.estimatedMargin.toLocaleString('en-IN')}</span>
                <span>•</span>
                <span>
                  Post-Hedge Delta:{' '}
                  <strong className="text-cyan-400">
                    {recommendation.residualDelta > 0 ? '+' : ''}
                    {recommendation.residualDelta} Δ
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              {/* Instrument Selector */}
              <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-1 text-xs font-mono">
                <button
                  onClick={() => setPreferredInstrument('FUTURES')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    preferredInstrument === 'FUTURES'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  FUTURES (Δ=1)
                </button>
                <button
                  onClick={() => setPreferredInstrument('ATM_CALL')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    preferredInstrument === 'ATM_CALL'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  ATM CE
                </button>
                <button
                  onClick={() => setPreferredInstrument('ATM_PUT')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    preferredInstrument === 'ATM_PUT'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  ATM PE
                </button>
              </div>

              {/* Execute 1-Click Button */}
              <button
                onClick={handleExecuteHedge}
                disabled={recommendation.recommendedLots === 0}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg transition ${
                  recommendation.recommendedLots > 0
                    ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-indigo-500/20 active:scale-95'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                <span>🛡️</span>
                <span>Execute Neutral Hedge</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('payoff')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                  activeTab === 'payoff'
                    ? 'bg-neutral-800 text-white border border-neutral-700'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                📈 2D Curvature Payoff & Stress Matrix
              </button>
              <button
                onClick={() => setActiveTab('positions')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                  activeTab === 'positions'
                    ? 'bg-neutral-800 text-white border border-neutral-700'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                📋 Active Positions ({positions.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                  activeTab === 'history'
                    ? 'bg-neutral-800 text-white border border-neutral-700'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                📜 Execution Log ({executionHistory.length})
              </button>
            </div>

            {/* Test Simulation Controls */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-neutral-500 font-mono text-[11px]">Shock Simulation:</span>
              <button
                onClick={() => handleInjectDrift(+35)}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 rounded text-xs font-mono"
                title="Add +35 Long Delta to test autobalancing trigger"
              >
                +35 Δ Shock
              </button>
              <button
                onClick={() => handleInjectDrift(-35)}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-rose-400 rounded text-xs font-mono"
                title="Add -35 Short Delta to test autobalancing trigger"
              >
                -35 Δ Shock
              </button>
              <button
                onClick={handleResetPositions}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs font-mono"
              >
                Reset Default
              </button>
            </div>
          </div>

          {/* TAB 1: 2D Curvature & Payoff Visualizer */}
          {activeTab === 'payoff' && (
            <div className="space-y-6">
              {/* SVG 2D Curvature Chart */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col items-center">
                <div className="w-full flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-white tracking-wide">
                      Underlying Price Shock vs Expected P&L (₹)
                    </span>
                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className="w-3 h-0.5 bg-amber-400 inline-block"></span>
                      <span className="text-amber-400 font-mono">Unhedged Portfolio</span>
                      <span className="w-3 h-0.5 bg-cyan-400 inline-block ml-3"></span>
                      <span className="text-cyan-400 font-mono">Post-Hedge Stabilized</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Taylor Expansion: Δ·dS + ½Γ·(dS)²
                  </span>
                </div>

                <div className="w-full overflow-x-auto flex justify-center py-2">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full max-w-[620px] h-[220px] overflow-visible"
                  >
                    {/* Zero PnL Benchmark line */}
                    <line
                      x1={padding}
                      y1={zeroY}
                      x2={chartWidth - padding}
                      y2={zeroY}
                      stroke="#404040"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />

                    {/* Zero Shift (Spot) Benchmark line */}
                    <line
                      x1={zeroX}
                      y1={padding}
                      x2={zeroX}
                      y2={chartHeight - padding}
                      stroke="#404040"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />

                    {/* Zero labels */}
                    <text
                      x={padding - 5}
                      y={zeroY + 4}
                      fill="#737373"
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      ₹0
                    </text>
                    <text
                      x={zeroX}
                      y={chartHeight - padding + 14}
                      fill="#737373"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      0% (₹{spotPrice})
                    </text>

                    {/* Min & Max Labels */}
                    <text
                      x={padding}
                      y={chartHeight - padding + 14}
                      fill="#737373"
                      fontSize="9"
                      textAnchor="start"
                      fontFamily="monospace"
                    >
                      -4%
                    </text>
                    <text
                      x={chartWidth - padding}
                      y={chartHeight - padding + 14}
                      fill="#737373"
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      +4%
                    </text>

                    {/* Unhedged Curve */}
                    <path
                      d={unhedgedPath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Hedged Curve */}
                    <path
                      d={hedgedPath}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Center Spot Point */}
                    <circle cx={zeroX} cy={getSvgY(0)} r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* Scenario Stress Shock Matrix */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950/40 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Non-Linear Price Shock Matrix (±2% Underlying Volatility)
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    NSE Volatility Horizons
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Price Shock</th>
                        <th className="py-2.5 px-4">Underlying Level</th>
                        <th className="py-2.5 px-4">Projected Delta</th>
                        <th className="py-2.5 px-4">Unhedged P&L</th>
                        <th className="py-2.5 px-4">Hedged P&L</th>
                        <th className="py-2.5 px-4">Convexity Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {scenarios.map((sc, idx) => (
                        <tr key={idx} className="hover:bg-neutral-800/40 transition">
                          <td className="py-2.5 px-4 font-bold">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                sc.shockPercent > 0
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {sc.shockPercent > 0 ? '+' : ''}
                              {sc.shockPercent}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-white">₹{sc.projectedUnderlying.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-4 text-neutral-300">
                            {sc.projectedDelta > 0 ? '+' : ''}
                            {sc.projectedDelta} Δ
                          </td>
                          <td
                            className={`py-2.5 px-4 font-bold ${
                              sc.unhedgedExpectedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {sc.unhedgedExpectedPnL > 0 ? '+' : ''}₹{sc.unhedgedExpectedPnL.toLocaleString('en-IN')}
                          </td>
                          <td
                            className={`py-2.5 px-4 font-bold ${
                              sc.hedgedExpectedPnL >= 0 ? 'text-cyan-400' : 'text-rose-300'
                            }`}
                          >
                            {sc.hedgedExpectedPnL > 0 ? '+' : ''}₹{sc.hedgedExpectedPnL.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-neutral-400">
                            ₹{sc.convexityRisk.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Active Positions & Greek Breakdown */}
          {activeTab === 'positions' && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Instrument</th>
                      <th className="py-2.5 px-4">Side</th>
                      <th className="py-2.5 px-4">Qty / Lots</th>
                      <th className="py-2.5 px-4">Current Price</th>
                      <th className="py-2.5 px-4">Delta (Δ)</th>
                      <th className="py-2.5 px-4">Gamma (Γ)</th>
                      <th className="py-2.5 px-4">Theta (Θ)</th>
                      <th className="py-2.5 px-4">Vega (ν)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {positions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-neutral-800/40 transition">
                        <td className="py-2.5 px-4 font-bold text-white flex items-center space-x-2">
                          <span>{pos.symbol}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-neutral-800 text-neutral-400">
                            {pos.assetType}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              pos.side === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-white">
                          {pos.quantity} ({Math.round((pos.quantity / pos.lotSize) * 10) / 10} L)
                        </td>
                        <td className="py-2.5 px-4 text-neutral-300">₹{pos.currentPrice.toLocaleString('en-IN')}</td>
                        <td
                          className={`py-2.5 px-4 font-bold ${
                            pos.greeks.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {pos.greeks.delta > 0 ? '+' : ''}
                          {pos.greeks.delta}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-300">{pos.greeks.gamma}</td>
                        <td className="py-2.5 px-4 text-neutral-300">₹{pos.greeks.theta}/d</td>
                        <td className="py-2.5 px-4 text-neutral-300">₹{pos.greeks.vega}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Execution Log */}
          {activeTab === 'history' && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Order ID</th>
                      <th className="py-2.5 px-4">Instrument</th>
                      <th className="py-2.5 px-4">Side</th>
                      <th className="py-2.5 px-4">Qty</th>
                      <th className="py-2.5 px-4">Price</th>
                      <th className="py-2.5 px-4">Delta Before → After</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {executionHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-neutral-800/40 transition">
                        <td className="py-2.5 px-4 text-neutral-400">{rec.timestamp}</td>
                        <td className="py-2.5 px-4 text-indigo-400 font-bold">{rec.id}</td>
                        <td className="py-2.5 px-4 text-white font-semibold">{rec.symbol}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              rec.side === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {rec.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-white">
                          {rec.quantity} ({rec.lots}L)
                        </td>
                        <td className="py-2.5 px-4 text-neutral-300">₹{rec.executionPrice.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-neutral-300">
                          {rec.preDelta > 0 ? '+' : ''}
                          {rec.preDelta} Δ →{' '}
                          <strong className="text-cyan-400">
                            {rec.postDelta > 0 ? '+' : ''}
                            {rec.postDelta} Δ
                          </strong>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Autobalancer Configuration Footer */}
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRebalanceEnabled}
                  onChange={(e) => setAutoRebalanceEnabled(e.target.checked)}
                  className="rounded bg-neutral-800 border-neutral-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-300 font-semibold">Enable Auto-Pilot Autobalancer Daemon</span>
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-neutral-400">Rebalance Tolerance:</span>
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                {[15, 25, 50].map((tol) => (
                  <button
                    key={tol}
                    onClick={() => setToleranceDelta(tol)}
                    className={`px-2.5 py-1 rounded text-xs transition ${
                      toleranceDelta === tol
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    ±{tol} Δ
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GreeksHedgerModal;

