# Project Sprint Backlog

> Managed by **Scrum Master Agent**  
> Source of truth for active sprint tasks, feature decomposition, and delivery status.

## Current Sprint Overview
- **Project:** TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Learning Platform (BYOK Architecture)
- **Active Cycle:** Sprint 28 (Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Allocation Engine)
- **Sprint Status:** SPRINT 28 ACTIVE (Target: 26 SP across 5 work packages; Sprints 1–27 Delivered & Verified — 689 Cumulative SP Delivered)
- **Baseline Quality Gate:** ALL 269/269 Unit Tests Passing across 21 Suites, Strict TypeScript Clean (`tsc --noEmit` 0 errors), Next.js Production Build Serving on 3100
- **Historical Velocity:** Average 25.5 Story Points / Sprint (Sprints 1–27 Delivered & Archived; 689 Cumulative SP Delivered)
- **Planned Sprint 28:** Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Allocation Engine (3-State Gaussian HMM, Baum-Welch EM Estimator, Viterbi Regime Path Decoding, Dynamic Risk Parity Allocation, Volatility Targeting, and Regime Heatmaps)
- **Updated:** 2026-11-20 15:09 IST

---

## Active Sprint 28 Task Board (Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Allocation Engine)

| Task ID | Domain | Work Package Description | Assigned Agent | Story Points | Status | Dependencies | Target Quality Gate |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `TC-HMM-01` | Research & Architecture | Author comprehensive BRD-028: Mathematical formulation of the 3-State Gaussian Hidden Markov Model (HMM) for Indian Market Regimes (Bull Trending, Low-Vol Mean-Reverting, High-Vol Crisis Bear) with transition probability matrix $A = (a_{ij})$, state emission Gaussian parameters $\mu_k, \Sigma_k$, Viterbi algorithm decoding for optimal state trajectory, Baum-Welch (EM) parameter estimation, and forward-backward filtered regime probabilities $P(S_t = k \mid \mathcal{F}_t)$. Formulate dynamic regime-conditional Risk Parity asset allocation weights, dynamic volatility scaling, and drawdown protection (`docs/brds/BRD-028-market-regime-detection-hmm-allocation-engine.md`). | Researcher Lead | 5 SP | `READY_FOR_DEV` | None | BRD-028 approved in `docs/brds/` & registered in `README.md` |
| `TC-HMM-02` | Backend & Quant Engine | Market Regime Detection & HMM Allocation Engine (`src/lib/regimeEngine.ts`, `src/types/regime.ts`): Gaussian HMM state probability decoder, online forward algorithm filter, Viterbi path solver, regime-conditional covariance matrix estimation, equal risk contribution (ERC / Risk Parity) solver with regime risk budgeting, and dynamic volatility targeting. | Backend Lead | 8 SP | `PENDING` | `TC-HMM-01` | Pure functional TS, deterministic calculation, $<2\text{ ms}$ decoding time, 0 compilation errors |
| `TC-HMM-03` | Frontend / UI Components | Interactive Market Regime & HMM Allocation Cockpit Modal (`src/components/RegimeCockpitModal.tsx`): High-tech cyber-dark dashboard featuring real-time 3-state regime probability dials, Markov state transition matrix heatmap, historical regime ribbon timeline across NIFTY/BANKNIFTY/GOLD, and interactive Risk Parity asset weight allocation charts with rebalance triggers. | Frontend Lead | 5 SP | `PENDING` | `TC-HMM-02` | High-tech dark theme, zero layout shifts, responsive SVG probability dials |
| `TC-HMM-04` | Fullstack & Integration | Platform wiring: Header navigation suite under "🧠 Quant Lab", Command Palette (`Ctrl+K`) integration, terminal real-time spot feed synchronization (NIFTY 50, BANKNIFTY, GOLD BEES, LIQUID BEES), and Landing Page Feature Card 26 showcase. | Fullstack Lead | 3 SP | `PENDING` | `TC-HMM-03` | Seamless modal trigger, terminal state sync, responsive across breakpoints |
| `TC-HMM-05` | QA & Verification | Rigorous automated unit test suite in `test/regimeEngine.test.mjs` verifying stochastic matrix properties ($\sum_j a_{ij} = 1$), emission density evaluation, forward filter probability normalization $\sum_k P(S_t = k) = 1$, Viterbi state path optimality, Risk Parity marginal risk contribution equality, and portfolio turnover bounds. | QA Lead | 5 SP | `PENDING` | `TC-HMM-02` | 100% test pass rate, 16+ new unit assertions (target: $\ge 285/285$) |

---

### Sprint 28 Definition of Done (DoD) Quality Gates Checklist
All stories in Sprint 28 must strictly satisfy the following quality gates prior to sprint closeout:
- [ ] **Mathematical Rigor:** Markov transition matrix $A$ rows sum exactly to 1.0; state emission probabilities adhere to multivariate Gaussian densities; Viterbi path decoding is mathematically optimal.
- [ ] **Risk Parity Feasibility:** Equal risk contribution condition strictly met: $w_i (\Sigma w)_i = w_j (\Sigma w)_j$ for all asset pairs $i, j$; weights sum to 1.0 with no leverage breaches.
- [ ] **Dynamic Regime Adaptation:** Filtered regime probabilities respond monotonically to volatility jumps and persistent trend changes.
- [ ] **TypeScript Type Safety:** Strict TypeScript compilation (`npx tsc --noEmit`) passes with 0 errors, 0 warnings, no implicit `any`.
- [ ] **Automated Testing:** 100% unit test pass rate with zero regressions (`npm test` passes all historical + new tests; Target: $\ge 285/285$).
- [ ] **Production Next.js Build:** Clean build and serving on port 3100 with zero hydration or SSR mismatches.
- [ ] **UI/UX Consistency:** Visual design strictly matches TradeCraft AI cyber-dark design system (`bg-slate-900/95`, `border-slate-800`, `cyan-400`, `emerald-400`, `amber-400`, `rose-400`).
- [ ] **Auditability & Standup Tracking:** Full documentation in `docs/backlog.md`, `docs/brds/BRD-028-*.md`, and `docs/daily-reports/2026-11-19.md`.

---

### Sprint 28 User Stories & Acceptance Criteria

#### User Story 1: Gaussian HMM Multi-Regime Analytics Engine (`TC-HMM-01`, `TC-HMM-02`)
- **Story:** *As an Institutional Quantitative Strategist*, I want a 3-State Gaussian Hidden Markov Model (HMM) capable of classifying market conditions into Bull Trending, Low-Vol Mean-Reverting, and High-Vol Crisis Regimes using intraday returns and realized volatility.
- **Acceptance Criteria:**
  - Decodes instantaneous regime probabilities $P(S_t = k \mid \mathcal{F}_t)$ via forward-filtered algorithm.
  - Reconstructs most likely historical regime sequence using Viterbi dynamic programming.
  - Generates regime persistence half-lives and Markov steady-state distribution.

#### User Story 2: Regime-Conditional Risk Parity Multi-Asset Allocation (`TC-HMM-02`)
- **Story:** *As a Quantitative Portfolio Manager*, I want dynamic asset weight calculations that adjust capital across NIFTY 50, BANKNIFTY, GOLD, and LIQUID BEES based on the prevailing regime, equalizing marginal risk contributions.
- **Acceptance Criteria:**
  - Solves Equal Risk Contribution (ERC) portfolio weights using cyclical coordinate descent.
  - Scales overall portfolio gross exposure dynamically with target volatility (e.g. 12% annualized).
  - Shifts defensive weight to Cash/Gold during High-Vol Crisis regimes and equity momentum during Bull regimes.

#### User Story 3: Interactive Market Regime Cockpit Modal (`TC-HMM-03`, `TC-HMM-04`)
- **Story:** *As an Active Trader*, I want a high-tech Regime Studio modal accessible from the Header ("🧠 Quant Lab") and Command Palette (`Ctrl+K`), displaying real-time regime probabilities, transition heatmap, historical regime ribbon, and recommended allocation weights.
- **Acceptance Criteria:**
  - Cyber-dark modal with interactive regime probability dials (Bull, Neutral, Bear).
  - 3x3 Transition matrix heatmap showing transition probabilities between states.
  - Real-time asset weight allocation bar charts with 1-click rebalance execution.

#### User Story 4: Automated Verification & Unit Test Suite (`TC-HMM-05`)
- **Story:** *As a QA Lead*, I want an automated test suite verifying HMM probability bounds, transition matrix stochasticity, Viterbi path optimality, and Risk Parity risk contribution convergence.
- **Acceptance Criteria:**
  - Test suite `test/regimeEngine.test.mjs`.
  - Minimum 16 unit assertions covering extreme market scenarios (flash crashes, low-vol grinds, regime switches).
  - 100% test pass rate with 0 regressions (target: $\ge 285/285$).

---

### Sprint Velocity & Burndown Tracking

