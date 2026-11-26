---
title: Testing and Verification
description: Multi-layer verification workflows covering workspace typechecks, plugin contract suites, PostgreSQL RLS isolation checks, AI evaluation, and CI supply-chain gates.
---

# Testing and Verification

LatticeDX separates verification into two tiers: offline deterministic checks (TypeScript compilation, unit tests, plugin contract suites, natural-language routing evaluation, and supply-chain verification) and live integration checks executed against running Docker Compose stacks (tenant isolation, OIDC login, ClamAV scanning, NGSI-LD sync, and recovery drills).

## Verification Matrix

| Verification Layer | Runner / Script | Requires Running Services | Scope |
| :--- | :--- | :--- | :--- |
| Typecheck, Unit & Build | `pnpm check` (`tsc`, `vitest`) | No | Validates TypeScript types across `@dx/*` workspaces, runs Vitest unit tests, and builds packages. |
| Plugin Contracts & Recovery Scripts | `node --test` | No | Verifies domain rules, 56 RLS tables, FEEL/DMN evaluators, OTel exporter, PKI ledger, and backup scripts. |
| Vietnamese NL Router Eval | `eval-vietnamese-nl-agent.mjs` | No | Evaluates routing accuracy across 20 unified tools and adversarial prompt-injection refusals. |
| Source & Supply-Chain Gates | `source-headers.mjs`, `pof:check`, `release:sbom` | No | Enforces Apache-2.0 SPDX headers, Pure-OSI isolation checks, CycloneDX SBOM freshness, and `pnpm audit`. |
| Live Stack Readiness & E2E | `local:doctor`, `smoke-*.mjs`, `acceptance-*.mjs` | Yes (Docker Compose) | Exercises end-to-end flows through APISIX, Keycloak, `nocobase`, PostgreSQL 16, ClamAV, Orion-LD, and Mosquitto. |

## Offline Verification (Unit, Contract, and AI Evaluation)

Static checks and contract suites execute directly on Node.js 24 and `pnpm 10.23.0` without starting Docker containers, making them suitable for fast pre-commit and pre-PR validation.

<CodeTabs
  :tabs="[
    {
      label: 'Workspace Check',
      lang: 'bash',
      code: 'pnpm typecheck\npnpm test\npnpm build\n# Or run all three sequentially\npnpm check'
    },
    {
      label: 'Plugin & Script Suites',
      lang: 'bash',
      code: 'node --test \\\n  plugins/nocobase/plugin-lattice-foundation/tests/*.test.cjs \\\n  plugins/nocobase/action-bridge/tests/*.test.cjs \\\n  plugins/nocobase/plugin-enterprise-auth/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-para/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-blocks/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-studio/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-ai/tests/*.test.cjs \\\n  scripts/tests/*.test.mjs \\\n  tests/native-ui-fixture.test.mjs \\\n  tests/nocobase-externals.test.mjs'
    },
    {
      label: 'Vietnamese NL Eval',
      lang: 'bash',
      code: 'node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95'
    }
  ]"
/>

### Vietnamese Natural-Language Routing Evaluation

`scripts/eval-vietnamese-nl-agent.mjs` invokes `parseVietnameseNaturalIntent` in `plugin-dxos-ai` across seven behavioral test categories:

| Eval Category | Target Tool / Behavior | Acceptance Criterion |
| :--- | :--- | :--- |
| `rag-search` | `dxos_search_enterprise_context` | Routes SOP lookups, cold-chain queries, order searches, and asset checks. |
| `workflow-tasks` | `dxos_my_workflow_tasks` | Resolves pending approval queues and delivery confirmation task lists. |
| `orchestration` | `dxos_orchestrate_enterprise_case` | Triggers cross-department bottleneck radar and SLA summary runs. |
| `alarm-ops` | `dxos_alarm_action` | Distinguishes `action: ack` (acknowledgment) from `action: clear` (closure). |
| `creative-architect` | `dxos_design_creative_block`, `dxos_compose_page_blocks` | Extracts `widgetType`, alert thresholds, and layout placement for `isAdmin: true`. |
| `admin-provision` / `admin-rollback` | `dxos_provision_role_workspace`, `dxos_snapshot_or_rollback_page` | Locks specified columns and restores prior portal UI snapshots. |
| `security-refusal` | Explicit refusal (`refused: true`) | Blocks `.env` reads, `AGENT_API_KEY` extraction, `DROP TABLE`/`UNION SELECT`, and unauthorized admin calls. |

