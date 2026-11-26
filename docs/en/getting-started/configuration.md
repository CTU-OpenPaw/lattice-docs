---
title: Environment & Runtime Configuration
description: Complete catalog of LatticeDX environment variables grouped by subsystem, cryptographic key hierarchy, SSRF guards, and runtime verification endpoints.
---

# Environment and Runtime Configuration

LatticeDX separates local development defaults (`.env.example`, `.env.agent`, `.env.integration`) from hardened production configuration (`infra/compose/prod.env.example` paired with `infra/compose/prod.yml`). Every secret in `prod.yml` uses mandatory Docker Compose interpolation syntax `${VAR:?Set VAR}` so the stack refuses to start if any required credential is missing.

::: warning Keep Secret Files Outside Git
Store production variables in an untracked `.env.prod` file with `chmod 600` permissions, and keep local LLM or integration overrides in untracked `.env.agent` and `.env.integration` files. Never place provider credentials or cryptographic secrets into `NEXT_PUBLIC_*` variables or browser plugin bundles.
:::

## 1. Environment Separation and Key Generation

Local development commands (`pnpm dev`, `pnpm local:up`) read from your active shell environment or an untracked root `.env` file. For production deployments driven by `infra/compose/prod.yml`, copy `infra/compose/prod.env.example` to `.env.prod` outside version control and replace every `CHANGE_ME_*` placeholder with high-entropy random values.

<CodeTabs
  :tabs="[
    {
      label: 'Generate keys & prepare .env.prod',
      lang: 'bash',
      code: 'cp infra/compose/prod.env.example .env.prod\nchmod 600 .env.prod\n\n# Generate 64-hex (32-byte) secrets for APP_KEY, ENCRYPTION_FIELD_KEY, and DX_VAULT_MASTER_KEY\nopenssl rand -hex 32\nopenssl rand -hex 32\nopenssl rand -hex 32\n\n# Generate 32-hex (16-byte) secrets for IIoT ingest and Node-RED credentials\nopenssl rand -hex 16'
    },
    {
      label: 'Validate Compose interpolation',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml config --quiet'
    }
  ]"
/>

---

## 2. Edge, Gateway, Domains, and CORS

These variables control TLS termination in Caddy `2.10`, CORS and Redis-backed rate limiting in Apache APISIX `3.19.0`, and origin validation inside NocoBase and Fastify middleware.

<ParamGrid
  title="Edge, Gateway, Domains, and CORS Variables"
  :items="[
    { name: 'LATTICE_DOMAIN', type: 'string', required: true, default: 'app.example.com', description: 'Primary public FQDN served by Caddy for LatticeDX portals and /api/* routing.' },
    { name: 'KEYCLOAK_DOMAIN', type: 'string', required: true, default: 'auth.example.com', description: 'Public FQDN for Keycloak 26.8.2 used by KC_HOSTNAME and browser OIDC redirects.' },
    { name: 'N8N_DOMAIN', type: 'string', required: true, default: 'n8n.example.com', description: 'Public FQDN for Stock n8n when --profile n8n is enabled.' },
    { name: 'LATTICE_ALLOWED_ORIGIN', type: 'string', required: false, default: 'https://${LATTICE_DOMAIN}', description: 'Allowed origin enforced globally by the Apache APISIX cors plugin.' },
    { name: 'DX_CORS_ALLOWED_ORIGINS', type: 'string', required: false, default: 'http://localhost:8080,http://127.0.0.1:8080', description: 'Comma-separated origin allowlist for NocoBase and Fastify API CORS middleware.' },
    { name: 'DX_CORS_STRICT', type: 'boolean', required: false, default: 'true', description: 'Rejects requests carrying an Origin header outside the allowed origin list.' },
    { name: 'DX_TRUST_PROXY', type: 'boolean', required: false, default: 'true (prod)', description: 'Trusts forwarded client IP headers from reverse proxies for public form rate limiting.' },
    { name: 'APISIX_PORT', type: 'number', required: false, default: '8080', description: 'Host loopback port bound by APISIX in local development stacks.' },
    { name: 'CADDY_HTTP_PORT', type: 'number', required: false, default: '80', description: 'HTTP listener port on Caddy for ACME challenges and HTTPS redirects.' },
    { name: 'CADDY_HTTPS_PORT', type: 'number', required: false, default: '443', description: 'HTTPS TCP/UDP (HTTP/3) listener port on Caddy for production traffic.' }
  ]"
