---
title: Thông báo Đa kênh (dxosNotify)
description: Định tuyến thông báo đa kênh SMTP, Telegram, Slack, Webhook và In-App kèm mẫu nội dung, che bí mật và thử lại backoff lũy thừa.
---

<script setup>
const notifyTabs = [
  {
    label: 'Gửi đa kênh (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosNotify:send \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "channels": ["telegram", "slack", "webhook"],
    "title": "Canh bao nhiet do kho {{warehouseCode}}",
    "body": "Lo {{lotCode}} ghi nhan MKT {{mktCelsius}}C",
    "variables": {
      "warehouseCode": "WH-CT-01",
      "lotCode": "LOT-2026-A09",
      "mktCelsius": 8.74
    }
  }'`,
  },
  {
    label: 'Phản hồi điều phối (JSON)',
    lang: 'json',
    code: `{
  "data": {
    "organizationId": "org-coldchain-01",
    "total": 3,
    "succeeded": 3,
    "failed": 0,
    "deliveries": [
      { "channel": "telegram", "status": "sent", "attempts": 1 },
      { "channel": "slack", "status": "sent", "attempts": 1 },
      { "channel": "webhook", "status": "sent", "attempts": 1 }
    ]
  }
}`,
  },
];
</script>

# Thông báo Đa kênh (`dxosNotify`)

Hệ thống thông báo của `@latticedx/plugin-lattice-foundation` tách biệt luồng thông báo nội bộ trong cổng giao diện (`notification-center.js`, lưu tại `latticeNotifications`) khỏi bộ định tuyến gửi ra kênh ngoài (`omnichannel-notify.js`, tài nguyên `dxosNotify`, lưu nhật ký tại `latticeNotificationDeliveries`). Toàn bộ thông tin xác thực của kênh gửi nằm trong kho mã hóa `latticeConnectors` (`AES-256-GCM` qua `dxosVault`), không bao giờ lộ ra phản hồi API hay nhật ký vận chuyển.

## Kênh hỗ trợ và kiến trúc định tuyến

`dxosNotify` hỗ trợ bốn giao thức vận chuyển ngoài (`SUPPORTED_CHANNELS`: `smtp`, `telegram`, `slack`, `webhook`) kết hợp với kênh `in_app` nội bộ và tùy chọn điều phối qua `DX_APPRISE_URL` / `DX_NOTIFICATION_WEBHOOK_URL`. Truy cập CRUD trực tiếp vào `latticeNotificationDeliveries` bị chặn ở tầng middleware; mọi thao tác gửi và tra cứu phải đi qua API `dxosNotify`.

| Kênh | Connector tương ứng trong `dxosVault` | Định dạng tải trọng | Bảo vệ đầu vào đặc thù |
| :--- | :--- | :--- | :--- |
| `smtp` | `email_smtp` | Nội dung văn bản hoặc HTML đã nội suy <code v-pre>{{var}}</code> | Chặn ký tự `\r`, `\n`, `\0` chống chèn tiêu đề (`SMTP_HEADER_INJECTION_BLOCKED`). |
| `telegram` | `telegram` | Chuỗi văn bản qua Bot API | Kiểm tra định dạng token (`[0-9]{5,16}:[A-Za-z0-9_-]{20,120}`) và `chat_id`. |
| `slack` | `slack` | Incoming Webhook hoặc Web API JSON | Nhận diện lỗi tạm thời `ratelimited`, `internal_error`, `fatal_error`. |
| `webhook` | `webhook` / HTTP connector | JSON tùy biến hoặc envelope chuẩn `lattice.notification` | Kiểm tra SSRF DNS bất đồng bộ (`assertSafeConnectorUrlAsync`). |
| `in_app` | Chuông thông báo nội bộ | Bản ghi `latticeNotifications` theo người dùng / vai trò | Đọc và đánh dấu qua tài nguyên `latticeNotifications`. |

<ApiEndpoint
  method="POST"
  path="/api/dxosNotify:send"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Gửi thông báo tới một kênh đơn lẻ hoặc phát đồng thời qua danh sách channels (yêu cầu vai trò operator/admin)."
/>

