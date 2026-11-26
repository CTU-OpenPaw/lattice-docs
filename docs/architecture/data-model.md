---
title: Mô hình Dữ liệu
description: Kiến trúc schema PostgreSQL 16 của LatticeDX gồm 56 bảng tĩnh có FORCE RLS, 2 bảng đính kèm snake_case, collection động latticeCustom* và bộ máy công thức Safe AST.
---

<script setup>
const dataModelTabs = [
  {
    label: 'Schema Relations (JS)',
    lang: 'javascript',
    code: `// plugins/nocobase/plugin-lattice-foundation/src/server/schema.js
employees: base('latticeEmployees', 'Nhân viên', 'employees', [
  text('email', 'Email'),
  text('identitySubject', 'Identity subject'),
  { name: 'userId', type: 'bigInt', unique: true, allowNull: true },
  relation('user', 'users', 'userId'),
  relation('department', 'latticeDepartments', 'departmentId'),
  many('assets', 'latticeAssets', 'custodianId'),
]),

assets: base('latticeAssets', 'Tài sản', 'assets', [
  text('kind', 'Loại tài sản'),
  text('status', 'Trạng thái', { defaultValue: 'available' }),
  { name: 'version', type: 'integer', defaultValue: 1, allowNull: false },
  relation('department', 'latticeDepartments', 'departmentId'),
  relation('location', 'latticeLocations', 'locationId'),
  relation('custodian', 'latticeEmployees', 'custodianId'),
])`,
  },
  {
    label: 'Data Lineage Record (JSON)',
    lang: 'json',
    code: `{
  "organizationId": "org_coldchain_01",
  "edgeUid": "epod_delivered_by_1042",
  "sourceCollection": "latticeOrders",
  "sourceRecordId": "1042",
  "targetCollection": "latticeEpodRecords",
  "targetRecordId": "884",
  "relationType": "delivered_by",
  "actorName": "driver_03",
  "observedAt": "2026-11-26T09:15:00.000Z"
}`,
  },
];
</script>

# Mô hình Dữ liệu

LatticeDX lưu trữ dữ liệu vận hành, quy trình, AI và ngữ cảnh số trên PostgreSQL 16 (`pgvector/pgvector:0.8.1-pg16`) thông qua lớp ORM của NocoBase `2.2.50` kết hợp với các bảng giao dịch thuần SQL. Thiết kế dữ liệu tách biệt rõ giữa 56 bảng lõi được kiểm soát bằng `FORCE ROW LEVEL SECURITY` và các collection động `latticeCustom*` do quản trị viên hoặc App Builder tạo tại runtime.

Mọi bảng dữ liệu nghiệp vụ đều mang khóa phân tách tenant (`organizationId` cho 54 bảng camelCase và `organization_id` cho 2 bảng snake_case), kết hợp khóa ngoại nội bộ và chỉ mục tổng hợp bắt đầu bằng cột định danh tổ chức để tối ưu truy vấn có lọc RLS.

## Phân nhóm 56 Bảng Tĩnh Lõi

Các bảng tĩnh được khai báo tập trung trong danh sách `TENANT_RLS_TABLES` tại `plugins/nocobase/plugin-lattice-foundation/src/server/pg-rls.js` và phân bổ theo sáu nhóm chức năng:

| Nhóm miền | Các bảng (Collections) | Vai trò chính |
| :--- | :--- | :--- |
| **Tổ chức & Tài sản** | `latticeDepartments`, `latticeEmployees`, `latticeLocations`, `latticeAssets`, `latticeRecordChatter`, `latticeNotifications`, `latticeNotificationDeliveries` | Danh mục đơn vị, nhân sự gắn `userId`, vị trí địa lý, tài sản vận hành, trao đổi trên bản ghi và lịch sử gửi thông báo. |
| **Nghiệp vụ & Chuỗi lạnh** | `latticeRequests`, `latticeOrders`, `latticeOrderLines`, `latticeStockLots`, `latticeEpodRecords`, `latticeServiceTickets`, `latticeSlaPolicies`, `latticeIncidentRules`, `latticeIncidentCases` | Chứng từ yêu cầu/đơn hàng, tồn kho theo lô FEFO, biên bản giao nhận ePOD, phiếu dịch vụ, SLA và sự cố IoT. |
| **Quy trình & Phê duyệt** | `latticeAutomationRules`, `latticeAutomationRuleVersions`, `latticeAutomationRuns`, `latticeDecisionTables`, `latticeApprovalPolicies`, `latticeApprovalRequests`, `latticeDelegations`, `latticePublicForms`, `latticePublicFormSubmissions` | Định nghĩa DAG LatticeFlow v2, bảng quyết định DMN, phê duyệt đa cấp M-of-N, ủy quyền và biểu mẫu công khai. |
| **AI Studio & Tri thức P.A.R.A.** | `latticeAiProfiles`, `latticeAiMemory`, `latticeAiTraces`, `latticeAiAuditLogs`, `latticeAiQuotaPolicies`, `latticeAiQuotaUsage`, `latticeAiApprovalQueue`, `latticeAgentProposals`, `latticeBuiltApps`, `latticeParaDocuments`, `latticeParaChunks`, `latticeUiSnapshots` | Hồ sơ 7 tác nhân AI, bộ nhớ có ngữ cảnh, dấu vết thực thi, hạn mức chi phí, ứng dụng tạo bởi App Builder và phân mảnh vector `pgvector`. |
| **Bảo mật, PKI & Quản trị** | `latticeApiKeys`, `latticePkiKeys`, `latticeCryptoLedger`, `latticeFrozenSnapshots`, `latticeDataLineage`, `latticeDataQuarantine`, `latticeConnectors` | Khóa truy cập `ldx_pat_*`, cặp khóa Ed25519, sổ cái băm nối tiếp Merkle, đồ thị phả hệ dữ liệu, vùng cách ly ngoại tuyến và kho kết nối AES-256-GCM. |
| **Outbox & Tích hợp** | `latticeEventBus`, `latticeWebhookSubscriptions`, `latticeWebhookDeliveries`, `latticeContextOutbox`, `latticeIntegrationInbox`, `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices`, `latticeBrokerSubscriptions` | Hàng đợi CloudEvents 1.0, chuyển phát webhook, outbox đồng bộ NGSI-LD, hộp thư đến tích hợp và bản sao số thiết bị IIoT. |

Ngoài 54 bảng camelCase kể trên, hệ thống có 2 bảng snake_case chuyên biệt cho tệp đính kèm có kiểm tra virus và biên nhận tải lên (`lattice_native_request_attachments` và `lattice_native_request_uploads`), nâng tổng số bảng tĩnh được bảo vệ RLS lên 56 bảng.

## Quan hệ Cốt lõi và Vòng đời Chứng từ

Trong `plugins/nocobase/plugin-lattice-foundation/src/server/schema.js`, các bảng danh mục và chứng từ kế thừa cấu trúc `base` chuẩn gồm `code`, `name`, `organizationId`, `active`, `createdAt`, `updatedAt` cùng chỉ mục duy nhất `uidx_lattice_<prefix>_org_code` trên cặp `(organizationId, code)`.

Các collection chứng từ như `latticeRequests` và `latticeOrders` mở rộng thêm bộ trường `documentFields()` để quản lý vòng đời trạng thái và kiểm soát đồng bộ lạc quan:

- Trường trạng thái và phiên bản gồm `status` (mặc định `'draft'`), `version` (tăng dần khi sửa đổi), `decisionReason`, `submittedAt`, `submittedBy`, `cancelledAt`, `cancelledBy` và `cancelReason`.
- Trường sửa đổi chứng từ gồm `amendedFromId` và `amendmentNo` dùng để truy vết chuỗi phiên bản khi hủy và lập chứng từ thay thế.
- Quan hệ liên kết gồm `requester` và `assignee` trỏ tới `latticeEmployees` (`requesterId`, `assigneeId`), cùng `department` trỏ tới `latticeDepartments` (`departmentId`).
- Bảng `latticeEmployees` liên kết `1-1` tùy chọn với bảng người dùng hệ thống `users` thông qua `userId` duy nhất (`allowNull: true`) và giữ danh sách tài sản phụ trách qua quan hệ `hasMany` (`custodianId` trên `latticeAssets`).

Để truy vết tác động liên mô-đun mà không phải quét toàn bộ khóa ngoại ở runtime, bảng `latticeDataLineage` lưu đồ thị có hướng gồm các cặp `(sourceCollection, sourceRecordId)` → `(targetCollection, targetRecordId)` kèm `relationType`, `edgeUid` duy nhất theo tổ chức và `observedAt`. Công cụ `dxos_graph_impact_analysis` và API kiểm chứng ePOD đọc trực tiếp đồ thị này để dựng chuỗi nguồn gốc bản ghi.

