---
title: App Builder 2.0
description: Multi-entity enterprise application lifecycle in LatticeDX covering dry-run planning, topological build with self-healing verification, incremental patching, version rollback, and safe teardown.
---

<script setup>
const appBuilderTabs = [
  {
    label: 'Dry-Run Plan (POST)',
    lang: 'bash',
    code: `curl -X POST "https://app.example.com/api/dxosAi:planBuiltApp" \\
  -H "Authorization: Bearer <ADMIN_JWT_OR_PAT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Clinic management with patients, visits, and prescriptions"
  }'`,
  },
  {
    label: 'Incremental Patch (JSON)',
    lang: 'json',
    code: `{
  "appKey": "clinic-suite",
  "summary": "Add insurance code and visit fee BI chart",
  "patch": {
    "addFields": [
      {
        "collectionName": "latticeCustomClinicPatients",
        "name": "insuranceCode",
        "type": "string",
        "title": "Insurance Code",
        "unique": true
      }
    ],
    "addBlocks": [
      {
        "portalSlug": "clinic-ops",
        "blockUse": "DxosBiChartBlockModel",
        "title": "Visit Fees by Status",
        "collection": "latticeCustomClinicVisits",
        "chartType": "bar",
        "groupBy": "status",
        "metricOp": "sum",
        "metricField": "feeVnd"
      }
    ]
  }
}`,
  },
  {
    label: 'Safe Teardown (JSON)',
    lang: 'json',
    code: `{
  "appKey": "clinic-suite",
  "keepData": true
}`,
  },
];
</script>

# App Builder 2.0

App Builder 2.0 (`app-builder-planner.js` and `app-builder-orchestrator.js`) enables platform administrators and the `dxos-architect` agent to plan, build, incrementally patch, roll back, and safely tear down multi-entity enterprise modules. Every generated application is tracked as a live registry entry in `latticeBuiltApps` with version history (`versionHistoryJson`) and UI layout snapshots (`latticeUiSnapshots`), keeping PostgreSQL `FORCE ROW LEVEL SECURITY` schemas, `/p/<portalSlug>` workspaces, `ldx_*` RBAC grants, DMN decision tables, LatticeFlow v2 DAGs, and optional Stock `n8n` workflows synchronized.

All App Builder 2.0 endpoints and tool operations require `root` or `admin` privileges, restrict custom tables to the `latticeCustom*` namespace, and reject any write targeting `SYSTEM_PROTECTED_COLLECTIONS`.

## 5-Stage Lifecycle (`plan -> build -> patch -> rollback -> safe teardown`)

```text
[Prompt / Spec]
      │
      ▼
  1. PLAN (dry-run) ──► buildErGraph (Kahn) + computeSpecDiff (0 DB writes)
      │
      ▼
  2. BUILD          ──► UI Snapshot -> DDL + FORCE RLS -> RBAC -> Portal 12 Blocks -> AI/DMN/Flow/n8n -> Verify + Self-Heal (max 2 rounds)
      │
      ▼
  3. PATCH          ──► Plan Diff -> Pre-Patch Snapshot -> Non-destructive field deprecation -> Rebuild + Verify (version++)
      │
      ▼
  4. ROLLBACK       ──► Pre-Rollback Snapshot -> Restore sourceSpecJson & UI Snapshot -> Deactivate post-target rules -> Verify
      │
      ▼
  5. SAFE TEARDOWN  ──► Cross-tenant/app scan -> Deactivate Flow/DMN/AI/n8n -> Preserve data (keepData=true) or reverse-topo drop
```

### 1. Dry-Run Planning (`planEnterpriseApp`)

The planning stage executes with zero database writes (`built: false`, `dryRun: true`). It accepts a full specification (`collections`, `roles`, `portals`, `dmnTables`, `flowGraphs`), an incremental `patch`, or a natural-language `prompt` parsed via `buildDraftSpecFromNaturalPrompt` and `parseNaturalAppPlanOrPatch`.

The planner returns two inspection artifacts before any mutation occurs:

- **Topological ER Graph (`buildErGraph`):** Orders multi-entity collections with Kahn's algorithm (`topologicalSortCollections`) so `belongsTo` parent tables are created before dependents and `hasMany`/`hasOne` sources precede targets. Cycles fail early with `BLUEPRINT_CYCLE_DETECTED` (HTTP `400`).
- **8-Category Spec Diff (`computeSpecDiff`):** Computes `added`, `modified`, and `removed` entries across `collections`, `fields`, `relations`, `roles`, `pages`, `blocks`, `flows`, and `dmnTables` alongside a compact `diff.summary`.

