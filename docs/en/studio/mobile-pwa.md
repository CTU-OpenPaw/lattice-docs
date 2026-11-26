---
title: Mobile Field PWA
description: Offline-first field PWA architecture at /v/mobile featuring Service Worker isolation, IndexedDB latticedx-mobile-outbox limits, conflict quarantine, and ePOD capture.
---

# Mobile Field PWA

The Mobile Field PWA at `/v/mobile` provides an offline-capable interface for drivers, warehouse operators, and field technicians executing electronic proof of delivery (ePOD), IIoT setpoint commands, service tickets, and incident reports inside cold storage facilities or low-connectivity transit corridors. Instead of caching authenticated API payloads in browser HTTP caches, the application separates static shell delivery from an IndexedDB mutation outbox.

## Serving Architecture and Service Worker Lifecycle

The LatticeDX gateway serves `/v/mobile` via `createMobilePwaGatewayHandler` behind the public Nginx route configuration (`10-lattice-public-routes.sh`). On `GET` or `HEAD /v/mobile`, the handler injects `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, the manifest link, touch icon metadata, and an inline registration script into the Client-v2 HTML shell.

Once `/api/dxos:sw.js` registers at scope `/`, the client posts a `PRECACHE_ASSETS` message containing static asset URLs extracted from the HTML document (`/assets/*`, `/v/assets/*`, `/v/global.css`, `/v/browser-checker.js`). `sanitizePrecacheAssets` rejects any path containing `..` or `%2f` to prevent path traversal.

<ApiEndpoint
  method="GET"
  path="/api/dxos:manifest"
  auth="Public"
  summary="Returns the static Web App Manifest (application/manifest+json) for /v/mobile with zero tenant or user PII."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:sw.js"
  auth="Public"
  summary="Serves the Service Worker script with Service-Worker-Allowed: / and Cache-Control: no-cache, no-store, must-revalidate."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:icon-192.png"
  auth="Public"
  summary="Serves the deterministic 192x192 PNG app icon (max-age=86400); a 512x512 variant is served at /api/dxos:icon-512.png."
/>

### Cache Boundaries and Security Invariant

The Service Worker (`CACHE_NAME = latticedx-field-pwa-v0.4.2`) applies network-first with cache fallback exclusively to `/v/mobile`, the manifest, the two PNG icons, and static assets matching `STATIC_ASSET_RE`.

Every `/api/*` request outside those three static PWA endpoints executes strictly in `NetworkOnly` mode so tenant-scoped JSON responses are never stored in Cache Storage. `isCacheableResponse` rejects redirected responses, non-`basic` responses, responses with `Cache-Control: no-store` or `private`, and any response containing `Set-Cookie`.

<ParamGrid
  title="PWA Assets and Cache Directives"
  :items="[
    { name: '/v/mobile', type: 'text/html', default: 'no-cache', description: 'Field app shell injected with manifest, icon links, and Service Worker registration.' },
    { name: '/api/dxos:manifest', type: 'application/manifest+json', default: 'max-age=300', description: 'Defines start_url=/v/mobile, display=standalone, and orientation=portrait-primary.' },
    { name: '/api/dxos:sw.js', type: 'application/javascript', default: 'no-store', description: 'Service Worker (aliased at /api/dxos:sw) fetched fresh on navigation checks.' },
    { name: '/api/dxos:icon-192.png', type: 'image/png', default: 'max-age=86400', description: '192x192 maskable/any PNG icon for PWA installation and iOS home screen.' },
    { name: '/api/dxos:icon-512.png', type: 'image/png', default: 'max-age=86400', description: '512x512 maskable/any PNG icon for mobile splash screens.' }
  ]"
/>

## IndexedDB Offline Outbox (`latticedx-mobile-outbox`)

The `mobile-offline-db.js` module manages offline mutations through a three-tier storage fallback chain: **IndexedDB** (`latticedx-mobile-outbox` version `1`, object store `outbox` with keyPath `id` and indexes `status`, `createdAt`) first, `localStorage` (`latticedx:mobile:offline-queue`) when IndexedDB is unavailable, and an in-memory `Map` as a final fallback.

Before persisting any entry, `stripForbiddenKeys` recursively removes `__proto__`, `constructor`, and `prototype` up to depth 16 to block prototype pollution. Browser storage exhaustion (`QuotaExceededError`) raises `OFFLINE_STORAGE_QUOTA_EXCEEDED`.

<ParamGrid
  title="Outbox Capacity Limits and Lifecycle States"
  :items="[
    { name: 'MAX_OUTBOX_ITEMS', type: 'number', default: '50', description: 'Maximum concurrent queued mutations; exceeding this cap throws OFFLINE_QUEUE_FULL.' },
    { name: 'MAX_OUTBOX_PAYLOAD_BYTES', type: 'number', default: '327680 (320 KB)', description: 'Maximum serialized JSON payload size for items without an evidence photo.' },
    { name: 'MAX_PHOTO_DATA_URL_BYTES', type: 'number', default: '524288 (512 KB)', description: 'Maximum raster data URL length (PNG, JPEG, WebP) for evidencePhotoDataUrl.' },
    { name: 'MAX_OUTBOX_TOTAL_BYTES_WITH_PHOTO', type: 'number', default: '786432 (768 KB)', description: 'Maximum total serialized JSON size when an evidence photo is attached.' },
    { name: 'VALID_OUTBOX_STATUSES', type: 'enum', default: 'pending', description: 'Allowed item states: pending, syncing, failed, quarantined, and synced.' }
  ]"
/>

<ParamGrid
  title="Outbox Item Schema"
  :items="[
    { name: 'id', type: 'string', required: true, description: 'Deterministic identifier formatted as mq-<ts36>-<seq36>-<uuid8>, capped at 128 chars.' },
    { name: 'actionType', type: 'string', required: true, description: 'One of the 4 allowlisted ALLOWED_OFFLINE_ACTIONS keys.' },
    { name: 'endpoint', type: 'string', required: true, description: 'Target NocoBase resource action derived automatically from actionType.' },
    { name: 'payload', type: 'object', required: true, description: 'Sanitized JSON mutation payload checked against byte ceilings.' },
    { name: 'status', type: 'enum', default: 'pending', description: 'pending | syncing | failed | quarantined | synced.' },
    { name: 'attempts', type: 'integer', default: '0', description: 'Flush attempt counter incremented on network or HTTP failures.' },
    { name: 'httpStatus / lastError', type: 'integer | string', description: 'Last HTTP status code and error message truncated to 240 characters.' },
    { name: 'conflictData', type: 'object | null', description: 'Sanitized server record returned on HTTP 409 with base64 media fields masked.' }
  ]"
/>

### Supported Offline Actions (`ALLOWED_OFFLINE_ACTIONS`)

To keep offline permissions bounded, the outbox accepts only four allowlisted action keys. Any unknown `actionType` fails with `UNSUPPORTED_OFFLINE_ACTION` on enqueue or quarantines with HTTP `400` during flush.

| `actionType` | Target Endpoint | Method | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `wms.epodCapture` | `/api/dxosWms:epodCapture` | `POST` | Submits electronic proof of delivery with GPS coordinates, signature, and photo evidence. |
| `iot.twinSetDesired` | `/api/dxosBlocks:twinSetDesired` | `POST` | Updates the desired temperature or operating setpoint on a cold-chain Digital Twin. |
| `service.ticketCreate` | `/api/latticeServiceTickets:create` | `POST` | Creates a field maintenance or customer service ticket while offline. |
| `iot.incidentCreate` | `/api/dxosBlocks:alarmIngest` | `POST` | Reports a field equipment alarm or cold-chain incident for triage. |

## Queue Synchronization and Conflict Quarantine

When connectivity resumes (`navigator.onLine === true`), `flushOfflineQueue` processes all non-quarantined entries ordered by `createdAt` and `seq`. Server HTTP responses map deterministically to three outcomes:

| HTTP Status Group | Resulting Item Status | `flushOfflineQueue` Behavior |
| :--- | :--- | :--- |
| `2xx` | `synced` (removed) | Increments `synced` and deletes the item from IndexedDB or fallback storage. |
| `401` | `failed` (flush paused) | Sets `unauthorized: true`, pauses remaining items as `deferred`, and awaits fresh authentication (`NOCOBASE_TOKEN`). |
| `400`, `403`, `404`, `409`, `422` | `quarantined` | Retains the item in quarantine with `lastError` and `httpStatus` so operators can inspect, edit, or discard it manually. |
| `408`, `429`, `5xx`, network error | `failed` | Increments `attempts` and keeps the item queued for the next sync cycle. |

For `409` version conflicts, `extractConflictData` captures the server payload (`serverRecord`) and runs `maskConflictMediaFields` to replace base64 image or signature strings with a placeholder string, capping `conflictData` at `4096` serialized bytes.

<CodeTabs
  :tabs="[
    {
      label: 'flushOfflineQueue Result',
      lang: 'json',
      code: '{\n  &quot;total&quot;: 4,\n  &quot;synced&quot;: 2,\n  &quot;failed&quot;: 0,\n  &quot;quarantined&quot;: 1,\n  &quot;conflicts&quot;: 1,\n  &quot;deferred&quot;: 1,\n  &quot;unauthorized&quot;: false,\n  &quot;results&quot;: [\n    { &quot;id&quot;: &quot;mq-0001&quot;, &quot;actionType&quot;: &quot;wms.epodCapture&quot;, &quot;status&quot;: &quot;synced&quot; },\n    { &quot;id&quot;: &quot;mq-0002&quot;, &quot;actionType&quot;: &quot;iot.twinSetDesired&quot;, &quot;status&quot;: &quot;quarantined&quot;, &quot;httpStatus&quot;: 409, &quot;error&quot;: &quot;Version conflict&quot; }\n  ]\n}'
    },
    {
      label: 'Inspect Quarantine Queue (JS)',
      lang: 'js',
      code: 'import { listOutboxItems, flushOfflineQueue } from \'./mobile-field-pwa\';\nconst quarantined = await listOutboxItems({ status: \'quarantined\' });\nif (quarantined.length > 0) {\n  console.warn(\'Quarantined mutations:\', quarantined.map((item) => item.id));\n}\nconst summary = await flushOfflineQueue({ apiClient });'
    }
  ]"
/>

## QR/Barcode Parser and `buildEpodPayload`

`parseFieldQrPayload` normalizes camera or handheld scanner strings up to `2048` characters (`MAX_QR_PAYLOAD_LENGTH`). It blocks control characters, `<`, `>`, `\`, `..`, unsafe URI schemes (`javascript:`, `data:`, `vbscript:`), and raw JSON keys named `__proto__`, `constructor`, or `prototype` before invoking `JSON.parse`.

<CodeTabs
  :tabs="[
    {
      label: 'Accepted QR Formats',
      lang: 'text',
      code: '1. JSON object: {&quot;trackingCode&quot;:&quot;LDX-TRK-2026-001&quot;,&quot;orderId&quot;:42,&quot;targetTempC&quot;:-18}\n2. Full NGSI-LD URN: urn:ngsi-ld:Asset:org-a:native:104\n3. Short NGSI-LD URN: urn:ngsi-ld:Asset:104\n4. Tracking code: LDX-TRK-2026-001\n5. Stock lot code: LOT-2026-CC-09\n6. Order code: ORD-2026-8841'
    },
    {
      label: 'buildEpodPayload Output',
      lang: 'json',
      code: '{\n  &quot;recipientName&quot;: &quot;Nguyen Van A&quot;,\n  &quot;deliveredQty&quot;: 24,\n  &quot;gpsLat&quot;: 10.0309,\n  &quot;gpsLng&quot;: 105.7689,\n  &quot;signatureDataUrl&quot;: &quot;data:image/png;base64,...&quot;,\n  &quot;evidencePhotoDataUrl&quot;: &quot;data:image/jpeg;base64,...&quot;,\n  &quot;orderCode&quot;: &quot;ORD-2026-8841&quot;,\n  &quot;gpsAccuracyM&quot;: 8.5,\n  &quot;notes&quot;: &quot;Delivered intact at cold bay 2&quot;,\n  &quot;deliveredAt&quot;: &quot;2026-11-26T09:15:00.000Z&quot;\n}'
    }
  ]"
/>

Parsed outputs return `{ valid: true, kind, ... }` containing the matched identifiers: `urn`, `entityType`, `organizationId`, `source`, `entityId`, `assetId`, `trackingCode`, `trackingToken` (`ldx_trk_*`), `lotCode`, `orderCode`, `orderId`, and `targetTempC` (accepting `targetTempC` or `setpointC` within `[-80, 120] °C`).

`buildEpodPayload` validates every field before dispatching to `dxosWms:epodCapture` or enqueuing into `latticedx-mobile-outbox`:

<ParamGrid
  title="buildEpodPayload Field Validation Rules"
  :items="[
    { name: 'recipientName', type: 'string', required: true, description: 'Non-empty recipient name truncated to 128 characters.' },
    { name: 'deliveredQty', type: 'number', default: '0', description: 'Non-negative finite delivered quantity (>= 0).' },
    { name: 'gpsLat / gpsLng', type: 'number', description: 'Finite coordinates in [-90, 90] and [-180, 180]; required unless gpsUnavailable is true.' },
    { name: 'gpsUnavailableReason', type: 'string', description: 'Required (max 240 chars) when gpsUnavailable=true, such as underground cold dock signal loss.' },
    { name: 'signatureDataUrl', type: 'string', required: true, description: 'Signature raster data:image/* URI capped at 256 KB.' },
    { name: 'evidencePhotoDataUrl', type: 'string', description: 'Optional PNG, JPEG, or WebP data URI up to 512 KB. Rejects data:image/svg+xml.' },
    { name: 'targetTempC', type: 'number', description: 'When parsed from JSON QR payloads, must be a finite number in [-80, 120] °C.' }
  ]"
/>

## Operational Notes

- During platform upgrades, the Service Worker `activate` hook deletes any cache key not matching `latticedx-field-pwa-v0.4.2` and claims active tabs immediately.
- If `NOCOBASE_TOKEN` expires (`isJwtTokenExpired`), queued mutations remain intact in IndexedDB until the operator signs in again and triggers a flush.
- Compress field photos to JPEG or WebP below `400 KB` prior to base64 encoding so the full JSON item stays within the `768 KB` per-item limit.

## Related

- [Multi-Portal Architecture](/en/studio/multi-portal)
- [ePOD and Public QR Verification](/en/domains/epod-and-qr-verification)
- [Cold-Chain OMS/WMS and FEFO](/en/domains/cold-chain-oms-wms)
- [IIoT Digital Twin](/en/domains/iiot-digital-twin)
