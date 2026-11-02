import test from 'node:test';
import assert from 'node:assert/strict';

// Test statutory calculations
function calculateStatutoryCharges(side, product, price, quantity) {
  const turnover = price * quantity;
  if (turnover <= 0) return { totalCharges: 0 };

  const brokerage = product === 'MIS' ? Math.min(20, turnover * 0.0003) : Math.min(20, turnover * 0.0003);
  const stt = product === 'CNC' ? turnover * 0.001 : (side === 'SELL' ? turnover * 0.00025 : 0);
  const exchangeCharges = turnover * 0.0000297;
  const sebiCharges = turnover * 0.000001;
  const stampDuty = side === 'BUY' ? (product === 'CNC' ? turnover * 0.00015 : turnover * 0.00003) : 0;
  const gst = (brokerage + exchangeCharges + sebiCharges) * 0.18;
  const totalCharges = brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst;

  return {
    turnover,
    brokerage: Number(brokerage.toFixed(2)),
    stt: Number(stt.toFixed(2)),
    exchangeCharges: Number(exchangeCharges.toFixed(2)),
    sebiCharges: Number(sebiCharges.toFixed(2)),
    stampDuty: Number(stampDuty.toFixed(2)),
    gst: Number(gst.toFixed(2)),
    totalCharges: Number(totalCharges.toFixed(2)),
  };
}

test('Indian Statutory Tax Engine - Delivery (CNC) Buy Order', () => {
  // Buy 100 shares of Reliance at ₹2500 = ₹2,50,000 turnover
  const charges = calculateStatutoryCharges('BUY', 'CNC', 2500, 100);

  assert.equal(charges.turnover, 250000);
  assert.equal(charges.brokerage, 20.00); // Max ₹20
  assert.equal(charges.stt, 250.00); // 0.1% of 2,50,000
  assert.equal(charges.stampDuty, 37.50); // 0.015% of 2,50,000
  assert.ok(charges.gst > 0);
  assert.ok(charges.totalCharges > 310);
});

test('Indian Statutory Tax Engine - Intraday (MIS) Sell Order', () => {
  // Sell 100 shares of Reliance at ₹2550 = ₹2,55,000 turnover
  const charges = calculateStatutoryCharges('SELL', 'MIS', 2550, 100);

  assert.equal(charges.turnover, 255000);
  assert.equal(charges.brokerage, 20.00);
  assert.equal(charges.stt, 63.75); // 0.025% of 2,55,000
  assert.equal(charges.stampDuty, 0); // No stamp duty on sell
  assert.ok(charges.totalCharges > 85 && charges.totalCharges < 100);
});
