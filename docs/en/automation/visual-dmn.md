---
title: Visual DMN & FEEL Engine
description: Decision table modeling, complete zero-eval FEEL operator reference, Hit Policies (FIRST, UNIQUE, COLLECT, PRIORITY), and tenant-scoped evaluation APIs.
---

# Visual DMN & FEEL Engine

LatticeDX decouples volatile business rules from workflow DAG topology through a **zero-`eval` Decision Model and Notation (DMN) engine** in `@latticedx/plugin-dxos-studio`. Analysts and platform engineers author decision tables in Control Studio or via `dxosDmn`, simulate draft rules without database writes, and feed deterministic outputs into `logic.dmn` nodes inside LatticeFlow v2.

<DmnDecisionDiagram />

## Data Model & Validation Caps

Each decision table is stored in `latticeDecisionTables` under PostgreSQL 16 `FORCE ROW LEVEL SECURITY` scoped by `organizationId`. Records are uniquely indexed per tenant on `(organizationId, tableKey)` via `uidx_lattice_dmn_org_key`.

<ParamGrid
  title="latticeDecisionTables Field Schema"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Tenant identifier owning the decision table; must match the active RLS session context.' },
    { name: 'tableKey', type: 'string', required: true, description: 'Unique key within the tenant matching /^[a-zA-Z0-9_-]{2,80}$/.' },
    { name: 'name', type: 'string', required: true, description: 'Human-readable table title (capped at 160 characters).' },
    { name: 'description', type: 'string', description: 'Operational rule scope description (capped at 500 characters).' },
    { name: 'hitPolicy', type: 'string', default: 'FIRST', description: 'Match aggregation policy: FIRST, UNIQUE, COLLECT, or PRIORITY.' },
    { name: 'inputsJson', type: 'jsonb', required: true, description: 'Array of 1 to 50 input declarations { name, type?, label? }.' },
    { name: 'outputsJson', type: 'jsonb', required: true, description: 'Array of 1 to 50 output declarations { name, type?, label? }.' },
    { name: 'rulesJson', type: 'jsonb', required: true, description: 'Array of up to 500 rules { when, then, priority?, description? }.' },
    { name: 'version', type: 'integer', default: '1', description: 'Monotonically incremented revision number managed by dxosDmn:saveTable.' },
    { name: 'published', type: 'boolean', default: 'true', description: 'Publication state flag for studio lifecycle tracking.' },
    { name: 'active', type: 'boolean', default: 'true', description: 'Only tables with active = true can be evaluated by tableKey.' }
  ]"
/>

Validation guards execute before persistence or draft simulation:

| Constraint | Cap / Pattern | Error Code |
| :--- | :--- | :--- |
| `tableKey` syntax | `^[a-zA-Z0-9_-]{2,80}$` | `400 DMN_TABLE_KEY_INVALID` |
| Field identifier syntax (`inputsJson`, `outputsJson`, `when`, `then`) | `^[a-zA-Z0-9_.-]{1,64}$` | `400 DMN_SCHEMA_INVALID` / `DMN_RULE_INVALID` |
| `inputsJson` and `outputsJson` cardinality | `1` to `50` fields per array | `400 DMN_SCHEMA_INVALID` |
| `rulesJson` cardinality | Maximum `500` rules per table | `400 DMN_RULE_INVALID` |
| Blocked prototype keys (`FORBIDDEN_KEYS`) | `__proto__`, `constructor`, `prototype` | `400 DMN_SCHEMA_INVALID` / `DMN_RULE_INVALID` |
| Rule-level `description` length | Truncated at `255` characters | Normalized on save |

During fact evaluation, `evaluateDecisionTable` reads input keys exclusively via `Object.hasOwn(ctxObj, inputKey)`, preventing prototype-chain lookup leaks.

## Four Hit Policies (`HIT_POLICIES`)

`evaluateDecisionTable` in `dmn-engine.js` supports four deterministic hit policies when evaluating `rulesJson`:

| Hit Policy | Evaluation Semantics | Output Shape | Conflict & Edge Behavior |
| :--- | :--- | :--- | :--- |
| `FIRST` | Evaluates rules top-to-bottom and stops on the first match | Single `result` and `outputs` object plus `matchedRuleIndex` | Returns `matched: false`, `matchedRuleIndex: -1`, `result: null` when nothing matches |
| `UNIQUE` | Evaluates every rule to verify mutual exclusivity | Single `result`, `outputs`, `results: [only.outputs]`, `matchedRuleIndex` | Throws HTTP `409 DMN_UNIQUE_POLICY_VIOLATION` if more than one rule matches |
| `COLLECT` | Evaluates every rule and aggregates all matching rule outputs in declaration order | `results: [...]` array of `then` objects plus `matchedRules` | Returns `matched: false`, `results: []` when no rule matches |
| `PRIORITY` | Evaluates every rule and sorts matches descending by numeric `priority` (or `rank`) | Top rule `result` / `outputs`, `results: [top.outputs]`, sorted `matchedRules` | Ties break by ascending `ruleIndex`; omitted priority defaults to `0` |

## Complete FEEL Expression Reference

Every `when` condition is normalized into `{ op, value }` via `normalizeConditionSpec` and `parseStringConditionSpec`. No `eval()` or `new Function()` is ever invoked. Rules accept both shorthand FEEL strings and structured JSON condition objects.

| Canonical Operator | Accepted Aliases | FEEL Shorthand String | Structured JSON | Evaluation Semantics |
| :--- | :--- | :--- | :--- | :--- |
| `eq` | `==`, `===`, `=` | `"critical"`, `"= 100"`, `"== true"` | `{ "op": "eq", "value": "critical" }` | Scalar equality; finite numeric strings and numbers normalize before comparison via `parseFinite` |
| `neq` | `!=`, `!==` | `"!= closed"`, `"!== 0"` | `{ "op": "neq", "value": "closed" }` | Logical negation of `valuesEqual` |
| `gt` | `>` | `"> 8"` | `{ "op": "gt", "value": 8 }` | Strictly greater than a finite numeric operand |
| `gte` | `>=` | `">= 75"` | `{ "op": "gte", "value": 75 }` | Greater than or equal to a finite numeric operand |
| `lt` | `<` | `"< 2"` | `{ "op": "lt", "value": 2 }` | Strictly less than a finite numeric operand |
| `lte` | `<=` | `"<= -12"` | `{ "op": "lte", "value": -12 }` | Less than or equal to a finite numeric operand |
| `between` | — | `"[2..8]"` | `{ "op": "between", "value": [2, 8] }` | Closed numeric interval check `min <= actual <= max` |
| `in` | — | `"in [high, critical]"` | `{ "op": "in", "value": ["high", "critical"] }` | Matches if `actual` equals any element in the array |
| `not_in` | `not in` | `"not in [draft, cancelled]"` | `{ "op": "not_in", "value": ["draft", "cancelled"] }` | Matches if `actual` equals no element in the array |
| `contains` | — | `"contains COLD-"` | `{ "op": "contains", "value": "COLD-" }` | Case-insensitive substring check against `String(actual)` |
| `any` | `*`, `-` | `"*"`, `"-"`, `"any"`, `""` | `{ "op": "any", "value": null }` or `null` | Wildcard match; always evaluates to `true` |

When parsing shorthand strings, `parseScalarValue` coerces `"true"` / `"false"` to booleans, `"null"` to `null`, finite numeric literals matching `/^-?\d+(?:\.\d+)?$/` to numbers, and strips balanced outer quotes (`'...'` or `"..."`). For string `[a..b]` ranges, `parseStringConditionSpec` normalizes bounds automatically via `Math.min(a, b)` and `Math.max(a, b)`.

## Production Decision Tables & `logic.dmn` Binding

The `lattice-templates/dmn-tables/` repository directory ships three reference decision tables (`cold_chain_approval_v1`, `cmms_priority_routing_v1`, `coldchain_settlement_policy_v1`) alongside a 12-case `sample-evaluations.json` verification suite.

