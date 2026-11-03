# Business Requirements Document (BRD)
## TradeCraft AI — Real-Time Options Greeks Hedger & Dynamic Delta-Gamma Neutral Autobalancer

- **Document ID:** `BRD-013-OPTIONS-GREEKS-HEDGER-DELTA-GAMMA-NEUTRAL-AUTOBALANCER`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 13 (Options Greeks Desk & Automated Hedging Suite)
- **Dependencies:** 
  - Sprint 1 (`taxEngine.ts` — Indian Statutory Broker Fees, `tradingEngine.ts` — Paper Portfolio Engine)
  - Sprint 2 (`optionsEngine.ts` — Black-Scholes Formula & Greeks Calculation)
  - Sprint 4 (`replayEngine.ts` — Market Data Stream)
  - Sprint 5 (`analyticsEngine.ts` — Quant Risk & Ruin Modeling)
  - Sprint 11 (`quantDeskEngine.ts` — Chief Risk Officer & Execution Algorist)
  - Sprint 12 (`tradeCopierEngine.ts` — Multi-Broker Routing & Lot Clamping)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Option Trader's Dilemma: Directional Drift & Gamma Traps
Options trading in the Indian equity derivatives market (NSE NIFTY 50 and BANKNIFTY) has exploded into one of the largest derivative venues on earth. However, over 93% of Indian retail F&O traders incur net losses (SEBI 2023 Study), largely driven by two structural pitfalls:
1. **Unmonitored Delta Drift ($\Delta_{\text{drift}}$):** A trader sells an Iron Condor or Short Strangle intending to capture time decay ($\Theta$), but as the index trends upward or downward, the net delta of the portfolio drifts from $0$ to $+150$ or $-200$. Without real-time aggregation, the trader unknowingly transforms a volatility arbitrage into an aggressive naked directional gamble.
2. **The "Short Gamma" Explosion ($\Gamma_{\text{trap}}$):** Non-linear curvature risk causes delta to accelerate dramatically during abrupt market moves. If a trader holds net negative Gamma ($-\Gamma$), every 50-point adverse move accelerates their loss exponentially. Most retail platforms only display static Greeks for individual legs, failing to calculate the portfolio's aggregate Greek curvature.
3. **Absence of Institutional Autobalancing Tools:** Proprietary market makers (Tower Research, AlphaGrep, Citadel Securities, Jane Street) never hold unhedged delta overnight. They utilize continuous **Delta Autobalancers** that fire counter-orders in underlying futures or options whenever net delta exceeds a prescribed tolerance band (e.g., $|\Delta| > 25$). Retail traders have never had access to an automated, institutional-grade delta-neutral hedging cockpit.

### 1.2 The TradeCraft AI Solution: Options Greeks Hedger & Delta-Gamma Autobalancer
**Sprint 13** delivers a comprehensive institutional Options Greeks risk mitigation and autobalancing suite:
- **Real-Time Portfolio Greeks Aggregator:** Aggregates Net Delta ($\Delta_{\text{net}}$), Net Gamma ($\Gamma_{\text{net}}$), Net Vega ($\nu_{\text{net}}$), Net Theta ($\Theta_{\text{net}}$), and Net Rho ($\rho_{\text{net}}$) across all open equity shares, futures contracts, and options positions in the active portfolio.
- **Delta-Neutral Solver & Multi-Instrument Hedger:** Calculates the exact counter-balancing order needed to bring portfolio net delta back to zero ($\Delta_{\text{target}} = 0$) or a custom target bias. Supports:
  - **Futures Delta Hedging:** Linear $\Delta = 1.0, \Gamma = 0$, zero time decay impact.
  - **ATM Call/Put Options Hedging:** Curvilinear hedging that adjusts delta while managing gamma and vega.
  - **NSE Exchange Lot Sizing:** Enforces integer lot sizes (NIFTY 25, BANKNIFTY 15) with minimum variance rounding.
- **Gamma Curvature & Stress Scenario Engine:** Models Greek shifts and anticipated P&L impacts across non-linear price shock horizons ($\pm 0.5\%, \pm 1.0\%, \pm 2.0\%$).
- **1-Click "Neutralize Delta" Execution:** Seamlessly triggers market or limit counter-orders directly through the TradeCraft execution engine.
- **Dynamic Auto-Rebalancing Daemon Simulator:** Monitors portfolio delta in the background and simulates automatic rebalancing executions whenever net delta breaches customizable bands ($|\Delta| > 15, 25, 50$).
- **Greeks Risk Radar & 2D Payoff Curvature Visualizer:** An interactive cockpit displaying real-time gauge meters and comparing unhedged vs post-hedge P&L curves across an underlying price spectrum.

---

## 2. Quantitative Architecture & Mathematical Specifications

### 2.1 Portfolio Greeks Aggregation Model
For any portfolio containing $N$ open positions, let position $i$ have quantity $Q_i$ (where $Q_i > 0$ for Long and $Q_i < 0$ for Short):

