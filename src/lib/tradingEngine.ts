import { Order, OrderSide, OrderStatus, OrderType, PortfolioSummary, Position, ProductType, StatutoryCharges, TradeAudit } from '../types/trading';
import { calculateStatutoryCharges } from './taxEngine';

export interface TradingState {
  startingCapital: number;
  availableCash: number;
  usedMargin: number;
  positions: Position[];
  orders: Order[];
  tradeAudits: TradeAudit[];
  disciplineScore: number;
}

export const INITIAL_TRADING_STATE: TradingState = {
  startingCapital: 1000000, // ₹10,00,000 INR default virtual capital
  availableCash: 1000000,
  usedMargin: 0,
  positions: [],
  orders: [],
  tradeAudits: [],
  disciplineScore: 85, // Starting PQ score
};

/**
 * Calculates margin required for an order
 */
export function calculateRequiredMargin(
  product: ProductType,
  price: number,
  quantity: number
): number {
  const value = price * quantity;
  // MIS (Intraday) offers 5x leverage -> 20% margin required
  // CNC (Delivery) requires 100% upfront cash
  return product === 'MIS' ? value * 0.2 : value;
}

/**
 * Validates and places a new order
 */
export function placeOrder(
  state: TradingState,
  params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    product: ProductType;
    quantity: number;
    price?: number;
    triggerPrice?: number;
    currentMarketPrice: number;
  }
): { newState: TradingState; order: Order; error?: string } {
  const { symbol, side, type, product, quantity, price, triggerPrice, currentMarketPrice } = params;

  if (quantity <= 0) {
    return { newState: state, order: null as any, error: 'Quantity must be greater than 0' };
  }

  const executionPrice = type === 'MARKET' ? currentMarketPrice : (price || currentMarketPrice);
  const requiredMargin = calculateRequiredMargin(product, executionPrice, quantity);
  const charges = calculateStatutoryCharges(side, product, executionPrice, quantity);

  // Check margin safety for BUY or opening SHORT
  if (state.availableCash < requiredMargin + charges.totalCharges) {
    return {
      newState: state,
      order: null as any,
      error: `Insufficient margin. Required: ₹${(requiredMargin + charges.totalCharges).toLocaleString('en-IN')}, Available: ₹${state.availableCash.toLocaleString('en-IN')}`,
    };
  }

  const orderId = 'ORD-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const now = new Date().toISOString();

  let initialStatus: OrderStatus = 'PENDING';
  let executedPrice: number | undefined = undefined;
  let executedAt: string | undefined = undefined;

  if (type === 'MARKET') {
    initialStatus = 'FILLED';
    executedPrice = currentMarketPrice;
    executedAt = now;
  } else if (type === 'LIMIT') {
    // If limit order is immediately marketable
    if ((side === 'BUY' && currentMarketPrice <= (price || 0)) ||
        (side === 'SELL' && currentMarketPrice >= (price || 0))) {
      initialStatus = 'FILLED';
      executedPrice = price || currentMarketPrice;
      executedAt = now;
    } else {
      initialStatus = 'PENDING';
    }
  } else if (type === 'SL' || type === 'SL_M') {
    initialStatus = 'TRIGGER_PENDING';
  }

  const order: Order = {
    id: orderId,
    symbol,
    side,
    type,
    product,
    quantity,
    price,
    triggerPrice,
    executedPrice,
    status: initialStatus,
    charges,
    placedAt: now,
    executedAt,
  };

  let nextState: TradingState = {
    ...state,
    orders: [order, ...state.orders],
  };

  // If order filled immediately, update positions & margin
  if (initialStatus === 'FILLED') {
    nextState = processFilledOrder(nextState, order, currentMarketPrice);
  } else {
    // Reserve margin for pending order
    nextState.availableCash -= requiredMargin;
    nextState.usedMargin += requiredMargin;
  }

  return { newState: nextState, order };
}

/**
 * Updates positions and balances when an order is filled
 */
