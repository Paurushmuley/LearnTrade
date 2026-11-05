# Business Requirements Document (BRD) - Sprint 21

## Feature ID: `BRD-021`
## Feature Title: Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine
**Author:** Researcher Lead (Autonomous Multi-Agent Cycle)  
**Date:** 2026-11-05  
**Status:** `APPROVED FOR IMPLEMENTATION`  
**Target Milestone:** Sprint 21  
**Dependencies:**
- Sprint 1 (`taxEngine.ts` — Indian Statutory Taxes, SEBI STT, GST)
- Sprint 2 (`optionsEngine.ts` — Black-Scholes Formula, Implied Volatility & Greeks)
- Sprint 13 (`greeksHedgerEngine.ts` — Greeks Risk Management & Dynamic Hedging)
- Sprint 14 (`volatilitySurfaceEngine.ts`, `optionsOptimizerEngine.ts` — SABR/SVI Surface Calibration)
- Sprint 20 (`fixEngine.ts` — Institutional Drop-Copy & FIX Execution Gateway)

---

### 1. Executive Summary & Problem Statement

#### 1.1 Context
In institutional quantitative volatility arbitrage, proprietary trading desks and Tier-1 market makers (such as Citadel Securities, Jane Street, Optiver, and IMC) generate consistent non-directional alpha by trading the structural mispricing between an equity index and its underlying single-stock constituent options. 

On the National Stock Exchange of India (NSE)—home to the world's most actively traded derivative contracts (NIFTY 50 and BANKNIFTY)—the index represents a market-cap weighted linear combination of individual assets. However, because index options are heavily purchased by institutional funds and retail participants as portfolio insurance (crash protection), the market implied volatility of the index systematically trades at an elevated level relative to the weighted sum of individual constituent volatilities. This phenomenon gives rise to the **Correlation Risk Premium (CRP)**.

#### 1.2 Problem Statement
While institutional quantitative desks actively harvest the Correlation Risk Premium through automated **Volatility Dispersion Trading** and manage term structure misalignments via **Multi-Expiry Skew Hedging**, retail options traders and transitioning quants face systemic barriers:

1. **Correlation Blindness & Volatility Pricing Inefficiency:** Standard Indian retail platforms (Zerodha Sensibull, Opstra, Dhan) only display standalone implied volatilities. Traders have no programmatic means to compute the instantaneous **Implied Correlation ($\rho_{\text{implied}}$)** vs. **Realized Historical Correlation ($\rho_{\text{realized}}$)** between NIFTY 50 and its heavyweights (RELIANCE, HDFCBANK, ICICIBANK, INFY, TCS, ITC, LT).
2. **Term Structure Skew Mispricing:** Options smile curves twist and invert across different expiration cycles (weekly, bi-weekly, monthly, quarterly). Retail traders enter calendar or diagonal spreads without measuring forward implied volatilities ($\sigma_{\text{fwd}}$) or quantifying term structure contango/backwardation and 25-Delta put-call skew differentials.
3. **Execution & Vega-Balancing Complexity:** Entering a dispersion trade requires simultaneously selling index straddles/strangles and purchasing a basket of constituent options whose weights must be strictly balanced on a **Vega-neutral** and **Delta-neutral** basis. Doing this manually across 8 to 15 legs is impossible without algorithmic basket execution.
4. **Severe Delta Drift & Lack of Automated Gamma Scalping:** Long constituent options possess high positive gamma ($\Gamma > 0$). As underlying stock prices fluctuate, net portfolio delta drifts violently away from neutrality. Without automated, transaction-cost-aware gamma scalping (e.g. Whalley-Wilmott optimal bands), the trader suffers unhedged directional exposure and heavy theta decay, erasing their volatility edge.
5. **Indian Statutory Tax & Slippage Drag:** Indian derivative transactions incur Securities Transaction Tax (STT on option sell side: 0.1% on premium, or 0.125% on exercised intrinsic), Exchange Turnover Charges, SEBI turnover fees, Stamp Duty, and 18% GST. Without factoring these friction costs directly into the dispersion alpha threshold, theoretical arbitrage trades become net losing propositions.

#### 1.3 Solution & Business Objectives
TradeCraft AI Sprint 21 introduces the industry's first browser-native, institutional-grade **Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine**:
* **Real-Time Index vs. Basket Volatility Dispersion Engine:** Continuously ingests live tick data for NIFTY 50 index options and the top 10 heavyweights, computing theoretical index variance bounds, implied correlation $\rho_{\text{implied}}$, historical realized correlation $\rho_{\text{realized}}$, and net Correlation Risk Premium (CRP).
* **Multi-Expiry Term Structure & Dynamic Smile Skew Calibrator:** Maps forward implied volatilities across expiries ($T_1, T_2, \dots, T_k$), measures 25-Delta skew slopes, detects contango/backwardation regimes, and highlights rich/cheap calendar spread opportunities.
* **Automated Vega-Neutral Basket Sizer:** Algorithmatically calculates exact lot sizing for Index Short Straddles vs. Basket Long Straddles to maintain strict $\sum \text{Vega}_{\text{basket}} = \text{Vega}_{\text{index}}$ and $\Delta_{\text{net}} \approx 0$.
* **Smart Delta-Neutral Gamma Scalping Autobalancer:** Implements threshold-based and Whalley-Wilmott optimal bandwidth gamma scalping triggers that automatically generate underlying rebalancing orders (in cash equities or index futures) whenever delta drift breaches the optimal boundary.
* **SEBI Statutory Cost & Slippage Friction Filter:** Deducts real-time Indian STT, GST, and exchange fees from projected dispersion profits to ensure only statistically profitable arbitrage opportunities are presented.
* **Interactive Institutional Dispersion Terminal UI:** High-performance dark-mode cockpit featuring real-time correlation gauges, term-structure 3D/2D curves, constituent weight radars, gamma drift scalping monitors, and 1-click execution to paper portfolio and Proof-of-Alpha ledger.

---

