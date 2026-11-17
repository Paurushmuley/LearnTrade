# Business Requirements Document (BRD) - Sprint 24

## Feature ID: `BRD-024`
## Feature Title: Real-Time Options Gamma Squeeze & 0-DTE Expiry Pinning Risk Engine (Dealer Positioning GEX, Gamma Flip Boundaries, Dynamic Max Pain Migration & Fokker-Planck Strike Pinning Probability)
**Author:** Researcher Lead (Autonomous Multi-Agent Cycle)  
**Date:** 2026-11-13  
**Status:** `COMPLETED & VERIFIED`  
**Target Milestone:** Sprint 24  
**Dependencies:**
- Sprint 1 (`taxEngine.ts` — Indian Statutory Taxes, STT on Options Exercise, GST)
- Sprint 2 (`optionsEngine.ts` — Black-Scholes Formula, Implied Volatility & Greeks)
- Sprint 4 (`marketDepthEngine.ts` — Tick-by-Tick Bar Replay & DOM Order Depth)
- Sprint 13 (`greeksHedgerEngine.ts` — Dynamic Delta-Gamma Neutral Autobalancer)
- Sprint 14 (`volatilitySurfaceEngine.ts`, `optionsOptimizerEngine.ts` — SABR/SVI Surface Calibration & Payoff Optimization)
- Sprint 15 (`level3Engine.ts` — Real-Time L3 Order Book & Dark Pool Flow Tracker)
- Sprint 21 (`volatilityDispersionEngine.ts` — Options Volatility Dispersion & Multi-Expiry Skew)
- Sprint 22 (`riskEngine.ts` — Pre-Trade Risk Engine, Circuit Breakers & SPAN Margin)
- Sprint 23 (`crossMarginingEngine.ts` — Institutional Multi-Asset Cross-Margining & Portfolio VaR)

---

### 1. Executive Summary & Problem Statement

#### 1.1 Context: The 0-DTE Explosion in Indian Equity Derivatives
In the Indian financial ecosystem governed by the **Securities and Exchange Board of India (SEBI)** and cleared by **NSE Clearing Limited (NCL)** and **BSE Clearing Corporation (ICCL)**, the options market has undergone a historic structural paradigm shift: the rise of **Zero Days-to-Expiration (0-DTE) trading**. 

With daily staggered index expiries across the trading week:
* **Mondays:** NIFTY MIDCAP SELECT (`MIDCPNIFTY` - NSE)
* **Tuesdays:** NIFTY FINANCIAL SERVICES (`FINNIFTY` - NSE)
* **Wednesdays:** NIFTY BANK (`BANKNIFTY` - NSE)
* **Thursdays:** NIFTY 50 (`NIFTY` - NSE)
* **Fridays:** S&P BSE SENSEX (`SENSEX` - BSE) & BSE BANKEX (`BANKEX` - BSE)

Every single trading day in India is now an expiry day. Daily derivatives turnover on the National Stock Exchange (NSE) regularly exceeds **₹400 Lakh Crores to ₹500 Lakh Crores notional**, with over **65% to 75% of total traded option volume and open interest concentrated in the expiring 0-DTE contracts**.

On expiry day, the physics of financial markets fundamentally transform. Time to maturity $T \to 0$, causing standard second-order Greeks—specifically **Gamma ($\Gamma$)**—to approach singularity for at-the-money (ATM) strikes, while **Theta ($\Theta$)** decay accelerates asymptotically ($\propto 1/\sqrt{T}$). Market makers, liquidity providers, and proprietary institutional desks dynamically delta-hedge their vast short or long option inventories in the cash equity or underlying futures market, creating massive endogenous feedback loops that dominate price discovery.

#### 1.2 Problem Statement
Despite the colossal volume in 0-DTE contracts, retail traders, family offices, and buy-side desks navigate expiry day trading with primitive, outdated, or outright misleading tools:

1. **Dealer Gamma Exposure (GEX) Blindness:**
   Market participants trade without knowing whether clearing house dealers and market makers are **Long Gamma** (dampening realized volatility through contrarian mean-reverting hedging) or **Short Gamma** (amplifying market moves through pro-cyclical momentum-chasing hedging). When an index crosses into negative dealer gamma, market makers are forced to aggressively sell into falling markets and buy into rising markets to maintain delta neutrality, triggering violent, self-reinforcing **Gamma Squeezes** that obliterate unhedged option sellers.
2. **The "Static Max Pain" Trap:**
   Traders rely on naive "Max Pain" charts calculated once at market open (09:15 IST) using overnight Open Interest. This static metric completely ignores intraday open interest velocity ($\Delta\text{OI}/\Delta t$), aggressive short covering, fresh intraday option writing, and statutory cash-settlement penalties under SEBI settlement rules. In volatile sessions, relying on static Max Pain leads to catastrophic losses when the true settlement gravitational center shifts by hundreds of points.
3. **Ignorance of Terminal Strike Pinning Mechanics:**
   Between 13:30 IST and 15:30 IST on expiry day, the underlying spot price is subject to powerful microscopic pinning forces toward heavy open interest strikes. Conventional models assume asset prices follow geometric Brownian motion (GBM) with constant drift. They fail to model the **local restoring drift and volatility suppression** induced by dealer hedging feedback, leaving traders blind to the statistical probability of an index "pinning" at a specific strike at 15:30 IST.
4. **Catastrophic 0-DTE Hyper-Theta Burn & Volatility Crush:**
   Because Black-Scholes Theta scales inversely with $\sqrt{T}$ ($\Theta \approx -\frac{S \sigma}{2\sqrt{2\pi T}}$), option extrinsic value collapses at an exponential rate during the final 120 minutes of trading. Furthermore, as directional event uncertainty dissolves post-13:30 IST, Implied Volatility (IV) undergoes a structural **volatility crush**, collapsing premiums to their terminal intrinsic payoffs. Traders lack quantitative tools to forecast this intraday decay curve and separate theta decay from directional gamma risk.
5. **Lack of Institutional Real-Time Surveillance in Browser-Native BYOK Platforms:**
   Institutional analytics platforms (such as Bloomberg AIM, SpotGamma, or proprietary quant desk systems) are locked behind exorbitant five-figure annual subscriptions and institutional server infrastructure. Retail and boutique prop desks have zero access to real-time, sub-10ms browser-based GEX profiling, dynamic gamma flip boundary solvers, and Fokker-Planck strike pinning density engines.

#### 1.3 Solution & Business Objectives
TradeCraft AI Sprint 24 delivers an institutional-grade, browser-native **Real-Time Options Gamma Squeeze & 0-DTE Expiry Pinning Risk Engine**:
* **Dealer Gamma Exposure (GEX) Profiler:** Real-time mathematical computation of aggregate dealer gamma exposure across the entire option chain in **INR Crores per 1% spot move**, explicitly disaggregating Call GEX (+) and Put GEX (-).
* **Net Gamma Flip Boundary Solver ($S^*$):** High-precision numerical root-finding engine that pinpoints the exact spot inflection price where aggregate dealer positioning flips between the **Long Gamma Regime** (volatility suppression, mean reversion) and the **Short Gamma Regime** (volatility explosion, gamma squeeze acceleration).
* **Dynamic Max Pain Migration Engine:** Real-time tracking of the theoretical maximum pain strike incorporating intraday OI velocity ($\vec{\nu}_{\text{OI}}$), volume-weighted premium flow, and SEBI cash-settlement tax penalties (STT on option exercise).
* **Fokker-Planck Terminal Strike Pinning Probability Model:** A drift-diffusion partial differential equation (PDE) solver modeling the endogenous restoring drift of market maker delta hedging, producing exact terminal strike pinning probabilities ($P_{\text{pin}}(K)$) for 15:30 IST settlement.
* **0-DTE Hyper-Theta Burn & Volatility Crush Forecaster:** Continuous intraday curve projection of asymptotic theta decay ($\propto 1/\sqrt{T}$) and post-13:30 IST IV crush dynamics.
* **Institutional 0-DTE Expiry Risk Cockpit UI:** Dark-mode terminal dashboard featuring real-time GEX strike ladders, dynamic gamma flip needle gauge, Max Pain migration trajectory graphs, Fokker-Planck probability density curves, and real-time gamma squeeze breakout alerts.

