---
title: Cổng Giao thức MCP (JSON-RPC 2.0)
description: Đặc tả cổng Model Context Protocol phi trạng thái qua Streamable HTTP JSON-RPC 2.0 tại /api/dxos-mcp và /api/dxos-mcp/it-ot, cơ chế xác thực Bearer, prompts, resources và cấu hình client.
---

<script setup>
const mcpGatewayTabs = [
  {
    label: 'MCP Client Config (JSON)',
    lang: 'json',
    code: `{
  "mcpServers": {
    "latticedx-enterprise": {
      "transport": "http",
      "url": "https://app.example.com/api/dxos-mcp",
      "headers": {
        "Authorization": "Bearer ldx_pat_your_scoped_token"
      }
    },
    "latticedx-itot": {
      "transport": "http",
      "url": "https://app.example.com/api/dxos-mcp/it-ot",
      "headers": {
        "Authorization": "Bearer ldx_pat_your_scoped_token"
      }
    }
  }
}`,
  },
  {
    label: 'initialize & tools/list (cURL)',
    lang: 'bash',
    code: `# 1. Initialize handshake
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}'

# 2. List role-filtered tools
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'`,
  },
  {
    label: 'tools/call & resources/read',
    lang: 'bash',
    code: `# Call GraphRAG impact tool
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "dxos_graph_impact_analysis",
      "arguments": {"collection": "latticeAssets", "recordCode": "COLD-ROOM-A1", "maxDepth": 2}
    }
  }'

# Read active organization alarms resource
curl -s -X POST "https://app.example.com/api/dxos-mcp" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "resources/read",
    "params": {"uri": "dxos://org/org-1/alarms/active"}
  }'`,
  },
];
</script>

# Cổng Giao thức MCP (JSON-RPC 2.0)

Cổng Model Context Protocol (`mcp-gateway.js`) cho phép các trình khách MCP bên ngoài (như IDE, CLI hoặc hệ thống điều phối AI khác) và chính các tác nhân nội bộ của LatticeDX kết nối trực tiếp tới hệ sinh thái công cụ, tài nguyên ngữ cảnh và mẫu prompt của doanh nghiệp thông qua giao thức chuẩn **Streamable HTTP JSON-RPC 2.0**.

Cổng hoạt động theo mô hình phi trạng thái (stateless) qua phương thức `POST` tại hai đường dẫn tách biệt theo mục đích sử dụng:

- **`/api/dxos-mcp`** (`serverInfo.name: "latticedx-enterprise-mcp"`): Phục vụ nhóm **20 Công cụ Hợp nhất** (quản trị kiến trúc, App Builder 2.0, vận hành nghiệp vụ, GraphRAG, HITL và bộ nhớ bền vững).
- **`/api/dxos-mcp/it-ot`** (`serverInfo.name: "latticedx-itot-mcp"`): Phục vụ nhóm **4 Công cụ IT/OT chuyên biệt** (telemetry FIWARE Orion-LD, dòng thời gian sự cố, kiểm tra kết nối stack và đồng bộ outbox/`n8n`).

Mọi yêu cầu `GET` hoặc `DELETE` gửi trực tiếp tới hai endpoint này đều nhận mã HTTP `405` với lỗi JSON-RPC `-32000`, hướng dẫn trình khách gửi yêu cầu `POST` JSON-RPC 2.0.

## Xác thực Bearer, Phân tách Vai trò & Kiểm toán

Cổng MCP tái sử dụng chuỗi xác thực chuẩn của máy chủ NocoBase thông qua `extractBearerToken` và `defaultResolveHostAuth`:

| Lớp kiểm soát | Hành vi thực thi |
| :--- | :--- |
| Token xác thực | Trình khách gửi header `Authorization: Bearer <token>` sử dụng JWT phiên đăng nhập hoặc API key theo phạm vi `ldx_pat_*`. Nếu thiếu hoặc không hợp lệ, cổng trả về HTTP `401` kèm header `WWW-Authenticate: Bearer realm="LatticeDX-MCP", error="invalid_token"`, thân lỗi JSON-RPC `-32001`, và ghi bản ghi `status: "denied"`, `errorCode: "MCP_UNAUTHORIZED"` vào `latticeAiAuditLogs`. |
| Giới hạn vai trò qua `X-Role` | Trình khách có thể truyền thêm header `X-Role: <roleName>`. Máy chủ chỉ chấp nhận nếu `<roleName>` nằm trong danh sách vai trò đã gán cho người dùng trong `rolesUsers`. |
| Tự động lọc quyền quản trị | Với tài khoản không phải quản trị viên (`isStudioAdmin` trả về `false`), cổng tự động loại bỏ toàn bộ công cụ có `adminOnly: true` (11 công cụ builder trên `/api/dxos-mcp` và `get_stack_connector_health` on `/api/dxos-mcp/it-ot`) cùng các prompt quản trị khỏi `tools/list`, `prompts/list`, `tools/call` và `prompts/get` (trả về mã `-32003` nếu cố gọi trực tiếp). |
| Kênh kiểm toán | Toàn bộ lượt gọi trên `/api/dxos-mcp` ghi dưới `channel: "mcp-enterprise"` và trên `/api/dxos-mcp/it-ot` ghi dưới `channel: "mcp-itot"`. |

## Endpoint Cổng & API Khám phá

<ApiEndpoint
  method="POST"
  path="/api/dxos-mcp"
  auth="Bearer JWT | ldx_pat_*"
  scope="mcp-enterprise"
  summary="Endpoint Streamable HTTP JSON-RPC 2.0 cho 20 Công cụ Hợp nhất, Prompts và Resources doanh nghiệp."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxos-mcp/it-ot"
  auth="Bearer JWT | ldx_pat_*"
  scope="mcp-itot"
  summary="Endpoint Streamable HTTP JSON-RPC 2.0 cho 4 công cụ IT/OT (Orion-LD, Timeline, Stack Health, Outbox/n8n)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:mcpCatalog"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Trả về danh mục đầy đủ 20 + 4 công cụ kèm inputSchema, danh sách prompts, resources, Agent Card và cấu hình JSON mẫu."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:testMcpEndpoint"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Kiểm tra bắt tay initialize tới /api/dxos-mcp hoặc /api/dxos-mcp/it-ot nội bộ và đo độ trễ."
/>

## Đặc tả Phương thức JSON-RPC 2.0

Cổng hỗ trợ hai phiên bản giao thức trong `SUPPORTED_PROTOCOL_VERSIONS`: `'2025-03-26'` (mặc định nếu phiên bản yêu cầu không khớp) và `'2024-11-05'`.

| Phương thức JSON-RPC | Trạng thái HTTP | Chức năng & Kết quả trả về |
| :--- | :--- | :--- |
| `initialize` | `200` | Thương lượng `protocolVersion`, trả về `capabilities` (`tools`, `resources`, `prompts`) và `serverInfo` (`name`, `version`). |
| `notifications/initialized` | `202` | Xác nhận hoàn tất bắt tay khởi tạo với `{ "ok": true }`. |
| `ping` | `200` | Kiểm tra kết nối sống, trả về `{}`. |
| `tools/list` | `200` | Liệt kê danh sách `{ name, description, inputSchema }` đã lọc theo quyền quản trị của người gọi. |
| `tools/call` | `200` | Gọi `tool.invoke(ctx, args)` và bọc kết quả JSON trong `content: [{ type: "text", text }]` với cờ `isError` (`-32003` nếu bị từ chối quyền). |
| `prompts/list` | `200` | Liệt kê danh sách mẫu prompt từ `MCP_PROMPT_CATALOG` đã lọc theo quyền quản trị. |
| `prompts/get` | `200` | Kiểm tra tham số bắt buộc (làm sạch ký tự xuống dòng/null, cắt tối đa 200 ký tự) và trả về mảng `messages` vai trò `user`. |
| `resources/templates/list` | `200` | Trả về các URI template tra cứu cảnh báo, phả hệ GraphRAG và tài nguyên hạ tầng (nếu là admin). |
| `resources/list` | `200` | Liệt kê các URI tài nguyên khả dụng theo `organizationId` của người gọi và quyền admin. |
| `resources/read` | `200` | Đọc dữ liệu JSON cho URI được yêu cầu; trả về `-32003` nếu truy cập chéo tổ chức hoặc thiếu quyền RBAC. |

