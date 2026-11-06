# Business Requirements Document (BRD) - Sprint 22

## Feature ID: `BRD-022`
## Feature Title: High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk (SPAN Margin, EVT Expected Shortfall & SEBI Volatility Circuit Breakers)
**Author:** Researcher Lead (Autonomous Multi-Agent Cycle)  
**Date:** 2026-11-06  
**Status:** `APPROVED FOR IMPLEMENTATION`  
**Target Milestone:** Sprint 22  
**Dependencies:**
- Sprint 1 (`taxEngine.ts` — Indian Statutory Taxes, SEBI STT, GST)
- Sprint 2 (`optionsEngine.ts` — Black-Scholes Formula, Implied Volatility & Greeks)
- Sprint 4 (`marketDepth.ts` — Level-2 Market Depth & Order Ladder)
- Sprint 13 (`greeksHedgerEngine.ts` — Delta-Gamma Neutral Hedging)
- Sprint 14 (`volatilitySurfaceEngine.ts`, `optionsOptimizerEngine.ts` — Surface Calibration & Payoff Optimization)
- Sprint 17 (`executionEngine.ts` — VWAP/TWAP & Microstructure Slippage Minimizer)
- Sprint 20 (`fixEngine.ts` — Institutional Drop-Copy & FIX Execution Gateway)
- Sprint 21 (`volatilityDispersionEngine.ts` — Real-Time Options Dispersion & Skew Hedging Engine)

---

### 1. Executive Summary & Problem Statement

#### 1.1 Context
In modern institutional quantitative trading, execution speed without deterministic pre-trade risk validation is a catastrophic liability. In the Indian equity and derivatives ecosystem governed by the **Securities and Exchange Board of India (SEBI)** and cleared by the **NSE Clearing Limited (NCL)**, algorithmic desks operate under stringent regulatory mandates, complex capital adequacy frameworks, and ultra-fast market dynamics.

Derivatives on the National Stock Exchange of India (NSE)—predominantly **NIFTY 50**, **BANKNIFTY**, and single-stock futures and options—employ the **Standard Portfolio Analysis of Risk (SPAN)** methodology. Margin calculations require multi-scenario stress-testing of portfolios against underlying price shifts and implied volatility jumps in real time. Concurrently, SEBI enforces stringent surveillance mechanisms, including intraday peak margin snapshots, **Market-Wide Position Limits (MWPL)** with mandatory F&O ban periods, aggressive **Order-to-Trade Ratio (OTR)** fiscal penalties, and market-wide volatility circuit breaker halts (10%, 15%, and 20%).

#### 1.2 Problem Statement
While Tier-1 proprietary desks and institutional prime brokers utilize specialized risk servers (such as ION Fidessa, Bloomberg TOMS, or in-house C++ risk daemons) to inspect order validity within sub-millisecond thresholds, retail algorithmic traders, prop-firm retail candidates, and transitioning quant developers on retail platforms (Zerodha Kite, Upstox, Groww, Interactive Brokers India) suffer from critical vulnerabilities:

1. **Opaque & Lagging Margin Estimations:** Standard retail broker APIs provide static, coarse margin estimates. Traders cannot simulate the exact 16-scenario SPAN risk array, the impact of multi-leg basket orders on portfolio scanning risk, or inter-month spread credits before hitting the exchange, resulting in unexpected margin rejection errors (`RMS:Margin Exceeded`).
2. **Normal Distribution Blindness in Tail Risk (VaR Failure):** Traditional risk systems rely on Gaussian Value-at-Risk ($\text{VaR}_{99\%}$). When black-swan events, flash crashes, or election-day gap downs occur (e.g., March 2020 COVID meltdown, June 2024 Lok Sabha election swing), standard VaR underestimates tail losses by $300\% - 500\%$. Desks lack **Extreme Value Theory (EVT)** Expected Shortfall ($\text{CVaR}_{99\%}$) powered by Generalized Pareto Distribution (GPD) modeling of fat tails.
3. **F&O Ban Traps & MWPL Penalties:** When a stock derivative breaches $95\%$ of MWPL, SEBI places it in the F&O Ban period where only unwinding orders are allowed. Algorithmic strategies oblivious to live MWPL utilization continue submitting directional or spread orders, incurring SEBI financial penalties (₹1,00,000+ per violation) or immediate order rejections.
4. **Order-to-Trade Ratio (OTR) Penalties & Rate Throttling:** Rapid algorithmic re-quoting, order modifications, and cancellations trigger severe NSE OTR penalty tiers (up to 5 paise per unexecuted order for high OTRs). Retail quants have no client-side token-bucket leaky-rate throttling or OTR defense shields.
5. **Fat-Finger Orders & Circuit Breaker Blindness:** Traders operating multi-leg execution bots frequently suffer catastrophic slippage due to fat-finger limits or attempting fills during market-wide trading halts (SEBI 10%, 15%, 20% circuit breaks) or when illiquid deep OTM strikes trade outside dynamic price operating bands.

#### 1.3 Solution & Business Objectives
TradeCraft AI Sprint 22 establishes the industry's first browser-native, ultra-low-latency (< 5ms) **High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk**:
* **Deterministic Indian SPAN-Equivalent Margin Grid Engine:** Implements the complete 16-scenario price/volatility risk array ($-3\sigma$ to $+3\sigma$ across 7 price steps, combined with $\pm 4\%$ volatility shocks, plus 2 extreme move tail scenarios), calculating scanning risk, inter-month spread charges, Short Option Minimum (SOM) charges, and SEBI Extreme Loss Margin (ELM).
* **Extreme Value Theory (EVT) Tail Risk Engine:** Uses Peaks-Over-Threshold (POT) fitted to Generalized Pareto Distribution (GPD) tails to calculate institutional Expected Shortfall ($\text{ES}_{99\%} / \text{CVaR}_{99\%}$) and simulate catastrophic historical market crash replays.
* **SEBI Market-Wide Position Limits (MWPL) & Ban Guardian:** Live tracking of stock and index derivative open interest against MWPL thresholds ($95\%$ ban entry, $80\%$ ban exit, and client-level $5\%$ limits), automatically blocking any position-increasing order in banned underlying assets.
* **Algorithmic Dynamic Order Throttler & OTR Penalty Shield:** Dual-stage Token Bucket / Leaky Bucket rate limiter tracking orders/sec and instantaneous Order-to-Trade Ratio, actively throttling cancellation storms and protecting against exchange penalties.
* **SEBI Circuit Breaker & Fat-Finger Protection:** Real-time state machine tracking market-wide circuit thresholds (10%, 15%, 20% index halts with time-of-day cooling period rules) and dynamic Black-Scholes price operating bands to reject out-of-bounds orders.
* **Interactive Institutional Risk Cockpit UI:** Dark-mode high-frequency monitoring terminal featuring 3D SPAN loss surfaces, EVT tail quantile plots, MWPL utilization dials, order rate sparklines, and one-click manual emergency circuit breakers.

---

