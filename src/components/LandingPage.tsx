'use client';

import React from 'react';
import { UserProfile } from '../types/user';
import { DEMO_ACCOUNTS, sanitizeUserProfile } from '../lib/authService';
import {
  Activity,
  ArrowRight,
  BarChart2,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Crosshair,
  FileSpreadsheet,
  Flame,
  Globe2,
  Key,
  Layers,
  LineChart,
  Lock,
  Play,
  RotateCcw,
  Scale,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  currentUser: UserProfile;
  onLaunchTerminal: () => void;
  onOpenAuth: (tab?: 'SIGN_IN' | 'REGISTER') => void;
  onOpenProfile: () => void;
  onSelectDemoUser: (user: UserProfile) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  currentUser,
  onLaunchTerminal,
  onOpenAuth,
  onOpenProfile,
  onSelectDemoUser,
}) => {
  const handleLaunchWithDemo = (demo: typeof DEMO_ACCOUNTS[0]) => {
    onSelectDemoUser(sanitizeUserProfile(demo));
    onLaunchTerminal();
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white font-sans">
      {/* Top Navbar */}
      <nav className="border-b border-slate-800/80 bg-[#0B0E14]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent">
              TradeCraft AI
            </span>
            <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
              BYOK ARCHITECTURE
            </span>
          </div>
        </div>

        {/* Center Quick Links */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-medium text-slate-400">
          <a href="#features" className="hover:text-slate-100 transition">Features</a>
          <a href="#why-tradecraft" className="hover:text-slate-100 transition">Why TradeCraft?</a>
          <a href="#personas" className="hover:text-slate-100 transition">Demo Personas</a>
          <a href="#faq" className="hover:text-slate-100 transition">FAQ</a>
        </div>

        {/* Right CTA / Profile Action */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/80 text-xs font-semibold text-slate-200 transition"
            >
              <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                {currentUser.name.charAt(0)}
              </div>
              <span className="hidden sm:inline">{currentUser.name.split(' ')[0]}</span>
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth('SIGN_IN')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              Sign In
            </button>
          )}

          <button
            onClick={onLaunchTerminal}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Launch Terminal</span>
          </button>
        </div>
      </nav>

      {/* Live Market Marquee */}
      <div className="bg-[#0D121D] border-b border-slate-800/80 px-4 py-2 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center justify-between text-xs font-mono text-slate-300">
        <div className="flex items-center gap-6 animate-pulse">
          <span className="flex items-center gap-1 font-semibold text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            NSE LIVE TICK FEED:
          </span>
          <span>NIFTY 50: <strong className="text-emerald-400">24,180.50 (+0.72%)</strong></span>
          <span>BANKNIFTY: <strong className="text-emerald-400">51,450.20 (+0.94%)</strong></span>
          <span>RELIANCE: <strong className="text-emerald-400">₹2,840.75 (+1.16%)</strong></span>
          <span>TCS: <strong className="text-emerald-400">₹4,120.30 (+0.85%)</strong></span>
          <span>HDFCBANK: <strong className="text-rose-400">₹1,745.00 (-0.35%)</strong></span>
          <span>INFY: <strong className="text-emerald-400">₹1,860.00 (+1.42%)</strong></span>
        </div>
        <div className="text-[11px] text-slate-500 hidden lg:block font-sans">
          SEBI / NSE Statutory Fee Calculation Active (STT, GST, Exchange)
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="relative px-4 sm:px-8 pt-16 pb-20 text-center max-w-5xl mx-auto overflow-hidden">
        {/* Background glow orbs */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full -z-10 pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-72 h-72 bg-purple-600/10 blur-[100px] rounded-full -z-10 pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold mb-6">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <span>India&apos;s 1st BYOK AI Paper Trading & Algorithmic Strategy Sandbox</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight sm:leading-none">
          Master Stock & F&O Trading <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">
            Without Risking A Single Rupee.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
          The only paper trading platform with <strong>true SEBI/NSE statutory charges</strong>, Black-Scholes Greeks, Level-2 DOM ladder execution, and an interactive <strong>AI trading psychologist</strong> powered by your personal Google Gemini or OpenAI key. Zero server inference markups. 100% realistic market execution.
        </p>

        {/* Action Button Row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onLaunchTerminal}
            className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-xl shadow-blue-600/30 transition transform hover:-translate-y-0.5"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Launch Live Sandbox</span>
          </button>

          <button
            onClick={() => onOpenAuth('REGISTER')}
            className="flex items-center gap-2 px-6 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-xl text-sm font-semibold transition"
          >
            <User className="h-4 w-4 text-blue-400" />
            <span>Create Free Account</span>
          </button>

          <a
            href="#personas"
            className="flex items-center gap-2 px-5 py-3.5 text-slate-400 hover:text-slate-200 text-sm font-medium transition"
          >
            <span>Explore 3 Demo Personas</span>
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        {/* Interactive Highlight Bar */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border border-slate-800/80 rounded-2xl bg-slate-900/40 p-4 max-w-4xl mx-auto backdrop-blur-sm">
          <div className="border-r border-slate-800/60 pr-3">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Virtual Capital</span>
            <div className="text-base font-bold text-slate-100 mt-0.5">₹10,00,000</div>
            <span className="text-[10px] text-emerald-400">Configurable per user</span>
          </div>

          <div className="border-r border-slate-800/60 pr-3">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">SEBI Charges</span>
            <div className="text-base font-bold text-amber-400 mt-0.5">Exact Formulas</div>
            <span className="text-[10px] text-slate-400">STT, GST, SEBI fee, Stamp</span>
          </div>

          <div className="border-r border-slate-800/60 pr-3">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">BYOK AI Privacy</span>
            <div className="text-base font-bold text-purple-400 mt-0.5">Zero-Knowledge</div>
            <span className="text-[10px] text-slate-400">Keys never leave browser</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Execution Latency</span>
            <div className="text-base font-bold text-blue-400 mt-0.5">&lt; 10ms Tick</div>
            <span className="text-[10px] text-slate-400">Sub-second DOM Ladder</span>
          </div>
        </div>
      </section>

      {/* WHY TRADECRAFT AI VS OTHERS */}
      <section id="why-tradecraft" className="px-4 sm:px-8 py-16 bg-[#0B0E14] border-y border-slate-800/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">The Harsh Reality</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 mt-2">
              Why 93% of Indian Traders Lose Money
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto mt-3">
              SEBI&apos;s landmark 2024 study revealed that the average trader is actually gross-profitable on price movements, but loses heavily due to statutory fee churn, emotional revenge trading, and the disposition effect.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Feature Comparison</th>
                    <th className="py-3 px-4 text-slate-400">Generic Simulators</th>
                    <th className="py-3 px-4 text-slate-400">Broker Paper Apps</th>
                    <th className="py-3 px-4 text-blue-400 font-bold bg-blue-950/20">TradeCraft AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">Statutory Tax & Fee Engine</td>
                    <td className="py-3 px-4 text-slate-500">❌ Ignores STT & GST</td>
                    <td className="py-3 px-4 text-slate-500">Flat ₹20 Only</td>
                    <td className="py-3 px-4 font-bold text-emerald-400 bg-blue-950/10">
                      ✅ Full SEBI Model (STT, GST, Exchange, Stamp)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">AI Trading Coach & Auditor</td>
                    <td className="py-3 px-4 text-slate-500">❌ None</td>
                    <td className="py-3 px-4 text-slate-500">₹999/mo Paywall</td>
                    <td className="py-3 px-4 font-bold text-emerald-400 bg-blue-950/10">
                      ✅ Free BYOK (Gemini, OpenAI, Ollama)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">Broker Statement Importer</td>
                    <td className="py-3 px-4 text-slate-500">❌ None</td>
                    <td className="py-3 px-4 text-slate-500">❌ Proprietary Only</td>
                    <td className="py-3 px-4 font-bold text-emerald-400 bg-blue-950/10">
                      ✅ Zerodha & Groww CSV Cognitive Audit
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">Institutional Level-2 DOM</td>
                    <td className="py-3 px-4 text-slate-500">Basic 1-line quote</td>
                    <td className="py-3 px-4 text-slate-500">Read-only Depth</td>
                    <td className="py-3 px-4 font-bold text-emerald-400 bg-blue-950/10">
                      ✅ Top 5 Bids/Asks with 1-Click Order Rungs
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">Derivatives Greeks & Chain</td>
                    <td className="py-3 px-4 text-slate-500">❌ Cash Only</td>
                    <td className="py-3 px-4 text-slate-500">Delayed Options</td>
                    <td className="py-3 px-4 font-bold text-emerald-400 bg-blue-950/10">
                      ✅ Black-Scholes Greeks ($\Delta, \Gamma, \Theta, \nu$) + Spreads
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-200">TradingView Algo Webhooks</td>
                    <td className="py-3 px-4 text-slate-500">❌ None</td>
                    <td className="py-3 px-4 text-slate-500">Expensive API Token</td>
                    <td className="py-3 px-4 font-bold text-emerald-400 bg-blue-950/10">
                      ✅ Next.js Route Handler + Circuit Breakers
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES GRID */}
      <section id="features" className="px-4 sm:px-8 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Comprehensive Architecture</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 mt-2">
            Built For Serious Market Learners & Algorithmic Quants
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto mt-3">
            Every feature was engineered to mirror real institutional trading desks while maintaining 100% privacy and zero infrastructure costs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Statutory Taxes */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-blue-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">SEBI Statutory Tax Engine</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Calculates exact Indian exchange deductions: Brokerage (₹20), Delivery STT (0.1%), Intraday STT (0.025%), NSE turnover charges, GST (18%), and stamp duty.
            </p>
          </div>

          {/* Card 2: Options Chain & Greeks */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-emerald-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">F&O Options & Greeks Matrix</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Analytical Black-Scholes pricing with Abramowitz-Stegun normal CDF. Visualizes Delta, Gamma, Theta, Vega, and multi-leg strategies like Bull Call and Iron Condors.
            </p>
          </div>

          {/* Card 3: BYOK Security Vault */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-purple-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition">
              <Key className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">BYOK Zero-Knowledge AI</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Connect your personal Google Gemini, OpenAI, or local Ollama endpoints. Keys remain stored securely in client localStorage with direct browser dispatch.
            </p>
          </div>

          {/* Card 4: Level-2 DOM Ladder */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-teal-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-110 transition">
              <BarChart2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Level-2 DOM & Bar Replay</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Institutional depth of market showing top 5 bids and asks with volume imbalance meter. Rewind historical price action with lookahead-bias-free tick replay.
            </p>
          </div>

          {/* Card 5: Tradebook Statement Importer */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-indigo-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Zerodha & Groww Tradebook Importer</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Drag-and-drop real CSV statements to audit cognitive biases: Revenge Trading Index, Loss Bag-Holding (Disposition Effect), and Fee Erosion drag.
            </p>
          </div>

          {/* Card 6: Technical Screener & Scanner */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-rose-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition">
              <Crosshair className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Multi-Factor NSE Screener</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Real-time quantitative scanning across Volume Surges, 20/50 EMA crosses, RSI(14), Day VWAP, and 15m ORBs with 1-click terminal stock synchronization.
            </p>
          </div>

          {/* Card 7: Social Trading Leagues & Alpha Score */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-amber-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition">
              <Trophy className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Social Leagues & Alpha Ranks</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Tournament arenas (NIFTY Expiry, Intraday Sprint, Rookie Sandbox) scored by risk-adjusted Sortino ratio and PQ discipline. Drawdown ceilings instantly disqualify reckless gambling.
            </p>
          </div>

          {/* Card 8: Cryptographic Proof-of-Alpha */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-cyan-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Cryptographic Proof-of-Alpha</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Zero-gas SHA-256 tradebook hash chaining with Merkle root aggregation. Generates mathematically tamper-evident digital certificates that eliminate inspected-element P&L fraud.
            </p>
          </div>

          {/* Card 9: Autonomous AI Quant Desk War Room */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-blue-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Autonomous AI Quant Desk</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Virtual Hedge Fund Investment Committee: Macro Strategist, Momentum Alpha Hunter, Chief Risk Officer (with 99% VaR & unilateral veto), and Execution Algorist with DOM/Iceberg/TWAP routing.
            </p>
          </div>

          {/* Card 10: Multi-Broker Trade Copier Bridge */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-indigo-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition">
              <Share2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Multi-Broker Trade Copier</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Mirror trades across simulated Zerodha Kite, Groww, and Upstox accounts with proportional risk multipliers, exchange lot rounding, broker latency, slippage guards, and an Emergency Global Kill Switch.
            </p>
          </div>

          {/* Card 11: Real-Time Options Greeks Hedger & Autobalancer */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-cyan-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Options Greeks Hedger & Autobalancer</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Aggregate portfolio Delta, Gamma, Theta, and Vega across all open options and futures. Features an automated Delta-Neutral counter-order solver, non-linear 2D Taylor curvature visualizer, and customizable rebalance daemon thresholds.
            </p>
          </div>

          {/* Card 12: IV Surface Calibrator & Multi-Leg Strategy Optimizer */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-amber-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">IV Surface & Strategy Optimizer</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Parametric volatility smile calibration via Hagan SABR (α, β, ρ, ν) and Gatheral SVI models. Detects mispriced options contracts with real-time relative value radar and optimizes multi-leg spreads for maximum PoP and Sharpe expectancy.
            </p>
          </div>

          {/* Card 13: Level-3 Order Book & Institutional Iceberg Radar */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-cyan-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Level-3 Order Book & Iceberg Radar</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Full 10-rung Market-By-Order (MBO) depth ladder with sub-45ms algorithmic iceberg replenishment detection, volume-weighted Micro-Price, multi-depth OBI, VPIN flow toxicity, and SEBI ₹10 Cr institutional block deal tracking.
            </p>
          </div>

          {/* Card 14: Statistical Arbitrage & Cointegration Pairs Studio */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-indigo-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Statistical Arbitrage & Pairs Studio</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Engle-Granger 2-step cointegration testing, Augmented Dickey-Fuller stationarity, Ornstein-Uhlenbeck half-life mean reversion, and dynamic recursive Kalman filter hedge ratios with 1-click market-neutral pair execution.
            </p>
          </div>

          {/* Card 15: VWAP/TWAP Execution Engine & Almgren-Chriss Optimal Liquidation */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-blue-500/50 transition group">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">VWAP / TWAP Execution Studio</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Institutional order slicing algorithms powered by the Almgren-Chriss (2000) optimal liquidation model, empirical Indian NSE U-shaped volume profile weighting, and complete Perold Implementation Shortfall attribution breakdown.
            </p>
          </div>
        </div>
      </section>

      {/* DEMO PERSONAS SECTION */}
      <section id="personas" className="px-4 sm:px-8 py-16 bg-[#0B0E14] border-t border-slate-800/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Choose Your Archetype</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 mt-2">
              Explore Preloaded Demo Accounts
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto mt-3">
              Test TradeCraft AI instantly without registration. Each demo account has a distinct portfolio, starting capital, risk style, and trading history.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEMO_ACCOUNTS.map((demo) => (
              <div
                key={demo.id}
                className="p-6 rounded-2xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white">
                      {demo.name.charAt(0)}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      demo.persona === 'INTRADAY_SCALPER' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                      demo.persona === 'OPTIONS_QUANT' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {demo.persona.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 mt-4">{demo.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{demo.email}</p>
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">{demo.bio}</p>

                  <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Capital</span>
                      <div className="font-bold text-slate-200">₹{(demo.startingCapital / 100000).toFixed(0)} Lakh</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Discipline (PQ)</span>
                      <div className="font-bold text-emerald-400">{demo.stats?.disciplineScore}/100</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleLaunchWithDemo(demo)}
                  className="mt-6 w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <Play className="h-3.5 w-3.5 fill-current text-blue-400" />
                  <span>Launch as {demo.name.split(' ')[0]}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="px-4 sm:px-8 py-16 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Frequently Asked Questions</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 mt-2">
            Clear Answers for Traders & Developers
          </h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30">
            <h4 className="text-sm font-bold text-slate-200">Is real money involved in TradeCraft AI?</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              No. TradeCraft AI is a 100% risk-free educational sandbox with simulated virtual capital (₹10,00,000 default). All order fills, margin checks, and P&L calculations occur in real time using synthetic market ticks and actual historical candlesticks.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30">
            <h4 className="text-sm font-bold text-slate-200">How does the Bring Your Own Key (BYOK) architecture work?</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              We never charge a subscription for AI features. You simply provide your free or pay-as-you-go API key from Google Gemini or OpenAI. The key is stored solely in your browser&apos;s localStorage and passed in-memory directly to the AI provider. Your trading data never touches third-party inference servers.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30">
            <h4 className="text-sm font-bold text-slate-200">Are the statutory taxes accurate to Indian stock exchanges?</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Yes. The statutory tax engine strictly implements SEBI/NSE schedules: ₹20 brokerage per order, Delivery STT (0.1%), Intraday STT (0.025% on sell), NSE Exchange turnover fees, SEBI turnover fees, 18% GST, and Stamp Duty.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-[#0B0E14] px-4 sm:px-8 py-8 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="font-bold text-slate-300">TradeCraft AI</span>
            <span>• Educational Trading Simulator</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a
              href="https://github.com/Paurushmuley/LearnTrade.git"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-400 transition"
            >
              GitHub Repository
            </a>
            <span>•</span>
            <button onClick={() => onOpenAuth('SIGN_IN')} className="hover:text-blue-400 transition">
              Sign In
            </button>
            <span>•</span>
            <button onClick={onLaunchTerminal} className="hover:text-blue-400 transition">
              Launch Terminal
            </button>
          </div>
        </div>
        <p className="mt-4 text-[10px] text-slate-600">
          Disclaimer: TradeCraft AI is an educational technology demonstration. Financial instruments involve risk. Not financial or investment advice.
        </p>
      </footer>
    </div>
  );
};
