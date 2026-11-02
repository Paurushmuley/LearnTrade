'use client';

import React, { useState } from 'react';
import { AIConfig, Order, Position, TradeAudit } from '../types/trading';
import { AlertTriangle, BookOpen, Brain, CheckCircle2, Clock, ListFilter, Send, ShieldAlert, XCircle } from 'lucide-react';
import { queryAIProvider } from '../lib/aiProvider';

interface PortfolioDrawerProps {
  positions: Position[];
  orders: Order[];
  tradeAudits: TradeAudit[];
  aiConfig: AIConfig;
  onSquareOff: (symbol: string, product: any) => void;
}

export const PortfolioDrawer: React.FC<PortfolioDrawerProps> = ({
  positions,
  orders,
  tradeAudits,
  aiConfig,
  onSquareOff,
}) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'journal' | 'coach'>('positions');
  const [coachInput, setCoachInput] = useState('');
  const [coachChat, setCoachChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Hello trader! I am your personal AI Trading Coach and Risk Manager. I monitor your paper executions in real-time, audit statutory tax drag, and flag cognitive biases like revenge trading or FOMO. How can I help with your strategy today?',
    },
  ]);
  const [isCoachThinking, setIsCoachThinking] = useState(false);

  const handleSendCoach = async () => {
    if (!coachInput.trim()) return;
    const userText = coachInput;
    setCoachInput('');
    setCoachChat(prev => [...prev, { role: 'user', text: userText }]);
    setIsCoachThinking(true);

    try {
      if (!aiConfig.geminiKey && !aiConfig.openaiKey && aiConfig.provider !== 'ollama') {
        setTimeout(() => {
          setCoachChat(prev => [
            ...prev,
            {
              role: 'assistant',
              text: `[BYOK Required] To get dynamic real-time AI responses tailored to your portfolio, please configure your free Google Gemini API key or local Ollama endpoint in the "Setup BYOK Key" settings at the top right! Meanwhile, your automated heuristic post-trade behavioral audits remain active in the "Trade Journal" tab.`,
            },
          ]);
          setIsCoachThinking(false);
        }, 600);
        return;
      }

      const portfolioContext = `Active Positions: ${positions.length ? positions.map(p => `${p.symbol} (${p.quantity} @ ₹${p.averagePrice})`).join(', ') : 'None'}. Recent Closed Trades: ${tradeAudits.length}.`;
      const response = await queryAIProvider(
        aiConfig,
        `Trader Portfolio Context: ${portfolioContext}\nTrader Question: ${userText}`,
        'You are an expert institutional trading psychologist and risk management mentor for Indian equity markets. Provide direct, highly disciplined, actionable advice. Emphasize risk-reward and capital preservation.'
      );

      setCoachChat(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (err: any) {
      setCoachChat(prev => [...prev, { role: 'assistant', text: `Error connecting to AI Provider: ${err.message}` }]);
    } finally {
      setIsCoachThinking(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#0F141F] border border-slate-800 rounded-xl overflow-hidden shadow-xl text-xs h-[280px] lg:h-[320px]">
      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#0B0E14] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'positions' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Open Positions</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-slate-300 border border-slate-800">
              {positions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'orders' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Order Ledger</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-slate-300 border border-slate-800">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'journal' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-amber-400" />
            <span>AI Trade Journal</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-amber-400 border border-slate-800">
              {tradeAudits.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('coach')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'coach' ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/80' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            <span>Ask AI Coach</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-auto p-3">
        {/* TAB 1: OPEN POSITIONS */}
        {activeTab === 'positions' && (
          <div>
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <ListFilter className="h-8 w-8 mb-2 opacity-40" />
                <p>No open positions. Place an order from the trade ticket to begin.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                      <th className="pb-2">Symbol</th>
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Avg Price</th>
                      <th className="pb-2">LTP</th>
                      <th className="pb-2">Unrealized P&L</th>
                      <th className="pb-2">Taxes Paid</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {positions.map((pos) => (
                      <tr key={`${pos.symbol}-${pos.product}`} className="hover:bg-slate-900/40">
                        <td className="py-2 font-bold text-slate-200 font-sans">{pos.symbol}</td>
                        <td className="py-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                            {pos.product}
                          </span>
                        </td>
                        <td className={`py-2 font-bold ${pos.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.quantity > 0 ? `+${pos.quantity}` : pos.quantity}
                        </td>
                        <td className="py-2 text-slate-300">₹{pos.averagePrice}</td>
                        <td className="py-2 text-slate-100 font-semibold">₹{pos.currentPrice}</td>
                        <td className={`py-2 font-bold ${pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.unrealizedPnL >= 0 ? '+' : ''}₹{pos.unrealizedPnL.toFixed(2)}
                        </td>
                        <td className="py-2 text-amber-400">₹{pos.totalChargesPaid}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => onSquareOff(pos.symbol, pos.product)}
                            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded font-sans text-[11px] font-semibold transition"
                          >
                            Square Off
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER LEDGER */}
        {activeTab === 'orders' && (
          <div>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p>No orders placed in this session yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Order ID</th>
                      <th className="pb-2">Symbol</th>
                      <th className="pb-2">Side</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Price</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Statutory Charges</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-900/40">
                        <td className="py-2 text-slate-400 text-[10px]">
                          {new Date(ord.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2 text-slate-300 font-semibold">{ord.id}</td>
                        <td className="py-2 font-bold text-slate-200 font-sans">{ord.symbol}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ord.side === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {ord.side}
                          </span>
                        </td>
                        <td className="py-2 text-slate-400 text-[10px]">{ord.type} ({ord.product})</td>
                        <td className="py-2 text-slate-200">{ord.quantity}</td>
                        <td className="py-2 text-slate-200">₹{ord.executedPrice || ord.price || 'MKT'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ord.status === 'FILLED' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/60' : 'bg-amber-900/40 text-amber-300'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-2 text-right text-amber-400">₹{ord.charges.totalCharges}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI TRADE JOURNAL & BEHAVIORAL AUDITOR */}
        {activeTab === 'journal' && (
          <div className="space-y-3">
            {tradeAudits.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <Brain className="h-8 w-8 mb-2 opacity-40 text-amber-400" />
                <p>No completed trades audited yet. When you square off a position, your AI Coach will analyze the execution here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tradeAudits.map((audit) => (
                  <div
                    key={audit.tradeId}
                    className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 relative overflow-hidden"
                  >
                    {/* Top Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{audit.symbol}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          audit.side === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          {audit.side} {audit.quantity} Qty
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold font-mono text-sm ${audit.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {audit.netPnL >= 0 ? '+' : ''}₹{audit.netPnL} Net
                        </span>
                        <span className="block text-[10px] text-slate-400">Tax Drag: ₹{audit.charges}</span>
                      </div>
                    </div>

                    {/* Behavioral Flags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {audit.behavioralFlags.revengeTrade && (
                        <span className="px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300 text-[10px] flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Revenge Trading Detected (-6 PQ)
                        </span>
                      )}
                      {audit.behavioralFlags.fomoEntry && (
                        <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-amber-300 text-[10px] flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Chased Extended Candle (FOMO)
                        </span>
                      )}
                      {audit.behavioralFlags.overleveraged && (
                        <span className="px-2 py-0.5 rounded bg-orange-950/70 border border-orange-800 text-orange-300 text-[10px] flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> High Leverage Exposure
                        </span>
                      )}
                      {!audit.behavioralFlags.revengeTrade && !audit.behavioralFlags.fomoEntry && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Disciplined Execution (+2 PQ)
                        </span>
                      )}
                    </div>

                    {/* Coach Feedback */}
                    <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1">
                      <p className="text-slate-300 italic">"{audit.coachFeedback}"</p>
                      <p className="text-blue-400 font-semibold">Recommended: {audit.suggestedAction}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ASK AI COACH CHAT */}
        {activeTab === 'coach' && (
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-2.5 overflow-y-auto max-h-[170px] pr-2">
              {coachChat.map((msg, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl text-xs max-w-[85%] ${
                    msg.role === 'user'
                      ? 'ml-auto bg-blue-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold opacity-60 mb-0.5">
                    {msg.role === 'user' ? 'YOU' : 'AI TRADING COACH'}
                  </div>
                  <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                </div>
              ))}
              {isCoachThinking && (
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 italic flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                  Coach analyzing risk parameters & market conditions...
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800 mt-2">
              <input
                type="text"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCoach()}
                placeholder="Ask about your risk/reward, exit rules, or market setup..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSendCoach}
                disabled={isCoachThinking}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1 transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
