---
title: A2A (Agent-to-Agent) Protocol
description: Agent Card discovery, JSON-RPC 2.0 task lifecycle on /api/dxos-a2a, and security boundaries for cross-agent delegation in LatticeDX.
---

<script setup>
const a2aTabs = [
  {
    label: 'Discovery & tasks/send',
    lang: 'bash',
    code: `# 1. Discover Agent Card skills
curl -s https://lattice.example.com/.well-known/agent-card.json | jq '.skills[].id'

# 2. Submit an idempotent task to dxos-ops
curl -s -X POST https://lattice.example.com/api/dxos-a2a \\
  -H "Authorization: Bearer $LATTICE_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "req-101",
    "method": "tasks/send",
    "params": {
      "id": "task-coldchain-401",
      "targetAgentId": "dxos-ops",
      "idempotencyKey": "idem-coldchain-401",
      "message": {
        "role": "user",
        "parts": [
          { "type": "text", "text": "Inspect CT-02 cold room temperature thresholds and summarize open alarms." },
          { "type": "data", "data": { "warehouseCode": "HUB-CT", "severity": "high" } }
        ]
      },
      "metadata": { "portalSlug": "incidents" }
    }
  }'`,
  },
  {
    label: 'tasks/get & tasks/cancel',
    lang: 'json',
    code: `// Retrieve task status with the last 2 messages
{
  "jsonrpc": "2.0",
  "id": "req-102",
  "method": "tasks/get",
  "params": {
    "id": "task-coldchain-401",
    "historyLength": 2
  }
}

// Cancel a task in submitted or working state
{
  "jsonrpc": "2.0",
  "id": "req-103",
  "method": "tasks/cancel",
  "params": {
    "id": "task-coldchain-401",
    "reason": "Resolved manually by dispatch operator"
  }
}`,
  },
  {
    label: 'Peer Delegation (TypeScript)',
    lang: 'ts',
    code: `const response = await fetch("https://lattice.example.com/api/dxos-a2a", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "req-peer-01",
    method: "tasks/send",
    params: {
      targetAgentId: "partner-carrier-agent",
      peerUrl: "https://a2a.partner-logistics.example/rpc",
      message: {
        role: "user",
        parts: [{ type: "text", text: "Confirm cold-chain pickup slot for LOT-2026-09." }],
      },
      metadata: { shipmentCode: "SHP-8841" },
    },
  }),
});
const rpcResult = await response.json();`,
  },
];
</script>

# A2A (Agent-to-Agent) Protocol

The Agent-to-Agent (A2A) gateway in `@latticedx/plugin-dxos-ai` standardizes how external orchestrators discover LatticeDX agent capabilities and exchange stateful tasks over JSON-RPC 2.0. Implemented in `a2a-gateway.js` as an HTTP middleware layer inside the NocoBase host, it binds agent delegation directly to PostgreSQL `FORCE ROW LEVEL SECURITY` tenant isolation, RBAC role checks, and audit logging in `latticeAiAuditLogs`.

While the [MCP Gateway](/en/ai/mcp-gateway) exposes discrete tools, resources, and prompts to a connected client, A2A defines task-level delegation between autonomous agents. Every `tasks/send`, `tasks/get`, and `tasks/cancel` call persists state in `latticeA2aTasks` scoped to the caller's `organizationId`, and direct REST CRUD on that collection is blocked.

## Agent Card Discovery

The gateway publishes its Agent Card at two discovery endpoints so external clients and peer orchestrators can inspect supported skills and authentication requirements before submitting work. Both routes accept only `GET` and `HEAD`, set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, and bypass the NocoBase `{ data }` envelope (`withoutDataWrapping = true`).

<ApiEndpoint
  method="GET"
  path="/.well-known/agent-card.json"
  auth="Public Discovery"
  summary="Returns the standard A2A Agent Card declaring the JSON-RPC URL, Bearer authentication scheme, and 7 agent skills."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos-a2a/agent-card.json"
  auth="Public Discovery"
  summary="Prefixed discovery route under /api for reverse proxies that forward only API traffic."
/>

`resolveSafeCardEndpointUrl` resolves the advertised `/api/dxos-a2a` endpoint `url` in order of precedence from `DXOS_A2A_PUBLIC_URL`, `DXOS_PUBLIC_URL`, and `NOCOBASE_PUBLIC_URL`, falling back to validated `X-Forwarded-Proto` and `X-Forwarded-Host` request headers. When deployed behind Nginx (`10-lattice-public-routes.sh`) or Caddy, `/.well-known/agent-card.json` is proxied directly with caching disabled.

