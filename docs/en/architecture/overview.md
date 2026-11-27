---
title: Platform Architecture Overview (v0.4.2)
description: Four-tier platform architecture, five canonical interaction patterns, five isolated Docker network zones, Compose profiles, and the four-repository Apache-2.0 ecosystem of LatticeDX v0.4.2.
---

# Platform Architecture Overview (v0.4.2)

LatticeDX `v0.4.2` organizes enterprise operations into a **4-tier platform architecture** (**Tier 3 Pluggable Business Applications** -> **Tier 2 User & Configuration Experience** -> **Tier 1 Headless Runtime & Shared Services** -> **Service-owned Data**) paired with **five canonical interaction patterns** and **five isolated container network zones**. This separation isolates pluggable domain apps, role-scoped workspaces, the external `nocobase/nocobase:2.2.50` host with `7` Apache-2.0 plugins, IT/OT digital-twin pipelines, governed AI agents, and PostgreSQL `16` storage protected by `FORCE ROW LEVEL SECURITY`.

<figure class="ldx-arch-figure">

![LatticeDX v0.4.2 Platform Architecture — 4 tiers, 5 interaction patterns, and cross-cutting operations](/images/architecture-v042-en.webp)

<figcaption><strong>LatticeDX <code>v0.4.2</code> Platform Architecture:</strong> four architectural tiers (Tier 3 Pluggable Business Applications, Tier 2 User &amp; Configuration Experience, Tier 1 Headless Runtime &amp; Shared Services across 5 horizontal bands, Service-owned Data), 5 Platform Interaction Patterns, and Cross-cutting Operations.</figcaption>
</figure>

<PlatformPlanesDiagram />

## The 4-Tier Stack & Shared Services

Each tier owns a distinct operational boundary. Every domain mutation enters through governed Tier 1 API contracts and `FORCE RLS` policies rather than bypassing directly into internal database tables.

