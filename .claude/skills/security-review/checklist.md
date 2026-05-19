# Security Review Checklist

Source of truth: `docs/EXECUTION_PLAN.md` §18 — Security Considerations. The execution plan file is gitignored, but tracked in worktree.

Use this checklist when reviewing any PR. Mark each item PASS / FAIL / N/A with a note if failed.

---

## 1. Input Validation

- [ ] User messages are capped at **2000 characters** (`@MaxLength(2000)` on the DTO)
- [ ] HTML tags and script content are stripped from user input before it reaches the LLM
- [ ] `ValidationPipe` is configured globally with `whitelist: true` — unknown properties are stripped
- [ ] No user-controlled string is used as a file path, database identifier, or shell argument

---

## 2. Prompt Injection

- [ ] User-supplied text is passed as a **user message**, never interpolated into the system prompt string
- [ ] `PromptBuilderService` separates `systemPrompt` and `userMessage` — they are never concatenated into a single string
- [ ] RAG-retrieved chunks are injected into the prompt as context, not as instructions
- [ ] No user input bypasses the clarification gate and reaches the architecture generator directly

---

## 3. LLM Output Handling

- [ ] CDK-generated code is returned as a **plain text string** — it is never executed, evaluated (`eval`), or written to disk by the server
- [ ] `ArchitectureRecommendation` JSON from the LLM is always parsed through the **Zod schema** (`StructuredOutputParser`) — raw LLM strings are never trusted
- [ ] LLM errors are caught and wrapped in a structured `BadRequestException` — raw LLM error messages are not forwarded to the client

---

## 4. Session Security

- [ ] Session IDs are **UUIDs** generated via `crypto.randomUUID()` — not sequential integers or guessable tokens
- [ ] No sensitive data (API keys, DB credentials, PII) is stored in `SessionState`
- [ ] Sessions are in-memory only — no session data is written to disk or logged in full
- [ ] Expired or unknown session IDs return `404` (enforced by `SessionExistsGuard`) — not a different error that leaks existence

---

## 5. Secrets and API Keys

- [ ] `GEMINI_API_KEY` is read from `process.env` — never hardcoded in any source file
- [ ] `DATABASE_URL` is read from `process.env` — never hardcoded
- [ ] No secret values appear in NestJS `Logger` output (log session IDs and scores, not credentials)
- [ ] `.env` is listed in `.gitignore` — only `.env.example` (with placeholder values) is committed
- [ ] No secret values appear in API responses or error messages

---

## 6. Guard Integrity

- [ ] `RequirementsCompleteGuard` is applied to `POST /sessions/:id/generate-cdk` — CDK generation cannot be reached with `status !== ARCHITECTURE_APPROVED`
- [ ] `SessionExistsGuard` is applied to all `/:id` routes — no route bypasses session validation
- [ ] Guards are listed in `providers` of their respective module — they are not instantiated ad-hoc
- [ ] No route uses `@SkipGuards` or equivalent without a documented reason

---

## 7. Rate Limiting and Abuse Prevention

- [ ] Maximum **20 messages per session** is enforced — prevents runaway LLM API cost
- [ ] Maximum **5 clarification rounds** is enforced — `clarificationRound` counter is checked before each LLM call
- [ ] Sessions are scoped per UUID — there is no shared global state between sessions that could be exhausted

---

## 8. Dependency and Infrastructure

- [ ] No new `npm` packages with known vulnerabilities have been added (`npm audit` clean)
- [ ] No `@ts-ignore` or `eslint-disable` comments bypass type safety on security-relevant code paths
- [ ] No use of `any` type on values that originate from user input or LLM output
- [ ] Knowledge base files in `knowledge-base/*.md` are static — no user-controlled file paths reach `fs.readFile` or equivalent

---

## Risk Level Definitions

| Level | Description |
|-------|-------------|
| HIGH | Could lead to data exposure, prompt injection, or API key leakage |
| MEDIUM | Could lead to unexpected behaviour, cost overrun, or session hijacking |
| LOW | Minor hygiene issue; no immediate exploitability |
