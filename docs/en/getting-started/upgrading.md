---
title: Upgrading, PITR Backups & Bundle Portability
description: Pre-upgrade PITR backup verification, upgrading the 7 @latticedx/* plugins on NocoBase 2.2.50, isolated upgrade rehearsals, 0.4.x compatibility, and Solution Bundle v3 portability.
---

# Upgrading, PITR Backups, and Bundle Portability

Upgrades across the LatticeDX `0.4.x` (`0.4.2`) release line follow a deterministic sequence: verify SHA-256 and Point-in-Time Recovery (PITR) backups first, rehearse migrations against an isolated runtime, rebuild and enable the 7 host-mounted plugins, and use `latticedx.solution-bundle/v3` for portable GitOps promotion across environments.

## 1. Mandatory Pre-Upgrade Backups and PITR Verification

Never rebuild plugins, recreate containers, or run database migrations without a verified backup manifest and confirmed WAL archiving readiness. LatticeDX ships four complementary recovery scripts scoped from individual databases to full-stack bundles:

<ParamGrid
  title="Pre-Upgrade Backup and Recovery Verification Scripts"
  :items="[
    { name: 'scripts/stack-recovery.mjs', type: 'Full Stack', default: 'output/backups/stack/stack-<id>', description: 'Snapshots all 7 stateful components (nocobase-db, uploads, keycloak, orion-mongo, n8n, lattice-db, engine-objects) and inspects WAL archive readiness.' },
    { name: 'scripts/pitr-backup.mjs', type: 'PITR / WAL', default: 'wal-g | pgbackrest | local-gz', description: 'Validates PITR configuration (check-config), builds base backups, lists restore points, and generates ISO-8601 restore plans.' },
    { name: 'scripts/native-database-recovery.mjs', type: 'nocobase-db', default: 'output/backups/native/', description: 'Creates a custom-format pg_dump of the nocobase database with per-table MD5 inventory fingerprints and rehearses restore.' },
    { name: 'scripts/backup-core.mjs', type: 'lattice-db', default: 'output/backups/', description: 'Dumps and rehearses restoration of the core lattice Fastify database into an ephemeral fixture database.' }
  ]"
/>

Run PITR validation and capture a full-stack backup before starting any maintenance window:

<CodeTabs
  :tabs="[
    {
      label: 'PITR Check & Base Backup',
      lang: 'bash',
      code: '# 1. Validate PITR WAL archiving readiness (wal-g / pgbackrest / local-gz)\nnode scripts/pitr-backup.mjs check-config --backend=local-gz --allow-unencrypted-local\n\n# 2. Preview base-backup plan (append --execute to run directly)\nnode scripts/pitr-backup.mjs base-backup --backend=wal-g\n\n# 3. Capture full 7-component stack backup with SHA-256 manifest\npnpm backup:stack'
    },
    {
      label: 'Ephemeral Restore Rehearsal',
      lang: 'bash',
      code: '# Rehearse full restore inside an ephemeral PostgreSQL 16 container\nnode scripts/stack-recovery.mjs rehearse output/backups/stack/stack-<bundle-id> --ephemeral\n\n# Generate a point-in-time recovery plan targeting pre-upgrade timestamp\nnode scripts/pitr-backup.mjs restore-plan --backend=local-gz --allow-unencrypted-local --target-time=2026-11-26T16:00:00Z'
    }
  ]"
/>

::: warning Fail-Closed PITR Key Enforcement
`scripts/pitr-backup.mjs` rejects `wal-g` or `pgbackrest` targets unless repository encryption keys (`WALG_LIBSODIUM_KEY` / `WALG_PGP_KEY` or `PGBACKREST_REPO1_CIPHER_PASS`) are configured, unless `--allow-unencrypted-local` is explicitly passed for local non-production archives. Local `PITR_WAL_DIR` archives enforce `0700` directory permissions and `umask 077` gzip output.
:::

---

## 2. Isolated Upgrade Rehearsal (`native-rehearsal.yml`)

Before applying changes to `infra/compose/prod.yml`, test plugin builds and schema migrations using `infra/compose/native-rehearsal.yml` (`name: lattice-native-rehearsal`). It launches an isolated `nocobase-db` (`pgvector:0.8.1-pg16`) and `nocobase` (`2.2.50`) pair bound strictly to `127.0.0.1:13001` with zero production volumes or public listeners:

<CodeTabs
  :tabs="[
    {
      label: 'Run Rehearsal Stack',
      lang: 'bash',
      code: 'docker compose -f infra/compose/native-rehearsal.yml up -d --wait\ndocker compose -f infra/compose/native-rehearsal.yml exec -T nocobase yarn nocobase upgrade\n\n# Tear down ephemeral rehearsal containers and volumes\ndocker compose -f infra/compose/native-rehearsal.yml down -v'
    }
  ]"
/>

---

## 3. Runtime and 7-Plugin Upgrade Workflow

Whether upgrading a local workspace (`nocobase.yml`) or production (`prod.yml`), the sequence follows four steps: backup, host-side plugin build, `nocobase` container recreation, and `yarn nocobase upgrade`.

### Automated Local Workspace Upgrade (`scripts/install-workspace.mjs`)

Running `pnpm workspace:install` executes a guarded upgrade loop against `infra/compose/nocobase.yml`:
1. Streams a custom-format `pg_dump` of `nocobase` into `output/backups/nocobase-before-workspace-<uuid>.dump` alongside a `.json` SHA-256 manifest, aborting immediately if the dump fails.
2. Restores locked dependencies for `plugin-enterprise-auth` (`npm ci --ignore-scripts --no-audit --no-fund`) and builds all 7 plugins on the host.
3. Recreates the `nocobase` container (`up -d --no-deps --force-recreate nocobase`) and waits for `/api/app:getLang` to return HTTP 200.
4. Packs each plugin offline (`npm pack --offline --ignore-scripts`), runs `yarn nocobase pm add` and `yarn nocobase pm enable`, and verifies via `yarn nocobase pm list` that all 7 `@latticedx/*` packages are `enabled: true` at `0.4.2`.

### Production Upgrade Runbook (`infra/compose/prod.yml`)

Execute the following steps during a production maintenance window:

<CodeTabs
  :tabs="[
    {
      label: 'Production Upgrade Runbook',
      lang: 'bash',
      code: '# 1. Pull target release and rebuild all 7 host-mounted plugins\npnpm install --frozen-lockfile\nnpm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund\nnode plugins/nocobase/action-bridge/build.mjs\nnode plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs\nnode plugins/nocobase/plugin-enterprise-auth/build.mjs\nnode plugins/nocobase/plugin-dxos-para/build.mjs\nnode plugins/nocobase/plugin-dxos-blocks/build.mjs\nnode plugins/nocobase/plugin-dxos-studio/build.mjs\nnode plugins/nocobase/plugin-dxos-ai/build.mjs\n\n# 2. Recreate nocobase container with updated read-only plugin mounts\ndocker compose --env-file .env.prod -f infra/compose/prod.yml up -d --no-deps --force-recreate nocobase\n\n# 3. Apply host and plugin schema migrations\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase upgrade'
    },
    {
      label: 'Post-Upgrade Verification',
      lang: 'bash',
      code: '# Verify @latticedx/* migrations are recorded\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U nocobase -d nocobase -At -c \x22SELECT count(*) FROM migrations WHERE name LIKE \x27%/@latticedx/%\x27;\x22\n\n# Confirm zero tenant tables lack ENABLE + FORCE ROW LEVEL SECURITY\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U nocobase -d nocobase -At -c \x22SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=\x27public\x27 AND c.relname LIKE \x27lattice%\x27 AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);\x22\n\n# Confirm runtime health endpoint\ncurl -fsS \x22https://<LATTICE_DOMAIN>/api/dxos:health\x22'
    }
  ]"
/>

If the RLS verification query returns a count greater than `0`, inspect the migration logs for `plugin-lattice-foundation` and `plugin-dxos-ai` before restoring public traffic.

---

## 4. `0.4.x` Compatibility and NocoBase `2.2.50` Host Contract

LatticeDX locks the monorepo and all 7 `@latticedx/*` plugins at `0.4.2` within the `0.4.x` pre-1.0 release line. Compatibility boundaries are enforced continuously in CI:

| Component | Version Contract | Compatibility Boundary |
| :--- | :--- | :--- |
| **Platform & 7 Plugins** | `0.4.2` | All 7 packages declare `"version": "0.4.2"` and `"sdkProvidedByHost": true`. |
| **NocoBase Host Runtime** | `2.2.50` (`supportedVersions: ["2.2.x"]`) | Runs from pinned digest `@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777`, supplying `react: 18.2.0`, `react-dom: 18.2.0`, `antd: 5.24.2`, and `@nocobase/*` host packages. |
| **PostgreSQL & pgvector** | `16.16` + `pgvector 0.8.1` | Preserves vector indexes (`8..8192` dimensions) and `FORCE ROW LEVEL SECURITY` enforcement under `nocobase_app`. |
| **Keycloak / APISIX / Valkey** | `26.8.2` / `3.19.0` / `8.1` | Realm `lattice`, PKCE `S256` flows, and Valkey DB 0/1/2 partitioning remain stable across `0.4.x`. |

Within the `0.4.x` line, dynamic `latticeCustom*` tables and `latticeUiSnapshots` records remain forward-compatible across patch updates. Any breaking schema change in future minor releases ships with explicit migration steps.

---

## 5. Configuration Portability with Solution Bundle v3

When promoting portals, business roles, LatticeFlow v2 automations, DMN decision tables, AI profiles, and `latticeCustom*` collections across dev, staging, and production environments (or migrating tenants into a freshly upgraded cluster), export and import via **Solution Bundle v3** (`latticedx.solution-bundle/v3`).

A `latticedx.solution-bundle/v3` payload contains `metadata` (`schemaVersion`, `platformVersion: '0.4.2'`, `organizationId`, `exportedAt`, `contentSha256`) and 8 top-level sections: `roles`, `portals`, `workflows`, `aiProfiles`, `customCollections`, `connectors`, `routesAndBlocks` (`routes`, `flowModels`), and `governance` (`decisionTables`, `slaPolicies`, `incidentRules`, `automationRules`, `webhookSubscriptions`).

Import safety controls are enforced server-side across three rules:

| Security Control | Server-Side Enforcement |
| :--- | :--- |
| Multi-version v1 / v2 / v3 ingestion | Accepts v1, v2, and v3 bundles while stripping secret keys (`SECRET_KEY_RE`, `CONNECTOR_SECRET_KEYS`) so credentials never leak across environments. |
| Privilege and injection blocking | Rejects `root`, `admin`, and `ldx_admin` role definitions, wildcard permission snippets, custom code keys, XSS payloads, and prototype pollution keys. |
| Safe `dryRun: true` default and snapshot | `solutionBundleImport` defaults to `dryRun: true`; live imports (`dryRun: false`) first snapshot pre-import state into `latticeUiSnapshots` (`portalSlug: '__gitops_bundle__'`) for atomic restoration via `solutionBundleRollback`. |

<ApiEndpoint
  method="GET"
  path="/api/dxosStudio:solutionBundleExport"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Exports the current organization configuration as a latticedx.solution-bundle/v3 JSON document with a contentSha256 digest."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleDiff"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Computes a structural diff between an incoming Solution Bundle v3 payload and the target organization state."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleImport"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Validates (dryRun: true default) or applies v1/v2/v3 bundles after capturing a rollback snapshot."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleRollback"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Reconciles created or modified artifacts and restores the pre-import __gitops_bundle__ snapshot."
/>

<CodeTabs
  :tabs="[
    {
      label: 'Export & Diff Bundle v3',
      lang: 'bash',
      code: '# Export a Solution Bundle v3 from the source organization\ncurl -fsS -H \x22Authorization: Bearer <TOKEN>\x22 \\\n  \x22https://<LATTICE_DOMAIN>/api/dxosStudio:solutionBundleExport\x22 -o bundle-v3.json\n\n# Diff against the target environment before applying\ncurl -fsS -X POST \\\n  -H \x22Authorization: Bearer <TARGET_TOKEN>\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d @bundle-v3.json \\\n  \x22https://<TARGET_DOMAIN>/api/dxosStudio:solutionBundleDiff\x22'
    },
    {
      label: 'Dry-Run & Rollback',
      lang: 'bash',
      code: '# Validate import in dry-run mode (dryRun: true default, no DB writes)\ncurl -fsS -X POST \\\n  -H \x22Authorization: Bearer <TARGET_TOKEN>\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d @bundle-v3.json \\\n  \x22https://<TARGET_DOMAIN>/api/dxosStudio:solutionBundleImport\x22\n\n# Roll back to the pre-import snapshot if needed\ncurl -fsS -X POST \\\n  -H \x22Authorization: Bearer <TARGET_TOKEN>\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{}\x27 \\\n  \x22https://<TARGET_DOMAIN>/api/dxosStudio:solutionBundleRollback\x22'
    }
  ]"
/>

---

## 6. Emergency Rollback on Upgrade Failure

If a container recreation or schema migration fails mid-rollout:
1. Stop incoming traffic to `nocobase` at the Caddy or APISIX layer.
2. If the regression occurred during a Solution Bundle v3 promotion, invoke `POST /api/dxosStudio:solutionBundleRollback` to restore the pre-import UI and route snapshot.
3. If `nocobase-db` schema migrations failed partway through, restore the verified `stack-recovery.mjs` bundle or recover via PITR to the timestamp captured immediately before `yarn nocobase upgrade` using the runbook in [Backup and PITR](/en/operations/backup-and-pitr).

---

## Related

- [Zero-Trust Production Deployment](/en/getting-started/production-deployment)
- [Backup and PITR](/en/operations/backup-and-pitr)
- [Solution Bundles](/en/studio/solution-bundles)
- [Plugin System and Host Contract](/en/architecture/plugin-system)
