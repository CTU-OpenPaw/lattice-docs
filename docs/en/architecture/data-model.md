---
title: Data Model
description: PostgreSQL 16 schema architecture in LatticeDX covering 56 FORCE RLS static tables, 2 snake_case attachment tables, dynamic latticeCustom* collections, and the Safe AST formula engine.
---

<script setup>
const dataModelTabs = [
  {
    label: 'Schema Relations (JS)',
    lang: 'javascript',
    code: `// plugins/nocobase/plugin-lattice-foundation/src/server/schema.js
employees: base('latticeEmployees', 'Nhân viên', 'employees', [
  text('email', 'Email'),
  text('identitySubject', 'Identity subject'),
  { name: 'userId', type: 'bigInt', unique: true, allowNull: true },
  relation('user', 'users', 'userId'),
  relation('department', 'latticeDepartments', 'departmentId'),
  many('assets', 'latticeAssets', 'custodianId'),
]),

assets: base('latticeAssets', 'Tài sản', 'assets', [
  text('kind', 'Loại tài sản'),
  text('status', 'Trạng thái', { defaultValue: 'available' }),
  { name: 'version', type: 'integer', defaultValue: 1, allowNull: false },
  relation('department', 'latticeDepartments', 'departmentId'),
  relation('location', 'latticeLocations', 'locationId'),
  relation('custodian', 'latticeEmployees', 'custodianId'),
])`,
  },
  {
    label: 'Data Lineage Record (JSON)',
    lang: 'json',
    code: `{
  "organizationId": "org_coldchain_01",
  "edgeUid": "epod_delivered_by_1042",
  "sourceCollection": "latticeOrders",
  "sourceRecordId": "1042",
  "targetCollection": "latticeEpodRecords",
  "targetRecordId": "884",
  "relationType": "delivered_by",
  "actorName": "driver_03",
  "observedAt": "2026-11-26T09:15:00.000Z"
}`,
  },
];
</script>

# Data Model

LatticeDX persists operational, workflow, AI, and digital-twin state in PostgreSQL 16 (`pgvector/pgvector:0.8.1-pg16`) through NocoBase `2.2.50` collections paired with raw transactional SQL tables. The data layer separates 56 static `FORCE ROW LEVEL SECURITY` tables from dynamic `latticeCustom*` collections provisioned at runtime by platform administrators or App Builder 2.0.

Every tenant-scoped table carries an explicit tenant discriminator column (`organizationId` on 54 camelCase collections and `organization_id` on 2 snake_case native upload tables), paired with composite indexes leading on the tenant column so RLS predicates execute cleanly against index scans.

## Inventory of 56 Static Core Tables

All 56 static tables are declared in `TENANT_RLS_TABLES` inside `plugins/nocobase/plugin-lattice-foundation/src/server/pg-rls.js` and grouped across six functional domains:

| Domain | Collections | Primary Responsibility |
| :--- | :--- | :--- |
| **Directory & Assets** | `latticeDepartments`, `latticeEmployees`, `latticeLocations`, `latticeAssets`, `latticeRecordChatter`, `latticeNotifications`, `latticeNotificationDeliveries` | Organizational units, employees bound to `userId`, physical locations, monitored assets, record chatter threads, and delivery logs. |
| **Operations & Cold Chain** | `latticeRequests`, `latticeOrders`, `latticeOrderLines`, `latticeStockLots`, `latticeEpodRecords`, `latticeServiceTickets`, `latticeSlaPolicies`, `latticeIncidentRules`, `latticeIncidentCases` | Business requests and orders, FEFO inventory lots, signed ePOD delivery proofs, service tickets, SLA definitions, and IoT incident cases. |
| **Automation & Approvals** | `latticeAutomationRules`, `latticeAutomationRuleVersions`, `latticeAutomationRuns`, `latticeDecisionTables`, `latticeApprovalPolicies`, `latticeApprovalRequests`, `latticeDelegations`, `latticePublicForms`, `latticePublicFormSubmissions` | LatticeFlow v2 DAG definitions and run state, DMN decision tables, M-of-N approval workflows, delegations, and public form intake. |
| **AI Studio & P.A.R.A. Vault** | `latticeAiProfiles`, `latticeAiMemory`, `latticeAiTraces`, `latticeAiAuditLogs`, `latticeAiQuotaPolicies`, `latticeAiQuotaUsage`, `latticeAiApprovalQueue`, `latticeAgentProposals`, `latticeBuiltApps`, `latticeParaDocuments`, `latticeParaChunks`, `latticeUiSnapshots` | Seven agent profiles, scoped memory, OTel/AI audit trails, token/USD quotas, App Builder state, `pgvector` knowledge chunks, and UI layout snapshots. |
| **Security, PKI & Governance** | `latticeApiKeys`, `latticePkiKeys`, `latticeCryptoLedger`, `latticeFrozenSnapshots`, `latticeDataLineage`, `latticeDataQuarantine`, `latticeConnectors` | Scoped `ldx_pat_*` keys, AES-256-GCM wrapped Ed25519 keys, Merkle-chained audit ledger, lineage graph edges, offline quarantine, and encrypted connector secrets. |
| **Outbox & Integration** | `latticeEventBus`, `latticeWebhookSubscriptions`, `latticeWebhookDeliveries`, `latticeContextOutbox`, `latticeIntegrationInbox`, `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices`, `latticeBrokerSubscriptions` | CloudEvents 1.0 journal, webhook subscriptions and outbox deliveries, NGSI-LD context outbox, inbound inbox, and IIoT twin shadows. |

