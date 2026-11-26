---
title: MCP Gateway (JSON-RPC 2.0)
description: Stateless Streamable HTTP JSON-RPC 2.0 Model Context Protocol endpoints (/api/dxos-mcp and /api/dxos-mcp/it-ot), Bearer authentication, role filtering, prompts, resources, and client configuration.
---

<script setup>
const mcpGatewayTabs = [
  {
    label: 'MCP Client Config (JSON)',
    lang: 'json',
    code: `{
  "mcpServers": {
    "latticedx-enterprise": {
      "transport": "http",
      "url": "https://app.example.com/api/dxos-mcp",
      "headers": {
        "Authorization": "Bearer ldx_pat_your_scoped_token"
      }
    },
    "latticedx-itot": {
      "transport": "http",
      "url": "https://app.example.com/api/dxos-mcp/it-ot",
      "headers": {
        "Authorization": "Bearer ldx_pat_your_scoped_token"
      }
    }
  }
}`,
  },
  {
    label: 'initialize & tools/list (cURL)',
    lang: 'bash',
    code: `# 1. Initialize handshake
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}'

# 2. List role-filtered tools
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'`,
  },
  {
    label: 'tools/call & resources/read',
    lang: 'bash',
    code: `# Call GraphRAG impact tool
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "dxos_graph_impact_analysis",
      "arguments": {"collection": "latticeAssets", "recordCode": "COLD-ROOM-A1", "maxDepth": 2}
    }
  }'

# Read active organization alarms resource
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "resources/read",
    "params": {"uri": "dxos://org/org-1/alarms/active"}
  }'`,
  },
];
</script>

# MCP Gateway (JSON-RPC 2.0)

The Model Context Protocol gateway (`mcp-gateway.js`) exposes LatticeDX tools, operational context resources, and prompt templates to external MCP clients and internal agent profiles over **stateless Streamable HTTP JSON-RPC 2.0**.

Two dedicated POST endpoints partition enterprise tools from live IT/OT operations:

- **`/api/dxos-mcp`** (`serverInfo.name: "latticedx-enterprise-mcp"`): Serves the **20 Unified Tools** covering schema/portal building, App Builder 2.0, operational workflows, GraphRAG, HITL approvals, and persistent agent memory.
- **`/api/dxos-mcp/it-ot`** (`serverInfo.name: "latticedx-itot-mcp"`): Serves the **4 Dedicated IT/OT Tools** (`get_live_ngsi_telemetry`, `get_sensor_and_incident_timeline`, `get_stack_connector_health`, `dispatch_itot_webhook_or_sync`).

Any `GET` or `DELETE` request against either endpoint returns HTTP `405` with JSON-RPC error `-32000` indicating that callers must send JSON-RPC `POST` requests.

## Bearer Authentication, Role Filtering & Audit Logging

The gateway authenticates every request through `extractBearerToken` and `defaultResolveHostAuth`:

| Control Layer | Enforcement Rule |
| :--- | :--- |
| Bearer credential | Clients pass `Authorization: Bearer <token>` using either a NocoBase JWT or a scoped `ldx_pat_*` API key. Missing or invalid credentials return HTTP `401` with `WWW-Authenticate: Bearer realm="LatticeDX-MCP", error="invalid_token"`, JSON-RPC error `-32001`, and a `denied` (`MCP_UNAUTHORIZED`) record in `latticeAiAuditLogs`. |
| Optional `X-Role` narrowing | Clients may send `X-Role: <roleName>`. The gateway accepts the override only when `<roleName>` belongs to the user's assigned `rolesUsers` records. |
| Automatic admin filtering | When `isStudioAdmin` evaluates to `false`, the gateway excludes all `adminOnly: true` tools (11 builder tools on `/api/dxos-mcp` and `get_stack_connector_health` on `/api/dxos-mcp/it-ot`) and `adminOnly: true` prompts from `tools/list`, `prompts/list`, `tools/call`, and `prompts/get` (returning `-32003` on direct invocation attempts). |
| Audit channels | Requests on `/api/dxos-mcp` are logged under `channel: "mcp-enterprise"` and requests on `/api/dxos-mcp/it-ot` under `channel: "mcp-itot"`. |

## Gateway & Discovery Endpoints

