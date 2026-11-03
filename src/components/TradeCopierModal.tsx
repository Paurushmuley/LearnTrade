'use client';

import React, { useState, useEffect } from 'react';
import {
  BrokerPlatform,
  SlaveAccountConfig,
  MasterTradeEvent,
  SlaveExecutionReceipt,
  SizingMode,
} from '../types/tradeCopier';
import {
  loadSavedSlaveAccounts,
  saveSlaveAccounts,
  loadSavedReceipts,
  saveReceipts,
  dispatchMasterTradeToSlaves,
  executeEmergencyKillSwitch,
  PRELOADED_SLAVE_ACCOUNTS,
} from '../lib/tradeCopierEngine';
import { TickerInfo, OrderSide } from '../types/trading';
import { POPULAR_TICKERS } from '../lib/marketData';
import {
  Link2,
  Unlink,
  ShieldAlert,
  Zap,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Settings,
  X,
  Share2,
  Server,
  Plus,
} from 'lucide-react';

interface TradeCopierModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterEquity: number;
  selectedTicker: TickerInfo;
  onSimulateMasterTrade?: (trade: MasterTradeEvent) => void;
}

export const TradeCopierModal: React.FC<TradeCopierModalProps> = ({
  isOpen,
  onClose,
  masterEquity,
  selectedTicker,
}) => {
  const [slaves, setSlaves] = useState<SlaveAccountConfig[]>(() => loadSavedSlaveAccounts());
  const [receipts, setReceipts] = useState<SlaveExecutionReceipt[]>(() => loadSavedReceipts());
  const [broadcastSymbol, setBroadcastSymbol] = useState<string>(selectedTicker.symbol);
  const [broadcastSide, setBroadcastSide] = useState<OrderSide>('BUY');
  const [broadcastQty, setBroadcastQty] = useState<number>(50);
  const [broadcastPrice, setBroadcastPrice] = useState<number>(selectedTicker.currentPrice);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Synchronize ticker price
  useEffect(() => {
    setBroadcastSymbol(selectedTicker.symbol);
    setBroadcastPrice(selectedTicker.currentPrice);
  }, [selectedTicker]);

  // Persist changes
  useEffect(() => {
    saveSlaveAccounts(slaves);
  }, [slaves]);

  useEffect(() => {
    saveReceipts(receipts);
  }, [receipts]);

  if (!isOpen) return null;

  const handleToggleSlave = (id: string) => {
    setSlaves((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleMultiplierChange = (id: string, multiplier: number) => {
    setSlaves((prev) =>
      prev.map((s) => (s.id === id ? { ...s, riskMultiplier: multiplier } : s))
    );
  };

  const handleSizingModeChange = (id: string, mode: SizingMode) => {
    setSlaves((prev) =>
      prev.map((s) => (s.id === id ? { ...s, sizingMode: mode } : s))
    );
  };

  const handleBroadcastOrder = () => {
    setIsBroadcasting(true);
    setNotice(null);

    const masterEvent: MasterTradeEvent = {
      eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
      masterAccountId: 'MASTER-PORTFOLIO-1',
      timestamp: new Date().toISOString(),
      symbol: broadcastSymbol,
      side: broadcastSide,
      orderType: 'MARKET',
      productType: 'MIS',
      quantity: broadcastQty,
      fillPrice: broadcastPrice,
    };

    setTimeout(() => {
      const { updatedSlaves, receipts: newReceipts } = dispatchMasterTradeToSlaves({
        masterEvent,
        masterEquity,
        slaves,
      });

      setSlaves(updatedSlaves);
      setReceipts((prev) => [...newReceipts, ...prev].slice(0, 100));
      setIsBroadcasting(false);
      setNotice(
        `✓ Master Order (${broadcastSide} ${broadcastQty} ${broadcastSymbol}) mirrored across ${
          updatedSlaves.filter((s) => s.enabled).length
        } active slave broker accounts!`
      );
    }, 250);
  };

  const handleKillSwitch = () => {
    if (!confirm('EMERGENCY KILL SWITCH: Are you sure you want to close ALL positions across ALL slave broker accounts?')) {
      return;
    }

    const priceMap: Record<string, number> = {};
    POPULAR_TICKERS.forEach((t) => {
      priceMap[t.symbol] = t.currentPrice;
    });

    const { updatedSlaves, liquidatedCount } = executeEmergencyKillSwitch(slaves, priceMap);
    setSlaves(updatedSlaves);
    setNotice(
      `🚨 EMERGENCY KILL SWITCH EXECUTED: Liquidated ${liquidatedCount} positions across all slave accounts!`
    );
  };

  const handleResetSlaves = () => {
    setSlaves(PRELOADED_SLAVE_ACCOUNTS);
    setReceipts([]);
    setNotice('✓ Reset slave accounts and execution receipts to factory defaults.');
  };

  const getBrokerBadge = (broker: BrokerPlatform) => {
    switch (broker) {
      case 'ZERODHA_KITE':
        return { label: 'Zerodha Kite', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'GROWW':
        return { label: 'Groww', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'UPSTOX':
        return { label: 'Upstox Pro', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
    }
  };

  const activeSlavesCount = slaves.filter((s) => s.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0f19] border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-950/40 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/60 border-b border-indigo-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/40 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Share2 className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-widest text-indigo-400 font-semibold">
                  Multi-Broker Execution Bridge
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeSlavesCount} Slaves Synchronized
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Institutional Trade Copier
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Emergency Kill Switch */}
            <button
              onClick={handleKillSwitch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 border border-rose-400 transition"
              title="Liquidate all positions across all slave accounts immediately"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>KILL SWITCH</span>
            </button>

            <button
              onClick={handleResetSlaves}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Reset accounts to defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Notification Alert */}
          {notice && (
            <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-xs font-semibold flex items-center justify-between animate-fadeIn">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {notice}
              </span>
              <button onClick={() => setNotice(null)} className="text-indigo-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Master Signal Broadcaster Simulation Bar */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-500/20 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Master Signal Broadcaster
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  (Master Capital: ₹{masterEquity.toLocaleString('en-IN')})
                </span>
              </div>
              <span className="text-[11px] text-indigo-300 font-mono">
                Auto-mirrors all terminal fills
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-mono">Symbol</label>
                <select
                  value={broadcastSymbol}
                  onChange={(e) => {
                    setBroadcastSymbol(e.target.value);
                    const found = POPULAR_TICKERS.find((t) => t.symbol === e.target.value);
                    if (found) setBroadcastPrice(found.currentPrice);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-semibold mt-1 focus:outline-none focus:border-indigo-400"
                >
                  {POPULAR_TICKERS.map((t) => (
                    <option key={t.symbol} value={t.symbol}>
                      {t.symbol}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-mono">Side</label>
                <div className="flex items-center gap-1 mt-1">
                  <button
                    onClick={() => setBroadcastSide('BUY')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                      broadcastSide === 'BUY'
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setBroadcastSide('SELL')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                      broadcastSide === 'SELL'
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-mono">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={broadcastQty}
                  onChange={(e) => setBroadcastQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-mono mt-1 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-mono">Price (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  value={broadcastPrice}
                  onChange={(e) => setBroadcastPrice(parseFloat(e.target.value) || broadcastPrice)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-mono mt-1 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-end">
                <button
                  onClick={handleBroadcastOrder}
                  disabled={isBroadcasting}
                  className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-1.5 transition"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isBroadcasting ? 'animate-spin' : ''}`} />
                  <span>Broadcast Order</span>
                </button>
              </div>
            </div>
          </div>

          {/* Slave Accounts Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                Configured Slave Broker Accounts ({slaves.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Independent Margins & Slippage Profiles
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {slaves.map((slave) => {
                const badge = getBrokerBadge(slave.broker);

                return (
                  <div
                    key={slave.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      slave.enabled
                        ? 'bg-slate-900/70 border-slate-700 shadow-md'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Broker & Toggle */}
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badge.color}`}>
                          {badge.label}
                        </span>

                        <button
                          onClick={() => handleToggleSlave(slave.id)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                            slave.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {slave.enabled ? (
                            <>
                              <Link2 className="w-3 h-3 text-emerald-400" />
                              <span>SYNCED</span>
                            </>
                          ) : (
                            <>
                              <Unlink className="w-3 h-3 text-slate-400" />
                              <span>PAUSED</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Name & ID */}
                      <div className="mt-2.5">
                        <div className="text-sm font-bold text-white">{slave.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{slave.accountNumber}</div>
                      </div>

                      {/* Financials Overview */}
                      <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase">Available Cash</span>
                          <span className="text-white font-semibold">
                            ₹{slave.availableCash.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase">Used Margin</span>
                          <span className="text-amber-300 font-semibold">
                            ₹{slave.usedMargin.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase">Realized P&L</span>
                          <span
                            className={`font-semibold ${
                              slave.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {slave.realizedPnL >= 0 ? '+' : ''}₹{slave.realizedPnL.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase">Taxes Paid</span>
                          <span className="text-rose-300 font-semibold">
                            ₹{slave.totalStatutoryTaxesPaid.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Risk Multiplier Slider */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">Risk Multiplier:</span>
                          <span className="font-mono font-bold text-indigo-400">
                            {slave.riskMultiplier.toFixed(1)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="3.0"
                          step="0.1"
                          value={slave.riskMultiplier}
                          onChange={(e) => handleMultiplierChange(slave.id, parseFloat(e.target.value))}
                          disabled={!slave.enabled}
                          className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                        />
                      </div>

                      {/* Sizing Mode Selector */}
                      <div className="mt-3">
                        <label className="text-[10px] text-slate-400 uppercase font-mono">Sizing Mode</label>
                        <select
                          value={slave.sizingMode}
                          onChange={(e) => handleSizingModeChange(slave.id, e.target.value as SizingMode)}
                          disabled={!slave.enabled}
                          className="w-full bg-slate-950 border border-slate-800 text-[11px] text-slate-200 rounded px-2 py-1 font-mono mt-1 focus:outline-none focus:border-indigo-400"
                        >
                          <option value="EQUITY_PROPORTIONAL">Equity Proportional (Default)</option>
                          <option value="FIXED_MULTIPLIER">Fixed Lot Multiplier</option>
                          <option value="RISK_PARITY">Risk Parity (Fixed 1.5%)</option>
                        </select>
                      </div>
                    </div>

                    {/* Open Positions Count */}
                    <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Open Positions:</span>
                      <span className="text-white font-bold">{slave.openPositions.length} active</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-Time Execution Audit Log Stream */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                Execution Audit Log Stream ({receipts.length} Receipts)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Latency & Slippage Disclosures
              </span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Receipt ID</th>
                      <th className="px-3 py-2">Broker</th>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Master / Fill Price</th>
                      <th className="px-3 py-2">Latency</th>
                      <th className="px-3 py-2">Slippage</th>
                      <th className="px-3 py-2">Taxes</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {receipts.map((r) => (
                      <tr key={r.receiptId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2 text-indigo-400 font-semibold">{r.receiptId}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] text-slate-300">{r.broker.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-3 py-2 text-white">{r.slaveAccountName}</td>
                        <td className="px-3 py-2 text-slate-200">
                          {r.filledQty} <span className="text-slate-500">/ {r.requestedQty}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          ₹{r.masterPrice.toFixed(1)} &rarr;{' '}
                          <span className="text-white font-bold">₹{r.slaveFillPrice.toFixed(1)}</span>
                        </td>
                        <td className="px-3 py-2 text-cyan-300">{r.latencyMs} ms</td>
                        <td className="px-3 py-2 text-amber-300">{r.slippageBps} bps</td>
                        <td className="px-3 py-2 text-rose-300">₹{r.statutoryTaxes.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'FILLED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {receipts.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-slate-500 font-sans">
                          No slave copy executions recorded yet. Broadcast a master order or execute in the terminal to view live logs.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-indigo-400" />
            <span>
              Internal Multi-Account Management (MAM) Sandbox &bull; Zero Real Broker Execution Risk
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors"
          >
            Close Copier Bridge
          </button>
        </div>
      </div>
    </div>
  );
};
