---
title: Visual DMN & Bộ máy FEEL
description: Mô hình hóa bảng quyết định DMN, tham chiếu toán tử FEEL không dùng eval, bốn Hit Policy và API đánh giá theo từng tenant trong LatticeDX.
---

# Visual DMN & Bộ máy FEEL

LatticeDX tách các quy tắc nghiệp vụ hay thay đổi ra khỏi đồ thị luồng thực thi thông qua bộ máy **Decision Model and Notation (DMN)** không dùng `eval()` trong `@latticedx/plugin-dxos-studio`. Quản trị viên và chuyên viên phân tích nghiệp vụ định nghĩa bảng quyết định trên giao diện Control Studio hoặc qua API `dxosDmn`, chạy mô phỏng bản nháp trước khi phát hành, và gắn kết quả đánh giá trực tiếp vào nút `logic.dmn` trong LatticeFlow v2.

<DmnDecisionDiagram />

## Mô hình Dữ liệu & Giới hạn Xác thực

Mỗi bảng quyết định được lưu trong collection `latticeDecisionTables` dưới cơ chế cô lập `FORCE ROW LEVEL SECURITY` của PostgreSQL 16 theo `organizationId`. Mọi bản ghi bảng quyết định được lập chỉ mục duy nhất theo cặp `(organizationId, tableKey)` thông qua `uidx_lattice_dmn_org_key`.

<ParamGrid
  title="Cấu trúc Trường Dữ liệu của latticeDecisionTables"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Mã định danh tenant sở hữu bảng quyết định, bắt buộc khớp ngữ cảnh RLS hiện hành.' },
    { name: 'tableKey', type: 'string', required: true, description: 'Khóa định danh duy nhất trong tenant, khớp biểu thức /^[a-zA-Z0-9_-]{2,80}$/.' },
    { name: 'name', type: 'string', required: true, description: 'Tên hiển thị của bảng quyết định (tối đa 160 ký tự).' },
    { name: 'description', type: 'string', description: 'Mô tả phạm vi áp dụng nghiệp vụ (tối đa 500 ký tự).' },
    { name: 'hitPolicy', type: 'string', default: 'FIRST', description: 'Chiến lược tổng hợp luật khớp: FIRST, UNIQUE, COLLECT hoặc PRIORITY.' },
    { name: 'inputsJson', type: 'jsonb', required: true, description: 'Mảng từ 1 đến 50 khai báo biến đầu vào { name, type?, label? }.' },
    { name: 'outputsJson', type: 'jsonb', required: true, description: 'Mảng từ 1 đến 50 khai báo trường đầu ra { name, type?, label? }.' },
    { name: 'rulesJson', type: 'jsonb', required: true, description: 'Danh sách tối đa 500 luật { when, then, priority?, description? }.' },
    { name: 'version', type: 'integer', default: '1', description: 'Số phiên bản tự động tăng mỗi lần gọi dxosDmn:saveTable.' },
    { name: 'published', type: 'boolean', default: 'true', description: 'Trạng thái phát hành của bảng quyết định.' },
    { name: 'active', type: 'boolean', default: 'true', description: 'Chỉ các bảng có active = true mới được đánh giá qua tableKey.' }
  ]"
/>

Các giới hạn bảo vệ sau được kiểm tra nghiêm ngặt trước khi lưu hoặc mô phỏng bảng quyết định:

| Ràng buộc | Giá trị tối đa / Quy tắc | Mã lỗi khi vi phạm |
| :--- | :--- | :--- |
| Định dạng `tableKey` | `^[a-zA-Z0-9_-]{2,80}$` | `400 DMN_TABLE_KEY_INVALID` |
| Định dạng tên trường (`inputsJson`, `outputsJson`, `when`, `then`) | `^[a-zA-Z0-9_.-]{1,64}$` | `400 DMN_SCHEMA_INVALID` / `DMN_RULE_INVALID` |
| Số lượng biến `inputsJson` và `outputsJson` | `1` đến `50` trường mỗi mảng | `400 DMN_SCHEMA_INVALID` |
| Số lượng luật trong `rulesJson` | Tối đa `500` luật mỗi bảng | `400 DMN_RULE_INVALID` |
| Khóa prototype bị cấm (`FORBIDDEN_KEYS`) | `__proto__`, `constructor`, `prototype` | `400 DMN_SCHEMA_INVALID` / `DMN_RULE_INVALID` |
| Độ dài chuỗi `description` của từng luật | Cắt gọn tại `255` ký tự | Chuẩn hóa tự động |

Trong quá trình đối chiếu đầu vào, bộ máy đọc giá trị thuộc tính bằng `Object.hasOwn(ctxObj, inputKey)` để loại trừ hoàn toàn nguy cơ đọc nhầm thuộc tính từ prototype chain.

## Bốn Hit Policy (`HIT_POLICIES`)

Trình đánh giá `evaluateDecisionTable` trong `dmn-engine.js` hỗ trợ bốn chính sách xử lý khi nhiều luật cùng thỏa mãn một tập dữ liệu đầu vào:

| Hit Policy | Cơ chế thực thi | Cấu trúc kết quả trả về | Hành vi biên và xung đột |
| :--- | :--- | :--- | :--- |
| `FIRST` | Duyệt tuần tự từ trên xuống và dừng ngay tại luật khớp đầu tiên | `result` và `outputs` là object đầu ra đơn, kèm `matchedRuleIndex` | Trả về `matched: false`, `matchedRuleIndex: -1`, `result: null` nếu không có luật nào khớp |
| `UNIQUE` | Đánh giá toàn bộ `rulesJson` để đảm bảo tính loại trừ lẫn nhau | `result`, `outputs`, `results: [only.outputs]` và `matchedRuleIndex` | Ném lỗi HTTP `409 DMN_UNIQUE_POLICY_VIOLATION` nếu có từ `2` luật khớp trở lên |
| `COLLECT` | Đánh giá toàn bộ bảng và gom kết quả của mọi luật khớp theo thứ tự khai báo | `results: [...]` (mảng các object `then`) và `matchedRules` | Trả về `matched: false`, `results: []` nếu không có luật khớp |
| `PRIORITY` | Đánh giá toàn bộ bảng rồi sắp xếp giảm dần theo `priority` (hoặc `rank`) | `result` của luật ưu tiên cao nhất, `results: [top.outputs]` và `matchedRules` đã sắp xếp | Nếu hai luật bằng `priority`, luật có `ruleIndex` nhỏ hơn đứng trước; mặc định `priority = 0` |

## Tham chiếu Đầy đủ Biểu thức FEEL

Bộ máy DMN biên dịch mọi điều kiện trong `when` thành cấu trúc chuẩn hóa `{ op, value }` qua hàm `normalizeConditionSpec` và `parseStringConditionSpec`. Hệ thống không sử dụng `eval()` hay `new Function()`. Người thiết kế có thể viết điều kiện theo cú pháp chuỗi FEEL rút gọn hoặc JSON có cấu trúc.

