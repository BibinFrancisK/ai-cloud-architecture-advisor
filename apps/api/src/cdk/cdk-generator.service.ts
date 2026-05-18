import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { PromptBuilderService } from '../llm/prompt-builder.service';
import type { ArchitectureRecommendation } from '../common/types/architecture.types';
import type {
  CdkEnvironment,
  CdkGenerationMode,
  CdkGenerationResult,
} from '../common/types/cdk.types';

@Injectable()
export class CdkGeneratorService {
  private readonly logger = new Logger(CdkGeneratorService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async generate(
    architecture: ArchitectureRecommendation,
    mode: CdkGenerationMode,
    environment: CdkEnvironment,
  ): Promise<CdkGenerationResult> {
    const stackName = this.deriveStackName(architecture.summary, environment);

    this.logger.log(
      `CDK generation started — stack: ${stackName}, mode: ${mode}, environment: ${environment}`,
    );

    const request = this.promptBuilder.buildCdkRequest(
      architecture,
      mode,
      environment,
    );
    const response = await this.llmService.generate(request);

    const dependencies = this.extractDependencies(response.text);
    const linesOfCode = response.text.split('\n').length;

    this.logger.log(
      `CDK generated: ${linesOfCode} lines, ${dependencies.length} dependencies`,
    );

    return { stackName, code: response.text, dependencies, mode, environment };
  }

  private deriveStackName(
    summary: string,
    environment: CdkEnvironment,
  ): string {
    const base = summary
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40);

    return `${base}-${environment}`;
  }

  private extractDependencies(code: string): string[] {
    const baseline = ['aws-cdk-lib', 'constructs'];
    const found = new Set<string>(baseline);

    const importPattern = /^import\s+.*from\s+['"]([^'"]+)['"]/gm;
    let match: RegExpExecArray | null;

    while ((match = importPattern.exec(code)) !== null) {
      const pkg = match[1];
      if (pkg.startsWith('aws-cdk-lib') || pkg.startsWith('@aws-cdk/')) {
        found.add(pkg.startsWith('aws-cdk-lib') ? 'aws-cdk-lib' : pkg);
      }
    }

    return Array.from(found);
  }
}
