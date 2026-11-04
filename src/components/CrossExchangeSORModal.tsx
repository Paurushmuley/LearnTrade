'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  ArrowRightLeft,
  Zap,
  TrendingUp,
  Clock,
  Shield,
  Layers,
  CheckCircle,
  AlertTriangle,
  Scale,
  RefreshCw,
} from 'lucide-react';
import {
  ExchangeVenue,
  SORRoutingPolicy,
  DualExchangeDepthSnapshot,
  CrossExchangeArbitrageOpp,
  SORRoutingExecutionResult,
} from '../types/sor';
import {
  generateSyntheticCrossExchangeBooks,
  calculateINBBO,
  detectCrossExchangeArbitrage,
  calculateLatencyParams,
  routeSmartOrder,
  executeAtomicArbitrage,
} from '../lib/sorEngine';

interface CrossExchangeSORModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string;
  defaultPrice?: number;
}

export const CrossExchangeSORModal: React.FC<CrossExchangeSORModalProps> = ({
  isOpen,
  onClose,
  defaultSymbol = 'RELIANCE',
  defaultPrice = 2850,
}) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [basePrice, setBasePrice] = useState(defaultPrice);
  const [orderQty, setOrderQty] = useState(1500);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [policy, setPolicy] = useState<SORRoutingPolicy>('SPLIT_LIQUIDITY_SWEEP');
  const [networkTransitMs, setNetworkTransitMs] = useState(0.8);
  const [executionResult, setExecutionResult] = useState<SORRoutingExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'DOM_LADDER' | 'ARBITRAGE' | 'SOR_SIMULATOR'>('DOM_LADDER');

  // Synthetic live books
  const [books, setBooks] = useState<DualExchangeDepthSnapshot>(() =>
    generateSyntheticCrossExchangeBooks(symbol, basePrice)
  );

  const refreshBooks = useCallback(() => {
    setBooks(generateSyntheticCrossExchangeBooks(symbol, basePrice));
  }, [symbol, basePrice]);

  const inbbo = useMemo(() => calculateINBBO(books.nse, books.bse), [books]);
  const latencyParams = useMemo(
    () => calculateLatencyParams(networkTransitMs, 0.25, 1.2, 0.15),
    [networkTransitMs]
  );
  const arbOpp = useMemo(
    () => detectCrossExchangeArbitrage(books, latencyParams),
    [books, latencyParams]
  );

  const handleRouteOrder = useCallback(() => {
    const res = routeSmartOrder(symbol, side, orderQty, books, policy, latencyParams);
    setExecutionResult(res);
    setActiveTab('SOR_SIMULATOR');
  }, [symbol, side, orderQty, books, policy, latencyParams]);

  const handleExecuteArbitrage = useCallback(() => {
    if (!arbOpp) return;
    const res = executeAtomicArbitrage(arbOpp, latencyParams);
    setExecutionResult(res);
    setActiveTab('SOR_SIMULATOR');
  }, [arbOpp, latencyParams]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Cross-Exchange Arbitrage & Smart Order Router</h2>
                {inbbo.isCrossed ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse">
                    ⚡ CROSSED SPREAD ({inbbo.grossSpreadBps} bps)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    NORMAL INBBO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dual-Exchange NSE vs BSE Level-2 Depth · Sub-Millisecond Jitter Modeling · Atomic Legging Bailout
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshBooks}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Dual-Exchange Depth"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* INBBO Quick Banner */}
        <div className="bg-slate-950/60 border-b border-slate-800/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">INBBO Best Bid:</span>
            <span className="font-bold text-emerald-400">
              ₹{inbbo.bestBidPrice.toFixed(2)} ({inbbo.bestBidVenue} · {inbbo.bestBidQty} Qty)
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">INBBO Best Ask:</span>
            <span className="font-bold text-red-400">
              ₹{inbbo.bestAskPrice.toFixed(2)} ({inbbo.bestAskVenue} · {inbbo.bestAskQty} Qty)
            </span>
          </div>
          <div className="text-slate-400">
            Total Transit: <span className="text-cyan-400 font-bold">{latencyParams.totalLatencyMs} ms</span> · Fill Prob: <span className="text-amber-400 font-bold">{(latencyParams.fillProbability * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('DOM_LADDER')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'DOM_LADDER'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            1. Dual-Exchange Depth Ladders (NSE vs BSE)
          </button>
          <button
            onClick={() => setActiveTab('ARBITRAGE')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'ARBITRAGE'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            2. Inter-Market Arbitrage Radar
          </button>
          <button
            onClick={() => setActiveTab('SOR_SIMULATOR')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'SOR_SIMULATOR'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            3. Smart Order Router Execution Simulator
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: DUAL EXCHANGE DEPTH LADDERS */}
          {activeTab === 'DOM_LADDER' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* NSE Level-2 Depth */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      National Stock Exchange (NSE) Depth
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Tariff: 0.00297%</span>
                  </div>

                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800/80">
                        <th className="text-left pb-1.5">Bid Qty</th>
                        <th className="text-right pb-1.5 text-emerald-400">Bid (₹)</th>
                        <th className="text-left pb-1.5 pl-4 text-red-400">Ask (₹)</th>
                        <th className="text-right pb-1.5">Ask Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <tr key={i} className="hover:bg-slate-900/60">
                          <td className="py-1 text-slate-400">{books.nse.bids[i]?.quantity.toLocaleString()}</td>
                          <td className="py-1 text-right text-emerald-400 font-bold">₹{books.nse.bids[i]?.price.toFixed(2)}</td>
                          <td className="py-1 pl-4 text-red-400 font-bold">₹{books.nse.asks[i]?.price.toFixed(2)}</td>
                          <td className="py-1 text-right text-slate-400">{books.nse.asks[i]?.quantity.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* BSE Level-2 Depth */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      Bombay Stock Exchange (BSE) Depth
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Tariff: 0.00375%</span>
                  </div>

                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800/80">
                        <th className="text-left pb-1.5">Bid Qty</th>
                        <th className="text-right pb-1.5 text-emerald-400">Bid (₹)</th>
                        <th className="text-left pb-1.5 pl-4 text-red-400">Ask (₹)</th>
                        <th className="text-right pb-1.5">Ask Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <tr key={i} className="hover:bg-slate-900/60">
                          <td className="py-1 text-slate-400">{books.bse.bids[i]?.quantity.toLocaleString()}</td>
                          <td className="py-1 text-right text-emerald-400 font-bold">₹{books.bse.bids[i]?.price.toFixed(2)}</td>
                          <td className="py-1 pl-4 text-red-400 font-bold">₹{books.bse.asks[i]?.price.toFixed(2)}</td>
                          <td className="py-1 text-right text-slate-400">{books.bse.asks[i]?.quantity.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Order Sizing & Quick Dispatch */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Side</label>
                    <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                      <button
                        onClick={() => setSide('BUY')}
                        className={`px-3 py-1.5 text-xs font-bold ${side === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                      >
                        BUY
                      </button>
                      <button
                        onClick={() => setSide('SELL')}
                        className={`px-3 py-1.5 text-xs font-bold ${side === 'SELL' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Quantity</label>
                    <input
                      type="number"
                      value={orderQty}
                      onChange={(e) => setOrderQty(parseInt(e.target.value) || 100)}
                      className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Routing Policy</label>
                    <select
                      value={policy}
                      onChange={(e) => setPolicy(e.target.value as SORRoutingPolicy)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    >
                      <option value="SPLIT_LIQUIDITY_SWEEP">Split Liquidity Sweep</option>
                      <option value="BEST_PRICE_NBBO">Best Price NBBO</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleRouteOrder}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <Zap className="h-4 w-4" />
                  Route via Smart Router
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ARBITRAGE RADAR */}
          {activeTab === 'ARBITRAGE' && (
            <div className="space-y-6">
              {arbOpp ? (
                <div className="p-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                      <h3 className="text-base font-bold text-emerald-400">
                        Arbitrage Opportunity Detected!
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-emerald-300">
                      Joint Fill Prob: {(arbOpp.jointFillProbability * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Buy Venue</div>
                      <div className="text-sm font-bold text-white">{arbOpp.buyVenue} @ ₹{arbOpp.buyPrice.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Sell Venue</div>
                      <div className="text-sm font-bold text-white">{arbOpp.sellVenue} @ ₹{arbOpp.sellPrice.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Net Spread</div>
                      <div className="text-sm font-bold text-emerald-400">+{arbOpp.netSpreadBps} bps</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Net Profit (After Tax)</div>
                      <div className="text-sm font-bold text-cyan-400">₹{arbOpp.netProfitInr.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400">
                      Executable Qty: <strong className="text-white">{arbOpp.executableQty} Units</strong> · Total Statutory Friction: <strong className="text-amber-400">₹{arbOpp.totalStatutoryFrictionInr.toFixed(2)}</strong>
                    </span>
                    <button
                      onClick={handleExecuteArbitrage}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Atomic 2-Leg Execute
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-2xl border border-slate-800 bg-slate-950/40 text-center space-y-2">
                  <CheckCircle className="h-8 w-8 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">Markets are Efficient (No Crossed Spread)</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    NSE Best Ask &gt; BSE Best Bid and vice versa. Click &quot;Refresh&quot; above to simulate microsecond synthetic quote fluctuations.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SOR SIMULATOR & EXECUTION TELEMETRY */}
          {activeTab === 'SOR_SIMULATOR' && (
            <div className="space-y-6">
              {executionResult ? (
                <div className="space-y-4">
                  <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Effective Price</div>
                      <div className="text-base font-extrabold text-white">₹{executionResult.effectiveAvgPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">NSE Benchmark</div>
                      <div className="text-base font-extrabold text-slate-400">₹{executionResult.singleVenueBenchmarkPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Price Improvement</div>
                      <div className="text-base font-extrabold text-emerald-400">+{executionResult.priceImprovementBps.toFixed(1)} bps</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Total INR Savings</div>
                      <div className="text-base font-extrabold text-cyan-400">₹{executionResult.totalSavingsInr.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Child Order Legs */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Routed Child Order Telemetry ({executionResult.childOrders.length} Slices)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-800">
                            <th className="text-left pb-1">Child ID</th>
                            <th className="text-left pb-1">Venue</th>
                            <th className="text-left pb-1">Side</th>
                            <th className="text-right pb-1">Qty</th>
                            <th className="text-right pb-1">Fill Price</th>
                            <th className="text-right pb-1">Latency</th>
                            <th className="text-right pb-1">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {executionResult.childOrders.map((child) => (
                            <tr key={child.childId}>
                              <td className="py-1 text-slate-400">{child.childId}</td>
                              <td className="py-1 font-bold text-indigo-400">{child.venue}</td>
                              <td className={`py-1 font-bold ${child.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{child.side}</td>
                              <td className="py-1 text-right text-white">{child.executedQty}</td>
                              <td className="py-1 text-right text-slate-200">₹{child.fillPrice.toFixed(2)}</td>
                              <td className="py-1 text-right text-cyan-400">{child.latencyMs.toFixed(2)} ms</td>
                              <td className="py-1 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  child.status === 'FILLED' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                                }`}>
                                  {child.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-2xl border border-slate-800 bg-slate-950/40 text-center space-y-2">
                  <Zap className="h-8 w-8 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">No Routing Telemetry Yet</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Go to Tab 1 and click &quot;Route via Smart Router&quot; to inspect slice execution, price improvement, and latency benchmarks.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
