---
title: Đóng góp, Bảo mật & Chính sách phiên bản
description: Quy trình đóng góp mã nguồn, tiêu chuẩn Pull Request và CodeQL, báo cáo lỗ hổng bảo mật riêng tư và chính sách đánh phiên bản pre-major 0.x (0.4.2).
---

# Đóng góp, Bảo mật & Chính sách phiên bản

Quy trình đóng góp cho **LatticeDX `v0.4.2`** kết hợp quy tắc cấu trúc monorepo, kiểm tra tự động qua CI/CodeQL và cơ chế tiếp nhận lỗ hổng bảo mật riêng tư nhằm giữ ổn định mã nguồn `Apache-2.0` thuần chuẩn OSI.

## Cấu trúc mã nguồn và quy ước phát triển

Môi trường phát triển yêu cầu **Node.js `24.x`** (`>=24 <25`), **pnpm `10.23.0`**, **Git**, **tar** và **Docker Compose v2+** (khi kiểm thử stack container). Cài đặt phụ thuộc từ lockfile bằng lệnh:

```sh
git clone https://github.com/CTU-OpenPaw/lattice-dx.git
cd lattice-dx
pnpm install --frozen-lockfile
```

Khi bổ sung hoặc chỉnh sửa mã nguồn, cộng tác viên tuân thủ bốn quy tắc cấu trúc sau:

| Quy tắc | Phạm vi áp dụng | Yêu cầu kỹ thuật |
| :--- | :--- | :--- |
| **Phân tầng thư mục** | Toàn bộ kho mã | Đặt dịch vụ độc lập vào `apps/`, hợp đồng dùng chung vào `packages/`, extension NocoBase vào `plugins/nocobase/` và cấu hình hạ tầng vào `infra/`. |
| **Kích thước và ranh giới mô-đun** | `apps/`, `packages/`, `plugins/` | Giữ tệp nguồn mới gọn (khuyến nghị dưới `300` dòng mỗi tệp). Không import chéo mã nội bộ giữa các `apps/*`; giao tiếp qua `@dx/contracts` hoặc HTTP/REST API. |
| **Bảo toàn tệp tự sinh và kho sạch** | Git working tree | Không sửa `apps/web/next-env.d.ts`, không tạo `.gitmodules` hoặc `upstream/`, không commit `.env`, tệp `*.pem`/`*.key` hay thông tin nhạy cảm. |
| **Giấy phép và header SPDX** | Mọi tệp nguồn mới | Gắn đủ khối 6 dòng `@copyright (C) 2026 CTU-OpenPaw` + `SPDX-License-Identifier: Apache-2.0`; mọi dependency mới phải chuẩn OSI và cập nhật vào `NOTICE` cùng `docs/dependency-inventory.md`. |

## Quy trình Issue và Pull Request

Hệ sinh thái CTU-OpenPaw phân tách kho mã theo chức năng: `lattice-dx` lưu mã nguồn nền tảng lõi, `lattice-docs` chứa tài liệu VitePress, `lattice-templates` cung cấp Solution Bundle v3 và `.github` quản trị hồ sơ tổ chức. Khi mở Issue trên `CTU-OpenPaw/lattice-dx`, cần dùng đúng biểu mẫu trong `.github/ISSUE_TEMPLATE/`:

| Biểu mẫu / Tệp cấu hình | Mục đích sử dụng |
| :--- | :--- |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Báo cáo lỗi tái hiện được kèm môi trường, phiên bản và nhật ký tối thiểu |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Đề xuất tính năng, API hoặc block mở rộng mới |
| `.github/ISSUE_TEMPLATE/question_or_doc.md` | Câu hỏi kỹ thuật hoặc góp ý bổ sung tài liệu |
| `.github/ISSUE_TEMPLATE/config.yml` | Tắt blank issue (`blank_issues_enabled: false`) và điều hướng báo cáo bảo mật về Security Advisories |

Lịch sử commit áp dụng **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).

### Danh mục kiểm tra trước khi gửi Pull Request

