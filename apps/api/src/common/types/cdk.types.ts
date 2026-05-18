export type CdkGenerationMode = 'complete' | 'skeleton';

export type CdkEnvironment = 'dev' | 'staging' | 'prod';

export interface CdkGenerationResult {
  stackName: string;
  code: string;
  dependencies: string[];
  mode: CdkGenerationMode;
  environment: CdkEnvironment;
}