<CodeTabs
  :tabs="[
    { label: 'DMN Table JSON', lang: 'json', code: '{\n  \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n  \x22name\x22: \x22Cold-Chain & MKT Excursion Approval Matrix\x22,\n  \x22hitPolicy\x22: \x22FIRST\x22,\n  \x22inputsJson\x22: [\n    { \x22name\x22: \x22totalAmountM\x22, \x22type\x22: \x22number\x22 },\n    { \x22name\x22: \x22maxTempC\x22, \x22type\x22: \x22number\x22 }\n  ],\n  \x22outputsJson\x22: [\n    { \x22name\x22: \x22approvalTier\x22, \x22type\x22: \x22string\x22 },\n    { \x22name\x22: \x22slaMinutes\x22, \x22type\x22: \x22number\x22 }\n  ],\n  \x22rulesJson\x22: [\n    {\n      \x22when\x22: { \x22maxTempC\x22: { \x22op\x22: \x22gt\x22, \x22value\x22: 8 } },\n      \x22then\x22: { \x22approvalTier\x22: \x22quality_hold_director\x22, \x22slaMinutes\x22: 15 }\n    },\n    {\n      \x22when\x22: { \x22totalAmountM\x22: \x22> 500\x22 },\n      \x22then\x22: { \x22approvalTier\x22: \x22director_approval\x22, \x22slaMinutes\x22: 45 }\n    },\n    {\n      \x22when\x22: { \x22totalAmountM\x22: \x22*\x22, \x22maxTempC\x22: \x22*\x22 },\n      \x22then\x22: { \x22approvalTier\x22: \x22manager_approval\x22, \x22slaMinutes\x22: 120 }\n    }\n  ]\n}' },
    { label: 'logic.dmn Node Config', lang: 'json', code: '{\n  \x22id\x22: \x22dmn_gate\x22,\n  \x22type\x22: \x22logic.dmn\x22,\n  \x22config\x22: {\n    \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n    \x22facts\x22: {\n      \x22totalAmountM\x22: \x22{{data.totalAmountM}}\x22,\n      \x22maxTempC\x22: \x22{{data.maxTempC}}\x22\n    }\n  }\n}' }
  ]"
/>

Inside a LatticeFlow v2 DAG, `logic.dmn` merges `{ ...evalCtx.data, ...input, ...facts, organizationId }` and invokes `evaluateDecisionTable`. Downstream nodes (`control.if`, `control.approval`, `notify.send`) read the decision outputs via <code v-pre>{{dmn.approvalTier}}</code> and <code v-pre>{{dmnResult.outputs}}</code>:

- For `FIRST`, `UNIQUE`, and `PRIORITY`: `context.dmn` holds the matched `outputs` object directly (such as <code v-pre>{{dmn.approvalTier}}</code>), and `context.dmnResult` holds `{ tableKey, matched, hitPolicy, outputs }`.
- For `COLLECT`: `context.dmn` holds `{ results: [...] }` containing every matched rule's `then` payload in `rulesJson` order.
- To inspect every matched rule index and priority score downstream, read the node output directly via <code v-pre>{{steps.dmn_gate.matchedRules}}</code>.

If the target `tableKey` does not exist or has `active: false` in the organization, `logic.dmn` throws `404 DMN_TABLE_NOT_FOUND` and routes execution along the node's `error` output edge when connected.

## Evaluation & Authoring API (`dxosDmn`)

The `dxosDmn` resource exposes three actions protected by tenant `FORCE ROW LEVEL SECURITY` and scoped Personal Access Tokens (`read`, `write`, `dmn`).

<ApiEndpoint
  method="GET"
  path="/api/dxosDmn:listTables"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | dmn"
  summary="Lists DMN tables scoped to the caller organization; supports tableKey, activeOnly, and limit (1..200) filters."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosDmn:saveTable"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | dmn"
  summary="Validates schemas and rules, increments version, persists to latticeDecisionTables, and writes a dmn.table_saved entry to the Ed25519 latticeCryptoLedger."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosDmn:evaluate"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | dmn"
  summary="Evaluates a persisted active tableKey or simulates an unsaved draft via params.table (returning simulated: true with zero database writes)."