Two additional snake_case tables (`lattice_native_request_attachments` and `lattice_native_request_uploads`) handle virus-scanned binary attachments and two-phase upload receipts, completing the 56 static RLS-protected tables.

## Core Relations and Document Lifecycle

In `plugins/nocobase/plugin-lattice-foundation/src/server/schema.js`, directory and transactional collections share a common `base` definition (`code`, `name`, `organizationId`, `active`, `createdAt`, `updatedAt`) with a per-tenant unique constraint `uidx_lattice_<prefix>_org_code` on `(organizationId, code)`.

Document collections such as `latticeRequests` and `latticeOrders` extend `documentFields()` for state transitions, optimistic locking, and amendment tracking:

- Lifecycle and concurrency fields include `status` (default `'draft'`), `version` (monotonic integer), `decisionReason`, `submittedAt`, `submittedBy`, `cancelledAt`, `cancelledBy`, and `cancelReason`.
- Amendment tracking uses `amendedFromId` (`bigInt`) and `amendmentNo` (`integer`, default `0`) to link superseding documents back to cancelled records.
- Standard foreign-key associations include `requester` and `assignee` (`belongsTo` `latticeEmployees` via `requesterId` and `assigneeId`) and `department` (`belongsTo` `latticeDepartments` via `departmentId`).
- `latticeEmployees` maintains an optional unique `userId` (`belongsTo` `users`) and a `hasMany` relation to `latticeAssets` via `custodianId`.

Cross-module provenance is recorded in `latticeDataLineage`, which stores directed graph edges `(sourceCollection, sourceRecordId)` → `(targetCollection, targetRecordId)` with `relationType`, a per-org unique `edgeUid`, and `observedAt`. Impact analysis (`dxos_graph_impact_analysis`) and ePOD verification traverse these edges without runtime schema introspection across unrelated tables.

<CodeTabs :tabs="dataModelTabs" />

## Snake-Case Native Attachment Tables (`lattice_native_*`)

Unlike the 54 camelCase collections managed through NocoBase `defineCollection`, two snake_case tables are provisioned directly via SQL migrations (`20261106000300-native-request-attachments.js` and `20261107000100-shared-upload-receipts.js`) to enforce byte-length checks, idempotent receipts, and two-phase upload locking at the database layer.

| Table | Tenant Column | Primary / Unique Keys | Technical Role |
| :--- | :--- | :--- | :--- |
| `lattice_native_request_attachments` | `organization_id` | `id` (UUID PK) and `UNIQUE(request_id, organization_id, uploader_id, idempotency_key)` | Stores binary payloads up to `1 MiB` (`octet_length(content) BETWEEN 1 AND 1048576`) after synchronous ClamAV `zINSTREAM` scanning on port `3310`. |
| `lattice_native_request_uploads` | `organization_id` | `PK(request_id, organization_id, uploader_id, upload_key)` and partial unique index `WHERE state='pending'` | Two-phase receipt table (`prepare` → `beginExecute` → `finalizeExecute`) guaranteeing at most one unsettled upload per request and tenant. |

Migration `20261203000100-snake-case-rls-attachments-uploads.js` binds the `lattice_tenant_isolation` policy to both tables with `{ orgColumn: 'organization_id' }`. In `native-request-attachments.js`, every handler opens a transaction with `setTransactionRlsOrg` and acquires a row lock on the parent `latticeRequests` row (`LOCK.SHARE` for reads, `LOCK.UPDATE` for uploads and submission) so files cannot be attached after a request leaves `'draft'`.

```sql
CREATE TABLE IF NOT EXISTS lattice_native_request_uploads (
  request_id      bigint NOT NULL REFERENCES "latticeRequests"(id) ON DELETE CASCADE,
  organization_id varchar(255) NOT NULL,
  uploader_id     bigint NOT NULL,
  upload_key      uuid NOT NULL,
  filename        varchar(200) NOT NULL,
  content_digest  char(64) NOT NULL,
  state           text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'complete', 'failed')),
  attempts        integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  result          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, organization_id, uploader_id, upload_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS lattice_native_one_pending_upload
  ON lattice_native_request_uploads (request_id, organization_id)
  WHERE state = 'pending';
```

## Dynamic `latticeCustom*` Collections and Rich Schema

