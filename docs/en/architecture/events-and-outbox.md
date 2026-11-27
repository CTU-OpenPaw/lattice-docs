---
title: Events, Transactional Outbox & Valkey PubSub
description: CloudEvents 1.0 schema, dxosEvents, PostgreSQL FOR UPDATE SKIP LOCKED drainers on latticeWebhookDeliveries and latticeContextOutbox, and strict Valkey 8.1 DB 0/1/2 separation.
---

<script setup>
const eventTabs = [
  {
    label: 'CloudEvent 1.0 Envelope',
    lang: 'json',
    code: `{
  "specversion": "1.0",
  "id": "9c4d1e2b-7a80-4f19-b531-6e28a104c9f0",
  "source": "latticedx/wms",
  "type": "wms.epod_captured",
  "subject": "latticeEpodRecords/884",
  "time": "2026-11-26T09:15:00.000Z",
  "datacontenttype": "application/json",
  "organizationid": "org_coldchain_01",
  "correlationid": "req_7712a9",
  "causationid": "order_1042",
  "depth": 0,
  "data": {
    "epodUid": "EPOD-20261126-884",
    "trackingCode": "LDX-TRK-9941",
    "ledgerSeq": 128
  }
}`,
  },
  {
    label: 'Standard Webhooks Headers',
    lang: 'http',
    code: `POST /hooks/coldchain-erp HTTP/1.1
Content-Type: application/json
webhook-id: msg_9c4d1e2b-7a80-4f19-b531-6e28a104c9f0_42
webhook-timestamp: 1795684500
webhook-signature: v1,9mKp7xQ2N4zR8vT1yL6wE3sA5dF0gH2jK8cB4nM1pQ=
ce-id: 9c4d1e2b-7a80-4f19-b531-6e28a104c9f0
ce-type: wms.epod_captured
ce-specversion: 1.0`,
  },
];
</script>

# Events, Transactional Outbox & Valkey PubSub

LatticeDX separates durable asynchronous delivery from ephemeral real-time fan-out. Every domain event and digital-twin projection commits atomically into PostgreSQL 16 outbox tables drained with `FOR UPDATE SKIP LOCKED`, while Valkey 8.1 is strictly partitioned across application cache (DB 0), SSE surface PubSub (DB 1), and OIDC PKCE session state (DB 2). **Valkey Streams are not used anywhere in the stack.**

## CloudEvents 1.0 Schema and `dxosEvents`

Implemented in `plugins/nocobase/plugin-lattice-foundation/src/server/event-bus.js`, `publishDomainEvent` emits envelopes conforming to **CloudEvents 1.0**. When invoked inside a business transaction, it writes an immutable event row to `latticeEventBus` and fans out pending rows into `latticeWebhookDeliveries` for every active subscription whose `eventPattern` matches the event type.

<CodeTabs :tabs="eventTabs" />

Outbound deliveries are signed according to the **Standard Webhooks** specification (`v1,<base64_hmac>`) using the `whsec_` secret decrypted from `encryptedSigningSecret` (`AES-256-GCM`) over `${webhookId}.${timestamp}.${rawBody}`, with a `toleranceSec = 300` replay window.

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:publish"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Publishes a CloudEvents 1.0 record to latticeEventBus and queues deliveries for matching webhook subscriptions."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public / Gateway"
  summary="Returns the AsyncAPI 3.0.0 specification covering 3 servers (mqttBroker, httpGateway, redisPubSub) and 5 async channels."
/>

## Outbox Drainer 1: `latticeWebhookDeliveries` (`FOR UPDATE SKIP LOCKED`)

When `DX_EVENT_BUS_DRAINER` is not `'false'`, the background drainer in `event-bus.js` ticks every `10s` (`DRAINER_INTERVAL_MS = 10000`). First, it reclaims stale locks (`status = 'processing'` with `lockedAt` older than `120_000`ms) back to `'retry_wait'`. Next, it claims a batch inside an RLS-scoped transaction without blocking concurrent workers:

```sql
SELECT d.id
FROM "latticeWebhookDeliveries" d
INNER JOIN "latticeWebhookSubscriptions" s ON s.id = d."subscriptionId"
WHERE d.status IN ('pending', 'retry_wait')
  AND (d."nextAttemptAt" IS NULL OR d."nextAttemptAt" <= :now)
  AND s.active = TRUE
  AND (
    s."circuitState" IS NULL
    OR s."circuitState" <> 'open'
    OR (s."circuitOpenUntil" IS NOT NULL AND s."circuitOpenUntil" <= :now)
  )
ORDER BY d."nextAttemptAt" ASC NULLS FIRST, d.id ASC
LIMIT :batchSize
FOR UPDATE OF d SKIP LOCKED;
```

Retry scheduling, dead-letter handling, and endpoint isolation follow four deterministic rules:

| Mechanism | Threshold / Formula | Runtime Behavior |
| :--- | :--- | :--- |
| Exponential backoff | `min(3600000, 5000 * 2^attempt) + jitter` | Triggered on timeout (`WEBHOOK_TIMEOUT_MS = 5000`ms) or non-`2xx` responses; `jitter` adds up to `25%` capped at `5000`ms. |
| Dead-letter queue (`dlq`) | `DEFAULT_MAX_ATTEMPTS = 5` | Moves exhausted deliveries to `'dlq'` for operator inspection and replay via `dxosEvents:replayDlq`. |
| Subscription circuit breaker | `CIRCUIT_FAILURE_THRESHOLD = 5`, `CIRCUIT_COOLDOWN_MS = 120000` | Opens `circuitState` for 2 minutes after 5 consecutive failures, then probes `'half_open'` on the next due batch. |
| SSRF validation | `assertSafeConnectorUrlAsync` | Resolves target DNS before every outbound HTTP call, blocking loopback, private, and cloud metadata IPs unless allowlisted. |

