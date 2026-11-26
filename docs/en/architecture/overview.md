---
title: 6-Plane DX-OS Architecture Overview
description: Six coordinated orchestration planes, five isolated Docker network zones, Compose profiles, and the four-repository Apache-2.0 ecosystem of LatticeDX v0.4.2.
---

# 6-Plane DX-OS Architecture Overview

LatticeDX `v0.4.2` organizes enterprise operations into a **6-Plane DX-OS** model backed by **five isolated container network zones**. This separation isolates the HTTP/TLS zero-trust edge, application and workflow orchestration, IT/OT digital-twin pipelines, the agentic AI workforce, and the PostgreSQL `16` persistence layer protected by `FORCE ROW LEVEL SECURITY`.

<PlatformPlanesDiagram />

## The 6 Coordinated Planes (Planes 1–6)

Each plane owns a distinct operational boundary and communicates with neighboring planes through versioned REST/RPC contracts, transactional outboxes, or typed event buses.

| Plane | Architectural Scope | Core Services & Modules | Primary Routes & Endpoints |
| :--- | :--- | :--- | :--- |
| **Plane 1** | Identity, Zero-Trust Edge & Multi-Tenant Persistence | Caddy `2.10`, Apache APISIX `3.19.0`, Keycloak `26.8.2` (OIDC/PKCE S256), Valkey `8.1`, `@latticedx/plugin-enterprise-auth`, scoped PaaS API keys (`ldx_pat_*`), Ed25519/Merkle PKI ledger (`dxosLedger`), `file-scanner` + ClamAV `1.5.5` + RustFS `1.0.6`, AES-256-GCM vault (`dxosVault`), 56 static `FORCE RLS` tables under `nocobase_app` | `/enterprise-login`, `/api/dxosApiKeys:*`, `/api/dxosLedger:*`, `/api/dxosVault:*`, `/api/dxosDataGov:*` |
| **Plane 2** | IT/OT Digital Twin & Time-Series Telemetry | Eclipse Mosquitto `2.0.21` Dynamic Security (`allow_anonymous false`, `$CONTROL/dynamic-security/v1`, LWT `device.offline`), Node-RED `4.0.9` downlink, FIWARE Orion-LD `1.12.0` + MongoDB `8.0`, `latticeTelemetryPoints`, `latticeTwinShadows`, Arrhenius MKT engine, `2.0°C` HITL setpoint threshold | `/api/dxosBroker:*`, `/api/dxosBroker:orionNotify`, `/api/dxosBlocks:twin*`, `/api/dxosBlocks:telemetry*`, `/api/dxosBlocks:alarm*` |
| **Plane 3** | Unified Event Bus, LatticeFlow v2, Approvals & Stock `n8n` | `dxosEvents` (CloudEvents `1.0`, Standard Webhooks `whsec_`, PostgreSQL outbox `FOR UPDATE SKIP LOCKED`, `5`-failure/`120s` circuit breaker, DLQ), LatticeFlow v2 DAG (`dxosAutomations`: 24 nodes across 6 groups, `loopCursor`, HITL pause/resume), `dxosApprovals` (`M-of-N` + `dxosDelegations`), `dxosNotify`, Visual DMN (`dxosDmn`), OMS/WMS/FEFO/ePOD (`dxosWms`), optional Stock `n8n` `2.48.1` (`dxosN8n`) | `/admin/settings/workflow/automation`, `/api/dxosEvents:*`, `/api/dxosAutomations:*`, `/api/dxosApprovals:*`, `/api/dxosDmn:*`, `/api/dxosWms:*`, `/v/track/:code`, `/api/dxosN8n:*` |
| **Plane 4** | Multi-Portal, Field PWA, Public Forms & GitOps v3 | Role-scoped portals `/p/*` (`procurement`, `incidents`, `logistics`, `services`, `cmms`, `partner-claims`), Mobile Field PWA (`/v/mobile` with IndexedDB outbox and `quarantined` state), zero-PII Public Forms (`/v/form/:slug`), 12 Native v2 `BlockModel`s (`maplibre-gl`, WebGIS, BI Chart, WMS Ops, Creative Studio), `dxosBuilder` for `latticeCustom*`, P.A.R.A. + OCR + Hybrid RAG (`pgvector` `0.8.1` HNSW + RRF), Solution Bundle `v3` | `/p/<slug>`, `/v/mobile`, `/v/form/:slug`, `/admin/settings/dxos-studio`, `/admin/settings/dxos-para`, `/api/dxosBlocks:*`, `/api/latticePara:*`, `/api/dxosBuilder:*` |
| **Plane 5** | AI Workforce, App Builder 2.0, MCP & A2A | 7 Starter AI Profiles (`dxos-coordinator` through `dxos-analyst`), 20 Unified Tools + 4 IT/OT MCP Tools, App Builder 2.0 (`plan`, `build`, `patch`, `rollback`, safe `teardown`), Streamable HTTP MCP (`/api/dxos-mcp`, `/api/dxos-mcp/it-ot`), Google/LF A2A (`/.well-known/agent-card.json`, `/api/dxos-a2a`), Eval Lab, Vietnamese PII redaction, PostgreSQL token/USD quotas | `/admin/settings/dxos-ai`, `/.well-known/agent-card.json`, `/api/dxos-a2a`, `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `/api/dxosAi:*` |
| **Plane 6** | Application Runtime, OTel Observability & PITR | External `nocobase/nocobase:2.2.50` OCI host loading 7 Apache-2.0 plugins (`sdkProvidedByHost: true`), Fastify `5` (`/v1/*`), live OpenAPI `3.1.0` & AsyncAPI `3.0.0` specs, OTel Collector Contrib `0.123.0` (W3C `traceparent` + OTel GenAI spans), Prometheus `v3.3.0`, Grafana OSS `11.5.8`, Gotenberg `8.20.1` (`pdf`), PostgreSQL PITR WAL `.gz` archiving | `/api/dxos:health`, `/api/dxos:metrics`, `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/v1/*` |

## Five Cross-Plane Interaction Flows

Every operational workflow traverses a fixed sequence of verified boundaries rather than bypassing directly into internal tables or downstream engines:

| Flow | Cross-Plane Execution Chain |
| :---: | :--- |
| `1` | **Zero-Trust Edge & OIDC Session:** requests enter through Caddy `2.10` (TLS termination, `Strict-Transport-Security`, `-Server` header) to Apache APISIX `3.19.0` (`X-Request-Id`, Valkey-backed `limit-count`) and authenticate via Keycloak `26.8.2` (`PKCE S256`) or `ldx_pat_*` API keys before `latticeNativeScope` opens a PostgreSQL transaction bound to `app.current_org`. |
| `2` | **Public Zero-PII & Offline Field PWA:** `/v/form/*`, `/v/track/*`, and `/v/mobile` are served through `10-lattice-public-routes.sh` with per-response cryptographic nonce CSP headers (`default-src 'none'; script-src 'nonce-<n>'`). Field workers queue mutations inside IndexedDB `latticedx-mobile-outbox` and quarantine `4xx` conflicts under `quarantined`. |
| `3` | **Bidirectional IIoT Digital Twin:** edge sensors publish to Eclipse Mosquitto `2.0.21` (DynSec/LWT), Node-RED `4.0.9` normalizes telemetry to `dxosBlocks:telemetryIngest`, writes persist to `latticeTelemetryPoints`, and `latticeContextOutbox` drains NGSI-LD state to FIWARE Orion-LD `1.12.0`. Downlink commands from WebGIS or AI agents enforce a `2.0°C` HITL delta threshold before reaching Node-RED. |
| `4` | **Durable Event Bus & Stock `n8n`:** domain mutations enqueue CloudEvents `1.0` records into `latticeEventBus`, where a `10s` drainer signs Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<b64>`) toward external receivers or Stock `n8n` `2.48.1`, opening a `120s` circuit breaker after `5` consecutive endpoint failures. |
| `5` | **Agentic AI, MCP & OTel GenAI Telemetry:** calls arriving via Studio AI, `/api/dxos-mcp`, or `/api/dxos-a2a` run inside `createAuditedTool` for RBAC checks, Vietnamese PII redaction, PostgreSQL quota accounting, and OTel GenAI span export (`gen_ai.system`, `gen_ai.request.model`) to `otel-collector:4318`. |

## Five Isolated Production Network Zones (`prod.yml`)

In `infra/compose/prod.yml`, every container image is pinned to an immutable `@sha256` digest and placed across **five isolated Docker networks**. Four networks set `internal: true` so databases, message brokers, and antivirus daemons have zero direct ingress or egress to the public internet.

<ParamGrid
  title="Docker Network Segmentation (infra/compose/prod.yml)"
  :items="[
    { name: 'edge', type: 'bridge (public)', required: true, default: '80, 443', description: 'Public TLS ingress network hosting caddy (TLS + HSTS), keycloak, gateway (APISIX 3.19.0), and nocobase.' },
    { name: 'app', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Internal HTTP/gRPC service mesh connecting gateway, nocobase, file-scanner, orion-ld, nodered, n8n, gotenberg, otel-collector, prometheus, and grafana.' },
    { name: 'data', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Isolated persistence network for postgres (16.16), nocobase-db (pgvector 0.8.1-pg16), redis (Valkey 8.1), rustfs (1.0.6), orion-mongo (8.0), and telemetry collection.' },
    { name: 'scanner', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Quarantined malware inspection zone shared solely by file-scanner (:4010) and clamd (ClamAV 1.5.5 at :3310) under read_only: true.' },
    { name: 'iiot-net', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Dedicated IT/OT edge network isolating Eclipse Mosquitto (:1883), Node-RED (:1880), and the NocoBase Digital Twin broker.' }
  ]"
/>

### Valkey 8.1 Logical Database Partitioning

LatticeDX partitions **Valkey `8.1`** (`valkey/valkey:8.1-alpine`, BSD-3-Clause) by logical database index and responsibility:

| Partition | Binding / Plugin | Stored State & Limits |
| :--- | :--- | :--- |
| DB `0` | `CACHE_REDIS_URL` | NocoBase host application cache (`CACHE_DEFAULT_STORE=redis`). |
| DB `1` | `PUBSUB_ADAPTER_REDIS_URL` | PubSub channel `latticedx:surface-updates` forwarding record and workflow state changes to the `GET /api/dxosAi:surfaceEvents` SSE stream (capped at `1000` concurrent listeners with `25s` keepalive comments). |
| DB `2` | `DX_NATIVE_AUTH_SESSION_REDIS_URL` | Enterprise OIDC PKCE `state:` (`300s` TTL), single-use `ticket:` (`60s` TTL), and `revoked:` / `revoked_sid:` revocation keys (`24h` TTL). |
| APISIX counters | `limit-count` (`policy: redis`) | Per-IP rate limit counters enforcing `120` / `240` / `300` requests per `60s`. |

::: info PostgreSQL Outbox vs. Valkey PubSub
LatticeDX does **not** run Valkey Streams for durable delivery. Both transactional outboxes (`latticeContextOutbox` for NGSI-LD projection and `latticeEventBus` for webhook dispatch) reside in `FORCE RLS`-protected PostgreSQL `16` tables drained with `FOR UPDATE SKIP LOCKED`, keeping event enqueueing atomic with business transactions.
:::

## Compose Stack Topology & Deployment Profiles (`infra/compose/*`)

Local Compose stacks bind host ports strictly to `127.0.0.1` (leaving `postgres`, `nocobase-db`, `redis`, `clamav`, `orion-mongo`, and `mosquitto` unexposed). Production (`prod.yml`) ships default Zero-Trust services plus five opt-in profiles (`iam-sync`, `n8n`, `observability`, `pdf`, `iiot`).

| Compose File | Project Name | Services & Local Host Bindings (`127.0.0.1`) |
| :--- | :--- | :--- |
| `infra/compose/core.yml` | `lattice-dx` | Core API stack: `postgres`, `keycloak` (`:8081`), `api` (internal `:4000`), `gateway` (`:8080`), `clamav` |
| `infra/compose/nocobase.yml` | `lattice-dx` | NocoBase host (`:13000`), `nocobase-db` (`pgvector`), `redis` (Valkey `8.1`) |
| `infra/compose/iiot.yml` | `lattice-dx` | Isolated `iiot-net` stack: `mosquitto` (internal `1883`) and `nodered` (`:1880`) |
| `infra/compose/integration.yml` | `lattice-dx` | External integration stack: `orion-mongo`, `orion-ld` (`:1026`), `n8n` (`:5678`) |
| `infra/compose/native-files.yml` | *(overlay)* | Wires `file-scanner` (`:4010`) and `clamav` scanning for native attachments |
| `infra/compose/native-rehearsal.yml` | `lattice-native-rehearsal` | Isolated upgrade rehearsal (`nocobase-db` + `nocobase` on `:13001`) |
| `infra/compose/uc1-sample.yml` | *(overlay)* | Sample integration service `uc1-sample` (`:4100`) and `uc1-broker-worker` |
| `infra/compose/prod.yml` | `lattice-dx-prod` | Hardened Zero-Trust production stack (`80`/`443` via Caddy) with 5 opt-in profiles |

### Five Opt-In Production Profiles (`prod.yml`)

| Profile | Activated Services | Added Capability |
| :--- | :--- | :--- |
| `iam-sync` | `keycloak-config-cli` (`6.5.1-26`) | One-shot import of `lattice-realm.prod.json` into Keycloak |
| `n8n` | `n8n` (`2.48.1`) | External workflow engine backed by the `n8n_app` PostgreSQL database |
| `observability` | `otel-collector` (`0.123.0`), `prometheus` (`v3.3.0`), `grafana` (`11.5.8`) | OTLP trace ingestion, 5 Prometheus alert rules, and `latticedx-360.json` dashboard |
| `pdf` | `gotenberg` (`8.20.1`) | Sandboxed HTML-to-PDF voucher rendering with `--chromium-disable-javascript=true` |
| `iiot` | `mosquitto` (`2.0.21`), `nodered` (`4.0.9`) | DynSec MQTT broker and Node-RED downlink bridge inside `iiot-net` |

## CTU-OpenPaw 4-Repository Ecosystem

The platform is maintained across four independent Pure-OSI repositories (`Apache-2.0`) separating runtime core code, bilingual documentation, curated GitOps templates, and organization governance.

<EcosystemTopologyDiagram />

| Repository | License | Technical Role | Link |
| :--- | :--- | :--- | :--- |
| **`CTU-OpenPaw/lattice-dx`** | `Apache-2.0` | Core platform `v0.4.2`: 7 `@latticedx/*` NocoBase plugins, Fastify `/v1/*` API, AI worker, `file-scanner` sidecar, Compose stacks, and PITR recovery scripts | [GitHub `lattice-dx`](https://github.com/CTU-OpenPaw/lattice-dx) |
| **`CTU-OpenPaw/lattice-docs`** | `Apache-2.0` / `MIT` | Bilingual VitePress documentation portal (Vietnamese `/` and English `/en/`) with interactive architecture diagrams and API reference | [Docs Home](/en/) |
| **`CTU-OpenPaw/lattice-templates`** | `Apache-2.0` | Curated catalog of 43 validated JSON artifacts: LatticeFlow v2 blueprints, n8n workflows, DMN tables, Business Packs, Public Forms, and Solution Bundle v3 | [GitHub `lattice-templates`](https://github.com/CTU-OpenPaw/lattice-templates) |
| **`CTU-OpenPaw/.github`** | `Apache-2.0` | Organization profile, community health governance, Code of Conduct, and vulnerability disclosure guidelines | [GitHub `.github`](https://github.com/CTU-OpenPaw/.github) |

## Live Specifications & Runtime Health

Plane 6 exposes unauthenticated health checks (or token-guarded metrics) and dynamically generated API specifications that include runtime `latticeCustom*` collections alongside core platform resources.

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Public | Bearer JWT | ldx_pat_*"
  summary="Returns the live OpenAPI 3.1.0 specification dynamically introspecting runtime latticeCustom* collections."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public | Bearer JWT | ldx_pat_*"
  summary="Returns the live AsyncAPI 3.0.0 specification covering 3 servers (mqttBroker, httpGateway, redisPubSub) and 5 channels."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:metrics"
  auth="Bearer DX_METRICS_TOKEN | root | ldx_admin"
  summary="Exports 12 Prometheus metric families covering HTTP latency, RLS errors, outbox backlog/DLQ, AI tokens, and SSE listeners."
/>

<CodeTabs
  :tabs="[
    {
      label: 'Health & Live Specs (bash)',
      lang: 'bash',
      code: '# Check NocoBase + 7-plugin runtime health\ncurl -fsS http://127.0.0.1:8080/api/dxos:health\n\n# Fetch live OpenAPI 3.1.0 spec (includes dynamic latticeCustom* collections)\ncurl -fsS http://127.0.0.1:8080/api/dxos:openapi | jq \x22.openapi, .info.version\x22\n\n# Fetch live AsyncAPI 3.0.0 spec (MQTT, SSE, Valkey PubSub, Webhooks)\ncurl -fsS http://127.0.0.1:8080/api/dxos:asyncapi | jq \x22.asyncapi, (.channels | keys)\x22'
    },
    {
      label: 'Prometheus Metrics (bash)',
      lang: 'bash',
      code: '# Scrape 12 Prometheus metric families via DX_METRICS_TOKEN\ncurl -fsS -H \x22Authorization: Bearer $DX_METRICS_TOKEN\x22 \\\n  http://127.0.0.1:8080/api/dxos:metrics'
    },
    {
      label: 'AsyncAPI 3.0 Topology (json)',
      lang: 'json',
      code: '{\n  \x22asyncapi\x22: \x223.0.0\x22,\n  \x22servers\x22: {\n    \x22mqttBroker\x22: { \x22protocol\x22: \x22mqtt\x22 },\n    \x22httpGateway\x22: { \x22protocol\x22: \x22http\x22 },\n    \x22redisPubSub\x22: { \x22protocol\x22: \x22redis\x22 }\n  },\n  \x22channels\x22: {\n    \x22iotTelemetry\x22: {},\n    \x22iotDownlinkCommand\x22: {},\n    \x22surfaceEventsSse\x22: {},\n    \x22redisSurfaceUpdates\x22: {},\n    \x22contextOutboxWebhooks\x22: {}\n  }\n}'
    }
  ]"
/>

## Operational Boundaries & Fail-Closed Defaults

| Boundary | Enforcement Rule |
| :--- | :--- |
| External OCI host boundary | `CTU-OpenPaw/lattice-dx` never embeds `upstream/nocobase` submodules or `.gitmodules`. The `nocobase/nocobase:2.2.50` host container mounts the 7 plugin directories read-only (`:ro`) at `/app/nocobase/node_modules/@latticedx/*`. |
| Fail-closed defaults across layers | Missing `app.current_org` returns `0` rows in PostgreSQL; setting `DX_ALLOW_PUBLIC_SIGNUP` off disables self-registration; outbound connectors block private, loopback, and cloud metadata IPs (`169.254.*`) unless explicitly allowlisted. |
| Clause 5.2 attribution preserved | `Powered by NocoBase`, `v2.2.50`, and `License settings` remain visible across the admin console and native workspaces. |

## Related

- [7-Plugin Architecture & Host Contract](/en/architecture/plugin-system)
- [Multi-Tenancy & PostgreSQL 16 FORCE RLS](/en/architecture/multi-tenancy-rls)
- [Zero-Trust Security Model & Network Zones](/en/architecture/security-model)
- [Zero-Trust Production Deployment](/en/getting-started/production-deployment)
