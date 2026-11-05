// Sprint 20 — Real-Time FIX Protocol Gateway & Order Flow Simulator Tests
// Pure JS test suite using Node.js native test runner (node:test)
// Tests: Checksum modulo 256, Tag-value serialization, Parsing,
// Synthetic Exchange Matching Engine lifecycle, and Drop-Copy Compliance Ledger

import { test } from 'node:test';
import assert from 'node:assert/strict';

const SOH = '\x01';

// Pure JS mirrors of FIX Engine functions
function calculateFixChecksum(rawWithoutChecksum) {
  let sum = 0;
  for (let i = 0; i < rawWithoutChecksum.length; i++) {
    sum += rawWithoutChecksum.charCodeAt(i);
  }
  const mod = sum % 256;
  return mod.toString().padStart(3, '0');
}

function serializeFixMessage(msgType, seqNum, senderCompId, targetCompId, bodyFields, timestamp = '20261105-04:30:00.000', delimiter = SOH) {
  const headerFields = [
    `35=${msgType}`,
    `49=${senderCompId}`,
    `56=${targetCompId}`,
    `34=${seqNum}`,
    `52=${timestamp}`,
  ];

  const bodyParts = [...headerFields, ...bodyFields.map((f) => `${f.tag}=${f.value}`)].join(delimiter) + delimiter;
  const bodyLength = bodyParts.length;
  const fullHeaderAndBody = `8=FIX.4.4${delimiter}9=${bodyLength}${delimiter}${bodyParts}`;
  const checksum = calculateFixChecksum(fullHeaderAndBody);
  return `${fullHeaderAndBody}10=${checksum}${delimiter}`;
}

function parseFixMessage(rawInput, direction = 'INBOUND') {
  const normalized = rawInput.replace(/\|/g, SOH);
  const rawParts = normalized.split(SOH).filter((p) => p.includes('='));

  const fields = [];
  let msgType = '0';
  let seqNum = 0;
  let senderCompId = 'UNKNOWN';
  let targetCompId = 'UNKNOWN';
  let checksum = '';
  let bodyLength = 0;

  for (const part of rawParts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const tag = parseInt(part.substring(0, eqIdx), 10);
    const value = part.substring(eqIdx + 1);

    fields.push({ tag, value });

    if (tag === 35) msgType = value;
    else if (tag === 34) seqNum = parseInt(value, 10);
    else if (tag === 49) senderCompId = value;
    else if (tag === 56) targetCompId = value;
    else if (tag === 10) checksum = value;
    else if (tag === 9) bodyLength = parseInt(value, 10);
  }

  const checksumIdx = normalized.indexOf(`10=${checksum}`);
  let isValidChecksum = true;
  if (checksumIdx !== -1) {
    const rawToVerify = normalized.substring(0, checksumIdx);
    const calculatedChecksum = calculateFixChecksum(rawToVerify);
    isValidChecksum = calculatedChecksum === checksum;
  }

  return {
    direction,
    msgType,
    seqNum,
    senderCompId,
    targetCompId,
    fields,
    raw: rawInput,
    isValidChecksum,
    checksum,
    bodyLength,
  };
}

