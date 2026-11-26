---
title: LatticeFlow v2 Node Reference
description: Complete specification of all 24 LatticeFlow v2 node types across 6 categories (trigger, control, data, logic, ai, integration), including schemas, ports, and outputs.
---

# LatticeFlow v2 Node Reference

Every node in LatticeFlow v2 is registered and validated by `validateNodeDefinition` in `plugins/nocobase/plugin-dxos-studio/src/server/flow/registry.js`. The 24 node types span 6 categories (`trigger`, `control`, `data`, `logic`, `ai`, `integration`) and share a common graph envelope: `id`, `type`, `label`, `position`, `config`, `continueOnFail`, and optional `timeoutMs`.

<ApiEndpoint
  method="GET"
  path="/api/dxosAutomations:nodeRegistry"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Returns nodeTypes containing all 24 registered node schemas with inputSchema and defaultConfig."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:testNode"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write"
  summary="Executes a single node in isolation with pinnedInputs inside an RLS savepoint (dryRun=true by default)."
/>

## All 24 Node Types Index

| # | Node Type Key | Category | Inputs | Outputs | Summary |
|---|---|---|---|---|---|
| 1 | `trigger.event` | `trigger` | `[]` | `main` | Starts on matching CloudEvents from the Event Bus |
| 2 | `trigger.record` | `trigger` | `[]` | `main` | Starts on ORM `create`, `update`, or `delete` hooks |
| 3 | `trigger.schedule` | `trigger` | `[]` | `main` | Starts on a 5-field cron schedule and IANA timezone |
| 4 | `trigger.webhook` | `trigger` | `[]` | `main` | Starts on inbound HTTP POST with HMAC or Bearer auth |
| 5 | `trigger.manual` | `trigger` | `[]` | `main` | Starts from Control Studio or `dxosAutomations:runNow` |
| 6 | `control.if` | `control` | `in` | `true`, `false`, `error` | Binary branch evaluated by structured filter rules |
| 7 | `control.switch` | `control` | `in` | `case_0`, `case_1`, `case_2`, `default`, `error` | Multi-way branch routed by ordered `cases` |
| 8 | `control.parallel` | `control` | `in` | `main`, `error` | Fans out execution across all connected outgoing edges |
| 9 | `control.merge` | `control` | `in` | `main`, `error` | Joins parallel branches via `wait_all` or `first_completed` |
| 10 | `control.loop` | `control` | `in` | `item`, `done`, `error` | Bounded iteration (max 100 items) with durable cursor state |
| 11 | `control.delay` | `control` | `in` | `main`, `error` | Suspends execution for `durationSec` or until `untilIso` |
| 12 | `control.approval` | `control` | `in` | `approved`, `rejected`, `error` | Enqueues an HITL approval and pauses until decided |
| 13 | `control.subflow` | `control` | `in` | `main`, `error` | Invokes another rule in the same org (max depth 8) |
| 14 | `data.query` | `data` | `in` | `main`, `error` | Queries tenant-scoped records from allowlisted collections |
| 15 | `data.create` | `data` | `in` | `main`, `error` | Inserts a record with forced `organizationId` and depth tracking |
| 16 | `data.update` | `data` | `in` | `main`, `error` | Updates records matching `recordId` or non-empty `filter` |
| 17 | `logic.dmn` | `logic` | `in` | `main`, `error` | Evaluates a tenant DMN table and populates `context.dmn` |
| 18 | `logic.transform` | `logic` | `in` | `main`, `error` | Runs 9 declarative data operations without `eval()` |
| 19 | `ai.llm` | `ai` | `in` | `main`, `error` | Calls OpenAI-compatible `llmServices` with PII redaction |
| 20 | `ai.agent` | `ai` | `in` | `main`, `error` | Runs single-turn triage proposals or multi-turn ReAct agents |
| 21 | `integration.http` | `integration` | `in` | `main`, `error` | Calls origin-locked Vault connectors with SSRF and HMAC guards |
| 22 | `iot.twin_command` | `integration` | `in` | `main`, `error` | Dispatches `desiredPatch` to Digital Twin or HITL queue |
| 23 | `notify.send` | `integration` | `in` | `main`, `error` | Sends role-targeted notifications across 5 delivery channels |
| 24 | `event.emit` | `integration` | `in` | `main`, `error` | Publishes a CloudEvent to the Event Bus with incremented `depth` |

