---
title: Unified Tools Reference (20 Enterprise + 4 IT/OT MCP Tools)
description: Complete technical reference for all 20 Unified Tools and 4 dedicated IT/OT MCP tools in LatticeDX, including input schemas, RBAC scopes, and safety guardrails.
---

# Unified Tools Reference (20 Enterprise + 4 IT/OT MCP Tools)

Internal AI profiles and external MCP clients interact with LatticeDX through **20 Unified Tools** (`createDxosTools()` in `ai-tools-core.js`) and **4 Dedicated IT/OT MCP Tools** (`createItOtMcpTools()` in `mcp-itot-tools.js`). Every tool is wrapped by `createAuditedTool`, enforcing a uniform security, validation, and audit pipeline on every invocation.

## Audited Execution Pipeline (`createAuditedTool`)

Each tool call passes through six ordered gates:

| Gate | Control Stage | Enforcement Behavior |
| :---: | :--- | :--- |
| `1` | Identity & tenant resolution (`resolveActorScope`) | Requires an authenticated caller; non-admin users must map to an active `latticeEmployees` record with a valid `organizationId`. |
| `2` | Privilege & profile check | Tools with `adminOnly: true` fail with `403 DXOS_ADMIN_REQUIRED` unless the caller holds `root`, `admin`, `allowConfigure: true`, or `pm.*`. When invoked under a `latticeAiProfiles` identity, tools marked `OFF` return `403 TOOL_PERMISSION_OFF`. |
| `3` | Persistent quota check (`checkAndConsumeAiQuotaPersistent`) | Enforces daily organization and per-user call, token, and USD limits prior to execution (skipped on HITL-approved replays). |
| `4` | Schema validation (`defineToolSchema`) | Validates required arguments, types, enums, and string bounds, rejecting invalid payloads with `400 TOOL_ARGS_INVALID`. |
| `5` | Tenant RLS execution (`runWithTenantRls`) | Binds transaction-local `app.current_org` for PostgreSQL `FORCE ROW LEVEL SECURITY` (except App Builder `ORCHESTRATOR_OPS`, which manage per-stage RLS transactions). |
| `6` | PII redaction & audit logging (`recordAiAuditLog`) | Masks sensitive keys and PII patterns in arguments and outputs, records token/cost metrics, and writes an audit entry to `latticeAiAuditLogs`. |

## Group 1: Schema & Portal Builder Tools (5 tools · `adminOnly: true`)

### `dxos_inspect_architecture`

Inspects live portals (`/p/*`), pages, `lattice*` business collections, active workflows, roles, and AI profiles. Tool default permission: `ALLOW`; requires administrator privileges.

<ParamGrid
  title="dxos_inspect_architecture Parameters"
  :items="[
    { name: 'portalSlug', type: 'string', description: 'Optional portal slug (max 40 chars, ^[a-z0-9][a-z0-9-]{1,39}$) to return gridUid and blockUids.' }
  ]"
/>

### `dxos_compose_page_blocks`

Inspects, inserts inline blocks (12 Native v2 BlockModels or formal `flowSurfaces` blocks), sets multi-column grids, applies deep block settings, reorders, or removes blocks on a portal page. Tool default permission: `ASK`; automatically captures a `latticeUiSnapshots` backup prior to mutation and blocks `SYSTEM_PROTECTED_COLLECTIONS`.