| Sprint | Planned SP | Completed SP | Unit Tests Baseline | Status | Key Milestone Delivered |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **Sprint 19** | 26 | 26 | 140 | `DELIVERED` | Cross-Exchange Arbitrage & Latency-Aware SOR (NSE vs BSE) |
| **Sprint 20** | 26 | 26 | 144 | `DELIVERED` | FIX 4.4 Protocol Gateway & Drop-Copy Simulator |
| **Sprint 21** | 26 | 26 | 163 | `DELIVERED` | Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine |
| **Sprint 22** | 26 | 26 | 178 | `DELIVERED` | High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk |
| **Sprint 23** | 26 | 26 | 195 | `DELIVERED` | Institutional Multi-Asset Cross-Margining & Portfolio VaR Optimization Engine |
| **Sprint 24** | 26 | 26 | 210 | `DELIVERED` | Real-Time Options Gamma Squeeze & 0-DTE Expiry Pinning Risk Engine |
| **Sprint 25** | 26 | 26 | 226 | `DELIVERED` | Real-Time Order Flow Toxicity & VPIN Informed Trading Microstructure Engine |
| **Sprint 26** | 26 | 26 | 244 | `DELIVERED` | High-Frequency Market Making & Optimal Avellaneda-Stoikov Inventory Control Engine |
| **Sprint 27** | **26** | **26** | **269** | `DELIVERED` | **Algorithmic Execution Almgren-Chriss Engine & Header Dropdown UI Overhaul** |
| **Sprint 28** | **26** | **0 (Active)** | **269 (Target: 285+)** | `ACTIVE` | **Real-Time Market Regime Detection & Hidden Markov Model Multi-Asset Risk Parity Allocation Engine** |

---

## Completed Sprints Archive

