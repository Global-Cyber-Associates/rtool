Confirmed architecture and choices
- Agent-User and Admin-Agent: Python clients.
- Backend: Node.js (Express or similar) + Mongoose.
- Frontend: Node.js web app.
- Data store: MongoDB (single cluster).
- Request/tenant resolution flow: subdomain-first (tenant.example.com), with fallback to tenant_id in JWT and then X-Tenant-ID header.
- Existing data mapping: use email-domain → tenant mapping rules (you’ll provide mapping rules or a mapping file/CSV).
- Tenancy model to implement: shared schema (every document has tenant_id).

I will not create anything in GitHub until you confirm which repository to file the issues against (organization projects require issues to be associated with a repo or be project-only items depending on your project settings). Please tell me the repository (owner/name) where you want these requirement entities created, or confirm you want them created as project-only items in the org project (if that’s supported by your project settings). Once you confirm the target, I will create the issues in the project for you.

Below are the detailed Rally-like project entities (Epics → Features → User Stories → Tasks with acceptance criteria). You can copy these into your project as-is or I’ll create them as GitHub issues once you give the target repo.

EPIC 1 — Tenant Core & Metadata
- Feature 1.1 — Tenants collection & management
  - Story 1.1.1: Create tenants collection and Tenant model
    - Tasks:
      1. Design tenant schema: { _id:ObjectId, name:string, slug:string, subdomain:string, email_domains:[string], config:object, status:enum, created_at, updated_at }.
      2. Implement Mongoose model backend/src/models/tenant.js.
      3. Implement seed script backend/scripts/seed_default_tenant.js that creates a default tenant and imports mapping rules (email domains).
      4. Add basic validation (unique slug, unique subdomain).
    - Acceptance criteria:
      - A tenant document can be created/read via API or seed script.
      - Seed script creates default tenant and stores mapping rules; returns tenant_id.
  - Story 1.1.2: Tenant management API (global admin)
    - Tasks:
      1. Implement GET /api/tenants and POST /api/tenants (protected by global_admin role).
      2. Implement minimal input validation and return tenant metadata to UI.
    - Acceptance criteria:
      - global_admin can list and create tenants through API; created tenants appear in DB.

EPIC 2 — Tenant Resolution & Auth
- Feature 2.1 — Tenant resolution middleware (subdomain-first)
  - Story 2.1.1: Implement tenantResolver middleware (subdomain → JWT → header)
    - Tasks:
      1. Implement middleware backend/src/middleware/tenantResolver.js:
         - Parse Host header to extract subdomain; match subdomain -> tenant (fast cache).
         - If no subdomain match, parse JWT (if present) for tenant_id claim and resolve tenant.
         - If still unresolved, check X-Tenant-ID header.
         - On resolve: attach req.tenant = { id, slug, subdomain, config } to request and log context.
         - On failure: if endpoint requires tenant return 400/401; for public endpoints allow null tenant (configurable).
      2. Add tenant cache (in-memory with TTL; cache tenant metadata from tenants collection).
      3. Add tests for subdomain resolution, JWT mismatch, and fallback header behavior.
    - Acceptance criteria:
      - Requests to tenant.example.com set req.tenant to the correct tenant object.
      - If subdomain is missing, requests with JWT tenant_id set req.tenant.
      - If tenant resolution fails for a protected route, request returns 400/401.
- Feature 2.2 — Tenant-aware authentication & roles
  - Story 2.2.1: Extend JWT issuance to include tenant_id and roles
    - Tasks:
      1. Update auth service to include tenant_id claim and role(s) in issued JWTs.
      2. Update token verification middleware to validate token.tenant_id against req.tenant.id when req.tenant exists.
    - Acceptance criteria:
      - Tokens include tenant_id; server rejects requests where token.tenant_id != req.tenant.id.
  - Story 2.2.2: Add tenant-scoped roles
    - Tasks:
      1. Define roles: tenant_user, tenant_admin, global_admin. Update user model to store per-tenant role assignments.
      2. Implement role-check middleware that enforces roles within tenant context.
    - Acceptance criteria:
      - tenant_admin can perform tenant-scoped admin APIs for their tenant, not others.
      - global_admin can manage tenants and has broader privileges.

