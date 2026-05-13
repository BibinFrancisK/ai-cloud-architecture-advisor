# AWS Compute Patterns

## Compute Service Selection Matrix

Use this table as the first-pass filter when choosing a compute platform on AWS. Evaluate each criterion independently; the service that wins the most applicable criteria is the default recommendation.

| Criterion | AWS Lambda | Amazon ECS Fargate | Amazon EC2 | AWS App Runner | AWS Elastic Beanstalk |
|---|---|---|---|---|---|
| Max execution duration | 15 minutes | Unlimited | Unlimited | Unlimited | Unlimited |
| Latency sensitivity | Medium (cold starts) | Low | Low | Medium (cold starts) | Low |
| Scale pattern | Spiky / event-driven | Steady or gradual | Steady, predictable | Low-to-medium steady | Low-to-medium steady |
| DevOps maturity required | Low | Medium–High | High | Low | Low–Medium |
| Operational overhead | Minimal | Medium | High | Minimal | Low–Medium |
| Cost model | Pay-per-invocation | Pay-per-vCPU/memory-second | Pay-per-instance-hour | Pay-per-vCPU/memory-second | Pay-per-instance-hour |
| Container support | Supported (container image) | Native | Native | Native | Native |
| Persistent local storage | No | Ephemeral (20 GB EBS) | Full EBS/EFS | Ephemeral | Full EBS/EFS |
| VPC integration | Optional (adds cold-start latency) | Native | Native | Supported | Native |

## When to Choose Each Service

### AWS Lambda

Choose Lambda when:
- Workloads are event-driven (API Gateway, S3 events, SQS, EventBridge, Kinesis).
- Individual invocations complete in under 15 minutes.
- Traffic is highly spiky with long idle periods between bursts (e.g., nightly batch triggers, webhook receivers).
- The team wants zero server management and automatic scaling from 0 to 10,000+ concurrent executions.
- Cost optimisation for low or irregular traffic is a priority — Lambda charges only for compute time (measured in GB-seconds), with 1 million free requests and 400,000 GB-seconds per month on the free tier.

Avoid Lambda when: sustained high-throughput workloads run continuously (cost exceeds Fargate at ~50% utilisation), or when the runtime requires stateful in-process caches between requests.

### Amazon ECS Fargate

Choose ECS Fargate when:
- The workload is containerised and requires execution durations beyond 15 minutes.
- The team has existing Docker expertise and CI/CD pipelines that produce container images.
- Fine-grained task-level IAM roles, network security groups, and service discovery (AWS Cloud Map) are required.
- Workloads benefit from Fargate Spot for batch and fault-tolerant tasks (up to 70% cost reduction vs. on-demand Fargate).
- The application needs sidecar containers (e.g., logging agents, service mesh proxies with AWS App Mesh).

### Amazon EC2

Choose EC2 when:
- Workloads require specific hardware (GPU instances for ML inference, high-memory instances, bare-metal).
- Applications need persistent local NVMe SSD storage with predictable IOPS.
- Licensing constraints require BYOL (Bring Your Own License) operating systems.
- The team has mature AMI-baking and auto-scaling group management practices.
- Reserved Instance or Savings Plan commitments have already been purchased for that instance family.

### AWS App Runner

Choose App Runner when:
- The team wants the simplest possible path from a container image or source repository to a running HTTPS endpoint.
- The application is a stateless HTTP API or web service with no requirement for custom VPC networking, service mesh, or sidecar containers.
- DevOps maturity is low — App Runner handles load balancing, TLS, auto-scaling, and rolling deployments automatically.
- Expected traffic is low-to-medium and consistent; App Runner scales to zero and charges only for active compute (similar model to Fargate but with higher abstraction).

### AWS Elastic Beanstalk

Choose Elastic Beanstalk when:
- Migrating an existing application that already targets a supported platform (Java, Node.js, Python, .NET, PHP, Ruby, Go, Docker).
- The team wants managed OS patching and platform updates with minimal re-architecture.
- A PaaS experience is preferred but EC2-level control (SSH access, custom AMIs, full security group configuration) must be retained.

## Lambda Cold Start Implications and Mitigations

### Cold Start Latency by Runtime (approximate)

| Runtime | Typical Cold Start | Notes |
|---|---|---|
| Node.js 20 | 200–400 ms | Fastest interpreted runtime |
| Python 3.12 | 200–500 ms | Similar to Node.js |
| Java 21 (JVM) | 1,000–3,000 ms | JVM class loading is the dominant cost |
| Java 21 + SnapStart | 100–200 ms | Snapshot restores pre-initialised JVM state |
| .NET 8 | 300–700 ms | |
| Container image (any) | +500–2,000 ms additional | Image size and layer count matter |

### Mitigations

**Provisioned Concurrency** — Pre-initialises a fixed number of Lambda execution environments so they are always warm. Eliminates cold starts for that concurrency level. Cost: charged at the provisioned concurrency rate (~$0.015 per GB-hour) even when idle. Use Application Auto Scaling to schedule provisioned concurrency only during peak hours.