Mẫu `.github/PULL_REQUEST_TEMPLATE.md` yêu cầu tác giả xác nhận đầy đủ các mục sau trước khi yêu cầu review:

| Hạng mục kiểm tra | Điều kiện đạt |
| :--- | :--- |
| **Header SPDX & Pure-OSI** | Đạt `node scripts/source-headers.mjs --check` và `pnpm release:sbom -- --check` |
| **Khóa phiên bản `0.4.x`** | Giữ nguyên phiên bản pre-major `0.4.2`, không tự ý nâng lên `1.0.0` |
| **Ranh giới NocoBase `2.2.50`** | Giữ nguyên `Powered by NocoBase`, `"sdkProvidedByHost": true`, không thêm `upstream/` hay `.gitmodules` |
| **Cô lập đa tenant & RBAC** | Kiểm tra chính sách PostgreSQL 16 `FORCE RLS` và phân quyền khi thay đổi model, migration hoặc route |
| **Vệ sinh cấu hình & kiểm thử** | Không lộ secret/PII, mọi image mới khóa `@sha256:`, đạt `pnpm check` và `node --test` |

<CodeTabs :tabs="[
  { label: 'Kiểm tra lõi & SPDX', lang: 'sh', code: 'pnpm check\nnode scripts/source-headers.mjs --check\npnpm release:sbom -- --check\npnpm audit --prod --audit-level=low' },
  { label: 'Kiểm thử Plugin & Externals', lang: 'sh', code: 'node --test \\\n  plugins/nocobase/*/tests/*.test.cjs \\\n  scripts/tests/*.test.mjs \\\n  tests/native-ui-fixture.test.mjs \\\n  tests/nocobase-externals.test.mjs' },
  { label: 'Kiểm tra Compose', lang: 'sh', code: 'docker compose -f infra/compose/core.yml config --quiet\ndocker compose -f infra/compose/nocobase.yml config --quiet\ndocker compose --env-file infra/compose/prod.env.example \\\n  -f infra/compose/prod.yml --profile n8n --profile iiot \\\n  --profile observability --profile pdf --profile iam-sync config --quiet' }
]" />

## Tiêu chuẩn CI và phân tích tĩnh CodeQL

Mọi Pull Request nhắm vào nhánh `main` của `CTU-OpenPaw/lattice-dx` đều phải vượt qua hai quy trình kiểm tra tự động tại `.github/workflows/`:

| Quy trình | Job / Cấu hình | Phạm vi kiểm tra |
| :--- | :--- | :--- |
| **`Check` (`ci.yml`)** | `check` | `pnpm check` (`typecheck`, `vitest`, `build`), `source-headers.mjs --check`, `release:sbom -- --check`, `eval-vietnamese-nl-agent.mjs --min-pass=95`, vệ sinh định danh và `node --test` cho 7 plugin |
| **`Check` (`ci.yml`)** | `dependency-audit` | Chạy `pnpm audit --prod --audit-level=moderate` và `pnpm audit --prod --audit-level=low` (không tồn đọng lỗ hổng production) |
| **`Check` (`ci.yml`)** | `compose-validate` | Kiểm tra cú pháp `docker compose config --quiet` trên toàn bộ tệp `core.yml`, `nocobase.yml`, `native-rehearsal.yml`, `integration.yml`, `native-files.yml`, `uc1-sample.yml`, `iiot.yml` và `prod.yml` |
| **`Check` (`ci.yml`)** | `trivy-scan` | Quét lỗ hổng `vuln`, cấu hình sai `misconfig` và bí mật `secret` mức `CRITICAL,HIGH` bằng `aquasecurity/trivy-action` (`ignore-unfixed: true`) |
| **`CodeQL` (`codeql.yml`)** | `Analyze (javascript-typescript)` | Phân tích tĩnh bằng `github/codeql-action/init@v4` với bộ truy vấn `security-extended` (`build-mode: none`) trên push/PR vào `main` và lịch quét hằng tuần (`0 3 * * 1`), xuất báo cáo SARIF |

