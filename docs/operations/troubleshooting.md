---
title: Xử lý Sự cố Hệ thống
description: Cẩm nang chẩn đoán lỗi xác thực Keycloak OIDC, PostgreSQL 16 FORCE RLS, mạng Docker Compose, IIoT Mosquitto/Orion-LD và AI Providers.
---

# Xử lý Sự cố Hệ thống

Tài liệu này tổng hợp các kịch bản chẩn đoán lỗi vận hành trên năm lớp hạ tầng chính của LatticeDX: xác thực Keycloak OIDC/PKCE, chính sách PostgreSQL 16 `FORCE ROW LEVEL SECURITY`, phân vùng mạng Docker Compose, đường ống IIoT (Mosquitto, Node-RED, Orion-LD) và cổng AI/MCP. Mọi lệnh kiểm tra đều chạy ở chế độ chỉ đọc trước khi thực hiện can thiệp trạng thái.

## Bảng tra cứu nhanh triệu chứng và điểm kiểm tra

<ParamGrid
  title="Ma trận chẩn đoán nhanh theo phân hệ"
  :items="[
    { name: 'OIDC / PKCE 401 hoặc Loop', type: 'Keycloak + Valkey DB 2', description: 'Kiểm tra lệch issuer giữa DX_NATIVE_AUTH_ISSUER và DX_NATIVE_AUTH_INTERNAL_ISSUER hoặc hết hạn ticket: (60s).' },
    { name: 'RLS trả về 0 dòng / 42501', type: 'PG16 + nocobase_app', description: 'Xác minh DX_PG_RLS_SESSION=true, app.current_org trong transaction và quyền NOBYPASSRLS của nocobase_app.' },
    { name: 'Timeout giữa các container', type: 'Docker Networks', description: 'Kiểm tra container có nằm chung mạng internal (app, data, scanner, iiot-net) và đọc logs healthcheck.' },
    { name: 'IIoT mất telemetry / Outbox kẹt', type: 'Mosquitto + Orion-LD', description: 'Kiểm tra ACL dynamic-security.json, biến allowlist SSRF và bản ghi failed trong latticeContextOutbox.' },
    { name: 'AI / RAG lỗi hoặc nghẽn trace', type: 'plugin-dxos-ai', description: 'Kiểm tra AGENT_BASE_URL, chiều vector DX_EMBEDDING_DIM=1536 và hàng đợi OTel tại /api/dxos:health.' }
  ]"
/>

## 1. Xác thực Keycloak OIDC, PKCE và Thu hồi Phiên

Luồng đăng nhập doanh nghiệp qua `plugin-enterprise-auth` tách biệt địa chỉ trình duyệt (`DX_NATIVE_AUTH_ISSUER`) khỏi địa chỉ giao tiếp nội bộ giữa `nocobase` và `keycloak` (`DX_NATIVE_AUTH_INTERNAL_ISSUER`), đồng thời lưu trạng thái tạm trên Valkey DB 2.

### Triệu chứng: Lỗi `invalid_state`, hết hạn `ticket` hoặc chuyển hướng sai miền

| Nguyên nhân gốc | Cơ chế kiểm tra & khắc phục |
| :--- | :--- |
| Lệch Issuer nội bộ và công khai | Khi `DX_NATIVE_AUTH_ISSUER` đặt theo `https://${KEYCLOAK_DOMAIN}/realms/lattice` nhưng `DX_NATIVE_AUTH_INTERNAL_ISSUER` thiếu hoặc trỏ nhầm cổng, bước đổi mã tại `/api/enterpriseAuth:callback` sẽ thất bại. Kiểm tra `DX_NATIVE_AUTH_ORIGIN` khớp chính xác scheme và host trình duyệt đang truy cập. |
| Hết hạn trạng thái PKCE trên Valkey DB 2 | Khóa `state:` có TTL `300s` và mã đổi phiên một lần `ticket:` chỉ tồn tại `60s` cùng cookie `HttpOnly` `ldx_enterprise_binding`. Nếu trễ mạng, cấu hình proxy chặn cookie hoặc đồng hồ hệ thống lệch múi giờ vượt ngưỡng, `/api/enterpriseAuth:finish` sẽ từ chối cấp phiên. |
| Bị khóa brute-force hoặc thiếu ánh xạ vai trò | Realm production (`lattice-realm.prod.json`) bật `bruteForceProtected: true` (khóa sau `5` lần sai mật khẩu). Khi kiểm tra vai trò, lưu ý `DX_NATIVE_AUTH_GROUP_ROLE_MAP` trong `policy.js` chủ động bỏ qua các vai trò đặc quyền `ldx_admin`, `allowConfigure` và `pm*` để chặn leo thang quyền qua nhóm OIDC. |

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra OIDC Discovery',
      lang: 'bash',
      code: '# Kiểm tra từ host (môi trường local)\ncurl -fsS http://127.0.0.1:8081/realms/lattice/.well-known/openid-configuration | jq \x22{issuer, token_endpoint, jwks_uri}\x22\n\n# Kiểm tra kết nối nội bộ từ container nocobase sang keycloak\ndocker compose -f infra/compose/prod.yml exec nocobase node -e \x22fetch(process.env.DX_NATIVE_AUTH_INTERNAL_ISSUER + \x27/.well-known/openid-configuration\x27).then(r=>console.log(r.status))\x22'
    },
    {
      label: 'Kiểm tra Valkey DB 2',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml exec redis valkey-cli --no-auth-warning -a \x22$REDIS_PASSWORD\x22 -n 2 KEYS \x22*\x22\n# Kiểm tra khóa thu hồi phiên backchannelLogout (TTL 24h)\ndocker compose -f infra/compose/prod.yml exec redis valkey-cli --no-auth-warning -a \x22$REDIS_PASSWORD\x22 -n 2 TTL \x22revoked_sid:<session_id>\x22'
    }
  ]"