## `trigger` Category (5 Nodes)

All trigger nodes (`nodes/triggers.js`) declare `inputs: []` and `outputs: ['main']`, and normalize their output payload to the same envelope:

```json
{
  "type": "lot.held_mkt",
  "data": { "lotCode": "LOT-VAX-01", "mktCelsius": 10.4 },
  "record": null,
  "timestamp": "2026-11-26T08:30:00.000Z",
  "webhook": null,
  "schedule": null
}
```

### 1. `trigger.event`

Starts a workflow when a CloudEvent published on the Lattice Event Bus matches `eventType` (supports `*` wildcards and comma-separated patterns) and passes `filterJson`.

<ParamGrid
  title="trigger.event Config"
  :items="[
    { name: 'eventType', type: 'string', required: true, default: '*', description: 'CloudEvent type pattern to match (for example lot.held_mkt or entity.*).' },
    { name: 'filterJson', type: 'json', default: 'null', description: 'Optional structured filter evaluated against event data before creating a run.' }
  ]"
/>

### 2. `trigger.record`

Starts from ORM lifecycle hooks (`registerRecordTriggerHooks`) when records are created, updated, or deleted in an allowlisted business collection or `latticeCustom*` table. `output.record` holds the sanitized ORM record.

<ParamGrid
  title="trigger.record Config"
  :items="[
    { name: 'collection', type: 'string', required: true, default: '\u0022\u0022', description: 'Allowlisted business collection or custom latticeCustom* table name.' },
    { name: 'operation', type: 'string', required: true, default: 'create', description: 'ORM event operation: create, update, or delete.' },
    { name: 'filterJson', type: 'json', default: 'null', description: 'Optional structured filter applied to the mutated record.' }
  ]"
/>

### 3. `trigger.schedule`

Starts periodically from a 5-field cron expression (`minute hour dom month dow`, normalizing Sunday `7` to `0`) and IANA timezone. Dispatched by `tickScheduledRules` under the PostgreSQL advisory lock `dxos_flow_scheduler_tick`; sets `output.schedule` to `{ cron, timezone }`.

<ParamGrid
  title="trigger.schedule Config"
  :items="[
    { name: 'cron', type: 'string', required: true, default: '0 * * * *', description: 'Standard 5-field UNIX cron expression.' },
    { name: 'timezone', type: 'string', default: 'UTC', description: 'IANA timezone evaluated via Intl.DateTimeFormat (for example Asia/Ho_Chi_Minh).' }
  ]"
/>

### 4. `trigger.webhook`

Starts from an external HTTP POST sent to `POST /api/dxosAutomations:webhookIngress`. Validates request authentication before starting the graph and populates `output.webhook` with `{ webhookPath, authMode, secretHeader }`.

<ParamGrid
  title="trigger.webhook Config"
  :items="[
    { name: 'webhookPath', type: 'string', required: true, default: '\u0022\u0022', description: 'Logical webhook path descriptor associated with the rule.' },
    { name: 'authMode', type: 'string', required: true, default: 'hmac', description: 'Verification mode: hmac (HMAC-SHA256 or Standard Webhooks) or bearer.' },
    { name: 'secretHeader', type: 'string', default: 'X-Lattice-Signature-256', description: 'HTTP header inspected for hex HMAC signatures when authMode is hmac.' }
  ]"
/>

### 5. `trigger.manual`

Starts manually from Control Studio or via `POST /api/dxosAutomations:runNow`. `inputSchemaJson` documents the expected JSON payload schema for operators and test callers.

<ParamGrid
  title="trigger.manual Config"
  :items="[
    { name: 'inputSchemaJson', type: 'json', default: '{}', description: 'JSON schema describing expected manual trigger input fields.' }
  ]"
/>

## `control` Category (8 Nodes)

