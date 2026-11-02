# Business Requirements Document (BRD)
## TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)

- **Document ID:** `BRD-001-TRADECRAFT-CORE`
- **Author:** Researcher Agent (Product & Requirements Lead)
- **Status:** Approved for Backlog Decomposition
- **Version:** 1.0.0
- **Target Launch:** Q1 2027

---

## 1. Executive Summary & Core Mission
**TradeCraft AI** is an interactive, web-based educational paper trading and algorithmic strategy platform built to bridge the gap between financial theory and real market execution. 

Unlike conventional paper trading apps that offer frictionless, unrealistic profit projections, TradeCraft AI simulates authentic market friction:
1. Realistic execution slippage and order matching (Market, Limit, Stop-Loss, Stop-Loss Market).
2. Comprehensive Indian statutory and exchange charges (Brokerage, STT, Exchange Turnover Fees, GST, SEBI Turnover Fees, Stamp Duty).
3. Position management, live margin utilization, and margin-call triggers.
4. An intelligent **Bring Your Own Key (BYOK)** AI architecture that gives every trader a private, cost-free (to the platform) personal Trading Coach, Behavioral Auditor, and Natural Language Strategy Architect powered by Google Gemini, OpenAI, or local Ollama instances.

---

## 2. Research Findings & Market Gap Analysis

### 2.1 The Retail Trader Dilemma in Indian Equities
According to SEBI's official study on retail participation in F&O and intraday equity trading, over **89% of individual retail traders incur net losses**, with transaction costs (taxes and brokerage) accounting for up to 15-30% of total losses. Most paper trading simulators fail because:
- They ignore statutory taxes, creating a false illusion of profitability.
- They lack behavioral feedback, allowing bad habits (averaging down, revenge trading, removing stop-losses) to compound unchecked.
- They are static, lacking historical scenario crisis replay (e.g., trading during flash crashes or earnings days).

### 2.2 Statutory Taxation Engine Formula (Indian Equity Markets)
For authentic simulation, the platform must calculate taxes per order and per trade lifecycle:
- **Brokerage:** Flat ₹20 per executed order or 0.03% (whichever is lower) for Intraday; ₹0 to ₹20 for Delivery.
- **STT (Securities Transaction Tax):**
  - Equity Delivery: 0.1% on both Buy and Sell value.
  - Equity Intraday: 0.025% on Sell value only.
  - Futures: 0.02% on Sell value.
  - Options: 0.1% on Option Premium (Sell value).
- **Exchange Turnover Charges (NSE):** 0.00297% of trade value.
- **SEBI Turnover Charges:** ₹10 per crore (0.0001% of trade value).
- **Stamp Duty:**
  - Equity Delivery: 0.015% on Buy value.
  - Equity Intraday: 0.003% on Buy value.
- **GST (Goods & Services Tax):** 18% applied strictly on `(Brokerage + Exchange Turnover Charges + SEBI Charges)`.

### 2.3 BYOK (Bring Your Own Key) Security Architecture
- Server-side AI inference on millions of market tokens is financially unsustainable for free platforms.
- By utilizing a **BYOK Model**, users supply their own Google Gemini, OpenAI, or local Ollama API keys.
- **Zero-Knowledge Client Storage:** Keys are saved encrypted in browser storage (Web Crypto API AES-GCM) or session memory, passed to proxy endpoints via transient headers (`x-gemini-key`, `x-openai-key`), and never persisted in database plain text.
- **Graceful Fallback:** If no key is provided, the entire paper trading platform, charts, statutory calculators, and mock execution engine remain 100% free and functional. Non-blocking callouts encourage users to connect an API key to unlock the AI coach.

---

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TradeCraft AI Frontend                          │
│   Next.js 15 / React 19 + Tailwind CSS + Lightweight Charts + Zustand  │
└───────┬────────────────────────────┬────────────────────────────┬──────┘
        │                            │                            │
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐        ┌──────────────────┐
│  Trading Engine  │       │ Market Data Feed │        │  BYOK AI Gateway │
│  - Virtual Cash  │       │ - NSE Top 50     │        │ - Key Vault      │
│  - Order Ledger  │       │ - Real-time Ticks│        │ - Gemini Adapter │
│  - Tax & STT     │       │ - Bar Replay     │        │ - OpenAI Adapter │
│  - Margin Engine │       │ - OHLCV Generator│        │ - Ollama Local   │
└────────┬─────────┘       └─────────┬────────┘        └─────────┬────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     ▼
                      ┌─────────────────────────────┐
                      │    AI Features Ecosystem    │
                      │  - Trade Journal & Auditor  │
                      │  - Natural Lang Strategy    │
                      │  - Crisis Scenario Replay   │
                      │  - Discipline Score (PQ)    │
                      └─────────────────────────────┘
