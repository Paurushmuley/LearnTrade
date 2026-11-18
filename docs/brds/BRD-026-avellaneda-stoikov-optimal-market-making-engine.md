# Business Requirements Document (BRD) - Sprint 26

## Feature ID: `BRD-026`
## Feature Title: High-Frequency Market Making & Optimal Avellaneda-Stoikov Inventory Control Engine (Dynamic Reservation Price, Bid-Ask Spread Skewing, Inventory Penalties & HFT Execution Simulator)
**Author:** Researcher Lead (Autonomous Multi-Agent Cycle)  
**Date:** 2026-11-18  
**Status:** `COMPLETED & VERIFIED`  
**Target Milestone:** Sprint 26  
**Dependencies:**
- Sprint 1 (`taxEngine.ts` — Indian Statutory Taxes, STT, Transaction Charges)
- Sprint 4 (`marketDepthEngine.ts` — Tick-by-Tick Bar Replay & DOM Order Depth)
- Sprint 15 (`level3Engine.ts` — Real-Time L3 Order Book, Iceberg Detector & Dark Pool Flow Tracker)
- Sprint 17 (`executionAlgoEngine.ts` — VWAP/TWAP Execution & Almgren-Chriss Slippage Minimizer)
- Sprint 19 (`sorEngine.ts` — Cross-Exchange Arbitrage & Latency-Aware Smart Order Router)
- Sprint 20 (`fixProtocolEngine.ts` — Real-Time FIX Protocol Gateway & Drop-Copy Simulator)
- Sprint 22 (`riskEngine.ts` — High-Frequency Pre-Trade Risk Engine, Circuit Breakers & SPAN Margin)
- Sprint 25 (`vpinEngine.ts` — Real-Time Order Flow Toxicity & VPIN Microstructure Engine)

---

### 1. Executive Summary & Problem Statement

#### 1.1 Context: The Quantitative Dilemma of High-Frequency Market Making
In modern electronic limit order books across the National Stock Exchange of India (NSE) and Bombay Stock Exchange (BSE), market makers (MMs) provide two-sided liquidity by simultaneously quoting passive limit buy orders (bids) and passive limit sell orders (asks). The market maker's fundamental economic objective is to capture the quoted bid-ask spread ($s = p_a - p_b > 0$) as compensation for liquidity provision, while maintaining inventory neutrality.

However, high-frequency market making is fraught with two existential risks:
1. **Adverse Selection Risk:** Informed counterparties (e.g., institutional block traders, low-latency cross-market arbitrageurs, and momentum algos) possess superior information or speed. When an informed trader sweeps the order book, the market maker's quote is filled immediately before the midprice jumps unfavorably. Market makers who passively quote symmetric spreads around the midprice will consistently buy before price drops and sell before price rallies.
2. **Inventory Risk:** In real-world order books, executions arrive as stochastic, asynchronous Poisson jump events. A market maker who is repeatedly filled on one side accumulates a directional position (long or short inventory $q$). Holding non-zero inventory exposes the market maker to stochastic price diffusion variance ($\sigma^2$), carrying the risk of catastrophic drawdown during adverse intraday market trends.

To survive and achieve positive risk-adjusted returns (Sharpe ratio $> 3.5$), a market maker cannot quote fixed, symmetric spreads centered on the market midprice. Instead, the market maker must dynamically adjust their pricing:
- Calculate an **indifference or reservation price** $r(s, q, t)$ that reflects their subjective valuation of the asset given their current inventory $q$.
- **Skew quotes asymmetrically**: When holding long inventory ($q > 0$), the MM must lower both bid and ask quotes below midprice, making the ask quote highly attractive to induce incoming buying flow (unloading inventory), while making the bid quote unattractive to repel additional long fills. Conversely, when short ($q < 0$), quotes are skewed upwards to attract sellers and repel buyers.

The theoretical pinnacle of optimal inventory-controlled market making was formulated in the seminal work of **Marco Avellaneda and Sasha Stoikov (2008)** (*High-frequency trading in a limit order book*, Quantitative Finance), building upon Ho & Stoll (1981).

#### 1.2 Problem Statement
Retail algorithmic traders, systematic prop desks, and quant students on contemporary Indian trading platforms encounter severe roadblocks when attempting to study, calibrate, or deploy market making algorithms:

1. **Absence of Inventory-Aware Pricing Models:**
   Standard market-making tutorials and simple algorithmic bots naively post static grid orders or symmetric half-spreads around the current midprice (e.g., `mid ± 0.05%`). In trending or volatile markets (e.g., NIFTY/BANKNIFTY futures), these bots suffer catastrophic inventory accumulation (reaching max position limits) followed by massive liquidation drawdowns.
2. **Ignorance of Risk Aversion ($\gamma$) and Time Horizon ($T - t$):**
   Traders lack interactive tools to model how subjective risk aversion ($\gamma$) and intraday session horizons ($T - t$) govern optimal quoting. Towards the end of the trading session (e.g., 15:15–15:30 IST on NSE), market makers face severe terminal liquidation pressure and must aggressively unload inventory. Without terminal horizon decay modeling, overnight gap risk is unmitigated.
3. **Lack of Order Book Liquidity ($\kappa$) and Intensity ($A$) Calibration:**
   Order arrival intensities follow exponential decay functions governed by book depth parameters $\kappa$ and base arrival rates $A$. Without real-time empirical calibration against live NSE Level-2/Level-3 market depth, market makers miscalculate fill probabilities, quoting either too wide (zero fills, lost opportunity) or too tight (excessive adverse selection).
4. **No Microstructural P&L Decomposition:**
   Existing paper trading tools only report gross realized and unrealized P&L. They fail to decompose performance into the three microscopic drivers:
   - **Pure Spread Capture:** Gross income earned from round-trip bid-ask crossing.
   - **Inventory Depreciation (MTM Drift):** Mark-to-market drift of accumulated inventory.
   - **Adverse Selection Penalty:** Losses incurred because incoming fills systematically precede unfavorable midprice moves.
5. **Lack of High-Frequency Execution Simulators with Hard Boundary Rules:**
   Retail traders cannot simulate high-frequency Poisson order arrivals, queue position priority, microsecond cancellations, and boundary actions ($q = \pm Q_{\max}$) inside a browser.

#### 1.3 Solution & Objectives of Sprint 26
Sprint 26 delivers an institutional-grade, mathematical **Avellaneda-Stoikov Optimal Market Making & Inventory Control Engine** integrated natively into TradeCraft AI:

