---
title: Cấu hình Môi trường & Runtime
description: Danh mục đầy đủ biến môi trường LatticeDX theo từng phân hệ, cơ chế quản lý khóa mật mã AES-256-GCM / Ed25519 và quy tắc bảo mật runtime.
---

# Cấu hình Môi trường và Runtime

LatticeDX tách bạch cấu hình giữa môi trường phát triển cục bộ (`.env.example`, `.env.agent`, `.env.integration`) và môi trường vận hành production (`infra/compose/prod.env.example` kết hợp `infra/compose/prod.yml`). Mọi biến bí mật trong `prod.yml` đều dùng cú pháp bắt buộc `${VAR:?Set VAR}` để Docker Compose từ chối khởi động ngay tại bước kiểm tra nếu thiếu bất kỳ khóa hoặc mật khẩu nào.

::: warning Quy tắc lưu trữ tệp cấu hình
Giữ `.env.prod`, `.env.agent` và `.env.integration` bên ngoài lịch sử Git với quyền truy cập `chmod 600`. Không đưa khóa API của mô hình AI hay bí mật hạ tầng vào biến `NEXT_PUBLIC_*` hoặc bundle mã nguồn chạy trên trình duyệt.
:::

## 1. Phân tách Môi trường và Sinh khóa Mật mã

Môi trường cục bộ (`pnpm dev`, `pnpm local:up`) đọc biến từ shell hiện tại hoặc tệp `.env` ở thư mục gốc của kho mã nguồn. Khi triển khai production qua `infra/compose/prod.yml`, người vận hành sao chép `infra/compose/prod.env.example` sang tệp riêng ngoài Git và thay thế toàn bộ giá trị giữ chỗ `CHANGE_ME_*` bằng chuỗi ngẫu nhiên chuẩn mật mã.

<CodeTabs
  :tabs="[
    {
      label: 'Sinh khóa & chuẩn bị .env.prod',
      lang: 'bash',
      code: 'cp infra/compose/prod.env.example .env.prod\nchmod 600 .env.prod\n\n# Sinh khóa 64-hex (32 byte) cho APP_KEY, ENCRYPTION_FIELD_KEY và DX_VAULT_MASTER_KEY\nopenssl rand -hex 32\nopenssl rand -hex 32\nopenssl rand -hex 32\n\n# Sinh khóa 32-hex cho IIoT ingest và Node-RED credentials\nopenssl rand -hex 16'
    },
    {
      label: 'Kiểm tra nội suy Compose',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml config --quiet'
    }
  ]"
/>

---

## 2. Biên mạng, API Gateway, Tên miền và CORS

Nhóm biến này điều phối định tuyến TLS trên Caddy `2.10`, chính sách CORS và giới hạn tốc độ trên Apache APISIX `3.19.0`, cũng như kiểm tra nguồn gốc hợp lệ trong lớp middleware NocoBase và Fastify.

<ParamGrid
  title="Biến Biên mạng, Tên miền và CORS"
  :items="[
    { name: 'LATTICE_DOMAIN', type: 'string', required: true, default: 'app.example.com', description: 'Tên miền chính phục vụ cổng LatticeDX và định tuyến /api/* qua Caddy và APISIX.' },
    { name: 'KEYCLOAK_DOMAIN', type: 'string', required: true, default: 'auth.example.com', description: 'Tên miền công khai của Keycloak 26.8.2 dùng cho KC_HOSTNAME và OIDC issuer.' },
    { name: 'N8N_DOMAIN', type: 'string', required: true, default: 'n8n.example.com', description: 'Tên miền công khai cho dịch vụ Stock n8n khi kích hoạt --profile n8n.' },
    { name: 'LATTICE_ALLOWED_ORIGIN', type: 'string', required: false, default: 'https://${LATTICE_DOMAIN}', description: 'Origin duy nhất được phép trong chính sách CORS toàn cục của APISIX.' },
    { name: 'DX_CORS_ALLOWED_ORIGINS', type: 'string', required: false, default: 'http://localhost:8080,http://127.0.0.1:8080', description: 'Danh sách origin phân tách bằng dấu phẩy cho middleware CORS của NocoBase và Fastify API.' },
    { name: 'DX_CORS_STRICT', type: 'boolean', required: false, default: 'true', description: 'Chặn mọi HTTP request mang Origin không nằm trong danh sách cho phép.' },
    { name: 'DX_TRUST_PROXY', type: 'boolean', required: false, default: 'true (prod)', description: 'Cho phép trích xuất IP thực từ proxy tin cậy để giới hạn tần suất biểu mẫu công khai.' },
    { name: 'APISIX_PORT', type: 'number', required: false, default: '8080', description: 'Cổng bind trên 127.0.0.1 của APISIX trong stack phát triển cục bộ.' },
    { name: 'CADDY_HTTP_PORT', type: 'number', required: false, default: '80', description: 'Cổng HTTP lắng nghe trên Caddy để chuyển hướng sang HTTPS và xác thực ACME.' },
    { name: 'CADDY_HTTPS_PORT', type: 'number', required: false, default: '443', description: 'Cổng HTTPS TCP/UDP (HTTP/3) phục vụ lưu lượng sản xuất trên Caddy.' }
  ]"