<ParamGrid
  title="dxos_compose_page_blocks Parameters"
  :items="[
    { name: 'action', type: 'string', default: 'addBlock', description: 'One of: addBlock, listBlocks, composePageBlueprint, updateBlock, reorderBlocks, setGridLayout, configureNativeBlock, removeBlock.' },
    { name: 'portalSlug', type: 'string', required: true, description: 'Target portal slug (max 40 chars).' },
    { name: 'pageTitle', type: 'string', description: 'Optional page title filter (max 100 chars).' },
    { name: 'groupTitle', type: 'string', description: 'Navigation group title for composePageBlueprint.' },
    { name: 'blockUid', type: 'string', description: 'Target block UID for updateBlock, configureNativeBlock, or removeBlock.' },
    { name: 'blockUse', type: 'string', description: 'Allowed BlockModel class or flowSurfaces key (12 Dxos*BlockModel, NativeTableBlock, table, kanban, chart, filterForm, etc.).' },
    { name: 'title', type: 'string', description: 'Block or page title.' },
    { name: 'collection', type: 'string', description: 'Target collection name for data-bound blocks.' },
    { name: 'fields', type: 'array<string>', description: 'Field list for inline addBlock.' },
    { name: 'tableFields', type: 'array<string>', description: 'Table columns for composePageBlueprint.' },
    { name: 'includeCreateForm', type: 'boolean', default: 'false', description: 'Adds a Native createForm block in composePageBlueprint.' },
    { name: 'dxosBlocks', type: 'array<object>', description: 'Array of { blockUse, title, config } blocks attached in composePageBlueprint.' },
    { name: 'orderedBlockUids', type: 'array<string>', description: 'Ordered block UID array for reorderBlocks.' },
    { name: 'placeBesideBlockUid', type: 'string', description: 'Existing block UID to share a [12, 12] two-column row during addBlock.' },
    { name: 'rowsLayout', type: 'array<object>', description: 'Multi-column row layout array for setGridLayout (row span sum <= 24).' },
    { name: 'surfaceAction', type: 'string', description: 'flowSurfaces action: addField, addAction, addRecordAction, updateSettings, setFieldLinkageRules, setFieldValueRules.' },
    { name: 'surfacePayload', type: 'object', description: 'Payload passed to flowSurfaces for configureNativeBlock.' },
    { name: 'config', type: 'object', description: 'Block configuration overrides object.' },
    { name: 'configJson', type: 'string', description: 'JSON string of block configuration overrides (max 4000 chars).' },
    { name: 'roleNames', type: 'array<string>', description: 'ldx_* roles granted visibility on newly created page routes.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Previews changes without writing to the database.' }
  ]"
/>

### `dxos_manage_portal_and_acl`

Creates or updates `/p/<slug>` portal layouts and grants or revokes desktop route visibility for business roles. Tool default permission: `ASK`; filters `roleNames` with `isBusinessRoleName` to block `root`, `admin`, `anonymous`, `member`, `ldx_sysadmin`, `ldx_connector`, and `r_*` roles.

<ParamGrid
  title="dxos_manage_portal_and_acl Parameters"
  :items="[
    { name: 'operation', type: 'string', default: 'grant', description: 'Operation: grant or revoke.' },
    { name: 'slug', type: 'string', required: true, description: 'Portal slug matching ^[a-z0-9][a-z0-9-]{1,39}$.' },
    { name: 'title', type: 'string', description: 'Portal display title (max 100 chars).' },
    { name: 'roleNames', type: 'array<string>', description: 'Target ldx_* business role names.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Previews changes without DB writes.' }
  ]"
/>

### `dxos_extend_collection_schema`

Inspects or creates `latticeCustom*` collections, appends fields (12+ types, `belongsTo`/`hasMany`/`hasOne`/`belongsToMany` relations, Safe AST formulas, Thompson NFA regex validation), updates field metadata, or non-destructively deprecates fields (`deprecateField`). Tool default permission: `ASK`; rejects `SYSTEM_PROTECTED_COLLECTIONS` (`403 SYSTEM_COLLECTION_FORBIDDEN`), blocks prototype pollution, and enforces `FORCE ROW LEVEL SECURITY` on all custom and join tables.

<ParamGrid
  title="dxos_extend_collection_schema Parameters"
  :items="[
    { name: 'operation', type: 'string', required: true, description: 'One of: createCollection, addFields, inspectCollection, updateFieldMeta, deprecateField.' },
    { name: 'collectionName', type: 'string', required: true, description: 'Target collection; createCollection requires ^latticeCustom[A-Z][A-Za-z0-9]{1,40}$.' },
    { name: 'title', type: 'string', description: 'Collection or field display title.' },
    { name: 'fieldName', type: 'string', description: 'Target field for updateFieldMeta or deprecateField (core fields id, organizationId, createdAt, updatedAt are protected).' },
    { name: 'uiSchema', type: 'object', description: 'uiSchema updates for updateFieldMeta.' },
    { name: 'enumValues', type: 'array<string>', description: 'Updated enum options for updateFieldMeta.' },
    { name: 'reason', type: 'string', description: 'Deprecation note stored when operation=deprecateField.' },
    { name: 'fields', type: 'array<object>', description: 'Field specs ({ name, type, title, enumValues, target, through, foreignKey, otherKey, formulaExpression, formulaReturnType, validation, required, unique }).' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Previews normalized fields without DB writes.' }
  ]"
/>

### `dxos_manage_rbac_permissions`

