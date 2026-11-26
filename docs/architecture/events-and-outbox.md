---
title: Sự kiện, Outbox Giao dịch & Valkey PubSub
description: Kiến trúc phân phối sự kiện CloudEvents 1.0, bộ rút hàng đợi PostgreSQL FOR UPDATE SKIP LOCKED trên latticeWebhookDeliveries và latticeContextOutbox, cùng phân tách Valkey 8.1 DB 0/1/2.
---

<script setup>
const eventTabs = [
  {
    label: 'CloudEvent 1.0 Envelope',
    lang: 'json',
    code: `{
  "specversion": "1.0",
  "id": "9c4d1e2b-7a80-4f19-b531-6e28a104c9f0",
  "source": "latticedx/wms",
  "type": "wms.epod_captured",
  "subject": "latticeEpodRecords/884",
  "time": "2026-11-26T09:15:00.000Z",
  "datacontenttype": "application/json",
  "organizationid": "org_coldchain_01",
  "correlationid": "req_7712a9",
  "causationid": "order_1042",
  "depth": 0,
  "data": {
    "epodUid": "EPOD-20261126-884",
    "trackingCode": "LDX-TRK-9941",
    "ledgerSeq": 128
  }
}`,
  },
  {
    label: 'Standard Webhooks Headers',
    lang: 'http',
    code: `POST /hooks/coldchain-erp HTTP/1.1
Content-Type: application/json
webhook-id: msg_9c4d1e2b-7a80-4f19-b531-6e28a104c9f0_42
webhook-timestamp: 1795684500
webhook-signature: v1,9mKp7xQ2N4zR8vT1yL6wE3sA5dF0gH2jK8cB4nM1pQ=
ce-id: 9c4d1e2b-7a80-4f19-b531-6e28a104c9f0
ce-type: wms.epod_captured
ce-specversion: 1.0`,
  },
];
</script>

# Sự kiện, Outbox Giao dịch & Valkey PubSub

LatticeDX tách bạch hoàn toàn cơ chế lưu trữ bền vững và đẩy sự kiện thời gian thực: mọi sự kiện nghiệp vụ và đồng bộ bản sao số đều được ghi nguyên tử vào các bảng outbox trên PostgreSQL 16 với khóa `FOR UPDATE SKIP LOCKED`, trong khi Valkey 8.1 chỉ đảm nhiệm cache (DB 0), PubSub SSE cập nhật giao diện (DB 1) và trạng thái phiên OIDC (DB 2). Hệ thống **không sử dụng Valkey Streams** cho hàng đợi outbox.

## Chuẩn CloudEvents 1.0 và `dxosEventBus`

Module `plugins/nocobase/plugin-lattice-foundation/src/server/event-bus.js` chuẩn hóa mọi sự kiện phát sinh trong hệ thống theo đặc tả **CloudEvents 1.0**. Khi hàm `publishDomainEvent` chạy bên trong một transaction nghiệp vụ, bản ghi sự kiện được chèn vào `latticeEventBus` và đồng thời tạo các tác vụ giao hàng trong `latticeWebhookDeliveries` cho mọi thuê bao đang bật khớp mẫu `eventPattern`.

<CodeTabs :tabs="eventTabs" />

Mọi yêu cầu webhook gửi ra đều ký theo chuẩn **Standard Webhooks** (`v1,<base64_hmac>`) bằng khóa bí mật `whsec_` giải mã từ `encryptedSigningSecret` (`AES-256-GCM`) qua chuỗi `${webhookId}.${timestamp}.${rawBody}`, kèm cửa sổ chống phát lại `toleranceSec = 300` giây.

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:publish"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Phát hành một sự kiện CloudEvents 1.0 vào latticeEventBus và tạo bản ghi giao hàng cho các webhook khớp eventPattern."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public / Gateway"
  summary="Trả về đặc tả AsyncAPI 3.0.0 JSON mô tả 3 server (mqttBroker, httpGateway, redisPubSub) và 5 kênh bất đồng bộ."
/>

## Bộ rút Outbox 1: `latticeWebhookDeliveries` (`FOR UPDATE SKIP LOCKED`)

