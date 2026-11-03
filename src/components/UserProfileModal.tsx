'use client';

import React, { useState } from 'react';
import { UserProfile, TradingPersona, RiskTolerance } from '../types/user';
import {
  updateUserProfile,
  changePasswordFromProfile,
  getStoredAccounts,
  sanitizeUserProfile,
  setCurrentUser,
} from '../lib/authService';
import {
  Activity,
  AlertCircle,
  Award,
  CheckCircle2,
  Key,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onLogout,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EDIT' | 'SECURITY' | 'SWITCH'>('OVERVIEW');

  // Edit profile state
  const [name, setName] = useState(currentUser.name);
  const [persona, setPersona] = useState<TradingPersona>(currentUser.persona);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>(currentUser.riskTolerance);
  const [bio, setBio] = useState(currentUser.bio || '');

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const allAccounts = getStoredAccounts();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = updateUserProfile(currentUser.id, {
      name,
      persona,
      riskTolerance,
      bio,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to update profile');
      return;
    }

    if (res.user) {
      onUserUpdated(res.user);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setActiveTab('OVERVIEW'), 1200);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match');
      return;
    }

    const res = changePasswordFromProfile(currentUser.id, oldPassword, newPassword);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to change password');
      return;
    }

    setSuccessMsg('Password changed successfully!');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSwitchAccount = (accountId: string) => {
    const acc = allAccounts.find(a => a.id === accountId);
    if (acc) {
      const sanitized = sanitizeUserProfile(acc);
      setCurrentUser(sanitized);
      onUserUpdated(sanitized);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Profile Banner */}
        <div className="relative border-b border-zinc-800 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-zinc-950 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-blue-500/20 border-2 border-blue-400/30 overflow-hidden">
              {currentUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="h-full w-full object-cover" />
              ) : (
                currentUser.name.charAt(0)
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">{currentUser.name}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {currentUser.persona.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{currentUser.email}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-400">
                <span>Capital: <strong className="text-emerald-400">₹{currentUser.startingCapital.toLocaleString('en-IN')}</strong></span>
                <span>•</span>
                <span>Risk: <strong className="text-amber-400">{currentUser.riskTolerance.replace('_', ' ')}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Links */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30 px-6">
          <button
            onClick={() => { setActiveTab('OVERVIEW'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'OVERVIEW' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => { setActiveTab('EDIT'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'EDIT' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Edit Profile
          </button>
          <button
            onClick={() => { setActiveTab('SECURITY'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'SECURITY' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Security & Password
          </button>
          <button
            onClick={() => { setActiveTab('SWITCH'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'SWITCH' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Switch Account ({allAccounts.length})
          </button>
        </div>

        {/* Status Alerts */}
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

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-5">
              {/* Bio Card */}
              {currentUser.bio && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                    Trader Bio & Philosophy
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed italic">
                    &quot;{currentUser.bio}&quot;
                  </p>
                </div>
              )}

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-medium">Total Trades</span>
                  <div className="text-base font-bold text-zinc-100 mt-1">
                    {currentUser.stats?.totalTrades ?? 0}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-medium">Win Rate</span>
                  <div className="text-base font-bold text-emerald-400 mt-1">
                    {currentUser.stats?.winRate ?? 50}%
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-medium">Discipline (PQ)</span>
                  <div className="text-base font-bold text-blue-400 mt-1">
                    {currentUser.stats?.disciplineScore ?? 80}/100
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-medium">Favorite Asset</span>
                  <div className="text-base font-bold text-amber-400 mt-1">
                    {currentUser.stats?.favoriteStock ?? 'RELIANCE'}
                  </div>
                </div>
              </div>

              {/* Account Meta & Quick Sign Out */}
              <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                <span className="text-[11px] text-zinc-500">
                  Account Created: {new Date(currentUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={() => { onLogout(); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/40 text-xs font-semibold transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PROFILE */}
          {activeTab === 'EDIT' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Trading Persona</label>
                  <select
                    value={persona}
                    onChange={(e) => setPersona(e.target.value as TradingPersona)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="INTRADAY_SCALPER">Intraday Scalper</option>
                    <option value="OPTIONS_QUANT">Options Quant</option>
                    <option value="SWING_TRADER">Swing Trader</option>
                    <option value="MARKET_BEGINNER">Market Beginner</option>
                    <option value="ALGORITHMIC_DEV">Algo Bot Developer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Risk Profile</label>
                  <select
                    value={riskTolerance}
                    onChange={(e) => setRiskTolerance(e.target.value as RiskTolerance)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CONSERVATIVE_1">Conservative (1% Risk)</option>
                    <option value="MODERATE_2">Moderate (2% Risk)</option>
                    <option value="AGGRESSIVE_5">Aggressive (3-5% Risk)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Trader Bio & Philosophy</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your trading philosophy or focus..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
              >
                Save Profile Updates
              </button>
            </form>
          )}

          {/* TAB 3: SECURITY & PASSWORD */}
          {activeTab === 'SECURITY' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition"
              >
                Update Password
              </button>
            </form>
          )}

          {/* TAB 4: SWITCH ACCOUNT */}
          {activeTab === 'SWITCH' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">Select an existing account to load their portfolio:</span>
                <button
                  onClick={() => { onClose(); onOpenAuth(); }}
                  className="text-xs font-semibold text-blue-400 hover:underline"
                >
                  + Create New Account
                </button>
              </div>

              <div className="space-y-2">
                {allAccounts.map((account) => {
                  const isCurrent = account.id === currentUser.id;
                  return (
                    <div
                      key={account.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isCurrent
                          ? 'border-blue-500/50 bg-blue-950/20'
                          : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-200 border border-zinc-700">
                          {account.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-100">{account.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 block">{account.email}</span>
                        </div>
                      </div>

                      <div>
                        {isCurrent ? (
                          <span className="text-[11px] font-medium text-zinc-500">Current</span>
                        ) : (
                          <button
                            onClick={() => handleSwitchAccount(account.id)}
                            className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold transition"
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
