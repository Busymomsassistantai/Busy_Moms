# Bolt Prompt — [Concise Title]

_Copy this entire prompt into Bolt._

Goal:

[What should be achieved in one or two bullets.]

Context (optional):

[Key environment details, URLs, feature flags, or constraints.]

Tasks:

[Ordered list of concrete edits/additions. Include exact file paths and BEGIN/END FILE or PATCH blocks.]

Constraints:

[Non-negotiables: no secrets, keep types strict, no new deps, etc.]

Output:

[What Bolt should show after running (diff summary, file tree, test results, etc.).]

## Example
**Title:** Bolt Prompt — Add a health check route  
**Goal:** Expose `GET /healthz` returning `{ ok: true }`  
**Tasks:** Create `src/routes/healthz.ts`, wire in router, add test.  
**Constraints:** No new deps; TypeScript strict.  
**Output:** Show diff summary + curl example.