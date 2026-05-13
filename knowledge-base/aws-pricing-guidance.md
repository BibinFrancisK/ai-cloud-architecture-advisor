# AWS Pricing Guidance

## AWS Free Tier Limits

The AWS Free Tier has three types: 12-month free (new accounts only), always-free (any account), and trials (short-term). Key limits relevant to portfolio and early-stage workloads:

| Service | Free Tier Type | Monthly Allowance |
|---|---|---|
| AWS Lambda | Always-free | 1M requests, 400,000 GB-seconds compute |
| Amazon DynamoDB | Always-free | 25 GB storage, 25 RCU, 25 WCU |
| Amazon S3 | 12-month | 5 GB Standard storage, 20,000 GET, 2,000 PUT |
| Amazon EC2 | 12-month | 750 hrs t2.micro or t3.micro (Linux) |
| Amazon RDS | 12-month | 750 hrs db.t3.micro, 20 GB storage |
| Amazon CloudFront | Always-free | 1 TB data transfer out, 10M HTTP requests |
| Amazon API Gateway | 12-month | 1M REST API calls/month |
| Amazon SNS | Always-free | 1M publishes, 100,000 HTTP deliveries |
| Amazon SQS | Always-free | 1M requests |
| AWS Secrets Manager | Trial | 30 days per secret |

**Important:** Free tier applies per region aggregate, not per resource. A t2.micro running 24/7 for 31 days uses 744 hrs — within the 750-hr limit. Two t2.micros running simultaneously consume the free tier in ~15 days.

---

## Compute Cost Comparison by Traffic Pattern

### Low Traffic (< 1M requests/month)

| Option | Estimated Monthly Cost | Notes |
|---|---|---|
| Lambda + API Gateway | $0–$3 | Within free tier; API Gateway REST $3.50/M req above free tier |
| App Runner | ~$5–15 | Minimum 0.25 vCPU even at low traffic |
| ECS Fargate (1 task) | ~$30–40 | Always-on task; no scale-to-zero without custom logic |
| EC2 t3.micro | ~$8 | On-demand; add ALB ~$18/month |

**Recommendation:** Lambda for APIs with < 1M requests/month. Cost is effectively zero within free tier.

### Medium Traffic (10–50M requests/month)

| Option | Estimated Monthly Cost | Notes |
|---|---|---|
| Lambda + API Gateway | $35–180 | Lambda ~$20, API Gateway ~$35–175 |
| ECS Fargate (1–2 tasks, on-demand) | $40–80 | 1 vCPU / 2 GB per task |
| ECS Fargate Spot | $12–25 | Up to 70% discount; accept interruptions |
| EC2 t3.small (on-demand) | $33 + ALB $18 = $51 | No auto-scaling complexity |
| EC2 t3.small (1-yr Reserved) | $21 + ALB $18 = $39 | Commit to 1 year |

**Recommendation:** Fargate Spot for fault-tolerant services; EC2 Reserved for stable, long-running workloads.

### High Traffic (> 100M requests/month)

| Option | Estimated Monthly Cost | Notes |
|---|---|---|
| Lambda + API Gateway | $350–1,500+ | API Gateway becomes expensive; consider ALB + Lambda ($0.008/LCU) |
| ECS Fargate (4–8 tasks) | $160–320 | Horizontal scaling; add ALB $18–50 |
| EC2 c6g.large × 2 (Reserved) | $80 + ALB $30 = $110 | Graviton2; best price/performance at scale |
| EC2 Auto Scaling Group | $150–400 | Mix on-demand + Spot; requires ASG tuning |

**Recommendation:** EC2 Graviton Reserved Instances with Auto Scaling for sustained high-throughput. Lambda + ALB (not API Gateway) is a cost-effective serverless option at this scale.

---

## Reserved Instances vs Savings Plans

| Feature | Reserved Instances (RI) | Compute Savings Plans |
|---|---|---|
| Discount vs on-demand | Up to 72% (3-yr, all upfront) | Up to 66% (3-yr, all upfront) |
| Flexibility | Locked to instance family, region, OS | Applies to any EC2, Fargate, Lambda in any region |
| Commitment term | 1 or 3 years | 1 or 3 years |
| Payment options | All upfront, partial, no upfront | All upfront, partial, no upfront |
| Applies to | EC2 only (RIs per service for RDS, ElastiCache, etc.) | EC2 + Fargate + Lambda |
| Best for | Stable, predictable EC2 workloads | Mixed or evolving compute portfolios |