### Chi tiết cấu hình kiểm soát trong CI và CodeQL

Quy trình `CodeQL` xuất kết quả sang định dạng SARIF (`sarif-results/`) và lưu trữ artifact trong `14` ngày phục vụ rà soát bảo mật. Với kho mã nguồn công khai, báo cáo SARIF được tải trực tiếp lên tab Security của GitHub (`upload: always`).

Ngoài kiểm tra biên dịch và lỗ hổng phụ thuộc, job `check` còn áp dụng hai quy tắc vệ sinh tự động:
1. Từ chối mọi tệp `.env` (trừ `.env.example`), khóa riêng tư (`*.pem`, `*.key`) hoặc chuỗi secret mẫu bị đưa vào cây Git.
2. Quét `git grep` toàn kho mã để bảo đảm không sót các định danh thương hiệu cũ trong mã sản phẩm và cấu hình triển khai.

## Ranh giới bảo mật và cảnh báo cấu hình cục bộ

Nhánh được hỗ trợ cập nhật bản vá bảo mật hiện tại là **`0.4.x`** (nhánh `main` trên `CTU-OpenPaw/lattice-dx`).

### Cảnh báo thông số fixture cục bộ

Các tệp mẫu trong `.env.example` và `infra/compose/*.yml` chứa thông số fixture công khai chỉ phục vụ kiểm thử trên loopback `127.0.0.1` / `localhost`. Tuyệt đối không dùng các giá trị mẫu này trên môi trường có truy cập mạng ngoài hoặc dữ liệu thật. Trước khi triển khai production, quản trị viên phải thay toàn bộ khóa và mật khẩu dưới đây:

| Biến môi trường mẫu (Loopback) | Giá trị fixture cục bộ | Yêu cầu thay thế trên Production |
| :--- | :--- | :--- |
| `POSTGRES_PASSWORD` / `POSTGRES_SUPERUSER_PASSWORD` | `local-demo-password` | Mật khẩu ngẫu nhiên mạnh tách biệt giữa `postgres` và các role `*_app` |
| `NOCOBASE_DB_PASSWORD` / `NOCOBASE_APP_DB_PASSWORD` | `local-nocobase-password` | Tách riêng quyền migration (`nocobase`) và quyền runtime `NOBYPASSRLS` (`nocobase_app`) |
| `REDIS_PASSWORD` | `local-redis-password` | Chuỗi bí mật mới cho Valkey `8.1` (`CACHE_REDIS_URL`, `PUBSUB_ADAPTER_REDIS_URL`, DB 2) |
| `NOCOBASE_APP_KEY` / `NOCOBASE_ENCRYPTION_FIELD_KEY` | Giá trị fixture cục bộ | Khóa tối thiểu 32 ký tự / 32-byte dùng cho phiên JWT và bọc khóa AES-256-GCM |
| `APISIX_OIDC_CLIENT_SECRET` / `LATTICE_TRACK_VERIFY_SECRET` | Giá trị mẫu tích hợp | Bí mật riêng cấp từ Keycloak `dx-gateway` và khóa HMAC cho QR `/v/track/:code` |

### Các lớp bảo vệ cốt lõi

| Lớp bảo mật | Cơ chế thực thi |
| :--- | :--- |
| **Định danh và phiên làm việc** | Core API xác minh chữ ký JWT từ Keycloak (`OIDC_ISSUER` / `OIDC_JWKS_URL`) và khóa lạc quan `expectedVersion`; `@latticedx/plugin-enterprise-auth` dùng Authorization Code + PKCE `S256` kèm danh sách thu hồi trên Valkey DB 2. |
| **Cô lập dữ liệu cấp hàng** | PostgreSQL 16 áp dụng `FORCE ROW LEVEL SECURITY` trên 56 bảng tĩnh và các bảng động `latticeCustom*` dưới vai trò không đặc quyền `nocobase_app` (`NOBYPASSRLS`), gắn biến phiên `app.current_org` theo từng giao dịch. |
| **Quét mã độc tệp tải lên** | Dịch vụ `apps/file-scanner` chuyển tệp qua ClamAV (`clamav/clamav:1.5.5`) theo giao thức TCP trước khi cấp quyền truy cập lưu trữ S3 trên RustFS. |
| **Toàn vẹn container** | Toàn bộ 19 OCI container images trong `infra/compose/*.yml` khóa phiên bản bằng digest `@sha256:` bất biến. |

