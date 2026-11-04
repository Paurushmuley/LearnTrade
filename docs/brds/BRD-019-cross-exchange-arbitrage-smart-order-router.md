# Business Requirements Document (BRD)
## TradeCraft AI — Cross-Exchange Arbitrage & Latency-Aware Smart Order Router (SOR) for NSE vs BSE Inter-Market Arbitrage

- **Document ID:** `BRD-019-CROSS-EXCHANGE-SOR-ARBITRAGE`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 19 (Inter-Market Arbitrage & Smart Order Routing Suite)
- **Dependencies:** 
  - Sprint 1 (`tradingEngine.ts` — Paper Trading Portfolio, `taxEngine.ts` — Indian Statutory Taxes & Brokerage)
  - Sprint 4 (`replayEngine.ts` — Level-2 Market Depth DOM Ladder)
  - Sprint 11 (`quantDeskEngine.ts` — Autonomous AI Quant Hedge Fund Desk)
  - Sprint 15 (`microstructureEngine.ts` — Level-3 Order Book & Queue Mechanics)
  - Sprint 16 (`statArbEngine.ts` — Cointegration Pairs & Multi-Leg Sizing)
  - Sprint 17 (`executionEngine.ts` — Almgren-Chriss Liquidity & Slippage Minimizer)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Dual-Exchange Fragmentation of Indian Capital Markets
The Indian equity market is unique in featuring two tier-1 national exchanges operating in parallel under a unified regulatory framework established by the Securities and Exchange Board of India (SEBI):
1. **National Stock Exchange of India (NSE):** The primary liquidity hub globally for equity derivatives and high-turnover blue-chip cash equities, operating via its matching engines located in Bandra-Kurla Complex (BKC), Mumbai.
2. **Bombay Stock Exchange (BSE):** Asia's oldest stock exchange, situated at Dalal Street (Fort) with data centers in BKC and Fort, commanding massive listing diversity and rapidly expanding derivatives volume (Sensex and Bankex contracts).

Most prominent Indian equities—including NIFTY 50 and SENSEX constituents (e.g. RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, LT, TATAMOTORS)—trade simultaneously on both exchanges with identical ISIN identification codes.

### 1.2 The Fragmentation Inefficiency: Spread Discrepancies & Execution Drag
Retail traders, sub-scale proprietary desks, and standard broker front-ends route orders to a single hardcoded exchange (typically NSE by default). This single-venue bias causes substantial structural inefficiency:
1. **Uncaptured Cross-Market Arbitrage Spreads:**
   Temporary micro-bursts of asynchronous order arrival cause the bid price on one exchange to cross above the ask price on the other ($\text{Bid}_{\text{BSE}} > \text{Ask}_{\text{NSE}}$ or $\text{Bid}_{\text{NSE}} > \text{Ask}_{\text{BSE}}$). In high-frequency environments, these "crossed markets" represent pure statistical riskless arbitrage, which remains unharvested by retail participants.
2. **Sub-Optimal Execution (Missing NBBO):**
   Unlike the United States market governed by Regulation NMS (National Market System) requiring mandatory order routing to the National Best Bid and Offer (NBBO), **Indian regulations do not enforce a broker-level NBBO mandate**. Consequently, a trader buying RELIANCE on NSE at ₹2,950.40 may unknowingly forfeit a resting offer on BSE at ₹2,949.80, suffering direct unforced slippage.
3. **Exchange Fee Asymmetry:**
   NSE and BSE enforce differing transaction charge tiers (turnover fees, clearing fees, liquidity incentive schemes). A gross spread advantage of ₹0.15 can easily turn negative once exchange-specific transaction levies, Clearing Corporation fees (NCL vs ICCL), SEBI turnover fees, Stamp Duty, and 18% GST are calculated.
4. **Execution Latency & Legging Risk:**
   Cross-exchange arbitrage requires simultaneous execution across two physically disparate matching engines. If Leg 1 fills on NSE but Leg 2 on BSE is front-run or canceled due to network jitter or race conditions, the trader is left with unwanted directional exposure ("Legging Risk"). Without algorithmic latency modeling and automated bailout logic, inter-market arbitrageurs incur devastating unhedged losses.

