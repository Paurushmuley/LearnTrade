// TradeCraft AI — Social Paper Trading Leagues & Alpha Score Engine
// Evaluates risk-adjusted performance, Sortino ratio, statutory tax drag, and anti-gambling risk caps

import { CanonicalTradeRecord, generateProofOfAlphaCertificate, ProofOfAlphaCertificate } from './proofEngine';

export type LeagueCategory = 'EXPIRY_F_AND_O' | 'INTRADAY_MOMENTUM' | 'SWING_POSITIONAL' | 'BEGINNER_SANDBOX';

export interface LeagueParticipantStanding {
  rank: number;
  userId: string;
  userName: string;
  persona: string;
  avatarUrl?: string;
  netReturnPct: number;
  netPnl: number;
  totalStatutoryTaxes: number;
  sortinoRatio: number;
  maxDrawdownPct: number;
  disciplinePQ: number;
  alphaScore: number; // 0 to 100 composite
  isDisqualified: boolean;
  disqualificationReason?: string;
  badge: string;
  verifiedProofId: string;
  sampleTrades: CanonicalTradeRecord[];
}

export interface TradingLeague {
  id: string;
  title: string;
  subtitle: string;
  category: LeagueCategory;
  startingCapital: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
  maxDrawdownLimitPct: number;
  maxPositionMarginPct: number;
  participantsCount: number;
  prizeBadge: string;
  leaderboard: LeagueParticipantStanding[];
}

/**
 * Calculates the TradeCraft Composite Alpha Score (0 - 100)
 * Evaluates Post-tax return, Sortino downside ratio, PQ discipline, and penalizes drawdowns/concentration
 */
export function calculateAlphaScore(params: {
  netReturnPct: number;
  sortinoRatio: number;
  disciplinePQ: number;
  maxDrawdownPct: number;
  maxPositionMarginPct?: number;
  maxDrawdownLimitPct?: number;
}): {
  alphaScore: number;
  isDisqualified: boolean;
  disqualificationReason?: string;
  drawdownPenaltyPct: number;
  concentrationPenaltyPct: number;
} {
  const maxDdLimit = params.maxDrawdownLimitPct ?? 15;
  const maxConcLimit = 35; // Max 35% margin into a single ticker

  // 1. Hard Disqualification Check: Drawdown exceeded tournament limit
  if (params.maxDrawdownPct >= maxDdLimit) {
    return {
      alphaScore: 0,
      isDisqualified: true,
      disqualificationReason: `Exceeded Maximum Drawdown Limit (${params.maxDrawdownPct}% >= ${maxDdLimit}%). Disqualified to prevent gambling.`,
      drawdownPenaltyPct: 100,
      concentrationPenaltyPct: 0,
    };
  }

  // 2. Drawdown Penalty Multiplier
  let drawdownPenaltyPct = 0;
  if (params.maxDrawdownPct > 5) {
    const excess = params.maxDrawdownPct - 5;
    const denominator = maxDdLimit - 5;
    drawdownPenaltyPct = Number((Math.pow(excess / denominator, 2) * 100).toFixed(1));
  }

  // 3. Concentration Penalty Multiplier
  let concentrationPenaltyPct = 0;
  const posMargin = params.maxPositionMarginPct ?? 20;
  if (posMargin > maxConcLimit) {
    concentrationPenaltyPct = Math.min(50, (posMargin - maxConcLimit) * 2);
  }

  // 4. Normalized Components
  // Net Return (0 - 100)
  const normNetReturn = Math.max(0, Math.min(100, (params.netReturnPct / 25) * 100)); // 25% return = 100 score
  // Sortino Ratio (0 - 100) -> Sortino of 3.0+ is institutional grade
  const normSortino = Math.max(0, Math.min(100, (params.sortinoRatio / 3.0) * 100));
  // PQ Discipline (0 - 100)
  const normPQ = Math.max(10, Math.min(100, params.disciplinePQ));

  // Weighted Core: 40% Sortino, 35% Net Return, 25% PQ
  const rawAlpha = 0.40 * normSortino + 0.35 * normNetReturn + 0.25 * normPQ;

  // Apply penalties
  const ddMultiplier = (100 - drawdownPenaltyPct) / 100;
  const concMultiplier = (100 - concentrationPenaltyPct) / 100;
  const finalAlpha = Math.max(5, Math.min(99, Number((rawAlpha * ddMultiplier * concMultiplier).toFixed(1))));

  return {
    alphaScore: finalAlpha,
    isDisqualified: false,
    drawdownPenaltyPct,
    concentrationPenaltyPct,
  };
}

/**
 * Preloaded Active Leagues for TradeCraft AI
 */
