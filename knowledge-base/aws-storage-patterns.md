# AWS Storage Patterns

## Storage Service Selection Guide

Use this matrix to pick the right AWS storage service before diving into service-specific details.

| Service | Data Model | Access Pattern | Typical Latency | Best Fit |
|---|---|---|---|---|
| Amazon S3 | Object (key/value blobs) | Sequential, bulk | 10–200 ms | Files, backups, static assets, data lake |
| Amazon EFS | POSIX filesystem (NFS) | Shared random | 1–10 ms | Shared mounts across ECS tasks, Lambda, EC2 |
| Amazon EBS | Block device | Single-instance random | < 1 ms | OS volumes, single-node databases |
| Amazon DynamoDB | Document / key-value (NoSQL) | Point lookups, low-latency | < 10 ms | High-scale OLTP, session data, leaderboards |
| Amazon RDS | Relational (SQL) | Ad-hoc queries, joins | 1–5 ms | Traditional RDBMS workloads, moderate scale |
| Amazon Aurora | Relational (MySQL/PostgreSQL-compatible) | High-throughput SQL | 1–5 ms | RDS workloads needing higher availability or scale |
| Amazon ElastiCache (Redis) | In-memory key/value | Ultra-low-latency point | < 1 ms | Caching, sessions, pub/sub, rate limiting |

**Key decision questions:**
1. Does the data need ACID transactions? → Relational (RDS / Aurora / DynamoDB transactions).
2. Is access shared across multiple compute instances simultaneously? → EFS (filesystem) or S3 (object).
3. Is the access pattern primarily key-based with < 10 ms SLA? → DynamoDB or ElastiCache.
4. Is cost the primary constraint at petabyte scale? → S3 with lifecycle tiering.
5. Does the workload need complex joins or ad-hoc SQL? → RDS or Aurora, not DynamoDB.

---

## Amazon S3: Object Storage

### Use Cases

- Static asset hosting (images, JS, CSS) behind Amazon CloudFront.
- Data lake raw zone: store Parquet/CSV files queried by Amazon Athena.
- Application backups and DR snapshots.
- Machine learning training datasets and model artifacts.
- Log archival from CloudWatch, ALB access logs, VPC Flow Logs.

### Storage Tiers and Approximate Pricing (us-east-1, 2024)

| Tier | Min Storage Duration | Retrieval Fee | Approx. $/GB/month | Best For |
|---|---|---|---|---|
| S3 Standard | None | None | $0.023 | Frequently accessed data |
| S3 Standard-IA | 30 days | Per-GB retrieval | $0.0125 | Accessed < once/month |
| S3 Glacier Instant Retrieval | 90 days | Per-GB retrieval | $0.004 | Archives needing ms retrieval |
| S3 Glacier Flexible Retrieval | 90 days | Per-GB + request | $0.0036 | Archives, 1–12 h acceptable |
| S3 Glacier Deep Archive | 180 days | Per-GB + request | $0.00099 | 7–10 yr compliance retention |

### Lifecycle Policy Pattern

```
Day 0   → S3 Standard          (hot access)
Day 30  → S3 Standard-IA       (transition rule: days 30)
Day 90  → S3 Glacier Instant   (transition rule: days 90)
Day 365 → S3 Glacier Deep Archive (transition rule: days 365)
```

Set lifecycle rules per prefix (e.g., `logs/`, `uploads/`) rather than bucket-wide to avoid premature tiering of active data.

---

## Amazon RDS vs Amazon Aurora

### When to Choose Amazon RDS

- Team is familiar with MySQL, PostgreSQL, Oracle, or SQL Server and workload is moderate (< 10k transactions/minute).
- Budget is constrained: RDS db.t3.micro costs ~$13/month vs Aurora minimum ~$29/month.
- Workload does not require multi-region replication or sub-second failover.

### When Aurora's Cost Premium Is Justified

| Scenario | Aurora Advantage |
|---|---|
| > 100k read queries/minute | Up to 15 read replicas vs RDS's 5; shared storage eliminates replica lag on writes |
| Failover SLA < 30 s | Aurora fails over in ~20 s vs RDS ~60–120 s |
| Variable / unpredictable load | Aurora Serverless v2 scales in increments of 0.5 ACU; avoids over-provisioning |
| Multi-region active-read | Aurora Global Database replicates with < 1 s lag across up to 5 regions |
| MySQL or PostgreSQL wire compatibility needed at scale | Drop-in replacement; no app changes |

**Aurora Serverless v2 billing:** $0.12 per ACU-hour (1 ACU ≈ 2 GB RAM). Minimum 0.5 ACU means ~$43/month at idle — avoid for dev/test; use RDS t-class instead.

---

## Amazon DynamoDB: NoSQL Key-Value and Document Store

