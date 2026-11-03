// TradeCraft AI — Account Management & Authentication Engine
// Handles user profiles, registration, login, password reset, and preloaded demo accounts

import { UserAccount, UserProfile, TradingPersona, RiskTolerance } from '../types/user';

const ACCOUNTS_STORAGE_KEY = 'tradecraft_user_accounts';
const CURRENT_USER_STORAGE_KEY = 'tradecraft_current_user';

/**
 * Simple client-side password hash for sandbox authentication
 */
export function hashPassword(password: string): string {
  let hash = 0;
  const salt = 'tradecraft_ai_sebi_salt_2026';
  const combined = password + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16) + 'sec';
}

/**
 * 3 Preloaded Realistic Demo Accounts
 */
export const DEMO_ACCOUNTS: UserAccount[] = [
  {
    id: 'user_arjun_scalper',
    email: 'arjun.trader@tradecraft.ai',
    name: 'Arjun Mehta',
    persona: 'INTRADAY_SCALPER',
    riskTolerance: 'MODERATE_2',
    startingCapital: 1000000,
    passwordHash: hashPassword('Demo@123'),
    createdAt: '2026-10-15T09:15:00Z',
    bio: 'High-frequency momentum trader specializing in NIFTY 50 breakouts and VWAP pullbacks.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    stats: {
      totalTrades: 74,
      winRate: 62.5,
      disciplineScore: 88,
      bestTradeGain: 42500,
      favoriteStock: 'RELIANCE',
    },
  },
  {
    id: 'user_priya_quant',
    email: 'priya.quant@tradecraft.ai',
    name: 'Priya Sharma',
    persona: 'OPTIONS_QUANT',
    riskTolerance: 'CONSERVATIVE_1',
    startingCapital: 2500000,
    passwordHash: hashPassword('Demo@123'),
    createdAt: '2026-09-20T10:30:00Z',
    bio: 'Systematic derivatives quant deploying delta-neutral Iron Condors and weekly calendar spreads.',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    stats: {
      totalTrades: 112,
      winRate: 68.2,
      disciplineScore: 94,
      bestTradeGain: 85200,
      favoriteStock: 'NIFTY 50',
    },
  },
  {
    id: 'user_rohit_novice',
    email: 'rohit.novice@tradecraft.ai',
    name: 'Rohit Verma',
    persona: 'MARKET_BEGINNER',
    riskTolerance: 'CONSERVATIVE_1',
    startingCapital: 500000,
    passwordHash: hashPassword('Demo@123'),
    createdAt: '2026-11-01T11:00:00Z',
    bio: 'Learning price action, risk management, and eliminating emotional revenge trades.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    stats: {
      totalTrades: 14,
      winRate: 45.0,
      disciplineScore: 65,
      bestTradeGain: 12100,
      favoriteStock: 'TATAMOTORS',
    },
  },
];

/**
 * Strips password hash and security tokens before returning user profile to frontend
 */
export function sanitizeUserProfile(account: UserAccount): UserProfile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, resetToken, resetTokenExpiry, ...profile } = account;
  return profile;
}

/**
 * Initializes and loads all registered accounts from localStorage
 */
export function getStoredAccounts(): UserAccount[] {
  if (typeof window === 'undefined') return DEMO_ACCOUNTS;
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEMO_ACCOUNTS));
      return DEMO_ACCOUNTS;
    }
    const parsed: UserAccount[] = JSON.parse(raw);
    // Ensure all demo accounts are always present
    let modified = false;
    for (const demo of DEMO_ACCOUNTS) {
      if (!parsed.some(a => a.id === demo.id)) {
        parsed.push(demo);
        modified = true;
      }
    }
    if (modified) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load accounts from storage:', err);
    return DEMO_ACCOUNTS;
  }
}

/**
 * Persists accounts to localStorage
 */
export function saveStoredAccounts(accounts: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save accounts to storage:', err);
  }
}

/**
 * Gets currently logged in user profile, defaulting to Arjun Mehta if empty
 */
export function getCurrentUser(): UserProfile {
  if (typeof window === 'undefined') return sanitizeUserProfile(DEMO_ACCOUNTS[0]);
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!raw) {
      const defaultUser = sanitizeUserProfile(DEMO_ACCOUNTS[0]);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(defaultUser));
      return defaultUser;
    }
    return JSON.parse(raw);
  } catch {
    return sanitizeUserProfile(DEMO_ACCOUNTS[0]);
  }
}

/**
 * Sets current logged in user
 */
export function setCurrentUser(user: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to persist current user:', err);
  }
}

/**
 * Authenticates user with email and password
 */
export function loginUser(email: string, password: string): { success: boolean; user?: UserProfile; error?: string } {
  const accounts = getStoredAccounts();
  const normalizedEmail = email.trim().toLowerCase();
  const account = accounts.find(a => a.email.toLowerCase() === normalizedEmail);

  if (!account) {
    return { success: false, error: 'No account found with this email address.' };
  }

  if (account.passwordHash !== hashPassword(password)) {
    return { success: false, error: 'Invalid password. Please check your credentials.' };
  }

  const user = sanitizeUserProfile(account);
  setCurrentUser(user);
  return { success: true, user };
}