### 1.3 The TradeCraft AI Solution: Cross-Exchange SOR & Arbitrage Engine
**Sprint 19** engineers an institutional **Cross-Exchange Arbitrage & Latency-Aware Smart Order Router (SOR)**:
1. **Real-Time Cross-Exchange Arbitrage Scanner:**
   - Ingests dual Level-2 market depth feeds for NSE and BSE simultaneously.
   - Detects crossed market conditions ($\text{Spread}_{\text{gross}} = \text{Bid}_A - \text{Ask}_B > 0$) across Indian equities in real-time.
   - Applies institutional fee-deduction logic (incorporating SEBI interoperability clearing rules) to identify **Net Profitable Arbitrage Opportunities** ($\text{Spread}_{\text{net}} > 0$).
2. **Latency-Aware Race Condition & Fill Probability Model:**
   - Models network propagation delay, co-location cross-connect latency ($\tau_{\text{link}}$), broker API overhead, and exchange matching engine queue delays ($\tau_{\text{engine}} \sim \text{LogNormal}$).
   - Computes probability of winning the execution race against competing HFTs:
     $$P(\text{Fill} \mid \tau) = \exp(-\lambda_{\text{sweep}} \cdot \tau)$$
   - Simulates queue slippage, partial fills, and unhedge probability.
3. **Smart Order Router (SOR) with Indian NBBO:**
   - Synthesizes a virtual **Indian National Best Bid and Offer (INBBO)**:
     $$\text{INBBO}_{\text{Bid}} = \max(\text{Bid}_{\text{NSE}}, \text{Bid}_{\text{BSE}}), \quad \text{INBBO}_{\text{Ask}} = \min(\text{Ask}_{\text{NSE}}, \text{Ask}_{\text{BSE}})$$
   - Employs configurable routing policies:
     - `BEST_PRICE_NBBO`: Pure price improvement routing.
     - `FEE_ADJUSTED_NET_YIELD`: Optimizes net fill price after exchange turnover differentials.
     - `SPLIT_SWEEP_ROUTING`: Slices parent orders across both order books to maximize fill rate and minimize total market impact.
4. **Two-Leg Atomic Arbitrage Execution & Legging Bailout Circuit Breakers:**
   - Dispatches coupled Immediate-or-Cancel (IOC) orders.
   - Implements automated microsecond bailout: If Leg 1 fills and Leg 2 is rejected or partially filled, the engine instantly unwinds or pegs the unmatched residual inventory to cap downside variance.
5. **Interactive Cross-Exchange Studio (`CrossExchangeSORModal.tsx`):**
   - Side-by-side synchronized Level-2 DOM ladder comparing NSE vs BSE depth.
   - Real-time Arbitrage Radar displaying live crossed spreads, bps edge, and fee friction.
   - Latency & Race Condition Simulation workbench with adjustable RTT and jitter sliders.
   - 1-Click Smart Order Execution comparing benchmark single-exchange fill vs SOR execution savings.

---