/>

---

## 3. PostgreSQL 16, Multi-Tenancy RLS, PITR và Valkey 8.1

Nền tảng tách riêng cụm cơ sở dữ liệu lõi (`postgres`) khỏi cụm dữ liệu nghiệp vụ và vector (`nocobase-db` chạy `pgvector/pgvector:0.8.1-pg16`). Trong `nocobase-db`, container ứng dụng kết nối bằng role `nocobase_app` mang thuộc tính `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS` và bắt buộc phải khác `NOCOBASE_DB_USER` nhằm bảo đảm PostgreSQL cưỡng chế `FORCE ROW LEVEL SECURITY` trên toàn bộ 56 bảng tĩnh cùng các bảng động `latticeCustom*`.

<ParamGrid
  title="Biến Cơ sở dữ liệu PostgreSQL 16 và Multi-Tenancy RLS"
  :items="[
    { name: 'POSTGRES_PASSWORD', type: 'secret', required: true, default: 'local-demo-password', description: 'Mật khẩu Postgres cho stack cục bộ core.yml. Không sử dụng giá trị mẫu ngoài loopback.' },
    { name: 'POSTGRES_SUPERUSER', type: 'string', required: true, default: 'postgres', description: 'Tên tài khoản siêu quản trị dùng để khởi tạo role con và phục hồi PITR trên cụm postgres.' },
    { name: 'POSTGRES_SUPERUSER_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu của POSTGRES_SUPERUSER trên cụm postgres production.' },
    { name: 'LATTICE_DB_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu cho role non-superuser lattice_app sở hữu cơ sở dữ liệu lattice.' },
    { name: 'KEYCLOAK_DB_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu cho role non-superuser keycloak_app sở hữu cơ sở dữ liệu keycloak.' },
    { name: 'N8N_DB_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu cho role non-superuser n8n_app sở hữu cơ sở dữ liệu n8n.' },
    { name: 'NOCOBASE_DB_USER', type: 'string', required: true, default: 'nocobase', description: 'Tài khoản quản trị dùng cho thao tác bootstrap, cài đặt pgvector và chạy migration.' },
    { name: 'NOCOBASE_DB_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu cho tài khoản NOCOBASE_DB_USER.' },
    { name: 'NOCOBASE_APP_DB_USER', type: 'string', required: true, default: 'nocobase_app', description: 'Role runtime không có quyền superuser (NOBYPASSRLS) mà container nocobase sử dụng.' },
    { name: 'NOCOBASE_APP_DB_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu cho role NOCOBASE_APP_DB_USER.' },
    { name: 'DX_PG_RLS_SESSION', type: 'boolean', required: false, default: 'true', description: 'Kích hoạt cầu nối transaction AsyncLocalStorage gán set_config app.current_org và app.rls_bypass.' },
    { name: 'DATABASE_POOL_MAX', type: 'number', required: false, default: '20', description: 'Số kết nối tối đa trong pool PostgreSQL của dịch vụ Fastify API.' },
    { name: 'DX_DEFAULT_ORG_ID', type: 'string', required: false, default: '1', description: 'Mã tổ chức mặc định khi tiến trình nền hoặc ngữ cảnh đơn tổ chức chưa chỉ định orgId.' }
  ]"
/>

