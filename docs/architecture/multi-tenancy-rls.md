---
title: Kiến trúc Đa Tenant & PostgreSQL 16 FORCE RLS
description: Cơ chế cô lập đa tenant fail-closed với biến phiên app.current_org và app.rls_bypass, cầu nối AsyncLocalStorage, role nocobase_app và danh mục đủ 56 bảng tĩnh FORCE RLS.
---

# Kiến trúc Đa Tenant & PostgreSQL 16 FORCE RLS

LatticeDX `v0.4.2` thực thi cô lập dữ liệu đa tổ chức theo mô hình phòng thủ nhiều lớp, kết hợp middleware kiểm soát phạm vi ở tầng ứng dụng (`createNativeScopeMiddleware`) với chính sách `ENABLE ROW LEVEL SECURITY` và `FORCE ROW LEVEL SECURITY` tại lõi PostgreSQL `16`. Ngay cả khi một truy vấn ORM bỏ qua điều kiện lọc `organizationId`, PostgreSQL vẫn chặn triệt để mọi thao tác đọc hoặc ghi chéo tổ chức.

<ZeroTrustRlsDiagram />

## Hợp đồng Biến Phiên GUC (`app.current_org` & `app.rls_bypass`)

Toàn bộ hàm phiên và policy SQL trong `plugins/nocobase/plugin-lattice-foundation/src/server/pg-rls.js` sử dụng cặp biến cấu hình phiên cục bộ (GUC) **`app.current_org`** và **`app.rls_bypass`**. Khi biến môi trường `DX_PG_RLS_SESSION=true` được kích hoạt (mặc định bật trong `infra/compose/prod.yml`), mọi thao tác dữ liệu theo tenant đều đi qua giao dịch gắn GUC cục bộ.

<ParamGrid
  title="Biến Cấu hình & Ngữ cảnh Phiên RLS (pg-rls.js & prod.yml)"
  :items="[
    { name: 'DX_PG_RLS_SESSION', type: 'boolean (env)', required: true, default: 'true', description: 'Bật kích hoạt phiên RLS PostgreSQL theo từng transaction trong plugin-lattice-foundation.' },
    { name: 'app.current_org', type: 'PostgreSQL GUC', required: true, default: '(trống)', description: 'Định danh tổ chức hiện hành, gán cục bộ bằng set_config(\'app.current_org\', :orgId, true). Khớp mẫu ^[a-zA-Z0-9_-]{1,80}$.' },
    { name: 'app.rls_bypass', type: 'PostgreSQL GUC', required: false, default: 'off', description: 'Đặt bằng \'on\' trong transaction hệ thống có kiểm soát (xác thực đăng nhập, seed, hoặc phiên root).' },
    { name: 'NOCOBASE_APP_DB_USER', type: 'PostgreSQL Role', required: true, default: 'nocobase_app', description: 'Role vận hành runtime non-superuser mang thuộc tính NOBYPASSRLS, tách biệt hoàn toàn với POSTGRES_USER.' },
    { name: 'DX_DEFAULT_ORG_ID', type: 'string (env)', required: false, default: '1', description: 'Giá trị tổ chức dự phòng cho triển khai đơn tổ chức khi tác nhân chưa gắn nhánh riêng.' }
  ]"
/>

| Cơ chế | Quy tắc thực thi |
| :--- | :--- |
| Phạm vi Transaction-Local (`is_local = true`) | Hàm `setTransactionRlsOrg` chạy `SELECT set_config('app.current_org', :orgId, true)`. Tham số thứ ba là `true` buộc PostgreSQL tự động xóa giá trị GUC ngay khi giao dịch `COMMIT` hoặc `ROLLBACK`, triệt tiêu rủi ro rò rỉ ngữ cảnh tenant khi kết nối quay lại connection pool. |
| Kiểm tra hợp lệ định danh (`assertValidOrganizationId`) | Chỉ chấp nhận chuỗi khớp `^[a-zA-Z0-9_-]{1,80}$` và từ chối chuỗi rỗng, giá trị `'all'`, cũng như các khóa nguy hiểm (`__proto__`, `constructor`, `prototype`). |
| Hành vi Fail-Closed mặc định | Nếu truy vấn chạy ngoài ngữ cảnh RLS (khi `app.current_org` chưa gán hoặc rỗng), biểu thức `nullif(current_setting('app.current_org', true), '')` trả về `NULL`. Vì phép so sánh `"organizationId" = NULL` luôn cho kết quả `UNKNOWN`, PostgreSQL trả về `0` bản ghi khi đọc và từ chối ghi qua mệnh đề `WITH CHECK`. |