| Toán tử chuẩn | Bí danh chấp nhận | Cú pháp chuỗi FEEL | Cú pháp JSON | Ngữ nghĩa đánh giá |
| :--- | :--- | :--- | :--- | :--- |
| `eq` | `==`, `===`, `=` | `"critical"`, `"= 100"`, `"== true"` | `{ "op": "eq", "value": "critical" }` | So sánh bằng vô hướng; chuẩn hóa số hữu hạn trước khi so sánh qua `parseFinite` |
| `neq` | `!=`, `!==` | `"!= closed"`, `"!== 0"` | `{ "op": "neq", "value": "closed" }` | Phủ định của so sánh bằng vô hướng `valuesEqual` |
| `gt` | `>` | `"> 8"` | `{ "op": "gt", "value": 8 }` | Lớn hơn chặt giá trị số hữu hạn (yêu cầu cả hai vế là số hữu hạn) |
| `gte` | `>=` | `">= 75"` | `{ "op": "gte", "value": 75 }` | Lớn hơn hoặc bằng giá trị số hữu hạn |
| `lt` | `<` | `"< 2"` | `{ "op": "lt", "value": 2 }` | Nhỏ hơn chặt giá trị số hữu hạn |
| `lte` | `<=` | `"<= -12"` | `{ "op": "lte", "value": -12 }` | Nhỏ hơn hoặc bằng giá trị số hữu hạn |
| `between` | — | `"[2..8]"` | `{ "op": "between", "value": [2, 8] }` | Kiểm tra số thực nằm trong đoạn đóng `min <= actual <= max` |
| `in` | — | `"in [high, critical]"` | `{ "op": "in", "value": ["high", "critical"] }` | Khớp nếu giá trị thực tế bằng ít nhất một phần tử trong mảng |
| `not_in` | `not in` | `"not in [draft, cancelled]"` | `{ "op": "not_in", "value": ["draft", "cancelled"] }` | Khớp nếu giá trị thực tế không bằng bất kỳ phần tử nào trong mảng |
| `contains` | — | `"contains COLD-"` | `{ "op": "contains", "value": "COLD-" }` | Kiểm tra chuỗi con không phân biệt hoa thường trên `String(actual)` |
| `any` | `*`, `-` | `"*"`, `"-"`, `"any"`, `""` | `{ "op": "any", "value": null }` hoặc `null` | Ký tự đại diện, luôn trả về `true` |

Khi phân tích cú pháp chuỗi FEEL, `parseScalarValue` tự động chuyển `"true"` / `"false"` sang boolean, `"null"` sang `null`, chuỗi khớp `/^-?\d+(?:\.\d+)?$/` sang kiểu số, và giữ nguyên chuỗi thuần hoặc bỏ cặp dấu nháy bọc ngoài (`'...'` hoặc `"..."`). Với toán tử `between` dạng chuỗi `[a..b]`, bộ máy tự động chuẩn hóa cận dưới bằng `Math.min(a, b)` và cận trên bằng `Math.max(a, b)`.

## Bảng Quyết định Mẫu & Tích hợp LatticeFlow v2

Kho `lattice-templates/dmn-tables/` cung cấp ba bảng quyết định chuẩn sản xuất (`cold_chain_approval_v1`, `cmms_priority_routing_v1`, `coldchain_settlement_policy_v1`) cùng bộ kiểm thử `sample-evaluations.json` gồm 12 kịch bản xác định.

<CodeTabs
  :tabs="[
    { label: 'DMN Table JSON', lang: 'json', code: '{\n  \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n  \x22name\x22: \x22Ma trận Phê duyệt Chuỗi lạnh & Vượt ngưỡng MKT\x22,\n  \x22hitPolicy\x22: \x22FIRST\x22,\n  \x22inputsJson\x22: [\n    { \x22name\x22: \x22totalAmountM\x22, \x22type\x22: \x22number\x22 },\n    { \x22name\x22: \x22maxTempC\x22, \x22type\x22: \x22number\x22 }\n  ],\n  \x22outputsJson\x22: [\n    { \x22name\x22: \x22approvalTier\x22, \x22type\x22: \x22string\x22 },\n    { \x22name\x22: \x22slaMinutes\x22, \x22type\x22: \x22number\x22 }\n  ],\n  \x22rulesJson\x22: [\n    {\n      \x22when\x22: { \x22maxTempC\x22: { \x22op\x22: \x22gt\x22, \x22value\x22: 8 } },\n      \x22then\x22: { \x22approvalTier\x22: \x22quality_hold_director\x22, \x22slaMinutes\x22: 15 }\n    },\n    {\n      \x22when\x22: { \x22totalAmountM\x22: \x22> 500\x22 },\n      \x22then\x22: { \x22approvalTier\x22: \x22director_approval\x22, \x22slaMinutes\x22: 45 }\n    },\n    {\n      \x22when\x22: { \x22totalAmountM\x22: \x22*\x22, \x22maxTempC\x22: \x22*\x22 },\n      \x22then\x22: { \x22approvalTier\x22: \x22manager_approval\x22, \x22slaMinutes\x22: 120 }\n    }\n  ]\n}' },
    { label: 'Node logic.dmn', lang: 'json', code: '{\n  \x22id\x22: \x22dmn_gate\x22,\n  \x22type\x22: \x22logic.dmn\x22,\n  \x22config\x22: {\n    \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n    \x22facts\x22: {\n      \x22totalAmountM\x22: \x22{{data.totalAmountM}}\x22,\n      \x22maxTempC\x22: \x22{{data.maxTempC}}\x22\n    }\n  }\n}' }
  ]"
