import {
  FixField,
  FixMessage,
  FixMsgType,
  FixNewOrderParams,
  FixSessionState,
  DropCopyRecord,
} from '../types/fix';

export const SOH = '\x01';
export const VISUAL_DELIMITER = '|';

// Comprehensive FIX 4.4 Tag Dictionary
export const TAG_DICTIONARY: Record<number, { name: string; category: 'header' | 'body' | 'trailer' }> = {
  8: { name: 'BeginString', category: 'header' },
  9: { name: 'BodyLength', category: 'header' },
  35: { name: 'MsgType', category: 'header' },
  49: { name: 'SenderCompID', category: 'header' },
  56: { name: 'TargetCompID', category: 'header' },
  34: { name: 'MsgSeqNum', category: 'header' },
  52: { name: 'SendingTime', category: 'header' },
  115: { name: 'OnBehalfOfCompID', category: 'header' },
  128: { name: 'DeliverToCompID', category: 'header' },

  // Session & Management Tags
  98: { name: 'EncryptMethod', category: 'body' },
  108: { name: 'HeartBtInt', category: 'body' },
  112: { name: 'TestReqID', category: 'body' },
  7: { name: 'BeginSeqNo', category: 'body' },
  16: { name: 'EndSeqNo', category: 'body' },
  45: { name: 'RefSeqNum', category: 'body' },
  58: { name: 'Text', category: 'body' },
  371: { name: 'RefTagID', category: 'body' },
  372: { name: 'RefMsgType', category: 'body' },

  // Order & Execution Tags
  11: { name: 'ClOrdID', category: 'body' },
  41: { name: 'OrigClOrdID', category: 'body' },
  37: { name: 'OrderID', category: 'body' },
  17: { name: 'ExecID', category: 'body' },
  150: { name: 'ExecType', category: 'body' },
  39: { name: 'OrdStatus', category: 'body' },
  55: { name: 'Symbol', category: 'body' },
  54: { name: 'Side', category: 'body' },
  38: { name: 'OrderQty', category: 'body' },
  40: { name: 'OrdType', category: 'body' },
  44: { name: 'Price', category: 'body' },
  59: { name: 'TimeInForce', category: 'body' },
  6: { name: 'AvgPx', category: 'body' },
  31: { name: 'LastPx', category: 'body' },
  32: { name: 'LastQty', category: 'body' },
  14: { name: 'CumQty', category: 'body' },
  151: { name: 'LeavesQty', category: 'body' },
  60: { name: 'TransactTime', category: 'body' },
  103: { name: 'OrdRejReason', category: 'body' },

  // Trailer Tag
  10: { name: 'CheckSum', category: 'trailer' },
};

export const MSG_TYPE_NAMES: Record<string, string> = {
  '0': 'Heartbeat',
  '1': 'TestRequest',
  '2': 'ResendRequest',
  '3': 'Reject',
  '4': 'SequenceReset',
  '5': 'Logout',
  'A': 'Logon',
  'D': 'NewOrderSingle',
  '8': 'ExecutionReport',
  'F': 'OrderCancelRequest',
  '9': 'OrderCancelReject',
};

/**
 * Calculates standard FIX Modulo 256 checksum for a string.
 * Sum of ASCII values of all characters modulo 256, padded to 3 digits.
 */
export function calculateFixChecksum(rawWithoutChecksum: string): string {
  let sum = 0;
  for (let i = 0; i < rawWithoutChecksum.length; i++) {
    sum += rawWithoutChecksum.charCodeAt(i);
  }
  const mod = sum % 256;
  return mod.toString().padStart(3, '0');
}

/**
 * Formats current UTC time in standard FIX SendingTime format: YYYYMMDD-HH:MM:SS.sss
 */
export function formatFixUtcTimestamp(date = new Date()): string {
  const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  const ms = pad(date.getUTCMilliseconds(), 3);
  return `${yyyy}${mm}${dd}-${hh}:${min}:${ss}.${ms}`;
}

/**
 * Serializes standard FIX 4.4 message with exact Tag 9 BodyLength and Tag 10 CheckSum.
 */