Control nodes (`nodes/control.js`) accept input on `in` and handle branching, fan-out, fan-in, bounded loops, durable suspension, and nested rule calls.

### 6. `control.if`

Interpolates <code v-pre>{{path}}</code> tokens inside `condition` and evaluates it with `matchesFilter`. Outputs on `['true', 'false', 'error']` and returns `{ matched, condition }`.

<ParamGrid
  title="control.if Config"
  :items="[
    { name: 'condition', type: 'json', required: true, default: '{\u0022field\u0022:\u0022\u0022,\u0022op\u0022:\u0022eq\u0022,\u0022value\u0022:\u0022\u0022}', description: 'Structured filter supporting $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $contains, $and, $or, and $not.' }
  ]"
/>

### 7. `control.switch`

Reads `expression` and evaluates `cases` in order, routing to the first matching `port` (`case_0`, `case_1`, `case_2`, or custom case port) or `default` if none match (`outputs: ['case_0', 'case_1', 'case_2', 'default', 'error']`). Returns `{ matched, port, value }`.

<ParamGrid
  title="control.switch Config"
  :items="[
    { name: 'expression', type: 'string', required: true, default: '\u0022\u0022', description: 'Context path (data.priority) or {{path}} template to inspect.' },
    { name: 'cases', type: 'json', required: true, default: '[{\u0022port\u0022:\u0022case_0\u0022,\u0022operator\u0022:\u0022eq\u0022,\u0022equals\u0022:\u0022\u0022}]', description: 'Ordered array of case definitions with port, operator (or op), equals (or value), or condition.' }
  ]"
/>

### 8. `control.parallel`

Fans out execution simultaneously over `main` to every connected downstream branch (`outputs: ['main', 'error']`). Ready target nodes are dispatched via `runRlsAwareBatch`. Returns `{ fannedOut: true, input }`.

<ParamGrid
  title="control.parallel Config"
  :items="[
    { name: 'mode', type: 'string', default: 'fan_out', description: 'Fan-out execution mode (fixed to fan_out).' }
  ]"
/>

### 9. `control.merge`

Joins outputs from incoming parallel branches (`outputs: ['main', 'error']`) and returns `{ mode, merged, branches }`. In `wait_all` mode, execution waits for all non-skipped predecessors; in `first_completed` mode, the first arriving branch triggers downstream execution immediately.

<ParamGrid
  title="control.merge Config"
  :items="[
    { name: 'mode', type: 'string', required: true, default: 'wait_all', description: 'Branch join strategy: wait_all or first_completed.' }
  ]"
/>

### 10. `control.loop`

Iterates over the array resolved at `itemsPath`, executing the subgraph attached to `item` with `loop = { item, index, count }` before routing aggregated results to `done` (`outputs: ['item', 'done', 'error']`). Bounded by `MAX_LOOP_CAP = 100`; final output is `{ items, count, totalCount, maxIterations, truncated, results }`.

<ParamGrid
  title="control.loop Config"
  :items="[
    { name: 'itemsPath', type: 'string', required: true, default: 'data.items', description: 'Path to the array in execution context.' },
    { name: 'maxIterations', type: 'number', required: true, default: '100', description: 'Iteration limit in range 1..100; values outside range throw FLOW_LOOP_LIMIT_EXCEEDED.' },
    { name: 'strictLimit', type: 'boolean', default: 'false', description: 'When true, throws FLOW_LOOP_LIMIT_EXCEEDED if array length exceeds maxIterations instead of truncating.' }
  ]"
/>

### 11. `control.delay`

Computes `resumeAt` from `untilIso` or `Date.now() + durationSec * 1000` and suspends the run (`status: 'suspended'`, `outputs: ['main', 'error']`). During `dryRun`, returns `{ delayed: true, simulated: true, resumeAt, durationSec }` without suspending.

<ParamGrid
  title="control.delay Config"
  :items="[
    { name: 'durationSec', type: 'number', default: '60', description: 'Delay duration in seconds when untilIso is omitted.' },
    { name: 'untilIso', type: 'string', default: '\u0022\u0022', description: 'Target ISO-8601 wake-up timestamp (supports {{path}} templates).' }
  ]"