---

### 2. Market Microstructure & Regulatory Framework (NSE/BSE)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│              INDIAN 0-DTE OPTIONS MICROSTRUCTURE & DEALER HEDGING FEEDBACK LOOPS                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│       BUY-SIDE / RETAIL INVENTORY FLOW              MARKET MAKERS / CLEARING MEMBERS             │
│    ┌────────────────────────────────────┐         ┌────────────────────────────────────┐         │
│    │ • Net Buyers of OTM Wings          │         │ • Net Sellers of OTM Wings         │         │
│    │ • Net Sellers of ATM Straddles     │ ◄─────► │ • Net Buyers of ATM Straddles      │         │
│    │ • Speculative Directional Longs    │         │ • Delta-Neutral Dynamic Hedgers    │         │
│    └────────────────────────────────────┘         └─────────────────┬──────────────────┘         │
│                                                                     │                            │
│                                           DYNAMIC UNDERLYING HEDGE  │ (Futures & Cash Equities)  │
│                                                                     ▼                            │
│    ┌────────────────────────────────────────────────────────────────────────────────────────┐    │
│    │                           DEALER GAMMA POSITIONING REGIMES                             │    │
│    ├───────────────────────────────────────────┬────────────────────────────────────────────┤    │
│    │  LONG GAMMA REGIME (Spot > Gamma Flip)    │  SHORT GAMMA REGIME (Spot < Gamma Flip)    │    │
│    ├───────────────────────────────────────────┼────────────────────────────────────────────┤    │
│    │ • Dealer Delta changes with Spot:         │ • Dealer Delta changes against Spot:       │    │
│    │   d(Delta_dealer) / dS > 0                │   d(Delta_dealer) / dS < 0                 │    │
│    │ • Spot Rises  ──► Dealer Sells Underlying │ • Spot Rises  ──► Dealer Buys Underlying   │    │
│    │ • Spot Falls  ──► Dealer Buys Underlying  │ • Spot Falls  ──► Dealer Sells Underlying  │    │
│    │                                           │                                            │    │
│    │ [ VOLATILITY SUPPRESSION / PINNING ]      │ [ VOLATILITY EXPANSION / GAMMA SQUEEZE ]   │    │
│    │ • Realized Volatility < Implied Vol       │ • Realized Volatility >> Implied Vol       │    │
│    │ • Mean-reversion to High-OI Strike        │ • Cascading stop-outs & breakout runs      │    │
│    │ • Magnet-like pull toward Max Pain        │ • Runaway short-covering liquidations      │    │
│    └───────────────────────────────────────────┴────────────────────────────────────────────┘    │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1 Market Maker Positioning Conventions
In modern financial microstructure literature (e.g., SqueezeMetrics, SpotGamma, Garman & Kohlhagen), market makers are assumed to take the counterparty side to public market order flow:
1. **Call Open Interest ($\text{OI}_{\text{Call}}$):** Retail and institutional participants are predominantly net buyers of upside call options (speculative upside leverage or covered call writing by institutions). Market makers are consequently net short calls. When dealers are short calls, an upward move in the underlying increases call delta, requiring dealers to buy underlying shares/futures to remain delta-neutral. Conversely, under standard GEX conventions, long call positioning by public traders gives dealers positive gamma exposure relative to call strike magnets.
2. **Put Open Interest ($\text{OI}_{\text{Put}}$):** Participants are predominantly net buyers of protective put options (portfolio downside hedging). Market makers are net short puts. When the market drops, put delta increases (becomes more negative), forcing dealers to sell underlying assets to hedge, accelerating downward momentum.

To establish standard institutional accounting:
$$\text{Call GEX}_i > 0 \quad (\text{Positive Volatility Dampener})$$
$$\text{Put GEX}_i < 0 \quad (\text{Negative Volatility Accelerator})$$

#### 2.2 Indian Contract Specifications & Lot Sizes
The GEX engine dynamically queries statutory contract parameters per underlying symbol:

| Underlying Symbol | Exchange | Index / Asset Type | Standard Lot Size ($L$) | Tick Size (INR) | Expiry Day | Settlement Type |
| :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| `NIFTY` | NSE | NIFTY 50 Benchmark | **25** | ₹0.05 | Thursday | Cash-settled vs 30-min VWAP |
| `BANKNIFTY` | NSE | Nifty Bank Sectoral | **15** | ₹0.05 | Wednesday | Cash-settled vs 30-min VWAP |
| `FINNIFTY` | NSE | Financial Services | **25** | ₹0.05 | Tuesday | Cash-settled vs 30-min VWAP |
| `MIDCPNIFTY` | NSE | Midcap Select Index | **50** | ₹0.05 | Monday | Cash-settled vs 30-min VWAP |
| `SENSEX` | BSE | S&P BSE SENSEX | **10** | ₹0.05 | Friday | Cash-settled vs 30-min VWAP |
| `BANKEX` | BSE | S&P BSE BANKEX | **15** | ₹0.05 | Friday | Cash-settled vs 30-min VWAP |

#### 2.3 Statutory Expiry Settlement Mechanics
Under SEBI and NSE Clearing Limited (NCL) circulars:
1. **Closing Price Determination (30-Minute VWAP):**
   The final settlement price for expiring index derivatives is calculated as the **volume-weighted average price (VWAP) of the underlying index between 15:00:00 IST and 15:30:00 IST**:
   $$P_{\text{settle}} = \frac{\sum_{t \in [15:00, 15:30]} P_t \cdot V_t}{\sum_{t \in [15:00, 15:30]} V_t}$$
   This 30-minute averaging window suppresses instantaneous single-tick manipulation, but creates a concentrated battleground where institutional delta hedging directly targets specific strike pins.
2. **Securities Transaction Tax (STT) on Exercise:**
   Under the Finance Act (amended 2024/2026), when an in-the-money (ITM) option is exercised at expiry:
   - For option buyers exercising ITM call/put options, STT is levied at **0.125% of the intrinsic value** (or full settlement value).
   - In shallow ITM strikes (where intrinsic value is less than statutory taxes and brokerage), option holders suffer "STT trap" negative cash flows, creating artificial pinning barriers.

---

