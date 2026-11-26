---
title: Giấy phép & Chính sách Pure-OSI
description: Phạm vi giấy phép Apache-2.0 cho mã nguồn gốc LatticeDX v0.4.2, chính sách phụ thuộc thuần chuẩn OSI và quy trình kiểm tra header SPDX tự động.
---

# Giấy phép & Chính sách Pure-OSI

Toàn bộ mã nguồn gốc do CTU-OpenPaw phát triển cho **LatticeDX `v0.4.2`** được phát hành theo giấy phép **Apache License, Version 2.0** (`Apache-2.0`). Chính sách quản trị mã nguồn duy trì ranh giới tách bạch giữa mã nguồn nội bộ chuẩn OSI và các dịch vụ hạ tầng hoặc host runtime chạy độc lập qua container OCI.

## Phạm vi mã nguồn Apache-2.0

Giấy phép `Apache-2.0` trong tệp `LICENSE` ở thư mục gốc áp dụng cho toàn bộ tệp nguồn, cấu hình triển khai, đặc tả hợp đồng và bộ kiểm thử thuộc quyền sở hữu của dự án tại các thư mục sau:

| Đường dẫn trong kho mã | Vai trò | Giấy phép áp dụng |
| :--- | :--- | :--- |
| `apps/` | Dịch vụ backend độc lập (`@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`) | `Apache-2.0` |
| `packages/` | Hợp đồng kiểu dùng chung (`@dx/contracts`) và gói tham chiếu (`@latticedx/uc1-procurement`) | `Apache-2.0` |
| `plugins/nocobase/` | Bảy plugin mở rộng chạy trên host NocoBase (`0.4.2`) | `Apache-2.0` |
| `solutions/` | Cấu hình giải pháp và mô hình nghiệp vụ mẫu (`solutions/logistics`) | `Apache-2.0` |
| `infra/` | Tệp Docker Compose (`infra/compose/*.yml`) và cấu hình dịch vụ biên/CSDL | `Apache-2.0` |
| `scripts/` | Bộ công cụ build plugin, sinh SBOM, kiểm tra SPDX, sao lưu và đóng gói source | `Apache-2.0` |
| `tests/` | Bộ kiểm thử đơn vị và kiểm chứng hợp đồng externals | `Apache-2.0` |
| `.github/` | Quy trình CI (`ci.yml`), phân tích tĩnh `CodeQL` (`codeql.yml`) và biểu mẫu issue/PR | `Apache-2.0` |

Bên cạnh tệp `LICENSE` tại thư mục gốc, kho mã duy trì hai tài liệu phân định quyền sở hữu:

- `NOTICE` chia rõ năm phần tách biệt: mã nguồn gốc `Apache-2.0`, ranh giới kho Git thuần OSI với host OCI NocoBase `2.2.50`, danh mục dịch vụ container bên ngoài qua ranh giới mạng, nhóm phụ thuộc đóng gói của `@latticedx/plugin-enterprise-auth` và danh mục gói npm theo `pnpm-lock.yaml`.
- `COPYRIGHT.txt` tổng hợp bản quyền cấp dự án cho từng ứng dụng, gói dùng chung, bảy plugin NocoBase và các thành phần hạ tầng trực tiếp.

Mỗi plugin trong `plugins/nocobase/*/` đều chứa một tệp `LICENSE` và `README.md` riêng với trường `"license": "Apache-2.0"` và `"version": "0.4.2"` trong `package.json`.

### Danh mục gói và ứng dụng nội bộ (`0.4.2`)

