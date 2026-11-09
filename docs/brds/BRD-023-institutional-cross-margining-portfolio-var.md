# Business Requirements Document (BRD) - Sprint 23

## Feature ID: `BRD-023`
## Feature Title: Institutional Multi-Asset Cross-Margining & Portfolio VaR Optimization Engine (Index Options, Stock Futures, MCX Commodity Offsets & Collateral Haircuts)
**Author:** Researcher Lead (Autonomous Multi-Agent Cycle)  
**Date:** 2026-11-09  
**Status:** `APPROVED FOR IMPLEMENTATION`  
**Target Milestone:** Sprint 23  
**Dependencies:**
- Sprint 1 (`taxEngine.ts` — Indian Statutory Taxes, SEBI STT, GST)
- Sprint 2 (`optionsEngine.ts` — Black-Scholes Formula, Implied Volatility & Greeks)
- Sprint 13 (`greeksHedgerEngine.ts` — Dynamic Delta-Gamma Neutral Hedging)
- Sprint 14 (`volatilitySurfaceEngine.ts`, `optionsOptimizerEngine.ts` — Surface Calibration & Payoff Optimization)
- Sprint 16 (`statArbEngine.ts` — Cointegration Pairs & Minimum Variance Hedging)
- Sprint 21 (`volatilityDispersionEngine.ts` — Options Volatility Dispersion Engine)
- Sprint 22 (`riskEngine.ts` — Pre-Trade Risk Engine, SPAN Margin & EVT Tail Risk)

---

### 1. Executive Summary & Problem Statement

#### 1.1 Context
In the Indian financial ecosystem regulated by the **Securities and Exchange Board of India (SEBI)**, multi-asset institutional desks, family offices, and quantitative proprietary trading firms trade concurrently across multiple clearing houses and asset classes:
1. **NSE Clearing Limited (NCL)**: Equity Cash Market (CM), Equity Index & Stock Derivatives (F&O), and Currency Derivatives (CD).
2. **Multi Commodity Exchange Clearing Corporation (MCXCCL)**: Commodity Derivatives (Precious Metals like Gold/Silver, Energy like Crude Oil/Natural Gas, and Base Metals like Copper/Aluminium).
3. **Clearing Corporation of India Limited (CCIL)**: Government Securities (G-Secs), Treasury Bills (T-Bills), Triparty Repo (TREPS), and Interest Rate Swaps (IRS / MIBOR OIS).

Institutional quantitative strategies frequently deploy cross-market hedges. For instance:
* Holding long equity portfolios (e.g. NIFTY 50 basket or large-cap energy/auto stocks) hedged with **MCX Crude Oil** or **MCX Gold Futures** to offset macroeconomic supply shocks and geopolitical beta.
* Index options calendar spreads combined with constituent single-stock futures baskets (e.g. Long NIFTY 50 Futures synthetic delta vs Short top 5 heavyweights: RELIANCE, HDFCBANK, ICICIBANK, INFY, TCS).
* Pledging debt securities (G-Secs, T-Bills) and liquid mutual fund units in demat accounts to satisfy upfront margin requirements under SEBI's Margin Pledge rules.

#### 1.2 Problem Statement
Despite the economic reality of cross-asset portfolio risk mitigation, trading desks face severe structural capital inefficiencies and regulatory bottlenecks in the Indian market:

1. **Siloed Segment Margining (Double Margin Trap):**
   Traditional brokers and clearing systems evaluate margin requirements on an isolated, segment-by-segment basis. A trader long ₹1 Crore in NIFTY 50 Futures on NSE and short the corresponding delta in MCX Gold or sector stock futures is charged full initial SPAN and Extreme Loss Margins (ELM) on **both sides**, locking up 200% of the economically required capital and depressing Portfolio Return on Capital (ROC) by 40% to 65%.
2. **Ignorance of SEBI Cross-Margining Concessions:**
   SEBI allows significant margin concessions (up to 75% - 80% reduction in initial margin) on correlated offsetting positions between Index F&O, constituent stock futures, and across eligible cash-derivative combinations. However, existing trading platforms provide zero native tooling to dynamically identify, track, and exploit eligible cross-margining pairs across exchanges.
3. **50:50 Cash-to-Collateral Ratio Violations & Cash Shortfall Fines:**
   SEBI mandates that for overnight F&O positions, at least **50% of the required margin must be maintained in pure Cash or Cash Equivalents** (Cash, G-Secs, T-Bills, Liquid Mutual Funds). The remaining 50% can be funded by non-cash collateral (approved Group-I equities, SGBs). If non-cash collateral exceeds 50% while cash balance is deficient, clearing corporations levy **delayed payment interest charges of 18% per annum (0.05% per day)** on the cash shortfall—even when total portfolio collateral far exceeds the margin obligation! Desks lack real-time collateral optimization solvers to pledge and allocate securities efficiently.
4. **Non-Harmonized Statutory Collateral Haircuts:**
   Collateral pledged via demat undergoes strict regulatory haircuts based on asset class volatility:
   - Cash & Cash Equivalents: $0\%$
   - Sovereign G-Secs / T-Bills: $2\%$
   - Liquid Mutual Funds & Overnight ETFs: $10\%$
   - Sovereign Gold Bonds (SGBs) & Gold ETFs: $15\%$
   - Group-I Approved Equities: $20\%$ (or VaR + 3.5×ELM)
   - Group-II / Illiquid Stocks: $40\% - 100\%$ (ineligible)
   Without real-time mark-to-market haircut monitoring, sudden drops in pledged equity prices trigger unexpected margin calls, unannounced forced squaring of positions, and substantial regulatory penalties.
5. **Parametric VaR Blindness & Lack of Marginal Risk Attribution:**
   Traditional portfolio management tools calculate simple parametric Value-at-Risk ($\text{VaR}$) assuming static Gaussian correlations. They fail to capture fat-tailed historical joint crash distributions, non-linear option convexities, and commodity-equity basis breakdown during market stress. Furthermore, portfolio managers cannot isolate **Marginal Risk Contribution (MRC)**—the exact rupee VaR contributed by each individual leg or asset class—making optimal hedge sizing impossible.

#### 1.3 Solution & Business Objectives
TradeCraft AI Sprint 23 delivers an institutional-grade, browser-native **Institutional Multi-Asset Cross-Margining & Portfolio VaR Optimization Engine**:
* **SEBI / NCL / MCXCCL Multi-Asset Cross-Margining Engine:** Automatically groups portfolio positions into SEBI-compliant offsetting baskets (Index F&O vs Stock Futures, Cash CM vs Equity Derivatives, and Cross-Exchange Commodity hedges), applying regulatory spread concessions (up to 75% - 80%) to unlock trapped trading capital.
* **Statutory Demat Collateral Pledge & Haircut Optimizer:** Full inventory tracking of pledged assets across Cash (0%), G-Secs/T-Bills (2%), Liquid MFs (10%), SGBs (15%), and Group-I Equities (20%). Includes an automated linear programming (LP) solver to maintain the mandatory **50:50 Cash-to-Collateral ratio**, completely eliminating 18% p.a. cash shortfall interest charges.
* **Full-Revaluation Historical Value-at-Risk ($\text{HVaR}_{99\%}$) & Coherent Expected Shortfall ($\text{CVaR}_{99\%}$):** Simulates 500-day historical joint return vectors across equities, index options (revalued via full Black-Scholes pricing), and MCX commodities without simplifying normality assumptions.
* **Euler Marginal Risk Contribution (MRC) & Component VaR:** Decomposes portfolio VaR and CVaR down to individual asset legs using Euler's homogeneous degree-1 theorem ($\sum w_i \text{MRC}_i = \text{Portfolio VaR}$), identifying high-risk capital drains and hedges that provide negative risk contribution.
* **Convex Portfolio Margin & VaR Optimizer:** Solves quadratic and convex optimization problems to rebalance multi-asset weights, minimizing total required clearing margin and tail VaR subject to net market delta neutrality and leverage caps.
* **Interactive Institutional Cross-Margining Cockpit UI:** Dark-mode dashboard featuring live cross-margining concession meters, collateral haircut matrices, 50:50 ratio gauge with interest burn alerts, Euler risk waterfall charts, and one-click collateral rebalance execution.