**Rule:** Purchase Savings Plans before RIs — they cover more services with similar discounts and do not require instance-level commitment. Buy RIs only for specific RDS, ElastiCache, or OpenSearch instances where Savings Plans don't apply.

**1-year vs 3-year:** 1-year all-upfront gives ~40% discount; 3-year gives ~60%. Choose 1-year unless the architecture is stable and the team is confident in a 3-year infrastructure commitment.

---

## Spot Instances

- **Discount:** 70–90% below on-demand; price varies by instance family and AZ.
- **Interruption:** AWS can reclaim with a 2-minute warning.
- **Best for:** Batch jobs, CI/CD runners, stateless web tier with Auto Scaling, Fargate Spot for ECS tasks.
- **Avoid for:** Databases, stateful services, workloads with strict SLAs.

**Spot strategy:** Use mixed-instance Auto Scaling Groups with `capacity-optimized` allocation strategy. Spread across 3+ instance families and 2+ AZs to minimise simultaneous interruptions.

---

## Data Transfer Costs: The Hidden Budget Item

Data transfer pricing is frequently underestimated. Key rates (us-east-1, approximate):

| Transfer Type | Cost |
|---|---|
| Internet → AWS (inbound) | Free |
| AWS → Internet (first 100 GB/month) | $0.09/GB |
| AWS → Internet (next 9.9 TB/month) | $0.085/GB |
| Between AZs in same region (each direction) | $0.01/GB |
| Between regions | $0.02–0.08/GB depending on regions |
| EC2 → S3 in same region | Free |
| EC2 → CloudFront (same region) | Free |

**Multi-AZ cost implication:** An RDS Multi-AZ deployment replicates synchronously to a standby in another AZ. The replication traffic itself is free, but application traffic from compute in AZ-A to the RDS primary in AZ-B costs $0.01/GB each way. Place application and database in the same AZ for the primary read/write path.

**CloudFront for egress reduction:** Serving assets via Amazon CloudFront instead of directly from S3 or EC2 reduces data transfer costs (EC2→CloudFront is free within the same region) and improves latency. For workloads with > 1 TB/month egress, CloudFront typically pays for itself.

---

## Cost Optimisation Principles

### Right-Sizing
- Use AWS Compute Optimizer recommendations (free service) to identify over-provisioned EC2, Lambda, and ECS resources.
- Lambda memory is the primary cost lever: increasing memory from 128 MB to 512 MB often reduces duration by 4x, netting a lower bill.
- RDS instances are commonly over-sized: monitor CPU and freeable memory in CloudWatch for 2 weeks before right-sizing.

### Storage Optimisation
- Enable S3 Intelligent-Tiering for buckets with unpredictable access patterns (monitoring fee: $0.0025 per 1,000 objects/month; savings can exceed 40%).
- Delete unattached EBS volumes (common source of waste after instance termination).
- Use DynamoDB on-demand billing for dev/test; switch to provisioned with auto scaling once production traffic patterns are known.

### Networking Optimisation
- Add Amazon VPC Gateway Endpoints for S3 and DynamoDB — eliminates NAT Gateway charges for traffic to these services (NAT Gateway costs $0.045/GB processed).
- A NAT Gateway processing 100 GB/month costs ~$4.50 in data processing fees alone, plus $32.40/month for the gateway itself. VPC endpoints eliminate this for S3 and DynamoDB.
- Consolidate workloads into fewer regions to minimise cross-region data transfer.

---

## Budget Rules of Thumb

| Workload | Architecture | Approximate Monthly Cost |
|---|---|---|
| Portfolio / demo | Lambda + API Gateway + DynamoDB | $0–10 |
| Small API (< 5M req/month) | Lambda + API Gateway + RDS t3.micro | $20–50 |
| Medium service (10–50M req/month) | Fargate + ALB + Aurora Serverless v2 | $100–300 |
| High-traffic platform (> 100M req/month) | EC2 Graviton Reserved + Aurora + ElastiCache | $500–1,500 |
| Enterprise multi-region | Multi-region active-active + Global Aurora | $2,000–10,000+ |

These estimates exclude data transfer, CloudFront, WAF, and Secrets Manager costs, which typically add 10–20% to the base compute + storage bill.
