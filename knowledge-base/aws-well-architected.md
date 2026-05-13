# AWS Well-Architected Framework

The AWS Well-Architected Framework provides a consistent approach for evaluating cloud architectures against 6 pillars. Use it as a structured tradeoff tool, not a compliance checklist — every architecture involves intentional tradeoffs, and the goal is to make them explicitly.

---

## Pillar 1 — Operational Excellence

**Definition:** The ability to run and monitor systems to deliver business value and continually improve supporting processes and procedures.

### Key Design Principles

- **Perform operations as code** — Define infrastructure and runbooks as code (CDK, CloudFormation). Eliminate manual operations that cause inconsistency.
- **Make frequent, small, reversible changes** — Design for rollback. Avoid large, infrequent deployments that are hard to debug.
- **Refine operations procedures frequently** — Game days and runbooks become stale; validate them regularly.
- **Anticipate failure** — Inject failures in pre-production (chaos engineering). Design for partial failure, not just success paths.
- **Learn from all operational failures** — Post-incident reviews should produce concrete action items, not blame.

### Key Architecture Questions

- How are deployments automated? Is there a CI/CD pipeline with automated rollback?
- How are runbooks maintained? Are they executable (Systems Manager Automation) or manual steps?
- What observability exists? Can you detect and diagnose issues without SSH access?
- How are configuration changes managed? Is there drift detection (Config Rules)?

---

## Pillar 2 — Security

**Definition:** The ability to protect information, systems, and assets while delivering business value through risk assessments and mitigation strategies.

### Key Design Principles

- **Implement a strong identity foundation** — Use IAM roles, not long-lived access keys. Apply least-privilege. Enforce MFA for human identities. Use AWS Organizations SCPs for guardrails.
- **Enable traceability** — CloudTrail for API calls, VPC Flow Logs for network traffic, Config for resource changes. All logs centralised to a dedicated security account.
- **Apply security at all layers** — VPC, subnet, security group, OS, application, data. Defence in depth.
- **Automate security best practices** — Security Hub, GuardDuty, and Config Rules detect drift automatically. Do not rely on manual audits.
- **Protect data in transit and at rest** — TLS everywhere. KMS customer-managed keys for regulated data. Encrypt S3 buckets by default.
- **Keep people away from data** — Access via tools, not direct database/S3 access. Break-glass procedures for emergencies.

### Key Architecture Questions

- What data classifications exist? Which data requires encryption at rest with CMKs?
- Are there compliance requirements? (GDPR data residency, PCI-DSS cardholder data, HIPAA PHI, SOC2)
- Who needs access to production? Is break-glass access logged and time-limited?
- Are API keys and secrets stored in Secrets Manager or hardcoded?

---

## Pillar 3 — Reliability

**Definition:** The ability of a system to recover from infrastructure or service disruptions, dynamically acquire computing resources to meet demand, and mitigate disruptions such as misconfigurations or transient network issues.

### Key Design Principles

- **Automatically recover from failure** — Use Auto Scaling, ECS service auto-recovery, RDS Multi-AZ. Do not rely on manual intervention.
- **Test recovery procedures** — Regularly test backups, failover, and DR procedures. Untested recovery is not recovery.
- **Scale horizontally to increase aggregate system availability** — Many small resources fail independently; one large resource is a single point of failure.
- **Stop guessing capacity** — Use Auto Scaling with target tracking. Right-size after observing real load.
- **Manage change in automation** — Uncontrolled manual changes are the leading cause of outages. Everything through IaC and CI/CD.

### Key Architecture Questions

- What is the RTO (Recovery Time Objective) and RPO (Recovery Point Objective)?
- Are there single points of failure? Is every tier deployed across at least 2 AZs?
- How are database backups tested? When was the last restore drill?
- What happens when a downstream dependency is slow or unavailable? Are there circuit breakers or timeouts?

---

## Pillar 4 — Performance Efficiency

**Definition:** The ability to use computing resources efficiently to meet system requirements and maintain that efficiency as demand changes and technologies evolve.

### Key Design Principles

- **Democratise advanced technologies** — Use managed services (Aurora, ElastiCache, OpenSearch) rather than running complex infrastructure yourself.
- **Go global in minutes** — CloudFront, Global Accelerator, and multi-region deployments reduce latency for global users with minimal effort.
- **Use serverless architectures** — Lambda and Fargate eliminate server management. Reserve EC2 for workloads with specific OS or hardware requirements.
- **Experiment more often** — Evaluate new instance types, storage classes, and caching strategies. What was optimal 12 months ago may not be today.
- **Consider mechanical sympathy** — Match service characteristics to your workload. DynamoDB for unpredictable scale; Aurora for relational with ACID; S3 for object storage.

