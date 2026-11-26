---
title: Tích hợp Stock n8n & OAuth2 PKCE
description: Cầu nối REST API v1 với n8nio/n8n:2.48.1, Connector Vault AES-256-GCM, quy trình bắt tay OAuth2 PKCE S256 và đồng bộ webhook hai chiều qua dxosEvents.
---

<script setup>
const n8nTabs = [
  {
    label: 'cURL (Kiểm tra trạng thái & Tạo workflow)',
    lang: 'bash',
    code: `# Kiểm tra trạng thái cầu nối n8n
curl -sS "https://app.latticedx.example.com/api/dxosN8n:status" \\
  -H "Authorization: Bearer ldx_pat_your_token"

# Đồng bộ credential Telegram từ Connector Vault sang n8n
curl -sS -X POST "https://app.latticedx.example.com/api/dxosN8n:syncCredential" \\
  -H "Authorization: Bearer ldx_pat_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetConnectorKey": "tg-ops",
    "credentialName": "Ops Telegram Alert"
  }'`,
  },
  {
    label: 'TypeScript (Gọi cầu nối từ SDK)',
    lang: 'ts',
    code: `const response = await fetch(
  "https://app.latticedx.example.com/api/dxosN8n:activateWorkflow",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.LATTICE_PAT}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflowId: "14",
      active: true,
      idempotencyKey: "activate-coldchain-wf-14",
    }),
  },
);`,
  },
  {
    label: 'JSON Status Output',
    lang: 'json',
    code: `{
  "organizationId": "org_coldchain",
  "connectorKey": "primary-n8n",
  "ok": true,
  "healthzOk": true,
  "apiOk": true,
  "hasApiKey": true,
  "status": 200,
  "baseUrl": "http://n8n:5678",
  "latencyMs": 18
}`,
  },
];
</script>

# Tích hợp Stock n8n & OAuth2 PKCE

LatticeDX tích hợp dịch vụ **stock `n8nio/n8n:2.48.1`** tách biệt qua cầu nối REST v1 (`n8n-api-client.js`), kho khóa mã hóa AES-256-GCM (`connector-vault.js`) và hệ thống phân phối sự kiện CloudEvents `1.0` (`event-bus.js`). Kiến trúc này tách hoàn toàn runtime điều phối mở rộng của `n8n` khỏi lõi nhân và plugin Apache-2.0 của LatticeDX, đồng thời kiểm soát tập trung thông tin xác thực, chống giả mạo SSRF và làm mới token OAuth2 theo từng tenant.

<N8nBridgeDiagram />

## Kiến trúc Triển khai & Biến Môi trường

Dịch vụ `n8n` chạy dưới dạng container OCI độc lập (`n8nio/n8n:2.48.1`) trên cổng nội bộ `5678` trong file `infra/compose/integration.yml`. Cầu nối `dxosN8n` đọc cấu hình kết nối từ bản ghi `latticeConnectors` đang hoạt động của tenant trước, sau đó mới rơi về biến môi trường `DX_N8N_API_URL` và `DX_N8N_API_KEY` nếu tenant chưa khai báo connector riêng.

<ParamGrid
  title="Biến Môi trường Kết nối n8n và Connector Vault"
  :items="[
    { name: 'DX_N8N_API_URL', type: 'string', default: 'http://n8n:5678', description: 'URL gốc dự phòng trỏ tới dịch vụ Stock n8n khi tenant chưa cấu hình connector n8n_api trong Vault.' },
    { name: 'DX_N8N_API_KEY', type: 'string', description: 'Khóa X-N8N-API-KEY dự phòng cho cầu nối REST v1.' },
    { name: 'N8N_ENCRYPTION_KEY', type: 'string', required: true, description: 'Khóa mã hóa nội bộ của container n8nio/n8n:2.48.1.' },
    { name: 'N8N_RUNNERS_ENABLED', type: 'boolean', default: 'true', description: 'Bật task runner cô lập trong runtime n8n.' },
    { name: 'DX_VAULT_MASTER_KEY', type: 'string', description: 'Khóa gốc dẫn xuất AES-256-GCM (ưu tiên trước ENCRYPTION_FIELD_KEY, NOCOBASE_APP_KEY, APP_KEY).' },
    { name: 'DX_ALLOW_INTERNAL_CONNECTORS', type: 'boolean', default: 'true', description: 'Cho phép connector gọi tới các host nội bộ trong danh sách cho phép của Compose.' },
    { name: 'DX_INTERNAL_SERVICE_HOSTS', type: 'string', default: 'n8n,orion-ld,nodered,mosquitto', description: 'Danh sách host nội bộ hợp lệ được miễn chặn IP riêng tư bởi bộ lọc SSRF.' }
  ]"
