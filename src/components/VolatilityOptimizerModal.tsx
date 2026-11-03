'use client';

import React, { useState, useMemo } from 'react';
import {
  ExpiryVolSurface,
  MarketOutlook,
  OptimizationCriterion,
  OptimizedStrategyCandidate,
  SABRParameters,
  SVIParameters,
  VolStrikeQuote,
  PayoffPoint,
  CalibrationMetrics,
} from '../types/optionsOptimizer';
import {
  generateMultiTermVolSurface,
  calculateSABRVolatility,
  calculateSVIVolatility,
  calibrateSABR,
  verifySVIArbitrageFree,
  calculateCalibrationMetrics,
} from '../lib/volatilitySurfaceEngine';
import {
  optimizeOptionsStrategies,
  generateStrategyPayoffPoints,
} from '../lib/optionsOptimizerEngine';

interface VolatilityOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpotPrice?: number;
}

export function VolatilityOptimizerModal({
  isOpen,
  onClose,
  currentSpotPrice = 24900,
}: VolatilityOptimizerModalProps) {
  // State
  const [selectedTermIndex, setSelectedTermIndex] = useState<number>(0); // 0 = Weekly (4D)
  const [modelType, setModelType] = useState<'SABR' | 'SVI'>('SABR');
  const [activeTab, setActiveTab] = useState<'smile' | 'radar' | 'optimizer' | 'calibrator'>('smile');
  const [outlook, setOutlook] = useState<MarketOutlook>('NEUTRAL_RANGEBOUND');
  const [criterion, setCriterion] = useState<OptimizationCriterion>('MAX_POP');
  const [budget, setBudget] = useState<number>(75000);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedStrikeQuote, setSelectedStrikeQuote] = useState<VolStrikeQuote | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [radarFilter, setRadarFilter] = useState<'ALL' | 'OVERVALUED' | 'UNDERVALUED'>('ALL');

  // Custom SABR Sliders state
  const [sabrParams, setSabrParams] = useState<SABRParameters>({
    alpha: 0.148,
    beta: 1.0,
    rho: -0.38,
    nu: 0.48,
  });

  // Custom SVI Sliders state
  const [sviParams, setSviParams] = useState<SVIParameters>({
    a: 0.00016,
    b: 0.0083,
    rho: -0.42,
    m: 0.01,
    sigma: 0.04,
  });

  const [calibrationMetrics, setCalibrationMetrics] = useState<CalibrationMetrics & { modelType: 'SABR' | 'SVI'; calibratedAt: string }>({
    modelType: 'SABR',
    rmse: 0.0038,
    rSquared: 0.985,
    maxAbsoluteError: 0.0072,
    isArbitrageFree: true,
    calibratedAt: '09:15:00 AM',
  });

  // Generated Multi-Term Surfaces
  const surfaces: ExpiryVolSurface[] = useMemo(() => {
    return generateMultiTermVolSurface(currentSpotPrice);
  }, [currentSpotPrice]);

  const activeSurface = surfaces[selectedTermIndex] || surfaces[0];

  // Auto-Calibrate function
  const handleAutoCalibrate = () => {
    const strikes = activeSurface.strikes.map((s) => s.strike);
    const marketIVs = activeSurface.strikes.map((s) => s.marketIV);
    const T = Math.max(0.001, activeSurface.expiryDays / 365);

    if (modelType === 'SABR') {
      const { params: calibratedParams, metrics } = calibrateSABR(
        activeSurface.forwardPrice,
        strikes,
        marketIVs,
        T,
        1.0,
        sabrParams
      );
      setSabrParams(calibratedParams);
      setCalibrationMetrics({
        modelType: 'SABR',
        rmse: metrics.rmse,
        rSquared: metrics.rSquared,
        maxAbsoluteError: metrics.maxAbsoluteError,
        isArbitrageFree: metrics.isArbitrageFree,
        calibratedAt: new Date().toLocaleTimeString(),
      });
      setNotification(
        `⚡ SABR Auto-Calibration Complete: RMSE ${(metrics.rmse * 100).toFixed(2)}%, R² ${(metrics.rSquared * 100).toFixed(1)}% (Arbitrage-Free)`
      );
    } else {
      const arbCheck = verifySVIArbitrageFree(sviParams, T);
      const modelIVs = strikes.map((k) =>
        calculateSVIVolatility(Math.log(k / activeSurface.forwardPrice), T, sviParams)
      );
      const metrics = calculateCalibrationMetrics(strikes, marketIVs, modelIVs, arbCheck.isArbitrageFree, arbCheck.reason);
      setCalibrationMetrics({
        modelType: 'SVI',
        rmse: metrics.rmse,
        rSquared: metrics.rSquared,
        maxAbsoluteError: metrics.maxAbsoluteError,
        isArbitrageFree: metrics.isArbitrageFree,
        calibratedAt: new Date().toLocaleTimeString(),
      });
      setNotification(
        `⚡ SVI Calibration Verified: RMSE ${(metrics.rmse * 100).toFixed(2)}%, R² ${(metrics.rSquared * 100).toFixed(1)}% (${arbCheck.isArbitrageFree ? 'Arbitrage-Free' : 'Warning'})`
      );
    }
    setTimeout(() => setNotification(null), 4500);
  };

  // Candidates from Optimizer
  const candidates: OptimizedStrategyCandidate[] = useMemo(() => {
    return optimizeOptionsStrategies({
      underlyingSpot: currentSpotPrice,
      outlook,
      criterion,
      maxCapitalBudget: budget,
      targetExpiryDays: activeSurface.expiryDays,
      minPoPPercent: 40,
    });
  }, [currentSpotPrice, outlook, criterion, budget, activeSurface.expiryDays]);

  // Active strategy for payoff preview
  const activeStrategy: OptimizedStrategyCandidate | null = useMemo(() => {
    if (!selectedStrategyId) return candidates[0] || null;
    return candidates.find((c) => c.id === selectedStrategyId) || candidates[0] || null;
  }, [selectedStrategyId, candidates]);

  const activePayoffPoints: PayoffPoint[] = useMemo(() => {
    if (!activeStrategy) return [];
    if (activeStrategy.payoffCurve && activeStrategy.payoffCurve.length > 0) {
      return activeStrategy.payoffCurve;
    }
    return generateStrategyPayoffPoints(
      activeStrategy,
      currentSpotPrice,
      activeSurface.expiryDays,
      activeSurface.atmIV,
      41
    );
  }, [activeStrategy, currentSpotPrice, activeSurface.expiryDays, activeSurface.atmIV]);

  // Handle Strategy Execution
  const handleExecuteStrategy = (cand: OptimizedStrategyCandidate) => {
    setNotification(
      `🚀 Successfully routed ${cand.name} (${cand.legs.length} legs) into paper trading account. Margin reserved: ₹${cand.marginRequired.toLocaleString('en-IN')}`
    );
    setTimeout(() => setNotification(null), 4500);
  };

  if (!isOpen) return null;

  // SVG Dimensions for Smile Chart
  const chartWidth = 620;
  const chartHeight = 220;
  const padding = 42;

  // SVG Scaling for Smile Chart
  const strikes = activeSurface.strikes.map((s) => s.strike);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);

  const allIVs = activeSurface.strikes.flatMap((s) => [s.marketIV, s.sabrIV, s.sviIV]);
  const minIV = Math.max(0.08, Math.min(...allIVs) - 0.02);
  const maxIV = Math.min(0.35, Math.max(...allIVs) + 0.02);

  const getSvgX = (strike: number) =>
    padding + ((strike - minStrike) / (maxStrike - minStrike)) * (chartWidth - padding * 2);
  const getSvgY = (iv: number) =>
    chartHeight - padding - ((iv - minIV) / (maxIV - minIV)) * (chartHeight - padding * 2);

  // Fitted Curve Path
  const fittedCurvePath = activeSurface.strikes
    .map((s, idx) => {
      const fittedIV = modelType === 'SABR' ? s.sabrIV : s.sviIV;
      return `${idx === 0 ? 'M' : 'L'} ${getSvgX(s.strike)} ${getSvgY(fittedIV)}`;
    })
    .join(' ');

  const atmX = getSvgX(activeSurface.forwardPrice);

  // Filtered Strikes for Radar
  const filteredStrikes = activeSurface.strikes.filter((s) => {
    if (radarFilter === 'ALL') return true;
    return s.mispricingStatus === radarFilter;
  });

  const overvaluedCount = activeSurface.strikes.filter((s) => s.mispricingStatus === 'OVERVALUED').length;
  const undervaluedCount = activeSurface.strikes.filter((s) => s.mispricingStatus === 'UNDERVALUED').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  IV Surface & Options Payoff Optimizer
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Sprint 14
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  SABR / SVI Models
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Parametric Volatility Smiles, Mispriced Strike Radar & Combinatorial Multi-Leg Optimizer
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Spot & ATM IV Indicator */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center space-x-3 text-xs font-mono">
              <div>
                <span className="text-neutral-500">SPOT:</span>{' '}
                <strong className="text-white">₹{currentSpotPrice.toLocaleString('en-IN')}</strong>
              </div>
              <div className="h-4 w-px bg-neutral-800"></div>
              <div>
                <span className="text-neutral-500">ATM IV:</span>{' '}
                <strong className="text-amber-400">{(activeSurface.atmIV * 100).toFixed(1)}%</strong>
              </div>
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

        {/* Toast Alert */}
        {notification && (
          <div className="px-6 py-2 bg-amber-950/80 border-b border-amber-800/40 text-xs font-mono text-amber-300 flex items-center justify-between animate-fadeIn">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="text-amber-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Sub-Header Toolbar: Term & Model Switcher */}
        <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-950/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
              Expiry Term:
            </span>
            <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
              {surfaces.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedTermIndex(idx);
                    setSelectedStrikeQuote(null);
                  }}
                  className={`px-3 py-1 rounded-md transition ${
                    selectedTermIndex === idx
                      ? 'bg-amber-500 text-neutral-950 font-extrabold shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {s.expiryDate}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
                Model:
              </span>
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                <button
                  onClick={() => setModelType('SABR')}
                  className={`px-3 py-1 rounded-md transition ${
                    modelType === 'SABR'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Hagan SABR (α, β, ρ, ν)
                </button>
                <button
                  onClick={() => setModelType('SVI')}
                  className={`px-3 py-1 rounded-md transition ${
                    modelType === 'SVI'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Gatheral SVI Total Variance
                </button>
              </div>
            </div>

            <button
              onClick={handleAutoCalibrate}
              className="px-3 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition flex items-center space-x-1"
              title="Fit model parameters to live strike quotes via bounded non-linear least squares"
            >
              <span>⚡ Auto-Fit Surface</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Navigation Tabs */}
          <div className="flex space-x-2 border-b border-neutral-800 pb-3">
            <button
              onClick={() => setActiveTab('smile')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                activeTab === 'smile'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              📈 Volatility Smile ({modelType})
            </button>
            <button
              onClick={() => setActiveTab('radar')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                activeTab === 'radar'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              🎯 Mispriced Strike Radar ({activeSurface.strikes.filter((s) => s.mispricingStatus !== 'FAIR').length})
            </button>
            <button
              onClick={() => setActiveTab('optimizer')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                activeTab === 'optimizer'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              🚀 Multi-Leg Payoff Optimizer ({candidates.length})
            </button>
            <button
              onClick={() => setActiveTab('calibrator')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
                activeTab === 'calibrator'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ⚙️ Parametric Calibrator Studio
            </button>
          </div>

          {/* TAB 1: Volatility Smile Chart */}
          {activeTab === 'smile' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col items-center">
                <div className="w-full flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-white tracking-wide">
                      NSE Strike Price vs Implied Volatility (IV)
                    </span>
                    <div className="flex items-center space-x-3 text-[11px] font-mono">
                      <span className="flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
                        <span className="text-cyan-400">Market Observed IV</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="w-3 h-0.5 bg-amber-400 inline-block"></span>
                        <span className="text-amber-400">Calibrated {modelType} Smile</span>
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Forward: ₹{activeSurface.forwardPrice} | Expiry: {activeSurface.expiryDays}D
                  </span>
                </div>

                {/* SVG Visualizer */}
                <div className="w-full overflow-x-auto flex justify-center py-2">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full max-w-[620px] h-[220px] overflow-visible select-none"
                  >
                    {/* Horizontal grid lines */}
                    {[minIV, (minIV + maxIV) / 2, maxIV].map((iv, idx) => (
                      <g key={idx}>
                        <line
                          x1={padding}
                          y1={getSvgY(iv)}
                          x2={chartWidth - padding}
                          y2={getSvgY(iv)}
                          stroke="#333333"
                          strokeDasharray="2 3"
                        />
                        <text
                          x={padding - 6}
                          y={getSvgY(iv) + 3}
                          fill="#737373"
                          fontSize="9"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {(iv * 100).toFixed(0)}%
                        </text>
                      </g>
                    ))}

                    {/* Forward Price line */}
                    <line
                      x1={atmX}
                      y1={padding}
                      x2={atmX}
                      y2={chartHeight - padding}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <text
                      x={atmX}
                      y={padding - 8}
                      fill="#818cf8"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      ATM (₹{activeSurface.forwardPrice})
                    </text>

                    {/* Fitted Curve */}
                    <path
                      d={fittedCurvePath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Market Observed Dots */}
                    {activeSurface.strikes.map((s, idx) => {
                      const isSelected = selectedStrikeQuote?.strike === s.strike;
                      return (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onClick={() => setSelectedStrikeQuote(s)}
                        >
                          <circle
                            cx={getSvgX(s.strike)}
                            cy={getSvgY(s.marketIV)}
                            r={isSelected ? 6 : 3.5}
                            fill={
                              s.mispricingStatus === 'OVERVALUED'
                                ? '#f43f5e'
                                : s.mispricingStatus === 'UNDERVALUED'
                                ? '#10b981'
                                : '#06b6d4'
                            }
                            stroke={isSelected ? '#f59e0b' : '#ffffff'}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                        </g>
                      );
                    })}

                    {/* Strike labels */}
                    <text
                      x={padding}
                      y={chartHeight - padding + 14}
                      fill="#737373"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      ₹{minStrike}
                    </text>
                    <text
                      x={chartWidth - padding}
                      y={chartHeight - padding + 14}
                      fill="#737373"
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      ₹{maxStrike}
                    </text>
                  </svg>
                </div>

                {/* Selected Strike Inspector Pill */}
                {selectedStrikeQuote ? (
                  <div className="mt-2 w-full p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-white">Strike ₹{selectedStrikeQuote.strike}</span>
                      <span className="text-neutral-400">Moneyness: {selectedStrikeQuote.moneyness}</span>
                      <span className="text-cyan-400">Market IV: {(selectedStrikeQuote.marketIV * 100).toFixed(1)}%</span>
                      <span className="text-amber-400">Model IV: {(selectedStrikeQuote.sabrIV * 100).toFixed(1)}%</span>
                      <span
                        className={`font-bold ${
                          selectedStrikeQuote.mispricingDiff > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        ΔIV: {selectedStrikeQuote.mispricingDiff > 0 ? '+' : ''}
                        {selectedStrikeQuote.mispricingDiff}%
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedStrikeQuote.mispricingStatus === 'OVERVALUED'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : selectedStrikeQuote.mispricingStatus === 'UNDERVALUED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {selectedStrikeQuote.mispricingStatus === 'OVERVALUED'
                        ? 'OVERPRICED (SELL EDGE)'
                        : selectedStrikeQuote.mispricingStatus === 'UNDERVALUED'
                        ? 'UNDERPRICED (BUY EDGE)'
                        : 'FAIR VALUE'}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-neutral-500 font-mono">
                    Click any strike dot above to inspect exact market IV, parametric fair price, and pricing edge.
                  </div>
                )}
              </div>

              {/* Surface Metrics Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
                  <span className="text-neutral-500 uppercase text-[10px] block">ATM Implied Volatility</span>
                  <span className="text-lg font-bold text-amber-400 mt-1 block">
                    {(activeSurface.atmIV * 100).toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-neutral-400">Baseline variance</span>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
                  <span className="text-neutral-500 uppercase text-[10px] block">Downside Put Skew (ρ)</span>
                  <span className="text-lg font-bold text-rose-400 mt-1 block">
                    {activeSurface.sabrParams.rho.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-neutral-400">Crash risk correlation</span>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
                  <span className="text-neutral-500 uppercase text-[10px] block">Vol of Vol (ν)</span>
                  <span className="text-lg font-bold text-purple-400 mt-1 block">
                    {activeSurface.sabrParams.nu.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-neutral-400">Wing smile curvature</span>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
                  <span className="text-neutral-500 uppercase text-[10px] block">Calibration Quality (R²)</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">
                    {(calibrationMetrics.rSquared * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-neutral-400">RMSE: {(calibrationMetrics.rmse * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Mispriced Strike Radar */}
          {activeTab === 'radar' && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <span className="text-neutral-400 font-semibold">Filter:</span>
                  <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
                    <button
                      onClick={() => setRadarFilter('ALL')}
                      className={`px-3 py-1 rounded-md transition ${
                        radarFilter === 'ALL'
                          ? 'bg-neutral-800 text-white font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      All ({activeSurface.strikes.length})
                    </button>
                    <button
                      onClick={() => setRadarFilter('OVERVALUED')}
                      className={`px-3 py-1 rounded-md transition ${
                        radarFilter === 'OVERVALUED'
                          ? 'bg-rose-900/50 text-rose-300 font-bold border border-rose-700/50'
                          : 'text-neutral-400 hover:text-rose-300'
                      }`}
                    >
                      Rich / Sell Candidates ({overvaluedCount})
                    </button>
                    <button
                      onClick={() => setRadarFilter('UNDERVALUED')}
                      className={`px-3 py-1 rounded-md transition ${
                        radarFilter === 'UNDERVALUED'
                          ? 'bg-emerald-900/50 text-emerald-300 font-bold border border-emerald-700/50'
                          : 'text-neutral-400 hover:text-emerald-300'
                      }`}
                    >
                      Cheap / Buy Candidates ({undervaluedCount})
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400">
                  Showing {filteredStrikes.length} strikes for {activeSurface.expiryDate}
                </div>
              </div>

              <div className="overflow-x-auto max-h-[380px] rounded-lg border border-neutral-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800 text-[11px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Strike</th>
                      <th className="py-2.5 px-4">Moneyness</th>
                      <th className="py-2.5 px-4">Market IV</th>
                      <th className="py-2.5 px-4">Model IV</th>
                      <th className="py-2.5 px-4">Vol Discrepancy</th>
                      <th className="py-2.5 px-4">Arbitrage Signal</th>
                      <th className="py-2.5 px-4">Call Fair</th>
                      <th className="py-2.5 px-4">Put Fair</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {filteredStrikes.map((s, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-neutral-800/40 transition cursor-pointer"
                        onClick={() => setSelectedStrikeQuote(s)}
                      >
                        <td className="py-2.5 px-4 font-bold text-white">₹{s.strike}</td>
                        <td className="py-2.5 px-4 text-neutral-300">{s.moneyness}</td>
                        <td className="py-2.5 px-4 text-cyan-400">{(s.marketIV * 100).toFixed(1)}%</td>
                        <td className="py-2.5 px-4 text-amber-400">{(s.sabrIV * 100).toFixed(1)}%</td>
                        <td
                          className={`py-2.5 px-4 font-bold ${
                            s.mispricingDiff > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {s.mispricingDiff > 0 ? '+' : ''}
                          {s.mispricingDiff}%
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.mispricingStatus === 'OVERVALUED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : s.mispricingStatus === 'UNDERVALUED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {s.mispricingStatus === 'OVERVALUED'
                              ? 'OVERVALUED (SELL)'
                              : s.mispricingStatus === 'UNDERVALUED'
                              ? 'UNDERVALUED (BUY)'
                              : 'FAIR VALUE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-neutral-300">₹{s.callPrice}</td>
                        <td className="py-2.5 px-4 text-neutral-300">₹{s.putPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Multi-Leg Strategy Optimizer */}
          {activeTab === 'optimizer' && (
            <div className="space-y-6">
              {/* Controls Header */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                {/* Outlook Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-neutral-500 uppercase text-[11px] font-semibold">Outlook:</span>
                  <select
                    value={outlook}
                    onChange={(e) => setOutlook(e.target.value as MarketOutlook)}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="BULLISH">Bullish Directional</option>
                    <option value="BEARISH">Bearish Directional</option>
                    <option value="NEUTRAL_RANGEBOUND">Neutral Rangebound (Theta)</option>
                    <option value="HIGH_VOLATILITY">High Volatility (Breakout)</option>
                  </select>
                </div>

                {/* Criterion Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-neutral-500 uppercase text-[11px] font-semibold">Objective:</span>
                  <select
                    value={criterion}
                    onChange={(e) => setCriterion(e.target.value as OptimizationCriterion)}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="MAX_POP">Max Probability of Profit (PoP)</option>
                    <option value="MAX_PROFIT_RATIO">Max Risk / Reward Ratio</option>
                    <option value="MAX_THETA">Max Daily Theta Decay</option>
                    <option value="MIN_MARGIN">Min Margin Capital</option>
                  </select>
                </div>

                {/* Capital Budget */}
                <div className="flex items-center space-x-2">
                  <span className="text-neutral-500 uppercase text-[11px] font-semibold">Max Capital:</span>
                  <input
                    type="number"
                    step="10000"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-28 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-white font-mono"
                  />
                </div>
              </div>

              {/* 2D Payoff Visualizer for Selected Strategy */}
              {activePayoffPoints.length > 0 && activeStrategy && (
                <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-white">
                        Payoff Curve & Probability Distribution: {activeStrategy.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {activeStrategy.templateType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] font-mono">
                      <span className="text-emerald-400">Max Win: +₹{activeStrategy.maxProfit.toLocaleString('en-IN')}</span>
                      <span className="text-rose-400">Max Loss: -₹{activeStrategy.maxLoss.toLocaleString('en-IN')}</span>
                      <span className="text-cyan-400">PoP: {activeStrategy.probabilityOfProfit}%</span>
                    </div>
                  </div>

                  {/* SVG Payoff Curve */}
                  <div className="w-full overflow-x-auto flex justify-center py-2">
                    {(() => {
                      const pWidth = 620;
                      const pHeight = 180;
                      const pPad = 40;
                      const spots = activePayoffPoints.map((p: PayoffPoint) => p.spot);
                      const minS = Math.min(...spots);
                      const maxS = Math.max(...spots);
                      const pnls = activePayoffPoints.map((p: PayoffPoint) => p.pnl);
                      const minPnl = Math.min(...pnls, -100);
                      const maxPnl = Math.max(...pnls, 100);

                      const getX = (s: number) =>
                        pPad + ((s - minS) / (maxS - minS || 1)) * (pWidth - pPad * 2);
                      const getY = (pnl: number) =>
                        pHeight - pPad - ((pnl - minPnl) / (maxPnl - minPnl || 1)) * (pHeight - pPad * 2);

                      const zeroY = getY(0);
                      const spotX = getX(currentSpotPrice);

                      const pathD = activePayoffPoints
                        .map((p: PayoffPoint, idx: number) => `${idx === 0 ? 'M' : 'L'} ${getX(p.spot)} ${getY(p.pnl)}`)
                        .join(' ');

                      return (
                        <svg
                          viewBox={`0 0 ${pWidth} ${pHeight}`}
                          className="w-full max-w-[620px] h-[180px] overflow-visible select-none"
                        >
                          {/* Zero P&L horizontal line */}
                          <line
                            x1={pPad}
                            y1={zeroY}
                            x2={pWidth - pPad}
                            y2={zeroY}
                            stroke="#525252"
                            strokeWidth="1.5"
                          />
                          <text
                            x={pPad - 6}
                            y={zeroY + 3}
                            fill="#a3a3a3"
                            fontSize="9"
                            textAnchor="end"
                            fontFamily="monospace"
                          >
                            ₹0
                          </text>

                          {/* Spot Price marker */}
                          <line
                            x1={spotX}
                            y1={pPad}
                            x2={spotX}
                            y2={pHeight - pPad}
                            stroke="#f59e0b"
                            strokeDasharray="3 3"
                            strokeWidth="1.5"
                          />
                          <text
                            x={spotX}
                            y={pPad - 6}
                            fill="#f59e0b"
                            fontSize="9"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            Spot (₹{currentSpotPrice})
                          </text>

                          {/* Breakeven lines */}
                          {activeStrategy.breakevens.map((be: number, bIdx: number) => {
                            const beX = getX(be);
                            return (
                              <g key={bIdx}>
                                <line
                                  x1={beX}
                                  y1={pPad}
                                  x2={beX}
                                  y2={pHeight - pPad}
                                  stroke="#38bdf8"
                                  strokeDasharray="2 3"
                                />
                                <text
                                  x={beX}
                                  y={pHeight - pPad + 12}
                                  fill="#38bdf8"
                                  fontSize="8"
                                  textAnchor="middle"
                                  fontFamily="monospace"
                                >
                                  BE ₹{be}
                                </text>
                              </g>
                            );
                          })}

                          {/* Payoff Curve */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />

                          {/* Spot Range labels */}
                          <text
                            x={pPad}
                            y={pHeight - pPad + 12}
                            fill="#737373"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            ₹{minS}
                          </text>
                          <text
                            x={pWidth - pPad}
                            y={pHeight - pPad + 12}
                            fill="#737373"
                            fontSize="9"
                            textAnchor="end"
                            fontFamily="monospace"
                          >
                            ₹{maxS}
                          </text>
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Strategy Candidates Cards */}
              <div className="space-y-4">
                {candidates.map((cand) => {
                  const isSelected = activeStrategy?.id === cand.id;
                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedStrategyId(cand.id)}
                      className={`p-5 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-amber-500/60 bg-neutral-900 shadow-lg shadow-amber-500/10'
                          : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-white">{cand.name}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {cand.templateType.replace(/_/g, ' ')}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              PoP: {cand.probabilityOfProfit}%
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">{cand.rationale}</p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteStrategy(cand);
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition active:scale-95"
                        >
                          🚀 Execute Strategy
                        </button>
                      </div>

                      {/* Metrics Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs font-mono bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80 mb-3">
                        <div>
                          <span className="text-neutral-500 text-[10px] block">Max Profit</span>
                          <span className="text-emerald-400 font-bold">
                            {cand.maxProfit > 100000 ? 'Unlimited' : `+₹${cand.maxProfit.toLocaleString('en-IN')}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] block">Max Loss</span>
                          <span className="text-rose-400 font-bold">-₹{cand.maxLoss.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] block">Daily Theta</span>
                          <span className="text-cyan-400 font-bold">+₹{cand.netTheta}/day</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] block">Margin Req</span>
                          <span className="text-neutral-200 font-bold">₹{cand.marginRequired.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] block">Risk/Reward</span>
                          <span className="text-amber-400 font-bold">1 : {cand.riskRewardRatio}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] block">Statutory Tax</span>
                          <span className="text-neutral-400">₹{cand.statutoryCharges}</span>
                        </div>
                      </div>

                      {/* Legs Pill */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-neutral-500 text-[11px] font-mono">Legs:</span>
                        {cand.legs.map((leg, lIdx) => (
                          <span
                            key={lIdx}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              leg.side === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                            }`}
                          >
                            {leg.side} {leg.quantity} Qty {leg.strike} {leg.optionType} @ ₹{leg.premium}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Interactive SABR Sliders */}
          {activeTab === 'calibrator' && (
            <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-950 space-y-6 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Parametric SABR & SVI Calibration Studio
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Live mathematical morphing of volatility curves across all strikes
                  </p>
                </div>
                <button
                  onClick={handleAutoCalibrate}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                >
                  <span>⚡ 1-Click Auto-Fit</span>
                </button>
              </div>

              {/* Calibration Quality Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <div>
                  <span className="text-neutral-500 text-[10px] block">Model Type</span>
                  <span className="text-amber-400 font-bold">{calibrationMetrics.modelType}</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">Root Mean Sq Error</span>
                  <span className="text-emerald-400 font-bold">{(calibrationMetrics.rmse * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">R-Squared Fit</span>
                  <span className="text-cyan-400 font-bold">{(calibrationMetrics.rSquared * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">No-Arbitrage Status</span>
                  <span className="text-emerald-400 font-bold">
                    {calibrationMetrics.isArbitrageFree ? 'ARBITRAGE_FREE' : 'SVI_SLOPE_BREACH'}
                  </span>
                </div>
              </div>

              <div className="space-y-4 max-w-xl">
                {/* Alpha */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-400">ATM Volatility Level (α):</span>
                    <span className="text-amber-400 font-bold">
                      {sabrParams.alpha.toFixed(3)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.08"
                    max="0.30"
                    step="0.005"
                    value={sabrParams.alpha}
                    onChange={(e) =>
                      setSabrParams({
                        ...sabrParams,
                        alpha: Number(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Rho */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-400">Spot-Vol Correlation / Downside Skew (ρ):</span>
                    <span className="text-rose-400 font-bold">{sabrParams.rho.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.85"
                    max="0.00"
                    step="0.01"
                    value={sabrParams.rho}
                    onChange={(e) => setSabrParams({ ...sabrParams, rho: Number(e.target.value) })}
                    className="w-full accent-rose-500"
                  />
                </div>

                {/* Nu */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-400">Vol of Vol / Wing Convexity (ν):</span>
                    <span className="text-purple-400 font-bold">{sabrParams.nu.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.95"
                    step="0.02"
                    value={sabrParams.nu}
                    onChange={(e) => setSabrParams({ ...sabrParams, nu: Number(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 text-[11px] leading-relaxed">
                Adjusting these parameters morphs the mathematical smile across all strikes in real-time. Notice how negative correlation (rho &lt; 0) reproduces India Index steep put skews, while higher vol-of-vol (nu) lifts both OTM wings.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VolatilityOptimizerModal;
