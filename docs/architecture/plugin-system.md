---
title: Kiến trúc Hệ thống 7 Plugin & Hợp đồng Host
description: Danh mục 7 plugin Apache-2.0 @latticedx/*, 31 tài nguyên API, hợp đồng sdkProvidedByHost, nocobase-externals.mjs và vòng đời hook trên NocoBase 2.2.50.
---

# Kiến trúc Hệ thống 7 Plugin & Hợp đồng Host

Toàn bộ phần mở rộng nghiệp vụ và kỹ thuật của LatticeDX `v0.4.2` được đóng gói thành **7 plugin NocoBase độc lập** dưới thư mục `plugins/nocobase/*`. Thiết kế này giữ kho mã nguồn Apache-2.0 tách rời hoàn toàn khỏi mã nguồn host NocoBase: runtime `nocobase/nocobase:2.2.50` chạy dưới dạng container OCI ngoài và nạp cả 7 gói qua cơ chế `sdkProvidedByHost: true`.

<PluginHostDiagram />

## Danh mục 7 Plugin `@latticedx/*` (`0.4.2`)

Tất cả 7 package đều khai báo `"version": "0.4.2"`, `"private": true`, `"license": "Apache-2.0"`, `"supportedVersions": ["2.2.x"]`, `"testedRuntime": "2.2.50"` và `"sdkProvidedByHost": true`, kèm tệp `LICENSE` và `README.md` riêng.

| # | Thư mục nguồn (`plugins/nocobase/`) | Package (`package.json`) | Entrypoint Server & Client | Cơ chế Build & Phụ thuộc ngoài |
| :---: | :--- | :--- | :--- | :--- |
| `1` | `action-bridge/` | `@latticedx/plugin-action-bridge` | `server.cjs`, `client.js`, `client-v2.js` | `build.mjs` sao chép `src/` sang `dist/` và sinh `dist/externalVersion.js` cho `@nocobase/server`, `@nocobase/client`, `@nocobase/client-v2` |
| `2` | `plugin-lattice-foundation/` | `@latticedx/plugin-lattice-foundation` | `dist/server/index.js` (`LatticeFoundationPlugin`), `client.js`, `client-v2.js` | `scripts/build.mjs` kiểm tra cú pháp bằng `node --check`, đóng gói module nội bộ cho `client`/`client-v2`, khai báo external cho SDK NocoBase, `react`, `antd` |
| `3` | `plugin-enterprise-auth/` | `@latticedx/plugin-enterprise-auth` | `dist/server/index.js` (`EnterpriseLoginPlugin`), `client.js`, `client-v2.js` | Đóng gói sẵn `openid-client@6.8.9` (`bundleDependencies`); đặt external `@nocobase/server`, `@nocobase/auth`, `@nocobase/plugin-auth`, `@nocobase/client`, `@nocobase/client-v2`, `react`, `antd` |
| `4` | `plugin-dxos-para/` | `@latticedx/plugin-dxos-para` | `dist/server/index.js` (`DxosParaPlugin`), `client.js`, `client-v2.js` | `build.mjs` sao chép `src/` sang `dist/`; trích xuất PDF/Office và tìm kiếm kết hợp `pgvector` HNSW + `tsvector` RRF trực tiếp qua `@nocobase/database` |
| `5` | `plugin-dxos-blocks/` | `@latticedx/plugin-dxos-blocks` | `dist/server/index.js` (`DxosBlocksServerPlugin`), `client.js`, `client-v2.js` | Dùng `esbuild@0.28.2` đóng gói `maplibre-gl@6.19.0` (kèm CSS và Web Worker) thành bundle UMD; đăng ký 12 `BlockModel`s và tài nguyên `dxosBlocks`, `dxosBroker` |
| `6` | `plugin-dxos-studio/` | `@latticedx/plugin-dxos-studio` | `dist/server/index.js` (`DxosStudioPlugin`), `client.js`, `client-v2.js` | Dùng `esbuild@0.28.2` đóng gói `@xyflow/react@12.12.1` và `@dagrejs/dagre@3.1.3` thành bundle UMD cho LatticeFlow v2, Visual DMN, WMS, Rich Schema và cầu nối `n8n` |
| `7` | `plugin-dxos-ai/` | `@latticedx/plugin-dxos-ai` | `dist/server/index.js` (`DxosAiPlugin`), `client.js`, `client-v2.js` | `build.mjs` đóng gói module client nội bộ; đăng ký 7 AI Profiles, 20 Unified Tools, cổng Streamable HTTP MCP, A2A Gateway và bộ lập lịch proactive triage |

### Phân bổ 31 Tài nguyên `resourceManager` & Gateway Routes

Toàn bộ API nội bộ của nền tảng được đăng ký qua `this.app.resourceManager.define(...)` hoặc `Gateway.registerRequestHandler(...)` theo đúng ranh giới từng plugin:

| Plugin sở hữu | Tài nguyên `resourceManager.define` | Tuyến Gateway / Middleware đặc biệt |
| :--- | :--- | :--- |
| **`plugin-action-bridge`** | `dxActions` (`13` actions) | Proxy PKCE phía máy chủ cho `/lattice/*` (trả `503` an toàn nếu thiếu `DX_BRIDGE_*`) |
| **`plugin-lattice-foundation`** | `dxos`, `dxosApiKeys`, `dxosLedger`, `dxosDataGov`, `dxosVault`, `dxosEvents`, `dxosApprovals`, `dxosNotify`, `dxosForms`, `latticeNative`, `latticeApps`, `latticePortals`, `latticeChatter`, `latticeVoucher`, `latticeNotifications`, `latticeSla`, `latticeContextSync`, `latticeIntegrations` | `Gateway.registerRequestHandler`: `/v/form/*`, `/v/track/*`, `/v/lattice-brand.svg`, `/v/mobile` |
| **`plugin-enterprise-auth`** | `enterpriseAuth` (`9` actions) | Authenticator `lattice-keycloak` + middleware `enterpriseAuthRevocationGuard` |
| **`plugin-dxos-para`** | `latticePara` (`6` actions) | Middleware phạm vi P.A.R.A. + tác vụ `runAfterCommit` đồng bộ vector chunk |
| **`plugin-dxos-blocks`** | `dxosBlocks` (`17` actions), `dxosBroker` (`10` actions) | `dxosTelemetryDirectGuard` chặn CRUD trực tiếp vào `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices` |
| **`plugin-dxos-studio`** | `dxosStudio`, `dxosWms`, `dxosDmn`, `dxosDelegations`, `dxosAutomations`, `dxosBuilder`, `dxosN8n` | 4 guard middleware (`dxosServiceScope`, `dxosWmsDmnScope`, `dxosAutomationScope`, `dxosOrganizationScope`) |
| **`plugin-dxos-ai`** | `dxosAi` (Trợ lý AI, App Builder 2.0, Eval Lab, `surfaceEvents`) | `POST /api/dxos-mcp`, `POST /api/dxos-mcp/it-ot`, `GET /.well-known/agent-card.json`, `POST /api/dxos-a2a` |

## Hợp đồng `sdkProvidedByHost: true` & `nocobase-externals.mjs`

Thay vì cài đặt `@nocobase/*` vào `node_modules` trong kho mã nguồn, mỗi plugin khai báo các gói lõi của NocoBase và thư viện UI dùng chung là external. Khi container `nocobase/nocobase:2.2.50` khởi động, host tự cung cấp các gói này từ runtime của chính nó theo đúng phiên bản đang chạy.

<ParamGrid
  title="Cấu hình External & Phiên bản Host (scripts/lib/nocobase-externals.mjs)"
  :items="[
    { name: 'DEFAULT_NOCOBASE_VERSION', type: 'string', required: true, default: '2.2.50', description: 'Phiên bản host mặc định dùng khi sinh dist/externalVersion.js nếu không đặt biến NOCOBASE_VERSION.' },
    { name: 'NOCOBASE_VERSION', type: 'env (SemVer)', required: false, default: '2.2.50', description: 'Biến môi trường ghi đè phiên bản đích, được kiểm tra nghiêm ngặt bằng biểu thức SEMVER_RE trước khi phát sinh mã.' },
    { name: 'NOCOBASE_EXTERNAL_NAMES', type: 'string[7]', required: true, default: '2.2.50', description: '@nocobase/server, @nocobase/auth, @nocobase/plugin-auth, @nocobase/database, @nocobase/client, @nocobase/client-v2, @nocobase/plugin-workflow.' },
    { name: 'SHARED_VENDOR_VERSIONS', type: 'object', required: true, default: '18.2.0 / 5.24.2', description: 'Các thư viện frontend chia sẻ từ host: react (18.2.0), react-dom (18.2.0) và antd (5.24.2).' }
  ]"
/>

Hàm `externalVersionSource(names, options)` trong `scripts/lib/nocobase-externals.mjs` kiểm tra từng tên gói nằm trong danh sách cho phép (`Object.hasOwn(versions, name)`), từ chối bất kỳ phụ thuộc chưa xác minh nào, rồi ghi tệp `dist/externalVersion.js` mang header `SPDX-License-Identifier: Apache-2.0`.

<CodeTabs
  :tabs="[
    {
      label: 'package.json (manifest)',
      lang: 'json',
      code: '{\n  \x22name\x22: \x22@latticedx/plugin-lattice-foundation\x22,\n  \x22version\x22: \x220.4.2\x22,\n  \x22private\x22: true,\n  \x22license\x22: \x22Apache-2.0\x22,\n  \x22main\x22: \x22dist/server/index.js\x22,\n  \x22nocobase\x22: {\n    \x22supportedVersions\x22: [\x222.2.x\x22],\n    \x22testedRuntime\x22: \x222.2.50\x22,\n    \x22sdkProvidedByHost\x22: true\n  }\n}'
    },
    {
      label: 'dist/externalVersion.js (output)',
      lang: 'javascript',
      code: '// SPDX-License-Identifier: Apache-2.0\nmodule.exports = {\n  \x22@nocobase/server\x22: \x222.2.50\x22,\n  \x22@nocobase/database\x22: \x222.2.50\x22,\n  \x22@nocobase/client\x22: \x222.2.50\x22,\n  \x22@nocobase/client-v2\x22: \x222.2.50\x22,\n  \x22@nocobase/plugin-workflow\x22: \x222.2.50\x22,\n  \x22react\x22: \x2218.2.0\x22,\n  \x22react-dom\x22: \x2218.2.0\x22,\n  \x22antd\x22: \x225.24.2\x22\n};'
    },
    {
      label: 'nocobase-externals.mjs',
      lang: 'javascript',
      code: 'export const DEFAULT_NOCOBASE_VERSION = \x222.2.50\x22;\nconst SEMVER_RE = /^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$/;\n\nexport function externalVersionSource(names, { version = resolveNocoBaseVersion() } = {}) {\n  if (!SEMVER_RE.test(String(version))) throw new Error(\x22Invalid NOCOBASE_VERSION\x22);\n  const declared = {};\n  for (const name of names) {\n    if (!Object.hasOwn(versions, name)) throw Error(\x22Unverified host dependency: \x22 + name);\n    declared[name] = versions[name];\n  }\n  return \x22// SPDX-License-Identifier: Apache-2.0\\nmodule.exports = \x22 + JSON.stringify(declared, null, 2) + \x22;\\n\x22;\n}'
    }
  ]"
/>

## Vòng đời Plugin (`Plugin` Lifecycle Hooks) & Thứ tự Middleware

Mỗi plugin kế thừa lớp `Plugin` từ `@nocobase/server` và triển khai các hook vòng đời theo từng giai đoạn khởi chạy, kích hoạt và thu dọn tài nguyên của ứng dụng.

| Hook vòng đời | Thời điểm kích hoạt | Hành vi chuẩn hóa trong các plugin `@latticedx/*` |
| :--- | :--- | :--- |
| **`load()`** | Khi NocoBase nạp plugin vào Koa/ResourceManager | Đăng ký collection mở rộng, gắn `this.db.attachLatticeRlsPolicy`, định nghĩa `resourceManager.define`, khai báo `acl.allow` / `acl.registerSnippet`, gắn middleware theo thứ tự ưu tiên, đăng ký `Gateway.registerRequestHandler`, lắng nghe sự kiện DB (`db.on`) và đặt lịch nền (`_delayTicker`, `_triageScheduler`). |
| **`install()`** | Lần đầu cài đặt plugin vào DB | Khởi tạo dữ liệu nền idempotent dưới `withSystemRlsBypass` (ví dụ `seedFoundation`, `ensureDefaultAiWorkforce`, `runStartupRepairs`). |
| **`afterEnable()`** | Sau khi quản trị viên bật lại plugin | Đồng bộ lại quyền vai trò (`ensureIncidentManagerGrants`), hồ sơ AI mặc định (`forceUpdate: false`) và căn chỉnh route/SLA mà không ghi đè cấu hình người dùng. |
| **`start()`** | Khi tiến trình ứng dụng khởi động hoàn tất | Chạy lại các tác vụ idempotent như `ensureIncidentManagerGrants` và `runStartupRepairs` (kết hợp thêm hook `this.app.once('afterStart', ...)`). |
| **`unload()` / `remove()` / `destroy()`** | Khi reload, tắt hoặc gỡ bỏ plugin | Dừng `eventBusDrainer`, `stopAutomationListener()` (`clearInterval`), đóng `_otelExporter.shutdown()`, dừng `_triageScheduler` và hủy đăng ký toàn bộ handler qua `Gateway.unregisterRequestHandler`. |

### Thứ tự Gắn Middleware & DB Event Hooks

Thứ tự middleware được neo tường minh bằng thuộc tính `before` và `after` để lớp xác thực, guard chống CRUD trực tiếp và lớp cô lập RLS không bao giờ chạy sai trình tự:

| Thứ tự / Mốc gắn | Thành phần đăng ký và hành vi thực thi |
| :--- | :--- |
| Trước `auth` (`before: 'auth'`) | `latticePaasApiKeyAuth` giải mã khóa `ldx_pat_*` từ `X-Lattice-API-Key` hoặc `Authorization: Bearer` và ánh xạ vào `ctx.state.currentUser` trước khi middleware phiên chuẩn kiểm tra. |
| Sau `auth` (`after: 'auth'`) | `enterpriseAuthRevocationGuard` đối chiếu danh sách thu hồi phiên `revoked:` / `revoked_sid:` trên Valkey DB `2`. |
| Sau `acl`, trước `latticeNativeScope` (`after: 'acl', before: 'latticeNativeScope'`) | Các middleware bảo vệ miền chuyên biệt (`dxosTelemetryDirectGuard`, `dxosServiceScope`, `dxosWmsDmnScope`, `dxosAutomationScope`, `dxosOrganizationScope`, `dxosAiProfileScope`, `dxosAiHitlScope`, `dxosAiMemoryAndA2aScope`) chặn mọi yêu cầu CRUD trực tiếp vào các bảng nhạy cảm trước khi `latticeNativeScope` mở transaction RLS. |
| Sau `dataWrapping`, trước `dataSource` (`before: 'dataSource', after: 'dataWrapping'`) | `dxosMcpGateway`, `dxosA2aAgentCard` và `dxosA2aGateway` xử lý trực tiếp JSON-RPC Streamable HTTP MCP và Agent Card của giao thức A2A. |
| Sự kiện DB (`this.db.on`) | `latticeServiceTickets.beforeValidate`, `WMS_DMN_COLLECTIONS` `.beforeValidate`, `latticeAiProfiles.beforeValidate` (chống leo thang quyền builder AI và chặn SSRF `mcpServers`), `roles.afterCreate` (thu hồi tự động gán vai trò mới cho Builder AI) và `llmServices.afterSave` (cập nhật dịch vụ LLM mặc định). |

### Bảng Guard Middleware & DB Event Hooks

| Thành phần / Hook | Plugin đăng ký | Vị trí & Hành vi bảo vệ |
| :--- | :--- | :--- |
| `latticePaasApiKeyAuth` | `plugin-lattice-foundation` | `before: 'auth'` — xác thực `ldx_pat_*` bằng SHA-256 và giới hạn role không vượt quá khóa |
| `enterpriseAuthRevocationGuard` | `plugin-enterprise-auth` | `after: 'auth'` — chặn token/session có trong danh sách thu hồi trên Valkey DB `2` |
| `dxosTelemetryDirectGuard` | `plugin-dxos-blocks` | `after: 'acl', before: 'latticeNativeScope'` — chặn CRUD trực tiếp vào telemetry, twin shadow và thiết bị IoT |
| `dxosServiceScope` / `dxosWmsDmnScope` | `plugin-dxos-studio` | `after: 'acl', before: 'latticeNativeScope'` — buộc truy cập qua `dxosWms`, `dxosDmn` và kiểm tra phạm vi ticket |
| `dxosAutomationScope` / `dxosOrganizationScope` | `plugin-dxos-studio` | `after: 'acl', before: 'latticeNativeScope'` — khóa ghi trực tiếp rule tự động hóa và giới hạn `latticeOrganizations` cho `root` |
| `dxosAiProfileScope` / `dxosAiHitlScope` | `plugin-dxos-ai` | `after: 'acl', before: 'latticeNativeScope'` — khóa hồ sơ AI cho admin và chặn sửa trực tiếp hàng đợi HITL |
| `dxosAiMemoryAndA2aScope` | `plugin-dxos-ai` | `after: 'acl', before: 'latticeNativeScope'` — buộc thao tác bộ nhớ AI, tác vụ A2A và trace qua endpoint chuyên biệt |
| `latticeAiProfiles.beforeValidate` & `roles.afterCreate` | `plugin-dxos-ai` | Chặn leo thang quyền `isAdminBuilder`, kiểm tra URL `mcpServers` chống SSRF và gỡ quyền builder khỏi role mới |
| `Gateway.registerRequestHandler` (`5` handler) | `foundation` & `dxos-ai` | Phục vụ `/v/form/*`, `/v/track/*`, `/v/lattice-brand.svg`, `/v/mobile` và `/.well-known/agent-card.json` và tự hủy đăng ký trong `unload()`/`destroy()` |

<CodeTabs
  :tabs="[
    {
      label: 'Vòng đời Plugin mẫu (js)',
      lang: 'javascript',
      code: 'const { Plugin, Gateway } = require(\x22@nocobase/server\x22);\n\nclass CustomLatticePlugin extends Plugin {\n  async load() {\n    this.app.resourceManager.use(this.guardMiddleware(), {\n      tag: \x22customDomainGuard\x22,\n      after: \x22acl\x22,\n      before: \x22latticeNativeScope\x22,\n    });\n    this.app.resourceManager.define({ name: \x22customDomain\x22, actions: this.buildActions() });\n    this.app.once(\x22afterStart\x22, () => this.ensureSeeded().catch(() => {}));\n  }\n\n  async install() { await this.ensureSeeded(); }\n  async afterEnable() { await this.ensureSeeded(); }\n\n  async unload() {\n    this.stopTimers();\n    if (this._gatewayHandler) {\n      Gateway?.unregisterRequestHandler?.(this._gatewayHandler);\n      this._gatewayHandler = null;\n    }\n    if (typeof super.unload === \x22function\x22) await super.unload();\n  }\n}'
    },
    {
      label: 'Mount Read-Only trong Compose (yaml)',
      lang: 'yaml',
      code: 'services:\n  nocobase:\n    image: nocobase/nocobase:2.2.50@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777\n    volumes:\n      - ../../plugins/nocobase/action-bridge:/app/nocobase/node_modules/@latticedx/plugin-action-bridge:ro\n      - ../../plugins/nocobase/plugin-lattice-foundation:/app/nocobase/node_modules/@latticedx/plugin-lattice-foundation:ro\n      - ../../plugins/nocobase/plugin-enterprise-auth:/app/nocobase/node_modules/@latticedx/plugin-enterprise-auth:ro\n      - ../../plugins/nocobase/plugin-dxos-para:/app/nocobase/node_modules/@latticedx/plugin-dxos-para:ro\n      - ../../plugins/nocobase/plugin-dxos-blocks:/app/nocobase/node_modules/@latticedx/plugin-dxos-blocks:ro\n      - ../../plugins/nocobase/plugin-dxos-studio:/app/nocobase/node_modules/@latticedx/plugin-dxos-studio:ro\n      - ../../plugins/nocobase/plugin-dxos-ai:/app/nocobase/node_modules/@latticedx/plugin-dxos-ai:ro'
    },
    {
      label: 'Build & Test Plugin (bash)',
      lang: 'bash',
      code: '# Biên dịch dist/ và sinh dist/externalVersion.js cho một plugin\ncd plugins/nocobase/plugin-lattice-foundation\nnode scripts/build.mjs\n\n# Chạy bộ kiểm thử đơn vị của plugin bằng Node.js native test runner\nnode --test tests/*.test.cjs'
    }
  ]"
/>

## Ghi chú Vận hành & Chiến lược Đóng gói Client

| Quy tắc vận hành | Chi tiết triển khai |
| :--- | :--- |
| Gắn kết chỉ đọc (`:ro`) | Tất cả 7 thư mục plugin đều gắn vào `/app/nocobase/node_modules/@latticedx/*` dưới chế độ `:ro`. Mọi bước biên dịch `dist/` (`externalVersion.js`, UMD client bundle) được thực hiện trong quá trình build trước khi khởi chạy container. |
| Loại bỏ tệp cũ khi build | `plugin-lattice-foundation/scripts/build.mjs` chủ động xóa các module hoặc migration đã ngừng sử dụng khỏi `dist/` sau bước `cp` nhằm ngăn NocoBase auto-discovery nạp nhầm tệp cũ từ các bản build cục bộ trước đó. |
| Phân tách bundler cho client | Các plugin chỉ dùng module tương đối nội bộ (`plugin-lattice-foundation`, `plugin-dxos-ai`) sử dụng trình đóng gói JS zero-dependency kèm `node --check`, trong khi `plugin-dxos-blocks` và `plugin-dxos-studio` dùng `esbuild@0.28.2` (`MIT`) để đóng gói `maplibre-gl`, `@xyflow/react` và `@dagrejs/dagre` thành UMD chạy trực tiếp trên trình duyệt mà vẫn giữ `react`, `react-dom`, `antd` và `@nocobase/client*` ở dạng external. |
| Bảo toàn Điều 5.2 NocoBase | Giao diện `client` và `client-v2` giữ nguyên chân trang `Powered by NocoBase`, phiên bản `v2.2.50`, liên kết `https://www.nocobase.com` và mục `License settings` theo đúng điều khoản sử dụng runtime host. |

### Hàm Xuất Khẩu Tĩnh Giữa các Plugin (`Plugin` Static Exports)

Để các plugin nghiệp vụ (`plugin-dxos-studio`, `plugin-dxos-ai`) tái sử dụng các hàm dùng chung đã gắn với host mà không nhân bản mã nguồn, hai plugin lõi gắn trực tiếp các hàm tiện ích lên lớp `Plugin` trước khi export:

- **`LatticeFoundationPlugin`**: xuất khẩu `appendLedgerEntrySafely`, `computeMeanKineticTemperature`, `recordLineageEdge`, `captureQuarantineRecord`, `publishDomainEvent`, `verifyStandardWebhookSignature`, `resolveConnectorSecrets`, `recordGenAiSpan`, `startGenAiSpan`, `persistGenAiTrace`, `dispatchOmnichannel` và các hàm `requestApproval` / `decideUnifiedInboxItem`.
- **`DxosStudioPlugin`**: xuất khẩu `parseFormulaAst`, `evaluateFormulaExpression`, `validateFormulaExpression`, `validateSafeRegexPattern`, `registerRichSchemaHooks`, `alignPortalOverviewRoutesSort`, `normalizeLegacySlaEscalateRoles` và `createOrganizationDirectGuardMiddleware`.

## Tài liệu liên quan

- [Tổng quan Kiến trúc 6-Plane DX-OS](/architecture/overview)
- [Kiến trúc Đa Tenant & PostgreSQL 16 FORCE RLS](/architecture/multi-tenancy-rls)
- [Tham chiếu Plugin SDK & Tích hợp Mở rộng](/reference/plugin-sdk)
- [Ranh giới Bên thứ ba & Điều 5.2 NocoBase](/open-source/third-party-and-nocobase)
