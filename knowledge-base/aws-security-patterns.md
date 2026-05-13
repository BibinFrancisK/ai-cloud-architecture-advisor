# AWS Security Patterns

## IAM: Identity and Access Management

AWS Identity and Access Management (IAM) controls who can call which AWS API actions on which resources.

### Roles vs Long-Lived Access Keys

Never embed long-lived IAM access keys in EC2 instances, Lambda functions, or ECS tasks. Always attach an IAM role; the SDK fetches short-lived credentials automatically via the instance metadata service (IMDS) or the container credential provider.

| Credential type | Lifetime | Rotation | Use case |
|----------------|----------|----------|----------|
| IAM role (instance/task) | 1–12 hours, auto-refreshed | Automatic | EC2, Lambda, ECS, EKS pods |
| IAM user access key | Permanent until deleted | Manual | CI/CD pipelines with no OIDC support |
| OIDC federated token | ≤1 hour | Automatic | GitHub Actions, GitLab CI |

Rotate any remaining long-lived access key every 90 days; disable unused keys after 45 days of inactivity.

### Least-Privilege Principle

- Start with `Deny *`, add only the specific `Action` and `Resource` ARNs required.
- Use `Condition` keys to narrow scope: `aws:SourceIp` restricts to corporate CIDR ranges; `aws:RequestedRegion` blocks API calls outside approved regions (e.g., allow only `eu-west-1` and `eu-central-1` for GDPR workloads).
- Apply **permission boundaries** on developer roles to cap the maximum permissions any role they create can have, preventing privilege escalation.

### Cross-Account Roles and Trust Policies

For cross-account access, create a role in the target account with a trust policy allowing the source account's principal. Always include `sts:ExternalId` in trust policies for third-party vendor access to prevent the confused deputy problem.

```json
"Condition": { "StringEquals": { "sts:ExternalId": "unique-vendor-id" } }
```

---

## Amazon Cognito: User Authentication

Amazon Cognito provides managed user authentication and authorization.

### User Pools vs Identity Pools

| Feature | User Pool | Identity Pool |
|---------|-----------|---------------|
| Primary purpose | User directory + JWT issuance | Exchange token for AWS credentials |
| Output | ID token, access token, refresh token | Temporary IAM credentials (STS) |
| Use when | Authenticating users to your API | Granting users direct AWS resource access (S3, DynamoDB) |
| Federation | Google, Facebook, SAML, OIDC IdPs | User Pool, Social, SAML, custom |

Most web/mobile applications use **both**: User Pool authenticates the user and issues JWTs; Identity Pool exchanges the JWT for scoped AWS credentials when the app needs to call AWS services directly.

### JWT Token Types

- **ID token**: contains user claims (email, groups); present to your backend to identify the user.
- **Access token**: used to call Cognito APIs (e.g., `GetUser`); do not use for custom API authorization.
- **Refresh token**: long-lived (default 30 days); exchange for new ID/access tokens without re-login.

Validate ID token signature (RS256), `iss`, `aud`, and `exp` on every API call. Never trust unvalidated JWTs.

### Hosted UI vs Custom UI

Use the **Hosted UI** for fastest delivery; it handles MFA, password reset, and federation flows out of the box. Use a **custom UI** (Amplify or direct API calls) only when brand requirements prohibit the hosted domain or you need pixel-level control.

---

## AWS KMS: Encryption Key Management

AWS Key Management Service (KMS) manages cryptographic keys for data encryption.

### Key Types

| Key type | Cost | Control | Use case |
|----------|------|---------|----------|
| AWS-managed key | Free | AWS rotates; limited policy control | Default encryption for S3, EBS, RDS when no CMK required |
| Customer-managed key (CMK) | $1/month + $0.03/10K API calls | Full key policy control | Regulated data, cross-account access, fine-grained audit |

### When CMKs Are Required

Use a CMK when you need to: restrict which principals can decrypt data, enable cross-account decryption, implement key deletion/disabling as a data destruction mechanism, or satisfy PCI-DSS / HIPAA audit requirements for key ownership.

### Envelope Encryption Pattern

KMS never encrypts bulk data directly. The pattern:
1. Call `GenerateDataKey` → KMS returns a plaintext data key + an encrypted copy of the data key.
2. Encrypt data locally with the plaintext data key (AES-256-GCM).
3. Store the encrypted data key alongside the ciphertext; discard the plaintext key.
4. To decrypt: call `Decrypt` on the encrypted data key → use returned plaintext key to decrypt data.

### Key Rotation

Enable automatic annual rotation on all CMKs. KMS retains old key material to decrypt existing ciphertext. New data uses the new key material transparently.

---

## AWS WAF: Web Application Firewall

AWS Web Application Firewall (WAF) inspects HTTP/S traffic and blocks malicious requests.

### Managed Rule Groups