/>

## 2. PostgreSQL 16 `FORCE RLS` (`app.current_org` và `nocobase_app`)

Tất cả 56 bảng tĩnh và các bảng động `latticeCustom*` đều bật `ENABLE` và `FORCE ROW LEVEL SECURITY` dựa trên GUC cục bộ giao dịch `app.current_org` và `app.rls_bypass`.

### Triệu chứng: Truy vấn trả về rỗng, lỗi `42501` hoặc lỗi `25P02`

| Nguyên nhân gốc | Cơ chế kiểm tra & khắc phục |
| :--- | :--- |
| Thiếu giao dịch bao bọc `set_config` | Nếu truy vấn chạy trực tiếp qua connection pool mà không đi qua `withTenantRlsContext` hoặc `withSystemRlsBypass` (hoặc tắt `DX_PG_RLS_SESSION`), `current_setting('app.current_org', true)` trả về rỗng khiến chính sách `lattice_tenant_isolation` chặn toàn bộ dòng dữ liệu. |
| Lỗi `25P02` (`current transaction is aborted`) | Khi một truy vấn phụ lỗi bên trong transaction RLS đang mở mà không sử dụng `runInRlsSavepoint` (`SAVEPOINT "ldx_sp_<n>"`), toàn bộ giao dịch đó bị đánh dấu hủy cho đến khi rollback. |
| Vai trò kết nối sai quyền hạn | Tập lệnh `init-nocobase-db.sh` bắt buộc `NOCOBASE_APP_DB_USER` (`nocobase_app`) khác `POSTGRES_USER` và mang cờ `NOSUPERUSER NOBYPASSRLS`. Nếu cấu hình ứng dụng đăng nhập bằng tài khoản superuser (`nocobase` hoặc `postgres`), `FORCE ROW LEVEL SECURITY` sẽ mất hiệu lực bảo vệ. |

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra quyền Role & RLS',
      lang: 'sql',
      code: '-- 1. Xác minh nocobase_app không có quyền BYPASSRLS\nSELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN (\x27nocobase_app\x27, \x27nocobase\x27, \x27lattice_app\x27);\n\n-- 2. Kiểm tra chính sách trên bảng camelCase và snake_case\nSELECT schemaname, tablename, policyname, qual, with_check\nFROM pg_policies\nWHERE tablename IN (\x27latticeOrders\x27, \x27lattice_native_request_attachments\x27);'
    },
    {
      label: 'Mô phỏng truy vấn theo Org',
      lang: 'sql',
      code: 'BEGIN;\nSET ROLE nocobase_app;\nSELECT set_config(\x27app.current_org\x27, \x27org-a\x27, true);\nSELECT count(*) FROM public.\x22latticeOrders\x22;\nROLLBACK;'
    }
  ]"
/>

## 3. Mạng Docker Compose, Gateway và Dịch vụ Phụ trợ

`infra/compose/prod.yml` cô lập lưu lượng qua 5 mạng riêng biệt: `edge` (duy nhất tiếp xúc ngoài qua Caddy, Keycloak, APISIX, NocoBase), `app` (`internal: true`), `data` (`internal: true`), `scanner` (`internal: true`) và `iiot-net` (`internal: true`).

