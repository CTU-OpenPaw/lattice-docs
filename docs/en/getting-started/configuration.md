---
title: Environment & Runtime Configuration
description: Complete verified reference of environment variables from .env.example, infra/compose/prod.env.example, infra/compose/prod.yml, and DX-OS NocoBase plugins.
---

# Environment & Runtime Configuration (`v0.4.2`)

Every environment variable documented on this page is verified directly against `.env.example`, `infra/compose/prod.env.example`, `infra/compose/*.yml`, and the server runtime source under `plugins/nocobase/*`.

::: warning Never Commit Secret Files
Keep production secrets in an ignored `.env.prod` file (mode `0600`) and local provider/integration overrides in ignored `.env.agent` or `.env.integration` files. Never embed credentials in `.env.example`, `infra/compose/prod.env.example`, or browser-side plugin bundles.
:::

## 1. Local Development Workspace (`.env.example`)

These variables configure `@dx/api`, `@dx/agent-worker`, and optional CLI smoke scripts during local development (`pnpm dev` or `pnpm local:up`):

| Variable | Default / Example | Required | Description |
| :--- | :--- | :--- | :--- |
| `API_PORT` | `4000` | No | Port for `@dx/api` Fastify service |
| `WORKER_PORT` | `4001` | No | Port for `@dx/agent-worker` |
| `API_URL` | `http://127.0.0.1:4000` | No | Local `@dx/api` base URL |
| `WORKER_URL` | `http://127.0.0.1:4001` | No | Local `@dx/agent-worker` base URL |
| `WORKFLOW_EVENT_URL` | *(empty)* | No | Optional fixed `n8n` / connector webhook destination; unset keeps outbox rows pending |
| `WORKFLOW_EVENT_TOKEN` | *(empty)* | No | Bearer/webhook token for `WORKFLOW_EVENT_URL` |
| `AGENT_PROVIDER` | `9router` | No | Server/CLI AI provider identifier (`.env.agent`) |
| `AGENT_BASE_URL` | `http://localhost:20128/v1` | No | OpenAI-compatible gateway URL for CLI agent smoke tests |
| `AGENT_API_KEY` | *(empty)* | No | Provider API key (also accepted as fallback by `DX_OCR_API_KEY`) |
| `AGENT_MODEL` | `combo` | No | Model identifier for CLI incident agent runs |
| `AGENT_ENGINE_URL` | `http://localhost:8080` | No | Trusted gateway/engine origin for `pnpm agent:incident` |
| `AGENT_WORKER_TOKEN` | *(empty)* | No | Short-lived worker JWT for CLI agent execution |
| `ORION_MONGO_VOLUME` | *(empty)* | No | Optional verified recovery volume override for `orion-mongo-data` (`.env.integration`) |

## 2. Production Domains, Databases & PITR (`infra/compose/prod.env.example`)

Required in `.env.prod` when running `infra/compose/prod.yml`:

### Domains & Reverse Proxy

| Variable | Example | Required | Description |
| :--- | :--- | :--- | :--- |
| `LATTICE_DOMAIN` | `app.latticedx.example.com` | Yes | Public FQDN served by Caddy for LatticeDX UI & `/api/*` |
| `KEYCLOAK_DOMAIN` | `auth.latticedx.example.com` | Yes | Public FQDN for Keycloak `26.8.2` |
| `N8N_DOMAIN` | `n8n.latticedx.example.com` | Yes | Public FQDN for optional Stock `n8n` (`--profile n8n`) |
| `LATTICE_ALLOWED_ORIGIN` | `https://app.latticedx.example.com` | Yes | Strict CORS `allow_origins` enforced by APISIX `global_rules` |

### PostgreSQL Core, NocoBase `nocobase_app` & WAL PITR

