# Pending Fixes

Two issues to resolve before the deployment is production-ready.

---

## Fix 1 — Ingestion API Endpoint

### Problem

`KnowledgeIngesterService.ingestAll()` is only callable via a standalone script (`npm run ingest`). In an ECS Fargate environment there is no persistent host to SSH into; re-ingesting the knowledge base requires an `aws ecs execute-command` session, which is fragile and manual. There must be an HTTP endpoint to trigger and monitor ingestion.

### Timing concern

`ingestAll()` takes ~80 s (800 ms × ~100 chunks). An ALB has a 60 s idle timeout by default. The endpoint must return immediately and run ingestion in the background, or the request will time out and ECS will log a 504.

### Solution

Add `POST /admin/ingest` (fire-and-forget, `202 Accepted`) and `GET /admin/ingest/status` (chunk count from DB) to a new `RagController` inside the existing `RagModule`. Both are admin-scoped routes analogous to `/health` — they are not session-scoped.

#### 1.1 New file — `apps/api/src/rag/rag.controller.ts`

```typescript
import {
  Controller, Get, HttpCode, Logger, Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { KnowledgeIngesterService } from './knowledge-ingester.service';
import { VectorStoreService } from './vector-store.service';

@ApiTags('admin')
@Controller('admin')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(
    private readonly ingester: KnowledgeIngesterService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  @Post('ingest')
  @HttpCode(202)
  @ApiOperation({ summary: 'Trigger knowledge-base ingestion', description: 'Starts ingestion in the background. Returns 202 immediately.' })
  @ApiResponse({ status: 202, description: 'Ingestion started' })
  triggerIngest(): { message: string } {
    this.ingester.ingestAll().catch((err: unknown) =>
      this.logger.error('Ingestion failed', err),
    );
    return { message: 'Ingestion started — check GET /admin/ingest/status for progress' };
  }

  @Get('ingest/status')
  @ApiOperation({ summary: 'Check ingestion status', description: 'Returns current chunk count from the vector store.' })
  @ApiResponse({ status: 200, description: 'Current chunk count' })
  async getStatus(): Promise<{ chunks: number }> {
    const chunks = await this.vectorStore.getChunkCount();
    return { chunks };
  }
}
```

#### 1.2 Modified — `apps/api/src/rag/rag.module.ts`

Add `RagController` to `controllers`:

```typescript
import { RagController } from './rag.controller';

@Module({
  controllers: [RagController],
  providers: [VectorStoreService, KnowledgeIngesterService, RAGRetrieverService],
  exports: [VectorStoreService, KnowledgeIngesterService, RAGRetrieverService],
})
export class RagModule {}
```

#### 1.3 Schema initialisation on startup

Currently `scripts/init.sql` must be applied manually. Move it into `VectorStoreService.onModuleInit()` so the schema is applied automatically on every container start (both local dev and ECS). All statements use `CREATE TABLE IF NOT EXISTS` / `CREATE EXTENSION IF NOT EXISTS`, so this is fully idempotent.

**Modified — `apps/api/src/rag/vector-store.service.ts`** — add to `onModuleInit()` after the Pool is created:

```typescript
import * as fs from 'fs';
import * as path from 'path';

async onModuleInit(): Promise<void> {
  // ... existing pool setup ...
  await this.applySchema();
}

private async applySchema(): Promise<void> {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../../../../scripts/init.sql'),
    'utf-8',
  );
  await this.pool.query(sql);
  this.logger.log('Schema applied');
}
```

> **Note on path**: In the Docker image, `dist/rag/vector-store.service.js` is at `/app/apps/api/dist/rag/`. `../../../../scripts/init.sql` resolves to `/app/scripts/init.sql`. Add a `COPY scripts/ /app/scripts/` line to the `Dockerfile` runner stage so the file is present at runtime.

---

## Fix 2 — ECR URI from CDK Output (remove `ECR_REGISTRY` secret)

### Problem

`secrets.ECR_REGISTRY` is a GitHub secret set manually. It:
1. Has to be set by a human after first deploy — CI breaks on first run
2. Becomes stale if the stack is destroyed and redeployed (CDK generates a new ECR URI)
3. Creates a chicken-and-egg problem: the `build` job tries to push to ECR before `deploy` has ensured the ECR repo exists

### Root cause

The CI runs jobs in this order: `quality → build (push to ECR) → deploy (cdk deploy)`. ECR must exist before the push, but CDK creates it. On first deployment the repo does not exist.

