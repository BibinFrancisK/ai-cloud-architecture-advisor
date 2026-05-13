# AWS Networking Patterns

## VPC Design: Subnet Layout and CIDR Sizing

Amazon VPC (Virtual Private Cloud) is the foundational network boundary for AWS workloads. Use a three-tier subnet model across at least two Availability Zones.

**Recommended CIDR allocation:**

| Tier | Subnet type | Example CIDR | Hosts per subnet |
|------|-------------|--------------|-----------------|
| VPC  | —           | 10.0.0.0/16  | 65,536           |
| Public (AZ-a) | Public | 10.0.0.0/24 | 251 |
| Public (AZ-b) | Public | 10.0.1.0/24 | 251 |
| Private app (AZ-a) | Private | 10.0.10.0/24 | 251 |
| Private app (AZ-b) | Private | 10.0.11.0/24 | 251 |
| Isolated DB (AZ-a) | Isolated | 10.0.20.0/24 | 251 |
| Isolated DB (AZ-b) | Isolated | 10.0.21.0/24 | 251 |

**Subnet roles:**
- **Public subnets** — contain the Internet Gateway route (`0.0.0.0/0 → igw`), used for load balancers and NAT Gateways. Never place application servers here.
- **Private subnets** — route outbound internet traffic through a NAT Gateway in the public subnet; no inbound internet access. Place ECS tasks, Lambda in VPC, and EC2 app servers here.
- **Isolated subnets** — no route to internet at all. Use for RDS, ElastiCache, and other data stores that should never initiate or accept internet connections.

**NAT Gateway vs Internet Gateway:**
- Internet Gateway (IGW): attached to the VPC, enables two-way internet for resources with a public IP. One per VPC.
- NAT Gateway: deployed per AZ in a public subnet; gives private-subnet resources outbound-only internet access. Cost: $0.045/hr + $0.045/GB processed. Deploy one per AZ for high availability.

---

## ALB vs API Gateway

| Criterion | Application Load Balancer (ALB) | Amazon API Gateway |
|-----------|--------------------------------|--------------------|
| Primary use case | HTTP/HTTPS routing to VPC targets (EC2, ECS, Lambda) | Managed REST/HTTP/WebSocket API front door |
| WebSocket | Yes (sticky sessions) | Yes (native WebSocket API type) |
| Request rate | Scales automatically; no hard throttle | 10,000 RPS default (adjustable) |
| Pricing model | $0.008/LCU-hr + $0.016/hr fixed | $3.50 per million REST calls; $1.00/million HTTP API calls |
| Auth integration | OIDC, Cognito (listener rules) | Cognito, Lambda authorizer, IAM, JWT |
| Private endpoints | Yes (internal ALB) | Yes (private API with VPC endpoint) |
| gRPC | Yes | No |
| Request transformation | No | Yes (mapping templates, velocity) |

**Decision criteria — choose ALB when:**
- Routing to ECS/EC2 containers in a private VPC.
- Traffic exceeds 10,000 RPS or cost of API Gateway requests is prohibitive at scale.
- gRPC or advanced TCP health checks are needed.

**Decision criteria — choose API Gateway when:**
- Building a serverless backend (Lambda-only, no VPC containers).
- Need built-in usage plans, API keys, or per-client throttling.
- WebSocket connections require managed connection state (API Gateway WebSocket manages `connectionId`).
- HTTP API type reduces cost by ~70 % vs REST API for simple proxy integrations.

---

## Amazon CloudFront: CDN Patterns

Amazon CloudFront is a global CDN with 400+ Points of Presence. It sits in front of any origin and caches responses at the edge.

**Common origin types:**

| Origin type | Typical use | Cache-Control header |
|-------------|-------------|----------------------|
| Amazon S3 (static site) | SPA assets, images, downloads | `max-age=31536000` for hashed filenames |
| Application Load Balancer | Dynamic API with edge acceleration | `no-store` or short TTL |
| Custom HTTP origin | On-premises or third-party API | Per-path cache behaviour |
| API Gateway | Serverless APIs | Short TTL or disabled |

**Cache behaviour configuration:**
- Define separate cache behaviours per path pattern (`/static/*`, `/api/*`).
- Use Cache Policies (managed or custom) rather than legacy `TTL` fields.
- `CachingOptimized` managed policy: TTL 1 day – 1 year; for immutable assets.
- `CachingDisabled` managed policy: for all API paths where freshness is required.

### Lambda@Edge vs CloudFront Functions

