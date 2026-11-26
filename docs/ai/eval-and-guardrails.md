---
title: Eval Lab & Hàng rào bảo vệ AI
description: Bộ kiểm thử định tuyến và red-team Eval Lab, 9 quy tắc lọc PII Việt Nam, hạn mức token/chi phí theo tổ chức và nhật ký kiểm toán latticeAiAuditLogs.
---

# Eval Lab & Hàng rào bảo vệ AI

Mọi lời gọi công cụ, tác vụ A2A và truy vấn tác tử trong `@latticedx/plugin-dxos-ai` đều đi qua các lớp kiểm soát tại thời điểm thực thi (`ai-governance.js`) trước và sau khi chạm tới mô hình ngôn ngữ hoặc cơ sở dữ liệu. Hệ thống kết hợp bộ lọc che giấu PII/bí mật 9 quy tắc cho ngữ cảnh Việt Nam, kiểm tra hạn mức nguyên tử trên PostgreSQL, ghi nhận kiểm toán vào `latticeAiAuditLogs` và tích hợp sẵn Eval Lab (`ai-eval-lab.js`) để đánh giá định tuyến cũng như phòng thủ prompt injection.

Các bảng kiểm soát (`latticeAiAuditLogs`, `latticeAiQuotaPolicies`, `latticeAiQuotaUsage`, `latticeAiTraces`) đều chịu sự bảo vệ của `FORCE ROW LEVEL SECURITY` theo `organizationId` và chặn sửa đổi trực tiếp từ phía client.

## Eval Lab và truy vết Waterfall

Eval Lab cho phép quản trị viên chạy kiểm thử hồi quy bộ định tuyến ngôn ngữ tự nhiên tiếng Việt hoặc gọi trực tiếp mô hình LLM thực tế, đồng thời hợp nhất span OpenTelemetry GenAI và nhật ký kiểm toán thành biểu đồ waterfall theo `traceId`.

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listEvalSuites"
  auth="Bearer JWT"
  scope="Admin"
  summary="Liệt kê danh sách các bộ kiểm thử có sẵn cùng mẫu case và tổng số lượng kiểm thử."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:runEvalBenchmark"
  auth="Bearer JWT"
  scope="Admin"
  summary="Thực thi bộ kiểm thử ở chế độ deterministic hoặc llm, tính passRate, độ trễ trung bình và p95."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listAgentTraces"
  auth="Bearer JWT"
  scope="Admin"
  summary="Liệt kê các trace AI trong phạm vi tổ chức từ latticeAiTraces, bộ đệm OTel và latticeAiAuditLogs."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:getAgentTraceDetail"
  auth="Bearer JWT"
  scope="Admin"
  summary="Trả về cây waterfall chi tiết các span theo traceId kèm tổng token đầu vào/đầu ra và số PII đã che."
/>

### Các bộ kiểm thử tích hợp (`listEvalSuites`)

| Mã Suite (`suiteId`) | Mô tả phạm vi | Chế độ hỗ trợ |
| :--- | :--- | :--- |
| `vietnamese-nl-agent` | Đánh giá bộ định tuyến câu lệnh tiếng Việt qua RAG, tác vụ, radar, GraphRAG, Workflow, App Builder, BI Chart, bộ nhớ, A2A, phê duyệt, thông báo, public form và từ chối bảo mật. | `deterministic`, `llm` |
| `wave1-3-capabilities` | Tập trung vào các nhóm nghiệp vụ tạo/cập nhật/hoàn tác ứng dụng, BI Chart, ReAct & Memory, giao thức A2A, xuất bản workflow, phê duyệt đa cấp và kênh thông báo. | `deterministic`, `llm` |
| `security-red-team` | Bộ `SECURITY_RED_TEAM_CASES` kiểm thử chặn prompt injection, rò rỉ `.env`/`AGENT_API_KEY`, leo thang đặc quyền `root`, SSRF tới `169.254.169.254`, lộ mật khẩu qua public form và tự phê duyệt bỏ qua `M-of-N`. | `deterministic`, `llm` |
| `custom` | Nhận mảng `customCases` (tối đa `200` case mỗi lần chạy) do quản trị viên truyền trực tiếp qua API hoặc giao diện Eval Lab. | `deterministic`, `llm` |

