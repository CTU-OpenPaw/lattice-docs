---
title: Tổng quan AI Studio & 7 Hồ sơ Tác nhân
description: Kiến trúc phân hệ DX-OS AI Studio, lớp trừu tượng hóa nhà cung cấp LLM, kiểm soát bảo mật hồ sơ và danh mục đầy đủ 7 tác nhân AI chuyên trách.
---

<script setup>
const aiProfilesTabs = [
  {
    label: 'Quick-Connect LLM (cURL)',
    lang: 'bash',
    code: `curl -X POST "https://app.example.com/api/dxosAi:quickConnectLlm" \\
  -H "Authorization: Bearer <ADMIN_JWT_OR_PAT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "google-genai",
    "modelName": "gemini-2.5-flash",
    "apiKey": "AIza...",
    "testConnection": true,
    "verifyCompletion": true
  }'`,
  },
  {
    label: 'Lấy Tác nhân theo Portal',
    lang: 'bash',
    code: `curl -s "https://app.example.com/api/dxosAi:portalAgents?portalSlug=incidents" \\
  -H "Authorization: Bearer <USER_JWT>"`,
  },
  {
    label: 'Lưu Hồ sơ Tùy chỉnh',
    lang: 'json',
    code: `{
  "username": "dxos-qa-inspector",
  "nickname": "Chuyên viên Kiểm định QA AI",
  "position": "Kiểm định viên Chuỗi lạnh",
  "departmentScope": "qa-coldchain",
  "allowedRoles": ["ldx_warehouse", "ldx_manager"],
  "portalBindings": ["logistics", "incidents"],
  "toolPermissions": {
    "dxos_search_enterprise_context": "ALLOW",
    "dxos_graph_impact_analysis": "ALLOW",
    "dxos_execute_record_action": "ASK"
  }
}`,
  },
];
</script>

# Tổng quan AI Studio & 7 Hồ sơ Tác nhân

DX-OS AI Studio (`@latticedx/plugin-dxos-ai`) vận hành tại **Plane #5** trong kiến trúc 6 phân hệ của LatticeDX, chịu trách nhiệm điều phối lực lượng tác nhân AI đa vai trò, thực thi công cụ có kiểm toán và cung cấp cổng giao tiếp chuẩn hóa (MCP và A2A). Thay vì tách rời AI thành một dịch vụ rời rạc bên ngoài mô hình phân quyền, AI Studio kế thừa trực tiếp bối cảnh định danh từ Keycloak OIDC, chính sách RBAC theo vai trò `ldx_*` và cơ chế cô lập dữ liệu PostgreSQL `FORCE ROW LEVEL SECURITY` (`app.current_org`).

Mỗi tác nhân AI trong hệ thống được khai báo dưới dạng bản ghi trong collection `latticeAiProfiles`, ánh xạ hai chiều sang thực thể thực thi của máy chủ NocoBase `2.2.50` (`aiEmployees`, `rolesAiEmployees`) và gắn ràng buộc chặt chẽ với tập công cụ được phép gọi, phạm vi cổng vận hành (`/p/*`) và kết nối MCP nội bộ.

## Kiến trúc Vận hành DX-OS AI Studio

Sơ đồ tương tác dưới đây mô tả luồng xử lý từ yêu cầu người dùng hoặc sự kiện tự động hóa qua 7 hồ sơ tác nhân, vòng lặp suy luận ReAct, 20 công cụ hợp nhất và các giao thức mở MCP / A2A.

<AiStudioLifecycleDiagram />

Kiến trúc runtime tách biệt rạch ròi giữa hai lớp tác nhân:

- **Tác nhân vận hành (6 hồ sơ):** Chạy trong ranh giới vai trò nghiệp vụ (`ldx_*`), chỉ đọc và ghi các collection được cấp quyền RBAC, tuân thủ chế độ phê duyệt con người (HITL) đối với mọi hành động thay đổi trạng thái bản ghi hoặc cảnh báo IoT.
- **Tác nhân kiến trúc sư (`dxos-architect`):** Tác nhân quản trị hệ thống duy nhất nắm quyền gọi 11 công cụ `ADMIN_BUILDER_TOOL_NAMES`, bị khóa cứng chỉ cho phép vai trò `root` và `admin` truy cập.

## Trừu tượng hóa Nhà cung cấp LLM & Quick-Connect