### Single-Table Design Principles

- Store all entity types in one table using a composite primary key: `PK` (partition key) + `SK` (sort key).
- Use prefixed values to differentiate entities: `PK=USER#123`, `SK=PROFILE` or `SK=ORDER#456`.
- Model access patterns first; add Global Secondary Indexes (GSIs) only for access patterns that cannot be served by the base table.
- Keep item size under 4 KB to minimize read capacity unit (RCU) consumption (1 RCU = 4 KB strongly consistent read).

### Partition Key Selection

- Choose a key with high cardinality (user ID, order ID, UUID) to distribute load evenly across partitions.
- Avoid hot partitions: a single partition handles a maximum of 3,000 RCU and 1,000 WCU per second.
- For time-series data, add a random suffix or shard number to the partition key to spread writes.

### Billing Modes

| Mode | Best For | Caution |
|---|---|---|
| On-Demand | Spiky or unknown traffic; dev/test | 6–7x more expensive per request than provisioned at steady load |
| Provisioned + Auto Scaling | Predictable, steady-state traffic | Set min/max capacity; scale events take ~15 min to stabilize |

### When NOT to Use DynamoDB

- Complex multi-entity joins (e.g., reporting dashboards) — query via Amazon Athena on exported S3 data instead.
- Ad-hoc SQL queries or aggregations (SUM, GROUP BY) — use Amazon RDS or Amazon Redshift.
- Strong relational integrity requirements (foreign keys, cascades) — use RDS/Aurora.
- Small datasets (< 1 GB) with infrequent access — overhead of NoSQL modeling is not worth it; use RDS.

---

## Amazon EFS vs Amazon EBS

### Amazon EFS (Elastic File System)

- **Protocol:** NFSv4.1 — mountable by multiple EC2 instances, ECS tasks, and Lambda functions simultaneously.
- **Throughput modes:** Bursting (baseline 1 MB/s per GB stored) or Provisioned (up to 1,024 MB/s).
- **Storage classes:** EFS Standard ($0.30/GB/month) and EFS Infrequent Access ($0.025/GB/month, retrieval fee applies).
- **Use when:** Multiple compute nodes need shared read/write access to the same files (e.g., shared model weights, CMS media, build caches across ECS tasks).

### Amazon EBS (Elastic Block Store)

- **Protocol:** Block device attached to a single EC2 instance at a time (Multi-Attach supported on io2 only, same AZ).
- **Volume types:**

| Type | IOPS | Throughput | Use Case |
|---|---|---|---|
| gp3 | Up to 16,000 | Up to 1,000 MB/s | General purpose OS + DB volumes |
| io2 Block Express | Up to 256,000 | Up to 4,000 MB/s | Latency-sensitive databases (Oracle, SQL Server) |
| st1 (HDD) | 500 | 500 MB/s | Sequential big-data workloads |
| sc1 (HDD) | 250 | 250 MB/s | Cold, infrequently accessed data |

- **Use when:** Single-instance database (PostgreSQL on EC2), OS root volume, applications requiring < 1 ms block I/O.

---

## Amazon ElastiCache (Redis): In-Memory Data Store

### Caching Patterns

**Cache-Aside (Lazy Loading)**
1. Application checks cache; on miss, reads from database.
2. Application writes result to cache with TTL (e.g., 300 s).
3. Subsequent reads hit cache until TTL expires.
- Pros: Cache only contains requested data; resilient to cache failure.
- Cons: Cache miss incurs full DB round-trip; potential for stale data within TTL window.

**Write-Through**
1. Application writes to cache and database synchronously on every write.
2. Cache is always consistent with the database.
- Pros: No stale data; reads always hit cache.
- Cons: Write latency doubles; cache fills with data that may never be read.

### Session Storage

- Store JWT or session tokens in Redis with TTL equal to session expiry.
- Key pattern: `session:{userId}:{sessionId}` → serialized session object.
- Use Redis EXPIRE to auto-evict sessions; eliminates manual cleanup jobs.
- ElastiCache Serverless is appropriate when session count is unpredictable (scales to 13.3 TB).

### Pub/Sub and Rate Limiting

- **Pub/Sub:** Use Redis PUBLISH/SUBSCRIBE for real-time fan-out (chat, notifications). Not durable — messages dropped if subscriber is offline; use Amazon SQS/SNS for guaranteed delivery.
- **Rate limiting:** Sliding window counter with Redis INCR + EXPIRE. Atomic operations prevent race conditions.

### Sizing Guidance

- Start with a cache.r7g.large (13.07 GB RAM, ~$0.17/hr us-east-1) for most web API caches.
- Monitor `CacheHitRate` CloudWatch metric; target > 90% before scaling vertically.
- Enable cluster mode for horizontal scaling beyond single-node memory limits.