### 3. Quantitative & Mathematical Formulations

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   QUANTITATIVE GAMMA SQUEEZE & PINNING ENGINE PIPELINE                           │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. DEALER GAMMA EXPOSURE (GEX) FORMULATION                                                 │  │
│  │    • Black-Scholes Gamma: \Gamma_i = \phi(d_1) / (S \cdot \sigma_i \cdot \sqrt{T_i})       │  │
│  │    • Call GEX_i = +\Gamma_i \cdot S \cdot OI_{C, i} \cdot L \cdot (S \cdot 0.01 / 10^7)    │  │
│  │    • Put GEX_i  = -\Gamma_i \cdot S \cdot OI_{P, i} \cdot L \cdot (S \cdot 0.01 / 10^7)    │  │
│  │    • Net GEX(S) = \sum_i (Call GEX_i + Put GEX_i) in INR Crores per 1% Move                │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. NET GAMMA FLIP BOUNDARY SOLVER (S^*)                                                    │  │
│  │    • Inflection Root: Net GEX(S^*) \equiv 0                                                │  │
│  │    • Brent-Dekker Hybrid Root-Finding Solver on continuous Gamma Profile                   │  │
│  │    • S > S^*: Long Gamma Regime (Volatility Suppression, Mean Reversion)                   │  │
│  │    • S < S^*: Short Gamma Regime (Volatility Expansion, Gamma Squeeze Risk)                │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. DYNAMIC MAX PAIN MIGRATION ALGORITHM                                                    │  │
│  │    • Intraday OI Velocity: \nu_i(t) = d(OI_i) / dt                                         │  │
│  │    • Volume-Weighted Price Pressure & STT Cash-Settlement Penalty Integration             │  │
│  │    • P_{pain}(K, t) = \sum [ OI_{C}(t) \max(0, K - K_i) + OI_{P}(t) \max(0, K_i - K) ]    │  │
│  │    • Migration Velocity: v_{pain} = d(K^*_{dyn}) / dt (Points / Hour)                      │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 4. FOKKER-PLANCK TERMINAL STRIKE PINNING PROBABILITY MODEL                                 │  │
│  │    • SDE under MM Hedging Feedback: dS_t = \mu_{eff}(S, t) dt + \sigma_{eff}(S, t) dW_t    │  │
│  │    • Effective Restoring Drift: \mu_{eff}(S, t) = -\kappa \sum \Gamma_i OI_i (S - K_i)    │  │
│  │    • Forward Kolmogorov PDE: \partial p / \partial t = -\partial(\mu p)/\partial S + ...   │  │
│  │    • Pinning Probability: P_{pin}(K_i) = \int_{K_i - \Delta/2}^{K_i + \Delta/2} p(S, T) dS│  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│                                                 ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 5. 0-DTE HYPER-THETA BURN & VOLATILITY CRUSH FORECASTER                                    │  │
│  │    • Asymptotic 0-DTE Decay: \Theta \approx - (S \cdot \sigma) / (2 \sqrt{2\pi T})         │  │
│  │    • Post-13:30 IST Collapse: \Theta \propto 1 / \sqrt{T} Divergence                       │  │
│  │    • Intraday IV Crush Projection: \sigma_{imp}(t) \to \sigma_{realized}                   │  │
│  │    • Gamma / Theta Risk Ratio: R_{\Gamma/\Theta} = |\Gamma| / |\Theta|                     │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 Mathematical Formulation of Dealer Gamma Exposure (GEX)
Let $S$ be the current spot price of the underlying index.  
Let $K_i$ be the strike price of option contract $i$.  
Let $T$ be the annualized time to expiration:
$$T = \frac{\tau_{\text{minutes}}}{252 \times 375} \quad (\text{where 375 minutes = 6.25 trading hours between 09:15 and 15:30 IST})$$
Let $\sigma_i$ be the implied volatility of strike $K_i$, and $r$ be the risk-free rate (MIFOR / 91-day T-Bill rate $\approx 6.75\%$).

The Black-Scholes $d_1$ term is:
$$d_1(S, K_i, T, \sigma_i) = \frac{\ln(S / K_i) + \left( r + \frac{1}{2}\sigma_i^2 \right) T}{\sigma_i \sqrt{T}}$$

The standard Black-Scholes Gamma ($\Gamma_i$) is identical for both call and put options:
$$\Gamma_i(S) = \frac{\phi(d_1)}{S \sigma_i \sqrt{T}} = \frac{1}{S \sigma_i \sqrt{2\pi T}} \exp\left( -\frac{d_1^2}{2} \right)$$

##### Definition of Rupee Gamma Exposure (GEX):
Gamma represents the rate of change of Delta with respect to spot ($\frac{\partial \Delta}{\partial S}$). If the spot price moves by $1\%$, the change in spot is $\Delta S = 0.01 \times S$.  
The change in delta shares per contract is $\Gamma_i \times \Delta S \times L$, where $L$ is the contract lot size.  
The total capital required by dealers to re-hedge against a $1\%$ spot move across open contracts is:

$$\text{Call GEX}_i(S) = +\Gamma_i(S) \times S \times \text{OI}_{\text{Call}, i} \times L \times \left( \frac{S \times 0.01}{10^7} \right) \quad [\text{INR Crores per 1\% move}]$$

$$\text{Put GEX}_i(S) = -\Gamma_i(S) \times S \times \text{OI}_{\text{Put}, i} \times L \times \left( \frac{S \times 0.01}{10^7} \right) \quad [\text{INR Crores per 1\% move}]$$

$$\text{Net GEX}(S) = \sum_{i=1}^{M} \left[ \text{Call GEX}_i(S) + \text{Put GEX}_i(S) \right] \quad [\text{INR Crores per 1\% move}]$$

*Note:* Division by $10^7$ converts raw Indian Rupees (INR) into **Crores** ($1\text{ Crore} = 10,000,000\text{ INR}$).

##### Microstructure Mechanics of Dealer Delta Re-Hedging:
Let $\Delta_{\text{MM}}$ be the aggregate market maker inventory delta. Market makers hedge to maintain $\Delta_{\text{MM}} \approx 0$ by trading underlying futures or cash equities $Q_{\text{hedge}} = -\Delta_{\text{MM}}$.
$$\frac{\partial Q_{\text{hedge}}}{\partial S} = -\frac{\partial \Delta_{\text{MM}}}{\partial S} = -\text{Net GEX}(S)$$

1. **When $\text{Net GEX}(S) > 0$ (Positive Gamma Regime):**
   - Spot rises ($\Delta S > 0$): $\frac{\partial Q_{\text{hedge}}}{\partial S} < 0 \implies$ Dealers must **sell underlying assets** to remain neutral.
   - Spot falls ($\Delta S < 0$): $\frac{\partial Q_{\text{hedge}}}{\partial S} > 0 \implies$ Dealers must **buy underlying assets** to remain neutral.
   - **Economic Impact:** Contrarian rebalancing dampens market moves, compresses realized volatility, suppresses breakouts, and pins prices near high-OI strikes.
2. **When $\text{Net GEX}(S) < 0$ (Negative Gamma Regime):**
   - Spot rises ($\Delta S > 0$): $\frac{\partial Q_{\text{hedge}}}{\partial S} > 0 \implies$ Dealers must **buy underlying assets** into the rally.
   - Spot falls ($\Delta S < 0$): $\frac{\partial Q_{\text{hedge}}}{\partial S} < 0 \implies$ Dealers must **sell underlying assets** into the decline.
   - **Economic Impact:** Pro-cyclical momentum feedback loop triggers explosive moves, cascading stop-outs, high realized volatility, and **Gamma Squeezes**.

---

#### 3.2 Net Gamma Flip Boundary Formulation ($S^*$)
The **Gamma Flip Boundary** is the critical spot price $S^*$ at which aggregate dealer gamma exposure transitions through zero:
$$\text{Net GEX}(S^*) \equiv 0$$

Because $\text{Net GEX}(S)$ is a non-linear, multi-modal continuous function across all active strikes $K_1, \dots, K_M$, locating $S^*$ requires a robust root-finding algorithm.

##### Numerical Solver (Brent-Dekker Hybrid Algorithm):
The engine implements the **Brent-Dekker hybrid method** (combining bisection, secant method, and inverse quadratic interpolation) over the interval $[S_{\min}, S_{\max}] = [S \times 0.90, S \times 1.10]$:
1. Evaluate bracket endpoints: $f(a) = \text{Net GEX}(S_{\min})$ and $f(b) = \text{Net GEX}(S_{\max})$.
2. If $f(a) \cdot f(b) > 0$, scan intermediate strike sub-intervals $[K_i, K_{i+1}]$ to identify sign changes.
3. Iterate until convergence:
   $$|S_{k+1} - S_k| < \epsilon_{\text{tol}} \quad (\text{with } \epsilon_{\text{tol}} = 0.50\text{ Index Points}, \text{ execution } < 1.0\text{ ms})$$

##### Curvature & Gamma Sensitivity:
The rate of change of Net GEX with respect to spot defines the **Gamma Slope / Cliff Metric**:
$$\frac{d \text{Net GEX}}{dS} \approx \frac{\text{Net GEX}(S + \delta S) - \text{Net GEX}(S - \delta S)}{2 \delta S}$$
- A steep positive slope at $S^*$ indicates a razor-thin transition boundary where a modest 25-point index move can abruptly flip the market from tranquil mean-reversion into a high-volatility gamma squeeze.

