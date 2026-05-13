# AWS CDK Examples

## Serverless REST API — Lambda + API Gateway + DynamoDB

A fully serverless pattern suitable for unpredictable or spiky workloads where you want zero idle cost and automatic scaling without managing infrastructure.

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class ServerlessApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'ItemsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      // PAY_PER_REQUEST eliminates capacity planning for variable traffic
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // RETAIN prevents accidental data loss if cdk destroy is run in production
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const handler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'index.handler',
      environment: {
        // Pass the table name at deploy time so the function never hardcodes it
        TABLE_NAME: table.tableName,
      },
    });

    // Grant least-privilege access via a managed policy helper rather than
    // writing raw IAM statements, which are error-prone and verbose
    table.grantReadWriteData(handler);

    // LambdaRestApi wires the proxy integration automatically; fine for
    // simple APIs where all routing is handled inside the Lambda itself
    new apigateway.LambdaRestApi(this, 'ItemsApi', {
      handler,
      deployOptions: {
        stageName: 'prod',
      },
    });
  }
}
```

## Containerised API — ECS Fargate + ALB + Aurora Serverless v2

Use this pattern when you need persistent connections, a larger runtime (e.g., JVM), or workloads that benefit from container-level isolation but you still want to avoid managing EC2 instances.

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class ContainerApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 2 AZs is the minimum for ALB; 3 AZs adds resilience at marginal cost
    const vpc = new ec2.Vpc(this, 'AppVpc', { maxAzs: 2 });

    const cluster = new ecs.Cluster(this, 'AppCluster', { vpc });

    // L2 pattern handles ALB, target group, listener, and Fargate service
    // wiring in one construct — avoids ~100 lines of L1 boilerplate
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ApiService',
      {
        cluster,
        cpu: 512,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('public.ecr.aws/my-org/api:latest'),
          containerPort: 8080,
        },
        // publicLoadBalancer: true exposes the ALB to the internet while
        // the Fargate tasks themselves stay in private subnets
        publicLoadBalancer: true,
      },
    );

    const dbCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      // Serverless v2 scales to zero when idle, cutting cost for dev/staging
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 16,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc,
      // Isolated subnets have no NAT gateway route — database never reaches
      // the internet, reducing the attack surface without extra security groups
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      // RETAIN so a cdk destroy during an incident does not wipe the database
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Allow only the Fargate task to connect; no broad CIDR rules needed
    dbCluster.connections.allowDefaultPortFrom(service.service);
  }
}
```

## Event-Driven Pipeline — SQS + Lambda + S3

Decouple producers from consumers when processing speed does not need to match ingestion speed, or when you want to absorb traffic spikes without dropping messages.

```typescript
import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class EventPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DLQ captures messages that fail repeatedly so they can be inspected
    // without blocking the main queue
    const dlq = new sqs.Queue(this, 'ProcessingDlq', {
      retentionPeriod: cdk.Duration.days(14),
    });

    const queue = new sqs.Queue(this, 'ProcessingQueue', {
      // After 3 failures the message moves to the DLQ instead of being
      // retried indefinitely and causing Lambda concurrency exhaustion
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
      // Visibility timeout must exceed Lambda max duration to avoid
      // a message being picked up twice while still being processed
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    const processor = new lambda.Function(this, 'Processor', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'processor.handler',
    });

    // batchSize: 10 balances throughput with per-message error isolation;
    // lower values give finer DLQ granularity at higher Lambda invocation cost
    processor.addEventSource(
      new lambdaEventSources.SqsEventSource(queue, { batchSize: 10 }),
    );

    const outputBucket = new s3.Bucket(this, 'OutputBucket', {
      // Versioning preserves every processed result so bad deployments
      // can be rolled back without re-running the pipeline
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    outputBucket.grantWrite(processor);
  }
}
```

## Static Site + API — CloudFront + S3 + API Gateway + Lambda

Serve a single-page application from S3 while routing `/api/*` requests to a Lambda-backed API Gateway, all behind a single CloudFront distribution to unify caching and TLS termination.

```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      // Block all public access — CloudFront OAC is the only allowed reader,
      // so the bucket itself never needs a public bucket policy
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'api.handler',
    });

    const api = new apigateway.LambdaRestApi(this, 'SiteApi', {
      handler: apiHandler,
      // Disable the default proxy so CloudFront controls the stage URL path
      proxy: true,
    });

    // S3Origin with no explicit OAI uses OAC under the hood — OAI is legacy
    // and does not support SSE-KMS or the newer S3 bucket policy model
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket);

    new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: s3Origin,
        // SPA routing: let CloudFront serve index.html for unknown paths
        // rather than returning a 403 from S3
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        // /api/* bypasses the S3 cache and forwards to API Gateway;
        // ALLOW_ALL is needed so POST/PUT bodies are forwarded correctly
        '/api/*': {
          origin: new origins.HttpOrigin(
            `${api.restApiId}.execute-api.${cdk.Stack.of(this).region}.amazonaws.com`,
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      },
    });
  }
}
```

## CDK Best Practices

**Use L2 constructs.** L2 constructs encapsulate CloudFormation defaults that are insecure or operationally risky (e.g., public S3 buckets, open security groups). Only drop to L1 (`Cfn*`) when no L2 exists for the resource.

**Apply RemovalPolicy deliberately.**

```typescript
// Production stateful resources — RETAIN so cdk destroy never deletes data
removalPolicy: cdk.RemovalPolicy.RETAIN,

// Ephemeral dev/test resources — DESTROY keeps stacks clean after teardown
removalPolicy: cdk.RemovalPolicy.DESTROY,
```

**Pass configuration via props and environment variables, never via hardcoded strings.**

```typescript
// Correct — account and region resolved at synthesis time from stack context
const bucketArn = `arn:aws:s3:::my-bucket-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`;

// Wrong — breaks cross-account deployments and is invisible to CDK diff
const bucketArn = 'arn:aws:s3:::my-bucket-123456789012-eu-west-1';
```

**Use grant methods instead of inline IAM policy statements.** Grant methods (`table.grantReadWriteData(fn)`, `bucket.grantWrite(fn)`) generate least-privilege policies automatically and stay correct if the resource ARN changes. Inline `PolicyStatement` blocks must be updated manually and are easy to over-permission.

**Prefer L2 pattern constructs for common topologies.** `ApplicationLoadBalancedFargateService`, `LambdaRestApi`, and similar L2 patterns encapsulate dozens of resource relationships. Use them before composing the same resources manually, because the patterns bake in production-ready defaults (health checks, log groups, security group rules) that are easy to miss in hand-rolled stacks.
