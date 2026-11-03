# Business Requirements Document (BRD)
## TradeCraft AI — High-Frequency VWAP / TWAP Execution Algorithms & Microstructure Slippage Minimizer

- **Document ID:** `BRD-017-EXECUTION-VWAP-TWAP-ALMGREN-CHRISS`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 17 (Algorithmic Execution & Market Impact Suite)
- **Dependencies:** 
  - Sprint 1 (`tradingEngine.ts` — Paper Trading Portfolio, `taxEngine.ts` — Statutory Fees)
  - Sprint 4 (`replayEngine.ts` — Level-2 Market Depth DOM Ladder)
  - Sprint 11 (`quantDeskEngine.ts` — Virtual Hedge Fund Algorist Router)
  - Sprint 15 (`microstructureEngine.ts` — Level-3 Order Book & Queue Mechanics)
  - Sprint 16 (`statArbEngine.ts` — Cointegration Pairs & 2-Leg Sizing)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Institutional Execution Dilemma: Market Impact vs. Timing Risk
When institutional asset managers, mutual funds, and quantitative proprietary trading desks execute large orders in Indian equity and index derivatives markets (e.g. accumulating 5,00,000 shares of RELIANCE or unloading 20,000 contracts of BANKNIFTY), the central dilemma is the fundamental tradeoff between **Market Impact** and **Market Volatility (Timing Risk)**:
1. **The Cost of Urgency (Market Impact):**
   If an institution executes an entire block order immediately via aggressive market sweeps, they walk the order book, depleting resting liquidity and incurring catastrophic temporary and permanent price impact.
2. **The Cost of Patience (Timing Risk):**
   If an institution chops an order into tiny, passive limit orders spaced over multiple hours, they minimize immediate price impact but expose the unexecuted balance to adverse broader market drift (e.g. an unexpected macroeconomic release or index selloff while waiting).
3. **The Solution: Mathematical Optimal Execution:**
   Institutions resolve this tradeoff using closed-form optimal liquidation algorithms (the **Almgren-Chriss framework**, 2000) and volume-weighted execution schedules (**VWAP** and **TWAP**), calibrating child order slice sizes to the historical U-shaped intraday volume profile of Indian markets.

---

## 2. Mathematical Formulations & Execution Frameworks

### 2.1 Almgren-Chriss Optimal Liquidation Trajectory (2000)

Let total initial inventory be $X_0$. The order must be completely executed over a finite horizon $T$ divided into $N$ discrete intervals of length $\tau = T/N$ at times $t_k = k\tau$.
Let $x_k$ be the remaining shares at time $t_k$, with $x_0 = X_0$ and $x_N = 0$. The child slice traded in interval $k$ is:
$$n_k = x_{k-1} - x_k$$

#### Price Dynamics with Permanent & Temporary Market Impact:
- **Permanent Market Impact:** Shifts the equilibrium mid-price permanently:
  $$S_k = S_{k-1} + \sigma \tau^{1/2} \xi_k - \tau \gamma \left(\frac{n_k}{\tau}\right)$$
  where $\gamma$ is the permanent price impact coefficient and $\xi_k \sim \mathcal{N}(0, 1)$.
- **Temporary Market Impact:** The price received on slice $k$:
  $$\tilde{S}_k = S_{k-1} - \eta \left(\frac{n_k}{\tau}\right)$$
  where $\eta$ is the temporary liquidity extraction coefficient.

#### Utility Maximization (Expected Cost vs. Risk):
The trader minimizes the risk-adjusted cost functional:
$$U(x) = E[x] + \lambda V[x]$$
where $\lambda \ge 0$ is the trader's subjective risk-aversion parameter:
$$E[x] = \frac{1}{2} \gamma X_0^2 + \frac{\eta}{\tau} \sum_{k=1}^N n_k^2, \quad V[x] = \sigma^2 \sum_{k=1}^N \tau x_k^2$$

#### Closed-Form Optimal Inventory Trajectory:
$$x_j = \frac{\sinh(\kappa(T - t_j))}{\sinh(\kappa T)} X_0, \quad j = 0, \dots, N$$
where the urgency velocity parameter $\kappa$ satisfies:
$$\kappa \approx \sqrt{\frac{\lambda \sigma^2}{\eta}}$$
- **High Risk Aversion ($\lambda \to \infty$):** Large upfront child orders, rapidly liquidating risk before price volatility intervenes.
- **Risk Neutral ($\lambda \to 0$):** Linear trajectory, yielding a uniform **Time-Weighted Average Price (TWAP)** schedule.

---

### 2.2 Dynamic Indian Intraday Volume Profiling (VWAP Schedule)

