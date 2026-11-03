# Project Sprint Backlog

> Managed by **Scrum Master Agent**  
> Source of truth for active sprint tasks, feature decomposition, and delivery status.

## Current Sprint Overview
- **Project:** TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)
- **Active Sprint:** Sprint 4 (Tick-by-Tick Bar Replay & Level-2 Market Depth DOM Ladder)
- **Status:** COMPLETED & VERIFIED
- **Updated:** 2026-11-03

---

## Master Task Board

| Task ID | Domain | Description | Assigned Agent | Status | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-DOM-01` | Backend / Quant | Replay Slicing Engine & L2 Market Depth Generator (`src/lib/replayEngine.ts`) | Backend Lead | `DONE` | None |
| `TC-DOM-02` | Frontend / UI | Interactive Bar Replay Control Bar (Play, Pause, Step, Speeds 1x-10x) | Frontend Lead | `DONE` | `TC-DOM-01` |
| `TC-DOM-03` | Frontend / UI | Level-2 Order Book DOM Ladder (Top 5 Bids/Asks, Imbalance Gauge) | Frontend Lead | `DONE` | `TC-DOM-01` |
| `TC-DOM-04` | Fullstack / Core | Terminal integration with synchronized playhead and DOM order placement | Fullstack Lead | `DONE` | `TC-DOM-02`, `TC-DOM-03` |
| `TC-DOM-05` | QA / Test | Comprehensive Unit Tests for Replay Engine & DOM Volume Calculations | QA Lead | `DONE` | `TC-DOM-01` |

---

## Completed Sprints Archive

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
