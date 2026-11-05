export type FixMsgType =
  | '0' // Heartbeat
  | '1' // TestRequest
  | '2' // ResendRequest
  | '3' // Reject
  | '4' // SequenceReset
  | '5' // Logout
  | 'A' // Logon
  | 'D' // NewOrderSingle
  | '8' // ExecutionReport
  | 'F' // OrderCancelRequest
  | '9'; // OrderCancelReject

export type FixOrdStatus =
  | '0' // New
  | '1' // Partially Filled
  | '2' // Filled
  | '4' // Cancelled
  | '8' // Rejected
  | 'A'; // Pending New

export type FixExecType =
  | '0' // New
  | '1' // Partial Fill
  | '2' // Fill
  | '4' // Cancelled
  | '8'; // Rejected

export interface FixField {
  tag: number;
  name: string;
  value: string;
  category: 'header' | 'body' | 'trailer';
}

export interface FixMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  timestamp: string;
  msgType: FixMsgType;
  msgTypeName: string;
  seqNum: number;
  senderCompId: string;
  targetCompId: string;
  fields: FixField[];
  raw: string;
  isValidChecksum: boolean;
  checksum: string;
  bodyLength: number;
  latencyMs?: number;
}

export type FixSessionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING';

export interface FixSessionState {
  status: FixSessionStatus;
  senderCompId: string;
  targetCompId: string;
  outSeqNum: number;
  inSeqNum: number;
  heartbeatIntervalSec: number;
  lastHeartbeatSent?: string;
  lastHeartbeatReceived?: string;
  connectedSince?: string;
  messagesProcessed: number;
}

export interface DropCopyRecord {
  id: string;
  timestamp: string;
  direction: 'DROP_COPY';
  originalSeqNum: number;
  clOrdID: string;
  orderID: string;
  execID: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderQty: number;
  cumQty: number;
  leavesQty: number;
  lastPx: number;
  avgPx: number;
  ordStatus: string;
  ordStatusLabel: string;
  execTypeLabel: string;
  rawFix: string;
}

export interface FixNewOrderParams {
  clOrdID?: string;
  symbol: string;
  side: '1' | '2'; // 1=Buy, 2=Sell
  orderQty: number;
  ordType: '1' | '2'; // 1=Market, 2=Limit
  price?: number;
  timeInForce?: '0' | '1' | '3'; // 0=Day, 1=GTC, 3=IOC
}
