---
title: Expressions and Control Flow
description: Safe template expression syntax, runtime context variables, structured conditional branching, durable loopCursor iteration, error routing, and HITL pause/resume mechanics.
---

# Expressions and Control Flow

**LatticeFlow v2** executes data interpolation, conditional routing, bounded iteration, and human-in-the-loop (HITL) suspension without `eval()` or `new Function()`. Every template path is statically checked by `nodes/triggers.js` and `validator.js`, while branch state, nested loop cursors, and approval checkpoints persist in PostgreSQL so runs survive server restarts and resume atomically.

## Template Expression Syntax (<code v-pre>{{path}}</code>)

Before any rule is saved or run, `scanTemplateString` (`validator.js`) inspects all strings and objects in the graph. A valid expression must match `TEMPLATE_EXPR_RE = /^[a-zA-Z0-9_.\-$]+$/` (supporting dot-separated keys and zero-based array indices such as `steps.q_1.items.0.code`).

### Runtime Interpolation Rules (`interpolateTemplate`)

When a configuration string consists solely of a single expression (such as <code v-pre>"{{steps.q_1.items}}"</code>), `resolveExpr` returns the resolved value in its native JavaScript type (array, object, number, or boolean) rather than coercing it to text; unresolved paths return `""`. When expressions are embedded inside surrounding text (such as <code v-pre>"Lot {{data.lotCode}} at {{data.mktCelsius}}C"</code>), `null` and `undefined` render as `""` while objects and arrays serialize via `JSON.stringify`.

`resolveExpr` checks `getSafePath(ctx, expr)` against the root execution context first and falls back to `getSafePath(ctx.data, expr)`. Both <code v-pre>{{lotCode}}</code> and <code v-pre>{{data.lotCode}}</code> therefore resolve whenever `lotCode` is present on `data`.

### Rejected Syntax (`UNSAFE_TEMPLATE_EXPRESSION`)

| Rejected Pattern | Reason |
|---|---|
| `${data.id}` | JavaScript or shell-style `${...}` interpolation is blocked. |
| <code v-pre>{{a.{{b}}}}</code> or unmatched <code v-pre>{{</code> / <code v-pre>}}</code> | Nested or unbalanced braces fail static validation. |
| <code v-pre>{{}}</code> or <code v-pre>{{data.a + 1}}</code> | Empty expressions and inline arithmetic/code expressions are forbidden. |
| `__proto__`, `constructor`, `prototype` | Blocked both as JSON object keys and as segments inside <code v-pre>{{path}}</code>. |

## Runtime Context Root Variables

`buildExecState` (`executor.js`) and `buildEvalContext` (`triggers.js`) expose the following root keys to all <code v-pre>{{path}}</code> expressions and filter evaluators during a run:

<ParamGrid
  title="LatticeFlow v2 Execution Context Variables"
  :items="[
    { name: 'event', type: 'object', description: 'Normalized CloudEvent envelope: id, type, source, subject, time, organizationId, correlationid, causationid, depth, data.' },
    { name: 'data', type: 'object', description: 'Event payload object (derived from event.data or input.data).' },
    { name: 'input', type: 'any', description: 'Output payload forwarded directly by the upstream predecessor (or { branches } on control.merge).' },
    { name: 'record', type: 'object | null', description: 'Sanitized ORM record for trigger.record runs, or null otherwise.' },
    { name: 'dmn', type: 'object', description: 'Flattened output columns from the most recent logic.dmn node (for example {{dmn.approvalTier}}).' },
    { name: 'dmnResult', type: 'object | null', description: 'Metadata from the latest DMN evaluation: { tableKey, matched, hitPolicy, outputs }.' },
    { name: 'steps', type: 'object', description: 'Keyed by nodeId (steps.<nodeId>) and stepIndex (steps.<stepIndex>), merging output fields alongside output, status, and error.' },
    { name: 'nodes', type: 'object', description: 'Full node state records keyed by nodeId: { output, status, error? }.' },
    { name: 'loop', type: 'object | null', description: 'Active iteration context inside control.loop: { item, index, count }.' },
    { name: 'actor', type: 'object | null', description: 'User or service actor that triggered or resumed the run (id, username, role).' },
    { name: 'organizationId', type: 'string', description: 'Tenant identifier enforced for the run.' },
    { name: 'resumeDecision', type: 'string | null', description: 'Branch port selected during resumeRun (approved, rejected, or main).' },
    { name: 'resumePayload', type: 'object | null', description: 'Optional JSON payload supplied to POST /api/dxosAutomations:resumeRun.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'Cross-Node Context References',
      lang: 'json',
      code: '{\n  \u0022incidentId\u0022: \u0022{{steps.create_incident.id}}\u0022,\n  \u0022lotCode\u0022: \u0022{{data.lotCode}}\u0022,\n  \u0022approvalTier\u0022: \u0022{{dmn.approvalTier}}\u0022,\n  \u0022currentItemSku\u0022: \u0022{{loop.item.sku}}\u0022,\n  \u0022itemPosition\u0022: \u0022{{loop.index}}\u0022,\n  \u0022reviewerNote\u0022: \u0022{{resumePayload.note}}\u0022\n}'
    },
    {
      label: 'Runtime steps & nodes Shape',
      lang: 'json',
      code: '{\n  \u0022steps\u0022: {\n    \u0022create_incident\u0022: {\n      \u0022collection\u0022: \u0022latticeIncidentCases\u0022,\n      \u0022id\u0022: 408,\n      \u0022record\u0022: { \u0022id\u0022: 408, \u0022code\u0022: \u0022MKT-evt_1\u0022, \u0022severity\u0022: \u0022critical\u0022 },\n      \u0022output\u0022: { \u0022collection\u0022: \u0022latticeIncidentCases\u0022, \u0022id\u0022: 408 },\n      \u0022status\u0022: \u0022completed\u0022\n    }\n  },\n  \u0022nodes\u0022: {\n    \u0022create_incident\u0022: {\n      \u0022output\u0022: { \u0022collection\u0022: \u0022latticeIncidentCases\u0022, \u0022id\u0022: 408 },\n      \u0022status\u0022: \u0022completed\u0022\n    }\n  }\n}'
    }
  ]"
/>

## Structured Filters, Branching, and Merging

### Filter Syntax in `control.if` and `filterJson`

`matchesFilter` (`nodes/control.js`) evaluates structured JSON predicates validated statically by `validateFilterStructure`:

| Form | Example Syntax | Scope |
|---|---|---|
| Explicit object | `{"field": "data.amount", "op": "gt", "value": 50000000}` | Single target path and explicit operator |
| Operator map (`$op`) | <code v-pre>{"dmn.approvalTier": {"$in": ["quality_hold_director", "vp_ops"]}}</code> | Direct path-keyed constraints |
| Nested combinators | <code v-pre>{"$and": [{"data.mktCelsius": {"$gte": 8}}, {"$not": {"data.lotStatus": "expired"}}]}</code> | `$and`/`and`/`all`/`rules`, `$or`/`or`/`any`, `$not` |