### Key Architecture Questions

- What are the latency requirements? p50 / p99 targets? Real-time vs. near-real-time vs. batch?
- What is the read/write ratio? Is caching (ElastiCache) appropriate?
- Are there compute-intensive operations that benefit from Graviton3 instances (20–40% better price/performance)?
- Is there a CDN opportunity? Static assets, API responses, or regional caching?

---

## Pillar 5 — Cost Optimisation

**Definition:** The ability to run systems to deliver business value at the lowest price point.

### Key Design Principles

- **Implement cloud financial management** — Tag all resources. Use Cost Explorer and Budgets. Assign cost responsibility to teams.
- **Adopt a consumption model** — Pay for what you use. Prefer serverless (Lambda, Fargate Spot) for variable workloads. Avoid over-provisioned fixed capacity.
- **Measure overall efficiency** — Track cost per business transaction, not just total spend. Optimise the ratio, not just the absolute number.
- **Stop spending money on undifferentiated heavy lifting** — Managed databases, managed queues, managed search — delegate operational burden to AWS.
- **Analyse and attribute expenditure** — Without tagging and cost allocation, you cannot identify waste.

### Key Architecture Questions

- What is the monthly infrastructure budget? Is the priority lowest cost, balanced, or best performance?
- Are workloads suitable for Spot instances or Savings Plans?
- Are there opportunities for S3 lifecycle policies, RDS instance right-sizing, or Lambda memory tuning?
- Are there idle or underutilised resources? (Common: oversized RDS instances, forgotten NAT Gateways)

### Cost Rules of Thumb

| Workload Size | Approximate Monthly Cost |
|---------------|--------------------------|
| Small API (< 1M req/month) | $20–50 (Lambda + DynamoDB) |
| Medium service (10–50M req/month) | $100–300 (Fargate + RDS) |
| High-traffic platform (> 100M req/month) | $500–1,500+ (EC2 + Aurora + ElastiCache) |

---

## Pillar 6 — Sustainability

**Definition:** Minimising the environmental impacts of running cloud workloads.

### Key Design Principles

- **Understand your impact** — Use the AWS Customer Carbon Footprint Tool to baseline and track emissions.
- **Establish sustainability goals** — Identify and implement specific improvements rather than general commitments.
- **Maximise utilisation** — Right-size resources and prefer higher-utilisation instance types. Under-utilised resources emit carbon without delivering value.
- **Use managed services** — AWS optimises fleet utilisation across customers; self-managed servers are almost always less efficient.
- **Use efficient hardware and software** — Graviton processors offer better performance-per-watt. Choose regions with higher renewable energy penetration (e.g., eu-west-1 Ireland, us-west-2 Oregon).

### Key Architecture Questions

- Are workloads right-sized? Is there significant idle capacity?
- Are Graviton3 instances viable for this workload (they offer ~60% better energy efficiency)?
- Is the workload deployed in a region with a high renewable energy mix?

---

## Well-Architected Review Approach

A Well-Architected Review is a structured conversation, not an audit. The goal is to surface known risks and make explicit tradeoff decisions.

### Process

1. **Scope** — Define the workload boundary (one service, not the whole platform)
2. **Interview** — Work through questions for each pillar with the team
3. **Identify HRIs** — High-Risk Items are issues that could cause significant business impact
4. **Prioritise** — Not every gap needs immediate remediation; assess likelihood × impact
5. **Improvement Plan** — Time-boxed action items with owners

### Common Tradeoffs

| Tradeoff | Typical Decision |
|----------|-----------------|
| Reliability vs. Cost | Multi-AZ adds ~2× database cost; accept for production, skip for dev |
| Security vs. Velocity | Strict IAM boundaries slow initial setup; pay once, save years of audit pain |
| Performance vs. Cost | ElastiCache adds ~$50–200/month; justified if DB is the bottleneck |
| Operational simplicity vs. Control | Fargate vs EC2: pay the Fargate premium for most workloads unless OS-level access is required |

### When to Invoke Each Pillar During Architecture Design

- **Security + Reliability** — Always, for every architecture decision
- **Performance Efficiency** — When latency or throughput requirements are stated
- **Cost Optimisation** — When budget is constrained or the workload is cost-sensitive
- **Operational Excellence** — When the team is small or on-call burden is a concern
- **Sustainability** — When the organisation has carbon reduction commitments
