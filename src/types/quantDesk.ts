// TradeCraft AI — Autonomous AI Quant Desk & Virtual Hedge Fund Committee Types

export type QuantAgentRole =
  | 'MACRO_STRATEGIST'
  | 'MOMENTUM_HUNTER'
  | 'CHIEF_RISK_OFFICER'
  | 'EXECUTION_ALGORIST';

export type CommitteeVerdict =
  | 'APPROVED_FULL'
  | 'APPROVED_SCALED_DOWN'
  | 'REJECTED_BY_RISK'
  | 'REJECTED_BY_MACRO';

export type DirectionalBias = 'LONG' | 'SHORT' | 'NEUTRAL_HOLD';

export type RoutingAlgorithm = 'DOM_LIMIT' | 'ICEBERG' | 'TWAP' | 'VWAP';

export type SentimentStance = 'BULLISH' | 'BEARISH' | 'CAUTIONARY' | 'NEUTRAL' | 'VETO';

export interface QuantAgentPersona {
  id: string;
  name: string;
  role: QuantAgentRole;
  title: string;
  avatarUrl: string;
  badge: string;
  description: string;
  coreFormula: string;
}

export interface DebateRoundStatement {
  agentId: string;
  agentName: string;
  role: QuantAgentRole;
  round: number; // 1: Proposal, 2: Context, 3: Risk Audit, 4: Routing
  statement: string;
  sentiment: SentimentStance;
  keyMetricHighlight?: string;
}

export interface MacroRegimeAudit {
  regimeScore: number; // -1.0 to +1.0
  regimeLabel: 'AGGRESSIVE_RISK_ON' | 'NEUTRAL_SELECTIVE' | 'DEFENSIVE_RISK_OFF';
  fiiDiiNetFlowCr: number;
  marketBreadthRatio: number;
  sectorRelativeReturnPct: number;
  strategistComment: string;
}

export interface AlphaSignalAudit {
  confluenceScore: number; // 0 to 100
  setupType: string;
  directionalBias: DirectionalBias;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  riskRewardRatio: number;
  hunterComment: string;
}

export interface RiskOfficerAudit {
  portfolioVar99Pct: number;
  halfKellyFraction: number;
  maxApprovedCapital: number;
  approvedQuantity: number;
  originalQuantity: number;
  haircutPercentage: number;
  vetoTriggered: boolean;
  vetoReason?: string;
  officerComment: string;
}

export interface ExecutionRoutingPlan {
  routingAlgorithm: RoutingAlgorithm;
  sliceCount: number;
  sliceIntervalSec: number;
  estimatedSlippageBps: number;
  estimatedStatutoryTaxes: number;
  bookImbalance: number;
  algoristComment: string;
}

export interface QuantDeskConsensusVerdict {
  committeeSessionId: string;
  timestamp: string; // ISO 8601
  symbol: string;
  verdict: CommitteeVerdict;
  directionalBias: DirectionalBias;
  macroRegime: MacroRegimeAudit;
  alphaSignal: AlphaSignalAudit;
  riskAudit: RiskOfficerAudit;
  executionPlan: ExecutionRoutingPlan;
  debateRounds: DebateRoundStatement[];
  confidenceScore: number; // 0 to 100
}