### 2. Full-Stack Build & Self-Healing (`orchestrateEnterpriseAppBuild`)

Building an enterprise application executes eight deterministic steps:

| Step | Execution Stage | Runtime Behavior |
| :---: | :--- | :--- |
| `1` | `capturePortalsSnapshots` | Captures existing portal grids into `latticeUiSnapshots`. |
| `2` | `ensureCollectionAndFields` | Creates `latticeCustom*` tables in Kahn topological order, provisions `belongsToMany` join tables, attaches `ENABLE` + `FORCE ROW LEVEL SECURITY`, registers Safe AST formulas and Thompson NFA regex validators, and refreshes OpenAPI metadata. |
| `3` | `ensureRoleAndRbac` | Creates or updates `ldx_*` roles and applies `view`/`create`/`update`/`destroy` grants with `lockedFields` stripped from write scopes. |
| `4` | `ensurePortalAndBlocks` | Provisions `/p/<portalSlug>` routes and attaches allowlisted blocks from `ORCHESTRATOR_ALLOWED_BLOCKS` (`DxosPortalHeroBlockModel`, `DxosRecordWorkbenchBlockModel`, `DxosKanbanScheduleBlockModel`, `DxosWebGisBlockModel`, `DxosBiChartBlockModel`, `DxosCreativeStudioBlockModel`, and standard flow blocks). |
| `5` | Dedicated AI assistant | Creates a non-admin AI profile scoped to the provisioned role and portal, synced to `aiEmployees`. |
| `6` | DMN, LatticeFlow v2 & Stock n8n | Persists `latticeDecisionTables`, `latticeAutomationRules`, and optional Stock `n8n` workflows (executed strictly outside DB transactions). |
| `7` | `verifyEnterpriseApp` | Probes collections, RLS enforcement, field metadata, RBAC grants, portal UI blocks, DMN evaluation, Flow v2 graphs, and `n8n` activation state. |
| `8` | `applyTargetedRepair` | Runs up to `DEFAULT_SELF_HEAL_MAX_ROUNDS = 2` automated repair passes (`ensure_collection`, `attach_rls`, `reload_collection`, `repair_rbac`, `repair_portal_ui`, `repair_dmn`, `repair_flow`, `activate_n8n`) before recording `active` or `needs_review` in `latticeBuiltApps`. |

### 3. Incremental Patching (`patchEnterpriseApp`)

Instead of recreating modules from scratch, `patchEnterpriseApp` loads `sourceSpecJson` from `latticeBuiltApps`, merges the incoming `patch` (`addCollections`, `addFields`, `updateFields`, `deprecateFields`, `addRelations`, `addBlocks`, `removeBlocks`, `addRoles`, `addFlows`, `addDmnTables`) or `prompt`, computes a dry-run diff via `planEnterpriseApp`, appends a pre-patch snapshot into `versionHistoryJson`, and executes the orchestrator.

When `deprecateFields` is requested, columns are never dropped (`ALTER TABLE ... DROP COLUMN` is prohibited). Fields are marked `deprecated: true`, `deprecatedAt`, `'x-hidden': true`, and `readOnly: true` in `uiSchema` and `options` to preserve historical records.

### 4. Version Rollback (`rollbackEnterpriseApp`)

Administrators can roll back an application to any recorded `targetVersion` in `versionHistoryJson` (defaulting to the latest snapshot):

1. Captures a pre-rollback snapshot of the current state into `versionHistoryJson`.
2. Non-destructively deprecates fields introduced after `targetVersion`.
3. Re-applies target collection metadata, `rich-schema` hooks, and RBAC grants.
4. Restores scoped UI blocks via `restorePageSnapshot` (filtering strictly by `blockUids` owned by the app) and removes post-target blocks.
5. Restores target DMN tables and Flow v2 rules while setting post-target rules to `active: false`.
6. Runs `verifyEnterpriseApp` and increments the `latticeBuiltApps` version counter.

### 5. Safe Teardown (`teardownBuiltApp`)

Teardown defaults to `keepData = true` and runs cross-tenant safety checks before removing any artifact:

| Teardown Phase | Enforcement Behavior |
| :--- | :--- |
| Cross-app & cross-org ownership scan | Queries all `latticeBuiltApps` under `withOptionalSystemRls` to identify `sharedCollections`, `sharedRoles`, and `sharedPortalPages`, while protecting `BUILTIN_PROTECTED_ROLES` (`root`, `admin`, `ldx_admin`, `ldx_manager`, `ldx_employee`, `ldx_operator`, and other core roles). |
| Non-destructive deactivation | Removes app-owned `flowModels`, cleans up exclusive desktop routes, sets Flow v2 rules and DMN tables to `active: false`, disables custom AI assistants, and deactivates Stock `n8n` workflows outside DB transactions. |
| Data cleanup when `keepData = false` | Checks `SELECT EXISTS (SELECT 1 FROM "<table>" WHERE "organizationId" IS DISTINCT FROM :organizationId)`. Shared or multi-tenant tables only delete rows matching the caller's `organizationId`; exclusive `latticeCustom*` tables are dropped in reverse topological order (join and child tables before parent tables). |

## Specification & Patch Parameters

<ParamGrid
  title="App Builder 2.0 Parameters (plan / build / patch / rollback / teardown)"
  :items="[
    { name: 'appKey', type: 'string', description: 'Unique application key in latticeBuiltApps (max 120 chars); required for patch, rollback, rebuild, and teardown.' },
    { name: 'prompt', type: 'string', description: 'Natural-language specification or edit instruction (max 2000 chars).' },
    { name: 'collections', type: 'array<object>', description: 'Multi-entity latticeCustom* collection definitions with 12+ field types, relations, formulas, and validation.' },
    { name: 'roles', type: 'array<object>', description: 'Scoped ldx_* roles and lockedFields arrays.' },
    { name: 'portals', type: 'array<object>', description: 'Portal pages (/p/<portalSlug>), creativeTheme, and 12 Native v2 BlockModels configurations.' },
    { name: 'dmnTables', type: 'array<object>', description: 'Decision tables (tableKey, hitPolicy, inputsJson, outputsJson, rulesJson).' },
    { name: 'flowGraphs', type: 'array<object>', description: 'LatticeFlow v2 DAG definitions (ruleKey, name, cooldownSec, graphJson).' },
    { name: 'patch', type: 'object', description: 'Incremental patch payload (addCollections, addFields, updateFields, deprecateFields, addRelations, addBlocks, removeBlocks, addRoles, addFlows, addDmnTables).' },
    { name: 'targetVersion', type: 'integer', description: 'Target snapshot version for rollbackBuiltApp.' },
    { name: 'keepData', type: 'boolean', default: 'true', description: 'Preserves custom collections and rows during teardownBuiltApp when true.' },
    { name: 'maxHealRounds', type: 'integer', default: '2', description: 'Maximum targeted self-heal passes after verifyEnterpriseApp.' }
  ]"
/>

## App Builder 2.0 Endpoints

All lifecycle operations are exposed through the `dxosAi` resource and mirrored via the `dxos_provision_role_workspace` Unified Tool (`plan_enterprise_app`, `build_enterprise_app`, `patch_enterprise_app`, `rollback_enterprise_app`, `verify_app`, `list_built_apps`, `rebuild_enterprise_app`, `export_app_bundle`, `teardown_built_app`).

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:planBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Runs a zero-write dry-run plan returning the Kahn topological ER graph and 8-category structural diff."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:buildBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Builds a multi-entity application end-to-end with live verification and up to 2 self-healing rounds."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:patchBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Applies an incremental spec patch, records a pre-patch snapshot, and re-verifies the module."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:rollbackBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Restores schema metadata, RBAC, UI blocks, DMN tables, and Flow v2 rules to targetVersion."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listBuiltApps"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Lists tenant applications registered in latticeBuiltApps (optional status filter: active, needs_review, torndown)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listBuiltAppVersions"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Retrieves the versionHistoryJson snapshots for a given appKey."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:rebuildBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Rebuilds an existing app from stored sourceSpecJson merged with an optional specPatch."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:exportBuiltAppBundle"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Exports a scoped Solution Bundle v3 containing only artifacts belonging to appKey with contentSha256."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:teardownBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Safely tears down app artifacts; defaults to keepData=true and protects shared tables and built-in roles."
/>

<CodeTabs :tabs="appBuilderTabs" />

## Related

- [AI Studio Overview & 7 Agent Profiles](/en/ai/overview-and-profiles)
- [Unified Tools Reference](/en/ai/unified-tools)
- [Custom Collections & Safe AST Formulas](/en/studio/custom-collections-formulas)
- [Solution Bundles v3](/en/studio/solution-bundles)