Inspects or creates `ldx_*` roles, grants granular resource/action/scope permissions, locks writable fields (`lockFields`), or revokes grants on `dataSourcesRolesResources`. Tool default permission: `ASK`; rejects non-business role names (`ROLE_TARGET_FORBIDDEN`) and system collections (`SYSTEM_COLLECTION_FORBIDDEN`).

<ParamGrid
  title="dxos_manage_rbac_permissions Parameters"
  :items="[
    { name: 'operation', type: 'string', required: true, description: 'One of: inspectRole, ensureCustomRole, grantResource, lockFields, revokeResource.' },
    { name: 'roleName', type: 'string', required: true, description: 'Business role name matching ^ldx_[a-z][a-z0-9_]{1,40}$.' },
    { name: 'title', type: 'string', description: 'Display title for ensureCustomRole.' },
    { name: 'cloneFromRole', type: 'string', description: 'Optional ldx_* source role to clone grants and routes from.' },
    { name: 'collectionName', type: 'string', description: 'Target collection for grantResource, lockFields, or revokeResource.' },
    { name: 'actions', type: 'array<string>', description: 'Permitted actions: view, create, update, destroy, export.' },
    { name: 'readableFields', type: 'array<string>', description: 'Fields exposed on view action.' },
    { name: 'writableFields', type: 'array<string>', description: 'Candidate fields for create/update before lockedFields filtering.' },
    { name: 'lockedFields', type: 'array<string>', description: 'Fields stripped from create and update grants.' },
    { name: 'hideLockedFromView', type: 'boolean', default: 'false', description: 'Also strips lockedFields from view action when true.' },
    { name: 'scopeMode', type: 'string', default: 'all_in_org', description: 'Row visibility scope: all_in_org, own, or own_draft.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Previews changes without DB writes.' }
  ]"
/>

## Group 2: Flow, DMN & Stock n8n Tools (2 tools · `adminOnly: true`)

### `dxos_deploy_workflow`

Installs standard NocoBase workflow templates or the `ai-incident-triage` rule for an organization, automatically resolving role assignees from `latticeEmployees`. Tool default permission: `ASK`.

<ParamGrid
  title="dxos_deploy_workflow Parameters"
  :items="[
    { name: 'templateKey', type: 'string', required: true, description: 'One of: procurement, logistics-5step, incident-uc2, internal-service, ai-incident-triage.' },
    { name: 'organizationId', type: 'string', description: 'Target organizationId (defaults to caller org).' },
    { name: 'enabled', type: 'boolean', default: 'true', description: 'Enables the workflow immediately upon installation.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Resolves crew bindings without creating the workflow.' }
  ]"
/>

### `dxos_configure_workflow`

Unified control tool across four automation subsystems: NocoBase Workflows (`inspectWorkflow`, `updateNodeConfig`, `addNode`, `buildCustomWorkflow`, `toggleWorkflow`), LatticeFlow v2 DAG (`listAutomations`, `runAutomation`, `suggestAutomation`, `draftAutomation`, `patchAutomation`, `saveAutomation`, `testAutomation`, `resumeAutomation`), Visual DMN (`dmn_list_tables`, `dmn_save_table`, `dmn_evaluate`), and Stock `n8n` REST API v1 + Connector Vault (`listConnectors`, `testConnector`, `invokeN8n`, `list_n8n_workflows`, `create_n8n_workflow`, `update_n8n_workflow`, `activate_n8n_workflow`, `list_n8n_executions`, `retry_n8n_execution`, `sync_n8n_credential`, `list_connected_apps`). Tool default permission: `ASK`; blocks prototype pollution, unsafe `${...}` expressions, and `SYSTEM_PROTECTED_COLLECTIONS`.

<ParamGrid
  title="dxos_configure_workflow Key Parameters"
  :items="[
    { name: 'operation', type: 'string', required: true, description: 'One of 27 supported operations across Workflow v1, LatticeFlow v2, DMN, and Stock n8n.' },
    { name: 'ruleKey', type: 'string', description: 'LatticeFlow v2 rule key matching ^[a-z0-9][a-z0-9_-]{1,62}$.' },
    { name: 'graphJson', type: 'object', description: 'LatticeFlow v2 DAG object ({ version: 2, nodes, edges, settings }).' },
    { name: 'runUid', type: 'string', description: 'Suspended automation run UID for resumeAutomation.' },
    { name: 'decision', type: 'string', description: 'HITL decision for resumeAutomation: approved or rejected.' },
    { name: 'tableKey', type: 'string', description: 'DMN decision table key for dmn_list_tables, dmn_save_table, or dmn_evaluate.' },
    { name: 'hitPolicy', type: 'string', description: 'DMN hit policy (FIRST or COLLECT via AI configurator).' },
    { name: 'connectorKey', type: 'string', description: 'Vault connector key (e.g. n8n-enterprise-orchestrator).' },
    { name: 'workflowId', type: 'string', description: 'NocoBase or Stock n8n workflow ID.' },
    { name: 'workflow', type: 'object', description: 'Stock n8n workflow JSON payload for create_n8n_workflow / update_n8n_workflow.' },
    { name: 'apply', type: 'boolean', default: 'false', description: 'Commits Flow Architect mutations only when explicitly set to true.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Simulates execution without DB or external writes.' }
  ]"
