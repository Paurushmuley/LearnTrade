import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure algorithmic functions mirrored for native fast Node.js test execution
function getLotSizeForSymbol(symbol) {
  const upper = symbol.toUpperCase();
  if (upper.includes('BANKNIFTY')) return 15;
  if (upper.includes('NIFTY')) return 25;
  if (upper.includes('FINNIFTY')) return 40;
  return 1;
}

function calculateSlaveQuantity(params) {
  const { masterQuantity, masterEquity, slaveEquity, riskMultiplier, sizingMode, symbol, fillPrice, availableCash } =
    params;

  if (masterQuantity <= 0) return { quantity: 0 };

  const lotSize = getLotSizeForSymbol(symbol);
  let rawQty = masterQuantity;

  if (sizingMode === 'EQUITY_PROPORTIONAL') {
    const equityRatio = slaveEquity / Math.max(1000, masterEquity);
    rawQty = masterQuantity * equityRatio * riskMultiplier;
  } else if (sizingMode === 'FIXED_MULTIPLIER') {
    rawQty = masterQuantity * riskMultiplier;
  }

  let roundedQty = 1;
  if (lotSize > 1) {
    roundedQty = Math.max(lotSize, Math.round(rawQty / lotSize) * lotSize);
  } else {
    roundedQty = Math.max(1, Math.round(rawQty));
  }

  const marginFactor = 0.20; // MIS 5x leverage
  const requiredMargin = roundedQty * fillPrice * marginFactor;

  if (requiredMargin > availableCash) {
    const affordableLots = Math.floor(availableCash / (fillPrice * marginFactor * lotSize));
    if (affordableLots <= 0) {
      return {
        quantity: 0,
        error: `Insufficient margin`,
      };
    }
    roundedQty = affordableLots * lotSize;
  }

  return { quantity: roundedQty };
}

function simulateBrokerExecution(params) {
  const { masterPrice, side, broker, maxSlippagePct, forcedSlippagePct } = params;

  let meanLatency = 55;
  let baseSlipRate = 0.0002;

  if (broker === 'GROWW') {
    meanLatency = 135;
    baseSlipRate = 0.0005;
  } else if (broker === 'UPSTOX') {
    meanLatency = 75;
    baseSlipRate = 0.0003;
  }

  const slippageFraction = forcedSlippagePct !== undefined ? forcedSlippagePct / 100 : baseSlipRate * 1.2;
  const slippageBps = Number((slippageFraction * 10000).toFixed(1));

  const priceDelta = masterPrice * slippageFraction;
  const slaveFillPrice = Number(
    (side === 'BUY' ? masterPrice + priceDelta : masterPrice - priceDelta).toFixed(2)
  );

  const priceDeviationPct = Math.abs(slaveFillPrice - masterPrice) / masterPrice;
  if (priceDeviationPct > maxSlippagePct / 100) {
    return {
      status: 'ABORTED_SLIPPAGE_BREACH',
      slaveFillPrice: masterPrice,
      slippageBps,
      latencyMs: meanLatency,
      errorMessage: `Slippage deviation exceeded ceiling`,
    };
  }

  return {
    status: 'FILLED',
    slaveFillPrice,
    slippageBps,
    latencyMs: meanLatency,
  };
}

function executeEmergencyKillSwitch(slaves, currentPrices) {
  let liquidatedCount = 0;

  const updatedSlaves = slaves.map((slave) => {
    let releasedCash = slave.usedMargin;
    let incrementalRealized = 0;

    slave.openPositions.forEach((pos) => {
      liquidatedCount++;
      const currentPrice = currentPrices[pos.symbol] || pos.averagePrice;
      const grossPnL =
        pos.quantity > 0
          ? (currentPrice - pos.averagePrice) * pos.quantity
          : (pos.averagePrice - currentPrice) * Math.abs(pos.quantity);

      incrementalRealized += grossPnL;
    });

    return {
      ...slave,
      availableCash: slave.availableCash + releasedCash + incrementalRealized,
      usedMargin: 0,
      realizedPnL: slave.realizedPnL + incrementalRealized,
      openPositions: [],
    };
  });

  return { updatedSlaves, liquidatedCount };
}