Platform administrators and App Builder 2.0 extend the data model at runtime through `dxosBuilder:createDomain` or the `dxos_extend_collection_schema` tool. Naming, indexing, and tenant isolation are enforced before any DDL runs:

<ApiEndpoint
  method="POST"
  path="/api/dxosBuilder:createDomain"
  auth="Bearer JWT | ldx_pat_*"
  scope="write (rootOnly)"
  summary="Creates a dynamic latticeCustom* collection with non-null organizationId, FORCE RLS, safe index naming, and default role actions."
/>

Every dynamic collection enforces four invariants defined in `plugins/nocobase/plugin-dxos-studio/src/server/domain-schema-rls.js`:

1. Collection names must match `^latticeCustom[A-Z][A-Za-z0-9]{1,40}$` and cannot collide with `SYSTEM_PROTECTED_COLLECTIONS`.
2. The builder injects a non-null `organizationId` column, generates a PostgreSQL-safe index name (`idx_<col>_org` truncated with an 8-hex SHA-256 suffix under 63 characters via `buildSafePgIndexName`), applies `ENABLE` + `FORCE ROW LEVEL SECURITY`, and verifies the flags in `pg_class` (`attachAndVerifyPgRls`).
3. Twelve field types are supported: `string`, `text`, `integer`, `float`, `boolean`, `date`, `datetime`, `json` (`jsonb`), `belongsTo`, `hasOne`, `belongsToMany`, and `formula`. Declaring `belongsToMany` pre-provisions an RLS-protected join table named `latticeCustom<Src><Tgt>Join`.
4. Validation specs (`required`, org-scoped `unique` returning `409`, `min`, `max`, `enum` up to `100` items, and `pattern`) are stored in `uiSchema['x-validation']` and evaluated on `beforeValidate` and `beforeSave`. Regex `pattern` rules compile into a **linear-time Thompson NFA** (`rich-schema.js`) that rejects backreferences, lookbehinds, and nested ReDoS quantifiers (`256`-char pattern cap, quantifier cap `100`, max `512` NFA states).

## Safe AST Formula Engine Overview

Computed `formula` fields evaluate server-side before persistence using a pure JavaScript recursive-descent tokenizer, parser, and AST evaluator in `rich-schema.js`. Dynamic code evaluation (`eval`, `new Function`) is never invoked.

<ParamGrid
  title="Safe AST Formula Engine Guardrails (rich-schema.js)"
  :items="[
    { name: 'MAX_FORMULA_LENGTH', type: 'integer', default: '1000', description: 'Maximum character length permitted for a formula expression string.' },
    { name: 'MAX_FORMULA_TOKENS', type: 'integer', default: '256', description: 'Maximum token count emitted by the lexical scanner.' },
    { name: 'MAX_FORMULA_DEPTH', type: 'integer', default: '24', description: 'Maximum recursive AST nesting depth allowed during parsing and evaluation.' },
    { name: 'formulaReturnType', type: 'enum', default: 'float', description: 'Permitted output coercion types: float, integer, string, or boolean.' },
    { name: 'BLOCKED_FORMULA_IDENTIFIERS', type: 'Set<string>', default: '15 identifiers', description: 'Blocks __proto__, constructor, prototype, global, globalThis, process, require, module, exports, Function, eval, Proxy, Reflect, window, self.' }
  ]"
/>

The evaluator supports arithmetic, comparison, logical, and ternary operators (`+`, `-`, `*`, `/`, `%`, `!`, `?:`, `&&`, `||`, `==`, `===`, `!=`, `!==`, `<`, `<=`, `>`, `>=`) plus 22 built-in `FORMULA_FUNCTIONS`:

| Function Group | Count | Supported Functions |
| :--- | :---: | :--- |
| Math | 8 | `ROUND`, `ABS`, `CEIL`, `FLOOR`, `MIN`, `MAX`, `POW`, `SQRT` |
| Conditional and Null | 3 | `COALESCE`, `IF`, `ISNULL` |
| String | 6 | `CONCAT`, `UPPER`, `LOWER`, `TRIM`, `LEN`, `SUBSTR` |
| Date and Time | 5 | `NOW`, `YEAR`, `MONTH`, `DAY`, `DATEDIFF_DAYS` |

```json
{
  "name": "coldLineTotal",
  "title": "Temperature-Controlled Line Total",
  "type": "formula",
  "formulaReturnType": "float",
  "formulaExpression": "ROUND(IF(qty > 0, qty * unitPrice, 0), 2)"
}
```

## Related

- [Multi-Tenancy and PostgreSQL 16 FORCE RLS](/en/architecture/multi-tenancy-rls)
- [Custom Collections and Safe AST Formulas](/en/studio/custom-collections-formulas)
- [Events, Transactional Outbox and Valkey PubSub](/en/architecture/events-and-outbox)
- [REST API Reference](/en/reference/rest-api)