---

### 2. Regulatory & Clearing Corporation Framework

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│              SEBI & CLEARING CORPORATION MULTI-ASSET CROSS-MARGINING ECOSYSTEM                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   NSE CASH (CM)             NSE F&O DERIVATIVES              MCX COMMODITY DERIVATIVES           │
│   [Equities / ETFs]         [NIFTY, BANKNIFTY, Stocks]       [Gold, Crude, Silver, Copper]       │
│          │                              │                                  │                     │
│          ▼                              ▼                                  ▼                     │
│   NSE Clearing (NCL)             NSE Clearing (NCL)               MCX Clearing (MCXCCL)          │
│   (Cash Segment)                 (F&O Segment)                    (Commodity Segment)            │
│          │                              │                                  │                     │
│          └──────────────────────────────┼──────────────────────────────────┘                     │
│                                         │                                                        │
│                                         ▼                                                        │
│             ┌────────────────────────────────────────────────────────┐                           │
│             │   TRADECRAFT AI CROSS-MARGINING & PLEDGE ENGINE        │                           │
│             ├────────────────────────────────────────────────────────┤                           │
│             │ • Cross-Segment Correlation Matrix (\rho >= 0.80)      │                           │
│             │ • Eligible Offsetting Spread Concessions (75% - 80%)   │                           │
│             │ • Statutory Haircut Schedule (0%, 2%, 10%, 15%, 20%)   │                           │
│             │ • Mandatory 50:50 Cash-to-Collateral Regulatory Ratio  │                           │
│             │ • Historical VaR (99%) & Expected Shortfall (CVaR)     │                           │
│             │ • Euler Marginal Risk Contribution (MRC) Attribution   │                           │
│             └───────────────────────────┬────────────────────────────┘                           │
│                                         │                                                        │
│                    ┌────────────────────┴────────────────────┐                                   │
│                    ▼                                         ▼                                   │
│         [ CAPITAL UNLOCKED ]                      [ REGULATORY COMPLIANCE ]                      │
│     Margin Reduction: 40% - 65%             Zero Cash Shortfall Interest (18% p.a.)              │
│     Optimal Collateral Allocation           Strict 50:50 Cash/Non-Cash Compliance                │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1 SEBI Multi-Segment Cross-Margining Guidelines
SEBI circulars (SEBI/DNPD/Cir-41/2008, CIR/MRD/DRMNP/09/2013, and subsequent harmonizations) establish cross-margining between:
1. **Cash Market (CM) and Equity Derivatives (F&O):**
   - Positions in eligible index ETF / physical equity basket offsetting Index Futures or Stock Futures.
   - For complete offset (e.g. Long Reliance Cash + Short Reliance Futures), initial SPAN margin on the derivatives leg is reduced by **75%**.
2. **Index Derivatives vs Stock Derivatives:**
   - Offset between Index Futures/Options synthetic delta and constituent single-stock futures baskets.
   - Requires a minimum constituent weight representation (e.g. at least 80% of index basket market capitalization) with tracking error $\text{TE} \le 1.5\%$. Spread margin concession is **75%** on the matched portion.
3. **Cross-Exchange & Inter-Commodity Offsetting (NSE vs MCX):**
   - SEBI circular SEBI/HO/CDMRD/DRMP/CIR/P/2018/125 permits cross-margining between commodity derivatives and equity indices where economic linkage or statistical correlation $\rho \ge 0.80$ is verified over a rolling 252-day window.
   - **MCX Gold vs Equity Portfolio:** Recognized safe-haven negative beta hedge under extreme volatility scenarios.
   - **MCX Crude Oil vs Energy / Aviation / Paint Equities:** Direct cost-input commodity hedges (e.g. Long INDIGO or ASIANPAINT vs Long MCX Crude Futures hedge; Long ONGC vs Short MCX Crude Futures).
   - Eligible spread concession rate: **75% to 80%** concession on SPAN initial margin for matched risk exposure.

#### 2.2 Statutory Demat Collateral Pledge & Haircut Schedule
Under SEBI circular SEBI/HO/MIRSD/DOR/CIR/P/2020/170 (Margin Pledge and Re-Pledge mechanism):
* Pledged securities remain in the client's own demat account (marked with a pledge lien in favor of the Clearing Member / Clearing Corporation via CDSL/NSDL).
* Pledged collateral is marked to market daily and discounted by statutory minimum regulatory haircuts:

| Asset Class Category | Eligible Instruments | SEBI Min. Haircut | Cash Equivalent Status | Regulatory Treatment |
| :--- | :--- | :---: | :---: | :--- |
| **Cash & Cash Equivalents** | Indian Rupee (INR) Balance, Bank Fixed Deposits (FDR with scheduled banks), Bank Guarantees | **0%** | **YES (100%)** | Counts towards 50% Cash component |
| **Sovereign Debt** | Central Government Securities (G-Secs), Treasury Bills (91/182/364-day T-Bills) | **2%** | **YES (100%)** | Sovereign rating; ultra-low liquidity risk; eligible as cash equivalent |
| **Liquid Mutual Funds** | Units of Liquid MFs, Overnight Funds, Liquid ETFs (e.g. LIQUIDBEES) | **10%** | **YES (100%)** | MTM daily; eligible as cash equivalent under SEBI norms |
| **Sovereign Gold Bonds (SGB)** | RBI Sovereign Gold Bonds, Sovereign Gold ETFs | **15%** | **NO (Non-Cash)** | High sovereign credit, but gold commodity price volatility |
| **Group-I Equity Shares** | NIFTY 50, NIFTY Next 50, Top 200 large-cap liquid equities traded with low impact cost | **20%** | **NO (Non-Cash)** | Haircut = $\max(20\%, \text{VaR} + 3.5 \times \text{ELM})$. Non-cash collateral |
| **Group-II Equity Shares** | Mid/Small cap equities, higher volatility securities | **40% - 100%** | **NO (Non-Cash)** | High haircut; ineligible at prime institutional clearing tiers |

#### 2.3 The SEBI 50:50 Cash-to-Collateral Mandate
Clearing corporations mandate that for all overnight derivatives positions:
$$\text{Total Margin Requirement} = M_{\text{total}} = M_{\text{SPAN}} + M_{\text{ELM}} + M_{\text{Addnl}}$$

The margin requirement must satisfy the **50:50 Cash-to-Collateral Rule**:
$$\text{Eligible Cash Collateral} \ge 0.50 \times M_{\text{total}}$$
$$\text{Eligible Non-Cash Collateral} \le 0.50 \times M_{\text{total}}$$

##### Cash Shortfall Interest Penalty Formula
Let $C_{\text{cash}}$ be the post-haircut value of pledged Cash and Cash Equivalents (Cash, G-Secs, T-Bills, Liquid MFs).  
Let $C_{\text{non-cash}}$ be the post-haircut value of pledged Non-Cash Collateral (Group-I Equities, SGBs).

The effective margin coverage is:
$$M_{\text{covered}} = \min \left( C_{\text{cash}}, 0.50 \times M_{\text{total}} \right) + \min \left( C_{\text{non-cash}}, 0.50 \times M_{\text{total}} \right)$$

If $C_{\text{cash}} < 0.50 \times M_{\text{total}}$, a **Cash Shortfall** occurs:
$$\Delta C_{\text{shortfall}} = (0.50 \times M_{\text{total}}) - C_{\text{cash}}$$

