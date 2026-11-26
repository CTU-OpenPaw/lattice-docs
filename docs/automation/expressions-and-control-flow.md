---
title: Biểu thức Template và Điều khiển Luồng
description: Cú pháp biểu thức đường dẫn an toàn, biến ngữ cảnh thực thi, rẽ nhánh có cấu trúc, vòng lặp bền vững loopCursor, xử lý lỗi và cơ chế tạm dừng/tiếp tục HITL.
---

# Biểu thức Template và Điều khiển Luồng

**LatticeFlow v2** thực hiện ánh xạ dữ liệu, rẽ nhánh, lặp tuần tự và tạm dừng chờ con người mà không dùng `eval()` hay `new Function()`. Mọi biểu thức nội suy đều đi qua bộ phân tích đường dẫn tĩnh trong `nodes/triggers.js` và `validator.js`, còn trạng thái rẽ nhánh, con trỏ vòng lặp lồng nhau và điểm dừng HITL được lưu bền vững vào PostgreSQL để tiếp tục nguyên tử ngay cả khi máy chủ khởi động lại.

## Cú pháp biểu thức <code v-pre>{{path}}</code> và kiểm soát an toàn

Bộ kiểm tra đồ thị (`scanTemplateString` trong `validator.js`) xác thực mọi chuỗi cấu hình trước khi cho phép lưu hoặc thực thi. Một biểu thức hợp lệ chỉ chứa đường dẫn thuộc tính khớp `TEMPLATE_EXPR_RE = /^[a-zA-Z0-9_.\-$]+$/` (hỗ trợ chỉ số mảng số nguyên như `steps.q_1.items.0.code`).

### Quy tắc nội suy tại runtime (`interpolateTemplate`)

Khi chuỗi cấu hình chỉ chứa một cặp ngoặc đơn lẻ (ví dụ <code v-pre>"{{steps.q_1.items}}"</code>), hàm `resolveExpr` giữ nguyên kiểu dữ liệu gốc như mảng, object, số hoặc boolean thay vì ép sang chuỗi; đường dẫn không tồn tại trả về `""`. Khi biểu thức nằm lồng bên trong một chuỗi dài (ví dụ <code v-pre>"Lô {{data.lotCode}} vượt {{data.mktCelsius}}°C"</code>), giá trị `null` hoặc `undefined` trở thành `""`, còn object và mảng được tuần tự hóa qua `JSON.stringify`.

Thứ tự tìm kiếm của `resolveExpr` kiểm tra đường dẫn tuyệt đối trên ngữ cảnh gốc `ctx` trước (`getSafePath(ctx, expr)`), sau đó mới tìm tiếp trong `ctx.data` (`getSafePath(ctx.data, expr)`). Nhờ vậy cả <code v-pre>{{lotCode}}</code> và <code v-pre>{{data.lotCode}}</code> đều phân giải chính xác khi `lotCode` nằm trong `data`.

### Các mẫu biểu thức bị từ chối (`UNSAFE_TEMPLATE_EXPRESSION`)

| Mẫu bị chặn | Lý do từ chối |
|---|---|
| `${data.id}` | Cú pháp nội suy shell/template literal bị cấm hoàn toàn. |
| <code v-pre>{{a.{{b}}}}</code> hoặc <code v-pre>{{</code> / <code v-pre>}}</code> lẻ | Dấu ngoặc lồng nhau hoặc không cân đối gây lỗi phân tích. |
| <code v-pre>{{}}</code> hoặc <code v-pre>{{data.a + 1}}</code> | Biểu thức rỗng hoặc chứa toán tử thực thi thay vì đường dẫn thuần túy. |
| `__proto__`, `constructor`, `prototype` | Bị chặn cả ở tên khóa JSON lẫn từng phân đoạn đường dẫn trong <code v-pre>{{path}}</code>. |

## Biến ngữ cảnh thực thi (Context Root Variables)

Hàm `buildExecState` (`executor.js`) và `buildEvalContext` (`triggers.js`) cung cấp tập biến gốc dùng chung cho mọi biểu thức <code v-pre>{{path}}</code> và điều kiện lọc xuyên suốt lượt chạy:

<ParamGrid
  title="Các biến gốc trong ngữ cảnh thực thi LatticeFlow v2"
  :items="[
    { name: 'event', type: 'object', description: 'CloudEvent chuẩn hóa: id, type, source, subject, time, organizationId, correlationid, causationid, depth, data.' },
    { name: 'data', type: 'object', description: 'Payload dữ liệu sự kiện (tương đương event.data hoặc input.data).' },
    { name: 'input', type: 'any', description: 'Đầu ra trực tiếp từ nút tiền nhiệm vừa đẩy sang nút hiện tại (tương đương branches ở control.merge).' },
    { name: 'record', type: 'object | null', description: 'Bản ghi ORM gốc đối với kích hoạt trigger.record (hoặc null nếu không có).' },
    { name: 'dmn', type: 'object', description: 'Các cột đầu ra của nút logic.dmn gần nhất (ví dụ {{dmn.approvalTier}}, {{dmn.slaMinutes}}).' },
    { name: 'dmnResult', type: 'object | null', description: 'Siêu dữ liệu đánh giá DMN gần nhất gồm { tableKey, matched, hitPolicy, outputs }.' },
    { name: 'steps', type: 'object', description: 'Ánh xạ theo nodeId (steps.<nodeId>) và theo stepIndex (steps.<stepIndex>), gộp phẳng output cùng status và error.' },
    { name: 'nodes', type: 'object', description: 'Bản ghi đầy đủ từng nút đã chạy: nodes.<nodeId> = { output, status, error? }.' },
    { name: 'loop', type: 'object | null', description: 'Ngữ cảnh vòng lặp hiện hành bên trong control.loop: { item, index, count }.' },
    { name: 'actor', type: 'object | null', description: 'Thông tin người dùng hoặc dịch vụ kích hoạt/phê duyệt lượt chạy (id, username, role).' },
    { name: 'organizationId', type: 'string', description: 'Định danh tenant đang bị khóa theo phiên RLS.' },
    { name: 'resumeDecision', type: 'string | null', description: 'Cổng tiếp tục sau khi resumeRun (approved, rejected hoặc main).' },
    { name: 'resumePayload', type: 'object | null', description: 'Payload bổ sung truyền vào qua POST /api/dxosAutomations:resumeRun.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'Tham chiếu biến giữa các bước',
      lang: 'json',
      code: '{\n  \u0022incidentId\u0022: \u0022{{steps.create_incident.id}}\u0022,\n  \u0022lotCode\u0022: \u0022{{data.lotCode}}\u0022,\n  \u0022approvalTier\u0022: \u0022{{dmn.approvalTier}}\u0022,\n  \u0022currentItemSku\u0022: \u0022{{loop.item.sku}}\u0022,\n  \u0022itemPosition\u0022: \u0022{{loop.index}}\u0022,\n  \u0022reviewerNote\u0022: \u0022{{resumePayload.note}}\u0022\n}'
    },
    {
      label: 'Cấu trúc steps và nodes tại runtime',
      lang: 'json',
      code: '{\n  \u0022steps\u0022: {\n    \u0022create_incident\u0022: {\n      \u0022collection\u0022: \u0022latticeIncidentCases\u0022,\n      \u0022id\u0022: 408,\n      \u0022record\u0022: { \u0022id\u0022: 408, \u0022code\u0022: \u0022MKT-evt_1\u0022, \u0022severity\u0022: \u0022critical\u0022 },\n      \u0022output\u0022: { \u0022collection\u0022: \u0022latticeIncidentCases\u0022, \u0022id\u0022: 408 },\n      \u0022status\u0022: \u0022completed\u0022\n    }\n  },\n  \u0022nodes\u0022: {\n    \u0022create_incident\u0022: {\n      \u0022output\u0022: { \u0022collection\u0022: \u0022latticeIncidentCases\u0022, \u0022id\u0022: 408 },\n      \u0022status\u0022: \u0022completed\u0022\n    }\n  }\n}'
    }
  ]"
/>

## Bộ lọc có cấu trúc, rẽ nhánh và hợp nhất

### Cú pháp điều kiện trong `control.if` và `filterJson`

Hàm `matchesFilter` (`nodes/control.js`) hỗ trợ ba hình thức biểu diễn điều kiện và kiểm tra hợp lệ tĩnh qua `validateFilterStructure`:

| Dạng biểu diễn | Ví dụ cú pháp | Phạm vi áp dụng |
|---|---|---|
| Đối tượng tường minh | `{"field": "data.amount", "op": "gt", "value": 50000000}` | Một trường và một toán tử cụ thể |
| Khóa toán tử `$op` | <code v-pre>{"dmn.approvalTier": {"$in": ["quality_hold_director", "vp_ops"]}}</code> | Ràng buộc trực tiếp trên một hoặc nhiều đường dẫn |
| Tổ hợp logic lồng nhau | <code v-pre>{"$and": [{"data.mktCelsius": {"$gte": 8}}, {"$not": {"data.lotStatus": "expired"}}]}</code> | `$and`/`and`/`all`/`rules`, `$or`/`or`/`any`, `$not` |

Toàn bộ toán tử được `matchOperatorObject` chấp nhận gồm: `eq` (`==`, `===`), `ne` (`neq`, `!=`), `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `exists`, và `contains` (hỗ trợ cả chuỗi con lẫn phần tử mảng).

### Rẽ nhánh `control.switch` và hợp nhất `control.merge`

`control.switch` đọc giá trị tại `expression` và duyệt tuần tự mảng `cases`. Trường hợp đầu tiên khớp điều kiện (qua `case.condition` hoặc cặp `operator`/`equals`) sẽ chuyển luồng ra `case.port` (mặc định `case_0`, `case_1`, ...), hoặc sang `default` nếu không có trường hợp nào khớp.

Khi dùng `control.parallel` để chạy nhiều nhánh đồng thời rồi hội tụ tại `control.merge`, chế độ hợp nhất quyết định cách `traverseDag` và `resumeFlowRun` xử lý các nhánh tiền nhiệm:

| Tiêu chí | `wait_all` (mặc định) | `first_completed` |
|---|---|---|
| Điều kiện sẵn sàng | Đợi mọi tiền nhiệm không bị `skipped` hoàn thành và đẩy dữ liệu vào `activeInputs`. | Kích hoạt ngay khi nhánh đầu tiên hoàn thành (`activeInputs.length > 0`). |
| Khi có tiền nhiệm bị `skipped` | Nếu mọi nhánh đều bỏ qua hoặc thiếu nhánh đang hoạt động, `control.merge` bị bỏ qua với lý do `MERGE_WAIT_ALL_INCOMPLETE`. | Không bị chặn bởi nhánh chậm hoặc nhánh bị bỏ qua. |
| Đầu ra `merged` | Gộp các object từ `branches` theo `Object.assign`. | Lấy đầu ra của nhánh hoàn thành đầu tiên. |
| Hành vi khi `resumeRun` | Đợi các nhánh chưa xong hoàn tất sau khi resume rồi mới chạy `control.merge`. | `collectPreSettledNodes` đưa `control.merge` đã `completed` cùng hậu duệ đã xong của nó vào `preSettled` để không kích hoạt lại lần thứ hai khi nhánh chậm kết thúc muộn. |

## Vòng lặp bền vững và ngăn xếp `loopCursor` / `loopCursors`

Nút `control.loop` duyệt tối đa `MAX_LOOP_CAP = 100` phần tử từ mảng `itemsPath` (`strictLimit: true` sẽ báo lỗi `FLOW_LOOP_LIMIT_EXCEEDED` nếu vượt trần, ngược lại cắt ở `maxIterations`). Trong `loop-resume.js`, `executeLoopBody` thu thập đồ thị con nối từ cổng `item` (`collectSubgraph`) và đánh dấu `loopOwned` để `traverseDag` không chạy nhầm thân vòng lặp bên ngoài phạm vi lặp.

Khi một nút bên trong thân vòng lặp phát sinh trạng thái `suspend` (chẳng hạn `control.approval`, `control.delay` hoặc `ai.agent` gọi công cụ cần HITL), động cơ bảo toàn toàn bộ ngữ cảnh qua hai bước:

1. **Đóng gói con trỏ khi tạm dừng (`persistSuspendedLoop`):** Tạo đối tượng cursor cho vòng lặp hiện tại gồm `{ loopNodeId, items, currentIndex, loopResults, loopOutput, iterTraceStart, bodyNodeIds }`. Nếu có vòng lặp lồng nhau, động cơ ghép `[...childStack, cursor, ...rawRest]` thành ngăn xếp từ trong ra ngoài và lưu đồng thời `nodeStatesJson.loopCursor = loopStack[0]` cùng `nodeStatesJson.loopCursors = loopStack`.
2. **Khôi phục tuần tự khi tiếp tục (`resumeLoopStack`):** Khi `resumeRun` được gọi, động cơ duyệt `k = 0 .. rawStack.length - 1`:
   - Khôi phục `execState.loop = { item: items[curIdx], index: curIdx, count: items.length }`.
   - Tính phần đồ thị còn lại của lần lặp bị ngắt (`remTopo`) dựa trên `doneInIter` (các nút đã `completed` kể từ `iterTraceStart`) và chạy nốt phần còn lại của phần tử `curIdx`.
   - Nếu lại gặp điểm tạm dừng mới ở phần tử này hoặc phần tử tiếp theo (`curIdx + 1 .. items.length - 1`), ngăn xếp `loopCursors` được cập nhật lại mà không mất kết quả các phần tử trước trong `loopResults`.
   - Khi xong toàn bộ các tầng lặp, động cơ xóa `nodeStatesJson.loopCursor` và `nodeStatesJson.loopCursors`, ghi `status: 'completed'` cho `control.loop` và đẩy mảng `results` ra cổng `done`.

## Tạm dừng, hẹn giờ và tiếp tục HITL

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:resumeRun"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Nhận quyền tiếp tục nguyên tử một lượt chạy đang suspended, xác thực resumeToken hoặc vai trò/ủy quyền phê duyệt HITL."
/>

### Cơ chế khóa nguyên tử và phân quyền phê duyệt (`durable-store.js`)

Khi `finalizeDagRun` nhận tín hiệu `suspend` (từ `control.delay`, `control.approval` hoặc `ai.agent`), `generateResumeToken` sinh token ngẫu nhiên 24 byte hex và chỉ lưu bản băm SHA-256 (`resumeTokenHash`) vào `latticeAutomationRuns` cùng `status: 'suspended'`, `suspendedNodeId`, `approvalId` và `resumeAt`.

Khi có yêu cầu tiếp tục qua `resumeRun`, `claimSuspendedRun` thực hiện bốn bước kiểm soát:

| Bước | Kiểm soát trong `claimSuspendedRun` | Cơ chế thực thi |
| :---: | :--- | :--- |
| `1` | Khóa trong bộ nhớ và kiểm tra tenant | Chặn hai yêu cầu trùng lặp trên cặp `organizationId:runUid` (`RUN_RESUME_CONFLICT` HTTP `409`), trả `403 NATIVE_ORGANIZATION_MISMATCH` nếu khác tổ chức hoặc `409 RUN_ALREADY_RESUMED` nếu trạng thái không còn `suspended`. |
| `2` | Xác thực token hoặc quyền phê duyệt | Nếu truyền `resumeToken`, hàm kiểm tra `timingSafeEqualHex(sha256Hex(resumeToken), run.resumeTokenHash)`. Đối với nút phê duyệt HITL, `verifyApprovalResumeAuthority` kiểm tra vai trò trực tiếp của người gọi (`root`, `admin`, `ldx_admin` hoặc đúng `approverRole`) và tra cứu ủy quyền còn hiệu lực qua `delegation-engine` (`scope: 'latticeAutomationRuns'`). Nếu tiếp tục qua ủy quyền, sự kiện `flow.approval_resumed` được ghi vào sổ cái kiểm toán PKI. |
| `3` | Chuyển trạng thái nguyên tử trên PostgreSQL | Thực thi `UPDATE "latticeAutomationRuns" SET status = 'resuming', "updatedAt" = NOW() WHERE "organizationId" = :organizationId AND "runUid" = :runUid AND status = 'suspended' RETURNING *` để bảo đảm chỉ một tiến trình duy nhất nhận được quyền chạy tiếp. |
| `4` | Định tuyến cổng sau khi tiếp tục | Trên `control.approval`, giá trị `decision` (`approved` hoặc `rejected`) quyết định nhánh đi tiếp và cập nhật bản ghi tương ứng trong `latticeAiApprovalQueue`. Trên `ai.agent`, `rejected` chuyển sang cổng `error` và `approved` đi ra cổng `main`. Trên `control.delay`, luồng tiếp tục qua cổng `main`. |

### Bộ quét lịch nền `tickFlowScheduler` (`cron.js`)

Chu kỳ mặc định `DX_FLOW_DELAY_TICK_MS = 15000` ms kích hoạt `tickFlowScheduler` dưới khóa `pg_try_advisory_xact_lock(hashtext('dxos_flow_scheduler_tick'))`, thực hiện ba tác vụ:

- `tickScheduledRules`: Đánh giá các quy trình có `trigger.schedule` đang bật và khởi chạy khi đến `nextRunAt`.
- `tickDueDelayedRuns`: Tìm các lượt chạy `suspended` không gắn phê duyệt (`approvalId == null`) có `resumeAt <= now` và gọi `resumeFlowRun` với `actor: { username: 'system:delay-ticker' }`.
- `tickExpiredApprovals`: Đóng các lượt chạy phê duyệt HITL quá hạn `resumeAt` thành `status: 'expired'` (`errorMessage: 'APPROVAL_EXPIRED'`) và cập nhật `latticeAiApprovalQueue`.

<CodeTabs
  :tabs="[
    {
      label: 'Phê duyệt tiếp tục luồng (curl)',
      lang: 'bash',
      code: 'curl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:resumeRun\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_MANAGER_JWT\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\n    \u0022runUid\u0022: \u0022run_7c2e19a0-4f18-4b7f-a8c1-1234567890ab\u0022,\n    \u0022decision\u0022: \u0022approved\u0022,\n    \u0022payload\u0022: {\n      \u0022note\u0022: \u0022Xác nhận mở ngân sách khẩn cấp cho máy nén dự phòng\u0022\n    }\n  }\''
    },
    {
      label: 'Từ chối và định tuyến cổng rejected',
      lang: 'bash',
      code: 'curl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:resumeRun\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_MANAGER_JWT\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\n    \u0022runUid\u0022: \u0022run_7c2e19a0-4f18-4b7f-a8c1-1234567890ab\u0022,\n    \u0022decision\u0022: \u0022rejected\u0022,\n    \u0022payload\u0022: {\n      \u0022reason\u0022: \u0022Chưa đủ báo giá đối chiếu từ hai nhà cung cấp\u0022\n    }\n  }\''
    }
  ]"
/>

## Xử lý lỗi, thời gian chờ và chạy lại (`replayRun`)

LatticeFlow v2 xử lý lỗi nút theo hướng tất định thay vì tự động thử lại ngầm trong một nút:

| Cơ chế | Hành vi tại runtime | Kết quả đầu ra |
|---|---|---|
| Giới hạn thời gian (`timeoutMs`) | `runSingleNode` chạy `Promise.race` theo `node.timeoutMs` hoặc `node.config.timeoutMs`. | Dừng nút với lỗi `FLOW_NODE_TIMEOUT` (`504`). |
| Nhánh `error` và `errorPolicy` | Đẩy `{ error, output }` qua cạnh `error` nếu có; nếu không có cạnh `error`, chỉ chạy tiếp khi `continueOnFail` hoặc `errorPolicy === 'continue'`. | Đánh dấu nút `failed` và dừng hoặc tiếp tục nhánh khác. |
| Tính trạng thái (`computeRunStatus`) | Tổng hợp `stepTracesJson`: không có lỗi trả `completed`, lẫn thành công và lỗi trả `partial`, lỗi toàn phần trả `failed`. | Ghi trạng thái cuối vào `latticeAutomationRuns`. |
| Chạy lại (`replayRun`) | Đọc `triggerPayloadJson` (hoặc `latticeEventBus`), tăng `depth` thêm `1` và chạy lại trên rule hiện tại với `ignoreCooldown: true`. | Tạo bản ghi lượt chạy mới độc lập. *(Backoff hàm mũ áp dụng riêng cho `dxosEventBus`.)* |

## Tài liệu liên quan

- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [Tham chiếu 24 loại nút LatticeFlow v2](/automation/node-reference)
- [Phê duyệt Hợp nhất và Ủy quyền](/domains/approvals-and-delegations)
- [Webhook và Lập lịch Cron](/automation/webhooks-and-schedules)