## Tách Quyền Role Non-Superuser `nocobase_app`

Theo cơ chế mặc định của PostgreSQL, superuser hoặc role sở hữu bảng có thể vượt qua RLS thông thường nếu không cấu hình chặt chẽ. Để chính sách `FORCE ROW LEVEL SECURITY` luôn có hiệu lực bất kể bảng do ứng dụng sở hữu, tập lệnh khởi tạo `infra/config/postgres/init-nocobase-db.sh` tách biệt tài khoản quản trị PostgreSQL (`POSTGRES_USER`) khỏi role runtime `nocobase_app`:

- Tạo `nocobase_app` với đủ 5 cờ hạn chế: `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`.
- Từ chối khởi tạo nếu `NOCOBASE_APP_DB_USER` trùng với `POSTGRES_USER`.
- Thu hồi quyền mặc định từ `PUBLIC` trên database `nocobase` và schema `public`, chỉ cấp quyền sở hữu schema cho `nocobase_app` để chạy migration mà vẫn chịu ràng buộc `FORCE RLS` ở mọi truy vấn runtime.
- Trên cụm cơ sở dữ liệu nền tảng (`infra/config/postgres/init-prod.sh`), các role `lattice_app`, `keycloak_app` và `n8n_app` cũng được tạo theo cùng chuẩn `NOSUPERUSER NOBYPASSRLS`.

## Policy `lattice_tenant_isolation` & Savepoint An toàn

Hàm `buildRlsPolicySql(tableName, options)` sinh DDL đồng nhất cho mọi bảng tĩnh và bảng động. Đối với 54 bảng camelCase, cột định danh là `"organizationId"`; đối với 2 bảng đính kèm tệp dùng quy ước snake_case (`SNAKE_CASE_ORG_TABLES`), cột định danh là `"organization_id"`.

<CodeTabs
  :tabs="[
    {
      label: 'Policy camelCase (SQL)',
      lang: 'sql',
      code: 'ALTER TABLE public.\x22latticeOrders\x22 ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.\x22latticeOrders\x22 FORCE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS lattice_tenant_isolation ON public.\x22latticeOrders\x22;\nCREATE POLICY lattice_tenant_isolation ON public.\x22latticeOrders\x22\n  AS PERMISSIVE FOR ALL TO PUBLIC\n  USING (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organizationId\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  )\n  WITH CHECK (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organizationId\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  );'
    },
    {
      label: 'Policy snake_case (SQL)',
      lang: 'sql',
      code: 'ALTER TABLE public.\x22lattice_native_request_attachments\x22 ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.\x22lattice_native_request_attachments\x22 FORCE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS lattice_tenant_isolation ON public.\x22lattice_native_request_attachments\x22;\nCREATE POLICY lattice_tenant_isolation ON public.\x22lattice_native_request_attachments\x22\n  AS PERMISSIVE FOR ALL TO PUBLIC\n  USING (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organization_id\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  )\n  WITH CHECK (\n    current_setting(\'app.rls_bypass\', true) = \'on\'\n    OR current_setting(\'app.current_org\', true) = \'*\'\n    OR \x22organization_id\x22 = nullif(current_setting(\'app.current_org\', true), \'\')\n  );'
    },
    {
      label: 'Khởi tạo Role nocobase_app (SQL)',
      lang: 'sql',
      code: 'CREATE ROLE nocobase_app LOGIN PASSWORD \'<secret>\'\n  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\n\nALTER DATABASE \x22nocobase\x22 OWNER TO \x22nocobase_app\x22;\nREVOKE ALL ON DATABASE \x22nocobase\x22 FROM PUBLIC;\nGRANT ALL PRIVILEGES ON DATABASE \x22nocobase\x22 TO \x22nocobase_app\x22;\nALTER SCHEMA public OWNER TO \x22nocobase_app\x22;\nREVOKE CREATE ON SCHEMA public FROM PUBLIC;\nGRANT ALL ON SCHEMA public TO \x22nocobase_app\x22;'
    }
  ]"
