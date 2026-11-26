---
title: Tài liệu Tham chiếu 20 Công cụ Hợp nhất & 4 Công cụ IT/OT
description: Đặc tả đầy đủ tên công cụ, schema tham số đầu vào, phạm vi RBAC và ràng buộc an toàn cho toàn bộ 20 Unified Tools và 4 công cụ IT/OT MCP trong LatticeDX.
---

# 20 Công cụ Hợp nhất & 4 Công cụ IT/OT

Mọi tác nhân AI nội bộ và kết nối MCP ngoài đều tương tác với LatticeDX thông qua **20 Công cụ Hợp nhất** (`createDxosTools()` trong `ai-tools-core.js`) và **4 Công cụ IT/OT MCP** (`createItOtMcpTools()` trong `mcp-itot-tools.js`). Toàn bộ 24 công cụ được bọc bởi hàm `createAuditedTool`, đảm bảo mọi lời gọi đều đi qua một chuỗi kiểm soát đồng nhất trước khi chạm vào dữ liệu hoặc hạ tầng.

## Chuỗi Thực thi Kiểm toán (`createAuditedTool`)

Mỗi lần gọi công cụ trải qua 6 cổng kiểm soát tuần tự:

| Thứ tự | Cổng kiểm soát | Cơ chế thực thi |
| :---: | :--- | :--- |
| `1` | Định danh & phạm vi tổ chức (`resolveActorScope`) | Yêu cầu người gọi đã đăng nhập; tài khoản không phải quản trị viên bắt buộc phải gắn bản ghi `latticeEmployees` đang hoạt động (`active: true`) với `organizationId` hợp lệ. |
| `2` | Kiểm tra đặc quyền & hồ sơ | Các công cụ gắn cờ `adminOnly: true` trả về `403 DXOS_ADMIN_REQUIRED` nếu người gọi không thuộc vai trò quản trị (`root`, `admin`, hoặc vai trò có `allowConfigure: true` / `pm.*`). Nếu công cụ chạy dưới tên một hồ sơ `latticeAiProfiles` và có quyền `OFF`, hệ thống từ chối với mã `403 TOOL_PERMISSION_OFF`. |
| `3` | Kiểm tra hạn mức AI (`checkAndConsumeAiQuotaPersistent`) | Kiểm tra hạn mức gọi theo ngày của tổ chức và người dùng trước khi thực thi (trừ lượt chạy lại sau khi phê duyệt HITL). |
| `4` | Xác thực lược đồ (`defineToolSchema`) | Chuẩn hóa JSON đầu vào và từ chối tham số sai kiểu, thiếu trường bắt buộc hoặc vượt quá `maxLength` với mã `400 TOOL_ARGS_INVALID`. |
| `5` | Thực thi trong giao dịch RLS (`runWithTenantRls`) | Gắn `app.current_org` cục bộ theo giao dịch PostgreSQL cho người gọi (riêng nhóm thao tác `ORCHESTRATOR_OPS` của `dxos_provision_role_workspace` tự quản lý giao dịch RLS từng bước). |
| `6` | Ẩn PII & ghi nhật ký (`recordAiAuditLog`) | Che dữ liệu nhạy cảm trên đối số và kết quả, tính token/chi phí ước lượng và ghi vào `latticeAiAuditLogs`. |

## Nhóm 1: Công cụ Kiến trúc Schema & Portal (5 công cụ · `adminOnly: true`)

### `dxos_inspect_architecture`

Đọc trực tiếp danh sách portal (`/p/*`), trang, collection nghiệp vụ `lattice*`, workflow đang hoạt động, vai trò và hồ sơ AI hiện có. Mặc định `ALLOW` trên định nghĩa công cụ; chỉ khả dụng với quản trị viên.

<ParamGrid
  title="Tham số dxos_inspect_architecture"
  :items="[
    { name: 'portalSlug', type: 'string', description: 'Slug cổng tùy chọn (tối đa 40 ký tự, khớp ^[a-z0-9][a-z0-9-]{1,39}$) để liệt kê blockUids và gridUid chi tiết.' }
  ]"
/>

### `dxos_compose_page_blocks`

Kiểm tra, thêm khối nội tuyến (12 Native v2 BlockModels hoặc khối chuẩn `flowSurfaces`), chia lưới nhiều cột, cấu hình sâu từng khối, sắp xếp lại hoặc gỡ khối trên trang portal. Mặc định `ASK`; tự động chụp `latticeUiSnapshots` trước khi ghi và chặn `SYSTEM_PROTECTED_COLLECTIONS`.