<ParamGrid
  title="Agent Card Schema Fields"
  :items="[
    { name: 'name', type: 'string', required: true, default: 'LatticeDX Enterprise A2A Gateway', description: 'Human-readable gateway identifier.' },
    { name: 'url', type: 'string', required: true, description: 'Absolute JSON-RPC 2.0 endpoint URL ending in /api/dxos-a2a.' },
    { name: 'version', type: 'string', required: true, default: '0.4.2', description: 'Running version of @latticedx/plugin-dxos-ai.' },
    { name: 'capabilities.streaming', type: 'boolean', required: true, default: 'false', description: 'Indicates whether SSE streaming is enabled on A2A task calls.' },
    { name: 'capabilities.pushNotifications', type: 'boolean', required: true, default: 'false', description: 'Indicates whether asynchronous webhook push notifications are enabled.' },
    { name: 'capabilities.stateTransitionHistory', type: 'boolean', required: true, default: 'true', description: 'Persists full message and state transition history inside latticeA2aTasks.' },
    { name: 'authentication.schemes', type: 'string[]', required: true, default: '[\'bearer\']', description: 'Requires Bearer JWT authentication for all JSON-RPC task operations.' },
    { name: 'skills', type: 'AgentSkill[]', required: true, description: 'Catalog of 7 skills mapped from A2A_AGENT_CATALOG with tags, inputModes, and outputModes.' }
  ]"
/>

### Published Agent Skills

Each entry in `skills` maps to a starter AI profile (see [AI Overview & Profiles](/en/ai/overview-and-profiles) for full tool permissions). During task execution, the gateway also checks `latticeAiProfiles` within the caller's `organizationId` so tenant-specific `systemPrompt`, `modelName`, and role locks take effect.

| Skill ID | Display Name | Tags | Default Authorized Caller Roles |
| :--- | :--- | :--- | :--- |
| `dxos-coordinator` | DX-OS Multi-Agent Coordinator | `coordination`, `orchestration`, `radar`, `routing` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` |
| `dxos-architect` | DX-OS System & App Architect | `architecture`, `app-builder`, `schema`, `portal`, `workflow` | `root`, `admin` (locked via `isAdminBuilder`) |
| `dxos-ops` | DX-OS Cold-Chain & IoT Ops | `cold-chain`, `iot`, `orion-ld`, `incidents` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse` |
| `dxos-logistics` | DX-OS Cold-Chain Logistics Dispatcher | `logistics`, `fefo`, `dispatch`, `epod` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` |
| `dxos-workspace` | DX-OS Services, Procurement & P.A.R.A. Assistant | `services`, `procurement`, `para`, `knowledge` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` |
| `dxos-operator` | DX-OS Operations Executor | `operations`, `it-ot`, `triage`, `execution` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_operator`, `ldx_dispatcher`, `ldx_warehouse` |
| `dxos-analyst` | DX-OS Enterprise Analyst | `analytics`, `bi`, `impact-graph`, `diagnostics` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` |

## JSON-RPC 2.0 Endpoint and Task Lifecycle

All task submission, status polling, and cancellation requests target `POST /api/dxos-a2a` using JSON-RPC 2.0. Non-`POST` requests return HTTP `405`, and unauthenticated calls return HTTP `401` with `WWW-Authenticate: Bearer realm="LatticeDX-A2A", error="invalid_token"` while logging an audit denial.

<ApiEndpoint
  method="POST"
  path="/api/dxos-a2a"
  auth="Bearer JWT"
  scope="tasks/send | tasks/get | tasks/cancel"
  summary="Single JSON-RPC 2.0 endpoint managing local agent handoffs and external A2A peer delegation."
/>

### Task State Machine (`A2A_VALID_STATUSES`)

Every task row in `latticeA2aTasks` stores `status`, conversation history (`messagesJson`), output `artifactsJson`, `metadataJson`, and `errorJson`. Six states are defined in `A2A_VALID_STATUSES`:

| State | Category | Operational Meaning |
| :--- | :--- | :--- |
| `submitted` | Active | Initial state persisted to `latticeA2aTasks` before agent or peer execution begins. |
| `working` | Active | Task accepted for asynchronous execution (`async: true` or `blocking: false`). |
| `input-required` | Active | Target agent or remote peer requires additional user input or approval before finishing. |
| `completed` | Terminal | Execution succeeded and produced response messages and structured `artifacts`. |
| `failed` | Terminal | Local execution error, remote HTTP/JSON-RPC error, or peer timeout (`PEER_TIMEOUT`). |
| `canceled` | Terminal | Canceled by the task creator or an administrator prior to reaching a terminal state. |

Once a task enters any state in `A2A_TERMINAL_STATES` (`completed`, `failed`, `canceled`), subsequent `tasks/cancel` calls fail with HTTP `409` and JSON-RPC error code `-32004`.

### JSON-RPC `params` Reference

