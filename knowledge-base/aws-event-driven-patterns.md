# AWS Event-Driven Patterns

## Messaging Service Selection Matrix

Choose the right AWS messaging service based on delivery model, ordering, throughput, consumer model, and cost.

| Dimension | Amazon SQS | Amazon SNS | Amazon EventBridge | Amazon Kinesis Data Streams |
|-----------|-----------|-----------|-------------------|----------------------------|
| Delivery model | Pull (polling) | Push (pub/sub) | Push (event bus) | Pull (shard iterator) |
| Ordering | FIFO only with FIFO queues | No guaranteed order | No guaranteed order | Per-shard ordering |
| Max throughput | Standard: unlimited; FIFO: 300–3,000 msg/s | 300 publishes/s per topic (soft) | 10,000 events/s per bus (soft) | 1 MB/s in per shard (no hard cap with enough shards) |
| Consumer model | Single consumer per message | Fan-out to N subscribers | Rule-based routing to targets | Multiple independent consumer groups |
| Retention | Up to 14 days | No retention (fire-and-forget) | Up to 24 hours (archive optional) | 1–365 days |
| Cost driver | Per request (64 KB chunk) | Per publish + delivery | Per event (64 KB chunk) | Per shard-hour + PUT payload |
| Best fit | Task queues, job offloading | Broadcast notifications | Event-driven microservices, SaaS integration | Log ingestion, clickstream, IoT telemetry |

---

## Amazon SQS

Amazon Simple Queue Service (Amazon SQS) is a fully managed message queue for decoupling producers and consumers.

### Standard vs FIFO Queues

| Feature | Standard Queue | FIFO Queue |
|---------|---------------|-----------|
| Ordering | Best-effort (not guaranteed) | Strict first-in, first-out |
| Throughput | Nearly unlimited | 300 msg/s without batching; 3,000 msg/s with batching (10 msg/batch) |
| Deduplication | No built-in dedup | 5-minute deduplication window using MessageDeduplicationId |
| Use case | High-throughput, order-insensitive tasks | Financial transactions, inventory updates requiring strict order |

### Dead-Letter Queues

- Set `maxReceiveCount` (1–1,000) on the source queue's redrive policy; messages exceeding this count are moved to the DLQ automatically.
- Configure DLQ retention to at least 4× the source queue's retention so failed messages are not lost before investigation.
- Use DLQ redrive (console or API) to replay messages back to the source queue after a bug fix.
- Alarm on `ApproximateNumberOfMessagesNotVisible` and `NumberOfMessagesSentToDLQ` metrics in Amazon CloudWatch.

### Visibility Timeout Tuning

- Default visibility timeout: 30 seconds. Set it to at least the 99th-percentile processing time of your consumer.
- If processing takes up to 5 minutes, set `VisibilityTimeout` to 360 seconds (add 20% buffer).
- Use `ChangeMessageVisibility` to extend the timeout dynamically for long-running jobs instead of setting a blanket high value.
- Too-short timeout → duplicate processing. Too-long timeout → slow failure recovery.

---

## Amazon SNS

Amazon Simple Notification Service (Amazon SNS) implements a push-based publish/subscribe model.

### Fan-Out Pattern

- One SNS topic publishes a single message; all subscribed endpoints receive a copy simultaneously.
- Typical fan-out: SNS topic → multiple Amazon SQS queues (each owned by a different service).
- Benefit: producer sends one request; consumers are fully decoupled and can scale independently.
- Fan-out to SQS queues also adds durability — SNS is fire-and-forget, but SQS retains the message.

### Supported Subscription Protocols

| Protocol | Use case |
|----------|---------|
| Amazon SQS | Durable async processing by downstream services |
| AWS Lambda | Serverless event processing with no queue needed |
| HTTP/HTTPS | Webhooks to external services |
| Email / Email-JSON | Human notifications, alerts |
| Amazon Kinesis Data Firehose | Direct fan-out to S3, Redshift, or OpenSearch |

### Message Filtering with Subscription Filter Policies

- Attach a filter policy (JSON) to a subscription; SNS delivers only messages whose attributes match.
- Filter policy is evaluated against `MessageAttributes`, not the message body.
- Example: `{"event_type": ["ORDER_PLACED", "ORDER_UPDATED"]}` delivers only those two event types to the subscriber.
- Reduces downstream processing cost — unmatched messages are dropped at SNS, not after delivery.
- Maximum 5 attribute conditions per filter policy.

---

## Amazon EventBridge

Amazon EventBridge is a serverless event bus designed for event-driven microservices and SaaS integrations.

### Event Buses

| Bus Type | Description |
|----------|-------------|
| Default | Receives AWS service events (EC2 state changes, S3 object creation, etc.) automatically |
| Custom | Created by you; receives application-generated events via `PutEvents` API |
| Partner | Receives events from SaaS partners (Datadog, Zendesk, Shopify, etc.) without custom integration code |

### Rule-Based Routing

