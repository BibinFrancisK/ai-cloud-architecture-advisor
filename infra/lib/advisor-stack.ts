import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Construct } from 'constructs';
import { ADVISOR_ECR, GEMINI_SECRET_KEY, POSTGRES_SECRET_KEY, AWS_REGION } from '../types/constants';

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
      description: 'API EC2 - allow traffic from ALB',
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

    // EC2 instance role
    const instanceRole = new iam.Role(this, 'ApiInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    ecrRepo.grantPull(instanceRole);
    geminiSecret.grantRead(instanceRole);
    db.secret?.grantRead(instanceRole);

    // EC2 UserData - export CDK tokens as shell variables then run the script
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `export AWS_REGION="${AWS_REGION}"`,
      `export ECR_REPO_URI="${ecrRepo.repositoryUri}"`,
      `export POSTGRES_SECRET_ID="${POSTGRES_SECRET_KEY}"`,
      `export GEMINI_SECRET_ID="${GEMINI_SECRET_KEY}"`,
    );
    const startupScript = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'ec2-userdata.sh'),
      'utf-8',
    );
    userData.addCommands(startupScript);

    // EC2 instance
    const apiInstance = new ec2.Instance(this, 'ApiInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: apiSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      role: instanceRole,
      userData,
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
      targets: [new elbv2_targets.InstanceTarget(apiInstance, 3000)],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
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