Even if the client has surplus non-cash collateral ($C_{\text{cash}} + C_{\text{non-cash}} \gg M_{\text{total}}$), clearing members and brokers are penalized by the clearing corporation and pass on **delayed payment interest (cash deficit interest)** to the client:
$$\text{Daily Interest Penalty} = \Delta C_{\text{shortfall}} \times \left( \frac{0.18}{365} \right) = \Delta C_{\text{shortfall}} \times 0.000493 \quad (\approx 0.05\% \text{ per day / } 18\% \text{ p.a.})$$

---

### 3. Quantitative & Mathematical Formulations

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   QUANTITATIVE CROSS-MARGINING & PORTFOLIO VaR FORMULATIONS                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. ROLLING SHRINKAGE CORRELATION MATRIX (\Sigma \succ 0)                                   │  │
│  │    • Rolling 252-day return vectors R_i, R_j across NSE Equities, Options & MCX Commodities│  │
│  │    • Sample Covariance S; Ledoit-Wolf Linear Shrinkage Target F: \Sigma^* = (1-d)S + d F   │  │
│  │    • Offsetting Eligibility: Correlation \rho_{i,j} >= 0.80 and Cointegration p < 0.05     │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. MINIMUM VARIANCE HEDGE RATIO (MVHR) & SEBI CONCESSION ALLOCATOR                         │  │
│  │    • Hedge Ratio: \beta^* = Cov(R_target, R_hedge) / Var(R_hedge)                          │  │
│  │    • Spread Margin Benefit: Concession C_{spread} = 75% on matched delta leg               │  │
│  │    • Net Margin = Unhedged_SPAN + (1 - C_{spread}) \times Matched_SPAN + ELM               │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. 50:50 COLLATERAL LP OPTIMIZER (ZERO CASH SHORTFALL PENALTY)                             │  │
│  │    • Pledged Assets with Haircuts: H_cash = 0%, H_gsec = 2%, H_lmf = 10%, H_sgb = 15%,     │  │
│  │      H_eq = 20%                                                                            │  │
│  │    • Cash Equivalent Pool = Cash + (1 - H_gsec) GSec + (1 - H_lmf) LMF                     │  │
│  │    • Linear Program: Maximize Free Capital subject to Cash Pool >= 50% Required Margin     │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 4. HISTORICAL VaR (HVaR 99%) & COHERENT EXPECTED SHORTFALL (CVaR 99%)                      │  │
│  │    • Full revaluation over 500 historical scenarios: L_k = - \Delta Portfolio_k            │  │
│  │    • Non-linear Black-Scholes pricing on options legs across past market shifts            │  │
│  │    • HVaR_{99%} = Quantile_{0.99}(L); CVaR_{99%} = (1 / |T_{tail}|) \sum_{k \in T} L_k    │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 5. EULER MARGINAL RISK CONTRIBUTION (MRC) & PORTFOLIO VaR SOLVER                           │  │
│  │    • Marginal VaR: MRC_i = \partial VaR / \partial w_i = E[ R_i | R_p <= - HVaR_{99%} ]    │  │
│  │    • Component VaR: CVaR_i = w_i \times MRC_i; \sum CVaR_i = Portfolio VaR (Euler Theorem)│  │
│  │    • Convex Quadratic Optimizer: Minimize Portfolio VaR subject to Delta = 0, Margin <= Cap│  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 Rolling Correlation Matrix with Ledoit-Wolf Shrinkage
To prevent ill-conditioned or singular correlation matrices during periods of market stress, sample returns are adjusted via **Ledoit-Wolf linear shrinkage towards a single-index constant correlation target**.

Let $N$ be the number of active cross-asset instruments and $T$ be the historical observation days ($T = 252$ or $500$).
Let $\mathbf{R} \in \mathbb{R}^{T \times N}$ be the centered daily log-return matrix:
$$R_{t, i} = \ln \left( \frac{P_{t, i}}{P_{t-1, i}} \right) - \bar{R}_i$$

The sample covariance matrix is:
$$\mathbf{S} = \frac{1}{T - 1} \mathbf{R}^T \mathbf{R}$$

The shrinkage target $\mathbf{F}$ is defined with constant pairwise correlation $\bar{\rho} = \frac{2}{N(N-1)} \sum_{i < j} r_{i,j}$:
$$F_{i,i} = S_{i,i}, \quad F_{i,j} = \bar{\rho} \sqrt{S_{i,i} S_{j,j}} \quad (i \neq j)$$

The shrinkage intensity parameter $\delta^* \in [0, 1]$ is estimated analytically via Ledoit-Wolf (2004):
$$\delta^* = \max \left( 0, \min \left( 1, \frac{\hat{\kappa}}{T} \right) \right)$$
$$\mathbf{\Sigma}^* = (1 - \delta^*) \mathbf{S} + \delta^* \mathbf{F}$$

The resulting regularized correlation matrix $\mathbf{P}^* = \mathbf{D}^{-1/2} \mathbf{\Sigma}^* \mathbf{D}^{-1/2}$ is strictly positive definite ($\mathbf{\Sigma}^* \succ 0$), guaranteeing invertibility and numerical stability in portfolio optimization.

#### 3.2 Minimum Variance Hedge Ratio (MVHR) & SEBI Concession Allocator
For any two cross-asset positions (e.g. Target position $Y$ in NIFTY 50 and Hedge position $X$ in MCX Gold or constituent stock futures), the optimal delta-equivalent hedge ratio that minimizes portfolio variance is:
$$\beta^* = \frac{\text{Cov}(R_Y, R_X)}{\text{Var}(R_X)} = \rho_{Y,X} \frac{\sigma_Y}{\sigma_X}$$

##### Eligible SEBI Cross-Margining Pairs:
A cross-asset pair $(Y, X)$ is eligible for regulatory spread concessions if:
1. $\rho_{Y, X} \ge 0.80$ (for positive correlation pairs) or $\rho_{Y, X} \le -0.80$ (for inverse hedging pairs).
2. The positions have opposite economic deltas ($\Delta_Y \times \Delta_X < 0$).
3. The tracking error $\text{TE}_{Y, X} \le 1.5\%$ over 252 trading days.

##### Concession Margin Computation:
Let the initial SPAN margin for leg $Y$ be $M_{\text{SPAN}, Y}$ and leg $X$ be $M_{\text{SPAN}, X}$.
The matched notional value eligible for concession is:
$$V_{\text{matched}} = \min \left( |\text{Notional}_Y \cdot \Delta_Y|, \, |\text{Notional}_X \cdot \Delta_X \cdot \beta^*| \right)$$
$$V_{\text{unmatched}, Y} = |\text{Notional}_Y \cdot \Delta_Y| - V_{\text{matched}}$$
$$V_{\text{unmatched}, X} = |\text{Notional}_X \cdot \Delta_X| - \frac{V_{\text{matched}}}{\beta^*}$$

The statutory spread concession factor $C_{\text{concession}} = 0.75$ (75% concession) is applied to the matched portion:
$$M_{\text{SPAN, matched}} = (1 - C_{\text{concession}}) \times \left( M_{\text{SPAN}, Y} \frac{V_{\text{matched}}}{\text{Notional}_Y} + M_{\text{SPAN}, X} \frac{V_{\text{matched}}/\beta^*}{\text{Notional}_X} \right)$$
$$M_{\text{SPAN, total}} = M_{\text{SPAN, matched}} + M_{\text{SPAN, unmatched, } Y} + M_{\text{SPAN, unmatched, } X}$$

This formulation guarantees that the trader receives an immediate **75% capital relief** on all qualified offsetting exposure.

#### 3.3 Statutory Collateral Haircut Valuation & 50:50 Optimization Solver
Let a trader's pledged demat portfolio contain $K$ assets with market valuations $V_k$ and SEBI haircut schedules $H_k$:

$$\text{Post-Haircut Value } C_k = V_k \times (1 - H_k)$$

Asset classification sets:
* $\mathcal{C}_{\text{cash}}$: Cash INR ($H=0\%$), Central G-Secs & T-Bills ($H=2\%$), Liquid Mutual Funds & Overnight ETFs ($H=10\%$).
* $\mathcal{C}_{\text{non-cash}}$: Sovereign Gold Bonds ($H=15\%$), Group-I Approved Equities ($H=20\%$).

Total available collateral pools:
$$C_{\text{cash, total}} = \sum_{k \in \mathcal{C}_{\text{cash}}} V_k (1 - H_k)$$
$$C_{\text{non-cash, total}} = \sum_{k \in \mathcal{C}_{\text{non-cash}}} V_k (1 - H_k)$$

##### Linear Programming Formulation for Optimal Collateral Allocation:
To maximize trading margin while strictly avoiding cash shortfall interest penalties:
$$\text{Maximize } M_{\text{usable}} = C_{\text{cash, allocated}} + C_{\text{non-cash, allocated}}$$
subject to:
$$0 \le C_{\text{cash, allocated}} \le C_{\text{cash, total}}$$
$$0 \le C_{\text{non-cash, allocated}} \le C_{\text{non-cash, total}}$$
$$C_{\text{non-cash, allocated}} \le C_{\text{cash, allocated}} \quad (\text{SEBI 50:50 Ratio Enforcement})$$
$$C_{\text{cash, allocated}} + C_{\text{non-cash, allocated}} \le M_{\text{total}}$$

If $C_{\text{cash, total}} < 0.50 \times M_{\text{total}}$, the engine alerts the desk to the exact rebalancing action:
$$\text{Rebalance Requirement} = 0.50 \times M_{\text{total}} - C_{\text{cash, total}}$$
The solver generates recommendations to liquidate or switch specific non-cash equities into T-Bills or Liquid ETFs to reach zero interest penalty state.

#### 3.4 Full Revaluation Historical Value-at-Risk ($\text{HVaR}_{99\%}$) & Coherent Expected Shortfall ($\text{CVaR}_{99\%}$)
Standard parametric delta-normal VaR fails catastrophically on non-linear option portfolios because options possess non-zero gamma, vega, and theta. Sprint 23 implements **Full-Revaluation Historical Simulation**:

For each historical date $t \in \{1, \dots, T\}$ ($T = 500$ days), apply the historical vector of multi-asset percentage returns $\mathbf{r}_t = (r_{t, 1}, \dots, r_{t, N})$ to current market underlyings:
$$S_{t, i}^* = S_{0, i} \times (1 + r_{t, i})$$
$$\sigma_{t, i}^* = \max \left( 0.05, \, \sigma_{0, i} + \Delta \text{IV}_{t, i} \right)$$

##### Exact Revaluation of Each Position:
* **Equity / Futures Position $j$:**
  $$V_{j, t}^* = Q_j \cdot S_{t, j}^* \cdot \text{LotSize}_j$$
* **European / American Option Position $j$ (evaluated via Black-Scholes-Merton):**
  $$V_{j, t}^* = Q_j \cdot \text{BSM}\left( S_{t, j}^*, K_j, T_j - \frac{1}{365}, r, \sigma_{t, j}^*, \text{IsCall}_j \right) \cdot \text{LotSize}_j$$

The simulated portfolio loss for historical day $t$ is:
$$\mathcal{L}_t = - \left( \sum_{j=1}^M V_{j, t}^* - \sum_{j=1}^M V_{j, 0} \right)$$

Sort simulated losses in ascending order: $\mathcal{L}_{(1)} \le \mathcal{L}_{(2)} \le \dots \le \mathcal{L}_{(T)}$.

##### 99% 1-Day Historical Value-at-Risk:
$$\text{HVaR}_{99\%} = \mathcal{L}_{(\lceil 0.99 \times T \rceil)}$$
For $T = 500$, $\text{HVaR}_{99\%} = \mathcal{L}_{(495)}$.

##### 99% Coherent Expected Shortfall ($\text{CVaR}_{99\%}$):
Expected Shortfall averages all tail losses exceeding $\text{HVaR}_{99\%}$:
$$\text{CVaR}_{99\%} = \frac{1}{T - \lceil 0.99 T \rceil + 1} \sum_{t = \lceil 0.99 T \rceil}^T \mathcal{L}_{(t)}$$

Because Expected Shortfall is a **coherent risk measure** satisfying convexity and subadditivity:
$$\text{CVaR}(\mathbf{w}_1 + \mathbf{w}_2) \le \text{CVaR}(\mathbf{w}_1) + \text{CVaR}(\mathbf{w}_2)$$
it provides mathematically sound risk aggregation across disparate asset classes.

#### 3.5 Euler Marginal Risk Contribution (MRC) & Risk Decomposition
Under **Euler's Homogeneous Function Theorem**, since Value-at-Risk and Expected Shortfall are homogeneous of degree 1 with respect to portfolio weights ($\text{VaR}(\lambda \mathbf{w}) = \lambda \text{VaR}(\mathbf{w})$):

$$\text{VaR}(\mathbf{w}) = \sum_{i=1}^N w_i \frac{\partial \text{VaR}(\mathbf{w})}{\partial w_i} = \sum_{i=1}^N \text{Component VaR}_i$$

##### Marginal VaR Formulation:
The **Marginal Risk Contribution ($\text{MRC}_i$)** of instrument $i$ represents the rate of change of portfolio risk per unit increase in position weight:
$$\text{MRC}_i = \frac{\partial \text{VaR}}{\partial w_i} = \mathbb{E}\left[ R_i \;\middle|\; R_{\text{portfolio}} = -\text{HVaR}_{99\%} \right]$$

For Expected Shortfall ($\text{CVaR}_{99\%}$):
$$\text{MRC}_{i, \text{CVaR}} = \frac{\partial \text{CVaR}}{\partial w_i} = \mathbb{E}\left[ R_i \;\middle|\; R_{\text{portfolio}} \le -\text{HVaR}_{99\%} \right]$$
$$\text{Component CVaR}_i = w_i \times \text{MRC}_{i, \text{CVaR}}$$
$$\text{Percentage Contribution to Risk (PCR)}_i = \frac{\text{Component CVaR}_i}{\text{Portfolio CVaR}_{99\%}} \times 100$$

##### Economic Interpretation for Risk Desks:
* **$\text{PCR}_i > 0$:** Position increases overall tail risk (Risk Expander).
* **$\text{PCR}_i < 0$:** Position actively reduces portfolio tail risk (Tail Risk Hedge).
* **$\text{PCR}_i = 0$:** Neutral risk diversifier.

#### 3.6 Convex Portfolio Margin & VaR Optimization Solver
To determine the optimal portfolio weights $\mathbf{w}^*$ that minimize total regulatory margin and Expected Shortfall while adhering to capital constraints:

$$\min_{\mathbf{w}} \quad \theta_1 \cdot M_{\text{margin}}(\mathbf{w}) + \theta_2 \cdot \text{CVaR}_{99\%}(\mathbf{w}) + \theta_3 \cdot \|\mathbf{w} - \mathbf{w}_0\|_1 \cdot \text{Cost}_{\text{trade}}$$
subject to:
1. $\sum_{i=1}^N w_i \cdot \Delta_i = \Delta_{\text{target}}$ (Target net market delta, e.g. delta-neutral $\Delta_{\text{target}} = 0$).
2. $w_i^{\min} \le w_i \le w_i^{\max}$ (Position capacity limits).
3. $\sum_{i=1}^N |w_i| \le L_{\max}$ (Gross leverage constraint).
4. $C_{\text{cash}}(\mathbf{w}) \ge 0.50 \times M_{\text{margin}}(\mathbf{w})$ (SEBI 50:50 Cash constraint).

