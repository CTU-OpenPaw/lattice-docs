---
title: Ranh giới bên thứ ba & NocoBase 2.2.50
description: Ranh giới container OCI bên ngoài, hợp đồng sdkProvidedByHost, ghi nhận Điều 5.2 của NocoBase 2.2.50, chính sách không .gitmodules và kiểm chứng tương thích upstream.
---

# Ranh giới bên thứ ba & NocoBase 2.2.50

LatticeDX duy trì ranh giới kiến trúc tách biệt giữa mã nguồn gốc `Apache-2.0` trong kho Git và môi trường thực thi bên ngoài. Host runtime `nocobase/nocobase:2.2.50` cùng toàn bộ dịch vụ hạ tầng bên thứ ba chạy trong các container OCI độc lập, giao tiếp với mã nguồn nội bộ qua giao thức mạng chuẩn hoặc hợp đồng SDK tại thời điểm chạy.

## Ranh giới container OCI bên ngoài và chính sách không `.gitmodules`

Kho mã nguồn Git `CTU-OpenPaw/lattice-dx` và gói phát hành nguồn `latticedx-0.4.2-src.tar.gz` hoàn toàn không chứa thư mục `upstream/nocobase/`, không khai báo Git submodule và không có tệp `.gitmodules`. Mã nguồn gốc của dự án không sao chép, không chỉnh sửa và không nhúng bất kỳ tệp triển khai nào từ mã nguồn upstream NocoBase.

### Cơ sở tách biệt giấy phép upstream

Upstream NocoBase được phát hành theo **NocoBase License Agreement** (bản cập nhật ngày `2026-02-24`: `Apache-2.0` kèm các điều khoản bổ sung `4.2` và `5.1–5.4`), trong đó:

- **Điều 4.2** quy định ưu tiên các điều khoản bổ sung nếu phát sinh khác biệt với `Apache-2.0`.
- **Điều 5.2** yêu cầu giữ nguyên nhận diện thương hiệu và liên kết nguồn gốc NocoBase trên giao diện vận hành.
- **Điều 5.4** đặt giới hạn đối với việc cung cấp công khai dịch vụ SaaS/PaaS dạng low-code, no-code hoặc nền tảng AI.
- Một số gói lõi trong mã nguồn upstream (như `packages/core/server/src/application.ts`) mang tiêu đề `AGPL-3.0` và `NocoBase Commercial License`.

Do các ràng buộc bổ sung này nằm ngoài tiêu chuẩn OSI thuần túy, toàn bộ host NocoBase được cô lập hoàn toàn thành một OCI container bên ngoài tại:

```text
nocobase/nocobase:2.2.50@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777
```

### Mô hình gắn plugin chỉ-đọc lúc chạy (`infra/compose/*.yml`)

Image `nocobase/nocobase:2.2.50` được tham chiếu cố định trong `infra/compose/nocobase.yml`, `infra/compose/native-rehearsal.yml` và `infra/compose/prod.yml`. Khi container khởi chạy, bảy plugin `Apache-2.0` dưới `plugins/nocobase/` được gắn chỉ-đọc (`:ro`) vào thư mục `/app/nocobase/node_modules/@latticedx/*`:

```yaml
volumes:
  - nocobase-storage:/app/nocobase/storage
  - ../../plugins/nocobase/action-bridge:/app/nocobase/node_modules/@latticedx/plugin-action-bridge:ro
  - ../../plugins/nocobase/plugin-lattice-foundation:/app/nocobase/node_modules/@latticedx/plugin-lattice-foundation:ro
  - ../../plugins/nocobase/plugin-enterprise-auth:/app/nocobase/node_modules/@latticedx/plugin-enterprise-auth:ro
  - ../../plugins/nocobase/plugin-dxos-para:/app/nocobase/node_modules/@latticedx/plugin-dxos-para:ro
  - ../../plugins/nocobase/plugin-dxos-blocks:/app/nocobase/node_modules/@latticedx/plugin-dxos-blocks:ro
  - ../../plugins/nocobase/plugin-dxos-studio:/app/nocobase/node_modules/@latticedx/plugin-dxos-studio:ro
  - ../../plugins/nocobase/plugin-dxos-ai:/app/nocobase/node_modules/@latticedx/plugin-dxos-ai:ro
```

## Hợp đồng Host SDK (`sdkProvidedByHost: true`)

Mỗi plugin trong bảy plugin của LatticeDX giao tiếp với host thông qua hợp đồng nạp ngoài tại runtime. Tệp `package.json` của cả bảy plugin đều khai báo đồng bộ khối siêu dữ liệu `nocobase`:

<CodeTabs :tabs="[
  { label: 'Plugin package.json', lang: 'json', code: JSON.stringify({ name: '@latticedx/plugin-lattice-foundation', version: '0.4.2', license: 'Apache-2.0', nocobase: { supportedVersions: ['2.2.x'], testedRuntime: '2.2.50', sdkProvidedByHost: true } }, null, 2) },
  { label: 'nocobase-externals.mjs', lang: 'js', code: 'export const DEFAULT_NOCOBASE_VERSION = \'2.2.50\';\nconst SHARED_VENDOR_VERSIONS = {\n  react: \'18.2.0\',\n  \'react-dom\': \'18.2.0\',\n  antd: \'5.24.2\',\n};\nconst NOCOBASE_EXTERNAL_NAMES = [\n  \'@nocobase/server\',\n  \'@nocobase/auth\',\n  \'@nocobase/plugin-auth\',\n  \'@nocobase/database\',\n  \'@nocobase/client\',\n  \'@nocobase/client-v2\',\n  \'@nocobase/plugin-workflow\',\n];' },
  { label: 'dist/externalVersion.js', lang: 'js', code: '// SPDX-License-Identifier: Apache-2.0\nmodule.exports = ' + JSON.stringify({ '@nocobase/server': '2.2.50', '@nocobase/database': '2.2.50', '@nocobase/client': '2.2.50', '@nocobase/client-v2': '2.2.50', react: '18.2.0', antd: '5.24.2' }, null, 2) + ';' }
]" />

Bộ sinh phiên bản ngoài tại `scripts/lib/nocobase-externals.mjs` cung cấp hàm `externalVersionSource(names, { version })` để tạo `dist/externalVersion.js` trong quá trình build plugin, bảo đảm các gói lõi của host không bao giờ bị đóng gói lại vào `dist/`:

<ParamGrid title="Danh sách module host-external do NocoBase 2.2.50 cung cấp lúc chạy" :items="[
  { name: '@nocobase/server', type: '2.2.50', required: true, description: 'Application lifecycle, middleware, gateway và resourceManager trên phía server.' },
  { name: '@nocobase/database', type: '2.2.50', required: true, description: 'Sequelize ORM adapter, collection schema, migration runner và repository hooks.' },
  { name: '@nocobase/auth', type: '2.2.50', required: true, description: 'Token signer, authenticator base class và ngữ cảnh xác thực người dùng.' },
  { name: '@nocobase/plugin-auth', type: '2.2.50', required: true, description: 'Quản lý authenticator và cấu hình đăng nhập cho @latticedx/plugin-enterprise-auth.' },
  { name: '@nocobase/client', type: '2.2.50', required: true, description: 'Client v1 plugin base, schema components và pluginSettingsManager.' },
  { name: '@nocobase/client-v2', type: '2.2.50', required: true, description: 'FlowEngine client v2 cho 12 Native BlockModels, ShellModel và tuyến /v/mobile.' },
  { name: '@nocobase/plugin-workflow', type: '2.2.50', required: true, description: 'Điểm tích hợp workflow host cho @latticedx/plugin-lattice-foundation.' },
  { name: 'react / react-dom / antd', type: '18.2.0 / 5.24.2', required: true, description: 'Thư viện UI dùng chung do host cung cấp để bảo đảm đồng nhất cây DOM và React context.' }
]" />

Hàm `externalVersionSource` kiểm tra chặt tên gói trong danh sách cho phép và ném lỗi `Unverified host dependency` nếu plugin khai báo phụ thuộc ngoài phạm vi đã kiểm chứng.

### Cơ chế đóng gói `esbuild` và tách ngoại lệ SDK

Trong quá trình build client bundle UMD (`dist/client/index.js`), hai plugin `@latticedx/plugin-dxos-studio` và `@latticedx/plugin-dxos-blocks` sử dụng `esbuild@0.28.2` để đóng gói các thư viện vẽ đồ thị (`@xyflow/react`, `@dagrejs/dagre`) và bản đồ (`maplibre-gl`) vào sản phẩm đầu ra, đồng thời truyền danh sách ngoại lệ sau vào cấu hình `external` của `esbuild`:

```js
const HOST_EXTERNALS = [
  'react',
  'react-dom',
  'antd',
  '@nocobase/client',
  '@nocobase/client-v2',
  '@nocobase/server',
  '@nocobase/database',
];
```

Nhờ cấu hình này, bundle của plugin gọi trực tiếp các đối tượng `React`, `antd` và `@nocobase/client` từ ngữ cảnh host NocoBase `2.2.50` lúc chạy, không tạo bản sao React thứ hai gây xung đột hook và không đưa mã nguồn host vào gói phân phối.

## Ghi nhận Điều 5.2 của NocoBase `2.2.50`

