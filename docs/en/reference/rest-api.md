---
title: REST API Reference
description: NocoBase resource/action conventions, catalog of 31 plugin resources, Fastify /v1/* routes, pagination, filtering, and error envelopes.
---

<script setup>
const apiExampleTabs = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `# Paginated order query with a scoped API key
curl -sS -G "https://app.example.com/api/latticeOrders:list" \\
  -H "X-Lattice-API-Key: ldx_pat_a1b2c3d4_0123456789abcdef0123456789abcdef" \\
  --data-urlencode "page=1" \\
  --data-urlencode "pageSize=20" \\
  --data-urlencode "sort=-id"

# Draft voucher update with optimistic locking
curl -sS -X POST "https://app.example.com/api/latticeOrders:update?filterByTk=42" \\
  -H "Authorization: Bearer <OIDC_OR_PAT_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -H 'If-Match: "3"' \\
  -d '{"values":{"notes":"Batch verified"}}'`,
  },
  {
    label: 'TypeScript',
    lang: 'ts',
    code: `export async function fetchOrdersPage(
  baseUrl: string,
  apiKey: string,
  page = 1,
  pageSize = 20,
) {
  const url = new URL('/api/latticeOrders:list', baseUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('sort', '-id');

  const res = await fetch(url, {
    headers: {
      'X-Lattice-API-Key': apiKey,
      'Accept': 'application/json',
    },
  });

  const payload = await res.json();
  if (!res.ok) {
    const message = payload?.errors?.[0]?.message || payload?.error || \`HTTP \${res.status}\`;
    throw new Error(message);
  }
  return payload as {
    data: unknown[];
    meta: { count: number; page: number; pageSize: number };
  };
}`,
  },
];
</script>

# REST API Reference

LatticeDX exposes two complementary HTTP surfaces behind the shared edge perimeter (Caddy TLS and Apache APISIX): the NocoBase host resource API at `/api/<resource>:<action>` enforced by `latticeNativeScope` and PostgreSQL 16 `FORCE ROW LEVEL SECURITY`, and the companion Fastify Core API at `/v1/*` (`:4000`) serving workflows, files, entities, and operational endpoints.

## Authentication Headers and Gateway Routing

All inbound requests to `/api/*` and `/v1/*` traverse Apache APISIX (`:9080` internal, `:8080` local), which injects `X-Request-Id` globally and applies Redis-backed `limit-count` rate limits.

<ParamGrid
  title="Standard HTTP Headers"
  :items="[
    { name: 'Authorization', type: 'string', required: false, description: 'Bearer JWT from NocoBase/Keycloak OIDC or scoped personal access token formatted as Bearer ldx_pat_*.' },
    { name: 'X-Lattice-API-Key', type: 'string', required: false, description: 'Scoped PaaS personal access token (ldx_pat_<8hex>_<32hex>) accepted as an alternative to Authorization Bearer.' },
    { name: 'X-Role', type: 'string', required: false, description: 'Requested role for multi-role sessions. When authenticating with ldx_pat_*, middleware clamps X-Role to the key bound role.' },
    { name: 'X-Authenticator', type: 'string', required: false, description: 'NocoBase authenticator identifier (default basic or lattice-keycloak).' },
    { name: 'X-Lattice-Edge-Token', type: 'string', required: false, description: 'Edge device ingestion token for public IIoT ingestion actions such as telemetryIngest and deviceStatusIngest.' },
    { name: 'If-Match / X-Expected-Version', type: 'string', required: false, description: 'Optimistic concurrency token when updating vouchers or assets (positive integer).' },
    { name: 'Idempotency-Key', type: 'string', required: false, description: 'Replay-safe deduplication header on Fastify /v1/* creation routes.' },
    { name: 'traceparent', type: 'string', required: false, description: 'W3C Trace Context header propagated through to the OpenTelemetry Collector.' }
  ]"
/>

APISIX enforces four `limit-count` tiers keyed by `remote_addr` over a `60`-second window:

| APISIX Route Tier | Representative Paths | Limit (`req/60s`) | Notes |
|---|---|---|---|
| `dxos-telemetry-ingest` | `/api/dxosBlocks:telemetryIngest`, `/api/dxosBlocks:alarmIngest`, `/api/dxosBroker:deviceStatusIngest`, `/api/dxosBroker:orionNotify` | `300` | High-throughput ingestion for edge sensors and Orion-LD |
| `dxos-core-api` | `/api/*` | `240` | Default ceiling for CRUD and domain resource actions |
| `dxos-public-paas` | `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/api/dxosForms:*`, `/api/dxosWms:publicTrack`, `/.well-known/agent-card.json` | `120` | Protects unauthenticated discovery and public tracking portals |
| `dxos-enterprise-auth` & `dxos-mcp` | `/api/enterpriseAuth:*`, `/api/dxos-oidc/*`, `/api/dxos-mcp/*` | `120` | Configured with `600s` read/send timeouts for MCP streaming |

## URL Conventions, Envelopes, and Pagination

### NocoBase Surface (`/api/<resource>:<action>`)

Resources registered through NocoBase `resourceManager.define` separate resource name and action with a colon, such as `/api/dxosWms:issueStock` or `/api/latticeOrders:list?page=1&pageSize=20`.

<ApiEndpoint
  method="GET"
  path="/api/latticeOrders:list?page=1&pageSize=20&sort=-id"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Lists orders automatically scoped to the caller organizationId and enforced by PostgreSQL FORCE RLS."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:issueStock"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write | wms"
  summary="Issues FEFO stock lots against order lines inside a tenant-scoped RLS transaction."
/>

Responses follow two envelope modes:

1. **Standard Data Wrapping (`dataWrapping`)**: Returns `{ "data": <payload>, "meta": { "count": <n>, "page": <n>, "pageSize": <n>, "totalPage": <n> } }` for paginated queries, or `{ "data": <object> }` for single-record operations.
2. **Raw Response (`ctx.withoutDataWrapping = true`)**: Emits raw JSON or plain text without a `data` wrapper. Used by `/api/dxActions:*`, `/api/dxos:metrics` (Prometheus text), `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `/api/dxos-a2a`, and `/.well-known/agent-card.json`.

### Pagination Bounds and Safe Filtering (`latticeNativeScope`)

The `createNativeScopeMiddleware` guard validates every query parameter before Sequelize executes SQL:

<ParamGrid
  title="NocoBase Query Parameters"
  :items="[
    { name: 'page', type: 'integer', required: false, default: '1', description: 'Page index bounded to 1..100000.' },
    { name: 'pageSize / limit', type: 'integer', required: false, default: '20', description: 'Records per page, clamped to 1..200 (dxosApiKeys:list defaults to 50).' },
    { name: 'sort', type: 'string | string[]', required: false, description: 'Sort fields (prefix - for descending). Rejects dotted paths and sensitive field names.' },
    { name: 'filter', type: 'object | json', required: false, description: 'Sequelize filter object ($eq, $in, $and, $or, $startsWith). Automatically intersected with { organizationId: actor.organizationId }.' },
    { name: 'expectedVersion', type: 'integer', required: false, description: 'Supplied via body values.expectedVersion, query string, or If-Match header. Returns 409 VERSION_CONFLICT on mismatch.' }
  ]"
/>

Security guards fail closed on invalid query shapes:

| Security Guard | Validation Rule & Error Code |
| :--- | :--- |
| Relation expansion and raw operator blocks (`NATIVE_RELATION_EXPANSION_UNSUPPORTED`) | Rejects `appends`, `targetCollection`, dotted `fields`/`sort` entries (except self-actor mapping for `requester.userId` and `assignee.userId`), raw SQL keys (`$where`, `$raw`, `$sql`), prototype-pollution keys (`__proto__`, `constructor`, `prototype`), and sensitive column patterns (`password`, `secret`, `token`, `apikey`, `privateKey`, `hash`, `salt`). |
| Private collection guards | Non-`root` callers cannot access `latticeApiKeys`, `latticePkiKeys`, `latticeCryptoLedger`, `latticeConnectors`, `latticeWebhookSubscriptions`, `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices`, `latticeBrokerSubscriptions`, `latticeFrozenSnapshots`, `latticeDataLineage`, `latticeDataQuarantine`, or `latticeOrganizations` via generic collection REST (`403 PAAS_PRIVATE_COLLECTION_FORBIDDEN`). Callers must invoke the dedicated domain resources (`dxosApiKeys`, `dxosLedger`, `dxosVault`, `dxosEvents`, `dxosBlocks`, `dxosBroker`, `dxosDataGov`, `dxosBuilder`). |
| Voucher immutability (`VOUCHER_IMMUTABLE`) | On `latticeRequests` and `latticeOrders`, updates to records in `submitted`, `approved`, `completed`, or `cancelled` status fail with `409`, and `destroy` is blocked (`NATIVE_DOCUMENT_DELETE_UNSUPPORTED`). Revisions use `latticeVoucher:cancel` followed by `latticeVoucher:amend`. |

## Catalog of 31 NocoBase Resources (`resourceManager.define`)

All domain endpoints are registered across the 7 official Apache-2.0 plugins under `plugins/nocobase/`:

| # | Resource | Owning Plugin | Primary Actions |
|---|---|---|---|
| 1 | `dxos` | `@latticedx/plugin-lattice-foundation` | `health`, `metrics`, `openapi`, `asyncapi`, `manifest`, `sw.js`, `icon-192.png`, `icon-512.png` |
| 2 | `dxosApiKeys` | `@latticedx/plugin-lattice-foundation` | `issue`, `list`, `revoke` |
| 3 | `dxosLedger` | `@latticedx/plugin-lattice-foundation` | `publicKey`, `entries`, `status`, `verify`, `signDocument`, `verifySignature`, `rotateKey`, `exportProof` |
| 4 | `dxosDataGov` | `@latticedx/plugin-lattice-foundation` | `tierSummary`, `freezeSnapshot`, `listSnapshots`, `lineage`, `listQuarantine`, `resolveQuarantine`, `computeMkt` |
| 5 | `dxosVault` | `@latticedx/plugin-lattice-foundation` | `list`, `save`, `rotateSecret`, `delete`, `testConnection` |
| 6 | `dxosEvents` | `@latticedx/plugin-lattice-foundation` | `listEvents`, `publish`, `listSubscriptions`, `saveSubscription`, `toggleSubscription`, `deleteSubscription`, `listDeliveries`, `dispatchNow`, `replayDlq`, `resetCircuit` |
| 7 | `dxosApprovals` | `@latticedx/plugin-lattice-foundation` | `listInbox`, `decide`, `request`, `cancel`, `listPolicies`, `savePolicy`, `deletePolicy`, `evaluateSlaNow` |
| 8 | `dxosNotify` | `@latticedx/plugin-lattice-foundation` | `send`, `testSend`, `logs`, `channels` |
| 9 | `dxosForms` | `@latticedx/plugin-lattice-foundation` | `meta`, `submit`, `status`, `list`, `get`, `save`, `delete`, `rotateToken` |
| 10 | `latticeNative` | `@latticedx/plugin-lattice-foundation` | `context` |
| 11 | `latticeApps` | `@latticedx/plugin-lattice-foundation` | `list`, `get` |
| 12 | `latticePortals` | `@latticedx/plugin-lattice-foundation` | `list`, `save`, `compose` |
| 13 | `latticeChatter` | `@latticedx/plugin-lattice-foundation` | `list`, `post` |
| 14 | `latticeVoucher` | `@latticedx/plugin-lattice-foundation` | `submit`, `cancel`, `amend`, `lineage` |
| 15 | `latticeNotifications` | `@latticedx/plugin-lattice-foundation` | `listMine`, `unreadCount`, `markRead`, `markAllRead` |
| 16 | `latticeSla` | `@latticedx/plugin-lattice-foundation` | `summary`, `policies`, `savePolicy`, `evaluateNow` |
| 17 | `latticeContextSync` | `@latticedx/plugin-lattice-foundation` | `dispatch`, `status`, `retry` |
| 18 | `latticeIntegrations` | `@latticedx/plugin-lattice-foundation` | `receive`, `receiveAlert`, `propose`, `proposalReceipt`, `record`, `context`, `proposals` |
| 19 | `latticePara` | `@latticedx/plugin-dxos-para` | `summary`, `hybridSearch`, `extractAttachment`, `reindex` |
| 20 | `dxosBlocks` | `@latticedx/plugin-dxos-blocks` | `proposals`, `decideProposal`, `contextTelemetry`, `telemetrySeries`, `telemetryIngest`, `alarmIngest`, `alarmAck`, `alarmClear`, `exportReport`, `globalSearch`, `twinShadow`, `twinSetDesired`, `twinAckCommand`, `bulkImportDryRun`, `bulkImportCommit`, `collectionsMeta`, `aggregateQuery` |
| 21 | `dxosBroker` | `@latticedx/plugin-dxos-blocks` | `listDevices`, `provisionDevice`, `revokeDevice`, `deviceStatusIngest`, `orionEntities`, `orionListSubscriptions`, `orionCreateSubscription`, `orionToggleSubscription`, `orionDeleteSubscription`, `orionNotify` |
| 22 | `dxosStudio` | `@latticedx/plugin-dxos-studio` | `listTemplates`, `listEmployees`, `installWorkflow`, `composePortals`, `pluginStatus`, `readiness`, `outboxDlqList`, `outboxDlqReplay`, `solutionBundleExport`, `solutionBundleDiff`, `solutionBundleImport`, `solutionBundleRollback` |
| 23 | `dxosWms` | `@latticedx/plugin-dxos-studio` | `stockSummary`, `receiveStock`, `issueStock`, `epodCapture`, `publicTrack`, `verifyTrackSignature` |
| 24 | `dxosDmn` | `@latticedx/plugin-dxos-studio` | `listTables`, `saveTable`, `evaluate`, `delegations`, `saveDelegation` |
| 25 | `dxosDelegations` | `@latticedx/plugin-dxos-studio` | `list`, `save`, `revoke` |
| 26 | `dxosAutomations` | `@latticedx/plugin-dxos-studio` | `listRules`, `saveRule`, `toggleRule`, `deleteRule`, `listRuns`, `runNow`, `replayRun` |
| 27 | `dxosBuilder` | `@latticedx/plugin-dxos-studio` | `listDomains`, `createDomain`, `listBusinessPacks`, `installBusinessPack`, `listTenants`, `provisionTenant` |
| 28 | `dxosN8n` | `@latticedx/plugin-dxos-studio` | `status`, `appCatalog`, `workflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`, `activateWorkflow`, `executions`, `retryExecution`, `syncCredential` |
| 29 | `dxosAi` | `@latticedx/plugin-dxos-ai` | `listProfiles`, `saveProfile`, `deleteProfile`, `bootstrapDefaults`, `portalAgents`, `auditLogs`, `quotaSummary`, `enterpriseTopology`, `pageSurfaceState`, `inspectPageBlocks`, `rollbackPageSnapshot`, `surfaceEvents`, `listApprovals`, `approveAction`, `rejectAction` |
| 30 | `dxActions` | `@latticedx/plugin-action-bridge` | `connect`, `callback`, `status`, `catalog`, `list`, `run`, `files`, `workflow`, `studio`, `entity`, `agent`, `logistics`, `disconnect` |
| 31 | `enterpriseAuth` | `@latticedx/plugin-enterprise-auth` | `start`, `callback`, `finish`, `backchannelLogout`, `configuration`, `link`, `listLinkTargets`, `listMappings`, `unlink` |

In addition to these 31 core resources, `@latticedx/plugin-lattice-foundation` registers `latticeRequestAttachments` for ClamAV-scanned attachments (1 MiB cap), and `@latticedx/plugin-dxos-ai` mounts the AI protocol endpoints `POST /api/dxos-mcp`, `POST /api/dxos-mcp/it-ot`, `GET /.well-known/agent-card.json`, `GET /api/dxos-a2a/agent-card.json`, and `POST /api/dxos-a2a`. Dynamic `latticeCustom*` collections provisioned through `dxosBuilder` expose standard `list`, `get`, `create`, `update`, and `destroy` actions at `/api/latticeCustom<Name>:<action>`.

## Fastify Core API Surface (`/v1/*`)

The Fastify Core API (`apps/api/src/app.ts`, default port `4000`) enforces a `16 KiB` request body limit (`bodyLimit: 16_384`), an in-memory sliding-window rate limiter (`API_RATE_LIMIT_MAX=1000` per `60s`, emitting `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on `429`), and a uniform error payload `{ "error": "<message>" }`.

<ParamGrid
  title="Fastify /v1/* Pagination and Envelope"
  :items="[
    { name: 'limit', type: 'integer', required: false, default: '50', description: 'Maximum items returned per page, bounded to 1..100.' },
    { name: 'offset', type: 'integer', required: false, default: '0', description: 'Zero-based item offset (>= 0).' },
    { name: 'q', type: 'string', required: false, description: 'Search query string, maximum 200 characters.' },
    { name: 'items / page', type: 'object', required: true, description: 'Response shape: { items: [...], page: { limit, offset, hasMore, nextOffset } }.' }
  ]"
/>

Major Fastify `/v1/*` route groups include:

| Route Group | Representative Endpoints |
| :--- | :--- |
| Health and Operations | `GET /health`, `/v1/operations/diagnostics`, `/v1/operations/metrics`, `/v1/operations/queues`, `/v1/operations/retention-preview`, `/v1/system-*` |
| Records, Entities, and Tasks | `/v1/records`, `/v1/records/:id`, `/v1/entities*`, `/v1/entity-*`, `/v1/tasks*`, `/v1/files*`, `/v1/actions*`, `/v1/blocks*` |
| Directory, Workflows, and Integrations | `/v1/directory/*`, `/v1/organization/*`, `/v1/workflow-*`, `/v1/logistics/orders*`, `/v1/integrations/ngsi-ld/*`, `/v1/enterprise-modules*`, `/v1/studio/*`, `POST /v1/agent/demo` |

## Request Examples and Error Handling

<CodeTabs :tabs="apiExampleTabs" />

### Error Envelopes and Common Status Codes

NocoBase endpoints serialize errors as `{ "errors": [{ "message": "...", "code": "..." }] }`, whereas Fastify `/v1/*` endpoints return `{ "error": "..." }`.

| HTTP Status | Meaning | Typical Cause |
|---|---|---|
| `400` | Bad Request | Missing required field, malformed `expectedVersion`, `q` exceeding 200 chars, or invalid JSON payload |
| `401` | Unauthorized | Missing credential, expired PAT (`API_KEY_EXPIRED`), revoked PAT (`API_KEY_REVOKED`), or backchannel-revoked OIDC session |
| `403` | Forbidden | Missing `ldx_pat_*` scope (`API_KEY_SCOPE_INSUFFICIENT`), cross-org mismatch (`NATIVE_ORGANIZATION_MISMATCH`), or private collection guard |
| `409` | Conflict | Stale `expectedVersion` (`VERSION_CONFLICT`) or editing a locked voucher (`VOUCHER_IMMUTABLE`) |
| `429` | Too Many Requests | Exceeded APISIX `limit-count` (`120`/`240`/`300` req/60s) or Fastify sliding-window limit |

## Related

- [Scoped API Keys](/en/reference/api-keys)
- [OpenAPI 3.1 & AsyncAPI 3.0](/en/reference/openapi-asyncapi)
- [Multi-Tenancy & PostgreSQL RLS](/en/architecture/multi-tenancy-rls)
- [Zero-Trust Security Model](/en/architecture/security-model)
