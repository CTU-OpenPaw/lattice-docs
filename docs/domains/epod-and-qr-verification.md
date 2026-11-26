---
title: ePOD & Xác thực QR Công khai
description: Biên bản giao hàng điện tử (ePOD), ký số Ed25519 trên sổ cái Merkle và cổng tra cứu QR công khai /v/track/:code.
---

# ePOD & Xác thực QR Công khai

Phân hệ biên bản giao hàng điện tử (ePOD) kết hợp giữa `@latticedx/plugin-dxos-studio` (`wms-engine.js`, `qr-svg.js`, `public-track-html.js`) và sổ cái mật mã của `@latticedx/plugin-lattice-foundation` (`pki-ledger.js`) để gắn bằng chứng giao nhận vật lý với chữ ký Ed25519 bất biến. Tài xế ghi nhận chữ ký tay, tọa độ GPS và ảnh giao nhận trực tiếp từ Field PWA `/v/mobile` (hỗ trợ hàng đợi ngoại tuyến IndexedDB), trong khi đối tác bên ngoài quét mã QR trên phiếu in để xác minh tính toàn vẹn tại `/v/track/:code` mà không lộ dữ liệu nhạy cảm của tenant.

## Kiến trúc ký số và chuỗi xác minh Merkle

<PkiMerkleDiagram />

Mỗi bản ghi ePOD tạo thành một mắt xích trong chuỗi băm theo từng tổ chức (`latticeCryptoLedger`), sử dụng khóa transaction advisory `pg_advisory_xact_lock(hashtext('latticedx:ledger:' || orgId))` để tuần tự hóa số thứ tự `seq` và ngăn rẽ nhánh dữ liệu khi ghi đồng thời.

## Ghi nhận ePOD và khóa kiểm soát dữ liệu

Endpoint `dxosWms:epodCapture` tiếp nhận biên bản bàn giao từ trình duyệt hoặc từ hàng đợi đồng bộ ngoại tuyến `wms.epodCapture` của `/v/mobile`. Hệ thống thực thi xác thực nghiêm ngặt đối với chữ ký, tọa độ và tệp ảnh trước khi cấp mã theo dõi.

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:epodCapture"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, wms"
  summary="Ghi nhận biên bản giao hàng ePOD, ký sổ cái Ed25519, phát hành trackingToken và hoàn tất đơn hàng."
/>

<ParamGrid
  title="Tham số đầu vào và ràng buộc cho dxosWms:epodCapture"
  :items="[
    { name: 'recipientName', type: 'string', required: true, description: 'Họ tên người nhận hàng tại điểm giao (tối đa 128 ký tự).' },
    { name: 'deliveredQty', type: 'number', required: true, description: 'Số lượng thực giao (>= 0).' },
    { name: 'signatureDataUrl', type: 'string', required: true, description: 'Dữ liệu ảnh chữ ký điện tử dạng Data URL (tối đa 256 KB); được băm SHA-256 vào signatureSha256.' },
    { name: 'gpsLat / gpsLng', type: 'number', description: 'Tọa độ GPS hợp lệ trong khoảng lat [-90, 90] và lng [-180, 180].' },
    { name: 'gpsUnavailable', type: 'boolean', default: 'false', description: 'Đặt true khi giao nhận trong kho lạnh kín hoặc tầng hầm mất tín hiệu GPS.' },
    { name: 'gpsUnavailableReason', type: 'string', description: 'Bắt buộc khi gpsUnavailable=true (tối đa 255 ký tự) để giải trình lý do thiếu tọa độ.' },
    { name: 'evidencePhotoDataUrl', type: 'string', description: 'Ảnh hiện trường định dạng raster PNG, JPEG, WebP hoặc GIF (tối đa 512 KB; từ chối SVG).' },
    { name: 'tempSummary', type: 'object', description: 'Tóm tắt nhiệt độ vận chuyển gồm mktCelsius và cờ inRange.' }
  ]"
/>

Khi dữ liệu hợp lệ, giao dịch DB thực hiện đồng thời năm thao tác:

1. Sinh định danh `epodUid` (`EPOD-...`), mã tra cứu công khai `trackingCode` (`LDX-TRK-...`) và khóa bí mật một lần `trackingToken` (`ldx_trk_...`, chỉ lưu hàm băm SHA-256 `trackingTokenHash`).
2. Che thông tin số điện thoại người nhận (`recipientPhoneMasked`) trước khi ghi vào `latticeEpodRecords`.
3. Nối bản ghi `wms.epod_captured` (`scope: 'dxos:epod'`) vào sổ cái `latticeCryptoLedger` và lưu `ledgerSeq`, `ledgerSignatureBase64`, `keyId` lên hồ sơ ePOD.
4. Chuyển trạng thái đơn hàng `latticeOrders` sang `completed` và các dòng `latticeOrderLines` sang `delivered`.
5. Ghi cạnh quan hệ `delivered_by` vào `latticeDataLineage` để phục vụ truy vết chuỗi cung ứng.

