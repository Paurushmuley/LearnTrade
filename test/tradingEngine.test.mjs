import test from 'node:test';
import assert from 'node:assert/strict';

function calculateStatutoryCharges(side, product, price, quantity) {
  const turnover = price * quantity;
  if (turnover <= 0) return { totalCharges: 0 };
  const brokerage = Math.min(20, turnover * 0.0003);
  const stt = product === 'CNC' ? turnover * 0.001 : (side === 'SELL' ? turnover * 0.00025 : 0);
  const exchange = turnover * 0.0000297;
  const sebi = turnover * 0.000001;
  const stamp = side === 'BUY' ? (product === 'CNC' ? turnover * 0.00015 : turnover * 0.00003) : 0;
  const gst = (brokerage + exchange + sebi) * 0.18;
  const total = brokerage + stt + exchange + sebi + stamp + gst;
  return { totalCharges: Number(total.toFixed(2)) };
}

function calculateRequiredMargin(product, price, quantity) {
  const value = price * quantity;
  return product === 'MIS' ? value * 0.2 : value;
}

function processFilledOrder(state, order, currentMarketPrice, wasPending = false) {
  const { symbol, side, product, quantity, executedPrice = currentMarketPrice, charges } = order;
  const positions = [...state.positions];
  const existingIndex = positions.findIndex(p => p.symbol === symbol && p.product === product);

  let availableCash = state.availableCash - charges.totalCharges;
  let usedMargin = state.usedMargin;
  let newAudits = [...state.tradeAudits];

  if (existingIndex === -1) {
    const signedQty = side === 'BUY' ? quantity : -quantity;
    const requiredMargin = calculateRequiredMargin(product, executedPrice, quantity);
    if (!wasPending) {
      availableCash -= requiredMargin;
      usedMargin += requiredMargin;
    }
    positions.push({
      symbol,
      product,
      quantity: signedQty,
      averagePrice: executedPrice,
      currentPrice: currentMarketPrice,
      realizedPnL: 0,
      totalChargesPaid: charges.totalCharges,
    });
  } else {
    const pos = { ...positions[existingIndex] };
    const currentQty = pos.quantity;
    const isSameDirection = (currentQty > 0 && side === 'BUY') || (currentQty < 0 && side === 'SELL');

    if (isSameDirection) {
      const totalNewQty = currentQty + (side === 'BUY' ? quantity : -quantity);
      const newInvested = (Math.abs(currentQty) * pos.averagePrice) + (quantity * executedPrice);
      pos.averagePrice = Number((newInvested / Math.abs(totalNewQty)).toFixed(2));
      pos.quantity = totalNewQty;
      pos.totalChargesPaid += charges.totalCharges;
      const additionalMargin = calculateRequiredMargin(product, executedPrice, quantity);
      if (!wasPending) {
        availableCash -= additionalMargin;
        usedMargin += additionalMargin;
      }
      positions[existingIndex] = pos;
    } else {
      const closeQty = Math.min(Math.abs(currentQty), quantity);
      const grossTradePnL = currentQty > 0
        ? (executedPrice - pos.averagePrice) * closeQty
        : (pos.averagePrice - executedPrice) * closeQty;
      const marginReleased = calculateRequiredMargin(product, pos.averagePrice, closeQty);
      availableCash += marginReleased + grossTradePnL;
      usedMargin = Math.max(0, usedMargin - marginReleased);

      newAudits.unshift({
        tradeId: order.id,
        symbol,
        grossPnL: Number(grossTradePnL.toFixed(2)),
        netPnL: Number((grossTradePnL - charges.totalCharges).toFixed(2)),
      });

      const remainingQty = Math.abs(currentQty) - closeQty;
      const reverseQty = quantity - closeQty;

      if (remainingQty === 0) {
        positions.splice(existingIndex, 1);
        if (reverseQty > 0) {
          const revSignedQty = side === 'BUY' ? reverseQty : -reverseQty;
          const revMargin = calculateRequiredMargin(product, executedPrice, reverseQty);
          if (!wasPending) {
            availableCash -= revMargin;
            usedMargin += revMargin;
          }
          positions.push({
            symbol,
            product,
            quantity: revSignedQty,
            averagePrice: executedPrice,
            currentPrice: currentMarketPrice,
            realizedPnL: 0,
            totalChargesPaid: 0,
          });
        }
      } else {
        pos.quantity = currentQty > 0 ? remainingQty : -remainingQty;
        positions[existingIndex] = pos;
      }
    }
  }

  return {
    ...state,
    availableCash: Number(availableCash.toFixed(2)),
    usedMargin: Number(usedMargin.toFixed(2)),
    positions,
    tradeAudits: newAudits,
  };
}

function placeOrder(state, params) {
  const { symbol, side, type, product, quantity, price, currentMarketPrice } = params;
  const executionPrice = type === 'MARKET' ? currentMarketPrice : (price || currentMarketPrice);
  const existingPos = state.positions.find(p => p.symbol === symbol && p.product === product);
  const isClosing = Boolean(existingPos && (
    (existingPos.quantity > 0 && side === 'SELL') ||
    (existingPos.quantity < 0 && side === 'BUY')
  ));
  const closingQty = isClosing ? Math.min(Math.abs(existingPos.quantity), quantity) : 0;
  const openingQty = quantity - closingQty;
  const effectiveMargin = calculateRequiredMargin(product, executionPrice, openingQty);
  const charges = calculateStatutoryCharges(side, product, executionPrice, quantity);

  if (state.availableCash < effectiveMargin + charges.totalCharges) {
    return { newState: state, order: null, error: 'Insufficient margin' };
  }

  const initialStatus = type === 'MARKET' ? 'FILLED' : 'PENDING';
  const order = {
    id: 'ORD-TEST-1',
    symbol,
    side,
    type,
    product,
    quantity,
    price,
    executedPrice: initialStatus === 'FILLED' ? executionPrice : undefined,
    status: initialStatus,
    charges,
    placedAt: new Date().toISOString(),
  };

  let nextState = { ...state, orders: [order, ...state.orders] };
  if (initialStatus === 'FILLED') {
    nextState = processFilledOrder(nextState, order, currentMarketPrice, false);
  } else {
    nextState.availableCash -= effectiveMargin;
    nextState.usedMargin += effectiveMargin;
  }

  return { newState: nextState, order };
}

