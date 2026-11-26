---
title: Tham chiếu 24 Loại Nút LatticeFlow v2
description: Đặc tả đầy đủ 24 loại nút LatticeFlow v2 thuộc 6 nhóm (trigger, control, data, logic, ai, integration) kèm cấu hình, cổng kết nối và cấu trúc đầu ra.
---

# Tham chiếu 24 Loại Nút LatticeFlow v2

Mỗi nút trong LatticeFlow v2 được định nghĩa và xác thực qua `validateNodeDefinition` trong `plugins/nocobase/plugin-dxos-studio/src/server/flow/registry.js`. Toàn bộ 24 nút chia thành 6 nhóm chức năng (`trigger`, `control`, `data`, `logic`, `ai`, `integration`) và dùng chung hợp đồng bao ngoài gồm `id`, `type`, `label`, `position`, `config`, `continueOnFail` và `timeoutMs`.

<ApiEndpoint
  method="GET"
  path="/api/dxosAutomations:nodeRegistry"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Trả về mảng nodeTypes chứa toàn bộ 24 schema nút đang đăng ký trong flowRegistry."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:testNode"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write"
  summary="Kiểm thử độc lập một nút bằng dữ liệu pinnedInputs bên trong savepoint RLS (mặc định dryRun=true)."
/>

## Bảng chỉ mục 24 nút

| # | Loại nút (`type`) | Nhóm | Cổng vào | Cổng ra (`outputs`) | Chức năng chính |
|---|---|---|---|---|---|
| 1 | `trigger.event` | `trigger` | `[]` | `main` | Khởi chạy từ CloudEvents khớp mẫu trên Event Bus |
| 2 | `trigger.record` | `trigger` | `[]` | `main` | Khởi chạy từ ORM hook `create`, `update` hoặc `delete` |
| 3 | `trigger.schedule` | `trigger` | `[]` | `main` | Khởi chạy định kỳ theo biểu thức cron 5 trường và múi giờ |
| 4 | `trigger.webhook` | `trigger` | `[]` | `main` | Khởi chạy từ HTTP POST xác thực HMAC-SHA256 hoặc Bearer |
| 5 | `trigger.manual` | `trigger` | `[]` | `main` | Khởi chạy thủ công từ Studio hoặc API `runNow` |
| 6 | `control.if` | `control` | `in` | `true`, `false`, `error` | Rẽ nhánh nhị phân theo luật lọc có cấu trúc |
| 7 | `control.switch` | `control` | `in` | `case_0`, `case_1`, `case_2`, `default`, `error` | Phân nhánh đa chiều theo danh sách `cases` |
| 8 | `control.parallel` | `control` | `in` | `main`, `error` | Fan-out đồng thời tới mọi nhánh đầu ra đang nối |
| 9 | `control.merge` | `control` | `in` | `main`, `error` | Gộp các nhánh song song theo `wait_all` hoặc `first_completed` |
| 10 | `control.loop` | `control` | `in` | `item`, `done`, `error` | Lặp qua mảng (tối đa 100 phần tử) có lưu con trỏ bền vững |
| 11 | `control.delay` | `control` | `in` | `main`, `error` | Tạm dừng luồng theo số giây hoặc mốc ISO-8601 |
| 12 | `control.approval` | `control` | `in` | `approved`, `rejected`, `error` | Treo luồng tạo tác vụ phê duyệt HITL theo vai trò |
| 13 | `control.subflow` | `control` | `in` | `main`, `error` | Gọi một quy trình khác cùng tổ chức với trần độ sâu 8 |
| 14 | `data.query` | `data` | `in` | `main`, `error` | Truy vấn bản ghi thuộc tổ chức trong bảng nghiệp vụ cho phép |
| 15 | `data.create` | `data` | `in` | `main`, `error` | Tạo bản ghi mới với `organizationId` cưỡng chế |
| 16 | `data.update` | `data` | `in` | `main`, `error` | Cập nhật bản ghi khớp `recordId` hoặc `filter` không rỗng |
| 17 | `logic.dmn` | `logic` | `in` | `main`, `error` | Đánh giá bảng quyết định DMN và ghi `context.dmn` |
| 18 | `logic.transform` | `logic` | `in` | `main`, `error` | Biến đổi dữ liệu khai báo qua 9 phép toán an toàn |
| 19 | `ai.llm` | `ai` | `in` | `main`, `error` | Gọi nhà cung cấp LLM tương thích OpenAI kèm ẩn danh PII |
| 20 | `ai.agent` | `ai` | `in` | `main`, `error` | Đề xuất phân loại đơn lượt hoặc vòng lặp ReAct dùng công cụ |
| 21 | `integration.http` | `integration` | `in` | `main`, `error` | Gọi HTTP connector trong Vault với khóa origin và chống SSRF |
| 22 | `iot.twin_command` | `integration` | `in` | `main`, `error` | Đẩy bản vá `desiredPatch` tới Digital Twin hoặc cổng HITL |
| 23 | `notify.send` | `integration` | `in` | `main`, `error` | Gửi thông báo theo vai trò qua 5 kênh cấu hình sẵn |
| 24 | `event.emit` | `integration` | `in` | `main`, `error` | Phát CloudEvent mới lên Event Bus và tăng `depth` |

