# Business Requirements Document (BRD) - Sprint 25

## Feature ID: `BRD-025`
## Feature Title: Real-Time Order Flow Toxicity & Volume-Synchronized Probability of Toxicity (VPIN) & Informed Trading Microstructure Engine (Easley-López de Prado-O'Hara VPIN, Kyle's Lambda, Glosten-Milgrom Spread Decomposition & Flash Crash Early-Warning Radar)
**Author:** Researcher Lead (Autonomous Multi-Agent Cycle)  
**Date:** 2026-11-18  
**Status:** `COMPLETED & VERIFIED`  
**Target Milestone:** Sprint 25  
**Dependencies:**
- Sprint 1 (`taxEngine.ts` — Indian Statutory Taxes, STT, Transaction Charges)
- Sprint 4 (`marketDepthEngine.ts` — Tick-by-Tick Bar Replay & DOM Order Depth)
- Sprint 15 (`level3Engine.ts` — Real-Time L3 Order Book, Iceberg Detector & Dark Pool Flow Tracker)
- Sprint 17 (`executionAlgoEngine.ts` — VWAP/TWAP Execution & Almgren-Chriss Slippage Minimizer)
- Sprint 19 (`sorEngine.ts` — Cross-Exchange Arbitrage & Latency-Aware Smart Order Router)
- Sprint 20 (`fixProtocolEngine.ts` — Real-Time FIX Protocol Gateway & Drop-Copy Simulator)
- Sprint 22 (`riskEngine.ts` — High-Frequency Pre-Trade Risk Engine, Circuit Breakers & SPAN Margin)
- Sprint 24 (`gammaSqueezeEngine.ts` — Real-Time Options Gamma Squeeze & 0-DTE Expiry Pinning Risk Engine)

---

### 1. Executive Summary & Problem Statement

#### 1.1 Context: Microstructure Asymmetry in Indian High-Frequency Markets
The Indian equity and derivatives market ecosystem across the **National Stock Exchange (NSE)** and **Bombay Stock Exchange (BSE)** has emerged as one of the world's most hyper-liquid, automated, and concentrated financial venues. With daily index options turnover regularly exceeding **₹400 Lakh Crores notional** and algorithmic high-frequency trading (HFT) accounting for greater than **60% of total cash equity and equity derivatives turnover**, market makers and automated liquidity providers operate under extreme competitive pressure.

In modern electronic limit order books (LOBs), liquidity provision is not a passive, risk-free game of earning the bid-ask spread. Liquidity providers (LPs) face continuous **Adverse Selection Risk**: the catastrophic risk of quoting passive limit orders against "informed" counterparties who possess private information, algorithmic latency advantages (co-located ultra-low latency FPGA feeds), structural flow knowledge (e.g., predatory algorithmic momentum traders), or large institutional child orders executing via algorithmic execution desks.

When informed traders initiate aggressive trades against resting passive quotes, the market maker incurs immediate adverse inventory drift. By the time the market maker can re-hedge or close their position, the market has moved permanently against them. When order flow toxicity spikes, market makers suffer rapid capital depletion, leading to abrupt quote cancellations, liquidity black holes, severe bid-ask spread widening, and in extreme cases, catastrophic market dislocations known as **Flash Crashes** (such as the May 6, 2010 Flash Crash or the Indian October 5, 2012 NSE circuit crash).

#### 1.2 Problem Statement
Retail traders, systematic retail algorithmic bots, prop desk traders, and risk officers on standard web and mobile platforms operate with severe microstructure blindness:

1. **Failure of Chronological (Time-Clock) Metrics:**
   Traditional technical indicators, simple volume bars, and time-based volatility models (e.g., standard Bollinger Bands, 1-minute ATR) sample the market at arbitrary uniform time intervals (e.g., 1 minute, 5 minutes). In high-frequency electronic markets, trading activity does not proceed uniformly in chronological time; hundreds of trades occur within milliseconds during news releases, while minutes may elapse with zero activity during mid-day doldrums. Time-clock metrics fail to capture the rate of information arrival, obscuring toxic clusters of informed trading until massive slippage has already occurred.
2. **Inadequacy of Traditional Tick Classification Rules:**
   Conventional order flow tools rely on simple tick rules (Lee-Ready algorithm), which compare transaction prices to previous prices or quote midpoints. In ultra-fast Indian markets characterized by rapid quote flickering, cancelled orders, and sub-millisecond price movements, the Lee-Ready tick rule suffers from severe misclassification bias (up to 30-40% errors) due to clock desynchronization between trades and depth updates.