Passing `--min-pass=95` requires an aggregate pass rate of at least `95%` to exit `0`.

## PostgreSQL 16 `FORCE RLS` Isolation Verification

Tenant isolation is verified at two levels:

1. **Contract-level (`m1-rls-security.test.cjs` and `pg-rls-and-observability.test.cjs`)**: verifies the registry of 56 static tables (`54` camelCase tables keyed on `"organizationId"` and `2` snake_case tables `lattice_native_request_attachments` and `lattice_native_request_uploads` keyed on `"organization_id"`), tests `assertSafeSqlIdentifier`, and asserts that repository queries inside a mock Sequelize tracker execute under transaction-local `set_config('app.current_org', :orgId, true)` or `set_config('app.rls_bypass', 'on', true)` with `SAVEPOINT` isolation.
2. **Database-level**: queries `pg_class` and `pg_policies` directly under the `nocobase_app` (`NOSUPERUSER NOBYPASSRLS`) runtime role to verify that every static and dynamic (`latticeCustom*`) tenant table enforces `FORCE ROW LEVEL SECURITY`.

<CodeTabs
  :tabs="[
    {
      label: 'Run RLS Unit Suites',
      lang: 'bash',
      code: 'node --test plugins/nocobase/plugin-lattice-foundation/tests/m1-rls-security.test.cjs plugins/nocobase/plugin-lattice-foundation/tests/pg-rls-and-observability.test.cjs'
    },
    {
      label: 'Inspect Live PG16 Policies',
      lang: 'sql',
      code: '-- 1. Confirm all 56+ lattice* tables have both relrowsecurity and relforcerowsecurity\nSELECT c.relname, c.relrowsecurity, c.relforcerowsecurity\nFROM pg_class c\nJOIN pg_namespace n ON n.oid = c.relnamespace\nWHERE n.nspname = \x27public\x27\n  AND (c.relname LIKE \x27lattice%\x27 OR c.relname LIKE \x27lattice_%\x27)\nORDER BY c.relname;\n\n-- 2. Confirm lattice_tenant_isolation binds to app.current_org\nSELECT tablename, policyname, cmd, qual, with_check\nFROM pg_policies\nWHERE schemaname = \x27public\x27 AND policyname = \x27lattice_tenant_isolation\x27;\n\n-- 3. Confirm runtime database roles do not hold BYPASSRLS\nSELECT rolname, rolsuper, rolbypassrls\nFROM pg_roles\nWHERE rolname IN (\x27nocobase_app\x27, \x27lattice_app\x27, \x27keycloak_app\x27, \x27n8n_app\x27);'
    }
  ]"
/>

## Live Stack Integration and End-to-End Suites

After starting the local Compose stack (`pnpm local:up` or `docker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml up -d`), `smoke-*` and `acceptance-*` scripts execute real HTTP workflows through APISIX (`http://localhost:8080`), Keycloak (`http://localhost:8081`), and NocoBase (`http://localhost:13000`).

<ParamGrid
  title="Integration Verification Scripts in package.json"
  :items="[
    { name: 'pnpm local:doctor', type: 'script', description: 'Non-mutating loopback readiness check for API (/ready), Keycloak OIDC discovery, and NocoBase; supports --integration and --agent flags.' },
    { name: 'pnpm test:foundation', type: 'script', description: 'Verifies task lifecycle, optimistic concurrency (409), org-a/org-b isolation, clean ClamAV upload, and EICAR rejection.' },
    { name: 'pnpm test:nocobase', type: 'script', description: 'Validates NocoBase host boot, loading of all 7 @latticedx/* plugins, and core routing.' },
    { name: 'pnpm test:scanner-outage', type: 'script', description: 'Verifies fail-closed file upload behavior when ClamAV or file-scanner is unavailable.' },
    { name: 'pnpm acceptance:logistics-rbac', type: 'script', description: 'Exercises Cold-Chain OMS/WMS flows, FEFO lot allocation, ePOD verification, and role-based access control.' },
    { name: 'pnpm acceptance:dxos-ai-mcp', type: 'script', description: 'Verifies AI Studio runs, MCP JSON-RPC (/api/dxos-mcp), quota tracking, and trace auditing.' },
    { name: 'pnpm acceptance:headless-paas', type: 'script', description: 'Validates scoped ldx_pat_* API keys, Ed25519/Merkle ledger verification, and OpenAPI/AsyncAPI specs.' },
    { name: 'pnpm acceptance:broker-automation-builder', type: 'script', description: 'Exercises IIoT telemetry ingestion, LatticeFlow DAG rules, and App Builder operations.' },
    { name: 'pnpm test:native-recovery', type: 'script', description: 'Executes backup, MD5 row-fingerprint comparison, and isolated restore verification for nocobase-db.' }
  ]"
