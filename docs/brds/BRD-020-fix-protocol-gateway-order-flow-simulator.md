# Business Requirements Document (BRD) - Sprint 20

## Feature ID: `BRD-020`
## Feature Title: Real-Time FIX Protocol Gateway & Institutional Drop-Copy Order Flow Simulator (FIX 4.4 Engine)
**Author:** Researcher Lead (Autonomous Multi-Agent Cycle)  
**Date:** 2026-11-05  
**Status:** `APPROVED FOR IMPLEMENTATION`  
**Target Milestone:** Sprint 20  

---

### 1. Executive Summary & Problem Statement

#### 1.1 Context
In institutional capital markets, high-frequency algorithmic trading desks, proprietary trading firms, and Tier-1 prime brokers do not trade via REST APIs or consumer WebSockets. Instead, over 95% of institutional equity and derivative order flow across global and Indian exchanges (NSE, BSE, CME, NASDAQ) is transmitted through the **Financial Information eXchange (FIX) Protocol** (specifically FIX 4.4 and FIX 5.0 SP2).

#### 1.2 Problem Statement
Retail traders and transitioning quantitative developers have zero access to institutional FIX protocol infrastructure due to exorbitant vendor costs ($5,000–$25,000/month for FIX connectivity), complex socket management, and proprietary exchange certification environments. Consequently:
1. Aspiring quantitative developers cannot inspect, debug, or learn the raw tag-value wire format (e.g., `8=FIX.4.4|9=124|35=D|49=TRADECRAFT|56=NSE_MATCH|...|10=182|`).
2. Systematic traders lack understanding of session-layer state machines (Logon `35=A`, Heartbeat `35=0`, TestRequest `35=1`, ResendRequest `35=2`, Sequence Reset `35=4`).
3. Risk compliance officers and post-trade analysts cannot simulate institutional **Drop-Copy Sessions** (read-only real-time trade mirroring streams used by prime broker risk engines and clearing houses).

#### 1.3 Solution & Business Objectives
TradeCraft AI Sprint 20 introduces an institutional-grade, zero-dependency **FIX 4.4 Protocol Gateway & Drop-Copy Order Flow Simulator**. This system provides:
* **Bidirectional FIX 4.4 Engine:** Standard tag-value serialization, parsing, and Modulo 256 checksum calculation (`Tag 10`).
* **Session & Application Layer State Machine:** Automatic sequence numbering (`MsgSeqNum 34`), heartbeat generation (`HeartBtInt 108`), test request ping-pong, and sequence resend recovery.
* **Exchange Matching Engine Simulator:** Realistic synthetic venue simulation that ingests `NewOrderSingle (35=D)`, performs risk validation, and responds with immediate `ExecutionReport (35=8)` messages (Pending New, New, Partially Filled, Filled, or Rejected).
* **Drop-Copy Compliance Journal:** Dedicated institutional drop-copy feed that mirrors every order event in real-time for compliance, trade surveillance, and audit trails.
* **Interactive FIX Terminal UI:** Raw packet hex/tag-value viewer, syntax color-coded tags, manual tag injection, session controls, and sub-millisecond wire latency metrics.

---

### 2. Feature Scope & User Stories

#### 2.1 User Story 1: Raw Tag-Value Serialization & Parsing (`TC-FIX-01`, `TC-FIX-02`)
* **As a Quant Trader / Systems Engineer**, I want to construct and inspect valid FIX 4.4 messages formatted with standard SOH (`\x01` or visual `|`) delimiters and exact byte length calculations (`Tag 9`) and Modulo 256 checksums (`Tag 10`), so that I can master institutional wire protocols.
* **Acceptance Criteria:**
  * Tag 8 (`BeginString=FIX.4.4`), Tag 9 (`BodyLength`), and Tag 10 (`CheckSum`) must be calculated strictly according to FIX 4.4 specification.
  * Checksum algorithm: sum of all ASCII bytes up to the start of Tag 10, modulo 256, zero-padded to 3 digits (`%03d`).
  * Body length: total byte count between the end of Tag 9 and the start of Tag 10.
  * Robust bi-directional parsing from raw string to structured typed objects and vice-versa.

#### 2.2 User Story 2: FIX Session State Machine & Heartbeat Engine (`TC-FIX-02`)
* **As a Protocol Integrator**, I want an automated session-layer state machine that manages `Logon (35=A)`, `Logout (35=5)`, `Heartbeat (35=0)`, and `TestRequest (35=1)` with synchronized inbound and outbound sequence numbers, so that simulated connectivity behaves identically to production exchange gateways.
* **Acceptance Criteria:**
  * Strict monotonic incrementation of `InSeqNum` and `OutSeqNum`.
  * Configurable Heartbeat interval (default: 30s, simulated: 5s for interactive display).
  * Out-of-sequence detection and automatic `ResendRequest (35=2)` generation.

#### 2.3 User Story 3: Order Execution & Synthetic Exchange Engine (`TC-FIX-02`)
* **As an Algorithmic Trader**, I want to dispatch `NewOrderSingle (35=D)` with Client Order IDs (`ClOrdID 11`), Symbol (`55`), Side (`54`), Quantity (`38`), OrdType (`40`), and Price (`44`), and receive realistic asynchronous `ExecutionReport (35=8)` lifecycle messages.
* **Acceptance Criteria:**
  * Order status progression: `PendingNew (39=A)` $\rightarrow$ `New (39=0)` $\rightarrow$ `PartiallyFilled (39=1)` $\rightarrow$ `Filled (39=2)`.
  * Support for `OrderCancelRequest (35=F)` and `OrderCancelReject (35=9)`.
  * Accurate financial attribution: Executed Price (`Tag 6`), Cumulative Qty (`Tag 14`), Leaves Qty (`Tag 151`).