Tất cả các tác nhân đều định tuyến suy luận qua cấu hình `llmServices` của NocoBase kết hợp module quản lý kết nối `ai-llm-health.js`. Mặc định khi khởi tạo (`ensureDefaultAiWorkforce`), 7 hồ sơ khởi đầu trỏ về dịch vụ `local-9router` (tương thích OpenAI Completions tại `AGENT_BASE_URL`, mặc định `http://host.docker.internal:20128/v1`) với mô hình `ag/gemini-3.8-flash` hoặc `combo`.

Quản trị viên có thể chuyển đổi nóng nhà cung cấp cho toàn bộ đội ngũ tác nhân thông qua 7 cấu hình dựng sẵn (`QUICK_CONNECT_PROVIDER_PRESETS`):

| Khóa preset | Provider lưu trữ | Tên dịch vụ mặc định | Base URL mặc định | Mô hình mặc định | Yêu cầu API Key |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `9router` | `openai-completions` | `local-9router` | `http://127.0.0.1:20128/v1` | `ag/gemini-3.8-flash` | Có |
| `openai` | `openai` | `quick-openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | Có |
| `openai-completions` | `openai-completions` | `quick-openai-completions` | `http://127.0.0.1:20128/v1` | `ag/gemini-3.8-flash` | Có |
| `google-genai` | `google-genai` | `quick-google-genai` | `https://generativelanguage.googleapis.com` | `gemini-2.5-flash` | Có |
| `anthropic` | `anthropic` | `quick-anthropic` | `https://api.anthropic.com/v1` | `claude-3-5-sonnet-latest` | Có |
| `deepseek` | `deepseek` | `quick-deepseek` | `https://api.deepseek.com/v1` | `deepseek-chat` | Có |
| `ollama` | `ollama` | `quick-ollama` | `http://127.0.0.1:11434` | `llama3.1` | Không |

### Kiểm soát SSRF khi Kết nối LLM

Mọi URL cấu hình qua `quickConnectLlm` hoặc kiểm tra sức khỏe `checkLlmHealth` đều đi qua `validateQuickConnectBaseUrl` và `assertSafeLlmProbeUrl`:

- Chỉ chấp nhận giao thức `http://` hoặc `https://`, cấm nhúng thông tin đăng nhập (`username:password@`) trong URL.
- Chặn toàn bộ dải IP nội bộ (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`), IPv6 link-local/ULA (`fe80::/10`, `fc00::/7`) và địa chỉ metadata đám mây (`169.254.169.254`, `metadata.google.internal`, `metadata.azure.com`), bao gồm kiểm tra phân giải DNS thực tế trước khi gửi yêu cầu HTTP.
- Kết nối cục bộ qua `http://` chỉ được phép với các host trong `QUICK_CONNECT_LOCAL_HOSTS` (`127.0.0.1`, `localhost`, `::1`, `host.docker.internal`) cho các provider hỗ trợ cục bộ (`ollama`, `9router`, `openai-completions`) và cổng nằm trong danh sách `11434`, `20128`, `1234`, `8000` (hoặc cấu hình bổ sung qua biến `DXOS_LOCAL_LLM_PORTS`).

## Mô hình Dữ liệu Hồ sơ & Ràng buộc Bảo mật

Collection `latticeAiProfiles` lưu cấu hình từng tác nhân và áp dụng đồng thời cơ chế RLS theo `organizationId` cùng các hook kiểm tra trước khi ghi dữ liệu.

<ParamGrid
  title="Cấu trúc Trường Dữ liệu của latticeAiProfiles"
  :items="[
    { name: 'username', type: 'string', required: true, description: 'Định danh duy nhất của tác nhân AI, khớp ^[a-z0-9][a-z0-9_-]{1,62}$.' },
    { name: 'nickname', type: 'string', required: true, description: 'Tên hiển thị trên thanh chat và bảng điều phối (tối đa 120 ký tự).' },
    { name: 'position', type: 'string', description: 'Chức danh chuyên môn hiển thị cho người dùng cuối.' },
    { name: 'departmentScope', type: 'string', default: 'general', description: 'Phân vùng phòng ban hoặc nghiệp vụ phụ trách.' },
    { name: 'organizationId', type: 'string', required: true, description: 'Mã tổ chức sở hữu hồ sơ, dùng cho chính sách FORCE RLS.' },
    { name: 'llmService', type: 'string', default: 'local-9router', description: 'Tên bản ghi dịch vụ LLM trong bảng llmServices.' },
    { name: 'modelName', type: 'string', default: 'ag/gemini-3.8-flash', description: 'Tên mô hình ngôn ngữ sử dụng cho tác nhân.' },
    { name: 'isAdminBuilder', type: 'boolean', default: 'false', description: 'Tự động bật true nếu toolPermissions chứa bất kỳ công cụ quản trị nào.' },
    { name: 'allowSubAgentDispatch', type: 'boolean', default: 'false', description: 'Cho phép tác nhân gọi sub-agent (chỉ bật ở dxos-coordinator).' },
    { name: 'allowedRoles', type: 'jsonb', default: '[ldx_employee, ldx_manager]', description: 'Danh sách vai trò được phép chat với tác nhân; ép thành [root, admin] khi isAdminBuilder=true.' },
    { name: 'toolPermissions', type: 'jsonb', default: '{}', description: 'Ánh xạ tên công cụ sang chế độ ALLOW, ASK (HITL) hoặc OFF.' },
    { name: 'mcpServers', type: 'jsonb', default: '[]', description: 'Danh sách endpoint MCP gắn kèm; được kiểm tra chống SSRF qua validateMcpServerUrl.' },
    { name: 'portalBindings', type: 'jsonb', default: '[]', description: 'Danh sách slug cổng (/p/<slug>) hoặc [\'*\'] nơi tác nhân hiển thị.' }
  ]"