/>

Khi nút `logic.dmn` chạy trong LatticeFlow v2, bộ máy thực thi hợp nhất `{ ...evalCtx.data, ...input, ...facts, organizationId }` rồi gọi `evaluateDecisionTable`. Đầu ra được ghi vào hai biến ngữ cảnh luồng để các nút phía sau (`control.if`, `control.approval`, `notify.send`) tham chiếu qua biểu thức <code v-pre>{{dmn.approvalTier}}</code> hoặc <code v-pre>{{dmnResult.outputs}}</code>:

- Với `FIRST`, `UNIQUE`, `PRIORITY`: `context.dmn` chứa trực tiếp object `outputs` (ví dụ <code v-pre>{{dmn.approvalTier}}</code>), còn `context.dmnResult` chứa `{ tableKey, matched, hitPolicy, outputs }`.
- Với `COLLECT`: `context.dmn` chứa `{ results: [...] }` gồm danh sách tất cả đầu ra của các luật khớp theo đúng thứ tự trong `rulesJson`.
- Khi cần đọc toàn bộ danh sách luật khớp kèm `ruleIndex` và `priority`, tham chiếu đầu ra trực tiếp của bước chạy qua <code v-pre>{{steps.dmn_gate.matchedRules}}</code>.

## API Quản lý & Đánh giá (`dxosDmn`)

Tài nguyên `dxosDmn` cung cấp ba action HTTP được bảo vệ bởi `FORCE ROW LEVEL SECURITY` theo tenant và phạm vi Personal Access Token (`read`, `write`, `dmn`).

<ApiEndpoint
  method="GET"
  path="/api/dxosDmn:listTables"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | dmn"
  summary="Liệt kê các bảng quyết định DMN thuộc phạm vi tenant hiện tại; hỗ trợ lọc theo tableKey, activeOnly và limit (1..200)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosDmn:saveTable"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | dmn"
  summary="Xác thực schema/luật, tăng tự động trường version, lưu bảng vào latticeDecisionTables và ghi sự kiện dmn.table_saved vào sổ cái Ed25519 latticeCryptoLedger."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosDmn:evaluate"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | dmn"
  summary="Đánh giá bảng đã lưu qua tableKey hoặc mô phỏng trực tiếp bảng nháp qua tham số table (trả về simulated: true mà không ghi cơ sở dữ liệu)."
/>

Chế độ mô phỏng bản nháp (`params.table`) yêu cầu quyền `view` hoặc `update` trên `latticeDecisionTables` (hoặc vai trò quản trị tổ chức) và trả về kết quả đánh giá ngay trên bộ luật chưa phát hành.