### 2. Quantitative & Mathematical Formulations

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                       DISPERSION & SKEW HEDGING ARCHITECTURE                      │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  LIVE MARKET DATA FEED (NSE)                                                      │
│  Index Options (NIFTY 50) + Top Constituent Options (RELIANCE, HDFC, ICICI, etc.) │
│                                      │                                            │
│                                      ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. REAL-TIME VOLATILITY DISPERSION ENGINE                                   │  │
│  │    • Component Weights: w_i = MCap_i / Sum(MCap)                            │  │
│  │    • Implied Volatilities: sigma_index, sigma_i (Black-Scholes IV)          │  │
│  │    • Variance Identity: sigma_I^2 = Sum(w_i^2 sigma_i^2) + 2 Sum(w_i w_j...)│  │
│  │    • Implied Correlation: rho_implied = (sigma_I^2 - Sum w_i^2 sigma_i^2)   │  │
│  │                                         / ( (Sum w_i sigma_i)^2 - ... )     │  │
│  │    • Realized Correlation: rho_realized (Rolling 30-Day Pearson)            │  │
│  │    • Correlation Risk Premium (CRP): CRP = rho_implied - rho_realized       │  │
│  └───────────────────────────────────┬─────────────────────────────────────────┘  │
│                                      │                                            │
│                                      ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. MULTI-EXPIRY SKEW & TERM STRUCTURE ANALYZER                               │  │
│  │    • Forward Implied Volatility: sigma_fwd^2(T1, T2)                        │  │
│  │    • 25-Delta Skew: Skew_25d = sigma_put(25d) - sigma_call(25d)             │  │
│  │    • Term Structure Regime: Contango vs. Backwardation Detection            │  │
│  └───────────────────────────────────┬─────────────────────────────────────────┘  │
│                                      │                                            │
│                                      ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. VEGA-WEIGHTED BASKET & DELTA-NEUTRAL SIZER                               │  │
│  │    • Index Position: Short Straddle (Vega_index)                            │  │
│  │    • Constituent Position: Long Straddles (Vega_i = w_i * Vega_index)       │  │
│  │    • Friction Adjustment: SEBI STT + GST + Slippage Net Alpha Filter        │  │
│  └───────────────────────────────────┬─────────────────────────────────────────┘  │
│                                      │                                            │
│                                      ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │ 4. AUTOMATED GAMMA SCALPING & DRIFT CONTROLLER                              │  │
│  │    • Instantaneous Net Delta: Delta_net = Delta_index + Sum(Delta_i)        │  │
│  │    • Whalley-Wilmott Band: delta_S = ( (3/2) * (c * S) / (gamma * Gamma) )^1/3 │
│  │    • Scalp Action: Rebalance underlying / futures when |Delta_net| > Band   │  │
│  │    • PnL Attribution: Gamma Scalp Alpha vs. Theta Decay vs. Vega Move       │  │
│  └───────────────────────────────────┬─────────────────────────────────────────┘  │
│                                      │                                            │
│                                      ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │ 5. INTERACTIVE COCKPIT UI & DISPATCH GATEWAY                                │  │
│  │    • Dispersion Radar, Term Structure Charts, Gamma Scalp Monitor           │  │
│  │    • Direct Paper Portfolio Dispatch & FIX 4.4 Drop-Copy Mirroring          │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1 The Index-Constituent Variance Identity
Let $I$ be a market-cap weighted index composed of $n$ constituent assets $S_1, S_2, \dots, S_n$ with normalized weights $w_i \ge 0$ such that $\sum_{i=1}^n w_i = 1$. The instantaneous index return $R_I = \frac{dI}{I} = \sum_{i=1}^n w_i \frac{dS_i}{S_i} = \sum_{i=1}^n w_i R_i$.

The mathematical variance of the index return is strictly governed by the variance-covariance matrix of its constituent returns:
$$\sigma_{\text{index}}^2 = \sum_{i=1}^n w_i^2 \sigma_i^2 + 2 \sum_{i < j} w_i w_j \rho_{ij} \sigma_i \sigma_j = \sum_{i=1}^n w_i^2 \sigma_i^2 + \sum_{i=1}^n \sum_{j \neq i} w_i w_j \rho_{ij} \sigma_i \sigma_j$$

Where:
- $\sigma_{\text{index}}$: Implied or realized volatility of the index.
- $\sigma_i$: Implied or realized volatility of constituent $i$.
- $\rho_{ij}$: Pairwise correlation coefficient between constituent $i$ and constituent $j$ ($\rho_{ij} \in [-1, 1]$).
- $w_i, w_j$: Market capitalization weights of constituent assets in the index.

#### 2.2 Boundary Conditions & The Cauchy-Schwarz Inequality
Because the correlation matrix $\mathbf{P} = [\rho_{ij}]$ is positive semi-definite and pairwise correlations cannot exceed 1 ($\rho_{ij} \le 1$ for all $i, j$):
$$\sigma_{\text{index}}^2 \le \sum_{i=1}^n w_i^2 \sigma_i^2 + 2 \sum_{i < j} w_i w_j (1) \sigma_i \sigma_j = \left( \sum_{i=1}^n w_i \sigma_i \right)^2$$

Taking the square root yields the fundamental **Dispersion Inequality**:
$$\sigma_{\text{index}} \le \sum_{i=1}^n w_i \sigma_i$$

- **Equality Case ($\sigma_{\text{index}} = \sum w_i \sigma_i$):** Occurs if and only if all constituents move in perfect synchrony ($\rho_{ij} = 1$).
- **Dispersion Gap ($\sum w_i \sigma_i - \sigma_{\text{index}} \ge 0$):** Measures the diversification effect and idiosyncratic volatility of individual equities. The greater the dispersion among individual stocks, the wider the gap between constituent volatilities and index volatility.

#### 2.3 Model-Implied Correlation ($\rho_{\text{implied}}$)
Assuming a homogeneous average implied correlation $\rho_{\text{implied}}$ across all constituent pairs (such that $\rho_{ij} = \rho_{\text{implied}}$ for all $i \neq j$):
$$\sigma_{\text{index}}^2 = \sum_{i=1}^n w_i^2 \sigma_i^2 + \rho_{\text{implied}} \sum_{i=1}^n \sum_{j \neq i} w_i w_j \sigma_i \sigma_j$$

Note that:
$$\left( \sum_{i=1}^n w_i \sigma_i \right)^2 = \sum_{i=1}^n w_i^2 \sigma_i^2 + \sum_{i=1}^n \sum_{j \neq i} w_i w_j \sigma_i \sigma_j \implies \sum_{i=1}^n \sum_{j \neq i} w_i w_j \sigma_i \sigma_j = \left( \sum_{i=1}^n w_i \sigma_i \right)^2 - \sum_{i=1}^n w_i^2 \sigma_i^2$$

