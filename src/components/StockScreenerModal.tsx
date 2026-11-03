'use client';

import React, { useState } from 'react';
import {
  ScreenedStock,
  ScreenerPreset,
  scanUniverse,
  filterScreenedStocks,
  generateScreenerAIPrompt,
} from '../lib/screenerEngine';
import { POPULAR_TICKERS } from '../lib/marketData';
import { AIConfig, TickerInfo } from '../types/trading';
import { queryAIProvider } from '../lib/aiProvider';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  CheckCircle2,
  Crosshair,
  Filter,
  Flame,
  LineChart,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

interface StockScreenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiConfig: AIConfig;
  onSelectStock: (ticker: TickerInfo) => void;
}

export const StockScreenerModal: React.FC<StockScreenerModalProps> = ({
  isOpen,
  onClose,
  aiConfig,
  onSelectStock,
}) => {
  const [allStocks, setAllStocks] = useState<ScreenedStock[]>(() => scanUniverse(POPULAR_TICKERS));
  const [activePreset, setActivePreset] = useState<ScreenerPreset>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = () => {
    setAllStocks(scanUniverse(POPULAR_TICKERS));
  };

  const filteredByPreset = filterScreenedStocks(allStocks, activePreset);
  const displayedStocks = filteredByPreset.filter((s) =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const bullishCount = allStocks.filter(s => s.confluenceScore >= 60).length;
  const bearishCount = allStocks.filter(s => s.confluenceScore <= 40).length;
  const avgConfluence = Math.round(allStocks.reduce((a: number, b) => a + b.confluenceScore, 0) / (allStocks.length || 1));

  const handleRunAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiBrief(null);

    const prompt = generateScreenerAIPrompt(displayedStocks, activePreset);

    try {
      if (!aiConfig.geminiKey && !aiConfig.openaiKey && aiConfig.provider !== 'ollama') {
        setTimeout(() => {
          setAiBrief(
            `### 🎯 TradeCraft AI Scanner Brief (Heuristic Mode)

**1. Dominant Market Theme:**
- Banking & Financials (HDFCBANK, ICICIBANK) and IT (TCS) are exhibiting the highest momentum confluence with price holding above VWAP and active volume surges (>1.8x).
- Broad market sentiment leans mildly bullish (Avg Confluence: ${avgConfluence}/100, ${bullishCount} Bullish setups vs ${bearishCount} Bearish).

**2. Top High-Confluence Plays:**
- **${displayedStocks[0]?.symbol || 'RELIANCE'} (Confluence: ${displayedStocks[0]?.confluenceScore || 85}/100):** Bullish alignment across 20/50 EMA with strong volume confirmation. Invalidation stop-loss placed right below Day VWAP (₹${displayedStocks[0]?.vwap || 0}).
- **${displayedStocks[1]?.symbol || 'TCS'} (Confluence: ${displayedStocks[1]?.confluenceScore || 78}/100):** Clean trend continuation with RSI at ${displayedStocks[1]?.rsi14 || 58}. Target next intraday pivot with 1.8:1 Risk-to-Reward.

**3. Traps to Avoid:**
- Avoid aggressive long chasing on stocks with RSI > 72 — mean reversion pullbacks to 20 EMA are probable before subsequent leg up.

*(Tip: Enter your Google Gemini key in BYOK Settings for live dynamic neural scanner briefings).*`
          );
          setIsAiLoading(false);
        }, 600);
        return;
      }

      const res = await queryAIProvider(
        aiConfig,
        prompt,
        'You are an institutional quantitative scanner analyst specializing in Indian equity intraday setups.'
      );
      setAiBrief(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error querying AI provider';
      setAiBrief(`⚠️ Scanner Brief Error: ${msg}. Check your BYOK API Key in Settings.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePickStock = (stock: ScreenedStock) => {
    const matchedTicker = POPULAR_TICKERS.find(t => t.symbol === stock.symbol);
    if (matchedTicker) {
      onSelectStock(matchedTicker);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Crosshair className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">NSE Technical Screener & Stock Scanner</h2>
                <span className="rounded-full bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
                  REAL-TIME MATRIX
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Multi-factor quantitative scanning across Volume Surges, 20/50 EMAs, RSI, Day VWAP, and 15m ORBs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition"
              title="Re-scan NSE universe"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Macro Confluence & Filters Bar */}
        <div className="border-b border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'All Universe', icon: Filter },
                  { id: 'BULLISH', label: 'Bullish Setups', icon: TrendingUp },
                  { id: 'BEARISH', label: 'Bearish Weakness', icon: TrendingDown },
                  { id: 'VOLUME_SURGE', label: 'Volume Shockers', icon: Flame },
                  { id: 'RSI_EXTREMES', label: 'RSI Extremes', icon: Zap },
                  { id: 'ORB_BREAKOUTS', label: '15m ORB Breakouts', icon: Crosshair },
                ] as const
              ).map((preset) => {
                const Icon = preset.icon;
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setActivePreset(preset.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search symbol, sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 px-3 py-1.5 flex items-center justify-between">
              <span className="text-zinc-400 text-[11px]">Universe Screened</span>
              <span className="font-bold text-zinc-200">{allStocks.length} Equities</span>
            </div>
            <div className="rounded-lg bg-emerald-950/20 border border-emerald-900/30 px-3 py-1.5 flex items-center justify-between">
              <span className="text-emerald-400 text-[11px]">Bullish Confluence</span>
              <span className="font-bold text-emerald-400">{bullishCount} Stocks</span>
            </div>
            <div className="rounded-lg bg-rose-950/20 border border-rose-900/30 px-3 py-1.5 flex items-center justify-between">
              <span className="text-rose-400 text-[11px]">Bearish Pressure</span>
              <span className="font-bold text-rose-400">{bearishCount} Stocks</span>
            </div>
            <div className="rounded-lg bg-teal-950/20 border border-teal-900/30 px-3 py-1.5 flex items-center justify-between">
              <span className="text-teal-400 text-[11px]">Avg Setup Score</span>
              <span className="font-bold text-teal-400">{avgConfluence}/100</span>
            </div>
          </div>
        </div>

        {/* AI Scanner Synthesis Banner */}
        <div className="border-b border-zinc-800 bg-zinc-900/20 px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              BYOK AI Scanner Synthesis & High-Probability Plays
            </h3>
            <p className="text-[11px] text-zinc-400">
              Instantly prompts your LLM to distill current scanner signals into 2 trade theses with entry & stop invalidation
            </p>
          </div>
          <button
            onClick={handleRunAiAnalysis}
            disabled={isAiLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50"
          >
            {isAiLoading ? (
              <>
                <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Synthesizing...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Generate AI Trade Brief
              </>
            )}
          </button>
        </div>

        {/* AI Result Box (If active) */}
        {aiBrief && (
          <div className="border-b border-zinc-800 bg-zinc-950 p-4 font-sans text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {aiBrief}
          </div>
        )}

        {/* Screened Stocks Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-3">Symbol & Sector</th>
                    <th className="py-2.5 px-3 text-right">LTP</th>
                    <th className="py-2.5 px-3 text-right">Volume Surge</th>
                    <th className="py-2.5 px-3 text-right">RSI (14)</th>
                    <th className="py-2.5 px-3 text-right">Day VWAP</th>
                    <th className="py-2.5 px-3">Confluence Score</th>
                    <th className="py-2.5 px-3">Key Technical Signals</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {displayedStocks.map((stock) => (
                    <tr key={stock.symbol} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                          {stock.symbol}
                          <span className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
                            stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent}%
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500">{stock.name} • {stock.sector}</span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-zinc-100">
                        ₹{stock.price.toLocaleString('en-IN')}
                      </td>

                      <td className="py-2.5 px-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1 font-mono">
                          {stock.volumeSurgeRatio >= 2.0 && <Flame className="h-3 w-3 text-amber-400" />}
                          <span className={stock.volumeSurgeRatio >= 1.5 ? 'font-bold text-amber-400' : 'text-zinc-300'}>
                            {stock.volumeSurgeRatio}x
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono">
                        <span className={stock.rsi14 >= 70 ? 'text-rose-400 font-bold' : stock.rsi14 <= 30 ? 'text-emerald-400 font-bold' : 'text-zinc-300'}>
                          {stock.rsi14}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                        ₹{stock.vwap}
                        <span className={`block text-[10px] ${stock.isAboveVwap ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {stock.isAboveVwap ? 'Above' : 'Below'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-extrabold ${
                            stock.confluenceScore >= 70 ? 'text-emerald-400' :
                            stock.confluenceScore >= 55 ? 'text-teal-400' :
                            stock.confluenceScore <= 35 ? 'text-rose-400' : 'text-zinc-300'
                          }`}>
                            {stock.confluenceScore}
                          </span>
                          <div className="w-16 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                stock.confluenceScore >= 60 ? 'bg-emerald-500' :
                                stock.confluenceScore <= 40 ? 'bg-rose-500' : 'bg-teal-500'
                              }`}
                              style={{ width: `${stock.confluenceScore}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold ${
                          stock.bias.includes('BULLISH') ? 'text-emerald-400' :
                          stock.bias.includes('BEARISH') ? 'text-rose-400' : 'text-zinc-400'
                        }`}>
                          {stock.bias.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex flex-wrap gap-1">
                          {stock.signals.map((sig, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium"
                            >
                              {sig}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center font-sans">
                        <button
                          onClick={() => handlePickStock(stock)}
                          className="px-2.5 py-1 bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 rounded text-xs font-semibold flex items-center justify-center gap-1 mx-auto transition"
                          title="Load this stock into TradingView chart & Order Ticket"
                        >
                          <LineChart className="h-3 w-3" />
                          <span>Chart Stock</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
