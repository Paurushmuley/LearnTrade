'use client';

import React, { useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  FileSpreadsheet,
  Layers,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Terminal,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  FixMessage,
  FixNewOrderParams,
  FixSessionState,
  DropCopyRecord,
  FixMsgType,
} from '../types/fix';
import {
  createNewOrderSingle,
  createHeartbeatMessage,
  createLogonMessage,
  getInitialFixSession,
  simulateExchangeExecution,
  TAG_DICTIONARY,
  VISUAL_DELIMITER,
} from '../lib/fixEngine';

interface FixProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSymbol?: string;
  currentPrice?: number;
}

export const FixProtocolModal: React.FC<FixProtocolModalProps> = ({
  isOpen,
  onClose,
  currentSymbol = 'NIFTY',
  currentPrice = 24500,
}) => {
  const [session, setSession] = useState<{
    sessionState: FixSessionState;
    messages: FixMessage[];
    dropCopies: DropCopyRecord[];
  }>(() => getInitialFixSession());

  const [activeTab, setActiveTab] = useState<'stream' | 'injector' | 'dropcopy' | 'dictionary'>('stream');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<FixMessage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual Injector Form State
  const [orderForm, setOrderForm] = useState<FixNewOrderParams>({
    symbol: currentSymbol,
    side: '1',
    orderQty: 50,
    ordType: '2',
    price: currentPrice,
    timeInForce: '0',
  });

  if (!isOpen) return null;

  // Handle Manual Order Injection
  const handleInjectOrder = () => {
    const { sessionState, messages, dropCopies } = session;
    const clientSeq = sessionState.outSeqNum;

    // 1. Generate client order
    const newOrder = createNewOrderSingle(
      orderForm,
      clientSeq,
      sessionState.senderCompId,
      sessionState.targetCompId
    );

    // 2. Simulate matching engine response
    const sim = simulateExchangeExecution(
      newOrder.parsed,
      sessionState.inSeqNum,
      orderForm.price || currentPrice
    );

    // 3. Update state
    setSession({
      sessionState: {
        ...sessionState,
        outSeqNum: clientSeq + 1,
        inSeqNum: sim.nextExchangeSeqNum,
        messagesProcessed: sessionState.messagesProcessed + 1 + sim.executionReports.length,
      },
      messages: [newOrder.parsed, ...sim.executionReports, ...messages],
      dropCopies: [...sim.dropCopies, ...dropCopies],
    });

    setSelectedMessage(newOrder.parsed);
    setActiveTab('stream');
  };

  // Quick Preset Orders
  const applyPreset = (symbol: string, side: '1' | '2', qty: number, type: '1' | '2', px: number) => {
    setOrderForm({
      symbol,
      side,
      orderQty: qty,
      ordType: type,
      price: px,
      timeInForce: '0',
    });
  };

  // Send Heartbeat
  const handleSendHeartbeat = () => {
    const { sessionState, messages, dropCopies } = session;
    const clientSeq = sessionState.outSeqNum;
    const hb = createHeartbeatMessage(clientSeq, sessionState.senderCompId, sessionState.targetCompId);

    setSession({
      sessionState: {
        ...sessionState,
        outSeqNum: clientSeq + 1,
        messagesProcessed: sessionState.messagesProcessed + 1,
      },
      messages: [hb.parsed, ...messages],
      dropCopies,
    });
  };

  // Copy raw FIX string
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text.replace(/\x01/g, '|'));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filter messages
  const filteredMessages = session.messages.filter((msg) => {
    if (filterType !== 'ALL' && msg.msgType !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      msg.raw.toLowerCase().includes(q) ||
      msg.msgTypeName.toLowerCase().includes(q) ||
      msg.senderCompId.toLowerCase().includes(q) ||
      msg.targetCompId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-6xl max-h-[92vh] rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                  FIX 4.4 Protocol Gateway
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-semibold">
                  TAG-VALUE WIRE SPEC
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {session.sessionState.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>Sender: <strong className="text-slate-300 font-mono">{session.sessionState.senderCompId}</strong></span>
                <span>•</span>
                <span>Target: <strong className="text-slate-300 font-mono">{session.sessionState.targetCompId}</strong></span>
                <span>•</span>
                <span>OutSeq: <strong className="text-cyan-400 font-mono">#{session.sessionState.outSeqNum}</strong></span>
                <span>•</span>
                <span>InSeq: <strong className="text-emerald-400 font-mono">#{session.sessionState.inSeqNum}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendHeartbeat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              title="Dispatch Heartbeat (35=0) to keep session alive"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <span>Ping Heartbeat (35=0)</span>
            </button>

            <button
              onClick={() => setSession(getInitialFixSession())}
              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
              title="Reset FIX Session"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-950/40 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('stream')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'stream'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Live Tag Stream ({filteredMessages.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('injector')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'injector'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Order Injector (35=D)</span>
            </button>

            <button
              onClick={() => setActiveTab('dropcopy')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'dropcopy'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Drop-Copy Audit ({session.dropCopies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('dictionary')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'dictionary'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Tag Dictionary</span>
            </button>
          </div>

          {activeTab === 'stream' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by tag or value..."
                  className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All MsgTypes</option>
                <option value="D">NewOrderSingle (35=D)</option>
                <option value="8">ExecutionReport (35=8)</option>
                <option value="0">Heartbeat (35=0)</option>
                <option value="A">Logon (35=A)</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab Content 1: Live Stream */}
        {activeTab === 'stream' && (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Stream List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 border-r border-slate-800/60">
              {filteredMessages.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  No FIX messages matching criteria
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isOutbound = msg.direction === 'OUTBOUND';
                  const isSelected = selectedMessage?.id === msg.id;

                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono flex items-center gap-1 ${
                              isOutbound
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {isOutbound ? (
                              <ArrowUpRight className="h-3 w-3 text-blue-400" />
                            ) : (
                              <ArrowDownLeft className="h-3 w-3 text-emerald-400" />
                            )}
                            {msg.direction}
                          </span>

                          <span className="text-xs font-semibold text-slate-200">
                            {msg.msgTypeName} <span className="text-slate-400 font-mono">(35={msg.msgType})</span>
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono">
                            Seq #{msg.seqNum}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {msg.latencyMs !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                              ⚡ {msg.latencyMs}ms
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> 10={msg.checksum}
                          </span>
                        </div>
                      </div>

                      {/* Raw Packet String */}
                      <div className="p-2 rounded-lg bg-black/50 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all flex items-start justify-between gap-2">
                        <span className="line-clamp-2">
                          {msg.raw.replace(/\x01/g, ' | ')}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(msg.raw, msg.id);
                          }}
                          className="p-1 text-slate-400 hover:text-white rounded bg-slate-800/80 flex-shrink-0"
                          title="Copy raw message"
                        >
                          {copiedId === msg.id ? (
                            <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Inspector Panel */}
            <div className="w-full md:w-96 p-4 bg-[#0A0E17] overflow-y-auto flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                  Tag Inspector
                </span>
                {selectedMessage && (
                  <span className="text-[10px] font-mono text-cyan-400">
                    {selectedMessage.fields.length} Fields Parsed
                  </span>
                )}
              </div>

              {selectedMessage ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                    <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Message Header</div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <div><span className="text-slate-500">MsgType:</span> <strong className="text-cyan-300 font-mono">{selectedMessage.msgType} ({selectedMessage.msgTypeName})</strong></div>
                      <div><span className="text-slate-500">SeqNum:</span> <strong className="text-slate-200 font-mono">#{selectedMessage.seqNum}</strong></div>
                      <div><span className="text-slate-500">Sender:</span> <strong className="text-slate-300 font-mono">{selectedMessage.senderCompId}</strong></div>
                      <div><span className="text-slate-500">Target:</span> <strong className="text-slate-300 font-mono">{selectedMessage.targetCompId}</strong></div>
                    </div>
                  </div>

                  {/* Parsed Fields Table */}
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase text-slate-500 font-bold px-1">Decoded Tags</div>
                    <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60 bg-slate-900/40">
                      {selectedMessage.fields.map((field, i) => (
                        <div key={i} className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-800/40 transition">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                              Tag {field.tag}
                            </span>
                            <span className="text-[11px] text-slate-300 font-medium">{field.name}</span>
                          </div>
                          <span className="font-mono text-xs font-semibold text-emerald-400">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Select a message from the stream to inspect individual FIX tags.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Order Injector */}
        {activeTab === 'injector' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-1">
                <Send className="h-4 w-4 text-cyan-400" />
                Manual FIX 4.4 NewOrderSingle (35=D) Injection Terminal
              </h3>
              <p className="text-xs text-slate-400">
                Compose institutional FIX orders on the fly. The message is serialized into raw wire format, injected into the virtual socket, and executed by the synthetic matching engine.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Quick Preset Templates:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyPreset('RELIANCE', '1', 100, '2', 2495.5)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  Buy 100 RELIANCE @ Limit ₹2,495.50
                </button>
                <button
                  onClick={() => applyPreset('TCS', '1', 50, '2', 3850.0)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  Buy 50 TCS @ Limit ₹3,850.00
                </button>
                <button
                  onClick={() => applyPreset('INFY', '2', 200, '1', 1845.0)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  Sell 200 INFY @ MKT
                </button>
                <button
                  onClick={() => applyPreset('NIFTY', '1', 75, '2', 24500.0)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  Buy 75 NIFTY @ Limit ₹24,500
                </button>
              </div>
            </div>

            {/* Form Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tag 55: Symbol</label>
                <input
                  type="text"
                  value={orderForm.symbol}
                  onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tag 54: Side</label>
                <select
                  value={orderForm.side}
                  onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value as '1' | '2' })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="1">1 = Buy</option>
                  <option value="2">2 = Sell</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tag 38: OrderQty</label>
                <input
                  type="number"
                  value={orderForm.orderQty}
                  onChange={(e) => setOrderForm({ ...orderForm, orderQty: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tag 40: OrdType</label>
                <select
                  value={orderForm.ordType}
                  onChange={(e) => setOrderForm({ ...orderForm, ordType: e.target.value as '1' | '2' })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="2">2 = Limit Order</option>
                  <option value="1">1 = Market Order</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tag 44: Price (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  disabled={orderForm.ordType === '1'}
                  value={orderForm.price || ''}
                  onChange={(e) => setOrderForm({ ...orderForm, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tag 59: TimeInForce</label>
                <select
                  value={orderForm.timeInForce}
                  onChange={(e) => setOrderForm({ ...orderForm, timeInForce: e.target.value as '0' | '1' | '3' })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="0">0 = Day</option>
                  <option value="1">1 = Good 'Til Cancel (GTC)</option>
                  <option value="3">3 = Immediate or Cancel (IOC)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleInjectOrder}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 transition hover:scale-105"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Inject FIX 4.4 Order (35=D)</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Content 3: Drop-Copy Audit */}
        {activeTab === 'dropcopy' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Institutional Drop-Copy Compliance Journal
                </h3>
                <p className="text-xs text-slate-400">
                  Read-only asynchronous mirror stream of all executions, risk acknowledgments, and partial fills for post-trade surveillance.
                </p>
              </div>

              <button
                onClick={() => {
                  const csv = [
                    'Timestamp,ClOrdID,OrderID,ExecID,Symbol,Side,Qty,CumQty,LeavesQty,Price,Status',
                    ...session.dropCopies.map(
                      (dc) =>
                        `${dc.timestamp},${dc.clOrdID},${dc.orderID},${dc.execID},${dc.symbol},${dc.side},${dc.orderQty},${dc.cumQty},${dc.leavesQty},${dc.avgPx},${dc.ordStatusLabel}`
                    ),
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `fix_drop_copy_${Date.now()}.csv`;
                  a.click();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">ClOrdID</th>
                      <th className="p-3">ExecID</th>
                      <th className="p-3">Symbol</th>
                      <th className="p-3">Side</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">CumQty</th>
                      <th className="p-3">Leaves</th>
                      <th className="p-3">Avg Px</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {session.dropCopies.map((dc) => (
                      <tr key={dc.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3 text-slate-400 text-[11px]">{dc.timestamp.split('-')[1] || dc.timestamp}</td>
                        <td className="p-3 text-cyan-300 font-semibold">{dc.clOrdID}</td>
                        <td className="p-3 text-slate-400">{dc.execID}</td>
                        <td className="p-3 text-slate-200 font-bold">{dc.symbol}</td>
                        <td className="p-3">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              dc.side === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {dc.side}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{dc.orderQty}</td>
                        <td className="p-3 text-emerald-400 font-semibold">{dc.cumQty}</td>
                        <td className="p-3 text-slate-400">{dc.leavesQty}</td>
                        <td className="p-3 text-slate-100">₹{dc.avgPx.toFixed(2)}</td>
                        <td className="p-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-sans">
                            {dc.ordStatusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 4: Tag Dictionary */}
        {activeTab === 'dictionary' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-400" />
                FIX 4.4 Tag Dictionary Reference
              </h3>
              <p className="text-xs text-slate-400">
                Standard institutional tag mappings used across National Stock Exchange of India (NSE) and Bombay Stock Exchange (BSE).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(TAG_DICTIONARY).map(([tagStr, item]) => (
                <div key={tagStr} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-cyan-400 font-bold">Tag {tagStr}</span>
                    <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {item.category}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-200">{item.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Socket Active (Zero-Lag)
            </span>
            <span>•</span>
            <span>Heartbeat: <strong>30s</strong></span>
            <span>•</span>
            <span>Protocol: <strong>FIX.4.4</strong></span>
          </div>

          <div className="text-[11px] text-slate-400">
            Total Messages: <strong className="text-slate-200 font-mono">{session.messages.length}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