/>

### 12. `control.approval`

Inserts a pending approval into `latticeAiApprovalQueue` and suspends the run (`outputs: ['approved', 'rejected', 'error']`) with a SHA-256 `resumeTokenHash` and expiration `resumeAt`. Calling `resumeRun` as an authorized `approverRole` or active delegate routes execution to `approved` or `rejected`.

<ParamGrid
  title="control.approval Config"
  :items="[
    { name: 'approverRole', type: 'string', required: true, default: 'ldx_manager', description: 'Role required (directly or via active delegation) to decide the approval.' },
    { name: 'title', type: 'string', required: true, default: 'Cần phê duyệt', description: 'Approval item title shown in the HITL queue.' },
    { name: 'summary', type: 'string', default: '\u0022\u0022', description: 'Decision summary shown to reviewers (supports {{path}}).' },
    { name: 'riskLevel', type: 'string', default: 'medium', description: 'Risk classification: low, medium, high, or critical.' },
    { name: 'ttlHours', type: 'number', default: '24', description: 'Expiration window in hours (clamped 1..720).' }
  ]"
/>

### 13. `control.subflow`

Invokes another published rule (`ruleKey`) within the same `organizationId` via `helpers.executeSubflow` (`outputs: ['main', 'error']`). Blocks direct self-recursion (`FLOW_SELF_RECURSIVE_SUBFLOW`) and returns `{ ruleKey, depth, result }`.

<ParamGrid
  title="control.subflow Config"
  :items="[
    { name: 'ruleKey', type: 'string', required: true, default: '\u0022\u0022', description: 'Target workflow ruleKey within the same organization.' },
    { name: 'payloadMapping', type: 'json', default: '{}', description: 'Object mapped and template-interpolated as data for the child flow.' },
    { name: 'maxDepth', type: 'number', default: '8', description: 'Per-node recursion depth limit (1..8, bounded by MAX_SUBFLOW_DEPTH).' }
  ]"
/>

## `data` Category (3 Nodes)

Data nodes (`nodes/data.js`) operate exclusively on `ALLOWLISTED_BUSINESS_COLLECTIONS` (`latticeRequests`, `latticeOrders`, `latticeOrderLines`, `latticeServiceTickets`, `latticeParaDocuments`, `latticeIncidentCases`, `latticeLocations`, `latticeAssets`, `latticeAgentProposals`) and custom collections matching `^latticeCustom[A-Z][A-Za-z0-9]{1,40}$`. Every query or mutation injects `organizationId` and blocks `FORBIDDEN_SYSTEM_COLLECTIONS`.

On core voucher tables (`latticeRequests`, `latticeOrders`, `latticeServiceTickets`), `sanitizeWriteValues` strips `id`, `organizationId`, `status`, `version`, `amendedFromId`, `amendmentNo`, `submittedAt`, `submittedBy`, `cancelledAt`, `cancelledBy`, and `cancelReason`.

### 14. `data.query`

Queries tenant-scoped records (`outputs: ['main', 'error']`) using `sanitizeDirectFilter` and `assertSafeDirectSort`, returning `{ collection, count, items }`.

<ParamGrid
  title="data.query Config"
  :items="[
    { name: 'collection', type: 'string', required: true, default: 'latticeRequests', description: 'Allowlisted business or latticeCustom* collection name.' },
    { name: 'filter', type: 'json', default: '{}', description: 'Filter object merged with mandatory organizationId scope.' },
    { name: 'limit', type: 'number', default: '20', description: 'Maximum records returned (1..200).' },
    { name: 'sort', type: 'json', default: '[]', description: 'Validated sort field array (for example [\u0022-createdAt\u0022]).' }
  ]"
/>

### 15. `data.create`

Creates a tenant-scoped record inside `runWithOrmDepth` (incrementing ORM hook depth) and returns `{ collection, id, record }`.