/>

## Cầu nối REST v1 (`dxosN8n`)

Tài nguyên `dxosN8n` cung cấp 10 action quản trị workflow, lịch sử thực thi và đồng bộ credential sang Stock `n8n` (`/api/v1/*`). Mọi yêu cầu bắt buộc đi qua `requireN8nAdmin`: người dùng phải có vai trò `root`, `admin` hoặc `ldx_admin` (hoặc `isOrgAdmin`) và mang PAT scope `read` / `write` / `ai` tương ứng.

<ApiEndpoint
  method="GET"
  path="/api/dxosN8n:status"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | ai"
  summary="Kiểm tra đầu cuối /healthz của n8n và thử gọi GET /api/v1/workflows?limit=1 để xác nhận X-N8N-API-KEY hợp lệ."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosN8n:createWorkflow"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai"
  summary="Tạo workflow mới trên n8n qua POST /api/v1/workflows kèm header Idempotency-Key tự động."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosN8n:syncCredential"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai"
  summary="Giải mã bí mật hoặc lấy OAuth2 access token còn hiệu lực từ dxosVault, chuyển sang định dạng credential của n8n và lưu n8nCredentialId vào latticeConnectors."
/>

Bảng dưới đây liệt kê toàn bộ 10 action của `dxosN8n` và đầu cuối `n8n` REST v1 tương ứng:

| Action `dxosN8n` | Phương thức | Đầu cuối Stock `n8n` | Chức năng chính |
| :--- | :--- | :--- | :--- |
| `status` | `GET` | `GET /healthz`, `GET /api/v1/workflows?limit=1` | Trả về `ok`, `healthzOk`, `apiOk`, `hasApiKey`, `latencyMs` |
| `appCatalog` | `GET` | — | Trả về 11 ứng dụng trong `APP_CONNECTOR_CATALOG` kèm `configuredCount` theo tenant |
| `workflows` | `GET` | `GET /api/v1/workflows` | Lọc theo `active`, `tags`, `name`, `limit` (`1..250`), `cursor` |
| `getWorkflow` | `GET` | `GET /api/v1/workflows/:id` | Đọc chi tiết định nghĩa node và connection của workflow |
| `createWorkflow` | `POST` | `POST /api/v1/workflows` | Tạo mới workflow với `Idempotency-Key` |
| `updateWorkflow` | `POST` | `PUT /api/v1/workflows/:id` | Cập nhật định nghĩa workflow hiện có |
| `activateWorkflow` | `POST` | `POST /api/v1/workflows/:id/activate` hoặc `/deactivate` | Bật hoặc tắt trạng thái kích hoạt workflow trên `n8n` |
| `executions` | `GET` | `GET /api/v1/executions` | Lọc lịch sử chạy theo `workflowId`, `status`, `includeData`, `limit`, `cursor` |
| `retryExecution` | `POST` | `POST /api/v1/executions/:id/retry` | Chạy lại phiên thực thi lỗi với tùy chọn `loadWorkflow` |
| `syncCredential` | `POST` | `POST /api/v1/credentials` | Đẩy bí mật hoặc OAuth2 token từ `dxosVault` sang `n8n` và lưu `n8nCredentialId` |

Mọi yêu cầu thay đổi trạng thái (`POST`, `PUT`, `PATCH`, `DELETE`) gửi sang `n8n` tự động gắn header `Idempotency-Key` (mặc định `ldx-<uuid>`, hoặc `ldx-cred-<orgId>-<connectorKey>-v<secretVersion>` khi đồng bộ credential). Thông báo lỗi trả về từ `n8n` được lọc qua `scrubN8nSecrets` để thay mọi giá trị API key hoặc secret bằng `[REDACTED]`.

<CodeTabs :tabs="n8nTabs" />

## Kho Khóa Connector Vault & Ánh xạ Credential

Collection `latticeConnectors` bị khóa truy cập CRUD trực tiếp bởi middleware `registerConnectorVaultDirectGuard` (trả về `403`). Mọi thao tác quản lý bí mật phải đi qua 8 action của `dxosVault`: `list`, `save`, `rotateSecret`, `delete`, `testConnection`, `appCatalog`, `oauthStart` và `oauthCallback`.