* **Stochastic Midprice & Reservation Price Engine:** Computes closed-form Avellaneda-Stoikov indifference price $r(s, q, t) = s - q \gamma \sigma^2 (T - t)$ in real-time, accounting for current midprice $s$, inventory $q$, risk aversion parameter $\gamma$, intraday volatility $\sigma$, and remaining time horizon $(T - t)$.
* **Optimal Spread Skewing Matrix:** Derives optimal bid and ask half-spreads $\delta_a^*(q)$ and $\delta_b^*(q)$ satisfying total optimal spread $s^*(q) = \gamma \sigma^2 (T - t) + \frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$, generating exact tick-rounded quote prices $r_a$ and $r_b$.
* **Poisson Order Arrival & Liquidity Calibrator:** Models asymmetric arrival intensities $\lambda^a(\delta^a) = A e^{-\kappa \delta^a}$ and $\lambda^b(\delta^b) = A e^{-\kappa \delta^b}$, continuously estimating order book decay parameter $\kappa$ and intensity scale $A$ from tick feeds.
* **Inventory Boundary Manager & Emergency De-Risking:** Implements hard constraints $[-Q_{\max}, +Q_{\max}]$. When $q = +Q_{\max}$, bid quotes are suppressed ($\delta_b \to \infty$) and ask quotes tightened; if boundaries are breached or terminal time $T$ arrives, automated algorithmic market orders execute immediate inventory neutralization.
* **Microstructure P&L Decomposition Engine:** Real-time mathematical attribution of cumulative P&L into Spread Capture, Inventory Mark-to-Market Drift, and Adverse Selection Drag.
* **HFT Microsecond Execution Simulator:** Interactive browser-native Monte Carlo and tick-driven execution engine capable of simulating 100,000 Poisson events across multiple market regimes (ranging, trending, volatile, toxic).

---

### 2. Market Microstructure & Regulatory Framework (NSE/BSE)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│              AVELLANEDA-STOIKOV INVENTORY-CONTROLLED MARKET MAKING ON NSE/BSE                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   NSE / BSE CENTRAL LIMIT ORDER BOOK (CLOB)                                                      │
│   ─────────────────────────────────────────                                                      │
│                                                                                                  │
│             Ask Depth (Sellers)                                                                  │
│             ₹24,505.00 (Qty: 2,500)                                                              │
│             ₹24,502.50 (Qty: 1,200)                                                              │
│        ───► ₹24,501.00 [Optimal Ask Quote r_a = r(s,q,t) + δ_a] ◄─── MM Ask Quote                │
│                                                                                                  │
│             ═════════════════════════════════════════════════════                                │
│             Market Midprice s = (Best Bid + Best Ask) / 2                                        │
│             Reservation (Indifference) Price r(s, q, t)                                          │
│             ═════════════════════════════════════════════════════                                │
│                                                                                                  │
│        ───► ₹24,499.00 [Optimal Bid Quote r_b = r(s,q,t) - δ_b] ◄─── MM Bid Quote                │
│             ₹24,497.50 (Qty: 1,500)                                                              │
│             ₹24,495.00 (Qty: 3,000)                                                              │
│             Bid Depth (Buyers)                                                                   │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│   INVENTORY SKEWING BEHAVIOR:                                                                    │
│                                                                                                  │
│   [q = 0] Neutral Inventory:                                                                     │
│   • r(s, 0, t) = s (Reservation price equals midprice)                                           │
│   • Symmetric Half-Spreads: δ_a = δ_b = s* / 2                                                  │
│   • Equal fill probability on both Bid and Ask sides                                             │
│                                                                                                  │
│   [q > 0] Positive Inventory (Long Asset):                                                       │
│   • r(s, q, t) < s (Reservation price skews BELOW midprice)                                      │
│   • Asymmetric Half-Spreads: δ_a < δ_b (Tighten Ask, Widen Bid)                                  │
│   • Result: High probability of Selling (unloading), Low probability of Buying (adding risk)     │
│                                                                                                  │
│   [q < 0] Negative Inventory (Short Asset):                                                      │
│   • r(s, q, t) > s (Reservation price skews ABOVE midprice)                                      │
│   • Asymmetric Half-Spreads: δ_b < δ_a (Tighten Bid, Widen Ask)                                  │
│   • Result: High probability of Buying (covering short), Low probability of Selling              │
│                                                                                                  │
│   [|q| = Q_max] Inventory Boundary Clamped:                                                      │
│   • Extreme quote skewing; cancel side exacerbating inventory                                    │
│   • Trigger aggressive micro-hedging or VWAP/IOC liquidation to restore delta neutrality         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1 Indian Regulatory & Exchange Microstructure Specifics
1. **SEBI Algorithmic Trading Guidelines (Circular SEBI/HO/MRD/DP/CIR/P/2016/120 & 2018):**
   - Market making algos must implement Order-to-Trade Ratio (OTR) controls. Excessive quote flickering without execution incurs exchange penalties on NSE.
   - Pre-trade risk controls (order quantity limits, price bands, max loss limits) must be embedded directly in the execution harness.
2. **Tick Size Regime:**
   - Cash Equities & Stock Futures: Standard ₹0.05 tick size.
   - Index Options: Standard ₹0.05 tick size.
   - Any continuous mathematical quote $r_a, r_b$ generated by the Avellaneda-Stoikov formula must be mapped to valid exchange discrete ticks using directional rounding:
     $$\tilde{r}_a = \lceil r_a / \Delta_{\text{tick}} \rceil \cdot \Delta_{\text{tick}}$$
     $$\tilde{r}_b = \lfloor r_b / \Delta_{\text{tick}} \rfloor \cdot \Delta_{\text{tick}}$$
     This preserves positive spread $\tilde{r}_a > \tilde{r}_b$ and prevents crossing the order book.
3. **STT & Exchange Fee Integration:**
   - Equity intraday: STT of 0.025% on sell side.
   - Futures: STT of 0.02% on sell side.
   - Options: STT of 0.1% on intrinsic premium on sell side.
   - Exchange transaction fees: NSE charges ~0.00297% (cash equity), ~0.00173% (futures), and ~0.0350% (options premium).
   - In the Avellaneda-Stoikov spread formulation, minimum half-spreads must strictly exceed round-trip statutory costs to ensure positive net economic expectancy:
     $$s^*(q) \ge \text{RoundTripFee}(s) + 2 \cdot \Delta_{\text{tick}}$$

---

