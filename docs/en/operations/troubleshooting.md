---
title: Troubleshooting
description: Diagnostic playbooks for Keycloak OIDC/PKCE, PostgreSQL 16 FORCE RLS, Docker Compose networks, Mosquitto/Orion-LD IIoT pipelines, and AI providers.
---

# Troubleshooting

This guide provides diagnostic playbooks for the five operational layers of LatticeDX: Keycloak OIDC/PKCE authentication, PostgreSQL 16 `FORCE ROW LEVEL SECURITY`, Docker Compose network segmentation, the IIoT pipeline (Mosquitto, Node-RED, Orion-LD), and AI/MCP gateways. Run read-only inspection queries before mutating container state or secrets.

## Quick Symptom Matrix

<ParamGrid
  title="Subsystem Triage Reference"
  :items="[
    { name: 'OIDC 401 or Callback Loop', type: 'Keycloak + Valkey DB 2', description: 'Check issuer mismatch between DX_NATIVE_AUTH_ISSUER and DX_NATIVE_AUTH_INTERNAL_ISSUER or expired 60s ticket: keys.' },
    { name: 'Empty RLS Results / 42501', type: 'PG16 + nocobase_app', description: 'Verify DX_PG_RLS_SESSION=true, transaction-local app.current_org, and NOBYPASSRLS on nocobase_app.' },
    { name: 'Inter-Service Timeouts', type: 'Docker Networks', description: 'Verify shared internal network membership (app, data, scanner, iiot-net) and container healthchecks.' },
    { name: 'IIoT Drops / Outbox Backlog', type: 'Mosquitto + Orion-LD', description: 'Inspect dynamic-security.json ACLs, SSRF host allowlists, and failed rows in latticeContextOutbox.' },
    { name: 'AI / RAG Errors or Dropped Spans', type: 'plugin-dxos-ai', description: 'Check AGENT_BASE_URL, DX_EMBEDDING_DIM=1536 alignment, and OTel queue counters on /api/dxos:health.' }
  ]"
/>

## 1. Keycloak OIDC, PKCE S256, and Session Revocation

`plugin-enterprise-auth` separates browser-facing issuer URLs (`DX_NATIVE_AUTH_ISSUER`) from server-to-Keycloak internal traffic (`DX_NATIVE_AUTH_INTERNAL_ISSUER`) and stores short-lived PKCE state inside Valkey DB 2.

### Symptoms: `invalid_state`, Expired `ticket`, or Missing Role Mapping

| Root Cause | Verification & Remediation |
| :--- | :--- |
| Public vs. internal issuer mismatch | When `DX_NATIVE_AUTH_ISSUER` points to `https://${KEYCLOAK_DOMAIN}/realms/lattice` while `DX_NATIVE_AUTH_INTERNAL_ISSUER` is unset or misrouted, token exchange inside `/api/enterpriseAuth:callback` fails. Confirm `DX_NATIVE_AUTH_ORIGIN` matches the exact browser scheme and hostname. |
| Valkey DB 2 TTL expiration | PKCE `state:` keys expire after `300s`, and single-use `ticket:` keys (paired with the `HttpOnly` `ldx_enterprise_binding` cookie) expire after `60s`. Network stalls, cookie-stripping proxies, or host clock skew beyond those bounds reject `/api/enterpriseAuth:finish`. |
| Brute-force lockout or filtered role mapping | The production realm (`lattice-realm.prod.json`) enables `bruteForceProtected: true` (locking accounts after `5` failed attempts). When verifying group sync, note that `DX_NATIVE_AUTH_GROUP_ROLE_MAP` in `policy.js` intentionally skips privileged roles (`ldx_admin`, `allowConfigure`, `pm*`) to prevent privilege escalation through OIDC group claims. |

<CodeTabs
  :tabs="[
    {
      label: 'Check OIDC Discovery',
      lang: 'bash',
      code: '# From host (local stack)\ncurl -fsS http://127.0.0.1:8081/realms/lattice/.well-known/openid-configuration | jq \x22{issuer, token_endpoint, jwks_uri}\x22\n\n# From inside nocobase container against internal issuer\ndocker compose -f infra/compose/prod.yml exec nocobase node -e \x22fetch(process.env.DX_NATIVE_AUTH_INTERNAL_ISSUER + \x27/.well-known/openid-configuration\x27).then(r=>console.log(r.status))\x22'
    },
    {
      label: 'Inspect Valkey DB 2',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml exec redis valkey-cli --no-auth-warning -a \x22$REDIS_PASSWORD\x22 -n 2 KEYS \x22*\x22\n# Check backchannelLogout revocation keys (24h TTL)\ndocker compose -f infra/compose/prod.yml exec redis valkey-cli --no-auth-warning -a \x22$REDIS_PASSWORD\x22 -n 2 TTL \x22revoked_sid:<session_id>\x22'
    }
  ]"