<CodeTabs :tabs="dataModelTabs" />

## Hai Bảng Tệp Đính kèm `lattice_native_*` (Snake-Case)

Khác với 54 bảng camelCase do Sequelize/NocoBase quản lý qua `defineCollection`, hai bảng tệp đính kèm cho yêu cầu nghiệp vụ được tạo trực tiếp bằng PostgreSQL DDL trong migration `20261106000300-native-request-attachments.js` và `20261107000100-shared-upload-receipts.js` nhằm đảm bảo tính nguyên tử, lưu trữ `bytea` có ràng buộc kích thước và khóa chống trùng lặp ở mức cơ sở dữ liệu.

| Bảng | Cột tenant | Khóa chính / Duy nhất | Vai trò kỹ thuật |
| :--- | :--- | :--- | :--- |
| `lattice_native_request_attachments` | `organization_id` | `id` (UUID PK) & `UNIQUE(request_id, organization_id, uploader_id, idempotency_key)` | Lưu nội dung nhị phân tối đa `1 MiB` (`octet_length(content) BETWEEN 1 AND 1048576`) sau khi quét sạch qua ClamAV `zINSTREAM` tại cổng `3310`. |
| `lattice_native_request_uploads` | `organization_id` | `PK(request_id, organization_id, uploader_id, upload_key)` & Partial Unique `WHERE state='pending'` | Bảng biên nhận hai pha (`prepare` → `beginExecute` → `finalizeExecute`) đảm bảo mỗi yêu cầu trong một tổ chức chỉ có tối đa một lượt tải lên đang chờ xác nhận tại một thời điểm. |

Migration `20261203000100-snake-case-rls-attachments-uploads.js` gắn trực tiếp chính sách `lattice_tenant_isolation` cho cả hai bảng này với tham số `{ orgColumn: 'organization_id' }`. Trong `native-request-attachments.js`, mọi truy vấn đều chạy trong transaction có `setTransactionRlsOrg` và khóa hàng cha trên `latticeRequests` (`LOCK.SHARE` khi đọc, `LOCK.UPDATE` khi ghi hoặc gửi duyệt) nhằm chặn tải tệp sau khi yêu cầu rời trạng thái `'draft'`.

```sql
CREATE TABLE IF NOT EXISTS lattice_native_request_uploads (
  request_id      bigint NOT NULL REFERENCES "latticeRequests"(id) ON DELETE CASCADE,
  organization_id varchar(255) NOT NULL,
  uploader_id     bigint NOT NULL,
  upload_key      uuid NOT NULL,
  filename        varchar(200) NOT NULL,
  content_digest  char(64) NOT NULL,
  state           text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'complete', 'failed')),
  attempts        integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  result          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, organization_id, uploader_id, upload_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS lattice_native_one_pending_upload
  ON lattice_native_request_uploads (request_id, organization_id)
  WHERE state = 'pending';
```

## Collection Động `latticeCustom*` và Rich Schema

Quản trị viên và quy trình App Builder 2.0 mở rộng lược đồ dữ liệu tại runtime thông qua `dxosBuilder:createDomain` hoặc công cụ AI `dxos_extend_collection_schema`. Hệ thống áp dụng kiểm soát nghiêm ngặt ở tầng đặt tên và cấu trúc:

<ApiEndpoint
  method="POST"
  path="/api/dxosBuilder:createDomain"
  auth="Bearer JWT | ldx_pat_*"
  scope="write (rootOnly)"
  summary="Tạo collection động latticeCustom*, tự động thêm organizationId, kích hoạt FORCE RLS, sinh chỉ mục và gán quyền mặc định."
/>

Mọi collection động đều phải thỏa mãn các bất biến trong `plugins/nocobase/plugin-dxos-studio/src/server/domain-schema-rls.js`:

1. Tên collection khớp biểu thức chính quy `^latticeCustom[A-Z][A-Za-z0-9]{1,40}$` và không được trùng với bất kỳ bảng hệ thống nào trong `SYSTEM_PROTECTED_COLLECTIONS`.
2. Hệ thống tự động chèn cột `organizationId` (`allowNull: false`), tạo chỉ mục chuẩn hóa độ dài dưới 63 ký tự (`idx_<col>_org` qua `buildSafePgIndexName`) và thực thi `ENABLE` + `FORCE ROW LEVEL SECURITY`, sau đó kiểm tra lại trong `pg_class` qua `attachAndVerifyPgRls`.
3. Hệ thống hỗ trợ đúng 12 kiểu trường: `string`, `text`, `integer`, `float`, `boolean`, `date`, `datetime`, `json` (ánh xạ xuống `jsonb`), `belongsTo`, `hasOne`, `belongsToMany` và `formula`. Khi khai báo `belongsToMany`, hệ thống tạo sẵn bảng trung gian `latticeCustom<Src><Tgt>Join` kèm `FORCE RLS`.
4. Các quy tắc ràng buộc (`required`, `unique` theo `organizationId`, `min`, `max`, `enum` tối đa `100` phần tử, `pattern`) được lưu vào `uiSchema['x-validation']` và kiểm tra đồng bộ qua hook `beforeValidate` và `beforeSave`. Riêng `pattern` được biên dịch thành **Thompson NFA** tuyến tính theo thời gian (`rich-schema.js`), từ chối backreference, lookbehind và bộ định lượng lồng nhau gây ReDoS (tối đa `256` ký tự mẫu, giới hạn lặp `100`, tối đa `512` trạng thái NFA).

## Tổng quan Bộ máy Công thức Safe AST

Trường kiểu `formula` được tính toán tại server trước khi lưu bản ghi thông qua bộ phân tích từ vựng và cây cú pháp trừu tượng đệ quy viết hoàn toàn bằng JavaScript thuần trong `rich-schema.js`, không sử dụng `eval`, `new Function` hay biên dịch mã động.

<ParamGrid
  title="Giới hạn An toàn của Bộ máy Công thức Safe AST (rich-schema.js)"
  :items="[
    { name: 'MAX_FORMULA_LENGTH', type: 'integer', default: '1000', description: 'Độ dài tối đa của chuỗi biểu thức công thức tính theo ký tự.' },
    { name: 'MAX_FORMULA_TOKENS', type: 'integer', default: '256', description: 'Số lượng token tối đa sau bước tách từ vựng (tokenizer).' },
    { name: 'MAX_FORMULA_DEPTH', type: 'integer', default: '24', description: 'Độ sâu lồng nhau tối đa của cây AST đệ quy.' },
    { name: 'formulaReturnType', type: 'enum', default: 'float', description: 'Kiểu trả về hợp lệ: float, integer, string hoặc boolean.' },
    { name: 'BLOCKED_FORMULA_IDENTIFIERS', type: 'Set<string>', default: '15 từ khóa', description: 'Chặn __proto__, constructor, prototype, global, globalThis, process, require, module, exports, Function, eval, Proxy, Reflect, window, self.' }
  ]"
/>

Bộ máy hỗ trợ các toán tử số học và logic (`+`, `-`, `*`, `/`, `%`, `!`, `?:`, `&&`, `||`, `==`, `===`, `!=`, `!==`, `<`, `<=`, `>`, `>=`) cùng 22 hàm chuẩn trong `FORMULA_FUNCTIONS`:

| Nhóm hàm | Số lượng | Danh sách hàm hỗ trợ |
| :--- | :---: | :--- |
| Toán học | 8 | `ROUND`, `ABS`, `CEIL`, `FLOOR`, `MIN`, `MAX`, `POW`, `SQRT` |
| Điều kiện và Null | 3 | `COALESCE`, `IF`, `ISNULL` |
| Chuỗi | 6 | `CONCAT`, `UPPER`, `LOWER`, `TRIM`, `LEN`, `SUBSTR` |
| Ngày giờ | 5 | `NOW`, `YEAR`, `MONTH`, `DAY`, `DATEDIFF_DAYS` |

```json
{
  "name": "coldLineTotal",
  "title": "Thành tiền kiểm soát nhiệt",
  "type": "formula",
  "formulaReturnType": "float",
  "formulaExpression": "ROUND(IF(qty > 0, qty * unitPrice, 0), 2)"
}
```

## Tài liệu liên quan

- [Đa khách hàng & PostgreSQL 16 FORCE RLS](/architecture/multi-tenancy-rls)
- [Collection động & Bộ máy Công thức Safe AST](/studio/custom-collections-formulas)
- [Sự kiện, Outbox Giao dịch & Valkey PubSub](/architecture/events-and-outbox)
- [Tham chiếu REST API](/reference/rest-api)