---

#### 3.3 Dynamic Max Pain Migration with Intraday OI Velocity
The classical static Max Pain theory posits that market makers guide spot prices toward the strike price that inflicts maximum cumulative financial loss on option buyers, thereby maximizing dealer retained premium.

##### Classical Static Max Pain Formulation:
Let the total cash payout to option holders at expiry strike $K$ be:
$$\mathcal{P}_{\text{static}}(K) = \sum_{j=1}^{M} \left[ \text{OI}_{\text{Call}, j} \max(0, K - K_j) + \text{OI}_{\text{Put}, j} \max(0, K_j - K) \right] \times L$$
The static max pain strike is:
$$K^*_{\text{static}} = \arg\min_K \mathcal{P}_{\text{static}}(K)$$

##### Limitations of Static Max Pain on 0-DTE:
1. Ignores intraday writing and unwinding of positions ($\Delta \text{OI}$).
2. Fails to account for volume-weighted price discovery during morning institutional positioning (09:15 - 11:30 IST).
3. Ignores cash-settlement tax penalties (STT on exercise) that distort exercise economics.

##### Dynamic Max Pain Migration Formulation:
Let $t \in [0, 1]$ represent elapsed trading time from 09:15 to 15:30 IST.  
The **Intraday Open Interest Velocity** $\nu_j(t)$ for strike $j$ is:
$$\nu_j(t) = \frac{\Delta \text{OI}_j(t)}{\Delta t} \quad [\text{Contracts / Hour}]$$
The instantaneous open interest is:
$$\text{OI}_j(t) = \text{OI}_{j, \text{open}} + \int_0^t \nu_j(\tau) d\tau$$

The **Volume-Weighted Pressure Factor** $w_j(t)$ incorporates traded turnover:
$$w_j(t) = 1 + \alpha_{\text{vol}} \left( \frac{\text{Volume}_j(t)}{\sum_{k=1}^M \text{Volume}_k(t)} \right)$$
where $\alpha_{\text{vol}} \approx 0.35$ is the empirical liquidity weight.

The **Statutory Cash-Settlement Penalty** $\Pi_{\text{tax}}(K)$ incorporates SEBI STT (0.125% on exercised ITM call option intrinsic value):
$$\Pi_{\text{tax}}(K) = \sum_{j: K > K_j} \text{OI}_{C, j}(t) \times (K - K_j) \times L \times \tau_{\text{STT}} \quad (\tau_{\text{STT}} = 0.00125)$$

The **Dynamic Rupee Pain Function** is:
$$\mathcal{P}_{\text{dyn}}(K, t) = \sum_{j=1}^{M} \left[ \text{OI}_{C, j}(t) w_{C, j}(t) \max(0, K - K_j) + \text{OI}_{P, j}(t) w_{P, j}(t) \max(0, K_j - K) \right] \times L + \Pi_{\text{tax}}(K)$$

The **Dynamic Max Pain Strike** is:
$$K^*_{\text{dyn}}(t) = \arg\min_K \mathcal{P}_{\text{dyn}}(K, t)$$

##### Dynamic Migration Velocity Vector:
$$v_{\text{pain}}(t) = \frac{d K^*_{\text{dyn}}}{dt} \approx \frac{K^*_{\text{dyn}}(t) - K^*_{\text{dyn}}(t - \Delta t)}{\Delta t} \quad [\text{Points / Hour}]$$
- $v_{\text{pain}} > 0$: Bullish Max Pain Migration (Call short-covering and upward put writing).
- $v_{\text{pain}} < 0$: Bearish Max Pain Migration (Put unwinding and downward call writing).
- The **Gravitational Pull Metric** $\mathcal{G}(S, t)$ measures the restoring force drawing spot toward dynamic max pain:
  $$\mathcal{G}(S, t) = -\kappa_{\text{pain}} \frac{S - K^*_{\text{dyn}}(t)}{\sqrt{T}}$$

---

#### 3.4 Terminal Strike Pinning Probability (Fokker-Planck Drift-Diffusion Model)
As expiration approaches 15:30 IST ($T \to 0$), the Black-Scholes delta function $\phi(d_1)$ collapses into a Dirac delta distribution $\delta(S - K_i)$, causing local gamma to spike to infinity directly at the strike price. Market makers hedging near an ATM strike with massive open interest create an endogenous non-linear restoring force.

##### The Stochastic Differential Equation (SDE) with Hedging Feedback:
The evolution of the underlying spot index $S_t$ on expiry afternoon is governed by:
$$dS_t = \mu_{\text{eff}}(S_t, t) dt + \sigma_{\text{eff}}(S_t, t) dW_t$$

Where:
1. **Effective Restoring Drift $\mu_{\text{eff}}(S_t, t)$:**
   $$\mu_{\text{eff}}(S_t, t) = \mu_0 - \lambda_{\text{dealer}} \sum_{i=1}^M \Gamma_i(S_t, t) \cdot \text{OI}_i \cdot (S_t - K_i)$$
   - When $S_t > K_i$ near a high-OI strike, $\mu_{\text{eff}} < 0$ (dealers sell underlying, pulling spot down).
   - When $S_t < K_i$ near a high-OI strike, $\mu_{\text{eff}} > 0$ (dealers buy underlying, pulling spot up).
   - The strike acts as a statistical **gravitational well (potential minimum)**.
2. **Effective Volatility $\sigma_{\text{eff}}(S_t, t)$:**
   $$\sigma_{\text{eff}}(S_t, t) = \sigma_{\text{base}} \cdot \max \left( 0.15, \, 1 - \beta_{\text{gex}} \frac{\text{Net GEX}(S_t)}{\sum |\text{GEX}_i|} \right)$$
   - In positive net dealer gamma, realized volatility collapses as dealers absorb liquidity.
   - In negative net dealer gamma, volatility expands dramatically.

##### Forward Kolmogorov (Fokker-Planck) Partial Differential Equation:
The probability density function $p(S, t)$ of spot price $S$ at future time $t \le T_{\text{expiry}}$ satisfies:
$$\frac{\partial p(S, t)}{\partial t} = -\frac{\partial}{\partial S} \left[ \mu_{\text{eff}}(S, t) p(S, t) \right] + \frac{1}{2} \frac{\partial^2}{\partial S^2} \left[ \sigma_{\text{eff}}^2(S, t) p(S, t) \right]$$

##### Asymptotic Client-Side Solver:
To evaluate this PDE in real time within a browser environment ($< 5.0\text{ ms}$), the engine deploys a **local multi-strike Gaussian mixture asymptotic approximation**:
Let $U(S) = \frac{1}{2} \lambda \sum_{i} \text{GEX}_i (S - K_i)^2$ be the dealer potential energy well.  
Under stationary equilibrium in the vicinity of 15:30 IST:
$$p(S, T_{\text{expiry}}) \propto \exp\left( -\frac{2 U(S)}{\sigma_{\text{eff}}^2} \right) \cdot \frac{1}{\sqrt{2\pi \sigma_S^2}} \exp\left( -\frac{(S - S_0)^2}{2 \sigma_S^2} \right)$$

##### Terminal Strike Pinning Probability:
For each strike $K_i$ with strike width $\Delta K = K_{i+1} - K_i$ (e.g. 50 pts for NIFTY, 100 pts for BANKNIFTY):
$$P_{\text{pin}}(K_i) = \int_{K_i - \frac{\Delta K}{2}}^{K_i + \frac{\Delta K}{2}} p(S, T_{\text{expiry}}) dS$$
$$\sum_{i=1}^M P_{\text{pin}}(K_i) = 1.00 \quad (100\%)$$

The **Pinning Confidence Score** ($0\% \text{ to } 100\%$) is:
$$\text{Score}_{\text{pin}}(K^*) = \max_i P_{\text{pin}}(K_i) \times \left( 1 - \frac{|S_{\text{current}} - K^*|}{0.01 \times S_{\text{current}}} \right) \times \min\left(1.0, \frac{\text{Net GEX}}{\text{GEX}_{\text{threshold}}}\right)$$

