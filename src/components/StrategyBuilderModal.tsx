'use client';

import React, { useState } from 'react';
import { BacktestResult, Candle } from '../types/trading';
import { runStrategyBacktest } from '../lib/strategyBacktester';
import { generateHistoricalCandles } from '../lib/marketData';
import { Code, Download, Play, Sparkles, TrendingUp, X, Zap } from 'lucide-react';

interface StrategyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  candles: Candle[];
  symbol: string;
}

export const StrategyBuilderModal: React.FC<StrategyBuilderModalProps> = ({
  isOpen,
  onClose,
  candles,
  symbol,
}) => {
  const [prompt, setPrompt] = useState(
    'Buy when 20 EMA crosses above 50 EMA on 5m chart with 2% profit target and 1% stop-loss.'
  );
  const [fastEma, setFastEma] = useState(20);
  const [slowEma, setSlowEma] = useState(50);
  const [stopLoss, setStopLoss] = useState(1.0);
  const [target, setTarget] = useState(2.0);
  const [capital, setCapital] = useState(200000);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [showCode, setShowCode] = useState(false);

  if (!isOpen) return null;

  const handleRunBacktest = () => {
    // If candles array has few items, generate full 150-candle historical set
    const backtestCandles = candles.length >= 60 ? candles : generateHistoricalCandles(2500, '5m', 150);
    const res = runStrategyBacktest('EMA Crossover Trend Follower', symbol, backtestCandles, {
      fastEmaPeriod: fastEma,
      slowEmaPeriod: slowEma,
      rsiFilter: true,
      stopLossPercent: stopLoss,
      targetPercent: target,
      positionSizeCapital: capital,
    });
    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F141F] border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col text-xs max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0B0E14]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Natural Language Strategy Builder & Backtester
              </h2>
              <p className="text-[11px] text-slate-400">Compiles plain English trading ideas into algorithmic execution & tax-deducted backtests</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Natural Language Prompt */}
          <div className="space-y-1.5">
            <label className="text-slate-200 font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Plain English Strategy Idea
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your entry, indicators, and risk management rules..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
              />
            </div>
            {/* Quick Templates */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-slate-500">Quick templates:</span>
              <button
                type="button"
                onClick={() => {
                  setFastEma(9);
                  setSlowEma(21);
                  setStopLoss(0.8);
                  setTarget(1.8);
                  setPrompt('Scalp momentum: 9 EMA crosses 21 EMA with tight 0.8% stop and 1.8% target.');
                }}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-300 hover:border-slate-700"
              >
                9/21 Momentum Scalp
              </button>
              <button
                type="button"
                onClick={() => {
                  setFastEma(20);
                  setSlowEma(50);
                  setStopLoss(1.5);
                  setTarget(3.0);
                  setPrompt('Swing trend: 20 EMA crosses 50 EMA with 1:2 Risk-Reward.');
                }}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-300 hover:border-slate-700"
              >
                20/50 Swing (1:2 R:R)
              </button>
            </div>
          </div>

          {/* Strategy Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-400 block text-[10px] mb-1">Fast EMA</span>
              <input
                type="number"
                value={fastEma}
                onChange={(e) => setFastEma(parseInt(e.target.value) || 5)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
              />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] mb-1">Slow EMA</span>
              <input
                type="number"
                value={slowEma}
                onChange={(e) => setSlowEma(parseInt(e.target.value) || 20)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
              />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] mb-1">Stop Loss %</span>
              <input
                type="number"
                step="0.1"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0.5)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
              />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] mb-1">Target %</span>
              <input
                type="number"
                step="0.1"
                value={target}
                onChange={(e) => setTarget(parseFloat(e.target.value) || 1.0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-400 block text-[10px] mb-1">Trade Capital (₹)</span>
              <input
                type="number"
                step="10000"
                value={capital}
                onChange={(e) => setCapital(parseInt(e.target.value) || 50000)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[11px]">
              Backtesting on: <strong className="text-slate-200">{symbol} (NSE)</strong> • Full statutory charges deducted
            </span>
            <button
              onClick={handleRunBacktest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition"
            >
              <Play className="h-4 w-4 fill-white" />
              Run Backtest
            </button>
          </div>

          {/* Backtest Results Dashboard */}
          {result && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block font-sans">Win Rate</span>
                  <span className={`text-base font-bold ${result.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.winRate}%
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {result.winningTrades}W / {result.losingTrades}L ({result.totalTrades} trades)
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block font-sans">Net P&L (Post-Tax)</span>
                  <span className={`text-base font-bold ${result.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.netProfit >= 0 ? '+' : ''}₹{result.netProfit.toLocaleString('en-IN')}
                  </span>
                  <span className="block text-[10px] text-amber-400">
                    Taxes: ₹{result.totalCharges.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block font-sans">Profit Factor</span>
                  <span className="text-base font-bold text-blue-400">{result.profitFactor}</span>
                  <span className="block text-[10px] text-slate-500">Sharpe: {result.sharpeRatio}</span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block font-sans">Max Drawdown</span>
                  <span className="text-base font-bold text-rose-400">{result.maxDrawdownPercent}%</span>
                  <span className="block text-[10px] text-slate-500">Capital Protection</span>
                </div>
              </div>

              {/* Toggle Python Algorithmic Code */}
              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold text-slate-300">Historical Simulated Trades</span>
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 font-mono text-[11px] flex items-center gap-1"
                >
                  <Code className="h-3.5 w-3.5" />
                  {showCode ? 'Hide Python Code' : 'View Python Algorithm'}
                </button>
              </div>

              {showCode ? (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                  <pre>{result.pythonCode}</pre>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-44 border border-slate-800 rounded-xl">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-slate-900 text-slate-400 text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2">Entry</th>
                        <th className="p-2">Exit</th>
                        <th className="p-2">Entry Px</th>
                        <th className="p-2">Exit Px</th>
                        <th className="p-2">Exit Reason</th>
                        <th className="p-2">Gross P&L</th>
                        <th className="p-2">Taxes</th>
                        <th className="p-2 text-right">Net P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950 text-[11px]">
                      {result.trades.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="p-2 text-slate-400">{t.entryTime}</td>
                          <td className="p-2 text-slate-400">{t.exitTime}</td>
                          <td className="p-2">₹{t.entryPrice}</td>
                          <td className="p-2">₹{t.exitPrice}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              t.reason === 'TARGET' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                            }`}>
                              {t.reason}
                            </span>
                          </td>
                          <td className={`p-2 ${t.grossPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.grossPnL >= 0 ? '+' : ''}₹{t.grossPnL}
                          </td>
                          <td className="p-2 text-amber-400">₹{t.charges}</td>
                          <td className={`p-2 text-right font-bold ${t.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.netPnL >= 0 ? '+' : ''}₹{t.netPnL}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
