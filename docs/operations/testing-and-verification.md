---
title: Kiểm thử và Xác minh Hệ thống
description: Quy trình kiểm thử đơn vị, hợp đồng plugin, cô lập PostgreSQL RLS, đánh giá AI tiếng Việt và kiểm định CI trong LatticeDX.
---

# Kiểm thử và Xác minh Hệ thống

LatticeDX áp dụng quy trình xác minh nhiều tầng cho cả mã nguồn không phụ thuộc hạ tầng (kiểm tra kiểu, kiểm thử đơn vị, hợp đồng plugin, đánh giá định tuyến ngôn ngữ tự nhiên) lẫn kiểm thử tích hợp trên cụm Docker Compose đang chạy (cô lập tổ chức, luồng OIDC, quét tệp ClamAV, đồng bộ NGSI-LD và diễn tập khôi phục).

## Cấu trúc các tầng kiểm thử

| Tầng xác minh | Công cụ / Trình chạy | Phụ thuộc dịch vụ chạy nền | Mục tiêu kiểm chứng |
| :--- | :--- | :--- | :--- |
| Typecheck, Unit & Build | `pnpm check` (`tsc`, `vitest`) | Không | Kiểm tra kiểu TypeScript trên các workspace `@dx/*`, unit test Vitest và đóng gói build. |
| Hợp đồng 7 Plugin & Scripts | `node --test` | Không | Kiểm định logic nghiệp vụ, bảng RLS, parser FEEL/DMN, bộ xuất OTel, khóa PKI và recovery scripts. |
| Đánh giá NL Router tiếng Việt | `eval-vietnamese-nl-agent.mjs` | Không | Đánh giá độ chính xác định tuyến 20 công cụ hợp nhất và từ chối prompt injection / leo thang quyền. |
| Tuân thủ Mã nguồn & Chuỗi cung ứng | `source-headers.mjs`, `pof:check`, `release:sbom` | Không | Xác minh header Apache-2.0, 6 tiêu chí cô lập Pure-OSI, tính mới của CycloneDX SBOM và `pnpm audit`. |
| Sẵn sàng & Tích hợp Live Stack | `local:doctor`, `smoke-*.mjs`, `acceptance-*.mjs` | Có (Docker Compose) | Kiểm thử luồng đầu cuối qua APISIX, Keycloak, `nocobase`, PostgreSQL 16, ClamAV, Orion-LD và Mosquitto. |

## Kiểm thử không cần Docker (Unit, Hợp đồng và Đánh giá AI)

Các kiểm tra tĩnh và kiểm thử hợp đồng chạy trực tiếp với Node.js 24 và `pnpm 10.23.0`, phù hợp cho phản hồi cục bộ trước khi tạo Pull Request.

<CodeTabs
  :tabs="[
    {
      label: 'Workspace Check',
      lang: 'bash',
      code: 'pnpm typecheck\npnpm test\npnpm build\n# Hoặc chạy gộp toàn bộ\npnpm check'
    },
    {
      label: 'Plugin & Script Suites',
      lang: 'bash',
      code: 'node --test \\\n  plugins/nocobase/plugin-lattice-foundation/tests/*.test.cjs \\\n  plugins/nocobase/action-bridge/tests/*.test.cjs \\\n  plugins/nocobase/plugin-enterprise-auth/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-para/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-blocks/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-studio/tests/*.test.cjs \\\n  plugins/nocobase/plugin-dxos-ai/tests/*.test.cjs \\\n  scripts/tests/*.test.mjs \\\n  tests/native-ui-fixture.test.mjs \\\n  tests/nocobase-externals.test.mjs'
    },
    {
      label: 'Vietnamese NL Eval',
      lang: 'bash',
      code: 'node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95'
    }
  ]"
/>

### Bộ đánh giá định tuyến ngôn ngữ tự nhiên tiếng Việt

Tập lệnh `scripts/eval-vietnamese-nl-agent.mjs` gọi trực tiếp `parseVietnameseNaturalIntent` trong `plugin-dxos-ai` qua 7 nhóm tình huống kiểm thử hành vi:

| Nhóm đánh giá | Công cụ / Hành vi mục tiêu | Điều kiện đạt |
| :--- | :--- | :--- |
| `rag-search` | `dxos_search_enterprise_context` | Ánh xạ đúng câu hỏi SOP, sự cố kho lạnh, đơn hàng và tài sản. |
| `workflow-tasks` | `dxos_my_workflow_tasks` | Nhận diện tác vụ chờ phê duyệt và xác nhận giao hàng của người dùng. |
| `orchestration` | `dxos_orchestrate_enterprise_case` | Kích hoạt radar phát hiện điểm nghẽn liên phòng ban. |
| `alarm-ops` | `dxos_alarm_action` | Phân biệt chính xác `action: ack` (tiếp nhận) và `action: clear` (đóng cảnh báo). |
| `creative-architect` | `dxos_design_creative_block`, `dxos_compose_page_blocks` | Trích xuất đúng `widgetType`, ngưỡng cảnh báo, vị trí cạnh tiêu đề cho `isAdmin: true`. |
| `admin-provision` / `admin-rollback` | `dxos_provision_role_workspace`, `dxos_snapshot_or_rollback_page` | Khóa đúng cột dữ liệu và điều phối khôi phục giao diện cổng nghiệp vụ. |
| `security-refusal` | Từ chối thực thi (`refused: true`) | Chặn trích xuất `.env`, khóa `AGENT_API_KEY`, SQL `DROP TABLE`/`UNION SELECT` và thao tác thiếu quyền `isAdmin`. |

Cờ `--min-pass=95` bắt buộc tỷ lệ đạt tổng thể từ `95%` trở lên mới trả về mã thoát `0`.

## Xác minh cô lập đa tổ chức PostgreSQL 16 (`FORCE RLS`)

Kiểm chứng cơ chế cô lập dữ liệu theo tenant thực hiện ở hai cấp độ:

1. **Cấp độ đơn vị (`m1-rls-security.test.cjs` và `pg-rls-and-observability.test.cjs`)**: xác minh danh mục 56 bảng tĩnh (`54` bảng camelCase dùng `"organizationId"` và `2` bảng snake_case `lattice_native_request_attachments`, `lattice_native_request_uploads` dùng `"organization_id"`), kiểm tra `assertSafeSqlIdentifier`, và mô phỏng bộ theo dõi giao dịch bắt buộc `set_config('app.current_org', :orgId, true)` hoặc `set_config('app.rls_bypass', 'on', true)` kèm `SAVEPOINT`.
2. **Cấp độ cơ sở dữ liệu thực tế**: truy vấn trực tiếp danh mục hệ thống PostgreSQL `pg_class` và `pg_policies` bằng vai trò ứng dụng `nocobase_app` (`NOSUPERUSER NOBYPASSRLS`) để bảo đảm không có bảng tenant hoặc bảng động `latticeCustom*` nào bị thiếu `FORCE ROW LEVEL SECURITY`.

<CodeTabs
  :tabs="[
    {
      label: 'Chạy test RLS cục bộ',
      lang: 'bash',
      code: 'node --test plugins/nocobase/plugin-lattice-foundation/tests/m1-rls-security.test.cjs plugins/nocobase/plugin-lattice-foundation/tests/pg-rls-and-observability.test.cjs'
    },
    {
      label: 'Truy vấn kiểm chứng PG16',
      lang: 'sql',
      code: '-- 1. Xác nhận 56+ bảng lattice* bật cả relrowsecurity và relforcerowsecurity\nSELECT c.relname, c.relrowsecurity, c.relforcerowsecurity\nFROM pg_class c\nJOIN pg_namespace n ON n.oid = c.relnamespace\nWHERE n.nspname = \x27public\x27\n  AND (c.relname LIKE \x27lattice%\x27 OR c.relname LIKE \x27lattice_%\x27)\nORDER BY c.relname;\n\n-- 2. Kiểm tra chính sách lattice_tenant_isolation đang sử dụng app.current_org\nSELECT tablename, policyname, cmd, qual, with_check\nFROM pg_policies\nWHERE schemaname = \x27public\x27 AND policyname = \x27lattice_tenant_isolation\x27;\n\n-- 3. Kiểm tra vai trò ứng dụng không mang quyền BYPASSRLS\nSELECT rolname, rolsuper, rolbypassrls\nFROM pg_roles\nWHERE rolname IN (\x27nocobase_app\x27, \x27lattice_app\x27, \x27keycloak_app\x27, \x27n8n_app\x27);'
    }
  ]"