<ParamGrid
  title="Tham số dxos_compose_page_blocks"
  :items="[
    { name: 'action', type: 'string', default: 'addBlock', description: 'Một trong: addBlock, listBlocks, composePageBlueprint, updateBlock, reorderBlocks, setGridLayout, configureNativeBlock, removeBlock.' },
    { name: 'portalSlug', type: 'string', required: true, description: 'Slug cổng mục tiêu (tối đa 40 ký tự).' },
    { name: 'pageTitle', type: 'string', description: 'Tiêu đề trang cần lọc hoặc chỉnh sửa (tối đa 100 ký tự).' },
    { name: 'groupTitle', type: 'string', description: 'Tiêu đề nhóm menu khi dùng composePageBlueprint.' },
    { name: 'blockUid', type: 'string', description: 'UID khối mục tiêu cho updateBlock, configureNativeBlock hoặc removeBlock.' },
    { name: 'blockUse', type: 'string', description: 'Tên lớp BlockModel (12 Dxos*BlockModel, NativeTableBlock, table, kanban, chart, filterForm, v.v.).' },
    { name: 'title', type: 'string', description: 'Tiêu đề khối hoặc trang.' },
    { name: 'collection', type: 'string', description: 'Tên collection nguồn dữ liệu cho khối.' },
    { name: 'fields', type: 'array<string>', description: 'Danh sách trường hiển thị khi gọi addBlock.' },
    { name: 'tableFields', type: 'array<string>', description: 'Danh sách cột bảng khi gọi composePageBlueprint.' },
    { name: 'includeCreateForm', type: 'boolean', default: 'false', description: 'Chèn thêm khối createForm trong composePageBlueprint.' },
    { name: 'dxosBlocks', type: 'array<object>', description: 'Danh sách { blockUse, title, config } gắn thêm trong composePageBlueprint.' },
    { name: 'orderedBlockUids', type: 'array<string>', description: 'Thứ tự UID khối mới cho reorderBlocks.' },
    { name: 'placeBesideBlockUid', type: 'string', description: 'UID khối hiện có để ghép hàng 2 cột [12, 12] khi gọi addBlock.' },
    { name: 'rowsLayout', type: 'array<object>', description: 'Cấu hình hàng nhiều cột cho setGridLayout (tổng span mỗi hàng <= 24).' },
    { name: 'surfaceAction', type: 'string', description: 'Thao tác flowSurfaces: addField, addAction, addRecordAction, updateSettings, setFieldLinkageRules, setFieldValueRules.' },
    { name: 'surfacePayload', type: 'object', description: 'Payload đi kèm surfaceAction.' },
    { name: 'config', type: 'object', description: 'Đối tượng cấu hình props cho khối.' },
    { name: 'configJson', type: 'string', description: 'Chuỗi JSON ghi đè props cho khối (tối đa 4000 ký tự).' },
    { name: 'roleNames', type: 'array<string>', description: 'Danh sách vai trò ldx_* được cấp quyền truy cập route mới tạo.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Xem trước thay đổi mà không ghi dữ liệu.' }
  ]"
/>

### `dxos_manage_portal_and_acl`

Tạo hoặc cập nhật layout cổng `/p/<slug>` và cấp hoặc thu hồi quyền hiển thị route cho vai trò nghiệp vụ. Mặc định `ASK`; lọc `roleNames` qua `isBusinessRoleName` để loại bỏ `root`, `admin`, `anonymous`, `member`, `ldx_sysadmin`, `ldx_connector` và vai trò tiền tố `r_`.

<ParamGrid
  title="Tham số dxos_manage_portal_and_acl"
  :items="[
    { name: 'operation', type: 'string', default: 'grant', description: 'Thao tác: grant hoặc revoke.' },
    { name: 'slug', type: 'string', required: true, description: 'Slug cổng khớp ^[a-z0-9][a-z0-9-]{1,39}$.' },
    { name: 'title', type: 'string', description: 'Tên hiển thị của portal (tối đa 100 ký tự).' },
    { name: 'roleNames', type: 'array<string>', description: 'Danh sách vai trò ldx_* mục tiêu.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Chạy thử không ghi DB.' }
  ]"
/>

### `dxos_extend_collection_schema`

Kiểm tra, tạo mới collection nghiệp vụ `latticeCustom*`, bổ sung trường (12+ kiểu dữ liệu, quan hệ `belongsTo`/`hasMany`/`hasOne`/`belongsToMany`, công thức Safe AST, xác thực Thompson NFA), cập nhật metadata trường hoặc đánh dấu ngừng sử dụng trường không phá hủy (`deprecateField`). Mặc định `ASK`; từ chối `SYSTEM_PROTECTED_COLLECTIONS` (`403 SYSTEM_COLLECTION_FORBIDDEN`), chặn prototype pollution và tự động bật `FORCE ROW LEVEL SECURITY` cho mọi bảng `latticeCustom*` và bảng trung gian.

<ParamGrid
  title="Tham số dxos_extend_collection_schema"
  :items="[
    { name: 'operation', type: 'string', required: true, description: 'Một trong: createCollection, addFields, inspectCollection, updateFieldMeta, deprecateField.' },
    { name: 'collectionName', type: 'string', required: true, description: 'Tên collection; tạo mới bắt buộc khớp ^latticeCustom[A-Z][A-Za-z0-9]{1,40}$.' },
    { name: 'title', type: 'string', description: 'Tiêu đề hiển thị cho collection hoặc trường.' },
    { name: 'fieldName', type: 'string', description: 'Tên trường mục tiêu cho updateFieldMeta hoặc deprecateField (cấm ngừng dùng id, organizationId, createdAt, updatedAt).' },
    { name: 'uiSchema', type: 'object', description: 'Metadata uiSchema cập nhật khi gọi updateFieldMeta.' },
    { name: 'enumValues', type: 'array<string>', description: 'Danh sách giá trị select/enum mới cho updateFieldMeta.' },
    { name: 'reason', type: 'string', description: 'Lý do ngừng sử dụng trường khi gọi deprecateField.' },
    { name: 'fields', type: 'array<object>', description: 'Danh sách định nghĩa trường ({ name, type, title, enumValues, target, through, foreignKey, otherKey, formulaExpression, formulaReturnType, validation, required, unique }).' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Xem trước cấu trúc trường và thông số sinh ra.' }
  ]"