Solving directly for **Implied Correlation ($\rho_{\text{implied}}$)**:
$$\rho_{\text{implied}} = \frac{\sigma_{\text{index}}^2 - \sum_{i=1}^n w_i^2 \sigma_i^2}{\left( \sum_{i=1}^n w_i \sigma_i \right)^2 - \sum_{i=1}^n w_i^2 \sigma_i^2}$$

#### 2.4 The Correlation Risk Premium (CRP)
Empirically in equity index markets (NSE NIFTY 50, S&P 500, EURO STOXX 50), market participants systematically overpay for index options to hedge against macro tail-risk events. Consequently, the market-implied correlation extracted from option prices almost always exceeds the subsequent realized historical correlation:
$$\text{CRP} = \rho_{\text{implied}} - \rho_{\text{realized}}$$

Where:
- $\rho_{\text{realized}}$ is the historical Pearson correlation matrix calculated over an exponential or rolling window (e.g., 30-day or 60-day daily log returns):
  $$\rho_{\text{realized}} = \frac{\sum_{t=1}^T (R_{i,t} - \bar{R}_i)(R_{j,t} - \bar{R}_j)}{\sqrt{\sum_{t=1}^T (R_{i,t} - \bar{R}_i)^2} \sqrt{\sum_{t=1}^T (R_{j,t} - \bar{R}_j)^2}}$$
- **Long Dispersion Regime (CRP > +0.12):** Implied correlation is richly overpriced relative to realized correlation. Desk executes **Long Dispersion**:
  - **SELL** Index Straddles / Strangles ($\text{Short Vega}_{\text{index}}$)
  - **BUY** Constituent Straddles / Strangles ($\text{Long Vega}_{\text{constituents}}$)
  - Profit is harvested as the correlation risk premium collapses, or as idiosyncratic constituent jumps generate outsized individual gamma profits while the index remains relatively stagnant.
- **Short Dispersion Regime (CRP < -0.05):** Implied correlation is abnormally depressed (e.g. prior to major macroeconomic events like Union Budget, RBI MPC, or General Elections where systemic macro correlation will spike to 1.0). Desk executes **Short Dispersion** (Long Index Volatility, Short Basket Volatility).

#### 2.5 Multi-Expiry Term Structure & Forward Implied Volatility
Let $T_1$ and $T_2$ denote two option expiration maturities with $T_1 < T_2$, and corresponding spot implied volatilities $\sigma(T_1)$ and $\sigma(T_2)$. Under the variance additivity principle, the **Forward Implied Volatility** $\sigma_{\text{fwd}}(T_1, T_2)$ spanning between $T_1$ and $T_2$ is formulated as:
$$\sigma_{\text{fwd}}^2(T_1, T_2) = \frac{\sigma^2(T_2) T_2 - \sigma^2(T_1) T_1}{T_2 - T_1}$$

- **Calendar Arbitrage Absence Condition:** A necessary and sufficient condition to prevent negative forward variance (calendar spread arbitrage) is:
  $$\sigma^2(T_2) T_2 \ge \sigma^2(T_1) T_1$$
- **Term Structure Slope ($S_{\text{term}}$):**
  $$S_{\text{term}} = \frac{\sigma(T_2) - \sigma(T_1)}{\sqrt{T_2 - T_1}}$$
  - $S_{\text{term}} > 0$: **Contango** (Standard market condition; near-term uncertainty is lower than distant horizon).
  - $S_{\text{term}} < 0$: **Backwardation** (Market crisis or immediate event risk; near-term IV spikes violently over long-term IV).

#### 2.6 Dynamic Volatility Smile & 25-Delta Skew Formulation
The skew across strikes $K$ at maturity $T$ is quantified using 25-Delta options:
$$\text{Skew}_{25\Delta}(T) = \sigma_{\text{IV}}(K_{25\Delta \text{Put}}, T) - \sigma_{\text{IV}}(K_{25\Delta \text{Call}}, T)$$
Normalized by ATM volatility:
$$\text{Skew Ratio}(T) = \frac{\sigma_{\text{IV}}(K_{25\Delta \text{Put}}, T) - \sigma_{\text{IV}}(K_{25\Delta \text{Call}}, T)}{\sigma_{\text{IV}}(K_{\text{ATM}}, T)}$$

Multi-Expiry Skew Hedging structures exploit the relative steepness of skew curves between near-term $T_1$ (weekly) and medium-term $T_2$ (monthly) options by constructing delta-neutral diagonal ratio spreads.

#### 2.7 Automated Delta-Neutral Gamma Scalping Triggers
In a Long Dispersion trade, the portfolio holds net positive gamma ($\Gamma_{\text{portfolio}} > 0$) on constituent single stocks. Under Black-Scholes dynamics, the instantaneous PnL of a delta-hedged options portfolio evolves according to Ito's Lemma:
$$d\Pi = \left( \Theta + \frac{1}{2} \Gamma S^2 \sigma_{\text{realized}}^2 \right) dt + \Delta dS + \mathcal{V} d\sigma$$

When the portfolio is maintained delta-neutral ($\Delta \approx 0$), substituting the Black-Scholes PDE relation $\Theta = -\frac{1}{2} \Gamma S^2 \sigma_{\text{implied}}^2$ yields the fundamental **Gamma-Theta Tradeoff**:
$$\frac{d\Pi}{dt} \approx \frac{1}{2} \Gamma S^2 \left( \sigma_{\text{realized}}^2 - \sigma_{\text{implied}}^2 \right) + \mathcal{V} \frac{d\sigma}{dt}$$

If realized price volatility exceeds implied volatility ($\sigma_{\text{realized}} > \sigma_{\text{implied}}$), continuous re-hedging of delta ("gamma scalping") locks in positive cash flow that exceeds theta time-decay.

