---
title: Giao thức A2A (Agent-to-Agent)
description: Đặc tả Agent Card discovery, vòng đời tác vụ JSON-RPC 2.0 trên /api/dxos-a2a và ranh giới bảo mật khi ủy quyền tác vụ liên agent trong LatticeDX.
---

<script setup>
const a2aTabs = [
  {
    label: 'Agent Card & tasks/send',
    lang: 'bash',
    code: `# 1. Khám phá Agent Card
curl -s https://lattice.example.com/.well-known/agent-card.json | jq '.skills[].id'

# 2. Gửi tác vụ có idempotencyKey tới agent dxos-ops
curl -s -X POST https://lattice.example.com/api/dxos-a2a \\
  -H "Authorization: Bearer $LATTICE_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "req-101",
    "method": "tasks/send",
    "params": {
      "id": "task-coldchain-401",
      "targetAgentId": "dxos-ops",
      "idempotencyKey": "idem-coldchain-401",
      "message": {
        "role": "user",
        "parts": [
          { "type": "text", "text": "Kiểm tra ngưỡng nhiệt kho CT-02 và tóm tắt cảnh báo đang mở." },
          { "type": "data", "data": { "warehouseCode": "HUB-CT", "severity": "high" } }
        ]
      },
      "metadata": { "portalSlug": "incidents" }
    }
  }'`,
  },
  {
    label: 'tasks/get & tasks/cancel',
    lang: 'json',
    code: `// Truy vấn lịch sử giới hạn 2 thông điệp cuối
{
  "jsonrpc": "2.0",
  "id": "req-102",
  "method": "tasks/get",
  "params": {
    "id": "task-coldchain-401",
    "historyLength": 2
  }
}

// Hủy tác vụ đang ở trạng thái working hoặc submitted
{
  "jsonrpc": "2.0",
  "id": "req-103",
  "method": "tasks/cancel",
  "params": {
    "id": "task-coldchain-401",
    "reason": "Đã xử lý thủ công tại trạm điều phối"
  }
}`,
  },
  {
    label: 'Ủy quyền Peer (TypeScript)',
    lang: 'ts',
    code: `const response = await fetch("https://lattice.example.com/api/dxos-a2a", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "req-peer-01",
    method: "tasks/send",
    params: {
      targetAgentId: "partner-carrier-agent",
      peerUrl: "https://a2a.partner-logistics.example/rpc",
      message: {
        role: "user",
        parts: [{ type: "text", text: "Xác nhận lịch nhận lô lạnh LOT-2026-09." }],
      },
      metadata: { shipmentCode: "SHP-8841" },
    },
  }),
});
const rpcResult = await response.json();`,
  },
];
</script>

# Giao thức A2A (Agent-to-Agent)

Giao thức Agent-to-Agent (A2A) trong `@latticedx/plugin-dxos-ai` chuẩn hóa cách hệ thống bên ngoài khám phá năng lực của các hồ sơ AI trên LatticeDX và trao đổi tác vụ có trạng thái qua JSON-RPC 2.0. Gateway A2A chạy trực tiếp dưới dạng middleware HTTP bên trong NocoBase (`a2a-gateway.js`), gắn kết chặt chẽ việc định tuyến agent với cô lập đa tenant `FORCE ROW LEVEL SECURITY`, kiểm soát vai trò RBAC và ghi nhận kiểm toán trên `latticeAiAuditLogs`.

Khác với [MCP Gateway](/ai/mcp-gateway) vốn cung cấp ngữ cảnh và công cụ rời rạc cho một client gọi trực tiếp, A2A định nghĩa ranh giới ủy quyền tác vụ giữa các agent độc lập. Mọi yêu cầu `tasks/send`, `tasks/get` và `tasks/cancel` đều được lưu bền vững vào bảng `latticeA2aTasks` theo mã `organizationId` của người gọi và chặn mọi truy vấn CRUD trực tiếp lên bảng này.