### 3. Mathematical Foundation & Quantitative Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│             MATHEMATICAL CORE: HAMILTON-JACOBI-BELLMAN TO OPTIMAL QUOTES                         │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   1. Midprice Arithmetic Brownian Motion:                                                        │
│      dS_t = σ dW_t                                                                               │
│                                                                                                  │
│   2. Wealth Dynamics:                                                                            │
│      dX_t = (s_t + δ_a) dN_t^a - (s_t - δ_b) dN_t^b                                              │
│                                                                                                  │
│   3. Inventory Dynamics:                                                                         │
│      dq_t = dN_t^b - dN_t^a                                                                      │
│                                                                                                  │
│   4. CARA Utility Optimization (HJB PDE):                                                        │
│      max E [ -exp(-γ (X_T + q_T S_T - α q_T^2)) ]                                                │
│                                                                                                  │
│   5. Indifference / Reservation Price:                                                           │
│      r(s, q, t) = s - q γ σ^2 (T - t)                                                            │
│                                                                                                  │
│   6. Optimal Asymmetric Half-Spreads:                                                            │
│      δ_a*(q) = (s - r(s, q, t)) + (1 / γ) ln(1 + γ / κ)                                          │
│      δ_b*(q) = (r(s, q, t) - s) + (1 / γ) ln(1 + γ / κ)                                          │
│                                                                                                  │
│   7. Total Optimal Bid-Ask Spread:                                                               │
│      s*(q) = δ_a*(q) + δ_b*(q) = γ σ^2 (T - t) + (2 / γ) ln(1 + γ / κ)                            │
│                                                                                                  │
│   8. Quote Levels:                                                                               │
│      r_a = s + δ_a*(q) = r(s, q, t) + (1 / γ) ln(1 + γ / κ)                                      │
│      r_b = s - δ_b*(q) = r(s, q, t) - (1 / γ) ln(1 + γ / κ)                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 Midprice Stochastic Diffusion & Reservation (Indifference) Price

Let the reference asset midprice $S_t$ follow an arithmetic Brownian motion with instantaneous volatility $\sigma$ and zero drift:
$$dS_t = \sigma dW_t, \quad S_0 = s$$
where $W_t$ is a standard one-dimensional Wiener process on a filtered probability space $(\Omega, \mathcal{F}, (\mathcal{F}_t)_{t \ge 0}, \mathbb{P})$.

The market maker controls their quotes by setting distances $\delta_t^a = p_t^a - S_t$ and $\delta_t^b = S_t - p_t^b$ away from the midprice. Fills arrive according to point processes $N_t^a$ (executions of the market maker's ask quote, decreasing inventory by 1 lot) and $N_t^b$ (executions of the market maker's bid quote, increasing inventory by 1 lot).

The cash process $X_t$ and inventory process $q_t$ evolve as:
$$dX_t = (S_t + \delta_t^a) dN_t^a - (S_t - \delta_t^b) dN_t^b$$
$$dq_t = dN_t^b - dN_t^a$$

The market maker is assumed to have Constant Absolute Risk Aversion (CARA) utility with risk aversion parameter $\gamma > 0$:
$$U(w) = -\exp(-\gamma w)$$

The terminal wealth at the end of the trading horizon $T$ is given by:
$$W_T = X_T + q_T S_T$$

The value function $V(x, q, s, t)$ is defined as the supremum over admissible quote policies $\delta^a, \delta^b$:
$$V(x, q, s, t) = \sup_{(\delta^a, \delta^b) \in \mathcal{A}} \mathbb{E}_t \left[ -\exp\left(-\gamma \left(X_T + q_T S_T - \frac{\alpha}{2} q_T^2\right)\right) \right]$$
where $\frac{\alpha}{2} q_T^2$ is a terminal inventory penalty coefficient.

Applying Dynamic Programming, the Hamilton-Jacobi-Bellman (HJB) equation for $V(x, q, s, t)$ is:
$$\partial_t V + \frac{1}{2} \sigma^2 \partial_{ss} V + \max_{\delta^a} \left\{ \lambda^a(\delta^a) \left[ V(x + s + \delta^a, q - 1, s, t) - V(x, q, s, t) \right] \right\} + \max_{\delta^b} \left\{ \lambda^b(\delta^b) \left[ V(x - s + \delta^b, q + 1, s, t) - V(x, q, s, t) \right] \right\} = 0$$
subject to the terminal boundary condition:
$$V(x, q, s, T) = -\exp\left(-\gamma (x + q s - \frac{\alpha}{2} q^2)\right)$$

Using the Avellaneda-Stoikov ansatz:
$$V(x, q, s, t) = -\exp(-\gamma x) \exp(-\gamma \theta(s, q, t))$$

Through first-order Taylor expansion and indifference pricing arguments (where the reservation price $r(s, q, t)$ is defined such that $V(x + r(s, q, t), q - 1, s, t) = V(x, q, s, t)$), we obtain the closed-form **Reservation (Indifference) Price**:
$$r(s, q, t) = s - q \cdot \gamma \cdot \sigma^2 \cdot (T - t)$$

**Microeconomic Interpretation:**
- If $q = 0$ (flat book), $r(s, 0, t) = s$. The reservation price equals the midprice.
- If $q > 0$ (long inventory), $r(s, q, t) < s$. The market maker discounts their internal valuation of the asset because holding excess inventory exposes them to variance risk $\gamma \sigma^2 (T - t)$. The reservation price drops linearly with inventory $q$, risk aversion $\gamma$, variance $\sigma^2$, and time remaining $(T - t)$.
- If $q < 0$ (short inventory), $r(s, q, t) > s$. The market maker values an incoming buy order higher than the midprice to cover their open short risk.

---

#### 3.2 Order Arrival Intensity & Limit Order Book Liquidity ($\kappa, A$)

Incoming market orders and aggressive marketable limit orders that consume passive liquidity are modeled as inhomogeneous Poisson point processes with intensities dependent on the distance from the midprice $\delta$:
$$\lambda^a(\delta^a) = A \cdot \exp(-\kappa \cdot \delta^a)$$
$$\lambda^b(\delta^b) = A \cdot \exp(-\kappa \cdot \delta^b)$$

