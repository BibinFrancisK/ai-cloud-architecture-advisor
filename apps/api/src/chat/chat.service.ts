import { Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto, NextAction } from './dto/chat-response.dto';

@Injectable()
export class ChatService {
  constructor(private readonly sessionService: SessionService) {}

  handleMessage(sessionId: string, _dto: ChatMessageDto): ChatResponseDto {
    const session = this.sessionService.findById(sessionId);

    // Stub — real orchestration logic added on Day 6
    return {
      sessionId: session.id,
      message: 'Chat handling not yet implemented.',
      status: session.status,
      completenessScore: session.completenessScore,
      clarificationRound: session.clarificationRound,
      nextAction: NextAction.CONTINUE_CLARIFICATION,
    };
  }
}
