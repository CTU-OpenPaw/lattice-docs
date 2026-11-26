---
title: Tổng quan LatticeFlow v2
description: Kiến trúc động cơ quy trình DAG LatticeFlow v2, các trạng thái thực thi bền vững, 6 nhóm nút, sổ cái chạy quy trình và API điều khiển dxosAutomations.
---

# Tổng quan LatticeFlow v2

**LatticeFlow v2** là động cơ điều phối quy trình dạng đồ thị có hướng không chu trình (DAG) nằm trong `@latticedx/plugin-dxos-studio` (`src/server/flow/*`), kết hợp trình biên tập kéo-thả trên Control Studio (`@xyflow/react`) với bộ thực thi bền vững trên PostgreSQL 16. Động cơ cho phép kết nối sự kiện CloudEvents, thao tác bản ghi nghiệp vụ, lịch cron, webhook ký số, bảng quyết định DMN, tác nhân AI và thiết bị Digital Twin trong cùng ranh giới cô lập đa tenant `FORCE ROW LEVEL SECURITY`.

<LatticeFlowDagDiagram />

## Kiến trúc thực thi DAG

Mỗi quy trình LatticeFlow v2 được biểu diễn dưới dạng đồ thị có phiên bản (`schemaVersion: 2`), tách biệt rõ giữa bản nháp chỉnh sửa (`draftGraphJson`) và bản phát hành đang chạy (`graphJson`, `publishedVersion`). Trước khi thực thi hoặc lưu nháp, đồ thị đi qua ba lớp kiểm soát định danh và an toàn trong `schema.js`, `validator.js` và `executor.js`.

### Chuẩn hóa và kiểm tra đồ thị tĩnh

Hàm `normalizeGraph` chuẩn hóa cấu trúc đồ thị về `FLOW_SCHEMA_VERSION = 2` và áp dụng các giới hạn vận hành mặc định. Trước khi cho phép lưu hoặc chạy, `validateFlowGraph` thực thi bốn lớp kiểm tra tĩnh:

| Lớp kiểm tra | Cơ chế thực thi | Mã lỗi khi vi phạm |
|---|---|---|
| Thứ tự Topo và chống chu trình | Thuật toán Kahn dựng `topoOrder` và từ chối cạnh tự nối hoặc vòng lặp. | `FLOW_CYCLE_DETECTED` |
| Tương thích cổng kết nối | Kiểm tra `STANDARD_PORTS` và cổng động `case_*` trên `control.switch`; nút `trigger.*` không nhận cạnh vào. | `FLOW_INVALID_PORT` |
| An toàn biểu thức và bảng | Chặn `${...}`, ngoặc lồng và khóa prototype trong <code v-pre>{{path}}</code>; giới hạn bảng dữ liệu cho phép. | `UNSAFE_TEMPLATE_EXPRESSION`, `TARGET_COLLECTION_FORBIDDEN` |
| Chống SSRF tĩnh | Kiểm tra các trường URL trên `integration.http`, `ai.llm`, `iot.twin_command` khỏi loopback và metadata. | `CONNECTOR_URL_UNSAFE` |

<ParamGrid
  title="Giới hạn hệ thống và cấu hình đồ thị (graph.settings)"
  :items="[
    { name: 'version', type: 'integer', required: true, default: '2', description: 'Phiên bản lược đồ DAG (FLOW_SCHEMA_VERSION = 2).' },
    { name: 'MAX_FLOW_NODES', type: 'constant', default: '50', description: 'Số lượng nút tối đa cho phép trong một đồ thị quy trình.' },
    { name: 'MAX_HARD_DEPTH', type: 'constant', default: '8', description: 'Giới hạn độ sâu đệ quy tối đa qua ORM hook, subflow và event.emit.' },
    { name: 'MAX_LOOP_ITERATIONS', type: 'constant', default: '100', description: 'Số phần tử tối đa mỗi lần chạy nút control.loop.' },
    { name: 'settings.errorPolicy', type: 'string', default: 'stop', description: 'Chính sách xử lý lỗi toàn đồ thị: stop hoặc continue.' },
    { name: 'settings.cooldownSec', type: 'number', default: '0', description: 'Thời gian chờ tối thiểu (giây) giữa hai lần kích hoạt liên tiếp cùng ruleKey.' },
    { name: 'settings.maxDepth', type: 'integer', default: '8', description: 'Giới hạn độ sâu riêng của quy trình, bị chặn trần ở MAX_HARD_DEPTH (8).' },
    { name: 'settings.timeoutMs', type: 'integer', default: '30000', description: 'Thời gian chờ mặc định (ms) khi cấu hình quy trình.' }
  ]"