| Tier / Band | Architectural Scope | Core Services & Modules | Primary Routes & Endpoints |
| :--- | :--- | :--- | :--- |
| **Tier 3 · Pluggable Business Applications** | Domain & AI-built solutions | **Cold-Chain Logistics & WMS** (`dxosWms`: orders, FEFO lots, Arrhenius MKT & ePOD), **IIoT Incidents & Digital Twin** (telemetry, WebGIS & 2-way control), **CMMS & Partner Claims** (maintenance, SLA & claims), **Procurement, ITSM & AI-Built Apps** (`latticeCustom*`) | `/p/logistics`, `/p/incidents`, `/p/cmms`, `/p/partner-claims`, `/p/procurement`, `/p/services`, `/v/track/:code` |
| **Tier 2 · User & Configuration Experience** | Views sharing one frontend | **Role Workspaces** (`/p/*`, Mobile Field PWA `/v/mobile` with IndexedDB outbox + `quarantined`, zero-PII Public `/v/form/:slug`), **NocoBase & Control Studio**, **Data, BI & WebGIS Views** (`12` Native v2 `BlockModel`s including `maplibre-gl`, BI, WMS Ops), **AI Studio & HITL Views** | `/p/<slug>`, `/v/mobile`, `/v/form/:slug`, `/admin/settings/dxos-studio`, `/admin/settings/dxos-ai` |
| **Tier 1 · Access & Identity** | Secure access & Zero-Trust edge | **Keycloak `26.8.2`** (OIDC + PKCE `S256`), **Caddy `2.10` & Apache APISIX `3.19.0` Gateway** (TLS `1.3`, HSTS, `-Server`, `X-Request-Id`, Valkey `limit-count`), `@latticedx/plugin-enterprise-auth` | `/enterprise-login`, `/api/enterpriseAuth:*` |
| **Tier 1 · Application Runtime** | Application backend & domain logic | **External `nocobase/nocobase:2.2.50` Host** loading `7` Apache-2.0 plugins (`sdkProvidedByHost: true`, mounted `:ro`), **Fastify `5` Domain Services** (`/v1/*` & specialized business logic) | `/api/dxos:health`, `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/v1/*` |
| **Tier 1 · Team-owned Platform Core** | Core services owned by the team | **App Registry & Bundle v3** (`dxosBuilder` for `latticeCustom*`), **Adapters & API Contracts** (OpenAPI `3.1.0`, AsyncAPI `3.0.0`, AES-256-GCM Vault `dxosVault`), **Shared Policies** (`56` static `FORCE RLS` tables under `nocobase_app` + `ldx_pat_*` scopes), **Outbox & Event Coordination** (`dxosEvents`: CloudEvents `1.0`, Standard Webhooks `whsec_`, `FOR UPDATE SKIP LOCKED`, `5`-failure/`120s` circuit breaker, DLQ) | `/api/dxosApiKeys:*`, `/api/dxosVault:*`, `/api/dxosEvents:*`, `/api/dxosBuilder:*`, `/api/dxosDataGov:*` |
| **Tier 1 · Automation & Context** | Workflows, integrations & IIoT context | **LatticeFlow v2 & Approvals** (`dxosAutomations`: `24` nodes across `6` groups, `loopCursor`, `dxosApprovals` `M-of-N` + `dxosDelegations`, `dxosNotify`), **Visual DMN Rules** (`dxosDmn` FEEL), **Stock `n8n` `2.48.1`** (external integrations via REST v1 & OAuth2 PKCE), **NGSI-LD Broker & MQTT** (FIWARE Orion-LD `1.12.0`, Eclipse Mosquitto `2.0.21` DynSec, Node-RED `4.0.9`, `2.0°C` HITL guard) | `/admin/settings/workflow/automation`, `/api/dxosAutomations:*`, `/api/dxosApprovals:*`, `/api/dxosDmn:*`, `/api/dxosN8n:*`, `/api/dxosBroker:*` |
| **Tier 1 · Agent Services** | AI workforce & app building | **Business Agents & P.A.R.A. RAG** (`7` Profiles `dxos-coordinator`..`dxos-analyst`, `20` Unified Tools + `4` IT/OT MCP Tools, `/api/dxos-mcp`, `/api/dxos-a2a`, `/.well-known/agent-card.json`, Vietnamese PII redaction, PostgreSQL quotas, Hybrid RAG HNSW + RRF), **Application Builder 2.0** (Isolated Schema/ER Plan-Diff, Preview & Safe Rollback) | `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `/api/dxos-a2a`, `/api/dxosAi:*`, `/api/latticePara:*` |
| **Service-owned Data** | Governed persistence & ledger | **PostgreSQL `16` + `pgvector` `0.8.1`** (`56` `FORCE RLS` tables & HNSW vectors), **RustFS `1.0.6` Object Storage**, **Orion-LD + MongoDB `8.0` & Valkey `8.1`**, **Ed25519 + Merkle Ledger** (`dxosLedger`) | `/api/dxosLedger:*`, `/api/dxosBlocks:*` |
| **Cross-cutting Operations** | Observability, secrets, scanning & DR | **OTel Collector `0.123.0` + Prometheus `v3.3.0` + Grafana `11.5.8`** (W3C `traceparent` + OTel GenAI), **Vault & RBAC**, **File Quarantine & Scanning** (`file-scanner` + ClamAV `1.5.5`), **Gotenberg `8.20.1`** (`pdf`), **PITR WAL `.gz` Backups**, **Bundle v3 & CycloneDX SBOM** | `/api/dxos:metrics` |

## Five Platform Interaction Patterns (1–5)

Every operational workflow follows one of five end-to-end technical patterns, ensuring every state transition passes through authorized service boundaries and audit logging:

| Pattern | End-to-End Execution Path |
| :---: | :--- |
| `1` | **Application request:** `User / Workspace` -> `Caddy 2.10 + APISIX 3.19.0 Gateway` (TLS termination, `X-Request-Id`, Valkey `limit-count`) -> `NocoBase / Domain API` (`Keycloak` OIDC PKCE `S256` or `ldx_pat_*`) -> `PostgreSQL 16 FORCE RLS` (`latticeNativeScope` binding `app.current_org` under `nocobase_app`). |
| `2` | **External integration:** `External System` -> `Protected Webhook (HMAC Standard Webhooks whsec_)` -> `Event Bus (latticeEventBus, FOR UPDATE SKIP LOCKED, 5-failure/120s circuit breaker) / n8n 2.48.1 Adapter` -> `Authorized Service API (ldx_pat_*)`. |
| `3` | **Context-driven automation:** `Mosquitto 2.0.21 (DynSec/LWT) -> Node-RED 4.0.9` -> `NocoBase MKT & Outbox` -> `NGSI-LD Broker (FIWARE Orion-LD 1.12.0)` --*(Change notification / dashed)*--> `Visual DMN & MKT Rules` -> `LatticeFlow v2 / Task` (enforcing the `2.0°C` HITL guard on bidirectional downlink commands). |
| `4` | **Business agent:** `User / Workflow / MCP / A2A` -> `Business Agent + P.A.R.A. Hybrid RAG (pgvector HNSW + RRF)` -> `20 Scoped Tools (createAuditedTool: Vietnamese PII redaction, PostgreSQL quotas, OTel GenAI spans)` -> `Authorized Service APIs (HITL on sensitive mutations)`. |
| `5` | **Application builder:** `Builder · App Builder 2.0` -> `Isolated Plan & ER Diff` (dry-run `latticeCustom*` schema diff) -> `Validate & Preview` -> `Human Approval` -> `Publish Bundle v3 / Safe Rollback` (never writes directly to production DB). |

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

| Repository | License | Technical Role | Link |
| :--- | :--- | :--- | :--- |
| **`CTU-OpenPaw/lattice-dx`** | `Apache-2.0` | Core platform `v0.4.2`: 7 `@latticedx/*` NocoBase plugins, Fastify `/v1/*` API, AI worker, `file-scanner` sidecar, Compose stacks, and PITR recovery scripts | [GitHub `lattice-dx`](https://github.com/CTU-OpenPaw/lattice-dx) |
| **`CTU-OpenPaw/lattice-docs`** | `Apache-2.0` / `MIT` | Bilingual VitePress documentation portal (Vietnamese `/` and English `/en/`) with interactive architecture diagrams and API reference | [Docs Home](/en/) |
| **`CTU-OpenPaw/lattice-templates`** | `Apache-2.0` | Curated catalog of 43 validated JSON artifacts: LatticeFlow v2 blueprints, n8n workflows, DMN tables, Business Packs, Public Forms, and Solution Bundle v3 | [GitHub `lattice-templates`](https://github.com/CTU-OpenPaw/lattice-templates) |
| **`CTU-OpenPaw/.github`** | `Apache-2.0` | Organization profile, community health governance, Code of Conduct, and vulnerability disclosure guidelines | [GitHub `.github`](https://github.com/CTU-OpenPaw/.github) |

## Live Specifications & Runtime Health

The Application Runtime & Cross-cutting Operations layer exposes unauthenticated health checks (or token-guarded metrics) and dynamically generated API specifications that include runtime `latticeCustom*` collections alongside core platform resources.

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
  summary="Exports 16 Prometheus metric families covering HTTP latency, RLS errors, outbox backlog/DLQ, AI tokens, and SSE listeners."
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
      code: '# Scrape 16 Prometheus metric families via DX_METRICS_TOKEN\ncurl -fsS -H \x22Authorization: Bearer $DX_METRICS_TOKEN\x22 \\\n  http://127.0.0.1:8080/api/dxos:metrics'
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