##### Optimal Gamma Hedging Band (Whalley-Wilmott Model)
Continuous re-hedging is impossible in practice due to transaction costs (SEBI STT, brokerage, bid-ask spread). Under proportional transaction cost rate $c$ (e.g. $c \approx 0.0008$ or 8 bps for Indian equity cash/futures) and investor risk aversion coefficient $\gamma_{\text{risk}}$, the optimal no-trade bandwidth $\pm \delta S$ around current underlying price $S$ is derived from the asymptotic solution of the Hamilton-Jacobi-Bellman (HJB) equation (Whalley & Wilmott, 1997):
$$\delta S^* = S \cdot \left( \frac{3}{2} \frac{c}{\gamma_{\text{risk}}} \frac{S \cdot |\Gamma|}{\sigma^2} \right)^{1/3} \quad \text{or in Delta units:} \quad |\delta \Delta^*| = \left( \frac{3}{2} \frac{c \cdot S \cdot \Gamma^2}{\gamma_{\text{risk}}} \right)^{1/3}$$

Whenever portfolio delta drift $|\Delta_{\text{net}}| \ge |\delta \Delta^*|$:
1. Trigger automatic delta-neutral re-hedging order.
2. Sizing: Trade $-\Delta_{\text{net}}$ shares in the underlying cash stock or liquid front-month futures.
3. Reset current baseline delta to 0, locking in the gamma scalping increment.

---

### 3. Feature Scope & Detailed User Stories

#### 3.1 User Story 1: Real-Time Index vs. Basket Volatility Dispersion Calculator (`TC-DISP-01`)
* **As a Senior Quantitative Volatility Trader**, I want to compute the exact implied correlation $\rho_{\text{implied}}$, realized 30-day correlation $\rho_{\text{realized}}$, and Correlation Risk Premium (CRP) across the NIFTY 50 index and its top constituents in real time, so that I can immediately identify when index volatility is overpriced relative to single stocks.
* **Acceptance Criteria:**
  - Ingests real-time prices, ATM strikes, and Black-Scholes implied volatilities for NIFTY 50 and the top 10 NSE constituents:
    1. RELIANCE (~9.5%)
    2. HDFCBANK (~8.8%)
    3. ICICIBANK (~7.6%)
    4. INFY (~5.8%)
    5. TCS (~4.2%)
    6. ITC (~3.9%)
    7. LT (~3.7%)
    8. AXISBANK (~3.2%)
    9. KOTAKBANK (~2.9%)
    10. BHARTIARTL (~3.5%)
    *(Normalized constituent basket covers ~53.1% of index weight; re-scaled to $\sum w_i = 1.0$ for the representative proxy basket).*
  - Calculates upper theoretical variance bound $\sigma_{\text{upper}} = \sum w_i \sigma_i$ and verifies the dispersion inequality $\sigma_{\text{index}} \le \sigma_{\text{upper}}$.
  - Calculates exact $\rho_{\text{implied}}$ using formula from Section 2.3; clamps mathematical edge cases to $[0.0, 1.0]$.
  - Displays rolling 30-day Pearson $\rho_{\text{realized}}$ and flags CRP state:
    - `RICH_INDEX_VOL` (CRP $\ge +0.12$) $\rightarrow$ Recommended Action: **LONG DISPERSION** (Sell Index Straddle, Buy Basket Straddles).
    - `CHEAP_INDEX_VOL` (CRP $\le -0.05$) $\rightarrow$ Recommended Action: **SHORT DISPERSION** (Buy Index Straddle, Sell Basket Straddles).
    - `FAIR_CORRELATION` ($-0.05 < \text{CRP} < +0.12$) $\rightarrow$ Neutral / Hold.

#### 3.2 User Story 2: Multi-Expiry Term Structure & Dynamic Smile Skew Analyzer (`TC-DISP-02`)
* **As an Options Derivative Structurer**, I want to view the multi-expiry volatility term structure and 25-Delta skew across weekly, bi-weekly, and monthly expiries, so that I can structure optimal calendar, diagonal, and horizontal skew hedges.
* **Acceptance Criteria:**
  - Calculates forward implied volatilities $\sigma_{\text{fwd}}(T_{\text{near}}, T_{\text{far}})$ between sequential expiration dates.
  - Automatically verifies absence of calendar arbitrage ($\sigma^2(T_2) T_2 \ge \sigma^2(T_1) T_1$); flags any temporal variance violation with visual alerts.
  - Computes 25-Delta Put-Call Skew $\text{Skew}_{25\Delta} = \sigma_{\text{IV}}(25\Delta P) - \sigma_{\text{IV}}(25\Delta C)$ and 10-Delta tail risk skew for each expiry.
  - Classifies Term Structure State:
    - `CONTANGO` ($S_{\text{term}} > 0.02$) $\rightarrow$ Normal market state.
    - `FLAT` ($-0.02 \le S_{\text{term}} \le 0.02$) $\rightarrow$ Indecision.
    - `BACKWARDATION` ($S_{\text{term}} < -0.02$) $\rightarrow$ Event risk / Volatility shock alert.
  - Suggests Multi-Expiry Skew Hedging pairs (e.g. Sell Rich Near-Term Skew, Buy Cheap Far-Term Skew).

#### 3.3 User Story 3: Vega-Neutral Basket Auto-Sizer & Execution Structurer (`TC-DISP-03`)
* **As a Portfolio Risk Manager**, I want an automated sizing calculator that takes a target index notional (e.g. ₹50,00,000 or 10 NIFTY lots) and calculates the exact integer contract quantities of constituent stock options required to achieve strict Vega-neutrality ($\text{Vega}_{\text{basket}} = \text{Vega}_{\text{index}}$), so that my portfolio is immunised against parallel shifts in market volatility.
* **Acceptance Criteria:**
  - Constituent vega allocation rule: $\text{Vega}_i = w_i \times \text{Vega}_{\text{index}}$.
  - Converts required single-stock vega into exact integer lots based on NSE standard lot sizes:
    - NIFTY 50: 25 (or current standard lot size)
    - RELIANCE: 250
    - HDFCBANK: 550
    - ICICIBANK: 700
    - INFY: 400
    - TCS: 175, etc.
  - Computes residual Vega imbalance:
    $$\Delta \text{Vega}_{\text{residual}} = \sum_{i=1}^n \text{Vega}_i^{\text{actual}} - \text{Vega}_{\text{index}}$$
    Ensures residual imbalance is $< 3.5\%$ of total position vega.
  - Calculates initial net portfolio delta $\Delta_{\text{net}} = \Delta_{\text{index}} + \sum \Delta_i$ and suggests an immediate cash/futures hedge order to set initial $\Delta_{\text{net}} = 0$.