## Nhóm `trigger` (5 nút)

Tất cả các nút kích hoạt (`nodes/triggers.js`) có mảng `inputs: []`, `outputs: ['main']` và trả về cùng cấu trúc đầu ra chuẩn hóa:

```json
{
  "type": "lot.held_mkt",
  "data": { "lotCode": "LOT-VAX-01", "mktCelsius": 10.4 },
  "record": null,
  "timestamp": "2026-11-26T08:30:00.000Z",
  "webhook": null,
  "schedule": null
}
```

### 1. `trigger.event`

Khởi chạy quy trình khi Lattice Event Bus phát hành một CloudEvent khớp mẫu `eventType` (hỗ trợ wildcard `*` và danh sách phân tách dấu phẩy) và thỏa điều kiện `filterJson`.

<ParamGrid
  title="Cấu hình trigger.event"
  :items="[
    { name: 'eventType', type: 'string', required: true, default: '*', description: 'Mẫu loại sự kiện CloudEvents cần lắng nghe (ví dụ lot.held_mkt hoặc entity.*).' },
    { name: 'filterJson', type: 'json', default: 'null', description: 'Bộ lọc cấu trúc kiểm tra payload sự kiện trước khi tạo lượt chạy.' }
  ]"
/>

### 2. `trigger.record`

Kích hoạt qua ORM hook (`registerRecordTriggerHooks`) khi tạo mới, cập nhật hoặc xóa bản ghi trên bảng nghiệp vụ nằm trong danh sách cho phép (`ALLOWLISTED_BUSINESS_COLLECTIONS` hoặc `latticeCustom*`). Giá trị `output.record` mang bản ghi ORM đã làm sạch khóa prototype.

<ParamGrid
  title="Cấu hình trigger.record"
  :items="[
    { name: 'collection', type: 'string', required: true, default: '\u0022\u0022', description: 'Tên bảng nghiệp vụ hoặc bảng tùy chỉnh latticeCustom*.' },
    { name: 'operation', type: 'string', required: true, default: 'create', description: 'Thao tác ORM kích hoạt luồng: create, update hoặc delete.' },
    { name: 'filterJson', type: 'json', default: 'null', description: 'Điều kiện lọc trên bản ghi vừa thay đổi.' }
  ]"
/>

### 3. `trigger.schedule`

Kích hoạt định kỳ theo biểu thức cron 5 trường (`minute hour dom month dow`, chuẩn hóa giá trị chủ nhật `7` về `0`) và múi giờ IANA. Quét qua `tickScheduledRules` dưới khóa tư vấn PostgreSQL `dxos_flow_scheduler_tick`; trường `output.schedule` chứa `{ cron, timezone }`.

<ParamGrid
  title="Cấu hình trigger.schedule"
  :items="[
    { name: 'cron', type: 'string', required: true, default: '0 * * * *', description: 'Biểu thức cron 5 trường chuẩn UNIX.' },
    { name: 'timezone', type: 'string', default: 'UTC', description: 'Múi giờ đánh giá lịch bằng Intl.DateTimeFormat (ví dụ Asia/Ho_Chi_Minh).' }
  ]"
/>

### 4. `trigger.webhook`

Tiếp nhận yêu cầu HTTP POST từ bên ngoài qua `POST /api/dxosAutomations:webhookIngress`. Xác thực chữ ký theo `authMode` trước khi dựng luồng và điền `{ webhookPath, authMode, secretHeader }` vào `output.webhook`.

<ParamGrid
  title="Cấu hình trigger.webhook"
  :items="[
    { name: 'webhookPath', type: 'string', required: true, default: '\u0022\u0022', description: 'Định danh đường dẫn webhook nội bộ gắn với rule.' },
    { name: 'authMode', type: 'string', required: true, default: 'hmac', description: 'Chế độ xác thực: hmac (HMAC-SHA256 / Standard Webhooks) hoặc bearer.' },
    { name: 'secretHeader', type: 'string', default: 'X-Lattice-Signature-256', description: 'Tên HTTP header chứa chữ ký HMAC khi authMode là hmac.' }
  ]"
/>

### 5. `trigger.manual`

Khởi tạo quy trình từ giao diện Control Studio hoặc API `POST /api/dxosAutomations:runNow`. Trường `inputSchemaJson` khai báo khung JSON đầu vào mẫu cho người vận hành và công cụ kiểm thử.

<ParamGrid
  title="Cấu hình trigger.manual"
  :items="[
    { name: 'inputSchemaJson', type: 'json', default: '{}', description: 'Đặc tả JSON mô tả các trường đầu vào mong đợi khi chạy thủ công.' }
  ]"