### 2. Regulatory & Market Framework (SEBI & NSE Clearing)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       SEBI & NSE PRE-TRADE REGULATORY RISK LANDSCAPE                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  [ CLIENT ORDER INTENT ] ──► [ PRE-TRADE RISK ENGINE (GATEWAY < 5ms) ]                      │
│                                    │                                                        │
│   ┌────────────────────────────────┼────────────────────────────────────────┐               │
│   │ Check 1: Fat-Finger & Price    │ Operating Band: Ref Price ± 10%-20%   │               │
│   ├────────────────────────────────┼────────────────────────────────────────┤               │
│   │ Check 2: SEBI Volatility Halt  │ Circuit Breakers: 10%, 15%, 20% Halts  │               │
│   ├────────────────────────────────┼────────────────────────────────────────┤               │
│   │ Check 3: MWPL & F&O Ban        │ MWPL >= 95% (Exit Only), Client <= 5%  │               │
│   ├────────────────────────────────┼────────────────────────────────────────┤               │
│   │ Check 4: Rate Limiter & OTR    │ Leaky Bucket (Max msg/s, OTR < 500)    │               │
│   ├────────────────────────────────┼────────────────────────────────────────┤               │
│   │ Check 5: SPAN & Peak Margin    │ 16-Scenario Risk Array + ELM + SOM     │               │
│   ├────────────────────────────────┼────────────────────────────────────────┤               │
│   │ Check 6: EVT Fat-Tail ES 99%   │ Generalized Pareto Tail Stress Test    │               │
│   └────────────────────────────────┼────────────────────────────────────────┘               │
│                                    │                                                        │
│                    ┌───────────────┴───────────────┐                                        │
│                    ▼                               ▼                                        │
│            [ REJECT / ALERT ]              [ DISPATCH ORDER ]                               │
│        (RMS Code, Reason, Penalty)        (Paper Engine / FIX 4.4)                          │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1 SEBI Peak Margin Norms
Under SEBI circulars, clearing corporations take **4 intraday snapshots** of client portfolio margins at predetermined, randomly chosen intervals during market hours. Clearing members and brokers must collect $100\%$ of the minimum upfront margin (SPAN + ELM) based on these peak snapshots. Any shortfall attracts severe penalties ranging from $0.5\%$ to $5\%$ of the deficit per day. The Pre-Trade Risk Engine continuously computes instantaneous portfolio peak margin to guarantee zero shortfall before dispatching incremental orders.

#### 2.2 Market-Wide Position Limits (MWPL) & Ban Enforcement
SEBI circulars mandate:
* **Total MWPL Calculation:** For single-stock derivatives, MWPL is set at the lower of:
  $$\text{MWPL} = \min \left( 30 \times \text{ADTV}_{\text{prev month}}, 0.20 \times \text{Free Float Number of Shares} \right)$$
* **F&O Ban Entry:** When aggregate open interest across all futures and options contracts for an underlying reaches or exceeds **$95\%$** of MWPL at the end of trading, the security is placed in the F&O Ban list for the next session.
* **F&O Ban Exit:** A security is removed from the ban list only when its aggregate open interest drops below **$80\%$** of MWPL.
* **Trading Restrictions During Ban:** Any market participant initiating a new position or increasing existing open position in a banned security commits a regulatory violation. Only transactions that reduce/unwind open positions are permitted. Violators face exchange fines (₹1,00,000 per instance or $1\%$ of the traded value).
* **Client-Level Limit:** No single client / Non-Promoter entity may hold gross open positions exceeding **$5\%$ of MWPL** for stock derivatives, or $1\%$ of total free float.

#### 2.3 NSE Order-to-Trade Ratio (OTR) Penalty Framework
To prevent market clutter, exchange infrastructure abuse, and high-frequency quote spamming, NSE imposes daily fiscal penalties on algorithmic trading members based on their daily OTR:
$$\text{OTR} = \frac{\text{Total Orders Entered} + \text{Total Orders Modified} + \text{Total Orders Cancelled}}{\text{Total Orders Executed (Trades)}}$$

| Daily OTR Range | Trades < 100 | Trades 100 to 500 | Trades > 500 | Penalty per Unexecuted Order |
| :--- | :--- | :--- | :--- | :--- |
| **OTR < 50** | No Penalty | No Penalty | No Penalty | ₹0.00 |
| **50 $\le$ OTR < 250** | Warning | Warning | Warning | ₹0.00 |
| **250 $\le$ OTR < 500** | Fine Tier 1 | Fine Tier 1 | Warning | ₹0.01 per order |
| **500 $\le$ OTR < 1000** | Fine Tier 2 | Fine Tier 2 | Fine Tier 1 | ₹0.05 per order |
| **OTR $\ge$ 1000** | Engine Throttled | Engine Throttled | Fine Tier 2 | ₹0.20 per order + Algo Suspension |

#### 2.4 SEBI Market-Wide Volatility Circuit Breakers
The index circuit breaker system applies at 3 stages of index movement (NIFTY 50 or S&P BSE SENSEX) calculated on the previous day's closing level: **$10\%$**, **$15\%$**, and **$20\%$**.

| Trigger Level | Time of Trigger (IST) | Trading Halt Duration | Pre-Open Re-opening Session | Total Halt Duration |
| :---: | :---: | :---: | :---: | :---: |
| **10%** | Before 1:00 PM | 45 Minutes | 15 Minutes | 60 Minutes |
| **10%** | 1:00 PM to 2:30 PM | 15 Minutes | 15 Minutes | 30 Minutes |
| **10%** | At or after 2:30 PM | No Halt | N/A | 0 Minutes |
| **15%** | Before 1:00 PM | 1 Hour 45 Minutes | 15 Minutes | 2 Hours |
| **15%** | 1:00 PM to 2:00 PM | 45 Minutes | 15 Minutes | 1 Hour |
| **15%** | At or after 2:00 PM | Remainder of Day | N/A | Market Closed |
| **20%** | Any time during day | Remainder of Day | N/A | Market Closed |

---

### 3. Quantitative & Mathematical Formulations

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          PRE-TRADE QUANTITATIVE RISK FORMULATION                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. SPAN 16-SCENARIO GRID SIMULATION                                                   │  │
│  │    • Price Scan Range (PSR): ±3.0 sigma across 7 steps (-1, -2/3, -1/3, 0, 1/3, 2/3, 1)│  │
│  │    • Volatility Scan Range (VSR): ±4.0% Implied Volatility Shift                      │  │
│  │    • Scenarios 1-14: Combinations of [Delta S_step] x [Delta IV_shift]               │  │
│  │    • Scenarios 15-16: Extreme Moves (±2.0 PSR = ±6 sigma) scaled by 35% Weight        │  │
│  │    • Scanning Risk: S_risk = max(-Delta Portfolio PnL across 16 scenarios)            │  │
│  │    • Margin = S_risk + Calendar_Charge + SOM + ELM - Spread_Credit                   │  │
│  └──────────────────────────────────────────┬────────────────────────────────────────────┘  │
│                                             │                                               │
│                                             ▼                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. EXTREME VALUE THEORY (EVT) FAT-TAIL EXPECTED SHORTFALL (CVaR 99%)                  │  │
│  │    • Peaks-Over-Threshold (POT) at high loss threshold u (95th percentile)           │  │
│  │    • GPD CDF: G_{xi, beta}(y) = 1 - (1 + xi * y / beta)^(-1/xi)                      │  │
│  │    • Shape Parameter xi (xi > 0 = Fréchet fat-tail) & Scale beta via MLE              │  │
│  │    • EVT-VaR_alpha = u + (beta / xi) * [ ( (N / N_u) * (1 - alpha) )^(-xi) - 1 ]     │  │
│  │    • EVT-ES_alpha = ( VaR_alpha / (1 - xi) ) + ( (beta - xi * u) / (1 - xi) )        │  │
│  └──────────────────────────────────────────┬────────────────────────────────────────────┘  │
│                                             │                                               │
│                                             ▼                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. DYNAMIC ORDER THROTTLING & LEAKY BUCKET CONTROLLER                                │  │
│  │    • Capacity C_tokens, Leak Rate R_leak = 25 tokens/second                           │  │
│  │    • Cost per Action: New Order = 1, Modify = 2, Cancel = 3                           │  │
│  │    • OTR Metric: OTR_inst = (Orders + Modifies + Cancels) / Trades                    │  │
│  │    • Threshold Throttling: When OTR > 250, enforce dynamic delay Delta t_delay        │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 Indian SPAN-Equivalent 16-Scenario Grid Formulation
Let a derivative portfolio consist of $M$ positions where position $j \in \{1, \dots, M\}$ has signed quantity $Q_j$ (positive for long, negative for short) in underlying contract $S$ with time to expiration $T_j$.