```

---

## 4. Feature Specifications & Requirements

### Module 1: Core Paper Trading Engine & Order Execution
- **Account Defaults:** Starting virtual balance configurable (Default ₹10,00,000 INR).
- **Order Types:**
  - **MARKET:** Fills instantly at current Ask (Buy) or Bid (Sell).
  - **LIMIT:** Queued until market price crosses or touches limit price.
  - **STOP-LOSS (SL):** Triggers a limit order when trigger price is hit.
  - **STOP-LOSS MARKET (SL-M):** Converts to immediate market order once trigger price is breached.
- **Position Modes:**
  - **INTRADAY (MIS):** Requires lower margin (e.g., 5x leverage), must auto-square off at market close (15:20 IST).
  - **DELIVERY (CNC):** 1x cash upfront, held indefinitely in virtual portfolio.
- **Ledger & Audit Trail:**
  - Real-time realized P&L, unrealized P&L, net margin available, used margin.
  - Every order generates an immutable trade record with execution price, timestamp, and itemized statutory fee breakdown.

### Module 2: Indian Statutory Fee Engine
- Integrated into the order preview and post-trade execution modal.
- Shows dynamic pre-trade cost estimation:
  *"Buying 100 shares of RELIANCE at ₹2,500 requires ₹2,50,000 capital. Estimated charges: ₹250 (STT) + ₹7.42 (Exchange) + ₹37.50 (Stamp Duty) + ₹4.93 (Brokerage + GST) = ₹299.85."*
- Net P&L = `Gross P&L - Total Statutory Charges`.

### Module 3: Market Data & Charting Experience
- Interactive Candlestick & Volume charts powered by **TradingView Lightweight Charts**.
- Pre-loaded with prominent Indian equities and indices:
  - `NIFTY 50`, `BANKNIFTY`, `RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `ICICIBANK`, `TATAMOTORS`, `SBIN`, `ITC`.
- Multi-timeframe switching: `1m`, `5m`, `15m`, `1H`, `1D`.
- Dynamic tick simulation with stochastic volatility or historical data playback.

### Module 4: BYOK Security Vault & Multi-Provider LLM Abstraction
- Secure key storage with local encryption.
- Direct validation button testing key status against provider ping endpoints.
- Provider Adapter Interface:
  - **Google Gemini:** `gemini-2.5-flash` / `gemini-1.5-pro` (Generous free tier for retail users).
  - **OpenAI:** `gpt-4o`, `gpt-4o-mini`.
  - **Local Ollama:** `http://localhost:11434` (llama3, mistral, deepseek-r1) for 100% offline, privacy-first AI analysis.

### Module 5: Interactive AI Trading Coach & Behavioral Auditor
- **Automatic Post-Trade Analysis:** Evaluates closed trades against disciplined trading rules.
- **Psychological Bias Flags:**
  - *Revenge Trading Detector:* Identifies trades placed within 2 minutes of a loss with increased position sizing.
  - *Risk-Reward Violator:* Flags trades with R:R worse than 1:1.5.
  - *Stop-Loss Tampering:* Detects orders where the user moved stop-losses away from entry as losses accumulated.
- **Trader Discipline Score (PQ - Psychological Quotient):** 0-100 rating based on rule compliance, risk capping, and consistency.

### Module 6: Natural Language Strategy Builder & Backtester
- Input plain text trading ideas:
  *"Buy when 20 EMA crosses above 50 EMA on 15m chart and RSI is between 40 and 60, exit when 20 EMA crosses below 50 EMA or 2% stop-loss."*
- Compiles into structured JSON rule sets.
- Executes historical backtest across selected date ranges:
  - Generates metrics: Total Trades, Win Rate %, Profit Factor, Max Drawdown %, Sharpe Ratio, Net P&L (after taxes).
  - Exports clean Python code (Pandas/TA-Lib format) for users wishing to run algorithmic bots in external environments.

### Module 7: Historical Market Crisis Simulator (Scenarios)
- Interactive replay challenges:
  1. **The March 2020 COVID Crash:** Trade through circuit-breaker drops and extreme volatility.
  2. **Budget Day 2024 Volatility:** Manage wild intraday swings without blowing up margin.
  3. **Adani-Hindenburg Gap Down:** Practice hedging and strict stop-loss execution during sudden overnight gaps.

---

## 5. Non-Functional Requirements & Security
- **Performance:** Sub-50ms execution simulation latency for local order matching.
- **Responsive Design:** Dark-mode optimized desktop and tablet trading terminal.
- **Zero-Trust BYOK:** User API keys must never be logged in server logs, never written to a public database, and masked in UI.

---

## 6. Acceptance Criteria (Definition of Done)
1. Complete paper trading lifecycle: Place Market, Limit, and SL orders with simulated fill engine.
2. Accurate Indian statutory tax deduction reflecting real-world SEBI/STT rates.
3. Interactive TradingView charts rendering multi-timeframe candles with active positions overlaid.
4. BYOK settings modal supporting Gemini, OpenAI, and Ollama with live connection test.
5. Functional AI Trade Coach evaluating trades and scoring Discipline (PQ).
6. Natural language strategy backtest runner displaying equity curves and trade log.
7. Clean, modern, responsive UI with zero external runtime server subscription dependencies.
