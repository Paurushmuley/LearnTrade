# Business Requirements Document (BRD)
## TradeCraft AI — Real-Time Level-3 Order Book Analytics, Iceberg Detector & Institutional Dark Pool Volume Tracker

- **Document ID:** `BRD-015-ORDERBOOK-L3-ICEBERG-DARKPOOL`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 15 (High-Frequency Microstructure & Institutional Order Flow Suite)
- **Dependencies:** 
  - Sprint 1 (`tradingEngine.ts` — Paper Trading Portfolio, `taxEngine.ts` — Statutory Fees)
  - Sprint 4 (`replayEngine.ts` — Level-2 Market Depth DOM Ladder)
  - Sprint 6 (`breadthEngine.ts` — FII/DII Institutional Flows)
  - Sprint 8 (`screenerEngine.ts` — Technical Screener)
  - Sprint 10 (`proofEngine.ts` — Proof-of-Alpha Cryptographic Ledger)
  - Sprint 11 (`quantDeskEngine.ts` — Algorithmic Routing & Microstructure Desk)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Information Asymmetry: Visible Retail DOM vs. Institutional Hidden Flow
In electronic financial markets, the visible order book is an optical illusion. In major Indian equity and derivatives markets (NSE & BSE), institutional players—Foreign Institutional Investors (FIIs), Domestic Mutual Funds (DIIs), proprietary trading desks, and High-Frequency Trading (HFT) algorithms—rarely post plain vanilla limit orders when executing large block quantities:
1. **The "Tip of the Iceberg" Problem:** An institution wishing to accumulate 2,00,000 shares of RELIANCE or 10,000 lots of NIFTY does not place a single limit order on the book. Doing so would cause immediate adverse market impact and price runaway. Instead, they use **Exchange-Native or Broker Iceberg Orders**, revealing only a fraction (e.g. 5,000 shares) in the visible Level-2 Depth of Market (DOM). As each slice is filled, the exchange automatically reloads the visible rung from an undisclosed hidden pool. Retail traders watching standard Level-2 DOM see a tiny 5,000-share bid and short into what is actually an immovable institutional wall.
2. **Level-2 (L2) vs. Level-3 (L3 / Market-By-Order) Disparity:** Standard retail platforms only display Level-2 aggregated 5-bid / 5-ask snapshots. They lack individual order queue position, order replenishment latency signatures, and cancel/replace event frequencies. Institutional firms operating at co-location consume **Level-3 Market-By-Order (MBO) feeds**, giving them millisecond insight into order book queue dynamics.
3. **Dark Liquidity, Block Deals & Internalized Crosses in India:** Under SEBI frameworks, large institutional trades take place either in dedicated **Block Deal Windows** (minimum order value ₹10 Crore) or as high-volume liquidity sweeps that cross on exchange matching engines without resting on visible rungs. Retail traders are blind to these institutional footprints until the end-of-day reports are published hours later.
4. **Lack of Order Flow Toxicity & Micro-Price Analytics:** Traditional technical indicators (RSI, Moving Averages) are lagging price derivatives. They fail to measure real-time microstructure signals such as **Micro-Price ($\mathcal{P}_{\text{micro}}$)** and **Volume-Synchronized Probability of Toxicity (VPIN)**, which forecast immediate directional price breaks by measuring aggressive order flow imbalance.

### 1.2 The TradeCraft AI Solution: Level-3 Order Book & Institutional Flow Tracker
**Sprint 15** introduces an institutional **Real-Time Level-3 Order Book Analytics, Iceberg Detector & Dark Pool Volume Tracker**:
- **Algorithmic Iceberg Order Detector:**
  - Identifies hidden institutional liquidity by comparing cumulative executed volume against visible resting book depth at specific price rungs.
  - Detects replenishment latency signatures ($\Delta t < 50\text{ms}$) and estimates total hidden quantity ($\hat{Q}_{\text{hidden}}$) and exhaustion percentages.
- **Level-3 Market-By-Order (MBO) Queue Visualization:**
  - Simulates individual order queues across price rungs, tracking order arrivals, modifications, cancellations, and queue priorities.
- **Micro-Price & Multi-Depth Order Book Imbalance (OBI):**
  - Computes continuous volume-weighted Micro-Price ($\mathcal{P}_{\text{micro}}$) to forecast short-term queue clearing and spread transitions.
  - Measures 5-rung, 10-rung, and 20-rung Order Book Imbalances ($I_{\text{depth}}$) to detect predatory institutional spoofing vs. genuine liquidity walls.