## Khám phá Agent Card

Gateway công bố tài liệu Agent Card tại hai đường dẫn chuẩn để client và điều phối viên bên ngoài đọc siêu dữ liệu trước khi khởi tạo phiên làm việc. Cả hai điểm cuối chỉ chấp nhận phương thức `GET` hoặc `HEAD`, trả về header `Cache-Control: no-store` và `X-Content-Type-Options: nosniff`, đồng thời bỏ qua lớp bọc `{ data }` tiêu chuẩn của NocoBase (`withoutDataWrapping = true`).

<ApiEndpoint
  method="GET"
  path="/.well-known/agent-card.json"
  auth="Public Discovery"
  summary="Trả về Agent Card chuẩn A2A mô tả URL RPC, cơ chế xác thực Bearer và danh mục 7 kỹ năng agent."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos-a2a/agent-card.json"
  auth="Public Discovery"
  summary="Đường dẫn thay thế dưới tiền tố /api cho môi trường reverse proxy chỉ chuyển tiếp lưu lượng API."
/>

Hàm `resolveSafeCardEndpointUrl` trong `a2a-gateway.js` xác định trường `url` trỏ tới `/api/dxos-a2a` theo thứ tự ưu tiên từ cấu hình môi trường `DXOS_A2A_PUBLIC_URL`, `DXOS_PUBLIC_URL`, `NOCOBASE_PUBLIC_URL`, sau đó mới đọc cặp header `X-Forwarded-Proto` và `X-Forwarded-Host` đã kiểm tra định dạng hợp lệ. Nếu chạy sau Nginx public routes (`10-lattice-public-routes.sh`) hoặc Caddy, đường dẫn `/.well-known/agent-card.json` được proxy trực tiếp về upstream nội bộ mà không lưu cache.

<ParamGrid
  title="Cấu trúc trường của Agent Card"
  :items="[
    { name: 'name', type: 'string', required: true, default: 'LatticeDX Enterprise A2A Gateway', description: 'Tên định danh của cổng giao tiếp A2A trên cụm triển khai.' },
    { name: 'url', type: 'string', required: true, description: 'Điểm cuối JSON-RPC 2.0 đầy đủ kết thúc bằng /api/dxos-a2a.' },
    { name: 'version', type: 'string', required: true, default: '0.4.2', description: 'Phiên bản gói plugin @latticedx/plugin-dxos-ai đang vận hành.' },
    { name: 'capabilities.streaming', type: 'boolean', required: true, default: 'false', description: 'Trạng thái hỗ trợ SSE streaming trên kênh A2A.' },
    { name: 'capabilities.pushNotifications', type: 'boolean', required: true, default: 'false', description: 'Trạng thái hỗ trợ webhook đẩy thông báo bất đồng bộ.' },
    { name: 'capabilities.stateTransitionHistory', type: 'boolean', required: true, default: 'true', description: 'Lưu lịch sử tin nhắn và chuyển đổi trạng thái trong latticeA2aTasks.' },
    { name: 'authentication.schemes', type: 'string[]', required: true, default: '[\'bearer\']', description: 'Yêu cầu Bearer JWT hoặc token hợp lệ cho mọi lời gọi JSON-RPC.' },
    { name: 'skills', type: 'AgentSkill[]', required: true, description: 'Danh sách 7 kỹ năng ánh xạ từ A2A_AGENT_CATALOG cùng tags, inputModes và outputModes.' }
  ]"
/>

### Danh mục kỹ năng công bố trên Agent Card

Mỗi phần tử trong mảng `skills` tương ứng với một hồ sơ AI chuẩn của nền tảng (chi tiết quyền công cụ xem tại [Tổng quan & Hồ sơ AI](/ai/overview-and-profiles)). Khi thực thi tác vụ nội bộ, gateway đối chiếu tiếp bảng `latticeAiProfiles` theo `organizationId` để áp dụng `systemPrompt`, `modelName` và khóa vai trò thực tế.

