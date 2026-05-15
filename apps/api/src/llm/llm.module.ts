import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { LlmService } from './llm.service';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  imports: [RagModule],
  providers: [LlmService, PromptBuilderService],
  exports: [LlmService, PromptBuilderService],
})
export class LlmModule {}