<ParamGrid
  title="Biến Khóa Mật mã, PITR WAL và Valkey 8.1"
  :items="[
    { name: 'NOCOBASE_APP_KEY', type: 'secret', required: true, description: 'Khóa ký JWT phiên và token ứng dụng (truyền vào APP_KEY); đồng thời là khóa dự phòng cuối cho PKI/Vault.' },
    { name: 'NOCOBASE_ENCRYPTION_FIELD_KEY', type: 'secret', required: true, description: 'Khóa mã hóa trường dữ liệu (ENCRYPTION_FIELD_KEY) và dẫn xuất AES-256-GCM bọc Private Key Ed25519.' },
    { name: 'DX_VAULT_MASTER_KEY', type: 'secret', required: false, description: 'Khóa chủ riêng cho Connector Vault (ưu tiên trước ENCRYPTION_FIELD_KEY và APP_KEY khi mã hóa secret OAuth2).' },
    { name: 'LATTICE_TRACK_VERIFY_SECRET', type: 'secret', required: false, description: 'Khóa HMAC-SHA256 chuyên biệt để xác thực mã QR tra cứu ePOD công khai (/v/track/:code).' },
    { name: 'PG_ARCHIVE_COMMAND', type: 'string', required: false, default: '/bin/sh /etc/postgresql/pitr-archive.sh %p %f', description: 'Lệnh lưu trữ phân đoạn WAL phục vụ Point-in-Time Recovery.' },
    { name: 'PITR_WAL_DIR', type: 'string', required: false, default: '/var/lib/postgresql/wal-archive', description: 'Thư mục đích lưu các tệp WAL nén .gz (quyền 0700, umask 077).' },
    { name: 'PITR_WAL_RETENTION_DAYS', type: 'number', required: false, default: '7', description: 'Số ngày lưu giữ các phân đoạn WAL nén cục bộ trước khi pitr-archive.sh tự động dọn dẹp.' },
    { name: 'WALG_S3_PREFIX', type: 'string', required: false, description: 'Đường dẫn S3 tùy chọn (s3://bucket/path) để đẩy bản sao lưu WAL qua wal-g wal-push.' },
    { name: 'REDIS_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu xác thực cho cụm Valkey 8.1 dùng chung cho cache, Pub/Sub, session và APISIX limit-count.' },
    { name: 'CACHE_DEFAULT_STORE', type: 'string', required: false, default: 'redis', description: 'Backend lưu trữ cache ứng dụng của NocoBase.' },
    { name: 'CACHE_REDIS_URL', type: 'string', required: false, default: 'redis://:${REDIS_PASSWORD}@redis:6379/0', description: 'Kết nối Valkey DB 0 phục vụ cache ứng dụng.' },
    { name: 'PUBSUB_ADAPTER', type: 'string', required: false, default: 'redis', description: 'Bộ điều phối sự kiện Pub/Sub giữa các tiến trình ứng dụng.' },
    { name: 'PUBSUB_ADAPTER_REDIS_URL', type: 'string', required: false, default: 'redis://:${REDIS_PASSWORD}@redis:6379/1', description: 'Kết nối Valkey DB 1 cho kênh latticedx:surface-updates phát sự kiện SSE.' }
  ]"
/>

::: danger Cơ chế Fail-Closed cho Khóa Mật mã
Khi chạy ở chế độ `NODE_ENV=production`, các mô-đun mật mã từ chối dùng khóa mặc định của môi trường phát triển:
- `pki-ledger.js` yêu cầu có ít nhất `ENCRYPTION_FIELD_KEY` hoặc `APP_KEY`; nếu thiếu cả hai sẽ trả về lỗi `PKI_MASTER_KEY_MISSING` (HTTP 500).
- `connector-vault.js` tra cứu theo thứ tự `DX_VAULT_MASTER_KEY || ENCRYPTION_FIELD_KEY || NOCOBASE_APP_KEY || APP_KEY`; nếu chuỗi rỗng sẽ trả về `VAULT_MASTER_KEY_MISSING` (HTTP 500).
Trong vận hành thực tế, tách riêng `DX_VAULT_MASTER_KEY` khỏi `NOCOBASE_ENCRYPTION_FIELD_KEY` để có thể xoay vòng khóa kết nối bên ngoài mà không ảnh hưởng đến việc giải mã khóa ký Ed25519 trong `latticePkiKeys`.
:::

---

## 4. Keycloak OIDC, Enterprise Auth và Action Bridge

Plugin `@latticedx/plugin-enterprise-auth` thực thi quy trình đăng nhập OIDC PKCE `S256` qua 4 bước (`start` -> `callback` -> `finish` -> `backchannelLogout`), lưu trạng thái tạm thời (`state:`, `ticket:`, `revoked:`) trong Valkey DB 2 và ánh xạ nhóm người dùng từ Keycloak sang vai trò NocoBase có kiểm soát leo thang đặc quyền.