1. **Net Delta ($\Delta_{\text{net}}$):**
   $$\Delta_{\text{net}} = \sum_{i=1}^{N} Q_i \cdot \Delta_i$$
   - For cash equities or futures: $\Delta_i = 1.0$ (Long) or $-1.0$ (Short).
   - For European Options (Black-Scholes):
     $$\Delta_{\text{call}} = e^{-q T} N(d_1), \quad \Delta_{\text{put}} = -e^{-q T} N(-d_1)$$
     where $d_1 = \frac{\ln(S/K) + (r - q + \frac{1}{2}\sigma^2)T}{\sigma \sqrt{T}}$.

2. **Net Gamma ($\Gamma_{\text{net}}$):**
   $$\Gamma_{\text{net}} = \sum_{i=1}^{N} Q_i \cdot \Gamma_i$$
   - For cash equities or futures: $\Gamma_i = 0$.
   - For European Options:
     $$\Gamma_{\text{call}} = \Gamma_{\text{put}} = \frac{e^{-q T} \phi(d_1)}{S \sigma \sqrt{T}}$$

3. **Net Vega ($\nu_{\text{net}}$):**
   $$\nu_{\text{net}} = \sum_{i=1}^{N} Q_i \cdot \nu_i, \quad \nu = S e^{-q T} \phi(d_1) \sqrt{T} \cdot \frac{1}{100}$$
   (Represents portfolio P&L change per $1\%$ change in Implied Volatility $\sigma$).

4. **Net Theta ($\Theta_{\text{net}}$):**
   $$\Theta_{\text{net}} = \sum_{i=1}^{N} Q_i \cdot \Theta_i$$
   (Represents aggregate daily portfolio time decay in ₹).

### 2.2 Delta-Neutral Hedging Solver
Given current net delta $\Delta_{\text{net}}$ and target net delta $\Delta_{\text{target}}$ (typically $0$):
$$\Delta_{\text{imbalance}} = \Delta_{\text{target}} - \Delta_{\text{net}} = -\Delta_{\text{net}}$$

#### Mode A: Underlying Futures Hedging ($\Delta_{\text{hedge\_inst}} = 1.0$)
$$\text{Raw Quantity} = -\Delta_{\text{net}}$$
Considering lot size $L$ (e.g., $L = 25$ for NIFTY):
$$\text{Lots} = \text{round}\left( \frac{-\Delta_{\text{net}}}{L} \right)$$
$$\text{Hedge Qty} = \text{Lots} \times L$$
$$\text{Hedge Side} = \begin{cases} \text{BUY}, & \text{if } \text{Hedge Qty} > 0 \\ \text{SELL}, & \text{if } \text{Hedge Qty} < 0 \end{cases}$$
$$\text{Residual Post-Hedge Delta } \Delta_{\text{post}} = \Delta_{\text{net}} + \text{Hedge Qty}$$

#### Mode B: ATM Options Hedging
If hedging using ATM Put ($\Delta_{\text{put}} \approx -0.50$) or ATM Call ($\Delta_{\text{call}} \approx +0.50$):
- If $\Delta_{\text{net}} > 0$ (Portfolio is Net Long): Buy ATM Puts or Sell ATM Calls:
  $$\text{Raw Qty} = \frac{-\Delta_{\text{net}}}{\Delta_{\text{opt}}}$$
  $$\text{Lots} = \text{round}\left( \frac{\text{Raw Qty}}{L} \right), \quad \text{Hedge Qty} = \text{Lots} \times L$$

### 2.3 Gamma Curvature & Price Shock Stress Engine
To protect the desk from non-linear acceleration, the engine computes Taylor series expansion approximations of Delta and P&L under underlying price shocks $\Delta S \in \{-2\%, -1\%, -0.5\%, +0.5\%, +1\%, +2\%\}$:

$$\Delta(S + \Delta S) \approx \Delta(S) + \Gamma_{\text{net}} \cdot \Delta S$$
$$\text{Expected P\&L Impact}(\Delta S) \approx \Delta_{\text{net}} \cdot \Delta S + \frac{1}{2} \Gamma_{\text{net}} \cdot (\Delta S)^2$$

**Curvature Risk Classification:**
- **Severe Short Gamma:** $\Gamma_{\text{net}} < -0.05 \implies$ High vulnerability to sudden gaps. Alert status: RED.
- **Moderate Short Gamma:** $-0.05 \le \Gamma_{\text{net}} < -0.01 \implies$ Alert status: AMBER.
- **Gamma Neutral / Long Gamma:** $\Gamma_{\text{net}} \ge -0.01 \implies$ Alert status: GREEN.

### 2.4 Dynamic Auto-Rebalancing Daemon
The autobalancer continuously evaluates:
$$\text{Rebalance Trigger Condition}: \quad |\Delta_{\text{net}}| \ge \text{Tolerance Threshold } (\delta_{\text{tol}})$$
Supported default tolerance bands:
- **Tight:** $\pm 10$ Delta
- **Standard (Institutional):** $\pm 25$ Delta (1 NIFTY Lot equivalent)
- **Wide:** $\pm 50$ Delta (2 NIFTY Lots equivalent)

