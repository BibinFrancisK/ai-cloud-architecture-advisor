import * as cdk from 'aws-cdk-lib';
import { AdvisorStack } from '../lib/advisor-stack';
import { AWS_REGION } from '../types/constants';

type DeployEnv = 'dev' | 'staging' | 'prod';
const VALID_ENVS: DeployEnv[] = ['dev', 'staging', 'prod'];

const app = new cdk.App();

const deployEnv = (app.node.tryGetContext('env') ?? 'dev') as DeployEnv;
if (!VALID_ENVS.includes(deployEnv)) {
  throw new Error(
    `Context variable 'env' must be one of: ${VALID_ENVS.join(' | ')}. Got: "${deployEnv}"`,
  );
}

new AdvisorStack(app, `AdvisorStack-${deployEnv}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: AWS_REGION,
  },
  description: `AI Cloud Architecture Advisor - ${deployEnv}`,
});