- **Volume-Synchronized Probability of Toxicity (VPIN):**
  - Implements the Easley-López de Prado VPIN metric, clustering trades into volume buckets to calculate high-frequency informed trading toxicity.
- **Institutional Dark Pool & Block Deal Window Tracker:**
  - Real-time simulation of SEBI Block Deal Window trades (Morning 8:45–9:00 AM & Afternoon 2:05–2:20 PM IST, $\ge ₹10 \text{ Cr}$), bulk liquidity sweeps, and internalized crosses.
- **1-Click "Ride Institutional Flow" Execution:**
  - Seamlessly links detected institutional icebergs and block sweeps to the paper trading portfolio (`tradingEngine.ts`) with immediate cryptographic attestation (`proofEngine.ts`).

---

## 2. Institutional Architecture & Processing Topography

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SIMULATED LEVEL-3 MBO TICK & TRADE STREAM                   │
│   (Individual Orders: Add, Modify, Cancel, Fill with Microsecond Timestamps)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 src/lib/orderBookL3Engine.ts (Core Engine)                  │
│  1. Maintain Full Depth L3 Queue & L2 Aggregated Price Ladder               │
│  2. Compute Micro-Price P_micro and Multi-Depth Imbalance (5, 10, 20 Rungs) │
│  3. Calculate Volume-Synchronized Probability of Toxicity (VPIN)            │
│  4. Run Statistical Iceberg Detection Algorithm (Volume vs Depth & Latency) │
│  5. Filter Large Institutional Block Deals (>= ₹10 Cr) & Bulk Sweeps        │
└──────────────────┬──────────────────────────────────────┬───────────────────┘
                   │                                      │
                   ▼                                      ▼
┌──────────────────────────────────────┐┌──────────────────────────────────────┐
│        Iceberg Detection Radar       ││   Microstructure Toxicity & OBI      │
│  - Active Icebergs (Price, Side, Qty)││  - Micro-Price Deviation vs Mid      │
│  - Reload Multiplier & Hidden Size   ││  - Multi-Depth Imbalance (-1 to +1)  │
│  - Exhaustion Progress Gauge         ││  - VPIN Informed Flow Toxicity Meter │
└──────────────────┬───────────────────┘└──────────────────┬───────────────────┘
                   │                                       │
                   └───────────────────┬───────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 src/components/OrderBookL3Modal.tsx                         │
│  - Visual 10-Rung Level-3 Queue Ladder with Animated Iceberg Badges         │
│  - Institutional Block Deals & Dark Pool Feed Stream (₹ Value, FII/DII)     │
│  - Real-Time VPIN Toxicity Gauge & Micro-Price Indicator                    │
│  - 1-Click "Ride Institutional Flow" Paper Order Dispatch                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Formulations & Microstructure Algorithms

### 3.1 Algorithmic Iceberg Order Detection Model

An Iceberg Order at price rung $P^*$ maintains a visible displayed size $Q_{\text{vis}}$ while possessing an undisclosed total size $Q_{\text{tot}} \gg Q_{\text{vis}}$.

#### 1. Cumulative Fill vs. Visible Depth Ratio
Let $V_{\text{cum}}(P^*, \Delta T)$ be the cumulative traded volume executed at price $P^*$ over a monitoring time window $\Delta T$ without the market moving away from $P^*$:

$$\text{Reload Factor } N_{\text{reload}}(P^*) = \frac{V_{\text{cum}}(P^*, \Delta T)}{Q_{\text{vis}}(P^*)}$$

**Detection Condition:**
$$\text{If } N_{\text{reload}}(P^*) \ge 2.0 \implies \textbf{Iceberg Detected at Price } P^*$$

#### 2. Replenishment Latency Signature
When $Q_{\text{vis}}$ is exhausted, the exchange matching engine or broker algorithm reloads the visible quantity within a distinct latency signature $\tau_{\text{reload}}$:
$$\tau_{\text{reload}} = t_{\text{new\_order}} - t_{\text{prior\_fill}} < 45 \text{ ms}$$
The presence of sub-50ms replenishments at identical price rungs differentiates algorithmic iceberg reloading from retail discretionary order entry.

#### 3. Total & Hidden Quantity Estimation
The total order size $\hat{Q}_{\text{tot}}$ is estimated via parametric geometric sequence regression:
$$\hat{Q}_{\text{tot}} = V_{\text{cum}}(P^*) \times \left(1 + \frac{1}{\ln(N_{\text{reload}} + 1)}\right)$$
$$\hat{Q}_{\text{hidden}} = \max\left(0, \, \hat{Q}_{\text{tot}} - V_{\text{cum}}(P^*)\right)$$
$$\text{Exhaustion Pct} = \min\left(100\%, \, \frac{V_{\text{cum}}(P^*)}{\hat{Q}_{\text{tot}}} \times 100\right)$$

