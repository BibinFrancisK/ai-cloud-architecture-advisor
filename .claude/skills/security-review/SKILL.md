# Skill: Security Review

## Purpose

Perform a targeted security review of pending changes on the current branch against the threat model defined in `docs/EXECUTION_PLAN.md` §18 — Security Considerations. The execution plan file is gitignored, but tracked in worktree.

This skill is scoped to the **application layer**. It does not cover infrastructure security (that is handled during AWS deployment on Day 13).

---

## When to Invoke

- Before opening a PR that touches input handling, session management, LLM prompt construction, or guard logic
- When adding a new endpoint or changing an existing one
- When modifying `PromptBuilderService`, `ClarificationEngine`, or any service that processes user-supplied text
- When changing environment variable handling or secrets access

---

## What This Skill Checks

See `checklist.md` in this directory for the full itemised list. At a high level:

1. **Input validation** — user messages are length-capped, HTML-stripped, and validated before reaching the LLM
2. **Prompt injection** — user-supplied text is never interpolated directly into system prompts without sanitisation
3. **LLM output handling** — generated code (CDK) is treated as text only, never executed
4. **Session security** — session IDs are UUIDs (not guessable); no sensitive data is stored in session state beyond the conversation
5. **Secrets handling** — `GEMINI_API_KEY` and `DATABASE_URL` are read from env vars; never logged or returned in responses
6. **Guard integrity** — `RequirementsCompleteGuard` and `SessionExistsGuard` are not bypassed; state machine transitions are enforced
7. **Rate limiting** — session message limit (max 20) is enforced to prevent runaway LLM API usage
8. **API key exposure** — no secrets appear in source files, responses, or logs

---

## What This Skill Does NOT Cover

Per `docs/EXECUTION_PLAN.md` §18:

- **No authentication** — auth is explicitly out of scope
- **No HTTPS locally** — HTTP is acceptable for local dev; HTTPS is terminated at the ALB on AWS
- **No WAF** —  mention as future enhancement

---

## How to Run

1. Check out the branch under review
2. Run `git diff main...HEAD --name-only` to identify changed files
3. Work through `checklist.md` item by item against the diff
4. Report each finding with: file, line, risk level (LOW / MEDIUM / HIGH), and recommended fix
5. If all items pass, confirm clean and summarise

---

## Output Format

```
## Security Review — <branch-name>

### Findings
| # | File | Line | Risk | Issue | Recommendation |
|---|------|------|------|-------|----------------|
| 1 | ... | ... | HIGH | ... | ... |

### Passed Checks
- [x] Input length validation present
- [x] No secrets in source
- ...

### Verdict
PASS / FAIL — <one sentence summary>
```