Bí mật lưu trong `encryptedSecretsJson`, `oauthAccessTokenEnc` và `oauthRefreshTokenEnc` được mã hóa bằng **AES-256-GCM** dưới định dạng `iv:tag:cipher` (hex), sử dụng khóa dẫn xuất SHA-256 từ `DX_VAULT_MASTER_KEY` (hoặc khóa ứng dụng dự phòng). Khi gọi `dxosN8n:syncCredential`, hàm `buildCredentialPayloadFromConnector` tự động chuyển cấu trúc bí mật sang loại credential tương ứng của Stock `n8n`:

| `appType` trong `APP_CONNECTOR_CATALOG` | Loại xác thực | `n8nCredentialType` đích | Trường bí mật được ánh xạ |
| :--- | :--- | :--- | :--- |
| `telegram` | `api_key`, `bearer` | `telegramApi` | `accessToken` (từ `botToken` / `accessToken`) |
| `email_smtp` | `basic`, `none` | `smtp` | `user`, `password`, `host`, `port`, `secure` |
| `gmail_oauth2` | `oauth2` | `gmailOAuth2` | `clientId`, `clientSecret`, `oauthTokenData.access_token` |
| `google_sheets_oauth2` | `oauth2` | `googleSheetsOAuth2Api` | `clientId`, `clientSecret`, `oauthTokenData.access_token` |
| `slack` | `oauth2`, `bearer` | `slackOAuth2Api` | `accessToken`, `oauthTokenData.access_token` |
| `discord` | `bearer`, `none` | `discordWebhookApi` | `webhookUrl`, `botToken` |
| `teams` | `oauth2`, `bearer` | `microsoftTeamsOAuth2Api` | `accessToken`, `oauthTokenData.access_token` |
| `github` | `oauth2`, `bearer` | `githubOAuth2Api` | `accessToken`, `oauthTokenData.access_token` |
| `rustfs_s3` | `api_key`, `basic` | `s3` | `endpoint`, `region`, `accessKeyId`, `secretAccessKey` |
| `n8n_api` | `api_key`, `hmac`, `bearer` | `httpHeaderAuth` | `apiKey`, `webhookSecret` |
| `partner_webhook` | `hmac`, `bearer`, `api_key` | `httpHeaderAuth` | `name` header (`Authorization` / `X-API-Key`) và `value` |

## Quy trình Bắt tay OAuth2 PKCE `S256` & Single-Flight Refresh

Đối với các ứng dụng hỗ trợ OAuth2 (`gmail_oauth2`, `google_sheets_oauth2`, `slack`, `teams`, `github`), `connector-vault.js` triển khai đầy đủ chuẩn **RFC 7636 PKCE (`S256`)** với cơ chế tiêu thụ nonce một lần để tránh khóa giao dịch CSDL khi gọi HTTP ra ngoài:

| Bước | Giai đoạn / Endpoint | Hành vi thực thi |
| :---: | :--- | :--- |
| `1` | Khởi tạo (`POST /api/dxosVault:oauthStart`) | Sinh `codeVerifier` ngẫu nhiên 32 byte dạng `base64url`, tính `codeChallenge = SHA256(codeVerifier)` (`codeChallengeMethod: "S256"`), và tạo `stateNonce` 24 byte hex (hiệu lực `OAUTH_STATE_TTL_MS = 15 phút`). Đối tượng `_oauthPkce` được mã hóa AES-256-GCM vào `encryptedSecretsJson` trước khi trả về `authorizeUrl`. |
| `2` | Tiêu thụ nonce tại TX1 (`GET/POST /api/dxosVault:oauthCallback`) | Mở giao dịch khóa hàng (`SELECT ... FOR UPDATE`), đối chiếu `state` bằng `timingSafeEqual`, kiểm tra hạn `15 phút`, xóa ngay `oauthStateNonce` và `_oauthPkce` rồi kết thúc TX1 trước khi mở kết nối HTTP. |
| `3` | Trao đổi mã bên ngoài TX | Thực hiện `POST` dạng `application/x-www-form-urlencoded` (`grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`, `client_id`) với `redirect: 'error'` và thời gian chờ `10,000 ms`. |
| `4` | Lưu token mã hóa tại TX2 | Mã hóa `access_token` và `refresh_token` vào `oauthAccessTokenEnc` / `oauthRefreshTokenEnc` cùng mốc `oauthTokenExpiresAt`. |
| `5` | Làm mới Single-Flight (`getFreshConnectorToken`) | Nếu `expiresAt - now <= 180 giây` (`OAUTH_REFRESH_BUFFER_SEC_DEFAULT`), mọi tiến trình gọi đồng thời trên cùng `(organizationId, connectorId)` dùng chung một Promise trong `dbInflightTokenRefresh` (`WeakMap`) để chỉ gửi đúng một yêu cầu `refresh_token` tới nhà cung cấp OAuth2. |