function checkPendingOrders(state, marketPrices) {
  let currentState = { ...state };
  let hasChanges = false;

  const updatedOrders = currentState.orders.map(order => {
    if (order.status !== 'PENDING') return order;
    const currentPrice = marketPrices[order.symbol];
    if (!currentPrice) return order;

    let shouldFill = false;
    if (order.type === 'LIMIT') {
      if (order.side === 'BUY' && currentPrice <= (order.price || 0)) shouldFill = true;
      if (order.side === 'SELL' && currentPrice >= (order.price || 0)) shouldFill = true;
    }

    if (shouldFill) {
      hasChanges = true;
      const filledOrder = { ...order, status: 'FILLED', executedPrice: order.price || currentPrice };
      currentState = processFilledOrder(currentState, filledOrder, currentPrice, true);
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

const INITIAL_STATE = {
  startingCapital: 500000,
  availableCash: 500000,
  usedMargin: 0,
  positions: [],
  orders: [],
  tradeAudits: [],
  disciplineScore: 85,
};

test('Trading Engine - MIS 5x Leverage vs CNC 100% Margin', () => {
  const price = 3000;
  const quantity = 100;
  const turnover = price * quantity; // ₹3,00,000

  const misMargin = calculateRequiredMargin('MIS', price, quantity);
  assert.equal(misMargin, turnover * 0.2, 'MIS margin must be exactly 20%');
  assert.equal(misMargin, 60000);

  const cncMargin = calculateRequiredMargin('CNC', price, quantity);
  assert.equal(cncMargin, turnover, 'CNC margin must be 100%');
  assert.equal(cncMargin, 300000);
});

test('Trading Engine - Market Buy Order Execution & Margin Deduction', () => {
  const res = placeOrder(INITIAL_STATE, {
    symbol: 'RELIANCE',
    side: 'BUY',
    type: 'MARKET',
    product: 'MIS',
    quantity: 50,
    currentMarketPrice: 2900,
  });

  assert.equal(res.error, undefined);
  assert.equal(res.order.status, 'FILLED');
  assert.equal(res.order.executedPrice, 2900);

  const expectedMargin = 2900 * 50 * 0.2; // 29000
  assert.equal(res.newState.usedMargin, expectedMargin);
  assert.equal(res.newState.positions.length, 1);
  assert.equal(res.newState.positions[0].quantity, 50);
});

test('Trading Engine - Closing Position Margin Release and P&L Realization', () => {
  const buyRes = placeOrder(INITIAL_STATE, {
    symbol: 'RELIANCE',
    side: 'BUY',
    type: 'MARKET',
    product: 'MIS',
    quantity: 50,
    currentMarketPrice: 2900,
  });

  const sellRes = placeOrder(buyRes.newState, {
    symbol: 'RELIANCE',
    side: 'SELL',
    type: 'MARKET',
    product: 'MIS',
    quantity: 50,
    currentMarketPrice: 2950,
  });

  assert.equal(sellRes.error, undefined);
  assert.equal(sellRes.newState.positions.length, 0, 'Position must be closed');
  assert.equal(sellRes.newState.usedMargin, 0, 'All margin must be released');
  assert.equal(sellRes.newState.tradeAudits[0].grossPnL, 2500);
});

test('Trading Engine - Pending Limit Order Does Not Double-Deduct Margin on Fill', () => {
  const limitRes = placeOrder(INITIAL_STATE, {
    symbol: 'TCS',
    side: 'BUY',
    type: 'LIMIT',
    product: 'MIS',
    quantity: 20,
    price: 2800,
    currentMarketPrice: 2850,
  });

  assert.equal(limitRes.order.status, 'PENDING');
  const reservedMargin = calculateRequiredMargin('MIS', 2800, 20); // 11200
  assert.equal(limitRes.newState.usedMargin, reservedMargin);

  const filledState = checkPendingOrders(limitRes.newState, { TCS: 2795 });
  const filledOrder = filledState.orders.find(o => o.id === limitRes.order.id);
  assert.equal(filledOrder?.status, 'FILLED');

  assert.equal(filledState.usedMargin, reservedMargin, 'Used margin must remain exactly reservedMargin');
  assert.equal(filledState.positions.length, 1);
});

test('Trading Engine - Position Reversal Flips Direction Correctly', () => {
  const longRes = placeOrder(INITIAL_STATE, {
    symbol: 'INFY',
    side: 'BUY',
    type: 'MARKET',
    product: 'MIS',
    quantity: 40,
    currentMarketPrice: 1800,
  });

  const flipRes = placeOrder(longRes.newState, {
    symbol: 'INFY',
    side: 'SELL',
    type: 'MARKET',
    product: 'MIS',
    quantity: 100,
    currentMarketPrice: 1850,
  });

  assert.equal(flipRes.error, undefined);
  assert.equal(flipRes.newState.positions.length, 1);
  assert.equal(flipRes.newState.positions[0].quantity, -60, 'Must flip to Short 60');
  assert.equal(flipRes.newState.positions[0].averagePrice, 1850);
  assert.equal(flipRes.newState.tradeAudits.length, 1);
  assert.equal(flipRes.newState.tradeAudits[0].grossPnL, 2000);
});
