# Business Requirements Document (BRD)
## TradeCraft AI — Trader Performance Analytics, Hourly P&L Heatmap & Monte Carlo Ruin Simulator

- **Document ID:** `BRD-005-ANALYTICS-MONTE-CARLO`
- **Author:** Researcher Agent (Product & Requirements Lead)
- **Status:** Approved for Backlog Decomposition
- **Version:** 1.0.0
- **Target Release:** Sprint 5 (Quantitative Risk & Performance Suite)

---

## 1. Executive Summary & Problem Statement
Trading success is not merely about finding entry setups; it is fundamentally about statistical survival and sizing. Most retail traders fail because:
1. **The "Midday Trap" Bias:** Traders overtrade during 11:30 AM to 1:30 PM IST (the European open / lunch lull) when volume dries up and false breakouts dominate, giving back all morning gains.
2. **Ignorance of Statistical Probability of Ruin:** Even a 60% win-rate strategy will inevitably experience 6 to 8 consecutive losing trades over a sample of 100 trades. Without proper sizing, a 6-trade losing streak wipes out the trader's account.
3. **Sub-optimal Position Sizing:** Traders either risk too little (stagnant growth) or too much (mathematical certainty of ruin).

**TradeCraft AI Sprint 5** introduces an institutional **Quantitative Analytics & Monte Carlo Risk Suite**:
- **Time-of-Day P&L Heatmap:** Visualizes exact hourly and daily performance to diagnose execution leaks.
- **Monte Carlo Simulator (1,000 Trials):** Simulates 1,000 prospective 100-trade sequences based on historical win-rate and profit factor to calculate **Probability of Account Ruin** and 95th-percentile Max Drawdown.
- **Kelly Criterion Calculator:** Computes mathematically optimal fraction of capital to risk per trade.
- **AI Behavioral Performance Audit (BYOK):** Synthesizes hourly patterns and provides structured recommendations.

---

## 2. Mathematical Formulations

### 2.1 The Kelly Criterion Formula
Optimal risk fraction $f^*$ to maximize the geometric growth rate of capital:
$$f^* = \frac{p \cdot b - q}{b} = p - \frac{q}{b}$$
Where:
- $p$: Historical Win Rate ($0 \le p \le 1$)
- $q = 1 - p$: Historical Loss Rate
- $b$: Payoff Ratio ($\frac{\text{Average Win Amount}}{\text{Average Loss Amount}}$)
- **Fractional Kelly (Half-Kelly $f^*/2$):** Recommended in institutional trading to reduce drawdown volatility by 50% with only a minor reduction in long-term growth.

### 2.2 Monte Carlo Ruin Simulation
- Runs $M = 1000$ independent simulations of $N = 100$ trades.
- In each trial $m$, a synthetic equity curve is formed by drawing trades from a Bernoulli distribution with parameter $p$ and win/loss magnitude.
- **Probability of Ruin ($P_{\text{ruin}}$):** Percentage of the 1,000 paths where drawdown breaches 50% of starting capital:
  $$P_{\text{ruin}} = \frac{1}{M} \sum_{m=1}^M \mathbb{I}(\text{Peak-to-Trough Drawdown}_m \ge 50\%)$$

### 2.3 Mathematical Expectancy
Expected return per rupee risked:
$$\text{Expectancy} = (p \times \text{Avg Win}) - (q \times \text{Avg Loss})$$

---

## 3. High-Level Flow & Deliverables

```
┌─────────────────────────────────┐
│       Closed Trade History      │
│     (Positions & Audit Logs)    │
└────────────────┬────────────────┘
                 │
                 ├─► 1. Hourly & Day-of-Week Aggregation
                 ├─► 2. Kelly Criterion & Expectancy Calculation
                 ├─► 3. 1,000-Path Monte Carlo Simulation
                 │
                 ▼
┌─────────────────────────────────┐
│   Quantitative Analytics Modal  │
│  - Hourly Heatmap (9 AM - 3 PM) │
│  - 1,000-Path Equity Envelope   │
│  - Risk of Ruin & Kelly Meter   │
│  - AI Behavioral Diagnostic     │
└─────────────────────────────────┘
```

---

## 4. Key Feature Specifications

### Feature 1: Time-of-Day P&L Heatmap
- Visual grid from 9:00 AM to 3:30 PM IST (divided into 1-hour slots).
- Color-coded cells: Deep Emerald Green (Highly Profitable), Soft Green, Amber, Soft Rose, Crimson Red (Severe Loss Trap).
- Highlights the trader's "Golden Window" (e.g. 9:15–10:30 AM) vs "Dead Zone" (e.g. 12:00–1:00 PM).

### Feature 2: Day-of-Week Expiry Analysis
- Compares performance across Monday, Tuesday (FINNIFTY), Wednesday (BANKNIFTY), Thursday (NIFTY), and Friday.
- Reveals if the trader performs better on index expiry days vs non-expiry days.

### Feature 3: Monte Carlo 1,000-Path Ruin Simulator
- Visual multi-line envelope displaying:
  - 95th Percentile Optimistic Path (Best Case).
  - 50th Percentile Median Path (Expected Equity Curve).
  - 5th Percentile Worst-Case Drawdown Envelope.
- Computes and displays:
  - **Probability of Ruin (50% Drawdown risk):** e.g., 2.4%.
  - **Consecutive Loss Risk:** Maximum expected consecutive losses over next 100 trades.
  - **Full Kelly vs Half Kelly Recommendation:** e.g., "Risk 1.8% per trade".

### Feature 4: AI Behavioral Diagnostic (BYOK)
- Analyzes heatmaps and provides an institutional coaching brief advising when to trade and when to sit on hands.

---

## 5. Acceptance Criteria
1. Kelly Criterion formula accurately calculates $f^*$ for any valid win rate and payoff ratio.
2. Monte Carlo simulator generates 1,000 randomized paths and correctly computes Probability of Ruin %.
3. Hourly heatmap correctly aggregates gross P&L, taxes, and trade counts per time bucket.
4. UI renders cleanly with interactive visualizations and clear risk warnings.
5. All automated unit tests pass with 100% accuracy.
