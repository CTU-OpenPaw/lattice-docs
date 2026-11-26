---
title: Zero-Trust Security Model
description: Multi-layer security model in LatticeDX covering 5 isolated Docker networks, Caddy edge TLS, Nginx CSP/CORS/CSRF, APISIX JWT and rate limits, Keycloak OIDC PKCE, secret handling, and nocobase_app / lattice_app role separation.
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

# Zero-Trust Security Model

LatticeDX enforces defense-in-depth from the TLS perimeter down to PostgreSQL 16 row policies. Every inbound request traverses Caddy TLS termination, Apache APISIX or Nginx edge controls, Keycloak OIDC PKCE verification, and `FORCE ROW LEVEL SECURITY` executed under non-superuser database roles (`nocobase_app` and `lattice_app`).

<DeploymentStackDiagram />

## Five Isolated Docker Networks

In `infra/compose/prod.yml`, every container image is pinned to an immutable `@sha256` digest and segmented across five Docker networks. Four networks are marked `internal: true` so backend services cannot be reached from the host edge or initiate arbitrary outbound traffic:

| Docker Network | Mode | Attached Services | Isolation Boundary |
| :--- | :--- | :--- | :--- |
| `edge` | External bridge | `caddy`, `keycloak`, `gateway` (APISIX), `nocobase` | Terminates host ports `80` and `443` at Caddy; exposes no database, cache, or object storage sockets. |
| `app` | `internal: true` | `caddy`, `keycloak`, `gateway`, `nocobase`, `file-scanner`, `orion-ld`, `n8n`, `otel-collector`, `prometheus`, `grafana`, `gotenberg`, `nodered`, `redis` | Carries internal HTTP, OTLP telemetry, and Valkey traffic between the gateway, runtime, and observability plane. |
| `data` | `internal: true` | `postgres`, `nocobase-db`, `redis`, `rustfs`, `keycloak`, `file-scanner`, `orion-mongo`, `orion-ld`, `nocobase`, `n8n`, `otel-collector`, `prometheus`, `grafana` | Isolates both PostgreSQL 16 clusters, MongoDB 8, RustFS S3, and Valkey 8.1 from edge-facing containers. |
| `scanner` | `internal: true` | `clamav`, `file-scanner` | Restricts ClamAV `1.5.5` (`read_only` + `tmpfs`) behind the `file-scanner:4010` bridge. |
| `iiot-net` | `internal: true` | `mosquitto`, `nodered`, `nocobase` | Isolates the Eclipse Mosquitto `2.0.21` Dynamic Security MQTT broker and Node-RED `4.0.9` downlink flows. |

## Edge Layer: Caddy TLS, Apache APISIX, and Nginx CSP/CORS/CSRF

External requests pass through four edge enforcement layers before reaching NocoBase `2.2.50` application handlers:

| Layer | Component / Config | Enforcement Controls |
| :---: | :--- | :--- |
| `1` | Caddy `2.10` (`infra/config/caddy/Caddyfile`) | Provisions TLS for `LATTICE_DOMAIN`, `KEYCLOAK_DOMAIN`, and `N8N_DOMAIN`, strips the `Server` header (`-Server`), and attaches hardening headers (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`). Requests for `/api/*` and `/.well-known/agent-card.json` proxy to `gateway:9080`. |
| `2` | Apache APISIX `3.19.0` (`infra/config/apisix/apisix.prod.yaml`) | Injects `X-Request-Id`, enforces CORS against `LATTICE_ALLOWED_ORIGIN`, validates bearer JWTs via JWKS (`openid-connect` with `client_id: dx-gateway`, `bearer_only: true`, `use_jwks: true`, `ssl_verify: true`) on `/api/dxos-oidc*`, and applies Valkey-backed `limit-count` (`policy: redis`) across route tiers. |
| `3` | Nginx Public Routes and Per-Response Nonce CSP (`10-lattice-public-routes.sh`, `public-form-html.js`, `public-track-html.js`) | Nginx proxies `/v/form`, `/v/track`, `/v/mobile`, and `/.well-known/agent-card.json` with `Cache-Control: no-cache, no-store`. Public HTML handlers generate a fresh cryptographic nonce per response and enforce a strict Content Security Policy (`default-src 'none'; script-src 'nonce-<n>'; style-src 'nonce-<n>'; img-src data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'`). |
| `4` | Strict CORS and CSRF Binding (`observability.js`, `routes.js`) | When `DX_CORS_STRICT=true`, middleware strips all `Access-Control-Allow-*` response headers if the request `Origin` is outside `DX_CORS_ALLOWED_ORIGINS` or the verified host. During enterprise sign-in, the `ldx_enterprise_binding` cookie sets `httpOnly: true`, `sameSite: 'lax'`, `secure: true` (on HTTPS), and `path: '/api'`, while `POST /api/enterpriseAuth:finish` rejects requests whose `Origin` header differs from `DX_NATIVE_AUTH_ORIGIN` or whose `Content-Type` is not `application/json`. |

### APISIX Route Tiers and Rate Limits

| Route ID | URI Group | Gateway Enforcement | Rate Limit (`limit-count`) | Upstream Timeout |
| :--- | :--- | :--- | :--- | :--- |
| `dxos-public-paas` | `/.well-known/agent-card.json`, `/api/dxos:openapi`, `/api/dxosWms:publicTrack`, `/api/dxosForms:*` | Public / form access token | `120` req / `60s` (`remote_addr`) | Default |
| `dxos-enterprise-auth` | `/api/enterpriseAuth:start`, `:callback`, `:finish`, `:backchannelLogout` | PKCE `S256` / `logout_token` | `120` req / `60s` (`remote_addr`) | Default |
| `dxos-oidc-bridge` | `/api/dxos-oidc`, `/api/dxos-oidc/*` | `openid-connect` JWKS (`dx-gateway`) | `120` req / `60s` (`remote_addr`) | Default |
| `dxos-mcp` | `/api/dxos-mcp`, `/api/dxos-mcp/*` | Bearer JWT / `ldx_pat_*` | `120` req / `60s` (`remote_addr`) | `600s` send/read |
| `dxos-telemetry-ingest` | `/api/dxosBlocks:telemetryIngest`, `:alarmIngest`, `/api/dxosBroker:deviceStatusIngest`, `:orionNotify` | `X-Lattice-Edge-Token` | `300` req / `60s` (`remote_addr`) | Default |
| `dxos-core-api` | `/api/*` (priority `10`) | Bearer JWT / `ldx_pat_*` | `240` req / `60s` (`remote_addr`) | `600s` send/read |

<ApiEndpoint
  method="GET"
  path="/api/enterpriseAuth:start"
  auth="Public (PKCE S256)"
  summary="Generates code_verifier and S256 code_challenge, caches state in Valkey DB 2 (300s TTL), and sets the HttpOnly ldx_enterprise_binding cookie."
/>

<ApiEndpoint
  method="POST"
  path="/api/enterpriseAuth:finish"
  auth="Same-Origin + HttpOnly Cookie"
  summary="Verifies Origin, matches the single-use ticket (60s TTL) against the binding cookie via timingSafeEqual, and issues a session."
/>

<ApiEndpoint
  method="POST"
  path="/api/enterpriseAuth:backchannelLogout"
  auth="Keycloak Logout Token"
  summary="Validates the signed Keycloak logout_token JWT and writes revoked:/revoked_sid: keys (24h TTL) to Valkey DB 2."
/>

## Keycloak OIDC/PKCE and RBAC Role Boundaries

The `lattice` realm in `infra/config/keycloak/lattice-realm.prod.json` enables `bruteForceProtected: true` (locking accounts after `5` failed logins), enforces TOTP MFA, and requires a minimum `12`-character password. The public browser client `dx-native` restricts flows to Authorization Code with PKCE `S256` (`directAccessGrantsEnabled: false`), separate from the confidential gateway client `dx-gateway` used by APISIX.

To prevent identity-provider group claims from granting administrative access, `syncMappedUserRoles` in `plugins/nocobase/plugin-enterprise-auth/src/server/policy.js` accepts only role names matching `^ldx_[a-z][a-z0-9_]{1,40}$` and skips privileged roles (`ldx_admin`, `allowConfigure: true`, or roles containing `pm.*` snippets). On every authenticated request, `createRevocationGuard` checks `revoked:<userId>` and `revoked_sid:<sid>` in Valkey DB 2 to terminate revoked sessions immediately after back-channel logout or `enterpriseAuth:unlink`.

Within the application layer (`native-roles.js` and `portal-roles.js`), eight native `ldx_*` roles partition operational permissions separately from host administrative roles (`root`, `admin`, `anonymous`, `member`):

| Role Tier | Identifiers | Scope of Authorization |
| :--- | :--- | :--- |
| Frontline Operations | `ldx_employee`, `ldx_operator`, `ldx_driver` | Create business requests, execute assigned workflow tasks, scan QR codes, and submit offline ePOD captures. |
| Warehouse and Dispatch | `ldx_warehouse`, `ldx_dispatcher` | Allocate and issue FEFO stock lots, enforce MKT holds or QA releases, and dispatch cold-chain shipments. |
| Management and Executive | `ldx_manager`, `ldx_director` | Decide M-of-N approval requests, review BI dashboards, and triage or escalate IoT incident cases. |
| Tenant Administration | `ldx_admin` | Configure organization portals, dynamic collections, and directory bindings; excluded from automatic SSO group mapping. |

<CodeTabs :tabs="securityTabs" />

### ClamAV Attachment Scanning Boundary

Every attachment uploaded to `latticeRequests` (`POST /api/latticeRequestAttachments:upload`) must pass synchronous scanning on the isolated `scanner` network before database persistence. The `zINSTREAM` client streams payloads up to `1 MiB` to `clamd` on port `3310` (`DX_NATIVE_CLAMD_HOST`) with a `15`-second socket timeout (`native-request-attachments.js`). When the scanner is unreachable, uploads fail closed with HTTP `503`, and detected signatures (`stream: ... FOUND`) return HTTP `409` without writing to `lattice_native_request_attachments`.

## Secret Handling, Encryption, and PII Redaction

Credentials, cryptographic signing keys, and API tokens follow zero-cleartext persistence rules across the platform:

| Mechanism | Component | Cryptographic / Validation Controls |
| :--- | :--- | :--- |
| Connector Vault (`dxosVault`) | `connector-vault.js`, `latticeConnectors` | Encrypts credentials with `AES-256-GCM` (`iv:tag:cipher` hex) using a SHA-256 key derived from `DX_VAULT_MASTER_KEY \|\| ENCRYPTION_FIELD_KEY \|\| NOCOBASE_APP_KEY \|\| APP_KEY`; enforces `assertSafeConnectorUrlAsync` (`redirect: 'error'`) against SSRF. |
| Ed25519 Key Wrapping | `pki-ledger.js`, `latticePkiKeys` | Wraps per-organization Ed25519 signing keys with `AES-256-GCM` derived from `NOCOBASE_ENCRYPTION_FIELD_KEY \|\| NOCOBASE_APP_KEY`. |
| Scoped API Keys (`ldx_pat_*`) | `paas-api-keys.js`, `latticeApiKeys` | Displays `ldx_pat_<8hex>_<32hex>` once on creation, stores SHA-256 `keyHash`, verifies via `timingSafeEqualHex`, enforces 7 scopes (`read`, `write`, `wms`, `dmn`, `iot`, `ai`, `ledger`), and clamps `X-Role` via `clampHeaderRole`. |
| PII Redaction and Bundle Scrubbing | `ai-governance.js`, `otel-exporter.js`, `solution-bundle.js` | `redactPiiText` masks 9 patterns (JWTs, Bearer tokens, `sk-...` keys, emails, IBANs, national IDs, Vietnamese phone numbers, tax IDs) prior to audit logging or OTLP export; bundle imports strip `SECRET_KEY_RE` keys. |

<ApiEndpoint
  method="POST"
  path="/api/dxosVault:rotateSecret"
  auth="Bearer JWT | ldx_pat_*"
  scope="write (admin)"
  summary="Rotates and re-encrypts stored connector credentials under AES-256-GCM without exposing prior secret material."
/>

## Database Role Separation (`nocobase_app` and `lattice_app`)

Bootstrap scripts `infra/config/postgres/init-nocobase-db.sh` and `init-prod.sh` isolate runtime applications from PostgreSQL superuser credentials. Both `nocobase_app` (owning `nocobase`) and `lattice_app`, `keycloak_app`, `n8n_app` (owning `lattice`, `keycloak`, and `n8n`) are created with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`, with all `PUBLIC` privileges revoked on databases and `public` schemas.

Because `init-nocobase-db.sh` aborts if `NOCOBASE_APP_DB_USER` matches `POSTGRES_USER`, runtime queries executed by NocoBase `2.2.50` always honor `NOBYPASSRLS` and cannot circumvent `FORCE ROW LEVEL SECURITY` on any of the 56 static tables or dynamic `latticeCustom*` tables. On the core cluster, `init-prod.sh` isolates `lattice_app`, `keycloak_app`, and `n8n_app` into separate databases so identity tables and external workflow state never share credentials with the platform database.

| PostgreSQL Role | Owned Database | Privilege Flags | Connected Service |
| :--- | :--- | :--- | :--- |
| `nocobase_app` | `nocobase` (`pgvector`) | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | NocoBase `2.2.50` and 7 LatticeDX plugins |
| `lattice_app` | `lattice` | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | Core API and file storage |
| `keycloak_app` | `keycloak` | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | Keycloak `26.8.2` IAM |
| `n8n_app` | `n8n` | `NOSUPERUSER NOBYPASSRLS NOINHERIT` | Optional `n8n` service (`n8n` profile) |

<ParamGrid
  title="Core Security Environment Variables (prod.env.example)"
  :items="[
    { name: 'NOCOBASE_APP_DB_USER', type: 'string', required: true, default: 'nocobase_app', description: 'Non-superuser PostgreSQL runtime role with NOBYPASSRLS so FORCE RLS stays enforced.' },
    { name: 'NOCOBASE_ENCRYPTION_FIELD_KEY', type: 'secret (32B)', required: true, description: 'AES-256-GCM key wrapping Ed25519 private keys and encrypted connector vault secrets.' },
    { name: 'DX_CORS_STRICT', type: 'boolean', default: 'true', description: 'Strips CORS headers whenever the request Origin is outside DX_CORS_ALLOWED_ORIGINS or the verified host.' },
    { name: 'DX_NATIVE_AUTH_CLIENT_ID', type: 'string', default: 'dx-native', description: 'Public Keycloak OIDC client configured with mandatory PKCE S256.' },
    { name: 'DX_ALLOW_INTERNAL_CONNECTORS', type: 'boolean', default: 'false', description: 'Blocks connector calls to private and loopback IP ranges by default to prevent SSRF.' }
  ]"
/>

## Related

- [Multi-Tenancy and PostgreSQL 16 FORCE RLS](/en/architecture/multi-tenancy-rls)
- [Production Deployment](/en/getting-started/production-deployment)
- [Scoped API Keys](/en/reference/api-keys)
- [PKI and Merkle Ledger](/en/reference/pki-merkle-ledger)
