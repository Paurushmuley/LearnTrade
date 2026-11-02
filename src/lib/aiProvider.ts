import { AIConfig, BacktestResult, Candle, OrderSide, Position, TradeAudit } from '../types/trading';

/**
 * Validates whether an API key / endpoint is active and responsive
 */
export async function testAIConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
  try {
    if (config.provider === 'gemini') {
      if (!config.geminiKey) return { success: false, message: 'Google Gemini API key is missing' };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with the single word: READY' }] }]
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `Gemini API returned status ${res.status}` };
      }
      return { success: true, message: 'Google Gemini connected successfully (gemini-2.5-flash)' };
    }

    if (config.provider === 'openai') {
      if (!config.openaiKey) return { success: false, message: 'OpenAI API key is missing' };
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Respond with the single word: READY' }],
          max_tokens: 5,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `OpenAI returned status ${res.status}` };
      }
      return { success: true, message: 'OpenAI connected successfully (gpt-4o-mini)' };
    }

    if (config.provider === 'ollama') {
      const url = config.ollamaUrl || 'http://localhost:11434';
      const res = await fetch(`${url}/api/tags`).catch(() => null);
      if (!res || !res.ok) {
        return { success: false, message: `Could not reach local Ollama endpoint at ${url}. Ensure Ollama is running.` };
      }
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name).join(', ');
      return { success: true, message: `Ollama connected. Available models: ${models || 'none found'}` };
    }

    return { success: false, message: 'Unsupported provider' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection test failed' };
  }
}

/**
 * Universal text generation dispatcher across Gemini, OpenAI, and Ollama
 */
export async function queryAIProvider(
  config: AIConfig,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  if (config.provider === 'gemini') {
    if (!config.geminiKey) throw new Error('Please configure your Gemini API Key in BYOK Settings');
    const model = config.model || 'gemini-2.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...(systemInstruction ? [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${systemInstruction}` }] }] : []),
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1200,
        }
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini request failed: ${res.statusText}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (config.provider === 'openai') {
    if (!config.openaiKey) throw new Error('Please configure your OpenAI API Key in BYOK Settings');
    const model = config.model || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI request failed: ${res.statusText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (config.provider === 'ollama') {
    const url = config.ollamaUrl || 'http://localhost:11434';
    const model = config.model || 'llama3';
    const res = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: systemInstruction ? `System: ${systemInstruction}\nUser: ${prompt}` : prompt,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama request failed: ${res.statusText}`);
    const data = await res.json();
    return data.response || '';
  }

  throw new Error('Unsupported AI Provider');
}

/**
 * AI Trading Coach: Generates in-depth psychology & execution review for a trade
 */
export async function getAITradeReview(
  config: AIConfig | null,
  trade: TradeAudit
): Promise<{ coachFeedback: string; suggestedAction: string }> {
  if (!config || (!config.geminiKey && !config.openaiKey && config.provider !== 'ollama')) {
    // Graceful offline heuristic when BYOK is not yet configured
    const isWin = trade.netPnL > 0;
    return {
      coachFeedback: isWin
        ? `[Heuristic Review] Solid execution on ${trade.symbol}. You took home ₹${trade.netPnL} net profit after covering ₹${trade.charges} in taxes. Keep adhering to your risk-reward ratio.`
        : `[Heuristic Review] Capital protection alert on ${trade.symbol}: net loss was ₹${Math.abs(trade.netPnL)}. Ensure your stop-loss was placed before entering and avoid impulsive re-entries.`,
      suggestedAction: isWin ? 'Record technical trigger in your journal' : 'Review chart high/low and take a 10m pause',
    };
  }

  const prompt = `You are an elite institutional risk manager and trading psychologist reviewing an Indian equity paper trade:
Trade Details:
- Symbol: ${trade.symbol} (${trade.side})
- Entry Price: ₹${trade.entryPrice}
- Exit Price: ₹${trade.exitPrice}
- Quantity: ${trade.quantity}
- Gross P&L: ₹${trade.grossPnL}
- Statutory Taxes/Brokerage Paid: ₹${trade.charges}
- Net P&L: ₹${trade.netPnL}
- Flags: FOMO: ${trade.behavioralFlags.fomoEntry}, Revenge: ${trade.behavioralFlags.revengeTrade}, Overleveraged: ${trade.behavioralFlags.overleveraged}

Provide a concise, direct, 2-3 sentence coaching feedback and 1 specific actionable improvement.
Format as JSON: {"feedback": "...", "action": "..."}`;

  try {
    const raw = await queryAIProvider(config, prompt, 'You are an expert Indian equity market trading coach. Respond in valid JSON only.');
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      coachFeedback: parsed.feedback || 'Trade reviewed.',
      suggestedAction: parsed.action || 'Continue following trading plan.',
    };
  } catch {
    return {
      coachFeedback: `Trade concluded with net P&L of ₹${trade.netPnL} on ${trade.symbol}.`,
      suggestedAction: 'Review risk/reward profile before next entry.',
    };
  }
}
