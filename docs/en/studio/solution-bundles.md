---
title: Solution Bundles v3 & GitOps
description: JSON schema specification for latticedx.solution-bundle/v3, export/diff/dry-run import/rollback APIs, and the 6-category 43-artifact GitOps workflow in CTU-OpenPaw/lattice-templates.
---

# Solution Bundles v3 & GitOps

Solution Bundle v3 (`latticedx.solution-bundle/v3`) defines a declarative packaging format that captures an organization's operational configuration in a single SHA-256 checksummed JSON document. By stripping Vault secrets from declarative definitions, platform teams can version configuration in Git, inspect diffs, execute dry-run validation, and roll back to pre-import snapshots cleanly.

## `latticedx.solution-bundle/v3` JSON Schema

The `solution-bundle.js` module emits documents adhering to `latticedx.solution-bundle/v3` (while the importer retains backward compatibility for `v1` and `v2`). Every bundle contains a `metadata` block and eight top-level payload sections.

<ParamGrid
  title="metadata Object Fields"
  :items="[
    { name: 'schemaVersion', type: 'string', required: true, default: 'latticedx.solution-bundle/v3', description: 'Bundle schema identifier (importer accepts v1, v2, and v3).' },
    { name: 'platformVersion', type: 'string', required: true, default: '0.4.2', description: 'LatticeDX platform version that produced the bundle.' },
    { name: 'organizationId', type: 'string', required: true, description: 'Target organization identifier, or all when exported globally.' },
    { name: 'exportedAt', type: 'string', required: true, description: 'UTC ISO-8601 timestamp recorded at export time.' },
    { name: 'contentSha256', type: 'string', required: true, description: '64-character SHA-256 hex digest of JSON.stringify({ roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks, governance }).' },
    { name: 'warnings', type: 'string[]', description: 'Optional advisory messages, such as reminding operators to re-bind connector Vault secrets after import.' }
  ]"
/>

### Top-Level Payload Sections (8 Keys)

| Top-Level Key | Type | Included Artifacts and Validation Rules |
| :--- | :--- | :--- |
| `roles` | `Array<object>` | Non-system `^ldx_[a-z0-9_]{2,48}$` roles, resource action grants, and field scopes; forbids `root`, `admin`, and `ldx_admin`. |
| `portals` | `Array<object>` | Portal definitions (`^ldx-portal-[a-z0-9-]+$`), `routePath` (`/p/*`), and `routeName` (`p_*`); forbids `authCheck: false`. |
| `workflows` | `Array<object>` | LatticeFlow workflow definitions and DAG nodes (`validateWorkflowNodesDag`); imported inactive unless `enableWorkflows: true`. |
| `aiProfiles` | `Array<object>` | AI agent profiles (`username`, `systemPrompt`, `tools`, and `toolPermissions` in `ALLOW`, `ASK`, or `OFF`). |
| `customCollections` | `Array<object>` | Dynamic `^latticeCustom[A-Z][A-Za-z0-9]{1,40}$` tables, 12 field types, Thompson NFA rules, AST formulas, and auto-attached PG16 RLS. |
| `connectors` | `Array<object>` | Integration metadata stripped of all Vault secrets (`SECRET_KEY_RE`); newly created connectors default to `active: false`. |
| `routesAndBlocks` | `object` | Contains `{ routes, flowModels }`; routes sort topologically before upsert, models allowlisted via `ALLOWED_FLOW_MODEL_USES`, system layouts protected. |
| `governance` | `object` | Contains `{ decisionTables, slaPolicies, incidentRules, automationRules, webhookSubscriptions }` scoped by `organizationId`. |

