# Project Sprint Backlog

> Managed by **Scrum Master Agent**  
> Source of truth for active sprint tasks, feature decomposition, and delivery status.

## Current Sprint Overview
- **Project:** TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)
- **Active Sprint:** Sprint 11 (Autonomous AI Quant Desk & Multi-Agent Virtual Hedge Fund War Room: Macro, Momentum Alpha, Risk Officer & Execution Algorist)
- **Status:** PLANNING & ARCHITECTURE
- **Target BRD:** `docs/brds/BRD-011-autonomous-ai-quant-desk-multi-agent-virtual-hedge-fund.md`
- **Updated:** 2026-11-03

---

## Active Sprint 11 Task Board (Autonomous AI Quant Desk & Multi-Agent War Room)

| Task ID | Domain | Description | Assigned Agent | Status | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-QNT-01` | Research & Architecture | Author comprehensive BRD-011 specifying multi-agent debate protocols, voting consensus schemas, persona parameters, and risk audit rules (`docs/brds/BRD-011-...`). | Researcher Lead | `IN_PROGRESS` | None |
| `TC-QNT-02` | Backend & AI | Multi-Agent Quant Engine: Prompt chains, consensus engine, real-time market observation ingestion, position risk scoring (`src/lib/quantDeskEngine.ts`). | Backend Lead | `READY` | `TC-QNT-01` |
| `TC-QNT-03` | Frontend / UI | Interactive AI Quant Desk War Room Modal: Live transcript stream, agent persona badges, consensus vote meter, and proposed trade ticket approvals (`src/components/QuantDeskModal.tsx`). | Frontend Lead | `READY` | `TC-QNT-02` |
| `TC-QNT-04` | Fullstack & State | Header navigation, auto-trading toggles, execution feedback loop, and terminal portfolio synchronization (`src/components/Header.tsx`, `src/app/page.tsx`). | Fullstack Lead | `READY` | `TC-QNT-03` |
| `TC-QNT-05` | QA & Testing | Automated unit test suite verifying consensus calculation, persona risk boundaries, and execution trigger integrity (`test/quantDeskEngine.test.mjs`). | QA Lead | `READY` | `TC-QNT-02` |

---

## Completed Sprints Archive

### Sprint 10: Social Paper Trading Leagues, Public Leaderboards & Cryptographically Verifiable Proof-of-Alpha Trade Receipts
- [x] **TC-LGE-01**: Native Cryptographic Proof Engine: SHA-256 tradebook hash chain ($H_i$), Platform Execution Oracle with ECDSA/HMAC digital signature, Merkle root tree aggregation, and tamper-detection validator (`src/lib/proofEngine.ts`).
- [x] **TC-LGE-02**: Social Leagues & Alpha Ranking Engine: Active tournament catalog, anti-gambling risk rules (Max Drawdown Circuit Breaker $\text{Pen}_{\text{DD}}$, Position Concentration $\text{Pen}_{\text{conc}}$), and composite TradeCraft Alpha Score ($\alpha_{\text{score}}$) incorporating Sortino, Net P&L after Indian taxes, and PQ score (`src/lib/leagueEngine.ts`).
- [x] **TC-LGE-03**: Interactive Social Leagues & Leaderboard Modal: Active tournaments browser (Nifty Weekly Cup, Intraday Alpha Sprint, Options Greeks Master, Rookie Sandbox), multi-factor ranking matrix, disqualification indicators, and 1-click user tournament registration (`src/components/LeagueLeaderboardModal.tsx`).
- [x] **TC-LGE-04**: Verifiable Proof-of-Alpha Certificate & Public Verifier Modal: Stylized cryptographic attestation certificate with security seal, Merkle snapshot, interactive tamper fraud attack simulator, JSON proof receipt exporter, and public verification sandbox (`src/components/ProofOfAlphaModal.tsx`).
- [x] **TC-LGE-05**: Header navigation button ("🏆 Leagues & PoA"), Landing page feature cards, relative path resolution, and terminal tournament state synchronization (`src/components/Header.tsx`, `src/components/LandingPage.tsx`, `src/app/page.tsx`).
- [x] **TC-LGE-06**: Automated unit tests for SHA-256 chain immutability, Merkle tree root determinism, anti-tamper fraud detection, Alpha Score monotonicity, and drawdown disqualifications (`test/leagueEngine.test.mjs`, `test/tradingEngine.test.mjs`). 37/37 tests passing.

### Sprint 9: User Account Management, Multi-Persona Authentication & Creative Landing Page
- [x] **TC-USR-01**: User Account model, salted password hashing, per-user state keys, and 3 preloaded demo accounts (`src/lib/authService.ts`, `src/types/user.ts`).
- [x] **TC-USR-02**: Authentication Modal: Sign In, Sign Up, Forgot Password token flow, 1-click demo logins (`src/components/AuthModal.tsx`).
- [x] **TC-USR-03**: User Profile Modal: Profile overview, stats, edit persona, change password, account switcher, logout (`src/components/UserProfileModal.tsx`).
- [x] **TC-USR-04**: Creative, informative Landing Page: Hero, live marquee, comparison table, 8-feature grid, demo persona launchers, FAQ (`src/components/LandingPage.tsx`).
- [x] **TC-USR-05**: Header profile pill, view switching, per-user portfolio isolation, and automated unit tests (`test/authEngine.test.mjs`).

### Sprint 8: Real-Time Multi-Factor Technical Screener & Stock Scanner
- [x] **TC-SCR-01**: Multi-factor scanner engine: Volume Surge, EMA Cross, RSI, VWAP, ORB & Confluence Score (`src/lib/screenerEngine.ts`).
- [x] **TC-SCR-02**: Stock Screener Modal with presets, Confluence Score ranking, 1-click Chart Sync, AI Scanner Brief (`src/components/StockScreenerModal.tsx`).
- [x] **TC-SCR-03**: Header navigation button & terminal synchronization (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-SCR-04**: Automated unit tests for screener algorithms and confluence score calculation (`test/screenerEngine.test.mjs`).

### Sprint 7: Broker Tradebook Importer & AI Behavioral Post-Mortem Auditor
- [x] **TC-IMP-01**: Tradebook CSV parser for Zerodha & Groww + FIFO trade matcher + sample datasets (`src/lib/tradebookEngine.ts`).
- [x] **TC-IMP-02**: Behavioral bias scoring engine: Disposition Effect, Revenge Trading Index, Fee Erosion, Martingale Score.
- [x] **TC-IMP-03**: Tradebook Importer Modal with drag-and-drop CSV upload, bias metrics, trade list, sample loaders, AI Post-Mortem (`src/components/TradebookImportModal.tsx`).
- [x] **TC-IMP-04**: Header navigation link, terminal state integration, and automated unit tests (`test/tradebookEngine.test.mjs`).

### Sprint 6: Real-Time Market Breadth, FII/DII Institutional Flows & Indian Sectoral Heatmap
- [x] **TC-BRD-01**: Breadth Engine, FII/DII Net Flow & Sectoral Model (`src/lib/breadthEngine.ts`).
- [x] **TC-BRD-02**: Market Breadth Modal with Advance/Decline Gauge, FII/DII Tracker, and 7-sector heatmap (`src/components/MarketBreadthModal.tsx`).
- [x] **TC-BRD-03**: Header Navigation & Terminal data binding (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-BRD-04**: Automated unit tests for A/D Ratio, Institutional Net Flow, and Sectoral Math (`test/breadthEngine.test.mjs`).

### Sprint 5: Trader Performance Analytics, Hourly Heatmaps & Monte Carlo Simulator
- [x] **TC-QNT-01**: Closed-form Kelly Criterion position sizing calculation, 1,000-trial Monte Carlo ruin simulation, and Indian market time-of-day aggregation (`src/lib/analyticsEngine.ts`).
- [x] **TC-QNT-02**: Quantitative Analytics Modal with interactive Hourly P&L Heatmap (9 AM–3:30 PM), Day-of-week expiry table, and SVG Monte Carlo envelope (`src/components/QuantitativeAnalyticsModal.tsx`).
- [x] **TC-QNT-03**: Quant Analytics navigation button in Header and full terminal synchronization (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-QNT-04**: Automated unit tests for positive/negative edge Kelly sizing and Monte Carlo percentile envelope monotonicity (`test/analyticsEngine.test.mjs`).

### Sprint 4: Bar Replay & Level-2 Market Depth (DOM Order Book Ladder)
- [x] **TC-DOM-01**: Playhead buffer slicing, variable speed timing (1x to 10x), and stochastic Level-2 DOM generation (`src/lib/replayEngine.ts`).
- [x] **TC-DOM-02**: Floating Replay Toolbar with Play/Pause, 1-bar step forward, timeline scrubber, and speed controls (`src/components/ReplayControlBar.tsx`).
- [x] **TC-DOM-03**: Institutional Level-2 DOM Ladder with Top 5 Bids/Asks, visual volume depth bars, and real-time Imbalance gauge (`src/components/DepthOfMarketLadder.tsx`).
- [x] **TC-DOM-04**: Synchronized execution: click any ladder price rung to instantaneously route limit orders with Indian statutory taxes.
- [x] **TC-DOM-05**: Automated unit tests for candle slicing bounds, order book rung monotonicity, spread positivity, and imbalance math (`test/replayEngine.test.mjs`).

### Sprint 3: TradingView Webhook Gateway & Automated Algorithmic Trading
- [x] **TC-WH-01**: Webhook Bot Engine, token validation, Circuit Breaker drawdown protection, and PineScript v5 template generator (`src/lib/webhookEngine.ts`).
- [x] **TC-WH-02**: Next.js 15 App Router dynamic Route Handler (`POST /api/webhook`, `GET /api/webhook`) with Indian statutory tax integration (`src/app/api/webhook/route.ts`).
- [x] **TC-WH-03**: Interactive Webhook Bot Manager modal with real-time in-browser simulation playground and live audit log stream (`src/components/WebhookManagerModal.tsx`).
- [x] **TC-WH-04**: Direct navigation button in Header and real-time execution linking into portfolio positions (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-WH-05**: Automated unit tests for valid/invalid payloads, token rejection, and circuit breaker tripping (`test/webhookEngine.test.mjs`).

### Sprint 2: Options & Derivatives Sandbox (F&O Engine)
- [x] **TC-OPT-01**: Analytical Black-Scholes formula, standard normal CDF, and option Greeks ($\Delta$, $\Gamma$, $\Theta$, $\text{Vega}$) (`src/lib/optionsEngine.ts`).
- [x] **TC-OPT-02**: Dynamic Option Chain generator with strike grids, IV smile, and Open Interest (OI) metrics (`src/components/OptionChainModal.tsx`).
- [x] **TC-OPT-03**: Multi-Leg Strategy Payoff Calculator with Max Profit, Max Loss, Breakevens, and Options STT taxes (`src/components/StrategyPayoffModal.tsx`).
- [x] **TC-OPT-04**: Interactive Option Chain modal with Call/Put matrices, ATM badges, and quick leg add.
- [x] **TC-OPT-05**: Strategy Payoff Visualizer with institutional templates (Bull Call, Iron Condor, Straddle) & AI Options Architect.
- [x] **TC-OPT-06**: Automated unit tests for Black-Scholes pricing, put-call parity delta, and multi-leg spreads (`test/optionsEngine.test.mjs`).

### Sprint 1: Foundation, Trading Engine, Indian Statutory Fees & BYOK
- [x] **TC-INIT**: Scaffold Next.js application workspace with required UI, icons, and charting dependencies.
- [x] **TC-FEE-01**: Build Indian Statutory Tax & Fee calculation module with exact SEBI/NSE formulas (`src/lib/taxEngine.ts`).
- [x] **TC-ENG-02**: Build Paper Trading Order Matching Engine, margin manager, and portfolio state store (`src/context/TradingContext.tsx`).
- [x] **TC-MKT-03**: Create real-time market data feed & historical OHLCV generator for NSE Top Equities (`src/lib/mockMarketData.ts`).
- [x] **TC-CHT-04**: Build TradingView Lightweight Charting component with candle styling and volume histogram (`src/components/CandlestickChart.tsx`).
- [x] **TC-ORD-05**: Build Trade Ticket with pre-trade statutory breakdown, quantity calculator, and SL/Target (`src/components/OrderForm.tsx`).
- [x] **TC-PTF-06**: Build interactive Holdings, Positions, Orders, and P&L Analytics views (`src/components/PositionsTable.tsx`).
- [x] **TC-BYOK-07**: Build BYOK Modal with live key testing for Google Gemini (`gemini-2.5-flash`), OpenAI, Ollama (`src/components/BYOKModal.tsx`).
- [x] **TC-COACH-08**: Build AI Trade Coach, Behavioral Auditor (Revenge trading, FOMO), and Discipline (PQ) meter (`src/components/AICoachPanel.tsx`).
- [x] **TC-STRAT-09**: Build Natural Language Strategy Builder, Backtester with equity curves, and Python exporter (`src/components/StrategyBuilderModal.tsx`).
- [x] **TC-CRISIS-10**: Build Historical Scenario Crisis Replay mode (`src/components/HistoricalCrisisModal.tsx`).
- [x] **TC-QA-11**: Implement automated unit tests validating tax calculations, order states, and margin safety (`test/taxEngine.test.mjs`).
