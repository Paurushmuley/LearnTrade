'use client';

import React from 'react';
import { AIConfig, PortfolioSummary } from '../types/trading';
import { UserProfile } from '../types/user';
import { Activity, BarChart3, Brain, Cpu, Crosshair, FileSpreadsheet, Globe2, Home, Key, Layers, RefreshCw, RotateCcw, Scale, Share2, ShieldAlert, TrendingUp, Trophy, User, Zap } from 'lucide-react';

interface HeaderProps {
  portfolio: PortfolioSummary;
  aiConfig: AIConfig;
  currentUser: UserProfile;
  isReplayActive: boolean;
  onToggleReplay: () => void;
  onOpenOptions: () => void;
  onOpenWebhookBot: () => void;
  onOpenAnalytics: () => void;
  onOpenBreadth: () => void;
  onOpenTradebook: () => void;
  onOpenScreener: () => void;
  onOpenLeagues: () => void;
  onOpenQuantDesk: () => void;
  onOpenCopier: () => void;
  onOpenGreeksHedger: () => void;
  onOpenVolOptimizer?: () => void;
  onOpenBYOK: () => void;
  onOpenStrategy: () => void;
  onOpenCrisis: () => void;
  onResetAccount: () => void;
  onOpenProfile: () => void;
  onOpenLanding: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  portfolio,
  aiConfig,
  currentUser,
  isReplayActive,
  onToggleReplay,
  onOpenOptions,
  onOpenWebhookBot,
  onOpenAnalytics,
  onOpenBreadth,
  onOpenTradebook,
  onOpenScreener,
  onOpenLeagues,
  onOpenQuantDesk,
  onOpenCopier,
  onOpenGreeksHedger,
  onOpenVolOptimizer,
  onOpenBYOK,
  onOpenStrategy,
  onOpenCrisis,
  onResetAccount,
  onOpenProfile,
  onOpenLanding,
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
        <button
          onClick={onOpenLanding}
          className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:scale-105 transition"
          title="View Landing Page & Platform Overview"
        >
          <TrendingUp className="h-5 w-5 text-white" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span
              onClick={onOpenLanding}
              className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent cursor-pointer hover:opacity-90"
              title="View Landing Page"
            >
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