/>

## Kiểm thử tích hợp và End-to-End trên Stack đang chạy

Sau khi khởi động cụm Docker Compose cục bộ (`pnpm local:up` hoặc `docker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml up -d`), các tập lệnh `smoke-*` và `acceptance-*` thực hiện gọi HTTP thực tế qua APISIX (`http://localhost:8080`), Keycloak (`http://localhost:8081`) và NocoBase (`http://localhost:13000`).

<ParamGrid
  title="Các tập lệnh kiểm thử tích hợp trong package.json"
  :items="[
    { name: 'pnpm local:doctor', type: 'script', description: 'Kiểm tra metadata sẵn sàng trên loopback cho API (/ready), Keycloak OIDC discovery, NocoBase; hỗ trợ --integration và --agent.' },
    { name: 'pnpm test:foundation', type: 'script', description: 'Kiểm tra vòng đời task, xung đột phiên bản lạc quan (409), cách ly org-a/org-b, quét ClamAV sạch và chuỗi kiểm thử EICAR bị chặn.' },
    { name: 'pnpm test:nocobase', type: 'script', description: 'Kiểm tra khởi tạo NocoBase host, nạp 7 plugin @latticedx/* và định tuyến cơ bản.' },
    { name: 'pnpm test:scanner-outage', type: 'script', description: 'Kiểm thử hành vi fail-closed khi dịch vụ ClamAV hoặc file-scanner tạm thời mất kết nối.' },
    { name: 'pnpm acceptance:logistics-rbac', type: 'script', description: 'Kiểm thử luồng OMS/WMS, phân bổ FEFO, ePOD và kiểm soát quyền theo vai trò.' },
    { name: 'pnpm acceptance:dxos-ai-mcp', type: 'script', description: 'Xác minh tác vụ AI Studio, MCP JSON-RPC (/api/dxos-mcp), hạn mức và dấu vết kiểm toán.' },
    { name: 'pnpm acceptance:headless-paas', type: 'script', description: 'Kiểm thử khóa API ldx_pat_*, chữ ký Ed25519/Merkle ledger và OpenAPI/AsyncAPI.' },
    { name: 'pnpm acceptance:broker-automation-builder', type: 'script', description: 'Kiểm thử nạp dữ liệu IIoT, quy tắc tự động hóa DAG và trình dựng ứng dụng.' },
    { name: 'pnpm test:native-recovery', type: 'script', description: 'Xác minh sao lưu, đối chiếu MD5 fingerprint bảng và khôi phục dữ liệu NocoBase.' }
  ]"
/>

Lưu ý môi trường: `pnpm test:agent-provider` và `pnpm test:agent-worker-live` yêu cầu tệp `.env.agent` đã khai báo khóa mô hình hợp lệ; các lệnh smoke còn lại hoạt động với biến môi trường mặc định trong `.env.example`.

### Kiểm tra tính sẵn sàng bằng `pnpm local:doctor`

`scripts/check-local.mjs` thực hiện các truy vấn HTTP `GET` chỉ đọc (không tạo phiên, không ghi dữ liệu và không gọi mô hình AI) tới `127.0.0.1` với giới hạn timeout `3000ms` mỗi dịch vụ:

```json
{
  "scope": "service-readiness",
  "ok": true,
  "businessFlowsVerified": false,
  "checks": [
    { "service": "engine", "status": "ready", "httpStatus": 200 },
    { "service": "keycloak", "status": "ready", "httpStatus": 200 },
    { "service": "nocobase", "status": "ready", "httpStatus": 200 }
  ]
}
```