<CodeTabs
  :tabs="[
    { label: 'cURL (Đánh giá bảng đã lưu)', lang: 'bash', code: 'curl -sS -X POST \x22https://app.latticedx.example.com/api/dxosDmn:evaluate\x22 \\\n  -H \x22Authorization: Bearer ldx_pat_your_token\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n    \x22context\x22: { \x22totalAmountM\x22: 320, \x22maxTempC\x22: 11.4 }\n  }\x27' },
    { label: 'cURL (Mô phỏng bản nháp)', lang: 'bash', code: 'curl -sS -X POST \x22https://app.latticedx.example.com/api/dxosDmn:evaluate\x22 \\\n  -H \x22Authorization: Bearer ldx_pat_your_token\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22table\x22: {\n      \x22tableKey\x22: \x22draft_sla_priority\x22,\n      \x22hitPolicy\x22: \x22PRIORITY\x22,\n      \x22rulesJson\x22: [\n        { \x22priority\x22: 10, \x22when\x22: { \x22severity\x22: \x22high\x22 }, \x22then\x22: { \x22tier\x22: \x22p2\x22 } },\n        { \x22priority\x22: 90, \x22when\x22: { \x22severity\x22: \x22in [high, critical]\x22 }, \x22then\x22: { \x22tier\x22: \x22p1\x22 } }\n      ]\n    },\n    \x22context\x22: { \x22severity\x22: \x22high\x22 }\n  }\x27' },
    { label: 'JSON Response', lang: 'json', code: '{\n  \x22tableKey\x22: \x22cold_chain_approval_v1\x22,\n  \x22version\x22: 1,\n  \x22hitPolicy\x22: \x22FIRST\x22,\n  \x22matched\x22: true,\n  \x22matchedRuleIndex\x22: 0,\n  \x22result\x22: {\n    \x22approvalTier\x22: \x22quality_hold_director\x22,\n    \x22slaMinutes\x22: 15\n  },\n  \x22outputs\x22: {\n    \x22approvalTier\x22: \x22quality_hold_director\x22,\n    \x22slaMinutes\x22: 15\n  },\n  \x22matchedRules\x22: [\n    {\n      \x22ruleIndex\x22: 0,\n      \x22priority\x22: 0,\n      \x22outputs\x22: {\n        \x22approvalTier\x22: \x22quality_hold_director\x22,\n        \x22slaMinutes\x22: 15\n      }\n    }\n  ]\n}' }
  ]"
/>

## Biên Bảo mật & Mã lỗi Thường gặp

Mỗi lần gọi `dxosDmn:saveTable` yêu cầu vai trò quản trị tổ chức (`isOrgAdmin`) hoặc quyền `create`/`update` trên `latticeDecisionTables`, đồng thời ghi dấu vết bất biến `dmn.table_saved` với phạm vi `dxos:dmn` vào `latticeCryptoLedger` (bao gồm `tableKey`, `hitPolicy`, `version` và `ruleCount`).

| Mã lỗi | HTTP | Nguyên nhân phát sinh |
| :--- | :--- | :--- |
| `DMN_OPERATOR_INVALID` | `400` | Toán tử không thuộc tập `ALLOWED_OPERATORS` |
| `DMN_RULE_INVALID` | `400` | Toán tử số học nhận giá trị không hữu hạn, `between` sai mảng `[min, max]` hoặc vượt `500` luật |
| `DMN_CONTEXT_INVALID` | `400` | Tham số `context` truyền vào dạng chuỗi nhưng không phải JSON hợp lệ |
| `DXOS_ACL_DENIED` | `403` | Tài khoản không có quyền quản trị hoặc quyền collection `latticeDecisionTables` |
| `DMN_TABLE_NOT_FOUND` | `404` | Không tìm thấy `tableKey` đang hoạt động (`active: true`) trong tenant hiện tại |
| `DMN_UNIQUE_POLICY_VIOLATION` | `409` | Bảng dùng `hitPolicy: "UNIQUE"` nhưng có từ 2 luật cùng khớp |

## Tài liệu liên quan

- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [Tham chiếu 24 Loại Nút](/automation/node-reference)
- [Biểu thức & Điều khiển Luồng](/automation/expressions-and-control-flow)
- [Ủy quyền & Phê duyệt Hợp nhất](/domains/approvals-and-delegations)
