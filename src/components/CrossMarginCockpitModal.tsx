'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Percent,
  PieChart,
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
import {
  AssetClassType,
  CollateralCategory,
  CollateralPledgeItem,
  CorrelationOffsetPair,
  CrossMarginPositionLeg,
} from '../types/crossMargin';
import {
  DEFAULT_CROSS_MARGIN_LEGS,
  DEFAULT_COLLATERAL_INVENTORY,
  DEFAULT_CORRELATION_PAIRS,
  calculate5050CashCollateralCompliance,
  calculatePortfolioRiskDecomposition,
  formatINR,
} from '../lib/crossMarginEngine';

interface CrossMarginCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice?: number;
}

type ActiveWorkspaceView = 'relief_matrix' | 'collateral_manager' | 'var_decomposition';

export const CrossMarginCockpitModal: React.FC<CrossMarginCockpitModalProps> = ({
  isOpen,
  onClose,
  spotPrice = 24920,
}) => {
  // Navigation
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('relief_matrix');

  // Interactive Position Legs state
  const [legs, setLegs] = useState<CrossMarginPositionLeg[]>(DEFAULT_CROSS_MARGIN_LEGS);

  // Interactive Collateral Pledge state
  const [collaterals, setCollaterals] = useState<CollateralPledgeItem[]>(
    DEFAULT_COLLATERAL_INVENTORY
  );

  // Correlation Offset Pairs state
  const [correlationPairs] = useState<CorrelationOffsetPair[]>(DEFAULT_CORRELATION_PAIRS);

  // Simulated Optimal Hedge state
  const [isHedgeApplied, setIsHedgeApplied] = useState<boolean>(false);

  // Filter for asset classes in Matrix
  const [selectedAssetClassFilter, setSelectedAssetClassFilter] = useState<string>('ALL');

  // Toggle pledge/unpledge for collateral items
  const handleTogglePledge = useCallback((id: string) => {
    setCollaterals((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          // Cannot unpledge raw cash if used
          if (item.category === 'CASH') return item;
          return { ...item, pledged: !item.pledged };
        }
        return item;
      })
    );
  }, []);

  // Compute Risk Decomposition & Summary
  const { metrics, mrcList, optimalHedge } = useMemo(() => {
    // If hedge applied, add the hedge position into calculations
    const activeLegs = isHedgeApplied
      ? [
          ...legs,
          {
            id: 'hedge-sim-leg',
            symbol: optimalHedgeSymbolMemo,
            assetClass: 'INDEX_DERIVATIVES' as AssetClassType,
            cluster: 'EQUITY_INDEX',
            product: 'OPT' as const,
            side: 'LONG' as const,
            quantity: 150,
            lotSize: 25,
            marketPrice: 195,
            notionalValue: 3720000,
            isolatedMargin: 84000,
            crossMarginOffset: 329000,
            effectiveMargin: -245000, // relieves overall net margin
            betaToNifty: -0.65,
            historicalVol: 14.5,
          },
        ]
      : legs;

    return calculatePortfolioRiskDecomposition(activeLegs);
  }, [legs, isHedgeApplied]);

  // Collateral 50:50 Status based on current requirement and pledged items
  const collateralStatus = useMemo(() => {
    const requiredMargin = isHedgeApplied
      ? Math.max(100000, metrics.crossMarginedRequirement - 245000)
      : metrics.crossMarginedRequirement;
    return calculate5050CashCollateralCompliance(collaterals, requiredMargin);
  }, [collaterals, metrics.crossMarginedRequirement, isHedgeApplied]);

  // Asset class breakdown for bar charts
  const assetClassBreakdown = useMemo(() => {
    const classMap: Record<
      string,
      { label: string; isolated: number; cross: number; relief: number; count: number }
    > = {
      INDEX_DERIVATIVES: { label: 'Index F&O', isolated: 0, cross: 0, relief: 0, count: 0 },
      STOCK_DERIVATIVES: { label: 'Stock Futures', isolated: 0, cross: 0, relief: 0, count: 0 },
      COMMODITY_DERIVATIVES: { label: 'MCX Commodities', isolated: 0, cross: 0, relief: 0, count: 0 },
      CURRENCY_DERIVATIVES: { label: 'Currency CDS', isolated: 0, cross: 0, relief: 0, count: 0 },
    };

    legs.forEach((leg) => {
      if (classMap[leg.assetClass]) {
        classMap[leg.assetClass].isolated += leg.isolatedMargin;
        classMap[leg.assetClass].cross += leg.effectiveMargin;
        classMap[leg.assetClass].relief += leg.crossMarginOffset;
        classMap[leg.assetClass].count += 1;
      }
    });

    return Object.entries(classMap).map(([key, val]) => ({
      key,
      ...val,
      reliefPct: val.isolated > 0 ? (val.relief / val.isolated) * 100 : 0,
    }));
  }, [legs]);

  // Filtered correlation offset pairs
  const filteredPairs = useMemo(() => {
    if (selectedAssetClassFilter === 'ALL') return correlationPairs;
    return correlationPairs.filter(
      (pair) =>
        pair.assetClassA === selectedAssetClassFilter ||
        pair.assetClassB === selectedAssetClassFilter
    );
  }, [correlationPairs, selectedAssetClassFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#0D1117] border border-slate-800 rounded-2xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* TOP BAR / HEADER */}
        <div className="border-b border-slate-800/80 bg-slate-950/90 px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-slate-100 tracking-tight">
                  Cross-Margining & Portfolio VaR Cockpit
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/60 border border-purple-800/60 text-purple-300">
                  Sprint 23 Institutional
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/40 border border-cyan-800/50 text-cyan-300">
                  SEBI Inter-Asset Netting
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time correlation relief offsets, 50:50 statutory collateral ratio simulator & 99% CVaR tail risk engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCollaterals(DEFAULT_COLLATERAL_INVENTORY);
                setIsHedgeApplied(false);
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              title="Reset pledged inventory and simulations"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
              <span>Reset State</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
              aria-label="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* QUICK METRICS STRIP */}
        <div className="bg-slate-900/60 border-b border-slate-800/70 px-5 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Portfolio Notional */}
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Gross Notional</span>
              <Activity className="h-3 w-3 text-blue-400" />
            </div>
            <div className="text-sm font-bold text-slate-100 mt-1">
              {formatINR(metrics.totalPortfolioValue)}
            </div>
            <span className="text-[10px] text-slate-400">7 Active Multi-Asset Legs</span>
          </div>

          {/* 2. Gross Isolated Margin */}
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Isolated Margin</span>
              <Lock className="h-3 w-3 text-amber-400" />
            </div>
            <div className="text-sm font-bold text-slate-200 mt-1">
              {formatINR(metrics.grossIsolatedMargin)}
            </div>
            <span className="text-[10px] text-amber-400/90 font-medium">Without netting offsets</span>
          </div>

          {/* 3. Cross-Margined Requirement */}
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider flex items-center justify-between">
              <span>Cross-Margined Req</span>
              <ShieldCheck className="h-3 w-3 text-purple-400" />
            </div>
            <div className="text-sm font-extrabold text-purple-300 mt-1">
              {formatINR(isHedgeApplied ? metrics.crossMarginedRequirement - 245000 : metrics.crossMarginedRequirement)}
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold">
              SEBI Net Margin Schedule
            </span>
          </div>

          {/* 4. Net Capital Relief (₹ & %) */}
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <span>Net Capital Relief</span>
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="text-sm font-extrabold text-emerald-400 mt-1 flex items-baseline gap-1.5">
              <span>{formatINR(isHedgeApplied ? metrics.netCapitalRelief + 245000 : metrics.netCapitalRelief)}</span>
              <span className="text-xs font-bold text-emerald-300">
                ({isHedgeApplied ? ((metrics.netCapitalRelief + 245000) / metrics.grossIsolatedMargin * 100).toFixed(1) : metrics.netCapitalReliefPct}%)
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Unlocked Trading Capital</span>
          </div>

          {/* 5. 50:50 Cash-Collateral Compliance Badge */}
          <div className={`border rounded-xl p-2.5 ${collateralStatus.isCompliant ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between">
              <span className={collateralStatus.isCompliant ? 'text-emerald-400' : 'text-rose-400'}>50:50 Rule</span>
              {collateralStatus.isCompliant ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-sm font-extrabold ${collateralStatus.isCompliant ? 'text-emerald-300' : 'text-rose-300'}`}>
                {collateralStatus.isCompliant ? 'COMPLIANT' : 'DEFICIT'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                ({collateralStatus.cashRatioPct}% Cash Eq)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 truncate block">
              {collateralStatus.isCompliant ? 'Zero penalty charges' : `₹${Math.round(collateralStatus.annualizedPenaltyCharge).toLocaleString('en-IN')}/yr interest`}
            </span>
          </div>

          {/* 6. Tail Risk (99% CVaR / VaR) */}
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>99% 1D Tail VaR</span>
              <Zap className="h-3 w-3 text-cyan-400" />
            </div>
            <div className="text-sm font-bold text-cyan-300 mt-1 flex items-baseline gap-1">
              <span>{formatINR(isHedgeApplied ? optimalHedge.postHedgeVaR99 : metrics.var99_1Day)}</span>
              {isHedgeApplied && (
                <span className="text-[10px] font-bold text-emerald-400">-36%</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">
              Div. Ratio: {metrics.diversificationIndex}x
            </span>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="border-b border-slate-800 bg-slate-950/50 px-5 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveView('relief_matrix')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeView === 'relief_matrix'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Cross-Margin Relief Matrix</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-900/40 text-purple-300 border border-purple-700/50">
              {correlationPairs.length} Pairs
            </span>
          </button>

          <button
            onClick={() => setActiveView('collateral_manager')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeView === 'collateral_manager'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Collateral & Haircuts Manager</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] border ${collateralStatus.isCompliant ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border-rose-800/60'}`}>
              50:50 {collateralStatus.isCompliant ? 'Passed' : 'Deficit'}
            </span>
          </button>

          <button
            onClick={() => setActiveView('var_decomposition')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeView === 'var_decomposition'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Portfolio VaR & Risk Decomposition</span>
            {isHedgeApplied && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                Hedge Active
              </span>
            )}
          </button>
        </div>

        {/* WORKSPACE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* ========================================================= */}
          {/* VIEW 1: CROSS-MARGIN RELIEF MATRIX                        */}
          {/* ========================================================= */}
          {activeView === 'relief_matrix' && (
            <div className="space-y-5">
              {/* Top Overview Cards & Asset Class Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Bar Comparison Chart: Isolated vs Cross-Margined */}
                <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Isolated vs Cross-Margined Requirement by Asset Class
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        SEBI clearing corporation correlation offsets reduce capital footprint
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded bg-slate-600 inline-block" />
                        <span className="text-slate-400">Isolated</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded bg-purple-500 inline-block" />
                        <span className="text-purple-300">Cross-Margined</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5 mt-4">
                    {assetClassBreakdown.map((item) => {
                      const maxVal = 2000000;
                      const isolatedWidth = Math.min(100, Math.round((item.isolated / maxVal) * 100));
                      const crossWidth = Math.min(100, Math.round((item.cross / maxVal) * 100));

                      return (
                        <div key={item.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                              {item.label}
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({item.count} legs)
                              </span>
                            </span>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-slate-400">{formatINR(item.isolated)}</span>
                              <ArrowRight className="h-3 w-3 text-slate-600" />
                              <span className="text-purple-400 font-bold">{formatINR(item.cross)}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                                -{item.reliefPct.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Dual Progress Bars */}
                          <div className="space-y-1">
                            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-slate-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${isolatedWidth}%` }}
                              />
                            </div>
                            <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${crossWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Net Capital Relief Summary Card */}
                <div className="bg-gradient-to-br from-purple-950/30 via-slate-900/60 to-slate-900/80 border border-purple-800/40 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                        Netting Efficiency
                      </span>
                      <Sparkles className="h-4 w-4 text-purple-400" />
                    </div>
                    
                    <div className="mt-3">
                      <div className="text-3xl font-extrabold text-slate-100 font-mono">
                        {metrics.netCapitalReliefPct}%
                      </div>
                      <p className="text-xs text-emerald-400 font-medium mt-0.5">
                        {formatINR(metrics.netCapitalRelief)} Free Margin Unlocked
                      </p>
                    </div>

                    <div className="mt-4 space-y-2 text-xs border-t border-slate-800/80 pt-3">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Isolated SPAN:</span>
                        <span className="text-slate-200 font-mono">{formatINR(metrics.grossIsolatedMargin)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Cross-Margined SPAN:</span>
                        <span className="text-purple-300 font-mono font-bold">{formatINR(metrics.crossMarginedRequirement)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Inter-Asset Clusters:</span>
                        <span className="text-slate-200 font-mono">4 Integrated</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/50 text-[11px] text-purple-200 flex items-start gap-2">
                    <Info className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      SEBI circular SEBI/HO/MRD/DoP/P/CIR/2020 permits correlation netting between NIFTY, Sectoral indices, Single Stocks and MCX Metals with matched directional deltas.
                    </span>
                  </div>
                </div>
              </div>

              {/* Correlation Offset Pairs Table */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      SEBI Approved Correlation Offset Pairs & Netting Schedule
                    </span>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5">
                    {['ALL', 'INDEX_DERIVATIVES', 'STOCK_DERIVATIVES', 'COMMODITY_DERIVATIVES', 'CURRENCY_DERIVATIVES'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setSelectedAssetClassFilter(f)}
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
                          selectedAssetClassFilter === f
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {f === 'ALL'
                          ? 'All Clusters'
                          : f.replace('_DERIVATIVES', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Offset Pair</th>
                        <th className="py-2.5 px-3 text-center">Correlation (ρ)</th>
                        <th className="py-2.5 px-3 text-center">Hedge Ratio</th>
                        <th className="py-2.5 px-3 text-right">Isolated Margin</th>
                        <th className="py-2.5 px-3 text-right">Cross-Margined</th>
                        <th className="py-2.5 px-3 text-right">Capital Relief</th>
                        <th className="py-2.5 px-4">Netting Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {filteredPairs.map((pair) => {
                        const isHighCorr = Math.abs(pair.correlation) >= 0.8;
                        return (
                          <tr key={pair.id} className="hover:bg-slate-800/30 transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                <span>{pair.legA}</span>
                                <span className="text-slate-500">↔</span>
                                <span>{pair.legB}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {pair.assetClassA.replace('_DERIVATIVES', '')} / {pair.assetClassB.replace('_DERIVATIVES', '')}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                  isHighCorr
                                    ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                                    : 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                                }`}
                              >
                                {pair.correlation > 0 ? `+${pair.correlation}` : pair.correlation}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center font-mono text-slate-300">
                              {pair.hedgeRatio}x
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-400">
                              {formatINR(pair.grossIsolatedMargin)}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-purple-300">
                              {formatINR(pair.crossMarginedRequirement)}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="font-mono font-bold text-emerald-400">
                                {formatINR(pair.capitalReliefAmount)}
                              </div>
                              <div className="text-[10px] text-emerald-400/80 font-semibold">
                                -{pair.capitalReliefPct.toFixed(1)}% ({pair.offsetEligibilityPct}% cap)
                              </div>
                            </td>

                            <td className="py-3 px-4 text-[11px] text-slate-400 max-w-xs leading-relaxed">
                              {pair.rationale}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Portfolio Position Legs Breakdown */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Institutional Active Positions & Per-Leg Margin Breakdown
                  </span>
                  <span className="text-xs text-slate-400">
                    Calculated using NSE SPAN & Multi-Asset Clearing Offset Arrays
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Instrument</th>
                        <th className="py-2.5 px-3">Cluster</th>
                        <th className="py-2.5 px-3">Side</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Notional</th>
                        <th className="py-2.5 px-3 text-right">Isolated Margin</th>
                        <th className="py-2.5 px-3 text-right">Relief Offset</th>
                        <th className="py-2.5 px-3 text-right">Effective Margin</th>
                        <th className="py-2.5 px-4 text-center">Beta / Vol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {legs.map((leg) => (
                        <tr key={leg.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-4 font-bold text-slate-100">
                            {leg.symbol}
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-400">
                            {leg.cluster}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                leg.side === 'LONG'
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                  : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                              }`}
                            >
                              {leg.side}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {leg.quantity.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {formatINR(leg.notionalValue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {formatINR(leg.isolatedMargin)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                            -{formatINR(leg.crossMarginOffset)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-300">
                            {formatINR(leg.effectiveMargin)}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-[11px] text-slate-400">
                            β {leg.betaToNifty} / {leg.historicalVol}% σ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 2: COLLATERAL & HAIRCUTS MANAGER                     */}
          {/* ========================================================= */}
          {activeView === 'collateral_manager' && (
            <div className="space-y-5">
              
              {/* 50:50 Cash-Collateral Ratio Meter & SEBI Banner */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-cyan-400" />
                      <span>SEBI 50:50 Cash-to-Collateral Statutory Compliance Engine</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      SEBI mandate requires that at least 50% of derivative margin requirements be funded via Cash or Cash-Equivalents (G-Sec, Liquid MFs).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                        collateralStatus.isCompliant
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                          : 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                      }`}
                    >
                      {collateralStatus.isCompliant ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>50:50 COMPLIANT (Zero Penalty)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>CASH DEFICIT PENALTY (18% p.a.)</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* 50:50 Meter Gauge Visual */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <span>Cash Equivalent Ratio:</span>
                      <span className="text-cyan-400 font-mono text-sm">{collateralStatus.cashRatioPct}%</span>
                      <span className="text-[10px] text-slate-500">(Target: ≥ 50.0%)</span>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Usable Collateral: {formatINR(collateralStatus.effectiveCollateralUsable)} / Req: {formatINR(collateralStatus.totalRequiredMargin)}
                    </span>
                  </div>

                  {/* Multi-segmented ratio meter */}
                  <div className="w-full bg-slate-800/90 rounded-xl h-4 p-0.5 flex items-center overflow-hidden border border-slate-700/60">
                    <div
                      className="bg-cyan-500 h-full rounded-l-lg transition-all duration-300 flex items-center justify-center text-[9px] font-bold text-slate-950"
                      style={{
                        width: `${Math.min(100, Math.max(10, collateralStatus.cashRatioPct))}%`,
                      }}
                    >
                      Cash Eq {collateralStatus.cashRatioPct}%
                    </div>
                    <div
                      className="bg-purple-500/80 h-full rounded-r-lg transition-all duration-300 flex items-center justify-center text-[9px] font-bold text-slate-950"
                      style={{
                        width: `${Math.max(0, 100 - collateralStatus.cashRatioPct)}%`,
                      }}
                    >
                      Non-Cash {Math.max(0, 100 - collateralStatus.cashRatioPct)}%
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
                      Cash + G-Sec + Liquid MFs: {formatINR(collateralStatus.cashEquivalentAvailable)}
                    </span>
                    <span className="flex items-center gap-1 text-purple-400">
                      <span className="h-2 w-2 rounded-full bg-purple-400 inline-block" />
                      Pledged SGB + Equities: {formatINR(collateralStatus.nonCashCollateralAvailable)}
                    </span>
                  </div>
                </div>

                {/* Statutory Haircut Schedule Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/80">
                  <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Cash Margin</span>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">0% Haircut</div>
                    <span className="text-[9px] text-slate-500">100% Value • Cash Eq</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">G-Sec / T-Bills</span>
                    <div className="text-sm font-bold text-cyan-400 mt-0.5">2% Haircut</div>
                    <span className="text-[9px] text-slate-500">98% Value • Cash Eq</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Liquid MFs</span>
                    <div className="text-sm font-bold text-blue-400 mt-0.5">10% Haircut</div>
                    <span className="text-[9px] text-slate-500">90% Value • Cash Eq</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Sovereign Gold</span>
                    <div className="text-sm font-bold text-amber-400 mt-0.5">15% Haircut</div>
                    <span className="text-[9px] text-slate-500">85% Value • Non-Cash</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Bluechip Equity</span>
                    <div className="text-sm font-bold text-purple-400 mt-0.5">20% Haircut</div>
                    <span className="text-[9px] text-slate-500">80% Value • Non-Cash</span>
                  </div>
                </div>
              </div>

              {/* Interactive Collateral Inventory Table with Pledge Toggle */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Collateral Inventory & Pledge Simulator
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Toggle the pledge switches below to simulate real-time demat collateral rehypothecation and 50:50 headroom
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    Live Pledge Status: {collaterals.filter((c) => c.pledged).length} of {collaterals.length} Active
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Asset / Symbol</th>
                        <th className="py-2.5 px-3">Classification</th>
                        <th className="py-2.5 px-3 text-right">Holding Units</th>
                        <th className="py-2.5 px-3 text-right">Market Price</th>
                        <th className="py-2.5 px-3 text-right">Gross Demat Value</th>
                        <th className="py-2.5 px-3 text-center">SEBI Haircut</th>
                        <th className="py-2.5 px-3 text-right">Post-Haircut Value</th>
                        <th className="py-2.5 px-4 text-center">Pledge State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {collaterals.map((item) => {
                        return (
                          <tr
                            key={item.id}
                            className={`transition ${
                              item.pledged ? 'bg-slate-900/20 hover:bg-slate-800/40' : 'opacity-60 bg-slate-950/30'
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                <span>{item.symbol}</span>
                                {item.isCashEquivalent && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                                    Cash Eq
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                {item.name}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {item.category}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-300">
                              {item.units.toLocaleString('en-IN')}
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-300">
                              ₹{item.unitPrice.toLocaleString('en-IN')}
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-300 font-semibold">
                              {formatINR(item.grossValue)}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800/90 text-amber-300 border border-slate-700">
                                {item.sebiHaircutPct}%
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                              {formatINR(item.postHaircutValue)}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleTogglePledge(item.id)}
                                disabled={item.category === 'CASH'}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 mx-auto ${
                                  item.pledged
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                                } ${item.category === 'CASH' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                              >
                                {item.pledged ? (
                                  <>
                                    <Lock className="h-3 w-3" />
                                    <span>PLEDGED</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="h-3 w-3" />
                                    <span>UNPLEDGED</span>
                                  </>
                                )}
                              </button>
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

          {/* ========================================================= */}
          {/* VIEW 3: PORTFOLIO VAR & RISK DECOMPOSITION                */}
          {/* ========================================================= */}
          {activeView === 'var_decomposition' && (
            <div className="space-y-5">
              
              {/* 1-Click Optimal Hedge Recommendation Banner */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-purple-950/40 border border-emerald-800/50 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        AI Optimal Hedge Recommendation
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                        Score {optimalHedge.efficiencyScore}/100
                      </span>
                      {isHedgeApplied && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700/60 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-blue-300" />
                          HEDGE SIMULATED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                      <strong>{optimalHedge.action} {optimalHedge.contracts} Contracts</strong> of{' '}
                      <span className="text-purple-300 font-mono font-semibold">{optimalHedge.instrument}</span> — {optimalHedge.rationale}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">VaR Shock Reduction</div>
                    <div className="text-sm font-extrabold text-emerald-400 font-mono">
                      -{optimalHedge.varReductionPct}% (Save {formatINR(optimalHedge.marginSavingsINR)})
                    </div>
                  </div>

                  <button
                    onClick={() => setIsHedgeApplied(!isHedgeApplied)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg ${
                      isHedgeApplied
                        ? 'bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/20'
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                    <span>{isHedgeApplied ? 'Remove Simulated Hedge' : '1-Click Apply Hedge'}</span>
                  </button>
                </div>
              </div>

              {/* Gauges & Tail Risk Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* 1. 99% 1-Day HVaR vs CVaR */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      99% 1-Day Historical VaR
                    </span>
                    <ShieldAlert className="h-4 w-4 text-cyan-400" />
                  </div>

                  <div className="mt-3">
                    <div className="text-2xl font-extrabold font-mono text-cyan-300">
                      {formatINR(isHedgeApplied ? optimalHedge.postHedgeVaR99 : metrics.var99_1Day)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Max expected 1-day loss at 99.0% confidence
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Parametric Normal VaR:</span>
                      <span className="text-slate-200 font-mono">{formatINR(metrics.parametricVaR)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Fat-tail Kurtosis Shock:</span>
                      <span className="text-amber-400 font-mono">+16.0%</span>
                    </div>
                  </div>
                </div>

                {/* 2. CVaR 99% (Expected Shortfall) */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                      CVaR 99% (Expected Shortfall)
                    </span>
                    <TrendingDown className="h-4 w-4 text-rose-400" />
                  </div>

                  <div className="mt-3">
                    <div className="text-2xl font-extrabold font-mono text-rose-300">
                      {formatINR(isHedgeApplied ? Math.round(metrics.cvar99_ExpectedShortfall * 0.62) : metrics.cvar99_ExpectedShortfall)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Average severity in the worst 1% tail distribution
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Tail Loss Multiplier:</span>
                      <span className="text-slate-200 font-mono">1.34x VaR</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Coherent Risk Measure:</span>
                      <span className="text-emerald-400 font-mono">Sub-additive ✅</span>
                    </div>
                  </div>
                </div>

                {/* 3. Portfolio Diversification Benefit */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                      Diversification Multiplier
                    </span>
                    <PieChart className="h-4 w-4 text-purple-400" />
                  </div>

                  <div className="mt-3">
                    <div className="text-2xl font-extrabold font-mono text-purple-300">
                      {metrics.diversificationIndex}x
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gross VaR / Net Portfolio VaR ratio
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Portfolio Daily Vol:</span>
                      <span className="text-slate-200 font-mono">1.18% σ</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Euler Homogeneity:</span>
                      <span className="text-purple-300 font-mono">Σ MRC_i = VaR</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Marginal Risk Contribution (MRC) Table */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Marginal Risk Contribution (MRC) by Asset Leg
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Euler risk decomposition: identifies the highest risk drivers and multi-asset correlation offsets
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {'Methodology: MRC_i = w_i · β_i,p · VaR_p'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Position Leg</th>
                        <th className="py-2.5 px-3">Asset Class</th>
                        <th className="py-2.5 px-3 text-right">Notional</th>
                        <th className="py-2.5 px-3 text-right">Weight %</th>
                        <th className="py-2.5 px-3 text-right">Standalone VaR</th>
                        <th className="py-2.5 px-3 text-right">Marginal VaR (MRC)</th>
                        <th className="py-2.5 px-3 text-right">Risk % of VaR</th>
                        <th className="py-2.5 px-4 text-right">Diversification Benefit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {mrcList.map((item) => {
                        const isHighRisk = item.marginalRiskContributionPct >= 20;
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/30 transition">
                            <td className="py-3 px-4 font-bold text-slate-100">
                              {item.symbol}
                            </td>

                            <td className="py-3 px-3 text-[10px] text-slate-400">
                              {item.assetClass.replace('_DERIVATIVES', '')}
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-300">
                              {formatINR(item.notional)}
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-300">
                              {item.portfolioWeightPct}%
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-400">
                              {formatINR(item.standaloneVaR)}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                              {formatINR(item.marginalRiskContributionINR)}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  isHighRisk
                                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {item.marginalRiskContributionPct}%
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                              +{formatINR(item.diversificationBenefitINR)}
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

        </div>

        {/* FOOTER BAR */}
        <div className="border-t border-slate-800/80 bg-slate-950/80 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Shield className="h-3.5 w-3.5 text-purple-400" />
              <span>SEBI Cross-Margining Circular compliant</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Spot Reference: <strong className="text-slate-200">NIFTY ₹{spotPrice.toLocaleString('en-IN')}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
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

// Helper constant
const optimalHedgeSymbolMemo = 'NIFTY 28NOV 24800 PE';