/>

### Ba Lớp Phòng vệ Tự động trên Hồ sơ AI

| Lớp phòng vệ | Cơ chế thực thi |
| :--- | :--- |
| Khóa đặc quyền Builder (`enforceProfileRoleLock`) | Trong `ai-sync.js` và hook `latticeAiProfiles.beforeValidate`, nếu `isAdminBuilder` là `true` hoặc `toolPermissions` bật ít nhất 1 trong 11 công cụ quản trị (`ADMIN_BUILDER_TOOL_NAMES`), hệ thống cưỡng bức ghi đè `allowedRoles` thành `['root', 'admin']`. |
| Ngăn tự động gán vai trò mới (`roles.afterCreate`) | Khi quản trị viên tạo vai trò nghiệp vụ `ldx_*` mới, plugin `dxos-ai` chủ động xóa liên kết trong `rolesAiEmployees` đối với mọi tác nhân đánh dấu `isAdminBuilder: true` nhằm chống leo thang đặc quyền ngoài ý muốn. |
| Cấm truy cập REST trực tiếp cho non-admin | Middleware `dxosAiProfileScope` chặn mọi yêu cầu truy vấn `latticeAiProfiles` (bao gồm truy vấn qua biểu đồ `charts:queryData`) từ tài khoản không phải quản trị viên và tự động lọc theo `actor.organizationId`. |

## Danh mục Đầy đủ 7 Hồ sơ Tác nhân Khởi tạo

Khi hệ thống khởi chạy hoặc quản trị viên gọi `dxosAi:bootstrapDefaults`, 7 hồ sơ chuẩn (`STARTER_AI_BLUEPRINTS` trong `ai-schemas.js`) được đồng bộ với trạng thái `enabled: true`.

| # | `username` | Chức danh & Phạm vi | Cổng hiển thị (`portalBindings`) | Vai trò được phép (`allowedRoles`) | Điều phối phụ & MCP |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `dxos-coordinator` | Tổng Điều phối viên DX-OS (`enterprise-wide`) | `['*']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` | `allowSubAgentDispatch: true` · `dxos-it-ot-mcp` |
| 2 | `dxos-architect` | Kiến trúc sư Hệ thống - Block AI (`platform-admin`) | `['*']` | `['root', 'admin']` (`isAdminBuilder: true`) | `dxos-it-ot-mcp` |
| 3 | `dxos-ops` | Chuyên viên Kho lạnh - Sự cố IoT AI (`operations-itot`) | `['incidents', 'procurement']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse` | `dxos-it-ot-mcp` |
| 4 | `dxos-logistics` | Điều phối viên Chuỗi lạnh 5 Bước AI (`logistics-5step`) | `['logistics']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` | `dxos-it-ot-mcp` |
| 5 | `dxos-workspace` | Trợ lý Nội bộ, Mua sắm và P.A.R.A. AI (`workspace-para`) | `['services', 'procurement']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` | Không gắn MCP ngoài |
| 6 | `dxos-operator` | Chuyên viên Thực thi Vận hành DX-OS (`operations-execution`) | `['incidents', 'logistics', 'services']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_operator`, `ldx_dispatcher`, `ldx_warehouse` | `dxos-it-ot-mcp` |
| 7 | `dxos-analyst` | Chuyên gia Phân tích Dữ liệu - GraphRAG DX-OS (`analytics-bi`) | `['*']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` | Không gắn MCP ngoài |