3. **Inability to Quantify Flow Toxicity in Real Time (The VPIN Blindness):**
   Traders lack a mathematically sound, real-time estimator of **Volume-Synchronized Probability of Toxicity (VPIN)** (pioneered by Maureen O'Hara, David Easley, and Marcos López de Prado). Without VPIN, automated market makers and retail algorithmic execution algorithms cannot anticipate impending liquidity evaporations and are repeatedly "run over" by toxic institutional sweeps.
4. **Ignorance of Kyle's Lambda & Price Impact Elasticity:**
   Execution algos (such as VWAP/TWAP and Almgren-Chriss liquidators) execute orders without continuously estimating the asset's instantaneous **Kyle's Lambda ($\lambda$)**—the exact price impact coefficient per unit of executed order flow. Underestimating $\lambda$ causes excessive market impact, eating away all execution alpha.
5. **Lack of Microstructure Bid-Ask Spread Decomposition:**
   Traders view the bid-ask spread as a monolithic cost. They fail to decompose the quoted spread into its three constitutive microstructural components (Glosten-Milgrom and Roll models):
   - **Adverse Selection Cost ($\theta$):** Compensation required for trading against informed order flow.
   - **Inventory Holding Cost ($\phi$):** Compensation for holding unhedged directional exposure overnight or through intraday volatility.
   - **Order Processing / Exchange Cost ($\gamma$):** Fixed infrastructure, brokerage, clearing fees, and exchange costs.
   Without spread decomposition, liquidity providers cannot determine whether a wide spread represents rich market-making margin or an imminent toxic trap.
6. **Lack of Browser-Native Flash Crash Early Warning Radar:**
   Existing institutional risk analytics tools capable of computing VPIN and market impact are confined to proprietary C++ institutional software suites costing upwards of $50,000/year. There exists no browser-native, zero-server BYOK (Bring Your Own Keys) platform capable of ingesting raw L2/L3 WebSocket tick feeds and computing real-time volume-clocked VPIN, Kyle's Lambda, spread decomposition, and defensive widening thresholds entirely client-side.

#### 1.3 Solution & Business Objectives
TradeCraft AI Sprint 25 delivers an institutional-grade, client-side, browser-native **Real-Time Order Flow Toxicity & VPIN Informed Trading Microstructure Engine**:

* **Volume-Clock Binning Engine:** Transforms raw tick streams from chronological time ($t$) into physical information time ($\tau$) by partitioning trades into constant volume buckets of size $V$, completely immunizing toxicity analysis from intraday seasonality (e.g., U-shaped opening/closing volume curves).
* **Bulk Volume Classification (BVC) Engine:** Implements the Easley-López de Prado-O'Hara Bulk Volume Classification model, splitting bucket volume into buyer-initiated ($V_\tau^B$) and seller-initiated ($V_\tau^S$) volume using the standard normal cumulative distribution function (CDF) of standardized price returns: $V_\tau^B = V \cdot \Phi(\Delta P / \sigma_{\Delta P})$.
* **Real-Time VPIN Calculator:** Computes rolling $N$-bucket Volume-Synchronized Probability of Toxicity:
  $$\text{VPIN} = \frac{\sum_{\tau=1}^N |V_\tau^B - V_\tau^S|}{N \cdot V}$$
  coupled with a non-parametric empirical CDF lookup to output instantaneous toxicity percentiles ($CDF(\text{VPIN})$) and real-time regime classifications (`NORMAL` < 0.25, `ELEVATED` 0.25–0.45, `TOXIC` > 0.45).
* **Dynamic Kyle's Lambda ($\lambda$) Estimator:** Continuous rolling covariance-to-variance linear regression estimator quantifying market depth elasticity and adverse price impact per lot/contract: $\lambda = \frac{\text{Cov}(\Delta P, Q)}{\text{Var}(Q)}$.
* **Glosten-Milgrom & Roll Spread Decomposer:** Real-time decomposition of quoted bid-ask spread into Adverse Selection fraction ($\alpha_{AS}$), Inventory Risk fraction ($\alpha_{INV}$), and Order Processing fraction ($\alpha_{OP}$).
* **Market Maker Defensive Quote Widening & Circuit Freeze Radar:** Automated algorithmic recommendation engine computing the dynamic widening multiplier $\Omega_{\text{def}} = 1 + \kappa \cdot (\text{VPIN})^\gamma$ and predicting imminent liquidity freeze / circuit triggers before order books collapse.
* **Microstructure Toxicity & Flash Crash Cockpit UI:** Dark-mode institutional terminal featuring real-time VPIN needle gauge, historical toxicity percentile heatmaps, volume-bucket order imbalance bars, Kyle's Lambda scatter plots, and spread decomposition stacked bars.

---

### 2. Market Microstructure & Regulatory Framework (NSE/BSE)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│              INDIAN ELECTRONIC LIMIT ORDER BOOK & INFORMED FLOW ADVERSE SELECTION                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   INFORMED TRADERS (Quant HFT / Prop Funds / Algo Execution)                                      │
│   ┌────────────────────────────────────────────────────────┐                                     │
│   │ • Private alpha / ultra-fast news / low-latency feeds  │                                     │
│   │ • Directional institutional blocks (VWAP/TWAP sweeps)   │                                     │
│   │ • Aggressive Market Orders & IOC Sweeps                │                                     │
│   └───────────────────────────┬────────────────────────────┘                                     │
│                               │ Aggressive Liquidity-Consuming Flow (Volume V)                   │
│                               ▼                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │                        NSE / BSE CENTRAL LIMIT ORDER BOOK (CLOB)                           │ │
│   │   Asks (Sell Orders):  ₹24,502.50 (50) | ₹24,502.55 (250) | ₹24,503.00 (1200)             │ │
│   │   Spread: ₹0.05        ◄──────── Quoted Bid-Ask Spread ────────►                           │ │
│   │   Bids (Buy Orders):   ₹24,502.45 (150)| ₹24,502.40 (400) | ₹24,502.35 (800)              │ │
│   └───────────────────────────▲────────────────────────────────────────────────────────────────┘ │
│                               │ Passive Liquidity-Providing Quotes                               │
│   ┌───────────────────────────┴────────────────────────────┐                                     │
│   │ • Continuous passive two-sided quotes (Limit Orders)   │                                     │
│   │ • Profit Objective: Capture Half-Spread (s / 2)        │                                     │
│   │ • Vulnerability: Adverse Selection from Toxic Sweeps   │                                     │
│   └────────────────────────────────────────────────────────┘                                     │
│   MARKET MAKERS / PASSIVE LIQUIDITY PROVIDERS                                                    │
│                                                                                                  │
│   MICROSTRUCTURE RISK REGIMES:                                                                   │
│   ┌──────────────────────────────────────┬───────────────────────────────────────────────────┐   │
│   │ UNINFORMED FLOW (NOISE TRADERS)      │ TOXIC INFORMED FLOW (ALPHA/PREDATORY)             │   │
│   ├──────────────────────────────────────┼───────────────────────────────────────────────────┤   │
│   │ • Order flow is balanced & random    │ • Order flow is heavily one-sided (|V^B - V^S| high)│
│   │ • V_tau^B ≈ V_tau^S                  │ • Consecutive buys or consecutive sells           │   │
│   │ • VPIN is LOW (< 0.25)               │ • VPIN is TOXIC (> 0.45)                          │   │
│   │ • Market makers earn spread profit   │ • Market makers suffer severe inventory loss      │   │
│   │ • Tight spreads, deep order books    │ • Quotes widen or cancel ──► FLASH CRASH RISK!   │   │
│   └──────────────────────────────────────┴───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1 The Physics of Order Flow Toxicity
In the foundational market microstructure theory established by **Easley, Kiefer, O'Hara, and Paperman (EKOP, 1996)** and later modernized by **Easley, López de Prado, and O'Hara (2011, 2012)**:
* Trading is conceptualized as a repeated game between **Liquidity Providers (Market Makers)**, **Informed Traders**, and **Uninformed (Noise) Traders**.
* On any given trading interval, an information event occurs with probability $\alpha$. The event is bad news with probability $\delta$ (causing informed traders to sell aggressively) or good news with probability $1 - \delta$ (causing informed traders to buy aggressively).
* When no information event occurs (probability $1 - \alpha$), only uninformed noise traders arrive, generating Poisson-distributed buy orders at rate $\epsilon$ and sell orders at rate $\epsilon$.
* When an information event occurs, informed traders enter the market, adding an additional Poisson arrival rate of $\mu$ informed orders on the side dictated by the news.
* The classical EKOP model defines the **Probability of Information-based Trading (PIN)** as:
  $$\text{PIN} = \frac{\alpha \mu}{\alpha \mu + 2\epsilon}$$
* However, classical PIN has critical limitations in modern high-frequency trading:
  1. It requires continuous numerical optimization (Maximum Likelihood Estimation) over non-convex likelihood functions, which frequently fails to converge or suffers from floating-point overflow.
  2. It relies on daily clock-time trade counts, rendering it incapable of providing intraday, sub-second early warnings.
  3. It cannot handle the extreme volume bursts characteristic of algorithmic execution in Indian markets.

**VPIN (Volume-Synchronized Probability of Toxicity)** overcomes all these limitations by replacing chronological time with **Volume Time** and using **Bulk Volume Classification (BVC)** to directly estimate the volume-synchronized toxicity directly from standardized trade price returns without running non-linear regressions.

#### 2.2 Indian Exchange Tick Infrastructure & Market Parameters
The microstructure engine operates across NSE and BSE equity cash and F&O segments, calibrated for the exact statutory parameters:

| Asset Class / Instrument | Exchange | Tick Size ($\Delta \text{tick}$) | Lot Size ($L$) | Target Daily Volume (ADV) | Calibrated Bucket Size ($V$) | Rolling Window ($N$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **NIFTY 50 Futures** | NSE | ₹0.05 | 25 | ~8,000,000 contracts | **160,000 contracts** (ADV / 50) | 50 buckets |
| **BANKNIFTY Futures** | NSE | ₹0.05 | 15 | ~5,000,000 contracts | **100,000 contracts** (ADV / 50) | 50 buckets |
| **FINNIFTY Futures** | NSE | ₹0.05 | 25 | ~2,500,000 contracts | **50,000 contracts** (ADV / 50) | 50 buckets |
| **RELIANCE (Cash Equity)** | NSE | ₹0.05 | 1 | ~10,000,000 shares | **200,000 shares** (ADV / 50) | 50 buckets |
| **HDFCBANK (Cash Equity)** | NSE | ₹0.05 | 1 | ~15,000,000 shares | **300,000 shares** (ADV / 50) | 50 buckets |
| **SENSEX Futures** | BSE | ₹0.05 | 10 | ~3,000,000 contracts | **60,000 contracts** (ADV / 50) | 50 buckets |

#### 2.3 Regulatory Alignment with SEBI Market Integrity Rules
1. **SEBI Dynamic Price Bands & Operating Ranges:**
   Under SEBI Master Circulars for cash and derivatives segments, exchange order matching engines apply dynamic volatility cooling bands (e.g., 10%, 15%, 20% index circuits, and dummy 2-3% stock bands). When VPIN breaches toxic levels (> 0.45) in conjunction with an escalating Kyle's Lambda, the system alerts traders to impending exchange circuit halts.
2. **SEBI Algorithm Registration & Order-to-Trade Ratio (OTR) Rules:**
   Proprietary HFT desks in India are penalized under SEBI's OTR regime for excessive quote cancellations. When toxicity surges, algorithmic market makers risk heavy regulatory fines if they cancel orders indiscriminately. The engine provides optimal **defensive quote widening parameters** that maintain quoting presence while widening half-spreads to mitigate adverse selection without violating OTR penalties.
3. **Prevention of Predatory Quote Stuffing & Spoofing:**
   The engine monitors depth replenishment velocity to differentiate genuine institutional toxicity (large volume executing and moving price) from deceptive quote spoofing (high cancellation rates with minimal volume completion).

---

### 3. Quantitative & Mathematical Formulations

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   QUANTITATIVE ORDER FLOW TOXICITY ENGINE PIPELINE                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   RAW TRADE STREAM: {Trade Price P_k, Volume v_k, Timestamp t_k}                                 │
│                                     │                                                            │
│                                     ▼                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. VOLUME-CLOCK BINNING ENGINE                                                             │  │
│  │    • Accumulate trade volume: S_k = \sum v_k                                               │  │
│  │    • When S_k reaches constant bucket size V: Close Bucket \tau                            │  │
│  │    • Handle multi-bucket splits: Trade spanning bucket boundary is pro-rated               │  │
│  │    • Record Bucket Return: \Delta P_\tau = P_{\text{close}, \tau} - P_{\text{close}, \tau-1}│  │
│  └──────────────────────────────────┬─────────────────────────────────────────────────────────┘  │
│                                     │                                                            │
│                                     ▼                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. BULK VOLUME CLASSIFICATION (BVC) ENGINE                                                 │  │
│  │    • Rolling Return Volatility: \sigma_{\Delta P, \tau} = StdDev(\Delta P_{\tau-M}..\Delta P_\tau)│
│  │    • Standardized Price Return Z-Score: Z_\tau = \Delta P_\tau / \sigma_{\Delta P, \tau}   │  │
│  │    • Buyer-Initiated Volume: V_\tau^B = V \cdot \Phi(Z_\tau)                               │  │
│  │    • Seller-Initiated Volume: V_\tau^S = V \cdot [1 - \Phi(Z_\tau)] = V - V_\tau^B         │  │
│  │    • Order Imbalance: OI_\tau = |V_\tau^B - V_\tau^S| = V \cdot |2\Phi(Z_\tau) - 1|        │  │
│  └──────────────────────────────────┬─────────────────────────────────────────────────────────┘  │
│                                     │                                                            │
│                                     ▼                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. VPIN COMPUTATION & TOXICITY PERCENTILE CDF                                              │  │
│  │    • Rolling N-Bucket Toxicity: VPIN_\tau = \frac{\sum_{i=0}^{N-1} OI_{\tau-i}}{N \cdot V} │  │
│  │    • Historical Percentile: Percentile_\tau = \frac{1}{M} \sum_{j=1}^M \mathbb{I}(VPIN_j \le VPIN_\tau)│
│  │    • Toxicity Regime Classification: NORMAL (< 0.25) | ELEVATED (0.25-0.45) | TOXIC (> 0.45)│
│  └──────────────────────────────────┬─────────────────────────────────────────────────────────┘  │
│                                     │                                                            │
│         ┌───────────────────────────┴───────────────────────────┐                                │
│         ▼                                                       ▼                                │
│  ┌──────────────────────────────────────────┐    ┌────────────────────────────────────────────┐  │
│  │ 4. KYLE'S LAMBDA (\lambda) ENGINE        │    │ 5. GLOSTEN-MILGROM & ROLL SPREAD ENGINE    │  │
│  │    • Net Signed Flow: Q_\tau = V^B - V^S │    │    • Effective Spread: S = 2|P_k - M_k|    │  │
│  │    • Price Change: \Delta P_\tau         │    │    • Roll Serial Covariance: \Delta P_k   │  │
│  │    • \lambda = Cov(\Delta P, Q) / Var(Q) │    │    • Adverse Selection Fraction: \alpha_{AS}│  │
│  │    • Measures INR price impact per unit  │    │    • Inventory Holding Fraction: \alpha_{INV}│ │
│  │      of signed institutional flow        │    │    • Order Processing Fraction: \alpha_{OP} │  │
│  └──────────────────┬───────────────────────┘    └─────────────────────┬──────────────────────┘  │
│                     │                                                  │                         │
│                     └───────────────────────┬──────────────────────────┘                         │
│                                             ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 6. MARKET MAKER DEFENSIVE WIDENING & FLASH CRASH EARLY WARNING RADAR                       │  │
│  │    • Dynamic Half-Spread Widening Multiplier: \Omega_{\text{def}} = 1 + \kappa \cdot VPIN^\gamma│
│  │    • Liquidity Exhaustion Time-to-Depletion: T_{\text{deplete}} = Depth(L3) / (\dot{Q}_{\text{toxic}})│
│  │    • Flash Crash Hazard Index: FCHI_\tau = \omega_1 \cdot VPIN_\tau + \omega_2 \cdot \lambda_\tau^* + \omega_3 \cdot \alpha_{AS}│
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 Volume-Clock Binning & Information-Synchronized Microstructure
Chronological time $t \in [0, T]$ is replaced by transaction volume time $\tau \in \mathbb{N}$. 

1. **Volume Partitioning Definition:**
   Let $\{t_k, P_k, v_k\}_{k=1}^K$ denote the chronological sequence of executed trades, where $t_k$ is the trade execution timestamp, $P_k$ is the execution price, and $v_k$ is the traded volume (number of shares/contracts).
   A constant volume bucket size $V \in \mathbb{R}^+$ is established. The standard institutional benchmark sets:
   $$V = \frac{\text{ADV}}{50}$$
   where $\text{ADV}$ is the average daily volume over the preceding 20 trading sessions, ensuring that an average trading day consists of exactly 50 volume buckets.

2. **Bucket Boundary Traversal & Exact Pro-Ration Algorithm:**
   Let $S_k = \sum_{j=1}^k v_j$ be the cumulative traded volume. A bucket $\tau$ is completed whenever cumulative volume crosses an integer multiple of $V$, i.e., $S_k \ge \tau \cdot V$.
   If a single trade $k$ spans the boundary between bucket $\tau$ and bucket $\tau+1$ (i.e., $S_{k-1} < \tau V < S_k$):
   - The fraction of trade $k$ assigned to bucket $\tau$ is:
     $$v_{k, \tau} = \tau V - S_{k-1}$$
   - The remaining fraction assigned to bucket $\tau+1$ is:
     $$v_{k, \tau+1} = v_k - v_{k, \tau} = S_k - \tau V$$
   - Both fractional fills execute at the same trade price $P_k$.
   The bucket closing price $P_{\tau}$ is defined as the price of the final trade (or fractional fill) closing bucket $\tau$.
   The bucket price return is defined as:
   $$\Delta P_\tau = P_\tau - P_{\tau-1}$$

#### 3.2 Bulk Volume Classification (BVC) Engine
In high-frequency markets, matching individual trades to quotes via the Lee-Ready tick rule induces substantial classification errors. The Bulk Volume Classification (BVC) model developed by Easley, López de Prado, and O'Hara (2012) solves this by treating the aggregate buyer/seller split in bucket $\tau$ as a continuous probabilistic function of the standardized price change across the bucket.

1. **Standardized Price Return Z-Score:**
   The rolling standard deviation of bucket price returns across the preceding $M$ buckets (standard $M = 20$) is:
   $$\sigma_{\Delta P, \tau} = \sqrt{\frac{1}{M-1} \sum_{i=0}^{M-1} \left(\Delta P_{\tau-i} - \overline{\Delta P}_\tau\right)^2}$$
   where $\overline{\Delta P}_\tau = \frac{1}{M} \sum_{i=0}^{M-1} \Delta P_{\tau-i}$.
   The standardized return Z-score is:
   $$Z_\tau = \frac{\Delta P_\tau}{\sigma_{\Delta P, \tau}}$$
   *(With numerical safeguard: if $\sigma_{\Delta P, \tau} < 10^{-7}$, $Z_\tau = 0$.)*

2. **Probabilistic Volume Splitting via Gaussian CDF:**
   Assuming price changes within a volume bucket follow a normal distribution resulting from the continuous aggregation of micro-order flows, the buyer-initiated volume $V_\tau^B$ and seller-initiated volume $V_\tau^S$ are formulated as:
   $$V_\tau^B = V \cdot \Phi\left(Z_\tau\right) = V \cdot \frac{1}{\sqrt{2\pi}} \int_{-\infty}^{Z_\tau} e^{-\frac{u^2}{2}} du$$
   $$V_\tau^S = V \cdot \left[1 - \Phi\left(Z_\tau\right)\right] = V - V_\tau^B$$
   where $\Phi(\cdot)$ is the standard normal cumulative distribution function.

3. **Mathematical Properties & Boundary Conditions:**
   - **Symmetry:** If $\Delta P_\tau = 0 \implies Z_\tau = 0 \implies \Phi(0) = 0.5 \implies V_\tau^B = 0.5V$ and $V_\tau^S = 0.5V$ (perfectly balanced uninformed flow).
   - **Extreme Positive Shock:** As $\Delta P_\tau \to +\infty \implies Z_\tau \to +\infty \implies \Phi(Z_\tau) \to 1.0 \implies V_\tau^B \to V$ and $V_\tau^S \to 0$ (100% aggressive buying).
   - **Extreme Negative Shock:** As $\Delta P_\tau \to -\infty \implies Z_\tau \to -\infty \implies \Phi(Z_\tau) \to 0.0 \implies V_\tau^B \to 0$ and $V_\tau^S \to V$ (100% aggressive selling).
   - **Conservation of Volume:** For all $\tau$, $V_\tau^B + V_\tau^S \equiv V$.

4. **Bucket Order Imbalance ($OI_\tau$):**
   $$OI_\tau = |V_\tau^B - V_\tau^S| = \left|V \cdot \Phi(Z_\tau) - V \cdot (1 - \Phi(Z_\tau))\right| = V \cdot |2\Phi(Z_\tau) - 1|$$

#### 3.3 Volume-Synchronized Probability of Toxicity (VPIN) Formulation
The Volume-Synchronized Probability of Toxicity over a rolling window of $N$ volume buckets (standard institutional configuration $N = 50$) is the ratio of total absolute order imbalance to total traded volume across the window:

$$\text{VPIN}_\tau = \frac{\sum_{i=0}^{N-1} |V_{\tau-i}^B - V_{\tau-i}^S|}{N \cdot V} = \frac{1}{N} \sum_{i=0}^{N-1} |2\Phi(Z_{\tau-i}) - 1|$$

Because $0 \le |2\Phi(Z) - 1| \le 1$, $\text{VPIN}_\tau$ is strictly bounded:
$$0.0 \le \text{VPIN}_\tau \le 1.0$$

#### 3.4 Historical Toxicity Percentile CDF & Regime Thresholds
Raw VPIN varies by asset volatility and underlying liquidity structure. To create an asset-invariant toxicity indicator, the engine continuously calibrates an empirical Cumulative Distribution Function (CDF) over a rolling lookback of $K_{\text{hist}} = 1,000$ completed buckets:

$$\text{Percentile}(\text{VPIN}_\tau) = \frac{1}{K_{\text{hist}}} \sum_{j=1}^{K_{\text{hist}}} \mathbb{I}\left(\text{VPIN}_j \le \text{VPIN}_\tau\right) \times 100\%$$

Toxicity regimes are defined under institutional quant risk standards:

| Toxicity Regime | VPIN Metric Range | Percentile CDF Range | Microstructure Interpretation | Automated Platform Action |
| :---: | :---: | :---: | :--- | :--- |
| **NORMAL (Green)** | $\text{VPIN} < 0.25$ | $< 50^{\text{th}}$ percentile | Predominantly noise trading, balanced two-sided flow, tight spreads. | Maintain standard tight quoting spreads; optimal passive limit fills. |
| **ELEVATED (Yellow)** | $0.25 \le \text{VPIN} \le 0.45$ | $50^{\text{th}} - 85^{\text{th}}$ percentile | Emerging one-sided institutional activity; moderate adverse selection. | Trigger 1.25x - 1.5x quote widening; reduce passive order queue sizes. |
| **TOXIC (Red / Flashing)** | $\text{VPIN} > 0.45$ | $> 85^{\text{th}}$ percentile | Severe informed aggressive sweeps; extreme adverse selection; impending liquidity vacuum. | **FLASH CRASH WARNING**: Cancel resting bids/asks; switch to aggressive defensive widening (> 2.0x); pause automated retail market-making bots. |

#### 3.5 Dynamic Kyle's Lambda ($\lambda$) - Adverse Price Impact Coefficient
In Albert S. Kyle's seminal model of market microstructure (Kyle, 1985), an informed trader with private information submits an order flow $Q$ to a competitive market maker. The market maker sets prices linearly to absorb the order flow:
$$P_\tau = P_{\tau-1} + \lambda \cdot Q_\tau + \eta_\tau$$
where:
- $\Delta P_\tau = P_\tau - P_{\tau-1}$ is the realized price change across bucket $\tau$.
- $Q_\tau = V_\tau^B - V_\tau^S = V \cdot (2\Phi(Z_\tau) - 1)$ is the net signed order flow (signed volume in contracts/shares).
- $\eta_\tau \sim \mathcal{N}(0, \sigma_\eta^2)$ is the idiosyncratic noise return.
- $\lambda$ is **Kyle's Lambda**, representing the **price impact per unit of signed order flow**:
  $$\lambda = \frac{\text{Cov}(\Delta P, Q)}{\text{Var}(Q)}$$

**Discrete Rolling Estimator Formulation:**
Over a rolling window of $W = 30$ buckets, the engine computes:
$$\overline{\Delta P} = \frac{1}{W} \sum_{i=0}^{W-1} \Delta P_{\tau-i}, \quad \overline{Q} = \frac{1}{W} \sum_{i=0}^{W-1} Q_{\tau-i}$$
$$\widehat{\text{Cov}}(\Delta P, Q) = \frac{1}{W-1} \sum_{i=0}^{W-1} (\Delta P_{\tau-i} - \overline{\Delta P})(Q_{\tau-i} - \overline{Q})$$
$$\widehat{\text{Var}}(Q) = \frac{1}{W-1} \sum_{i=0}^{W-1} (Q_{\tau-i} - \overline{Q})^2$$
$$\widehat{\lambda}_\tau = \max\left(0, \frac{\widehat{\text{Cov}}(\Delta P, Q)}{\widehat{\text{Var}}(Q)}\right)$$

*Units of $\lambda$:* $\frac{\text{INR}}{\text{Contract}}$ or $\frac{\text{INR}}{\text{Share}}$ per contract traded.
*Economic interpretation:* A surge in $\widehat{\lambda}$ signals that the order book has become paper-thin and fragile; even modest directional order flow will cause massive, permanent price displacement.

#### 3.6 Glosten-Milgrom (1985) & Roll (1984) Spread Decomposition
The quoted bid-ask spread $S_t = P_t^{\text{Ask}} - P_t^{\text{Bid}}$ is decomposed into its structural economic components:
$$S_t = \text{AS}_t + \text{INV}_t + \text{OP}_t$$

1. **Roll (1984) Serial Covariance Model:**
   In an efficient market with bid-ask bounce, trade price changes $\Delta P_k = P_k - P_{k-1}$ exhibit negative first-order serial autocovariance:
   $$\text{Cov}(\Delta P_k, \Delta P_{k-1}) = - \left(\frac{S_{\text{Roll}}}{2}\right)^2$$
   The implied effective spread from bid-ask bounce is:
   $$S_{\text{Roll}} = 2 \sqrt{-\min\left(0, \text{Cov}(\Delta P_k, \Delta P_{k-1})\right)}$$

2. **Glosten-Milgrom Adverse Selection Component ($\text{AS}_t$):**
   Glosten and Milgrom (1985) demonstrate that the price revision conditional on trade arrival reflects the market maker's Bayesian updating of terminal asset value $V$:
   $$\Delta M_{k+\Delta t} = M_{k+\Delta t} - M_k = \theta \cdot (P_k - M_k) + \xi_k$$
   where $M_k = \frac{P_k^{\text{Bid}} + P_k^{\text{Ask}}}{2}$ is the prevailing quote midpoint, and $\theta \in [0, 1]$ is the **Adverse Selection Parameter** (the fraction of the trade premium that causes permanent midpoint displacement).
   The Adverse Selection cost in INR is:
   $$\text{AS}_t = \theta \cdot S_t$$

3. **Inventory Holding Risk ($\text{INV}_t$) & Order Processing Cost ($\text{OP}_t$):**
   Following Huang & Stoll (1997) and Stoll (1989):
   $$\text{INV}_t = \phi \cdot S_t$$
   $$\text{OP}_t = (1 - \theta - \phi) \cdot S_t$$
   where:
   - $\theta = \frac{\lambda \cdot \text{StdDev}(Q)}{S_t / 2}$ (the adverse selection fraction directly linked to Kyle's Lambda and VPIN).
   - $\phi = \beta_{\text{inv}} \cdot \sigma_{\text{mid}} \sqrt{\Delta t_{\text{hold}}}$ (the volatility-scaled cost of inventory holding risk).
   - The remaining fraction $\gamma = 1 - \theta - \phi$ represents pure order processing, clearing costs, and market maker profit margin.

#### 3.7 Market Maker Defensive Quote Widening Engine
When informed order flow toxicity spikes, market makers who maintain constant half-spreads $\frac{S_0}{2}$ experience negative expected profit per trade:
$$\mathbb{E}[\Pi_{\text{MM}}] = (1 - \text{VPIN}) \cdot \frac{S}{2} - \text{VPIN} \cdot \left(\text{Adverse Slippage}\right) < 0$$

To guarantee positive expected terminal profit under arbitrary toxicity levels, the engine computes the **Optimal Defensive Quote Widening Multiplier ($\Omega_{\text{def}}$)**:
$$\Omega_{\text{def}}(\text{VPIN}) = 1.0 + \kappa \cdot \left(\frac{\text{VPIN}}{\text{VPIN}_{\text{threshold}}}\right)^\gamma \quad \text{for } \text{VPIN} \ge \text{VPIN}_{\text{threshold}}$$
where:
- $\text{VPIN}_{\text{threshold}} = 0.25$ (the boundary between Normal and Elevated toxicity).
- $\kappa = 1.5$ is the sensitivity calibration constant for Indian derivatives.
- $\gamma = 2.0$ represents the non-linear penalty for extreme toxicity.

The defensibly widened bid and ask prices are:
$$P_{\text{Ask, def}} = M_t + \frac{S_0}{2} \cdot \Omega_{\text{def}}(\text{VPIN})$$
$$P_{\text{Bid, def}} = M_t - \frac{S_0}{2} \cdot \Omega_{\text{def}}(\text{VPIN})$$

#### 3.8 Flash Crash Early-Warning Radar & Liquidity Depletion Metric
A Flash Crash occurs when aggressive informed order flow consumes available limit order book depth faster than passive market makers can replenish it.

1. **Order Book Depth Depletion Velocity ($\dot{Q}_{\text{deplete}}$):**
   Let $\mathcal{D}_L(t) = \sum_{i=1}^5 \text{BidSize}_i(t)$ be the total top-5 bid depth in lots.
   The net toxic selling consumption rate per second is:
   $$\dot{V}_{\text{sell}}(t) = \frac{V_\tau^S}{\Delta t_\tau} \quad (\text{lots per second})$$
   The estimated **Time-to-Liquidity-Depletion ($T_{\text{deplete}}$)** is:
   $$T_{\text{deplete}}(t) = \frac{\mathcal{D}_L(t)}{\max\left(1, \dot{V}_{\text{sell}}(t) - \dot{\mathcal{R}}_{\text{replenish}}(t)\right)}$$
   where $\dot{\mathcal{R}}_{\text{replenish}}(t)$ is the estimated depth replenishment rate derived from L3 order add events.

2. **Flash Crash Hazard Index (FCHI):**
   The Flash Crash Hazard Index aggregates VPIN, Kyle's Lambda, and Depth Depletion into a normalized early-warning score $0 \le \text{FCHI} \le 100$:
   $$\text{FCHI}_t = 100 \cdot \left[ w_1 \cdot \text{Percentile}(\text{VPIN}_t) + w_2 \cdot \min\left(1, \frac{\widehat{\lambda}_t}{\lambda_{\text{baseline}}}\right) + w_3 \cdot \left(1 - \min\left(1, \frac{T_{\text{deplete}}}{30\text{s}}\right)\right) \right]$$
   with default weights $w_1 = 0.45, w_2 = 0.35, w_3 = 0.20$.
   - **FCHI > 75:** `HIGH FLASH CRASH HAZARD` — Automated freeze alerts triggered; systematic liquidity withdrawal warning displayed.

---

### 4. System Architecture & BYOK Data Flow

```mermaid
flowchart TD
    subgraph DataIngestion ["1. Real-Time Data Ingestion Layer (BYOK WebSocket)"]
        WS[Raw L2/L3 WebSocket Feed<br/>Zerodha Kite / Upstox / Angel One / Fyers]
        TradeNorm[Trade Normalizer & Deduplicator<br/>Price, Volume, Nanosecond Timestamp]
        DepthNorm[Order Book Depth Tracker<br/>Top-5 Bids/Asks & Total Depth]
        WS --> TradeNorm
        WS --> DepthNorm
    end

    subgraph VolumeClockEngine ["2. Information-Time Volume Clock Engine"]
        VolAccum[Cumulative Volume Accumulator<br/>S_k = sum v_k]
        BucketSplitter[Exact Pro-Rata Boundary Splitter<br/>V = ADV / 50]
        BucketEmitter[Bucket Completed Event<br/>P_tau, Delta P_tau, Volume V]
        TradeNorm --> VolAccum
        VolAccum --> BucketSplitter
        BucketSplitter --> BucketEmitter
    end

    subgraph BVCEngine ["3. Bulk Volume Classification (BVC) Engine"]
        RollVol[Rolling 20-Bucket Price Return Volatility<br/>sigma_Delta_P]
        ZScore[Standardized Return Z-Score<br/>Z = Delta P / sigma_Delta_P]
        GaussCDF[Chebyshev/Rational Polynomial Normal CDF<br/>Phi(Z)]
        VolSplit[Signed Volume Assignment<br/>V^B = V * Phi(Z), V^S = V - V^B]
        BucketEmitter --> RollVol
        BucketEmitter --> ZScore
        RollVol --> ZScore
        ZScore --> GaussCDF
        GaussCDF --> VolSplit
    end

    subgraph MicrostructureAnalytics ["4. Microstructure Analytics Core"]
        VPINCalc[Rolling 50-Bucket VPIN Solver<br/>sum |V^B - V^S| / 50V]
        CDFTable[Empirical 1000-Bucket Percentile Lookup<br/>CDF(VPIN)]
        KyleCalc[Kyle's Lambda Regressor<br/>Cov(Delta P, Q) / Var(Q)]
        SpreadDecomp[Glosten-Milgrom Spread Decomposer<br/>AS, INV, OP Fractions]
        DefensiveWidener[Market Maker Widening Multiplier<br/>Omega_def = 1 + kappa * VPIN^gamma]
        RadarCalc[Flash Crash Hazard Index (FCHI)<br/>VPIN + Lambda + Depth Depletion]
        
        VolSplit --> VPINCalc
        VPINCalc --> CDFTable
        VolSplit --> KyleCalc
        BucketEmitter --> KyleCalc
        DepthNorm --> SpreadDecomp
        KyleCalc --> SpreadDecomp
        VPINCalc --> DefensiveWidener
        VPINCalc --> RadarCalc
        KyleCalc --> RadarCalc
        DepthNorm --> RadarCalc
    end

    subgraph UIModule ["5. Real-Time Interactive Toxicity Cockpit UI"]
        Needle[VPIN Speedometer Gauge<br/>Normal / Elevated / Toxic]
        Heatmap[Historical Percentile Ribbon<br/>Color-Coded Heatmap]
        ImbalanceChart[Bucket Volume Imbalance Ladder<br/>Green V^B vs Red V^S]
        KyleScatter[Kyle's Lambda Price Impact Curve<br/>Regression Slope]
        SpreadStack[Spread Decomposition Stacked Bar<br/>Adverse Selection vs Inventory vs Cost]
        EarlyWarningBanner[Flash Crash Early-Warning Radar<br/>Audible & Visual Breaches]

        CDFTable --> Needle
        CDFTable --> Heatmap
        VolSplit --> ImbalanceChart
        KyleCalc --> KyleScatter
        SpreadDecomp --> SpreadStack
        RadarCalc --> EarlyWarningBanner
    end
```

#### 4.1 Client-Side Browser Optimization (Web Workers & TypedArrays)
In high-frequency Indian trading sessions where NSE can generate 5,000+ trade ticks per second in NIFTY futures, running complex floating-point CDF evaluations and covariance regressions on the main JavaScript thread would cause severe UI stutter and frame drops.

To guarantee deterministic, sub-millisecond execution:
1. **Dedicated Microstructure Web Worker (`vpinWorker.ts`):**
   All raw WebSocket trade events are transferred to an isolated background Web Worker using zero-copy `ArrayBuffer` transfers.
2. **Pre-Allocated Circular Buffers (TypedArrays):**
   The volume bucket history, price returns, and volume components are stored in fixed-size `Float64Array` circular buffers (`MAX_BUCKETS = 2000`), completely eliminating runtime garbage collection pauses (`GC free`).
3. **High-Speed Approximation for Gaussian CDF ($\Phi(Z)$):**
   Instead of expensive numerical integration, the engine utilizes the Hart-Cody high-precision rational Chebyshev approximation:
   $$\Phi(x) \approx 0.5 \cdot \text{erfc}\left(-\frac{x}{\sqrt{2}}\right)$$
   delivering 15 decimal digits of accuracy with single-digit nanosecond execution per evaluation.
4. **Decoupled UI Rendering Pipeline:**
   The Web Worker emits compressed analytics payloads (`VPINSnapshot`) to the main thread at a capped 60 FPS refresh rate (every 16.6ms) via `requestAnimationFrame`.

---

### 5. Detailed User Stories & Acceptance Criteria

#### User Story 1: Real-Time Volume-Clock Binning & BVC Buyer/Seller Classification
**As an** algorithmic derivatives trader in NIFTY and BANKNIFTY,  
**I want** raw trade streams partitioned into constant volume buckets and classified into buyer/seller initiated flow via Bulk Volume Classification (BVC),  
**So that** my order flow analysis is synchronized with information arrival rather than arbitrary chronological clock time.

* **Acceptance Criteria:**
  1. Given a incoming trade tick sequence with price $P_k$ and volume $v_k$, when cumulative volume reaches bucket size $V = \frac{\text{ADV}}{50}$, the engine must close the bucket and instantiate bucket $\tau$.
  2. Given a large trade that spans across the bucket boundary ($S_{k-1} < \tau V < S_k$), the engine must pro-rate the trade, allocating exactly $\tau V - S_{k-1}$ volume to bucket $\tau$ and $S_k - \tau V$ volume to bucket $\tau+1$ without dropping volume or distorting execution prices.
  3. Given a closed bucket with return $\Delta P_\tau$ and rolling return volatility $\sigma_{\Delta P, \tau}$, the engine must evaluate $Z_\tau = \frac{\Delta P_\tau}{\sigma_{\Delta P, \tau}}$ and compute buyer volume $V_\tau^B = V \cdot \Phi(Z_\tau)$ and seller volume $V_\tau^S = V \cdot (1 - \Phi(Z_\tau))$.
  4. The engine must verify that $V_\tau^B + V_\tau^S \equiv V$ within floating-point tolerance ($|V_\tau^B + V_\tau^S - V| < 10^{-6}$).
  5. The calculation latency per bucket closure must not exceed 0.2ms.

#### User Story 2: Rolling VPIN Metric & Historical Percentile Regime Indicator
**As a** quantitative options market maker,  
**I want** continuous calculation of the 50-bucket rolling VPIN metric and its empirical historical percentile CDF,  
**So that** I am alerted whenever order flow toxicity shifts from benign noise trading into toxic institutional sweeps.

* **Acceptance Criteria:**
  1. Given a sequence of closed volume buckets, the engine must maintain a rolling window of $N = 50$ buckets and compute:
     $$\text{VPIN}_\tau = \frac{\sum_{i=0}^{N-1} |V_{\tau-i}^B - V_{\tau-i}^S|}{N \cdot V}$$
  2. The calculated VPIN must be strictly clamped within the theoretical interval $[0.0, 1.0]$.
  3. The engine must evaluate the current VPIN against an empirical historical distribution of $K_{\text{hist}} = 1,000$ buckets, outputting the exact percentile value $0.0\% - 100.0\%$.
  4. The UI must display the three regulatory risk regimes clearly:
     - `NORMAL` (Green): $\text{VPIN} < 0.25$
     - `ELEVATED` (Yellow): $0.25 \le \text{VPIN} \le 0.45$
     - `TOXIC` (Red / Pulsing Alert): $\text{VPIN} > 0.45$
  5. Whenever VPIN crosses from `ELEVATED` to `TOXIC`, an audio alert and visual HUD banner must activate within 50ms.

#### User Story 3: Kyle's Lambda Price Impact Estimator
**As an** algorithmic execution desk trader executing large institutional parent orders,  
**I want** continuous real-time estimation of Kyle's Lambda ($\lambda$),  
**So that** my execution algorithms dynamically pace child orders to minimize permanent price impact and market footprint.

* **Acceptance Criteria:**
  1. Given a rolling window of $W = 30$ volume buckets, the engine must compute net signed order flow $Q_\tau = V_\tau^B - V_\tau^S$ and price change $\Delta P_\tau$.
  2. The engine must compute the sample covariance $\widehat{\text{Cov}}(\Delta P, Q)$ and sample variance $\widehat{\text{Var}}(Q)$, resolving $\widehat{\lambda} = \max\left(0, \frac{\widehat{\text{Cov}}(\Delta P, Q)}{\widehat{\text{Var}}(Q)}\right)$.
  3. The engine must express $\widehat{\lambda}$ in standard Indian currency units: ₹ Impact per Lot (or ₹ Impact per 1,000 shares).
  4. The UI must render a real-time scatter plot of $\Delta P$ vs $Q$ overlaid with the fitted regression line representing slope $\lambda$.

#### User Story 4: Glosten-Milgrom Spread Decomposition
**As a** prop trader and market maker,  
**I want** to see the prevailing bid-ask spread decomposed into Adverse Selection, Inventory Holding, and Order Processing costs,  
**So that** I can avoid providing liquidity when wide spreads are caused by informed adverse selection rather than profitable market-making margin.

* **Acceptance Criteria:**
  1. Given top-of-book quotes ($P_{\text{Bid}}, P_{\text{Ask}}$), the engine must compute quoted spread $S = P_{\text{Ask}} - P_{\text{Bid}}$.
  2. Using the estimated Kyle's Lambda and historical trade autocovariance (Roll model), the engine must decompose $S$ into:
     - Adverse Selection fraction $\alpha_{AS} \in [0, 1]$
     - Inventory Holding fraction $\alpha_{INV} \in [0, 1]$
     - Order Processing fraction $\alpha_{OP} \in [0, 1]$
     such that $\alpha_{AS} + \alpha_{INV} + \alpha_{OP} = 1.0$.
  3. The UI must render a dynamic stacked horizontal bar breaking down the spread in real-time.
  4. If $\alpha_{AS} > 0.65$ (Adverse Selection dominating spread), the system must flag the spread as `TOXIC SPREAD — DO NOT QUOTE`.

#### User Story 5: Market Maker Defensive Quote Widening & Flash Crash Early-Warning Radar
**As a** risk manager or automated algorithmic liquidity provider,  
**I want** automated defensive quote widening recommendations and Flash Crash early warning alerts based on order book depth depletion,  
**So that** my capital is protected from catastrophic liquidity black holes and sudden cascade crashes.

* **Acceptance Criteria:**
  1. Given prevailing VPIN, when $\text{VPIN} > 0.25$, the engine must compute the defensive half-spread multiplier:
     $$\Omega_{\text{def}} = 1.0 + 1.5 \cdot \left(\frac{\text{VPIN}}{0.25}\right)^2$$
     and display suggested widened bid/ask limit prices.
  2. The engine must track top-5 L2 bid/ask depth and compute instantaneous depth depletion velocity $\dot{V}_{\text{sell}}$ and estimated time-to-depletion $T_{\text{deplete}}$.
  3. The engine must calculate the Flash Crash Hazard Index (FCHI) from 0 to 100.
  4. If $\text{FCHI} \ge 75$ or $T_{\text{deplete}} < 10\text{s}$ under `TOXIC` VPIN, the platform must trigger an emergency `CRITICAL FLASH CRASH RADAR ALERT`, prompting one-click cancellation of all passive resting orders.

---

### 6. Non-Functional Requirements & Performance Benchmarks

| Metric / Dimension | Specification / Institutional SLA | Verification Method |
| :--- | :--- | :--- |
| **Max Computation Latency** | $< 0.5\text{ ms}$ per closed volume bucket calculation | Performance benchmark using Chrome DevTools Performance Profiler. |
| **Throughput Capacity** | Process up to **10,000 trade ticks per second** without event backlog | Simulated high-frequency tick burst injection benchmark. |
| **Memory Footprint** | $< 35\text{ MB}$ total heap consumption in client browser | Chrome DevTools Memory Heap Snapshot comparison over 4-hour run. |
| **Zero Garbage Collection (GC)** | $0$ memory allocations in hot execution loop (`Float64Array` pre-allocated) | Allocation profiler verifying zero GC pauses during active streaming. |
| **Cross-Browser Compatibility** | Chrome $\ge$ 115, Edge $\ge$ 115, Firefox $\ge$ 118, Safari $\ge$ 17 | Automated Playwright headless cross-browser test runner. |
| **Offline Replay Support** | Full compatibility with Sprint 4 tick replay engine (`marketDepthEngine.ts`) | Replay of historical NSE 5-minute Flash Crash dataset verifying exact alert timestamps. |

---

### 7. User Interface Specification: Toxicity & Flash Crash Radar Dashboard

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  TRADECRAFT AI // MICROSTRUCTURE TOXICITY & VPIN RADAR                            SYMBOL: NIFTY26NOVFUT   LTP: 24,502.50 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐ │
│ │ CURRENT VPIN (50 BUCKETS) │ │ VPIN PERCENTILE CDF       │ │ KYLE'S LAMBDA (IMPACT)    │ │ FLASH CRASH HAZARD (FCHI) │ │
│ │         0.482             │ │          91.4%            │ │     ₹ 0.84 / Lot          │ │         82 / 100        │ │
│ │   [ TOXIC REGIME ]        │ │   [ TOP 10% HISTORICAL ]  │ │   [ HIGH ELASTICITY ]     │ │   [ CRITICAL WARNING ]  │ │
│ └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ ┌─────────────────────────────────────────────────────┐ │
│ │  REAL-TIME VPIN REGIME GAUGE                                 │ │  GLOSTEN-MILGROM SPREAD DECOMPOSITION (Spread: ₹0.50) │ │
│ │                                                              │ │  ┌────────────────────────────────────────────────┐  │ │
│ │                 .  -  '  '  -  .                             │ │  │ Adverse Selection: 68% (₹0.34) [TOXIC ADVERSE]  │  │ │
│ │              '                   '                           │ │  │ Inventory Risk:    22% (₹0.11)                 │  │ │
│ │            /        0.482          \                         │ │  │ Order Processing:  10% (₹0.05)                 │  │ │
│ │           |       ▲ NEEDLE          |                        │ │  └────────────────────────────────────────────────┘  │ │
│ │           |      /                  |                        │ │                                                      │ │
│ │            \    /                  /                         │ │  DEFENSIVE QUOTE WIDENING:                           │ │
│ │              . _ _ _ _ _ _ _ _ .                             │ │  • Multiplier: 2.35x                                 │ │
│ │         NORMAL      ELEVATED     TOXIC                       │ │  • Suggested Bid: ₹24,501.90 (vs Quoted ₹24,502.25)  │ │
│ │        (< 0.25)   (0.25-0.45)   (> 0.45)                     │ │  • Suggested Ask: ₹24,503.10 (vs Quoted ₹24,502.75)  │ │
│ └──────────────────────────────────────────────────────────────┘ └─────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │  VOLUME BUCKET IMBALANCE LADDER (Recent 20 Buckets | Green = Buy V^B, Red = Sell V^S, Gray Line = VPIN)           │ │
│ │  100% [████████████████] V^B (Buy Volume)                                                                          │ │
│ │   50% [--------|-------] Neutral                                                                                   │ │
│ │    0% [░░░░░░░░░░░░░░░░] V^S (Sell Volume)                                                                         │ │
│ │  Bucket: 31   32   33   34   35   36   37   38   39   40   41   42   43   44   45   46   47   48   49   50     │ │
│ │  Imbal:  +12% -18% +05% -42% -65% -82% -90% -88% -92% -95% -91% -89% -94% -85% -78% -65% -70% -82% -88% -94%   │ │
│ │  VPIN :  .21  .22  .21  .25  .28  .32  .36  .39  .41  .43  .45  .46  .47  .47  .48  .48  .48  .48  .48  .48   │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ ┌─────────────────────────────────────────────────────┐ │
│ │  KYLE'S LAMBDA PRICE IMPACT REGRESSION SCATTER (Delta P vs Q)│ │  FLASH CRASH RADAR & TIME-TO-DEPLETION               │ │
│ │   Delta P (₹)                                                │ │  • Top-5 Bid Depth:        12,450 contracts          │ │
│ │     +15 |               *                                    │ │  • Toxic Sell Burn Rate:   1,850 contracts/sec       │ │
│ │     +10 |            *   *                                   │ │  • Est. Time-to-Depletion: 6.7 seconds               │ │
│ │      +5 |         * *                                        │ │  • Replenishment Velocity: Critical Low              │ │
│ │       0 |-------*------------------ Signed Volume Q          │ │                                                      │ │
│ │      -5 |     * *                                            │ │  [ ! EMERGENCY LIQUIDITY EVAPORATION ALERT ! ]       │ │
│ │     -10 |   * *        Slope = Lambda (0.84)                 │ │  [ AUTO-ACTION: CANCEL ALL PASSIVE BIDS ]            │ │
│ │     -15 | *                                                  │ │  [ STATUS: DEFENSIVE PROTOCOL ENGAGED ]              │ │
│ └──────────────────────────────────────────────────────────────┘ └─────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 8. Data Structures & TypeScript Interface Contracts

```typescript
/**
 * BRD-025 Data Contracts: Microstructure Order Flow Toxicity & VPIN Engine
 */

export type ToxicityRegime = 'NORMAL' | 'ELEVATED' | 'TOXIC';

export interface RawTradeTick {
  tradeId: string;
  symbol: string;
  price: number;
  quantity: number;
  timestamp: number; // Unix epoch milliseconds
  exchange: 'NSE' | 'BSE';
}

export interface VolumeBucket {
  bucketIndex: number;
  symbol: string;
  bucketSize: number; // Constant volume V
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  priceChange: number; // Delta P = close - open
  standardizedReturn: number; // Z-score
  volumeBuy: number; // V^B = V * Phi(Z)
  volumeSell: number; // V^S = V * (1 - Phi(Z))
  orderImbalance: number; // |V^B - V^S|
  startTime: number;
  endTime: number;
  durationMs: number;
}

export interface VPINSnapshot {
  symbol: string;
  timestamp: number;
  bucketIndex: number;
  currentVPIN: number; // [0.0, 1.0]
  historicalPercentile: number; // [0.0, 100.0]
  regime: ToxicityRegime;
  kylesLambda: number; // Price impact per lot
  lambdaRSquared: number; // Regression fit quality
  spreadDecomposition: {
    quotedSpread: number;
    adverseSelectionCost: number;
    adverseSelectionFraction: number; // theta [0, 1]
    inventoryHoldingCost: number;
    inventoryHoldingFraction: number; // phi [0, 1]
    orderProcessingCost: number;
    orderProcessingFraction: number; // gamma [0, 1]
  };
  defensiveWidening: {
    multiplier: number; // Omega_def >= 1.0
    suggestedBid: number;
    suggestedAsk: number;
  };
  flashCrashRadar: {
    hazardIndex: number; // FCHI [0, 100]
    isFlashCrashWarning: boolean;
    bidDepthContracts: number;
    burnRateLotsPerSec: number;
    estimatedTimeToDepletionSec: number;
  };
}

export interface VPINEngineConfig {
  bucketSizeVolume?: number; // Default: ADV / 50
  rollingBucketsWindow?: number; // Default: 50
  historicalLookbackBuckets?: number; // Default: 1000
  volatilityLookbackBuckets?: number; // Default: 20
  kyleWindowBuckets?: number; // Default: 30
  normalThreshold?: number; // Default: 0.25
  toxicThreshold?: number; // Default: 0.45
  defensiveSensitivityKappa?: number; // Default: 1.5
  flashCrashThresholdFCHI?: number; // Default: 75
}
```

---

### 9. Risk Management, Failure Modes & Fallbacks

1. **Illiquid or Inactive Session Fallback:**
   - *Failure Mode:* During extended consolidation or pre-market phases, trading volume may be insufficient to complete volume buckets within reasonable time.
   - *Fallback:* If a volume bucket remains uncompleted after 30 chronological minutes, the engine issues a `VOLUME_CLOCK_STALL` notice, holding the previous VPIN value and freezing Kyle's Lambda updates to prevent stale inference.
2. **Extreme Volatility Singularity ($\sigma_{\Delta P} \to 0$):**
   - *Failure Mode:* When multiple consecutive buckets close at the exact same price ($\Delta P = 0$), rolling standard deviation $\sigma_{\Delta P} \to 0$, causing a division-by-zero singularity in $Z = \frac{\Delta P}{\sigma}$.
   - *Fallback:* The engine enforces a minimum variance clamp $\sigma_{\min} = 10^{-6} \times \text{TickSize}$. If $\Delta P = 0$, $Z \equiv 0 \implies \Phi(0) = 0.5$, gracefully allocating volume 50/50 between buyers and sellers.
3. **Out-of-Order WebSocket Packet Handling:**
   - *Failure Mode:* Network packet jitter causes trade events to arrive out of chronological order.
   - *Fallback:* The ingestion layer maintains an internal priority queue buffering events over a 5ms sliding window, sorting trades by exchange sequence number / nanosecond timestamp before volume accumulation.
4. **Data Privacy & Zero Exfiltration (BYOK Architecture):**
   - All trade feeds, L2/L3 order books, broker API keys, and calculated microstructure metrics execute strictly in client-side memory. No order flow data is ever transmitted to external servers.

---

### 10. Acceptance & Sign-off Criteria
This BRD is considered complete and approved when:
1. All mathematical equations (Volume-Clocking, BVC, VPIN, Kyle's Lambda, Glosten-Milgrom Spread Decomposition, Defensive Widening Multiplier, and Flash Crash Hazard Index) are comprehensively documented with unambiguous parameter definitions.
2. The user stories provide clear Given/When/Then acceptance criteria ready for immediate engineering implementation in Sprint 25.
3. The TypeScript interface contract and UI ASCII wireframe provide complete functional specifications for full-stack integration.
4. The BRD index in `docs/brds/README.md` is updated with Sprint 25 scope and active tracking.