The **Price Scan Range (PSR)** defines the maximum expected single-day price movement at a $99\%$ confidence interval:
$$\text{PSR} = 3.0 \times \sigma_{\text{daily}} \times S = 3.0 \times \left( \frac{\sigma_{\text{annual}}}{\sqrt{252}} \right) \times S$$

The **Volatility Scan Range (VSR)** defines the maximum expected instantaneous shift in implied volatility:
$$\text{VSR} = \Delta \sigma = \pm 0.04 \quad (\pm 4.0\% \text{ absolute IV shift})$$

The SPAN engine constructs a discrete 16-scenario risk grid $(\Delta S_k, \Delta \sigma_k, W_k)$ for $k \in \{1, \dots, 16\}$:

| Scenario $k$ | Price Shift Description | $\Delta S_k$ | Volatility Shift $\Delta \sigma_k$ | Loss Weight $W_k$ |
| :---: | :---: | :---: | :---: | :---: |
| **1** | Price Unchanged, Volatility Up | $0$ | $+\text{VSR} (+4\%)$ | $1.00$ |
| **2** | Price Unchanged, Volatility Down | $0$ | $-\text{VSR} (-4\%)$ | $1.00$ |
| **3** | Price Up 1/3 Range, Volatility Up | $+ \frac{1}{3} \text{PSR} (+1\sigma)$ | $+\text{VSR} (+4\%)$ | $1.00$ |
| **4** | Price Up 1/3 Range, Volatility Down | $+ \frac{1}{3} \text{PSR} (+1\sigma)$ | $-\text{VSR} (-4\%)$ | $1.00$ |
| **5** | Price Down 1/3 Range, Volatility Up | $- \frac{1}{3} \text{PSR} (-1\sigma)$ | $+\text{VSR} (+4\%)$ | $1.00$ |
| **6** | Price Down 1/3 Range, Volatility Down | $- \frac{1}{3} \text{PSR} (-1\sigma)$ | $-\text{VSR} (-4\%)$ | $1.00$ |
| **7** | Price Up 2/3 Range, Volatility Up | $+ \frac{2}{3} \text{PSR} (+2\sigma)$ | $+\text{VSR} (+4\%)$ | $1.00$ |
| **8** | Price Up 2/3 Range, Volatility Down | $+ \frac{2}{3} \text{PSR} (+2\sigma)$ | $-\text{VSR} (-4\%)$ | $1.00$ |
| **9** | Price Down 2/3 Range, Volatility Up | $- \frac{2}{3} \text{PSR} (-2\sigma)$ | $+\text{VSR} (+4\%)$ | $1.00$ |
| **10** | Price Down 2/3 Range, Volatility Down | $- \frac{2}{3} \text{PSR} (-2\sigma)$ | $-\text{VSR} (-4\%)$ | $1.00$ |
| **11** | Price Up 3/3 Range, Volatility Up | $+ 1.0 \text{PSR} (+3\sigma)$ | $+\text{VSR} (+4\%)$ | $1.00$ |
| **12** | Price Up 3/3 Range, Volatility Down | $+ 1.0 \text{PSR} (+3\sigma)$ | $-\text{VSR} (-4\%)$ | $1.00$ |
| **13** | Price Down 3/3 Range, Volatility Up | $- 1.0 \text{PSR} (-3\sigma)$ | $+\text{VSR} (+4\%)$ | $1.00$ |
| **14** | Price Down 3/3 Range, Volatility Down | $- 1.0 \text{PSR} (-3\sigma)$ | $-\text{VSR} (-4\%)$ | $1.00$ |
| **15** | Extreme Move Up (Double PSR) | $+ 2.0 \text{PSR} (+6\sigma)$ | $0\%$ | **$0.35$** |
| **16** | Extreme Move Down (Double PSR) | $- 2.0 \text{PSR} (-6\sigma)$ | $0\%$ | **$0.35$** |

##### Valuation & Portfolio Loss Evaluation
For each instrument $j$, its theoretical option or futures price under scenario $k$ is evaluated using the Black-Scholes-Merton model $V_j(S + \Delta S_k, K_j, T_j, r, \sigma_j + \Delta \sigma_k)$:
$$\Delta V_{j,k} = V_j(S + \Delta S_k, \sigma_j + \Delta \sigma_k) - V_j(S, \sigma_j)$$

The net scenario loss for the portfolio under scenario $k$ is:
$$\mathcal{L}_k = - \sum_{j=1}^M Q_j \cdot \Delta V_{j,k} \cdot \text{LotSize}_j$$
For extreme move scenarios ($k = 15, 16$), the covered loss is scaled by the regulatory weight factor:
$$\mathcal{L}_{15}^* = 0.35 \times \mathcal{L}_{15}, \quad \mathcal{L}_{16}^* = 0.35 \times \mathcal{L}_{16}$$

The **Scanning Risk ($S_{\text{risk}}$)** is the maximum loss across all 16 scenarios:
$$S_{\text{risk}} = \max \left( \max_{k=1,\dots,14} \mathcal{L}_k, \, \mathcal{L}_{15}^*, \, \mathcal{L}_{16}^*, \, 0 \right)$$

##### Additional Regulatory Margin Layers
1. **Intra-Commodity / Calendar Spread Charge ($C_{\text{spread}}$):**
   For offsetting delta positions across different expiry months $T_A$ and $T_B$, basis risk exists due to non-parallel shifts in term structure:
   $$C_{\text{spread}} = \sum \min \left( |\Delta_{\text{near}}|, |\Delta_{\text{far}}| \right) \times S \times \text{Spread Charge Rate} \quad (\text{typically } 0.5\% \text{ of notional})$$
2. **Short Option Minimum (SOM) Charge ($C_{\text{som}}$):**
   Deep out-of-the-money short options carry virtually zero delta and zero initial margin under mild scenarios, but catastrophic non-linear exposure in tail spikes. A regulatory floor is enforced:
   $$C_{\text{som}} = \sum_{j \in \text{Short Options}} |Q_j| \times \text{LotSize}_j \times S \times r_{\text{som}} \quad (\text{where } r_{\text{som}} = 0.5\% \text{ for Index, } 1.0\% \text{ for Stocks})$$