<ParamGrid
  title="Biến Xác thực Doanh nghiệp (Keycloak 26.8.2 & OIDC PKCE)"
  :items="[
    { name: 'KEYCLOAK_ADMIN_USER', type: 'string', required: true, default: 'kc-admin', description: 'Tên tài khoản quản trị khởi tạo ban đầu cho Keycloak.' },
    { name: 'KEYCLOAK_ADMIN_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu quản trị khởi tạo cho Keycloak.' },
    { name: 'APISIX_OIDC_CLIENT_SECRET', type: 'secret', required: true, description: 'Client secret của dx-gateway dùng trong plugin openid-connect của APISIX và keycloak-config-cli.' },
    { name: 'APISIX_OIDC_DISCOVERY', type: 'string', required: false, default: 'https://${KEYCLOAK_DOMAIN}/realms/lattice/.well-known/openid-configuration', description: 'URL OIDC discovery để APISIX tải JWKS xác thực token.' },
    { name: 'DX_NATIVE_AUTH_ISSUER', type: 'string', required: true, default: 'https://${KEYCLOAK_DOMAIN}/realms/lattice', description: 'URL issuer công khai dùng để điều hướng trình duyệt tới trang đăng nhập Keycloak.' },
    { name: 'DX_NATIVE_AUTH_INTERNAL_ISSUER', type: 'string', required: true, default: 'http://keycloak:8080/realms/lattice', description: 'URL issuer nội bộ trong mạng Docker app cho quá trình trao đổi mã OAuth2 ở server.' },
    { name: 'DX_NATIVE_AUTH_ORIGIN', type: 'string', required: true, default: 'https://${LATTICE_DOMAIN}', description: 'Origin dùng để ghép redirect_uri khi quay lại từ Keycloak.' },
    { name: 'DX_NATIVE_AUTH_CLIENT_ID', type: 'string', required: false, default: 'dx-native', description: 'Client ID công khai cấu hình PKCE S256 trong realm lattice.' },
    { name: 'DX_NATIVE_AUTH_CACHE_STORE', type: 'string', required: false, default: 'redis', description: 'Loại bộ lưu trữ trạng thái PKCE và danh sách thu hồi phiên.' },
    { name: 'DX_NATIVE_AUTH_SESSION_REDIS_URL', type: 'string', required: false, default: 'redis://:${REDIS_PASSWORD}@redis:6379/2', description: 'Kết nối Valkey DB 2 lưu state (300s), ticket (60s) và key thu hồi phiên (24h).' },
    { name: 'DX_NATIVE_AUTH_GROUP_ROLE_MAP', type: 'json', required: false, description: 'Ánh xạ JSON từ nhóm Keycloak sang vai trò NocoBase (tự động bỏ qua các quyền nhạy cảm như ldx_admin, allowConfigure, pm*).' },
    { name: 'DX_ALLOW_PUBLIC_SIGNUP', type: 'boolean', required: false, default: 'false', description: 'Cho phép tự đăng ký tài khoản công khai nếu đặt true (mặc định tắt).' },
    { name: 'DX_ENTERPRISE_DISABLE_SIGNUP', type: 'boolean', required: false, default: 'true', description: 'Từ chối toàn bộ yêu cầu tạo tài khoản cục bộ khi tổ chức chỉ dùng SSO doanh nghiệp.' },
    { name: 'DX_BRIDGE_ISSUER', type: 'string', required: false, description: 'OIDC issuer công khai cho @latticedx/plugin-action-bridge.' },
    { name: 'DX_BRIDGE_INTERNAL_ISSUER', type: 'string', required: false, description: 'OIDC issuer nội bộ cho @latticedx/plugin-action-bridge.' },
    { name: 'DX_BRIDGE_GATEWAY_URL', type: 'string', required: false, default: 'http://gateway:9080', description: 'Địa chỉ APISIX nội bộ mà action-bridge gọi qua khi thực thi hành động.' },
    { name: 'DX_BRIDGE_CALLBACK_URL', type: 'string', required: false, description: 'Callback URL hoàn tất xác thực của action-bridge (/api/dxActions:callback).' },
    { name: 'NOCOBASE_INTERNAL_URL', type: 'string', required: false, default: 'http://127.0.0.1', description: 'URL nội bộ loopback để tiến trình plugin gọi API host NocoBase.' }
  ]"
/>

---

## 5. Core API, Lưu trữ Đối tượng RustFS và Quét Mã độc ClamAV

Các tệp đính kèm tải lên hệ thống đi qua dịch vụ `@dx/file-scanner` (chạy trên rootfs `read_only: true`) để kiểm tra chữ ký virus trên mạng cô lập `scanner` qua ClamAV `1.5.5` trước khi ghi vào RustFS `1.0.6` trên mạng `data`.

