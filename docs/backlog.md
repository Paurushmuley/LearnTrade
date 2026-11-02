# Project Sprint Backlog

> Managed by **Scrum Master Agent**  
> Source of truth for active sprint tasks, feature decomposition, and delivery status.  
> Based on [`docs/brds/BRD-001-tradecraft-ai-platform.md`](file:///d:/PP/Personal%20Project/LearnTradding/docs/brds/BRD-001-tradecraft-ai-platform.md)

## Current Sprint Overview
- **Project:** TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)
- **Active Sprint:** Sprint 1 & 2 (Foundation, Trading Engine, Indian Statutory Fee Engine, Charting & BYOK Architecture)
- **Status:** COMPLETED & VERIFIED
- **Updated:** 2026-11-02

---

## Master Task Board

| Task ID | Domain | Description | Assigned Agent | Status | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-INIT` | Fullstack | Initialize Next.js TypeScript app with Tailwind CSS, Lucide icons, Lightweight Charts | Fullstack / Master Orchestrator | `DONE` | None |
| `TC-FEE-01` | Backend / Quant | Implement Indian Statutory Fee Engine (STT, GST, Exchange, SEBI, Stamp Duty, Brokerage) | Backend Lead | `DONE` | `TC-INIT` |
| `TC-ENG-02` | Backend / Core | Implement Order Execution Engine (Market, Limit, SL, SL-M, MIS, CNC, Margin Calc) | Backend Lead | `DONE` | `TC-FEE-01` |
| `TC-MKT-03` | Backend / Feed | Market Data Generator & Multi-ticker NSE data stream (Nifty 50, Bluechips) | Backend Lead | `DONE` | `TC-INIT` |
| `TC-CHT-04` | Frontend / UI | Interactive TradingView Lightweight Charts with timeframe selector & position lines | Frontend Lead | `DONE` | `TC-MKT-03` |
| `TC-ORD-05` | Frontend / UI | Order Placement Ticket with live pre-trade statutory tax preview & Risk/Reward | Frontend Lead | `DONE` | `TC-FEE-01`, `TC-CHT-04` |
| `TC-PTF-06` | Frontend / UI | Portfolio, Position Book, Order Ledger, and Margin Utilization Dashboard | Frontend Lead | `DONE` | `TC-ENG-02` |
| `TC-BYOK-07`| AI / Security | BYOK Key Vault with local encryption & validation for Gemini, OpenAI, Ollama | Backend Lead / Security | `DONE` | `TC-INIT` |
| `TC-COACH-08`| AI / Coach | AI Trading Coach & Behavioral Auditor (Revenge trading, FOMO, Discipline Score) | Backend Lead / AI | `DONE` | `TC-BYOK-07`, `TC-ENG-02` |
| `TC-STRAT-09`| AI / Quant | Natural Language Strategy Builder & Historical Backtesting Engine with Python Export | Backend Lead / Quant | `DONE` | `TC-MKT-03`, `TC-BYOK-07` |
| `TC-CRISIS-10`| Frontend / Sim | Historical Crisis Replay Simulator (COVID 2020 Crash, Budget Day Volatility) | Frontend Lead | `DONE` | `TC-CHT-04`, `TC-ENG-02` |
| `TC-QA-11` | QA / Test | Comprehensive Unit & Verification Test Suite for Financial Math and Order Engine | QA Lead | `DONE` | `TC-FEE-01`, `TC-ENG-02` |

---

## Completed Tasks Archive
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
