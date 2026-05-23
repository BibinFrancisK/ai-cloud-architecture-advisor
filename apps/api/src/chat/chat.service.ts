import { BadRequestException, Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { RequirementScorer } from '../clarification/requirement.scorer';
import { ClarificationEngine } from '../clarification/clarification.engine';
import { SessionStatus } from '../common/types/session.types';
import { NextAction } from '../common/types/chat.types';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

const MAX_BATCHES = 4;
const MAX_MESSAGES = 20;

@Injectable()
export class ChatService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly requirementScorer: RequirementScorer,
    private readonly clarificationEngine: ClarificationEngine,
  ) {}

  async handleMessage(
    sessionId: string,
    dto: ChatMessageDto,
  ): Promise<ChatResponseDto> {
    const session = this.sessionService.findById(sessionId);

    const userMessageCount = session.messages.filter(
      (m) => m.role === 'user',
    ).length;
    if (userMessageCount >= MAX_MESSAGES) {
      throw new BadRequestException(
        'Session message limit reached. Please start a new session.',
      );
    }

    session.messages.push({
      role: 'user',
      content: dto.message,
      timestamp: new Date(),
    });

    let responseMessage: string;
    let nextAction: NextAction;

    if (session.pendingQuestions.length > 0) {
      // Questions from the last LLM batch remain — ask next without an LLM call
      responseMessage = session.pendingQuestions.shift()!;
      session.clarificationRound++;
      session.status = SessionStatus.CLARIFYING;
      nextAction = NextAction.CONTINUE_CLARIFICATION;
    } else if (session.clarificationBatch >= MAX_BATCHES) {
      // Requirements still insufficient after max batches — dead end
      responseMessage =
        `After ${MAX_BATCHES} rounds of clarification, I still don't have enough ` +
        `specifics to generate a reliable architecture. Please start a new session ` +
        `with more concrete requirements — for example: exact RPS or DAU figures, ` +
        `a p99 latency target, your team size, and a monthly budget range.`;
      nextAction = NextAction.CONTINUE_CLARIFICATION;
    } else {
      // Queue exhausted — call LLM for the next batch of scores + questions
      const assessment = await this.requirementScorer.score(session.messages);
      session.completenessScore = assessment.totalScore;
      session.clarificationBatch++;

      if (assessment.isComplete || assessment.pendingQuestions.length === 0) {
        responseMessage =
          this.clarificationEngine.buildReadyMessage(assessment);
        session.status = SessionStatus.READY_TO_GENERATE;
        nextAction = NextAction.GENERATE_ARCHITECTURE;
      } else {
        session.pendingQuestions = assessment.pendingQuestions.slice(1);
        responseMessage = assessment.pendingQuestions[0];
        session.clarificationRound++;
        session.status = SessionStatus.CLARIFYING;
        nextAction = NextAction.CONTINUE_CLARIFICATION;
      }
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
