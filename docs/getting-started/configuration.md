# Hướng dẫn Cấu hình Biến môi trường (Configuration — `v0.4.2`)

Tài liệu này mô tả chính xác các biến môi trường dùng cho phát triển cục bộ (`.env.example`) và vận hành production (`infra/compose/prod.env.example` / `infra/compose/prod.yml`), đồng thời giải thích cơ chế quản lý khóa mật mã Ed25519 / AES-256-GCM và cảnh báo an toàn cho cấu hình fixture.

---

## 1. Quy tắc Tách biệt Môi trường

- **Local Development (`pnpm dev`, `local:up`)**: Tham khảo `.env.example`. `pnpm dev` chỉ đọc biến từ shell hiện tại; Docker Compose nội suy từ shell hoặc tệp `.env` ở thư mục gốc (đã được `.gitignore` loại trừ). Biến phục vụ thử nghiệm AI/Worker nằm trong `.env.agent` và dịch vụ tích hợp nằm trong `.env.integration` (không commit lên Git).
- **Production (`infra/compose/prod.yml`)**: Tham khảo `infra/compose/prod.env.example` và lưu thành tệp riêng bên ngoài Git (ví dụ `.env.prod`). Toàn bộ biến bí mật trong `prod.yml` dùng cú pháp bắt buộc `${VAR:?Set VAR}` — Compose sẽ từ chối khởi động nếu thiếu bất kỳ secret nào.

---

## 2. Biến Môi trường Cốt lõi & Tên miền

| Biến | Tệp mẫu | Mô tả |
| --- | --- | --- |
| `API_PORT`, `WORKER_PORT` | `.env.example` | Cổng mặc định cho `@dx/api` (`4000`) và `@dx/agent-worker` (`4001`) |
| `API_URL`, `WORKER_URL` | `.env.example` | Địa chỉ kết nối nội bộ cục bộ (`http://127.0.0.1:4000`, `http://127.0.0.1:4001`) |
| `LATTICE_DOMAIN` | `prod.env.example` | Tên miền chính của cổng LatticeDX (ví dụ `app.latticedx.example.com`) |
| `KEYCLOAK_DOMAIN` | `prod.env.example` | Tên miền Keycloak OIDC (ví dụ `auth.latticedx.example.com`), dùng cho `KC_HOSTNAME` và `DX_NATIVE_AUTH_ISSUER` |
| `N8N_DOMAIN` | `prod.env.example` | Tên miền Stock `n8n` khi bật `--profile n8n` (ví dụ `n8n.latticedx.example.com`) |
| `LATTICE_ALLOWED_ORIGIN` | `prod.env.example` | Origin hợp lệ cho chính sách CORS trên Apache APISIX (`https://app.latticedx.example.com`) |

---

## 3. Biến Cơ sở dữ liệu, PITR & Multi-Tenant RLS

| Biến | Mặc định / Định dạng | Vai trò |
| --- | --- | --- |
| `POSTGRES_SUPERUSER`, `POSTGRES_SUPERUSER_PASSWORD` | `postgres` / bắt buộc | Tài khoản quản trị trên container `postgres` (dùng để khởi tạo DB & role con) |
| `LATTICE_DB_PASSWORD`, `KEYCLOAK_DB_PASSWORD`, `N8N_DB_PASSWORD` | Bắt buộc | Mật khẩu cho các role non-superuser `lattice_app`, `keycloak_app`, `n8n_app` |
| `NOCOBASE_DB_USER`, `NOCOBASE_DB_PASSWORD` | `nocobase` / bắt buộc | Tài khoản chủ khởi tạo container `nocobase-db` (`pgvector/pgvector:0.8.1-pg16`) |
| `NOCOBASE_APP_DB_USER`, `NOCOBASE_APP_DB_PASSWORD` | `nocobase_app` / bắt buộc | Role ứng dụng **`NOSUPERUSER NOBYPASSRLS`** mà container `nocobase` sử dụng khi kết nối DB (phải khác `NOCOBASE_DB_USER`) |
| `DX_PG_RLS_SESSION` | `true` | Bật cơ chế gán `set_config('app.current_org', ..., true)` theo từng transaction để cưỡng chế `FORCE ROW LEVEL SECURITY` trên 56 bảng tĩnh và bảng động `latticeCustom*` |
| `PG_ARCHIVE_COMMAND` | `/bin/sh /etc/postgresql/pitr-archive.sh %p %f` | Lệnh lưu trữ WAL cho PITR (nén `.gz` cục bộ hoặc `wal-g wal-push` nếu cấu hình `WALG_S3_PREFIX` / `wal-g` sẵn trong container) |