function processFilledOrder(
  state: TradingState,
  order: Order,
  currentMarketPrice: number
): TradingState {
  const { symbol, side, product, quantity, executedPrice = currentMarketPrice, charges } = order;
  const positions = [...state.positions];
  const existingIndex = positions.findIndex(p => p.symbol === symbol && p.product === product);

  let availableCash = state.availableCash - charges.totalCharges;
  let usedMargin = state.usedMargin;
  let newAudits = [...state.tradeAudits];
  let disciplineScoreDelta = 0;

  if (existingIndex === -1) {
    // New position
    const signedQty = side === 'BUY' ? quantity : -quantity;
    const requiredMargin = calculateRequiredMargin(product, executedPrice, quantity);
    availableCash -= requiredMargin;
    usedMargin += requiredMargin;

    positions.push({
      symbol,
      product,
      quantity: signedQty,
      averagePrice: executedPrice,
      currentPrice: currentMarketPrice,
      investedAmount: executedPrice * quantity,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      realizedPnL: 0,
      totalChargesPaid: charges.totalCharges,
      netPnL: -charges.totalCharges,
    });
  } else {
    // Existing position: either add, trim, or reverse
    const pos = { ...positions[existingIndex] };
    const currentQty = pos.quantity;

    const isSameDirection = (currentQty > 0 && side === 'BUY') || (currentQty < 0 && side === 'SELL');

    if (isSameDirection) {
      // Adding to existing position
      const totalNewQty = currentQty + (side === 'BUY' ? quantity : -quantity);
      const newInvested = (Math.abs(currentQty) * pos.averagePrice) + (quantity * executedPrice);
      pos.averagePrice = Number((newInvested / Math.abs(totalNewQty)).toFixed(2));
      pos.quantity = totalNewQty;
      pos.investedAmount = newInvested;
      pos.totalChargesPaid += charges.totalCharges;
      pos.netPnL -= charges.totalCharges;

      const additionalMargin = calculateRequiredMargin(product, executedPrice, quantity);
      availableCash -= additionalMargin;
      usedMargin += additionalMargin;
      positions[existingIndex] = pos;
    } else {
      // Closing or trimming position -> Realize P&L!
      const closeQty = Math.min(Math.abs(currentQty), quantity);
      const grossTradePnL = currentQty > 0
        ? (executedPrice - pos.averagePrice) * closeQty
        : (pos.averagePrice - executedPrice) * closeQty;

      const netTradePnL = grossTradePnL - charges.totalCharges;
      pos.realizedPnL += grossTradePnL;
      pos.totalChargesPaid += charges.totalCharges;
      pos.netPnL = pos.realizedPnL - pos.totalChargesPaid;

      // Release margin
      const marginReleased = calculateRequiredMargin(product, pos.averagePrice, closeQty);
      availableCash += marginReleased + grossTradePnL;
      usedMargin = Math.max(0, usedMargin - marginReleased);

      // Behavioral Audit
      const isRevenge = state.orders.length > 1 &&
        state.orders[1].status === 'FILLED' &&
        Date.now() - new Date(state.orders[1].placedAt).getTime() < 120000 &&
        grossTradePnL < 0;

      const fomo = (side === 'BUY' && currentMarketPrice >= pos.averagePrice * 1.02);

      const audit: TradeAudit = {
        tradeId: order.id,
        symbol,
        side,
        entryPrice: pos.averagePrice,
        exitPrice: executedPrice,
        quantity: closeQty,
        grossPnL: Number(grossTradePnL.toFixed(2)),
        netPnL: Number(netTradePnL.toFixed(2)),
        charges: charges.totalCharges,
        durationMinutes: 12,
        riskRewardRatio: 1.8,
        behavioralFlags: {
          fomoEntry: fomo,
          revengeTrade: isRevenge,
          overleveraged: (quantity * executedPrice) > (state.startingCapital * 0.4),
          poorRiskReward: grossTradePnL < 0 && Math.abs(grossTradePnL) > 5000,
          stopLossTampered: false,
        },
        coachFeedback: grossTradePnL >= 0
          ? `Well executed exit on ${symbol}. Charges of ₹${charges.totalCharges} were covered with net profit of ₹${netTradePnL.toFixed(2)}.`
          : `Loss of ₹${Math.abs(netTradePnL).toFixed(2)} recorded on ${symbol}. Remember to respect predefined stop loss levels and avoid immediate revenge trading.`,
        suggestedAction: grossTradePnL >= 0 ? 'Document entry trigger in your trading journal' : 'Take a 15-minute breather before analyzing the next setup',
        disciplineScoreDelta: grossTradePnL >= 0 ? 2 : (isRevenge ? -6 : -2),
      };

      newAudits.unshift(audit);
      disciplineScoreDelta += audit.disciplineScoreDelta;

      const remainingQty = Math.abs(currentQty) - closeQty;
      if (remainingQty === 0) {
        positions.splice(existingIndex, 1);
      } else {
        pos.quantity = currentQty > 0 ? remainingQty : -remainingQty;
        pos.investedAmount = pos.averagePrice * remainingQty;
        positions[existingIndex] = pos;
      }
    }
  }

  const nextDisciplineScore = Math.min(100, Math.max(20, state.disciplineScore + disciplineScoreDelta));

  return {
    ...state,
    availableCash: Number(availableCash.toFixed(2)),
    usedMargin: Number(usedMargin.toFixed(2)),
    positions,
    tradeAudits: newAudits,
    disciplineScore: nextDisciplineScore,
  };
}