<ParamGrid
  title="data.create Config"
  :items="[
    { name: 'collection', type: 'string', required: true, default: '\u0022\u0022', description: 'Allowlisted target collection name.' },
    { name: 'values', type: 'json', required: true, default: '{}', description: 'Record field values after {{path}} interpolation and protected-field stripping.' }
  ]"
/>

### 16. `data.update`

Queries matching records within `organizationId` using `filter` or `recordId` and applies sanitized updates up to `limit` (`outputs: ['main', 'error']`). Rejects empty filters (`DATA_UPDATE_FILTER_REQUIRED`) to prevent accidental full-table updates; returns `{ collection, matchedCount, updatedCount }`.

<ParamGrid
  title="data.update Config"
  :items="[
    { name: 'collection', type: 'string', required: true, default: '\u0022\u0022', description: 'Allowlisted target collection name.' },
    { name: 'recordId', type: 'string', default: '\u0022\u0022', description: 'Target record ID used when filter is omitted.' },
    { name: 'filter', type: 'json', default: '{}', description: 'Non-empty filter expression (takes precedence over recordId).' },
    { name: 'values', type: 'json', required: true, default: '{}', description: 'Updated field values after protected-field stripping.' },
    { name: 'limit', type: 'number', default: '20', description: 'Maximum matched records updated per call (1..200).' }
  ]"
/>

## `logic` Category (2 Nodes)

### 17. `logic.dmn`

Evaluates an active decision table (`tableKey`) in `latticeDecisionTables` for the current tenant via `evaluateDecisionTable` (`outputs: ['main', 'error']`). Writes outputs to both `context.dmn` (accessible downstream as <code v-pre>{{dmn.&lt;field&gt;}}</code>) and `context.dmnResult`, and returns `{ tableKey, matched, hitPolicy, outputs, matchedRules }`.

<ParamGrid
  title="logic.dmn Config"
  :items="[
    { name: 'tableKey', type: 'string', required: true, default: '\u0022\u0022', description: 'Key of an active DMN table belonging to the current organization.' },
    { name: 'facts', type: 'json', default: '{}', description: 'Additional fact overrides merged with event.data and upstream input.' }
  ]"
/>

### 18. `logic.transform`

Executes an ordered array of declarative `operations` without `eval()` or `new Function()` (`outputs: ['main', 'error']`). Each step reads from both the in-progress `result` object and the enclosing `evalCtx`.

<ParamGrid
  title="logic.transform Config"
  :items="[
    { name: 'operations', type: 'json', required: true, default: '[]', description: 'Ordered array of transform operations keyed by op.' },
    { name: 'baseFromInput', type: 'boolean', default: 'true', description: 'Initializes result as a sanitized copy of input when true, or {} when false.' }
  ]"
/>

All 9 supported `op` primitives in `logic.transform`:

| `op` | Key Fields | Behavior |
|---|---|---|
| `set` | `target`, `source` or `value` | Assigns a value from `source` path or interpolated `value` into `target`. |
| `template` | `target`, `expr` / `template` / `value` | Interpolates a <code v-pre>{{path}}</code> string and writes it to `target`. |
| `coerceNumber` | `target`, `source` / `value`, `precision?`, `fallback?` | Parses a finite number with optional rounding (`0..12`), falling back on invalid input. |
| `coerceBoolean` | `target`, `source` / `value` | Maps `'false'`, `'0'`, `'no'`, `'off'`, and `''` to `false`; otherwise `Boolean(raw)`. |
| `math` | `target`, `operator` (`add`, `sub`, `mul`, `div`), `left`/`right` or `operands` or `expr`, `precision?` | Evaluates binary arithmetic safely and rejects division by zero (`TRANSFORM_DIVIDE_BY_ZERO`). |
| `concat` | `target`, `parts` / `sources`, `separator?` | Joins resolved paths or templates using `separator`. |
| `rename` | `from` / `source`, `to` / `target` | Moves a value from the source path to the target path and deletes the old key. |
| `pick` | `keys` / `fields`, `target?` | Retains only listed keys (into `target` or replacing `result`). |
| `omit` | `keys` / `fields` | Deletes listed keys from `result`. |

## `ai` Category (2 Nodes)

### 19. `ai.llm`