Khi `DX_EVENT_BUS_DRAINER` khác `'false'`, tác vụ nền trong `event-bus.js` chạy mỗi `10s` (`DRAINER_INTERVAL_MS = 10000`). Trước khi nhận lô mới, bộ rút thu hồi các khóa bị treo quá `120_000`ms (`status = 'processing'` và `lockedAt < cutoff`) về trạng thái `'retry_wait'`. Sau đó, truy vấn nhận lô thực thi trong ngữ cảnh RLS để giữ khóa hàng mức bảng mà không chặn các worker song song khác:

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
FOR UPDATE OF d SKIP LOCKED;
```

Cơ chế phục hồi lỗi và ngắt mạch được kiểm soát qua bốn quy tắc tất định:

| Cơ chế | Ngưỡng & Công thức | Hành vi hệ thống |
| :--- | :--- | :--- |
| Thử lại theo hàm mũ | `min(3600000, 5000 * 2^attempt) + jitter` | Áp dụng khi timeout (`WEBHOOK_TIMEOUT_MS = 5000`ms) hoặc mã HTTP ngoài `2xx`; `jitter` tối đa `25%` và trần `5000`ms. |
| Chuyển vào DLQ | `DEFAULT_MAX_ATTEMPTS = 5` | Hết số lần thử tối đa, bản ghi chuyển sang trạng thái `'dlq'` để vận hành viên phát lại qua `dxosEventBus:replayDlq`. |
| Ngắt mạch thuê bao | `CIRCUIT_FAILURE_THRESHOLD = 5`, `CIRCUIT_COOLDOWN_MS = 120000` | Đạt 5 lỗi liên tiếp sẽ mở mạch trong 2 phút (`'open'`); hết thời gian chờ chuyển sang thăm dò `'half_open'`. |
| Kiểm soát SSRF | `assertSafeConnectorUrlAsync` | Phân giải DNS trước khi gọi `fetch`, chặn dải loopback, IP riêng tư và địa chỉ metadata nếu không có trong danh sách cho phép. |

<ParamGrid
  title="Các tham số Vận hành Outbox Webhook (event-bus.js)"
  :items="[
    { name: 'DX_EVENT_BUS_DRAINER', type: 'boolean', default: 'true', description: 'Bật hoặc tắt tiến trình rút hàng đợi webhook định kỳ mỗi 10 giây.' },
    { name: 'DX_OUTBOX_MAX_ATTEMPTS', type: 'integer', default: '5', description: 'Số lần gửi tối đa trước khi bản ghi chuyển sang trạng thái dlq.' },
    { name: 'WEBHOOK_TIMEOUT_MS', type: 'integer', default: '5000', description: 'Giới hạn thời gian chờ phản hồi HTTP cho mỗi lần gửi webhook (ms).' },
    { name: 'CIRCUIT_FAILURE_THRESHOLD', type: 'integer', default: '5', description: 'Số lỗi liên tiếp kích hoạt ngắt mạch cho một webhook subscription.' },
    { name: 'CIRCUIT_COOLDOWN_MS', type: 'integer', default: '120000', description: 'Thời gian ngắt mạch trước khi thử thăm dò half_open (ms).' }
  ]"
/>

## Bộ rút Outbox 2: `latticeContextOutbox` (Đồng bộ NGSI-LD FIFO)

Mọi thay đổi trên tài sản, vị trí và phòng ban đều sinh bản ghi bất biến vào `latticeContextOutbox` (`native-context.js` và `native-context-delivery.js`) với `eventId` định danh tất định dạng `native-<sha256(projection)>` nhằm chống trùng lặp khi đồng bộ tới FIWARE Orion-LD.

Khác với webhook thông thường vốn gửi song song theo thời gian đến hạn, đồng bộ Digital Twin bắt buộc giữ **thứ tự FIFO theo từng `entityId`** để một bản cập nhật cũ bị chậm mạng không ghi đè trạng thái mới hơn trên Orion-LD. Trong khi đó, các bản ghi đã rơi vào trạng thái `'failed'` không được phép làm tắc nghẽn các sự kiện mới của cùng thực thể:

```sql
SELECT o.id
FROM "latticeContextOutbox" o
WHERE o.state IN ('pending', 'retry')
  AND (o."nextAttemptAt" IS NULL OR o."nextAttemptAt" <= NOW())
  AND NOT EXISTS (
    SELECT 1
    FROM "latticeContextOutbox" older
    WHERE older."entityId" = o."entityId"
      AND older.id < o.id
      AND older.state IN ('pending', 'retry', 'processing')
  )