## 2. Institutional Architecture & Processing Topography

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DUAL-EXCHANGE MARKET DATA FEED INGESTION                        │
│            NSE Level-2 Market Depth                BSE Level-2 Market Depth            │
│       (Bids, Asks, Sizes, Tick Timestamps)    (Bids, Asks, Sizes, Tick Timestamps)     │
└───────────────────┬───────────────────────────────────┬────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               src/lib/sorEngine.ts                                     │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   1. Indian National Best Bid & Offer (INBBO) Aggregator                         │  │
│  │   - Unified Synthetic Book: Best Bid = max(Bid_NSE, Bid_BSE)                     │  │
│  │   - Best Offer = min(Ask_NSE, Ask_BSE)                                           │  │
│  │   - Consolidated Dual-Book Depth Queue Alignment                                 │  │
│  └───────────────────────────────────┬──────────────────────────────────────────────┘  │
│                                      │                                                 │
│                                      ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   2. Cross-Exchange Arbitrage Detector & Fee Friction Netting                    │  │
│  │   - Cross Condition: (Bid_BSE > Ask_NSE) OR (Bid_NSE > Ask_BSE)                  │  │
│  │   - Deduct NSE Turnover (0.00297%) vs BSE Turnover (0.00375%)                    │  │
│  │   - SEBI Interoperability Clearing Fees (NCL / ICCL)                             │  │
│  │   - Statutory STT, Stamp Duty, GST Friction Netting                              │  │
│  │   - Net Alpha Spread: Spread_net = Spread_gross - Fee_total                      │  │
│  └──────────────────┬───────────────────────────────────────┬───────────────────────┘  │
│                     │                                       │                          │
│                     ▼                                       ▼                          │
│  ┌─────────────────────────────────────┐ ┌──────────────────────────────────────────┐  │
│  │   3. Latency & Race Modeling        │ │   4. Smart Order Routing (SOR) Engine    │  │
│  │   - Network Propagation Delay (RTT) │ │   - Policy A: Pure INBBO Price Priority  │  │
│  │   - Matching Engine Jitter (LogNorm)│ │   - Policy B: Net-Fee Adjusted Routing   │  │
│  │   - Fill Probability: exp(-lambda*t)│ │   - Policy C: Dual-Book Split Sweep      │  │
│  │   - Legging Risk & Desync Forecaster│ │   - Policy D: Atomic 2-Leg Arbitrage     │  │
│  └──────────────────┬──────────────────┘ └──────────────────┬───────────────────────┘  │
│                     │                                       │                          │
│                     └───────────────────┬───────────────────┘                          │
│                                         │                                              │
│                                         ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   5. Execution Safeguards & Legging Bailout Manager                              │  │
│  │   - Coupled IOC Order Dispatch                                                   │  │
│  │   - Leg-1 Fill / Leg-2 Failure Circuit Breaker                                   │  │
│  │   - Automated Fast-Market Bailout / Inventory Unwind                             │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION WITH TRADECRAFT AI ENGINES                          │
│                                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐ │
│  │ taxEngine.ts            │  │ tradingEngine.ts        │  │ microstructureEngine.ts │ │
│  │ - Accurate NSE vs BSE   │  │ - Multi-venue positions │  │ - Queue position        │ │
│  │   transaction tariffs   │  │ - Interoperable ledger  │  │ - Matching engine ticks │ │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘ │
│                                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐ │
│  │ executionEngine.ts      │  │ quantDeskEngine.ts      │  │ proofEngine.ts          │ │
│  │ - Almgren-Chriss parent │  │ - Multi-venue routing   │  │ - Cross-market arb hash │ │
│  │   slicing into SOR      │  │   strategy decisions    │  │ - Verifiable trade proof│ │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘ │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   src/components/CrossExchangeSORModal.tsx                             │
│  - Dual-Exchange Synchronized Level-2 DOM Ladder (NSE vs BSE Depth)                    │
│  - Real-Time Arbitrage Radar HUD with Crossed Spread Alerts & bps Edge Gauge           │
│  - Latency Calibration Workbench (RTT, Engine Jitter, Fill Probability Decay Curve)   │
│  - SOR Execution Benchmarking Tool (Single-Exchange vs SOR Cost Savings)              │
│  - 1-Click Atomic Arbitrage & Split-Order Router Simulator                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Formulations & Quantitative Microstructure Models

### 3.1 Dual-Exchange Cross-Market Arbitrage Mechanics

Let $S$ be a dual-listed equity (e.g. RELIANCE). The simultaneous top-of-book quotes are:
- $\text{NSE: } (\text{Bid}_{\text{NSE}}, Q_{\text{bid}}^{\text{NSE}}), \; (\text{Ask}_{\text{NSE}}, Q_{\text{ask}}^{\text{NSE}})$
- $\text{BSE: } (\text{Bid}_{\text{BSE}}, Q_{\text{bid}}^{\text{BSE}}), \; (\text{Ask}_{\text{BSE}}, Q_{\text{ask}}^{\text{BSE}})$

