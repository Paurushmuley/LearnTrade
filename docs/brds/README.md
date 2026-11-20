# Business Requirements Document (BRD) Directory

> Generated and maintained by **Researcher Agent**  
> Sub-agents: `api-researcher`, `security-researcher`

## Structure
All BRDs follow the format `BRD-<FEATURE_ID>-<SLUG>.md` (e.g., `BRD-001-tradecraft-ai-platform.md`).

## Standard BRD Sections
Each BRD authored by the Researcher Agent adheres to:
1. **Executive Summary & Goals**
2. **Feature Scope & User Stories**
3. **Technical & Architectural Feasibility**
4. **External API & Security Analysis**
5. **Data Flow & Entity Specifications**
6. **Acceptance Criteria & Non-Functional Requirements**

---

## Active & Archived BRD Index

| BRD ID | Title / Feature Scope | Sprint | Status |
| :--- | :--- | :---: | :---: |
| [`BRD-001`](./BRD-001-tradecraft-ai-platform.md) | TradeCraft AI Core Platform, Tax Engine & BYOK AI Architecture | Sprint 1 | `COMPLETED` |
| [`BRD-002`](./BRD-002-options-derivatives-engine.md) | Analytical Black-Scholes Options Engine & Greeks Visualizer | Sprint 2 | `COMPLETED` |
| [`BRD-003`](./BRD-003-tradingview-webhook-algo-gateway.md) | TradingView Webhook Gateway & Automated Algorithmic Bot Engine | Sprint 3 | `COMPLETED` |
| [`BRD-004`](./BRD-004-bar-replay-market-depth-dom.md) | Tick-by-Tick Bar Replay & Level-2 Market Depth (DOM Order Ladder) | Sprint 4 | `COMPLETED` |
| [`BRD-005`](./BRD-005-trader-analytics-monte-carlo-ruin.md) | Trader Performance Analytics, Hourly P&L Heatmaps & Monte Carlo Ruin Simulator | Sprint 5 | `COMPLETED` |
| [`BRD-006`](./BRD-006-market-breadth-fii-dii-sectoral.md) | Real-Time Market Breadth, Institutional Flows & Sectoral Heatmap | Sprint 6 | `COMPLETED` |
| [`BRD-007`](./BRD-007-broker-tradebook-importer-behavioral-audit.md) | Broker Tradebook Importer (Zerodha/Groww) & AI Behavioral Bias Auditor | Sprint 7 | `COMPLETED` |
| [`BRD-008`](./BRD-008-technical-screener-stock-scanner.md) | Real-Time Multi-Factor Technical Screener & Confluence Scanner | Sprint 8 | `COMPLETED` |
| [`BRD-009`](./BRD-009-account-management-creative-landing-page.md) | User Account Management, Multi-Persona Auth & Creative Landing Page | Sprint 9 | `COMPLETED` |
| [`BRD-010`](./BRD-010-social-paper-trading-leagues-leaderboards-proof-of-alpha.md) | Social Paper Trading Leagues, Public Leaderboards & Cryptographically Verifiable Trade Proofs (Proof-of-Alpha) | Sprint 10 | `COMPLETED` |
| [`BRD-011`](./BRD-011-autonomous-ai-quant-desk-multi-agent-virtual-hedge-fund.md) | Autonomous AI Quant Desk & Multi-Agent Virtual Hedge Fund War Room | Sprint 11 | `COMPLETED` |
| [`BRD-012`](./BRD-012-institutional-trade-copier-cross-account-multi-broker-bridge.md) | Institutional Trade Copier & Cross-Account Multi-Broker Execution Bridge | Sprint 12 | `COMPLETED` |
| [`BRD-013`](./BRD-013-real-time-options-greeks-hedger-delta-gamma-autobalancer.md) | Real-Time Options Greeks Hedger & Dynamic Delta-Gamma Neutral Autobalancer | Sprint 13 | `COMPLETED` |
| [`BRD-014`](./BRD-014-options-payoff-optimizer-volatility-surface-calibrator.md) | Multi-Leg Options Strategy Payoff Optimizer & Implied Volatility Surface Calibrator (SABR / SVI Models) | Sprint 14 | `COMPLETED` |
| [`BRD-015`](./BRD-015-level3-order-book-iceberg-detector-dark-pool-tracker.md) | Real-Time Level-3 Order Book Analytics, Iceberg Detector & Institutional Dark Pool Volume Tracker | Sprint 15 | `COMPLETED` |
| [`BRD-016`](./BRD-016-statistical-arbitrage-cointegration-pairs-trading.md) | Multi-Asset Statistical Arbitrage & Cointegration Pairs Trading Engine (Engle-Granger & Kalman Filter) | Sprint 16 | `COMPLETED` |
| [`BRD-017`](./BRD-017-vwap-twap-execution-almgren-chriss-slippage-minimizer.md) | High-Frequency VWAP / TWAP Execution Algorithms & Microstructure Slippage Minimizer (Almgren-Chriss Optimal Liquidation Model) | Sprint 17 | `COMPLETED` |
| [`BRD-018`](./BRD-018-macroeconomic-sentiment-event-risk-engine.md) | Macroeconomic Sentiment Analysis & News Event Risk Engine for NSE/BSE (RBI MPC, Union Budget, US Fed FOMC & Pre-Event Options IV Jump Models) | Sprint 18 | `COMPLETED` |
| [`BRD-019`](./BRD-019-cross-exchange-arbitrage-smart-order-router.md) | Cross-Exchange Arbitrage & Latency-Aware Smart Order Router (SOR) for NSE vs BSE Inter-Market Arbitrage | Sprint 19 | `COMPLETED` |
| [`BRD-020`](./BRD-020-fix-protocol-gateway-order-flow-simulator.md) | Real-Time FIX Protocol Gateway & Institutional Drop-Copy Order Flow Simulator (FIX 4.4 Engine) | Sprint 20 | `COMPLETED` |
| [`BRD-021`](./BRD-021-options-volatility-dispersion-skew-hedging-engine.md) | Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine | Sprint 21 | `COMPLETED` |
| [`BRD-022`](./BRD-022-pre-trade-risk-engine-span-stress-testing.md) | High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk (SPAN Margin, EVT Expected Shortfall & SEBI Volatility Circuit Breakers) | Sprint 22 | `COMPLETED` |
| [`BRD-023`](./BRD-023-institutional-cross-margining-portfolio-var.md) | Institutional Multi-Asset Cross-Margining & Portfolio VaR Optimization Engine (Index Options, Stock Futures, MCX Commodity Offsets & Collateral Haircuts) | Sprint 23 | `COMPLETED` |
| [`BRD-024`](./BRD-024-options-gamma-squeeze-0dte-pinning-risk-engine.md) | Real-Time Options Gamma Squeeze & 0-DTE Expiry Pinning Risk Engine (Dealer Positioning GEX, Gamma Flip Boundaries, Dynamic Max Pain Migration & Fokker-Planck Strike Pinning Probability) | Sprint 24 | `COMPLETED` |
| [`BRD-025`](./BRD-025-vpin-informed-trading-microstructure-toxicity-engine.md) | Real-Time Order Flow Toxicity & Volume-Synchronized Probability of Toxicity (VPIN) & Informed Trading Microstructure Engine (Easley-López de Prado-O'Hara VPIN, Kyle's Lambda, Glosten-Milgrom Spread Decomposition & Flash Crash Early-Warning Radar) | Sprint 25 | `COMPLETED` |
| [`BRD-026`](./BRD-026-avellaneda-stoikov-optimal-market-making-engine.md) | High-Frequency Market Making & Optimal Avellaneda-Stoikov Inventory Control Engine (Dynamic Reservation Price, Bid-Ask Spread Skewing, Inventory Penalties & HFT Execution Simulator) | Sprint 26 | `COMPLETED` |
| [`BRD-027`](./BRD-027-almgren-chriss-optimal-execution-engine.md) | Algorithmic Execution Almgren-Chriss & Optimal Order Slicing Engine (TWAP / VWAP Benchmark Slippage, Permanent vs Temporary Market Impact Decomposition, Dynamic Trajectory Scheduler & Implementation Shortfall Cockpit) | Sprint 27 | `COMPLETED` |
| [`BRD-028`](./BRD-028-market-regime-detection-hmm-allocation-engine.md) | Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Allocation Engine (3-State Gaussian HMM, Online Forward Filtering, Viterbi Decoding, Equal Risk Contribution & Volatility Targeting) | Sprint 28 | `APPROVED FOR ENGINEERING` |




