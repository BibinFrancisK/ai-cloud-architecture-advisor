import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RagModule } from '../rag/rag.module';
import { SessionModule } from '../session/session.module';
import { ArchitectureController } from './architecture.controller';
import { ArchitectureService } from './architecture.service';
import { ArchitectureGeneratorService } from './architecture-generator.service';
import { SessionExistsGuard } from '../common/guards/session-exists.guard';

@Module({
  imports: [LlmModule, RagModule, SessionModule],
  controllers: [ArchitectureController],
  providers: [
    ArchitectureService,
    ArchitectureGeneratorService,
    SessionExistsGuard,
  ],
  exports: [ArchitectureService],
})
export class ArchitectureModule {}