#### 3.1.1 Cross-Market Condition & Gross Arbitrage Spread
A cross-exchange arbitrage condition occurs when the bid on one exchange exceeds the ask on the other:
$$\text{Scenario A (Buy NSE, Sell BSE):} \quad \Delta P_{\text{gross}}^{(A)} = \text{Bid}_{\text{BSE}} - \text{Ask}_{\text{NSE}} > 0$$
$$\text{Scenario B (Buy BSE, Sell NSE):} \quad \Delta P_{\text{gross}}^{(B)} = \text{Bid}_{\text{NSE}} - \text{Ask}_{\text{BSE}} > 0$$

The maximum executable arbitrage quantity without walking the book is:
$$Q_{\text{arb}} = \min\left( Q_{\text{ask}}^{\text{buy\_venue}}, \; Q_{\text{bid}}^{\text{sell\_venue}} \right)$$

#### 3.1.2 Net Arbitrage Spread with Institutional Fee Differentials
Under SEBI Interoperability regulations, clearing can occur through either NCL (NSE Clearing Limited) or ICCL (Indian Clearing Corporation Limited), standardizing settlement. However, transaction levies differ:
$$\text{Cost}_{\text{buy}} = P_{\text{buy}} \cdot Q \cdot \left( f_{\text{trans}}^{\text{buy\_venue}} + f_{\text{sebi}} + f_{\text{stamp}} \right) + \text{Brokerage}_{\text{buy}} + \text{GST}_{\text{buy}}$$
$$\text{Cost}_{\text{sell}} = P_{\text{sell}} \cdot Q \cdot \left( f_{\text{trans}}^{\text{sell\_venue}} + f_{\text{sebi}} + f_{\text{stt}} \right) + \text{Brokerage}_{\text{sell}} + \text{GST}_{\text{sell}}$$
Where:
- $f_{\text{trans}}^{\text{NSE}} = 0.00297\%$ (₹297 per crore for equity cash).
- $f_{\text{trans}}^{\text{BSE}} = 0.00375\%$ (₹375 per crore standard, or $0.00275\%$ during promotional rebate periods).
- $f_{\text{stt}} = 0.025\%$ on intraday equity cash sell side.
- $f_{\text{stamp}} = 0.003\%$ on intraday buy side.
- $f_{\text{sebi}} = 0.0001\%$ (₹10 per crore).
- $\text{GST} = 18\% \times (\text{Brokerage} + \text{Transaction} + \text{SEBI})$.

The **Net Arbitrage Profit**:
$$\Pi_{\text{net}} = \left( P_{\text{sell}} - P_{\text{buy}} \right) \cdot Q - \left( \text{Cost}_{\text{buy}} + \text{Cost}_{\text{sell}} \right)$$
$$\text{Net Spread (bps)} = \frac{\Pi_{\text{net}}}{P_{\text{buy}} \cdot Q} \times 10,000$$
The arbitrage execution trigger fires only if:
$$\Pi_{\text{net}} \ge \Theta_{\text{min\_hurdle}} \quad \text{and} \quad \text{Net Spread} \ge 1.5 \text{ bps}$$

---

### 3.2 Latency Modeling & Race Condition Fill Probability

In cross-exchange execution, orders must travel over physical network links and queue in matching engines.

#### 3.2.1 Component Latency Decomposition
The one-way execution latency to venue $v \in \{\text{NSE}, \text{BSE}\}$ is decomposed as:
$$\tau_v = \tau_{\text{client}\to\text{broker}} + \tau_{\text{broker}\to v}^{\text{transit}} + \tau_v^{\text{engine}}$$
- **Network Link Latency ($\tau^{\text{transit}}$):**
  For co-located servers, fiber propagation between BKC (NSE) and Fort (BSE) takes $\approx 180 \mu s - 320 \mu s$. For retail/cloud broker APIs, this latency is modeled between $5 \text{ ms}$ and $40 \text{ ms}$.
