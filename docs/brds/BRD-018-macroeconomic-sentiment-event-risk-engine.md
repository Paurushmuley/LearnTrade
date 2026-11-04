# Business Requirements Document (BRD)
## TradeCraft AI — Macroeconomic Sentiment Analysis & News Event Risk Engine for NSE/BSE (RBI MPC, Union Budget, US Fed FOMC & Pre-Event Options IV Jump Models)

- **Document ID:** `BRD-018-MACRO-SENTIMENT-EVENT-RISK-ENGINE`
- **Author:** Researcher Lead Agent
- **Status:** Approved for Backlog Decomposition & Engineering
- **Version:** 1.0.0
- **Target Release:** Sprint 18 (Macroeconomic Intelligence & Volatility Event Risk Suite)
- **Dependencies:** 
  - Sprint 1 (`tradingEngine.ts` — Paper Trading Portfolio, `aiProvider.ts` — BYOK LLM Intelligence)
  - Sprint 2 (`optionsEngine.ts` — Analytical Black-Scholes Engine & Greeks)
  - Sprint 6 (`breadthEngine.ts` — Institutional FII/DII Cash & Derivatives Flows)
  - Sprint 11 (`quantDeskEngine.ts` — Autonomous AI Quant Hedge Fund Desk)
  - Sprint 13 (`greeksHedgerEngine.ts` — Real-Time Delta/Gamma/Vega Hedging)
  - Sprint 14 (`volatilitySurfaceEngine.ts` — Parametric IV Smiles SABR/SVI)
  - Sprint 17 (`executionEngine.ts` — Almgren-Chriss Liquidity & Slippage Minimizer)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Macroeconomic Blindspot in Quantitative & Retail Trading
Modern algorithmic trading systems and active retail traders frequently operate under the assumption of continuous, stationary price processes governed by geometric Brownian motion or localized technical momentum. However, empirical observation across the **National Stock Exchange of India (NSE)** and **Bombay Stock Exchange (BSE)** demonstrates that the single largest source of tail-risk catastrophic losses (and asymmetric alpha opportunities) stems from **discrete macroeconomic binary events and breaking news shocks**:
1. **The Sudden Regime Shift:** Macroeconomic announcements (e.g. unexpected 50 bps RBI repo rate hikes, sudden changes in Securities Transaction Tax (STT) on derivatives in the Union Budget, or hawkish US Federal Reserve FOMC guidance) invalidate historical statistical distributions within seconds.
2. **The "Pre-Event IV Jump" Premium:** In the days and hours preceding scheduled high-impact events, market makers withdraw passive liquidity and widen option spreads. Implied Volatility (IV) on NIFTY and BANKNIFTY contracts expands aggressively, inflating option premiums far beyond underlying statistical historical volatility.
3. **The "Post-Event IV Crush" Trap:** Uninformed retail option buyers aggressively purchase naked ATM/OTM Straddles or Calls/Puts immediately before major announcements hoping for explosive breakouts. Upon event resolution—even if the underlying spot price moves in the anticipated direction—the instantaneous collapse of implied volatility ("IV Crush") systematically wipes out 30% to 70% of option extrinsic value, producing immediate net drawdowns.
4. **Information Asymmetry in News Processing:** Institutional quantitative desks utilize high-throughput financial Natural Language Processing (NLP) to ingest news wires, central bank policy statements, and corporate earnings transcripts within milliseconds, scoring sentiment polarity, surprise metrics, and cross-asset spillover before retail traders can read the headline.

### 1.2 The Indian Market Reality: Key Macroeconomic Catalysts
In Indian capital markets, systematic event risk is concentrated across five primary pillars:
- **Reserve Bank of India (RBI) Monetary Policy Committee (MPC):** Bi-monthly interest rate decisions, policy stance shifts (*Accommodative*, *Neutral*, *Withdrawal of Accommodation*), headline CPI inflation projections, liquidity adjustment facility (LAF) cash reserve ratio (CRR) changes, and Governor press conferences directly driving BANKNIFTY, PSU Banks, NBFCs, and interest-rate sensitive sectors.
- **The Union Budget of India:** The annual fiscal policy statement delivered by the Hon. Finance Minister on February 1st. Triggers extreme intraday volatility across NIFTY (historical swings exceeding 3% to 5%), dramatic shifts in sectoral capital allocations (Capex, Defense, Railways, Infrastructure, Renewable Energy), and direct taxation amendments (STT, Capital Gains Tax, LTCG/STCG thresholds).
- **US Federal Reserve (FOMC) & Global Cross-Market Spillover:** Overnight monetary policy decisions, dot-plot projections, and Chair Powell's remarks transmit instantly into Indian capital markets via GIFT Nifty (formerly SGX Nifty), US Dollar Index (DXY), 10-Year US Treasury yields, and Foreign Institutional Investor (FII) net cash outflows.
- **Quarterly Corporate Earnings Season (Q1–Q4):** Earnings surprises (Revenue, EBITDA margins, PAT, and forward guidance), Standardized Unexpected Earnings (SUE), and the resulting Post-Earnings Announcement Drift (PEAD) across NIFTY 50 constituents.
- **Geopolitical & Commodity Shocks:** Sudden spikes in Brent Crude oil prices (> $85–$95/bbl) impacting India's current account deficit, Indian Rupee (USD/INR) depreciation, and downstream pressure on Oil Marketing Companies (OMCs) and paints/chemicals.

