---
title: PKI & Merkle Ledger
description: Schema for latticePkiKeys and latticeCryptoLedger, AES-256-GCM key wrapping, SHA-256 hash chaining, Ed25519 signatures, and standalone verification.
---

<script setup>
const verifyTabs = [
  {
    label: 'Node.js (node:crypto)',
    lang: 'js',
    code: `import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha256Hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

function computeMerkleRoot(hashes) {
  if (!hashes.length) return '0'.repeat(64);
  if (hashes.length === 1) return hashes[0];
  let level = [...hashes];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(sha256Hex(\`\${left}\${right}\`));
    }
    level = next;
  }
  return level[0];
}

const bundle = JSON.parse(readFileSync('./ledger-proof.json', 'utf8'));
const keys = new Map(
  bundle.publicKeys.map((k) => [k.keyId, createPublicKey(k.publicKeyPem)]),
);

let prevHash = '0'.repeat(64);
const hashes = [];
for (const e of bundle.entries.sort((a, b) => a.seq - b.seq)) {
  if (e.prevHash !== prevHash) throw new Error(\`Broken prevHash at seq \${e.seq}\`);
  const recIso = new Date(e.recordedAt).toISOString();
  const expectedEntry = sha256Hex(
    \`\${e.organizationId}|\${e.seq}|\${e.eventType}|\${e.targetCollection}|\${e.targetRecordId}|\${e.payloadHash}|\${e.prevHash}|\${recIso}\`,
  );
  if (expectedEntry !== e.entryHash) throw new Error(\`Entry hash mismatch at seq \${e.seq}\`);
  const pubKey = keys.get(e.keyId);
  const ok = verify(
    null,
    Buffer.from(\`\${e.organizationId}|\${e.seq}|\${expectedEntry}\`, 'utf8'),
    pubKey,
    Buffer.from(e.signatureBase64, 'base64'),
  );
  if (!ok) throw new Error(\`Invalid Ed25519 signature at seq \${e.seq}\`);
  hashes.push(expectedEntry);
  if (computeMerkleRoot(hashes) !== e.merkleRoot) {
    throw new Error(\`Merkle root mismatch at seq \${e.seq}\`);
  }
  prevHash = expectedEntry;
}
console.log('Verified entries:', hashes.length, 'Root:', computeMerkleRoot(hashes));`,
  },
  {
    label: 'Python (cryptography)',
    lang: 'python',
    code: `import base64
import hashlib
import json
from datetime import datetime, timezone
from cryptography.hazmat.primitives.serialization import load_pem_public_key

def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def merkle_root(hashes: list[str]) -> str:
    if not hashes:
        return '0' * 64
    if len(hashes) == 1:
        return hashes[0]
    level = list(hashes)
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else left
            nxt.append(sha256_hex(f'{left}{right}'))
        level = nxt
    return level[0]

with open('ledger-proof.json', 'r', encoding='utf-8') as f:
    bundle = json.load(f)

keys = {
    k['keyId']: load_pem_public_key(k['publicKeyPem'].encode())
    for k in bundle['publicKeys']
}
prev_hash = '0' * 64
acc = []
for e in sorted(bundle['entries'], key=lambda x: x['seq']):
    assert e['prevHash'] == prev_hash
    dt = datetime.fromisoformat(e['recordedAt'].replace('Z', '+00:00')).astimezone(timezone.utc)
    rec_iso = dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    entry_hash = sha256_hex(
        f"{e['organizationId']}|{e['seq']}|{e['eventType']}|{e['targetCollection']}|{e['targetRecordId']}|{e['payloadHash']}|{e['prevHash']}|{rec_iso}"
    )
    assert entry_hash == e['entryHash']
    keys[e['keyId']].verify(
        base64.b64decode(e['signatureBase64']),
        f"{e['organizationId']}|{e['seq']}|{entry_hash}".encode(),
    )
    acc.append(entry_hash)
    assert merkle_root(acc) == e['merkleRoot']
    prev_hash = entry_hash
print('Verified', len(acc), 'entries, root=', merkle_root(acc))`,
  },
];
</script>

