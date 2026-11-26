---
title: Triển khai Production Zero-Trust
description: Kiến trúc triển khai production trên infra/compose/prod.yml với 5 mạng cô lập, Caddy 2.10, APISIX 3.19.0, Keycloak OIDC/PKCE, Valkey 8.1 phân vùng DB 0/1/2, role nocobase_app và image khóa digest @sha256.
---

# Triển khai Production Zero-Trust

Tệp `infra/compose/prod.yml` (`name: lattice-dx-prod`) định nghĩa cấu trúc triển khai production hoàn chỉnh cho LatticeDX `0.4.2`. Toàn bộ kiến trúc áp dụng cô lập mạng đông-tây qua 5 Docker bridge network, khóa bất biến `@sha256` digest trên toàn bộ OCI image, phân tách database role không có quyền superuser (`nocobase_app`) và cưỡng chế chứng thực OIDC/PKCE tại biên.

## 1. Phân vùng 5 Mạng Cô lập và Container Hardening

Mỗi container trong `infra/compose/prod.yml` kế thừa anchor `x-hardened` (`restart: unless-stopped`, `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`) và chỉ nhận tập `cap_add` tối thiểu đúng với chức năng của dịch vụ đó. Bốn trong năm mạng được khai báo `internal: true` để ngăn kết nối trực tiếp ra Internet hoặc truy cập ngang trái phép.

| Mạng Docker | `internal` | Thành phần gắn mạng | Vai trò phân vùng |
| :--- | :--- | :--- | :--- |
| **`edge`** | `false` | `caddy`, `keycloak`, `gateway`, `nocobase` | Mặt tiếp nhận HTTPS (`80`, `443` TCP/UDP) từ Internet qua Caddy |
| **`app`** | `true` | `caddy`, `gateway`, `keycloak`, `keycloak-config-cli`, `nocobase`, `redis`, `file-scanner`, `orion-ld`, `n8n`, `otel-collector`, `prometheus`, `grafana`, `gotenberg`, `nodered` | Giao tiếp HTTP nội bộ, xác thực OIDC backchannel, OTLP và điều phối workflow |
| **`data`** | `true` | `postgres`, `nocobase-db`, `redis`, `rustfs`, `orion-mongo`, `keycloak`, `nocobase`, `file-scanner`, `orion-ld`, `n8n`, `otel-collector`, `prometheus`, `grafana` | Lưu trữ quan hệ, vector `pgvector`, cache Valkey, đối tượng S3 và MongoDB |
| **`scanner`** | `true` | `clamav`, `file-scanner` | Cô lập hoàn toàn tiến trình quét mã độc khỏi mạng ứng dụng và mạng dữ liệu |
| **`iiot-net`** | `true` | `mosquitto`, `nodered`, `nocobase` | Cô lập broker MQTT và cầu nối Node-RED cho luồng telemetry nhà máy |

Bốn dịch vụ không cần ghi trạng thái trực tiếp lên rootfs (`file-scanner`, `otel-collector`, `prometheus`, `gotenberg`) chạy với `read_only: true` kết hợp vùng nhớ tạm `tmpfs` gắn cờ `noexec,nosuid`. Giao diện web quản trị của RustFS bị tắt hoàn toàn (`RUSTFS_CONSOLE_ENABLE: "false"`), chỉ mở S3 API nội bộ tại `rustfs:9000` trên mạng `data`.

---

## 2. Danh mục Image Khóa Digest `@sha256`

Toàn bộ OCI image trong `infra/compose/prod.yml` được ghim cứng theo mã băm `@sha256` nhằm loại bỏ rủi ro tráo tag container khi kéo lại ảnh. Riêng `@dx/file-scanner` được build trực tiếp từ `apps/file-scanner/Dockerfile` trong kho mã nguồn.

### Dịch vụ Lõi (Mặc định luôn khởi chạy)

