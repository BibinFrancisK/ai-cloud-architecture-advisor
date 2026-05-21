import { BadRequestException, Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { RequirementScorer } from '../clarification/requirement.scorer';
import { ClarificationEngine } from '../clarification/clarification.engine';
import { SessionStatus } from '../common/types/session.types';
import { NextAction } from '../common/types/chat.types';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly requirementScorer: RequirementScorer,
    private readonly clarificationEngine: ClarificationEngine,
  ) {}

  handleMessage(sessionId: string, dto: ChatMessageDto): ChatResponseDto {
    const session = this.sessionService.findById(sessionId);

    const userMessageCount = session.messages.filter(
      (m) => m.role === 'user',
    ).length;
    if (userMessageCount >= 20) {
      throw new BadRequestException(
        'Session message limit reached. Please start a new session.',
      );
    }

    session.messages.push({
      role: 'user',
      content: dto.message,
      timestamp: new Date(),
    });

    const assessment = this.requirementScorer.score(session.messages);
    session.completenessScore = assessment.totalScore;

    let responseMessage: string;
    let nextAction: NextAction;

    if (
      this.clarificationEngine.shouldContinueClarifying(
        assessment.totalScore,
        session.clarificationRound,
      )
    ) {
      responseMessage = this.clarificationEngine.selectQuestion(
        assessment,
        session.clarificationRound,
      );
      session.clarificationRound++;
      session.status = SessionStatus.CLARIFYING;
      nextAction = NextAction.CONTINUE_CLARIFICATION;
    } else {
      responseMessage = this.clarificationEngine.buildReadyMessage(assessment);
      session.status = SessionStatus.READY_TO_GENERATE;
      nextAction = NextAction.GENERATE_ARCHITECTURE;
    }

    session.messages.push({
      role: 'assistant',
      content: responseMessage,
      timestamp: new Date(),
    });

    this.sessionService.save(session);

    return {
      sessionId: session.id,
      message: responseMessage,
      status: session.status,
      completenessScore: session.completenessScore,
      clarificationRound: session.clarificationRound,
      nextAction,
    };
  }
}