- **Matching Engine Queue Jitter ($\tau^{\text{engine}}$):**
  Modeled as a heavy-tailed log-normal distribution representing queue processing variations:
  $$\tau^{\text{engine}} \sim \text{LogNormal}(\mu_{\text{eng}}, \sigma_{\text{eng}}^2)$$

#### 3.2.2 The Latency Race & Fill Probability Model
While our arbitrage child order is in flight, competing HFT algorithms and regular directional market orders arrive at the exchange according to a Poisson process with intensity rate $\lambda_{\text{sweep}}$.
The probability that our order arrives before the resting liquidity is wiped out is:
$$P(\text{Fill} \mid \tau) = \exp\left( -\lambda_{\text{sweep}} \cdot \tau \right)$$
- If $\tau \to 0$, $P(\text{Fill}) \to 1.0$ (High certainty).
- If $\tau = 50 \text{ ms}$ under high volatility ($\lambda = 40 \text{ s}^{-1}$), $P(\text{Fill}) = e^{-0.05 \times 40} = e^{-2.0} \approx 13.5\%$.

#### 3.2.3 Two-Leg Joint Fill Probability & Legging Risk
Let $\tau_1$ and $\tau_2$ be the latencies to Leg 1 and Leg 2.
$$P(\text{Both Fill}) = P(\text{Fill}_1 \mid \tau_1) \cdot P(\text{Fill}_2 \mid \tau_2)$$
$$P(\text{Legging Failure}) = P(\text{Fill}_1) \cdot (1 - P(\text{Fill}_2)) + (1 - P(\text{Fill}_1)) \cdot P(\text{Fill}_2)$$
Legging failure creates an unhedged directional position exposed to adverse market drift:
$$\text{Expected Legging Cost} = E[\Delta P_{\text{adverse}}] = \sigma_{\text{asset}} \cdot \sqrt{\Delta \tau_{\text{bailout}}}$$

---

### 3.3 Smart Order Routing (SOR) Formulations

#### 3.3.1 Indian National Best Bid & Offer (INBBO)
$$\text{INBBO}_{\text{Bid}} = \max\left( \text{Bid}_{\text{NSE}}, \; \text{Bid}_{\text{BSE}} \right)$$
$$\text{INBBO}_{\text{Ask}} = \min\left( \text{Ask}_{\text{NSE}}, \; \text{Ask}_{\text{BSE}} \right)$$
$$\text{INBBO}_{\text{Spread}} = \text{INBBO}_{\text{Ask}} - \text{INBBO}_{\text{Bid}}$$
The INBBO spread is strictly less than or equal to the standalone exchange spreads:
$$\text{INBBO}_{\text{Spread}} \le \min\left( \text{Spread}_{\text{NSE}}, \; \text{Spread}_{\text{BSE}} \right)$$

#### 3.3.2 Split-Order Liquidity Sweep Allocation
When a parent order quantity $X_0$ exceeds the top-of-book depth on the best venue ($X_0 > Q_1$), the SOR splits the order across both books:
$$\min_{\substack{q_{\text{NSE}}, q_{\text{BSE}} \\ q_{\text{NSE}} + q_{\text{BSE}} = X_0}} \left[ \sum_{i=1}^{k} q_{\text{NSE}, i} \cdot P_{\text{NSE}, i}^{\text{eff}} + \sum_{j=1}^{m} q_{\text{BSE}, j} \cdot P_{\text{BSE}, j}^{\text{eff}} \right]$$
Where $P_{v, i}^{\text{eff}}$ is the effective price at depth level $i$ on venue $v$ inclusive of venue-specific transaction fees.

---

### 3.4 Automated Legging Bailout & Circuit Breaker Logic