### 1.3 The TradeCraft AI Solution: Macro Sentiment & Event Risk Engine
**Sprint 18** establishes an institutional-grade **Macroeconomic Sentiment Analysis & News Event Risk Engine** for TradeCraft AI:
1. **Financial NLP Sentiment Engine:**
   - Multi-tier financial text analysis: Domain-adapted Loughran-McDonald financial dictionary lexicon scoring combined with LLM zero-shot classification via BYOK providers (OpenAI, Anthropic Claude, Google Gemini, Ollama, DeepSeek).
   - Extracts sentiment polarity ($\mathcal{S} \in [-1.0, +1.0]$), hawk/dove stance score, confidence intervals, entity resolution (NSE/BSE tickers, sectors, government bodies), and urgency levels.
   - Computes time-decayed composite sentiment curves factoring the event half-life.
2. **Pre-Event Implied Volatility Jump & Crush Predictor:**
   - Decomposes implied variance into continuous diffusive volatility and discrete jump-event variance using the **Dubinsky-Johannes / Merton Jump-Diffusion** model.
   - Calculates theoretical Pre-Event IV expansion ceiling and forecasts expected post-event **IV Crush Percentage** ($\Delta \text{IV}_{\text{crush}}$) and monetary Vega P&L impact.
   - Computes **Event-Implied Straddle Breakeven Move**: $E[\Delta S] \approx 0.8 \times (C_{\text{ATM}} + P_{\text{ATM}})$ to evaluate whether market pricing overestimates or underestimates expected realization.
3. **Composite Event Risk Score (ERS):**
   - Synthesizes event proximity (countdown to announcement), historical shock volatility beta, consensus ambiguity/dispersion, and market pricing into a unified index:
     $$\text{ERS} \in [0, 100]$$
   - Generates automated risk directives: **Normal** (0–39), **Elevated** (40–69), **High Risk** (70–84), and **Severe Regime** (85–100).
4. **Automated Portfolio Risk Circuit Breakers & Hedging Triggers:**
   - Interacts with `tradingEngine.ts` and `greeksHedgerEngine.ts` to enforce defensive protocols during high ERS windows: dynamic leverage caps (reducing maximum permitted margin), mandatory delta-gamma neutrality, and option collar/iron condor structure shifts.
5. **Interactive Macro Intelligence Studio (`EventRiskSentimentModal.tsx`):**
   - Real-time Macro Economic Calendar with countdown timers and consensus expectations.
   - Live simulated news wire and financial headline parser with sentiment polarity tags.
   - Volatility Event Forecaster charting pre-event IV runup vs post-event crush curves.
   - Scenario Stress Tester projecting portfolio P&L under historical shock replay (e.g. Budget 2020 crash, RBI surprise rate hike, FOMC hawkish shock).
   - 1-Click Event Strategy Recommender (Pre-Event Long Vega Spreads, Post-Event Volatility Harvest Iron Flys, Delta-Neutral Strangles).

---