# PKI & Merkle Ledger

LatticeDX maintains a per-organization hash-chained audit ledger (`latticeCryptoLedger`) backed by tenant-isolated Ed25519 signing keypairs (`latticePkiKeys`). Every signed record, frozen dataset snapshot (`latticeFrozenSnapshots`), ePOD delivery event, and key rotation appends a tamper-evident entry sealed with SHA-256 chaining, an Ed25519 signature, and an incremental binary Merkle root.

## Collection Schemas and Immutability Guards

Both `latticePkiKeys` and `latticeCryptoLedger` enforce PostgreSQL `FORCE ROW LEVEL SECURITY` scoped by `organizationId` and block generic REST queries (`PAAS_PRIVATE_COLLECTION_FORBIDDEN`).

<ParamGrid
  title="latticePkiKeys Fields"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Tenant identifier owning the Ed25519 keypair.' },
    { name: 'keyId', type: 'string', required: true, description: 'Key identifier formatted as ed25519-<first 16 hex chars of fingerprintSha256>.' },
    { name: 'algorithm', type: 'string', required: false, default: 'Ed25519', description: 'Asymmetric signature algorithm.' },
    { name: 'publicKeyPem', type: 'text', required: true, description: 'SPKI PEM public key exported for online and offline signature verification.' },
    { name: 'encryptedPrivateKey', type: 'text', required: true, description: 'PKCS#8 PEM private key encrypted with AES-256-GCM as <ivHex>:<tagHex>:<cipherHex>.' },
    { name: 'fingerprintSha256', type: 'string', required: true, description: 'SHA-256 digest of the SPKI DER public key.' },
    { name: 'active / status', type: 'boolean / string', required: false, default: 'true / active', description: 'Lifecycle state: active (signing), retired (historical verification allowed), or revoked (verification rejected).' }
  ]"
/>

<ParamGrid
  title="latticeCryptoLedger Fields"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Tenant identifier; paired with seq under unique index uidx_lattice_ledger_org_seq.' },
    { name: 'seq', type: 'bigInt', required: true, description: 'Strictly monotonic per-organization sequence number starting at 1.' },
    { name: 'eventType', type: 'string', required: true, description: 'Audit event type (for example document.signed, pki.key_rotated, epod.captured).' },
    { name: 'targetCollection / targetRecordId', type: 'string', required: true, description: 'Collection name and record identifier bound to the ledger entry.' },
    { name: 'payloadHash', type: 'string', required: true, description: 'Lowercase SHA-256 hex digest of canonicalJson(payload).' },
    { name: 'prevHash', type: 'string', required: true, description: 'entryHash of seq - 1 within the same organization, or 64 zeros for seq = 1.' },
    { name: 'entryHash', type: 'string', required: true, description: 'Chained SHA-256 digest binding metadata, payloadHash, prevHash, and recordedAt.' },
    { name: 'merkleRoot', type: 'string', required: true, description: 'Binary Merkle tree root computed across all entryHash values from seq = 1 through seq.' },
    { name: 'signatureBase64', type: 'text', required: true, description: 'Base64-encoded Ed25519 signature issued by the active organization key.' },
    { name: 'keyId / recordedAt', type: 'string / date', required: true, description: 'Signing key identifier and UTC ISO-8601 timestamp.' }
  ]"
/>

### Concurrency and Immutability Controls

| Control | Enforcement in `pki-ledger.js` |
| :--- | :--- |
| Serialized appends | Both `appendLedgerEntry` and `rotateOrgSigningKey` serialize per organization through an in-process queue (`runWithOrgMutex`) and a PostgreSQL transaction advisory lock: `pg_advisory_xact_lock(hashtext('latticedx:ledger:' || orgId))`. |
| Append-only hooks (`LEDGER_IMMUTABLE`) | `registerLedgerHooks` intercepts `beforeUpdate`, `beforeDestroy`, `beforeBulkUpdate`, and `beforeBulkDestroy` on `latticeCryptoLedger` and throws `403 LEDGER_IMMUTABLE`. |
| Private key protection at rest | Private keys are wrapped using AES-256-GCM with `SHA-256(ENCRYPTION_FIELD_KEY || APP_KEY)`. When `NODE_ENV=production`, missing both keys raises `500 PKI_MASTER_KEY_MISSING`. |

