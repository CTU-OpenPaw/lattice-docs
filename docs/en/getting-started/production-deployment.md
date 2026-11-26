---
title: Zero-Trust Production Deployment
description: Hardened production deployment using infra/compose/prod.yml with 5 isolated networks, Caddy 2.10, APISIX 3.19.0, Keycloak OIDC/PKCE, Valkey 8.1 DB 0/1/2 partitioning, non-root nocobase_app, and @sha256 pinned digests.
---

# Zero-Trust Production Deployment

The `infra/compose/prod.yml` stack (`name: lattice-dx-prod`) packages the hardened production topology for LatticeDX `0.4.2`. It combines east-west segmentation across five Docker networks, immutable `@sha256` digest pinning across every OCI image, least-privilege PostgreSQL roles (`nocobase_app`), and OIDC/PKCE enforcement at the ingress boundary.

## 1. Five-Network Segmentation and Container Hardening

Every service in `infra/compose/prod.yml` inherits the `x-hardened` anchor (`restart: unless-stopped`, `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`) and receives only the exact Linux capabilities (`cap_add`) required for its process. Four of the five networks are declared `internal: true`, blocking unrouted outbound internet access and lateral movement from data, scanner, or shop-floor OT containers.

| Docker Network | `internal` | Attached Services | Security Boundary |
| :--- | :--- | :--- | :--- |
| **`edge`** | `false` | `caddy`, `keycloak`, `gateway`, `nocobase` | Public HTTPS ingress (`80`, `443` TCP/UDP) terminated exclusively by Caddy |
| **`app`** | `true` | `caddy`, `gateway`, `keycloak`, `keycloak-config-cli`, `nocobase`, `redis`, `file-scanner`, `orion-ld`, `n8n`, `otel-collector`, `prometheus`, `grafana`, `gotenberg`, `nodered` | Internal HTTP API control plane, OIDC backchannel, OTLP traces, and workflow bridges |
| **`data`** | `true` | `postgres`, `nocobase-db`, `redis`, `rustfs`, `orion-mongo`, `keycloak`, `nocobase`, `file-scanner`, `orion-ld`, `n8n`, `otel-collector`, `prometheus`, `grafana` | Relational databases, `pgvector` embeddings, Valkey store, S3 object storage, and MongoDB |
| **`scanner`** | `true` | `clamav`, `file-scanner` | Air-gapped antivirus scanning plane isolated from `edge` and `data` |
| **`iiot-net`** | `true` | `mosquitto`, `nodered`, `nocobase` | Isolated shop-floor MQTT broker and Node-RED protocol bridge |

Stateless services (`file-scanner`, `otel-collector`, `prometheus`, `gotenberg`) run with `read_only: true` and scoped `tmpfs` mounts (`noexec,nosuid`). RustFS runs with `RUSTFS_CONSOLE_ENABLE: "false"` so S3 storage stays strictly internal on `data:9000`.

---

## 2. Pinned `@sha256` OCI Image Inventory

All OCI images in `infra/compose/prod.yml` are pinned by immutable `@sha256` digests to prevent tag-mutation supply-chain drift. `@dx/file-scanner` builds locally from `apps/file-scanner/Dockerfile`.

### Core Services (Always Enabled)

| Service | Pinned Image Digest (`@sha256`) | Resource Limits |
| :--- | :--- | :--- |
| `caddy` | `caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d` | `256m` / `0.5` CPU |
| `gateway` | `apache/apisix:3.19.0-debian@sha256:9a7e45dc943fbf10ec916d1232bae4cda9302ae28a4696cfb83c2da01d261141` | `512m` / `1.0` CPU |
| `keycloak` | `quay.io/keycloak/keycloak:26.8.2@sha256:7e66a96e4739239070aeaf72e4c5decf0f7f682cfc725b9f7ea2b336eaba38b3` | `1536m` / `1.5` CPU |
| `postgres` | `postgres:16.16-alpine@sha256:f2f98726820d0342055351c6e9d36e705f5bfffb3dd53ff556325114b08afb6d` | `1536m` / `1.5` CPU |
| `nocobase-db` | `pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337` | `2048m` / `2.0` CPU |
| `redis` | `valkey/valkey:8.1-alpine@sha256:9971099af41c36e887aabdfe22b80c0fe45df949163dfc9cb434febc57cfc3fc` | `640m` / `0.5` CPU |
| `rustfs` | `rustfs/rustfs:1.0.6@sha256:ee717072290bec9b11abfc0365f8310b00df1cd9b3639943edae47bdef05044a` | `1024m` / `1.0` CPU |
| `clamav` | `clamav/clamav:1.5.5@sha256:12177441d1b40cef3c47b44c4090d59d4babc4c67bedd5af0fa315e603aa6dd8` | `2048m` / `1.0` CPU |
| `file-scanner` | Built from `apps/file-scanner/Dockerfile` (`read_only: true`) | `256m` / `0.5` CPU |
| `orion-mongo` | `mongo:8.0@sha256:479e85ced54ffb8a40dade1dcde2da2a9ae858515b9415e9cc54bfb8f0575d01` | `1024m` / `1.0` CPU |
| `orion-ld` | `fiware/orion-ld:1.12.0@sha256:f562a93ed84cccae05063688e1c3605f75060d0c7b9cd004561eec43bcbd613b` | `768m` / `1.0` CPU |
| `nocobase` | `nocobase/nocobase:2.2.50@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777` | `2048m` / `2.0` CPU |

