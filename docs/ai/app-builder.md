---
title: App Builder 2.0
description: Vòng đời khởi tạo, lập kế hoạch dry-run, nâng cấp tăng dần, hoàn tác phiên bản và gỡ bỏ an toàn ứng dụng doanh nghiệp đa thực thể trong LatticeDX.
---

<script setup>
const appBuilderTabs = [
  {
    label: 'Plan Dry-Run (POST)',
    lang: 'bash',
    code: `curl -X POST "https://app.example.com/api/dxosAi:planBuiltApp" \\
  -H "Authorization: Bearer <ADMIN_JWT_OR_PAT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Quản lý phòng khám đa khoa gồm bệnh nhân, phiếu khám và đơn thuốc"
  }'`,
  },
  {
    label: 'Patch Tăng dần (JSON)',
    lang: 'json',
    code: `{
  "appKey": "clinic-suite",
  "summary": "Thêm trường BHYT và biểu đồ doanh thu",
  "patch": {
    "addFields": [
      {
        "collectionName": "latticeCustomClinicPatients",
        "name": "insuranceCode",
        "type": "string",
        "title": "Mã BHYT",
        "unique": true
      }
    ],
    "addBlocks": [
      {
        "portalSlug": "clinic-ops",
        "blockUse": "DxosBiChartBlockModel",
        "title": "Tổng phí khám theo trạng thái",
        "collection": "latticeCustomClinicVisits",
        "chartType": "bar",
        "groupBy": "status",
        "metricOp": "sum",
        "metricField": "feeVnd"
      }
    ]
  }
}`,
  },
  {
    label: 'Safe Teardown (JSON)',
    lang: 'json',
    code: `{
  "appKey": "clinic-suite",
  "keepData": true
}`,
  },
];
</script>

# App Builder 2.0

App Builder 2.0 (`app-builder-planner.js` và `app-builder-orchestrator.js`) cho phép quản trị viên và tác nhân `dxos-architect` thiết kế, dựng mới, cập nhật tăng dần và hoàn tác trọn bộ một phân hệ nghiệp vụ đa thực thể trên LatticeDX. Thay vì chỉ sinh mã nguồn tĩnh, hệ thống quản lý trạng thái triển khai sống trong `latticeBuiltApps` kèm lịch sử phiên bản (`versionHistoryJson`) và snapshot giao diện (`latticeUiSnapshots`), đồng bộ xuyên suốt từ schema PostgreSQL `FORCE ROW LEVEL SECURITY` đến cổng `/p/<portalSlug>`, phân quyền RBAC, DMN, LatticeFlow v2 và Stock `n8n`.

Mọi thao tác App Builder 2.0 đều yêu cầu quyền quản trị (`root` hoặc `admin`), khóa chặt phạm vi tạo bảng vào tiền tố `latticeCustom*` và từ chối mọi can thiệp lên `SYSTEM_PROTECTED_COLLECTIONS`.

## Vòng đời 5 Giai đoạn (`plan -> build -> patch -> rollback -> safe teardown`)

```text
[Prompt / Spec]
      │
      ▼
  1. PLAN (dry-run) ──► buildErGraph (Kahn) + computeSpecDiff (0 ghi DB)
      │
      ▼
  2. BUILD          ──► Snapshot UI -> DDL + FORCE RLS -> RBAC -> Portal 12 Blocks -> AI/DMN/Flow/n8n -> Verify + Self-Heal (max 2 vòng)
      │
      ▼
  3. PATCH          ──► Plan Diff -> Pre-Patch Snapshot -> Ngừng trường an toàn (không DROP) -> Rebuild + Verify (tăng version)
      │
      ▼
  4. ROLLBACK       ──► Pre-Rollback Snapshot -> Khôi phục sourceSpecJson & UI Snapshot -> Ngừng rule/trường sau targetVersion -> Verify
      │
      ▼
  5. SAFE TEARDOWN  ──► Quét chéo tenant/app -> Vô hiệu Flow/DMN/AI/n8n -> Giữ dữ liệu (keepData=true) hoặc xóa ngược topo
```

### 1. Lập kế hoạch Dry-Run (`planEnterpriseApp`)

