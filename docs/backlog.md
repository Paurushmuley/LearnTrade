# Project Sprint Backlog

> Managed by **Scrum Master Agent**  
> Source of truth for active sprint tasks, feature decomposition, and delivery status.

## Current Sprint Overview
- **Project:** TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)
- **Active Sprint:** Sprint 13 (Real-Time Options Greeks Hedger & Dynamic Delta-Gamma Neutral Portfolio Autobalancer)
- **Status:** IN PROGRESS (ENGINEERING & TESTS)
- **Target BRD:** `docs/brds/BRD-013-options-greeks-hedger-delta-gamma-neutral-autobalancer.md`
- **Updated:** 2026-11-03

---

## Active Sprint 13 Task Board (Dynamic Options Greeks Hedger & Delta-Gamma Autobalancer)

| Task ID | Domain | Description | Assigned Agent | Status | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-HDG-01` | Research & Architecture | Author comprehensive BRD-013 specifying analytical Greek hedging math, Delta neutral bounds ($\Delta_{\text{net}} \approx 0$), Gamma curvature protection, and auto-rebalancing thresholds (`docs/brds/BRD-013-...`). | Researcher Lead | `COMPLETED` | None |
| `TC-HDG-02` | Backend & Options | Greeks Hedging Engine: Aggregate portfolio Delta ($\Delta$), Gamma ($\Gamma$), Vega ($\nu$), Theta ($\Theta$), auto-hedge order solver for ATM/OTM options or futures (`src/lib/greeksHedgerEngine.ts`). | Backend Lead | `IN_PROGRESS` | `TC-HDG-01` |
| `TC-HDG-03` | Frontend / UI | Interactive Greeks Hedging Studio Modal: Real-time Greeks risk radar, 2D curvature payoff visualizer, 1-click "Neutralize Delta" solver, and autobalancer daemon controls (`src/components/GreeksHedgerModal.tsx`). | Frontend Lead | `IN_PROGRESS` | `TC-HDG-02` |
| `TC-HDG-04` | Fullstack & State | Header navigation ("🛡️ Delta Hedger"), auto-hedging daemon interval, and terminal options chain synchronization (`src/components/Header.tsx`, `src/app/page.tsx`). | Fullstack Lead | `IN_PROGRESS` | `TC-HDG-03` |
| `TC-HDG-05` | QA & Testing | Automated unit tests for portfolio Greek aggregation, zero-delta solver accuracy, and hedge rebalancing trigger points (`test/greeksHedgerEngine.test.mjs`). | QA Lead | `IN_PROGRESS` | `TC-HDG-02` |

### Sprint 13 User Stories & Acceptance Criteria

#### User Story 1: Analytical Greeks Aggregation & Hedging Solver (`TC-HDG-01`, `TC-HDG-02`)
- **Story:** *As an institutional derivatives trader*, I want the system to continuously calculate aggregate portfolio Greeks ($\Delta_{\text{port}}$, $\Gamma_{\text{port}}$, $\mathcal{V}_{\text{port}}$, $\Theta_{\text{port}}$) across all open stock and option positions, and automatically compute exact hedging quantities in underlying assets or companion options, so that I can eliminate directional risk and stabilize my portfolio.
- **Acceptance Criteria:**
  - Aggregate net portfolio Delta: $\Delta_{\text{net}} = \sum_i Q_i \cdot \Delta_i$.
  - Provide a 1-instrument Delta Neutral Solver calculating exact underlying shares or ATM option contracts to drive $\Delta_{\text{net}} \to 0$.
  - Provide a 2-instrument Delta-Gamma Neutral Solver using a $2 \times 2$ matrix system to simultaneously neutralize directional drift ($\Delta$) and curvature acceleration ($\Gamma$):
    $$\begin{pmatrix} \Delta_1 & \Delta_2 \\ \Gamma_1 & \Gamma_2 \end{pmatrix} \begin{pmatrix} n_1 \\ n_2 \end{pmatrix} = -\begin{pmatrix} \Delta_{\text{port}} \\ \Gamma_{\text{port}} \end{pmatrix}$$
  - Integrate Indian statutory tax estimation (STT, GST, Exchange charges) via `taxEngine.ts` to ensure rebalancing costs do not exceed the variance benefit.
  - Implement a configurable deadband tolerance (e.g. $|\Delta_{\text{net}}| \le \delta_{\text{tol}}$) to prevent frivolous micro-rebalancing.

#### User Story 2: Interactive Greeks Hedging Studio & Curvature Visualizer (`TC-HDG-03`)
- **Story:** *As a trader*, I want an intuitive visual studio with real-time Greek risk gauges, a 2D curvature payoff visualizer, and a 1-click execution interface, so that I can monitor portfolio sensitivity to market moves and deploy rebalancing orders with one click.
- **Acceptance Criteria:**
  - 4 real-time risk gauges with color-coded safety/danger zones for Delta, Gamma, Vega, and Theta.
  - Dynamic 2D P&L Curvature chart displaying current portfolio payoff envelope vs hedged payoff curve across a $\pm 5\%$ underlying price swing.
  - "Autobalancer Daemon" toggle with adjustable rebalancing frequency and threshold slider.
  - Proposed hedge recommendation card with contract details, estimated statutory tax friction, and a 1-click "Execute Neutralizing Hedge" button.

#### User Story 3: Terminal Integration & Seamless Order Execution (`TC-HDG-04`)
- **Story:** *As a platform user*, I want the Greeks Hedger accessible from the primary terminal header with real-time status badges, so that hedging orders route through the existing paper trading engine and update my positions instantly.
- **Acceptance Criteria:**
  - Dedicated "🛡️ Delta Hedger" button in `Header.tsx` displaying current net Delta status pill.
  - One-click hedge executions seamlessly update `TradingContext.tsx` holdings, margin reserves, and order history.
  - Landing page feature showcase updated with Greeks Autobalancer capabilities.

#### User Story 4: Automated Verification & Quality Gates (`TC-HDG-05`)
- **Story:** *As a QA engineer*, I want automated unit tests validating Greek superposition math, matrix solver accuracy, tolerance boundaries, and fee friction checks, so that the hedging engine operates with zero calculation errors.
- **Acceptance Criteria:**
  - 100% test pass rate in `test/greeksHedgerEngine.test.mjs`.
  - Zero TypeScript compiler errors (`npx tsc --noEmit`).
  - Production build succeeds without warnings (`npm run build`).

---

## Completed Sprints Archive

### Sprint 12: Institutional Trade Copier & Cross-Account Multi-Broker Execution Bridge
- [x] **TC-COP-01**: Author comprehensive BRD-012 specifying master/slave copier ratios, lot size rounding, latency models, and multi-broker API payload adapters (`docs/brds/BRD-012-institutional-trade-copier-cross-account-multi-broker-bridge.md`).
- [x] **TC-COP-02**: Multi-Broker Bridge Engine: Master-to-slave account mirroring, Equity-Proportional / Fixed Multiplier / Risk Parity sizing, broker latency distribution ($\mu, \sigma$ for Zerodha, Groww, Upstox), adverse slippage, and Slippage Guard filter (`src/lib/tradeCopierEngine.ts`, `src/types/tradeCopier.ts`).
- [x] **TC-COP-03**: Interactive Trade Copier Modal: Slave accounts matrix, live sync toggle, risk multiplier sliders (0.1x to 3.0x), broadcast order simulator, live latency/slippage audit stream, and Emergency Global Kill Switch (`src/components/TradeCopierModal.tsx`).
- [x] **TC-COP-04**: Header navigation ("🔗 Trade Copier"), Landing Page feature card, terminal synchronization, and multi-account state persistence (`src/components/Header.tsx`, `src/components/LandingPage.tsx`, `src/app/page.tsx`).
- [x] **TC-COP-05**: Automated unit test suite verifying proportional sizing math, Indian exchange lot size rounding (NIFTY 25, BANKNIFTY 15), margin haircuts, broker latency profiles, slippage guard breaches, and emergency liquidation (`test/tradeCopierEngine.test.mjs`). 48/48 tests passing.

### Sprint 11: Autonomous AI Quant Desk & Multi-Agent Virtual Hedge Fund War Room
- [x] **TC-QNT-01**: Author comprehensive BRD-011 specifying 4-phase debate protocol, consensus schemas, and risk audit rules (`docs/brds/BRD-011-autonomous-ai-quant-desk-multi-agent-virtual-hedge-fund.md`).
- [x] **TC-QNT-02**: Multi-Agent Quant Engine: 4 autonomous personas (Dr. Vance Macro, Vikram Alpha Hunter, Elena CRO, Kavita Algorist), VaR limits, Almgren-Chriss DOM impact, and mathematical consensus calculator (`src/lib/quantDeskEngine.ts`, `src/types/quantDesk.ts`).
- [x] **TC-QNT-03**: Interactive AI Quant Desk War Room Modal: Agent podiums, live 4-round debate stream, consensus verdict banner, approved sizing gauges, and 1-click execution (`src/components/QuantWarRoomModal.tsx`).
- [x] **TC-QNT-04**: Header navigation ("🤖 Quant Desk"), Landing Page feature card, terminal synchronization, and 1-click paper trading order placement (`src/components/Header.tsx`, `src/components/LandingPage.tsx`, `src/app/page.tsx`).
- [x] **TC-QNT-05**: Automated unit test suite verifying macro scoring, CRO 6% drawdown veto, counter-trend veto, 99% VaR haircut, and DOM routing logic (`test/quantDeskEngine.test.mjs`). 42/42 tests passing.

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
