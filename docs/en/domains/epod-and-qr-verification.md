---
title: ePOD & Public QR Verification
description: Electronic Proof of Delivery capture, Ed25519 Merkle ledger signing, and public /v/track/:code QR verification.
---

# ePOD & Public QR Verification

The Electronic Proof of Delivery (ePOD) subsystem bridges `@latticedx/plugin-dxos-studio` (`wms-engine.js`, `qr-svg.js`, `public-track-html.js`) with the cryptographic ledger in `@latticedx/plugin-lattice-foundation` (`pki-ledger.js`) to bind physical handoffs to immutable Ed25519 signatures. Drivers capture signatures, GPS coordinates, and raster delivery photos from the `/v/mobile` Field PWA (with IndexedDB offline queueing), while external recipients scan voucher QR codes at `/v/track/:code` to verify authenticity without exposing internal tenant data.

## Cryptographic Signing and Merkle Verification Architecture

<PkiMerkleDiagram />

Each ePOD entry forms a linked record inside the per-organization hash chain (`latticeCryptoLedger`), serialized by PostgreSQL transaction advisory lock `pg_advisory_xact_lock(hashtext('latticedx:ledger:' || orgId))` so sequence numbers (`seq`) remain strictly monotonic under concurrent writes.

## ePOD Capture and Validation Rules

The `dxosWms:epodCapture` endpoint accepts delivery confirmation directly from online clients or replayed from the `/v/mobile` offline outbox (`wms.epodCapture`). It enforces strict payload bounds on signatures, coordinates, and raster images before issuing tracking credentials.

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:epodCapture"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, wms"
  summary="Records delivery proof, appends an Ed25519-signed ledger entry, issues a trackingToken, and completes the order."
/>

<ParamGrid
  title="Input Parameters and Bounds for dxosWms:epodCapture"
  :items="[
    { name: 'recipientName', type: 'string', required: true, description: 'Full name of the consignee accepting delivery (max 128 characters).' },
    { name: 'deliveredQty', type: 'number', required: true, description: 'Delivered quantity (>= 0).' },
    { name: 'signatureDataUrl', type: 'string', required: true, description: 'Signature image Data URL (max 256 KB); hashed via SHA-256 into signatureSha256.' },
    { name: 'gpsLat / gpsLng', type: 'number', description: 'Valid coordinates within lat [-90, 90] and lng [-180, 180].' },
    { name: 'gpsUnavailable', type: 'boolean', default: 'false', description: 'Set to true when delivering inside shielded cold rooms or underground docks.' },
    { name: 'gpsUnavailableReason', type: 'string', description: 'Required when gpsUnavailable=true (max 255 characters) explaining why GPS is absent.' },
    { name: 'evidencePhotoDataUrl', type: 'string', description: 'Raster evidence photo in PNG, JPEG, WebP, or GIF format (max 512 KB; SVG rejected).' },
    { name: 'tempSummary', type: 'object', description: 'Transit temperature summary containing mktCelsius and boolean inRange.' }
  ]"
/>

Once validated, the database transaction executes five atomic updates:

1. Generates `epodUid` (`EPOD-...`), public `trackingCode` (`LDX-TRK-...`), and a single-issue `trackingToken` (`ldx_trk_...`, persisted strictly as its SHA-256 `trackingTokenHash`).
2. Masks the recipient phone number into `recipientPhoneMasked` before storing the record in `latticeEpodRecords`.
3. Appends `wms.epod_captured` (`scope: 'dxos:epod'`) to `latticeCryptoLedger` and stores `ledgerSeq`, `ledgerSignatureBase64`, and `keyId` on the ePOD row.
4. Transitions `latticeOrders` to `completed` and linked `latticeOrderLines` to `delivered`.
5. Records a `delivered_by` edge in `latticeDataLineage` for end-to-end supply-chain traceability.

