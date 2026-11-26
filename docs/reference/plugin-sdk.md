---
title: Plugin SDK và Hợp đồng Host
description: Cấu trúc gói plugin Apache-2.0, entrypoint server/client/client-v2, hợp đồng sdkProvidedByHost, nocobase-externals.mjs và kiểm thử node --test.
---

<script setup>
const sdkTabs = [
  {
    label: 'build.mjs (Host Externals)',
    lang: 'js',
    code: `import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { externalVersionSource } from '../../../scripts/lib/nocobase-externals.mjs';

const root = new URL('./', import.meta.url);
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(
  new URL('dist/externalVersion.js', root),
  externalVersionSource([
    '@nocobase/server',
    '@nocobase/database',
    '@nocobase/client',
    '@nocobase/client-v2',
    'react',
    'react-dom',
    'antd',
  ]),
  'utf8',
);
await cp(new URL('src/', root), new URL('dist/', root), { recursive: true });`,
  },
  {
    label: 'Server Plugin',
    lang: 'js',
    code: `'use strict';
const { Plugin } = require('@nocobase/server');
const { withTenantRlsContext } = require('./pg-rls');

class CustomDomainPlugin extends Plugin {
  async load() {
    this.app.resourceManager.define({
      name: 'dxosExample',
      actions: {
        ping: async (ctx, next) => {
          if (ctx.method !== 'GET') ctx.throw(405);
          const orgId = ctx.state?.latticeRlsOrg || 'default';
          ctx.body = await withTenantRlsContext(this.db, orgId, async () => ({
            ok: true,
            organizationId: orgId,
          }));
          await next();
        },
      },
    });
    this.app.acl.allow('dxosExample', ['ping'], 'loggedIn');
  }
}

module.exports = CustomDomainPlugin;
module.exports.default = CustomDomainPlugin;`,
  },
  {
    label: 'Unit Test (node --test)',
    lang: 'js',
    code: `'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function withMockedNocobase(fn) {
  const origLoad = Module._load;
  class MockPlugin {
    constructor(app, options = {}) {
      this.app = app;
      this.db = app?.db;
      this.options = options;
    }
  }
  Module._load = function (request, parent, isMain) {
    if (request === '@nocobase/server') return { Plugin: MockPlugin };
    if (request === '@nocobase/database') return { defineCollection: (def) => def };
    return origLoad.call(this, request, parent, isMain);
  };
  return Promise.resolve().then(fn).finally(() => {
    Module._load = origLoad;
  });
}

test('registers resource action cleanly', () =>
  withMockedNocobase(async () => {
    const defined = [];
    const mockApp = {
      db: {},
      resourceManager: { define: (def) => defined.push(def) },
      acl: { allow: () => {} },
    };
    const PluginCls = require('../dist/server/index.js');
    await new PluginCls(mockApp).load();
    assert.ok(defined.length >= 1);
  }),
);`,
  },
];
</script>

# Plugin SDK và Hợp đồng Host

Toàn bộ mô-đun mở rộng của LatticeDX được đóng gói thành 7 plugin Apache-2.0 độc lập dưới thư mục `plugins/nocobase/`, nạp chỉ đọc vào container runtime `nocobase/nocobase:2.2.50` tại `/app/nocobase/node_modules/@latticedx/*`. Thiết kế `sdkProvidedByHost: true` tách bạch mã nguồn Pure-OSI khỏi cây phụ thuộc host khi đóng gói và phát hành.

## Cấu trúc gói Plugin và Manifest

Mỗi thư mục plugin chứa `package.json`, `LICENSE` (Apache-2.0), `README.md`, ba điểm vào gốc (`server.js` hoặc `server.cjs`, `client.js`, `client-v2.js`), mã nguồn `src/` và đầu ra biên dịch `dist/`.

```text
plugins/nocobase/plugin-example/
├── package.json
├── LICENSE
├── README.md
├── server.js          # module.exports = require('./dist/server/index.js')
├── client.js          # module.exports = require('./dist/client/index.js')
├── client-v2.js       # module.exports = require('./dist/client-v2/index.js')
├── scripts/build.mjs  # hoặc build.mjs ở thư mục gốc plugin
├── src/
│   ├── server/
│   │   ├── index.js
│   │   ├── collections/*.js
│   │   └── migrations/*.js
│   ├── client/index.js
│   └── client-v2/index.js
└── tests/*.test.cjs
```

