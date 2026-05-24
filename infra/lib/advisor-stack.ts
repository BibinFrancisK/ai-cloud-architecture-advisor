import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { ADVISOR_ECR, ADVISOR_ECS_CLUSTER, ADVISOR_LOG_GROUP, GEMINI_SECRET_KEY, POSTGRES_SECRET_KEY } from '../types/constants';

export class AdvisorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECR
    const ecrRepo = new ecr.Repository(this, 'AdvisorApiRepo', {
      repositoryName: ADVISOR_ECR,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // VPC
    const vpc = new ec2.Vpc(this, 'AdvisorVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // Security groups
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'ALB - allow inbound HTTP',
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP from internet');

    const apiSg = new ec2.SecurityGroup(this, 'ApiSg', {
      vpc,
      description: 'API container - allow traffic from ALB',
    });
    apiSg.addIngressRule(albSg, ec2.Port.tcp(3000), 'App port from ALB');

    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      description: 'RDS - allow traffic from API',
    });
    rdsSg.addIngressRule(apiSg, ec2.Port.tcp(5432), 'Postgres from API');

    // Secrets Manager 
    const geminiSecret = new secretsmanager.Secret(this, 'GeminiApiKey', {
      secretName: GEMINI_SECRET_KEY,
      description: 'Google Gemini API key for the Advisor API',
    });

    // RDS (PostgreSQL + pgvector via extension)
    const dbCredentials = rds.Credentials.fromGeneratedSecret('advisor', {
      secretName: POSTGRES_SECRET_KEY,
    });

    const db = new rds.DatabaseInstance(this, 'AdvisorDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: dbCredentials,
      databaseName: 'advisor',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      backupRetention: cdk.Duration.days(0),
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'AdvisorCluster', {
      vpc,
      clusterName: ADVISOR_ECS_CLUSTER,
    });

    // Task Execution Role — used by the ECS agent to pull images, push logs, and inject secrets
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    ecrRepo.grantPull(executionRole);
    geminiSecret.grantRead(executionRole);
    db.secret!.grantRead(executionRole);

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'AdvisorLogs', {
      logGroupName: ADVISOR_LOG_GROUP,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Fargate Task Definition
    const taskDef = new ecs.FargateTaskDefinition(this, 'AdvisorTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole,
    });

    taskDef.addContainer('ApiContainer', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      portMappings: [{ containerPort: 3000 }],
      environment: { NODE_ENV: 'production' }, 
      secrets: {
        GEMINI_API_KEY: ecs.Secret.fromSecretsManager(geminiSecret),
        DB_HOST:        ecs.Secret.fromSecretsManager(db.secret!, 'host'),
        DB_USER:        ecs.Secret.fromSecretsManager(db.secret!, 'username'),
        DB_PASS:        ecs.Secret.fromSecretsManager(db.secret!, 'password'),
        DB_NAME:        ecs.Secret.fromSecretsManager(db.secret!, 'dbname'),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'advisor-api',
        logGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget -qO- http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Fargate Service
    const fargateService = new ecs.FargateService(this, 'AdvisorService', {
      cluster,
      taskDefinition: taskDef,
      serviceName: 'advisor-service',
      desiredCount: 1,
      securityGroups: [apiSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      enableExecuteCommand: true,
    });

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'AdvisorAlb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const listener = alb.addListener('HttpListener', {
      port: 80,
      open: false,
    });

    listener.addTargets('ApiTarget', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [fargateService],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: cluster.clusterName,
      description: 'ECS cluster name - used by CI to force redeployment',
    });

    new cdk.CfnOutput(this, 'EcsServiceName', {
      value: fargateService.serviceName,
      description: 'ECS service name - used by CI to force redeployment',
    });

    // Outputs
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS - access the API at http://<this>/api/docs',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepo.repositoryUri,
      description: 'ECR repository URI - push docker images here',
    });

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: db.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint',
    });
  }
}
