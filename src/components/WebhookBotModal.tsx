'use client';

import React, { useEffect, useState } from 'react';
import { DEFAULT_BOT, generatePineScriptTemplate, WebhookBot, WebhookLog } from '../lib/webhookEngine';
import { AlertTriangle, Check, CheckCircle2, Code, Copy, Cpu, Play, RefreshCw, Send, ShieldAlert, X, Zap } from 'lucide-react';

interface WebhookBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderExecutedFromWebhook?: () => void;
}

export const WebhookBotModal: React.FC<WebhookBotModalProps> = ({
  isOpen,
  onClose,
  onOrderExecutedFromWebhook,
}) => {
  const [bot, setBot] = useState<WebhookBot>(DEFAULT_BOT);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPine, setCopiedPine] = useState(false);
  const [activeTab, setActiveTab] = useState<'playground' | 'pinescript' | 'logs'>('playground');

  // Test Playground state
  const [testSymbol, setTestSymbol] = useState('RELIANCE');
  const [testSide, setTestSide] = useState<'BUY' | 'SELL'>('BUY');
  const [testQuantity, setTestQuantity] = useState(50);
  const [testType, setTestType] = useState('MARKET');
  const [testResult, setTestResult] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);

  // Live Logs
  const [logs, setLogs] = useState<WebhookLog[]>([]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100';
  const webhookUrl = `${origin}/api/webhook`;
  const pineScriptCode = generatePineScriptTemplate(webhookUrl, bot.secretToken, testSymbol);

  // Fetch recent logs from API
  const refreshLogs = async () => {
    try {
      const res = await fetch('/api/webhook');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.recentLogs || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'url' | 'token' | 'pine') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedPine(true);
      setTimeout(() => setCopiedPine(false), 2000);
    }
  };

  const handleSendTestWebhook = async () => {
    setIsSending(true);
    setTestResult(null);

    const payload = {
      token: bot.secretToken,
      botName: bot.name,
      symbol: testSymbol,
      side: testSide,
      quantity: testQuantity,
      type: testType,
      product: 'MIS',
      comment: 'TradeCraft Interactive Webhook Playground Test',
    };

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTestResult({
        httpStatus: res.status,
        success: data.success,
        ...data,
      });

      if (data.success && onOrderExecutedFromWebhook) {
        onOrderExecutedFromWebhook();
      }

      refreshLogs();
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F141F] border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col text-xs max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0B0E14]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">TradingView Webhook Bot Gateway</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  bot.enabled ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800' : 'bg-rose-950/60 text-rose-400'
                }`}>
                  {bot.enabled ? 'GATEWAY ACTIVE' : 'GATEWAY PAUSED'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Automated paper order execution from TradingView alerts & external Python bots</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Webhook Endpoint & Secret Key Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Webhook Ingestion URL</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-blue-400 font-mono text-[11px] select-all focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(webhookUrl, 'url')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center gap-1 text-[11px] shrink-0"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Accepts HTTP POST requests with JSON payloads</span>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Bot Secret Token (Authentication)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  readOnly
                  value={bot.secretToken}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-emerald-400 font-mono text-[11px] select-all focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(bot.secretToken, 'token')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center gap-1 text-[11px] shrink-0"
                >
                  {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Include in your JSON as <code className="text-slate-400">"token"</code></span>
            </div>
          </div>

          {/* Circuit Breaker Protection Card */}
          <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <strong className="text-slate-200 block text-xs">Automated Risk Circuit Breaker: ₹{bot.maxDailyLoss.toLocaleString('en-IN')}</strong>
                <span className="text-[11px] text-slate-400">If bot losses cross this threshold, automated triggers are rejected immediately to protect capital.</span>
              </div>
            </div>
            <button
              onClick={() => setBot(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                bot.enabled ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
              }`}
            >
              {bot.enabled ? 'Pause Webhook Gateway' : 'Resume Webhook Gateway'}
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('playground')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'playground' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Simulation Playground</span>
            </button>
            <button
              onClick={() => setActiveTab('pinescript')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'pinescript' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>PineScript v5 Template</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('logs');
                refreshLogs();
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'logs' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Audit Trail Logs ({logs.length})</span>
            </button>
          </div>

          {/* TAB 1: SIMULATION PLAYGROUND */}
          {activeTab === 'playground' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">Symbol</span>
                  <select
                    value={testSymbol}
                    onChange={(e) => setTestSymbol(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-bold"
                  >
                    <option value="RELIANCE">RELIANCE</option>
                    <option value="NIFTY 50">NIFTY 50</option>
                    <option value="BANKNIFTY">BANKNIFTY</option>
                    <option value="TCS">TCS</option>
                    <option value="HDFCBANK">HDFCBANK</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">Action (Side)</span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setTestSide('BUY')}
                      className={`py-1 rounded font-bold text-[10px] ${
                        testSide === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400'
                      }`}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestSide('SELL')}
                      className={`py-1 rounded font-bold text-[10px] ${
                        testSide === 'SELL' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400'
                      }`}
                    >
                      SELL
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">Quantity</span>
                  <input
                    type="number"
                    value={testQuantity}
                    onChange={(e) => setTestQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">Order Type</span>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
                  >
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">
                  Fires a simulated HTTP POST to <code className="text-blue-300">/api/webhook</code> with authentic Indian statutory taxes.
                </span>
                <button
                  type="button"
                  onClick={handleSendTestWebhook}
                  disabled={isSending || !bot.enabled}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSending ? 'Sending Webhook...' : 'Fire Test Alert'}
                </button>
              </div>

              {/* Response Card */}
              {testResult && (
                <div className={`p-3 rounded-xl border font-mono text-[11px] space-y-1 ${
                  testResult.success ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}>
                  <div className="flex items-center justify-between font-bold border-b border-slate-800/80 pb-1 font-sans">
                    <span className="flex items-center gap-1">
                      {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      Webhook Response (HTTP {testResult.httpStatus || 200})
                    </span>
                    <span>Latency: {testResult.latencyMs || 12}ms</span>
                  </div>
                  {testResult.success ? (
                    <div>
                      <p><strong>Order ID:</strong> {testResult.orderId}</p>
                      <p><strong>Executed:</strong> {testResult.side} {testResult.quantity}x {testResult.symbol} @ ₹{testResult.executedPrice}</p>
                      <p className="text-amber-300"><strong>Statutory Taxes Deducted:</strong> ₹{testResult.statutoryTaxes}</p>
                    </div>
                  ) : (
                    <p><strong>Error:</strong> {testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PINESCRIPT V5 TEMPLATE */}
          {activeTab === 'pinescript' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Copy-Paste into TradingView Pine Editor:</span>
                <button
                  onClick={() => handleCopy(pineScriptCode, 'pine')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg flex items-center gap-1 font-mono text-[11px]"
                >
                  {copiedPine ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedPine ? 'Copied' : 'Copy PineScript'}</span>
                </button>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
                <pre>{pineScriptCode}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TRAIL LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                  <Cpu className="h-8 w-8 mb-2 opacity-40" />
                  <p>No webhook alerts received yet. Send a test alert from the playground above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-slate-950 text-slate-400 text-[10px]">
                      <tr>
                        <th className="p-2">Timestamp</th>
                        <th className="p-2">Symbol</th>
                        <th className="p-2">Side</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">Price</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Taxes</th>
                        <th className="p-2 text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                      {logs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-900/40">
                          <td className="p-2 text-slate-400">{new Date(l.timestamp).toLocaleTimeString()}</td>
                          <td className="p-2 font-bold text-slate-200">{l.symbol}</td>
                          <td className={`p-2 font-bold ${l.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{l.side}</td>
                          <td className="p-2 text-slate-300">{l.quantity}</td>
                          <td className="p-2 text-slate-100">₹{l.price}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              l.status === 'FILLED' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="p-2 text-amber-400">₹{l.statutoryTaxes}</td>
                          <td className="p-2 text-right text-slate-400">{l.latencyMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