3. **Extreme Loss Margin (ELM) ($C_{\text{elm}}$):**
   Mandated by SEBI to cushion against moves exceeding the scan range:
   $$C_{\text{elm}} = \sum_{j=1}^M |Q_j| \times \text{LotSize}_j \times S \times r_{\text{elm}} \quad (\text{where } r_{\text{elm}} = 3.5\% \text{ for NIFTY/BANKNIFTY, } 5.0\% \text{ for Stock F&O})$$
4. **Total Upfront SPAN Margin Required ($M_{\text{SPAN}}$):**
   $$M_{\text{SPAN}} = S_{\text{risk}} + C_{\text{spread}} + C_{\text{som}} + C_{\text{elm}} - \text{InterCommodityCredit}$$

#### 3.2 Extreme Value Theory (EVT) & Generalized Pareto Distribution (GPD)
Standard risk metrics assume returns follow a normal distribution $R \sim \mathcal{N}(\mu, \sigma^2)$, which grossly underestimates kurtosis and tail risk (the "Black Swan" fallacy). Under **Extreme Value Theory**, the **Pickands–Balkema–de Haan Theorem** states that for an arbitrary continuous distribution $F(x)$, the conditional excess distribution of losses $X$ over a sufficiently high threshold $u$:
$$F_u(y) = P(X - u \le y \mid X > u) = \frac{F(u + y) - F(u)}{1 - F(u)}$$
asymptotically converges to the **Generalized Pareto Distribution (GPD)**:
$$G_{\xi, \beta}(y) = \begin{cases} 
1 - \left( 1 + \frac{\xi y}{\beta} \right)^{-1/\xi} & \text{if } \xi \neq 0 \\ 
1 - \exp\left( - \frac{y}{\beta} \right) & \text{if } \xi = 0 
\end{cases}$$
where:
* $\xi \in \mathbb{R}$ is the **Shape Parameter (Tail Index)**:
  - $\xi > 0$: **Fréchet distribution** (Fat, polynomial heavy tails; typical for equity returns during crashes where $\xi \approx 0.15 - 0.35$).
  - $\xi = 0$: **Gumbel distribution** (Exponential thin tails; normal / log-normal).
  - $\xi < 0$: **Weibull distribution** (Finite upper endpoint; bounded losses).
* $\beta > 0$ is the **Scale Parameter**.
* $y = X - u \ge 0$ represents the magnitude of the excess loss over threshold $u$.

##### Peaks-Over-Threshold (POT) Parameter Estimation
Given a historical sample of $N$ daily or high-frequency portfolio return losses $\{x_1, x_2, \dots, x_N\}$, set threshold $u$ at the $95\text{th}$ empirical loss percentile ($u = \text{Quantile}_{0.95}(X)$).
Let $N_u$ be the number of observations exceeding $u$, and define excess losses $y_i = x_i - u > 0$ for $i \in \{1, \dots, N_u\}$.

The parameters $(\xi, \beta)$ are estimated via **Maximum Likelihood Estimation (MLE)** by maximizing the log-likelihood function:
$$\ln L(\xi, \beta) = -N_u \ln \beta - \left( 1 + \frac{1}{\xi} \right) \sum_{i=1}^{N_u} \ln \left( 1 + \frac{\xi y_i}{\beta} \right)$$
subject to $1 + \frac{\xi y_i}{\beta} > 0$ for all $i$.
For fat tails, the initial seed is calibrated via the **Hill Estimator**:
$$\hat{\xi}_{\text{Hill}} = \frac{1}{N_u} \sum_{i=1}^{N_u} \ln \left( \frac{x_{(N - i + 1)}}{u} \right)$$

##### Semi-Parametric Value-at-Risk ($\text{VaR}_\alpha$)
By combining the empirical distribution of observations below threshold $u$ with the parametric GPD tail above $u$, the unconditional cumulative distribution is:
$$F(x) = 1 - \frac{N_u}{N} \left( 1 + \frac{\xi (x - u)}{\beta} \right)^{-1/\xi}$$
Inverting $F(x) = \alpha$ yields the **EVT Value-at-Risk** at confidence level $\alpha$ (e.g., $\alpha = 0.99$ or $0.999$):
$$\text{VaR}_\alpha = u + \frac{\beta}{\xi} \left[ \left( \frac{N}{N_u} (1 - \alpha) \right)^{-\xi} - 1 \right]$$

##### Extreme Value Theory Expected Shortfall ($\text{ES}_\alpha$ / $\text{CVaR}_\alpha$)
Expected Shortfall measures the expected portfolio loss conditional on the loss exceeding $\text{VaR}_\alpha$:
$$\text{ES}_\alpha = \mathbb{E}[X \mid X > \text{VaR}_\alpha] = \text{VaR}_\alpha + \mathbb{E}[X - \text{VaR}_\alpha \mid X > \text{VaR}_\alpha]$$
Exploiting the threshold-stability property of the Generalized Pareto Distribution:
$$\mathbb{E}[X - \text{VaR}_\alpha \mid X > \text{VaR}_\alpha] = \frac{\beta + \xi (\text{VaR}_\alpha - u)}{1 - \xi} \quad (\text{for } \xi < 1)$$
Substituting and simplifying produces the closed-form **EVT Expected Shortfall formula**:
$$\text{ES}_\alpha = \frac{\text{VaR}_\alpha}{1 - \xi} + \frac{\beta - \xi u}{1 - \xi}$$
Unlike $\text{VaR}_\alpha$, Expected Shortfall is a strictly **Coherent Risk Measure** satisfying subadditivity:
$$\text{ES}_\alpha(A + B) \le \text{ES}_\alpha(A) + \text{ES}_\alpha(B)$$
This prevents false diversification incentives and accurately penalizes deep out-of-the-money tail-risk structures.

#### 3.3 Market-Wide Position Limit (MWPL) Analytics
For each active equity derivative under surveillance:
$$\text{MWPL \%} = \frac{\text{Aggregated Open Interest Across All Contracts}}{\text{SEBI Published MWPL}} \times 100$$
Where:
$$\text{Aggregated OI} = \sum_{\text{Expiries}} \left( \text{OI}_{\text{FUT}} + \sum_{K} \text{OI}_{K, \text{CE}} + \sum_{K} \text{OI}_{K, \text{PE}} \right)$$

##### State Transition Automaton:
* `NORMAL`: $\text{MWPL \%} < 85.0\%$ $\rightarrow$ Full trading permitted.
* `WARNING`: $85.0\% \le \text{MWPL \%} < 95.0\%$ $\rightarrow$ Amber alert; traders cautioned; algorithmic position scaling throttled.
* `BAN_ENTER`: $\text{MWPL \%} \ge 95.0\%$ at session close $\rightarrow$ Enters F&O Ban for next trading day.
* `IN_BAN`: Stock is on NSE official Ban list. **Hard rule:**
  $$\Delta \text{Position} \cdot \text{Sign}(\text{Existing Position}) \le 0$$
  Any order with $\text{Quantity} \times \text{Position} > 0$ (increasing gross exposure) is immediately **HARD-REJECTED** prior to broker submission.
* `BAN_EXIT`: $\text{MWPL \%} < 80.0\%$ at session close $\rightarrow$ Security exits ban for next session.