/>

## Group 3: Surface, Creative Studio & App Builder 2.0 Tools (4 tools · `adminOnly: true`)

### `dxos_recommend_page_blueprint`

Inspects a collection's field metadata (or infers the primary collection from `portalSlug`) and proposes a `DxosCreativeStudioBlockModel` blueprint, standard blocks, and multi-column grid layout. Tool default permission: `ALLOW`.

<ParamGrid
  title="dxos_recommend_page_blueprint Parameters"
  :items="[
    { name: 'collectionName', type: 'string', description: 'Collection to inspect; auto-inferred from portalSlug when omitted.' },
    { name: 'portalSlug', type: 'string', description: 'Target portal slug.' },
    { name: 'pageTitle', type: 'string', description: 'Optional page title for collection inference.' },
    { name: 'targetRole', type: 'string', default: 'ldx_employee', description: 'Target role used to tailor pipeline stages and theme.' },
    { name: 'goal', type: 'string', description: 'Business goal guiding widget selection.' }
  ]"
/>

### `dxos_design_creative_block`

Generates and places a guardrailed `DxosCreativeStudioBlockModel` (supporting 5 themes and 11 widget types including `gauge`, `thermometer`, `rule-callout`, `stage-pipeline`, `distribution-bars`, and `quick-actions`) from an explicit DSL or natural-language goal. Supports `[12, 12]` two-column placement via `placeBesideTitle`. Tool default permission: `ASK`; captures a Time-Machine snapshot before mutation and enforces `isSafeLocalPath` on navigation buttons.

<ParamGrid
  title="dxos_design_creative_block Parameters"
  :items="[
    { name: 'portalSlug', type: 'string', required: true, description: 'Target portal slug.' },
    { name: 'pageTitle', type: 'string', description: 'Target page title on the portal.' },
    { name: 'blockUid', type: 'string', description: 'Existing Creative block UID when updating.' },
    { name: 'placeBesideBlockUid', type: 'string', description: 'Existing block UID to share a [12, 12] row.' },
    { name: 'placeBesideTitle', type: 'string', description: 'Natural-language title hint to locate an adjacent block.' },
    { name: 'collectionName', type: 'string', description: 'Primary query collection.' },
    { name: 'title', type: 'string', description: 'Block display title.' },
    { name: 'theme', type: 'string', description: 'One of: industrial-cockpit, emerald-ops, amber-alert, royal-indigo, clean-light.' },
    { name: 'goal', type: 'string', description: 'Natural-language specification of metrics, thresholds, alerts, and actions.' },
    { name: 'blueprint', type: 'object', description: 'Explicit Creative DSL ({ title, subtitle, badge, theme, columns, queries, widgets }).' },
    { name: 'blueprintJson', type: 'string', description: 'JSON string version of blueprint (max 8000 chars).' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Previews synthesized blueprint without DB writes.' }
  ]"
/>

### `dxos_snapshot_or_rollback_page`

Captures, lists, or restores page layouts stored in `latticeUiSnapshots`. Tool default permission: `ASK`; blocks cross-organization rollback (`DXOS_ORG_MISMATCH`) for non-root administrators.

<ParamGrid
  title="dxos_snapshot_or_rollback_page Parameters"
  :items="[
    { name: 'action', type: 'string', required: true, description: 'Operation: snapshot, listSnapshots, or rollback.' },
    { name: 'portalSlug', type: 'string', required: true, description: 'Target portal slug.' },
    { name: 'pageTitle', type: 'string', description: 'Optional page title filter.' },
    { name: 'snapshotUid', type: 'string', description: 'Specific snapshot UID to restore (defaults to latest when omitted).' },
    { name: 'note', type: 'string', description: 'Note recorded when creating a manual snapshot.' }
  ]"