| Tên gói (`package.json`) | Phân loại | Đường dẫn | Giấy phép |
| :--- | :--- | :--- | :--- |
| `lattice-dx` | Workspace root | `package.json` | `Apache-2.0` |
| `@dx/contracts` | Shared library | `packages/contracts` | `Apache-2.0` |
| `@dx/api` | Fastify API service | `apps/api` | `Apache-2.0` |
| `@dx/agent-worker` | Incident advisory worker | `apps/agent-worker` | `Apache-2.0` |
| `@dx/file-scanner` | ClamAV + S3 scanner sidecar | `apps/file-scanner` | `Apache-2.0` |
| `@latticedx/uc1-procurement` | Reference manifests | `packages/uc1-procurement` | `Apache-2.0` |
| `@latticedx/plugin-action-bridge` | NocoBase plugin | `plugins/nocobase/action-bridge` | `Apache-2.0` |
| `@latticedx/plugin-lattice-foundation` | NocoBase plugin | `plugins/nocobase/plugin-lattice-foundation` | `Apache-2.0` |
| `@latticedx/plugin-enterprise-auth` | NocoBase plugin | `plugins/nocobase/plugin-enterprise-auth` | `Apache-2.0` |
| `@latticedx/plugin-dxos-para` | NocoBase plugin | `plugins/nocobase/plugin-dxos-para` | `Apache-2.0` |
| `@latticedx/plugin-dxos-blocks` | NocoBase plugin | `plugins/nocobase/plugin-dxos-blocks` | `Apache-2.0` |
| `@latticedx/plugin-dxos-studio` | NocoBase plugin | `plugins/nocobase/plugin-dxos-studio` | `Apache-2.0` |
| `@latticedx/plugin-dxos-ai` | NocoBase plugin | `plugins/nocobase/plugin-dxos-ai` | `Apache-2.0` |

## Chính sách phụ thuộc thuần chuẩn OSI

