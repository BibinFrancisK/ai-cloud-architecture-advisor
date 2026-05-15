import { Injectable } from '@nestjs/common';
import { BuildRequestParams, LlmRequest } from '../common/types/llm.types';
import { RetrievedChunk } from '../common/types/rag.types';
import { SYSTEM_PROMPT } from '../common/constants';

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
}