/>

### `dxos_provision_role_workspace`

Dual-mode orchestrator: provisions a single role, page, and dedicated AI assistant (`operation: "provision_role_workspace"`) or executes the full App Builder 2.0 lifecycle (`plan_enterprise_app`, `build_enterprise_app`, `patch_enterprise_app`, `rollback_enterprise_app`, `verify_app`, `list_built_apps`, `rebuild_enterprise_app`, `export_app_bundle`, `teardown_built_app`). Tool default permission: `ASK`; see [App Builder 2.0](/en/ai/app-builder) for full lifecycle details.

<ParamGrid
  title="dxos_provision_role_workspace Core Parameters"
  :items="[
    { name: 'operation', type: 'string', default: 'provision_role_workspace', description: '10 operations: provision_role_workspace plus 9 App Builder 2.0 orchestrator ops.' },
    { name: 'appKey', type: 'string', description: 'Application key for plan, patch, rollback, verify, rebuild, export, and teardown.' },
    { name: 'collections', type: 'array<object>', description: 'Multi-entity latticeCustom* collection definitions (sorted by Kahn algorithm).' },
    { name: 'roles', type: 'array<object>', description: 'Scoped ldx_* roles and lockedFields.' },
    { name: 'portals', type: 'array<object>', description: 'Portal pages (/p/<portalSlug>) and 12 Native v2 BlockModels.' },
    { name: 'patch', type: 'object', description: 'Incremental patch spec for plan_enterprise_app / patch_enterprise_app.' },
    { name: 'prompt', type: 'string', description: 'Natural-language prompt for planning or patching (max 2000 chars).' },
    { name: 'targetVersion', type: 'integer', description: 'Target snapshot version for rollback_enterprise_app.' },
    { name: 'keepData', type: 'boolean', default: 'true', description: 'Preserves collections and rows during teardown_built_app.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Dry-run mode without DB writes.' }
  ]"
/>

## Group 4: Operational & HITL Tools (6 tools · `adminOnly: false`)

All six operational tools enforce `dataSourcesRolesResources` RBAC policies for the caller's role, row-level ownership (`ownOnlySet`), and tenant `organizationId` isolation.

### `dxos_search_enterprise_context`

Executes hybrid RRF search across business collections (`latticeOrders`, `latticeRequests`, `latticeServiceTickets`, `latticeIncidentCases`, `latticeAssets`, `latticeParaDocuments`), dynamic `latticeCustom*` collections, P.A.R.A. vector chunks (`latticeParaChunks`), and persistent memories (`scope: "ai_memory"`). Tool default permission: `ALLOW`; blocks non-admin access to `agent` memory or forged `agentId` values.

<ParamGrid
  title="dxos_search_enterprise_context Parameters"
  :items="[
    { name: 'query', type: 'string', description: 'Search keyword (max 120 chars).' },
    { name: 'collections', type: 'array<string>', description: 'Subset of searchable business or latticeCustom* collections.' },
    { name: 'scope', type: 'string', description: 'Set to ai_memory to search latticeAiMemory directly.' },
    { name: 'scopes', type: 'array<string>', description: 'Memory scopes when scope=ai_memory (org, user, session, or agent for admins).' },
    { name: 'memoryScope', type: 'string', description: 'Single memory scope filter.' },
    { name: 'agentId', type: 'string', description: 'Target agent identifier (admin-only when overriding).' },
    { name: 'includeMemories', type: 'boolean', description: 'Attaches advisory recalled memories alongside collection results.' },
    { name: 'limit', type: 'integer', default: '8', description: 'Maximum items returned (clamped 1..30).' }
  ]"
/>

### `dxos_execute_record_action`

Creates or updates records in `WRITABLE_BUSINESS_COLLECTIONS` (`latticeServiceTickets`, `latticeOrders`, `latticeRequests`, `latticeParaDocuments`) or `latticeCustom*`. Tool default permission: `ASK` (enqueues a `latticeAiApprovalQueue` HITL item with `diffPreview` and `riskLevel`); strips 12 `PROTECTED_SERVER_FIELDS` (`id`, `createdAt`, `updatedAt`, `organizationId`, `status`, `version`, `requesterId`, `assigneeId`, `ownerId`, `decisionReason`, `resolutionNote`, `handlerId`), validates field-level RBAC, and restricts non-managers to updating only their own `draft` records.

