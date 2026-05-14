# commit-and-open-pr

## Objective
Safely review changes, validate quality, and create a pull request only if everything passes.

---

## Steps

### 1. Review Changes
- Analyze all modified files in the current branch.
- Check for:
    - Code quality issues (readability, duplication, bad naming)
    - Potential bugs or edge cases
    - Missing error handling
    - Security concerns
    - Violations of project conventions
    - No `any` types (project uses `strict: true`)
    - No ESLint disable comments without a justification
    - No hardcoded secrets or API keys
    - No `console.*` calls — all logging must use NestJS `Logger`
    - Interfaces, enums, and type aliases are defined in a `types/` subdirectory, not inline in service or controller files

### 2. Report Issues (If Any)
- If any issues are found:
    - Clearly list them with file names and reasoning.
    - DO NOT modify code.
    - Ask the user how to proceed.

### 3. Confirm Clean State
- If no issues are found:
    - Summarize the changes in 2–5 bullet points.
    - Ask for confirmation before proceeding to tests.

### 4. Run Quality Checks
- Run the following commands in order from `apps/api/`:
    1. `npm run lint` — ESLint must pass with zero errors
    2. `npm run type-check` — TypeScript must compile with zero errors (or `npx tsc --noEmit`)
    3. `npm run test:unit` — Unit tests must pass

### 5. Handle Failures
- If any check fails:
    - Show the failing output.
    - DO NOT modify code.
    - Ask the user how to proceed.

### 6. Prepare Commit
- Generate a commit message using this format:
    - Type: feat | fix | refactor | chore | test | docs
    - Structure:
      ```
      <type>: <short summary>
      ```
- Show the commit message to the user and ask for approval.

### 7. Commit & Push
- After approval:
    - Stage relevant changes (specific files, never `git add .`)
    - Commit using the approved message
    - Push to the remote branch

### 8. Create Pull Request
- Open a PR from the current feature branch to `main` with:
    - Clear, concise title (same as commit summary)
    - Description including:
        - What changed
        - Why it was needed
        - Any risks or notes for reviewers
    - Use GitHub MCP server for creating the pull request

### 9. Final Output
- Provide:
    - PR link
    - Summary of actions taken

---

## General Rules
- NEVER modify code without explicit user approval.
- NEVER proceed past a step if it fails.
- ALWAYS show outputs (review, tests, commit message) before taking irreversible actions.
- NEVER push directly to `main` — always use a feature branch per `CLAUDE.md`.

## Security Rules
- NEVER read or access sensitive configuration files:
  - `.env`
  - `.env.local`
  - Any file matching `.env.*`

- If access is required:
  - STOP and ask the user explicitly