/>

## 2. PostgreSQL 16 `FORCE RLS` (`app.current_org` and `nocobase_app`)

All 56 static tenant tables and dynamic `latticeCustom*` tables enforce `ENABLE` and `FORCE ROW LEVEL SECURITY` using transaction-local GUC settings `app.current_org` and `app.rls_bypass`.

### Symptoms: Zero Rows Returned, `42501` Violations, or `25P02` Aborted Transactions

| Root Cause | Verification & Remediation |
| :--- | :--- |
| Missing transaction-local `set_config` | Queries executed directly on the pool outside `withTenantRlsContext` or `withSystemRlsBypass` (or with `DX_PG_RLS_SESSION` disabled) evaluate `current_setting('app.current_org', true)` as empty, causing `lattice_tenant_isolation` to filter out all rows. |
| `25P02` (`current transaction is aborted`) | Running an optional query inside an open RLS transaction without `runInRlsSavepoint` (`SAVEPOINT "ldx_sp_<n>"`) aborts the entire outer transaction until rollback. |
| Incorrect database role privileges | `init-nocobase-db.sh` requires `NOCOBASE_APP_DB_USER` (`nocobase_app`) to differ from `POSTGRES_USER` and enforces `NOSUPERUSER NOBYPASSRLS`. Connecting the runtime application with a superuser migration role (`nocobase` or `postgres`) bypasses `FORCE ROW LEVEL SECURITY`. |

<CodeTabs
  :tabs="[
    {
      label: 'Inspect Roles & Policies',
      lang: 'sql',
      code: '-- 1. Confirm nocobase_app does not hold BYPASSRLS\nSELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN (\x27nocobase_app\x27, \x27nocobase\x27, \x27lattice_app\x27);\n\n-- 2. Inspect active policies on sample camelCase and snake_case tables\nSELECT schemaname, tablename, policyname, qual, with_check\nFROM pg_policies\nWHERE tablename IN (\x27latticeOrders\x27, \x27lattice_native_request_attachments\x27);'
    },
    {
      label: 'Simulate Tenant Session',
      lang: 'sql',
      code: 'BEGIN;\nSET ROLE nocobase_app;\nSELECT set_config(\x27app.current_org\x27, \x27org-a\x27, true);\nSELECT count(*) FROM public.\x22latticeOrders\x22;\nROLLBACK;'
    }
  ]"
/>

## 3. Docker Compose Networking, Gateway, and Auxiliary Services

`infra/compose/prod.yml` isolates traffic across 5 Docker networks: `edge` (external ingress for Caddy, Keycloak, APISIX, and NocoBase), `app` (`internal: true`), `data` (`internal: true`), `scanner` (`internal: true`), and `iiot-net` (`internal: true`).

### Symptoms: `ECONNREFUSED` Across Containers, CORS Stripping, or Pending File Scans

| Root Cause | Verification & Remediation |
| :--- | :--- |
| Missing Compose profile or network segmentation | Verify optional profiles (`observability`, `iiot`, `n8n`, `pdf`, `iam-sync`) are active when expected. In local development, run `pnpm local:doctor --integration` to probe `api`, `keycloak`, `nocobase`, `orion-ld`, and `n8n` without mutating state. |
| CORS headers stripped by `DX_CORS_STRICT=true` | The middleware in `observability.js` strips `Access-Control-Allow-*` headers whenever an incoming `Origin` fails validation against `DX_CORS_ALLOWED_ORIGINS` or the request host. |
| Stuck `pending` file uploads | `file-scanner:4010` communicates with `clamav:3310` over the isolated `scanner` network. If `clamav` is refreshing virus definitions or hits its `2048m` memory limit, pending uploads remain queued until `DX_UPLOAD_STALE_PENDING_MS` (`900000` ms). Inspect `tmpfs` capacity and `clamdcheck.sh` status inside the container. |

<CodeTabs
  :tabs="[
    {
      label: 'Probe Local Stack',
      lang: 'bash',
      code: 'pnpm local:doctor --integration\ndocker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml ps'
    },
    {
      label: 'Check Prod & File Scanner',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml ps\ndocker compose -f infra/compose/prod.yml exec file-scanner node -e \x22fetch(\x27http://127.0.0.1:4010/health\x27).then(r=>console.log(r.status))\x22\ndocker compose -f infra/compose/prod.yml logs --tail 80 gateway caddy'
    }
  ]"
/>

## 4. IIoT Stack: Mosquitto DynSec, Node-RED, and FIWARE Orion-LD

Edge telemetry flows through `mosquitto:1883` (bound strictly to `iiot-net`) into `nodered:1880`, then syncs with `nocobase` and `orion-ld:1026`.

### Symptoms: MQTT Auth Denials or `latticeContextOutbox` `failed` Backlog

