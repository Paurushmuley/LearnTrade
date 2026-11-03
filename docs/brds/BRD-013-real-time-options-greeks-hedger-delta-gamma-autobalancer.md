# Business Requirements Document (BRD)
## TradeCraft AI — Real-Time Options Greeks Hedger & Dynamic Delta-Gamma Neutral Autobalancer

- **Document ID:** `BRD-013-OPTIONS-GREEKS-HEDGER-AUTOBALANCER`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 13 (Options Volatility & Institutional Greeks Risk Management Suite)
- **Dependencies:** 
  - Sprint 1 (`taxEngine.ts` — Indian Statutory Broker Fees, `tradingEngine.ts` — Paper Portfolio)
  - Sprint 2 (`optionsEngine.ts` — Black-Scholes Analytical Engine & Greeks)
  - Sprint 4 (`replayEngine.ts` — Level-2 Market Depth DOM)
  - Sprint 10 (`proofEngine.ts` — Proof-of-Alpha Cryptographic Ledger)
  - Sprint 11 (`quantDeskEngine.ts` — Autonomous Quant Desk)

---

## 1. Executive Summary & Problem Statement

### 1.1 The F&O Retail Crisis: Delta Drift, Explosive Gamma & Expiry Blowups
The National Stock Exchange of India (NSE) is the world's largest derivatives exchange by contract volume, driven by weekly and monthly options on **NIFTY 50**, **BANKNIFTY**, and **FINNIFTY**. Retail traders and proprietary options desks predominantly engage in non-directional option selling strategies: Short Straddles, Iron Condors, Short Strangles, and Calendar Spreads. 

However, empirical SEBI findings show that **over 93% of retail individual traders in Indian Equity F&O incur net losses**, with the single greatest contributor to catastrophic drawdowns being:
1. **Delta Drift & Directional Vulnerability:** A short straddle or delta-neutral iron condor begins with $\Delta_{\text{port}} \approx 0$. As the underlying index moves even 0.5% (120 points on NIFTY), position Delta drifts rapidly away from zero ($\Delta_{\text{port}} \gg 0$ or $\Delta_{\text{port}} \ll 0$), turning a non-directional income strategy into a highly unhedged directional gamble.
2. **Explosive Pin & Gamma Risk Near Expiry (0DTE/1DTE):** Near market expiry, ATM options experience extreme Gamma ($\Gamma \to \infty$). As spot moves, Delta changes violently with high second-order acceleration:
   $$\Delta(S + \Delta S) \approx \Delta(S) + \Gamma \cdot \Delta S + \frac{1}{2}\frac{\partial \Gamma}{\partial S}(\Delta S)^2$$
   Unhedged traders suffer sudden exponential losses within minutes during morning or afternoon expiry trend runs.
3. **The "Continuous Rebalancing" Cost Trap:** In classical academic quantitative finance (Black-Scholes-Merton), continuous delta hedging assumes zero transaction costs. In real Indian markets, every hedge rebalance incurs **Securities Transaction Tax (STT)**, NSE exchange turnover fees, SEBI turnover charges, and 18% GST. Over-frequent rebalancing causes severe **Fee Erosion**, wiping out all collected option premium.
4. **Lack of Institutional Hedging Tools for Retail:** Professional market makers and volatility hedge funds (e.g., Citadel, Jane Street, Optiver) use real-time Greeks aggregation, corridor-based Delta thresholds (Whalley-Wilmott), and automated futures/option rebalancers. Retail traders currently have zero access to an automated Delta-Gamma neutral autobalancer tailored to Indian market rules.