<ParamGrid
  title="dxos_execute_record_action Parameters"
  :items="[
    { name: 'collection', type: 'string', required: true, description: 'Target collection in WRITABLE_BUSINESS_COLLECTIONS or latticeCustom*.' },
    { name: 'operation', type: 'string', required: true, description: 'Write operation: create or update.' },
    { name: 'recordId', type: 'integer', description: 'Numeric record ID required when operation=update.' },
    { name: 'values', type: 'object', required: true, description: 'Field values to write (protected server fields are stripped).' },
    { name: 'requireApproval', type: 'boolean', default: 'false', description: 'Forces HITL queue insertion even when profile grants ALLOW.' }
  ]"
/>

### `dxos_my_workflow_tasks`

Lists, analyzes, or submits pending (`status: 0`) `workflowManualTasks` assigned to the caller. Tool default permission: `ASK`; enforces ownership (`403 TASK_NOT_ASSIGNED_TO_CALLER`) and blocks self-approval of tasks whose workflow execution was initiated by the caller (`403 SELF_APPROVAL_FORBIDDEN`).

<ParamGrid
  title="dxos_my_workflow_tasks Parameters"
  :items="[
    { name: 'action', type: 'string', required: true, description: 'Operation: list, analyze, or submit.' },
    { name: 'taskId', type: 'integer', description: 'Task ID required when action=submit.' },
    { name: 'formKey', type: 'string', default: 'review', description: 'Form key for task submission.' },
    { name: 'decision', type: 'string', default: 'approve', description: 'Submission decision string.' },
    { name: 'note', type: 'string', description: 'Optional review or handover note.' }
  ]"
/>

### `dxos_orchestrate_enterprise_case`

Runs an organization-wide bottleneck scan (`radar`), correlates assets, SOPs, incidents, and tickets (`correlateCase`), or creates a linked multi-record response (`executeCoordinatedResponse`) spanning a primary record, a `latticeServiceTickets` follow-up, and a `latticeParaDocuments` handover note. Tool default permission: `ASK`; all reads and writes enforce collection-level and field-level RBAC.

<ParamGrid
  title="dxos_orchestrate_enterprise_case Parameters"
  :items="[
    { name: 'mode', type: 'string', required: true, description: 'Mode: radar, correlateCase, or executeCoordinatedResponse.' },
    { name: 'query', type: 'string', description: 'Correlation search string for correlateCase.' },
    { name: 'primaryRecord', type: 'object', description: 'Object { collection, values } for the primary operational or custom record.' },
    { name: 'followUpTicket', type: 'object', description: 'Optional latticeServiceTickets payload linked to primaryRecord.' },
    { name: 'paraHandoverNote', type: 'object', description: 'Optional latticeParaDocuments handover payload.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Previews planned record creations without DB writes.' }
  ]"
/>

### `dxos_graph_impact_analysis`

Traverses `latticeDataLineage` and structural cold-chain relationships (`latticeAssets`, `latticeIncidentCases`, `latticeTwinShadows`, `latticeStockLots`, `latticeOrderLines`, `latticeOrders`, `latticeEpodRecords`, `latticeParaDocuments`) via BFS to compute `impactScore`, `[collection:code#id]` citations, and optional telemetry. Tool default permission: `ALLOW`; bounded by `MAX_GRAPH_DEPTH = 4` and `MAX_GRAPH_NODES = 60`, enforces RBAC on every traversed collection, and redacts PII before returning.

<ParamGrid
  title="dxos_graph_impact_analysis Parameters"
  :items="[
    { name: 'collection', type: 'string', required: true, description: 'Starting collection (cannot be in SYSTEM_PROTECTED_COLLECTIONS).' },
    { name: 'recordId', type: 'string', description: 'Record ID (string or integer).' },
    { name: 'recordCode', type: 'string', description: 'Business code or asset URN (urn:ngsi-ld:Asset:<org>:native:<id>).' },
    { name: 'maxDepth', type: 'integer', default: '2', description: 'BFS traversal depth bounded to 1..4.' },
    { name: 'includeTelemetry', type: 'boolean', default: 'false', description: 'Includes up to 20 latticeTelemetryPoints rows if readable.' }
  ]"
/>

### `dxos_alarm_action`

Acknowledges (`ack`) or clears (`clear`) active alarms in `latticeIncidentCases`. Tool default permission: `ASK`; routes through `ai-hitl-executors.js`, requires `update` RBAC permission on `latticeIncidentCases`, and clamps closure notes to 255 characters.