<CodeTabs
  :tabs="[
    {
      label: 'coldchain-starter-bundle.v3.json',
      lang: 'json',
      code: '{\n  &quot;metadata&quot;: {\n    &quot;schemaVersion&quot;: &quot;latticedx.solution-bundle/v3&quot;,\n    &quot;platformVersion&quot;: &quot;0.4.2&quot;,\n    &quot;organizationId&quot;: &quot;org-coldchain-starter&quot;,\n    &quot;exportedAt&quot;: &quot;2026-11-26T14:55:00.000Z&quot;,\n    &quot;contentSha256&quot;: &quot;91eaddda971760c81b2c2c6d140a79e7fd9b79413388050f4ac9fb6f3e8f19d0&quot;\n  },\n  &quot;roles&quot;: [{ &quot;name&quot;: &quot;ldx_operator&quot;, &quot;allowAll&quot;: false, &quot;allowConfigure&quot;: false }],\n  &quot;portals&quot;: [],\n  &quot;workflows&quot;: [],\n  &quot;aiProfiles&quot;: [],\n  &quot;customCollections&quot;: [{ &quot;name&quot;: &quot;latticeCustomColdLotLogs&quot;, &quot;fields&quot;: [] }],\n  &quot;connectors&quot;: [],\n  &quot;routesAndBlocks&quot;: { &quot;routes&quot;: [], &quot;flowModels&quot;: [] },\n  &quot;governance&quot;: {\n    &quot;decisionTables&quot;: [],\n    &quot;slaPolicies&quot;: [],\n    &quot;incidentRules&quot;: [],\n    &quot;automationRules&quot;: [],\n    &quot;webhookSubscriptions&quot;: []\n  }\n}'
    },
    {
      label: 'Compute contentSha256 (Node.js)',
      lang: 'js',
      code: 'import { createHash } from \'node:crypto\';\nfunction computeBundleSha256(bundle) {\n  const canonicalPayload = JSON.stringify({\n    roles: bundle.roles,\n    portals: bundle.portals,\n    workflows: bundle.workflows,\n    aiProfiles: bundle.aiProfiles,\n    customCollections: bundle.customCollections,\n    connectors: bundle.connectors,\n    routesAndBlocks: bundle.routesAndBlocks,\n    governance: bundle.governance,\n  });\n  return createHash(\'sha256\').update(canonicalPayload).digest(\'hex\');\n}'
    }
  ]"
/>

## Security Guardrails and Secret Stripping

Before exporting or diffing, `stripSecretsDeep` traverses up to `48` nesting levels and removes any key matching `SECRET_KEY_RE` (`password`, `secret`, `token`, `apikey`, `api_key`, `privatekey`, `authorization`, `cookie`). `validateSolutionBundle` enforces four additional barriers:

| Guardrail | Validation Rule in `validateSolutionBundle` |
| :--- | :--- |
| Size and Structure Limits | Payloads cannot exceed `5,000,000` bytes (`5 MB`), must be JSON-serializable without cycles, and cannot contain `__proto__`, `constructor`, or `prototype` keys (checked up to depth 32). |
| Privilege Escalation Prevention | Rejects `root`, `admin`, and `ldx_admin` roles, wildcard or system permission snippets (`*`, `!`, `pm.*`, `acl.*`, `app.*`, `ui.*`), and strips admin builder tools from `aiProfiles` unless `isAdminBuilder: true`. |
| Code Injection and XSS Blocking | Rejects `UNSAFE_CODE_KEY_RE` keys (`jsCode`, `script`, `customScript`, `evalCode`, `innerHTML`, `jsSettings`, `scriptSettings`) and strings matching `<script>`, `<iframe>`, `javascript:`, `vbscript:`, or `on*=` attributes. |
| SSRF and Tenant Isolation | Validates `governance.webhookSubscriptions[].targetUrl` through `validateSafeWebhookTargetUrl` and throws HTTP `403 DXOS_ORG_MISMATCH` if any connector or governance item belongs to another organization. |

## Export, Diff, Dry-Run Import, and Rollback Endpoints

Four admin endpoints on `dxosStudio` (`studio-resource.js`) manage the bundle GitOps lifecycle:

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleExport"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Exports the target organization's live state as a latticedx.solution-bundle/v3 payload with contentSha256 (also supports GET)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleDiff"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Validates an incoming bundle against live state and returns per-section added, changed, unchanged, and removed summaries."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleImport"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Defaults to dryRun=true for non-mutating validation; when dryRun=false, saves a pre-import snapshot before applying changes transactionally."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleRollback"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Restores the latest or specified snapshotUid from latticeUiSnapshots with reconcileV3Deletions enabled."
/>

When `solutionBundleImport` runs with `dryRun: false`, the server persists the current live bundle into `latticeUiSnapshots` under `portalSlug: '__gitops_bundle__'` with a generated `snapshotUid` (`gitops-<ts36>-<rand4>`). Calling `solutionBundleRollback` restores that snapshot inside a tenant transaction with `reconcileV3Deletions: true`, removing routes, flow models, and governance records created after the snapshot while keeping `admin-layout-model` and `mobile-layout-model` untouched.