### Sprint 27: Algorithmic Execution Almgren-Chriss & Optimal Order Slicing Engine
- [x] **TC-ACEX-01**: Author comprehensive BRD-027: Mathematical formulation of the Almgren-Chriss (2000) Optimal Order Slicing & Liquidation Framework with dynamic urgency/risk aversion parameter $\lambda$, temporary price impact $h(v_k) = \eta \cdot v_k$, permanent price impact $g(v_k) = \gamma \cdot v_k$, expected execution cost $E[x]$, variance of capture $V[x]$, optimal execution trajectory hyperbolic solver $n_j = 2 \sinh(\frac{1}{2} \kappa \tau) \cosh(\kappa (T - (j - \frac{1}{2})\tau)) / \sinh(\kappa T) \cdot X$, adaptive order slicing across intraday volume profiles, dynamic child order placement (Limit vs Market/IOC), and Perold Implementation Shortfall benchmarking (`docs/brds/BRD-027-almgren-chriss-optimal-execution-engine.md`).
- [x] **TC-ACEX-02**: Almgren-Chriss Execution & Optimal Slicing Engine (`src/lib/almgrenChrissEngine.ts`, `src/types/almgrenChriss.ts`): Closed-form hyperbolic trajectory calculation, efficient frontier curve generation, linear/non-linear temporary and permanent market impact models, child slice scheduling with intraday volume adaptation, dynamic urgency modulation, and Perold Implementation Shortfall decomposition (delay slippage, price impact, market drift, fee drag).
- [x] **TC-ACEX-03**: Interactive Almgren-Chriss Execution & Slicing Studio Modal (`src/components/AlmgrenChrissCockpitModal.tsx`): High-tech cyber-dark dashboard featuring real-time Trajectory visualizer (Almgren-Chriss vs TWAP vs VWAP), Efficient Frontier curve with interactive $\lambda$ risk aversion slider, live child slice execution ladder & progress gauge, slippage attribution waterfall, and 1-click Emergency Liquidation / Pause / Accelerate controls.
- [x] **TC-ACEX-04**: Platform wiring: Header navigation suite under "⚡ Execution", Command Palette (`Ctrl+K`) integration, terminal real-time L2 order book depth sync (NIFTY, BANKNIFTY, RELIANCE, FINNIFTY), order routing dispatch bridge, and Landing Page Feature Card 25 showcase (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-ACEX-05**: Rigorous automated unit test suite in `test/almgrenChrissEngine.test.mjs` (17 tests) and `test/uiNavigation.test.mjs` (8 tests) verifying trajectory sum conservation ($\sum n_j = X$), monotonic decay, risk-aversion sensitivity ($\lambda \to \infty$ vs $\lambda \to 0$), TWAP convergence, market impact scaling, IS positivity, and UI navigation responsiveness. 269/269 total baseline tests passing.

### Sprint 26: High-Frequency Market Making & Optimal Avellaneda-Stoikov Inventory Control Engine
- [x] **TC-ASMM-01**: Author comprehensive BRD-026: Mathematical formulation of the Avellaneda-Stoikov (2008) High-Frequency Market Making framework with finite horizon $T$, reservation (indifference) price $r(s, q, t) = s - q \gamma \sigma^2 (T - t)$, optimal bid/ask spread $\delta^a(q) + \delta^b(q) = \gamma \sigma^2 (T - t) + \frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$, Poisson order arrival intensity $\lambda(\delta) = A e^{-\kappa \delta}$, inventory risk aversion $\gamma$, tick size discretization, and inventory hard limits $Q_{\max}$ (`docs/brds/BRD-026-avellaneda-stoikov-optimal-market-making-engine.md`).
- [x] **TC-ASMM-02**: Avellaneda-Stoikov Market Making & Inventory Control Engine: Reservation price derivation, symmetric/asymmetric bid-ask spread quotes, fill probability & arrival rate simulation, inventory skew adjustment ($q > 0 \implies$ lower reservation price to shed inventory; $q < 0 \implies$ raise reservation price to accumulate), risk aversion sensitivity ($\gamma$), terminal penalty convergence as $t \to T$, and P&L attribution (spread capture vs inventory drift vs execution fees) (`src/lib/asmmEngine.ts`, `src/types/asmm.ts`).
- [x] **TC-ASMM-03**: Interactive Avellaneda-Stoikov Market Making Cockpit Modal: High-tech cyber-dark dashboard featuring real-time Midpoint vs Reservation Price visualizer, optimal asymmetric Bid/Ask quote ladder, inventory position thermometer ($q / Q_{\max}$ with inventory risk zone gauges), intensity curve $\lambda(\delta)$ visualizer, and 1-click Inventory Flatten / Emergency Hedger (`src/components/AsmmCockpitModal.tsx`).
- [x] **TC-ASMM-04**: Fullstack & Integration: Platform wiring into Header navigation suite under "⚡ Execution", Command Palette (`Ctrl+K`) integration, terminal real-time L2 order book depth sync (NIFTY, BANKNIFTY, RELIANCE, FINNIFTY), and Landing Page Feature Card 24 showcase (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-ASMM-05**: Rigorous automated unit test suite in `test/avellanedaStoikovEngine.test.mjs` verifying reservation price symmetry ($q=0 \implies r=s$), inventory skew monotonicity ($\partial r / \partial q < 0$), spread expansion with volatility $\sigma$ and risk aversion $\gamma$, arrival intensity bounds, tick discretization compliance, and inventory boundary constraint enforcement. 18/18 tests passing (244/244 total baseline tests passing).

### Sprint 25: Real-Time Order Flow Toxicity & VPIN Informed Trading Microstructure Engine
- [x] **TC-VPIN-01**: Author comprehensive BRD-025: Formulate Volume-Synchronized Probability of Toxicity (VPIN), volume clock discretization, Bulk Volume Classification (BVC) with normal CDF weighting, Kyle's Lambda price impact parameter ($\lambda$), adverse selection risk for liquidity providers, and toxicity flash crash early warning thresholds (`docs/brds/BRD-025-vpin-informed-trading-microstructure-toxicity-engine.md`).
- [x] **TC-VPIN-02**: VPIN & Order Flow Toxicity Engine: Continuous trade stream volume bucketing (fixed volume bucket size $V$), Bulk Volume Classification using normal distribution CDF ($V_\tau^B = V \cdot \Phi(\Delta P / \sigma_{\Delta P})$), rolling $N$-bucket toxicity accumulator $\text{VPIN} = \frac{\sum_{\tau=1}^N \|V_\tau^B - V_\tau^S\|}{N \times V}$, empirical Kyle's $\lambda$ regression solver, toxicity CDF percentile ranking, and dynamic adverse selection spread adjustment (`src/lib/vpinEngine.ts`, `src/types/vpin.ts`).
- [x] **TC-VPIN-03**: Interactive VPIN & Toxicity Cockpit Modal: High-tech cyber-dark dashboard featuring real-time VPIN dial gauge & historical percentile thermometer, rolling volume bucket imbalance waterfall, Kyle's Lambda depth impact curve, toxic flow warning banners, and 1-click Defensive Hedger / Liquidity Pull (`src/components/VpinCockpitModal.tsx`).
- [x] **TC-VPIN-04**: Header navigation suite under "⚡ Execution", Command Palette (`Ctrl+K`) integration, terminal real-time trade tape & L2 DOM order flow binding for Indian equities/derivatives (NIFTY, BANKNIFTY, RELIANCE), and Landing Page Feature Card 23 showcase (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-VPIN-05**: Rigorous automated unit test suite in `test/vpinEngine.test.mjs` verifying volume bucket boundary preservation, BVC normal CDF trade classification symmetry ($V^B + V^S = V$), VPIN metric normalization ($0 \le \text{VPIN} \le 1$), Kyle's $\lambda$ monotonicity under aggressive order flow, adverse selection spread widening, and flash crash trigger thresholds. 226/226 total tests passing.

### Sprint 24: Real-Time Options Gamma Squeeze & 0-DTE Expiry Pinning Risk Engine
- [x] **TC-PIN-01**: Author comprehensive BRD-024: Formulate 0-DTE intraday gamma acceleration dynamics, Dealer Gamma Exposure ($\text{GEX} = \sum \Gamma_i \times S \times \text{OI}_i \times 100$), Gamma Flip boundary equations, dynamic Max Pain cash-settlement migration, and Fokker-Planck drift diffusion for terminal strike pinning (`docs/brds/BRD-024-options-gamma-squeeze-0dte-pinning-risk-engine.md`).
- [x] **TC-PIN-02**: Gamma Squeeze & 0-DTE Pinning Engine: Aggregate open interest GEX profile across strikes, compute Gamma Flip inflection level, solve dynamic Max Pain with cash-settlement penalty, and simulate 0-DTE intraday theta burn and IV crush (`src/lib/pinningEngine.ts`, `src/types/pinning.ts`).
- [x] **TC-PIN-03**: Interactive 0-DTE Pinning & Gamma Cockpit Modal: Real-time strike pressure heatmap, dealer GEX bar distribution, Gamma Flip level gauge, dynamic Max Pain drift tracker, and 1-click Pin Risk Hedger (`src/components/PinningCockpitModal.tsx`).
- [x] **TC-PIN-04**: Header navigation suite under "⚡ Execution", Command Palette (`Ctrl+K`) integration, terminal index contract synchronization (NIFTY / BANKNIFTY weekly expiries), and Landing Page Feature Card 22 (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-PIN-05**: Rigorous automated unit test suite in `test/pinningEngine.test.mjs` verifying GEX monotonicity, Gamma Flip zero-crossing bounds, Max Pain minimization convergence, and 0-DTE theta scaling behavior. 210/210 total tests passing.

### Sprint 23: Institutional Multi-Asset Cross-Margining & Portfolio VaR Optimization Engine
- [x] **TC-XMG-01**: Author comprehensive BRD-023: Formulate SEBI & Clearing Corporation multi-asset cross-margining framework, inter-commodity spread concessions (NSE Index vs Stock Futures vs MCX hedges), Historical VaR (HVaR) correlation offsets, and statutory collateral haircut schedules (`docs/brds/BRD-023-institutional-cross-margining-portfolio-var.md`).
- [x] **TC-XMG-02**: Cross-Margining & Portfolio VaR Engine: Multi-asset cross-margining correlation offset matrix, margin benefit solver, collateral pledge calculator with statutory haircuts, and portfolio HVaR / CVaR optimization algorithm (`src/lib/crossMarginEngine.ts`, `src/types/crossMargin.ts`).
- [x] **TC-XMG-03**: Interactive Cross-Margining & Collateral Cockpit Modal: Asset allocation breakdown, margin relief visualizer (Isolated vs Cross-Margin comparison), collateral haircut manager with pledge/unpledge simulator, and real-time capital efficiency gauge (`src/components/CrossMarginCockpitModal.tsx`).
- [x] **TC-XMG-04**: Header navigation suite binding ("⚡ Execution" dropdown), Command Palette (`Ctrl+K`) integration, terminal margin state synchronization, and Landing Page showcase Feature Card 21 (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-XMG-05**: Rigorous automated unit test suite in `test/crossMarginEngine.test.mjs` verifying cross-margin offset bounds, collateral haircut percentages, 50:50 cash-to-collateral deficit penalty calculations, HVaR calculations, and portfolio capital relief accuracy. 195/195 total tests passing.


### Sprint 22: High-Frequency Pre-Trade Risk Engine & Portfolio Stress Testing Desk
- [x] **TC-RISK-01**: Author comprehensive BRD-022: Formulate standard SPAN margin methodology (16 scenario risk array grid), Extreme Value Theory (EVT) Generalized Pareto Distribution for Expected Shortfall ($\text{ES}_{99.9\%}$), portfolio Greek stress shock matrices, and SEBI dynamic volatility circuit breaker rules (`docs/brds/BRD-022-pre-trade-risk-engine-span-stress-testing.md`).
- [x] **TC-RISK-02**: SPAN Margin & Stress Testing Engine: Multi-asset scenario matrix (price movement $\pm 3\sigma$, IV shift $\pm 4\%$, calendar spread charge), tail-risk EVT Expected Shortfall solver, and real-time pre-trade order veto filter (`src/lib/riskEngine.ts`, `src/types/risk.ts`, `src/types/riskEngine.ts`).
- [x] **TC-RISK-03**: Interactive Pre-Trade Risk & Stress Desk Modal: 16-scenario SPAN risk surface heatmap, EVT loss distribution tail chart, portfolio Greek sensitivity stress dials ($\pm 10\%$ NIFTY shock), and dynamic circuit breaker monitor (`src/components/RiskCockpitModal.tsx`, `src/components/PreTradeRiskModal.tsx`).
- [x] **TC-RISK-04**: Header navigation suite binding ("⚡ Execution" suite), Command Palette (`Ctrl+K`) integration, pre-trade order interceptor wiring in order submission flow, and Landing Page showcase Feature Card 20 (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-RISK-05**: Rigorous automated unit test suite in `test/riskEngine.test.mjs` verifying SPAN risk array bounds, EVT Pareto tail shape parameters, stress matrix monotonicity, and pre-trade veto rejection. 178/178 total tests passing.

### Sprint 21: Real-Time Options Volatility Dispersion & Multi-Expiry Skew Hedging Engine
- [x] **TC-DISP-01**: Author comprehensive BRD-021: Mathematical formulation of Index vs Constituent Implied Volatility Dispersion, Implied Correlation ($\rho_{\text{impl}}$) extraction, Multi-Expiry Skew Slopes ($d\sigma/dK$), and Gamma Scalping Bands (`docs/brds/BRD-021-options-volatility-dispersion-skew-hedging-engine.md`).
- [x] **TC-DISP-02**: Volatility Dispersion Engine: Correlation-weighted basket variance solver ($\sigma_{\text{basket}}^2 = \sum w_i^2 \sigma_i^2 + 2\sum_{i<j} w_i w_j \rho_{ij} \sigma_i \sigma_j$), dirty dispersion spread identifier, delta/vega neutral hedge solver, and gamma scalping step simulator (`src/lib/dispersionEngine.ts`, `src/types/dispersion.ts`).
- [x] **TC-DISP-03**: Interactive Volatility Dispersion & Skew Studio Modal: Multi-expiry term-structure smile visualizer, constituent correlation & dispersion radar matrix, 1-click basket arbitrage order generator, and real-time gamma scalping band tracker (`src/components/VolatilityDispersionModal.tsx`).
- [x] **TC-DISP-04**: Header navigation suite binding ("🧠 Quant Lab" dropdown), Command Palette (`Ctrl+K`) integration, terminal spot feed wiring in `src/app/page.tsx`, and Landing Page Feature Card 19 showcase in `src/components/LandingPage.tsx`.
- [x] **TC-DISP-05**: Automated unit test suite in `test/dispersionEngine.test.mjs` verifying implied correlation bounds $[-1, 1]$, basket variance calculations, delta-neutral rebalancing, gamma scalping trigger bands, and pre-trade statutory tax integration. 163/163 tests passing.

#### Sprint 21 User Stories & Acceptance Criteria

##### User Story 1: Volatility Dispersion & Implied Correlation Analytics (`TC-DISP-01`, `TC-DISP-02`)
- **Story:** *As a Quantitative Derivatives Trader*, I want to measure the spread between Index Implied Volatility (NIFTY 50) and the weighted Implied Volatility of its top constituents, calculating the implied pairwise correlation ($\rho_{\text{implied}}$), so that I can trade the Correlation Risk Premium via volatility dispersion arbitrage.
- **Acceptance Criteria:**
  - Implied correlation $\bar{\rho}_{\text{impl}}$ is strictly clamped to valid mathematical range $[-1.0, +1.0]$.
  - Supports Top 10 Nifty constituents with normalized index weights $\sum w_i = 1$.
  - Generates clear trading signals: Long Dispersion ($S_{\text{disp}} > \tau$) and Short Dispersion ($S_{\text{disp}} < -\tau$).

##### User Story 2: Multi-Expiry Term Structure Skew & Smile Calibrator (`TC-DISP-02`)
- **Story:** *As an Options Market Maker*, I want to model multi-expiry volatility smiles across near-week, next-week, and monthly expiry cycles, extracting at-the-money skew slopes and term structure regimes.
- **Acceptance Criteria:**
  - Identifies 25-Delta Risk Reversal ($\text{RR}_{25\Delta}$) and Butterfly ($\text{Fly}_{25\Delta}$) curvature.
  - Classifies term structure regimes (Contango, Flat, Backwardation).

##### User Story 3: Delta-Neutral & Vega-Weighted Rebalancer (`TC-DISP-02`)
- **Story:** *As a Quantitative Risk Manager*, I want automated calculation of delta-neutral hedge ratios and vega-weighted basket allocations between the Index and individual single-stock options.
- **Acceptance Criteria:**
  - Computes required underlying futures/cash rebalance units to drive $\Delta_{\text{port}} \approx 0$.
  - Respects Indian lot size quantization.

##### User Story 4: Gamma Scalping Trigger Simulator (`TC-DISP-02`, `TC-DISP-03`)
- **Story:** *As a Systematic Options Scalper*, I want dynamic gamma scalping band triggers ($\pm \Delta_{\text{thresh}}$), showing real-time rebalancing actions and net P&L attribution.
- **Acceptance Criteria:**
  - Real-time P&L decomposition: Net P&L = Scalp Profit - Theta decay - Statutory taxes.
  - Displays scalp log with timestamps, trigger prices, and realized gains.

##### User Story 5: Interactive Volatility Dispersion Modal & Terminal Binding (`TC-DISP-03`, `TC-DISP-04`)
- **Story:** *As an Active Platform Trader*, I want an intuitive, institutional-grade Volatility Dispersion & Multi-Expiry Skew Studio accessible directly from the Header ("🧠 Quant Lab" suite) and Quick Finder (`Ctrl+K`).
- **Acceptance Criteria:**
  - 4 specialized views: Dispersion Radar, Term Structure & Skew, Gamma Scalper, Basket Dispatcher.
  - Seamless integration with Header and Landing Page Card 19.

##### User Story 6: Automated Verification & Unit Test Suite (`TC-DISP-05`)
- **Story:** *As a QA Lead*, I want an automated test suite validating all mathematical invariants, correlation bounds, multi-expiry skew slopes, delta-neutral rebalancing, and statutory fees.
- **Acceptance Criteria:**
  - 19 new test assertions in `test/dispersionEngine.test.mjs`.
  - 100% passing tests with 0 regressions across the entire suite (163/163 passed).

### Sprint 20: Real-Time FIX Protocol Gateway & Institutional Drop-Copy Order Flow Simulator (FIX 4.4 Engine)
- [x] **TC-FIX-01**: Author comprehensive BRD-020 specifying FIX 4.4 protocol dictionary, tag value serialization (Tag 35=D, Tag 35=8), drop-copy session architecture, heartbeat interval timing, and institutional audit logging (`docs/brds/BRD-020-fix-protocol-gateway-order-flow-simulator.md`).
- [x] **TC-FIX-02**: FIX Protocol Engine: Tag-value parser and serializer, Modulo 256 checksum validator, session state machine (Logon, Heartbeat, TestRequest, ExecutionReport), deterministic synthetic exchange simulator, and drop-copy journal logger (`src/lib/fixEngine.ts`, `src/types/fix.ts`).
- [x] **TC-FIX-03**: Interactive FIX Protocol Console Modal: Raw tag-value message stream viewer, session state indicator, manual FIX order injection terminal, tag inspector, and drop-copy compliance journal (`src/components/FixProtocolModal.tsx`).
- [x] **TC-FIX-04**: Header navigation suite binding ("⚡ Execution" suite & Command Palette `Ctrl+K`), terminal order router bridge, and Landing Page showcase Card 18 (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-FIX-05**: Automated test suite verifying FIX tag serialization, checksum verification, sequence number resend recovery, and message rejection handling (`test/fixEngine.test.mjs`). 144/144 tests passing.

#### Sprint 20 User Stories & Acceptance Criteria

##### User Story 1: Raw Tag-Value Serialization & Checksum Engine (`TC-FIX-01`, `TC-FIX-02`)
- **Story:** *As a Quantitative Systems Engineer*, I want bi-directional serialization and parsing of standard FIX 4.4 messages with exact Tag 9 body length and Tag 10 Modulo 256 checksum calculation, so that wire packets are fully conformant with institutional exchange standards.
- **Acceptance Criteria:**
  - Checksum algorithm: $(\sum \text{ASCII}) \pmod{256}$, padded to 3 digits (`sprintf("%03d")`).
  - Supports standard SOH (`\x01`) and visual pipe (`|`) delimiters.
  - Zero performance lag on large packet volumes.

##### User Story 2: Synthetic Exchange Execution Engine (`TC-FIX-02`)
- **Story:** *As an Algorithmic Trader*, I want realistic asynchronous execution responses (`ExecutionReport 35=8`) for injected orders (`NewOrderSingle 35=D`), progressing through Acknowledged (`OrdStatus=0`) to Filled (`OrdStatus=2`), with sub-millisecond wire latency simulation.
- **Acceptance Criteria:**
  - Generates realistic `OrderID`, `ExecID`, `AvgPx`, `CumQty`, and `LeavesQty`.
  - Simulates 1–6ms network cross-connect latency.

##### User Story 3: Drop-Copy Compliance Journal (`TC-FIX-02`, `TC-FIX-03`)
- **Story:** *As a Compliance Officer / Risk Manager*, I want a dedicated read-only Drop-Copy audit stream recording all executions, partial fills, and order events with CSV export capabilities.
- **Acceptance Criteria:**
  - Real-time mirrored drop-copy ledger.
  - 1-click CSV download for regulatory audit trails.

##### User Story 4: Interactive FIX Console Modal & Header Binding (`TC-FIX-03`, `TC-FIX-04`)
- **Story:** *As a Platform User*, I want a high-tech FIX Protocol modal with Live Stream, Order Injector, Drop-Copy Audit, and Tag Dictionary, accessible via Header Execution suite and Command Palette (`Ctrl+K`).
- **Acceptance Criteria:**
  - Integrated into Header ("⚡ Execution" suite) and Command Palette.
  - Feature Card 18 displayed on Landing Page.

### Sprint 19: Cross-Exchange Arbitrage & Latency-Aware Smart Order Router (SOR) for NSE vs BSE
- [x] **TC-SOR-01**: Author comprehensive BRD-019 specifying Indian NBBO (INBBO) aggregation across NSE and BSE, inter-market fee netting, sub-millisecond execution latency modeling with exponential fill decay, and atomic split-liquidity sweep order routing (`docs/brds/BRD-019-cross-exchange-arbitrage-smart-order-router.md`).
- [x] **TC-SOR-02**: Smart Order Router Engine: Dual-exchange Level-2 depth aggregator (`calculateINBBO`), cross-exchange arbitrage detector with statutory fee netting, latency fill probability decay model ($P(\text{Fill}) = \exp(-\lambda \tau)$), greedy split liquidity sweep solver, and 2-leg atomic arbitrage executor with bailout (`src/lib/sorEngine.ts`, `src/types/sor.ts`).
- [x] **TC-SOR-03**: Interactive Cross-Exchange SOR Studio Modal: Synchronized dual-exchange DOM ladders (NSE vs BSE), crossed spread arbitrage radar with 1-click execution, and routing policy telemetry table (`src/components/CrossExchangeSORModal.tsx`).
- [x] **TC-SOR-04**: Header navigation ("⚡ SOR / Arb"), terminal integration with live spot prices, and Landing Page Feature Card 17 (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-SOR-05**: Automated test suite verifying INBBO best bid/ask aggregation, crossed spread detection, statutory fee netting, latency decay, and split liquidity greedy sort (`test/sorEngine.test.mjs`). 140/140 tests passing.

#### Sprint 19 User Stories & Acceptance Criteria

##### User Story 1: Indian NBBO (INBBO) & Dual-Exchange Depth Aggregation (`TC-SOR-01`, `TC-SOR-02`)
- **Story:** *As an Execution Algorist*, I want real-time aggregation of Top 5 Level-2 order books from NSE and BSE into an Indian National Best Bid and Offer (INBBO) ladder, so that I can route child orders to the venue offering the best execution price.
- **Acceptance Criteria:**
  - Synthesize virtual INBBO: $\text{INBBO}_{\text{Bid}} = \max(\text{Bid}_{\text{NSE}}, \text{Bid}_{\text{BSE}})$, $\text{INBBO}_{\text{Ask}} = \min(\text{Ask}_{\text{NSE}}, \text{Ask}_{\text{BSE}})$.
  - Support configurable routing policies: Best Price NBBO, Fee-Adjusted Net Yield, Split Sweep Routing.
  - Zero performance lag on dynamic dual-book updates.

##### User Story 2: Cross-Exchange Arbitrage & Statutory Fee Friction Netting (`TC-SOR-02`)
- **Story:** *As an Arbitrage Desk Quant*, I want automated detection of crossed inter-market spreads ($\text{Spread}_{\text{gross}} = \text{Bid}_A - \text{Ask}_B > 0$) with exact Indian statutory fee hurdles subtracted (SEBI turnover fees, Stamp Duty, GST, Exchange charges), so that false-positive phantom spreads are rejected.
- **Acceptance Criteria:**
  - Net spread calculation: $\text{Spread}_{\text{net}} = \text{Spread}_{\text{gross}} - \text{Fees}_{\text{Leg1}} - \text{Fees}_{\text{Leg2}}$.
  - Classify opportunities by profitability tier: High Alpha ($> ₹0.50$), Marginal ($₹0.10–₹0.50$), Unprofitable ($< 0$).
  - Two-leg simultaneous IOC dispatch with microsecond bailout unwinding if Leg 2 fails.

##### User Story 3: Latency-Aware Fill Probability Decay (`TC-SOR-02`)
- **Story:** *As a High-Frequency Trader*, I want sub-millisecond execution latency modeling against competing co-located HFT desks using exponential fill decay $P(\text{Fill}) = \exp(-\lambda \tau)$, so that race condition risks are quantified prior to order dispatch.
- **Acceptance Criteria:**
  - Simulates network cross-connect latency, broker API gateway delay, and exchange matching queue jitter.
  - Decays fill probability monotonically as round-trip latency $\tau$ increases.
  - Generates realistic partial-fill and unhedge variance simulation.

##### User Story 4: Interactive Cross-Exchange Studio Modal & Telemetry (`TC-SOR-03`, `TC-SOR-04`)
- **Story:** *As a Platform Trader*, I want an interactive Cross-Exchange SOR Studio Modal featuring synchronized dual DOM ladders, real-time crossed spread radar, and routing telemetry.
- **Acceptance Criteria:**
  - Side-by-side comparative DOM ladders for NSE and BSE with highlighted best bids/asks.
  - 1-click execution for arbitrage pairs and smart routed split sweeps.
  - Integrated into Header ("⚡ SOR / Arb") and Landing Page feature showcase.

##### User Story 5: Automated Verification & Unit Test Suite (`TC-SOR-05`)
- **Story:** *As a QA Lead*, I want automated unit tests validating INBBO aggregation, fee-deduction accuracy, exponential latency decay, and greedy split liquidity sort.
- **Acceptance Criteria:**
  - 100% test pass rate in `test/sorEngine.test.mjs`.
  - Zero TypeScript compilation errors (`npx tsc --noEmit`).

---

### Sprint 18: Macroeconomic Sentiment Analysis & News Event Risk Engine for NSE/BSE
- [x] **TC-EVT-01**: Author comprehensive BRD-018 for RBI MPC rate decisions, Union Budget, US Fed FOMC spillover, quarterly corporate earnings calendar, and live NLP sentiment volatility impact on Indian equities (`docs/brds/BRD-018-macroeconomic-sentiment-event-risk-engine.md`).
- [x] **TC-EVT-02**: Event Risk Engine: Dubinsky-Johannes (2006) discrete event variance decomposition ($\sigma_{\text{implied}} = \sqrt{\sigma_{\text{diff}}^2 + V_{\text{event}} / T}$), instantaneous post-event crush forecasting, Loughran-McDonald NLP financial sentiment scoring with hawk/dove stance detection, and pre-event delta/vega hedging (`src/lib/macroEventEngine.ts`, `src/types/macroEvent.ts`).
- [x] **TC-EVT-03**: Macro Event & Sentiment Risk Radar Modal: Economic calendar timeline, 2D SVG volatility smile comparison, implied straddle move extraction, and pre-event position hedging advisor (`src/components/MacroEventModal.tsx`).
- [x] **TC-EVT-04**: Header navigation ("🌐 Macro Risk"), portfolio event beta calculation, and Landing Page Feature Card 16 (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-EVT-05**: Automated test harness verifying event volatility jump calculations, earnings surprise z-scores, and macroeconomic risk scoring (`test/macroEventEngine.test.mjs`). 42 unit test assertions.

### Sprint 18 User Stories & Acceptance Criteria

#### User Story 1: Macroeconomic Calendar & Event Shock Modeling (`TC-EVT-01`, `TC-EVT-02`)
- **Story:** *As a Systematic Risk Manager*, I want to track scheduled macro events (RBI MPC Rate Decisions, Union Budget, US FOMC, GDP, CPI Inflation) with historical volatility shock multipliers, so that positions can be stress-tested against interest rate and liquidity shocks.
- **Acceptance Criteria:**
  - Structured event calendar with shock categories (Monetary Policy, Fiscal Policy, Inflation, Global Spillovers).
  - Historical volatility multiplier: $IV_{\text{event}} = IV_{\text{base}} \times \sqrt{1 + k \cdot \sigma_{\text{shock}}}$.
  - Beta-weighted portfolio shock sensitivity: $\Delta P = \sum \beta_i w_i \Delta S_{\text{shock}}$.

#### User Story 2: Corporate Earnings Surprises & IV Crush Dynamics (`TC-EVT-02`)
- **Story:** *As an Options & Derivatives Trader*, I want automated tracking of NSE quarterly earnings releases with Bayesian consensus vs actual surprises, implied move straddle pricing, and post-event IV crush predictions.
- **Acceptance Criteria:**
  - Standardized earnings surprise metric: $Z_{\text{surprise}} = \frac{EPS_{\text{actual}} - EPS_{\text{est}}}{\sigma_{\text{est}}}$.
  - Pre-earnings implied move calculated from ATM straddles: $\text{Move}_{\text{implied}} \approx 0.8 \times (C_{\text{ATM}} + P_{\text{ATM}})$.
  - Post-earnings IV crush model forecasting post-announcement implied volatility deflation.

#### User Story 3: Interactive Macro Event & Sentiment Risk Radar Modal (`TC-EVT-03`, `TC-EVT-04`)
- **Story:** *As an Active Trader*, I want an interactive Macro Event & Sentiment Risk Radar Modal featuring an event calendar timeline, volatility jump cones, sentiment polarity meter, and 1-click protective delta/vega hedging triggers.
- **Acceptance Criteria:**
  - Chronological event timeline with impact badges (Critical, High, Moderate).
  - Volatility jump cone visualizer illustrating expected price dispersion windows.
  - Live sentiment score indicator bounded between $[-1.0, +1.0]$.
  - 1-click hedging suggestions linking into `TradingContext.tsx`.

#### User Story 4: Automated Verification & Unit Test Suite (`TC-EVT-05`)
- **Story:** *As a QA Lead*, I want automated unit tests validating shock multipliers, earnings surprise z-scores, IV expansion math, and portfolio event beta aggregation.
- **Acceptance Criteria:**
  - 100% test pass rate in `test/macroEventEngine.test.mjs`.
  - Zero TypeScript compilation errors (`npx tsc --noEmit`).

---

## Completed Sprints Archive

### Sprint 17: High-Frequency VWAP / TWAP Execution Algorithms & Microstructure Slippage Minimizer (Almgren-Chriss Optimal Liquidation Model)
- [x] **TC-EXE-01**: Author comprehensive BRD-017 specifying continuous volume-weighted average price (VWAP) trajectories, time-weighted average price (TWAP) schedules, Almgren-Chriss optimal liquidation trajectories, and Perold Implementation Shortfall attribution (`docs/brds/BRD-017-vwap-twap-execution-almgren-chriss-slippage-minimizer.md`).
- [x] **TC-EXE-02**: Execution Engine: Almgren-Chriss optimal liquidation solver ($x_j = \frac{\sinh(\kappa(T - t_j))}{\sinh(\kappa T)} X$), empirical Indian NSE U-shaped intraday volume profile (9:15-10:00 AM rush, midday lull, 2:30-3:30 PM closing surge), TWAP uniform slices, temporary & permanent market impact simulation, and Perold Implementation Shortfall decomposition (`src/lib/executionEngine.ts`, `src/types/execution.ts`).
- [x] **TC-EXE-03**: Interactive Algorithmic Execution Studio Modal: Slice-by-slice execution timeline with slippage color coding, risk aversion $\lambda$ log-slider, IS attribution breakdown bars, and 3-way algorithm comparison arena (`src/components/ExecutionAlgoModal.tsx`).
- [x] **TC-EXE-04**: Header navigation ("⏱️ VWAP/TWAP"), modal integration in terminal workspace, and Landing Page Feature Card 15 (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-EXE-05**: Automated unit test suite verifying boundary conditions, risk-aversion monotonicity, volume profile normalization, and TWAP/VWAP quantity conservation (`test/executionEngine.test.mjs`). 92/92 tests passing.

#### Sprint 17 User Stories & Acceptance Criteria

##### User Story 1: Almgren-Chriss Optimal Liquidation Solver (`TC-EXE-01`, `TC-EXE-02`)
- **Story:** *As an Institutional Quant*, I want optimal liquidation schedules calculated using the Almgren-Chriss model balancing market impact against timing risk with decay rate $\kappa = \sqrt{\frac{\lambda \sigma^2}{\eta}}$, so that large institutional parent orders minimize total expected execution cost.
- **Acceptance Criteria:**
  - Analytical trajectory solver: $x_j = \frac{\sinh(\kappa(T - t_j))}{\sinh(\kappa T)} X$.
  - Boundary limits: $x_0 = X$ and $x_N = 0$.
  - Monotonicity: Higher risk aversion $\lambda$ produces faster initial liquidation (front-loaded schedule).
  - Quantity conservation: $\sum_{j=1}^N \Delta x_j = X$.

##### User Story 2: Empirical NSE Volume Profile & Execution Benchmarks (`TC-EXE-02`)
- **Story:** *As an Algorithmic Trader*, I want intraday child orders scheduled against the Indian NSE U-shaped volume curve (morning open rush 9:15–10:00, midday consolidation 11:30–13:30, closing auction ramp 14:30–15:30) for continuous VWAP and uniform TWAP execution.
- **Acceptance Criteria:**
  - Discrete 13-bucket normalized intraday profile ($\sum v_j = 1.0$).
  - VWAP slice sizing proportional to interval volume expectation: $x_{j,\text{VWAP}} = X \cdot v_j$.
  - TWAP uniform interval slicing: $x_{j,\text{TWAP}} = X / N$.
  - Dynamic slippage simulation incorporating permanent impact ($\gamma \cdot x_j$) and temporary impact ($\eta \cdot (x_j / \tau)$).

##### User Story 3: Interactive Algorithmic Execution Studio Modal (`TC-EXE-03`, `TC-EXE-04`)
- **Story:** *As a Platform Trader*, I want an Algorithmic Execution Studio Modal displaying slice-by-slice progress, slippage heatmaps, Perold Implementation Shortfall decomposition (Delay, Impact, Fee), and 3-way algorithm comparison arena.
- **Acceptance Criteria:**
  - Visual timeline of scheduled vs filled child slices.
  - Interactive risk aversion $\lambda$ slider updating Almgren-Chriss curvature in real-time.
  - Perold Implementation Shortfall metric cards ($IS = \text{Actual Execution Cost} - \text{Paper Benchmark Cost}$).
  - Integrated into terminal header ("⏱️ VWAP/TWAP") and Landing Page showcase.

##### User Story 4: Automated Verification & Unit Test Suite (`TC-EXE-05`)
- **Story:** *As a QA Lead*, I want automated tests validating Almgren-Chriss math, volume profile integrals, TWAP/VWAP conservation, and implementation shortfall attribution.
- **Acceptance Criteria:**
  - 100% test pass rate across `test/executionEngine.test.mjs` (7 test suites, 14 assertions).
  - Zero TypeScript compilation errors (`npx tsc --noEmit`).

---

### Sprint 16: Multi-Asset Statistical Arbitrage & Cointegration Pairs Trading Engine (Engle-Granger & Kalman Filter)
- [x] **TC-ARB-01**: Author comprehensive BRD-016 specifying Engle-Granger 2-step cointegration, Augmented Dickey-Fuller (ADF) stationarity critical values, Ornstein-Uhlenbeck half-life formula, and state-space Kalman filter equations (`docs/brds/BRD-016-statistical-arbitrage-cointegration-pairs-trading.md`).
- [x] **TC-ARB-02**: StatArb Engine: OLS & Kalman filter dynamic hedge ratio solvers ($\beta_t$), rolling z-score spread generator ($z = (S_1 - \beta_t S_2 - \alpha) / \sigma$), preloaded Indian equity baskets (NIFTY/BANKNIFTY, HDFCBANK/ICICIBANK, TCS/INFY), and pre-trade SEBI statutory hurdle calculator (`src/lib/statArbEngine.ts`, `src/types/statArb.ts`).
- [x] **TC-ARB-03**: Interactive Pairs Trading Studio Modal: 2D spread z-score chart with Bollinger bands and trigger lines, Kalman vs OLS hedge ratio comparison, and live signal radar (`src/components/StatArbModal.tsx`).
- [x] **TC-ARB-04**: Header navigation ("⚖️ Pairs Arb"), 2-leg simultaneous market-neutral execution into portfolio positions, and Landing Page feature card (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-ARB-05**: Automated unit test suite verifying OLS regression, ADF stationarity rejection on stationary residuals vs random walk, Ornstein-Uhlenbeck half-life positivity, Kalman convergence, and statutory tax hurdles (`test/statArbEngine.test.mjs`). 85/85 tests passing.

### Sprint 16 User Stories & Acceptance Criteria

#### User Story 1: Cointegration Regression & Hedge Ratio Modeling (`TC-ARB-01`, `TC-ARB-02`)
- **Story:** *As a Quantitative Statistical Arbitrageur*, I want the platform to evaluate pair cointegration via Engle-Granger two-step tests, Augmented Dickey-Fuller (ADF) unit root tests on spread residuals, and dynamic Kalman filter tracking of the time-varying hedge ratio ($\beta_t$), so that I can trade stationary mean-reverting spreads with high statistical confidence.
- **Acceptance Criteria:**
  - Calculate OLS and Kalman filter dynamic hedge ratios: $y_t = \alpha + \beta_t x_t + \epsilon_t$.
  - Perform ADF stationarity test: $t_{\text{stat}} < t_{\text{crit}}(95\%) \approx -2.86 \implies \text{Stationary}$.
  - Compute Ornstein-Uhlenbeck mean-reversion speed ($\theta$) and half-life: $t_{1/2} = \frac{\ln(2)}{\theta}$.
  - Standardize rolling spread into a dynamic z-score: $z_t = \frac{\epsilon_t - \mu_{\epsilon}}{\sigma_{\epsilon}}$.

#### User Story 2: Pairs Trading Baskets & Arbitrage Signals (`TC-ARB-02`, `TC-ARB-03`)
- **Story:** *As a Market Neutral Trader*, I want automated signal generation on high-correlation Indian pairs (NIFTY/BANKNIFTY, HDFCBANK/ICICIBANK, TCS/INFY, RELIANCE/ONGC) with Bollinger z-score entry ($\pm 2.0\sigma$) and exit ($\pm 0.5\sigma$ or $0.0\sigma$) bounds, strictly factoring in Indian statutory tax friction.
- **Acceptance Criteria:**
  - Ingest historical tick pairs and compute real-time spread z-scores.
  - Generate Long Pair (Long A, Short B) and Short Pair (Short A, Long B) recommendations.
  - Calculate round-trip Indian statutory taxes on both legs via `taxEngine.ts` to ensure edge exceeds friction.

#### User Story 3: Interactive Pairs Studio & Residual Diagnostics Modal (`TC-ARB-03`, `TC-ARB-04`)
- **Story:** *As a Trader*, I want an interactive Pairs Trading Studio displaying continuous 2D z-score spread charts, correlation heatmaps, residual distribution Q-Q plots, and 1-click execution into the paper trading portfolio.
- **Acceptance Criteria:**
  - 2D time-series chart of spread z-score with trigger bands ($\pm 2.0\sigma$, stop-loss $\pm 3.5\sigma$).
  - Pair Correlation & Cointegration metrics card (ADF test statistic, p-value, half-life in bars).
  - 1-click simultaneous 2-leg synthetic market execution into `TradingContext.tsx`.

#### User Story 4: Automated Verification & Unit Test Suite (`TC-ARB-05`)
- **Story:** *As a QA Lead*, I want automated unit tests validating ADF stationarity math, Kalman filter convergence, half-life calculation, and fee friction checks.
- **Acceptance Criteria:**
  - 100% test pass rate in `test/statArbEngine.test.mjs`.
  - Zero TypeScript compilation errors (`npx tsc --noEmit`).
  - Clean production build (`npm run build`).

---

### Sprint 15: Level-3 Order Book Analytics, Iceberg Detector & Institutional Dark Pool Volume Tracker
- [x] **TC-OB3-01**: Author comprehensive BRD-015 specifying Level-3 Order-by-Order (OBO) queuing dynamics, Iceberg replenishment detection heuristics, and Dark Pool block trade impact models (`docs/brds/BRD-015-level3-order-book-iceberg-detector-dark-pool-tracker.md`).
- [x] **TC-OB3-02**: Level-3 Microstructure Engine: Queue position tracker (FIFO queue-ahead calculation), hidden Iceberg order replenishment detector, Volume-Weighted Micro-Price (P_micro), OBI, VPIN toxicity, and institutional Dark Pool block trade aggregator (`src/lib/microstructureEngine.ts`, `src/lib/orderBookL3Engine.ts`, `src/types/microstructure.ts`).
- [x] **TC-OB3-03**: Interactive Level-3 Depth & Iceberg Radar Modal: Granular tick-by-tick order queue ladder, live Iceberg order alert stream, institutional block tape, and queue-wait visualizer (`src/components/MicrostructureModal.tsx`, `src/components/OrderBookL3Modal.tsx`).
- [x] **TC-OB3-04**: Header navigation ("🌊 L3 & Dark Pool"), real-time terminal synchronization, and 1-click iceberg liquidity join execution (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-OB3-05**: Automated unit test suite verifying order queue FIFO positioning, replenishment anomaly detection, VPIN toxicity bounds, and dark pool VWAP volume math (`test/microstructureEngine.test.mjs`, `test/orderBookL3Engine.test.mjs`). 78/78 tests passing.

### Sprint 14: Multi-Leg Options Strategy Payoff Optimizer & Implied Volatility Surface Calibrator (SABR / SVI Models)
- [x] **TC-SBR-01**: Author comprehensive BRD-014 specifying SABR ($\alpha, \beta, \rho, \nu$) and SVI parametric smile models, butterfly/calendar arbitrage constraints, and multi-leg genetic payoff optimizer (`docs/brds/BRD-014-options-payoff-optimizer-volatility-surface-calibrator.md`).
- [x] **TC-SBR-02**: IV Surface Engine: Non-linear calibration of SABR & Raw SVI models across NSE strike grids, Dupire local volatility extraction, and multi-leg combinatorial payoff optimizer (`src/lib/volatilitySurfaceEngine.ts`, `src/types/optionsOptimizer.ts`).
- [x] **TC-SBR-03**: Interactive IV Surface & Payoff Optimizer Modal: 3D/2D volatility smile visualizer, term structure curves, arbitrage violation flags, and target risk-reward strategy generator (`src/components/VolatilityOptimizerModal.tsx`).
- [x] **TC-SBR-04**: Header navigation ("⚡ IV Surface"), option chain data binding, 1-click optimized strategy execution into terminal positions (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-SBR-05**: Automated unit test suite verifying SABR formula accuracy, SVI arbitrage-free constraints, ATM volatility consistency, and payoff optimization bounds (`test/volatilityOptimizerEngine.test.mjs`, `test/volatilitySurfaceEngine.test.mjs`). 68/68 tests passing.

### Sprint 13: Real-Time Options Greeks Hedger & Dynamic Delta-Gamma Neutral Autobalancer
- [x] **TC-HDG-01**: Author comprehensive BRD-013 specifying analytical Greek hedging math, Delta neutral bounds ($\Delta_{\text{net}} \approx 0$), Gamma curvature protection, and auto-rebalancing thresholds (`docs/brds/BRD-013-options-greeks-hedger-delta-gamma-neutral-autobalancer.md`).
- [x] **TC-HDG-02**: Greeks Hedging Engine: Aggregate portfolio Delta ($\Delta$), Gamma ($\Gamma$), Vega ($\nu$), Theta ($\Theta$), auto-hedge order solver for ATM/OTM options or futures (`src/lib/greeksHedgerEngine.ts`, `src/types/greeksHedger.ts`).
- [x] **TC-HDG-03**: Interactive Greeks Hedging Studio Modal: Real-time Greeks risk radar, 2D curvature payoff visualizer, 1-click "Neutralize Delta" solver, and autobalancer daemon controls (`src/components/GreeksHedgerModal.tsx`).
- [x] **TC-HDG-04**: Header navigation ("🛡️ Delta Hedger"), auto-hedging daemon interval, and terminal options chain synchronization (`src/components/Header.tsx`, `src/app/page.tsx`, `src/components/LandingPage.tsx`).
- [x] **TC-HDG-05**: Automated unit test suite verifying portfolio Greek aggregation, zero-delta solver accuracy, lot size rounding, Taylor curvature shocks, and autobalance trigger bounds (`test/greeksHedgerEngine.test.mjs`). 55/55 tests passing.

### Sprint 12: Institutional Trade Copier & Cross-Account Multi-Broker Execution Bridge
- [x] **TC-COP-01**: Author comprehensive BRD-012 specifying master/slave copier ratios, lot size rounding, latency models, and multi-broker API payload adapters (`docs/brds/BRD-012-institutional-trade-copier-cross-account-multi-broker-bridge.md`).
- [x] **TC-COP-02**: Multi-Broker Bridge Engine: Master-to-slave account mirroring, Equity-Proportional / Fixed Multiplier / Risk Parity sizing, broker latency distribution ($\mu, \sigma$ for Zerodha, Groww, Upstox), adverse slippage, and Slippage Guard filter (`src/lib/tradeCopierEngine.ts`, `src/types/tradeCopier.ts`).
- [x] **TC-COP-03**: Interactive Trade Copier Modal: Slave accounts matrix, live sync toggle, risk multiplier sliders (0.1x to 3.0x), broadcast order simulator, live latency/slippage audit stream, and Emergency Global Kill Switch (`src/components/TradeCopierModal.tsx`).
- [x] **TC-COP-04**: Header navigation ("🔗 Trade Copier"), Landing Page feature card, terminal synchronization, and multi-account state persistence (`src/components/Header.tsx`, `src/components/LandingPage.tsx`, `src/app/page.tsx`).
- [x] **TC-COP-05**: Automated unit test suite verifying proportional sizing math, Indian exchange lot size rounding (NIFTY 25, BANKNIFTY 15), margin haircuts, broker latency profiles, slippage guard breaches, and emergency liquidation (`test/tradeCopierEngine.test.mjs`). 48/48 tests passing.

### Sprint 11: Autonomous AI Quant Desk & Multi-Agent Virtual Hedge Fund War Room
- [x] **TC-QNT-01**: Author comprehensive BRD-011 specifying 4-phase debate protocol, consensus schemas, and risk audit rules (`docs/brds/BRD-011-autonomous-ai-quant-desk-multi-agent-virtual-hedge-fund.md`).
- [x] **TC-QNT-02**: Multi-Agent Quant Engine: 4 autonomous personas (Dr. Vance Macro, Vikram Alpha Hunter, Elena CRO, Kavita Algorist), VaR limits, Almgren-Chriss DOM impact, and mathematical consensus calculator (`src/lib/quantDeskEngine.ts`, `src/types/quantDesk.ts`).
- [x] **TC-QNT-03**: Interactive AI Quant Desk War Room Modal: Agent podiums, live 4-round debate stream, consensus verdict banner, approved sizing gauges, and 1-click execution (`src/components/QuantWarRoomModal.tsx`).
- [x] **TC-QNT-04**: Header navigation ("🤖 Quant Desk"), Landing Page feature card, terminal synchronization, and 1-click paper trading order placement (`src/components/Header.tsx`, `src/components/LandingPage.tsx`, `src/app/page.tsx`).
- [x] **TC-QNT-05**: Automated unit test suite verifying macro scoring, CRO 6% drawdown veto, counter-trend veto, 99% VaR haircut, and DOM routing logic (`test/quantDeskEngine.test.mjs`). 42/42 tests passing.

### Sprint 10: Social Paper Trading Leagues, Public Leaderboards & Cryptographically Verifiable Proof-of-Alpha Trade Receipts
- [x] **TC-LGE-01**: Native Cryptographic Proof Engine: SHA-256 tradebook hash chain ($H_i$), Platform Execution Oracle with ECDSA/HMAC digital signature, Merkle root tree aggregation, and tamper-detection validator (`src/lib/proofEngine.ts`).
- [x] **TC-LGE-02**: Social Leagues & Alpha Ranking Engine: Active tournament catalog, anti-gambling risk rules (Max Drawdown Circuit Breaker $\text{Pen}_{\text{DD}}$, Position Concentration $\text{Pen}_{\text{conc}}$), and composite TradeCraft Alpha Score ($\alpha_{\text{score}}$) incorporating Sortino, Net P&L after Indian taxes, and PQ score (`src/lib/leagueEngine.ts`).
- [x] **TC-LGE-03**: Interactive Social Leagues & Leaderboard Modal: Active tournaments browser (Nifty Weekly Cup, Intraday Alpha Sprint, Options Greeks Master, Rookie Sandbox), multi-factor ranking matrix, disqualification indicators, and 1-click user tournament registration (`src/components/LeagueLeaderboardModal.tsx`).
- [x] **TC-LGE-04**: Verifiable Proof-of-Alpha Certificate & Public Verifier Modal: Stylized cryptographic attestation certificate with security seal, Merkle snapshot, interactive tamper fraud attack simulator, JSON proof receipt exporter, and public verification sandbox (`src/components/ProofOfAlphaModal.tsx`).
- [x] **TC-LGE-05**: Header navigation button ("🏆 Leagues & PoA"), Landing page feature cards, relative path resolution, and terminal tournament state synchronization (`src/components/Header.tsx`, `src/components/LandingPage.tsx`, `src/app/page.tsx`).
- [x] **TC-LGE-06**: Automated unit tests for SHA-256 chain immutability, Merkle tree root determinism, anti-tamper fraud detection, Alpha Score monotonicity, and drawdown disqualifications (`test/leagueEngine.test.mjs`, `test/tradingEngine.test.mjs`). 37/37 tests passing.

### Sprint 9: User Account Management, Multi-Persona Authentication & Creative Landing Page
- [x] **TC-USR-01**: User Account model, salted password hashing, per-user state keys, and 3 preloaded demo accounts (`src/lib/authService.ts`, `src/types/user.ts`).
- [x] **TC-USR-02**: Authentication Modal: Sign In, Sign Up, Forgot Password token flow, 1-click demo logins (`src/components/AuthModal.tsx`).
- [x] **TC-USR-03**: User Profile Modal: Profile overview, stats, edit persona, change password, account switcher, logout (`src/components/UserProfileModal.tsx`).
- [x] **TC-USR-04**: Creative, informative Landing Page: Hero, live marquee, comparison table, 8-feature grid, demo persona launchers, FAQ (`src/components/LandingPage.tsx`).
- [x] **TC-USR-05**: Header profile pill, view switching, per-user portfolio isolation, and automated unit tests (`test/authEngine.test.mjs`).

### Sprint 8: Real-Time Multi-Factor Technical Screener & Stock Scanner
- [x] **TC-SCR-01**: Multi-factor scanner engine: Volume Surge, EMA Cross, RSI, VWAP, ORB & Confluence Score (`src/lib/screenerEngine.ts`).
- [x] **TC-SCR-02**: Stock Screener Modal with presets, Confluence Score ranking, 1-click Chart Sync, AI Scanner Brief (`src/components/StockScreenerModal.tsx`).
- [x] **TC-SCR-03**: Header navigation button & terminal synchronization (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-SCR-04**: Automated unit tests for screener algorithms and confluence score calculation (`test/screenerEngine.test.mjs`).

### Sprint 7: Broker Tradebook Importer & AI Behavioral Post-Mortem Auditor
- [x] **TC-IMP-01**: Tradebook CSV parser for Zerodha & Groww + FIFO trade matcher + sample datasets (`src/lib/tradebookEngine.ts`).
- [x] **TC-IMP-02**: Behavioral bias scoring engine: Disposition Effect, Revenge Trading Index, Fee Erosion, Martingale Score.
- [x] **TC-IMP-03**: Tradebook Importer Modal with drag-and-drop CSV upload, bias metrics, trade list, sample loaders, AI Post-Mortem (`src/components/TradebookImportModal.tsx`).
- [x] **TC-IMP-04**: Header navigation link, terminal state integration, and automated unit tests (`test/tradebookEngine.test.mjs`).

### Sprint 6: Real-Time Market Breadth, FII/DII Institutional Flows & Indian Sectoral Heatmap
- [x] **TC-BRD-01**: Breadth Engine, FII/DII Net Flow & Sectoral Model (`src/lib/breadthEngine.ts`).
- [x] **TC-BRD-02**: Market Breadth Modal with Advance/Decline Gauge, FII/DII Tracker, and 7-sector heatmap (`src/components/MarketBreadthModal.tsx`).
- [x] **TC-BRD-03**: Header Navigation & Terminal data binding (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-BRD-04**: Automated unit tests for A/D Ratio, Institutional Net Flow, and Sectoral Math (`test/breadthEngine.test.mjs`).

### Sprint 5: Trader Performance Analytics, Hourly Heatmaps & Monte Carlo Simulator
- [x] **TC-QNT-01**: Closed-form Kelly Criterion position sizing calculation, 1,000-trial Monte Carlo ruin simulation, and Indian market time-of-day aggregation (`src/lib/analyticsEngine.ts`).
- [x] **TC-QNT-02**: Quantitative Analytics Modal with interactive Hourly P&L Heatmap (9 AM–3:30 PM), Day-of-week expiry table, and SVG Monte Carlo envelope (`src/components/QuantitativeAnalyticsModal.tsx`).
- [x] **TC-QNT-03**: Quant Analytics navigation button in Header and full terminal synchronization (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-QNT-04**: Automated unit tests for positive/negative edge Kelly sizing and Monte Carlo percentile envelope monotonicity (`test/analyticsEngine.test.mjs`).

### Sprint 4: Bar Replay & Level-2 Market Depth (DOM Order Book Ladder)
- [x] **TC-DOM-01**: Playhead buffer slicing, variable speed timing (1x to 10x), and stochastic Level-2 DOM generation (`src/lib/replayEngine.ts`).
- [x] **TC-DOM-02**: Floating Replay Toolbar with Play/Pause, 1-bar step forward, timeline scrubber, and speed controls (`src/components/ReplayControlBar.tsx`).
- [x] **TC-DOM-03**: Institutional Level-2 DOM Ladder with Top 5 Bids/Asks, visual volume depth bars, and real-time Imbalance gauge (`src/components/DepthOfMarketLadder.tsx`).
- [x] **TC-DOM-04**: Synchronized execution: click any ladder price rung to instantaneously route limit orders with Indian statutory taxes.
- [x] **TC-DOM-05**: Automated unit tests for candle slicing bounds, order book rung monotonicity, spread positivity, and imbalance math (`test/replayEngine.test.mjs`).

### Sprint 3: TradingView Webhook Gateway & Automated Algorithmic Trading
- [x] **TC-WH-01**: Webhook Bot Engine, token validation, Circuit Breaker drawdown protection, and PineScript v5 template generator (`src/lib/webhookEngine.ts`).
- [x] **TC-WH-02**: Next.js 15 App Router dynamic Route Handler (`POST /api/webhook`, `GET /api/webhook`) with Indian statutory tax integration (`src/app/api/webhook/route.ts`).
- [x] **TC-WH-03**: Interactive Webhook Bot Manager modal with real-time in-browser simulation playground and live audit log stream (`src/components/WebhookManagerModal.tsx`).
- [x] **TC-WH-04**: Direct navigation button in Header and real-time execution linking into portfolio positions (`src/components/Header.tsx`, `src/app/page.tsx`).
- [x] **TC-WH-05**: Automated unit tests for valid/invalid payloads, token rejection, and circuit breaker tripping (`test/webhookEngine.test.mjs`).

### Sprint 2: Options & Derivatives Sandbox (F&O Engine)
- [x] **TC-OPT-01**: Analytical Black-Scholes formula, standard normal CDF, and option Greeks ($\Delta$, $\Gamma$, $\Theta$, $\text{Vega}$) (`src/lib/optionsEngine.ts`).
- [x] **TC-OPT-02**: Dynamic Option Chain generator with strike grids, IV smile, and Open Interest (OI) metrics (`src/components/OptionChainModal.tsx`).
- [x] **TC-OPT-03**: Multi-Leg Strategy Payoff Calculator with Max Profit, Max Loss, Breakevens, and Options STT taxes (`src/components/StrategyPayoffModal.tsx`).
- [x] **TC-OPT-04**: Interactive Option Chain modal with Call/Put matrices, ATM badges, and quick leg add.
- [x] **TC-OPT-05**: Strategy Payoff Visualizer with institutional templates (Bull Call, Iron Condor, Straddle) & AI Options Architect.
- [x] **TC-OPT-06**: Automated unit tests for Black-Scholes pricing, put-call parity delta, and multi-leg spreads (`test/optionsEngine.test.mjs`).

### Sprint 1: Foundation, Trading Engine, Indian Statutory Fees & BYOK
- [x] **TC-INIT**: Scaffold Next.js application workspace with required UI, icons, and charting dependencies.
- [x] **TC-FEE-01**: Build Indian Statutory Tax & Fee calculation module with exact SEBI/NSE formulas (`src/lib/taxEngine.ts`).
- [x] **TC-ENG-02**: Build Paper Trading Order Matching Engine, margin manager, and portfolio state store (`src/context/TradingContext.tsx`).
- [x] **TC-MKT-03**: Create real-time market data feed & historical OHLCV generator for NSE Top Equities (`src/lib/mockMarketData.ts`).
- [x] **TC-CHT-04**: Build TradingView Lightweight Charting component with candle styling and volume histogram (`src/components/CandlestickChart.tsx`).
- [x] **TC-ORD-05**: Build Trade Ticket with pre-trade statutory breakdown, quantity calculator, and SL/Target (`src/components/OrderForm.tsx`).
- [x] **TC-PTF-06**: Build interactive Holdings, Positions, Orders, and P&L Analytics views (`src/components/PositionsTable.tsx`).
- [x] **TC-BYOK-07**: Build BYOK Modal with live key testing for Google Gemini (`gemini-2.5-flash`), OpenAI, Ollama (`src/components/BYOKModal.tsx`).
- [x] **TC-COACH-08**: Build AI Trade Coach, Behavioral Auditor (Revenge trading, FOMO), and Discipline (PQ) meter (`src/components/AICoachPanel.tsx`).
- [x] **TC-STRAT-09**: Build Natural Language Strategy Builder, Backtester with equity curves, and Python exporter (`src/components/StrategyBuilderModal.tsx`).
- [x] **TC-CRISIS-10**: Build Historical Scenario Crisis Replay mode (`src/components/HistoricalCrisisModal.tsx`).
- [x] **TC-QA-11**: Implement automated unit tests validating tax calculations, order states, and margin safety (`test/taxEngine.test.mjs`).