EPIC 3 — Data Model Changes (Shared Schema)
- Feature 3.1 — Add tenant_id to business collections & enforce scoping
  - Story 3.1.1: Inventory and annotate core collections
    - Tasks:
      1. Identify all collections used by backend and agents: users, agents, configs, sessions, heartbeats, logs, commands, visualizer etc.
      2. Produce a migration plan listing which collections need tenant_id and suggested indexes.
    - Acceptance criteria:
      - Inventory list exists with mapping of collection → required tenant index.
  - Story 3.1.2: Update models to include tenant_id and indexes
    - Tasks:
      1. Add tenant_id:ObjectId (or stable string) to Mongoose schemas for each core model.
      2. Add compound indexes such as { tenant_id:1, email:1 } unique, { tenant_id:1, agent_id:1 }.
    - Acceptance criteria:
      - New documents saved by APIs contain tenant_id.
      - Indexes created and used by example queries (explain shows indexed path).
  - Story 3.1.3: Implement automatic tenant scoping at DB layer
    - Tasks:
      1. Implement a Mongoose plugin backend/src/db/tenantScopePlugin.js that injects tenant filter on find/findOne/update/delete using context (e.g., req.tenant or a scoped repo).
      2. Add guard that blocks update/delete operations that would run globally without tenant filter (throw error).
      3. Add a debug mode to log unscoped queries encountered.
    - Acceptance criteria:
      - Repository-level queries automatically include tenant filter when tenant context provided.
      - A write/delete attempted without tenant filter raises an error.

EPIC 4 — Agent Registration & Client Changes
- Feature 4.1 — Tenant-scoped agent registration and heartbeats
  - Story 4.1.1: Agents must present tenant credential during registration
    - Tasks:
      1. Update POST /api/agents/register to require either:
         - registration JWT containing tenant_id signed by backend, or
         - X-Tenant-ID + agent secret discovered beforehand.
      2. Update Python agent templates to include tenant_id/token in configuration and send it during register.
      3. Validate that agent token’s tenant_id matches the resolved tenant.
    - Acceptance criteria:
      - Agent registration fails with 403 when tenant token is invalid or absent.
      - System records agent documents with tenant_id.
  - Story 4.1.2: Heartbeat & channel messages include tenant_id
    - Tasks:
      1. Modify heartbeat payload and websocket/command channels to carry tenant context.
      2. Backend validates tenant on heartbeat and stores agent as online for that tenant.
    - Acceptance criteria:
      - Heartbeat without tenant token is rejected.
      - Agent is shown online in the correct tenant dashboard.

EPIC 5 — Frontend Tenant Awareness & UI
- Feature 5.1 — Tenant-aware frontend flows
  - Story 5.1.1: Frontend stores tenant context and attaches header on API calls
    - Tasks:
      1. On login, backend returns tenant metadata; store in secure client state.
      2. Axios/fetch middleware attaches X-Tenant-ID or the JWT on all calls.
    - Acceptance criteria:
      - Frontend includes tenant header/JWT and receives only tenant-scoped data.
  - Story 5.1.2: Tenant admin UI and branding
    - Tasks:
      1. Add tenant selector for global admin and per-tenant admin pages for tenant_admin role.
      2. Load tenant config (branding) and apply to UI.
    - Acceptance criteria:
      - tenant_admin can manage users/agents only for their tenant; UI shows tenant branding.

EPIC 6 — Migration & Backfill (email-domain mapping)
- Feature 6.1 — Mapping rules & backfill
  - Story 6.1.1: Implement mapping rules loader (email domain → tenant)
    - Tasks:
      1. Create mapping file format (CSV/JSON): domain -> tenant_slug.
      2. Implement loader script backend/scripts/load_mapping.js to import mapping into tenants.email_domains or a separate collection tenant_mappings.
      3. Add admin UI/API to view/edit mapping rules.
    - Acceptance criteria:
      - Mapping file can be uploaded and mapping entries are stored and queryable.
  - Story 6.1.2: Backfill script with dry-run and apply modes
    - Tasks:
      1. Implement backend/scripts/backfill_tenant.js:
         - Dry-run: scan target collections matching email_domain→tenant and report counts.
         - Apply: update in batches, set tenant_id on documents matching mapping rules.
         - Support batching, progress reporting, and safe error handling.
      2. Implement backup/export instructions before running apply.
    - Acceptance criteria:
      - Dry-run reports counts per tenant and collection.
      - Apply updates documents in batches; post-run verification shows no documents left unassigned in core collections (or flagged).
  - Story 6.1.3: Post-backfill validation and schema-lock
    - Tasks:
      1. Run integrity checks to detect cross-tenant references (e.g., agent linked to user from another tenant).
      2. Add schema validation to make tenant_id required after backfill.
    - Acceptance criteria:
      - Validation reports zero cross-tenant mismatches.
      - Attempt to insert document without tenant_id fails.

