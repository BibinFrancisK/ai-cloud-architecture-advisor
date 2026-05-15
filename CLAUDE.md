# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This project is being built over 14 days per `EXECUTION_PLAN.md` (or `docs/EXECUTION_PLAN.md`). Code may be partially implemented — check what exists before generating new files.

## Commands

```bash
# Development
docker compose up -d          # Start PostgreSQL + pgvector
npm run start:dev             # NestJS with hot reload (run outside Docker)
npm run ingest                # One-time: chunk, embed, and store knowledge base into pgvector

# Quality
npm run lint                  # ESLint
npm run type-check            # tsc --noEmit
npm run test                  # All tests
npm run test:unit             # Unit tests only (no DB/LLM required)
npm run test:integration      # Integration tests (requires Docker DB running)
npm run test -- --testPathPattern=requirement.scorer  # Single test file

# Build & Deploy
npm run build                 # Compile to dist/
docker build -t advisor-api . # Build production image
cd infra && cdk deploy        # Deploy AWS infrastructure
```

API and Swagger UI are at `http://localhost:3000` and `http://localhost:3000/api/docs` respectively.

## Architecture

### Module Map (`apps/api/src/`)

| Module | Responsibility |
|--------|---------------|
| `session/` | In-memory session store (`Map<sessionId, SessionState>`); no database persistence |
| `chat/` | Entry point for user messages; routes to clarification or generation based on session status |
| `clarification/` | `ClarificationEngine` (selects next question) + `RequirementScorer` (0–100 score across 6 dimensions) |
| `architecture/` | `ArchitectureGeneratorService` (LLM call + Zod-parsed JSON) + `DiagramService` (Mermaid syntax) |
| `cdk/` | CDK TypeScript code generation; gated behind `status === 'ARCHITECTURE_APPROVED'` |
| `rag/` | `VectorStoreService` (pgvector CRUD) + `RAGRetrieverService` (query → top-5 chunks) + `KnowledgeIngesterService` |
| `llm/` | `LLMService` (Gemini client + retry) + `PromptBuilderService` (assembles system prompt + RAG context) |
| `common/` | Global exception filter, `SessionExistsGuard`, `RequirementsCompleteGuard`, `LoggingInterceptor` |

Static frontend is served by `ServeStaticModule` from `frontend/` at the repo root.

### Conversation State Machine

Session `status` follows a strict one-way flow:

```
CLARIFYING → READY_TO_GENERATE → ARCHITECTURE_GENERATED → ARCHITECTURE_APPROVED → CDK_GENERATED
```

`RequirementsCompleteGuard` enforces that `POST /sessions/:id/generate-cdk` is only reachable from `ARCHITECTURE_APPROVED`. `SessionExistsGuard` validates the session UUID on all `/:id` routes.

### RAG Flow

Ingestion (one-time, `npm run ingest`): Markdown files in `knowledge-base/` → `RecursiveCharacterTextSplitter` (1000 token chunks, 200 overlap) → Gemini `gemini-embedding-001` (3072-dim) → pgvector `knowledge_chunks` table.

Retrieval (per-request): user query + conversation context → embed → `SELECT ... ORDER BY embedding <=> $1 LIMIT 5` (cosine similarity) → top-5 chunks injected into prompt.

### LLM Output

All LLM responses that produce structured data use LangChain's `StructuredOutputParser` with a Zod schema. Never trust raw LLM string output for `ArchitectureRecommendation` — always parse and validate.

The `ArchitectureRecommendation` type is the central data contract between `ArchitectureGeneratorService`, `DiagramService`, and `CDKGeneratorService`.

## Key Constraints

- **Sessions are in-memory only** — `SessionService` uses a `Map`. Do not add a database-backed session store.
- **Gemini free tier** — `gemini-1.5-flash` for generation, `text-embedding-004` for embeddings. Respect rate limits; `LLMService` handles retries with exponential backoff.
- **Clarification gate** — CDK generation is always gated. Never bypass the `RequirementsCompleteGuard`.
- **TypeScript strict mode** — `tsconfig.json` has `"strict": true`. No `any` types.
- **Knowledge base is static** — Files in `knowledge-base/*.md` are authored Markdown, not scraped. Do not add web scraping.
- **Types in `common/types/`** — All interfaces, enums, and type aliases live in `apps/api/src/common/types/` (e.g. `common/types/rag.types.ts`). Do not define types inline inside service or controller files, and do not create module-local `types/` subdirectories.
- **Constants in `common/constants.ts`** — String literals for model names and other shared constants (e.g. `LLM_MODEL`, `EMBEDDING_MODEL`) are declared in `apps/api/src/common/constants.ts` and imported from there. Never hardcode model name strings in service files.
- **No `console` logging** — Never use `console.log()`, `console.error()`, or any other `console.*` method. Always use NestJS's built-in `Logger`: `private readonly logger = new Logger(ClassName.name);`.

## Environment Variables

See `.env.example`. Required at runtime:
- `GEMINI_API_KEY` — from Google AI Studio (free)
- `DATABASE_URL` — PostgreSQL connection string (pgvector)

## Git Workflow

Each day's work is developed on a dedicated feature branch and merged to `main` via a pull request.

```bash
# Start of each day — create the day's branch from main
git checkout main && git pull origin main
git checkout -b feat/<feature>      # see branch names below

# During the day — commit work to the feature branch
git add <files>
git commit -m "feat: ..."
git push origin feat/<feature>

# End of day — user will ask Claude to open a PR from feat/<feature> → main
```

**Branch names per day:**

| Day | Branch |
|-----|--------|
| 1  | `feat/project-scaffold` |
| 2  | `feat/nestjs-modules` |
| 3  | `feat/knowledge-base` |
| 4  | `feat/rag-ingestion` |
| 5  | `feat/llm-rag-chain` |
| 6  | `feat/session-clarification` |
| 7  | `feat/architecture-generation` |
| 8  | `feat/cdk-generation` |
| 9  | `feat/diagram-service` |
| 10 | `feat/chat-frontend` |
| 11 | `feat/guardrails` |
| 12 | `feat/tests` |
| 13 | `feat/aws-deploy` |
| 14 | `feat/docs-polish` |

**Never push directly to `main`.** All changes go through a PR.

## Response conventions

After completing any instruction or set of instructions, always end the response with a **Files changed** section listing every file created or edited as a clickable link.
