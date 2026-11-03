'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Layers,
  ShieldAlert,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Radio,
  Eye,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import {
  Level3PriceRung,
  Level3BookSnapshot,
  IcebergAlert,
  InstitutionalBlockPrint
} from '../types/microstructure';
import { generateSyntheticLevel3Book } from '../lib/microstructureEngine';
import { POPULAR_TICKERS } from '../lib/marketData';
import { TickerInfo } from '../types/trading';

interface MicrostructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTicker?: TickerInfo;
  onExecuteTrade?: (symbol: string, side: 'BUY' | 'SELL', price: number, quantity: number) => void;
}

export const MicrostructureModal: React.FC<MicrostructureModalProps> = ({
  isOpen,
  onClose,
  selectedTicker,
  onExecuteTrade
}) => {
  const defaultSymbol = selectedTicker?.symbol || 'RELIANCE';
  const [symbol, setSymbol] = useState<string>(defaultSymbol);
  const [spotPrice, setSpotPrice] = useState<number>(selectedTicker?.currentPrice || 2480.0);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ladder' | 'icebergs' | 'blocks'>('ladder');
  const [selectedIceberg, setSelectedIceberg] = useState<IcebergAlert | null>(null);
  const [tradeNotification, setTradeNotification] = useState<string | null>(null);

  // Synchronize when parent ticker changes
  useEffect(() => {
    if (selectedTicker) {
      setSymbol(selectedTicker.symbol);
      setSpotPrice(selectedTicker.currentPrice);
    }
  }, [selectedTicker]);

  // Generate or update Level 3 Order Book Snapshot
  const [snapshot, setSnapshot] = useState<Level3BookSnapshot>(() =>
    generateSyntheticLevel3Book(symbol, spotPrice)
  );

  // Live stream tick simulator
  useEffect(() => {
    if (!isOpen) return;

    // Initial snapshot update
    setSnapshot(generateSyntheticLevel3Book(symbol, spotPrice));

    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      // Small simulated spot tick fluctuation
      const tickDelta = (Math.random() - 0.49) * 0.15;
      const newSpot = Number(Math.max(10, spotPrice + tickDelta).toFixed(2));
      setSpotPrice(newSpot);
      setSnapshot(generateSyntheticLevel3Book(symbol, newSpot));
    }, 1800);

    return () => clearInterval(interval);
  }, [isOpen, symbol, isLiveStreaming, spotPrice]);

  const maxBidQty = useMemo(() => {
    return Math.max(...snapshot.bids.map((b) => b.visibleQuantity), 1);
  }, [snapshot.bids]);

  const maxAskQty = useMemo(() => {
    return Math.max(...snapshot.asks.map((a) => a.visibleQuantity), 1);
  }, [snapshot.asks]);

  // Handler for front-running or joining institutional order flow
  const handleRideInstitutionalFlow = useCallback(
    (side: 'BUY' | 'SELL', price: number, visibleSize: number) => {
      // Sizing logic: join with 10% of visible depth or min 25 shares
      const tradeQty = Math.max(25, Math.round(visibleSize * 0.1));
      const adjustedPrice = side === 'BUY' ? Number((price + 0.05).toFixed(2)) : Number((price - 0.05).toFixed(2));

      if (onExecuteTrade) {
        onExecuteTrade(symbol, side, adjustedPrice, tradeQty);
      }

      setTradeNotification(
        `⚡ Order Dispatched: ${side} ${tradeQty} ${symbol} @ ₹${adjustedPrice.toFixed(2)} (Riding Institutional Flow)`
      );
      setTimeout(() => setTradeNotification(null), 4000);
    },
    [onExecuteTrade, symbol]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                  Level-3 Order Book & Institutional Iceberg Radar
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Sprint 15 Microstructure
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time MBO queue depth, algorithmic iceberg replenishment detector, SEBI ₹10 Cr block pool tracker & VPIN toxicity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Symbol Selector */}
            <select
              value={symbol}
              onChange={(e) => {
                const newSym = e.target.value;
                setSymbol(newSym);
                const match = POPULAR_TICKERS.find((t) => t.symbol === newSym);
                if (match) setSpotPrice(match.currentPrice);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {POPULAR_TICKERS.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} (₹{t.currentPrice.toFixed(2)})
                </option>
              ))}
            </select>

            {/* Live Streaming Toggle */}
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isLiveStreaming
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'text-emerald-400 animate-ping' : ''}`} />
              {isLiveStreaming ? 'LIVE FEED (1.8s)' : 'PAUSED'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Trade Notification Toast */}
        {tradeNotification && (
          <div className="bg-gradient-to-r from-emerald-900/90 to-teal-900/90 border-b border-emerald-500/50 px-6 py-2 text-xs font-medium text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{tradeNotification}</span>
          </div>
        )}

        {/* Microstructure Metrics HUD */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-950/40 border-b border-slate-800 text-xs">
          {/* Micro-Price vs Mid */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Micro-Price (P_micro)</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-cyan-300">₹{snapshot.metrics.microPrice.toFixed(2)}</span>
              <span
                className={`text-[11px] font-semibold flex items-center ${
                  snapshot.metrics.microPriceBiasTicks >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {snapshot.metrics.microPriceBiasTicks >= 0 ? '+' : ''}
                {snapshot.metrics.microPriceBiasTicks} ticks
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Mid: ₹{snapshot.metrics.midPrice.toFixed(2)} | Spread: ₹{snapshot.metrics.spread.toFixed(2)} ({snapshot.metrics.spreadBps} bps)
            </div>
          </div>

          {/* 5-Rung Order Book Imbalance (OBI) */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>5-Level Imbalance (OBI)</span>
              {snapshot.metrics.bookImbalance5 >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-lg font-bold ${
                  snapshot.metrics.bookImbalance5 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {snapshot.metrics.bookImbalance5 > 0 ? '+' : ''}
                {(snapshot.metrics.bookImbalance5 * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400">
                {snapshot.metrics.bookImbalance5 > 0.15
                  ? 'Strong Bid Skew'
                  : snapshot.metrics.bookImbalance5 < -0.15
                  ? 'Strong Ask Skew'
                  : 'Balanced'}
              </span>
            </div>
            <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden mt-1.5 flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${Math.max(0, (snapshot.metrics.bookImbalance5 + 1) * 50)}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${Math.max(0, (1 - snapshot.metrics.bookImbalance5) * 50)}%` }}
              />
            </div>
          </div>

          {/* 10-Rung Weighted Imbalance */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Weighted Decay OBI</span>
              <Info className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-lg font-bold ${
                  snapshot.metrics.imbalanceWeighted >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {snapshot.metrics.imbalanceWeighted > 0 ? '+' : ''}
                {(snapshot.metrics.imbalanceWeighted * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400">Harmonic 1/k</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Filters distant spoofing rungs</div>
          </div>

          {/* VPIN Flow Toxicity */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>VPIN Flow Toxicity</span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-amber-300">
                {(snapshot.metrics.vpinScore * 100).toFixed(1)}%
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                  snapshot.metrics.toxicityStatus === 'TOXIC_SWEEP'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    : snapshot.metrics.toxicityStatus === 'MODERATE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {snapshot.metrics.toxicityStatus}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Easley-López de Prado model</div>
          </div>

          {/* Active Icebergs Detected */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Active Icebergs</span>
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-cyan-400">{snapshot.activeIcebergs.length}</span>
              <span className="text-[10px] text-slate-400">Rungs reloading</span>
            </div>
            <div className="text-[10px] text-cyan-400/80 mt-0.5 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Sub-45ms latency signatures
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2">
          <button
            onClick={() => setActiveTab('ladder')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'ladder'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            10-Rung Level-3 Depth Ladder ({snapshot.bids.length + snapshot.asks.length})
          </button>
          <button
            onClick={() => setActiveTab('icebergs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'icebergs'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Detected Institutional Icebergs ({snapshot.activeIcebergs.length})
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'blocks'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Dark Pool & SEBI Block Deals ({snapshot.recentBlockPrints.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'ladder' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Depth of Market (DOM) with simulated order queue positions and algorithmic iceberg markers
                </span>
                <span className="text-[11px] text-cyan-400">
                  Tip: Look for pulsing cyan badges on rungs where hidden institutional size is reloading.
                </span>
              </div>

              {/* Dual Depth Ladder Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* BIDS SIDE (Buyers) */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-emerald-950/30 border-b border-emerald-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-300 uppercase">Bid Queue (Buyers)</span>
                    </div>
                    <span className="text-[11px] text-emerald-400/80">
                      Total Depth: {snapshot.metrics.totalBidDepth.toLocaleString()}
                    </span>
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Orders</th>
                        <th className="py-2 px-3 text-right">Visible Qty</th>
                        <th className="py-2 px-3 text-right">Traded</th>
                        <th className="py-2 px-3 text-right">Bid Price (₹)</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {snapshot.bids.map((rung) => {
                        const fillWidth = (rung.visibleQuantity / maxBidQty) * 100;
                        return (
                          <tr
                            key={`bid-${rung.price}`}
                            className={`relative hover:bg-emerald-500/5 transition-colors ${
                              rung.hasIceberg ? 'bg-cyan-950/20' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-slate-400">{rung.orderCount}</td>
                            <td className="py-2 px-3 text-right text-slate-200 relative">
                              {/* Background Depth Fill Bar */}
                              <div
                                className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 -z-10 pointer-events-none"
                                style={{ width: `${fillWidth}%` }}
                              />
                              {rung.visibleQuantity.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-400">
                              {rung.cumulativeTradedVolume.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400">
                              ₹{rung.price.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {rung.hasIceberg ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                                  <Zap className="w-2.5 h-2.5" />
                                  ICEBERG {rung.reloadCount}x
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Retail</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => handleRideInstitutionalFlow('BUY', rung.price, rung.visibleQuantity)}
                                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 transition-colors"
                              >
                                Join +1
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ASKS SIDE (Sellers) */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-rose-950/30 border-b border-rose-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-rose-300 uppercase">Ask Queue (Sellers)</span>
                    </div>
                    <span className="text-[11px] text-rose-400/80">
                      Total Depth: {snapshot.metrics.totalAskDepth.toLocaleString()}
                    </span>
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Ask Price (₹)</th>
                        <th className="py-2 px-3 text-right">Traded</th>
                        <th className="py-2 px-3 text-right">Visible Qty</th>
                        <th className="py-2 px-3 text-center">Orders</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {snapshot.asks.map((rung) => {
                        const fillWidth = (rung.visibleQuantity / maxAskQty) * 100;
                        return (
                          <tr
                            key={`ask-${rung.price}`}
                            className={`relative hover:bg-rose-500/5 transition-colors ${
                              rung.hasIceberg ? 'bg-cyan-950/20' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-bold text-rose-400">₹{rung.price.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-slate-400">
                              {rung.cumulativeTradedVolume.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-200 relative">
                              {/* Background Depth Fill Bar */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-rose-500/10 -z-10 pointer-events-none"
                                style={{ width: `${fillWidth}%` }}
                              />
                              {rung.visibleQuantity.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-400">{rung.orderCount}</td>
                            <td className="py-2 px-3 text-center">
                              {rung.hasIceberg ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                                  <Zap className="w-2.5 h-2.5" />
                                  ICEBERG {rung.reloadCount}x
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Retail</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => handleRideInstitutionalFlow('SELL', rung.price, rung.visibleQuantity)}
                                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition-colors"
                              >
                                Join -1
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

          {activeTab === 'icebergs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Statistical Iceberg Order Detection Radar (Reload Multiplier ≥ 2.0x, Sub-45ms latency)
                </span>
                <span className="text-[11px] text-cyan-400">
                  Total Active Icebergs: {snapshot.activeIcebergs.length}
                </span>
              </div>

              {snapshot.activeIcebergs.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  No active iceberg orders detected at this moment for {symbol}.
                </div>
              ) : (
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/70 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Side / Symbol</th>
                        <th className="py-3 px-4">Price (₹)</th>
                        <th className="py-3 px-4 text-center">Reload Factor</th>
                        <th className="py-3 px-4 text-right">Visible Size</th>
                        <th className="py-3 px-4 text-right">Traded Vol</th>
                        <th className="py-3 px-4 text-right">Est. Hidden Size</th>
                        <th className="py-3 px-4 text-right">Est. Total Size</th>
                        <th className="py-3 px-4">Exhaustion</th>
                        <th className="py-3 px-4 text-center">Severity</th>
                        <th className="py-3 px-4 text-right">Execution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {snapshot.activeIcebergs.map((alert) => (
                        <tr
                          key={alert.id}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                          onClick={() => setSelectedIceberg(alert)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  alert.side === 'BUY'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}
                              >
                                {alert.side}
                              </span>
                              <span className="font-semibold text-slate-200">{alert.symbol}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-100">₹{alert.price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                              {alert.detectedReloads}x Reloaded
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-300">
                            {alert.visibleDisplaySize.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-300">
                            {alert.cumulativeVolumeTraded.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-cyan-400">
                            +{alert.estimatedHiddenVolume.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-100">
                            ~{alert.estimatedTotalSize.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-24">
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>{alert.exhaustionPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-cyan-400 h-full rounded-full transition-all"
                                  style={{ width: `${alert.exhaustionPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                alert.severity === 'INSTITUTIONAL_WHALE'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse'
                                  : alert.severity === 'HEAVY'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              }`}
                            >
                              {alert.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRideInstitutionalFlow(alert.side, alert.price, alert.visibleDisplaySize);
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 flex items-center gap-1 transition-all ml-auto"
                            >
                              <Zap className="w-3 h-3 text-cyan-400" />
                              Front-Run
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'blocks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  SEBI Institutional Block Deals (≥ ₹10 Crore Threshold) & Dark Liquidity Sweeps
                </span>
                <span className="text-[11px] text-emerald-400">
                  Morning (8:45-9:00 AM) & Afternoon (2:05-2:20 PM IST)
                </span>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/70 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Symbol / Exch</th>
                      <th className="py-3 px-4">Side</th>
                      <th className="py-3 px-4 text-right">Price (₹)</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4 text-right">Turnover (₹ Cr)</th>
                      <th className="py-3 px-4 text-center">Venue</th>
                      <th className="py-3 px-4 text-center">Participant</th>
                      <th className="py-3 px-4 text-right">VWAP Bias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {snapshot.recentBlockPrints.map((block) => (
                      <tr key={block.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400">{block.timestamp}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-200">{block.symbol}</span>
                          <span className="ml-1 text-[10px] text-slate-500">{block.exchange}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              block.side === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {block.side}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-100">
                          ₹{block.price.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {block.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          ₹{block.turnoverCrores.toFixed(2)} Cr
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {block.venue}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {block.participant}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-semibold ${
                              block.premiumOrDiscountPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {block.premiumOrDiscountPct >= 0 ? '+' : ''}
                            {block.premiumOrDiscountPct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar with SEBI Disclaimer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>SEBI Institutional Microstructure Notice:</strong> Educational simulation of Level-3 Market-By-Order
              queues, iceberg replenishment signatures, and block deal windows. No real capital at risk.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">TradeCraft AI Microstructure Suite</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">
              VPIN: {(snapshot.metrics.vpinScore * 100).toFixed(1)}%
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