---

## 4. Khóa Mật mã Ed25519 PKI & AES-256-GCM Vault

LatticeDX tách bạch lớp khóa dùng để mã hóa trường dữ liệu, khóa ký sổ cái PKI và khóa mã hóa thông tin kết nối trong Connector Vault:

### 4.1. Biến Khóa Chủ Hệ thống (`NOCOBASE_APP_KEY`, `NOCOBASE_ENCRYPTION_FIELD_KEY`, `DX_VAULT_MASTER_KEY`)

| Biến | Cơ chế sử dụng trong mã nguồn | Hành vi khi `NODE_ENV=production` |
| --- | --- | --- |
| `NOCOBASE_APP_KEY` (`APP_KEY` trong container) | Khóa phiên & chữ ký ứng dụng NocoBase; khóa dự phòng cho Vault/PKI nếu thiếu khóa chuyên biệt | Bắt buộc (`CHANGE_ME_64HEX_NOCOBASE_APP_KEY` — 64 ký tự hex) |
| `NOCOBASE_ENCRYPTION_FIELD_KEY` (`ENCRYPTION_FIELD_KEY` trong container) | **`pki-ledger.js`** dùng `ENCRYPTION_FIELD_KEY \|\| APP_KEY` để dẫn xuất khóa AES-256 (`SHA-256`) mã hóa **Private Key Ed25519** lưu trong bảng `latticePkiKeys` (định dạng `<iv_24hex>:<tag_32hex>:<ciphertext_hex>`) | **Fail-closed**: Nếu thiếu cả `ENCRYPTION_FIELD_KEY` và `APP_KEY` khi `NODE_ENV=production`, hệ thống ném lỗi `PKI_MASTER_KEY_MISSING` (HTTP 500) và từ chối dùng fallback dev |
| `DX_VAULT_MASTER_KEY` *(tùy chọn tách riêng)* | **`connector-vault.js`** dùng theo thứ tự ưu tiên: `DX_VAULT_MASTER_KEY \|\| ENCRYPTION_FIELD_KEY \|\| NOCOBASE_APP_KEY \|\| APP_KEY` để dẫn xuất khóa **AES-256-GCM** mã hóa secret của connector và token OAuth2 PKCE | **Fail-closed**: Nếu thiếu toàn bộ chuỗi khóa khi `NODE_ENV=production`, hệ thống ném lỗi `VAULT_MASTER_KEY_MISSING` (HTTP 500) |

::: tip Khuyến nghị tách khóa Production
Dù `connector-vault.js` có thể kế thừa `ENCRYPTION_FIELD_KEY`, trong môi trường production bạn nên đặt riêng `DX_VAULT_MASTER_KEY` (chuỗi ngẫu nhiên tối thiểu 32 byte) để tách biệt phạm vi xoay khóa Connector Vault khỏi khóa Private Key Ed25519 của Sổ cái PKI. Xem thêm [PKI Ledger & API Keys](/security/pki-ledger-api-keys).
:::

### 4.2. Các Biến Bí mật Dịch vụ Hạ tầng Khác