Giai đoạn lập kế hoạch không thực hiện bất kỳ lệnh ghi nào vào cơ sở dữ liệu (`built: false`, `dryRun: true`). Đầu vào có thể là đặc tả JSON đầy đủ (`collections`, `roles`, `portals`, `dmnTables`, `flowGraphs`), bản vá từng phần (`patch`), hoặc mô tả ngôn ngữ tự nhiên (`prompt`) được phân tích bởi `buildDraftSpecFromNaturalPrompt` và `parseNaturalAppPlanOrPatch`.

Bộ lập kế hoạch trả về hai cấu trúc kiểm tra trước khi triển khai:

- **Đồ thị thực thể-quan hệ (`buildErGraph`):** Tính thứ tự khởi tạo các bảng bằng thuật toán sắp xếp topo Kahn (`topologicalSortCollections`), đảm bảo bảng cha trong quan hệ `belongsTo` luôn được tạo trước bảng con, đồng thời phát hiện và chặn vòng lặp quan hệ (`BLUEPRINT_CYCLE_DETECTED`, HTTP `400`).
- **Bảng chênh lệch 8 thành phần (`computeSpecDiff`):** Tính danh sách `added`, `modified`, `removed` cho `collections`, `fields`, `relations`, `roles`, `pages`, `blocks`, `flows` và `dmnTables` kèm chuỗi tóm tắt `diff.summary`.

### 2. Dựng Trọn gói & Tự sửa lỗi (`orchestrateEnterpriseAppBuild`)

Khi xác nhận dựng ứng dụng, orchestrator thực hiện tuần tự 8 bước:

| Bước | Hàm thực thi | Nhiệm vụ chi tiết |
| :---: | :--- | :--- |
| `1` | `capturePortalsSnapshots` | Chụp bố cục hiện tại của các portal mục tiêu vào `latticeUiSnapshots`. |
| `2` | `ensureCollectionAndFields` | Tạo các bảng `latticeCustom*` theo thứ tự topo Kahn, sinh bảng trung gian `belongsToMany`, gắn `ENABLE` + `FORCE ROW LEVEL SECURITY` và đăng ký hook công thức Safe AST / regex Thompson NFA. |
| `3` | `ensureRoleAndRbac` | Tạo vai trò `ldx_*` (hoặc sinh slug từ `roleTitle`), cấp quyền `view`/`create`/`update`/`destroy` và loại bỏ `lockedFields` khỏi danh sách trường được phép ghi. |
| `4` | `ensurePortalAndBlocks` | Tạo trang trên `/p/<portalSlug>` và gắn các khối được phép trong `ORCHESTRATOR_ALLOWED_BLOCKS` (`DxosPortalHeroBlockModel`, `DxosRecordWorkbenchBlockModel`, `DxosKanbanScheduleBlockModel`, `DxosWebGisBlockModel`, `DxosBiChartBlockModel`, `DxosCreativeStudioBlockModel`, v.v.). |
| `5` | Gắn trợ lý AI riêng | Tạo hồ sơ AI non-admin gán cho vai trò mới và đồng bộ sang `aiEmployees`. |
| `6` | Cấu hình DMN, Flow & n8n | Lưu bảng quyết định vào `latticeDecisionTables`, đồ thị DAG vào `latticeAutomationRules` và tạo/kích hoạt workflow `n8n` (chạy ngoài giao dịch DB). |
| `7` | `verifyEnterpriseApp` | Chạy bộ kiểm tra trạng thái thực tế của collection, RLS, metadata trường, RBAC, portal UI, DMN, Flow v2 và n8n. |
| `8` | `applyTargetedRepair` | Nếu bước kiểm chứng có mục thất bại mang cờ `repairable: true`, hệ thống chạy tối đa `DEFAULT_SELF_HEAL_MAX_ROUNDS = 2` vòng sửa tự động (`ensure_collection`, `attach_rls`, `reload_collection`, `repair_rbac`, `repair_portal_ui`, `repair_dmn`, `repair_flow`, `activate_n8n`) trước khi ghi trạng thái `active` hoặc `needs_review` vào `latticeBuiltApps`. |