| Variable | Default / Example | Required | Description |
| :--- | :--- | :--- | :--- |
| `POSTGRES_SUPERUSER` | `postgres` | Yes | Superuser name for `postgres` (core DB container) |
| `POSTGRES_SUPERUSER_PASSWORD` | `CHANGE_ME_*` | Yes | Superuser password for `postgres` |
| `LATTICE_DB_PASSWORD` | `CHANGE_ME_*` | Yes | Password for non-superuser role `lattice_app` (`lattice` DB) |
| `KEYCLOAK_DB_PASSWORD` | `CHANGE_ME_*` | Yes | Password for non-superuser role `keycloak_app` (`keycloak` DB) |
| `N8N_DB_PASSWORD` | `CHANGE_ME_*` | Yes | Password for non-superuser role `n8n_app` (`n8n` DB) |
| `PG_ARCHIVE_COMMAND` | `/bin/sh /etc/postgresql/pitr-archive.sh %p %f` | No | PostgreSQL `archive_command` (`%p` path, `%f` filename) for `.gz` WAL archiving |
| `NOCOBASE_DB_USER` | `nocobase` | Yes | Bootstrap admin user for `nocobase-db` (`pgvector:0.8.1-pg16`) |
| `NOCOBASE_DB_PASSWORD` | `CHANGE_ME_*` | Yes | Password for `NOCOBASE_DB_USER` |
| `NOCOBASE_APP_DB_USER` | `nocobase_app` | Yes | **Non-superuser, `NOBYPASSRLS` runtime role** used by `nocobase`; must differ from `NOCOBASE_DB_USER` |
| `NOCOBASE_APP_DB_PASSWORD` | `CHANGE_ME_*` | Yes | Password for `NOCOBASE_APP_DB_USER` |
| `NOCOBASE_APP_KEY` | 64-hex cryptographic secret | Yes | NocoBase `APP_KEY` signing JWTs & app tokens |
| `NOCOBASE_ENCRYPTION_FIELD_KEY` | 64-hex cryptographic secret | Yes | NocoBase `ENCRYPTION_FIELD_KEY` for encrypted fields |

## 3. Cache, Storage, File Scanner & Identity

| Variable | Default / Example | Required | Description |
| :--- | :--- | :--- | :--- |
| `REDIS_PASSWORD` | `CHANGE_ME_*` | Yes | Password for Valkey `8.1` (`cache` `/0`, `pubsub` `/1`, `auth sessions` `/2`, APISIX `limit-count`) |
| `RUSTFS_ACCESS_KEY` | `CHANGE_ME_*` | Yes | S3 access key for internal `rustfs:9000` |
| `RUSTFS_SECRET_KEY` | `CHANGE_ME_*` | Yes | S3 secret key for internal `rustfs:9000` |
| `FILE_STORAGE_PROVIDER` | `s3` | No | `s3` (RustFS in `prod.yml`) or `postgres` (default in `core.yml`) |
| `DX_NATIVE_FILES_INSTANCE` | `latticedx-prod` | Yes | Instance identifier shared between `nocobase` and `file-scanner` |
| `DX_NATIVE_FILES_SECRET` | `CHANGE_ME_*` | Yes | HMAC/shared secret authenticating internal calls to `http://file-scanner:4010` |
| `KEYCLOAK_ADMIN_USER` | `kc-admin` | Yes | Keycloak bootstrap admin username |
| `KEYCLOAK_ADMIN_PASSWORD` | `CHANGE_ME_*` | Yes | Keycloak bootstrap admin password |
| `APISIX_OIDC_CLIENT_SECRET` | `CHANGE_ME_*` | Yes | Client secret for `dx-gateway` OIDC validation in APISIX & `keycloak-config-cli` |
| `DX_ALLOW_PUBLIC_SIGNUP` | `false` | No | Set `'true'` only if self-registration is explicitly desired (disabled by default) |
| `DX_ENTERPRISE_DISABLE_SIGNUP` | `false` | No | Set `'true'` to strictly reject local signup endpoints |
| `DX_NATIVE_AUTH_GROUP_ROLE_MAP` | *(JSON mapping)* | No | Optional OIDC group-to-`ldx_*` role mapping override in `plugin-enterprise-auth` |

## 4. DX-OS Security, RLS, Vault & PKI Controls