LatticeDX tuân thủ đầy đủ Điều 5.2 trong NocoBase License Agreement bằng cách giữ nguyên và hiển thị rõ ràng thông tin ghi công NocoBase (`Powered by NocoBase`, phiên bản `v2.2.50`, liên kết `https://www.nocobase.com` và mục `License settings`) trên cả giao diện ứng dụng lẫn tài liệu công khai:

| Tệp nguồn / Vị trí | Thành phần hiển thị | Yêu cầu bảo toàn |
| :--- | :--- | :--- |
| `plugin-lattice-foundation/src/client/native-builder-navigation.js` | Thanh footer `.ldx-clause52-attribution` trên portal | Giữ nguyên nhãn `Powered by NocoBase` và thẻ `<a>` tới `https://www.nocobase.com` |
| `plugin-lattice-foundation/src/client/native-portal-settings.js` | Footer trong màn hình cấu hình Multi-Portal | Giữ nguyên dòng `LatticeDX Open-Core (Apache-2.0) · Powered by NocoBase` |
| `plugin-dxos-ai/src/client/index.js` | Hằng số `CLAUSE_52_ATTRIBUTION` | Bảo toàn chuỗi định danh ghi công trong gói client AI Studio |
| `.vitepress/config.ts` | Footer toàn trang tài liệu VitePress | Giữ nguyên liên kết `Powered by NocoBase 2.2.50` trên cả locale VI và EN |

Khi tùy biến giao diện portal hoặc triển khai theme mới, nhà phát triển không được ẩn, ghi đè CSS `display: none` hoặc thay đổi liên kết `https://www.nocobase.com` và nhãn `Powered by NocoBase`. Bộ kiểm tra tự động của kho mã xác minh trực tiếp sự tồn tại của biểu thức `Powered by NocoBase` hoặc `nocobase.com` trong `plugins/nocobase/plugin-lattice-foundation/src/client/` và trả lỗi ngay nếu thông báo ghi công bị xóa khỏi mã nguồn client.

## Danh mục dịch vụ container bên thứ ba (ranh giới mạng)

Tất cả dịch vụ bên thứ ba dưới đây vận hành trong các OCI container riêng biệt cấu hình tại `infra/compose/*.yml` và giao tiếp với LatticeDX qua giao thức mạng chuẩn (`SQL`, `HTTP/REST`, `OIDC`, `NGSI-LD`, `MQTT`, `clamd TCP`, `OTLP`). Không có dịch vụ nào trong bảng này bị sao chép mã nguồn, liên kết tĩnh hoặc cấp phép lại thành `Apache-2.0`.

| Dịch vụ container | Phiên bản & Digest (`@sha256:`) | Giấy phép | Giao thức biên & Tệp Compose |
| :--- | :--- | :--- | :--- |
| `nocobase/nocobase` | `2.2.50` (`04b75164936e...8d777`) | `NocoBase License Agreement` | Host OCI container (`nocobase.yml`, `native-rehearsal.yml`, `prod.yml`) |
| `postgres` | `16.16-alpine` (`f2f98726820d...afb6d`) | `PostgreSQL` | TCP SQL (`core.yml`, `prod.yml`) |
| `pgvector/pgvector` | `0.8.1-pg16` (`33198da2828a...20337`) | `PostgreSQL` | TCP SQL + HNSW vector (`nocobase.yml`, `native-rehearsal.yml`, `prod.yml`) |
| `valkey/valkey` | `8.1-alpine` (`9971099af41c...fc3fc`) | `BSD-3-Clause` | RESP TCP cache/PubSub (`nocobase.yml`, `prod.yml`) |
| `rustfs/rustfs` | `1.0.6` (`ee717072290b...5044a`) | `Apache-2.0` | HTTP S3 API (`prod.yml`) |
| `caddy` | `2.10-alpine` (`4c6e91c6ed0e...18e530d`) | `Apache-2.0` | HTTPS/TLS ingress (`prod.yml`) |
| `quay.io/keycloak/keycloak` | `26.8.2` (`7e66a96e4739...ba38b3`) | `Apache-2.0` | OIDC / HTTPS (`core.yml`, `prod.yml`) |
| `adorsys/keycloak-config-cli` | `6.5.1-26` (`1b22dfaa9ae0...b1411`) | `Apache-2.0` | HTTP Admin API oneshot (`prod.yml`) |
| `apache/apisix` | `3.19.0-debian` (`9a7e45dc943f...61141`) | `Apache-2.0` | HTTP API gateway (`core.yml`, `prod.yml`) |
| `otel/opentelemetry-collector-contrib` | `0.123.0` (`e39311df1f3d...aee4d2`) | `Apache-2.0` | OTLP HTTP/gRPC (`prod.yml`) |
| `prom/prometheus` | `v3.3.0` (`339ce86a5941...fb2f1`) | `Apache-2.0` | HTTP `/api/dxos:metrics` (`prod.yml`) |
| `nodered/node-red` | `4.0.9` (`0b295b3a14c5...db4b5`) | `Apache-2.0` | HTTP webhook + MQTT (`iiot.yml`, `prod.yml`) |
| `eclipse-mosquitto` | `2.0.21` (`94f5a3d7deaf...4d353`) | `EPL-2.0 OR BSD-3-Clause` | MQTT TCP trên `iiot-net` (`iiot.yml`, `prod.yml`) |
| `gotenberg/gotenberg` | `8.20.1` (`cda4386c7ed3...29bac`) | `MIT` | HTTP PDF export tùy chọn (`prod.yml`, profile `pdf`) |
| `clamav/clamav` | `1.5.5` (`12177441d1b4...a6dd8`) | `GPL-2.0-only` | `clamd` TCP qua `apps/file-scanner` (`core.yml`, `prod.yml`) |
| `fiware/orion-ld` | `1.12.0` (`f562a93ed84c...bd613b`) | `AGPL-3.0-only` | HTTP NGSI-LD (`integration.yml`, `prod.yml`) |
| `grafana/grafana-oss` | `11.5.8` (`b8121de93047...6a48`) | `AGPL-3.0-only` | HTTP dashboard độc lập (`prod.yml`, profile `observability`) |
| `mongo` | `8.0` (`479e85ced54f...575d01`) | `SSPL-1.0` | Wire protocol riêng cho `orion-ld` (`integration.yml`, `prod.yml`) |
| `n8nio/n8n` | `2.48.1` (`5e022f23ef9e...009f`) | `Sustainable Use License` | REST v1 + OAuth2 PKCE tùy chọn (`integration.yml`, `prod.yml`, profile `n8n`) |