<ParamGrid
  title="Tham số cho POST /api/dxosAi:runEvalBenchmark"
  :items="[
    { name: 'suiteId', type: 'string', required: false, default: 'vietnamese-nl-agent', description: 'Mã bộ kiểm thử: vietnamese-nl-agent, wave1-3-capabilities, security-red-team hoặc custom.' },
    { name: 'mode', type: 'string', required: false, default: 'deterministic', description: 'Chọn deterministic (router cục bộ parseVietnameseNaturalIntent) hoặc llm (gọi LLM đã cấu hình).' },
    { name: 'modelName', type: 'string', required: false, description: 'Ghi đè tên mô hình khi chạy chế độ llm.' },
    { name: 'limit', type: 'integer', required: false, description: 'Giới hạn số lượng test case thực thi (từ 1 đến 500).' },
    { name: 'customCases', type: 'EvalCase[]', required: false, description: 'Mảng tối đa 200 case tùy chỉnh gồm prompt, isAdmin, portalSlug, expectedTool, expectedIntent, refused, expectedKeywords.' }
  ]"
/>

### Chế độ truy vết Waterfall (`latticeAiTraces`)

Hàm `gatherTenantSpans` hợp nhất dữ liệu từ ba nguồn theo thứ tự ưu tiên: bảng `latticeAiTraces`, bộ đệm của `otel-exporter` (lọc nghiêm ngặt `norm.organizationId === organizationId`), và fallback từ `latticeAiAuditLogs`. Mọi truy cập REST hoặc Chart trực tiếp lên bảng `latticeAiTraces` đều bị từ chối với mã `DXOS_TRACES_DIRECT_CRUD_FORBIDDEN` để bắt buộc đi qua cơ chế làm sạch thuộc tính `sanitizeTraceAttributes` và cô lập tenant.

## Bộ lọc PII Việt Nam và bí mật (9 quy tắc)

Trước khi gửi dữ liệu tới nhà cung cấp LLM (`redactPiiForLlm`), truyền tải qua A2A peer hoặc ghi tóm tắt vào nhật ký kiểm toán (`redactPiiDeep`), hệ thống thực hiện ba tầng che giấu dữ liệu nhạy cảm trong `ai-governance.js`:

1. Tầng khóa đối tượng (`SENSITIVE_KEY_RE`): thay thế toàn bộ giá trị thành `[REDACTED]` đối với 17 mẫu tên khóa gồm `token`, `secret`, `password`, `apikey`, `api_key`, `authorization`, `cookie`, `credential`, `jwt`, `bearer`, `privatekey`, `private_key`, `sessionid`, `session_id`, `passphrase`, `access_key` và `client_secret`.
2. Tầng cặp khóa-giá trị nội tuyến (`SECRET_KV_RE`): che giấu các chuỗi có dạng `api_key=...`, `token: "..."` hoặc `password=...` trong văn bản tự do thành `[REDACTED]`.
3. Tầng 9 biểu thức chính quy trong `redactPiiText`: nhận diện và thay thế dữ liệu định danh cá nhân và bí mật theo chuẩn Việt Nam và quốc tế.

