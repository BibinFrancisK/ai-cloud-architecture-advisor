# Testing Rules

- Source of truth: `docs/EXECUTION_PLAN.md` §20 — Testing Strategy.
- The execution plan file is gitignored, but tracked in worktree.

---

## Philosophy

Test the logic, not the boilerplate. With a 26-hour total budget, test only code that:
- Has complex conditional logic
- Could silently produce wrong output
- Is a pure function that is easy to unit test

Do NOT aim for 100% coverage — aim for coverage of the highest-value paths.

---

## Test Types and Commands

| Command | Scope | When to Run |
|---------|-------|-------------|
| `npm run test:unit` | `src/**` — no DB, no LLM | Always; runs in CI |
| `npm run test:integration` | Requires Docker DB running | Locally and in CI against `docker-compose.test.yml` |
| `npm run test -- --testPathPattern=<file>` | Single file | Debugging a specific spec |

---

## Coverage Targets by Module

| Module | Type | Target | Reason |
|--------|------|--------|--------|
| `RequirementScorer` | Unit | 90%+ | Pure function, highest business value |
| `ClarificationEngine` | Unit | 80%+ | State machine logic, easy to test |
| `DiagramService` | Unit | 70%+ | String manipulation, deterministic |
| `ArchitectureService` | Integration | 1 happy path | Verify LLM plumbing works |
| Controllers | Smoke | Health check only | NestJS wires these correctly |
| `LLMService` | Mock only | No real calls in CI | Do not burn Gemini quota in CI |

---

## What NOT to Test

- NestJS module wiring — it works by design
- Gemini API responses — not deterministic
- Frontend JavaScript — out of scope
- pgvector similarity results — database behaviour, not your code

---

## Unit Test Rules

- All unit tests must run without a database or LLM connection
- Mock `@langchain/google-genai` and pgvector at the module level via `jest.config.js` `moduleNameMapper`
- Never make real Gemini API calls in tests — use fixture responses
- Test files live alongside source: `src/clarification/requirement.scorer.spec.ts`

```js
// jest.config.js — mock external dependencies in unit tests
moduleNameMapper: {
  '@langchain/google-genai': '<rootDir>/src/__mocks__/gemini.mock.ts',
}
```

---

## Integration Test Rules

- Use `docker-compose.test.yml` to spin up a real PostgreSQL + pgvector instance
- Use an in-memory mock LLM that returns fixture `ArchitectureRecommendation` JSON
- Must test the full conversation flow: initial message → clarification rounds → architecture generation → CDK generation
- Always pass `--forceExit` to prevent Jest from hanging on open DB connections

```ts
// conversation-flow.spec.ts pattern
// 1. Create session
// 2. POST /chat N times with fixture responses until READY_TO_GENERATE
// 3. GET /architecture → verify structure
// 4. POST /architecture/approve
// 5. POST /generate-cdk → verify stackName, code, dependencies
```

---

## Test Naming Convention

- Spec files: `<subject>.spec.ts`
- Describe blocks: class or function under test
- It blocks: plain English describing the behaviour, not the implementation

```ts
describe('RequirementScorer', () => {
  it('returns 0 when no requirements are provided', () => { ... });
  it('scores scale dimension as 2 when RPS is specified', () => { ... });
});
```