describe('TradeCraft Institutional Trade Copier & Cross-Account Multi-Broker Tests (Sprint 12)', () => {
  test('TC-COP-TEST-01: Proportional Equity and Multiplier Sizing Math', () => {
    // Master: ₹10,00,000 equity, buys 100 shares of RELIANCE
    // Slave 1: ₹5,00,000 equity (0.5 ratio), 1.0x multiplier -> Expect 50 shares
    const slave1 = calculateSlaveQuantity({
      masterQuantity: 100,
      masterEquity: 1000000,
      slaveEquity: 500000,
      riskMultiplier: 1.0,
      sizingMode: 'EQUITY_PROPORTIONAL',
      symbol: 'RELIANCE',
      fillPrice: 2850,
      availableCash: 500000,
    });
    assert.equal(slave1.quantity, 50, 'Slave 1 with 0.5 equity ratio should copy 50 shares');

    // Slave 2: ₹5,00,000 equity, 0.5x multiplier -> Expect 25 shares
    const slave2 = calculateSlaveQuantity({
      masterQuantity: 100,
      masterEquity: 1000000,
      slaveEquity: 500000,
      riskMultiplier: 0.5,
      sizingMode: 'EQUITY_PROPORTIONAL',
      symbol: 'RELIANCE',
      fillPrice: 2850,
      availableCash: 500000,
    });
    assert.equal(slave2.quantity, 25, 'Slave 2 with 0.5 equity ratio and 0.5x multiplier should copy 25 shares');

    // Slave 3: Fixed Multiplier 2.0x -> Expect 200 shares
    const slave3 = calculateSlaveQuantity({
      masterQuantity: 100,
      masterEquity: 1000000,
      slaveEquity: 250000,
      riskMultiplier: 2.0,
      sizingMode: 'FIXED_MULTIPLIER',
      symbol: 'RELIANCE',
      fillPrice: 2850,
      availableCash: 250000,
    });
    assert.equal(slave3.quantity, 200, 'Fixed multiplier 2.0x should copy 200 shares');
  });

  test('TC-COP-TEST-02: Indian Exchange Lot Size Rounding Fidelity', () => {
    // 1. Cash Equity: lot size is 1
    assert.equal(getLotSizeForSymbol('RELIANCE'), 1);
    assert.equal(getLotSizeForSymbol('TCS'), 1);

    // 2. NIFTY Derivatives: lot size is strictly 25
    assert.equal(getLotSizeForSymbol('NIFTY 24200 CE'), 25);
    assert.equal(getLotSizeForSymbol('NIFTY FUT'), 25);

    // Master trades 50 NIFTY contracts (2 lots)
    // Slave raw sizing would be 35 shares -> Must round to 25 or 50
    const nifSlave = calculateSlaveQuantity({
      masterQuantity: 50,
      masterEquity: 1000000,
      slaveEquity: 700000,
      riskMultiplier: 1.0,
      sizingMode: 'EQUITY_PROPORTIONAL',
      symbol: 'NIFTY 24200 CE',
      fillPrice: 150,
      availableCash: 500000,
    });
    assert.equal(nifSlave.quantity % 25, 0, 'NIFTY slave quantity must be an exact multiple of 25');
    assert.ok(nifSlave.quantity >= 25, 'Slave quantity must be at least 1 lot');

    // 3. BANKNIFTY Derivatives: lot size is strictly 15
    assert.equal(getLotSizeForSymbol('BANKNIFTY 51500 PE'), 15);
    const bnfSlave = calculateSlaveQuantity({
      masterQuantity: 30,
      masterEquity: 1000000,
      slaveEquity: 450000,
      riskMultiplier: 1.0,
      sizingMode: 'EQUITY_PROPORTIONAL',
      symbol: 'BANKNIFTY 51500 PE',
      fillPrice: 220,
      availableCash: 500000,
    });
    assert.equal(bnfSlave.quantity % 15, 0, 'BANKNIFTY slave quantity must be an exact multiple of 15');
  });

  test('TC-COP-TEST-03: Margin Sufficiency Safety Haircuts & Rejection', () => {
    // Slave has only ₹5,000 cash, but 100 shares of RELIANCE requires ₹57,000 margin (20% of 2850*100)
    // Sizing should automatically scale down to affordable shares
    const scaledDown = calculateSlaveQuantity({
      masterQuantity: 100,
      masterEquity: 1000000,
      slaveEquity: 5000,
      riskMultiplier: 1.0,
      sizingMode: 'FIXED_MULTIPLIER',
      symbol: 'RELIANCE',
      fillPrice: 2850,
      availableCash: 5000, // Only ₹5,000
    });
    assert.ok(scaledDown.quantity <= 8, `Quantity should be scaled down to affordable amount, got ${scaledDown.quantity}`);

    // Slave has only ₹50, cannot afford even 1 share of RELIANCE (₹570 margin) -> Reject
    const rejected = calculateSlaveQuantity({
      masterQuantity: 100,
      masterEquity: 1000000,
      slaveEquity: 50,
      riskMultiplier: 1.0,
      sizingMode: 'FIXED_MULTIPLIER',
      symbol: 'RELIANCE',
      fillPrice: 2850,
      availableCash: 50,
    });
    assert.equal(rejected.quantity, 0, 'Inability to afford 1 share must return 0 quantity');
    assert.ok(rejected.error, 'Must provide margin rejection reason');
  });

  test('TC-COP-TEST-04: Broker Latency Profiles & Adverse Slippage', () => {
    // Zerodha Kite: low latency (55ms), low base slippage
    const zerodha = simulateBrokerExecution({
      masterPrice: 2850.0,
      side: 'BUY',
      broker: 'ZERODHA_KITE',
      maxSlippagePct: 0.35,
    });
    assert.equal(zerodha.status, 'FILLED');
    assert.ok(zerodha.latencyMs <= 80, `Zerodha latency should be ~55ms, got ${zerodha.latencyMs}`);
    assert.ok(zerodha.slaveFillPrice >= 2850.0, 'Adverse slippage on BUY must result in higher fill price');

    // Groww: higher latency (~135ms), higher slippage
    const groww = simulateBrokerExecution({
      masterPrice: 2850.0,
      side: 'BUY',
      broker: 'GROWW',
      maxSlippagePct: 0.35,
    });
    assert.equal(groww.status, 'FILLED');
    assert.ok(groww.latencyMs > zerodha.latencyMs, 'Groww latency should be higher than Zerodha');
  });

  test('TC-COP-TEST-05: Slippage Deviation Filter Protection Breach', () => {
    // Normal slippage (0.02% <= 0.35% threshold) -> FILLED
    const normal = simulateBrokerExecution({
      masterPrice: 2850.0,
      side: 'BUY',
      broker: 'ZERODHA_KITE',
      maxSlippagePct: 0.35,
      forcedSlippagePct: 0.05,
    });
    assert.equal(normal.status, 'FILLED');

    // Excessive slippage spike (0.50% > 0.35% threshold) -> ABORTED_SLIPPAGE_BREACH
    const breached = simulateBrokerExecution({
      masterPrice: 2850.0,
      side: 'BUY',
      broker: 'ZERODHA_KITE',
      maxSlippagePct: 0.35,
      forcedSlippagePct: 0.50, // 50 bps breach
    });
    assert.equal(breached.status, 'ABORTED_SLIPPAGE_BREACH', 'Excessive slippage must trigger Slippage Guard abortion');
    assert.ok(breached.errorMessage, 'Must provide slippage breach explanation');
  });

  test('TC-COP-TEST-06: Emergency Global Kill Switch Immediate Liquidation', () => {
    const activeSlaves = [
      {
        id: 's1',
        availableCash: 400000,
        usedMargin: 100000,
        realizedPnL: 5000,
        openPositions: [
          {
            symbol: 'RELIANCE',
            quantity: 50,
            averagePrice: 2800,
          },
        ],
      },
      {
        id: 's2',
        availableCash: 200000,
        usedMargin: 50000,
        realizedPnL: -2000,
        openPositions: [
          {
            symbol: 'TCS',
            quantity: 20,
            averagePrice: 4100,
          },
        ],
      },
    ];

    const currentPrices = {
      RELIANCE: 2850, // +50 profit per share -> +2500
      TCS: 4050,      // -50 loss per share -> -1000
    };

    const result = executeEmergencyKillSwitch(activeSlaves, currentPrices);

    assert.equal(result.liquidatedCount, 2, 'Must liquidate both open positions');
    assert.equal(result.updatedSlaves[0].openPositions.length, 0, 'Slave 1 must have 0 open positions');
    assert.equal(result.updatedSlaves[0].usedMargin, 0, 'Slave 1 used margin must be 0');
    assert.equal(result.updatedSlaves[0].availableCash, 400000 + 100000 + 2500, 'Slave 1 cash must reflect released margin + realized P&L');

    assert.equal(result.updatedSlaves[1].openPositions.length, 0, 'Slave 2 must have 0 open positions');
    assert.equal(result.updatedSlaves[1].usedMargin, 0, 'Slave 2 used margin must be 0');
  });
});