If Leg 1 fills on Exchange A, but Leg 2 fails to execute on Exchange B within a maximum timeout $\Delta t_{\text{timeout}} = 150 \text{ ms}$:
1. **Immediate Cancel of Leg 2:** Withdraw any resting limit order on Exchange B.
2. **Dynamic Bailout Routing:**
   - **Bailout Mode 1 (Passive Peg):** If market drift is neutral, place a passive peg order on Leg 1 exchange to exit at breakeven.
   - **Bailout Mode 2 (Aggressive Market Sweep):** If adverse market movement exceeds $2.0 \text{ bps}$, immediately fire an aggressive market order to liquidate Leg 1 inventory, strictly capping the maximum loss at $\text{Loss}_{\text{cap}} = 0.05\%$.
3. **Arb Cooldown Breaker:** If 2 consecutive legging failures occur on a symbol, engage a 60-second execution cooldown on that ticker.

---

## 4. Dual-Exchange Fee Schedule Comparison (NSE vs BSE)

| Fee Component | NSE Cash Equity (Intraday) | BSE Cash Equity (Intraday) | Notes / Regulatory Basis |
| :--- | :--- | :--- | :--- |
| **Exchange Turnover Fee** | 0.00297% (₹297 / Cr) | 0.00375% (₹375 / Cr) | BSE offers fee cuts on select liquid groups |
| **Clearing Corporation Fee** | Interoperable (NCL / ICCL) | Interoperable (NCL / ICCL) | Mandated SEBI Interoperability |
| **Securities Transaction Tax (STT)**| 0.025% on Sell Turnover | 0.025% on Sell Turnover | Statutory Central Government Tax |
| **SEBI Turnover Charge** | 0.0001% (₹10 / Cr) | 0.0001% (₹10 / Cr) | Unified across all registered exchanges |
| **Stamp Duty** | 0.003% on Buy Turnover | 0.003% on Buy Turnover | Indian Stamp Act (uniform rate) |
| **Goods & Services Tax (GST)** | 18% on (Turnover + Brokerage + SEBI) | 18% on (Turnover + Brokerage + SEBI) | Statutory Central + State GST |

---

## 5. Algorithmic Engine Architecture (`sorEngine.ts`)

### 5.1 Core Types and Interfaces
```typescript
export type ExchangeVenue = 'NSE' | 'BSE';

export type SORRoutingPolicy = 
  | 'BEST_PRICE_NBBO'
  | 'FEE_ADJUSTED_NET_YIELD'
  | 'SPLIT_LIQUIDITY_SWEEP'
  | 'ATOMIC_ARBITRAGE';

export interface BookLevel {
  price: number;
  quantity: number;
  ordersCount: number;
}

export interface DualExchangeMarketDepth {
  symbol: string;
  timestamp: number;
  nse: {
    bids: BookLevel[];
    asks: BookLevel[];
    lastTradedPrice: number;
    volume: number;
  };
  bse: {
    bids: BookLevel[];
    asks: BookLevel[];
    lastTradedPrice: number;
    volume: number;
  };
}

export interface ArbitrageOpportunity {
  id: string;
  symbol: string;
  timestamp: number;
  buyVenue: ExchangeVenue;
  sellVenue: ExchangeVenue;
  buyPrice: number;
  sellPrice: number;
  maxQuantity: number;
  grossSpread: number; // sellPrice - buyPrice
  grossSpreadBps: number;
  estimatedBuyFees: number;
  estimatedSellFees: number;
  totalFees: number;
  netSpread: number; // grossSpread - feesPerUnit
  netSpreadBps: number;
  estimatedNetProfit: number;
  isProfitable: boolean;
  latencyWindowMs: number;
  fillProbability: number; // e.g. 0.88 (88%)
}

export interface SORRoutingDecision {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  totalQuantity: number;
  policy: SORRoutingPolicy;
  inbboBestBid: number;
  inbboBestAsk: number;
  inbboSpread: number;
  routingSplits: {
    venue: ExchangeVenue;
    targetPrice: number;
    quantity: number;
    expectedFees: number;
    effectivePrice: number;
  }[];
  standaloneNseCost: number;
  standaloneBseCost: number;
  sorExpectedCost: number;
  priceImprovementInr: number;
  priceImprovementBps: number;
}

export interface ExecutionRaceSimulation {
  latencyNseMs: number;
  latencyBseMs: number;
  networkJitterMs: number;
  engineDelayNseMs: number;
  engineDelayBseMs: number;
  leg1FillStatus: 'FILLED' | 'REJECTED' | 'EXPIRED';
  leg2FillStatus: 'FILLED' | 'REJECTED' | 'EXPIRED' | 'UNWOUND';
  leggingOccurred: boolean;
  bailoutPnlLoss: number;
  actualRealizedNetProfit: number;
}
```

