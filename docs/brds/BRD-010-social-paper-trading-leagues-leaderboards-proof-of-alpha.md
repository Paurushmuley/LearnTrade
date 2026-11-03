# Business Requirements Document (BRD)
## TradeCraft AI — Social Paper Trading Leagues, Public Leaderboards & Cryptographically Verifiable Trade Proofs (Proof-of-Alpha)

- **Document ID:** `BRD-010-LEAGUES-PROOF-OF-ALPHA`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 10 (Social Competition & Cryptographic Attestation Suite)
- **Dependencies:** Sprint 1 (Tax Engine & Portfolio), Sprint 2 (Options Engine), Sprint 5 (Monte Carlo & Risk Analytics), Sprint 9 (User Accounts & Multi-Persona Auth)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Industry Crisis: Unverified P&L, "Finfluencer" Fraud & Gambling Contests
Retail trading across Indian (NSE/BSE) and global markets suffers from a severe crisis of authenticity and skewed behavioral incentives:
1. **The "Inspect Element" Epidemic:** Unregulated "finfluencers", Telegram signal vendors, and self-proclaimed trading gurus habitually doctor browser DOM elements, fabricate Zerodha/Groww P&L screenshots, or trade with riskless demo terminals while claiming multi-crore profits to sell subscriptions.
2. **SEBI's Regulatory Enforcement (2023–2025):** The Securities and Exchange Board of India (SEBI) has banned registered intermediaries from associating with unregulated financial influencers making performance claims. SEBI's landmark empirical study revealed that **93% of retail individual traders in the Equity F&O segment incurred net losses** (average loss of ₹2.0 lakh per trader, with statutory charges accounting for an additional 20–30% drag). There is a regulatory demand for independent, auditable **Performance Validation**.
3. **The "Moral Hazard Lottery" in Traditional Trading Contests:** Conventional paper trading competitions incentivize reckless degenerate gambling. Participants open multiple accounts, buy deep out-of-the-money (OTM) weekly lottery options with 100x leverage. The 99 who blow up walk away with zero consequences; the 1 lucky outlier tops the leaderboard with a 5,000% gain. This reinforces the exact opposite of disciplined risk-adjusted trading.
4. **Lack of Cryptographic Verification in Paper Trading:** Existing paper trading platforms store trades in mutable centralized tables where prices can be slipped or backdated without proof.

### 1.2 The TradeCraft AI Solution: Social Leagues & Proof-of-Alpha (PoA)
**Sprint 10** introduces an institutional-grade, cryptographically verifiable social competition framework:
- **Social Paper Trading Leagues:** Structured, time-delimited tournaments (Intraday Scalp Sprint, Weekly Expiry F&O Cup, Positional Swing Marathon) featuring strict **Anti-Gambling Risk Caps** (Maximum Drawdown disqualification, position sizing limits, mandatory trade diversification).
- **Risk-Adjusted Alpha Ranking (Not Raw Gambling Return):** Leaderboards ranked by a composite **TradeCraft Alpha Score ($\alpha_{\text{score}}$)** combining net return after Indian statutory taxes, Sortino Ratio, Calmar Ratio, and the trader's Behavioral Psychological Quotient (PQ).
- **Cryptographically Verifiable "Proof-of-Alpha" (PoA):** A zero-gas, client-native cryptographic ledger. Every paper trade is placed into a tamper-evident **SHA-256 Hash Chain**, validated against actual historical tick boundaries, and signed by the TradeCraft Engine Execution Oracle with an asymmetric ECDSA/Ed25519 digital signature.
- **Exportable Verifiable Trade Receipts & Public Verifier:** Traders can generate shareable digital certificates with QR codes, cryptographic hashes, and interactive proof inspectors allowing any 3rd party to verify execution timestamps, fills, and net P&L without revealing sensitive account balances or proprietary trade secrets.

---

## 2. Mathematical Formulations & Anti-Gambling Mechanics