---

#### 3.5 0-DTE Intraday Theta Burn Acceleration & Volatility Crush Dynamics

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   0-DTE INTRADAY EXPONENTIAL THETA ACCELERATION PROFILE                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   THETA DECAY (Points / Hour)                                                                    │
│   ▲                                                                                              │
│   │                                                                                              │
│   │                                                                             █  15:15 IST     │
│   │                                                                            ██  (-85 pts/hr)  │
│   │                                                                           ███                │
│   │                                                             POST-13:30   ████                │
│   │                                                             VOL CRUSH   █████                │
│   │                                                                ZONE    ██████                │
│   │                                                                       ███████                │
│   │                                                          ▄▄▄▄████████████████                │
│   │                           ▄▄▄▄▄▄▄████████████████████████████████████████████                │
│   │ ░░░░█████████████████████████████████████████████████████████████████████████                │
│   └─┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────►  │
│   09:15          10:30          11:45          13:00          14:15          15:30      TIME     │
│                                                                                                  │
│   Theta Decay:  -12 pts/hr     -18 pts/hr     -28 pts/hr     -48 pts/hr    -120 pts/hr           │
│   ATM Gamma:     0.0018         0.0026         0.0042         0.0085         0.0380              │
│   Implied Vol:    13.8%          13.4%          12.9%          11.2%           8.5% (Crush)      │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

##### Analytical Black-Scholes Theta Formulation:
$$\Theta(S, K, T, \sigma) = -\frac{S \sigma \phi(d_1)}{2 \sqrt{T}} - r K e^{-r T} N(d_2)$$

For 0-DTE contracts, $T$ is expressed in minute fractions of an annualized year ($T = \frac{\tau_{\text{mins}}}{94,500}$).  
As $T \to 0$, the first term dominates completely:
$$\lim_{T \to 0} \Theta_{\text{ATM}} \sim -\frac{S \sigma}{2 \sqrt{2\pi}} \cdot \frac{1}{\sqrt{T}} \propto -\frac{1}{\sqrt{T}}$$

##### Mathematical Properties of 0-DTE Intraday Theta:
1. **The $1/\sqrt{T}$ Singularity:**
   At 09:15 IST ($\tau = 375\text{ mins}$), $1/\sqrt{T} = 15.87$.  
   At 13:30 IST ($\tau = 120\text{ mins}$), $1/\sqrt{T} = 28.06$ (a **77% acceleration**).  
   At 15:00 IST ($\tau = 30\text{ mins}$), $1/\sqrt{T} = 56.12$ (a **254% acceleration**).  
   At 15:20 IST ($\tau = 10\text{ mins}$), $1/\sqrt{T} = 97.21$ (a **512% acceleration**).
2. **Post-13:30 Volatility Crush Function:**
   As institutional participants close or roll open risk into next-week expiries, uncertainty dissolves. Implied volatility collapses toward realized intraday volatility according to an exponential decay:
   $$\sigma_{\text{implied}}(t) = \sigma_{\text{terminal}} + \left( \sigma_{\text{open}} - \sigma_{\text{terminal}} \right) \exp\left( -\lambda_{\text{crush}} (t - t_{13:30})^+ \right)$$
   where $\lambda_{\text{crush}} \approx 1.85\text{ hr}^{-1}$, causing a **30% to 50% relative IV collapse** between 13:30 and 15:15 IST.
3. **The Gamma-Theta Risk Ratio $\mathcal{R}_{\Gamma/\Theta}$:**
   $$\mathcal{R}_{\Gamma/\Theta}(S) = \frac{|\Gamma(S)|}{|\Theta(S)|} \approx \frac{2}{S \sigma^2}$$
   While the ratio between Gamma and Theta remains bounded for ATM options, the absolute risk values diverge: an option seller at 14:45 IST collects astronomical theta decay per minute, but faces near-infinite gamma risk if a directional shock of just $0.20\%$ occurs, triggering an instantaneous 400% premium surge.

---

### 4. System Architecture & High-Throughput Worker Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   TRADECRAFT AI - 0-DTE GAMMA RISK WORKER PIPELINE                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   LIVE WEBSOCKET FEED / DOM REPLAY (Sprint 4)                                                    │
│   [Tick-by-Tick Level-2 Market Depth: Bid/Ask, LTP, Volume, Open Interest]                       │
│                                │                                                                 │
│                                ▼                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ DEDICATED WEB WORKER: optionsGammaRisk.worker.ts                                         │   │
│   ├──────────────────────────────────────────────────────────────────────────────────────────┤   │
│   │                                                                                          │   │
│   │ STAGE 1: OPTION CHAIN GREEKS & STRIKE GEX MATRIX (< 1.5ms)                              │   │
│   │ • Vectorized Black-Scholes Gamma & Theta across all 60 active strikes                    │   │
│   │ • Compute Call GEX and Put GEX in INR Crores per 1% spot move                            │   │
│   │                                                                                          │   │
│   │ STAGE 2: BRENT-DEKKER GAMMA FLIP SOLVER (< 1.0ms)                                        │   │
│   │ • Bracket search root S^* where Net GEX(S^*) = 0                                         │   │
│   │ • Classify Regime: Long Gamma (Suppression) vs Short Gamma (Squeeze)                     │   │
│   │                                                                                          │   │
│   │ STAGE 3: DYNAMIC MAX PAIN MIGRATION & OI VELOCITY (< 1.2ms)                              │   │
│   │ • Compute d(OI)/dt contract velocity vector                                              │   │
│   │ • Volume-weighted pain curve evaluation with STT exercise penalty                        │   │
│   │ • Project Max Pain migration trajectory and spot gravitational pull                      │   │
│   │                                                                                          │   │
│   │ STAGE 4: FOKKER-PLANCK TERMINAL PINNING DENSITY SOLVER (< 2.0ms)                         │   │
│   │ • Restoring drift and volatility damping calculation                                     │   │
│   │ • Terminal probability density p(S, 15:30) integration per strike                        │   │
│   │ • Pinning Confidence Score & Pinning Resistance Index                                    │   │
│   │                                                                                          │   │
│   │ STAGE 5: 0-DTE THETA ACCELERATOR & VOL CRUSH FORECASTER (< 0.8ms)                         │   │
│   │ • Intraday 1/sqrt(T) theta decay curve generation for 09:15 to 15:30 IST                 │   │
│   │ • Post-13:30 IV crush projections and Gamma/Theta risk trade-off ratio                   │   │
│   │                                                                                          │   │
│   │ STAGE 6: GAMMA SQUEEZE BREAKOUT ALERT GENERATOR (< 0.5ms)                                │   │
│   │ • Compare Net GEX, Spot Velocity, and Breakout Distance                                  │   │
│   │ • Emit SQUEEZE_WARNING, SHORT_GAMMA_ACCELERATION, or PIN_ALERT                           │   │
│   │                                                                                          │   │
│   └────────────────────────────────────────────┬─────────────────────────────────────────────┘   │
│                                                │                                                 │
│                                                ▼                                                 │
│   POST MESSAGE TO REACT DOM UI (< 8.0ms Total Pipeline Latency, 60 FPS Target)                   │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1 Latency Budget & Worker Architecture
To guarantee smooth UI responsiveness during rapid market moves:
1. **Dedicated Web Worker (`optionsGammaRisk.worker.ts`):** All mathematical routines (Black-Scholes Greek evaluations across 60 strikes, Brent-Dekker root finding, Fokker-Planck integration, and pain surface computations) run completely off the main UI thread.
2. **Pre-Allocated Typed Arrays (`Float64Array`):** The engine uses fixed-length buffers for strikes, open interest, and Greek matrices, eliminating heap allocations and garbage collection pauses.
3. **Sub-10ms Latency Budget:**
   - Vectorized Greeks & Strike GEX: $\le 1.5\text{ ms}$
   - Brent-Dekker Gamma Flip Root Finding: $\le 1.0\text{ ms}$
   - Dynamic Max Pain & OI Velocity: $\le 1.2\text{ ms}$
   - Fokker-Planck Strike Pinning Integration: $\le 2.0\text{ ms}$
   - Theta Burn & IV Crush Forecaster: $\le 0.8\text{ ms}$
   - Squeeze Alert Evaluation & State Assembly: $\le 0.5\text{ ms}$
   - **Total Compute Latency:** $\le 7.0\text{ ms}$ ($p99 < 10.0\text{ ms}$).

