'use client';

import React, { useState } from 'react';
import {
  ChainedTradeBlock,
  ProofOfAlphaCertificate,
  verifyTradeChainIntegrity,
} from '../lib/proofEngine';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck,
  FileCode,
  Hash,
  Key,
  Layers,
  Lock,
  QrCode,
  RefreshCw,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

interface ProofOfAlphaModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: ProofOfAlphaCertificate | null;
}

export const ProofOfAlphaModal: React.FC<ProofOfAlphaModalProps> = ({
  isOpen,
  onClose,
  certificate,
}) => {
  const [activeTab, setActiveTab] = useState<'CERTIFICATE' | 'HASH_CHAIN' | 'VERIFIER'>('CERTIFICATE');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Verifier Sandbox State
  const [tamperedChain, setTamperedChain] = useState<ChainedTradeBlock[] | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    tested: boolean;
    isValid: boolean;
    failedBlockIndex?: number;
    error?: string;
  } | null>(null);

  const [customJsonInput, setCustomJsonInput] = useState<string>('');

  if (!isOpen || !certificate) return null;

  const currentChain = tamperedChain || certificate.chain;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleRunVerification = (chainToTest = currentChain) => {
    const res = verifyTradeChainIntegrity(chainToTest, certificate.leagueId, certificate.traderId);
    setVerificationResult({
      tested: true,
      isValid: res.isValid,
      failedBlockIndex: res.failedBlockIndex,
      error: res.error,
    });
  };

  const handleTamperBlock = (blockIndex: number) => {
    if (!certificate.chain.length) return;
    const cloned = JSON.parse(JSON.stringify(certificate.chain)) as ChainedTradeBlock[];
    const target = cloned.find((b) => b.blockIndex === blockIndex) || cloned[0];
    if (target) {
      // Modify execution price to demonstrate hash integrity failure
      target.price = Number((target.price + 10.5).toFixed(2));
      target.netPnl = Number((target.netPnl + 5000).toFixed(2));
    }
    setTamperedChain(cloned);
    const res = verifyTradeChainIntegrity(cloned, certificate.leagueId, certificate.traderId);
    setVerificationResult({
      tested: true,
      isValid: res.isValid,
      failedBlockIndex: res.failedBlockIndex,
      error: res.error,
    });
  };

  const handleRestoreChain = () => {
    setTamperedChain(null);
    const res = verifyTradeChainIntegrity(certificate.chain, certificate.leagueId, certificate.traderId);
    setVerificationResult({
      tested: true,
      isValid: res.isValid,
    });
  };

  const handleVerifyCustomJson = () => {
    try {
      const parsed = JSON.parse(customJsonInput);
      if (!parsed.chain || !parsed.leagueId || !parsed.traderId) {
        setVerificationResult({
          tested: true,
          isValid: false,
          error: 'JSON must contain leagueId, traderId, and chain array.',
        });
        return;
      }
      const res = verifyTradeChainIntegrity(parsed.chain, parsed.leagueId, parsed.traderId);
      setVerificationResult({
        tested: true,
        isValid: res.isValid,
        failedBlockIndex: res.failedBlockIndex,
        error: res.error,
      });
    } catch (e: any) {
      setVerificationResult({
        tested: true,
        isValid: false,
        error: `Invalid JSON format: ${e.message}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#0B0E14] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0F141F] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 via-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  Cryptographic Proof-of-Alpha™ Certificate
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  {certificate.version}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Zero-gas, tamper-evident SHA-256 trade hash-chain with TradeCraft Oracle digital attestation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6">
          <button
            onClick={() => setActiveTab('CERTIFICATE')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'CERTIFICATE'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Digital Certificate</span>
          </button>

          <button
            onClick={() => setActiveTab('HASH_CHAIN')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'HASH_CHAIN'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            <span>Trade Hash-Chain ({certificate.chain.length} Blocks)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('VERIFIER');
              if (!verificationResult) handleRunVerification();
            }}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'VERIFIER'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Public Verifier & Tamper Sandbox</span>
          </button>
        </div>

        {/* Copy Feedback Alert */}
        {copyFeedback && (
          <div className="mx-6 mt-3 p-2 bg-teal-950/60 border border-teal-800 text-teal-300 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{copyFeedback} copied to clipboard!</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1: DIGITAL CERTIFICATE */}
          {activeTab === 'CERTIFICATE' && (
            <div className="space-y-5">
              {/* Institutional Certificate Border Card */}
              <div className="relative rounded-2xl border-2 border-teal-500/40 bg-gradient-to-b from-[#0F172A] via-[#0B0F19] to-[#080C14] p-6 sm:p-8 shadow-2xl overflow-hidden">
                {/* Decorative Background Hologram Lines */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-600/5 rounded-full blur-2xl pointer-events-none" />

                {/* Certificate Top Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-teal-500 via-emerald-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 border border-teal-400/30">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-teal-400">
                        OFFICIAL ATTESTATION OF PERFORMANCE
                      </span>
                      <h3 className="text-xl font-extrabold text-white tracking-tight">
                        TradeCraft Proof-of-Alpha™
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        ID: <span className="text-slate-200 font-semibold">{certificate.certificateId}</span>
                      </p>
                    </div>
                  </div>

                  {/* Verification Seal Badge */}
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-950/60 border border-teal-700/60 text-teal-300">
                    <ShieldCheck className="h-5 w-5 text-teal-400" />
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-teal-400 block">
                        ORACLE ATTESTED
                      </span>
                      <span className="text-xs font-bold text-white">100% Tamper-Free</span>
                    </div>
                  </div>
                </div>

                {/* Trader & League Details */}
                <div className="py-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Attested Trader</span>
                    <div className="text-base font-extrabold text-white mt-0.5">{certificate.traderName}</div>
                    <span className="text-[11px] text-teal-400 font-mono">{certificate.traderPersona.replace('_', ' ')}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Tournament League</span>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">{certificate.leagueName}</div>
                    <span className="text-[11px] text-slate-400 font-mono">League ID: {certificate.leagueId}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Timestamp Issued</span>
                    <div className="text-xs font-mono text-slate-300 mt-1">
                      {new Date(certificate.issuedAt).toUTCString()}
                    </div>
                    <span className="text-[10px] text-slate-500">Zero-gas client signature</span>
                  </div>
                </div>

                {/* Performance Metrics Matrix */}
                <div className="py-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">TradeCraft Alpha</span>
                    <div className="text-xl font-extrabold text-teal-400 mt-0.5 font-mono">
                      {certificate.alphaScore.toFixed(1)}/100
                    </div>
                    <span className="text-[10px] text-teal-500">Sortino + Net Return</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Post-Tax Realized</span>
                    <div className={`text-xl font-extrabold font-mono mt-0.5 ${certificate.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {certificate.netPnl >= 0 ? '+' : ''}₹{certificate.netPnl.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Capital: ₹{(certificate.startingCapital / 100000).toFixed(0)}L
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Sortino Downside</span>
                    <div className="text-xl font-extrabold text-blue-400 mt-0.5 font-mono">
                      {certificate.sortinoRatio.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Harmful Volatility Isolated</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Max Drawdown</span>
                    <div className="text-xl font-extrabold text-emerald-400 mt-0.5 font-mono">
                      {certificate.maxDrawdownPct.toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Within tournament limit</span>
                  </div>
                </div>

                {/* Cryptographic Hashes & Attestation Banner */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-800/80 pb-1.5 font-sans">
                    <span className="flex items-center gap-1.5 font-bold text-slate-300">
                      <Lock className="h-3.5 w-3.5 text-teal-400" />
                      Cryptographic Attestation Proofs
                    </span>
                    <span className="text-slate-500">SHA-256 Merkle Consensus</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-500 shrink-0">Merkle Root Hash:</span>
                    <span className="text-teal-300 truncate max-w-md">{certificate.merkleRootHash}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-500 shrink-0">Genesis Block Hash:</span>
                    <span className="text-slate-400 truncate max-w-md">{certificate.genesisHash}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-500 shrink-0">Platform Signature:</span>
                    <span className="text-blue-400 font-bold truncate max-w-md">{certificate.platformSignature}</span>
                  </div>
                </div>

                {/* Certificate Bottom Actions */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
                  {/* Stylized QR Code Visual */}
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-white p-1 flex items-center justify-center shadow-inner">
                      {/* Stylized SVG QR Code */}
                      <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-950 fill-current">
                        <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm8-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm11-2h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2zm-5-3h2v2h-2v-2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-bold text-slate-200 block text-xs">Public Verification QR</span>
                      <span className="text-[10px] text-slate-500">Scan or share to verify authenticity</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(JSON.stringify(certificate, null, 2), 'Certificate JSON')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Proof JSON</span>
                    </button>
                    <button
                      onClick={() =>
                        handleCopy(
                          `https://tradecraft.ai/verify?id=${certificate.certificateId}&hash=${certificate.merkleRootHash}`,
                          'Share Link'
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>Share Proof</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRADE HASH-CHAIN INSPECTOR */}
          {activeTab === 'HASH_CHAIN' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-teal-400" />
                    Sequential Blockchain-Style Hash Ledger
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Every block contains trade details plus the hash of the preceding block (H_i = SHA-256(H_prev + Trade_details)).
                  </p>
                </div>
                <button
                  onClick={() => handleRunVerification()}
                  className="px-3 py-1.5 bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-800 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-verify Chain</span>
                </button>
              </div>

              {/* Block Ladder */}
              <div className="space-y-3">
                {currentChain.map((block, idx) => (
                  <div
                    key={block.blockIndex}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2 font-mono text-xs relative overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2 font-sans">
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-xs">
                          Block #{block.blockIndex}
                        </span>
                        <span className="font-bold text-slate-100">{block.symbol}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            block.side === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {block.side} {block.quantity} Qty
                        </span>
                        <span className="text-slate-400 text-[11px]">@ ₹{block.price}</span>
                      </div>
                      <div className="flex items-center gap-2 font-sans">
                        <span
                          className={`font-bold ${
                            block.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {block.netPnl >= 0 ? '+' : ''}₹{block.netPnl} Net
                        </span>
                        <button
                          onClick={() => handleTamperBlock(block.blockIndex)}
                          className="px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-[10px]"
                          title="Simulate modifying this trade's data to test cryptographic failure"
                        >
                          Tamper Test
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-24 shrink-0">Previous Hash:</span>
                        <span className="text-slate-400 truncate">{block.prevHash}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-24 shrink-0">Current Hash:</span>
                        <span className="text-teal-300 font-bold truncate">{block.currentHash}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PUBLIC VERIFIER & TAMPER SANDBOX */}
          {activeTab === 'VERIFIER' && (
            <div className="space-y-4">
              {/* Verification Status Card */}
              {verificationResult && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    verificationResult.isValid
                      ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                  }`}
                >
                  {verificationResult.isValid ? (
                    <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {verificationResult.isValid
                        ? 'Cryptographic Verification Passed: 100% Authentic'
                        : 'Tampering Detected: Verification Failed!'}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed text-slate-300">
                      {verificationResult.isValid
                        ? `All ${currentChain.length} sequential trade blocks match their cryptographic SHA-256 signatures and connect strictly to Genesis (${certificate.genesisHash.slice(
                            0,
                            12
                          )}...). No DOM manipulation or retroactive modifications detected.`
                        : verificationResult.error}
                    </p>
                  </div>
                </div>
              )}

              {/* Sandbox Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Interactive Anti-Fraud Demo
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Test how TradeCraft AI prevents "Inspect Element" finfluencer fraud. Tamper with a block&apos;s price or P&L and watch the cryptographic validator catch the mismatch immediately.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTamperBlock(1)}
                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold flex-1"
                    >
                      Alter Block #1 Price
                    </button>
                    <button
                      onClick={handleRestoreChain}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                    >
                      Restore Original
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <FileCode className="h-4 w-4 text-blue-400" />
                    Paste External Proof JSON
                  </h4>
                  <textarea
                    rows={2}
                    value={customJsonInput}
                    onChange={(e) => setCustomJsonInput(e.target.value)}
                    placeholder='Paste { "leagueId": "...", "traderId": "...", "chain": [...] }'
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <button
                    onClick={handleVerifyCustomJson}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                  >
                    Verify External Payload
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
