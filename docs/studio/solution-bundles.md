---
title: Solution Bundles v3 & GitOps
description: Đặc tả JSON schema latticedx.solution-bundle/v3, API export/diff/import/rollback có dry-run và quy trình GitOps với 43 artifact thuộc 6 nhóm trong CTU-OpenPaw/lattice-templates.
---

# Solution Bundles v3 & GitOps

Solution Bundle v3 (`latticedx.solution-bundle/v3`) định nghĩa định dạng gói cấu hình khai báo (declarative) giúp đóng gói toàn bộ không gian vận hành của một tổ chức thành một tệp JSON duy nhất có kiểm tra toàn vẹn SHA-256. Nhờ tách rời bí mật Vault khỏi cấu trúc khai báo, đội ngũ vận hành có thể lưu trữ cấu hình trên Git, kiểm tra sai lệch (`diff`), chạy thử (`dryRun`) và hoàn tác về snapshot trước khi triển khai.

## Lược đồ JSON `latticedx.solution-bundle/v3`

Module `solution-bundle.js` xuất ra tài liệu JSON theo lược đồ `latticedx.solution-bundle/v3` (trình nhập đồng thời chấp nhận `v1` và `v2` để tương thích ngược). Mỗi bundle gồm khối `metadata` và 8 khóa dữ liệu cấp cao nhất.

<ParamGrid
  title="Cấu trúc đối tượng metadata"
  :items="[
    { name: 'schemaVersion', type: 'string', required: true, default: 'latticedx.solution-bundle/v3', description: 'Định danh phiên bản lược đồ (nhập chấp nhận v1, v2, v3).' },
    { name: 'platformVersion', type: 'string', required: true, default: '0.4.2', description: 'Phiên bản nền tảng LatticeDX xuất bundle.' },
    { name: 'organizationId', type: 'string', required: true, description: 'Mã tổ chức mục tiêu hoặc all khi xuất phạm vi tổng thể.' },
    { name: 'exportedAt', type: 'string', required: true, description: 'Mốc thời gian xuất bundle chuẩn ISO-8601 UTC.' },
    { name: 'contentSha256', type: 'string', required: true, description: 'Mã băm SHA-256 hex (64 ký tự) của JSON.stringify({ roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks, governance }).' },
    { name: 'warnings', type: 'string[]', description: 'Cảnh báo tùy chọn, ví dụ nhắc cấu hình lại bí mật Vault cho connector sau khi import.' }
  ]"
/>

### 8 khóa cấu hình cấp cao nhất

| Khóa cấp cao | Kiểu dữ liệu | Nội dung được đóng gói và quy tắc kiểm tra |
| :--- | :--- | :--- |
| `roles` | `Array<object>` | Các vai trò nghiệp vụ `^ldx_[a-z0-9_]{2,48}$`, quyền resource/action và phạm vi trường; cấm `root`, `admin`, `ldx_admin`. |
| `portals` | `Array<object>` | Định nghĩa portal `^ldx-portal-[a-z0-9-]+$`, `routePath` (`/p/*`), `routeName` (`p_*`); nghiêm cấm `authCheck: false`. |
| `workflows` | `Array<object>` | Quy trình LatticeFlow và nút DAG (`validateWorkflowNodesDag`); mặc định nhập ở trạng thái tắt trừ khi đặt `enableWorkflows: true`. |
| `aiProfiles` | `Array<object>` | Hồ sơ AI Agent (`username`, `systemPrompt`, `tools`, `toolPermissions` với giá trị `ALLOW`, `ASK` hoặc `OFF`). |
| `customCollections` | `Array<object>` | Các bảng `^latticeCustom[A-Z][A-Za-z0-9]{1,40}$`, 12 kiểu trường, rule Thompson NFA, công thức AST và tự động gắn PG16 RLS. |
| `connectors` | `Array<object>` | Danh sách kết nối ngoài đã loại bỏ hoàn toàn bí mật (`SECRET_KEY_RE`); bản ghi mới tạo đặt `active: false` cho đến khi nạp lại bí mật. |
| `routesAndBlocks` | `object` | Gồm `{ routes, flowModels }`; tuyến được sắp xếp topo trước khi ghi, model phải thuộc `ALLOWED_FLOW_MODEL_USES` và không ghi đè layout hệ thống. |
| `governance` | `object` | Gồm `{ decisionTables, slaPolicies, incidentRules, automationRules, webhookSubscriptions }` gắn theo `organizationId`. |

