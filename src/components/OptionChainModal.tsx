'use client';

import React, { useState } from 'react';
import { calculateStrategyPayoff, generateOptionChain, getStrategyTemplates, OptionLeg, OptionStrikeData, StrategyPayoffResult } from '../lib/optionsEngine';
import { AIConfig } from '../types/trading';
import { queryAIProvider } from '../lib/aiProvider';
import { AlertCircle, Brain, CheckCircle2, ChevronRight, Layers, Play, Plus, ShieldCheck, TrendingDown, TrendingUp, X, Zap } from 'lucide-react';

interface OptionChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotPrice: number;
  symbol: string;
  aiConfig: AIConfig;
  onExecuteStrategy: (legs: OptionLeg[], result: StrategyPayoffResult) => void;
}

export const OptionChainModal: React.FC<OptionChainModalProps> = ({
  isOpen,
  onClose,
  spotPrice,
  symbol,
  aiConfig,
  onExecuteStrategy,
}) => {
  const [selectedExpiryDays, setSelectedExpiryDays] = useState(4);
  const [legs, setLegs] = useState<OptionLeg[]>([]);
  const [strategyName, setStrategyName] = useState('Custom Multi-Leg');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const chain = generateOptionChain(symbol, spotPrice, selectedExpiryDays);
  const payoff = calculateStrategyPayoff(strategyName, legs, spotPrice, symbol === 'BANKNIFTY' ? 15 : 25);
  const templates = getStrategyTemplates(spotPrice, symbol === 'BANKNIFTY' ? 100 : 50);

  if (!isOpen) return null;

  const handleAddLeg = (strike: number, optionType: 'CE' | 'PE', side: 'BUY' | 'SELL', price: number, greeks: any) => {
    const newLeg: OptionLeg = {
      id: `leg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      strike,
      optionType,
      side,
      quantity: 1,
      premium: price,
      greeks,
    };
    setLegs([...legs, newLeg]);
  };

  const handleRemoveLeg = (id: string) => {
    setLegs(legs.filter(l => l.id !== id));
  };

  const handleApplyTemplate = (tmpl: any) => {
    setStrategyName(tmpl.name);
    setLegs(tmpl.generateLegs());
    setAiAnalysis(null);
  };

  const handleAskAIOptionsArchitect = async () => {
    if (legs.length === 0) return;
    setIsAiAnalyzing(true);
    setAiAnalysis(null);

    const prompt = `Review this Indian Index (${symbol}) Options Strategy:
Strategy Name: ${strategyName}
Legs: ${legs.map(l => `${l.side} ${l.quantity}x ${l.strike} ${l.optionType} @ ₹${l.premium}`).join(', ')}
Greeks: Net Delta: ${payoff.netDelta}, Net Theta: ₹${payoff.netTheta}/day, Net Vega: ${payoff.netVega}
Max Profit: ₹${payoff.maxProfit}, Max Loss: ₹${payoff.maxLoss}, Breakevens: ${payoff.breakevens.join(', ')}

Provide an institutional risk assessment in 3 sentences:
1. Is this position risk-defined or uncapped?
2. What is the impact of Theta (time decay) and Volatility (Vega)?
3. Recommended risk management adjustment.`;

    try {
      if (!aiConfig.geminiKey && !aiConfig.openaiKey && aiConfig.provider !== 'ollama') {
        setTimeout(() => {
          setAiAnalysis(
            `[Heuristic Risk Review] Strategy has ${legs.length} legs. Net Theta is ${payoff.netTheta >= 0 ? '+' : ''}₹${payoff.netTheta}/day (${payoff.netTheta >= 0 ? 'Time is on your side' : 'Time decay is working against you'}). To enable deep BYOK neural analysis, please configure your Gemini API Key in BYOK settings.`
          );
          setIsAiAnalyzing(false);
        }, 500);
        return;
      }

      const res = await queryAIProvider(
        aiConfig,
        prompt,
        'You are a senior institutional derivatives risk manager for Indian equity indices (NIFTY 50 and BANKNIFTY).'
      );
      setAiAnalysis(res);
    } catch (err: any) {
      setAiAnalysis(`Error: ${err.message}`);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F141F] border border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col text-xs max-h-[95vh]">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-800 bg-[#0B0E14] gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">{symbol} Derivatives & Option Chain</h2>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">
                  Spot: ₹{spotPrice}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Black-Scholes analytical Greeks • Multi-leg Payoff Simulation</p>
            </div>
          </div>

          {/* Quick Strategy Templates */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 text-[10px] hidden sm:inline">Templates:</span>
            {templates.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => handleApplyTemplate(tmpl)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] font-medium transition"
              >
                {tmpl.name.split(' (')[0]}
              </button>
            ))}
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 ml-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Option Chain Table Grid */}
        <div className="flex-1 overflow-auto p-3">
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-center font-mono text-[11px]">
              <thead className="bg-slate-950 text-slate-400 text-[10px] sticky top-0 border-b border-slate-800">
                <tr>
                  <th colSpan={5} className="py-2 text-emerald-400 bg-emerald-950/20 border-r border-slate-800">
                    CALLS (CE)
                  </th>
                  <th className="py-2 bg-slate-900 text-slate-200">STRIKE</th>
                  <th colSpan={5} className="py-2 text-rose-400 bg-rose-950/20 border-l border-slate-800">
                    PUTS (PE)
                  </th>
                </tr>
                <tr className="border-t border-slate-800/80 text-[10px] text-slate-400">
                  <th className="p-1.5">OI</th>
                  <th className="p-1.5">IV%</th>
                  <th className="p-1.5">Delta</th>
                  <th className="p-1.5">LTP</th>
                  <th className="p-1.5 border-r border-slate-800">Action</th>
                  <th className="p-1.5 bg-slate-900 text-slate-300">Price</th>
                  <th className="p-1.5 border-l border-slate-800">Action</th>
                  <th className="p-1.5">LTP</th>
                  <th className="p-1.5">Delta</th>
                  <th className="p-1.5">IV%</th>
                  <th className="p-1.5">OI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                {chain.map((row) => (
                  <tr
                    key={row.strike}
                    className={`hover:bg-slate-900/60 transition ${
                      row.isATM ? 'bg-blue-950/30 font-bold' : ''
                    }`}
                  >
                    {/* Call Side */}
                    <td className={`p-1.5 text-slate-400 ${row.isITMCall ? 'bg-amber-950/10' : ''}`}>
                      {(row.callOI / 100000).toFixed(1)}L
                    </td>
                    <td className="p-1.5 text-slate-400">{row.callIV}%</td>
                    <td className="p-1.5 text-emerald-400">{row.callGreeks.delta}</td>
                    <td className="p-1.5 font-bold text-slate-100">₹{row.callPrice}</td>
                    <td className="p-1.5 border-r border-slate-800 flex justify-center gap-1">
                      <button
                        onClick={() => handleAddLeg(row.strike, 'CE', 'BUY', row.callPrice, row.callGreeks)}
                        className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-400 hover:bg-emerald-900/60 text-[9px] font-bold"
                      >
                        +B
                      </button>
                      <button
                        onClick={() => handleAddLeg(row.strike, 'CE', 'SELL', row.callPrice, row.callGreeks)}
                        className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-700/60 text-rose-400 hover:bg-rose-900/60 text-[9px] font-bold"
                      >
                        +S
                      </button>
                    </td>

                    {/* Center Strike */}
                    <td className={`p-1.5 font-bold text-center ${row.isATM ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-200'}`}>
                      {row.strike} {row.isATM && <span className="text-[9px] ml-1 opacity-90">(ATM)</span>}
                    </td>

                    {/* Put Side */}
                    <td className="p-1.5 border-l border-slate-800 flex justify-center gap-1">
                      <button
                        onClick={() => handleAddLeg(row.strike, 'PE', 'BUY', row.putPrice, row.putGreeks)}
                        className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-400 hover:bg-emerald-900/60 text-[9px] font-bold"
                      >
                        +B
                      </button>
                      <button
                        onClick={() => handleAddLeg(row.strike, 'PE', 'SELL', row.putPrice, row.putGreeks)}
                        className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-700/60 text-rose-400 hover:bg-rose-900/60 text-[9px] font-bold"
                      >
                        +S
                      </button>
                    </td>
                    <td className="p-1.5 font-bold text-slate-100">₹{row.putPrice}</td>
                    <td className="p-1.5 text-rose-400">{row.putGreeks.delta}</td>
                    <td className="p-1.5 text-slate-400">{row.putIV}%</td>
                    <td className={`p-1.5 text-slate-400 ${row.isITMPut ? 'bg-amber-950/10' : ''}`}>
                      {(row.putOI / 100000).toFixed(1)}L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Multi-Leg Strategy Payoff Dashboard */}
        <div className="bg-[#0B0E14] border-t border-slate-800 p-4 space-y-3">
          {/* Active Legs Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-300">Selected Strategy Legs ({legs.length}):</span>
              {legs.length === 0 ? (
                <span className="text-slate-500 italic">Click +B or +S on any strike to build a multi-leg spread</span>
              ) : (
                legs.map((leg) => (
                  <span
                    key={leg.id}
                    className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-mono text-[11px] ${
                      leg.side === 'BUY'
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                    }`}
                  >
                    <strong>{leg.side}</strong> {leg.strike} {leg.optionType} @ ₹{leg.premium}
                    <button onClick={() => handleRemoveLeg(leg.id)} className="text-slate-400 hover:text-slate-100">
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            {legs.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleAskAIOptionsArchitect}
                  disabled={isAiAnalyzing}
                  className="px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-700/70 hover:bg-indigo-900/70 text-indigo-300 font-semibold flex items-center gap-1.5"
                >
                  <Brain className="h-3.5 w-3.5" />
                  {isAiAnalyzing ? 'Analyzing...' : 'AI Risk Audit'}
                </button>
                <button
                  onClick={() => onExecuteStrategy(legs, payoff)}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  Execute Strategy
                </button>
              </div>
            )}
          </div>

          {/* Strategy Risk Metrics Cards */}
          {legs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-[11px]">
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-sans">Max Profit</span>
                <span className="font-bold text-emerald-400">
                  {payoff.maxProfit === 'Unlimited' ? 'Unlimited' : `₹${payoff.maxProfit}`}
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-sans">Max Loss</span>
                <span className="font-bold text-rose-400">
                  {payoff.maxLoss === 'Unlimited' ? 'Unlimited' : `₹${payoff.maxLoss}`}
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-sans">Breakevens</span>
                <span className="font-bold text-slate-200">
                  {payoff.breakevens.length ? payoff.breakevens.join(', ') : 'None'}
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-sans">Net Delta</span>
                <span className="font-bold text-blue-400">{payoff.netDelta}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-sans">Net Theta (Daily)</span>
                <span className={`font-bold ${payoff.netTheta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {payoff.netTheta >= 0 ? '+' : ''}₹{payoff.netTheta}/day
                </span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-sans">Est. Options Taxes</span>
                <span className="font-bold text-amber-400">₹{payoff.totalStatutoryTaxes}</span>
              </div>
            </div>
          )}

          {/* AI Options Risk Architect Feedback */}
          {aiAnalysis && (
            <div className="p-3 bg-indigo-950/40 border border-indigo-800/80 rounded-xl text-slate-200 leading-relaxed flex items-start gap-2.5">
              <Brain className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-indigo-300 block mb-0.5 font-sans">AI Options Risk Architect Review:</strong>
                <p className="whitespace-pre-line text-[11px] text-slate-300">{aiAnalysis}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