| Dịch vụ | OCI Image và Digest `@sha256` | Tài nguyên |
| :--- | :--- | :--- |
| `caddy` | `caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d` | `256m` / `0.5` CPU |
| `gateway` | `apache/apisix:3.19.0-debian@sha256:9a7e45dc943fbf10ec916d1232bae4cda9302ae28a4696cfb83c2da01d261141` | `512m` / `1.0` CPU |
| `keycloak` | `quay.io/keycloak/keycloak:26.8.2@sha256:7e66a96e4739239070aeaf72e4c5decf0f7f682cfc725b9f7ea2b336eaba38b3` | `1536m` / `1.5` CPU |
| `postgres` | `postgres:16.16-alpine@sha256:f2f98726820d0342055351c6e9d36e705f5bfffb3dd53ff556325114b08afb6d` | `1536m` / `1.5` CPU |
| `nocobase-db` | `pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337` | `2048m` / `2.0` CPU |
| `redis` | `valkey/valkey:8.1-alpine@sha256:9971099af41c36e887aabdfe22b80c0fe45df949163dfc9cb434febc57cfc3fc` | `640m` / `0.5` CPU |
| `rustfs` | `rustfs/rustfs:1.0.6@sha256:ee717072290bec9b11abfc0365f8310b00df1cd9b3639943edae47bdef05044a` | `1024m` / `1.0` CPU |
| `clamav` | `clamav/clamav:1.5.5@sha256:12177441d1b40cef3c47b44c4090d59d4babc4c67bedd5af0fa315e603aa6dd8` | `2048m` / `1.0` CPU |
| `file-scanner` | Build từ `apps/file-scanner/Dockerfile` (`read_only: true`) | `256m` / `0.5` CPU |
| `orion-mongo` | `mongo:8.0@sha256:479e85ced54ffb8a40dade1dcde2da2a9ae858515b9415e9cc54bfb8f0575d01` | `1024m` / `1.0` CPU |
| `orion-ld` | `fiware/orion-ld:1.12.0@sha256:f562a93ed84cccae05063688e1c3605f75060d0c7b9cd004561eec43bcbd613b` | `768m` / `1.0` CPU |
| `nocobase` | `nocobase/nocobase:2.2.50@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777` | `2048m` / `2.0` CPU |

### Dịch vụ Tùy chọn theo `--profile`

| Profile | Dịch vụ | OCI Image và Digest `@sha256` | Tài nguyên |
| :--- | :--- | :--- | :--- |
| `iam-sync` | `keycloak-config-cli` | `adorsys/keycloak-config-cli:6.5.1-26@sha256:1b22dfaa9ae0c71f74b0342f9221a6510f272da5def683dbba26a98e6b1b1411` | `512m` / `0.5` CPU |
| `n8n` | `n8n` | `n8nio/n8n:2.48.1@sha256:5e022f23ef9eaac3f51467e021610c218ed7eb5b41a05edb388ef1c8e00e009f` | `1024m` / `1.0` CPU |
| `observability` | `otel-collector` | `otel/opentelemetry-collector-contrib:0.123.0@sha256:e39311df1f3d941923c00da79ac7ba6269124a870ee87e3c3ad24d60f8aee4d2` | `512m` / `0.5` CPU |
| `observability` | `prometheus` | `prom/prometheus:v3.3.0@sha256:339ce86a59413be18d0e445472891d022725b4803fab609069110205e79fb2f1` | `512m` / `0.5` CPU |
| `observability` | `grafana` | `grafana/grafana-oss:11.5.8@sha256:b8121de93047fd77c77de806bae9706e7d60de21c3bd5381a5db0167f94c6a48` | `512m` / `0.5` CPU |
| `pdf` | `gotenberg` | `gotenberg/gotenberg:8.20.1@sha256:cda4386c7ed38f18bc6897828be01ba7361c99929a5c84ec5e293d7916e29bac` | `768m` / `1.0` CPU |
| `iiot` | `mosquitto` | `eclipse-mosquitto:2.0.21@sha256:94f5a3d7deafa59fa3440d227ddad558f59d293c612138de841eec61bfa4d353` | `256m` / `0.5` CPU |
| `iiot` | `nodered` | `nodered/node-red:4.0.9@sha256:0b295b3a14c512548567ca99db631bc37b23bfc79fd009ee8248a610fafdb4b5` | `512m` / `0.5` CPU |

