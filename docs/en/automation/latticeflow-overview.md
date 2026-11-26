---
title: LatticeFlow v2 Overview
description: Architecture of the LatticeFlow v2 DAG workflow engine, durable execution states, 6 node categories, run ledger, and dxosAutomations API.
---

# LatticeFlow v2 Overview

**LatticeFlow v2** is the directed acyclic graph (DAG) workflow orchestration engine built into `@latticedx/plugin-dxos-studio` (`src/server/flow/*`). It pairs the visual `@xyflow/react` editor in Control Studio with durable PostgreSQL 16 execution under `FORCE ROW LEVEL SECURITY`, connecting domain CloudEvents, ORM record hooks, cron schedules, signed webhooks, DMN decision tables, AI agents, and Digital Twin commands in one tenant-isolated runtime.

<LatticeFlowDagDiagram />

## DAG Execution Architecture

Each LatticeFlow v2 workflow stores a versioned graph (`schemaVersion: 2`) that separates editable drafts (`draftGraphJson`) from the live published definition (`graphJson`, `publishedVersion`). Before a graph is saved or executed, `schema.js`, `validator.js`, and `executor.js` enforce structural and security invariants.

### Graph Normalization and Static Validation

`normalizeGraph` coerces incoming definitions into `FLOW_SCHEMA_VERSION = 2` with bounded defaults, and `validateFlowGraph` enforces four static checks before persistence or execution:

| Check | Enforcement Mechanism | Rejection Code |
|---|---|---|
| Topological sort and cycles | Kahn's algorithm builds `topoOrder` and rejects self-loops or cycles. | `FLOW_CYCLE_DETECTED` |
| Port compatibility | Validates `STANDARD_PORTS` plus dynamic `case_*` ports on `control.switch`; `trigger.*` nodes accept no incoming edges. | `FLOW_INVALID_PORT` |
| Template and table safety | Rejects `${...}`, nested braces, and prototype keys in <code v-pre>{{path}}</code>; restricts data nodes to allowlisted collections. | `UNSAFE_TEMPLATE_EXPRESSION`, `TARGET_COLLECTION_FORBIDDEN` |
| Static SSRF filtering | Validates URL fields on `integration.http`, `ai.llm`, and `iot.twin_command` against loopback and metadata ranges. | `CONNECTOR_URL_UNSAFE` |

<ParamGrid
  title="Engine Limits and Graph Settings (graph.settings)"
  :items="[
    { name: 'version', type: 'integer', required: true, default: '2', description: 'DAG schema version (FLOW_SCHEMA_VERSION = 2).' },
    { name: 'MAX_FLOW_NODES', type: 'constant', default: '50', description: 'Maximum number of nodes permitted in a single workflow graph.' },
    { name: 'MAX_HARD_DEPTH', type: 'constant', default: '8', description: 'Hard recursion depth cap across ORM hooks, subflows, and event.emit.' },
    { name: 'MAX_LOOP_ITERATIONS', type: 'constant', default: '100', description: 'Maximum items processed per control.loop execution.' },
    { name: 'settings.errorPolicy', type: 'string', default: 'stop', description: 'Graph-level failure handling policy: stop or continue.' },
    { name: 'settings.cooldownSec', type: 'number', default: '0', description: 'Minimum cooldown window in seconds between runs of the same ruleKey.' },
    { name: 'settings.maxDepth', type: 'integer', default: '8', description: 'Per-rule recursion ceiling, clamped to MAX_HARD_DEPTH (8).' },
    { name: 'settings.timeoutMs', type: 'integer', default: '30000', description: 'Default graph execution timeout metadata in milliseconds.' }
  ]"
/>

### Runtime Traversal Lifecycle

When `executeFlowGraph` receives a trigger event, it builds `execState`, checks recursion depth (`event.depth >= maxDepth`), evaluates `cooldownSec`, and tests `filterJson`. Once matched, `traverseDag` drives execution under four runtime invariants:

| Runtime Invariant | Execution Behavior in `traverseDag` |
| :--- | :--- |
| Per-node savepoint isolation | Each node runs inside `runNodeInRlsSavepoint` under the tenant RLS context (`runAutomationWithRls` when `DX_PG_RLS_SESSION=true`), preventing a single node failure from aborting the surrounding PostgreSQL session. |
| RLS-aware parallel batching | Concurrent ready nodes run through `runRlsAwareBatch`, which executes branches concurrently via `Promise.all` when no shared active RLS transaction is open, or sequentially inside a shared transaction to preserve savepoint ordering. |
| Port routing and branch skipping | Completed nodes forward their output payload along edges matching `nextPort` (or `nextPorts`). Unreachable downstream nodes on untaken branches are marked `skipped` with reason `BRANCH_NOT_TAKEN`. |
| Trace capping and secret scrubbing | `sanitizeTraceData` caps stored step inputs and outputs at `16384` bytes and masks sensitive fields (`token`, `secret`, `password`, `apiKey`, `Bearer`, `sk-*`) before writing to `latticeAutomationRuns`. |

## Six Categories and 24 Node Types

All node definitions are validated by `validateNodeDefinition` in `registry.js` and exposed at runtime via `dxosAutomations:nodeRegistry`. The 24 built-in nodes are grouped into 6 categories:

| Category | Count | Inputs | Standard Outputs | Role in the DAG | Reference |
|---|---|---|---|---|---|
| `trigger` | 5 | `[]` | `main` | Starts a run from CloudEvents, ORM record hooks, cron, signed webhooks, or API calls | [Node Reference](/en/automation/node-reference#trigger-category-5-nodes) |
| `control` | 8 | `in` | `main`, `true`/`false`, `case_*`, `item`/`done`, `approved`/`rejected`, `error` | Conditional branching, fan-out, merge, bounded loops, delays, HITL approvals, and subflows | [Node Reference](/en/automation/node-reference#control-category-8-nodes) |
| `data` | 3 | `in` | `main`, `error` | Queries, creates, and updates tenant-scoped records in allowlisted business tables | [Node Reference](/en/automation/node-reference#data-category-3-nodes) |
| `logic` | 2 | `in` | `main`, `error` | Evaluates tenant DMN decision tables and runs declarative data transforms without `eval()` | [Node Reference](/en/automation/node-reference#logic-category-2-nodes) |
| `ai` | 2 | `in` | `main`, `error` | Calls OpenAI-compatible `llmServices` with PII redaction or runs ReAct agents with HITL tools | [Node Reference](/en/automation/node-reference#ai-category-2-nodes) |
| `integration` | 4 | `in` | `main`, `error` | Invokes Vault HTTP connectors, sends Digital Twin setpoints, dispatches alerts, and emits CloudEvents | [Node Reference](/en/automation/node-reference#integration-category-4-nodes) |

See the complete configuration schemas and output payloads in [LatticeFlow v2 Node Reference](/en/automation/node-reference).

## Execution States and the Run Ledger

Every live execution (`dryRun = false`) creates a record in `latticeAutomationRuns`, capturing an immutable `graphSnapshotJson` and `triggerPayloadJson` so suspended or failed runs can resume or replay deterministically even after a rule is edited.

| Status | Meaning | Follow-up Behavior |
|---|---|---|
| `running` | Traversal is actively executing ready nodes. | Transitions to a terminal or `suspended` state in `finalizeDagRun`. |
| `completed` | All visited nodes succeeded without unhandled errors or active suspension. | Can be re-executed from original trigger data via `replayRun`. |
| `partial` | At least one non-trigger action completed and at least one failed (via `error` edge or `errorPolicy: 'continue'`). | Inspect `stepTracesJson` and replay via `replayRun`. |
| `failed` | A node failed without an `error` edge and halted execution, or graph validation failed. | Fix graph configuration and re-run via `replayRun`. |
| `suspended` | Paused at `control.delay`, `control.approval`, or a mutating `ai.agent` tool awaiting HITL approval. | Resumed via `resumeRun` or `tickFlowScheduler`. |
| `resuming` | Atomic PostgreSQL claim lock acquired while resuming a `suspended` run. | Transient guard preventing duplicate concurrent resumes. |
| `expired` | An HITL approval passed `resumeAt` without a decision. | Closed with `errorMessage: 'APPROVAL_EXPIRED'`. |
| `skipped` | Stopped early due to `RULE_UNPUBLISHED`, `FILTER_NOT_MATCHED`, `COOLDOWN_ACTIVE`, or `RECURSION_DEPTH_LIMIT_EXCEEDED`. | No downstream actions execute; reason is logged in `errorMessage`. |

<ParamGrid
  title="Core Fields of latticeAutomationRuns"
  :items="[
    { name: 'runUid', type: 'string', required: true, description: 'Unique run identifier formatted as run_<uuid>.' },
    { name: 'ruleKey', type: 'string', required: true, description: 'Workflow key matching ^[a-z0-9][a-z0-9_-]{1,62}$.' },
    { name: 'status', type: 'string', required: true, description: 'Current lifecycle status of the workflow run.' },
    { name: 'depth', type: 'integer', default: '0', description: 'ORM and subflow recursion depth at run start.' },
    { name: 'graphVersion', type: 'integer', default: '2', description: 'DAG engine version used for execution.' },
    { name: 'nodeStatesJson', type: 'jsonb', default: '{}', description: 'Per-node status, outputs, ports, and loopCursor/loopCursors stack when suspended.' },
    { name: 'stepTracesJson', type: 'jsonb', default: '[]', description: 'Chronological execution trace containing sanitized input, output, error, and durationMs.' },
    { name: 'suspendedNodeId', type: 'string', description: 'Node ID currently paused for delay or HITL approval.' },
    { name: 'approvalId', type: 'integer', description: 'Foreign reference to latticeAiApprovalQueue when waiting on HITL decision.' },
    { name: 'resumeAt', type: 'datetime', description: 'Wake-up timestamp for control.delay or expiration deadline for approvals.' },
    { name: 'resumeTokenHash', type: 'string', description: 'SHA-256 digest of the 24-byte random hex token checked during resumeRun.' }
  ]"
/>

## Versioning, DSL Formats, and Dry-Run Testing

LatticeFlow v2 separates draft editing from live traffic and supports symmetric JSON and YAML DSL serialization (`serializeFlowDsl` and `parseFlowDsl` in `schema.js`). Changes persist to `draftGraphJson` via `saveDraft` without affecting published traffic and can be simulated through `testRule` (`useDraft: true`, `dryRun: true`, bypassing `cooldownSec`). Calling `publishRule` increments `publishedVersion`, updates `graphJson` and `triggerIndexJson`, and writes an immutable snapshot into `latticeAutomationRuleVersions`. When restoring a prior revision, `rollbackRuleVersion` publishes a new monotonically increasing version copied from the target snapshot rather than rewriting history.

<CodeTabs
  :tabs="[
    {
      label: 'Rule Lifecycle (curl)',
      lang: 'bash',
      code: '# 1. Save a v2 draft graph\ncurl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:saveDraft\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022order_alert_v2\u0022,\u0022name\u0022:\u0022Order Alert\u0022,\u0022draftGraphJson\u0022:{\u0022version\u0022:2,\u0022nodes\u0022:[{\u0022id\u0022:\u0022trig_1\u0022,\u0022type\u0022:\u0022trigger.record\u0022,\u0022config\u0022:{\u0022collection\u0022:\u0022latticeOrders\u0022,\u0022operation\u0022:\u0022create\u0022}}],\u0022edges\u0022:[]}}\'\n\n# 2. Simulate the draft in dryRun mode\ncurl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:testRule\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022order_alert_v2\u0022,\u0022useDraft\u0022:true,\u0022sampleEvent\u0022:{\u0022data\u0022:{\u0022id\u0022:101,\u0022totalAmount\u0022:12000000}}}\'\n\n# 3. Publish to live execution\ncurl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:publishRule\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022order_alert_v2\u0022,\u0022changeSummary\u0022:\u0022Initial release\u0022}\''
    },
    {
      label: 'YAML DSL Format (schema.js)',
      lang: 'yaml',
      code: 'version: 2\nsettings:\n  errorPolicy: stop\n  cooldownSec: 0\n  maxDepth: 8\n  timeoutMs: 30000\nnodes:\n  - id: trig_1\n    type: trigger.event\n    label: Inbound Event\n    config:\n      eventType: lot.held_mkt\n  - id: notify_1\n    type: notify.send\n    label: Alert Manager\n    config:\n      roleNames:\n        - ldx_manager\n      title: \u0022MKT hold: {{data.lotCode}}\u0022\n      notifyChannels:\n        - in_app\nedges:\n  - id: e_1\n    source: trig_1\n    sourceHandle: main\n    target: notify_1\n    targetHandle: in'
    }
  ]"
/>

## `dxosAutomations` API Surface

All 19 actions under `dxosAutomations` enforce organization scoping and `ldx_pat_*` API key scopes. Direct REST CRUD against `latticeAutomationRules`, `latticeAutomationRuleVersions`, and `latticeAutomationRuns` is blocked by `createAutomationDirectGuardMiddleware` so every mutation passes graph validation and RLS binding.

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:publishRule"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Validates the graph, increments publishedVersion, rebuilds triggerIndexJson, and writes an immutable version snapshot."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:runNow"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Executes the published rule (or draft when useDraft=true) immediately using the supplied event payload."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAutomations:getRunTrace"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | ai | iot"
  summary="Fetches a single latticeAutomationRuns record by runUid or id, including nodeStatesJson and sanitized stepTracesJson."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:resumeRun"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Atomically claims a suspended run, validates resumeToken or approver role/delegation, and resumes DAG traversal."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:webhookIngress"
  auth="Public (HMAC-SHA256 | Bearer | Standard Webhooks)"
  summary="Public webhook ingress endpoint dispatching into trigger.webhook rules by organizationId and ruleKey."
/>

| Action | Typical Method | Auth & PAT Scope | Purpose |
|---|---|---|---|
| `listRules`, `builderCatalog`, `nodeRegistry` | `GET` | Manager/Admin · `read` | Lists rules, Studio builder catalog, and all 24 node schemas |
| `saveRule`, `saveDraft`, `publishRule`, `rollbackRuleVersion` | `POST` | Admin · `write`, `ai`, `iot` | Saves rules, edits drafts, publishes snapshots, and rolls back versions |
| `listRuleVersions`, `listRuns`, `getRunTrace` | `GET` | Manager/Admin · `read` | Reads version history, run summaries, and step-level traces |
| `toggleRule`, `deleteRule`, `runNow`, `replayRun`, `resumeRun` | `POST` | Manager/Admin · `write`, `ai`, `iot` | Enables/disables rules, deletes rules, triggers manual runs, replays, and resumes |
| `testRule`, `testNode` | `POST` | Manager/Admin · `read` (live `testNode` needs `write`) | Dry-runs an entire graph or tests one node with `pinnedInputs` |
| `aiAssist` | `POST` | Manager/Admin · `write`, `ai`, `iot` | Invokes `runFlowArchitect` to draft, patch, or diagnose failed traces |
| `webhookIngress` | `POST` | Public (HMAC / Bearer) | Triggers workflows from external HTTP callers |

## Security Boundaries and Operations

`data.*` and `ai.agent` nodes strictly reject access to `SYSTEM_PROTECTED_COLLECTIONS` and `FORBIDDEN_SYSTEM_COLLECTIONS` (`latticePkiKeys`, `latticeCryptoLedger`, `latticeConnectors`, `latticeApiKeys`, `latticeDelegations`, `latticeAutomationRules`, `latticeAutomationRuns`).

To prevent infinite trigger loops, `AsyncLocalStorage` (`ormDepthStore`) propagates `depth` across ORM record hooks, `control.subflow`, and `event.emit`. Reaching `depth >= maxDepth` (capped at `8`) skips execution with `RECURSION_DEPTH_LIMIT_EXCEEDED`.

In background scheduling (`tickFlowScheduler`), every `DX_FLOW_DELAY_TICK_MS` (`15000` ms by default) the engine acquires `pg_try_advisory_xact_lock(hashtext('dxos_flow_scheduler_tick'))` to run cron triggers, wake `control.delay` runs, and expire overdue HITL approvals without duplicate execution across replicas.

## Related

- [LatticeFlow v2 Node Reference](/en/automation/node-reference)
- [Expressions and Control Flow](/en/automation/expressions-and-control-flow)
- [Visual DMN Decision Engine](/en/automation/visual-dmn)
- [Webhooks and Cron Schedules](/en/automation/webhooks-and-schedules)