Supported comparison operators in `matchOperatorObject` are `eq` (`==`, `===`), `ne` (`neq`, `!=`), `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `exists`, and `contains` (substring check on strings, element membership on arrays).

### `control.switch` and `control.merge` Modes

`control.switch` resolves `expression` and evaluates `cases` sequentially. The first matching case (via `case.condition` or `operator`/`equals`) routes execution to `case.port` (`case_0`, `case_1`, ...); otherwise execution follows `default`.

When combining `control.parallel` fan-out branches at a `control.merge` node, `mode` governs both initial traversal and suspended-run recovery:

| Behavior | `wait_all` (default) | `first_completed` |
|---|---|---|
| Activation rule | Waits until every non-skipped predecessor pushes into `activeInputs`. | Runs as soon as the first incoming branch arrives (`activeInputs.length > 0`). |
| Missing branch handling | Marks the merge node `skipped` (`MERGE_WAIT_ALL_INCOMPLETE`) if any active predecessor fails to deliver input. | Ignores slower or skipped branches after firing. |
| Merged output shape | Merges branch objects with `Object.assign`. | Returns the output of the first completed branch. |
| Resume semantics | Continues waiting for incomplete branches after `resumeRun`. | `collectPreSettledNodes` marks an already-completed `first_completed` merge and its completed descendants as `preSettled`, preventing duplicate downstream execution when a slower branch later resumes. |

## Durable Iteration and `loopCursor` / `loopCursors` Stack

`control.loop` iterates over up to `MAX_LOOP_CAP = 100` items resolved from `itemsPath` (setting `strictLimit: true` throws `FLOW_LOOP_LIMIT_EXCEEDED` instead of truncating arrays longer than `maxIterations`). In `loop-resume.js`, `executeLoopBody` extracts the loop body subgraph from the `item` port (`collectSubgraph`) and marks those nodes as `loopOwned` so outer `traverseDag` does not run them prematurely.

When any node inside a loop body suspends (`control.approval`, `control.delay`, or `ai.agent` awaiting HITL), the engine checkpoints the full loop stack:

1. **Checkpoint on suspension (`persistSuspendedLoop`):** Serializes the current frame `{ loopNodeId, items, currentIndex, loopResults, loopOutput, iterTraceStart, bodyNodeIds }`. For nested loops, `[...childStack, cursor, ...rawRest]` forms an innermost-to-outermost stack stored in both `nodeStatesJson.loopCursor = loopStack[0]` and `nodeStatesJson.loopCursors = loopStack`.
2. **Stack unwinding on resume (`resumeLoopStack`):** When `resumeRun` runs, the engine iterates `k = 0 .. rawStack.length - 1`:
   - Restores `execState.loop = { item: items[curIdx], index: curIdx, count: items.length }`.
   - Computes the remaining body subgraph (`remTopo`) using `doneInIter` (nodes already completed since `iterTraceStart`) and finishes the interrupted iteration `curIdx`.
   - Continues through `curIdx + 1 .. items.length - 1`. If another suspension occurs inside any iteration, `loopCursors` updates in place while preserving accumulated `loopResults`.
   - Once all stacked loops complete, deletes `nodeStatesJson.loopCursor` and `nodeStatesJson.loopCursors`, marks `control.loop` `completed`, and forwards `results` out the `done` port.

## Delays, HITL Approvals, and Atomic Resume

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:resumeRun"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Atomically claims a suspended run, validates resumeToken or HITL approver authority/delegation, and resumes DAG execution."
/>

### Atomic Claim and Approval Authority (`durable-store.js`)

When `finalizeDagRun` handles a `suspend` signal (`control.delay`, `control.approval`, or mutating `ai.agent` tool), `generateResumeToken` creates a 24-byte random hex token and stores only its SHA-256 digest (`resumeTokenHash`) on `latticeAutomationRuns` alongside `status: 'suspended'`, `suspendedNodeId`, `approvalId`, and `resumeAt`.

Calling `resumeRun` executes four ordered checks in `claimSuspendedRun`:

| Step | Control Stage | Enforcement Behavior |
| :---: | :--- | :--- |
| `1` | In-flight guard and tenant check | Rejects concurrent resume calls on the same `organizationId:runUid` (`409 RUN_RESUME_CONFLICT`), returns `403 NATIVE_ORGANIZATION_MISMATCH` on tenant mismatch, and returns `409 RUN_ALREADY_RESUMED` if status is no longer `suspended`. |
| `2` | Token and authority verification | When `resumeToken` is supplied, validates `timingSafeEqualHex(sha256Hex(resumeToken), run.resumeTokenHash)`. For HITL approvals, `verifyApprovalResumeAuthority` verifies direct roles (`root`, `admin`, `ldx_admin`, or the node's `approverRole`) or resolves an active delegation via `delegation-engine` (`scope: 'latticeAutomationRuns'`), logging `flow.approval_resumed` to the PKI audit ledger when delegated. |
| `3` | Atomic PostgreSQL state transition | Executes `UPDATE "latticeAutomationRuns" SET status = 'resuming', "updatedAt" = NOW() WHERE "organizationId" = :organizationId AND "runUid" = :runUid AND status = 'suspended' RETURNING *` so only one caller can claim the run. |
| `4` | Port routing on wake-up | On `control.approval`, `decision` (`approved` or `rejected`) routes to the matching port and updates `latticeAiApprovalQueue`. On `ai.agent`, `rejected` routes to `error` and `approved` routes to `main`. On `control.delay`, execution resumes on `main`. |

### Background Scheduler (`tickFlowScheduler` in `cron.js`)

Every `DX_FLOW_DELAY_TICK_MS` (`15000` ms by default), `tickFlowScheduler` acquires `pg_try_advisory_xact_lock(hashtext('dxos_flow_scheduler_tick'))` and runs three sweeps:

- `tickScheduledRules`: Evaluates active `trigger.schedule` rules and launches runs when `nextRunAt <= now`.
- `tickDueDelayedRuns`: Finds `suspended` delay runs (`approvalId == null`) with `resumeAt <= now` and calls `resumeFlowRun` as `system:delay-ticker`.
- `tickExpiredApprovals`: Transitions overdue HITL approval runs (`resumeAt <= now`) to `status: 'expired'` (`errorMessage: 'APPROVAL_EXPIRED'`) and marks matching `latticeAiApprovalQueue` entries `expired`.

<CodeTabs
  :tabs="[
    {
      label: 'Approve & Resume Run (curl)',
      lang: 'bash',
      code: 'curl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:resumeRun\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_MANAGER_JWT\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\n    \u0022runUid\u0022: \u0022run_7c2e19a0-4f18-4b7f-a8c1-1234567890ab\u0022,\n    \u0022decision\u0022: \u0022approved\u0022,\n    \u0022payload\u0022: {\n      \u0022note\u0022: \u0022Emergency compressor budget approved\u0022\n    }\n  }\''
    },
    {
      label: 'Reject & Route to rejected Port',
      lang: 'bash',
      code: 'curl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:resumeRun\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_MANAGER_JWT\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\n    \u0022runUid\u0022: \u0022run_7c2e19a0-4f18-4b7f-a8c1-1234567890ab\u0022,\n    \u0022decision\u0022: \u0022rejected\u0022,\n    \u0022payload\u0022: {\n      \u0022reason\u0022: \u0022Missing second vendor quote\u0022\n    }\n  }\''
    }
  ]"
/>

## Error Routing, Timeouts, and Replay

LatticeFlow v2 handles node failures deterministically rather than retrying failed nodes silently in place:

| Mechanism | Runtime Behavior | Outcome |
|---|---|---|
| Per-node timeout (`timeoutMs`) | `runSingleNode` races execution against `node.timeoutMs` or `node.config.timeoutMs`. | Fails the node with `FLOW_NODE_TIMEOUT` (`504`). |
| `error` port & `errorPolicy` | Routes `{ error, output }` along outgoing `error` edges when present; otherwise halts unless `continueOnFail` or `errorPolicy === 'continue'`. | Marks the node `failed` and either routes or halts. |
| Final status (`computeRunStatus`) | Summarizes `stepTracesJson`: zero failures yields `completed`, mixed success and failure yields `partial`, total failure yields `failed`. | Persisted onto `latticeAutomationRuns`. |
| Run replay (`replayRun`) | Reconstructs `triggerPayloadJson` (or falls back to `latticeEventBus`), increments `depth` by `1`, and runs with `ignoreCooldown: true`. | Creates a fresh run record. *(Exponential backoff retries apply separately to `dxosEventBus`.)* |

## Related

- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [LatticeFlow v2 Node Reference](/en/automation/node-reference)
- [Unified Approvals and Delegations](/en/domains/approvals-and-delegations)
- [Webhooks and Cron Schedules](/en/automation/webhooks-and-schedules)