<CodeTabs
  :tabs='[
    {
      "label": "Gửi ePOD (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:epodCapture \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"orderCode\": \"ORD-2026-0192\",\n    \"recipientName\": \"Nguyen Van A\",\n    \"deliveredQty\": 120,\n    \"gpsLat\": 10.0299,\n    \"gpsLng\": 105.7706,\n    \"signatureDataUrl\": \"data:image/png;base64,iVBORw0KGgo...\",\n    \"tempSummary\": { \"mktCelsius\": 4.6, \"inRange\": true }\n  }\u0027"
    },
    {
      "label": "Phản hồi cấp phát (JSON)",
      "lang": "json",
      "code": "{\n  \"data\": {\n    \"epod\": {\n      \"epodUid\": \"EPOD-M4K9X2-9F1A3B7C\",\n      \"trackingCode\": \"LDX-TRK-81D2A4C90E\",\n      \"status\": \"delivered\",\n      \"ledgerSeq\": 42,\n      \"keyId\": \"key-org1-ed25519-01\"\n    },\n    \"trackingToken\": \"ldx_trk_4e8f9a1c2d3b...\"\n  }\n}"
    }
  ]'
/>

## Công thức băm, chữ ký Ed25519 và chứng thực HMAC QR

Tính toàn vẹn của biên bản ePOD dựa trên hai lớp mật mã độc lập: chữ ký Ed25519 lưu trên sổ cái nội bộ và mã chứng thực HMAC-SHA256 gắn trên mã QR in ấn.

```text
payloadHash = sha256Hex(canonicalJson(payload))
prevHash    = (seq === 1) ? "0".repeat(64) : prevEntry.entryHash
entryHash   = sha256Hex(`${orgId}|${seq}|${eventType}|${targetCollection}|${targetRecordId}|${payloadHash}|${prevHash}|${recordedAtIso}`)
signature   = Ed25519.sign(`${orgId}|${seq}|${entryHash}`, unwrappedOrgPrivateKey)
```

Khóa riêng Ed25519 của từng tổ chức trong `latticePkiKeys` được mã hóa khi lưu trữ bằng `AES-256-GCM` với khóa dẫn xuất từ `ENCRYPTION_FIELD_KEY || APP_KEY`. Trên phiếu giao hàng in qua `dxosWms:printVoucher` (hỗ trợ xuất PDF Unicode qua Gotenberg `DXOS_GOTENBERG_URL`), mã QR SVG chứa liên kết dạng `/v/track/<trackingCode>#verify=<qrVerificationHash>` với công thức HMAC:

```text
verifySecret       = LATTICE_TRACK_VERIFY_SECRET || ENCRYPTION_FIELD_KEY || APP_KEY
qrVerificationHash = HMAC-SHA256(verifySecret, `${org}|${trackingCode}|${epodUid}|${trackingTokenHash}|${ledgerSeq}`)
```

Vì tham số `#verify=` nằm sau dấu thăng (`fragment`) của URL, trình duyệt không gửi chuỗi chứng thực này lên log truy cập HTTP của proxy, mà chỉ đọc phía client để gọi API xác minh chữ ký.

## Cổng tra cứu công khai `/v/track/:code` và bảo vệ CSP

Nginx public gateway (`10-lattice-public-routes.sh`) định tuyến `/v/track/*` tới bộ sinh HTML tĩnh có kiểm soát (`public-track-html.js`). Mỗi phản hồi HTML cấp một nonce mật mã riêng cho script và stylesheet theo chính sách Content Security Policy nghiêm ngặt:

```text
default-src 'none'; script-src 'nonce-<n>'; style-src 'nonce-<n>'; img-src data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'
```

Giao diện cổng tra cứu gọi hai endpoint công khai `dxosWms:publicTrack` và `dxosWms:verifyTrackSignature` sử dụng so sánh chuỗi hằng thời gian (`timingSafeEqualHex`) để chống tấn công dò kênh bên:

<ApiEndpoint
  method="GET"
  path="/api/dxosWms:publicTrack"
  auth="Public (trackingCode + trackingToken)"
  summary="Trả về trạng thái giao hàng đã che PII, tóm tắt MKT và kết quả xác minh chữ ký sổ cái."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:verifyTrackSignature"
  auth="Public (trackingToken hoặc #verify proof)"
  summary="Tính lại entryHash và kiểm tra chữ ký Ed25519 đối chiếu với khóa công khai trong latticePkiKeys."
/>

