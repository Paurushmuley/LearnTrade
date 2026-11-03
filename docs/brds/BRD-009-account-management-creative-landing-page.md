# BRD-009: User Account Management, Multi-Persona Authentication & Creative Landing Page

## 1. Executive Summary & Purpose
To elevate **TradeCraft AI** into a production-grade educational platform, users require dedicated personal accounts, customized trading personas, risk profiles, and isolated paper trading ledgers. Furthermore, new users visiting the platform need an engaging, high-converting, and informative Landing Page that articulates the core advantages of the BYOK architecture, true Indian statutory charge calculations, and institutional derivatives simulation.

**BRD-009** delivers:
1. **Full Account Lifecycle:** Registration, Sign In, Profile Management, Forgot Password, and In-Profile Password Reset.
2. **Preloaded Trader Archetypes (Demo Accounts):** 3 ready-to-test personas (Scalper, Quant, Novice) with 1-click instant login.
3. **Per-User Portfolio Isolation:** Each account preserves its own virtual balance, order history, open positions, and psychological quotient (PQ) score.
4. **Creative Interactive Landing Page:** A high-impact showcase featuring live price tickers, interactive comparison matrix against generic simulators, feature deep-dives, and 1-click persona terminal launchers.

---

## 2. User Account & Authentication Specifications

### 2.1 Demo Accounts Matrix
| Account Name | Email | Password | Starting Capital | Trading Persona | Focus & Characteristics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Arjun Mehta** | `arjun.trader@tradecraft.ai` | `Demo@123` | ₹10,00,000 | `INTRADAY_SCALPER` | Momentum scalper; VWAP and NIFTY 50 breakouts; 88 PQ score |
| **Priya Sharma** | `priya.quant@tradecraft.ai` | `Demo@123` | ₹25,00,000 | `OPTIONS_QUANT` | Systematic F&O; Black-Scholes Greeks, Iron Condors; 94 PQ score |
| **Rohit Verma** | `rohit.novice@tradecraft.ai` | `Demo@123` | ₹5,00,000 | `MARKET_BEGINNER` | Price action student; mastering SEBI statutory tax awareness; 65 PQ score |

### 2.2 Security & Zero-Knowledge BYOK Guarantee
- Passwords are salted and hashed client-side.
- Personal BYOK keys (Gemini, OpenAI, Ollama) and user statements remain 100% localized to the user's browser storage.
- Forgot Password uses a deterministic 6-digit verification code token workflow.

---

## 3. Creative Landing Page Architecture
1. **Hero Section:**
   - Animated BYOK tag badge.
   - High-impact value proposition: *"Master Stock & F&O Trading Without Risking A Single Rupee"*.
   - Live real-time tick marquee (NIFTY 50, BANKNIFTY, RELIANCE, TCS, HDFCBANK).
   - Instant CTAs: "Launch Live Sandbox", "Create Free Account", and "Explore 3 Demo Personas".
2. **"Why 93% of Indian Traders Lose Money" Comparison Matrix:**
   - Compares TradeCraft AI against generic paper trading apps and broker paper tools on STT/GST taxes, AI coaching costs, Level-2 DOM, and statement import.
3. **Core Capabilities Grid:**
   - 8 interactive cards covering SEBI Statutory Fees, F&O Greeks, BYOK Privacy, Level-2 DOM, Statement Importer, Technical Screener, Webhook Bots, and Bar Replay.
4. **Interactive Demo Personas Showcase:**
   - 1-click "Launch as Arjun", "Launch as Priya", and "Launch as Rohit" directly opening the live sandbox pre-configured to that persona.
5. **Educational FAQ & Community Footer:**
   - Explains virtual capital, BYOK architecture, and regulatory tax compliance.