| Rule group | Protects against |
|-----------|-----------------|
| `AWSManagedRulesCommonRuleSet` | OWASP Top 10 (general) |
| `AWSManagedRulesSQLiRuleSet` | SQL injection |
| `AWSManagedRulesKnownBadInputsRuleSet` | Log4Shell, Spring4Shell, XSS |
| `AWSManagedRulesAmazonIpReputationList` | Known malicious IPs |
| `AWSManagedRulesBotControlRuleSet` | Automated bots (paid) |

### Rate-Based Rules

Add a rate-based rule with a threshold of 1,000–2,000 requests per 5-minute window per IP for public APIs. Set the action to `BLOCK` for DDoS mitigation. Use `COUNT` mode first for 24–48 hours to baseline legitimate traffic before switching to `BLOCK`.

### Attachment Points

| Resource | How to attach |
|----------|--------------|
| Application Load Balancer | Regional WAF Web ACL |
| Amazon API Gateway (REST) | Regional WAF Web ACL |
| Amazon CloudFront | Global (us-east-1) WAF Web ACL |

A single Web ACL cannot mix regional and CloudFront resources.

---

## Secrets Manager vs Parameter Store

| Capability | AWS Secrets Manager | SSM Parameter Store (Standard) | SSM Parameter Store (Advanced) |
|-----------|--------------------|---------------------------------|---------------------------------|
| Cost | $0.40/secret/month + $0.05/10K API calls | Free | $0.05/parameter/month |
| Automatic rotation | Yes (built-in Lambda for RDS, Redshift, DocumentDB) | No | No |
| Cross-account access | Yes (resource policy) | No | No |
| Versioning | Yes (AWSCURRENT / AWSPREVIOUS) | Yes (up to 100 versions) | Yes |
| Max value size | 64 KB | 4 KB | 8 KB |
| Best for | Database credentials, API keys requiring rotation | App config, feature flags, non-sensitive params | Large config blobs |

**Decision rule**: Use Secrets Manager for any credential that must rotate automatically (database passwords, OAuth client secrets). Use Parameter Store for non-secret configuration values and feature flags where cost matters.

---

## VPC Security Layering

Amazon Virtual Private Cloud (VPC) security uses multiple overlapping controls.

### Recommended Subnet Layout

| Tier | Subnet type | Examples |
|------|------------|---------|
| Public | Public (IGW route) | ALB, NAT Gateway, bastion (if any) |
| Application | Private | ECS tasks, Lambda in VPC, EC2 app servers |
| Data | Private (isolated) | RDS, ElastiCache, OpenSearch |

Never place compute or database instances in public subnets.

### Security Groups vs NACLs

| Property | Security Group | NACL |
|----------|---------------|------|
| Statefulness | Stateful (return traffic auto-allowed) | Stateless (must allow inbound AND outbound explicitly) |
| Scope | Instance/ENI level | Subnet level |
| Rule type | Allow only | Allow and Deny |
| Rule evaluation | All rules evaluated | Rules evaluated in order (lowest number first) |

**Default posture**: Security groups — deny all inbound, allow all outbound; open inbound only on required ports from specific source security group IDs (not CIDRs where possible). NACLs — keep at default (allow all) unless you need subnet-level explicit Deny (e.g., block a known-bad CIDR permanently).

---

## Compliance Overviews

### GDPR: Data Residency for EU Users

Store and process EU personal data exclusively in EU AWS regions:

| Region | Code | Country |
|--------|------|---------|
| EU (Ireland) | eu-west-1 | Ireland |
| EU (Frankfurt) | eu-central-1 | Germany |
| EU (Paris) | eu-west-3 | France |
| EU (Stockholm) | eu-north-1 | Sweden |

Disable S3 replication and RDS read replicas that would cross outside the EU. Enable AWS CloudTrail and Amazon Macie for data-access audit logs required under GDPR Article 30.

### PCI-DSS Key Controls

- Encrypt cardholder data at rest (KMS CMK) and in transit (TLS 1.2+).
- Isolate cardholder data environment (CDE) in a dedicated VPC with no direct internet ingress.
- Enable CloudTrail, VPC Flow Logs, and AWS Config for a 12-month audit log.
- Restrict CDE access to named IAM roles; enforce MFA via `aws:MultiFactorAuthPresent` condition.
- Run quarterly vulnerability scans; use Amazon Inspector for continuous EC2/ECR scanning.

### HIPAA Eligibility

AWS signs a Business Associate Agreement (BAA) required under HIPAA. Only services covered by the BAA may store or process Protected Health Information (PHI). Key HIPAA-eligible services include: EC2, ECS, RDS, S3, Lambda, CloudWatch Logs, KMS, Secrets Manager, and API Gateway.

Enable encryption at rest (KMS) and in transit (TLS) for all PHI stores. Enable CloudTrail with log file validation and store logs in a separate, restricted S3 bucket with Object Lock (WORM) for the required 6-year retention period.
