# Business Requirements Document (BRD)
## TradeCraft AI — Institutional Trade Copier & Cross-Account Multi-Broker Execution Bridge

- **Document ID:** `BRD-012-TRADE-COPIER-MULTI-BROKER-BRIDGE`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 12 (Multi-Account Scaling & Cross-Broker Execution Suite)
- **Dependencies:** 
  - Sprint 1 (`taxEngine.ts` — Indian Statutory Broker Fees, `tradingEngine.ts` — Paper Portfolio)
  - Sprint 3 (`webhookEngine.ts` — Algorithmic Trade Ingestion)
  - Sprint 4 (`replayEngine.ts` — Level-2 Market Depth DOM)
  - Sprint 9 (`authService.ts` — User Accounts & Personas)
  - Sprint 10 (`proofEngine.ts` — Proof-of-Alpha Cryptographic Ledger)
  - Sprint 11 (`quantDeskEngine.ts` — Autonomous Quant Desk)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Industry Dilemma: Broker Fragmentation, Prop Scaling & Manual Copy Errors
In contemporary Indian and global trading, serious traders, quant funds, and prop firm participants rarely execute through a single isolated brokerage account:
1. **Prop Firm & Multi-Challenge Scaling:** Modern prop traders (FTMO, Topstep, FundedNext, and Indian proprietary desks) manage multiple funded accounts simultaneously (e.g., three ₹10 Lakh accounts rather than one ₹30 Lakh account to distribute evaluation risk). Manually placing identical orders across 3 to 10 web portals within seconds is humanly impossible and leads to severe execution lag, fat-finger errors, and blown challenges.
2. **Indian Broker API Fragmentation:** India's retail brokerage ecosystem is divided across multiple competing APIs:
   - **Zerodha Kite Connect:** High-throughput institutional API, ~45ms–120ms execution latency.
   - **Groww Trading API:** Retail mobile-first REST architecture, ~80ms–250ms latency.
   - **Upstox Pro API v2:** High-speed WebSocket/JSON protocol, ~60ms–180ms latency.
   Each broker imposes different rate limits, margin policies, API latency profiles, and order book matching queues.
3. **The "Copy-Trading" Education Gap:** Most retail traders do not understand **Latency Arbitrage**, **Slippage Erosion**, or **Asymmetric Capital Sizing**. A 20-paisa slippage across 5 slave accounts in a high-frequency options trade can turn a winning master strategy into a net-negative disaster once SEBI STT, turnover charges, and GST are deducted.
4. **The Regulatory Requirement (SEBI Mandates):** While public, unregistered social copy-trading is strictly regulated by SEBI, **Internal Multi-Account Management (MAM)** and algorithmic sub-account mirroring for personal risk diversification and accredited prop desks is a core institutional workflow. Traders need an authentic sandbox to master cross-broker risk management before deploying real API keys.

### 1.2 The TradeCraft AI Solution: Institutional Multi-Broker Trade Copier
**Sprint 12** introduces the **Institutional Trade Copier & Cross-Account Multi-Broker Execution Bridge**:
- **Master-to-Multi-Slave Architecture:** Execute trades in a Master Strategy Account (manual order, TradingView webhook, or Autonomous Quant Desk consensus) and have them mirrored in real-time to an array of configured Slave Accounts simulating **Zerodha Kite**, **Groww**, and **Upstox**.
- **Proportional Risk Sizing & Multiplier Engine:** Customizable allocation modes including **Equity-Proportional Sizing**, **Fixed Multiplier (0.25x to 3.0x)**, and **Risk Parity Sizing**, with strict rounding to valid Indian exchange lot sizes (NSE Nifty/BankNifty lots).
- **Realistic Broker Latency & Stochastic Slippage Simulator:** Models realistic network latency distributions ($\mathcal{N}(\mu, \sigma)$) and market impact slippage across broker endpoints.
- **Slippage Protection Guard (Max Price Deviation Breaker):** Automatically aborts slave trade execution if the market price moves beyond an allowable threshold (e.g., > 0.35%) before the slave order fills.
- **Synchronized Position & Exit Mirroring:** Partial exits, stop-loss adjustments, and trailing targets automatically synchronize across all active slave accounts.
- **Emergency Global Kill Switch:** Instantly cancels all open orders and liquidates all positions across ALL slave accounts with a single click.

---