### Cô lập dịch vụ tùy chọn và copyleft theo profile Compose

| Nhóm dịch vụ | Giấy phép | Profile / Mạng cô lập | Điểm tích hợp duy nhất |
| :--- | :--- | :--- | :--- |
| `n8nio/n8n:2.48.1` | `Sustainable Use License` | Profile `n8n` (`app`, `data`) | Cầu nối REST API v1 + OAuth2 PKCE từ `dxosN8n` |
| `grafana/grafana-oss:11.5.8` | `AGPL-3.0-only` | Profile `observability` (`app`, `data`) | Đọc truy vấn PromQL từ Prometheus nội bộ |
| `fiware/orion-ld:1.12.0` & `mongo:8.0` | `AGPL-3.0-only` / `SSPL-1.0` | Stack mặc định (`app`, `data`) | Giao tiếp HTTP NGSI-LD qua outbox `latticeContextOutbox` |
| `clamav/clamav:1.5.5` | `GPL-2.0-only` | Mạng nội bộ `scanner` | Kết nối TCP cổng `3310` từ sidecar `apps/file-scanner` |

## Kiểm chứng tương thích upstream

Khi kiểm thử bản nâng cấp NocoBase trong dải `2.2.x`, LatticeDX cung cấp quy trình kiểm chứng không ảnh hưởng dữ liệu chính:

| Bước | Giai đoạn kiểm thử | Thực thi & Tiêu chí xác nhận |
| :---: | :--- | :--- |
| `1` | Ghi đè phiên bản build externals | Đặt biến môi trường `NOCOBASE_VERSION=<semver>` (mặc định `'2.2.50'`, kiểm tra định dạng semver nghiêm ngặt trong `resolveNocoBaseVersion()`). |
| `2` | Kiểm tra hợp đồng externals | Chạy `node --test tests/nocobase-externals.test.mjs` để xác nhận danh sách module host và cấu trúc `dist/externalVersion.js`. |
| `3` | Diễn tập nâng cấp cô lập | Chạy stack `infra/compose/native-rehearsal.yml` (tên dự án `lattice-native-rehearsal`, cổng `127.0.0.1:13001`) để kiểm tra khởi tạo DB, migration plugin và giao diện Điều 5.2 trước khi cập nhật digest trong `prod.yml`. |

```sh
NOCOBASE_VERSION=2.2.50 node --test tests/nocobase-externals.test.mjs
docker compose -f infra/compose/native-rehearsal.yml config --quiet
```

## Tài liệu liên quan

- [Giấy phép & Chính sách Pure-OSI](/open-source/licensing)
- [CycloneDX SBOM & Build từ mã nguồn](/open-source/sbom-and-source-build)
- [Hệ thống 7 Plugin Apache-2.0](/architecture/plugin-system)
- [Quy trình nâng cấp nền tảng](/getting-started/upgrading)