Here $\theta_1, \theta_2, \theta_3 > 0$ are risk-preference hyperparameters balancing margin efficiency, tail risk containment, and transaction costs. The problem is solved via Sequential Quadratic Programming (SQP) or Projected Gradient Descent in the background worker thread.

---

### 4. System Architecture & Cross-Margining Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      INSTITUTIONAL MULTI-ASSET CROSS-MARGINING PIPELINE                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   LIVE PORTFOLIO STATE                                     MARKET & REGULATORY FEEDS             │
│   • NSE Cash Holdings                                      • NSE Tick Stream (LTP, Depth)        │
│   • NSE Index & Stock F&O Legs                             • MCX Commodity Ticks (Gold, Crude)   │
│   • MCX Commodity Positions                                • SEBI Haircut Master Feed            │
│   • Demat Collateral Inventory                             • 500-Day Historical Return Vectors   │
│                   │                                                        │                     │
│                   └──────────────────────────┬─────────────────────────────┘                     │
│                                              │                                                   │
│                                              ▼                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ STAGE 1: ASSET CLASSIFICATION & COLLATERAL VALUATION (< 1.0ms)                            │  │
│   │ • Group-I Equities (20%), G-Secs/T-Bills (2%), Liquid MFs (10%), SGBs (15%), Cash (0%)   │  │
│   │ • Calculate Post-Haircut Values: C_cash and C_non-cash pools                              │  │
│   └──────────────────────────────────────────┬────────────────────────────────────────────────┘  │
│                                              │                                                   │
│                                              ▼                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ STAGE 2: CROSS-ASSET CORRELATION & COINTEGRATION SCANNER (< 2.0ms)                        │  │
│   │ • Compute 252-day Ledoit-Wolf Shrinkage Correlation Matrix (\Sigma^* \succ 0)             │  │
│   │ • Filter Offsetting Pairs with \rho >= 0.80 and Opposite Deltas                           │  │
│   │ • Calculate Minimum Variance Hedge Ratios (\beta^*)                                       │  │
│   └──────────────────────────────────────────┬────────────────────────────────────────────────┘  │
│                                              │                                                   │
│                                              ▼                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ STAGE 3: SEBI CROSS-MARGINING CONCESSION ENGINE (< 1.5ms)                                 │  │
│   │ • Match eligible Index vs Stock F&O and NSE vs MCX Commodity pairs                        │  │
│   │ • Apply 75% SPAN Concession to Matched Notional Exposures                                 │  │
│   │ • Generate Net SPAN + ELM + Addnl Regulatory Margin Obligation                            │  │
│   └──────────────────────────────────────────┬────────────────────────────────────────────────┘  │
│                                              │                                                   │
│                                              ▼                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ STAGE 4: 50:50 CASH-TO-COLLATERAL LP SOLVER (< 1.0ms)                                     │  │
│   │ • Validate: C_cash >= 0.50 \times Required Margin                                         │  │
│   │ • Compute Cash Shortfall \Delta C_shortfall and Daily Interest Burn (18% p.a.)            │  │
│   │ • Generate Optimal Collateral Pledge Rebalancing Plan                                     │  │
│   └──────────────────────────────────────────┬────────────────────────────────────────────────┘  │
│                                              │                                                   │
│                                              ▼                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ STAGE 5: FULL-REVALUATION HISTORICAL VaR & CVaR (500 SCENARIOS) (< 3.0ms)                 │  │
│   │ • Revalue non-linear Options via Black-Scholes vector pricing across 500 historical days  │  │
│   │ • Determine HVaR_{99%} (Scenario 495) and Coherent Expected Shortfall CVaR_{99%}          │  │
│   │ • Compare against Parametric Gaussian VaR (Quantify Fat-Tail Gap)                         │  │
│   └──────────────────────────────────────────┬────────────────────────────────────────────────┘  │
│                                              │                                                   │
│                                              ▼                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ STAGE 6: EULER MARGINAL RISK CONTRIBUTION (MRC) ATTRIBUTION (< 1.5ms)                     │  │
│   │ • Compute Marginal VaR: MRC_i = E[ R_i | Portfolio <= -VaR ]                              │  │
│   │ • Compute Component CVaR_i and Percentage Contribution to Risk (PCR_i)                    │  │
│   │ • Identify Tail Risk Expanders vs Hedges                                                  │  │
│   └──────────────────────────────────────────┬────────────────────────────────────────────────┘  │
│                                              │                                                   │
│                                              ▼                                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ STAGE 7: PORTFOLIO REBALANCING & CAPITAL OPTIMIZATION SOLVER (< 2.0ms)                    │  │
│   │ • Solve Quadratic / Convex Rebalance Weights to Minimize Margin + CVaR                    │  │
│   │ • Enforce Delta Neutrality and Position Leverage Constraints                              │  │
│   └──────────────────────────────────────────┬────────────────────────────────────────────────┘  │
│                                              │                                                   │
│                                              ▼                                                   │
│   DISPATCH METRICS TO INSTITUTIONAL RISK COCKPIT UI (< 12.0ms Total Pipeline Latency)            │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1 Latency Budget & Worker Architecture
To achieve instantaneous interactive execution within the browser without stuttering the user interface:
1. **Dedicated Cross-Margining Web Worker (`crossMargining.worker.ts`):** All matrix operations, 500-day full-revaluation pricing loops, and convex optimization solvers execute concurrently in an isolated Web Worker.
2. **Pre-Allocated Typed Arrays (`Float64Array`):** The 500-day return vectors and covariance matrices use fixed-size typed arrays, eliminating garbage collection pauses during high-frequency market tick updates.
3. **Latency SLA Breakdown:**
   - Asset Classification & Haircut Mark: $\le 1.0\text{ ms}$
   - Shrinkage Correlation Matrix ($N=20$): $\le 2.0\text{ ms}$
   - Cross-Margining Concession Allocation: $\le 1.5\text{ ms}$
   - 50:50 Collateral LP Allocation: $\le 1.0\text{ ms}$
   - 500-Scenario Historical Revaluation: $\le 3.0\text{ ms}$
   - Euler Marginal Risk Attribution: $\le 1.5\text{ ms}$
   - Convex Optimization Rebalance: $\le 2.0\text{ ms}$
   - **Total End-to-End Latency:** $\le 12.0\text{ ms}$ ($p99 < 15.0\text{ ms}$).

---

### 5. Detailed Feature Scope & User Stories

#### 5.1 User Story 1: Multi-Asset Cross-Segment Margin Offset Engine (`TC-CMAR-01`)
* **As a Derivatives Portfolio Manager**, I want the platform to automatically detect offsetting positions between Cash, Index F&O, Stock Futures, and MCX Commodity contracts and apply SEBI 75% spread concessions, so that I maximize capital efficiency and eliminate redundant margin charges.
* **Acceptance Criteria:**
  - Scans active portfolio positions across NSE Cash, NSE F&O, and MCX Commodity segments.
  - Identifies eligible offset combinations based on correlation threshold $\rho \ge 0.80$ (or $\rho \le -0.80$ for inverse hedges) and opposite delta signs.
  - Computes matched notional exposure and applies statutory 75% SPAN concession to the offsetting legs.
  - Displays standalone isolated margin vs cross-margined required margin, showing exact **rupee capital savings** and **margin relief percentage (40% - 65%)**.
  - Dynamically recalculates margin requirements upon real-time tick updates in $< 10\text{ ms}$.