/>

### `dxos_manage_rbac_permissions`

Kiểm tra hoặc tạo vai trò `ldx_*` tùy chỉnh, cấp quyền thao tác theo từng collection/trường/phạm vi dữ liệu, khóa trường ghi (`lockFields`) hoặc thu hồi quyền trên `dataSourcesRolesResources`. Mặc định `ASK`; chỉ chấp nhận vai trò khớp `isBusinessRoleName` và từ chối mọi bảng hệ thống.

<ParamGrid
  title="Tham số dxos_manage_rbac_permissions"
  :items="[
    { name: 'operation', type: 'string', required: true, description: 'Một trong: inspectRole, ensureCustomRole, grantResource, lockFields, revokeResource.' },
    { name: 'roleName', type: 'string', required: true, description: 'Tên vai trò nghiệp vụ (ldx_*).' },
    { name: 'title', type: 'string', description: 'Tên hiển thị khi tạo vai trò mới qua ensureCustomRole.' },
    { name: 'cloneFromRole', type: 'string', description: 'Vai trò ldx_* nguồn để sao chép quyền và route.' },
    { name: 'collectionName', type: 'string', description: 'Collection mục tiêu cho grantResource, lockFields hoặc revokeResource.' },
    { name: 'actions', type: 'array<string>', description: 'Hành động được phép: view, create, update, destroy, export.' },
    { name: 'readableFields', type: 'array<string>', description: 'Danh sách trường cho phép đọc ở hành động view.' },
    { name: 'writableFields', type: 'array<string>', description: 'Danh sách trường cho phép ghi trước khi lọc lockedFields.' },
    { name: 'lockedFields', type: 'array<string>', description: 'Danh sách trường bị loại bỏ khỏi quyền create và update.' },
    { name: 'hideLockedFromView', type: 'boolean', default: 'false', description: 'Ẩn thêm các trường trong lockedFields khỏi quyền view.' },
    { name: 'scopeMode', type: 'string', default: 'all_in_org', description: 'Phạm vi dữ liệu: all_in_org, own hoặc own_draft.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Chạy thử không ghi DB.' }
  ]"
/>

## Nhóm 2: Công cụ Workflow, DMN & Stock n8n (2 công cụ · `adminOnly: true`)

### `dxos_deploy_workflow`

Triển khai các mẫu quy trình chuẩn của NocoBase hoặc quy trình AI triage sự cố theo tổ chức, tự động ánh xạ nhân sự theo vai trò từ `latticeEmployees`. Mặc định `ASK`.

<ParamGrid
  title="Tham số dxos_deploy_workflow"
  :items="[
    { name: 'templateKey', type: 'string', required: true, description: 'Một trong: procurement, logistics-5step, incident-uc2, internal-service, ai-incident-triage.' },
    { name: 'organizationId', type: 'string', description: 'Mã tổ chức mục tiêu (mặc định lấy từ ngữ cảnh người gọi).' },
    { name: 'enabled', type: 'boolean', default: 'true', description: 'Kích hoạt ngay sau khi cài đặt.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Kiểm tra ánh xạ nhân sự mà không tạo workflow.' }
  ]"
/>

### `dxos_configure_workflow`

Công cụ thống nhất điều khiển 4 phân hệ tự động hóa: NocoBase Workflows (`inspectWorkflow`, `updateNodeConfig`, `addNode`, `buildCustomWorkflow`, `toggleWorkflow`), LatticeFlow v2 DAG (`listAutomations`, `runAutomation`, `suggestAutomation`, `draftAutomation`, `patchAutomation`, `saveAutomation`, `testAutomation`, `resumeAutomation`), Visual DMN (`dmn_list_tables`, `dmn_save_table`, `dmn_evaluate`) và Stock `n8n` REST API v1 + Connector Vault (`listConnectors`, `testConnector`, `invokeN8n`, `list_n8n_workflows`, `create_n8n_workflow`, `update_n8n_workflow`, `activate_n8n_workflow`, `list_n8n_executions`, `retry_n8n_execution`, `sync_n8n_credential`, `list_connected_apps`). Mặc định `ASK`; chặn prototype pollution, chặn biểu thức `${...}` không an toàn và cấm thao tác trên `SYSTEM_PROTECTED_COLLECTIONS`.

