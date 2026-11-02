# Business Requirements Document (BRD)
## TradeCraft AI — Multi-Leg Options Chain, Greeks & Payoff Visualizer Engine (F&O Sandbox)

- **Document ID:** `BRD-002-OPTIONS-DERIVATIVES`
- **Author:** Researcher Agent (Product & Requirements Lead)
- **Status:** Approved for Backlog Decomposition
- **Version:** 1.0.0
- **Target Release:** Sprint 2 (F&O Sandbox)

---

## 1. Executive Summary & Market Justification
In Indian equity markets, **Derivatives (Futures & Options)** represent over 95% of total exchange turnover (NSE). However, according to SEBI's official research reports, **93% of individual retail options traders incur net losses**, with an average loss of over ₹1.2 Lakh per trader, exacerbated by:
1. Complete misunderstanding of **Theta Decay (time decay)** eating option buyers alive.
2. Naked option selling leading to catastrophic margin-call wipeouts during flash gap-openings.
3. Inability to visualize multi-leg hedged spreads (Bull Call Spread, Bear Put Spread, Iron Condor, Straddle).
4. Failure to factor in Options Statutory Charges (STT on option sell turnover, exchange charges, GST).

**TradeCraft AI Sprint 2** introduces an authentic, risk-free **Options Chain & Derivatives Simulation Sandbox** with Black-Scholes Greeks ($\Delta$, $\Gamma$, $\Theta$, $\text{Vega}$), interactive multi-leg Strategy Payoff Diagrams, and an **AI Options Risk Architect** powered by BYOK.

---

## 2. Mathematical Foundation & Regulatory Specifics

### 2.1 Black-Scholes-Merton Pricing Model
Option prices are computed via closed-form Black-Scholes:
$$d_1 = \frac{\ln(S/K) + (r + \sigma^2/2)T}{\sigma \sqrt{T}}$$
$$d_2 = d_1 - \sigma \sqrt{T}$$
- **Call Price ($C$):** $S \cdot N(d_1) - K e^{-rT} N(d_2)$
- **Put Price ($P$):** $K e^{-rT} N(-d_2) - S \cdot N(-d_1)$

### 2.2 First and Second Order Greeks
- **Delta ($\Delta$):** Rate of change of option price with respect to underlying price.
  - Call Delta: $N(d_1) \in [0, 1]$
  - Put Delta: $N(d_1) - 1 \in [-1, 0]$
- **Gamma ($\Gamma$):** Rate of change of Delta. $\frac{N'(d_1)}{S \sigma \sqrt{T}}$.
- **Theta ($\Theta$):** Daily decay in option premium as expiration approaches ($T \to 0$).
- **Vega ($\mathcal{V}$):** Sensitivity to a 1% shift in Implied Volatility ($\sigma$).

### 2.3 Options Statutory Fee Calculation (Indian Exchanges)
- **Brokerage:** Flat ₹20 per executed order.
- **STT (Securities Transaction Tax):** 0.1% on the **Option Premium value** on the SELL side (0% on Buy).
- **Exchange Turnover Charges (NSE):** 0.05% of premium turnover.
- **GST (18%):** Applied to `(Brokerage + Exchange Charges + SEBI fees)`.
- **Stamp Duty:** 0.003% on Buy side premium.

---

## 3. High-Level Architecture & Modules

```
┌────────────────────────────────────────────────────────┐
│            TradeCraft AI Options Terminal              │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│ Live Option Chain UI  │        │ Strategy Payoff Chart │
│ - NIFTY / BANKNIFTY   │        │ - P&L at Expiry       │
│ - Strikes (ATM/ITM)   │        │ - Max Profit / Loss   │
│ - Call & Put Premiums │        │ - Breakeven Points    │
│ - Open Interest (OI)  │        │ - Net Greeks Summary  │
└───────────┬───────────┘        └───────────┬───────────┘
            │                                │
            └────────────────┬───────────────┘
                             ▼
                 ┌───────────────────────┐
                 │  Black-Scholes & Tax  │
                 │  - Analytical Greeks  │
                 │  - Multi-Leg Margins  │
                 │  - Options STT Engine │
                 └───────────────────────┘
```

---

## 4. Key Deliverables & Feature Specifications

### Feature 1: Dynamic Option Chain Table
- Underlying spot price tracking for `NIFTY 50` and `BANKNIFTY`.
- Matrix layout:
  - Left: Calls (OI, Volume, IV, Delta, Bid/Ask, LTP).
  - Center: Strike Price (highlighting ATM strike).
  - Right: Puts (LTP, Delta, IV, Volume, OI).
- One-click "Add to Strategy" or "Quick Buy / Sell".

### Feature 2: Multi-Leg Strategy Builder & Templates
- Pre-built institutional strategy templates:
  - **Long Straddle:** High volatility breakout.
  - **Short Strangle / Iron Condor:** Rangebound theta collection.
  - **Bull Call Spread / Bear Put Spread:** Defined risk directional plays.
- Multi-leg execution: Place all legs simultaneously with aggregated margin validation.

### Feature 3: Interactive Payoff Diagram (P&L at Expiry)
- Interactive visual chart plotting Total Net P&L across a range of underlying spot prices.
- Computes and displays:
  - **Max Profit:** Fixed ₹ or Unlimited.
  - **Max Loss:** Fixed ₹ (defined risk) or Warning on Unlimited risk.
  - **Breakeven Points:** Lower and Upper breakeven prices.
  - **Net Delta, Net Theta (Daily decay ₹):** Tells the trader whether time is working for them or against them.

### Feature 4: AI Options Risk Architect (BYOK Integration)
- Evaluates the constructed multi-leg trade before execution:
  - Warns if trader is naked short without defined stop or hedge.
  - Explains the expected impact of upcoming events (earnings, RBI policy) on Vega and Implied Volatility.

---

## 5. Acceptance Criteria
1. Black-Scholes formula matches standard benchmark values within 0.01 tolerance.
2. Option chain renders 15 strikes around ATM with accurate Call and Put premiums.
3. Multi-leg payoff diagram calculates correct Max Profit, Max Loss, and Breakevens.
4. Options STT correctly applied strictly on sell premium turnover.
5. Multi-leg positions trackable in open positions with real-time mark-to-market.