Mọi thư viện được cài đặt qua `pnpm-lock.yaml`, đóng gói trong plugin hoặc nhúng vào cây mã nguồn Git đều phải mang giấy phép được [Open Source Initiative (OSI)](https://opensource.org/licenses) phê duyệt. Giấy phép `Apache-2.0` của LatticeDX không thay thế giấy phép gốc của từng thư viện bên thứ ba; thông báo bản quyền gốc luôn được giữ nguyên khi build hoặc phân phối sản phẩm đầu ra.

Thống kê theo `pnpm licenses list --json` trên workspace đã khóa phiên bản ghi nhận `153` nhóm package npm với các biểu thức giấy phép sau:

| Biểu thức giấy phép (SPDX) | Số nhóm package | Ví dụ tiêu biểu trong workspace |
| :--- | :---: | :--- |
| `MIT` | `115` | `fastify`, `jose`, `pg`, `vitest`, `tsx`, `esbuild`, `@xyflow/react`, `@dagrejs/dagre` |
| `ISC` | `21` | `semver`, `picocolors`, `earcut`, `d3-selection`, `@maplibre/maplibre-gl-style-spec` |
| `BSD-3-Clause` | `8` | `maplibre-gl`, `fast-uri`, `light-my-request`, `secure-json-parse`, `source-map-js` |
| `Apache-2.0` | `4` | `typescript`, `@typescript/typescript-*`, `detect-libc`, `expect-type` |
| `BSD-2-Clause` | `2` | `@mapbox/tiny-sdf`, `@mapbox/unitbezier` |
| `MPL-2.0` | `2` | `lightningcss`, `lightningcss-*` |
| `(MIT OR Apache-2.0)` | `1` | `@maplibre/mlt` |

### Loại trừ giấy phép BSL-1.1 và thay thế chuẩn OSI

Quy trình sinh và kiểm tra SBOM (`scripts/generate-sbom.mjs`) áp dụng hai bộ lọc chặn cứng (`BANNED_LICENSE_RE` và `BANNED_TECH_RE`) để từ chối mọi phụ thuộc hoặc container image mang giấy phép **BSL-1.1 / Business Source License** (cùng các nền tảng gắn nhãn hạn chế thương mại hóa như `thingsboard` và `emqx`).

Các thành phần hạ tầng tương ứng được chọn hoàn toàn từ hệ sinh thái chuẩn OSI:

| Thành phần hạ tầng | Giấy phép (SPDX) | Vai trò trong kiến trúc |
| :--- | :--- | :--- |
| `valkey/valkey:8.1-alpine` | `BSD-3-Clause` | Cache phiên, PubSub SSE (`PUBSUB_ADAPTER=redis`) và bộ đếm rate-limit cho APISIX |
| `eclipse-mosquitto:2.0.21` | `EPL-2.0 OR BSD-3-Clause` | MQTT broker cho IIoT với Dynamic Security (`allow_anonymous false`) và sự kiện LWT |
| `nodered/node-red:4.0.9` | `Apache-2.0` | Chuẩn hóa bản tin cảm biến và điều phối lệnh downlink Digital Twin |
| `pgvector/pgvector:0.8.1-pg16` | `PostgreSQL` | Lưu vector P.A.R.A. và chuỗi thời gian IIoT `latticeTelemetryPoints` trực tiếp trên PostgreSQL 16 |
| `rustfs/rustfs:1.0.6` | `Apache-2.0` | Lưu trữ đối tượng tương thích S3 cho tệp đính kèm và bằng chứng ePOD |
| `caddy:2.10-alpine` & `apache/apisix:3.19.0` | `Apache-2.0` | Biên TLS ngược và cổng API Zero-Trust |
| `quay.io/keycloak/keycloak:26.8.2` | `Apache-2.0` | Định danh OIDC / PKCE S256 tập trung |

## Phụ thuộc đóng gói trong bảy plugin

Bảy plugin NocoBase đều đặt `"sdkProvidedByHost": true` để không nhúng mã nguồn hay thư viện dùng chung từ host (`react`, `react-dom`, `antd`, `@nocobase/*`). Chỉ ba plugin cần đóng gói thêm thư viện bổ trợ thuần OSI ở tầng build hoặc bundle:

| Plugin | Phụ thuộc đóng gói / Build-time | Giấy phép | Đầu ra & Phạm vi |
| :--- | :--- | :--- | :--- |
| `@latticedx/plugin-enterprise-auth` | `openid-client@6.8.9`, `jose@6.2.15`, `oauth4webapi@3.8.8` (`bundleDependencies`) | `MIT` | Khóa tại `package-lock.json`; giữ nguyên `LICENSE.md` trong `node_modules/` |
| `@latticedx/plugin-dxos-studio` | `@xyflow/react@12.12.1`, `@dagrejs/dagre@3.1.3`, `esbuild@0.28.2` (`devDependencies`) | `MIT` | Đóng gói canvas LatticeFlow v2 vào `dist/client/index.js`; giữ host UI external |
| `@latticedx/plugin-dxos-blocks` | `maplibre-gl@6.19.0` (`BSD-3-Clause`), `esbuild@0.28.2` (`MIT`) (`devDependencies`) | `BSD-3-Clause`, `MIT` | Đóng gói WebGIS + worker vào `dist/client/index.js` với fallback WGS84 |
| Bốn plugin còn lại (`action-bridge`, `foundation`, `dxos-para`, `dxos-ai`) | Không đóng gói npm ngoài | `Apache-2.0` | Chỉ dùng Node.js built-ins và globals do host NocoBase cung cấp |

## Tuân thủ header SPDX (`scripts/source-headers.mjs`)

Mọi tệp mã nguồn gốc thuộc kho `lattice-dx` phải mang đủ khối bản quyền 6 dòng kèm định danh `SPDX-License-Identifier: Apache-2.0` trước khi gộp vào nhánh chính. Công cụ `scripts/source-headers.mjs` tự động kiểm tra và chuẩn hóa header theo phần mở rộng tệp.

### Cấu trúc header chuẩn theo loại tệp

<CodeTabs :tabs="[
  { label: 'JS / TS / MJS / CJS', lang: 'ts', code: '/**\n * @file LatticeDX — Open Digital Enterprise Platform\n * @author CTU-OpenPaw\n * @copyright (C) 2026 CTU-OpenPaw\n * @license Apache-2.0\n * @see https://github.com/CTU-OpenPaw/lattice-dx\n * SPDX-License-Identifier: Apache-2.0\n */' },
  { label: 'YAML / Shell / PS1 / Dockerfile', lang: 'yaml', code: '# @file LatticeDX — Open Digital Enterprise Platform\n# @author CTU-OpenPaw\n# @copyright (C) 2026 CTU-OpenPaw\n# @license Apache-2.0\n# @see https://github.com/CTU-OpenPaw/lattice-dx\n# SPDX-License-Identifier: Apache-2.0' },
  { label: 'SQL', lang: 'sql', code: '-- @file LatticeDX — Open Digital Enterprise Platform\n-- @author CTU-OpenPaw\n-- @copyright (C) 2026 CTU-OpenPaw\n-- @license Apache-2.0\n-- @see https://github.com/CTU-OpenPaw/lattice-dx\n-- SPDX-License-Identifier: Apache-2.0' },
  { label: 'CSS', lang: 'css', code: '/*\n * @file LatticeDX — Open Digital Enterprise Platform\n * @author CTU-OpenPaw\n * @copyright (C) 2026 CTU-OpenPaw\n * @license Apache-2.0\n * @see https://github.com/CTU-OpenPaw/lattice-dx\n * SPDX-License-Identifier: Apache-2.0\n */' }
]" />

