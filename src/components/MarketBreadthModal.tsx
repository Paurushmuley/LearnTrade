'use client';

import React, { useState } from 'react';
import { calculateMarketBreadth, getFIIDIITrend, getSectoralHeatmap, MarketBreadth, SectoralPerformance } from '../lib/breadthEngine';
import { AIConfig } from '../types/trading';
import { queryAIProvider } from '../lib/aiProvider';
import { ArrowDown, ArrowUp, BarChart2, Brain, Globe2, Layers, RefreshCw, Sparkles, TrendingUp, X, Zap } from 'lucide-react';

interface MarketBreadthModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiConfig: AIConfig;
}

export const MarketBreadthModal: React.FC<MarketBreadthModalProps> = ({
  isOpen,
  onClose,
  aiConfig,
}) => {
  const [breadth, setBreadth] = useState<MarketBreadth>(calculateMarketBreadth(34, 14, 2));
  const [fiiDii, setFiiDii] = useState(getFIIDIITrend());
  const [sectors, setSectors] = useState<SectoralPerformance[]>(getSectoralHeatmap());
  const [activeTab, setActiveTab] = useState<'breadth' | 'fiidii' | 'sectors'>('breadth');

  const [aiMacroAnalysis, setAiMacroAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  if (!isOpen) return null;

  const handleAskAIMacroStrategist = async () => {
    setIsAiLoading(true);
    setAiMacroAnalysis(null);

    const prompt = `Perform an Institutional Macro Sentiment Assessment for Indian Equities (NSE):
- Market Breadth: ${breadth.advances} Advancing vs ${breadth.declines} Declining (A/D Ratio: ${breadth.ratio}, ${breadth.sentiment})
- FII Net Flow: ${fiiDii[0].fiiNetCashCr >= 0 ? '+' : ''}₹${fiiDii[0].fiiNetCashCr} Cr, DII Net Flow: +₹${fiiDii[0].diiNetCashCr} Cr
- FII Index Futures Long Exposure: ${(fiiDii[0].fiiIndexFuturesLongRatio * 100).toFixed(0)}% Long
- Top Sector Leaders: NIFTY IT (+1.48%), NIFTY REALTY (+2.10%), NIFTY BANK (+1.15%)
- Lagging Sectors: NIFTY METAL (-0.65%), NIFTY PHARMA (-0.42%)

Provide a 3-bullet actionable briefing for an intraday/swing trader:
1. Macro Tide: Are institutions buying dips or selling rallies?
2. Sector Rotation: Where is fresh institutional money moving?
3. Actionable Tactical Guidance: Long bias, short bias, or caution?`;

    try {
      if (!aiConfig.geminiKey && !aiConfig.openaiKey && aiConfig.provider !== 'ollama') {
        setTimeout(() => {
          setAiMacroAnalysis(
            `[Heuristic Macro Brief] Institutional Alignment: Both FIIs (+₹${fiiDii[0].fiiNetCashCr} Cr) and DIIs (+₹${fiiDii[0].diiNetCashCr} Cr) are in net accumulation mode with FII futures at 68% long. Breadth Health: 34 advances to 14 declines confirms broad-market participation led by IT and Banking. Tactical Bias: Maintain a "buy on intraday dips" bias, honoring support at daily EMA levels. Add your Gemini key in BYOK settings for live neural macro analysis.`
          );
          setIsAiLoading(false);
        }, 500);
        return;
      }

      const res = await queryAIProvider(
        aiConfig,
        prompt,
        'You are an institutional macro strategist specializing in Indian capital markets, institutional flow analysis, and sector rotation.'
      );
      setAiMacroAnalysis(res);
    } catch (err: any) {
      setAiMacroAnalysis(`Error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F141F] border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col text-xs max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0B0E14]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Globe2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">Market Breadth & Institutional FII / DII Flows</h2>
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono text-[10px]">
                  NSE Indian Macro
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Advance/Decline Ratio • Foreign & Domestic Institutional Net Liquidity • Sectoral Heatmap</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Sub Navigation Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('breadth')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'breadth' ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Advance / Decline Breadth</span>
              </button>

              <button
                onClick={() => setActiveTab('fiidii')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'fiidii' ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5 text-blue-400" />
                <span>FII / DII Net Cash Flows</span>
              </button>

              <button
                onClick={() => setActiveTab('sectors')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'sectors' ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                <span>Sectoral Heatmap (7 Sectors)</span>
              </button>
            </div>

            <button
              onClick={handleAskAIMacroStrategist}
              disabled={isAiLoading}
              className="px-3 py-1.5 rounded-lg bg-teal-950/60 border border-teal-700/70 hover:bg-teal-900/70 text-teal-300 font-semibold flex items-center gap-1.5"
            >
              <Brain className="h-3.5 w-3.5" />
              {isAiLoading ? 'Synthesizing Flows...' : 'AI Macro Brief'}
            </button>
          </div>

          {/* TAB 1: ADVANCE / DECLINE BREADTH */}
          {activeTab === 'breadth' && (
            <div className="space-y-4">
              {/* Breadth Score Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">A/D Ratio</span>
                  <span className="text-xl font-bold font-mono text-teal-400">{breadth.ratio}</span>
                  <span className="text-[10px] text-slate-400 block font-sans">
                    {breadth.advances} Advancing vs {breadth.declines} Declining
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Breadth Verdict</span>
                  <span className="text-sm font-bold px-2 py-0.5 rounded inline-block bg-teal-950 border border-teal-800 text-teal-300 mt-0.5">
                    {breadth.sentiment}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Advancing Stocks</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">{breadth.advancePercent}%</span>
                  <span className="text-[10px] text-slate-400 block font-sans">{breadth.advances} of 50 Nifty Constituents</span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Declining Stocks</span>
                  <span className="text-xl font-bold font-mono text-rose-400">{breadth.declinePercent}%</span>
                  <span className="text-[10px] text-slate-400 block font-sans">{breadth.declines} of 50 Nifty Constituents</span>
                </div>
              </div>

              {/* Visual 3-Way Segmented Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-300 font-semibold">
                  <span className="text-emerald-400">Advancing: {breadth.advances} ({breadth.advancePercent}%)</span>
                  <span className="text-slate-400">Unchanged: {breadth.unchanged}</span>
                  <span className="text-rose-400">Declining: {breadth.declines} ({breadth.declinePercent}%)</span>
                </div>
                <div className="w-full bg-slate-900 h-3.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${breadth.advancePercent}%` }}
                    title={`Advancing: ${breadth.advances}`}
                  />
                  <div
                    className="bg-slate-600 h-full transition-all duration-300"
                    style={{ width: `${breadth.unchangedPercent}%` }}
                    title={`Unchanged: ${breadth.unchanged}`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all duration-300"
                    style={{ width: `${breadth.declinePercent}%` }}
                    title={`Declining: ${breadth.declines}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FII / DII INSTITUTIONAL FLOWS */}
          {activeTab === 'fiidii' && (
            <div className="space-y-4">
              {/* Today's Net Overview Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">FII Net Cash (Today)</span>
                  <span className={`text-base font-bold font-mono ${fiiDii[0].fiiNetCashCr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fiiDii[0].fiiNetCashCr >= 0 ? '+' : ''}₹{fiiDii[0].fiiNetCashCr.toLocaleString('en-IN')} Cr
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans">Foreign Institutional Net</span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">DII Net Cash (Today)</span>
                  <span className={`text-base font-bold font-mono ${fiiDii[0].diiNetCashCr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    +₹{fiiDii[0].diiNetCashCr.toLocaleString('en-IN')} Cr
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans">Domestic Mutual Funds</span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Total Net Liquidity</span>
                  <span className="text-base font-bold font-mono text-teal-400">
                    +₹{fiiDii[0].netInstitutionalFlowCr.toLocaleString('en-IN')} Cr
                  </span>
                  <span className="text-[10px] text-emerald-400 block font-sans">Institutional Inflow</span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">FII Futures Long Ratio</span>
                  <span className="text-base font-bold font-mono text-blue-400">
                    {(fiiDii[0].fiiIndexFuturesLongRatio * 100).toFixed(0)}% Long
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans">Index Derivatives Bias</span>
                </div>
              </div>

              {/* 5-Day Historical Flow Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-slate-950 text-slate-400 text-[10px]">
                    <tr>
                      <th className="p-3">Session Date</th>
                      <th className="p-3">FII Net Cash (₹ Cr)</th>
                      <th className="p-3">DII Net Cash (₹ Cr)</th>
                      <th className="p-3">Combined Net (₹ Cr)</th>
                      <th className="p-3 text-right">FII Futures Bias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                    {fiiDii.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-900/40">
                        <td className="p-3 font-bold text-slate-100 font-sans">{f.date}</td>
                        <td className={`p-3 font-semibold ${f.fiiNetCashCr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {f.fiiNetCashCr >= 0 ? '+' : ''}₹{f.fiiNetCashCr.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-emerald-400 font-semibold">
                          +₹{f.diiNetCashCr.toLocaleString('en-IN')}
                        </td>
                        <td className={`p-3 font-bold ${f.netInstitutionalFlowCr >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                          {f.netInstitutionalFlowCr >= 0 ? '+' : ''}₹{f.netInstitutionalFlowCr.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-blue-400">
                          {(f.fiiIndexFuturesLongRatio * 100).toFixed(0)}% Long
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SECTORAL HEATMAP */}
          {activeTab === 'sectors' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sectors.map((sec) => (
                <div
                  key={sec.indexSymbol}
                  className={`p-3.5 rounded-xl border transition space-y-1.5 ${
                    sec.changePercent >= 0
                      ? 'bg-emerald-950/20 border-emerald-800/50 hover:bg-emerald-950/40'
                      : 'bg-rose-950/20 border-rose-800/50 hover:bg-rose-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-xs font-sans">{sec.sectorName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      sec.changePercent >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                    }`}>
                      {sec.changePercent >= 0 ? '+' : ''}{sec.changePercent}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">{sec.indexSymbol}</span>
                  <div className="text-[10px] space-y-0.5 pt-1 border-t border-slate-800/60 font-mono">
                    <div className="flex justify-between text-emerald-400">
                      <span className="text-slate-500 font-sans">Top Gainer:</span>
                      <span>{sec.topGainer}</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span className="text-slate-500 font-sans">Top Drag:</span>
                      <span>{sec.topLoser}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Macro Strategist Feedback */}
          {aiMacroAnalysis && (
            <div className="p-3.5 bg-teal-950/40 border border-teal-800/80 rounded-xl text-slate-200 leading-relaxed flex items-start gap-2.5">
              <Brain className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-teal-300 block mb-1 font-sans">AI Institutional Macro Brief:</strong>
                <p className="whitespace-pre-line text-[11px] text-slate-300 leading-relaxed">{aiMacroAnalysis}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