export function serializeFixMessage(
  msgType: FixMsgType,
  seqNum: number,
  senderCompId: string,
  targetCompId: string,
  bodyFields: { tag: number; value: string | number }[],
  timestamp = formatFixUtcTimestamp(),
  delimiter = SOH
): string {
  // Construct body stream starting from Tag 35 (MsgType)
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

/**
 * Parses raw FIX string into a structured typed FixMessage.
 */
export function parseFixMessage(rawInput: string, direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND'): FixMessage {
  // Normalize visual pipe delimiter if user passed pipe-separated string
  const normalized = rawInput.replace(/\|/g, SOH);
  const rawParts = normalized.split(SOH).filter((p) => p.includes('='));

  const fields: FixField[] = [];
  let msgType: FixMsgType = '0';
  let seqNum = 0;
  let senderCompId = 'UNKNOWN';
  let targetCompId = 'UNKNOWN';
  let sendingTime = '';
  let checksum = '';
  let bodyLength = 0;

  for (const part of rawParts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const tag = parseInt(part.substring(0, eqIdx), 10);
    const value = part.substring(eqIdx + 1);

    const tagMeta = TAG_DICTIONARY[tag] || {
      name: `Tag_${tag}`,
      category: 'body',
    };

    fields.push({
      tag,
      name: tagMeta.name,
      value,
      category: tagMeta.category,
    });

    if (tag === 35) msgType = value as FixMsgType;
    else if (tag === 34) seqNum = parseInt(value, 10);
    else if (tag === 49) senderCompId = value;
    else if (tag === 56) targetCompId = value;
    else if (tag === 52) sendingTime = value;
    else if (tag === 10) checksum = value;
    else if (tag === 9) bodyLength = parseInt(value, 10);
  }

  // Verify checksum
  const checksumIdx = normalized.indexOf(`10=${checksum}`);
  let isValidChecksum = true;
  if (checksumIdx !== -1) {
    const rawToVerify = normalized.substring(0, checksumIdx);
    const calculatedChecksum = calculateFixChecksum(rawToVerify);
    isValidChecksum = calculatedChecksum === checksum;
  }

  return {
    id: `fix-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    direction,
    timestamp: sendingTime || new Date().toISOString(),
    msgType,
    msgTypeName: MSG_TYPE_NAMES[msgType] || `MsgType_${msgType}`,
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

/**
 * Creates Logon message (35=A).
 */
export function createLogonMessage(
  seqNum: number,
  senderCompId: string,
  targetCompId: string,
  heartbeatIntervalSec = 30
): { raw: string; parsed: FixMessage } {
  const raw = serializeFixMessage(
    'A',
    seqNum,
    senderCompId,
    targetCompId,
    [
      { tag: 98, value: 0 }, // EncryptMethod: None
      { tag: 108, value: heartbeatIntervalSec }, // HeartBtInt
    ]
  );
  return { raw, parsed: parseFixMessage(raw, 'OUTBOUND') };
}

/**
 * Creates Heartbeat message (35=0).
 */
export function createHeartbeatMessage(
  seqNum: number,
  senderCompId: string,
  targetCompId: string,
  testReqId?: string
): { raw: string; parsed: FixMessage } {
  const fields = testReqId ? [{ tag: 112, value: testReqId }] : [];
  const raw = serializeFixMessage('0', seqNum, senderCompId, targetCompId, fields);
  return { raw, parsed: parseFixMessage(raw, 'OUTBOUND') };
}

/**
 * Creates NewOrderSingle message (35=D).
 */
export function createNewOrderSingle(
  params: FixNewOrderParams,
  seqNum: number,
  senderCompId: string,
  targetCompId: string
): { raw: string; parsed: FixMessage } {
  const clOrdId = params.clOrdID || `TC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  const timeInForce = params.timeInForce || '0';

  const bodyFields: { tag: number; value: string | number }[] = [
    { tag: 11, value: clOrdId }, // ClOrdID
    { tag: 55, value: params.symbol }, // Symbol
    { tag: 54, value: params.side }, // Side: 1=Buy, 2=Sell
    { tag: 60, value: formatFixUtcTimestamp() }, // TransactTime
    { tag: 38, value: params.orderQty }, // OrderQty
    { tag: 40, value: params.ordType }, // OrdType: 1=Market, 2=Limit
    { tag: 59, value: timeInForce }, // TimeInForce
  ];

  if (params.ordType === '2' && params.price) {
    bodyFields.push({ tag: 44, value: params.price.toFixed(2) }); // Price
  }

  const raw = serializeFixMessage('D', seqNum, senderCompId, targetCompId, bodyFields);
  return { raw, parsed: parseFixMessage(raw, 'OUTBOUND') };
}

/**
 * Creates OrderCancelRequest message (35=F).
 */
export function createOrderCancelRequest(
  origClOrdId: string,
  symbol: string,
  side: '1' | '2',
  seqNum: number,
  senderCompId: string,
  targetCompId: string
): { raw: string; parsed: FixMessage } {
  const cancelClOrdId = `CANC-${Date.now().toString(36).toUpperCase()}`;
  const raw = serializeFixMessage('F', seqNum, senderCompId, targetCompId, [
    { tag: 41, value: origClOrdId }, // OrigClOrdID
    { tag: 11, value: cancelClOrdId }, // ClOrdID
    { tag: 55, value: symbol }, // Symbol
    { tag: 54, value: side }, // Side
    { tag: 60, value: formatFixUtcTimestamp() }, // TransactTime
  ]);
  return { raw, parsed: parseFixMessage(raw, 'OUTBOUND') };
}

/**
 * Simulates real-time Synthetic Exchange Engine execution reports (35=8)
 * and generates corresponding Drop-Copy compliance journal records.
 */
export function simulateExchangeExecution(
  orderMsg: FixMessage,
  currentExchangeSeqNum: number,
  marketReferencePrice: number
): {
  executionReports: FixMessage[];
  dropCopies: DropCopyRecord[];
  nextExchangeSeqNum: number;
} {
  const getTagValue = (tag: number) => orderMsg.fields.find((f) => f.tag === tag)?.value;

  const clOrdId = getTagValue(11) || 'UNKNOWN_ORD';
  const symbol = getTagValue(55) || 'NIFTY';
  const sideCode = getTagValue(54) || '1';
  const side = sideCode === '1' ? 'BUY' : 'SELL';
  const orderQty = parseInt(getTagValue(38) || '50', 10);
  const ordType = getTagValue(40) || '2';
  const limitPrice = parseFloat(getTagValue(44) || marketReferencePrice.toString());

  const exchangeOrderId = `EXCH-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const senderCompId = orderMsg.targetCompId; // Exchange replies to client
  const targetCompId = orderMsg.senderCompId;

  let seq = currentExchangeSeqNum;
  const executionReports: FixMessage[] = [];
  const dropCopies: DropCopyRecord[] = [];

  // Stage 1: Order Acknowledged (OrdStatus=0 New, ExecType=0 New)
  const execIdAck = `ACK-${Date.now().toString(36).toUpperCase()}`;
  const ackRaw = serializeFixMessage('8', seq++, senderCompId, targetCompId, [
    { tag: 37, value: exchangeOrderId }, // OrderID
    { tag: 11, value: clOrdId }, // ClOrdID
    { tag: 17, value: execIdAck }, // ExecID
    { tag: 150, value: '0' }, // ExecType: New
    { tag: 39, value: '0' }, // OrdStatus: New
    { tag: 55, value: symbol },
    { tag: 54, value: sideCode },
    { tag: 38, value: orderQty },
    { tag: 44, value: limitPrice.toFixed(2) },
    { tag: 14, value: 0 }, // CumQty: 0
    { tag: 151, value: orderQty }, // LeavesQty: orderQty
    { tag: 6, value: '0.00' }, // AvgPx: 0
    { tag: 60, value: formatFixUtcTimestamp() },
  ]);

  const ackMsg = parseFixMessage(ackRaw, 'INBOUND');
  ackMsg.latencyMs = Math.floor(Math.random() * 3 + 1); // 1-4 ms wire latency
  executionReports.push(ackMsg);

  dropCopies.push({
    id: `dc-${execIdAck}`,
    timestamp: ackMsg.timestamp,
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

  // Stage 2: Immediate or Partial/Full Execution
  const fillPx = ordType === '1' ? marketReferencePrice : limitPrice;
  const execIdFill = `FILL-${Date.now().toString(36).toUpperCase()}`;

  const fillRaw = serializeFixMessage('8', seq++, senderCompId, targetCompId, [
    { tag: 37, value: exchangeOrderId },
    { tag: 11, value: clOrdId },
    { tag: 17, value: execIdFill },
    { tag: 150, value: '2' }, // ExecType: Fill
    { tag: 39, value: '2' }, // OrdStatus: Filled
    { tag: 55, value: symbol },
    { tag: 54, value: sideCode },
    { tag: 38, value: orderQty },
    { tag: 32, value: orderQty }, // LastQty
    { tag: 31, value: fillPx.toFixed(2) }, // LastPx
    { tag: 14, value: orderQty }, // CumQty
    { tag: 151, value: 0 }, // LeavesQty: 0
    { tag: 6, value: fillPx.toFixed(2) }, // AvgPx
    { tag: 60, value: formatFixUtcTimestamp() },
  ]);

  const fillMsg = parseFixMessage(fillRaw, 'INBOUND');
  fillMsg.latencyMs = Math.floor(Math.random() * 4 + 2); // 2-6 ms fill latency
  executionReports.push(fillMsg);

  dropCopies.push({
    id: `dc-${execIdFill}`,
    timestamp: fillMsg.timestamp,
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

/**
 * Initial session bootstrap history for realistic interactive terminal initialization.
 */
export function getInitialFixSession(): {
  sessionState: FixSessionState;
  messages: FixMessage[];
  dropCopies: DropCopyRecord[];
} {
  const senderCompId = 'TRADECRAFT_DESK';
  const targetCompId = 'NSE_MATCH_ENG';
  const initialMessages: FixMessage[] = [];
  const initialDropCopies: DropCopyRecord[] = [];

  // 1. Client Logon
  const logon = createLogonMessage(1, senderCompId, targetCompId, 30);
  initialMessages.push(logon.parsed);

  // 2. Exchange Logon Ack
  const logonAckRaw = serializeFixMessage('A', 1, targetCompId, senderCompId, [
    { tag: 98, value: 0 },
    { tag: 108, value: 30 },
  ]);
  const logonAck = parseFixMessage(logonAckRaw, 'INBOUND');
  logonAck.latencyMs = 2;
  initialMessages.push(logonAck);

  // 3. Heartbeat exchange
  const hbClient = createHeartbeatMessage(2, senderCompId, targetCompId);
  initialMessages.push(hbClient.parsed);

  const hbServerRaw = serializeFixMessage('0', 2, targetCompId, senderCompId, []);
  const hbServer = parseFixMessage(hbServerRaw, 'INBOUND');
  hbServer.latencyMs = 1;
  initialMessages.push(hbServer);

  // 4. Sample Order 1: RELIANCE Buy 100 shares
  const initialOrder = createNewOrderSingle(
    {
      symbol: 'RELIANCE',
      side: '1',
      orderQty: 100,
      ordType: '2',
      price: 2495.5,
    },
    3,
    senderCompId,
    targetCompId
  );
  initialMessages.push(initialOrder.parsed);

  // Simulate executions
  const sim = simulateExchangeExecution(initialOrder.parsed, 3, 2495.5);
  initialMessages.push(...sim.executionReports);
  initialDropCopies.push(...sim.dropCopies);

  return {
    sessionState: {
      status: 'CONNECTED',
      senderCompId,
      targetCompId,
      outSeqNum: 4,
      inSeqNum: sim.nextExchangeSeqNum,
      heartbeatIntervalSec: 30,
      connectedSince: formatFixUtcTimestamp(),
      messagesProcessed: initialMessages.length,
    },
    messages: initialMessages,
    dropCopies: initialDropCopies,
  };
}