## Quy trình báo cáo lỗ hổng bảo mật

Không công khai lỗ hổng bảo mật, token xác thực, tệp `.env`, khóa riêng tư hoặc dữ liệu nhạy cảm trong GitHub Issues hay Pull Requests công khai.

Khi phát hiện điểm yếu bảo mật, hãy gửi báo cáo riêng tư qua **GitHub Security Advisories** của kho mã:

```text
https://github.com/CTU-OpenPaw/lattice-dx/security/advisories/new
```

Báo cáo cần kèm mô tả phạm vi ảnh hưởng, các bước tái hiện tối thiểu và commit SHA hoặc thẻ phiên bản liên quan để nhóm duy trì xác minh và phối hợp phát hành bản vá.

## Chính sách phiên bản `0.x` (`0.4.2`)

LatticeDX tuân thủ quy ước đánh phiên bản pre-major (`< 1.0.0`) theo Semantic Versioning, hiện khóa đồng bộ tại phiên bản **`0.4.2`**:

<ParamGrid title="Quy ước đánh phiên bản pre-major 0.x của LatticeDX" :items="[
  { name: '0.4.2', type: 'current', required: true, description: 'Phiên bản ổn định hiện hành trên toàn bộ root package.json, 7 plugin NocoBase, lattice-docs và gói phát hành nguồn.' },
  { name: '0.4.x (PATCH)', type: 'compatible', description: 'Các bản vá bảo mật, sửa lỗi runtime và hoàn thiện kiểm chứng giữ nguyên tương thích với NocoBase 2.2.50 và Solution Bundle v3.' },
  { name: '0.x.0 (MINOR)', type: 'breaking-pre-1', description: 'Có thể thay đổi lược đồ CSDL, cấu trúc API nội bộ hoặc hợp đồng plugin trước khi mở mốc ổn định 1.0.0.' },
  { name: '< 1.0.0 lock', type: 'policy', required: true, description: 'Không nâng lên 1.0.0 khi chưa hoàn tất chu kỳ ổn định API dài hạn và đồng bộ đa kho.' }
]" />

Mỗi lần phát hành bản vá trong dải `0.4.x` đều đồng bộ số phiên bản trên các tệp sau:
- `package.json` gốc (`"version": "0.4.2"`).
- Cả bảy tệp `plugins/nocobase/*/package.json` (`"version": "0.4.2"`).
- `lattice-docs/package.json` (`"version": "0.4.2"`).
- `COPYRIGHT.txt`, `docs/sbom-cyclonedx.json` và tên gói `latticedx-0.4.2-src.tar.gz`.

### Quy trình xác minh trước khi gắn thẻ phát hành

Trước khi tạo thẻ phát hành trong dải `0.4.x`, nhóm bảo trì chạy tuần tự chuỗi lệnh xác minh trên commit đích:

```sh
pnpm check
node scripts/source-headers.mjs --check
pnpm release:sbom -- --check
pnpm audit --prod --audit-level=low
pnpm release:tarball --ref=HEAD
```

Kết quả đầu ra `output/release/latticedx-0.4.2-src.tar.gz` và tệp `.sha256` đi kèm được giải nén vào thư mục sạch để xác nhận toàn bộ monorepo biên dịch độc lập không cần lịch sử Git.

## Tài liệu liên quan

- [Giấy phép & Chính sách Pure-OSI](/open-source/licensing)
- [CycloneDX SBOM & Build từ mã nguồn](/open-source/sbom-and-source-build)
- [Mô hình bảo mật Zero-Trust](/architecture/security-model)
- [Cô lập đa tenant PostgreSQL FORCE RLS](/architecture/multi-tenancy-rls)