### Danh mục 4 Mẫu Prompt (`MCP_PROMPT_CATALOG`)

| Tên Prompt | `adminOnly` | Tham số | Quy trình hướng dẫn |
| :--- | :--- | :--- | :--- |
| `dxos-cold-chain-incident-triage` | `false` | `assetCode` *(bắt buộc)*, `incidentCode` | Gọi `get_live_ngsi_telemetry`, chạy `dxos_graph_impact_analysis`, tìm SOP P.A.R.A. và đề xuất `dxos_alarm_action`. |
| `dxos-fefo-dispatch-audit` | `false` | `lotCode` *(bắt buộc)*, `sku` | Truy vết GraphRAG lô tồn kho FEFO (`maxDepth=3`), đối chiếu `mktCelsius` với `targetTempMaxC` và xuất trích dẫn. |
| `dxos-executive-radar-brief` | `false` | `focusArea` | Chạy `dxos_orchestrate_enterprise_case(mode="radar")` và `dxos_my_workflow_tasks(action="list")` tổng hợp điểm nghẽn. |
| `dxos-system-blueprint-architect` | `true` | `portalSlug` *(bắt buộc)*, `goal` *(bắt buộc)* | Gọi `dxos_recommend_page_blueprint`, thiết kế Creative Block hoặc dựng workspace có Time-Machine snapshot. |

### Danh mục Tài nguyên MCP (`resources/read`)

| URI / URI Template | Quyền truy cập | Dữ liệu trả về |
| :--- | :--- | :--- |
| `dxos://org/{organizationId}/alarms/active` | Thành viên cùng tổ chức + quyền xem `latticeIncidentCases` | Danh sách tối đa 50 cảnh báo đang mở (loại trừ `closed`/`cleared`), đã che PII qua `redactPiiDeep`. |
| `dxos://org/{organizationId}/lineage/{collection}/{recordId}` | Thành viên cùng tổ chức + quyền xem `collection` | Kết quả phân tích đồ thị phả hệ `analyzeGraphImpact` ở độ sâu `maxDepth: 2`. |
| `dxos://topology/planes` | `admin` trên `/api/dxos-mcp` | Toàn bộ cấu trúc 6-Plane DX-OS và số liệu live từ `buildEnterpriseTopology`. |
| `dxos://itot/health` | `admin` trên `/api/dxos-mcp/it-ot` | Trạng thái live của `itOtDigitalTwin` và `integrationEventBus`. |

### Tham số Yêu cầu JSON-RPC & Bảng Mã lỗi

<ParamGrid
  title="Tham số Giao thức JSON-RPC 2.0 trên /api/dxos-mcp"
  :items="[
    { name: 'jsonrpc', type: 'string', required: true, default: '2.0', description: 'Phiên bản chuẩn JSON-RPC bắt buộc.' },
    { name: 'id', type: 'string | number | null', description: 'Định danh tương quan yêu cầu (bỏ qua với notification).' },
    { name: 'method', type: 'string', required: true, description: 'Tên phương thức MCP: initialize, notifications/initialized, ping, tools/list, tools/call, prompts/list, prompts/get, resources/templates/list, resources/list, resources/read.' },
    { name: 'params.protocolVersion', type: 'string', default: '2025-03-26', description: 'Phiên bản giao thức khi gọi initialize (2025-03-26 hoặc 2024-11-05).' },
    { name: 'params.name', type: 'string', description: 'Tên công cụ (tools/call) hoặc tên prompt (prompts/get).' },
    { name: 'params.arguments', type: 'object', description: 'Đối số truyền vào công cụ hoặc mẫu prompt (được làm sạch ký tự điều khiển).' },
    { name: 'params.uri', type: 'string', description: 'URI tài nguyên dxos:// khi gọi resources/read.' }
  ]"
