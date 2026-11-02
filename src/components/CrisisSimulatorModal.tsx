'use client';

import React from 'react';
import { CrisisScenario, getCrisisScenarios } from '../lib/marketData';
import { AlertOctagon, Calendar, Flame, Play, ShieldAlert, X } from 'lucide-react';

interface CrisisSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadScenario: (scenario: CrisisScenario) => void;
}

export const CrisisSimulatorModal: React.FC<CrisisSimulatorModalProps> = ({
  isOpen,
  onClose,
  onLoadScenario,
}) => {
  if (!isOpen) return null;

  const scenarios = getCrisisScenarios();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F141F] border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B0E14]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Historical Market Crisis Simulator
              </h2>
              <p className="text-[11px] text-slate-400">Stress-test your risk management during catastrophic market conditions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scenarios List */}
        <div className="p-5 space-y-3.5 overflow-y-auto max-h-[70vh]">
          {scenarios.map((sc) => (
            <div
              key={sc.id}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition space-y-2.5 relative group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-sm">{sc.title}</h3>
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 font-mono text-[10px]">
                      {sc.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {sc.historicalDate}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onLoadScenario(sc);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 text-xs shadow-lg shadow-amber-600/20 transition shrink-0"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  Load Scenario
                </button>
              </div>

              <p className="text-slate-300 text-[11px] leading-relaxed">{sc.description}</p>

              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 text-[11px] text-amber-300/90 flex items-start gap-2">
                <AlertOctagon className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span><strong>Trader Challenge:</strong> {sc.challengePrompt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