<ParamGrid
  title="dxos_alarm_action Parameters"
  :items="[
    { name: 'action', type: 'string', required: true, description: 'Action: ack or clear.' },
    { name: 'alarmId', type: 'integer', description: 'Numeric alarm ID in latticeIncidentCases.' },
    { name: 'alarmCode', type: 'string', description: 'Optional alarm code (INC-... or ALM-...).' },
    { name: 'assetEntityId', type: 'string', description: 'Optional asset entity URN/ID.' },
    { name: 'note', type: 'string', description: 'Acknowledgement or closure note.' },
    { name: 'requireApproval', type: 'boolean', default: 'false', description: 'Forces HITL queue insertion.' }
  ]"
/>

## Group 5: Persistent Agent Memory Tools (3 tools · `adminOnly: false`)

Memories in `latticeAiMemory` are partitioned by `organizationId` and four scopes (`org`, `agent`, `user`, `session`). Mutating `org` memory or accessing/mutating `agent` memory requires administrator privileges (`403 MEMORY_ORG_WRITE_FORBIDDEN` / `403 MEMORY_AGENT_FORBIDDEN`). Recalled memories are wrapped inside `<dxos_memory_context advisory="true">` tags with delimiter stripping to prevent prompt injection.

### `dxos_memory_remember`

Creates or upserts a factual memory entry keyed by `memoryKey` within the target partition. Tool default permission: `ALLOW`.

<ParamGrid
  title="dxos_memory_remember Parameters"
  :items="[
    { name: 'scope', type: 'string', default: 'org', description: 'Partition scope: org, agent, user, or session.' },
    { name: 'memoryKey', type: 'string', required: true, description: 'Stable logical key for upsert/lookup (max 200 chars).' },
    { name: 'content', type: 'string', required: true, description: 'Factual content to store (max 8000 chars).' },
    { name: 'tags', type: 'array<string>', description: 'Searchable tags (max 32 items).' },
    { name: 'metadata', type: 'object', description: 'Structured metadata JSON object.' },
    { name: 'importance', type: 'number', default: '0.5', description: 'Importance weight in [0, 1].' },
    { name: 'source', type: 'string', default: 'agent', description: 'Source label (max 120 chars).' },
    { name: 'expiresAt', type: 'string', description: 'Optional ISO-8601 expiry timestamp.' },
    { name: 'ttlSeconds', type: 'integer', description: 'Optional TTL in seconds from now.' },
    { name: 'agentId', type: 'string', description: 'Agent identifier when scope=agent.' },
    { name: 'sessionId', type: 'string', description: 'Session identifier when scope=session.' }
  ]"
/>

### `dxos_memory_recall`

Retrieves non-expired memories ranked by TF-IDF cosine similarity, keyword coverage, tag overlap, importance, and exponential recency decay (30-day half-life). Tool default permission: `ALLOW`.

<ParamGrid
  title="dxos_memory_recall Parameters"
  :items="[
    { name: 'query', type: 'string', description: 'Search query text (max 1000 chars).' },
    { name: 'scope', type: 'string', description: 'Single partition scope: org, agent, user, or session.' },
    { name: 'scopes', type: 'array<string>', description: 'Array of authorized scopes to search.' },
    { name: 'tags', type: 'array<string>', description: 'Optional tag filter.' },
    { name: 'limit', type: 'integer', default: '8', description: 'Maximum results returned (1..50).' },
    { name: 'minScore', type: 'number', description: 'Minimum relevance threshold in [0, 1].' },
    { name: 'agentId', type: 'string', description: 'Agent identifier when searching agent scope.' },
    { name: 'sessionId', type: 'string', description: 'Session identifier when searching session scope.' }
  ]"
/>

### `dxos_memory_forget`

Deletes a memory record by `id` or `memoryKey` strictly inside the caller's organization and authorized scope. Tool default permission: `ASK`.

<ParamGrid
  title="dxos_memory_forget Parameters"
  :items="[
    { name: 'id', type: 'integer', description: 'Numeric ID of the latticeAiMemory row.' },
    { name: 'memoryKey', type: 'string', description: 'Logical memoryKey to delete within scope.' },
    { name: 'scope', type: 'string', default: 'org', description: 'Partition scope: org, agent, user, or session.' },
    { name: 'agentId', type: 'string', description: 'Agent identifier when scope=agent.' },
    { name: 'sessionId', type: 'string', description: 'Session identifier when scope=session.' }
  ]"
/>