| Biến | Thành phần sử dụng | Ghi chú |
| --- | --- | --- |
| `REDIS_PASSWORD` | `redis` (Valkey `8.1`), `nocobase`, `gateway` | Mật khẩu xác thực Valkey cho cache, Pub/Sub, session và APISIX `limit-count` |
| `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY` | `rustfs`, `file-scanner`, `nocobase` | Khóa truy cập S3 nội bộ tại `http://rustfs:9000` |
| `DX_NATIVE_FILES_INSTANCE`, `DX_NATIVE_FILES_SECRET` | `file-scanner`, `nocobase` | Định danh instance (`latticedx-prod`) và khóa xác thực giữa NocoBase và dịch vụ quét tệp |
| `FILE_STORAGE_PROVIDER` | `file-scanner`, `api` | `s3` trong `prod.yml` (hoặc `postgres` trong `core.yml` cục bộ) |
| `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `APISIX_OIDC_CLIENT_SECRET` | `keycloak`, `keycloak-config-cli`, `gateway` | Quản trị Keycloak và client secret cho OIDC trên APISIX |
| `N8N_ENCRYPTION_KEY` | `n8n` | Khóa mã hóa credentials lưu trong database của Stock `n8n` |
| `DX_IIOT_INGEST_TOKEN`, `MQTT_ADMIN_USER`, `MQTT_ADMIN_PASSWORD`, `MQTT_BRIDGE_USER`, `MQTT_BRIDGE_PASSWORD`, `NODERED_CREDENTIAL_SECRET`, `NODERED_ADMIN_USER`, `NODERED_ADMIN_PASS_HASH` | `mosquitto`, `nodered`, `nocobase` | Bảo mật MQTT Dynamic Security ACL, xác thực ingest IIoT và mã hóa `flows_cred.json` của Node-RED |

---

## 5. Biến Đặc thù DX-OS (`DX_OCR_ENDPOINT`, `DX_METRICS_TOKEN`, `LATTICE_SKIP_DEMO_SEED`)

### 5.1. `DX_OCR_ENDPOINT` — Remote OCR cho Kho tri thức P.A.R.A.

- **Mục đích:** Tùy chọn trỏ tới dịch vụ OCR đa phương thức bên ngoài khi tải lên tệp PDF dạng ảnh scan không có lớp văn bản (PDF có text/ToUnicode CMap, DOCX, XLSX, PPTX được trích xuất cục bộ không cần biến này).
- **Bảo vệ chống SSRF (`plugins/nocobase/plugin-dxos-para/src/server/document-extractor.js`):**
  - Chỉ chấp nhận giao thức `http:` hoặc `https:`.
  - Cấm nhúng thông tin đăng nhập dạng `https://user:pass@host` trong URL (`OCR_ENDPOINT_CREDENTIALS_FORBIDDEN`).
  - Chặn các dải metadata cloud / loopback không tin cậy (`169.254.*`, CGNAT `100.64.0.0/10`, `fd00:ec2::254`, `metadata.google.internal`, `metadata.azure.com` → `OCR_ENDPOINT_SSRF_BLOCKED`).
  - Mọi endpoint nằm ngoài mạng Docker nội bộ hoặc localhost **bắt buộc dùng `https://`** (`OCR_ENDPOINT_HTTPS_REQUIRED`).

### 5.2. `DX_METRICS_TOKEN` — Bảo vệ Endpoint `/api/dxos:metrics`

- **Mục đích:** Token bảo vệ endpoint thu thập chỉ số Prometheus `GET /api/dxos:metrics` của `plugin-lattice-foundation`.
- **Cơ chế xác thực:** Khi request gửi kèm token khớp `DX_METRICS_TOKEN`, hệ thống xác thực và trả về văn bản chuẩn Prometheus `text/plain` trước khi parse JWT; nếu không có token hợp lệ, endpoint yêu cầu phiên đăng nhập quyền `root` hoặc `ldx_admin`.
- Trong `prod.yml`, container `prometheus` tự động ghi giá trị `DX_METRICS_TOKEN` vào `/tmp/dx_metrics_token` (`umask 077`) lúc khởi động thay vì hardcode vào tệp `prometheus.yml`.

### 5.3. `LATTICE_SKIP_DEMO_SEED` — Kiểm soát Khởi tạo Dữ liệu Mẫu

- **Giá trị:** Đặt `LATTICE_SKIP_DEMO_SEED=1` để bỏ qua toàn bộ việc chèn dữ liệu trình diễn (`seedFoundation`, `FoundationSeed.up()`, `LatticeFoundationPlugin.install()`).
- **Ứng dụng:** Được `pnpm native:clean --blank-slate` tự động bật, đồng thời khuyến nghị đặt `LATTICE_SKIP_DEMO_SEED=1` khi khởi tạo database trắng cho môi trường production thực tế để chỉ nạp 8 vai trò `ldx_*`, `dxos-architect` và schema nền tảng mà không sinh bản ghi đơn hàng/sự cố giả lập.