/>

Khi một truy vấn phụ hoặc thao tác tùy chọn xảy ra lỗi bên trong transaction RLS đang mở, PostgreSQL mặc định đưa toàn bộ transaction vào trạng thái lỗi (`25P02`). Hàm `runInRlsSavepoint(db, fn)` bọc thao tác đó bằng `SAVEPOINT "ldx_sp_<n>"` và `ROLLBACK TO SAVEPOINT` / `RELEASE SAVEPOINT` để bảo toàn phiên làm việc đang chạy.

## Cầu nối Giao dịch `AsyncLocalStorage`

Trong NocoBase `2.2.50`, nhiều lời gọi `Repository` nội bộ hoặc hook ORM không truyền tường minh tham số `{ transaction }`. Tệp `pg-rls.js` thiết lập cầu nối `AsyncLocalStorage` (`rlsStore`) kết hợp `installRlsTransactionBridge(db)`:

| Bước / Thành phần | Cơ chế hoạt động |
| :--- | :--- |
| Khởi tạo ngữ cảnh transaction | `withTenantRlsContext(db, organizationId, fn)` mở một Sequelize transaction, gọi `set_config('app.current_org', :orgId, true)`, rồi chạy callback bên trong `rlsStore.run({ sequelize, transaction, organizationId }, ...)`. |
| Tự động tiêm `{ transaction }` | `wrapRepositoryMethods` bọc các phương thức `find`, `findOne`, `findAndCount`, `count`, `create`, `update`, `destroy`, `query` trên `Repository.prototype` (đánh dấu bằng `RLS_BRIDGE_MARKER = Symbol.for('latticedx.pgRlsBridgeInstalled')`), cùng `sequelize.query` và `db.getRepository()`. Mọi lời gọi lồng nhau nếu chưa có `transaction` riêng sẽ tự động nhận `store.transaction` khi khớp `sequelize` instance. |
| Thuộc tính không liệt kê (`non-enumerable`) | `setContextRlsTransaction(ctx, transaction)` gắn transaction vào `ctx.state.latticeRlsTransaction` với `enumerable: false`. Nhờ vậy, cơ chế `createContextVariablesScope` của NocoBase `2.2.50` khi gọi `JSON.stringify(ctx.state)` không vấp phải lỗi tham chiếu vòng trong đối tượng Sequelize `Transaction`. |
| System Bypass có kiểm soát (`withSystemRlsBypass`) | Chỉ sử dụng cho bước tra cứu danh tính trước khi xác định được tổ chức (như `resolveNativeActor` đọc `latticeEmployees` trong `native-scope.js`, xác thực khóa `ldx_pat_*` trong `paas-api-keys.js`, hoặc phiên quản trị `root`). Khi chạy lồng trong một transaction đã mở, `native-scope.js` đọc `SELECT current_setting('app.rls_bypass', true) AS prev`, bật `'on'` tạm thời và khôi phục lại giá trị `prev` trong khối `finally`. |

<CodeTabs
  :tabs="[
    {
      label: 'withTenantRlsContext (JS)',
      lang: 'javascript',
      code: 'async function withTenantRlsContext(db, organizationId, fn) {\n  assertValidOrganizationId(organizationId);\n  const sequelize = db?.sequelize;\n  return sequelize.transaction(async (transaction) => {\n    await setTransactionRlsOrg(db, organizationId, transaction);\n    return rlsStore.run({ sequelize, transaction, organizationId }, () => fn(transaction));\n  });\n}'
    },
    {
      label: 'withSystemRlsBypass (JS)',
      lang: 'javascript',
      code: 'async function withSystemRlsBypass(db, fn) {\n  const sequelize = db?.sequelize;\n  const existing = rlsStore.getStore();\n  if (existing?.systemRlsBypass === true && existing.transaction && existing.sequelize === sequelize) {\n    return fn(existing.transaction);\n  }\n  return sequelize.transaction(async (transaction) => {\n    await setTransactionRlsBypass(db, transaction);\n    return rlsStore.run({ sequelize, transaction, systemRlsBypass: true }, () => fn(transaction));\n  });\n}'
    }
  ]"