<CodeTabs
  :tabs='[
    {
      "label": "Capture ePOD (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:epodCapture \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"orderCode\": \"ORD-2026-0192\",\n    \"recipientName\": \"Nguyen Van A\",\n    \"deliveredQty\": 120,\n    \"gpsLat\": 10.0299,\n    \"gpsLng\": 105.7706,\n    \"signatureDataUrl\": \"data:image/png;base64,iVBORw0KGgo...\",\n    \"tempSummary\": { \"mktCelsius\": 4.6, \"inRange\": true }\n  }\u0027"
    },
    {
      "label": "Capture Response (JSON)",
      "lang": "json",
      "code": "{\n  \"data\": {\n    \"epod\": {\n      \"epodUid\": \"EPOD-M4K9X2-9F1A3B7C\",\n      \"trackingCode\": \"LDX-TRK-81D2A4C90E\",\n      \"status\": \"delivered\",\n      \"ledgerSeq\": 42,\n      \"keyId\": \"key-org1-ed25519-01\"\n    },\n    \"trackingToken\": \"ldx_trk_4e8f9a1c2d3b...\"\n  }\n}"
    }
  ]'
/>

## Hashing Math, Ed25519 Signatures, and HMAC QR Proofs

Document integrity relies on two independent cryptographic primitives: an Ed25519 signature stored in the internal append-only ledger and an HMAC-SHA256 proof embedded in printed QR vouchers.

```text
payloadHash = sha256Hex(canonicalJson(payload))
prevHash    = (seq === 1) ? "0".repeat(64) : prevEntry.entryHash
entryHash   = sha256Hex(`${orgId}|${seq}|${eventType}|${targetCollection}|${targetRecordId}|${payloadHash}|${prevHash}|${recordedAtIso}`)
signature   = Ed25519.sign(`${orgId}|${seq}|${entryHash}`, unwrappedOrgPrivateKey)
```

Per-organization Ed25519 private keys in `latticePkiKeys` are encrypted at rest with `AES-256-GCM` derived from `ENCRYPTION_FIELD_KEY || APP_KEY`. When rendering a delivery voucher via `dxosWms:printVoucher` (supporting Unicode HTML-to-PDF export through Gotenberg `DXOS_GOTENBERG_URL`), the embedded QR SVG (`qr-svg.js`) encodes `/v/track/<trackingCode>#verify=<qrVerificationHash>`:

```text
verifySecret       = LATTICE_TRACK_VERIFY_SECRET || ENCRYPTION_FIELD_KEY || APP_KEY
qrVerificationHash = HMAC-SHA256(verifySecret, `${org}|${trackingCode}|${epodUid}|${trackingTokenHash}|${ledgerSeq}`)
```

Because `#verify=` resides in the URL fragment, browsers do not transmit the proof token in HTTP request URLs or reverse-proxy access logs; client-side script reads the fragment and posts it directly to the verification API.

## Public Tracking Portal (`/v/track/:code`) and CSP Hardening

The Nginx public gateway (`10-lattice-public-routes.sh`) routes `/v/track/*` to `public-track-html.js`, which issues a fresh cryptographic script/style nonce on every HTTP response under a strict Content Security Policy:

```text
default-src 'none'; script-src 'nonce-<n>'; style-src 'nonce-<n>'; img-src data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'
```

The portal queries two public endpoints, `dxosWms:publicTrack` and `dxosWms:verifyTrackSignature`, both enforcing constant-time comparisons (`timingSafeEqualHex`) against token hashes and HMAC proofs:

<ApiEndpoint
  method="GET"
  path="/api/dxosWms:publicTrack"
  auth="Public (trackingCode + trackingToken)"
  summary="Returns PII-masked delivery status, MKT temperature summary, and ledger signature verification."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:verifyTrackSignature"
  auth="Public (trackingToken or #verify proof)"
  summary="Recomputes entryHash and verifies the Ed25519 signature against the non-revoked public key in latticePkiKeys."
/>