- Rules match events using content-based filter patterns (JSON partial-match on any field in the event payload).
- Up to 300 rules per event bus (soft limit, raiseable).
- Each rule routes matching events to 1–5 targets (Lambda, SQS, SNS, Step Functions, Kinesis, HTTP endpoint, etc.).
- Input transformation: reshape or filter the event payload before delivering to the target — no extra Lambda needed.

### Schema Registry

- EventBridge automatically discovers and stores event schemas from your custom buses.
- Download generated code bindings (TypeScript, Java, Python) from the registry to produce/consume strongly-typed events.
- Enables contract-first event design across teams.

### EventBridge vs SNS

| Dimension | Amazon SNS | Amazon EventBridge |
|-----------|-----------|-------------------|
| Filtering | MessageAttribute-based | Content-based (any JSON field) |
| Sources | Application only | AWS services + SaaS partners + application |
| Schema registry | No | Yes |
| Event archive & replay | No | Yes (configurable retention) |
| Target types | ~6 | 20+ |
| Latency | ~milliseconds | ~milliseconds (slightly higher p99) |
| Cost | Cheaper at very high volume | Slightly more expensive per event |

**Prefer EventBridge** when: you need content-based routing, SaaS integrations, schema registry, or event replay. **Prefer SNS** for simple fan-out at very high volume where cost is the primary concern.

---

## Amazon Kinesis Data Streams

Amazon Kinesis Data Streams provides real-time, ordered, replayable data streaming for high-throughput ingestion.

### Shard Capacity

- Each shard: **1 MB/s or 1,000 records/s ingest**; **2 MB/s read throughput**.
- Shared throughput (default): all consumers share the 2 MB/s read limit per shard.
- Enhanced fan-out (dedicated throughput): each registered consumer gets its own 2 MB/s per shard — no competition.
- Retention: 24 hours (default), extendable to 7 days (standard), up to 365 days (long-term retention, additional cost).

### Consumer Types

| Consumer Type | Read Limit | Latency | Use case |
|--------------|-----------|---------|---------|
| Shared (GetRecords polling) | 2 MB/s per shard shared across all consumers | ~200 ms | Low-consumer-count pipelines |
| Enhanced fan-out (SubscribeToShard) | 2 MB/s per shard per registered consumer | ~70 ms (push-based) | Multiple independent consumers needing full throughput |

### Sizing Example

- 5,000 events/s at 500 bytes each = 2.5 MB/s ingest → minimum **3 shards**.
- Add 20–30% headroom for burst → provision **4 shards**.
- Use Amazon Kinesis Scaling Utilities or Application Auto Scaling to add/remove shards based on `IncomingBytes` metric.

---

## When NOT to Use Event-Driven Architecture

Async messaging adds latency, operational complexity, and observability challenges. Prefer synchronous REST or gRPC when:

- **Immediate response required**: user-facing APIs where the caller needs a result within the same HTTP request (e.g., login, search, payment confirmation UI).
- **Simple, low-volume workflows**: fewer than ~10 req/s with no burst — a direct Lambda invocation or REST call is easier to debug.
- **Strong consistency required**: distributed events make read-your-own-writes consistency difficult without extra coordination.
- **Team unfamiliar with async debugging**: poison messages, duplicate delivery, and out-of-order events are non-trivial failure modes.
- **Request-response semantics**: when the producer must act on the consumer's result (use REST + retry, or AWS Step Functions for orchestration).

---

## Common Event-Driven Patterns

### Saga Pattern (Distributed Transactions)

- Breaks a multi-service transaction into a sequence of local transactions, each publishing an event on success.
- **Choreography**: each service listens for events and reacts — no central coordinator; simpler but harder to trace.
- **Orchestration**: a central orchestrator (e.g., AWS Step Functions) directs each step — easier to monitor and compensate.
- Compensating transactions roll back already-completed steps on failure; design these before implementing the happy path.
- Use Step Functions Standard Workflows for long-running sagas (up to 1 year execution, full audit history).

### Outbox Pattern (Reliable Event Publishing)

- Problem: writing to a database and publishing an event are two separate operations — one can fail without the other.
- Solution: write the event to an `outbox` table in the same local database transaction as the business data.
- A separate process (poller or change-data-capture via AWS DMS or Debezium) reads the outbox and publishes to SNS/EventBridge/Kinesis.
- Guarantees at-least-once delivery without distributed transactions.
- Mark outbox rows as processed after successful publish; archive or delete on a schedule.

### Event Sourcing Basics

- Store every state change as an immutable event in an append-only log (Kinesis or DynamoDB Streams work well).
- Current state is derived by replaying events from the beginning (or from a snapshot).
- Benefits: full audit trail, temporal queries ("what was the state at time T?"), easy event replay.
- Tradeoffs: increased storage, query complexity (CQRS read models required), schema evolution is non-trivial.
- Start with event sourcing only when auditability or replay is a hard requirement — it adds significant complexity.