<ParamGrid
  title="Parameters for tasks/send, tasks/get, and tasks/cancel"
  :items="[
    { name: 'id / taskId', type: 'string', required: false, default: 'a2a_<uuid>', description: 'Task identifier matching ^[a-zA-Z0-9._:-]{1,128}$. Required for tasks/get and tasks/cancel.' },
    { name: 'targetAgentId', type: 'string', required: false, default: 'dxos-coordinator', description: 'Target agent ID (defaults to external-peer when peerUrl is supplied). Aliases: agentId, metadata.targetAgentId.' },
    { name: 'sourceAgentId', type: 'string', required: false, default: 'user:<username>', description: 'Calling agent or user identifier recorded on the task.' },
    { name: 'message', type: 'object', required: true, description: 'Object { role, parts } with type=text (max 16000 chars) or type=data. Plain prompt, text, or input strings are also accepted.' },
    { name: 'peerUrl', type: 'string', required: false, description: 'HTTPS endpoint of an external A2A peer for outbound delegation after SSRF validation.' },
    { name: 'idempotencyKey', type: 'string', required: false, description: 'Per-organization deduplication key (max 255 chars); returns the existing task if authorized.' },
    { name: 'async / blocking', type: 'boolean', required: false, default: 'false / true', description: 'Set async: true or blocking: false to return immediately in working state for local tasks.' },
    { name: 'historyLength', type: 'integer', required: false, description: 'Used by tasks/get to slice the trailing N entries of messages and history.' },
    { name: 'reason', type: 'string', required: false, default: 'Canceled by caller', description: 'Used by tasks/cancel (max 300 chars), stored under metadataJson.cancelReason.' }
  ]"
/>

## Interoperability Examples

The examples below show Agent Card discovery, sending a task to `dxos-ops` with an idempotency key, inspecting and canceling a task, and delegating to an external A2A peer.

<CodeTabs :tabs="a2aTabs" />

## Security Boundaries and Failure Modes

The A2A gateway enforces strict tenant, role, network, and payload checks before writing to `latticeA2aTasks` or invoking local and remote execution paths.

| Control Layer | Runtime Enforcement in `a2a-gateway.js` | HTTP / JSON-RPC Error |
| :--- | :--- | :--- |
| Tenant spoofing protection | `assertNoCrossOrgSpoofing` validates every `organizationId` in `X-Organization-Id`, `X-Org-Id`, and `params` against the caller's `latticeEmployees` membership. | `403` / `-32003` (`A2A_CROSS_ORG_FORBIDDEN`) |
| Admin builder role lock | `authorizeTargetAgent` restricts `dxos-architect` strictly to `root` and `admin`; disabled profiles (`enabled: false`) are rejected. | `403` / `-32003` (`A2A_ROLE_FORBIDDEN`) |
| Task ownership isolation | `authorizeExistingTaskAccess` prevents non-admin users from reading, replaying via `idempotencyKey`, or canceling tasks created by other users. | `403` / `-32003` (`A2A_TASK_FORBIDDEN`) |
| Outbound peer SSRF guard | `assertSafePeerUrl` blocks embedded URL credentials, internal suffixes (`localhost`, `.local`, `.internal`), non-canonical decimal/octal/hex hosts, private/link-local IPv4/IPv6 ranges, cloud metadata hosts, and re-validates resolved DNS IPs; outbound fetch sets `redirect: 'error'`. | `400` / `-32602` (`A2A_PEER_URL_UNSAFE`) |
| Outbound PII and header scrubbing | `delegateToExternalA2aPeer` applies `redactPiiDeep` to outbound `message` and `metadata`, while `sanitizeOutboundHeaders` strips `authorization`, `cookie`, and `x-api-key`. | Applied automatically |
| Prototype pollution guard | `assertNoPrototypePollution` and `cloneSafePlain` reject `__proto__`, `constructor`, and `prototype` keys and enforce a nesting cap of 24 levels. | `400` / `-32602` (`A2A_PROTOTYPE_POLLUTION`) |
| Direct collection CRUD block | `dxosAiMemoryAndA2aScope` blocks direct REST and Chart queries against `latticeA2aTasks` for all non-`root` callers. | `403` (`DXOS_A2A_DIRECT_CRUD_FORBIDDEN`) |

### `latticeA2aTasks` Storage and Peer Timeout Behavior

Each task record in `latticeA2aTasks` is uniquely indexed on `(organizationId, taskId)` (`uidx_lattice_a2a_tasks_org_task`) alongside an idempotency lookup index (`idx_lattice_a2a_tasks_org_idem`). When delegating to an external peer through `delegateToExternalA2aPeer`, timeout values are clamped between `500ms` and `120000ms` (defaulting to `15000ms`). If the remote peer times out or returns an HTTP/JSON-RPC failure, the task transitions to `failed` with a PII-redacted error message capped at `400` characters (`PEER_TIMEOUT`, `PEER_HTTP_<status>`, or `PEER_RPC_ERROR`).

If no live LLM service is configured or available, `executeDefaultLocalAgent` falls back to `governed-local-handoff`, returning a PII-redacted receipt artifact and recording the outcome in `latticeAiAuditLogs` under `channel: 'a2a'`.

## Related

- [AI Overview & Profiles](/en/ai/overview-and-profiles): Details on all 7 AI profiles and `enforceProfileRoleLock`.
- [MCP Gateway](/en/ai/mcp-gateway): Streamable HTTP JSON-RPC 2.0 endpoint for tools, resources, and prompts.
- [Eval Lab & Guardrails](/en/ai/eval-and-guardrails): Nine PII redaction rules, daily token/cost quotas, and `latticeAiAuditLogs`.
- [Multi-Tenancy & PostgreSQL RLS](/en/architecture/multi-tenancy-rls): `FORCE ROW LEVEL SECURITY` enforcement protecting `latticeA2aTasks`.