### Ma trận Phân quyền Công cụ (`ALLOW` / `ASK`) của 7 Hồ sơ

Mỗi công cụ được gán chế độ `ALLOW` (thực thi trực tiếp sau khi qua kiểm tra RBAC/RLS) hoặc `ASK` (tạo bản ghi chờ duyệt HITL trong `latticeAiApprovalQueue` hoặc yêu cầu xác nhận từ người gọi).

| Hồ sơ (`username`) | Công cụ `ALLOW` | Công cụ `ASK` |
| :--- | :--- | :--- |
| `dxos-coordinator` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_graph_impact_analysis` *(kèm `dispatch-sub-agent-task`, `list-ai-employees`, `get-ai-employee`)* | `dxos_execute_record_action`, `dxos_orchestrate_enterprise_case`, `dxos_alarm_action` |
| `dxos-architect` | `dxos_inspect_architecture`, `dxos_recommend_page_blueprint`, `dxos_design_creative_block`, `dxos_compose_page_blocks`, `dxos_snapshot_or_rollback_page`, `dxos_provision_role_workspace`, `dxos_manage_portal_and_acl`, `dxos_extend_collection_schema`, `dxos_manage_rbac_permissions`, `dxos_deploy_workflow`, `dxos_configure_workflow`, `dxos_search_enterprise_context`, `dxos_orchestrate_enterprise_case`, `dxos_graph_impact_analysis`, `dxos_memory_remember`, `dxos_memory_recall` | `dxos_memory_forget` |
| `dxos-ops` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_graph_impact_analysis` | `dxos_execute_record_action`, `dxos_orchestrate_enterprise_case`, `dxos_alarm_action` |
| `dxos-logistics` | `dxos_search_enterprise_context`, `dxos_orchestrate_enterprise_case`, `dxos_graph_impact_analysis` | `dxos_execute_record_action`, `dxos_my_workflow_tasks` |
| `dxos-workspace` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_graph_impact_analysis` | `dxos_execute_record_action`, `dxos_orchestrate_enterprise_case`, `dxos_alarm_action` |
| `dxos-operator` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_memory_recall`, `dxos_memory_remember` | `dxos_execute_record_action`, `dxos_alarm_action` |
| `dxos-analyst` | `dxos_search_enterprise_context`, `dxos_graph_impact_analysis`, `dxos_orchestrate_enterprise_case`, `dxos_memory_recall` | — |

## API Quản trị Hồ sơ & Kết nối LLM

Plugin `@latticedx/plugin-dxos-ai` cung cấp các endpoint tài nguyên `dxosAi` cho giao diện quản trị và tích hợp CLI/GitOps.

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listProfiles"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Liệt kê toàn bộ hồ sơ tác nhân AI trong tổ chức kèm danh mục công cụ và tổ chức hoạt động."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:saveProfile"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Tạo mới hoặc cập nhật hồ sơ tác nhân AI, tự động chạy enforceProfileRoleLock và đồng bộ sang aiEmployees."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:bootstrapDefaults"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Khởi tạo hoặc khôi phục đầy đủ 7 hồ sơ tác nhân chuẩn và liên kết dịch vụ LLM mặc định."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:portalAgents"
  auth="Bearer JWT | ldx_pat_*"
  scope="loggedIn"
  summary="Trả về danh sách tác nhân AI được phép hiển thị cho vai trò của người dùng tại portalSlug hiện tại."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:quickConnectLlm"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Cấu hình nhanh nhà cung cấp LLM (OpenAI, Gemini, Anthropic, DeepSeek, Ollama, 9router) và gắn lại cho đội ngũ tác nhân."
/>

<CodeTabs :tabs="aiProfilesTabs" />

Các thao tác bổ sung trên dịch vụ LLM gồm `GET /api/dxosAi:checkLlmHealth`, `GET /api/dxosAi:listLlmServices`, `POST /api/dxosAi:switchLlmServiceModel` và `POST /api/dxosAi:deleteLlmService`. Khi xóa một dịch vụ LLM đang gắn trên hồ sơ, hệ thống tự động gỡ tham chiếu `llmService` và `modelName` trên cả `latticeAiProfiles` lẫn `aiEmployees` để tránh lỗi định tuyến.

## Tài liệu liên quan

- [App Builder 2.0](/ai/app-builder)
- [20 Công cụ Hợp nhất & 4 Công cụ IT/OT](/ai/unified-tools)
- [Cổng Giao thức MCP](/ai/mcp-gateway)
- [Đánh giá & Hàng rào Bảo vệ AI](/ai/eval-and-guardrails)
