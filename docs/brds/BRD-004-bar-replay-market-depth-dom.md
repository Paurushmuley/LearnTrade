# Business Requirements Document (BRD)
## TradeCraft AI — Tick-by-Tick Bar Replay & Level-2 Market Depth (DOM Order Book Ladder)

- **Document ID:** `BRD-004-REPLAY-MARKET-DEPTH`
- **Author:** Researcher Agent (Product & Requirements Lead)
- **Status:** Approved for Backlog Decomposition
- **Version:** 1.0.0
- **Target Release:** Sprint 4 (Market Depth & Replay Sandbox)

---

## 1. Executive Summary & Market Motivation
Professional institutional prop traders rarely trade by looking at static historical charts after the fact; they train their execution instincts using:
1. **Bar-by-Bar Replay Simulation:** Rewinding the market to a past time and "replaying" price discovery candle by candle in real-time or fast-forward (1x, 2x, 5x, 10x), eliminating hindsight bias.
2. **Level-2 Market Depth (Depth of Market - DOM):** Viewing the top 5 bid and ask limit order queues to gauge buying/selling pressure, absorption, liquidity walls, and bid-ask volume imbalance.

Most retail paper trading apps lack Bar Replay (which TradingView reserves for expensive paid tiers) and omit Level-2 DOM entirely. **TradeCraft AI Sprint 4** democratizes these institutional tools for Indian equity traders.

---

## 2. Technical Architecture & Mathematical Models

### 2.1 Bar Replay Playhead Architecture
- The replay engine maintains a total candle historical buffer $C = [c_0, c_1, \dots, c_N]$.
- The **Playhead Index** $k \in [0, N]$ slices visible candles $C_{\text{visible}} = [c_0, \dots, c_k]$.
- When in Replay Mode:
  - Ticking interval advances $k \to k + 1$ according to selected speed ($1x = 1000\text{ms}$, $2x = 500\text{ms}$, $5x = 200\text{ms}$, $10x = 100\text{ms}$).
  - Trades placed during replay execute at the *historical candle's close price* $c_k$, preventing lookahead bias.

### 2.2 Level-2 Market Depth (DOM Ladder) Model
Indian exchanges (NSE & BSE) provide Level-2 market feeds comprising the **Best 5 Bids and Best 5 Asks**:
- Bids: $[(P_{b1}, Q_{b1}), (P_{b2}, Q_{b2}), \dots, (P_{b5}, Q_{b5})]$ where $P_{b1} > P_{b2} > \dots > P_{b5}$
- Asks: $[(P_{a1}, Q_{a1}), (P_{a2}, Q_{a2}), \dots, (P_{a5}, Q_{a5})]$ where $P_{a1} < P_{a2} < \dots < P_{a5}$
- **Spread:** $S = P_{a1} - P_{b1}$ (typically ₹0.05 to ₹0.15 for liquid Indian equities like RELIANCE, NIFTY).
- **Bid-Ask Imbalance Metric:**
  $$\text{Imbalance \%} = \frac{\sum_{i=1}^5 Q_{bi} - \sum_{i=1}^5 Q_{ai}}{\sum_{i=1}^5 Q_{bi} + \sum_{i=1}^5 Q_{ai}} \times 100$$
  - $> +20\%$: Strong Institutional Buying Pressure (Green)
  - $< -20\%$: Heavy Institutional Selling Pressure (Red)
  - Neutral otherwise.

---

## 3. High-Level Flow Diagram

```
┌────────────────────────────────────────────────────────┐
│               TradeCraft AI Terminal                   │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│ Bar Replay Controller │        │ Level-2 DOM Ladder    │
│ - Playhead Scrubber   │        │ - Top 5 Bids & Asks   │
│ - Speeds (1x to 10x)  │        │ - Order Book Imbalance│
│ - Step Forward / Back │        │ - 1-Click Ladder Buy  │
│ - Hindsight Shield    │        │ - 1-Click Ladder Sell │
└───────────┬───────────┘        └───────────┬───────────┘
            │                                │
            └────────────────┬───────────────┘
                             ▼
                 ┌───────────────────────┐
                 │  Trading Engine Sync  │
                 │  - Point-in-time fills│
                 │  - Replay P&L ledger  │
                 └───────────────────────┘
```

---

## 4. Key Feature Specifications

### Feature 1: Interactive Replay Control Bar
- Floating/docked toolbar on the chart terminal:
  - **Rewind / Jump to Bar:** Select any starting point on the historical chart.
  - **Play / Pause Button:** Toggle automated candle-by-candle advance.
  - **Step Forward (1 Bar):** Step one candle forward to analyze breakout confirmation.
  - **Speed Selector:** Toggle between 1x (1.0s), 2x (0.5s), 5x (0.2s), and 10x (0.1s).
  - **Exit Replay:** Instantly return to live real-time market stream.

### Feature 2: Level-2 Market Depth (DOM Order Book)
- Compact, institutional DOM panel alongside or beneath the chart:
  - Top 5 Bids (Price, Quantity, Percentage depth bar).
  - Top 5 Asks (Price, Quantity, Percentage depth bar).
  - Real-time Bid-Ask Imbalance Gauge: Displays visual buying vs selling power.
  - Quick Limit / Market execution directly on any price rung of the ladder.

---

## 5. Acceptance Criteria
1. Replay engine correctly slices candle array up to playhead index without leaking future bars.
2. Step forward advances exactly one candle and triggers pending limit order checks for that candle's High/Low.
3. DOM ladder displays 5 valid decreasing bid rungs and 5 valid increasing ask rungs with non-negative spread.
4. Bid-Ask volume imbalance percentage correctly reflects total bid vs ask quantity.
5. 1-click buy/sell on DOM ladder routes orders to the paper trading engine with standard statutory taxes.