<ApiEndpoint
  method="POST"
  path="/api/dxos-mcp"
  auth="Bearer JWT | ldx_pat_*"
  scope="mcp-enterprise"
  summary="Stateless Streamable HTTP JSON-RPC 2.0 endpoint for the 20 Unified Tools, prompts, and resources."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxos-mcp/it-ot"
  auth="Bearer JWT | ldx_pat_*"
  scope="mcp-itot"
  summary="Stateless Streamable HTTP JSON-RPC 2.0 endpoint for the 4 IT/OT telemetry, timeline, health, and dispatch tools."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:mcpCatalog"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Returns the full catalog of 20 + 4 tools with inputSchema, prompts, resources, Agent Card, and a ready-to-use client JSON snippet."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:testMcpEndpoint"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Probes the internal /api/dxos-mcp or /api/dxos-mcp/it-ot endpoint with an initialize handshake and measures latency."
/>

## Supported JSON-RPC 2.0 Methods

The gateway negotiates protocol versions listed in `SUPPORTED_PROTOCOL_VERSIONS`: `'2025-03-26'` (default fallback when an unknown version is requested) and `'2024-11-05'`.

| JSON-RPC Method | HTTP Status | Behavior & Response |
| :--- | :--- | :--- |
| `initialize` | `200` | Negotiates `protocolVersion` and returns `capabilities` (`tools`, `resources`, `prompts`) plus `serverInfo` (`name`, `version`). |
| `notifications/initialized` | `202` | Acknowledges initialization completion with `{ "ok": true }`. |
| `ping` | `200` | Liveness check returning `{}`. |
| `tools/list` | `200` | Returns `{ tools: [{ name, description, inputSchema }] }` filtered by caller admin status. |
| `tools/call` | `200` | Executes `tool.invoke(ctx, args)` and wraps output as `content: [{ type: "text", text }]` with `isError` (`-32003` on authorization failure). |
| `prompts/list` | `200` | Returns visible entries from `MCP_PROMPT_CATALOG` filtered by caller admin status. |
| `prompts/get` | `200` | Validates required arguments (stripping CR/LF/NUL, clamping to 200 chars) and returns rendered `user` role messages. |
| `resources/templates/list` | `200` | Returns URI templates for organization alarms, GraphRAG lineage, and admin infrastructure resources. |
| `resources/list` | `200` | Returns concrete resource URIs scoped to the caller's `organizationId` and admin privileges. |
| `resources/read` | `200` | Returns JSON resource contents; returns `-32003` on cross-organization access or insufficient RBAC grants. |

### Built-In MCP Prompt Catalog (`MCP_PROMPT_CATALOG`)

| Prompt Name | `adminOnly` | Arguments | Guided Workflow |
| :--- | :--- | :--- | :--- |
| `dxos-cold-chain-incident-triage` | `false` | `assetCode` *(required)*, `incidentCode` | Calls `get_live_ngsi_telemetry`, runs `dxos_graph_impact_analysis`, searches P.A.R.A. SOPs, and proposes `dxos_alarm_action`. |
| `dxos-fefo-dispatch-audit` | `false` | `lotCode` *(required)*, `sku` | Traverses FEFO stock lot lineage (`maxDepth=3`), compares `mktCelsius` against `targetTempMaxC`, and compiles `[collection:code#id]` citations. |
| `dxos-executive-radar-brief` | `false` | `focusArea` | Runs `dxos_orchestrate_enterprise_case(mode="radar")` and `dxos_my_workflow_tasks(action="list")` to surface bottlenecks. |
| `dxos-system-blueprint-architect` | `true` | `portalSlug` *(required)*, `goal` *(required)* | Calls `dxos_recommend_page_blueprint` and authors Creative Blocks or workspaces backed by Time-Machine snapshots. |

### MCP Resource URIs (`resources/read`)