Where:
- $A > 0$ is the **base order arrival intensity** (trades per second at the midprice $\delta = 0$).
- $\kappa > 0$ is the **order book liquidity decay parameter** (measured in $\text{tick}^{-1}$ or $\text{price}^{-1}$). A high $\kappa$ indicates a dense, liquid book where fill probability drops off sharply as quotes move away from the inside market. A low $\kappa$ indicates a shallow book where liquidity is dispersed.
- Over an infinitesimal interval $dt$, the conditional probability of execution is:
  $$\mathbb{P}(\text{Fill on Ask in } [t, t + dt]) = \lambda^a(\delta^a) dt + o(dt) = A e^{-\kappa \delta^a} dt$$
  $$\mathbb{P}(\text{Fill on Bid in } [t, t + dt]) = \lambda^b(\delta^b) dt + o(dt) = A e^{-\kappa \delta^b} dt$$

---

#### 3.3 Optimal Bid and Ask Half-Spreads & Asymmetric Skewing

Maximizing the Hamiltonian with respect to $\delta^a$ and $\delta^b$ yields the optimal distance of quotes from the reservation price:
$$\delta^a(s, q, t) = r(s, q, t) - s + \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$
$$\delta^b(s, q, t) = s - r(s, q, t) + \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$

Substituting the reservation price $r(s, q, t) = s - q \gamma \sigma^2 (T - t)$:
$$\delta_a^*(q) = -q \gamma \sigma^2 (T - t) + \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$
$$\delta_b^*(q) = +q \gamma \sigma^2 (T - t) + \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$

The **total optimal quoted bid-ask spread** $s^*(q)$ is the sum of the two optimal half-spread distances:
$$s^*(q) = \delta_a^*(q) + \delta_b^*(q) = \gamma \sigma^2 (T - t) + \frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$

Notice that the total optimal spread $s^*(q)$ is independent of current inventory $q$ in the first-order approximation, but depends critically on:
1. Volatility and time horizon: $\gamma \sigma^2 (T - t)$ (the inventory risk premium).
2. Liquidity parameter: $\frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$ (the liquidity extraction premium).

The absolute quote prices posted to the limit order book are:
$$r_a^*(q) = s + \delta_a^*(q) = r(s, q, t) + \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$
$$r_b^*(q) = s - \delta_b^*(q) = r(s, q, t) - \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$

**Spread Asymmetry Proof:**
Subtracting the quotes confirms they are perfectly centered around the reservation price $r(s, q, t)$, NOT the midprice $s$:
$$\frac{r_a^*(q) + r_b^*(q)}{2} = r(s, q, t) = s - q \gamma \sigma^2 (T - t)$$
- When $q > 0$: $\frac{r_a + r_b}{2} < s$. Both quotes shift downwards. The ask quote moves closer to the midprice ($\delta_a$ shrinks), while the bid quote moves further away ($\delta_b$ widens).
- When $q < 0$: $\frac{r_a + r_b}{2} > s$. Both quotes shift upwards. The bid quote moves closer to the midprice ($\delta_b$ shrinks), while the ask quote moves further away ($\delta_a$ widens).

---

#### 3.4 Guéant-Tapia-Manziadi (2012) Closed-Form Finite Inventory Formulation

In practical implementations with hard inventory constraints $q \in \{-Q_{\max}, \dots, +Q_{\max}\}$, Guéant, Tapia, and Manziadi (2012) solved the Avellaneda-Stoikov HJB system without Taylor approximations by converting the non-linear ODE into a linear system via Cole-Hopf transformation.

Let $v_q(t)$ be defined such that $V(x, q, s, t) = -\exp(-\gamma x) \exp(-\gamma q s) v_q(t)^{-\frac{\kappa}{\gamma}}$.
The optimal half-spreads with exact inventory bounds take the form:
$$\delta_a(q, t) = \frac{1}{\kappa} \ln\left(1 + \frac{\gamma}{\kappa}\right) + \frac{1}{\kappa} \ln\left( \frac{v_q(t)}{v_{q-1}(t)} \right)$$
$$\delta_b(q, t) = \frac{1}{\kappa} \ln\left(1 + \frac{\gamma}{\kappa}\right) + \frac{1}{\kappa} \ln\left( \frac{v_q(t)}{v_{q+1}(t)} \right)$$

This formulation enforces asymptotic quote divergence at boundary states:
$$\lim_{q \to +Q_{\max}} \delta_b(q) = +\infty \implies \text{Bid quote withdrawn (or placed at minimum allowable price)}$$
$$\lim_{q \to -Q_{\max}} \delta_a(q) = +\infty \implies \text{Ask quote withdrawn (or placed at maximum allowable price)}$$

---

#### 3.5 Inventory Risk Penalty & Terminal Boundary Rules

To guard against catastrophic tail losses and ensure regulatory compliance with exchange position limits, the engine implements three cascading defense layers:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             INVENTORY RISK & DEFENSE CASCADE                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│   INVENTORY REGIME          ACTION TAKEN BY MM ENGINE                                            │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│   Zone 1: Safe Zone         Standard Avellaneda-Stoikov dynamic skewing:                         │
│   |q| <= 0.60 * Q_max       r_a = r(s,q,t) + (1/γ) ln(1 + γ/κ)                                  │
│                             r_b = r(s,q,t) - (1/γ) ln(1 + γ/κ)                                  │
│                                                                                                  │
│   Zone 2: Skew Alert Zone   Aggressive Skew Multiplier applied:                                  │
│   0.60 * Q_max < |q| < Q_max γ_eff = γ * (1 + 2.0 * (|q| / Q_max)^2)                            │
│                             Unloading side quoted at touch (top of book);                         │
│                             Adverse side pushed back by 3-5 ticks.                               │
│                                                                                                  │
│   Zone 3: Hard Boundary     Quote Suspension & Micro-Hedging:                                    │
│   |q| >= Q_max              • If q == +Q_max: BID IS CANCELLED (δ_b -> ∞).                       │
│                               Only Ask is quoted at Best Bid + 1 tick to force execution.        │
│                             • If q == -Q_max: ASK IS CANCELLED (δ_a -> ∞).                       │
│                               Only Bid is quoted at Best Ask - 1 tick.                           │
│                             • If boundary violated for > 500ms, trigger Almgren-Chriss           │
│                               immediate marketable IOC order for Δq = 0.3 * Q_max lots.          │
│                                                                                                  │
│   Zone 4: Terminal Horizon  Intraday Session Close (T - t <= 300 seconds, e.g., 15:25 IST):      │
│   (t -> T)                  Terminal penalty α q_T^2 dominates. Exponential decay of spreads.    │
│                             All resting passive quotes cancelled at T - 60s (15:29 IST).         │
│                             Residual inventory q_T flattened via VWAP / Market Sweep.            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Quadratic Running Inventory Penalty:**
   In addition to terminal utility, a running penalty on inventory variance is integrated:
   $$\mathcal{L}_{\text{inv}}(q) = -\frac{1}{2} \phi \cdot q^2$$
   where $\phi = \gamma \sigma^2$ is the inventory cost rate per second.