/>

Note on AI worker scripts: `pnpm test:agent-provider` and `pnpm test:agent-worker-live` require `.env.agent` with a configured provider key; all other integration scripts run against the default local configuration in `.env.example`.

### Non-Mutating Readiness Checks with `pnpm local:doctor`

`scripts/check-local.mjs` issues read-only HTTP `GET` metadata probes (no authentication, no writes, and no model calls) against loopback endpoints with a `3000ms` timeout per service:

```json
{
  "scope": "service-readiness",
  "ok": true,
  "businessFlowsVerified": false,
  "checks": [
    { "service": "engine", "status": "ready", "httpStatus": 200 },
    { "service": "keycloak", "status": "ready", "httpStatus": 200 },
    { "service": "nocobase", "status": "ready", "httpStatus": 200 }
  ]
}
```

Pass `--integration` to include `orion-ld` (`:1026/version`) and `n8n` (`:5678/healthz`) before executing `pnpm test:ngsi-ld-postgres` or `pnpm test:incident-agent`.

## CI, Compose Validation, and Supply-Chain Gates

`.github/workflows/ci.yml` executes four independent jobs on every push and pull request targeting `main`:

| CI Job | Checks & Verification Scope |
| :--- | :--- |
| `check` | Runs `pnpm check`, `node scripts/source-headers.mjs --check`, `pnpm pof:check`, `pnpm release:sbom -- --check`, `eval-vietnamese-nl-agent.mjs --min-pass=95`, brand naming checks, and all `node --test` suites. |
| `dependency-audit` | Runs `pnpm audit --prod --audit-level=low` to verify zero known vulnerabilities across production dependencies. |
| `compose-validate` | Runs `docker compose config --quiet` across every stack under `infra/compose/` (`core.yml`, `nocobase.yml`, `native-rehearsal.yml`, `integration.yml`, `native-files.yml`, `uc1-sample.yml`, `iiot.yml`, and `prod.yml` with all profiles enabled). |
| `trivy-scan` | Runs `aquasecurity/trivy-action` for `CRITICAL` and `HIGH` vulnerabilities, misconfigurations, and leaked secrets. |

### Six Checks in `scripts/verify-pof-readiness.mjs` (`pnpm pof:check`)

- `spdx-headers`: Confirms all first-party source files carry `SPDX-License-Identifier: Apache-2.0`.
- `governance-files`: Verifies required licensing and governance documents (`LICENSE`, `NOTICE`, `COPYRIGHT.txt`, `CONTRIBUTING.md`, `SECURITY.md`, and build documentation).
- `plugin-isolation`: Confirms all 7 plugins declare `"sdkProvidedByHost": true` and avoid bundling external host runtime code.
- `compose-digests`: Confirms every `image:` entry in `infra/compose/*.yml` pins an immutable `@sha256:...` digest.
- `upstream-clean`: Confirms `.gitmodules` and `upstream/nocobase` are absent from the repository tree.
- `no-secrets`: Scans tracked files for API token patterns and PEM private key headers.

<CodeTabs
  :tabs="[
    {
      label: 'Release & Compliance Checks',
      lang: 'bash',
      code: 'node scripts/source-headers.mjs --check\npnpm pof:check\npnpm release:sbom -- --check\npnpm audit --prod --audit-level=low'
    },
    {
      label: 'Validate All Compose Profiles',
      lang: 'bash',
      code: 'docker compose --env-file infra/compose/prod.env.example \\\n  -f infra/compose/prod.yml \\\n  --profile n8n --profile iiot --profile observability --profile pdf --profile iam-sync \\\n  config --quiet'
    }
  ]"
/>

## Related

- [Multi-Tenancy and PostgreSQL RLS](/en/architecture/multi-tenancy-rls)
- [AI Evaluation and Guardrails](/en/ai/eval-and-guardrails)
- [SBOM and Source Build](/en/open-source/sbom-and-source-build)
- [Backup and PITR](/en/operations/backup-and-pitr)