#### 5.2 User Story 2: Commodity & Equity Macro Correlation Hedge Detector (`TC-CMAR-02`)
* **As a Quantitative Macro Strategist**, I want an automated correlation scanner that maps equity beta exposures to MCX commodity contracts (Gold, Crude Oil, Copper), so that I can hedge geopolitical and commodity inflation risk with minimum variance hedge ratios.
* **Acceptance Criteria:**
  - Ingests daily price histories for NSE Equities/Indices and MCX Commodity contracts.
  - Computes rolling 252-day Ledoit-Wolf regularized correlation matrix $\mathbf{\Sigma}^* \succ 0$.
  - Automatically identifies natural macro hedge relationships:
    - Long NIFTY 50 vs Long MCX Gold Futures (safe-haven hedge under tail crises).
    - Long Aviation / Paint Equities (INDIGO, ASIANPAINT) vs Long MCX Crude Oil Futures (input cost cost-push hedge).
    - Long Energy Equities (ONGC, OIL) vs Short MCX Crude Oil Futures (producer revenue hedge).
    - Long Metal Equities (TATASTEEL, HINDALCO) vs Short MCX Copper/Aluminium Futures.
  - Computes the optimal Minimum Variance Hedge Ratio $\beta^* = \rho \frac{\sigma_{\text{equity}}}{\sigma_{\text{commodity}}}$ and recommended contract lot sizing.

#### 5.3 User Story 3: Statutory Collateral Pledge, Haircut & 50:50 Rule Optimizer (`TC-CMAR-03`)
* **As a Treasury & Risk Controller**, I want real-time surveillance of my pledged demat collateral portfolio under SEBI haircut schedules and the 50:50 Cash-to-Collateral rule, so that I avoid 18% p.a. cash shortfall interest penalties.
* **Acceptance Criteria:**
  - Tracks pledged asset inventory across categories:
    - Cash INR ($0\%$ haircut)
    - Central G-Secs & T-Bills ($2\%$ haircut, cash equivalent)
    - Liquid Mutual Funds & Overnight ETFs ($10\%$ haircut, cash equivalent)
    - Sovereign Gold Bonds ($15\%$ haircut, non-cash collateral)
    - Group-I Approved Equities ($20\%$ haircut, non-cash collateral)
  - Calculates live post-haircut collateral pools ($C_{\text{cash}}$ vs $C_{\text{non-cash}}$).
  - Enforces the SEBI 50:50 rule: if $C_{\text{cash}} < 0.50 \times M_{\text{total}}$, immediately flags a **Cash Deficit Alert** and displays the daily interest burn in INR ($\Delta C_{\text{shortfall}} \times 0.05\% / \text{day}$).
  - Executes a linear programming optimizer suggesting the exact rebalancing transactions (e.g. "Switch ₹5,00,000 of Group-I Equities to Liquid ETFs or 91-Day T-Bills") to restore 50:50 compliance and eliminate penalties.

#### 5.4 User Story 4: Historical Simulation VaR 99% & Expected Shortfall (CVaR) Engine (`TC-CMAR-04`)
* **As a Chief Risk Officer (CRO)**, I want a 500-day full-revaluation historical simulation engine that measures portfolio 99% VaR and Expected Shortfall without normality assumptions, so that non-linear option convexities and multi-asset crash correlations are accurately quantified.
* **Acceptance Criteria:**
  - Simulates 500 historical joint return scenarios across all portfolio underlyings.
  - Revalues options positions using the Black-Scholes-Merton model under perturbed spot price and implied volatility conditions.
  - Calculates 1-day 99% Historical Value-at-Risk ($\text{HVaR}_{99\%}$) from the empirical 99th loss quantile (scenario 495 of 500).
  - Calculates 99% Coherent Expected Shortfall ($\text{CVaR}_{99\%}$) as the conditional mean of losses exceeding $\text{HVaR}_{99\%}$.
  - Computes the **Fat-Tail Divergence Gap**:
    $$\text{Tail Gap \%} = \frac{\text{CVaR}_{99\%} - \text{Gaussian VaR}_{99\%}}{\text{Gaussian VaR}_{99\%}} \times 100$$
    highlighting instances where standard risk metrics underestimate tail vulnerability.

#### 5.5 User Story 5: Euler Marginal Risk Contribution (MRC) & Risk Attribution Desk (`TC-CMAR-05`)
* **As an Algorithmic Trader**, I want to inspect the exact Marginal Risk Contribution (MRC) and percentage risk attribution for each instrument in my book, so that I can identify which positions expand tail risk and which act as genuine hedges.
* **Acceptance Criteria:**
  - Evaluates marginal risk contribution $\text{MRC}_i = \mathbb{E}[R_i \mid R_{\text{portfolio}} \le -\text{HVaR}_{99\%}]$ for every position.
  - Computes Component CVaR: $\text{Component CVaR}_i = w_i \times \text{MRC}_i$.
  - Validates Euler's homogeneity theorem: $\sum_{i=1}^N \text{Component CVaR}_i \equiv \text{Portfolio CVaR}_{99\%}$ within numerical tolerance ($< 0.01\%$).
  - Categorizes instruments into:
    - **Risk Expanders:** $\text{PCR}_i > +10\%$ (High contribution to portfolio downside).
    - **Neutral Assets:** $-10\% \le \text{PCR}_i \le +10\%$.
    - **Tail Risk Hedges:** $\text{PCR}_i < -10\%$ (Actively dampens portfolio tail loss).
  - Renders an interactive Euler Risk Waterfall chart displaying risk attribution by asset class and symbol.

#### 5.6 User Story 6: Portfolio VaR & Capital Optimization Solver (`TC-CMAR-06`)
* **As a Quantitative Portfolio Manager**, I want an automated optimization solver that calculates rebalancing weights to minimize clearing margin and tail risk under market delta neutrality constraints, so that my portfolio achieves optimal risk-adjusted returns.
* **Acceptance Criteria:**
  - Formulates and solves the convex quadratic objective function minimizing combined regulatory margin and $\text{CVaR}_{99\%}$.
  - Enforces hard constraints: Net Delta $= 0$, Gross Leverage $\le L_{\max}$, and SEBI 50:50 cash compliance.
  - Incorporates transaction slippage and statutory taxes (STT, GST, Stamp Duty from Sprint 1 `taxEngine.ts`) into the rebalance cost objective.
  - Outputs recommended trade delta orders (`+Qty` / `-Qty`) with projected post-trade margin reduction, VaR reduction, and estimated execution costs.

#### 5.7 User Story 7: Institutional Cross-Margining & Risk Cockpit Terminal UI (`TC-CMAR-07`)
* **As a Desk Head**, I want a unified, institutional dark-mode terminal interface presenting real-time cross-margining concessions, collateral haircut matrices, 50:50 cash ratio alerts, and Euler risk attribution, so that I possess complete capital and risk governance.
* **Acceptance Criteria:**
  - **Summary Banner:** Real-time displays for Total Capital, Margin Required (Isolated vs Cross-Margined), Capital Saved, 50:50 Ratio Status, and Daily Cash Shortfall Penalty Burn.
  - **Cross-Margining Matrix Panel:** Interactive table showing matched pairs (e.g. NIFTY Futures vs MCX Gold / Constituent Stocks), correlation $\rho$, hedge ratio $\beta^*$, and concession savings.
  - **Collateral & Haircut Radar:** Visual breakdown of demat inventory across Cash, G-Secs, Liquid MFs, SGBs, and Equities with post-haircut values and pledge utilization bars.
  - **Tail Risk & Euler Waterfall Visualizer:** Side-by-side display of Historical VaR / CVaR distribution and Euler Component CVaR waterfall chart.
  - **Rebalance & Action Center:** One-click execution button to rebalance collateral or execute recommended hedging orders.

---

### 6. TypeScript Data Models & Contract Specifications