ORDER BY o.id
LIMIT :batchSize
FOR UPDATE OF o SKIP LOCKED;
```

Khi `DX_NATIVE_CONTEXT_AUTO_SYNC=true`, cron job `*/10 * * * * *` (mỗi 10 giây) thu hồi khóa treo quá `DX_OUTBOX_STALE_LOCK_MS` (`120000`ms), nhận tối đa `10` bản ghi/lô và gọi `POST /ngsi-ld/v1/entityOperations/upsert?options=update` kèm header `NGSILD-Tenant: <organizationId>`. Nếu một thực thể xóa quan hệ sở hữu (ví dụ `belongsToDepartment` hoặc `locatedAt`), bộ rút gọi thêm `DELETE /ngsi-ld/v1/entities/<entityId>/attrs/<iri>` để xóa thuộc tính cũ trên Context Broker.

<ApiEndpoint
  method="GET"
  path="/api/latticeContextSync:status"
  auth="Bearer JWT (root)"
  summary="Kiểm tra hàng đợi latticeContextOutbox theo trạng thái pending, retry, processing, delivered hoặc failed."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticeContextSync:retry"
  auth="Bearer JWT (root)"
  summary="Đặt lại một eventId (native-<64hex>) từ trạng thái retry hoặc failed về pending để đồng bộ lại."
/>

## Phân tách Valkey 8.1 theo 3 Cơ sở dữ liệu Logic (DB 0 / DB 1 / DB 2)

Valkey 8.1 (`valkey/valkey:8.1-alpine`, bật `--appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru`) được phân vùng nghiêm ngặt theo số hiệu database logic và vai trò. Toàn bộ hàng đợi bền vững đều nằm trên PostgreSQL `FOR UPDATE SKIP LOCKED`, không dùng Valkey Streams.

| Valkey DB | Biến môi trường kết nối | Thành phần sử dụng | Dữ liệu lưu trữ & TTL |
| :--- | :--- | :--- | :--- |
| **DB 0** | `CACHE_REDIS_URL` (`redis://:${REDIS_PASSWORD}@redis:6379/0`) | NocoBase `2.2.50` (`CACHE_DEFAULT_STORE=redis`) | Bộ nhớ đệm metadata collection, ACL và truy vấn ứng dụng dùng chung giữa các tiến trình. |
| **DB 1** | `PUBSUB_ADAPTER_REDIS_URL` (`redis://:${REDIS_PASSWORD}@redis:6379/1`) | NocoBase `pubSubManager` & `surface-events.js` | Kênh PubSub `latticedx:surface-updates` chuyển tiếp biến động bản ghi/quy trình tới luồng SSE `GET /api/dxosAi:surfaceEvents` (tối đa `1000` kết nối, keepalive mỗi `25s`). |
| **DB 2** | `DX_NATIVE_AUTH_SESSION_REDIS_URL` (`redis://:${REDIS_PASSWORD}@redis:6379/2`) | `plugin-enterprise-auth` (`policy.js`, `routes.js`) | Khóa trạng thái OIDC PKCE `state:` (`300s`), vé đổi phiên một lần `ticket:` (`60s`), danh sách thu hồi phiên `revoked:` và `revoked_sid:` (`24h`). |

Ngoài ba database logic trên, Apache APISIX `3.19.0` kết nối tới `redis:6379` với plugin `limit-count` (`policy: redis`) để lưu bộ đếm giới hạn tốc độ theo IP (`120`, `240` hoặc `300` yêu cầu mỗi `60` giây tùy nhóm route).

## Tài liệu liên quan

- [Mô hình Dữ liệu](/architecture/data-model)
- [Mô hình Bảo mật Zero-Trust](/architecture/security-model)
- [Đặc tả OpenAPI 3.1 & AsyncAPI 3.0](/reference/openapi-asyncapi)
- [Bản sao số IIoT & Orion-LD](/domains/iiot-digital-twin)
