# Business Requirements Document (BRD)
## TradeCraft AI — Multi-Leg Options Strategy Payoff Optimizer & Implied Volatility Surface Calibrator (SABR / SVI Models)

- **Document ID:** `BRD-014-OPTIONS-PAYOFF-OPTIMIZER-VOLATILITY-SURFACE`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 14 (Parametric Volatility Modeling & Strategy Optimization Suite)
- **Dependencies:** 
  - Sprint 1 (`taxEngine.ts` — Indian Statutory Taxes, `tradingEngine.ts` — Paper Trading Portfolio)
  - Sprint 2 (`optionsEngine.ts` — Analytical Black-Scholes Engine & Greeks)
  - Sprint 10 (`proofEngine.ts` — Proof-of-Alpha Cryptographic Ledger)
  - Sprint 13 (`greeksHedgerEngine.ts` — Greeks Risk Management & Hedging)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Retail Options Dilemma: Flat Volatility Blindness & Sub-Optimal Payoffs
In modern derivatives trading, options are not priced in isolation; they trade as an interconnected **Implied Volatility (IV) Surface** across strike prices ($K$) and expiration horizons ($T$). In the National Stock Exchange of India (NSE), which hosts the highest volume index options in the world (NIFTY 50 and BANKNIFTY), market pricing exhibits:
1. **Pronounced Downside Volatility Skew:** Out-of-the-money (OTM) Put options consistently trade at a 3% to 8% IV premium over at-the-money (ATM) or out-of-the-money Call options due to persistent institutional hedging demand (crash fear skew).
2. **The "Flat Volatility" Trap in Retail Trading:** Standard retail options software assumes a single flat volatility per expiry or calculates individual Black-Scholes IVs in isolation. Retail traders enter multi-leg structures (e.g. Iron Condors, Butterflies, Calendar Spreads) without realizing they may be **buying overpriced (high-skew) options and selling underpriced options**, yielding a negative statistical edge before transaction costs.
3. **Absence of Parametric Volatility Fitting:** Tier-1 quantitative volatility funds (Citadel, Millennium, Optiver, Jane Street) never trade raw market IVs; they fit smooth, arbitrage-free parametric surfaces such as **SABR (Stochastic Alpha, Beta, Rho)** or **SVI (Stochastic Volatility Inspired)**. This allows them to identify statistically mispriced options, compute accurate second-order sensitivities, and structure high-expectancy payoff structures.
4. **Lack of Automated Multi-Leg Payoff Optimization:** When retail traders select strike widths and expiration dates for multi-leg spreads, they rely on rule-of-thumb guesswork rather than quantitative optimization. They fail to maximize **Probability of Profit (PoP)**, **Return-on-Risk (RoR)**, and **Net Volatility Edge** under realistic Indian statutory taxes (SEBI STT, turnover charges, 18% GST).

### 1.2 The TradeCraft AI Solution: IV Surface Calibrator & Payoff Optimizer
**Sprint 14** delivers an institutional **Implied Volatility Surface Calibrator & Multi-Leg Payoff Optimizer**:
- **Parametric Volatility Smile Fitting:**
  - **SABR Model (Hagan et al.):** Calibrates $\alpha$ (ATM vol level), $\beta$ (elasticity, fixed at 1.0 for equity index), $\rho$ (correlation/skew), and $\nu$ (volatility of volatility).
  - **SVI Model (Gatheral):** Calibrates the 5 raw parameters $(a, b, \rho, m, \sigma)$ to map total implied variance against log-moneyness without static butterfly arbitrage.
- **Mispriced Options & Relative Value Scanner:**
  - Compares market implied volatility ($\sigma_{\text{market}}$) against the smooth model fitted surface ($\sigma_{\text{model}}$) to detect contracts trading rich (sell candidate) or cheap (buy candidate).
  - Calculates theoretical fair price ($P_{\text{fair}}$) and monetary pricing edge per contract.
- **Quantitative Multi-Leg Strategy Optimizer:**
  - Evaluates candidate multi-leg structures (Iron Condor, Broken Wing Butterfly, Bull Call / Bear Put Spreads, Ratio Spreads, Jade Lizards).
  - Objective optimizer maximizes:
    $$\max \left\{ \text{PoP} \times \text{Expectancy} + \text{VolEdge} - \text{StatutoryFeeDrag} \right\}$$
  - Automatically identifies the optimal combination of strikes that maximizes probability-weighted profit while harvesting mispriced volatility.
