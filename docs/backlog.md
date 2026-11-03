# Project Sprint Backlog

> Managed by **Scrum Master Agent**  
> Source of truth for active sprint tasks, feature decomposition, and delivery status.

## Current Sprint Overview
- **Project:** TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)
- **Active Sprint:** Sprint 7 (Broker Tradebook Importer & AI Behavioral Post-Mortem Auditor - Zerodha/Groww)
- **Status:** IN PROGRESS
- **Updated:** 2026-11-03

---

## Active Sprint 7 Task Board (Broker Statement Importer & Behavioral Auditor)

| Task ID | Domain | Description | Assigned Agent | Status | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-IMP-01` | Backend / Quant | Tradebook CSV parser for Zerodha & Groww + FIFO trade matcher + sample datasets (`src/lib/tradebookEngine.ts`) | Backend Lead | `DONE` | None |
| `TC-IMP-02` | Backend / Quant | Behavioral bias scoring engine: Disposition Effect, Revenge Trading Index, Fee Erosion, Martingale Score | Backend Lead | `DONE` | `TC-IMP-01` |
| `TC-IMP-03` | Frontend / UI | Tradebook Importer Modal: Drag-and-drop CSV upload, bias metrics, trade list, sample loaders, AI Post-Mortem | Frontend Lead | `DONE` | `TC-IMP-01`, `TC-IMP-02` |
| `TC-IMP-04` | Fullstack & QA | Header navigation link, terminal state integration, and automated unit tests (`test/tradebookEngine.test.mjs`) | Fullstack / QA Lead | `DONE` | `TC-IMP-03` |

---

## Completed Sprints Archive

### Sprint 6: Real-Time Market Breadth, FII/DII Institutional Flows & Indian Sectoral Heatmap
- [x] **TC-BRD-01**: Breadth Engine, FII/DII Net Flow & Sectoral Model (`src/lib/breadthEngine.ts`).
- [x] **TC-BRD-02**: Market Breadth Modal with Advance/Decline Gauge, FII/DII Tracker, and 7-sector heatmap (`src/components/MarketBreadthModal.tsx`).
- [x] **TC-BRD-03**: Header Navigation & Terminal data binding (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-BRD-04**: Automated unit tests for A/D Ratio, Institutional Net Flow, and Sectoral Math (`test/breadthEngine.test.mjs`).

### Sprint 5: Trader Performance Analytics, Hourly Heatmaps & Monte Carlo Simulator
- [x] **TC-QNT-01**: Closed-form Kelly Criterion position sizing calculation, 1,000-trial Monte Carlo ruin simulation, and Indian market time-of-day aggregation.
- [x] **TC-QNT-02**: Quantitative Analytics Modal with interactive Hourly P&L Heatmap (9 AM–3:30 PM), Day-of-week expiry table, and SVG Monte Carlo envelope.
- [x] **TC-QNT-03**: Quant Analytics navigation button in Header and full terminal synchronization.
- [x] **TC-QNT-04**: Automated unit tests for positive/negative edge Kelly sizing and Monte Carlo percentile envelope monotonicity.

### Sprint 4: Bar Replay & Level-2 Market Depth (DOM Order Book Ladder)
- [x] **TC-DOM-01**: Playhead buffer slicing, variable speed timing (1x to 10x), and stochastic Level-2 DOM generation.
- [x] **TC-DOM-02**: Floating Replay Toolbar with Play/Pause, 1-bar step forward, timeline scrubber, and speed controls.
- [x] **TC-DOM-03**: Institutional Level-2 DOM Ladder with Top 5 Bids/Asks, visual volume depth bars, and real-time Imbalance gauge.
- [x] **TC-DOM-04**: Synchronized execution: click any ladder price rung to instantaneously route limit orders with Indian statutory taxes.
- [x] **TC-DOM-05**: Automated unit tests for candle slicing bounds, order book rung monotonicity, spread positivity, and imbalance math.

### Sprint 3: TradingView Webhook Gateway & Automated Algorithmic Trading
- [x] **TC-WH-01**: Webhook Bot Engine, token validation, Circuit Breaker drawdown protection, and PineScript v5 template generator.
- [x] **TC-WH-02**: Next.js 15 App Router dynamic Route Handler (`POST /api/webhook`, `GET /api/webhook`) with Indian statutory tax integration.
- [x] **TC-WH-03**: Interactive Webhook Bot Manager modal with real-time in-browser simulation playground and live audit log stream.
- [x] **TC-WH-04**: Direct navigation button in Header and real-time execution linking into portfolio positions.
- [x] **TC-WH-05**: Automated unit tests for valid/invalid payloads, token rejection, and circuit breaker tripping.

### Sprint 2: Options & Derivatives Sandbox (F&O Engine)
- [x] **TC-OPT-01**: Analytical Black-Scholes formula, standard normal CDF, and option Greeks ($\Delta$, $\Gamma$, $\Theta$, $\text{Vega}$).
- [x] **TC-OPT-02**: Dynamic Option Chain generator with strike grids, IV smile, and Open Interest (OI) metrics.
- [x] **TC-OPT-03**: Multi-Leg Strategy Payoff Calculator with Max Profit, Max Loss, Breakevens, and Options STT taxes.
- [x] **TC-OPT-04**: Interactive Option Chain modal with Call/Put matrices, ATM badges, and quick leg add.
- [x] **TC-OPT-05**: Strategy Payoff Visualizer with institutional templates (Bull Call, Iron Condor, Straddle) & AI Options Architect.
- [x] **TC-OPT-06**: Automated unit tests for Black-Scholes pricing, put-call parity delta, and multi-leg spreads.

### Sprint 1: Foundation, Trading Engine, Indian Statutory Fees & BYOK
- [x] **TC-INIT**: Scaffold Next.js application workspace with required UI, icons, and charting dependencies.
- [x] **TC-FEE-01**: Build Indian Statutory Tax & Fee calculation module with exact SEBI/NSE formulas.
- [x] **TC-ENG-02**: Build Paper Trading Order Matching Engine, margin manager, and portfolio state store.
- [x] **TC-MKT-03**: Create real-time market data feed & historical OHLCV generator for NSE Top Equities.
- [x] **TC-CHT-04**: Build TradingView Lightweight Charting component with candle styling and volume histogram.
- [x] **TC-ORD-05**: Build Trade Ticket with pre-trade statutory breakdown, quantity calculator, and SL/Target.
- [x] **TC-PTF-06**: Build interactive Holdings, Positions, Orders, and P&L Analytics views.
- [x] **TC-BYOK-07**: Build BYOK Modal with live key testing for Google Gemini (`gemini-2.5-flash`), OpenAI, Ollama.
- [x] **TC-COACH-08**: Build AI Trade Coach, Behavioral Auditor (Revenge trading, FOMO), and Discipline (PQ) meter.
- [x] **TC-STRAT-09**: Build Natural Language Strategy Builder, Backtester with equity curves, and Python exporter.
- [x] **TC-CRISIS-10**: Build Historical Scenario Crisis Replay mode.
- [x] **TC-QA-11**: Implement automated unit tests validating tax calculations, order states, and margin safety.
