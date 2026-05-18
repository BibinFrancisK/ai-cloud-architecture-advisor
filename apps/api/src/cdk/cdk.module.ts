import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { SessionModule } from '../session/session.module';
import { CdkController } from './cdk.controller';
import { CdkGeneratorService } from './cdk-generator.service';
import { SessionExistsGuard } from '../common/guards/session-exists.guard';
import { RequirementsCompleteGuard } from '../common/guards/requirements-complete.guard';

@Module({
  imports: [LlmModule, SessionModule],
  controllers: [CdkController],
  providers: [
    CdkGeneratorService,
    SessionExistsGuard,
    RequirementsCompleteGuard,
  ],
})
export class CdkModule {}
