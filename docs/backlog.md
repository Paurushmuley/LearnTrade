# Project Sprint Backlog

> Managed by **Scrum Master Agent**  
> Source of truth for active sprint tasks, feature decomposition, and delivery status.

## Current Sprint Overview
- **Project:** TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)
- **Active Sprint:** Sprint 3 (TradingView Webhook Gateway & Automated Algorithmic Paper Trading Engine)
- **Status:** COMPLETED & VERIFIED
- **Updated:** 2026-11-03

---

## Master Task Board

| Task ID | Domain | Description | Assigned Agent | Status | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-WH-01` | Backend / Quant | Webhook Bot Engine & PineScript Alert Generator (`src/lib/webhookEngine.ts`) | Backend Lead | `DONE` | None |
| `TC-WH-02` | Backend / API | Next.js API Route Handler (`src/app/api/webhook/route.ts`) with token auth | Backend Lead | `DONE` | `TC-WH-01` |
| `TC-WH-03` | Frontend / UI | Webhook Bot Manager Modal & In-Browser Test Playground | Frontend Lead | `DONE` | `TC-WH-01`, `TC-WH-02` |
| `TC-WH-04` | Fullstack / Core | Terminal integration with bot order stream and auto-refresh | Fullstack Lead | `DONE` | `TC-WH-03` |
| `TC-WH-05` | QA / Test | Comprehensive Unit & Integration Tests for Webhook Gateway | QA Lead | `DONE` | `TC-WH-01`, `TC-WH-02` |

---

## Completed Sprints Archive

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