- **Interactive 2D/3D Volatility Surface Visualizer:**
  - Real-time interactive SVG smile curves with individual market strike dots vs. fitted parametric curves.
  - Residual bar chart displaying market mispricing in basis points.
  - Probability density distribution overlay across prospective expiration spot ranges.

---

## 2. Institutional Architecture & Processing Topography

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 LIVE NSE OPTION CHAIN (NIFTY / BANKNIFTY)                   │
│        Strikes, Bid/Ask Prices, Volume, Open Interest, Expiration Days       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 src/lib/volatilitySurfaceEngine.ts                          │
│  1. Ingest Raw Strikes & Market IVs from optionsEngine.ts                   │
│  2. Compute Forward Price F and Log-Moneyness k = ln(K / F)                 │
│  3. Non-Linear Least Squares Calibration (SABR / SVI Models)                │
│  4. Verify No-Arbitrage Constraints (Calendar & Butterfly Arbitrage)        │
│  5. Calculate IV Residuals: Delta_IV = IV_market - IV_model                 │
│  6. Identify Mispriced Contracts (Rich / Cheap Ratings)                     │
└──────────────────┬──────────────────────────────────────┬───────────────────┘
                   │                                      │
                   ▼                                      ▼
┌──────────────────────────────────────┐┌──────────────────────────────────────┐
│       Volatility Surface Radar       ││   Multi-Leg Strategy Optimizer       │
│  - Parametric Curve vs Market Dots   ││  - Algorithmic Strike Search         │
│  - Parameter Controls: alpha, rho, nu││  - Maximize PoP, RoR & Vol Edge      │
│  - Residuals & Pricing Edge Matrix   ││  - Factor SEBI STT & Statutory Taxes │
└──────────────────┬───────────────────┘└──────────────────┬───────────────────┘
                   │                                       │
                   └───────────────────┬───────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 src/components/VolatilityOptimizerModal.tsx                 │
│  - Interactive Visualizer: Parametric Smiles & Residual Gauges              │
│  - 1-Click Auto-Calibration Engine with Goodness-of-Fit (RMSE, R^2)         │
│  - Optimized Strategy Payoff Inspector with Probability Density Overlay     │
│  - 1-Click Order Dispatch to Paper Portfolio & Proof-of-Alpha Attestation   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Formulations & Calibration Models

### 3.1 The SABR Stochastic Volatility Model (Hagan et al., 2002)
The forward price $F_t$ and its stochastic volatility $\alpha_t$ evolve according to:
$$dF_t = \alpha_t F_t^\beta dW_{1,t}, \quad d\alpha_t = \nu \alpha_t dW_{2,t}, \quad dW_{1,t} \cdot dW_{2,t} = \rho dt$$

For equity index options (NIFTY 50 and BANKNIFTY), $\beta = 1.0$ (log-normal assumption). Hagan's closed-form asymptotic formula for implied volatility $\sigma_{\text{SABR}}(K, F, T)$ is:

$$\sigma_{\text{SABR}}(K, F, T) = \frac{\alpha \cdot \zeta}{\chi(\zeta)} \cdot \left[ 1 + \left( \frac{1}{4}\rho \nu \alpha + \frac{2 - 3\rho^2}{24}\nu^2 \right) T \right]$$

Where:
$$\zeta = \frac{\nu}{\alpha} \ln\left(\frac{F}{K}\right)$$
$$\chi(\zeta) = \ln\left( \frac{\sqrt{1 - 2\rho \zeta + \zeta^2} + \zeta - \rho}{1 - \rho} \right)$$

When $K = F$ (At-The-Money):
$$\sigma_{\text{ATM}} = \alpha \left[ 1 + \left( \frac{1}{4}\rho \nu \alpha + \frac{2 - 3\rho^2}{24}\nu^2 \right) T \right]$$

#### Parameter Interpretations:
- $\alpha > 0$: Overall level of volatility (closely anchored to ATM IV).
- $\beta = 1.0$: Fixed index log-normal elasticity.
- $\rho \in (-1, 1)$: Spot-volatility correlation (typically $-0.70 \le \rho \le -0.30$ in Indian markets, producing the steep downward put skew).
- $\nu > 0$: Volatility of volatility ("vol-vol"), controlling the convexity / upward curvature of the smile wings.

---

### 3.2 The SVI Model (Stochastic Volatility Inspired - Gatheral, 2004)
The SVI model parameterizes total implied variance $w(k, T) = \sigma^2(k, T) \cdot T$ as a function of log-moneyness $k = \ln(K / F)$:

$$w(k) = a + b \left( \rho (k - m) + \sqrt{(k - m)^2 + \sigma^2} \right)$$