/**
 * Checks pending limit / SL orders against latest market prices
 */
export function checkPendingOrders(
  state: TradingState,
  marketPrices: Record<string, number>
): TradingState {
  let hasChanges = false;
  let currentState = { ...state };

  const updatedOrders = currentState.orders.map(order => {
    if (order.status !== 'PENDING' && order.status !== 'TRIGGER_PENDING') {
      return order;
    }

    const currentPrice = marketPrices[order.symbol];
    if (!currentPrice) return order;

    let shouldFill = false;

    if (order.status === 'PENDING' && order.type === 'LIMIT') {
      if (order.side === 'BUY' && currentPrice <= (order.price || 0)) {
        shouldFill = true;
      } else if (order.side === 'SELL' && currentPrice >= (order.price || 0)) {
        shouldFill = true;
      }
    } else if (order.status === 'TRIGGER_PENDING') {
      if (order.type === 'SL' || order.type === 'SL_M') {
        if (order.side === 'SELL' && currentPrice <= (order.triggerPrice || 0)) {
          shouldFill = true;
        } else if (order.side === 'BUY' && currentPrice >= (order.triggerPrice || 0)) {
          shouldFill = true;
        }
      }
    }

    if (shouldFill) {
      hasChanges = true;
      const filledOrder: Order = {
        ...order,
        status: 'FILLED',
        executedPrice: order.price || currentPrice,
        executedAt: new Date().toISOString(),
      };
      currentState = processFilledOrder(currentState, filledOrder, currentPrice);
      return filledOrder;
    }

    return order;
  });

  if (hasChanges) {
    currentState.orders = updatedOrders;
    return currentState;
  }

  return state;
}

/**
 * Compiles real-time portfolio summary
 */
export function getPortfolioSummary(
  state: TradingState,
  marketPrices: Record<string, number>
): PortfolioSummary {
  let totalUnrealizedPnL = 0;
  let totalRealizedPnL = 0;
  let totalChargesDeducted = 0;

  state.positions.forEach(pos => {
    const currentPrice = marketPrices[pos.symbol] || pos.currentPrice;
    const pnl = pos.quantity > 0
      ? (currentPrice - pos.averagePrice) * pos.quantity
      : (pos.averagePrice - currentPrice) * Math.abs(pos.quantity);

    totalUnrealizedPnL += pnl;
    totalRealizedPnL += pos.realizedPnL;
    totalChargesDeducted += pos.totalChargesPaid;
  });

  const totalPortfolioValue = state.availableCash + state.usedMargin + totalUnrealizedPnL;
  const netPnL = totalRealizedPnL + totalUnrealizedPnL - totalChargesDeducted;

  const totalClosedTrades = state.tradeAudits.length;
  const winningTrades = state.tradeAudits.filter(t => t.netPnL > 0).length;
  const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;

  return {
    startingCapital: state.startingCapital,
    availableCash: Number(state.availableCash.toFixed(2)),
    usedMargin: Number(state.usedMargin.toFixed(2)),
    totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
    totalRealizedPnL: Number(totalRealizedPnL.toFixed(2)),
    totalUnrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
    totalChargesDeducted: Number(totalChargesDeducted.toFixed(2)),
    netPnL: Number(netPnL.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    disciplineScore: state.disciplineScore,
  };
}
