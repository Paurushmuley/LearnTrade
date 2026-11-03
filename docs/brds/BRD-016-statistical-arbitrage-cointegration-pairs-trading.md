# Business Requirements Document (BRD)
## TradeCraft AI — Multi-Asset Statistical Arbitrage & Cointegration Pairs Trading Engine

- **Document ID:** `BRD-016-STATARB-COINTEGRATION-PAIRS`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Engineering & Sprint 16 Implementation
- **Version:** 1.0.0
- **Target Release:** Sprint 16 (Quantitative Market-Neutral & Mean-Reversion Suite)
- **Dependencies:** 
  - Sprint 1 (`tradingEngine.ts` — Paper Trading Portfolio, `taxEngine.ts` — Statutory Fees)
  - Sprint 5 (`analyticsEngine.ts` — Quantitative Risk & Drawdown Engine)
  - Sprint 6 (`breadthEngine.ts` — Sectoral Heatmap)
  - Sprint 11 (`quantDeskEngine.ts` — Multi-Agent Virtual Hedge Fund Desk)
  - Sprint 15 (`microstructureEngine.ts` — Level-3 Order Book & Execution Queue)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Pitfalls of Correlation vs. The Rigor of Cointegration
In retail trading, many market participants attempt "pairs trading" based on simple Pearson correlation ($r$). This is an expensive mistake:
1. **Spurious Correlation:** Two trending series (e.g. NIFTY and Bitcoin) can have high correlation ($r > 0.90$) while drifting infinitely apart with zero mean-reversion tendency. Trading correlated non-stationary pairs leads to catastrophic unlimited divergence losses.
2. **Stationarity & Cointegration:** Two non-stationary time series $X_t \sim I(1)$ and $Y_t \sim I(1)$ are **cointegrated** if a linear combination exists such that:
   $$\epsilon_t = Y_t - \beta X_t - \alpha \sim I(0)$$
   where $\epsilon_t$ is stationary with constant mean $\mu = 0$ and bounded variance $\sigma^2$. A stationary residual guarantees that price divergences will inevitably revert to their historical equilibrium.
3. **Dynamic vs Static Hedge Ratios:** Standard Ordinary Least Squares (OLS) produces a static hedge ratio $\beta$, which fails when structural regime shifts, earnings surprises, or dividend payouts alter the relative pricing relationship. An institutional engine requires a **Recursive State-Space Kalman Filter** to estimate time-varying hedge ratios $\beta_t$ in real time.
4. **Statutory Tax Drag on 2-Leg Arbitrage:** Because statistical arbitrage involves executing simultaneous long and short legs across two assets, transaction costs (STT, GST, exchange charges, slippage) are doubled. A viable stat-arb system must explicitly compute the minimum expected spread reversion required to clear statutory hurdle rates before entering trades.

---

## 2. Mathematical Formulations & Quantitative Models

### 2.1 Engle-Granger Two-Step Cointegration Test

#### Step 1: Long-Run Equilibrium Regression
Given price series $Y = [y_1, y_2, \dots, y_T]^T$ and $X = [x_1, x_2, \dots, x_T]^T$:
$$y_t = \alpha + \beta x_t + \epsilon_t$$
Using Ordinary Least Squares:
$$\hat{\beta} = \frac{\text{Cov}(X, Y)}{\text{Var}(X)}, \quad \hat{\alpha} = \bar{Y} - \hat{\beta}\bar{X}$$
Residual spread:
$$e_t = y_t - \hat{\alpha} - \hat{\beta} x_t$$

#### Step 2: Augmented Dickey-Fuller (ADF) Test on Residuals
Fit the regression:
$$\Delta e_t = \gamma e_{t-1} + \sum_{i=1}^p \delta_i \Delta e_{t-i} + u_t$$
The ADF test statistic is the $t$-ratio for $\gamma$:
$$\tau = \frac{\hat{\gamma}}{\text{SE}(\hat{\gamma})}$$
**Decision Rule:**
- If $\tau < -2.86$ (95% MacKinnon critical threshold) $\implies$ Reject $H_0$ (unit root), residuals are **stationary**, pair is **Cointegrated**.
- If $\tau \ge -2.86 \implies$ Fail to reject $H_0$, pair is **not cointegrated** (divergence risk too high to trade).

---

### 2.2 Ornstein-Uhlenbeck (OU) Process & Half-Life of Mean Reversion

The spread dynamics are modeled as a continuous-time Ornstein-Uhlenbeck mean-reverting stochastic process:
$$de_t = \theta (\mu - e_t) dt + \sigma dW_t$$
where $\theta > 0$ is the rate of mean reversion, $\mu$ is long-term mean, and $\sigma$ is diffusion volatility.

In discrete time, this maps to an AR(1) autoregression:
$$\Delta e_t = a + b \, e_{t-1} + \eta_t$$
where $b = e^{-\theta \Delta t} - 1 \approx -\theta \Delta t$.

#### Analytical Half-Life ($t_{1/2}$):
$$t_{1/2} = \frac{\ln(2)}{\theta} = -\frac{\ln(2)}{\ln(1 + b)}$$
- **Trading Interpretation:**
  - $t_{1/2} \in [2, 20]$ bars: Ideal stat-arb candidate with rapid mean-reversion cycles.
  - $t_{1/2} > 40$ bars: Sluggish mean-reversion with prolonged capital lockup risk.
  - $b \ge 0$: Non-reverting or explosive spread; strictly untradeable.

---

### 2.3 Dynamic Kalman Filter Time-Varying Hedge Ratio ($\beta_t$)