### Triệu chứng: Container `healthy` nhưng gọi liên dịch vụ báo `ECONNREFUSED` hoặc CORS bị chặn

| Nguyên nhân gốc | Cơ chế kiểm tra & khắc phục |
| :--- | :--- |
| Chạy thiếu profile hoặc lệch tên container | Kiểm tra các dịch vụ tùy chọn (`observability`, `iiot`, `n8n`, `pdf`, `iam-sync`) đã được bật đúng profile. Sử dụng `pnpm local:doctor --integration` ở môi trường local để dò nhanh `api`, `keycloak`, `nocobase`, `orion-ld` và `n8n`. |
| CORS bị gỡ bởi `DX_CORS_STRICT=true` | Middleware trong `observability.js` chủ động xóa toàn bộ header `Access-Control-Allow-*` nếu header `Origin` không khớp danh sách `DX_CORS_ALLOWED_ORIGINS` hoặc host của request. |
| Từ chối tải tệp hoặc treo trạng thái `pending` | Dịch vụ `file-scanner:4010` giao tiếp với `clamav:3310` qua mạng `scanner`. Nếu `clamav` đang cập nhật chữ ký hoặc quá giới hạn RAM `2048m`, các tệp tải lên sẽ bị giữ trạng thái chờ cho tới ngưỡng `DX_UPLOAD_STALE_PENDING_MS` (`900000` ms). Kiểm tra dung lượng `tmpfs` và trạng thái `clamdcheck.sh`. |

<CodeTabs
  :tabs="[
    {
      label: 'Chẩn đoán Local Stack',
      lang: 'bash',
      code: 'pnpm local:doctor --integration\ndocker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml ps'
    },
    {
      label: 'Kiểm tra Production & Scanner',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml ps\ndocker compose -f infra/compose/prod.yml exec file-scanner node -e \x22fetch(\x27http://127.0.0.1:4010/health\x27).then(r=>console.log(r.status))\x22\ndocker compose -f infra/compose/prod.yml logs --tail 80 gateway caddy'
    }
  ]"
/>

## 4. Cụm IIoT: Mosquitto DynSec, Node-RED và FIWARE Orion-LD

Dữ liệu cảm biến đi qua `mosquitto:1883` (chỉ mở trong mạng `iiot-net`) vào `nodered:1880`, đồng bộ tới `nocobase` và `orion-ld:1026`.

### Triệu chứng: Cảm biến bị từ chối MQTT hoặc `latticeContextOutbox` tích tụ `failed`

| Nguyên nhân gốc | Cơ chế kiểm tra & khắc phục |
| :--- | :--- |
| Từ chối kết nối MQTT hoặc không nhận lệnh downlink | `mosquitto.conf` tắt hoàn toàn ẩn danh (`allow_anonymous false`) và chặn mọi quyền mặc định trong `init-dynsec.sh`. Tài khoản bridge (`MQTT_BRIDGE_USER`) chỉ được phép subscribe `latticedx/#` và publish lên `latticedx/+/+/command`. Nếu đổi mật khẩu `MQTT_BRIDGE_PASSWORD` sau khi volume `mosquitto-data` đã tạo `/mosquitto/data/dynamic-security.json`, phải cập nhật lại client qua `mosquitto_ctrl dynsec` hoặc khởi tạo lại mật khẩu trong `dynamic-security.json`. |
| Chặn SSRF khi đồng bộ Orion-LD hoặc Node-RED | Nếu URL đích nằm ngoài danh sách cho phép của `DX_ORION_HOST_ALLOWLIST`, `DX_ORION_CALLBACK_HOST_ALLOWLIST` hoặc `DX_NODERED_HOST_ALLOWLIST`, bộ giao vận sẽ từ chối gửi lệnh để bảo vệ mạng nội bộ. |
| Kẹt hàng đợi `latticeContextOutbox` | Trình rút hàng đợi chạy mỗi `10s` sử dụng khóa hàng PostgreSQL `FOR UPDATE OF o SKIP LOCKED` theo từng thực thể. Nếu một worker dừng đột ngột, khóa sẽ tự giải phóng sau `DX_OUTBOX_STALE_LOCK_MS` (`120000` ms); sau `5` lần thử (`DX_OUTBOX_MAX_ATTEMPTS`), bản ghi chuyển sang `failed` và không tự chạy lại cho đến khi xử lý thủ công qua `/api/latticeContextSync`. |

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra Orion-LD & Node-RED',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml exec orion-ld curl -fsS http://127.0.0.1:1026/version\ndocker compose -f infra/compose/prod.yml logs --tail 80 mosquitto nodered'
    },
    {
      label: 'Kiểm tra tồn đọng Outbox',
      lang: 'sql',
      code: 'SELECT state, count(*), max(\x22updatedAt\x22) AS last_updated\nFROM public.\x22latticeContextOutbox\x22\nGROUP BY state\nORDER BY state;'
    }
  ]"