/>

## Nhóm `control` (8 nút)

Các nút điều khiển (`nodes/control.js`) nhận đầu vào qua cổng `in` và định tuyến luồng chạy, phân nhánh, lặp tuần tự hoặc tạm dừng bền vững.

### 6. `control.if`

Đánh giá `condition` sau khi nội suy <code v-pre>{{path}}</code> qua hàm `matchesFilter`. Cổng đầu ra gồm `true`, `false`, `error`, và đầu ra trả về `{ matched, condition }`.

<ParamGrid
  title="Cấu hình control.if"
  :items="[
    { name: 'condition', type: 'json', required: true, default: '{\u0022field\u0022:\u0022\u0022,\u0022op\u0022:\u0022eq\u0022,\u0022value\u0022:\u0022\u0022}', description: 'Biểu thức lọc cấu trúc hỗ trợ $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $contains, $and, $or, $not.' }
  ]"
/>

### 7. `control.switch`

Đọc giá trị tại `expression` và duyệt tuần tự mảng `cases` để chọn cổng đầu tiên thỏa điều kiện (`port` tùy chỉnh hoặc `case_0`, `case_1`, `case_2`). Nếu không nhánh nào khớp, luồng đi ra cổng `default`. Đầu ra trả về `{ matched, port, value }`.

<ParamGrid
  title="Cấu hình control.switch"
  :items="[
    { name: 'expression', type: 'string', required: true, default: '\u0022\u0022', description: 'Đường dẫn biến (data.priority) hoặc mẫu {{path}} cần so khớp.' },
    { name: 'cases', type: 'json', required: true, default: '[{\u0022port\u0022:\u0022case_0\u0022,\u0022operator\u0022:\u0022eq\u0022,\u0022equals\u0022:\u0022\u0022}]', description: 'Mảng đối tượng nhánh gồm port, operator (hoặc op), equals (hoặc value) hoặc condition.' }
  ]"
/>

### 8. `control.parallel`

Phát đồng thời dữ liệu đầu vào qua cổng `main` tới toàn bộ các cạnh đầu ra đang nối (`outputs: ['main', 'error']`). Động cơ gom các nút đích sẵn sàng vào `runRlsAwareBatch`. Đầu ra trả về `{ fannedOut: true, input }`.

<ParamGrid
  title="Cấu hình control.parallel"
  :items="[
    { name: 'mode', type: 'string', default: 'fan_out', description: 'Chế độ phân nhánh song song cố định là fan_out.' }
  ]"
/>

### 9. `control.merge`

Hợp nhất đầu ra từ các nhánh tiền nhiệm (`outputs: ['main', 'error']`) và trả về `{ mode, merged, branches }`. Với `wait_all`, nút đợi mọi nhánh tiền nhiệm đang hoạt động hoàn tất; với `first_completed`, nút chạy ngay khi nhánh đầu tiên tới nơi và bỏ qua các nhánh chậm hơn.

<ParamGrid
  title="Cấu hình control.merge"
  :items="[
    { name: 'mode', type: 'string', required: true, default: 'wait_all', description: 'Chế độ hợp nhất: wait_all hoặc first_completed.' }
  ]"
/>

### 10. `control.loop`

Duyệt qua mảng tại `itemsPath` và chạy đồ thị con nối từ cổng `item` cho từng phần tử với ngữ cảnh `loop = { item, index, count }`, sau đó đẩy kết quả tổng hợp sang cổng `done` (`outputs: ['item', 'done', 'error']`). Giới hạn cứng là `MAX_LOOP_CAP = 100`; đầu ra cuối chứa `{ items, count, totalCount, maxIterations, truncated, results }`.

<ParamGrid
  title="Cấu hình control.loop"
  :items="[
    { name: 'itemsPath', type: 'string', required: true, default: 'data.items', description: 'Đường dẫn tới mảng cần lặp trong ngữ cảnh thực thi.' },
    { name: 'maxIterations', type: 'number', required: true, default: '100', description: 'Số lần lặp tối đa trong khoảng 1..100; vượt trần sẽ báo lỗi FLOW_LOOP_LIMIT_EXCEEDED.' },
    { name: 'strictLimit', type: 'boolean', default: 'false', description: 'Khi true, báo lỗi ngay nếu mảng gốc dài hơn maxIterations thay vì cắt bớt.' }
  ]"
/>

### 11. `control.delay`

Tính mốc thời gian đánh thức `resumeAt` từ `untilIso` hoặc `Date.now() + durationSec * 1000`, sau đó treo lượt chạy (`status: 'suspended'`, `outputs: ['main', 'error']`). Khi `dryRun=true`, nút trả về `{ delayed: true, simulated: true, resumeAt, durationSec }` mà không treo.

