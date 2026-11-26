---
title: Mô hình Bảo mật Zero-Trust
description: Kiến trúc bảo mật nhiều lớp của LatticeDX gồm 5 mạng Docker cô lập, Caddy TLS, Nginx CSP, Apache APISIX JWT/rate-limit, Keycloak OIDC PKCE, quản lý bí mật AES-256-GCM và tách quyền nocobase_app / lattice_app.
---

<script setup>
const securityTabs = [
  {
    label: 'CSP Public HTML Header',
    lang: 'http',
    code: `Content-Security-Policy: default-src 'none'; script-src 'nonce-8fK2pQ9xL4mN7vR1'; style-src 'nonce-8fK2pQ9xL4mN7vR1'; img-src data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin`,
  },
  {
    label: 'PostgreSQL Least-Privilege Roles',
    lang: 'sql',
    code: `-- infra/config/postgres/init-nocobase-db.sh & init-prod.sh
CREATE ROLE nocobase_app LOGIN PASSWORD '<app_pw>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE ROLE lattice_app LOGIN PASSWORD '<lattice_pw>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

REVOKE ALL ON DATABASE nocobase FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;`,
  },
];
</script>

# Mô hình Bảo mật Zero-Trust

LatticeDX áp dụng kiến trúc phòng thủ nhiều lớp từ rìa mạng đến từng hàng dữ liệu PostgreSQL 16. Mọi lưu lượng đi vào đều phải qua lớp chấm dứt TLS tại Caddy, kiểm tra tốc độ và danh tính tại Apache APISIX hoặc Nginx nội bộ, xác thực OIDC PKCE tại Keycloak, và thực thi `FORCE ROW LEVEL SECURITY` dưới các vai trò cơ sở dữ liệu không có quyền siêu quản trị (`nocobase_app` và `lattice_app`).

<DeploymentStackDiagram />

## Phân vùng 5 Mạng Docker Cô lập

Trong `infra/compose/prod.yml`, toàn bộ các container đều ghim digest `@sha256` bất biến và tách biệt qua năm mạng Docker, trong đó bốn mạng lõi được đặt `internal: true` để chặn hoàn toàn kết nối trực tiếp ra internet hoặc giữa các vùng không liên quan:

| Mạng Docker | Thuộc tính | Các dịch vụ tham gia | Mục tiêu cô lập |
| :--- | :--- | :--- | :--- |
| `edge` | Bridge công khai | `caddy`, `keycloak`, `gateway` (APISIX), `nocobase` | Tiếp nhận kết nối HTTP/HTTPS cổng `80`/`443` tại Caddy; không chứa cơ sở dữ liệu hay kho lưu trữ đối tượng. |
| `app` | `internal: true` | `caddy`, `keycloak`, `gateway`, `nocobase`, `file-scanner`, `orion-ld`, `n8n`, `otel-collector`, `prometheus`, `grafana`, `gotenberg`, `nodered`, `redis` | Cô lập giao tiếp HTTP/gRPC/OTLP/Redis nội bộ giữa lớp gateway, ứng dụng và công cụ quan sát. |
| `data` | `internal: true` | `postgres`, `nocobase-db`, `redis`, `rustfs`, `keycloak`, `file-scanner`, `orion-mongo`, `orion-ld`, `nocobase`, `n8n`, `otel-collector`, `prometheus`, `grafana` | Bảo vệ hai cụm PostgreSQL 16, MongoDB 8, RustFS S3 và Valkey 8.1 khỏi mọi truy cập từ rìa mạng. |
| `scanner` | `internal: true` | `clamav`, `file-scanner` | Tách biệt daemon ClamAV `1.5.5` (`read_only` + `tmpfs`) chỉ giao tiếp qua cầu nối `file-scanner:4010`. |
| `iiot-net` | `internal: true` | `mosquitto`, `nodered`, `nocobase` | Cô lập broker MQTT Eclipse Mosquitto `2.0.21` (Dynamic Security) và luồng điều khiển Node-RED `4.0.9`. |

## Lớp Rìa: Caddy TLS, Apache APISIX và Nginx CSP/CORS/CSRF

Lưu lượng bên ngoài đi qua bốn lớp kiểm soát nối tiếp trước khi chạm tới logic nghiệp vụ của NocoBase `2.2.50`:

| Thứ tự | Thành phần / Tệp cấu hình | Cơ chế bảo vệ |
| :---: | :--- | :--- |
| `1` | Caddy `2.10` (`infra/config/caddy/Caddyfile`) | Chấm dứt TLS tự động cho `LATTICE_DOMAIN`, `KEYCLOAK_DOMAIN` và `N8N_DOMAIN`, xóa header `-Server` và gắn bộ header bảo mật chuẩn (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`). Mọi đường dẫn `/api/*` và `/.well-known/agent-card.json` được chuyển tới `gateway:9080`. |
| `2` | Apache APISIX `3.19.0` (`infra/config/apisix/apisix.prod.yaml`) | Gắn `X-Request-Id` qua plugin `request-id`, áp dụng CORS chặt chẽ theo `LATTICE_ALLOWED_ORIGIN`, xác thực JWT bằng JWKS (`openid-connect` với `client_id: dx-gateway`, `bearer_only: true`, `use_jwks: true`, `ssl_verify: true`) trên tuyến `/api/dxos-oidc*` và thực thi giới hạn tốc độ dựa trên Valkey (`limit-count` `policy: redis`). |
| `3` | Nginx Public Routes & Nonce CSP (`10-lattice-public-routes.sh`, `public-form-html.js`, `public-track-html.js`) | Nginx nội bộ định tuyến `/v/form`, `/v/track`, `/v/mobile` và `/.well-known/agent-card.json` với `Cache-Control: no-cache, no-store`. Mỗi phản hồi HTML công khai sinh nonce mật mã ngẫu nhiên theo từng lượt gọi và gắn CSP nghiêm ngặt (`default-src 'none'; script-src 'nonce-<n>'; style-src 'nonce-<n>'; img-src data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'`). |
| `4` | Kiểm soát CORS & Chống CSRF (`observability.js`, `routes.js`) | Khi `DX_CORS_STRICT=true`, middleware xóa toàn bộ header `Access-Control-Allow-*` nếu `Origin` không khớp danh sách `DX_CORS_ALLOWED_ORIGINS` hoặc host hợp lệ. Trong luồng đăng nhập doanh nghiệp, cookie ràng buộc `ldx_enterprise_binding` đặt cờ `httpOnly: true`, `sameSite: 'lax'`, `secure: true` (trên HTTPS), `path: '/api'` và `POST /api/enterpriseAuth:finish` đối chiếu nghiêm ngặt header `Origin` trùng khớp `DX_NATIVE_AUTH_ORIGIN` cùng `Content-Type: application/json`. |

### Bảng Định tuyến và Giới hạn Tốc độ APISIX

| Route ID | Nhóm URI | Xác thực Gateway | Giới hạn (`limit-count`) | Timeout Upstream |
| :--- | :--- | :--- | :--- | :--- |
| `dxos-public-paas` | `/.well-known/agent-card.json`, `/api/dxos:openapi`, `/api/dxosWms:publicTrack`, `/api/dxosForms:*` | Công khai / token biểu mẫu | `120` req / `60s` (`remote_addr`) | Mặc định |
| `dxos-enterprise-auth` | `/api/enterpriseAuth:start`, `:callback`, `:finish`, `:backchannelLogout` | PKCE `S256` / `logout_token` | `120` req / `60s` (`remote_addr`) | Mặc định |
| `dxos-oidc-bridge` | `/api/dxos-oidc`, `/api/dxos-oidc/*` | `openid-connect` JWKS (`dx-gateway`) | `120` req / `60s` (`remote_addr`) | Mặc định |
| `dxos-mcp` | `/api/dxos-mcp`, `/api/dxos-mcp/*` | Bearer JWT / `ldx_pat_*` | `120` req / `60s` (`remote_addr`) | `600s` send/read |
| `dxos-telemetry-ingest` | `/api/dxosBlocks:telemetryIngest`, `:alarmIngest`, `/api/dxosBroker:deviceStatusIngest`, `:orionNotify` | `X-Lattice-Edge-Token` | `300` req / `60s` (`remote_addr`) | Mặc định |
| `dxos-core-api` | `/api/*` (ưu tiên `10`) | Bearer JWT / `ldx_pat_*` | `240` req / `60s` (`remote_addr`) | `600s` send/read |

<ApiEndpoint
  method="GET"
  path="/api/enterpriseAuth:start"
  auth="Public (PKCE S256)"
  summary="Khởi tạo code_verifier, code_challenge S256, lưu state vào Valkey DB 2 (TTL 300s) và đặt cookie HttpOnly ldx_enterprise_binding."
/>

<ApiEndpoint
  method="POST"
  path="/api/enterpriseAuth:finish"
  auth="Same-Origin + HttpOnly Cookie"
  summary="Kiểm tra Origin, đối soát timingSafeEqual giữa ticket dùng một lần (TTL 60s) và cookie binding để cấp phiên làm việc."
/>

<ApiEndpoint
  method="POST"
  path="/api/enterpriseAuth:backchannelLogout"
  auth="Keycloak Logout Token"
  summary="Xác thực JWT logout_token từ Keycloak và ghi khóa thu hồi phiên revoked:/revoked_sid: (TTL 24h) vào Valkey DB 2."
/>

## Keycloak OIDC/PKCE và Biên giới Vai trò RBAC

Realm `lattice` trong `infra/config/keycloak/lattice-realm.prod.json` bật `bruteForceProtected: true` (khóa sau `5` lần nhập sai), yêu cầu TOTP MFA theo chính sách OTP và mật khẩu tối thiểu `12` ký tự. Client công khai `dx-native` chỉ cho phép Authorization Code Flow kèm PKCE `S256` (`directAccessGrantsEnabled: false`), tách biệt với client nội bộ `dx-gateway` dùng cho APISIX.

Để ngăn chặn leo thang đặc quyền khi ánh xạ nhóm từ Identity Provider bên ngoài, `syncMappedUserRoles` trong `plugins/nocobase/plugin-enterprise-auth/src/server/policy.js` chỉ chấp nhận tên vai trò khớp mẫu `^ldx_[a-z][a-z0-9_]{1,40}$` và bỏ qua mọi vai trò đặc quyền (`ldx_admin`, `allowConfigure: true`, hoặc vai trò có snippet `pm.*`). Đồng thời, `createRevocationGuard` kiểm tra `revoked:<userId>` và `revoked_sid:<sid>` trên Valkey DB 2 ở mọi yêu cầu để cắt phiên ngay khi nhận back-channel logout hoặc khi quản trị viên gỡ liên kết danh tính (`enterpriseAuth:unlink`).

Trong nội bộ ứng dụng (`native-roles.js` và `portal-roles.js`), hệ thống định nghĩa tám vai trò nghiệp vụ chuẩn `ldx_*` tách biệt khỏi vai trò hệ thống (`root`, `admin`, `anonymous`, `member`):

| Nhóm vai trò | Tên định danh | Phạm vi ủy quyền |
| :--- | :--- | :--- |
| Vận hành tuyến đầu | `ldx_employee`, `ldx_operator`, `ldx_driver` | Tạo yêu cầu, nhận tác vụ quy trình, quét QR và gửi ePOD ngoại tuyến. |
| Kho vận & Điều phối | `ldx_warehouse`, `ldx_dispatcher` | Nhập/xuất kho theo FEFO, giữ/nhả lô theo MKT và điều phối vận chuyển. |
| Quản lý & Điều hành | `ldx_manager`, `ldx_director` | Phê duyệt quy trình đa cấp M-of-N, xem phân tích BI và xử lý cảnh báo sự cố. |
| Quản trị Tenant | `ldx_admin` | Quản lý cổng portal, bộ sưu tập động và nhân sự trong phạm vi tổ chức; bị loại khỏi ánh xạ SSO tự động. |

<CodeTabs :tabs="securityTabs" />

### Quét Tệp Đính kèm qua ClamAV

Mọi tệp đính kèm tải lên `latticeRequests` (`POST /api/latticeRequestAttachments:upload`) phải vượt qua kiểm tra đồng bộ qua ClamAV trên mạng cô lập `scanner` trước khi ghi vào PostgreSQL. Giao thức `zINSTREAM` truyền thẳng luồng nhị phân tối đa `1 MiB` tới `clamd` tại cổng `3310` (`DX_NATIVE_CLAMD_HOST`) với thời gian chờ `15` giây (`native-request-attachments.js`). Nếu daemon chưa sẵn sàng, hệ thống đóng an toàn (*fail-closed*) với mã `503`, còn nếu phát hiện mã độc (`stream: ... FOUND`) thì từ chối ngay với mã `409`.

## Quản lý Bí mật, Mã hóa và Che dữ liệu Nhạy cảm

Các bí mật tích hợp, khóa ký mật mã và khóa API PaaS được quản lý theo nguyên tắc không lưu nguyên bản (*cleartext*) trong cơ sở dữ liệu hay nhật ký:

| Cơ chế | Thành phần | Thuật toán / Cơ chế Bảo vệ |
| :--- | :--- | :--- |
| Kho kết nối `dxosVault` | `connector-vault.js`, `latticeConnectors` | Mã hóa `AES-256-GCM` (`iv:tag:cipher` hex) bằng khóa SHA-256 dẫn xuất từ `DX_VAULT_MASTER_KEY \|\| ENCRYPTION_FIELD_KEY \|\| NOCOBASE_APP_KEY \|\| APP_KEY`; chặn SSRF qua `assertSafeConnectorUrlAsync` (`redirect: 'error'`). |
| Khóa Ed25519 | `pki-ledger.js`, `latticePkiKeys` | Khóa riêng tư ký sổ cái Merkle của mỗi tổ chức được bọc bằng `AES-256-GCM` dựa trên `NOCOBASE_ENCRYPTION_FIELD_KEY \|\| NOCOBASE_APP_KEY`. |
| Khóa API `ldx_pat_*` | `paas-api-keys.js`, `latticeApiKeys` | Token `ldx_pat_<8hex>_<32hex>` chỉ trả về một lần khi tạo, lưu SHA-256 `keyHash`, kiểm tra `timingSafeEqualHex`, giới hạn 7 phạm vi (`read`, `write`, `wms`, `dmn`, `iot`, `ai`, `ledger`) và `clampHeaderRole`. |
| Che PII & Lọc Bundle | `ai-governance.js`, `otel-exporter.js`, `solution-bundle.js` | `redactPiiText` che 9 mẫu nhạy cảm (JWT, Bearer, `sk-...`, email, IBAN, CCCD, SĐT Việt Nam, MST) trước khi ghi log/OTLP; import bundle xóa khóa khớp `SECRET_KEY_RE`. |

<ApiEndpoint
  method="POST"
  path="/api/dxosVault:rotateSecret"
  auth="Bearer JWT | ldx_pat_*"
  scope="write (admin)"
  summary="Xoay vòng và tái mã hóa AES-256-GCM cho bí mật của một connector tích hợp mà không làm lộ giá trị cũ."
/>

## Tách quyền Database (`nocobase_app` và `lattice_app`)

Trong `infra/config/postgres/init-nocobase-db.sh` và `init-prod.sh`, hai cụm PostgreSQL 16 cấm ứng dụng kết nối bằng tài khoản siêu quản trị `POSTGRES_USER`. Vai trò `nocobase_app` (sở hữu database `nocobase`) và các vai trò `lattice_app`, `keycloak_app`, `n8n_app` đều khởi tạo với bộ thuộc tính `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`, đồng thời thu hồi toàn bộ quyền `PUBLIC` trên cơ sở dữ liệu và schema `public`.

Script `init-nocobase-db.sh` kiểm tra tường minh `NOCOBASE_APP_DB_USER != POSTGRES_USER` và hủy khởi tạo nếu hai giá trị trùng nhau, đảm bảo thuộc tính `NOBYPASSRLS` kết hợp với `FORCE ROW LEVEL SECURITY` luôn có hiệu lực tuyệt đối trên toàn bộ 56 bảng tĩnh và các bảng `latticeCustom*`. Trong cụm cơ sở dữ liệu lõi, `init-prod.sh` tách riêng `lattice_app`, `keycloak_app` và `n8n_app` thành ba cơ sở dữ liệu độc lập để ngăn truy cập chéo giữa bảng dữ liệu nền tảng, kho định danh Keycloak và không gian làm việc n8n.

| Vai trò PostgreSQL | Cơ sở dữ liệu sở hữu | Thuộc tính bảo mật | Dịch vụ kết nối |
| :--- | :--- | :--- | :--- |
| `nocobase_app` | `nocobase` (`pgvector`) | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | NocoBase `2.2.50` & 7 plugin LatticeDX |
| `lattice_app` | `lattice` | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | Dịch vụ lõi & lưu trữ tệp |
| `keycloak_app` | `keycloak` | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | Keycloak `26.8.2` IAM |
| `n8n_app` | `n8n` | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | Stack `n8n` tùy chọn (profile `n8n`) |

<ParamGrid
  title="Các Biến Môi trường Bảo mật Cốt lõi (prod.env.example)"
  :items="[
    { name: 'NOCOBASE_APP_DB_USER', type: 'string', required: true, default: 'nocobase_app', description: 'Vai trò runtime non-superuser với NOBYPASSRLS để PostgreSQL cưỡng chế FORCE RLS.' },
    { name: 'NOCOBASE_ENCRYPTION_FIELD_KEY', type: 'secret (32B)', required: true, description: 'Khóa AES-256-GCM dùng bọc khóa riêng tư Ed25519 và bí mật connector vault.' },
    { name: 'DX_CORS_STRICT', type: 'boolean', default: 'true', description: 'Xóa header CORS khi Origin không thuộc DX_CORS_ALLOWED_ORIGINS hoặc host hợp lệ.' },
    { name: 'DX_NATIVE_AUTH_CLIENT_ID', type: 'string', default: 'dx-native', description: 'Client OIDC công khai trên Keycloak bắt buộc PKCE S256.' },
    { name: 'DX_ALLOW_INTERNAL_CONNECTORS', type: 'boolean', default: 'false', description: 'Mặc định chặn connector gọi vào dải mạng nội bộ để chống SSRF.' }
  ]"
/>

## Tài liệu liên quan

- [Đa khách hàng & PostgreSQL 16 FORCE RLS](/architecture/multi-tenancy-rls)
- [Triển khai Production](/getting-started/production-deployment)
- [Khóa API theo Phạm vi](/reference/api-keys)
- [Sổ cái PKI & Cây Merkle](/reference/pki-merkle-ledger)
