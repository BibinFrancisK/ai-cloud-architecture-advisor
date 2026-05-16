import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { SessionModule } from './session/session.module';
import { ChatModule } from './chat/chat.module';
import { ArchitectureModule } from './architecture/architecture.module';
import { ClarificationModule } from './clarification/clarification.module';
import { RagModule } from './rag/rag.module';
import { LlmModule } from './llm/llm.module';
import { CdkModule } from './cdk/cdk.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    SessionModule,
    ChatModule,
    ArchitectureModule,
    ClarificationModule,
    RagModule,
    LlmModule,
    CdkModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }],
})
export class AppModule {}