export const PRELOADED_LEAGUES: TradingLeague[] = [
  {
    id: 'league_nifty_expiry_w44',
    title: 'NIFTY Weekly Expiry Derivatives Cup',
    subtitle: 'Deploy defined-risk options spreads (Iron Condors, Spreads). Delta-neutral strategies prioritized.',
    category: 'EXPIRY_F_AND_O',
    startingCapital: 2500000,
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    status: 'ACTIVE',
    maxDrawdownLimitPct: 12.0,
    maxPositionMarginPct: 30.0,
    participantsCount: 418,
    prizeBadge: '🏆 Delta-Neutral Master',
    leaderboard: [
      {
        rank: 1,
        userId: 'user_priya_quant',
        userName: 'Priya Sharma',
        persona: 'OPTIONS_QUANT',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
        netReturnPct: 9.8,
        netPnl: 245000,
        totalStatutoryTaxes: 18450,
        sortinoRatio: 3.42,
        maxDrawdownPct: 3.2,
        disciplinePQ: 96,
        alphaScore: 94.6,
        isDisqualified: false,
        badge: '🥇 Leader — Delta Neutral',
        verifiedProofId: 'POA-EXP-W44-PRIYA',
        sampleTrades: [
          { tradeId: 'tr_p1', timestamp: '2026-11-02T09:20:00Z', symbol: 'NIFTY 24200 CE', side: 'SELL', quantity: 150, price: 124.5, statutoryTaxes: 120, netPnl: 4850, orderType: 'LIMIT' },
          { tradeId: 'tr_p2', timestamp: '2026-11-02T09:20:00Z', symbol: 'NIFTY 24350 CE', side: 'BUY', quantity: 150, price: 48.0, statutoryTaxes: 85, netPnl: -1200, orderType: 'LIMIT' },
          { tradeId: 'tr_p3', timestamp: '2026-11-02T13:45:00Z', symbol: 'NIFTY 24000 PE', side: 'SELL', quantity: 150, price: 108.0, statutoryTaxes: 110, netPnl: 6200, orderType: 'LIMIT' },
        ],
      },
      {
        rank: 2,
        userId: 'user_vikram_greeks',
        userName: 'Vikram Sengupta',
        persona: 'OPTIONS_QUANT',
        netReturnPct: 11.2,
        netPnl: 280000,
        totalStatutoryTaxes: 31200,
        sortinoRatio: 2.85,
        maxDrawdownPct: 5.6,
        disciplinePQ: 88,
        alphaScore: 89.2,
        isDisqualified: false,
        badge: '🥈 Theta Hunter',
        verifiedProofId: 'POA-EXP-W44-VIKRAM',
        sampleTrades: [
          { tradeId: 'tr_v1', timestamp: '2026-11-02T10:15:00Z', symbol: 'BANKNIFTY 51500 CE', side: 'SELL', quantity: 120, price: 215.0, statutoryTaxes: 210, netPnl: 8400, orderType: 'LIMIT' },
        ],
      },
      {
        rank: 3,
        userId: 'user_arjun_scalper',
        userName: 'Arjun Mehta',
        persona: 'INTRADAY_SCALPER',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        netReturnPct: 7.4,
        netPnl: 185000,
        totalStatutoryTaxes: 24100,
        sortinoRatio: 2.30,
        maxDrawdownPct: 4.8,
        disciplinePQ: 91,
        alphaScore: 83.5,
        isDisqualified: false,
        badge: '🥉 Momentum Spread',
        verifiedProofId: 'POA-EXP-W44-ARJUN',
        sampleTrades: [
          { tradeId: 'tr_a1', timestamp: '2026-11-02T09:30:00Z', symbol: 'RELIANCE 2850 CE', side: 'BUY', quantity: 250, price: 42.0, statutoryTaxes: 140, netPnl: 5200, orderType: 'MARKET' },
        ],
      },
      {
        rank: 4,
        userId: 'user_gambler_x',
        userName: 'Anonymous Degenerate',
        persona: 'MARKET_BEGINNER',
        netReturnPct: 48.0, // High raw gain, but massive drawdown & poor PQ
        netPnl: 1200000,
        totalStatutoryTaxes: 85000,
        sortinoRatio: 0.85,
        maxDrawdownPct: 18.5, // Exceeded 12% limit!
        disciplinePQ: 32,
        alphaScore: 0,
        isDisqualified: true,
        disqualificationReason: 'Disqualified: Max Drawdown 18.5% exceeded 12% tournament safety ceiling.',
        badge: '🚫 Disqualified (Lottery Bet)',
        verifiedProofId: 'POA-EXP-W44-DISQ',
        sampleTrades: [],
      },
    ],
  },
  {
    id: 'league_intraday_alpha_sprint',
    title: 'NSE Intraday Alpha Sprint',
    subtitle: 'Pure intraday equity momentum (MIS 5x margin). Zero overnight risk allowed.',
    category: 'INTRADAY_MOMENTUM',
    startingCapital: 1000000,
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    status: 'ACTIVE',
    maxDrawdownLimitPct: 8.0,
    maxPositionMarginPct: 25.0,
    participantsCount: 680,
    prizeBadge: '⚡ Velocity Scalper',
    leaderboard: [
      {
        rank: 1,
        userId: 'user_arjun_scalper',
        userName: 'Arjun Mehta',
        persona: 'INTRADAY_SCALPER',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        netReturnPct: 6.2,
        netPnl: 62000,
        totalStatutoryTaxes: 8400,
        sortinoRatio: 3.10,
        maxDrawdownPct: 2.1,
        disciplinePQ: 94,
        alphaScore: 92.4,
        isDisqualified: false,
        badge: '🥇 Velocity Leader',
        verifiedProofId: 'POA-SPR-ARJUN',
        sampleTrades: [
          { tradeId: 'tr_s1', timestamp: '2026-11-03T09:18:00Z', symbol: 'TCS', side: 'BUY', quantity: 80, price: 4120.0, statutoryTaxes: 45, netPnl: 2850, orderType: 'MARKET' },
          { tradeId: 'tr_s2', timestamp: '2026-11-03T10:45:00Z', symbol: 'HDFCBANK', side: 'BUY', quantity: 200, price: 1740.0, statutoryTaxes: 60, netPnl: 3400, orderType: 'LIMIT' },
        ],
      },
      {
        rank: 2,
        userId: 'user_sneha_vwap',
        userName: 'Sneha Kulkarni',
        persona: 'INTRADAY_SCALPER',
        netReturnPct: 5.4,
        netPnl: 54000,
        totalStatutoryTaxes: 6800,
        sortinoRatio: 2.90,
        maxDrawdownPct: 2.8,
        disciplinePQ: 89,
        alphaScore: 88.0,
        isDisqualified: false,
        badge: '🥈 VWAP Sniper',
        verifiedProofId: 'POA-SPR-SNEHA',
        sampleTrades: [],
      },
      {
        rank: 3,
        userId: 'user_rohit_novice',
        userName: 'Rohit Verma',
        persona: 'MARKET_BEGINNER',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        netReturnPct: 2.8,
        netPnl: 28000,
        totalStatutoryTaxes: 4200,
        sortinoRatio: 1.85,
        maxDrawdownPct: 3.9,
        disciplinePQ: 78,
        alphaScore: 74.2,
        isDisqualified: false,
        badge: '🥉 Disciplined Rookie',
        verifiedProofId: 'POA-SPR-ROHIT',
        sampleTrades: [],
      },
    ],
  },
  {
    id: 'league_rookie_sandbox',
    title: 'SEBI Rookie Capital Preservation League',
    subtitle: 'Aimed at beginners: score points by minimizing statutory fee drag and keeping Drawdown < 4%.',
    category: 'BEGINNER_SANDBOX',
    startingCapital: 500000,
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    status: 'ACTIVE',
    maxDrawdownLimitPct: 5.0,
    maxPositionMarginPct: 20.0,
    participantsCount: 1120,
    prizeBadge: '🛡️ Capital Guard',
    leaderboard: [
      {
        rank: 1,
        userId: 'user_rohit_novice',
        userName: 'Rohit Verma',
        persona: 'MARKET_BEGINNER',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        netReturnPct: 3.4,
        netPnl: 17000,
        totalStatutoryTaxes: 1850,
        sortinoRatio: 2.65,
        maxDrawdownPct: 1.8,
        disciplinePQ: 92,
        alphaScore: 90.5,
        isDisqualified: false,
        badge: '🥇 Risk Guardian',
        verifiedProofId: 'POA-ROOK-ROHIT',
        sampleTrades: [],
      },
    ],
  },
];