<ParamGrid
  title="Tham số Chính của dxos_configure_workflow"
  :items="[
    { name: 'operation', type: 'string', required: true, description: '27 thao tác hợp lệ thuộc 4 nhóm: Workflow v1, LatticeFlow v2, DMN và n8n/Vault.' },
    { name: 'ruleKey', type: 'string', description: 'Khóa định danh rule LatticeFlow v2 (khớp ^[a-z0-9][a-z0-9_-]{1,62}$).' },
    { name: 'graphJson', type: 'object', description: 'Đồ thị DAG v2 ({ version: 2, nodes, edges, settings }).' },
    { name: 'runUid', type: 'string', description: 'UID lượt chạy đang tạm dừng (suspended) khi gọi resumeAutomation.' },
    { name: 'decision', type: 'string', description: 'Quyết định HITL cho resumeAutomation: approved hoặc rejected.' },
    { name: 'tableKey', type: 'string', description: 'Khóa bảng quyết định DMN cho dmn_list_tables, dmn_save_table, dmn_evaluate.' },
    { name: 'hitPolicy', type: 'string', description: 'Chính sách đánh giá DMN (FIRST hoặc COLLECT khi tạo qua AI).' },
    { name: 'connectorKey', type: 'string', description: 'Khóa kết nối trong Connector Vault (ví dụ n8n-enterprise-orchestrator).' },
    { name: 'workflowId', type: 'string', description: 'ID workflow NocoBase hoặc Stock n8n.' },
    { name: 'workflow', type: 'object', description: 'Định nghĩa JSON workflow n8n khi gọi create_n8n_workflow / update_n8n_workflow.' },
    { name: 'apply', type: 'boolean', default: 'false', description: 'Chỉ ghi thay đổi Flow Architect khi quản trị viên xác nhận apply=true.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Mô phỏng kết quả mà không ghi DB hoặc gọi ghi ngoài.' }
  ]"
/>

## Nhóm 3: Giao diện Sáng tạo & App Builder 2.0 (4 công cụ · `adminOnly: true`)

### `dxos_recommend_page_blueprint`

Phân tích cấu trúc trường của collection mục tiêu (hoặc tự dò collection chính trên `portalSlug`) để gợi ý cấu hình `DxosCreativeStudioBlockModel`, các khối chuẩn và bố cục nhiều cột. Mặc định `ALLOW`.

<ParamGrid
  title="Tham số dxos_recommend_page_blueprint"
  :items="[
    { name: 'collectionName', type: 'string', description: 'Tên collection cần phân tích; tự suy luận từ portalSlug nếu bỏ trống.' },
    { name: 'portalSlug', type: 'string', description: 'Slug portal hiện tại.' },
    { name: 'pageTitle', type: 'string', description: 'Tiêu đề trang cần dò collection.' },
    { name: 'targetRole', type: 'string', default: 'ldx_employee', description: 'Vai trò mục tiêu để điều chỉnh pipeline và chủ đề giao diện.' },
    { name: 'goal', type: 'string', description: 'Mô tả mục tiêu nghiệp vụ cần tối ưu giao diện.' }
  ]"
/>

### `dxos_design_creative_block`

Tổng hợp và gắn khối `DxosCreativeStudioBlockModel` (hỗ trợ 5 theme và 11 loại widget như `gauge`, `thermometer`, `rule-callout`, `stage-pipeline`, `distribution-bars`, `quick-actions`) từ đặc tả DSL hoặc mô tả ngôn ngữ tự nhiên. Hỗ trợ đặt song song 2 cột `[12, 12]` cạnh một khối hiện có qua `placeBesideTitle`. Mặc định `ASK`; tự động chụp Time-Machine snapshot trước khi ghi và kiểm tra an toàn đường dẫn cục bộ.

<ParamGrid
  title="Tham số dxos_design_creative_block"
  :items="[
    { name: 'portalSlug', type: 'string', required: true, description: 'Slug cổng mục tiêu.' },
    { name: 'pageTitle', type: 'string', description: 'Tiêu đề trang trong portal.' },
    { name: 'blockUid', type: 'string', description: 'UID khối Creative hiện có nếu cần cập nhật.' },
    { name: 'placeBesideBlockUid', type: 'string', description: 'UID khối đứng cạnh trong hàng 2 cột [12, 12].' },
    { name: 'placeBesideTitle', type: 'string', description: 'Tên hoặc gợi ý tiếng Việt của khối cần đặt cạnh (ví dụ Chỉ số).' },
    { name: 'collectionName', type: 'string', description: 'Collection nguồn truy vấn cho khối.' },
    { name: 'title', type: 'string', description: 'Tiêu đề hiển thị của khối.' },
    { name: 'theme', type: 'string', description: 'Một trong: industrial-cockpit, emerald-ops, amber-alert, royal-indigo, clean-light.' },
    { name: 'goal', type: 'string', description: 'Mô tả chỉ số, ngưỡng cảnh báo và nút thao tác nhanh.' },
    { name: 'blueprint', type: 'object', description: 'Đặc tả Creative DSL tường minh ({ title, subtitle, badge, theme, columns, queries, widgets }).' },
    { name: 'blueprintJson', type: 'string', description: 'Chuỗi JSON của Creative DSL (tối đa 8000 ký tự).' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Xem trước blueprint mà không ghi DB.' }
  ]"
/>

### `dxos_snapshot_or_rollback_page`

Chụp, liệt kê và khôi phục bố cục trang từ `latticeUiSnapshots`. Mặc định `ASK`; chặn hoàn tác chéo tổ chức (`DXOS_ORG_MISMATCH`) trừ tài khoản `root`.

<ParamGrid
  title="Tham số dxos_snapshot_or_rollback_page"
  :items="[
    { name: 'action', type: 'string', required: true, description: 'Thao tác: snapshot, listSnapshots hoặc rollback.' },
    { name: 'portalSlug', type: 'string', required: true, description: 'Slug cổng mục tiêu.' },
    { name: 'pageTitle', type: 'string', description: 'Tiêu đề trang lọc snapshot.' },
    { name: 'snapshotUid', type: 'string', description: 'UID snapshot cụ thể cần khôi phục (mặc định chọn bản mới nhất nếu bỏ trống).' },
    { name: 'note', type: 'string', description: 'Ghi chú khi chụp snapshot thủ công.' }
  ]"