### 2.1 The TradeCraft Composite Alpha Score ($\alpha_{\text{score}}$)
Instead of ranking traders by raw percentage gain, TradeCraft AI ranks participants using a multi-dimensional risk-adjusted formula:

$$\alpha_{\text{score}} = \left( w_1 \cdot \widehat{R}_{\text{net}} + w_2 \cdot \text{Sortino}^* + w_3 \cdot \frac{\text{PQ}}{100} \right) \times (1 - \text{Pen}_{\text{DD}}) \times (1 - \text{Pen}_{\text{conc}})$$

Where:
1. **Net Return Component ($\widehat{R}_{\text{net}}$):**
   $$\widehat{R}_{\text{net}} = \text{min}\left(\frac{\text{Realized P\&L} - \text{Statutory Charges}}{\text{Starting Capital}} \times 100, \, 100\right)$$
   Where statutory charges strictly incorporate SEBI STT, Exchange Turnover, GST, and Stamp Duty from `src/lib/taxEngine.ts`.
2. **Normalized Sortino Ratio ($\text{Sortino}^*$):**
   $$\text{Sortino} = \frac{\bar{R}_p - R_f}{\sigma_d}$$
   Where $\sigma_d = \sqrt{\frac{1}{N} \sum_{t=1}^N \min(0, R_t - R_f)^2}$ is downside semi-deviation, isolating harmful volatility from upside profit swings. $\text{Sortino}^* = \text{clamp}\left(\frac{\text{Sortino}}{4.0} \times 100, 0, 100\right)$.
3. **Behavioral Discipline / Psychological Quotient ($\text{PQ}$):**
   Inherited from TradeCraft AI's behavioral engine (`src/lib/aiProvider.ts`, `src/lib/tradebookEngine.ts`), measuring absence of revenge trading, adherence to stop-losses, and steady trade sizing ($0 \le \text{PQ} \le 100$).
4. **Drawdown Penalty Multiplier ($\text{Pen}_{\text{DD}}$):**
   $$\text{Pen}_{\text{DD}} = \begin{cases} 
   0 & \text{if } \text{MaxDD} \le 5\% \\
   \left(\frac{\text{MaxDD} - 5\%}{\text{MaxDD}_{\text{limit}} - 5\%}\right)^2 & \text{if } 5\% < \text{MaxDD} < \text{MaxDD}_{\text{limit}} \\
   1.0 & \text{if } \text{MaxDD} \ge \text{MaxDD}_{\text{limit}} \implies \textbf{Disqualified}
   \end{cases}$$
5. **Concentration Penalty Multiplier ($\text{Pen}_{\text{conc}}$):**
   Penalizes participants who bet $>30\%$ of total portfolio margin into a single strike or stock, preventing "all-in" gambling.

### 2.2 Default Metric Weightings
| Component | Symbol | Weight ($w_i$) | Rationale |
| :--- | :---: | :---: | :--- |
| **Risk-Adjusted Return (Sortino)** | $\text{Sortino}^*$ | 0.40 | Prioritizes smooth, controlled upward equity curves |
| **Net Realized P&L (Post-Tax)** | $\widehat{R}_{\text{net}}$ | 0.35 | Rewards genuine profitability after all statutory taxes |
| **Behavioral Discipline (PQ)** | $\text{PQ}$ | 0.25 | Directly penalizes tilt, revenge trading, and Martingale sizing |

---

## 3. Cryptographic "Proof-of-Alpha" (PoA) Architecture

### 3.1 Tamper-Evident Hash-Chained Tradebook
Every filled trade $i$ generates a canonical payload hashed with the previous trade's cryptographic hash:

$$H_0 = \text{SHA-256}(\text{"TRADECRAFT-GENESIS-" } \parallel \text{LeagueId} \parallel \text{UserId})$$
$$H_i = \text{SHA-256}\Big( H_{i-1} \parallel \text{TradeID}_i \parallel \text{Timestamp}_i \parallel \text{Symbol}_i \parallel \text{Side}_i \parallel Q_i \parallel P_{\text{exec}} \parallel \text{Taxes}_i \parallel \text{OrderType}_i \Big)$$

If a bad actor attempts to retroactively alter trade $k$ (e.g., editing an entry price from ₹2,450 to ₹2,410), all subsequent hashes $H_k, H_{k+1}, \dots, H_n$ become mathematically invalid.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Trade 1     │       │     Trade 2     │       │     Trade 3     │
│ H0 = Genesis    │       │ H1 = SHA256(...)│       │ H2 = SHA256(...)│
│ Price: ₹2450.00 │──────►│ Price: ₹2468.50 │──────►│ Price: ₹2482.00 │
│ Hash: 0x9f8c... │       │ Hash: 0x4a1b... │       │ Hash: 0x7e3d... │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │  Proof-of-Alpha │
                                                    │   Merkle Root   │
                                                    │  Digital Sig:   │
                                                    │  0x3c99a...     │
                                                    └─────────────────┘