| STT | Loại dữ liệu phát hiện | Mẫu nhận diện chính | Chuỗi thay thế |
| :--- | :--- | :--- | :--- |
| 1 | JSON Web Token | Chuỗi 3 đoạn Base64URL bắt đầu bằng `eyJ...` | `[REDACTED_JWT]` |
| 2 | Bearer Token | Tiền tố `Bearer ` kèm chuỗi token dài từ 8 ký tự | `Bearer [REDACTED]` |
| 3 | API Key tiền tố `sk-` | Chuỗi `sk-` kèm ít nhất 6 ký tự chữ/số/`_`/`-` | `[REDACTED_KEY]` |
| 4 | Địa chỉ Email | Định dạng `<local>@<domain>.<tld>` | `[REDACTED_EMAIL]` |
| 5 | Tài khoản ngân hàng / IBAN | Từ khóa `stk`, `số tài khoản`, `tài khoản ngân hàng`, `iban` kèm số tài khoản | `$1[REDACTED_BANK]` |
| 6 | CCCD / CMND có nhãn | Từ khóa `cccd`, `cmnd`, `căn cước công dân` kèm 9 đến 12 chữ số | `$1[REDACTED_CCCD]` |
| 7 | CCCD 12 số không nhãn | Chuỗi đúng 12 chữ số bắt đầu bằng `0` (`0\d{11}`) | `[REDACTED_CCCD]` |
| 8 | Số điện thoại di động VN | Đầu số `+84` hoặc `0` theo sau bởi đầu `3`, `5`, `7`, `8`, `9` và 8 chữ số | `[REDACTED_PHONE]` |
| 9 | Mã số thuế (MST) | Từ khóa `mst`, `mã số thuế` kèm 10 chữ số (tùy chọn `-` và 3 chữ số chi nhánh) | `$1[REDACTED_MST]` |

## Hạn mức Token, chi phí và kiểm toán

Mỗi yêu cầu gọi công cụ hoặc mô hình AI đều qua hàm `checkAndConsumeAiQuotaPersistent`. Trên PostgreSQL, hàm này mở giao dịch trong ngữ cảnh tenant RLS (`withTenantRlsContext`) và khóa hàng trong `latticeAiQuotaUsage` bằng `SELECT ... FOR UPDATE` để kiểm tra đồng thời 4 ngưỡng ngày (tính theo `utcDayKey`). Nếu vượt bất kỳ ngưỡng nào, hệ thống trả về HTTP `429` kèm mã `AI_QUOTA_EXCEEDED`.

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:quotaSummary"
  auth="Bearer JWT"
  scope="Admin"
  summary="Xem ngưỡng hạn mức đang áp dụng, mức tiêu thụ trong ngày và tổng hợp chi phí toàn thời gian."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:saveQuotaPolicy"
  auth="Bearer JWT"
  scope="Admin"
  summary="Cập nhật hoặc tạo mới chính sách hạn mức ngày cho tổ chức trong latticeAiQuotaPolicies."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:auditLogs"
  auth="Bearer JWT"
  scope="Admin"
  summary="Truy vấn nhật ký kiểm toán AI phân trang, hỗ trợ lọc theo channel, status, toolName, aiEmployee và từ khóa q."
/>

### Ngưỡng mặc định và bảng giá ước tính

<ParamGrid
  title="Biến môi trường và tham số hạn mức AI theo ngày"
  :items="[
    { name: 'DXOS_AI_DAILY_ORG_CALL_LIMIT', type: 'integer', required: false, default: '5000', description: 'Giới hạn số lượt gọi AI mỗi ngày cho toàn tổ chức (orgDailyCalls).' },
    { name: 'DXOS_AI_DAILY_USER_CALL_LIMIT', type: 'integer', required: false, default: '500', description: 'Giới hạn số lượt gọi AI mỗi ngày cho từng tài khoản (userDailyCalls).' },
    { name: 'DXOS_AI_DAILY_ORG_TOKEN_LIMIT', type: 'bigInt', required: false, default: '5000000', description: 'Tổng trần token (prompt + completion) mỗi ngày của tổ chức (orgDailyTokens).' },
    { name: 'DXOS_AI_DAILY_ORG_USD_LIMIT', type: 'double', required: false, default: '50', description: 'Trần chi phí ước tính theo USD mỗi ngày của tổ chức (orgDailyUsd).' },
    { name: 'DXOS_AI_USD_PER_1M_INPUT / OUTPUT', type: 'number', required: false, description: 'Ghi đè đơn giá USD trên mỗi 1 triệu token đầu vào và đầu ra.' }
  ]"