/>

Inline draft simulation (`params.table`) requires `view` or `update` ACL on `latticeDecisionTables` (or org-admin privileges) so analysts can test rule edits before publishing a new version.

<CodeTabs
  :tabs="[
    { label: 'cURL (Evaluate Persisted)', lang: 'bash', code: 'curl -sS -X POST \x22https://app.latticedx.example.com/api/dxosDmn:evaluate\x22 \\\n  -H \x22Authorization: Bearer ldx_pat_your_token\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n    \x22context\x22: { \x22totalAmountM\x22: 320, \x22maxTempC\x22: 11.4 }\n  }\x27' },
    { label: 'cURL (Simulate Draft)', lang: 'bash', code: 'curl -sS -X POST \x22https://app.latticedx.example.com/api/dxosDmn:evaluate\x22 \\\n  -H \x22Authorization: Bearer ldx_pat_your_token\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22table\x22: {\n      \x22tableKey\x22: \x22draft_sla_priority\x22,\n      \x22hitPolicy\x22: \x22PRIORITY\x22,\n      \x22rulesJson\x22: [\n        { \x22priority\x22: 10, \x22when\x22: { \x22severity\x22: \x22high\x22 }, \x22then\x22: { \x22tier\x22: \x22p2\x22 } },\n        { \x22priority\x22: 90, \x22when\x22: { \x22severity\x22: \x22in [high, critical]\x22 }, \x22then\x22: { \x22tier\x22: \x22p1\x22 } }\n      ]\n    },\n    \x22context\x22: { \x22severity\x22: \x22high\x22 }\n  }\x27' },
    { label: 'JSON Response', lang: 'json', code: '{\n  \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n  \x22version\x22: 1,\n  \x22hitPolicy\x22: \x22FIRST\x22,\n  \x22matched\x22: true,\n  \x22matchedRuleIndex\x22: 0,\n  \x22result\x22: {\n    \x22approvalTier\x22: \x22quality_hold_director\x22,\n    \x22slaMinutes\x22: 15\n  },\n  \x22outputs\x22: {\n    \x22approvalTier\x22: \x22quality_hold_director\x22,\n    \x22slaMinutes\x22: 15\n  },\n  \x22matchedRules\x22: [\n    {\n      \x22ruleIndex\x22: 0,\n      \x22priority\x22: 0,\n      \x22outputs\x22: {\n        \x22approvalTier\x22: \x22quality_hold_director\x22,\n        \x22slaMinutes\x22: 15\n      }\n    }\n  ]\n}' }
  ]"
/>

## Security Boundaries & Error Codes

Every `dxosDmn:saveTable` call verifies organization admin status (`isOrgAdmin`) or explicit `create`/`update` collection permissions on `latticeDecisionTables`, and appends an immutable `dmn.table_saved` audit record under scope `dxos:dmn` to `latticeCryptoLedger` containing `{ tableKey, hitPolicy, version, ruleCount }`.

| Error Code | HTTP | Trigger Condition |
| :--- | :--- | :--- |
| `DMN_OPERATOR_INVALID` | `400` | Condition specifies an operator outside `ALLOWED_OPERATORS` |
| `DMN_RULE_INVALID` | `400` | Numeric comparison receives non-finite value, invalid `[min, max]` range, or `> 500` rules |
| `DMN_CONTEXT_INVALID` | `400` | String `context` argument is not valid JSON |
| `DXOS_ACL_DENIED` | `403` | Caller lacks org-admin role or `latticeDecisionTables` collection permission |
| `DMN_TABLE_NOT_FOUND` | `404` | No active (`active: true`) table matches `tableKey` inside the caller organization |
| `DMN_UNIQUE_POLICY_VIOLATION` | `409` | Table uses `hitPolicy: "UNIQUE"` and matched two or more rules |

## Related

- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [24 Node Types Reference](/en/automation/node-reference)
- [Expressions and Control Flow](/en/automation/expressions-and-control-flow)
- [Approvals and Delegations](/en/domains/approvals-and-delegations)