/>

## Danh mục Đầy đủ 56 Bảng Tĩnh & Bảng Động `^latticeCustom.*`

Mảng `TENANT_RLS_TABLES` trong `pg-rls.js` bảo vệ **56 bảng tĩnh** (gồm **54 bảng camelCase** dùng cột `organizationId` và **2 bảng snake_case** dùng cột `organization_id`).

### 54 Bảng Tĩnh camelCase (`organizationId`)

| # | Tên bảng | Nhóm nghiệp vụ | # | Tên bảng | Nhóm nghiệp vụ |
| :---: | :--- | :--- | :---: | :--- | :--- |
| `1` | `latticeRequests` | Yêu cầu & Quy trình lõi | `28` | `latticeDataQuarantine` | Quản trị Dữ liệu |
| `2` | `latticeOrders` | Đơn hàng OMS/WMS | `29` | `latticeOrderLines` | Đơn hàng OMS/WMS |
| `3` | `latticeAssets` | Tài sản & Thiết bị | `30` | `latticeStockLots` | Kho vận FEFO |
| `4` | `latticeEmployees` | Nhân sự & Tổ chức | `31` | `latticeEpodRecords` | Giao nhận ePOD |
| `5` | `latticeDepartments` | Nhân sự & Tổ chức | `32` | `latticeDecisionTables` | Visual DMN |
| `6` | `latticeLocations` | Nhân sự & Tổ chức | `33` | `latticeDelegations` | Ủy quyền Phê duyệt |
| `7` | `latticeIncidentCases` | Quản lý Sự cố | `34` | `latticeTwinShadows` | IIoT Digital Twin |
| `8` | `latticeIncidentRules` | Quản lý Sự cố | `35` | `latticeConnectors` | Connector Vault |
| `9` | `latticeAgentProposals` | Đề xuất AI HITL | `36` | `latticeEventBus` | Event Bus Outbox |
| `10` | `latticeContextOutbox` | NGSI-LD Outbox | `37` | `latticeWebhookSubscriptions` | Event Bus Webhook |
| `11` | `latticeIntegrationInbox` | Tích hợp Inbound | `38` | `latticeWebhookDeliveries` | Event Bus Delivery |
| `12` | `latticeRecordChatter` | Nhật ký Thảo luận | `39` | `latticeIotDevices` | Thiết bị IIoT |
| `13` | `latticeNotifications` | Thông báo In-App | `40` | `latticeBrokerSubscriptions` | Orion-LD Broker |
| `14` | `latticeSlaPolicies` | Chính sách SLA | `41` | `latticeAutomationRules` | LatticeFlow v2 |
| `15` | `latticeParaDocuments` | P.A.R.A. Vault | `42` | `latticeAutomationRuns` | LatticeFlow v2 |
| `16` | `latticeParaChunks` | Hybrid RAG Chunks | `43` | `latticeBuiltApps` | App Builder 2.0 |
| `17` | `latticeServiceTickets` | Dịch vụ Nội bộ | `44` | `latticeAiMemory` | Bộ nhớ AI |
| `18` | `latticeAiProfiles` | Hồ sơ AI Agent | `45` | `latticeAiTraces` | Truy vết OTel AI |
| `19` | `latticeAiAuditLogs` | Kiểm toán Công cụ AI | `46` | `latticeAutomationRuleVersions` | Phiên bản Flow |
| `20` | `latticeAiQuotaUsage` | Hạn mức AI | `47` | `latticeA2aTasks` | Giao thức A2A |
| `21` | `latticeAiApprovalQueue` | Hàng đợi HITL AI | `48` | `latticeNotificationDeliveries` | Giao nhận Thông báo |
| `22` | `latticeTelemetryPoints` | Chuỗi thời gian IIoT | `49` | `latticeApprovalPolicies` | Phê duyệt Hợp nhất |
| `23` | `latticeApiKeys` | Khóa API `ldx_pat_*` | `50` | `latticeApprovalRequests` | Phê duyệt Hợp nhất |
| `24` | `latticePkiKeys` | Khóa Ed25519 PKI | `51` | `latticePublicForms` | Biểu mẫu Công khai |
| `25` | `latticeCryptoLedger` | Sổ cái Merkle PKI | `52` | `latticePublicFormSubmissions` | Dữ liệu Biểu mẫu |
| `26` | `latticeFrozenSnapshots` | Ảnh chụp Đóng băng | `53` | `latticeAiQuotaPolicies` | Chính sách Hạn mức AI |
| `27` | `latticeDataLineage` | Phả hệ Dữ liệu | `54` | `latticeUiSnapshots` | Ảnh chụp Giao diện |