#### 3.4 User Story 4: Automated Delta-Neutral Gamma Scalping Triggers (`TC-DISP-04`)
* **As an Algorithmic Execution Engineer**, I want an automated gamma scalping module that tracks continuous delta drift caused by constituent price movements and triggers rebalancing trades whenever delta breaches configurable threshold or Whalley-Wilmott optimal bands, so that the dispersion desk continuously monetizes realized stock volatility.
* **Acceptance Criteria:**
  - Tracks real-time portfolio net delta ($\Delta_{\text{net}}$) and dollar delta exposure ($\Delta_{\text{INR}} = \Delta_{\text{net}} \times S_{\text{index}}$).
  - Configurable rebalancing trigger modes:
    1. **Fixed Delta Threshold:** Rebalance when $|\Delta_{\text{net}}| \ge \Delta_{\text{threshold}}$ (default: 25 delta units).
    2. **Whalley-Wilmott Band:** Dynamically calculates $\delta \Delta^*$ based on underlying gamma $\Gamma_{\text{portfolio}}$, volatility, and Indian execution friction costs ($c \approx 0.08\%$).
    3. **Time-Based Check:** End-of-Day (15:20 IST) mandatory delta flattening.
  - Generates synthetic execution orders in paper portfolio with simulated micro-slippage and full transaction cost accounting.
  - Maintains real-time PnL breakdown:
    - Cumulative Gamma Scalping Gains (₹)
    - Cumulative Theta Decay Burn (₹)
    - Cumulative Vega / Correlation Mark-to-Market (₹)
    - Net Realized Edge (₹) after all SEBI taxes.

#### 3.5 User Story 5: Interactive Institutional Cockpit UI (`TC-DISP-05`)
* **As an Active Trader**, I want a dedicated interactive Modal/Workspace (`DispersionSkewModal.tsx`) featuring real-time visual charts, correlation gauges, term structure smile overlays, gamma scalping telemetry, and 1-click execution dispatch, so that I can trade and learn institutional volatility dispersion effortlessly.
* **Acceptance Criteria:**
  - **Correlation Gauge & CRP Banner:** Visual dial showing $\rho_{\text{implied}}$ vs $\rho_{\text{realized}}$ with clear regime badges (`RICH CRP`, `CHEAP CRP`, `BALANCED`).
  - **Basket Weights & Vega Allocation Radar:** Table and SVG bar chart displaying constituent weights $w_i$, individual IVs, assigned lots, and vega contribution.
  - **Term Structure & Skew Visualizer:** Multi-expiry curve comparison (Spot IV vs Forward IV, 25-Delta Put/Call Skew by maturity).
  - **Active Gamma Scalp Monitor:** Real-time delta speedometer showing current $\Delta_{\text{net}}$ inside/outside Whalley-Wilmott bands, with a live audit log of executed scalps.
  - **1-Click Basket Execution:** Dispatches the complete multi-leg dispersion structure directly to the paper trading portfolio (`tradingEngine.ts`) and records cryptographic trade hash to Proof-of-Alpha (`proofEngine.ts`).

---

### 4. Technical Architecture & Data Contracts

#### 4.1 Constituent Universe & Weight Calibration
The representative NIFTY 50 proxy basket is defined with normalized weights:

| Symbol | Company Name | Sector | Proxy Basket Weight ($w_i$) | Lot Size |
| :--- | :--- | :--- | :---: | :---: |
| **RELIANCE** | Reliance Industries Ltd | Energy / Petrochem | 18.0% | 250 |
| **HDFCBANK** | HDFC Bank Ltd | Financial Services | 16.5% | 550 |
| **ICICIBANK** | ICICI Bank Ltd | Financial Services | 14.5% | 700 |
| **INFY** | Infosys Ltd | IT Services | 11.0% | 400 |
| **TCS** | Tata Consultancy Services | IT Services | 8.0% | 175 |
| **ITC** | ITC Ltd | FMCG | 7.5% | 1600 |
| **LT** | Larsen & Toubro Ltd | Infrastructure | 7.0% | 175 |
| **AXISBANK** | Axis Bank Ltd | Financial Services | 6.0% | 625 |
| **BHARTIARTL** | Bharti Airtel Ltd | Telecom | 6.0% | 475 |
| **KOTAKBANK** | Kotak Mahindra Bank Ltd | Financial Services | 5.5% | 400 |
| **TOTAL** | — | — | **100.0%** | — |

*(Index Underlyings: `NIFTY 50`, Index Lot Size: `25`).*

#### 4.2 TypeScript Data Contracts (`src/types/dispersion.ts`)
The production system defines exhaustive, strictly-typed interfaces for the dispersion engine, multi-expiry skew hedger, and gamma scalping solver:

```typescript
/**
 * TradeCraft AI - Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine
 * Type Definitions & Quantitative Contracts (Sprint 21 - BRD-021)
 */

export type DispersionSignal = 'LONG_DISPERSION' | 'SHORT_DISPERSION' | 'NEUTRAL';
export type MarketRegime = 'HIGH_IMPLIED_CORRELATION' | 'LOW_IMPLIED_CORRELATION' | 'FAIR_VALUE';
export type TermStructureRegime = 'CONTANGO' | 'BACKWARDATION' | 'FLAT';
export type MultiExpiryHedgeType = 'CALENDAR_SPREAD' | 'DIAGONAL_SPREAD' | 'REVERSE_CALENDAR' | 'NONE';
export type RebalanceTriggerStatus = 'TRIGGERED_UPPER' | 'TRIGGERED_LOWER' | 'WITHIN_BANDS';
export type HedgeInstrumentType = 'FUTURES' | 'EQUITY' | 'OPTION';

export interface ConstituentOptionQuote {
  symbol: string;
  companyName?: string;
  spotPrice: number;
  strike: number;
  expiry: string;
  callIV: number;        // In decimal, e.g. 0.22 for 22%
  putIV: number;         // In decimal, e.g. 0.24 for 24%
  atmIV: number;         // Composite or ATM IV
  historicalVol: number; // 20d/30d Realized Volatility
  lotSize: number;       // Exchange lot size (e.g. 250 for RELIANCE)
  indexWeight: number;   // Raw weight in Nifty (e.g. 0.095 for 9.5%)
  normalizedWeight?: number; // Weight within dirty basket (sum = 1.0)
  callPrice?: number;
  putPrice?: number;
  straddlePrice?: number;
  bidAskSpread?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
}

export interface IndexOptionQuote {
  symbol: string;        // 'NIFTY 50' or 'NIFTY'
  spotPrice: number;
  strike: number;
  expiry: string;
  atmIV: number;         // In decimal, e.g. 0.14 for 14%
  callIV: number;
  putIV: number;
  historicalVol: number;
  lotSize: number;       // 25
  callPrice?: number;
  putPrice?: number;
  straddlePrice?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
}

export interface BasketIVCalculationResult {
  indexIV: number;
  basketIV: number;                    // Linear weighted basket IV: sum(w_i * sigma_i)
  varianceBasketIV: number;            // Quadratic basket IV: sqrt(sum(w_i^2 * sigma_i^2))
  dispersionSpread: number;            // basketIV - indexIV
  dispersionSpreadBps: number;         // spread in basis points (e.g. 350 bps = 3.5%)
  weightedConstituentVariance: number; // sum(w_i^2 * sigma_i^2)
  impliedCorrelation: number;          // Bounded in [0, 1]
  rawImpliedCorrelation: number;       // Unclamped mathematical correlation
  realizedCorrelation: number;         // Historical correlation benchmark
  correlationSpread: number;           // impliedCorrelation - realizedCorrelation
  signal: DispersionSignal;
  signalStrength: number;              // Confidence score 0 to 100
  rationale: string;
}

export interface DirtyConstituentAnalysis {
  symbol: string;
  companyName: string;
  weight: number;                      // Raw index weight
  normalizedWeight: number;            // Normalized weight in dirty basket
  spotPrice: number;
  atmIV: number;
  historicalVol: number;
  volatilityPremium: number;           // atmIV - historicalVol
  varianceContribution: number;        // normalizedWeight^2 * atmIV^2
  varianceContributionPct: number;     // % contribution to dirty basket variance
  strikeSkew: number;                  // putIV - callIV (25-delta skew proxy)
  lotSize: number;
  straddlePrice: number;
  vegaPerLot: number;
  recommendedLegs: {
    action: 'BUY' | 'SELL' | 'HOLD';
    side: 'BUY' | 'SELL';
    lots: number;
    contracts: number;                 // lots * lotSize
    targetVega: number;
    estimatedPremium: number;
  };
}

export interface DispersionPortfolioAllocation {
  indexLots: number;
  indexSide: 'BUY' | 'SELL';
  indexVega: number;
  indexGrossPremium: number;
  constituentLegs: {
    symbol: string;
    side: 'BUY' | 'SELL';
    lots: number;
    contracts: number;
    weight: number;
    straddlePrice: number;
    allocatedCapital: number;
    legVega: number;
  }[];
  netPortfolioVega: number;
  netPortfolioDelta: number;
  totalEstimatedCapital: number;
  totalGrossPremium: number;
  statutoryCharges: number;
  netCapitalRequired: number;
  breakevenCorrelationMove: number;
}

export interface DirtyDispersionScanResult {
  timestamp: string;
  indexSymbol: string;
  indexQuote: IndexOptionQuote;
  constituents: DirtyConstituentAnalysis[];
  basketCalculation: BasketIVCalculationResult;
  dirtyBasketIV: number;
  indexIV: number;
  dispersionSpread: number;
  impliedCorrelation: number;
  marketRegime: MarketRegime;
  tradeSignal: DispersionSignal;
  confidence: number;
  recommendedAllocation: DispersionPortfolioAllocation;
}

export interface MultiExpirySkewQuote {
  expiry: string;
  daysToExpiry: number;
  atmIV: number;
  call25DeltaIV: number;
  put25DeltaIV: number;
  strikeSkew: number;                  // put25DeltaIV - call25DeltaIV
  straddlePrice: number;
}

export interface MultiExpirySkewHedgingResult {
  symbol: string;
  spotPrice: number;
  nearExpiry: MultiExpirySkewQuote;
  nextExpiry: MultiExpirySkewQuote;
  farExpiry?: MultiExpirySkewQuote;
  termStructure: TermStructureRegime;
  termSpread: number;                  // nextExpiry.atmIV - nearExpiry.atmIV
  annualizedRollYield: number;
  recommendedHedge: MultiExpiryHedgeType;
  hedgeRatio: number;                  // Ratio of back-month to front-month lots
  nearLeg: {
    expiry: string;
    action: 'BUY' | 'SELL';
    strike: number;
    lots: number;
  };
  farLeg: {
    expiry: string;
    action: 'BUY' | 'SELL';
    strike: number;
    lots: number;
  };
  explanation: string;
}

export interface GammaScalpingConfig {
  symbol: string;
  instrumentType: HedgeInstrumentType;
  bandThresholdPct: number;            // e.g. 0.005 (+-0.5%) or 0.01 (+-1.0%)
  lotSize: number;                     // 25 for NIFTY, 250 for RELIANCE
  targetDelta?: number;                // Default 0.0 (Delta neutral)
  slippageBps?: number;                // Default 2 bps
  brokeragePerOrder?: number;          // Default ₹20
}

export interface GammaScalpingState {
  anchorSpotPrice: number;             // Spot price at last rebalance / entry
  currentSpotPrice: number;            // Current live spot price
  currentNetDelta: number;             // Net delta in shares/index units
  currentNetGamma: number;             // Net gamma in units per 1 pt move
  currentNetVega?: number;
  currentNetTheta?: number;
}

export interface GammaScalpingOrder {
  side: 'BUY' | 'SELL' | 'NONE';
  instrument: HedgeInstrumentType;
  symbol: string;
  quantity: number;                    // Absolute number of units
  lots: number;                        // Number of standard lots
  executionPrice: number;
  notionalValue: number;
  estimatedSlippage: number;
  statutoryCharges: number;
}

export interface GammaScalpingRebalanceResult {
  rebalanceTriggered: boolean;
  status: RebalanceTriggerStatus;
  anchorSpotPrice: number;
  currentSpotPrice: number;
  priceChange: number;                 // currentSpot - anchorSpot
  priceBreachPct: number;              // (currentSpot - anchorSpot) / anchorSpot
  thresholdPct: number;
  netDeltaBefore: number;
  deltaDrift: number;                  // Expected delta change due to gamma
  orderRequired: GammaScalpingOrder;
  executedDelta: number;               // Sign-adjusted delta delivered by order
  netDeltaAfter: number;               // Residual delta post-hedge
  grossScalpProfit: number;            // 0.5 * Gamma * (dS)^2
  totalFrictions: number;              // Statutory charges + slippage
  netScalpProfit: number;              // grossScalpProfit - totalFrictions
  newAnchorSpotPrice: number;          // Updated anchor price
  message: string;
}

// Lightweight Execution Contracts & Algorithmic Core Interfaces
export interface BasketComponent {
  symbol: string;
  weight: number; // e.g. 0.25 (25%)
  spotPrice: number;
  impliedVol: number; // Annualized IV (e.g. 0.22 for 22%)
  realizedVol?: number;
  atmStrike: number;
  lotSize: number;
  vega: number; // Vega per contract
  delta?: number;
  gamma?: number;
}

export interface ImpliedCorrelationResult {
  impliedCorrelation: number; // Clamped to [0, 1]
  rawImpliedCorrelation: number; // Unclamped theoretical value
  isClamped: boolean;
  clampedReason?: 'SUPER_HEDGING_VIOLATION' | 'ZERO_CORRELATION_CLAMPED' | 'NONE';
  indexImpliedVol: number;
  weightedComponentVol: number;
  indexVariance: number;
  independentVarianceSum: number;
  crossProductVarianceSum: number;
}

export interface DispersionSpreadAnalysis {
  indexSymbol: string;
  indexImpliedVol: number;
  weightedComponentVol: number;
  dirtyDispersionSpread: number; // Component IV - Index IV
  impliedCorrelation: number;
  realizedCorrelation: number;
  correlationSpread: number; // Implied Rho - Realized Rho
  arbitrageType: 'LONG_DISPERSION' | 'SHORT_DISPERSION' | 'NEUTRAL_NO_ARBITRAGE';
  recommendedAction: 'SELL_INDEX_BUY_COMPONENTS' | 'BUY_INDEX_SELL_COMPONENTS' | 'HOLD_NO_ACTION';
  confidenceScore: number;
  hurdleThreshold: number;
  netEstimatedEdgeBps: number;
}

export interface GammaScalpTrigger {
  timestamp: number;
  underlyingPrice: number;
  netDelta: number;
  deltaThreshold: number;
  action: 'HOLD_WITHIN_BAND' | 'REBALANCE_SELL_UNDERLYING' | 'REBALANCE_BUY_UNDERLYING';
  rebalanceContracts: number;
  portfolioGamma: number;
  estimatedScalpPnL: number;
  thetaDecayCost: number;
  netScalpYield: number;
}

export interface MultiExpirySkewHedgePlan {
  symbol: string;
  nearExpiry: TermStructureSkewPoint;
  farExpiry: TermStructureSkewPoint;
  termStructureSlope: number;
  regime: 'CONTANGO' | 'BACKWARDATION' | 'FLAT';
  calendarVegaHedgeRatio: number;
  recommendedSkewStructure: 'CALENDAR_SPREAD' | 'DIAGONAL_SKEW_REVERSAL' | 'RATIO_BACKSPREAD' | 'NEUTRAL';
}
```