---

### 5. Detailed Feature Scope & User Stories

#### 5.1 User Story 1: Real-Time Dealer GEX Profiler (`TC-OGEX-01`)
* **As an Options Scalper / Volatility Trader**, I want to see the real-time dealer Gamma Exposure (GEX) across every strike in INR Crores per 1% move, so that I know whether dealers are suppressing volatility or fueling directional momentum.
* **Acceptance Criteria:**
  - Evaluates Black-Scholes Gamma for all active call and put strikes on the expiring 0-DTE chain.
  - Computes Call GEX ($+\text{INR Crores}$), Put GEX ($-\text{INR Crores}$), and Net GEX per strike.
  - Multiplies contract open interest by statutory lot size ($L = 25$ for NIFTY, $15$ for BANKNIFTY, $10$ for SENSEX).
  - Displays aggregate Net GEX in INR Crores per 1% move with color-coded regime indicators (Green = Positive/Long Gamma; Crimson = Negative/Short Gamma).
  - Re-evaluates on every market tick in $< 8\text{ ms}$.

#### 5.2 User Story 2: Net Gamma Flip Boundary Detection (`TC-OGEX-02`)
* **As a Systematic Intraday Trader**, I want the platform to automatically locate the Net Gamma Flip price ($S^*$), so that I can anticipate explosive breakout moves whenever spot crosses into the short gamma zone.
* **Acceptance Criteria:**
  - Solves for root $S^*$ where $\text{Net GEX}(S^*) \equiv 0$ using Brent-Dekker hybrid method.
  - Computes the distance in points and percentage from current spot to Gamma Flip ($\Delta S_{\text{flip}} = S - S^*$).
  - Evaluates the Gamma Cliff Slope ($\frac{d\text{GEX}}{dS}$) to assess transition sensitivity.
  - Classifies market state into:
    - **`LONG_GAMMA_SUPPRESSION`** ($S > S^*$ and $\text{Net GEX} > +₹500\text{ Cr}$): Realized vol suppressed; mean-reversion favored.
    - **`NEUTRAL_TRANSITION_ZONE`** ($|S - S^*| \le 0.20\%$): Fragile equilibrium; high inflection sensitivity.
    - **`SHORT_GAMMA_ACCELERATION`** ($S < S^*$ and $\text{Net GEX} < -₹500\text{ Cr}$): Extreme volatility expansion; breakout momentum favored.

#### 5.3 User Story 3: Dynamic Max Pain Migration Tracker (`TC-OGEX-03`)
* **As an Expiry Day Option Seller**, I want to track the intraday migration of Max Pain with open interest velocity and cash-settlement penalties, so that I do not get trapped defending a stale opening strike.
* **Acceptance Criteria:**
  - Continuously computes instantaneous open interest velocity $\vec{\nu}_{\text{OI}}(t)$ from intraday tick snapshots.
  - Calculates the Dynamic Rupee Pain curve incorporating volume-weighted pressure factors and statutory SEBI STT on exercise.
  - Solves for the dynamic minimum pain strike $K^*_{\text{dyn}}(t)$.
  - Computes Migration Velocity $v_{\text{pain}}$ in Points/Hour.
  - Renders an interactive migration trajectory showing opening vs current Max Pain with directional drift arrows.

#### 5.4 User Story 4: Fokker-Planck Terminal Strike Pinning Probability (`TC-OGEX-04`)
* **As an Iron Condor / Butterfly Strategist**, I want a quantitative model that outputs the exact probability of spot pinning at each strike at 15:30 IST, so that I can center my multi-leg neutral strategies around the highest-probability pin.
* **Acceptance Criteria:**
  - Solves the Fokker-Planck drift-diffusion forward equation with dealer restoring drift $\mu_{\text{eff}}(S, t)$ and damped volatility $\sigma_{\text{eff}}(S, t)$.
  - Computes terminal strike pinning probability $P_{\text{pin}}(K_i)$ for all strikes within $\pm 3\%$ of spot.
  - Ensures $\sum P_{\text{pin}}(K_i) \equiv 100\%$.
  - Highlights the **Primary Pin Target Strike** ($K^*_{\text{pin}}$) and displays the Pinning Confidence Score ($0-100\%$).
  - Computes the **Pinning Resistance Barrier** (Rupee capital required to dislodge spot from the pinned strike).

#### 5.5 User Story 5: 0-DTE Hyper-Theta Burn & Volatility Crush Forecaster (`TC-OGEX-05`)
* **As an Expiry Day Theta Trader**, I want to visualize the asymptotic $1/\sqrt{T}$ theta decay curve and post-13:30 IV crush, so that I can time my premium harvesting entries and exits without taking excess tail risk.
* **Acceptance Criteria:**
  - Plots the continuous theoretical intraday theta decay curve (Points / Hour) from 09:15 to 15:30 IST.
  - Models post-13:30 IST IV crush with customizable decay parameter $\lambda_{\text{crush}}$.
  - Displays instantaneous ATM theta decay rate (e.g. ₹42.50 per lot per 15 minutes).
  - Evaluates the Gamma-Theta Risk Ratio $\mathcal{R}_{\Gamma/\Theta}$, warning users when gamma risk outpaces theta decay.

#### 5.6 User Story 6: Real-Time Gamma Squeeze & Breakout Detector (`TC-OGEX-06`)
* **As a Risk Manager**, I want automated alert triggers that detect impending Gamma Squeezes, so that our desk can de-risk short options or execute protective delta hedges before cascading stop-outs occur.
* **Acceptance Criteria:**
  - Emits real-time alerts under the following quantitative conditions:
    - **`ALERT_GAMMA_FLIP_BREACH`**: Spot crosses from positive to negative dealer gamma.
    - **`ALERT_GAMMA_SQUEEZE_IMMINENT`**: $\text{Net GEX} < -₹1,000\text{ Cr}$ and spot velocity $> 50\text{ pts/15 min}$.
    - **`ALERT_PIN_LOCK_CONFIRMED`**: Time $> 14:30\text{ IST}$, spot within 15 pts of $K^*_{\text{pin}}$, and Pin Confidence $> 80\%$.
    - **`ALERT_IV_CRUSH_ACCELERATION`**: Average chain IV drops by $> 2.5\text{ vol pts}$ in $< 30\text{ mins}$.

#### 5.7 User Story 7: Institutional 0-DTE Gamma Cockpit Terminal UI (`TC-OGEX-07`)
* **As a Head of Derivatives Trading**, I want an integrated dark-mode institutional cockpit dashboard displaying GEX strike ladders, flip gauges, pain migration, and pinning probabilities, so that our desk has total situational awareness on expiry days.
* **Acceptance Criteria:**
  - Dark-mode, high-density Bloomberg-style UI layout.
  - Bidirectional horizontal GEX bar chart: Call GEX (Green, right) vs Put GEX (Crimson, left).
  - Dynamic Gamma Flip needle gauge indicating spot distance to flip point.
  - Max Pain Migration time-series path chart with real-time gravitational pull vector.
  - Fokker-Planck strike pinning probability histogram with shaded 1-sigma confidence bands.
  - Real-time Theta Burn odometer and Gamma Squeeze alert banner.

---

### 6. TypeScript Data Models & Contract Specifications