### 5.2 Key Computational Methods in `sorEngine.ts`
1. `computeINBBO(depth: DualExchangeMarketDepth): { bestBid: number; bestAsk: number; bestBidVenue: ExchangeVenue; bestAskVenue: ExchangeVenue; spread: number }`
2. `calculateExchangeFees(venue: ExchangeVenue, side: 'BUY'|'SELL', price: number, quantity: number): number`
3. `scanArbitrageOpportunities(depth: DualExchangeMarketDepth): ArbitrageOpportunity | null`
4. `calculateFillProbability(latencyMs: number, volatilityBeta: number): number`
5. `routeSmartOrder(symbol: string, side: 'BUY'|'SELL', quantity: number, policy: SORRoutingPolicy, depth: DualExchangeMarketDepth): SORRoutingDecision`
6. `simulateTwoLegArbitrage(arb: ArbitrageOpportunity, latencyNseMs: number, latencyBseMs: number): ExecutionRaceSimulation`
7. `executeLeggingBailout(leg1Venue: ExchangeVenue, side: 'BUY'|'SELL', filledQty: number, entryPrice: number): { bailoutPrice: number; lossInr: number }`

---

## 6. UI Architecture & Interactive Studio (`CrossExchangeSORModal.tsx`)

The UI component `src/components/CrossExchangeSORModal.tsx` provides a visual institutional execution terminal:

1. **Top Header HUD & Arbitrage Radar Banner:**
   - Active INBBO Ticker: Displays live National Best Bid & Offer with flashing venue badges (`NSE` vs `BSE`).
   - Crossed Spread Alert Bar: Flashes vivid Green/Cyan when $\text{Bid}_A > \text{Ask}_B$, displaying gross spread, net spread after fees, and available arbitrage quantity.
   - Total Historical SOR Savings Counter: Displays accumulated rupees saved via TradeCraft AI Smart Order Routing over single-exchange routing.
2. **Synchronized Dual-Exchange Level-2 DOM Ladder:**
   - Side-by-side matching book display: Left column (NSE 5-depth Bids/Asks), Middle column (Price Axis), Right column (BSE 5-depth Bids/Asks).
   - Real-time highlight of crossed price levels in high-contrast cyan/crimson.
   - Cumulative volume bars on both sides visually indicating liquidity imbalances.
3. **Latency & Race Condition Calibration Workbench:**
   - Sliders to configure simulated infrastructure parameters:
     - Network RTT ($\tau_{\text{net}}$): $1 \text{ ms}$ (Co-location) to $50 \text{ ms}$ (Public Internet).
     - Matching Engine Queue Jitter ($\sigma_{\text{jitter}}$): $0.5 \text{ ms}$ to $15 \text{ ms}$.
     - Competing HFT Order Sweep Intensity ($\lambda_{\text{sweep}}$).
   - Live interactive curve plotting **Latency vs Fill Probability** decay.
4. **Smart Order Routing (SOR) Simulator & Cost Attribution:**
   - Policy Selector: `BEST_PRICE_NBBO`, `FEE_ADJUSTED_NET_YIELD`, `SPLIT_LIQUIDITY_SWEEP`, `ATOMIC_ARBITRAGE`.
   - Order Entry Ticket: Side (`BUY`/`SELL`), Quantity (e.g. 500, 2,000, 10,000 shares), Ticker selector (RELIANCE, HDFCBANK, INFY, TCS, ICICIBANK).
   - Execution Comparison Table:
     - Route 100% to NSE: Total Cost & Slippage.
     - Route 100% to BSE: Total Cost & Slippage.
     - **SOR Optimized Route:** Total Cost, Split Breakdown, and **Net Price Improvement (₹ and bps)**.