Calls the active OpenAI-compatible provider configured in `llmServices` via `callConfiguredLlm` (`outputs: ['main', 'error']`), applying PII redaction and `assertSafeLlmUrl` SSRF checks. If no LLM provider is configured and `fallbackOutput` is present, it returns `mode: 'offline-fallback'` on `main`.

<ParamGrid
  title="ai.llm Config"
  :items="[
    { name: 'systemPrompt', type: 'string', default: '\u0022\u0022', description: 'System instruction prepended to the message array.' },
    { name: 'userPrompt', type: 'string', required: true, default: '\u0022\u0022', description: 'User prompt sent to the model (supports {{path}} interpolation).' },
    { name: 'responseFormat', type: 'string', default: 'json', description: 'Expected output format: json or text.' },
    { name: 'temperature', type: 'number', default: '0.2', description: 'Sampling temperature passed to the provider.' },
    { name: 'maxTokens', type: 'number', default: '1600', description: 'Maximum completion tokens.' },
    { name: 'model', type: 'string', default: '\u0022\u0022', description: 'Optional model override; defaults to the active llmServices model.' },
    { name: 'fallbackOutput', type: 'json', default: 'null', description: 'Static or templated fallback returned in dryRun or unconfigured environments.' }
  ]"
/>

Successful calls return `{ mode, model, content, parsedJson, data, usage, piiRedactedCount }`.

### 20. `ai.agent`

Supports two execution modes (`outputs: ['main', 'error']`) scoped to an allowlisted `targetCollection`:

- **`single` mode (default):** Performs a single-turn structured triage call (with `offline_fallback` when unconfigured) and writes a `proposed` record to `latticeAgentProposals` (or `latticeAiApprovalQueue`).
- **`react` mode (`mode: 'react'`, `enableReact: true`, or non-empty `tools`):** Runs `executeReactAgent` up to `maxTurns` (`1..12`), emits OpenTelemetry GenAI spans (`chat`, `execute_tool`, `invoke_agent`), validates `outputSchema` with up to 1 self-repair turn, and suspends for HITL approval (`suspend: { kind: 'approval' }`) whenever the agent invokes a mutating tool (`isMutatingTool`).

<ParamGrid
  title="ai.agent Config"
  :items="[
    { name: 'mode', type: 'string', default: 'single', description: 'Reasoning mode: single or react.' },
    { name: 'enableReact', type: 'boolean', default: 'false', description: 'Enables the ReAct loop when mode is not explicitly set to react.' },
    { name: 'maxTurns', type: 'number', default: '5', description: 'Maximum ReAct turns in range 1..12.' },
    { name: 'tools', type: 'json', default: '[]', description: 'Allowlisted tool names exposed to the ReAct agent.' },
    { name: 'outputSchema', type: 'json', default: 'null', description: 'JSON Schema enforced on the final ReAct response.' },
    { name: 'memoryScope', type: 'string', default: 'org', description: 'Long-term memory scope: org, agent, user, or none.' },
    { name: 'enableMemory', type: 'boolean', default: 'false', description: 'Automatically recalls matching latticeAiMemory items before reasoning.' },
    { name: 'systemPrompt', type: 'string', default: '\u0022\u0022', description: 'Custom system instruction for the agent.' },
    { name: 'targetCollection', type: 'string', required: true, default: 'latticeAssets', description: 'Allowlisted business collection linked to proposals or triage items.' },
    { name: 'targetRecordId', type: 'string', default: '0', description: 'Target record ID.' },
    { name: 'severity', type: 'string', default: 'medium', description: 'Default triage severity: low, medium, high, or critical.' },
    { name: 'recommendation', type: 'string', default: '\u0022\u0022', description: 'Default recommendation text when LLM fallback applies.' },
    { name: 'prompt', type: 'string', default: '\u0022\u0022', description: 'Analysis instruction for the agent.' },
    { name: 'evidence', type: 'json', default: 'null', description: 'Structured evidence payload attached to the proposal.' },
    { name: 'aiEmployee', type: 'string', default: 'ops_triage', description: 'Agent persona identifier.' },
    { name: 'toolName', type: 'string', default: 'triage_flow_event', description: 'Tool label recorded in HITL approval queue items.' },
    { name: 'model', type: 'string', default: '\u0022\u0022', description: 'Optional model override (for example ag/gemini-3.8-flash).' },
    { name: 'temperature', type: 'number', default: '0.2', description: 'Sampling temperature.' },
    { name: 'maxTokens', type: 'number', default: '1000', description: 'Maximum completion tokens per turn.' }
  ]"