/>

| Mã lỗi JSON-RPC | Trạng thái HTTP | Nguyên nhân và Xử lý |
| :--- | :--- | :--- |
| `-32001` | `401` | Thiếu Bearer token hoặc token không hợp lệ; trả kèm header `WWW-Authenticate` và ghi audit `MCP_UNAUTHORIZED`. |
| `-32000` | `405` | Gửi yêu cầu `GET`, `DELETE` hoặc phương thức HTTP không phải `POST` tới endpoint phi trạng thái. |
| `-32003` | `200` | Truy cập bị từ chối: gọi công cụ/prompt `adminOnly`, đọc tài nguyên chéo `organizationId`, hoặc thiếu quyền RBAC. |
| `-32601` | `200` | Tên phương thức JSON-RPC (`method`) không nằm trong danh sách hỗ trợ của cổng MCP. |
| `-32602` | `200` | Tham số không hợp lệ: thiếu argument bắt buộc cho prompt, tên `collection` cấm hoặc URI `dxos://` không tồn tại. |

Nếu một công cụ hợp lệ bị lỗi nghiệp vụ hoặc tham số trong quá trình chạy `tools/call`, cổng trả về JSON-RPC `result` chuẩn với `isError: true` và thông báo lỗi dạng text trong `content[0].text` thay vì ngắt kết nối vận chuyển.

## Kiểm soát SSRF cho Kết nối MCP Ngoài (`validateMcpServerUrl`)

Khi cấu hình trường `mcpServers` trên hồ sơ `latticeAiProfiles` hoặc gọi `dxosAi:testMcpEndpoint`, hàm `validateMcpServerUrl` trong `ai-schemas.js` áp dụng các quy tắc chặn SSRF sau:

- Chỉ cho phép giao thức `http:` hoặc `https:`, cấm thông tin xác thực nhúng trong URL.
- Chặn host dạng số nguyên, thập lục phân (`0x...`) hoặc bát phân (`0...`).
- Chặn IP riêng tư, loopback/link-local không nằm trong `LOOPBACK_HOSTS` (`localhost`, `127.0.0.1`, `[::1]`, `::1`, `host.docker.internal`), và các host metadata (`169.254.*`, `metadata.google.internal`, `metadata.azure.com`).
- Giao thức `http://` không mã hóa chỉ được phép cho `LOOPBACK_HOSTS`, `STACK_HTTP_HOSTS` (`orion-ld`, `n8n`, `keycloak`, `nocobase`, `lattice-dx-orion-ld`, `lattice-dx-n8n`, `lattice-dx-keycloak`) hoặc các host khai báo trong biến môi trường `DXOS_MCP_INTERNAL_HTTP_ALLOWLIST`. Mọi endpoint bên ngoài bắt buộc dùng `https://`.

## Cấu hình Trình khách & Ví dụ Gọi API

<CodeTabs :tabs="mcpGatewayTabs" />

## Tài liệu liên quan

- [20 Công cụ Hợp nhất & 4 Công cụ IT/OT](/ai/unified-tools)
- [Giao thức Agent-to-Agent (A2A)](/ai/a2a-protocol)
- [Tổng quan AI Studio & 7 Hồ sơ Tác nhân](/ai/overview-and-profiles)
- [Khóa API theo Phạm vi (`ldx_pat_*`)](/reference/api-keys)