### 1.2 The TradeCraft AI Solution: Dynamic Greeks Hedger & Autobalancer
**Sprint 13** delivers an institutional-grade **Real-Time Options Greeks Hedger & Dynamic Delta-Gamma Neutral Autobalancer**:
- **Real-Time Portfolio Greeks Aggregation:** Instantaneous calculation of aggregate Portfolio Delta ($\Delta_{\text{port}}$), Rupee Delta ($\text{₹}\Delta$), Gamma ($\Gamma_{\text{port}}$), Theta ($\Theta_{\text{port}}$), and Vega ($\mathcal{V}_{\text{port}}$) across all open multi-strike positions.
- **Corridor-Based Delta Tolerance Bands (Whalley-Wilmott Model):** Implements dynamic neutral bounds $[-\Delta_{\text{thresh}}, \, +\Delta_{\text{thresh}}]$ to prevent fee erosion from micro-fluctuations while strictly capping directional exposure.
- **Dual Hedging Engines:**
  - **Delta Neutralization via Index Futures:** Calculates the exact contract lot sizing to instantaneously restore $\Delta_{\text{port}} = 0$ using linear underlying futures without altering portfolio Gamma or Vega.
  - **Delta-Gamma Neutralization via Secondary Option Strikes:** Solves a simultaneous 2-variable linear system to neutralize both Delta and Gamma simultaneously.
- **3 Dynamic Autobalancing Modes:**
  - **Manual Discretionary:** Visual Greek Cockpit with live drift alarms and 1-click recommended hedge execution.
  - **Semi-Autonomous (Approval Required):** System drafts optimal hedge orders with statutory fee and margin impact previews, awaiting trader sign-off.
  - **Fully Autonomous Auto-Pilot:** Automatically detects boundary breaches, checks statutory cost budgets and volatility circuit breakers, and dispatches rebalancing fills into the portfolio.
- **Indian Exchange Lot Clamping & Statutory Tax Guard:** Rounds hedge legs to exact NSE lot sizes (NIFTY = 25, BANKNIFTY = 15) and tracks cumulative hedging fees against an allowable cost budget.

---

## 2. Institutional Architecture & Greeks Hedging Topography

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MULTI-LEG OPTIONS BOOK (PORTFOLIO)                   │
│   (e.g., Short NIFTY 24200 Straddle + Long 24000/24400 Iron Condor Wings)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 src/lib/optionsGreeksHedgerEngine.ts                        │
│  1. Ingest Spot Price & Option Legs (Strikes, Expiries, IVs)                │
│  2. Compute Leg Greeks via Analytical Black-Scholes Engine                  │
│  3. Aggregate Portfolio Greeks: Net Delta, Rupee Delta, Gamma, Theta, Vega │
│  4. Evaluate Whalley-Wilmott Delta Tolerance Corridor                       │
└──────────────────┬──────────────────────────────────────┬───────────────────┘
                   │                                      │
          Within Tolerance Band                 Breach of Tolerance Band
          (|Delta| <= Delta_thresh)              (|Delta| > Delta_thresh)
                   │                                      │
                   ▼                                      ▼
         ┌──────────────────┐               ┌─────────────────────────────────┐
         │ Status: NEUTRAL  │               │ Trigger Rebalancing Hedge Solver│
         │ Maintain Current │               └─────────────┬───────────────────┘
         │ Position State   │                             │
         └──────────────────┘         ┌───────────────────┴───────────────────┐
                                      ▼                                       ▼
                        ┌───────────────────────────┐   ┌───────────────────────────┐
                        │   Mode A: Futures Delta   │   │ Mode B: Delta-Gamma Multi │
                        │   Pure Linear Neutralizer │   │ Neutralize both Delta &   │
                        │   Q_fut = -round(Delta/L) │   │ Gamma via 2 Option Legs   │
                        └─────────────┬─────────────┘   └─────────────┬─────────────┘
                                      │                               │
                                      └───────────────┬───────────────┘
                                                      │
                                                      ▼
                                        ┌───────────────────────────┐
                                        │  Statutory Tax & Churn    │
                                        │  Budget Verification      │
                                        │  (taxEngine.ts check)     │
                                        └─────────────┬─────────────┘
                                                      │
                                                      ▼
                                        ┌───────────────────────────┐
                                        │  Execution Routing        │
                                        │  Manual / Semi / Auto     │
                                        └─────────────┬─────────────┘
                                                      │
                                                      ▼
                                        ┌───────────────────────────┐
                                        │ Paper Portfolio Update &  │
                                        │ Proof-of-Alpha Attestation│
                                        └───────────────────────────┘