| Variable | Default | Where Used | Description |
| :--- | :--- | :--- | :--- |
| `DX_PG_RLS_SESSION` | `true` (`prod.yml`) | `plugin-lattice-foundation`, `plugin-dxos-para` | Activates `AsyncLocalStorage` transaction bridge calling `set_config('app.current_org', ..., true)` for PostgreSQL `FORCE RLS` across 56 static + dynamic `latticeCustom*` tables |
| `DX_VAULT_MASTER_KEY` | *(falls back to `ENCRYPTION_FIELD_KEY` / `APP_KEY`)* | `connector-vault.js` | Master key for AES-256-GCM encryption of Connector Vault secrets (`dxosVault`). Required (or `ENCRYPTION_FIELD_KEY`/`APP_KEY`) when `NODE_ENV=production` |
| `LATTICE_TRACK_VERIFY_SECRET` | *(derived if unset)* | `wms-engine.js` | Optional dedicated signing/verification secret for `/v/track/:code` Ed25519 tracking tokens |
| `DX_TRUST_PROXY` | *(unset)* | `plugin-lattice-foundation` | Controls trusted proxy IP extraction for public form/route rate limiting |
| `DX_ALLOW_INTERNAL_CONNECTORS` | `true` (`prod.yml`) | `connector-vault.js` | Permits Connector Vault & SSRF guard to call explicitly allowlisted internal Docker service hostnames |
| `DX_INTERNAL_SERVICE_HOSTS` | `n8n,orion-ld,nodered,mosquitto` | `connector-vault.js` | Comma-separated internal host allowlist (never bypasses cloud metadata `169.254.169.254` or arbitrary RFC1918 IPs) |
| `DXOS_MCP_INTERNAL_HTTP_ALLOWLIST` | *(empty)* | `plugin-dxos-ai` | Optional comma-separated internal HTTP allowlist for MCP IT/OT tool endpoints |
| `LATTICE_SKIP_DEMO_SEED` | unset (`"1"` in `--blank-slate`) | `plugin-lattice-foundation` | Skips demo business record seeding while preserving `8` `ldx_*` roles, `dxos-architect`, and `FORCE RLS` |

## 5. IIoT, Orion-LD, n8n & Automation Engine

| Variable | Default / Example | Required | Description |
| :--- | :--- | :--- | :--- |
| `ORION_MONGO_USER` | `orion_root` | Yes | MongoDB root user for `orion-mongo` and `orion-ld` |
| `ORION_MONGO_PASSWORD` | `CHANGE_ME_*` | Yes | MongoDB password (`SCRAM-SHA-256`) |
| `DX_NATIVE_CONTEXT_BROKER_URL` | `http://orion-ld:1026` | No | Orion-LD URL inside `app` network |
| `DX_NATIVE_CONTEXT_AUTO_SYNC` | `"true"` (`"false"` in `native-clean`) | No | Enables automatic NGSI-LD entity sync on telemetry/asset updates |
| `N8N_ENCRYPTION_KEY` | `CHANGE_ME_*` | If `--profile n8n` | Encryption key for `n8n` credentials store |
| `N8N_URL` | `http://n8n:5678` | No | Internal `n8n` REST API v1 base URL |
| `N8N_WEBHOOK_BASE_URL` | `http://n8n:5678/webhook` | No | Internal `n8n` webhook base URL |
| `DX_N8N_API_KEY` | *(optional)* | No | Fallback `X-N8N-API-KEY` if not stored in Connector Vault (`dxosVault`) |
| `MQTT_ADMIN_USER` / `MQTT_ADMIN_PASSWORD` | `ldx_mqtt_admin` / `CHANGE_ME_*` | If `--profile iiot` | Mosquitto Dynamic Security admin credentials used by `dxosBroker` |
| `MQTT_BRIDGE_USER` / `MQTT_BRIDGE_PASSWORD` | `nodered_bridge` / `CHANGE_ME_*` | If `--profile iiot` | Restricted MQTT credentials injected into Node-RED (`flows_cred.json`) |
| `DX_MQTT_BROKER_HOST` / `DX_MQTT_BROKER_PORT` | `mosquitto` / `1883` | No | Internal MQTT broker host and port |
| `DX_NODERED_COMMAND_URL` | `http://nodered:1880/twin/command` | No | Downlink HTTP endpoint for approved Digital Twin setpoint commands |
| `DX_IIOT_INGEST_TOKEN` | `CHANGE_ME_32HEX_*` | If `--profile iiot` | Shared bearer token authenticating Node-RED ingest (`telemetryIngest`, `deviceStatusIngest`, `twinAckCommand`) |
| `NODERED_CREDENTIAL_SECRET` | `CHANGE_ME_32HEX_*` | If `--profile iiot` | AES-256-CTR key encrypting `/data/flows_cred.json` in Node-RED |
| `NODERED_ADMIN_USER` / `NODERED_ADMIN_PASS_HASH` | `nodered_admin` / bcrypt hash | If `--profile iiot` | Admin UI authentication (`NODERED_REQUIRE_ADMIN_AUTH="true"`) |
| `DX_SLA_CRON_ENABLED` | *(unset / `'true'`)* | No | Enables background SLA escalation sweep in `sla-engine.js` |
| `DX_SLA_INTERVAL_MS` | `300000` (min `60000`) | No | Interval in milliseconds between SLA sweeps |
| `DX_FLOW_DELAY_TICK_MS` | *(default engine interval)* | No | LatticeFlow v2 `control.delay` polling tick interval |
| `DX_OUTBOX_MAX_ATTEMPTS` / `DX_OUTBOX_STALE_LOCK_MS` | *(engine defaults)* | No | Outbox delivery retry ceiling and stale lock recovery window |

