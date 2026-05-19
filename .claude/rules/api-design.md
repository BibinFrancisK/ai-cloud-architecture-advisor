# API Design Rules

- Source of truth: `docs/EXECUTION_PLAN.md` §13 — API Design.
- This execution plan file is gitignored, but tracked in worktree.

---

## Base URLs

- Local: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- Production: deployed URL (set in GitHub repo description)


---

## Endpoint Reference

### Sessions

```
POST /sessions
Request:  {}
Response: { sessionId, status: "CLARIFYING", createdAt }
```

### Chat

```
POST /sessions/:id/chat
Request:  { message: string }   // max 2000 chars
Response: {
  sessionId,
  message,            // AI response text
  status,             // current SessionStatus
  completenessScore,  // 0–100
  clarificationRound,
  nextAction          // "CONTINUE_CLARIFICATION" | "GENERATE_ARCHITECTURE" | "GENERATE_CDK"
}
```

### Architecture

```
GET  /sessions/:id/architecture
Response: ArchitectureRecommendation (see common/types/architecture.types.ts)

POST /sessions/:id/architecture/approve
Request:  { approved: boolean, feedback?: string }
Response: { sessionId, status }
```

### CDK Generation

```
POST /sessions/:id/generate-cdk
Request:  { mode?: "complete" | "skeleton", environment?: "dev" | "staging" | "prod" }
Response: { stackName, code, dependencies, mode, environment }
```
- Returns `403` if `status !== ARCHITECTURE_APPROVED`
- `mode` resolves as: `dto.mode → CDK_GENERATION_MODE env var → "complete"`
- `environment` resolves as: `dto.environment → "dev"`

### Diagram

```
GET /sessions/:id/diagram
Response: { mermaidSyntax, renderUrl }
```
- Returns `400` if architecture has not been generated yet

### Health

```
GET /health
Response: { status: "ok", vectorStore: "connected", llm: "available", timestamp }
```

---

## Session State Machine

All status transitions are one-way and strictly ordered:

```
CLARIFYING → READY_TO_GENERATE → ARCHITECTURE_GENERATED → ARCHITECTURE_APPROVED → CDK_GENERATED
```

- `RequirementsCompleteGuard` enforces `POST /sessions/:id/generate-cdk` requires `ARCHITECTURE_APPROVED`
- `SessionExistsGuard` validates the session UUID on all `/:id` routes — returns `404` if not found
- Never bypass guards. Never add a route that skips the state machine.

---

## HTTP Status Code Conventions

| Code | When to Use |
|------|-------------|
| `200` | Successful GET or POST (use `@HttpCode(200)` on POSTs that return data) |
| `201` | Resource created (default for POST — only `POST /sessions` uses this) |
| `400` | Bad request: invalid input, wrong session state |
| `403` | Forbidden: guard blocked access (requirements not complete) |
| `404` | Session not found |
| `500` | Unhandled server error (global exception filter catches these) |

---

## Swagger Rules

- Every controller must have `@ApiTags('...')`
- Every endpoint must have `@ApiOperation({ summary, description })`
- Every `:id` param must have `@ApiParam({ name: 'id', description: 'Session UUID' })`
- Every response variant must have `@ApiResponse({ status, description })`
- Request body DTOs must use `@ApiProperty` on each field with `required`, `enum`, and `description` where relevant

---

## DTO and Validation Rules

- All request bodies use `class-validator` decorators (`@IsString`, `@IsOptional`, `@IsIn`, etc.)
- `ValidationPipe` is configured globally with `whitelist: true, transform: true`
- Max message length: 2000 characters (`@MaxLength(2000)`)
- DTOs live in a `dto/` subdirectory within the module
- Never define inline types in controllers or services — use `common/types/` for shared types

---

## Controller Structure Rules

- Keep controllers thin: delegate all business logic to services
- One controller per module
- Route prefix is always `sessions` — all endpoints are scoped to a session
- Use `@Param('id')` named `sessionId` consistently