```

### 3.2 Platform Execution Oracle & Asymmetric Digital Signatures
To guarantee that the paper fill was executed against **genuine market tick constraints** (not synthetic fabricated quotes):
1. **Canonical Trade Receipt:**
   ```json
   {
     "version": "TC-POA-1.0",
     "receiptId": "poa_rec_9824f2b",
     "leagueId": "nifty-expiry-cup-w44",
     "trader": "Arjun Mehta (INTRADAY_SCALPER)",
     "trade": {
       "symbol": "NIFTY24NOV24200CE",
       "side": "BUY",
       "quantity": 150,
       "fillPrice": 124.50,
       "timestamp": 1730632200000,
       "marketTickContext": {
         "candleLow": 122.10,
         "candleHigh": 126.80,
         "spreadAtFill": 0.30
       },
       "statutoryCharges": 48.72
     },
     "chainHash": "a6c8b9d3e4f...",
     "oraclePublicKey": "04bf9e..."
   }
   ```
2. **Cryptographic Attestation via Web Crypto API:**
   $$\sigma_{\text{poa}} = \text{Sign}_{\text{PrivKey}}(\text{SHA-256}(\text{CanonicalReceipt}))$$
   The platform verifies that:
   - $P_{\text{exec}} \in [\text{CandleLow}_t, \, \text{CandleHigh}_t]$.
   - Slippage model does not exceed Level-2 DOM liquidity limits.
   - Signature verifies with `TradeCraft_Public_Oracle_Key`.

### 3.3 Zero-Knowledge / Selective Disclosure Proofs
Traders can share a public Proof Certificate that verifies their performance without revealing their exact entry/exit signals or proprietary trading rules:
- **Disclosed Proof:** Trader Alias, Net Alpha Score, Sortino Ratio, Post-Tax ROI %, Max Drawdown, Total Trades Count, Cryptographic Attestation Signature, and Merkle Root.
- **Redacted Internal Data:** Underlying indicator triggers, custom webhook tokens, private notes, and raw margin balance.

---

## 4. League Formats & Tournament Rules

### 4.1 Competition Tiers
| League Name | Focus Segment | Duration | Starting Virtual Capital | Max Drawdown Cap | Anti-Gambling Restrictions |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Nifty Weekly Expiry Cup** | NIFTY & BANKNIFTY Options | 1 Week (Monday to Thursday Expiry) | ₹10,00,000 | 12.0% | Max 20% margin per single strike; minimum 4 trades; naked buying capped at 15% |
| **Intraday Alpha Sprint** | Top 50 NSE Equities (MIS) | 1 Trading Day (9:15 AM - 3:30 PM IST) | ₹5,00,000 | 8.0% | Mandatory square-off at 3:15 PM; Max 5x leverage; 0 holding overnight |
| **Options Greeks Master League** | Multi-Leg F&O Spreads | 2 Weeks | ₹25,00,000 | 10.0% | Must maintain $\vert\Delta_{\text{portfolio}}\vert \le 0.35$; rewards Iron Condors & Spreads |
| **Rookie Discipline Sandbox** | Equity Cash (CNC / MIS) | 1 Month | ₹1,00,000 | 6.0% | Max risk per trade = 2% of capital; minimum PQ score 70 to qualify for podium |

### 4.2 Disqualification & Circuit Breaker Logic
- If a trader's intra-league peak-to-trough drawdown breaches the league's $\text{MaxDD}_{\text{limit}}$, their status immediately transitions to `DISQUALIFIED`.
- Disqualified accounts can continue paper trading in private mode, but their standing is frozen with a red disqualification badge on the public leaderboard.

---

## 5. System Architecture & Component Design

### 5.1 Component Breakdown
1. **`src/lib/leagueEngine.ts` (Core Domain Logic):**
   - Active leagues catalog & rule validators.
   - Dynamic Alpha Score calculator ($\alpha_{\text{score}}$).
   - Drawdown and position concentration monitor.
   - Preloaded mock competitor benchmarks (e.g. "AlphaBot Systematic", "Nifty Index Buy & Hold", "Top Scalper Pro").
2. **`src/lib/proofEngine.ts` (Cryptographic Proof-of-Alpha Service):**
   - SHA-256 tradebook hash-chain generator using native `window.crypto.subtle`.
   - ECDSA / P-256 digital signature generator and verifier.
   - Merkle root computation for trading sessions.
   - Proof payload serializer / deserializer with base64 attestation envelopes.
3. **`src/components/LeagueLeaderboardModal.tsx` (Interactive UI):**
   - Tabbed view: Active Leagues, Global Leaderboard, Proof-of-Alpha Verifier, and My Competition Standings.
   - Dynamic filters: Sort by Alpha Score, Sortino, Net P&L, or PQ Discipline.
   - 1-Click "Join League" for the active user.
   - Clickable row to view a participant's Verified Performance Card and trade chain.
4. **`src/components/ProofOfAlphaModal.tsx` (Verifiable Certificate & Inspector):**
   - Cryptographic Certificate view with stylized security seal, verification status, hash tree snapshot, and QR code representation.
   - Interactive Public Verifier: Paste any JSON trade receipt or cryptographic signature to verify authenticity against the platform public key in real-time.

### 5.2 Header & Navigation Integration
- Add a dedicated **"🏆 Leagues & Alpha"** button in `src/components/Header.tsx` adjacent to Screener, Tradebook, and Quant Analytics.
- Badge indicators showing active competition rank and verified proof status.

---

## 6. Data Flow & Entity Specifications

```
┌─────────────────────────────────────────────────────────────┐
│                       Paper Order Fill                      │
│                  (from Terminal / Webhook)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 src/lib/proofEngine.ts                      │
│  - Compute H_i = SHA256(H_{i-1} + TradeDetails + Taxes)     │
│  - Verify price is within NSE Tick bounds                   │
│  - Generate ECDSA Digital Signature (Platform Oracle)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 src/lib/leagueEngine.ts                     │
│  - Check Max Drawdown & Risk Concentration rules            │
│  - Update Realized P&L, Sortino, and PQ Score               │
│  - Calculate TradeCraft Alpha Score                         │
│  - Re-rank Leaderboard Matrix                               │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│   LeagueLeaderboardModal.tsx  │   │   ProofOfAlphaModal.tsx   │
│ - Live Leaderboard Ranking    │   │ - Cryptographic Seal      │
│ - Alpha Score & Sortino Rungs │   │ - Merkle Hash Tree        │
│ - Disqualification Monitors   │   │ - Real-Time Hash Verifier │
└───────────────────────────────┘   └───────────────────────────┘
```

### 6.1 TypeScript Interfaces (`src/types/league.ts`)
```typescript
export interface TradeProof {
  proofId: string;
  tradeId: string;
  userId: string;
  userHandle: string;
  timestamp: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  executionPrice: number;
  statutoryTaxes: number;
  previousHash: string;
  currentHash: string;
  oracleSignature: string;
  verifiedAgainstTick: boolean;
}