## 6. Knowledge Vault (P.A.R.A. OCR / Embeddings), PDF & Observability

| Variable | Default / Example | Required | Description |
| :--- | :--- | :--- | :--- |
| `DX_OCR_ENDPOINT` | *(empty — offline parser)* | No | Remote multimodal OCR HTTP(S) endpoint for scanned image-only PDFs (SSRF-guarded; external URLs require HTTPS) |
| `DX_OCR_API_KEY` | *(falls back to `AGENT_API_KEY`)* | No | API key sent to `DX_OCR_ENDPOINT` |
| `DX_OCR_TRUSTED_HOSTS` | *(empty)* | No | Comma-separated internal hostnames explicitly trusted for `DX_OCR_ENDPOINT` |
| `DXOS_EMBEDDING_URL` / `DX_EMBEDDING_URL` | *(empty — keyword/tsvector fallback)* | No | Embedding endpoint for `pgvector 0.8.1` HNSW hybrid RAG (`latticePara:hybridSearch`) |
| `DX_EMBEDDING_DIM` / `DXOS_EMBEDDING_DIM` | *(flexible `8..8192`)* | No | Vector dimension override matching your embedding model |
| `DXOS_GOTENBERG_URL` | *(empty; `http://gotenberg:3000` with `--profile pdf`)* | No | Optional Gotenberg PDF rendering service URL |
| `DXOS_PDF_FONT_PATH` | *(bundled fallback)* | No | Custom Unicode/Vietnamese TrueType font path for PDF voucher generation |
| `DX_METRICS_TOKEN` | `CHANGE_ME_*` | Yes (`prod.yml`) | Bearer token authenticating Prometheus scrapes on `/api/dxos:metrics` (checked before JWT parsing) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4318` | No | OTLP/HTTP collector endpoint for GenAI & API spans (`otel-exporter.js`) |
| `OTEL_SERVICE_NAME` | `lattice-dx` | No | Service name tag on exported OpenTelemetry traces |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | `admin` / `CHANGE_ME_*` | If `--profile observability` | Initial Grafana OSS `11.5.8` credentials (`GF_USERS_ALLOW_SIGN_UP="false"`) |

::: tip Viewing Live Runtime Health
After starting your stack, verify which optional integrations (`embeddingConfigured`, `ocrConfigured`, RLS session status, and plugin readiness) are active via:
- `GET /api/dxos:health` — Runtime readiness & subsystem status
- `GET /api/latticePara:indexHealth` — P.A.R.A. vector index, `embeddingConfigured`, and `ocrConfigured` flags
:::
