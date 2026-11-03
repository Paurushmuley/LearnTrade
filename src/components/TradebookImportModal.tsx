'use client';

import React, { useState } from 'react';
import {
  ClosedRoundTripTrade,
  BehavioralAuditReport,
  detectAndParseTradebookCSV,
  matchTradesFIFO,
  computeBehavioralAudit,
  generateTradebookAIPrompt,
  SAMPLE_ZERODHA_SCALPER_CSV,
  SAMPLE_GROWW_SWING_CSV,
} from '../lib/tradebookEngine';
import { AIConfig } from '../types/trading';
import { queryAIProvider } from '../lib/aiProvider';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Flame,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react';

interface TradebookImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiConfig: AIConfig;
  onOpenByok?: () => void;
}

export const TradebookImportModal: React.FC<TradebookImportModalProps> = ({
  isOpen,
  onClose,
  aiConfig,
  onOpenByok,
}) => {
  // Initialize with the realistic Zerodha scalper sample so the modal is instantly engaging
  const [currentRawCSV, setCurrentRawCSV] = useState<string>(SAMPLE_ZERODHA_SCALPER_CSV);
  const [activeBroker, setActiveBroker] = useState<string>('ZERODHA');
  const [closedTrades, setClosedTrades] = useState<ClosedRoundTripTrade[]>(() => {
    const parsed = detectAndParseTradebookCSV(SAMPLE_ZERODHA_SCALPER_CSV);
    return matchTradesFIFO(parsed.trades);
  });
  const [auditReport, setAuditReport] = useState<BehavioralAuditReport>(() => {
    const parsed = detectAndParseTradebookCSV(SAMPLE_ZERODHA_SCALPER_CSV);
    const matched = matchTradesFIFO(parsed.trades);
    return computeBehavioralAudit(matched);
  });

  const [activeTab, setActiveTab] = useState<'audit' | 'trades' | 'ai'>('audit');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const processCSVContent = (csvText: string) => {
    try {
      const parsed = detectAndParseTradebookCSV(csvText);
      const matched = matchTradesFIFO(parsed.trades);
      const report = computeBehavioralAudit(matched);

      setCurrentRawCSV(csvText);
      setActiveBroker(parsed.brokerDetected);
      setClosedTrades(matched);
      setAuditReport(report);
      setAiAnalysis(null); // Reset AI analysis on new import
    } catch (err) {
      console.error('Error parsing CSV statement:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) processCSVContent(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) processCSVContent(text);
    };
    reader.readAsText(file);
  };

  const handleRunAiAudit = async () => {
    setIsAiLoading(true);
    setAiAnalysis(null);

    const prompt = generateTradebookAIPrompt(auditReport, closedTrades);

    try {
      if (!aiConfig.geminiKey && !aiConfig.openaiKey && aiConfig.provider !== 'ollama') {
        setTimeout(() => {
          setAiAnalysis(
            `### 🧠 TradeCraft AI Behavioral Post-Mortem Diagnosis (Heuristic Mode)

**1. Psychological Profile & Identified Traps:**
- **Severe Disposition Effect (${auditReport.dispositionRatio}x):** You held losing trades an average of ${auditReport.avgLossHoldingMins} minutes while rushing out of winning trades within ${auditReport.avgWinHoldingMins} minutes. This asymmetry proves you suffer from "Hope-Based Bag Holding".
- **Revenge Trading Trap (${auditReport.revengeTradingIndex}% of executions):** ${auditReport.revengeTradeCount} trades were launched within 10 minutes of taking a loss, specifically escalating lot sizes (Martingale) in attempts to recoup capital.

**2. Mathematical Capital Leak (The Indian Tax Reality):**
- While gross P&L was ₹${auditReport.grossPnl.toLocaleString('en-IN')}, statutory fees (STT, NSE turnover charges, SEBI fees, GST) consumed ₹${auditReport.totalStatutoryFees.toLocaleString('en-IN')} (${auditReport.feeErosionRatio}% fee erosion).
- High-frequency churn in Indian equities is mathematically negative-expectancy when turnover exceeds 10x your average profit target.

**3. Actionable 3-Rule Prescription:**
1. **Mandatory 15-Minute Cooldown:** If a trade stops out, terminal access must be locked for 15 minutes to let cortisol subside.
2. **Hard Fixed 1% Risk:** Prohibit doubling position sizes after losing streaks. Risk must remain invariant.
3. **Breakeven-Trailing Rule:** Once a trade hits 1:1 R:R, move stop-loss to breakeven + charges to eliminate fee drag.

*(Tip: Connect your Google Gemini or OpenAI key in BYOK Settings for live real-time LLM audits).*`
          );
          setIsAiLoading(false);
        }, 600);
        return;
      }

      const res = await queryAIProvider(
        aiConfig,
        prompt,
        'You are a high-performance quantitative trading coach and behavioral psychologist for Indian financial markets.'
      );
      setAiAnalysis(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query AI provider';
      setAiAnalysis(`⚠️ AI Coach Analysis Error: ${msg}. Please check your BYOK API Key in Settings.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">Broker Tradebook Importer & AI Auditor</h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  {activeBroker} PARSED
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Audit real Zerodha & Groww contract statements for psychological biases, fee erosion, and revenge trading
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload Zone & Quick Sample Loaders */}
        <div className="border-b border-zinc-800 bg-zinc-900/30 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            {/* Drag & Drop File Target */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`md:col-span-2 relative flex items-center justify-between border-2 border-dashed rounded-lg px-4 py-2.5 transition-colors cursor-pointer ${
                isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex items-center gap-3">
                <UploadCloud className="h-5 w-5 text-zinc-400" />
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200">Upload Broker Tradebook (.csv)</span>
                  <span className="text-zinc-500 block text-[11px]">Supports Zerodha Kite tradebook & Groww order statements</span>
                </div>
              </div>
              <span className="text-[11px] font-medium bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded border border-zinc-700">
                Browse Files
              </span>
            </div>

            {/* Quick Demo Preloaders */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Quick Presets:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => processCSVContent(SAMPLE_ZERODHA_SCALPER_CSV)}
                  className="flex-1 text-[11px] font-medium py-1.5 px-2 bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 text-red-300 rounded flex items-center justify-center gap-1 transition-colors"
                  title="Loads a high-churn day with revenge trades, high STT taxes, and bag-holding"
                >
                  <Flame className="h-3 w-3 text-red-400" /> Zerodha Scalper
                </button>
                <button
                  onClick={() => processCSVContent(SAMPLE_GROWW_SWING_CSV)}
                  className="flex-1 text-[11px] font-medium py-1.5 px-2 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-300 rounded flex items-center justify-center gap-1 transition-colors"
                  title="Loads a disciplined swing trading statement with clean risk management"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Groww Swing
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Macro Scorecard Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-zinc-800 bg-zinc-900/40 divide-x divide-zinc-800">
          <div className="p-3">
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Closed Trades</span>
            <div className="text-base font-bold text-zinc-100 mt-0.5">{auditReport.totalClosedTrades} Rounds</div>
            <span className="text-[10px] text-zinc-500">FIFO matched</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Win Rate</span>
            <div className={`text-base font-bold mt-0.5 ${auditReport.winRatePct >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {auditReport.winRatePct}%
            </div>
            <span className="text-[10px] text-zinc-500">{auditReport.winCount}W / {auditReport.lossCount}L</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Gross P&L</span>
            <div className={`text-base font-bold mt-0.5 ${auditReport.grossPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {auditReport.grossPnl >= 0 ? '+' : ''}₹{auditReport.grossPnl.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-zinc-500">Pre-tax gain</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Statutory Taxes</span>
            <div className="text-base font-bold text-red-400 mt-0.5">
              -₹{auditReport.totalStatutoryFees.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-zinc-500">STT, GST, Brokerage</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Net Realized P&L</span>
            <div className={`text-base font-bold mt-0.5 ${auditReport.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {auditReport.netPnl >= 0 ? '+' : ''}₹{auditReport.netPnl.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-zinc-500">True take-home</span>
          </div>

          <div className="p-3 bg-zinc-900/60">
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Discipline Score</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-base font-extrabold ${
                auditReport.disciplineScore >= 75 ? 'text-emerald-400' : auditReport.disciplineScore >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {auditReport.disciplineScore}
              </span>
              <span className="text-xs text-zinc-500">/ 100</span>
            </div>
            <span className="text-[10px] text-zinc-400">
              {auditReport.disciplineScore >= 75 ? 'Institutional' : auditReport.disciplineScore >= 50 ? 'Moderate' : 'High Emotional Risk'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/20 px-6">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
                activeTab === 'audit'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Brain className="h-4 w-4" />
              Behavioral Biases & Scorecard
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
                activeTab === 'trades'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="h-4 w-4" />
              Closed Trades Ledger ({closedTrades.length})
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
                activeTab === 'ai'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="h-4 w-4 text-purple-400" />
              BYOK AI Post-Mortem Coach
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: BEHAVIORAL BIASES */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Primary Cognitive Bias Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Disposition Effect */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">Disposition Effect (Loss Bag-Holding)</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      auditReport.dispositionRatio > 1.8 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {auditReport.dispositionRatio}x Holding Ratio
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>Avg Win Duration: <strong className="text-emerald-400">{auditReport.avgWinHoldingMins} min</strong></span>
                    <span>Avg Loss Duration: <strong className="text-red-400">{auditReport.avgLossHoldingMins} min</strong></span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (auditReport.avgWinHoldingMins / (auditReport.avgWinHoldingMins + auditReport.avgLossHoldingMins || 1)) * 100)}%` }}></div>
                    <div className="bg-red-500 h-full" style={{ width: `${Math.min(100, (auditReport.avgLossHoldingMins / (auditReport.avgWinHoldingMins + auditReport.avgLossHoldingMins || 1)) * 100)}%` }}></div>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed">
                    {auditReport.dispositionRatio > 1.8 
                      ? '⚠️ Critical Hazard: You hold losing positions much longer than winning trades hoping for a miracle rebound instead of respecting protective stop-losses.'
                      : '✅ Healthy: Balanced trade exit timing between winning runs and losing stops.'}
                  </p>
                </div>

                {/* 2. Revenge Trading */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">Revenge Trading Vulnerability</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      auditReport.revengeTradingIndex > 10 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {auditReport.revengeTradingIndex}% of Trades
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>Immediate Re-entries: <strong className="text-amber-400">{auditReport.revengeTradeCount} trades</strong></span>
                    <span>Cooldown Threshold: <strong className="text-zinc-300">&lt;10 mins</strong></span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-4 leading-relaxed">
                    {auditReport.revengeTradeCount > 0
                      ? `⚠️ Identified ${auditReport.revengeTradeCount} trades opened immediately after taking a loss. Emotional retaliation against market swings severely erodes expectancy.`
                      : '✅ No impulsive re-entries detected after stopped-out trades.'}
                  </p>
                </div>

                {/* 3. Statutory Fee Erosion */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">Statutory Tax & Fee Erosion</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      auditReport.feeErosionRatio > 35 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {auditReport.feeErosionRatio}% Profit Drag
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>Total Taxes Paid: <strong className="text-red-400">₹{auditReport.totalStatutoryFees.toLocaleString('en-IN')}</strong></span>
                    <span>Brokerage & STT: <strong className="text-zinc-300">SEBI/NSE Mandated</strong></span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-4 leading-relaxed">
                    {auditReport.feeErosionRatio > 35
                      ? `⚠️ Overtrading alert: Statutory charges consumed ${auditReport.feeErosionRatio}% of gross earnings. You are essentially working for the broker and the tax collector.`
                      : '✅ Reasonable tax overhead relative to trading gains.'}
                  </p>
                </div>

                {/* 4. Martingale Sizing */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">Martingale Position Sizing</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      auditReport.martingaleCount > 0 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {auditReport.martingaleCount} Instances
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>Max Consecutive Losses: <strong className="text-zinc-200">{auditReport.maxConsecutiveLosses} in a row</strong></span>
                    <span>Sizing Escalation: <strong className={auditReport.martingaleCount > 0 ? 'text-red-400' : 'text-emerald-400'}>{auditReport.martingaleCount > 0 ? 'Detected' : 'None'}</strong></span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-4 leading-relaxed">
                    {auditReport.martingaleCount > 0
                      ? '⚠️ Detected aggressive position sizing expansion following losses. This exponential sizing model leads directly to risk of ruin.'
                      : '✅ Invariant or prudent sizing preserved across losing streaks.'}
                  </p>
                </div>
              </div>

              {/* Actionable Biases List */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                <h3 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Key Cognitive Findings & Prescriptions
                </h3>
                <div className="space-y-3">
                  {auditReport.biases.map((bias, idx) => (
                    <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200">{bias.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          bias.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                          bias.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {bias.scoreDisplay}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{bias.description}</p>
                      <div className="mt-2 text-xs font-medium text-indigo-400 flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3" />
                        <span>Prescription: {bias.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLOSED TRADES LEDGER */}
          {activeTab === 'trades' && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Entry &rarr; Exit Time</th>
                      <th className="py-2.5 px-3">Hold</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Entry &rarr; Exit Price</th>
                      <th className="py-2.5 px-3 text-right">Gross P&L</th>
                      <th className="py-2.5 px-3 text-right">Taxes/Fees</th>
                      <th className="py-2.5 px-3 text-right">Net P&L</th>
                      <th className="py-2.5 px-3">Behavioral Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {closedTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-bold text-zinc-100">{trade.symbol}</td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                          {trade.entryTime.split(' ')[1] || trade.entryTime} &rarr; {trade.exitTime.split(' ')[1] || trade.exitTime}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-300">{trade.holdingMinutes}m</td>
                        <td className="py-2.5 px-3 text-zinc-300">{trade.quantity}</td>
                        <td className="py-2.5 px-3 text-zinc-300">
                          ₹{trade.entryPrice} &rarr; ₹{trade.exitPrice}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${trade.grossPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {trade.grossPnl >= 0 ? '+' : ''}₹{trade.grossPnl}
                        </td>
                        <td className="py-2.5 px-3 text-right text-red-400/90">-₹{trade.statutoryFees}</td>
                        <td className={`py-2.5 px-3 text-right font-extrabold ${trade.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {trade.netPnl >= 0 ? '+' : ''}₹{trade.netPnl}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex flex-wrap gap-1">
                            {trade.tags.length === 0 ? (
                              <span className="text-[10px] text-zinc-500 italic">None</span>
                            ) : (
                              trade.tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                    t === 'Revenge Trade' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                                    t === 'Martingale Sizing' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                                    t === 'Fee Trap' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                                    'bg-zinc-800 text-zinc-300 border-zinc-700'
                                  }`}
                                >
                                  {t}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BYOK AI POST-MORTEM COACH */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      AI Cognitive & Behavioral Post-Mortem Debrief
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Synthesizes cognitive biases, tax leakages, and custom rules using your BYOK model
                    </p>
                  </div>
                  <button
                    onClick={handleRunAiAudit}
                    disabled={isAiLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                  >
                    {isAiLoading ? (
                      <>
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyzing Psychology...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5" />
                        Generate AI Audit Debrief
                      </>
                    )}
                  </button>
                </div>

                {/* AI Output Card */}
                {aiAnalysis ? (
                  <div className="mt-4 rounded-lg bg-zinc-950 p-4 border border-zinc-800 font-sans text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="mt-6 text-center py-10 px-4 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50">
                    <Brain className="h-10 w-10 text-indigo-400/50 mx-auto mb-2" />
                    <p className="text-xs text-zinc-300 font-semibold">No AI audit generated for this statement yet.</p>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-md mx-auto">
                      Click the &quot;Generate AI Audit Debrief&quot; button above to prompt your BYOK provider for an institutional risk debrief.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