<ParamGrid
  title="Các trường bắt buộc trong package.json của Plugin"
  :items="[
    { name: 'name', type: 'string', required: true, description: 'Tên gói dưới scope @latticedx/*, khớp thư mục mount trong @latticedx/.' },
    { name: 'version', type: 'string', required: true, default: '0.4.2', description: 'Phiên bản phát hành hiện tại (khóa đồng bộ 0.4.2 trên cả 7 plugin).' },
    { name: 'license', type: 'string', required: true, default: 'Apache-2.0', description: 'Giấy phép Pure-OSI bắt buộc cho từng plugin kèm tệp LICENSE riêng.' },
    { name: 'main', type: 'string', required: true, default: 'dist/server/index.js', description: 'Đường dẫn CommonJS tới lớp Plugin phía máy chủ.' },
    { name: 'files', type: 'string[]', required: true, description: 'Danh sách tệp phát hành: dist, server.js, client.js, client-v2.js, README.md, LICENSE.' },
    { name: 'nocobase.supportedVersions', type: 'string[]', required: true, default: '[2.2.x]', description: 'Dải phiên bản NocoBase host tương thích.' },
    { name: 'nocobase.testedRuntime', type: 'string', required: true, default: '2.2.50', description: 'Phiên bản OCI host đã kiểm định chạy thực tế.' },
    { name: 'nocobase.sdkProvidedByHost', type: 'boolean', required: true, default: 'true', description: 'Khẳng định các gói @nocobase/*, react, react-dom và antd do host cung cấp tại runtime.' }
  ]"
/>

### Danh mục 7 Plugin chính thức (`0.4.2`)

| Thư mục | Tên gói (`package.json`) | Entrypoint máy chủ | Chiến lược đóng gói Client |
|---|---|---|---|
| `action-bridge/` | `@latticedx/plugin-action-bridge` | `server.cjs` | `build.mjs` sao chép `src/` sang `dist/` và sinh `dist/externalVersion.js` |
| `plugin-lattice-foundation/` | `@latticedx/plugin-lattice-foundation` | `server.js` (`LatticeFoundationPlugin`) | `scripts/build.mjs` đóng gói đồ thị import nội bộ cho `client` & `client-v2` |
| `plugin-enterprise-auth/` | `@latticedx/plugin-enterprise-auth` | `server.js` (`EnterpriseLoginPlugin`) | Đóng gói kèm `openid-client@6.8.9` (`bundleDependencies`) |
| `plugin-dxos-para/` | `@latticedx/plugin-dxos-para` | `server.js` (`DxosParaPlugin`) | Sao chép `src/` sang `dist/`, giữ toàn bộ host SDK ở ngoài |
| `plugin-dxos-blocks/` | `@latticedx/plugin-dxos-blocks` | `server.js` (`DxosBlocksServerPlugin`) | `esbuild@0.28.2` đóng gói MIT `maplibre-gl@6.19.0` (kèm CSS & worker) vào UMD |
| `plugin-dxos-studio/` | `@latticedx/plugin-dxos-studio` | `server.js` (`DxosStudioPlugin`) | `esbuild@0.28.2` đóng gói MIT `@xyflow/react@12.12.1` + `@dagrejs/dagre@3.1.3` vào UMD |
| `plugin-dxos-ai/` | `@latticedx/plugin-dxos-ai` | `server.js` (`DxosAiPlugin`) | Đóng gói các module client tương đối, giữ external host SDK |

## Ràng buộc Host và `nocobase-externals.mjs`

Tệp `scripts/lib/nocobase-externals.mjs` định nghĩa hợp đồng phiên bản chuẩn giữa plugin và container host `nocobase/nocobase:2.2.50`. Hàm `externalVersionSource(names)` phát sinh `dist/externalVersion.js` cho từng plugin trong quá trình build mà không cài đặt gói `@nocobase/*` vào `node_modules` cục bộ của mã nguồn.

| Hằng số / Nhóm gói | Giá trị mặc định | Mục đích |
|---|---|---|
| `DEFAULT_NOCOBASE_VERSION` | `2.2.50` | Có thể ghi đè qua biến môi trường `NOCOBASE_VERSION` (kiểm tra khớp semver) |
| `NOCOBASE_EXTERNAL_NAMES` | `@nocobase/server`, `@nocobase/auth`, `@nocobase/plugin-auth`, `@nocobase/database`, `@nocobase/client`, `@nocobase/client-v2`, `@nocobase/plugin-workflow` | Các gói SDK lõi do container host cung cấp qua cơ chế nạp module |
| `SHARED_VENDOR_VERSIONS` | `react: 18.2.0`, `react-dom: 18.2.0`, `antd: 5.24.2` | Phiên bản React/Ant Design dùng chung giữa trình duyệt và các plugin UI |

