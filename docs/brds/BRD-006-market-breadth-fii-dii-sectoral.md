# Business Requirements Document (BRD)
## TradeCraft AI — Real-Time Market Breadth, FII / DII Institutional Flow & Sectoral Heatmap

- **Document ID:** `BRD-006-BREADTH-INSTITUTIONAL-FLOWS`
- **Author:** Researcher Agent (Product & Requirements Lead)
- **Status:** Approved for Backlog Decomposition
- **Version:** 1.0.0
- **Target Release:** Sprint 6 (Macro Sentiment & Market Breadth Suite)

---

## 1. Executive Summary & Market Motivation
In the Indian stock market (NSE/BSE), retail traders frequently make the fatal mistake of trading individual stocks in isolation without recognizing the macro market tide. Key institutional drivers include:
1. **FII & DII Net Cash Activity:** Foreign Institutional Investors (FIIs) and Domestic Institutional Investors (DIIs/Mutual Funds) dictate multi-day trends. Buying individual stocks while FIIs are net sellers of ₹4,000+ Crores carries a severe negative expectancy.
2. **Market Breadth (Advance/Decline Ratio):** When indices rise on the backs of only 2 heavyweight stocks while 70% of equities are declining, the market is exhibiting a "divergence trap."
3. **Sectoral Rotation:** Capital constantly rotates between defensive sectors (FMCG, Pharma) and aggressive sectors (IT, Banking, Metals, Auto).

**TradeCraft AI Sprint 6** delivers an institutional **Market Breadth & Institutional Flows Suite**:
- Real-time **Advance / Decline (A/D) Ratio & Market Breadth Meter**.
- Daily & cumulative **FII / DII Net Flow Tracker** (in ₹ Crores).
- Visual **Indian Sectoral Heatmap** (`NIFTY BANK`, `NIFTY IT`, `NIFTY AUTO`, `NIFTY PHARMA`, `NIFTY FMCG`, `NIFTY METAL`, `NIFTY REALTY`).
- **AI Institutional Macro Analyst (BYOK):** Combines breadth and institutional net positioning into actionable pre-market and intraday market briefs.

---

## 2. Mathematical Formulations & Data Models

### 2.1 Advance-Decline Ratio & Breadth Index
$$\text{A/D Ratio} = \frac{\text{Number of Advancing Stocks}}{\text{Number of Declining Stocks}}$$
- $\text{A/D Ratio} > 2.0$: Overwhelmingly Bullish Breadth (Broad Market Rally).
- $0.8 \le \text{A/D Ratio} \le 1.2$: Neutral / Rangebound.
- $\text{A/D Ratio} < 0.5$: Severe Bearish Distribution.

### 2.2 FII / DII Institutional Sentiment Index (ISI)
$$\text{Net Flow} = \text{FII Net (₹ Cr)} + \text{DII Net (₹ Cr)}$$
$$\text{ISI} = \frac{\text{Net Flow}}{\text{Threshold Baseline}} \in [-100, +100]$$
- Provides traders with a quantitative gauge of institutional accumulation vs distribution.

---

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────┐
│               TradeCraft AI Terminal                   │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│ Market Breadth Engine │        │ FII / DII Net Flow    │
│ - Advance / Decline   │        │ - Daily FII Cash (₹Cr)│
│ - Sectoral Heatmap    │        │ - Daily DII Cash (₹Cr)│
│ - 7 Major NSE Sectors │        │ - Multi-Day Trend     │
└───────────┬───────────┘        └───────────┬───────────┘
            │                                │
            └────────────────┬───────────────┘
                             ▼
                 ┌───────────────────────┐
                 │  AI Macro Strategist  │
                 │  - Pre-session brief  │
                 │  - Sector rotation    │
                 └───────────────────────┘
```

---

## 4. Key Feature Deliverables

### Feature 1: Advance / Decline Breadth Gauge
- Visual dial & progress meter:
  - Advancing stocks count (Green).
  - Unchanged stocks count (Gray).
  - Declining stocks count (Red).
  - Calculated A/D Ratio with institutional sentiment label.

### Feature 2: FII / DII Institutional Flow Monitor
- Daily net buying/selling figures in ₹ Crores.
- 5-Day Historical Bar Graph comparing FII vs DII positioning.
- Real-time indicator showing if institutions are supporting or pulling out of the market.

### Feature 3: Indian Sectoral Heatmap Matrix
- Real-time percentage change across 7 key indices:
  - `NIFTY BANK`, `NIFTY IT`, `NIFTY AUTO`, `NIFTY PHARMA`, `NIFTY FMCG`, `NIFTY METAL`, `NIFTY REALTY`.
  - Color-coded tiles with leader/laggard indicators and top constituent mover.

### Feature 4: AI Macro Strategist Brief (BYOK)
- Synthesizes market breadth, institutional flows, and sector leadership into a 3-bullet actionable briefing for the active trading day.

---

## 5. Acceptance Criteria
1. Market breadth engine computes accurate A/D ratio and handles division by zero.
2. FII/DII net flow accurately calculates total net institutional liquidity in ₹ Crores.
3. Sectoral heatmap displays all 7 major NSE sectors with correct color gradation.
4. AI Macro Strategist brief generates clean analysis using BYOK or graceful heuristic fallback.
5. All automated unit tests pass with 100% test coverage.