### Solution

Reorder: **CDK runs first**, then query the ECR URI from the stack output, then push the image. The `ECR_REGISTRY` secret is deleted entirely.

#### Revised job order and structure

```
quality  →  build (Docker build only, no push)  →  deploy
```

`deploy` job does everything in order:
1. CDK deploy (idempotent — creates ECR on first run, no-ops if unchanged)
2. Query `EcrRepositoryUri` from the CloudFormation stack output
3. Docker login to ECR using the registry host extracted from the URI
4. Docker build + tag + push using the queried URI
5. `aws ecs update-service --force-new-deployment`
6. `aws ecs wait services-stable`

#### Why rebuild Docker in `deploy`?

The `build` job runs on a separate runner; its layer cache is not available to `deploy`. Building twice is the tradeoff for keeping the jobs separate. For a portfolio project this is acceptable (~2 min extra). A future optimisation is to upload the image as a GitHub Actions artifact in `build` and load it in `deploy`.

#### 2.1 Modified — `.github/workflows/ci.yml`

Remove `ECR_REGISTRY` from the required secrets comment block.

`build` job — remove all ECR steps, keep Docker build as a validation only:

```yaml
build:
  runs-on: ubuntu-latest
  needs: quality
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - name: Build Docker image (validation)
      run: docker build -t advisor-api:${{ github.sha }} .
```

`deploy` job — CDK first, then derive ECR URI, then push:

```yaml
deploy:
  runs-on: ubuntu-latest
  needs: build
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"
        cache-dependency-path: infra/package-lock.json

    - name: Install infra dependencies
      run: npm ci
      working-directory: infra

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ vars.AWS_REGION }}

    - name: CDK deploy
      run: npx cdk deploy --context env=${{ vars.DEPLOY_ENV || 'dev' }} --require-approval never
      working-directory: infra

    - name: Get ECR URI from stack output
      id: ecr
      run: |
        ECR_REPO_URI=$(aws cloudformation describe-stacks \
          --stack-name AdvisorStack \
          --region ${{ vars.AWS_REGION }} \
          --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue | [0]" \
          --output text)
        echo "uri=$ECR_REPO_URI" >> $GITHUB_OUTPUT

    - name: Login to ECR
      run: |
        ECR_REGISTRY=$(echo "${{ steps.ecr.outputs.uri }}" | cut -d'/' -f1)
        aws ecr get-login-password --region ${{ vars.AWS_REGION }} | \
          docker login --username AWS --password-stdin "$ECR_REGISTRY"

    - name: Build and push image to ECR
      run: |
        docker build -t "${{ steps.ecr.outputs.uri }}:latest" .
        docker push "${{ steps.ecr.outputs.uri }}:latest"

    - name: Force ECS redeployment
      run: |
        aws ecs update-service \
          --cluster advisor-cluster \
          --service advisor-service \
          --force-new-deployment \
          --region ${{ vars.AWS_REGION }}

    - name: Wait for ECS service to stabilise
      run: |
        aws ecs wait services-stable \
          --cluster advisor-cluster \
          --services advisor-service \
          --region ${{ vars.AWS_REGION }}
```

---

## Files Changed

| File | Action |
|------|--------|
| `apps/api/src/rag/rag.controller.ts` | **Create** — `POST /admin/ingest` + `GET /admin/ingest/status` |
| `apps/api/src/rag/rag.module.ts` | Add `RagController` to `controllers` |
| `apps/api/src/rag/vector-store.service.ts` | Apply `init.sql` schema in `onModuleInit` |
| `Dockerfile` | Add `COPY scripts/ /app/scripts/` to runner stage |
| `.github/workflows/ci.yml` | Remove `ECR_REGISTRY` from secrets comment; simplify `build` job; rewrite `deploy` job |

**GitHub secret to delete after this fix lands:** `ECR_REGISTRY`

---

## Definition of Done

| Item | Check |
|------|-------|
| `POST /admin/ingest` returns `202` immediately | |
| Ingestion runs and logs complete in CloudWatch | |
| `GET /admin/ingest/status` returns `{ "chunks": N }` where N > 0 | |
| Schema applied automatically on container start (no manual `init.sql` step) | |
| CI pipeline passes on merge to `main` with no `ECR_REGISTRY` secret set | |
| First deploy from a clean AWS account works end-to-end without manual steps | |