<ParamGrid
  title="Cấu hình control.delay"
  :items="[
    { name: 'durationSec', type: 'number', default: '60', description: 'Khoảng thời gian trễ tính bằng giây khi không truyền untilIso.' },
    { name: 'untilIso', type: 'string', default: '\u0022\u0022', description: 'Mốc thời gian đích chuẩn ISO-8601 (hỗ trợ nội suy {{path}}).' }
  ]"
/>

### 12. `control.approval`

Tạo yêu cầu phê duyệt trong `latticeAiApprovalQueue` và treo lượt chạy (`outputs: ['approved', 'rejected', 'error']`) kèm `resumeTokenHash` và hạn `resumeAt`. Khi `resumeRun` xác nhận vai trò `approverRole` hoặc ủy quyền hợp lệ, luồng đi tiếp qua `approved` hoặc `rejected`.

<ParamGrid
  title="Cấu hình control.approval"
  :items="[
    { name: 'approverRole', type: 'string', required: true, default: 'ldx_manager', description: 'Vai trò được phép phê duyệt hoặc từ chối lượt chạy.' },
    { name: 'title', type: 'string', required: true, default: 'Cần phê duyệt', description: 'Tiêu đề hiển thị trong hàng đợi phê duyệt HITL.' },
    { name: 'summary', type: 'string', default: '\u0022\u0022', description: 'Nội dung tóm tắt bối cảnh quyết định, hỗ trợ {{path}}.' },
    { name: 'riskLevel', type: 'string', default: 'medium', description: 'Mức độ rủi ro: low, medium, high hoặc critical.' },
    { name: 'ttlHours', type: 'number', default: '24', description: 'Thời hạn hiệu lực từ 1 đến 720 giờ trước khi quá hạn.' }
  ]"
/>

### 13. `control.subflow`

Gọi một quy trình đã phát hành khác (`ruleKey`) trong cùng `organizationId` qua `helpers.executeSubflow` (`outputs: ['main', 'error']`). Ngăn gọi đệ quy chính `ruleKey` hiện tại (`FLOW_SELF_RECURSIVE_SUBFLOW`) và trả về `{ ruleKey, depth, result }`.

<ParamGrid
  title="Cấu hình control.subflow"
  :items="[
    { name: 'ruleKey', type: 'string', required: true, default: '\u0022\u0022', description: 'Mã quy trình đích trong cùng tổ chức.' },
    { name: 'payloadMapping', type: 'json', default: '{}', description: 'Đối tượng payload truyền vào luồng con sau khi nội suy {{path}}.' },
    { name: 'maxDepth', type: 'number', default: '8', description: 'Trần độ sâu đệ quy riêng (1..8), không vượt MAX_SUBFLOW_DEPTH.' }
  ]"
/>

## Nhóm `data` (3 nút)

Các nút dữ liệu (`nodes/data.js`) chỉ cho phép thao tác trên `ALLOWLISTED_BUSINESS_COLLECTIONS` (`latticeRequests`, `latticeOrders`, `latticeOrderLines`, `latticeServiceTickets`, `latticeParaDocuments`, `latticeIncidentCases`, `latticeLocations`, `latticeAssets`, `latticeAgentProposals`) hoặc bảng tùy chỉnh khớp `^latticeCustom[A-Z][A-Za-z0-9]{1,40}$`. Mọi thao tác đều cưỡng chế lọc theo `organizationId` và chặn các bảng hệ thống nhạy cảm (`FORBIDDEN_SYSTEM_COLLECTIONS`).

Trên ba bảng chứng từ lõi (`latticeRequests`, `latticeOrders`, `latticeServiceTickets`), `sanitizeWriteValues` tự động loại bỏ các trường bảo vệ `id`, `organizationId`, `status`, `version`, `amendedFromId`, `amendmentNo`, `submittedAt`, `submittedBy`, `cancelledAt`, `cancelledBy`, `cancelReason`.

### 14. `data.query`

Truy vấn bản ghi thuộc tổ chức hiện tại (`outputs: ['main', 'error']`), kiểm tra độ an toàn của `filter` (`sanitizeDirectFilter`) và `sort` (`assertSafeDirectSort`), trả về `{ collection, count, items }`.

<ParamGrid
  title="Cấu hình data.query"
  :items="[
    { name: 'collection', type: 'string', required: true, default: 'latticeRequests', description: 'Tên bảng dữ liệu nghiệp vụ hoặc latticeCustom*.' },
    { name: 'filter', type: 'json', default: '{}', description: 'Bộ lọc truy vấn sau nội suy, tự động gộp với organizationId.' },
    { name: 'limit', type: 'number', default: '20', description: 'Số lượng bản ghi tối đa trả về (1..200).' },
    { name: 'sort', type: 'json', default: '[]', description: 'Danh sách trường sắp xếp hợp lệ (ví dụ [\u0022-createdAt\u0022]).' }
  ]"
/>

### 15. `data.create`

Tạo bản ghi mới trong phạm vi tổ chức qua `runWithOrmDepth` (tăng độ sâu ORM để chống vòng lặp vô hạn) và trả về `{ collection, id, record }`.