<CodeTabs
  :tabs="[
    {
      label: 'coldchain-starter-bundle.v3.json',
      lang: 'json',
      code: '{\n  &quot;metadata&quot;: {\n    &quot;schemaVersion&quot;: &quot;latticedx.solution-bundle/v3&quot;,\n    &quot;platformVersion&quot;: &quot;0.4.2&quot;,\n    &quot;organizationId&quot;: &quot;org-coldchain-starter&quot;,\n    &quot;exportedAt&quot;: &quot;2026-11-26T14:55:00.000Z&quot;,\n    &quot;contentSha256&quot;: &quot;91eaddda971760c81b2c2c6d140a79e7fd9b79413388050f4ac9fb6f3e8f19d0&quot;\n  },\n  &quot;roles&quot;: [{ &quot;name&quot;: &quot;ldx_operator&quot;, &quot;allowAll&quot;: false, &quot;allowConfigure&quot;: false }],\n  &quot;portals&quot;: [],\n  &quot;workflows&quot;: [],\n  &quot;aiProfiles&quot;: [],\n  &quot;customCollections&quot;: [{ &quot;name&quot;: &quot;latticeCustomColdLotLogs&quot;, &quot;fields&quot;: [] }],\n  &quot;connectors&quot;: [],\n  &quot;routesAndBlocks&quot;: { &quot;routes&quot;: [], &quot;flowModels&quot;: [] },\n  &quot;governance&quot;: {\n    &quot;decisionTables&quot;: [],\n    &quot;slaPolicies&quot;: [],\n    &quot;incidentRules&quot;: [],\n    &quot;automationRules&quot;: [],\n    &quot;webhookSubscriptions&quot;: []\n  }\n}'
    },
    {
      label: 'Tính contentSha256 (Node.js)',
      lang: 'js',
      code: 'import { createHash } from \'node:crypto\';\nfunction computeBundleSha256(bundle) {\n  const canonicalPayload = JSON.stringify({\n    roles: bundle.roles,\n    portals: bundle.portals,\n    workflows: bundle.workflows,\n    aiProfiles: bundle.aiProfiles,\n    customCollections: bundle.customCollections,\n    connectors: bundle.connectors,\n    routesAndBlocks: bundle.routesAndBlocks,\n    governance: bundle.governance,\n  });\n  return createHash(\'sha256\').update(canonicalPayload).digest(\'hex\');\n}'
    }
  ]"
/>

## Cơ chế lọc bí mật và kiểm tra an toàn

Trước khi xuất hoặc so sánh (`diff`), hàm `stripSecretsDeep` duyệt sâu tối đa `48` cấp và loại bỏ toàn bộ khóa khớp `SECRET_KEY_RE` (`password`, `secret`, `token`, `apikey`, `api_key`, `privatekey`, `authorization`, `cookie`). Trình xác thực `validateSolutionBundle` thực thi các lớp bảo vệ sau:

| Lớp kiểm tra | Quy tắc bảo vệ trong `validateSolutionBundle` |
| :--- | :--- |
| Giới hạn kích thước và cấu trúc | Tổng dung lượng JSON không vượt quá `5.000.000` byte (`5 MB`), không có tham chiếu vòng và không chứa khóa `__proto__`, `constructor`, `prototype` (tối đa 32 cấp). |
| Chặn leo thang đặc quyền | Từ chối vai trò `root`, `admin`, `ldx_admin`, chặn snippet chứa `*`, `!`, `pm.*`, `acl.*`, `app.*`, `ui.*`, và buộc các công cụ builder trên `aiProfiles` phải gắn cờ `isAdminBuilder: true`. |
| Chặn mã thực thi và XSS | Cấm các khóa thuộc `UNSAFE_CODE_KEY_RE` (`jsCode`, `script`, `customScript`, `evalCode`, `innerHTML`, `jsSettings`, `scriptSettings`) cùng các chuỗi `<script>`, `<iframe>`, `javascript:`, `vbscript:`, thuộc tính `on*=`. |
| Kiểm tra SSRF và tenant | Mọi `targetUrl` trong `governance.webhookSubscriptions` phải vượt qua `validateSafeWebhookTargetUrl`; mọi bản ghi `connectors` hoặc `governance` có `organizationId` khác với tenant đang nhập đều bị từ chối với HTTP `403 DXOS_ORG_MISMATCH`. |

