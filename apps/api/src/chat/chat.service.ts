import { Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import { RAGRetrieverService } from '../rag/rag-retriever.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { NextAction } from '../common/types/chat.types';

@Injectable()
export class ChatService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly llmService: LlmService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly ragRetriever: RAGRetrieverService,
  ) {}

  async handleMessage(
    sessionId: string,
    dto: ChatMessageDto,
  ): Promise<ChatResponseDto> {
    const session = this.sessionService.findById(sessionId);

    const ragChunks = await this.ragRetriever.retrieve(dto.message);
    const request = this.promptBuilder.buildRequest({
      userMessage: dto.message,
      ragChunks,
      conversationHistory: session.messages,
    });
    const { text } = await this.llmService.generate(request);

    return {
      sessionId: session.id,
      message: text,
      status: session.status,
      completenessScore: session.completenessScore,
      clarificationRound: session.clarificationRound,
      nextAction: NextAction.CONTINUE_CLARIFICATION,
    };
  }
}