**AWS Lambda SnapStart (Java)** — Publishes a snapshot of the initialised execution environment. On invocation, the snapshot is restored rather than re-running static initialisation. Reduces Java cold starts from 1–3 seconds to under 200 ms at no additional charge beyond standard Lambda pricing. Supported on Java 11+ managed runtimes; not available for container image deployments.

**Keep-Warm Patterns** — Schedule an Amazon EventBridge rule to invoke the function every 5 minutes with a synthetic "ping" event. Effective for low-concurrency functions where provisioned concurrency cost is not justified. Limitation: only keeps one execution environment warm; does not help if concurrent invocations spike above 1.

**Minimise Deployment Package Size** — Smaller packages (or smaller container layers) reduce initialisation time. Target < 10 MB for ZIP deployments; use Lambda Layers for shared dependencies.

**Move Heavy Initialisation Outside the Handler** — SDK clients, database connection pools, and configuration loading placed in the module-level (outside the handler function) are reused across warm invocations. This does not eliminate cold starts but reduces their frequency's user impact.

## ECS Fargate vs EC2 Launch Type

| Factor | Fargate Launch Type | EC2 Launch Type |
|---|---|---|
| Server management | None — AWS manages underlying hosts | Team manages EC2 instances, AMIs, patching |
| Cluster capacity planning | Not required | Required (auto-scaling groups, instance types) |
| Networking modes | `awsvpc` only (each task gets its own ENI) | `awsvpc`, `bridge`, `host` |
| Windows containers | Supported | Supported |
| GPU workloads | Not supported | Supported (G/P instance families) |
| Spot integration | Fargate Spot (up to 70% savings) | EC2 Spot instances via mixed-instance ASG |
| Task density | One task per virtual host unit | Multiple tasks per EC2 instance |
| Cost at scale (high utilisation) | Higher per-vCPU than EC2 reserved | Lower with Reserved Instances |
| Recommended team profile | Teams wanting low operational overhead | Teams with strong EC2/ASG expertise |

**Networking note:** Fargate's `awsvpc` mode means every task consumes one ENI in the VPC. In large clusters this can exhaust subnet ENI limits — plan subnet CIDR blocks accordingly (a /24 supports ~250 tasks; use /22 or larger for production clusters).

## App Runner vs Fargate: Simplicity vs Control

| Factor | AWS App Runner | Amazon ECS Fargate |
|---|---|---|
| Setup time (hello-world to HTTPS) | ~5 minutes | 30–60 minutes (cluster, service, ALB, target group, listener) |
| Custom VPC networking | Supported (VPC connector) | Native, full control |
| Sidecar containers | Not supported | Supported |
| Service mesh / App Mesh | Not supported | Supported |
| Observability integration | CloudWatch Logs, metrics only | Full: X-Ray, Container Insights, FireLens |
| Deployment trigger | ECR push or GitHub commit | Manual or CI/CD pipeline |
| Auto-scaling configuration | Concurrency-based (requests per instance) | CPU/memory or custom CloudWatch metrics |
| Minimum cost (idle service) | ~$0.007/vCPU-hour (paused) | ~$0.04/vCPU-hour (tasks stopped = $0) |

**Rule of thumb:** Use App Runner for a single-container HTTP API where the team does not need custom load balancer rules, multi-container tasks, or service mesh. Migrate to Fargate when any of those requirements arise.

## Serverless vs Container vs VM Cost Comparison

The following estimates assume a hypothetical API serving **10 million requests per month**, each with a **200 ms average duration**, requiring **512 MB memory**.

**AWS Lambda**
- Compute: 10M × 0.2 s × 0.5 GB = 1,000,000 GB-seconds → ~$16.67 (after free tier)
- Requests: 10M × $0.20/million = $2.00
- **Total: ~$19/month**

**Amazon ECS Fargate (1 vCPU / 2 GB, on-demand)**
- At 10M req/month with 200 ms average: approximately 0.5–1 task sustained
- 1 task × 730 hours × ($0.04048/vCPU-hour + $0.004445/GB-hour × 2) = ~$36/month
- **Total: ~$36/month** (less with Fargate Spot: ~$11/month)

**Amazon EC2 (t3.small, on-demand)**
- $0.0208/hour × 730 hours = ~$15/month instance cost
- Add: ALB (~$18/month base) + data transfer
- **Total: ~$33–40/month**; drops to ~$10/month with a 1-year Reserved Instance

**Summary:** Lambda is cheapest for spiky or low-volume workloads. Fargate Spot matches Lambda economics at medium load with more predictable latency. EC2 Reserved Instances win at sustained high utilisation (above ~60% CPU). Add ALB costs (~$18/month base + $0.008/LCU) to Fargate and EC2 estimates — Lambda behind API Gateway avoids this cost at the expense of API Gateway request pricing ($3.50/million for REST APIs).
