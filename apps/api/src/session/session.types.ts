export enum SessionStatus {
  CLARIFYING = 'CLARIFYING',
  READY_TO_GENERATE = 'READY_TO_GENERATE',
  ARCHITECTURE_GENERATED = 'ARCHITECTURE_GENERATED',
  ARCHITECTURE_APPROVED = 'ARCHITECTURE_APPROVED',
  CDK_GENERATED = 'CDK_GENERATED',
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SessionState {
  id: string;
  status: SessionStatus;
  messages: ConversationMessage[];
  clarificationRound: number;
  completenessScore: number;
  createdAt: Date;
}