2. **Hard Position Cap $[-Q_{\max}, +Q_{\max}]$:**
   - Parameter configured per asset (e.g., $Q_{\max} = 20$ lots for NIFTY futures, $1000$ shares for RELIANCE).
   - If $q = +Q_{\max}$, the Bid state transition is forbidden: $dN_t^b \equiv 0$. The bid quote is completely suppressed ($\delta_b \to \infty$).
   - If $q = -Q_{\max}$, the Ask state transition is forbidden: $dN_t^a \equiv 0$. The ask quote is completely suppressed ($\delta_a \to \infty$).
3. **Emergency Liquidator:**
   If price volatility spikes and toxic sweeps breach $Q_{\max}$, the engine triggers an immediate aggressive liquidity-taking order (IOC / Market Sweep) to instantly bring inventory back to $0.70 \cdot Q_{\max}$.

---

#### 3.6 Microstructural P&L Decomposition Engine

To provide quantitative traders with institutional transparency, the engine continuously decomposes cumulative Trading P&L $\Pi(t)$ into three orthogonal microstructure components:
$$\Pi(t) = \Pi_{\text{spread}}(t) + \Pi_{\text{drift}}(t) + \Pi_{\text{adverse}}(t) - \text{TaxesAndFees}(t)$$

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         MICROSTRUCTURAL P&L DECOMPOSITION TREE                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                           TOTAL REALIZED & UNREALIZED P&L                                        │
│                                     Π(t)                                                         │
│                                       │                                                          │
│          ┌────────────────────────────┼────────────────────────────┐                             │
│          ▼                            ▼                            ▼                             │
│   PURE SPREAD CAPTURE        INVENTORY MTM DRIFT          ADVERSE SELECTION                      │
│      Π_spread(t)                 Π_drift(t)                   Π_adverse(t)                       │
│   ─────────────────────      ───────────────────          ────────────────────                   │
│   Gross revenue from         Capital gains/losses         Microstructure slippage                │
│   collecting half-spreads    from holding non-zero        incurred when incoming                 │
│   on matched buy & sell      inventory during             fills precede directional              │
│   round trips:               underlying price drift:      midprice jumps:                        │
│   Σ 0.5 * (p_a,k - p_b,k)    q_t * (S_t - S_vwap)         Σ (S_{t+τ} - p_fill)                   │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

##### 1. Pure Spread Capture ($\Pi_{\text{spread}}(t)$)
The revenue earned strictly from the bid-ask spread on completed round-turn volume.
For every matched pair of buy fill at $p_{b, i}$ and sell fill at $p_{a, j}$:
$$\Pi_{\text{spread}}(t) = \sum_{k=1}^{M_t} \left( p_{a, k} - p_{b, k} \right) \cdot \text{Volume}_k$$
where $M_t$ is the number of matched round-trip units at time $t$. In a stationary market with $q = 0$, $\Pi(t) \equiv \Pi_{\text{spread}}(t)$.

##### 2. Inventory MTM Drift ($\Pi_{\text{drift}}(t)$)
The mark-to-market gain or loss arising from directional price movement on open, unhedged inventory $q_t$:
$$\Pi_{\text{drift}}(t) = q_t \cdot \left( S_t - \bar{S}_{\text{entry}} \right)$$
where $\bar{S}_{\text{entry}}$ is the volume-weighted average entry price (VWAP) of the current open inventory $q_t$.
- If market maker is long ($q_t > 0$) and midprice rises ($S_t > \bar{S}$), $\Pi_{\text{drift}} > 0$.
- If market maker is long ($q_t > 0$) and midprice falls ($S_t < \bar{S}$), $\Pi_{\text{drift}} < 0$.

##### 3. Adverse Selection Drag ($\Pi_{\text{adverse}}(t)$)
The systematic loss incurred by being on the passive side of informed trades. It measures the post-trade price movement over an evaluation horizon $\tau$ (e.g., $\tau = 100\text{ms}, 1\text{s}, 5\text{s}$):
$$\Pi_{\text{adverse}}(t) = \sum_{i \in \text{Fills}^b} \left( S_{t_i + \tau} - p_{b, i} \right) + \sum_{j \in \text{Fills}^a} \left( p_{a, j} - S_{t_j + \tau} \right)$$
A persistent negative adverse selection drag indicates that incoming orders are systematically toxic, signaling the engine to widen spreads or increase risk aversion $\gamma$.

---

### 4. Technical Architecture & Component Specifications

The Avellaneda-Stoikov Market Making Engine is implemented as a client-side, zero-latency TypeScript architecture in `src/services/marketMaking/`:

```
src/services/marketMaking/
├── avellanedaStoikovEngine.ts     # Core mathematical model: reservation price, spreads, HJB solver
├── inventoryRiskManager.ts        # Hard position limits, boundary clamps, emergency liquidator
├── orderBookCalibrator.ts         # Real-time estimation of kappa (κ) and arrival intensity (A)
├── hftExecutionSimulator.ts       # Poisson tick simulator with microsecond event queues
├── pnlDecompositionEngine.ts      # Pure spread, MTM drift, and adverse selection attribution
├── types.ts                       # TypeScript interfaces, configuration, and telemetry schemas
└── ui/
    ├── MarketMakerDashboard.tsx   # Institutional cockpit with real-time quote visualization
    ├── ReservationPriceChart.tsx  # Dynamic chart showing midprice vs reservation vs bids/asks
    ├── InventoryGauge.tsx         # Real-time position vs Q_max with color-coded risk zones
    └── PnlAttributionChart.tsx    # Stacked area chart of Spread Capture vs Drift vs Adverse Selection
```

#### 4.1 Component Flow Diagram

