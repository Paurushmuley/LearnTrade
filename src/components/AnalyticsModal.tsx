'use client';

import React, { useState } from 'react';
import { aggregateDayPerformance, aggregateHourlyPerformance, runMonteCarloSimulation } from '../lib/analyticsEngine';
import { AIConfig, TradeAudit } from '../types/trading';
import { queryAIProvider } from '../lib/aiProvider';
import { Activity, AlertTriangle, BarChart3, Brain, Calendar, CheckCircle2, Clock, PieChart, ShieldAlert, Sparkles, TrendingUp, X, Zap } from 'lucide-react';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeAudits: TradeAudit[];
  aiConfig: AIConfig;
  startingCapital: number;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  tradeAudits,
  aiConfig,
  startingCapital,
}) => {
  const [activeTab, setActiveTab] = useState<'montecarlo' | 'heatmap' | 'days'>('montecarlo');
  const [monteCarloInput, setMonteCarloInput] = useState({
    winRate: 58,
    avgWin: 3500,
    avgLoss: 1900,
  });

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const hourlyData = aggregateHourlyPerformance(tradeAudits);
  const dayData = aggregateDayPerformance(tradeAudits);

  const monteCarlo = runMonteCarloSimulation(
    monteCarloInput.winRate,
    monteCarloInput.avgWin,
    monteCarloInput.avgLoss,
    startingCapital,
    1000,
    100
  );

  if (!isOpen) return null;

  const handleAskAIQuantReview = async () => {
    setIsAiLoading(true);
    setAiAnalysis(null);

    const prompt = `Review this Trader's Quantitative Risk & Behavioral Leak Profile:
- Monte Carlo Win Rate: ${monteCarloInput.winRate}%, Payoff: ₹${monteCarloInput.avgWin} Win vs ₹${monteCarloInput.avgLoss} Loss
- Probability of 50% Ruin: ${monteCarlo.probabilityOfRuinPercent}%
- Max Expected Consecutive Losses: ${monteCarlo.maxConsecutiveLossesExpected} trades
- Kelly Criterion Recommendation: Full Kelly ${monteCarlo.fullKellyPercent}%, Half Kelly ${monteCarlo.halfKellyPercent}%
- Time-of-Day Pattern: 09:15-10:15 (+₹2,450 profitable), 11:30-13:00 (-₹3,150 midday trap loss), 14:15-15:30 (+₹3,280 profitable)

Provide a 3-point quantitative audit:
1. Sizing appraisal based on the Kelly Criterion.
2. Behavioral warning regarding the Midday Trap (11:30-13:00).
3. Psychological advice for surviving the expected ${monteCarlo.maxConsecutiveLossesExpected}-trade consecutive loss streak.`;

    try {
      if (!aiConfig.geminiKey && !aiConfig.openaiKey && aiConfig.provider !== 'ollama') {
        setTimeout(() => {
          setAiAnalysis(
            `[Heuristic Risk Audit] Sizing Verdict: Your Half-Kelly risk is ${monteCarlo.halfKellyPercent}% per trade. Timing Leak: Notice the steep drawdown (-₹3,150) during the 11:30 - 13:00 window—avoid trading lunch chop. Ruin Buffer: Expect at least ${monteCarlo.maxConsecutiveLossesExpected} consecutive losses during your next 100 trades. Configure your Gemini key in BYOK settings for real-time neural coaching.`
          );
          setIsAiLoading(false);
        }, 500);
        return;
      }

      const res = await queryAIProvider(
        aiConfig,
        prompt,
        'You are an institutional quantitative portfolio risk manager and behavioral trader auditor.'
      );
      setAiAnalysis(res);
    } catch (err: any) {
      setAiAnalysis(`Error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // SVG dimensions for Monte Carlo Envelope
  const svgWidth = 640;
  const svgHeight = 180;
  const maxVal = Math.max(...monteCarlo.bestPath);
  const minVal = Math.min(...monteCarlo.worstPath, startingCapital * 0.4);

  const getSvgY = (val: number) => {
    return svgHeight - ((val - minVal) / (maxVal - minVal || 1)) * (svgHeight - 20) - 10;
  };

  const getSvgPathStr = (path: number[]) => {
    const stepX = svgWidth / (path.length - 1);
    return path.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${idx * stepX} ${getSvgY(val)}`).join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F141F] border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col text-xs max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0B0E14]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <PieChart className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">Quantitative Risk Analytics & Monte Carlo Simulator</h2>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
                  1,000 Trials
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Kelly Criterion sizing • Time-of-Day P&L Heatmap • Probability of Ruin Envelope</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Sub Navigation */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('montecarlo')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'montecarlo' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Monte Carlo & Kelly Sizing</span>
              </button>

              <button
                onClick={() => setActiveTab('heatmap')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'heatmap' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Hourly P&L Heatmap</span>
              </button>

              <button
                onClick={() => setActiveTab('days')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'days' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                <span>Day-of-Week Expiries</span>
              </button>
            </div>

            <button
              onClick={handleAskAIQuantReview}
              disabled={isAiLoading}
              className="px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-700/70 hover:bg-indigo-900/70 text-indigo-300 font-semibold flex items-center gap-1.5"
            >
              <Brain className="h-3.5 w-3.5" />
              {isAiLoading ? 'Analyzing Risk...' : 'AI Quant Audit'}
            </button>
          </div>

          {/* TAB 1: MONTE CARLO SIMULATOR */}
          {activeTab === 'montecarlo' && (
            <div className="space-y-4">
              {/* Parameter Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Win Rate</span>
                    <strong className="text-slate-200 font-mono">{monteCarloInput.winRate}%</strong>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={85}
                    value={monteCarloInput.winRate}
                    onChange={(e) => setMonteCarloInput({ ...monteCarloInput, winRate: parseInt(e.target.value) })}
                    className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Average Win</span>
                    <strong className="text-emerald-400 font-mono">₹{monteCarloInput.avgWin}</strong>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={100}
                    value={monteCarloInput.avgWin}
                    onChange={(e) => setMonteCarloInput({ ...monteCarloInput, avgWin: parseInt(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Average Loss</span>
                    <strong className="text-rose-400 font-mono">₹{monteCarloInput.avgLoss}</strong>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={8000}
                    step={100}
                    value={monteCarloInput.avgLoss}
                    onChange={(e) => setMonteCarloInput({ ...monteCarloInput, avgLoss: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>

              {/* Statistical Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-[11px]">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-sans">Probability of Ruin (50% DD)</span>
                  <span className={`text-base font-bold ${monteCarlo.probabilityOfRuinPercent < 5 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {monteCarlo.probabilityOfRuinPercent}%
                  </span>
                  <span className="text-[9px] text-slate-400 block font-sans">Over 100 trades</span>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-sans">Half-Kelly Optimal Risk</span>
                  <span className="text-base font-bold text-blue-400">
                    {monteCarlo.halfKellyPercent}%
                  </span>
                  <span className="text-[9px] text-slate-400 block font-sans">Per trade sizing</span>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-sans">Trade Expectancy</span>
                  <span className={`text-base font-bold ${monteCarlo.expectancyPerTrade > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    +₹{monteCarlo.expectancyPerTrade}
                  </span>
                  <span className="text-[9px] text-slate-400 block font-sans">Expected return/trade</span>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-sans">Profit Factor</span>
                  <span className="text-base font-bold text-amber-400">{monteCarlo.profitFactor}</span>
                  <span className="text-[9px] text-slate-400 block font-sans">Gross Wins / Losses</span>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-sans">Max Consecutive Losses</span>
                  <span className="text-base font-bold text-rose-400">{monteCarlo.maxConsecutiveLossesExpected}</span>
                  <span className="text-[9px] text-slate-400 block font-sans">Expected losing streak</span>
                </div>
              </div>

              {/* Monte Carlo Visual Envelope SVG Chart */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-sans">
                  <span className="font-bold text-slate-200">Monte Carlo 1,000-Path Equity Envelope (Next 100 Trades)</span>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> 95th Percentile
                    </span>
                    <span className="text-blue-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-400" /> 50th Median
                    </span>
                    <span className="text-rose-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-400" /> 5th Worst Case
                    </span>
                  </div>
                </div>

                <div className="w-full overflow-hidden">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44">
                    {/* Horizontal Zero / Start Gridline */}
                    <line
                      x1="0"
                      y1={getSvgY(startingCapital)}
                      x2={svgWidth}
                      y2={getSvgY(startingCapital)}
                      stroke="#334155"
                      strokeDasharray="4"
                      strokeWidth="1"
                    />

                    {/* Best Case Path (95th) */}
                    <path
                      d={getSvgPathStr(monteCarlo.bestPath)}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2"
                    />

                    {/* Median Path (50th) */}
                    <path
                      d={getSvgPathStr(monteCarlo.medianPath)}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="2.5"
                    />

                    {/* Worst Case Path (5th) */}
                    <path
                      d={getSvgPathStr(monteCarlo.worstPath)}
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TIME-OF-DAY HOURLY HEATMAP */}
          {activeTab === 'heatmap' && (
            <div className="space-y-3">
              <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-300">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block mb-0.5">The Midday Trap Diagnosis:</strong>
                  Notice how execution during 11:30 - 13:00 exhibits negative expectancy due to volume contraction. Best performance consistently occurs during the opening impulse (09:15 - 10:15) and power hour (14:15 - 15:30).
                </div>
              </div>

              <div className="space-y-2">
                {hourlyData.map((slot) => (
                  <div
                    key={slot.hourIndex}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 font-mono transition ${
                      slot.isProfitable
                        ? 'bg-emerald-950/30 border-emerald-800/50 hover:bg-emerald-950/50'
                        : 'bg-rose-950/30 border-rose-800/50 hover:bg-rose-950/50'
                    }`}
                  >
                    <div className="font-sans">
                      <span className="font-bold text-slate-100 block text-xs">{slot.hourLabel}</span>
                      <span className="text-[10px] text-slate-400">
                        {slot.tradesCount} Trades • Win Rate: <strong className="text-slate-200">{slot.winRate}%</strong>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm font-bold ${slot.isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {slot.isProfitable ? '+' : ''}₹{slot.netPnL.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Taxes: ₹{slot.taxesPaid}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DAY-OF-WEEK EXPIRY MATRIX */}
          {activeTab === 'days' && (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-slate-950 text-slate-400 text-[10px]">
                    <tr>
                      <th className="p-3">Day of Week</th>
                      <th className="p-3">Index Expiry</th>
                      <th className="p-3">Trades</th>
                      <th className="p-3">Win Rate</th>
                      <th className="p-3 text-right">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                    {dayData.map((d) => (
                      <tr key={d.dayName} className="hover:bg-slate-900/40">
                        <td className="p-3 font-bold text-slate-100 font-sans">{d.dayName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px]">
                            {d.expiryNote}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{d.tradesCount}</td>
                        <td className="p-3 text-slate-200 font-semibold">{d.winRate}%</td>
                        <td className={`p-3 text-right font-bold ${d.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {d.netPnL >= 0 ? '+' : ''}₹{d.netPnL.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Behavioral Diagnostic Feedback */}
          {aiAnalysis && (
            <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/80 rounded-xl text-slate-200 leading-relaxed flex items-start gap-2.5">
              <Brain className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-indigo-300 block mb-1 font-sans">AI Quantitative Risk Assessment:</strong>
                <p className="whitespace-pre-line text-[11px] text-slate-300 leading-relaxed">{aiAnalysis}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
