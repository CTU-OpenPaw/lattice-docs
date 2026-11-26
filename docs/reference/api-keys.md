---
title: Khóa API theo phạm vi
description: Cơ chế cấp phát, xác thực thời gian hằng số, 7 phạm vi quyền, lược đồ latticeApiKeys, chống leo thang vai trò và vòng đời luân chuyển khóa ldx_pat_*.
---

<script setup>
const rotationTabs = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `# 1. Cấp khóa mới cho pipeline đồng bộ kho WMS
curl -sS -X POST "https://app.example.com/api/dxosApiKeys:issue" \\
  -H "Authorization: Bearer <ADMIN_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "wms-scanner-sync",
    "scopes": ["read", "wms"],
    "roleName": "ldx_operator",
    "expiresInDays": 90
  }'

# 2. Thu hồi khóa cũ sau khi cập nhật secret sang khóa mới
curl -sS -X POST "https://app.example.com/api/dxosApiKeys:revoke" \\
  -H "Authorization: Bearer <ADMIN_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{"id": 14}'`,
  },
  {
    label: 'TypeScript',
    lang: 'ts',
    code: `export async function rotateApiKey(
  baseUrl: string,
  adminToken: string,
  oldKeyId: number,
  config: {
    name: string;
    scopes: string[];
    roleName: string;
    expiresInDays: number;
  },
) {
  const issueRes = await fetch(\`\${baseUrl}/api/dxosApiKeys:issue\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${adminToken}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  if (!issueRes.ok) throw new Error(\`Issue failed: \${issueRes.status}\`);
  const issued = await issueRes.json();

  const revokeRes = await fetch(\`\${baseUrl}/api/dxosApiKeys:revoke\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${adminToken}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: oldKeyId }),
  });
  if (!revokeRes.ok) throw new Error(\`Revoke failed: \${revokeRes.status}\`);

  return issued.data ?? issued;
}`,
  },
];
</script>

# Khóa API theo phạm vi

LatticeDX sử dụng Personal Access Token (PAT) định dạng `ldx_pat_*` để cấp quyền truy cập lập trình cho dịch vụ tích hợp, pipeline CI/CD, gateway IIoT và agent ngoài biên. Mỗi khóa gắn chặt với một bộ ba người dùng–tổ chức–vai trò cụ thể trong bảng `latticeApiKeys` (bảo vệ bằng `FORCE ROW LEVEL SECURITY`) và được kiểm tra phạm vi hành động tại middleware trước khi chuyển tiếp yêu cầu tới tài nguyên đích.

## Định dạng Token và Lược đồ Lưu trữ

Khóa được sinh từ trình tạo ngẫu nhiên mật mã (`node:crypto` `randomBytes`) theo biểu thức chính quy cố định:

```text
ldx_pat_<8hex>_<32hex>
```

| Thành phần cấu trúc | Vai trò lưu trữ |
| :--- | :--- |
| Tiền tố nhận diện (`keyPrefix`) | `ldx_pat_` nối 4 byte ngẫu nhiên dạng hex (`8` ký tự), lưu công khai để phục vụ tra cứu và nhật ký kiểm toán. |
| Bí mật (`token`) | 16 byte ngẫu nhiên (`32` ký tự hex) chỉ trả về một lần duy nhất trong phản hồi của `dxosApiKeys:issue`. |
| Lưu trữ hàm băm (`keyHash`) | Máy chủ tính `SHA-256` của toàn bộ chuỗi token và lưu vào cột `keyHash` dưới chỉ mục duy nhất `uidx_lattice_api_keys_hash`. |

<ParamGrid
  title="Các trường của collection latticeApiKeys"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Định danh tổ chức (tenant) mà khóa thuộc về.' },
    { name: 'name', type: 'string', required: true, description: 'Tên gợi nhớ cho khóa (1..120 ký tự).' },
    { name: 'keyPrefix', type: 'string', required: true, description: 'Tiền tố tra cứu công khai ldx_pat_<8hex>.' },
    { name: 'keyHash', type: 'string', required: true, description: 'Hàm băm SHA-256 của token gốc (chỉ mục duy nhất uidx_lattice_api_keys_hash).' },
    { name: 'userId / employeeId', type: 'bigInt', required: true, description: 'Tài khoản người dùng và hồ sơ nhân sự gắn với khóa.' },
    { name: 'roleName', type: 'string', required: true, description: 'Vai trò NocoBase được ghim cứng cho mọi request dùng khóa này.' },
    { name: 'scopesJson', type: 'jsonb', required: true, description: 'Mảng các scope hợp lệ được cấp phát.' },
    { name: 'expiresAt / lastUsedAt / revokedAt', type: 'date', required: false, description: 'Mốc hết hạn, lần dùng gần nhất (throttle 60s) và thời điểm thu hồi.' },
    { name: 'active', type: 'boolean', required: false, default: 'true', description: 'Trạng thái kích hoạt; đặt false ngay khi thu hồi.' }
  ]"