---

## 3. Lớp Biên Caddy, Apache APISIX và Keycloak OIDC/PKCE

Lưu lượng từ bên ngoài đi qua ba lớp kiểm soát tuần tự trước khi chạm tới runtime NocoBase hoặc các endpoint dịch vụ:

| Lớp biên | Tệp cấu hình | Chính sách bảo mật & định tuyến |
| :--- | :--- | :--- |
| Caddy `2.10` | `infra/config/caddy/Caddyfile` | Chấm dứt kết nối TLS cho `${LATTICE_DOMAIN}`, `${KEYCLOAK_DOMAIN}` và `${N8N_DOMAIN}` (hỗ trợ HTTP/3 trên `443/udp`), xóa header `Server`, gắn `Strict-Transport-Security` (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` và `Permissions-Policy`. Các đường dẫn `/api/*` và `/.well-known/agent-card.json` được chuyển về `gateway:9080` với `flush_interval -1` để giữ nguyên luồng SSE; toàn bộ giao diện portal đi thẳng về `nocobase:80` nơi Nginx áp dụng nonce CSP cho các route `/v/form/*` và `/v/track/*`. |
| Apache APISIX `3.19.0` | `infra/config/apisix/apisix.prod.yaml` | Gắn `X-Request-Id` qua plugin `request-id`, áp dụng CORS chặt chẽ theo `${LATTICE_ALLOWED_ORIGIN}` và giới hạn lưu lượng qua Valkey (`limit-count` với `policy: redis`): `120` request/60s trên route công khai, xác thực, OIDC và MCP; `300` request/60s trên endpoint nhận dữ liệu IIoT; `240` request/60s trên `/api/*`. Riêng nhóm `/api/dxos-oidc/*` chạy plugin `openid-connect` (`bearer_only: true`, `use_jwks: true`, `ssl_verify: true`) đối chiếu khóa JWKS từ Keycloak. |
| Keycloak `26.8.2` | `infra/config/keycloak/lattice-realm.prod.json` | Realm `lattice` bật `bruteForceProtected: true` (tạm khóa sau 5 lần sai), yêu cầu TOTP MFA và mật khẩu tối thiểu 12 ký tự. Client công khai `dx-native` (`standardFlowEnabled: true`, `directAccessGrantsEnabled: false`) bắt buộc PKCE `S256`. Plugin `@latticedx/plugin-enterprise-auth` xử lý 4 bước `start` -> `callback` -> `finish` -> `backchannelLogout`, đồng thời chặn leo thang quyền khi ánh xạ nhóm Keycloak sang vai trò NocoBase bằng cách bỏ qua `ldx_admin`, `allowConfigure` và nhóm `pm*`. |

---

## 4. Phân vùng Valkey 8.1 (DB 0 / DB 1 / DB 2)

`valkey/valkey:8.1-alpine` (giấy phép `BSD-3-Clause`) chạy với `--appendonly yes`, `--requirepass`, `--maxmemory 512mb` và chính sách `allkeys-lru`, chia tách dữ liệu theo 3 logical database độc lập cùng bộ đếm của APISIX:

<ParamGrid
  title="Phân vùng Logical Database trên Valkey 8.1"
  :items="[
    { name: 'DB 0 (CACHE_REDIS_URL)', type: 'Cache', default: 'redis://:...@redis:6379/0', description: 'Lưu cache ứng dụng của NocoBase khi CACHE_DEFAULT_STORE=redis.' },
    { name: 'DB 1 (PUBSUB_ADAPTER_REDIS_URL)', type: 'Pub/Sub', default: 'redis://:...@redis:6379/1', description: 'Kênh Pub/Sub latticedx:surface-updates đồng bộ cập nhật giao diện tới luồng SSE /api/dxosAi:surfaceEvents.' },
    { name: 'DB 2 (DX_NATIVE_AUTH_SESSION_REDIS_URL)', type: 'Session/PKCE', default: 'redis://:...@redis:6379/2', description: 'Lưu state PKCE (TTL 300s), ticket đổi phiên một lần (TTL 60s) và key thu hồi phiên backchannelLogout (TTL 24h).' },
    { name: 'APISIX limit-count', type: 'Rate Limit', default: 'policy: redis', description: 'Lưu bộ đếm giới hạn tốc độ theo remote_addr cho các route công khai, xác thực, MCP và IIoT.' }
  ]"
/>

Hệ thống không dùng Redis/Valkey Streams cho hàng đợi bất đồng bộ. Toàn bộ transactional outbox (`latticeContextOutbox`, `latticeEventBus`) được lưu bền vững trong PostgreSQL và xử lý bằng truy vấn `FOR UPDATE SKIP LOCKED`.

---

## 5. Role Không Quyền Superuser `nocobase_app` và DB Least-Privilege

Khi `nocobase-db` khởi tạo lần đầu, script `infra/config/postgres/init-nocobase-db.sh` tạo role ứng dụng `nocobase_app` với đầy đủ thuộc tính hạn chế đặc quyền và kiểm tra lỗi sớm nếu `NOCOBASE_APP_DB_USER` trùng với `POSTGRES_USER`:

<CodeTabs
  :tabs="[
    {
      label: 'init-nocobase-db.sh (SQL)',
      lang: 'sql',
      code: 'CREATE ROLE nocobase_app LOGIN PASSWORD \x27...\x27\n  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\nALTER DATABASE nocobase OWNER TO nocobase_app;\nREVOKE ALL ON DATABASE nocobase FROM PUBLIC;\nREVOKE CREATE ON SCHEMA public FROM PUBLIC;'
    },
    {
      label: 'init-prod.sh (Core DBs)',
      lang: 'sql',
      code: 'CREATE ROLE lattice_app LOGIN PASSWORD \x27...\x27 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\nCREATE ROLE keycloak_app LOGIN PASSWORD \x27...\x27 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\nCREATE ROLE n8n_app LOGIN PASSWORD \x27...\x27 NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\nREVOKE ALL ON DATABASE lattice, keycloak, n8n FROM PUBLIC;'
    }
  ]"
/>

Vì `nocobase_app` mang thuộc tính `NOSUPERUSER` và `NOBYPASSRLS`, mọi chính sách `ENABLE` + `FORCE ROW LEVEL SECURITY` trên 56 bảng tĩnh và bảng động `latticeCustom*` đều được PostgreSQL cưỡng chế ngay cả khi `nocobase_app` sở hữu database `nocobase`. Kết hợp với `DX_PG_RLS_SESSION=true`, mọi transaction ứng dụng chỉ đọc và ghi đúng tổ chức khớp `app.current_org`.

---

## 6. Quy trình Triển khai Từng bước

### Bước 1: Chuẩn bị `.env.prod` và kiểm tra Compose

Sao chép `infra/compose/prod.env.example` ra tệp `.env.prod` bên ngoài kho Git, điền toàn bộ khóa mật mã và xác thực cú pháp nội suy:

<CodeTabs
  :tabs="[
    {
      label: 'Khởi tạo & Kiểm tra',
      lang: 'bash',
      code: 'cp infra/compose/prod.env.example .env.prod\nchmod 600 .env.prod\ndocker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile iam-sync --profile n8n --profile iiot --profile observability --profile pdf \\\n  config --quiet'
    }
  ]"
/>

### Bước 2: Build 7 Plugin trên Host và Khởi động Stack

Tệp `prod.yml` mount read-only (`:ro`) 7 thư mục plugin từ `plugins/nocobase/*` vào `/app/nocobase/node_modules/@latticedx/*`. Vì vậy cần build đầy đủ `dist/` và khôi phục `openid-client` trong `plugin-enterprise-auth` trước khi chạy `docker compose up`:

<CodeTabs
  :tabs="[
    {
      label: 'Build Plugin & Start Prod',
      lang: 'bash',
      code: 'pnpm install --frozen-lockfile\nnpm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund\nnode plugins/nocobase/action-bridge/build.mjs\nnode plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs\nnode plugins/nocobase/plugin-enterprise-auth/build.mjs\nnode plugins/nocobase/plugin-dxos-para/build.mjs\nnode plugins/nocobase/plugin-dxos-blocks/build.mjs\nnode plugins/nocobase/plugin-dxos-studio/build.mjs\nnode plugins/nocobase/plugin-dxos-ai/build.mjs\n\ndocker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile iam-sync --profile n8n --profile iiot --profile observability --profile pdf \\\n  up -d --build'
    }
  ]"
/>

### Bước 3: Đồng bộ Realm Keycloak và Kích hoạt 7 Plugin

Sau khi `postgres`, `nocobase-db`, `keycloak`, `clamav` và `nocobase` đạt trạng thái healthy, chạy đồng bộ realm `iam-sync` (nếu chưa chạy cùng lệnh `up`), cài đặt 7 plugin và chạy `yarn nocobase upgrade`:

<CodeTabs
  :tabs="[
    {
      label: 'Sync IAM & Enable Plugins',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml --profile iam-sync up --abort-on-container-exit\n\nfor pkg in \\\n  @latticedx/plugin-action-bridge \\\n  @latticedx/plugin-lattice-foundation \\\n  @latticedx/plugin-enterprise-auth \\\n  @latticedx/plugin-dxos-para \\\n  @latticedx/plugin-dxos-blocks \\\n  @latticedx/plugin-dxos-studio \\\n  @latticedx/plugin-dxos-ai; do\n  docker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase pm add \x22$pkg\x22 || true\n  docker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase pm enable \x22$pkg\x22\ndone\n\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase upgrade'
    }
  ]"
/>

### Bước 4: Xác nhận Sức khỏe Hạ tầng và PITR

Kiểm tra trạng thái toàn bộ container và gọi endpoint kiểm tra sức khỏe qua Caddy và APISIX:

<ApiEndpoint
  method="GET"
  path="/health"
  auth="Public (APISIX rewrite -> /api/dxos:health)"
  summary="Kiểm tra khả năng định tuyến TLS qua Caddy, gateway APISIX và runtime NocoBase."
/>

<CodeTabs
  :tabs="[
    {
      label: 'Verify Stack & Metrics',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml ps\ncurl -fsS \x22https://<LATTICE_DOMAIN>/health\x22\n\n# Kiểm tra chỉ số Prometheus qua DX_METRICS_TOKEN\ncurl -fsS -H \x22Authorization: Bearer <DX_METRICS_TOKEN>\x22 \x22https://<LATTICE_DOMAIN>/api/dxos:metrics\x22 | head -n 20'
    }
  ]"
/>

Cả hai container `postgres` và `nocobase-db` mặc định khởi động với `wal_level=replica`, `archive_mode=on`, `archive_timeout=300`, `wal_compression=on` và ghi WAL nén `.gz` qua `pitr-archive.sh`. Tiếp tục thiết lập lịch sao lưu và diễn tập khôi phục theo [Hướng dẫn Nâng cấp](/getting-started/upgrading) và [Sao lưu và Phục hồi PITR](/operations/backup-and-pitr).

---

## Tài liệu Liên quan

- [Cấu hình Môi trường và Runtime](/getting-started/configuration)
- [Hồ sơ Cài đặt và Tài nguyên Phần cứng](/getting-started/installation-profiles)
- [Mô hình Bảo mật và Phân vùng Mạng](/architecture/security-model)
- [Sao lưu và Phục hồi PITR](/operations/backup-and-pitr)