```typescript
// ============================================================================
// TradeCraft AI - Real-Time Options Gamma Squeeze & 0-DTE Pinning Engine (Sprint 24)
// File: src/types/optionsGammaRisk.ts
// ============================================================================

export type ExpiryDayRegime = 'LONG_GAMMA_SUPPRESSION' | 'NEUTRAL_TRANSITION_ZONE' | 'SHORT_GAMMA_ACCELERATION';
export type UnderlyingSymbol = 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'MIDCPNIFTY' | 'SENSEX' | 'BANKEX';

export interface OptionStrikeData {
  strikePrice: number;
  callOI: number;                // In contracts
  putOI: number;                 // In contracts
  callVolume: number;            // Cumulative volume
  putVolume: number;             // Cumulative volume
  callLtp: number;               // Last Traded Price
  putLtp: number;                // Last Traded Price
  callIV: number;                // Implied Volatility (e.g. 0.135 for 13.5%)
  putIV: number;                 // Implied Volatility
  callDelta: number;             // Black-Scholes Delta (0.0 to 1.0)
  putDelta: number;              // Black-Scholes Delta (-1.0 to 0.0)
  callGamma: number;             // Black-Scholes Gamma
  putGamma: number;              // Black-Scholes Gamma
  callTheta: number;             // Rupee Theta per day / hour
  putTheta: number;              // Rupee Theta per day / hour
  callOIVelocity: number;        // d(OI)/dt contracts/hour
  putOIVelocity: number;         // d(OI)/dt contracts/hour
}

export interface StrikeGEXMetrics {
  strikePrice: number;
  callGexCr: number;             // Call GEX in INR Crores per 1% move (+)
  putGexCr: number;              // Put GEX in INR Crores per 1% move (-)
  netGexCr: number;              // Call GEX + Put GEX
  gammaWeightPct: number;        // Contribution to chain total gamma
  isAtTheMoney: boolean;
  pinningProbabilityPct: number; // Fokker-Planck terminal pinning probability (0-100%)
}

export interface GammaFlipBoundaryResult {
  gammaFlipSpot: number;         // Inflection price S* where Net GEX = 0
  currentSpot: number;
  spotDistancePts: number;       // S - S*
  spotDistancePct: number;       // ((S - S*) / S*) * 100
  regime: ExpiryDayRegime;
  gammaCliffSlope: number;       // d(Net GEX) / dS (Cr / pt)
  transitionSensitivity: 'LOW' | 'MODERATE' | 'EXTREME';
}

export interface DynamicMaxPainMetrics {
  staticMaxPainStrike: number;   // Opening 09:15 static pain strike
  dynamicMaxPainStrike: number;  // Real-time dynamic pain strike K*
  painMigrationDistancePts: number; // K*_dyn - K*_static
  migrationVelocityPtsPerHour: number; // v_pain
  migrationDirection: 'BULLISH' | 'BEARISH' | 'STATIONARY';
  spotGravitationalPullScore: number;  // Restoring force index (-100 to +100)
  estimatedSettlementPainRupeesCr: number; // Retained dealer premium at K*
}

export interface FokkerPlanckPinningReport {
  primaryPinStrike: number;      // Strike with maximum terminal probability
  pinningConfidenceScorePct: number; // 0% - 100%
  expectedSettlementRange: {
    lower1Sigma: number;
    upper1Sigma: number;
    lower2Sigma: number;
    upper2Sigma: number;
  };
  pinningResistanceCr: number;   // Capital in INR Cr required to break the pin
  effectiveRestoringDrift: number; // \mu_eff
  effectiveDampedVolatility: number; // \sigma_eff
}

export interface ThetaBurnProfile {
  annualizedTimeToExpiry: number; // T
  minutesRemainingTo1530: number; // \tau
  currentAtmThetaPerHourCr: number; // Aggregate theta burn in INR Cr / hr
  hyperThetaAccelerationFactor: number; // Ratio vs 09:15 open rate (1.0x to 10.0x)
  projectedIvCrushPct: number;   // Expected IV collapse percentage post-13:30
  gammaThetaRatio: number;       // |\Gamma| / |\Theta| risk ratio
  isHighGammaHazardZone: boolean; // Flagged post-14:00 when Gamma explodes
}

export interface GammaSqueezeAlert {
  alertId: string;
  timestamp: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: 'GAMMA_FLIP_BREACH' | 'GAMMA_SQUEEZE_IMMINENT' | 'PIN_LOCK_CONFIRMED' | 'IV_CRUSH_SURGE';
  message: string;
  triggerValues: {
    spot: number;
    flipSpot: number;
    netGexCr: number;
    velocityPtsPerHour: number;
  };
  recommendedAction: string;
}

export interface OptionsGammaRiskSummary {
  symbol: UnderlyingSymbol;
  timestamp: number;
  currentSpot: number;
  lotSize: number;
  expiryDate: string;
  timeToExpiryMinutes: number;
  totalNetGexCr: number;         // Total Net GEX in INR Crores per 1% move
  totalCallGexCr: number;        // Total Call GEX
  totalPutGexCr: number;         // Total Put GEX
  gammaFlip: GammaFlipBoundaryResult;
  dynamicMaxPain: DynamicMaxPainMetrics;
  pinningReport: FokkerPlanckPinningReport;
  thetaProfile: ThetaBurnProfile;
  strikeGexLadder: StrikeGEXMetrics[];
  activeAlerts: GammaSqueezeAlert[];
}
```

---