When triggered:
1. Rebalancing event logged to audit trail.
2. Simulated counter-order created and dispatched.
3. Post-hedge metrics calculated and updated in real time.

---

## 3. UI/UX Specifications (`GreeksHedgerModal.tsx`)

### 3.1 Greeks Risk Radar Gauges
Four high-fidelity indicator cards displaying:
1. **Net Delta ($\Delta$):** Numerical value, status badge (`Neutral`, `Long Bias`, `Short Bias`), and progress bar centered at zero.
2. **Net Gamma ($\Gamma$):** Curvature acceleration rate, risk level tag (`Safe`, `Elevated`, `Critical Short Gamma`).
3. **Net Theta ($\Theta$):** Daily ₹ decay velocity (`+₹X/day` or `-₹X/day`).
4. **Net Vega ($\nu$):** Volatility sensitivity (`₹X per +1% IV move`).

### 3.2 2D Curvature & Payoff Visualizer
An interactive SVG chart displaying:
- **X-Axis:** Underlying price deviation from $-5\%$ to $+5\%$ of current index spot (e.g. 24,000 to 26,000 for NIFTY at 25,000).
- **Y-Axis:** Projected P&L (₹).
- **Orange Curve:** Unhedged Portfolio Payoff Curve (highlighting downward convexity if short gamma).
- **Cyan Curve:** Post-Hedge Payoff Curve (flatter, stabilized payoff trajectory).
- **Zero Line:** Visual benchmark of breakeven.

### 3.3 1-Click Hedge Action & Auto-Rebalancer Panel
- **Instrument Selector:** Underlying Futures (`NIFTY FUT`, $\Delta=1.0$), ATM Call Options, or ATM Put Options.
- **Recommended Hedge Display:** Formatted as `BUY 1 Lot NIFTY FUT (25 Qty) @ ₹24,850` with immediate residual delta prediction (`Residual Delta: +2.1`).
- **1-Click Button:** `[🛡️ Execute Delta-Neutral Hedge]` — Instant execution with success notification toast.
- **Auto-Rebalancer Daemon Toggle:** Switch toggle (`Enabled`/`Disabled`), tolerance band slider or pill selector ($\pm 10, \pm 25, \pm 50$), and status indicator (`Watching...` or `Standby`).
- **Hedge Execution History Log:** Table showing timestamp, instrument, side, lots, executed price, and delta before/after.

---

## 4. Test & Verification Specifications (`test/greeksHedgerEngine.test.mjs`)

| Test ID | Test Category | Scenario & Assertion |
| :--- | :--- | :--- |
| `TC-GRK-TEST-01` | Portfolio Aggregation | Multi-leg portfolio (Long Call + Short Put + Long Equity) produces mathematically sound aggregate Delta, Gamma, Theta, Vega |
| `TC-GRK-TEST-02` | Delta-Neutral Solver | Correctly calculates futures lot quantity to reduce net delta within minimum lot size residue |
| `TC-GRK-TEST-03` | Lot Size Clamping | NIFTY (25) and BANKNIFTY (15) lot rounding behavior conforms to NSE exchange requirements |
| `TC-GRK-TEST-04` | Gamma Shock Stress Test | Verifies non-linear Taylor expansion P&L and Delta shifts under $\pm 1\%$ and $\pm 2\%$ price shocks |
| `TC-GRK-TEST-05` | Auto-Rebalance Daemon | Detects breach when $|\Delta_{\text{net}}| > \text{threshold}$ and generates valid rebalancing order |
| `TC-GRK-TEST-06` | Post-Hedge Residual Delta | Confirms $|\Delta_{\text{post}}| < \text{threshold}$ after simulated hedge execution |

---

## 5. Definition of Done (DoD)
- [x] Comprehensive BRD-013 authored and approved.
- [x] `src/types/greeksHedger.ts` defines all types, interfaces, and enums.
- [x] `src/lib/greeksHedgerEngine.ts` implements portfolio Greek aggregation, delta solver, gamma stress tests, and autobalancer.
- [x] `src/components/GreeksHedgerModal.tsx` implements Radar Gauges, 2D SVG Curvature Payoff, 1-Click Hedge, and Auto-Rebalance Daemon.
- [x] Integrated into `src/components/Header.tsx` (`🛡️ Delta Hedger` button with badge) and `src/app/page.tsx`.
- [x] Feature showcase card added to `src/components/LandingPage.tsx`.
- [x] `test/greeksHedgerEngine.test.mjs` with 100% pass rate.
- [x] Zero TypeScript compilation errors (`npx tsc --noEmit`).
- [x] Background dev server running cleanly on port 3100.
- [x] Committed and pushed to `origin main`.
