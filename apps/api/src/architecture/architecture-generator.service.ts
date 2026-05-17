import { Injectable, Logger } from '@nestjs/common';
import type { ConversationMessage } from '../common/types/session.types';
import type { RetrievedChunk } from '../common/types/rag.types';
import {
  architectureSchema,
  ArchitectureRecommendation,
} from '../common/types/architecture.types';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';

@Injectable()
export class ArchitectureGeneratorService {
  private readonly logger = new Logger(ArchitectureGeneratorService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async generate(
    conversationHistory: ConversationMessage[],
    ragChunks: RetrievedChunk[],
  ): Promise<ArchitectureRecommendation> {
    const request = this.promptBuilder.buildArchitectureRequest(
      conversationHistory,
      ragChunks,
    );

    this.logger.log(
      `Calling LLM with ${ragChunks.length} RAG chunk(s) and ${conversationHistory.length} message(s)`,
    );

    return this.llmService.generateStructured(request, architectureSchema);
  }
}