<CodeTabs
  :tabs="[
    {
      label: 'Diff -> Dry-Run -> Apply (cURL)',
      lang: 'bash',
      code: '# 1. Inspect structural diff\ncurl -s -X POST &quot;https://localhost:8443/api/dxosStudio:solutionBundleDiff&quot; \\\n  -H &quot;Authorization: Bearer $TOKEN&quot; -H &quot;Content-Type: application/json&quot; \\\n  -d \'{&quot;organizationId&quot;:&quot;org-a&quot;,&quot;bundle&quot;:...}\'\n\n# 2. Validate via dry-run (dryRun defaults to true)\ncurl -s -X POST &quot;https://localhost:8443/api/dxosStudio:solutionBundleImport&quot; \\\n  -H &quot;Authorization: Bearer $TOKEN&quot; -H &quot;Content-Type: application/json&quot; \\\n  -d \'{&quot;organizationId&quot;:&quot;org-a&quot;,&quot;dryRun&quot;:true,&quot;bundle&quot;:...}\'\n\n# 3. Apply bundle and retain snapshotUid for rollback\ncurl -s -X POST &quot;https://localhost:8443/api/dxosStudio:solutionBundleImport&quot; \\\n  -H &quot;Authorization: Bearer $TOKEN&quot; -H &quot;Content-Type: application/json&quot; \\\n  -d \'{&quot;organizationId&quot;:&quot;org-a&quot;,&quot;dryRun&quot;:false,&quot;enableWorkflows&quot;:false,&quot;bundle&quot;:...}\''
    },
    {
      label: 'Import Response Shape',
      lang: 'json',
      code: '{\n  &quot;dryRun&quot;: false,\n  &quot;valid&quot;: true,\n  &quot;warnings&quot;: [],\n  &quot;snapshotUid&quot;: &quot;gitops-m8x2a1-9f3c&quot;,\n  &quot;diff&quot;: { &quot;customCollections&quot;: { &quot;added&quot;: [&quot;latticeCustomColdLotLogs&quot;], &quot;changed&quot;: [], &quot;unchanged&quot;: [], &quot;removed&quot;: [] } },\n  &quot;applied&quot;: { &quot;rolesUpserted&quot;: 2, &quot;customCollectionsUpserted&quot;: 1, &quot;decisionTablesUpserted&quot;: 1 }\n}'
    }
  ]"
/>

## GitOps Workflow with `CTU-OpenPaw/lattice-templates`

The `CTU-OpenPaw/lattice-templates` repository curates 43 JSON artifacts across six categories under Apache-2.0, version-locked to `0.4.2`:

| Category | Count | Contents |
| :--- | :---: | :--- |
| `latticeflow-blueprints/` | 8 | LatticeFlow v2 DAG blueprints (`coldchain-emergency`, `mkt-quarantine`, `procurement-hitl-approval`, `sla-escalation`, and peers). |
| `n8n-workflows/` | 10 | Sanitized stock `n8n` workflows (`active: false`, zero embedded credential IDs). |
| `dmn-tables/` | 4 | 3 DMN decision tables (`cold_chain_approval_v1`, `cmms_priority_routing_v1`, `coldchain_settlement_policy_v1`) plus `sample-evaluations.json` (12 cases). |
| `business-packs/` | 16 | 2 Business Packs, 5 manifests, 4 workflow templates, 3 App Builder suites, and 2 domain solutions. |
| `public-forms/` | 4 | Zero-PII `/v/form/:slug` templates (`partner-intake`, `coldchain-incident-report`, `customer-service-ticket`, `order-inquiry`). |
| `solution-bundles/` | 1 | Starter `coldchain-starter-bundle.v3.json` bundle with verified `metadata.contentSha256`. |

Before merging changes or importing bundles into a live environment, CI runs the zero-dependency validator `scripts/validate-templates.mjs` on Node.js 24:

<CodeTabs
  :tabs="[
    {
      label: 'Local CLI Validation',
      lang: 'bash',
      code: 'git clone https://github.com/CTU-OpenPaw/lattice-templates.git\ncd lattice-templates\nnode --check scripts/validate-templates.mjs\nnpm run validate'
    },
    {
      label: 'Validator Output',
      lang: 'json',
      code: '{\n  &quot;result&quot;: &quot;PASS&quot;,\n  &quot;platformVersion&quot;: &quot;0.4.2&quot;,\n  &quot;stats&quot;: { &quot;governanceFilesChecked&quot;: 9, &quot;jsonFilesParsed&quot;: 44 },\n  &quot;errorCount&quot;: 0,\n  &quot;errors&quot;: []\n}'
    }
  ]"
/>

## Operational Notes

- Newly imported `connectors` always initialize with `active: false` so operators can bind Vault secrets or complete OAuth2 PKCE consent flows before enabling live traffic.
- If `solutionBundleImport` encounters any schema error or cross-tenant organization mismatch during execution, the enclosing PostgreSQL transaction rolls back cleanly without partial writes.

## Related

- [Custom Collections & Safe AST Formulas](/en/studio/custom-collections-formulas)
- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [Visual DMN Engine](/en/automation/visual-dmn)
- [Public Forms /v/form/:slug](/en/studio/public-forms)