<ParamGrid
  title="Tham số gửi thông báo của dxosNotify:send"
  :items="[
    { name: 'channel / channels', type: 'string | string[]', required: true, description: 'Tên một kênh hoặc mảng nhiều kênh trong [smtp, telegram, slack, webhook].' },
    { name: 'connectorKey', type: 'string', description: 'Khóa connector cụ thể trong dxosVault; nếu bỏ trống sẽ chọn connector đang hoạt động của kênh.' },
    { name: 'target', type: 'string | string[]', description: 'Địa chỉ nhận (email, Telegram chat_id, hoặc đích ghi đè nếu cấu hình connector cho phép).' },
    { name: 'title', type: 'string', required: true, description: 'Tiêu đề thông báo (hỗ trợ biến mẫu {{var}}).' },
    { name: 'body', type: 'string', required: true, description: 'Nội dung thông báo (hỗ trợ {{dot.path}} và tùy chọn thoát HTML).' },
    { name: 'variables', type: 'object', description: 'Đối tượng ngữ cảnh cấp cho bộ nội suy renderTemplate và renderWebhookPayload.' },
    { name: 'template', type: 'object | string', description: 'Cấu trúc JSON mẫu dành riêng cho kênh webhook hoặc Slack.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Chế độ giả lập dựng tải trọng và ghi nhận kết quả mà không gửi ra mạng.' }
  ]"
/>

## Bộ nội suy mẫu và che giấu bí mật

Hàm `renderTemplate(template, vars, { htmlEscape })` thay thế biểu thức <code v-pre>{{dot.path}}</code> bằng cách duyệt thuộc tính an toàn thông qua `Object.hasOwn`, đồng thời chặn tuyệt đối các khóa nguyên mẫu thuộc `BLOCKED_PATH_KEYS` (`__proto__`, `constructor`, `prototype`). Khi `htmlEscape: true` được bật cho nội dung email HTML, ký tự `&`, `<`, `>`, `"` và `'` được mã hóa thành thực thể HTML an toàn.

Đối với kênh `webhook`, `renderWebhookPayload` nội suy đệ quy từng nút trong JSON mẫu (`sanitizeAndInterpolateNode`) hoặc tự dựng JSON envelope chuẩn nếu không truyền `template`:

```json
{
  "event": "lot.held_mkt",
  "organizationId": "org-coldchain-01",
  "category": "cold_chain",
  "severity": "high",
  "title": "Canh bao MKT vuot nguong lo LOT-2026-A09",
  "body": "Gia tri MKT dat 8.74C vuot nguong cho phep 8.0C",
  "targetCollection": "latticeStockLots",
  "targetRecordId": 41,
  "targetPath": "/p/incidents",
  "timestamp": "2026-11-26T16:10:00.000Z"
}
```

Trước khi lưu lịch sử gửi vào `latticeNotificationDeliveries`, hệ thống thực thi hai lớp làm sạch dữ liệu (`maskTarget` và `scrubSecrets`):

| Cơ chế làm sạch | Đối tượng xử lý | Kết quả lưu trong `latticeNotificationDeliveries` |
| :--- | :--- | :--- |
| `maskEmail` (`smtp`) | Địa chỉ email người nhận | Giữ ký tự đầu và tên miền (`a***@example.com`). |
| `maskTarget` (`telegram`) | `chat_id` người nhận | Giữ 2 ký tự đầu và 2 ký tự cuối (`12***89`). |
| `scrubSecrets` | Chuỗi lỗi, header và bản ghi phản hồi | Thay thế token Bot Telegram, header `Bearer`/`Basic`, khóa Slack `xox*` và mọi bí mật từ Vault bằng `[REDACTED]`. |

## Chính sách thử lại và backoff lũy thừa

Mọi lượt gọi mạng gửi ra ngoài đều áp đặt thời gian chờ `DEFAULT_TIMEOUT_MS = 6000` ms và tối đa `DEFAULT_MAX_ATTEMPTS = 3` lần thử (có thể cấu hình trong khoảng `1..5`). Cơ chế thử lại phân biệt rõ lỗi tạm thời (`err.retryable === true`) với lỗi cấu hình hoặc dữ liệu không hợp lệ để tránh lặp vô ích.

| Kênh / Giao thức | Điều kiện thử lại (`retryable = true`) | Điều kiện dừng ngay (`retryable = false`) |
| :--- | :--- | :--- |
| HTTP (`webhook`, `telegram`) | HTTP `429`, HTTP `>= 500`, lỗi socket hoặc hết thời gian chờ `6000` ms. | HTTP `400`, `401`, `403`, `404` hoặc URL bị chặn bởi bộ lọc SSRF. |
| SMTP (`smtp`) | Mã phản hồi SMTP tạm thời `4xx` hoặc lỗi kết nối TCP/TLS. | Mã lỗi SMTP `5xx`, địa chỉ email sai cú pháp hoặc lỗi `SMTP_HEADER_INJECTION_BLOCKED`. |
| Slack (`slack`) | Mã lỗi `ratelimited`, `internal_error`, `fatal_error` hoặc HTTP `>= 500`. | Mã lỗi `invalid_payload`, `channel_not_found`, `invalid_auth`. |