```

---

## 3. Mathematical Formulations & Hedging Models

### 3.1 Portfolio Greeks Aggregation
For an options portfolio consisting of $K$ active legs:

#### 1. Aggregate Portfolio Delta ($\Delta_{\text{port}}$)
$$\Delta_{\text{port}} = \sum_{k=1}^K \text{Side}_k \times Q_k \times \Delta_k$$
Where $\text{Side}_k = +1$ for LONG positions, $-1$ for SHORT positions, and $\Delta_k$ is the analytical Black-Scholes option delta:
$$\Delta_{\text{call}} = N(d_1), \quad \Delta_{\text{put}} = N(d_1) - 1$$

#### 2. Rupee Delta ($\text{₹}\Delta$)
Represents the theoretical change in portfolio rupee value for a 1-point move in the underlying index:
$$\text{Rupee Delta} = \Delta_{\text{port}} \times S_{\text{spot}}$$
For example, if $\Delta_{\text{port}} = +2.5$ on NIFTY ($S = 24,000$), a 1% move (+240 points) generates $\approx +₹60,000$ P&L change.

#### 3. Aggregate Portfolio Gamma ($\Gamma_{\text{port}}$)
$$\Gamma_{\text{port}} = \sum_{k=1}^K \text{Side}_k \times Q_k \times \Gamma_k$$
Where $\Gamma_k = \frac{N'(d_1)}{S \sigma \sqrt{T}}$. High negative Gamma indicates severe pin risk near expiry.

#### 4. Aggregate Portfolio Theta ($\Theta_{\text{port}}$)
$$\Theta_{\text{port}} = \sum_{k=1}^K \text{Side}_k \times Q_k \times \Theta_k \quad (\text{₹ decay per calendar day})$$

#### 5. Aggregate Portfolio Vega ($\mathcal{V}_{\text{port}}$)
$$\mathcal{V}_{\text{port}} = \sum_{k=1}^K \text{Side}_k \times Q_k \times \text{Vega}_k \quad (\text{₹ P\&L change per } 1\% \text{ change in IV})$$

---

### 3.2 Whalley-Wilmott Delta Tolerance Corridor
To prevent over-frequent rebalancing from eroding option profits via Indian statutory charges, the autobalancer defines a band around Delta zero:

$$\text{Tolerance Band} = [-\Delta_{\text{thresh}}, \, +\Delta_{\text{thresh}}]$$
Where:
$$\Delta_{\text{thresh}} = \max\left( \delta_{\text{user}}, \, \left( \frac{3}{2} \frac{\gamma_{\text{tax}} \cdot S \cdot \Gamma_{\text{port}}^2}{\kappa_{\text{risk}}} \right)^{1/3} \right)$$
- $\gamma_{\text{tax}}$: Statutory transaction fee rate per turnover ($\approx 0.05\%$).
- $\kappa_{\text{risk}}$: Risk aversion parameter.
- $\delta_{\text{user}}$: User-configured delta corridor (e.g., $0.10 \times \text{LotSize}$ or $\pm ₹25,000$ Rupee Delta).

**Condition for Rebalancing:**
$$\vert \Delta_{\text{port}} \vert > \Delta_{\text{thresh}} \implies \textbf{Trigger Hedge Action}$$

---

### 3.3 Hedging Solvers & Formulations

#### Solver A: Linear Delta Neutralization via Index Futures
Index Futures have $\Delta_{\text{future}} = 1.0, \Gamma_{\text{future}} = 0, \mathcal{V}_{\text{future}} = 0$.
The required hedge quantity $Q_{\text{fut}}$ to achieve $\Delta_{\text{post}} = 0$:

$$Q_{\text{fut, raw}} = -\Delta_{\text{port}}$$
Clamping to Indian Exchange Lot Size $L_{\text{fut}}$ (e.g., $L = 25$ for NIFTY, $15$ for BANKNIFTY):

$$Q_{\text{fut}} = -\text{round}\left( \frac{\Delta_{\text{port}}}{L_{\text{fut}}} \right) \times L_{\text{fut}}$$
- If $Q_{\text{fut}} > 0 \implies \textbf{BUY } Q_{\text{fut}} \text{ Futures contracts}$.
- If $Q_{\text{fut}} < 0 \implies \textbf{SELL } \vert Q_{\text{fut}} \vert \text{ Futures contracts}$.

#### Solver B: Delta-Gamma Neutralization via Secondary Option Strikes
To neutralize both Delta and Gamma simultaneously, the engine selects two liquid strikes (e.g., Strike 1 = ATM Call/Put, Strike 2 = OTM Wing) and solves the $2 \times 2$ linear system:

$$\begin{pmatrix} \Delta_1 & \Delta_2 \\ \Gamma_1 & \Gamma_2 \end{pmatrix} \begin{pmatrix} q_1 \\ q_2 \end{pmatrix} = \begin{pmatrix} -\Delta_{\text{port}} \\ -\Gamma_{\text{port}} \end{pmatrix}$$

By Cramer's Rule (where determinant $D = \Delta_1 \Gamma_2 - \Delta_2 \Gamma_1 \ne 0$):
$$q_1 = \frac{-\Delta_{\text{port}}\Gamma_2 + \Gamma_{\text{port}}\Delta_2}{D}$$
$$q_2 = \frac{-\Gamma_{\text{port}}\Delta_1 + \Delta_{\text{port}}\Gamma_1}{D}$$
The raw quantities $q_1, q_2$ are rounded to nearest valid exchange lot multiples:
$$Q_1 = \text{round}\left(\frac{q_1}{L}\right) \times L, \quad Q_2 = \text{round}\left(\frac{q_2}{L}\right) \times L$$

---

### 3.4 Statutory Fee Budgeting & Churn Guard
Every proposed hedge trade is routed through `taxEngine.ts` to compute:
$$\text{Fee}_{\text{hedge}} = \text{STT} + \text{TurnoverCharge} + \text{SEBI} + \text{StampDuty} + \text{GST}_{18\%}$$

The Autobalancer enforces:
1. **Fee Budget Limit:** Total cumulative hedging fees must not exceed $\kappa_{\text{budget}}\%$ (default 8%) of initial portfolio net premium collected.
   $$\sum \text{Fee}_{\text{hedge}} > 0.08 \times \text{Premium}_{\text{net}} \implies \textbf{Halt Auto-Pilot (Fee Budget Exceeded)}$$
2. **Minimum Rebalancing Interval (Throttle):** Rebalancing frequency is capped at a minimum time $\tau_{\text{throttle}}$ (default 180 seconds), preventing high-frequency churn during momentary price spikes.
3. **Extreme Volatility Circuit Breaker:** If index moves $> 1.25\%$ within 5 minutes, autobalancing is paused with status `PAUSED_VOLATILITY_SPIKE` to avoid executing into an illiquid falling knife.

---

## 4. Autobalancing Modes & Execution Profiles

| Autobalancer Mode | Description | User Interaction | Safety Guardrails |
| :--- | :--- | :--- | :--- |
| **Manual Discretionary** | Live radar displays Greeks & drift gauge. Recommends exact hedge order. | User manually reviews and clicks "Execute Recommended Hedge". | Alerts on tolerance corridor breach. |
| **Semi-Autonomous** | Generates formal Hedge Ticket with pre-trade statutory tax preview and margin check. | Requires 1-click modal confirmation from the trader. | Auto-cancels if spot moves $>0.2\%$ before confirmation. |
| **Fully Autonomous Auto-Pilot** | Continuously evaluates Greeks on tick updates and autonomously executes optimal hedge. | Zero-touch; runs in background. | Enforces throttle interval, tax churn budget, and circuit breaker. |

---

## 5. System Architecture & Component Specifications

### 5.1 New Core Modules & Components

1. **`src/types/optionsHedger.ts`:**
   - Defines `PortfolioGreeks`, `DeltaCorridorConfig`, `HedgeRecommendation`, `AutobalancerSession`, `GreeksRebalanceEvent`.
2. **`src/lib/optionsGreeksHedgerEngine.ts` (Core Engine):**
   - Portfolio Greeks aggregator integrating Black-Scholes formulas from `optionsEngine.ts`.
   - Whalley-Wilmott tolerance corridor evaluator.
   - Futures Delta Solver & Option Delta-Gamma 2x2 Matrix Solver.
   - NSE Lot Size clamping engine (NIFTY = 25, BANKNIFTY = 15).
   - Pre-trade statutory fee estimator using `taxEngine.ts`.
   - Autobalancer state machine with churn budget and volatility breakers.
3. **`src/components/GreeksHedgerModal.tsx` (Interactive Greeks Cockpit UI):**
   - **Real-Time Greeks Radar:** Visual circular gauges for Portfolio Delta ($\Delta$), Rupee Delta ($\text{₹}\Delta$), Gamma ($\Gamma$), Theta ($\Theta$), and Vega ($\mathcal{V}$).
   - **Visual Delta Drift Corridor:** Dynamic slider track showing target zero, lower/upper tolerance boundaries, and current drift playhead.
   - **Gamma Acceleration Heat Gauge:** Color-coded pin risk meter (Low = Green, Moderate = Amber, Pin Risk = Red).
   - **Recommended Hedge Card:** Displays proposed action (e.g., *"SELL 50 NIFTY Futures @ ₹24,180"*), expected post-hedge Delta ($\Delta_{\text{new}} \approx 0.02$), margin requirement, and statutory fees breakdown.
   - **Autobalancer Mode Switcher:** Toggle between Manual, Semi-Auto, and Auto-Pilot with live status beacon.
   - **Audit Execution History Table:** Historical log of all rebalancing actions with timestamps, slippage, and fees.
4. **Header Navigation & Terminal Binding:**
   - Add **"⚡ Greeks Hedger"** button in `src/components/Header.tsx` adjacent to Option Chain and Quant Desk.
   - Badge indicator showing live Portfolio Delta status (`NEUTRAL`, `DRIFTING`, `HEDGING`).

---

## 6. Data Flow & Entity Specifications

```
┌─────────────────────────────────────────────────────────────┐
│                 Live Options Book / Ticks                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             optionsGreeksHedgerEngine.ts                    │
│  - Compute Analytical Black-Scholes Greeks per Leg          │
│  - Aggregate Portfolio Delta, Gamma, Theta, Vega            │
│  - Check Corridor: |Delta_port| > Delta_thresh?             │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
      Within Corridor                      Breach Detected
      Status: NEUTRAL                 ┌─────────────────────────────┐
                                      │ Calculate Futures / Options │
                                      │ Hedge Quantities & Taxes    │
                                      └──────────────┬──────────────┘
                                                     │
                                                     ▼
                                      ┌─────────────────────────────┐
                                      │ Dispatch via Selected Mode  │
                                      │ Manual / Semi / Auto-Pilot  │
                                      └──────────────┬──────────────┘
                                                     │
                                                     ▼
                                      ┌─────────────────────────────┐
                                      │ Update Portfolio & Emits    │
                                      │ Proof-of-Alpha Receipt      │
                                      └─────────────────────────────┘
