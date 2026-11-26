---
title: Sổ cái PKI và Merkle
description: Lược đồ latticePkiKeys và latticeCryptoLedger, mã hóa khóa riêng AES-256-GCM, chuỗi băm SHA-256, chữ ký Ed25519 và kiểm chứng độc lập.
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

# Sổ cái PKI và Merkle

LatticeDX duy trì sổ cái kiểm toán mật mã nối chuỗi băm theo từng tổ chức (`latticeCryptoLedger`) kết hợp cặp khóa ký Ed25519 riêng biệt trên mỗi tenant (`latticePkiKeys`). Cơ chế này bảo đảm tính toàn vẹn không thể chối bỏ cho chứng từ nghiệp vụ, bản chụp dữ liệu đông lạnh (`latticeFrozenSnapshots`), ePOD giao nhận và sự kiện xoay khóa.

## Lược đồ bảng và Bất biến dữ liệu

Cả `latticePkiKeys` và `latticeCryptoLedger` đều kích hoạt PostgreSQL `FORCE ROW LEVEL SECURITY` theo `organizationId` và bị chặn truy cập REST trực tiếp (`PAAS_PRIVATE_COLLECTION_FORBIDDEN`).

<ParamGrid
  title="Các trường của latticePkiKeys"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Định danh tenant sở hữu cặp khóa Ed25519.' },
    { name: 'keyId', type: 'string', required: true, description: 'Định danh khóa theo mẫu ed25519-<16hex đầu của fingerprintSha256>.' },
    { name: 'algorithm', type: 'string', required: false, default: 'Ed25519', description: 'Thuật toán chữ ký bất đối xứng.' },
    { name: 'publicKeyPem', type: 'text', required: true, description: 'Khóa công khai định dạng SPKI PEM dùng để kiểm chứng công khai.' },
    { name: 'encryptedPrivateKey', type: 'text', required: true, description: 'Khóa riêng PKCS#8 PEM mã hóa AES-256-GCM theo dạng <ivHex>:<tagHex>:<cipherHex>.' },
    { name: 'fingerprintSha256', type: 'string', required: true, description: 'Hàm băm SHA-256 của khóa công khai dạng SPKI DER.' },
    { name: 'active / status', type: 'boolean / string', required: false, default: 'true / active', description: 'Trạng thái khóa: active (đang ký), retired (ngừng ký nhưng vẫn hợp lệ khi kiểm chứng lịch sử) hoặc revoked.' }
  ]"
/>

<ParamGrid
  title="Các trường của latticeCryptoLedger"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Định danh tổ chức; ghép với seq tạo chỉ mục duy nhất uidx_lattice_ledger_org_seq.' },
    { name: 'seq', type: 'bigInt', required: true, description: 'Số thứ tự tăng đơn điệu bắt đầu từ 1 trong phạm vi từng tổ chức.' },
    { name: 'eventType', type: 'string', required: true, description: 'Loại sự kiện (ví dụ document.signed, pki.key_rotated, epod.captured).' },
    { name: 'targetCollection / targetRecordId', type: 'string', required: true, description: 'Tên collection và ID bản ghi được ký hoặc kiểm toán.' },
    { name: 'payloadHash', type: 'string', required: true, description: 'SHA-256 hex của JSON chuẩn hóa (canonicalJson(payload)).' },
    { name: 'prevHash', type: 'string', required: true, description: 'entryHash của bản ghi seq - 1, hoặc chuỗi 64 ký tự 0 với seq = 1.' },
    { name: 'entryHash', type: 'string', required: true, description: 'Hàm băm nối chuỗi SHA-256 toàn phần của mục sổ cái.' },
    { name: 'merkleRoot', type: 'string', required: true, description: 'Gốc cây Merkle nhị phân tính trên toàn bộ entryHash từ seq = 1 tới seq hiện tại.' },
    { name: 'signatureBase64', type: 'text', required: true, description: 'Chữ ký Ed25519 (base64) ký bằng khóa đang hoạt động của tổ chức.' },
    { name: 'keyId / recordedAt', type: 'string / date', required: true, description: 'Mã khóa đã ký và mốc thời gian ISO-8601 ghi nhận mục sổ cái.' }
  ]"
/>

### Cơ chế chống sửa đổi và Khóa đồng thời

| Cơ chế | Thực thi trong `pki-ledger.js` |
| :--- | :--- |
| Khóa ghi theo tổ chức | Mọi thao tác ghi (`appendLedgerEntry` và `rotateOrgSigningKey`) tuần tự hóa qua hàng đợi mutex trong tiến trình (`runWithOrgMutex`) và khóa giao dịch PostgreSQL `pg_advisory_xact_lock(hashtext('latticedx:ledger:' || orgId))`. |
| Hook chỉ thêm (`LEDGER_IMMUTABLE`) | `registerLedgerHooks` gắn sự kiện `beforeUpdate`, `beforeDestroy`, `beforeBulkUpdate` và `beforeBulkDestroy` trên `latticeCryptoLedger` để ném lỗi `403 LEDGER_IMMUTABLE`. |
| Bảo vệ khóa riêng tại nghỉ | Khóa chủ mã hóa AES-256-GCM là `SHA-256(ENCRYPTION_FIELD_KEY || APP_KEY)`. Khi `NODE_ENV=production`, hệ thống từ chối khởi tạo nếu thiếu cả hai biến môi trường (`500 PKI_MASTER_KEY_MISSING`). |