export interface LeagueParticipant {
  userId: string;
  handle: string;
  avatar: string;
  persona: 'INTRADAY_SCALPER' | 'OPTIONS_QUANT' | 'MARKET_BEGINNER' | 'SYSTEMATIC_ALGO';
  startingCapital: number;
  currentEquity: number;
  realizedPnlNet: number;
  totalStatutoryCharges: number;
  sortinoRatio: number;
  maxDrawdownPct: number;
  pqScore: number;
  alphaScore: number;
  tradesCount: number;
  disqualified: boolean;
  disqualificationReason?: string;
  merkleRoot: string;
  lastProofSignature: string;
}

export interface TradingLeague {
  id: string;
  title: string;
  category: 'INTRADAY_EQUITY' | 'WEEKLY_OPTIONS' | 'SWING_MOMENTUM' | 'ROOKIE_DISCIPLINE';
  startDate: string;
  endDate: string;
  startingCapital: number;
  maxDrawdownLimitPct: number;
  maxPositionConcentrationPct: number;
  minimumTradesRequired: number;
  participants: LeagueParticipant[];
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
}
```

---

## 7. Regulatory & Security Compliance (SEBI Schedules)

1. **Clear "Paper Trading / Educational Sandbox" Disclaimer:**
   In compliance with SEBI advertising guidelines and Securities Contracts (Regulation) Act, all leaderboards, proofs, and badges must clearly display:
   > *"Notice: TradeCraft AI Leagues and Proof-of-Alpha certificates represent simulated paper trading executions under true Indian statutory cost modeling. They do not constitute investment advice, research recommendations, or SEBI-registered portfolio management services."*
2. **Anti-Collusion & Wash Trading Guard:**
   Automated detection flags users executing opposing buy/sell orders simultaneously across paired accounts to manipulate league volume or fabricate fake win-rates.
3. **Zero-Knowledge Privacy Guarantee:**
   No private keys or personal user credentials leave the local browser runtime. Proofs are signed client-side or verified via open public key cryptography.

---

## 8. Acceptance Criteria & Verification Plan

| ID | Criteria | Verification Method |
| :--- | :--- | :--- |
| **AC-POA-01** | Every executed trade creates an immutable SHA-256 hash incorporating the previous trade hash. | Automated unit test verifying hash-chain tampering detection (`test/leagueEngine.test.mjs`). |
| **AC-POA-02** | The Alpha Score correctly rewards high Sortino and PQ scores while penalizing drawdown according to mathematical formulations. | Unit test verifying monotonicity of Alpha Score against varying Sortino and Drawdown parameters. |
| **AC-POA-03** | Any account breaching the league's `maxDrawdownLimitPct` is automatically marked `disqualified: true`. | Automated unit test verifying circuit breaker trip on 15% drawdown breach. |
| **AC-POA-04** | The Public Proof Verifier accurately verifies valid digital signatures and rejects manipulated price/quantity payloads. | Unit test verifying cryptographic signature validation and rejection of altered trade data. |
| **AC-POA-05** | UI displays active leagues, participant standings, sortable columns, and interactive modal for Proof Certificate with QR code representation. | End-to-end component rendering and interactive user testing. |

---

## 9. Conclusion & Next Steps
With the authorization of **BRD-010**, the TradeCraft AI ecosystem bridges institutional quantitative discipline, social competitive motivation, and cryptographic integrity. This effectively eradicates the "finfluencer inspect-element" fraud while gamifying genuine risk-adjusted mastery for Indian and global retail traders.