/>

### Quy trình xác thực tại Middleware

Middleware `createPaasApiKeyAuthMiddleware` (đăng ký `before: 'auth'`) chấp nhận khóa qua một trong hai header:

- `X-Lattice-API-Key: ldx_pat_<8hex>_<32hex>`
- `Authorization: Bearer ldx_pat_<8hex>_<32hex>` (khi chưa có phiên người dùng NocoBase gắn sẵn)

Các bước xác minh diễn ra tuần tự trong `withSystemRlsBypass`:

1. Kiểm tra định dạng bằng `PAT_TOKEN_RE`, tính `SHA-256` và đối chiếu `keyHash` bằng hàm thời gian hằng số `timingSafeEqualHex`.
2. Xác nhận `active === true`, `revokedAt == null` và `expiresAt` chưa quá hạn.
3. Kiểm tra tài khoản `users` còn hoạt động, vai trò `roleName` vẫn nằm trong `rolesUsers` và hồ sơ `latticeEmployees` còn hiệu lực trong đúng `organizationId`.
4. Gọi `clampHeaderRole(ctx, roleName)` để ghi đè mọi header `x-role` do client gửi lên, ngăn chặn leo thang vai trò qua HTTP header.
5. Cập nhật `lastUsedAt` tối đa mỗi `60` giây (`LAST_USED_THROTTLE_MS = 60_000`) để tránh khuếch đại thao tác ghi cơ sở dữ liệu.

Truy vấn CRUD trực tiếp vào `/api/latticeApiKeys:*` bị chặn ở mức middleware (`403 PAAS_PRIVATE_COLLECTION_FORBIDDEN`) đối với mọi vai trò ngoài `root`.

## 7 Phạm vi quyền (`ALLOWED_PAT_SCOPES`)

Mỗi khóa bắt buộc khai báo từ `1` đến `20` phạm vi trong danh sách `7` giá trị hợp lệ:

| Phạm vi (`scope`) | Quyền đọc | Quyền ghi / hành động được mở khóa |
|---|---|---|
| `read` | Toàn bộ `GET`, `HEAD`, `OPTIONS` và các `POST` chỉ đọc an toàn | Từ chối mọi thao tác thay đổi dữ liệu (`403 API_KEY_SCOPE_INSUFFICIENT`) |
| `write` | Bao hàm mọi quyền đọc | Mở toàn bộ thao tác tạo, sửa, xóa, phát hành/thu hồi khóa (`dxosApiKeys`) và thay thế mọi scope chuyên biệt |
| `wms` | Quyền đọc trong vai trò | Các action thay đổi dữ liệu trên tài nguyên `dxosWms` (`receiveStock`, `issueStock`, `epodCapture`) |
| `dmn` | Quyền đọc trong vai trò | Các action `dxosDmn:saveTable` và `dxosDmn:saveDelegation` |
| `iot` | Quyền đọc trong vai trò | `dxosBroker`, `dxosAutomations`, và các action IoT trên `dxosBlocks` (`telemetryIngest`, `twinSetDesired`, `twinAckCommand`, `alarmIngest`, `alarmAck`, `alarmClear`, `provisionDevice`, `revokeDevice`, `deviceStatusIngest`) |
| `ai` | Quyền đọc trong vai trò | `dxosAi`, `dxosMcp`, `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `dxosN8n`, `dxosAutomations`, và `dxosApprovals:decide` |
| `ledger` | Quyền đọc trong vai trò | Ký tài liệu và xoay khóa PKI trên `dxosLedger:signDocument` và `dxosLedger:rotateKey` |

Ngoài `GET`/`HEAD`/`OPTIONS`, middleware cho phép khóa chỉ có quyền `read` gọi các `POST` chỉ đọc an toàn gồm `*:list`, `*:get`, `*:count` và danh sách action tính toán/xác minh không thay đổi trạng thái: `dxosLedger:verify`, `dxosLedger:verifySignature`, `latticePara:hybridSearch`, `dxosDmn:evaluate`, `dxosStudio:solutionBundleDiff`, `charts:queryData`, `dxosDataGov:computeMkt`, cùng `latticeIntegrations:{record,context,proposals,proposalReceipt}`. Mọi truy vấn tới `/api/dxos-mcp*` bằng khóa chỉ có `read` đều bị từ chối.

## API vòng đời khóa (`dxosApiKeys`)

### Phát hành khóa mới

<ApiEndpoint
  method="POST"
  path="/api/dxosApiKeys:issue"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write"
  summary="Tạo khóa ldx_pat_* mới gắn với người dùng, vai trò và danh sách phạm vi. Trả về secret token một lần duy nhất."
/>

<ParamGrid
  title="Tham số dxosApiKeys:issue"
  :items="[
    { name: 'name', type: 'string', required: true, description: 'Tên gợi nhớ cho khóa, độ dài 1..120 ký tự.' },
    { name: 'scopes', type: 'string[]', required: true, description: 'Mảng không rỗng các scope thuộc tập {read, write, wms, dmn, iot, ai, ledger}.' },
    { name: 'expiresInDays', type: 'integer', required: false, default: 'null', description: 'Số ngày hiệu lực (1..365). Để trống nếu khóa không tự hết hạn.' },
    { name: 'roleName', type: 'string', required: false, description: 'Vai trò gắn cho khóa. Người dùng thường chỉ được chọn vai trò không đặc quyền mà mình đang nắm giữ.' },
    { name: 'userId', type: 'integer', required: false, description: 'ID người dùng sở hữu khóa. Chỉ quản trị viên hoặc root mới được cấp hộ người khác.' },
    { name: 'organizationId', type: 'string', required: false, description: 'Mã tổ chức mục tiêu (chỉ root có thể chỉ định tổ chức khác).' }
  ]"
/>

Quy tắc chống leo thang đặc quyền trong `resolveIssueTarget`:

- Người dùng không phải quản trị viên (`allowConfigure !== true` và không có snippet `pm`/`pm.*`) bị chặn cấp khóa cho người dùng khác (`API_KEY_FORBIDDEN`) hoặc gán vai trò nâng cao (`API_KEY_ROLE_ESCALATION`).
- Quản trị viên tổ chức (`ldx_admin`) không thể cấp khóa mang vai trò `root` hoặc cấp cho nhân sự thuộc tổ chức khác (`NATIVE_ORGANIZATION_MISMATCH`).

### Liệt kê và Thu hồi khóa

<ApiEndpoint
  method="GET"
  path="/api/dxosApiKeys:list?limit=50"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Liệt kê danh sách khóa (đã ẩn keyHash). Người dùng thường chỉ thấy khóa của chính mình; quản trị viên thấy toàn bộ khóa trong tổ chức."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosApiKeys:revoke"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write"
  summary="Thu hồi khóa theo id (hoặc filterByTk / keyId), đặt active = false và ghi nhận revokedAt, revokedBy."
/>

## Quy trình luân chuyển khóa không gián đoạn

Khi luân chuyển khóa đang chạy trên worker hoặc gateway, thực hiện tuần tự ba bước để tránh gián đoạn dịch vụ:

1. Phát hành khóa thay thế bằng `POST /api/dxosApiKeys:issue` với cùng `roleName` và `scopes`, đặt `expiresInDays` phù hợp chính sách nội bộ.
2. Cập nhật secret mới vào biến môi trường dịch vụ gọi API và kiểm tra một lệnh `GET` thành công.
3. Gọi `POST /api/dxosApiKeys:revoke` với `id` của khóa cũ; middleware lập tức từ chối khóa cũ với mã `401 API_KEY_REVOKED`.

<CodeTabs :tabs="rotationTabs" />

## Giới hạn tần suất và Mã lỗi xác thực

Lưu lượng dùng `ldx_pat_*` chịu đồng thời giới hạn theo IP tại APISIX (`240 req/60s` trên `/api/*`, `120 req/60s` trên `/api/dxos-mcp*`, `300 req/60s` trên các endpoint nạp telemetry) và chính sách RBAC của vai trò gắn kèm.

| Mã lỗi (`code`) | HTTP | Ý nghĩa |
|---|---|---|
| `API_KEY_INVALID` | `401` | Sai định dạng `PAT_TOKEN_RE`, không khớp `keyHash` hoặc ràng buộc nhân sự/tổ chức bị lỗi |
| `API_KEY_REVOKED` | `401` | Khóa đã bị vô hiệu hóa (`active !== true` hoặc `revokedAt != null`) |
| `API_KEY_EXPIRED` | `401` | Thời gian hiện tại đã vượt quá `expiresAt` |
| `API_KEY_USER_INACTIVE` / `API_KEY_ROLE_REVOKED` / `API_KEY_MEMBERSHIP_INACTIVE` | `401` | Tài khoản chủ sở hữu bị khóa, mất vai trò trong `rolesUsers` hoặc nghỉ việc trong `latticeEmployees` |
| `API_KEY_SCOPE_INSUFFICIENT` | `403` | Khóa không có `write` hoặc scope chuyên biệt (`wms`, `dmn`, `iot`, `ai`, `ledger`) cho hành động đang gọi |
| `API_KEY_ROLE_ESCALATION` | `403` | Người dùng cố gắng cấp khóa cho vai trò cao hơn quyền thực tế |

## Tài liệu liên quan

- [Tham chiếu REST API](/reference/rest-api)
- [Mô hình bảo mật Zero-Trust](/architecture/security-model)
- [Sổ cái PKI và Merkle](/reference/pki-merkle-ledger)
- [Đặc tả OpenAPI 3.1 và AsyncAPI 3.0](/reference/openapi-asyncapi)
