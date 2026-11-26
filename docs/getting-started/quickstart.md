---
title: Cài đặt nhanh
description: Khởi chạy LatticeDX 0.4.2 trên máy cục bộ qua môi trường sạch pnpm native:clean hoặc cụm phát triển đầy đủ pnpm local:up và kiểm tra sức khỏe dịch vụ.
---

# Cài đặt nhanh

LatticeDX (`0.4.2`) cung cấp hai chế độ khởi chạy cục bộ hoàn toàn độc lập: môi trường lab cô lập một lệnh (`pnpm native:clean`) trên `infra/compose/native-rehearsal.yml` và cụm phát triển đa dịch vụ (`pnpm local:up`) trên `core.yml` cùng `nocobase.yml`. Mọi cổng mạng phát triển đều gắn cứng vào `127.0.0.1` để tránh phơi bày dịch vụ ra giao diện mạng công cộng.

## Yêu cầu công cụ trên máy trạm

Chuẩn bị đúng phiên bản công cụ nguồn mở trước khi nhân bản kho mã nguồn hoặc cài đặt gói phụ thuộc:

| Thành phần | Phiên bản yêu cầu | Lệnh kiểm tra | Vai trò trong workspace |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>=24 <25` (`24.x`) | `node -v` | Biên dịch workspace (`TypeScript 7.0.2`), chạy Fastify API/Worker và đóng gói `7` plugin NocoBase. |
| **pnpm** | `10.23.0` | `pnpm -v` | Quản lý monorepo và lockfile (`"packageManager": "pnpm@10.23.0"`). |
| **npm CLI** | Đi kèm Node 24 | `npm -v` | Khôi phục ngoại tuyến gói khóa phụ thuộc cho `@latticedx/plugin-enterprise-auth` (`npm ci --ignore-scripts`). |
| **Git** | `2.30+` | `git --version` | Xuất mã nguồn sạch qua `git archive` khi chạy `pnpm native:clean`. |
| **tar** | GNU hoặc BSD `tar` | `tar --version` | Giải nén kho lưu trữ mã nguồn `source.tar` vào thư mục lab tạm thời. |
| **Docker Engine & Compose** | Compose `v2+` | `docker compose version` | Chạy `nocobase/nocobase:2.2.50` cùng `pgvector`, `Valkey`, `Keycloak` và `Apache APISIX`. |

Trên Windows 10/11 (WSL 2 + Docker Desktop), đảm bảo Docker Desktop đang hoạt động ở ngữ cảnh `desktop-linux` (`pnpm docker:start` gọi `scripts/docker-desktop.ps1`). Nếu chưa cài `pnpm@10.23.0`, kích hoạt qua Corepack:

```sh
corepack enable
corepack prepare pnpm@10.23.0 --activate
```

## Đường dẫn 1: Khởi chạy lab cô lập (`pnpm native:clean`)

Script `scripts/native-clean-install.mjs` tự động xuất mã nguồn sạch từ `HEAD` bằng `git archive`, kiểm tra cơ sở dữ liệu `nocobase-db` trống hoàn toàn (`0` bảng trong schema `public`), khởi chạy `nocobase/nocobase:2.2.50`, cài đặt và kích hoạt tuần tự `7` plugin `@latticedx/*`, chạy toàn bộ migration và lưu báo cáo tại `output/native-clean/<id>/report.json`.

<ParamGrid
  title="Tham số CLI của pnpm native:clean"
  :items="[
    { name: '--port', type: 'integer (13004..13999)', default: '13004', description: 'Cổng loopback 127.0.0.1 gán cho container NocoBase cô lập.' },
    { name: '--blank-slate', type: 'boolean flag', default: 'false', description: 'Đặt LATTICE_SKIP_DEMO_SEED=1, xác nhận 0 dữ liệu mẫu, chạy kiểm tra App Builder + MCP và tự động gỡ stack.' },
    { name: '--keep', type: 'boolean flag', default: 'false', description: 'Giữ lại container và volume sau khi kiểm tra --blank-slate hoàn tất.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'Clean Lab (Giữ cụm để thao tác)',
      lang: 'bash',
      code: 'git clone https://github.com/CTU-OpenPaw/lattice-dx.git\ncd lattice-dx\npnpm install --frozen-lockfile\npnpm native:clean -- --port=13004'
    },
    {
      label: 'Blank-Slate (Kiểm tra trắng & tự dọn)',
      lang: 'bash',
      code: 'pnpm native:clean -- --port=13005 --blank-slate'
    },
    {
      label: 'Blank-Slate (Giữ cụm sau kiểm tra)',
      lang: 'bash',
      code: 'pnpm native:clean -- --port=13005 --blank-slate --keep'
    }
  ]"
/>

Các bước diễn ra tuần tự trong `nativeCleanInstall`:

1. Tạo mã định danh ngẫu nhiên `<id>` gồm `12` ký tự hex, tạo dự án Docker Compose riêng mang tên `lattice-native-clean-<id>` để không xung đột với môi trường làm việc chính.
2. Khởi chạy `nocobase-db` (`pgvector/pgvector:0.8.1-pg16`) và xác nhận `SELECT count(*) FROM pg_tables WHERE schemaname='public'` trả về `0`.
3. Khởi chạy `nocobase` (`nocobase/nocobase:2.2.50`) và chờ `GET http://127.0.0.1:<port>/api/app:getLang` trả về HTTP `200`.
4. Sao lưu snapshot cơ sở dữ liệu ban đầu, biên dịch cả `7` plugin, đóng gói `npm pack --offline` bên trong container và thực thi `yarn nocobase pm add` + `yarn nocobase pm enable`, sau đó chạy `yarn nocobase upgrade`.
5. Xác nhận toàn bộ migration mang tiền tố `/@latticedx/` đã áp dụng trong bảng `migrations`. Ở chế độ mặc định (không truyền `--blank-slate`), script thiết lập tài khoản fixture cục bộ và in `pageUrl` kèm `reportPath` ra stdout.

## Đường dẫn 2: Cụm phát triển đầy đủ (`pnpm local:up`)

Khi cần phát triển đồng thời với `Apache APISIX`, `Keycloak 26.8.2`, `ClamAV`, `@dx/api` (Fastify), `FIWARE Orion-LD`, hoặc `n8n`, sử dụng `scripts/start-local.mjs` để dựng chồng `core.yml`, `nocobase.yml` và tùy chọn `integration.yml` / `iiot.yml`.

<CodeTabs
  :tabs="[
    {
      label: 'Core + NocoBase',
      lang: 'bash',
      code: 'cp .env.example .env\npnpm install --frozen-lockfile\npnpm local:up'
    },
    {
      label: 'Kèm Orion-LD & n8n',
      lang: 'bash',
      code: '# Tạo .env.integration có N8N_ENCRYPTION_KEY (tối thiểu 32 ký tự)\necho N8N_ENCRYPTION_KEY=$(openssl rand -hex 24) > .env.integration\npnpm local:up -- --integration'
    },
    {
      label: 'Thêm lớp IIoT (Mosquitto + Node-RED)',
      lang: 'bash',
      code: 'docker compose -f infra/compose/iiot.yml up -d'
    }
  ]"
/>

Sau khi chỉnh sửa mã nguồn trong `plugins/nocobase/*`, đồng bộ lại gói plugin vào container `nocobase.yml` đang chạy bằng một lệnh:

```sh
pnpm workspace:install
```

Lệnh `pnpm workspace:install` tự động tạo bản sao lưu `pg_dump` vào `output/backups/` trước khi build lại `7` plugin, khởi động lại container `nocobase` và kích hoạt lại từng gói qua `yarn nocobase pm`.

## Kiểm tra sức khỏe dịch vụ và xác minh hệ thống

Chạy `pnpm local:doctor` (`scripts/check-local.mjs`) để thăm dò toàn bộ endpoint metadata trên `127.0.0.1` mà không ghi dữ liệu hay gọi mô hình AI:

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra cơ bản',
      lang: 'bash',
      code: 'pnpm local:doctor'
    },
    {
      label: 'Kèm Integration & Agent',
      lang: 'bash',
      code: 'pnpm local:doctor -- --integration --agent'
    },
    {
      label: 'Xác minh Plugin & RLS trong DB',
      lang: 'bash',
      code: 'docker compose -f infra/compose/nocobase.yml exec -T nocobase yarn nocobase pm list\ndocker compose -f infra/compose/nocobase.yml exec -T nocobase-db \\\n  psql -U nocobase -d nocobase -c \'SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname LIKE $$lattice%$$ ORDER BY relname LIMIT 10;\''
    }
  ]"
/>

Danh sách cổng và endpoint kiểm tra tương ứng của cụm phát triển cục bộ:

| Dịch vụ | Địa chỉ cục bộ | Endpoint kiểm tra | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **APISIX Gateway & Fastify API** | `http://127.0.0.1:8080` | `GET /ready` | `{"status":"ready","service":"api"}` |
| **Keycloak OIDC (`lattice`)** | `http://127.0.0.1:8081` | `GET /realms/lattice/.well-known/openid-configuration` | `issuer` khớp `http://localhost:8081/realms/lattice` |
| **NocoBase Host (`2.2.50`)** | `http://127.0.0.1:13000` | `GET /api/app:getLang` | Trả về chuỗi `data.lang` hợp lệ |
| **FIWARE Orion-LD (`1.12.0`)** | `http://127.0.0.1:1026` | `GET /version` | Có trường `orionld version` |
| **Stock n8n (`2.48.1`)** | `http://127.0.0.1:5678` | `GET /healthz` | `{"status":"ok"}` |
| **Node-RED (`4.0.9`)** | `http://127.0.0.1:1880` | `GET /` | Mã HTTP `< 500` |

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listProfiles"
  auth="Bearer JWT (root | ldx_admin)"
  summary="Xác nhận 7 Agent Profile (gồm dxos-architect) đã được khởi tạo và đồng bộ sau cài đặt."
/>

## Lưu ý bảo mật và dọn dẹp môi trường

### Khóa bảo vệ chống ghi đè

`scripts/native-clean-install.mjs` từ chối khởi chạy nếu dự án Compose, volume hoặc network đã tồn tại, và dừng ngay nếu `nocobase-db` đã có bảng trong schema `public`.

### Thông tin đăng nhập thử nghiệm

Tài khoản mẫu được tạo bởi `setup-native-ui-lab.mjs` (lưu trong `output/native-platform/ui-lab.json`) hoặc thông số mặc định của `.env.example` chỉ dùng trên `127.0.0.1`. Khi triển khai lên máy chủ thật, chuyển sang `infra/compose/prod.yml` và thay toàn bộ secret.

### Thu dọn container sau khi kết thúc

Luôn tắt sạch cụm phát triển hoặc lab cô lập để giải phóng bộ nhớ và volume tạm:

```sh
# Dừng cụm core + nocobase
docker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml down

# Nếu đã bật thêm integration và iiot
docker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml -f infra/compose/integration.yml -f infra/compose/iiot.yml down

# Dọn sạch một clean-lab theo project ID trong report.json
docker compose -p lattice-native-clean-<id> down -v --remove-orphans
```

## Tài liệu liên quan

- [Hồ sơ cài đặt và Compose](/getting-started/installation-profiles) — Chi tiết từng file Compose, 5 profile trong `prod.yml` và định cỡ RAM/CPU.
- [Cấu hình biến môi trường](/getting-started/configuration) — Danh mục đầy đủ các biến `.env` theo từng phân hệ.
- [Triển khai sản xuất Zero-Trust](/getting-started/production-deployment) — Cấu hình Caddy TLS, APISIX, Keycloak MFA và vai trò `nocobase_app`.
- [Kiểm thử và xác minh](/operations/testing-and-verification) — Chạy bộ kiểm tra đơn vị, tích hợp và cô lập RLS.