### Optional Profile Services (`--profile`)

| Profile | Service | Pinned Image Digest (`@sha256`) | Resource Limits |
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

## 3. Edge Proxy: Caddy, Apache APISIX, and Keycloak OIDC/PKCE

Incoming client traffic passes through three sequential enforcement layers before reaching the NocoBase host or backend services:

| Edge Layer | Configuration File | Security & Routing Policy |
| :--- | :--- | :--- |
| Caddy `2.10` | `infra/config/caddy/Caddyfile` | Terminates TLS for `${LATTICE_DOMAIN}`, `${KEYCLOAK_DOMAIN}`, and `${N8N_DOMAIN}` (including HTTP/3 on `443/udp`), strips the `Server` header, and injects `Strict-Transport-Security` (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, and `Permissions-Policy`. Paths under `/api/*` and `/.well-known/agent-card.json` route to `gateway:9080` with `flush_interval -1` for SSE streaming, while portal UI routes forward to `nocobase:80` where Nginx applies per-response nonce CSP for `/v/form/*` and `/v/track/*`. |
| Apache APISIX `3.19.0` | `infra/config/apisix/apisix.prod.yaml` | Attaches `X-Request-Id`, enforces strict CORS against `${LATTICE_ALLOWED_ORIGIN}`, and applies Valkey-backed `limit-count` throttling (`120` req/60s on public, auth, and MCP routes; `300` req/60s on IIoT ingest endpoints; `240` req/60s on `/api/*`). Requests to `/api/dxos-oidc/*` undergo `openid-connect` validation (`bearer_only: true`, `use_jwks: true`, `ssl_verify: true`) against Keycloak JWKS. |
| Keycloak `26.8.2` | `infra/config/keycloak/lattice-realm.prod.json` | Configures the `lattice` realm with `bruteForceProtected: true` (5-attempt lockout), TOTP MFA, and a 12-character minimum password policy. The public `dx-native` client enforces PKCE `S256` (`standardFlowEnabled: true`, `directAccessGrantsEnabled: false`). `@latticedx/plugin-enterprise-auth` executes the 4-step `start` -> `callback` -> `finish` -> `backchannelLogout` lifecycle and explicitly skips privileged roles (`ldx_admin`, `allowConfigure`, `pm*`) during group-to-role mapping. |

---

## 4. Valkey 8.1 Partitioning (DB 0 / DB 1 / DB 2)

`valkey/valkey:8.1-alpine` (`BSD-3-Clause`) runs with `--appendonly yes`, `--requirepass`, `--maxmemory 512mb`, and `allkeys-lru` eviction, isolating state across three logical databases plus APISIX rate-limit counters:

<ParamGrid
  title="Valkey 8.1 Logical Database Partitioning"
  :items="[
    { name: 'DB 0 (CACHE_REDIS_URL)', type: 'Cache', default: 'redis://:...@redis:6379/0', description: 'NocoBase application cache store when CACHE_DEFAULT_STORE=redis.' },
    { name: 'DB 1 (PUBSUB_ADAPTER_REDIS_URL)', type: 'Pub/Sub', default: 'redis://:...@redis:6379/1', description: 'PubSub channel latticedx:surface-updates bridging record/flow mutations to /api/dxosAi:surfaceEvents SSE.' },
    { name: 'DB 2 (DX_NATIVE_AUTH_SESSION_REDIS_URL)', type: 'Session/PKCE', default: 'redis://:...@redis:6379/2', description: 'Stores OIDC PKCE state (300s TTL), one-time tickets (60s TTL), and backchannelLogout revocation keys (24h TTL).' },
    { name: 'APISIX limit-count', type: 'Rate Limit', default: 'policy: redis', description: 'Tracks per-IP rate-limit windows across public, auth, MCP, IIoT, and core API routes.' }
  ]"
/>

Valkey Streams are not used for asynchronous delivery. The transactional outbox tables (`latticeContextOutbox`, `latticeEventBus`) reside in PostgreSQL and drain via `FOR UPDATE SKIP LOCKED`.

---

## 5. Non-Root `nocobase_app` Role and Least-Privilege Databases

