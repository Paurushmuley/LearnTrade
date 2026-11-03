import { NextRequest, NextResponse } from 'next/server';
import { checkCircuitBreaker, DEFAULT_BOT, validateWebhookPayload, WebhookLog } from '@/lib/webhookEngine';
import { calculateStatutoryCharges } from '@/lib/taxEngine';
import { POPULAR_TICKERS } from '@/lib/marketData';

// In-memory logs for the running server instance
let webhookLogs: WebhookLog[] = [];
let currentBotState = { ...DEFAULT_BOT };

export async function GET() {
  return NextResponse.json({
    status: 'ONLINE',
    service: 'TradeCraft AI Webhook Gateway',
    version: '1.0.0',
    bot: {
      name: currentBotState.name,
      enabled: currentBotState.enabled,
      circuitBreakerLimit: currentBotState.maxDailyLoss,
      currentDailyLoss: currentBotState.currentDailyLoss,
      totalAlertsReceived: currentBotState.totalAlertsReceived,
      ordersFilled: currentBotState.ordersFilled,
    },
    recentLogs: webhookLogs.slice(0, 10),
  });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await req.json().catch(() => null);

    if (!rawBody) {
      return NextResponse.json(
        { success: false, error: 'Empty or invalid JSON body. Please provide a JSON payload.' },
        { status: 400 }
      );
    }

    // 1. Validate Schema
    const validation = validateWebhookPayload(rawBody);
    if (!validation.valid || !validation.cleanPayload) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const payload = validation.cleanPayload;

    // 2. Authenticate Token
    if (payload.token !== currentBotState.secretToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid bot secret token' },
        { status: 401 }
      );
    }

    currentBotState.totalAlertsReceived += 1;

    // 3. Circuit Breaker Check
    const breaker = checkCircuitBreaker(currentBotState);
    if (!breaker.allowed) {
      currentBotState.ordersRejected += 1;
      const logEntry: WebhookLog = {
        id: 'LOG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        timestamp: new Date().toISOString(),
        botId: currentBotState.id,
        botName: currentBotState.name,
        symbol: payload.symbol,
        side: payload.side,
        quantity: payload.quantity,
        price: payload.price || 0,
        status: 'REJECTED',
        reason: breaker.reason,
        latencyMs: Date.now() - startTime,
        statutoryTaxes: 0,
      };
      webhookLogs.unshift(logEntry);

      return NextResponse.json(
        { success: false, error: breaker.reason, status: 'REJECTED' },
        { status: 403 }
      );
    }

    // 4. Determine Market Price for Symbol
    const matchedTicker = POPULAR_TICKERS.find((t) => t.symbol === payload.symbol);
    const executionPrice = payload.price || matchedTicker?.currentPrice || 2800.0;

    // 5. Compute Realistic Indian Statutory Taxes
    const taxes = calculateStatutoryCharges(
      payload.side,
      payload.product || 'MIS',
      executionPrice,
      payload.quantity
    );

    currentBotState.ordersFilled += 1;
    const latencyMs = Date.now() - startTime;
    const orderId = 'WH-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    // 6. Record Audit Log
    const logEntry: WebhookLog = {
      id: orderId,
      timestamp: new Date().toISOString(),
      botId: currentBotState.id,
      botName: currentBotState.name,
      symbol: payload.symbol,
      side: payload.side,
      quantity: payload.quantity,
      price: executionPrice,
      status: 'FILLED',
      latencyMs,
      statutoryTaxes: taxes.totalCharges,
    };
    webhookLogs.unshift(logEntry);

    return NextResponse.json({
      success: true,
      orderId,
      symbol: payload.symbol,
      side: payload.side,
      quantity: payload.quantity,
      executedPrice: executionPrice,
      product: payload.product || 'MIS',
      statutoryTaxes: taxes.totalCharges,
      status: 'FILLED',
      latencyMs,
      timestamp: logEntry.timestamp,
      message: `Automated order filled successfully via Webhook. Deducted ₹${taxes.totalCharges} in statutory taxes.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error processing webhook' },
      { status: 500 }
    );
  }
}