## 2. Institutional Architecture & Processing Topography

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MACROECONOMIC DATA & NEWS INGESTION LAYER                       │
│  - Scheduled Economic Events (RBI MPC, Union Budget, US Fed FOMC, US CPI, Indian CPI)  │
│  - NSE/BSE Corporate Filings & Earnings Calendar (Reg 30 Disclosures, Results Dates)   │
│  - Live Financial News Wire (Macro Headlines, Global Geopolitics, Central Bank Text)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         src/lib/macroSentimentEngine.ts                                │
│                                                                                        │
│  ┌─────────────────────────────────────┐      ┌─────────────────────────────────────┐  │
│  │   1. Financial NLP Sentiment        │      │   2. Event Risk Scoring (ERS)       │  │
│  │   - Loughran-McDonald Lexicon       │      │   - Imminence Proximity Decay       │  │
│  │   - BYOK LLM Zero-Shot Classifier   │      │   - Historical Shock Beta Matrix    │  │
│  │   - Hawk/Dove & Stance Polarity     │      │   - Consensus Dispersion Ambiguity  │  │
│  │   - Exponential Half-Life Decay     │      │   - Composite Metric: ERS [0 - 100] │  │
│  └──────────────────┬──────────────────┘      └──────────────────┬──────────────────┘  │
│                     │                                            │                     │
│                     └─────────────────────┬──────────────────────┘                     │
│                                           │                                            │
│                                           ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │   3. Options Event Volatility Engine (Dubinsky-Johannes Jump Diffusion)          │  │
│  │   - Decompose Implied Variance: Total Variance = Diffusive Var + Jump Variance   │  │
│  │   - Model Pre-Event IV Inflation: sigma_imp(T) = sqrt(sigma_diff^2 + V_event^2/T)│  │
│  │   - Forecast Instantaneous Post-Event IV Crush: Delta_IV_crush                   │  │
│  │   - Compute Implied Event Move vs Historical Realized Move                       │  │
│  │   - Estimate Portfolio Net Vega Dollar Impact ($/vol point)                      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION WITH TRADECRAFT AI ENGINES                          │
│                                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐ │
│  │ optionsEngine.ts        │  │ greeksHedgerEngine.ts   │  │ quantDeskEngine.ts      │ │
│  │ - Supply live IV smiles │  │ - Dynamic Vega hedge    │  │ - Macro Regime updates  │ │
│  │ - Compute Greeks & IV   │  │ - Delta-neutral shields │  │ - Multi-agent consensus │ │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘ │
│                                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐ │
│  │ tradingEngine.ts        │  │ volatilitySurfaceEngine │  │ proofEngine.ts          │ │
│  │ - Leverage circuit down │  │ - SABR/SVI Smile skew   │  │ - Macro alpha hash stamp│ │
│  │ - Event margin limits   │  │ - Pre/post event curves │  │ - Verifiable trade proof│ │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘ │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   src/components/EventRiskSentimentModal.tsx                           │
│  - Real-Time Macro Event Countdown Bar & Severe Regime Alerts (HUD)                    │
│  - Interactive Macro News Wire with NLP Sentiment Tags & Entity Highlights             │
│  - Options Pre-Event IV Jump vs Post-Event Crush Dynamic Visualizer (SVG)              │
│  - Scenario Stress-Testing Matrix (Historical Indian Black Swan & Budget Replays)      │
│  - 1-Click Quantitative Event Play Dispatcher (Straddles, Collars, Iron Flys)          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Formulations & Quantitative Models

### 3.1 Financial NLP Sentiment Scoring & Time Decay Dynamics

Financial news text differs significantly from conversational language (e.g. the word "liability" or "crude" carries neutral or operational meaning in financial contexts, whereas standard sentiment models classify them as negative).

#### 3.1.1 Polarity & Hawk/Dove Metric Formulation
Let a document or headline $D$ consist of token set $\{w_1, w_2, \dots, w_M\}$.
1. **Lexical Polarity ($\mathcal{S}_{\text{lex}}$):**
   Using the domain-calibrated Loughran-McDonald (LM) financial dictionary:
   $$\mathcal{S}_{\text{lex}} = \frac{N_{\text{pos}} - N_{\text{neg}}}{N_{\text{pos}} + N_{\text{neg}} + \epsilon}$$
   where $N_{\text{pos}}$ and $N_{\text{neg}}$ denote counts of positive and negative financial terms, and $\epsilon = 1$ is a Laplace smoothing constant.
2. **Central Bank Monetary Stance ($\mathcal{H}_{\text{stance}} \in [-1.0, +1.0]$):**
   For RBI MPC and US Fed communications, tokens are mapped to Hawkish (tightening, rate hike, inflation combat, liquidity withdrawal) and Dovish (easing, rate cut, growth stimulus, liquidity injection) weightings:
   $$\mathcal{H}_{\text{stance}} = \frac{N_{\text{hawk}} - N_{\text{dove}}}{N_{\text{hawk}} + N_{\text{dove}} + \epsilon}$$
   - $\mathcal{H}_{\text{stance}} > +0.3$: **Hawkish** (Bearish for Equities/Bonds, Bullish for Currency/Yields).
   - $\mathcal{H}_{\text{stance}} \in [-0.3, +0.3]$: **Neutral / In-Line**.
   - $\mathcal{H}_{\text{stance}} < -0.3$: **Dovish** (Bullish for Equities/Bonds, Bearish for Yields).