```mermaid
flowchart TD
    subgraph MarketDataFeed [Market Data & Order Flow]
        L2[Level-2 / Level-3 LOB Feed]
        TickStream[Tick-by-Tick Transactions]
    end

    subgraph Calibrator [Microstructure Parameter Calibration]
        VolEst[Rolling Volatility Estimator σ]
        KappaEst[Order Book Depth Estimator κ]
        IntensEst[Poisson Arrival Intensity A]
    end

    subgraph ASEngine [Avellaneda-Stoikov Core Engine]
        ResPriceCalc[Reservation Price r = s - q γ σ² T-t]
        HalfSpreadCalc[Optimal Half Spreads δ_a, δ_b]
        QuoteRounding[Tick Grid Rounding & Fee Floor]
    end

    subgraph RiskDesk [Inventory & Boundary Risk]
        InvTrack[Inventory Tracker q_t]
        BoundaryCheck{Is |q| >= Q_max?}
        ClampQuotes[Withdraw / Skew Boundary Side]
        EmergLiq[Almgren-Chriss Emergency Liquidator]
    end

    subgraph Simulator [HFT Execution Engine]
        PoissonGen[Poisson Event Generator]
        FillMatch[Order Book Queue & Fill Matcher]
    end

    subgraph PnLEngine [P&L Analytics]
        SpreadCapture[Pure Spread Capture]
        MTMDrift[Inventory MTM Drift]
        AdvSelection[Adverse Selection Drag]
    end

    L2 --> VolEst
    L2 --> KappaEst
    TickStream --> IntensEst

    VolEst --> ResPriceCalc
    KappaEst --> HalfSpreadCalc
    IntensEst --> HalfSpreadCalc

    InvTrack --> ResPriceCalc
    InvTrack --> BoundaryCheck

    ResPriceCalc --> HalfSpreadCalc
    HalfSpreadCalc --> QuoteRounding

    BoundaryCheck -- Yes --> ClampQuotes
    BoundaryCheck -- Critical Breach --> EmergLiq
    BoundaryCheck -- No --> QuoteRounding

    QuoteRounding --> Simulator
    PoissonGen --> Simulator
    Simulator --> FillMatch

    FillMatch --> InvTrack
    FillMatch --> PnLEngine

    PnLEngine --> SpreadCapture
    PnLEngine --> MTMDrift
    PnLEngine --> AdvSelection
```

---

### 5. Detailed Feature Scope & User Stories

#### 5.1 User Story 1: Dynamic Reservation Price & Spread Skewing Calculator
**As a** Quantitative Trader / Algorithmic Market Maker,  
**I want** the engine to continuously calculate my dynamic reservation price $r(s, q, t)$ and optimal bid/ask half-spreads $\delta_a^*(q)$ and $\delta_b^*(q)$,  
**So that** my quotes automatically skew to shed inventory when I am long or short, protecting my capital from adverse price trends.

##### Technical Requirements:
- Ingest real-time midprice $s = \frac{p_{\text{best\_ask}} + p_{\text{best\_bid}}}{2}$.
- Track current signed inventory $q \in [-Q_{\max}, +Q_{\max}]$.
- Accept user-configurable risk aversion parameter $\gamma \in [0.001, 1.0]$.
- Calculate intraday annualized and per-second volatility $\sigma$ using high-frequency rolling Parkinson or Garman-Klass estimator over the last 100 volume bars.
- Compute remaining session time $(T - t)$ in normalized seconds ($T = 22,500$ seconds for full 6.25 hour NSE session from 09:15 to 15:30 IST).
- Compute:
  $$r(s, q, t) = s - q \cdot \gamma \cdot \sigma^2 \cdot (T - t)$$
- Compute optimal half-spreads:
  $$\delta_a(q) = -q \gamma \sigma^2 (T - t) + \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$
  $$\delta_b(q) = +q \gamma \sigma^2 (T - t) + \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$
- Output exact quote prices rounded to valid exchange tick $\Delta_{\text{tick}} = 0.05$.

---

#### 5.2 User Story 2: Order Book Depth Liquidity ($\kappa$) & Poisson Intensity ($A$) Calibration
**As a** Quantitative Researcher,  
**I want** the engine to calibrate the order book decay parameter $\kappa$ and base arrival intensity $A$ from empirical market depth and tick data,  
**So that** my Avellaneda-Stoikov spreads reflect the actual liquidity and fill dynamics of the specific instrument (e.g., NIFTY Index Futures vs small-cap equity).

##### Technical Requirements:
- Maintain a rolling histogram of executed trade distances from the prevailing midprice $\delta_i = |p_{\text{trade}, i} - S_{t_i}|$.
- Fit log-linear regression to Poisson arrival rates across discrete depth buckets:
  $$\ln \lambda(\delta) = \ln A - \kappa \cdot \delta$$
- Dynamically extract $\kappa = -\frac{\Delta \ln \lambda(\delta)}{\Delta \delta}$ and $A = \exp(\text{intercept})$.
- Enforce fallback bounds: $\kappa_{\min} = 0.1$, $\kappa_{\max} = 10.0$, $A_{\min} = 0.5 \text{ trades/sec}$, $A_{\max} = 500 \text{ trades/sec}$.
- Update parameters every 500 milliseconds or every 200 incoming tick messages.

---

#### 5.3 User Story 3: Hard Inventory Boundaries & Emergency Liquidation Circuit
**As a** Pre-Trade Risk Manager,  
**I want** hard inventory limits $[-Q_{\max}, +Q_{\max}]$ with automatic quote cancellation on the accumulating side and emergency market order liquidation upon boundary breach,  
**So that** the market maker never violates exchange margin limits or suffers runaway drawdown during flash crashes.

##### Technical Requirements:
- Configurable maximum inventory limit $Q_{\max}$ (default: 10 lots for index derivatives, 500 shares for equities).
- **Asymmetric Quote Cancellation:**
  - When $q = +Q_{\max}$, automatically set $\delta_b = +\infty$ (cancel passive bid). Only the ask quote is maintained, priced aggressively at $\min(r_a, p_{\text{best\_ask}})$ to encourage inventory unwinding.
  - When $q = -Q_{\max}$, automatically set $\delta_a = +\infty$ (cancel passive ask). Only the bid quote is maintained, priced at $\max(r_b, p_{\text{best\_bid}})$.
- **Emergency Market Sweep (Panic Button):**
  - If external market movement causes inventory to exceed $Q_{\max}$ by $> 10\%$ (e.g., unfilled quote or double execution), execute immediate aggressive Almgren-Chriss market order to liquidate $30\%$ of total inventory.
  - Log automated incident event in system audit trail with timestamp, trigger price, and slippage.

---

#### 5.4 User Story 4: Microstructural P&L Decomposition Engine
**As an** Algorithmic Desk Trader,  
**I want** my total P&L decomposed into Pure Spread Capture, Inventory Mark-to-Market Drift, and Adverse Selection Drag,  
**So that** I can diagnose whether my strategy is actually capturing alpha or simply acting as an uninformed liquidity provider suffering adverse selection.