During initial `nocobase-db` bootstrap, `infra/config/postgres/init-nocobase-db.sh` creates the non-superuser runtime role `nocobase_app` and aborts if `NOCOBASE_APP_DB_USER` matches `POSTGRES_USER`:

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

Because `nocobase_app` carries `NOSUPERUSER` and `NOBYPASSRLS`, PostgreSQL enforces `ENABLE` and `FORCE ROW LEVEL SECURITY` across all 56 static tables and dynamic `latticeCustom*` tables even though `nocobase_app` owns the `nocobase` database. Paired with `DX_PG_RLS_SESSION=true`, every transaction-scoped query stays confined to `app.current_org`.

---

## 6. Step-by-Step Production Rollout

### Step 1: Prepare `.env.prod` and Validate Compose

Copy `infra/compose/prod.env.example` outside Git, replace all `CHANGE_ME_*` secrets, and verify Compose interpolation:

<CodeTabs
  :tabs="[
    {
      label: 'Initialize & Validate',
      lang: 'bash',
      code: 'cp infra/compose/prod.env.example .env.prod\nchmod 600 .env.prod\ndocker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile iam-sync --profile n8n --profile iiot --profile observability --profile pdf \\\n  config --quiet'
    }
  ]"
/>

### Step 2: Build the 7 Plugins on Host and Start the Stack

`prod.yml` bind-mounts the 7 `plugins/nocobase/*` directories read-only (`:ro`) into `/app/nocobase/node_modules/@latticedx/*`. Build all `dist/` bundles and install `openid-client` inside `plugin-enterprise-auth` before starting containers:

<CodeTabs
  :tabs="[
    {
      label: 'Build Plugins & Start Prod',
      lang: 'bash',
      code: 'pnpm install --frozen-lockfile\nnpm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund\nnode plugins/nocobase/action-bridge/build.mjs\nnode plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs\nnode plugins/nocobase/plugin-enterprise-auth/build.mjs\nnode plugins/nocobase/plugin-dxos-para/build.mjs\nnode plugins/nocobase/plugin-dxos-blocks/build.mjs\nnode plugins/nocobase/plugin-dxos-studio/build.mjs\nnode plugins/nocobase/plugin-dxos-ai/build.mjs\n\ndocker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile iam-sync --profile n8n --profile iiot --profile observability --profile pdf \\\n  up -d --build'
    }
  ]"
/>

### Step 3: Sync Keycloak Realm and Enable Plugins

Once `postgres`, `nocobase-db`, `keycloak`, `clamav`, and `nocobase` report healthy, ensure the `iam-sync` job has completed, register the 7 plugins, and run `yarn nocobase upgrade`:

<CodeTabs
  :tabs="[
    {
      label: 'Sync IAM & Enable Plugins',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml --profile iam-sync up --abort-on-container-exit\n\nfor pkg in \\\n  @latticedx/plugin-action-bridge \\\n  @latticedx/plugin-lattice-foundation \\\n  @latticedx/plugin-enterprise-auth \\\n  @latticedx/plugin-dxos-para \\\n  @latticedx/plugin-dxos-blocks \\\n  @latticedx/plugin-dxos-studio \\\n  @latticedx/plugin-dxos-ai; do\n  docker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase pm add \x22$pkg\x22 || true\n  docker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase pm enable \x22$pkg\x22\ndone\n\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase upgrade'
    }
  ]"
/>

### Step 4: Verify Ingress Health and PITR Readiness

Confirm container health and test public routing through Caddy and APISIX:

<ApiEndpoint
  method="GET"
  path="/health"
  auth="Public (APISIX rewrite -> /api/dxos:health)"
  summary="Verifies TLS routing through Caddy, APISIX rate-limiting, and NocoBase runtime health."
/>

<CodeTabs
  :tabs="[
    {
      label: 'Verify Stack & Metrics',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml ps\ncurl -fsS \x22https://<LATTICE_DOMAIN>/health\x22\n\n# Verify Prometheus scrape endpoint with DX_METRICS_TOKEN\ncurl -fsS -H \x22Authorization: Bearer <DX_METRICS_TOKEN>\x22 \x22https://<LATTICE_DOMAIN>/api/dxos:metrics\x22 | head -n 20'
    }
  ]"
/>

Both `postgres` and `nocobase-db` start with `wal_level=replica`, `archive_mode=on`, `archive_timeout=300`, `wal_compression=on`, and `pitr-archive.sh` archiving gzipped WAL segments. Follow [Upgrading](/en/getting-started/upgrading) and [Backup and PITR](/en/operations/backup-and-pitr) to schedule regular backups and recovery drills.

---

## Related

- [Environment and Runtime Configuration](/en/getting-started/configuration)
- [Installation Profiles and Hardware Sizing](/en/getting-started/installation-profiles)
- [Security Model and Network Zones](/en/architecture/security-model)
- [Backup and PITR](/en/operations/backup-and-pitr)