#### 3.4 Dynamic Order Throttling & Leaky Bucket Formulation
To protect against runaway algorithmic loops, quote spamming, and exchange OTR penalties, the pre-trade gateway implements a **Continuous Token Bucket with Leaky Drain Rate**:
* Maximum Bucket Capacity: $B_{\max} = 100 \text{ tokens}$
* Inflow / Refill Rate: $R_{\text{refill}} = 25 \text{ tokens/second}$
* Token Costs:
  - New Order Placement: $C_{\text{new}} = 1 \text{ token}$
  - Order Modification: $C_{\text{mod}} = 2 \text{ tokens}$
  - Order Cancellation: $C_{\text{cancel}} = 3 \text{ tokens}$

If available tokens $B(t) < C_{\text{action}}$, the order is queued or rejected with status `RMS_RATE_LIMIT_EXCEEDED`.

##### Real-Time OTR Penalty Guardian
Let $N_{\text{orders}}(t)$, $N_{\text{mod}}(t)$, $N_{\text{cancel}}(t)$ be the cumulative actions in the trading day, and $N_{\text{trades}}(t)$ be the cumulative filled trades.
$$\text{OTR}(t) = \frac{N_{\text{orders}}(t) + N_{\text{mod}}(t) + N_{\text{cancel}}(t)}{\max(1, N_{\text{trades}}(t))}$$

When $\text{OTR}(t) \ge 200$, the engine activates **Adaptive Penalty Defense**:
1. Mandates minimum time in force between order placement and cancellation ($\Delta t_{\text{cancel}} \ge 250 \text{ ms}$).
2. Injects a progressive latency delay $\tau = \kappa \cdot (\text{OTR} - 200) \text{ ms}$ on repetitive cancellations.
3. Automatically halts market-making cancellation loops if $\text{OTR}(t) \ge 450$, preserving member capital from Tier 2 NSE OTR fines.

---

### 4. System Architecture & Pre-Trade Gateway Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            HIGH-FREQUENCY PRE-TRADE RISK PIPELINE                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│       INCOMING ORDER REQUEST                                                                     │
│  (Symbol, Side, Qty, Price, Type)                                                                │
│                   │                                                                              │
│                   ▼                                                                              │
│  ┌────────────────────────────────────────────────────────┐                                      │
│  │ STAGE 1: FAT-FINGER & SANITY CHECK (< 0.2ms)           │                                      │
│  │ • Non-zero positive quantity & valid tick size (0.05)  │                                      │
│  │ • Price within Dynamic Operating Band (LTP ± 10%-20%)  │ ──► [FAIL] ──► REJECT: FAT_FINGER    │
│  │ • Value <= Max Single-Order Notional (e.g. ₹25 Lakhs)  │                                      │
│  └────────────────────────┬───────────────────────────────┘                                      │
│                           │ [PASS]                                                               │
│                           ▼                                                                      │
│  ┌────────────────────────────────────────────────────────┐                                      │
│  │ STAGE 2: SEBI CIRCUIT BREAKER & HALT CHECK (< 0.1ms)   │                                      │
│  │ • Current Index Circuit State (NORMAL / HALTED_10/15)  │ ──► [FAIL] ──► REJECT: MARKET_HALTED │
│  │ • Security Specific Upper/Lower Circuit Limits         │                                      │
│  └────────────────────────┬───────────────────────────────┘                                      │
│                           │ [PASS]                                                               │
│                           ▼                                                                      │
│  ┌────────────────────────────────────────────────────────┐                                      │
│  │ STAGE 3: MWPL & SEBI F&O BAN CHECK (< 0.3ms)           │                                      │
│  │ • Is underlying in SEBI F&O Ban list?                  │ ──► [FAIL] ──► REJECT: FO_BAN_VIOL   │
│  │ • If in Ban, does order increase gross exposure?       │                                      │
│  │ • Does client gross OI exceed 5% of MWPL limit?        │                                      │
│  └────────────────────────┬───────────────────────────────┘                                      │
│                           │ [PASS]                                                               │
│                           ▼                                                                      │
│  ┌────────────────────────────────────────────────────────┐                                      │
│  │ STAGE 4: LEAKY BUCKET & OTR SURVEILLANCE (< 0.2ms)     │                                      │
│  │ • Token bucket capacity check (Max 25 req/s)           │ ──► [FAIL] ──► REJECT: RATE_THROTTLED│
│  │ • Instantaneous OTR check (OTR < 450 safety ceiling)   │                                      │
│  └────────────────────────┬───────────────────────────────┘                                      │
│                           │ [PASS]                                                               │
│                           ▼                                                                      │
│  ┌────────────────────────────────────────────────────────┐                                      │
│  │ STAGE 5: SPAN 16-SCENARIO MARGIN SIMULATION (< 2.5ms)  │                                      │
│  │ • Recalculate portfolio Black-Scholes grid (16 states) │                                      │
│  │ • Post-trade scanning risk + SOM + ELM + Calendar      │ ──► [FAIL] ──► REJECT: INSUFFICIENT_ │
│  │ • Required Margin <= Available Free Capital            │                        MARGIN        │
│  └────────────────────────┬───────────────────────────────┘                                      │
│                           │ [PASS]                                                               │
│                           ▼                                                                      │
│  ┌────────────────────────────────────────────────────────┐                                      │
│  │ STAGE 6: EVT EXPECTED SHORTFALL STRESS TEST (< 1.5ms)  │                                      │
│  │ • GPD tail simulation on stressed portfolio return     │ ──► [WARN] ──► AUTO-HEDGE / LOG      │
│  │ • Post-Trade ES_99% <= Portfolio Max Risk Budget       │                                      │
│  └────────────────────────┬───────────────────────────────┘                                      │
│                           │ [PASS]                                                               │
│                           ▼                                                                      │
│       DISPATCH TO EXECUTION ENGINE / BROKER / FIX 4.4                                            │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1 Latency Budget & Worker Architecture
To achieve deterministic sub-5 millisecond pre-trade execution in the browser without freezing the React DOM thread:
1. **Dedicated Pre-Trade Web Worker (`riskEngine.worker.ts`):** Maintains synchronized local typed arrays (`Float64Array`) of portfolio Greeks, open positions, volatility surfaces, and 16-scenario pre-computed Black-Scholes valuation vectors.
2. **Zero-Allocation Memory Arena:** Memory structures for the 16 scenarios are allocated once at initialization (`Float64Array(16)`) to prevent Garbage Collection (GC) pauses during high-frequency execution.
3. **Execution Latency Budget Breakdown:**
   - Stage 1 (Fat-Finger): $\le 0.2 \text{ ms}$
   - Stage 2 (Circuit Breakers): $\le 0.1 \text{ ms}$
   - Stage 3 (MWPL & Ban): $\le 0.3 \text{ ms}$
   - Stage 4 (Leaky Bucket / OTR): $\le 0.2 \text{ ms}$
   - Stage 5 (SPAN 16-Scenario): $\le 2.2 \text{ ms}$
   - Stage 6 (EVT ES Calculation): $\le 1.2 \text{ ms}$
   - **Total Pre-Trade Validation Latency:** $\le 4.2 \text{ ms}$ (comfortably within the 5.0 ms SLA).

---

### 5. Detailed Feature Scope & User Stories

