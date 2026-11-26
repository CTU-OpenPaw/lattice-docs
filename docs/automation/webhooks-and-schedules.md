---
title: Webhook, Ký HMAC & Lập lịch Cron
description: Tiếp nhận webhook đến, xác thực HMAC-SHA256 và Standard Webhooks, hộp thư đi PostgreSQL FOR UPDATE SKIP LOCKED trên latticeWebhookDeliveries, ngắt mạch và bộ lập lịch cron.
---

<script setup>
const webhookTabs = [
  {
    label: 'Node.js (Ký & Gửi Inbound Webhook)',
    lang: 'js',
    code: `import crypto from "node:crypto";

const rawBody = JSON.stringify({ data: { orderCode: "ORD-2026-09", tempC: 7.4 } });
const secret = process.env.WEBHOOK_SECRET;
const hex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

await fetch("https://app.latticedx.example.com/api/dxosAutomations:webhookIngress?organizationId=org_coldchain&ruleKey=inbound_telemetry", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Lattice-Signature-256": \`sha256=\${hex}\`,
  },
  body: rawBody,
});`,
  },
  {
    label: 'cURL (Standard Webhooks Headers)',
    lang: 'bash',
    code: `curl -sS -X POST "https://app.latticedx.example.com/api/dxosAutomations:webhookIngress?organizationId=org_coldchain&ruleKey=partner_sync" \\
  -H "Content-Type: application/json" \\
  -H "webhook-id: msg_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \\
  -H "webhook-timestamp: 1795709000" \\
  -H "webhook-signature: v1,base64_hmac_signature_here" \\
  -d '{"data":{"lotCode":"LOT-2026-11"}}'`,
  },
];
</script>

# Webhook, Ký HMAC & Lập lịch Cron

LatticeDX điều phối tác vụ nền và tích hợp hướng sự kiện thông qua hai cơ chế bền vững trên PostgreSQL 16: đường dẫn tiếp nhận **inbound webhook** bảo vệ bằng chữ ký mật mã cho nút `trigger.webhook`, hộp thư đi giao dịch **`latticeWebhookDeliveries`** dùng khóa hàng `FOR UPDATE OF d SKIP LOCKED` trong `event-bus.js`, và bộ lập lịch **cron 5 trường** sử dụng advisory lock trong `flow/cron.js`.

## Webhook Đến (`dxosAutomations:webhookIngress`)

Quy trình LatticeFlow v2 khai báo nút `trigger.webhook` được kích hoạt từ bên ngoài thông qua đầu cuối công khai `dxosAutomations:webhookIngress` (`public` ACL, fail-closed nếu thiếu bí mật). Hệ thống đọc `organizationId` từ tham số truy vấn, body hoặc header `X-Organization-Id`, cùng `ruleKey` (hoặc `automationCode`).

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:webhookIngress"
  auth="HMAC-SHA256 | Standard Webhooks | Bearer"
  scope="public (fail-closed)"
  summary="Xác thực chữ ký hoặc Bearer token của yêu cầu webhook đến rồi kích hoạt quy trình LatticeFlow v2 đang xuất bản có nút trigger.webhook."
/>

<ParamGrid
  title="Cấu hình Nút trigger.webhook và Tham số Tiếp nhận"
  :items="[
    { name: 'webhookPath', type: 'string', required: true, description: 'Định danh đường dẫn logic của hook (ví dụ /hooks/inbound), ghi vào subject sự kiện.' },
    { name: 'authMode', type: 'string', default: 'hmac', description: 'Chế độ xác thực: hmac (HMAC-SHA256 hoặc Standard Webhooks) hoặc bearer.' },
    { name: 'secretHeader', type: 'string', default: 'X-Lattice-Signature-256', description: 'Tên header chứa chữ ký sha256=<hex> khi chạy ở chế độ hmac.' },
    { name: 'connectorKey', type: 'string', description: 'Khóa connector loại webhook trong dxosVault dùng làm nguồn bí mật ký (ưu tiên trước ruleKey).' }
  ]"
/>

Hàm `resolveWebhookSecret` tìm khóa bí mật theo thứ tự ưu tiên từ Connector Vault (`connectorKey`, `secretConnectorKey`, `webhook:<ruleKey>`, `webhook-<ruleKey>`, `webhookPath`, `ruleKey` với `connectorType === 'webhook'`) trước khi đọc trường dự phòng trên rule. Nếu không tìm thấy bí mật, máy chủ trả về `401 WEBHOOK_SIGNATURE_INVALID`.

Trình tiếp nhận `dispatchWebhookIngress` hỗ trợ ba cơ chế xác thực thời gian hằng (`timingSafeEqualHex`):