---

### 5. Algorithmic Workflow & Calculation Logic

#### 5.1 Step 1: Volatility Ingestion & Dispersion Calculation
```typescript
/**
 * Calculates instantaneous Implied Correlation and Correlation Risk Premium
 */
export function calculateDispersionMetrics(
  indexIV: number,
  indexSpot: number,
  constituents: BasketConstituent[],
  historicalCorrelation30d: number
): DispersionMetrics {
  const sigmaIndex = indexIV / 100;
  let sumWeightSigmaSq = 0;
  let sumWeightSigma = 0;

  for (const c of constituents) {
    const sigma = c.impliedVol / 100;
    sumWeightSigmaSq += Math.pow(c.weight, 2) * Math.pow(sigma, 2);
    sumWeightSigma += c.weight * sigma;
  }

  const denominator = Math.pow(sumWeightSigma, 2) - sumWeightSigmaSq;
  let impliedCorr = 0;
  if (denominator > 1e-7) {
    impliedCorr = (Math.pow(sigmaIndex, 2) - sumWeightSigmaSq) / denominator;
  }
  // Clamp correlation between 0 and 1
  impliedCorr = Math.max(0.01, Math.min(0.99, impliedCorr));

  const crp = impliedCorr - historicalCorrelation30d;
  let dispersionRegime: DispersionRegime = 'FAIR_CORRELATION';
  let recommendedTrade: 'LONG_DISPERSION' | 'SHORT_DISPERSION' | 'HOLD' = 'HOLD';

  if (crp >= 0.12) {
    dispersionRegime = 'RICH_INDEX_VOL';
    recommendedTrade = 'LONG_DISPERSION';
  } else if (crp <= -0.05) {
    dispersionRegime = 'CHEAP_INDEX_VOL';
    recommendedTrade = 'SHORT_DISPERSION';
  }

  return {
    indexSymbol: 'NIFTY 50',
    indexSpot,
    indexIV,
    basketWeightedIV: Number((sumWeightSigma * 100).toFixed(2)),
    theoreticalUpperBoundIV: Number((sumWeightSigma * 100).toFixed(2)),
    impliedCorrelation: Number(impliedCorr.toFixed(3)),
    realizedCorrelation30d: Number(historicalCorrelation30d.toFixed(3)),
    correlationRiskPremium: Number(crp.toFixed(3)),
    dispersionRegime,
    recommendedTrade,
    netAlphaBps: Math.round(crp * 450), // 45 bps per 0.10 correlation edge
  };
}
```

