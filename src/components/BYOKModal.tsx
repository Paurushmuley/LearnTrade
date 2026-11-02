'use client';

import React, { useState } from 'react';
import { AIConfig, AIProviderType } from '../types/trading';
import { testAIConnection } from '../lib/aiProvider';
import { CheckCircle2, ExternalLink, Key, Lock, ShieldCheck, Sparkles, X } from 'lucide-react';

interface BYOKModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSaveConfig: (config: AIConfig) => void;
}

export const BYOKModal: React.FC<BYOKModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [provider, setProvider] = useState<AIProviderType>(config.provider || 'gemini');
  const [geminiKey, setGeminiKey] = useState<string>(config.geminiKey || '');
  const [openaiKey, setOpenaiKey] = useState<string>(config.openaiKey || '');
  const [ollamaUrl, setOllamaUrl] = useState<string>(config.ollamaUrl || 'http://localhost:11434');
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestStatus(null);
    const res = await testAIConnection({
      provider,
      geminiKey,
      openaiKey,
      ollamaUrl,
    });
    setTestStatus(res);
    setTesting(false);
  };

  const handleSave = () => {
    onSaveConfig({
      provider,
      geminiKey,
      openaiKey,
      ollamaUrl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F141F] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B0E14]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                BYOK Security Vault (Bring Your Own Key)
              </h2>
              <p className="text-[11px] text-slate-400">Zero-Knowledge client architecture • Zero server inference costs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Provider Selection */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1.5">Select AI Engine</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'gemini'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1 text-[11px]">
                  <Sparkles className="h-3 w-3 text-blue-400" />
                  Gemini
                </div>
                <span className="text-[9px] text-emerald-400 font-medium">Free Tier Available</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'openai'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-[11px]">OpenAI</div>
                <span className="text-[9px] text-slate-500">gpt-4o / mini</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('ollama')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'ollama'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-[11px]">Ollama Local</div>
                <span className="text-[9px] text-emerald-400 font-medium">100% Offline / Free</span>
              </button>
            </div>
          </div>

          {/* Form fields based on selected provider */}
          {provider === 'gemini' && (
            <div className="space-y-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center">
                <label className="text-slate-200 font-medium">Google Gemini API Key</label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  Get free key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500 text-xs"
              />
              <p className="text-[10px] text-slate-400">
                Recommended model: <strong className="text-slate-300">gemini-2.5-flash</strong> (Ultra-fast, generous free requests per minute).
              </p>
            </div>
          )}

          {provider === 'openai' && (
            <div className="space-y-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center">
                <label className="text-slate-200 font-medium">OpenAI API Key</label>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  OpenAI dashboard <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500 text-xs"
              />
              <p className="text-[10px] text-slate-400">
                Uses your personal OpenAI quota with <strong className="text-slate-300">gpt-4o-mini</strong>.
              </p>
            </div>
          )}

          {provider === 'ollama' && (
            <div className="space-y-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-slate-200 font-medium block">Local Ollama API Endpoint</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500 text-xs"
              />
              <p className="text-[10px] text-slate-400">
                Ensures 100% private and air-gapped trading psychology audits using local models (e.g. <code className="text-blue-300">ollama run llama3</code>).
              </p>
            </div>
          )}

          {/* Test Status Feedback */}
          {testStatus && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                testStatus.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              {testStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
              <span>{testStatus.message}</span>
            </div>
          )}

          {/* Security Notice */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl flex items-start gap-2.5 text-slate-400 text-[11px]">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200 block">Zero-Trust Key Storage</strong>
              Keys are held securely in your browser session memory/localStorage and only used to dispatch prompts directly to your chosen provider.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-[#0B0E14]">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition"
          >
            {testing ? 'Testing connection...' : 'Test Connection'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition"
            >
              Save Key Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
