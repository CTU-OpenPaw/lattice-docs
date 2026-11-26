# CycloneDX 1.5 SBOM (`257/257`) & Quy trình Build-from-Source Offline

Trang này trình bày chi tiết hồ sơ **CycloneDX 1.5 SBOM** của **LatticeDX `v0.4.2`**, phân rã toàn bộ **`257` thành phần**, kiểm toán an ninh phụ thuộc và quy trình **build-from-source 100% offline** bằng công cụ nguồn mở không cần chỉnh sửa thủ công mã nguồn.

---

## 1. Hồ sơ CycloneDX 1.5 SBOM (`257/257` Thành phần)

Hồ sơ SBOM đọc máy tại `docs/sbom-cyclonedx.json` được sinh định kỳ và xác minh tất định bằng công cụ gốc `lattice-dx-sbom-generator` (`0.4.2`, tệp `scripts/generate-sbom.mjs`):

```sh
# Tái tạo SBOM từ lockfile, workspace & Compose
pnpm release:sbom

# Kiểm tra khớp 100% với docs/sbom-cyclonedx.json
pnpm release:sbom -- --check
node --test scripts/tests/generate-sbom.test.mjs
```

### Phân rã `257` thành phần trong `docs/sbom-cyclonedx.json`

| Nhóm thành phần | Số lượng | Chi tiết & Tỷ lệ phân giải giấy phép |
| --- | ---: | --- |
| **`workspace`** | **12** | Root `lattice-dx` (`0.4.2`), 4 workspace packages/apps (`@dx/contracts`, `@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`), `@latticedx/uc1-procurement`, `solutions/logistics`, và 7 plugins `0.4.2` (bao gồm manifest đóng gói). Toàn bộ mang giấy phép **`Apache-2.0`**. |
| **`npm`** | **226** | Toàn bộ gói phụ thuộc từ `pnpm-lock.yaml` và `plugins/nocobase/plugin-enterprise-auth/package-lock.json` (`openid-client@6.8.9`, `jose@6.2.15`, `oauth4webapi@3.8.8` `MIT`). Đã chuẩn hóa `fsevents@2.3.3 = MIT`. **`226/226` có giấy phép phân giải (`0 NONE`)**. |
| **`oci`** | **19** | Toàn bộ 19 OCI container images trong `infra/compose/*.yml`, **100% khóa digest `@sha256:`** và ánh xạ tường minh trong `OCI_IMAGE_LICENSES` (`scripts/generate-sbom.mjs`). |
| **Tổng cộng** | **`257`** | **`257/257` thành phần có giấy phép đã phân giải (`0` thiếu / `NONE`, `0` `BSL-1.1`)**. |

### Tóm tắt kiểm kê giấy phép npm (`pnpm licenses list --json`)

Theo `docs/dependency-inventory.md`, kết xuất trên workspace đã cài đặt ghi nhận **153 nhóm package npm**:

| Biểu thức giấy phép | Số nhóm package | Ví dụ tiêu biểu |
| --- | ---: | --- |
| `MIT` | 115 | `fastify@5.12.8`, `jose@6.2.12`, `pg@8.23.1`, `vitest@5.0.3`, `tsx@4.23.15`, `esbuild@0.28.2`, `@xyflow/react@12.12.1`, `@dagrejs/dagre@3.1.3` |
| `ISC` | 21 | `semver@7.8.5`, `@maplibre/geojson-vt@6.3.3`, `@maplibre/maplibre-gl-style-spec@26.9.0`, `d3-*` |
| `BSD-3-Clause` | 8 | `maplibre-gl@6.19.0`, `@mapbox/vector-tile@3.0.0`, `fast-uri@3.1.9`/`4.2.3`, `light-my-request@6.6.0` |
| `Apache-2.0` | 4 | `typescript@7.0.2`, `detect-libc@2.1.2`, `expect-type@1.4.0` |
| `BSD-2-Clause` | 2 | `@mapbox/tiny-sdf@2.3.0`, `@mapbox/unitbezier@1.0.0` |
| `MPL-2.0` | 2 | `lightningcss@1.33.0` |
| `(MIT OR Apache-2.0)` | 1 | `@maplibre/mlt@1.3.0` |

### Danh mục `19` OCI Images khóa Digest `@sha256:`

