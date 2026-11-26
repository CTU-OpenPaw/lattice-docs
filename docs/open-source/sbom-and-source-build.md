---
title: CycloneDX SBOM & Build từ mã nguồn
description: Quy trình kiểm tra SBOM CycloneDX 1.5, biên dịch tái tạo LatticeDX v0.4.2 từ mã nguồn thuần OSI, đóng gói tarball phát hành và khóa digest SHA-256 cho container.
---

# CycloneDX SBOM & Build từ mã nguồn

LatticeDX `v0.4.2` cung cấp quy trình biên dịch khép kín từ mã nguồn bằng bộ công cụ nguồn mở 100%, đi kèm hồ sơ vật liệu phần mềm **CycloneDX 1.5** tất định (`docs/sbom-cyclonedx.json`) và cơ chế khóa bất biến `@sha256:` cho toàn bộ OCI container.

## Bộ công cụ yêu cầu (100% OSS Toolchain)

Quá trình biên dịch và kiểm chứng từ mã nguồn không sử dụng trình biên dịch độc quyền và không yêu cầu chỉnh sửa thủ công tệp nguồn hoặc header trước khi build.

| Thành phần | Phiên bản kiểm chứng | Vai trò |
| :--- | :--- | :--- |
| **Node.js** | `24.x` (`>=24 <25`) | Runtime thực thi build, script kiểm toán và dịch vụ `@dx/api`, `@dx/agent-worker`, `@dx/file-scanner` |
| **pnpm** | `10.23.0` | Quản lý monorepo workspace và khóa chính xác `pnpm-lock.yaml` (`packageManager` trong `package.json`) |
| **Git & tar** | Git + GNU/BSD `tar` | Truy xuất commit phát hành, đóng gói và giải nén `latticedx-0.4.2-src.tar.gz` |
| **Docker Engine & Compose** | Compose v2+ | Tùy chọn — kiểm tra cấu hình và vận hành 19 dịch vụ OCI bên ngoài (`infra/compose/*.yml`) |

## Kiểm tra CycloneDX 1.5 SBOM (`scripts/generate-sbom.mjs`)

Hồ sơ `docs/sbom-cyclonedx.json` được tạo trực tiếp từ trạng thái khóa của kho mã nguồn bởi `scripts/generate-sbom.mjs`. Kết quả đầu ra có tính tất định hoàn toàn: cùng một cây mã nguồn và lockfile luôn tạo ra cùng `serialNumber` (`urn:uuid:...` băm SHA-256 từ `CycloneDX/1.5`, root `bom-ref` và chuỗi phiên bản/hash thành phần) và cùng thứ tự JSON.

### Cấu trúc thành phần trong SBOM (`257` thành phần)

| Nguồn thu thập | Số lượng | Cơ chế trích xuất trong `generate-sbom.mjs` |
| :--- | :---: | :--- |
| **Workspace nội bộ** | `12` | `collectWorkspaceComponents()` quét `package.json` gốc, `apps/*`, `packages/*` và `plugins/nocobase/*`. |
| **Phụ thuộc npm** | `226` | `parsePnpmLockPackages()` (`pnpm-lock.yaml`) và `parseNpmPackageLock()` (`plugin-enterprise-auth/package-lock.json`); ánh xạ integrity sang `SHA-512`/`SHA-256` và phân giải giấy phép qua `node_modules` + bảng nhị phân nền tảng (gồm `fsevents@2.3.3 = MIT`). |
| **OCI Containers** | `19` | `parseComposeImages()` quét `infra/compose/*.yml`, bắt buộc định danh `@sha256:<64-hex>`, gắn PURL `pkg:oci/...` và ánh xạ giấy phép qua `OCI_IMAGE_LICENSES`. |