### Cơ chế xử lý và quy tắc loại trừ

Công cụ quét toàn bộ tệp đang được Git theo dõi (`git ls-files --cached -z`) thuộc các phần mở rộng `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, `.sql`, `.yml`, `.yaml`, `.ps1`, `.sh` và `Dockerfile`. Tệp mang BOM UTF-8 hoặc dòng shebang (`#!`) được giữ nguyên vị trí đầu tệp trước khi chèn header.

<ParamGrid title="Tham số và trạng thái đầu ra của scripts/source-headers.mjs" :items="[
  { name: '--check', type: 'flag', required: false, description: 'Kiểm tra ở chế độ chỉ đọc; trả mã thoát 1 nếu còn tệp thiếu header hoặc cần rà soát thủ công.' },
  { name: '--write', type: 'flag', required: false, description: 'Mở rộng marker SPDX-License-Identifier: Apache-2.0 đơn dòng thành khối 6 dòng đầy đủ trên các tệp chưa có chỉnh sửa dở dang.' },
  { name: 'alreadyPresent', type: 'number', description: 'Số lượng tệp đã có đầy đủ @file LatticeDX và @copyright (C) 2026 CTU-OpenPaw.' },
  { name: 'wouldChange / changed', type: 'number', description: 'Số tệp có marker SPDX đơn dòng đủ điều kiện mở rộng tự động.' },
  { name: 'needsReview', type: 'string[]', description: 'Danh sách tệp chưa có marker SPDX rõ ràng; script từ chối suy đoán quyền sở hữu và dừng ở trạng thái lỗi.' }
]" />

Ví dụ kết quả JSON trả về khi toàn bộ cây mã đạt chuẩn:

```json
{
  "mode": "check",
  "changed": 0,
  "wouldChange": 0,
  "alreadyPresent": 412,
  "needsReview": []
}
```

Các thư mục tạo sinh hoặc phụ thuộc ngoài (`upstream`, `vendor`, `node_modules`, `dist`, `build`, `coverage`, `output`, `.next`, `.git`) cùng các tệp lockfile/tự sinh (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next-env.d.ts`) được bỏ qua tự động. Khi chạy `--write`, nếu tệp cần sửa đang có thay đổi chưa commit trong `git diff`, script sẽ dừng lại với thông báo `Commit or preserve these pending edits first` để tránh ghi đè ngoài ý muốn.

## Quy trình kiểm tra khi thêm phụ thuộc mới

Trước khi bổ sung một gói npm hoặc image container mới vào Pull Request, tác giả thực hiện đủ bốn bước xác minh sau:

1. Kiểm tra giấy phép khai báo của gói thuộc danh sách OSI cho phép và không chứa `BSL-1.1` hoặc `SSPL-1.0` trong mã lõi.
2. Cập nhật thông tin gói vào `NOTICE`, `COPYRIGHT.txt` và `docs/dependency-inventory.md`.
3. Tạo lại `docs/sbom-cyclonedx.json` nếu lockfile thay đổi và kiểm tra không có lỗ hổng mức `low` trở lên trên cây phụ thuộc production.
4. Chạy bộ lệnh xác minh cục bộ trước khi đẩy commit:

```sh
node scripts/source-headers.mjs --check
pnpm licenses list --json
pnpm release:sbom -- --check
pnpm audit --prod --audit-level=low
```

## Tài liệu liên quan

- [Ranh giới bên thứ ba & NocoBase 2.2.50](/open-source/third-party-and-nocobase)
- [CycloneDX SBOM & Build từ mã nguồn](/open-source/sbom-and-source-build)
- [Đóng góp mã nguồn, bảo mật & chính sách phiên bản](/open-source/contributing-and-security)
- [Hệ thống 7 Plugin Apache-2.0](/architecture/plugin-system)