<ApiEndpoint
  method="POST"
  path="/api/dxosVault:oauthStart"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Tạo stateNonce 15 phút và cặp PKCE S256 cho connector OAuth2, trả về authorizeUrl để chuyển hướng người dùng."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosVault:oauthCallback"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Tiêu thụ một lần oauthStateNonce, trao đổi authorization code lấy token và lưu trữ mã hóa AES-256-GCM."
/>

## Đồng bộ Webhook Hai Chiều (`dxosEvents` & `dxosAutomations`)

Luồng đồng bộ sự kiện giữa LatticeDX và Stock `n8n` hoạt động theo mô hình hai chiều không tin cậy ngầm định:

- **Chiều đi (LatticeDX sang `n8n`):** Khi nghiệp vụ phát sự kiện qua `dxosEvents:publish` (ví dụ `alarm.triggered`, `device.offline`, `lot.held_mkt`), hàng đợi `latticeWebhookDeliveries` gửi `POST` theo chuẩn CloudEvents `1.0` và **Standard Webhooks** (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<b64>`, `ce-type`) tới đầu cuối `n8n` Webhook Trigger (`rawBody: true`). Blueprint trong `lattice-templates/n8n-workflows/` kiểm chứng chữ ký HMAC-SHA256 và cửa sổ trễ `300s` ngay tại node Code đầu vào.
- **Chiều về (`n8n` gọi lại LatticeDX):** Workflow `n8n` gọi ngược vào `/api/dxosAutomations:runNow` (dùng Bearer PAT theo phạm vi quyền tối thiểu) hoặc `/api/dxosAutomations:webhookIngress` (dùng chữ ký `X-Lattice-Signature-256` hoặc Standard Webhooks) để kích hoạt luồng DAG xử lý nội bộ.

## Chốt Bảo vệ SSRF & Bảng Mã lỗi

Mọi URL cấu hình trên connector và từng yêu cầu `n8n` đi ra đều qua kiểm tra `assertSafeConnectorUrl` (đồng bộ) và `assertSafeConnectorUrlAsync` (phân giải DNS bất đồng bộ). Bộ lọc chặn các giao thức ngoài `http:`/`https:`, chặn thông tin đăng nhập nhúng trong URL (`user:pass@host`), chặn dải IP loopback/private/link-local và dải metadata đám mây (`169.254.*`, `fd00:ec2::254`), ngoại trừ các host trong `DX_INTERNAL_SERVICE_HOSTS` khi `DX_ALLOW_INTERNAL_CONNECTORS=true`. Tùy chọn `redirect: 'error'` được bật cố định trên `fetch()` để ngăn tấn công chuyển hướng mở sang địa chỉ nội bộ.

Các mã lỗi thường gặp từ `dxosN8n` và `dxosVault` khi vận hành cầu nối:

| Mã lỗi | HTTP | Nguyên nhân và hướng xử lý |
| :--- | :--- | :--- |
| `N8N_CONNECTOR_NOT_CONFIGURED` | `404` | Tenant chưa có connector `n8n`/`n8n_api` đang bật và thiếu `DX_N8N_API_URL` |
| `N8N_API_KEY_MISSING` | `400` | Connector hoặc biến môi trường thiếu khóa `X-N8N-API-KEY` |
| `N8N_ADMIN_REQUIRED` | `403` | Người gọi không giữ vai trò `root`, `admin` hoặc `ldx_admin` |
| `N8N_API_HTTP_ERROR` | `4xx` / `502` | `n8n` trả mã lỗi HTTP; phản hồi đã được `scrubN8nSecrets` che khóa bí mật |
| `CONNECTOR_URL_UNSAFE` | `400` | URL đích vi phạm bộ lọc SSRF hoặc chứa thông tin xác thực nhúng |
| `OAUTH_STATE_MISMATCH` | `400` | `stateNonce` không khớp hoặc đã được tiêu thụ một lần tại TX1 |
| `OAUTH_STATE_EXPIRED` | `400` | Thời gian từ `oauthStart` đến `oauthCallback` vượt quá `15 phút` |
| `OAUTH_REFRESH_TOKEN_MISSING` | `401` | Access token đã hết hạn và connector chưa lưu `oauthRefreshTokenEnc` |

## Tài liệu liên quan

- [Webhook, Ký HMAC & Lập lịch Cron](/automation/webhooks-and-schedules)
- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [Khóa API theo Phạm vi & Xác thực](/reference/api-keys)
- [Bảng Điều khiển & Gói Giải pháp GitOps](/studio/solution-bundles)