/>

### `dxos_provision_role_workspace`

Công cụ điều phối hai chế độ: dựng một vai trò + trang + trợ lý AI mới (`operation: "provision_role_workspace"`) hoặc điều hành toàn bộ vòng đời App Builder 2.0 (`plan_enterprise_app`, `build_enterprise_app`, `patch_enterprise_app`, `rollback_enterprise_app`, `verify_app`, `list_built_apps`, `rebuild_enterprise_app`, `export_app_bundle`, `teardown_built_app`). Mặc định `ASK`; tham số chi tiết xem tại [App Builder 2.0](/ai/app-builder).

<ParamGrid
  title="Tham số Cốt lõi của dxos_provision_role_workspace"
  :items="[
    { name: 'operation', type: 'string', default: 'provision_role_workspace', description: '10 thao tác: provision_role_workspace cùng 9 thao tác App Builder 2.0.' },
    { name: 'appKey', type: 'string', description: 'Khóa ứng dụng cho các thao tác plan/patch/rollback/verify/rebuild/export/teardown.' },
    { name: 'collections', type: 'array<object>', description: 'Danh sách bảng latticeCustom* đa thực thể (sắp xếp topo Kahn).' },
    { name: 'roles', type: 'array<object>', description: 'Danh sách vai trò ldx_* và trường khóa.' },
    { name: 'portals', type: 'array<object>', description: 'Cấu hình trang /p/<portalSlug> và các Native v2 BlockModels.' },
    { name: 'patch', type: 'object', description: 'Bản vá tăng dần cho plan_enterprise_app / patch_enterprise_app.' },
    { name: 'prompt', type: 'string', description: 'Mô tả tự nhiên cho kế hoạch hoặc bản vá (tối đa 2000 ký tự).' },
    { name: 'targetVersion', type: 'integer', description: 'Phiên bản mục tiêu khi gọi rollback_enterprise_app.' },
    { name: 'keepData', type: 'boolean', default: 'true', description: 'Bảo toàn bảng/dữ liệu khi teardown_built_app.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Chạy thử không ghi DB.' }
  ]"
/>

## Nhóm 4: Công cụ Vận hành & HITL (6 công cụ · `adminOnly: false`)

Tất cả 6 công cụ dưới đây áp dụng kiểm tra quyền đọc/ghi theo `dataSourcesRolesResources` của vai trò người gọi, giới hạn hàng thuộc quyền sở hữu (`ownOnlySet`) và phạm vi `organizationId`.

### `dxos_search_enterprise_context`

Tìm kiếm lai (Hybrid RRF) trên các collection nghiệp vụ (`latticeOrders`, `latticeRequests`, `latticeServiceTickets`, `latticeIncidentCases`, `latticeAssets`, `latticeParaDocuments`), collection tùy chỉnh `latticeCustom*`, phân mảnh tài liệu P.A.R.A. (`latticeParaChunks`) và bộ nhớ bền vững (`scope: "ai_memory"`). Mặc định `ALLOW`; không cho phép non-admin truy vấn `agent` memory hoặc giả mạo `agentId`.

<ParamGrid
  title="Tham số dxos_search_enterprise_context"
  :items="[
    { name: 'query', type: 'string', description: 'Từ khóa tìm kiếm (tối đa 120 ký tự).' },
    { name: 'collections', type: 'array<string>', description: 'Tập con các collection nghiệp vụ hoặc latticeCustom*.' },
    { name: 'scope', type: 'string', description: 'Đặt ai_memory để tìm trực tiếp trong latticeAiMemory.' },
    { name: 'scopes', type: 'array<string>', description: 'Danh sách phạm vi bộ nhớ khi scope=ai_memory (org, user, session, hoặc agent với admin).' },
    { name: 'memoryScope', type: 'string', description: 'Phạm vi bộ nhớ đơn lẻ.' },
    { name: 'agentId', type: 'string', description: 'Định danh agent (chỉ admin được chỉ định agentId khác).' },
    { name: 'includeMemories', type: 'boolean', description: 'Đính kèm ngữ cảnh bộ nhớ liên quan vào kết quả.' },
    { name: 'limit', type: 'integer', default: '8', description: 'Số lượng kết quả tối đa (giới hạn 1..30).' }
  ]"
/>

### `dxos_execute_record_action`

Tạo hoặc cập nhật bản ghi trong `WRITABLE_BUSINESS_COLLECTIONS` (`latticeServiceTickets`, `latticeOrders`, `latticeRequests`, `latticeParaDocuments`) hoặc `latticeCustom*`. Mặc định `ASK` (đẩy vào hàng chờ HITL `latticeAiApprovalQueue` kèm `diffPreview` và `riskLevel`); tự động loại bỏ 12 trường máy chủ được bảo vệ (`id`, `createdAt`, `updatedAt`, `organizationId`, `status`, `version`, `requesterId`, `assigneeId`, `ownerId`, `decisionReason`, `resolutionNote`, `handlerId`), kiểm tra quyền từng trường ở mức RBAC và chỉ cho phép nhân viên thường sửa bản ghi `draft` do chính mình tạo.