3. **BYOK LLM Zero-Shot Fusion:**
   When an active API key is provided, the engine queries the model with a structured JSON schema, extracting:
   - Polarity score: $p_{\text{llm}} \in [-1.0, +1.0]$
   - Confidence: $c_{\text{llm}} \in [0.0, 1.0]$
   - Relevance: $r_{\text{llm}} \in [0.0, 1.0]$
   - Composite raw sentiment score:
     $$\mathcal{S}_{\text{raw}} = w_{\text{llm}} \cdot p_{\text{llm}} + (1 - w_{\text{llm}}) \cdot \mathcal{S}_{\text{lex}}$$
     *(Default: $w_{\text{llm}} = 0.75$ when BYOK available; fallback to $w_{\text{llm}} = 0$ using deterministic lexicon).*

#### 3.1.2 Exponential Information Decay
Market absorption of news exhibits exponential decay. The active sentiment $\mathcal{S}(t)$ at elapsed time $\Delta t = t - t_0$ decays according to:
$$\mathcal{S}(t) = \mathcal{S}_{\text{raw}} \cdot e^{-\lambda_{\text{decay}} \Delta t}$$
where the decay constant $\lambda_{\text{decay}}$ is calibrated to the event category half-life $t_{1/2} = \frac{\ln(2)}{\lambda_{\text{decay}}}$:
- **Breaking Flash News:** $t_{1/2} = 30 \text{ minutes}$ ($\lambda = 0.0231 \text{ min}^{-1}$).
- **Corporate Earnings Release:** $t_{1/2} = 4 \text{ hours}$ ($\lambda = 0.00289 \text{ min}^{-1}$).
- **RBI MPC Policy Announcement:** $t_{1/2} = 8 \text{ hours}$ ($\lambda = 0.00144 \text{ min}^{-1}$).
- **Union Budget:** $t_{1/2} = 48 \text{ hours}$ ($\lambda = 0.000241 \text{ min}^{-1}$).

---

### 3.2 Pre-Event Implied Volatility Jump Model (Dubinsky-Johannes Framework)

Standard Black-Scholes pricing assumes constant volatility $\sigma$ over the life of an option. Ahead of a scheduled discrete event occurring at time $t_{\text{event}} \in [0, T]$, options pricing incorporates a discrete jump variance.