#### 5.1 User Story 1: High-Frequency Pre-Trade Risk Filter Pipeline (`TC-RISK-01`)
* **As an Institutional Risk Controller**, I want a deterministic pre-trade validation pipeline that inspects every single order against fat-finger limits, tick size, notional ceilings, and price bands in $< 0.5\text{ms}$, so that flawed or rogue orders are eliminated before reaching the broker gateway.
* **Acceptance Criteria:**
  - Validates order parameters: `symbol`, `side` (`BUY` or `SELL`), `orderType` (`LIMIT`, `MARKET`, `SL`), `quantity`, and `price`.
  - Rejects orders where `quantity <= 0` or `quantity % lotSize != 0`.
  - Rejects orders where `price` does not align to the statutory NSE tick size (₹0.05).
  - Rejects orders exceeding the single-order notional value limit (configurable, default: ₹25,00,000).
  - Evaluates limit price against dynamic Black-Scholes operating band $[P_{\min}, P_{\max}]$:
    $$P_{\min} = P_{\text{theo}} \times (1 - \delta_{\text{band}}), \quad P_{\max} = P_{\text{theo}} \times (1 + \delta_{\text{band}})$$
    (default $\delta_{\text{band}} = 15\%$). If price is outside band, reject with `RMS_FAT_FINGER_PRICE_OUT_OF_BOUNDS`.

#### 5.2 User Story 2: Indian SPAN-Equivalent 16-Scenario Margin Engine (`TC-RISK-02`)
* **As an Options Derivatives Trader**, I want the platform to simulate the exact 16-scenario SPAN risk array for my combined portfolio plus hypothetical pending orders, so that I know my exact post-trade margin requirement, scanning risk, and available free capital before order entry.
* **Acceptance Criteria:**
  - Evaluates all 16 scenarios listed in Section 3.1:
    - Scenarios 1-14: Price changes spanning $-3\sigma$ to $+3\sigma$ across 7 steps, paired with $\pm 4\%$ IV shifts.
    - Scenarios 15 & 16: Extreme moves (double PSR: $\pm 6\sigma$) scaled by regulatory $35\%$ factor.
  - Correctly values non-linear option legs (calls and puts) and linear futures legs across all 16 states using Black-Scholes.
  - Identifies the worst-case scenario and assigns it as `ScanningRisk`.
  - Adds Short Option Minimum (SOM) charge ($0.5\%$ of underlying notional for index options, $1.0\%$ for equity options).
  - Adds Extreme Loss Margin (ELM) ($3.5\%$ of gross notional for index contracts, $5.0\%$ for equity contracts).
  - Adds calendar spread charges for opposite-delta positions across expiries.
  - Rejects the order if `TotalRequiredMargin > AvailableCapital`, returning the exact deficit in INR.

#### 5.3 User Story 3: Extreme Value Theory (EVT) Expected Shortfall & Stress Testing Desk (`TC-RISK-03`)
* **As a Chief Risk Officer (CRO)**, I want to calculate the portfolio's Expected Shortfall ($\text{CVaR}_{99\%}$) using Generalized Pareto tails and stress test positions against historic market crash playbooks, so that the fund remains solvent through fat-tailed systemic crises.
* **Acceptance Criteria:**
  - Fits empirical portfolio loss exceedances above the 95th percentile to Generalized Pareto Distribution (GPD) parameters $(\xi, \ beta)$ via Maximum Likelihood Estimation.
  - Detects heavy tails ($\xi > 0$) and computes $\text{VaR}_{99\%}$ and $\text{ES}_{99\%}$ using closed-form POT equations.
  - Displays comparison of standard Gaussian VaR vs. EVT Expected Shortfall, highlighting the fat-tail underestimation gap.
  - Provides a one-click **Historical Stress Testing Suite** simulating:
    1. **March 2020 COVID Crash:** Instantaneous $-12.5\%$ price drop with $+18\%$ IV spike.
    2. **2008 Lehman Shock:** $-8.0\%$ price drop with $+12\%$ IV spike.
    3. **June 2024 Election Result Swing:** Intraday $-6.0\%$ swing with IV crush of $-10\%$.
    4. **Budget Day Flash Volatility:** $\pm 4.0\%$ price range with immediate $-14\%$ IV collapse.
  - Flags `CRITICAL_TAIL_EXPOSURE` if post-trade $\text{ES}_{99\%}$ exceeds $60\%$ of total account equity.

#### 5.4 User Story 4: SEBI Market-Wide Position Limits (MWPL) & F&O Ban Guardian (`TC-RISK-04`)
* **As a Compliance & Algo Execution Officer**, I want continuous surveillance of SEBI MWPL utilization for all F&O securities, so that orders that violate F&O ban restrictions or client-level position limits are blocked with zero penalty risk.
* **Acceptance Criteria:**
  - Ingests and maintains daily NSE MWPL master data file (`fo_mwpl.csv` or API equivalent).
  - Calculates live MWPL utilization percentage $\text{MWPL \%} = (\text{Total OI} / \text{MWPL}) \times 100$.
  - Automatically flags securities entering Ban ($\text{MWPL} \ge 95\%$) and exiting Ban ($\text{MWPL} < 80\%$).
  - For securities in F&O Ban:
    - **Allows** orders that unwind or reduce existing open positions.
    - **Rejects** any order that initiates a new position or expands existing open exposure with error `RMS_SEBI_FO_BAN_VIOLATION`.
  - Verifies single-client exposure $\le 5\%$ of MWPL; rejects orders breaching client limit with `RMS_CLIENT_MWPL_EXCEEDED`.

#### 5.5 User Story 5: Dynamic Order Throttling, Leaky Bucket & OTR Penalty Shield (`TC-RISK-05`)
* **As a High-Frequency Algo Developer**, I want an active order rate throttler and OTR penalty shield, so that fast-loop algorithms do not trigger NSE rate penalties or exchange connection suspensions.
* **Acceptance Criteria:**
  - Implements Token Bucket rate limiting: max 25 actions/second, 100 burst capacity.
  - Dynamically computes intraday Order-to-Trade Ratio:
    $$\text{OTR} = \frac{\text{Orders} + \text{Modifications} + \text{Cancellations}}{\text{Executed Trades}}$$
  - Displays color-coded real-time OTR status:
    - Green: $\text{OTR} < 50$ (Safe)
    - Yellow: $50 \le \text{OTR} < 200$ (Normal Algorithmic Activity)
    - Orange: $200 \le \text{OTR} < 400$ (Warning: Adaptive latency injected)
    - Red: $\text{OTR} \ge 450$ (Critical: Automated cancellation throttle activated)
  - Enforces minimum 250ms dwell time before order cancellation when OTR $> 250$.
  - Provides a bypass toggle for emergency panic cancellations (`EmergencyKillSwitch`).

#### 5.6 User Story 6: SEBI Volatility Circuit Breaker & Fat-Finger Protection Module (`TC-RISK-06`)
* **As a Trading Desk Operator**, I want an automated state machine monitoring SEBI Index Circuit Breaker thresholds and trading session cooling rules, so that order submissions are gracefully managed during market halts.
* **Acceptance Criteria:**
  - Tracks NIFTY 50 and SENSEX percentage moves relative to previous day's official close.
  - Evaluates circuit stages based on clock time (IST):
    - $10\%$ circuit hit before 1:00 PM $\rightarrow$ 45 min halt + 15 min pre-open.
    - $10\%$ circuit hit 1:00 PM to 2:30 PM $\rightarrow$ 15 min halt + 15 min pre-open.
    - $10\%$ circuit hit after 2:30 PM $\rightarrow$ Normal trading continues.
    - $15\%$ circuit hit before 1:00 PM $\rightarrow$ 1 hr 45 min halt + 15 min pre-open.
    - $15\%$ circuit hit 1:00 PM to 2:00 PM $\rightarrow$ 45 min halt + 15 min pre-open.
    - $15\%$ circuit hit on or after 2:00 PM $\rightarrow$ Trading closed for day.
    - $20\%$ circuit hit any time $\rightarrow$ Trading closed for day.
  - During halts, rejects all aggressive market orders and non-cancel order operations with `RMS_CIRCUIT_BREAKER_HALT`.
  - Displays countdown timer for pre-open session resumption.