<ParamGrid
  title="Tham số dxos_execute_record_action"
  :items="[
    { name: 'collection', type: 'string', required: true, description: 'Tên collection thuộc WRITABLE_BUSINESS_COLLECTIONS hoặc latticeCustom*.' },
    { name: 'operation', type: 'string', required: true, description: 'Thao tác: create hoặc update.' },
    { name: 'recordId', type: 'integer', description: 'ID bản ghi bắt buộc khi operation=update.' },
    { name: 'values', type: 'object', required: true, description: 'Giá trị trường dữ liệu cần ghi (các trường bảo vệ sẽ bị tước bỏ).' },
    { name: 'requireApproval', type: 'boolean', default: 'false', description: 'Ép buộc đưa vào hàng chờ phê duyệt HITL ngay cả khi hồ sơ đặt ALLOW.' }
  ]"
/>

### `dxos_my_workflow_tasks`

Liệt kê, phân tích hoặc nộp các tác vụ thủ công (`workflowManualTasks`) đang chờ (`status: 0`) được giao cho chính người gọi. Mặc định `ASK`; chặn xử lý tác vụ của người khác (`403 TASK_NOT_ASSIGNED_TO_CALLER`) và chặn tự phê duyệt hồ sơ do chính mình khởi tạo (`403 SELF_APPROVAL_FORBIDDEN`).

<ParamGrid
  title="Tham số dxos_my_workflow_tasks"
  :items="[
    { name: 'action', type: 'string', required: true, description: 'Một trong: list, analyze, submit.' },
    { name: 'taskId', type: 'integer', description: 'ID tác vụ bắt buộc khi action=submit.' },
    { name: 'formKey', type: 'string', default: 'review', description: 'Khóa biểu mẫu khi nộp tác vụ.' },
    { name: 'decision', type: 'string', default: 'approve', description: 'Kết quả xử lý tác vụ.' },
    { name: 'note', type: 'string', description: 'Ghi chú đính kèm khi nộp.' }
  ]"
/>

### `dxos_orchestrate_enterprise_case`

Thực hiện radar điểm nghẽn toàn tổ chức (`radar`), đối soát liên thông tài sản/SOP/sự cố/phiếu (`correlateCase`), hoặc tạo chuỗi bản ghi liên thông (`executeCoordinatedResponse`) gồm hồ sơ chính, phiếu dịch vụ `latticeServiceTickets` và ghi chú bàn giao `latticeParaDocuments`. Mặc định `ASK`; mọi thao tác đọc/ghi đều qua kiểm tra RBAC từng collection và trường.

<ParamGrid
  title="Tham số dxos_orchestrate_enterprise_case"
  :items="[
    { name: 'mode', type: 'string', required: true, description: 'Chế độ: radar, correlateCase hoặc executeCoordinatedResponse.' },
    { name: 'query', type: 'string', description: 'Từ khóa đối soát khi chạy correlateCase.' },
    { name: 'primaryRecord', type: 'object', description: 'Đối tượng { collection, values } tạo bản ghi chính.' },
    { name: 'followUpTicket', type: 'object', description: 'Payload tạo phiếu latticeServiceTickets gắn trích dẫn hồ sơ chính.' },
    { name: 'paraHandoverNote', type: 'object', description: 'Payload tạo tài liệu bàn giao trong latticeParaDocuments.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Xem trước kế hoạch tạo chuỗi hồ sơ.' }
  ]"
/>

### `dxos_graph_impact_analysis`

Duyệt đồ thị phả hệ `latticeDataLineage` kết hợp quan hệ chuỗi lạnh (`latticeAssets`, `latticeIncidentCases`, `latticeTwinShadows`, `latticeStockLots`, `latticeOrderLines`, `latticeOrders`, `latticeEpodRecords`, `latticeParaDocuments`) theo thuật toán BFS để tính điểm tác động (`impactScore`), trích dẫn `[collection:code#id]` và chuỗi telemetry tùy chọn. Mặc định `ALLOW`; giới hạn cứng `MAX_GRAPH_DEPTH = 4` và `MAX_GRAPH_NODES = 60`, kiểm tra RBAC trên từng collection nút kề và che toàn bộ PII trước khi trả về.

<ParamGrid
  title="Tham số dxos_graph_impact_analysis"
  :items="[
    { name: 'collection', type: 'string', required: true, description: 'Collection xuất phát (không thuộc SYSTEM_PROTECTED_COLLECTIONS).' },
    { name: 'recordId', type: 'string', description: 'ID bản ghi (chuỗi hoặc số nguyên).' },
    { name: 'recordCode', type: 'string', description: 'Mã nghiệp vụ hoặc URN tài sản (urn:ngsi-ld:Asset:<org>:native:<id>).' },
    { name: 'maxDepth', type: 'integer', default: '2', description: 'Độ sâu duyệt đồ thị, giới hạn trong khoảng 1..4.' },
    { name: 'includeTelemetry', type: 'boolean', default: 'false', description: 'Đính kèm tối đa 20 điểm đo từ latticeTelemetryPoints nếu được quyền đọc.' }
  ]"
/>

### `dxos_alarm_action`

Xác nhận tiếp nhận (`ack`) hoặc đóng (`clear`) cảnh báo đang mở trong `latticeIncidentCases`. Mặc định `ASK`; thực thi qua `ai-hitl-executors.js`, kiểm tra quyền `update` trên `latticeIncidentCases` và ghi chú đóng/tiếp nhận tối đa 255 ký tự.