Khoảng nghỉ giữa hai lần thử tuân theo công thức backoff lũy thừa có trần:

```text
delayMs = Math.min(5000, 250 * 2 ** (attempt - 1))
```

Với giá trị mặc định `DEFAULT_BACKOFF_BASE_MS = 250` ms và `MAX_BACKOFF_MS = 5000` ms, hệ thống chờ `250` ms sau lần lỗi đầu tiên và `500` ms sau lần lỗi thứ hai trước khi đánh dấu kết quả cuối cùng.

## Tham chiếu API `dxosNotify`

| Endpoint | Phương thức | Vai trò yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `/api/dxosNotify:send` | `POST` | `OPERATOR_ROLES` (`root`, `admin`, `ldx_admin`, `ldx_manager`, `operator`) | Gửi thông báo đơn kênh hoặc đa kênh theo cấu hình tổ chức. |
| `/api/dxosNotify:testSend` | `POST` | `ELEVATED_ROLES` (`root`, `admin`, `ldx_admin`) | Kiểm tra kết nối và mẫu nội dung của connector trong `dxosVault`. |
| `/api/dxosNotify:logs` | `GET` | `ELEVATED_ROLES` (`root`, `admin`, `ldx_admin`) | Truy vấn nhật ký `latticeNotificationDeliveries` đã che PII và bí mật. |
| `/api/dxosNotify:channels` | `GET` | `loggedIn` | Liệt kê `supportedChannels` và danh sách connector đang bật của tổ chức. |

<ApiEndpoint
  method="GET"
  path="/api/dxosNotify:logs"
  auth="Bearer JWT | ldx_pat_*"
  scope="read, write"
  summary="Truy vấn lịch sử gửi thông báo theo channel, status và dryRun với thông tin đích đã được che."
/>

<ParamGrid
  title="Tham số lọc nhật ký của dxosNotify:logs"
  :items="[
    { name: 'channel', type: 'string', description: 'Lọc theo kênh vận chuyển: smtp, telegram, slack hoặc webhook.' },
    { name: 'status', type: 'string', description: 'Lọc theo kết quả gửi: sent, failed hoặc dry_run.' },
    { name: 'dryRun', type: 'boolean', description: 'Lọc riêng các lượt chạy giả lập không gửi ra mạng.' },
    { name: 'limit', type: 'integer', default: '50', description: 'Số lượng bản ghi tối đa trên một trang phản hồi.' },
    { name: 'offset', type: 'integer', default: '0', description: 'Vị trí bắt đầu phân trang từ nhật ký gần nhất.' }
  ]"
/>

## Biến môi trường và ranh giới SSRF

Mặc định, `omnichannel-notify.js` kiểm tra mọi địa chỉ đích bằng phân giải DNS bất đồng bộ (`assertSafeConnectorUrlAsync`) và chặn các dải loopback, mạng riêng RFC 1918, link-local (`169.254.*`) và metadata cloud. Quản trị viên có thể kiểm soát hành vi kết nối nội bộ qua các biến môi trường sau:

| Biến môi trường | Mặc định | Mục đích |
| :--- | :--- | :--- |
| `DX_APPRISE_URL` | *(trống)* | Điểm cuối cầu nối Apprise tùy chọn để mở rộng kênh thông báo ngoài. |
| `DX_NOTIFICATION_WEBHOOK_URL` | *(trống)* | URL webhook dự phòng cấp nền tảng khi không chỉ định connector riêng. |
| `DX_ALLOW_INTERNAL_CONNECTORS` | `'false'` | Cho phép hay chặn hoàn toàn webhook trỏ tới dải địa chỉ mạng nội bộ. |
| `DX_INTERNAL_SERVICE_HOSTS` | *(trống)* | Danh sách tên máy chủ nội bộ được phép truy cập có kiểm soát khi `root` cho phép. |

<CodeTabs :tabs="notifyTabs" />

Trong tự động hóa quy trình, nút `notify.send` của LatticeFlow v2 gọi trực tiếp cơ chế gửi đa kênh này song song với thông báo nội bộ `in_app`, trong khi bộ máy SLA (`latticeSlaPolicies`) và `dxosApprovals` dùng `dxosNotify` để phát cảnh báo leo thang khi hồ sơ quá hạn.

## Tài liệu liên quan

- [Sự kiện CloudEvents và Transactional Outbox](/architecture/events-and-outbox)
- [Phê duyệt Thống nhất và Ủy quyền](/domains/approvals-and-delegations)
- [Tham chiếu 24 Node LatticeFlow v2](/automation/node-reference)
- [Cấu hình biến môi trường](/getting-started/configuration)
