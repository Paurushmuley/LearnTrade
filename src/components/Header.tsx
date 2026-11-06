'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AIConfig, PortfolioSummary } from '../types/trading';
import { UserProfile } from '../types/user';
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Brain,
  ChevronDown,
  Clock,
  Command,
  Cpu,
  Crosshair,
  FileSpreadsheet,
  Globe2,
  Home,
  Key,
  Layers,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Terminal,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';

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
  onOpenVolDispersion?: () => void;
  onOpenRiskCockpit?: () => void;
  onOpenMicrostructure?: () => void;
  onOpenStatArb?: () => void;
  onOpenExecution?: () => void;
  onOpenMacroEvent?: () => void;
  onOpenSOR?: () => void;
  onOpenFix?: () => void;
  onOpenBYOK: () => void;
  onOpenStrategy: () => void;
  onOpenCrisis: () => void;
  onResetAccount: () => void;
  onOpenProfile: () => void;
  onOpenLanding: () => void;
}

type MenuType = 'markets' | 'execution' | 'quant' | 'hub' | null;

interface SuiteToolItem {
  id: string;
  name: string;
  badge?: string;
  description: string;
  icon: React.ReactNode;
  action?: () => void;
  category: 'Markets' | 'Execution' | 'Quant Lab' | 'Desks & Hub';
  accent: string;
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
  onOpenVolDispersion,
  onOpenRiskCockpit,
  onOpenMicrostructure,
  onOpenStatArb,
  onOpenExecution,
  onOpenMacroEvent,
  onOpenSOR,
  onOpenFix,
  onOpenBYOK,
  onOpenStrategy,
  onOpenCrisis,
  onResetAccount,
  onOpenProfile,
  onOpenLanding,
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAIActive = Boolean(aiConfig.geminiKey || aiConfig.openaiKey || aiConfig.provider === 'ollama');