### 5.4. Nhóm Biến Kết nối Nội bộ, PDF, OTel & AI Worker

| Biến | Giá trị mẫu / Ý nghĩa |
| --- | --- |
| `DX_ALLOW_INTERNAL_CONNECTORS`, `DX_INTERNAL_SERVICE_HOSTS` | `true` và `n8n,orion-ld,nodered,mosquitto` — cho phép Connector Vault & Workflow gọi các dịch vụ Docker nội bộ đã kiểm duyệt thay vì bị chặn SSRF |
| `N8N_URL`, `N8N_WEBHOOK_BASE_URL` | `http://n8n:5678` và `http://n8n:5678/webhook` |
| `DX_MQTT_BROKER_HOST`, `DX_MQTT_BROKER_PORT`, `DX_NODERED_COMMAND_URL` | `mosquitto`, `1883`, `http://nodered:1880/twin/command` |
| `DXOS_GOTENBERG_URL` | Để trống mặc định; đặt `http://gotenberg:3000` khi bật `--profile pdf` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4318` (OTLP/HTTP nhận span OTel GenAI từ `plugin-dxos-ai` và `file-scanner`) |
| `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | Tài khoản quản trị Grafana OSS (`--profile observability`) |
| `AGENT_PROVIDER`, `AGENT_BASE_URL`, `AGENT_API_KEY`, `AGENT_MODEL` | Cấu hình provider LLM cho script CLI `@dx/agent-worker` trong `.env.agent` (mặc định mẫu `9router`, `http://localhost:20128/v1`, model `combo`) |

---

## 6. Cảnh báo Bảo mật: Mật khẩu Fixture Loopback

::: danger Tuyệt đối không dùng Fixture Loopback ngoài `127.0.0.1`
Theo `SECURITY.md` và các tệp `infra/compose/core.yml`, `infra/compose/nocobase.yml`, `infra/compose/native-rehearsal.yml`, `infra/compose/iiot.yml`, `infra/compose/integration.yml`, môi trường kiểm thử cục bộ trên `127.0.0.1` / `localhost` sử dụng các giá trị fixture công khai sau:

- Tài khoản & mật khẩu giao diện thử nghiệm: `admin@nocobase.com` / `admin123`, các tài khoản `native.lab.*@example.invalid` / `NativeLab-2026!`
- Mật khẩu dịch vụ cục bộ: `local-demo-password`, `local-admin-password`, `local-nocobase-password`, `local-redis-password`, `local-orion-mongo-password`, `local-mqtt-admin-password`, `local-nodered-bridge-password`
- Khóa ứng dụng fixture: `local-nocobase-app-key-public-fixture`, `local-nocobase-encryption-public-fixture`

**Quy tắc bắt buộc trước mọi triển khai ngoài loopback hoặc tiếp xúc Internet:**
1. Không sử dụng bất kỳ chuỗi fixture nào ở trên; sinh mới toàn bộ mật khẩu và khóa 32–64 byte bằng trình tạo ngẫu nhiên chuẩn mật mã (ví dụ `openssl rand -hex 32`).
2. Luôn giữ tệp `.env.prod`, `.env.agent`, `.env.integration` bên ngoài Git và đặt quyền đọc chỉ dành cho chủ sở hữu (`chmod 600`).
3. Không đặt thông tin xác thực nhà cung cấp AI hay bí mật hệ thống vào biến `NEXT_PUBLIC_*` hoặc bundle phía trình duyệt.
:::

---

## Tài liệu Liên quan

- [Triển khai Production Zero-Trust](/getting-started/production-deployment)
- [Đa khách hàng & PostgreSQL RLS](/security/multi-tenant-rls)
- [PKI Ledger & PaaS API Keys](/security/pki-ledger-api-keys)
- [Xác thực OIDC & Bảo mật Hệ thống](/security/auth-oidc-hardening)