| Chế độ xác minh | Tham số cung cấp | `publicProofOnly` | Dữ liệu trả về |
| :--- | :--- | :--- | :--- |
| Xác minh bằng `#verify=` QR | `trackingCode` + `verify` | `true` | `verified`, `epodUid`, `ledgerSeq`, `entryHash`, `keyId`, `publicKeyFingerprint`, `signedAt`, `requiresTokenForDetails: true` |
| Xác minh bằng `trackingToken` | `trackingCode` + `token` | `false` | Toàn bộ bằng chứng mật mã kèm chi tiết đơn hàng và tóm tắt nhiệt độ `tempSummary` |

<CodeTabs
  :tabs='[
    {
      "label": "Xác minh chữ ký QR (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:verifyTrackSignature \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"trackingCode\": \"LDX-TRK-81D2A4C90E\",\n    \"verify\": \"9b74c9897bac770ffc029102a200c5de...\"\n  }\u0027"
    },
    {
      "label": "Kết quả xác minh (JSON)",
      "lang": "json",
      "code": "{\n  \"data\": {\n    \"verified\": true,\n    \"publicProofOnly\": true,\n    \"trackingCode\": \"LDX-TRK-81D2A4C90E\",\n    \"epodUid\": \"EPOD-M4K9X2-9F1A3B7C\",\n    \"seq\": 42,\n    \"entryHash\": \"c3ab8ff13720e8ad9047dd39466b3c89...\",\n    \"keyId\": \"key-org1-ed25519-01\",\n    \"publicKeyFingerprint\": \"sha256:6f1e...\",\n    \"requiresTokenForDetails\": true\n  }\n}"
    }
  ]'
/>

## Ghi nhận ePOD ngoại tuyến từ Field PWA (`/v/mobile`)

Tại các kho lạnh kín hoặc khu vực mất sóng di động, ứng dụng `/v/mobile` lưu biên bản ePOD vào IndexedDB `latticedx-mobile-outbox` (phiên bản `1`, object store `outbox`) dưới tên hành động `wms.epodCapture`. Trình quản lý hàng đợi tuân thủ giới hạn dung lượng và phân loại lỗi đồng bộ sau:

| Tham số / Mã trạng thái | Giá trị quy định | Cơ chế xử lý |
| :--- | :--- | :--- |
| `MAX_OUTBOX_ITEMS` | `50` mục | Chặn thêm mới khi hàng đợi ngoại tuyến đạt trần 50 biên bản chờ đồng bộ. |
| `MAX_OUTBOX_PAYLOAD_BYTES` | `320 KB` / `768 KB` (có ảnh) | Kiểm tra kích thước JSON trước khi lưu vào IndexedDB (`localStorage` dự phòng). |
| HTTP `400`, `403`, `404`, `409`, `422` | `quarantined` | Đưa biên bản vào trạng thái cách ly cục bộ và che dữ liệu ảnh base64 trong `conflictData`. |
| HTTP `401` | Tạm dừng đồng bộ | Dừng xả hàng đợi cho tới khi tài xế xác thực lại phiên Keycloak OIDC. |
| HTTP `408`, `429`, `5xx` hoặc lỗi mạng | `failed` | Giữ nguyên tải trọng trong `outbox` để tự động thử lại ở chu kỳ kế tiếp. |

## Kiểm soát an toàn và xử lý lỗi

| Cơ chế bảo vệ | Hành vi thực thi | Mã lỗi / Kết quả |
| :--- | :--- | :--- |
| Tính bất biến của sổ cái | Hook tầng DB và ORM từ chối mọi thao tác cập nhật hoặc xóa trên `latticeCryptoLedger`. | Trả về `LEDGER_IMMUTABLE`; sai lệch bản ghi trung gian làm gãy xác minh `entryHash` và cây Merkle. |
| Thu hồi khóa công khai | `verifyEpodLedgerSignature` kiểm tra trạng thái hoạt động và `organizationId` trên `latticePkiKeys` trước khi gọi `Ed25519.verify`. | Khóa đã thu hồi hoặc lệch tổ chức trả về `verified: false`. |
| Từ chối token theo hằng thời gian | Thiếu `trackingCode` hoặc sai `trackingToken` / `verifyProof` vẫn chạy `timingSafeEqualHex` với `DUMMY_HASH_HEX`. | Trả về `401 TRACKING_UNAUTHORIZED` không rò rỉ độ dài hay tiền tố khớp. |

## Tài liệu liên quan

- [Cold-Chain OMS, WMS & FEFO](/domains/cold-chain-oms-wms)
- [Sổ cái PKI Ed25519 và Merkle](/reference/pki-merkle-ledger)
- [Ứng dụng di động PWA ngoại tuyến](/studio/mobile-pwa)
- [Mô hình bảo mật Zero-Trust](/architecture/security-model)