##### Technical Requirements:
- Calculate real-time:
  $$\Pi_{\text{total}}(t) = \Pi_{\text{spread}}(t) + \Pi_{\text{drift}}(t) + \Pi_{\text{adverse}}(t) - \text{Fees}(t)$$
- Pure Spread Capture: Match executed buy and sell fills using FIFO order matching and sum realized half-spreads.
- Inventory Drift: Compute instantaneous mark-to-market drift $q_t \cdot (S_t - \bar{S}_{\text{entry}})$.
- Adverse Selection Drag: Evaluate post-trade price movement at $\tau = 1\text{s}$ and $\tau = 5\text{s}$ post-fill:
  - If a bid was filled at $p_b$ and $S_{t+1\text{s}} < p_b$, record adverse selection loss $(p_b - S_{t+1\text{s}})$.
  - If an ask was filled at $p_a$ and $S_{t+1\text{s}} > p_a$, record adverse selection loss $(S_{t+1\text{s}} - p_a)$.
- Display a real-time stacked area chart showing the trajectory of each component.

---

#### 5.5 User Story 5: Browser-Native HFT Market Making Simulator
**As a** Strategy Learner / Quant Student,  
**I want** an interactive, browser-native high-frequency execution simulator that runs Monte Carlo Poisson arrivals against the Avellaneda-Stoikov engine,  
**So that** I can visually experiment with risk aversion $\gamma$, volatility $\sigma$, book liquidity $\kappa$, and time horizon $T$ under various synthetic market regimes (ranging, trending, volatile flash crash).

##### Technical Requirements:
- Client-side event loop simulating $N = 10,000$ to $100,000$ discrete time steps with configurable step size $dt = 10\text{ms}$.
- Generate arithmetic Brownian motion for midprice:
  $$S_{t+dt} = S_t + \sigma \sqrt{dt} \cdot Z_t, \quad Z_t \sim \mathcal{N}(0, 1)$$
- At each step $dt$, compute Poisson arrival probabilities:
  $$\mathbb{P}(\text{Ask Fill}) = 1 - \exp(-\lambda^a(\delta_a) dt) \approx A e^{-\kappa \delta_a} dt$$
  $$\mathbb{P}(\text{Bid Fill}) = 1 - \exp(-\lambda^b(\delta_b) dt) \approx A e^{-\kappa \delta_b} dt$$
- Support regime presets:
  - `REGIME_STATIONARY`: Zero drift, moderate volatility ($\sigma = 15\%$).
  - `REGIME_TRENDING`: Strong directional drift ($\mu = +20\%\text{ or } -20\%$), testing inventory skewing.
  - `REGIME_HIGH_VOLATILITY`: Spike in $\sigma$ to $60\%$, testing spread widening.
  - `REGIME_FLASH_CRASH`: Sudden 5-sigma jump in price accompanied by massive toxic sell order arrival.
- Provide playback controls: Play, Pause, Step, Fast-Forward (10x, 50x, 100x), and Reset.

---

#### 5.6 User Story 6: Institutional Market Maker Cockpit UI
**As an** Active Platform User,  
**I want** a responsive, dark-mode institutional trading interface displaying the dynamic order book, reservation price indicator, inventory risk gauges, and P&L attribution,  
**So that** I have full visual clarity over the algorithmic engine's quoting behavior.

##### Technical Requirements:
- **Order Book Ladder (DOM):** Visually display the current limit order book with the MM's active Bid ($r_b$) and Ask ($r_a$) quotes highlighted in distinct neon colors (cyan for bid, magenta for ask).
- **Reservation Price Indicator:** Display a visual marker on the price ladder showing $r(s, q, t)$ relative to midprice $s$.
- **Inventory Bar Gauge:** Horizontal bidirectional gauge showing $q \in [-Q_{\max}, +Q_{\max}]$ with color transitions:
  - Green: Safe zone ($|q| \le 0.5 Q_{\max}$)
  - Amber: Skew alert zone ($0.5 Q_{\max} < |q| \le 0.8 Q_{\max}$)
  - Red / Flashing: Hard boundary zone ($|q| > 0.8 Q_{\max}$)
- **Parameter Controls:** Interactive sliders for $\gamma$ (Risk Aversion), $\sigma$ (Volatility Override), $\kappa$ (Book Liquidity), and $Q_{\max}$ (Max Inventory).
- **Export Capabilities:** Export simulated execution log, order book snapshots, and P&L time series to CSV and JSON formats.

---

### 6. Acceptance Criteria & Institutional Verification Matrix