| Feature | CloudFront Functions | Lambda@Edge |
|---------|---------------------|-------------|
| Runtime | JavaScript (ES5.1) | Node.js, Python |
| Max execution time | 1 ms | 5 s (viewer) / 30 s (origin) |
| Max memory | 2 MB | 128 MB – 10 GB |
| Triggers | Viewer request, viewer response | All four events |
| Use cases | URL rewrites, header manipulation, A/B redirect | Auth, image resize, SSR, complex routing |
| Cost | $0.10 per million invocations | $0.60 per million + duration |

Choose **CloudFront Functions** for lightweight header rewrites and URL normalisation. Choose **Lambda@Edge** for authentication token validation, on-the-fly image transformation, or any logic requiring network calls.

---

## VPC Endpoints

Amazon VPC Endpoints allow private connectivity from within a VPC to AWS services without traversing the public internet, reducing data-transfer cost and eliminating internet exposure.

### Gateway Endpoints (free)

| Service | Endpoint type | Use |
|---------|--------------|-----|
| Amazon S3 | Gateway | Route S3 traffic through the VPC route table |
| Amazon DynamoDB | Gateway | Route DynamoDB traffic through the VPC route table |

Gateway endpoints are free and added to route tables; always enable them for S3 and DynamoDB in any VPC that uses those services.

### Interface Endpoints (charged)

Cost: $0.01/hr per AZ + $0.01/GB processed.

**Add interface endpoints when:**
- EC2/ECS instances in private subnets need AWS Systems Manager (SSM) access without NAT Gateway.
- Lambda or containers must access AWS Secrets Manager without internet egress.
- Compliance requires that data never leaves the AWS network backbone.

**Common interface endpoint services:**

| Service | Endpoint name |
|---------|--------------|
| AWS Systems Manager | `com.amazonaws.<region>.ssm`, `ssmmessages`, `ec2messages` |
| AWS Secrets Manager | `com.amazonaws.<region>.secretsmanager` |
| Amazon ECR | `ecr.api`, `ecr.dkr` |
| AWS KMS | `com.amazonaws.<region>.kms` |
| Amazon SQS | `com.amazonaws.<region>.sqs` |

---

## Security Groups vs NACLs

### Security Groups (stateful)

- Applied at the ENI (Elastic Network Interface) level.
- Stateful: return traffic is automatically allowed; no explicit outbound rule needed for allowed inbound.
- Allow rules only — no explicit deny.
- Recommended default: deny all inbound, allow all outbound; add specific inbound rules per service.

**Layered pattern:**
1. ALB security group: allow 443 from `0.0.0.0/0`.
2. App security group: allow port 8080 from ALB security group ID only.
3. DB security group: allow port 5432 from app security group ID only.

### Network ACLs (stateless)

- Applied at the subnet boundary.
- Stateless: must define both inbound and outbound rules explicitly.
- Support both allow and deny rules; evaluated in ascending rule-number order.
- Use NACLs for coarse-grained subnet-level blocks (e.g., deny a known malicious CIDR range).

**Default NACL rules (AWS default):** allow all inbound and outbound — tighten in regulated environments.

| Layer | Tool | Granularity |
|-------|------|-------------|
| Instance/ENI | Security Group | Per resource |
| Subnet boundary | NACL | Per subnet tier |

---

## Cross-Account and Multi-Region Networking

### VPC Peering vs AWS Transit Gateway

| Criterion | VPC Peering | AWS Transit Gateway |
|-----------|------------|---------------------|
| Topology | Point-to-point (1:1) | Hub-and-spoke (N:N) |
| Max VPCs | Scales poorly beyond 10 pairs | 5,000 attachments per TGW |
| Transitive routing | Not supported | Supported |
| Cross-region | Yes (inter-region peering) | Yes (TGW peering between regions) |
| Cost | $0.01/GB data transfer | $0.05/hr per attachment + $0.02/GB |
| Setup complexity | Low | Medium |

**Choose VPC Peering when:** fewer than five VPCs need to communicate, traffic volume is low, and transitive routing is not required.

**Choose AWS Transit Gateway when:** connecting more than five VPCs, requiring shared services VPCs (DNS, security inspection), or connecting VPCs to on-premises via a single AWS Direct Connect or VPN attachment.

### AWS PrivateLink for Service Exposure

AWS PrivateLink exposes a service running in one VPC to consumers in other VPCs or accounts without peering or internet exposure.

**Pattern:**
1. Producer VPC: place the service behind a Network Load Balancer.
2. Create a VPC Endpoint Service pointing at the NLB.
3. Consumer VPC: create an Interface Endpoint pointing at the Endpoint Service.

**Use PrivateLink when:** a SaaS provider or internal platform team needs to expose an API to many consumer accounts without granting broad network access. Supports cross-account and cross-region (via endpoint service in same region as NLB).
