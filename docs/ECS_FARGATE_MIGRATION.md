# ECS Fargate Migration Plan

Migrate the API deployment from a manually managed EC2 instance (Docker via UserData) to ECS Fargate. This eliminates the fragile userdata bootstrap script, gets native Secrets Manager injection, built-in container health-check restarts, and CloudWatch Logs — without changing the application code significantly.

---

## Motivation

| Problem with EC2 + UserData | How ECS Fargate solves it |
|-----------------------------|---------------------------|
| Docker install can fail silently (`set -euo pipefail` + dnf errors abort startup) | ECS manages the container runtime — no userdata script |
| Secrets must be fetched manually via `aws secretsmanager get-secret-value` in bash | Native `ecs.Secret.fromSecretsManager()` injects values before container start |
| Container crash does not restart automatically | ECS service maintains `desiredCount`; failed tasks are replaced |
| No structured logs — stdout only visible via SSM session | awslogs driver → CloudWatch Logs automatically |
| Updating the container requires SSH/SSM + manual `docker pull` | `cdk deploy` triggers a rolling ECS deployment |
| RDS schema/ingest must be run manually via `docker exec` | `docker exec` still available via ECS Exec; same workflow |

---

## Architecture After Migration

```
Internet → ALB (public subnet, port 80)
              │
              ▼ port 3000
         ECS Fargate Service (private subnet, 1 task)
              │                  │
              ▼                  ▼
         RDS PostgreSQL     Secrets Manager
         (isolated subnet)  (GEMINI_API_KEY, DB credentials)
              ↑
         ECR Repository (image pull via execution role)
```

Security group rules are unchanged — `albSg → apiSg (3000) → rdsSg (5432)`.

---

## CDK Changes (`infra/lib/advisor-stack.ts`)

### Remove
- `ec2.Instance` construct
- `ec2.UserData` block
- `fs.readFileSync` of `ec2-userdata.sh`
- IAM Instance Role (replaced by Task Execution Role + Task Role)

### Add

**ECS Cluster**
```typescript
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';

const cluster = new ecs.Cluster(this, 'AdvisorCluster', { vpc });
```

**Task Execution Role** — used by the ECS agent (image pull, log delivery, secrets injection)
```typescript
const executionRole = new iam.Role(this, 'TaskExecutionRole', {
  assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
  ],
});
ecrRepo.grantPull(executionRole);
geminiSecret.grantRead(executionRole);
db.secret!.grantRead(executionRole);
```

**Task Definition** — 0.25 vCPU / 512 MiB (free-tier-equivalent sizing)
```typescript
const taskDef = new ecs.FargateTaskDefinition(this, 'AdvisorTaskDef', {
  cpu: 256,
  memoryLimitMiB: 512,
  executionRole,
});

const logGroup = new logs.LogGroup(this, 'AdvisorLogs', {
  retention: logs.RetentionDays.ONE_WEEK,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
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
```

**Fargate Service**
```typescript
const fargateService = new ecs.FargateService(this, 'AdvisorService', {
  cluster,
  taskDefinition: taskDef,
  desiredCount: 1,
  securityGroups: [apiSg],
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  assignPublicIp: false,
  enableExecuteCommand: true,   // allows `aws ecs execute-command` for debugging
});
```

**ALB target** — replace `InstanceTarget` with Fargate service
```typescript
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
```

---

## Application Change (`apps/api/src/rag/vector-store.service.ts`)

ECS injects individual secret fields (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`) rather than a pre-built `DATABASE_URL`. Update `onModuleInit` to construct the URL if `DATABASE_URL` is absent:

```typescript
onModuleInit(): void {
  const connectionString =
    process.env.DATABASE_URL ??
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:5432/${process.env.DB_NAME}`;

  this.pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}
```

Local Docker Compose development continues to use `DATABASE_URL` unchanged.

---

## pgvector Index Issue (Separate, Must Resolve Before Ingest)

`gemini-embedding-001` produces 3072-dim vectors. IVFFlat has a hard 2000-dimension limit. For a corpus of ~100 vectors, sequential scan (`ORDER BY embedding <=> $1 LIMIT 5`) is fast enough — index lookup overhead only pays off above ~10 000 rows.

**Fix in `scripts/init.sql`:** remove the `CREATE INDEX` statement entirely.

```sql
-- Remove these lines:
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

The similarity search query is unchanged — pgvector will use a sequential scan automatically.

---

## Files Changed

| File | Action |
|------|--------|
| `infra/lib/advisor-stack.ts` | Replace EC2 + UserData with ECS Cluster + Task Definition + Fargate Service |
| `infra/scripts/ec2-userdata.sh` | **Delete** — no longer needed |
| `apps/api/src/rag/vector-store.service.ts` | Construct `connectionString` from individual env vars when `DATABASE_URL` absent |
| `scripts/init.sql` | Remove IVFFlat index (sequential scan for small corpus) |
| `README.md` | Update Deployment section + Tech Stack table |
| `ARCHITECTURE.md` | Update Section 5 diagram + CDK resources table |

---

## Running Schema + Ingest After Deployment

ECS Exec replaces `docker exec`:

```bash
# Get the task ARN
TASK=$(aws ecs list-tasks --cluster AdvisorCluster --query 'taskArns[0]' --output text)

# Run schema init
aws ecs execute-command \
  --cluster AdvisorCluster \
  --task "$TASK" \
  --container ApiContainer \
  --interactive \
  --command "node dist/scripts/ingest-knowledge-base.js"
```

Or run ingest as a one-off ECS task (same task definition, overridden command).

---

## Definition of Done

| Item | Check |
|------|-------|
| `cdk synth` runs without errors | |
| ECS Fargate service reaches RUNNING state | |
| ALB health check returns healthy (target group shows 1/1 healthy) | |
| `GET /health` returns `{ status: "ok" }` via ALB DNS | |
| `scripts/init.sql` applied via ECS Exec | |
| Ingest script completes via ECS Exec | |
| `GET /health` shows `vectorStore: "connected"` | |
| Full conversation flow works end-to-end via ALB | |