Where:
- $a \ge 0$: Base variance level.
- $b \ge 0$: Slope of the asymptotic wings.
- $\rho \in (-1, 1)$: Skew parameter determining smile orientation.
- $m \in \mathbb{R}$: Horizontal translation of the minimum variance point.
- $\sigma > 0$: Curvature at the vertex.

The implied volatility is recovered as:
$$\sigma_{\text{SVI}}(K) = \sqrt{\frac{w\left(\ln(K / F)\right)}{T}}$$

#### Arbitrage-Free Constraints:
To guarantee absence of butterfly arbitrage (ensuring non-negative risk-neutral density $\frac{d^2 C}{dK^2} \ge 0$):
$$b (1 + \vert\rho\vert) \le \frac{4}{T}, \quad a + b \sigma \sqrt{1 - \rho^2} \ge 0$$

---

### 3.3 Calibration Engine & Objective Loss Function
Calibration optimizes parameters $\mathbf{\Theta}_{\text{model}}$ by minimizing the weighted Root Mean Square Error (RMSE) against observed market implied volatilities across $M$ liquid strikes:

$$\min_{\mathbf{\Theta}} \mathcal{L}(\mathbf{\Theta}) = \sqrt{ \frac{1}{\sum_{j=1}^M \omega_j} \sum_{j=1}^M \omega_j \left( \sigma_{\text{market}}(K_j) - \sigma_{\text{model}}(K_j; \, \mathbf{\Theta}) \right)^2 }$$

Where weights $\omega_j$ are proportional to strike liquidity:
$$\omega_j = \sqrt{\text{Volume}_j \cdot \text{OpenInterest}_j}$$

Optimization is executed using bounded Non-Linear Least Squares (Levenberg-Marquardt / Nelder-Mead simplex) with strict parameter bounds:
$$\alpha \in [0.05, 0.80], \quad \rho \in [-0.95, 0.10], \quad \nu \in [0.10, 2.50]$$

#### Goodness-of-Fit Metrics:
- **RMSE:** Model error in volatility percentage points (target: $\text{RMSE} < 0.65\%$).
- **Coefficient of Determination ($R^2$):** Target $R^2 \ge 0.95$.
- **Max Absolute Error ($\text{MAE}_{\text{max}}$):** Identifies outlier strikes.

---

### 3.4 Mispriced Options Identification & Theoretical Edge
For each strike $K_j$:
$$\Delta_{\text{IV}, j} = \sigma_{\text{market}, j} - \sigma_{\text{model}, j}$$

1. **Richness Rating:**
   - **Significantly Overpriced (Rich):** $\Delta_{\text{IV}} \ge +1.50\%$ $\implies$ **Strong Sell Candidate**
   - **Fairly Priced:** $-0.75\% < \Delta_{\text{IV}} < +0.75\%$ $\implies$ **Neutral**
   - **Significantly Underpriced (Cheap):** $\Delta_{\text{IV}} \le -1.50\%$ $\implies$ **Strong Buy Candidate**
2. **Monetary Pricing Edge ($E_{\text{price}}$):**
   $$P_{\text{model}, j} = \text{BlackScholes}(S, K_j, T, r, \sigma_{\text{model}, j})$$
   $$E_{\text{price}} = P_{\text{market}, j} - P_{\text{model}, j}$$

---

### 3.5 Quantitative Multi-Leg Strategy Optimizer

The optimizer searches across all valid combinations of strikes for a selected strategy archetype:
- **Strategy Archetypes:**
  1. **Iron Condor:** Sell OTM Call + Buy further OTM Call + Sell OTM Put + Buy further OTM Put.
  2. **Broken Wing Butterfly (BWB):** Asymmetric butterfly designed for a credit or zero-risk on the upside.
  3. **Bull Call / Bear Put Vertical Spreads:** Directional defined-risk debit spreads.
  4. **Jade Lizard:** Short OTM Put + Short OTM Call spread (collected credit $>$ call spread width $\implies$ zero upside risk).

#### Objective Scoring Function ($J_{\text{strategy}}$):
$$J_{\text{strategy}} = \lambda_1 \cdot \text{PoP} + \lambda_2 \cdot \left(\frac{\mathbb{E}[\text{Profit}]}{\text{MaxLoss}}\right) + \lambda_3 \cdot \text{VolEdge}_{\text{net}} - \lambda_4 \cdot \left(\frac{\text{StatutoryTaxes}}{\text{NetPremium}}\right)$$