## 2. Master-Slave Architecture & System Topography

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MASTER STRATEGY SIGNAL SOURCE                        │
│   (Manual Order Ticket / TradingView Webhook / Autonomous Quant Desk Fill)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            src/lib/tradeCopierEngine.ts (Core Copier & Bridge)              │
│  1. Ingest Master Order Event (Symbol, Side, Qty, Price, OrderType)         │
│  2. Iterate Active Slave Accounts                                           │
│  3. Calculate Proportional Allocation & Lot Rounding                        │
│  4. Verify Margin Sufficiency & Max Risk Caps                               │
│  5. Simulate Broker Network Latency & Stochastic Slippage                   │
│  6. Enforce Max Slippage Deviation Filter                                   │
└──────────────────┬───────────────────┬───────────────────┬──────────────────┘
                   │                   │                   │
                   ▼                   ▼                   ▼
        ┌─────────────────────┐┌─────────────────────┐┌─────────────────────┐
        │  Slave Account #1   ││  Slave Account #2   ││  Slave Account #3   │
        │  Broker: Zerodha    ││  Broker: Groww      ││  Broker: Upstox     │
        │  Capital: ₹10,00,000││  Capital: ₹5,00,000 ││  Capital: ₹2,50,000 │
        │  Risk Mult: 1.0x    ││  Risk Mult: 0.5x    ││  Risk Mult: 2.0x    │
        │  Latency: ~65ms     ││  Latency: ~140ms    ││  Latency: ~90ms     │
        │  Slippage: Low      ││  Slippage: Medium   ││  Slippage: Low-Med  │
        └──────────┬──────────┘└──────────┬──────────┘└──────────┬──────────┘
                   │                      │                      │
                   ▼                      ▼                      ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │             Indian Statutory Tax Breakdown (Per Broker)          │
        │         STT + NSE Turnover + SEBI Fees + GST 18% + Stamp Duty    │
        └──────────────────────────────────┬───────────────────────────────┘
                                           │
                                           ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │        Proof-of-Alpha Hash Chaining & Cryptographic Audit        │
        │                 (Slave Fill Attestation Receipts)                │
        └──────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Formulations & Sizing Algorithms

### 3.1 Proportional Sizing Modes

#### Mode A: Equity-Proportional Sizing (Default)
Scales the slave position relative to the equity ratio between the slave and master accounts, scaled by the slave's individual risk multiplier $M_{\text{risk}}$:

$$Q_{\text{slave, raw}} = Q_{\text{master}} \times \left( \frac{\text{Equity}_{\text{slave}}}{\text{Equity}_{\text{master}}} \right) \times M_{\text{risk}}$$

#### Mode B: Fixed Lot Multiplier Sizing
Directly scales the master quantity by the configured risk multiplier, independent of account balances:

$$Q_{\text{slave, raw}} = Q_{\text{master}} \times M_{\text{risk}}$$

#### Mode C: Risk Parity / Fixed Currency Risk Sizing
Allocates quantity such that the maximum currency loss (based on stop-loss distance $\Delta P_{\text{SL}} = \vert P_{\text{entry}} - P_{\text{SL}}\vert$) is equal to a specified percentage of slave equity:

$$Q_{\text{slave, raw}} = \frac{\text{Equity}_{\text{slave}} \times \text{RiskPct}_{\text{slave}}}{\Delta P_{\text{SL}}}$$

### 3.2 Indian Exchange Lot Size & Quantity Rounding
Indian equity derivatives (NSE NIFTY, BANKNIFTY, FINNIFTY, stock futures) trade strictly in integer multiples of exchange-mandated **Lot Sizes** (e.g., NIFTY lot = 25, BANKNIFTY lot = 15). For cash equity (CNC/MIS), lot size is 1.

The final executable slave quantity $Q_{\text{slave}}$ is computed as:

$$Q_{\text{slave}} = \begin{cases} 
\max\left(1, \, \text{round}(Q_{\text{slave, raw}})\right) & \text{if Asset is Equity (CNC/MIS)} \\
\max\left(L_{\text{size}}, \, \text{round}\left(\frac{Q_{\text{slave, raw}}}{L_{\text{size}}}\right) \times L_{\text{size}}\right) & \text{if Asset is F\&O Derivative}
\end{cases}$$

### 3.3 Margin Sufficiency & Safety Haircut
Before dispatching to the simulated broker API, the bridge computes the required margin:

$$\text{Margin}_{\text{required}} = \begin{cases}
Q_{\text{slave}} \times P_{\text{master}} & \text{if CNC (Delivery 100\%)} \\
Q_{\text{slave}} \times P_{\text{master}} \times 0.20 & \text{if MIS (Intraday 5x Leverage)} \\
Q_{\text{slave}} \times P_{\text{master}} \times 0.15 & \text{if F\&O Futures (SPAN + Exposure)} \\
Q_{\text{slave}} \times P_{\text{option}} & \text{if Option Buying (100\% Premium)}
\end{cases}$$

If $\text{Margin}_{\text{required}} > \text{AvailableCash}_{\text{slave}}$, the copier dynamically scales down $Q_{\text{slave}}$ to the maximum affordable valid lot size. If even 1 lot cannot be afforded, the slave execution is rejected with `REJECTED_INSUFFICIENT_MARGIN`.

### 3.4 Broker Latency & Stochastic Slippage Formulation

Each simulated broker profile exhibits distinct network and matching characteristics:

| Broker Profile | Mean Latency ($\mu$) | Latency Jitter ($\sigma$) | Base Slippage Rate ($\lambda_{\text{slip}}$) | Rejection Probability |
| :--- | :---: | :---: | :---: | :---: |
| **Zerodha Kite** | 55 ms | 15 ms | $0.02\%$ (2 bps) | $0.2\%$ |
| **Groww** | 135 ms | 40 ms | $0.05\%$ (5 bps) | $0.8\%$ |
| **Upstox Pro** | 75 ms | 20 ms | $0.03\%$ (3 bps) | $0.4\%$ |

The simulated execution delay $T_{\text{delay}}$:
$$T_{\text{delay}} = \max\left(10, \, \mu_{\text{broker}} + Z \cdot \sigma_{\text{broker}}\right), \quad Z \sim \mathcal{N}(0, 1)$$

The executed fill price $P_{\text{slave}}$:
$$P_{\text{slave}} = P_{\text{master}} \times \left(1 \pm \left(\lambda_{\text{slip}} \times \sqrt{\frac{T_{\text{delay}}}{50}} \times (1 + U)\right)\right), \quad U \sim \text{Uniform}(0, 0.5)$$
(Where sign is $+$ for BUY orders and $-$ for SELL orders, reflecting adverse selection slippage).

### 3.5 Maximum Allowable Slippage Filter (Price Deviation Guard)
If the price deviates beyond the user-configured threshold $\Theta_{\text{max\_slip}}$ (default $0.35\%$):

$$\left\vert \frac{P_{\text{slave}} - P_{\text{master}}}{P_{\text{master}}} \right\vert > \Theta_{\text{max\_slip}} \implies \textbf{Abort Slave Execution with } \texttt{ABORTED\_SLIPPAGE\_BREACH}$$

---

## 4. Feature Specifications & Capabilities

### 4.1 Master Account Management
- Any TradeCraft AI portfolio or demo persona (Arjun Mehta, Priya Sharma, Rohit Verma) can be designated as the **Active Master Account**.
- Trades executed via the Trade Ticket, Option Chain, DOM Ladder, Webhook Bot, or Quant Desk are automatically captured by the Copier Bridge listener.

### 4.2 Slave Accounts Matrix & Broker Simulation
Users can configure up to 6 simultaneous slave accounts:
- **Broker Simulation Selection:** Zerodha Kite, Groww, or Upstox.
- **Account Label & Persona:** e.g., *"Funded Challenge #1 (Zerodha)"*, *"Aggressive Scalp (Upstox)"*, *"Conservative Swing (Groww)"*.
- **Risk Multiplier:** Slider from 0.1x to 3.0x (e.g., 0.5x, 1.0x, 1.5x, 2.0x).
- **Independent Virtual Capital:** Set starting balance from ₹50,000 to ₹1,00,00,000.
- **Copying Toggle:** Enable / Pause copying per slave without affecting others.
- **Max Price Deviation Cap:** Customizable slippage tolerance (0.10% to 1.00%).

### 4.3 Position & Exit Synchronization
- **Entry Synchronization:** Triggered instantaneously upon master fill.
- **Partial Close Proportionality:** If master closes $40\%$ of a position, each slave closes exactly $40\%$ of its respective open position.
- **Stop-Loss / Take-Profit Synchronization:** Updating the SL or Target in the master account propagates changes to slave stop orders.
- **Emergency Global Kill Switch:** A prominent red safety button that transmits simultaneous cancellation and market exit orders to all open slave positions.

