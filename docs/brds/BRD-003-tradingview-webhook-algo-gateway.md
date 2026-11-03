# Business Requirements Document (BRD)
## TradeCraft AI — TradingView Webhook Gateway & Automated Algorithmic Paper Trading Engine

- **Document ID:** `BRD-003-WEBHOOK-ALGO-GATEWAY`
- **Author:** Researcher Agent (Product & Requirements Lead)
- **Status:** Approved for Backlog Decomposition
- **Version:** 1.0.0
- **Target Release:** Sprint 3 (Automated Algo Trading)

---

## 1. Executive Summary & Market Value
A significant segment of retail and systematic traders test their algorithms using **TradingView Alerts**, **Python scripts**, or **PineScript indicators** (Supertrend, EMA Crossovers, RSI Pullbacks). However:
1. Real broker APIs (Zerodha Kite Connect, Upstox, Angel One) charge hefty monthly API subscription fees (₹2,000–₹4,000/month) just to paper-test automated strategies.
2. Traders often deploy untested algorithmic alerts live, incurring catastrophic slippage, uncalculated statutory taxes, and loop bugs (rapid-fire order triggers).

**TradeCraft AI Sprint 3** introduces a zero-cost, enterprise-grade **TradingView Webhook Gateway & Automated Algo Paper Trading Engine**:
- Provides a dedicated Webhook endpoint (`/api/webhook`) that accepts TradingView alert webhooks and Python API calls.
- Authenticates via user-specific secret tokens.
- Executes automated simulated paper orders with authentic Indian statutory charges (Brokerage, STT, GST).
- Features automated **Risk Circuit Breakers** to halt bot execution if a strategy exceeds user-defined drawdown limits.
- Generates ready-to-use PineScript alert code templates for seamless integration with TradingView charts.

---

## 2. Technical Architecture & Ingestion Flow

```
┌─────────────────────────────────┐
│     TradingView Cloud Alert     │  (or Python / External Bot)
│   {{strategy.order.alert_msg}}  │
└────────────────┬────────────────┘
                 │ HTTP POST JSON
                 ▼
┌─────────────────────────────────┐
│   TradeCraft Next.js Endpoint   │
│       /api/webhook              │
└────────────────┬────────────────┘
                 │
                 ├─► 1. Token Authentication (x-webhook-token)
                 ├─► 2. Circuit Breaker Check (Max Drawdown / Daily Loss)
                 ├─► 3. Payload Schema Validation (Ticker, Side, Qty, Type)
                 │
                 ▼
┌─────────────────────────────────┐
│  Trading Engine & Indian Taxes  │
│  - Fill Order                   │
│  - Deduct STT / Exchange / GST  │
│  - Update Position Book         │
│  - Log Webhook Audit Trail      │
└─────────────────────────────────┘
```

---

## 3. Webhook Payload Specification

The endpoint accepts `POST /api/webhook` with `Content-Type: application/json`.

```json
{
  "token": "tc_bot_sec_9a8f2...",
  "botName": "Supertrend 15m Breakout",
  "symbol": "RELIANCE",
  "side": "BUY",
  "quantity": 50,
  "type": "MARKET",
  "product": "MIS",
  "price": 2845.50,
  "comment": "Long entry on 15m close above 2840"
}
```

### Safety Features & Circuit Breakers:
1. **Token Authentication:** Requests without a matching secret token are rejected immediately with HTTP 401.
2. **Rate Limiting & Duplicate Guard:** Max 10 requests per minute per bot to avoid runaway PineScript alert loops.
3. **Max Loss Circuit Breaker:** If cumulative bot losses exceed a configurable limit (e.g., ₹10,000), the bot is automatically paused, and alerts are rejected with a safety flag.

---

## 4. Feature Specifications & Deliverables

### Feature 1: HTTP Webhook Ingestion API Route
- Next.js App Router Route Handler (`src/app/api/webhook/route.ts`).
- Supports CORS, json parsing, and error reporting with structured response:
  `{ "success": true, "orderId": "ORD-...", "executedPrice": 2845.50, "taxes": 38.25, "status": "FILLED" }`.

### Feature 2: Webhook Bot Manager & Performance Tracking
- Create, rename, enable/disable automated bots.
- Track metrics per bot:
  - Total Alerts Received.
  - Filled vs Rejected Orders.
  - Bot Gross P&L vs Post-Tax Net P&L.
  - Latency (ingestion to execution in ms).

### Feature 3: Interactive Webhook Terminal & PineScript Generator
- Live Webhook URL with 1-click copy.
- Secret Token regeneration.
- Built-in **Webhook Simulation Playground**: Send test pings or mock buy/sell triggers directly from the UI without needing TradingView.
- **Copy-Paste PineScript Template**: Generates PineScript v5 alert code configured with the user's endpoint and secret token.

---

## 5. Acceptance Criteria
1. `POST /api/webhook` successfully processes valid payloads and fills paper trades.
2. Invalid token or malformed payload returns HTTP 400/401 with clear diagnostic errors.
3. Executed trades appear in active positions with correct Indian statutory tax calculations.
4. Circuit breaker halts order execution when daily loss limit is breached.
5. In-browser webhook simulation tool allows instant testing with zero external dependencies.