<ParamGrid
  title="Biến Fastify Core API, File Scanner, ClamAV và RustFS S3"
  :items="[
    { name: 'API_PORT', type: 'number', required: false, default: '4000', description: 'Cổng lắng nghe của dịch vụ @dx/api trong môi trường cục bộ.' },
    { name: 'WORKER_PORT', type: 'number', required: false, default: '4001', description: 'Cổng lắng nghe của dịch vụ nền @dx/agent-worker.' },
    { name: 'API_URL', type: 'string', required: false, default: 'http://api:4000', description: 'Base URL nội bộ trỏ tới @dx/api.' },
    { name: 'WORKER_URL', type: 'string', required: false, default: 'http://worker:4001', description: 'Base URL nội bộ trỏ tới @dx/agent-worker.' },
    { name: 'API_RATE_LIMIT_MAX', type: 'number', required: false, default: '1000', description: 'Ngưỡng giới hạn số request trên mỗi cửa sổ thời gian của Fastify API.' },
    { name: 'FILE_STORAGE_PROVIDER', type: 'enum', required: false, default: 's3 (prod) / postgres (local)', description: 'Nhà cung cấp lưu trữ tệp: s3 (RustFS) hoặc postgres (lưu cục bộ).' },
    { name: 'FILE_STORAGE_ROOT', type: 'string', required: false, default: '/var/lib/latticedx/objects', description: 'Đường dẫn thư mục đối tượng khi dùng lưu trữ cục bộ.' },
    { name: 'RUSTFS_ACCESS_KEY', type: 'secret', required: true, description: 'Access key S3 nội bộ cho dịch vụ rustfs (truyền sang S3_ACCESS_KEY_ID).' },
    { name: 'RUSTFS_SECRET_KEY', type: 'secret', required: true, description: 'Secret key S3 nội bộ cho dịch vụ rustfs (truyền sang S3_SECRET_ACCESS_KEY).' },
    { name: 'DX_NATIVE_FILES_URL', type: 'string', required: false, default: 'http://file-scanner:4010', description: 'Endpoint dịch vụ quét tệp đính kèm qua mạng nội bộ app.' },
    { name: 'DX_NATIVE_FILES_INSTANCE', type: 'string', required: true, default: 'latticedx-prod', description: 'Định danh instance dùng để ký xác thực giữa NocoBase và file-scanner.' },
    { name: 'DX_NATIVE_FILES_SECRET', type: 'secret', required: true, description: 'Khóa bí mật dùng chung giữa NocoBase và file-scanner.' },
    { name: 'DX_NATIVE_CLAMD_HOST', type: 'string', required: false, default: 'clamav', description: 'Hostname daemon clamd trên mạng cô lập scanner.' },
    { name: 'DX_NATIVE_ATTACHMENT_SUBMIT_ORGANIZATION', type: 'string', required: false, description: 'Tổ chức mặc định gán cho tệp đính kèm khi nộp từ luồng không chỉ định rõ org.' },
    { name: 'DX_UPLOAD_STALE_PENDING_MS', type: 'number', required: false, default: '900000', description: 'Thời gian chờ tối đa (ms) trước khi đánh dấu phiên upload treo là quá hạn.' }
  ]"
/>

---

## 6. IIoT, Orion-LD, n8n, AI Studio, P.A.R.A. RAG và Giám sát

Nhóm biến mở rộng kiểm soát đồng bộ thực thể NGSI-LD, kết nối MQTT/Node-RED, cầu nối Stock `n8n`, kho tri thức P.A.R.A. (OCR và vector `pgvector`), hạn mức AI Studio và xuất dữ liệu OpenTelemetry / Prometheus / Grafana.

