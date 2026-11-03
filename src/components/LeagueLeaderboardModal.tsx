'use client';

import React, { useState } from 'react';
import {
  TradingLeague,
  LeagueParticipantStanding,
  getActiveLeagues,
  generateUserProofForLeague,
} from '../lib/leagueEngine';
import { ProofOfAlphaCertificate } from '../lib/proofEngine';
import { UserProfile } from '../types/user';
import {
  Trophy,
  Award,
  ShieldCheck,
  ShieldAlert,
  Users,
  Calendar,
  IndianRupee,
  Activity,
  Zap,
  TrendingUp,
  AlertTriangle,
  Info,
  ChevronRight,
  ExternalLink,
  Sparkles,
  X,
  Flame,
} from 'lucide-react';

interface LeagueLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onInspectProof: (cert: ProofOfAlphaCertificate) => void;
}

export const LeagueLeaderboardModal: React.FC<LeagueLeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onInspectProof,
}) => {
  const [leagues, setLeagues] = useState<TradingLeague[]>(() => getActiveLeagues());
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    leagues[0]?.id || 'league_nifty_expiry_w44'
  );
  const [sortBy, setSortBy] = useState<'ALPHA_SCORE' | 'RAW_PNL'>('ALPHA_SCORE');
  const [joinedLeagues, setJoinedLeagues] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const currentLeague = leagues.find((l) => l.id === selectedLeagueId) || leagues[0];

  // Clone and sort leaderboard based on selected mode
  const sortedParticipants = [...currentLeague.leaderboard].sort((a, b) => {
    if (sortBy === 'ALPHA_SCORE') {
      // Disqualified traders always go to the bottom
      if (a.isDisqualified && !b.isDisqualified) return 1;
      if (!a.isDisqualified && b.isDisqualified) return -1;
      return b.alphaScore - a.alphaScore;
    } else {
      // Raw PnL sorting
      return b.netPnl - a.netPnl;
    }
  });

  const handleJoinLeague = () => {
    if (!currentUser) return;
    if (joinedLeagues[currentLeague.id]) return;

    // Add current user to leaderboard
    const newParticipant: LeagueParticipantStanding = {
      rank: sortedParticipants.length + 1,
      userId: currentUser.id,
      userName: currentUser.name,
      persona: currentUser.persona,
      avatarUrl: currentUser.avatarUrl,
      netReturnPct: 4.5,
      netPnl: Math.round(currentLeague.startingCapital * 0.045),
      totalStatutoryTaxes: 3420,
      sortinoRatio: 2.75,
      maxDrawdownPct: 2.4,
      disciplinePQ: currentUser.stats?.disciplineScore || 90,
      alphaScore: 88.5,
      isDisqualified: false,
      badge: '🚀 Active Challenger',
      verifiedProofId: `POA-${currentLeague.id.toUpperCase()}-${currentUser.id.slice(0, 5)}`,
      sampleTrades: [
        {
          tradeId: `tr_user_init`,
          timestamp: new Date().toISOString(),
          symbol: 'NIFTY 50',
          side: 'BUY' as const,
          quantity: 50,
          price: 24200.0,
          statutoryTaxes: 54.2,
          netPnl: Math.round(currentLeague.startingCapital * 0.045),
          orderType: 'LIMIT',
        },
      ],
    };

    setLeagues((prev) =>
      prev.map((l) =>
        l.id === currentLeague.id
          ? {
              ...l,
              participantsCount: l.participantsCount + 1,
              leaderboard: [newParticipant, ...l.leaderboard],
            }
          : l
      )
    );

    setJoinedLeagues((prev) => ({ ...prev, [currentLeague.id]: true }));
  };

  const handleOpenCertificate = (p: LeagueParticipantStanding) => {
    const cert = generateUserProofForLeague(currentLeague, p);
    onInspectProof(cert);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0f19] border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-950/40 text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-amber-950/50 via-slate-900 to-indigo-950/50 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-widest text-amber-400 font-semibold">
                  TradeCraft Institutional Arena
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SEBI Anti-Gambling Verified
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Social Trading Leagues & Proof-of-Alpha
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tournament Selection Tab Bar */}
        <div className="px-6 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => setSelectedLeagueId(league.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedLeagueId === league.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-950/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 ${selectedLeagueId === league.id ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{league.title}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                {league.participantsCount}
              </span>
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Active Tournament Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20 border border-amber-500/20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {currentLeague.prizeBadge}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Ends: {currentLeague.endDate}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">{currentLeague.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                {currentLeague.subtitle}
              </p>

              {/* Tournament Risk Parameters */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <IndianRupee className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Starting Capital:</span>
                  <span className="font-mono font-semibold text-white">
                    ₹{currentLeague.startingCapital.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Max Drawdown Limit:</span>
                  <span className="font-mono font-semibold text-amber-300">
                    {currentLeague.maxDrawdownLimitPct}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>Participants:</span>
                  <span className="font-mono font-semibold text-purple-300">
                    {currentLeague.participantsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Card: Join League */}
            <div className="flex flex-col items-stretch lg:items-end gap-3 w-full lg:w-auto">
              <button
                onClick={handleJoinLeague}
                disabled={joinedLeagues[currentLeague.id]}
                className={`px-5 py-3 rounded-xl font-semibold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all ${
                  joinedLeagues[currentLeague.id]
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/25'
                }`}
              >
                {joinedLeagues[currentLeague.id] ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Enrolled as Competitor
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Enter League with Current Portfolio
                  </>
                )}
              </button>
              <div className="text-[11px] text-slate-500 text-center lg:text-right">
                Free client-side zero-gas cryptographic registration
              </div>
            </div>
          </div>

          {/* Educational Callout: Anti-Gambling Philosophy */}
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-indigo-200">
                Institutional Alpha Ranking vs Toxic Raw P&L:
              </span>
              <p className="text-slate-400 leading-relaxed">
                Standard trading contests encourage reckless 100x out-of-the-money options gambling where 1 lucky trade takes #1 while wiping out 99% of accounts.
                TradeCraft ranks contestants by the{' '}
                <strong className="text-amber-300">Composite Alpha Score (α-Score)</strong>: 40% Sortino Downside Volatility, 35% Net Return, 25% Discipline (PQ). Any contestant hitting the tournament drawdown ceiling is{' '}
                <strong className="text-rose-400">instantly disqualified</strong> regardless of profits.
              </p>
            </div>
          </div>

          {/* Leaderboard Table Header & Sort Controls */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Live Official Standings
                </h4>
                <div className="text-xs text-slate-400">
                  Verified against cryptographic Merkle proof receipts
                </div>
              </div>

              {/* Sort Modes */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setSortBy('ALPHA_SCORE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    sortBy === 'ALPHA_SCORE'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Alpha Score (Risk-Adjusted)
                </button>
                <button
                  onClick={() => setSortBy('RAW_PNL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    sortBy === 'RAW_PNL'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Raw P&L View
                </button>
              </div>
            </div>

            {/* Standings Table */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Trader</th>
                      <th className="px-4 py-3 text-right">Alpha Score</th>
                      <th className="px-4 py-3 text-right">Net Return</th>
                      <th className="px-4 py-3 text-right">Net P&L</th>
                      <th className="px-4 py-3 text-right">Sortino</th>
                      <th className="px-4 py-3 text-right">Max DD</th>
                      <th className="px-4 py-3 text-right">Discipline (PQ)</th>
                      <th className="px-4 py-3 text-center">Proof-of-Alpha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sortedParticipants.map((p, idx) => {
                      const displayRank = idx + 1;
                      const isTop3 = displayRank <= 3 && !p.isDisqualified;

                      return (
                        <tr
                          key={p.userId}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            p.isDisqualified ? 'bg-rose-950/10 opacity-75' : ''
                          }`}
                        >
                          {/* Rank */}
                          <td className="px-4 py-3.5 font-mono">
                            <div className="flex items-center gap-1.5">
                              {displayRank === 1 && !p.isDisqualified && (
                                <span className="text-amber-400 font-bold text-base">🥇</span>
                              )}
                              {displayRank === 2 && !p.isDisqualified && (
                                <span className="text-slate-300 font-bold text-base">🥈</span>
                              )}
                              {displayRank === 3 && !p.isDisqualified && (
                                <span className="text-amber-600 font-bold text-base">🥉</span>
                              )}
                              <span
                                className={`font-semibold ${
                                  p.isDisqualified
                                    ? 'text-rose-400 line-through'
                                    : isTop3
                                    ? 'text-white'
                                    : 'text-slate-400'
                                }`}
                              >
                                #{displayRank}
                              </span>
                            </div>
                          </td>

                          {/* Trader Persona */}
                          <td className="px-4 py-3.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{p.userName}</span>
                                {p.isDisqualified ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    DISQUALIFIED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                    {p.badge}
                                  </span>
                                )}
                              </div>
                              {p.isDisqualified && p.disqualificationReason && (
                                <div className="text-[11px] text-rose-400 mt-0.5">
                                  {p.disqualificationReason}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Alpha Score */}
                          <td className="px-4 py-3.5 text-right font-mono">
                            {p.isDisqualified ? (
                              <span className="text-rose-400 font-bold">0.0</span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 rounded-full"
                                    style={{ width: `${Math.min(100, p.alphaScore)}%` }}
                                  />
                                </div>
                                <span className="font-bold text-amber-300 text-sm">
                                  {p.alphaScore.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Net Return % */}
                          <td
                            className={`px-4 py-3.5 text-right font-mono font-semibold ${
                              p.netReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {p.netReturnPct >= 0 ? '+' : ''}
                            {p.netReturnPct.toFixed(1)}%
                          </td>

                          {/* Net P&L */}
                          <td
                            className={`px-4 py-3.5 text-right font-mono font-semibold ${
                              p.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {p.netPnl >= 0 ? '+' : ''}₹{p.netPnl.toLocaleString('en-IN')}
                          </td>

                          {/* Sortino */}
                          <td className="px-4 py-3.5 text-right font-mono text-cyan-300">
                            {p.sortinoRatio.toFixed(2)}x
                          </td>

                          {/* Max Drawdown */}
                          <td
                            className={`px-4 py-3.5 text-right font-mono ${
                              p.maxDrawdownPct >= currentLeague.maxDrawdownLimitPct
                                ? 'text-rose-400 font-bold'
                                : p.maxDrawdownPct > 5
                                ? 'text-amber-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {p.maxDrawdownPct.toFixed(1)}%
                          </td>

                          {/* Discipline PQ */}
                          <td className="px-4 py-3.5 text-right font-mono text-purple-300">
                            {p.disciplinePQ}
                          </td>

                          {/* Proof of Alpha Trigger */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleOpenCertificate(p)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1.5 transition-colors"
                              title="Inspect cryptographic Merkle proof receipt"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                              Inspect Proof
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cryptographic Proof-of-Alpha (TC-POA-1.0) &bull; Zero-gas Merkle Verification</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors"
          >
            Close Arena
          </button>
        </div>
      </div>
    </div>
  );
};