```

### 6.1 TypeScript Interfaces (`src/types/optionsHedger.ts`)
```typescript
export interface PortfolioGreeks {
  netDelta: number;
  rupeeDelta: number; // netDelta * spotPrice
  netGamma: number;
  netTheta: number; // daily ₹ decay
  netVega: number;
  underlyingSpot: number;
  timestamp: number;
}

export interface DeltaCorridorConfig {
  symbol: string;
  maxDeltaTolerance: number; // e.g. 0.15 (lots)
  maxRupeeDeltaTolerance: number; // e.g. 30,000 INR
  hedgingInstrument: 'FUTURES' | 'SECONDARY_OPTIONS';
  mode: 'MANUAL' | 'SEMI_AUTONOMOUS' | 'FULL_AUTOPILOT';
  rebalanceThrottleSec: number; // minimum seconds between rebalances (e.g. 180)
  feeBudgetPctOfPremium: number; // maximum fee expenditure (e.g. 8%)
}

export interface HedgeRecommendation {
  id: string;
  timestamp: number;
  symbol: string;
  type: 'FUTURES_DELTA_HEDGE' | 'OPTION_DELTA_GAMMA_HEDGE';
  currentNetDelta: number;
  projectedNetDelta: number;
  currentNetGamma: number;
  projectedNetGamma: number;
  action: 'BUY' | 'SELL';
  instrument: string; // e.g. "NIFTY-FUT" or "NIFTY24NOV24200PE"
  quantity: number;
  executionPrice: number;
  estimatedStatutoryTaxes: number;
  requiredMargin: number;
  status: 'PENDING' | 'EXECUTED' | 'DISMISSED' | 'REJECTED_BUDGET';
}