Thêm cờ `--integration` để kiểm tra thêm `orion-ld` (`:1026/version`) và `n8n` (`:5678/healthz`) trước khi chạy `pnpm test:ngsi-ld-postgres` hoặc `pnpm test:incident-agent`.

## Cổng kiểm định CI, Compose và An toàn Chuỗi cung ứng

Quy trình CI tại `.github/workflows/ci.yml` chạy bốn job độc lập trên mỗi Push và Pull Request vào `main`:

| Job CI | Lệnh / Công cụ kiểm tra |
| :--- | :--- |
| `check` | Chạy `pnpm check`, `node scripts/source-headers.mjs --check`, `pnpm pof:check`, `pnpm release:sbom -- --check`, `eval-vietnamese-nl-agent.mjs --min-pass=95`, kiểm tra vệ sinh từ khóa và toàn bộ `node --test`. |
| `dependency-audit` | Chạy `pnpm audit --prod --audit-level=low` nhằm bảo đảm không tồn tại lỗ hổng phụ thuộc production ở mọi mức độ. |
| `compose-validate` | Chạy `docker compose config --quiet` trên toàn bộ các tệp trong `infra/compose/` (`core.yml`, `nocobase.yml`, `native-rehearsal.yml`, `integration.yml`, `native-files.yml`, `uc1-sample.yml`, `iiot.yml`, và `prod.yml` với đầy đủ các profile). |
| `trivy-scan` | Chạy `aquasecurity/trivy-action` kiểm tra lỗ hổng, cấu hình sai và rò rỉ bí mật ở mức `CRITICAL,HIGH`. |

### Sáu hạng mục trong `scripts/verify-pof-readiness.mjs` (`pnpm pof:check`)

- `spdx-headers`: Mọi tệp mã nguồn thuộc sở hữu dự án đều mang thẻ `SPDX-License-Identifier: Apache-2.0`.
- `governance-files`: Xác nhận sự hiện diện và nội dung hợp lệ của `LICENSE`, `NOTICE`, `COPYRIGHT.txt`, `CONTRIBUTING.md`, `SECURITY.md` và các tài liệu nguồn mở bắt buộc.
- `plugin-isolation`: Xác minh cả 7 plugin đều khai báo `"sdkProvidedByHost": true` và không nhúng trực tiếp mã nguồn host bên ngoài.
- `compose-digests`: Xác minh mọi `image:` trong `infra/compose/*.yml` đều khóa bằng `@sha256:...` bất biến.
- `upstream-clean`: Xác nhận không tồn tại `.gitmodules` hay thư mục `upstream/nocobase` trong cây Git.
- `no-secrets`: Quét toàn bộ cây tệp theo mẫu khóa API và khóa bí mật PEM để chặn rò rỉ thông tin nhạy cảm.

<CodeTabs
  :tabs="[
    {
      label: 'Chạy bộ kiểm định phát hành',
      lang: 'bash',
      code: 'node scripts/source-headers.mjs --check\npnpm pof:check\npnpm release:sbom -- --check\npnpm audit --prod --audit-level=low'
    },
    {
      label: 'Kiểm tra cấu hình Compose',
      lang: 'bash',
      code: 'docker compose --env-file infra/compose/prod.env.example \\\n  -f infra/compose/prod.yml \\\n  --profile n8n --profile iiot --profile observability --profile pdf --profile iam-sync \\\n  config --quiet'
    }
  ]"
/>

## Tài liệu liên quan

- [Đa tổ chức và PostgreSQL RLS](/architecture/multi-tenancy-rls)
- [Đánh giá AI và Hàng rào Bảo vệ](/ai/eval-and-guardrails)
- [SBOM và Biên dịch từ Mã nguồn](/open-source/sbom-and-source-build)
- [Sao lưu và Khôi phục Thời điểm](/operations/backup-and-pitr)
