import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../../session/session.types';

export enum NextAction {
  CONTINUE_CLARIFICATION = 'CONTINUE_CLARIFICATION',
  GENERATE_ARCHITECTURE = 'GENERATE_ARCHITECTURE',
  GENERATE_CDK = 'GENERATE_CDK',
}

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