<ParamGrid
  title="Webhook Outbox Drainer Parameters (event-bus.js)"
  :items="[
    { name: 'DX_EVENT_BUS_DRAINER', type: 'boolean', default: 'true', description: 'Enables the 10-second periodic webhook outbox drainer.' },
    { name: 'DX_OUTBOX_MAX_ATTEMPTS', type: 'integer', default: '5', description: 'Maximum delivery attempts before moving a record to dlq.' },
    { name: 'WEBHOOK_TIMEOUT_MS', type: 'integer', default: '5000', description: 'Per-request HTTP abort timeout for outbound webhook POST calls (ms).' },
    { name: 'CIRCUIT_FAILURE_THRESHOLD', type: 'integer', default: '5', description: 'Consecutive delivery failures required to open a subscription circuit.' },
    { name: 'CIRCUIT_COOLDOWN_MS', type: 'integer', default: '120000', description: 'Cooldown duration in open state before probing half_open (ms).' }
  ]"
/>

## Outbox Drainer 2: `latticeContextOutbox` (Per-Entity FIFO NGSI-LD Sync)

Mutations on `latticeAssets`, `latticeLocations`, and `latticeDepartments` enqueue deterministic context projections into `latticeContextOutbox` (`native-context.js` and `native-context-delivery.js`) keyed by `eventId = 'native-' + sha256(projection)`.

Digital-twin synchronization requires **strict per-entity FIFO ordering** so a delayed retry cannot overwrite a newer entity state in FIWARE Orion-LD. Simultaneously, dead-lettered rows in `'failed'` state must never stall newer updates for the same entity:

```sql
SELECT o.id
FROM "latticeContextOutbox" o
WHERE o.state IN ('pending', 'retry')
  AND (o."nextAttemptAt" IS NULL OR o."nextAttemptAt" <= NOW())
  AND NOT EXISTS (
    SELECT 1
    FROM "latticeContextOutbox" older
    WHERE older."entityId" = o."entityId"
      AND older.id < o.id
      AND older.state IN ('pending', 'retry', 'processing')
  )
ORDER BY o.id
LIMIT :batchSize
FOR UPDATE OF o SKIP LOCKED;
```

When `DX_NATIVE_CONTEXT_AUTO_SYNC=true`, a `*/10 * * * * *` cron job reclaims stale locks older than `DX_OUTBOX_STALE_LOCK_MS` (`120000`ms), claims up to `10` rows per batch, and posts to `POST /ngsi-ld/v1/entityOperations/upsert?options=update` with header `NGSILD-Tenant: <organizationId>`. When owned relationships (`belongsToDepartment`, `locatedAt`) are cleared on a record, the drainer issues an explicit `DELETE /ngsi-ld/v1/entities/<entityId>/attrs/<iri>` so stale links do not remain in Orion-LD.

<ApiEndpoint
  method="GET"
  path="/api/latticeContextSync:status"
  auth="Bearer JWT (root)"
  summary="Inspects latticeContextOutbox rows filtered by eventId or state (pending, retry, processing, delivered, failed)."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticeContextSync:retry"
  auth="Bearer JWT (root)"
  summary="Resets a retry or failed native-<64hex> outbox entry back to pending for immediate re-delivery."
/>

## Valkey 8.1 Logical Database Separation (DB 0 / DB 1 / DB 2)

Valkey 8.1 (`valkey/valkey:8.1-alpine`, configured with `--appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru`) is partitioned strictly by logical database index. All durable outbox queues live in PostgreSQL (`FOR UPDATE SKIP LOCKED`); **Valkey Streams are not used**.

| Valkey DB | Environment Variable | Consumer | Stored Data & TTL |
| :--- | :--- | :--- | :--- |
| **DB 0** | `CACHE_REDIS_URL` (`redis://:${REDIS_PASSWORD}@redis:6379/0`) | NocoBase `2.2.50` (`CACHE_DEFAULT_STORE=redis`) | Shared application cache for collection metadata, ACL rules, and query cache entries. |
| **DB 1** | `PUBSUB_ADAPTER_REDIS_URL` (`redis://:${REDIS_PASSWORD}@redis:6379/1`) | NocoBase `pubSubManager` & `surface-events.js` | PubSub channel `latticedx:surface-updates` bridging record and workflow mutations to `GET /api/dxosAi:surfaceEvents` SSE (`1000` max listeners, `25s` keepalive comments). |
| **DB 2** | `DX_NATIVE_AUTH_SESSION_REDIS_URL` (`redis://:${REDIS_PASSWORD}@redis:6379/2`) | `plugin-enterprise-auth` (`policy.js`, `routes.js`) | Ephemeral OIDC PKCE `state:` (`300s`), single-use `ticket:` (`60s`), and back-channel revocation markers `revoked:` / `revoked_sid:` (`24h`). |

In addition to DB 0–2, Apache APISIX `3.19.0` connects to `redis:6379` for its `limit-count` plugin (`policy: redis`) to enforce per-IP sliding/fixed-window rate limits (`120`, `240`, or `300` requests per `60` seconds depending on the route tier).

## Related

- [Data Model](/en/architecture/data-model)
- [Zero-Trust Security Model](/en/architecture/security-model)
- [OpenAPI 3.1 and AsyncAPI 3.0 Specifications](/en/reference/openapi-asyncapi)
- [IIoT Digital Twin and Orion-LD](/en/domains/iiot-digital-twin)
