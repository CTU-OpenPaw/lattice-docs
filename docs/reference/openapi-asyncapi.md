---
title: Đặc tả OpenAPI 3.1 và AsyncAPI 3.0
description: Endpoint phát hiện đặc tả OpenAPI 3.1.0 và AsyncAPI 3.0.0 theo thời gian chạy, ánh xạ collection động latticeCustom* và sinh SDK/client.
---

<script setup>
const specUsageTabs = [
  {
    label: 'cURL & OpenAPI Codegen',
    lang: 'bash',
    code: `# Tải OpenAPI 3.1.0 và AsyncAPI 3.0.0
curl -fsS "https://app.example.com/api/dxos:openapi" -o openapi.json
curl -fsS "https://app.example.com/api/dxos:asyncapi" -o asyncapi.json

# Sinh TypeScript definitions từ OpenAPI 3.1.0
npx openapi-typescript ./openapi.json -o ./src/types/latticedx-api.d.ts`,
  },
  {
    label: 'TypeScript (SSE)',
    lang: 'ts',
    code: `// Lắng nghe kênh surfaceEventsSse mô tả trong AsyncAPI 3.0.0
export function subscribeSurfaceUpdates(baseUrl: string, token: string) {
  const controller = new AbortController();
  fetch(\`\${baseUrl}/api/dxosAi:surfaceEvents\`, {
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Accept': 'text/event-stream',
    },
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) throw new Error(\`SSE error \${res.status}\`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      console.log(decoder.decode(value, { stream: true }));
    }
  });
  return () => controller.abort();
}`,
  },
];
</script>

# Đặc tả OpenAPI 3.1 và AsyncAPI 3.0

LatticeDX phát sinh động cả hai tài liệu đặc tả máy đọc được ngay tại runtime từ `openapi-spec.js` và `observability.js`: OpenAPI `3.1.0` cho toàn bộ bề mặt HTTP REST/MCP và AsyncAPI `3.0.0` cho kênh MQTT IIoT, luồng SSE bề mặt UI, Redis Pub/Sub và webhook outbox NGSI-LD.

## Endpoint phát hiện đặc tả

Cả hai endpoint đều gắn cờ `ctx.withoutDataWrapping = true`, trả về JSON thuần với header `Content-Control` / `Cache-Control: no-store` và mở ACL công khai để công cụ sinh mã, Swagger UI hoặc API gateway thu thập trực tiếp.

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Public (APISIX 120 req/60s)"
  summary="Trả về đặc tả OpenAPI 3.1.0 đầy đủ bao gồm các thao tác cốt lõi và toàn bộ domain động latticeCustom* đang kích hoạt."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public (APISIX 120 req/60s)"
  summary="Trả về đặc tả AsyncAPI 3.0.0 mô tả 3 server (MQTT, HTTP/SSE, Redis Pub/Sub) và 5 kênh thông điệp bất đồng bộ."
/>

### Quy tắc phân giải Server URL

Hàm `resolveRequestServerUrl` và `normalizeServerUrl` xác định trường `servers[0].url` theo thứ tự ưu tiên:

1. Đọc giao thức từ `x-forwarded-proto` (`http` hoặc `https`, lấy phần tử đầu tiên nếu có nhiều proxy).
2. Đọc tên máy chủ từ `x-forwarded-host` hoặc `host` sau khi kiểm tra regex an toàn `^[a-zA-Z0-9.:[\]-]{1,253}$`.
3. Loại bỏ mọi thông tin xác thực nhúng trong URL (`username`/`password`) và quay về mặc định `http://localhost:13014` khi thiếu header hợp lệ.

## Cấu trúc đặc tả OpenAPI 3.1.0

Đặc tả OpenAPI khai báo phiên bản `openapi: "3.1.0"` cùng thông tin giấy phép `Apache-2.0` và hai cơ chế bảo mật toàn cục trong `components.securitySchemes`:

<ParamGrid
  title="Security Schemes trong OpenAPI 3.1.0"
  :items="[
    { name: 'bearerAuth', type: 'http (bearer)', required: false, default: 'JWT / ldx_pat_*', description: 'Chấp nhận OIDC/NocoBase Bearer JWT hoặc Personal Access Token dạng Bearer ldx_pat_*.' },
    { name: 'latticeApiKey', type: 'apiKey (header)', required: false, default: 'X-Lattice-API-Key', description: 'Khóa PaaS theo phạm vi truyền qua header X-Lattice-API-Key: ldx_pat_<8hex>_<32hex>.' }
  ]"
/>

Các nhóm đường dẫn công khai như `/api/dxos:health`, `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/api/dxosWms:publicTrack`, `/api/dxosBroker:deviceStatusIngest`, `/api/dxosBroker:orionNotify` và `/api/dxosForms:{meta,submit,status}` được đánh dấu `security: []`. Toàn bộ các thao tác còn lại yêu cầu một trong hai scheme `bearerAuth` hoặc `latticeApiKey` và chuẩn hóa phản hồi lỗi `400`, `401`, `403`.

### Nhóm Tag nghiệp vụ và `operationId`

Mỗi mục trong `API_OPERATIONS` tự động tạo `operationId` duy nhất bằng `makeOperationId(pathStr, method)` (ví dụ `get_dxosLedgerEntries`, `post_dxosWmsIssueStock`) và gán vào nhóm tag tương ứng:

| Nhóm nghiệp vụ | Danh sách Tag trong OpenAPI |
| :--- | :--- |
| Nền tảng & Bảo mật | `Observability`, `PaaS API Keys`, `PKI & Crypto Ledger`, `Data Governance`, `Connector & Secrets Vault`, `Event Bus & Webhooks` |
| Nghiệp vụ & Tự động hóa | `Vouchers`, `Notifications`, `SLA Engine`, `PARA Knowledge Vault`, `WMS & Cold Logistics`, `DMN Decision Engine`, `Native Automation Engine`, `Unified Approvals`, `Omnichannel Notifications`, `Public Forms` |
| Studio, Tích hợp & AI | `Blocks & IoT Telemetry`, `IoT Broker Control Plane`, `DX-OS Studio`, `Visual Domain Builder`, `Stock n8n Integration`, `AI Workforce & MCP`, `Dynamic Custom Domains` |

### Ánh xạ Collection động (`latticeCustom*`)

Hàm `collectCustomCollections(db)` tự động quét mọi collection khớp `/^latticeCustom[A-Za-z0-9_]+$/` đang tồn tại trong cơ sở dữ liệu runtime và ánh xạ kiểu trường sang JSON Schema:

| Kiểu trường NocoBase | Kiểu JSON Schema sinh ra | Định dạng / Ràng buộc |
|---|---|---|
| `integer`, `bigint` | `integer` | — |
| `float`, `double`, `decimal`, `number` | `number` | — |
| `boolean` | `boolean` | — |
| `json`, `jsonb` | `object` | `additionalProperties: true` |
| `date`, `datetime`, `time` | `string` | `format: "date-time"` |
| `string` và các kiểu còn lại | `string` | Trích xuất mảng `enum` từ `uiSchema.enum` nếu có |

Mỗi collection `latticeCustom<Name>` tự động sinh schema tại `#/components/schemas/<Name>` (gồm sẵn `id`, `organizationId` và danh sách `required` từ `allowNull === false`) cùng năm endpoint REST dưới tag `Dynamic Custom Domains`: `list` (`GET`), `get` (`GET`), `create` (`POST`), `update` (`POST`) và `destroy` (`POST`).

## Cấu trúc đặc tả AsyncAPI 3.0.0

Tài liệu `asyncapi: "3.0.0"` chuẩn hóa giao tiếp hướng sự kiện giữa thiết bị biên, broker, hàng đợi outbox và trình duyệt người dùng qua **3 server** và **5 kênh**:

| Server ID | Giao thức | Địa chỉ mặc định | Vai trò |
|---|---|---|---|
| `mqttBroker` | `mqtt` | `<host>:1883` | Eclipse Mosquitto nhận telemetry cảm biến và phát lệnh downlink |
| `httpGateway` | `http` / `https` | `<origin>` | Gateway HTTP/SSE và phân phối webhook từ `latticeContextOutbox` |
| `redisPubSub` | `redis` | `redis:6379` | Valkey DB 1 Pub/Sub đồng bộ cập nhật giao diện giữa các worker |

### 5 Kênh thông điệp và Hợp đồng Payload

| Channel ID | Địa chỉ (`address`) | Operation (`action`) | Message Payload Schema |
|---|---|---|---|
| `iotTelemetry` | `latticedx/{org}/{entity}/telemetry` | `receive` (`ingestIotTelemetry`) | `TelemetryPoint`: `organizationId`, `entityId`, `metric`, `value`, `unit?`, `observedAt` |
| `iotDownlinkCommand` | `latticedx/{org}/{entity}/command` | `send` (`dispatchIotCommand`) | `DownlinkCommand`: `organizationId`, `entityId`, `command`, `args?`, `signatureBase64?`, `issuedAt` |
| `surfaceEventsSse` | `/api/dxosAi:surfaceEvents` | `send` (`subscribeSurfaceEvents`) | `SurfaceUpdate`: `portalSlug`, `kind?`, `organizationId?`, `revision?` |
| `redisSurfaceUpdates` | `latticedx:surface-updates` | `send` (`publishSurfaceUpdates`) | `SurfaceUpdate`: `portalSlug`, `kind?`, `organizationId?`, `revision?` |
| `contextOutboxWebhooks` | `latticeContextOutbox` | `send` (`deliverContextOutboxWebhook`) | `ContextOutboxWebhook`: `eventId`, `entityId`, `organizationId`, `collectionName`, `recordId`, `payload` |

### Chi tiết các Schema thông điệp (`components.messages`)

Mỗi message trong AsyncAPI `3.0.0` dùng `contentType: "application/json"` và khai báo trường bắt buộc để phía thiết bị biên và consumer webhook kiểm tra lược đồ trước khi xử lý:

<ParamGrid
  title="Các trường bắt buộc của 4 Message Schemas"
  :items="[
    { name: 'TelemetryPoint', type: 'object', required: true, description: 'Bắt buộc organizationId, entityId, metric, value (number), observedAt (date-time); tùy chọn unit.' },
    { name: 'DownlinkCommand', type: 'object', required: true, description: 'Bắt buộc organizationId, entityId, command, issuedAt (date-time); tùy chọn args và signatureBase64.' },
    { name: 'SurfaceUpdate', type: 'object', required: true, description: 'Bắt buộc portalSlug; tùy chọn kind, organizationId và revision (integer).' },
    { name: 'ContextOutboxWebhook', type: 'object', required: true, description: 'Bắt buộc eventId, entityId, organizationId, collectionName, recordId (integer) và payload.' }
  ]"
/>

Các luồng bất đồng bộ trên kết nối SSE `/api/dxosAi:surfaceEvents` hỗ trợ tối đa `1000` kết nối đồng thời và phát bình luận keepalive mỗi `25` giây nhằm giữ kết nối ổn định qua reverse proxy Caddy và APISIX.

## Sinh SDK và Kiểm tra đặc tả

Các đội ngũ tích hợp có thể tải trực tiếp tài liệu JSON để sinh kiểu TypeScript, kiểm thử hợp đồng API hoặc cấu hình client MQTT/SSE.

<CodeTabs :tabs="specUsageTabs" />

## Tài liệu liên quan

- [Tham chiếu REST API](/reference/rest-api)
- [Khóa API theo phạm vi](/reference/api-keys)
- [Sự kiện và Transactional Outbox](/architecture/events-and-outbox)
- [Bản sao số IIoT và Digital Twin](/domains/iiot-digital-twin)
