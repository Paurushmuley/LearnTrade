'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Globe2,
  Clock,
  Activity,
  ShieldAlert,
  Newspaper,
  TrendingUp,
  TrendingDown,
  Zap,
  Percent,
} from 'lucide-react';
import {
  MacroEventRecord,
  NewsSentimentItem,
  EventRiskRegime,
} from '../types/macroEvent';
import {
  DEFAULT_MACRO_EVENTS,
  getSampleNewsWire,
  HISTORICAL_MACRO_SCENARIOS,
  HistoricalScenarioDef,
  analyzePreEventVolatility,
  generateEventVolatilityCone,
  calculateSectorImpacts,
  getCompositeMacroEventRiskState,
  solvePreEventHedge,
} from '../lib/macroEventEngine';

interface MacroEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioVega?: number;
  portfolioDelta?: number;
  spotPrice?: number;
}

export const MacroEventModal: React.FC<MacroEventModalProps> = ({
  isOpen,
  onClose,
  portfolioVega = 25000,
  portfolioDelta = 45,
  spotPrice = 24500,
}) => {
  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'NEWS' | 'IV_SIMULATOR' | 'SCENARIO'>('CALENDAR');
  const [selectedEvent, setSelectedEvent] = useState<MacroEventRecord>(DEFAULT_MACRO_EVENTS[0]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(HISTORICAL_MACRO_SCENARIOS[0].id);

  // Dynamic simulation parameters for Tab 3 (IV Jump/Crush Simulator)
  const [baselineIv, setBaselineIv] = useState<number>(14.0); // %
  const [daysToExpiry, setDaysToExpiry] = useState<number>(7);

  // Sample news stream
  const newsList = useMemo(() => getSampleNewsWire(), []);

  // Real-time ERS calculation
  const ersState = useMemo(() => {
    return getCompositeMacroEventRiskState(DEFAULT_MACRO_EVENTS, 0.225, baselineIv / 100, newsList);
  }, [baselineIv, newsList]);

  // Pre-event vol analysis for selected event
  const volAnalysis = useMemo(() => {
    const hoursToEvent = Math.max(0.5, (new Date(selectedEvent.scheduledTime).getTime() - Date.now()) / (3600 * 1000));
    return analyzePreEventVolatility(
      selectedEvent,
      spotPrice,
      (baselineIv + 8.5) / 100,
      baselineIv / 100,
      hoursToEvent,
      daysToExpiry,
      portfolioVega
    );
  }, [selectedEvent, spotPrice, daysToExpiry, baselineIv, portfolioVega]);

  // Sector betas for selected event category
  const sectorBetas = useMemo(() => {
    return calculateSectorImpacts(selectedEvent, volAnalysis.impliedStraddleMovePct || 1.8);
  }, [selectedEvent, volAnalysis]);

  // Volatility cone for selected event
  const volCone = useMemo(() => {
    return generateEventVolatilityCone(
      'NIFTY 50',
      volAnalysis.currentIv / 100,
      baselineIv / 100,
      0.0035
    );
  }, [baselineIv, volAnalysis]);

  // Hedging recommendations
  const hedgeRecommendations = useMemo(() => {
    return solvePreEventHedge(
      {
        netDelta: portfolioDelta,
        netVega: portfolioVega,
        netGamma: -0.02,
        spotPrice,
      },
      selectedEvent,
      'NIFTY 50'
    );
  }, [portfolioDelta, portfolioVega, selectedEvent, spotPrice]);

  if (!isOpen) return null;

  const getRegimeColor = (regime: EventRiskRegime) => {
    switch (regime) {
      case 'SEVERE_REGIME': return 'text-red-400 bg-red-950/60 border-red-800/80';
      case 'HIGH_RISK': return 'text-orange-400 bg-orange-950/60 border-orange-800/80';
      case 'ELEVATED': return 'text-amber-400 bg-amber-950/60 border-amber-800/80';
      default: return 'text-cyan-400 bg-cyan-950/60 border-cyan-800/80';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Macroeconomic Sentiment & Event Risk Engine</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRegimeColor(ersState.regime)}`}>
                  {ersState.regime.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dubinsky-Johannes IV Jump Model · Loughran-McDonald NLP Lexicon · NSE Sector Event Betas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ERS HUD Badge */}
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Event Risk Score</div>
              <div className="text-base font-extrabold text-cyan-400 font-mono">
                {ersState.overallErs} <span className="text-xs text-slate-500 font-normal">/ 100</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('CALENDAR')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'CALENDAR'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            1. Macro Economic Calendar
          </button>
          <button
            onClick={() => setActiveTab('NEWS')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'NEWS'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Newspaper className="h-3.5 w-3.5" />
            2. Financial NLP News Wire
          </button>
          <button
            onClick={() => setActiveTab('IV_SIMULATOR')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'IV_SIMULATOR'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            3. IV Jump & Crush Simulator
          </button>
          <button
            onClick={() => setActiveTab('SCENARIO')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'SCENARIO'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            4. Historical Shocks & Pre-Event Hedging
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: MACRO ECONOMIC CALENDAR */}
          {activeTab === 'CALENDAR' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DEFAULT_MACRO_EVENTS.map((evt) => {
                  const isSelected = selectedEvent.id === evt.id;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`p-4 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-indigo-950/30 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-mono text-slate-400">{evt.category.replace(/_/g, ' ')}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.impactLevel === 'CRITICAL' ? 'bg-red-950/80 text-red-400 border border-red-800/80' : 'bg-amber-950/80 text-amber-400 border border-amber-800/80'
                        }`}>
                          {evt.impactLevel}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100 line-clamp-1">{evt.name}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{evt.description}</p>
                      
                      <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div>
                          <div className="text-slate-500 text-[10px]">Shock Beta</div>
                          <div className="font-mono font-bold text-slate-200">{evt.historicalVolatilityBeta.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-[10px]">IV Surge</div>
                          <div className="font-mono font-bold text-amber-400">+{evt.preEventIvInflation.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-[10px]">Post Crush</div>
                          <div className="font-mono font-bold text-red-400">-{evt.expectedCrushPct.toFixed(0)}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Event Detail & Sector Sensitivity Panel */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <span>🎯 Selected Catalyst Impact: {selectedEvent.name}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target Assets: {selectedEvent.targetAssets.join(', ')} · Consensus: {selectedEvent.consensusForecast}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('IV_SIMULATOR')}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Simulate IV Jump & Crush
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {sectorBetas.map((sec) => (
                    <div key={sec.sectorName} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                      <div className="text-xs font-semibold text-slate-300 truncate">{sec.sectorName}</div>
                      <div className="text-base font-extrabold text-indigo-400 font-mono mt-1">
                        β {sec.beta.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Exp Move: ±{sec.expectedSectorMovePct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIAL NLP NEWS WIRE */}
          {activeTab === 'NEWS' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Loughran-McDonald Financial Sentiment Lexicon</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time headline scoring with monetary policy stance detection and exponential half-life information decay.
                  </p>
                </div>
                <div className="flex gap-4 text-xs font-mono">
                  <span className="text-emerald-400">Bullish: {ersState.sentimentDistribution.positive}</span>
                  <span className="text-slate-400">Neutral: {ersState.sentimentDistribution.neutral}</span>
                  <span className="text-red-400">Hawkish/Bearish: {ersState.sentimentDistribution.negative}</span>
                </div>
              </div>

              <div className="space-y-3">
                {newsList.map((news: NewsSentimentItem) => {
                  const isPositive = news.sentimentScore > 0;
                  return (
                    <div key={news.id} className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1 max-w-3xl">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                            {news.source}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            news.stance === 'HAWKISH' ? 'bg-red-950 text-red-400 border border-red-800' :
                            news.stance === 'DOVISH' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {news.stance}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Decayed Score: {news.decayedScore.toFixed(2)}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-100">{news.headline}</h4>
                        <p className="text-xs text-slate-400">{news.summary}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-base font-extrabold font-mono flex items-center justify-end gap-1 ${
                          isPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {isPositive ? '+' : ''}{news.sentimentScore.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          Confidence: {(news.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DUBINSKY-JOHANNES IV JUMP & CRUSH SIMULATOR */}
          {activeTab === 'IV_SIMULATOR' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Simulator Controls */}
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-indigo-400" />
                    Model Hyperparameters
                  </h4>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Baseline Realized IV (σ_diff)</span>
                      <span className="font-mono font-bold text-slate-200">{baselineIv.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="0.5"
                      value={baselineIv}
                      onChange={(e) => setBaselineIv(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Days to Expiration (T)</span>
                      <span className="font-mono font-bold text-slate-200">{daysToExpiry} Days</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      step="1"
                      value={daysToExpiry}
                      onChange={(e) => setDaysToExpiry(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Calculated Pre-Event IV:</span>
                      <span className="font-mono font-bold text-amber-400">{volAnalysis.currentIv.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Post-Event Crushed IV:</span>
                      <span className="font-mono font-bold text-cyan-400">{volAnalysis.forecastPostEventIv.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Instantaneous Crush:</span>
                      <span className="font-mono font-bold text-red-400">-{volAnalysis.expectedCrushPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* 2D SVG Volatility Smile / Crush Curve */}
                <div className="lg:col-span-2 p-5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
                      Dubinsky-Johannes Volatility Term Structure
                    </h4>
                    <p className="text-xs text-slate-400">
                      Comparing elevated Pre-Event IV Smile against post-announcement crushed variance.
                    </p>
                  </div>

                  {/* SVG Chart */}
                  <div className="h-48 w-full my-4 flex items-center justify-center">
                    <svg viewBox="0 0 500 160" className="w-full h-full">
                      {/* Grid lines */}
                      <line x1="40" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="40" y1="70" x2="480" y2="70" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="40" y1="120" x2="480" y2="120" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />

                      {/* Baseline IV (Cyan) */}
                      <path
                        d="M 40 120 Q 260 125 480 120"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="3"
                      />
                      {/* Pre-Event Inflated IV (Amber) */}
                      <path
                        d="M 40 40 Q 260 50 480 85"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3"
                        strokeDasharray="4 2"
                      />

                      {/* Legend Labels */}
                      <text x="50" y="35" fill="#f59e0b" fontSize="11" fontFamily="monospace">
                        Pre-Event IV ({volAnalysis.currentIv.toFixed(1)}%)
                      </text>
                      <text x="50" y="140" fill="#06b6d4" fontSize="11" fontFamily="monospace">
                        Crushed Baseline IV ({volAnalysis.forecastPostEventIv.toFixed(1)}%)
                      </text>
                    </svg>
                  </div>

                  {/* Quant Stats Bar */}
                  <div className="grid grid-cols-3 gap-3 text-center border-t border-slate-800/80 pt-3">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Implied Straddle Move</div>
                      <div className="text-sm font-extrabold text-slate-200 font-mono">
                        ±{volAnalysis.impliedStraddleMovePct.toFixed(2)}% (±{volAnalysis.impliedMovePoints.toFixed(0)} pts)
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Net Portfolio Vega</div>
                      <div className="text-sm font-extrabold text-indigo-400 font-mono">
                        ₹{portfolioVega.toLocaleString()} / 1% IV
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Projected Vega Crush P&L</div>
                      <div className="text-sm font-extrabold text-red-400 font-mono">
                        -₹{Math.abs(volAnalysis.estimatedVegaPnlImpact).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HISTORICAL SHOCKS & PRE-EVENT HEDGING */}
          {activeTab === 'SCENARIO' && (
            <div className="space-y-6">
              
              {/* Stress Test Scenarios */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {HISTORICAL_MACRO_SCENARIOS.map((scn: HistoricalScenarioDef) => {
                  const isSelected = selectedScenarioId === scn.id;
                  return (
                    <div
                      key={scn.id}
                      onClick={() => setSelectedScenarioId(scn.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-indigo-950/30 border-indigo-500/80'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-slate-400">{scn.date}</span>
                        <span className="text-xs font-bold text-red-400">{scn.indexShockPct}% Shock</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">{scn.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{scn.context}</p>
                    </div>
                  );
                })}
              </div>

              {/* Actionable Pre-Event Hedging Solver */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-400" />
                      <span>Quantitative Pre-Event Hedging Orders</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Delta-neutral and Vega-immunized hedge orders with full SEBI statutory fee drag calculation.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {hedgeRecommendations.map((hdg) => (
                    <div key={hdg.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            hdg.side === 'BUY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                          }`}>
                            {hdg.side} {hdg.lots} LOTS ({hdg.quantity} Units)
                          </span>
                          <span className="text-xs font-bold text-slate-200">{hdg.targetInstrument}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-300 font-mono">
                            {hdg.hedgeType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{hdg.rationale}</p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Statutory Taxes</div>
                          <div className="text-xs font-mono text-amber-400">₹{hdg.statutoryFrictionInr.toFixed(2)}</div>
                        </div>
                        <button
                          onClick={() => alert(`Executed Hedge Order: ${hdg.side} ${hdg.quantity} ${hdg.targetInstrument}`)}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          1-Click Execute
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
