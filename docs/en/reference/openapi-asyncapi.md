---
title: OpenAPI 3.1 & AsyncAPI 3.0
description: Runtime discovery endpoints for OpenAPI 3.1.0 and AsyncAPI 3.0.0, dynamic latticeCustom* collection schemas, and client generation.
---

<script setup>
const specUsageTabs = [
  {
    label: 'cURL & OpenAPI Codegen',
    lang: 'bash',
    code: `# Download OpenAPI 3.1.0 and AsyncAPI 3.0.0 specs
curl -fsS "https://app.example.com/api/dxos:openapi" -o openapi.json
curl -fsS "https://app.example.com/api/dxos:asyncapi" -o asyncapi.json

# Generate TypeScript definitions from OpenAPI 3.1.0
npx openapi-typescript ./openapi.json -o ./src/types/latticedx-api.d.ts`,
  },
  {
    label: 'TypeScript (SSE)',
    lang: 'ts',
    code: `// Subscribe to surfaceEventsSse as declared in AsyncAPI 3.0.0
export function subscribeSurfaceUpdates(baseUrl: string, token: string) {
  const controller = new AbortController();
  fetch(\`\${baseUrl}/api/dxosAi:surfaceEvents\`, {
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Accept': 'text/event-stream',
    },
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) throw new Error(\`SSE error \${res.status}\`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      console.log(decoder.decode(value, { stream: true }));
    }
  });
  return () => controller.abort();
}`,
  },
];
</script>

# OpenAPI 3.1 & AsyncAPI 3.0

LatticeDX generates both machine-readable interface specifications dynamically at runtime via `openapi-spec.js` and `observability.js`: an OpenAPI `3.1.0` specification covering the HTTP REST and MCP endpoints, and an AsyncAPI `3.0.0` specification covering MQTT telemetry, UI surface SSE streams, Redis Pub/Sub channels, and NGSI-LD outbox webhooks.

## Discovery Endpoints

Both discovery endpoints set `ctx.withoutDataWrapping = true`, return raw JSON with `Cache-Control: no-store`, and allow public read access so API gateways, documentation portals, and code generators can poll them directly.

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Public (APISIX 120 req/60s)"
  summary="Returns the live OpenAPI 3.1.0 document covering static domain actions and active dynamic latticeCustom* collections."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public (APISIX 120 req/60s)"
  summary="Returns the live AsyncAPI 3.0.0 document describing 3 servers (MQTT, HTTP/SSE, Redis Pub/Sub) and 5 asynchronous channels."
/>

### Server URL Resolution

`resolveRequestServerUrl` and `normalizeServerUrl` compute `servers[0].url` in priority order:

1. Reads protocol from `x-forwarded-proto` (`http` or `https`, using the first proxy value).
2. Reads hostname/port from `x-forwarded-host` or `host`, validating against `^[a-zA-Z0-9.:[\]-]{1,253}$`.
3. Rejects URLs containing embedded credentials (`username`/`password`) and falls back to `http://localhost:13014` when no valid host header is present.

## OpenAPI 3.1.0 Specification Structure

The OpenAPI document targets `openapi: "3.1.0"` with `Apache-2.0` license metadata and declares two global security schemes under `components.securitySchemes`:

<ParamGrid
  title="OpenAPI 3.1.0 Security Schemes"
  :items="[
    { name: 'bearerAuth', type: 'http (bearer)', required: false, default: 'JWT / ldx_pat_*', description: 'Accepts an OIDC/NocoBase Bearer JWT or a scoped PaaS Personal Access Token (Bearer ldx_pat_*).' },
    { name: 'latticeApiKey', type: 'apiKey (header)', required: false, default: 'X-Lattice-API-Key', description: 'Accepts a scoped PaaS API key passed via the X-Lattice-API-Key header.' }
  ]"
/>

Unauthenticated endpoints such as `/api/dxos:health`, `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/api/dxosWms:publicTrack`, `/api/dxosBroker:deviceStatusIngest`, `/api/dxosBroker:orionNotify`, and `/api/dxosForms:{meta,submit,status}` declare `security: []`. All protected routes require either `bearerAuth` or `latticeApiKey` and standardize `400`, `401`, and `403` error responses.

### Operation Tags and `operationId` Naming

Each entry in `API_OPERATIONS` receives a deterministic `operationId` via `makeOperationId(pathStr, method)` (such as `get_dxosLedgerEntries` or `post_dxosWmsIssueStock`) grouped under semantic tags:

| Domain Group | OpenAPI Tag Names |
| :--- | :--- |
| Platform & Security | `Observability`, `PaaS API Keys`, `PKI & Crypto Ledger`, `Data Governance`, `Connector & Secrets Vault`, `Event Bus & Webhooks` |
| Operations & Automation | `Vouchers`, `Notifications`, `SLA Engine`, `PARA Knowledge Vault`, `WMS & Cold Logistics`, `DMN Decision Engine`, `Native Automation Engine`, `Unified Approvals`, `Omnichannel Notifications`, `Public Forms` |
| Studio, Integration & AI | `Blocks & IoT Telemetry`, `IoT Broker Control Plane`, `DX-OS Studio`, `Visual Domain Builder`, `Stock n8n Integration`, `AI Workforce & MCP`, `Dynamic Custom Domains` |