/>

## `integration` Category (4 Nodes)

### 21. `integration.http`

Dispatches HTTP requests through a Connector Vault entry (`connectorKey`, `outputs: ['main', 'error']`). Locks the target origin to `connector.baseUrl` (`buildConnectorUrl`), enforces synchronous and async DNS SSRF checks, injects Vault auth headers, signs `X-Lattice-Signature-256` and Standard Webhooks (`webhook-signature`) when `authType === 'hmac'`, disables HTTP redirects (`redirect: 'error'`), and scrubs secrets from `{ connectorKey, authType, method, url, status, ok, response }`.

<ParamGrid
  title="integration.http Config"
  :items="[
    { name: 'connectorKey', type: 'string', required: true, default: '\u0022\u0022', description: 'Connector key stored in latticeConnectors.' },
    { name: 'method', type: 'string', required: true, default: 'POST', description: 'HTTP method: GET, POST, PUT, PATCH, or DELETE.' },
    { name: 'path', type: 'string', default: '\u0022\u0022', description: 'Relative path appended to connector baseUrl (origin changes rejected).' },
    { name: 'headers', type: 'json', default: '{}', description: 'Additional headers; Authorization, Host, and signature headers are stripped.' },
    { name: 'body', type: 'json', default: 'null', description: 'JSON request body for POST, PUT, and PATCH methods.' },
    { name: 'timeoutMs', type: 'number', default: '5000', description: 'Request timeout in milliseconds (clamped 100..60000).' }
  ]"
/>

### 22. `iot.twin_command`

Calls `digitalTwinMod.requestDesiredSetpoint` to update desired state (`desiredPatch`) on `assetEntityId` (`outputs: ['main', 'error']`). Setpoint changes exceeding the Digital Twin HITL delta threshold route into the approval queue before publishing downlinks to Node-RED / Mosquitto.

<ParamGrid
  title="iot.twin_command Config"
  :items="[
    { name: 'assetId', type: 'string', default: '\u0022\u0022', description: 'Optional latticeAssets record ID.' },
    { name: 'assetEntityId', type: 'string', required: true, default: '\u0022\u0022', description: 'NGSI-LD / Digital Twin entity ID (for example urn:ngsi-ld:ColdRoom:HCM-01).' },
    { name: 'desiredPatch', type: 'json', required: true, default: '{}', description: 'Desired twin property patch object.' },
    { name: 'downlinkUrl', type: 'string', default: '\u0022\u0022', description: 'Optional downlink override URL (validated against static SSRF rules).' }
  ]"
/>

### 23. `notify.send`

Delivers tenant-scoped notifications to `roleNames` via `notificationCenter.dispatchRoleNotifications` (`outputs: ['main', 'error']`), returning `{ roleNames, notifyChannels, templateKey?, dispatched, title }`.

<ParamGrid
  title="notify.send Config"
  :items="[
    { name: 'roleNames', type: 'json', required: true, default: '[\u0022ldx_operator\u0022]', description: 'Target role names receiving the notification.' },
    { name: 'title', type: 'string', required: true, default: '\u0022\u0022', description: 'Notification title after {{path}} interpolation.' },
    { name: 'body', type: 'string', default: '\u0022\u0022', description: 'Notification message body.' },
    { name: 'severity', type: 'string', default: 'warning', description: 'Severity level: info, warning, high, or critical.' },
    { name: 'category', type: 'string', default: 'system', description: 'Category: system, mention, voucher, sla, alarm, or approval.' },
    { name: 'targetCollection', type: 'string', default: '\u0022\u0022', description: 'Linked business collection name.' },
    { name: 'targetRecordId', type: 'string', default: '\u0022\u0022', description: 'Linked record ID.' },
    { name: 'targetPath', type: 'string', default: '\u0022\u0022', description: 'Portal route opened when clicking the notification.' },
    { name: 'notifyChannels', type: 'json', default: '[\u0022in_app\u0022]', description: 'Delivery channels: in_app, email_smtp, telegram, slack, webhook.' },
    { name: 'templateKey', type: 'string', default: '\u0022\u0022', description: 'Optional notification template key (max 120 chars).' },
    { name: 'channelConfig', type: 'json', default: '{}', description: 'Per-channel metadata such as connectorKey.' }
  ]"