| URI / URI Template | Access Control | Returned Payload |
| :--- | :--- | :--- |
| `dxos://org/{organizationId}/alarms/active` | Same-org member + `latticeIncidentCases` view RBAC | Up to 50 open alarms (excluding `closed`/`cleared`), PII-redacted via `redactPiiDeep`. |
| `dxos://org/{organizationId}/lineage/{collection}/{recordId}` | Same-org member + target `collection` view RBAC | GraphRAG lineage impact result from `analyzeGraphImpact` at `maxDepth: 2`. |
| `dxos://topology/planes` | `admin` on `/api/dxos-mcp` | Full 6-Plane DX-OS topology and live service probes from `buildEnterpriseTopology`. |
| `dxos://itot/health` | `admin` on `/api/dxos-mcp/it-ot` | Filtered live status for `itOtDigitalTwin` and `integrationEventBus`. |

### JSON-RPC Request Parameters & Error Codes

<ParamGrid
  title="JSON-RPC 2.0 Envelope Parameters on /api/dxos-mcp"
  :items="[
    { name: 'jsonrpc', type: 'string', required: true, default: '2.0', description: 'Required JSON-RPC protocol version string.' },
    { name: 'id', type: 'string | number | null', description: 'Correlation identifier returned verbatim in the response (omitted for notifications).' },
    { name: 'method', type: 'string', required: true, description: 'MCP method: initialize, notifications/initialized, ping, tools/list, tools/call, prompts/list, prompts/get, resources/templates/list, resources/list, resources/read.' },
    { name: 'params.protocolVersion', type: 'string', default: '2025-03-26', description: 'Requested MCP version during initialize (2025-03-26 or 2024-11-05).' },
    { name: 'params.name', type: 'string', description: 'Target tool name (tools/call) or prompt name (prompts/get).' },
    { name: 'params.arguments', type: 'object', description: 'Argument object passed to the tool or prompt template.' },
    { name: 'params.uri', type: 'string', description: 'Target dxos:// resource URI for resources/read.' }
  ]"
/>

| JSON-RPC Error Code | HTTP Status | Meaning & Gateway Behavior |
| :--- | :--- | :--- |
| `-32001` | `401` | Missing or invalid Bearer token; includes `WWW-Authenticate` header and writes an `MCP_UNAUTHORIZED` audit log entry. |
| `-32000` | `405` | Non-POST HTTP method (`GET` or `DELETE`) sent to the stateless Streamable HTTP endpoint. |
| `-32003` | `200` | Authorization failure: non-admin invoking `adminOnly` tools/prompts, cross-organization resource read, or missing RBAC grant. |
| `-32601` | `200` | Unsupported JSON-RPC `method` name. |
| `-32602` | `200` | Invalid parameters: missing required prompt argument, forbidden collection name, or unknown `dxos://` resource URI. |

When an authorized tool fails during `tools/call` due to domain validation or execution errors, the gateway returns a standard JSON-RPC `result` containing `isError: true` and the error text in `content[0].text`.

## Outbound MCP SSRF Controls (`validateMcpServerUrl`)

When administrators register external `mcpServers` entries on `latticeAiProfiles` or invoke `dxosAi:testMcpEndpoint`, `validateMcpServerUrl` (`ai-schemas.js`) enforces strict SSRF guardrails:

- Permits only `http:` and `https:` schemes and forbids embedded `username:password` credentials.
- Rejects non-canonical integer, hex (`0x...`), or octal (`0...`) host notations.
- Blocks private, wildcard, and cloud metadata addresses (`169.254.*`, `metadata.google.internal`, `metadata.azure.com`) outside `LOOPBACK_HOSTS` (`localhost`, `127.0.0.1`, `[::1]`, `::1`, `host.docker.internal`).
- Restricts plain `http://` to `LOOPBACK_HOSTS`, `STACK_HTTP_HOSTS` (`orion-ld`, `n8n`, `keycloak`, `nocobase`, `lattice-dx-orion-ld`, `lattice-dx-n8n`, `lattice-dx-keycloak`), or hosts explicitly added to `DXOS_MCP_INTERNAL_HTTP_ALLOWLIST`. External MCP servers must use `https://`.

## Client Configuration & Request Examples

<CodeTabs :tabs="mcpGatewayTabs" />

## Related

- [Unified Tools Reference](/en/ai/unified-tools)
- [Agent-to-Agent (A2A) Protocol](/en/ai/a2a-protocol)
- [AI Studio Overview & 7 Agent Profiles](/en/ai/overview-and-profiles)
- [Scoped API Keys (`ldx_pat_*`)](/en/reference/api-keys)
