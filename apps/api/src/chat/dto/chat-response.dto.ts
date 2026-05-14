import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../../session/types/session.types';
import { NextAction } from '../types/chat.types';

export { NextAction };

export class ChatResponseDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: SessionStatus })
  status!: SessionStatus;

  @ApiProperty({ minimum: 0, maximum: 100 })
  completenessScore!: number;

  @ApiProperty()
  clarificationRound!: number;

  @ApiProperty({ enum: NextAction })
  nextAction!: NextAction;
}