## Toán học Chuỗi băm, Chữ ký Ed25519 và Cây Merkle

### 1. Chuẩn hóa JSON (`canonicalJson`)

Trước khi băm `payload`, hàm `canonicalJson` chuyển đổi đệ quy giá trị theo quy tắc xác định:

- Khóa của mọi object được sắp xếp tăng dần theo thứ tự từ điển (`a < b ? -1 : 1`), loại bỏ thuộc tính có giá trị `undefined`, `function` hoặc `symbol`.
- Đối tượng `Date` chuyển thành chuỗi ISO (`toISOString()`), `bigint` chuyển thành chuỗi thập phân, `-0` chuẩn hóa về `0`.
- `payloadHash = sha256Hex(canonicalJson(payload))`.

### 2. Công thức `entryHash` và `signatureBase64`

Với `seq === 1`, giá trị khởi thủy `prevHash` là `'0'.repeat(64)`. Với `seq > 1`, `prevHash` bằng `entryHash` của bản ghi `seq - 1` cùng tổ chức:

```text
entryHash       = SHA256("${organizationId}|${seq}|${eventType}|${targetCollection}|${targetRecordId}|${payloadHash}|${prevHash}|${recordedAtIso}")
signatureBase64 = Base64(Ed25519.Sign("${organizationId}|${seq}|${entryHash}", privateKey))
```

Riêng API ký trực tiếp bản ghi (`dxosLedger:signDocument`) tạo thêm chữ ký trên JSON chuẩn hóa của ảnh chụp bản ghi: `Ed25519.Sign(canonicalJson(docSnapshot), privateKey)`.

### 3. Gốc cây Merkle nhị phân (`computeMerkleRoot`)

Trên danh sách `entryHash` sắp theo `seq` tăng dần:

- Danh sách rỗng trả về `'0'.repeat(64)`; danh sách `1` phần tử trả về chính `entryHash[0]`.
- Ở mỗi tầng, ghép từng cặp `(left, right)` và tính `sha256Hex("${left}${right}")`. Nếu số nút ở tầng là lẻ, nút cuối được nhân đôi (`right = left`) trước khi băm lên tầng trên cho đến khi còn duy nhất một gốc `merkleRoot`.

## Tham chiếu Endpoint `dxosLedger`

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:publicKey"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Lấy khóa công khai Ed25519 đang hoạt động (publicKeyPem, keyId, fingerprintSha256) của tổ chức."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:entries?page=1&pageSize=20&sort=-seq"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Truy vấn phân trang các mục sổ cái; hỗ trợ lọc theo targetCollection, targetRecordId và eventType."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:status"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Đọc seq mới nhất, headHash, merkleRoot, tổng số bản ghi và keyId hiện hành."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:verify"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Kiểm tra toàn bộ chuỗi seq, prevHash, entryHash, chữ ký Ed25519 và merkleRoot của tổ chức (hỗ trợ cả GET và POST)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:signDocument"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write | ledger"
  summary="Chụp ảnh bản ghi và ghi mục document.signed vào sổ cái. Hỗ trợ 6 collection: latticeRequests, latticeOrders, latticeServiceTickets, latticeAssets, latticeParaDocuments, latticeIncidentCases."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:verifySignature"
  auth="Bearer JWT | X-Lattice-API-Key | Public (APISIX)"
  scope="read"
  summary="Kiểm chứng signatureBase64 của một payload JSON chuẩn hóa đối chiếu với khóa active hoặc retired theo keyId."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosLedger:rotateKey"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write | ledger"
  summary="Chỉ dành cho quản trị viên: chuyển khóa cũ sang trạng thái retired, sinh cặp Ed25519 mới và ghi sự kiện pki.key_rotated vào sổ cái."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosLedger:exportProof?limit=100"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Xuất gói bằng chứng tự chứa (publicKeys, entries, chainValid, merkleRoot, proof theo seq hoặc entryHash) để kiểm toán ngoại tuyến."
/>

## Kiểm chứng độc lập ngoại tuyến

Kiểm toán viên có thể tải gói JSON từ `/api/dxosLedger:exportProof` và chạy mã kiểm chứng bằng thư viện chuẩn Node.js hoặc Python mà không cần kết nối lại máy chủ LatticeDX.

<CodeTabs :tabs="verifyTabs" />

## Tài liệu liên quan

- [Xác thực ePOD và mã QR công khai](/domains/epod-and-qr-verification)
- [Khóa API theo phạm vi](/reference/api-keys)
- [Mô hình bảo mật Zero-Trust](/architecture/security-model)
- [Tham chiếu REST API](/reference/rest-api)