---

### 3.2 Volume-Weighted Micro-Price ($\mathcal{P}_{\text{micro}}$)

In standard pricing, the Mid-Price is simply $\frac{P_{\text{bid}} + P_{\text{ask}}}{2}$, which completely ignores queue sizes. The **Micro-Price** incorporates queue depth pressure:

$$\mathcal{P}_{\text{micro}} = \frac{Q_{\text{bid}, 1} \cdot P_{\text{ask}, 1} + Q_{\text{ask}, 1} \cdot P_{\text{bid}, 1}}{Q_{\text{bid}, 1} + Q_{\text{ask}, 1}}$$

#### Micro-Price Spread Deviation:
$$\Delta_{\text{micro}} = \mathcal{P}_{\text{micro}} - P_{\text{mid}}$$
- $\Delta_{\text{micro}} > 0$: Heavy bid queue pressure; high probability of ask side clearing (Bullish short-term tick momentum).
- $\Delta_{\text{micro}} < 0$: Heavy ask queue pressure; high probability of bid side clearing (Bearish short-term tick momentum).

---

### 3.3 Multi-Depth Order Book Imbalance (OBI)
For $K$ price levels ($K \in \{5, 10, 20\}$):

$$I_{\text{depth}}(K) = \frac{\sum_{k=1}^K Q_{\text{bid}, k} - \sum_{k=1}^K Q_{\text{ask}, k}}{\sum_{k=1}^K Q_{\text{bid}, k} + \sum_{k=1}^K Q_{\text{ask}, k}} \in [-1.0, +1.0]$$

#### Weighted Decay Imbalance:
To prioritize top-of-book liquidity over far-out spoofed rungs:
$$I_{\text{weighted}} = \frac{\sum_{k=1}^K \frac{Q_{\text{bid}, k}}{k} - \sum_{k=1}^K \frac{Q_{\text{ask}, k}}{k}}{\sum_{k=1}^K \frac{Q_{\text{bid}, k}}{k} + \sum_{k=1}^K \frac{Q_{\text{ask}, k}}{k}}$$

---

### 3.4 Volume-Synchronized Probability of Toxicity (VPIN)