export interface AutobalancerSession {
  sessionId: string;
  symbol: string;
  isActive: boolean;
  mode: 'MANUAL' | 'SEMI_AUTONOMOUS' | 'FULL_AUTOPILOT';
  totalRebalancesExecuted: number;
  cumulativeTaxesIncurred: number;
  initialNetPremiumCollected: number;
  isPaused: boolean;
  pauseReason?: string;
  lastRebalanceTimestamp: number;
}
```

---

## 7. Regulatory & Compliance Standards (SEBI Schedules)

1. **SEBI Algorithmic Trading Safeguards (SEBI/HO/MRD/DP/CIR/P/2018/101):**
   - Implements automated kill switches, order-to-trade limits, and price range checks.
   - Prevents recursive order loops by enforcing strict rebalancing cooldown periods ($\ge 180$ seconds).
2. **Clear Educational Simulation Disclaimer:**
   In compliance with SEBI advertising guidelines:
   > *"Institutional Simulation Notice: The Options Greeks Hedger and Dynamic Autobalancer simulates professional volatility hedge fund risk management practices. All calculations, delta-neutral hedging recommendations, and auto-pilot fills are executed strictly within the TradeCraft AI simulated paper trading environment with realistic Indian statutory tax deductions."*
3. **Zero-Knowledge Privacy:**
   All option positions, Black-Scholes mathematical calculations, and automated hedging states execute 100% locally in the browser runtime.

---

## 8. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-GRK-01** | Portfolio Greeks aggregator correctly sums Delta, Rupee Delta, Gamma, Theta, and Vega across multi-leg option positions. | Automated unit test (`test/optionsGreeksHedgerEngine.test.mjs`) verifying mathematical parity against Black-Scholes formulas. |
| **AC-GRK-02** | Whalley-Wilmott Delta tolerance corridor accurately detects when $|\Delta_{\text{port}}| > \Delta_{\text{thresh}}$ and flags breach status. | Unit test verifying breach detection across spot movements. |
| **AC-GRK-03** | Linear Futures Delta solver computes exact contract lots clamped to NSE lot size (NIFTY = 25, BANKNIFTY = 15) to restore Delta near zero. | Unit test verifying post-hedge Delta $\approx 0$. |
| **AC-GRK-04** | Delta-Gamma Matrix solver computes valid option strike quantities to simultaneously neutralize Delta and Gamma. | Unit test verifying 2x2 linear matrix inversion. |
| **AC-GRK-05** | Fee Churn Guard halts auto-pilot if cumulative statutory taxes exceed allowable budget percentage. | Unit test verifying auto-pilot halt on tax budget breach. |
| **AC-GRK-06** | Interactive Greeks Hedger modal renders live Greeks radar, corridor drift track, recommended hedge card, and triggers portfolio execution. | UI component verification and integration testing. |

---

## 9. Summary & Next Steps
**BRD-013** bridges the gap between retail option selling and institutional volatility trading. By providing dynamic Delta-Gamma neutral hedging, Whalley-Wilmott tolerance corridors, and statutory fee churn protection, TradeCraft AI empowers traders to survive and profit in Indian derivatives markets without blowing up on expiry day delta moves.

Upon approval, this document will be indexed in `docs/brds/README.md` and handed over to the Scrum Master Agent for task decomposition in `docs/backlog.md`.
