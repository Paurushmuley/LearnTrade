'use client';

import React, { useState, useCallback } from 'react';
import { X, TrendingDown, TrendingUp, Clock, BarChart3, Zap, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import {
  ExecutionAlgoType,
  OrderSide,
  ExecutionSummary,
  ChildOrderSlice,
} from '../types/execution';
import {
  generateSyntheticExecution,
  compareExecutionAlgos,
} from '../lib/executionEngine';

interface ExecutionAlgoModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTicker?: string;
  defaultPrice?: number;
}

const ALGO_LABELS: Record<ExecutionAlgoType, string> = {
  VWAP: 'VWAP',
  TWAP: 'TWAP',
  ALMGREN_CHRISS: 'Almgren-Chriss',
  ICEBERG_PEGGED: 'Iceberg Pegged',
};

const ALGO_DESCRIPTIONS: Record<ExecutionAlgoType, string> = {
  VWAP: 'Volume-weighted schedule matching NSE intraday volume profile',
  TWAP: 'Uniform time-weighted slices across the execution window',
  ALMGREN_CHRISS: 'Optimal trajectory minimizing market impact × price risk (Almgren & Chriss 2000)',
  ICEBERG_PEGGED: 'Hidden large-order pegged to best bid/ask with iceberg replenishment',
};

const IS_COLOR = (bps: number) =>
  bps <= 5 ? 'text-emerald-400' : bps <= 20 ? 'text-yellow-400' : 'text-red-400';