### 2 Bảng Tĩnh snake_case (`organization_id`)

| # | Tên bảng | Cột phân vùng | Vai trò |
| :---: | :--- | :--- | :--- |
| `55` | `lattice_native_request_attachments` | `organization_id` | Lưu tệp đính kèm của yêu cầu sau bước quét ClamAV |
| `56` | `lattice_native_request_uploads` | `organization_id` | Theo dõi phiên tải lên tệp nhị phân qua sidecar `file-scanner` |

### Bảng Động `^latticeCustom[A-Za-z0-9_]*$`

Mọi bảng nghiệp vụ tùy chỉnh được tạo qua `dxosBuilder:createDomain` hoặc App Builder 2.0 (khớp mẫu `^latticeCustom[A-Za-z0-9_]*$`, bao gồm cả bảng liên kết `belongsToMany` dạng `latticeCustom<Src><Tgt>Join`) đều tự động nhận cột `organizationId` không null có chỉ mục, thực thi `ENABLE` + `FORCE ROW LEVEL SECURITY` qua `domain-schema-rls.js` và kiểm tra xác nhận lại trên `pg_class` (`attachAndVerifyPgRls`). Hàm `discoverTenantRlsTables` truy vấn `information_schema.columns` để quét đồng thời cả 56 bảng tĩnh lẫn các bảng `latticeCustom*` phát sinh lúc chạy.

## Truy vấn Kiểm chứng Trực tiếp trên PostgreSQL

Quản trị viên có thể xác minh trạng thái bật `FORCE ROW LEVEL SECURITY`, biểu thức policy đang hoạt động và hành vi fail-closed của role `nocobase_app` ngay trên cơ sở dữ liệu:

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra pg_class & pg_policies (SQL)',
      lang: 'sql',
      code: '-- 1. Xác nhận toàn bộ 56+ bảng đều bật relrowsecurity và relforcerowsecurity\nSELECT c.relname AS table_name,\n       c.relrowsecurity AS rls_enabled,\n       c.relforcerowsecurity AS rls_forced\nFROM pg_class c\nJOIN pg_namespace n ON n.oid = c.relnamespace\nWHERE n.nspname = \'public\'\n  AND (c.relname LIKE \'lattice%\' OR c.relname LIKE \'lattice_%\')\nORDER BY c.relname;\n\n-- 2. Kiểm tra biểu thức policy lattice_tenant_isolation\nSELECT tablename, policyname, cmd, roles, qual, with_check\nFROM pg_policies\nWHERE schemaname = \'public\' AND policyname = \'lattice_tenant_isolation\';'
    },
    {
      label: 'Kiểm thử Cô lập Fail-Closed (SQL)',
      lang: 'sql',
      code: '-- Chạy dưới role nocobase_app\nBEGIN;\n-- Chưa gán app.current_org -> trả về 0 bản ghi\nSELECT count(*) FROM public.\x22latticeOrders\x22;\n\n-- Gán cục bộ cho tổ chức org_a -> chỉ thấy bản ghi của org_a\nSELECT set_config(\'app.current_org\', \'org_a\', true);\nSELECT id, \x22organizationId\x22 FROM public.\x22latticeOrders\x22 LIMIT 10;\nCOMMIT;'
    }
  ]"
/>

## Tài liệu liên quan

- [Mô hình Bảo mật Zero-Trust & Phân vùng Mạng](/architecture/security-model)
- [Mô hình Dữ liệu & Công thức AST An toàn](/architecture/data-model)
- [Collection Tùy chỉnh & Công thức Rich Schema](/studio/custom-collections-formulas)
- [Triển khai Production Zero-Trust](/getting-started/production-deployment)