## Group 6: 4 Dedicated IT/OT MCP Tools (`/api/dxos-mcp/it-ot`)

These four tools are exposed on the IT/OT MCP endpoint (`mcp-itot-tools.js`) for live telemetry inspection, stack connector probes, and controlled downlink/outbox dispatch.

### `get_live_ngsi_telemetry`

Queries live entities from FIWARE Orion-LD (`/ngsi-ld/v1/entities?local=true&limit=50`) filtered strictly to `actor.organizationId`. Degrades gracefully (`degraded: true`) with cached `latticeAssets` and `pendingOutboxCount` if Orion-LD is unreachable. `adminOnly: false`, default permission: `ALLOW`.

<ParamGrid
  title="get_live_ngsi_telemetry Parameters"
  :items="[
    { name: 'assetCode', type: 'string', description: 'Optional asset code substring filter (max 80 chars).' }
  ]"
/>

### `get_sensor_and_incident_timeline`

Retrieves chronological `latticeIncidentCases` and `latticeAgentProposals` scoped to `actor.organizationId`, requiring RBAC read access on at least one collection. `adminOnly: false`, default permission: `ALLOW`.

<ParamGrid
  title="get_sensor_and_incident_timeline Parameters"
  :items="[
    { name: 'assetEntityId', type: 'string', description: 'Optional asset entity URN/ID filter (max 140 chars).' },
    { name: 'limit', type: 'integer', default: '10', description: 'Maximum rows per list (1..25).' }
  ]"
/>

### `get_stack_connector_health`

Probes live health with 5-second timeouts across Orion-LD (`/version`), Stock `n8n` (`/healthz`), Keycloak (`/realms/lattice`), and the NocoBase database. `adminOnly: true`, default permission: `ALLOW`, takes no arguments.

### `dispatch_itot_webhook_or_sync`

Queues an NGSI-LD replay entry in `latticeContextOutbox` (`requeue_outbox`) or triggers an allowlisted Stock `n8n` webhook (`trigger_n8n`) with an `Idempotency-Key` header. `adminOnly: false`, default permission: `ASK`; restricted to `root`, `admin`, `ldx_admin`, `ldx_manager`, and `ldx_dispatcher` (`403 ITOT_DISPATCH_FORBIDDEN`).

<ParamGrid
  title="dispatch_itot_webhook_or_sync Parameters"
  :items="[
    { name: 'mode', type: 'string', required: true, description: 'Dispatch mode: requeue_outbox or trigger_n8n.' },
    { name: 'entityId', type: 'string', description: 'Target NGSI-LD entity URN (max 140 chars).' },
    { name: 'webhookSlug', type: 'string', default: 'dxos-itot-event', description: 'n8n webhook slug matching ^[a-z0-9][a-z0-9-]{1,60}$.' },
    { name: 'reason', type: 'string', required: true, description: 'Operational reason for replay or webhook trigger (max 300 chars).' },
    { name: 'idempotencyKey', type: 'string', description: 'Optional idempotency key (auto-generated if omitted).' }
  ]"
/>

## Cross-Tool Safety Guardrails

| Guardrail | Scope | Enforcement Behavior |
| :--- | :--- | :--- |
| `SYSTEM_PROTECTED_COLLECTIONS` | Schema, RBAC, and GraphRAG tools | Rejects (`403`) mutations or graph queries targeting 41 core system tables (`users`, `roles`, `apiKeys`, `latticeAiAuditLogs`, `latticeAiProfiles`, `latticeBuiltApps`, `latticeCryptoLedger`, etc.). |
| `PROTECTED_SERVER_FIELDS` | `dxos_execute_record_action` | Strips 12 server-owned fields (`id`, `organizationId`, `status`, `version`, `requesterId`, `ownerId`, etc.) before DB writes. |
| `latticeAiApprovalQueue` (HITL) | Tools configured as `ASK` | Persists `proposedArgs` and `diffPreview` for independent human approval via `dxosAi:approveAction` (self-approval blocked). |
| `validateMcpServerUrl` | MCP endpoints & `trigger_n8n` | Blocks SSRF toward metadata, non-canonical numeric/hex hosts, and private IPs outside stack allowlists; enforces `https://` externally. |

## Related

- [AI Studio Overview & 7 Agent Profiles](/en/ai/overview-and-profiles)
- [MCP Gateway](/en/ai/mcp-gateway)
- [App Builder 2.0](/en/ai/app-builder)
- [Eval Lab & Guardrails](/en/ai/eval-and-guardrails)