/>

### 24. `event.emit`

Publishes a tenant-scoped CloudEvent onto the Lattice Event Bus (`outputs: ['main', 'error']`) and returns `{ published: true, eventType, subject, depth }`. Automatically increments `depth` by `1` and throws `RECURSION_DEPTH_LIMIT_EXCEEDED` if `depth > MAX_HARD_DEPTH` (`8`).

<ParamGrid
  title="event.emit Config"
  :items="[
    { name: 'eventType', type: 'string', required: true, default: '\u0022\u0022', description: 'CloudEvent type string to publish.' },
    { name: 'subject', type: 'string', default: '\u0022\u0022', description: 'Optional business subject identifier.' },
    { name: 'data', type: 'json', default: '{}', description: 'Event data payload after {{path}} interpolation and prototype sanitization.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'logic.transform + integration.http Example',
      lang: 'json',
      code: '{\n  \u0022nodes\u0022: [\n    {\n      \u0022id\u0022: \u0022tx_1\u0022,\n      \u0022type\u0022: \u0022logic.transform\u0022,\n      \u0022config\u0022: {\n        \u0022baseFromInput\u0022: false,\n        \u0022operations\u0022: [\n          { \u0022op\u0022: \u0022set\u0022, \u0022target\u0022: \u0022lotCode\u0022, \u0022source\u0022: \u0022data.lotCode\u0022 },\n          { \u0022op\u0022: \u0022math\u0022, \u0022target\u0022: \u0022overThresholdC\u0022, \u0022operator\u0022: \u0022sub\u0022, \u0022left\u0022: \u0022data.mktCelsius\u0022, \u0022right\u0022: \u0022data.thresholdCelsius\u0022, \u0022precision\u0022: 2 },\n          { \u0022op\u0022: \u0022template\u0022, \u0022target\u0022: \u0022summary\u0022, \u0022expr\u0022: \u0022Lot {{result.lotCode}} exceeded by {{result.overThresholdC}}C\u0022 }\n        ]\n      }\n    },\n    {\n      \u0022id\u0022: \u0022http_1\u0022,\n      \u0022type\u0022: \u0022integration.http\u0022,\n      \u0022config\u0022: {\n        \u0022connectorKey\u0022: \u0022n8n-coldchain-orchestrator\u0022,\n        \u0022method\u0022: \u0022POST\u0022,\n        \u0022path\u0022: \u0022/webhook/mkt-alert\u0022,\n        \u0022body\u0022: { \u0022lotCode\u0022: \u0022{{steps.tx_1.lotCode}}\u0022, \u0022summary\u0022: \u0022{{steps.tx_1.summary}}\u0022 },\n        \u0022timeoutMs\u0022: 5000\n      }\n    }\n  ]\n}'
    },
    {
      label: 'Single-Node Isolation Test (curl)',
      lang: 'bash',
      code: 'curl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:testNode\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022auto_mkt_quarantine_response\u0022,\u0022nodeId\u0022:\u0022if_director_tier\u0022,\u0022pinnedInputs\u0022:{\u0022dmn\u0022:{\u0022approvalTier\u0022:\u0022quality_hold_director\u0022}}}\''
    }
  ]"
/>

## Related

- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [Expressions and Control Flow](/en/automation/expressions-and-control-flow)
- [Visual DMN Decision Engine](/en/automation/visual-dmn)
- [Unified AI Studio Tools](/en/ai/unified-tools)