## API Export, Diff, Dry-Run Import và Rollback

Bốn endpoint quản trị thuộc `dxosStudio` (`studio-resource.js`) điều khiển toàn bộ vòng đời GitOps cho bundle:

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleExport"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Xuất cấu hình hiện hành của tổ chức thành gói latticedx.solution-bundle/v3 kèm mã băm contentSha256 (hỗ trợ cả GET)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleDiff"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Kiểm tra tính hợp lệ của bundle đầu vào và trả về báo cáo sai lệch added, changed, unchanged, removed theo từng mục."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleImport"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Mặc định dryRun=true chỉ kiểm tra và xuất diff; khi dryRun=false sẽ lưu snapshot trước khi áp dụng giao dịch vào DB."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleRollback"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Khôi phục cấu hình về snapshot gần nhất hoặc theo snapshotUid từ latticeUiSnapshots với cơ chế đối soát xóa (reconcileV3Deletions)."
/>

Khi gọi `solutionBundleImport` với `dryRun: false`, máy chủ tự động chụp lại trạng thái hiện hành vào bảng `latticeUiSnapshots` dưới `portalSlug: '__gitops_bundle__'` và sinh định danh `snapshotUid` (dạng `gitops-<ts36>-<rand4>`). Trong quá trình hoàn tác (`solutionBundleRollback`), cờ `reconcileV3Deletions: true` đối soát và gỡ bỏ các tuyến, flow model hoặc quy tắc governance mới phát sinh ngoài snapshot mà không chạm vào layout hệ thống (`admin-layout-model`, `mobile-layout-model`).

<CodeTabs
  :tabs="[
    {
      label: 'Quy trình Diff -> Dry-Run -> Apply (cURL)',
      lang: 'bash',
      code: '# 1. Kiểm tra sai lệch (Diff)\ncurl -s -X POST &quot;https://localhost:8443/api/dxosStudio:solutionBundleDiff&quot; \\\n  -H &quot;Authorization: Bearer $TOKEN&quot; -H &quot;Content-Type: application/json&quot; \\\n  -d \'{&quot;organizationId&quot;:&quot;org-a&quot;,&quot;bundle&quot;:...}\'\n\n# 2. Chạy thử (dryRun mặc định là true)\ncurl -s -X POST &quot;https://localhost:8443/api/dxosStudio:solutionBundleImport&quot; \\\n  -H &quot;Authorization: Bearer $TOKEN&quot; -H &quot;Content-Type: application/json&quot; \\\n  -d \'{&quot;organizationId&quot;:&quot;org-a&quot;,&quot;dryRun&quot;:true,&quot;bundle&quot;:...}\'\n\n# 3. Áp dụng và nhận snapshotUid để sẵn sàng rollback\ncurl -s -X POST &quot;https://localhost:8443/api/dxosStudio:solutionBundleImport&quot; \\\n  -H &quot;Authorization: Bearer $TOKEN&quot; -H &quot;Content-Type: application/json&quot; \\\n  -d \'{&quot;organizationId&quot;:&quot;org-a&quot;,&quot;dryRun&quot;:false,&quot;enableWorkflows&quot;:false,&quot;bundle&quot;:...}\''
    },
    {
      label: 'Phản hồi Import & Rollback',
      lang: 'json',
      code: '{\n  &quot;dryRun&quot;: false,\n  &quot;valid&quot;: true,\n  &quot;warnings&quot;: [],\n  &quot;snapshotUid&quot;: &quot;gitops-m8x2a1-9f3c&quot;,\n  &quot;diff&quot;: { &quot;customCollections&quot;: { &quot;added&quot;: [&quot;latticeCustomColdLotLogs&quot;], &quot;changed&quot;: [], &quot;unchanged&quot;: [], &quot;removed&quot;: [] } },\n  &quot;applied&quot;: { &quot;rolesUpserted&quot;: 2, &quot;customCollectionsUpserted&quot;: 1, &quot;decisionTablesUpserted&quot;: 1 }\n}'
    }
  ]"
