'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Gauge,
  Layers,
  Percent,
  Play,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  BasketConstituent,
  BasketPresetType,
  DispersionTradeType,
  ExecutedRebalanceLog,
  GammaScalpAlert,
  SmileComparisonPoint,
} from '../types/volatilityDispersion';
import {
  INDEX_CONFIGS,
  DEFAULT_NIFTY_CONSTITUENTS,
  generateTermStructureRibbon,
  generateSmileComparativePoints,
  calculateDispersionRadar,
  getConstituentsForPreset,
  evaluateGammaScalpAlerts,
  executeRebalanceHedge,
} from '../lib/volatilityDispersionEngine';

interface VolatilityDispersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice?: number;
  symbol?: string;
}

export function VolatilityDispersionModal({
  isOpen,
  onClose,
  spotPrice = 24920,
  symbol = 'NIFTY',
}: VolatilityDispersionModalProps) {
  // Modal Navigation & Configuration
  const [selectedIndexKey, setSelectedIndexKey] = useState<'NIFTY' | 'BANKNIFTY' | 'FINNIFTY'>('NIFTY');
  const [activeTab, setActiveTab] = useState<'ribbon_smile' | 'radar_correlation' | 'basket_constituents' | 'gamma_scalp'>('ribbon_smile');
  const [basketPreset, setBasketPreset] = useState<BasketPresetType>('NIFTY_TOP10');
  const [tradeType, setTradeType] = useState<DispersionTradeType>('LONG_DISPERSION');

  // Simulated Market Prices & Shocks
  const [currentIndexSpot, setCurrentIndexSpot] = useState<number>(spotPrice);
  const [spotShockOffset, setSpotShockOffset] = useState<number>(0);
  const [customIndexIVShock, setCustomIndexIVShock] = useState<number>(0);

  // Basket Constituents with Custom Weights
  const [constituents, setConstituents] = useState<BasketConstituent[]>(() =>
    getConstituentsForPreset('NIFTY_TOP10', DEFAULT_NIFTY_CONSTITUENTS)
  );

  // Gamma Scalper Parameters & Ledger
  const [activeDeltaDrift, setActiveDeltaDrift] = useState<number>(28.4);
  const [driftThreshold, setDriftThreshold] = useState<number>(20.0);
  const [cumulativeScalpPnl, setCumulativeScalpPnl] = useState<number>(48250);
  const [executedLedger, setExecutedLedger] = useState<ExecutedRebalanceLog[]>([
    {
      id: 'init-1',
      timestamp: '09:42:15',
      instrument: 'NIFTY FUT (Current Month)',
      action: 'SELL_FUTURES',
      quantity: 25,
      executionPrice: 24890,
      lockedScalpPnl: 6250,
      resultingNetDelta: 0.0,
    },
    {
      id: 'init-2',
      timestamp: '11:15:40',
      instrument: 'NIFTY FUT (Current Month)',
      action: 'BUY_FUTURES',
      quantity: 30,
      executionPrice: 24845,
      lockedScalpPnl: 8400,
      resultingNetDelta: 0.0,
    },
  ]);

  // UI Interactive States
  const [hoveredSmilePoint, setHoveredSmilePoint] = useState<SmileComparisonPoint | null>(null);
  const [smileAxisMode, setSmileAxisMode] = useState<'STRIKE' | 'MONEYNESS' | 'DELTA'>('STRIKE');
  const [systemNotification, setSystemNotification] = useState<string | null>(null);
  const [isAutoScalpActive, setIsAutoScalpActive] = useState<boolean>(true);

  const activeIndexConfig = INDEX_CONFIGS[selectedIndexKey];

  // Update spot if index selector changes
  useEffect(() => {
    setCurrentIndexSpot(activeIndexConfig.spotPrice + spotShockOffset);
  }, [selectedIndexKey, spotShockOffset, activeIndexConfig.spotPrice]);

  // Handle Preset Switch
  const handleSelectPreset = (preset: BasketPresetType) => {
    setBasketPreset(preset);
    const updated = getConstituentsForPreset(preset, DEFAULT_NIFTY_CONSTITUENTS);
    setConstituents(updated);
    setSystemNotification(`Loaded Basket Preset: ${preset.replace('_', ' ')} (${updated.length} assets)`);
    setTimeout(() => setSystemNotification(null), 3500);
  };

  // Adjust Individual Constituent Weight
  const handleWeightChange = (symbol: string, newWeight: number) => {
    setConstituents((prev) =>
      prev.map((c) => (c.symbol === symbol ? { ...c, weight: Math.max(0.01, Math.min(0.5, newWeight)) } : c))
    );
  };

  // Auto-normalize Basket Weights to 100%
  const handleNormalizeWeights = () => {
    const sum = constituents.reduce((acc, c) => acc + c.weight, 0);
    if (sum === 0) return;
    setConstituents((prev) =>
      prev.map((c) => ({
        ...c,
        weight: Number((c.weight / sum).toFixed(4)),
      }))
    );
    setSystemNotification('Basket weights normalized to 100.0% exactly.');
    setTimeout(() => setSystemNotification(null), 3000);
  };

  // Term Structure Ribbon Data
  const termStructure = useMemo(() => {
    const baseIV = activeIndexConfig.baseATMIV + customIndexIVShock;
    return generateTermStructureRibbon(currentIndexSpot, baseIV);
  }, [currentIndexSpot, activeIndexConfig.baseATMIV, customIndexIVShock]);

  // Smile Comparative Points (Near Month vs Next Month)
  const { points: smilePoints, metrics: smileMetrics } = useMemo(() => {
    const nearATM = termStructure[1]?.atmIV || 13.8;
    const nextATM = termStructure[3]?.atmIV || 14.5;
    return generateSmileComparativePoints(currentIndexSpot, nearATM, nextATM);
  }, [currentIndexSpot, termStructure]);

  // Dispersion & Correlation Radar Data
  const dispersionRadar = useMemo(() => {
    const indexIV = activeIndexConfig.baseATMIV + customIndexIVShock;
    return calculateDispersionRadar(
      currentIndexSpot,
      indexIV,
      activeIndexConfig.baseRV,
      constituents,
      activeIndexConfig.historicalCorrelation
    );
  }, [currentIndexSpot, activeIndexConfig, customIndexIVShock, constituents]);

  // Dynamic Gamma Scalp Alerts Feed
  const scalpAlerts = useMemo(() => {
    return evaluateGammaScalpAlerts(
      activeDeltaDrift,
      driftThreshold,
      currentIndexSpot,
      dispersionRadar.portfolioNetGamma
    );
  }, [activeDeltaDrift, driftThreshold, currentIndexSpot, dispersionRadar.portfolioNetGamma]);

  // Shock Spot Price by Points
  const handleSpotShock = (pointsDelta: number) => {
    setSpotShockOffset((prev) => prev + pointsDelta);
    // Spot shift induces delta drift through gamma curvature: Δ_drift = Gamma * ΔS
    const addedDrift = Number(((pointsDelta * dispersionRadar.portfolioNetGamma) / 55).toFixed(1));
    setActiveDeltaDrift((prev) => Number((prev + addedDrift).toFixed(1)));
    setSystemNotification(
      `⚡ Market Shock Applied: Spot ${pointsDelta > 0 ? '+' : ''}${pointsDelta} pts | Delta Drift ${addedDrift > 0 ? '+' : ''}${addedDrift}Δ`
    );
    setTimeout(() => setSystemNotification(null), 3500);
  };

  // Rebalance Execution Action
  const handleExecuteRebalance = (alert: GammaScalpAlert) => {
    const { log } = executeRebalanceHedge(alert, currentIndexSpot);
    setExecutedLedger((prev) => [log, ...prev]);
    setCumulativeScalpPnl((prev) => prev + log.lockedScalpPnl);
    setActiveDeltaDrift(0.0);
    setSystemNotification(
      `🎯 REBALANCE EXECUTED: ${log.action} ${log.quantity}x @ ₹${log.executionPrice} | Locked ₹${log.lockedScalpPnl.toLocaleString('en-IN')} Scalp P&L | Residual Delta: 0.00`
    );
    setTimeout(() => setSystemNotification(null), 5000);
  };

  // Deploy Dispersion Structure
  const handleDeployDispersion = () => {
    setSystemNotification(
      `🚀 DISPERSION BOOK DEPLOYED: Sold 1x ${dispersionRadar.indexSymbol} Straddle @ ATM IV ${dispersionRadar.indexIV}% | Bought Weighted Constituents Basket (${constituents.length} legs) | Target Net Carry: ₹${dispersionRadar.estDailyCarry.toLocaleString('en-IN')}/day`
    );
    setTimeout(() => setSystemNotification(null), 6000);
  };

  if (!isOpen) return null;

  // SVG dimensions for Smile Chart
  const svgWidth = 820;
  const svgHeight = 260;
  const padding = { top: 25, right: 35, bottom: 40, left: 55 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const minStrike = Math.min(...smilePoints.map((p) => p.strike));
  const maxStrike = Math.max(...smilePoints.map((p) => p.strike));
  const allIVs = smilePoints.flatMap((p) => [p.nearIV, p.nextIV]);
  const minIV = Math.floor(Math.min(...allIVs) - 1);
  const maxIV = Math.ceil(Math.max(...allIVs) + 1);

  const getSmileX = (strike: number) =>
    padding.left + ((strike - minStrike) / Math.max(1, maxStrike - minStrike)) * graphWidth;
  const getSmileY = (iv: number) =>
    padding.top + graphHeight - ((iv - minIV) / Math.max(1, maxIV - minIV)) * graphHeight;

  // SVG Path for Near Month Curve
  const nearPath = smilePoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getSmileX(p.strike)} ${getSmileY(p.nearIV)}`)
    .join(' ');

  // SVG Path for Next Month Curve
  const nextPath = smilePoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getSmileX(p.strike)} ${getSmileY(p.nextIV)}`)
    .join(' ');

  // Area under Near Month Curve
  const nearArea = `${nearPath} L ${getSmileX(maxStrike)} ${padding.top + graphHeight} L ${getSmileX(
    minStrike
  )} ${padding.top + graphHeight} Z`;

  // ATM line
  const atmX = getSmileX(currentIndexSpot);

  // Implied Correlation Needle Angle (-120deg to +120deg)
  const corrAngle = -120 + dispersionRadar.impliedCorrelation * 240;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div
        className="relative w-full max-w-6xl bg-[#0B0F19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Institutional Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-[#070A11] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-amber-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 tracking-tight">
                  Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Sprint 21
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                  Live Quant Lab
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>Implied Correlation Matrix</span>
                <span>•</span>
                <span>Near vs Next Skew Differential</span>
                <span>•</span>
                <span>Active Gamma Scalping Curvature</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Index Selector */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-medium">
              {(['NIFTY', 'BANKNIFTY', 'FINNIFTY'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedIndexKey(key)}
                  className={`px-2.5 py-1 rounded-md transition ${
                    selectedIndexKey === key
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {INDEX_CONFIGS[key].symbol}
                </button>
              ))}
            </div>

            {/* Live Spot & Vol Summary Pill */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1 flex items-center gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block">SPOT</span>
                <strong className="text-slate-100">₹{currentIndexSpot.toLocaleString('en-IN')}</strong>
              </div>
              <div className="h-5 w-px bg-slate-800" />
              <div>
                <span className="text-slate-500 text-[10px] block">INDEX IV</span>
                <strong className="text-cyan-400">{dispersionRadar.indexIV.toFixed(1)}%</strong>
              </div>
              <div className="h-5 w-px bg-slate-800" />
              <div>
                <span className="text-slate-500 text-[10px] block">BASKET IV</span>
                <strong className="text-amber-400">{dispersionRadar.basketWeightedIV.toFixed(1)}%</strong>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {systemNotification && (
          <div className="bg-gradient-to-r from-blue-950/90 via-cyan-950/80 to-slate-900 px-4 py-2 border-b border-cyan-800/40 text-xs text-cyan-200 flex items-center justify-between animate-in slide-in-from-top-2 duration-150">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
              {systemNotification}
            </span>
            <button onClick={() => setSystemNotification(null)} className="text-cyan-400 hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Quick Institutional Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-[#0A0E17] border-b border-slate-800/80 text-xs">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Dispersion Margin</span>
              <Percent className="h-3 w-3 text-cyan-400" />
            </div>
            <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">
              +{dispersionRadar.dispersionSpread.toFixed(2)}%
            </div>
            <span className="text-[10px] text-slate-500">Basket IV - Index IV</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Implied Correlation</span>
              <Gauge className="h-3 w-3 text-amber-400" />
            </div>
            <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
              {(dispersionRadar.impliedCorrelation * 100).toFixed(0)}%
            </div>
            <span className="text-[10px] text-slate-500">
              vs Realized {(dispersionRadar.realizedCorrelation * 100).toFixed(0)}% (+{(dispersionRadar.correlationSpread * 100).toFixed(0)}pts)
            </span>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Active Net Delta</span>
              <Activity className="h-3 w-3 text-blue-400" />
            </div>
            <div
              className={`text-base font-bold font-mono mt-0.5 ${
                Math.abs(activeDeltaDrift) >= driftThreshold ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {activeDeltaDrift > 0 ? '+' : ''}
              {activeDeltaDrift.toFixed(1)} Δ
            </div>
            <span className="text-[10px] text-slate-500">Limit: ±{driftThreshold.toFixed(0)} Delta</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Portfolio Net Gamma</span>
              <TrendingUp className="h-3 w-3 text-purple-400" />
            </div>
            <div className="text-base font-bold text-purple-400 font-mono mt-0.5">
              +{dispersionRadar.portfolioNetGamma.toFixed(1)}
            </div>
            <span className="text-[10px] text-slate-500">Curvature per Index pt</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Est. Daily Carry</span>
              <ArrowRightLeft className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
              +₹{dispersionRadar.estDailyCarry.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-500">Net Theta - Hedge Costs</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Scalp Realized P&L</span>
              <Sparkles className="h-3 w-3 text-amber-400" />
            </div>
            <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
              +₹{cumulativeScalpPnl.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-500">{executedLedger.length} executed hedges</span>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="px-4 border-b border-slate-800 bg-[#090D18] flex items-center justify-between">
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab('ribbon_smile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'ribbon_smile'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
              <span>Multi-Expiry Term & Smile</span>
            </button>

            <button
              onClick={() => setActiveTab('radar_correlation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'radar_correlation'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Gauge className="h-3.5 w-3.5 text-amber-400" />
              <span>Dispersion Spread Radar</span>
            </button>

            <button
              onClick={() => setActiveTab('basket_constituents')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'basket_constituents'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>Constituents & Weighting ({constituents.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('gamma_scalp')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'gamma_scalp'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5 text-rose-400" />
              <span>Active Gamma Scalper</span>
              {scalpAlerts.some((a) => a.urgency === 'CRITICAL') && (
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>

          {/* Quick Shock Simulator Controls */}
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Shock Spot:</span>
            <button
              onClick={() => handleSpotShock(-50)}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-rose-500 text-rose-400 text-[10px] font-mono transition"
              title="Shock spot price down 50 points"
            >
              -50 pts
            </button>
            <button
              onClick={() => handleSpotShock(50)}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-emerald-500 text-emerald-400 text-[10px] font-mono transition"
              title="Shock spot price up 50 points"
            >
              +50 pts
            </button>
            <button
              onClick={() => {
                setSpotShockOffset(0);
                setActiveDeltaDrift(0);
                setSystemNotification('Reset simulated shocks to live base prices.');
              }}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:text-white text-slate-400 text-[10px]"
              title="Reset shocks"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: Multi-Expiry Term Structure Ribbon & Smile Comparative View */}
          {activeTab === 'ribbon_smile' && (
            <div className="space-y-4">
              {/* Term Structure Ribbon Cards */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Multi-Expiry Volatility Term Structure Ribbon
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      Contango / Backwardation Radar
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Term Slope: <strong className="text-cyan-400">+{smileMetrics.termSlopeSpread.toFixed(2)}%</strong> (Near 14D → Next 42D)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {termStructure.map((term, idx) => {
                    const isContango = term.termRegime === 'CONTANGO';
                    const isNearOrNext = idx === 1 || idx === 3;
                    return (
                      <div
                        key={term.id}
                        className={`rounded-xl p-2.5 border transition ${
                          isNearOrNext
                            ? 'bg-blue-950/30 border-blue-500/50 shadow-md ring-1 ring-blue-500/20'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-200">{term.label}</span>
                          <span className="font-mono">{term.daysToExpiry}D</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-bold font-mono text-white">{term.atmIV.toFixed(2)}%</span>
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                              isContango
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {term.termRegime}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>Fwd ₹{term.forwardPrice.toLocaleString('en-IN')}</span>
                          <span className="text-slate-400">Skew: {term.skewSteepness}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Smile Comparative View (Near Month vs Next Month) */}
              <div className="bg-[#080C16] border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                      Volatility Smile Comparative Matrix: Near Month vs Next Month
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono font-medium">
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                        Near Month ({smileMetrics.nearExpiryLabel})
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono font-medium">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Next Month ({smileMetrics.nextExpiryLabel})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-mono">X-Axis Mode:</span>
                    {(['STRIKE', 'MONEYNESS', 'DELTA'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSmileAxisMode(mode)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                          smileAxisMode === mode
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive SVG Smile Curve Chart */}
                <div className="relative bg-slate-950/60 border border-slate-800/80 rounded-xl p-2 overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto max-h-[300px] select-none"
                    onMouseLeave={() => setHoveredSmilePoint(null)}
                  >
                    <defs>
                      <linearGradient id="nearGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="nextGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[minIV, Math.round((minIV + maxIV) / 2), maxIV].map((ivVal) => {
                      const y = getSmileY(ivVal);
                      return (
                        <g key={ivVal}>
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={svgWidth - padding.right}
                            y2={y}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <text
                            x={padding.left - 8}
                            y={y + 3}
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                            textAnchor="end"
                          >
                            {ivVal}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Vertical ATM Indicator Line */}
                    <line
                      x1={atmX}
                      y1={padding.top}
                      x2={atmX}
                      y2={padding.top + graphHeight}
                      stroke="#3b82f6"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <text
                      x={atmX + 4}
                      y={padding.top + 10}
                      fill="#60a5fa"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ATM ₹{currentIndexSpot}
                    </text>

                    {/* Shaded Area for Near Month */}
                    <path d={nearArea} fill="url(#nearGradient)" />

                    {/* Next Month Smile Curve (Amber) */}
                    <path
                      d={nextPath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Near Month Smile Curve (Cyan) */}
                    <path
                      d={nearPath}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Strike Points & Hover Triggers */}
                    {smilePoints.map((point) => {
                      const x = getSmileX(point.strike);
                      const yNear = getSmileY(point.nearIV);
                      const yNext = getSmileY(point.nextIV);
                      const isHovered = hoveredSmilePoint?.strike === point.strike;

                      return (
                        <g key={point.strike}>
                          {/* Strike tick on X axis */}
                          <line
                            x1={x}
                            y1={padding.top + graphHeight}
                            x2={x}
                            y2={padding.top + graphHeight + 4}
                            stroke="#334155"
                            strokeWidth="1"
                          />

                          {/* Dots */}
                          <circle
                            cx={x}
                            cy={yNext}
                            r={isHovered ? 4.5 : 2.5}
                            fill="#f59e0b"
                            stroke="#0f172a"
                            strokeWidth="1"
                          />
                          <circle
                            cx={x}
                            cy={yNear}
                            r={isHovered ? 5 : 3}
                            fill="#06b6d4"
                            stroke="#0f172a"
                            strokeWidth="1"
                          />

                          {/* Invisible hover capture rect */}
                          <rect
                            x={x - 14}
                            y={padding.top}
                            width="28"
                            height={graphHeight}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredSmilePoint(point)}
                          />
                        </g>
                      );
                    })}

                    {/* X-Axis labels */}
                    {smilePoints
                      .filter((_, idx) => idx % 3 === 0 || idx === smilePoints.length - 1)
                      .map((point) => {
                        const x = getSmileX(point.strike);
                        let labelText = point.strike.toString();
                        if (smileAxisMode === 'MONEYNESS') labelText = `${(point.moneyness * 100).toFixed(0)}%`;
                        if (smileAxisMode === 'DELTA') labelText = `${point.deltaApprox > 0 ? '+' : ''}${point.deltaApprox}Δ`;

                        return (
                          <text
                            key={point.strike}
                            x={x}
                            y={padding.top + graphHeight + 16}
                            fill="#94a3b8"
                            fontSize="9"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            {labelText}
                          </text>
                        );
                      })}
                  </svg>

                  {/* Tooltip on Strike Hover */}
                  {hoveredSmilePoint && (
                    <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs font-mono max-w-xs pointer-events-none animate-in fade-in duration-100">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                        <span className="font-bold text-white text-sm">Strike: ₹{hoveredSmilePoint.strike}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          Moneyness {(hoveredSmilePoint.moneyness * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-cyan-400">Near Month IV:</span>
                          <span className="font-bold text-slate-100">{hoveredSmilePoint.nearIV}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-amber-400">Next Month IV:</span>
                          <span className="font-bold text-slate-100">{hoveredSmilePoint.nextIV}%</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800/80 pt-1">
                          <span className="text-slate-400">Spread (Near - Next):</span>
                          <span
                            className={`font-bold ${
                              hoveredSmilePoint.ivSpread > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {hoveredSmilePoint.ivSpread > 0 ? '+' : ''}
                            {hoveredSmilePoint.ivSpread.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[10px] pt-1">
                          <span>Near Call/Put:</span>
                          <span>₹{hoveredSmilePoint.nearCallPrice} / ₹{hoveredSmilePoint.nearPutPrice}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>Next Call/Put:</span>
                          <span>₹{hoveredSmilePoint.nextCallPrice} / ₹{hoveredSmilePoint.nextPutPrice}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Skew Analytics Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs font-mono">
                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">25Δ Put Skew (Near vs Next)</span>
                    <span className="text-cyan-300 font-bold">{smileMetrics.near25dPutIV}%</span>{' '}
                    <span className="text-slate-500">vs</span>{' '}
                    <span className="text-amber-300 font-bold">{smileMetrics.next25dPutIV}%</span>
                  </div>

                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">25Δ Risk Reversal (Near)</span>
                    <span className="text-rose-400 font-bold">{smileMetrics.nearRiskReversal}%</span>
                    <span className="text-[10px] text-slate-500 block">Downside Put Premium</span>
                  </div>

                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">25Δ Butterfly (Convexity)</span>
                    <span className="text-emerald-400 font-bold">+{smileMetrics.nearButterfly}%</span>
                    <span className="text-[10px] text-slate-500 block">Wing Kurtosis</span>
                  </div>

                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Term Skew Differential</span>
                    <span className="text-purple-400 font-bold">
                      {smileMetrics.skewDifferential > 0 ? '+' : ''}
                      {smileMetrics.skewDifferential}%
                    </span>
                    <span className="text-[10px] text-slate-500 block">Near RR - Next RR</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Dispersion Spread Radar & Implied Correlation Matrix */}
          {activeTab === 'radar_correlation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Implied Correlation Institutional Gauge (5 cols) */}
                <div className="lg:col-span-5 bg-[#080C16] border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Gauge className="h-4 w-4 text-amber-400" />
                      Implied Correlation Gauge (ρ)
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        dispersionRadar.correlationRegime === 'RICH_CORRELATION'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : dispersionRadar.correlationRegime === 'CHEAP_CORRELATION'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {dispersionRadar.correlationRegime.replace('_', ' ')}
                    </span>
                  </div>

                  {/* SVG Semi-Circular Meter */}
                  <div className="relative w-64 h-36 flex items-center justify-center">
                    <svg viewBox="0 0 200 120" className="w-full h-full">
                      {/* Gauge Background Arcs */}
                      {/* Low Corr Zone (0 to 0.35) - Green */}
                      <path
                        d="M 20 100 A 80 80 0 0 1 65 35"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="12"
                        strokeLinecap="round"
                        opacity="0.7"
                      />
                      {/* Normal Corr Zone (0.35 to 0.55) - Blue */}
                      <path
                        d="M 68 32 A 80 80 0 0 1 132 32"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="12"
                        opacity="0.7"
                      />
                      {/* High Corr Zone (0.55 to 1.0) - Amber/Rose */}
                      <path
                        d="M 135 35 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="12"
                        strokeLinecap="round"
                        opacity="0.7"
                      />

                      {/* Needle */}
                      <g transform={`rotate(${corrAngle}, 100, 100)`}>
                        <line x1="100" y1="100" x2="100" y2="28" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="100" cy="100" r="5" fill="#ffffff" />
                      </g>

                      {/* Value readout inside arc */}
                      <text x="100" y="85" fill="#f8fafc" fontSize="22" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                        {(dispersionRadar.impliedCorrelation * 100).toFixed(0)}%
                      </text>
                      <text x="100" y="100" fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">
                        Implied ρ
                      </text>
                    </svg>
                  </div>

                  {/* Correlation Spread Comparison */}
                  <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs font-mono space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Implied Correlation (ρ_impl):</span>
                      <strong className="text-amber-400">{(dispersionRadar.impliedCorrelation * 100).toFixed(1)}%</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Realized 30D Corr (ρ_real):</span>
                      <strong className="text-blue-300">{(dispersionRadar.realizedCorrelation * 100).toFixed(1)}%</strong>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-800 pt-1.5">
                      <span className="text-slate-300 font-bold">Correlation Premium:</span>
                      <span
                        className={`font-bold ${
                          dispersionRadar.correlationSpread > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {dispersionRadar.correlationSpread > 0 ? '+' : ''}
                        {(dispersionRadar.correlationSpread * 100).toFixed(1)} pts
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 text-center">
                    {dispersionRadar.tradeRationale}
                  </p>
                </div>

                {/* Dispersion Spread Radar & Volatility Differential (7 cols) */}
                <div className="lg:col-span-7 bg-[#080C16] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Percent className="h-4 w-4 text-cyan-400" />
                      Index IV vs Basket IV Dispersion Breakdown
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                      Weighted Top {constituents.length} Basket
                    </span>
                  </div>

                  {/* Volatility Comparison Bars */}
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded bg-amber-400" />
                          Basket Weighted Implied Volatility
                        </span>
                        <strong className="text-amber-400">{dispersionRadar.basketWeightedIV.toFixed(2)}%</strong>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, dispersionRadar.basketWeightedIV * 3.5)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded bg-cyan-400" />
                          Index ATM Implied Volatility ({dispersionRadar.indexSymbol})
                        </span>
                        <strong className="text-cyan-400">{dispersionRadar.indexIV.toFixed(2)}%</strong>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div
                          className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, dispersionRadar.indexIV * 3.5)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded bg-emerald-400" />
                          Net Volatility Dispersion Spread (Edge)
                        </span>
                        <strong className="text-emerald-400">+{dispersionRadar.dispersionSpread.toFixed(2)}%</strong>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, dispersionRadar.dispersionSpread * 7.0)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Interactive Volatility Shock Tester Slider */}
                  <div className="mt-4 pt-3 border-t border-slate-800 bg-slate-900/50 p-3 rounded-xl">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400 font-mono">Index IV Stress Shock:</span>
                      <strong className="text-white font-mono">
                        {customIndexIVShock > 0 ? '+' : ''}
                        {customIndexIVShock.toFixed(1)}% (Effective IV: {(dispersionRadar.indexIV).toFixed(1)}%)
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="-4.0"
                      max="6.0"
                      step="0.2"
                      value={customIndexIVShock}
                      onChange={(e) => setCustomIndexIVShock(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                      <span>-4.0% IV Crush</span>
                      <span>Baseline</span>
                      <span>+6.0% Spike</span>
                    </div>
                  </div>

                  {/* Trade Setup Action & Execution Card */}
                  <div className="mt-3 bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-slate-900 border border-cyan-800/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase">Institutional Trade Recommendation:</div>
                      <div className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                        <span>{dispersionRadar.recommendedTrade === 'LONG_DISPERSION' ? 'LONG DISPERSION' : 'SHORT DISPERSION'}</span>
                        <span className="text-xs px-2 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-normal">
                          Sharpe: {dispersionRadar.estimatedSharpeRatio}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Sell Index Straddles • Buy Basket Straddles • Delta-Neutral Vega Hedged
                      </span>
                    </div>

                    <button
                      onClick={handleDeployDispersion}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition hover:scale-105"
                    >
                      <Zap className="h-4 w-4" />
                      Deploy Dispersion Structure
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Constituents Basket Weighting Breakdown */}
          {activeTab === 'basket_constituents' && (
            <div className="space-y-3">
              {/* Presets and Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#080C16] border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Basket Presets:</span>
                  {(
                    [
                      { key: 'NIFTY_TOP5', label: 'Top 5 Mega-Caps' },
                      { key: 'NIFTY_TOP10', label: 'Top 10 Heavyweights' },
                      { key: 'BANK_HEAVY', label: 'Banking Basket' },
                      { key: 'EQUAL_WEIGHT', label: 'Equal Weight' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => handleSelectPreset(preset.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        basketPreset === preset.key
                          ? 'bg-blue-600 text-white font-bold shadow'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNormalizeWeights}
                    className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500 text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition"
                    title="Scale all constituent weights to sum to 100%"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Normalize to 100%
                  </button>
                </div>
              </div>

              {/* Constituents Table */}
              <div className="bg-[#080C16] border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono divide-y divide-slate-800">
                    <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5">Symbol</th>
                        <th className="px-3 py-2.5">Sector</th>
                        <th className="px-3 py-2.5">Weight %</th>
                        <th className="px-3 py-2.5">Spot Price</th>
                        <th className="px-3 py-2.5">30D RV</th>
                        <th className="px-3 py-2.5">Implied IV</th>
                        <th className="px-3 py-2.5">Vol Premium (IV-RV)</th>
                        <th className="px-3 py-2.5">Beta</th>
                        <th className="px-3 py-2.5">Delta</th>
                        <th className="px-3 py-2.5">Straddle ₹</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-200">
                      {constituents.map((item) => {
                        const isRich = item.volRiskPremium >= 3.5;
                        return (
                          <tr key={item.symbol} className="hover:bg-slate-900/60 transition">
                            <td className="px-3 py-2.5 font-bold text-white flex items-center gap-1.5">
                              <span>{item.symbol}</span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-400 text-[11px]">{item.sector}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-cyan-400 w-12">
                                  {(item.weight * 100).toFixed(1)}%
                                </span>
                                <input
                                  type="range"
                                  min="0.01"
                                  max="0.35"
                                  step="0.01"
                                  value={item.weight}
                                  onChange={(e) => handleWeightChange(item.symbol, parseFloat(e.target.value))}
                                  className="w-16 h-1 accent-cyan-400 cursor-pointer hidden sm:block"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-semibold">
                              ₹{item.spotPrice.toLocaleString('en-IN')}{' '}
                              <span
                                className={`text-[10px] ${
                                  item.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                ({item.changePct >= 0 ? '+' : ''}
                                {item.changePct}%)
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-400">{item.realizedVol30D}%</td>
                            <td className="px-3 py-2.5 text-amber-300 font-bold">{item.impliedVolATM}%</td>
                            <td className="px-3 py-2.5 font-bold text-emerald-400">+{item.volRiskPremium}%</td>
                            <td className="px-3 py-2.5 text-slate-300">{item.beta}</td>
                            <td className="px-3 py-2.5 text-blue-300">{item.delta}</td>
                            <td className="px-3 py-2.5 text-slate-300">₹{item.straddlePrice}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isRich
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {item.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Active Gamma Scalping Desk & Rebalance Alerts */}
          {activeTab === 'gamma_scalp' && (
            <div className="space-y-4">
              {/* Dynamic Delta Drift Monitor & Scalp Meter */}
              <div className="bg-[#080C16] border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Crosshair className="h-4 w-4 text-rose-400" />
                      Dynamic Gamma Curvature & Delta Rebalancing Ladder
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Automated hedging triggers when portfolio Delta drift exceeds tolerance band (±{driftThreshold}Δ)
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Rebalance Band:</span>
                      <select
                        value={driftThreshold}
                        onChange={(e) => setDriftThreshold(parseFloat(e.target.value))}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
                      >
                        <option value={15}>±15 Delta (Tight)</option>
                        <option value={20}>±20 Delta (Standard)</option>
                        <option value={30}>±30 Delta (Relaxed)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Auto Scalp:</span>
                      <button
                        onClick={() => setIsAutoScalpActive(!isAutoScalpActive)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                          isAutoScalpActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {isAutoScalpActive ? 'ENABLED' : 'PAUSED'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delta Drift Horizontal Progress Meter */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 font-mono">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">-50Δ Short</span>
                    <span className="text-slate-200 font-bold">
                      Current Net Delta:{' '}
                      <strong
                        className={
                          Math.abs(activeDeltaDrift) >= driftThreshold ? 'text-rose-400' : 'text-emerald-400'
                        }
                      >
                        {activeDeltaDrift > 0 ? '+' : ''}
                        {activeDeltaDrift.toFixed(1)}Δ
                      </strong>{' '}
                      (Target: 0.00 Neutral)
                    </span>
                    <span className="text-slate-400">+50Δ Long</span>
                  </div>

                  <div className="relative w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    {/* Neutral center marker */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-700 z-10" />

                    {/* Left tolerance band */}
                    <div
                      className="absolute top-0 bottom-0 bg-blue-900/30 border-l border-blue-500/50"
                      style={{
                        left: `${50 - (driftThreshold / 50) * 50}%`,
                        width: `${(driftThreshold / 50) * 50}%`,
                      }}
                    />

                    {/* Right tolerance band */}
                    <div
                      className="absolute top-0 bottom-0 bg-blue-900/30 border-r border-blue-500/50"
                      style={{
                        left: '50%',
                        width: `${(driftThreshold / 50) * 50}%`,
                      }}
                    />

                    {/* Pointer / Bar for current delta */}
                    <div
                      className={`absolute top-0 bottom-0 transition-all duration-300 rounded-full ${
                        Math.abs(activeDeltaDrift) >= driftThreshold
                          ? 'bg-rose-500 shadow-lg shadow-rose-500/50'
                          : 'bg-cyan-400 shadow-md shadow-cyan-400/30'
                      }`}
                      style={{
                        left: activeDeltaDrift >= 0 ? '50%' : `${50 + (activeDeltaDrift / 50) * 50}%`,
                        width: `${(Math.abs(activeDeltaDrift) / 50) * 50}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Active Rebalance Alerts Feed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Active Rebalance Hedge Alerts ({scalpAlerts.length})
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Real-time socket stream</span>
                </div>

                <div className="space-y-2">
                  {scalpAlerts.map((alert) => {
                    const isCritical = alert.urgency === 'CRITICAL';
                    return (
                      <div
                        key={alert.id}
                        className={`rounded-xl p-3 border transition flex flex-wrap items-center justify-between gap-3 ${
                          isCritical
                            ? 'bg-rose-950/30 border-rose-600/60 shadow-lg shadow-rose-950/20'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl mt-0.5 ${
                              isCritical ? 'bg-rose-500/20 text-rose-400 animate-bounce' : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                  isCritical
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {alert.urgency}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">{alert.timestamp}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-200 mt-1 max-w-xl">{alert.triggerReason}</p>
                            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1.5">
                              <span>Action: <strong className="text-white">{alert.hedgeAction}</strong></span>
                              <span>•</span>
                              <span>Target Qty: <strong className="text-cyan-400">{alert.recommendedQty} units</strong></span>
                              <span>•</span>
                              <span>
                                Projected Scalp Gain:{' '}
                                <strong className="text-emerald-400">+₹{alert.projectedScalpPnl.toLocaleString('en-IN')}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExecuteRebalance(alert)}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition hover:scale-105"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            Execute Rebalance Hedge
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Executed Scalp Rebalances Ledger */}
              <div className="bg-[#080C16] border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Executed Rebalances Ledger (Locked Curvature Profit)
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    Cumulative Scalped P&L: +₹{cumulativeScalpPnl.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="divide-y divide-slate-800 text-xs font-mono">
                  {executedLedger.map((log) => (
                    <div key={log.id} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-[11px]">{log.timestamp}</span>
                        <span className="font-bold text-white">{log.instrument}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            log.action === 'SELL_FUTURES'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {log.action}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400">
                          {log.quantity} units @ ₹{log.executionPrice}
                        </span>
                        <span className="font-bold text-emerald-400">+₹{log.lockedScalpPnl.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-[#070A11] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              SABR/SVI Skew Calibrated
            </span>
            <span>•</span>
            <span>Implied Correlation Engine Active</span>
            <span>•</span>
            <span>Zero Hydration Risk</span>
          </div>

          <div className="flex items-center gap-3">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
              ESC to exit
            </kbd>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs font-medium"
            >
              Close Studio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