/>

### Vòng đời duyệt đồ thị tại runtime

Khi một kích hoạt hợp lệ đi vào `executeFlowGraph`, động cơ tạo ngữ cảnh thực thi (`execState`), kiểm tra độ sâu đệ quy (`event.depth >= maxDepth`), thời gian cooldown (`cooldownSec`) và bộ lọc đầu vào (`filterJson`). Nếu đạt điều kiện, `traverseDag` duyệt các nút theo bốn quy tắc vận hành:

| Quy tắc runtime | Cơ chế thực thi trong `traverseDag` |
| :--- | :--- |
| Cô lập giao dịch từng nút | Mỗi nút chạy bên trong `runNodeInRlsSavepoint` thuộc ngữ cảnh tổ chức `runAutomationWithRls` (`DX_PG_RLS_SESSION=true`), bảo đảm lỗi ở một nút không làm hỏng phiên làm việc PostgreSQL của toàn luồng. |
| Thực thi song song có kiểm soát | Các nhánh sẵn sàng đồng thời được đưa qua `runRlsAwareBatch`. Khi không nằm trong một giao dịch RLS dùng chung duy nhất, batch chạy song song qua `Promise.all`; khi có giao dịch RLS dùng chung, batch chạy tuần tự để giữ tính nhất quán savepoint. |
| Định tuyến cổng và bỏ qua nhánh | Nút hoàn thành đẩy dữ liệu đầu ra tới các cạnh khớp `nextPort` (hoặc `nextPorts`). Các nút nằm trên nhánh không được chọn bị đánh dấu `skipped` với lý do `BRANCH_NOT_TAKEN`. |
| Cắt ngắn và ẩn danh vết chạy | `sanitizeTraceData` giới hạn kích thước đầu vào/đầu ra trong trace ở mức `16384` byte và che toàn bộ khóa nhạy cảm (`token`, `secret`, `password`, `apiKey`, `Bearer`, `sk-*`) trước khi ghi vào `latticeAutomationRuns`. |

## Sáu nhóm nút và 24 loại nút

Mọi loại nút được đăng ký qua `validateNodeDefinition` trong `registry.js` và công bố schema động qua action `dxosAutomations:nodeRegistry`. Bảng dưới đây tóm tắt 6 nhóm chức năng:

| Nhóm | Số nút | Cổng vào | Cổng ra tiêu chuẩn | Vai trò trong DAG | Tham chiếu |
|---|---|---|---|---|---|
| `trigger` | 5 | `[]` | `main` | Khởi tạo luồng từ CloudEvent, ORM hook, cron, webhook hoặc gọi API thủ công | [Tham chiếu 24 nút](/automation/node-reference#nhom-trigger-5-nut) |
| `control` | 8 | `in` | `main`, `true`/`false`, `case_*`, `item`/`done`, `approved`/`rejected`, `error` | Rẽ nhánh điều kiện, fan-out song song, hợp nhất, lặp có con trỏ, tạm dừng và gọi luồng con | [Tham chiếu 24 nút](/automation/node-reference#nhom-control-8-nut) |
| `data` | 3 | `in` | `main`, `error` | Truy vấn, tạo và cập nhật bản ghi trong danh sách bảng nghiệp vụ cho phép | [Tham chiếu 24 nút](/automation/node-reference#nhom-data-3-nut) |
| `logic` | 2 | `in` | `main`, `error` | Đánh giá bảng quyết định DMN theo tenant và biến đổi dữ liệu khai báo | [Tham chiếu 24 nút](/automation/node-reference#nhom-logic-2-nut) |
| `ai` | 2 | `in` | `main`, `error` | Gọi LLM tương thích OpenAI có ẩn danh PII hoặc chạy tác nhân ReAct với công cụ và HITL | [Tham chiếu 24 nút](/automation/node-reference#nhom-ai-2-nut) |
| `integration` | 4 | `in` | `main`, `error` | Gọi HTTP connector qua Vault, gửi lệnh Digital Twin, thông báo đa kênh và phát sự kiện | [Tham chiếu 24 nút](/automation/node-reference#nhom-integration-4-nut) |

Chi tiết cấu hình và đầu ra của từng nút được trình bày tại trang [Tham chiếu 24 nút LatticeFlow v2](/automation/node-reference).

## Trạng thái thực thi và sổ cái chạy quy trình

Mọi lượt chạy thực tế (`dryRun = false`) đều ghi bản ghi vào bảng `latticeAutomationRuns`, lưu nguyên ảnh chụp đồ thị (`graphSnapshotJson`) và payload kích hoạt (`triggerPayloadJson`) tại thời điểm chạy để bảo đảm khả năng tiếp tục hoặc chạy lại nhất quán kể cả khi quy trình được sửa sau đó.

| Trạng thái (`status`) | Điều kiện hình thành | Khả năng tiếp tục hoặc chạy lại |
|---|---|---|
| `running` | Lượt chạy đang duyệt DAG hoặc chờ nút thực thi hoàn tất. | Chuyển sang trạng thái cuối khi `finalizeDagRun` kết thúc. |
| `completed` | Tất cả nút đã đi qua hoàn tất không có lỗi và không còn trạng thái treo. | Có thể kích hoạt lại từ đầu bằng `replayRun`. |
| `partial` | Có ít nhất một nút hành động thành công và ít nhất một nút thất bại (khi có nhánh `error` hoặc `errorPolicy: 'continue'`). | Có thể kiểm tra `stepTracesJson` và chạy lại qua `replayRun`. |
| `failed` | Nút gặp lỗi khi không có nhánh `error` xử lý hoặc xác thực đồ thị thất bại. | Có thể sửa đồ thị rồi gọi `replayRun` từ payload gốc. |
| `suspended` | Nút `control.delay`, `control.approval` hoặc `ai.agent` (tool ghi dữ liệu) tạm dừng luồng. | Tiếp tục từ điểm dừng qua `resumeRun` hoặc bộ quét lịch `tickFlowScheduler`. |
| `resuming` | Khóa nguyên tử PostgreSQL đã nhận quyền tiếp tục lượt chạy đang `suspended`. | Trạng thái trung gian ngăn hai tiến trình resume trùng lặp. |
| `expired` | Quá hạn `resumeAt` của yêu cầu phê duyệt HITL mà chưa có quyết định. | Kết thúc với `errorMessage: 'APPROVAL_EXPIRED'`. |
| `skipped` | Dừng sớm do chưa phát hành (`RULE_UNPUBLISHED`), không khớp `filterJson`, đang trong `cooldownSec`, hoặc vượt `maxDepth`. | Không tạo thêm hành động; ghi lại nguyên nhân trong `errorMessage`. |

<ParamGrid
  title="Các trường chính của bản ghi sổ cái latticeAutomationRuns"
  :items="[
    { name: 'runUid', type: 'string', required: true, description: 'Định danh duy nhất của lượt chạy (định dạng run_<uuid>).' },
    { name: 'ruleKey', type: 'string', required: true, description: 'Mã quy trình khớp ^[a-z0-9][a-z0-9_-]{1,62}$.' },
    { name: 'status', type: 'string', required: true, description: 'Trạng thái thực thi hiện tại của lượt chạy.' },
    { name: 'depth', type: 'integer', default: '0', description: 'Độ sâu đệ quy tại thời điểm khởi chạy.' },
    { name: 'graphVersion', type: 'integer', default: '2', description: 'Phiên bản động cơ DAG đã thực thi lượt chạy.' },
    { name: 'nodeStatesJson', type: 'jsonb', default: '{}', description: 'Trạng thái từng nút, cổng ra và ngăn xếp loopCursor/loopCursors nếu đang treo.' },
    { name: 'stepTracesJson', type: 'jsonb', default: '[]', description: 'Chuỗi nhật ký thực thi theo thứ tự thời gian kèm input, output, durationMs.' },
    { name: 'suspendedNodeId', type: 'string', description: 'Mã nút đang tạm dừng chờ delay hoặc phê duyệt HITL.' },
    { name: 'approvalId', type: 'integer', description: 'ID bản ghi trong latticeAiApprovalQueue khi treo tại bước phê duyệt.' },
    { name: 'resumeAt', type: 'datetime', description: 'Mốc đánh thức của control.delay hoặc thời hạn hết hiệu lực của phê duyệt.' },
    { name: 'resumeTokenHash', type: 'string', description: 'Băm SHA-256 của token 24 byte dùng xác thực khi gọi resumeRun.' }
  ]"
/>

## Quản lý phiên bản, DSL và kiểm thử

LatticeFlow v2 hỗ trợ quy trình làm việc tách bạch giữa bản nháp và bản chạy thật cùng hai định dạng đặc tả tương đương là JSON và YAML DSL (`serializeFlowDsl`, `parseFlowDsl` trong `schema.js`). Thay đổi thiết kế lưu vào `draftGraphJson` qua `saveDraft` mà không tác động luồng đang chạy, và có thể kiểm thử qua `testRule` (`useDraft: true`, `dryRun: true`, bỏ qua `cooldownSec`). Khi gọi `publishRule`, động cơ tăng `publishedVersion`, cập nhật `graphJson` cùng `triggerIndexJson` và ghi một bản chụp bất biến vào `latticeAutomationRuleVersions`. Để quay về cấu hình cũ, `rollbackRuleVersion` tạo một phiên bản phát hành mới kế thừa đồ thị từ số `version` lịch sử mà không ghi đè nhật ký trước đó.

<CodeTabs
  :tabs="[
    {
      label: 'Quản trị vòng đời quy trình (curl)',
      lang: 'bash',
      code: '# 1. Lưu bản nháp đồ thị v2\ncurl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:saveDraft\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022order_alert_v2\u0022,\u0022name\u0022:\u0022Order Alert\u0022,\u0022draftGraphJson\u0022:{\u0022version\u0022:2,\u0022nodes\u0022:[{\u0022id\u0022:\u0022trig_1\u0022,\u0022type\u0022:\u0022trigger.record\u0022,\u0022config\u0022:{\u0022collection\u0022:\u0022latticeOrders\u0022,\u0022operation\u0022:\u0022create\u0022}}],\u0022edges\u0022:[]}}\'\n\n# 2. Chạy thử bản nháp ở chế độ dryRun\ncurl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:testRule\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022order_alert_v2\u0022,\u0022useDraft\u0022:true,\u0022sampleEvent\u0022:{\u0022data\u0022:{\u0022id\u0022:101,\u0022totalAmount\u0022:12000000}}}\'\n\n# 3. Phát hành phiên bản chạy thật\ncurl -sS -X POST \u0022https://localhost:8443/api/dxosAutomations:publishRule\u0022 \\\n  -H \u0022Authorization: Bearer $LDX_TOKEN\u0022 \\\n  -H \u0022Content-Type: application/json\u0022 \\\n  -d \'{\u0022ruleKey\u0022:\u0022order_alert_v2\u0022,\u0022changeSummary\u0022:\u0022Initial release\u0022}\''
    },
    {
      label: 'Định dạng YAML DSL (schema.js)',
      lang: 'yaml',
      code: 'version: 2\nsettings:\n  errorPolicy: stop\n  cooldownSec: 0\n  maxDepth: 8\n  timeoutMs: 30000\nnodes:\n  - id: trig_1\n    type: trigger.event\n    label: Inbound Event\n    config:\n      eventType: lot.held_mkt\n  - id: notify_1\n    type: notify.send\n    label: Alert Manager\n    config:\n      roleNames:\n        - ldx_manager\n      title: \u0022MKT hold: {{data.lotCode}}\u0022\n      notifyChannels:\n        - in_app\nedges:\n  - id: e_1\n    source: trig_1\n    sourceHandle: main\n    target: notify_1\n    targetHandle: in'
    }
  ]"
/>

## Giao diện API `dxosAutomations`

Tất cả 19 action của tài nguyên `dxosAutomations` áp dụng phân quyền theo tổ chức (`organizationId`) và phạm vi API key `ldx_pat_*`. Truy cập CRUD trực tiếp vào các bảng `latticeAutomationRules`, `latticeAutomationRuleVersions` và `latticeAutomationRuns` bị middleware `createAutomationDirectGuardMiddleware` từ chối để buộc mọi thao tác đi qua lớp xác thực đồ thị và RLS.

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:publishRule"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Xác thực đồ thị, tăng publishedVersion, cập nhật triggerIndexJson và lưu bản chụp vào latticeAutomationRuleVersions."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:runNow"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Thực thi ngay quy trình đã phát hành (hoặc bản nháp khi useDraft=true) với payload sự kiện đầu vào."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAutomations:getRunTrace"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | ai | iot"
  summary="Trả về chi tiết bản ghi latticeAutomationRuns theo runUid hoặc id, gồm nodeStatesJson và stepTracesJson đã ẩn danh bí mật."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:resumeRun"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai | iot"
  summary="Nhận quyền tiếp tục nguyên tử một lượt chạy đang suspended, xác thực resumeToken hoặc vai trò/ủy quyền phê duyệt HITL."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAutomations:webhookIngress"
  auth="Public (HMAC-SHA256 | Bearer | Standard Webhooks)"
  summary="Điểm tiếp nhận webhook công khai cho nút trigger.webhook theo cặp organizationId và ruleKey."
/>

| Action | Phương thức gợi ý | Quyền & Phạm vi PAT | Chức năng |
|---|---|---|---|
| `listRules`, `builderCatalog`, `nodeRegistry` | `GET` | Manager/Admin · `read` | Liệt kê quy trình, danh mục builder và schema 24 nút |
| `saveRule`, `saveDraft`, `publishRule`, `rollbackRuleVersion` | `POST` | Admin · `write`, `ai`, `iot` | Lưu quy trình v1/v2, lưu nháp, phát hành và khôi phục phiên bản |
| `listRuleVersions`, `listRuns`, `getRunTrace` | `GET` | Manager/Admin · `read` | Tra cứu lịch sử phiên bản và nhật ký lượt chạy |
| `toggleRule`, `deleteRule`, `runNow`, `replayRun`, `resumeRun` | `POST` | Manager/Admin · `write`, `ai`, `iot` | Bật/tắt quy trình, xóa, chạy ngay, chạy lại từ trace gốc và tiếp tục luồng treo |
| `testRule`, `testNode` | `POST` | Manager/Admin · `read` (live `testNode` cần `write`) | Giả lập toàn đồ thị hoặc kiểm thử đơn nút với `pinnedInputs` |
| `aiAssist` | `POST` | Manager/Admin · `write`, `ai`, `iot` | Trợ lý thiết kế/vá đồ thị và chẩn đoán trace lỗi (`runFlowArchitect`) |
| `webhookIngress` | `POST` | Public (chữ ký HMAC / Bearer) | Kích hoạt quy trình từ hệ thống bên ngoài |

## Ranh giới bảo mật và vận hành

Các nút `data.*` và `ai.agent` chặn mọi thao tác đọc ghi tới `SYSTEM_PROTECTED_COLLECTIONS` và `FORBIDDEN_SYSTEM_COLLECTIONS` (bao gồm `latticePkiKeys`, `latticeCryptoLedger`, `latticeConnectors`, `latticeApiKeys`, `latticeDelegations`, `latticeAutomationRules`, `latticeAutomationRuns`).

Để chống vòng lặp phản hồi vô hạn, `AsyncLocalStorage` (`ormDepthStore`) truyền `depth` xuyên suốt ORM hooks (`data.create`, `data.update`), `control.subflow` và `event.emit`; khi `depth >= maxDepth` (tối đa `8`), lượt chạy kết thúc ở trạng thái `skipped` với mã `RECURSION_DEPTH_LIMIT_EXCEEDED`.

Ở lớp lập lịch nền (`tickFlowScheduler`), mỗi chu kỳ `DX_FLOW_DELAY_TICK_MS` (mặc định `15000` ms) hệ thống lấy khóa `pg_try_advisory_xact_lock(hashtext('dxos_flow_scheduler_tick'))` để tránh nhiều replica chạy trùng lịch cron, đánh thức `control.delay` và đánh dấu `expired` các phê duyệt quá hạn.

## Tài liệu liên quan

- [Tham chiếu 24 loại nút LatticeFlow v2](/automation/node-reference)
- [Biểu thức Template và Điều khiển Luồng](/automation/expressions-and-control-flow)
- [Động cơ Quyết định Visual DMN](/automation/visual-dmn)
- [Webhook và Lập lịch Cron](/automation/webhooks-and-schedules)
