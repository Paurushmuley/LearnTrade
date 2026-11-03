# BRD-007: Broker Tradebook Importer & AI Behavioral Post-Mortem Auditor

## 1. Executive Summary & Problem Statement
A major frustration for retail traders in India is the disconnect between real-money trading statements and educational improvement. Retail traders on discount brokers like **Zerodha (Kite)** and **Groww** accumulate hundreds of executed trades without an automated way to diagnose cognitive trading biases. 

SEBI's landmark 2024 study revealed that **93% of retail F&O traders lost money**, paying an average of ₹50,000+ in statutory transaction fees (STT, exchange turnover fees, GST) while suffering from classic behavioral traps:
1. **The Disposition Effect:** Cutting winning trades too early while holding losing trades indefinitely in hope of breakeven.
2. **Revenge Trading:** Re-entering the market within minutes of a loss with amplified position sizes.
3. **Fee-Erosion Trap:** High-frequency scalping that is gross-profitable but deeply net-negative after statutory charges.
4. **Martingale Escalation:** Doubling position size following consecutive drawdowns.

**BRD-007** implements an in-browser Broker Tradebook Importer and Behavioral Post-Mortem Auditor in TradeCraft AI. Traders can upload their native Zerodha or Groww CSV tradebooks (or load built-in realistic sample accounts) to receive an institutional-grade psychological audit, quantitative bias scores, and an actionable BYOK AI debrief.

---

## 2. Supported Broker Formats & Data Ingestion
1. **Zerodha Kite Tradebook CSV:**
   - Standard columns: `symbol`, `trade_date`, `exchange`, `segment`, `trade_type` (`buy`/`sell`), `quantity`, `price`, `order_execution_time`.
2. **Groww Tradebook CSV:**
   - Standard columns: `Stock Name`, `Symbol`, `Type` (`BUY`/`SELL`), `Quantity`, `Average Price`, `Execution Date & Time`.
3. **Generic Standard CSV Fallback:**
   - Columns: `symbol`, `type`, `qty`, `price`, `time`, `pnl`.
4. **Instant Built-in Demo Statements:**
   - **Scenario 1:** *The High-Churn Scalper (Revenge Trading & Fee Erosion)* — Demonstrates how ₹18,000 gross profit turns into -₹12,400 net loss after ₹30,400 statutory STT/brokerage fees and 4 rapid revenge cycles.
   - **Scenario 2:** *The Disciplined Swing Trader (Asymmetric R:R)* — Demonstrates a 48% win rate with 2.8:1 profit factor and clean 0% revenge trading.

---

## 3. Mathematical Behavioral Bias Scoring Model

### 3.1 Disposition Effect (Loss-Holding Ratio $D_R$)
$$D_R = \frac{\text{Average Holding Duration of Losing Trades (minutes)}}{\text{Average Holding Duration of Winning Trades (minutes)}}$$
- **Healthy Threshold:** $D_R \le 1.2$
- **Critical Warning:** $D_R > 2.5$ (holding losers more than $2.5\times$ longer than winners).

### 3.2 Revenge Trading Index ($RTI$)
Measures trades initiated within $T_{\text{revenge}} \le 10\text{ minutes}$ after a closed losing trade, where order volume $V_{\text{new}} \ge V_{\text{prev}}$.
$$RTI = \frac{N_{\text{revenge trades}}}{N_{\text{total trades}}} \times 100\%$$
- **Low Risk:** $0\% - 5\%$
- **Severe Hazard:** $> 15\%$

### 3.3 Fee Erosion Ratio ($FER$)
Calculates the proportion of gross trading profits consumed by exchange charges, STT, and brokerage:
$$FER = \frac{\text{Total Statutory Taxes \& Charges}}{\max(\text{Gross Profit}, 1)} \times 100\%$$
- **Alert:** If $FER > 40\%$, the strategy is mathematically inefficient in Indian market tax regimes.

### 3.4 Martingale Escalation Factor ($MEF$)
Detects whether the trader sequentially scales up position size after back-to-back losses ($L_1 \to L_2 \to L_3$ with increasing quantities).

---

## 4. BYOK AI Auditor Integration
Uses the user's connected Gemini / OpenAI / Ollama API key to synthesize:
1. **Psychological Profile:** Identifies trader type (e.g., "Impulsive Over-Leveraged Scalper", "Hesitant Loss-Averse Swing Trader").
2. **Specific Leak Diagnosis:** Pinpoints the exact hours and stocks where the trader lost the most discipline.
3. **Remediation Prescription:** Provides 3 concrete behavioral rules (e.g., "Mandatory 30-minute terminal lockout after 2 consecutive stop-outs").

---

## 5. Security & Zero-Knowledge BYOK Guarantee
- All CSV parsing, trade pairing, and metric generation execute **100% locally client-side in the browser**.
- Financial statements are never uploaded to any remote server or persistent database.
- Prompt payload to user's AI provider only transmits aggregated behavioral metrics and anonymized trade stats.
