import { Injectable } from '@nestjs/common';
import { BuildRequestParams, LlmRequest } from '../common/types/llm.types';
import { RetrievedChunk } from '../common/types/rag.types';
import type { ConversationMessage } from '../common/types/session.types';
import { ARCHITECTURE_SYSTEM_PROMPT, SYSTEM_PROMPT } from '../common/constants';

@Injectable()
export class PromptBuilderService {
  buildSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  buildRagContextBlock(chunks: RetrievedChunk[]): string | undefined {
    if (chunks.length === 0) return undefined;

    const chunkText = chunks
      .map(
        (chunk, i) =>
          `[${i + 1}] Source: ${chunk.sourceFile} (similarity: ${chunk.similarity.toFixed(3)})\n${chunk.content}`,
      )
      .join('\n\n---\n\n');

    return `## Retrieved AWS Architecture Context\n\nThe following is relevant guidance from the AWS knowledge base:\n\n${chunkText}`;
  }

  buildRequest(params: BuildRequestParams): LlmRequest {
    const { userMessage, ragChunks, conversationHistory } = params;

    return {
      systemPrompt: this.buildSystemPrompt(),
      userMessage,
      ragContext: this.buildRagContextBlock(ragChunks),
      conversationHistory,
    };
  }

  buildArchitectureRequest(
    conversationHistory: ConversationMessage[],
    ragChunks: RetrievedChunk[],
  ): LlmRequest {
    return {
      systemPrompt: ARCHITECTURE_SYSTEM_PROMPT,
      userMessage:
        'Based on the requirements gathered in our conversation, generate the architecture recommendation.',
      ragContext: this.buildRagContextBlock(ragChunks),
      conversationHistory,
    };
  }
}