<ParamGrid
  title="Tham số dxos_alarm_action"
  :items="[
    { name: 'action', type: 'string', required: true, description: 'Hành động: ack hoặc clear.' },
    { name: 'alarmId', type: 'integer', description: 'ID số của cảnh báo trong latticeIncidentCases.' },
    { name: 'alarmCode', type: 'string', description: 'Mã cảnh báo tùy chọn (INC-... hoặc ALM-...).' },
    { name: 'assetEntityId', type: 'string', description: 'URN/ID tài sản liên quan.' },
    { name: 'note', type: 'string', description: 'Ghi chú xử lý hoặc đóng cảnh báo.' },
    { name: 'requireApproval', type: 'boolean', default: 'false', description: 'Bắt buộc đẩy qua hàng chờ phê duyệt HITL.' }
  ]"
/>

## Nhóm 5: Bộ nhớ Bền vững Tác nhân (3 công cụ · `adminOnly: false`)

Toàn bộ bộ nhớ được phân vùng chặt chẽ theo `organizationId` và 4 phạm vi (`org`, `agent`, `user`, `session`). Chỉ quản trị viên được phép ghi/xóa bộ nhớ `org` hoặc truy cập/ghi/xóa bộ nhớ `agent` (`403 MEMORY_ORG_WRITE_FORBIDDEN` / `403 MEMORY_AGENT_FORBIDDEN`). Kết quả truy hồi luôn được bọc trong thẻ dữ liệu tham khảo `<dxos_memory_context advisory="true">` kèm lọc ký tự chèn thẻ để chống prompt injection.

### `dxos_memory_remember`

Lưu hoặc cập nhật (upsert theo `memoryKey` trong cùng phân vùng) một sự kiện hoặc quy ước dài hạn vào `latticeAiMemory`. Mặc định `ALLOW`.

<ParamGrid
  title="Tham số dxos_memory_remember"
  :items="[
    { name: 'scope', type: 'string', default: 'org', description: 'Phân vùng lưu: org, agent, user hoặc session.' },
    { name: 'memoryKey', type: 'string', required: true, description: 'Khóa logic ổn định dùng cho upsert và tra cứu (tối đa 200 ký tự).' },
    { name: 'content', type: 'string', required: true, description: 'Nội dung sự kiện cần ghi nhớ (tối đa 8000 ký tự).' },
    { name: 'tags', type: 'array<string>', description: 'Thẻ phân loại phục vụ tìm kiếm (tối đa 32 thẻ).' },
    { name: 'metadata', type: 'object', description: 'Siêu dữ liệu JSON bổ sung.' },
    { name: 'importance', type: 'number', default: '0.5', description: 'Trọng số quan trọng trong khoảng [0, 1].' },
    { name: 'source', type: 'string', default: 'agent', description: 'Nhãn nguồn gốc bản ghi (tối đa 120 ký tự).' },
    { name: 'expiresAt', type: 'string', description: 'Mốc hết hạn ISO-8601 tùy chọn.' },
    { name: 'ttlSeconds', type: 'integer', description: 'Thời gian sống tính bằng giây kể từ hiện tại.' },
    { name: 'agentId', type: 'string', description: 'Định danh tác nhân khi scope=agent.' },
    { name: 'sessionId', type: 'string', description: 'Định danh phiên khi scope=session.' }
  ]"
/>

### `dxos_memory_recall`

Truy hồi các bản ghi bộ nhớ còn hiệu lực được xếp hạng theo công thức kết hợp TF-IDF cosine, độ khớp từ khóa, độ trùng thẻ, trọng số `importance` và độ mới (half-life 30 ngày). Mặc định `ALLOW`.

<ParamGrid
  title="Tham số dxos_memory_recall"
  :items="[
    { name: 'query', type: 'string', description: 'Văn bản truy vấn tìm kiếm (tối đa 1000 ký tự).' },
    { name: 'scope', type: 'string', description: 'Một phạm vi đơn lẻ: org, agent, user hoặc session.' },
    { name: 'scopes', type: 'array<string>', description: 'Nhiều phạm vi hợp lệ cần tìm đồng thời.' },
    { name: 'tags', type: 'array<string>', description: 'Lọc theo danh sách thẻ.' },
    { name: 'limit', type: 'integer', default: '8', description: 'Số lượng kết quả tối đa (1..50).' },
    { name: 'minScore', type: 'number', description: 'Ngưỡng điểm tối thiểu trong [0, 1].' },
    { name: 'agentId', type: 'string', description: 'Định danh tác nhân khi tìm phạm vi agent.' },
    { name: 'sessionId', type: 'string', description: 'Định danh phiên khi tìm phạm vi session.' }
  ]"
/>

### `dxos_memory_forget`

Xóa bản ghi bộ nhớ theo `id` hoặc `memoryKey` đúng trong tổ chức và phân vùng được phép. Mặc định `ASK`.

<ParamGrid
  title="Tham số dxos_memory_forget"
  :items="[
    { name: 'id', type: 'integer', description: 'ID số của bản ghi trong latticeAiMemory.' },
    { name: 'memoryKey', type: 'string', description: 'Khóa logic của bản ghi cần xóa.' },
    { name: 'scope', type: 'string', default: 'org', description: 'Phân vùng bộ nhớ: org, agent, user hoặc session.' },
    { name: 'agentId', type: 'string', description: 'Định danh tác nhân khi scope=agent.' },
    { name: 'sessionId', type: 'string', description: 'Định danh phiên khi scope=session.' }
  ]"