/>

## Quy trình GitOps với `CTU-OpenPaw/lattice-templates`

Kho lưu trữ `CTU-OpenPaw/lattice-templates` cung cấp 43 tệp JSON mẫu thuộc 6 nhóm danh mục, phát hành theo giấy phép Apache-2.0 và khóa phiên bản `0.4.2`:

| Danh mục | Số lượng | Nội dung chính |
| :--- | :---: | :--- |
| `latticeflow-blueprints/` | 8 | Các luồng DAG v2 (`coldchain-emergency`, `mkt-quarantine`, `procurement-hitl-approval`, `sla-escalation`, v.v.). |
| `n8n-workflows/` | 10 | Quy trình đồng bộ n8n (`active: false`, không chứa ID thông tin xác thực thật). |
| `dmn-tables/` | 4 | 3 bảng quyết định DMN (`cold_chain_approval_v1`, `cmms_priority_routing_v1`, `coldchain_settlement_policy_v1`) và 1 bộ `sample-evaluations.json` (12 ca thử). |
| `business-packs/` | 16 | 2 Business Packs, 5 manifests, 4 workflow templates, 3 App Builder suites và 2 solutions. |
| `public-forms/` | 4 | Mẫu biểu mẫu công khai `/v/form/:slug` (`partner-intake`, `coldchain-incident-report`, `customer-service-ticket`, `order-inquiry`). |
| `solution-bundles/` | 1 | Gói khởi tạo `coldchain-starter-bundle.v3.json` kèm `metadata.contentSha256` hợp lệ. |

Trước khi đưa thay đổi vào nhánh chính hoặc nhập vào môi trường vận hành, pipeline CI chạy bộ kiểm tra không phụ thuộc ngoài `scripts/validate-templates.mjs` trên Node.js 24:

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra cục bộ qua CLI',
      lang: 'bash',
      code: 'git clone https://github.com/CTU-OpenPaw/lattice-templates.git\ncd lattice-templates\nnode --check scripts/validate-templates.mjs\nnpm run validate'
    },
    {
      label: 'Kết quả PASS từ validator',
      lang: 'json',
      code: '{\n  &quot;result&quot;: &quot;PASS&quot;,\n  &quot;platformVersion&quot;: &quot;0.4.2&quot;,\n  &quot;stats&quot;: { &quot;governanceFilesChecked&quot;: 9, &quot;jsonFilesParsed&quot;: 44 },\n  &quot;errorCount&quot;: 0,\n  &quot;errors&quot;: []\n}'
    }
  ]"
/>

## Lưu ý vận hành

- Khi nhập bundle chứa `connectors`, hệ thống luôn đặt `active: false` cho connector mới tạo để nhắc người quản trị nạp lại bí mật hoặc xác thực OAuth2 PKCE trong Connector Vault.
- Trường hợp `solutionBundleImport` phát hiện bất kỳ lỗi kiểm tra schema hoặc xung đột tổ chức nào trong giao dịch, toàn bộ thay đổi được hoàn tác tự động ở mức PostgreSQL transaction mà không để lại trạng thái nửa vời.

## Tài liệu liên quan

- [Custom Collections & Safe AST Formulas](/studio/custom-collections-formulas)
- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [Công cụ quyết định Visual DMN](/automation/visual-dmn)
- [Biểu mẫu công khai /v/form/:slug](/studio/public-forms)
