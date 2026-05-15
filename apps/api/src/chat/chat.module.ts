import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SessionModule } from '../session/session.module';
import { LlmModule } from '../llm/llm.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [SessionModule, LlmModule, RagModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
