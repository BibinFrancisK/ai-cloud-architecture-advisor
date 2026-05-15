import type { ConversationMessage } from './session.types';
import type { RetrievedChunk } from './rag.types';

export interface LlmRequest {
  systemPrompt: string;
  userMessage: string;
  ragContext?: string;
  conversationHistory?: ConversationMessage[];
}

export interface LlmResponse {
  text: string;
  tokensUsed?: number;
}

export interface BuildRequestParams {
  userMessage: string;
  ragChunks: RetrievedChunk[];
  conversationHistory: ConversationMessage[];
}