Where:
- **Probability of Profit (PoP):**
  $$\text{PoP} = \int_{\text{BE}_{\text{lower}}}^{\text{BE}_{\text{upper}}} f_T(S_T) \, dS_T$$
  Where $f_T(S_T)$ is the log-normal / SABR risk-neutral probability density.
- **Net Volatility Edge ($\text{VolEdge}_{\text{net}}$):**
  $$\text{VolEdge}_{\text{net}} = \sum_{k=1}^K \text{Side}_k \times (\sigma_{\text{market}, k} - \sigma_{\text{model}, k}) \times \text{Vega}_k$$
  (Positive when the strategy sells high-IV contracts and buys low-IV contracts).
- **Statutory Tax Drag:** Evaluated via `taxEngine.ts` to ensure transaction charges do not eliminate statistical edge.

---

## 4. UI Architecture & Interactive Components

### 4.1 Component Breakdown

1. **`src/types/volatilitySurface.ts`:**
   - Defines `SABRParameters`, `SVIParameters`, `VolatilityCalibrationResult`, `MispricedOptionContract`, `OptimizedStrategyResult`, and `SurfaceSliceData`.
2. **`src/lib/volatilitySurfaceEngine.ts` (Core Engine):**
   - Analytical SABR & SVI formula evaluators.
   - Non-linear least squares calibration solver with Levenberg-Marquardt optimizer.
   - Arbitrage-free constraint validators.
   - Strike scanner for mispricing detection.
   - Multi-leg strategy optimizer with PoP integration and statutory tax calculations.
3. **`src/components/VolatilityOptimizerModal.tsx` (Interactive Studio UI):**
   - **Interactive SVG Volatility Smile Canvas:**
     - Plots observed market IV dots against the fitted smooth parametric curve.
     - Toggle between SABR and SVI curves.
     - Interactive cursor showing strike, market IV, model IV, and residual.
   - **Model Parameter Controls & Calibration Bar:**
     - Sliders for $\alpha, \rho, \nu$ with live curve morphing.
     - 1-Click **"Auto-Calibrate"** button executing algorithmic least squares fitting.
     - Quality badges: RMSE, $R^2$, Arbitrage Status (`ARBITRAGE_FREE`).
   - **Mispriced Options Matrix:**
     - Highlighting Rich (Sell) and Cheap (Buy) contracts with edge in ₹ per lot.
   - **Strategy Optimizer Panel:**
     - Strategy selector: Iron Condor, Broken Wing Butterfly, Bull Spread, Bear Spread, Jade Lizard.
     - 1-Click **"Optimize Strikes"** button generating the highest-expectancy setup.
     - Interactive Payoff Curve with Breakevens, Max Profit, Max Loss, and probability distribution bell curve.
     - Pre-trade statutory fee breakdown (`taxEngine.ts`) and 1-Click execution into the paper trading portfolio.
4. **Header Navigation & Terminal Binding:**
   - Dedicated **"📐 Vol Surface"** navigation button in `src/components/Header.tsx` with live calibration status badge.

---

## 5. Data Flow & Entity Specifications

```
┌─────────────────────────────────────────────────────────────┐
│                 Live NSE Options Chain Feed                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               volatilitySurfaceEngine.ts                    │
│  - Extract Forward Price F and Log-Moneyness k              │
│  - Run Levenberg-Marquardt Calibration (SABR / SVI)         │
│  - Verify Arbitrage-Free Conditions                         │
│  - Compute Model Residuals (Delta_IV = IV_mkt - IV_model)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│   Volatility Smile Canvas     │   │ Multi-Leg Strategy Search │
│ - Render Market IV Dots       │   │ - Iterate Candidate Legs  │
│ - Render SABR/SVI Curves      │   │ - Maximize PoP & Vol Edge │
│ - Highlight Rich/Cheap Strikes│   │ - Pre-Trade Tax Preview   │
└───────────────────────────────┘   └─────────────┬─────────────┘
                                                  │
                                                  ▼
                                    ┌───────────────────────────┐
                                    │ Route to Paper Portfolio  │
                                    │ + Proof-of-Alpha Receipt  │
                                    └───────────────────────────┘
```

