---
title: Webhooks, HMAC Signing and Cron Schedules
description: Inbound webhook verification, Standard Webhooks HMAC signing, PostgreSQL FOR UPDATE SKIP LOCKED outbox on latticeWebhookDeliveries, circuit breaker, and cron scheduler.
---

<script setup>
const webhookTabs = [
  {
    label: 'Node.js (Sign & Dispatch)',
    lang: 'js',
    code: `import crypto from "node:crypto";

const rawBody = JSON.stringify({ data: { orderCode: "ORD-2026-09", tempC: 7.4 } });
const secret = process.env.WEBHOOK_SECRET;
const hex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

await fetch("https://app.latticedx.example.com/api/dxosAutomations:webhookIngress?organizationId=org_coldchain&ruleKey=inbound_telemetry", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Lattice-Signature-256": \`sha256=\${hex}\`,
  },
  body: rawBody,
});`,
  },
  {
    label: 'cURL (Standard Webhooks)',
    lang: 'bash',
    code: `curl -sS -X POST "https://app.latticedx.example.com/api/dxosAutomations:webhookIngress?organizationId=org_coldchain&ruleKey=partner_sync" \\
  -H "Content-Type: application/json" \\
  -H "webhook-id: msg_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \\
  -H "webhook-timestamp: 1795709000" \\
  -H "webhook-signature: v1,base64_hmac_signature_here" \\
  -d '{"data":{"lotCode":"LOT-2026-11"}}'`,
  },
];
</script>

# Webhooks, HMAC Signing and Cron Schedules

LatticeDX coordinates asynchronous integrations and recurring workflows through two PostgreSQL-backed engines: a cryptographic **inbound webhook** ingress for `trigger.webhook` nodes, an outbound **`latticeWebhookDeliveries`** transactional outbox drained with `FOR UPDATE OF d SKIP LOCKED` in `event-bus.js`, and a **5-field cron scheduler** guarded by advisory locks in `flow/cron.js`.

## Inbound Webhooks (`dxosAutomations:webhookIngress`)

LatticeFlow v2 workflows containing a `trigger.webhook` node accept external HTTP requests at `dxosAutomations:webhookIngress` (`public` ACL, fail-closed when no secret is configured). The endpoint resolves `organizationId` from query/body parameters or `X-Organization-Id`, paired with `ruleKey` (or `automationCode`).

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:webhookIngress"
  auth="HMAC-SHA256 | Standard Webhooks | Bearer"
  scope="public (fail-closed)"
  summary="Verifies the inbound cryptographic signature or bearer token and executes the matching published LatticeFlow v2 workflow."
/>

<ParamGrid
  title="trigger.webhook Node & Ingress Parameters"
  :items="[
    { name: 'webhookPath', type: 'string', required: true, description: 'Logical hook path identifier (for example /hooks/inbound), recorded as the CloudEvent subject.' },
    { name: 'authMode', type: 'string', default: 'hmac', description: 'Verification mode: hmac (HMAC-SHA256 or Standard Webhooks) or bearer.' },
    { name: 'secretHeader', type: 'string', default: 'X-Lattice-Signature-256', description: 'Header name carrying the sha256=<hex> signature in hmac mode.' },
    { name: 'connectorKey', type: 'string', description: 'Optional webhook connector key in dxosVault supplying the signing secret (checked ahead of ruleKey fallbacks).' }
  ]"
/>

`resolveWebhookSecret` searches Connector Vault in deterministic order (`connectorKey`, `secretConnectorKey`, `webhook:<ruleKey>`, `webhook-<ruleKey>`, `webhookPath`, `ruleKey` for `connectorType === 'webhook'`) before falling back to rule-level configuration. If no secret exists, `dispatchWebhookIngress` rejects with `401 WEBHOOK_SIGNATURE_INVALID`.

Constant-time verification (`timingSafeEqualHex`) supports three authentication formats:

| Format | `authMode` | Verification Rule |
| :--- | :---: | :--- |
| Raw-body HMAC-SHA256 | `hmac` | Computes `HMAC-SHA256(secret, rawBody)` (base64-decoding `whsec_` prefixed secrets) and compares against `X-Lattice-Signature-256` (accepting either `sha256=<hex>` or raw hex). |
| Standard Webhooks Fallback | `hmac` | When the custom signature header is empty and `webhook-signature` is present, `verifyStandardWebhookSignature` validates `webhook-id`, `webhook-timestamp` (within a `toleranceSec = 300` second replay window), and `webhook-signature: v1,<base64>` signed over `<webhookId>.<timestamp>.<rawBody>`. |
| Bearer Token | `bearer` | Hashes the `Authorization: Bearer <token>` header with SHA-256 and compares in constant time against `sha256(secret)`. |

<CodeTabs :tabs="webhookTabs" />

## Outbox `latticeWebhookDeliveries` & `FOR UPDATE SKIP LOCKED`

When a service or `event.emit` node calls `publishDomainEvent`, LatticeDX atomically inserts the CloudEvents `1.0` envelope into `latticeEventBus` and fans out pending delivery rows into `latticeWebhookDeliveries` for every active `latticeWebhookSubscriptions` record whose `eventPattern` glob matches the event type (supporting comma-separated patterns and `*` wildcards).

Direct CRUD access to `latticeEventBus`, `latticeWebhookSubscriptions`, and `latticeWebhookDeliveries` is blocked by `registerEventBusDirectGuard` (`403 EVENTS_DIRECT_CRUD_FORBIDDEN`). All management and replay operations execute through the `dxosEvents` resource.

To allow multiple application replicas to drain the outbox concurrently without duplicate deliveries, `claimDueDeliveries` runs a two-phase PostgreSQL claim cycle:

1. **Stale Lock Reclaim (`staleLockMs = 120000`):** Rows stuck in `processing` with `lockedAt < NOW() - 120s` are reset to `retry_wait` with cleared `lockedAt` and `lockedBy`.
2. **Atomic Batch Claim (`FOR UPDATE OF d SKIP LOCKED`):** Selects up to `batchSize` (`20` default, `100` max) due rows joined against active subscriptions whose circuit is not open, locks the selected rows, and marks them `processing` within the transaction.

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
FOR UPDATE OF d SKIP LOCKED
```

During dispatch (`dispatchOneDelivery`), the worker re-validates `targetUrl` via `assertSafeConnectorUrlAsync` (SSRF check), sets `redirect: 'error'` and `WEBHOOK_TIMEOUT_MS = 5000` ms, and attaches Standard Webhooks and CloudEvents headers (`webhook-id: msg_<eventId>_<delId>`, `webhook-timestamp`, `webhook-signature: v1,<b64>`, `ce-id`, `ce-type`, `ce-specversion: 1.0`).

## Exponential Backoff, Circuit Breaker & DLQ

When a partner endpoint returns a non-`2xx` HTTP status or exceeds the `5,000 ms` timeout, `event-bus.js` updates both the delivery row and the parent subscription's circuit state:

| Constant / Mechanism | Default Value | Operational Behavior |
| :--- | :--- | :--- |
| `DRAINER_INTERVAL_MS` | `10,000` ms | Background polling interval (disable with `DX_EVENT_BUS_DRAINER=false`) |
| `WEBHOOK_TIMEOUT_MS` | `5,000` ms | `AbortSignal.timeout` ceiling per outbound HTTP POST |
| `DEFAULT_MAX_ATTEMPTS` | `5` attempts | Exhausted deliveries transition to `dlq` and mark the parent event `partial_failed` |
| `computeWebhookBackoffMs` | `baseMs = 5,000`, `maxMs = 3,600,000` | Delay equals `min(maxMs, 5000 * 2^attempt)` plus up to `25%` random jitter (jitter capped at `5,000 ms`) |
| `CIRCUIT_FAILURE_THRESHOLD` | `5` consecutive failures | Transitions `circuitState` from `closed` to `open` (or immediately on a failed `half_open` probe) |
| `CIRCUIT_COOLDOWN_MS` | `120,000` ms | Cooldown window (`circuitOpenUntil`) before transitioning to `half_open` |

Operators manage subscriptions, deliveries, DLQ replays, and circuits through the 10 `dxosEvents` actions:

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:saveSubscription"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Creates or updates a webhook subscription (slug key, SSRF-checked targetUrl, glob eventPattern, AES-256-GCM encrypted signingSecret, optional connectorId)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:replayDlq"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Resets dlq deliveries (filtered by subscriptionId, eventId, or deliveryIds) back to pending with attempt = 0."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:resetCircuit"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Manually closes an open circuit breaker (circuitState = closed, failureCount = 0) on a subscription."
/>

Remaining `dxosEvents` actions include `listEvents` (`GET`), `publish` (`POST`, `depth` bounded `0..8`), `listSubscriptions` (`GET`), `toggleSubscription` (`POST`), `deleteSubscription` (`POST`/`DELETE`), `listDeliveries` (`GET`), and `dispatchNow` (`POST`).

## Cron Scheduler & Delayed Run Ticker (`flow/cron.js`)

Workflows containing a `trigger.schedule` node are evaluated by `flow/cron.js` using a standard 5-field POSIX cron parser:

| Field | Allowed Range | Normalization Rules |
| :--- | :--- | :--- |
| `minute` | `0..59` | Supports `*`, ranges `a-b`, steps `*/n`, comma lists `a,b` |
| `hour` | `0..23` | Supports `*`, ranges, steps, comma lists |
| `dom` (day of month) | `1..31` | When both `dom` and `dow` are non-wildcard, matches using POSIX `OR` semantics |
| `month` | `1..12` | Supports `*`, ranges, steps, comma lists |
| `dow` (day of week) | `0..7` | Value `7` is normalized to `0` (Sunday) |

Schedule evaluation uses `Intl.DateTimeFormat` for the rule's IANA `timezone` (default `UTC`, falling back to `UTC` if invalid) with a 64-entry formatter cache and a 366-day forward horizon in `computeNextCronRun`.

`tickFlowScheduler` runs on interval `DX_FLOW_DELAY_TICK_MS` (default `15,000` ms) to execute `tickScheduledRules`, `tickDueDelayedRuns` (`control.delay`), and `tickExpiredApprovals` (`ttlHours` expiration on `control.approval`). To prevent duplicate execution across horizontally scaled instances, `runWithSchedulerLock` acquires a PostgreSQL transaction advisory lock:

```sql
SELECT pg_try_advisory_xact_lock(hashtext('dxos_flow_scheduler_tick')) AS acquired
```

If `acquired === false`, competing replicas return immediately (`skippedLock: true`). Before dispatching a due rule, `tickScheduledRules` checks `nextRunAt <= now` (or the `sameMinute` guard against `lastTriggeredAt` on initial bootstrap) and advances `nextRunAt` inside the locked transaction so a rule fires at most once per scheduled minute.

## Idempotency & Replay Protection

Duplicate-execution protection spans ingress, outbox, scheduling, and workflow resumption:

| Layer | Idempotency / Replay Guard |
| :--- | :--- |
| Unique Event Identity (`uidx_lattice_events_event_id`) | Every CloudEvent in `latticeEventBus` receives a unique UUID v4 `eventId`, indexed alongside `(subscriptionId, eventId)` on `latticeWebhookDeliveries`. |
| Standard Webhooks Replay Window | `verifyStandardWebhookSignature` enforces `toleranceSec = 300` seconds around `webhook-timestamp` to reject captured requests replayed outside the 5-minute window. |
| Atomic Suspended Run Claim (`claimSuspendedRun`) | Delayed or HITL-paused runs transition out of `suspended` atomically via `UPDATE ... WHERE status = 'suspended' RETURNING *`, ensuring concurrent resume attempts cannot fork execution. |
| Outbound `n8n` Idempotency Keys | Mutating requests through `dxosN8n` automatically attach `Idempotency-Key`. |

## Related

- [Stock n8n Integration & OAuth2 PKCE](/en/automation/n8n-integration)
- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [Events and Transactional Outbox](/en/architecture/events-and-outbox)
- [REST API Reference](/en/reference/rest-api)