### 7. Institutional UI Cockpit Specification

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TRADECRAFT AI // 0-DTE OPTIONS GAMMA SQUEEZE & EXPIRY PINNING COCKPIT (NIFTY 50 0-DTE)          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SPOT: 24,520.40 (+112.5) │ NET GEX: +₹1,480 Cr/1% [LONG GAMMA] │ FLIP: 24,380.00 (Dist: +140.4 pt)│
│ DYN MAX PAIN: 24,500.00  │ MIGRATION: +50 pt/hr (BULLISH)      │ PIN TARGET: 24,500 (Conf: 84.5%)│
│ 0-DTE THETA: ₹142 Cr/hr  │ ACCELERATION: 4.2x [VOL CRUSH ZONE] │ HAZARD: ELEVATED POST-14:00     │
├──────────────────────────────────────┬───────────────────────────────────┬───────────────────────┤
│ 1. DEALER GEX STRIKE LADDER          │ 2. FOKKER-PLANCK PINNING DENSITY  │ 3. GAMMA FLIP & REGIME│
│ Strike  Put GEX (Cr)   Call GEX (Cr) │ Strike  Pin Prob% Density Map     │ Net GEX: +₹1,480 Cr   │
│ 24,700  ░░░░░░░ -40    ███████ +480  │ 24,650  [█░░░░░░░░░]  4.2%        │ Regime: [LONG GAMMA]  │
│ 24,650  ░░░░░░░ -65    ████████+610  │ 24,600  [███░░░░░░░] 12.8%        │ Volatility Suppressed │
│ 24,600  ░░░░░░ -110    ████████+820  │ 24,550  [█████░░░░░] 22.4%        │                       │
│ 24,550  ░░░░░░ -180    ██████  +490  │ 24,500  [█████████░] 44.6% [PIN]  │ Spot:  24,520.40      │
│ 24,500* ░░░░░░ -320    ███████ +640  │ 24,450  [███░░░░░░░] 11.2%        │ Flip:  24,380.00      │
│ 24,450  ░░░░░░ -290    ████    +310  │ 24,400  [█░░░░░░░░░]  4.8%        │ Buffer: +140.40 pts   │
│ 24,400  ░░░░░░ -410    ███     +190  │                                   │ Cliff:  38.5 Cr/pt    │
│ 24,350  ░░░░░░ -580    ██      +110  │ Primary Target: 24,500 Strike     │                       │
│ 24,300  ░░░░░░ -720    █        +50  │ 1-Sigma Band: 24,475 - 24,525     │ [GAMMA NEEDLE GAUGE]: │
│                                      │ Pin Resistance: ₹420 Cr Capital   │ [◄── SHORT ──┼── LONG]│
│ Net Gamma Flip Boundary: 24,380.00   │ Restoring Drift: -14.2 pts/hr     │       ▲ Spot Here     │
├──────────────────────────────────────┼───────────────────────────────────┼───────────────────────┤
│ 4. DYNAMIC MAX PAIN MIGRATION PATH   │ 5. 0-DTE HYPER-THETA ACCELERATOR  │ 6. GAMMA SQUEEZE RADAR│
│ Static Open Pain (09:15): 24,450.00  │ Intraday Theta Rate: 4.2x open    │ ACTIVE ALERTS: (1)    │
│ Current Dynamic Pain:     24,500.00  │ ATM Decay: -₹85.00/lot/15-min     │ [CRITICAL] NONE       │
│ Migration Velocity: +25.0 pts/hr     │ Implied Volatility: 11.2% (-2.6v) │ [INFO] PIN_LOCK_CONF  │
│                                      │ Gamma/Theta Ratio: 0.082 (STABLE) │ 24,500 Pin Conf >80%  │
│ [MIGRATION TRAJECTORY CHART]         │                                   │                       │
│ 24,550 │                 ╭── 24,500  │ [13:30 - 15:30 CRUSH ENGINE]      │ [STRATEGY RECOMMEND]: │
│ 24,500 │       ╭─────────╯           │ Expected Extrinsic Burn: -72%     │ Deploy 24,500 Iron    │
│ 24,450 │ ──────╯                     │ ATM Call: ₹18.50 ──► ₹4.20        │ Fly / Straddle Sell   │
│        └───────────────────────────► │ ATM Put:  ₹16.80 ──► ₹3.10        │ Target: 15:15 IST Exit│
│        09:15   11:00   13:00   15:30 │ Warning: Gamma hazard post-14:30  │ Stop: Spot < 24,440   │
└──────────────────────────────────────┴───────────────────────────────────┴───────────────────────┘
```

---

### 8. Non-Functional Requirements & Performance SLAs

1. **Sub-10ms End-to-End Pipeline Latency:**
   - Vectorized Black-Scholes Greeks, strike-level GEX summation, Brent-Dekker root finding, Dynamic Max Pain, and Fokker-Planck density integration must complete in **$\le 10.0\text{ ms}$** ($p99 < 12.0\text{ ms}$).
   - The React UI dashboard must render at a consistent **60 FPS** without frame drops during high-volatility market bursts.
2. **Dedicated Background Web Worker Execution:**
   - All computationally intensive mathematical loops execute inside `optionsGammaRisk.worker.ts`.
   - Main thread interaction is limited to receiving processed summary state via structured `postMessage` transfers.
3. **High-Frequency Ingestion & Throttling:**
   - Live WebSocket tick streams are throttled to a minimum update resolution of **$100\text{ ms}$**, preventing browser UI thrashing while preserving real-time fidelity.
4. **Numerical Stability & Singular Boundary Protection:**
   - As $T \to 0$ in the final minutes before 15:30 IST, numerical guards clamp $\sqrt{T} \ge \sqrt{1 / 94,500}$ to prevent division by zero in Black-Scholes Gamma ($\Gamma$) and Theta ($\Theta$).
   - Brent-Dekker solver incorporates safety fallbacks: if no root is found within $\pm 10\%$ of spot, the engine flags the regime as `EXTREME_MONODIRECTIONAL_GAMMA`.
5. **Zero-Knowledge Client-Side BYOK Security:**
   - All options chain data, volatility curves, positions, and GEX calculations execute strictly on the client device inside the browser.
   - Zero sensitive trade ideas, orders, or broker credentials are transmitted to any central TradeCraft AI server.

---

### 9. Verification & Test Matrix

| Test ID | Test Scenario Description | Expected Input Condition | Expected Result / System Assertion |
| :--- | :--- | :--- | :--- |
| `TC-TEST-OGEX-01` | Strike-by-Strike GEX Calculation Accuracy | NIFTY spot 24,500, Strike 24,500 CE OI = 1,00,000 contracts, IV = 13.5%, T = 120 mins | Call GEX calculated correctly in INR Crores per 1% move ($\approx +₹640\text{ Cr}$); Put GEX negative |
| `TC-TEST-OGEX-02` | Net GEX Positive Summation (Long Gamma) | Aggregate Call GEX exceeds Put GEX across all active strikes | Total Net GEX $> 0$; system classifies regime as `LONG_GAMMA_SUPPRESSION` |
| `TC-TEST-OGEX-03` | Net GEX Negative Summation (Short Gamma) | Heavy Put writing/buying causing Put GEX magnitude to exceed Call GEX | Total Net GEX $< 0$; system classifies regime as `SHORT_GAMMA_ACCELERATION` |
| `TC-TEST-OGEX-04` | Brent-Dekker Gamma Flip Root Finding | Net GEX positive above 24,380 and negative below 24,380 | Hybrid solver identifies $S^* = 24,380.00 \pm 0.5\text{ pts}$ in $< 1.0\text{ ms}$; confirms $\text{Net GEX}(S^*) \approx 0$ |
| `TC-TEST-OGEX-05` | Monodirectional Chain Gamma Flip Fallback | Chain where Call GEX dominates across all strikes without sign change | System reports no flip root within bracket; assigns persistent `LONG_GAMMA` status without crashing |
| `TC-TEST-OGEX-06` | Dynamic Max Pain vs Static Max Pain Divergence | Morning static pain at 24,400; heavy intraday Call unwinding and Put addition at 24,500 | Dynamic pain shifts to 24,500; migration velocity $v_{\text{pain}} > 0$; flags bullish migration |
| `TC-TEST-OGEX-07` | SEBI STT Cash-Settlement Penalty Integration | Deep ITM strikes evaluated under SEBI STT (0.125% of intrinsic) | Cash penalty $\Pi_{\text{tax}}$ correctly penalizes ITM strikes; shifts pain minimum accordingly |
| `TC-TEST-OGEX-08` | Fokker-Planck Strike Pinning Probability Sum | 0-DTE chain with 40 active strikes within $\pm 3\%$ of spot | Solves PDE; verifies $\sum_{i=1}^{40} P_{\text{pin}}(K_i) \equiv 100.0\% \pm 0.05\%$; highest probability at max OI strike |
| `TC-TEST-OGEX-09` | Restoring Drift Magnet Effect Verification | Spot at 24,515 with primary pin target at 24,500 in Long Gamma regime | Restoring drift $\mu_{\text{eff}} < 0$; indicates downward gravitational pull toward 24,500 pin |
| `TC-TEST-OGEX-10` | 0-DTE Asymptotic Theta Singularity Guard | Time to expiry $T \to 0$ ($\tau = 2\text{ mins}$ before 15:30 IST) | Theta calculation clamped without `NaN` or `Infinity`; exhibits expected asymptotic acceleration |
| `TC-TEST-OGEX-11` | Post-13:30 Volatility Crush Projection | Elapsed time past 13:30 IST with stable underlying price | Implied volatility curve models exponential decay; highlights 30%-50% extrinsic premium collapse |
| `TC-TEST-OGEX-12` | Gamma Squeeze Warning Trigger | Spot drops below Gamma Flip $S^*$ with Net GEX $< -₹1,000\text{ Cr}$ and rapid downward velocity | Triggers `ALERT_GAMMA_SQUEEZE_IMMINENT` with severity `CRITICAL` in $< 5\text{ ms}$ |
| `TC-TEST-OGEX-13` | Multi-Index Contract Lot Size Support | Switch underlying from NIFTY ($L=25$) to BANKNIFTY ($L=15$) and SENSEX ($L=10$) | Automatically applies correct lot multiplier and tick increments for all calculations |
| `TC-TEST-OGEX-14` | Execution Latency Benchmark | Full 60-strike Greek vector + Brent-Dekker + Fokker-Planck + Max Pain | Total worker pipeline execution completes in $\le 8.0\text{ ms}$; zero UI main-thread jank |

---