#### 5.2 Step 2: Forward Implied Volatility & Skew Calibrator
```typescript
/**
 * Calculates Forward Implied Volatility and validates Calendar Arbitrage
 */
export function calculateForwardTermStructure(
  expiries: { date: string; days: number; atmIV: number; put25IV: number; call25IV: number }[]
): TermStructureSummary {
  const points: ExpiryTermStructurePoint[] = [];

  for (let i = 0; i < expiries.length; i++) {
    const cur = expiries[i];
    const T_cur = cur.days / 365;
    let forwardIV = cur.atmIV;
    let isCalendarArbitrageFree = true;

    if (i > 0) {
      const prev = expiries[i - 1];
      const T_prev = prev.days / 365;
      const totalVarCur = Math.pow(cur.atmIV / 100, 2) * T_cur;
      const totalVarPrev = Math.pow(prev.atmIV / 100, 2) * T_prev;

      if (totalVarCur >= totalVarPrev) {
        forwardIV = Number((Math.sqrt((totalVarCur - totalVarPrev) / (T_cur - T_prev)) * 100).toFixed(2));
      } else {
        isCalendarArbitrageFree = false;
        forwardIV = 0; // Calendar arbitrage violation
      }
    }

    const skew25Delta = Number((cur.put25IV - cur.call25IV).toFixed(2));
    const skewRatio = Number((skew25Delta / (cur.atmIV || 1)).toFixed(3));

    points.push({
      expiryDate: cur.date,
      daysToExpiry: cur.days,
      atmIV: cur.atmIV,
      forwardIV,
      put25DeltaIV: cur.put25IV,
      call25DeltaIV: cur.call25IV,
      skew25Delta,
      skewRatio,
      isCalendarArbitrageFree,
    });
  }

  const slope = points.length > 1 ? (points[points.length - 1].atmIV - points[0].atmIV) / points.length : 0;
  const regime: TermStructureRegime = slope > 0.4 ? 'CONTANGO' : slope < -0.4 ? 'BACKWARDATION' : 'FLAT';

  return {
    points,
    regime,
    slopeTerm: Number(slope.toFixed(2)),
    calendarOpportunities: [],
  };
}
```

#### 5.3 Step 3: Whalley-Wilmott Gamma Scalping Band Calculator
```typescript
/**
 * Calculates the optimal Whalley-Wilmott rebalancing bandwidth in Delta units
 */
export function calculateWhalleyWilmottBand(
  spotPrice: number,
  portfolioGamma: number,
  volatility: number,
  transactionCostRate: number = 0.0008, // 8 bps for Indian STT + GST + turnover
  riskAversion: number = 0.5
): number {
  if (Math.abs(portfolioGamma) < 1e-6) return 25.0; // Fallback threshold

  // |delta_Delta| = ( 1.5 * c * S * Gamma^2 / riskAversion )^(1/3)
  const numerator = 1.5 * transactionCostRate * spotPrice * Math.pow(portfolioGamma, 2);
  const band = Math.pow(numerator / riskAversion, 1 / 3);
  return Number(Math.max(5, Math.min(100, band)).toFixed(1));
}
```

---

### 6. SEBI Regulatory Compliance & Indian Statutory Cost Impact

Trading a 10-constituent dispersion basket involves multiple legs across equity index and single-stock derivatives. Compliance with SEBI derivative regulations and accurate statutory fee deduction is non-negotiable:

#### 6.1 Indian Statutory Charges Schedule (as per SEBI & Finance Act 2024/2026)
1. **Securities Transaction Tax (STT):**
   - Options Premium (Sell Side): **0.1%** of option premium value.
   - Exercised Options: **0.125%** of intrinsic settlement value.
   - Futures / Cash Equity: **0.02%** on sell side (Futures) / **0.1%** on both sides (Cash delivery).
2. **Exchange Turnover Charges:**
   - NSE Equity Options: **0.05%** on premium value.
   - NSE Stock Futures: **0.0019%**.
3. **Goods & Services Tax (GST):**
   - **18%** applied on (Brokerage + Exchange Turnover Charges + SEBI Charges).
4. **SEBI Turnover Fee:**
   - ₹10 per crore (₹0.0001%).
5. **Stamp Duty:**
   - Options Buy: **0.003%** on premium.
   - Futures Buy: **0.002%** on notional.

#### 6.2 Pre-Trade Net Alpha Filter
A dispersion trade recommendation is **rejected** unless projected gross alpha exceeds the total statutory fee drag plus slippage by at least **2.0x**:
$$\text{Expected Net Alpha} = \text{Gross Dispersion Edge (₹)} - (\text{Statutory Taxes} + \text{Conservative 2-Tick Slippage}) > 0$$

---

### 7. Non-Functional Requirements & System Performance

1. **Sub-Millisecond Calculation Latency:** Complete dispersion matrix calculation (10 constituents $\times$ Black-Scholes Greeks $\times$ Implied Correlation inversion) must complete in $< 15\text{ ms}$ on client side.
2. **Zero External Dependencies:** Pure TypeScript implementation leveraging existing internal modules (`optionsEngine.ts`, `taxEngine.ts`, `greeksHedgerEngine.ts`).
3. **High-DPI Responsive Visualization:** Clean dark-mode UI styled with Tailwind CSS, SVG charts, and seamless accessibility across desktop (1920x1080) and laptop viewports.
4. **Deterministic Simulation & Test Coverage:** 100% test coverage across mathematical corner cases (e.g. perfect correlation $\rho=1.0$, negative forward variance, zero gamma, strike boundary conditions).

---

### 8. Acceptance Criteria & Definition of Done (DoD)

1. [x] **Comprehensive BRD-021 Authored:** Complete documentation covering mathematical derivations, multi-expiry skew, automated gamma scalping, user stories, and data contracts.
2. [ ] **BRD Index Updated:** `docs/brds/README.md` updated with entry for `BRD-021`.
3. [ ] **Data Types Created:** `src/types/dispersion.ts` implementing complete data structures with strict type safety.
4. [ ] **Core Engine Implemented:** `src/lib/dispersionEngine.ts` containing:
   - Index vs Basket dispersion calculation
   - Model implied correlation and CRP
   - Term structure skew and forward IV
   - Vega-neutral lot sizing
   - Whalley-Wilmott gamma scalping bands
5. [ ] **Interactive Cockpit UI Modal:** `src/components/DispersionSkewModal.tsx` built with correlation gauges, term structure charts, and gamma scalping controls.
6. [ ] **Navigation & Landing Integration:** Linked in `Header.tsx` (under Derivatives Suite), Command Palette (`Ctrl+K`), and Landing Page feature highlight.
7. [ ] **Automated Test Suite:** Comprehensive test suite in `test/dispersionEngine.test.mjs` verifying all quantitative identities with 100% pass rate.
8. [ ] **Clean Compilation:** Zero TypeScript errors (`npx tsc --noEmit`) and successful build (`npm run build`).

---
*Signed by:*  
**Researcher Lead Agent** — TradeCraft AI Quantitative Research & Derivatives Desk  
**Scrum Master Agent & Master Orchestrator** — Target Sprint 21 Execution