```typescript
// ============================================================================
// TradeCraft AI - Institutional Multi-Asset Cross-Margining & VaR Engine (Sprint 23)
// File: src/types/crossMarginingEngine.ts
// ============================================================================

export type AssetSegment = 'NSE_CASH' | 'NSE_FO' | 'MCX_COMMODITY' | 'CCIL_GSEC';
export type InstrumentClass = 'EQUITY' | 'FUTURES' | 'CALL_OPTION' | 'PUT_OPTION' | 'GSEC_TBILL' | 'LIQUID_MF' | 'SGB';
export type CollateralCategory = 'CASH_EQUIVALENT' | 'NON_CASH_COLLATERAL';

export interface MultiAssetPosition {
  positionId: string;
  symbol: string;
  underlying: string;
  segment: AssetSegment;
  instrumentClass: InstrumentClass;
  quantity: number;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  strikePrice?: number;
  expiryDate?: string;
  impliedVolatility?: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  notionalValue: number;
  standaloneSpanMargin: number;
  standaloneElmMargin: number;
}

export interface DematCollateralItem {
  assetId: string;
  symbol: string;
  isin: string;
  instrumentClass: InstrumentClass;
  quantity: number;
  marketPrice: number;
  grossMarketValue: number;
  sebiHaircutPct: number; // e.g. 0.02 for 2%, 0.10 for 10%, 0.20 for 20%
  postHaircutValue: number;
  category: CollateralCategory;
  isPledged: boolean;
  pledgedQuantity: number;
}

export interface CrossMarginOffsetPair {
  pairId: string;
  targetSymbol: string;
  targetSegment: AssetSegment;
  targetDelta: number;
  hedgeSymbol: string;
  hedgeSegment: AssetSegment;
  hedgeDelta: number;
  rollingCorrelation: number; // \rho >= 0.80 or <= -0.80
  minimumVarianceHedgeRatio: number; // \beta^*
  matchedNotionalValue: number;
  unmatchedNotionalValue: number;
  concessionPct: number; // Statutory 75% or 80%
  marginWithoutOffset: number;
  marginWithOffset: number;
  capitalSavedRupees: number;
}

export interface Collateral5050Report {
  totalRequiredMargin: number;
  eligibleCashCollateral: number; // Cash, G-Secs, T-Bills, Liquid MFs
  eligibleNonCashCollateral: number; // Group-I Equities, SGBs
  cashRatioPct: number; // (eligibleCash / totalRequiredMargin) * 100
  is5050Compliant: boolean;
  cashShortfallDeficit: number; // max(0, 0.50 * totalRequiredMargin - eligibleCash)
  dailyInterestPenaltyRupees: number; // shortfall * 0.18 / 365
  annualizedInterestPenaltyRupees: number; // shortfall * 0.18
  recommendedRebalanceActions: {
    action: 'PLEDGE_CASH' | 'SWITCH_EQUITY_TO_GSEC' | 'PLEDGE_LIQUID_ETF' | 'UNPLEDGE_EQUITY';
    fromAssetSymbol?: string;
    toAssetSymbol?: string;
    suggestedAmountRupees: number;
    penaltyReductionRupees: number;
  }[];
}

export interface HistoricalVaRMetrics {
  historicalScenariosCount: number; // e.g. 500 trading days
  confidenceLevel: number; // 0.99
  timeHorizonDays: number; // 1-day
  parametricGaussianVaR99: number;
  historicalVaR99: number; // HVaR 99%
  coherentExpectedShortfall99: number; // CVaR 99%
  tailDivergenceGapPct: number; // ((CVaR - GaussVaR) / GaussVaR) * 100
  scenarioLossDistribution: {
    scenarioIndex: number;
    date: string;
    simulatedLossRupees: number;
    isTailLoss: boolean; // Loss >= HVaR 99%
  }[];
}

export interface EulerRiskAttributionItem {
  symbol: string;
  underlying: string;
  segment: AssetSegment;
  positionWeight: number; // w_i
  marginalVaR: number; // \partial VaR / \partial w_i
  marginalCVaR: number; // \partial CVaR / \partial w_i
  componentCVaR: number; // w_i * marginalCVaR
  percentageRiskContribution: number; // (componentCVaR / totalCVaR) * 100
  riskCategory: 'RISK_EXPANDER' | 'NEUTRAL' | 'TAIL_RISK_HEDGE';
}

export interface CrossMarginingPortfolioSummary {
  portfolioId: string;
  timestamp: number;
  totalPositionsCount: number;
  grossNotionalValue: number;
  netDelta: number;
  netGamma: number;
  netVega: number;
  isolatedTotalMargin: number;
  crossMarginedTotalMargin: number;
  totalCapitalReliefRupees: number;
  marginReliefPercentage: number;
  offsetPairs: CrossMarginOffsetPair[];
  collateralReport: Collateral5050Report;
  historicalVaR: HistoricalVaRMetrics;
  eulerAttribution: EulerRiskAttributionItem[];
  optimizationRebalanceSuggestion?: {
    suggestedOrders: {
      symbol: string;
      segment: AssetSegment;
      side: 'BUY' | 'SELL';
      quantity: number;
      estimatedCost: number;
      projectedMarginReduction: number;
      projectedVaRReduction: number;
    }[];
    projectedNetCapitalSaved: number;
    netPostTradeDelta: number;
  };
}
```

---