Quy trình kiểm tra cách ly (`plugin-isolation`) từ chối mọi plugin đóng gói trùng `@nocobase/*`, `react`, `react-dom` hoặc `antd` bên trong gói phân phối, đồng thời yêu cầu giữ nguyên phần ghi công `Powered by NocoBase` (`v2.2.50`, `https://www.nocobase.com`) theo Điều khoản 5.2.

### Quy tắc cách ly khi Mount vào Container

Trong `infra/compose/nocobase.yml` và `infra/compose/prod.yml`, cả 7 thư mục plugin được mount chỉ đọc (`:ro`) vào `/app/nocobase/node_modules/@latticedx/*`. Vì `dist/` được biên dịch sẵn bằng `node scripts/build.mjs` (hoặc `node build.mjs`), container NocoBase không cần chạy trình biên dịch trên production và không chứa bất kỳ phụ thuộc nguồn ngoài Pure-OSI nào.

## Vòng đời Server, Client và Client-v2

### Plugin máy chủ (`@nocobase/server`)

Lớp kế thừa `Plugin` từ `@nocobase/server` triển khai các hook vòng đời theo thứ tự khởi động của NocoBase:

| Hook vòng đời | Thời điểm & Hành vi thực thi |
| :--- | :--- |
| `load()` | Đăng ký collection (`src/server/collections/*`), định nghĩa tài nguyên qua `this.app.resourceManager.define()`, cấp quyền ACL (`this.app.acl.allow()` / `registerSnippet()`), gắn middleware (`this.app.resourceManager.use(..., { tag, before, after })`) và đăng ký handler công khai trên `Gateway.registerRequestHandler()`. |
| `install()` | Khởi tạo dữ liệu hạt giống idempotent, bọc trong `withSystemRlsBypass(this.db, ...)` khi `DX_PG_RLS_SESSION=true`. |
| `afterEnable()` / `start()` | Đồng bộ quyền bổ sung cho vai trò mặc định sau khi ứng dụng hoàn tất khởi động. |
| `unload()` / `remove()` / `destroy()` | Hủy đăng ký toàn bộ `Gateway` handler, dừng timer/drainer outbox và gọi `shutdown()` trên `otelExporter` để giải phóng tài nguyên sạch sẽ. |

### Entrypoint Client (`@nocobase/client`) và Client-v2 (`@nocobase/client-v2`)

Trình duyệt của NocoBase nạp plugin thông qua wrapper UMD hỗ trợ cả AMD (`define('@latticedx/<pkg>', [...], factory)`) và CommonJS:

- **`client.js` (`@nocobase/client`)**: Mở rộng `client.Plugin` cho các màn hình quản trị truyền thống, hook `useAPIClient()` và cấu hình portal. Những plugin có thư viện đồ họa lớn như `plugin-dxos-blocks` (`maplibre-gl`) hoặc `plugin-dxos-studio` (`@xyflow/react`, `@dagrejs/dagre`) sử dụng `esbuild` với plugin chặn external (`@nocobase/*`, `react`, `react-dom`, `antd`) để nhúng riêng thư viện MIT vào gói UMD `dist/client/index.js`.
- **`client-v2.js` (`@nocobase/client-v2`)**: Đăng ký FlowEngine BlockModels (ví dụ 12 native v2 BlockModels trong `plugin-dxos-blocks`) và các tuyến công khai không yêu cầu đăng nhập (`skipAuthCheck: true` như `/mobile`, `/track/:code`, `/form/:slug`) qua `this.app.router.add()`.

## Xây dựng và Kiểm thử Plugin (`node --test`)

Mọi kịch bản kiểm thử đơn vị dưới `plugins/nocobase/*/tests/*.test.cjs` chạy trực tiếp bằng `node --test` (Node.js 24 LTS) với cơ chế mock nhẹ `@nocobase/server` và `@nocobase/database` qua `Module._load`, không phụ thuộc cơ sở dữ liệu hay container bên ngoài trong bước kiểm thử nhanh. Các tệp `scripts/check-runtime.cjs` cung cấp lớp kiểm tra sau khởi động ngay bên trong container host để xác minh migration và toàn vẹn quan hệ dữ liệu.

<CodeTabs :tabs="sdkTabs" />

## Tài liệu liên quan

- [Kiến trúc hệ thống Plugin](/architecture/plugin-system)
- [Tham chiếu REST API](/reference/rest-api)
- [Bên thứ ba và Ghi công NocoBase](/open-source/third-party-and-nocobase)
- [Kiểm thử và Xác minh](/operations/testing-and-verification)