/>

Bảng đơn giá nội bộ `MODEL_PRICING_USD_PER_1M` (USD trên 1 triệu token) dùng để tính `estimatedCostUsd` khi chưa đặt biến ghi đè:

| Nhóm Model | Input ($ / 1M tokens) | Output ($ / 1M tokens) |
| :--- | :---: | :---: |
| `ag/gemini-3.8-flash`, `gemini-2.5-flash`, `gpt-4o-mini` | `0.15` | `0.60` |
| `gemini-2.0-flash` | `0.10` | `0.40` |
| `gemini-2.5-pro` | `1.25` | `10.00` |
| `gpt-4o` | `2.50` | `10.00` |
| `claude-sonnet-4`, `claude-3-5-sonnet`, `claude-sonnet` | `3.00` | `15.00` |
| `ollama` / `local/*` | `0.00` | `0.00` |
| `combo` (mặc định khi không khớp tên model) | `0.35` | `1.05` |

### Cấu trúc bản ghi `latticeAiAuditLogs`

Mọi lượt gọi công cụ từ chat, workflow, MCP Gateway, A2A Gateway hay Eval Lab đều ghi nhận một bản ghi bất biến phục vụ kiểm toán vào bảng `latticeAiAuditLogs`. Các cột cốt lõi bao gồm `actorUserId`, `actorUsername`, `organizationId`, `channel`, `aiEmployee`, `toolName`, `argsSummary` (đã chạy `sanitizeAuditSummary` và lọc PII), `status` (`allowed` | `degraded` | `denied` | `error`), `durationMs`, `promptTokens`, `completionTokens`, `totalTokens`, `tokenSource` (`provider` | `estimated`), `estimatedCostUsd`, `piiRedactedCount`, `errorCode` và `resultSummary`.

<CodeTabs
  :tabs="[
    {
      label: 'Chạy Red-Team Eval',
      lang: 'bash',
      code: 'curl -s -X POST https://lattice.example.com/api/dxosAi:runEvalBenchmark \\\n  -H \x22Authorization: Bearer $ADMIN_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22suiteId\x22: \x22security-red-team\x22,\n    \x22mode\x22: \x22deterministic\x22\n  }\x27'
    },
    {
      label: 'Cập nhật Quota Policy',
      lang: 'bash',
      code: 'curl -s -X POST https://lattice.example.com/api/dxosAi:saveQuotaPolicy \\\n  -H \x22Authorization: Bearer $ADMIN_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22orgDailyCalls\x22: 8000,\n    \x22userDailyCalls\x22: 600,\n    \x22orgDailyTokens\x22: 10000000,\n    \x22orgDailyUsd\x22: 75\n  }\x27'
    },
    {
      label: 'Truy vấn Audit Logs',
      lang: 'bash',
      code: 'curl -s \x22https://lattice.example.com/api/dxosAi:auditLogs?channel=a2a&status=denied&page=1&pageSize=20\x22 \\\n  -H \x22Authorization: Bearer $ADMIN_JWT\x22'
    }
  ]"
/>

## Tài liệu liên quan

- [Tổng quan & Hồ sơ AI](/ai/overview-and-profiles): Khóa quyền hồ sơ và cấu hình kênh LLM.
- [Bộ 20 công cụ hợp nhất](/ai/unified-tools): Vỏ bọc `createAuditedTool` ghi nhận `latticeAiAuditLogs` và kiểm tra quota.
- [Giao thức A2A](/ai/a2a-protocol): Lọc PII trước khi ủy quyền sang peer bên ngoài.
- [Giám sát & Quan sát hệ thống](/operations/observability): Xuất OTLP span và metric Prometheus.
- [Cô lập đa tenant với PostgreSQL RLS](/architecture/multi-tenancy-rls): Cơ chế `FORCE ROW LEVEL SECURITY` trên các bảng AI.