| AC ID | Feature Module | Scenario / Test Case | Given / When / Then | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **AC-026-001** | Reservation Price | Flat Inventory ($q = 0$) | **Given** midprice $s = 24500.00$, inventory $q = 0$, $\gamma = 0.1$, $\sigma = 0.02$, $T - t = 1800$<br>**When** $r(s, q, t)$ is evaluated<br>**Then** $r(s, 0, t) == s$ exactly (₹24,500.00). | Unit Test / Math Proof | `VERIFIED` |
| **AC-026-002** | Reservation Price | Long Inventory ($q > 0$) Downward Skew | **Given** midprice $s = 24500.00$, inventory $q = +5$, $\gamma = 0.05$, $\sigma = 0.01$, $T - t = 600$<br>**When** $r(s, q, t)$ is calculated<br>**Then** $r(s, q, t) < s$ by exactly $q \gamma \sigma^2 (T - t) = 5 \times 0.05 \times 0.0001 \times 600 = 0.015$; $r = 24499.985$. | Unit Test | `VERIFIED` |
| **AC-026-003** | Optimal Spreads | Asymmetric Half-Spread Skewing | **Given** inventory $q = +5$, $r < s$<br>**When** $\delta_a^*(q)$ and $\delta_b^*(q)$ are calculated<br>**Then** $\delta_a^* < \delta_b^*$, meaning Ask is quoted closer to midprice than Bid, encouraging sales. | Unit Test | `VERIFIED` |
| **AC-026-004** | Total Spread | Inventory Invariance of Total Spread | **Given** any valid inventory $q_1 \ne q_2$ under identical $(s, \gamma, \sigma, \kappa, T-t)$<br>**When** total spread $s^*(q) = \delta_a^*(q) + \delta_b^*(q)$ is evaluated<br>**Then** $s^*(q_1) == s^*(q_2) == \gamma \sigma^2 (T - t) + \frac{2}{\gamma} \ln(1 + \frac{\gamma}{\kappa})$. | Parameter Assertion | `VERIFIED` |
| **AC-026-005** | Inventory Limit | Hard Boundary Upper Clamp ($q = +Q_{\max}$) | **Given** $Q_{\max} = 10$, current inventory $q = 10$<br>**When** quotes are generated<br>**Then** Bid quote is suppressed / cancelled ($\delta_b \to \infty$), and Ask quote is maintained. | Integration Test | `VERIFIED` |
| **AC-026-006** | Inventory Limit | Hard Boundary Lower Clamp ($q = -Q_{\max}$) | **Given** $Q_{\max} = 10$, current inventory $q = -10$<br>**When** quotes are generated<br>**Then** Ask quote is suppressed / cancelled ($\delta_a \to \infty$), and Bid quote is maintained. | Integration Test | `VERIFIED` |
| **AC-026-007** | Tick Grid | Discrete Rounding & Tick Adherence | **Given** continuous quote $r_a = 24501.03$, $r_b = 24498.97$ on ₹0.05 tick asset<br>**When** rounded to exchange ticks<br>**Then** $\tilde{r}_a = 24501.05$ (ceiling) and $\tilde{r}_b = 24498.95$ (floor); $\tilde{r}_a - \tilde{r}_b \ge 0.05$. | Unit Test | `VERIFIED` |
| **AC-026-008** | P&L Attribution | Exact Sum Conservation | **Given** simulation running for $N = 10,000$ steps<br>**When** $\Pi_{\text{total}}$ is compared to components<br>**Then** $|\Pi_{\text{total}} - (\Pi_{\text{spread}} + \Pi_{\text{drift}} + \Pi_{\text{adverse}} - \text{Fees})| < 10^{-6}$ INR. | Attribution Test | `VERIFIED` |
| **AC-026-009** | Execution Sim | Poisson Fill Probability Scaling | **Given** order book decay $\kappa = 1.5$, base intensity $A = 10$<br>**When** quote is posted at $\delta = 2.0$ ticks vs $\delta = 0.5$ ticks<br>**Then** $\lambda(2.0) = 10 e^{-3.0} \approx 0.498 < \lambda(0.5) = 10 e^{-0.75} \approx 4.724$. | Monte Carlo Test | `VERIFIED` |
| **AC-026-010** | Terminal Horizon | Session End Spread Compression | **Given** $(T - t) \to 0$ as $t \to T$<br>**When** optimal spread is calculated<br>**Then** inventory risk term $\gamma \sigma^2 (T - t) \to 0$, and spread converges to pure liquidity term $\frac{2}{\gamma} \ln(1 + \frac{\gamma}{\kappa})$. | Mathematical Proof | `VERIFIED` |

---

### 7. Non-Functional Requirements & Performance Benchmarks

1. **Sub-Millisecond Calculation Latency:**
   - The combined execution time of reservation price calculation, optimal half-spread derivation, tick discretization, and boundary enforcement must execute in $< 50\ \mu\text{s}$ (microseconds) in modern JavaScript engines (V8 / SpiderMonkey), enabling $> 20,000$ quote evaluations per second client-side.
2. **Zero Server Dependency (BYOK Architecture):**
   - All Poisson simulation event generators, mathematical solvers, and P&L attribution logic run 100% in-browser via WebAssembly / optimized TypeScript. No external server compute or paid API tier is required.
3. **Memory Stability & Zero Leakage:**
   - The HFT simulation loop must operate with zero dynamic heap allocations in its hot execution path. Reusable typed arrays (`Float64Array`, `Int32Array`) are pre-allocated for price, inventory, and fill buffers, ensuring smooth 60 FPS rendering without garbage collection pauses.
4. **Numerical Stability:**
   - Guard against numerical overflow/underflow when evaluating $\exp(-\kappa \delta)$ or $\ln(1 + \gamma / \kappa)$ with extreme values ($\gamma \to 0$ or $\kappa \to 0$). Fallback asymptotic expansions are implemented:
     $$\lim_{\gamma \to 0} \frac{1}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right) = \frac{1}{\kappa}$$

---

### 8. Appendix: Mathematical Derivations & KaTeX Reference

#### 8.1 Derivation of the Optimal Reservation Price via Certainty Equivalence
Consider a market maker holding wealth $x$ and inventory $q$ at time $t$ who considers adding or removing an infinitesimal unit of the asset.
The certainty equivalent wealth $C(x, q, s, t)$ is defined by:
$$U(C(x, q, s, t)) = \mathbb{E}_t \left[ U(x + q S_T) \right]$$
For CARA utility $U(w) = -\exp(-\gamma w)$ and $S_T \sim \mathcal{N}(s, \sigma^2(T-t))$:
$$\mathbb{E}_t [ -\exp(-\gamma (x + q S_T)) ] = -\exp(-\gamma x) \mathbb{E}_t [ \exp(-\gamma q S_T) ]$$
Using the moment-generating function of the normal distribution:
$$\mathbb{E}_t [ \exp(-\gamma q S_T) ] = \exp\left( -\gamma q s + \frac{1}{2} \gamma^2 q^2 \sigma^2 (T - t) \right)$$
Setting this equal to $-\exp(-\gamma C)$:
$$C(x, q, s, t) = x + q s - \frac{1}{2} \gamma q^2 \sigma^2 (T - t)$$
The reservation (indifference) price $r(s, q, t)$ to buy one additional unit is the marginal change in certainty equivalent wealth:
$$r(s, q, t) \approx \frac{\partial C}{\partial q} = s - \gamma q \sigma^2 (T - t)$$
This yields the exact Avellaneda-Stoikov reservation price formula.

#### 8.2 Asymptotic Limits of the Optimal Spread
1. **Risk-Neutral Limit ($\gamma \to 0$):**
   $$\lim_{\gamma \to 0} s^*(q) = \lim_{\gamma \to 0} \left[ \gamma \sigma^2 (T - t) + \frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right) \right] = 0 + \frac{2}{\kappa}$$
   When the market maker has zero risk aversion, the inventory risk premium vanishes, and quotes depend purely on order book liquidity: $s^* = \frac{2}{\kappa}$.
2. **Infinite Liquidity Limit ($\kappa \to \infty$):**
   $$\lim_{\kappa \to \infty} \frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right) = 0 \implies s^*(q) = \gamma \sigma^2 (T - t)$$
   In an infinitely deep book where fills are guaranteed at any distance, the spread collapses to the pure inventory risk compensation.
3. **Terminal Expiry Limit ($t \to T$):**
   $$\lim_{t \to T} s^*(q) = \frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$
   As the session ends, inventory risk exposure time drops to zero, and the spread shrinks to its baseline liquidity extraction width.
