# BRD-008: Real-Time Multi-Factor Technical Screener & Stock Scanner

## 1. Executive Summary & Problem Statement
In fast-moving financial markets like the National Stock Exchange of India (NSE), manual chart inspection across dozens of equities leads to cognitive overload, analysis paralysis, and late entries. Retail traders frequently suffer from FOMO (Fear Of Missing Out) because they identify high-momentum setups only after the bulk of the move has concluded.

Professional trading desks solve this problem by deploying automated multi-factor scanners that continuously monitor price action, volume anomalies, and quantitative indicators to surface actionable trading setups in real time.

**BRD-008** establishes an institutional-grade, multi-factor technical screener and scanner directly inside TradeCraft AI. The engine evaluates the NSE universe against 6 proven quantitative setups, calculates a composite **Setup Confluence Score (0–100)**, and enables seamless 1-click terminal switching (instantly syncing the chart, DOM ladder, and order ticket to the screened stock).

---

## 2. Quantitative Screening Filters & Mathematical Formulations

### 2.1 Volume Shocker (Institutional Liquidity Surge)
Measures the ratio of current bar volume $V_t$ relative to the 20-period Simple Moving Average of volume:
$$\text{Volume Surge Ratio} = \frac{V_t}{\text{SMA}_{20}(V)}$$
- **Trigger Condition:** $\text{Volume Surge Ratio} \ge 2.0\times$ (indicates institutional footprint).

### 2.2 EMA Cross (20 EMA vs 50 EMA Trend Confirmation)
- **Bullish Golden Cross:** $\text{EMA}_{20} > \text{EMA}_{50}$ with positive divergence slope.
- **Bearish Death Cross:** $\text{EMA}_{20} < \text{EMA}_{50}$ with downward slope.

### 2.3 RSI Momentum & Mean-Reversion Scanner
Relative Strength Index computed over a standard 14-period lookback:
- **Oversold Bounce Candidate:** $\text{RSI}_{14} \le 30$ with turning hook.
- **Overbought Momentum / Exhaustion:** $\text{RSI}_{14} \ge 70$.

### 2.4 VWAP Breakout / Breakdown
Measures intraday price relative to Volume-Weighted Average Price:
$$\text{VWAP} = \frac{\sum (P_{\text{typical}} \times V)}{\sum V}$$
- **Bullish VWAP Expansion:** Price crosses and holds above VWAP with positive volume.
- **Bearish VWAP Rejection:** Price fails below VWAP.

### 2.5 Opening Range Breakout (ORB 15-Minute)
Captures directional thrust outside the initial 15-minute price envelope $[L_{15}, H_{15}]$:
- **Bullish ORB:** $P_t > H_{15}$
- **Bearish ORB:** $P_t < L_{15}$

### 2.6 Setup Confluence Score ($S_{\text{confluence}}$)
A weighted composite score from $0$ to $100$ aggregating indicator agreement:
$$S_{\text{confluence}} = 25 \times \mathbb{I}_{\text{Volume}} + 25 \times \mathbb{I}_{\text{EMA}} + 20 \times \mathbb{I}_{\text{VWAP}} + 15 \times \mathbb{I}_{\text{ORB}} + 15 \times \mathbb{I}_{\text{RSI}}$$

---

## 3. UI/UX Workflow & Terminal Integration
1. **Screener Drawer / Modal:** Accessible from the main terminal header ("Stock Screener").
2. **Instant Presets:**
   - ⚡ *High-Volume Momentum* (Volume Surge $\ge 2\times$ + VWAP Bullish)
   - 🟢 *Bullish Trend Alignments* (Golden Cross + Above VWAP)
   - 🔴 *Bearish Rejections* (Death Cross + Below VWAP)
   - 🎯 *RSI Mean Reversion* (RSI $\le 35$ or $\ge 65$)
3. **1-Click Chart & Trade Sync:** Clicking "Chart Stock" automatically updates `selectedTicker`, loads the appropriate historical candles, recalculates the Level-2 DOM ladder, and pre-populates the order ticket.
4. **BYOK AI Screener Brief:** Prompts user's Gemini / OpenAI model to generate a morning tactical trade thesis based on screener signals.