<ParamGrid
  title="Biến Hạ tầng IIoT, Orion-LD, n8n và Outbox"
  :items="[
    { name: 'ORION_MONGO_USER', type: 'string', required: true, default: 'orion_root', description: 'Tài khoản quản trị MongoDB 8.0 lưu ngữ cảnh NGSI-LD của Orion-LD.' },
    { name: 'ORION_MONGO_PASSWORD', type: 'secret', required: true, description: 'Mật khẩu xác thực SCRAM-SHA-256 cho MongoDB của Orion-LD.' },
    { name: 'ORION_MONGO_VOLUME', type: 'string', required: false, description: 'Tên volume tùy chọn khi khôi phục dữ liệu orion-mongo-data.' },
    { name: 'DX_NATIVE_CONTEXT_BROKER_URL', type: 'string', required: false, default: 'http://orion-ld:1026', description: 'Địa chỉ Context Broker FIWARE Orion-LD trong mạng nội bộ.' },
    { name: 'DX_NATIVE_CONTEXT_AUTO_SYNC', type: 'boolean', required: false, default: 'true', description: 'Bật tiến trình nền 10 giây đẩy bản ghi từ bảng latticeContextOutbox sang Orion-LD.' },
    { name: 'DX_OUTBOX_MAX_ATTEMPTS', type: 'number', required: false, default: '5', description: 'Số lần thử lại tối đa trước khi chuyển sự kiện outbox sang trạng thái thất bại / DLQ.' },
    { name: 'DX_OUTBOX_STALE_LOCK_MS', type: 'number', required: false, default: '120000', description: 'Thời gian tối đa (ms) giữ khóa hàng đợi outbox trước khi tiến trình khác thu hồi lại.' },
    { name: 'DX_EVENT_BUS_DRAINER', type: 'boolean', required: false, default: 'true', description: 'Bật worker 10 giây gửi sự kiện CloudEvents 1.0 tới các webhook đã đăng ký.' },
    { name: 'DX_FLOW_DELAY_TICK_MS', type: 'number', required: false, default: '15000', description: 'Chu kỳ quét hàng đợi trễ (control.delay) và lịch cron của LatticeFlow v2.' },
    { name: 'DX_SLA_CRON_ENABLED', type: 'boolean', required: false, default: 'true', description: 'Bật bộ đếm kiểm tra vi phạm SLA và leo thang tự động.' },
    { name: 'DX_SLA_INTERVAL_MS', type: 'number', required: false, default: '60000', description: 'Chu kỳ (ms) quét chính sách SLA đang hoạt động.' },
    { name: 'MQTT_ADMIN_USER', type: 'string', required: false, default: 'ldx_mqtt_admin', description: 'Tài khoản quản trị Dynamic Security của Mosquitto 2.0.21 (--profile iiot).' },
    { name: 'MQTT_ADMIN_PASSWORD', type: 'secret', required: false, description: 'Mật khẩu của MQTT_ADMIN_USER trên Mosquitto.' },
    { name: 'MQTT_BRIDGE_USER', type: 'string', required: false, default: 'nodered_bridge', description: 'Tài khoản MQTT giới hạn quyền được nạp tự động vào flows_cred.json của Node-RED.' },
    { name: 'MQTT_BRIDGE_PASSWORD', type: 'secret', required: false, description: 'Mật khẩu của MQTT_BRIDGE_USER.' },
    { name: 'DX_MQTT_BROKER_HOST', type: 'string', required: false, default: 'mosquitto', description: 'Hostname MQTT broker trên mạng cô lập iiot-net.' },
    { name: 'DX_MQTT_BROKER_PORT', type: 'number', required: false, default: '1883', description: 'Cổng MQTT nội bộ.' },
    { name: 'DX_NODERED_COMMAND_URL', type: 'string', required: false, default: 'http://nodered:1880/twin/command', description: 'Endpoint HTTP của Node-RED nhận lệnh điều khiển hai chiều Digital Twin.' },
    { name: 'DX_IIOT_INGEST_TOKEN', type: 'secret', required: false, description: 'Bearer token xác thực dữ liệu telemetry từ Node-RED đẩy vào NocoBase.' },
    { name: 'NODERED_CREDENTIAL_SECRET', type: 'secret', required: false, description: 'Khóa AES-256-CTR mã hóa tệp /data/flows_cred.json trong container Node-RED.' },
    { name: 'NODERED_ADMIN_USER', type: 'string', required: false, default: 'nodered_admin', description: 'Tên đăng nhập giao diện quản trị Node-RED 4.0.9.' },
    { name: 'NODERED_ADMIN_PASS_HASH', type: 'secret', required: false, description: 'Chuỗi băm bcrypt cho mật khẩu quản trị Node-RED.' },
    { name: 'DX_ORION_HOST_ALLOWLIST', type: 'string', required: false, description: 'Danh sách host tin cậy cho cấu hình Orion-LD nhằm chống SSRF.' },
    { name: 'DX_ORION_CALLBACK_HOST_ALLOWLIST', type: 'string', required: false, description: 'Danh sách host callback hợp lệ khi đăng ký subscription với Orion-LD.' },
    { name: 'DX_NODERED_HOST_ALLOWLIST', type: 'string', required: false, description: 'Danh sách host đích cho phép đối với các lệnh downlink tới Node-RED.' },
    { name: 'N8N_ENCRYPTION_KEY', type: 'secret', required: false, description: 'Khóa mã hóa credentials trong cơ sở dữ liệu của Stock n8n (--profile n8n).' },
    { name: 'N8N_URL', type: 'string', required: false, default: 'http://n8n:5678', description: 'Địa chỉ nội bộ tới dịch vụ Stock n8n.' },
    { name: 'N8N_WEBHOOK_BASE_URL', type: 'string', required: false, default: 'http://n8n:5678/webhook', description: 'Base URL gọi webhook nội bộ trên n8n.' },
    { name: 'DX_N8N_API_URL', type: 'string', required: false, default: 'http://n8n:5678/api/v1', description: 'Endpoint REST API v1 của n8n dùng bởi plugin-dxos-studio.' },
    { name: 'DX_N8N_API_KEY', type: 'secret', required: false, description: 'API key dự phòng (X-N8N-API-KEY) nếu chưa lưu trong Connector Vault.' },
    { name: 'DX_ALLOW_INTERNAL_CONNECTORS', type: 'boolean', required: false, default: 'false (true trong prod.yml)', description: 'Cho phép Connector Vault kết nối tới danh sách dịch vụ Docker nội bộ đã khai báo.' },
    { name: 'DX_INTERNAL_SERVICE_HOSTS', type: 'string', required: false, default: 'n8n,orion-ld,nodered,mosquitto', description: 'Danh sách hostname nội bộ được phép truy cập khi bật DX_ALLOW_INTERNAL_CONNECTORS.' },
    { name: 'DX_CONNECTOR_INTERNAL_ALLOWLIST', type: 'string', required: false, description: 'Danh sách host nội bộ bổ sung cho bộ kiểm tra SSRF của Connector Vault.' },
    { name: 'WORKFLOW_EVENT_URL', type: 'string', required: false, description: 'Đích webhook cố định tùy chọn cho outbox của dịch vụ @dx/api.' },
    { name: 'WORKFLOW_EVENT_TOKEN', type: 'secret', required: false, description: 'Token xác thực khi gửi sự kiện tới WORKFLOW_EVENT_URL.' }
  ]"