| Verification Mode | Credentials Provided | `publicProofOnly` | Returned Payload |
| :--- | :--- | :--- | :--- |
| QR `#verify=` fragment | `trackingCode` + `verify` | `true` | `verified`, `epodUid`, `ledgerSeq`, `entryHash`, `keyId`, `publicKeyFingerprint`, `signedAt`, `requiresTokenForDetails: true` |
| Full `trackingToken` | `trackingCode` + `token` | `false` | Full cryptographic proof alongside order reference and `tempSummary` |

<CodeTabs
  :tabs='[
    {
      "label": "Verify QR Proof (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:verifyTrackSignature \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"trackingCode\": \"LDX-TRK-81D2A4C90E\",\n    \"verify\": \"9b74c9897bac770ffc029102a200c5de...\"\n  }\u0027"
    },
    {
      "label": "Verification Result (JSON)",
      "lang": "json",
      "code": "{\n  \"data\": {\n    \"verified\": true,\n    \"publicProofOnly\": true,\n    \"trackingCode\": \"LDX-TRK-81D2A4C90E\",\n    \"epodUid\": \"EPOD-M4K9X2-9F1A3B7C\",\n    \"seq\": 42,\n    \"entryHash\": \"c3ab8ff13720e8ad9047dd39466b3c89...\",\n    \"keyId\": \"key-org1-ed25519-01\",\n    \"publicKeyFingerprint\": \"sha256:6f1e...\",\n    \"requiresTokenForDetails\": true\n  }\n}"
    }
  ]'
/>

## Offline ePOD Capture from the Field PWA (`/v/mobile`)

Inside shielded cold rooms or dead cellular zones, `/v/mobile` queues ePOD payloads in IndexedDB `latticedx-mobile-outbox` (version `1`, object store `outbox`) under action `wms.epodCapture`. The outbox flusher enforces strict size bounds and classifies HTTP responses during replay:

| Parameter / HTTP Status | Configured Limit / State | Synchronization Behavior |
| :--- | :--- | :--- |
| `MAX_OUTBOX_ITEMS` | `50` items | Rejects new offline captures once the local outbox reaches 50 pending items. |
| `MAX_OUTBOX_PAYLOAD_BYTES` | `320 KB` / `768 KB` (with photo) | Validates payload byte length prior to storing in IndexedDB (with `localStorage` fallback). |
| HTTP `400`, `403`, `404`, `409`, `422` | `quarantined` | Moves the item to `quarantined` and masks base64 media inside `conflictData`. |
| HTTP `401` | Flush paused | Pauses queue draining until the driver re-authenticates via Keycloak OIDC. |
| HTTP `408`, `429`, `5xx`, or network error | `failed` | Retains the payload for automatic retry on the next connectivity cycle. |

## Security Boundaries and Failure Modes

| Control | Enforcement Behavior | Error Code / Outcome |
| :--- | :--- | :--- |
| Ledger immutability | ORM and database hooks reject any update or delete attempt on `latticeCryptoLedger`. | Raises `LEDGER_IMMUTABLE`; out-of-band tampering breaks `entryHash` and Merkle verification. |
| Public key revocation | `verifyEpodLedgerSignature` checks active status and `organizationId` on `latticePkiKeys` before `Ed25519.verify`. | Revoked or cross-tenant keys immediately return `verified: false`. |
| Constant-time rejection | Missing `trackingCode` or invalid `trackingToken` / `verifyProof` executes `timingSafeEqualHex` against `DUMMY_HASH_HEX`. | Returns `401 TRACKING_UNAUTHORIZED` without leaking prefix or length timing. |

## Related

- [Cold-Chain OMS, WMS & FEFO](/en/domains/cold-chain-oms-wms)
- [PKI Ed25519 & Merkle Ledger](/en/reference/pki-merkle-ledger)
- [Field Mobile PWA](/en/studio/mobile-pwa)
- [Zero-Trust Security Model](/en/architecture/security-model)