#### 5.7 User Story 7: Real-Time Risk Cockpit UI & 3D Loss Surface Visualizer (`TC-RISK-07`)
* **As a Quantitative Portfolio Manager**, I want an interactive, institutional dark-mode Risk Cockpit UI displaying 16-scenario heatmaps, EVT tail distributions, MWPL gauges, and emergency kill switches, so that I possess complete visibility of desk risk at a glance.
* **Acceptance Criteria:**
  - **16-Scenario Heatmap:** 2D grid matrix showing portfolio profit/loss across all 16 SPAN scenarios, with the worst-case scenario highlighted in red.
  - **EVT GPD Tail Plot:** Visualizes the empirical return distribution vs. GPD modeled fat tail, marking $\text{VaR}_{99\%}$ and $\text{ES}_{99\%}$ cutoffs.
  - **MWPL Surveillance Radar:** Table showing top 20 high-OI stocks, their current MWPL %, ban state, and distance to ban.
  - **OTR & Token Bucket Sparklines:** Real-time gauges of message rate, remaining tokens, and daily cumulative OTR.
  - **One-Click Desk Kill Switch:** Prominently placed red button that cancels all active working orders across all symbols in $< 50\text{ms}$.

---

### 6. TypeScript Data Models & Contract Specifications

```typescript
// ============================================================================
// TradeCraft AI - Pre-Trade Risk Engine & Stress Testing Types (Sprint 22)
// File: src/types/riskEngine.ts
// ============================================================================

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LIMIT';
export type InstrumentType = 'EQUITY' | 'FUTURES' | 'CE' | 'PE';

export interface PreTradeOrderRequest {
  orderId: string;
  symbol: string;
  underlying: string;
  instrumentType: InstrumentType;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  lotSize: number;
  price: number;
  triggerPrice?: number;
  expiry?: string;
  strike?: number;
  clientAccountId: string;
  timestamp: number;
}

export type RiskCheckStatus = 'APPROVED' | 'REJECTED' | 'THROTTLED';

export type RiskRejectionCode =
  | 'NONE'
  | 'RMS_INVALID_QUANTITY'
  | 'RMS_INVALID_TICK_SIZE'
  | 'RMS_SINGLE_ORDER_NOTIONAL_EXCEEDED'
  | 'RMS_FAT_FINGER_PRICE_OUT_OF_BOUNDS'
  | 'RMS_CIRCUIT_BREAKER_HALT'
  | 'RMS_SEBI_FO_BAN_VIOLATION'
  | 'RMS_CLIENT_MWPL_EXCEEDED'
  | 'RMS_RATE_LIMIT_EXCEEDED'
  | 'RMS_OTR_THROTTLE_ACTIVE'
  | 'RMS_INSUFFICIENT_SPAN_MARGIN'
  | 'RMS_EVT_ES_LIMIT_EXCEEDED';

export interface PreTradeRiskCheckResult {
  status: RiskCheckStatus;
  rejectionCode: RiskRejectionCode;
  rejectionReason: string;
  executionLatencyMs: number;
  checks: {
    fatFingerPassed: boolean;
    circuitBreakerPassed: boolean;
    mwplBanPassed: boolean;
    rateLimitPassed: boolean;
    spanMarginPassed: boolean;
    evtTailPassed: boolean;
  };
  marginImpact: {
    currentMargin: number;
    projectedMargin: number;
    freeCapital: number;
    marginUtilizationPct: number;
    peakMarginDeficit: number;
  };
  evtImpact: {
    portfolioVaR99: number;
    portfolioES99: number;
    evtGpdShapeXi: number;
    evtGpdScaleBeta: number;
    riskBudgetUtilizationPct: number;
  };
}

export interface SpanScenarioResult {
  scenarioId: number;
  description: string;
  priceShiftPct: number;
  priceShiftSigma: number;
  volatilityShiftPct: number;
  extremeLossWeight: number;
  portfolioPnL: number;
  isWorstScenario: boolean;
}

export interface SpanMarginReport {
  underlying: string;
  underlyingPrice: number;
  priceScanRange: number; // PSR in INR
  volatilityScanRange: number; // VSR in decimal (e.g. 0.04)
  scenarios: SpanScenarioResult[];
  scanningRisk: number;
  calendarSpreadCharge: number;
  shortOptionMinimum: number;
  extremeLossMargin: number;
  totalSpanMarginRequired: number;
  peakMarginSnapshots: {
    snapshotId: number;
    timestamp: number;
    marginRequired: number;
  }[];
}

export interface EvtGpdMetrics {
  sampleSize: number;
  thresholdExceedances: number;
  thresholdU: number;
  shapeXi: number; // Tail index xi (xi > 0 = heavy tail)
  scaleBeta: number; // Scale parameter beta
  gaussianVaR99: number;
  evtVaR99: number;
  evtExpectedShortfall99: number;
  tailDivergenceGapPct: number; // (evtES99 - gaussianVaR99) / gaussianVaR99 * 100
  historicalStressTests: {
    scenarioName: string;
    description: string;
    simulatedPnL: number;
    maxDrawdownPct: number;
    solvencyStatus: 'SOLVENT' | 'MARGIN_CALL' | 'LIQUIDATED';
  }[];
}

export interface MwplSecurityStatus {
  symbol: string;
  totalOpenInterest: number;
  sebiMwplLimit: number;
  utilizationPct: number;
  state: 'NORMAL' | 'WARNING' | 'BAN_ENTER' | 'IN_BAN' | 'BAN_EXIT';
  clientOpenInterest: number;
  clientLimitPct: number;
  distanceToBanOI: number;
  isBannedForDay: boolean;
}

export interface OrderThrottlerMetrics {
  currentTokens: number;
  maxBucketCapacity: number;
  refillRatePerSec: number;
  cumulativeOrders: number;
  cumulativeModifies: number;
  cumulativeCancels: number;
  cumulativeTrades: number;
  currentOTR: number;
  otrPenaltyTier: 'SAFE' | 'TIER_1_FINE' | 'TIER_2_FINE' | 'SUSPENDED';
  activeLatencyDelayMs: number;
}

export interface CircuitBreakerStatus {
  indexSymbol: string;
  currentPrice: number;
  prevClosePrice: number;
  pctChange: number;
  circuit10Hit: boolean;
  circuit15Hit: boolean;
  circuit20Hit: boolean;
  marketState: 'NORMAL' | 'HALTED_10' | 'HALTED_15' | 'HALTED_20_CLOSED' | 'PRE_OPEN';
  haltEndTime?: number;
  preOpenEndTime?: number;
}
```

---