/>

<ParamGrid
  title="Biến AI Studio, P.A.R.A. Knowledge RAG, PDF và Quan sát Hệ thống"
  :items="[
    { name: 'AGENT_PROVIDER', type: 'string', required: false, default: 'openai-compatible', description: 'Loại provider LLM mặc định cho tiến trình AI và CLI worker.' },
    { name: 'AGENT_BASE_URL', type: 'string', required: false, default: 'http://localhost:20128/v1', description: 'Base URL chuẩn OpenAI-compatible của LLM gateway.' },
    { name: 'AGENT_API_KEY', type: 'secret', required: false, description: 'API key gọi LLM provider (đồng thời làm fallback cho DX_OCR_API_KEY).' },
    { name: 'AGENT_MODEL', type: 'string', required: false, default: 'combo', description: 'Mã mô hình sử dụng khi chạy CLI @dx/agent-worker.' },
    { name: 'AGENT_ENGINE_URL', type: 'string', required: false, default: 'http://localhost:8080', description: 'Origin gateway tin cậy cho tiến trình CLI agent.' },
    { name: 'AGENT_WORKER_TOKEN', type: 'secret', required: false, description: 'Worker JWT ngắn hạn phục vụ tác vụ agent CLI.' },
    { name: 'DXOS_AI_DAILY_ORG_CALL_LIMIT', type: 'number', required: false, default: '5000', description: 'Giới hạn số lượt gọi công cụ AI mỗi ngày trên một tổ chức.' },
    { name: 'DXOS_AI_DAILY_USER_CALL_LIMIT', type: 'number', required: false, default: '500', description: 'Giới hạn số lượt gọi công cụ AI mỗi ngày trên một người dùng.' },
    { name: 'DXOS_AI_DAILY_ORG_TOKEN_LIMIT', type: 'number', required: false, default: '5000000', description: 'Hạn mức tổng token AI mỗi ngày trên một tổ chức.' },
    { name: 'DXOS_AI_DAILY_ORG_USD_LIMIT', type: 'number', required: false, default: '50', description: 'Hạn mức chi phí ước tính (USD) mỗi ngày cho tác vụ AI trên một tổ chức.' },
    { name: 'DXOS_MCP_INTERNAL_HTTP_ALLOWLIST', type: 'string', required: false, description: 'Danh sách host nội bộ cho phép công cụ MCP IT/OT gọi HTTP.' },
    { name: 'DX_EMBEDDING_URL', type: 'string', required: false, description: 'Endpoint tạo vector embedding (hoặc DXOS_EMBEDDING_URL) cho tìm kiếm lai pgvector HNSW.' },
    { name: 'DX_EMBEDDING_DIM', type: 'number', required: false, default: '1536', description: 'Số chiều vector (hoặc DXOS_EMBEDDING_DIM, khoảng hợp lệ 8..8192).' },
    { name: 'DX_OCR_ENDPOINT', type: 'string', required: false, description: 'Endpoint OCR từ xa cho PDF dạng ảnh scan (chống SSRF; bắt buộc HTTPS ngoài mạng nội bộ).' },
    { name: 'DX_OCR_API_KEY', type: 'secret', required: false, description: 'API key xác thực với DX_OCR_ENDPOINT.' },
    { name: 'DX_OCR_TRUSTED_HOSTS', type: 'string', required: false, description: 'Danh sách hostname nội bộ được phép dùng HTTP không TLS cho dịch vụ OCR.' },
    { name: 'DX_APPRISE_URL', type: 'string', required: false, description: 'URL dịch vụ Apprise gửi thông báo đa kênh từ dxosNotify.' },
    { name: 'DX_NOTIFICATION_WEBHOOK_URL', type: 'string', required: false, description: 'Webhook mặc định cho cảnh báo từ hệ thống thông báo.' },
    { name: 'DXOS_GOTENBERG_URL', type: 'string', required: false, default: 'http://gotenberg:3000 (--profile pdf)', description: 'URL dịch vụ Gotenberg xuất chứng từ PDF hỗ trợ đầy đủ Unicode tiếng Việt.' },
    { name: 'DXOS_PDF_FONT_PATH', type: 'string', required: false, description: 'Đường dẫn font TrueType tùy chỉnh khi kết xuất chứng từ PDF.' },
    { name: 'DX_METRICS_TOKEN', type: 'secret', required: true, description: 'Bearer token bảo vệ endpoint GET /api/dxos:metrics (kiểm tra trước bước parse JWT).' },
    { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', type: 'string', required: false, default: 'http://otel-collector:4318', description: 'Endpoint OTLP/HTTP nhận trace HTTP và OTel GenAI từ plugin-dxos-ai.' },
    { name: 'OTEL_SERVICE_NAME', type: 'string', required: false, default: 'latticedx-nocobase', description: 'Thẻ service.name gắn trên mọi span OpenTelemetry xuất ra.' },
    { name: 'GRAFANA_ADMIN_USER', type: 'string', required: false, default: 'admin', description: 'Tài khoản quản trị Grafana OSS 11.5.8 (--profile observability).' },
    { name: 'GRAFANA_ADMIN_PASSWORD', type: 'secret', required: false, description: 'Mật khẩu quản trị Grafana OSS 11.5.8.' },
    { name: 'LATTICE_SKIP_DEMO_SEED', type: 'string', required: false, description: 'Đặt bằng 1 để bỏ qua dữ liệu mẫu kinh doanh khi khởi tạo DB trắng, chỉ giữ lại 8 vai trò ldx_* và schema nền.' }
  ]"
