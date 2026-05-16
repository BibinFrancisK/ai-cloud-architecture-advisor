import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SessionModule } from '../session/session.module';
import { ClarificationModule } from '../clarification/clarification.module';
import { SessionExistsGuard } from '../common/guards/session-exists.guard';

@Module({
  imports: [SessionModule, ClarificationModule],
  controllers: [ChatController],
  providers: [ChatService, SessionExistsGuard],
})
export class ChatModule {}