### 7. Institutional UI Cockpit Specification

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TRADECRAFT AI // INSTITUTIONAL PRE-TRADE RISK & STRESS TESTING COCKPIT                           │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  GATEWAY STATUS: [ ACTIVE <3.2ms ]   CIRCUIT: [ NORMAL (NIFTY +0.42%) ]   OTR: [ 24.6 (SAFE) ]  │
├──────────────────────────────────────┬───────────────────────────────────┬───────────────────────┤
│ 1. SPAN 16-SCENARIO RISK MATRIX      │ 2. EVT GPD TAIL RISK (CVaR 99%)   │ 3. SEBI MWPL SURVEILL.│
│ Portfolio: 12 Legs (NIFTY + BANKN.)  │ Confidence: 99.0% | Tail xi: 0.28 │ Top High-OI Underly.  │
│                                      │                                   │                       │
│ Scen Price  Vol   PnL (₹)     State  │ Gauss VaR:  -₹1,42,500            │ ZEEL:    96.4% [BAN]  │
│ 01   0.0%  +4.0%  -₹28,400    SAFE   │ EVT VaR99:  -₹2,18,000            │ SAIL:    91.2% [WARN] │
│ 02   0.0%  -4.0%  +₹34,100    GAIN   │ EVT ES 99%: -₹3,45,200 [FAT TAIL] │ PNB:     88.7% [WARN] │
│ 03  +1.0s  +4.0%  -₹12,200    SAFE   │ Tail Gap:   +142.2% Excess Loss   │ CANBK:   84.1% [NORM] │
│ ...                                  │                                   │ TATACHEM:82.0% [NORM] │
│ 11  +3.0s  +4.0%  -₹1,98,400  WARN   │ HISTORICAL STRESS REPLAY:         │                       │
│ 12  +3.0s  -4.0%  -₹1,45,000  WARN   │ • Covid Crash:   -₹6,80,000 (SOL) │ CLIENT LIMIT (5%):    │
│ 13  -3.0s  +4.0%  -₹3,84,500 [WORST] │ • 2008 Lehman:   -₹5,12,000 (SOL) │ ZEEL: 0.8% / 5.0% OK  │
│ 14  -3.0s  -4.0%  -₹3,10,000  WARN   │ • 2024 Election: -₹3,90,000 (SOL) │                       │
│ 15  +6.0s (35%)   -₹2,40,100  EXTR   │ • Budget IV Drop:-₹1,85,000 (SOL) │                       │
│ 16  -6.0s (35%)   -₹3,15,000  EXTR   │                                   │                       │
│                                      │                                   │                       │
│ Scanning Risk:     ₹3,84,500         │ 4. THROTTLER & OTR DEFENSE        │                       │
│ Short Option Min:  ₹42,000           │ Tokens Avail: [████████░░] 82/100 │                       │
│ Extreme Loss Margin: ₹85,500         │ Orders: 420 | Cancels: 310        │ [ EMERGENCY DESK ]    │
│ TOTAL SPAN MARGIN: ₹5,12,000         │ Trades: 38  | OTR: 24.6 (PASS)    │ [ KILL SWITCH ]       │
│ Free Capital:      ₹14,88,000        │ Penalty Shield: ACTIVE (0ms Lat.) │ (Cancel All Orders)   │
└──────────────────────────────────────┴───────────────────────────────────┴───────────────────────┘
```

---

### 8. Non-Functional Requirements & Performance SLAs

1. **Deterministic Latency Budget:**
   - 99th percentile ($p99$) pre-trade risk evaluation latency must strictly not exceed **$5.0\text{ ms}$**.
   - Average ($p50$) latency target: **$< 2.5\text{ ms}$**.
2. **Zero DOM Freeze via Web Worker:**
   - All complex Black-Scholes scenario revaluations, MLE optimizations, and GPD tail calculations execute in a dedicated background Web Worker (`riskEngine.worker.ts`).
   - The main React UI thread is never blocked.
3. **Memory Safety & Zero Garbage Collection Spikes:**
   - Pre-allocated Typed Arrays (`Float64Array`) for the 16 scenarios and Greeks cache.
   - Avoid creating temporary object instances during hot-path order validation.
4. **Client-Side BYOK Sovereignty:**
   - All risk computations, margin matrices, and stress tests execute entirely client-side in the user's browser.
   - No private broker credentials, trade books, or margin figures are transmitted to external servers.
5. **Fail-Closed Architecture:**
   - If an unexpected error, numeric overflow, or pricing discrepancy occurs in the risk pipeline, the engine strictly defaults to **REJECT** (`Fail-Closed`), preventing unchecked order flow from reaching the exchange.

---

### 9. Verification & Test Matrix

| Test ID | Test Scenario Description | Expected Input Condition | Expected Result / System Assertion |
| :--- | :--- | :--- | :--- |
| `TC-TEST-RISK-01` | Fat-Finger Negative Qty & Tick Mismatch | Qty: -50, Price: 22,410.12 | Rejected: `RMS_INVALID_QUANTITY` & `RMS_INVALID_TICK_SIZE` in $< 0.2\text{ms}$ |
| `TC-TEST-RISK-02` | Out-of-Bounds Fat-Finger Price | NIFTY 22,500 CE (LTP ₹150), Limit ₹450 | Rejected: `RMS_FAT_FINGER_PRICE_OUT_OF_BOUNDS` ($> 15\%$ band) |
| `TC-TEST-RISK-03` | SPAN 16-Scenario Scanning Risk Calculation | 10 Short NIFTY Straddles (ATM 22,500) | Identifies Scenario 13/14 (Price Down 3 $\sigma$) as worst loss; computes correct scanning risk |
| `TC-TEST-RISK-04` | Insufficient Capital SPAN Margin Rejection | Required Margin ₹8,50,000, Free Capital ₹5,00,000 | Rejected: `RMS_INSUFFICIENT_SPAN_MARGIN` with deficit ₹3,50,000 |
| `TC-TEST-RISK-05` | SEBI F&O Ban Violation Check | ZEEL in Ban ($96.2\%$ MWPL); Order: BUY 1 Lot Fresh | Rejected: `RMS_SEBI_FO_BAN_VIOLATION` |
| `TC-TEST-RISK-06` | F&O Ban Legitimate Position Unwinding | Short 2 Lots ZEEL; Order: BUY 1 Lot (Cover) | **APPROVED**: Position-reducing order allowed during Ban |
| `TC-TEST-RISK-07` | Client MWPL 5% Limit Breach | Order expands client OI to $5.2\%$ of total MWPL | Rejected: `RMS_CLIENT_MWPL_EXCEEDED` |
| `TC-TEST-RISK-08` | Leaky Bucket Token Depletion | 120 rapid order cancels in 500ms | First 100 pass; remaining throttled with `RMS_RATE_LIMIT_EXCEEDED` |
| `TC-TEST-RISK-09` | OTR Penalty Shield Injection | OTR reaches 260 | Engine enforces mandatory 250ms dwell time before order cancellation |
| `TC-TEST-RISK-10` | EVT GPD Tail Fitting & ES 99% Calculation | Historical crash return series with $\xi = 0.28$ | Computes $\text{ES}_{99\%}$; confirms $\text{ES}_{99\%} > \text{Gaussian VaR}_{99\%}$ by $> 50\%$ |
| `TC-TEST-RISK-11` | 10% Index Circuit Breaker at 11:30 AM IST | NIFTY hits $-10.1\%$ at 11:30 AM | Market state transitions to `HALTED_10`; orders rejected for 45 min + 15 min pre-open |
| `TC-TEST-RISK-12` | Emergency Desk Kill Switch Execution | 15 active resting orders across 4 symbols | Emits batch cancel requests for all 15 orders in $< 25\text{ms}$ |