<ParamGrid
  title="Cấu hình data.create"
  :items="[
    { name: 'collection', type: 'string', required: true, default: '\u0022\u0022', description: 'Tên bảng dữ liệu nghiệp vụ cho phép.' },
    { name: 'values', type: 'json', required: true, default: '{}', description: 'Các trường giá trị cần tạo sau khi nội suy {{path}} và loại bỏ trường hệ thống.' }
  ]"
/>

### 16. `data.update`

Tìm các bản ghi khớp `filter` hoặc `recordId` trong cùng `organizationId` và cập nhật hàng loạt trong phạm vi `limit` (`outputs: ['main', 'error']`). Yêu cầu `filter` hoặc `recordId` không rỗng (`DATA_UPDATE_FILTER_REQUIRED`) để tránh cập nhật nhầm toàn bảng; trả về `{ collection, matchedCount, updatedCount }`.

<ParamGrid
  title="Cấu hình data.update"
  :items="[
    { name: 'collection', type: 'string', required: true, default: '\u0022\u0022', description: 'Tên bảng dữ liệu nghiệp vụ cho phép.' },
    { name: 'recordId', type: 'string', default: '\u0022\u0022', description: 'ID bản ghi mục tiêu khi không truyền filter.' },
    { name: 'filter', type: 'json', default: '{}', description: 'Bộ lọc bản ghi cần cập nhật (ưu tiên hơn recordId).' },
    { name: 'values', type: 'json', required: true, default: '{}', description: 'Các trường giá trị cần cập nhật sau khi lọc trường bảo vệ.' },
    { name: 'limit', type: 'number', default: '20', description: 'Giới hạn bản ghi đối khớp mỗi lần cập nhật (1..200).' }
  ]"
/>

## Nhóm `logic` (2 nút)

### 17. `logic.dmn`

Đánh giá bảng quyết định `tableKey` thuộc `latticeDecisionTables` trong cùng tổ chức qua `evaluateDecisionTable` (`outputs: ['main', 'error']`). Kết quả được nạp đồng thời vào `context.dmn` (có thể truy cập ở nút sau bằng <code v-pre>{{dmn.&lt;field&gt;}}</code>) và `context.dmnResult`. Đầu ra nút gồm `{ tableKey, matched, hitPolicy, outputs, matchedRules }`.

<ParamGrid
  title="Cấu hình logic.dmn"
  :items="[
    { name: 'tableKey', type: 'string', required: true, default: '\u0022\u0022', description: 'Mã bảng quyết định DMN đang kích hoạt (active=true) trong tổ chức.' },
    { name: 'facts', type: 'json', default: '{}', description: 'Dữ liệu đầu vào bổ sung gộp cùng event.data và input của nút trước.' }
  ]"
/>

### 18. `logic.transform`

Thực thi tuần tự mảng `operations` để ánh xạ, tính toán, đổi tên hoặc lọc trường dữ liệu mà không chạy `eval()` hay `new Function()` (`outputs: ['main', 'error']`). Cho phép dùng đồng thời `result` (trạng thái đang biến đổi) và `evalCtx` làm nguồn đọc.

<ParamGrid
  title="Cấu hình logic.transform"
  :items="[
    { name: 'operations', type: 'json', required: true, default: '[]', description: 'Mảng các phép biến đổi tuần tự theo khóa op.' },
    { name: 'baseFromInput', type: 'boolean', default: 'true', description: 'Khi true, khởi tạo đối tượng đích bằng bản sao an toàn của input; khi false, bắt đầu từ {}.' }
  ]"
/>

Chín phép toán được `logic.transform` hỗ trợ gồm:

| `op` | Tham số chính | Hành vi thực thi |
|---|---|---|
| `set` | `target`, `source` hoặc `value` | Gán giá trị từ `source` hoặc nội suy `value` vào đường dẫn `target`. |
| `template` | `target`, `expr` / `template` / `value` | Nội suy chuỗi mẫu <code v-pre>{{path}}</code> và ghi vào `target`. |
| `coerceNumber` | `target`, `source` / `value`, `precision?`, `fallback?` | Ép số hữu hạn và làm tròn theo `precision` (0..12); trả `fallback` nếu không hợp lệ. |
| `coerceBoolean` | `target`, `source` / `value` | Chuyển `'false'`, `'0'`, `'no'`, `'off'`, `''` thành `false`, còn lại ép `Boolean`. |
| `math` | `target`, `operator` (`add`, `sub`, `mul`, `div`), `left`/`right` hoặc `operands` hoặc `expr`, `precision?` | Tính toán số học hai toán hạng an toàn và chặn chia cho `0` (`TRANSFORM_DIVIDE_BY_ZERO`). |
| `concat` | `target`, `parts` / `sources`, `separator?` | Nối nhiều đường dẫn hoặc chuỗi mẫu theo dấu phân cách `separator`. |
| `rename` | `from` / `source`, `to` / `target` | Di chuyển giá trị sang khóa đích mới và xóa khóa nguồn. |
| `pick` | `keys` / `fields`, `target?` | Chỉ giữ lại danh sách trường chỉ định (ghi vào `target` hoặc thay thế toàn `result`). |
| `omit` | `keys` / `fields` | Xóa các trường chỉ định khỏi `result`. |