/>

## Nhóm 6: 4 Công cụ IT/OT MCP Chuyên biệt (`/api/dxos-mcp/it-ot`)

Bốn công cụ này được phục vụ riêng qua endpoint MCP IT/OT (`mcp-itot-tools.js`) để kết nối dữ liệu thực tế từ FIWARE Orion-LD, Keycloak, `n8n` và hàng đợi outbox NGSI-LD.

### `get_live_ngsi_telemetry`

Truy vấn thực thể NGSI-LD trực tiếp từ FIWARE Orion-LD (`/ngsi-ld/v1/entities?local=true&limit=50`) được lọc chặt theo `actor.organizationId`, tự động chuyển sang chế độ suy giảm an toàn (`degraded: true`) kèm danh sách tài sản cache trong `latticeAssets` và số lượng `pendingOutboxCount` nếu Orion-LD ngoại tuyến. `adminOnly: false`, mặc định `ALLOW`.

<ParamGrid
  title="Tham số get_live_ngsi_telemetry"
  :items="[
    { name: 'assetCode', type: 'string', description: 'Bộ lọc mã tài sản tùy chọn (tối đa 80 ký tự).' }
  ]"
/>

### `get_sensor_and_incident_timeline`

Trả về dòng thời gian các ca sự cố `latticeIncidentCases` và đề xuất AI `latticeAgentProposals` trong tổ chức, yêu cầu quyền đọc RBAC trên ít nhất một trong hai collection. `adminOnly: false`, mặc định `ALLOW`.

<ParamGrid
  title="Tham số get_sensor_and_incident_timeline"
  :items="[
    { name: 'assetEntityId', type: 'string', description: 'Lọc sự cố theo URN/ID tài sản (tối đa 140 ký tự).' },
    { name: 'limit', type: 'integer', default: '10', description: 'Số lượng bản ghi tối đa mỗi danh sách (1..25).' }
  ]"
/>

### `get_stack_connector_health`

Kiểm tra sức khỏe trực tiếp với timeout 5 giây tới Orion-LD (`/version`), Stock `n8n` (`/healthz`), Keycloak (`/realms/lattice`) và kết nối database NocoBase. `adminOnly: true`, mặc định `ALLOW`, không có tham số đầu vào.

### `dispatch_itot_webhook_or_sync`

Đẩy bản ghi đồng bộ lại vào hàng đợi `latticeContextOutbox` (`requeue_outbox`) hoặc kích hoạt webhook `n8n` được phép (`trigger_n8n`) kèm khóa chống trùng lặp `Idempotency-Key`. `adminOnly: false`, mặc định `ASK`, giới hạn chỉ cho phép `root`, `admin`, `ldx_admin`, `ldx_manager` và `ldx_dispatcher` (`403 ITOT_DISPATCH_FORBIDDEN`).

<ParamGrid
  title="Tham số dispatch_itot_webhook_or_sync"
  :items="[
    { name: 'mode', type: 'string', required: true, description: 'Chế độ: requeue_outbox hoặc trigger_n8n.' },
    { name: 'entityId', type: 'string', description: 'URN NGSI-LD mục tiêu (tối đa 140 ký tự).' },
    { name: 'webhookSlug', type: 'string', default: 'dxos-itot-event', description: 'Slug webhook n8n khớp ^[a-z0-9][a-z0-9-]{1,60}$.' },
    { name: 'reason', type: 'string', required: true, description: 'Lý do kích hoạt đồng bộ hoặc webhook (tối đa 300 ký tự).' },
    { name: 'idempotencyKey', type: 'string', description: 'Khóa idempotency tùy chọn (tự sinh nếu bỏ trống).' }
  ]"
/>

## Hàng rào Bảo vệ Chung

| Cơ chế bảo vệ | Phạm vi áp dụng | Hành vi chặn |
| :--- | :--- | :--- |
| `SYSTEM_PROTECTED_COLLECTIONS` | Toàn bộ công cụ sửa schema, RBAC, GraphRAG | Từ chối `403` với 41 bảng lõi (`users`, `roles`, `apiKeys`, `latticeAiAuditLogs`, `latticeAiProfiles`, `latticeBuiltApps`, `latticeCryptoLedger`, v.v.). |
| `PROTECTED_SERVER_FIELDS` | `dxos_execute_record_action` | Tước bỏ 12 trường máy chủ (`id`, `organizationId`, `status`, `version`, `requesterId`, `ownerId`, v.v.) trước khi ghi DB. |
| `latticeAiApprovalQueue` (HITL) | Các công cụ ở chế độ `ASK` | Lưu `proposedArgs` và `diffPreview`, chờ người có thẩm quyền khác phê duyệt qua `dxosAi:approveAction` (cấm tự duyệt). |
| `validateMcpServerUrl` | Kết nối MCP và `trigger_n8n` | Chặn SSRF vào địa chỉ metadata, IP riêng tư ngoài danh sách cho phép của stack và ép `https://` cho endpoint ngoài. |

## Tài liệu liên quan

- [Tổng quan AI Studio & 7 Hồ sơ Tác nhân](/ai/overview-and-profiles)
- [Cổng Giao thức MCP](/ai/mcp-gateway)
- [App Builder 2.0](/ai/app-builder)
- [Đánh giá & Hàng rào Bảo vệ AI](/ai/eval-and-guardrails)