### 4.4 Real-Time Execution Audit Stream & Analytics
- Live visual feed showing:
  - Timestamp & Sequence ID.
  - Master Signal details (Symbol, Side, Master Price, Qty).
  - Slave Execution Status (`FILLED`, `REJECTED`, `SLIPPAGE_BREACH`).
  - Slave Fill Price, Slippage in Basis Points, Broker Latency in milliseconds.
  - Exact Indian Statutory Taxes deducted per slave account.

---

## 5. Data Flow & JSON Event Schemas

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Master Order Fill Event                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Trade Copier Broadcast Dispatcher                    │
│    Calculates Sizing, Checks Margin, Models Latency & Fills Slaves     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐┌───────────────────────────────────┐
│     Slave Execution Log Stream    ││    Slave Portfolios & Tax Stores  │
│  - Fill Price, Latency ms, Slip bps││ - Balance, Open Positions, P&L   │
└───────────────────────────────────┘└───────────────────────────────────┘
```

### 5.1 JSON Event Schema: `MasterTradeEvent`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MasterTradeEvent",
  "type": "object",
  "properties": {
    "eventId": { "type": "string" },
    "masterAccountId": { "type": "string" },
    "timestamp": { "type": "number" },
    "action": { "type": "string", "enum": ["OPEN", "CLOSE", "PARTIAL_CLOSE", "UPDATE_SL_TP"] },
    "symbol": { "type": "string" },
    "side": { "type": "string", "enum": ["BUY", "SELL"] },
    "orderType": { "type": "string", "enum": ["MARKET", "LIMIT", "SL_LIMIT"] },
    "productType": { "type": "string", "enum": ["MIS", "CNC", "NRML"] },
    "quantity": { "type": "integer" },
    "fillPrice": { "type": "number" },
    "stopLoss": { "type": "number" },
    "takeProfit": { "type": "number" }
  },
  "required": ["eventId", "masterAccountId", "timestamp", "action", "symbol", "side", "quantity", "fillPrice"]
}
```

### 5.2 JSON Event Schema: `SlaveExecutionReceipt`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SlaveExecutionReceipt",
  "type": "object",
  "properties": {
    "receiptId": { "type": "string" },
    "masterEventId": { "type": "string" },
    "slaveAccountId": { "type": "string" },
    "slaveAccountName": { "type": "string" },
    "broker": { "type": "string", "enum": ["ZERODHA_KITE", "GROWW", "UPSTOX"] },
    "status": { "type": "string", "enum": ["FILLED", "REJECTED_MARGIN", "ABORTED_SLIPPAGE_BREACH", "FAILED_NETWORK"] },
    "symbol": { "type": "string" },
    "side": { "type": "string", "enum": ["BUY", "SELL"] },
    "requestedQuantity": { "type": "integer" },
    "executedQuantity": { "type": "integer" },
    "masterPrice": { "type": "number" },
    "slaveFillPrice": { "type": "number" },
    "slippageBps": { "type": "number" },
    "latencyMs": { "type": "integer" },
    "statutoryCharges": {
      "stt": { "type": "number" },
      "exchangeTurnover": { "type": "number" },
      "sebiFees": { "type": "number" },
      "stampDuty": { "type": "number" },
      "gst": { "type": "number" },
      "totalTaxes": { "type": "number" }
    },
    "timestamp": { "type": "number" }
  },
  "required": ["receiptId", "masterEventId", "slaveAccountId", "broker", "status", "symbol", "side", "executedQuantity", "slaveFillPrice", "latencyMs"]
}
```

---

## 6. TypeScript Interface Architecture (`src/types/tradeCopier.ts`)

```typescript
export type BrokerType = 'ZERODHA_KITE' | 'GROWW' | 'UPSTOX';
export type SizingMode = 'EQUITY_PROPORTIONAL' | 'FIXED_MULTIPLIER' | 'RISK_PARITY';

export interface SlaveAccount {
  id: string;
  name: string;
  broker: BrokerType;
  isActive: boolean;
  sizingMode: SizingMode;
  riskMultiplier: number; // e.g. 0.5, 1.0, 2.0
  startingBalance: number;
  cashBalance: number;
  portfolioValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalStatutoryTaxes: number;
  maxSlippageBps: number; // e.g. 35 bps (0.35%)
  positions: SlavePosition[];
}

export interface SlavePosition {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  broker: BrokerType;
  openedAt: number;
}

