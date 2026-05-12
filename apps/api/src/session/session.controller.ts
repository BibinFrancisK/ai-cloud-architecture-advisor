import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionService } from './session.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation session' })
  create() {
    const session = this.sessionService.create();
    return {
      sessionId: session.id,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