## Hash Chaining, Ed25519 Signing, and Merkle Tree Math

### 1. Canonical JSON (`canonicalJson`)

Before hashing, `canonicalJson` recursively normalizes payloads deterministically:

- Object keys are sorted lexicographically (`a < b ? -1 : 1`), omitting `undefined`, `function`, and `symbol` properties.
- `Date` instances serialize as ISO-8601 strings (`toISOString()`), `bigint` values serialize as strings, and `-0` normalizes to `0`.
- `payloadHash = sha256Hex(canonicalJson(payload))`.

### 2. Entry Hash and Ed25519 Signature

For `seq === 1`, `prevHash` equals `'0'.repeat(64)`. For `seq > 1`, `prevHash` equals the `entryHash` of `seq - 1` in the same `organizationId`:

```text
entryHash       = SHA256("${organizationId}|${seq}|${eventType}|${targetCollection}|${targetRecordId}|${payloadHash}|${prevHash}|${recordedAtIso}")
signatureBase64 = Base64(Ed25519.Sign("${organizationId}|${seq}|${entryHash}", privateKey))
```

When invoking `dxosLedger:signDocument`, the service also computes a direct document signature over the canonical snapshot: `Ed25519.Sign(canonicalJson(docSnapshot), privateKey)`.

### 3. Binary Merkle Root (`computeMerkleRoot`)

Given the ordered list of `entryHash` leaves (`seq = 1..N`):

- An empty array yields `'0'.repeat(64)`; a single leaf returns `entryHash[0]`.
- Each tree level pairs adjacent digests `(left, right)` and computes `sha256Hex("${left}${right}")`. Levels with an odd node count duplicate the trailing node (`right = left`) before advancing upward.

## `dxosLedger` Endpoint Reference

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:publicKey"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Returns the organization active Ed25519 public key (publicKeyPem, keyId, fingerprintSha256)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:entries?page=1&pageSize=20&sort=-seq"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Lists paginated ledger entries with optional targetCollection, targetRecordId, and eventType filters."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:status"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Returns the latest seq, headHash, merkleRoot, entryCount, and active keyId."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:verify"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Recomputes and verifies sequence continuity, prevHash, entryHash, Ed25519 signatures, and merkleRoot across all org entries (supports GET and POST)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:signDocument"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write | ledger"
  summary="Snapshots a record and appends a document.signed entry. Allowed collections: latticeRequests, latticeOrders, latticeServiceTickets, latticeAssets, latticeParaDocuments, latticeIncidentCases."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:verifySignature"
  auth="Bearer JWT | X-Lattice-API-Key | Public (APISIX)"
  scope="read"
  summary="Verifies signatureBase64 for a canonical JSON payload against the active or retired key matching keyId."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:rotateKey"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write | ledger"
  summary="Admin-only: marks prior active keys retired, generates a new Ed25519 keypair, and appends a pki.key_rotated ledger entry."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:exportProof?limit=100"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Exports a self-contained verification bundle (publicKeys, entries, chainValid, merkleRoot, and target entry proof)."
/>

## Standalone Offline Verification

Auditors can download an `exportProof` JSON bundle and verify chain integrity, Ed25519 signatures, and the Merkle root offline using standard Node.js or Python libraries with zero LatticeDX server access.

<CodeTabs :tabs="verifyTabs" />

## Related

- [ePOD & Public QR Verification](/en/domains/epod-and-qr-verification)
- [Scoped API Keys](/en/reference/api-keys)
- [Zero-Trust Security Model](/en/architecture/security-model)
- [REST API Reference](/en/reference/rest-api)