/>

---

## 3. PostgreSQL 16, Multi-Tenancy RLS, PITR, and Valkey 8.1

LatticeDX isolates core platform metadata (`postgres`) from application and vector data (`nocobase-db` running `pgvector/pgvector:0.8.1-pg16`). In `nocobase-db`, the `nocobase` container connects as `nocobase_app`, a non-superuser role configured with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS` that must differ from `NOCOBASE_DB_USER` so PostgreSQL enforces `FORCE ROW LEVEL SECURITY` across all 56 static tables and dynamic `latticeCustom*` tables.

<ParamGrid
  title="PostgreSQL 16 and Multi-Tenancy RLS Variables"
  :items="[
    { name: 'POSTGRES_PASSWORD', type: 'secret', required: true, default: 'local-demo-password', description: 'Postgres password for local core.yml development. Never reuse outside loopback.' },
    { name: 'POSTGRES_SUPERUSER', type: 'string', required: true, default: 'postgres', description: 'Superuser account on the core postgres container for role provisioning and PITR.' },
    { name: 'POSTGRES_SUPERUSER_PASSWORD', type: 'secret', required: true, description: 'Password for POSTGRES_SUPERUSER on the production postgres container.' },
    { name: 'LATTICE_DB_PASSWORD', type: 'secret', required: true, description: 'Password for non-superuser role lattice_app owning the lattice database.' },
    { name: 'KEYCLOAK_DB_PASSWORD', type: 'secret', required: true, description: 'Password for non-superuser role keycloak_app owning the keycloak database.' },
    { name: 'N8N_DB_PASSWORD', type: 'secret', required: true, description: 'Password for non-superuser role n8n_app owning the n8n database.' },
    { name: 'NOCOBASE_DB_USER', type: 'string', required: true, default: 'nocobase', description: 'Bootstrap admin user for nocobase-db migrations and pgvector initialization.' },
    { name: 'NOCOBASE_DB_PASSWORD', type: 'secret', required: true, description: 'Password for NOCOBASE_DB_USER.' },
    { name: 'NOCOBASE_APP_DB_USER', type: 'string', required: true, default: 'nocobase_app', description: 'Non-superuser, NOBYPASSRLS runtime role used by nocobase; must differ from NOCOBASE_DB_USER.' },
    { name: 'NOCOBASE_APP_DB_PASSWORD', type: 'secret', required: true, description: 'Password for NOCOBASE_APP_DB_USER.' },
    { name: 'DX_PG_RLS_SESSION', type: 'boolean', required: false, default: 'true', description: 'Activates the AsyncLocalStorage transaction bridge binding app.current_org and app.rls_bypass.' },
    { name: 'DATABASE_POOL_MAX', type: 'number', required: false, default: '20', description: 'Maximum PostgreSQL connection pool size for the Fastify API service.' },
    { name: 'DX_DEFAULT_ORG_ID', type: 'string', required: false, default: '1', description: 'Default organization ID fallback for single-org background workers.' }
  ]"
/>

<ParamGrid
  title="Cryptographic Keys, PITR WAL, and Valkey 8.1 Variables"
  :items="[
    { name: 'NOCOBASE_APP_KEY', type: 'secret', required: true, description: 'Signing secret mapped to APP_KEY for session JWTs; also acts as final fallback for PKI/Vault.' },
    { name: 'NOCOBASE_ENCRYPTION_FIELD_KEY', type: 'secret', required: true, description: 'Field encryption secret mapped to ENCRYPTION_FIELD_KEY and AES-256-GCM wrapping of Ed25519 keys.' },
    { name: 'DX_VAULT_MASTER_KEY', type: 'secret', required: false, description: 'Dedicated AES-256-GCM master key for Connector Vault (takes precedence over ENCRYPTION_FIELD_KEY and APP_KEY).' },
    { name: 'LATTICE_TRACK_VERIFY_SECRET', type: 'secret', required: false, description: 'Dedicated HMAC-SHA256 key for verifying public ePOD QR proofs (/v/track/:code).' },
    { name: 'PG_ARCHIVE_COMMAND', type: 'string', required: false, default: '/bin/sh /etc/postgresql/pitr-archive.sh %p %f', description: 'PostgreSQL archive_command archiving compressed WAL segments for Point-in-Time Recovery.' },
    { name: 'PITR_WAL_DIR', type: 'string', required: false, default: '/var/lib/postgresql/wal-archive', description: 'Target directory for gzipped WAL segments (0700 directory permissions, umask 077).' },
    { name: 'PITR_WAL_RETENTION_DAYS', type: 'number', required: false, default: '7', description: 'Retention window in days before pitr-archive.sh prunes older local .gz WAL files.' },
    { name: 'WALG_S3_PREFIX', type: 'string', required: false, description: 'Optional remote S3 prefix (s3://bucket/path) triggering wal-g wal-push when wal-g is available.' },
    { name: 'REDIS_PASSWORD', type: 'secret', required: true, description: 'Authentication password for Valkey 8.1 across cache, Pub/Sub, OIDC state, and APISIX rate limits.' },
    { name: 'CACHE_DEFAULT_STORE', type: 'string', required: false, default: 'redis', description: 'Application cache backend adapter for NocoBase.' },
    { name: 'CACHE_REDIS_URL', type: 'string', required: false, default: 'redis://:${REDIS_PASSWORD}@redis:6379/0', description: 'Valkey logical DB 0 URL for application caching.' },
    { name: 'PUBSUB_ADAPTER', type: 'string', required: false, default: 'redis', description: 'Pub/Sub transport adapter for cross-worker event fan-out.' },
    { name: 'PUBSUB_ADAPTER_REDIS_URL', type: 'string', required: false, default: 'redis://:${REDIS_PASSWORD}@redis:6379/1', description: 'Valkey logical DB 1 URL hosting latticedx:surface-updates for real-time SSE.' }
  ]"
/>

::: danger Fail-Closed Cryptographic Key Enforcement
Under `NODE_ENV=production`, cryptographic subsystems reject development fallbacks:
- `pki-ledger.js` requires either `ENCRYPTION_FIELD_KEY` or `APP_KEY`; omitting both throws `PKI_MASTER_KEY_MISSING` (HTTP 500).
- `connector-vault.js` resolves `DX_VAULT_MASTER_KEY || ENCRYPTION_FIELD_KEY || NOCOBASE_APP_KEY || APP_KEY`; omitting all throws `VAULT_MASTER_KEY_MISSING` (HTTP 500).
Set a dedicated `DX_VAULT_MASTER_KEY` in production so Connector Vault key rotation remains independent from Ed25519 private key wrapping in `latticePkiKeys`.
:::

---

## 4. Keycloak OIDC, Enterprise Auth, and Action Bridge

`@latticedx/plugin-enterprise-auth` implements a 4-step OIDC PKCE `S256` flow (`start` -> `callback` -> `finish` -> `backchannelLogout`), storing short-lived `state:` (`300s`), `ticket:` (`60s`), and `revoked:` (`24h`) keys in Valkey DB 2 while blocking privilege escalation during group-to-role mapping.

<ParamGrid
  title="Keycloak 26.8.2, OIDC PKCE, and Action Bridge Variables"
  :items="[
    { name: 'KEYCLOAK_ADMIN_USER', type: 'string', required: true, default: 'kc-admin', description: 'Bootstrap admin username for Keycloak.' },
    { name: 'KEYCLOAK_ADMIN_PASSWORD', type: 'secret', required: true, description: 'Bootstrap admin password for Keycloak.' },
    { name: 'APISIX_OIDC_CLIENT_SECRET', type: 'secret', required: true, description: 'Client secret for dx-gateway used by APISIX openid-connect and keycloak-config-cli.' },
    { name: 'APISIX_OIDC_DISCOVERY', type: 'string', required: false, default: 'https://${KEYCLOAK_DOMAIN}/realms/lattice/.well-known/openid-configuration', description: 'OIDC discovery endpoint used by APISIX to fetch JWKS signing keys.' },
    { name: 'DX_NATIVE_AUTH_ISSUER', type: 'string', required: true, default: 'https://${KEYCLOAK_DOMAIN}/realms/lattice', description: 'Public OIDC issuer URL used for browser authorization redirects.' },
    { name: 'DX_NATIVE_AUTH_INTERNAL_ISSUER', type: 'string', required: true, default: 'http://keycloak:8080/realms/lattice', description: 'Internal Docker app-network OIDC issuer URL for server-to-Keycloak token exchange.' },
    { name: 'DX_NATIVE_AUTH_ORIGIN', type: 'string', required: true, default: 'https://${LATTICE_DOMAIN}', description: 'Origin used to construct the OIDC redirect callback URI.' },
    { name: 'DX_NATIVE_AUTH_CLIENT_ID', type: 'string', required: false, default: 'dx-native', description: 'Public PKCE S256 client identifier configured in the lattice realm.' },
    { name: 'DX_NATIVE_AUTH_CACHE_STORE', type: 'string', required: false, default: 'redis', description: 'Session and PKCE state store backend for enterprise authentication.' },
    { name: 'DX_NATIVE_AUTH_SESSION_REDIS_URL', type: 'string', required: false, default: 'redis://:${REDIS_PASSWORD}@redis:6379/2', description: 'Valkey logical DB 2 URL storing PKCE state, one-time tickets, and backchannel revocations.' },
    { name: 'DX_NATIVE_AUTH_GROUP_ROLE_MAP', type: 'json', required: false, description: 'JSON map from Keycloak groups to NocoBase roles (automatically skips ldx_admin, allowConfigure, and pm* roles).' },
    { name: 'DX_ALLOW_PUBLIC_SIGNUP', type: 'boolean', required: false, default: 'false', description: 'Controls public self-registration endpoints (disabled by default).' },
    { name: 'DX_ENTERPRISE_DISABLE_SIGNUP', type: 'boolean', required: false, default: 'true', description: 'Strictly disables local signup routes when enterprise SSO is enforced.' },
    { name: 'DX_BRIDGE_ISSUER', type: 'string', required: false, description: 'Public OIDC issuer URL for @latticedx/plugin-action-bridge.' },
    { name: 'DX_BRIDGE_INTERNAL_ISSUER', type: 'string', required: false, description: 'Internal OIDC issuer URL for @latticedx/plugin-action-bridge.' },
    { name: 'DX_BRIDGE_GATEWAY_URL', type: 'string', required: false, default: 'http://gateway:9080', description: 'Internal APISIX gateway URL targeted by action-bridge.' },
    { name: 'DX_BRIDGE_CALLBACK_URL', type: 'string', required: false, description: 'Callback URL registered for action-bridge (/api/dxActions:callback).' },
    { name: 'NOCOBASE_INTERNAL_URL', type: 'string', required: false, default: 'http://127.0.0.1', description: 'Internal loopback URL used by plugins invoking host NocoBase endpoints.' }
  ]"
/>

---

## 5. Core API, RustFS Object Storage, and ClamAV Scanner

Uploaded attachments pass through `@dx/file-scanner` (running with `read_only: true`) over the isolated `scanner` network to ClamAV `1.5.5` before objects are persisted to RustFS `1.0.6` on the `data` network.

<ParamGrid
  title="Core API, File Scanner, ClamAV, and RustFS S3 Variables"
  :items="[
    { name: 'API_PORT', type: 'number', required: false, default: '4000', description: 'Local HTTP port for the @dx/api Fastify service.' },
    { name: 'WORKER_PORT', type: 'number', required: false, default: '4001', description: 'Local HTTP port for @dx/agent-worker.' },
    { name: 'API_URL', type: 'string', required: false, default: 'http://api:4000', description: 'Internal base URL for @dx/api.' },
    { name: 'WORKER_URL', type: 'string', required: false, default: 'http://worker:4001', description: 'Internal base URL for @dx/agent-worker.' },
    { name: 'API_RATE_LIMIT_MAX', type: 'number', required: false, default: '1000', description: 'Fastify per-window request rate limit ceiling.' },
    { name: 'FILE_STORAGE_PROVIDER', type: 'enum', required: false, default: 's3 (prod) / postgres (local)', description: 'Object storage backend: s3 (RustFS) or postgres (local file storage).' },
    { name: 'FILE_STORAGE_ROOT', type: 'string', required: false, default: '/var/lib/latticedx/objects', description: 'Filesystem root path when using local object storage.' },
    { name: 'RUSTFS_ACCESS_KEY', type: 'secret', required: true, description: 'Internal S3 access key for rustfs (mapped to S3_ACCESS_KEY_ID).' },
    { name: 'RUSTFS_SECRET_KEY', type: 'secret', required: true, description: 'Internal S3 secret key for rustfs (mapped to S3_SECRET_ACCESS_KEY).' },
    { name: 'DX_NATIVE_FILES_URL', type: 'string', required: false, default: 'http://file-scanner:4010', description: 'Internal scanner URL on the app network.' },
    { name: 'DX_NATIVE_FILES_INSTANCE', type: 'string', required: true, default: 'latticedx-prod', description: 'Instance identifier shared between nocobase and file-scanner.' },
    { name: 'DX_NATIVE_FILES_SECRET', type: 'secret', required: true, description: 'Shared secret authenticating upload and scan requests to file-scanner.' },
    { name: 'DX_NATIVE_CLAMD_HOST', type: 'string', required: false, default: 'clamav', description: 'Hostname of the ClamAV daemon on the isolated scanner network.' },
    { name: 'DX_NATIVE_ATTACHMENT_SUBMIT_ORGANIZATION', type: 'string', required: false, description: 'Optional fallback organization assigned when native attachments omit an explicit org.' },
    { name: 'DX_UPLOAD_STALE_PENDING_MS', type: 'number', required: false, default: '900000', description: 'Threshold in milliseconds before pending upload sessions are marked stale.' }
  ]"
/>

---

## 6. IIoT, Orion-LD, n8n, AI Studio, P.A.R.A. RAG, and Observability

Optional profiles and subsystem controls govern NGSI-LD outbox delivery, Mosquitto Dynamic Security, Node-RED 2-way downlinks, Stock `n8n` REST v1 integration, P.A.R.A. OCR/vector search, AI quotas, and OpenTelemetry / Prometheus / Grafana exports.

<ParamGrid
  title="IIoT, FIWARE Orion-LD, n8n, and Outbox Variables"
  :items="[
    { name: 'ORION_MONGO_USER', type: 'string', required: true, default: 'orion_root', description: 'Root username for MongoDB 8.0 backing FIWARE Orion-LD.' },
    { name: 'ORION_MONGO_PASSWORD', type: 'secret', required: true, description: 'Password for SCRAM-SHA-256 authentication on orion-mongo.' },
    { name: 'ORION_MONGO_VOLUME', type: 'string', required: false, description: 'Optional Docker volume override for recovered orion-mongo-data.' },
    { name: 'DX_NATIVE_CONTEXT_BROKER_URL', type: 'string', required: false, default: 'http://orion-ld:1026', description: 'Internal Orion-LD Context Broker base URL.' },
    { name: 'DX_NATIVE_CONTEXT_AUTO_SYNC', type: 'boolean', required: false, default: 'true', description: 'Runs the 10-second latticeContextOutbox drainer syncing NGSI-LD entities.' },
    { name: 'DX_OUTBOX_MAX_ATTEMPTS', type: 'number', required: false, default: '5', description: 'Maximum retry attempts before outbox or event-bus rows move to failed or DLQ.' },
    { name: 'DX_OUTBOX_STALE_LOCK_MS', type: 'number', required: false, default: '120000', description: 'Lock expiration window in milliseconds before stale outbox locks are reclaimed.' },
    { name: 'DX_EVENT_BUS_DRAINER', type: 'boolean', required: false, default: 'true', description: 'Enables the 10-second CloudEvents 1.0 webhook delivery drainer.' },
    { name: 'DX_FLOW_DELAY_TICK_MS', type: 'number', required: false, default: '15000', description: 'Polling interval in milliseconds for LatticeFlow v2 control.delay and cron schedules.' },
    { name: 'DX_SLA_CRON_ENABLED', type: 'boolean', required: false, default: 'true', description: 'Enables background SLA breach detection and escalation.' },
    { name: 'DX_SLA_INTERVAL_MS', type: 'number', required: false, default: '60000', description: 'Minimum interval in milliseconds between SLA evaluation sweeps.' },
    { name: 'MQTT_ADMIN_USER', type: 'string', required: false, default: 'ldx_mqtt_admin', description: 'Mosquitto 2.0.21 Dynamic Security admin username (--profile iiot).' },
    { name: 'MQTT_ADMIN_PASSWORD', type: 'secret', required: false, description: 'Password for MQTT_ADMIN_USER.' },
    { name: 'MQTT_BRIDGE_USER', type: 'string', required: false, default: 'nodered_bridge', description: 'Restricted MQTT username injected into Node-RED flows_cred.json.' },
    { name: 'MQTT_BRIDGE_PASSWORD', type: 'secret', required: false, description: 'Password for MQTT_BRIDGE_USER.' },
    { name: 'DX_MQTT_BROKER_HOST', type: 'string', required: false, default: 'mosquitto', description: 'Internal MQTT broker hostname on iiot-net.' },
    { name: 'DX_MQTT_BROKER_PORT', type: 'number', required: false, default: '1883', description: 'Internal MQTT broker port.' },
    { name: 'DX_NODERED_COMMAND_URL', type: 'string', required: false, default: 'http://nodered:1880/twin/command', description: 'Node-RED HTTP downlink endpoint for Digital Twin setpoint commands.' },
    { name: 'DX_IIOT_INGEST_TOKEN', type: 'secret', required: false, description: 'Bearer token authenticating Node-RED telemetry and alarm ingest calls.' },
    { name: 'NODERED_CREDENTIAL_SECRET', type: 'secret', required: false, description: 'AES-256-CTR secret encrypting /data/flows_cred.json inside Node-RED.' },
    { name: 'NODERED_ADMIN_USER', type: 'string', required: false, default: 'nodered_admin', description: 'Admin UI username for Node-RED 4.0.9.' },
    { name: 'NODERED_ADMIN_PASS_HASH', type: 'secret', required: false, description: 'Bcrypt password hash for Node-RED admin UI authentication.' },
    { name: 'DX_ORION_HOST_ALLOWLIST', type: 'string', required: false, description: 'SSRF host allowlist for outbound Orion-LD broker calls.' },
    { name: 'DX_ORION_CALLBACK_HOST_ALLOWLIST', type: 'string', required: false, description: 'Allowlist of callback hostnames permitted in Orion-LD subscriptions.' },
    { name: 'DX_NODERED_HOST_ALLOWLIST', type: 'string', required: false, description: 'SSRF host allowlist for Digital Twin Node-RED downlink targets.' },
    { name: 'N8N_ENCRYPTION_KEY', type: 'secret', required: false, description: 'Credential encryption key for Stock n8n (--profile n8n).' },
    { name: 'N8N_URL', type: 'string', required: false, default: 'http://n8n:5678', description: 'Internal base URL for Stock n8n.' },
    { name: 'N8N_WEBHOOK_BASE_URL', type: 'string', required: false, default: 'http://n8n:5678/webhook', description: 'Internal webhook base URL for Stock n8n.' },
    { name: 'DX_N8N_API_URL', type: 'string', required: false, default: 'http://n8n:5678/api/v1', description: 'n8n REST API v1 URL queried by plugin-dxos-studio.' },
    { name: 'DX_N8N_API_KEY', type: 'secret', required: false, description: 'Fallback X-N8N-API-KEY when credentials are not stored in Connector Vault.' },
    { name: 'DX_ALLOW_INTERNAL_CONNECTORS', type: 'boolean', required: false, default: 'false (true in prod.yml)', description: 'Permits Connector Vault to reach explicitly allowlisted internal Docker service hosts.' },
    { name: 'DX_INTERNAL_SERVICE_HOSTS', type: 'string', required: false, default: 'n8n,orion-ld,nodered,mosquitto', description: 'Comma-separated internal hostnames exempted from private-IP SSRF blocking.' },
    { name: 'DX_CONNECTOR_INTERNAL_ALLOWLIST', type: 'string', required: false, description: 'Additional internal connector host allowlist entries.' },
    { name: 'WORKFLOW_EVENT_URL', type: 'string', required: false, description: 'Optional fixed webhook destination for @dx/api outbox rows.' },
    { name: 'WORKFLOW_EVENT_TOKEN', type: 'secret', required: false, description: 'Bearer token sent to WORKFLOW_EVENT_URL.' }
  ]"
/>

<ParamGrid
  title="AI Studio, P.A.R.A. Knowledge RAG, PDF, and Observability Variables"
  :items="[
    { name: 'AGENT_PROVIDER', type: 'string', required: false, default: 'openai-compatible', description: 'Default LLM provider adapter for AI services and CLI workers.' },
    { name: 'AGENT_BASE_URL', type: 'string', required: false, default: 'http://localhost:20128/v1', description: 'OpenAI-compatible base URL for the LLM gateway.' },
    { name: 'AGENT_API_KEY', type: 'secret', required: false, description: 'Provider API key (also accepted as a fallback by DX_OCR_API_KEY).' },
    { name: 'AGENT_MODEL', type: 'string', required: false, default: 'combo', description: 'Model identifier used by @dx/agent-worker CLI invocations.' },
    { name: 'AGENT_ENGINE_URL', type: 'string', required: false, default: 'http://localhost:8080', description: 'Trusted gateway origin for CLI agent runs.' },
    { name: 'AGENT_WORKER_TOKEN', type: 'secret', required: false, description: 'Short-lived JWT used by CLI agent worker invocations.' },
    { name: 'DXOS_AI_DAILY_ORG_CALL_LIMIT', type: 'number', required: false, default: '5000', description: 'Daily AI tool invocation quota per organization.' },
    { name: 'DXOS_AI_DAILY_USER_CALL_LIMIT', type: 'number', required: false, default: '500', description: 'Daily AI tool invocation quota per user.' },
    { name: 'DXOS_AI_DAILY_ORG_TOKEN_LIMIT', type: 'number', required: false, default: '5000000', description: 'Daily token budget per organization.' },
    { name: 'DXOS_AI_DAILY_ORG_USD_LIMIT', type: 'number', required: false, default: '50', description: 'Daily estimated USD spend cap per organization.' },
    { name: 'DXOS_MCP_INTERNAL_HTTP_ALLOWLIST', type: 'string', required: false, description: 'Comma-separated internal host allowlist for MCP IT/OT tool HTTP calls.' },
    { name: 'DX_EMBEDDING_URL', type: 'string', required: false, description: 'Embedding endpoint (or DXOS_EMBEDDING_URL) for pgvector HNSW hybrid RAG.' },
    { name: 'DX_EMBEDDING_DIM', type: 'number', required: false, default: '1536', description: 'Vector dimension override (or DXOS_EMBEDDING_DIM, valid range 8..8192).' },
    { name: 'DX_OCR_ENDPOINT', type: 'string', required: false, description: 'Remote multimodal OCR endpoint for image-only PDFs (SSRF-guarded; external URLs require HTTPS).' },
    { name: 'DX_OCR_API_KEY', type: 'secret', required: false, description: 'API key sent to DX_OCR_ENDPOINT.' },
    { name: 'DX_OCR_TRUSTED_HOSTS', type: 'string', required: false, description: 'Internal OCR hostnames explicitly permitted without TLS.' },
    { name: 'DX_APPRISE_URL', type: 'string', required: false, description: 'Apprise gateway URL for omnichannel dxosNotify delivery.' },
    { name: 'DX_NOTIFICATION_WEBHOOK_URL', type: 'string', required: false, description: 'Default outbound webhook URL for system notifications.' },
    { name: 'DXOS_GOTENBERG_URL', type: 'string', required: false, default: 'http://gotenberg:3000 (--profile pdf)', description: 'Gotenberg URL for sandboxed Unicode PDF voucher generation.' },
    { name: 'DXOS_PDF_FONT_PATH', type: 'string', required: false, description: 'Optional TrueType font path overriding the bundled Vietnamese PDF font.' },
    { name: 'DX_METRICS_TOKEN', type: 'secret', required: true, description: 'Bearer token authenticating Prometheus scrapes on GET /api/dxos:metrics before JWT parsing.' },
    { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', type: 'string', required: false, default: 'http://otel-collector:4318', description: 'OTLP/HTTP collector endpoint receiving API and OTel GenAI spans.' },
    { name: 'OTEL_SERVICE_NAME', type: 'string', required: false, default: 'latticedx-nocobase', description: 'Service name attribute attached to exported OpenTelemetry spans.' },
    { name: 'GRAFANA_ADMIN_USER', type: 'string', required: false, default: 'admin', description: 'Admin username for Grafana OSS 11.5.8 (--profile observability).' },
    { name: 'GRAFANA_ADMIN_PASSWORD', type: 'secret', required: false, description: 'Admin password for Grafana OSS 11.5.8.' },
    { name: 'LATTICE_SKIP_DEMO_SEED', type: 'string', required: false, description: 'Set to 1 to skip sample business records on clean database bootstrap while keeping 8 ldx_* roles and core schemas.' }
  ]"
/>

---

## 7. SSRF Guards and Runtime Health Verification

Server-side URL parsing enforces strict network boundaries on every outbound integration variable:

| Variable / Scope | Enforcing Module | SSRF & Credential Boundary |
| :--- | :--- | :--- |
| `DX_OCR_ENDPOINT` | `document-extractor.js` | Accepts only `http:` or `https:`, rejects embedded credentials (`OCR_ENDPOINT_CREDENTIALS_FORBIDDEN`), blocks cloud metadata and CGNAT ranges (`169.254.*`, `100.64.0.0/10`, `fd00:ec2::254`, `metadata.google.internal`, `metadata.azure.com` → `OCR_ENDPOINT_SSRF_BLOCKED`), and enforces `https://` for any host outside localhost or `DX_OCR_TRUSTED_HOSTS`. |
| `DX_ALLOW_INTERNAL_CONNECTORS` | `connector-vault.js` | Evaluates both input URLs and resolved DNS records against loopback, RFC1918, and link-local ranges, permitting internal Docker hostnames only when listed in `DX_INTERNAL_SERVICE_HOSTS` or `DX_CONNECTOR_INTERNAL_ALLOWLIST`. |
| Loopback Fixture Values | `.env.example` | Local strings such as `local-demo-password`, `local-nocobase-password`, `local-redis-password`, `local-nocobase-app-key-public-fixture`, and `admin@nocobase.com` are restricted to `127.0.0.1` development stacks and must never be reused on reachable networks. |

Inspect live subsystem configuration flags (`embeddingConfigured`, `ocrConfigured`, `DX_PG_RLS_SESSION`, and plugin readiness) through these endpoints after startup:

<ApiEndpoint
  method="GET"
  path="/api/dxos:health"
  auth="Public / Health"
  summary="Reports platform readiness, mounted plugin status, and PostgreSQL / Valkey connectivity."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePara:indexHealth"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Inspects pgvector HNSW index health alongside embeddingConfigured and ocrConfigured runtime flags."
/>

---

## Related

- [Zero-Trust Production Deployment](/en/getting-started/production-deployment)
- [Multi-Tenancy and PostgreSQL FORCE RLS](/en/architecture/multi-tenancy-rls)
- [Security Model and Network Zones](/en/architecture/security-model)
- [PKI Merkle Ledger and Scoped API Keys](/en/reference/pki-merkle-ledger)
