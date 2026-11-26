---
title: Stock n8n Integration & OAuth2 PKCE
description: REST API v1 bridge to stock n8nio/n8n:2.48.1, AES-256-GCM Connector Vault, OAuth2 PKCE S256 handshake, and bidirectional webhook synchronization via dxosEvents.
---

<script setup>
const n8nTabs = [
  {
    label: 'cURL (Status & Credential Sync)',
    lang: 'bash',
    code: `# Verify n8n REST v1 bridge health
curl -sS "https://app.latticedx.example.com/api/dxosN8n:status" \\
  -H "Authorization: Bearer ldx_pat_your_token"

# Sync a Telegram Vault connector into Stock n8n
curl -sS -X POST "https://app.latticedx.example.com/api/dxosN8n:syncCredential" \\
  -H "Authorization: Bearer ldx_pat_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetConnectorKey": "tg-ops",
    "credentialName": "Ops Telegram Alert"
  }'`,
  },
  {
    label: 'TypeScript (Activate Workflow)',
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

# Stock n8n Integration & OAuth2 PKCE

LatticeDX integrates **stock `n8nio/n8n:2.48.1`** as an external orchestration runtime through its REST v1 bridge (`n8n-api-client.js`), AES-256-GCM Connector Vault (`connector-vault.js`), and CloudEvents `1.0` Event Bus (`event-bus.js`). This separation keeps external community workflow nodes isolated from LatticeDX's Apache-2.0 plugin core while centralizing credential encryption, SSRF enforcement, and OAuth2 token refreshes per tenant.

<N8nBridgeDiagram />

## Deployment Topology & Environment Variables

Stock `n8n` runs as an isolated OCI container (`n8nio/n8n:2.48.1`) on internal port `5678` defined in `infra/compose/integration.yml`. When resolving an organization's `n8n` client, `dxosN8n` first looks up active `n8n` / `n8n_api` records in `latticeConnectors` and falls back to `DX_N8N_API_URL` and `DX_N8N_API_KEY` when no tenant-specific connector is configured.

<ParamGrid
  title="n8n Bridge & Connector Vault Environment Variables"
  :items="[
    { name: 'DX_N8N_API_URL', type: 'string', default: 'http://n8n:5678', description: 'Fallback base URL for Stock n8n when the tenant has no active n8n_api connector in Vault.' },
    { name: 'DX_N8N_API_KEY', type: 'string', description: 'Fallback X-N8N-API-KEY secret used for REST v1 authentication.' },
    { name: 'N8N_ENCRYPTION_KEY', type: 'string', required: true, description: 'Internal credential encryption key for the n8nio/n8n:2.48.1 container.' },
    { name: 'N8N_RUNNERS_ENABLED', type: 'boolean', default: 'true', description: 'Enables isolated task runners inside the n8n runtime.' },
    { name: 'DX_VAULT_MASTER_KEY', type: 'string', description: 'Primary key material for AES-256-GCM Vault encryption (takes precedence over ENCRYPTION_FIELD_KEY, NOCOBASE_APP_KEY, and APP_KEY).' },
    { name: 'DX_ALLOW_INTERNAL_CONNECTORS', type: 'boolean', default: 'true', description: 'Allows connectors to target explicit internal Compose hostnames.' },
    { name: 'DX_INTERNAL_SERVICE_HOSTS', type: 'string', default: 'n8n,orion-ld,nodered,mosquitto', description: 'Comma-separated internal host allowlist exempted from private-IP SSRF blocking.' }
  ]"
/>

## Stock `n8n` REST v1 Bridge (`dxosN8n`)

The `dxosN8n` resource exposes 10 actions covering health checks, workflow lifecycle, execution inspection/retry, and credential synchronization against `/api/v1/*`. Every call passes through `requireN8nAdmin`: callers must hold `root`, `admin`, or `ldx_admin` (or `isOrgAdmin`) and present matching PAT scopes (`read`, `write`, or `ai`).

<ApiEndpoint
  method="GET"
  path="/api/dxosN8n:status"
  auth="Bearer JWT | ldx_pat_*"
  scope="read | write | ai"
  summary="Probes n8n /healthz and verifies X-N8N-API-KEY connectivity via GET /api/v1/workflows?limit=1."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosN8n:createWorkflow"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai"
  summary="Creates an n8n workflow via POST /api/v1/workflows with an automatically attached Idempotency-Key header."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosN8n:syncCredential"
  auth="Bearer JWT | ldx_pat_*"
  scope="write | ai"
  summary="Decrypts connector secrets or refreshes OAuth2 tokens from dxosVault, translates them to n8n credential schemas, and persists n8nCredentialId on latticeConnectors."
/>

All 10 `dxosN8n` actions map to the following upstream Stock `n8n` endpoints:

| `dxosN8n` Action | Method | Stock `n8n` REST v1 Endpoint | Responsibility |
| :--- | :--- | :--- | :--- |
| `status` | `GET` | `GET /healthz`, `GET /api/v1/workflows?limit=1` | Returns `ok`, `healthzOk`, `apiOk`, `hasApiKey`, and `latencyMs` |
| `appCatalog` | `GET` | — | Lists the 11 curated `APP_CONNECTOR_CATALOG` entries with per-tenant `configuredCount` |
| `workflows` | `GET` | `GET /api/v1/workflows` | Lists workflows filtered by `active`, `tags`, `name`, `limit` (`1..250`), and `cursor` |
| `getWorkflow` | `GET` | `GET /api/v1/workflows/:id` | Fetches full workflow node and connection JSON |
| `createWorkflow` | `POST` | `POST /api/v1/workflows` | Provisions a workflow with `Idempotency-Key` protection |
| `updateWorkflow` | `POST` | `PUT /api/v1/workflows/:id` | Replaces an existing workflow definition |
| `activateWorkflow` | `POST` | `POST /api/v1/workflows/:id/activate` or `/deactivate` | Activates or deactivates a workflow on `n8n` |
| `executions` | `GET` | `GET /api/v1/executions` | Lists execution history filtered by `workflowId`, `status`, `includeData`, `limit`, `cursor` |
| `retryExecution` | `POST` | `POST /api/v1/executions/:id/retry` | Retries a failed execution with optional `loadWorkflow` |
| `syncCredential` | `POST` | `POST /api/v1/credentials` | Pushes decrypted or OAuth2-refreshed Vault credentials to `n8n` and records `n8nCredentialId` |

Every mutating HTTP request (`POST`, `PUT`, `PATCH`, `DELETE`) attaches `Idempotency-Key` (`ldx-<uuid>` by default, or `ldx-cred-<orgId>-<connectorKey>-v<secretVersion>` during credential sync). Upstream errors pass through `scrubN8nSecrets` so API keys and credential fields are replaced with `[REDACTED]` before returning to callers.

<CodeTabs :tabs="n8nTabs" />

## Connector Vault (`dxosVault`) & Credential Mapping

Direct CRUD access to `latticeConnectors` is blocked by `registerConnectorVaultDirectGuard` (`403`). All secret storage and probes run through the 8 `dxosVault` actions: `list`, `save`, `rotateSecret`, `delete`, `testConnection`, `appCatalog`, `oauthStart`, and `oauthCallback`.

Secrets in `encryptedSecretsJson`, `oauthAccessTokenEnc`, and `oauthRefreshTokenEnc` are encrypted using **AES-256-GCM** (`iv:tag:cipher` hex) with a SHA-256 key derived from `DX_VAULT_MASTER_KEY` (falling back to `ENCRYPTION_FIELD_KEY`, `NOCOBASE_APP_KEY`, or `APP_KEY`). During `dxosN8n:syncCredential`, `buildCredentialPayloadFromConnector` maps each of the 11 catalog apps to its Stock `n8n` credential schema:

| `appType` in `APP_CONNECTOR_CATALOG` | Auth Types | Target `n8nCredentialType` | Mapped Secret Fields |
| :--- | :--- | :--- | :--- |
| `telegram` | `api_key`, `bearer` | `telegramApi` | `accessToken` (from `botToken` / `accessToken`) |
| `email_smtp` | `basic`, `none` | `smtp` | `user`, `password`, `host`, `port`, `secure` |
| `gmail_oauth2` | `oauth2` | `gmailOAuth2` | `clientId`, `clientSecret`, `oauthTokenData.access_token` |
| `google_sheets_oauth2` | `oauth2` | `googleSheetsOAuth2Api` | `clientId`, `clientSecret`, `oauthTokenData.access_token` |
| `slack` | `oauth2`, `bearer` | `slackOAuth2Api` | `accessToken`, `oauthTokenData.access_token` |
| `discord` | `bearer`, `none` | `discordWebhookApi` | `webhookUrl`, `botToken` |
| `teams` | `oauth2`, `bearer` | `microsoftTeamsOAuth2Api` | `accessToken`, `oauthTokenData.access_token` |
| `github` | `oauth2`, `bearer` | `githubOAuth2Api` | `accessToken`, `oauthTokenData.access_token` |
| `rustfs_s3` | `api_key`, `basic` | `s3` | `endpoint`, `region`, `accessKeyId`, `secretAccessKey` |
| `n8n_api` | `api_key`, `hmac`, `bearer` | `httpHeaderAuth` | `apiKey`, `webhookSecret` |
| `partner_webhook` | `hmac`, `bearer`, `api_key` | `httpHeaderAuth` | Header `name` (`Authorization` / `X-API-Key`) and `value` |

## OAuth2 PKCE `S256` Handshake & Single-Flight Refresh

For OAuth2-capable apps (`gmail_oauth2`, `google_sheets_oauth2`, `slack`, `teams`, `github`), `connector-vault.js` enforces **RFC 7636 PKCE (`S256`)** with a two-transaction handshake that avoids holding database locks across outbound HTTP calls:

| Step | Stage / Endpoint | Execution Behavior |
| :---: | :--- | :--- |
| `1` | Initiate (`POST /api/dxosVault:oauthStart`) | Generates a 32-byte `base64url` `codeVerifier`, derives `codeChallenge = SHA256(codeVerifier)` (`codeChallengeMethod: "S256"`), and issues a 24-byte hex `stateNonce` valid for `OAUTH_STATE_TTL_MS = 15 min`. The `_oauthPkce` metadata is AES-256-GCM encrypted inside `encryptedSecretsJson` and `authorizeUrl` is returned. |
| `2` | Consume Nonce in TX1 (`GET/POST /api/dxosVault:oauthCallback`) | Acquires a row-level lock (`SELECT ... FOR UPDATE`), verifies `state` via `timingSafeEqual`, checks the 15-minute TTL, strips `oauthStateNonce` and `_oauthPkce` from storage, and commits TX1 before any outbound network I/O. |
| `3` | Token Exchange Outside DB Transaction | Submits an `application/x-www-form-urlencoded` `POST` (`grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`, `client_id`) with `redirect: 'error'` and a `10,000 ms` abort timeout. |
| `4` | Persist Encrypted Tokens in TX2 | Encrypts `access_token` and `refresh_token` into `oauthAccessTokenEnc` and `oauthRefreshTokenEnc` alongside `oauthTokenExpiresAt`. |
| `5` | Single-Flight Refresh (`getFreshConnectorToken`) | Whenever `expiresAt - now <= 180s` (`OAUTH_REFRESH_BUFFER_SEC_DEFAULT`), concurrent callers for the same `(organizationId, connectorId)` share one in-flight promise stored in `dbInflightTokenRefresh` (`WeakMap`) so only a single refresh request reaches the OAuth2 provider. |

<ApiEndpoint
  method="POST"
  path="/api/dxosVault:oauthStart"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Issues a 15-minute stateNonce and PKCE S256 challenge for an OAuth2 connector and returns authorizeUrl."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosVault:oauthCallback"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Atomically consumes the one-time oauthStateNonce, exchanges the authorization code, and stores AES-256-GCM encrypted tokens."
/>

## Bidirectional Webhook & Event Sync (`dxosEvents` & `dxosAutomations`)

Synchronization between LatticeDX and Stock `n8n` operates bidirectionally with explicit signature verification on both boundaries:

- **Outbound (LatticeDX to `n8n`):** Domain events published via `dxosEvents:publish` (`alarm.triggered`, `device.offline`, `lot.held_mkt`) are queued in `latticeWebhookDeliveries` and delivered as CloudEvents `1.0` payloads with **Standard Webhooks** headers (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<b64>`, `ce-type`) to `n8n` Webhook Trigger nodes configured with `rawBody: true`. Reference workflows in `lattice-templates/n8n-workflows/` verify the HMAC-SHA256 signature and 300-second replay window before processing.
- **Inbound (`n8n` to LatticeDX):** Workflows in `n8n` invoke `/api/dxosAutomations:runNow` (authenticated with a least-privilege `ldx_pat_*` token) or `/api/dxosAutomations:webhookIngress` (verified with `X-Lattice-Signature-256` or Standard Webhooks headers) to trigger internal LatticeFlow v2 DAGs.

## SSRF Controls & Error Codes

Every connector URL and outbound `n8n` request undergoes synchronous `assertSafeConnectorUrl` and asynchronous DNS-resolving `assertSafeConnectorUrlAsync` validation. The guard rejects non-HTTP(S) schemes, embedded URL credentials (`user:pass@host`), loopback/private/link-local IPs, and cloud metadata endpoints (`169.254.*`, `fd00:ec2::254`), while permitting explicit `DX_INTERNAL_SERVICE_HOSTS` when `DX_ALLOW_INTERNAL_CONNECTORS=true`. Outbound `fetch()` calls always set `redirect: 'error'` with a `10,000 ms` timeout, mapping upstream `4xx` responses directly and `5xx`/network failures to `502 N8N_API_HTTP_ERROR` or `N8N_API_REQUEST_FAILED`.

Common error codes surfaced by `dxosN8n` and `dxosVault`:

| Error Code | HTTP | Cause and Remediation |
| :--- | :--- | :--- |
| `N8N_CONNECTOR_NOT_CONFIGURED` | `404` | Tenant has no active `n8n`/`n8n_api` connector and `DX_N8N_API_URL` is unset |
| `N8N_API_KEY_MISSING` | `400` | Missing `X-N8N-API-KEY` on both the Vault connector and environment fallback |
| `N8N_ADMIN_REQUIRED` | `403` | Caller lacks `root`, `admin`, or `ldx_admin` verified role membership |
| `N8N_API_HTTP_ERROR` | `4xx` / `502` | Upstream `n8n` returned an error status; secrets are redacted by `scrubN8nSecrets` |
| `CONNECTOR_URL_UNSAFE` | `400` | Target URL failed SSRF validation or contained embedded URL credentials |
| `OAUTH_STATE_MISMATCH` | `400` | `stateNonce` did not match or was already consumed in TX1 |
| `OAUTH_STATE_EXPIRED` | `400` | Delay between `oauthStart` and `oauthCallback` exceeded `15 minutes` |
| `OAUTH_REFRESH_TOKEN_MISSING` | `401` | Access token expired and `oauthRefreshTokenEnc` is absent on the connector |

## Related

- [Webhooks, HMAC Signing and Cron Schedules](/en/automation/webhooks-and-schedules)
- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [Scoped API Keys & Authentication](/en/reference/api-keys)
- [GitOps Solution Bundles](/en/studio/solution-bundles)