| Skill ID | Tên hiển thị | Nhóm thẻ (`tags`) | Vai trò được phép gọi mặc định |
| :--- | :--- | :--- | :--- |
| `dxos-coordinator` | DX-OS Multi-Agent Coordinator | `coordination`, `orchestration`, `radar`, `routing` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` |
| `dxos-architect` | DX-OS System & App Architect | `architecture`, `app-builder`, `schema`, `portal`, `workflow` | `root`, `admin` (khóa cứng `isAdminBuilder`) |
| `dxos-ops` | DX-OS Cold-Chain & IoT Ops | `cold-chain`, `iot`, `orion-ld`, `incidents` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse` |
| `dxos-logistics` | DX-OS Cold-Chain Logistics Dispatcher | `logistics`, `fefo`, `dispatch`, `epod` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` |
| `dxos-workspace` | DX-OS Services, Procurement & P.A.R.A. Assistant | `services`, `procurement`, `para`, `knowledge` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` |
| `dxos-operator` | DX-OS Operations Executor | `operations`, `it-ot`, `triage`, `execution` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_operator`, `ldx_dispatcher`, `ldx_warehouse` |
| `dxos-analyst` | DX-OS Enterprise Analyst | `analytics`, `bi`, `impact-graph`, `diagnostics` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` |

## Điểm cuối JSON-RPC 2.0 và vòng đời tác vụ

Mọi thao tác gửi, truy vấn hoặc hủy tác vụ A2A đều đi qua một điểm cuối `POST /api/dxos-a2a` duy nhất tuân theo đặc tả JSON-RPC 2.0. Gateway từ chối các phương thức HTTP khác `POST` bằng mã `405` và từ chối yêu cầu thiếu token xác thực bằng mã `401` kèm header `WWW-Authenticate: Bearer realm="LatticeDX-A2A", error="invalid_token"`.

<ApiEndpoint
  method="POST"
  path="/api/dxos-a2a"
  auth="Bearer JWT"
  scope="tasks/send | tasks/get | tasks/cancel"
  summary="Điểm cuối JSON-RPC 2.0 điều phối vòng đời tác vụ A2A nội bộ và ủy quyền tới peer bên ngoài."
/>

### Máy trạng thái tác vụ (`A2A_VALID_STATUSES`)

Bảng `latticeA2aTasks` lưu trữ toàn bộ trạng thái, mảng hội thoại `messagesJson`, danh sách tạo phẩm `artifactsJson`, siêu dữ liệu `metadataJson` và đối tượng lỗi `errorJson`. Sáu trạng thái hợp lệ được chuẩn hóa trong `A2A_VALID_STATUSES`:

| Trạng thái | Nhóm | Ý nghĩa vận hành |
| :--- | :--- | :--- |
| `submitted` | Đang mở | Tác vụ vừa được khởi tạo và ghi nhận vào `latticeA2aTasks` trước khi điều phối thực thi. |
| `working` | Đang mở | Tác vụ đang xử lý ở chế độ bất đồng bộ (`async: true` hoặc `blocking: false`) hoặc chờ kết quả từ agent. |
| `input-required` | Đang mở | Agent hoặc peer bên ngoài yêu cầu bổ sung thông tin hoặc phê duyệt đầu vào trước khi hoàn tất. |
| `completed` | Kết thúc | Agent hoàn tất xử lý và trả về thông điệp phản hồi cùng `artifacts`. Không thể hủy qua `tasks/cancel`. |
| `failed` | Kết thúc | Thực thi gặp lỗi nội bộ, lỗi HTTP/JSON-RPC từ peer hoặc hết thời gian chờ (`PEER_TIMEOUT`). |
| `canceled` | Kết thúc | Người tạo tác vụ hoặc quản trị viên đã thu hồi tác vụ trước khi đạt trạng thái kết thúc. |