| Cơ chế | Chế độ `authMode` | Cách thức xác thực |
| :--- | :---: | :--- |
| HMAC-SHA256 trên payload thô | `hmac` | Tính `HMAC-SHA256(secret, rawBody)` (giải mã base64 nếu bí mật có tiền tố `whsec_`) và so sánh với giá trị trong header `X-Lattice-Signature-256` (chấp nhận cả tiền tố `sha256=` hoặc chuỗi hex thuần). |
| Standard Webhooks dự phòng | `hmac` | Nếu header chữ ký tùy chỉnh trống và yêu cầu mang `webhook-signature`, hệ thống gọi `verifyStandardWebhookSignature` để kiểm tra bộ ba `webhook-id`, `webhook-timestamp` (cửa sổ trễ `toleranceSec = 300` giây) và `webhook-signature: v1,<base64>` ký trên chuỗi `<webhookId>.<timestamp>.<rawBody>`. |
| Bearer Token | `bearer` | Băm SHA-256 token trong header `Authorization: Bearer <token>` và đối chiếu hằng thời gian với `sha256(secret)`. |

<CodeTabs :tabs="webhookTabs" />

## Hộp thư đi `latticeWebhookDeliveries` & `FOR UPDATE SKIP LOCKED`

Khi nghiệp vụ hoặc nút `event.emit` phát sự kiện qua `publishDomainEvent`, LatticeDX ghi nguyên tử trong cùng giao dịch RLS cả bản ghi sự kiện vào `latticeEventBus` (chuẩn CloudEvents `specversion: "1.0"`) lẫn từng hàng giao nhận vào `latticeWebhookDeliveries` cho mọi `latticeWebhookSubscriptions` đang hoạt động có `eventPattern` khớp mẫu glob (hỗ trợ danh sách phân tách dấu phẩy và ký tự `*`).

Truy cập CRUD trực tiếp vào `latticeEventBus`, `latticeWebhookSubscriptions` và `latticeWebhookDeliveries` bị chặn bởi `registerEventBusDirectGuard` (`403 EVENTS_DIRECT_CRUD_FORBIDDEN`). Mọi thao tác đọc và điều phối đi qua tài nguyên `dxosEvents`.

Để đảm bảo nhiều replica của ứng dụng có thể rút hàng đợi song song mà không giao trùng một thông điệp, hàm `claimDueDeliveries` thực thi hai bước trên PostgreSQL:

1. **Thu hồi khóa treo (`staleLockMs = 120000`):** Các bản ghi ở trạng thái `processing` có `lockedAt < NOW() - 120s` được chuyển lại `retry_wait` và giải phóng `lockedAt`/`lockedBy`.
2. **Nhận lô nguyên tử (`FOR UPDATE OF d SKIP LOCKED`):** Chọn tối đa `batchSize` (mặc định `20`, tối đa `100`) bản ghi đến hạn thuộc các subscription có `active = TRUE` và mạch không bị khóa, khóa hàng và chuyển sang `processing` ngay trong giao dịch.

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
FOR UPDATE OF d SKIP LOCKED
```

Khi gửi HTTP đi ra (`dispatchOneDelivery`), worker kiểm tra lại URL qua bộ lọc SSRF (`assertSafeConnectorUrlAsync`), tắt chuyển hướng (`redirect: 'error'`), áp dụng `WEBHOOK_TIMEOUT_MS = 5000` ms và đính kèm các header Standard Webhooks cùng metadata CloudEvents (`webhook-id: msg_<eventId>_<delId>`, `webhook-timestamp`, `webhook-signature: v1,<b64>`, `ce-id`, `ce-type`, `ce-specversion: 1.0`).

## Chính sách Thử lại, Ngắt mạch & Hàng đợi Chết (DLQ)

Nếu endpoint đối tác trả về mã ngoài `2xx` hoặc quá thời gian `5,000 ms`, `event-bus.js` cập nhật trạng thái giao nhận và bộ đếm lỗi trên subscription:

| Hằng số / Cơ chế | Giá trị mặc định | Hành vi vận hành |
| :--- | :--- | :--- |
| `DRAINER_INTERVAL_MS` | `10,000` ms | Chu kỳ chạy bộ rút nền (tắt bằng `DX_EVENT_BUS_DRAINER=false`) |
| `WEBHOOK_TIMEOUT_MS` | `5,000` ms | Ngưỡng `AbortSignal.timeout` cho mỗi lần gửi HTTP POST |
| `DEFAULT_MAX_ATTEMPTS` | `5` lần | Hết số lần thử, bản ghi chuyển sang trạng thái `dlq` và sự kiện cha cập nhật `partial_failed` |
| `computeWebhookBackoffMs` | `baseMs = 5,000`, `maxMs = 3,600,000` | Độ trễ hàm mũ `min(maxMs, 5000 * 2^attempt)` cộng jitter ngẫu nhiên tối đa `25%` (trần jitter `5,000 ms`) |
| `CIRCUIT_FAILURE_THRESHOLD` | `5` lỗi liên tiếp | Khi `failureCount >= 5` (hoặc thử thất bại ở trạng thái `half_open`), `circuitState` mở sang `open` |
| `CIRCUIT_COOLDOWN_MS` | `120,000` ms | Thời gian ngắt mạch trước khi cho phép chuyển sang `half_open` để thăm dò lại |

Quản trị viên theo dõi và vận hành toàn bộ vòng đời sự kiện qua 10 action của `dxosEvents`:

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:saveSubscription"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Tạo hoặc cập nhật đăng ký webhook (slug, targetUrl qua kiểm tra SSRF, eventPattern glob, signingSecret mã hóa AES-256-GCM và connectorId tùy chọn)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:replayDlq"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Đưa các bản ghi trạng thái dlq (lọc theo subscriptionId, eventId hoặc deliveryIds) về pending với attempt = 0 để gửi lại."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosEvents:resetCircuit"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Đóng lại bộ ngắt mạch về circuitState = closed và đặt failureCount = 0 cho một subscription."
/>

Các action còn lại của `dxosEvents` gồm `listEvents` (`GET`), `publish` (`POST`, giới hạn `depth` trong `0..8`), `listSubscriptions` (`GET`), `toggleSubscription` (`POST`), `deleteSubscription` (`POST`/`DELETE`), `listDeliveries` (`GET`) và `dispatchNow` (`POST`).

## Lập lịch Cron & Bộ Quét Tác vụ Trì hoãn (`flow/cron.js`)

Khi nút `trigger.schedule` được phát hành trong LatticeFlow v2, module `flow/cron.js` phân tích biểu thức cron 5 trường chuẩn POSIX:

| Trường | Miền giá trị hợp lệ | Quy tắc chuẩn hóa |
| :--- | :--- | :--- |
| `minute` | `0..59` | Hỗ trợ `*`, dải `a-b`, bước `*/n`, danh sách `a,b` |
| `hour` | `0..23` | Hỗ trợ `*`, dải, bước, danh sách |
| `dom` (ngày trong tháng) | `1..31` | Nếu cả `dom` và `dow` đều khác `*`, khớp theo logic `OR` chuẩn POSIX |
| `month` | `1..12` | Hỗ trợ `*`, dải, bước, danh sách |
| `dow` (ngày trong tuần) | `0..7` | Giá trị `7` tự động chuẩn hóa thành `0` (Chủ nhật) |

Việc đánh giá thời gian sử dụng `Intl.DateTimeFormat` theo múi giờ IANA cấu hình trong `timezone` (mặc định `UTC`), với bộ nhớ đệm tối đa `64` formatter và tầm tìm kiếm `computeNextCronRun` trong `366` ngày kế tiếp.

Bộ quét `tickFlowScheduler` chạy định kỳ theo `DX_FLOW_DELAY_TICK_MS` (mặc định `15,000` ms) và thực hiện tuần tự ba công việc: `tickScheduledRules`, `tickDueDelayedRuns` (nút `control.delay`) và `tickExpiredApprovals` (hết hạn `ttlHours` của `control.approval`). Để tránh hai bản sao máy chủ chạy trùng một lịch cron, `runWithSchedulerLock` giữ khóa giao dịch PostgreSQL:

```sql
SELECT pg_try_advisory_xact_lock(hashtext('dxos_flow_scheduler_tick')) AS acquired
```

Nếu `acquired === false`, bản sao thứ hai bỏ qua vòng quét hiện tại (`skippedLock: true`). Trước khi chạy luồng, `tickScheduledRules` kiểm tra `nextRunAt <= now` (hoặc điều kiện `sameMinute` dựa trên `lastTriggeredAt` ở lượt khởi tạo đầu) và cập nhật sẵn `nextRunAt` mới ngay trong giao dịch khóa nhằm ngăn kích hoạt lặp trong cùng một phút.

## Đảm bảo Idempotency & Chống Trùng lặp

Cơ chế chống xử lý trùng lặp được áp dụng xuyên suốt từ lớp tiếp nhận đến lớp thực thi:

| Tầng kiểm soát | Cơ chế chống trùng lặp / phát lại |
| :--- | :--- |
| Chỉ mục sự kiện duy nhất (`uidx_lattice_events_event_id`) | Mỗi CloudEvent trong `latticeEventBus` mang `eventId` UUID v4 duy nhất; hàng đợi giao nhận gắn khóa ghép `(subscriptionId, eventId)` qua `idx_lattice_wh_del_sub_event`. |
| Cửa sổ chống phát lại Standard Webhooks | Tham số `toleranceSec = 300` giây từ chối các gói webhook có dấu thời gian `webhook-timestamp` chênh lệch quá 5 phút so với đồng hồ máy chủ. |
| Tiếp tục phiên tạm dừng nguyên tử (`claimSuspendedRun`) | Các luồng tạm dừng tại `control.delay` hoặc `control.approval` chỉ được đánh thức một lần duy nhất qua câu lệnh `UPDATE ... WHERE status = 'suspended' RETURNING *`. |
| Idempotency trên cầu nối `n8n` | Mọi lệnh `POST`/`PUT` sang Stock `n8n` luôn kèm header `Idempotency-Key`. |

## Tài liệu liên quan

- [Tích hợp Stock n8n & OAuth2 PKCE](/automation/n8n-integration)
- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [Sự kiện & Outbox Giao dịch](/architecture/events-and-outbox)
- [Tham chiếu API REST](/reference/rest-api)