EPIC 7 — Security, Monitoring, Ops
- Feature 7.1 — Security & compliance
  - Story 7.1.1: Audit logs and encryption
    - Tasks:
      1. Ensure every audit log entry includes tenant_id and actor_id.
      2. Review storage of sensitive tenant data; apply encryption at rest or tenant-specific keys if required.
    - Acceptance criteria:
      - Audit logs in app/db include tenant_id.
      - Sensitive fields flagged and encrypted per policy.
- Feature 7.2 — Monitoring & per-tenant metrics
  - Story 7.2.1: Per-tenant metrics and rate limiting
    - Tasks:
      1. Implement metrics collection tagged by tenant_id (requests, errors, agent count).
      2. Implement per-tenant rate limits and quotas.
    - Acceptance criteria:
      - Dashboards show tenant-level metrics.
      - Rate limit triggers per tenant and logged.

EPIC 8 — Rollout Plan & Phased Deployment
- Feature 8.1 — Phased rollout
  - Story 8.1.1: Phase 0 — Passive deployment & logging
    - Tasks:
      1. Deploy tenantResolver middleware in logging-only mode (do not enforce DB scoping).
      2. Collect logs for unscoped queries.
    - Acceptance criteria:
      - Logs show which APIs/queries are not yet tenant-scoped and their frequency.
  - Story 8.1.2: Phase 1 — Add tenant_id fields and plugin (non-blocking)
    - Tasks:
      1. Deploy models with tenant_id nullable and plugin that auto-adds tenant filter for reads only.
    - Acceptance criteria:
      - Reads are scoped; writes are still allowed but logged if unscoped.
  - Story 8.1.3: Phase 2 — Backfill and enable enforcement
    - Tasks:
      1. Run backfill (dry-run → apply), validate results.
      2. Update schemas to make tenant_id required and enable enforcement plugin that blocks unscoped writes.
    - Acceptance criteria:
      - All core docs have tenant_id; writes without tenant_id are rejected.
  - Story 8.1.4: Phase 3 — Agent & frontend cutover
    - Tasks:
      1. Update agents to require tenant tokens.
      2. Update frontend to include tenant context and switch to tenant subdomains for new tenants.
    - Acceptance criteria:
      - Agents and frontend fully operate with tenant context; legacy global-access paths disabled.

Detailed example user stories (ready to convert to issues)
- US-Auth-01: As a backend dev, ensure tenantResolver sets req.tenant for subdomain requests
  - Acceptance: Requests to tenantA.example.com resolve tenantA, req.tenant populated, and logs include tenantA.
- US-Migrate-01: As a data engineer, run backfill in dry-run to verify mapping counts for email-domain -> tenant
  - Acceptance: Dry-run produces per-collection counts; no write made.
- US-Agent-01: As an agent dev, agent registration must require tenant token
  - Acceptance: Registration without token returns 403; registration with valid token creates agent doc with tenant_id.

Priority & MVP backlog (short list to start implementation)
1. Tenant model + tenantResolver middleware (subdomain-first) — EPIC 1 + Feature 2.1
2. Seed default tenant and mapping loader (email-domain mapping) — EPIC 1 & 6
3. Add tenant_id to agents and users models and implement plugin to scope reads — EPIC 3
4. Agent registration update (agents require tenant token) and agent client change — EPIC 4
5. Backfill script (dry-run) to validate mapping rules — EPIC 6
6. Frontend: include tenant context and basic tenant admin page — EPIC 5
7. Enforce writes & validation, run apply backfill, and make tenant_id required — EPIC 6 Phase 2

Suggested issue labels to use (GitHub)
- epic, feature, story, task, backend, frontend, agent, migration, high-priority, security

Next steps
1. Confirm target repository to file issues in (owner/name) OR confirm you want project-only items in org project (Project #3). If project-only items are supported, confirm that as well.
2. Confirm whether you want me to create the Epics as GitHub issues labeled "epic" and child user stories as issues linked to epics. (Recommended.)
3. If yes, I will create all issues in one API call and attach them to project #3. Note: I will need permission to create issues in the target repo; also tell me whether to set assignees or keep unassigned.

Which repository should I use to create these requirement entities (owner/name)? Once you confirm, I will create the issues in the project.