### 3. Cập nhật Tăng dần (`patchEnterpriseApp`)

Thay vì xóa và dựng lại từ đầu, `patchEnterpriseApp` đọc `sourceSpecJson` hiện tại, hợp nhất với `patch` (`addCollections`, `addFields`, `updateFields`, `deprecateFields`, `addRelations`, `addBlocks`, `removeBlocks`, `addRoles`, `addFlows`, `addDmnTables`) hoặc `prompt` chỉnh sửa, chạy `planEnterpriseApp` để tính diff, lưu trạng thái hiện tại vào `versionHistoryJson`, và chạy lại orchestrator.

Đối với `deprecateFields`, hệ thống tuyệt đối không chạy `ALTER TABLE ... DROP COLUMN`. Thay vào đó, trường được đánh dấu `deprecated: true`, `deprecatedAt`, `'x-hidden': true` và `readOnly: true` trong `uiSchema` và `options` để bảo toàn dữ liệu lịch sử.

### 4. Hoàn tác Phiên bản (`rollbackEnterpriseApp`)

Quản trị viên có thể hoàn tác ứng dụng về `targetVersion` bất kỳ trong `versionHistoryJson` (hoặc snapshot gần nhất nếu bỏ trống `targetVersion`):

1. Chụp snapshot pre-rollback của phiên bản hiện tại vào `versionHistoryJson`.
2. Đánh dấu ngừng sử dụng (không hủy cột vật lý) đối với các trường được thêm sau `targetVersion`.
3. Khôi phục schema, gắn lại hook `rich-schema` và đồng bộ lại phân quyền RBAC.
4. Gọi `restorePageSnapshot` giới hạn đúng danh sách `blockUids` thuộc ứng dụng và gỡ bỏ các block phát sinh sau `targetVersion`.
5. Khôi phục các bảng DMN và quy trình Flow v2 mục tiêu, đồng thời đặt `active: false` cho các quy tắc phát sinh sau `targetVersion`.
6. Chạy lại `verifyEnterpriseApp` và tăng `version` của bản ghi `latticeBuiltApps`.

### 5. Gỡ bỏ An toàn (`teardownBuiltApp`)

Thao tác gỡ bỏ được thiết kế theo nguyên tắc bảo toàn dữ liệu mặc định (`keepData = true`) và an toàn đa tenant:

| Giai đoạn gỡ bỏ | Cơ chế thực thi |
| :--- | :--- |
| Quét sở hữu chéo trước khi xóa | Truy vấn toàn bộ `latticeBuiltApps` thông qua `withOptionalSystemRls` để xác định `sharedCollections`, `sharedRoles` và `sharedPortalPages` đang được ứng dụng hoặc tenant khác sử dụng, đồng thời bảo vệ danh sách `BUILTIN_PROTECTED_ROLES` (`root`, `admin`, `ldx_admin`, `ldx_manager`, `ldx_employee`, `ldx_operator`, v.v.). |
| Vô hiệu hóa thành phần chạy nền | Gỡ block khỏi `flowModels`, xóa route riêng không chia sẻ, đặt `active: false` cho Flow v2/DMN, đặt `enabled: false` cho trợ lý AI tùy chỉnh và tắt workflow Stock `n8n` ngoài transaction. |
| Xử lý dữ liệu khi `keepData = false` | Kiểm tra SQL `SELECT EXISTS (SELECT 1 FROM "<table>" WHERE "organizationId" IS DISTINCT FROM :organizationId)`. Nếu bảng dùng chung hoặc còn dữ liệu của tenant khác, hệ thống chỉ xóa bản ghi thuộc `organizationId` hiện tại; nếu bảng độc quyền, hệ thống `DROP TABLE` theo thứ tự ngược topo (bảng trung gian và bảng con trước bảng cha). |

## Tham số Đặc tả & Bản vá