export function ExecutionAlgoModal({
  isOpen,
  onClose,
  defaultTicker = 'RELIANCE',
  defaultPrice = 2850,
}: ExecutionAlgoModalProps) {
  const [ticker, setTicker] = useState(defaultTicker);
  const [side, setSide] = useState<OrderSide>('BUY');
  const [algo, setAlgo] = useState<ExecutionAlgoType>('ALMGREN_CHRISS');
  const [totalQty, setTotalQty] = useState(10000);
  const [horizonMinutes, setHorizonMinutes] = useState(120);
  const [arrivalPrice, setArrivalPrice] = useState(defaultPrice);
  const [riskAversion, setRiskAversion] = useState(-6); // log10 slider
  const [sigma, setSigma] = useState(0.25);
  const [result, setResult] = useState<ExecutionSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'slices' | 'is' | 'compare'>('slices');

  const runExecution = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => {
      const summary = generateSyntheticExecution(
        ticker,
        side,
        algo,
        totalQty,
        horizonMinutes,
        arrivalPrice,
        Math.pow(10, riskAversion),
        sigma,
        0.1,
        0.05
      );
      setResult(summary);
      setIsRunning(false);
      setActiveTab('slices');
    }, 400);
  }, [ticker, side, algo, totalQty, horizonMinutes, arrivalPrice, riskAversion, sigma]);

  if (!isOpen) return null;

  const maxSliceQty = result ? Math.max(...result.slices.map((s) => s.targetQty)) : 1;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-blue-500/30 rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-blue-900/40 to-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">VWAP / TWAP Execution Studio</h2>
              <p className="text-xs text-gray-400">Almgren-Chriss Optimal Liquidation · Perold IS Attribution · NSE Volume Profile</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            {/* Config Panel */}
            <div className="border-r border-gray-800 p-5 space-y-5">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Parent Order Config</h3>

              {/* Ticker & Side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">Ticker</label>
                  <input
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">Side</label>
                  <div className="flex gap-1">
                    {(['BUY', 'SELL'] as OrderSide[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSide(s)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          side === s
                            ? s === 'BUY'
                              ? 'bg-emerald-500/30 border border-emerald-500 text-emerald-400'
                              : 'bg-red-500/30 border border-red-500 text-red-400'
                            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Algorithm */}
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Algorithm</label>
                <div className="space-y-2">
                  {(['ALMGREN_CHRISS', 'VWAP', 'TWAP'] as ExecutionAlgoType[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAlgo(a)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        algo === a
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-sm font-medium">{ALGO_LABELS[a]}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-tight">{ALGO_DESCRIPTIONS[a]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity & Horizon */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">Total Qty</label>
                  <input
                    type="number"
                    value={totalQty}
                    onChange={(e) => setTotalQty(parseInt(e.target.value) || 1000)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">Horizon (min)</label>
                  <input
                    type="number"
                    value={horizonMinutes}
                    onChange={(e) => setHorizonMinutes(parseInt(e.target.value) || 60)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Arrival Price */}
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Arrival Price (₹)</label>
                <input
                  type="number"
                  value={arrivalPrice}
                  onChange={(e) => setArrivalPrice(parseFloat(e.target.value) || 100)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Almgren-Chriss: Risk Aversion Slider */}
              {algo === 'ALMGREN_CHRISS' && (
                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">
                    Risk Aversion λ = 10<sup>{riskAversion}</sup>
                  </label>
                  <input
                    type="range"
                    min={-9}
                    max={-3}
                    step={1}
                    value={riskAversion}
                    onChange={(e) => setRiskAversion(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Passive (10⁻⁹)</span>
                    <span>Aggressive (10⁻³)</span>
                  </div>
                </div>
              )}

              {/* Volatility */}
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">
                  Annual Volatility σ = {(sigma * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={0.6}
                  step={0.05}
                  value={sigma}
                  onChange={(e) => setSigma(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Low (10%)</span>
                  <span>High (60%)</span>
                </div>
              </div>

              {/* Run Button */}
              <button
                onClick={runExecution}
                disabled={isRunning}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isRunning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Run Execution Simulation
                  </>
                )}
              </button>

              {/* Notional Info */}
              {result && (
                <div className="p-3 bg-gray-800/60 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Executed Notional</span>
                    <span className="text-white font-mono">₹{(result.executedNotional / 100000).toFixed(2)}L</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Statutory Charges</span>
                    <span className="text-yellow-400 font-mono">₹{result.totalStatutoryCharges.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Fill Price</span>
                    <span className="text-blue-300 font-mono">₹{result.avgExecutedPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Results Panel */}
            <div className="col-span-2 p-5">
              {!result ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                  <BarChart3 className="w-16 h-16 opacity-20" />
                  <p className="text-center max-w-xs">
                    Configure your order parameters and click <strong className="text-gray-400">Run Execution Simulation</strong> to see the optimal execution schedule.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* IS HUD */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-800/60 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500 uppercase mb-1">Impl. Shortfall vs Arrival</div>
                      <div className={`text-2xl font-bold font-mono ${IS_COLOR(Math.abs(result.implementationShortfallBps))}`}>
                        {result.implementationShortfallBps > 0 ? '+' : ''}{result.implementationShortfallBps.toFixed(1)} bps
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {Math.abs(result.implementationShortfallBps) <= 5 ? '✅ Excellent' : Math.abs(result.implementationShortfallBps) <= 20 ? '⚠️ Acceptable' : '❌ High Impact'}
                      </div>
                    </div>
                    <div className="bg-gray-800/60 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500 uppercase mb-1">vs Market VWAP</div>
                      <div className={`text-2xl font-bold font-mono ${IS_COLOR(Math.abs(result.vsMarketVwapBps))}`}>
                        {result.vsMarketVwapBps > 0 ? '+' : ''}{result.vsMarketVwapBps.toFixed(1)} bps
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Market VWAP: ₹{result.marketVwap.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-800/60 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500 uppercase mb-1">Algorithm</div>
                      <div className="text-xl font-bold text-blue-400">{ALGO_LABELS[result.algo]}</div>
                      <div className="text-xs text-gray-600 mt-1">{result.slices.length} child slices</div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-gray-800">
                    {(['slices', 'is', 'compare'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {tab === 'slices' ? '📊 Slice Timeline' : tab === 'is' ? '📉 IS Breakdown' : '⚖️ Algo Comparison'}
                      </button>
                    ))}
                  </div>

                  {/* Slice Timeline */}
                  {activeTab === 'slices' && (
                    <div className="space-y-3">
                      {/* Bar chart */}
                      <div className="bg-gray-800/40 rounded-xl p-4">
                        <div className="text-xs text-gray-500 uppercase mb-3">Execution Schedule — Qty per Slice</div>
                        <div className="flex items-end gap-1 h-32">
                          {result.slices.map((slice, i) => {
                            const barH = (slice.targetQty / maxSliceQty) * 100;
                            const slipColor =
                              Math.abs(slice.slippageBps) <= 5
                                ? 'bg-emerald-500'
                                : Math.abs(slice.slippageBps) <= 15
                                ? 'bg-yellow-500'
                                : 'bg-red-500';
                            return (
                              <div
                                key={i}
                                className="flex-1 flex flex-col items-center gap-1"
                                title={`Slice ${i + 1}: ${slice.targetQty} shares @ ₹${slice.fillPrice} (${slice.slippageBps.toFixed(1)} bps)`}
                              >
                                <div
                                  className={`w-full rounded-t ${slipColor} opacity-80 transition-all`}
                                  style={{ height: `${barH}%`, minHeight: '2px' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>T+0</span>
                          <span>T+{horizonMinutes}min</span>
                        </div>
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 inline-block" /> &lt;5 bps slip</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-500 inline-block" /> 5-15 bps</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500 inline-block" /> &gt;15 bps</span>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-800">
                              <th className="py-2 px-2 text-left">#</th>
                              <th className="py-2 px-2 text-right">Time</th>
                              <th className="py-2 px-2 text-right">Target Qty</th>
                              <th className="py-2 px-2 text-right">Fill Price</th>
                              <th className="py-2 px-2 text-right">Slippage</th>
                              <th className="py-2 px-2 text-right">Cumul Qty</th>
                              <th className="py-2 px-2 text-right">Running VWAP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.slices.map((slice) => (
                              <tr key={slice.sliceIndex} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                <td className="py-1.5 px-2 text-gray-500">{slice.sliceIndex + 1}</td>
                                <td className="py-1.5 px-2 text-right text-gray-400">T+{slice.scheduledTime.toFixed(0)}m</td>
                                <td className="py-1.5 px-2 text-right font-mono text-white">{slice.targetQty.toLocaleString()}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-blue-300">₹{slice.fillPrice.toFixed(2)}</td>
                                <td className={`py-1.5 px-2 text-right font-mono ${IS_COLOR(Math.abs(slice.slippageBps))}`}>
                                  {slice.slippageBps > 0 ? '+' : ''}{slice.slippageBps.toFixed(1)} bps
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-gray-300">{slice.cumulativeQty.toLocaleString()}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-indigo-300">₹{slice.runningVwap.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* IS Breakdown */}
                  {activeTab === 'is' && (
                    <div className="space-y-4">
                      <div className="bg-gray-800/40 rounded-xl p-5">
                        <div className="text-sm font-semibold text-gray-300 mb-4">Perold Implementation Shortfall Attribution</div>
                        {[
                          { label: 'Delay Cost', value: result.isBreakdown.delayBps, desc: 'Opportunity cost between decision and first execution' },
                          { label: 'Temporary Impact', value: result.isBreakdown.temporaryImpactBps, desc: 'Adverse price move from your own order flow' },
                          { label: 'Permanent Drift', value: result.isBreakdown.permanentImpactBps, desc: 'Lasting price impact from information leakage' },
                          { label: 'Statutory Fee Drag', value: result.isBreakdown.statutoryFeeDragBps, desc: 'STT + stamp duty + SEBI charges + brokerage' },
                          { label: 'Opportunity Cost', value: result.isBreakdown.opportunityCostBps, desc: 'Cost of unfilled/partial executions' },
                        ].map(({ label, value, desc }) => {
                          const pct = result.isBreakdown.totalBps !== 0 ? Math.abs(value / result.isBreakdown.totalBps) * 100 : 0;
                          return (
                            <div key={label} className="mb-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">{label}</span>
                                <span className={`font-mono font-semibold ${IS_COLOR(Math.abs(value))}`}>
                                  {value.toFixed(2)} bps
                                </span>
                              </div>
                              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5">{desc}</div>
                            </div>
                          );
                        })}
                        <div className="pt-3 border-t border-gray-700 flex justify-between">
                          <span className="text-sm font-semibold text-gray-300">Total IS</span>
                          <span className={`text-sm font-bold font-mono ${IS_COLOR(Math.abs(result.isBreakdown.totalBps))}`}>
                            {result.isBreakdown.totalBps.toFixed(2)} bps
                          </span>
                        </div>
                      </div>

                      {/* Almgren-Chriss params display */}
                      {result.almgrenChrissParams && (
                        <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-semibold text-indigo-300">Almgren-Chriss Parameters</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                              ['Risk Aversion λ', result.almgrenChrissParams.riskAversion.toExponential(2)],
                              ['Annual Volatility σ', `${(result.almgrenChrissParams.sigma * 100).toFixed(0)}%`],
                              ['Permanent Impact η', result.almgrenChrissParams.permanentImpact.toFixed(3)],
                              ['Temporary Impact γ', result.almgrenChrissParams.temporaryImpact.toFixed(3)],
                              ['Horizon T', `${result.almgrenChrissParams.horizonMinutes} min`],
                              ['Arrival Price', `₹${result.almgrenChrissParams.arrivalPrice.toFixed(2)}`],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between bg-gray-800/40 rounded px-2 py-1">
                                <span className="text-gray-500">{k}</span>
                                <span className="text-indigo-300 font-mono">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Algorithm Comparison */}
                  {activeTab === 'compare' && (
                    <AlgoComparisonTab
                      ticker={ticker}
                      side={side}
                      totalQty={totalQty}
                      horizonMinutes={horizonMinutes}
                      arrivalPrice={arrivalPrice}
                      riskAversion={Math.pow(10, riskAversion)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlgoComparisonTab({
  ticker,
  side,
  totalQty,
  horizonMinutes,
  arrivalPrice,
  riskAversion,
}: {
  ticker: string;
  side: OrderSide;
  totalQty: number;
  horizonMinutes: number;
  arrivalPrice: number;
  riskAversion: number;
}) {
  const [comparison, setComparison] = useState<null | ReturnType<typeof compareExecutionAlgos>>(null);
  const [loading, setLoading] = useState(false);

  const runComparison = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const result = compareExecutionAlgos(ticker, side, totalQty, horizonMinutes, arrivalPrice, riskAversion);
      setComparison(result);
      setLoading(false);
    }, 600);
  }, [ticker, side, totalQty, horizonMinutes, arrivalPrice, riskAversion]);

  if (!comparison) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-gray-500 text-sm">Run all three algorithms on the same order to compare IS attribution side-by-side.</p>
        <button
          onClick={runComparison}
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Compare VWAP vs TWAP vs Almgren-Chriss
        </button>
      </div>
    );
  }

  const algos = [
    { key: 'vwap', label: 'VWAP', borderClass: 'border-blue-500/20', textClass: 'text-blue-400', summary: comparison.vwap! },
    { key: 'twap', label: 'TWAP', borderClass: 'border-purple-500/20', textClass: 'text-purple-400', summary: comparison.twap! },
    { key: 'almgrenChriss', label: 'Almgren-Chriss', borderClass: 'border-emerald-500/20', textClass: 'text-emerald-400', summary: comparison.almgrenChriss! },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {algos.map(({ label, borderClass, textClass, summary }) => (
          <div key={label} className={`bg-gray-800/60 rounded-xl p-4 border ${borderClass}`}>
            <div className={`text-sm font-bold ${textClass} mb-3`}>{label}</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">IS vs Arrival</span>
                <span className={`font-mono font-semibold ${IS_COLOR(Math.abs(summary.implementationShortfallBps))}`}>
                  {summary.implementationShortfallBps.toFixed(1)} bps
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avg Fill</span>
                <span className="font-mono text-white">₹{summary.avgExecutedPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Statutory</span>
                <span className="font-mono text-yellow-400">₹{summary.totalStatutoryCharges.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Slices</span>
                <span className="font-mono text-gray-300">{summary.slices.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Temp Impact</span>
                <span className="font-mono text-orange-400">{summary.isBreakdown.temporaryImpactBps.toFixed(2)} bps</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-gray-800/40 rounded-xl p-4">
        <div className="text-xs text-gray-500 uppercase mb-2">Winner by Lowest Implementation Shortfall</div>
        {(() => {
          const best = algos.reduce((a, b) =>
            Math.abs(a.summary.implementationShortfallBps) < Math.abs(b.summary.implementationShortfallBps) ? a : b
          );
          return (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">{best.label}</span>
              <span className="text-gray-500">— lowest IS at {Math.abs(best.summary.implementationShortfallBps).toFixed(1)} bps</span>
            </div>
          );
        })()}
      </div>
      <button onClick={runComparison} className="text-xs text-gray-500 hover:text-gray-300 underline">Re-run simulation</button>
    </div>
  );
}

export default ExecutionAlgoModal;