### Dynamic `latticeCustom*` Collection Introspection

`collectCustomCollections(db)` scans every runtime collection matching `/^latticeCustom[A-Za-z0-9_]+$/` and maps fields into JSON Schema definitions:

| NocoBase Field Type | Generated JSON Schema Type | Format / Constraints |
|---|---|---|
| `integer`, `bigint` | `integer` | — |
| `float`, `double`, `decimal`, `number` | `number` | — |
| `boolean` | `boolean` | — |
| `json`, `jsonb` | `object` | `additionalProperties: true` |
| `date`, `datetime`, `time` | `string` | `format: "date-time"` |
| `string` and remaining types | `string` | Populates `enum` from `uiSchema.enum` when present |

Each `latticeCustom<Name>` collection emits a schema under `#/components/schemas/<Name>` (including `id`, `organizationId`, and `required` fields derived from `allowNull === false`) plus five operations tagged `Dynamic Custom Domains`: `list` (`GET`), `get` (`GET`), `create` (`POST`), `update` (`POST`), and `destroy` (`POST`).

## AsyncAPI 3.0.0 Specification Structure

The `asyncapi: "3.0.0"` document models event-driven communication across edge devices, message brokers, the transactional outbox, and connected portal clients through **3 servers** and **5 channels**:

| Server ID | Protocol | Default Host | Role |
|---|---|---|---|
| `mqttBroker` | `mqtt` | `<host>:1883` | Eclipse Mosquitto broker for IoT telemetry and actuator downlink commands |
| `httpGateway` | `http` / `https` | `<origin>` | HTTP/SSE gateway and `latticeContextOutbox` webhook delivery |
| `redisPubSub` | `redis` | `redis:6379` | Valkey DB 1 Pub/Sub bus synchronizing UI surface mutations across workers |

### 5 Channels and Message Contracts

| Channel ID | Address | Operation (`action`) | Message Payload Schema |
|---|---|---|---|
| `iotTelemetry` | `latticedx/{org}/{entity}/telemetry` | `receive` (`ingestIotTelemetry`) | `TelemetryPoint`: `organizationId`, `entityId`, `metric`, `value`, `unit?`, `observedAt` |
| `iotDownlinkCommand` | `latticedx/{org}/{entity}/command` | `send` (`dispatchIotCommand`) | `DownlinkCommand`: `organizationId`, `entityId`, `command`, `args?`, `signatureBase64?`, `issuedAt` |
| `surfaceEventsSse` | `/api/dxosAi:surfaceEvents` | `send` (`subscribeSurfaceEvents`) | `SurfaceUpdate`: `portalSlug`, `kind?`, `organizationId?`, `revision?` |
| `redisSurfaceUpdates` | `latticedx:surface-updates` | `send` (`publishSurfaceUpdates`) | `SurfaceUpdate`: `portalSlug`, `kind?`, `organizationId?`, `revision?` |
| `contextOutboxWebhooks` | `latticeContextOutbox` | `send` (`deliverContextOutboxWebhook`) | `ContextOutboxWebhook`: `eventId`, `entityId`, `organizationId`, `collectionName`, `recordId`, `payload` |

### Message Payload Schemas (`components.messages`)

Each AsyncAPI `3.0.0` message declares `contentType: "application/json"` with strict required fields so edge gateways and webhook consumers can validate payloads ahead of ingestion:

<ParamGrid
  title="Required Fields across the 4 Message Schemas"
  :items="[
    { name: 'TelemetryPoint', type: 'object', required: true, description: 'Requires organizationId, entityId, metric, value (number), and observedAt (date-time); optional unit.' },
    { name: 'DownlinkCommand', type: 'object', required: true, description: 'Requires organizationId, entityId, command, and issuedAt (date-time); optional args and signatureBase64.' },
    { name: 'SurfaceUpdate', type: 'object', required: true, description: 'Requires portalSlug; optional kind, organizationId, and revision (integer).' },
    { name: 'ContextOutboxWebhook', type: 'object', required: true, description: 'Requires eventId, entityId, organizationId, collectionName, recordId (integer), and payload.' }
  ]"
/>

The `/api/dxosAi:surfaceEvents` SSE endpoint supports up to `1000` concurrent listeners and emits keepalive comments every `25` seconds to prevent idle timeouts across Caddy and APISIX proxies.

## SDK and Client Generation

Integrators can fetch both documents at deploy time to generate strongly typed TypeScript clients, run contract tests, or bind MQTT and SSE consumers.

<CodeTabs :tabs="specUsageTabs" />

## Related

- [REST API Reference](/en/reference/rest-api)
- [Scoped API Keys](/en/reference/api-keys)
- [Events & Transactional Outbox](/en/architecture/events-and-outbox)
- [IIoT Digital Twin](/en/domains/iiot-digital-twin)