## Nhóm `ai` (2 nút)

### 19. `ai.llm`

Gọi nhà cung cấp tương thích OpenAI đã cấu hình trong `llmServices` (`outputs: ['main', 'error']`) qua `callConfiguredLlm`, tự động che PII trước khi gửi ra ngoài và kiểm tra SSRF qua `assertSafeLlmUrl`. Nếu chưa cấu hình dịch vụ LLM và có `fallbackOutput`, nút trả về đầu ra dự phòng với `mode: 'offline-fallback'` trên cổng `main`.

<ParamGrid
  title="Cấu hình ai.llm"
  :items="[
    { name: 'systemPrompt', type: 'string', default: '\u0022\u0022', description: 'Chỉ dẫn hệ thống gắn ở đầu hội thoại.' },
    { name: 'userPrompt', type: 'string', required: true, default: '\u0022\u0022', description: 'Nội dung yêu cầu gửi tới mô hình (hỗ trợ {{path}}).' },
    { name: 'responseFormat', type: 'string', default: 'json', description: 'Định dạng phản hồi: json hoặc text.' },
    { name: 'temperature', type: 'number', default: '0.2', description: 'Tham số độ ngẫu nhiên khi sinh văn bản.' },
    { name: 'maxTokens', type: 'number', default: '1600', description: 'Giới hạn token phản hồi tối đa.' },
    { name: 'model', type: 'string', default: '\u0022\u0022', description: 'Ghi đè tên model cụ thể (mặc định dùng cấu hình active trên llmServices).' },
    { name: 'fallbackOutput', type: 'json', default: 'null', description: 'Giá trị dự phòng khi chạy dryRun hoặc chưa cấu hình llmServices.' }
  ]"
/>

Đầu ra khi thành công trả về `{ mode, model, content, parsedJson, data, usage, piiRedactedCount }`.

### 20. `ai.agent`

Hỗ trợ hai chế độ thực thi (`outputs: ['main', 'error']`) trên bảng nghiệp vụ cho phép (`targetCollection`):

- **Chế độ `single` (mặc định):** Phân tích một lượt bằng LLM (hoặc `offline_fallback` khi chưa cấu hình LLM) và tạo bản ghi đề xuất ở trạng thái `proposed` trên `latticeAgentProposals` (hoặc `latticeAiApprovalQueue`).
- **Chế độ `react` (`mode: 'react'`, `enableReact: true` hoặc có `tools.length > 0`):** Chạy vòng lặp đa bước `executeReactAgent` tối đa `maxTurns` (1..12), xuất trace OpenTelemetry GenAI (`chat`, `execute_tool`, `invoke_agent`), đối chiếu `outputSchema` (tối đa 1 lượt tự sửa), và tự động tạm dừng HITL (`suspend: { kind: 'approval' }`) nếu tác nhân gọi một công cụ ghi dữ liệu (`isMutatingTool`).

<ParamGrid
  title="Cấu hình ai.agent"
  :items="[
    { name: 'mode', type: 'string', default: 'single', description: 'Chế độ suy luận: single hoặc react.' },
    { name: 'enableReact', type: 'boolean', default: 'false', description: 'Bật vòng lặp ReAct khi chưa đặt mode=react.' },
    { name: 'maxTurns', type: 'number', default: '5', description: 'Số vòng suy luận tối đa trong khoảng 1..12.' },
    { name: 'tools', type: 'json', default: '[]', description: 'Danh sách tên công cụ hợp lệ cấp cho agent.' },
    { name: 'outputSchema', type: 'json', default: 'null', description: 'JSON Schema bắt buộc kết quả cuối phải tuân thủ.' },
    { name: 'memoryScope', type: 'string', default: 'org', description: 'Phạm vi truy xuất bộ nhớ dài hạn: org, agent, user hoặc none.' },
    { name: 'enableMemory', type: 'boolean', default: 'false', description: 'Bật tự động nạp ký ức từ latticeAiMemory trước khi suy luận.' },
    { name: 'systemPrompt', type: 'string', default: '\u0022\u0022', description: 'Chỉ dẫn hệ thống riêng cho tác nhân.' },
    { name: 'targetCollection', type: 'string', required: true, default: 'latticeAssets', description: 'Bảng nghiệp vụ đích gắn với đề xuất hoặc tác vụ phân loại.' },
    { name: 'targetRecordId', type: 'string', default: '0', description: 'ID bản ghi mục tiêu.' },
    { name: 'severity', type: 'string', default: 'medium', description: 'Mức độ mặc định: low, medium, high hoặc critical.' },
    { name: 'recommendation', type: 'string', default: '\u0022\u0022', description: 'Đề xuất mặc định khi không gọi được LLM.' },
    { name: 'prompt', type: 'string', default: '\u0022\u0022', description: 'Mục tiêu phân tích gửi cho tác nhân.' },
    { name: 'evidence', type: 'json', default: 'null', description: 'Dữ liệu bằng chứng đính kèm.' },
    { name: 'aiEmployee', type: 'string', default: 'ops_triage', description: 'Định danh hồ sơ nhân viên AI.' },
    { name: 'toolName', type: 'string', default: 'triage_flow_event', description: 'Tên tác vụ hiển thị trong hàng đợi phê duyệt HITL.' },
    { name: 'model', type: 'string', default: '\u0022\u0022', description: 'Tên model ghi đè (ví dụ ag/gemini-3.8-flash).' },
    { name: 'temperature', type: 'number', default: '0.2', description: 'Nhiệt độ sinh nội dung.' },
    { name: 'maxTokens', type: 'number', default: '1000', description: 'Giới hạn token mỗi lượt gọi LLM.' }
  ]"