function simulateExchangeExecution(orderMsg, currentExchangeSeqNum, marketReferencePrice) {
  const getTagValue = (tag) => orderMsg.fields.find((f) => f.tag === tag)?.value;

  const clOrdId = getTagValue(11) || 'UNKNOWN_ORD';
  const symbol = getTagValue(55) || 'NIFTY';
  const sideCode = getTagValue(54) || '1';
  const side = sideCode === '1' ? 'BUY' : 'SELL';
  const orderQty = parseInt(getTagValue(38) || '50', 10);
  const ordType = getTagValue(40) || '2';
  const limitPrice = parseFloat(getTagValue(44) || marketReferencePrice.toString());

  const exchangeOrderId = `EXCH-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const senderCompId = orderMsg.targetCompId;
  const targetCompId = orderMsg.senderCompId;

  let seq = currentExchangeSeqNum;
  const executionReports = [];
  const dropCopies = [];

  // Stage 1: Order Acknowledged (OrdStatus=0 New, ExecType=0 New)
  const execIdAck = `ACK-101`;
  const ackRaw = serializeFixMessage('8', seq++, senderCompId, targetCompId, [
    { tag: 37, value: exchangeOrderId },
    { tag: 11, value: clOrdId },
    { tag: 17, value: execIdAck },
    { tag: 150, value: '0' },
    { tag: 39, value: '0' },
    { tag: 55, value: symbol },
    { tag: 54, value: sideCode },
    { tag: 38, value: orderQty },
    { tag: 44, value: limitPrice.toFixed(2) },
    { tag: 14, value: 0 },
    { tag: 151, value: orderQty },
    { tag: 6, value: '0.00' },
  ]);

  const ackMsg = parseFixMessage(ackRaw, 'INBOUND');
  executionReports.push(ackMsg);

  dropCopies.push({
    id: `dc-${execIdAck}`,
    direction: 'DROP_COPY',
    originalSeqNum: ackMsg.seqNum,
    clOrdID: clOrdId,
    orderID: exchangeOrderId,
    execID: execIdAck,
    symbol,
    side,
    orderQty,
    cumQty: 0,
    leavesQty: orderQty,
    lastPx: 0,
    avgPx: 0,
    ordStatus: '0',
    ordStatusLabel: 'New (Acknowledged)',
    execTypeLabel: 'New',
    rawFix: ackRaw,
  });

  // Stage 2: Fill
  const fillPx = ordType === '1' ? marketReferencePrice : limitPrice;
  const execIdFill = `FILL-102`;

  const fillRaw = serializeFixMessage('8', seq++, senderCompId, targetCompId, [
    { tag: 37, value: exchangeOrderId },
    { tag: 11, value: clOrdId },
    { tag: 17, value: execIdFill },
    { tag: 150, value: '2' },
    { tag: 39, value: '2' },
    { tag: 55, value: symbol },
    { tag: 54, value: sideCode },
    { tag: 38, value: orderQty },
    { tag: 32, value: orderQty },
    { tag: 31, value: fillPx.toFixed(2) },
    { tag: 14, value: orderQty },
    { tag: 151, value: 0 },
    { tag: 6, value: fillPx.toFixed(2) },
  ]);

  const fillMsg = parseFixMessage(fillRaw, 'INBOUND');
  executionReports.push(fillMsg);

  dropCopies.push({
    id: `dc-${execIdFill}`,
    direction: 'DROP_COPY',
    originalSeqNum: fillMsg.seqNum,
    clOrdID: clOrdId,
    orderID: exchangeOrderId,
    execID: execIdFill,
    symbol,
    side,
    orderQty,
    cumQty: orderQty,
    leavesQty: 0,
    lastPx: fillPx,
    avgPx: fillPx,
    ordStatus: '2',
    ordStatusLabel: 'Filled (100%)',
    execTypeLabel: 'Trade',
    rawFix: fillRaw,
  });

  return {
    executionReports,
    dropCopies,
    nextExchangeSeqNum: seq,
  };
}

// Unit Tests
test('TC-FIX-TEST-01: Modulo 256 Checksum Calculation & Zero-Padding', () => {
  const testStr = '8=FIX.4.4\x019=45\x0135=0\x0149=SENDER\x0156=TARGET\x0134=1\x0152=20261105-04:30:00.000\x01';
  const checksum = calculateFixChecksum(testStr);

  assert.strictEqual(checksum.length, 3, 'Checksum must be exactly 3 digits');
  const num = parseInt(checksum, 10);
  assert.ok(num >= 0 && num <= 255, 'Checksum must be between 0 and 255');
  assert.strictEqual(calculateFixChecksum(testStr), checksum, 'Checksum must be deterministic');
});

test('TC-FIX-TEST-02: FIX Message Serialization & Length Accuracy', () => {
  const msg = serializeFixMessage(
    'D',
    10,
    'TRADECRAFT',
    'NSE_MATCH',
    [
      { tag: 11, value: 'ORD-1001' },
      { tag: 55, value: 'TCS' },
      { tag: 54, value: '1' },
      { tag: 38, value: 50 },
      { tag: 40, value: '2' },
      { tag: 44, value: '3850.00' },
    ]
  );

  assert.ok(msg.startsWith('8=FIX.4.4\x019='), 'Message must begin with standard Tag 8 and Tag 9');
  assert.ok(msg.includes('35=D\x01'), 'Message must contain MsgType NewOrderSingle (35=D)');
  assert.ok(msg.includes('10='), 'Message must contain Tag 10 Checksum trailer');

  const parsed = parseFixMessage(msg, 'OUTBOUND');
  assert.strictEqual(parsed.msgType, 'D');
  assert.strictEqual(parsed.seqNum, 10);
  assert.strictEqual(parsed.senderCompId, 'TRADECRAFT');
  assert.strictEqual(parsed.targetCompId, 'NSE_MATCH');
  assert.strictEqual(parsed.isValidChecksum, true, 'Checksum must be valid');
});

test('TC-FIX-TEST-03: Bidirectional Parsing & Visual Pipe Delimiter Support', () => {
  const visualPipeMsg = '8=FIX.4.4|9=50|35=A|49=CLIENT|56=BROKER|34=1|52=20261105-04:00:00.000|98=0|108=30|10=182|';
  const parsed = parseFixMessage(visualPipeMsg, 'OUTBOUND');

  assert.strictEqual(parsed.msgType, 'A');
  assert.strictEqual(parsed.seqNum, 1);
  assert.strictEqual(parsed.senderCompId, 'CLIENT');
  assert.strictEqual(parsed.targetCompId, 'BROKER');

  const tag108 = parsed.fields.find((f) => f.tag === 108);
  assert.ok(tag108, 'Tag 108 (HeartBtInt) must be parsed');
  assert.strictEqual(tag108.value, '30');
});

test('TC-FIX-TEST-04: Synthetic Exchange Execution & Order Status Lifecycle', () => {
  const orderRaw = serializeFixMessage('D', 5, 'TRADECRAFT_DESK', 'NSE_MATCH_ENG', [
    { tag: 11, value: 'TC-101' },
    { tag: 55, value: 'INFY' },
    { tag: 54, value: '1' },
    { tag: 38, value: 200 },
    { tag: 40, value: '2' },
    { tag: 44, value: '1845.25' },
  ]);
  const newOrder = parseFixMessage(orderRaw, 'OUTBOUND');

  const simResult = simulateExchangeExecution(newOrder, 10, 1845.25);

  assert.strictEqual(simResult.executionReports.length, 2, 'Must yield 2 execution reports (Ack + Fill)');
  assert.strictEqual(simResult.dropCopies.length, 2, 'Must yield 2 Drop-Copy audit records');

  // Check Report 1: Ack
  const ack = simResult.executionReports[0];
  assert.strictEqual(ack.msgType, '8');
  const ackExecType = ack.fields.find((f) => f.tag === 150)?.value;
  assert.strictEqual(ackExecType, '0', 'Ack ExecType must be 0 (New)');

  // Check Report 2: Fill
  const fill = simResult.executionReports[1];
  assert.strictEqual(fill.msgType, '8');
  const fillExecType = fill.fields.find((f) => f.tag === 150)?.value;
  assert.strictEqual(fillExecType, '2', 'Fill ExecType must be 2 (Fill)');
  const fillCumQty = fill.fields.find((f) => f.tag === 14)?.value;
  assert.strictEqual(fillCumQty, '200', 'Cumulative filled quantity must match order size');

  // Check Drop-Copy records
  assert.strictEqual(simResult.dropCopies[1].symbol, 'INFY');
  assert.strictEqual(simResult.dropCopies[1].side, 'BUY');
  assert.strictEqual(simResult.dropCopies[1].cumQty, 200);
  assert.strictEqual(simResult.dropCopies[1].leavesQty, 0);
});