#### 2.4 User Story 4: Institutional Drop-Copy Feed & Audit Journal (`TC-FIX-02`)
* **As a Chief Risk Officer / Compliance Auditor**, I want an independent Drop-Copy stream that records all inbound orders, exchange executions, and rejections in an immutable audit ledger, so that regulatory compliance and real-time risk checks can be verified.
* **Acceptance Criteria:**
  * Every execution report is forwarded to a dedicated Drop-Copy stream tagged with `DeliverToCompID (128)` and timestamp (`Tag 52`).
  * Instant search and export capabilities (CSV / JSON format).

#### 2.5 User Story 5: Interactive FIX Protocol Console Modal (`TC-FIX-03`, `TC-FIX-04`)
* **As a Platform Trader**, I want an interactive, high-tech FIX Protocol Console featuring a live stream of formatted messages, syntax-highlighted tags, manual order injection form, and real-time latency telemetry.
* **Acceptance Criteria:**
  * Real-time scrolling message log with color-coded tags (Header: blue, Body: slate/green, Trailer: amber).
  * Direct manual injection terminal allowing one-click execution of standard order templates (Limit Buy, Market Sell, Iceberg Slice, Cancel).
  * Header integration under "⚡ Execution" suite and Command Palette (`Ctrl+K`).

---

### 3. Technical Architecture & FIX 4.4 Dictionary Specification

#### 3.1 Standard Tag Dictionary
| Tag | Field Name | Description & Institutional Value Example |
| :---: | :--- | :--- |
| **8** | `BeginString` | FIX protocol version (`FIX.4.4`) |
| **9** | `BodyLength` | Byte length of message body between Tag 9 and Tag 10 |
| **35** | `MsgType` | Message Type (`A`=Logon, `0`=Heartbeat, `1`=TestRequest, `2`=Resend, `D`=NewOrderSingle, `8`=ExecutionReport, `F`=Cancel, `3`=Reject) |
| **49** | `SenderCompID` | Client Identifier (`TRADECRAFT_DESK`) |
| **56** | `TargetCompID` | Destination Venue (`NSE_MATCH_ENG` or `BSE_MATCH_ENG`) |
| **34** | `MsgSeqNum` | Monotonic message sequence number (1, 2, 3...) |
| **52** | `SendingTime` | UTC timestamp formatted as `YYYYMMDD-HH:MM:SS.sss` |
| **11** | `ClOrdID` | Unique client order identifier (e.g., `ORD-20261105-001`) |
| **37** | `OrderID` | Exchange-assigned unique order identifier |
| **17** | `ExecID` | Unique execution identifier per trade print |
| **55** | `Symbol` | Stock / Contract ticker (`NIFTY`, `RELIANCE`, `TCS`, `HDFCBANK`) |
| **54** | `Side` | `1` = Buy, `2` = Sell |
| **38** | `OrderQty` | Total order quantity in shares/units |
| **44** | `Price` | Limit price in INR |
| **40** | `OrdType` | `1` = Market, `2` = Limit, `3` = Stop, `4` = Stop Limit |
| **59** | `TimeInForce` | `0` = Day, `1` = GTC, `3` = IOC, `4` = FOK |
| **150** | `ExecType` | `0`=New, `1`=PartialFill, `2`=Fill, `4`=Cancelled, `8`=Rejected |
| **39** | `OrdStatus` | Current state of the order |
| **6** | `AvgPx` | Average execution price across all fills |
| **14** | `CumQty` | Cumulative filled quantity to date |
| **151** | `LeavesQty` | Remaining open quantity (`OrderQty - CumQty`) |
| **10** | `CheckSum` | 3-digit Modulo 256 sum of all message bytes up to `Tag 10` |

#### 3.2 Modulo 256 Checksum Formula
$$\text{CheckSum} = \left( \sum_{i=1}^{N} \text{byte}_i \right) \pmod{256}$$
Represented as a 3-character zero-padded string (`sprintf("%03d", checksum)`).

---

### 4. Non-Functional Requirements & Security
* **Performance:** Serialization and parsing of 10,000 FIX messages in $< 20\text{ ms}$.
* **Zero Dependencies:** Pure TypeScript implementation with zero external npm dependencies.
* **Deterministic Simulation:** Reproducible matching responses with simulated network micro-latency (1–8ms).
* **Strict Type Safety:** Exhaustive TypeScript interfaces with no `any` types.

---

### 5. Definition of Done (DoD)
1. Comprehensive BRD-020 approved and indexed in `docs/brds/README.md`.
2. Core FIX 4.4 engine (`src/types/fix.ts`, `src/lib/fixEngine.ts`) fully implemented.
3. Interactive UI modal (`src/components/FixProtocolModal.tsx`) built and styled.
4. Integrated into Header navigation suites and Landing Page showcase.
5. 100% passing unit tests in `test/fixEngine.test.mjs`.
6. Zero TypeScript or build errors (`npx tsc --noEmit` and `npm run build`).