Khi một tác vụ đã chuyển sang một trong ba trạng thái kết thúc thuộc `A2A_TERMINAL_STATES` (`completed`, `failed`, `canceled`), mọi lệnh `tasks/cancel` tiếp theo đều nhận phản hồi HTTP `409` với mã lỗi JSON-RPC `-32004`.

### Tham số các phương thức JSON-RPC 2.0

<ParamGrid
  title="Tham số của params trong tasks/send, tasks/get và tasks/cancel"
  :items="[
    { name: 'id / taskId', type: 'string', required: false, default: 'a2a_<uuid>', description: 'Định danh tác vụ theo regex ^[a-zA-Z0-9._:-]{1,128}$. Bắt buộc với tasks/get và tasks/cancel.' },
    { name: 'targetAgentId', type: 'string', required: false, default: 'dxos-coordinator', description: 'ID agent mục tiêu (hoặc external-peer nếu có peerUrl). Alias: agentId, metadata.targetAgentId.' },
    { name: 'sourceAgentId', type: 'string', required: false, default: 'user:<username>', description: 'Định danh agent hoặc người gọi khởi tạo tác vụ.' },
    { name: 'message', type: 'object', required: true, description: 'Đối tượng { role, parts } chứa phần tử type=text (tối đa 16000 ký tự) hoặc type=data. Có thể thay bằng prompt, text hoặc input.' },
    { name: 'peerUrl', type: 'string', required: false, description: 'URL HTTPS của A2A peer bên ngoài để gateway ủy quyền từ xa sau khi kiểm tra SSRF.' },
    { name: 'idempotencyKey', type: 'string', required: false, description: 'Khóa chống trùng lặp (tối đa 255 ký tự) theo tổ chức; trả lại bản ghi cũ nếu đã tồn tại.' },
    { name: 'async / blocking', type: 'boolean', required: false, default: 'false / true', description: 'Đặt async: true hoặc blocking: false để nhận ngay trạng thái working cho tác vụ cục bộ.' },
    { name: 'historyLength', type: 'integer', required: false, description: 'Chỉ dùng trong tasks/get để giới hạn số tin nhắn gần nhất trả về trong messages và history.' },
    { name: 'reason', type: 'string', required: false, default: 'Canceled by caller', description: 'Chỉ dùng trong tasks/cancel (tối đa 300 ký tự) để lưu vào metadataJson.cancelReason.' }
  ]"
/>

## Ví dụ tương tác và liên thông

Đoạn mã dưới đây minh họa luồng đầy đủ từ khám phá Agent Card, gửi tác vụ nội bộ tới `dxos-ops`, kiểm tra trạng thái, hủy tác vụ đang chạy cho tới ủy quyền sang một A2A peer bên ngoài.

<CodeTabs :tabs="a2aTabs" />

## Cơ chế bảo mật và giới hạn vận hành

Gateway A2A áp dụng các lớp phòng vệ đồng bộ trước khi tạo bản ghi tác vụ hoặc gọi mô hình ngôn ngữ và máy chủ đối tác.