/>

## Nhóm `integration` (4 nút)

### 21. `integration.http`

Gọi HTTP tới một connector đã đăng ký trong Connector Vault (`connectorKey`, `outputs: ['main', 'error']`). Động cơ khóa chặt origin theo `connector.baseUrl` (`buildConnectorUrl`), chạy kiểm tra SSRF cả đồng bộ và DNS bất đồng bộ, tự động gắn header xác thực từ Vault, ký `X-Lattice-Signature-256` và Standard Webhooks (`webhook-signature`) nếu `authType === 'hmac'`, chặn chuyển hướng HTTP (`redirect: 'error'`), và che toàn bộ bí mật trong phản hồi trả về `{ connectorKey, authType, method, url, status, ok, response }`.

<ParamGrid
  title="Cấu hình integration.http"
  :items="[
    { name: 'connectorKey', type: 'string', required: true, default: '\u0022\u0022', description: 'Mã kết nối quản lý trong bảng latticeConnectors.' },
    { name: 'method', type: 'string', required: true, default: 'POST', description: 'Phương thức HTTP: GET, POST, PUT, PATCH hoặc DELETE.' },
    { name: 'path', type: 'string', default: '\u0022\u0022', description: 'Đường dẫn tương đối nối vào baseUrl của connector (cấm đổi origin).' },
    { name: 'headers', type: 'json', default: '{}', description: 'Header bổ sung; hệ thống tự động tước Authorization, Host và header chữ ký.' },
    { name: 'body', type: 'json', default: 'null', description: 'Payload JSON cho các phương thức POST, PUT, PATCH.' },
    { name: 'timeoutMs', type: 'number', default: '5000', description: 'Thời gian chờ request trong khoảng 100..60000 ms.' }
  ]"
/>

### 22. `iot.twin_command`

Gửi lệnh cập nhật trạng thái mong muốn (`desiredPatch`) xuống module Digital Twin (`requestDesiredSetpoint`) cho thực thể `assetEntityId` (`outputs: ['main', 'error']`). Nếu độ lệch nhiệt độ hoặc trạng thái vượt ngưỡng HITL của Digital Twin, lệnh được chuyển vào hàng đợi phê duyệt trước khi đẩy downlink xuống Node-RED / Mosquitto.

<ParamGrid
  title="Cấu hình iot.twin_command"
  :items="[
    { name: 'assetId', type: 'string', default: '\u0022\u0022', description: 'ID bản ghi tài sản trong latticeAssets (tùy chọn).' },
    { name: 'assetEntityId', type: 'string', required: true, default: '\u0022\u0022', description: 'Định danh thực thể NGSI-LD / Digital Twin (ví dụ urn:ngsi-ld:ColdRoom:HCM-01).' },
    { name: 'desiredPatch', type: 'json', required: true, default: '{}', description: 'Tập thuộc tính trạng thái mong muốn cần áp dụng.' },
    { name: 'downlinkUrl', type: 'string', default: '\u0022\u0022', description: 'URL downlink ghi đè (chịu kiểm tra chống SSRF tĩnh).' }
  ]"
/>

### 23. `notify.send`

Gửi thông báo theo phạm vi tổ chức tới danh sách vai trò `roleNames` qua `notificationCenter.dispatchRoleNotifications` (`outputs: ['main', 'error']`), trả về `{ roleNames, notifyChannels, templateKey?, dispatched, title }`.