/**
 * Returns all available leagues
 */
export function getActiveLeagues(): TradingLeague[] {
  return PRELOADED_LEAGUES;
}

/**
 * Generates an automated Proof of Alpha for a user in a league
 */
export function generateUserProofForLeague(
  league: TradingLeague,
  participant: LeagueParticipantStanding
): ProofOfAlphaCertificate {
  const trades: CanonicalTradeRecord[] = participant.sampleTrades.length > 0
    ? participant.sampleTrades
    : [
        {
          tradeId: `tr_gen_1`,
          timestamp: new Date().toISOString(),
          symbol: 'NIFTY 50',
          side: 'BUY' as const,
          quantity: 50,
          price: 24180.5,
          statutoryTaxes: 65.2,
          netPnl: participant.netPnl,
          orderType: 'LIMIT',
        },
      ];

  return generateProofOfAlphaCertificate({
    leagueId: league.id,
    leagueName: league.title,
    traderId: participant.userId,
    traderName: participant.userName,
    traderPersona: participant.persona,
    startingCapital: league.startingCapital,
    finalEquity: league.startingCapital + participant.netPnl,
    totalStatutoryTaxesPaid: participant.totalStatutoryTaxes,
    winRatePct: 65.0,
    maxDrawdownPct: participant.maxDrawdownPct,
    sortinoRatio: participant.sortinoRatio,
    disciplinePQ: participant.disciplinePQ,
    alphaScore: participant.alphaScore,
    trades,
  });
}