| # | Image (`infra/compose/*.yml`) | Phiên bản | Giấy phép |
| --- | --- | --- | --- |
| 1 | `postgres` | `16.16-alpine` | `PostgreSQL` |
| 2 | `pgvector/pgvector` | `0.8.1-pg16` | `PostgreSQL` |
| 3 | `valkey/valkey` | `8.1-alpine` | `BSD-3-Clause` |
| 4 | `rustfs/rustfs` | `1.0.6` | `Apache-2.0` |
| 5 | `caddy` | `2.10-alpine` | `Apache-2.0` |
| 6 | `quay.io/keycloak/keycloak` | `26.8.2` | `Apache-2.0` |
| 7 | `adorsys/keycloak-config-cli` | `6.5.1-26` | `Apache-2.0` |
| 8 | `apache/apisix` | `3.19.0-debian` | `Apache-2.0` |
| 9 | `nocobase/nocobase` | `2.2.50` | `NocoBase License Agreement (2026-02-24; Apache-2.0 + Clauses 4.2, 5.1-5.4)` (external host OCI) |
| 10 | `fiware/orion-ld` | `1.12.0` | `AGPL-3.0-only` |
| 11 | `mongo` | `8.0` | `SSPL-1.0` |
| 12 | `n8nio/n8n` | `2.48.1` | `Sustainable Use License` (tùy chọn ngoài lõi) |
| 13 | `clamav/clamav` | `1.5.5` | `GPL-2.0-only` |
| 14 | `eclipse-mosquitto` | `2.0.21` | `EPL-2.0 OR BSD-3-Clause` |
| 15 | `nodered/node-red` | `4.0.9` | `Apache-2.0` |
| 16 | `otel/opentelemetry-collector-contrib` | `0.123.0` | `Apache-2.0` |
| 17 | `prom/prometheus` | `v3.3.0` | `Apache-2.0` |
| 18 | `grafana/grafana-oss` | `11.5.8` | `AGPL-3.0-only` |
| 19 | `gotenberg/gotenberg` | `8.20.1` | `MIT` |

### Kiểm toán lỗ hổng & Header SPDX

- **Lỗ hổng production:** `pnpm audit --prod --audit-level=low` trả về **`0` lỗ hổng** (`No known vulnerabilities found`).
- **Kiểm tra header bản quyền & SPDX:** `node scripts/source-headers.mjs --check` xác minh **`1,098` tệp** đều có sẵn `@copyright (C) 2026 CTU-OpenPaw` và `SPDX-License-Identifier: Apache-2.0` (`changed: 0`, `needsReview: []`).

---

## 2. Đóng gói Phát hành Nguồn (`latticedx-0.4.2-src.tar.gz`)

Lệnh `pnpm release:tarball` gọi `scripts/build-oss-release-tarball.mjs` sử dụng `git archive` từ `HEAD` đã commit để xuất gói mã nguồn sạch:

```sh
pnpm release:tarball --ref=v0.4.2
```

- **Đầu ra:** `output/release/latticedx-0.4.2-src.tar.gz` và tệp checksum `output/release/latticedx-0.4.2-src.tar.gz.sha256`.
- **Tệp bắt buộc có mặt (`REQUIRED_ENTRIES`):** `LICENSE`, `NOTICE`, `COPYRIGHT.txt`, `README.md`, `CHANGELOG.md`, `docs/build-from-source.md`.
- **Đường dẫn bị loại trừ cứng (`FORBIDDEN_ENTRY_PATTERNS`):** `node_modules/`, `output/`, `.git/`, `.env` (ngoại trừ `.env.example`), `*.pem`, `*.key`, `upstream/` và `.gitmodules`.

---

## 3. Quy trình Build-from-Source Offline (`v0.4.2`)

Quy trình dưới đây tái tạo và biên dịch **LatticeDX `v0.4.2`** hoàn toàn bằng công cụ nguồn mở mà **không** cần chỉnh sửa thủ công bất kỳ tệp nguồn hay header nào:

### Bước 1 — Chuẩn bị Toolchain 100% OSS

| Thành phần | Phiên bản kiểm chứng | Vai trò |
| --- | --- | --- |
| **Node.js** | `24.x` (`>=24 <25`) | Runtime chạy TypeScript/Node.js (`@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`, scripts) |
| **pnpm** | `10.23.0` (`packageManager` trong `package.json`) | Quản lý monorepo workspace và lockfile (`pnpm-lock.yaml`) |
| **Git** & **tar** | Git + GNU/BSD `tar` | Xác minh nguồn hoặc giải nén gói `.tar.gz` |
| **Docker Engine & Compose** | Docker Compose v2+ | Tùy chọn — chỉ cần khi dựng các container OCI bên ngoài (`infra/compose/*.yml`) |

### Bước 2 — Lấy mã nguồn & Giải nén (chọn 1 trong 2 cách)