<ParamGrid
  title="Tham số Chính của App Builder 2.0 (build / plan / patch)"
  :items="[
    { name: 'appKey', type: 'string', description: 'Định danh ứng dụng trong latticeBuiltApps (tối đa 120 ký tự); bắt buộc với patch, rollback, rebuild, teardown.' },
    { name: 'prompt', type: 'string', description: 'Mô tả nghiệp vụ hoặc yêu cầu chỉnh sửa bằng tiếng Việt/tiếng Anh (tối đa 2000 ký tự).' },
    { name: 'collections', type: 'array<object>', description: 'Danh sách bảng latticeCustom* kèm fields (12 kiểu trường + belongsTo/hasMany/hasOne/belongsToMany/formula).' },
    { name: 'roles', type: 'array<object>', description: 'Danh sách vai trò ldx_* cần cấp quyền và lockedFields tương ứng.' },
    { name: 'portals', type: 'array<object>', description: 'Cấu hình cổng /p/<portalSlug>, pageTitle, creativeTheme và danh sách 12 Native v2 BlockModels.' },
    { name: 'dmnTables', type: 'array<object>', description: 'Các bảng quyết định DMN (tableKey, hitPolicy, inputsJson, outputsJson, rulesJson).' },
    { name: 'flowGraphs', type: 'array<object>', description: 'Các quy trình LatticeFlow v2 DAG (ruleKey, name, cooldownSec, graphJson).' },
    { name: 'patch', type: 'object', description: 'Gói thay đổi tăng dần (addCollections, addFields, updateFields, deprecateFields, addRelations, addBlocks, removeBlocks, addRoles, addFlows, addDmnTables).' },
    { name: 'targetVersion', type: 'integer', description: 'Số phiên bản mục tiêu khi thực hiện rollbackBuiltApp.' },
    { name: 'keepData', type: 'boolean', default: 'true', description: 'Giữ nguyên bảng và dữ liệu khi teardownBuiltApp nếu true.' },
    { name: 'maxHealRounds', type: 'integer', default: '2', description: 'Số vòng tự sửa lỗi tối đa sau bước verifyEnterpriseApp.' }
  ]"
/>

## API Điều phối App Builder 2.0

Toàn bộ vòng đời được cung cấp song song qua resource `dxosAi` và công cụ `dxos_provision_role_workspace` (các giá trị `operation`: `plan_enterprise_app`, `build_enterprise_app`, `patch_enterprise_app`, `rollback_enterprise_app`, `verify_app`, `list_built_apps`, `rebuild_enterprise_app`, `export_app_bundle`, `teardown_built_app`).

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:planBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Lập kế hoạch dry-run (0 ghi DB), trả về đồ thị ER topo Kahn và bảng chênh lệch 8 hạng mục."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:buildBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Triển khai trọn gói ứng dụng đa thực thể kèm kiểm chứng tự động và tối đa 2 vòng self-healing."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:patchBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Cập nhật tăng dần ứng dụng đã dựng, lưu snapshot pre-patch và kiểm chứng lại trạng thái."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:rollbackBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Hoàn tác schema metadata, phân quyền, giao diện block, DMN và Flow v2 về targetVersion."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listBuiltApps"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Liệt kê các ứng dụng đã dựng thuộc tổ chức (lọc tùy chọn theo status: active, needs_review, torndown)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listBuiltAppVersions"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Truy xuất lịch sử phiên bản và snapshot trong versionHistoryJson của một appKey."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:rebuildBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Dựng lại toàn bộ ứng dụng từ sourceSpecJson kết hợp specPatch tùy chọn."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:exportBuiltAppBundle"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Xuất đặc tả Solution Bundle v3 giới hạn đúng các artifact thuộc appKey kèm contentSha256."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:teardownBuiltApp"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Gỡ bỏ an toàn các thành phần ứng dụng; mặc định keepData=true và bảo vệ dữ liệu dùng chung."
/>

<CodeTabs :tabs="appBuilderTabs" />

## Tài liệu liên quan

- [Tổng quan AI Studio & 7 Hồ sơ Tác nhân](/ai/overview-and-profiles)
- [20 Công cụ Hợp nhất & 4 Công cụ IT/OT](/ai/unified-tools)
- [Collection Tùy chỉnh & Công thức Safe AST](/studio/custom-collections-formulas)
- [Gói Giải pháp Solution Bundle v3](/studio/solution-bundles)