### Trích đoạn cấu trúc `docs/sbom-cyclonedx.json`

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:263d04fa-0790-4509-8cf5-0e09184dcd1a",
  "version": 1,
  "metadata": {
    "tools": {
      "components": [
        { "type": "application", "name": "lattice-dx-sbom-generator", "version": "0.4.2" }
      ]
    },
    "component": {
      "type": "application",
      "bom-ref": "pkg:npm/lattice-dx@0.4.2",
      "name": "lattice-dx",
      "version": "0.4.2",
      "purl": "pkg:npm/lattice-dx@0.4.2",
      "licenses": [{ "license": { "id": "Apache-2.0" } }]
    }
  }
}
```

### Phân giải giấy phép nhị phân nền tảng và kiểm soát chính sách

Khi chạy trên Linux hoặc Windows, `pnpm-lock.yaml` vẫn lưu các gói tùy chọn đặc thù hệ điều hành (như `fsevents@2.3.3` trên macOS hoặc các nhị phân native của `esbuild`, `rolldown`, `typescript`, `lightningcss`, `sharp`, `next`). `generate-sbom.mjs` ánh xạ giấy phép từ gói anh em cùng họ (`PLATFORM_BINARY_FAMILIES`) và bảng tĩnh `PLATFORM_OPTIONAL_PACKAGE_LICENSES` để bảo đảm toàn bộ `257` thành phần đều có giấy phép rõ ràng (`0` thành phần thiếu giấy phép).

Trước khi xuất tệp JSON, script áp dụng ba lớp chặn cứng:

- `assertAllowedLicense()` từ chối mọi biểu thức khớp `BSL-1.1` hoặc `Business Source License`.
- `assertAllowedComponentName()` từ chối mọi gói hoặc container chứa `thingsboard` hay `emqx`.
- `parseComposeImages()` dừng ngay nếu bất kỳ dòng `image:` nào trong `infra/compose/*.yml` thiếu chuỗi `@sha256:<64-hex>`.

<ParamGrid title="Tùy chọn CLI của scripts/generate-sbom.mjs" :items="[
  { name: '--check', type: 'flag', default: 'false', description: 'So sánh byte-by-byte giữa kết quả tính toán mới và tệp docs/sbom-cyclonedx.json; thoát mã 1 nếu có sai lệch.' },
  { name: '--out=<path>', type: 'string', default: 'docs/sbom-cyclonedx.json', description: 'Đường dẫn xuất tệp CycloneDX 1.5 JSON (tương đối theo root hoặc tuyệt đối).' },
  { name: '--json', type: 'flag', default: 'false', description: 'Xuất báo cáo tóm tắt JSON (khi đi kèm --check/--out) hoặc in thẳng SBOM ra stdout.' },
  { name: '--root=<dir>', type: 'string', default: 'REPO_ROOT', description: 'Chỉ định thư mục gốc khác để kiểm tra bản giải nén từ tarball phát hành.' }
]" />

<CodeTabs :tabs="[
  { label: 'Kiểm tra SBOM', lang: 'sh', code: 'pnpm release:sbom -- --check\nnode scripts/generate-sbom.mjs --check --json' },
  { label: 'Tái tạo SBOM', lang: 'sh', code: 'pnpm release:sbom\nnode scripts/generate-sbom.mjs --out=docs/sbom-cyclonedx.json' }
]" />

## Quy trình Build từ mã nguồn (`v0.4.2`)

### Bước 1: Tải và xác minh mã nguồn

Nhà phát triển có thể clone trực tiếp từ Git hoặc giải nén từ gói phát hành nguồn `.tar.gz`. Cả hai nguồn đều không chứa `.gitmodules` và không yêu cầu `git submodule`.

<CodeTabs :tabs="[
  { label: 'Từ gói .tar.gz (Linux/macOS)', lang: 'sh', code: 'sha256sum -c latticedx-0.4.2-src.tar.gz.sha256\ntar -xzf latticedx-0.4.2-src.tar.gz\ncd latticedx-0.4.2' },
  { label: 'Từ gói .tar.gz (PowerShell)', lang: 'powershell', code: 'Get-FileHash .\\latticedx-0.4.2-src.tar.gz -Algorithm SHA256\ntar -xzf .\\latticedx-0.4.2-src.tar.gz\ncd .\\latticedx-0.4.2' },
  { label: 'Từ kho Git', lang: 'sh', code: 'git clone https://github.com/CTU-OpenPaw/lattice-dx.git\ncd lattice-dx' }
]" />

### Bước 2: Cài đặt và biên dịch monorepo

```sh
pnpm install --frozen-lockfile
pnpm check
```

Lệnh `pnpm check` chạy tuần tự ba bước:
1. `pnpm typecheck`: kiểm tra kiểu TypeScript trên toàn bộ workspace và `solutions/logistics/tsconfig.json`.
2. `pnpm test`: thực thi bộ kiểm thử Vitest cho `tests/**/*.test.ts`, `apps/*/src/**/*.test.ts` và `packages/*/src/**/*.test.ts`.
3. `pnpm build`: biên dịch `@dx/contracts`, `@dx/api`, `@dx/agent-worker` và `@dx/file-scanner`.

### Bước 3: Biên dịch và kiểm thử bảy plugin NocoBase

Bảy plugin phiên bản `0.4.2` dùng chung phụ thuộc từ host (`"sdkProvidedByHost": true`) và biên dịch độc lập tại chỗ theo từng entrypoint riêng:

| Plugin | Script build | Đầu ra chính |
| :--- | :--- | :--- |
| `@latticedx/plugin-action-bridge` | `node plugins/nocobase/action-bridge/build.mjs` | `dist/` + `dist/externalVersion.js` |
| `@latticedx/plugin-lattice-foundation` | `node plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |
| `@latticedx/plugin-enterprise-auth` | `node plugins/nocobase/plugin-enterprise-auth/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |
| `@latticedx/plugin-dxos-para` | `node plugins/nocobase/plugin-dxos-para/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |
| `@latticedx/plugin-dxos-blocks` | `node plugins/nocobase/plugin-dxos-blocks/build.mjs` | `dist/client/index.js` (kèm MapLibre GL), `dist/server/index.js` |
| `@latticedx/plugin-dxos-studio` | `node plugins/nocobase/plugin-dxos-studio/build.mjs` | `dist/client/index.js` (kèm `@xyflow/react`), `dist/server/index.js` |
| `@latticedx/plugin-dxos-ai` | `node plugins/nocobase/plugin-dxos-ai/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |

```sh
# Cài đặt phụ thuộc khóa lockfile cho plugin-enterprise-auth (tắt lifecycle scripts)
npm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund

# Biên dịch lần lượt 7 plugin và chạy bộ kiểm thử đơn vị
for script in \
  plugins/nocobase/action-bridge/build.mjs \
  plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs \
  plugins/nocobase/plugin-enterprise-auth/build.mjs \
  plugins/nocobase/plugin-dxos-para/build.mjs \
  plugins/nocobase/plugin-dxos-blocks/build.mjs \
  plugins/nocobase/plugin-dxos-studio/build.mjs \
  plugins/nocobase/plugin-dxos-ai/build.mjs; do
  node "$script"
done

node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/nocobase-externals.test.mjs
```

## Đóng gói tarball phát hành (`scripts/build-oss-release-tarball.mjs`)

Lệnh `pnpm release:tarball` tạo gói `output/release/latticedx-0.4.2-src.tar.gz` kèm tệp băm `latticedx-0.4.2-src.tar.gz.sha256` bằng `git archive` từ một commit hợp lệ (`--ref=HEAD` mặc định hoặc `--ref=<tag|sha>`).

Trước khi hoàn tất, `assertTarballEntries()` kiểm tra danh sách tệp thực tế trong tệp nén:
- **Tệp quản trị bắt buộc (`REQUIRED_ENTRIES`):** `LICENSE`, `NOTICE`, `COPYRIGHT.txt`, `README.md`, `CHANGELOG.md`, `docs/build-from-source.md`.
- **Đường dẫn bị cấm (`FORBIDDEN_ENTRY_PATTERNS`):** `node_modules/`, `output/`, `.git/`, mọi tệp `.env*` trừ `.env.example`, tệp khóa `*.pem` / `*.key`, thư mục `upstream/` và `.gitmodules`.

### Kiểm chứng biên dịch sạch trên bản giải nén tarball

Để xác nhận gói nguồn không phụ thuộc vào lịch sử `.git/` hay bộ nhớ đệm cục bộ, giải nén tarball vào thư mục độc lập và chạy lại toàn bộ chuỗi kiểm tra:

```sh
mkdir clean-verify && tar -xzf output/release/latticedx-0.4.2-src.tar.gz -C clean-verify
cd clean-verify/latticedx-0.4.2
pnpm install --frozen-lockfile
pnpm check
node scripts/generate-sbom.mjs --check
```

## Khóa digest `@sha256:` cho toàn bộ 19 container OCI

Mọi service trong `infra/compose/*.yml` bắt buộc khai báo digest bất biến `@sha256:<64-hex>` thay cho thẻ tag động như `:latest`. Bảng dưới đây tổng hợp đầy đủ 19 digest đã khóa trong cấu hình phát hành `0.4.2`:

| Image | Digest SHA-256 (`@sha256:...`) |
| :--- | :--- |
| `nocobase/nocobase:2.2.50` | `04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777` |
| `postgres:16.16-alpine` | `f2f98726820d0342055351c6e9d36e705f5bfffb3dd53ff556325114b08afb6d` |
| `pgvector/pgvector:0.8.1-pg16` | `33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337` |
| `valkey/valkey:8.1-alpine` | `9971099af41c36e887aabdfe22b80c0fe45df949163dfc9cb434febc57cfc3fc` |
| `rustfs/rustfs:1.0.6` | `ee717072290bec9b11abfc0365f8310b00df1cd9b3639943edae47bdef05044a` |
| `caddy:2.10-alpine` | `4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d` |
| `quay.io/keycloak/keycloak:26.8.2` | `7e66a96e4739239070aeaf72e4c5decf0f7f682cfc725b9f7ea2b336eaba38b3` |
| `adorsys/keycloak-config-cli:6.5.1-26` | `1b22dfaa9ae0c71f74b0342f9221a6510f272da5def683dbba26a98e6b1b1411` |
| `apache/apisix:3.19.0-debian` | `9a7e45dc943fbf10ec916d1232bae4cda9302ae28a4696cfb83c2da01d261141` |
| `clamav/clamav:1.5.5` | `12177441d1b40cef3c47b44c4090d59d4babc4c67bedd5af0fa315e603aa6dd8` |
| `fiware/orion-ld:1.12.0` | `f562a93ed84cccae05063688e1c3605f75060d0c7b9cd004561eec43bcbd613b` |
| `mongo:8.0` | `479e85ced54ffb8a40dade1dcde2da2a9ae858515b9415e9cc54bfb8f0575d01` |
| `n8nio/n8n:2.48.1` | `5e022f23ef9eaac3f51467e021610c218ed7eb5b41a05edb388ef1c8e00e009f` |
| `eclipse-mosquitto:2.0.21` | `94f5a3d7deafa59fa3440d227ddad558f59d293c612138de841eec61bfa4d353` |
| `nodered/node-red:4.0.9` | `0b295b3a14c512548567ca99db631bc37b23bfc79fd009ee8248a610fafdb4b5` |
| `otel/opentelemetry-collector-contrib:0.123.0` | `e39311df1f3d941923c00da79ac7ba6269124a870ee87e3c3ad24d60f8aee4d2` |
| `prom/prometheus:v3.3.0` | `339ce86a59413be18d0e445472891d022725b4803fab609069110205e79fb2f1` |
| `grafana/grafana-oss:11.5.8` | `b8121de93047fd77c77de806bae9706e7d60de21c3bd5381a5db0167f94c6a48` |
| `gotenberg/gotenberg:8.20.1` | `cda4386c7ed38f18bc6897828be01ba7361c99929a5c84ec5e293d7916e29bac` |

Xác thực tính hợp lệ của toàn bộ tệp Compose trước khi triển khai bằng lệnh:

```sh
docker compose --env-file infra/compose/prod.env.example -f infra/compose/prod.yml \
  --profile n8n --profile iiot --profile observability --profile pdf --profile iam-sync config --quiet
```

## Tài liệu liên quan

- [Giấy phép & Chính sách Pure-OSI](/open-source/licensing)
- [Ranh giới bên thứ ba & NocoBase 2.2.50](/open-source/third-party-and-nocobase)
- [Hồ sơ cài đặt Docker Compose](/getting-started/installation-profiles)
- [Kiểm thử & Xác minh hệ thống](/operations/testing-and-verification)