<ParamGrid
  title="Cấu hình notify.send"
  :items="[
    { name: 'roleNames', type: 'json', required: true, default: '[\u0022ldx_operator\u0022]', description: 'Mảng tên vai trò nhận thông báo.' },
    { name: 'title', type: 'string', required: true, default: '\u0022\u0022', description: 'Tiêu đề thông báo sau khi nội suy {{path}}.' },
    { name: 'body', type: 'string', default: '\u0022\u0022', description: 'Nội dung chi tiết của thông báo.' },
    { name: 'severity', type: 'string', default: 'warning', description: 'Mức độ: info, warning, high hoặc critical.' },
    { name: 'category', type: 'string', default: 'system', description: 'Phân loại: system, mention, voucher, sla, alarm hoặc approval.' },
    { name: 'targetCollection', type: 'string', default: '\u0022\u0022', description: 'Tên bảng dữ liệu liên kết.' },
    { name: 'targetRecordId', type: 'string', default: '\u0022\u0022', description: 'ID bản ghi liên kết.' },
    { name: 'targetPath', type: 'string', default: '\u0022\u0022', description: 'Đường dẫn Portal điều hướng khi người dùng bấm vào thông báo.' },
    { name: 'notifyChannels', type: 'json', default: '[\u0022in_app\u0022]', description: 'Danh sách kênh: in_app, email_smtp, telegram, slack, webhook.' },
    { name: 'templateKey', type: 'string', default: '\u0022\u0022', description: 'Mã mẫu thông báo (tối đa 120 ký tự).' },
    { name: 'channelConfig', type: 'json', default: '{}', description: 'Cấu hình bổ sung theo kênh (ví dụ connectorKey).' }
  ]"
/>

### 24. `event.emit`

Phát hành một CloudEvent mới trong phạm vi `organizationId` lên Lattice Event Bus (`outputs: ['main', 'error']`) và trả về `{ published: true, eventType, subject, depth }`. Động cơ tự động tăng `depth` thêm `1` và chặn ngay với mã `RECURSION_DEPTH_LIMIT_EXCEEDED` nếu vượt `MAX_HARD_DEPTH = 8`.

<ParamGrid
  title="Cấu hình event.emit"
  :items="[
    { name: 'eventType', type: 'string', required: true, default: '\u0022\u0022', description: 'Tên loại CloudEvent cần phát hành.' },
    { name: 'subject', type: 'string', default: '\u0022\u0022', description: 'Chủ thể nghiệp vụ gắn với sự kiện.' },
    { name: 'data', type: 'json', default: '{}', description: 'Payload dữ liệu sự kiện sau khi nội suy {{path}} và làm sạch khóa prototype.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'Ví dụ logic.transform + integration.http',
      lang: 'json',
      code: '{\n  \u0022nodes\u0022: [\n    {\n      \u0022id\u0022: \u0022tx_1\u0022,\n      \u0022type\u0022: \u0022logic.transform\u0022,\n      \u0022config\u0022: {\n        \u0022baseFromInput\u0022: false,\n        \u0022operations\u0022: [\n          { \u0022op\u0022: \u0022set\u0022, \u0022target\u0022: \u0022lotCode\u0022, \u0022source\u0022: \u0022data.lotCode\u0022 },\n          { \u0022op\u0022: \u0022math\u0022, \u0022target\u0022: \u0022overThresholdC\u0022, \u0022operator\u0022: \u0022sub\u0022, \u0022left\u0022: \u0022data.mktCelsius\u0022, \u0022right\u0022: \u0022data.thresholdCelsius\u0022, \u0022precision\u0022: 2 },\n          { \u0022op\u0022: \u0022template\u0022, \u0022target\u0022: \u0022summary\u0022, \u0022expr\u0022: \u0022Lot {{result.lotCode}} exceeded by {{result.overThresholdC}}C\u0022 }\n        ]\n      }\n    },\n    {\n      \u0022id\u0022: \u0022http_1\u0022,\n      \u0022type\u0022: \u0022integration.http\u0022,\n      \u0022config\u0022: {\n        \u0022connectorKey\u0022: \u0022n8n-coldchain-orchestrator\u0022,\n        \u0022method\u0022: \u0022POST\u0022,\n        \u0022path\u0022: \u0022/webhook/mkt-alert\u0022,\n        \u0022body\u0022: { \u0022lotCode\u0022: \u0022{{steps.tx_1.lotCode}}\u0022, \u0022summary\u0022: \u0022{{steps.tx_1.summary}}\u0022 },\n        \u0022timeoutMs\u0022: 5000\n      }\n    }\n  ]\n}'
    },
    {
      label: 'Kiểm thử 1 nút qua testNode (curl)',
      lang: 'bash',
      code: 'curl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:testNode\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022auto_mkt_quarantine_response\u0022,\u0022nodeId\u0022:\u0022if_director_tier\u0022,\u0022pinnedInputs\u0022:{\u0022dmn\u0022:{\u0022approvalTier\u0022:\u0022quality_hold_director\u0022}}}\''
    }
  ]"
/>

## Tài liệu liên quan

- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [Biểu thức Template và Điều khiển Luồng](/automation/expressions-and-control-flow)
- [Động cơ Quyết định Visual DMN](/automation/visual-dmn)
- [Công cụ Hợp nhất AI Studio](/ai/unified-tools)