/>

## 5. Nhà cung cấp AI, MCP Gateway và Hybrid RAG

`plugin-dxos-ai` gọi mô hình qua cấu hình `AGENT_PROVIDER`, `AGENT_BASE_URL` và `AGENT_MODEL`, truy vấn vector `pgvector` theo kích thước `DX_EMBEDDING_DIM` (`1536`) và ghi span OTel vào `latticeAiTraces`.

### Triệu chứng: Lỗi gọi công cụ MCP, lỗi chiều vector RAG hoặc rớt span OTel

| Nguyên nhân gốc | Cơ chế kiểm tra & khắc phục |
| :--- | :--- |
| Lỗi gọi HTTP từ công cụ MCP | Cổng `/api/dxos-mcp` mặc định chặn gọi ra địa chỉ nội bộ trừ khi host được khai báo trong `DXOS_MCP_INTERNAL_HTTP_ALLOWLIST`. Kiểm tra mã lỗi trả về trong phản hồi JSON-RPC và nhật ký `latticeAiAuditLogs`. |
| Lỗi truy vấn RAG P.A.R.A. | Nếu thay đổi mô hình embedding mà kích thước vector trả về khác `DX_EMBEDDING_DIM` (`1536`), truy vấn tương đồng trên chỉ mục HNSW của `latticeParaChunks` sẽ phát sinh lỗi chiều vector; cần lập chỉ mục lại kho tài liệu với kích thước thống nhất. |
| Thiếu trace trong Collector hoặc rớt span | Kiểm tra đối tượng `otel` trong đầu ra `/api/dxos:health`: nếu `exportFailures` tăng hoặc `lastError` hiển thị mã HTTP/lỗi mạng, xác minh biến `OTEL_EXPORTER_OTLP_ENDPOINT` (`http://otel-collector:4318`) và trạng thái container `otel-collector` trên mạng `app`. |

```bash
# Kiểm tra hàng đợi OTel trực tiếp từ /api/dxos:health
curl -fsS http://127.0.0.1:13000/api/dxos:health | jq '.data.otel // .otel'
```

## 6. Khóa API `ldx_pat_*` và Sổ cái Mật mã PKI

Các điểm cuối headless tích hợp với `latticeApiKeys` và `latticeCryptoLedger` áp dụng cơ chế từ chối mặc định nếu thiếu phạm vi quyền hoặc sai lệch chữ ký.

1. **Từ chối `401`/`403` với `ldx_pat_*`**: Khóa API có định dạng `ldx_pat_<8hex>_<32hex>` và chỉ lưu băm SHA-256 (`keyHash`) trong `latticeApiKeys` (bảng này bị khóa truy cập REST trực tiếp bởi private guard). Kiểm tra hạn sử dụng (`expiresInDays` tối đa `365`), danh sách scope (`read`, `write`, `wms`, `dmn`, `iot`, `ai`, `ledger`) và lưu ý `clampHeaderRole` luôn chặn header yêu cầu vai trò cao hơn vai trò gắn với khóa.
2. **Lỗi `LEDGER_IMMUTABLE` hoặc sai lệch Merkle Root**: Sổ cái `latticeCryptoLedger` khóa tuần tự theo tổ chức bằng `pg_advisory_xact_lock` và từ chối mọi thao tác `UPDATE`/`DELETE`. Nếu xác minh chữ ký ePOD qua `/api/dxosWms:verifyTrackSignature` thất bại sau khi khôi phục hệ thống, kiểm tra lại `LATTICE_TRACK_VERIFY_SECRET` và `NOCOBASE_ENCRYPTION_FIELD_KEY` đã khớp với môi trường gốc trước khi sao lưu.

## Tài liệu liên quan

- [Giám sát và Truy vết Hệ thống](/operations/observability)
- [Kiểm thử và Xác minh](/operations/testing-and-verification)
- [Đa tổ chức và PostgreSQL RLS](/architecture/multi-tenancy-rls)
- [Bản sao Số IIoT](/domains/iiot-digital-twin)