### 7. Institutional UI Cockpit Specification

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TRADECRAFT AI // INSTITUTIONAL CROSS-MARGINING & PORTFOLIO VaR OPTIMIZATION COCKPIT             │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PORTFOLIO VALUE: ₹2,45,00,000 │ ISOLATED MARGIN: ₹84,50,000 │ CROSS-MARGIN: ₹36,20,000 (-57.2%)  │
│ CASH COLLATERAL: ₹22,50,000   │ NON-CASH: ₹42,00,000        │ 50:50 RATIO: 62.1% [COMPLIANT]     │
│ HVaR 99% (1-D):  ₹12,40,000   │ CVaR 99% (ES): ₹18,90,000   │ TAIL GAP: +52.4% (FAT TAIL ALERT)  │
├──────────────────────────────────────┬───────────────────────────────────┬───────────────────────┤
│ 1. SEBI CROSS-MARGINING OFFSETS      │ 2. COLLATERAL & HAIRCUT SCHEDULE  │ 3. 50:50 REGULATORY   │
│ Matched Pairs (Concession: 75%)      │ Pledged Demat Inventory           │    COMPLIANCE MONITOR │
│                                      │                                   │                       │
│ Pair 01: NIFTY Fut vs BANKNIFTY Fut  │ Cash INR:         ₹10,00,000 (0%) │ Req Margin: ₹36,20,000│
│ • Corr \rho: +0.92 | Matched: ₹45L   │ G-Sec (7.18 GS):  ₹12,50,000 (2%) │ Min Cash (50%): ₹18.1L│
│ • Margin Saved: ₹18,40,000           │ Liquid ETF:        ₹5,00,000 (10%)│ Actual Cash:    ₹22.5L│
│                                      │ SGB 2028:         ₹15,00,000 (15%)│ Status: [COMPLIANT]   │
│ Pair 02: NIFTY Long vs Basket Stocks │ Group-I (RELIANCE):₹27,00,000 (20%)│ Penalty Burn: ₹0.00/d │
│ • Corr \rho: +0.88 | Matched: ₹30L   │                                   │                       │
│ • Margin Saved: ₹12,10,000           │ Total Post-Haircut: ₹64,50,000    │ [REBALANCE SOLVER]:   │
│                                      │ Free Unencumbered:  ₹28,30,000    │ (Optimal Inventory)   │
│ Pair 03: ASIANPAINT vs MCX CRUDE     │                                   │ Switch ₹2L Equity to  │
│ • Corr \rho: -0.84 | Matched: ₹18L   │ 4. EULER MARGINAL VaR ATTRIBUTION │ Liquid MF for +12%    │
│ • Margin Saved: ₹7,80,000            │ Symbol     w_i  MRC   PCR% Class  │ Liquidity Buffer.     │
│                                      │ NIFTY FUT  35% 0.42  +44% EXPANDER│                       │
│ TOTAL MARGIN SAVED: ₹38,30,000       │ RELIANCE   25% 0.31  +28% EXPANDER│ [EXECUTE REBALANCE]   │
│ ROC Boost: +48.2% Annualized         │ MCX GOLD   15% -0.22 -14% HEDGE   │                       │
│                                      │ MCX CRUDE  15% -0.18 -12% HEDGE   │ [AUTO-HEDGE SOLVER]   │
│ 500-SCENARIO HVaR / CVaR SIMULATION  │ LIQUIDBEES 10% 0.00   0%  NEUTRAL │ (Target: Delta = 0)   │
│ [████████████████░░░░░░] HVaR: 12.4L │                                   │ Buy 1 Lot MCX Gold    │
│ [██████████████████████] CVaR: 18.9L │ Euler Sum Check: 100.0% (Verified)│ Saves ₹2.4L CVaR      │
└──────────────────────────────────────┴───────────────────────────────────┴───────────────────────┘
```

---

### 8. Non-Functional Requirements & Performance SLAs

1. **Sub-15ms Interactive Execution Latency:**
   - Real-time recalculation of multi-asset cross-margining concessions, 500-scenario historical revaluations, and Euler risk attribution must execute in **$\le 15.0\text{ ms}$** ($p99$).
   - Interactive UI slider updates (haircut or rebalance shifts) must update within **$16.6\text{ ms}$** (60 FPS responsiveness).
2. **Dedicated Background Web Worker (`crossMargining.worker.ts`):**
   - All complex Black-Scholes full-revaluation loops, covariance shrinkage matrix calculations, and convex quadratic programming algorithms execute off the main thread.
   - The React DOM remains completely responsive during heavy quant computations.
3. **Statutory SEBI & Clearing Corporation Precision:**
   - Margining concession formulas must strictly match NCL and MCXCCL published specifications (75% - 80% spread credit for $\rho \ge 0.80$).
   - Collateral haircuts must adhere strictly to statutory floors (Cash 0%, G-Secs/T-Bills 2%, Liquid MFs 10%, SGBs 15%, Group-I Equities 20%).
   - Cash shortfall interest penalty calculation must reflect exact clearing corporation rules ($18.0\%$ p.a. / $0.05\%$ per day on deficit).
4. **Euler Homogeneity & Coherence Assurance:**
   - Marginal Risk Contributions must satisfy Euler's theorem ($\sum w_i \text{MRC}_i \equiv \text{Portfolio VaR}$) with an error bound $< 0.01\%$.
   - Expected Shortfall ($\text{CVaR}_{99\%}$) must strictly satisfy the subadditivity axiom of coherent risk measures.
5. **Zero-Knowledge Client-Side BYOK Security:**
   - All demat asset inventories, broker holdings, API keys, and margin calculations execute strictly on the client side in the user's browser.
   - No sensitive trading book data or private asset allocations are transmitted to any TradeCraft AI server.

---

### 9. Verification & Test Matrix

| Test ID | Test Scenario Description | Expected Input Condition | Expected Result / System Assertion |
| :--- | :--- | :--- | :--- |
| `TC-TEST-CMAR-01` | Index vs Stock Futures Cross-Margining | Long NIFTY 50 Futures + Short constituent stock futures basket ($\rho = 0.88$) | Matched notional receives 75% SPAN margin concession; margin reduced by $> 45\%$ |
| `TC-TEST-CMAR-02` | Ineligible Low-Correlation Pair Rejection | Long NIFTY Futures + Short NIFTY Pharma Futures ($\rho = 0.54 < 0.80$) | System rejects cross-margin spread concession; charges standalone isolated margin |
| `TC-TEST-CMAR-03` | Cross-Exchange Commodity Hedge (ASIANPAINT vs MCX Crude) | Long ASIANPAINT Equities + Long MCX Crude Oil Futures ($\rho = -0.84$) | Qualifies as economic inverse hedge; allocates minimum variance hedge ratio $\beta^*$ with 75% concession |
| `TC-TEST-CMAR-04` | Statutory Collateral Haircut Valuation | Portfolio: ₹10L Cash, ₹10L G-Secs, ₹10L Liquid MF, ₹10L SGB, ₹10L Group-I Equity | Accurately calculates post-haircut values: Cash ₹10L (0%), G-Sec ₹9.8L (2%), MF ₹9.0L (10%), SGB ₹8.5L (15%), Equity ₹8.0L (20%) |
| `TC-TEST-CMAR-05` | 50:50 Cash-to-Collateral Deficit Detection | Total Margin Req: ₹40,00,000. Cash Pool: ₹12,00,000. Non-Cash Pool: ₹35,00,000 | Flags `is5050Compliant: false`; identifies cash shortfall of ₹8,00,000 and daily penalty burn of ₹394.52/day (18% p.a.) |
| `TC-TEST-CMAR-06` | 50:50 LP Rebalancing Solver Recommendation | Cash Shortfall of ₹8,00,000 with excess pledged Group-I equities | Recommends switching ₹10,00,000 of Group-I equities into Liquid MFs / T-Bills to eliminate the penalty |
| `TC-TEST-CMAR-07` | Ledoit-Wolf Shrinkage Positive Semi-Definiteness | High-dimensional collinear return series ($N = 25$ assets, near-singular sample matrix) | Regularized matrix $\mathbf{\Sigma}^* \succ 0$ with minimum eigenvalue $\lambda_{\min} > 10^{-6}$; invertible |
| `TC-TEST-CMAR-08` | Full Revaluation 500-Day Historical VaR | Portfolio of Long NIFTY Futures + Short ATM Straddle over 500 trading days | Evaluates Black-Scholes pricing on each historical day; identifies Scenario 495 loss as $\text{HVaR}_{99\%}$ |
| `TC-TEST-CMAR-09` | Coherent Expected Shortfall (CVaR 99%) Calculation | Historical crash distribution containing 2020 COVID and 2024 Election gap days | Computes $\text{CVaR}_{99\%}$; verifies $\text{CVaR}_{99\%} > \text{HVaR}_{99\%}$ and captures tail divergence gap ($> 40\%$) |
| `TC-TEST-CMAR-10` | Euler Homogeneity Theorem Verification | Multi-asset portfolio with 8 active instruments | Calculates Component CVaR for all 8 legs; verifies $\sum_{i=1}^8 \text{Component CVaR}_i = \text{Portfolio CVaR}_{99\%}$ within $0.005\%$ error |
| `TC-TEST-CMAR-11` | Risk Expander vs Tail Hedge Classification | Portfolio containing Long NIFTY Futures and Long MCX Gold Futures | Correctly classifies NIFTY Futures as `RISK_EXPANDER` ($\text{PCR} > 0$) and MCX Gold as `TAIL_RISK_HEDGE` ($\text{PCR} < 0$) |
| `TC-TEST-CMAR-12` | Convex Portfolio Margin & VaR Rebalancer | Portfolio with high directional delta ($\Delta = +450$) and high margin burden | Solves for rebalance delta orders achieving $\Delta = 0$, reducing margin by $\ge 30\%$ and CVaR by $\ge 25\%$ |
| `TC-TEST-CMAR-13` | Execution Latency Benchmark | Full 500-scenario revaluation + Euler attribution + LP collateral solver | Total worker calculation completes in $\le 12.0\text{ ms}$ without UI stutter |
| `TC-TEST-CMAR-14` | Client-Side Zero Data Leakage | Inspect browser network telemetry during risk simulation | Zero HTTP requests transmitting portfolio weights, positions, or margin metrics |

---