#### 3.2.1 Variance Decomposition
The total integrated variance over the option lifespan $[0, T]$ is the sum of normal continuous diffusion variance plus the discrete event jump variance $V_{\text{event}}$:
$$\sigma_{\text{implied}}^2(T) \cdot T = \sigma_{\text{diff}}^2 \cdot T + V_{\text{event}}$$
where:
- $\sigma_{\text{diff}}$ is the baseline continuous diffusive volatility (the asset's "calm-market" annualized volatility).
- $V_{\text{event}} = \Delta \sigma_{\text{event}}^2$ is the discrete expected jump variance attributed entirely to the binary event.

#### 3.2.2 The Asymptotic Pre-Event IV Spike
Solving for annualized implied volatility $\sigma_{\text{implied}}(T)$:
$$\sigma_{\text{implied}}(T) = \sqrt{\sigma_{\text{diff}}^2 + \frac{V_{\text{event}}}{T}}$$
As expiration or event date approaches ($T \to 0$):
$$\lim_{T \to 0} \sigma_{\text{implied}}(T) = \infty$$
This explains why front-week options (e.g. expiring on or the day after Budget or RBI MPC) experience explosive IV spikes (often rising from 13% to 28%–35%), while back-month options exhibit much smaller IV expansion because $V_{\text{event}}$ is amortized over a much larger time horizon $T$.

#### 3.2.3 Event-Implied Price Move
The expected absolute price movement $E\left[\frac{|\Delta S|}{S}\right]$ implied by the market prior to the event can be extracted directly from the At-The-Money (ATM) Straddle ($C_{\text{ATM}} + P_{\text{ATM}}$):
$$E\left[\frac{|\Delta S|}{S}\right] \approx \sqrt{\frac{2}{\pi}} \cdot \sqrt{V_{\text{event}}} \approx \frac{C_{\text{ATM}} + P_{\text{ATM}}}{S_0} \times 0.7979$$
In practical trading shorthand for Indian index options:
$$\text{Implied Event Move (\%)} \approx \frac{C_{\text{ATM}} + P_{\text{ATM}}}{S_0} \times 0.80$$

---

### 3.3 Post-Event Volatility Crush (Instantaneous Variance Collapse)

The instant the event outcome is revealed (e.g. RBI announces repo rate unchanged at 10:00 AM IST, or Finance Minister concludes Budget speech at 1:00 PM IST), the event uncertainty collapses to zero:
$$V_{\text{event}} \to 0$$

#### 3.3.1 Post-Event Implied Volatility Collapse ($\Delta \text{IV}_{\text{crush}}$)
$$\sigma_{\text{post}} \approx \sigma_{\text{diff}}$$
$$\Delta \text{IV}_{\text{crush}} = \sigma_{\text{pre}} - \sigma_{\text{post}} = \sigma_{\text{pre}} - \sqrt{\sigma_{\text{pre}}^2 - \frac{V_{\text{event}}}{T}}$$
$$\text{Percentage IV Crush} = \frac{\sigma_{\text{pre}} - \sigma_{\text{post}}}{\sigma_{\text{pre}}} \times 100\%$$

#### 3.3.2 Monetary Vega Exposure & P&L Impact
For a portfolio holding options with aggregate net Vega ($\mathcal{V}_{\text{net}} = \sum_i q_i \nu_i$), the immediate monetary P&L impact strictly from IV Crush is:
$$\text{P\&L}_{\text{crush}} = \mathcal{V}_{\text{net}} \times (-\Delta \text{IV}_{\text{crush}})$$
- **Long Straddle / Long Call/Put (Net Positive Vega):** Incurs massive negative P&L from IV Crush unless the spot price moves significantly beyond the implied breakeven barrier.
- **Short Straddle / Iron Fly / Iron Condor (Net Negative Vega):** Captures large positive P&L from IV Crush, provided gamma risk is controlled.

---

### 3.4 Composite Event Risk Score (ERS) Formulation

The engine computes a single normalized index $\text{ERS} \in [0, 100]$ to quantify aggregate macro vulnerability:
$$\text{ERS} = \min\left(100, \; w_1 \cdot I_{\text{prox}} + w_2 \cdot H_{\text{shock}} + w_3 \cdot V_{\text{prem}} + w_4 \cdot D_{\text{disp}}\right)$$
Where weights satisfy $\sum w_i = 1.0$ (calibrated: $w_1 = 0.35, w_2 = 0.30, w_3 = 0.20, w_4 = 0.15$):

1. **Proximity Imminence Factor ($I_{\text{prox}} \in [0, 100]$):**
   $$I_{\text{prox}} = 100 \times \exp\left(-\frac{\Delta t_{\text{hours}}}{\tau_{\text{event}}}\right)$$
   where $\Delta t_{\text{hours}}$ is hours until event, and $\tau_{\text{event}}$ is the characteristic event window (24h for Budget, 8h for RBI, 4h for Earnings).
2. **Historical Shock Beta ($H_{\text{shock}} \in [0, 100]$):**
   Historical average 1-day absolute percentage return of NIFTY/BANKNIFTY on previous occurrences of this event category, normalized to 100 (e.g. Budget historical move = 3.2% $\to H = 90$; minor CPI release = 0.5% $\to H = 25$).
3. **Pre-Event Volatility Premium ($V_{\text{prem}} \in [0, 100]$):**
   The elevation of current implied volatility relative to its 30-day realized baseline:
   $$V_{\text{prem}} = \text{clamp}\left(100 \times \frac{\text{IV}_{\text{current}} - \text{RV}_{30}}{\text{RV}_{30}}, \; 0, \; 100\right)$$
4. **Consensus Ambiguity / Dispersion ($D_{\text{disp}} \in [0, 100]$):**
   Standard deviation of Bloomberg/Reuters economist survey expectations, or bid-ask spread expansion in front-month options.

#### Risk Regime Thresholds:
- **`NORMAL` (0 ≤ ERS < 40):** Standard quantitative operations. Full leverage permitted.
- **`ELEVATED` (40 ≤ ERS < 70):** Early warnings active. New overnight naked short positions flagged.
- **`HIGH_RISK` (70 ≤ ERS < 85):** Margin multiplier set to $1.5\times$. Max position size capped at 50%.
- **`SEVERE_REGIME` (85 ≤ ERS ≤ 100):** Event circuit breaker active. Restrict new naked single-leg options; require defined-risk hedges (Iron Condors, Spreads, Collars).

---

### 3.5 Post-Earnings Announcement Drift (PEAD) & SUE Model

For corporate earnings releases across NSE large-cap and mid-cap equities:
$$\text{SUE} = \frac{\text{Actual EPS} - \text{Consensus EPS}}{\sigma_{\text{forecast}}}$$
- **SUE > +2.0:** Strong positive earnings surprise. Generates positive drift alpha over $T+1$ to $T+10$ trading days.
- **SUE < -2.0:** Severe negative earnings surprise. Triggers downward institutional liquidation drift.
- **Guidance Multiplier:** Modulates SUE score based on management forward commentary (Revenue growth, Margin outlook).

---

## 4. Event Taxonomy & Domain Calibration for Indian Equity & Derivatives

| Event Key | Authority / Emitter | Primary Target Assets | Historical Shock $\sigma$ | Pre-Event IV Jump $\Delta \text{IV}$ | Characteristic $t_{1/2}$ | ERS Base Tier |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RBI_MPC_DECISION` | Reserve Bank of India | BANKNIFTY, NIFTY, PSU Banks, NBFCs | $\pm 1.8\% - 3.2\%$ | $+4\% \text{ to } +8\%$ | 8 Hours | `HIGH_RISK` |
| `UNION_BUDGET_INDIA` | Ministry of Finance | NIFTY, Infra, Capital Goods, PSU | $\pm 2.5\% - 5.8\%$ | $+8\% \text{ to } +18\%$ | 48 Hours | `SEVERE_REGIME` |
| `US_FED_FOMC_DECISION`| US Federal Reserve | GIFT Nifty, NIFTY IT, USDINR | $\pm 1.2\% - 2.4\%$ | $+2\% \text{ to } +5\%$ | 12 Hours | `ELEVATED` |
| `NSE_EARNINGS_ANNOUNCE`| Corporate Emittents | Single Stock F&O, Sector Indices | $\pm 3.5\% - 9.0\%$ | $+10\% \text{ to } +25\%$| 4 Hours | `HIGH_RISK` |
| `INDIA_CPI_INFLATION` | MOSPI | NIFTY, Bond Yields | $\pm 0.6\% - 1.4\%$ | $+1\% \text{ to } +3\%$ | 4 Hours | `NORMAL` |
| `CRUDE_OIL_SUPPLY_SHOCK`| OPEC / Geopolitical | Oil & Gas, OMCs, Paints, USDINR | $\pm 2.0\% - 4.5\%$ | $+5\% \text{ to } +12\%$ | 24 Hours | `HIGH_RISK` |

---

## 5. Algorithmic Engine Architecture (`macroSentimentEngine.ts`)

### 5.1 Core Types and Interfaces
```typescript
export type MacroEventCategory =
  | 'RBI_MPC_DECISION'
  | 'UNION_BUDGET_INDIA'
  | 'US_FED_FOMC_DECISION'
  | 'NSE_EARNINGS_ANNOUNCE'
  | 'INDIA_CPI_INFLATION'
  | 'CRUDE_OIL_SUPPLY_SHOCK'
  | 'GENERAL_ELECTIONS_INDIA';

export type EventRiskRegime = 'NORMAL' | 'ELEVATED' | 'HIGH_RISK' | 'SEVERE_REGIME';

export interface MacroEventRecord {
  id: string;
  name: string;
  category: MacroEventCategory;
  scheduledTime: string; // ISO 8601
  status: 'SCHEDULED' | 'IMMINENT' | 'IN_PROGRESS' | 'RESOLVED';
  consensusForecast?: string;
  previousValue?: string;
  actualValue?: string;
  targetAssets: string[]; // ['NIFTY', 'BANKNIFTY', 'HDFCBANK']
  historicalVolatilityBeta: number; // e.g. 2.8%
  preEventIvInflation: number; // e.g. +6.5% IV
  expectedCrushPct: number; // e.g. 35% IV crush
  description: string;
}

export interface NewsSentimentItem {
  id: string;
  timestamp: string;
  headline: string;
  source: string;
  category: MacroEventCategory;
  relatedTickers: string[];
  sentimentScore: number; // [-1.0, +1.0]
  stance: 'HAWKISH' | 'DOVISH' | 'NEUTRAL';
  urgency: 'FLASH' | 'HIGH' | 'ROUTINE';
  confidence: number; // [0.0, 1.0]
  decayedScore: number; // Post half-life decay
  summary: string;
}

export interface PreEventVolAnalysis {
  eventId: string;
  symbol: string;
  spotPrice: number;
  timeToEventHours: number;
  timeToExpiryDays: number;
  currentIv: number; // e.g. 22.5%
  baselineDiffusiveIv: number; // e.g. 14.0%
  discreteEventVariance: number; // V_event
  theoreticalPreEventIv: number;
  forecastPostEventIv: number;
  expectedCrushPct: number; // % drop in IV
  impliedStraddleMovePct: number; // Expected spot move %
  impliedMovePoints: number; // In index points
  atmStraddlePrice: number; // Price of ATM Call + Put
  netVegaExposureValue: number; // Total portfolio $ / point
  estimatedVegaPnlImpact: number; // In INR
}

export interface MacroEventRiskState {
  currentTimestamp: string;
  overallErs: number; // [0 - 100]
  regime: EventRiskRegime;
  activeEvents: MacroEventRecord[];
  imminentEvent?: MacroEventRecord;
  compositeSentiment: number; // [-1.0 to +1.0]
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  recentHeadlines: NewsSentimentItem[];
  riskDirectives: {
    maxPermittedLeverage: number; // e.g. 1.5x down from 5x
    restrictNakedSelling: boolean;
    mandatoryStopLossBps: number;
    recommendedStrategies: string[];
  };
}
```

### 5.2 Key Computational Methods in `macroSentimentEngine.ts`
1. `computeLexiconSentiment(text: string): { polarity: number; stance: 'HAWKISH'|'DOVISH'|'NEUTRAL'; confidence: number }`
2. `applyExponentialTimeDecay(sentiment: number, eventTime: number, currentTime: number, category: MacroEventCategory): number`
3. `calculateEventRiskScore(event: MacroEventRecord, currentIv: number, baselineRv: number, hoursRemaining: number): number`
4. `calculateDubinskyJohannesIvJump(baselineIv: number, eventVariance: number, timeToExpiryDays: number): number`
5. `calculatePostEventIvCrush(currentIv: number, baselineIv: number, timeToExpiryDays: number): { postIv: number; crushPct: number }`
6. `estimatePortfolioVegaPnl(positions: any[], crushPct: number): { totalVega: number; estimatedPnlImpactInr: number }`
7. `simulateMacroScenario(positions: any[], scenarioId: string): MacroScenarioResult`
8. `getEventRiskState(): MacroEventRiskState`

---

## 6. UI Architecture & Interactive Studio (`EventRiskSentimentModal.tsx`)

The UI component `src/components/EventRiskSentimentModal.tsx` provides an interactive command center for macroeconomic monitoring and event-driven options trading:

1. **Top Header HUD & Event Risk Gauge:**
   - Real-time **Event Risk Score (ERS)** circular meter (0 to 100) color-coded by regime (`NORMAL` in Cyan, `ELEVATED` in Amber, `HIGH_RISK` in Orange, `SEVERE_REGIME` in Crimson).
   - Live countdown ticker to the next imminent macro catalyst (e.g. `⏳ RBI MPC Decision in: 03h : 24m : 18s`).
   - Active Risk Directives banner (e.g. `⚠️ SEVERE REGIME: Margin Multiplier 1.5x | Naked Short Options Disabled`).
2. **Interactive Macroeconomic Economic Calendar:**
   - Tabbed view: `Upcoming Catalysts`, `Historical Shocks & Realized Moves`, `Corporate Earnings`.
   - Cards display Event Category, Target Index, Consensus vs Actual, Historical $\sigma$, and expected IV crush %.
   - 1-Click "Inspect Pre-Event Volatility Smile" button.
3. **Live Financial News Wire & Sentiment Stream:**
   - Real-time simulated breaking headlines with sentiment polarity tags (`+0.82 Bullish`, `-0.74 Hawkish`), source badge (RBI, Reuters, Mint, BSE), and timestamp.
   - Interactive search and category filter (Monetary Policy, Fiscal/Budget, Corporate Earnings, Commodities).
   - BYOK LLM Re-Analysis toggle: Allows re-scoring headlines with selected active LLM provider.
4. **Pre-Event IV Jump & Post-Event IV Crush Simulator:**
   - Interactive SVG graphical curve comparing **Pre-Event Implied Volatility Curve** vs **Post-Event Baseline Smile**.
   - Sliders to adjust:
     - Baseline RV ($\sigma_{\text{diff}}$): 10% to 30%
     - Expected Event Jump Magnitude: 1.0% to 6.0%
     - Days to Expiration ($T$): 1 to 30 days
   - Live metrics readout:
     - **Pre-Event ATM IV:** e.g. $24.8\%$
     - **Post-Event Crushed IV:** e.g. $14.2\%$ ($-42.7\%$ Crush)
     - **Implied Straddle Move:** $\pm 420 \text{ pts } (\pm 1.85\%)$
     - **Portfolio Vega P&L Impact:** e.g. $-₹34,800$ on net long vega.
5. **Historical Scenario Stress Tester & Event Replay:**
   - 1-Click stress test button across iconic Indian market shocks:
     - *Union Budget 2020 (Pandemic Capex Shock):* $-5.6\%$ Spot Shock, $+12.4\%$ IV Surge.
     - *RBI Emergency Rate Hike (May 2022 40 bps Surprise):* $-2.2\%$ Bank Nifty Shock.
     - *US Fed 75 bps Jumbo Hike (Sept 2022):* $-1.8\%$ Gap Down, $+3.5\%$ IV.
     - *Budget 2024 (Derivatives STT Hike Announcement):* High intraday whipsaw.
   - Computes exact simulated rupee drawdowns across user's active paper portfolio.
6. **Quantitative Event Strategy Dispatcher:**
   - Recommends mathematically optimal structures tailored to the current ERS regime:
     - *Pre-Event Volatility Expansion:* Long ATM Calendar Spread (exploits front-month IV jump with back-month cushion).
     - *Post-Event Volatility Harvesting:* Short Iron Butterfly / Iron Condor (captures instantaneous post-event IV crush).
     - *Directional Earnings Play:* Bull/Bear Risk Reversal with Vega Shield.
   - 1-Click "Execute in Paper Portfolio" integration dispatching orders directly into `tradingEngine.ts`.

---

## 7. Acceptance Criteria & Test Verification Matrix

| AC ID | Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **AC-EVT-01** | **Lexical & Stance Sentiment Scoring:** Financial sentiment analyzer correctly distinguishes positive, negative, and hawkish/dovish statements using domain lexicon, with confidence scoring in $[0, 1]$. | Unit test in `test/macroSentimentEngine.test.mjs`. |
| **AC-EVT-02** | **Exponential Time Decay:** News sentiment decays exponentially with elapsed time according to specified event half-lives ($t_{1/2}$), satisfying $\mathcal{S}(t_0 + t_{1/2}) = 0.5 \times \mathcal{S}(t_0)$. | Unit test verifying mathematical half-life consistency. |
| **AC-EVT-03** | **Dubinsky-Johannes Jump Formulation:** Implied volatility calculation properly scales jump variance $V_{\text{event}}/T$, showing that as $T \to 0$, pre-event IV expands monotonically ($\sigma_{\text{imp}}(T_1) > \sigma_{\text{imp}}(T_2)$ for $T_1 < T_2$). | Unit test asserting pre-event IV term structure expansion. |
| **AC-EVT-04** | **Post-Event IV Crush Calculation:** Instantaneous IV crush mathematically collapses implied volatility to baseline diffusive volatility ($\sigma_{\text{post}} \to \sigma_{\text{diff}}$), correctly computing percentage drop and Vega P&L. | Unit test verifying post-event crush equations. |
| **AC-EVT-05** | **Implied Straddle Breakeven Extraction:** Straddle implied move accurately computes $0.8 \times (C_{\text{ATM}} + P_{\text{ATM}}) / S_0$ within $\pm 0.1\%$ tolerance. | Unit test testing index points and percentage calculation. |
| **AC-EVT-06** | **Composite Event Risk Score (ERS):** ERS score accurately maps to range $[0, 100]$ and switches regimes correctly (`NORMAL` $\to$ `ELEVATED` $\to$ `HIGH_RISK` $\to$ `SEVERE_REGIME`) as event proximity decreases. | Unit test testing proximity and shock beta weighting. |
| **AC-EVT-07** | **Portfolio Scenario Stress Replay:** Stress test correctly recalculates portfolio Greeks and P&L under historical Indian market shocks (Budget 2020, RBI surprise hike). | Unit test testing portfolio impact evaluation. |
| **AC-EVT-08** | **Interactive UI Studio Component:** `EventRiskSentimentModal.tsx` renders countdown HUD, news ticker, IV crush simulator, scenario stress tester, and executes recommended strategy orders without console errors. | Component compilation & test suite verification. |

---

## 8. Non-Functional Requirements & Security Protocols

1. **Computational Latency & High-Frequency Responsiveness:**
   - Deterministic lexicon sentiment scoring and ERS calculation must complete in $< 5 \text{ ms}$ per invocation.
   - IV jump curve calculations across 20 time slices must execute in $< 2 \text{ ms}$.
2. **BYOK Privacy & Zero Data Leakage:**
   - If user employs BYOK LLM models for deep news sentiment reasoning, API keys remain strictly in browser `localStorage` or memory, never transmitted to external servers except direct encrypted HTTPS calls to provider endpoints (OpenAI/Anthropic/Google/Ollama).
3. **Graceful Offline & Fallback Execution:**
   - If network or BYOK API fails, the engine falls back deterministically to the local Loughran-McDonald financial dictionary and pre-cached economic calendar without interruption.
4. **State Persistence & Memory Footprint:**
   - Historical news headlines and simulated event states are persisted in `localStorage` under `tradecraft_macro_sentiment_v1` with automatic pruning of entries older than 7 days.