  const getPqColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    if (score >= 60) return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
    return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
  };

  // Registry of all 20 institutional tools
  const allTools: SuiteToolItem[] = [
    // 1. Markets Suite
    {
      id: 'options-chain',
      name: 'Option Chain (F&O)',
      badge: 'Live NSE',
      description: 'Live strikes, Greeks, multi-leg builder & payoff graphs',
      icon: <Layers className="h-4 w-4 text-emerald-400" />,
      action: onOpenOptions,
      category: 'Markets',
      accent: 'emerald',
    },
    {
      id: 'microstructure',
      name: 'Level-3 & Dark Pool',
      badge: 'Order Book',
      description: 'Depth imbalance, Iceberg detection & SEBI block deals',
      icon: <Layers className="h-4 w-4 text-cyan-400" />,
      action: onOpenMicrostructure,
      category: 'Markets',
      accent: 'cyan',
    },
    {
      id: 'screener',
      name: 'Technical Screener',
      badge: 'Multi-Factor',
      description: 'Volume surges, EMA crossovers, RSI, VWAP & ORB breakouts',
      icon: <Crosshair className="h-4 w-4 text-teal-400" />,
      action: onOpenScreener,
      category: 'Markets',
      accent: 'teal',
    },
    {
      id: 'market-breadth',
      name: 'Market Breadth',
      badge: 'FII / DII',
      description: 'Advance/Decline, institutional cash flows & sectoral heatmaps',
      icon: <Globe2 className="h-4 w-4 text-teal-400" />,
      action: onOpenBreadth,
      category: 'Markets',
      accent: 'teal',
    },

    // 2. Execution Suite
    {
      id: 'smart-order-router',
      name: 'Smart Order Router & Arb',
      badge: 'Cross-Exchange',
      description: 'NSE vs BSE latency arbitrage, split sweep & fee optimizer',
      icon: <ArrowRightLeft className="h-4 w-4 text-cyan-400" />,
      action: onOpenSOR,
      category: 'Execution',
      accent: 'cyan',
    },
    {
      id: 'vwap-twap',
      name: 'VWAP / TWAP Studio',
      badge: 'Almgren-Chriss',
      description: 'Optimal liquidation trajectory & Perold Implementation Shortfall',
      icon: <Clock className="h-4 w-4 text-blue-400" />,
      action: onOpenExecution,
      category: 'Execution',
      accent: 'blue',
    },
    {
      id: 'stat-arb',
      name: 'Statistical Arbitrage',
      badge: 'Pairs Trading',
      description: 'Engle-Granger cointegration, Kalman filter & Z-score hedging',
      icon: <Scale className="h-4 w-4 text-indigo-400" />,
      action: onOpenStatArb,
      category: 'Execution',
      accent: 'indigo',
    },
    {
      id: 'trade-copier',
      name: 'Multi-Broker Copier',
      badge: 'Zero-Latency',
      description: 'Mirror parent signals to Zerodha, Groww & Upstox master accounts',
      icon: <Share2 className="h-4 w-4 text-indigo-400" />,
      action: onOpenCopier,
      category: 'Execution',
      accent: 'indigo',
    },
    {
      id: 'algo-webhooks',
      name: 'Algo Webhooks Gateway',
      badge: 'TradingView',
      description: 'Automated JSON signal receiver & webhook listener',
      icon: <Cpu className="h-4 w-4 text-indigo-400" />,
      action: onOpenWebhookBot,
      category: 'Execution',
      accent: 'indigo',
    },
    {
      id: 'fix-protocol',
      name: 'FIX Protocol Gateway',
      badge: 'FIX 4.4 Wire',
      description: 'Institutional tag-value socket stream & drop-copy compliance journal',
      icon: <Terminal className="h-4 w-4 text-cyan-400" />,
      action: onOpenFix,
      category: 'Execution',
      accent: 'cyan',
    },

    // 3. Quant Lab Suite
    {
      id: 'risk-cockpit',
      name: 'Pre-Trade Risk & Stress Desk',
      badge: 'Sprint 22',
      description: 'SPAN 16-scenario array, peak margin gatekeeper, fat-tail CVaR 99% & 1-click unwind',
      icon: <ShieldAlert className="h-4 w-4 text-rose-400" />,
      action: onOpenRiskCockpit,
      category: 'Quant Lab',
      accent: 'rose',
    },
    {
      id: 'vol-dispersion',
      name: 'Options Vol Dispersion & Skew',
      badge: 'Sprint 21',
      description: 'Multi-expiry smile ribbon, implied correlation radar & gamma scalper',
      icon: <Zap className="h-4 w-4 text-cyan-400" />,
      action: onOpenVolDispersion,
      category: 'Quant Lab',
      accent: 'cyan',
    },
    {
      id: 'greeks-hedger',
      name: 'Delta-Gamma Hedger',
      badge: 'Dynamic Greek',
      description: 'Real-time portfolio curvature rebalancer & Greeks radar',
      icon: <Scale className="h-4 w-4 text-cyan-400" />,
      action: onOpenGreeksHedger,
      category: 'Quant Lab',
      accent: 'cyan',
    },
    {
      id: 'vol-optimizer',
      name: 'IV Volatility Surface',
      badge: 'SABR / SVI',
      description: 'Calibrate volatility smiles, skew cones & strike arbitrage',
      icon: <TrendingUp className="h-4 w-4 text-amber-400" />,
      action: onOpenVolOptimizer,
      category: 'Quant Lab',
      accent: 'amber',
    },
    {
      id: 'macro-event-risk',
      name: 'Macro Event Risk Engine',
      badge: 'Pre/Post Event',
      description: 'RBI/Fed economic calendar, IV crush estimator & sentiment NLP',
      icon: <Globe2 className="h-4 w-4 text-indigo-400" />,
      action: onOpenMacroEvent,
      category: 'Quant Lab',
      accent: 'indigo',
    },
    {
      id: 'quant-analytics',
      name: 'Monte Carlo Analytics',
      badge: 'Risk Engine',
      description: 'Probability of ruin, Value at Risk (VaR) & hourly P&L matrix',
      icon: <BarChart3 className="h-4 w-4 text-amber-400" />,
      action: onOpenAnalytics,
      category: 'Quant Lab',
      accent: 'amber',
    },
    {
      id: 'quant-desk',
      name: 'Autonomous AI Quant Desk',
      badge: 'Multi-Agent',
      description: 'Virtual hedge fund war room: Macro, Alpha, Risk & Execution agents',
      icon: <Brain className="h-4 w-4 text-cyan-400" />,
      action: onOpenQuantDesk,
      category: 'Quant Lab',
      accent: 'cyan',
    },

    // 4. Desks & Hub Suite
    {
      id: 'leagues-poa',
      name: 'Leagues & Proof-of-Alpha',
      badge: 'Sortino Leaderboard',
      description: 'Cryptographic trade verification & global trader standings',
      icon: <Trophy className="h-4 w-4 text-amber-400" />,
      action: onOpenLeagues,
      category: 'Desks & Hub',
      accent: 'amber',
    },
    {
      id: 'tradebook-audit',
      name: 'Tradebook AI Auditor',
      badge: 'Behavioral Bias',
      description: 'Upload Zerodha/Groww CSVs for revenge trading & FOMO audit',
      icon: <FileSpreadsheet className="h-4 w-4 text-purple-400" />,
      action: onOpenTradebook,
      category: 'Desks & Hub',
      accent: 'purple',
    },
    {
      id: 'strategy-builder',
      name: 'Strategy Backtester',
      badge: 'Natural Language',
      description: 'Compose indicators in plain English & backtest historical tick data',
      icon: <Zap className="h-4 w-4 text-blue-400" />,
      action: onOpenStrategy,
      category: 'Desks & Hub',
      accent: 'blue',
    },
    {
      id: 'crisis-simulator',
      name: 'Crisis Replay Simulator',
      badge: 'Black Swan',
      description: 'Replay 2008 Crash, COVID 2020 & 2024 Election Volatility',
      icon: <ShieldAlert className="h-4 w-4 text-rose-400" />,
      action: onOpenCrisis,
      category: 'Desks & Hub',
      accent: 'rose',
    },
  ];

  // Filter tools by suite category
  const marketsTools = allTools.filter((t) => t.category === 'Markets');
  const executionTools = allTools.filter((t) => t.category === 'Execution');
  const quantTools = allTools.filter((t) => t.category === 'Quant Lab');
  const hubTools = allTools.filter((t) => t.category === 'Desks & Hub');

  // Filtered tools for the Command Palette search
  const filteredTools = allTools.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.badge && t.badge.toLowerCase().includes(q))
    );
  });

  // Global Keyboard Shortcuts (Ctrl+K or ⌘K, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        setActiveMenu(null);
      } else if (e.key === 'Escape') {
        setActiveMenu(null);
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when command palette opens
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Execute a selected tool
  const handleLaunchTool = (item: SuiteToolItem) => {
    setActiveMenu(null);
    setIsCommandPaletteOpen(false);
    if (item.action) {
      item.action();
    }
  };

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (filteredTools.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredTools.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredTools.length) % filteredTools.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTools[selectedIndex]) {
        handleLaunchTool(filteredTools[selectedIndex]);
      }
    }
  };

  return (
    <>
      <header className="border-b border-slate-800/80 bg-[#0A0E17]/95 backdrop-blur-md px-3 sm:px-4 py-2 sticky top-0 z-40 shadow-lg shadow-black/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Market Status */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenLanding}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:scale-105 transition"
              title="View Landing Page & Platform Overview"
            >
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span
                  onClick={onOpenLanding}
                  className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent cursor-pointer hover:opacity-90"
                  title="View Landing Page"
                >
                  TradeCraft AI
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium hidden xs:inline-block">
                  BYOK v1.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                NSE Live Sandbox • Taxes & Charges Active
              </p>
            </div>

            <button
              onClick={onOpenLanding}
              className="hidden 2xl:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-white transition ml-1"
              title="Return to TradeCraft AI Overview & Landing Page"
            >
              <Home className="h-3 w-3 text-blue-400" />
              <span>About Platform</span>
            </button>
          </div>

          {/* Portfolio Financial Ticker */}
          <div className="hidden lg:flex items-center gap-3 sm:gap-4 text-xs bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl shadow-inner">
            <div>
              <span className="text-slate-400 block text-[9px] font-medium uppercase tracking-wider">Available Cash</span>
              <span className="font-semibold text-slate-100 text-[11px]">₹{portfolio.availableCash.toLocaleString('en-IN')}</span>
            </div>

            <div className="h-5 w-px bg-slate-800" />

            <div>
              <span className="text-slate-400 block text-[9px] font-medium uppercase tracking-wider">Used Margin</span>
              <span className="font-semibold text-slate-300 text-[11px]">₹{portfolio.usedMargin.toLocaleString('en-IN')}</span>
            </div>

            <div className="h-5 w-px bg-slate-800" />

            <div>
              <span className="text-slate-400 block text-[9px] font-medium uppercase tracking-wider">Realized P&L</span>
              <span className={`font-semibold text-[11px] ${portfolio.totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {portfolio.totalRealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalRealizedPnL.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="h-5 w-px bg-slate-800" />

            <div>
              <span className="text-slate-400 block text-[9px] font-medium uppercase tracking-wider">Unrealized P&L</span>
              <span className={`font-semibold text-[11px] ${portfolio.totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.totalUnrealizedPnL.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="h-5 w-px bg-slate-800" />

            <div>
              <span className="text-slate-400 block text-[9px] font-medium uppercase tracking-wider">Charges</span>
              <span className="font-semibold text-amber-400/90 text-[11px]">-₹{portfolio.totalChargesDeducted.toLocaleString('en-IN')}</span>
            </div>

            <div className="h-5 w-px bg-slate-800" />

            {/* Discipline Score (PQ) */}
            <div className="flex items-center gap-1">
              <div>
                <span className="text-slate-400 block text-[9px] font-medium uppercase tracking-wider">Discipline</span>
                <div className={`px-1.5 py-0.2 rounded border text-[10px] font-bold flex items-center gap-1 ${getPqColor(portfolio.disciplineScore)}`}>
                  <Activity className="h-2.5 w-2.5" />
                  <span>{portfolio.disciplineScore}/100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Institutional Command Suites & Direct Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 1. Markets Suite Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'markets' ? null : 'markets')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                  activeMenu === 'markets'
                    ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-emerald-600/50'
                }`}
                title="Markets Suite: Option Chain, Level-3 Depth, Screener & Breadth"
              >
                <Layers className="h-3.5 w-3.5 text-emerald-400" />
                <span>Markets</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeMenu === 'markets' ? 'rotate-180' : ''}`} />
              </button>

              {activeMenu === 'markets' && (
                <div className="absolute left-0 sm:right-auto mt-2 w-72 rounded-xl bg-[#0F1422] border border-slate-700/80 shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Markets Suite
                    </span>
                    <span className="text-[9px] text-slate-500">4 Tools</span>
                  </div>
                  <div className="space-y-0.5">
                    {marketsTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleLaunchTool(tool)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-emerald-950/40 hover:border-emerald-800/40 border border-transparent transition flex items-start gap-2.5 group"
                      >
                        <div className="mt-0.5 p-1 rounded-md bg-slate-800/80 border border-slate-700/60 group-hover:border-emerald-500/40">
                          {tool.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-emerald-300 truncate">
                              {tool.name}
                            </span>
                            {tool.badge && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                {tool.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{tool.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Execution Suite Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'execution' ? null : 'execution')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                  activeMenu === 'execution'
                    ? 'bg-blue-950/70 border-blue-500 text-blue-200 ring-1 ring-blue-500/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-blue-600/50'
                }`}
                title="Execution Suite: SOR Arbitrage, VWAP/TWAP, Pairs Arb & Trade Copier"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-cyan-400" />
                <span>Execution</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeMenu === 'execution' ? 'rotate-180' : ''}`} />
              </button>

              {activeMenu === 'execution' && (
                <div className="absolute left-0 sm:right-auto mt-2 w-76 rounded-xl bg-[#0F1422] border border-slate-700/80 shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3" /> Execution & Routing
                    </span>
                    <span className="text-[9px] text-slate-500">{executionTools.length} Tools</span>
                  </div>
                  <div className="space-y-0.5">
                    {executionTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleLaunchTool(tool)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-blue-950/40 hover:border-blue-800/40 border border-transparent transition flex items-start gap-2.5 group"
                      >
                        <div className="mt-0.5 p-1 rounded-md bg-slate-800/80 border border-slate-700/60 group-hover:border-blue-500/40">
                          {tool.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-blue-300 truncate">
                              {tool.name}
                            </span>
                            {tool.badge && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                                {tool.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{tool.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Quant Lab Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'quant' ? null : 'quant')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                  activeMenu === 'quant'
                    ? 'bg-amber-950/70 border-amber-500 text-amber-200 ring-1 ring-amber-500/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-amber-600/50'
                }`}
                title="Quant Lab Suite: Delta Hedger, IV Surface, Macro Risk & AI Quant Desk"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Quant Lab</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeMenu === 'quant' ? 'rotate-180' : ''}`} />
              </button>

              {activeMenu === 'quant' && (
                <div className="absolute right-0 sm:left-auto mt-2 w-76 rounded-xl bg-[#0F1422] border border-slate-700/80 shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Quant Lab & AI Desk
                    </span>
                    <span className="text-[9px] text-slate-500">{quantTools.length} Models</span>
                  </div>
                  <div className="space-y-0.5">
                    {quantTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleLaunchTool(tool)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-amber-950/40 hover:border-amber-800/40 border border-transparent transition flex items-start gap-2.5 group"
                      >
                        <div className="mt-0.5 p-1 rounded-md bg-slate-800/80 border border-slate-700/60 group-hover:border-amber-500/40">
                          {tool.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-amber-300 truncate">
                              {tool.name}
                            </span>
                            {tool.badge && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                                {tool.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{tool.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Desks & Hub Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'hub' ? null : 'hub')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                  activeMenu === 'hub'
                    ? 'bg-purple-950/70 border-purple-500 text-purple-200 ring-1 ring-purple-500/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-purple-600/50'
                }`}
                title="Desks & Hub: Leagues PoA, AI Auditor, Strategy Backtester & Crisis Simulator"
              >
                <Trophy className="h-3.5 w-3.5 text-purple-400" />
                <span>Desks & Hub</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${activeMenu === 'hub' ? 'rotate-180' : ''}`} />
              </button>

              {activeMenu === 'hub' && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0F1422] border border-slate-700/80 shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> Desks & Historical Hub
                    </span>
                    <span className="text-[9px] text-slate-500">4 Portals</span>
                  </div>
                  <div className="space-y-0.5">
                    {hubTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleLaunchTool(tool)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-950/40 hover:border-purple-800/40 border border-transparent transition flex items-start gap-2.5 group"
                      >
                        <div className="mt-0.5 p-1 rounded-md bg-slate-800/80 border border-slate-700/60 group-hover:border-purple-500/40">
                          {tool.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-purple-300 truncate">
                              {tool.name}
                            </span>
                            {tool.badge && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                                {tool.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{tool.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-slate-800 mx-0.5" />

            {/* Quick Finder / Command Palette Spotlight (Ctrl+K) */}
            <button
              onClick={() => {
                setActiveMenu(null);
                setIsCommandPaletteOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-800 text-slate-300 text-xs transition group"
              title="Quick Finder & Command Palette (Ctrl+K or ⌘K)"
            >
              <Search className="h-3.5 w-3.5 text-blue-400 group-hover:scale-110 transition" />
              <span className="hidden xl:inline text-slate-300 font-medium">Quick Find</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded">
                ⌘K
              </kbd>
            </button>

            {/* Bar Replay Mode Toggle (Direct One-Click) */}
            <button
              onClick={onToggleReplay}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                isReplayActive
                  ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/30 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:text-white'
              }`}
              title="Toggle Tick-by-Tick Bar Replay Simulation"
            >
              <RotateCcw className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden md:inline">{isReplayActive ? 'Replay Active' : 'Bar Replay'}</span>
            </button>

            {/* BYOK Settings Key Modal */}
            <button
              onClick={onOpenBYOK}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                isAIActive
                  ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-indigo-950/40 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/50'
              }`}
              title="Configure personal Gemini / OpenAI / Ollama Key"
            >
              <Key className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{isAIActive ? 'AI Coach Active' : 'BYOK Key'}</span>
            </button>

            {/* User Account & Profile */}
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-blue-500 text-xs font-semibold text-slate-200 transition group shadow-sm"
              title="Account Profile, Switch Users & Reset Password"
            >
              <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <span className="hidden xl:inline font-medium text-slate-200 group-hover:text-white truncate max-w-[80px]">
                {currentUser?.name ? currentUser.name.split(' ')[0] : 'Profile'}
              </span>
            </button>

            {/* Reset Virtual Sandbox */}
            <button
              onClick={onResetAccount}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="Reset Virtual Sandbox to ₹10,00,000"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop overlay for closing dropdown menus */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setActiveMenu(null)}
        />
      )}

      {/* Quick Finder / Command Palette Modal */}
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-xl rounded-2xl bg-[#0F1422] border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="p-3 border-b border-slate-800 flex items-center gap-3 bg-slate-900/60">
              <Search className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handlePaletteKeyDown}
                placeholder="Search tools, analytics, models & simulators... (e.g. 'vwap', 'greeks', 'sor')"
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded">
                ESC
              </kbd>
            </div>

            {/* Tool Results List */}
            <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-800/40">
              {filteredTools.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No matching tools found for <span className="text-slate-200 font-semibold">"{searchQuery}"</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTools.map((tool, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleLaunchTool(tool)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-600/20 border border-blue-500/50 shadow-sm'
                            : 'hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 ${isSelected ? 'border-blue-400' : ''}`}>
                            {tool.icon}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                {tool.name}
                              </span>
                              {tool.badge && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                  {tool.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{tool.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider hidden sm:inline">
                            {tool.category}
                          </span>
                          <span className="text-[10px] text-blue-400 font-mono">↵ Open</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-2">
                <span>↑↓ Navigate</span>
                <span>•</span>
                <span>↵ Launch</span>
                <span>•</span>
                <span>ESC Close</span>
              </span>
              <span>20 Institutional Trading Tools</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
