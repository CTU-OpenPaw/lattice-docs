---
title: Multi-Tenancy & PostgreSQL 16 FORCE RLS
description: Fail-closed multi-tenant isolation using app.current_org and app.rls_bypass GUCs, AsyncLocalStorage transaction bridging, nocobase_app, and all 56 static FORCE RLS tables.
---

# Multi-Tenancy & PostgreSQL 16 FORCE RLS

LatticeDX `v0.4.2` enforces defense-in-depth tenant isolation across both the application middleware layer (`createNativeScopeMiddleware`) and PostgreSQL `16` (`ENABLE ROW LEVEL SECURITY` paired with `FORCE ROW LEVEL SECURITY`). Even if an ORM call omits an `organizationId` filter, PostgreSQL blocks cross-organization reads and writes at the storage engine boundary.

<ZeroTrustRlsDiagram />

## Session GUC Contract (`app.current_org` & `app.rls_bypass`)

All PostgreSQL RLS policies, transaction helpers, and migrations in `plugins/nocobase/plugin-lattice-foundation/src/server/pg-rls.js` bind to the transaction-local GUCs **`app.current_org`** and **`app.rls_bypass`**. When `DX_PG_RLS_SESSION=true` is active (enabled by default in `infra/compose/prod.yml`), every tenant-scoped query executes inside a transaction bound to these settings.

<ParamGrid
  title="RLS Session Parameters & Database Roles (pg-rls.js & prod.yml)"
  :items="[
    { name: 'DX_PG_RLS_SESSION', type: 'boolean (env)', required: true, default: 'true', description: 'Enables transaction-local PostgreSQL RLS GUC binding in plugin-lattice-foundation.' },
    { name: 'app.current_org', type: 'PostgreSQL GUC', required: true, default: '(empty)', description: 'Active organization identifier bound locally via set_config(\'app.current_org\', :orgId, true). Validated against ^[a-zA-Z0-9_-]{1,80}$.' },
    { name: 'app.rls_bypass', type: 'PostgreSQL GUC', required: false, default: 'off', description: 'Set to \'on\' solely inside controlled system transactions (pre-tenant login lookup, seeding, or root operations).' },
    { name: 'NOCOBASE_APP_DB_USER', type: 'PostgreSQL Role', required: true, default: 'nocobase_app', description: 'Non-superuser runtime role created with NOBYPASSRLS, strictly distinct from POSTGRES_USER.' },
    { name: 'DX_DEFAULT_ORG_ID', type: 'string (env)', required: false, default: '1', description: 'Fallback organization identifier for single-organization deployments.' }
  ]"
/>

| Mechanism | Enforcement Rule |
| :--- | :--- |
| Transaction-local scope (`is_local = true`) | `setTransactionRlsOrg` executes `SELECT set_config('app.current_org', :orgId, true)`. Passing `true` forces PostgreSQL to clear the GUC automatically on `COMMIT` or `ROLLBACK`, preventing tenant context bleed across pooled connections. |
| Identifier validation (`assertValidOrganizationId`) | Accepts only strings matching `^[a-zA-Z0-9_-]{1,80}$` and rejects empty strings, `'all'`, and prototype-pollution keys (`__proto__`, `constructor`, `prototype`). |
| Fail-closed default | When `app.current_org` is unset or empty, `nullif(current_setting('app.current_org', true), '')` evaluates to `NULL`. Because `"organizationId" = NULL` evaluates to `UNKNOWN`, queries outside an active RLS context return `0` rows on reads and fail `WITH CHECK` on writes. |

## Non-Superuser Role Separation (`nocobase_app`)

By default in PostgreSQL, superusers and table owners bypass standard RLS unless `FORCE ROW LEVEL SECURITY` and a non-superuser role are both enforced. The initialization script `infra/config/postgres/init-nocobase-db.sh` separates `POSTGRES_USER` from the runtime role `nocobase_app`:

- Creates `nocobase_app` with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`.
- Aborts startup if `NOCOBASE_APP_DB_USER` equals `POSTGRES_USER`.
- Revokes default `PUBLIC` privileges on both the `nocobase` database and `public` schema, while granting ownership to `nocobase_app` so migrations run without granting `BYPASSRLS`.
- In `infra/config/postgres/init-prod.sh`, the platform database likewise creates `lattice_app`, `keycloak_app`, and `n8n_app` with `NOSUPERUSER NOBYPASSRLS`.

## `lattice_tenant_isolation` Policy & Savepoints

`buildRlsPolicySql(tableName, options)` generates standardized DDL across static and dynamic tables. The 54 camelCase tables filter on `"organizationId"`, while the 2 snake_case attachment tables (`SNAKE_CASE_ORG_TABLES`) filter on `"organization_id"`.

<CodeTabs
  :tabs="[
    {
      label: 'camelCase Policy (SQL)',
      lang: 'sql',
      code: 'ALTER TABLE public.\x22latticeOrders\x22 ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.\x22latticeOrders\x22 FORCE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS lattice_tenant_isolation ON public.\x22latticeOrders\x22;\nCREATE POLICY lattice_tenant_isolation ON public.\x22latticeOrders\x22\n  AS PERMISSIVE FOR ALL TO PUBLIC\n  USING (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organizationId\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  )\n  WITH CHECK (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organizationId\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  );'
    },
    {
      label: 'snake_case Policy (SQL)',
      lang: 'sql',
      code: 'ALTER TABLE public.\x22lattice_native_request_attachments\x22 ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.\x22lattice_native_request_attachments\x22 FORCE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS lattice_tenant_isolation ON public.\x22lattice_native_request_attachments\x22;\nCREATE POLICY lattice_tenant_isolation ON public.\x22lattice_native_request_attachments\x22\n  AS PERMISSIVE FOR ALL TO PUBLIC\n  USING (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organization_id\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  )\n  WITH CHECK (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organization_id\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  );'
    },
    {
      label: 'nocobase_app Provisioning (SQL)',
      lang: 'sql',
      code: 'CREATE ROLE nocobase_app LOGIN PASSWORD \'<secret>\'\n  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\n\nALTER DATABASE \x22nocobase\x22 OWNER TO \x22nocobase_app\x22;\nREVOKE ALL ON DATABASE \x22nocobase\x22 FROM PUBLIC;\nGRANT ALL PRIVILEGES ON DATABASE \x22nocobase\x22 TO \x22nocobase_app\x22;\nALTER SCHEMA public OWNER TO \x22nocobase_app\x22;\nREVOKE CREATE ON SCHEMA public FROM PUBLIC;\nGRANT ALL ON SCHEMA public TO \x22nocobase_app\x22;'
    }
  ]"
/>

Because an unhandled SQL error inside a PostgreSQL transaction puts the entire transaction into an aborted state (`25P02`), `runInRlsSavepoint(db, fn)` wraps optional fallback queries in `SAVEPOINT "ldx_sp_<n>"` and `ROLLBACK TO SAVEPOINT` / `RELEASE SAVEPOINT` so the outer tenant transaction stays intact.

## `AsyncLocalStorage` Transaction Bridge

NocoBase `2.2.50` internals and ORM hooks frequently invoke `Repository` methods without forwarding an explicit `{ transaction }` argument. `pg-rls.js` solves this via `rlsStore` (`AsyncLocalStorage`) and `installRlsTransactionBridge(db)`:

| Bridge Stage | Execution Behavior |
| :--- | :--- |
| Scoped transaction binding | `withTenantRlsContext(db, organizationId, fn)` opens a Sequelize transaction, executes `set_config('app.current_org', :orgId, true)`, and invokes the callback inside `rlsStore.run({ sequelize, transaction, organizationId }, ...)`. |
| Automatic transaction injection | `wrapRepositoryMethods` wraps `find`, `findOne`, `findAndCount`, `count`, `create`, `update`, `destroy`, and `query` on `Repository.prototype` (guarded by `RLS_BRIDGE_MARKER = Symbol.for('latticedx.pgRlsBridgeInstalled')`), alongside `sequelize.query` and `db.getRepository()`. Nested calls without an explicit `transaction` inherit `store.transaction` when targeting the matching `sequelize` instance. |
| Non-enumerable context attachment | `setContextRlsTransaction(ctx, transaction)` defines `ctx.state.latticeRlsTransaction` with `enumerable: false` so NocoBase `2.2.50` `createContextVariablesScope` (`JSON.stringify(ctx.state)`) skips the circular Sequelize `Transaction` object graph. |
| Controlled system bypass (`withSystemRlsBypass`) | Restricted to pre-tenant identity resolution (`resolveNativeActor` reading `latticeEmployees` in `native-scope.js`, `ldx_pat_*` validation in `paas-api-keys.js`, or `root` administrative requests). When nested inside an existing transaction, `native-scope.js` reads `SELECT current_setting('app.rls_bypass', true) AS prev`, sets `'on'` temporarily, and restores `prev` in a `finally` block. |

<CodeTabs
  :tabs="[
    {
      label: 'withTenantRlsContext (JS)',
      lang: 'javascript',
      code: 'async function withTenantRlsContext(db, organizationId, fn) {\n  assertValidOrganizationId(organizationId);\n  const sequelize = db?.sequelize;\n  return sequelize.transaction(async (transaction) => {\n    await setTransactionRlsOrg(db, organizationId, transaction);\n    return rlsStore.run({ sequelize, transaction, organizationId }, () => fn(transaction));\n  });\n}'
    },
    {
      label: 'withSystemRlsBypass (JS)',
      lang: 'javascript',
      code: 'async function withSystemRlsBypass(db, fn) {\n  const sequelize = db?.sequelize;\n  const existing = rlsStore.getStore();\n  if (existing?.systemRlsBypass === true && existing.transaction && existing.sequelize === sequelize) {\n    return fn(existing.transaction);\n  }\n  return sequelize.transaction(async (transaction) => {\n    await setTransactionRlsBypass(db, transaction);\n    return rlsStore.run({ sequelize, transaction, systemRlsBypass: true }, () => fn(transaction));\n  });\n}'
    }
  ]"
/>

## Complete Catalog of All 56 Static Tables & Dynamic `^latticeCustom.*` Tables

`TENANT_RLS_TABLES` in `pg-rls.js` enforces `FORCE ROW LEVEL SECURITY` across **56 static tables**: **54 camelCase** tables keyed on `"organizationId"` and **2 snake_case** tables keyed on `"organization_id"`.

### 54 Static camelCase Tables (`organizationId`)

| # | Table Name | Domain Group | # | Table Name | Domain Group |
| :---: | :--- | :--- | :---: | :--- | :--- |
| `1` | `latticeRequests` | Core Requests & Intake | `28` | `latticeDataQuarantine` | Data Governance |
| `2` | `latticeOrders` | OMS / WMS Orders | `29` | `latticeOrderLines` | OMS / WMS Orders |
| `3` | `latticeAssets` | Assets & Fleet | `30` | `latticeStockLots` | FEFO Inventory Lots |
| `4` | `latticeEmployees` | Directory & Org | `31` | `latticeEpodRecords` | Electronic Proof of Delivery |
| `5` | `latticeDepartments` | Directory & Org | `32` | `latticeDecisionTables` | Visual DMN |
| `6` | `latticeLocations` | Directory & Org | `33` | `latticeDelegations` | Approval Delegations |
| `7` | `latticeIncidentCases` | Incident Management | `34` | `latticeTwinShadows` | IIoT Digital Twin |
| `8` | `latticeIncidentRules` | Incident Management | `35` | `latticeConnectors` | Connector Vault |
| `9` | `latticeAgentProposals` | AI HITL Proposals | `36` | `latticeEventBus` | Event Bus Outbox |
| `10` | `latticeContextOutbox` | NGSI-LD Outbox | `37` | `latticeWebhookSubscriptions` | Webhook Subscriptions |
| `11` | `latticeIntegrationInbox` | Inbound Integrations | `38` | `latticeWebhookDeliveries` | Webhook Deliveries |
| `12` | `latticeRecordChatter` | Record Activity Feed | `39` | `latticeIotDevices` | IIoT Device Registry |
| `13` | `latticeNotifications` | In-App Notifications | `40` | `latticeBrokerSubscriptions` | Orion-LD Subscriptions |
| `14` | `latticeSlaPolicies` | SLA Policies | `41` | `latticeAutomationRules` | LatticeFlow v2 |
| `15` | `latticeParaDocuments` | P.A.R.A. Vault | `42` | `latticeAutomationRuns` | LatticeFlow v2 |
| `16` | `latticeParaChunks` | Hybrid RAG Chunks | `43` | `latticeBuiltApps` | App Builder 2.0 |
| `17` | `latticeServiceTickets` | Internal Service Desk | `44` | `latticeAiMemory` | Persistent AI Memory |
| `18` | `latticeAiProfiles` | AI Agent Profiles | `45` | `latticeAiTraces` | OTel AI Traces |
| `19` | `latticeAiAuditLogs` | AI Tool Audit Logs | `46` | `latticeAutomationRuleVersions` | Flow Versioning |
| `20` | `latticeAiQuotaUsage` | AI Quota Usage | `47` | `latticeA2aTasks` | A2A Protocol Tasks |
| `21` | `latticeAiApprovalQueue` | AI HITL Queue | `48` | `latticeNotificationDeliveries` | Notification Deliveries |
| `22` | `latticeTelemetryPoints` | IIoT Time-Series | `49` | `latticeApprovalPolicies` | Unified Approvals |
| `23` | `latticeApiKeys` | `ldx_pat_*` API Keys | `50` | `latticeApprovalRequests` | Unified Approvals |
| `24` | `latticePkiKeys` | Ed25519 Keypairs | `51` | `latticePublicForms` | Public Intake Forms |
| `25` | `latticeCryptoLedger` | PKI Merkle Ledger | `52` | `latticePublicFormSubmissions` | Form Submissions |
| `26` | `latticeFrozenSnapshots` | Frozen Snapshots | `53` | `latticeAiQuotaPolicies` | AI Quota Policies |
| `27` | `latticeDataLineage` | Data Lineage | `54` | `latticeUiSnapshots` | UI Time-Machine Snapshots |

### 2 Static snake_case Tables (`organization_id`)

| # | Table Name | Tenant Column | Purpose |
| :---: | :--- | :--- | :--- |
| `55` | `lattice_native_request_attachments` | `organization_id` | Stores request attachment metadata post-ClamAV scan |
| `56` | `lattice_native_request_uploads` | `organization_id` | Tracks binary upload sessions handled by `file-scanner` |

### Dynamic `^latticeCustom[A-Za-z0-9_]*$` Tables

Every custom domain table provisioned via `dxosBuilder:createDomain` or App Builder 2.0 (matching `^latticeCustom[A-Za-z0-9_]*$`, including generated `belongsToMany` join tables `latticeCustom<Src><Tgt>Join`) receives a non-null indexed `organizationId` column, `ENABLE` + `FORCE ROW LEVEL SECURITY`, and policy verification against `pg_class` via `attachAndVerifyPgRls` in `domain-schema-rls.js`. At runtime, `discoverTenantRlsTables` queries `information_schema.columns` to audit both the 56 static tables and any dynamic `latticeCustom*` tables.

## Live PostgreSQL Verification Queries

Operators can inspect `pg_class`, `pg_policies`, and fail-closed isolation behavior directly under the `nocobase_app` role:

<CodeTabs
  :tabs="[
    {
      label: 'Inspect pg_class & pg_policies (SQL)',
      lang: 'sql',
      code: '-- 1. Verify all 56+ tables have relrowsecurity and relforcerowsecurity enabled\nSELECT c.relname AS table_name,\n       c.relrowsecurity AS rls_enabled,\n       c.relforcerowsecurity AS rls_forced\nFROM pg_class c\nJOIN pg_namespace n ON n.oid = c.relnamespace\nWHERE n.nspname = \'public\'\n  AND (c.relname LIKE \'lattice%\' OR c.relname LIKE \'lattice_%\')\nORDER BY c.relname;\n\n-- 2. Verify active lattice_tenant_isolation policy expressions\nSELECT tablename, policyname, cmd, roles, qual, with_check\nFROM pg_policies\nWHERE schemaname = \'public\' AND policyname = \'lattice_tenant_isolation\';'
    },
    {
      label: 'Test Fail-Closed Isolation (SQL)',
      lang: 'sql',
      code: '-- Execute as role nocobase_app\nBEGIN;\n-- Unset app.current_org -> returns 0 rows\nSELECT count(*) FROM public.\x22latticeOrders\x22;\n\n-- Bind transaction-local org context -> returns only org_a rows\nSELECT set_config(\'app.current_org\', \'org_a\', true);\nSELECT id, \x22organizationId\x22 FROM public.\x22latticeOrders\x22 LIMIT 10;\nCOMMIT;'
    }
  ]"
/>

## Related

- [Zero-Trust Security Model & Network Zones](/en/architecture/security-model)
- [Data Model & Safe AST Formulas](/en/architecture/data-model)
- [Custom Collections & Rich Schema Formulas](/en/studio/custom-collections-formulas)
- [Zero-Trust Production Deployment](/en/getting-started/production-deployment)
