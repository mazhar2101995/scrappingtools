# Mandatory Project Development & Quality Gate Protocol

These rules apply to the entire **AI Product Intelligence SaaS** project. They are mandatory and must be strictly followed during every development phase, feature implementation, bug fix, refactoring, and architectural change.

---

## 1. Phase-by-Phase Development
Development must follow the approved roadmap. Never start the next phase automatically.

For every phase:
1. Inspect existing implementation.
2. Understand dependencies and architecture.
3. Prepare an implementation plan.
4. Identify potential risks.
5. Implement only the approved scope.
6. Run automated tests.
7. Perform integration testing.
8. Perform security checks where relevant.
9. Review all changed files.
10. Prepare a completion report.

**After completing these steps, STOP and wait for explicit user approval.**

---

## 2. Mandatory Testing
Never claim a feature is complete just because code has been written.
Run relevant checks, including:
- TypeScript compilation (`tsc`).
- Unit and integration tests (`vitest`, `pytest`).
- Database migration tests.
- API tests.
- Docker service health checks.

**Use the actual local development environment. Do not fabricate test results. If a test cannot be executed, explicitly report why.**

---

## 3. Changed Files Audit
After every phase, provide a complete changed-file report explaining:
- File path.
- Created, modified, or deleted.
- Purpose of the change.
- Important implementation details.
- Related tests.

**Never silently delete or overwrite existing working functionality.**

---

## 4. Database Safety
Before changing the database:
- Inspect existing schema and migration files.
- Identify backward compatibility risks.
- Check foreign keys, unique constraints, and indexes.
- Verify rollback strategy.

**Never run destructive migrations without explicit approval. Never reset the database to make tests pass.**

---

## 5. Architectural Consistency
Maintain strict boundaries between:
- NestJS / Express backend (`apps/api`).
- Python scraping and AI services (`services/scraping-engine`, `services/ai-engine`).
- PostgreSQL 16 (`@saas/database`).
- Redis and BullMQ (`@saas/queue`).
- Next.js 14 frontend (`apps/dashboard`).
- Shared TypeScript packages (`@saas/shared-types`).

Avoid duplicated business logic, circular dependencies, and unnecessary microservices. Internal API contracts must remain documented and versioned.

---

## 6. Security Review
For each relevant phase, verify:
- Authentication & tenant isolation.
- Input validation & SQL injection prevention.
- SSRF prevention (validate URLs, block private/loopback IPs).
- Secret exposure checks.
- Rate limiting.

**Report confirmed vulnerabilities separately from theoretical risks. Never hide a security issue to make a phase appear complete.**

---

## 7. Regression Testing
Before declaring any phase complete:
- Run existing tests across all packages.
- Run new tests.
- Verify previously working functionality.
- Verify service-to-service integrations and database compatibility.

**A new feature must not silently break an existing feature.**

---

## 8. Completion Report Format
Every phase must conclude with:
- **A. Implementation summary**
- **B. Changed files audit**
- **C. Test execution report** (Exact commands, Passed/Failed/Skipped counts, terminal outputs)
- **D. Integration verification**
- **E. Security assessment**
- **F. Known issues & limitations**
- **G. Architecture impact**
- **H. Completion status**: Exactly one of:
  - `COMPLETE AND VERIFIED`
  - `IMPLEMENTED BUT NOT FULLY VERIFIED`
  - `BLOCKED`
  - `INCOMPLETE`

---

## 9. Quality Gate
A phase can be considered complete only when:
- Approved requirements are implemented.
- Required tests pass.
- No unresolved critical or high-severity defects remain.
- Existing functionality passes regression checks.
- Database migrations are verified.
- Documentation is updated.
- Changed files are audited.
- No undocumented architectural changes remain.

---

## 10. User Approval Required
After every phase:
1. Stop all further feature development.
2. Present the complete completion report.
3. Highlight outstanding issues.
4. Recommend the next phase.
5. **Wait for explicit user approval before proceeding. Do not interpret silence as approval.**

---

## 11. Core Engineering Principle
- **Correctness is more important than development speed.**
- **Architectural consistency is more important than writing more code.**
- **Verified functionality is more important than claiming completion.**
- **Preserving existing working functionality is mandatory.**