| Root Cause | Verification & Remediation |
| :--- | :--- |
| MQTT client denied or downlink commands dropped | `mosquitto.conf` sets `allow_anonymous false` and `init-dynsec.sh` sets default ACL access to `deny`. The `MQTT_BRIDGE_USER` account is scoped to subscribe on `latticedx/#` and publish commands on `latticedx/+/+/command`. Rotating `MQTT_BRIDGE_PASSWORD` after `/mosquitto/data/dynamic-security.json` has been initialized requires updating the client password via `mosquitto_ctrl dynsec`. |
| SSRF host allowlist rejections | Orion-LD and Node-RED outbound calls fail closed unless target hostnames match `DX_ORION_HOST_ALLOWLIST`, `DX_ORION_CALLBACK_HOST_ALLOWLIST`, and `DX_NODERED_HOST_ALLOWLIST`. |
| Stuck `latticeContextOutbox` rows | The 10-second outbox drainer uses `FOR UPDATE OF o SKIP LOCKED` per entity. Crashed worker locks expire after `DX_OUTBOX_STALE_LOCK_MS` (`120000` ms), while rows exceeding `5` retries (`DX_OUTBOX_MAX_ATTEMPTS`) transition to `failed` until manually retried via `/api/latticeContextSync`. |

<CodeTabs
  :tabs="[
    {
      label: 'Inspect Orion-LD & Node-RED',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml exec orion-ld curl -fsS http://127.0.0.1:1026/version\ndocker compose -f infra/compose/prod.yml logs --tail 80 mosquitto nodered'
    },
    {
      label: 'Check Context Outbox Backlog',
      lang: 'sql',
      code: 'SELECT state, count(*), max(\x22updatedAt\x22) AS last_updated\nFROM public.\x22latticeContextOutbox\x22\nGROUP BY state\nORDER BY state;'
    }
  ]"
/>

## 5. AI Providers, MCP Gateway, and Hybrid RAG

`plugin-dxos-ai` connects to upstream language models via `AGENT_PROVIDER`, `AGENT_BASE_URL`, and `AGENT_MODEL`, queries `pgvector` HNSW indexes sized to `DX_EMBEDDING_DIM` (`1536`), and exports OTel traces alongside `latticeAiTraces`.

### Symptoms: MCP HTTP Blocks, Embedding Dimension Errors, or Dropped Traces

| Root Cause | Verification & Remediation |
| :--- | :--- |
| MCP HTTP tool blocked | `/api/dxos-mcp` blocks outbound HTTP calls to internal addresses unless explicitly listed in `DXOS_MCP_INTERNAL_HTTP_ALLOWLIST`. Check the JSON-RPC error payload and `latticeAiAuditLogs` entries. |
| P.A.R.A. RAG dimension mismatch | Switching embedding models without matching `DX_EMBEDDING_DIM` (`1536`) causes `pgvector` index queries on `latticeParaChunks` to fail; re-index existing chunks when changing vector dimensions. |
| Missing traces in OTel Collector | Inspect the `otel` object returned by `/api/dxos:health`. Rising `exportFailures` or a populated `lastError` indicates connectivity or endpoint mismatch on `OTEL_EXPORTER_OTLP_ENDPOINT` (`http://otel-collector:4318`) across the `app` network. |

```bash
# Inspect live OTel queue and export counters from /api/dxos:health
curl -fsS http://127.0.0.1:13000/api/dxos:health | jq '.data.otel // .otel'
```

## 6. Scoped API Keys (`ldx_pat_*`) and PKI Ledger

Headless integrations using `latticeApiKeys` and `latticeCryptoLedger` fail closed on scope mismatches, header role escalation, or key wrapping drift.

1. **HTTP `401`/`403` with `ldx_pat_*` tokens**: Tokens follow `ldx_pat_<8hex>_<32hex>` and persist only a SHA-256 `keyHash` inside `latticeApiKeys` (which is blocked from generic REST reads by a private collection guard). Verify token expiration (`expiresInDays` bounded `1..365`), required scopes (`read`, `write`, `wms`, `dmn`, `iot`, `ai`, `ledger`), and note that `clampHeaderRole` prevents escalating beyond the key's bound role.
2. **`LEDGER_IMMUTABLE` or QR signature mismatch**: `latticeCryptoLedger` serializes per-organization appends with `pg_advisory_xact_lock` and rejects all `UPDATE`/`DELETE` operations. If `/api/dxosWms:verifyTrackSignature` fails after a migration or restore, verify that `LATTICE_TRACK_VERIFY_SECRET` and `NOCOBASE_ENCRYPTION_FIELD_KEY` match the environment that signed the original record.

## Related

- [Observability and Tracing](/en/operations/observability)
- [Testing and Verification](/en/operations/testing-and-verification)
- [Multi-Tenancy and PostgreSQL RLS](/en/architecture/multi-tenancy-rls)
- [IIoT Digital Twin](/en/domains/iiot-digital-twin)