| Lớp kiểm soát | Hành vi thực thi trong `a2a-gateway.js` | Mã lỗi / HTTP |
| :--- | :--- | :--- |
| Chống giả mạo tenant | `assertNoCrossOrgSpoofing` đối chiếu mọi `organizationId` trong header `X-Organization-Id`, `X-Org-Id` và `params` với tổ chức thực của `latticeEmployees`. | `403` / `-32003` (`A2A_CROSS_ORG_FORBIDDEN`) |
| Khóa vai trò quản trị | `authorizeTargetAgent` bắt buộc `dxos-architect` chỉ nhận vai trò `root` hoặc `admin`; mọi profile tắt (`enabled: false`) bị từ chối ngay. | `403` / `-32003` (`A2A_ROLE_FORBIDDEN`) |
| Cô lập chủ sở hữu tác vụ | `authorizeExistingTaskAccess` chặn người dùng không phải admin đọc, replay theo `idempotencyKey` hoặc hủy tác vụ do người dùng khác tạo. | `403` / `-32003` (`A2A_TASK_FORBIDDEN`) |
| Phòng chống SSRF khi gọi peer | `assertSafePeerUrl` chặn URL có thông tin đăng nhập nhúng, hostname nội bộ (`localhost`, `.local`, `.internal`), IP dạng thập phân/bát phân/hex, dải IP riêng/link-local (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`), metadata đám mây và kiểm tra lại địa chỉ IP sau phân giải DNS; đồng thời khóa `redirect: 'error'`. | `400` / `-32602` (`A2A_PEER_URL_UNSAFE`) |
| Lọc PII và header nhạy cảm | `delegateToExternalA2aPeer` chạy `redactPiiDeep` lên `message` và `metadata` trước khi gửi đi, đồng thời loại bỏ `authorization`, `cookie`, `x-api-key` khỏi header xuất. | Tự động áp dụng |
| Chống Prototype Pollution | `assertNoPrototypePollution` và `cloneSafePlain` từ chối khóa `__proto__`, `constructor`, `prototype` và giới hạn độ sâu lồng nhau tối đa 24 tầng. | `400` / `-32602` (`A2A_PROTOTYPE_POLLUTION`) |
| Chặn CRUD trực tiếp | Middleware `dxosAiMemoryAndA2aScope` chặn mọi truy cập REST/Chart trực tiếp vào bảng `latticeA2aTasks` trừ `root`. | `403` (`DXOS_A2A_DIRECT_CRUD_FORBIDDEN`) |

### Cấu trúc bản ghi `latticeA2aTasks` và xử lý lỗi từ Peer

Mỗi tác vụ trong bảng `latticeA2aTasks` được đánh chỉ mục duy nhất theo cặp `(organizationId, taskId)` (`uidx_lattice_a2a_tasks_org_task`) cùng chỉ mục tìm kiếm nhanh theo `idempotencyKey` (`idx_lattice_a2a_tasks_org_idem`). Khi ủy quyền sang peer bên ngoài qua `delegateToExternalA2aPeer`, gateway giới hạn thời gian chờ trong khoảng `500ms` đến `120000ms` (mặc định `15000ms`). Nếu peer hết thời gian chờ hoặc trả về lỗi HTTP/JSON-RPC, tác vụ chuyển sang trạng thái `failed` kèm mã lỗi (`PEER_TIMEOUT`, `PEER_HTTP_<status>`, hoặc `PEER_RPC_ERROR`) đã lọc PII tối đa `400` ký tự.

Khi môi trường nội bộ chưa cấu hình dịch vụ LLM hoặc dịch vụ LLM không phản hồi, `executeDefaultLocalAgent` chuyển về chế độ `governed-local-handoff`, trả về biên nhận bàn giao có cấu trúc (`artifacts`) sau khi đã lọc PII trên nội dung đầu vào và ghi nhận đầy đủ vào `latticeAiAuditLogs` với `channel: 'a2a'`.

## Tài liệu liên quan

- [Tổng quan & Hồ sơ AI](/ai/overview-and-profiles): Chi tiết 7 hồ sơ AI chuẩn và cơ chế khóa quyền `enforceProfileRoleLock`.
- [MCP Gateway](/ai/mcp-gateway): Cổng JSON-RPC 2.0 phục vụ công cụ, tài nguyên và prompt cho client MCP.
- [Đánh giá & Hàng rào bảo vệ AI](/ai/eval-and-guardrails): Quy tắc lọc 9 mẫu PII, hạn mức chi phí và nhật ký `latticeAiAuditLogs`.
- [Cô lập đa tenant với PostgreSQL RLS](/architecture/multi-tenancy-rls): Cơ chế `FORCE ROW LEVEL SECURITY` bảo vệ bảng `latticeA2aTasks`.