/**
 * Registers a new user account
 */
export function registerUser(
  name: string,
  email: string,
  password: string,
  persona: TradingPersona = 'INTRADAY_SCALPER',
  startingCapital: number = 1000000,
  riskTolerance: RiskTolerance = 'MODERATE_2'
): { success: boolean; user?: UserProfile; error?: string } {
  const accounts = getStoredAccounts();
  const normalizedEmail = email.trim().toLowerCase();

  if (!name.trim()) return { success: false, error: 'Full name is required.' };
  if (!email.trim() || !email.includes('@')) return { success: false, error: 'A valid email address is required.' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

  if (accounts.some(a => a.email.toLowerCase() === normalizedEmail)) {
    return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
  }

  const newAccount: UserAccount = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: normalizedEmail,
    name: name.trim(),
    persona,
    riskTolerance,
    startingCapital,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    bio: `${persona.replace('_', ' ')} on TradeCraft AI. Practicing disciplined risk management.`,
    stats: {
      totalTrades: 0,
      winRate: 0,
      disciplineScore: 100,
      bestTradeGain: 0,
      favoriteStock: 'NIFTY 50',
    },
  };

  accounts.push(newAccount);
  saveStoredAccounts(accounts);

  const user = sanitizeUserProfile(newAccount);
  setCurrentUser(user);
  return { success: true, user };
}

/**
 * Initiates forgot password flow — generates a 6-digit verification code
 */
export function requestPasswordReset(email: string): { success: boolean; resetToken?: string; error?: string } {
  const accounts = getStoredAccounts();
  const normalizedEmail = email.trim().toLowerCase();
  const accountIndex = accounts.findIndex(a => a.email.toLowerCase() === normalizedEmail);

  if (accountIndex === -1) {
    return { success: false, error: 'No account registered with this email.' };
  }

  const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  const expiry = Date.now() + 15 * 60 * 1000; // 15 mins expiry

  accounts[accountIndex].resetToken = token;
  accounts[accountIndex].resetTokenExpiry = expiry;
  saveStoredAccounts(accounts);

  return { success: true, resetToken: token };
}

/**
 * Resets user password using the verification token or direct update
 */
export function resetPassword(
  email: string,
  resetToken: string,
  newPassword: string
): { success: boolean; error?: string } {
  const accounts = getStoredAccounts();
  const normalizedEmail = email.trim().toLowerCase();
  const accountIndex = accounts.findIndex(a => a.email.toLowerCase() === normalizedEmail);

  if (accountIndex === -1) {
    return { success: false, error: 'No account found with this email.' };
  }

  const account = accounts[accountIndex];

  if (!account.resetToken || account.resetToken !== resetToken.trim()) {
    return { success: false, error: 'Invalid or expired 6-digit reset code.' };
  }

  if (account.resetTokenExpiry && Date.now() > account.resetTokenExpiry) {
    return { success: false, error: 'This reset code has expired. Please request a new one.' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  accounts[accountIndex].passwordHash = hashPassword(newPassword);
  delete accounts[accountIndex].resetToken;
  delete accounts[accountIndex].resetTokenExpiry;
  saveStoredAccounts(accounts);

  return { success: true };
}

/**
 * Direct password change from user profile settings
 */
export function changePasswordFromProfile(
  userId: string,
  oldPass: string,
  newPass: string
): { success: boolean; error?: string } {
  const accounts = getStoredAccounts();
  const accountIndex = accounts.findIndex(a => a.id === userId);

  if (accountIndex === -1) return { success: false, error: 'User not found.' };

  const account = accounts[accountIndex];
  if (account.passwordHash !== hashPassword(oldPass)) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  if (newPass.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  accounts[accountIndex].passwordHash = hashPassword(newPass);
  saveStoredAccounts(accounts);
  return { success: true };
}

/**
 * Updates user profile details
 */
export function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'name' | 'persona' | 'riskTolerance' | 'bio' | 'startingCapital'>>
): { success: boolean; user?: UserProfile; error?: string } {
  const accounts = getStoredAccounts();
  const accountIndex = accounts.findIndex(a => a.id === userId);

  if (accountIndex === -1) return { success: false, error: 'User not found.' };

  accounts[accountIndex] = {
    ...accounts[accountIndex],
    ...updates,
  };

  saveStoredAccounts(accounts);

  const updatedProfile = sanitizeUserProfile(accounts[accountIndex]);
  setCurrentUser(updatedProfile);
  return { success: true, user: updatedProfile };
}

/**
 * Log out user (resets to guest or default demo)
 */
export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  const demo = sanitizeUserProfile(DEMO_ACCOUNTS[0]);
  localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(demo));
}

/**
 * Key to isolate each user's virtual portfolio and orders
 */
export function getUserTradingStateKey(userId: string): string {
  return `tradecraft_state_${userId}`;
}
