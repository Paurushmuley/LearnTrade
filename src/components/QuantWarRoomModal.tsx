'use client';

import React, { useState, useEffect } from 'react';
import {
  QuantDeskConsensusVerdict,
  QuantAgentPersona,
  RoutingAlgorithm,
  SentimentStance,
} from '../types/quantDesk';
import { TickerInfo, Candle, OrderSide } from '../types/trading';
import {
  QUANT_COMMITTEE_PERSONAS,
  runCommitteeDebate,
} from '../lib/quantDeskEngine';
import { POPULAR_TICKERS } from '../lib/marketData';
import {
  Brain,
  ShieldCheck,
  ShieldAlert,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Send,
  Sliders,
  DollarSign,
  Clock,
  X,
  Compass,
} from 'lucide-react';

interface QuantWarRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTicker: TickerInfo;
  candles: Candle[];
  portfolioEquity: number;
  currentDrawdownPct: number;
  onExecuteApprovedTrade: (params: {
    symbol: string;
    side: OrderSide;
    quantity: number;
    price: number;
    routingAlgorithm: RoutingAlgorithm;
  }) => void;
  onSelectStock: (ticker: TickerInfo) => void;
}

export const QuantWarRoomModal: React.FC<QuantWarRoomModalProps> = ({
  isOpen,
  onClose,
  selectedTicker,
  candles,
  portfolioEquity,
  currentDrawdownPct,
  onExecuteApprovedTrade,
  onSelectStock,
}) => {
  const [activeTicker, setActiveTicker] = useState<TickerInfo>(selectedTicker);
  const [isDebating, setIsDebating] = useState<boolean>(false);
  const [activeRound, setActiveRound] = useState<number>(4); // Display all rounds
  const [consensus, setConsensus] = useState<QuantDeskConsensusVerdict | null>(null);
  const [executedNotice, setExecutedNotice] = useState<string | null>(null);

  // Synchronize when parent ticker changes
  useEffect(() => {
    setActiveTicker(selectedTicker);
  }, [selectedTicker]);

  // Compute initial consensus on mount or ticker switch
  useEffect(() => {
    if (!isOpen) return;
    const initialVerdict = runCommitteeDebate({
      ticker: activeTicker,
      candles,
      portfolioEquity,
      currentDrawdownPct,
    });
    setConsensus(initialVerdict);
    setExecutedNotice(null);
  }, [isOpen, activeTicker.symbol, portfolioEquity, currentDrawdownPct]);

  if (!isOpen || !consensus) return null;

  const handleRunDebate = () => {
    setIsDebating(true);
    setActiveRound(1);
    setExecutedNotice(null);

    // Simulate progressive multi-agent boardroom debate
    const timer1 = setTimeout(() => setActiveRound(2), 500);
    const timer2 = setTimeout(() => setActiveRound(3), 1000);
    const timer3 = setTimeout(() => {
      setActiveRound(4);
      const newVerdict = runCommitteeDebate({
        ticker: activeTicker,
        candles,
        portfolioEquity,
        currentDrawdownPct,
      });
      setConsensus(newVerdict);
      setIsDebating(false);
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  const handleDispatchOrder = () => {
    if (!consensus) return;
    if (consensus.verdict === 'REJECTED_BY_RISK' || consensus.verdict === 'REJECTED_BY_MACRO') return;

    onExecuteApprovedTrade({
      symbol: consensus.symbol,
      side: consensus.directionalBias === 'SHORT' ? 'SELL' : 'BUY',
      quantity: consensus.riskAudit.approvedQuantity,
      price: consensus.alphaSignal.entryPrice,
      routingAlgorithm: consensus.executionPlan.routingAlgorithm,
    });

    setExecutedNotice(
      `✓ Successfully routed ${consensus.riskAudit.approvedQuantity} shares of ${consensus.symbol} via ${consensus.executionPlan.routingAlgorithm} to Paper Portfolio!`
    );
  };

  const getSentimentPill = (sentiment: SentimentStance) => {
    switch (sentiment) {
      case 'BULLISH':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'BEARISH':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'CAUTIONARY':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'VETO':
        return 'bg-rose-900/60 text-rose-200 border-rose-600 font-bold animate-pulse';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getVerdictCardStyle = (verdict: string) => {
    switch (verdict) {
      case 'APPROVED_FULL':
        return 'from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40';
      case 'APPROVED_SCALED_DOWN':
        return 'from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40';
      case 'REJECTED_BY_RISK':
        return 'from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/50';
      case 'REJECTED_BY_MACRO':
        return 'from-indigo-950/40 via-slate-900 to-slate-900 border-indigo-500/40';
      default:
        return 'from-slate-900 to-slate-950 border-slate-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0f19] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border-b border-cyan-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Brain className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-semibold">
                  Institutional Investment Committee
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Autonomous 4-Agent Desk
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                AI Quant Desk War Room
                <span className="text-xs font-mono text-slate-400 font-normal hidden sm:inline">
                  [{consensus.committeeSessionId}]
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Ticker Selector */}
            <select
              value={activeTicker.symbol}
              onChange={(e) => {
                const found = POPULAR_TICKERS.find((t) => t.symbol === e.target.value);
                if (found) {
                  setActiveTicker(found);
                  onSelectStock(found);
                }
              }}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none focus:border-cyan-400"
            >
              {POPULAR_TICKERS.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} (₹{t.currentPrice.toFixed(1)})
                </option>
              ))}
            </select>

            <button
              onClick={handleRunDebate}
              disabled={isDebating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                isDebating
                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/30'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isDebating ? 'animate-spin' : ''}`} />
              <span>{isDebating ? 'Debating...' : 'Re-Convene Committee'}</span>
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
          {/* Execution Notification Banner */}
          {executedNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between animate-fadeIn">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {executedNotice}
              </span>
              <button onClick={() => setExecutedNotice(null)} className="text-emerald-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4 Agent Podium / Showcase Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {QUANT_COMMITTEE_PERSONAS.map((agent) => {
              let liveMetric = '';
              let stance: SentimentStance = 'NEUTRAL';

              if (agent.role === 'MACRO_STRATEGIST') {
                liveMetric = `Score: ${consensus.macroRegime.regimeScore >= 0 ? '+' : ''}${
                  consensus.macroRegime.regimeScore
                }`;
                stance =
                  consensus.macroRegime.regimeScore >= 0.25
                    ? 'BULLISH'
                    : consensus.macroRegime.regimeScore <= -0.2
                    ? 'BEARISH'
                    : 'NEUTRAL';
              } else if (agent.role === 'MOMENTUM_HUNTER') {
                liveMetric = `Confluence: ${consensus.alphaSignal.confluenceScore}/100`;
                stance = consensus.alphaSignal.directionalBias === 'LONG' ? 'BULLISH' : 'BEARISH';
              } else if (agent.role === 'CHIEF_RISK_OFFICER') {
                liveMetric = consensus.riskAudit.vetoTriggered
                  ? 'VETO TRIGGERED'
                  : `99% VaR: ${consensus.riskAudit.portfolioVar99Pct}%`;
                stance = consensus.riskAudit.vetoTriggered
                  ? 'VETO'
                  : consensus.riskAudit.haircutPercentage > 0
                  ? 'CAUTIONARY'
                  : 'BULLISH';
              } else if (agent.role === 'EXECUTION_ALGORIST') {
                liveMetric = `Route: ${consensus.executionPlan.routingAlgorithm}`;
                stance = consensus.riskAudit.vetoTriggered ? 'NEUTRAL' : 'BULLISH';
              }

              return (
                <div
                  key={agent.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white overflow-hidden">
                        {agent.name.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-white truncate">{agent.name}</div>
                        <div className="text-[10px] text-cyan-400 truncate">{agent.badge}</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {agent.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">{liveMetric}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono border ${getSentimentPill(stance)}`}>
                      {stance}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Executive Committee Consensus Card */}
          <div
            className={`p-5 rounded-2xl bg-gradient-to-br border shadow-xl transition-all ${getVerdictCardStyle(
              consensus.verdict
            )}`}
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
                      consensus.verdict === 'APPROVED_FULL'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : consensus.verdict === 'APPROVED_SCALED_DOWN'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    }`}
                  >
                    {consensus.verdict.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Confidence: <strong className="text-white">{consensus.confidenceScore}%</strong>
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
                  <span>{consensus.symbol}</span>
                  <span
                    className={`text-sm px-2 py-0.5 rounded font-mono font-bold ${
                      consensus.directionalBias === 'LONG'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {consensus.directionalBias}
                  </span>
                  <span className="text-sm font-normal text-slate-300">
                    @ ₹{consensus.alphaSignal.entryPrice.toFixed(2)}
                  </span>
                </h3>

                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {consensus.verdict === 'REJECTED_BY_RISK'
                    ? consensus.riskAudit.vetoReason
                    : consensus.verdict === 'REJECTED_BY_MACRO'
                    ? consensus.macroRegime.strategistComment
                    : `${consensus.alphaSignal.setupType}. ${consensus.riskAudit.officerComment}`}
                </p>
              </div>

              {/* Action Button */}
              <div className="flex flex-col items-stretch lg:items-end gap-2 w-full lg:w-auto">
                <button
                  onClick={handleDispatchOrder}
                  disabled={
                    consensus.verdict === 'REJECTED_BY_RISK' ||
                    consensus.verdict === 'REJECTED_BY_MACRO' ||
                    Boolean(executedNotice)
                  }
                  className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                    consensus.verdict === 'REJECTED_BY_RISK' || consensus.verdict === 'REJECTED_BY_MACRO'
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : executedNotice
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-900/30'
                  }`}
                >
                  {executedNotice ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Order Dispatched
                    </>
                  ) : consensus.verdict === 'REJECTED_BY_RISK' || consensus.verdict === 'REJECTED_BY_MACRO' ? (
                    <>
                      <XCircle className="w-4 h-4 text-rose-400" />
                      Execution Blocked by Committee
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Execute Approved Order ({consensus.riskAudit.approvedQuantity} Shares)
                    </>
                  )}
                </button>
                <div className="text-[11px] text-slate-500 text-center lg:text-right font-mono">
                  Route: {consensus.executionPlan.routingAlgorithm} &bull; Slices: {consensus.executionPlan.sliceCount}
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-4 mt-4 border-t border-slate-800/80 text-xs font-mono">
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase">Target (2.4R)</div>
                <div className="font-bold text-emerald-400 mt-0.5">₹{consensus.alphaSignal.targetPrice.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase">Stop Loss</div>
                <div className="font-bold text-rose-400 mt-0.5">₹{consensus.alphaSignal.stopLossPrice.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase">Approved Size</div>
                <div className="font-bold text-white mt-0.5">
                  {consensus.riskAudit.approvedQuantity}
                  <span className="text-[10px] text-slate-400 font-normal"> / {consensus.riskAudit.originalQuantity}</span>
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase">99% VaR</div>
                <div className="font-bold text-amber-300 mt-0.5">{consensus.riskAudit.portfolioVar99Pct}% Equity</div>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase">Est. Slippage</div>
                <div className="font-bold text-cyan-300 mt-0.5">{consensus.executionPlan.estimatedSlippageBps} bps</div>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase">Est. Taxes</div>
                <div className="font-bold text-rose-300 mt-0.5">₹{consensus.executionPlan.estimatedStatutoryTaxes.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Sequential Live Boardroom Debate Stream */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live Investment Committee Debate Transcript
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {consensus.debateRounds.length} Deliberation Rounds
              </span>
            </div>

            <div className="space-y-3">
              {consensus.debateRounds.slice(0, activeRound).map((round) => (
                <div
                  key={round.round}
                  className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2 animate-fadeIn"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-400 font-bold">
                        Round {round.round}
                      </span>
                      <span className="text-xs font-bold text-white">{round.agentName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">({round.role})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {round.keyMetricHighlight && (
                        <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 hidden sm:inline">
                          {round.keyMetricHighlight}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getSentimentPill(round.sentiment)}`}>
                        {round.sentiment}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans pl-1 border-l-2 border-cyan-500/40">
                    {round.statement}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>
              Autonomous Multi-Agent Quant Desk &bull; Client-Side Mathematical Consensus &bull; Zero Server Leakage
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors"
          >
            Close War Room
          </button>
        </div>
      </div>
    </div>
  );
};
