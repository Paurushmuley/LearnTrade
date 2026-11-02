'use client';

import React from 'react';
import { AIConfig, PortfolioSummary } from '../types/trading';
import { Activity, Brain, Key, Layers, RefreshCw, ShieldAlert, TrendingUp, Zap } from 'lucide-react';

interface HeaderProps {
  portfolio: PortfolioSummary;
  aiConfig: AIConfig;
  onOpenOptions: () => void;
  onOpenBYOK: () => void;
  onOpenStrategy: () => void;
  onOpenCrisis: () => void;
  onResetAccount: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  portfolio,
  aiConfig,
  onOpenOptions,
  onOpenBYOK,
  onOpenStrategy,
  onOpenCrisis,
  onResetAccount,
}) => {
  const isAIActive = Boolean(aiConfig.geminiKey || aiConfig.openaiKey || aiConfig.provider === 'ollama');

  const getPqColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    if (score >= 60) return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
    return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
  };

  return (
    <header className="border-b border-slate-800/80 bg-[#0F141F]/90 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
      {/* Brand & Market Status */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent">
              TradeCraft AI
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
              BYOK v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            NSE Live Sandbox • Taxes & Charges Active
          </p>
        </div>
      </div>

      {/* Portfolio Financial Ticker */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-xl">
        <div>
          <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Available Cash</span>
          <span className="font-semibold text-slate-100">₹{portfolio.availableCash.toLocaleString('en-IN')}</span>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        <div>
          <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Used Margin</span>
          <span className="font-semibold text-slate-300">₹{portfolio.usedMargin.toLocaleString('en-IN')}</span>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        <div>
          <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Realized P&L</span>
          <span className={`font-semibold ${portfolio.totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {portfolio.totalRealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalRealizedPnL.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        <div>
          <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Unrealized P&L</span>
          <span className={`font-semibold ${portfolio.totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalUnrealizedPnL.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        <div>
          <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Net Charges Paid</span>
          <span className="font-semibold text-amber-400/90">-₹{portfolio.totalChargesDeducted.toLocaleString('en-IN')}</span>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        {/* Discipline Score (PQ) */}
        <div className="flex items-center gap-1.5">
          <div>
            <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Discipline (PQ)</span>
            <div className={`px-2 py-0.5 rounded-full border text-[11px] font-bold flex items-center gap-1 ${getPqColor(portfolio.disciplineScore)}`}>
              <Activity className="h-3 w-3" />
              <span>{portfolio.disciplineScore}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {/* Options Chain (F&O) */}
        <button
          onClick={onOpenOptions}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 text-xs font-semibold text-emerald-300 border border-emerald-800/60 transition shadow-sm"
          title="Live Option Chain, Greeks & Multi-Leg Strategy Payoff Visualizer"
        >
          <Layers className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Option Chain (F&O)</span>
        </button>

        {/* Strategy Backtester */}
        <button
          onClick={onOpenStrategy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/80 text-xs font-medium text-slate-200 border border-slate-700 transition"
          title="Natural Language Strategy Builder & Historical Backtester"
        >
          <Zap className="h-3.5 w-3.5 text-blue-400" />
          <span className="hidden md:inline">Strategy Builder</span>
        </button>

        {/* Crisis Simulator */}
        <button
          onClick={onOpenCrisis}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/80 text-xs font-medium text-slate-200 border border-slate-700 transition"
          title="Historical Market Crisis Replay Simulator"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden md:inline">Crisis Replay</span>
        </button>

        {/* BYOK Settings Key Modal */}
        <button
          onClick={onOpenBYOK}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isAIActive
              ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/40'
              : 'bg-indigo-950/40 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/50'
          }`}
          title="Configure your personal Gemini / OpenAI / Ollama Key"
        >
          <Key className="h-3.5 w-3.5" />
          <span>{isAIActive ? 'AI Coach Active' : 'Setup BYOK Key'}</span>
        </button>

        {/* Reset Virtual Sandbox */}
        <button
          onClick={onResetAccount}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
          title="Reset Virtual Sandbox to ₹10,00,000"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
