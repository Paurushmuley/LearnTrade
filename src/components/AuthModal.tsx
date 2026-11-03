'use client';

import React, { useState } from 'react';
import { UserProfile, TradingPersona, RiskTolerance } from '../types/user';
import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  DEMO_ACCOUNTS,
  sanitizeUserProfile,
} from '../lib/authService';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  initialTab?: 'SIGN_IN' | 'REGISTER' | 'FORGOT_PASSWORD';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialTab = 'SIGN_IN',
}) => {
  const [activeTab, setActiveTab] = useState<'SIGN_IN' | 'REGISTER' | 'FORGOT_PASSWORD'>(initialTab);

  // Sign In State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPersona, setRegPersona] = useState<TradingPersona>('INTRADAY_SCALPER');
  const [regCapital, setRegCapital] = useState<number>(1000000);
  const [regRisk, setRegRisk] = useState<RiskTolerance>('MODERATE_2');

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<1 | 2>(1);

  // Error & Status Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDemoLogin = (demoAccount: typeof DEMO_ACCOUNTS[0]) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const user = sanitizeUserProfile(demoAccount);
    onAuthSuccess(user);
    onClose();
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = loginUser(loginEmail, loginPassword);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to sign in');
      return;
    }
    if (res.user) {
      onAuthSuccess(res.user);
      onClose();
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = registerUser(regName, regEmail, regPassword, regPersona, regCapital, regRisk);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to register account');
      return;
    }
    if (res.user) {
      onAuthSuccess(res.user);
      onClose();
    }
  };

  const handleRequestResetToken = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = requestPasswordReset(forgotEmail);
    if (!res.success) {
      setErrorMsg(res.error || 'Could not find account');
      return;
    }
    setGeneratedToken(res.resetToken || null);
    setResetToken(res.resetToken || '');
    setResetStep(2);
    setSuccessMsg(`Verification code generated: ${res.resetToken}`);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = resetPassword(forgotEmail, resetToken, newPassword);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to reset password');
      return;
    }
    setSuccessMsg('Password updated successfully! You can now sign in.');
    setResetStep(1);
    setLoginEmail(forgotEmail);
    setLoginPassword(newPassword);
    setActiveTab('SIGN_IN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 text-white">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                TradeCraft AI Account
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Secure Sandbox
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Personalized portfolios, BYOK vault, and behavioral trade audits
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

        {/* 1-Click Demo Accounts Quick-Select Bar */}
        <div className="border-b border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-400" />
              1-Click Instant Demo Login:
            </span>
            <span className="text-[10px] text-zinc-500">Pre-loaded with trades & ₹ capital</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleDemoLogin(demo)}
                className="group relative flex flex-col items-start p-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/60 transition text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                    {demo.name.split(' ')[0]}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    demo.persona === 'INTRADAY_SCALPER' ? 'bg-amber-500/10 text-amber-400' :
                    demo.persona === 'OPTIONS_QUANT' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {demo.persona === 'INTRADAY_SCALPER' ? 'Scalper' : demo.persona === 'OPTIONS_QUANT' ? 'Quant' : 'Novice'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 font-mono">
                  ₹{(demo.startingCapital / 100000).toFixed(0)} Lakh
                </span>
                <span className="text-[9px] text-zinc-500 mt-0.5">PQ: {demo.stats?.disciplineScore}/100</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/20 px-6">
          <button
            onClick={() => { setActiveTab('SIGN_IN'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'SIGN_IN'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setActiveTab('REGISTER'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'REGISTER'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create Account
          </button>
          <button
            onClick={() => { setActiveTab('FORGOT_PASSWORD'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'FORGOT_PASSWORD'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Reset Password
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Sign In */}
        {activeTab === 'SIGN_IN' && (
          <form onSubmit={handleSignIn} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. arjun.trader@tradecraft.ai"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">Password</label>
                <button
                  type="button"
                  onClick={() => { setActiveTab('FORGOT_PASSWORD'); setForgotEmail(loginEmail); }}
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Sign In to Terminal
            </button>
          </form>
        )}

        {/* Tab 2: Create Account */}
        {activeTab === 'REGISTER' && (
          <form onSubmit={handleRegister} className="p-6 space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Trading Persona</label>
                <select
                  value={regPersona}
                  onChange={(e) => setRegPersona(e.target.value as TradingPersona)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="INTRADAY_SCALPER">Intraday Scalper</option>
                  <option value="OPTIONS_QUANT">Options Quant (F&O)</option>
                  <option value="SWING_TRADER">Swing Trader</option>
                  <option value="MARKET_BEGINNER">Market Beginner</option>
                  <option value="ALGORITHMIC_DEV">Algo Bot Developer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Starting Capital</label>
                <select
                  value={regCapital}
                  onChange={(e) => setRegCapital(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value={500000}>₹5,00,000</option>
                  <option value={1000000}>₹10,00,000 (Default)</option>
                  <option value={2500000}>₹25,00,000</option>
                  <option value={5000000}>₹50,00,000</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create Free Sandbox Profile
            </button>
          </form>
        )}

        {/* Tab 3: Forgot Password */}
        {activeTab === 'FORGOT_PASSWORD' && (
          <div className="p-6 space-y-4">
            {resetStep === 1 ? (
              <form onSubmit={handleRequestResetToken} className="space-y-4">
                <p className="text-xs text-zinc-400">
                  Enter your registered account email address. We will generate a secure 6-digit verification code to reset your password.
                </p>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Account Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. arjun.trader@tradecraft.ai"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  Generate 6-Digit Reset Code
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                {generatedToken && (
                  <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl text-xs text-blue-300 flex items-center justify-between">
                    <span>Simulated Code Generated:</span>
                    <span className="font-mono font-bold text-sm bg-blue-900/60 px-2 py-0.5 rounded border border-blue-700">
                      {generatedToken}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">6-Digit Reset Code</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="w-1/3 py-2 px-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    Confirm & Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