Indian equity markets (NSE/BSE, 9:15 AM to 3:30 PM IST = 375 trading minutes) exhibit a characteristic **U-Shaped Intraday Volume Profile**:
1. **Morning Opening Rush (9:15–10:00 AM IST):** ~30% of total daily volume (overnight news assimilation, high volatility).
2. **Midday European Lull (11:30 AM–1:30 PM IST):** ~15% of total daily volume (narrow spreads, low tick turnover).
3. **Afternoon Institutional Surge (2:00–3:30 PM IST):** ~35% of total daily volume (institutional block crosses, MOC closing auctions).

#### Dynamic Volume-Weighted Average Price (VWAP) Slice Allocation:
Let $v(t)$ be the normalized historical volume fraction for interval $k$. The target child order size for interval $k$ is:
$$n_k^{\text{VWAP}} = X_0 \times \frac{v_k}{\sum_{i=1}^N v_i}$$
This guarantees that child orders blend seamlessly into continuous market turnover without exceeding 10% of instantaneous volume, minimizing predatory front-running by HFTs.

---

### 2.3 Perold Implementation Shortfall (IS) Attribution Model

The efficiency of algorithmic execution is benchmarked against the **Arrival Price $P_0$** (mid-price at the exact millisecond the trading decision was generated):
$$\text{Implementation Shortfall (Total Slippage)} = \sum_{k=1}^N \frac{n_k (\tilde{P}_k - P_0)}{X_0 \cdot P_0}$$

#### Slippage Attribution Breakdown:
$$\text{Total Shortfall} = \text{Delay Cost} + \text{Temporary Impact} + \text{Permanent Drift} + \text{Statutory Tax Friction}$$
- **Delay Cost:** Slippage incurred due to waiting before the first child order is routed.
- **Temporary Impact:** Premium/discount paid over prevailing mid-price to cross the bid-ask spread.
- **Permanent Impact:** Price degradation caused by information leakage as the order is absorbed.
- **Statutory Fee Friction:** Pre-computed round-trip SEBI taxes (STT, GST, NSE turnover, stamp duty).

---

## 3. UI Architecture & Interactive Studio (`ExecutionAlgoModal.tsx`)

1. **Parent Order Configuration Panel:**
   - Ticker selector with live spot price, market depth, and average daily volume (ADV).
   - Side (`BUY` / `SELL`), Total Shares / Lots, and Horizon Duration (15m, 30m, 1 Hour, All-Day).
   - Algorithm Type Selector:
     - `VWAP` (Volume-Weighted Profile)
     - `TWAP` (Uniform Time-Weighted Slices)
     - `ALMGREN_CHRISS` (Optimal Risk-Adjusted Liquidation Curve)
     - `ICEBERG_PEGGED` (Best-Bid/Ask Passive Pegging with Reloads)
   - Risk-Aversion Slider ($\lambda \in [0.001, 1.0]$) dynamically morphing the hyperbolic trajectory curve.
2. **Real-Time Slicing Timeline & Progress Visualizer:**
   - Visual step-by-step progress bar showing executed child slices vs scheduled remaining slices.
   - Countdown timer to next slice dispatch.
   - Slices Table: Slice #, Scheduled Time, Target Qty, Executed Qty, Benchmark Price, Fill Price, Slippage (bps).
3. **Execution Quality & Slippage Gauge HUD:**
   - **Average Executed Price vs Arrival Benchmark:** Displays exact basis points (bps) of positive alpha or adverse slippage.
   - **Execution vs Market VWAP:** Color-coded indicator (Green: Beat VWAP by $+4.2 \text{ bps}$, Red: Trailed VWAP).
   - **Total Statutory Charges Incurred:** Live rupee deductions.
4. **Interactive Background Execution Daemon:**
   - Automatically executes child slices in simulated background clock ticks, seamlessly posting fills into `tradingEngine.ts` and generating cryptographic Proof-of-Alpha receipts in `proofEngine.ts`.

---

## 4. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-EXE-01** | Almgren-Chriss inventory trajectory satisfies boundary conditions: $x_0 = X_0$ and $x_N = 0$, and slice sum strictly conserves total quantity ($\sum n_k = X_0$). | Unit test in `test/executionEngine.test.mjs`. |
| **AC-EXE-02** | Risk-aversion sensitivity: Increasing $\lambda$ increases front-loaded child order sizes ($n_1(\lambda_{\text{high}}) > n_1(\lambda_{\text{low}})$). | Unit test testing parameter monotonicity. |
| **AC-EXE-03** | VWAP profile integration accurately maps Indian market U-shaped volume curve (opening 9:15 AM slice larger than midday 12:30 PM slice). | Unit test verifying intraday slice weighting. |
| **AC-EXE-04** | Implementation Shortfall decomposes total slippage into basis points vs arrival price and statutory fee drag. | Unit test verifying mathematical identity. |
| **AC-EXE-05** | Interactive execution modal dispatches simulated child orders into `tradingEngine.ts` with real-time portfolio cash and position updates. | Component integration test. |