### 5.1 TypeScript Interfaces (`src/types/volatilitySurface.ts`)
```typescript
export interface SABRParameters {
  alpha: number; // Volatility level (ATM)
  beta: number;  // Elasticity (fixed at 1.0 for equity indices)
  rho: number;   // Spot-volatility correlation (-1 to 1)
  nu: number;    // Volatility of volatility (vol-vol)
}

export interface SVIParameters {
  a: number;     // Vertical variance level
  b: number;     // Wing slope
  rho: number;   // Skew
  m: number;     // Vertex shift
  sigma: number; // Vertex curvature
}

export interface VolatilityPoint {
  strike: number;
  logMoneyness: number;
  marketIV: number;
  modelIV: number;
  residual: number; // marketIV - modelIV
  marketPrice: number;
  modelPrice: number;
  pricingEdge: number; // marketPrice - modelPrice
  rating: 'RICH' | 'CHEAP' | 'FAIR';
  optionType: 'CE' | 'PE';
  openInterest: number;
  volume: number;
}

export interface CalibrationResult {
  modelType: 'SABR' | 'SVI';
  sabrParams?: SABRParameters;
  sviParams?: SVIParameters;
  rmse: number;
  rSquared: number;
  maxAbsoluteError: number;
  isArbitrageFree: boolean;
  points: VolatilityPoint[];
  calibratedAt: number;
}

export interface OptimizedStrategyLeg {
  strike: number;
  optionType: 'CE' | 'PE';
  side: 'BUY' | 'SELL';
  quantity: number;
  marketPrice: number;
  marketIV: number;
  modelIV: number;
  volEdge: number;
}

export interface OptimizedStrategyPayoff {
  strategyName: string;
  underlyingSpot: number;
  expiryDays: number;
  legs: OptimizedStrategyLeg[];
  maxProfit: number;
  maxLoss: number;
  riskRewardRatio: number;
  probabilityOfProfit: number;
  netDebitOrCredit: number;
  netVolEdge: number;
  statutoryTaxes: number;
  breakevens: number[];
  payoffCurve: { spot: number; pnl: number; probabilityDensity: number }[];
}
```

---

## 6. Regulatory & Risk Controls (SEBI Framework)

1. **Clear Educational & Analytical Disclaimer:**
   In compliance with SEBI advertising guidelines and Securities Contracts (Regulation) Act:
   > *"Institutional Simulation Notice: The Implied Volatility Surface Calibrator and Multi-Leg Payoff Optimizer is an educational quantitative modeling environment simulating institutional volatility arbitrage (SABR / SVI models). All calibrations, mispricing ratings, and strategy optimizations are simulations executed within the TradeCraft AI paper trading environment with authentic Indian statutory tax accounting."*
2. **Zero-Knowledge BYOK Privacy:**
   All numerical non-linear optimizations (SABR/SVI calibration, Levenberg-Marquardt solver, strategy search) execute 100% in client-side TypeScript within the browser without uploading trading data to external servers.

---

## 7. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-VOL-01** | SABR analytical formula accurately evaluates implied volatility across strike range matching Hagan closed-form equations. | Automated unit test (`test/volatilitySurfaceEngine.test.mjs`) verifying mathematical precision against benchmark values. |
| **AC-VOL-02** | SVI model correctly evaluates total variance and implied volatility with no-arbitrage constraints. | Unit test verifying non-negative variance and slope limits. |
| **AC-VOL-03** | Calibration engine successfully optimizes SABR/SVI parameters from market strike data, minimizing RMSE ($\text{RMSE} < 0.65\%$) and achieving $R^2 \ge 0.95$. | Unit test calibrating against synthetic and historical NIFTY/BANKNIFTY smile datasets. |
| **AC-VOL-04** | Mispriced options scanner correctly tags strikes with $\Delta_{\text{IV}} \ge +1.5\%$ as `RICH` and $\Delta_{\text{IV}} \le -1.5\%$ as `CHEAP`. | Unit test verifying rating thresholds and pricing edge calculations. |
| **AC-VOL-05** | Multi-Leg Strategy Optimizer finds optimal strikes for Iron Condor and Spreads, maximizing PoP and net volatility edge while deducting SEBI statutory taxes. | Unit test verifying strike optimization monotonicity and tax integration. |
| **AC-VOL-06** | Interactive Volatility Optimizer UI renders SVG smile curves, residual gauges, parameter sliders, payoff diagrams, and routes orders to paper portfolio. | Component rendering test and user workflow verification. |

---

## 8. Summary & Next Steps
**BRD-014** elevates TradeCraft AI into institutional volatility modeling. By combining parametric SABR and SVI surface calibration with automated multi-leg payoff optimization, retail traders and students gain access to the same mathematical toolkit used by the world's elite options market makers and volatility arbitrage hedge funds.

Upon approval, this document will be indexed in `docs/brds/README.md` and handed over to the Scrum Master Agent for task decomposition in `docs/backlog.md`.