**Cách A — Từ gói phát hành `.tar.gz` (không cần `.git/`):**

```sh
sha256sum -c latticedx-0.4.2-src.tar.gz.sha256
tar -xzf latticedx-0.4.2-src.tar.gz
cd latticedx-0.4.2
```

> Trên Windows PowerShell: dùng `Get-FileHash .\latticedx-0.4.2-src.tar.gz -Algorithm SHA256` để đối chiếu với tệp `.sha256`.

**Cách B — Clone trực tiếp từ GitHub:**

```sh
git clone https://github.com/CTU-OpenPaw/lattice-dx.git
cd lattice-dx
```

> Không cần lệnh `git submodule` vì kho mã nguồn đã loại bỏ hoàn toàn `upstream/nocobase` và `.gitmodules`.

### Bước 3 — Cấu hình biến môi trường (tùy chọn)

Tham khảo `.env.example` và `infra/compose/prod.env.example`. Thiết lập qua biến môi trường shell hoặc tệp `.env` cục bộ (đã nằm trong `.gitignore`) — không sửa file nguồn:

```powershell
# Ví dụ PowerShell (mặc định đã đủ cho build/test offline)
$env:API_PORT='4000'
$env:WORKER_PORT='4101'
$env:WORKER_URL='http://127.0.0.1:4101'
```

### Bước 4 — Cài đặt phụ thuộc & Biên dịch toàn bộ Monorepo

```sh
pnpm install --frozen-lockfile
pnpm check
```

Lệnh `pnpm check` chạy tuần tự 3 bước:
1. `pnpm typecheck`: Kiểm tra kiểu TypeScript cho toàn bộ workspace và `solutions/logistics/tsconfig.json`.
2. `pnpm test`: Chạy bộ kiểm thử Vitest (`152` tệp, `1,128` test cases).
3. `pnpm build`: Biên dịch `@dx/contracts`, `@dx/api`, `@dx/agent-worker` và `@dx/file-scanner`.

### Bước 5 — Build & Kiểm thử 7 Plugin NocoBase (`0.4.2`)

```sh
# 1. Cài phụ thuộc khóa lockfile cho plugin-enterprise-auth (tắt lifecycle scripts)
npm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund

# 2. Build lần lượt 7 plugin Apache-2.0
node plugins/nocobase/action-bridge/build.mjs
node plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs
node plugins/nocobase/plugin-enterprise-auth/build.mjs
node plugins/nocobase/plugin-dxos-para/build.mjs
node plugins/nocobase/plugin-dxos-blocks/build.mjs
node plugins/nocobase/plugin-dxos-studio/build.mjs
node plugins/nocobase/plugin-dxos-ai/build.mjs

# 3. Chạy kiểm thử đơn vị (174 tệp, 1,381 tests) + đánh giá 163 ca tiếng Việt tự nhiên
node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/nocobase-externals.test.mjs
node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95
```

### Bước 6 — Kiểm toán PoF, SBOM & Đóng gói phát hành

```sh
node scripts/source-headers.mjs --check
pnpm pof:check
node --test scripts/tests/oss-pof-audit.test.mjs
pnpm release:sbom
node scripts/generate-sbom.mjs --check
pnpm audit --prod --audit-level=low
pnpm release:tarball
```

### Bước 7 — Dựng môi trường NocoBase `2.2.50` sạch & Nghiệm thu E2E (tùy chọn khi có Docker)

Khi giải nén từ `.tar.gz` hoặc checkout Git và muốn dựng runtime đầy đủ với container `nocobase/nocobase:2.2.50`:

```sh
pnpm native:clean --port=13014
node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"
pnpm setup:dxos-ai -- --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" pnpm seed:v100-showcase -- --origin=http://localhost:13014
pnpm acceptance:headless-paas -- --origin=http://localhost:13014
pnpm acceptance:dxos-ai-mcp -- --origin=http://localhost:13014
pnpm acceptance:logistics-rbac -- "<path-to-report.json>"
```

---

## Tài liệu liên quan

- [Chính sách Pure-OSI `Apache-2.0` & Ma trận PoF OLP PMNM 2026](/oss/pure-osi-policy)
- [Tuân thủ NocoBase `2.2.50` Điều khoản 5.2 & Ranh giới Mã nguồn](/oss/nocobase-clause-5-2)
- [Cài đặt Nhanh & Triển khai Production](/getting-started/quick-start)
- [Hướng dẫn Kiểm thử E2E Toàn hệ thống](/operations/testing-e2e-guide)