/>

---

## 7. Kiểm soát SSRF và Kiểm tra Trạng thái Cấu hình

Các biến chấp nhận URL bên ngoài đều đi qua lớp lọc chống SSRF ở tầng máy chủ:

| Biến / Nhóm cấu hình | Thành phần thực thi | Ranh giới kiểm soát SSRF & Bảo mật |
| :--- | :--- | :--- |
| `DX_OCR_ENDPOINT` | `document-extractor.js` | Chỉ chấp nhận giao thức `http:` hoặc `https:`, từ chối thông tin đăng nhập nhúng dạng `user:pass@host` (`OCR_ENDPOINT_CREDENTIALS_FORBIDDEN`), chặn địa chỉ metadata cloud và dải CGNAT (`169.254.*`, `100.64.0.0/10`, `fd00:ec2::254`, `metadata.google.internal`, `metadata.azure.com` → `OCR_ENDPOINT_SSRF_BLOCKED`) và ép buộc `https://` đối với mọi host nằm ngoài localhost hoặc danh sách `DX_OCR_TRUSTED_HOSTS`. |
| `DX_ALLOW_INTERNAL_CONNECTORS` | `connector-vault.js` | Kiểm tra cả URL đầu vào lẫn địa chỉ IP sau phân giải DNS để chặn loopback, dải RFC1918 và IP metadata; chỉ mở ngoại lệ cho đúng tên miền dịch vụ liệt kê trong `DX_INTERNAL_SERVICE_HOSTS` hoặc `DX_CONNECTOR_INTERNAL_ALLOWLIST`. |
| Thông tin mẫu cục bộ | `.env.example` | Các giá trị như `local-demo-password`, `local-nocobase-password`, `local-redis-password`, `local-nocobase-app-key-public-fixture` và `admin@nocobase.com` chỉ tồn tại phục vụ cô lập trên `127.0.0.1`. Tuyệt đối không giữ nguyên khi mở cổng ra mạng nội bộ hoặc Internet. |

Sau khi khởi động dịch vụ, kiểm tra trạng thái các cờ cấu hình (`embeddingConfigured`, `ocrConfigured`, `DX_PG_RLS_SESSION`) qua hai endpoint sau:

<ApiEndpoint
  method="GET"
  path="/api/dxos:health"
  auth="Public / Health"
  summary="Trả về trạng thái sẵn sàng của nền tảng, plugin runtime và kết nối DB/Valkey."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePara:indexHealth"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Kiểm tra trạng thái chỉ mục HNSW pgvector cùng hai cờ embeddingConfigured và ocrConfigured."
/>

---

## Tài liệu Liên quan

- [Triển khai Production Zero-Trust](/getting-started/production-deployment)
- [Đa khách hàng và PostgreSQL FORCE RLS](/architecture/multi-tenancy-rls)
- [Mô hình Bảo mật và Phân vùng Mạng](/architecture/security-model)
- [Sổ cái PKI và Khóa API theo Phạm vi](/reference/pki-merkle-ledger)