5. **Two-Leg Atomic Arbitrage Execution & Bailout Replay:**
   - 1-Click "Execute Inter-Market Arbitrage" button.
   - Live execution step visualizer:
     - `[00.0ms]` Firing Leg 1 Buy on NSE IOC...
     - `[12.4ms]` Leg 1 Filled @ ₹2,950.10 (500 shares)
     - `[14.1ms]` Firing Leg 2 Sell on BSE IOC...
     - `[26.8ms]` Leg 2 Filled @ ₹2,951.20 (500 shares)
     - `[27.0ms]` Arbitrage Realized: Gross +₹550, Fees -₹182, **Net Profit +₹368 (2.49 bps)**!
   - Toggle to simulate "Legging Out Race Failure" and witness automated fast-market bailout circuit breaker.

---

## 7. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-SOR-01** | **INBBO Synthetic Aggregation:** Router correctly computes INBBO Best Bid as $\max(\text{Bid}_{\text{NSE}}, \text{Bid}_{\text{BSE}})$ and Best Ask as $\min(\text{Ask}_{\text{NSE}}, \text{Ask}_{\text{BSE}})$, properly assigning source venue tags. | Unit test in `test/sorEngine.test.mjs`. |
| **AC-SOR-02** | **Cross-Exchange Arbitrage Detection:** Scanner flags crossed markets whenever $\text{Bid}_A > \text{Ask}_B$, calculating gross spread and max executable volume $\min(Q_{\text{bid}}, Q_{\text{ask}})$. | Unit test asserting crossed spread identification. |
| **AC-SOR-03** | **Exchange Fee Deductions:** Accurately calculates separate transaction fees for NSE (0.00297%) and BSE (0.00375%), including STT, SEBI turnover, stamp duty, and GST, ensuring unprofitable gross spreads are correctly rejected. | Unit test verifying net fee friction arithmetic. |
| **AC-SOR-04** | **Latency & Fill Probability Decay:** Fill probability calculation adheres to the exponential arrival model $P(\tau) = \exp(-\lambda \tau)$, showing monotonic decay with higher latency. | Unit test verifying parameter monotonicity. |
| **AC-SOR-05** | **Split-Order Sweep Logic:** When order size exceeds top level on best venue, SOR splits shares across both venues to minimize combined effective acquisition price. | Unit test verifying dual-book depth allocation. |
| **AC-SOR-06** | **Two-Leg Execution & Legging Bailout:** Simulated arbitrage correctly handles both joint fills and partial/failed Leg-2 scenarios, triggering automated bailout unwind. | Unit test verifying legging circuit breaker execution. |
| **AC-SOR-07** | **Portfolio Integration:** Executed arbitrage and smart order fills post correctly into `tradingEngine.ts` multi-venue balances and cash ledger. | Integration test verifying portfolio updates. |
| **AC-SOR-08** | **Interactive UI Component:** `CrossExchangeSORModal.tsx` renders dual DOM, arbitrage radar, latency sliders, and executes routing without runtime errors. | Component compilation and test suite verification. |

---

## 8. Non-Functional Requirements & Security Protocols

1. **Routing Engine Computational Latency:**
   - INBBO calculation and arbitrage opportunity detection across both books must complete in $< 1 \text{ ms}$ per tick.
   - Split-order routing optimization must execute in $< 3 \text{ ms}$.
2. **State Determinism & Ledger Consistency:**
   - Every multi-venue fill must maintain atomic cash and stock balance consistency across paper portfolios in `localStorage` under `tradecraft_sor_v1`.
3. **No-Self-Trade Prevention (STP):**
   - The engine must reject cross-exchange orders that would match against an existing open order owned by the same user account across venues.
4. **Resilience & Disconnected Venue Handling:**
   - If one exchange feed disconnects or reports stale ticks ($> 5 \text{ seconds}$ old), the SOR must smoothly fallback to single-venue best execution without throwing exceptions.