The VPIN metric (Easley, López de Prado, O'Hara, 2012) measures informed institutional order flow toxicity:
1. Divide continuous trading volume into equal-sized volume buckets of size $V_{\text{bucket}}$ (e.g. $V_{\text{bucket}} = \frac{\text{ADV}}{50}$).
2. Each trade is classified into Buyer-Initiated ($V_\tau^B$) or Seller-Initiated ($V_\tau^S$) via the tick test / Lee-Ready algorithm:
   $$V_\tau^B = \sum_{i \in \tau} Q_i \cdot \Phi\left(\frac{P_i - P_{i-1}}{\sigma_{\Delta P}}\right), \quad V_\tau^S = V_{\text{bucket}} - V_\tau^B$$
3. Across a rolling window of $N = 50$ volume buckets:
   $$\text{VPIN} = \frac{\sum_{\tau=1}^N \vert V_\tau^B - V_\tau^S \vert}{N \cdot V_{\text{bucket}}} \in [0.0, 1.0]$$

#### Toxicity Thresholds:
- $\text{VPIN} \le 0.35$: **Low Toxicity (Calm Liquidity)** — Market makers quoting tight spreads.
- $0.35 < \text{VPIN} \le 0.60$: **Moderate Toxicity** — Balanced institutional positioning.
- $\text{VPIN} > 0.60$: **High Toxicity (Informed Sweep)** — Predatory institutional accumulation/dumping; high risk of sharp directional price expansion or liquidity flash crash.

---

### 3.5 Institutional Dark Pool & Block Deal Window Tracking

In accordance with SEBI circulars (SEBI/HO/MRD/DSA/CIR/P/2017/117):
1. **SEBI Block Deal Window:**
   - Minimum trade value: **₹10.0 Crore ($100 \text{ Million INR}$)**.
   - Price band: Within $\pm 1.0\%$ of ruling market price.
   - Sessions: Morning (8:45 AM – 9:00 AM) and Afternoon (2:05 PM – 2:20 PM IST).
2. **Bulk Liquidity Sweeps:**
   - Trades exceeding $0.5\%$ of total outstanding equity or value $\ge ₹2.0 \text{ Crore}$ that sweep across multiple rungs within $< 100\text{ms}$.
3. **Internalized Crosses ("Dark" Matches):**
   - Trades executing at exact mid-price ($P = P_{\text{mid}}$) between bid/ask without reducing resting visible depth.

---

## 4. UI Architecture & Interactive Components

### 4.1 Component Breakdown

1. **`src/types/orderBookL3.ts`:**
   - Type definitions for `L3OrderQueueItem`, `L2Rung`, `IcebergDetected`, `MicrostructureMetrics`, `BlockDealPrint`, and `VPINBucket`.
2. **`src/lib/orderBookL3Engine.ts` (Core Engine):**
   - Full 10-rung L3 queue generator with simulated add/modify/cancel events.
   - Statistical iceberg detector and reload tracker.
   - Micro-price and multi-depth imbalance calculators.
   - VPIN toxicity bucket aggregator.
   - Block deal and dark liquidity sweep classifier.
3. **`src/components/OrderBookL3Modal.tsx` (Interactive Studio UI):**
   - **Level-3 Order Book Depth Ladder:**
     - Top 10 Bids and Top 10 Asks with visual volume depth bars.
     - Individual queue order counts ($N_{\text{orders}}$) and queue length.
     - **Pulsing Cyan/Emerald Iceberg Badge** on price rungs where an institutional iceberg is actively reloading.
   - **Active Icebergs Radar:**
     - Table of detected icebergs: Ticker, Price, Side, Displayed vs Executed volume, Reload Factor, Estimated Hidden Quantity, and Exhaustion Progress Bar.
     - 1-Click **"Front-Run Institutional Iceberg"** button routing an order 1 tick ahead.
   - **Microstructure Gauges Bar:**
     - Visual dial for **Micro-Price** deviation ($\Delta_{\text{micro}}$).
     - **Multi-Depth Order Book Imbalance (OBI)** gauge (5, 10, 20 rungs).
     - **VPIN Flow Toxicity Meter** with alert state (`CALM`, `MODERATE`, `TOXIC_SWEEP`).
   - **Institutional Block & Dark Pool Feed Table:**
     - Live streaming feed of Block Deals ($\ge ₹10 \text{ Cr}$), Bulk Sweeps, and Internalized Crosses.
     - Institutional buyer/seller tags (`FII_DOMESTIC`, `DII_MUTUAL_FUND`, `PROP_DESK`).
4. **Header Navigation & Terminal Binding:**
   - Dedicated **"🧊 L3 Iceberg"** navigation button in `src/components/Header.tsx` with live detected iceberg counter badge.

---

## 5. Data Flow & Entity Specifications

```
┌─────────────────────────────────────────────────────────────┐
│                 Live Tick & Trade Stream Feed               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 orderBookL3Engine.ts                        │
│  - Update 10-Rung Level-3 Queue & Compute Aggregated Depth  │
│  - Calculate Micro-Price P_micro & Imbalance I_depth(10)    │
│  - Check Iceberg Condition: Volume / Visible >= 2.0         │
│  - Update VPIN Buckets & Classify Block Deals (>= ₹10 Cr)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│   Level-3 Depth Ladder UI     │   │ Institutional Block Feed  │
│ - 10 Bids / 10 Asks Volumes   │   │ - Filter >= ₹10 Cr Deals  │
│ - Active Iceberg Glow Badges  │   │ - FII / DII Institutional │
│ - Micro-Price & VPIN Meters   │   │ - Internalized Crosses    │
└───────────────────────────────┘   └─────────────┬─────────────┘
                                                  │
                                                  ▼
                                    ┌───────────────────────────┐
                                    │ Route to Paper Portfolio  │
                                    │ + Proof-of-Alpha Receipt  │
                                    └───────────────────────────┘
```

### 5.1 TypeScript Interfaces (`src/types/orderBookL3.ts`)
```typescript
export interface L3OrderQueueItem {
  orderId: string;
  price: number;
  quantity: number;
  timestamp: number;
  side: 'BUY' | 'SELL';
  queuePosition: number;
}

export interface L2DepthRung {
  price: number;
  quantity: number;
  orderCount: number;
  depthPct: number;
  isIceberg: boolean;
  icebergDetails?: IcebergDetected;
}

export interface IcebergDetected {
  id: string;
  symbol: string;
  price: number;
  side: 'BUY' | 'SELL';
  visibleQuantity: number;
  executedQuantity: number;
  estimatedHiddenQuantity: number;
  estimatedTotalQuantity: number;
  reloadFactor: number;
  exhaustionPct: number;
  replenishmentLatencyMs: number;
  detectedAt: number;
  lastReloadAt: number;
  status: 'ACTIVE' | 'EXHAUSTED' | 'CANCELLED';
}

export interface MicrostructureMetrics {
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  microPrice: number;
  spread: number;
  spreadBps: number;
  imbalanceDepth5: number;   // -1.0 to +1.0
  imbalanceDepth10: number;  // -1.0 to +1.0
  imbalanceWeighted: number; // -1.0 to +1.0
  vpinToxicity: number;      // 0.0 to 1.0
  vpinStatus: 'CALM' | 'MODERATE' | 'TOXIC_SWEEP';
}

export interface BlockDealPrint {
  id: string;
  symbol: string;
  timestamp: number;
  price: number;
  quantity: number;
  valueCrores: number;
  type: 'SEBI_BLOCK_WINDOW' | 'BULK_LIQUIDITY_SWEEP' | 'INTERNALIZED_DARK_CROSS';
  buyerType: 'FII' | 'DII' | 'PROP_DESK' | 'RETAIL';
  sellerType: 'FII' | 'DII' | 'PROP_DESK' | 'RETAIL';
  premiumDiscountPct: number;
}
```

---

## 6. Regulatory & Compliance Standards (SEBI Framework)

1. **SEBI Block Deal Window Rules (Circular SEBI/HO/MRD/DSA/CIR/P/2017/117):**
   - Accurately models the mandatory ₹10 Crore threshold and $\pm 1\%$ price collar.
2. **Clear Educational Simulation Disclaimer:**
   In compliance with SEBI advertising codes and regulations:
   > *"Institutional Simulation Notice: The Level-3 Order Book Analytics, Iceberg Detector, and Institutional Dark Pool Volume Tracker is an educational simulation environment modeling market microstructure, high-frequency order book queues, and SEBI block deal flows. All detected icebergs, block prints, and VPIN toxicity metrics are simulated for quantitative learning purposes. No real capital is traded."*
3. **Zero-Knowledge Privacy:**
   All queue calculations, iceberg statistical inference, and microstructure metrics run 100% locally in browser memory without external tracking.

---

## 7. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-L3-01** | Level-3 Engine maintains a valid 10-rung bid/ask book where bids are strictly descending and asks are strictly ascending with positive spread ($P_{\text{ask}} > P_{\text{bid}}$). | Automated unit test (`test/orderBookL3Engine.test.mjs`) verifying ladder ordering. |
| **AC-L3-02** | Iceberg Detection Algorithm flags an active iceberg when $V_{\text{cum}} / Q_{\text{vis}} \ge 2.0$ and replenishment latency $< 50\text{ms}$. | Unit test verifying iceberg identification under simulated repetitive fills. |
| **AC-L3-03** | Volume-Weighted Micro-Price ($\mathcal{P}_{\text{micro}}$) correctly weights queue sizes and deviates above mid-price when bid depth exceeds ask depth. | Unit test verifying mathematical bounds and directional skew. |
| **AC-L3-04** | VPIN Toxicity model correctly segments volume buckets and calculates toxicity in $[0.0, 1.0]$, transitioning to `TOXIC_SWEEP` when $> 0.60$. | Unit test verifying VPIN calculation under asymmetric order flow. |
| **AC-L3-05** | Block Deal tracker classifies trades with value $\ge ₹10 \text{ Cr}$ as `SEBI_BLOCK_WINDOW` and trades exceeding 5x average size as `BULK_LIQUIDITY_SWEEP`. | Unit test verifying threshold categorization. |
| **AC-L3-06** | Interactive Order Book L3 modal renders the 10-rung queue ladder, pulsing iceberg badges, block deals feed, and executes 1-click paper orders into `tradingEngine.ts`. | UI component rendering test and user workflow verification. |

---

## 8. Summary & Next Steps
**BRD-015** equips retail and quantitative traders with the microstructure visibility previously restricted to co-located HFT firms and institutional desks. By exposing hidden iceberg orders, computing the volume-weighted Micro-Price, tracking SEBI block deal prints, and monitoring VPIN order flow toxicity, TradeCraft AI democratizes institutional order flow analytics.

Upon approval, this document will be indexed in `docs/brds/README.md` and handed over to the Scrum Master Agent for task decomposition in `docs/backlog.md`.