        <button
          onClick={onOpenLanding}
          className="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-white transition ml-1"
          title="Return to TradeCraft AI Overview & Landing Page"
        >
          <Home className="h-3 w-3 text-blue-400" />
          <span>About Platform</span>
        </button>
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
        {/* Bar Replay Mode Toggle */}
        <button
          onClick={onToggleReplay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
            isReplayActive
              ? 'bg-blue-600 border-blue-500 text-white shadow-blue-900/30'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
          title="Toggle Tick-by-Tick Bar Replay Simulation"
        >
          <RotateCcw className="h-3.5 w-3.5 text-blue-400" />
          <span className="hidden sm:inline">{isReplayActive ? 'Replay Active' : 'Bar Replay'}</span>
        </button>

        {/* Options Chain (F&O) */}
        <button
          onClick={onOpenOptions}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 text-xs font-semibold text-emerald-300 border border-emerald-800/60 transition shadow-sm"
          title="Live Option Chain, Greeks & Multi-Leg Strategy Payoff Visualizer"
        >
          <Layers className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Option Chain (F&O)</span>
        </button>

        {/* Algo Webhooks */}
        <button
          onClick={onOpenWebhookBot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/40 text-xs font-semibold text-indigo-300 border border-indigo-800/60 transition shadow-sm"
          title="TradingView Webhook Gateway & Automated Bot Manager"
        >
          <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden md:inline">Algo Webhooks</span>
        </button>

        {/* Quant Analytics */}
        <button
          onClick={onOpenAnalytics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/80 text-xs font-medium text-slate-200 border border-slate-700 transition"
          title="Monte Carlo Ruin Simulator & Hourly P&L Heatmap"
        >
          <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden md:inline">Quant Analytics</span>
        </button>

        {/* Market Breadth & FII/DII */}
        <button
          onClick={onOpenBreadth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/40 hover:bg-teal-900/40 text-xs font-semibold text-teal-300 border border-teal-800/60 transition shadow-sm"
          title="NSE Market Breadth, FII/DII Net Institutional Flows & Sectoral Heatmap"
        >
          <Globe2 className="h-3.5 w-3.5 text-teal-400" />
          <span className="hidden md:inline">Market Breadth</span>
        </button>

        {/* Broker Tradebook Importer & AI Auditor */}
        <button
          onClick={onOpenTradebook}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/40 text-xs font-semibold text-purple-300 border border-purple-800/60 transition shadow-sm"
          title="Import Zerodha/Groww Tradebook & Run Psychological AI Bias Audit"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-purple-400" />
          <span className="hidden md:inline">Trade Importer</span>
        </button>

        {/* Multi-Factor Technical Screener & Stock Scanner */}
        <button
          onClick={onOpenScreener}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/50 hover:bg-teal-900/50 text-xs font-semibold text-teal-300 border border-teal-800/60 transition shadow-sm"
          title="Multi-Factor Technical Screener: Volume Surges, EMAs, RSI, VWAP & ORB"
        >
          <Crosshair className="h-3.5 w-3.5 text-teal-400" />
          <span className="hidden md:inline">Screener</span>
        </button>

        {/* Social Trading Leagues & Cryptographic Proof-of-Alpha */}
        <button
          onClick={onOpenLeagues}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-xs font-semibold text-amber-300 border border-amber-800/60 transition shadow-sm"
          title="Social Paper Trading Leagues, Sortino Alpha Leaderboards & Proof-of-Alpha Verifier"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden md:inline">Leagues & PoA</span>
        </button>

        {/* Autonomous AI Quant Desk War Room */}
        <button
          onClick={onOpenQuantDesk}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 text-xs font-semibold text-cyan-300 border border-cyan-800/60 transition shadow-sm"
          title="Autonomous AI Quant Desk: Multi-Agent Virtual Hedge Fund War Room (Macro, Alpha, Risk, Algorist)"
        >
          <Brain className="h-3.5 w-3.5 text-cyan-400" />
          <span className="hidden md:inline">Quant Desk</span>
        </button>

        {/* Institutional Trade Copier & Cross-Account Multi-Broker Bridge */}
        <button
          onClick={onOpenCopier}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 text-xs font-semibold text-indigo-300 border border-indigo-800/60 transition shadow-sm"
          title="Institutional Trade Copier & Cross-Account Multi-Broker Bridge (Zerodha, Groww, Upstox)"
        >
          <Share2 className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden md:inline">Trade Copier</span>
        </button>

        {/* Dynamic Options Greeks Hedger & Delta-Gamma Autobalancer */}
        <button
          onClick={onOpenGreeksHedger}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 text-xs font-semibold text-cyan-300 border border-cyan-800/60 transition shadow-sm"
          title="Dynamic Options Greeks Hedger & Delta-Gamma Autobalancer (Greeks Radar & Curvature Payoff)"
        >
          <Scale className="h-3.5 w-3.5 text-cyan-400" />
          <span className="hidden md:inline">Delta Hedger</span>
        </button>

        {/* Options Strategy Payoff Optimizer & Volatility Surface Calibrator */}
        {onOpenVolOptimizer && (
          <button
            onClick={onOpenVolOptimizer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-xs font-semibold text-amber-300 border border-amber-800/60 transition shadow-sm"
            title="Options Strategy Payoff Optimizer & Volatility Surface Calibrator (SABR / SVI Models)"
          >
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden md:inline">⚡ IV Surface</span>
          </button>
        )}

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

        {/* User Account & Profile */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-200 transition group shadow-sm"
          title="Account Profile, Switch Users & Reset Password"
        >
          <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
            {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
          </div>
          <span className="hidden sm:inline font-medium text-slate-200 group-hover:text-white truncate max-w-[90px]">
            {currentUser?.name ? currentUser.name.split(' ')[0] : 'Profile'}
          </span>
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