export interface CopierExecutionLog {
  id: string;
  timestamp: number;
  masterEventId: string;
  slaveId: string;
  slaveName: string;
  broker: BrokerType;
  symbol: string;
  side: 'BUY' | 'SELL';
  masterPrice: number;
  slaveFillPrice: number;
  quantity: number;
  slippageBps: number;
  latencyMs: number;
  status: 'FILLED' | 'REJECTED_MARGIN' | 'ABORTED_SLIPPAGE_BREACH' | 'FAILED_NETWORK';
  statusReason?: string;
  statutoryTaxes: number;
}
```

---

## 7. Component & UI Architecture

1. **`src/types/tradeCopier.ts`:**
   - Type definitions for `SlaveAccount`, `MasterTradeEvent`, `SlaveExecutionReceipt`, and `CopierExecutionLog`.
2. **`src/lib/tradeCopierEngine.ts` (Core Engine):**
   - In-memory multi-slave state manager.
   - Master event listener & broadcaster.
   - Lot size lookup & rounding engine.
   - Margin verification using `taxEngine.ts`.
   - Stochastic latency & slippage simulator based on broker profiles.
   - Global emergency kill switch liquidator.
3. **`src/components/TradeCopierModal.tsx` (Interactive Multi-Broker UI):**
   - **Header Control Bar:** Active Master indicator, Master Balance, Active Slave Count, Global Emergency Kill Switch.
   - **Slave Configuration Cards:** Visual cards for each slave (Zerodha Kite branded blue, Groww branded green, Upstox branded purple) showing balance, P&L, risk multiplier slider, active toggle, and open positions.
   - **"Add Slave Account" Modal:** 1-click preset creator to instantiate new child accounts.
   - **Execution Audit Stream Table:** Real-time log showing master fill vs slave fills, latency, slippage, and taxes.
4. **Header & Navigation Integration:**
   - Dedicated **"⚡ Copier Bridge"** navigation button in `src/components/Header.tsx` with active slave count badge.

---

## 8. Regulatory, Security & Anti-Abuse Controls

1. **SEBI Regulations on Copy Trading (Consultation Paper August 2023):**
   The platform displays an explicit educational advisory:
   > *"Institutional Simulation Notice: The Trade Copier Bridge is a simulation environment for multi-account portfolio management, latency analysis, and broker API mechanics. It is designed for individual risk management and educational testing. TradeCraft AI does not provide public mirror trading or unregistered portfolio management services."*
2. **Rate Limiting & Queue Throttling:**
   Simulates exchange order throttle limits (e.g. max 10 orders per second per broker API key) to educate users on API rate limiting.
3. **Local In-Browser Privacy:**
   All slave states and simulated credentials reside 100% in local browser state / IndexedDB, ensuring zero telemetry leakage.

---

## 9. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-COP-01** | Proportional Sizing formula scales slave quantity accurately based on equity ratio and risk multiplier. | Automated unit test (`test/tradeCopierEngine.test.mjs`) verifying mathematical precision. |
| **AC-COP-02** | F&O derivatives quantities are strictly clamped and rounded to valid Indian exchange lot size multiples (e.g. NIFTY = 25). | Unit test verifying lot rounding for NIFTY, BANKNIFTY, and equities. |
| **AC-COP-03** | Insufficient margin in a slave account correctly rejects or haircuts order with `REJECTED_MARGIN`. | Unit test verifying margin boundary checks against starting balances. |
| **AC-COP-04** | Broker simulation generates stochastic latency and slippage adhering to broker distributions (Zerodha, Groww, Upstox). | Unit test verifying statistical latency and slippage ranges. |
| **AC-COP-05** | Slippage exceeding `maxSlippageBps` triggers `ABORTED_SLIPPAGE_BREACH` and halts execution. | Unit test verifying price deviation filter. |
| **AC-COP-06** | Emergency Global Kill Switch successfully cancels all pending orders and liquidates all open slave positions. | Unit test verifying zero remaining positions after kill switch activation. |

---

## 10. Summary & Next Steps
With **BRD-012**, TradeCraft AI provides retail traders and prop account managers with a multi-account execution environment. By faithfully simulating the idiosyncrasies of Indian broker APIs (Zerodha, Groww, Upstox), latency distributions, and slippage erosion, traders develop the quantitative discipline necessary to manage diversified multi-account portfolios.

Upon approval, this document will be indexed in `docs/brds/README.md` and handed over to the Scrum Master Agent for task decomposition in `docs/backlog.md`.
