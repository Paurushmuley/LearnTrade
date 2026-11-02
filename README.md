# TradeCraft AI 📈
### Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)

TradeCraft AI is a web-based educational paper trading and algorithmic strategy platform built to simulate real-world market execution friction, statutory transaction taxes, and behavioral trading psychology.

---

## 🚀 Key Features

### 1. Authentic Paper Trading Simulation with Indian Statutory Taxes
- **Order Types:** Market, Limit, Stop-Loss (SL), and Stop-Loss Market (SL-M).
- **Product Leverage:**
  - `MIS` (Intraday): 5x leverage with margin protection.
  - `CNC` (Delivery): 1x cash upfront.
- **Realistic Statutory Fee Engine:** Every simulated order factors in:
  - Brokerage (flat ₹20 or 0.03%)
  - STT / CTT (0.1% for Delivery, 0.025% on Intraday Sell)
  - Exchange Turnover Charges (0.00297%)
  - SEBI Turnover Fees (₹10 per crore)
  - Stamp Duty (0.015% Delivery Buy / 0.003% Intraday Buy)
  - GST (18% on Brokerage + Exchange + SEBI fees)
  - Breakeven per share calculation before trade entry!

### 2. Interactive TradingView Lightweight Charts
- Multi-timeframe analysis: `1m`, `5m`, `15m`, `1H`, `1D`.
- Popular Indian Equities & Indices: `NIFTY 50`, `BANKNIFTY`, `RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `TATAMOTORS`, `SBIN`.
- Real-time tick volatility engine & live order fill matching.
- Visual open position overlay showing your average execution price directly on the chart.

### 3. Bring Your Own Key (BYOK) Architecture
- **Zero-Trust Security:** API keys are never stored on a centralized server; they reside encrypted in your browser's local session memory.
- **Supported AI Providers:**
  - **Google Gemini** (`gemini-2.5-flash` / `gemini-1.5-pro`) — generous free tiers.
  - **OpenAI** (`gpt-4o-mini` / `gpt-4o`).
  - **Local Ollama** (`http://localhost:11434` with `llama3`, `mistral`, etc.) — 100% offline and free.
- **Graceful Fallback:** If no key is entered, all paper trading, charting, and rule-based heuristic audits remain 100% functional!

### 4. AI Trading Coach & Behavioral Auditor
- **Automatic Post-Trade Reviews:** Analyzes your closed trades and flags:
  - 🚨 **Revenge Trading:** Re-entering within 2 minutes of a loss with larger sizing.
  - ⚡ **FOMO Entries:** Chasing overextended green candles.
  - ⚠️ **Overleveraging:** Exceeding risk thresholds.
  - ❌ **Poor Risk-Reward:** Taking trades with negative expectancy.
- **Trader Discipline Score (PQ - Psychological Quotient):** Dynamic 0–100 score that rises with disciplined rule adherence and drops with impulsive trades.
- **Interactive AI Coach Drawer:** Chat with your risk mentor about portfolio health and setups.

### 5. Natural Language Strategy Builder & Backtester
- Turn ideas into code: *"Buy when 20 EMA crosses above 50 EMA on 5m chart with 2% target and 1% stop loss"*.
- Run deterministic historical backtests with post-tax Net P&L, Win Rate %, Profit Factor, Max Drawdown %, and Sharpe Ratio.
- **Export Ready Python Code:** Generates algorithmic Python script (Pandas/TA-Lib format) ready for Zerodha Kite Connect or Angel One SmartAPI.

### 6. Historical Market Crisis Simulator
- Interactive scenario replays:
  - **The March 2020 COVID Circuit Drop** (NIFTY 10% plunge)
  - **Union Budget Day 2024 Volatility** (600-point swings)
  - **The Short-Seller Gap Down** (18% opening plunge)

---

## 🛠️ Tech Stack
- **Framework:** Next.js 15 (React 19, TypeScript)
- **Styling:** Tailwind CSS (Dark institutional theme)
- **Charting:** TradingView Lightweight Charts
- **Icons:** Lucide React
- **AI Integration:** Universal BYOK Provider Adapter (Gemini, OpenAI, Ollama)
- **Testing:** Node.js native test runner

---

## 🏁 Quickstart

```bash
# Clone the repository
git clone https://github.com/Paurushmuley/LearnTrade.git
cd LearnTrade

# Install dependencies
npm install

# Start local development server (configured to port 3100)
npm run dev
```

Open [http://localhost:3100](http://localhost:3100) in your browser.

---

## 🧪 Running Tests

```bash
npm test
```