To adapt to corporate actions and non-stationary volatility regimes without arbitrary lookback windowing:

#### State-Space Formulation:
1. **Observation Equation:**
   $$y_t = H_t \theta_t + v_t, \quad v_t \sim \mathcal{N}(0, R)$$
   where $H_t = [1, \, x_t]$ and state vector $\theta_t = [\alpha_t, \, \beta_t]^T$.
2. **State Transition Equation:**
   $$\theta_t = \theta_{t-1} + w_t, \quad w_t \sim \mathcal{N}(0, Q)$$
   where $Q = \text{diag}(q_\alpha, q_\beta)$ is process noise covariance and $R$ is measurement variance.

#### Recursive Update Cycle:
$$\hat{\theta}_{t|t-1} = \hat{\theta}_{t-1|t-1}, \quad P_{t|t-1} = P_{t-1|t-1} + Q$$
$$\text{Innovation: } \nu_t = y_t - H_t \hat{\theta}_{t|t-1}$$
$$\text{Innovation Covariance: } F_t = H_t P_{t|t-1} H_t^T + R$$
$$\text{Kalman Gain: } K_t = P_{t|t-1} H_t^T F_t^{-1}$$
$$\text{Updated State: } \hat{\theta}_{t|t} = \hat{\theta}_{t|t-1} + K_t \nu_t$$
$$\text{Updated Covariance: } P_{t|t} = (I - K_t H_t) P_{t|t-1}$$

---

### 2.4 Rolling Z-Score & Market-Neutral Trading Strategy

Given spread $\epsilon_t = y_t - \hat{\beta}_t x_t - \hat{\alpha}_t$:
$$z_t = \frac{\epsilon_t - \mu_{\epsilon, w}}{\sigma_{\epsilon, w}}$$
where $\mu_{\epsilon, w}$ and $\sigma_{\epsilon, w}$ are rolling window ($w = 30$ periods) statistics.

#### Trading Signals:
- **Long Spread (Bullish Spread Divergence):**
  - Trigger: $z_t \le -2.0$.
  - Action: Buy 1 unit of Asset $Y$, Sell $\hat{\beta}_t$ units of Asset $X$.
- **Short Spread (Bearish Spread Divergence):**
  - Trigger: $z_t \ge +2.0$.
  - Action: Sell 1 unit of Asset $Y$, Buy $\hat{\beta}_t$ units of Asset $X$.
- **Mean-Reversion Exit:**
  - Close position when $|z_t| \le 0.25$ or zero-crossing occurs.
- **Emergency Stop-Loss:**
  - Liquidation exit when $|z_t| \ge 3.5$ (structural cointegration breakdown).

---

## 3. Preloaded Indian Equity & Derivatives Pair Universes

1. **Banking Bluechips:** `HDFCBANK` vs `ICICIBANK` (Private Banking Leaders)
2. **Public vs Private Sector Banks:** `SBIN` vs `BANKBARODA`
3. **IT Services Heavyweights:** `TCS` vs `INFY`
4. **Automotive Giants:** `TATAMOTORS` vs `M&M`
5. **Oil Marketing Companies:** `BPCL` vs `IOC`
6. **Benchmark Index Ratio:** `NIFTY 50` vs `BANKNIFTY`

---

## 4. UI Architecture & Interactive Studio (`StatArbModal.tsx`)

1. **Pairs Selector & Cointegration Dashboard:**
   - Pair picker with live ADF test statistic ($\tau$), $p$-value, cointegration status badge (`COINTEGRATED 99%`, `COINTEGRATED 95%`, `NOT COINTEGRATED`), and Half-Life in bars.
2. **2D Rolling Z-Score Spread Chart:**
   - Visualizing real-time $z$-score line with $+2.0\sigma$ upper entry band, $-2.0\sigma$ lower entry band, $0.0\sigma$ mean reversion line, and $\pm 3.5\sigma$ stop-loss bands.
3. **Kalman vs OLS Hedge Ratio Comparison:**
   - Dynamic $\beta_t$ trend curve demonstrating Kalman responsiveness to drift vs rigid static OLS.
4. **Pre-Trade Net Hurdle Rate Calculator:**
   - Displays combined round-trip SEBI statutory taxes for both legs and minimum spread profit required to achieve net profitability.
5. **1-Click "Execute Market-Neutral Pair Trade":**
   - Automatically dispatches both long and short orders with lot sizing rounded to exchange requirements into `tradingEngine.ts`.

---

## 5. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-ARB-01** | OLS regression accurately computes slope $\hat{\beta}$ and intercept $\hat{\alpha}$ with $R^2 \ge 0.85$ on cointegrated pairs. | Unit test in `test/statArbEngine.test.mjs`. |
| **AC-ARB-02** | ADF test correctly rejects unit root ($\tau < -2.86$) on stationary residuals and accepts on random walk drift. | Unit test with synthetic stationary vs non-stationary series. |
| **AC-ARB-03** | Ornstein-Uhlenbeck parameter solver computes finite positive half-life ($t_{1/2} > 0$) for mean-reverting spreads. | Unit test validating half-life formula. |
| **AC-ARB-04** | Kalman filter updates dynamic hedge ratio $\beta_t$ recursively with bounded error covariance $P_t$. | Unit test verifying Kalman convergence. |
| **AC-ARB-05** | Z-score signals trigger long spread ($z \le -2.0$), short spread ($z \ge +2.0$), and stop loss ($|z| \ge 3.5$). | Unit test validating trading rules. |
| **AC-ARB-06** | Pair order execution generates balanced 2-leg positions in `tradingEngine.ts` with exact statutory tax deductions. | Fullstack integration test. |
