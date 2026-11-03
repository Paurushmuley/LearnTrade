// TradeCraft AI — User Account & Profile Types

export type TradingPersona = 
  | 'INTRADAY_SCALPER'
  | 'OPTIONS_QUANT'
  | 'SWING_TRADER'
  | 'MARKET_BEGINNER'
  | 'ALGORITHMIC_DEV';

export type RiskTolerance = 'CONSERVATIVE_1' | 'MODERATE_2' | 'AGGRESSIVE_5';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  persona: TradingPersona;
  riskTolerance: RiskTolerance;
  startingCapital: number;
  createdAt: string;
  bio?: string;
  stats?: {
    totalTrades: number;
    winRate: number;
    disciplineScore: number;
    bestTradeGain: number;
    favoriteStock: string;
  };
}

export interface UserAccount extends UserProfile {
  passwordHash: string; // In-browser salted hash
  resetToken?: string;
  resetTokenExpiry?: number;
}

export interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
}
