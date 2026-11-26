---
title: Tham chiếu REST API
description: Quy ước endpoint NocoBase resource/action, danh mục 31 tài nguyên plugin, tuyến Fastify /v1/*, phân trang, bộ lọc và cơ chế lỗi.
---

<script setup>
const apiExampleTabs = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `# Truy vấn danh sách đơn hàng với PAT và phân trang
curl -sS -G "https://app.example.com/api/latticeOrders:list" \\
  -H "X-Lattice-API-Key: ldx_pat_a1b2c3d4_0123456789abcdef0123456789abcdef" \\
  --data-urlencode "page=1" \\
  --data-urlencode "pageSize=20" \\
  --data-urlencode "sort=-id"

# Cập nhật chứng từ ở trạng thái draft kèm If-Match tránh ghi đè
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

# Tham chiếu REST API

LatticeDX cung cấp hai bề mặt HTTP bổ trợ sau lớp biên kiểm soát chung (Caddy TLS và Apache APISIX): lớp API theo tài nguyên của NocoBase host tại `/api/<resource>:<action>` được bảo vệ bởi `latticeNativeScope` và PostgreSQL 16 `FORCE ROW LEVEL SECURITY`, cùng lớp dịch vụ lõi Fastify tại `/v1/*` cho tác vụ nghiệp vụ, tệp đính kèm, quy trình và đồng bộ ngữ cảnh.

## Header xác thực và định tuyến qua Gateway

Mọi yêu cầu tới `/api/*` và `/v1/*` đi qua Apache APISIX (`:9080` nội bộ, `:8080` cục bộ) với header `X-Request-Id` tự động gắn ở lớp global và chính sách giới hạn tần suất lưu trên Valkey (`limit-count`).

<ParamGrid
  title="Header HTTP chuẩn"
  :items="[
    { name: 'Authorization', type: 'string', required: false, description: 'Bearer JWT từ phiên NocoBase/Keycloak OIDC hoặc khóa cá nhân định dạng Bearer ldx_pat_*.' },
    { name: 'X-Lattice-API-Key', type: 'string', required: false, description: 'Khóa truy cập cá nhân theo phạm vi (ldx_pat_<8hex>_<32hex>) thay thế cho Bearer token.' },
    { name: 'X-Role', type: 'string', required: false, description: 'Vai trò yêu cầu khi dùng phiên đa vai trò. Khi xác thực bằng ldx_pat_*, middleware ép giữ vai trò gắn với khóa.' },
    { name: 'X-Authenticator', type: 'string', required: false, description: 'Tên bộ xác thực NocoBase (mặc định basic hoặc lattice-keycloak).' },
    { name: 'X-Lattice-Edge-Token', type: 'string', required: false, description: 'Token xác thực thiết bị biên cho các route nạp dữ liệu IIoT công khai như telemetryIngest và deviceStatusIngest.' },
    { name: 'If-Match / X-Expected-Version', type: 'string', required: false, description: 'Kiểm soát đồng thời lạc quan (optimistic locking) khi cập nhật chứng từ hoặc tài sản (bắt buộc số nguyên dương).' },
    { name: 'Idempotency-Key', type: 'string', required: false, description: 'Khóa chống trùng lặp lệnh trên các endpoint tạo mới của Fastify /v1/*.' },
    { name: 'traceparent', type: 'string', required: false, description: 'Ngữ cảnh truy vết W3C Trace Context được lan truyền tới OpenTelemetry Collector.' }
  ]"
/>

APISIX áp dụng bốn ngưỡng `limit-count` theo nhóm đường dẫn (tính theo `remote_addr` trên cửa sổ `60` giây):

| Nhóm tuyến APISIX | Đường dẫn đại diện | Ngưỡng (`req/60s`) | Ghi chú |
|---|---|---|---|
| `dxos-telemetry-ingest` | `/api/dxosBlocks:telemetryIngest`, `/api/dxosBlocks:alarmIngest`, `/api/dxosBroker:deviceStatusIngest`, `/api/dxosBroker:orionNotify` | `300` | Băng thông cao cho cảm biến biên và Orion-LD |
| `dxos-core-api` | `/api/*` | `240` | Áp dụng cho toàn bộ tài nguyên CRUD và action nghiệp vụ |
| `dxos-public-paas` | `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/api/dxosForms:*`, `/api/dxosWms:publicTrack`, `/.well-known/agent-card.json` | `120` | Bảo vệ tài nguyên công khai khỏi quét tự động |
| `dxos-enterprise-auth` & `dxos-mcp` | `/api/enterpriseAuth:*`, `/api/dxos-oidc/*`, `/api/dxos-mcp/*` | `120` | Cửa sổ `600s` read/send timeout cho phiên MCP stream |

## Quy ước URL, Envelope và Phân trang

### Bề mặt NocoBase (`/api/<resource>:<action>`)

Tài nguyên do NocoBase `resourceManager.define` đăng ký sử dụng dấu hai chấm ngăn cách tên tài nguyên và hành động, ví dụ `/api/dxosWms:issueStock` hoặc `/api/latticeOrders:list?page=1&pageSize=20`.

<ApiEndpoint
  method="GET"
  path="/api/latticeOrders:list?page=1&pageSize=20&sort=-id"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Truy vấn danh sách đơn hàng đã được lọc tự động theo organizationId của tác nhân và PostgreSQL FORCE RLS."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:issueStock"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write | wms"
  summary="Xuất kho theo lô FEFO và ghi nhận biến động tồn kho trong giao dịch RLS."
/>

Phản hồi từ `resourceManager` tuân theo hai dạng envelope:

1. **Standard Data Wrapping (`dataWrapping`)**: Mặc định trả về `{ "data": <payload>, "meta": { "count": <n>, "page": <n>, "pageSize": <n>, "totalPage": <n> } }` cho thao tác danh sách hoặc `{ "data": <object> }` cho thao tác đơn lẻ.
2. **Raw Response (`ctx.withoutDataWrapping = true`)**: Trả trực tiếp JSON hoặc plain-text không bọc `data`, áp dụng trên `/api/dxActions:*`, `/api/dxos:metrics` (Prometheus exposition), `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `/api/dxos-a2a` và `/.well-known/agent-card.json`.

### Giới hạn phân trang và Bộ lọc an toàn (`latticeNativeScope`)

Middleware `createNativeScopeMiddleware` kiểm tra chặt mọi tham số truy vấn trước khi chuyển xuống Sequelize/PostgreSQL:

<ParamGrid
  title="Tham số truy vấn chuẩn trên NocoBase"
  :items="[
    { name: 'page', type: 'integer', required: false, default: '1', description: 'Số trang trong khoảng 1..100000.' },
    { name: 'pageSize / limit', type: 'integer', required: false, default: '20', description: 'Số bản ghi mỗi trang, bị kẹp cứng trong khoảng 1..200 (endpoint dxosApiKeys:list mặc định 50).' },
    { name: 'sort', type: 'string | string[]', required: false, description: 'Danh sách trường sắp xếp (tiền tố - để giảm dần). Từ chối tên chứa dấu chấm (.) hoặc từ khóa nhạy cảm.' },
    { name: 'filter', type: 'object | json', required: false, description: 'Bộ lọc Sequelize ($eq, $in, $and, $or, $startsWith). Tự động hợp nhất với { organizationId: actor.organizationId }.' },
    { name: 'expectedVersion', type: 'integer', required: false, description: 'Truyền qua body values.expectedVersion, query hoặc header If-Match. Trả 409 VERSION_CONFLICT nếu phiên bản hiện tại không khớp.' }
  ]"
/>

Các truy vấn vi phạm quy tắc bảo mật bị từ chối fail-closed:

| Cơ chế bảo vệ | Quy tắc kiểm tra và mã lỗi |
| :--- | :--- |
| Chặn mở rộng quan hệ và toán tử thô (`NATIVE_RELATION_EXPANSION_UNSUPPORTED`) | Từ chối `appends`, `targetCollection`, tên trường trong `fields`/`sort` chứa dấu chấm (ngoại trừ tự ánh xạ `requester.userId` và `assignee.userId` sang `requesterId`/`assigneeId` của chính người gọi), toán tử `$where`, `$raw`, `$sql`, khóa `__proto__`/`constructor`/`prototype`, hoặc tên trường khớp mẫu nhạy cảm (`password`, `secret`, `token`, `apikey`, `privateKey`, `hash`, `salt`). |
| Chặn ghi trực tiếp tài nguyên nhạy cảm | Trừ vai trò `root`, các bảng `latticeApiKeys`, `latticePkiKeys`, `latticeCryptoLedger`, `latticeConnectors`, `latticeWebhookSubscriptions`, `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices`, `latticeBrokerSubscriptions`, `latticeFrozenSnapshots`, `latticeDataLineage`, `latticeDataQuarantine` và `latticeOrganizations` bị khóa truy cập REST trực tiếp (`403 PAAS_PRIVATE_COLLECTION_FORBIDDEN` hoặc mã chuyên biệt); ứng dụng bắt buộc gọi qua resource nghiệp vụ tương ứng (`dxosApiKeys`, `dxosLedger`, `dxosVault`, `dxosEvents`, `dxosBlocks`, `dxosBroker`, `dxosDataGov`, `dxosBuilder`). |
| Bất biến chứng từ (`VOUCHER_IMMUTABLE`) | Với `latticeRequests` và `latticeOrders`, mọi yêu cầu cập nhật bản ghi ở trạng thái `submitted`, `approved`, `completed` hoặc `cancelled` trả về `409`; thao tác xóa (`destroy`) bị chặn (`NATIVE_DOCUMENT_DELETE_UNSUPPORTED`). Quy trình điều chỉnh bắt buộc đi qua `latticeVoucher:cancel` và `latticeVoucher:amend`. |

## Danh mục 31 tài nguyên NocoBase (`resourceManager.define`)

Toàn bộ API nghiệp vụ được đăng ký trên 7 plugin Apache-2.0 chính thức trong `plugins/nocobase/`:

| # | Tài nguyên | Plugin sở hữu | Hành động chính |
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

Ngoài 31 tài nguyên nghiệp vụ cốt lõi trên, `@latticedx/plugin-lattice-foundation` còn cung cấp tài nguyên `latticeRequestAttachments` cho quy trình tải tệp đính kèm có quét ClamAV (tối đa `1 MiB`), và `@latticedx/plugin-dxos-ai` gắn thêm các tuyến middleware giao thức AI: `POST /api/dxos-mcp`, `POST /api/dxos-mcp/it-ot`, `GET /.well-known/agent-card.json`, `GET /api/dxos-a2a/agent-card.json` và `POST /api/dxos-a2a`. Các domain động `latticeCustom*` tạo từ `dxosBuilder` tự động mở đủ năm hành động `list`, `get`, `create`, `update`, `destroy` dưới tiền tố `/api/latticeCustom<Name>:<action>`.

## Bề mặt Fastify Core API (`/v1/*`)

Dịch vụ Fastify (`apps/api/src/app.ts`, mặc định cổng `4000`) chạy với giới hạn thân yêu cầu `16 KiB` (`bodyLimit: 16_384`), bộ đếm giới hạn tốc độ nội bộ (`API_RATE_LIMIT_MAX=1000` mỗi `60s`, trả header `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` và `Retry-After` khi vượt ngưỡng `429`), cùng chuẩn lỗi gọn `{ "error": "<message>" }`.

<ParamGrid
  title="Phân trang và Envelope trên Fastify /v1/*"
  :items="[
    { name: 'limit', type: 'integer', required: false, default: '50', description: 'Số lượng mục trả về trên một trang, giới hạn 1..100.' },
    { name: 'offset', type: 'integer', required: false, default: '0', description: 'Vị trí bỏ qua (>= 0).' },
    { name: 'q', type: 'string', required: false, description: 'Từ khóa tìm kiếm, độ dài tối đa 200 ký tự.' },
    { name: 'items / page', type: 'object', required: true, description: 'Cấu trúc phản hồi: { items: [...], page: { limit, offset, hasMore, nextOffset } }.' }
  ]"
/>

Các nhóm tuyến chính trên Fastify `/v1/*` bao gồm:

| Nhóm tuyến | Đường dẫn đại diện |
| :--- | :--- |
| Kiểm tra sức khỏe và Vận hành | `GET /health`, `/v1/operations/diagnostics`, `/v1/operations/metrics`, `/v1/operations/queues`, `/v1/operations/retention-preview`, `/v1/system-*` |
| Hồ sơ, Thực thể và Tác vụ | `/v1/records`, `/v1/records/:id`, `/v1/entities*`, `/v1/entity-*`, `/v1/tasks*`, `/v1/files*`, `/v1/actions*`, `/v1/blocks*` |
| Tổ chức, Quy trình và Tích hợp | `/v1/directory/*`, `/v1/organization/*`, `/v1/workflow-*`, `/v1/logistics/orders*`, `/v1/integrations/ngsi-ld/*`, `/v1/enterprise-modules*`, `/v1/studio/*`, `POST /v1/agent/demo` |

## Ví dụ gọi API và xử lý lỗi

<CodeTabs :tabs="apiExampleTabs" />

### Định dạng lỗi và mã trạng thái phổ biến

Lớp NocoBase chuẩn hóa ngoại lệ thành `{ "errors": [{ "message": "...", "code": "..." }] }`, trong khi lớp Fastify `/v1/*` trả `{ "error": "..." }`.

| Mã HTTP | Ý nghĩa | Nguyên nhân điển hình |
|---|---|---|
| `400` | Yêu cầu không hợp lệ | Thiếu tham số bắt buộc, `expectedVersion` sai định dạng, vượt quá giới hạn `q` hoặc tải trọng JSON lỗi |
| `401` | Chưa xác thực | Thiếu token, token hết hạn (`API_KEY_EXPIRED`), bị thu hồi (`API_KEY_REVOKED`) hoặc phiên OIDC đã đăng xuất qua backchannel |
| `403` | Từ chối phân quyền | Thiếu scope trên `ldx_pat_*` (`API_KEY_SCOPE_INSUFFICIENT`), sai tổ chức (`NATIVE_ORGANIZATION_MISMATCH`) hoặc truy cập bảng riêng tư |
| `409` | Xung đột trạng thái | Sai `expectedVersion` (`VERSION_CONFLICT`) hoặc sửa chứng từ đã khóa (`VOUCHER_IMMUTABLE`) |
| `429` | Vượt ngưỡng tần suất | Vượt giới hạn `limit-count` của APISIX (`120`/`240`/`300` req/60s) hoặc Fastify `rateLimiter` |

## Tài liệu liên quan

- [Khóa API theo phạm vi](/reference/api-keys)
- [Đặc tả OpenAPI 3.1 và AsyncAPI 3.0](/reference/openapi-asyncapi)
- [Cô lập đa tenant PostgreSQL RLS](/architecture/multi-tenancy-rls)
- [Mô hình bảo mật Zero-Trust](/architecture/security-model)
